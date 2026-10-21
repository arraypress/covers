/**
 * Grid lines that break around content.
 *
 * @module grid
 */

import { num } from './svg.js';

/**
 * Path data for full-length grid lines at `xs` (columns) and `ys` (rows),
 * each broken where it crosses one of the `gaps` rectangles, so a grid can
 * pass behind content without running through it.
 *
 * @param {number[]} xs @param {number[]} ys
 * @param {number} w @param {number} h
 * @param {{ x: number, y: number, width: number, height: number }[]} gaps - Pixel rects.
 * @returns {string} Path data.
 */
export function gridPath(xs, ys, w, h, gaps) {
  const cut = (/** @type {number} */ len, /** @type {[number, number][]} */ holes) => {
    const runs = [];
    let at = 0;
    for (const [a, b] of holes.filter(([a, b]) => b > 0 && a < len).sort((p, q) => p[0] - q[0])) {
      if (a > at) runs.push([at, a]);
      at = Math.max(at, b);
    }
    if (at < len) runs.push([at, len]);
    return runs;
  };
  let d = '';
  for (const y of ys) {
    const holes = gaps.filter((g) => y >= g.y && y <= g.y + g.height).map((g) => /** @type {[number, number]} */ ([g.x, g.x + g.width]));
    for (const [a, b] of cut(w, holes)) d += `M${num(a)} ${num(y)}H${num(b)}`;
  }
  for (const x of xs) {
    const holes = gaps.filter((g) => x >= g.x && x <= g.x + g.width).map((g) => /** @type {[number, number]} */ ([g.y, g.y + g.height]));
    for (const [a, b] of cut(h, holes)) d += `M${num(x)} ${num(a)}V${num(b)}`;
  }
  return d;
}

