/**
 * `border` with `shape: 'circle'`: a round sticker backing. The layer is
 * drawn small to find the circle that holds it (centred on what it paints,
 * out to its farthest pixel), then a disc `width` beyond that goes under it
 * (and a cut line outside, with `line`).
 *
 * @module effects/round-border
 */

import { attrs, num } from '../svg.js';
import { len } from '../geometry.js';
import { toHex } from '../color.js';
import { pixelsOf } from '../raster/index.js';

/** The probe's longer side, px. */
const PROBE = 320;

/**
 * The round border, or undefined where nothing can rasterise (the
 * die-cut `border` filter is used instead).
 *
 * @param {any} fx - `{ kind: 'border', shape: 'circle', width, color, line, lineWidth, cx, cy }`.
 * @param {{ defs: string, body: string }} m
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {Promise<{ defs: string, body: string } | undefined>}
 */
export async function roundBorder(fx, m, ctx) {
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
    px = await pixelsOf(doc, w, h, /** @type {any} */ (ctx).sharp);
  } catch {
    px = undefined;
  }
  if (!px) return undefined;
  /** @type {[number, number][]} */
  const painted = [];
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (px[(y * w + x) * 4 + 3] < 8) continue;
    painted.push([x, y]);
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
  }
  if (!painted.length) return m;
  const cx = fx.cx != null ? len(fx.cx, ctx.canvas) : ox + ((x0 + x1 + 1) / 2) / s;
  const cy = fx.cy != null ? len(fx.cy, ctx.canvas) : oy + ((y0 + y1 + 1) / 2) / s;
  // The farthest painted pixel's far corner.
  let reach = 0;
  for (const [x, y] of painted) reach = Math.max(reach, Math.hypot(ox + (x + 0.5) / s - cx, oy + (y + 0.5) / s - cy) + 0.71 / s);
  const r = reach + len(fx.width, ctx.canvas, '1.2vmin');
  let under = '';
  if (fx.line) under += `<circle${attrs({ cx, cy, r: r + len(fx.lineWidth, ctx.canvas, '0.25vmin'), fill: fx.line === true ? '#c9c6c0' : toHex(fx.line) })}/>`;
  under += `<circle${attrs({ cx, cy, r, fill: toHex(fx.color ?? '#ffffff') })}/>`;
  return { defs: m.defs, body: `${under}${m.body}` };
}
