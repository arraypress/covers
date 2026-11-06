/**
 * Placing a photo on a point of it: a focus `[x, y]` (0–1 in the photo),
 * or `'subject'`, a cut-out's head, found from its transparency. Used by
 * the `image` layer when sharp is there to draw the pixels.
 *
 * @module layers/focal
 */

/** The share of a cut-out's opaque height, from its top, taken as its head. */
const HEAD = 0.45;
/** Rows and columns the transparency is read at. */
const PROBE = 160;

/**
 * Where a cut-out's head is: the alpha-weighted centre of the top 45% of
 * its opaque rows, as `[x, y]` fractions of the photo. Null for a photo
 * with no transparency to read (an ordinary photo: no subject to find).
 *
 * @param {any} sharp - The sharp module.
 * @param {Uint8Array} bytes
 * @returns {Promise<[number, number] | null>}
 *
 * @example
 * await subjectFocus(sharp, cutoutPng); // [0.56, 0.21]
 */
export async function subjectFocus(sharp, bytes) {
  const meta = await sharp(bytes).metadata();
  if (!meta.hasAlpha) return null;
  const { data, info } = await sharp(bytes).rotate().ensureAlpha().resize(PROBE, PROBE, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: c } = info;
  const alpha = (/** @type {number} */ x, /** @type {number} */ y) => data[(y * w + x) * c + 3] / 255;
  // The opaque rows: those with a few solid pixels.
  const rows = [];
  for (let y = 0; y < h; y++) {
    let s = 0;
    for (let x = 0; x < w; x++) s += alpha(x, y);
    if (s >= 2) rows.push(y);
  }
  let clear = false;
  for (let i = 3; i < data.length && !clear; i += c) clear = data[i] < 250;
  if (!rows.length || !clear) return null;
  const top = rows[0];
  const bottom = rows[rows.length - 1];
  const end = top + Math.max(1, Math.round((bottom - top + 1) * HEAD));
  let sum = 0, sx = 0, sy = 0;
  for (let y = top; y < end; y++) {
    for (let x = 0; x < w; x++) {
      const a = alpha(x, y);
      sum += a; sx += a * (x + 0.5); sy += a * (y + 0.5);
    }
  }
  return sum ? [sx / sum / w, sy / sum / h] : null;
}

/**
 * Where a photo of `sw` × `sh` is drawn in a box so a point of it is
 * centred: scaled to `fit` (cover or contain), then moved so the point
 * sits on the box's centre. `cover` keeps the box filled (the move is
 * held to the photo's overflow), except sideways for a cut-out
 * (`free`), whose transparent sides show the ground; `contain` keeps it
 * inside the box.
 *
 * @param {{ width: number, height: number }} box - Its size (any units).
 * @param {number} sw @param {number} sh - The photo's size.
 * @param {'cover' | 'contain'} fit
 * @param {[number, number]} point - 0–1 in the photo.
 * @param {boolean} [free=false] - Move freely sideways (a cut-out).
 * @returns {{ x: number, y: number, width: number, height: number }} The photo's drawn box, relative to the box.
 *
 * @example
 * focalBox({ width: 400, height: 500 }, 1000, 1000, 'cover', [0.3, 0]); // { x: 0, y: 0, width: 500, height: 500 }: held at the left edge
 * focalBox({ width: 400, height: 500 }, 1000, 1000, 'cover', [0.3, 0], true); // { x: 50, … }: a cut-out, centred on 0.3
 */
export function focalBox(box, sw, sh, fit, [fx, fy], free = false) {
  const k = fit === 'contain' ? Math.min(box.width / sw, box.height / sh) : Math.max(box.width / sw, box.height / sh);
  const width = sw * k;
  const height = sh * k;
  let x = box.width / 2 - fx * width;
  let y = box.height / 2 - fy * height;
  /** Held between a and b (in either order). */
  const hold = (/** @type {number} */ v, /** @type {number} */ a, /** @type {number} */ b) => Math.min(Math.max(a, b), Math.max(Math.min(a, b), v));
  if (!free || fit === 'contain') x = hold(x, 0, box.width - width);
  y = hold(y, 0, box.height - height);
  return { x, y, width, height };
}

/**
 * Draw a photo into a `W` × `H` raster at a drawn box (raster pixels), the
 * rest transparent: resized, the visible part cut out and laid on a clear
 * canvas. Returns a sharp pipeline of the result.
 *
 * @param {any} sharp
 * @param {Uint8Array} bytes
 * @param {number} W @param {number} H
 * @param {{ x: number, y: number, width: number, height: number }} at - Raster pixels.
 * @returns {Promise<any>}
 */
export async function drawAt(sharp, bytes, W, H, at) {
  const rw = Math.max(1, Math.round(at.width));
  const rh = Math.max(1, Math.round(at.height));
  const ox = Math.round(at.x);
  const oy = Math.round(at.y);
  const left = Math.max(0, -ox), top = Math.max(0, -oy);
  const width = Math.min(rw, W - ox) - left, height = Math.min(rh, H - oy) - top;
  const canvas = sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } });
  if (width <= 0 || height <= 0) return sharp(await canvas.png().toBuffer());
  const part = await sharp(bytes).rotate().ensureAlpha().resize(rw, rh, { fit: 'fill' }).extract({ left, top, width, height }).png().toBuffer();
  return sharp(await canvas.composite([{ input: part, left: Math.max(0, ox), top: Math.max(0, oy) }]).png().toBuffer());
}
