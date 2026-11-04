/**
 * Optical blurs on pixels: `lens` (out of focus through an aperture, with
 * bright highlights blooming into bokeh discs or polygons) and `tilt`
 * (tilt-shift: a sharp band, the blur growing away from it).
 *
 * The lens blur works in linear light with highlights boosted (so a
 * small light spreads into a bright disc, as it does through glass) and
 * convolves with the aperture's exact shape a row at a time: each row of
 * the shape is a span, summed from running totals, so the cost is one
 * lookup per row of the kernel, not per pixel of it. Large radii work on
 * a smaller copy (bokeh has no fine detail) and scale back.
 *
 * @module effects/lens
 */

import { TO_LINEAR, toSrgb, px, pointPx, smoothstep, gaussian, shrink, bilinear, premultiplied, unpremultiply, enlarge } from './buffer.js';

/** The kernel radius a lens blur works at, px (larger radii work on a smaller copy). */
const WORK_RADIUS = 10;

/**
 * One row of the aperture: the span it covers (pixel offsets, fractional)
 * and how much of the row's height it fills.
 *
 * @typedef {{ dy: number, l: number, r: number, wgt: number }} Span
 */

/**
 * The aperture as spans: a disc (`blades` 0) or a polygon of `blades`
 * sides turned `rotation` degrees, radius `R`. Each row is the average
 * of four sub-rows, so its top and bottom edges are anti-aliased too.
 *
 * @param {number} R
 * @param {number} blades
 * @param {number} rotation
 * @returns {Span[]}
 */
export function aperture(R, blades, rotation) {
  const n = Math.ceil(R + 0.5);
  /** @type {[number, number][]} */
  const poly = [];
  if (blades >= 3) {
    for (let k = 0; k < blades; k++) {
      const a = ((rotation - 90) * Math.PI) / 180 + (2 * Math.PI * k) / blades;
      poly.push([R * Math.cos(a), R * Math.sin(a)]);
    }
  }
  /** @param {number} y @returns {[number, number] | null} */
  const at = (y) => {
    if (!poly.length) {
      if (Math.abs(y) >= R) return null;
      const s = Math.sqrt(R * R - y * y);
      return [-s, s];
    }
    let lo = Infinity;
    let hi = -Infinity;
    for (let k = 0; k < poly.length; k++) {
      const [x0, y0] = poly[k];
      const [x1, y1] = poly[(k + 1) % poly.length];
      if ((y0 <= y && y1 >= y) || (y1 <= y && y0 >= y)) {
        const x = y1 === y0 ? x0 : x0 + ((y - y0) / (y1 - y0)) * (x1 - x0);
        lo = Math.min(lo, x);
        hi = Math.max(hi, x);
      }
    }
    return lo <= hi ? [lo, hi] : null;
  };
  /** @type {Span[]} */
  const spans = [];
  for (let dy = -n; dy <= n; dy++) {
    let l = 0;
    let r = 0;
    let hits = 0;
    for (let s = 0; s < 4; s++) {
      const got = at(dy - 0.5 + (s + 0.5) / 4);
      if (!got) continue;
      l += got[0];
      r += got[1];
      hits++;
    }
    if (hits) spans.push({ dy, l: l / hits, r: r / hits, wgt: hits / 4 });
  }
  return spans;
}

/**
 * Convolve premultiplied float RGBA with an aperture, edges held.
 *
 * @param {Float32Array} src - Interleaved RGBA.
 * @param {number} w
 * @param {number} h
 * @param {Span[]} spans
 * @returns {Float32Array}
 */
export function convolveSpans(src, w, h, spans) {
  const pad = Math.ceil(Math.max(...spans.map((s) => Math.max(-s.l, s.r)))) + 2;
  const pw = w + 2 * pad;
  // Running totals along each row (edge held), one more than the row.
  const sums = new Float32Array(h * (pw + 1) * 4);
  for (let y = 0; y < h; y++) {
    const base = y * (pw + 1) * 4;
    for (let x = 0; x < pw; x++) {
      const sx = Math.min(w - 1, Math.max(0, x - pad));
      const i = (y * w + sx) * 4;
      const o = base + (x + 1) * 4;
      sums[o] = sums[o - 4] + src[i];
      sums[o + 1] = sums[o - 3] + src[i + 1];
      sums[o + 2] = sums[o - 2] + src[i + 2];
      sums[o + 3] = sums[o - 1] + src[i + 3];
    }
  }
  // Each span: whole pixels [L, R], and part of the pixel either side.
  const rows = spans.map((s) => {
    const L = Math.ceil(s.l + 0.5);
    const R = Math.floor(s.r - 0.5);
    const cover = (/** @type {number} */ dx) => Math.max(0, Math.min(dx + 0.5, s.r) - Math.max(dx - 0.5, s.l));
    return { dy: s.dy, L, R, wgt: s.wgt, pl: L - 1 === R + 1 ? cover(L - 1) : cover(L - 1), pr: L - 1 === R + 1 ? 0 : cover(R + 1), full: R >= L };
  });
  let total = 0;
  for (const r of rows) total += r.wgt * ((r.full ? r.R - r.L + 1 : 0) + r.pl + r.pr);
  const norm = 1 / total;
  const out = new Float32Array(w * h * 4);
  const acc = new Float64Array(4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      acc[0] = acc[1] = acc[2] = acc[3] = 0;
      for (let k = 0; k < rows.length; k++) {
        const r = rows[k];
        let yy = y + r.dy;
        if (yy < 0) yy = 0; else if (yy >= h) yy = h - 1;
        const base = yy * (pw + 1) * 4;
        const wg = r.wgt;
        if (r.full) {
          const a = base + (x + r.L + pad) * 4;
          const b = base + (x + r.R + pad + 1) * 4;
          acc[0] += (sums[b] - sums[a]) * wg;
          acc[1] += (sums[b + 1] - sums[a + 1]) * wg;
          acc[2] += (sums[b + 2] - sums[a + 2]) * wg;
          acc[3] += (sums[b + 3] - sums[a + 3]) * wg;
        }
        if (r.pl) {
          const sx = x + r.L - 1;
          const i = (yy * w + (sx < 0 ? 0 : sx >= w ? w - 1 : sx)) * 4;
          const f = r.pl * wg;
          acc[0] += src[i] * f; acc[1] += src[i + 1] * f; acc[2] += src[i + 2] * f; acc[3] += src[i + 3] * f;
        }
        if (r.pr) {
          const sx = x + r.R + 1;
          const i = (yy * w + (sx < 0 ? 0 : sx >= w ? w - 1 : sx)) * 4;
          const f = r.pr * wg;
          acc[0] += src[i] * f; acc[1] += src[i + 1] * f; acc[2] += src[i + 2] * f; acc[3] += src[i + 3] * f;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = acc[0] * norm; out[o + 1] = acc[1] * norm; out[o + 2] = acc[2] * norm; out[o + 3] = acc[3] * norm;
    }
  }
  return out;
}

/**
 * `lens`: a lens blur. `radius` (the aperture), `blades` (0 round, else
 * that many sides), `rotation`, and the highlights: everything brighter
 * than `threshold` is boosted by `highlights` before blurring, so lights
 * become bright bokeh shapes.
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'lens' }} fx
 * @param {any} ctx
 * @returns {Uint8ClampedArray}
 */
export function lens(img, fx, ctx) {
  const { data, width: w, height: h } = img;
  const R = px(fx.radius, ctx, img, '1.2vmin');
  if (R < 0.5) return data;
  const f = Math.max(1, Math.floor(R / WORK_RADIUS));
  const sw = Math.ceil(w / f);
  const sh = Math.ceil(h / f);
  const t = fx.threshold ?? 0.75;
  const gain = 8 * (fx.highlights ?? 1);
  // Linear, premultiplied, highlights boosted, averaged into f×f cells.
  const work = new Float32Array(sw * sh * 4);
  const count = new Float32Array(sw * sh);
  for (let y = 0; y < h; y++) {
    const row = ((y / f) | 0) * sw;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3] / 255;
      const c = row + ((x / f) | 0);
      count[c]++;
      if (!a) continue;
      const lum = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      const s = smoothstep(t, 1, lum);
      const k = a * (1 + gain * s * s);
      const o = c * 4;
      work[o] += TO_LINEAR[data[i]] * k;
      work[o + 1] += TO_LINEAR[data[i + 1]] * k;
      work[o + 2] += TO_LINEAR[data[i + 2]] * k;
      work[o + 3] += a;
    }
  }
  for (let c = 0; c < count.length; c++) { const k = 1 / count[c]; work[c * 4] *= k; work[c * 4 + 1] *= k; work[c * 4 + 2] *= k; work[c * 4 + 3] *= k; }
  const blurred = convolveSpans(work, sw, sh, aperture(R / f, fx.blades ?? 0, fx.rotation ?? 0));
  const small = new Uint8ClampedArray(sw * sh * 4);
  for (let i = 0; i < blurred.length; i += 4) {
    const a = blurred[i + 3];
    if (a <= 1e-4) continue;
    small[i] = toSrgb(blurred[i] / a);
    small[i + 1] = toSrgb(blurred[i + 1] / a);
    small[i + 2] = toSrgb(blurred[i + 2] / a);
    small[i + 3] = a * 255 + 0.5;
  }
  return f === 1 ? small : enlarge(small, sw, sh, w, h);
}

/**
 * `tilt`: tilt-shift. Sharp within `width` of a line through `center` at
 * `angle`, the blur growing over `falloff` beyond it to `radius`; with
 * `saturate` for the toy-town look.
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'tilt' }} fx
 * @param {any} ctx
 * @returns {Uint8ClampedArray}
 */
export function tilt(img, fx, ctx) {
  const { width: w, height: h } = img;
  const sigma = px(fx.radius, ctx, img, '1.4vmin');
  const band = px(fx.width, ctx, img, '8vmin');
  const falloff = Math.max(1, px(fx.falloff, ctx, img, '22vmin'));
  const [cx, cy] = pointPx(fx.center, img);
  const a = ((fx.angle ?? 0) * Math.PI) / 180;
  const nx = -Math.sin(a);
  const ny = Math.cos(a);
  const src = premultiplied(img);
  // A sharp level and three blurred ones (worked small: a wide blur has no
  // detail to lose); each pixel mixes the two either side of its blur,
  // read straight from the small copies.
  const steps = [0, 0.25, 0.5, 1];
  const levels = steps.slice(1).map((k) => {
    const f = Math.max(1, Math.min(8, Math.floor((sigma * k) / 6)));
    const small = f > 1 ? shrink(src, w, h, f) : { data: new Uint8ClampedArray(src), width: w, height: h };
    gaussian(small.data, small.width, small.height, 4, (sigma * k) / f);
    return { ...small, f };
  });
  const out = new Uint8ClampedArray(src.length);
  const lo = new Float32Array(4);
  const hi = new Float32Array(4);
  /** @param {number} k @param {number} x @param {number} y @param {Float32Array} to */
  const read = (k, x, y, to) => {
    if (k === 0) { const i = (y * w + x) * 4; to[0] = src[i]; to[1] = src[i + 1]; to[2] = src[i + 2]; to[3] = src[i + 3]; return; }
    const l = levels[k - 1];
    bilinear(l.data, l.width, l.height, (x + 0.5) / l.f - 0.5, (y + 0.5) / l.f - 0.5, to, 0);
  };
  const sat = fx.saturate ?? 1;
  for (let y = 0, i = 0; y < h; y++) {
    for (let x = 0; x < w; x++, i += 4) {
      const d = Math.abs((x + 0.5 - cx) * nx + (y + 0.5 - cy) * ny);
      const s = smoothstep(band, band + falloff, d);
      if (s <= 0) { out[i] = src[i]; out[i + 1] = src[i + 1]; out[i + 2] = src[i + 2]; out[i + 3] = src[i + 3]; } else {
        let k = 1;
        while (k < steps.length - 1 && steps[k] < s) k++;
        const t = (s - steps[k - 1]) / (steps[k] - steps[k - 1]);
        read(k - 1, x, y, lo);
        read(k, x, y, hi);
        for (let c = 0; c < 4; c++) out[i + c] = lo[c] + (hi[c] - lo[c]) * t;
      }
      if (sat !== 1) {
        const l = 0.2126 * out[i] + 0.7152 * out[i + 1] + 0.0722 * out[i + 2];
        out[i] = l + (out[i] - l) * sat;
        out[i + 1] = l + (out[i + 1] - l) * sat;
        out[i + 2] = l + (out[i + 2] - l) * sat;
      }
    }
  }
  return img.opaque ? out : unpremultiply(out);
}
