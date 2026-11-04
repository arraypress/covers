/**
 * Blur, shadow, glow and die-cut borders.
 *
 * @module effects/light
 */

import { num } from '../svg.js';
import { len } from '../geometry.js';
import { flood } from './util.js';

/**
 * `blur`: `radius`, or `x` and `y` for an axis-aligned blur.
 *
 * @param {import('./index.js').Effect & { kind: 'blur' }} fx
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {string}
 */
export function blur(fx, ctx) {
  const sd = fx.x != null || fx.y != null ? `${num(len(fx.x, ctx.canvas, 0))} ${num(len(fx.y, ctx.canvas, 0))}` : num(len(fx.radius, ctx.canvas, '1vmin'));
  return `<feGaussianBlur stdDeviation="${sd}"${fx.edge === 'duplicate' ? ' edgeMode="duplicate"' : ''}/>`;
}

/**
 * `shadow` and `glow`: the alpha, tinted, blurred and offset under the source.
 *
 * @param {import('./index.js').Effect & { kind: 'shadow' | 'glow' }} fx
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {string}
 */
export function shadow(fx, ctx) {
  const glow = fx.kind === 'glow';
  const op = fx.opacity ?? (glow ? 0.6 : 0.35);
  const spread = fx.spread ? `<feMorphology operator="dilate" radius="${num(len(fx.spread, ctx.canvas))}"/>` : '';
  const dx = glow ? 0 : len(fx.x, ctx.canvas, 0);
  const dy = glow ? 0 : len(fx.y, ctx.canvas, '0.8vmin');
  return `<feColorMatrix in="SourceAlpha" type="matrix" values="${flood(fx.color ?? (glow ? '#ffffff' : '#000000'), [0, 0, 0, op, 0])}"/>${spread}<feGaussianBlur stdDeviation="${num(len(fx.blur, ctx.canvas, glow ? '1.2vmin' : '1.5vmin'))}"/><feOffset dx="${num(dx)}" dy="${num(dy)}" result="s"/><feMerge><feMergeNode in="s"/><feMergeNode in="SourceGraphic"/></feMerge>`;
}

/**
 * `border`: a die-cut sticker border round the alpha, and an optional cut
 * line outside it.
 *
 * @param {import('./index.js').Effect & { kind: 'border' }} fx
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {string}
 */
export function border(fx, ctx) {
  const w = len(fx.width, ctx.canvas, '1.2vmin');
  /** @param {number} r @param {string} c @param {string} name */
  const ring = (r, c, name) => `<feMorphology in="SourceAlpha" operator="dilate" radius="${num(r)}" result="${name}d"/><feColorMatrix in="${name}d" type="matrix" values="${flood(c, [0, 0, 0, 1, 0])}" result="${name}"/>`;
  let out = '';
  let merge = '';
  if (fx.line) {
    out += ring(w + len(fx.lineWidth, ctx.canvas, '0.25vmin'), fx.line === true ? '#c9c6c0' : fx.line, 'ln');
    merge += '<feMergeNode in="ln"/>';
  }
  out += ring(w, fx.color ?? '#ffffff', 'bd');
  return `${out}<feMerge>${merge}<feMergeNode in="bd"/><feMergeNode in="SourceGraphic"/></feMerge>`;
}
