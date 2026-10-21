/**
 * A palette from a photo: k-means in OKLab over a small thumbnail.
 *
 * @module extract
 */

import { readFile } from 'node:fs/promises';
import { toOklch, fromOklch, toHex } from './color.js';
import { createRng } from './rng.js';

/** @type {Map<string, Promise<string[]>>} */
const cache = new Map();

/**
 * The dominant colours of an image, most common first.
 *
 * Decodes with sharp (an optional peer dependency) to a 64×64 thumbnail,
 * clusters its pixels in OKLab (k-means, seeded so the result is stable),
 * drops clusters too small to matter, prefers chromatic colours (a nearly
 * grey cluster is kept only when there aren't enough others) and skips
 * near-duplicate shades while distinct colours remain.
 *
 * @param {string | Uint8Array} src - A file path or image bytes.
 * @param {{ count?: number }} [options] - How many colours (default 4).
 * @returns {Promise<string[]>} `#rrggbb` colours.
 * @throws {Error} Without sharp, or on an unreadable image.
 *
 * @example
 * await extractPalette('cover.jpg'); // ['#2f5d8a', '#e0b25a', …]
 */
export function extractPalette(src, options = {}) {
  const count = options.count ?? 4;
  const key = typeof src === 'string' ? `${src}:${count}` : null;
  if (key && cache.has(key)) return /** @type {Promise<string[]>} */ (cache.get(key));
  const job = (async () => {
    let sharp;
    try {
      sharp = (await import('sharp')).default;
    } catch {
      throw new Error('Extracting a palette from a photo needs sharp: npm install sharp');
    }
    const bytes = typeof src === 'string' ? await readFile(src) : src;
    const { data } = await sharp(bytes).rotate().resize(64, 64, { fit: 'cover' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    /** @type {[number, number, number][]} */
    const pts = [];
    for (let i = 0; i < data.length; i += 3) {
      const hex = '#' + [data[i], data[i + 1], data[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
      const { l, c, h } = toOklch(hex);
      pts.push([l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)]);
    }
    const k = Math.min(8, Math.max(count + 2, 5));
    const rng = createRng('extract');
    let centres = rng.shuffle(pts).slice(0, k).map((p) => p.slice());
    const assign = new Int32Array(pts.length);
    for (let it = 0; it < 18; it++) {
      for (let i = 0; i < pts.length; i++) {
        let best = 0;
        let bd = Infinity;
        for (let j = 0; j < centres.length; j++) {
          const d = (pts[i][0] - centres[j][0]) ** 2 + (pts[i][1] - centres[j][1]) ** 2 + (pts[i][2] - centres[j][2]) ** 2;
          if (d < bd) { bd = d; best = j; }
        }
        assign[i] = best;
      }
      centres = centres.map((c, j) => {
        let n = 0;
        const s = [0, 0, 0];
        for (let i = 0; i < pts.length; i++) if (assign[i] === j) { n++; s[0] += pts[i][0]; s[1] += pts[i][1]; s[2] += pts[i][2]; }
        return n ? s.map((v) => v / n) : c;
      });
    }
    const sizes = centres.map((_, j) => assign.filter((a) => a === j).length);
    const clusters = centres
      .map((c, j) => ({ c, n: sizes[j], chroma: Math.hypot(c[1], c[2]) }))
      .filter((x) => x.n > pts.length * 0.03)
      .sort((a, b) => b.n - a.n);
    const vivid = clusters.filter((x) => x.chroma > 0.035);
    // Skip near-duplicates (shades of one colour) while others remain.
    const ordered = [...vivid, ...clusters.filter((x) => x.chroma <= 0.035)];
    const chosen = [];
    for (const x of ordered) {
      if (chosen.every((y) => Math.hypot(x.c[0] - y.c[0], x.c[1] - y.c[1], x.c[2] - y.c[2]) > 0.09)) chosen.push(x);
    }
    for (const x of ordered) if (chosen.length < count && !chosen.includes(x)) chosen.push(x);
    chosen.length = Math.min(chosen.length, count);
    return chosen.map(({ c }) => toHex(fromOklch({ l: c[0], c: Math.hypot(c[1], c[2]), h: ((Math.atan2(c[2], c[1]) * 180) / Math.PI + 360) % 360 })));
  })();
  if (key) cache.set(key, job);
  return job;
}
