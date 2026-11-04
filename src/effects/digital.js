/**
 * Digital damage: `chromatic` aberration (an RGB split along a direction,
 * as a filter; or radial, red and blue scaled apart toward the corners as
 * a cheap lens does, on pixels), `glitch` (channel shift, torn slices and
 * displaced blocks, seeded) and `pixelate` (square cells, or hexagons).
 *
 * @module effects/digital
 */

import { num } from '../svg.js';
import { len } from '../geometry.js';
import { createRng } from '../rng.js';
import { mat } from './util.js';
import { px, pointPx, seedFor, premultiplied, unpremultiply } from './buffer.js';

/**
 * `chromatic` along a direction (and `rgbSplit`): red moved `amount` (a
 * length) along `angle`, blue the other way, green kept.
 *
 * @param {import('./index.js').Effect & { kind: 'chromatic' | 'rgbSplit' }} fx
 * @param {import('../render/context.js').RenderContext} ctx
 * @returns {string}
 */
export function chromatic(fx, ctx) {
  const d = len(fx.amount, ctx.canvas, '0.5vmin');
  const a = ((fx.angle ?? 0) * Math.PI) / 180;
  const dx = Math.cos(a) * d;
  const dy = Math.sin(a) * d;
  /** @param {number} c @returns {string} One channel alone, at the source's alpha. */
  const only = (c) => mat([c === 0 ? 1 : 0, 0, 0, 0, 0, 0, c === 1 ? 1 : 0, 0, 0, 0, 0, 0, c === 2 ? 1 : 0, 0, 0, 0, 0, 0, 1, 0]);
  return `<feColorMatrix in="SourceGraphic" type="matrix" values="${only(0)}"/><feOffset dx="${num(dx)}" dy="${num(dy)}" result="cr"/>`
    + `<feColorMatrix in="SourceGraphic" type="matrix" values="${only(1)}" result="cg"/>`
    + `<feColorMatrix in="SourceGraphic" type="matrix" values="${only(2)}"/><feOffset dx="${num(-dx)}" dy="${num(-dy)}" result="cb"/>`
    + '<feComposite in="cr" in2="cg" operator="arithmetic" k2="1" k3="1"/><feComposite in2="cb" operator="arithmetic" k2="1" k3="1"/>';
}

/**
 * `chromatic` with `mode: 'radial'`: red scaled out from `center` and blue
 * in, `amount` apart at the corners.
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'chromatic' }} fx
 * @param {any} ctx
 * @returns {Uint8ClampedArray}
 */
export function chromaticRadial(img, fx, ctx) {
  const { width: w, height: h } = img;
  const src = premultiplied(img);
  const [cx0, cy0] = pointPx(fx.center, img);
  const cx = cx0 - 0.5;
  const cy = cy0 - 0.5;
  const reach = Math.max(Math.hypot(cx, cy), Math.hypot(w - cx, cy), Math.hypot(cx, h - cy), Math.hypot(w - cx, h - cy));
  const k = px(fx.amount, ctx, img, '0.6vmin') / reach;
  const out = new Uint8ClampedArray(src.length);
  /** @param {number} x @param {number} y @param {number} c @returns {number} One channel, bilinear, edge held. */
  const at = (x, y, c) => {
    x = Math.min(w - 1, Math.max(0, x));
    y = Math.min(h - 1, Math.max(0, y));
    const x0 = x | 0;
    const y0 = y | 0;
    const x1 = Math.min(w - 1, x0 + 1);
    const y1 = Math.min(h - 1, y0 + 1);
    const fx0 = x - x0;
    const fy0 = y - y0;
    const top = src[(y0 * w + x0) * 4 + c] * (1 - fx0) + src[(y0 * w + x1) * 4 + c] * fx0;
    const bot = src[(y1 * w + x0) * 4 + c] * (1 - fx0) + src[(y1 * w + x1) * 4 + c] * fx0;
    return top + (bot - top) * fy0;
  };
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      const dx = x - cx;
      const dy = y - cy;
      out[i] = at(cx + dx * (1 - k), cy + dy * (1 - k), 0);
      out[i + 1] = src[i + 1];
      out[i + 2] = at(cx + dx * (1 + k), cy + dy * (1 + k), 2);
      out[i + 3] = Math.max(src[i + 3], at(cx + dx * (1 - k), cy + dy * (1 - k), 3), at(cx + dx * (1 + k), cy + dy * (1 + k), 3));
    }
  }
  return img.opaque ? out : unpremultiply(out);
}

/**
 * `glitch`, seeded: the channels split by `shift` (a length), `slices`
 * of the frame torn sideways (wrapping), `blocks` copied from elsewhere,
 * some with their channels swapped; `amount` (0–1) scales it all.
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'glitch' }} fx
 * @param {any} ctx
 * @returns {Uint8ClampedArray}
 */
export function glitch(img, fx, ctx) {
  const { data, width: w, height: h } = img;
  const rng = createRng(`glitch:${seedFor(fx, ctx)}`);
  const amount = Math.min(1, Math.max(0, fx.amount ?? 0.5));
  const shift = Math.round(px(fx.shift, ctx, img, '0.8vmin') * (0.5 + amount));
  const wrap = (/** @type {number} */ x) => ((x % w) + w) % w;
  // Channel split, wrapping round.
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = (row + x) * 4;
      out[i] = data[(row + wrap(x - shift)) * 4];
      out[i + 1] = data[i + 1];
      out[i + 2] = data[(row + wrap(x + shift)) * 4 + 2];
      out[i + 3] = data[i + 3];
    }
  }
  const u32 = new Uint32Array(out.buffer);
  const line = new Uint32Array(w);
  // Slices torn sideways.
  const slices = fx.slices ?? Math.round(4 + 14 * amount);
  for (let s = 0; s < slices; s++) {
    const y0 = rng.int(0, h - 1);
    const sh = Math.max(1, Math.round(h * rng.range(0.004, 0.06)));
    const off = Math.round(w * rng.range(0.01, 0.22) * amount * (rng.chance() ? 1 : -1));
    const swap = rng.chance(0.12);
    for (let y = y0; y < Math.min(h, y0 + sh); y++) {
      line.set(u32.subarray(y * w, y * w + w));
      for (let x = 0; x < w; x++) u32[y * w + x] = line[wrap(x - off)];
      if (swap) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; const r = out[i]; out[i] = out[i + 2]; out[i + 2] = out[i + 1]; out[i + 1] = r; }
    }
  }
  // Blocks lifted from one place and dropped in another.
  const blocks = fx.blocks ?? Math.round(2 + 10 * amount);
  for (let b = 0; b < blocks; b++) {
    const bw = Math.round(w * rng.range(0.04, 0.3));
    const bh = Math.round(h * rng.range(0.01, 0.08));
    const sx = rng.int(0, w - 1);
    const sy = rng.int(0, Math.max(0, h - bh));
    const dx = rng.int(0, w - 1);
    const dy = Math.min(h - bh, Math.max(0, sy + Math.round(h * rng.range(-0.05, 0.05))));
    const tone = rng.chance(0.35);
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        const v = u32[(sy + y) * w + wrap(sx + x)];
        const o = (dy + y) * w + wrap(dx + x);
        u32[o] = v;
        if (tone) { const i = o * 4; out[i] = out[i] & 0xe0; out[i + 1] = out[i + 1] & 0xe0; out[i + 2] = 255 - out[i + 2]; }
      }
    }
  }
  return out;
}

/**
 * `pixelate` (and `mosaic`): cells of `size` (a length), `shape`
 * `'square'` (each the average of what it covers, embedded at one pixel a
 * cell and scaled up crisp) or `'hex'`.
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'pixelate' | 'mosaic' }} fx
 * @param {any} ctx
 * @returns {import('./pixels.js').PixelResult}
 */
export function pixelate(img, fx, ctx) {
  const { width: w, height: h } = img;
  const size = Math.max(1, px(fx.size, ctx, img, '2.4vmin'));
  const shape = fx.shape ?? 'square';
  if (shape !== 'square' && shape !== 'hex') throw new TypeError(`Unknown pixelate shape "${shape}" (square, hex)`);
  const src = premultiplied(img);
  if (shape === 'square') {
    const cols = Math.max(1, Math.round(w / size));
    const rows = Math.max(1, Math.round(h / size));
    const acc = new Float64Array(cols * rows * 5);
    for (let y = 0; y < h; y++) {
      const cy = Math.min(rows - 1, ((y * rows) / h) | 0);
      for (let x = 0; x < w; x++) {
        const c = (cy * cols + Math.min(cols - 1, ((x * cols) / w) | 0)) * 5;
        const i = (y * w + x) * 4;
        acc[c] += src[i]; acc[c + 1] += src[i + 1]; acc[c + 2] += src[i + 2]; acc[c + 3] += src[i + 3]; acc[c + 4]++;
      }
    }
    const out = new Uint8ClampedArray(cols * rows * 4);
    for (let c = 0; c < cols * rows; c++) {
      const n = acc[c * 5 + 4] || 1;
      for (let k = 0; k < 4; k++) out[c * 4 + k] = acc[c * 5 + k] / n;
    }
    return { data: img.opaque ? out : unpremultiply(out), width: cols, height: rows, pixelated: true };
  }
  // Pointy-top hexagons, `size` across.
  const s = size / Math.sqrt(3);
  const qOff = Math.ceil(h / (1.5 * s)) + 2;
  const qn = Math.ceil(w / (Math.sqrt(3) * s)) + qOff + 4;
  const rn = Math.ceil(h / (1.5 * s)) + 4;
  const ids = new Int32Array(w * h);
  const acc = new Float64Array(qn * rn * 5);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const fq = ((Math.sqrt(3) / 3) * (x + 0.5) - (y + 0.5) / 3) / s;
      const fr = ((2 / 3) * (y + 0.5)) / s;
      const fz = -fq - fr;
      let q = Math.round(fq);
      let r = Math.round(fr);
      const z = Math.round(fz);
      const dq = Math.abs(q - fq);
      const dr = Math.abs(r - fr);
      const dz = Math.abs(z - fz);
      if (dq > dr && dq > dz) q = -r - z;
      else if (dr > dz) r = -q - z;
      const id = (r + 1) * qn + (q + qOff);
      ids[y * w + x] = id;
      const i = (y * w + x) * 4;
      const c = id * 5;
      acc[c] += src[i]; acc[c + 1] += src[i + 1]; acc[c + 2] += src[i + 2]; acc[c + 3] += src[i + 3]; acc[c + 4]++;
    }
  }
  const out = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < ids.length; p++) {
    const c = ids[p] * 5;
    const n = acc[c + 4] || 1;
    for (let k = 0; k < 4; k++) out[p * 4 + k] = acc[c + k] / n;
  }
  return { data: img.opaque ? out : unpremultiply(out), width: w, height: h, lossless: true };
}
