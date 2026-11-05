/**
 * Auto contrast: white or near-black (or a layer's `autoColors`), by how
 * light what's drawn underneath is.
 *
 * The rule is the one the site's designs use: the backdrop's luma (Rec. 601
 * weights on the gamma-encoded channels, 0–1) above `AUTO_THRESHOLD`
 * (0.72) takes the dark colour, anything else the light one. A pure
 * contrast-ratio choice picks black on mid-tones (a mid pink, a sky blue)
 * where designers set white; this matches what they set.
 *
 * @module type/auto-color
 */

import { toHex } from '@logomarks/image-effects/color';

/** Backdrop luma (0–1) above which `color: 'auto'` picks the dark colour. */
export const AUTO_THRESHOLD = 0.72;

/**
 * Rec. 601 luma of a colour, 0–1.
 *
 * @param {string} c
 * @returns {number}
 */
export function luma(c) {
  const h = toHex(c);
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Pick the text colour against what's underneath (`autoThreshold` on the
 * layer overrides the 0.72 cut).
 *
 * @param {any} layer
 * @param {import('../layers.js').RenderContext} ctx
 * @param {{ x: number, y: number, width: number, height: number }} box
 * @returns {Promise<string>}
 */
export async function autoColor(layer, ctx, box) {
  const [light, dark] = (layer.autoColors ?? ['#ffffff', '#0b0b0b']).map(toHex);
  const under = await /** @type {any} */ (ctx).backdrop?.(box);
  return luma(under ?? ctx.palette.bg) > (layer.autoThreshold ?? AUTO_THRESHOLD) ? dark : light;
}
