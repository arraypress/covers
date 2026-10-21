/**
 * @arraypress/covers — build-time cover images for posts, products and
 * pages: soft mesh gradients, grain, patterns, stripes, shapes, icons and
 * type, from one seed, as SVG or WebP/PNG/AVIF/JPEG.
 *
 * @module @arraypress/covers
 */

export { cover, renderSvg, renderImage, coverKey, MIME, DEFAULT_QUALITY, VERSION } from './render.js';
export { recipes } from './recipes.js';
export { defineRecipe, loadRecipe } from './json-recipe.js';
export { palettes, resolvePalette, derivePalette } from './palette.js';
export { toHex, toOklch, fromOklch, mixOklab, mixOklch } from './color.js';
export { registerIcons } from './icons.js';
export { resolveSize, ASPECTS } from './geometry.js';
export { createRng, hashString } from './rng.js';
export { LAYERS as layers } from './layers.js';
