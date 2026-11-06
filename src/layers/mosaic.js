/**
 * The `mosaic` layer.
 *
 * @module layers/mosaic
 */

import { attrs, num } from '@logomarks/image-effects/svg';
import { toHex } from '@logomarks/image-effects/color';
import { pixelGrid, pixelCoverage, pixelCells } from '@logomarks/core/edit';
import { pos, wrap } from './util.js';
import { markGeometry } from './mark-geometry.js';

/**
 * `mosaic` — a mark rastered into big square cells, each drawn on its own
 * with a gap between, so whatever is under it shows through. The cells
 * follow the mark's own shape (`@logomarks/core`'s pixelate: a cell is
 * filled when the mark covers half of it, or a fifth where it would
 * otherwise lose a thin line or a dot). `drop` leaves a share of the
 * filled cells out, chosen by the layer's seed; `accent` puts a small
 * asterisk or dot in one empty cell beside the mark.
 *
 * Options: `markup` (the mark's paths, 512 grid), `x`, `y`, `width`,
 * `height` (the box it's fitted and centred in; default the canvas),
 * `cells` (across the mark's longest side, 10), `gap` (a share of a cell,
 * 0.12), `radius` (a share of a cell, 0), `drop` (0–1, 0.12), `color`
 * (default the accent), `accent` (`'asterisk'` or `'dot'`), `accentColor`.
 *
 * @param {any} layer
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {import('../layers.js').Markup}
 *
 * @example
 * { type: 'mosaic', markup: mark, x: 40, y: 60, width: 320, height: 320, cells: 11, color: '#c8ff2e', drop: 0.15, accent: 'asterisk' }
 */
export function mosaic(layer, ctx) {
  const geo = markGeometry(layer.markup);
  if (!geo) return { defs: '', body: '' };
  const g = mosaicGrid(geo, layer.cells);
  const on = pixelCells(pixelCoverage(geo.paths, g), g);

  // Fit the grid into the box, centred.
  const bx = pos(layer.x ?? 0, 'x', ctx.canvas);
  const by = pos(layer.y ?? 0, 'y', ctx.canvas);
  const bw = pos(layer.width ?? '100%', 'x', ctx.canvas);
  const bh = pos(layer.height ?? '100%', 'y', ctx.canvas);
  const k = Math.min(bw / (g.cols * g.cell), bh / (g.rows * g.cell));
  const cell = g.cell * k;
  const ox = bx + (bw - g.cols * cell) / 2;
  const oy = by + (bh - g.rows * cell) / 2;

  const kept = dropCells(on, layer.drop ?? 0.12, ctx.rng);
  const gap = cell * clamp(layer.gap ?? 0.12, 0, 0.9);
  const r = cell * clamp(layer.radius ?? 0, 0, 0.5);
  const side = cell - gap;
  let rects = '';
  kept.forEach((v, i) => {
    if (!v) return;
    const x = ox + (i % g.cols) * cell + gap / 2;
    const y = oy + Math.floor(i / g.cols) * cell + gap / 2;
    rects += r ? `<rect${attrs({ x, y, width: side, height: side, rx: r })}/>` : `M${num(x)} ${num(y)}h${num(side)}v${num(side)}h${num(-side)}Z`;
  });
  const color = layer.color ? toHex(layer.color) : ctx.palette.accent;
  let body = r ? `<g fill="${color}">${rects}</g>` : `<path${attrs({ d: rects, fill: color })}/>`;

  if (layer.accent) {
    const at = accentCell(on, g, ctx.rng);
    if (at >= 0) {
      const cx = ox + (at % g.cols + 0.5) * cell;
      const cy = oy + (Math.floor(at / g.cols) + 0.5) * cell;
      body += accentGlyph(layer.accent, cx, cy, side, layer.accentColor ? toHex(layer.accentColor) : color);
    }
  }
  return { defs: '', body: wrap(layer, body) };
}

/**
 * The mosaic's grid over a mark: `cells` across its longest side (4–48),
 * centred on its bounds (pixelate's grid, at that coarseness).
 *
 * @param {import('./mark-geometry.js').MarkGeometry} geo
 * @param {number} [cells=10]
 * @returns {import('@logomarks/core/edit').PixelGrid}
 */
export function mosaicGrid(geo, cells = 10) {
  const n = clamp(Math.round(cells), 4, 48);
  // pixelGrid sets 48 − 34 × amount cells across.
  return pixelGrid((48 - n) / 34, geo.box);
}

/**
 * The filled cells less a seeded share left out (at least one is kept).
 *
 * @param {Uint8Array} on
 * @param {number} drop - 0–1.
 * @param {import('../index.js').Rng} rng
 * @returns {Uint8Array}
 */
function dropCells(on, drop, rng) {
  const out = on.slice();
  const share = clamp(drop, 0, 0.9);
  let left = 0;
  out.forEach((v, i) => {
    if (!v) return;
    // One draw a filled cell, always, so the choice is stable whatever `drop` is.
    if (rng.next() < share) out[i] = 0;
    else left++;
  });
  if (!left) return on.slice();
  return out;
}

/**
 * A seeded empty cell beside the mark (one with a filled neighbour), or -1.
 *
 * @param {Uint8Array} on
 * @param {{ cols: number, rows: number }} g
 * @param {import('../index.js').Rng} rng
 * @returns {number}
 */
function accentCell(on, { cols, rows }, rng) {
  const near = [];
  for (let i = 0; i < on.length; i++) {
    if (on[i]) continue;
    const q = i % cols;
    const r = Math.floor(i / cols);
    const n = [[q - 1, r], [q + 1, r], [q, r - 1], [q, r + 1]].some(([a, b]) => a >= 0 && b >= 0 && a < cols && b < rows && on[b * cols + a]);
    if (n) near.push(i);
  }
  if (!near.length) return -1;
  return near[Math.floor(rng.next() * near.length)];
}

/**
 * An asterisk (three bars) or a dot, centred in a cell of `side`.
 *
 * @param {'asterisk' | 'dot' | string} kind
 * @param {number} cx @param {number} cy @param {number} side
 * @param {string} color
 * @returns {string}
 */
function accentGlyph(kind, cx, cy, side, color) {
  if (kind === 'dot') return `<circle${attrs({ cx, cy, r: side * 0.24, fill: color })}/>`;
  const L = side * 0.36;
  const t = side * 0.085;
  const d = [0, 60, 120].map((deg) => {
    const a = (deg * Math.PI) / 180;
    const [ux, uy, vx, vy] = [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a)];
    const pts = [[-L, -t], [L, -t], [L, t], [-L, t]].map(([u, v]) => `${num(cx + u * ux + v * vx)} ${num(cy + u * uy + v * vy)}`);
    return `M${pts.join('L')}Z`;
  }).join('');
  return `<path${attrs({ d, fill: color })}/>`;
}

/** @param {number} v @param {number} lo @param {number} hi @returns {number} */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
