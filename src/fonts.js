/**
 * Fonts: loading, decoding and picking a face for a text layer.
 *
 * Text is shaped by HarfBuzz (`harfbuzzjs`, WebAssembly) and drawn as
 * outlines, so the rendered cover never depends on fonts installed on the
 * build machine. Where HarfBuzz can't run (Cloudflare Workers) a small
 * JavaScript TrueType reader (`sfnt.js`) draws the outlines instead. Inter
 * (Latin, 400/500/600/700, about 120 KB of WOFF) ships in `fonts/` and is
 * always available as the family `Inter`.
 *
 * A font is `{ name, data | src, weight, style }`: bytes, or a `src` loaded
 * like any file (a path in Node, a URL, or through `configure({ load })`).
 * Variable fonts take a weight range (`weight: [100, 900]`) and their axes
 * are set per text layer (`axes: { wdth: 75, SOFT: 100 }`); a variable
 * font's `wght` follows the layer's `weight`.
 *
 * Accepted formats: TrueType/OpenType (`.ttf`/`.otf`), WOFF (`.woff`) and
 * WOFF2 (`.woff2`: Brotli from the platform, Node's zlib or a browser's
 * `DecompressionStream('brotli')`, and the glyph tables rebuilt in
 * JavaScript). Where there's no Brotli (most Workers), convert WOFF2 to TTF
 * first (`scripts/woff2-to-ttf.mjs`).
 *
 * @module fonts
 */

import { shaperModule, loadBytes, inflate, unbrotli, unbrotliSync, packageFileSync, registry, node } from './platform/index.js';
import { u8 } from './platform/bytes.js';
import { parseSfnt } from './type/sfnt.js';
import { woff2Directory, woff2ToSfnt } from './type/woff2.js';

/** @param {Uint8Array} b @returns {boolean} Whether bytes are WOFF2. */
const isWoff2 = (b) => b.length >= 4 && b[0] === 0x77 && b[1] === 0x4f && b[2] === 0x46 && b[3] === 0x32;

/**
 * Load HarfBuzz once (its WebAssembly initialises on import, so it's
 * imported lazily: covers with no text never pay for it). Undefined where
 * it can't run (Workers), or with `configure({ shaper: 'js' })`: text then
 * uses the JavaScript outliner.
 *
 * @returns {Promise<typeof import('harfbuzzjs') | undefined>} The harfbuzzjs module.
 */
export function harfbuzz() {
  return shaperModule();
}

/** Bundled weights of Inter. */
const BUNDLED = [400, 500, 600, 700];

/** @type {import('./index.js').FontSource[] | undefined} */
let bundled;

/**
 * The bundled Inter faces: read from disk in Node (once per process),
 * else from an embedded module the first time one is drawn.
 *
 * @returns {import('./index.js').FontSource[]} Inter 400/500/600/700.
 */
export function bundledFonts() {
  bundled ??= BUNDLED.map((weight) => {
    // A URL, not `.pathname`: a path with a space would be percent-encoded.
    const data = packageFileSync(`fonts/inter-latin-${weight}.woff`);
    return /** @type {import('./index.js').FontSource} */ (data ? { name: 'Inter', weight, style: 'normal', data } : { name: 'Inter', weight, style: 'normal', src: `covers:inter-${weight}` });
  });
  return bundled;
}

/**
 * Every font a cover can use: its own, the registered ones, then Inter.
 *
 * @param {import('./index.js').FontSource[]} own
 * @returns {import('./index.js').FontSource[]}
 */
export function fontPool(own) {
  return [...own, ...registry, ...bundledFonts()];
}

/**
 * Register a font for every cover (by bytes or by `src`).
 *
 * @param {import('./index.js').FontSource} font
 * @returns {void}
 *
 * @example
 * registerFont({ name: 'Fraunces', src: '/fonts/Fraunces.ttf', weight: [100, 900] });
 */
export function registerFont(font) {
  if (!font?.name || (font.data == null && font.src == null)) throw new TypeError('registerFont() needs { name, data } or { name, src }');
  registry.push(font);
}

/** @type {Map<string, Promise<Uint8Array>>} */
const fetched = new Map();

/**
 * A font source's bytes (as given; still WOFF if it was).
 *
 * @param {import('./index.js').FontSource} source
 * @returns {Promise<Uint8Array>}
 */
export function fontBytes(source) {
  if (source.data != null) return Promise.resolve(u8(source.data));
  const src = String(source.src);
  let p = fetched.get(src);
  if (!p) {
    const m = /^covers:inter-(\d+)$/.exec(src);
    p = m
      ? import('./inter-data.js').then((d) => d.inter(Number(m[1])))
      : loadBytes(source.src, 'font');
    fetched.set(src, p);
  }
  return p;
}

/**
 * Turn font bytes into a bare sfnt (TrueType/OpenType) HarfBuzz can read,
 * synchronously (Node, where zlib is synchronous).
 *
 * @param {Uint8Array | ArrayBuffer} input - `.ttf`, `.otf`, `.woff` or `.woff2` bytes.
 * @returns {Uint8Array} sfnt bytes.
 * @throws {TypeError} On bytes that aren't a font.
 */
export function decodeFont(input) {
  const z = node('zlib');
  if (!z) throw new Error('decodeFont() is synchronous only in Node; use decodeFontAsync()');
  const bytes = u8(input);
  if (isWoff2(bytes)) return woff2ToSfnt(bytes, unbrotliSync(woff2Directory(bytes).payload));
  /** @type {Uint8Array | undefined} */
  let out;
  const gen = woffToSfnt(input);
  let step = gen.next();
  while (!step.done) step = gen.next(z.inflateSync(step.value));
  out = step.value;
  return out;
}

/**
 * {@link decodeFont} on any platform (`DecompressionStream` outside Node).
 *
 * @param {Uint8Array | ArrayBuffer} input
 * @returns {Promise<Uint8Array>}
 */
export async function decodeFontAsync(input) {
  const bytes = u8(input);
  if (isWoff2(bytes)) return woff2ToSfnt(bytes, await unbrotli(woff2Directory(bytes).payload));
  const gen = woffToSfnt(input);
  let step = gen.next();
  while (!step.done) step = gen.next(await inflate(step.value));
  return step.value;
}

/**
 * The WOFF → sfnt conversion, yielding each compressed table to be inflated.
 *
 * @param {Uint8Array | ArrayBuffer} input
 * @returns {Generator<Uint8Array, Uint8Array, Uint8Array>}
 */
function* woffToSfnt(input) {
  const buf = u8(input);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (buf.byteLength < 12) throw new TypeError('Font data is too short to be a font');
  const tag = view.getUint32(0);
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
  const pad = (/** @type {number} */ n) => (n + 3) & ~3;
  const total = tables.reduce((sum, t) => sum + pad(t.origLength), headerSize);
  const out = new Uint8Array(total);
  const ov = new DataView(out.buffer);
  ov.setUint32(0, flavor);
  ov.setUint16(4, count);
  ov.setUint16(6, pow * 16);
  ov.setUint16(8, log);
  ov.setUint16(10, count * 16 - pow * 16);

  let offset = headerSize;
  for (let i = 0; i < tables.length; i++) {
    const t = tables[i];
    const src = buf.subarray(t.offset, t.offset + t.compLength);
    const data = t.compLength < t.origLength ? yield src : src;
    out.set(data, offset);
    const rec = 12 + i * 16;
    ov.setUint32(rec, t.tag);
    ov.setUint32(rec + 4, t.checksum);
    ov.setUint32(rec + 8, offset);
    ov.setUint32(rec + 12, t.origLength);
    offset += pad(t.origLength);
  }
  return out;
}

/**
 * A shaped glyph, in font units.
 *
 * @typedef {object} RunGlyph
 * @property {number} gid
 * @property {number} cluster
 * @property {number} xAdvance
 * @property {number} xOffset
 * @property {number} yOffset
 */

/**
 * A loaded face, ready to shape with.
 *
 * @typedef {object} LoadedFont
 * @property {string} name - Family name.
 * @property {number} weight - Weight.
 * @property {string} style - `'normal'` or `'italic'`.
 * @property {any} font - The harfbuzzjs `Font`, or the JS face.
 * @property {number} upem - Units per em.
 * @property {number} ascender - In font units.
 * @property {number} descender - In font units (negative).
 * @property {number} capHeight - In font units.
 * @property {Map<number, (string | number)[]>} paths - Glyph outline cache.
 * @property {(text: string) => RunGlyph[]} shapeRun - Shape one line.
 * @property {(gid: number) => string} glyphToPath - Outline, font units, y up.
 * @property {Record<string, { min: number, default: number, max: number }>} axes - The font's variation axes.
 * @property {Record<string, number>} variations - The axis values in use.
 * @property {import('./index.js').FontSource} source - Where it came from.
 */

/** Faces by font bytes (then by variation settings). @type {WeakMap<object, Map<string, Promise<LoadedFont>>>} */
const loaded = new WeakMap();

/**
 * Load one font source, optionally at a variation (cached per data buffer
 * and settings, so the bundled faces and a caller's reused buffers are
 * decoded once per process).
 *
 * @param {import('./index.js').FontSource} source - The font.
 * @param {Record<string, number>} [variations] - Axis values (`{ wght: 650, wdth: 80 }`).
 * @returns {Promise<LoadedFont>} The loaded face.
 */
export async function loadFont(source, variations) {
  const bytes = await fontBytes(source);
  const vkey = variations && Object.keys(variations).length ? JSON.stringify(Object.entries(variations).sort()) : '';
  let byVar = loaded.get(bytes);
  if (!byVar) loaded.set(bytes, (byVar = new Map()));
  let p = byVar.get(vkey);
  if (!p) {
    p = (async () => {
      const sfnt = await decodeFontAsync(bytes);
      const hb = await shaperModule();
      if (hb) {
        const face = new hb.Face(new hb.Blob(sfnt));
        const font = new hb.Font(face);
        const axes = vkey && typeof face.getAxisInfos === 'function' ? face.getAxisInfos() : {};
        /** @type {Record<string, number>} */
        const used = {};
        if (vkey && variations) {
          const list = [];
          for (const [tag, value] of Object.entries(variations)) {
            const a = axes[tag];
            if (!a) continue;
            used[tag] = Math.min(a.max, Math.max(a.min, value));
            list.push(new hb.Variation(tag, used[tag]));
          }
          if (list.length) font.setVariations(list);
        }
        const ext = font.hExtents();
        const cap = font.getMetricPosition?.(hb.MetricsTag.CAP_HEIGHT);
        const upem = face.upem;
        return {
          name: source.name,
          weight: 400,
          style: 'normal',
          font,
          upem,
          ascender: ext.ascender,
          descender: ext.descender,
          capHeight: cap || capFromGlyph(font) || upem * 0.7,
          paths: new Map(),
          axes,
          variations: used,
          source,
          glyphToPath: (/** @type {number} */ gid) => font.glyphToPath(gid),
          shapeRun: (/** @type {string} */ text) => {
            const buffer = new hb.Buffer();
            buffer.addText(text);
            buffer.guessSegmentProperties();
            hb.shape(font, buffer);
            const infos = buffer.getGlyphInfos();
            const positions = buffer.getGlyphPositions();
            return infos.map((/** @type {any} */ info, /** @type {number} */ i) => ({ gid: info.codepoint, cluster: info.cluster, xAdvance: positions[i].xAdvance, xOffset: positions[i].xOffset, yOffset: positions[i].yOffset }));
          },
        };
      }
      const js = parseSfnt(sfnt);
      return {
        name: source.name,
        weight: 400,
        style: 'normal',
        font: js,
        upem: js.upem,
        ascender: js.ascender,
        descender: js.descender,
        capHeight: js.capHeight || capFromJs(js) || js.upem * 0.7,
        paths: new Map(),
        axes: js.axes,
        variations: {},
        source,
        glyphToPath: js.glyphToPath,
        shapeRun: (/** @type {string} */ text) => js.shape(text).map((g) => ({ gid: g.gid, cluster: g.cluster, xAdvance: g.advance, xOffset: 0, yOffset: 0 })),
      };
    })();
    byVar.set(vkey, p);
  }
  const f = await p;
  // The same bytes can be registered under another name or weight.
  return { ...f, name: source.name, weight: Array.isArray(source.weight) ? (variations?.wght ?? 400) : source.weight ?? 400, style: source.style ?? 'normal', source };
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

/** @param {import('./type/sfnt.js').JsFace} js @returns {number | undefined} */
function capFromJs(js) {
  const gid = js.shape('H')[0]?.gid;
  if (!gid) return undefined;
  const ys = [...js.glyphToPath(gid).matchAll(/-?[\d.]+,(-?[\d.]+)/g)].map((m) => +m[1]);
  return ys.length ? Math.max(...ys) : undefined;
}

/** @param {import('./index.js').FontSource} s @returns {[number, number]} */
const weightRange = (s) => (Array.isArray(s.weight) ? [s.weight[0], s.weight[1]] : [s.weight ?? 400, s.weight ?? 400]);

/**
 * Pick the face for a family, weight and style: the closest weight within
 * the family (CSS's matching rule, simplified; a variable font's range
 * matches any weight inside it), falling back to Inter.
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
  const dist = (/** @type {import('./index.js').FontSource} */ s) => {
    const [lo, hi] = weightRange(s);
    return weight < lo ? lo - weight : weight > hi ? weight - hi : 0;
  };
  return pool.reduce((best, s) => (dist(s) < dist(best) ? s : best));
}

/**
 * The variation settings for a layer: its `axes`, with `wght` following
 * the weight on a variable font.
 *
 * @param {import('./index.js').FontSource} source
 * @param {number} weight
 * @param {Record<string, number> | undefined} axes
 * @returns {Record<string, number> | undefined}
 */
export function variationsFor(source, weight, axes) {
  const v = { ...(Array.isArray(source.weight) ? { wght: weight } : {}), ...(source.axes ?? {}), ...(axes ?? {}) };
  return Object.keys(v).length ? v : undefined;
}
