/**
 * Building a cover and rendering it to SVG or a raster image.
 *
 * @module render
 */

import { node } from './platform/index.js';
import { createRng } from './rng.js';
import { resolveSize, unit, len } from './geometry.js';
import { resolveFormat, printMarks, zonesOverlay, safeBox } from './formats/index.js';
import { animate, isAnimated } from './animate/index.js';
import { preloadIcons } from './icons.js';
import { rasterize } from './raster/index.js';
import { resolvePalette } from './palette.js';
import { fontPool } from './fonts.js';
import { LAYERS } from './layers.js';
import { wrapped, renderWrapped } from './render/wrap.js';
import { renderGroup } from './render/group.js';
import { registerDefs, renderUse } from './render/use.js';
import { expandRepeat } from './layers/repeat.js';
import { scaledReport } from './render/report.js';
import { hasLayoutRef, resolveLayoutRefs } from './type/layout-ref.js';
import { svgPixels } from './render/tiles.js';
import { IDENTITY, compose } from './effects/transform.js';
import { needsPixels } from './effects/index.js';
import { backdropSampler } from './render/backdrop.js';
import { noise, applyGrain } from './render/grain.js';
import { extractPalette } from './extract.js';
import { recipes, applyOverrides } from './recipes.js';
import { defineRecipe } from './json-recipe.js';
import { attrs, esc, num } from './svg.js';

export { VERSION } from './version.js';
export { coverKey } from './render/key.js';
import { coverKey } from './render/key.js';
export { safeBox } from './formats/index.js';

/** Covers built by {@link cover}, so rendering one doesn't resolve it twice. */
const built = new WeakSet();

/** Options that belong to the cover itself, never to a recipe layer. */
const COVER_KEYS = new Set(['width', 'height', 'aspect', 'seed', 'palette', 'recipe', 'layers', 'fonts', 'alt', 'radius', 'output', 'format', 'dpi', 'bleed', 'safe', 'cropMarks', 'cutLine', 'cut', 'textRender', 'overlay', 'loop']);

/**
 * Build a cover: resolve its size and palette and expand its recipe into a
 * layer stack. Pure and synchronous; the result is plain data you can
 * inspect, tweak and hand to {@link renderSvg} or {@link renderImage}.
 *
 * @param {import('./index.js').CoverOptions | import('./index.js').Cover} options - The cover.
 * @returns {import('./index.js').Cover} The resolved cover.
 * @throws {TypeError} On an unknown recipe or layer type.
 *
 * @example
 * const c = cover({ recipe: 'gridTitle', seed: 'my-post', title: 'Shipping covers', palette: 'dusk' });
 * c.layers.map((l) => l.id); // ['bg', 'mesh', 'grid', 'grain', 'title']
 */
export function cover(options) {
  if (built.has(/** @type {object} */ (options))) return /** @type {import('./index.js').Cover} */ (options);
  const o = /** @type {import('./index.js').CoverOptions} */ (options ?? {});
  const fmt = resolveFormat(o);
  const { width, height } = fmt ?? resolveSize(o);
  const print = fmt?.print;
  const palette = resolvePalette(o.palette);
  const seed = String(o.seed ?? (typeof o.title === 'string' ? o.title : 'cover'));

  let layers;
  /** @type {{ lossless?: boolean } | undefined} */
  let output;
  /** @type {string[] | undefined} */
  let pages;
  /** @type {import('./index.js').FontSource[] | undefined} */
  let recipeFonts;
  if (o.recipe) {
    const recipe = typeof o.recipe === 'function'
      ? o.recipe
      : typeof o.recipe === 'object'
        ? defineRecipe(o.recipe)
        : Object.hasOwn(recipes, o.recipe) ? recipes[/** @type {keyof typeof recipes} */ (o.recipe)] : undefined;
    if (!recipe) throw new TypeError(`Unknown recipe "${o.recipe}". Recipes: ${Object.keys(recipes).join(', ')}`);
    /** @type {Record<string, unknown>} */
    const ctx = { width, height, palette, rng: createRng(`${seed}:recipe`), u: unit({ width, height }), seed };
    if (print) Object.assign(ctx, { bleed: print.bleed, safe: print.safe, trimWidth: print.trimWidth, trimHeight: print.trimHeight, mm: print.mm, dpi: print.dpi });
    const sb = safeBox({ width, height, print, zones: fmt?.zones }) ?? { x: 0, y: 0, width, height };
    Object.assign(ctx, { safeX: sb.x, safeY: sb.y, safeWidth: sb.width, safeHeight: sb.height });
    if (fmt?.format) ctx.format = fmt.format;
    const recipeOptions = Object.fromEntries(Object.entries(o).filter(([k]) => !COVER_KEYS.has(k)));
    layers = [...applyOverrides(recipe(/** @type {any} */ (recipeOptions), /** @type {any} */ (ctx)), recipeOptions), ...(o.layers ?? [])];
    output = /** @type {any} */ (recipe).json?.output;
    recipeFonts = /** @type {any} */ (recipe).json?.fonts;
    pages = /** @type {any} */ (recipe).json?.pages;
  } else {
    layers = o.layers ?? [{ type: 'mesh' }, { type: 'grain' }];
  }

  for (const layer of layers) {
    if (!layer || !Object.hasOwn(LAYERS, layer.type)) {
      throw new TypeError(`Unknown layer type "${layer?.type}". Types: ${Object.keys(LAYERS).join(', ')}`);
    }
  }

  const result = {
    width,
    height,
    seed,
    palette,
    layers,
    // The caller's fonts first, then any the recipe declares.
    fonts: recipeFonts?.length ? [...(o.fonts ?? []), ...recipeFonts] : o.fonts ?? [],
    alt: o.alt ?? (typeof o.title === 'string' ? o.title : undefined),
    radius: o.radius,
    // A recipe's preferred encoding (e.g. dither: lossless). renderImage options win.
    output: o.output ?? output,
  };
  // 1.1 fields, set only when used (a 1.0 cover's data is unchanged).
  if (print) /** @type {any} */ (result).print = print;
  if (fmt?.format) /** @type {any} */ (result).format = fmt.format;
  if (o.page) /** @type {any} */ (result).page = o.page;
  if (pages) /** @type {any} */ (result).pages = pages;
  if (o.textRender) /** @type {any} */ (result).textRender = o.textRender;
  if (fmt?.zones) /** @type {any} */ (result).zones = fmt.zones;
  if (o.overlay) /** @type {any} */ (result).overlay = o.overlay;
  if (o.loop != null) /** @type {any} */ (result).loop = o.loop;
  built.add(result);
  return result;
}

/**
 * @typedef {object} Scope
 * @property {import('./index.js').Cover} c
 * @property {any} sharp
 * @property {import('./index.js').FontSource[]} fonts
 * @property {string} prefix - Id prefix ('' at the top).
 * @property {string} seedPrefix - Stream key prefix ('' at the top).
 * @property {number} width
 * @property {number} height
 * @property {((box: { x: number, y: number, width: number, height: number }) => Promise<string | undefined>) | undefined} backdrop
 * @property {((entry: any) => void) | undefined} report
 * @property {object} doc - Identity of the document being rendered.
 * @property {number} [t] - The time being drawn (seconds), for animated layers.
 */

/**
 * Render a stack of layers, each with its own seeded stream.
 *
 * A layer's stream is keyed by its `seed`, else its `id`, else its type
 * and how many layers of that type came before it, so adding a layer
 * leaves every other layer's random choices alone. Nested stacks (groups,
 * masks) key their streams under their parent's.
 *
 * @param {import('./index.js').Layer[]} layers
 * @param {Scope} scope
 * @returns {Promise<{ layer: import('./index.js').Layer, defs: string, body: string, pad?: number, finest?: number, ctx: import('./layers.js').RenderContext }[]>}
 */
async function renderStack(layers, scope) {
  const { c } = scope;
  /** @type {Record<string, number>} */
  const seen = {};
  /** @type {any[]} */
  const out = [];
  const top = !scope.prefix;
  const zones = top ? /** @type {any} */ (c).zones : undefined;
  for (let i = 0; i < layers.length; i++) {
    let layer = /** @type {any} */ (layers[i]);
    if (isAnimated(layer)) layer = animate(layer, scope.t ?? 0, /** @type {any} */ (c).loop);
    // `{layout.<id>.bottom}` and the like: where an earlier text block landed.
    if (scope.layout && hasLayoutRef(layer)) layer = resolveLayoutRefs(layer, scope.layout);
    // A format's safe zone: anchored text and icons are laid out inside it.
    if (zones && (layer.type === 'text' || layer.type === 'icon') && layer.x == null && layer.y == null && layer.position == null && layer.area == null && layer.path == null) {
      const [zx, zy, zw, zh] = zones.safe;
      layer = { ...layer, area: { x: zx / c.width, y: zy / c.height, width: zw / c.width, height: zh / c.height } };
    }
    if (!layer || !Object.hasOwn(LAYERS, layer.type)) throw new TypeError(`Unknown layer type "${layer?.type}". Types: ${Object.keys(LAYERS).join(', ')}`);
    const n = (seen[layer.type] = (seen[layer.type] ?? -1) + 1);
    const key = layer.seed ?? layer.id ?? `${layer.type}#${n}`;
    const ctx = /** @type {any} */ ({
      width: scope.width,
      height: scope.height,
      canvas: { width: scope.width, height: scope.height },
      palette: c.palette,
      rng: createRng(scope.seedPrefix ? `${c.seed}:${scope.seedPrefix}/${key}` : `${c.seed}:${key}`),
      id: top ? `l${i}` : `${scope.prefix}_${i}`,
      fonts: scope.fonts,
      sharp: scope.sharp,
    });
    // 1.1 context, present only when it applies (1.0 layers never read it).
    const print = /** @type {any} */ (c).print;
    if (print && top) ctx.inset = print.bleed + print.safe;
    if (print) ctx.cut = { x: print.bleed, y: print.bleed, width: print.trimWidth, height: print.trimHeight, cut: print.cut, mm: print.mm };
    if (scope.raster) ctx.raster = true;
    if (scope.reach) ctx.noteReach = (/** @type {number} */ px) => { /** @type {any} */ (scope.reach).px = Math.max(/** @type {any} */ (scope.reach).px, px); };
    if (/** @type {any} */ (c).textRender) ctx.textRender = /** @type {any} */ (c).textRender;
    if (scope.report) ctx.report = scope.report;
    ctx.scale = scope.scale ?? 1;
    ctx.res = scope.res ?? 1;
    ctx.matrix = scope.matrix ?? IDENTITY;
    ctx.doc = scope.doc;
    ctx.defs = scope.defs;
    if (scope.layout) ctx.layout = scope.layout;
    ctx.backdrop = top && scope.backdrop ? (/** @type {any} */ box) => /** @type {any} */ (scope.backdrop)(box, out) : undefined;
    // A nested stack (group, mask) inherits the scale of the context it's
    // called on (a transformed layer's copy carries its own), times its grid's.
    ctx.stack = function stack(/** @type {any[]} */ list, /** @type {any} */ sub) {
      const self = this ?? ctx;
      const k = sub.scale ?? 1;
      return renderStack(list, {
        ...scope,
        report: scaledReport(self.report, k),
        scale: (self.scale ?? 1) * k,
        res: (self.res ?? 1) * (sub.res ?? k),
        matrix: compose(self.matrix ?? IDENTITY, sub.matrix ?? IDENTITY),
        prefix: `${ctx.id}${sub.tag}`,
        seedPrefix: `${scope.seedPrefix ? `${scope.seedPrefix}/` : ''}${key}${sub.tag}`,
        width: sub.width ?? self.width,
        height: sub.height ?? self.height,
      });
    };
    const markup = wrapped(layer) ? await renderWrapped(/** @type {any} */ (layer), ctx, scope, renderOne) : await renderOne(/** @type {any} */ (layer), ctx);
    out.push({ layer, ...markup, ctx });
  }
  return out;
}

/**
 * One layer's own markup.
 *
 * @param {any} layer
 * @param {any} ctx
 * @returns {Promise<{ defs: string, body: string, pad?: number, finest?: number }>}
 */
async function renderOne(layer, ctx) {
  if (layer.type === 'group') return renderGroup(layer, ctx);
  if (layer.type === 'repeat') return renderGroup(expandRepeat(layer, ctx), ctx);
  if (layer.type === 'defs') return registerDefs(layer, ctx);
  if (layer.type === 'use') return renderUse(layer, ctx);
  // A mesh can take its colours from a photo (`from`), extracted at render.
  const resolved = layer.type === 'mesh' && layer.from && !layer.colors
    ? { ...layer, colors: await extractPalette(layer.from, { count: 4 }) }
    : layer;
  return LAYERS[/** @type {keyof typeof LAYERS} */ (layer.type)](/** @type {any} */ (resolved), ctx);
}

/**
 * Render every layer of a cover.
 *
 * @param {import('./index.js').Cover} c
 * @param {any} sharp
 * @param {{ report?: (entry: any) => void, t?: number, raster?: boolean, reach?: { px: number } }} [extra] - `raster`: drawn for `renderImage` (librsvg), so effects may take its faster forms; `reach` collects how far filters reach, output px.
 */
async function renderLayers(c, sharp, extra = {}) {
  // Icon sets named anywhere in the stack load first (from node_modules, or configure({ icons }) elsewhere).
  const names = new Set();
  const scan = (/** @type {unknown} */ v) => {
    if (typeof v === 'string') { if (/^[a-z0-9-]+:[a-z0-9-]+$/i.test(v)) names.add(v); } else if (Array.isArray(v)) v.forEach(scan); else if (v && typeof v === 'object' && !(v instanceof Uint8Array)) Object.values(v).forEach(scan);
  };
  scan(c.layers);
  if (names.size) await preloadIcons(names);
  const auto = c.layers.some(usesAuto);
  const t = /** @type {any} */ (extra).t;
  return renderStack(c.layers, {
    c,
    sharp,
    fonts: fontPool(c.fonts),
    prefix: '',
    seedPrefix: '',
    width: c.width,
    height: c.height,
    backdrop: auto ? backdropSampler(c, sharp, documentFor, loadSharp) : undefined,
    report: extra.report,
    doc: {},
    layout: new Map(),
    defs: new Map(),
    t,
    raster: extra.raster,
    reach: extra.reach,
  });
}

/** @param {any} l @returns {boolean} Whether a layer (or its children) picks its colour from the backdrop. */
function usesAuto(l) {
  return Boolean(l) && (l.color === 'auto' || (Array.isArray(l.layers) && l.layers.some(usesAuto)));
}

/**
 * Assemble an SVG document from rendered layers.
 *
 * @param {import('./index.js').Cover} c - The cover.
 * @param {{ defs: string, body: string }[]} parts - Rendered layers.
 * @returns {string} The SVG document.
 */
function documentFor(c, parts) {
  const { width: w, height: h } = c;
  let defs = parts.map((p) => p.defs).join('');
  let body = parts.map((p) => p.body).join('');
  if (c.radius) {
    defs += `<clipPath id="r"><rect${attrs({ width: w, height: h, rx: len(c.radius, c) })}/></clipPath>`;
    body = `<g clip-path="url(#r)">${body}</g>`;
  }
  const title = c.alt ? `<title>${esc(c.alt)}</title>` : '';
  const zones = /** @type {any} */ (c).overlay ? /** @type {any} */ (c).zones ?? (/** @type {any} */ (c).print ? { safe: Object.values(/** @type {any} */ (safeBox(/** @type {any} */ (c))) ?? {}) } : undefined) : undefined;
  if (zones) body += zonesOverlay(zones, w, h);
  const print = /** @type {import('./formats.js').PrintInfo | undefined} */ (/** @type {any} */ (c).print);
  if (print && (print.cropMarks || print.cutLine)) {
    const { marks, cut } = printMarks(print, w, h);
    const s = print.slug;
    const W = w + 2 * s;
    const H = h + 2 * s;
    defs += `<clipPath id="bleed"><rect${attrs({ width: w, height: h })}/></clipPath>`;
    const art = `<g transform="translate(${num(s)} ${num(s)})"><g clip-path="url(#bleed)">${body}</g>${cut}</g>`;
    return `<svg xmlns="http://www.w3.org/2000/svg"${attrs({ width: W, height: H, viewBox: `0 0 ${num(W)} ${num(H)}`, role: c.alt ? 'img' : undefined })}>${title}${defs ? `<defs>${defs}</defs>` : ''}${s ? `<rect width="${num(W)}" height="${num(H)}" fill="#fff"/>` : ''}${art}${marks}</svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg"${attrs({ width: w, height: h, viewBox: `0 0 ${num(w)} ${num(h)}`, role: c.alt ? 'img' : undefined })}>${title}${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;
}

/**
 * Render a cover to an SVG string. Text and icons are outlines, so the SVG
 * needs no fonts; images are embedded as data URIs; nothing is fetched.
 * The same cover always gives byte-identical output.
 *
 * @param {import('./index.js').CoverOptions | import('./index.js').Cover} input - The cover.
 * @param {{ t?: number }} [options] - `t`: the time to draw, in seconds, for layers with keyframes (static covers ignore it).
 * @returns {Promise<string>} The SVG document.
 *
 * @example
 * const svg = await renderSvg({ recipe: 'aurora', seed: 'hello', palette: 'paper' });
 */
export async function renderSvg(input, options = {}) {
  const c = cover(input);
  const sharp = c.layers.some(hasImage) ? await loadSharp(false) : undefined;
  return documentFor(c, await renderLayers(c, sharp, { t: options.t }));
}

/**
 * Whether a layer (or one inside it) needs pixels to draw: an image, or an
 * effect computed on pixels (`dither`, a round `border`).
 *
 * @param {any} l
 * @returns {boolean}
 */
function hasImage(l) {
  if (!l) return false;
  if (l.type === 'image') return true;
  const fx = l.effects == null ? [] : [].concat(l.effects);
  if (fx.some((/** @type {any} */ e) => needsPixels(e) || (e?.mask?.layers ?? []).some(hasImage) || (e?.map?.layers ?? []).some(hasImage))) return true;
  return ['layers', 'mask', 'knockout', 'clip'].some((k) => Array.isArray(l[k]) && l[k].some(hasImage))
    || (l.type === 'repeat' && hasImage(l.layer));
}

/**
 * Render each page of a two-sided piece (a business card, a ticket, a
 * flyer): one SVG per page the recipe declares (`"pages": ["front", "back"]`),
 * or the pages you ask for. A layer is on a page by its `when`
 * (`{ "page": "back" }`); layers without one are on every page.
 *
 * @param {import('./index.js').CoverOptions} input
 * @param {{ pages?: string[] }} [options]
 * @returns {Promise<Record<string, string>>} SVG by page name.
 *
 * @example
 * const { front, back } = await renderPages({ recipe: card, format: 'business-card', name: 'Mira Okafor' });
 */
export async function renderPages(input, options = {}) {
  const probe = cover({ ...input, page: undefined });
  const pages = options.pages ?? /** @type {any} */ (probe).pages ?? ['front', 'back'];
  /** @type {Record<string, string>} */
  const out = {};
  for (const page of pages) out[page] = await renderSvg({ ...input, page });
  return out;
}

/**
 * Render a cover and note what was drawn (text sizes and boxes), for `lint`.
 *
 * @param {import('./index.js').CoverOptions | import('./index.js').Cover} input
 * @returns {Promise<{ svg: string, drawn: any[] }>}
 */
export async function renderReport(input) {
  const c = cover(input);
  const sharp = c.layers.some(hasImage) ? await loadSharp(false) : undefined;
  /** @type {any[]} */
  const drawn = [];
  const parts = await renderLayers(c, sharp, { report: (e) => drawn.push(e) });
  return { svg: documentFor(c, parts), drawn };
}

/**
 * Render a cover to an image in the browser (a canvas; no sharp).
 *
 * @param {import('./index.js').CoverOptions | import('./index.js').Cover} input
 * @param {{ format?: 'png' | 'jpeg' | 'webp', quality?: number, scale?: number, width?: number }} [options]
 * @returns {Promise<Blob>}
 */
export async function renderBlob(input, options = {}) {
  return rasterize(await renderSvg(input), options);
}

/** @type {Promise<any> | undefined} */
let sharpPromise;

/**
 * Import sharp (an optional peer dependency).
 *
 * @param {boolean} required - Throw when it's missing.
 * @returns {Promise<any>} The module's default export, or undefined.
 */
async function loadSharp(required) {
  // A computed specifier: bundlers for browsers and Workers leave the optional peer alone.
  const name = 'sharp';
  sharpPromise ??= import(/* @vite-ignore */ name).then((m) => m.default ?? m, () => undefined);
  const sharp = await sharpPromise;
  if (!sharp && required) throw new Error('renderImage() needs sharp: npm install sharp');
  return sharp;
}

/** Default encoder quality, by format (see the grain note in {@link renderImage}). */
export const DEFAULT_QUALITY = Object.freeze({ webp: 90, avif: 72, jpeg: 88, png: 100 });

/** Output MIME types, by format. */
export const MIME = Object.freeze({ webp: 'image/webp', png: 'image/png', avif: 'image/avif', jpeg: 'image/jpeg' });

/**
 * Render a cover to image bytes with sharp.
 *
 * Grain is the one layer not rasterised through the SVG: librsvg's
 * `feTurbulence` costs ~200ms at 1200×1200, so each grain layer becomes
 * seeded pixel noise composited by sharp (~10ms) between the SVG renders
 * of the layers below and above it. Everything else goes through librsvg.
 *
 * @param {import('./index.js').CoverOptions | import('./index.js').Cover} input - The cover.
 * @param {import('./index.js').RenderImageOptions} [options]
 * @returns {Promise<Buffer>} The encoded image.
 *
 * @example
 * const webp = await renderImage({ recipe: 'bigType', seed: 'x', title: 'Hello' }, { format: 'webp' });
 */
export async function renderImage(input, options = {}) {
  const c = cover(input);
  const format = options.format ?? 'webp';
  if (!Object.hasOwn(MIME, format)) throw new TypeError(`Unknown format "${format}" (webp, png, avif, jpeg)`);

  let cacheFile;
  const fsp = node('fs/promises');
  const path = node('path');
  if (options.cache && fsp && path) {
    const dir = options.cache === true ? path.join(/** @type {any} */ (globalThis).process.cwd(), 'node_modules', '.cache', 'covers') : path.resolve(String(options.cache));
    cacheFile = path.join(dir, `${await coverKey(c, options)}.${format}`);
    try {
      return await fsp.readFile(cacheFile);
    } catch {
      // Not cached yet.
    }
  }

  const sharp = await loadSharp(true);
  /** How far any effect's filter reaches, output px (tiles overlap by it). */
  const reach = { px: 0 };
  const parts = await renderLayers(c, sharp, { raster: true, reach });
  const { width, height } = c;

  // Split the stack: [svg] grain [svg] …, with each heavily blurred layer
  // (a mesh) in a step of its own, rendered padded (see `soft` below).
  /** @type {{ svg?: typeof parts, grain?: typeof parts[number], soft?: typeof parts[number] }[]} */
  const steps = [];
  let run = [];
  for (const part of parts) {
    const kind = part.layer.type === 'grain' ? 'grain' : part.pad ? 'soft' : null;
    if (kind) {
      if (run.length) steps.push({ svg: run });
      steps.push({ [kind]: part });
      run = [];
    } else {
      run.push(part);
    }
  }
  if (run.length) steps.push({ svg: run });

  const raw = { width, height, channels: /** @type {const} */ (4) };
  // Every step's document carries every layer's defs (a pattern or a used stack defined in another step).
  const allDefs = parts.map((p) => p.defs).join('');
  const svgOf = (/** @type {typeof parts} */ p) => Buffer.from(documentFor(/** @type {any} */ ({ ...c, radius: undefined, alt: undefined, print: undefined, overlay: undefined }), [{ defs: allDefs, body: '' }, ...p.map((x) => ({ ...x, defs: '' }))]));
  /** @type {Buffer | undefined} */
  let pixels;
  for (const step of steps) {
    if (step.soft) {
      // librsvg clips a filter's input to the canvas, so a blur near an edge
      // fades to transparent there (a vignette). Render the layer on a canvas
      // padded by 3σ (so the edge sees the colour beyond it), at the smallest
      // scale that keeps its finest blur above ~1.6px, then crop and upscale.
      const pad = /** @type {number} */ (step.soft.pad);
      const scale = Math.min(1, Math.max(0.2, 1.6 / (step.soft.finest || 1)));
      const pw = width + pad * 2;
      const ph = height + pad * 2;
      const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(pw * scale)}" height="${Math.round(ph * scale)}" viewBox="${-pad} ${-pad} ${pw} ${ph}"><defs>${step.soft.defs}</defs>${step.soft.body}</svg>`;
      const layerPx = await sharp(Buffer.from(doc))
        .extract({ left: Math.round(pad * scale), top: Math.round(pad * scale), width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) })
        .resize(width, height, { kernel: 'cubic', fit: 'fill' })
        .ensureAlpha()
        .raw()
        .toBuffer();
      pixels = pixels
        ? await sharp(pixels, { raw }).composite([{ input: layerPx, raw }]).raw().toBuffer()
        : layerPx;
    } else if (step.svg) {
      const svg = svgOf(step.svg);
      const layerPx = await svgPixels(sharp, svg.toString(), width, height, reach.px);
      pixels = pixels
        ? await sharp(pixels, { raw }).composite([{ input: layerPx, raw }]).raw().toBuffer()
        : Buffer.from(layerPx.buffer, layerPx.byteOffset, layerPx.byteLength);
    } else if (step.grain) {
      pixels ??= Buffer.alloc(width * height * 4);
      const g = /** @type {import('./index.js').GrainLayer} */ (step.grain.layer);
      applyGrain(pixels, { ...(await noise(sharp, width, height, g, step.grain.ctx.rng)), width, height }, g);
    }
  }
  let image = sharp(pixels ?? Buffer.alloc(width * height * 4), { raw });
  if (c.radius) {
    const rx = len(c.radius, c);
    image = image.composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${num(rx)}"/></svg>`), blend: 'dest-in' }]);
  }

  // Preview overlay and print furniture (crop marks, die line) go on last.
  const cx = /** @type {any} */ (c);
  if (cx.overlay && (cx.zones || cx.print)) {
    const z = cx.zones ?? { safe: Object.values(/** @type {any} */ (safeBox(cx))) };
    image = sharp(await image.png().toBuffer()).composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${zonesOverlay(z, width, height)}</svg>`) }]);
  }
  if (cx.print && (cx.print.cropMarks || cx.print.cutLine)) {
    const s = cx.print.slug;
    const { marks, cut } = printMarks(cx.print, width, height);
    image = sharp(await image.png().toBuffer()).extend({ top: s, bottom: s, left: s, right: s, background: '#ffffff' })
      .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width + 2 * s}" height="${height + 2 * s}"><g transform="translate(${s} ${s})">${cut}</g>${marks}</svg>`) }]);
  }
  if (cx.print) image = image.withMetadata({ density: cx.print.dpi });

  // Grain is the first thing a lossy encoder throws away. Measured on an
  // aurora cover: WebP q82 keeps ~40% of the grain (11 KB), q90 ~60% (41 KB),
  // q94 ~78% (125 KB). 90 is the default; raise it for crisper grain.
  const quality = options.quality ?? DEFAULT_QUALITY[format];
  const lossless = options.lossless ?? c.output?.lossless ?? false;
  if (format === 'webp') image = image.webp(lossless ? { lossless: true, effort: options.effort ?? 4 } : { quality, effort: options.effort ?? 4 });
  else if (format === 'avif') image = image.avif(lossless ? { lossless: true, effort: options.effort ?? 4 } : { quality, effort: options.effort ?? 4 });
  else if (format === 'jpeg') image = image.flatten({ background: c.palette.bg }).jpeg({ quality, mozjpeg: true });
  else image = image.png({ compressionLevel: options.effort ?? 6 });
  const out = await image.toBuffer();

  if (cacheFile && fsp && path) {
    await fsp.mkdir(path.join(cacheFile, '..'), { recursive: true });
    const tmp = `${cacheFile}.${/** @type {any} */ (globalThis).process.pid}.tmp`;
    await fsp.writeFile(tmp, out);
    await fsp.rename(tmp, cacheFile);
  }
  return out;
}

