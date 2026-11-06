/**
 * Isolines of a sampled field (marching squares) and a mark's signed
 * distance field, for contour lines drawn round a mark.
 *
 * @module layers/isolines
 */

import { fill, distance } from '@logomarks/core/raster';

/**
 * @typedef {object} DistanceField
 * @property {Float32Array} values - Signed distance in mark units, row by row: positive outside the mark, negative inside.
 * @property {number} width - Samples across.
 * @property {number} height - Samples down.
 * @property {number} x0 - The mark x of the first column's centre.
 * @property {number} y0 - The mark y of the first row's centre.
 * @property {number} step - Mark units between samples.
 */

/**
 * A mark's signed distance field over its box plus `reach` round it,
 * `samples` across its longest side. Its rings are filled and measured by
 * `@logomarks/core`'s scanline fill and Euclidean distance transform; that
 * measures to pixel centres, so where a line will be traced (samples near
 * one of `levels`) the distance is then measured exactly, to the rings'
 * edges, and the lines come out smooth.
 *
 * @param {import('./mark-geometry.js').MarkGeometry} geo
 * @param {number} reach - Mark units round the box the field must cover.
 * @param {number[]} [levels] - The distances lines will be traced at (mark units).
 * @param {number} [samples=500]
 * @returns {DistanceField}
 */
export function distanceField(geo, reach, levels = [], samples = 500) {
  const { box } = geo;
  const scale = samples / Math.max(box.width, box.height);
  const pad = reach + 4 / scale;
  const frame = {
    x0: box.x - pad,
    y0: box.y - pad,
    scale,
    width: Math.ceil((box.width + 2 * pad) * scale),
    height: Math.ceil((box.height + 2 * pad) * scale),
  };
  const bm = fill(geo.paths, frame);
  const out = distance(bm, 0);
  const inside = distance(bm, 1);
  const values = new Float32Array(out.length);
  // Pixel centres: half a pixel either side of the edge between ink and empty.
  for (let i = 0; i < values.length; i++) values[i] = (bm.data[i] ? 0.5 - inside[i] : out[i] - 0.5) / scale;
  const x0 = frame.x0 + 0.5 / scale;
  const y0 = frame.y0 + 0.5 / scale;
  if (levels.length) exactNear(values, frame.width, { x0, y0, step: 1 / scale }, geo, levels);
  return { values, width: frame.width, height: frame.height, x0, y0, step: 1 / scale };
}

/**
 * Measure the samples within two samples of a level exactly: the distance
 * to the nearest edge of the mark's rings, its sign kept. Edges are binned
 * so each sample looks only at those within its rough distance.
 *
 * @param {Float32Array} values - Rough signed distances (changed).
 * @param {number} w - Samples across.
 * @param {{ x0: number, y0: number, step: number }} at - Where the samples are.
 * @param {import('./mark-geometry.js').MarkGeometry} geo
 * @param {number[]} levels
 */
function exactNear(values, w, { x0, y0, step }, geo, levels) {
  /** @type {number[]} x1, y1, x2, y2 per edge */
  const edges = [];
  for (const p of geo.paths) {
    for (const ring of p.rings) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i + 1) % ring.length];
        if (a[0] !== b[0] || a[1] !== b[1]) edges.push(a[0], a[1], b[0], b[1]);
      }
    }
  }
  const { box } = geo;
  const size = Math.max(box.width, box.height);
  const cell = size / 32;
  const bx = box.x - size, by = box.y - size;
  const cols = Math.ceil((box.width + 2 * size) / cell);
  const rows = Math.ceil((box.height + 2 * size) / cell);
  /** @type {number[][]} */
  const bins = Array.from({ length: cols * rows }, () => []);
  for (let e = 0; e < edges.length; e += 4) {
    const c0 = Math.floor((Math.min(edges[e], edges[e + 2]) - bx) / cell), c1 = Math.floor((Math.max(edges[e], edges[e + 2]) - bx) / cell);
    const r0 = Math.floor((Math.min(edges[e + 1], edges[e + 3]) - by) / cell), r1 = Math.floor((Math.max(edges[e + 1], edges[e + 3]) - by) / cell);
    for (let r = Math.max(0, r0); r <= Math.min(rows - 1, r1); r++) for (let c = Math.max(0, c0); c <= Math.min(cols - 1, c1); c++) bins[r * cols + c].push(e);
  }
  const band = 2 * step;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!levels.some((l) => Math.abs(v - l) <= band)) continue;
    const x = x0 + (i % w) * step, y = y0 + Math.floor(i / w) * step;
    // The nearest edge is no further than the rough distance and a sample or two.
    const R = Math.abs(v) + band;
    let best = R * R;
    const c0 = Math.max(0, Math.floor((x - R - bx) / cell)), c1 = Math.min(cols - 1, Math.floor((x + R - bx) / cell));
    const r0 = Math.max(0, Math.floor((y - R - by) / cell)), r1 = Math.min(rows - 1, Math.floor((y + R - by) / cell));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        for (const e of bins[r * cols + c]) {
          const ax = edges[e], ay = edges[e + 1], dx = edges[e + 2] - ax, dy = edges[e + 3] - ay;
          const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
          const ex = ax + t * dx - x, ey = ay + t * dy - y;
          const d2 = ex * ex + ey * ey;
          if (d2 < best) best = d2;
        }
      }
    }
    values[i] = Math.sign(v || 1) * Math.sqrt(best);
  }
}

/**
 * The lines where a field crosses `level`, as polylines of sample
 * coordinates (`[column, row]`), closed ones ending on their first point.
 * Marching squares, saddles split by the cell's mean; crossings are
 * chained by the grid edge they sit on, so the joins are exact.
 *
 * @param {ArrayLike<number>} f - Values row by row.
 * @param {number} w - Columns.
 * @param {number} h - Rows.
 * @param {number} level
 * @returns {number[][][]}
 *
 * @example
 * isolines([0, 0, 0, 0, 1, 0, 0, 0, 0], 3, 3, 0.5); // one closed diamond round the middle sample
 */
export function isolines(f, w, h, level) {
  // Edge ids: horizontal (i, j)–(i + 1, j) is j·w + i; vertical (i, j)–(i, j + 1) is w·h + j·w + i.
  const V = w * h;
  /** @type {Map<number, number[]>} */
  const at = new Map();
  /** @type {number[][]} */
  const segs = [];
  const link = (/** @type {number} */ a, /** @type {number} */ b) => {
    const s = segs.push([a, b]) - 1;
    for (const e of [a, b]) {
      const list = at.get(e);
      if (list) list.push(s); else at.set(e, [s]);
    }
  };
  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const a = f[j * w + i] - level;
      const b = f[j * w + i + 1] - level;
      const c = f[(j + 1) * w + i + 1] - level;
      const d = f[(j + 1) * w + i] - level;
      const code = (a > 0 ? 8 : 0) | (b > 0 ? 4 : 0) | (c > 0 ? 2 : 0) | (d > 0 ? 1 : 0);
      if (code === 0 || code === 15) continue;
      const top = j * w + i;
      const bottom = (j + 1) * w + i;
      const left = V + j * w + i;
      const right = V + j * w + i + 1;
      const mid = a + b + c + d > 0;
      switch (code) {
        case 1: case 14: link(left, bottom); break;
        case 2: case 13: link(bottom, right); break;
        case 3: case 12: link(left, right); break;
        case 4: case 11: link(top, right); break;
        case 6: case 9: link(top, bottom); break;
        case 7: case 8: link(left, top); break;
        case 5: if (mid) { link(left, top); link(bottom, right); } else { link(left, bottom); link(top, right); } break;
        case 10: if (mid) { link(left, bottom); link(top, right); } else { link(left, top); link(bottom, right); } break;
      }
    }
  }
  const point = (/** @type {number} */ e) => {
    if (e < V) {
      const i = e % w, j = Math.floor(e / w);
      const p = f[e] - level, q = f[e + 1] - level;
      return [i + p / (p - q), j];
    }
    const k = e - V, i = k % w, j = Math.floor(k / w);
    const p = f[k] - level, q = f[k + w] - level;
    return [i, j + p / (p - q)];
  };
  const used = new Uint8Array(segs.length);
  /** @type {number[][][]} */
  const out = [];
  for (let s = 0; s < segs.length; s++) {
    if (used[s]) continue;
    used[s] = 1;
    const edges = [segs[s][0], segs[s][1]];
    for (const forward of [true, false]) {
      for (;;) {
        const tip = forward ? edges[edges.length - 1] : edges[0];
        const next = (at.get(tip) ?? []).find((n) => !used[n]);
        if (next === undefined) break;
        used[next] = 1;
        const other = segs[next][0] === tip ? segs[next][1] : segs[next][0];
        if (forward) edges.push(other); else edges.unshift(other);
      }
    }
    if (edges.length > 2) out.push(edges.map(point));
  }
  return out;
}

/**
 * A polyline simplified within `tol` (Douglas-Peucker; a closed one split
 * at its farthest point so both halves keep their ends), then smoothed by
 * two rounds of Chaikin (corners rounded by at most `round`), as path data.
 *
 * @param {number[][]} pts - Canvas units; closed when the last is the first.
 * @param {number} [tol=0.25]
 * @param {number} [round=0.6]
 * @returns {string}
 */
export function smoothLine(pts, tol = 0.25, round = 0.6) {
  const first = pts[0];
  const last = pts[pts.length - 1];
  const closed = pts.length > 3 && Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-9;
  /** @type {number[][]} */
  let p;
  if (closed) {
    let far = 0, fd = -1;
    pts.forEach((q, i) => { const d = Math.hypot(q[0] - first[0], q[1] - first[1]); if (d > fd) { fd = d; far = i; } });
    p = [...simplify(pts.slice(0, far + 1), tol).slice(0, -1), ...simplify(pts.slice(far), tol).slice(0, -1)];
    if (p.length < 3) return '';
  } else {
    p = simplify(pts, tol);
  }
  // Chaikin, twice: each edge cut a quarter of the way in from both ends (a
  // closed ring wraps round), but never more than `round` from a corner, so a
  // long straight run meeting a sharp cusp keeps its point instead of a bevel.
  let q = p;
  for (const r of [round, round / 2]) {
    const n = q.length;
    const next = closed ? [] : [q[0]];
    for (let i = 0; i < (closed ? n : n - 1); i++) {
      const a = q[i], b = q[(i + 1) % n];
      const t = Math.min(0.25, r / (Math.hypot(b[0] - a[0], b[1] - a[1]) || 1));
      next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], [b[0] + (a[0] - b[0]) * t, b[1] + (a[1] - b[1]) * t]);
    }
    if (!closed) next.push(q[n - 1]);
    q = next;
  }
  const f = (/** @type {number} */ v) => (Math.round(v * 100) / 100).toString();
  return `M${q.map((pt) => `${f(pt[0])} ${f(pt[1])}`).join('L')}${closed ? 'Z' : ''}`;
}

/**
 * Douglas-Peucker on an open run: points within `tol` of the line between
 * the kept ones go; the ends stay.
 *
 * @param {number[][]} pts
 * @param {number} tol
 * @returns {number[][]}
 */
function simplify(pts, tol) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = /** @type {number[]} */ (stack.pop());
    const [ax, ay] = pts[i], [bx, by] = pts[j];
    const L = Math.hypot(bx - ax, by - ay) || 1e-12;
    let far = -1, fd = tol;
    for (let k = i + 1; k < j; k++) {
      const d = L > 1e-9 ? Math.abs((bx - ax) * (ay - pts[k][1]) - (ax - pts[k][0]) * (by - ay)) / L : Math.hypot(pts[k][0] - ax, pts[k][1] - ay);
      if (d > fd) { fd = d; far = k; }
    }
    if (far >= 0) { keep[far] = 1; stack.push([i, far], [far, j]); }
  }
  return pts.filter((_, k) => keep[k]);
}
