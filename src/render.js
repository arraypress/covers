/**
 * Building a cover and rendering it to SVG or a raster image.
 *
 * @module render
 */

import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createRng } from './rng.js';
import { resolveSize, unit, len } from './geometry.js';
import { resolvePalette } from './palette.js';
import { bundledFonts } from './fonts.js';
import { LAYERS, VARY_FLOOR, VARY_PEAK } from './layers.js';
import { extractPalette } from './extract.js';
import { recipes, applyOverrides } from './recipes.js';
import { defineRecipe } from './json-recipe.js';
import { attrs, esc, num } from './svg.js';

/** The package version, part of every cache key. */
export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

/** Covers built by {@link cover}, so rendering one doesn't resolve it twice. */
const built = new WeakSet();

/** Options that belong to the cover itself, never to a recipe layer. */
const COVER_KEYS = new Set(['width', 'height', 'aspect', 'seed', 'palette', 'recipe', 'layers', 'fonts', 'alt', 'radius']);

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
  const { width, height } = resolveSize(o);
  const palette = resolvePalette(o.palette);
  const seed = String(o.seed ?? (typeof o.title === 'string' ? o.title : 'cover'));

  let layers;
  if (o.recipe) {
    const recipe = typeof o.recipe === 'function'
      ? o.recipe
      : typeof o.recipe === 'object'
        ? defineRecipe(o.recipe)
        : Object.hasOwn(recipes, o.recipe) ? recipes[/** @type {keyof typeof recipes} */ (o.recipe)] : undefined;
    if (!recipe) throw new TypeError(`Unknown recipe "${o.recipe}". Recipes: ${Object.keys(recipes).join(', ')}`);
    const ctx = { width, height, palette, rng: createRng(`${seed}:recipe`), u: unit({ width, height }), seed };
    const recipeOptions = Object.fromEntries(Object.entries(o).filter(([k]) => !COVER_KEYS.has(k)));
    layers = [...applyOverrides(recipe(/** @type {any} */ (recipeOptions), ctx), recipeOptions), ...(o.layers ?? [])];
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
    fonts: o.fonts ?? [],
    alt: o.alt ?? (typeof o.title === 'string' ? o.title : undefined),
    radius: o.radius,
  };
  built.add(result);
  return result;
}

/**
 * Render every layer to markup, each with its own seeded stream.
 *
 * A layer's stream is keyed by its `seed`, else its `id`, else its type
 * and how many layers of that type came before it, so adding a layer
 * leaves every other layer's random choices alone.
 *
 * @param {import('./index.js').Cover} c - The cover.
 * @param {any} sharp - The sharp module, or undefined.
 * @returns {Promise<{ layer: import('./index.js').Layer, defs: string, body: string, pad?: number, finest?: number, ctx: import('./layers.js').RenderContext }[]>}
 */
async function renderLayers(c, sharp) {
  const fonts = [...c.fonts, ...bundledFonts()];
  /** @type {Record<string, number>} */
  const seen = {};
  const out = [];
  for (let i = 0; i < c.layers.length; i++) {
    const layer = c.layers[i];
    const n = (seen[layer.type] = (seen[layer.type] ?? -1) + 1);
    const key = layer.seed ?? layer.id ?? `${layer.type}#${n}`;
    const ctx = {
      width: c.width,
      height: c.height,
      canvas: { width: c.width, height: c.height },
      palette: c.palette,
      rng: createRng(`${c.seed}:${key}`),
      id: `l${i}`,
      fonts,
      sharp,
    };
    // A mesh can take its colours from a photo (`from`), extracted at render.
    const resolved = layer.type === 'mesh' && /** @type {any} */ (layer).from && !/** @type {any} */ (layer).colors
      ? { ...layer, colors: await extractPalette(/** @type {any} */ (layer).from, { count: 4 }) }
      : layer;
    const markup = await LAYERS[layer.type](/** @type {any} */ (resolved), ctx);
    out.push({ layer, ...markup, ctx });
  }
  return out;
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
  return `<svg xmlns="http://www.w3.org/2000/svg"${attrs({ width: w, height: h, viewBox: `0 0 ${num(w)} ${num(h)}`, role: c.alt ? 'img' : undefined })}>${title}${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`;
}

/**
 * Render a cover to an SVG string. Text and icons are outlines, so the SVG
 * needs no fonts; images are embedded as data URIs; nothing is fetched.
 * The same cover always gives byte-identical output.
 *
 * @param {import('./index.js').CoverOptions | import('./index.js').Cover} input - The cover.
 * @returns {Promise<string>} The SVG document.
 *
 * @example
 * const svg = await renderSvg({ recipe: 'aurora', seed: 'hello', palette: 'paper' });
 */
export async function renderSvg(input) {
  const c = cover(input);
  const sharp = c.layers.some((l) => l.type === 'image') ? await loadSharp(false) : undefined;
  return documentFor(c, await renderLayers(c, sharp));
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
  sharpPromise ??= import('sharp').then((m) => m.default ?? m, () => undefined);
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
  if (options.cache) {
    const dir = options.cache === true ? join(process.cwd(), 'node_modules', '.cache', 'covers') : resolve(String(options.cache));
    cacheFile = join(dir, `${await coverKey(c, options)}.${format}`);
    try {
      return await readFile(cacheFile);
    } catch {
      // Not cached yet.
    }
  }

  const sharp = await loadSharp(true);
  const parts = await renderLayers(c, sharp);
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
  const svgOf = (/** @type {typeof parts} */ p) => Buffer.from(documentFor({ ...c, radius: undefined, alt: undefined }, p));
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
      pixels = pixels
        ? await sharp(pixels, { raw }).composite([{ input: svg }]).raw().toBuffer()
        : await sharp(svg).ensureAlpha().raw().toBuffer();
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

  // Grain is the first thing a lossy encoder throws away. Measured on an
  // aurora cover: WebP q82 keeps ~40% of the grain (11 KB), q90 ~60% (41 KB),
  // q94 ~78% (125 KB). 90 is the default; raise it for crisper grain.
  const quality = options.quality ?? DEFAULT_QUALITY[format];
  if (format === 'webp') image = image.webp({ quality, effort: options.effort ?? 4 });
  else if (format === 'avif') image = image.avif({ quality, effort: options.effort ?? 4 });
  else if (format === 'jpeg') image = image.flatten({ background: c.palette.bg }).jpeg({ quality, mozjpeg: true });
  else image = image.png({ compressionLevel: options.effort ?? 6 });
  const out = await image.toBuffer();

  if (cacheFile) {
    await mkdir(join(cacheFile, '..'), { recursive: true });
    const tmp = `${cacheFile}.${process.pid}.tmp`;
    await writeFile(tmp, out);
    await rename(tmp, cacheFile);
  }
  return out;
}

/**
 * Seeded film-grain values, one per pixel (three with `monochrome: false`),
 * at `size` px per grain (upscaled smoothly). Each value is the mean of two
 * uniform draws, a triangular distribution: fewer harsh extremes than flat
 * noise, closer to film.
 *
 * @param {any} sharp - The sharp module.
 * @param {number} width @param {number} height
 * @param {import('./index.js').GrainLayer} layer
 * @param {import('./rng.js').Rng} rng - The layer's stream.
 * @returns {Promise<{ data: Buffer, channels: 1 | 3 }>} Full-size noise.
 */
async function noise(sharp, width, height, layer, rng) {
  const size = Math.max(1, layer.size ?? 1);
  const channels = layer.monochrome === false ? 3 : 1;
  const nw = Math.ceil(width / size);
  const nh = Math.ceil(height / size);
  const data = Buffer.alloc(nw * nh * channels);
  // xorshift32 seeded from the layer's stream: one 32-bit draw gives two
  // values, so 1.4M pixels cost a few milliseconds.
  let x = (rng.next() * 4294967296) >>> 0 || 1;
  for (let i = 0; i < data.length; i++) {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    data[i] = ((x & 255) + ((x >>> 8) & 255)) >>> 1;
  }
  if (nw === width && nh === height) return { data, channels };
  const out = await sharp(data, { raw: { width: nw, height: nh, channels } })
    .resize(width, height, { kernel: 'cubic', fit: 'fill' })
    .raw()
    .toBuffer();
  return { data: out, channels };
}

/** Separable blend modes (W3C Compositing Level 1), channel values 0–1. */
const BLENDS = /** @type {Record<string, (b: number, s: number) => number>} */ ({
  normal: (_b, s) => s,
  multiply: (b, s) => b * s,
  screen: (b, s) => b + s - b * s,
  overlay: (b, s) => (b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s)),
  'soft-light': (b, s) => {
    if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b);
    const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
    return b + (2 * s - 1) * (d - b);
  },
});

/**
 * A 256×256 lookup (backdrop × noise → result) for one blend and strength:
 * cheaper than the blend maths per pixel.
 *
 * @param {(b: number, s: number) => number} blend
 * @param {number} amount
 * @returns {Uint8Array}
 */
function grainTable(blend, amount) {
  const table = new Uint8Array(65536);
  for (let b = 0; b < 256; b++) {
    for (let s = 0; s < 256; s++) {
      const cb = b / 255;
      table[(b << 8) | s] = Math.round((cb + amount * (blend(cb, s / 255) - cb)) * 255);
    }
  }
  return table;
}

/**
 * Blend grain into RGBA pixels in place, at the layer's `amount`.
 * Done in JS rather than with sharp's `composite` blend modes, whose
 * overlay with a partly transparent layer flattens the noise to almost
 * nothing (measured σ 0.5 against the expected 5.9 on mid grey).
 *
 * @param {Buffer} pixels - RGBA pixels (modified).
 * @param {{ data: Buffer, channels: 1 | 3, width: number, height: number }} grain - Noise from {@link noise}, and the canvas size.
 * @param {import('./index.js').GrainLayer} layer - The grain layer.
 * @returns {void}
 */
function applyGrain(pixels, grain, layer) {
  const amount = Math.max(0, Math.min(1, (layer.amount ?? 0.08) * (layer.opacity ?? 1)));
  const blend = BLENDS[layer.blend ?? 'overlay'];
  if (!blend) throw new TypeError(`Unknown grain blend "${layer.blend}" (${Object.keys(BLENDS).join(', ')})`);
  const table = grainTable(blend, amount);
  const { data, channels } = grain;
  if (layer.vary === 'edges') {
    // Heavier toward the edges: per-pixel strength from the centre out, as in the SVG mask.
    const { width, height } = grain;
    const peak = Math.min(1, amount * VARY_PEAK);
    const tables = Array.from({ length: 17 }, (_, k) => grainTable(blend, peak * (VARY_FLOOR + (1 - VARY_FLOOR) * (k / 16))));
    const half = Math.hypot(width, height) / 2;
    for (let y = 0, i = 0, j = 0; y < height; y++) {
      for (let x = 0; x < width; x++, i += 4, j += channels) {
        const t = tables[Math.min(16, Math.round((Math.hypot(x - width / 2, y - height / 2) / half) * 16))];
        pixels[i] = t[(pixels[i] << 8) | data[j]];
        pixels[i + 1] = t[(pixels[i + 1] << 8) | data[j + (channels === 3 ? 1 : 0)]];
        pixels[i + 2] = t[(pixels[i + 2] << 8) | data[j + (channels === 3 ? 2 : 0)]];
      }
    }
    return;
  }
  for (let i = 0, j = 0; i < pixels.length; i += 4, j += channels) {
    pixels[i] = table[(pixels[i] << 8) | data[j]];
    pixels[i + 1] = table[(pixels[i + 1] << 8) | data[j + (channels === 3 ? 1 : 0)]];
    pixels[i + 2] = table[(pixels[i + 2] << 8) | data[j + (channels === 3 ? 2 : 0)]];
  }
}

/**
 * A stable cache key for a cover and its output options: a SHA-256 of the
 * resolved cover (font and image bytes hashed by content), the output
 * format and quality, and this package's version.
 *
 * @param {import('./index.js').CoverOptions | import('./index.js').Cover} input - The cover.
 * @param {import('./index.js').RenderImageOptions} [options]
 * @returns {Promise<string>} 40 hex characters.
 *
 * @example
 * await coverKey({ recipe: 'aurora', seed: 'a' }, { format: 'webp' }); // 'f3a9…'
 */
export async function coverKey(input, options = {}) {
  const c = cover(input);
  const h = createHash('sha256');
  h.update(`covers@${VERSION}\n${options.format ?? 'webp'}:${options.quality ?? ''}:${options.effort ?? ''}\n`);
  // Files a layer reads (an image's src, a mesh's photo, a waveform's audio) are hashed by content.
  const file = async (/** @type {any} */ v) => (typeof v === 'string' && !v.startsWith('data:') ? digest(await readFile(v)) : v instanceof Uint8Array ? digest(v) : v);
  const layers = await Promise.all(c.layers.map(async (l) => {
    const x = /** @type {any} */ (l);
    if (l.type === 'image') return { ...l, src: await file(x.src) };
    if (l.type === 'mesh' && x.from) return { ...l, from: await file(x.from) };
    if (l.type === 'waveform' && x.audio) return { ...l, audio: await file(x.audio) };
    return l;
  }));
  h.update(stable({
    width: c.width,
    height: c.height,
    seed: c.seed,
    palette: c.palette,
    layers,
    radius: c.radius,
    fonts: c.fonts.map((f) => ({ ...f, data: digest(f.data) })),
  }));
  return h.digest('hex').slice(0, 40);
}

/** @param {string | Uint8Array | ArrayBuffer} data @returns {string} */
function digest(data) {
  return createHash('sha1').update(data instanceof ArrayBuffer ? new Uint8Array(data) : data).digest('hex');
}

/**
 * JSON with sorted keys and bytes hashed, for hashing.
 *
 * @param {unknown} v
 * @returns {string}
 */
function stable(v) {
  if (v instanceof Uint8Array || v instanceof ArrayBuffer) return JSON.stringify(digest(v));
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().filter((k) => /** @type {any} */ (v)[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(/** @type {any} */ (v)[k])}`).join(',')}}`;
  }
  if (typeof v === 'function') return JSON.stringify(String(v));
  return JSON.stringify(v) ?? 'null';
}
