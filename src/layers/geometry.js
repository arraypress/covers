/**
 * Shape geometry for the `shape` layer: path data (or an element) and
 * bounds for each kind, and jittered edges for deckled, torn and zigzag
 * paper.
 *
 * @module layers/geometry
 */

import { attrs, num } from '@arraypress/image-effects/svg';
import { len } from '@arraypress/image-effects/length';
import { pos } from './util.js';
import { cutPath } from '../formats/cut.js';
import { invert, apply } from '../render/transform.js';


/**
 * Seeded jitter along a polyline, for deckled, torn or zigzag edges.
 *
 * @param {[number, number]} a @param {[number, number]} b
 * @param {{ kind: string, size: number, step: number }} e
 * @param {import('@arraypress/image-effects/rng').Rng} rng
 * @returns {[number, number][]} Points from a (exclusive) to b (inclusive).
 */
function edgePoints(a, b, e, rng) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(2, Math.round(L / e.step));
  const nx = -(b[1] - a[1]) / L;
  const ny = (b[0] - a[0]) / L;
  const out = /** @type {[number, number][]} */ ([]);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    let off = 0;
    if (i < n) {
      if (e.kind === 'zigzag') off = (i % 2 ? 1 : -1) * e.size / 2;
      else if (e.kind === 'wave') off = Math.sin(t * n * Math.PI) * e.size / 2;
      else if (e.kind === 'scallop') off = -Math.abs(Math.sin(t * n * Math.PI / 2)) * e.size;
      else off = (rng.next() - 0.5) * e.size * (e.kind === 'torn' ? 2 : 1);
    }
    out.push([a[0] + (b[0] - a[0]) * t + nx * off, a[1] + (b[1] - a[1]) * t + ny * off]);
  }
  return out;
}

/**
 * One shape's path data and bounds.
 *
 * @param {any} s - The shape.
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {{ d?: string, el?: string, box: { x: number, y: number, width: number, height: number } }}
 */
export function geometry(s, ctx) {
  const c = ctx.canvas;
  const X = (/** @type {any} */ v, /** @type {any} */ f = 0) => pos(v ?? f, 'x', c);
  const Y = (/** @type {any} */ v, /** @type {any} */ f = 0) => pos(v ?? f, 'y', c);
  const L = (/** @type {any} */ v, /** @type {any} */ f = 0) => len(v, c, f);
  const kind = s.kind ?? 'rect';
  const P = (/** @type {number} */ x, /** @type {number} */ y) => `${num(x)} ${num(y)}`;
  switch (kind) {
    case 'rect': {
      const x = X(s.x);
      const y = Y(s.y);
      const w = s.width != null ? X(s.width) : c.width - x;
      const h = s.height != null ? Y(s.height) : c.height - y;
      const box = { x, y, width: w, height: h };
      if (s.edge) {
        const e = typeof s.edge === 'string' ? { kind: s.edge } : s.edge;
        const size = L(e.size, e.kind === 'deckle' ? '0.6vmin' : '1.2vmin');
        const step = L(e.step, e.kind === 'zigzag' ? size : e.kind === 'deckle' ? '0.9vmin' : '2vmin');
        const sides = new Set(e.sides ?? ['top', 'right', 'bottom', 'left']);
        const corners = /** @type {[number, number][]} */ ([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]);
        const names = ['top', 'right', 'bottom', 'left'];
        let d = `M${P(x, y)}`;
        for (let k = 0; k < 4; k++) {
          const a = corners[k];
          const b = corners[(k + 1) % 4];
          if (sides.has(names[k])) for (const q of edgePoints(a, b, { kind: e.kind, size, step }, ctx.rng)) d += `L${P(q[0], q[1])}`;
          else d += `L${P(b[0], b[1])}`;
        }
        return { d: `${d}Z`, box };
      }
      return { el: `<rect${attrs({ x, y, width: w, height: h, rx: s.radius != null ? L(s.radius) : undefined })}`, box };
    }
    case 'circle': {
      const cx = X(s.cx, '50%');
      const cy = Y(s.cy, '50%');
      const r = L(s.r, '20vmin');
      return { el: `<circle${attrs({ cx, cy, r })}`, box: { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r } };
    }
    case 'ellipse': {
      const cx = X(s.cx, '50%');
      const cy = Y(s.cy, '50%');
      const rx = L(s.rx, '20vmin');
      const ry = L(s.ry, '12vmin');
      return { el: `<ellipse${attrs({ cx, cy, rx, ry })}`, box: { x: cx - rx, y: cy - ry, width: 2 * rx, height: 2 * ry } };
    }
    case 'line': {
      const x1 = X(s.x1);
      const y1 = Y(s.y1);
      const x2 = X(s.x2, '100%');
      const y2 = Y(s.y2, s.y1 ?? 0);
      return { d: `M${P(x1, y1)}L${P(x2, y2)}`, box: { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) } };
    }
    case 'polygon':
    case 'polyline': {
      const pts = (s.points ?? []).map((/** @type {any} */ q) => [X(q[0]), Y(q[1])]);
      const xs = pts.map((/** @type {number[]} */ q) => q[0]);
      const ys = pts.map((/** @type {number[]} */ q) => q[1]);
      return { d: pts.map((/** @type {number[]} */ q, /** @type {number} */ i) => `${i ? 'L' : 'M'}${P(q[0], q[1])}`).join('') + (kind === 'polygon' ? 'Z' : ''), box: { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) } };
    }
    case 'star':
    case 'burst':
    case 'scallop':
    case 'rays':
    case 'ring':
    case 'sector': {
      const cx = X(s.cx, '50%');
      const cy = Y(s.cy, '50%');
      const r = L(s.r, '20vmin');
      const rot = ((s.rotate ?? 0) * Math.PI) / 180;
      const box = { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r };
      const at = (/** @type {number} */ a, /** @type {number} */ rr) => P(cx + rr * Math.sin(a + rot), cy - rr * Math.cos(a + rot));
      if (kind === 'ring') {
        const r2 = L(s.inner, r * 0.6);
        return { d: `M${P(cx - r, cy)}a${num(r)} ${num(r)} 0 1 0 ${num(2 * r)} 0a${num(r)} ${num(r)} 0 1 0 ${num(-2 * r)} 0ZM${P(cx - r2, cy)}a${num(r2)} ${num(r2)} 0 1 1 ${num(2 * r2)} 0a${num(r2)} ${num(r2)} 0 1 1 ${num(-2 * r2)} 0Z`, box };
      }
      if (kind === 'sector') {
        // A pie slice, `start` to `end` degrees (0 at 12 o'clock, clockwise): quarter and half discs.
        const a0 = ((s.start ?? 0) * Math.PI) / 180;
        const a1 = ((s.end ?? 90) * Math.PI) / 180;
        const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
        return { d: `M${P(cx, cy)}L${at(a0, r)}A${num(r)} ${num(r)} 0 ${large} 1 ${at(a1, r)}Z`, box };
      }
      if (kind === 'rays') {
        const n = s.count ?? 24;
        let d = '';
        for (let i = 0; i < n; i += 2) {
          const a0 = (i / n) * Math.PI * 2;
          const a1 = ((i + 1) / n) * Math.PI * 2;
          d += `M${P(cx, cy)}L${at(a0, r)}L${at(a1, r)}Z`;
        }
        return { d, box };
      }
      if (kind === 'scallop') {
        const bumps = s.points ?? 12;
        const depth = L(s.depth, r * 0.08);
        let d = '';
        for (let deg = 0; deg <= 360; deg += 2) {
          const a = (deg * Math.PI) / 180;
          d += `${deg ? 'L' : 'M'}${at(a, r - depth + depth * Math.cos(a * bumps))}`;
        }
        return { d: `${d}Z`, box };
      }
      const n = s.points ?? (kind === 'burst' ? 16 : 5);
      const inner = s.inner != null ? (s.inner <= 1 ? r * s.inner : L(s.inner)) : r * (kind === 'burst' ? 0.8 : 0.42);
      let d = '';
      for (let i = 0; i < n * 2; i++) d += `${i ? 'L' : 'M'}${at((i / (n * 2)) * Math.PI * 2, i % 2 ? inner : r)}`;
      return { d: `${d}Z`, box };
    }
    case 'arch': {
      // A window: straight sides, a round top.
      const x = X(s.x);
      const y = Y(s.y);
      const w = X(s.width, '40%');
      const h = Y(s.height, '50%');
      const r = w / 2;
      // `open`: the arc and its sides only (a stroked arch).
      return { d: `M${P(x, y + h)}V${num(y + r)}A${num(r)} ${num(r)} 0 0 1 ${P(x + w, y + r)}V${num(y + h)}${s.open ? '' : 'Z'}`, box: { x, y, width: w, height: h } };
    }
    case 'wave': {
      const x1 = X(s.x1);
      const x2 = X(s.x2, '100%');
      const y = Y(s.y, '50%');
      const amp = L(s.amplitude, '2vmin');
      const wl = L(s.wavelength, '20vmin');
      const ph = s.phase ?? 0;
      let d = '';
      for (let x = x1, i = 0; x <= x2 + 0.01; x += Math.max(1, wl / 32), i++) d += `${i ? 'L' : 'M'}${P(x, y + Math.sin(((x - x1) / wl) * Math.PI * 2 + ph) * amp)}`;
      if (s.band) {
        const bh = L(s.band);
        let back = '';
        for (let x = x2; x >= x1 - 0.01; x -= Math.max(1, wl / 32)) back += `L${P(x, y + bh + Math.sin(((x - x1) / wl) * Math.PI * 2 + ph) * amp)}`;
        d += `${back}Z`;
      }
      return { d, box: { x: x1, y: y - amp, width: x2 - x1, height: 2 * amp } };
    }
    case 'path': {
      // Path data, optionally drawn from a viewBox into a box (x, y, width, height).
      const d = String(s.d ?? '');
      if (s.viewBox) {
        const [vx, vy, vw, vh] = s.viewBox;
        const x = X(s.x);
        const y = Y(s.y);
        const w = s.width != null ? X(s.width) : vw;
        const h = s.height != null ? Y(s.height) : (w / vw) * vh;
        return { d, box: { x, y, width: w, height: h }, el: undefined, ...{ transform: `translate(${num(x)} ${num(y)}) scale(${num(w / vw, 5)} ${num(h / vh, 5)}) translate(${num(-vx)} ${num(-vy)})` } };
      }
      return { d, box: { x: 0, y: 0, width: c.width, height: c.height } };
    }
    case 'cut': {
      // The print format's die-cut (the trim's corners or shape), in this layer's units.
      return cutGeometry(/** @type {any} */ (ctx).cut, L(s.outset, 0), /** @type {any} */ (ctx).matrix, c);
    }
    default:
      throw new TypeError(`Unknown shape kind "${kind}" (rect, circle, ellipse, line, polygon, polyline, star, burst, scallop, rays, ring, sector, arch, wave, path, cut)`);
  }
}

/**
 * The cut outline, from canvas px into the layer's units (through the
 * inverse of everything drawn above it). Without a print format, the canvas.
 *
 * @param {{ x: number, y: number, width: number, height: number, cut?: any, mm?: number } | undefined} cut - Trim box and cut, canvas px.
 * @param {number} outset - Grow (or, negative, shrink) the outline, in the layer's units.
 * @param {import('../render/transform.js').Affine | undefined} matrix - Layer units to canvas px.
 * @param {{ width: number, height: number }} canvas
 * @returns {{ d: string, box: { x: number, y: number, width: number, height: number } }}
 */
function cutGeometry(cut, outset, matrix, canvas) {
  const inv = matrix ? invert(matrix) : undefined;
  const k = matrix ? Math.sqrt(Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2])) : 1;
  const trim = cut ?? { x: 0, y: 0, width: canvas.width * k, height: canvas.height * k };
  const o = outset * k;
  const box = { x: trim.x - o, y: trim.y - o, width: trim.width + 2 * o, height: trim.height + 2 * o };
  const segs = cutPath(cut?.cut, box, (cut?.mm ?? 1) * 1, o);
  const at = (/** @type {number} */ x, /** @type {number} */ y) => (inv ? apply(inv, x, y) : [x, y]);
  let d = '';
  const xs = [];
  const ys = [];
  for (const seg of segs) {
    d += seg.cmd;
    for (let i = 0; i < seg.pts.length; i += 2) {
      const [X, Y] = at(seg.pts[i], seg.pts[i + 1]);
      xs.push(X); ys.push(Y);
      d += `${i ? ' ' : ''}${num(X)} ${num(Y)}`;
    }
  }
  return { d, box: { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) } };
}
