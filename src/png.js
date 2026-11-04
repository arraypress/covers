/**
 * A minimal PNG encoder (8-bit greyscale, RGB or RGBA; no filtering), so
 * layers that are pixels by nature (dithers, print textures) can embed
 * themselves in an SVG without sharp.
 *
 * @module png
 */

import { deflateSync, deflate } from './platform/index.js';
import { concat, toBase64 } from './platform/bytes.js';

/** CRC-32 table (PNG's polynomial). */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** @param {Uint8Array} bytes @returns {number} */
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** @param {string} type @param {Uint8Array} data @returns {Uint8Array} */
function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/**
 * The filtered scanlines and header of a PNG.
 *
 * @param {Uint8Array} pixels @param {number} width @param {number} height @param {1 | 3 | 4} channels
 * @returns {{ raw: Uint8Array, ihdr: Uint8Array }}
 */
function scanlines(pixels, width, height, channels) {
  const stride = width * channels;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    raw.set(pixels.subarray(y * stride, y * stride + stride), y * (stride + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  ihdr[8] = 8;
  ihdr[9] = /** @type {Record<number, number>} */ ({ 1: 0, 3: 2, 4: 6 })[channels];
  return { raw, ihdr };
}

const SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * zlib "stored" blocks: valid, uncompressed. The synchronous fallback where
 * the platform has no synchronous deflate (browsers, Workers).
 *
 * @param {Uint8Array} data
 * @returns {Uint8Array}
 */
function stored(data) {
  const parts = [new Uint8Array([0x78, 0x01])];
  for (let i = 0; i < data.length || i === 0; i += 65535) {
    const block = data.subarray(i, i + 65535);
    const last = i + 65535 >= data.length ? 1 : 0;
    parts.push(new Uint8Array([last, block.length & 255, block.length >> 8, ~block.length & 255, (~block.length >> 8) & 255]), block);
    if (last) break;
  }
  let a = 1;
  let b = 0;
  for (const x of data) { a = (a + x) % 65521; b = (b + a) % 65521; }
  const adler = new Uint8Array(4);
  new DataView(adler.buffer).setUint32(0, ((b << 16) | a) >>> 0);
  parts.push(adler);
  return concat(parts);
}

/**
 * Encode pixels as a PNG (synchronously: zlib in Node, stored blocks where
 * there's no synchronous deflate; {@link encodePngAsync} compresses
 * everywhere).
 *
 * @param {Uint8Array} pixels - Row-major samples.
 * @param {number} width
 * @param {number} height
 * @param {1 | 3 | 4} [channels=4] - Grey, RGB or RGBA.
 * @returns {Uint8Array} PNG bytes.
 *
 * @example
 * encodePng(new Uint8Array([0, 255]), 2, 1, 1); // a black and a white pixel
 */
export function encodePng(pixels, width, height, channels = 4) {
  const { raw, ihdr } = scanlines(pixels, width, height, channels);
  return concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw) ?? stored(raw)), chunk('IEND', new Uint8Array(0))]);
}

/**
 * Encode pixels as a PNG, compressed on every platform (Node's zlib, else
 * `CompressionStream`).
 *
 * @param {Uint8Array} pixels @param {number} width @param {number} height @param {1 | 3 | 4} [channels=4]
 * @returns {Promise<Uint8Array>}
 */
export async function encodePngAsync(pixels, width, height, channels = 4) {
  const { raw, ihdr } = scanlines(pixels, width, height, channels);
  return concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', await deflate(raw)), chunk('IEND', new Uint8Array(0))]);
}

/**
 * A PNG as a data URI.
 *
 * @param {Uint8Array} png
 * @returns {string}
 */
export const pngUri = (png) => `data:image/png;base64,${toBase64(png)}`;
