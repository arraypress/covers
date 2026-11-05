/**
 * Paints: a colour, `'none'`, a linear or radial gradient laid over a
 * shape's bounds (reflected foil with `spread` and `length`; elliptical
 * radial fields with `rx`/`ry`), a `tile` pattern (checker, stripes, dots,
 * grid or a custom tile), or a named preset (`'chrome'`).
 *
 * @module paint
 */

import { attrs, num } from '@logomarks/image-effects/svg';
import { len } from '@logomarks/image-effects/length';
import { toHex } from '@logomarks/image-effects/color';
import { PRESETS } from './presets.js';
import { tile } from './tile.js';

/**
 * A fill or stroke: a colour, `'none'`, a gradient object
 * `{ type: 'linear' | 'radial', colors, stops?, opacities?, angle?, spread?: 'pad' | 'reflect' | 'repeat', length?, cx?, cy?, r?, rx?, ry? }`,
 * a tile `{ type: 'tile', kind, size, colors, … }`, or a preset
 * `{ preset: 'chrome', … }` (its fields override the preset's), laid over
 * `box` (the shape's bounds, else the canvas). `length` sets a linear
 * gradient's run in px (with `reflect` it repeats: holographic foil).
 *
 * @param {any} v - The paint.
 * @param {string} fallback - Used when `v` is unset.
 * @param {{ id: string, box: { x: number, y: number, width: number, height: number }, canvas: { width: number, height: number } }} o
 * @returns {{ defs: string, value: string }}
 */
export function paint(v, fallback, o) {
  if (v == null || v === '') return { defs: '', value: fallback };
  if (typeof v === 'string') return { defs: '', value: v === 'none' || v === 'currentColor' || v.startsWith('url(') ? v : toHex(v) };
  if (v.preset != null) {
    const base = PRESETS[v.preset];
    if (!base) throw new TypeError(`Unknown paint preset "${v.preset}" (${Object.keys(PRESETS).join(', ')})`);
    const { preset, keyline, ...own } = v;
    return paint({ ...base, ...own }, fallback, o);
  }
  if (v.type === 'tile') return tile(v, o);
  const colors = (v.colors ?? []).map(toHex);
  if (colors.length < 2) throw new TypeError('A gradient paint needs two or more colours');
  const offsets = v.stops ?? colors.map((/** @type {string} */ _, /** @type {number} */ i) => i / (colors.length - 1));
  const stops = colors.map((c, i) => `<stop${attrs({ offset: num(offsets[i], 4), 'stop-color': c, 'stop-opacity': v.opacities?.[i] != null && v.opacities[i] < 1 ? num(v.opacities[i], 3) : undefined })}/>`).join('');
  const { box } = o;
  const spread = v.spread && v.spread !== 'pad' ? v.spread : undefined;
  if (v.type === 'radial') {
    const cx = box.x + (v.cx ?? 0.5) * box.width;
    const cy = box.y + (v.cy ?? 0.5) * box.height;
    // Elliptical: rx and ry (lengths, or fractions ≤ 1 of the box's width and height).
    const radius = (/** @type {any} */ r, /** @type {number} */ side) => (typeof r === 'number' && r <= 1 ? r * side : len(r, o.canvas));
    const rx = v.rx != null ? radius(v.rx, box.width) : undefined;
    const ry = v.ry != null ? radius(v.ry, box.height) : undefined;
    const r = rx ?? ry ?? (v.r != null ? len(v.r, o.canvas) : Math.hypot(box.width, box.height) / 2);
    const squash = rx != null && ry != null && rx > 0 ? ry / rx : 1;
    const gradientTransform = squash !== 1 ? `translate(${num(cx)} ${num(cy)}) scale(1 ${num(squash, 5)}) translate(${num(-cx)} ${num(-cy)})` : undefined;
    return { defs: `<radialGradient${attrs({ id: o.id, gradientUnits: 'userSpaceOnUse', cx, cy, r, fx: v.fx != null ? box.x + v.fx * box.width : undefined, fy: v.fy != null ? box.y + v.fy * box.height : undefined, spreadMethod: spread, gradientTransform })}>${stops}</radialGradient>`, value: `url(#${o.id})` };
  }
  const a = ((v.angle ?? 180) * Math.PI) / 180;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const L = v.length != null ? len(v.length, o.canvas) : Math.abs(box.width * Math.sin(a)) + Math.abs(box.height * Math.cos(a));
  const dx = (Math.sin(a) * L) / 2;
  const dy = (-Math.cos(a) * L) / 2;
  const x1 = v.length != null ? box.x : cx - dx;
  const y1 = v.length != null ? box.y : cy - dy;
  return { defs: `<linearGradient${attrs({ id: o.id, gradientUnits: 'userSpaceOnUse', x1, y1, x2: x1 + 2 * dx, y2: y1 + 2 * dy, spreadMethod: spread })}>${stops}</linearGradient>`, value: `url(#${o.id})` };
}
