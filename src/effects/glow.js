/**
 * Light that spreads from the bright parts, as SVG filters: `bloom` (the
 * highlights glowing, at two scales, screened over the layer) and
 * `halation` (film's red-orange halo round bright edges, where light
 * bounced off the film base back through the red layer).
 *
 * @module effects/glow
 */

import { num } from '../svg.js';
import { len } from '../geometry.js';
import { LUMA, rgb, mat } from './util.js';

/**
 * `bloom`: what's brighter than `threshold` (0–1), blurred to `radius`
 * and to three times that, screened over the layer at `intensity`, tinted
 * by `color` when given. It spreads past the layer's edges (neon type).
 *
 * @param {import('./index.js').Effect & { kind: 'bloom' }} fx
 * @param {import('../render/context.js').RenderContext} ctx
 * @returns {string}
 */
export function bloom(fx, ctx) {
  const t = Math.min(0.99, fx.threshold ?? 0.65);
  const r = len(fx.radius, ctx.canvas, '1.6vmin');
  const k = fx.intensity ?? 0.9;
  const slope = 1 / (1 - t);
  const tint = fx.color ? rgb(fx.color) : [1, 1, 1];
  return `<feComponentTransfer in="SourceGraphic">${['R', 'G', 'B'].map((ch, i) => `<feFunc${ch} type="linear" slope="${num(slope * tint[i], 4)}" intercept="${num(-t * slope * tint[i], 4)}"/>`).join('')}</feComponentTransfer>`
    + '<feComposite in2="SourceAlpha" operator="in" result="bh"/>'
    + `<feGaussianBlur in="bh" stdDeviation="${num(r)}" result="b1"/><feGaussianBlur in="bh" stdDeviation="${num(r * 3)}" result="b2"/>`
    + `<feComposite in="b1" in2="b2" operator="arithmetic" k2="${num(0.6 * k, 3)}" k3="${num(0.7 * k, 3)}" result="bg"/>`
    + '<feBlend in="bg" in2="SourceGraphic" mode="screen"/>';
}

/**
 * `halation`: the highlights above `threshold`, flooded with `color`
 * (default film's red-orange), blurred to `radius` and screened on at
 * `intensity`.
 *
 * @param {import('./index.js').Effect & { kind: 'halation' }} fx
 * @param {import('../render/context.js').RenderContext} ctx
 * @returns {string}
 */
export function halation(fx, ctx) {
  const t = Math.min(0.99, fx.threshold ?? 0.72);
  const [r, g, b] = rgb(fx.color ?? '#ff3d14');
  const k = 1 / (1 - t);
  const i = fx.intensity ?? 1;
  return `<feColorMatrix in="SourceGraphic" type="matrix" values="${mat([0, 0, 0, 0, r, 0, 0, 0, 0, g, 0, 0, 0, 0, b, LUMA[0] * k, LUMA[1] * k, LUMA[2] * k, 0, -t * k])}"/>`
    + '<feComposite in2="SourceAlpha" operator="in"/>'
    + `<feGaussianBlur stdDeviation="${num(len(fx.radius, ctx.canvas, '0.9vmin'))}"/>`
    + `<feComponentTransfer><feFuncA type="linear" slope="${num(i, 3)}"/></feComponentTransfer>`
    + '<feComposite in2="SourceAlpha" operator="in" result="hl"/>'
    + '<feBlend in="hl" in2="SourceGraphic" mode="screen"/>';
}
