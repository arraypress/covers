/**
 * Recipes: named layer stacks.
 *
 * A recipe is a function from the cover's options (and the canvas) to a
 * list of layers, each with an `id`. Call it through
 * `cover({ recipe: 'gridTitle', title: '…' })`. Any option named after a
 * layer id customises that layer:
 *
 * - a **string** is the layer's content: `title: 'Hello'`, `icon: 'lucide:feather'`
 * - an **object** is merged into the layer: `mesh: { blur: '16vmax' }`,
 *   `title: { content: 'Hello', size: 96 }`
 * - **`false`** removes it: `grain: false`
 *
 * Extra `layers` passed with a recipe are painted on top of its stack.
 *
 * The built-ins are JSON documents (`recipes/<name>.json`) defined with
 * {@link import('./json-recipe.js').defineRecipe}, the same format a theme
 * can write its own styles in.
 *
 * Sizes are written against `u`, the geometric mean of the canvas sides,
 * so a 1200×630 card and a 1200×1200 square get proportionate type.
 *
 * @module recipes
 */

import { readFileSync } from 'node:fs';
import { defineRecipe } from './json-recipe.js';

/**
 * What a recipe receives besides the options.
 *
 * @typedef {object} RecipeContext
 * @property {number} width - Canvas width.
 * @property {number} height - Canvas height.
 * @property {import('./index.js').Palette} palette - Resolved palette.
 * @property {import('./rng.js').Rng} rng - The cover's random stream (for recipe-level choices).
 * @property {number} u - The design unit: `sqrt(width × height)`.
 * @property {string} seed - The cover's seed (JSON recipes seed each layer's draws from it).
 */

/**
 * The text content of a string-or-object option.
 *
 * @param {unknown} v
 * @returns {string | undefined}
 */
export function contentOf(v) {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'content' in v) return /** @type {any} */ (v).content;
  return undefined;
}

/** The built-in recipe names (each is `recipes/<name>.json`). */
const BUILT_IN = ['aurora', 'gridTitle', 'iconTile', 'bigType', 'stripes', 'duotone', 'mark', 'diagram', 'cutout'];

/** Every built-in recipe, by name, defined from its JSON document. */
export const recipes = Object.freeze(Object.fromEntries(BUILT_IN.map((name) => [
  name,
  defineRecipe(JSON.parse(readFileSync(new URL(`../recipes/${name}.json`, import.meta.url), 'utf8'))),
])));

/**
 * Apply per-layer options to a recipe's stack (see the module docs).
 *
 * @param {import('./index.js').Layer[]} layers - The recipe's layers.
 * @param {Record<string, unknown>} options - The cover options.
 * @returns {import('./index.js').Layer[]} The customised stack.
 */
export function applyOverrides(layers, options) {
  return layers.flatMap((layer) => {
    if (!layer.id || !Object.hasOwn(options, layer.id)) return [layer];
    const v = options[layer.id];
    if (v === false || v === null) return [];
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Uint8Array)) return [/** @type {any} */ ({ ...layer, ...v, type: layer.type })];
    return [layer];
  });
}

