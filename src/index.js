/**
 * @arraypress/covers — covers, flyers, posters, release art, social
 * formats and print stationery from one seed and a stack of layers, as SVG
 * or WebP/PNG/AVIF/JPEG. Runs in Node, browsers and Cloudflare Workers.
 *
 * @module @arraypress/covers
 */

export { cover, renderSvg, renderImage, renderPages, renderBlob, coverKey, safeBox, MIME, DEFAULT_QUALITY, VERSION } from './render.js';
export { recipes } from './recipes.js';
export { defineRecipe, loadRecipe } from './json-recipe.js';
export { palettes, resolvePalette, derivePalette } from './palette.js';
export { toHex, toOklch, fromOklch, mixOklab, mixOklch, onBackground, gradientAt } from '@logomarks/image-effects/color';
export { registerIcons } from './icons.js';
export { registerFont } from './fonts.js';
export { configure } from './platform/index.js';
export { resolveSize, ASPECTS } from './geometry.js';
export { FORMATS } from './formats/index.js';
export { createRng, hashString } from '@logomarks/image-effects/rng';
export { LAYERS as layers } from './layers.js';
export { extractPalette } from './extract.js';
export { RISO_INKS } from './print.js';
export { EFFECTS, EFFECT_OPTIONS } from '@logomarks/image-effects';
export { rasterize } from '@logomarks/image-effects/raster';
export { lint } from './lint/index.js';
export { kit, KIT_FORMATS } from './kit/index.js';
export { valueAt, MOTION_PRESETS } from './animate/index.js';
