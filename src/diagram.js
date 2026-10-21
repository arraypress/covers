/**
 * The `diagram` layer: white line-art over a field (the engineering-blog
 * look). One icon, or a few nodes (icons in outlined square or circle
 * tiles) joined by arrows, with an optional dotted grid that breaks around
 * the drawing instead of running through it.
 *
 * Layouts (node centres, relative to `position`):
 *
 * - `single`   one node
 * - `row`      2–4 nodes side by side; `arrows: 'loop'` adds an elbow back from the last to the first
 * - `triangle` one on top, two below; arrows from the top to each (`'both'`: there and back)
 * - `square`   four corners, arrows round the cycle; a fifth node sits in the middle with dotted spokes and corner brackets
 * - `stack`    two on top merging into one below
 * - `hub`      a large first node with the rest around its edge, knocked out of it (a globe with databases)
 *
 * Everything is stroked in one colour at one width; stroke icons (Lucide)
 * are rescaled so their lines match the tiles' lines.
 *
 * @module diagram
 */

import { attrs, num, layerAttrs } from './svg.js';
import { len } from './geometry.js';
import { toHex } from './color.js';
import { resolveIcon, parseSvgIcon } from './icons.js';
import { gridPath } from './grid.js';

/** A four-point spark: the glyph for a node with no icon. */
const SPARK = 'M12 2c.4 4.9 2.1 7.6 7 8.6l3 .4-3 .4c-4.9 1-6.6 3.7-7 8.6-.4-4.9-2.1-7.6-7-8.6L2 11l3-.4c4.9-1 6.6-3.7 7-8.6Z';

/**
 * Resolve a node's icon to markup + viewBox.
 *
 * @param {string | undefined} icon - Iconify name, raw SVG, or nothing (the spark).
 * @returns {{ body: string, viewBox: number[] }}
 */
function iconData(icon) {
  if (typeof icon === 'string' && icon.trim().startsWith('<')) return parseSvgIcon(icon);
  if (typeof icon === 'string' && icon) return resolveIcon(icon);
  return { body: `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" d="${SPARK}"/>`, viewBox: [0, 0, 24, 24] };
}

/**
 * An open arrowhead (two strokes) at `to`, pointing away from `from`.
 *
 * @param {[number, number]} from @param {[number, number]} to
 * @param {number} size - Arm length.
 * @returns {string} Path data.
 */
function head(from, to, size) {
  const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const arm = (t) => [to[0] - size * Math.cos(a + t), to[1] - size * Math.sin(a + t)];
  const [l, r] = [arm(0.55), arm(-0.55)];
  return `M${num(l[0])} ${num(l[1])}L${num(to[0])} ${num(to[1])}L${num(r[0])} ${num(r[1])}`;
}

/**
 * The `diagram` layer.
 *
 * @param {import('./index.js').DiagramLayer} layer
 * @param {import('./layers.js').RenderContext} ctx
 * @returns {import('./layers.js').Markup}
 */
export function diagram(layer, ctx) {
  const { width: w, height: h } = ctx;
  const nodesIn = layer.nodes?.length ? layer.nodes : [{ icon: layer.icon, shape: layer.shape ?? (layer.icon ? 'none' : 'square') }];
  const n = nodesIn.length;
  const layout = layer.layout ?? (n === 1 ? 'single' : n === 3 && layer.arrows === 'merge' ? 'stack' : n === 4 && layer.arrows === 'cycle' ? 'square' : 'row');
  const vmin = Math.min(w, h) / 100;
  const defaultSize = { single: nodesIn[0].shape === 'none' ? 40 : 22, row: n >= 4 ? 15 : 19, triangle: 19, square: 12, stack: 18, hub: 13 }[layout] ?? 18;
  const s = len(layer.size, ctx.canvas, defaultSize * vmin);
  const gap = len(layer.gap, ctx.canvas, s * 0.45);
  const stroke = len(layer.stroke, ctx.canvas, '0.3vmin');
  const col = layer.color ? toHex(layer.color) : '#ffffff';
  const cx = (layer.position?.x ?? 0.5) * w;
  const cy = (layer.position?.y ?? 0.5) * h;
  const radius = len(layer.radius, ctx.canvas, s * 0.14);
  const ah = Math.max(stroke * 3.5, s * 0.09);
  const pad = s * 0.1;

  // Node centres and sizes.
  const d = s + gap;
  /** @type {{ x: number, y: number, size: number, shape: string, icon?: string, brackets?: boolean, knock?: boolean }[]} */
  const nodes = nodesIn.map((nd, i) => {
    let x = 0;
    let y = 0;
    let size = nd.size != null ? len(nd.size, ctx.canvas) : s;
    if (layout === 'row') x = (i - (n - 1) / 2) * d;
    else if (layout === 'triangle') [x, y] = [[0, -d * 0.52], [-d * 0.6, d * 0.5], [d * 0.6, d * 0.5]][i] ?? [0, 0];
    else if (layout === 'square') {
      const half = (s + gap * 2.6) / 2 + s * 0.6;
      [x, y] = [[-half, -half], [half, -half], [half, half], [-half, half], [0, 0]][i] ?? [0, 0];
    } else if (layout === 'stack') [x, y] = [[-d * 0.58, -d * 0.5], [d * 0.58, -d * 0.5], [0, d * 0.55]][i] ?? [0, 0];
    else if (layout === 'hub') {
      if (i === 0) size = nd.size != null ? len(nd.size, ctx.canvas) : s * 3;
      else {
        const big = nodesIn[0].size != null ? len(nodesIn[0].size, ctx.canvas) : s * 3;
        const spots = [[-1, -0.15], [1, -0.15], [0, 0.95], [0, -1]];
        const [ux, uy] = spots[(i - 1) % spots.length];
        [x, y] = [(ux * big) / 2, (uy * big) / 2];
      }
    }
    return {
      x: cx + x,
      y: cy + y,
      size,
      shape: nd.shape ?? (layout === 'hub' ? 'none' : layout === 'square' ? 'circle' : 'square'),
      icon: nd.icon,
      brackets: nd.brackets ?? (layout === 'square' && i === 4),
      knock: layout === 'hub' && i > 0,
    };
  });

  /** The point on a node's outline toward another point, padded. */
  const edge = (/** @type {typeof nodes[number]} */ nd, /** @type {[number, number]} */ toward) => {
    const dx = toward[0] - nd.x;
    const dy = toward[1] - nd.y;
    const r = nd.size / 2 + pad;
    if (nd.shape === 'circle' || nd.shape === 'none') {
      const l = Math.hypot(dx, dy) || 1;
      return /** @type {[number, number]} */ ([nd.x + (dx / l) * r, nd.y + (dy / l) * r]);
    }
    const t = r / Math.max(Math.abs(dx), Math.abs(dy), 1e-6);
    return /** @type {[number, number]} */ ([nd.x + dx * t, nd.y + dy * t]);
  };

  const lines = [];
  const dotted = [];
  /** @param {number} a @param {number} b @param {number} [offset] - Perpendicular shift (for there-and-back pairs). */
  const arrow = (a, b, offset = 0) => {
    const A = nodes[a];
    const B = nodes[b];
    let p = edge(A, [B.x, B.y]);
    let q = edge(B, [A.x, A.y]);
    if (offset) {
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      const [ox, oy] = [(-(q[1] - p[1]) / l) * offset, ((q[0] - p[0]) / l) * offset];
      p = [p[0] + ox, p[1] + oy];
      q = [q[0] + ox, q[1] + oy];
    }
    lines.push(`M${num(p[0])} ${num(p[1])}L${num(q[0])} ${num(q[1])}${head(p, q, ah)}`);
  };

  const mode = layer.arrows ?? (layout === 'single' || layout === 'hub' ? false : layout === 'square' ? 'cycle' : true);
  if (mode) {
    if (layout === 'row') {
      for (let i = 0; i < n - 1; i++) arrow(i, i + 1);
      if (mode === 'loop' && n > 1) {
        // An elbow under the row, from the last node back to the first.
        const A = nodes[n - 1];
        const B = nodes[0];
        const top = A.y + A.size / 2 + pad;
        const low = top + gap * 1.1;
        const r = Math.min(gap * 0.35, s * 0.15);
        lines.push(`M${num(A.x)} ${num(top)}V${num(low - r)}Q${num(A.x)} ${num(low)} ${num(A.x - r)} ${num(low)}H${num(B.x + r)}Q${num(B.x)} ${num(low)} ${num(B.x)} ${num(low - r)}V${num(top)}${head([B.x, top + 1], [B.x, top], ah)}`);
      }
    } else if (layout === 'triangle') {
      const off = mode === 'both' ? s * 0.12 : 0;
      for (const b of [1, 2]) {
        if (nodes[b]) {
          arrow(0, b, off);
          if (mode === 'both') arrow(b, 0, off);
        }
      }
    } else if (layout === 'square') {
      for (let i = 0; i < Math.min(4, n); i++) arrow(i, (i + 1) % Math.min(4, n));
      if (n > 4) {
        const C = nodes[4];
        for (let i = 0; i < 4; i++) {
          const p = edge(C, [nodes[i].x, nodes[i].y]);
          const q = edge(nodes[i], [C.x, C.y]);
          dotted.push(`M${num(p[0])} ${num(p[1])}L${num(q[0])} ${num(q[1])}`);
        }
      }
    } else if (layout === 'stack' && n >= 3) {
      const [L, R, B] = nodes;
      const top = L.y + L.size / 2 + pad;
      const mid = (top + (B.y - B.size / 2 - pad)) / 2;
      const r = Math.min(gap * 0.3, s * 0.12);
      lines.push(`M${num(L.x)} ${num(top)}V${num(mid - r)}Q${num(L.x)} ${num(mid)} ${num(L.x + r)} ${num(mid)}H${num(R.x - r)}Q${num(R.x)} ${num(mid)} ${num(R.x)} ${num(mid - r)}V${num(top)}`);
      const end = B.y - B.size / 2 - pad;
      lines.push(`M${num(B.x)} ${num(mid)}V${num(end)}${head([B.x, end - 1], [B.x, end], ah)}`);
    }
  }

  // Tiles, icons, brackets.
  let tiles = '';
  /** @type {string[]} */
  const icons = [];
  let knockouts = '';
  for (const nd of nodes) {
    const half = nd.size / 2;
    if (nd.shape === 'square') tiles += `<rect${attrs({ x: nd.x - half, y: nd.y - half, width: nd.size, height: nd.size, rx: Math.min(radius, half) })}/>`;
    else if (nd.shape === 'circle') tiles += `<circle${attrs({ cx: nd.x, cy: nd.y, r: half })}/>`;
    if (nd.brackets) {
      const o = half + pad * 1.6;
      const arm = nd.size * 0.14;
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const [bx, by] = [nd.x + sx * o, nd.y + sy * o];
        lines.push(`M${num(bx - sx * arm)} ${num(by)}H${num(bx)}V${num(by - sy * arm)}`);
      }
    }
    if (nd.knock) knockouts += `<circle${attrs({ cx: nd.x, cy: nd.y, r: half * 1.08, fill: '#000' })}/>`;
    const data = iconData(nd.icon);
    const [vx, vy, vw, vh] = data.viewBox;
    const box = nd.shape === 'none' ? nd.size : nd.size * (layer.iconScale ?? 0.44);
    const k = Math.min(box / vw, box / vh);
    // Match the icon's line weight to the tiles' (in icon units).
    const body = data.body.replace(/stroke-width="[^"]*"/g, `stroke-width="${num(stroke / k, 3)}"`);
    icons.push(`<svg${attrs({ x: nd.x - (vw * k) / 2, y: nd.y - (vh * k) / 2, width: vw * k, height: vh * k, viewBox: `${num(vx)} ${num(vy)} ${num(vw)} ${num(vh)}`, overflow: 'visible', color: col })}>${body}</svg>`);
  }

  let defs = '';
  const paint = { fill: 'none', stroke: col, 'stroke-width': stroke, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
  let out = '';

  // The grid behind, broken around every node (and the arrows' span).
  if (layer.grid) {
    const g = layer.grid === true ? {} : layer.grid;
    const div = g.divisions ?? 4;
    const gpad = len(g.pad, ctx.canvas, s * 0.35);
    const gaps = nodes.map((nd) => ({ x: nd.x - nd.size / 2 - gpad, y: nd.y - nd.size / 2 - gpad, width: nd.size + gpad * 2, height: nd.size + gpad * 2 }));
    const xs0 = Math.min(...gaps.map((r) => r.x));
    const ys0 = Math.min(...gaps.map((r) => r.y));
    const xs1 = Math.max(...gaps.map((r) => r.x + r.width));
    const ys1 = Math.max(...gaps.map((r) => r.y + r.height));
    // Arrows run between nodes: keep the whole drawing's span clear too.
    if (lines.length) gaps.push({ x: xs0, y: ys0, width: xs1 - xs0, height: ys1 - ys0 + (layout === 'row' && mode === 'loop' ? gap * 1.3 : 0) });
    const xs = Array.from({ length: div - 1 }, (_, i) => ((i + 1) * w) / div);
    const ys = Array.from({ length: div - 1 }, (_, i) => ((i + 1) * h) / div);
    const gs = len(g.stroke, ctx.canvas, '0.3vmin');
    out += `<path${attrs({ d: gridPath(xs, ys, w, h, gaps), fill: 'none', stroke: g.color ? toHex(g.color) : col, 'stroke-width': gs, 'stroke-linecap': 'round', 'stroke-dasharray': `0 ${num(gs * 3.2)}`, opacity: g.opacity ?? 0.6 })}/>`;
  }

  if (dotted.length) out += `<path${attrs({ d: dotted.join(''), ...paint, 'stroke-dasharray': `0 ${num(stroke * 3)}` })}/>`;
  if (lines.length) out += `<path${attrs({ d: lines.join(''), ...paint })}/>`;
  if (tiles) out += `<g${attrs(paint)}>${tiles}</g>`;
  if (knockouts) {
    // The hub is drawn with holes where its satellites sit.
    const mid = `${ctx.id}k`;
    defs += `<mask${attrs({ id: mid, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: w, height: h })}><rect${attrs({ width: w, height: h, fill: '#fff' })}/>${knockouts}</mask>`;
    icons[0] = `<g mask="url(#${mid})">${icons[0]}</g>`;
  }
  out += icons.join('');
  const a = attrs(layerAttrs(layer));
  return { defs, body: a ? `<g${a}>${out}</g>` : out };
}

