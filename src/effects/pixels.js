/**
 * Effects computed on pixels, where SVG filters can't do them (spin and
 * zoom blur, bokeh, distortions, pixel sorting, ASCII…): the layer is
 * drawn once at the pixels it's shown at (sharp in Node, tiled past a few
 * megapixels; a canvas in a page), processed here on a typed array, mixed
 * with the original through the effect's `mask`, and embedded back as one
 * image (JPEG where it's opaque, PNG where it isn't or where flat colour
 * matters), cropped to what it paints. Where nothing can draw pixels (a
 * Worker) the caller falls back to the effect's filter, if it has one.
 *
 * @module effects/pixels
 */

import { attrs, num } from '../svg.js';
import { pixelsOf, encodePixels } from '../raster/index.js';
import { svgPixels } from '../render/tiles.js';
import { toBase64 } from '../platform/bytes.js';
import { nearest } from './buffer.js';
import { maskGrid, lerpPixels } from './mask.js';

/** The most pixels an effect works on (about 3550²); past that it works smaller and the image scales up. */
export const MAX_PIXELS = 12.6e6;

/**
 * What a pixel effect returns: the processed pixels, at the layer's
 * raster size or (with `pixelated`) a grid of cells scaled up crisp.
 *
 * @typedef {object} PixelResult
 * @property {Uint8ClampedArray} data
 * @property {number} width
 * @property {number} height
 * @property {boolean} [lossless] - Embed as PNG even when opaque (flat colour).
 * @property {boolean} [pixelated] - Smaller than the layer: scaled up nearest-neighbour.
 */

/**
 * A layer's markup as pixels, `w`×`h` over its canvas.
 *
 * @param {{ defs: string, body: string }} m
 * @param {any} ctx
 * @param {number} w
 * @param {number} h
 * @returns {Promise<Uint8ClampedArray | undefined>} RGBA, or undefined where nothing can draw.
 */
export async function drawLayer(m, ctx, w, h) {
  const sx = w / ctx.width;
  const sy = h / ctx.height;
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${m.defs ? `<defs>${m.defs}</defs>` : ''}<g transform="scale(${num(sx, 6)} ${num(sy, 6)})">${m.body}</g></svg>`;
  try {
    const out = ctx.sharp ? await svgPixels(ctx.sharp, doc, w, h) : await pixelsOf(doc, w, h);
    return out ? new Uint8ClampedArray(out.buffer, out.byteOffset, out.byteLength) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The raster size for a layer: its pixels as shown (`ctx.res` per unit),
 * at most {@link MAX_PIXELS} (or the effect's own cap).
 *
 * @param {any} ctx
 * @param {number} [cap=MAX_PIXELS]
 * @returns {{ w: number, h: number, scale: number }}
 */
export function rasterSize(ctx, cap = MAX_PIXELS) {
  const res = Math.min(ctx.res ?? 1, Math.sqrt(cap / (ctx.width * ctx.height)));
  const w = Math.max(1, Math.round(ctx.width * res));
  const h = Math.max(1, Math.round(ctx.height * res));
  return { w, h, scale: Math.sqrt((w / ctx.width) * (h / ctx.height)) };
}

/**
 * Run a pixel effect on a layer's markup.
 *
 * @param {any} fx - The effect (its `mask` is applied here).
 * @param {{ defs: string, body: string }} m - The layer so far.
 * @param {any} ctx
 * @param {(img: import('./buffer.js').Pixels) => PixelResult | Uint8ClampedArray | Promise<PixelResult | Uint8ClampedArray>} run
 * @param {{ cap?: number }} [o]
 * @returns {Promise<{ defs: string, body: string } | undefined>} Undefined where nothing can draw pixels.
 */
export async function pixelEffect(fx, m, ctx, run, o = {}) {
  const { w, h, scale } = rasterSize(ctx, o.cap);
  const data = await drawLayer(m, ctx, w, h);
  if (!data) return undefined;
  let opaque = true;
  for (let i = 3; i < data.length; i += 4) if (data[i] !== 255) { opaque = false; break; }
  const img = { data, width: w, height: h, scale, opaque };
  const got = await run(img);
  /** @type {PixelResult} */
  let res = got instanceof Uint8ClampedArray ? { data: got, width: w, height: h } : got;
  if (fx.mask) {
    const grid = await maskGrid(fx.mask, ctx, { x: 0, y: 0, width: ctx.width, height: ctx.height }, w, h);
    if (grid) {
      const full = res.width === w && res.height === h ? res.data : nearest(res.data, res.width, res.height, w, h);
      res = { data: lerpPixels(data, full, grid), width: w, height: h, lossless: res.lossless };
    }
  }
  return embed(res, ctx);
}

/**
 * Pixels as an `<image>` over the layer's canvas, cropped to what's painted.
 *
 * @param {PixelResult} res
 * @param {any} ctx
 * @returns {Promise<{ defs: string, body: string }>}
 */
async function embed(res, ctx) {
  const { data, width: w, height: h } = res;
  let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
  let opaque = true;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a !== 255) opaque = false;
      if (!a) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return { defs: '', body: '' };
  let crop = data;
  const cw = x1 - x0 + 1;
  const ch = y1 - y0 + 1;
  if (cw !== w || ch !== h) {
    crop = new Uint8ClampedArray(cw * ch * 4);
    for (let y = 0; y < ch; y++) crop.set(data.subarray(((y0 + y) * w + x0) * 4, ((y0 + y) * w + x1 + 1) * 4), y * cw * 4);
  }
  const { mime, bytes } = await encodePixels(crop, cw, ch, { opaque, lossless: res.lossless || res.pixelated }, ctx.sharp);
  const kx = ctx.width / w;
  const ky = ctx.height / h;
  const crisp = res.pixelated ? { 'image-rendering': 'pixelated', style: 'image-rendering:pixelated' } : {};
  const image = `<image${attrs({ x: num(x0 * kx, 4), y: num(y0 * ky, 4), width: num(cw * kx, 4), height: num(ch * ky, 4), preserveAspectRatio: 'none', ...crisp, href: `data:${mime};base64,${toBase64(bytes)}` })}/>`;
  return { defs: '', body: image };
}
