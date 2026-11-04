/**
 * Blurs about a centre, on pixels: `zoom` (radial, every point smeared
 * toward the centre), `spin` (rotational, along circles round it) and
 * `rays` (god rays: the highlights streaked away from a light).
 *
 * The layer is resampled into polar coordinates (one row per radius or
 * per angle, a pixel apart at the rim), blurred along one axis with
 * running sums (O(1) a sample, whatever the length), and resampled back.
 * The centre pixel never moves.
 *
 * @module effects/polar
 */

import { premultiplied, unpremultiply, bilinear, pointPx, luma, smoothstep, toSrgb, TO_LINEAR, shrink, enlarge } from './buffer.js';
import { rgb } from './util.js';

/** The most polar samples (angles × radii) a blur works on. */
const BUDGET = 30e6;

/**
 * A polar grid round a centre, sized to the farthest corner: a sample a
 * pixel apart along each ray, and round the rim a pixel apart (two, when
 * `blur` px of smear there hides it).
 *
 * @param {number} w @param {number} h @param {number} cx @param {number} cy
 * @param {(rmax: number) => number} [blur] - How long the blur is at the rim, px.
 * @returns {{ nr: number, nt: number }}
 */
function gridFor(w, h, cx, cy, blur) {
  const rmax = Math.max(Math.hypot(cx, cy), Math.hypot(w - 1 - cx, cy), Math.hypot(cx, h - 1 - cy), Math.hypot(w - 1 - cx, h - 1 - cy)) + 2;
  const nr = Math.ceil(rmax) + 1;
  const step = blur && blur(rmax) >= 32 ? 2 : 1;
  const nt = Math.max(16, Math.min(Math.ceil((2 * Math.PI * rmax) / step), Math.floor(BUDGET / nr)));
  return { nr, nt };
}

/**
 * Resample into polar coordinates: row-major by angle (`byAngle`, each row
 * a ray from the centre) or by radius (each row a circle).
 *
 * @param {Uint8ClampedArray} src - Premultiplied RGBA.
 * @param {number} w @param {number} h @param {number} cx @param {number} cy
 * @param {number} nt @param {number} nr
 * @param {boolean} byAngle
 * @returns {Uint8ClampedArray}
 */
function toPolar(src, w, h, cx, cy, nt, nr, byAngle) {
  const out = new Uint8ClampedArray(nt * nr * 4);
  for (let j = 0; j < nt; j++) {
    const t = (2 * Math.PI * j) / nt;
    const c = Math.cos(t);
    const s = Math.sin(t);
    for (let i = 0; i < nr; i++) bilinear(src, w, h, cx + i * c, cy + i * s, out, (byAngle ? j * nr + i : i * nt + j) * 4);
  }
  return out;
}

/**
 * Resample polar samples back onto the layer's pixels.
 *
 * @param {Uint8ClampedArray} p
 * @param {number} w @param {number} h @param {number} cx @param {number} cy
 * @param {number} nt @param {number} nr
 * @param {boolean} byAngle
 * @returns {Uint8ClampedArray}
 */
function fromPolar(p, w, h, cx, cy, nt, nr, byAngle) {
  const out = new Uint8ClampedArray(w * h * 4);
  const kt = nt / (2 * Math.PI);
  for (let y = 0, o = 0; y < h; y++) {
    const dy = y - cy;
    for (let x = 0; x < w; x++, o += 4) {
      const dx = x - cx;
      let r = Math.sqrt(dx * dx + dy * dy);
      let t = Math.atan2(dy, dx);
      if (t < 0) t += 2 * Math.PI;
      if (r > nr - 1) r = nr - 1;
      const ft = t * kt;
      let j0 = ft | 0;
      const wt = ft - j0;
      if (j0 >= nt) j0 -= nt;
      const j1 = j0 + 1 === nt ? 0 : j0 + 1;
      const i0 = r | 0;
      const wr = r - i0;
      const i1 = i0 + 1 < nr ? i0 + 1 : i0;
      const a = (byAngle ? j0 * nr + i0 : i0 * nt + j0) * 4;
      const b = (byAngle ? j0 * nr + i1 : i1 * nt + j0) * 4;
      const c = (byAngle ? j1 * nr + i0 : i0 * nt + j1) * 4;
      const d = (byAngle ? j1 * nr + i1 : i1 * nt + j1) * 4;
      const w00 = (1 - wr) * (1 - wt);
      const w10 = wr * (1 - wt);
      const w01 = (1 - wr) * wt;
      const w11 = wr * wt;
      for (let k = 0; k < 4; k++) out[o + k] = p[a + k] * w00 + p[b + k] * w10 + p[c + k] * w01 + p[d + k] * w11;
    }
  }
  return out;
}

/** The centre in pixel coordinates (pixel x's centre is x). @param {any} fx @param {import('./buffer.js').Pixels} img @returns {[number, number]} */
function centreOf(fx, img) {
  const [x, y] = pointPx(fx.center, img);
  return [x - 0.5, y - 0.5];
}

/**
 * `spin`: a rotational blur, `angle` degrees along circles round `center`
 * (a camera turned during the exposure).
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'spin' }} fx
 * @returns {Uint8ClampedArray}
 */
export function spin(img, fx) {
  const { width: w, height: h } = img;
  const [cx, cy] = centreOf(fx, img);
  const turn = Math.min(360, Math.abs(fx.angle ?? 12));
  const { nr, nt } = gridFor(w, h, cx, cy, (r) => (turn / 180) * Math.PI * r);
  const span = Math.round((turn / 360) * nt);
  if (span < 2) return img.data;
  const p = toPolar(premultiplied(img), w, h, cx, cy, nt, nr, false);
  // Each row is a circle: a circular box of `span` samples, centred.
  const row = new Uint8ClampedArray(nt * 4);
  const acc = new Float64Array(4);
  const half = span >> 1;
  const inv = 1 / (span + 1);
  for (let i = 0; i < nr; i++) {
    const base = i * nt * 4;
    row.set(p.subarray(base, base + nt * 4));
    acc.fill(0);
    for (let k = -half; k <= span - half; k++) {
      const j = ((k % nt) + nt) % nt;
      for (let c = 0; c < 4; c++) acc[c] += row[j * 4 + c];
    }
    for (let j = 0; j < nt; j++) {
      const o = base + j * 4;
      for (let c = 0; c < 4; c++) p[o + c] = acc[c] * inv;
      let add = j + span - half + 1;
      if (add >= nt) add -= nt;
      let sub = j - half;
      if (sub < 0) sub += nt;
      for (let c = 0; c < 4; c++) acc[c] += row[add * 4 + c] - row[sub * 4 + c];
    }
  }
  const out = fromPolar(p, w, h, cx, cy, nt, nr, false);
  return img.opaque ? out : unpremultiply(out);
}

/**
 * `zoom`: a radial blur, each point averaged with what lies between it and
 * `center` over `amount` of the way (a zoom during the exposure).
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'zoom' }} fx
 * @returns {Uint8ClampedArray}
 */
export function zoom(img, fx) {
  const { width: w, height: h } = img;
  const [cx, cy] = centreOf(fx, img);
  const amount = Math.min(0.95, Math.max(0, fx.amount ?? 0.2));
  const { nr, nt } = gridFor(w, h, cx, cy, (r) => amount * r);
  if (!amount) return img.data;
  const p = toPolar(premultiplied(img), w, h, cx, cy, nt, nr, true);
  const sum = new Float64Array((nr + 1) * 4);
  for (let j = 0; j < nt; j++) {
    const base = j * nr * 4;
    for (let i = 0; i < nr; i++) for (let c = 0; c < 4; c++) sum[(i + 1) * 4 + c] = sum[i * 4 + c] + p[base + i * 4 + c];
    for (let i = 1; i < nr; i++) {
      const from = Math.floor(i * (1 - amount));
      const k = 1 / (i + 1 - from);
      for (let c = 0; c < 4; c++) p[base + i * 4 + c] = (sum[(i + 1) * 4 + c] - sum[from * 4 + c]) * k;
    }
  }
  const out = fromPolar(p, w, h, cx, cy, nt, nr, true);
  return img.opaque ? out : unpremultiply(out);
}

/**
 * Where the light is, when `rays` isn't given a `center`: the brightest
 * patch, from a coarse grid.
 *
 * @param {import('./buffer.js').Pixels} img
 * @returns {[number, number]} Pixel coordinates.
 */
function brightest(img) {
  const { data, width: w, height: h } = img;
  const g = 48;
  const cw = w / g;
  const ch = h / g;
  let best = -1;
  let at = [w / 2, h / 2];
  for (let gy = 0; gy < g; gy++) {
    for (let gx = 0; gx < g; gx++) {
      let s = 0;
      let n = 0;
      for (let y = Math.floor(gy * ch); y < Math.floor((gy + 1) * ch); y += 2) {
        for (let x = Math.floor(gx * cw); x < Math.floor((gx + 1) * cw); x += 2) { const i = (y * w + x) * 4; s += luma(data, i) * data[i + 3]; n++; }
      }
      if (n && s / n > best) { best = s / n; at = [(gx + 0.5) * cw, (gy + 0.5) * ch]; }
    }
  }
  return /** @type {[number, number]} */ (at);
}

/**
 * `rays`: god rays. The highlights above `threshold` are streaked away
 * from the light (`center`, default the brightest patch): each point gets
 * the light between it and the source, so anything in the way casts a
 * shaft, fading over `length` (a fraction of the frame), tinted with
 * `color` and added on top (`intensity`).
 *
 * @param {import('./buffer.js').Pixels} img
 * @param {import('./index.js').Effect & { kind: 'rays' }} fx
 * @returns {Uint8ClampedArray}
 */
export function rays(img, fx) {
  const { data, width: w, height: h } = img;
  const [cx0, cy0] = fx.center ? centreOf(fx, img) : brightest(img);
  const t = fx.threshold ?? 0.8;
  const tint = rgb(fx.color ?? '#fff3d6');
  // Bright pass, premultiplied.
  const bright = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    const k = smoothstep(t, 1, luma(data, i) / 255) * (data[i + 3] / 255);
    if (!k) continue;
    bright[i] = data[i] * k * tint[0];
    bright[i + 1] = data[i + 1] * k * tint[1];
    bright[i + 2] = data[i + 2] * k * tint[2];
    bright[i + 3] = 255 * k;
  }
  // Rays are soft: past a couple of megapixels they're worked at half size.
  const f = w * h > 2.5e6 ? 2 : 1;
  const small = f > 1 ? shrink(bright, w, h, f) : { data: bright, width: w, height: h };
  const sw = small.width;
  const sh = small.height;
  const cx = (cx0 + 0.5) / f - 0.5;
  const cy = (cy0 + 0.5) / f - 0.5;
  const { nr, nt } = gridFor(sw, sh, cx, cy);
  const p = toPolar(small.data, sw, sh, cx, cy, nt, nr, true);
  // Each point gets the mean of the light between it and the source (an
  // occluder on the way leaves a shadow shaft), fading with distance.
  const reach = Math.max(1, (fx.length ?? 0.5) * nr);
  const acc = new Float64Array(4);
  for (let j = 0; j < nt; j++) {
    const base = j * nr * 4;
    acc.fill(0);
    for (let i = 0; i < nr; i++) {
      const fade = Math.exp(-i / reach) / (i + 1);
      for (let c = 0; c < 4; c++) {
        acc[c] += p[base + i * 4 + c];
        p[base + i * 4 + c] = Math.min(255, acc[c] * fade * 1.6);
      }
    }
  }
  const back = fromPolar(p, sw, sh, cx, cy, nt, nr, true);
  const glow = f > 1 ? enlarge(back, sw, sh, w, h) : back;
  // Added in linear light, so the rays brighten like light does.
  const k = fx.intensity ?? 1;
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    out[i + 3] = Math.max(data[i + 3], glow[i + 3]);
    for (let c = 0; c < 3; c++) out[i + c] = toSrgb(TO_LINEAR[data[i + c]] * (data[i + 3] / Math.max(1, out[i + 3])) + TO_LINEAR[glow[i + c]] * k);
  }
  return out;
}
