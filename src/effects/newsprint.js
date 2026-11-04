/**
 * `newsprint`: a four-colour process halftone, computed on pixels. The
 * layer is separated into cyan, magenta, yellow and black (with grey
 * component replacement), each screened at its classic angle (C 15°,
 * M 75°, Y 0°, K 45°) as round dots that join into a checkerboard past
 * half coverage, anti-aliased, and printed on `paper` with process inks.
 *
 * @module effects/newsprint
 */

import { px } from './buffer.js';
import { rgb } from './util.js';

/** Process inks (sRGB approximations of SWOP on uncoated stock). */
const INKS = { c: '#00a3e0', m: '#e5007e', y: '#ffe600', k: '#1d1b1c' };

/**
 * `newsprint`: `cell` (a length: the screen ruling), `angles`
 * (`[c, m, y, k]`, degrees), `paper`, `gain` (dot gain, 0–0.3) and `gcr`
 * (0–1: how much grey goes to black).
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'newsprint' }} fx
 * @param {any} ctx
 * @returns {Uint8ClampedArray}
 */
export function newsprint(img, fx, ctx) {
  const { data, width: w, height: h } = img;
  const cell = Math.max(2, px(fx.cell, ctx, img, '1vmin'));
  const angles = fx.angles ?? [15, 75, 0, 45];
  const paper = rgb(fx.paper ?? '#f2ede1');
  const inks = ['c', 'm', 'y', 'k'].map((k) => rgb(/** @type {any} */ (INKS)[k]));
  const gain = fx.gain ?? 0.08;
  const gcr = fx.gcr ?? 0.8;
  const rot = angles.map((a) => { const t = (a * Math.PI) / 180; return [Math.cos(t) / cell, Math.sin(t) / cell]; });
  // Anti-aliasing: a pixel's width in cell units.
  const aa = 1 / cell;
  const out = new Uint8ClampedArray(data.length);
  const cov = new Float64Array(4);
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      // Separation: grey component replaced by black.
      const k = (1 - Math.max(r, g, b)) * gcr;
      const d = 1 - k || 1;
      cov[0] = (1 - r - k) / d;
      cov[1] = (1 - g - k) / d;
      cov[2] = (1 - b - k) / d;
      cov[3] = k;
      let R = paper[0];
      let G = paper[1];
      let B = paper[2];
      for (let n = 0; n < 4; n++) {
        const c = Math.min(1, Math.max(0, cov[n] * (1 + gain * (1 - cov[n]) * 4)));
        if (c <= 0.002) continue;
        const [cs, sn] = rot[n];
        // The pixel in this screen's cell coordinates, -1–1 across a cell.
        const u = x * cs + y * sn;
        const v = -x * sn + y * cs;
        const fu = (u - Math.floor(u)) * 2 - 1;
        const fv = (v - Math.floor(v)) * 2 - 1;
        let ink;
        if (c <= 0.5) {
          // A dot of area c (of the cell's 4 square units).
          const rad = Math.sqrt((4 * c) / Math.PI);
          ink = Math.min(1, Math.max(0, (rad - Math.hypot(fu, fv)) / (2 * aa) + 0.5));
        } else {
          // Past half: paper shrinks to holes at the corners.
          const rad = Math.sqrt((4 * (1 - c)) / Math.PI);
          const dc = Math.hypot(1 - Math.abs(fu), 1 - Math.abs(fv));
          ink = Math.min(1, Math.max(0, (dc - rad) / (2 * aa) + 0.5));
        }
        if (!ink) continue;
        // Inks multiply, as they do on paper.
        const t = inks[n];
        R *= 1 - ink * (1 - t[0]);
        G *= 1 - ink * (1 - t[1]);
        B *= 1 - ink * (1 - t[2]);
      }
      out[i] = R * 255;
      out[i + 1] = G * 255;
      out[i + 2] = B * 255;
      out[i + 3] = data[i + 3];
    }
  }
  return out;
}
