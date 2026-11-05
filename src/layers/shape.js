/**
 * The `shape` layer.
 *
 * @module layers/shape
 */

import { attrs, num } from '@logomarks/image-effects/svg';
import { len } from '@logomarks/image-effects/length';
import { toHex } from '@logomarks/image-effects/color';
import { paint } from '../paint/index.js';
import { presetStrokes } from '../paint/presets.js';
import { wrap, pos } from './util.js';
import { geometry } from './geometry.js';
import { soften } from './soft.js';

/** Kinds drawn around a centre, whose `rotate` turns their points (about the centre). */
const POLAR = ['star', 'burst', 'scallop', 'rays', 'sector'];

/** Kinds that are lines unless closed: no fill by default. */
const isOpen = (/** @type {any} */ s) => s.kind === 'line' || s.kind === 'polyline' || (s.kind === 'wave' && !s.band) || (s.kind === 'arch' && s.open);

/**
 * `shape` — one exact shape, or `items` of them: rectangles (with deckled,
 * torn, zigzag or wavy `edge`s), circles, ellipses, lines, polygons, stars,
 * bursts, scallops, rays, rings, sectors, arches (open: an arc), waves, raw
 * paths and the print format's `cut`. Each takes `fill` and `stroke` (a
 * colour, a gradient, a tile or a preset), `strokeWidth`, `dash`,
 * `dashOffset`, `linecap`, `linejoin`, `fillRule`, `opacity`, `rotate`
 * (about its centre, or `origin`), `soft` (a blur, drawn padded so it never
 * shows a square edge) and `strokes` (stacked keylines, widest first).
 *
 * @param {any} layer
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {Promise<import('../layers.js').Markup>}
 */
export async function shape(layer, ctx) {
  const items = layer.items ?? [layer];
  let defs = '';
  let body = '';
  for (let i = 0; i < items.length; i++) {
    const raw = items[i];
    const s = layer.items ? { fill: layer.fill, stroke: layer.stroke, strokeWidth: layer.strokeWidth, dash: layer.dash, dashOffset: layer.dashOffset, linecap: layer.linecap, linejoin: layer.linejoin, strokes: layer.strokes, soft: layer.soft, ...raw } : raw;
    const polar = POLAR.includes(s.kind) && s.origin == null;
    const g = /** @type {any} */ (geometry(polar ? s : { ...s, rotate: undefined }, ctx));
    const open = g.el ?? `<path d="${g.d}"`;
    const fp = paint(s.fill, isOpen(s) ? 'none' : ctx.palette.text, { id: `${ctx.id}s${i}f`, box: g.box, canvas: ctx.canvas });
    const sp = s.stroke ? paint(s.stroke, 'none', { id: `${ctx.id}s${i}k`, box: g.box, canvas: ctx.canvas }) : null;
    let own = fp.defs + (sp?.defs ?? '');
    const sw = s.strokeWidth != null ? len(s.strokeWidth, ctx.canvas) : sp ? len('0.2vmin', ctx.canvas) : undefined;
    const tr = [rotation(s, g, ctx, polar), g.transform].filter(Boolean).join(' ') || undefined;
    const common = { 'fill-rule': s.fillRule, opacity: s.opacity != null && s.opacity < 1 ? s.opacity : undefined, transform: tr };
    let markup = '';
    const strokes = s.strokes ?? presetStrokes(s.fill);
    if (strokes) {
      const sorted = [...strokes].sort((a, b) => len(b.width, ctx.canvas) - len(a.width, ctx.canvas));
      for (const k of sorted) markup += `${open}${attrs({ fill: 'none', stroke: toHex(k.color), 'stroke-width': len(k.width, ctx.canvas), 'stroke-linejoin': 'round', 'stroke-dasharray': k.dash ? dashArray(k.dash, len(k.width, ctx.canvas), ctx) : undefined, ...common })}/>`;
    }
    markup += `${open}${attrs({ fill: fp.value, stroke: sp?.value, 'stroke-width': sp ? sw : undefined, 'stroke-dasharray': s.dash ? dashArray(s.dash, sw ?? 1, ctx) : undefined, 'stroke-dashoffset': s.dash && s.dashOffset != null ? len(s.dashOffset, ctx.canvas) : undefined, 'stroke-linecap': s.linecap ?? (s.dash === 'dotted' ? 'round' : undefined), 'stroke-linejoin': s.linejoin, ...common })}/>`;
    if (s.soft) {
      // The blur's reach, round the shape's bounds (turned, when it's turned).
      const soft = await soften({ defs: own, body: markup }, reach(g.box, s, tr ? s.rotate ?? 0 : 0, sw), len(s.soft, ctx.canvas), ctx, `${ctx.id}s${i}b`);
      own = soft.defs;
      markup = soft.body;
    }
    defs += own;
    body += markup;
  }
  return { defs, body: wrap(layer, body) };
}

/**
 * A dash pattern: `'dashed'`, `'dotted'`, or lengths `[on, off, …]`.
 *
 * @param {any} dash @param {number} width - The stroke width (dashed and dotted scale with it).
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {string}
 */
export function dashArray(dash, width, ctx) {
  if (Array.isArray(dash)) return dash.map((/** @type {any} */ d) => num(len(d, ctx.canvas))).join(' ');
  return dash === 'dotted' ? `0 ${num(width * 2.4)}` : `${num(width * 3)} ${num(width * 2.4)}`;
}

/**
 * The rotation of a shape: about its centre, or `origin` (`[x, y]`, px or
 * `'%'`). Polar kinds turn their points about the centre instead.
 *
 * @param {any} s @param {{ box: { x: number, y: number, width: number, height: number } }} g
 * @param {import('../layers.js').RenderContext} ctx @param {boolean} polar
 * @returns {string | undefined}
 */
function rotation(s, g, ctx, polar) {
  if (!s.rotate || polar) return undefined;
  const [ox, oy] = s.origin != null
    ? (Array.isArray(s.origin) ? [pos(s.origin[0], 'x', ctx.canvas), pos(s.origin[1], 'y', ctx.canvas)] : [pos(s.origin.x, 'x', ctx.canvas), pos(s.origin.y, 'y', ctx.canvas)])
    : [g.box.x + g.box.width / 2, g.box.y + g.box.height / 2];
  return `rotate(${num(s.rotate, 3)} ${num(ox)} ${num(oy)})`;
}

/**
 * The box a shape can paint in: its bounds (turned, when turned about its
 * centre) plus its stroke.
 *
 * @param {{ x: number, y: number, width: number, height: number }} box
 * @param {any} s @param {number} rotate @param {number | undefined} sw
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
function reach(box, s, rotate, sw) {
  const a = (rotate * Math.PI) / 180;
  const w = s.origin == null ? Math.abs(box.width * Math.cos(a)) + Math.abs(box.height * Math.sin(a)) : Math.hypot(box.width, box.height) * 2;
  const h = s.origin == null ? Math.abs(box.width * Math.sin(a)) + Math.abs(box.height * Math.cos(a)) : w;
  const stroke = (sw ?? 0) + Math.max(0, ...(s.strokes ?? []).map((/** @type {any} */ k) => (typeof k.width === 'number' ? k.width : 0)));
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return { x: cx - w / 2 - stroke, y: cy - h / 2 - stroke, width: w + 2 * stroke, height: h + 2 * stroke };
}
