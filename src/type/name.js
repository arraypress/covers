/**
 * A font's family name from its `name` table.
 *
 * @module type/name
 */

/**
 * The family name from the `name` table (typographic family, else family).
 *
 * @param {DataView} v @param {Uint8Array} bytes @param {number | undefined} base
 * @returns {string}
 */
export function familyName(v, bytes, base) {
  if (base == null) return '';
  const count = v.getUint16(base + 2);
  const strings = base + v.getUint16(base + 4);
  /** @type {Record<number, string>} */
  const found = {};
  for (let i = 0; i < count; i++) {
    const r = base + 6 + i * 12;
    const pid = v.getUint16(r);
    const id = v.getUint16(r + 6);
    if ((id !== 1 && id !== 16) || found[id]) continue;
    const len = v.getUint16(r + 8);
    const off = strings + v.getUint16(r + 10);
    let s = '';
    if (pid === 3 || pid === 0) for (let k = 0; k < len; k += 2) s += String.fromCharCode(v.getUint16(off + k));
    else for (let k = 0; k < len; k++) s += String.fromCharCode(bytes[off + k]);
    found[id] = s;
  }
  return found[16] ?? found[1] ?? '';
}
