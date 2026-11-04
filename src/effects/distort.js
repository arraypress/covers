/**
 * Distortions on pixels, each an inverse map (every output pixel reads
 * from where the distortion says it came from, bilinear, the edge held):
 * `wave`, `ripple` (rings on water), `twirl`, `bulge` and `pinch`,
 * `fisheye` (barrel distortion over the frame), `kaleidoscope` (a wedge
 * folded round a centre, the frame filled by reflection), `glass`
 * (frosted, reeded or pebbled glass in front of the layer) and `displace`
 * (by seeded noise, or by the luminance of layers: a texture, a photo,
 * type).
 *
 * @module effects/distort
 */

import { px, pointPx, remap, noiseField, seedFor, gaussian, luma, smoothstep } from './buffer.js';
import { drawLayer } from './pixels.js';

/** @param {any} fx @param {import('./buffer.js').Pixels} img @returns {[number, number]} The centre in pixel coordinates. */
const centre = (fx, img) => { const [x, y] = pointPx(fx.center, img); return [x - 0.5, y - 0.5]; };

/** Wave shapes, one period over 0–1, -1–1. @type {Record<string, (t: number) => number>} */
const WAVES = {
  sine: (t) => Math.sin(2 * Math.PI * t),
  triangle: (t) => 1 - 4 * Math.abs(t - Math.floor(t + 0.5)),
  square: (t) => (t - Math.floor(t) < 0.5 ? 1 : -1),
};

/**
 * `wave`: the layer displaced across a wave travelling at `angle`
 * (degrees, 0 along x): `amplitude`, `wavelength`, `phase` (0–1 of a
 * period), `shape` (`'sine'`, `'triangle'`, `'square'`).
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'wave' }} fx
 * @param {any} ctx
 * @returns {Uint8ClampedArray}
 */
export function wave(img, fx, ctx) {
  const A = px(fx.amplitude, ctx, img, '1.5vmin');
  const L = Math.max(1, px(fx.wavelength, ctx, img, '14vmin'));
  const shape = WAVES[fx.shape ?? 'sine'];
  if (!shape) throw new TypeError(`Unknown wave shape "${fx.shape}" (${Object.keys(WAVES).join(', ')})`);
  const a = ((fx.angle ?? 0) * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const ph = fx.phase ?? 0;
  return remap(img, (x, y, at) => {
    const d = A * shape((x * ux + y * uy) / L + ph);
    at[0] = x - uy * d;
    at[1] = y + ux * d;
  });
}

/**
 * `ripple`: rings on water round `center`: `amplitude`, `wavelength`,
 * `phase`, fading out by `radius`.
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'ripple' }} fx
 * @param {any} ctx
 * @returns {Uint8ClampedArray}
 */
export function ripple(img, fx, ctx) {
  const [cx, cy] = centre(fx, img);
  const A = px(fx.amplitude, ctx, img, '0.8vmin');
  const L = Math.max(1, px(fx.wavelength, ctx, img, '6vmin'));
  const R = Math.max(1, px(fx.radius, ctx, img, '70vmin'));
  const ph = fx.phase ?? 0;
  return remap(img, (x, y, at) => {
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.sqrt(dx * dx + dy * dy) || 1e-6;
    const d = A * Math.sin(2 * Math.PI * (r / L - ph)) * (1 - smoothstep(0, R, r));
    at[0] = x + (dx / r) * d;
    at[1] = y + (dy / r) * d;
  });
}

/**
 * `twirl`: turned `angle` degrees at `center`, less and less out to
 * `radius`, where it stops.
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'twirl' }} fx
 * @param {any} ctx
 * @returns {Uint8ClampedArray}
 */
export function twirl(img, fx, ctx) {
  const [cx, cy] = centre(fx, img);
  const R = Math.max(1, px(fx.radius, ctx, img, '45vmin'));
  const turn = ((fx.angle ?? 180) * Math.PI) / 180;
  return remap(img, (x, y, at) => {
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r >= R) { at[0] = x; at[1] = y; return; }
    const k = 1 - r / R;
    const t = -turn * k * k;
    const c = Math.cos(t);
    const s = Math.sin(t);
    at[0] = cx + dx * c - dy * s;
    at[1] = cy + dx * s + dy * c;
  });
}

/**
 * `bulge` and `pinch`: magnified (or shrunk) toward `center` within
 * `radius`, by `amount` (0–1; `pinch` is a bulge the other way), smooth at
 * the edge.
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'bulge' | 'pinch' }} fx
 * @param {any} ctx
 * @returns {Uint8ClampedArray}
 */
export function bulge(img, fx, ctx) {
  const [cx, cy] = centre(fx, img);
  const R = Math.max(1, px(fx.radius, ctx, img, '35vmin'));
  const amt = (fx.kind === 'pinch' ? -1 : 1) * (fx.amount ?? 0.5);
  const a = Math.max(-1, Math.min(0.95, amt));
  return remap(img, (x, y, at) => {
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.sqrt(dx * dx + dy * dy) / R;
    if (d >= 1) { at[0] = x; at[1] = y; return; }
    const f = 1 - a * (1 - d) * (1 - d);
    at[0] = cx + dx * f;
    at[1] = cy + dy * f;
  });
}

/**
 * `fisheye`: barrel distortion over the whole frame, `amount` 0–1 (the
 * centre swells, the edges bow; the corners stay put).
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'fisheye' }} fx
 * @returns {Uint8ClampedArray}
 */
export function fisheye(img, fx) {
  const [cx, cy] = centre(fx, img);
  const Rn = Math.hypot(img.width, img.height) / 2;
  const th = Math.max(1e-3, Math.min(0.99, fx.amount ?? 0.6)) * (Math.PI / 2) * 0.92;
  const norm = 1 / Math.tan(th);
  return remap(img, (x, y, at) => {
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (!r) { at[0] = x; at[1] = y; return; }
    const f = (Math.tan((r / Rn) * th) * norm * Rn) / r;
    at[0] = cx + dx * f;
    at[1] = cy + dy * f;
  });
}

/** @param {number} v @param {number} n @returns {number} A coordinate reflected back into 0–(n-1). */
function reflect(v, n) {
  const p = 2 * (n - 1) || 1;
  const m = ((v % p) + p) % p;
  return m > n - 1 ? p - m : m;
}

/**
 * `kaleidoscope`: the wedge of `360 / segments` from `angle` (degrees, 0 =
 * right, clockwise; default up) round `center`, folded round it with every
 * other copy reflected; `scale` zooms the source (below 1 shows more of
 * it). Beyond the layer's edge the source is reflected, so the frame fills.
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'kaleidoscope' }} fx
 * @returns {Uint8ClampedArray}
 */
export function kaleidoscope(img, fx) {
  const { width: w, height: h } = img;
  const [cx, cy] = centre(fx, img);
  const n = Math.max(2, Math.round(fx.segments ?? 8));
  const phi = (2 * Math.PI) / n;
  const a0 = ((fx.angle ?? -90) * Math.PI) / 180;
  const k = 1 / Math.max(0.05, fx.scale ?? 1);
  return remap(img, (x, y, at) => {
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.sqrt(dx * dx + dy * dy) * k;
    let t = (Math.atan2(dy, dx) - a0) % (2 * phi);
    if (t < 0) t += 2 * phi;
    if (t > phi) t = 2 * phi - t;
    at[0] = reflect(cx + r * Math.cos(a0 + t), w);
    at[1] = reflect(cy + r * Math.sin(a0 + t), h);
  });
}

/**
 * `glass`: the layer through glass. `texture` `'frosted'` (fine scatter),
 * `'reeded'` (fluted ribs `size` wide at `angle`, each a narrow lens, with
 * `shade` on their edges) or `'pebbled'` (soft rounded lumps); `amount`
 * is how far light bends, `seed` the texture.
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'glass' }} fx
 * @param {any} ctx
 * @returns {Uint8ClampedArray}
 */
export function glass(img, fx, ctx) {
  const { width: w, height: h } = img;
  const texture = fx.texture ?? 'frosted';
  if (texture === 'reeded') return reeded(img, fx, ctx);
  if (texture !== 'frosted' && texture !== 'pebbled') throw new TypeError(`Unknown glass texture "${texture}" (frosted, reeded, pebbled)`);
  const frosted = texture === 'frosted';
  const size = Math.max(1, px(fx.size, ctx, img, frosted ? '0.25vmin' : '5vmin'));
  const amount = px(fx.amount, ctx, img, frosted ? '0.7vmin' : '1.6vmin');
  const seed = seedFor(fx, ctx);
  const nx = noiseField(w, h, size, seed, frosted ? 2 : 3);
  const ny = noiseField(w, h, size, seed + 7919, frosted ? 2 : 3);
  const out = remap(img, (x, y, at) => {
    const i = y * w + x;
    at[0] = x + nx[i] * amount;
    at[1] = y + ny[i] * amount;
  });
  // Frost also scatters: a touch of softness.
  return frosted ? gaussian(out, w, h, 4, Math.max(0.5, size * 0.4)) : out;
}

/**
 * Reeded (fluted) glass: ribs, each a cylinder lens that shows its strip
 * of the layer narrowed (and, past `amount` 0.5, mirrored), lit at its
 * edges by `shade`.
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {any} fx
 * @param {any} ctx
 * @returns {Uint8ClampedArray}
 */
function reeded(img, fx, ctx) {
  const size = Math.max(2, px(fx.size, ctx, img, '3.2vmin'));
  const k = 1 - 2 * Math.min(1, Math.max(0, fx.amount ?? 0.35));
  const shade = fx.shade ?? 0.25;
  const a = ((fx.angle ?? 0) * Math.PI) / 180;
  const ux = Math.cos(a);
  const uy = Math.sin(a);
  const out = remap(img, (x, y, at) => {
    const s = (x * ux + y * uy) / size;
    const u = s - Math.floor(s) - 0.5;
    const d = (u * k - u) * size;
    at[0] = x + ux * d;
    at[1] = y + uy * d;
  });
  const { width: w, height: h } = img;
  // Fluted glass is never quite sharp.
  gaussian(out, w, h, 4, size * 0.05);
  if (!shade) return out;
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      const s = (x * ux + y * uy) / size;
      const u = s - Math.floor(s) - 0.5;
      // Bright on one shoulder, dark in the groove.
      const l = 1 + shade * (0.6 * Math.sin(u * Math.PI * 2 + 0.6) - 0.8 * Math.abs(u) ** 3 * 8 + 0.3);
      out[i] *= l; out[i + 1] *= l; out[i + 2] *= l;
    }
  }
  return out;
}

/**
 * `displace`: moved by a map, `amount` at most. The map is seeded noise
 * (`size`, `octaves`, `seed`) or `map: { layers }`, their luminance
 * (`mode: 'gradient'`, the default, bends the layer along the map's
 * slopes like light through a surface; `'channels'` moves by red along x
 * and green along y, as Photoshop's Displace).
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'displace' }} fx
 * @param {any} ctx
 * @returns {Promise<Uint8ClampedArray>}
 */
export async function displace(img, fx, ctx) {
  const { width: w, height: h } = img;
  const amount = px(fx.amount, ctx, img, '2vmin');
  /** @type {Float32Array} */
  let dx;
  /** @type {Float32Array} */
  let dy;
  if (fx.map?.layers && ctx.stack) {
    const parts = await ctx.stack(fx.map.layers, { tag: 'dm' });
    const m = await drawLayer({ defs: parts.map((/** @type {any} */ p) => p.defs).join(''), body: parts.map((/** @type {any} */ p) => p.body).join('') }, ctx, w, h);
    if (!m) return img.data;
    dx = new Float32Array(w * h);
    dy = new Float32Array(w * h);
    if (fx.mode === 'channels') {
      for (let i = 0, p = 0; p < dx.length; i += 4, p++) { dx[p] = (m[i] - 128) / 128; dy[p] = (m[i + 1] - 128) / 128; }
    } else {
      const l = new Float32Array(w * h);
      for (let i = 0, p = 0; p < l.length; i += 4, p++) l[p] = (luma(m, i) * m[i + 3]) / (255 * 255);
      gaussian(l, w, h, 1, Math.max(1, amount / 6));
      // Slopes, scaled so a full-height edge moves `amount`.
      const k = Math.max(1, amount / 2);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const p = y * w + x;
          dx[p] = (l[y * w + Math.min(w - 1, x + 1)] - l[y * w + Math.max(0, x - 1)]) * k;
          dy[p] = (l[Math.min(h - 1, y + 1) * w + x] - l[Math.max(0, y - 1) * w + x]) * k;
        }
      }
    }
  } else {
    const size = Math.max(1, px(fx.size, ctx, img, '12vmin'));
    const seed = seedFor(fx, ctx);
    dx = noiseField(w, h, size, seed, fx.octaves ?? 3);
    dy = noiseField(w, h, size, seed + 7919, fx.octaves ?? 3);
  }
  return remap(img, (x, y, at) => {
    const p = y * w + x;
    at[0] = x + dx[p] * amount;
    at[1] = y + dy[p] * amount;
  });
}
