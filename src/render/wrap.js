/**
 * The options every layer takes on top of its own: `area`, `effects`,
 * `transform`, `mask`, `knockout` and `clip`.
 *
 * @module render/wrap
 */

import { attrs, esc, num } from '@arraypress/image-effects/svg';
import { drawEffects, contentBox } from '@arraypress/image-effects';
import { transformAttr, transformMatrix, stretchOf, compose, IDENTITY } from './transform.js';
import { renderGroup } from './group.js';
import { scaledReport } from './report.js';

/** Layer options handled here, for every layer type. */
export const WRAP_KEYS = ['effects', 'mask', 'knockout', 'clip', 'area'];

/** Text-case keywords (the text layer's `transform` is its case when it's one of these). */
export const CASES = new Set(['uppercase', 'lowercase', 'none']);

/**
 * Whether a layer uses the common 1.1 options (so 1.0 layers take exactly
 * the 1.0 path).
 *
 * @param {any} layer
 * @returns {boolean}
 */
export function wrapped(layer) {
  if (WRAP_KEYS.some((k) => layer[k] != null)) return true;
  return isGeometric(layer);
}

/** @param {any} layer @returns {boolean} Whether `transform` is geometry (not a text case). */
const isGeometric = (layer) => layer.transform != null && !(layer.type === 'text' && typeof layer.transform === 'string' && CASES.has(layer.transform));

/**
 * A layer with `area`, `effects`, `transform`, `mask`, `knockout` or
 * `clip`. Blend and opacity go on the outermost group, so a masked or
 * filtered layer still blends with what's under it. On a `group` with a
 * `viewBox`, effects and masks work in the group's own grid.
 *
 * @param {any} layer
 * @param {any} ctx
 * @param {{ c: import('../index.js').Cover }} scope
 * @param {(layer: any, ctx: any) => Promise<{ defs: string, body: string }>} renderOne - Draws the layer itself.
 * @returns {Promise<{ defs: string, body: string }>}
 */
export async function renderWrapped(layer, ctx, scope, renderOne) {
  const inner = { ...layer, opacity: undefined, blend: undefined, effects: undefined, mask: undefined, knockout: undefined, clip: undefined, area: undefined };
  const geometric = isGeometric(layer);
  if (geometric) inner.transform = undefined;
  const grid = layer.type === 'group' && layer.viewBox != null;

  const box = areaBox(layer.area, ctx, scope);
  /** @type {any} */
  let lctx = box ? { ...ctx, width: box.width, height: box.height, canvas: { width: box.width, height: box.height }, inset: undefined, matrix: compose(ctx.matrix ?? IDENTITY, [1, 0, 0, 1, box.x, box.y]) } : ctx;
  // What's drawn inside a transform is drawn that much larger (images resample for it, lint measures it).
  if (geometric) {
    const t = transformMatrix(layer.transform, lctx.canvas);
    const k = stretchOf(t);
    lctx = { ...lctx, matrix: compose(lctx.matrix ?? IDENTITY, t) };
    if (k.max !== 1 || k.mean !== 1) Object.assign(lctx, { scale: (lctx.scale ?? 1) * k.mean, res: (lctx.res ?? 1) * k.max, report: scaledReport(lctx.report, k.mean) });
  }

  let { defs, body } = grid
    ? await renderGroup(inner, lctx, (/** @type {any} */ part, /** @type {any} */ gctx) => decorate(part, layer, gctx))
    : await drawEffects(await renderOne(inner, lctx), layer.effects, lctx);
  if (geometric) {
    const t = transformAttr(layer.transform, lctx.canvas);
    if (t) body = `<g transform="${t}">${body}</g>`;
  }
  if (box) body = `<g transform="translate(${num(box.x)} ${num(box.y)})">${body}</g>`;
  if (!grid) ({ defs, body } = await decorateMasks({ defs, body }, layer, ctx));
  const a = attrs({ opacity: layer.opacity != null && layer.opacity < 1 ? Math.max(0, layer.opacity) : undefined, style: layer.blend && layer.blend !== 'normal' ? `mix-blend-mode:${esc(layer.blend)}` : undefined });
  if (a) body = `<g${a}>${body}</g>`;
  return { defs, body };
}

/**
 * `area`: the box a layer is drawn in (the trim, the safe area, or
 * fractions of the canvas), or null for the whole canvas.
 *
 * @param {any} a
 * @param {any} ctx
 * @param {{ c: import('../index.js').Cover }} scope
 * @returns {{ x: number, y: number, width: number, height: number } | null}
 */
function areaBox(a, ctx, scope) {
  if (!a || a === 'bleed') return null;
  if (a === 'trim' || a === 'safe') {
    const print = /** @type {any} */ (scope.c).print;
    const inset = print ? print.bleed + (a === 'safe' ? print.safe : 0) : 0;
    return { x: inset, y: inset, width: ctx.width - 2 * inset, height: ctx.height - 2 * inset };
  }
  return { x: (a.x ?? 0) * ctx.width, y: (a.y ?? 0) * ctx.height, width: (a.width ?? 1 - (a.x ?? 0)) * ctx.width, height: (a.height ?? 1 - (a.y ?? 0)) * ctx.height };
}

/**
 * A layer's effects, then its masks, round its markup.
 *
 * @param {{ defs: string, body: string }} m
 * @param {any} layer
 * @param {any} ctx
 * @returns {Promise<{ defs: string, body: string }>}
 */
export async function decorate(m, layer, ctx) {
  return decorateMasks(await drawEffects(m, layer.effects, ctx), layer, ctx);
}

/**
 * Masks: sub-stacks drawn as a luminance mask. `knockout` cuts its layers
 * out of this one; `clip` shows this one only where they paint; `mask`
 * uses their luminance as drawn (a white-to-black gradient fades).
 *
 * @param {{ defs: string, body: string }} m
 * @param {any} layer
 * @param {any} ctx
 * @returns {Promise<{ defs: string, body: string }>}
 */
async function decorateMasks(m, layer, ctx) {
  let { defs, body } = m;
  const masks = [['mask', layer.mask], ['knockout', layer.knockout], ['clip', layer.clip]].filter(([, v]) => v != null);
  for (const [kind, list] of masks) {
    const sub = await ctx.stack(Array.isArray(list) ? list : [list], { tag: `${kind[0]}` });
    const mid = `${ctx.id}${kind[0]}m`;
    const fid = `${ctx.id}${kind[0]}f`;
    const subDefs = sub.map((/** @type {any} */ p) => p.defs).join('');
    let subBody = sub.map((/** @type {any} */ p) => p.body).join('');
    const pad = Math.max(ctx.width, ctx.height);
    const region = { x: -pad, y: -pad, width: ctx.width + 2 * pad, height: ctx.height + 2 * pad };
    let mdefs = subDefs;
    if (kind === 'knockout' || kind === 'clip') {
      // Whatever the sub-layers paint becomes black (cut) or white (kept), keeping their alpha
      // (in renderImage, over just what they paint).
      const v = kind === 'knockout' ? 0 : 1;
      const painted = await contentBox({ defs: subDefs, body: subBody }, ctx);
      mdefs += `<filter${attrs({ id: fid, filterUnits: 'userSpaceOnUse', ...(painted ?? region), 'color-interpolation-filters': 'sRGB' })}><feColorMatrix type="matrix" values="0 0 0 0 ${v} 0 0 0 0 ${v} 0 0 0 0 ${v} 0 0 0 1 0"/></filter>`;
      subBody = `<g filter="url(#${fid})">${subBody}</g>`;
      if (kind === 'knockout') subBody = `<rect${attrs({ ...region, fill: '#fff' })}/>${subBody}`;
    }
    defs += `${mdefs}<mask${attrs({ id: mid, maskUnits: 'userSpaceOnUse', ...region })}>${subBody}</mask>`;
    body = `<g mask="url(#${mid})">${body}</g>`;
  }
  return { defs, body };
}
