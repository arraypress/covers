/**
 * What's under a box: the layers drawn so far, rendered small and averaged,
 * for `color: 'auto'`.
 *
 * @module render/backdrop
 */

import { toHex } from '@logomarks/image-effects/color';
import { pixelsOf } from '@logomarks/image-effects/raster';

/**
 * The average colour under a box, from the layers drawn so far: rendered
 * small (sharp in Node, a canvas in a page) and averaged. Undefined where
 * nothing can rasterise (a Worker): the text keeps to the palette.
 *
 * @param {import('../index.js').Cover} c
 * @param {any} sharp
 * @param {(c: any, parts: any[]) => string} documentFor - Assembles an SVG from rendered parts.
 * @param {(required: boolean) => Promise<any>} loadSharp
 * @returns {(box: { x: number, y: number, width: number, height: number }, parts: any[]) => Promise<string | undefined>}
 */
export function backdropSampler(c, sharp, documentFor, loadSharp) {
  return async (box, parts) => {
    if (!parts.length) return undefined;
    const s = Math.min(1, 240 / Math.max(c.width, c.height));
    const w = Math.max(1, Math.round(c.width * s));
    const h = Math.max(1, Math.round(c.height * s));
    let px;
    try {
      px = await pixelsOf(documentFor(/** @type {any} */ ({ ...c, radius: undefined, alt: undefined, print: undefined, overlay: undefined }), parts), w, h, sharp ?? await loadSharp(false));
    } catch {
      px = undefined;
    }
    if (!px) {
      // Analytic fallback: the last full-canvas solid colour.
      const solid = [...parts].reverse().find((p) => p.layer.type === 'solid' && !p.layer.area);
      return solid ? toHex(solid.layer.color ?? c.palette.bg) : undefined;
    }
    const x0 = Math.max(0, Math.floor(box.x * s));
    const y0 = Math.max(0, Math.floor(box.y * s));
    const x1 = Math.min(w, Math.ceil((box.x + box.width) * s));
    const y1 = Math.min(h, Math.ceil((box.y + box.height) * s));
    let r = 0; let g = 0; let b = 0; let n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4;
      const a = px[i + 3] / 255;
      // Unpainted pixels read as the page colour.
      const bg = c.palette.bg;
      const br = parseInt(bg.slice(1, 3), 16); const bgc = parseInt(bg.slice(3, 5), 16); const bb = parseInt(bg.slice(5, 7), 16);
      r += px[i] * a + br * (1 - a); g += px[i + 1] * a + bgc * (1 - a); b += px[i + 2] * a + bb * (1 - a); n++;
    }
    if (!n) return undefined;
    return '#' + [r, g, b].map((v) => Math.round(v / n).toString(16).padStart(2, '0')).join('');
  };
}
