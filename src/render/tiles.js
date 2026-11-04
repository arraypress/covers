/**
 * Rasterising a large SVG with filters in tiles.
 *
 * librsvg (through libvips) slows down sharply past a few megapixels when
 * a document has filters: a 3000² displacement map takes ~28 s in one
 * render and ~5 s as four 1500² tiles. So a large document with filters is
 * drawn as tiles, each with a margin round it (librsvg clips a filter's
 * input to the viewport, so a blur or displacement at a tile's edge needs
 * the pixels beyond it: the margin is the furthest any filter reaches),
 * cropped and assembled. Tiles render in parallel. A document whose
 * filters reach further than a tile renders in one piece.
 *
 * @module render/tiles
 */

import { filterReach } from '../effects/region.js';

/** Documents below this many pixels render in one piece. */
const MIN_TILED = 2.4e6;

/** Tile side, px (before margins). */
const TILE = 1024;

/**
 * An SVG document's RGBA pixels at its own size.
 *
 * @param {any} sharp
 * @param {string} svg - A document whose root is `width`×`height` with `viewBox="0 0 width height"`.
 * @param {number} width
 * @param {number} height
 * @param {number} [known=0] - How far the filters the layers drew reach, output px (they report it at their own resolution).
 * @returns {Promise<Uint8Array>}
 */
export async function svgPixels(sharp, svg, width, height, known = 0) {
  const margin = width * height < MIN_TILED || !/<filter\b/.test(svg) ? Infinity : Math.max(known + 16, reach(svg));
  // Filters reaching further than a tile (a heavy blur) render in one piece.
  if (margin > TILE) return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
  const open = /^<svg\b[^>]*>/.exec(svg);
  if (!open) return sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();
  const rest = svg.slice(open[0].length);
  const root = open[0].replace(/\s(width|height|viewBox)="[^"]*"/g, '').replace(/>$/, '');
  const out = Buffer.alloc(width * height * 4);
  /** @type {(() => Promise<void>)[]} */
  const jobs = [];
  for (let y = 0; y < height; y += TILE) {
    for (let x = 0; x < width; x += TILE) {
      const tw = Math.min(TILE, width - x);
      const th = Math.min(TILE, height - y);
      jobs.push(async () => {
        const vw = tw + 2 * margin;
        const vh = th + 2 * margin;
        const doc = `${root} width="${vw}" height="${vh}" viewBox="${x - margin} ${y - margin} ${vw} ${vh}">${rest}`;
        const px = await sharp(Buffer.from(doc)).ensureAlpha().extract({ left: margin, top: margin, width: tw, height: th }).raw().toBuffer();
        for (let r = 0; r < th; r++) px.copy(out, ((y + r) * width + x) * 4, r * tw * 4, (r + 1) * tw * 4);
      });
    }
  }
  // A few at a time: each holds its filter surfaces.
  const lanes = 4;
  await Promise.all(Array.from({ length: lanes }, async (_, i) => { for (let j = i; j < jobs.length; j += lanes) await jobs[j](); }));
  return out;
}

/**
 * How far, in output px, any filter in a document reaches, estimated from
 * the markup: the primitives' reach times the largest scale it's drawn at.
 * (Effects report their own reach at their own resolution; this covers
 * filters written by other layers.)
 *
 * @param {string} svg
 * @returns {number}
 */
export function reach(svg) {
  let scale = 1;
  for (const m of svg.matchAll(/scale\(([^)]*)\)/g)) for (const v of m[1].trim().split(/[\s,]+/)) scale = Math.max(scale, Math.abs(Number(v)) || 0);
  return Math.ceil(filterReach(svg) * scale) + 16;
}
