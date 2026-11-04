/**
 * Helpers for writing filter primitives.
 *
 * @module effects/util
 */

import { attrs, num } from '../svg.js';
import { toHex } from '../color.js';

/** Rec. 709 luma weights. */
export const LUMA = [0.2126, 0.7152, 0.0722];

/**
 * A colour as 0–1 channels.
 *
 * @param {string} c
 * @returns {[number, number, number]}
 */
export function rgb(c) {
  const h = toHex(c);
  return /** @type {[number, number, number]} */ ([1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255));
}

/**
 * A colour-matrix value list.
 *
 * @param {number[]} m - 20 numbers.
 * @returns {string}
 */
export const mat = (m) => m.map((x) => num(x, 4)).join(' ');

/**
 * A matrix that floods RGB with a colour and takes alpha from `alpha` (a
 * 5-number row; default the source alpha).
 *
 * @param {string} color
 * @param {number[]} [alpha]
 * @returns {string}
 */
export function flood(color, alpha = [0, 0, 0, 1, 0]) {
  const [r, g, b] = rgb(color);
  return mat([0, 0, 0, 0, r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, ...alpha]);
}

/**
 * A layer's seeded turbulence seed (or the effect's own `seed`).
 *
 * @param {{ rng: { int: (a: number, b: number) => number } }} ctx
 * @param {{ seed?: number }} fx
 * @returns {number}
 */
export const seedOf = (ctx, fx) => fx.seed ?? ctx.rng.int(1, 9999);

/**
 * A `<filter>` over the canvas, padded, in user space.
 *
 * @param {string} id
 * @param {{ width: number, height: number }} ctx
 * @param {number} pad - Fraction of the canvas on each side.
 * @param {string} body - Primitives.
 * @param {'sRGB' | 'linearRGB'} [colorSpace='sRGB'] - Where the primitives do their arithmetic.
 * @param {{ x: number, y: number, width: number, height: number }} [region] - A smaller region (the content's box plus padding).
 * @returns {string}
 */
export function filterElement(id, ctx, pad, body, colorSpace = 'sRGB', region) {
  const px = ctx.width * pad;
  const py = ctx.height * pad;
  if (colorSpace !== 'sRGB' && colorSpace !== 'linearRGB') throw new TypeError(`Unknown colorSpace "${colorSpace}" (sRGB, linearRGB)`);
  const r = region ?? { x: -px, y: -py, width: ctx.width + 2 * px, height: ctx.height + 2 * py };
  return `<filter${attrs({ id, filterUnits: 'userSpaceOnUse', primitiveUnits: 'userSpaceOnUse', ...r, 'color-interpolation-filters': colorSpace })}>${body}</filter>`;
}

/**
 * Noise turned into displacement: the shared start of rough, warp and wear.
 *
 * @param {number | number[]} frequency
 * @param {number} octaves
 * @param {number} seed
 * @param {number} scale - Displacement, px.
 * @param {string} [result]
 * @returns {string}
 */
export function displace(frequency, octaves, seed, scale, result) {
  return `<feTurbulence type="fractalNoise" baseFrequency="${[].concat(/** @type {any} */ (frequency)).map((f) => num(f, 4)).join(' ')}" numOctaves="${octaves}" seed="${seed}" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="${num(scale)}" xChannelSelector="R" yChannelSelector="G"${result ? ` result="${result}"` : ''}/>`;
}
