/**
 * Loading bytes from anything: bytes, Blobs and Responses, `data:` URIs,
 * paths (Node), URLs (fetched where allowed), or a `configure({ load })`
 * hook.
 *
 * @module platform/load
 */

import { isBytes, u8, fromDataUri } from './bytes.js';
import { node, isNode } from './node.js';
import { settings } from './settings.js';

/** @returns {boolean} */
const networkAllowed = () => settings.network ?? !isNode();

/** @returns {typeof fetch} */
function fetcher() {
  const f = settings.fetch ?? globalThis.fetch;
  if (!f) throw new Error('No fetch available to load a URL: pass bytes, or configure({ fetch })');
  return f;
}

/**
 * Whatever a loader handed back, as bytes.
 *
 * @param {any} v
 * @returns {Promise<Uint8Array>}
 */
async function asBytes(v) {
  if (isBytes(v)) return u8(v);
  if (typeof v?.arrayBuffer === 'function') {
    if (typeof v.ok === 'boolean' && !v.ok) throw new Error(`Couldn't load ${v.url}: HTTP ${v.status}`);
    return new Uint8Array(await v.arrayBuffer());
  }
  throw new TypeError('A loader must return bytes, an ArrayBuffer, a Blob or a Response');
}

/**
 * Load bytes: an image, font, audio file or icon set.
 *
 * @param {any} src - Bytes, a Blob, a Response, a `data:` URI, a URL, or a path (Node).
 * @param {'image' | 'font' | 'audio' | 'icons' | 'file'} [kind='file'] - What it is (for errors and the loader).
 * @returns {Promise<Uint8Array>} The bytes (a Node Buffer when read from disk).
 */
export async function loadBytes(src, kind = 'file') {
  if (isBytes(src)) return u8(src);
  if (src && typeof src === 'object' && !(src instanceof URL)) return asBytes(src);
  if (settings.load) {
    const r = await settings.load(src, { kind });
    if (r != null) return asBytes(r);
  }
  const s = String(src instanceof URL ? src.href : src);
  const data = fromDataUri(s);
  if (data) return data;
  if (/^https?:/i.test(s)) {
    if (!networkAllowed()) {
      throw new TypeError(kind === 'image'
        ? 'Image src must be a local file or bytes: covers never fetch from the network (allow it with configure({ network: true }))'
        : `${kind} "${s}" is a URL, and covers doesn't fetch from the network in Node unless asked: configure({ network: true }) or pass bytes`);
    }
    return asBytes(await fetcher()(s));
  }
  const fsp = node('fs/promises');
  const isFileUrl = s.startsWith('file:');
  if (fsp && (isFileUrl || !/^[a-z][\w+.-]*:/i.test(s))) return fsp.readFile(isFileUrl ? new URL(s) : s);
  // A browser: a relative or absolute URL, against the page.
  const base = /** @type {any} */ (globalThis).document?.baseURI ?? /** @type {any} */ (globalThis).location?.href;
  if (base || /^[a-z][\w+.-]*:/i.test(s)) return asBytes(await fetcher()(new URL(s, base).href));
  throw new Error(`Can't load ${kind} "${s}" here: pass bytes, or give covers a loader with configure({ load })`);
}

export { asBytes };
