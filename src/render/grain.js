/**
 * Raster grain for `renderImage`: seeded pixel noise blended in JS (librsvg's
 * feTurbulence is ~20× slower at cover sizes).
 *
 * @module render/grain
 */

import { VARY_FLOOR, VARY_PEAK } from '../layers.js';

/**
 * Seeded film-grain values, one per pixel (three with `monochrome: false`),
 * at `size` px per grain (upscaled smoothly). Each value is the mean of two
 * uniform draws, a triangular distribution: fewer harsh extremes than flat
 * noise, closer to film.
 *
 * @param {any} sharp - The sharp module.
 * @param {number} width @param {number} height
 * @param {import('../index.js').GrainLayer} layer
 * @param {import('../rng.js').Rng} rng - The layer's stream.
 * @returns {Promise<{ data: Buffer, channels: 1 | 3 }>} Full-size noise.
 */
export async function noise(sharp, width, height, layer, rng) {
  const size = Math.max(1, layer.size ?? 1);
  const channels = layer.monochrome === false ? 3 : 1;
  const nw = Math.ceil(width / size);
  const nh = Math.ceil(height / size);
  const data = Buffer.alloc(nw * nh * channels);
  // xorshift32 seeded from the layer's stream: one 32-bit draw gives two
  // values, so 1.4M pixels cost a few milliseconds.
  let x = (rng.next() * 4294967296) >>> 0 || 1;
  for (let i = 0; i < data.length; i++) {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    data[i] = ((x & 255) + ((x >>> 8) & 255)) >>> 1;
  }
  if (nw === width && nh === height) return { data, channels };
  const out = await sharp(data, { raw: { width: nw, height: nh, channels } })
    .resize(width, height, { kernel: 'cubic', fit: 'fill' })
    .raw()
    .toBuffer();
  return { data: out, channels };
}

/** Separable blend modes (W3C Compositing Level 1), channel values 0–1. */
const BLENDS = /** @type {Record<string, (b: number, s: number) => number>} */ ({
  normal: (_b, s) => s,
  multiply: (b, s) => b * s,
  screen: (b, s) => b + s - b * s,
  overlay: (b, s) => (b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s)),
  'soft-light': (b, s) => {
    if (s <= 0.5) return b - (1 - 2 * s) * b * (1 - b);
    const d = b <= 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
    return b + (2 * s - 1) * (d - b);
  },
});

/**
 * A 256×256 lookup (backdrop × noise → result) for one blend and strength:
 * cheaper than the blend maths per pixel.
 *
 * @param {(b: number, s: number) => number} blend
 * @param {number} amount
 * @returns {Uint8Array}
 */
function grainTable(blend, amount) {
  const table = new Uint8Array(65536);
  for (let b = 0; b < 256; b++) {
    for (let s = 0; s < 256; s++) {
      const cb = b / 255;
      table[(b << 8) | s] = Math.round((cb + amount * (blend(cb, s / 255) - cb)) * 255);
    }
  }
  return table;
}

/**
 * Blend grain into RGBA pixels in place, at the layer's `amount`.
 * Done in JS rather than with sharp's `composite` blend modes, whose
 * overlay with a partly transparent layer flattens the noise to almost
 * nothing (measured σ 0.5 against the expected 5.9 on mid grey).
 *
 * @param {Buffer} pixels - RGBA pixels (modified).
 * @param {{ data: Buffer, channels: 1 | 3, width: number, height: number }} grain - Noise from {@link noise}, and the canvas size.
 * @param {import('../index.js').GrainLayer} layer - The grain layer.
 * @returns {void}
 */
export function applyGrain(pixels, grain, layer) {
  const amount = Math.max(0, Math.min(1, (layer.amount ?? 0.08) * (layer.opacity ?? 1)));
  const blend = BLENDS[layer.blend ?? 'overlay'];
  if (!blend) throw new TypeError(`Unknown grain blend "${layer.blend}" (${Object.keys(BLENDS).join(', ')})`);
  const table = grainTable(blend, amount);
  const { data, channels } = grain;
  if (layer.vary === 'edges') {
    // Heavier toward the edges: per-pixel strength from the centre out, as in the SVG mask.
    const { width, height } = grain;
    const peak = Math.min(1, amount * VARY_PEAK);
    const tables = Array.from({ length: 17 }, (_, k) => grainTable(blend, peak * (VARY_FLOOR + (1 - VARY_FLOOR) * (k / 16))));
    const half = Math.hypot(width, height) / 2;
    for (let y = 0, i = 0, j = 0; y < height; y++) {
      for (let x = 0; x < width; x++, i += 4, j += channels) {
        const t = tables[Math.min(16, Math.round((Math.hypot(x - width / 2, y - height / 2) / half) * 16))];
        pixels[i] = t[(pixels[i] << 8) | data[j]];
        pixels[i + 1] = t[(pixels[i + 1] << 8) | data[j + (channels === 3 ? 1 : 0)]];
        pixels[i + 2] = t[(pixels[i + 2] << 8) | data[j + (channels === 3 ? 2 : 0)]];
      }
    }
    return;
  }
  for (let i = 0, j = 0; i < pixels.length; i += 4, j += channels) {
    pixels[i] = table[(pixels[i] << 8) | data[j]];
    pixels[i + 1] = table[(pixels[i + 1] << 8) | data[j + (channels === 3 ? 1 : 0)]];
    pixels[i + 2] = table[(pixels[i + 2] << 8) | data[j + (channels === 3 ? 2 : 0)]];
  }
}
