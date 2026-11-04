/**
 * Named formats: release covers, social posts, flyers and print stationery,
 * alongside `aspect`.
 *
 * Screen formats are pixel sizes. Print formats are a trim size in
 * millimetres or inches, rendered at `dpi` (300 by default) with a bleed
 * (3 mm by default) and a safe area inside the trim; `cropMarks: true`
 * adds a slug with crop marks round the bleed. The layers are drawn on the
 * bleed box (trim plus bleed on every side), so backgrounds run off the
 * edge, and text and icons keep their default margins inside the safe area.
 *
 * @module formats/print
 */

import { FORMATS } from './presets.js';
import { scaleZones } from './zones.js';
import { cutPath } from './cut.js';

/** @param {number} v @param {string} unit @param {number} dpi @returns {number} px */
export function toPx(v, unit, dpi) {
  return unit === 'mm' ? (v / 25.4) * dpi : unit === 'in' ? v * dpi : v;
}

/**
 * The print set-up of a cover, in px.
 *
 * @typedef {object} PrintInfo
 * @property {number} dpi
 * @property {'mm' | 'in'} unit - The format's unit.
 * @property {number} trimWidth - px.
 * @property {number} trimHeight - px.
 * @property {number} bleed - px on each side.
 * @property {number} safe - px inside the trim on each side.
 * @property {number} slug - px of slug outside the bleed (crop marks), 0 without.
 * @property {boolean} cropMarks
 * @property {import('./cut.js').Cut} [cut] - Die-cut shape.
 * @property {boolean} cutLine - Draw the die line.
 * @property {number} mm - px per millimetre.
 */

/**
 * Resolve a cover's `format` (a name or a custom `{ width, height, unit }`)
 * to its canvas and print set-up.
 *
 * @param {any} o - Cover options: `format`, `dpi`, `bleed` (mm, or `false`), `safe` (mm), `cropMarks`, `cutLine`.
 * @returns {{ width: number, height: number, print?: PrintInfo, format?: string, zones?: import('./index.js').Zones } | undefined}
 */
export function resolveFormat(o) {
  if (o.format == null) return undefined;
  const f = typeof o.format === 'string' ? FORMATS[o.format] : { unit: 'px', ...o.format };
  if (!f) throw new RangeError(`Unknown format "${o.format}". Formats: ${Object.keys(FORMATS).join(', ')}`);
  const name = typeof o.format === 'string' ? o.format : undefined;
  if (f.unit === 'px') {
    // A screen format: one side given scales the zones and the other side.
    const k = o.width && !o.height ? o.width / f.width : 1;
    const zones = f.zones ? scaleZones(f.zones, k) : undefined;
    return { width: Math.round(f.width * k), height: Math.round(f.height * k), format: name, zones };
  }
  const dpi = o.dpi ?? 300;
  const mm = dpi / 25.4;
  const trimWidth = Math.round(toPx(f.width, f.unit, dpi));
  const trimHeight = Math.round(toPx(f.height, f.unit, dpi));
  const bleed = o.bleed === false ? 0 : Math.round((o.bleed ?? f.bleed ?? 3) * mm);
  const safe = Math.round((o.safe ?? f.safe ?? 3) * mm);
  const cropMarks = Boolean(o.cropMarks);
  const slug = cropMarks ? Math.round(Math.max(6, (o.bleed === false ? 0 : o.bleed ?? f.bleed ?? 3) + 3) * mm) : 0;
  return {
    width: trimWidth + 2 * bleed,
    height: trimHeight + 2 * bleed,
    format: name,
    print: { dpi, unit: /** @type {'mm' | 'in'} */ (f.unit), trimWidth, trimHeight, bleed, safe, slug, cropMarks, cut: o.cut ?? f.cut, cutLine: Boolean(o.cutLine), mm },
  };
}

/**
 * Crop marks in the slug, a die line, and the document's outer size.
 *
 * @param {PrintInfo} p
 * @param {number} w - Bleed-box width, px.
 * @param {number} h - Bleed-box height, px.
 * @returns {{ marks: string, cut: string }} Markup: marks in slug coordinates (the bleed box starts at `slug`), and the die line in bleed-box coordinates.
 */
export function printMarks(p, w, h) {
  const n = (/** @type {number} */ v) => Math.round(v * 100) / 100;
  let marks = '';
  if (p.cropMarks) {
    const s = p.slug;
    const b = p.bleed;
    const len = s - b - p.mm;
    const gap = b + p.mm;
    const stroke = Math.max(0.5, 0.25 * p.mm);
    const xs = [s + b, s + w - b];
    const ys = [s + b, s + h - b];
    let d = '';
    for (const x of xs) for (const y of ys) {
      const dx = x < s + w / 2 ? -1 : 1;
      const dy = y < s + h / 2 ? -1 : 1;
      d += `M${n(x + dx * gap)} ${n(y)}h${n(dx * len)}M${n(x)} ${n(y + dy * gap)}v${n(dy * len)}`;
    }
    marks = `<path d="${d}" fill="none" stroke="#000" stroke-width="${n(stroke)}"/>`;
  }
  let cut = '';
  if (p.cutLine) {
    const x = p.bleed;
    const y = p.bleed;
    const cw = p.trimWidth;
    const ch = p.trimHeight;
    const custom = p.cut && typeof p.cut === 'object';
    const shape = custom
      ? `<path d="${cutPath(p.cut, { x, y, width: cw, height: ch }, p.mm).map((g) => g.cmd + g.pts.map(n).join(' ')).join('')}"`
      : p.cut === 'circle'
      ? `<ellipse cx="${n(x + cw / 2)}" cy="${n(y + ch / 2)}" rx="${n(cw / 2)}" ry="${n(ch / 2)}"`
      : `<rect x="${n(x)}" y="${n(y)}" width="${n(cw)}" height="${n(ch)}"${p.cut === 'rounded' ? ` rx="${n(3 * p.mm)}"` : ''}`;
    cut = `${shape} fill="none" stroke="#ec008c" stroke-width="${n(Math.max(0.5, 0.25 * p.mm))}" id="CutContour"/>`;
  }
  return { marks, cut };
}
