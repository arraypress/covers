/**
 * The riso halftone: darkness against a rotated dot screen, thresholded
 * softly, flooded with the ink.
 *
 * @module effects/halftone
 */

import { attrs, num } from '../svg.js';
import { len } from '../geometry.js';
import { encodePng, pngUri } from '../png.js';
import { deflateSync } from '../platform/index.js';
import { LUMA, mat, flood } from './util.js';

/**
 * A riso halftone in one ink: darkness against a rotated dot screen,
 * thresholded softly, flooded with the ink and clipped to the source.
 * The screen is one canvas-sized image (no tile seams at any angle).
 *
 * @param {any} fx - `{ ink, cell, angle, contrast, lift, softness, shape }`.
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {string}
 */
export function halftone(fx, ctx) {
  const cell = len(fx.cell, ctx.canvas, '1.3vmin');
  const angle = fx.angle ?? 15;
  const c = fx.contrast ?? 1.15;
  const lift = fx.lift ?? -0.05;
  const soft = fx.softness ?? 9;
  const { width: w, height: h } = ctx;
  const href = screenHref(w, h, cell, angle, fx.shape ?? 'dot');
  const k = (/** @type {number} */ v) => -c * v;
  return `<feColorMatrix in="SourceGraphic" type="matrix" values="${mat([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, k(LUMA[0]), k(LUMA[1]), k(LUMA[2]), 0, c + lift])}" result="d"/>`
    + `<feImage${attrs({ href, x: 0, y: 0, width: w, height: h, preserveAspectRatio: 'none', result: 'scr' })}/>`
    + `<feColorMatrix in="scr" type="matrix" values="${mat([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...LUMA, 0, 0])}" result="t"/>`
    + '<feComposite in="d" in2="t" operator="arithmetic" k2="1" k3="-1" k4="0.5"/>'
    + `<feComponentTransfer><feFuncA type="linear" slope="${num(soft, 3)}" intercept="${num(-(soft - 1) / 2, 3)}"/></feComponentTransfer>`
    + `<feColorMatrix type="matrix" values="${flood(fx.ink ?? '#0078bf')}"/><feComposite in2="SourceAlpha" operator="in"/>`;
}

/**
 * Screen shapes: distance from a cell's centre (-0.5–0.5 each way) to
 * 0–1, the order in which a cell fills with ink.
 *
 * @type {Record<string, (x: number, y: number) => number>}
 */
const SHAPES = {
  dot: (x, y) => Math.min(1, Math.hypot(x, y) / 0.5),
  line: (x, y) => Math.abs(y) / 0.5,
  square: (x, y) => Math.max(Math.abs(x), Math.abs(y)) / 0.5,
  diamond: (x, y) => (Math.abs(x) + Math.abs(y)) / 1,
  cross: (x, y) => Math.min(Math.abs(x), Math.abs(y)) / 0.5,
};

/** Halftone screen shapes. */
export const HALFTONE_SHAPES = Object.freeze(Object.keys(SHAPES));

/**
 * The halftone screen: dots as radial ramps (black at the centre to #efefef
 * at the edge) on a grid turned to `angle`, over the whole canvas; or
 * lines, squares, diamonds or crosses (`shape`). A PNG where the platform
 * deflates synchronously (Node, whose librsvg can't load an SVG inside
 * feImage); an SVG data URI elsewhere (browsers draw it).
 *
 * @param {number} w @param {number} h @param {number} cell @param {number} angle
 * @param {string} [shape='dot']
 * @returns {string}
 */
function screenHref(w, h, cell, angle, shape = 'dot') {
  if (!Object.hasOwn(SHAPES, shape)) throw new TypeError(`Unknown halftone shape "${shape}" (${HALFTONE_SHAPES.join(', ')})`);
  if (shape !== 'dot' || deflateSync(new Uint8Array(1))) {
    const f = SHAPES[shape];
    // Enough pixels for ~8 per cell, at most ~1.6 MP (the ramps upscale smoothly).
    const s = Math.min(Math.max(1, 8 / cell), Math.sqrt(1.6e6 / (w * h)));
    const pw = Math.max(1, Math.round(w * s));
    const ph = Math.max(1, Math.round(h * s));
    const px = new Uint8Array(pw * ph);
    const a = (-angle * Math.PI) / 180;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const c = cell * s;
    for (let y = 0; y < ph; y++) {
      for (let x = 0; x < pw; x++) {
        const u = (x + 0.5) * cos - (y + 0.5) * sin;
        const v = (x + 0.5) * sin + (y + 0.5) * cos;
        const fx = ((u % c) + c) % c - c / 2;
        const fy = ((v % c) + c) % c - c / 2;
        const d = shape === 'dot' ? Math.min(1, Math.hypot(fx, fy) / (c / 2)) : Math.min(1, f(fx / c, fy / c));
        px[y * pw + x] = Math.round(239 * d);
      }
    }
    return pngUri(encodePng(px, pw, ph, 1));
  }
  const screen = `<svg xmlns='http://www.w3.org/2000/svg' width='${num(w)}' height='${num(h)}' viewBox='0 0 ${num(w)} ${num(h)}'><defs><radialGradient id='g'><stop offset='0' stop-color='#000'/><stop offset='1' stop-color='#efefef'/></radialGradient><pattern id='p' width='${num(cell, 3)}' height='${num(cell, 3)}' patternUnits='userSpaceOnUse' patternTransform='rotate(${num(angle)})'><rect width='${num(cell, 3)}' height='${num(cell, 3)}' fill='#efefef'/><circle cx='${num(cell / 2, 3)}' cy='${num(cell / 2, 3)}' r='${num(cell / 2, 3)}' fill='url(#g)'/></pattern></defs><rect x='${num(-w / 4)}' y='${num(-h / 4)}' width='${num(w * 1.5)}' height='${num(h * 1.5)}' fill='url(#p)'/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(screen)}`;
}
