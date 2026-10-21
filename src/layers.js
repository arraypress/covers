/**
 * Layer renderers.
 *
 * Each layer type is one function from a layer (its options) and a render
 * context to SVG markup: `{ defs, body }`. Layers paint in order, bottom
 * first. Every option has a default, drawn from the palette, the canvas
 * size and the layer's own seeded random stream, so `{ type: 'mesh' }` on
 * its own is already a finished background.
 *
 * Common to every layer: `id` (names it for recipe overrides), `opacity`
 * (0–1) and `blend` (a CSS `mix-blend-mode`: `multiply`, `screen`,
 * `overlay`, `soft-light`, …).
 *
 * @module layers
 */

import { readFile } from 'node:fs/promises';
import { attrs, esc, layerAttrs, num } from './svg.js';
import { len, place, anchorAlign, unit, regionPx } from './geometry.js';
import { toHex, mixOklab, toOklch, fromOklch } from './color.js';
import { harfbuzz, loadFont, pickFont } from './fonts.js';
import { layout, runPath } from './text.js';
import { resolveIcon, parseSvgIcon } from './icons.js';
import { gridPath } from './grid.js';
import { diagram } from './diagram.js';
import { paper, scribble } from './handmade.js';
import { ink, dither, contour, waveform, tiles, rule } from './print.js';

/**
 * Everything a layer renderer needs.
 *
 * @typedef {object} RenderContext
 * @property {number} width - Canvas width in px.
 * @property {number} height - Canvas height in px.
 * @property {{ width: number, height: number }} canvas - The same, as an object.
 * @property {import('./index.js').Palette} palette - The resolved palette.
 * @property {import('./rng.js').Rng} rng - This layer's own random stream.
 * @property {string} id - A unique id prefix for this layer's defs.
 * @property {import('./index.js').FontSource[]} fonts - Available fonts (Inter last).
 * @property {any} [sharp] - The `sharp` module, when available.
 */

/** @typedef {{ defs: string, body: string, pad?: number, finest?: number }} Markup */

/**
 * Wrap a body in the layer's opacity/blend group (only when needed).
 *
 * @param {any} layer - The layer.
 * @param {string} body - Its markup.
 * @returns {string} Markup.
 */
export function wrap(layer, body) {
  const a = attrs(layerAttrs(layer));
  return a ? `<g${a}>${body}</g>` : body;
}

/**
 * Colour stops for a gradient. With `ease`, each pair of colours gets
 * intermediate stops along a smoothstep curve (mixed in OKLab), which
 * removes the hard "edge" a linear gradient shows where it starts and ends.
 *
 * @param {string[]} colors - Two or more colours.
 * @param {boolean} ease - Ease between them.
 * @param {number[]} [opacities] - Per-colour stop opacity.
 * @returns {string} `<stop>` elements.
 */
function stops(colors, ease, opacities) {
  const out = [];
  const n = colors.length - 1;
  const steps = ease ? 6 : 1;
  for (let i = 0; i <= n; i++) {
    if (i === n || !ease) {
      out.push({ o: n === 0 ? 0 : i / n, c: colors[i], a: opacities?.[i] ?? 1 });
      continue;
    }
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const e = t * t * (3 - 2 * t);
      const a0 = opacities?.[i] ?? 1;
      const a1 = opacities?.[i + 1] ?? 1;
      out.push({ o: (i + t) / n, c: mixOklab(colors[i], colors[i + 1], e), a: a0 + (a1 - a0) * e });
    }
  }
  return out.map((s) => `<stop${attrs({ offset: num(s.o, 4), 'stop-color': s.c, 'stop-opacity': s.a < 1 ? num(s.a, 3) : undefined })}/>`).join('');
}

/** @param {any} v @param {string} fallback @returns {string} */
const color = (v, fallback) => (v ? toHex(v) : fallback);

/** @param {string[] | undefined} list @param {string[]} fallback @returns {string[]} */
const colorList = (list, fallback) => (list?.length ? list.map(toHex) : fallback);

// ---------------------------------------------------------------------------
// Backgrounds
// ---------------------------------------------------------------------------

/**
 * `solid` — one flat colour.
 *
 * @param {import('./index.js').SolidLayer} layer
 * @param {RenderContext} ctx
 * @returns {Markup}
 */
export function solid(layer, ctx) {
  return { defs: '', body: wrap(layer, `<rect${attrs({ width: ctx.width, height: ctx.height, fill: color(layer.color, ctx.palette.bg) })}/>`) };
}

/**
 * `linear` — a linear gradient at a CSS angle (0° points up, 90° right).
 *
 * @param {import('./index.js').LinearLayer} layer
 * @param {RenderContext} ctx
 * @returns {Markup}
 */
export function linear(layer, ctx) {
  const p = ctx.palette;
  const colors = colorList(layer.colors, [p.colors[0], p.colors[1] ?? p.bg]);
  const angle = layer.angle ?? Math.round(ctx.rng.range(0, 360));
  const a = (angle * Math.PI) / 180;
  const { width: w, height: h } = ctx;
  const L = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
  const dx = (Math.sin(a) * L) / 2;
  const dy = (-Math.cos(a) * L) / 2;
  const id = `${ctx.id}g`;
  const defs = `<linearGradient${attrs({ id, gradientUnits: 'userSpaceOnUse', x1: w / 2 - dx, y1: h / 2 - dy, x2: w / 2 + dx, y2: h / 2 + dy })}>${stops(colors, layer.ease !== false, layer.opacities)}</linearGradient>`;
  return { defs, body: wrap(layer, `<rect${attrs({ width: w, height: h, fill: `url(#${id})` })}/>`) };
}

/**
 * `radial` — a radial gradient from a centre (fractions of the canvas).
 *
 * @param {import('./index.js').RadialLayer} layer
 * @param {RenderContext} ctx
 * @returns {Markup}
 */
export function radial(layer, ctx) {
  const p = ctx.palette;
  const colors = colorList(layer.colors, [p.colors[0], p.bg]);
  const x = (layer.x ?? ctx.rng.range(0.2, 0.8)) * ctx.width;
  const y = (layer.y ?? ctx.rng.range(0.2, 0.8)) * ctx.height;
  const r = len(layer.radius, ctx.canvas, '80vmax');
  const id = `${ctx.id}g`;
  const defs = `<radialGradient${attrs({ id, gradientUnits: 'userSpaceOnUse', cx: x, cy: y, r })}>${stops(colors, layer.ease !== false)}</radialGradient>`;
  return { defs, body: wrap(layer, `<rect${attrs({ width: ctx.width, height: ctx.height, fill: `url(#${id})` })}/>`) };
}

/**
 * `mesh` — soft blurred fields of colour: the "mesh gradient" look.
 *
 * The default `sweep` arrangement lays a few large, elongated fields along
 * one seeded direction, with centres free to sit beyond the frame, and
 * blurs them more along that direction than across it (`streak`), which is
 * how editorial gradients read: broad diagonal washes, not round spots.
 * `ring` spreads rounder blobs around the centre instead.
 *
 * Under the fields sits a gradient across the sweep between its first two
 * colours (`base: 'auto'`), so colour reaches every edge and corner and the
 * page colour never shows through as a vignette. `tone` pulls every colour into a lightness and
 * chroma band (OKLCH), keeping its hue: pastel palettes become clear
 * mid-tones, and a dark palette can't fall to black between fields.
 *
 * @param {import('./index.js').MeshLayer} layer
 * @param {RenderContext} ctx
 * @returns {Markup}
 */
export function mesh(layer, ctx) {
  const { width: w, height: h, rng, palette: p } = ctx;
  const max = Math.max(w, h);
  // A few hues read as a colour story; every hue at once reads as a rainbow.
  const pool = rng.shuffle(colorList(layer.colors, p.colors));
  let colors = pool.slice(0, Math.max(1, layer.hues ?? (layer.colors?.length ? pool.length : 3)));
  if (layer.tone) colors = colors.map((c) => toneColor(c, /** @type {any} */ (layer.tone)));
  const count = layer.blobs?.length ?? layer.count ?? 4;
  const sweep = (layer.arrangement ?? 'sweep') === 'sweep';
  const spread = layer.spread ?? (sweep ? 1 : 0.7);
  const [smin, smax] = layer.size ?? (sweep ? [0.42, 0.72] : [0.3, 0.52]);
  const blur = len(layer.blur, ctx.canvas, '11vmax');
  const streak = Math.max(0.2, layer.streak ?? (sweep ? 1.5 : 1));
  const angle = layer.angle ?? rng.range(0, 180);
  const phase = rng.range(0, Math.PI * 2);

  const blobs = [];
  for (let i = 0; i < count; i++) {
    const given = layer.blobs?.[i];
    const rx = (given?.r ?? rng.range(smin, smax)) * max;
    let cx;
    let cy;
    let squash;
    let rot;
    if (sweep) {
      // Along the sweep (u) and across it (v), in units of the longer side,
      // relative to the centre; then rotated into place by the group.
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      const u = (t * 1.15 + rng.range(-0.12, 0.12)) * spread;
      const v = rng.range(-0.32, 0.32) * spread;
      cx = u * max;
      cy = v * max;
      squash = rng.range(0.26, 0.5);
      rot = rng.range(-14, 14);
    } else {
      const ang = phase + (i / count) * Math.PI * 2 + rng.range(-0.45, 0.45);
      const dist = spread * rng.range(0.45, 0.85);
      cx = (0.5 + Math.cos(ang) * dist * 0.72) * w;
      cy = (0.5 + Math.sin(ang) * dist * 0.72) * h;
      squash = rng.range(0.55, 0.95);
      rot = rng.range(0, 180);
    }
    blobs.push({
      cx: given?.x != null ? (sweep ? (given.x - 0.5) * w : given.x * w) : cx,
      cy: given?.y != null ? (sweep ? (given.y - 0.5) * h : given.y * h) : cy,
      rx,
      ry: rx * (given?.squash ?? squash),
      rot: given?.rotate ?? rot,
      fill: given?.color ? toHex(given.color) : colors[i % colors.length],
      opacity: given?.opacity ?? 1,
    });
  }

  const id = `${ctx.id}b`;
  let defs_extra = '';
  const std = sweep ? `${num(blur * streak)} ${num(blur / streak)}` : num(blur);
  const defs = blur > 0
    ? `<filter${attrs({ id, x: '-50%', y: '-50%', width: '200%', height: '200%', 'color-interpolation-filters': 'sRGB' })}><feGaussianBlur stdDeviation="${std}"/></filter>`
    : '';
  // The base: by default a gradient across the sweep between its first two
  // colours (so the field is full-bleed and never muddy), else a flat fill.
  let base = '';
  if (layer.base !== null && layer.base !== false) {
    if (layer.base === undefined || layer.base === 'auto') {
      const reach = Math.hypot(w, h) / 2;
      const gid = `${ctx.id}g`;
      const ends = [colors[0], colors[1 % colors.length]];
      defs_extra = `<linearGradient${attrs({ id: gid, gradientUnits: 'userSpaceOnUse', x1: 0, y1: -reach, x2: 0, y2: reach })}>${stops(ends, true)}</linearGradient>`;
      base = `<g transform="translate(${num(w / 2)} ${num(h / 2)}) rotate(${num(sweep ? angle : 0)})"><rect${attrs({ x: -reach, y: -reach, width: reach * 2, height: reach * 2, fill: `url(#${gid})` })}/></g>`;
    } else {
      base = `<rect${attrs({ width: w, height: h, fill: layer.base === 'bg' ? p.bg : toHex(layer.base) })}/>`;
    }
  }
  const shapes = blobs
    .map((b) => `<ellipse${attrs({ cx: b.cx, cy: b.cy, rx: b.rx, ry: b.ry, fill: b.fill, opacity: b.opacity < 1 ? b.opacity : undefined, transform: `rotate(${num(b.rot)} ${num(b.cx)} ${num(b.cy)})` })}/>`)
    .join('');
  let field = `<g${attrs({ filter: blur > 0 ? `url(#${id})` : undefined })}>${shapes}</g>`;
  const reach = Math.hypot(w, h) / 2 + blur * 2;

  // A fold: a second field meeting the first along a soft curve, with a
  // sharper edge than the blur elsewhere and a faint sheen along it (silk).
  if (layer.fold) {
    const f = layer.fold === true ? {} : layer.fold;
    const fc = f.color ? toHex(f.color) : colors[2 % colors.length];
    const far = f.to ? toHex(f.to) : mixOklab(fc, colors[0], 0.35);
    const at = (f.position ?? rng.range(-0.15, 0.2)) * max;
    const bend = (f.bend ?? rng.range(-0.28, 0.28)) * max;
    const v = [at - bend * 0.6, at + bend, at - bend, at + bend * 0.5];
    const curve = `M${num(-reach)} ${num(v[0])}C${num(-reach / 3)} ${num(v[1])} ${num(reach / 3)} ${num(v[2])} ${num(reach)} ${num(v[3])}`;
    const fid = `${ctx.id}f`;
    const gid2 = `${ctx.id}fg`;
    const soft = blur * (f.softness ?? 0.16);
    defs_extra += `<filter${attrs({ id: fid, x: '-20%', y: '-20%', width: '140%', height: '140%' })}><feGaussianBlur stdDeviation="${num(soft * streak)} ${num(soft)}"/></filter>`
      + `<linearGradient${attrs({ id: gid2, gradientUnits: 'userSpaceOnUse', x1: 0, y1: at, x2: 0, y2: reach })}>${stops([fc, far], true)}</linearGradient>`;
    const sheen = f.sheen ?? 0.4;
    field += `<g filter="url(#${fid})"><path${attrs({ d: `${curve}V${num(reach)}H${num(-reach)}Z`, fill: `url(#${gid2})` })}/>`
      + (sheen > 0 ? `<path${attrs({ d: curve, fill: 'none', stroke: mixOklab(fc, '#ffffff', 0.55), 'stroke-width': blur * 0.5, opacity: sheen })}/>` : '')
      + '</g>';
  }

  // Streaks: thin, long, light ellipses blurred hard along the sweep (motion).
  const nStreaks = layer.streaks ?? 0;
  if (nStreaks > 0) {
    const sid = `${ctx.id}s`;
    defs_extra += `<filter${attrs({ id: sid, x: '-50%', y: '-50%', width: '200%', height: '200%' })}><feGaussianBlur stdDeviation="${num(blur * 0.7)} ${num(blur * 0.05)}"/></filter>`;
    let lines = '';
    for (let i = 0; i < nStreaks; i++) {
      const rx = rng.range(0.35, 0.8) * max;
      lines += `<ellipse${attrs({
        cx: rng.range(-0.45, 0.45) * max,
        cy: rng.range(-0.4, 0.4) * max,
        rx,
        ry: rx * rng.range(0.04, 0.11),
        fill: mixOklab(colors[i % colors.length], '#ffffff', rng.range(0, 0.3)),
        opacity: num(rng.range(0.45, 0.85), 2),
        transform: `rotate(${num(rng.range(-6, 6))})`,
      })}/>`;
    }
    field += `<g filter="url(#${sid})">${lines}</g>`;
  }

  // The sweep's group is rotated, so its (anisotropic) blur runs along the sweep.
  const placed = sweep ? `<g transform="translate(${num(w / 2)} ${num(h / 2)}) rotate(${num(angle)})">${field}</g>` : field;
  // For renderImage: librsvg clips a filter's input to the canvas, so blur
  // near an edge pulls in transparency. It renders this layer on a padded
  // canvas instead (`pad`), at a reduced scale the softest detail allows.
  const finest = Math.min(sweep ? blur / streak : blur, layer.fold ? blur * ((layer.fold === true ? undefined : layer.fold.softness) ?? 0.16) : Infinity, nStreaks > 0 ? blur * 0.05 : Infinity);
  return { defs: defs + defs_extra, body: wrap(layer, `${base}${placed}`), pad: Math.ceil(3 * blur * (sweep ? Math.max(1, streak) : 1)), finest };
}

/**
 * Pull a colour into a lightness / chroma band in OKLCH, keeping its hue.
 * Greys (chroma under 0.02) keep their chroma, since their hue means nothing.
 *
 * @param {string} c - The colour.
 * @param {{ l?: [number, number], c?: [number, number] }} band - Ranges to clamp into.
 * @returns {string} `#rrggbb`.
 */
export function toneColor(c, band) {
  const o = toOklch(c);
  const clamp = (/** @type {number} */ v, /** @type {[number, number] | undefined} */ r) => (r ? Math.min(r[1], Math.max(r[0], v)) : v);
  return fromOklch({ l: clamp(o.l, band.l), c: o.c < 0.02 ? o.c : clamp(o.c, band.c), h: o.h });
}

/**
 * `stripes` — bands of colour across a region: vertical, horizontal or at
 * an angle. Widths can be even, random, tapering (each narrower than the
 * last: the classic stripe band) or given as weights.
 *
 * @param {import('./index.js').StripesLayer} layer
 * @param {RenderContext} ctx
 * @returns {Markup}
 */
export function stripes(layer, ctx) {
  const { rng, palette: p } = ctx;
  const r = regionPx(layer.region, ctx.canvas);
  const direction = layer.direction ?? 'vertical';
  const angle = direction === 'vertical' ? 0 : direction === 'horizontal' ? 90 : layer.angle ?? 45;
  const colors = colorList(layer.colors, p.colors);
  const count = layer.count ?? (Array.isArray(layer.widths) ? layer.widths.length : 8);
  const gap = len(layer.gap, ctx.canvas, 0);
  const radius = len(layer.radius, ctx.canvas, 0);

  // Bands run along the rotated x axis; for a slant they must cover the diagonal.
  const diagonal = angle % 90 !== 0;
  const extent = diagonal ? Math.hypot(r.width, r.height) : angle === 0 ? r.width : r.height;
  const cross = diagonal ? extent : angle === 0 ? r.height : r.width;

  const mode = layer.widths ?? 'even';
  const weights = Array.from({ length: count }, (_, i) =>
    Array.isArray(mode) ? mode[i % mode.length] : mode === 'random' ? rng.range(0.35, 1.65) : mode === 'taper' ? (layer.taper ?? 0.78) ** i : 1,
  );
  const total = weights.reduce((a, b) => a + b, 0);
  const free = Math.max(0, extent - gap * (count - 1));

  let x = -extent / 2;
  const bands = weights.map((wt, i) => {
    const bw = (wt / total) * free;
    const band = `<rect${attrs({ x, y: -cross / 2, width: Math.max(0, bw), height: cross, rx: radius || undefined, fill: colors[i % colors.length] })}/>`;
    x += bw + gap;
    return band;
  });

  const id = `${ctx.id}c`;
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const defs = `<clipPath id="${id}"><rect${attrs({ x: r.x, y: r.y, width: r.width, height: r.height, rx: len(layer.regionRadius, ctx.canvas, 0) || undefined })}/></clipPath>`;
  const rot = angle === 0 ? '' : ` rotate(${num(angle)})`;
  return { defs, body: wrap(layer, `<g clip-path="url(#${id})"><g transform="translate(${num(cx)} ${num(cy)})${rot}">${bands.join('')}</g></g>`) };
}

/**
 * `image` — a local image, cover- or contain-fit into a region, with an
 * optional duotone, tint, greyscale or blur.
 *
 * With `sharp` installed the image is resized and cropped to its box
 * before embedding (smaller SVGs, and `focus: 'attention'` / `'entropy'`
 * smart crops). Without it the original bytes are embedded and fitted by
 * `preserveAspectRatio` (PNG, JPEG and SVG only, since librsvg can't decode
 * WebP or AVIF).
 *
 * @param {import('./index.js').ImageLayer} layer
 * @param {RenderContext} ctx
 * @returns {Promise<Markup>}
 */
export async function image(layer, ctx) {
  if (!layer.src) throw new TypeError('An image layer needs a src (a file path or bytes)');
  const box = regionPx(layer.region, ctx.canvas);
  const fit = layer.fit ?? 'cover';
  const focus = layer.focus ?? 'center';
  let bytes = typeof layer.src === 'string' ? await readSource(layer.src) : layer.src;
  let mime = sniff(bytes);
  let preserve = `${alignFor(focus)} ${fit === 'contain' ? 'meet' : 'slice'}`;
  let sharpBlurred = false;

  if (ctx.sharp && mime !== 'image/svg+xml') {
    const w = Math.round(box.width);
    const hgt = Math.round(box.height);
    const position = typeof focus === 'string' && ['attention', 'entropy'].includes(focus) ? focus : (POSITIONS[focus] ?? 'centre');
    let img = ctx.sharp(bytes).rotate().resize(w, hgt, { fit, position, background: { r: 0, g: 0, b: 0, alpha: 0 } });
    // Stretch the tones first, so a duotone spans both of its colours.
    if (layer.normalize ?? Boolean(layer.duotone || layer.grayscale)) img = img.normalise();
    // Blur here rather than in SVG: sharp clamps at the edges, where an SVG
    // blur (in librsvg) fades the photo to transparent.
    if (layer.blur) {
      img = img.blur(Math.max(0.3, len(layer.blur, ctx.canvas)));
      sharpBlurred = true;
    }
    const meta = await ctx.sharp(bytes).metadata();
    const alpha = meta.hasAlpha || fit === 'contain';
    bytes = await (alpha ? img.png() : img.jpeg({ quality: 90 })).toBuffer();
    mime = alpha ? 'image/png' : 'image/jpeg';
    preserve = 'none';
  } else if (!mime) {
    throw new TypeError('Unrecognised image format (use PNG, JPEG, WebP, AVIF, GIF or SVG)');
  }

  const p = ctx.palette;
  const id = `${ctx.id}f`;
  const filters = [];
  if (layer.blur && !sharpBlurred) filters.push(`<feGaussianBlur stdDeviation="${num(len(layer.blur, ctx.canvas))}" edgeMode="duplicate"/>`);
  if (layer.duotone || layer.grayscale) {
    filters.push('<feColorMatrix type="matrix" values=".2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 .2126 .7152 .0722 0 0 0 0 0 1 0"/>');
  }
  if (layer.duotone) {
    const [lo, hi] = Array.isArray(layer.duotone) ? layer.duotone.map(toHex) : defaultDuotone(p);
    const [a, b] = [lo, hi].map((c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255));
    filters.push(
      `<feComponentTransfer>${['R', 'G', 'B'].map((ch, i) => `<feFunc${ch} type="table" tableValues="${num(a[i], 4)} ${num(b[i], 4)}"/>`).join('')}</feComponentTransfer>`,
    );
  }
  const defs = filters.length
    ? `<filter${attrs({ id, x: 0, y: 0, width: '100%', height: '100%', 'color-interpolation-filters': 'sRGB' })}>${filters.join('')}</filter>`
    : '';

  let body = `<image${attrs({ x: box.x, y: box.y, width: box.width, height: box.height, preserveAspectRatio: preserve, filter: defs ? `url(#${id})` : undefined, href: `data:${mime};base64,${Buffer.from(bytes).toString('base64')}` })}/>`;
  if (layer.tint) {
    const t = typeof layer.tint === 'string' ? { color: layer.tint } : layer.tint;
    body += `<rect${attrs({ x: box.x, y: box.y, width: box.width, height: box.height, fill: color(t.color, p.accent), opacity: t.amount ?? 0.35, style: `mix-blend-mode:${t.blend ?? 'multiply'}` })}/>`;
  }
  return { defs, body: wrap(layer, body) };
}

/** Anchor name to sharp's crop `position`. */
const POSITIONS = /** @type {Record<string, string>} */ ({
  center: 'centre', top: 'top', bottom: 'bottom', left: 'left', right: 'right',
  'top-left': 'left top', 'top-right': 'right top', 'bottom-left': 'left bottom', 'bottom-right': 'right bottom',
});

/** @param {string} focus @returns {string} preserveAspectRatio alignment. */
function alignFor(focus) {
  const x = focus.includes('left') ? 'xMin' : focus.includes('right') ? 'xMax' : 'xMid';
  const y = focus.includes('top') ? 'YMin' : focus.includes('bottom') ? 'YMax' : 'YMid';
  return x + y;
}

/** @param {import('./index.js').Palette} p @returns {[string, string]} Shadow and highlight. */
function defaultDuotone(p) {
  const dark = p.mode === 'dark' ? p.bg : p.text;
  const light = p.mode === 'dark' ? p.text : p.bg;
  return [mixOklab(dark, p.accent, 0.12), mixOklab(p.accent, light, 0.2)];
}

/** @param {string} src @returns {Promise<Uint8Array>} */
async function readSource(src) {
  const data = src.match(/^data:[^;,]+;base64,(.*)$/s);
  if (data) return Buffer.from(data[1], 'base64');
  if (/^https?:/i.test(src)) throw new TypeError('Image src must be a local file or bytes: covers never fetch from the network');
  return readFile(src);
}

/**
 * Sniff an image's MIME type from its first bytes.
 *
 * @param {Uint8Array} b - Image bytes.
 * @returns {string | undefined} The MIME type.
 */
export function sniff(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49) return 'image/gif';
  const head = Buffer.from(b.subarray(0, 32)).toString('latin1');
  if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP') return 'image/webp';
  if (head.slice(4, 12) === 'ftypavif' || head.slice(4, 12) === 'ftypavis') return 'image/avif';
  if (/^\s*(<\?xml|<svg)/i.test(Buffer.from(b.subarray(0, 256)).toString('utf8'))) return 'image/svg+xml';
  return undefined;
}

// ---------------------------------------------------------------------------
// Texture
// ---------------------------------------------------------------------------

/**
 * `grain` — film grain. In SVG output it's `feTurbulence` (tiny, and
 * browsers render it fast). {@link import('./render.js').renderImage}
 * swaps it for seeded pixel noise composited by sharp, since librsvg's
 * turbulence costs ~200ms at 1200×1200 against ~10ms for the noise.
 *
 * @param {import('./index.js').GrainLayer} layer
 * @param {RenderContext} ctx
 * @returns {Markup}
 */
export function grain(layer, ctx) {
  const amount = layer.amount ?? 0.08;
  const size = layer.size ?? 1;
  const id = `${ctx.id}n`;
  const seed = ctx.rng.int(1, 9999);
  const gray = layer.monochrome === false ? '' : '<feColorMatrix type="saturate" values="0"/>';
  // Stretch the turbulence's narrow range to the full 0–1 and make it opaque.
  const contrast = '<feComponentTransfer><feFuncR type="linear" slope="2.2" intercept="-0.6"/><feFuncG type="linear" slope="2.2" intercept="-0.6"/><feFuncB type="linear" slope="2.2" intercept="-0.6"/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer>';
  const defs = `<filter${attrs({ id, x: 0, y: 0, width: '100%', height: '100%', filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' })}><feTurbulence${attrs({ type: 'fractalNoise', baseFrequency: num(0.9 / size, 3), numOctaves: 2, seed, stitchTiles: 'stitch' })}/>${gray}${contrast}</filter>`;
  let mask;
  let maskDefs = '';
  if (layer.vary === 'edges') {
    // Heavier toward the edges and corners, like spray paint.
    const mid = `${ctx.id}nm`;
    maskDefs = `<radialGradient${attrs({ id: `${mid}g`, gradientUnits: 'userSpaceOnUse', cx: ctx.width / 2, cy: ctx.height / 2, r: Math.hypot(ctx.width, ctx.height) / 2 })}><stop offset="0" stop-color="#fff" stop-opacity="${num(VARY_FLOOR, 3)}"/><stop offset="1" stop-color="#fff"/></radialGradient>`
      + `<mask${attrs({ id: mid, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: ctx.width, height: ctx.height })}><rect${attrs({ width: ctx.width, height: ctx.height, fill: `url(#${mid}g)` })}/></mask>`;
    mask = `url(#${mid})`;
  }
  const body = `<rect${attrs({ width: ctx.width, height: ctx.height, filter: `url(#${id})`, opacity: Math.min(1, amount * (layer.vary === 'edges' ? VARY_PEAK : 1)), mask, style: `mix-blend-mode:${layer.blend ?? 'overlay'}` })}/>`;
  return { defs: defs + maskDefs, body: layer.opacity != null && layer.opacity < 1 ? `<g opacity="${num(layer.opacity)}">${body}</g>` : body };
}

/** `grain.vary: 'edges'`: the centre's share of the edge strength, and the edge's multiple of `amount`. */
export const VARY_FLOOR = 0.35;
export const VARY_PEAK = 1.8;

/**
 * `pattern` — a line texture: `grid`, `dots`, `lines`, `rings` or `waves`,
 * optionally faded out toward the edges with a mask.
 *
 * Grid lines are drawn as paths across the canvas (not an SVG
 * `<pattern>`, which clips a line on a tile edge to half its width) and
 * centred, so the canvas's middle lands on a line.
 *
 * @param {import('./index.js').PatternLayer} layer
 * @param {RenderContext} ctx
 * @returns {Markup}
 */
export function pattern(layer, ctx) {
  const { width: w, height: h, palette: p } = ctx;
  const kind = layer.kind ?? 'grid';
  const size = Math.max(2, len(layer.size, ctx.canvas, kind === 'dots' ? '3.2vmin' : kind === 'rings' ? '7vmin' : '8.33vmin'));
  const stroke = len(layer.stroke, ctx.canvas, kind === 'dots' ? '0.22vmin' : '0.1vmin');
  const col = color(layer.color, p.text);
  const dash = layer.dash === 'dotted' ? `0 ${num(stroke * 4)}` : layer.dash === 'dashed' || layer.dash === true ? `${num(stroke * 4)} ${num(stroke * 5)}`
    : Array.isArray(layer.dash) ? layer.dash.map((d) => num(len(d, ctx.canvas))).join(' ') : undefined;
  const dashAttrs = dash ? { 'stroke-dasharray': dash, 'stroke-linecap': layer.dash === 'dotted' ? 'round' : undefined } : {};
  const cx = (layer.center?.x ?? 0.5) * w;
  const cy = (layer.center?.y ?? 0.5) * h;
  let shapes = '';
  let defs = '';

  if (kind === 'grid' || kind === 'lines') {
    const angle = kind === 'lines' ? layer.angle ?? 0 : 0;
    const d = [];
    if (angle === 0) {
      // Rows and columns: every `size` from the centre, or `divisions` equal
      // cells (inner lines only); broken wherever they cross a `gaps` region.
      const n = layer.divisions;
      const ys = n ? Array.from({ length: n - 1 }, (_, k) => ((k + 1) * h) / n) : range(cy % size, h, size);
      const xs = kind !== 'grid' ? [] : n ? Array.from({ length: n - 1 }, (_, k) => ((k + 1) * w) / n) : range(cx % size, w, size);
      const gaps = (layer.gaps ?? []).map((g) => regionPx(g, ctx.canvas));
      d.push(gridPath(xs, ys, w, h, gaps));
      shapes = `<path${attrs({ d: d.join(''), fill: 'none', stroke: col, 'stroke-width': stroke, ...dashAttrs })}/>`;
    } else {
      const reach = Math.hypot(w, h) / 2;
      for (let y = -Math.ceil(reach / size) * size; y <= reach; y += size) d.push(`M${num(-reach)} ${num(y)}H${num(reach)}`);
      shapes = `<path${attrs({ d: d.join(''), fill: 'none', stroke: col, 'stroke-width': stroke, ...dashAttrs, transform: `translate(${num(cx)} ${num(cy)}) rotate(${num(angle)})` })}/>`;
    }
  } else if (kind === 'dots') {
    const id = `${ctx.id}p`;
    defs += `<pattern${attrs({ id, patternUnits: 'userSpaceOnUse', x: cx % size - size / 2, y: cy % size - size / 2, width: size, height: size })}><circle${attrs({ cx: size / 2, cy: size / 2, r: stroke, fill: col })}/></pattern>`;
    shapes = `<rect${attrs({ width: w, height: h, fill: `url(#${id})` })}/>`;
  } else if (kind === 'rings') {
    const reach = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));
    for (let r = size; r <= reach; r += size) shapes += `<circle${attrs({ cx, cy, r })}/>`;
    shapes = `<g${attrs({ fill: 'none', stroke: col, 'stroke-width': stroke, ...dashAttrs })}>${shapes}</g>`;
  } else if (kind === 'waves') {
    const wavelength = len(layer.wavelength, ctx.canvas, size * 3.2);
    const amp = len(layer.amplitude, ctx.canvas, size * 0.22);
    const phase = ctx.rng.range(0, Math.PI * 2);
    const step = wavelength / 24;
    const d = [];
    for (let y = cy % size; y <= h + amp; y += size) {
      const shift = phase + y * 0.004;
      let line = '';
      for (let x = 0; x <= w + step; x += step) {
        line += `${x === 0 ? 'M' : 'L'}${num(x)} ${num(y + Math.sin((x / wavelength) * Math.PI * 2 + shift) * amp)}`;
      }
      d.push(line);
    }
    shapes = `<path${attrs({ d: d.join(''), fill: 'none', stroke: col, 'stroke-width': stroke, 'stroke-linecap': 'round', ...dashAttrs })}/>`;
  } else {
    throw new TypeError(`Unknown pattern kind "${kind}" (grid, dots, lines, rings, waves)`);
  }

  const fade = fadeMask(layer.fade ?? 'none', ctx, cx, cy);
  defs += fade.defs;
  let body = `<g${attrs({ opacity: layer.opacity ?? 0.14, mask: fade.ref })}>${shapes}</g>`;
  if (layer.region) {
    const r = regionPx(layer.region, ctx.canvas);
    defs += `<clipPath id="${ctx.id}r"><rect${attrs(r)}/></clipPath>`;
    body = `<g clip-path="url(#${ctx.id}r)">${body}</g>`;
  }
  return { defs, body: layer.blend ? `<g style="mix-blend-mode:${esc(layer.blend)}">${body}</g>` : body };
}

/**
 * `[from, from + step, …]` up to `to`.
 *
 * @param {number} from @param {number} to @param {number} step
 * @returns {number[]}
 */
function range(from, to, step) {
  const out = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
}

/**
 * A luminance mask that fades a layer: `'radial'` (strong in the middle),
 * `'edges'` (a softer vignette), or toward a side (`'top'` fades out toward
 * the top, etc.).
 *
 * @param {string} fade - The fade.
 * @param {RenderContext} ctx
 * @param {number} cx - Centre x for radial fades.
 * @param {number} cy - Centre y for radial fades.
 * @returns {{ defs: string, ref: string | undefined }} Mask defs and its `url()`.
 */
function fadeMask(fade, ctx, cx, cy) {
  if (!fade || fade === 'none') return { defs: '', ref: undefined };
  const { width: w, height: h } = ctx;
  const id = `${ctx.id}m`;
  const gid = `${ctx.id}mg`;
  let grad;
  if (fade === 'radial' || fade === 'edges') {
    const r = fade === 'radial' ? Math.max(w, h) * 0.62 : Math.hypot(w, h) * 0.6;
    const inner = fade === 'radial' ? 0.05 : 0.45;
    grad = `<radialGradient${attrs({ id: gid, gradientUnits: 'userSpaceOnUse', cx, cy, r })}><stop offset="${inner}" stop-color="#fff"/><stop offset="0.55" stop-color="#fff" stop-opacity="0.6"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
  } else {
    const to = { top: [0, 1, 0, 0], bottom: [0, 0, 0, 1], left: [1, 0, 0, 0], right: [0, 0, 1, 0] }[fade];
    if (!to) throw new TypeError(`Unknown fade "${fade}" (none, radial, edges, top, bottom, left, right)`);
    grad = `<linearGradient${attrs({ id: gid, x1: to[0], y1: to[1], x2: to[2], y2: to[3] })}><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
  }
  return {
    defs: `${grad}<mask${attrs({ id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: w, height: h })}><rect${attrs({ width: w, height: h, fill: `url(#${gid})` })}/></mask>`,
    ref: `url(#${id})`,
  };
}

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------

/**
 * `shapes` — circles, squares and pills, scattered (without overlapping
 * where they can help it), in a row, or placed one by one with `items`.
 *
 * @param {import('./index.js').ShapesLayer} layer
 * @param {RenderContext} ctx
 * @returns {Markup}
 */
export function shapes(layer, ctx) {
  const { rng, palette: p } = ctx;
  const r = regionPx(layer.region, ctx.canvas);
  const colors = colorList(layer.colors, p.colors);
  const [smin, smax] = (layer.size ?? ['7vmin', '20vmin']).map((v) => len(v, ctx.canvas));
  const kinds = layer.kind === 'mixed' || !layer.kind ? (layer.kind === 'mixed' ? ['circle', 'square', 'pill'] : ['circle']) : [layer.kind];
  const outline = layer.outline ? len(layer.outline === true ? '0.35vmin' : layer.outline, ctx.canvas) : 0;

  /** @type {{ kind: string, x: number, y: number, size: number, color: string, rotate: number, opacity: number }[]} */
  let items;
  if (layer.items?.length) {
    items = layer.items.map((it, i) => ({
      kind: it.kind ?? kinds[i % kinds.length],
      x: r.x + (it.x ?? 0.5) * r.width,
      y: r.y + (it.y ?? 0.5) * r.height,
      size: len(it.size, ctx.canvas, smax),
      color: it.color ? toHex(it.color) : colors[i % colors.length],
      rotate: it.rotate ?? 0,
      opacity: it.opacity ?? 1,
    }));
  } else {
    const count = layer.count ?? 6;
    const placement = layer.placement ?? 'scatter';
    items = [];
    for (let i = 0; i < count; i++) {
      const size = placement === 'scatter' ? rng.range(smin, smax) : smax;
      let x = r.x + r.width / 2;
      let y = r.y + r.height / 2;
      if (placement === 'row') {
        x = r.x + ((i + 0.5) / count) * r.width;
      } else if (placement === 'column') {
        y = r.y + ((i + 0.5) / count) * r.height;
      } else {
        // Best of a few candidates: the one furthest from everything placed.
        let best = -Infinity;
        for (let t = 0; t < 24; t++) {
          const cxp = r.x + size / 2 + rng.next() * Math.max(0, r.width - size);
          const cyp = r.y + size / 2 + rng.next() * Math.max(0, r.height - size);
          const gap = items.reduce((m, o) => Math.min(m, Math.hypot(o.x - cxp, o.y - cyp) - (o.size + size) / 2), Infinity);
          if (gap > best) { best = gap; x = cxp; y = cyp; }
        }
      }
      const kind = kinds[placement === 'scatter' ? rng.int(0, kinds.length - 1) : i % kinds.length];
      items.push({
        kind,
        x,
        y,
        size,
        color: colors[i % colors.length],
        rotate: layer.rotate === false || kind === 'circle' ? 0 : placement === 'scatter' ? rng.range(-35, 35) : 0,
        opacity: 1,
      });
    }
  }

  const radius = layer.radius ?? 0.22;
  const body = items
    .map((it) => {
      const paint = outline ? { fill: 'none', stroke: it.color, 'stroke-width': outline } : { fill: it.color };
      const op = it.opacity < 1 ? it.opacity : undefined;
      if (it.kind === 'circle') return `<circle${attrs({ cx: it.x, cy: it.y, r: it.size / 2, ...paint, opacity: op })}/>`;
      const wd = it.kind === 'pill' ? it.size * 2.2 : it.size;
      const ht = it.size;
      const rx = it.kind === 'pill' ? ht / 2 : ht * radius;
      return `<rect${attrs({ x: it.x - wd / 2, y: it.y - ht / 2, width: wd, height: ht, rx, ...paint, opacity: op, transform: it.rotate ? `rotate(${num(it.rotate)} ${num(it.x)} ${num(it.y)})` : undefined })}/>`;
    })
    .join('');
  return { defs: '', body: wrap(layer, body) };
}

/**
 * `icon` — an Iconify icon by name (`'lucide:feather'`), a raw SVG string or
 * a path, optionally on a rounded tile with a soft shadow.
 *
 * @param {import('./index.js').IconLayer} layer
 * @param {RenderContext} ctx
 * @returns {Markup}
 */
export function icon(layer, ctx) {
  const p = ctx.palette;
  // A name that is markup is a raw SVG (so one `icon` option can carry either).
  const name = typeof layer.name === 'string' ? layer.name.trim() : undefined;
  const svg = layer.svg ?? (name?.startsWith('<') ? name : undefined);
  const data = svg
    ? parseSvgIcon(svg)
    : name
      ? resolveIcon(name)
      : layer.path
        ? { body: `<path fill="currentColor" d="${esc(layer.path)}"/>`, viewBox: /** @type {[number, number, number, number]} */ (layer.viewBox ?? [0, 0, 24, 24]) }
        : null;
  if (!data) throw new TypeError('An icon layer needs a name, svg or path');

  const tileOpts = layer.tile === true ? {} : layer.tile || null;
  const size = len(layer.size, ctx.canvas, tileOpts ? '15vmin' : '24vmin');
  const tileSize = tileOpts ? len(tileOpts.size, ctx.canvas, size / 0.5) : size;
  const margin = len(layer.margin, ctx.canvas, unit(ctx.canvas) * 0.07);
  const at = place({ width: tileSize, height: tileSize, canvas: ctx.canvas, anchor: layer.anchor ?? 'center', margin, position: layer.position, offset: layer.offset });

  let defs = '';
  let body = '';
  if (tileOpts) {
    const radius = len(tileOpts.radius, ctx.canvas, tileSize * 0.24);
    const fill = color(tileOpts.color, p.surface);
    const shadow = tileOpts.shadow ?? 'soft';
    const fid = `${ctx.id}s`;
    if (shadow === 'soft') {
      const strength = p.mode === 'dark' ? 2.2 : 1;
      defs += `<filter${attrs({ id: fid, x: '-60%', y: '-60%', width: '220%', height: '220%', 'color-interpolation-filters': 'sRGB' })}>`
        + shadowPass('a', tileSize * 0.12, tileSize * 0.08, 0.12 * strength)
        + shadowPass('b', tileSize * 0.015, tileSize * 0.012, 0.08 * strength)
        + '<feMerge><feMergeNode in="a"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
    }
    const border = tileOpts.border === false ? null : tileOpts.border ?? (p.mode === 'dark' ? mixOklab(fill, p.text, 0.12) : mixOklab(fill, p.text, 0.08));
    body += `<rect${attrs({ x: at.x, y: at.y, width: tileSize, height: tileSize, rx: radius, fill, filter: shadow === 'soft' ? `url(#${fid})` : undefined })}/>`;
    if (border) body += `<rect${attrs({ x: at.x + 0.5, y: at.y + 0.5, width: tileSize - 1, height: tileSize - 1, rx: Math.max(0, radius - 0.5), fill: 'none', stroke: toHex(border), 'stroke-width': 1 })}/>`;
  }

  const [vx, vy, vw, vh] = data.viewBox;
  const fitScale = Math.min(size / vw, size / vh);
  const iw = vw * fitScale;
  const ih = vh * fitScale;
  let inner = data.body;
  if (layer.strokeWidth != null) inner = inner.replace(/stroke-width="[^"]*"/g, `stroke-width="${num(layer.strokeWidth)}"`);
  body += `<svg${attrs({
    x: at.x + (tileSize - iw) / 2,
    y: at.y + (tileSize - ih) / 2,
    width: iw,
    height: ih,
    viewBox: `${num(vx)} ${num(vy)} ${num(vw)} ${num(vh)}`,
    overflow: 'visible',
    color: color(layer.color, tileOpts ? p.accent : p.text),
  })}>${inner}</svg>`;
  return { defs, body: wrap(layer, body) };
}

/**
 * One drop-shadow pass for a filter (blurred alpha, offset down, tinted).
 *
 * @param {string} name - Result name.
 * @param {number} blur - Blur std deviation.
 * @param {number} dy - Downward offset.
 * @param {number} opacity - Shadow opacity.
 * @returns {string} Filter primitives.
 */
function shadowPass(name, blur, dy, opacity) {
  return `<feGaussianBlur in="SourceAlpha" stdDeviation="${num(blur)}"/><feOffset dy="${num(dy)}" result="${name}o"/>`
    + `<feFlood flood-color="#000" flood-opacity="${num(Math.min(1, opacity), 3)}"/><feComposite in2="${name}o" operator="in" result="${name}"/>`;
}

/**
 * `text` — type set as outlines: wrapped, balanced, truncated with an
 * ellipsis past `maxLines`, optionally shrunk to fit (`minSize`), with an
 * optional label above and a pill or box behind.
 *
 * @param {import('./index.js').TextLayer} layer
 * @param {RenderContext} ctx
 * @returns {Promise<Markup>}
 */
export async function text(layer, ctx) {
  // An override object in `content` (a recipe's "{title}") means its content.
  const raw = layer.content && typeof layer.content === 'object' ? /** @type {any} */ (layer.content).content : layer.content;
  const content = transform(String(raw ?? ''), layer.transform);
  if (!content.trim()) return { defs: '', body: '' };
  const hb = await harfbuzz();
  const p = ctx.palette;
  const u = unit(ctx.canvas);
  const margin = len(layer.margin, ctx.canvas, u * 0.07);
  const anchor = layer.anchor ?? 'bottom-left';
  const align = layer.align ?? anchorAlign(anchor);
  const bg = layer.background ? (typeof layer.background === 'string' ? { color: layer.background } : layer.background) : null;
  const pad = bg ? padding(bg.padding, ctx.canvas, len(layer.size, ctx.canvas, u * 0.06)) : [0, 0];
  const maxWidth = len(layer.maxWidth, ctx.canvas, ctx.width - 2 * margin) - 2 * pad[1];

  const face = await loadFont(pickFont(ctx.fonts, layer.font ?? 'Inter', layer.weight ?? 600, layer.style));
  const set = layout({
    face, hb,
    text: content,
    size: len(layer.size, ctx.canvas, u * 0.06),
    minSize: layer.minSize != null ? len(layer.minSize, ctx.canvas) : undefined,
    letterSpacing: layer.letterSpacing ?? -0.02,
    maxWidth,
    maxLines: layer.maxLines ?? 3,
    ellipsis: layer.ellipsis,
    balance: layer.balance ?? true,
  });
  const lh = set.size * (layer.lineHeight ?? 1.12);
  const cap = (face.capHeight / face.upem) * set.size;
  const titleH = cap + (set.lines.length - 1) * lh;

  // The label sits above, in its own face and size.
  let labelOpts = layer.label ? (typeof layer.label === 'string' ? { content: layer.label } : layer.label) : null;
  // A label whose content is itself an options object: its fields win.
  if (labelOpts && labelOpts.content && typeof labelOpts.content === 'object') {
    labelOpts = { ...labelOpts, ...labelOpts.content };
    if (typeof labelOpts.content === 'object') labelOpts.content = undefined;
  }
  let label = null;
  if (labelOpts?.content) {
    const lface = await loadFont(pickFont(ctx.fonts, labelOpts.font ?? layer.font ?? 'Inter', labelOpts.weight ?? 500, labelOpts.style));
    const lsize = len(labelOpts.size, ctx.canvas, Math.max(12, set.size * 0.32, u * 0.02));
    const lset = layout({
      face: lface, hb,
      text: transform(labelOpts.content, labelOpts.transform ?? 'uppercase'),
      size: lsize,
      letterSpacing: labelOpts.letterSpacing ?? 0.08,
      maxWidth,
      maxLines: labelOpts.maxLines ?? 1,
    });
    const llh = lsize * (labelOpts.lineHeight ?? 1.3);
    const lcap = (lface.capHeight / lface.upem) * lsize;
    label = { face: lface, set: lset, lh: llh, cap: lcap, height: lcap + (lset.lines.length - 1) * llh, gap: len(labelOpts.gap, ctx.canvas, Math.max(lsize * 1.4, set.size * 0.42)), color: color(labelOpts.color, p.muted) };
  }

  const blockW = Math.max(set.width, label?.set.width ?? 0);
  const blockH = titleH + (label ? label.height + label.gap : 0);
  const boxW = blockW + 2 * pad[1];
  const boxH = blockH + 2 * pad[0];
  const at = place({ width: boxW, height: boxH, canvas: ctx.canvas, anchor, margin, position: layer.position, offset: layer.offset });
  const left = at.x + pad[1];
  const top = at.y + pad[0];

  /** @param {number} w @returns {number} */
  const lineX = (w) => (align === 'center' ? left + (blockW - w) / 2 : align === 'right' ? left + blockW - w : left);

  let body = '';
  if (bg) {
    const r = bg.radius != null ? len(bg.radius, ctx.canvas) : Math.min(boxH, boxW) / 2;
    body += `<rect${attrs({ x: at.x, y: at.y, width: boxW, height: boxH, rx: r, fill: color(bg.color, p.surface), opacity: bg.opacity })}/>`;
  }
  let y = top;
  if (label) {
    const d = label.set.lines.map((l, i) => runPath(label.face, l.run, label.set.size, lineX(l.run.width), y + label.cap + i * label.lh)).join('');
    body += `<path${attrs({ d, fill: label.color })}/>`;
    y += label.height + label.gap;
  }
  const d = set.lines.map((l, i) => runPath(face, l.run, set.size, lineX(l.run.width), y + cap + i * lh)).join('');
  body += `<path${attrs({ d, fill: color(layer.color, p.text) })}/>`;
  return { defs: '', body: wrap(layer, body) };
}

/** @param {string} s @param {string | undefined} t @returns {string} */
function transform(s, t) {
  const clean = s.replace(/[\t\r ]+/g, ' ').replace(/ *\n */g, '\n').trim();
  return t === 'uppercase' ? clean.toUpperCase() : t === 'lowercase' ? clean.toLowerCase() : clean;
}

/**
 * Padding as `[vertical, horizontal]` pixels.
 *
 * @param {import('./index.js').Length | [import('./index.js').Length, import('./index.js').Length] | undefined} v
 * @param {{ width: number, height: number }} canvas
 * @param {number} size - The text size, for the default.
 * @returns {[number, number]}
 */
function padding(v, canvas, size) {
  if (Array.isArray(v)) return [len(v[0], canvas), len(v[1], canvas)];
  if (v != null) return [len(v, canvas), len(v, canvas)];
  return [size * 0.5, size * 0.75];
}

/**
 * `frame` — an inset border (and optional fill), like a mount or a card.
 *
 * @param {import('./index.js').FrameLayer} layer
 * @param {RenderContext} ctx
 * @returns {Markup}
 */
export function frame(layer, ctx) {
  const inset = len(layer.inset, ctx.canvas, '3.5vmin');
  const stroke = len(layer.stroke, ctx.canvas, '0.15vmin');
  const half = layer.fill ? 0 : stroke / 2;
  const body = `<rect${attrs({
    x: inset + half,
    y: inset + half,
    width: Math.max(0, ctx.width - 2 * (inset + half)),
    height: Math.max(0, ctx.height - 2 * (inset + half)),
    rx: len(layer.radius, ctx.canvas, '2vmin'),
    fill: layer.fill ? toHex(layer.fill) : 'none',
    stroke: stroke > 0 ? color(layer.color, ctx.palette.text) : undefined,
    'stroke-width': stroke > 0 ? stroke : undefined,
  })}/>`;
  return { defs: '', body: wrap({ ...layer, opacity: layer.opacity ?? (layer.fill ? 1 : 0.22) }, body) };
}

/** Every layer type, by name. */
export const LAYERS = Object.freeze({ solid, linear, radial, mesh, stripes, image, grain, pattern, shapes, icon, text, frame, diagram, paper, scribble, ink, dither, contour, waveform, tiles, rule });
