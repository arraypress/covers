/**
 * Tile paints: a pattern repeated over a shape (checker, stripes, dots,
 * grid), or a custom tile of markup.
 *
 * @module paint/tile
 */

import { attrs, num } from '@logomarks/image-effects/svg';
import { len } from '@logomarks/image-effects/length';
import { toHex } from '@logomarks/image-effects/color';
import { sanitize } from '../layers/svg.js';

/** Tile kinds. */
export const TILES = Object.freeze(['checker', 'stripes', 'dots', 'grid', 'custom']);

/**
 * A tile paint as a `<pattern>`: `{ type: 'tile', kind, size, colors: [ground, ink], ratio, angle, markup }`.
 * `size` is one cell (a length, default `'4vmin'`); `ratio` the stripe,
 * dot or line share of it; `angle` turns the pattern; a `custom` tile draws
 * `markup` (sanitised) in a `size` square (or `[width, height]`). The
 * pattern starts at the shape's top-left corner. `colors[0]` may be
 * `'none'` for a transparent ground.
 *
 * @param {any} v
 * @param {{ id: string, box: { x: number, y: number, width: number, height: number }, canvas: { width: number, height: number } }} o
 * @returns {{ defs: string, value: string }}
 */
export function tile(v, o) {
  const kind = v.kind ?? 'checker';
  if (!TILES.includes(kind)) throw new TypeError(`Unknown tile kind "${kind}" (${TILES.join(', ')})`);
  const [sw, sh] = Array.isArray(v.size) ? v.size.map((/** @type {any} */ s) => len(s, o.canvas)) : [len(v.size, o.canvas, '4vmin'), len(v.size, o.canvas, '4vmin')];
  const [ground, ink] = [v.colors?.[0] ?? '#ffffff', v.colors?.[1] ?? '#111111'].map((c) => (c === 'none' ? 'none' : toHex(c)));
  const ratio = v.ratio ?? (kind === 'dots' ? 0.6 : kind === 'grid' ? 0.08 : 0.5);
  let w = sw;
  let h = sh;
  let body = ground === 'none' ? '' : `<rect${attrs({ width: num(kind === 'checker' ? 2 * sw : sw, 4), height: num(kind === 'checker' ? 2 * sh : sh, 4), fill: ground })}/>`;
  if (kind === 'checker') {
    w = 2 * sw;
    h = 2 * sh;
    body += `<path${attrs({ d: `M0 0h${num(sw, 4)}v${num(sh, 4)}h${num(-sw, 4)}ZM${num(sw, 4)} ${num(sh, 4)}h${num(sw, 4)}v${num(sh, 4)}h${num(-sw, 4)}Z`, fill: ink })}/>`;
  } else if (kind === 'stripes') {
    body += `<rect${attrs({ width: num(sw * ratio, 4), height: num(sh, 4), fill: ink })}/>`;
  } else if (kind === 'dots') {
    body += `<ellipse${attrs({ cx: num(sw / 2, 4), cy: num(sh / 2, 4), rx: num((sw * ratio) / 2, 4), ry: num((sh * ratio) / 2, 4), fill: ink })}/>`;
  } else if (kind === 'grid') {
    body += `<path${attrs({ d: `M0 0H${num(sw, 4)}M0 0V${num(sh, 4)}`, stroke: ink, 'stroke-width': num(Math.min(sw, sh) * ratio * 2, 4), fill: 'none' })}/>`;
  } else {
    body += sanitize(String(v.markup ?? ''));
  }
  const turn = v.angle ? ` rotate(${num(v.angle, 3)})` : '';
  return {
    defs: `<pattern${attrs({ id: o.id, patternUnits: 'userSpaceOnUse', width: num(w, 4), height: num(h, 4), patternTransform: `translate(${num(o.box.x)} ${num(o.box.y)})${turn}` })}>${body}</pattern>`,
    value: `url(#${o.id})`,
  };
}
