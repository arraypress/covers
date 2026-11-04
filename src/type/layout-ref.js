/**
 * Text layout other layers can read: a text layer with an `id` records
 * where its block landed, and any later layer can use `{layout.<id>.<field>}`
 * (optionally `+ n` or `- n`) as a number: `bottom`, `top`, `left`,
 * `right`, `width`, `height`, `x`, `y` (the first baseline), `baseline`
 * (the last one), `size` (as fitted) and `lines`. Units are the text
 * layer's own (a group's grid inside a group).
 *
 * @module type/layout-ref
 */

/** A layout reference, whole or inside a string. */
const TOKEN = /\{layout\.([\w-]+)\.(\w+)\s*(?:([+-])\s*([\d.]+))?\}/g;

/** Fields a reference can read. */
export const LAYOUT_FIELDS = Object.freeze(['x', 'y', 'top', 'bottom', 'left', 'right', 'width', 'height', 'baseline', 'size', 'lines']);

/**
 * Whether a value holds a layout reference (layers nested in it aside: they
 * resolve when they're drawn).
 *
 * @param {unknown} v
 * @returns {boolean}
 */
export function hasLayoutRef(v) {
  if (typeof v === 'string') return v.includes('{layout.');
  if (Array.isArray(v)) return v.some(hasLayoutRef);
  if (v && typeof v === 'object' && !(v instanceof Uint8Array)) return Object.entries(v).some(([k, x]) => !NESTED.has(k) && hasLayoutRef(x));
  return false;
}

/** Options holding nested layers. */
const NESTED = new Set(['layers', 'mask', 'knockout', 'clip']);

/**
 * A layer with its layout references replaced by numbers.
 *
 * @param {any} v
 * @param {Map<string, Record<string, number>>} layout
 * @returns {any}
 * @throws {TypeError} On a reference to a text layer not drawn yet, or an unknown field.
 */
export function resolveLayoutRefs(v, layout) {
  if (typeof v === 'string') {
    const one = new RegExp(`^${TOKEN.source}$`).exec(v.trim());
    if (one) return value(one, layout);
    return v.replace(TOKEN, (...m) => String(value(/** @type {any} */ (m), layout)));
  }
  if (Array.isArray(v)) return v.map((x) => resolveLayoutRefs(x, layout));
  if (v && typeof v === 'object' && !(v instanceof Uint8Array)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, NESTED.has(k) ? x : resolveLayoutRefs(x, layout)]));
  return v;
}

/** @param {string[]} m @param {Map<string, Record<string, number>>} layout @returns {number} */
function value(m, layout) {
  const [, id, field, sign, n] = m;
  const box = layout.get(id);
  if (!box) throw new TypeError(`{layout.${id}.${field}}: no text layer "${id}" drawn before this one`);
  if (!LAYOUT_FIELDS.includes(field)) throw new TypeError(`{layout.${id}.${field}}: unknown field (${LAYOUT_FIELDS.join(', ')})`);
  return box[field] + (sign ? (sign === '-' ? -1 : 1) * Number(n) : 0);
}

/**
 * Record a text block's layout for later layers.
 *
 * @param {any} ctx
 * @param {string | undefined} id
 * @param {{ x: number, y: number, width: number, height: number }} box - The block, from cap height to last baseline.
 * @param {{ x: number, y: number, baseline: number, size: number, lines: number }} more
 */
export function recordLayout(ctx, id, box, more) {
  if (!id || !ctx.layout) return;
  ctx.layout.set(id, { ...more, top: box.y, bottom: box.y + box.height, left: box.x, right: box.x + box.width, width: box.width, height: box.height });
}
