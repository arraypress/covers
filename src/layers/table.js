/**
 * The `table` layer: meta grids, lineups, tracklists.
 *
 * @module layers/table
 */

import { attrs, num } from '@arraypress/image-effects/svg';
import { len } from '@arraypress/image-effects/length';
import { toHex } from '@arraypress/image-effects/color';
import { faceFor, setLine } from '../type/line.js';
import { pos, wrap, contentOf } from './util.js';


/**
 * `table` — text on a grid: meta blocks, lineups, tracklists, programmes.
 * `rows` is an array of rows (each an array of cells, or an object read
 * through each column's `key`); a cell is text (`\n` for more lines) or
 * `{ content, weight, size, color, align, font, opacity }`. `columns` give
 * each column's `x` (px or `'%'`), `align`, `width` (justify), `key` and
 * text style. Rows start at `y` (the first baseline) and step by
 * `rowHeight`, or by their line count × `lineHeight` plus `rowGap`.
 * `rules` draws hairlines between or above rows.
 *
 * @param {any} layer
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {Promise<import('../layers.js').Markup>}
 */
export async function table(layer, ctx) {
  const rows = /** @type {any[]} */ (layer.rows ?? []);
  const cols = /** @type {any[]} */ (layer.columns ?? []);
  const size = len(layer.size, ctx.canvas, '2.2vmin');
  const lineH = len(layer.lineHeight, ctx.canvas, size * 1.22);
  const x0 = pos(layer.x ?? 0, 'x', ctx.canvas);
  let y = pos(layer.y ?? 0, 'y', ctx.canvas);
  const color = layer.color ? toHex(layer.color) : ctx.palette.text;
  /** @type {Map<string, string>} */
  const byColor = new Map();
  const add = (/** @type {string} */ c, /** @type {string} */ d) => byColor.set(c, (byColor.get(c) ?? '') + d);
  let rules = '';
  const r = layer.rules ? (layer.rules === true ? {} : layer.rules) : null;
  const rx1 = r ? pos(r.x1 ?? layer.x ?? 0, 'x', ctx.canvas) : 0;
  const rx2 = r ? pos(r.x2 ?? '100%', 'x', ctx.canvas) : 0;
  const ruleAt = (/** @type {number} */ ry) => { rules += `M${num(rx1)} ${num(ry)}H${num(rx2)}`; };

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri];
    const cells = Array.isArray(row) ? row : typeof row === 'string' || typeof row === 'number' ? [row] : cols.map((c) => row?.[c.key]);
    if (r && (r.at === 'top' || r.at === 'each') && ri === 0) ruleAt(y - size * (r.above ?? 1.1));
    let lines = 1;
    for (let ci = 0; ci < cells.length; ci++) {
      const cell = cells[ci];
      if (cell == null || cell === '') continue;
      const col = { ...(layer.header && ri === 0 ? layer.header : {}), ...(cols[ci] ?? {}) };
      const o = typeof cell === 'object' && !Array.isArray(cell) ? { ...col, ...cell } : { ...col, content: cell };
      const text = String(Array.isArray(o.content) ? o.content.join('\n') : contentOf(o.content) ?? o.content);
      const face = await faceFor(ctx, { font: o.font ?? layer.font, weight: o.weight ?? layer.weight ?? 400, style: o.style ?? layer.style, axes: o.axes ?? layer.axes });
      const s = len(o.size, ctx.canvas, size);
      const ls = (o.letterSpacing ?? layer.letterSpacing ?? 0) * s;
      const cx = o.x != null ? pos(o.x, 'x', ctx.canvas) : x0 + ci * len(layer.columnWidth, ctx.canvas, '20vmin');
      const parts = (o.transform === 'uppercase' ? text.toUpperCase() : text).split('\n');
      parts.forEach((t, li) => {
        const line = setLine({ face, text: t, size: s, tracking: ls, x: cx, y: y + li * lineH, align: o.align ?? 'left', width: o.width != null ? len(o.width, ctx.canvas) : undefined, adjust: o.lengthAdjust });
        const fill = o.color ? toHex(o.color) : color;
        add(o.opacity != null ? `${fill}|${o.opacity}` : fill, line.d);
      });
      lines = Math.max(lines, parts.length);
    }
    const step = layer.rowHeight != null ? len(layer.rowHeight, ctx.canvas) : lines * lineH + len(layer.rowGap, ctx.canvas, size * 0.6);
    if (r && (r.at === 'between' || r.at == null || r.at === 'each') && ri < rows.length - 1) ruleAt(y + step - size * (r.above ?? 1.1));
    y += step;
  }
  let body = '';
  if (rules && r) body += `<path${attrs({ d: rules, fill: 'none', stroke: r.color ? toHex(r.color) : color, 'stroke-width': len(r.width, ctx.canvas, '0.12vmin'), opacity: r.opacity })}/>`;
  for (const [key, d] of byColor) {
    const [fill, op] = key.split('|');
    body += `<path${attrs({ d, fill, opacity: op != null ? Number(op) : undefined })}/>`;
  }
  /** @type {any} */ (ctx).report?.({ kind: 'text', id: layer.id, content: rows.map((row) => (Array.isArray(row) ? row : Object.values(row ?? {})).map((c) => (typeof c === 'object' && c ? c.content : c)).join(' ')).join('\n'), size, capHeight: size * 0.72, box: null });
  return { defs: '', body: wrap(layer, body) };
}
