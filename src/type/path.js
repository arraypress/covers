/**
 * Paths for text: circles, arcs, ellipses and waves as path data, and a
 * sampler that gives a point and tangent at any distance along a path.
 *
 * @module type/path
 */

import { num } from '@logomarks/image-effects/svg';
import { len } from '@logomarks/image-effects/length';
import { flattenPath } from '../flatten.js';
import { pos } from '../layers/util.js';

/**
 * A text path as path data, in px.
 *
 * @param {any} p - `{ kind: 'circle' | 'arc' | 'ellipse' | 'wave', … }` or `{ d }`.
 * @param {{ width: number, height: number }} canvas
 * @returns {string}
 */
export function textPathD(p, canvas) {
  const X = (/** @type {any} */ v, /** @type {any} */ f) => pos(v ?? f, 'x', canvas);
  const Y = (/** @type {any} */ v, /** @type {any} */ f) => pos(v ?? f, 'y', canvas);
  if (typeof p === 'string') return p;
  if (p.d) return p.d;
  const kind = p.kind ?? 'circle';
  if (kind === 'circle' || kind === 'ellipse' || kind === 'arc') {
    const cx = X(p.cx, '50%');
    const cy = Y(p.cy, '50%');
    const rx = len(p.rx ?? p.r, canvas, '30vmin');
    const ry = len(p.ry ?? p.r, canvas, '30vmin');
    // Angles: 0 is 12 o'clock, clockwise. A circle starts at its `start` and goes all the way round.
    const ccw = p.direction === 'ccw' || p.side === 'inside';
    const a0 = p.start ?? (kind === 'arc' ? -90 : 180);
    const sweep = kind === 'arc' ? (p.end ?? 90) - a0 : 360;
    const n = Math.max(24, Math.ceil(Math.abs(sweep) / 2));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = ((a0 + (ccw ? -1 : 1) * Math.abs(sweep) * (i / n)) * Math.PI) / 180;
      pts.push(`${i ? 'L' : 'M'}${num(cx + rx * Math.sin(a), 3)} ${num(cy - ry * Math.cos(a), 3)}`);
    }
    return pts.join('');
  }
  if (kind === 'wave') {
    const x1 = X(p.x1, 0);
    const x2 = X(p.x2, '100%');
    const y = Y(p.y, '50%');
    const amp = len(p.amplitude, canvas, '2vmin');
    const wl = len(p.wavelength, canvas, '40vmin');
    const ph = p.phase ?? 0;
    const pts = [];
    for (let x = x1, i = 0; x <= x2 + 0.01; x += 2, i++) pts.push(`${i ? 'L' : 'M'}${num(x, 3)} ${num(y + Math.sin(((x - x1) / wl) * Math.PI * 2 + ph) * amp, 3)}`);
    return pts.join('');
  }
  throw new TypeError(`Unknown text path kind "${kind}" (circle, arc, ellipse, wave, or { d })`);
}

/**
 * A sampler along path data: point and tangent at a distance.
 *
 * @param {string} d
 * @returns {{ length: number, at: (s: number) => { x: number, y: number, tx: number, ty: number } }}
 */
export function pathSampler(d) {
  const subs = flattenPath(d, 1);
  const pts = subs.flatMap((s) => s.points);
  if (pts.length < 2) throw new TypeError('A text path needs at least two points');
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const length = cum[cum.length - 1];
  return {
    length,
    at(s) {
      const t = Math.max(0, Math.min(length, s));
      let lo = 0;
      let hi = cum.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= t) lo = mid; else hi = mid; }
      const seg = cum[hi] - cum[lo] || 1;
      const f = (t - cum[lo]) / seg;
      const [ax, ay] = pts[lo];
      const [bx, by] = pts[hi];
      const dl = Math.hypot(bx - ax, by - ay) || 1;
      // Beyond the ends, keep going along the end tangent.
      const over = s - t;
      const tx = (bx - ax) / dl;
      const ty = (by - ay) / dl;
      return { x: ax + (bx - ax) * f + tx * over, y: ay + (by - ay) * f + ty * over, tx, ty };
    },
  };
}
