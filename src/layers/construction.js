/**
 * The `construction` layer.
 *
 * @module layers/construction
 */

import { attrs, num } from '@logomarks/image-effects/svg';
import { toHex } from '@logomarks/image-effects/color';
import { len } from '@logomarks/image-effects/length';
import { wrap } from './util.js';
import { markGuides } from './guides.js';
import { layerBox, fitMark, markPaths } from './mark-draw.js';

/**
 * `construction` — a mark drawn over its own construction, as a
 * construction sheet draws it: a light dashed square grid behind (its
 * cells a fraction of the mark's size, centred on it), the mark's bounding
 * box, a centre cross, the circles inscribed in its box and round its
 * outline, the circles its curves are drawn on (each centre marked) and
 * the lines its straight edges lie on, run across the box, all dashed in
 * one thin accent. The guides are read from the mark's own paths
 * (`markGuides`). Where the mark covers them they show faintly over it.
 *
 * Options: `markup` (512 grid), `x`, `y`, `width`, `height` (the box the
 * sheet fills; default the canvas), `size` (the share of the box's
 * shorter side the mark's longest side takes, 0.6), `grid` (cells across
 * the mark's longest side, 8; 0 none), `circles` and `lines` (the most of
 * each, 6), `color` (the guides; default the accent), `gridColor`
 * (default `color`), `gridOpacity` (0.3), `markColor` (default `text`;
 * `'none'` leaves the mark out), `over` (the guides' opacity over the
 * mark, 0.4), `stroke` (px, `'0.15vmin'`).
 *
 * @param {any} layer
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {import('../layers.js').Markup}
 *
 * @example
 * { type: 'construction', markup: mark, x: 24, y: 60, width: 352, height: 380, color: '#3b82f6', markColor: '#f4f4f2' }
 */
export function construction(layer, ctx) {
  const g = markGuides(layer.markup, { circles: layer.circles ?? 6, lines: layer.lines ?? 6 });
  if (!g) return { defs: '', body: '' };
  const area = layerBox(layer, ctx);
  const fit = fitMark(g.box, area, layer.size ?? 0.6);
  const { k } = fit;
  const X = (/** @type {number} */ x) => x * k + fit.dx;
  const Y = (/** @type {number} */ y) => y * k + fit.dy;
  const color = layer.color ? toHex(layer.color) : ctx.palette.accent;
  const sw = len(layer.stroke, ctx.canvas, '0.15vmin');
  const dash = `${num(sw * 6)} ${num(sw * 4)}`;
  const line = (/** @type {Record<string, any>} */ a) => `<path${attrs({ fill: 'none', ...a })}/>`;

  // The box, its centre and the mark's longest side, canvas units.
  const bx = X(g.box.x), by = Y(g.box.y), bw = g.box.width * k, bh = g.box.height * k;
  const cx = bx + bw / 2, cy = by + bh / 2;
  const side = Math.max(bw, bh);
  const { x: ax, y: ay, width: aw, height: ah } = area;

  // The grid: cells of side / grid, lines through the mark's centre.
  let grid = '';
  const cells = Math.round(layer.grid ?? 8);
  if (cells > 0) {
    const u = side / cells;
    let d = '';
    for (let x = cx - Math.floor((cx - ax) / u) * u; x <= ax + aw + 1e-6; x += u) d += `M${num(x)} ${num(ay)}V${num(ay + ah)}`;
    for (let y = cy - Math.floor((cy - ay) / u) * u; y <= ay + ah + 1e-6; y += u) d += `M${num(ax)} ${num(y)}H${num(ax + aw)}`;
    grid = line({ d, stroke: layer.gridColor ? toHex(layer.gridColor) : color, 'stroke-width': num(sw * 0.8, 3), 'stroke-dasharray': `${num(sw * 3)} ${num(sw * 3)}`, opacity: num(layer.gridOpacity ?? 0.3, 3) });
  }

  // Keylines: the box (solid), the centre cross and the inscribed and circumscribed circles (dashed, lighter).
  let keys = line({ d: `M${num(bx)} ${num(by)}h${num(bw)}v${num(bh)}h${num(-bw)}Z`, stroke: color, 'stroke-width': num(sw, 3) });
  keys += line({ d: `M${num(ax)} ${num(cy)}H${num(ax + aw)}M${num(cx)} ${num(ay)}V${num(ay + ah)}`, stroke: color, 'stroke-width': num(sw, 3), 'stroke-dasharray': dash, opacity: 0.6 });
  keys += line({ d: circlePath(cx, cy, g.inscribed * k) + circlePath(cx, cy, g.circumscribed * k), stroke: color, 'stroke-width': num(sw, 3), 'stroke-dasharray': dash, opacity: 0.6 });

  // The mark's own circles, each centre marked, and its edges' lines across the box.
  let d = '';
  let ticks = '';
  const t = sw * 4;
  for (const c of g.circles) {
    const [x, y] = [X(c.cx), Y(c.cy)];
    d += circlePath(x, y, c.r * k);
    ticks += `M${num(x - t)} ${num(y)}h${num(2 * t)}M${num(x)} ${num(y - t)}v${num(2 * t)}`;
  }
  let lines = '';
  for (const l of g.lines) {
    const seg = clipLine(X(l.x), Y(l.y), Math.cos(l.angle), Math.sin(l.angle), area);
    if (seg) lines += `M${num(seg[0])} ${num(seg[1])}L${num(seg[2])} ${num(seg[3])}`;
  }
  let guides = keys;
  if (d) guides += line({ d, stroke: color, 'stroke-width': num(sw, 3), 'stroke-dasharray': dash });
  if (lines) guides += line({ d: lines, stroke: color, 'stroke-width': num(sw, 3), 'stroke-dasharray': dash, opacity: 0.75 });
  if (ticks) guides += line({ d: ticks, stroke: color, 'stroke-width': num(sw, 3) });

  const clip = `${ctx.id}k`;
  const maskId = `${ctx.id}m`;
  let defs = `<clipPath id="${clip}"><rect${attrs({ x: ax, y: ay, width: aw, height: ah })}/></clipPath>`;
  let body = `${grid}${guides}`;
  const markColor = layer.markColor === 'none' ? null : layer.markColor ? toHex(layer.markColor) : ctx.palette.text;
  if (markColor) {
    const paths = markPaths(layer.markup, fit).map((p) => `<path${attrs({ d: p.d, 'fill-rule': p.evenodd ? 'evenodd' : undefined })}/>`).join('');
    body += `<g fill="${markColor}">${paths}</g>`;
    const over = layer.over ?? 0.4;
    if (over > 0) {
      defs += `<mask id="${maskId}" maskUnits="userSpaceOnUse"${attrs({ x: ax, y: ay, width: aw, height: ah })}><g fill="#fff">${paths}</g></mask>`;
      body += `<g mask="url(#${maskId})" opacity="${num(over, 3)}">${guides}</g>`;
    }
  }
  return { defs, body: wrap(layer, `<g clip-path="url(#${clip})">${body}</g>`) };
}

/**
 * A circle as path data (two arcs), so circles share one path.
 *
 * @param {number} cx @param {number} cy @param {number} r
 * @returns {string}
 */
function circlePath(cx, cy, r) {
  return `M${num(cx - r)} ${num(cy)}a${num(r)} ${num(r)} 0 1 0 ${num(2 * r)} 0a${num(r)} ${num(r)} 0 1 0 ${num(-2 * r)} 0Z`;
}

/**
 * The part of the line through (x, y) along (ux, uy) inside a box
 * (Liang–Barsky), or null when it misses.
 *
 * @param {number} x @param {number} y @param {number} ux @param {number} uy
 * @param {{ x: number, y: number, width: number, height: number }} box
 * @returns {number[] | null} `[x1, y1, x2, y2]`.
 */
function clipLine(x, y, ux, uy, box) {
  let t0 = -Infinity, t1 = Infinity;
  for (const [p, q] of [[-ux, x - box.x], [ux, box.x + box.width - x], [-uy, y - box.y], [uy, box.y + box.height - y]]) {
    if (Math.abs(p) < 1e-12) { if (q < 0) return null; continue; }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r); else t1 = Math.min(t1, r);
  }
  return t0 < t1 ? [x + ux * t0, y + uy * t0, x + ux * t1, y + uy * t1] : null;
}
