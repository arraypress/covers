/**
 * Screens and signals: `scanlines` (a filter: dark lines across the
 * layer), and on pixels `crt` (a tube's RGB phosphor mask, scanlines and
 * curvature), `vhs` (tape: smeared, shifted chroma, line jitter, tracking
 * noise, snow) and `jpeg` (real JPEG compression, as crunchy as you like,
 * blocks at any size).
 *
 * @module effects/screen
 */

import { attrs, num } from '../svg.js';
import { len } from '../geometry.js';
import { encodePng, pngUri } from '../png.js';
import { createRng } from '../rng.js';
import { jpegRoundTrip } from '../raster/index.js';
import { px, seedFor, bilinear, shrink, gaussian, smoothstep, hash2 } from './buffer.js';

/**
 * `scanlines`: dark lines every `spacing` (a length), `thickness` of each
 * period (0–1), `amount` dark (0–1), across the layer.
 *
 * @param {import('./index.js').Effect & { kind: 'scanlines' }} fx
 * @param {import('../render/context.js').RenderContext} ctx
 * @returns {string}
 */
export function scanlines(fx, ctx) {
  const { width: W, height: H } = ctx;
  const spacing = Math.max(0.5, len(fx.spacing, ctx.canvas, '0.5vmin'));
  const t = Math.min(0.95, Math.max(0.05, fx.thickness ?? 0.45));
  const a = fx.amount ?? 0.45;
  // One column of the pattern, eight samples a line, stretched across.
  const rows = Math.min(8192, Math.max(2, Math.ceil((H / spacing) * 8)));
  const col = new Uint8Array(rows);
  for (let y = 0; y < rows; y++) {
    const p = (((y + 0.5) * H) / rows / spacing) % 1;
    const d = Math.abs(p - 0.5) * 2;
    col[y] = Math.round(255 * (1 - a * (1 - smoothstep(t - 0.12, t + 0.12, d))));
  }
  return `<feImage${attrs({ href: pngUri(encodePng(col, 1, rows, 1)), x: 0, y: 0, width: W, height: H, preserveAspectRatio: 'none', result: 'sl' })}/>`
    + '<feBlend in="sl" in2="SourceGraphic" mode="multiply"/><feComposite in2="SourceAlpha" operator="in"/>';
}

/**
 * `crt`: a cathode-ray tube. `mask` (`'aperture'`: vertical RGB stripes,
 * `'shadow'`: staggered triads), its triad `size` (a length), `amount`
 * (0–1), `scanlines` (0–1) and barrel `curvature` (0–1, with the corners
 * going dark).
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'crt' }} fx
 * @param {any} ctx
 * @returns {Uint8ClampedArray}
 */
export function crt(img, fx, ctx) {
  const { data, width: w, height: h } = img;
  const size = Math.max(3, px(fx.size, ctx, img, '0.45vmin'));
  const amount = fx.amount ?? 0.75;
  const lines = fx.scanlines ?? 0.45;
  const curve = fx.curvature ?? 0;
  const shadow = (fx.mask ?? 'aperture') === 'shadow';
  if (!['aperture', 'shadow'].includes(fx.mask ?? 'aperture')) throw new TypeError(`Unknown crt mask "${fx.mask}" (aperture, shadow)`);
  const out = new Uint8ClampedArray(data.length);
  const tmp = new Float32Array(4);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const k = curve * 0.25;
  // Mask brightness lost, given back so the mean holds.
  const gain = 1 / (1 - amount * 0.55) / (1 - lines * 0.3);
  const lineH = size;
  for (let y = 0, o = 0; y < h; y++) {
    for (let x = 0; x < w; x++, o += 4) {
      let sx = x;
      let sy = y;
      let edge = 1;
      if (k) {
        const u = (x - cx) / cx;
        const v = (y - cy) / cy;
        const r2 = u * u + v * v;
        sx = cx + u * (1 + k * r2) * cx;
        sy = cy + v * (1 + k * r2) * cy;
        if (sx < 0 || sy < 0 || sx > w - 1 || sy > h - 1) { out[o + 3] = 255; continue; }
        edge = smoothstep(0, 0.04, Math.min(sx / w, sy / h, 1 - sx / w, 1 - sy / h) * 4);
      }
      bilinear(data, w, h, sx, sy, tmp, 0);
      // Which phosphor this pixel is: a third of a triad each.
      const col = (x / size) * 3;
      const row = shadow ? y / lineH + (Math.floor(x / size) % 2) * 0.5 : y / lineH;
      const ph = col - Math.floor(col);
      const sub = Math.floor(col) % 3;
      const soft = 1 - Math.abs(ph - 0.5) * 2 * 0.5;
      const scan = 1 - lines * (1 - Math.sin(Math.PI * (row - Math.floor(row))) ** 2);
      for (let c = 0; c < 3; c++) {
        const m = c === sub ? soft : 1 - amount;
        out[o + c] = tmp[c] * (1 - amount + amount * m) * scan * gain * edge;
      }
      out[o + 3] = tmp[3];
    }
  }
  return out;
}

/**
 * `vhs`: a tape played back. Chroma smeared by `bleed` and shifted by
 * `shift` (lengths), lines jittered (`jitter`, a length), a tracking band
 * of torn lines (`tracking`, 0–1), `noise` (0–1) and a little softness;
 * seeded.
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'vhs' }} fx
 * @param {any} ctx
 * @returns {Uint8ClampedArray}
 */
export function vhs(img, fx, ctx) {
  const { data, width: w, height: h } = img;
  const seed = seedFor(fx, ctx);
  const rng = createRng(`vhs:${seed}`);
  const bleed = px(fx.bleed, ctx, img, '0.9vmin');
  const shift = px(fx.shift, ctx, img, '0.35vmin');
  const jitter = px(fx.jitter, ctx, img, '0.12vmin');
  const tracking = fx.tracking ?? 0.5;
  const noise = fx.noise ?? 0.35;
  // YIQ: luma kept sharp-ish, chroma smeared along the line.
  const Y = new Float32Array(w * h);
  const IQ = new Float32Array(w * h * 2);
  for (let p = 0, i = 0; p < Y.length; p++, i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    Y[p] = 0.299 * r + 0.587 * g + 0.114 * b;
    IQ[p * 2] = 0.596 * r - 0.274 * g - 0.322 * b;
    IQ[p * 2 + 1] = 0.211 * r - 0.523 * g + 0.312 * b;
  }
  gaussian(Y, w, h, 1, px('0.06vmin', ctx, img, 0), 0);
  gaussian(IQ, w, h, 2, Math.max(1, bleed), 0);
  // Per-line offsets: a gentle wobble, and a tracking band that tears.
  const offs = new Float32Array(h);
  const band = rng.range(0.62, 0.9) * h;
  const bandH = h * (0.04 + 0.08 * tracking);
  for (let y = 0; y < h; y++) {
    let o = (hash2(y >> 1, 0, seed) - 0.5) * 2 * jitter + Math.sin(y / (h / 7) + rng.next() * 0.02) * jitter * 0.5;
    const t = Math.abs(y - band) / bandH;
    if (tracking && t < 1) o += (1 - t) ** 2 * tracking * px('4vmin', ctx, img, 0) * (hash2(y >> 2, 1, seed) - 0.3);
    offs[y] = o;
  }
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    const o = offs[y];
    const t = Math.abs(y - band) / bandH;
    const torn = tracking && t < 1 ? (1 - t) * tracking : 0;
    for (let x = 0; x < w; x++) {
      const sx = Math.min(w - 1, Math.max(0, x - o));
      const x0 = sx | 0;
      const f = sx - x0;
      const x1 = Math.min(w - 1, x0 + 1);
      const yv = Y[y * w + x0] * (1 - f) + Y[y * w + x1] * f;
      const cxp = Math.min(w - 1, Math.max(0, sx - shift));
      const c0 = cxp | 0;
      const cf = cxp - c0;
      const c1 = Math.min(w - 1, c0 + 1);
      const iv = IQ[(y * w + c0) * 2] * (1 - cf) + IQ[(y * w + c1) * 2] * cf;
      const qv = IQ[(y * w + c0) * 2 + 1] * (1 - cf) + IQ[(y * w + c1) * 2 + 1] * cf;
      // Snow: fine noise everywhere, white streaks in the torn band.
      let n = (hash2(x, y, seed) - 0.5) * 60 * noise;
      if (torn && hash2(x >> 3, y, seed + 1) > 1 - torn * 0.35) n += 160 * torn * hash2(x, y, seed + 2);
      const yy = yv + n;
      const i = (y * w + x) * 4;
      out[i] = yy + 0.956 * iv + 0.621 * qv;
      out[i + 1] = yy - 0.272 * iv - 0.647 * qv;
      out[i + 2] = yy - 1.106 * iv + 1.703 * qv;
      out[i + 3] = data[i + 3];
    }
  }
  return out;
}

/**
 * `jpeg`: through a real JPEG encoder at `quality` (1–100) and back,
 * `passes` times (each re-save slightly shifted, as images degrade when
 * passed round), its 8-pixel blocks drawn `block` big (a length: bigger
 * is crunchier), colour subsampled unless `subsample: false`.
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'jpeg' }} fx
 * @param {any} ctx
 * @returns {Promise<import('./pixels.js').PixelResult | Uint8ClampedArray>}
 */
export async function jpeg(img, fx, ctx) {
  const { data, width: w, height: h } = img;
  const b = Math.max(1, Math.round(px(fx.block, ctx, img, '0.4vmin')));
  const q = Math.max(1, Math.min(100, Math.round(fx.quality ?? 12)));
  const passes = Math.max(1, Math.min(8, Math.round(fx.passes ?? 1)));
  const small = b > 1 ? shrink(data, w, h, b) : { data: new Uint8ClampedArray(data), width: w, height: h };
  let cur = small.data;
  for (let p = 0; p < passes; p++) {
    const got = await jpegRoundTrip(cur, small.width, small.height, Math.max(1, q - p * 2), fx.subsample !== false, ctx.sharp);
    if (!got) return data;
    // Later passes see the image a pixel over, so their blocks fall differently.
    if (p < passes - 1) {
      const shifted = new Uint8ClampedArray(got.length);
      const sw = small.width;
      for (let y = 0; y < small.height; y++) for (let x = 0; x < sw; x++) {
        const s = (Math.min(small.height - 1, y + 1) * sw + Math.min(sw - 1, x + 1)) * 4;
        shifted.set(got.subarray(s, s + 4), (y * sw + x) * 4);
      }
      cur = shifted;
    } else cur = got;
  }
  for (let i = 3; i < cur.length; i += 4) cur[i] = 255;
  if (b === 1) return cur;
  // Embedded at one pixel per JPEG pixel, scaled up crisp.
  return { data: cur, width: small.width, height: small.height, pixelated: true };
}
