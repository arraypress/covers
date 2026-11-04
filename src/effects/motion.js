/**
 * `motion` on pixels: a Gaussian blur along `angle` (`length` its
 * standard deviation) and `spread` across it. librsvg can't blur along
 * one axis under a rotation (a turned one-axis `feGaussianBlur` comes out
 * round), so `renderImage` draws motion blur here (`renderSvg` keeps the
 * filter, which browsers draw correctly): the layer is
 * resampled into a frame turned to the angle (the edge held, so a
 * full-bleed photo doesn't fade at the edges), blurred along rows with
 * running sums (O(1) a pixel), and resampled back.
 *
 * @module effects/motion
 */

import { px, premultiplied, unpremultiply, bilinear, gaussian } from './buffer.js';

/**
 * The blur.
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'motion' }} fx
 * @param {any} ctx
 * @returns {Uint8ClampedArray}
 */
export function motion(img, fx, ctx) {
  const { width: w, height: h } = img;
  const along = px(fx.length, ctx, img, '3vmin');
  const across = px(fx.spread, ctx, img, 0);
  const a = ((fx.angle ?? 0) * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const src = premultiplied(img);
  // The turned frame: big enough to hold the layer, with room for the blur at its ends.
  const pad = Math.ceil(3 * Math.max(along, across)) + 2;
  const rw = Math.ceil(Math.abs(w * c) + Math.abs(h * s)) + 2 * pad;
  const rh = Math.ceil(Math.abs(w * s) + Math.abs(h * c)) + 2 * pad;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const rcx = (rw - 1) / 2;
  const rcy = (rh - 1) / 2;
  // Turned frame (u along the blur, v across) → layer pixels, the edge held
  // (a full-bleed photo stays full-bleed; a cut-out's edge is clear anyway).
  const turnedPx = new Uint8ClampedArray(rw * rh * 4);
  for (let v = 0, o = 0; v < rh; v++) {
    for (let u = 0; u < rw; u++, o += 4) {
      const du = u - rcx;
      const dv = v - rcy;
      bilinear(src, w, h, cx + du * c - dv * s, cy + du * s + dv * c, turnedPx, o);
    }
  }
  gaussian(turnedPx, rw, rh, 4, along, across);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let y = 0, o = 0; y < h; y++) {
    for (let x = 0; x < w; x++, o += 4) {
      const dx = x - cx;
      const dy = y - cy;
      bilinear(turnedPx, rw, rh, rcx + dx * c + dy * s, rcy - dx * s + dy * c, out, o);
    }
  }
  return img.opaque ? out : unpremultiply(out);
}
