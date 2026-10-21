/**
 * Hand-made layers: cut paper and hand-drawn lines.
 *
 * - `paper`    flat shapes with scissor-cut edges: the outline is resampled
 *              into short straight cuts and each cut point nudged off the
 *              line (seeded), so edges are irregular but never blurry.
 * - `scribble` an icon re-drawn by hand (its outline flattened, wobbled with
 *              smooth seeded noise and stroked at a varying width with round
 *              caps), or a small node graph: a polyline with filled dots.
 *
 * @module handmade
 */

import { attrs, num, layerAttrs } from './svg.js';
import { len, regionPx } from './geometry.js';
import { toHex } from './color.js';
import { resolveIcon, parseSvgIcon } from './icons.js';
import { flattenBody, densify } from './flatten.js';

/** Off-white paper. */
export const PAPER = '#faf9f5';
/** Near-black ink. */
export const INK = '#141413';

/**
 * Smooth 1D value noise from a seeded stream: `noise(t)` in [-1, 1].
 *
 * @param {import('./rng.js').Rng} rng
 * @returns {(t: number) => number}
 */
function noise1(rng) {
  const knots = Array.from({ length: 64 }, () => rng.range(-1, 1));
  return (t) => {
    const i = Math.floor(t);
    const f = t - i;
    const a = knots[((i % 64) + 64) % 64];
    const b = knots[(((i + 1) % 64) + 64) % 64];
    const e = f * f * (3 - 2 * f);
    return a + (b - a) * e;
  };
}

/**
 * Resample a closed outline into scissor cuts: points every `cut` px, each
 * nudged by up to `wobble` px across the edge.
 *
 * @param {[number, number][]} outline - A closed polyline (first point not repeated).
 * @param {number} cut - Cut length in px.
 * @param {number} wobble - Max nudge in px.
 * @param {import('./rng.js').Rng} rng
 * @returns {string} Path data.
 */
function scissor(outline, cut, wobble, rng) {
  const pts = densify([...outline, outline[0]], cut / 6);
  /** @type {[number, number][]} */
  const out = [];
  let acc = cut;
  for (let i = 1; i < pts.length; i++) {
    acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc >= cut * rng.range(0.6, 1.4)) {
      acc = 0;
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const l = Math.hypot(x1 - x0, y1 - y0) || 1;
      const k = rng.range(-wobble, wobble);
      out.push([x1 + (-(y1 - y0) / l) * k, y1 + ((x1 - x0) / l) * k]);
    }
  }
  return `M${out.map(([x, y]) => `${num(x)} ${num(y)}`).join('L')}Z`;
}

/**
 * A shape's outline, centred on the origin.
 *
 * @param {string} kind - rect | square | circle | blob | arch | pill
 * @param {number} w @param {number} h
 * @param {import('./rng.js').Rng} rng
 * @returns {[number, number][]}
 */
function outlineOf(kind, w, h, rng) {
  const ellipse = (rx, ry, bump = 0) => {
    const n = 72;
    const wave = noise1(rng);
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const r = 1 + bump * wave((i / n) * 5);
      return /** @type {[number, number]} */ ([Math.cos(a) * rx * r, Math.sin(a) * ry * r]);
    });
  };
  if (kind === 'circle') return ellipse(w / 2, h / 2);
  if (kind === 'blob') return ellipse(w / 2, h / 2, 0.16);
  if (kind === 'pill') {
    const r = Math.min(w, h) / 2;
    const pts = [];
    for (let i = 0; i <= 18; i++) { const a = -Math.PI / 2 + (i / 18) * Math.PI; pts.push([w / 2 - r + Math.cos(a) * r, Math.sin(a) * r]); }
    for (let i = 0; i <= 18; i++) { const a = Math.PI / 2 + (i / 18) * Math.PI; pts.push([-w / 2 + r + Math.cos(a) * r, Math.sin(a) * r]); }
    return /** @type {[number, number][]} */ (pts);
  }
  if (kind === 'arch') {
    const r = w / 2;
    const pts = [[w / 2, h / 2], [-w / 2, h / 2]];
    for (let i = 0; i <= 24; i++) { const a = Math.PI + (i / 24) * Math.PI; pts.push([Math.cos(a) * r, -h / 2 + r + Math.sin(a) * r]); }
    return /** @type {[number, number][]} */ (pts);
  }
  // rect / square: corners slightly off-true, as if cut by eye.
  const j = () => rng.range(-0.04, 0.04) * Math.min(w, h);
  return [[-w / 2 + j(), -h / 2 + j()], [w / 2 + j(), -h / 2 + j()], [w / 2 + j(), h / 2 + j()], [-w / 2 + j(), h / 2 + j()]];
}

/**
 * The `paper` layer.
 *
 * @param {import('./index.js').PaperLayer} layer
 * @param {import('./layers.js').RenderContext} ctx
 * @returns {import('./layers.js').Markup}
 */
export function paper(layer, ctx) {
  const { rng } = ctx;
  const r = regionPx(layer.region ?? { x: 0.2, y: 0.2, width: 0.6, height: 0.6 }, ctx.canvas);
  const fill = layer.color ? toHex(layer.color) : PAPER;
  const kinds = layer.kind && layer.kind !== 'mixed' ? [layer.kind] : ['rect', 'blob', 'arch', 'square', 'circle', 'pill'];
  const wob = layer.wobble ?? 0.5;

  /** @type {{ kind: string, x: number, y: number, w: number, h: number, rot: number, color: string }[]} */
  let items;
  if (layer.items?.length) {
    items = layer.items.map((it, i) => ({
      kind: it.kind ?? kinds[i % kinds.length],
      x: r.x + (it.x ?? 0.5) * r.width,
      y: r.y + (it.y ?? 0.5) * r.height,
      w: len(it.width ?? it.size, ctx.canvas, r.width * 0.4),
      h: len(it.height ?? it.size, ctx.canvas, r.height * 0.4),
      rot: it.rotate ?? rng.range(-4, 4),
      color: it.color ? toHex(it.color) : fill,
    }));
  } else {
    // A loose collage: cells of a small grid, each shape filling most of its cell.
    const count = layer.count ?? 4;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const cw = r.width / cols;
    const ch = r.height / rows;
    items = [];
    for (let i = 0; i < count; i++) {
      const kind = kinds[rng.int(0, kinds.length - 1)];
      const sq = kind === 'square' || kind === 'circle';
      const fw = cw * rng.range(0.72, 1.02);
      const fh = sq ? Math.min(fw, ch * 1.02) : ch * rng.range(0.72, 1.02);
      items.push({
        kind,
        x: r.x + cw * ((i % cols) + 0.5) + rng.range(-0.08, 0.08) * cw,
        y: r.y + ch * (Math.floor(i / cols) + 0.5) + rng.range(-0.08, 0.08) * ch,
        w: sq ? Math.min(fw, fh) : fw,
        h: sq ? Math.min(fw, fh) : fh,
        rot: rng.range(-5, 5),
        color: fill,
      });
    }
  }
  const body = items.map((it) => {
    const size = Math.min(it.w, it.h);
    const d = scissor(outlineOf(it.kind, it.w, it.h, rng), Math.max(4, size * 0.09), wob * size * 0.018, rng);
    return `<path${attrs({ d, fill: it.color, transform: `translate(${num(it.x)} ${num(it.y)}) rotate(${num(it.rot)})` })}/>`;
  }).join('');
  const a = attrs(layerAttrs(layer));
  return { defs: '', body: a ? `<g${a}>${body}</g>` : body };
}

/**
 * Stroke a polyline by hand: wobbled by smooth noise, drawn in short
 * overlapping runs whose widths drift, with round caps.
 *
 * @param {[number, number][]} pts - Points in px.
 * @param {object} o
 * @param {number} o.width - Base stroke width.
 * @param {number} o.amp - Wobble amplitude in px.
 * @param {number} o.period - Wobble period in px.
 * @param {string} o.color
 * @param {import('./rng.js').Rng} o.rng
 * @returns {string} Markup.
 */
function handLine(pts, { width, amp, period, color, rng }) {
  const nx = noise1(rng);
  const ny = noise1(rng);
  const nw = noise1(rng);
  const off = rng.range(0, 64);
  let s = 0;
  const moved = pts.map((p, i) => {
    if (i) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
    return /** @type {[number, number, number]} */ ([p[0] + nx(off + s / period) * amp, p[1] + ny(off + s / period) * amp, s]);
  });
  let out = '';
  const run = Math.max(3, Math.round(moved.length / Math.max(3, s / (period * 0.8))));
  for (let i = 0; i < moved.length - 1; i += run) {
    const chunk = moved.slice(i, Math.min(moved.length, i + run + 1));
    const wdt = width * (0.82 + 0.3 * nw(off + chunk[0][2] / (period * 1.5)));
    out += `<path${attrs({ d: `M${chunk.map(([x, y]) => `${num(x)} ${num(y)}`).join('L')}`, 'stroke-width': num(wdt) })}/>`;
  }
  return `<g${attrs({ fill: 'none', stroke: color, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })}>${out}</g>`;
}

/**
 * The `scribble` layer.
 *
 * @param {import('./index.js').ScribbleLayer} layer
 * @param {import('./layers.js').RenderContext} ctx
 * @returns {import('./layers.js').Markup}
 */
export function scribble(layer, ctx) {
  const { rng, width: w, height: h } = ctx;
  const size = len(layer.size, ctx.canvas, '46vmin');
  const cx = (layer.position?.x ?? 0.5) * w;
  const cy = (layer.position?.y ?? 0.5) * h;
  const color = layer.color ? toHex(layer.color) : PAPER;
  const stroke = len(layer.stroke, ctx.canvas, '1.3vmin');
  const wob = layer.wobble ?? 0.5;
  let body = '';

  if (layer.graph) {
    const g = layer.graph === true ? {} : layer.graph;
    const n = Math.max(2, Math.min(9, g.nodes ?? rng.int(4, 6)));
    // Nodes on a jittered lattice so the graph spans the box without clumping.
    const pts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + rng.range(-0.5, 0.5);
      const rr = size * 0.5 * rng.range(0.35, 1);
      return /** @type {[number, number]} */ ([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    });
    pts.sort((p, q) => p[0] - q[0]);
    const path = [pts[0]];
    for (let i = 1; i < n; i++) path.push(pts[i]);
    const lines = [densify(path, size * 0.03)];
    if (n > 3) lines.push(densify([pts[1], pts[n - 1]], size * 0.03));
    for (const l of lines) body += handLine(l, { width: stroke, amp: wob * size * 0.006, period: size * 0.12, color, rng });
    const r = stroke * (g.dot ?? 1.25);
    body += pts.map(([x, y]) => `<circle${attrs({ cx: x, cy: y, r: r * rng.range(0.9, 1.15), fill: color })}/>`).join('');
  } else {
    const icon = layer.icon;
    const data = typeof icon === 'string' && icon.trim().startsWith('<') ? parseSvgIcon(icon) : typeof icon === 'string' && icon ? resolveIcon(icon) : null;
    const src = data ?? { body: `<path d="${SPARK_PATH}"/>`, viewBox: [0, 0, 24, 24] };
    const [vx, vy, vw, vh] = src.viewBox;
    const k = size / Math.max(vw, vh);
    const flat = flattenBody(src.body, Math.max(vw, vh) / 90);
    for (const line of flat.lines) {
      const pts = line.map(([x, y]) => /** @type {[number, number]} */ ([cx + (x - vx - vw / 2) * k, cy + (y - vy - vh / 2) * k]));
      body += handLine(pts, { width: stroke, amp: wob * size * 0.01, period: size * 0.16, color, rng });
    }
  }
  const a = attrs(layerAttrs(layer));
  return { defs: '', body: a ? `<g${a}>${body}</g>` : body };
}

/** The spark, as an outline to trace when no icon is given. */
const SPARK_PATH = 'M12 2c.4 4.9 2.1 7.6 7 8.6l3 .4-3 .4c-4.9 1-6.6 3.7-7 8.6-.4-4.9-2.1-7.6-7-8.6L2 11l3-.4c4.9-1 6.6-3.7 7-8.6Z';
