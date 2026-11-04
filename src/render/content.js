/**
 * Where a layer paints: its markup drawn small and the box round every
 * pixel it covers, so filters can work over that box instead of the whole
 * canvas (in `renderImage`, where librsvg's cost is per pixel of region).
 *
 * @module render/content
 */

import { num } from '../svg.js';

/** The probe's longer side, px. */
const PROBE = 256;

/** Markup carrying more embedded data than this isn't probed (decoding it would cost more than it saves). */
const MAX_PROBE_BYTES = 400_000;

/**
 * The box a layer's markup paints, in its units: drawn at most 256 px
 * across over the canvas and half again round it, one probe pixel of slack
 * on every side. Undefined when it can't be probed (no sharp, heavy
 * embedded images) or paints nothing.
 *
 * @param {{ defs: string, body: string }} m
 * @param {any} ctx
 * @returns {Promise<{ x: number, y: number, width: number, height: number } | undefined>}
 */
export async function contentBox(m, ctx) {
  if (!ctx.raster || !ctx.sharp || m.body.length + m.defs.length > MAX_PROBE_BYTES) return undefined;
  const ox = -ctx.width / 2;
  const oy = -ctx.height / 2;
  const uw = ctx.width * 2;
  const uh = ctx.height * 2;
  const s = PROBE / Math.max(uw, uh);
  const w = Math.max(1, Math.round(uw * s));
  const h = Math.max(1, Math.round(uh * s));
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${num(ox, 4)} ${num(oy, 4)} ${num(uw, 4)} ${num(uh, 4)}" preserveAspectRatio="none">${m.defs ? `<defs>${m.defs}</defs>` : ''}${m.body}</svg>`;
  let px;
  try {
    px = await ctx.sharp(new TextEncoder().encode(doc)).ensureAlpha().raw().toBuffer();
  } catch {
    return undefined;
  }
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!px[(y * w + x) * 4 + 3]) continue;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) return undefined;
  // Anything touching the probe's edge may run further: the whole region then.
  if (x0 === 0 || y0 === 0 || x1 === w - 1 || y1 === h - 1) return undefined;
  return { x: ox + (x0 - 1) / s, y: oy + (y0 - 1) / s, width: (x1 - x0 + 3) / s, height: (y1 - y0 + 3) / s };
}
