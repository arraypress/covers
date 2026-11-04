/**
 * Glitch-art pixel moves: `sort` (runs of pixels within a brightness
 * range sorted along rows or columns, Kim Asendorf's pixel sorting) and
 * `stretch` (one row or column smeared to the edge).
 *
 * @module effects/sort
 */

import { seedFor, luma } from './buffer.js';
import { createRng } from '../rng.js';

/**
 * A sort key, 0–255: luminance, hue or saturation.
 *
 * @param {Uint8ClampedArray} d
 * @param {number} i
 * @param {'luma' | 'hue' | 'saturation'} by
 * @returns {number}
 */
function keyOf(d, i, by) {
  if (by === 'luma') return luma(d, i) | 0;
  const r = d[i];
  const g = d[i + 1];
  const b = d[i + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (by === 'saturation') return max ? ((255 * (max - min)) / max) | 0 : 0;
  if (max === min) return 0;
  const c = max - min;
  const hh = max === r ? ((g - b) / c + 6) % 6 : max === g ? (b - r) / c + 2 : (r - g) / c + 4;
  return ((hh / 6) * 255) | 0;
}

/**
 * `sort`: along `direction` (`'horizontal'` rows, `'vertical'` columns),
 * every run of pixels whose luminance lies within `threshold` (`[lo, hi]`,
 * 0–1) is sorted by `by` (`'luma'`, `'hue'`, `'saturation'`), dark to
 * light unless `reverse`. `length` (0–1 of the line) breaks long runs at
 * seeded points.
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'sort' }} fx
 * @param {any} ctx
 * @returns {Uint8ClampedArray}
 */
export function sort(img, fx, ctx) {
  const { data, width: w, height: h } = img;
  const vertical = (fx.direction ?? 'horizontal') === 'vertical';
  const by = fx.by ?? 'luma';
  if (!['luma', 'hue', 'saturation'].includes(by)) throw new TypeError(`Unknown sort key "${by}" (luma, hue, saturation)`);
  const [lo, hi] = (fx.threshold ?? [0.25, 0.85]).map((v) => v * 255);
  const rng = createRng(`sort:${seedFor(fx, ctx)}`);
  const n = vertical ? h : w;
  const lines = vertical ? w : h;
  const cap = fx.length ? Math.max(2, fx.length * n) : Infinity;
  const out = new Uint8ClampedArray(data);
  const u32 = new Uint32Array(out.buffer);
  const keys = new Uint8Array(n);
  const inside = new Uint8Array(n);
  const px = new Uint32Array(n);
  const counts = new Uint32Array(256);
  const buf = new Uint32Array(n);
  for (let l = 0; l < lines; l++) {
    const at = (/** @type {number} */ k) => (vertical ? k * w + l : l * w + k);
    for (let k = 0; k < n; k++) {
      const p = at(k);
      px[k] = u32[p];
      const lu = luma(out, p * 4);
      inside[k] = lu >= lo && lu <= hi ? 1 : 0;
      keys[k] = inside[k] ? keyOf(out, p * 4, by) : 0;
    }
    let k = 0;
    while (k < n) {
      if (!inside[k]) { k++; continue; }
      // A run: as far as the range holds, or the seeded cap.
      const limit = cap === Infinity ? n : k + Math.max(2, Math.round(cap * rng.range(0.4, 1)));
      let e = k;
      while (e < n && e < limit && inside[e]) e++;
      // Counting sort of [k, e).
      counts.fill(0);
      for (let j = k; j < e; j++) counts[keys[j]]++;
      let acc = 0;
      for (let c = 0; c < 256; c++) { const t = counts[c]; counts[c] = acc; acc += t; }
      for (let j = k; j < e; j++) buf[counts[keys[j]]++] = px[j];
      const len = e - k;
      for (let j = 0; j < len; j++) u32[at(k + j)] = buf[fx.reverse ? len - 1 - j : j];
      k = e;
    }
  }
  return out;
}

/**
 * `stretch`: the row or column at `at` (0–1) smeared toward `direction`
 * (`'down'`, `'up'`, `'left'`, `'right'`) for `length` of the way to the
 * edge (default all of it), fading out by `fade` (0–1).
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'stretch' }} fx
 * @returns {Uint8ClampedArray}
 */
export function stretch(img, fx) {
  const { data, width: w, height: h } = img;
  const dir = fx.direction ?? 'down';
  if (!['down', 'up', 'left', 'right'].includes(dir)) throw new TypeError(`Unknown stretch direction "${dir}" (down, up, left, right)`);
  const vertical = dir === 'down' || dir === 'up';
  const n = vertical ? h : w;
  const lines = vertical ? w : h;
  const from = Math.min(n - 1, Math.max(0, Math.round((fx.at ?? 0.5) * (n - 1))));
  const sign = dir === 'down' || dir === 'right' ? 1 : -1;
  const room = sign > 0 ? n - 1 - from : from;
  const reach = Math.round(room * Math.min(1, Math.max(0, fx.length ?? 1)));
  const fade = Math.min(1, Math.max(0, fx.fade ?? 0));
  const out = new Uint8ClampedArray(data);
  for (let l = 0; l < lines; l++) {
    const s = (vertical ? from * w + l : l * w + from) * 4;
    for (let k = 1; k <= reach; k++) {
      const pos = from + sign * k;
      const o = (vertical ? pos * w + l : l * w + pos) * 4;
      const t = fade * (k / Math.max(1, reach));
      for (let c = 0; c < 4; c++) out[o + c] = data[s + c] + (data[o + c] - data[s + c]) * t;
    }
  }
  return out;
}
