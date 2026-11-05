/**
 * The `perforation` layer.
 *
 * @module layers/perforation
 */

import { attrs, num } from '@logomarks/image-effects/svg';
import { len } from '@logomarks/image-effects/length';
import { toHex } from '@logomarks/image-effects/color';
import { pos, wrap } from './util.js';


/**
 * `perforation` — a tear-off line: `holes` (punched dots), `dashes` or
 * `notches` (half-circle bites at both ends), from `x1, y1` to `x2, y2`.
 * In a layer's `knockout` it punches real holes through it.
 *
 * @param {any} layer
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {import('../layers.js').Markup}
 */
export function perforation(layer, ctx) {
  const x1 = pos(layer.x1 ?? layer.x ?? '50%', 'x', ctx.canvas);
  const y1 = pos(layer.y1 ?? 0, 'y', ctx.canvas);
  const x2 = pos(layer.x2 ?? layer.x ?? '50%', 'x', ctx.canvas);
  const y2 = pos(layer.y2 ?? '100%', 'y', ctx.canvas);
  const color = layer.color ? toHex(layer.color) : ctx.palette.text;
  const kind = layer.kind ?? 'holes';
  const L = Math.hypot(x2 - x1, y2 - y1);
  const size = len(layer.size, ctx.canvas, kind === 'notches' ? '1.6vmin' : '0.25vmin');
  const gap = len(layer.gap, ctx.canvas, kind === 'dashes' ? '0.8vmin' : '1.2vmin');
  let body = '';
  if (kind === 'dashes') {
    body = `<path${attrs({ d: `M${num(x1)} ${num(y1)}L${num(x2)} ${num(y2)}`, stroke: color, 'stroke-width': len(layer.strokeWidth, ctx.canvas, '0.2vmin'), 'stroke-dasharray': `${num(gap)} ${num(gap * 0.8)}`, fill: 'none' })}/>`;
  } else if (kind === 'notches') {
    body = `<circle${attrs({ cx: x1, cy: y1, r: size, fill: color })}/><circle${attrs({ cx: x2, cy: y2, r: size, fill: color })}/>`;
  } else {
    const inset = len(layer.inset, ctx.canvas, gap);
    const n = Math.max(1, Math.floor((L - 2 * inset) / gap));
    for (let i = 0; i <= n; i++) {
      const t = (inset + i * ((L - 2 * inset) / n)) / L;
      body += `<circle${attrs({ cx: x1 + (x2 - x1) * t, cy: y1 + (y2 - y1) * t, r: size })}/>`;
    }
    body = `<g fill="${color}">${body}</g>`;
  }
  return { defs: '', body: wrap(layer, body) };
}
