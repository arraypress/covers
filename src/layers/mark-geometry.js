/**
 * A mark's geometry from its markup (paths on a 512 grid), read with
 * `@logomarks/core`: its filled paths as rings, its real bounds, and how
 * much of that box it inks. Shared by the `mosaic` and `marks` layers.
 *
 * @module layers/mark-geometry
 */

import { shapes, rings, bounds } from '@logomarks/core/svg';
import { pixelGrid, pixelCoverage } from '@logomarks/core/edit';

/** Read marks, by markup (a sheet of seventy reads each once). @type {Map<string, MarkGeometry>} */
const cache = new Map();

/**
 * @typedef {object} MarkGeometry
 * @property {import('@logomarks/core/raster').FillPath[]} paths - Its filled paths as rings, with their fill rules.
 * @property {{ x: number, y: number, width: number, height: number }} box - Its real bounds, grid units.
 * @property {number} density - The share of its box it inks, 0–1.
 */

/**
 * Read a mark.
 *
 * @param {string} markup - The mark's paths (`<path d="…"/>`, on a 512 grid).
 * @returns {MarkGeometry | null} Null when it draws nothing.
 *
 * @example
 * markGeometry('<path d="M96 96h320v320H96z"/>').box; // { x: 96, y: 96, width: 320, height: 320 }
 */
export function markGeometry(markup) {
  if (cache.has(markup)) return /** @type {MarkGeometry} */ (cache.get(markup));
  const filled = shapes(String(markup ?? ''));
  const paths = filled.map((s) => ({ rings: rings(s.segs), evenodd: s.evenodd })).filter((p) => p.rings.length);
  if (!paths.length) return null;
  const b = bounds(filled);
  const box = { x: b.x, y: b.y, width: Math.max(b.w, 1e-6), height: Math.max(b.h, 1e-6) };
  // Ink measured on a 48-cell grid over the box: plenty for a density.
  const grid = pixelGrid(0, box);
  const cov = pixelCoverage(paths, grid);
  const density = cov.reduce((a, v) => a + v, 0) / Math.max(1, cov.length);
  const geo = { paths, box, density };
  if (cache.size > 500) cache.clear();
  cache.set(markup, geo);
  return geo;
}
