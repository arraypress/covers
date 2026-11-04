/**
 * `mirror`, drawn as copies of the layer's own markup (so vector art
 * stays vector): one half reflected onto the other, or one quarter onto
 * all four. (`kaleidoscope` is on pixels, in `distort.js`: its wedges
 * need the frame filled past the layer's edge.)
 *
 * @module effects/symmetry
 */

import { attrs, num } from '../svg.js';
import { fraction } from './buffer.js';

/**
 * A copy of the source drawn through a transform, clipped to a polygon.
 *
 * @param {string} src - The source's id.
 * @param {string} clip - The clip path's id.
 * @param {string} [transform]
 * @returns {string}
 */
const copy = (src, clip, transform) => `<g clip-path="url(#${clip})"><use${attrs({ href: `#${src}`, transform })}/></g>`;

/** @param {string} id @param {[number, number][]} pts @returns {string} */
const clipPath = (id, pts) => `<clipPath${attrs({ id, clipPathUnits: 'userSpaceOnUse' })}><polygon points="${pts.map(([x, y]) => `${num(x, 3)},${num(y, 3)}`).join(' ')}"/></clipPath>`;

/**
 * `mirror`: `keep` one side (`'left'`, `'right'`, `'top'`, `'bottom'`) and
 * reflect it onto the other across a line at `at` (0–1), or a quarter
 * (`'top-left'`, …) onto all four.
 *
 * @param {import('./index.js').Effect & { kind: 'mirror' }} fx
 * @param {{ defs: string, body: string }} m
 * @param {any} ctx
 * @param {string} id
 * @returns {{ defs: string, body: string }}
 */
export function mirror(fx, m, ctx, id) {
  const keep = fx.keep ?? 'left';
  const KEEP = ['left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
  if (!KEEP.includes(keep)) throw new TypeError(`Unknown mirror side "${keep}" (${KEEP.join(', ')})`);
  const { width: W, height: H } = ctx;
  const [fx0, fy0] = fraction(/** @type {any} */ (fx.at), [0.5, 0.5]);
  const ax = (typeof fx.at === 'number' ? fx.at : fx0) * W;
  const ay = (typeof fx.at === 'number' ? fx.at : fy0) * H;
  const P = Math.max(W, H);
  // A hair of overlap past the line hides the anti-aliased seam.
  const e = 0.5 / ((ctx.res ?? 1) || 1);
  const sx = keep.includes('left') ? -1 : keep.includes('right') ? 1 : 0;
  const sy = keep.includes('top') ? -1 : keep.includes('bottom') ? 1 : 0;
  /** @param {number} qx @param {number} qy @returns {[number, number][]} The quadrant (or half) on that side. */
  const region = (qx, qy) => {
    const x0 = qx < 0 ? -P : qx > 0 ? ax - e : -P;
    const x1 = qx < 0 ? ax + e : qx > 0 ? W + P : W + P;
    const y0 = qy < 0 ? -P : qy > 0 ? ay - e : -P;
    const y1 = qy < 0 ? ay + e : qy > 0 ? H + P : H + P;
    return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  };
  const src = `${id}s`;
  let defs = `${m.defs}<g id="${src}">${m.body}</g>`;
  let body = '';
  /** @type {[number, number][]} */
  const flips = [[1, 1]];
  if (sx) flips.push([-1, 1]);
  if (sy) flips.push([1, -1]);
  if (sx && sy) flips.push([-1, -1]);
  // Mirrored copies first, the kept side on top.
  flips.reverse().forEach(([fxs, fys], i) => {
    const clip = `${id}c${i}`;
    defs += clipPath(clip, region(sx * fxs, sy * fys));
    const t = fxs === 1 && fys === 1 ? undefined : `translate(${num(fxs === -1 ? 2 * ax : 0, 3)} ${num(fys === -1 ? 2 * ay : 0, 3)}) scale(${fxs} ${fys})`;
    body += copy(src, clip, t);
  });
  return { defs, body };
}
