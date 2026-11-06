/**
 * The `marks` layer.
 *
 * @module layers/marks
 */

import { attrs, num } from '@logomarks/image-effects/svg';
import { toHex } from '@logomarks/image-effects/color';
import { pos, wrap } from './util.js';
import { shapesOnly } from './svg.js';
import { markGeometry } from './mark-geometry.js';

/** The smallest and largest sheet: 3 × 3 to 10 × 7. */
const MIN = 3;
const MAX_COLS = 10;
const MAX_ROWS = 7;

/**
 * `marks` — a set of marks on an even grid of square cells, centred in its
 * box so the margins match, each mark optically sized the same: scaled by
 * its real bounds (not its 512 grid), to the same area, nudged up a little
 * where it inks less of that area (an outline looks smaller than a solid
 * of the same size), and never past its cell. The logofolio sheet.
 *
 * Options: `marks` (a list of markup strings, or `{ markup }`), `cols` and
 * `rows` (default from the count and the box: 3 × 3 up to 10 × 7), `x`,
 * `y`, `width`, `height` (the box; default the canvas), `size` (the share
 * of a cell a mark's area takes, 0.5), `optical` (`false` fits each
 * mark's bounds to the same box instead), `color` (default `text`).
 *
 * @param {any} layer
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {import('../layers.js').Markup}
 *
 * @example
 * { type: 'marks', marks: ['<path d="…"/>', '<path d="…"/>'], x: 24, y: 120, width: 352, height: 340, color: '#f2efe8' }
 */
export function marks(layer, ctx) {
  const list = (layer.marks ?? []).map((m) => (m && typeof m === 'object' ? m.markup : m)).filter(Boolean);
  if (!list.length) return { defs: '', body: '' };
  const bx = pos(layer.x ?? 0, 'x', ctx.canvas);
  const by = pos(layer.y ?? 0, 'y', ctx.canvas);
  const bw = pos(layer.width ?? '100%', 'x', ctx.canvas);
  const bh = pos(layer.height ?? '100%', 'y', ctx.canvas);
  const { cols, rows } = sheetGrid(list.length, bw / bh, layer.cols, layer.rows);
  const cell = Math.min(bw / cols, bh / rows);
  const ox = bx + (bw - cols * cell) / 2;
  const oy = by + (bh - rows * cell) / 2;
  const share = layer.size ?? 0.5;
  const color = layer.color ? toHex(layer.color) : ctx.palette.text;

  let body = '';
  list.slice(0, cols * rows).forEach((markup, i) => {
    const geo = markGeometry(markup);
    if (!geo) return;
    const { x, y, width, height } = geo.box;
    // Optical: the same area (density-weighted, gently), capped at the cell; else the same longest side.
    const fit = (cell * 0.86) / Math.max(width, height);
    const k = layer.optical === false ? (cell * Math.sqrt(share)) / Math.max(width, height)
      : Math.min(fit, (cell * Math.sqrt(share)) / (Math.sqrt(width * height) * (geo.density / 0.5) ** 0.15));
    const cx = ox + (i % cols + 0.5) * cell;
    const cy = oy + (Math.floor(i / cols) + 0.5) * cell;
    body += `<svg${attrs({ x: cx - (width * k) / 2, y: cy - (height * k) / 2, width: width * k, height: height * k, viewBox: `${num(x)} ${num(y)} ${num(width)} ${num(height)}`, overflow: 'visible' })}>${shapesOnly(markup)}</svg>`;
  });
  return { defs: '', body: wrap(layer, `<g fill="${color}">${body}</g>`) };
}

/**
 * Columns and rows for `n` marks in a box of `aspect` (width / height):
 * the biggest cells the box allows, less a cost for empty cells (so 25
 * is 5 × 5, not 6 × 5 with a ragged row), 3 × 3 at the least, 10 × 7 at
 * the most (marks past 70 are left out). Given ones are kept.
 *
 * @param {number} n
 * @param {number} aspect
 * @param {number} [cols]
 * @param {number} [rows]
 * @returns {{ cols: number, rows: number }}
 *
 * @example
 * sheetGrid(70, 0.8); // { cols: 10, rows: 7 }
 * sheetGrid(25, 1.6); // { cols: 5, rows: 5 }
 */
export function sheetGrid(n, aspect, cols, rows) {
  if (cols && rows) return { cols: Math.round(cols), rows: Math.round(rows) };
  if (cols) return { cols: Math.round(cols), rows: Math.max(1, Math.ceil(n / cols)) };
  if (rows) return { cols: Math.max(1, Math.ceil(n / rows)), rows: Math.round(rows) };
  // The biggest cells, less a cost for empty ones (a ragged last row).
  const count = Math.min(n, MAX_COLS * MAX_ROWS);
  let best = { cols: MAX_COLS, rows: MAX_ROWS };
  let score = -Infinity;
  for (let c = MIN; c <= MAX_COLS; c++) {
    const r = clamp(Math.ceil(count / c), MIN, MAX_ROWS);
    if (c * r < count) continue;
    const s = Math.min(aspect / c, 1 / r) * (1 - (1.5 * (c * r - count)) / (c * r));
    if (s > score + 1e-9) [best, score] = [{ cols: c, rows: r }, s];
  }
  return best;
}

/** @param {number} v @param {number} lo @param {number} hi @returns {number} */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
