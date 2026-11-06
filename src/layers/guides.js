/**
 * A mark's construction, read from its paths: the circles its curves are
 * drawn on and the lines its straight edges lie on, for a construction
 * sheet.
 *
 * @module layers/guides
 */

import { shapes, bounds, outlinePoints, arcOf, bezierAt } from '@logomarks/core/svg';

/**
 * @typedef {object} GuideCircle
 * @property {number} cx @property {number} cy @property {number} r
 * @property {number} sweep - How much of it the mark draws, radians (2π: all of it).
 */

/**
 * @typedef {object} GuideLine
 * @property {number} angle - Radians, 0–π.
 * @property {number} x @property {number} y - A point on it (the middle of its longest edge).
 * @property {number} length - The mark's edges on it, in total.
 */

/**
 * @typedef {object} MarkGuides
 * @property {{ x: number, y: number, width: number, height: number }} box - Its real bounds.
 * @property {number} inscribed - The radius of the circle in its box, round the box's centre.
 * @property {number} circumscribed - The radius of the circle round its outline, from the box's centre.
 * @property {GuideCircle[]} circles - Its curves' circles, the most drawn first.
 * @property {GuideLine[]} lines - Its straight edges' lines, the longest first.
 */

/** Read marks, by markup and counts. @type {Map<string, MarkGuides>} */
const cache = new Map();

/**
 * Read a mark's construction. A curve counts as part of a circle when
 * its points lie on the circle through its ends and middle (an arc, or a
 * Bézier drawn round one); curves on the same circle are added up, and
 * a circle is kept when the mark draws a good share of it (50° or more)
 * and it isn't a small corner round. Straight edges on the same line are
 * added up the same way, and lines along the box's own sides left out.
 *
 * @param {string} markup - The mark's paths (512 grid).
 * @param {{ circles?: number, lines?: number }} [options] - The most of each kept (6 and 6).
 * @returns {MarkGuides | null} Null when it draws nothing.
 *
 * @example
 * markGuides('<circle cx="256" cy="256" r="200"/>').circles; // [{ cx: 256, cy: 256, r: 200, sweep: 6.28… }]
 */
export function markGuides(markup, { circles = 6, lines = 6 } = {}) {
  const key = `${circles}|${lines}|${markup}`;
  if (cache.has(key)) return /** @type {MarkGuides} */ (cache.get(key));
  const filled = shapes(String(markup ?? ''));
  if (!filled.length) return null;
  const b = bounds(filled);
  if (!(b.w > 0 && b.h > 0)) return null;
  const box = { x: b.x, y: b.y, width: b.w, height: b.h };
  const size = Math.max(b.w, b.h);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;

  /** @type {GuideCircle[]} */
  const arcs = [];
  /** @type {{ x1: number, y1: number, x2: number, y2: number }[]} */
  const edges = [];
  let far = 0;
  for (const s of filled) {
    for (const [x, y] of outlinePoints(s.segs)) far = Math.max(far, Math.hypot(x - cx, y - cy));
    let x = 0, y = 0, sx = 0, sy = 0;
    for (const seg of s.segs) {
      switch (seg[0]) {
        case 'M': x = sx = seg[1]; y = sy = seg[2]; break;
        case 'L': edges.push({ x1: x, y1: y, x2: seg[1], y2: seg[2] }); x = seg[1]; y = seg[2]; break;
        case 'C': fitCurve([[x, y], [seg[1], seg[2]], [seg[3], seg[4]], [seg[5], seg[6]]], arcs); x = seg[5]; y = seg[6]; break;
        case 'Q': fitCurve([[x, y], [seg[1], seg[2]], [seg[3], seg[4]]], arcs); x = seg[3]; y = seg[4]; break;
        case 'A': {
          const a = arcOf(x, y, seg.slice(1));
          if (a && Math.abs(a.rx - a.ry) <= 0.01 * Math.max(a.rx, a.ry)) arcs.push({ cx: a.cx, cy: a.cy, r: (a.rx + a.ry) / 2, sweep: Math.abs(a.sweep) });
          x = seg[6]; y = seg[7];
          break;
        }
        case 'Z': edges.push({ x1: x, y1: y, x2: sx, y2: sy }); x = sx; y = sy; break;
      }
    }
  }

  const guides = {
    box,
    inscribed: Math.min(b.w, b.h) / 2,
    circumscribed: far,
    circles: circleGuides(arcs, size).slice(0, Math.max(0, circles)),
    lines: lineGuides(edges, box).slice(0, Math.max(0, lines)),
  };
  if (cache.size > 200) cache.clear();
  cache.set(key, guides);
  return guides;
}

/**
 * The circle a curve is drawn round, added to `arcs` when its quarter
 * points lie on it too (within half a unit, or 1% of its radius).
 *
 * @param {number[][]} P - A quadratic's 3 points or a cubic's 4.
 * @param {GuideCircle[]} arcs
 */
function fitCurve(P, arcs) {
  const p0 = P[0];
  const p1 = /** @type {number[]} */ (bezierAt(/** @type {any} */ (P), 0.5));
  const p2 = P[P.length - 1];
  const c = circleThrough(p0, p1, p2);
  if (!c) return;
  const tol = Math.max(0.5, c.r * 0.01);
  for (const u of [0.25, 0.75]) {
    const [x, y] = bezierAt(/** @type {any} */ (P), u);
    if (Math.abs(Math.hypot(x - c.cx, y - c.cy) - c.r) > tol) return;
  }
  const turn = (/** @type {number[]} */ a, /** @type {number[]} */ b) => {
    const ux = a[0] - c.cx, uy = a[1] - c.cy, vx = b[0] - c.cx, vy = b[1] - c.cy;
    return Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy));
  };
  arcs.push({ ...c, sweep: turn(p0, p1) + turn(p1, p2) });
}

/**
 * The circle through three points, or null when they're (nearly) on a line.
 *
 * @param {number[]} a @param {number[]} b @param {number[]} c
 * @returns {{ cx: number, cy: number, r: number } | null}
 */
function circleThrough(a, b, c) {
  const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]));
  if (Math.abs(d) < 1e-6) return null;
  const A = a[0] ** 2 + a[1] ** 2, B = b[0] ** 2 + b[1] ** 2, C = c[0] ** 2 + c[1] ** 2;
  const cx = (A * (b[1] - c[1]) + B * (c[1] - a[1]) + C * (a[1] - b[1])) / d;
  const cy = (A * (c[0] - b[0]) + B * (a[0] - c[0]) + C * (b[0] - a[0])) / d;
  return { cx, cy, r: Math.hypot(a[0] - cx, a[1] - cy) };
}

/**
 * Arcs on the same circle added up (centres and radii within 3 units or
 * 3%); kept when the mark draws 50° or more of it and its radius is 4%
 * to 120% of the mark's size; the most drawn (by length) first.
 *
 * @param {GuideCircle[]} arcs
 * @param {number} size - The mark's longest side.
 * @returns {GuideCircle[]}
 */
function circleGuides(arcs, size) {
  /** @type {(GuideCircle & { w: number })[]} */
  const groups = [];
  for (const a of arcs) {
    const near = Math.max(3, a.r * 0.03);
    const g = groups.find((o) => Math.hypot(o.cx - a.cx, o.cy - a.cy) <= near && Math.abs(o.r - a.r) <= near);
    if (!g) { groups.push({ ...a, w: a.sweep }); continue; }
    // A sweep-weighted mean, so the long arcs set the circle.
    const w = g.w + a.sweep;
    g.cx = (g.cx * g.w + a.cx * a.sweep) / w;
    g.cy = (g.cy * g.w + a.cy * a.sweep) / w;
    g.r = (g.r * g.w + a.r * a.sweep) / w;
    g.w = w;
    g.sweep = Math.min(2 * Math.PI, g.sweep + a.sweep);
  }
  return groups
    .filter((g) => g.sweep >= (50 * Math.PI) / 180 && g.r >= size * 0.04 && g.r <= size * 1.2)
    .sort((p, q) => q.sweep * q.r - p.sweep * p.r || p.cx - q.cx || p.cy - q.cy)
    .map(({ cx, cy, r, sweep }) => ({ cx, cy, r, sweep }));
}

/**
 * Edges on the same line added up (within 0.75° and 1.5 units); kept
 * when 8% of the mark's size or longer in total and not along a side of
 * its box; the longest first.
 *
 * @param {{ x1: number, y1: number, x2: number, y2: number }[]} edges
 * @param {{ x: number, y: number, width: number, height: number }} box
 * @returns {GuideLine[]}
 */
function lineGuides(edges, box) {
  const size = Math.max(box.width, box.height);
  /** @type {(GuideLine & { rho: number, best: number })[]} */
  const groups = [];
  for (const e of edges) {
    const length = Math.hypot(e.x2 - e.x1, e.y2 - e.y1);
    if (length < size * 0.02) continue;
    let angle = Math.atan2(e.y2 - e.y1, e.x2 - e.x1);
    if (angle < 0) angle += Math.PI;
    if (angle >= Math.PI - 1e-9) angle -= Math.PI;
    const x = (e.x1 + e.x2) / 2, y = (e.y1 + e.y2) / 2;
    const rho = -Math.sin(angle) * x + Math.cos(angle) * y;
    const g = groups.find((o) => {
      const da = Math.abs(o.angle - angle);
      const parallel = Math.min(da, Math.PI - da) < 0.013;
      // Across 0 and π the line's normal flips, so its offset does too.
      const apart = da < 0.013 ? Math.abs(o.rho - rho) : Math.abs(o.rho + rho);
      return parallel && apart <= 1.5;
    });
    if (!g) { groups.push({ angle, x, y, length, rho, best: length }); continue; }
    g.length += length;
    if (length > g.best) { g.best = length; g.x = x; g.y = y; }
  }
  const onSide = (/** @type {GuideLine} */ l) => {
    const flat = Math.min(l.angle, Math.PI - l.angle) < 0.013;
    const upright = Math.abs(l.angle - Math.PI / 2) < 0.013;
    return (flat && (Math.abs(l.y - box.y) < 1.5 || Math.abs(l.y - box.y - box.height) < 1.5))
      || (upright && (Math.abs(l.x - box.x) < 1.5 || Math.abs(l.x - box.x - box.width) < 1.5));
  };
  return groups
    .filter((g) => g.length >= size * 0.08 && !onSide(g))
    .sort((p, q) => q.length - p.length || p.angle - q.angle || p.rho - q.rho)
    .map(({ angle, x, y, length }) => ({ angle, x, y, length }));
}
