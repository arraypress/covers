/**
 * The `outline` layer.
 *
 * @module layers/outline
 */

import { attrs, num } from '@logomarks/image-effects/svg';
import { toHex } from '@logomarks/image-effects/color';
import { len } from '@logomarks/image-effects/length';
import { wrap } from './util.js';
import { markGeometry } from './mark-geometry.js';
import { layerBox, fitMark, markPaths } from './mark-draw.js';
import { distanceField, isolines, smoothLine } from './isolines.js';

/** Contour lines drawn by the field, by markup and spacing (a series of ten draws each mark once). @type {Map<string, number[][][][]>} */
const cache = new Map();

/**
 * `outline` — a mark fitted to its box by its real bounds, drawn as
 * contour lines: its own outline, then `lines − 1` more, each `gap`
 * further out (or in), as a topographic map draws a hill. The offsets
 * are isolines of the mark's signed distance field, so parts that grow
 * into each other merge, as contours do, and outer corners round off.
 * `lines: 0` draws the mark solid instead, in the same place.
 *
 * Options: `markup` (512 grid), `x`, `y`, `width`, `height` (the box; the
 * whole set of lines is fitted and centred in it), `size` (the share of
 * the box's shorter side the set's longest side takes, 1), `lines` (0–8,
 * 4), `gap` (a share of the mark's longest side, 0.05), `direction`
 * (`'out'`, `'in'`), `stroke` (px, `'0.4vmin'`), `color` (default `text`).
 *
 * @param {any} layer
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {import('../layers.js').Markup}
 *
 * @example
 * { type: 'outline', markup: mark, x: 140, y: 100, width: 240, height: 280, lines: 4, gap: 0.05, color: '#1b1b1b' }
 */
export function outline(layer, ctx) {
  const geo = markGeometry(layer.markup);
  if (!geo) return { defs: '', body: '' };
  const lines = Math.round(Math.min(8, Math.max(0, layer.lines ?? 4)));
  const side = Math.max(geo.box.width, geo.box.height);
  const gap = side * Math.max(0.005, layer.gap ?? 0.05);
  const inward = layer.direction === 'in';
  const reach = lines > 1 && !inward ? gap * (lines - 1) : 0;
  const fit = fitMark(geo.box, layerBox(layer, ctx), layer.size ?? 1, reach);
  const color = layer.color ? toHex(layer.color) : ctx.palette.text;
  const own = markPaths(layer.markup, fit);

  if (!lines) {
    const body = own.map((p) => `<path${attrs({ d: p.d, 'fill-rule': p.evenodd ? 'evenodd' : undefined })}/>`).join('');
    return { defs: '', body: wrap(layer, `<g fill="${color}">${body}</g>`) };
  }
  const sw = len(layer.stroke, ctx.canvas, '0.4vmin');
  // The outline itself, exactly; the offsets from the field.
  let d = own.map((p) => p.d).join('');
  for (const ring of offsetLines(layer.markup, geo, gap, lines, inward)) {
    d += smoothLine(ring.map(([x, y]) => [x * fit.k + fit.dx, y * fit.k + fit.dy]), 0.1);
  }
  const body = `<path${attrs({ d, fill: 'none', stroke: color, 'stroke-width': num(sw, 3), 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })}/>`;
  return { defs: '', body: wrap(layer, body) };
}

/**
 * The offset lines (not the outline itself), mark units: one set of
 * polylines for each of `lines − 1` distances, `gap` apart.
 *
 * @param {string} markup
 * @param {import('./mark-geometry.js').MarkGeometry} geo
 * @param {number} gap - Mark units.
 * @param {number} lines
 * @param {boolean} inward
 * @returns {number[][][]}
 */
function offsetLines(markup, geo, gap, lines, inward) {
  const key = `${num(gap, 3)}|${lines}|${inward ? 'in' : 'out'}|${markup}`;
  let sets = cache.get(key);
  if (!sets) {
    const levels = Array.from({ length: lines - 1 }, (_, i) => (inward ? -1 : 1) * gap * (i + 1));
    const field = distanceField(geo, inward ? 0 : gap * (lines - 1), levels);
    sets = [];
    for (const level of levels) {
      // Loops much smaller than the gap are where the field peaks at the level (between parts): left out.
      sets.push(isolines(field.values, field.width, field.height, level)
        .map((line) => line.map(([c, r]) => [field.x0 + c * field.step, field.y0 + r * field.step]))
        .filter((line) => extent(line) >= gap * 0.6));
    }
    if (cache.size > 100) cache.clear();
    cache.set(key, sets);
  }
  return sets.flat();
}

/**
 * The longer side of a polyline's box.
 *
 * @param {number[][]} line
 * @returns {number}
 */
function extent(line) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of line) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return Math.max(x1 - x0, y1 - y0);
}
