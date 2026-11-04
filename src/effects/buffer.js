/**
 * Pixel helpers shared by the effects computed on pixels: RGBA buffers
 * (8-bit, unpremultiplied, row-major), bilinear sampling with the edge
 * held, premultiplying, separable box and Gaussian blurs with running
 * sums (O(1) a pixel whatever the radius), seeded value noise, points and
 * lengths in pixels.
 *
 * @module effects/buffer
 */

import { len } from '../geometry.js';
import { hashString } from '../rng.js';

/**
 * A layer drawn as pixels: RGBA, 8-bit, not premultiplied.
 *
 * @typedef {object} Pixels
 * @property {Uint8ClampedArray} data
 * @property {number} width
 * @property {number} height
 * @property {number} scale - Pixels per layer unit.
 * @property {boolean} opaque - Every pixel has alpha 255.
 */

/** sRGB byte → linear light, 0–1. */
export const TO_LINEAR = (() => {
  const t = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    t[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  return t;
})();

/** Linear light (0–1, in 4096 steps) → sRGB byte. */
const FROM_LINEAR = (() => {
  const t = new Uint8ClampedArray(4097);
  for (let i = 0; i <= 4096; i++) {
    const c = i / 4096;
    t[i] = Math.round(255 * (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055));
  }
  return t;
})();

/**
 * Linear light to an sRGB byte (clipped).
 *
 * @param {number} v - Linear, 0–1 (higher clips).
 * @returns {number}
 */
export const toSrgb = (v) => FROM_LINEAR[v <= 0 ? 0 : v >= 1 ? 4096 : (v * 4096 + 0.5) | 0];

/**
 * A length in pixels: the layer's units times the raster's scale.
 *
 * @param {import('../index.js').Length | undefined} v
 * @param {{ canvas: { width: number, height: number } }} ctx
 * @param {Pixels} img
 * @param {import('../index.js').Length} fallback
 * @returns {number}
 */
export const px = (v, ctx, img, fallback) => len(v, ctx.canvas, fallback) * img.scale;

/**
 * A point given as fractions of the canvas (`[x, y]` or `{ x, y }`), in pixels.
 *
 * @param {[number, number] | { x: number, y: number } | undefined} p
 * @param {{ width: number, height: number }} img
 * @param {[number, number]} [fallback=[0.5, 0.5]]
 * @returns {[number, number]}
 */
export function pointPx(p, img, fallback = [0.5, 0.5]) {
  const [x, y] = fraction(p, fallback);
  return [x * img.width, y * img.height];
}

/**
 * A point as fractions, from `[x, y]` or `{ x, y }`.
 *
 * @param {[number, number] | { x: number, y: number } | undefined} p
 * @param {[number, number]} fallback
 * @returns {[number, number]}
 */
export function fraction(p, fallback) {
  if (Array.isArray(p)) return [Number(p[0] ?? fallback[0]), Number(p[1] ?? fallback[1])];
  if (p && typeof p === 'object') return [Number(p.x ?? fallback[0]), Number(p.y ?? fallback[1])];
  return fallback;
}

/** @param {number} v @returns {number} 0–1. */
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** @param {number} a @param {number} b @param {number} v @returns {number} Hermite step from a to b. */
export function smoothstep(a, b, v) {
  const t = clamp01((v - a) / (b - a || 1e-9));
  return t * t * (3 - 2 * t);
}

/**
 * A copy premultiplied by alpha (the same buffer when it's opaque).
 *
 * @param {Pixels} img
 * @returns {Uint8ClampedArray}
 */
export function premultiplied(img) {
  if (img.opaque) return img.data;
  const d = img.data;
  const out = new Uint8ClampedArray(d.length);
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    out[i] = (d[i] * a + 127) / 255;
    out[i + 1] = (d[i + 1] * a + 127) / 255;
    out[i + 2] = (d[i + 2] * a + 127) / 255;
    out[i + 3] = a;
  }
  return out;
}

/**
 * Undo {@link premultiplied}, in place.
 *
 * @param {Uint8ClampedArray} d
 * @returns {Uint8ClampedArray}
 */
export function unpremultiply(d) {
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a === 255 || a === 0) continue;
    const k = 255 / a;
    d[i] = d[i] * k;
    d[i + 1] = d[i + 1] * k;
    d[i + 2] = d[i + 2] * k;
  }
  return d;
}

/**
 * Bilinear RGBA sample with the edge held, written to `out` at `o`.
 *
 * @param {Uint8ClampedArray} src
 * @param {number} w
 * @param {number} h
 * @param {number} x - Pixel coordinates (pixel centres at .5 are exact at integers here: x = column).
 * @param {number} y
 * @param {Uint8ClampedArray | Float32Array} out
 * @param {number} o
 * @returns {void}
 */
export function bilinear(src, w, h, x, y, out, o) {
  if (x < 0) x = 0; else if (x > w - 1) x = w - 1;
  if (y < 0) y = 0; else if (y > h - 1) y = h - 1;
  const x0 = x | 0;
  const y0 = y | 0;
  const fx = x - x0;
  const fy = y - y0;
  const x1 = x0 + 1 < w ? x0 + 1 : x0;
  const y1 = y0 + 1 < h ? y0 + 1 : y0;
  const a = (y0 * w + x0) * 4;
  const b = (y0 * w + x1) * 4;
  const c = (y1 * w + x0) * 4;
  const d = (y1 * w + x1) * 4;
  const w00 = (1 - fx) * (1 - fy);
  const w10 = fx * (1 - fy);
  const w01 = (1 - fx) * fy;
  const w11 = fx * fy;
  out[o] = src[a] * w00 + src[b] * w10 + src[c] * w01 + src[d] * w11;
  out[o + 1] = src[a + 1] * w00 + src[b + 1] * w10 + src[c + 1] * w01 + src[d + 1] * w11;
  out[o + 2] = src[a + 2] * w00 + src[b + 2] * w10 + src[c + 2] * w01 + src[d + 2] * w11;
  out[o + 3] = src[a + 3] * w00 + src[b + 3] * w10 + src[c + 3] * w01 + src[d + 3] * w11;
}

/**
 * Resample every pixel from where `map` says it comes from (an inverse
 * mapping: distortions). `map(x, y, at)` writes the source position into
 * `at[0]`, `at[1]` (pixel coordinates; the edge is held beyond them).
 * Premultiplied where the layer isn't opaque, so clear pixels don't bleed.
 *
 * @param {Pixels} img
 * @param {(x: number, y: number, at: Float64Array) => void} map
 * @returns {Uint8ClampedArray}
 */
export function remap(img, map) {
  const { width: w, height: h } = img;
  const src = premultiplied(img);
  const out = new Uint8ClampedArray(w * h * 4);
  const at = new Float64Array(2);
  for (let y = 0, o = 0; y < h; y++) {
    for (let x = 0; x < w; x++, o += 4) {
      map(x, y, at);
      bilinear(src, w, h, at[0], at[1], out, o);
    }
  }
  return img.opaque ? out : unpremultiply(out);
}

/**
 * Box radii for three passes that approximate a Gaussian of `sigma`.
 *
 * @param {number} sigma
 * @returns {number[]}
 */
export function boxesFor(sigma) {
  const n = 3;
  const ideal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(ideal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  return Array.from({ length: n }, (_, i) => ((i < m ? wl : wu) - 1) / 2);
}

/**
 * A box blur along rows (`dir` 0) or columns (1) of an interleaved
 * buffer, the edge held: running sums, O(1) a sample.
 *
 * @param {Uint8ClampedArray | Float32Array} src
 * @param {Uint8ClampedArray | Float32Array} dst
 * @param {number} w
 * @param {number} h
 * @param {number} ch - Channels per pixel.
 * @param {number} r - Radius, whole pixels.
 * @param {0 | 1} dir
 * @returns {void}
 */
export function boxPass(src, dst, w, h, ch, r, dir) {
  const lines = dir === 0 ? h : w;
  const n = dir === 0 ? w : h;
  const step = (dir === 0 ? 1 : w) * ch;
  const lineStep = (dir === 0 ? w : 1) * ch;
  const inv = 1 / (2 * r + 1);
  const acc = new Float64Array(ch);
  for (let l = 0; l < lines; l++) {
    const base = l * lineStep;
    const last = base + (n - 1) * step;
    for (let c = 0; c < ch; c++) acc[c] = src[base + c] * (r + 1);
    for (let k = 1; k <= r; k++) {
      const i = base + Math.min(k, n - 1) * step;
      for (let c = 0; c < ch; c++) acc[c] += src[i + c];
    }
    for (let k = 0; k < n; k++) {
      const o = base + k * step;
      for (let c = 0; c < ch; c++) dst[o + c] = acc[c] * inv;
      const add = k + r + 1 < n ? base + (k + r + 1) * step : last;
      const sub = k - r >= 0 ? base + (k - r) * step : base;
      for (let c = 0; c < ch; c++) acc[c] += src[add + c] - src[sub + c];
    }
  }
}

/**
 * A Gaussian blur (three box passes each way), the edge held.
 *
 * @template {Uint8ClampedArray | Float32Array} T
 * @param {T} data - Interleaved samples (blurred in place).
 * @param {number} w
 * @param {number} h
 * @param {number} ch
 * @param {number} sigma - Pixels (x).
 * @param {number} [sigmaY=sigma] - Pixels (y).
 * @returns {T}
 */
export function gaussian(data, w, h, ch, sigma, sigmaY = sigma) {
  /** @type {[number, 0 | 1][]} */
  const passes = [];
  if (sigma > 0.3) for (const r of boxesFor(sigma)) passes.push([Math.round(r), 0]);
  if (sigmaY > 0.3) for (const r of boxesFor(sigmaY)) passes.push([Math.round(r), 1]);
  if (!passes.length) return data;
  // Ping-pong between two buffers; one copy back at the end if needed.
  let a = data;
  let b = /** @type {T} */ (new /** @type {any} */ (data.constructor)(data.length));
  for (const [r, dir] of passes) { boxPass(a, b, w, h, ch, r, dir); [a, b] = [b, a]; }
  if (a !== data) data.set(a);
  return data;
}

/**
 * Downsample by a whole factor, averaging each block (premultiplied in,
 * premultiplied out). The last row and column of blocks may be partial.
 *
 * @param {Uint8ClampedArray} src
 * @param {number} w
 * @param {number} h
 * @param {number} f
 * @returns {{ data: Uint8ClampedArray, width: number, height: number }}
 */
export function shrink(src, w, h, f) {
  const sw = Math.ceil(w / f);
  const sh = Math.ceil(h / f);
  const out = new Uint8ClampedArray(sw * sh * 4);
  const acc = new Float64Array(sw * 4);
  const cnt = new Float64Array(sw);
  for (let by = 0; by < sh; by++) {
    acc.fill(0);
    cnt.fill(0);
    for (let y = by * f; y < Math.min(h, (by + 1) * f); y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const j = ((x / f) | 0) * 4;
        acc[j] += src[i]; acc[j + 1] += src[i + 1]; acc[j + 2] += src[i + 2]; acc[j + 3] += src[i + 3];
        cnt[(x / f) | 0]++;
      }
    }
    for (let bx = 0; bx < sw; bx++) {
      const o = (by * sw + bx) * 4;
      const k = 1 / cnt[bx];
      out[o] = acc[bx * 4] * k; out[o + 1] = acc[bx * 4 + 1] * k; out[o + 2] = acc[bx * 4 + 2] * k; out[o + 3] = acc[bx * 4 + 3] * k;
    }
  }
  return { data: out, width: sw, height: sh };
}

/**
 * Upscale to a size, bilinear (a smaller working copy back to the layer's pixels).
 *
 * @param {Uint8ClampedArray} src
 * @param {number} sw
 * @param {number} sh
 * @param {number} w
 * @param {number} h
 * @returns {Uint8ClampedArray}
 */
export function enlarge(src, sw, sh, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  const kx = sw / w;
  const ky = sh / h;
  for (let y = 0, o = 0; y < h; y++) {
    const sy = (y + 0.5) * ky - 0.5;
    for (let x = 0; x < w; x++, o += 4) bilinear(src, sw, sh, (x + 0.5) * kx - 0.5, sy, out, o);
  }
  return out;
}

/**
 * Upscale to a size, nearest neighbour (cells stay crisp).
 *
 * @param {Uint8ClampedArray} src
 * @param {number} sw
 * @param {number} sh
 * @param {number} w
 * @param {number} h
 * @returns {Uint8ClampedArray}
 */
export function nearest(src, sw, sh, w, h) {
  const out = new Uint8ClampedArray(w * h * 4);
  const u = new Uint32Array(src.buffer, src.byteOffset, sw * sh);
  const v = new Uint32Array(out.buffer);
  for (let y = 0; y < h; y++) {
    const row = Math.min(sh - 1, ((y * sh) / h) | 0) * sw;
    for (let x = 0; x < w; x++) v[y * w + x] = u[row + Math.min(sw - 1, ((x * sw) / w) | 0)];
  }
  return out;
}

/**
 * Rec. 709 luma of a pixel, 0–255.
 *
 * @param {ArrayLike<number>} d
 * @param {number} i - Index of the pixel's red sample.
 * @returns {number}
 */
export const luma = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

/**
 * A seed for a pixel effect: the effect's own `seed`, else one from the layer's stream.
 *
 * @param {{ seed?: number | string }} fx
 * @param {{ rng: { int: (a: number, b: number) => number } }} ctx
 * @returns {number}
 */
export const seedFor = (fx, ctx) => (fx.seed != null ? hashString(String(fx.seed)) : ctx.rng.int(1, 2 ** 31 - 1));

/**
 * A fast integer hash of a lattice point and a seed, 0–1.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 * @returns {number}
 */
export function hash2(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Smooth value noise, -1–1, with lattice points every `1` unit.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 * @returns {number}
 */
export function valueNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return 2 * (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) - 1;
}

/**
 * Fractal value noise (octaves summed, each twice as fine, half as
 * strong), about -1–1.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 * @param {number} [octaves=3]
 * @returns {number}
 */
export function fractalNoise(x, y, seed, octaves = 3) {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(x, y, seed + o * 1013) * amp;
    norm += amp;
    amp *= 0.5;
    x *= 2.03;
    y *= 2.03;
  }
  return sum / norm;
}

/**
 * A noise field sampled on a coarse grid and read back bilinear: fractal
 * noise for every pixel without evaluating it at every pixel.
 *
 * @param {number} w - Pixels.
 * @param {number} h
 * @param {number} period - Pixels between the coarsest lattice points.
 * @param {number} seed
 * @param {number} [octaves=3]
 * @returns {Float32Array} -1–1, w × h.
 */
export function noiseField(w, h, period, seed, octaves = 3) {
  // Fine enough for the finest octave: about 4 samples per its period.
  const step = Math.max(1, period / 2 ** (octaves - 1) / 4);
  const gw = Math.ceil(w / step) + 2;
  const gh = Math.ceil(h / step) + 2;
  const grid = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) grid[j * gw + i] = fractalNoise((i * step) / period, (j * step) / period, seed, octaves);
  if (step === 1) {
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) out.set(grid.subarray(y * gw, y * gw + w), y * w);
    return out;
  }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const gy = y / step;
    const j = gy | 0;
    const fy = gy - j;
    for (let x = 0; x < w; x++) {
      const gx = x / step;
      const i = gx | 0;
      const fx = gx - i;
      const p = j * gw + i;
      const top = grid[p] + (grid[p + 1] - grid[p]) * fx;
      const bot = grid[p + gw] + (grid[p + gw + 1] - grid[p + gw]) * fx;
      out[y * w + x] = top + (bot - top) * fy;
    }
  }
  return out;
}
