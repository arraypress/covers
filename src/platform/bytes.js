/**
 * Byte helpers that work the same in Node, browsers and Workers (no
 * `Buffer`). Where Node's `Buffer` is present it's used for speed; the
 * output is identical either way.
 *
 * @module bytes
 */

const B = /** @type {any} */ (globalThis).Buffer;

/**
 * Bytes as a `Uint8Array` view.
 *
 * @param {Uint8Array | ArrayBuffer | ArrayBufferView} v
 * @returns {Uint8Array}
 */
export function u8(v) {
  if (v instanceof Uint8Array) return v;
  if (v instanceof ArrayBuffer) return new Uint8Array(v);
  if (ArrayBuffer.isView(v)) return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  throw new TypeError('Expected bytes (Uint8Array or ArrayBuffer)');
}

/** @param {unknown} v @returns {v is Uint8Array | ArrayBuffer} */
export const isBytes = (v) => v instanceof Uint8Array || v instanceof ArrayBuffer || ArrayBuffer.isView(v);

/**
 * Base64-encode bytes.
 *
 * @param {Uint8Array | ArrayBuffer} bytes
 * @returns {string}
 */
export function toBase64(bytes) {
  const b = u8(bytes);
  if (B) return B.from(b.buffer, b.byteOffset, b.byteLength).toString('base64');
  let out = '';
  for (let i = 0; i < b.length; i += 0x8000) out += String.fromCharCode.apply(null, /** @type {any} */ (b.subarray(i, i + 0x8000)));
  return btoa(out);
}

/**
 * Decode base64.
 *
 * @param {string} s
 * @returns {Uint8Array}
 */
export function fromBase64(s) {
  if (B) return new Uint8Array(B.from(s, 'base64'));
  const bin = atob(s.replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** @param {Uint8Array} b @returns {string} Each byte as one char. */
export function latin1(b) {
  let s = '';
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
}

/** @param {Uint8Array | ArrayBuffer} b @returns {string} */
export const utf8 = (b) => new TextDecoder().decode(u8(b));

/** @param {string} s @returns {Uint8Array} */
export const encodeUtf8 = (s) => new TextEncoder().encode(s);

/**
 * Join byte arrays.
 *
 * @param {Uint8Array[]} parts
 * @returns {Uint8Array}
 */
export function concat(parts) {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/**
 * Decode a `data:` URI.
 *
 * @param {string} uri
 * @returns {Uint8Array | undefined} Its bytes, or undefined when it isn't one.
 */
export function fromDataUri(uri) {
  const m = /^data:([^,]*?),(.*)$/s.exec(uri);
  if (!m) return undefined;
  return /;base64$/i.test(m[1]) ? fromBase64(m[2]) : encodeUtf8(decodeURIComponent(m[2]));
}

/**
 * Hex digest with Web Crypto (Node 20+, browsers, Workers).
 *
 * @param {'SHA-1' | 'SHA-256'} algo
 * @param {Uint8Array | string} data
 * @returns {Promise<string>}
 */
export async function hexDigest(algo, data) {
  const buf = await globalThis.crypto.subtle.digest(algo, typeof data === 'string' ? encodeUtf8(data) : u8(data));
  return Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, '0')).join('');
}
