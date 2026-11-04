/**
 * `extrude`: a layer drawn again and again behind itself, a step further
 * each time, in a darker colour: block type and 3D marks in one effect.
 *
 * @module effects/extrude
 */

import { attrs, num } from '../svg.js';
import { len } from '../geometry.js';
import { mixOklab, toHex } from '../color.js';
import { filterElement, flood } from './util.js';

/**
 * The extrusion: `steps` copies (default enough for a solid side at the
 * output size, at most 64) along `angle` (degrees, 0 up, 90 right;
 * default 135) to `depth` (a length, default `'3vmin'`), or along `[x, y]`
 * (`offset`). Copies are `color` (default near-black), fading to `to` at
 * the far end; the layer is drawn on top. The markup is written once and
 * reused (`<use>`).
 *
 * @param {any} fx - `{ kind: 'extrude', depth, angle, offset, steps, color, to }`.
 * @param {{ defs: string, body: string }} m
 * @param {import('../layers.js').RenderContext} ctx
 * @param {string} id
 * @returns {{ defs: string, body: string }}
 */
export function extrude(fx, m, ctx, id) {
  const [ox, oy] = fx.offset
    ? [len(fx.offset[0], ctx.canvas), len(fx.offset[1], ctx.canvas)]
    : (() => {
        const d = len(fx.depth, ctx.canvas, '3vmin');
        const a = ((fx.angle ?? 135) * Math.PI) / 180;
        return [Math.sin(a) * d, -Math.cos(a) * d];
      })();
  const reach = Math.hypot(ox, oy);
  const res = /** @type {any} */ (ctx).res ?? 1;
  const steps = Math.max(1, Math.round(fx.steps ?? Math.min(64, Math.max(6, Math.ceil(reach * res)))));
  const near = toHex(fx.color ?? '#141414');
  const far = fx.to ? toHex(fx.to) : near;
  // Colour bands (far first): one recolouring filter per band.
  const bands = Math.min(steps, far === near ? 1 : 8);
  const pad = reach / Math.min(ctx.width, ctx.height) + 0.05;
  let defs = `${m.defs}<g id="${id}s">${m.body}</g>`;
  let body = '';
  for (let b = 0; b < bands; b++) {
    const from = Math.floor((b * steps) / bands);
    const to = Math.floor(((b + 1) * steps) / bands);
    const color = mixOklab(far, near, bands === 1 ? 1 : b / (bands - 1));
    defs += filterElement(`${id}e${b}`, ctx, pad, `<feColorMatrix in="SourceGraphic" type="matrix" values="${flood(color)}"/>`);
    let copies = '';
    for (let i = steps - from; i > steps - to; i--) copies += `<use${attrs({ href: `#${id}s`, transform: `translate(${num((ox * i) / steps, 3)} ${num((oy * i) / steps, 3)})` })}/>`;
    body += `<g filter="url(#${id}e${b})">${copies}</g>`;
  }
  return { defs, body: `${body}<use href="#${id}s"/>` };
}
