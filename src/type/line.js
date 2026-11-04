/**
 * Setting one line of type: a face for a layer, glyph outlines through any
 * affine map, and a line justified to a width (`textLength`).
 *
 * @module type/line
 */

import { num } from '../svg.js';
import { loadFont, pickFont, variationsFor } from '../fonts.js';
import { shape, outline } from '../text.js';
import { pixelFace } from './pixel.js';

/**
 * A face for a layer's family, weight, style and axes (`'pixel'` is the
 * built-in 5×7 face, unless a font of that name is registered).
 *
 * @param {import('../layers.js').RenderContext} ctx
 * @param {{ font?: string, weight?: number, style?: string, axes?: Record<string, number> }} o
 * @returns {Promise<import('../fonts.js').LoadedFont>}
 */
export async function faceFor(ctx, o) {
  if (o.font === 'pixel' && !ctx.fonts.some((f) => f.name === 'pixel')) return pixelFace();
  const weight = o.weight ?? 600;
  const source = pickFont(ctx.fonts, o.font ?? 'Inter', weight, o.style);
  return loadFont(source, variationsFor(source, weight, o.axes));
}

/**
 * Glyph outlines of a shaped run, through an affine map: glyph point
 * (gx, gy) in px (y down, baseline 0) goes to `map(gx, gy)`.
 *
 * @param {import('../fonts.js').LoadedFont} face
 * @param {import('../text.js').Shaped} run
 * @param {number} size
 * @param {(gx: number, gy: number, glyph: { x: number, y: number }) => [number, number]} map
 * @param {(glyph: any) => boolean} [only] - Draw only these glyphs (one paint at a time).
 * @returns {string}
 */
export function mappedPath(face, run, size, map, only) {
  const parts = [];
  for (const g of run.glyphs) {
    if (only && !only(g)) continue;
    const f = g.face ?? face;
    const s = (g.size ?? size) / f.upem;
    const t = g.t;
    let coords = [];
    let even = true;
    let px = 0;
    for (const c of outline(f, g.gid)) {
      if (typeof c === 'string') {
        if (coords.length) parts.push(coords.join(' '));
        parts.push(c);
        coords = [];
        even = true;
      } else if (even) {
        px = c;
        even = false;
      } else {
        // A glyph's own transform (per-glyph scale, turn, shift) is about its pen position.
        const gx = px * s;
        const gy = -c * s;
        const [X, Y] = t ? map(g.x + t[0] * gx + t[2] * gy + t[4], g.y + t[1] * gx + t[3] * gy + t[5], g) : map(g.x + gx, g.y + gy, g);
        coords.push(num(X), num(Y));
        even = true;
      }
    }
    if (coords.length) parts.push(coords.join(' '));
  }
  return parts.join('');
}

/**
 * Set one line: shape, justify and draw.
 *
 * @param {object} o
 * @param {import('../fonts.js').LoadedFont} o.face
 * @param {string} o.text
 * @param {number} o.size
 * @param {number} o.tracking - Letter-spacing, px.
 * @param {number} o.x - Anchor x (start, middle or end by `align`).
 * @param {number} o.y - Baseline.
 * @param {'left' | 'center' | 'right'} o.align
 * @param {number} [o.width] - Justify to this width.
 * @param {'spacingAndGlyphs' | 'spacing'} [o.adjust]
 * @param {(tracking: number) => import('../text.js').Shaped} [o.shape] - Shapes the line at a tracking (fallback faces, spans, per-glyph control); default the face alone.
 * @param {(glyph: any) => boolean} [o.only] - Draw only these glyphs.
 * @returns {{ d: string, width: number, left: number, run: import('../text.js').Shaped, scaleX: number }}
 */
export function setLine(o) {
  const shapeAt = o.shape ?? ((/** @type {number} */ tracking) => shape(o.face, o.text, o.size, tracking));
  let run = shapeAt(o.tracking);
  let scaleX = 1;
  if (o.width && run.width > 0) {
    if (o.adjust === 'spacing') {
      const gaps = Math.max(1, new Set(o.face.shapeRun(o.text).map((g) => g.cluster)).size - 1);
      run = shapeAt(o.tracking + (o.width - run.width) / gaps);
    } else {
      scaleX = o.width / run.width;
    }
  }
  const w = run.width * scaleX;
  const left = o.align === 'center' ? o.x - w / 2 : o.align === 'right' ? o.x - w : o.x;
  const d = mappedPath(o.face, run, o.size, (gx, gy) => [left + gx * scaleX, o.y + gy], o.only);
  return { d, width: w, left, run, scaleX };
}
