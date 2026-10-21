/**
 * A minimal PNG encoder (8-bit greyscale, RGB or RGBA; no filtering), so
 * layers that are pixels by nature (dithers, print textures) can embed
 * themselves in an SVG without sharp.
 *
 * @module png
 */

import { deflateSync } from 'node:zlib';

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

/** @param {string} type @param {Uint8Array} data @returns {Buffer} */
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/**
 * Encode pixels as a PNG.
 *
 * @param {Uint8Array} pixels - Row-major samples.
 * @param {number} width
 * @param {number} height
 * @param {1 | 3 | 4} [channels=4] - Grey, RGB or RGBA.
 * @returns {Buffer} PNG bytes.
 *
 * @example
 * encodePng(new Uint8Array([0, 255]), 2, 1, 1); // a black and a white pixel
 */
export function encodePng(pixels, width, height, channels = 4) {
  const stride = width * channels;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = { 1: 0, 3: 2, 4: 6 }[channels];
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/**
 * A PNG as a data URI.
 *
 * @param {Buffer} png
 * @returns {string}
 */
export const pngUri = (png) => `data:image/png;base64,${png.toString('base64')}`;
