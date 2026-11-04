/**
 * `ascii`: the layer as text art. Each cell's brightness picks a
 * character from a ramp (ordered by how much ink each glyph of the
 * built-in 5×7 pixel face carries), drawn in the cell's own colour or one
 * ink, on a background. Rendered at one pixel per font pixel and embedded
 * scaled up crisp, so it's tiny and sharp at any size.
 *
 * @module effects/ascii
 */

import { px, premultiplied } from './buffer.js';
import { rgb } from './util.js';
import { pixelBitmap } from '../type/pixel.js';

/** The default ramp, light to dense. */
const RAMP = ' .:-=+*%#@';

/**
 * `ascii`: `cell` (a length: a character's width; height is 8/6 of it),
 * `ramp` (characters, sparse to dense, re-ordered by their ink), `color`
 * (`'source'`, each character the colour under it, or one colour),
 * `background` (a colour, or `'none'`), `invert` (dense where it's dark,
 * for dark ink on paper), `contrast` (after the tones are stretched to the
 * layer's own range).
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'ascii' }} fx
 * @param {any} ctx
 * @returns {import('./pixels.js').PixelResult}
 */
export function ascii(img, fx, ctx) {
  const { width: w, height: h } = img;
  const cw = Math.max(3, px(fx.cell, ctx, img, '1.4vmin'));
  const ch = (cw * 8) / 6;
  const cols = Math.max(1, Math.round(w / cw));
  const rows = Math.max(1, Math.round(h / ch));
  // Glyphs that the face draws, by ink.
  const glyphs = [...new Set([...(fx.ramp ?? RAMP)])].map((c) => ({ c, bits: c === ' ' ? '.'.repeat(35) : pixelBitmap(c) })).filter((g) => g.bits);
  if (!glyphs.length) throw new TypeError('ascii: the ramp has no characters the pixel face draws (A–Z, 0–9, punctuation)');
  glyphs.sort((a, b) => (a.bits?.split('#').length ?? 0) - (b.bits?.split('#').length ?? 0));
  const src = premultiplied(img);
  const acc = new Float64Array(cols * rows * 5);
  for (let y = 0; y < h; y++) {
    const cy = Math.min(rows - 1, ((y * rows) / h) | 0);
    for (let x = 0; x < w; x++) {
      const c = (cy * cols + Math.min(cols - 1, ((x * cols) / w) | 0)) * 5;
      const i = (y * w + x) * 4;
      acc[c] += src[i]; acc[c + 1] += src[i + 1]; acc[c + 2] += src[i + 2]; acc[c + 3] += src[i + 3]; acc[c + 4]++;
    }
  }
  const ink = fx.color && fx.color !== 'source' ? rgb(fx.color).map((v) => v * 255) : null;
  const bg = fx.background === 'none' ? null : rgb(fx.background ?? '#0b0b0b').map((v) => v * 255);
  const contrast = fx.contrast ?? 1.2;
  // Tones stretched to the cells' own range, so a dim layer still reads.
  const lums = new Float32Array(cols * rows);
  let lo = 1;
  let hi = 0;
  for (let c = 0; c < lums.length; c++) {
    const a = acc[c * 5 + 3];
    if (!a) continue;
    lums[c] = (0.2126 * acc[c * 5] + 0.7152 * acc[c * 5 + 1] + 0.0722 * acc[c * 5 + 2]) / a;
    lo = Math.min(lo, lums[c]);
    hi = Math.max(hi, lums[c]);
  }
  const span = hi - lo > 0.05 ? hi - lo : 1;
  const W = cols * 6;
  const H = rows * 8;
  const out = new Uint8ClampedArray(W * H * 4);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const c = (cy * cols + cx) * 5;
      const n = acc[c + 4] || 1;
      const a = acc[c + 3] / n;
      const k = a ? 255 / a : 0;
      const r = (acc[c] / n) * k;
      const g = (acc[c + 1] / n) * k;
      const b = (acc[c + 2] / n) * k;
      let l = (lums[cy * cols + cx] - (span === 1 ? 0 : lo)) / span;
      l = Math.min(1, Math.max(0, (l - 0.5) * contrast + 0.5));
      if (fx.invert) l = 1 - l;
      const glyph = a < 8 ? glyphs[0] : glyphs[Math.min(glyphs.length - 1, Math.floor(l * glyphs.length))];
      const col = ink ?? [r, g, b];
      for (let gy = 0; gy < 8; gy++) {
        for (let gx = 0; gx < 6; gx++) {
          const on = gy < 7 && gx < 5 && glyph.bits?.[gy * 5 + gx] === '#';
          const o = ((cy * 8 + gy) * W + cx * 6 + gx) * 4;
          if (on) { out[o] = col[0]; out[o + 1] = col[1]; out[o + 2] = col[2]; out[o + 3] = 255; } else if (bg) { out[o] = bg[0]; out[o + 1] = bg[1]; out[o + 2] = bg[2]; out[o + 3] = 255; }
        }
      }
    }
  }
  return { data: out, width: W, height: H, pixelated: true };
}
