/**
 * A layer's `transform` option as an SVG transform.
 *
 * @module render/transform
 */

import { num } from '@arraypress/image-effects/svg';
import { pos } from '../layers/util.js';

/**
 * A layer's `transform` as an SVG transform string.
 *
 * Object form: `translate` (`[x, y]` or `{ x, y }`, lengths), `rotate`
 * (degrees), `scale` (a number or `[sx, sy]`), `skewX`, `skewY`, `mirror`
 * (`'x'` flips left–right, `'y'` top–bottom), all about `origin` (`[x, y]`
 * px or `'center'`, the default). A string is used as written.
 *
 * @param {any} t
 * @param {{ width: number, height: number }} canvas
 * @returns {string | undefined}
 */
export function transformAttr(t, canvas) {
  if (!t) return undefined;
  if (typeof t === 'string') return t;
  const parts = [];
  const tr = Array.isArray(t.translate) ? { x: t.translate[0], y: t.translate[1] } : t.translate;
  if (tr) parts.push(`translate(${num(pos(tr.x ?? 0, 'x', canvas))} ${num(pos(tr.y ?? 0, 'y', canvas))})`);
  const o = t.origin === undefined || t.origin === 'center'
    ? [canvas.width / 2, canvas.height / 2]
    : Array.isArray(t.origin) ? [pos(t.origin[0], 'x', canvas), pos(t.origin[1], 'y', canvas)] : [pos(t.origin.x, 'x', canvas), pos(t.origin.y, 'y', canvas)];
  const inner = [];
  if (t.rotate) inner.push(`rotate(${num(t.rotate, 3)})`);
  let [sx, sy] = t.scale == null ? [1, 1] : Array.isArray(t.scale) ? t.scale : [t.scale, t.scale];
  if (t.mirror === 'x' || t.mirror === 'both') sx = -sx;
  if (t.mirror === 'y' || t.mirror === 'both') sy = -sy;
  if (sx !== 1 || sy !== 1) inner.push(`scale(${num(sx, 4)} ${num(sy, 4)})`);
  if (t.skewX) inner.push(`skewX(${num(t.skewX, 3)})`);
  if (t.skewY) inner.push(`skewY(${num(t.skewY, 3)})`);
  if (inner.length) parts.push(`translate(${num(o[0])} ${num(o[1])}) ${inner.join(' ')} translate(${num(-o[0])} ${num(-o[1])})`);
  return parts.length ? parts.join(' ') : undefined;
}

/** @typedef {[number, number, number, number, number, number]} Affine - `[a, b, c, d, e, f]`, as SVG's `matrix()`. */

/** @param {Affine} m @param {Affine} n @returns {Affine} `m × n`. */
const multiply = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

/** @param {string} name @param {number[]} v @returns {Affine} One SVG transform function as a matrix. */
function fn(name, v) {
  const r = ((v[0] ?? 0) * Math.PI) / 180;
  switch (name) {
    case 'translate': return [1, 0, 0, 1, v[0] ?? 0, v[1] ?? 0];
    case 'scale': return [v[0] ?? 1, 0, 0, v[1] ?? v[0] ?? 1, 0, 0];
    case 'rotate': {
      const m = /** @type {Affine} */ ([Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]);
      if (v.length < 3) return m;
      return multiply(multiply([1, 0, 0, 1, v[1], v[2]], m), [1, 0, 0, 1, -v[1], -v[2]]);
    }
    case 'skewX': return [1, 0, Math.tan(r), 1, 0, 0];
    case 'skewY': return [1, Math.tan(r), 0, 1, 0, 0];
    case 'matrix': return /** @type {Affine} */ (v.slice(0, 6));
    default: return [1, 0, 0, 1, 0, 0];
  }
}

/**
 * A transform (an SVG transform string, or the object form) as one matrix.
 *
 * @param {any} t
 * @param {{ width: number, height: number }} canvas
 * @returns {Affine}
 */
export function transformMatrix(t, canvas) {
  const s = transformAttr(t, canvas);
  /** @type {Affine} */
  let m = [1, 0, 0, 1, 0, 0];
  if (!s) return m;
  for (const [, name, args] of s.matchAll(/(\w+)\s*\(([^)]*)\)/g)) m = multiply(m, fn(name, args.split(/[\s,]+/).filter(Boolean).map(Number)));
  return m;
}

/**
 * How much a matrix enlarges what it draws: its smallest and largest
 * stretch (singular values), and their geometric mean.
 *
 * @param {Affine} m
 * @returns {{ min: number, max: number, mean: number }}
 */
export function stretchOf(m) {
  const [a, b, c, d] = m;
  const sum = a * a + b * b + c * c + d * d;
  const det = Math.abs(a * d - b * c);
  const root = Math.sqrt(Math.max(0, sum * sum - 4 * det * det));
  return { min: Math.sqrt((sum - root) / 2), max: Math.sqrt((sum + root) / 2), mean: Math.sqrt(det) };
}

/**
 * The inverse of an affine matrix.
 *
 * @param {Affine} m
 * @returns {Affine}
 */
export function invert(m) {
  const [a, b, c, d, e, f] = m;
  const det = a * d - b * c || 1e-12;
  return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det];
}

/**
 * A point through an affine matrix.
 *
 * @param {Affine} m @param {number} x @param {number} y
 * @returns {[number, number]}
 */
export function apply(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** The identity matrix. @type {Affine} */
export const IDENTITY = Object.freeze(/** @type {Affine} */ ([1, 0, 0, 1, 0, 0]));

/** @param {Affine} m @param {Affine} n @returns {Affine} `m` then `n` (n applied first, in m's space). */
export const compose = (m, n) => multiply(m, n);
