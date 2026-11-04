/**
 * Content-hash cache keys (Web Crypto: the same keys on every platform).
 *
 * @module render/key
 */

import { loadBytes } from '../platform/index.js';
import { hexDigest, u8, isBytes } from '../platform/bytes.js';
import { fontBytes } from '../fonts.js';
import { cover } from '../render.js';
import { VERSION } from '../version.js';

/**
 * A stable cache key for a cover and its output options: a SHA-256 of the
 * resolved cover (font and image bytes hashed by content), the output
 * format and quality, and this package's version.
 *
 * @param {import('../index.js').CoverOptions | import('../index.js').Cover} input - The cover.
 * @param {import('../index.js').RenderImageOptions} [options]
 * @returns {Promise<string>} 40 hex characters.
 *
 * @example
 * await coverKey({ recipe: 'aurora', seed: 'a' }, { format: 'webp' }); // 'f3a9…'
 */
export async function coverKey(input, options = {}) {
  const c = cover(input);
  const head = `covers@${VERSION}\n${options.format ?? 'webp'}:${options.quality ?? ''}:${options.effort ?? ''}:${options.lossless ?? c.output?.lossless ?? ''}\n`;
  // Files a layer reads (an image's src, a mesh's photo, a waveform's audio) are hashed by content.
  const file = async (/** @type {any} */ v) => (typeof v === 'string' && !v.startsWith('data:') ? digest(await loadBytes(v)) : isBytes(v) ? digest(v) : v);
  const layers = await Promise.all(c.layers.map(async (l) => {
    const x = /** @type {any} */ (l);
    if (l.type === 'image') return { ...l, src: await file(x.src) };
    if (l.type === 'mesh' && x.from) return { ...l, from: await file(x.from) };
    if (l.type === 'waveform' && x.audio) return { ...l, audio: await file(x.audio) };
    return l;
  }));
  const body = await hashBytes({
    width: c.width,
    height: c.height,
    seed: c.seed,
    palette: c.palette,
    layers,
    radius: c.radius,
    fonts: await Promise.all(c.fonts.map(async (f) => ({ ...f, data: await digest(f.data ?? await fontBytes(f)) }))),
    ...(c.print ? { print: c.print } : {}),
    ...(c.side && c.side !== 'front' ? { side: c.side } : {}),
  });
  return (await hexDigest('SHA-256', head + stable(body))).slice(0, 40);
}

/** @param {Uint8Array | ArrayBuffer} data @returns {Promise<string>} SHA-1 hex. */
function digest(data) {
  return hexDigest('SHA-1', u8(data));
}

/**
 * Replace every byte array in a value with its SHA-1 (what {@link stable}
 * writes for bytes), so the hashing itself can stay synchronous.
 *
 * @param {unknown} v
 * @returns {Promise<unknown>}
 */
async function hashBytes(v) {
  if (isBytes(v)) return { [BYTES]: await digest(/** @type {any} */ (v)) };
  if (Array.isArray(v)) return Promise.all(v.map(hashBytes));
  if (v && typeof v === 'object' && !(v instanceof URL)) {
    const out = /** @type {Record<string, unknown>} */ ({});
    for (const [k, x] of Object.entries(v)) out[k] = await hashBytes(x);
    return out;
  }
  return v;
}

const BYTES = Symbol('bytes');

/**
 * JSON with sorted keys and bytes hashed, for hashing.
 *
 * @param {unknown} v
 * @returns {string}
 */
function stable(v) {
  if (v && typeof v === 'object' && BYTES in v) return JSON.stringify(/** @type {any} */ (v)[BYTES]);
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v instanceof URL) return JSON.stringify(v.href);
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().filter((k) => /** @type {any} */ (v)[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable(/** @type {any} */ (v)[k])}`).join(',')}}`;
  }
  if (typeof v === 'function') return JSON.stringify(String(v));
  return JSON.stringify(v) ?? 'null';
}
