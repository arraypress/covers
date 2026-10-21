/**
 * Small helpers for writing SVG markup deterministically.
 *
 * Numbers are always written through {@link num}, so the same input gives
 * byte-identical output on every machine (no `0.30000000000000004`, no
 * locale formatting, no `-0`).
 *
 * @module svg
 */

/**
 * Format a number for SVG: at most `digits` decimals, no trailing zeros.
 *
 * @param {number} v - The number.
 * @param {number} [digits=2] - Maximum decimals.
 * @returns {string} The formatted number.
 *
 * @example
 * num(1 / 3);   // '0.33'
 * num(12.5);    // '12.5'
 * num(-0.001);  // '0'
 */
export function num(v, digits = 2) {
  if (!Number.isFinite(v)) return '0';
  const s = v.toFixed(digits).replace(/\.?0+$/, '');
  return s === '-0' || s === '' ? '0' : s;
}

/**
 * Escape text for an XML attribute or text node.
 *
 * @param {string} s - Raw text.
 * @returns {string} Escaped text.
 */
export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/**
 * Serialise an attribute object. `undefined`, `null` and `false` values are
 * skipped; numbers go through {@link num}. Keys keep their insertion order.
 *
 * @param {Record<string, string | number | boolean | null | undefined>} obj - Attributes.
 * @returns {string} ` key="value"` pairs (with a leading space), or `''`.
 *
 * @example
 * attrs({ x: 1.005, fill: '#fff', opacity: undefined }); // ' x="1" fill="#fff"'
 */
export function attrs(obj) {
  let out = '';
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === false) continue;
    out += ` ${k}="${typeof v === 'number' ? num(v) : esc(String(v))}"`;
  }
  return out;
}

/**
 * Opacity and blend-mode attributes shared by every layer.
 *
 * @param {{ opacity?: number, blend?: string }} layer - The layer.
 * @returns {Record<string, string | number | undefined>} Attributes for the layer's group.
 */
export function layerAttrs(layer) {
  return {
    opacity: layer.opacity != null && layer.opacity < 1 ? Math.max(0, layer.opacity) : undefined,
    style: layer.blend && layer.blend !== 'normal' ? `mix-blend-mode:${layer.blend}` : undefined,
  };
}
