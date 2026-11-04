/**
 * WOFF2 to a bare sfnt, in JavaScript: the Brotli stream decompressed (by
 * the platform: Node's zlib, or a `DecompressionStream('brotli')`), then
 * the transformed `glyf`, `loca` and `hmtx` tables rebuilt (W3C WOFF2 §5).
 * Font collections aren't supported.
 *
 * @module type/woff2
 */

/** The 63 known table tags, by index (WOFF2 §5.1). */
const KNOWN = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

/** A cursor over bytes. */
class Reader {
  /** @param {Uint8Array} b @param {number} [at=0] */
  constructor(b, at = 0) { this.b = b; this.v = new DataView(b.buffer, b.byteOffset, b.byteLength); this.at = at; }
  u8() { return this.b[this.at++]; }
  u16() { const x = this.v.getUint16(this.at); this.at += 2; return x; }
  i16() { const x = this.v.getInt16(this.at); this.at += 2; return x; }
  u32() { const x = this.v.getUint32(this.at); this.at += 4; return x; }
  /** UIntBase128. */
  base128() { let x = 0; for (let i = 0; i < 5; i++) { const c = this.u8(); x = x * 128 + (c & 0x7f); if (!(c & 0x80)) return x; } throw new TypeError('WOFF2: bad UIntBase128'); }
  /** 255UInt16. */
  u255() { const c = this.u8(); return c === 253 ? this.u16() : c === 255 ? this.u8() + 253 : c === 254 ? this.u8() + 506 : c; }
  /** @param {number} n */
  bytes(n) { const out = this.b.subarray(this.at, this.at + n); this.at += n; return out; }
}

/**
 * A WOFF2 file's header and table directory, and where its Brotli stream is.
 *
 * @param {Uint8Array} buf
 * @returns {{ flavor: number, tables: { tag: string, origLength: number, length: number, transformed: boolean, data: Uint8Array }[], payload: Uint8Array }}
 * @throws {TypeError} On a collection or damaged data.
 */
export function woff2Directory(buf) {
  try {
    return directory(buf);
  } catch (err) {
    if (err instanceof RangeError) throw new TypeError('WOFF2: the font data is damaged or cut short');
    throw err;
  }
}

/** @param {Uint8Array} buf @returns {ReturnType<typeof woff2Directory>} */
function directory(buf) {
  const r = new Reader(buf);
  if (r.u32() !== 0x774f4632) throw new TypeError('Not a WOFF2 font');
  const flavor = r.u32();
  if (flavor === 0x74746366) throw new TypeError('WOFF2 font collections are not supported');
  r.u32();
  const count = r.u16();
  r.u16(); r.u32();
  const compressedSize = r.u32();
  r.at = 48;
  const tables = [];
  for (let i = 0; i < count; i++) {
    const flags = r.u8();
    const tag = (flags & 0x3f) === 63 ? String.fromCharCode(...r.bytes(4)) : KNOWN[flags & 0x3f];
    const version = flags >> 6;
    const origLength = r.base128();
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
    const length = transformed ? r.base128() : origLength;
    tables.push({ tag, origLength, length, transformed, data: /** @type {Uint8Array} */ (new Uint8Array(0)) });
  }
  return { flavor, tables, payload: buf.subarray(r.at, r.at + compressedSize) };
}

/**
 * WOFF2 bytes as sfnt.
 *
 * @param {Uint8Array} buf - WOFF2 bytes.
 * @param {Uint8Array | undefined} stream - The decompressed Brotli stream (see {@link woff2Directory}'s `payload`); undefined where nothing could decompress it.
 * @returns {Uint8Array}
 * @throws {TypeError} On a collection, damaged data, or no Brotli decoder.
 */
export function woff2ToSfnt(buf, stream) {
  const { flavor, tables } = woff2Directory(buf);
  if (!stream) throw new TypeError('WOFF2 needs Brotli, which this runtime lacks: convert the font to .ttf (scripts/woff2-to-ttf.mjs) or use render: "live"');
  let at = 0;
  for (const t of tables) { t.data = stream.subarray(at, at + t.length); at += t.length; }
  const byTag = new Map(tables.map((t) => [t.tag, t]));
  const glyf = byTag.get('glyf');
  if (glyf?.transformed) {
    const { glyf: g, loca, long } = rebuildGlyf(glyf.data);
    glyf.data = g;
    const l = byTag.get('loca');
    if (l) l.data = loca;
    // The rebuilt glyf outgrew short offsets: the head says long ones now.
    const head = byTag.get('head');
    if (long && head) {
      head.data = new Uint8Array(head.data);
      new DataView(head.data.buffer).setInt16(50, 1);
    }
  }
  const hmtx = byTag.get('hmtx');
  if (hmtx?.transformed) hmtx.data = rebuildHmtx(hmtx.data, byTag);
  return assemble(flavor, tables);
}

/**
 * The transformed `glyf` table back to `glyf` and `loca` (WOFF2 §5.1–5.3).
 * Glyphs are written plainly (a word a delta), so the table can outgrow
 * the font's short `loca` (offsets to 128 KB): then `loca` is long, and
 * `long` says so (the `head` must agree).
 *
 * @param {Uint8Array} data
 * @returns {{ glyf: Uint8Array, loca: Uint8Array, long: boolean }}
 */
function rebuildGlyf(data) {
  const h = new Reader(data);
  h.u16();
  const options = h.u16();
  const numGlyphs = h.u16();
  const indexFormat = h.u16();
  const sizes = Array.from({ length: 7 }, () => h.u32());
  let at = h.at;
  const streams = sizes.map((n) => { const s = new Reader(data.subarray(at, at + n)); at += n; return s; });
  const [nContours, nPoints, flagStream, glyphStream, composite, bboxStream, instructions] = streams;
  const bitmapLength = ((numGlyphs + 31) >> 5) << 2;
  const bboxBitmap = bboxStream.bytes(bitmapLength);
  void options;

  /** @type {Uint8Array[]} */
  const out = [];
  const offsets = [0];
  let total = 0;
  for (let i = 0; i < numGlyphs; i++) {
    const n = nContours.i16();
    const explicit = (bboxBitmap[i >> 3] >> (7 - (i & 7))) & 1;
    let glyph = new Uint8Array(0);
    if (n === -1) {
      // A composite: its component records, as they are; an explicit bbox.
      const start = composite.at;
      let more = true;
      let hasInstructions = false;
      while (more) {
        const flags = composite.u16();
        composite.u16();
        composite.at += (flags & 0x0001 ? 4 : 2) + (flags & 0x0008 ? 2 : flags & 0x0040 ? 4 : flags & 0x0080 ? 8 : 0);
        more = Boolean(flags & 0x0020);
        if (flags & 0x0100) hasInstructions = true;
      }
      const records = composite.b.subarray(start, composite.at);
      const bbox = [bboxStream.i16(), bboxStream.i16(), bboxStream.i16(), bboxStream.i16()];
      const ilen = hasInstructions ? glyphStream.u255() : 0;
      const ins = instructions.bytes(ilen);
      glyph = new Uint8Array(10 + records.length + (hasInstructions ? 2 + ilen : 0));
      const v = new DataView(glyph.buffer);
      v.setInt16(0, -1);
      bbox.forEach((x, k) => v.setInt16(2 + k * 2, x));
      glyph.set(records, 10);
      if (hasInstructions) { v.setUint16(10 + records.length, ilen); glyph.set(ins, 12 + records.length); }
    } else if (n > 0) {
      const ends = [];
      let points = 0;
      for (let c = 0; c < n; c++) { points += nPoints.u255(); ends.push(points - 1); }
      const flags = flagStream.bytes(points);
      const xs = new Int32Array(points);
      const ys = new Int32Array(points);
      const on = new Uint8Array(points);
      let x = 0;
      let y = 0;
      for (let p = 0; p < points; p++) {
        const [dx, dy] = triplet(flags[p] & 0x7f, glyphStream);
        on[p] = flags[p] >> 7 ? 0 : 1;
        x += dx; y += dy;
        xs[p] = x; ys[p] = y;
      }
      const ilen = glyphStream.u255();
      const ins = instructions.bytes(ilen);
      const bbox = explicit ? [bboxStream.i16(), bboxStream.i16(), bboxStream.i16(), bboxStream.i16()] : [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      // Written plainly: a flag a point, every delta a word.
      glyph = new Uint8Array(10 + 2 * n + 2 + ilen + points + 4 * points);
      const v = new DataView(glyph.buffer);
      v.setInt16(0, n);
      bbox.forEach((b, k) => v.setInt16(2 + k * 2, b));
      let o = 10;
      for (const e of ends) { v.setUint16(o, e); o += 2; }
      v.setUint16(o, ilen); o += 2;
      glyph.set(ins, o); o += ilen;
      for (let p = 0; p < points; p++) glyph[o++] = on[p];
      for (let p = 0; p < points; p++) { v.setInt16(o, xs[p] - (p ? xs[p - 1] : 0)); o += 2; }
      for (let p = 0; p < points; p++) { v.setInt16(o, ys[p] - (p ? ys[p - 1] : 0)); o += 2; }
    }
    const padded = (glyph.length + 3) & ~3;
    const g = new Uint8Array(padded);
    g.set(glyph);
    out.push(g);
    total += padded;
    offsets.push(total);
  }
  const glyf = new Uint8Array(total);
  let o = 0;
  for (const g of out) { glyf.set(g, o); o += g.length; }
  const long = Boolean(indexFormat) || total > 0x1fffe;
  const loca = new Uint8Array((numGlyphs + 1) * (long ? 4 : 2));
  const lv = new DataView(loca.buffer);
  offsets.forEach((off, k) => (long ? lv.setUint32(k * 4, off) : lv.setUint16(k * 2, off / 2)));
  return { glyf, loca, long: long && !indexFormat };
}

/**
 * One point's delta from the glyph stream (WOFF2 §5.2 triplet encoding).
 *
 * @param {number} flag - 0–127.
 * @param {Reader} s
 * @returns {[number, number]}
 */
function triplet(flag, s) {
  const sign = (/** @type {number} */ f, /** @type {number} */ v) => (f & 1 ? v : -v);
  if (flag < 10) return [0, sign(flag, ((flag & 14) << 7) + s.u8())];
  if (flag < 20) return [sign(flag, (((flag - 10) & 14) << 7) + s.u8()), 0];
  if (flag < 84) {
    const b0 = flag - 20;
    const b1 = s.u8();
    return [sign(flag, 1 + (b0 & 0x30) + (b1 >> 4)), sign(flag >> 1, 1 + ((b0 & 0x0c) << 2) + (b1 & 0x0f))];
  }
  if (flag < 120) {
    const b0 = flag - 84;
    const a = s.u8();
    const b = s.u8();
    return [sign(flag, 1 + (Math.floor(b0 / 12) << 8) + a), sign(flag >> 1, 1 + (((b0 % 12) >> 2) << 8) + b)];
  }
  if (flag < 124) {
    const a = s.u8();
    const b2 = s.u8();
    const c = s.u8();
    return [sign(flag, (a << 4) + (b2 >> 4)), sign(flag >> 1, ((b2 & 0x0f) << 8) + c)];
  }
  const a = s.u16();
  const b = s.u16();
  return [sign(flag, a), sign(flag >> 1, b)];
}

/**
 * The transformed `hmtx` table back (WOFF2 §5.4): left side bearings from
 * the glyphs' xMin where they were left out.
 *
 * @param {Uint8Array} data
 * @param {Map<string, { data: Uint8Array }>} byTag
 * @returns {Uint8Array}
 */
function rebuildHmtx(data, byTag) {
  const r = new Reader(data);
  const flags = r.u8();
  const hhea = /** @type {any} */ (byTag.get('hhea')).data;
  const maxp = /** @type {any} */ (byTag.get('maxp')).data;
  const head = /** @type {any} */ (byTag.get('head')).data;
  const metrics = new DataView(hhea.buffer, hhea.byteOffset).getUint16(34);
  const numGlyphs = new DataView(maxp.buffer, maxp.byteOffset).getUint16(4);
  const longLoca = new DataView(head.buffer, head.byteOffset).getInt16(50) === 1;
  const glyf = /** @type {any} */ (byTag.get('glyf')).data;
  const loca = /** @type {any} */ (byTag.get('loca')).data;
  const lv = new DataView(loca.buffer, loca.byteOffset, loca.byteLength);
  const gv = new DataView(glyf.buffer, glyf.byteOffset, glyf.byteLength);
  const xMin = (/** @type {number} */ g) => {
    const a = longLoca ? lv.getUint32(g * 4) : lv.getUint16(g * 2) * 2;
    const b = longLoca ? lv.getUint32(g * 4 + 4) : lv.getUint16(g * 2 + 2) * 2;
    return b > a ? gv.getInt16(a + 2) : 0;
  };
  const adv = Array.from({ length: metrics }, () => r.u16());
  const lsb = Array.from({ length: numGlyphs }, (_, g) => (g < metrics ? (flags & 1 ? xMin(g) : r.i16()) : 0));
  for (let g = metrics; g < numGlyphs; g++) lsb[g] = flags & 2 ? xMin(g) : r.i16();
  const out = new Uint8Array(metrics * 4 + (numGlyphs - metrics) * 2);
  const v = new DataView(out.buffer);
  for (let g = 0; g < metrics; g++) { v.setUint16(g * 4, adv[g]); v.setInt16(g * 4 + 2, lsb[g]); }
  for (let g = metrics; g < numGlyphs; g++) v.setInt16(metrics * 4 + (g - metrics) * 2, lsb[g]);
  return out;
}

/**
 * Tables into an sfnt file (sorted directory, checksums, 4-byte alignment).
 *
 * @param {number} flavor
 * @param {{ tag: string, data: Uint8Array }[]} tables
 * @returns {Uint8Array}
 */
function assemble(flavor, tables) {
  const sorted = [...tables].sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
  const n = sorted.length;
  let pow = 1;
  let log = 0;
  while (pow * 2 <= n) { pow *= 2; log++; }
  const header = 12 + 16 * n;
  const total = sorted.reduce((s, t) => s + ((t.data.length + 3) & ~3), header);
  const out = new Uint8Array(total);
  const v = new DataView(out.buffer);
  v.setUint32(0, flavor); v.setUint16(4, n); v.setUint16(6, pow * 16); v.setUint16(8, log); v.setUint16(10, n * 16 - pow * 16);
  let at = header;
  sorted.forEach((t, i) => {
    out.set(t.data, at);
    let sum = 0;
    for (let k = 0; k < t.data.length; k += 4) sum = (sum + (((out[at + k] << 24) | (out[at + k + 1] << 16) | (out[at + k + 2] << 8) | out[at + k + 3]) >>> 0)) >>> 0;
    const rec = 12 + i * 16;
    for (let k = 0; k < 4; k++) out[rec + k] = t.tag.charCodeAt(k);
    v.setUint32(rec + 4, sum); v.setUint32(rec + 8, at); v.setUint32(rec + 12, t.data.length);
    at += (t.data.length + 3) & ~3;
  });
  return out;
}
