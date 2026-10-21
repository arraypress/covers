/**
 * Fonts: loading, decoding and picking a face for a text layer.
 *
 * Text is shaped by HarfBuzz (`harfbuzzjs`, WebAssembly) and drawn as
 * outlines, so the rendered cover never depends on fonts installed on the
 * build machine. Inter (Latin, 400/500/600/700, about 120 KB of WOFF) ships
 * in `fonts/` and is always available as the family `Inter`.
 *
 * Accepted formats: TrueType/OpenType (`.ttf`/`.otf`) and WOFF (`.woff`).
 * WOFF2 is rejected with a clear error: it needs Brotli plus glyph-table
 * reconstruction, which isn't worth carrying for a build tool.
 *
 * @module fonts
 */

import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

/** @type {Promise<typeof import('harfbuzzjs')> | undefined} */
let hbPromise;

/**
 * Load HarfBuzz once (its WebAssembly initialises on import, so it's
 * imported lazily: covers with no text never pay for it).
 *
 * @returns {Promise<typeof import('harfbuzzjs')>} The harfbuzzjs module.
 */
export function harfbuzz() {
  hbPromise ??= import('harfbuzzjs');
  return hbPromise;
}

/** Bundled weights of Inter. */
const BUNDLED = [400, 500, 600, 700];

/** @type {import('./index.js').FontSource[] | undefined} */
let bundled;

/**
 * The bundled Inter faces, read from disk once per process.
 *
 * @returns {import('./index.js').FontSource[]} Inter 400/500/600/700.
 */
export function bundledFonts() {
  bundled ??= BUNDLED.map((weight) => ({
    name: 'Inter',
    weight,
    style: 'normal',
    // A URL, not `.pathname`: a path with a space would be percent-encoded.
    data: readFileSync(new URL(`../fonts/inter-latin-${weight}.woff`, import.meta.url)),
  }));
  return bundled;
}

/**
 * Turn font bytes into a bare sfnt (TrueType/OpenType) HarfBuzz can read.
 *
 * @param {Uint8Array | ArrayBuffer} input - `.ttf`, `.otf` or `.woff` bytes.
 * @returns {Uint8Array} sfnt bytes.
 * @throws {TypeError} On WOFF2 or bytes that aren't a font.
 */
export function decodeFont(input) {
  const buf = input instanceof Uint8Array ? input : new Uint8Array(input);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.byteLength < 12) throw new TypeError('Font data is too short to be a font');
  const tag = view.getUint32(0);
  if (tag === 0x774f4632) throw new TypeError('WOFF2 fonts are not supported: pass a .woff, .ttf or .otf');
  if (tag !== 0x774f4646) {
    // 0x00010000 TrueType, 'OTTO' CFF, 'true' old Apple TrueType.
    if (tag === 0x00010000 || tag === 0x4f54544f || tag === 0x74727565) return buf;
    throw new TypeError('Font data is not TrueType, OpenType or WOFF');
  }

  const flavor = view.getUint32(4);
  const count = view.getUint16(12);
  const tables = [];
  for (let i = 0; i < count; i++) {
    const o = 44 + i * 20;
    tables.push({
      tag: view.getUint32(o),
      offset: view.getUint32(o + 4),
      compLength: view.getUint32(o + 8),
      origLength: view.getUint32(o + 12),
      checksum: view.getUint32(o + 16),
    });
  }
  let pow = 1;
  let log = 0;
  while (pow * 2 <= count) { pow *= 2; log++; }

  const headerSize = 12 + 16 * count;
  const pad = (n) => (n + 3) & ~3;
  const total = tables.reduce((sum, t) => sum + pad(t.origLength), headerSize);
  const out = new Uint8Array(total);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, flavor);
  ov.setUint16(4, count);
  ov.setUint16(6, pow * 16);
  ov.setUint16(8, log);
  ov.setUint16(10, count * 16 - pow * 16);

  let offset = headerSize;
  tables.forEach((t, i) => {
    const src = buf.subarray(t.offset, t.offset + t.compLength);
    const data = t.compLength < t.origLength ? inflateSync(src) : src;
    out.set(data, offset);
    const rec = 12 + i * 16;
    ov.setUint32(rec, t.tag);
    ov.setUint32(rec + 4, t.checksum);
    ov.setUint32(rec + 8, offset);
    ov.setUint32(rec + 12, t.origLength);
    offset += pad(t.origLength);
  });
  return out;
}

/**
 * A loaded face, ready to shape with.
 *
 * @typedef {object} LoadedFont
 * @property {string} name - Family name.
 * @property {number} weight - Weight.
 * @property {string} style - `'normal'` or `'italic'`.
 * @property {any} font - The harfbuzzjs `Font`.
 * @property {number} upem - Units per em.
 * @property {number} ascender - In font units.
 * @property {number} descender - In font units (negative).
 * @property {number} capHeight - In font units.
 * @property {Map<number, (string | number)[]>} paths - Glyph outline cache.
 */

/** @type {WeakMap<object, Promise<LoadedFont>>} */
const loaded = new WeakMap();

/**
 * Load one font source (cached per data buffer, so the bundled faces and a
 * caller's reused buffers are decoded once per process).
 *
 * @param {import('./index.js').FontSource} source - The font.
 * @returns {Promise<LoadedFont>} The loaded face.
 */
export function loadFont(source) {
  const key = /** @type {object} */ (source.data);
  let p = loaded.get(key);
  if (!p) {
    p = (async () => {
      const hb = await harfbuzz();
      const face = new hb.Face(new hb.Blob(decodeFont(source.data)));
      const font = new hb.Font(face);
      const ext = font.hExtents();
      const cap = font.getMetricPosition?.(hb.MetricsTag.CAP_HEIGHT);
      const upem = face.upem;
      return {
        name: source.name,
        weight: source.weight ?? 400,
        style: source.style ?? 'normal',
        font,
        upem,
        ascender: ext.ascender,
        descender: ext.descender,
        capHeight: cap || capFromGlyph(font) || upem * 0.7,
        paths: new Map(),
      };
    })();
    loaded.set(key, p);
  }
  // The same bytes can be registered under another name or weight.
  return p.then((f) => ({ ...f, name: source.name, weight: source.weight ?? 400, style: source.style ?? 'normal' }));
}

/**
 * The height of `H` when the font has no OS/2 cap height.
 *
 * @param {any} font - A harfbuzzjs Font.
 * @returns {number | undefined} Cap height in font units.
 */
function capFromGlyph(font) {
  const gid = font.nominalGlyph?.(0x48);
  const ext = gid != null ? font.glyphExtents?.(gid) : undefined;
  return ext ? ext.yBearing : undefined;
}

/**
 * Pick the face for a family, weight and style: the closest weight within
 * the family (CSS's matching rule, simplified), falling back to Inter.
 *
 * @param {import('./index.js').FontSource[]} sources - The available fonts.
 * @param {string} family - Wanted family.
 * @param {number} weight - Wanted weight.
 * @param {string} [style='normal'] - Wanted style.
 * @returns {import('./index.js').FontSource} The chosen source.
 */
export function pickFont(sources, family, weight, style = 'normal') {
  let pool = sources.filter((s) => s.name.toLowerCase() === family.toLowerCase());
  if (!pool.length) pool = sources.filter((s) => s.name === 'Inter');
  if (!pool.length) pool = sources;
  const styled = pool.filter((s) => (s.style ?? 'normal') === style);
  if (styled.length) pool = styled;
  return pool.reduce((best, s) => (Math.abs((s.weight ?? 400) - weight) < Math.abs((best.weight ?? 400) - weight) ? s : best));
}
