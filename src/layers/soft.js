/**
 * Soft shapes: a blur drawn padded, so a blurred orb never fades where it
 * meets the canvas edge (librsvg clips a filter's input to the canvas) or
 * shows the square edge of a filter region.
 *
 * @module layers/soft
 */

import { attrs, num } from '@arraypress/image-effects/svg';
import { toBase64 } from '../platform/index.js';

/**
 * Blur markup by `sigma` (px in the layer's units). In `renderImage`, the markup
 * is drawn on its own padded canvas (3σ round `box`) at the resolution the
 * blur needs (about four pixels per σ, never more than the output's), blurred
 * there, and embedded as an image; elsewhere it's an SVG blur over a filter
 * region padded the same way.
 *
 * @param {{ defs: string, body: string }} m
 * @param {{ x: number, y: number, width: number, height: number }} box - What the markup paints.
 * @param {number} sigma
 * @param {import('../layers.js').RenderContext} ctx
 * @param {string} id
 * @returns {Promise<{ defs: string, body: string }>}
 */
export async function soften(m, box, sigma, ctx, id) {
  const pad = 3 * sigma;
  const r = { x: box.x - pad, y: box.y - pad, width: box.width + 2 * pad, height: box.height + 2 * pad };
  // Pixels only for renderImage (an SVG keeps its blur as a filter).
  const sharp = /** @type {any} */ (ctx).raster ? /** @type {any} */ (ctx.sharp) : undefined;
  if (!sharp || sigma <= 0) {
    if (sigma <= 0) return m;
    const filter = `<filter${attrs({ id, filterUnits: 'userSpaceOnUse', ...r, 'color-interpolation-filters': 'sRGB' })}><feGaussianBlur stdDeviation="${num(sigma, 3)}"/></filter>`;
    return { defs: m.defs + filter, body: `<g filter="url(#${id})">${m.body}</g>` };
  }
  const res = /** @type {any} */ (ctx).res ?? 1;
  const ppu = Math.min(res, Math.max(4 / sigma, 64 / Math.max(r.width, r.height)));
  const w = Math.max(1, Math.ceil(r.width * ppu));
  const h = Math.max(1, Math.ceil(r.height * ppu));
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${num(r.x, 4)} ${num(r.y, 4)} ${num(w / ppu, 4)} ${num(h / ppu, 4)}" preserveAspectRatio="none">${m.defs ? `<defs>${m.defs}</defs>` : ''}${m.body}</svg>`;
  const png = await sharp(new TextEncoder().encode(doc)).blur(Math.max(0.3, sigma * ppu)).png().toBuffer();
  return { defs: '', body: `<image${attrs({ x: r.x, y: r.y, width: num(w / ppu, 4), height: num(h / ppu, 4), preserveAspectRatio: 'none', href: `data:image/png;base64,${toBase64(png)}` })}/>` };
}
