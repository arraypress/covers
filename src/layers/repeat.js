/**
 * `repeat`: one layer (or a stack) drawn many times, so tile grids, rings
 * of marks and poster walls are data, not generator scripts.
 *
 * - A grid: `rows` × `cols`, `step: [dx, dy]` apart (default the canvas
 *   divided by the count), starting at `x`, `y`.
 * - A ring: `count` round `cx`, `cy` at `radius`, from `start` degrees (0
 *   up, clockwise) over `sweep` (default 360), each turned to its angle
 *   (`turn: false` keeps them upright).
 * - A line: `count` instances `step: [dx, dy]` apart.
 *
 * Each instance is the template (`layer`, or `layers` as a group) placed at
 * its point, with `{#…}` expressions filled in from its variables: `i`,
 * `n` (the count), `row`, `col`, `rows`, `cols`, `x`, `y`, `angle` and
 * `odd` (a checkerboard on a grid, every other one otherwise). `odd` holds
 * overrides for odd instances, `cycle` a list of overrides taken in turn,
 * and `skip` an expression that leaves an instance out.
 *
 * @module layers/repeat
 */

import { num } from '@arraypress/image-effects/svg';
import { len } from '@arraypress/image-effects/length';
import { pos } from './util.js';
import { fill, evaluate } from './expr.js';

/**
 * The instances of a repeat, as a group of placed copies.
 *
 * @param {any} layer
 * @param {{ width: number, height: number, canvas: { width: number, height: number } }} ctx
 * @returns {any} A `group` layer.
 */
export function expandRepeat(layer, ctx) {
  const template = layer.layer ?? { type: 'group', layers: layer.layers ?? [] };
  const places = points(layer, ctx);
  const grid = layer.rows != null || layer.cols != null;
  const key = layer.seed ?? layer.id ?? 'repeat';
  const layers = [];
  places.forEach((p, i) => {
    const odd = grid ? (p.row + p.col) % 2 === 1 : i % 2 === 1;
    const vars = { i, n: places.length, row: p.row, col: p.col, rows: p.rows, cols: p.cols, x: p.x, y: p.y, angle: p.angle, odd };
    if (layer.skip != null && evaluate(String(layer.skip).replace(/^\{#|\}$/g, ''), vars)) return;
    let one = { ...template };
    if (odd && layer.odd) one = { ...one, ...layer.odd };
    if (layer.cycle?.length) one = { ...one, ...layer.cycle[i % layer.cycle.length] };
    const turn = p.angle && layer.turn !== false ? ` rotate(${num(p.angle, 3)})` : '';
    layers.push({ type: 'group', seed: `${key}#${i}`, transform: `translate(${num(p.x, 3)} ${num(p.y, 3)})${turn}`, layers: [fill(one, vars)] });
  });
  return { type: 'group', layers, opacity: layer.opacity, blend: layer.blend };
}

/**
 * Where the instances go.
 *
 * @param {any} l
 * @param {{ width: number, height: number, canvas: { width: number, height: number } }} ctx
 * @returns {{ x: number, y: number, row: number, col: number, rows: number, cols: number, angle: number }[]}
 */
function points(l, ctx) {
  const c = ctx.canvas;
  const x0 = pos(l.x ?? 0, 'x', c);
  const y0 = pos(l.y ?? 0, 'y', c);
  if (l.rows != null || l.cols != null) {
    const rows = Math.max(1, Math.round(l.rows ?? 1));
    const cols = Math.max(1, Math.round(l.cols ?? 1));
    const dx = l.step ? len(l.step[0], c) : (c.width - x0) / cols;
    const dy = l.step ? len(l.step[1], c) : (c.height - y0) / rows;
    const out = [];
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) out.push({ x: x0 + col * dx, y: y0 + row * dy, row, col, rows, cols, angle: 0 });
    return out;
  }
  const count = Math.max(0, Math.round(l.count ?? 0));
  if (l.radius != null) {
    const cx = pos(l.cx ?? '50%', 'x', c);
    const cy = pos(l.cy ?? '50%', 'y', c);
    const r = len(l.radius, c);
    const sweep = l.sweep ?? 360;
    const start = l.start ?? 0;
    // A full circle doesn't put the last on the first.
    const stepA = count > 1 ? sweep / (Math.abs(sweep) >= 360 ? count : count - 1) : 0;
    return Array.from({ length: count }, (_, i) => {
      const angle = start + i * stepA;
      const a = (angle * Math.PI) / 180;
      return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a), row: 0, col: i, rows: 1, cols: count, angle };
    });
  }
  const [dx, dy] = l.step ? [len(l.step[0], c), len(l.step[1], c)] : [0, 0];
  return Array.from({ length: count }, (_, i) => ({ x: x0 + i * dx, y: y0 + i * dy, row: 0, col: i, rows: 1, cols: count, angle: 0 }));
}
