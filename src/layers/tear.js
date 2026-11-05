/**
 * The `tear` layer: torn paper with fibres at the rip.
 *
 * @module layers/tear
 */

import { attrs, num } from '@arraypress/image-effects/svg';
import { len } from '@arraypress/image-effects/length';
import { toHex } from '@arraypress/image-effects/color';
import { paint } from '../paint/index.js';
import { pos, wrap } from './util.js';


/**
 * `tear` — paper torn along a jagged line from `from` to `to` (edge to
 * edge): the sheet on one `side` (`'above'`, `'below'`, `'left'`, `'right'`)
 * in `color`, the white core of the rip along the edge (`rip`), and fibres
 * hanging off it (`fibres`). `step` and `jitter` set the jaggedness. Use
 * the same `seed` on two tear layers to draw the sheet and its edge
 * separately (say, the sheet under a knockout and the edge over it).
 *
 * @param {any} layer
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {import('../layers.js').Markup}
 */
export function tear(layer, ctx) {
  const { width: w, height: h, rng } = ctx;
  const P = (/** @type {any} */ q) => /** @type {[number, number]} */ ([pos(q?.[0] ?? q?.x ?? 0, 'x', ctx.canvas), pos(q?.[1] ?? q?.y ?? 0, 'y', ctx.canvas)]);
  const from = P(layer.from ?? [0, '62%']);
  const to = P(layer.to ?? ['100%', '36%']);
  const step = len(layer.step, ctx.canvas, '2vmin');
  const jitter = len(layer.jitter, ctx.canvas, '4.4vmin');
  const L = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const n = Math.max(2, Math.round(L / step));
  const nx = -(to[1] - from[1]) / L;
  const ny = (to[0] - from[0]) / L;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const j = (rng.next() - 0.5) * jitter;
    pts.push([from[0] + (to[0] - from[0]) * t + nx * j, from[1] + (to[1] - from[1]) * t + ny * j]);
  }
  const line = pts.map((q, i) => `${i ? 'L' : 'M'}${num(q[0], 1)} ${num(q[1], 1)}`).join('');
  let body = '';
  const side = layer.side ?? 'above';
  if (layer.color !== 'none' && layer.color !== false) {
    const pad = Math.max(w, h);
    const ext = { above: [0, -pad], below: [0, pad], left: [-pad, 0], right: [pad, 0] }[/** @type {'above'} */ (side)] ?? [0, -pad];
    const first = pts[0];
    const last = pts[pts.length - 1];
    // Extend the ends past the canvas so a line that stops at the edge still closes off the corner.
    const sx = Math.sign(last[0] - first[0]) || 1;
    const sy = Math.sign(last[1] - first[1]) || 1;
    const horizontal = side === 'above' || side === 'below';
    const d = horizontal
      ? `M${num(first[0] - sx * pad, 1)} ${num(first[1], 1)}${line.replace(/^M/, 'L')}L${num(last[0] + sx * pad, 1)} ${num(last[1], 1)}L${num(last[0] + sx * pad, 1)} ${num(last[1] + ext[1], 1)}L${num(first[0] - sx * pad, 1)} ${num(first[1] + ext[1], 1)}Z`
      : `M${num(first[0], 1)} ${num(first[1] - sy * pad, 1)}${line.replace(/^M/, 'L')}L${num(last[0], 1)} ${num(last[1] + sy * pad, 1)}L${num(last[0] + ext[0], 1)} ${num(last[1] + sy * pad, 1)}L${num(first[0] + ext[0], 1)} ${num(first[1] - sy * pad, 1)}Z`;
    const fp = paint(layer.color, ctx.palette.accent, { id: `${ctx.id}t`, box: { x: 0, y: 0, width: w, height: h }, canvas: ctx.canvas });
    body += `<path${attrs({ d, fill: fp.value, opacity: layer.sheetOpacity })}/>`;
  }
  if (layer.fibres !== false) {
    const f = layer.fibres && typeof layer.fibres === 'object' ? layer.fibres : {};
    const [lo, hi] = (f.length ?? ['0.8vmin', '2vmin']).map((/** @type {any} */ v) => len(v, ctx.canvas));
    const spread = len(f.spread, ctx.canvas, '0.6vmin');
    const dir = side === 'above' || side === 'left' ? 1 : -1;
    const d = pts.map((q) => `M${num(q[0], 1)} ${num(q[1], 1)}l${num((rng.next() * 2 - 1) * spread, 1)} ${num(dir * (lo + rng.next() * (hi - lo)), 1)}`).join('');
    body += `<path${attrs({ d, stroke: toHex(f.color ?? layer.ripColor ?? '#fff6fb'), 'stroke-width': len(f.width, ctx.canvas, '0.44vmin'), 'stroke-linecap': 'round', fill: 'none', opacity: f.opacity ?? 0.85 })}/>`;
  }
  if (layer.rip !== false) {
    const r = layer.rip && typeof layer.rip === 'object' ? layer.rip : {};
    body += `<path${attrs({ d: line, stroke: toHex(r.color ?? layer.ripColor ?? '#fff6fb'), 'stroke-width': len(r.width, ctx.canvas, '0.7vmin'), fill: 'none', opacity: r.opacity ?? 0.9 })}/>`;
  }
  return { defs: '', body: wrap(layer, body) };
}
