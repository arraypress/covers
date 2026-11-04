/**
 * A small TrueType reader in plain JavaScript: character map, advances,
 * pair kerning (GPOS pair adjustment, incl. extension lookups, and the old
 * `kern` table) and glyph outlines (`glyf`, simple and composite).
 *
 * It's the outliner where HarfBuzz can't run (a Cloudflare Worker forbids
 * compiling WebAssembly at runtime, which harfbuzzjs needs), and what
 * live-text mode measures with. It doesn't do ligatures, complex scripts,
 * CFF (`OTTO`) outlines or variation deltas (a variable font draws its
 * default instance); HarfBuzz does all of those where it's available.
 *
 * @module type/sfnt
 */

import { pairKerning } from './kern.js';
import { familyName } from './name.js';

/**
 * @typedef {object} JsFace
 * @property {'js'} kind
 * @property {number} upem
 * @property {number} ascender
 * @property {number} descender
 * @property {number} capHeight
 * @property {(gid: number) => string} glyphToPath - Outline in font units, y up.
 * @property {(text: string) => { gid: number, cluster: number, advance: number }[]} shape - Glyphs with kerned advances, font units.
 * @property {Record<string, { min: number, default: number, max: number }>} axes - Variation axes (fvar), if any.
 * @property {string} family - The font's family name (name ID 1/16), if found.
 */

/**
 * Parse a TrueType font.
 *
 * @param {Uint8Array} bytes - sfnt bytes (decoded from WOFF already).
 * @returns {JsFace}
 * @throws {TypeError} On a CFF font or one without the tables it needs.
 */
export function parseSfnt(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = v.getUint32(0);
  if (tag === 0x4f54544f) throw new TypeError('This font has CFF outlines (OTTO), which the JavaScript outliner can\'t draw: use a TrueType (glyf) font here, or HarfBuzz');
  /** @type {Record<string, number>} */
  const tables = {};
  const n = v.getUint16(4);
  for (let i = 0; i < n; i++) {
    const o = 12 + i * 16;
    tables[String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3])] = v.getUint32(o + 8);
  }
  for (const t of ['head', 'hhea', 'hmtx', 'maxp', 'cmap', 'loca', 'glyf']) if (tables[t] == null) throw new TypeError(`Font has no ${t} table`);
  const u16 = (/** @type {number} */ o) => v.getUint16(o);
  const i16 = (/** @type {number} */ o) => v.getInt16(o);
  const u32 = (/** @type {number} */ o) => v.getUint32(o);

  const upem = u16(tables.head + 18);
  const longLoca = i16(tables.head + 50) === 1;
  const ascender = i16(tables.hhea + 4);
  const descender = i16(tables.hhea + 6);
  const numH = u16(tables.hhea + 34);
  const numGlyphs = u16(tables.maxp + 4);
  let capHeight = 0;
  if (tables['OS/2'] != null && u16(tables['OS/2']) >= 2) capHeight = i16(tables['OS/2'] + 88);

  const advance = (/** @type {number} */ g) => u16(tables.hmtx + 4 * Math.min(g, numH - 1));

  // cmap: prefer a full-repertoire (format 12) subtable, else BMP (format 4).
  /** @type {(cp: number) => number} */
  let cmap = () => 0;
  {
    const base = tables.cmap;
    const count = u16(base + 2);
    let best = -1;
    let bestRank = -1;
    for (let i = 0; i < count; i++) {
      const pid = u16(base + 4 + i * 8);
      const eid = u16(base + 6 + i * 8);
      const off = base + u32(base + 8 + i * 8);
      const fmt = u16(off);
      const rank = fmt === 12 && (pid === 3 || pid === 0) ? 3 : fmt === 4 && ((pid === 3 && (eid === 1 || eid === 10)) || pid === 0) ? 2 : -1;
      if (rank > bestRank) { bestRank = rank; best = off; }
    }
    if (best >= 0 && u16(best) === 4) {
      const segX2 = u16(best + 6);
      const ends = best + 14;
      const starts = ends + segX2 + 2;
      const deltas = starts + segX2;
      const ranges = deltas + segX2;
      cmap = (cp) => {
        if (cp > 0xffff) return 0;
        for (let s = 0; s < segX2; s += 2) {
          if (cp > u16(ends + s)) continue;
          const start = u16(starts + s);
          if (cp < start) return 0;
          const ro = u16(ranges + s);
          if (!ro) return (cp + i16(deltas + s)) & 0xffff;
          const g = u16(ranges + s + ro + (cp - start) * 2);
          return g ? (g + i16(deltas + s)) & 0xffff : 0;
        }
        return 0;
      };
    } else if (best >= 0) {
      const groups = u32(best + 12);
      cmap = (cp) => {
        let lo = 0;
        let hi = groups - 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const g = best + 16 + mid * 12;
          if (cp < u32(g)) hi = mid - 1;
          else if (cp > u32(g + 4)) lo = mid + 1;
          else return u32(g + 8) + (cp - u32(g));
        }
        return 0;
      };
    }
  }

  const kern = pairKerning(v, tables);

  /** @param {number} g @returns {[number, number]} */
  const locaRange = (g) => (longLoca
    ? [u32(tables.loca + g * 4), u32(tables.loca + g * 4 + 4)]
    : [u16(tables.loca + g * 2) * 2, u16(tables.loca + g * 2 + 2) * 2]);

  /**
   * A glyph's contours as points `[x, y, onCurve]`, composites resolved.
   *
   * @param {number} g
   * @param {number} depth
   * @returns {[number, number, boolean][][]}
   */
  const contours = (g, depth = 0) => {
    if (g >= numGlyphs || depth > 8) return [];
    const [start, end] = locaRange(g);
    if (end <= start) return [];
    const o = tables.glyf + start;
    const nc = i16(o);
    if (nc >= 0) {
      const endPts = [];
      for (let i = 0; i < nc; i++) endPts.push(u16(o + 10 + i * 2));
      const count = nc ? endPts[nc - 1] + 1 : 0;
      let p = o + 10 + nc * 2;
      p += 2 + u16(p);
      const flags = [];
      while (flags.length < count) {
        const f = bytes[p++];
        flags.push(f);
        if (f & 8) { let r = bytes[p++]; while (r--) flags.push(f); }
      }
      const xs = [];
      let x = 0;
      for (const f of flags) {
        if (f & 2) { const d = bytes[p++]; x += f & 16 ? d : -d; } else if (!(f & 16)) { x += i16(p); p += 2; }
        xs.push(x);
      }
      const ys = [];
      let y = 0;
      for (const f of flags) {
        if (f & 4) { const d = bytes[p++]; y += f & 32 ? d : -d; } else if (!(f & 32)) { y += i16(p); p += 2; }
        ys.push(y);
      }
      const out = [];
      let s = 0;
      for (const e of endPts) {
        const c = [];
        for (let i = s; i <= e; i++) c.push(/** @type {[number, number, boolean]} */ ([xs[i], ys[i], Boolean(flags[i] & 1)]));
        out.push(c);
        s = e + 1;
      }
      return out;
    }
    // Composite.
    const out = [];
    let p = o + 10;
    for (;;) {
      const f = u16(p);
      const gi = u16(p + 2);
      p += 4;
      let dx;
      let dy;
      if (f & 1) { dx = f & 2 ? i16(p) : 0; dy = f & 2 ? i16(p + 2) : 0; p += 4; } else { dx = f & 2 ? v.getInt8(p) : 0; dy = f & 2 ? v.getInt8(p + 1) : 0; p += 2; }
      let a = 1; let b = 0; let c = 0; let d = 1;
      const f2 = (/** @type {number} */ q) => i16(q) / 16384;
      if (f & 8) { a = d = f2(p); p += 2; } else if (f & 0x40) { a = f2(p); d = f2(p + 2); p += 4; } else if (f & 0x80) { a = f2(p); b = f2(p + 2); c = f2(p + 4); d = f2(p + 6); p += 8; }
      for (const contour of contours(gi, depth + 1)) {
        out.push(contour.map(([px, py, on]) => /** @type {[number, number, boolean]} */ ([px * a + py * c + dx, px * b + py * d + dy, on])));
      }
      if (!(f & 0x20)) break;
    }
    return out;
  };

  /** @type {Map<number, string>} */
  const paths = new Map();
  /** @param {number} g @returns {string} */
  const glyphToPath = (g) => {
    let d = paths.get(g);
    if (d !== undefined) return d;
    d = '';
    for (const pts of contours(g)) {
      if (!pts.length) continue;
      // Start on an on-curve point (or the midpoint of two off-curve ones).
      let first = pts.findIndex((q) => q[2]);
      /** @type {[number, number]} */
      let start;
      if (first < 0) { start = [(pts[0][0] + pts[1 % pts.length][0]) / 2, (pts[0][1] + pts[1 % pts.length][1]) / 2]; first = 0; } else start = [pts[first][0], pts[first][1]];
      d += `M${start[0]},${start[1]}`;
      const n = pts.length;
      /** @type {[number, number] | null} */
      let ctrl = null;
      for (let k = 1; k <= n; k++) {
        const q = pts[(first + k) % n];
        if (q[2]) {
          d += ctrl ? `Q${ctrl[0]},${ctrl[1]} ${q[0]},${q[1]}` : `L${q[0]},${q[1]}`;
          ctrl = null;
        } else {
          if (ctrl) {
            const mx = (ctrl[0] + q[0]) / 2;
            const my = (ctrl[1] + q[1]) / 2;
            d += `Q${ctrl[0]},${ctrl[1]} ${mx},${my}`;
          }
          ctrl = [q[0], q[1]];
        }
      }
      if (ctrl) d += `Q${ctrl[0]},${ctrl[1]} ${start[0]},${start[1]}`;
      d += 'Z';
    }
    paths.set(g, d);
    return d;
  };

  /** @param {string} text */
  const shape = (text) => {
    const out = [];
    let i = 0;
    for (const ch of text) {
      out.push({ gid: cmap(/** @type {number} */ (ch.codePointAt(0))), cluster: i, advance: 0 });
      i += ch.length;
    }
    for (let k = 0; k < out.length; k++) out[k].advance = advance(out[k].gid) + (k + 1 < out.length ? kern(out[k].gid, out[k + 1].gid) : 0);
    return out;
  };

  /** @type {Record<string, { min: number, default: number, max: number }>} */
  const axes = {};
  if (tables.fvar != null) {
    const f = tables.fvar;
    const off = u16(f + 4);
    const count = u16(f + 8);
    const size = u16(f + 10);
    const fixed = (/** @type {number} */ q) => v.getInt32(q) / 65536;
    for (let k = 0; k < count; k++) {
      const a = f + off + k * size;
      axes[String.fromCharCode(bytes[a], bytes[a + 1], bytes[a + 2], bytes[a + 3])] = { min: fixed(a + 4), default: fixed(a + 8), max: fixed(a + 12) };
    }
  }

  return { kind: 'js', upem, ascender, descender, capHeight, glyphToPath, shape, axes, family: familyName(v, bytes, tables.name) };
}
