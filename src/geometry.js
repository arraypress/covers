/**
 * Canvas size and anchoring. Lengths (`'6vmin'`, `'4vw'`…) resolve with
 * image-effects' `len`, so layers and effects read them the same way.
 *
 * @module geometry
 */

import { len } from '@arraypress/image-effects/length';

/** Named aspect ratios, as `width / height`. */
export const ASPECTS = Object.freeze({
  '1:1': 1,
  '16:9': 16 / 9,
  '4:5': 4 / 5,
  '3:2': 3 / 2,
  '4:3': 4 / 3,
  '2:1': 2,
  '9:16': 9 / 16,
  og: 1200 / 630,
});

/**
 * Work out a cover's pixel size from `width`, `height` and `aspect`.
 *
 * - both `width` and `height` → used as given
 * - one side + `aspect` → the other side follows
 * - `aspect` only → 1200 wide (`'og'` is exactly 1200×630)
 * - nothing → 1200×1200
 *
 * @param {{ width?: number, height?: number, aspect?: string | number }} opts
 * @returns {{ width: number, height: number }} Integer pixel size.
 * @throws {RangeError} On a non-positive size or an unreadable aspect.
 *
 * @example
 * resolveSize({ aspect: '16:9' });            // { width: 1200, height: 675 }
 * resolveSize({ height: 800, aspect: '3:2' }); // { width: 1200, height: 800 }
 */
export function resolveSize({ width, height, aspect } = {}) {
  if (width && height) return checkSize(width, height);
  const ratio = aspectRatio(aspect ?? (width || height ? undefined : '1:1'));
  if (ratio == null) return checkSize(width ?? height ?? 1200, height ?? width ?? 1200);
  if (height && !width) return checkSize(height * ratio, height);
  return checkSize(width ?? 1200, (width ?? 1200) / ratio);
}

/**
 * Parse an aspect: a named one, `'a:b'`, `'a/b'` or a number.
 *
 * @param {string | number | undefined} aspect
 * @returns {number | undefined} `width / height`, or undefined when none was given.
 * @throws {RangeError} On a string that isn't an aspect.
 */
export function aspectRatio(aspect) {
  if (aspect == null) return undefined;
  if (typeof aspect === 'number') {
    if (aspect > 0) return aspect;
    throw new RangeError(`Invalid aspect ${aspect}`);
  }
  if (Object.hasOwn(ASPECTS, aspect)) return ASPECTS[aspect];
  const m = String(aspect).match(/^\s*(\d+(?:\.\d+)?)\s*[:/x]\s*(\d+(?:\.\d+)?)\s*$/);
  if (m && +m[1] > 0 && +m[2] > 0) return +m[1] / +m[2];
  throw new RangeError(`Invalid aspect "${aspect}". Use one of ${Object.keys(ASPECTS).join(', ')} or "w:h".`);
}

/**
 * @param {number} w @param {number} h
 * @returns {{ width: number, height: number }}
 */
function checkSize(w, h) {
  const width = Math.round(w);
  const height = Math.round(h);
  if (!(width > 0 && height > 0) || width > 8192 || height > 8192) {
    throw new RangeError(`Cover size must be 1–8192px per side, got ${width}×${height}`);
  }
  return { width, height };
}

/** The nine anchors, as fractions of the free space along x and y. */
export const ANCHORS = Object.freeze({
  'top-left': [0, 0], top: [0.5, 0], 'top-right': [1, 0],
  left: [0, 0.5], center: [0.5, 0.5], right: [1, 0.5],
  'bottom-left': [0, 1], bottom: [0.5, 1], 'bottom-right': [1, 1],
});

/**
 * Place a box on the canvas.
 *
 * With `position` (fractions 0–1 of the canvas, the box's anchor point
 * goes there), the margin is ignored. Otherwise the box sits at `anchor`
 * inside the safe area (`margin` in from every edge). `offset` nudges it
 * either way.
 *
 * @param {object} o
 * @param {number} o.width - Box width.
 * @param {number} o.height - Box height.
 * @param {{ width: number, height: number }} o.canvas - The canvas.
 * @param {import('./index.js').Anchor} [o.anchor='center'] - Where it sits.
 * @param {number} [o.margin=0] - Safe margin in px.
 * @param {{ x?: number, y?: number }} [o.position] - Explicit placement (fractions).
 * @param {{ x?: number | string, y?: number | string }} [o.offset] - Extra shift (lengths).
 * @returns {{ x: number, y: number }} The box's top-left corner.
 * @throws {TypeError} On an unknown anchor.
 */
export function place({ width, height, canvas, anchor = 'center', margin = 0, position, offset }) {
  const a = ANCHORS[anchor];
  if (!a) throw new TypeError(`Unknown anchor "${anchor}". Use ${Object.keys(ANCHORS).join(', ')}.`);
  let x;
  let y;
  if (position && (position.x != null || position.y != null)) {
    x = (position.x ?? 0.5) * canvas.width - a[0] * width;
    y = (position.y ?? 0.5) * canvas.height - a[1] * height;
  } else {
    x = margin + a[0] * (canvas.width - 2 * margin - width);
    y = margin + a[1] * (canvas.height - 2 * margin - height);
  }
  return { x: x + len(offset?.x, canvas, 0), y: y + len(offset?.y, canvas, 0) };
}

/**
 * The anchor's horizontal alignment (`'left'`, `'center'`, `'right'`).
 *
 * @param {import('./index.js').Anchor} anchor
 * @returns {'left' | 'center' | 'right'} Alignment.
 */
export function anchorAlign(anchor = 'center') {
  const fx = ANCHORS[anchor]?.[0] ?? 0.5;
  return fx === 0 ? 'left' : fx === 1 ? 'right' : 'center';
}

/**
 * The shared "design unit" for a canvas: the geometric mean of its sides.
 * Type and margins scale with it, so a 1200×630 card and a 1200×1200
 * square get proportionate (not identical) headlines.
 *
 * @param {{ width: number, height: number }} canvas
 * @returns {number} Pixels.
 */
export function unit(canvas) {
  return Math.sqrt(canvas.width * canvas.height);
}

/**
 * Resolve a region (fractions of the canvas) to pixels.
 *
 * @param {{ x?: number, y?: number, width?: number, height?: number } | undefined} region
 * @param {{ width: number, height: number }} canvas
 * @returns {{ x: number, y: number, width: number, height: number }} Pixels.
 */
export function regionPx(region, canvas) {
  const r = region ?? {};
  return {
    x: (r.x ?? 0) * canvas.width,
    y: (r.y ?? 0) * canvas.height,
    width: (r.width ?? 1 - (r.x ?? 0)) * canvas.width,
    height: (r.height ?? 1 - (r.y ?? 0)) * canvas.height,
  };
}
