/**
 * Reusable stacks: a `defs` layer names layers (by `id`) without drawing
 * them; a `use` layer draws one, placed (`x`, `y`, `scale`, `rotate`, or a
 * `transform`). A plain `use` draws the same markup every time (it's drawn
 * once and referenced); `with` overrides options for that copy, which is
 * drawn on its own.
 *
 * @module render/use
 */

import { attrs, num } from '@arraypress/image-effects/svg';
import { pos, wrap } from '../layers/util.js';
import { transformAttr } from './transform.js';

/**
 * `defs`: register named layers for `use`.
 *
 * @param {any} layer
 * @param {any} ctx
 * @returns {{ defs: string, body: string }}
 */
export function registerDefs(layer, ctx) {
  for (const l of layer.layers ?? []) {
    if (!l?.id) throw new TypeError('Every layer in a defs layer needs an id (use refers to it)');
    ctx.defs.set(l.id, l);
  }
  return { defs: '', body: '' };
}

/**
 * `use`: draw a named layer, placed.
 *
 * @param {any} layer
 * @param {any} ctx
 * @returns {Promise<{ defs: string, body: string }>}
 */
export async function renderUse(layer, ctx) {
  const def = ctx.defs?.get(layer.ref);
  if (!def) throw new TypeError(`use: no layer "${layer.ref}" in a defs layer drawn before it`);
  const place = placement(layer, ctx);
  if (layer.with) {
    const parts = await ctx.stack([{ ...def, ...layer.with }], { tag: 'u' });
    const body = parts.map((/** @type {any} */ p) => p.body).join('');
    return { defs: parts.map((/** @type {any} */ p) => p.defs).join(''), body: wrap(layer, place ? `<g transform="${place}">${body}</g>` : body) };
  }
  // Drawn once per canvas size, then referenced.
  const key = `${layer.ref}@${num(ctx.width)}x${num(ctx.height)}`;
  let drawn = ctx.defs.get(`#${key}`);
  let defs = '';
  if (!drawn) {
    const parts = await ctx.stack([def], { tag: 'u' });
    drawn = { id: `${ctx.id}u` };
    ctx.defs.set(`#${key}`, drawn);
    defs = parts.map((/** @type {any} */ p) => p.defs).join('') + `<g id="${drawn.id}">${parts.map((/** @type {any} */ p) => p.body).join('')}</g>`;
  }
  return { defs, body: wrap(layer, `<use${attrs({ href: `#${drawn.id}`, transform: place })}/>`) };
}

/**
 * Where a copy goes: `transform` as written, else `x`, `y`, `rotate`
 * (about the copy's origin) and `scale`.
 *
 * @param {any} l @param {any} ctx
 * @returns {string | undefined}
 */
function placement(l, ctx) {
  if (l.place) return transformAttr(l.place, ctx.canvas);
  const parts = [];
  if (l.x != null || l.y != null) parts.push(`translate(${num(pos(l.x ?? 0, 'x', ctx.canvas), 3)} ${num(pos(l.y ?? 0, 'y', ctx.canvas), 3)})`);
  if (l.rotate) parts.push(`rotate(${num(l.rotate, 3)})`);
  if (l.scale != null && l.scale !== 1) parts.push(Array.isArray(l.scale) ? `scale(${num(l.scale[0], 4)} ${num(l.scale[1], 4)})` : `scale(${num(l.scale, 4)})`);
  return parts.length ? parts.join(' ') : undefined;
}
