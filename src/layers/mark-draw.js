/**
 * Placing a mark by its real bounds and writing its outline in canvas
 * units, so strokes drawn with it (keylines, contour lines) keep their
 * width whatever the mark's scale. Shared by the `outline` and
 * `construction` layers.
 *
 * @module layers/mark-draw
 */

import { num } from '@logomarks/image-effects/svg';
import { shapes } from '@logomarks/core/svg';
import { pos } from './util.js';

/**
 * @typedef {object} MarkFit
 * @property {number} k - Canvas units a mark unit.
 * @property {number} dx - Added to a mark x times k.
 * @property {number} dy - Added to a mark y times k.
 * @property {{ x: number, y: number, width: number, height: number }} area - The layer's box, canvas units.
 */

/**
 * The layer's box (`x`, `y`, `width`, `height`; default the canvas), in
 * canvas units.
 *
 * @param {any} layer
 * @param {{ canvas: { width: number, height: number } }} ctx
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
export function layerBox(layer, ctx) {
  return {
    x: pos(layer.x ?? 0, 'x', ctx.canvas),
    y: pos(layer.y ?? 0, 'y', ctx.canvas),
    width: pos(layer.width ?? '100%', 'x', ctx.canvas),
    height: pos(layer.height ?? '100%', 'y', ctx.canvas),
  };
}

/**
 * Fit a box of mark units (its real bounds, plus `reach` round it) into an
 * area, centred: the longest side takes `share` of the area's shorter
 * side, and the whole never passes the area.
 *
 * @param {{ x: number, y: number, width: number, height: number }} box - The mark's bounds, mark units.
 * @param {{ x: number, y: number, width: number, height: number }} area - Canvas units.
 * @param {number} [share=1] - 0–1.
 * @param {number} [reach=0] - Mark units drawn round the bounds (contour lines), kept inside too.
 * @returns {MarkFit}
 *
 * @example
 * fitMark({ x: 96, y: 96, width: 320, height: 320 }, { x: 0, y: 0, width: 400, height: 400 }, 0.5).k; // 0.625
 */
export function fitMark(box, area, share = 1, reach = 0) {
  const w = box.width + 2 * reach;
  const h = box.height + 2 * reach;
  const k = Math.min((Math.min(area.width, area.height) * share) / Math.max(w, h), area.width / w, area.height / h);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return { k, dx: area.x + area.width / 2 - cx * k, dy: area.y + area.height / 2 - cy * k, area };
}

/**
 * A mark's filled shapes as path data in canvas units (each with its fill
 * rule), through a fit.
 *
 * @param {string} markup - The mark's paths (512 grid).
 * @param {MarkFit} fit
 * @returns {{ d: string, evenodd: boolean }[]}
 */
export function markPaths(markup, { k, dx, dy }) {
  return shapes(String(markup ?? '')).map((s) => ({ d: segsPath(s.segs, k, dx, dy), evenodd: s.evenodd }));
}

/**
 * Absolute segments scaled by `k` and moved by `dx`, `dy`, as path data.
 *
 * @param {import('@logomarks/core/svg').Segment[]} segs
 * @param {number} k @param {number} dx @param {number} dy
 * @returns {string}
 */
function segsPath(segs, k, dx, dy) {
  const X = (/** @type {number} */ v) => num(v * k + dx, 2);
  const Y = (/** @type {number} */ v) => num(v * k + dy, 2);
  return segs.map((s) => {
    switch (s[0]) {
      case 'M': case 'L': return `${s[0]}${X(s[1])} ${Y(s[2])}`;
      case 'C': return `C${X(s[1])} ${Y(s[2])} ${X(s[3])} ${Y(s[4])} ${X(s[5])} ${Y(s[6])}`;
      case 'Q': return `Q${X(s[1])} ${Y(s[2])} ${X(s[3])} ${Y(s[4])}`;
      case 'A': return `A${num(s[1] * k, 2)} ${num(s[2] * k, 2)} ${num(s[3])} ${s[4] ? 1 : 0} ${s[5] ? 1 : 0} ${X(s[6])} ${Y(s[7])}`;
      default: return 'Z';
    }
  }).join('');
}
