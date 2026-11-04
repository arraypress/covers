/**
 * zlib deflate and inflate: Node's zlib, else `CompressionStream` and
 * `DecompressionStream` (browsers, Workers). For PNG textures and WOFF.
 *
 * @module platform/compress
 */

import { node } from './node.js';

/**
 * zlib-deflate synchronously, when the platform can (Node).
 *
 * @param {Uint8Array} data
 * @returns {Uint8Array | undefined}
 */
export function deflateSync(data) {
  const z = node('zlib');
  return z ? z.deflateSync(data, { level: 9 }) : undefined;
}

/**
 * zlib-deflate: Node's zlib, else `CompressionStream` (browsers, Workers).
 * The two may differ in bytes but both are valid zlib streams.
 *
 * @param {Uint8Array} data
 * @returns {Promise<Uint8Array>}
 */
export async function deflate(data) {
  return deflateSync(data) ?? stream(data, new CompressionStream('deflate'));
}

/**
 * zlib-inflate (WOFF tables).
 *
 * @param {Uint8Array} data
 * @returns {Promise<Uint8Array>}
 */
export async function inflate(data) {
  const z = node('zlib');
  return z ? z.inflateSync(data) : stream(data, new DecompressionStream('deflate'));
}

/**
 * @param {Uint8Array} data
 * @param {TransformStream} ts
 * @returns {Promise<Uint8Array>}
 */
async function stream(data, ts) {
  const out = new Response(new Blob([/** @type {any} */ (data)]).stream().pipeThrough(ts));
  return new Uint8Array(await out.arrayBuffer());
}

/**
 * Brotli-decompress synchronously, when the platform can (Node's zlib).
 *
 * @param {Uint8Array} data
 * @returns {Uint8Array | undefined}
 */
export function unbrotliSync(data) {
  const z = node('zlib');
  if (!z?.brotliDecompressSync) return undefined;
  const out = z.brotliDecompressSync(data);
  return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
}

/**
 * Brotli-decompress (WOFF2): Node's zlib, else `DecompressionStream('brotli')`
 * where the runtime has it. Undefined where neither can.
 *
 * @param {Uint8Array} data
 * @returns {Promise<Uint8Array | undefined>}
 */
export async function unbrotli(data) {
  const sync = unbrotliSync(data);
  if (sync) return sync;
  try {
    return await stream(data, new DecompressionStream(/** @type {any} */ ('brotli')));
  } catch {
    return undefined;
  }
}
