/**
 * An ordered (Bayer) dither in two colours, optionally pixelated first:
 * computed on pixels where something can rasterise (the layer drawn once
 * at one pixel per cell, thresholded here, embedded with nearest-neighbour
 * scaling), else as an SVG filter.
 *
 * @module effects/dither
 */

import { attrs, num } from '../svg.js';
import { len } from '../geometry.js';
import { encodePng, encodePngAsync, pngUri } from '../png.js';
import { pixelsOf } from '../raster/index.js';
import { LUMA, rgb, mat } from './util.js';

/** Bayer matrices. */
const BAYER = {
  bayer4: [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5],
  bayer8: (() => {
    const m4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const out = new Array(64);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const base = m4[(y % 4) * 4 + (x % 4)];
      const q = (y >> 2) * 2 + (x >> 2);
      out[y * 8 + x] = base * 4 + [0, 2, 3, 1][q];
    }
    return out;
  })(),
};

/**
 * An ordered (Bayer) dither in two colours, optionally pixelated to a
 * visible cell first. The threshold matrix is a tiny PNG tiled with feTile.
 *
 * @param {any} fx - `{ ink, paper, cell, contrast, brightness, pixelate, weights, matrix }`.
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {string}
 */
export function dither(fx, ctx) {
  const [ir, ig, ib] = rgb(fx.ink ?? '#0b0b0b');
  const [pr, pg, pb] = rgb(fx.paper ?? '#f4f1ea');
  const c = Math.max(1, len(fx.cell, ctx.canvas, '0.65vmin'));
  const contrast = fx.contrast ?? 1.45;
  const bright = fx.brightness ?? 0.06;
  const wts = fx.weights ?? LUMA;
  const { n, px } = thresholds(fx);
  const tile = pngUri(encodePng(px, n, n, 1));
  let out = '';
  let src = 'SourceGraphic';
  if (fx.pixelate !== false) {
    const d = Math.max(0.3, c / 2 - 0.3);
    out += `<feFlood flood-color="#fff" x="${num(c / 2 - 0.3, 3)}" y="${num(c / 2 - 0.3, 3)}" width="0.6" height="0.6" result="dot"/><feComposite in="dot" in2="dot" operator="over" x="0" y="0" width="${num(c, 3)}" height="${num(c, 3)}" result="cell"/><feTile in="cell" result="grid"/>`
      + `<feComposite in="SourceGraphic" in2="grid" operator="in" result="sample"/><feMorphology in="sample" operator="dilate" radius="${num(d, 3)}" result="px"/>`;
    src = 'px';
  }
  const o = 0.5 - contrast * 0.5 + bright;
  const row = wts.map((/** @type {number} */ x) => x * contrast);
  out += `<feColorMatrix in="${src}" type="matrix" values="${mat([...row, 0, o, ...row, 0, o, ...row, 0, o, 0, 0, 0, 1, 0])}" result="lum"/>`
    + `<feImage${attrs({ href: tile, x: 0, y: 0, width: c * n, height: c * n, preserveAspectRatio: 'none', 'image-rendering': 'pixelated', result: 'b' })}/><feTile in="b" result="bt"/>`
    + '<feComposite in="lum" in2="bt" operator="arithmetic" k2="1" k3="1" k4="-0.5"/>'
    + `<feComponentTransfer><feFuncR type="discrete" tableValues="${num(ir, 3)} ${num(pr, 3)}"/><feFuncG type="discrete" tableValues="${num(ig, 3)} ${num(pg, 3)}"/><feFuncB type="discrete" tableValues="${num(ib, 3)} ${num(pb, 3)}"/><feFuncA type="discrete" tableValues="1 1"/></feComponentTransfer>`
    + '<feComposite in2="SourceGraphic" operator="in"/>';
  return out;
}

/**
 * The threshold matrix as 8-bit greys (the filter's tile, and the raster's thresholds).
 *
 * @param {any} fx
 * @returns {{ n: number, px: Uint8Array }}
 */
function thresholds(fx) {
  const matrix = /** @type {number[]} */ ((/** @type {any} */ (BAYER))[fx.matrix ?? 'bayer4'] ?? BAYER.bayer4);
  const n = Math.round(Math.sqrt(matrix.length));
  const px = new Uint8Array(n * n);
  matrix.forEach((v, i) => { px[i] = Math.round((1 - (v + 0.5) / (n * n)) * 255); });
  return { n, px };
}

/**
 * The dither on pixels: the layer is drawn once at one pixel per cell
 * (`pixelate`, the default) or at output resolution, thresholded against
 * the matrix here, and embedded scaled up nearest-neighbour. Where the
 * layer isn't opaque the result is clipped to its shape. The same
 * arithmetic as the filter (sRGB, `contrast`, `brightness`, `weights`).
 *
 * @param {any} fx
 * @param {{ defs: string, body: string }} m - The layer's markup so far.
 * @param {import('../layers.js').RenderContext} ctx
 * @param {string} id
 * @returns {Promise<{ defs: string, body: string } | undefined>} Undefined where nothing can rasterise.
 */
export async function ditherRaster(fx, m, ctx, id) {
  const c = Math.max(1e-3, len(fx.cell, ctx.canvas, '0.65vmin'));
  // Pixels per unit: one per cell, or the output's resolution (at least one per cell).
  const ppu = fx.pixelate === false ? Math.max(1 / c, /** @type {any} */ (ctx).res ?? 1) : 1 / c;
  const w = Math.max(1, Math.ceil(ctx.width * ppu));
  const h = Math.max(1, Math.ceil(ctx.height * ppu));
  const uw = w / ppu;
  const uh = h / ppu;
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${num(uw, 4)} ${num(uh, 4)}" preserveAspectRatio="none">${m.defs ? `<defs>${m.defs}</defs>` : ''}${m.body}</svg>`;
  let src;
  try {
    src = await pixelsOf(doc, w, h, /** @type {any} */ (ctx).sharp);
  } catch {
    src = undefined;
  }
  if (!src) return undefined;

  const ink = rgb(fx.ink ?? '#0b0b0b').map((v) => Math.round(v * 255));
  const paper = rgb(fx.paper ?? '#f4f1ea').map((v) => Math.round(v * 255));
  const contrast = fx.contrast ?? 1.45;
  const o = 0.5 - contrast * 0.5 + (fx.brightness ?? 0.06);
  const [wr, wg, wb] = /** @type {number[]} */ (fx.weights ?? LUMA).map((x) => (x * contrast) / 255);
  const { n, px: t } = thresholds(fx);
  const cellPx = c * ppu;
  const out = new Uint8Array(w * h * 4);
  let opaque = true;
  for (let y = 0; y < h; y++) {
    const ty = (Math.floor(y / cellPx + 1e-6) % n) * n;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = src[i + 3];
      if (a < 255) opaque = false;
      if (!a) continue;
      // Ink where luminance and threshold fall short of 1 (the filter's discrete step at 0.5 after −0.5).
      const lum = src[i] * wr + src[i + 1] * wg + src[i + 2] * wb + o;
      const col = lum + t[ty + (Math.floor(x / cellPx + 1e-6) % n)] / 255 < 1 ? ink : paper;
      out[i] = col[0]; out[i + 1] = col[1]; out[i + 2] = col[2]; out[i + 3] = 255;
    }
  }
  const png = opaque ? await encodePngAsync(rgbOf(out), w, h, 3) : await encodePngAsync(out, w, h, 4);
  const image = `<image${attrs({ x: 0, y: 0, width: num(uw, 4), height: num(uh, 4), preserveAspectRatio: 'none', 'image-rendering': 'pixelated', style: 'image-rendering:pixelated', href: pngUri(png) })}/>`;
  if (opaque) return { defs: '', body: image };
  // Clipped to the layer's own shape (its alpha, at full resolution).
  const region = { x: -uw, y: -uh, width: uw * 3, height: uh * 3 };
  const defs = `${m.defs}<filter${attrs({ id: `${id}w`, filterUnits: 'userSpaceOnUse', ...region })}><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"/></filter>`
    + `<mask${attrs({ id: `${id}m`, maskUnits: 'userSpaceOnUse', ...region })}><g filter="url(#${id}w)">${m.body}</g></mask>`;
  return { defs, body: `<g mask="url(#${id}m)">${image}</g>` };
}

/** @param {Uint8Array} rgba @returns {Uint8Array} The RGB channels. */
function rgbOf(rgba) {
  const out = new Uint8Array((rgba.length / 4) * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) { out[j] = rgba[i]; out[j + 1] = rgba[i + 1]; out[j + 2] = rgba[i + 2]; }
  return out;
}
