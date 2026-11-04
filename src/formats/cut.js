/**
 * Die-cut outlines for print formats: a plain trim, rounded corners, a
 * circle, or any path, as Bézier segments in canvas px (so a layer can
 * draw or clip to it in its own units).
 *
 * @module formats/cut
 */

import { flattenPath } from '../flatten.js';

/** A circle's quarter as a cubic Bézier (control-point distance per radius). */
const K = 0.5522847498;

/**
 * @typedef {{ cmd: 'M' | 'L' | 'C' | 'Z', pts: number[] }} Segment
 */

/**
 * The cut outline round a box.
 *
 * `cut`: `'rect'` (or none), `'rounded'` (3 mm corners), `'circle'` (an
 * ellipse in the box), `{ radius }` (corners in mm), or `{ d, viewBox }`
 * (a die path drawn from its grid into the box).
 *
 * @param {any} cut
 * @param {{ x: number, y: number, width: number, height: number }} box - The trim (grown by any outset), px.
 * @param {number} mm - px per millimetre.
 * @param {number} [outset=0] - How far the box was grown (corner radii grow with it).
 * @returns {Segment[]}
 */
export function cutPath(cut, box, mm, outset = 0) {
  const { x, y, width: w, height: h } = box;
  if (cut === 'circle') return ellipse(x + w / 2, y + h / 2, w / 2, h / 2);
  if (cut && typeof cut === 'object' && cut.d) return custom(cut, box);
  const r = cut === 'rounded' ? 3 * mm + outset : cut && typeof cut === 'object' && cut.radius != null ? cut.radius * mm + outset : 0;
  return rounded(x, y, w, h, Math.max(0, Math.min(r, w / 2, h / 2)));
}

/** @param {number} x @param {number} y @param {number} w @param {number} h @param {number} r @returns {Segment[]} */
function rounded(x, y, w, h, r) {
  if (r <= 0) return [{ cmd: 'M', pts: [x, y] }, { cmd: 'L', pts: [x + w, y] }, { cmd: 'L', pts: [x + w, y + h] }, { cmd: 'L', pts: [x, y + h] }, { cmd: 'Z', pts: [] }];
  const k = r * (1 - K);
  return [
    { cmd: 'M', pts: [x + r, y] }, { cmd: 'L', pts: [x + w - r, y] }, { cmd: 'C', pts: [x + w - k, y, x + w, y + k, x + w, y + r] },
    { cmd: 'L', pts: [x + w, y + h - r] }, { cmd: 'C', pts: [x + w, y + h - k, x + w - k, y + h, x + w - r, y + h] },
    { cmd: 'L', pts: [x + r, y + h] }, { cmd: 'C', pts: [x + k, y + h, x, y + h - k, x, y + h - r] },
    { cmd: 'L', pts: [x, y + r] }, { cmd: 'C', pts: [x, y + k, x + k, y, x + r, y] }, { cmd: 'Z', pts: [] },
  ];
}

/** @param {number} cx @param {number} cy @param {number} rx @param {number} ry @returns {Segment[]} */
function ellipse(cx, cy, rx, ry) {
  const kx = rx * K;
  const ky = ry * K;
  return [
    { cmd: 'M', pts: [cx, cy - ry] },
    { cmd: 'C', pts: [cx + kx, cy - ry, cx + rx, cy - ky, cx + rx, cy] },
    { cmd: 'C', pts: [cx + rx, cy + ky, cx + kx, cy + ry, cx, cy + ry] },
    { cmd: 'C', pts: [cx - kx, cy + ry, cx - rx, cy + ky, cx - rx, cy] },
    { cmd: 'C', pts: [cx - rx, cy - ky, cx - kx, cy - ry, cx, cy - ry] },
    { cmd: 'Z', pts: [] },
  ];
}

/** @param {{ d: string, viewBox?: number[] }} cut @param {{ x: number, y: number, width: number, height: number }} box @returns {Segment[]} */
function custom(cut, box) {
  const [vx, vy, vw, vh] = cut.viewBox ?? [0, 0, box.width, box.height];
  const sx = box.width / vw;
  const sy = box.height / vh;
  /** @type {Segment[]} */
  const out = [];
  for (const sub of flattenPath(String(cut.d), Math.min(vw, vh) / 400)) {
    sub.points.forEach(([px, py], i) => out.push({ cmd: i ? 'L' : 'M', pts: [box.x + (px - vx) * sx, box.y + (py - vy) * sy] }));
    if (sub.closed) out.push({ cmd: 'Z', pts: [] });
  }
  return out;
}
