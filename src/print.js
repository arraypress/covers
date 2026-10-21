/**
 * Print-shop layers: `ink` (risograph), `dither`, `contour`, `waveform`,
 * `tiles` (a Bauhaus grid) and `rule` (a hairline).
 *
 * @module print
 */

import { attrs, num, layerAttrs, esc } from './svg.js';
import { len, regionPx } from './geometry.js';
import { toHex } from './color.js';
import { createRng } from './rng.js';
import { encodePng, pngUri } from './png.js';
import { text as textLayer } from './layers.js';

/** Classic risograph inks, by name (`'riso:pink'`). Approximations, not trademarks. */
export const RISO_INKS = Object.freeze({
  pink: '#ff48b0',
  blue: '#0078bf',
  yellow: '#ffe800',
  teal: '#00838a',
  red: '#ff665e',
  green: '#00a95c',
  orange: '#ff6c2f',
  purple: '#765ba7',
  navy: '#3d5588',
  black: '#1a1a1a',
});

/**
 * A colour, or a riso ink by name (`'riso:pink'`).
 *
 * @param {string} c
 * @returns {string} `#rrggbb`.
 */
export function inkColor(c) {
  const m = /^riso:(\w+)$/.exec(String(c));
  if (m) {
    const hex = /** @type {Record<string, string>} */ (RISO_INKS)[m[1]];
    if (!hex) throw new TypeError(`Unknown riso ink "${m[1]}" (${Object.keys(RISO_INKS).join(', ')})`);
    return hex;
  }
  return toHex(c);
}

/** @param {any} v @param {string} f @returns {string} */
const col = (v, f) => (v ? toHex(v) : f);

const wrap = (/** @type {any} */ layer, /** @type {string} */ body) => {
  const a = attrs(layerAttrs(layer));
  return a ? `<g${a}>${body}</g>` : body;
};

// ---------------------------------------------------------------------------
// ink (riso)
// ---------------------------------------------------------------------------

/**
 * `ink` — one risograph ink: flat shapes (or text) printed with `multiply`
 * (or `screen` on dark paper), slightly misregistered, with a stochastic
 * or halftone texture and uneven density across the sheet.
 *
 * @param {import('./index.js').InkLayer} layer
 * @param {import('./layers.js').RenderContext} ctx
 * @returns {Promise<import('./layers.js').Markup>}
 */
export async function ink(layer, ctx) {
  const { width: w, height: h, rng } = ctx;
  const color = layer.color ? inkColor(layer.color) : ctx.palette.accent;
  const min = Math.min(w, h);
  const id = ctx.id;

  // Shapes, in this ink.
  let shapes = '';
  for (const s of layer.shapes ?? [{ kind: 'circle' }]) {
    const x = (s.x ?? 0.5) * w;
    const y = (s.y ?? 0.5) * h;
    const r = len(s.r ?? s.size, ctx.canvas, '30vmin');
    const rot = s.rotate ?? 0;
    const tr = rot ? ` rotate(${num(rot)} ${num(x)} ${num(y)})` : '';
    if (s.kind === 'circle') shapes += `<circle${attrs({ cx: x, cy: y, r })}/>`;
    else if (s.kind === 'ring') shapes += `<circle${attrs({ cx: x, cy: y, r, fill: 'none', stroke: color, 'stroke-width': len(s.thickness, ctx.canvas, r * 0.3) })}/>`;
    else if (s.kind === 'half') shapes += `<path${attrs({ d: `M${num(x - r)} ${num(y)}A${num(r)} ${num(r)} 0 0 1 ${num(x + r)} ${num(y)}Z`, transform: tr.trim() || undefined })}/>`;
    else if (s.kind === 'arch') {
      const aw = len(s.width, ctx.canvas, r * 2);
      const ah = len(s.height, ctx.canvas, aw * 1.3);
      const ar = aw / 2;
      shapes += `<path${attrs({ d: `M${num(x - ar)} ${num(y + ah / 2)}V${num(y - ah / 2 + ar)}A${num(ar)} ${num(ar)} 0 0 1 ${num(x + ar)} ${num(y - ah / 2 + ar)}V${num(y + ah / 2)}Z`, transform: tr.trim() || undefined })}/>`;
    } else if (s.kind === 'band') {
      const bh = len(s.height, ctx.canvas, '22vmin');
      const reach = Math.hypot(w, h);
      shapes += `<rect${attrs({ x: w / 2 - reach, y: y - bh / 2, width: reach * 2, height: bh, transform: `rotate(${num(rot)} ${num(w / 2)} ${num(y)})` })}/>`;
    } else if (s.kind === 'rect') {
      const rw = len(s.width, ctx.canvas, r * 2);
      const rh = len(s.height, ctx.canvas, r * 2);
      shapes += `<rect${attrs({ x: x - rw / 2, y: y - rh / 2, width: rw, height: rh, transform: tr.trim() || undefined })}/>`;
    } else if (s.kind === 'text') {
      const t = await textLayer(/** @type {any} */ ({ type: 'text', balance: false, maxLines: 2, weight: 700, letterSpacing: -0.04, lineHeight: 0.92, ...s, kind: undefined, color }), ctx);
      shapes += t.body;
    } else {
      throw new TypeError(`Unknown ink shape "${s.kind}" (circle, ring, half, arch, band, rect, text)`);
    }
  }

  // Misregistration: the whole plate shifted a little.
  const shift = layer.offset ?? (() => {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(0.003, 0.01) * min;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d };
  })();
  const ox = len(shift.x, ctx.canvas, 0);
  const oy = len(shift.y, ctx.canvas, 0);

  // Texture: speckle (paper showing through) or a halftone screen, over the
  // canvas plus the misregistration (masks cost by area: keep it tight).
  const pad = Math.abs(ox) + Math.abs(oy) + 2;
  const bleed = { x: -pad, y: -pad, width: w + pad * 2, height: h + pad * 2 };
  let defs = '';
  // The plate's shift moves the shapes, not the texture masks: a mask under
  // a transform drops librsvg onto a slow path (~10× the cost).
  let inner = `<g fill="${color}" transform="translate(${num(ox)} ${num(oy)})">${shapes}</g>`;
  const texture = layer.texture ?? 'grain';
  if (texture === 'grain') {
    const size = 160;
    const px = new Uint8Array(size * size);
    const hole = layer.speckle ?? 0.09;
    for (let i = 0; i < px.length; i++) px[i] = rng.next() < hole ? 0 : 255;
    // Clump the holes a little (riso misses ink in specks, not single pixels).
    for (let i = 0; i < px.length; i++) if (px[i] === 0 && rng.next() < 0.5) px[(i + 1) % px.length] = 0;
    defs += `<pattern${attrs({ id: `${id}t`, patternUnits: 'userSpaceOnUse', width: size, height: size })}><image${attrs({ width: size, height: size, href: pngUri(encodePng(px, size, size, 1)) })}/></pattern>`;
    defs += `<mask${attrs({ id: `${id}tm`, maskUnits: 'userSpaceOnUse', ...bleed })}><rect${attrs({ ...bleed, fill: `url(#${id}t)` })}/></mask>`;
    inner = `<g mask="url(#${id}tm)">${inner}</g>`;
  } else if (texture === 'halftone') {
    const cell = len(layer.cell, ctx.canvas, '1.1vmin');
    // Screens at 0° or 45°, drawn into a PNG tile of whole cells (a 45° screen
    // is a square tile with dots at its centre and corners). An SVG pattern of
    // one dot per cell costs librsvg ~1.5s a canvas; an image tile, ~15ms.
    const angle = layer.angle ?? rng.pick([0, 45]);
    const c = Math.max(3, Math.round(cell));
    const r = c * (layer.dot ?? 0.46) * (angle === 45 ? 0.72 : 1);
    const per = 12;
    const T = c * per;
    const px = new Uint8Array(T * T);
    const centres = angle === 45 ? [[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1]] : [[0.5, 0.5]];
    for (let y = 0; y < T; y++) {
      for (let x = 0; x < T; x++) {
        // 2×2 supersampling for a clean dot edge.
        let hit = 0;
        for (const [sx, sy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
          const fx = ((x + sx) % c) / c;
          const fy = ((y + sy) % c) / c;
          if (centres.some(([cx, cy]) => Math.hypot(fx - cx, fy - cy) * c <= r)) hit++;
        }
        px[y * T + x] = Math.round((hit / 4) * 255);
      }
    }
    defs += `<pattern${attrs({ id: `${id}t`, patternUnits: 'userSpaceOnUse', width: T, height: T })}><image${attrs({ width: T, height: T, href: pngUri(encodePng(px, T, T, 1)) })}/></pattern>`;
    defs += `<mask${attrs({ id: `${id}tm`, maskUnits: 'userSpaceOnUse', ...bleed })}><rect${attrs({ ...bleed, fill: `url(#${id}t)` })}/></mask>`;
    inner = `<g mask="url(#${id}tm)">${inner}</g>`;
  }

  // Uneven density: the ink thins out across the sheet.
  const [dmin, dmax] = layer.density ?? [0.78, 1];
  if (dmin < 1) {
    const a = rng.range(0, Math.PI * 2);
    const gx = Math.cos(a) / 2;
    const gy = Math.sin(a) / 2;
    defs += `<linearGradient${attrs({ id: `${id}d`, x1: 0.5 - gx, y1: 0.5 - gy, x2: 0.5 + gx, y2: 0.5 + gy })}><stop offset="0" stop-color="#fff" stop-opacity="${num(dmax, 3)}"/><stop offset="1" stop-color="#fff" stop-opacity="${num(dmin, 3)}"/></linearGradient>`;
    defs += `<mask${attrs({ id: `${id}dm`, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: w, height: h })}><rect${attrs({ width: w, height: h, fill: `url(#${id}d)` })}/></mask>`;
    inner = `<g mask="url(#${id}dm)">${inner}</g>`;
  }

  const blend = layer.blend ?? 'multiply';
  const body = `<g${attrs({ style: blend === 'normal' ? undefined : `mix-blend-mode:${esc(blend)}`, opacity: layer.opacity != null && layer.opacity < 1 ? layer.opacity : undefined })}>${inner}</g>`;
  return { defs, body };
}

// ---------------------------------------------------------------------------
// Scalar fields (dither, contour)
// ---------------------------------------------------------------------------

/**
 * Seeded value noise in 2D, smooth, in [0, 1], with octaves.
 *
 * @param {import('./rng.js').Rng} rng
 * @param {number} octaves
 * @returns {(x: number, y: number) => number}
 */
export function valueNoise(rng, octaves = 3) {
  const N = 64;
  const grid = Float64Array.from({ length: N * N }, () => rng.next());
  const ox = rng.range(0, N);
  const oy = rng.range(0, N);
  const at = (/** @type {number} */ i, /** @type {number} */ j) => grid[(((j % N) + N) % N) * N + (((i % N) + N) % N)];
  const smooth = (/** @type {number} */ t) => t * t * t * (t * (t * 6 - 15) + 10);
  const base = (/** @type {number} */ x, /** @type {number} */ y) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = smooth(x - i);
    const fy = smooth(y - j);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * fx;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fx;
    return a + (b - a) * fy;
  };
  return (x, y) => {
    let v = 0;
    let amp = 1;
    let freq = 1;
    let total = 0;
    for (let o = 0; o < octaves; o++) {
      v += base(x * freq + ox, y * freq + oy) * amp;
      total += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return v / total;
  };
}

/** A 4×4 and an 8×8 Bayer matrix, normalised to (0, 1). */
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const BAYER8 = (() => {
  const m = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const b4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][(y % 4) * 4 + (x % 4)];
      const q = [0, 2, 3, 1][(y >> 2) * 2 + (x >> 2)];
      m.push((b4 * 4 + q + 0.5) / 64);
    }
  }
  return m;
})();

// ---------------------------------------------------------------------------
// dither
// ---------------------------------------------------------------------------

/**
 * `dither` — a soft field (gradient, noise, or a lit sphere / arch / circle)
 * rendered 1-bit at a visible cell size, ordered (Bayer 4×4 / 8×8) or by
 * blue-ish noise, in two colours (or three: two dithered bands). Embedded
 * as a tiny PNG drawn with nearest-neighbour scaling, so cells stay crisp.
 *
 * @param {import('./index.js').DitherLayer} layer
 * @param {import('./layers.js').RenderContext} ctx
 * @returns {import('./layers.js').Markup}
 */
export function dither(layer, ctx) {
  const { width: w, height: h, rng, palette: p } = ctx;
  const cell = Math.max(1, Math.round(len(layer.cell, ctx.canvas, '0.9vmin')));
  const cw = Math.ceil(w / cell);
  const chh = Math.ceil(h / cell);
  const colors = (layer.colors?.length ? layer.colors : [p.bg, p.accent]).map((c) => toHex(c));
  const rgb = colors.map((c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)));
  const matrix = layer.matrix ?? 'bayer4';
  const source = layer.source ?? 'field';
  const angle = ((layer.angle ?? rng.range(0, 360)) * Math.PI) / 180;
  const noise = valueNoise(rng, 3);
  const scale = layer.scale ?? 2.2;
  const shape = layer.shape ?? 'none';
  const sx = (layer.center?.x ?? 0.5) * cw;
  const sy = (layer.center?.y ?? 0.5) * chh;
  const sr = (len(layer.size, ctx.canvas, '30vmin') / cell);
  const gamma = layer.gamma ?? 1;
  const [lo, hi] = layer.range ?? [0, 1];

  /** The field's value at a cell. */
  const field = (x, y) => {
    const u = x / cw;
    const v = y / chh;
    let f;
    if (source === 'linear') f = 0.5 + ((u - 0.5) * Math.sin(angle) - (v - 0.5) * Math.cos(angle)) * 1.1;
    else if (source === 'radial') f = 1 - Math.hypot(u - (layer.center?.x ?? 0.5), (v - (layer.center?.y ?? 0.5)) * (h / w)) * 1.4;
    else f = noise(u * scale * (w / Math.max(w, h)), v * scale * (h / Math.max(w, h)));
    if (shape !== 'none') {
      const dx = (x - sx) / sr;
      const dy = (y - sy) / sr;
      const inside = shape === 'arch' ? Math.abs(dx) <= 1 && (dy >= 0 ? dy <= 1.3 : dx * dx + dy * dy <= 1) : dx * dx + dy * dy <= 1;
      if (inside) {
        if (shape === 'sphere') {
          // Lambert shading lit from the upper left.
          const dz = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
          f = Math.max(0, (-dx * 0.45 - dy * 0.55 + dz * 0.7)) * 1.05;
        } else f = 0.94;
      } else f *= 0.55;
    }
    return lo + (hi - lo) * Math.max(0, Math.min(1, f)) ** gamma;
  };

  /** The threshold at a cell. */
  const threshold = (x, y) => {
    if (matrix === 'bayer8') return BAYER8[(y % 8) * 8 + (x % 8)];
    if (matrix === 'noise') {
      // Interleaved gradient noise: cheap, evenly spread, blue-ish.
      const v = 52.9829189 * ((0.06711056 * x + 0.00583715 * y) % 1);
      return v - Math.floor(v);
    }
    return BAYER4[(y % 4) * 4 + (x % 4)];
  };

  const px = new Uint8Array(cw * chh * 3);
  const bands = colors.length - 1;
  for (let y = 0; y < chh; y++) {
    for (let x = 0; x < cw; x++) {
      const v = field(x, y) * bands;
      const band = Math.min(bands - 1, Math.floor(v));
      const frac = v - band;
      const c = rgb[frac > threshold(x, y) ? band + 1 : band];
      const i = (y * cw + x) * 3;
      px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
    }
  }
  const body = `<image${attrs({ x: 0, y: 0, width: cw * cell, height: chh * cell, preserveAspectRatio: 'none', 'image-rendering': 'optimizeSpeed', style: 'image-rendering:pixelated', href: pngUri(encodePng(px, cw, chh, 3)) })}/>`;
  return { defs: '', body: wrap(layer, body) };
}

// ---------------------------------------------------------------------------
// contour
// ---------------------------------------------------------------------------

/**
 * `contour` — topographic isolines of seeded noise: marching squares at
 * evenly spaced levels, segments joined into lines and smoothed (Chaikin),
 * one level highlighted in the accent, every Nth an index contour.
 *
 * @param {import('./index.js').ContourLayer} layer
 * @param {import('./layers.js').RenderContext} ctx
 * @returns {import('./layers.js').Markup}
 */
export function contour(layer, ctx) {
  const { width: w, height: h, rng, palette: p } = ctx;
  const levels = Math.max(2, Math.min(60, layer.levels ?? 20));
  const step = Math.min(w, h) / (layer.resolution ?? 110);
  const gx = Math.ceil(w / step) + 1;
  const gy = Math.ceil(h / step) + 1;
  const noise = valueNoise(rng, layer.octaves ?? 3);
  const scale = layer.scale ?? 2.4;
  const m = Math.max(w, h);
  const vals = new Float64Array(gx * gy);
  let vmin = Infinity;
  let vmax = -Infinity;
  for (let j = 0; j < gy; j++) {
    for (let i = 0; i < gx; i++) {
      const v = noise(((i * step) / m) * scale, ((j * step) / m) * scale);
      vals[j * gx + i] = v;
      vmin = Math.min(vmin, v);
      vmax = Math.max(vmax, v);
    }
  }
  const at = (i, j) => vals[j * gx + i];
  const lineColor = col(layer.color, p.text);
  const stroke = len(layer.stroke, ctx.canvas, '0.14vmin');
  const every = layer.index ?? 5;
  const hl = layer.highlight === false ? -1 : typeof layer.highlight === 'number' ? layer.highlight : rng.int(Math.floor(levels * 0.3), Math.floor(levels * 0.7));

  let normal = '';
  let index = '';
  let accent = '';
  for (let k = 1; k <= levels; k++) {
    const t = vmin + ((vmax - vmin) * k) / (levels + 1);
    const segs = [];
    for (let j = 0; j < gy - 1; j++) {
      for (let i = 0; i < gx - 1; i++) {
        const a = at(i, j);
        const b = at(i + 1, j);
        const c = at(i + 1, j + 1);
        const d = at(i, j + 1);
        const code = (a > t ? 8 : 0) | (b > t ? 4 : 0) | (c > t ? 2 : 0) | (d > t ? 1 : 0);
        if (code === 0 || code === 15) continue;
        const x0 = i * step;
        const y0 = j * step;
        const lerp = (v1, v2) => (t - v1) / (v2 - v1);
        const top = [x0 + lerp(a, b) * step, y0];
        const right = [x0 + step, y0 + lerp(b, c) * step];
        const bottom = [x0 + lerp(d, c) * step, y0 + step];
        const left = [x0, y0 + lerp(a, d) * step];
        const E = { 1: [[left, bottom]], 2: [[bottom, right]], 3: [[left, right]], 4: [[top, right]], 5: [[left, top], [bottom, right]], 6: [[top, bottom]], 7: [[left, top]], 8: [[left, top]], 9: [[top, bottom]], 10: [[left, bottom], [top, right]], 11: [[top, right]], 12: [[left, right]], 13: [[bottom, right]], 14: [[left, bottom]] }[code];
        for (const s of E) segs.push(s);
      }
    }
    const d = chains(segs).map((line) => smoothPath(line)).join('');
    if (k === hl) accent += d;
    else if (every > 0 && k % every === 0) index += d;
    else normal += d;
  }
  const opacity = layer.opacity ?? 0.5;
  let body = `<path${attrs({ d: normal, fill: 'none', stroke: lineColor, 'stroke-width': stroke, opacity, 'stroke-linejoin': 'round' })}/>`;
  if (index) body += `<path${attrs({ d: index, fill: 'none', stroke: lineColor, 'stroke-width': stroke * (layer.indexWeight ?? 2.2), opacity: Math.min(1, opacity * 1.3), 'stroke-linejoin': 'round' })}/>`;
  if (accent) body += `<path${attrs({ d: accent, fill: 'none', stroke: col(layer.highlightColor, p.accent), 'stroke-width': stroke * 2.4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })}/>`;
  return { defs: '', body: wrap({ ...layer, opacity: undefined }, body) };
}

/**
 * Join marching-squares segments into polylines by shared endpoints.
 *
 * @param {number[][][]} segs - `[[x, y], [x, y]]` pairs.
 * @returns {number[][][]} Polylines.
 */
function chains(segs) {
  const key = (/** @type {number[]} */ p) => `${Math.round(p[0] * 100)},${Math.round(p[1] * 100)}`;
  /** @type {Map<string, number[]>} */
  const ends = new Map();
  segs.forEach((s, i) => {
    for (const p of s) {
      const k = key(p);
      const list = ends.get(k);
      if (list) list.push(i); else ends.set(k, [i]);
    }
  });
  const used = new Uint8Array(segs.length);
  const out = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const line = [segs[i][0], segs[i][1]];
    for (const dir of [1, 0]) {
      for (;;) {
        const tip = dir ? line[line.length - 1] : line[0];
        const next = (ends.get(key(tip)) ?? []).find((n) => !used[n]);
        if (next === undefined) break;
        used[next] = 1;
        const [p0, p1] = segs[next];
        const other = key(p0) === key(tip) ? p1 : p0;
        if (dir) line.push(other); else line.unshift(other);
      }
    }
    if (line.length > 2) out.push(line);
  }
  return out;
}

/**
 * Smooth a polyline (two rounds of Chaikin) to path data.
 *
 * @param {number[][]} pts
 * @returns {string}
 */
function smoothPath(pts) {
  let p = pts;
  const closed = Math.hypot(p[0][0] - p[p.length - 1][0], p[0][1] - p[p.length - 1][1]) < 0.01;
  for (let r = 0; r < 2; r++) {
    const q = closed ? [] : [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [a, b] = [p[i], p[i + 1]];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    if (!closed) q.push(p[p.length - 1]); else q.push(q[0]);
    p = q;
  }
  return `M${p.map((pt) => `${num(pt[0], 1)} ${num(pt[1], 1)}`).join('L')}${closed ? 'Z' : ''}`;
}

// ---------------------------------------------------------------------------
// waveform
// ---------------------------------------------------------------------------

/**
 * Seeded demo peaks: a smooth loudness envelope with transients. Not audio:
 * pass `peaks` or `audio` for a real episode.
 *
 * @param {import('./rng.js').Rng} rng
 * @param {number} n
 * @returns {number[]}
 */
export function demoPeaks(rng, n) {
  const env = valueNoise(rng, 2);
  return Array.from({ length: n }, (_, i) => {
    const t = i / n;
    const fade = Math.min(1, t * 18, (1 - t) * 18);
    return Math.max(0.04, Math.min(1, (0.25 + env(t * 6, 0.5) * 0.8) * (0.55 + rng.next() * 0.45) * fade));
  });
}

/**
 * Resample peaks to `n` values (max over each bucket).
 *
 * @param {number[]} peaks
 * @param {number} n
 * @returns {number[]}
 */
function resample(peaks, n) {
  if (peaks.length === n) return peaks.slice();
  return Array.from({ length: n }, (_, i) => {
    const a = Math.floor((i * peaks.length) / n);
    const b = Math.max(a + 1, Math.floor(((i + 1) * peaks.length) / n));
    let m = 0;
    for (let k = a; k < b; k++) m = Math.max(m, Math.abs(peaks[k] ?? 0));
    return m;
  });
}

/** @param {number} s @returns {string} `m:ss` or `h:mm:ss`. */
export function formatDuration(s) {
  const t = Math.round(s);
  const hh = Math.floor(t / 3600);
  const mm = Math.floor((t % 3600) / 60);
  const ss = String(t % 60).padStart(2, '0');
  return hh ? `${hh}:${String(mm).padStart(2, '0')}:${ss}` : `${mm}:${ss}`;
}

/**
 * `waveform` — an episode's waveform: `peaks` you pass, or `audio` decoded at
 * build with `@arraypress/waveform-gen` (an optional peer). Styles: bars,
 * mirrored bars, a line, or dots. With neither, seeded demo peaks.
 *
 * @param {import('./index.js').WaveformLayer} layer
 * @param {import('./layers.js').RenderContext} ctx
 * @returns {Promise<import('./layers.js').Markup>}
 */
export async function waveform(layer, ctx) {
  const { rng, palette: p } = ctx;
  const r = regionPx(layer.region ?? { x: 0.07, y: 0.3, width: 0.86, height: 0.4 }, ctx.canvas);
  const count = Math.max(8, layer.bars ?? 88);
  let peaks = layer.peaks;
  let duration = layer.duration;
  if (!peaks && layer.audio) {
    let gen;
    try {
      gen = await import('@arraypress/waveform-gen');
    } catch {
      throw new Error('Decoding audio needs @arraypress/waveform-gen: npm install @arraypress/waveform-gen (or pass peaks)');
    }
    const res = await gen.generatePeaks(layer.audio, { samples: Math.max(count * 4, 400) });
    peaks = res.peaks;
    duration ??= res.duration;
  }
  const values = resample(peaks?.length ? peaks.map(Number) : demoPeaks(rng, count), count);
  const top = Math.max(...values, 1e-6);
  const v = values.map((x) => x / top);
  const color = col(layer.color, p.accent);
  const style = layer.style ?? 'mirrored';
  const pitch = r.width / count;
  const bw = pitch * (1 - (layer.gap ?? 0.4));
  const mid = r.y + r.height / 2;
  const rx = layer.round === false ? 0 : bw / 2;
  let body = '';
  if (style === 'bars' || style === 'mirrored') {
    const rects = v.map((a, i) => {
      const x = r.x + i * pitch + (pitch - bw) / 2;
      const hh = Math.max(bw, a * (style === 'mirrored' ? r.height : r.height));
      const y = style === 'mirrored' ? mid - hh / 2 : r.y + r.height - hh;
      return `<rect${attrs({ x, y, width: bw, height: hh, rx: Math.min(rx, hh / 2) || undefined })}/>`;
    });
    body = `<g fill="${color}">${rects.join('')}</g>`;
  } else if (style === 'dots') {
    const rr = bw / 2;
    const dots = [];
    v.forEach((a, i) => {
      const x = r.x + i * pitch + pitch / 2;
      const n = Math.max(1, Math.round((a * r.height) / (rr * 2.6)));
      for (let k = 0; k < n; k++) {
        const off = (k - (n - 1) / 2) * rr * 2.6;
        dots.push(`<circle${attrs({ cx: x, cy: mid + off, r: rr })}/>`);
      }
    });
    body = `<g fill="${color}">${dots.join('')}</g>`;
  } else if (style === 'line') {
    const pts = v.map((a, i) => [r.x + i * pitch + pitch / 2, mid - (a * r.height) / 2]);
    const low = v.map((a, i) => [r.x + i * pitch + pitch / 2, mid + (a * r.height) / 2]).reverse();
    const d = `M${[...pts, ...low].map(([x, y]) => `${num(x)} ${num(y)}`).join('L')}Z`;
    body = `<path${attrs({ d, fill: color, opacity: 0.18 })}/><path${attrs({ d: `M${pts.map(([x, y]) => `${num(x)} ${num(y)}`).join('L')}`, fill: 'none', stroke: color, 'stroke-width': len(layer.stroke, ctx.canvas, '0.35vmin'), 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })}/>`;
  } else {
    throw new TypeError(`Unknown waveform style "${style}" (bars, mirrored, line, dots)`);
  }
  // A caption under the wave: the duration (when known) or your text.
  const caption = layer.caption === true ? (typeof duration === 'number' ? formatDuration(duration) : duration ?? undefined) : layer.caption;
  if (caption) {
    const t = await textLayer(/** @type {any} */ ({ type: 'text', content: caption, size: len(layer.captionSize, ctx.canvas, '3vmin'), weight: 500, letterSpacing: 0.02, color: col(layer.captionColor, p.text), anchor: 'top-left', position: { x: r.x / ctx.width, y: (r.y + r.height) / ctx.height + 0.04 }, maxLines: 1, balance: false }), ctx);
    body += t.body;
  }
  return { defs: '', body: wrap(layer, body) };
}

// ---------------------------------------------------------------------------
// tiles (bauhaus)
// ---------------------------------------------------------------------------

/**
 * `tiles` — a Bauhaus grid: each cell a ground colour with one shape
 * (quarter circle, half circle, circle, square, triangle) in another,
 * rotated by quarters. `series` seeds the grid's rhythm (cell counts and a
 * large merged cell), so a series of covers shares a family look while the
 * cover's own seed picks each cell.
 *
 * @param {import('./index.js').TilesLayer} layer
 * @param {import('./layers.js').RenderContext} ctx
 * @returns {import('./layers.js').Markup}
 */
export function tiles(layer, ctx) {
  const { rng, palette: p } = ctx;
  const r = regionPx(layer.region, ctx.canvas);
  // The series seeds the rhythm; without one, each cover has its own.
  const series = layer.series != null ? createRng(`series:${layer.series}`) : rng;
  const cols = layer.cols ?? series.int(2, 4);
  const rows = layer.rows ?? Math.max(1, Math.round((cols * r.height) / r.width));
  const big = layer.merge === false || cols < 3 || rows < 2 ? null : { c: series.int(0, cols - 2), r: series.int(0, rows - 2) };
  const kindsFor = series.shuffle(['quarter', 'half', 'circle', 'square', 'triangle', 'quarter', 'half']);
  const colors = (layer.colors?.length ? layer.colors : [p.accent, ...p.colors.slice(1, 3), p.text]).map((c) => toHex(c));
  const ground = col(layer.ground, p.bg);
  const all = [ground, ...colors];
  const cw = r.width / cols;
  const chh = r.height / rows;
  let body = '';
  /** One cell. */
  const cell = (x, y, w, h, k) => {
    const kind = layer.kinds?.length ? rng.pick(layer.kinds) : kindsFor[(k + rng.int(0, 2)) % kindsFor.length];
    const bgI = rng.int(0, all.length - 1);
    let fgI = rng.int(0, all.length - 2);
    if (fgI >= bgI) fgI++;
    const bg = all[bgI];
    const fg = all[fgI];
    const rot = rng.int(0, 3) * 90;
    const s = Math.min(w, h);
    const cx = x + w / 2;
    const cy = y + h / 2;
    let shape = '';
    const t = `rotate(${rot} ${num(cx)} ${num(cy)})`;
    if (kind === 'quarter') shape = `<path${attrs({ d: `M${num(cx - s / 2)} ${num(cy + s / 2)}V${num(cy - s / 2)}A${num(s)} ${num(s)} 0 0 1 ${num(cx + s / 2)} ${num(cy + s / 2)}Z`, fill: fg, transform: t })}/>`;
    else if (kind === 'half') shape = `<path${attrs({ d: `M${num(cx - s / 2)} ${num(cy + s / 2)}A${num(s / 2)} ${num(s / 2)} 0 0 1 ${num(cx + s / 2)} ${num(cy + s / 2)}Z`, fill: fg, transform: t })}/>`;
    else if (kind === 'circle') shape = `<circle${attrs({ cx, cy, r: s * 0.36, fill: fg })}/>`;
    else if (kind === 'square') shape = `<rect${attrs({ x: cx - s * 0.3, y: cy - s * 0.3, width: s * 0.6, height: s * 0.6, fill: fg, transform: t })}/>`;
    else shape = `<path${attrs({ d: `M${num(cx - s / 2)} ${num(cy + s / 2)}L${num(cx + s / 2)} ${num(cy + s / 2)}L${num(cx - s / 2)} ${num(cy - s / 2)}Z`, fill: fg, transform: t })}/>`;
    return `<rect${attrs({ x, y, width: w, height: h, fill: bg })}/>${shape}`;
  };
  let k = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (big && i >= big.c && i <= big.c + 1 && j >= big.r && j <= big.r + 1) {
        if (i === big.c && j === big.r) body += cell(r.x + i * cw, r.y + j * chh, cw * 2, chh * 2, k++);
        continue;
      }
      body += cell(r.x + i * cw, r.y + j * chh, cw, chh, k++);
    }
  }
  const id = `${ctx.id}c`;
  return { defs: `<clipPath id="${id}"><rect${attrs(r)}/></clipPath>`, body: wrap(layer, `<g clip-path="url(#${id})">${body}</g>`) };
}

// ---------------------------------------------------------------------------
// rule
// ---------------------------------------------------------------------------

/**
 * `rule` — a hairline from one point to another (fractions of the canvas).
 *
 * @param {import('./index.js').RuleLayer} layer
 * @param {import('./layers.js').RenderContext} ctx
 * @returns {import('./layers.js').Markup}
 */
export function rule(layer, ctx) {
  const { width: w, height: h } = ctx;
  const inset = len(layer.inset, ctx.canvas, Math.sqrt(w * h) * 0.07);
  const y = (layer.y ?? 0.15) * h;
  const from = layer.from ? [layer.from.x * w, layer.from.y * h] : [inset, y];
  const to = layer.to ? [layer.to.x * w, layer.to.y * h] : [w - inset, y];
  const body = `<path${attrs({ d: `M${num(from[0])} ${num(from[1])}L${num(to[0])} ${num(to[1])}`, stroke: col(layer.color, ctx.palette.text), 'stroke-width': len(layer.stroke, ctx.canvas, '0.12vmin'), fill: 'none' })}/>`;
  return { defs: '', body: wrap(layer, body) };
}

