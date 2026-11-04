/**
 * A brand kit: one brand, every format, one call.
 *
 * @module kit
 */

import { renderSvg, renderPages, renderImage } from '../render.js';

/** The formats a kit renders by default. */
export const KIT_FORMATS = Object.freeze({
  social: ['avatar', 'x-header', 'linkedin-banner', 'linkedin-company', 'youtube-banner', 'youtube-thumbnail', 'facebook-cover', 'instagram-post', 'instagram-square', 'instagram-story', 'instagram-reel', 'tiktok-cover', 'pinterest', 'twitch-banner', 'discord-banner', 'bluesky-banner', 'og'],
  release: ['release', 'spotify-canvas', 'bandcamp-header'],
  print: ['business-card', 'letterhead', 'compliment-slip', 'sticker', 'ticket', 'lanyard-pass'],
});

/** Formats printed on both sides by default. */
const TWO_SIDED = new Set(['business-card', 'business-card-us']);

/**
 * Render a brand on many formats at once.
 *
 * `brand` is any cover options shared by every piece: `name`, `tagline`,
 * `palette`, `mark` (path markup on a 512 grid), `photo`, `fonts`, `lines`
 * (contact lines), `person` and `role`, … `recipe` is one recipe for all
 * formats (the built-in `brand` by default) or a map from format to recipe
 * (with `default`). Two-sided formats (business cards, or any in `pages`)
 * come back as `{ front, back }`.
 *
 * @param {Record<string, any>} brand
 * @param {{ formats?: string[], recipe?: any, pages?: Record<string, string[]>, render?: 'svg' | 'webp' | 'png' | 'jpeg' | 'avif', overlay?: boolean }} [options]
 * @returns {Promise<Record<string, any>>} By format: an SVG string (or image bytes), or `{ front, back }`.
 *
 * @example
 * const files = await kit({ name: 'Hollow Fern', palette: { accent: '#2f6b4f' }, mark }, { formats: ['avatar', 'x-header', 'business-card'] });
 * files['business-card'].back; // '<svg …'
 */
export async function kit(brand, options = {}) {
  const formats = options.formats ?? [...KIT_FORMATS.social, ...KIT_FORMATS.release, ...KIT_FORMATS.print];
  const pick = (/** @type {string} */ f) => {
    const r = options.recipe;
    if (r && typeof r === 'object' && !Array.isArray(r) && !r.layers) return r[f] ?? r.default ?? 'brand';
    return r ?? 'brand';
  };
  /** @type {Record<string, any>} */
  const out = {};
  for (const format of formats) {
    const input = { seed: brand.seed ?? brand.name ?? 'brand', ...brand, recipe: pick(format), format, overlay: options.overlay };
    const pages = options.pages?.[format] ?? (TWO_SIDED.has(format) ? ['front', 'back'] : null);
    const render = options.render ?? 'svg';
    if (pages) {
      if (render === 'svg') out[format] = await renderPages(input, { pages });
      else out[format] = Object.fromEntries(await Promise.all(pages.map(async (page) => [page, await renderImage({ ...input, page }, { format: render })])));
    } else {
      out[format] = render === 'svg' ? await renderSvg(input) : await renderImage(input, { format: render });
    }
  }
  return out;
}
