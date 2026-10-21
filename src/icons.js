/**
 * Icons: Iconify sets by name, or raw SVG.
 *
 * `'lucide:feather'` and `'simple-icons:github'` resolve through the
 * `@iconify-json/<prefix>` package when it's installed (optional peer
 * dependencies; any Iconify JSON set works the same way). A set can also be
 * handed over directly with {@link registerIcons}, which is how to use
 * icons without installing the packages, or in a bundler that can't
 * resolve them.
 *
 * Raw input works too: an SVG string (its `viewBox` is read) or a bare
 * path `d` with a `viewBox`.
 *
 * @module icons
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

/** @type {Map<string, IconSet>} */
const sets = new Map();

/**
 * An Iconify JSON icon set (the shape of `@iconify-json/<prefix>/icons.json`).
 *
 * @typedef {object} IconSet
 * @property {string} prefix
 * @property {Record<string, { body: string, width?: number, height?: number, left?: number, top?: number }>} icons
 * @property {Record<string, { parent: string, width?: number, height?: number }>} [aliases]
 * @property {number} [width]
 * @property {number} [height]
 * @property {number} [left]
 * @property {number} [top]
 */

/**
 * A resolved icon.
 *
 * @typedef {object} IconData
 * @property {string} body - Inner SVG markup.
 * @property {[number, number, number, number]} viewBox - `[minX, minY, width, height]`.
 */

/**
 * Register an Iconify icon set (for example the parsed
 * `@iconify-json/lucide/icons.json`). Replaces any set with that prefix.
 *
 * @param {IconSet} set - The set.
 * @returns {void}
 *
 * @example
 * import lucide from '@iconify-json/lucide/icons.json' with { type: 'json' };
 * registerIcons(lucide);
 */
export function registerIcons(set) {
  if (!set?.prefix || typeof set.icons !== 'object') throw new TypeError('registerIcons() expects an Iconify JSON set ({ prefix, icons })');
  sets.set(set.prefix, set);
}

/**
 * Load a set by prefix: a registered one, else `@iconify-json/<prefix>`.
 *
 * @param {string} prefix - e.g. `'lucide'`.
 * @returns {IconSet} The set.
 * @throws {Error} When the set isn't registered or installed.
 */
function loadSet(prefix) {
  let set = sets.get(prefix);
  if (set) return set;
  const pkg = `@iconify-json/${prefix}`;
  let file;
  try {
    file = join(require.resolve(`${pkg}/package.json`, { paths: [process.cwd(), fileURLToPath(new URL('.', import.meta.url))] }), '..', 'icons.json');
  } catch {
    throw new Error(`Icon set "${prefix}" is not available. Install ${pkg}, or pass the set to registerIcons().`);
  }
  set = /** @type {IconSet} */ (JSON.parse(readFileSync(file, 'utf8')));
  sets.set(prefix, set);
  return set;
}

/**
 * Resolve an Iconify name (`'prefix:name'`) to its markup and viewBox.
 *
 * @param {string} name - e.g. `'lucide:feather'`.
 * @returns {IconData} The icon.
 * @throws {Error} On a malformed name, a missing set or a missing icon.
 *
 * @example
 * resolveIcon('lucide:feather').viewBox; // [0, 0, 24, 24]
 */
export function resolveIcon(name) {
  const m = String(name).match(/^([a-z0-9-]+):([a-z0-9-]+)$/i);
  if (!m) throw new Error(`Icon names look like "lucide:feather", got "${name}"`);
  const set = loadSet(m[1]);
  let key = m[2];
  /** @type {{ width?: number, height?: number }} */
  let size = {};
  for (let hops = 0; !set.icons[key] && set.aliases?.[key] && hops < 8; hops++) {
    const alias = set.aliases[key];
    size = { width: size.width ?? alias.width, height: size.height ?? alias.height };
    key = alias.parent;
  }
  const icon = set.icons[key];
  if (!icon) throw new Error(`Icon "${name}" was not found in the ${m[1]} set`);
  return {
    body: icon.body,
    viewBox: [
      icon.left ?? set.left ?? 0,
      icon.top ?? set.top ?? 0,
      size.width ?? icon.width ?? set.width ?? 16,
      size.height ?? icon.height ?? set.height ?? 16,
    ],
  };
}

/**
 * Read a raw SVG string: its inner markup and viewBox. Scripts,
 * `foreignObject` and event-handler attributes are dropped.
 *
 * @param {string} svg - An `<svg …>…</svg>` string.
 * @returns {IconData} The icon.
 * @throws {Error} When there's no `<svg>` element or no size.
 */
export function parseSvgIcon(svg) {
  const open = svg.match(/<svg\b[^>]*>/i);
  if (!open) throw new Error('Icon SVG must contain an <svg> element');
  const tag = open[0];
  const vb = tag.match(/viewBox\s*=\s*["']([^"']+)["']/i);
  let viewBox;
  if (vb) {
    viewBox = vb[1].trim().split(/[\s,]+/).map(Number);
  } else {
    const w = parseFloat(tag.match(/\bwidth\s*=\s*["']([\d.]+)/i)?.[1] ?? '');
    const h = parseFloat(tag.match(/\bheight\s*=\s*["']([\d.]+)/i)?.[1] ?? '');
    if (!(w > 0 && h > 0)) throw new Error('Icon SVG needs a viewBox or width/height');
    viewBox = [0, 0, w, h];
  }
  if (viewBox.length !== 4 || viewBox.some((n) => !Number.isFinite(n))) throw new Error('Icon SVG has an unreadable viewBox');

  // Presentation attributes on the root (fill="none", stroke=…) apply to the body.
  const inherited = [...tag.matchAll(/\b(fill|stroke|stroke-width|stroke-linecap|stroke-linejoin)\s*=\s*("[^"]*"|'[^']*')/gi)]
    .map((m) => `${m[1]}=${m[2]}`)
    .join(' ');
  const start = svg.indexOf(tag) + tag.length;
  const end = svg.lastIndexOf('</svg>');
  let body = svg.slice(start, end > start ? end : undefined);
  body = body
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject\b[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi, '');
  return { body: inherited ? `<g ${inherited}>${body}</g>` : body, viewBox: /** @type {any} */ (viewBox) };
}
