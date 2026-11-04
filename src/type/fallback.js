/**
 * Glyph fallback: characters the chosen font lacks are shaped in a
 * fallback font (the layer's `fallback`, then any font registered with
 * `fallback: true`), and failing those drawn from the built-in symbols
 * (✺ ✦ ✶ ★ ☆ ♥ ♡ ▶ ◀ ● ◆ ■ ♪). Text the font covers shapes exactly as
 * before (one HarfBuzz run).
 *
 * @module type/fallback
 */

import { shape } from '../text.js';
import { loadFont, pickFont } from '../fonts.js';
import { symbolFace } from './symbols.js';

/**
 * The faces to fall back to, in order.
 *
 * @param {import('../layers.js').RenderContext} ctx
 * @param {{ fallback?: string | string[], weight?: number, style?: string }} o
 * @returns {Promise<import('../fonts.js').LoadedFont[]>}
 */
export async function fallbackFaces(ctx, o) {
  const names = o.fallback == null ? [] : [].concat(/** @type {any} */ (o.fallback));
  const sources = [
    ...names.map((n) => ctx.fonts.find((f) => f.name.toLowerCase() === String(n).toLowerCase()) ? pickFont(ctx.fonts, n, o.weight ?? 600, o.style) : undefined),
    ...ctx.fonts.filter((f) => /** @type {any} */ (f).fallback),
  ].filter(Boolean);
  const faces = [];
  for (const s of new Set(sources)) faces.push(await loadFont(/** @type {any} */ (s)));
  faces.push(symbolFace());
  return faces;
}

/** Characters each face lacks, by face. @type {WeakMap<object, Map<string, boolean>>} */
const missing = new WeakMap();

/**
 * Whether a face has a glyph for a character.
 *
 * @param {import('../fonts.js').LoadedFont} face
 * @param {string} ch
 * @returns {boolean}
 */
export function covers(face, ch) {
  let m = missing.get(face.paths);
  if (!m) missing.set(face.paths, (m = new Map()));
  let has = m.get(ch);
  if (has === undefined) {
    has = /\s/.test(ch) || face.shapeRun(ch).every((g) => g.gid !== 0);
    m.set(ch, has);
  }
  return has;
}

/**
 * Shape a line, falling back face by face for characters the face lacks.
 * Glyphs from another face carry it (`glyph.face`).
 *
 * @param {import('../fonts.js').LoadedFont} face
 * @param {string} text
 * @param {number} size
 * @param {number} tracking - px between clusters.
 * @param {import('../fonts.js').LoadedFont[]} [fallbacks]
 * @returns {import('../text.js').Shaped}
 */
export function shapeText(face, text, size, tracking, fallbacks) {
  const run = shape(face, text, size, tracking);
  if (!fallbacks?.length || run.glyphs.every((g) => g.gid !== 0)) return run;
  // Segments of one face each, in order.
  /** @type {{ face: import('../fonts.js').LoadedFont, text: string }[]} */
  const segs = [];
  for (const ch of Array.from(text)) {
    const f = covers(face, ch) ? face : fallbacks.find((x) => covers(x, ch)) ?? face;
    const last = segs[segs.length - 1];
    if (last && last.face === f) last.text += ch;
    else segs.push({ face: f, text: ch });
  }
  /** @type {import('../text.js').Shaped['glyphs']} */
  const glyphs = [];
  let x = 0;
  let at = 0;
  segs.forEach((seg, i) => {
    const part = shape(seg.face, seg.text, size, tracking);
    for (const g of part.glyphs) {
      const placed = { ...g, x: g.x + x, cluster: (g.cluster ?? 0) + at };
      glyphs.push(seg.face === face ? placed : { ...placed, face: seg.face });
    }
    x += part.width + (i < segs.length - 1 ? tracking : 0);
    at += seg.text.length;
  });
  return { glyphs, width: x };
}
