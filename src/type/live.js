/**
 * Live text: the `@font-face` rule for a face, embedded (or linked by URL)
 * once per document.
 *
 * @module type/live
 */

import { fontBytes } from '../fonts.js';
import { toBase64 } from '../platform/bytes.js';

/** Faces embedded in this document already (live text). @type {WeakMap<object, Set<string>>} */
const embedded = new WeakMap();

/**
 * `@font-face` for a face, once per document.
 *
 * @param {import('../fonts.js').LoadedFont} face
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {Promise<{ family: string, css: string }>}
 */
export async function fontFace(face, ctx) {
  const src = face.source;
  const family = `covers-${src.name}-${Array.isArray(src.weight) ? 'var' : src.weight ?? 400}-${src.style ?? 'normal'}`.replace(/[^\w-]/g, '_');
  const doc = /** @type {any} */ (ctx).doc ?? ctx;
  let seen = embedded.get(doc);
  if (!seen) embedded.set(doc, (seen = new Set()));
  if (seen.has(family)) return { family, css: '' };
  seen.add(family);
  let url;
  if (src.data == null && typeof src.src === 'string' && !src.src.startsWith('covers:')) url = src.src;
  else {
    const bytes = await fontBytes(src);
    const tag = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0);
    const mime = tag === 0x774f4646 ? 'font/woff' : tag === 0x774f4632 ? 'font/woff2' : tag === 0x4f54544f ? 'font/otf' : 'font/ttf';
    url = `data:${mime};base64,${toBase64(bytes)}`;
  }
  const weight = Array.isArray(src.weight) ? `${src.weight[0]} ${src.weight[1]}` : src.weight ?? 400;
  return { family, css: `@font-face{font-family:"${family}";src:url("${url}");font-weight:${weight};font-style:${src.style ?? 'normal'}}` };
}
