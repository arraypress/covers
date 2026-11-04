/**
 * The `group` layer: a nested stack on its own design grid.
 *
 * @module render/group
 */

import { attrs, esc, num } from '../svg.js';
import { pos } from '../layers/util.js';
import { scaledReport } from './report.js';
import { IDENTITY, compose } from '../effects/transform.js';

/**
 * `group` — a stack of layers drawn as one: in a box (`x`, `y`, `width`,
 * `height`, px), on its own design grid (`viewBox: [x, y, w, h]`, so a
 * flyer drawn on a 400×500 grid keeps its numbers at any output size), and
 * fitted by `fit` (`'contain'`, `'cover'`, `'stretch'`, `'width'`, `'height'`).
 * The group's own `transform`, `effects` and masks apply to the whole
 * (effects and masks in the grid's units, through `decorate`).
 *
 * @param {any} layer
 * @param {any} ctx
 * @param {(m: { defs: string, body: string }, gctx: any) => Promise<{ defs: string, body: string }>} [decorate] - Wraps the children, in the grid's units.
 * @returns {Promise<{ defs: string, body: string }>}
 */
export async function renderGroup(layer, ctx, decorate) {
  const bx = pos(layer.x ?? 0, 'x', ctx.canvas);
  const by = pos(layer.y ?? 0, 'y', ctx.canvas);
  const bw = layer.width != null ? pos(layer.width, 'x', ctx.canvas) : ctx.width - bx;
  const bh = layer.height != null ? pos(layer.height, 'y', ctx.canvas) : ctx.height - by;
  const vb = layer.viewBox ? (Array.isArray(layer.viewBox) ? layer.viewBox : String(layer.viewBox).split(/[\s,]+/).map(Number)) : [0, 0, bw, bh];
  const [vx, vy, vw, vh] = vb;
  const fit = layer.fit ?? 'contain';
  let sx = bw / vw;
  let sy = bh / vh;
  if (fit === 'contain') sx = sy = Math.min(sx, sy);
  else if (fit === 'cover') sx = sy = Math.max(sx, sy);
  else if (fit === 'width') sy = sx;
  else if (fit === 'height') sx = sy;
  const [ax, ay] = alignOf(layer.align);
  const tx = bx + (bw - vw * sx) * ax;
  const ty = by + (bh - vh * sy) * ay;
  const k = Math.min(sx, sy);
  /** @type {import('../effects/transform.js').Affine} Grid units to the box. */
  const grid = [sx, 0, 0, sy, tx - vx * sx, ty - vy * sy];
  const parts = await ctx.stack(layer.layers ?? [], { tag: 'g', width: vw, height: vh, scale: k, res: Math.max(sx, sy), matrix: grid });
  let defs = parts.map((/** @type {any} */ p) => p.defs).join('');
  let body = parts.map((/** @type {any} */ p) => p.body).join('');
  if (decorate) {
    const gctx = { ...ctx, width: vw, height: vh, canvas: { width: vw, height: vh }, inset: undefined, scale: (ctx.scale ?? 1) * k, res: (ctx.res ?? 1) * Math.max(sx, sy), report: scaledReport(ctx.report, k), matrix: compose(ctx.matrix ?? IDENTITY, grid) };
    ({ defs, body } = await decorate({ defs, body }, gctx));
  }
  const identity = tx === 0 && ty === 0 && sx === 1 && sy === 1 && vx === 0 && vy === 0;
  if (!identity) body = `<g transform="translate(${num(tx, 3)} ${num(ty, 3)}) scale(${num(sx, 6)} ${num(sy, 6)})${vx || vy ? ` translate(${num(-vx, 3)} ${num(-vy, 3)})` : ''}">${body}</g>`;
  if (fit === 'cover' || layer.clipToBox) {
    defs += `<clipPath id="${ctx.id}gc"><rect${attrs({ x: bx, y: by, width: bw, height: bh })}/></clipPath>`;
    body = `<g clip-path="url(#${ctx.id}gc)">${body}</g>`;
  }
  const a = attrs({ opacity: layer.opacity != null && layer.opacity < 1 ? Math.max(0, layer.opacity) : undefined, style: layer.blend && layer.blend !== 'normal' ? `mix-blend-mode:${esc(layer.blend)}` : undefined });
  return { defs, body: a ? `<g${a}>${body}</g>` : body };
}

/** @param {string | undefined} a @returns {[number, number]} */
export function alignOf(a = 'center') {
  const x = a.includes('left') ? 0 : a.includes('right') ? 1 : 0.5;
  const y = a.includes('top') ? 0 : a.includes('bottom') ? 1 : 0.5;
  return [x, y];
}
