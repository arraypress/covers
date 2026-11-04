/**
 * `mask` on any effect: where it applies, from none (0) to full (1).
 *
 * - `{ gradient: 'linear', from: [x, y], to: [x, y] }`: none at `from`,
 *   full at `to` (fractions of the canvas).
 * - `{ gradient: 'radial', center, from, to, aspect }`: none inside the
 *   radius `from`, full beyond `to` (lengths): a sharp face, the rest
 *   blurred.
 * - `{ gradient: 'band', center, angle, from, to }`: none within `from` of
 *   a line through `center` at `angle`, full beyond `to` (tilt-shift).
 * - `{ layers: [...] }`: the luminance of layers drawn (white: full).
 *
 * Every form takes `invert` and `ease` (a smooth step, default true).
 * The result is an exact mix of the layer before and after the effect:
 * inside the filter for filter effects (the mask is a small greyscale
 * image), per pixel for pixel effects. A layer mask that can't be drawn
 * (a Worker) draws the effect over the layer through an SVG mask.
 *
 * @module effects/mask
 */

import { attrs, num } from '../svg.js';
import { len } from '../geometry.js';
import { encodePng, pngUri } from '../png.js';
import { pixelsOf } from '../raster/index.js';
import { fraction, clamp01 } from './buffer.js';

/** The gradient forms. */
export const MASK_GRADIENTS = Object.freeze(['linear', 'radial', 'band']);

/** Where a resolved layer mask is kept on an effect (markup, and a raster where one could be drawn). */
export const RESOLVED = Symbol('covers.mask');

/** Longest side of a gradient mask image, px (it scales smoothly). */
const GRADIENT_PX = 256;

/** Longest side of a layer mask image, px. */
const LAYER_PX = 1024;

/**
 * Check a mask, throwing a readable error.
 *
 * @param {any} spec
 * @param {string} [where='mask']
 * @returns {void}
 * @throws {TypeError}
 */
export function checkMask(spec, where = 'mask') {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) throw new TypeError(`${where}: a mask is { gradient: 'linear' | 'radial' | 'band', … } or { layers: [...] }`);
  const known = ['gradient', 'from', 'to', 'center', 'angle', 'aspect', 'invert', 'ease', 'layers'];
  for (const k of Object.keys(spec)) if (!known.includes(k)) throw new TypeError(`${where}.${k}: unknown mask option (${known.join(', ')})`);
  if (spec.layers != null) {
    if (!Array.isArray(spec.layers)) throw new TypeError(`${where}.layers: an array of layers`);
    return;
  }
  if (!MASK_GRADIENTS.includes(spec.gradient)) throw new TypeError(`${where}.gradient: "${spec.gradient}" (${MASK_GRADIENTS.join(', ')}), or give layers`);
}

/**
 * A gradient mask as a function of a point in the layer's units.
 *
 * @param {import('./mask.js').EffectMask} spec
 * @param {{ width: number, height: number, canvas: { width: number, height: number } }} ctx
 * @returns {(x: number, y: number) => number} 0–1.
 */
export function maskField(spec, ctx) {
  checkMask(spec);
  const W = ctx.width;
  const H = ctx.height;
  const ease = spec.ease !== false;
  const inv = Boolean(spec.invert);
  const out = (/** @type {number} */ t) => {
    let v = clamp01(t);
    if (ease) v = v * v * (3 - 2 * v);
    return inv ? 1 - v : v;
  };
  if (spec.gradient === 'linear') {
    const [fx, fy] = fraction(/** @type {any} */ (spec.from), [0, 0.5]);
    const [tx, ty] = fraction(/** @type {any} */ (spec.to), [1, 0.5]);
    const x0 = fx * W;
    const y0 = fy * H;
    const dx = tx * W - x0;
    const dy = ty * H - y0;
    const k = 1 / (dx * dx + dy * dy || 1);
    return (x, y) => out(((x - x0) * dx + (y - y0) * dy) * k);
  }
  const [cx, cy] = fraction(/** @type {any} */ (spec.center), [0.5, 0.5]);
  const ox = cx * W;
  const oy = cy * H;
  const isBand = spec.gradient === 'band';
  const r0 = len(/** @type {any} */ (spec.from), ctx.canvas, isBand ? '8vmin' : '12vmin');
  const r1 = Math.max(r0 + 1e-6, len(/** @type {any} */ (spec.to), ctx.canvas, isBand ? '30vmin' : '48vmin'));
  const k = 1 / (r1 - r0);
  if (isBand) {
    const a = ((spec.angle ?? 0) * Math.PI) / 180;
    const nx = -Math.sin(a);
    const ny = Math.cos(a);
    return (x, y) => out((Math.abs((x - ox) * nx + (y - oy) * ny) - r0) * k);
  }
  const ar = 1 / (spec.aspect ?? 1);
  return (x, y) => {
    const dx = x - ox;
    const dy = (y - oy) * ar;
    return out((Math.sqrt(dx * dx + dy * dy) - r0) * k);
  };
}

/**
 * A mask sampled on a grid over a box of the layer, as greyscale bytes.
 *
 * @param {import('./mask.js').EffectMask} spec
 * @param {any} ctx - The layer's render context.
 * @param {{ x: number, y: number, width: number, height: number }} box - Layer units.
 * @param {number} cols
 * @param {number} rows
 * @param {number} [angle=0] - The grid is in a frame turned by this many degrees about the canvas centre (a `motion` blur's).
 * @returns {Promise<Uint8Array | undefined>} Undefined when a layer mask can't be drawn here.
 */
export async function maskGrid(spec, ctx, box, cols, rows, angle = 0) {
  const resolved = /** @type {any} */ (spec)[RESOLVED];
  if (spec.layers) return resolved ? drawnMask(resolved, spec, ctx, box, cols, rows, angle) : undefined;
  return gradientGrid(spec, ctx, box, cols, rows, angle);
}

/**
 * A gradient mask on a grid (synchronous).
 *
 * @param {import('./mask.js').EffectMask} spec
 * @param {any} ctx
 * @param {{ x: number, y: number, width: number, height: number }} box
 * @param {number} cols
 * @param {number} rows
 * @param {number} [angle=0]
 * @returns {Uint8Array}
 */
export function gradientGrid(spec, ctx, box, cols, rows, angle = 0) {
  const f = maskField(spec, ctx);
  const out = new Uint8Array(cols * rows);
  const a = (angle * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const cx = ctx.width / 2;
  const cy = ctx.height / 2;
  const sx = box.width / cols;
  const sy = box.height / rows;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      let x = box.x + (i + 0.5) * sx;
      let y = box.y + (j + 0.5) * sy;
      if (a) {
        const dx = x - cx;
        const dy = y - cy;
        x = cx + dx * cos - dy * sin;
        y = cy + dx * sin + dy * cos;
      }
      out[j * cols + i] = Math.round(f(x, y) * 255);
    }
  }
  return out;
}

/**
 * Layers drawn as a mask: luminance times alpha, on a grid over a box.
 *
 * @param {{ defs: string, body: string }} m - The mask layers' markup.
 * @param {import('./mask.js').EffectMask} spec
 * @param {any} ctx
 * @param {{ x: number, y: number, width: number, height: number }} box
 * @param {number} cols
 * @param {number} rows
 * @param {number} angle
 * @returns {Promise<Uint8Array | undefined>}
 */
async function drawnMask(m, spec, ctx, box, cols, rows, angle) {
  const turn = angle ? `<g transform="rotate(${num(-angle)} ${num(ctx.width / 2)} ${num(ctx.height / 2)})">${m.body}</g>` : m.body;
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols}" height="${rows}" viewBox="${num(box.x, 4)} ${num(box.y, 4)} ${num(box.width, 4)} ${num(box.height, 4)}" preserveAspectRatio="none">${m.defs ? `<defs>${m.defs}</defs>` : ''}${turn}</svg>`;
  let px;
  try {
    px = await pixelsOf(doc, cols, rows, ctx.sharp);
  } catch {
    px = undefined;
  }
  if (!px) return undefined;
  const out = new Uint8Array(cols * rows);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) {
    const v = ((0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) * px[i + 3]) / 255;
    out[j] = spec.invert ? 255 - v : v;
  }
  return out;
}

/**
 * The mask as an image for a filter: a small greyscale PNG over the
 * filter's region (a gradient scales up smoothly), or undefined where a
 * layer mask can't be drawn.
 *
 * @param {import('./mask.js').EffectMask} spec
 * @param {any} ctx
 * @param {number} pad - The filter's padding, a fraction of the canvas.
 * @param {number} [angle=0]
 * @returns {Promise<{ href: string, x: number, y: number, width: number, height: number } | undefined>}
 */
export async function maskImage(spec, ctx, pad, angle = 0) {
  const box = { x: -ctx.width * pad, y: -ctx.height * pad, width: ctx.width * (1 + 2 * pad), height: ctx.height * (1 + 2 * pad) };
  const side = spec.layers ? LAYER_PX : GRADIENT_PX;
  const k = side / Math.max(box.width, box.height);
  const cols = Math.max(2, Math.round(box.width * k));
  const rows = Math.max(2, Math.round(box.height * k));
  const grid = await maskGrid(spec, ctx, box, cols, rows, angle);
  if (!grid) return undefined;
  return { href: pngUri(encodePng(grid, cols, rows, 1)), ...box };
}

/**
 * The same, synchronously, for a gradient.
 *
 * @param {import('./mask.js').EffectMask} spec
 * @param {any} ctx
 * @param {number} pad
 * @param {number} [angle=0]
 * @returns {{ href: string, x: number, y: number, width: number, height: number }}
 */
export function gradientImage(spec, ctx, pad, angle = 0) {
  const box = { x: -ctx.width * pad, y: -ctx.height * pad, width: ctx.width * (1 + 2 * pad), height: ctx.height * (1 + 2 * pad) };
  const k = GRADIENT_PX / Math.max(box.width, box.height);
  const cols = Math.max(2, Math.round(box.width * k));
  const rows = Math.max(2, Math.round(box.height * k));
  return { href: pngUri(encodePng(gradientGrid(spec, ctx, box, cols, rows, angle), cols, rows, 1)), ...box };
}

/**
 * Filter primitives that mix the chain's result with its source through a
 * mask image: `result × m + source × (1 − m)`, premultiplied, exact.
 *
 * @param {{ href: string, x: number, y: number, width: number, height: number }} image
 * @returns {string}
 */
export function lerpPrimitives(image) {
  return '<feOffset dx="0" dy="0" result="fxo"/>'
    + `<feImage${attrs({ href: image.href, x: image.x, y: image.y, width: image.width, height: image.height, preserveAspectRatio: 'none', result: 'fxk' })}/>`
    + '<feColorMatrix in="fxk" type="luminanceToAlpha" color-interpolation-filters="sRGB" result="fxm"/>'
    + '<feComposite in="fxo" in2="fxm" operator="in" result="fxa"/>'
    + '<feComposite in="SourceGraphic" in2="fxm" operator="out" result="fxb"/>'
    + '<feComposite in="fxa" in2="fxb" operator="arithmetic" k2="1" k3="1"/>';
}

/**
 * Mix pixels before and after an effect through a mask, in place on `out`.
 *
 * @param {Uint8ClampedArray} src - Before (RGBA, unpremultiplied).
 * @param {Uint8ClampedArray} out - After; becomes the mix.
 * @param {Uint8Array} m - The mask, a byte a pixel.
 * @returns {Uint8ClampedArray}
 */
export function lerpPixels(src, out, m) {
  for (let p = 0, i = 0; p < m.length; p++, i += 4) {
    const t = m[p];
    if (t === 255) continue;
    if (t === 0) { out[i] = src[i]; out[i + 1] = src[i + 1]; out[i + 2] = src[i + 2]; out[i + 3] = src[i + 3]; continue; }
    const k = t / 255;
    const a0 = src[i + 3];
    const a1 = out[i + 3];
    if (a0 === 255 && a1 === 255) {
      out[i] = src[i] + (out[i] - src[i]) * k;
      out[i + 1] = src[i + 1] + (out[i + 1] - src[i + 1]) * k;
      out[i + 2] = src[i + 2] + (out[i + 2] - src[i + 2]) * k;
      continue;
    }
    // Premultiplied mix.
    const w0 = (a0 / 255) * (1 - k);
    const w1 = (a1 / 255) * k;
    const a = w0 + w1;
    if (a <= 0) { out[i + 3] = 0; continue; }
    out[i] = (src[i] * w0 + out[i] * w1) / a;
    out[i + 1] = (src[i + 1] * w0 + out[i + 1] * w1) / a;
    out[i + 2] = (src[i + 2] * w0 + out[i + 2] * w1) / a;
    out[i + 3] = a * 255;
  }
  return out;
}

/**
 * The effect drawn over the layer through an SVG mask (for effects made
 * of copies, and for layer masks where none can be drawn as pixels):
 * exact where the effect keeps the layer opaque.
 *
 * @param {string} before - The layer's body before the effect.
 * @param {{ defs: string, body: string }} after - Its markup after (all the defs so far).
 * @param {import('./mask.js').EffectMask} spec
 * @param {any} ctx
 * @param {string} id
 * @returns {{ defs: string, body: string }}
 */
export function maskOverlay(before, after, spec, ctx, id) {
  const W = ctx.width;
  const H = ctx.height;
  const pad = Math.max(W, H);
  const region = { x: -pad, y: -pad, width: W + 2 * pad, height: H + 2 * pad };
  let content;
  let extra = '';
  if (spec.layers) {
    const m = /** @type {any} */ (spec)[RESOLVED] ?? { defs: '', body: '' };
    extra = m.defs;
    content = spec.invert
      ? `<rect${attrs({ ...region, fill: '#fff' })}/><g filter="url(#${id}i)">${m.body}</g>`
      : m.body;
    if (spec.invert) extra += `<filter${attrs({ id: `${id}i`, filterUnits: 'userSpaceOnUse', ...region, 'color-interpolation-filters': 'sRGB' })}><feColorMatrix type="matrix" values="-1 0 0 0 1 0 -1 0 0 1 0 0 -1 0 1 0 0 0 1 0"/></filter>`;
  } else {
    const g = gradientImage(spec, ctx, 0.25);
    content = `<image${attrs({ x: g.x, y: g.y, width: g.width, height: g.height, preserveAspectRatio: 'none', href: g.href })}/>`;
  }
  const defs = `${after.defs}${extra}<mask${attrs({ id: `${id}k`, maskUnits: 'userSpaceOnUse', ...region })}>${content}</mask>`;
  return { defs, body: `${before}<g mask="url(#${id}k)">${after.body}</g>` };
}
