/**
 * Pair kerning from a TrueType font: GPOS `kern` feature pair adjustments
 * (formats 1 and 2, through extension lookups; lookups add up), else the
 * legacy `kern` table.
 *
 * @module type/kern
 */

/**
 * Pair kerning: GPOS `kern` feature pair adjustments (formats 1 and 2,
 * through extension lookups), else the legacy `kern` table.
 *
 * @param {DataView} v
 * @param {Record<string, number>} tables
 * @returns {(a: number, b: number) => number} X advance adjustment, font units.
 */
export function pairKerning(v, tables) {
  const u16 = (/** @type {number} */ o) => v.getUint16(o);
  const i16 = (/** @type {number} */ o) => v.getInt16(o);
  /** Pair lookups, each a list of subtables (the first that covers a pair applies; lookups add up). @type {((a: number, b: number) => number | undefined)[][]} */
  const lookupsList = [];
  /** @type {((a: number, b: number) => number | undefined)[]} */
  let subtables = [];

  const coverage = (/** @type {number} */ o) => {
    const fmt = u16(o);
    /** @type {Map<number, number>} */
    const m = new Map();
    if (fmt === 1) for (let i = 0, n = u16(o + 2); i < n; i++) m.set(u16(o + 4 + i * 2), i);
    else for (let i = 0, n = u16(o + 2); i < n; i++) {
      const r = o + 4 + i * 6;
      for (let g = u16(r), idx = u16(r + 4); g <= u16(r + 2); g++, idx++) m.set(g, idx);
    }
    return m;
  };
  const classDef = (/** @type {number} */ o) => {
    const fmt = u16(o);
    /** @type {Map<number, number>} */
    const m = new Map();
    if (fmt === 1) { const s = u16(o + 2); for (let i = 0, n = u16(o + 4); i < n; i++) m.set(s + i, u16(o + 6 + i * 2)); }
    else for (let i = 0, n = u16(o + 2); i < n; i++) { const r = o + 4 + i * 6; for (let g = u16(r); g <= u16(r + 2); g++) m.set(g, u16(r + 4)); }
    return m;
  };
  const bits = (/** @type {number} */ f) => { let c = 0; for (let x = f; x; x >>= 1) c += x & 1; return c * 2; };
  // XAdvance of a value record (or XPlacement, the rare alternative).
  const xadv = (/** @type {number} */ o, /** @type {number} */ fmt) => {
    let p = o;
    let x = 0;
    if (fmt & 1) { x += i16(p); p += 2; }
    if (fmt & 2) p += 2;
    if (fmt & 4) x += i16(p);
    return x;
  };

  const pairPos = (/** @type {number} */ st) => {
    const fmt = u16(st);
    const cov = coverage(st + u16(st + 2));
    const vf1 = u16(st + 4);
    const vf2 = u16(st + 6);
    const s1 = bits(vf1);
    const s2 = bits(vf2);
    if (fmt === 1) {
      const sets = st + 10;
      subtables.push((a, b) => {
        const idx = cov.get(a);
        if (idx === undefined) return undefined;
        const ps = st + u16(sets + idx * 2);
        const n = u16(ps);
        const rec = 2 + s1 + s2;
        let lo = 0;
        let hi = n - 1;
        while (lo <= hi) {
          const mid = (lo + hi) >> 1;
          const r = ps + 2 + mid * rec;
          const g = u16(r);
          if (g === b) return xadv(r + 2, vf1);
          if (g < b) lo = mid + 1; else hi = mid - 1;
        }
        return undefined;
      });
    } else if (fmt === 2) {
      const c1 = classDef(st + u16(st + 8));
      const c2 = classDef(st + u16(st + 10));
      const n2 = u16(st + 14);
      const rec = s1 + s2;
      subtables.push((a, b) => {
        if (!cov.has(a)) return undefined;
        const r = st + 16 + ((c1.get(a) ?? 0) * n2 + (c2.get(b) ?? 0)) * rec;
        return xadv(r, vf1);
      });
    }
  };

  const gpos = tables.GPOS;
  if (gpos != null) {
    const features = gpos + u16(gpos + 6);
    const lookups = gpos + u16(gpos + 8);
    /** @type {Set<number>} */
    const wanted = new Set();
    for (let i = 0, n = u16(features); i < n; i++) {
      const r = features + 2 + i * 6;
      if (String.fromCharCode(v.getUint8(r), v.getUint8(r + 1), v.getUint8(r + 2), v.getUint8(r + 3)) !== 'kern') continue;
      const f = features + u16(r + 4);
      for (let k = 0, m = u16(f + 2); k < m; k++) wanted.add(u16(f + 4 + k * 2));
    }
    for (const li of [...wanted].sort((a, b) => a - b)) {
      subtables = [];
      lookupsList.push(subtables);
      const l = lookups + u16(lookups + 2 + li * 2);
      const type = u16(l);
      for (let k = 0, m = u16(l + 4); k < m; k++) {
        let st = l + u16(l + 6 + k * 2);
        let t = type;
        if (t === 9) { t = u16(st + 2); st += v.getUint32(st + 4); }
        if (t === 2) pairPos(st);
      }
    }
  }
  if (!lookupsList.some((l) => l.length) && tables.kern != null && u16(tables.kern) === 0) {
    subtables = [];
    lookupsList.push(subtables);
    const k = tables.kern;
    const st = k + 4;
    if (u16(st + 4) >> 8 === 0) {
      /** @type {Map<number, number>} */
      const pairs = new Map();
      for (let i = 0, n = u16(st + 6); i < n; i++) {
        const r = st + 14 + i * 6;
        pairs.set(u16(r) * 65536 + u16(r + 2), i16(r + 4));
      }
      subtables.push((a, b) => pairs.get(a * 65536 + b));
    }
  }
  return (a, b) => {
    let total = 0;
    for (const list of lookupsList) {
      for (const s of list) {
        const x = s(a, b);
        if (x !== undefined) { total += x; break; }
      }
    }
    return total;
  };
}
