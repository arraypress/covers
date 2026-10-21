/**
 * Colour parsing and the few colour-space moves palettes need.
 *
 * Everything inside the library is a lowercase `#rrggbb` string. Input can
 * be hex (3, 4, 6 or 8 digits), `rgb()`/`rgba()` or `hsl()`/`hsla()`; alpha
 * is dropped, since a cover's layers carry their own `opacity`.
 *
 * Mixing and contrast come from `@arraypress/color-utils`; this module adds
 * OKLCH, so derived palettes can rotate hue and set lightness perceptually
 * instead of in sRGB (where "the same lightness" means very different
 * things for yellow and blue).
 *
 * @module color
 */

import { hexToRgb, rgbToHex, contrastRatio } from '@arraypress/color-utils';

/**
 * Parse a CSS colour to `#rrggbb`.
 *
 * @param {string} input - `#abc`, `#aabbcc`, `#aabbccdd`, `rgb(…)`, `rgba(…)`, `hsl(…)` or `hsla(…)`.
 * @returns {string} Lowercase `#rrggbb`.
 * @throws {TypeError} When the string isn't a colour this function understands.
 *
 * @example
 * toHex('rgb(37 99 235)');   // '#2563eb'
 * toHex('#FA0');             // '#ffaa00'
 * toHex('hsl(220 80% 50%)'); // '#1a5ee6'
 */
export function toHex(input) {
  if (typeof input !== 'string') throw new TypeError(`Expected a colour string, got ${typeof input}`);
  const s = input.trim().toLowerCase();

  const hex = s.match(/^#?([0-9a-f]{3,8})$/);
  if (hex && [3, 4, 6, 8].includes(hex[1].length)) {
    let h = hex[1];
    if (h.length <= 4) h = h.split('').map((c) => c + c).join('');
    return '#' + h.slice(0, 6);
  }

  const fn = s.match(/^(rgba?|hsla?)\(([^)]*)\)$/);
  if (fn) {
    const parts = fn[2].split(/[\s,/]+/).filter(Boolean);
    if (parts.length >= 3) {
      if (fn[1].startsWith('rgb')) {
        const [r, g, b] = parts.slice(0, 3).map((p) => (p.endsWith('%') ? parseFloat(p) * 2.55 : parseFloat(p)));
        if ([r, g, b].every(Number.isFinite)) return rgbToHex(r, g, b);
      } else {
        const h = parseFloat(parts[0]);
        const sat = parseFloat(parts[1]) / 100;
        const l = parseFloat(parts[2]) / 100;
        if ([h, sat, l].every(Number.isFinite)) return hslToHex(h, sat, l);
      }
    }
  }
  throw new TypeError(`Unrecognised colour: "${input}"`);
}

/**
 * HSL to `#rrggbb`.
 *
 * @param {number} h - Hue in degrees.
 * @param {number} s - Saturation, 0–1.
 * @param {number} l - Lightness, 0–1.
 * @returns {string} `#rrggbb`.
 */
function hslToHex(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/** @param {number} c - sRGB channel 0–1. @returns {number} Linear channel. */
const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
/** @param {number} c - Linear channel. @returns {number} sRGB channel 0–1. */
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/**
 * `#rrggbb` to OKLCH.
 *
 * @param {string} color - Any colour {@link toHex} accepts.
 * @returns {{ l: number, c: number, h: number }} Lightness 0–1, chroma (~0–0.37), hue in degrees.
 *
 * @example
 * toOklch('#2563eb'); // { l: 0.546, c: 0.215, h: 262.9 }
 */
export function toOklch(color) {
  const { r, g, b } = hexToRgb(toHex(color));
  const [lr, lg, lb] = [r, g, b].map((v) => toLinear(v / 255));
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

/**
 * OKLCH to `#rrggbb`. Out-of-gamut colours are brought in by reducing
 * chroma (keeping lightness and hue), not by clipping channels, so a
 * derived colour keeps the hue it was asked for.
 *
 * @param {{ l: number, c: number, h: number }} lch - Lightness 0–1, chroma, hue in degrees.
 * @returns {string} `#rrggbb`.
 *
 * @example
 * fromOklch({ l: 0.7, c: 0.12, h: 30 }); // a soft coral
 */
export function fromOklch({ l, c, h }) {
  const L = Math.max(0, Math.min(1, l));
  let chroma = Math.max(0, c);
  for (let i = 0; i < 24; i++) {
    const rgb = oklabToRgb(L, chroma * Math.cos((h * Math.PI) / 180), chroma * Math.sin((h * Math.PI) / 180));
    if (rgb.every((v) => v >= -0.0005 && v <= 1.0005) || chroma < 0.001) {
      return toRgbHex(rgb);
    }
    chroma *= 0.9;
  }
  return toRgbHex(oklabToRgb(L, 0, 0));
}

/**
 * Clamp 0–1 sRGB channels and write them as `#rrggbb`.
 *
 * @param {[number, number, number]} rgb
 * @returns {string}
 */
function toRgbHex([r, g, b]) {
  const c = (/** @type {number} */ v) => Math.max(0, Math.min(1, v)) * 255;
  return rgbToHex(c(r), c(g), c(b));
}

/**
 * OKLab to gamma-encoded sRGB channels (0–1, possibly out of range).
 *
 * @param {number} L @param {number} A @param {number} B
 * @returns {[number, number, number]} sRGB channels.
 */
function oklabToRgb(L, A, B) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/**
 * Mix two colours in OKLab (perceptually even, no muddy midpoints).
 *
 * @param {string} a - First colour.
 * @param {string} b - Second colour.
 * @param {number} t - 0 gives `a`, 1 gives `b`.
 * @returns {string} `#rrggbb`.
 *
 * @example
 * mixOklab('#ffffff', '#2563eb', 0.1); // a pale blue tint
 */
export function mixOklab(a, b, t) {
  const p = toLab(a);
  const q = toLab(b);
  const rgb = oklabToRgb(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t);
  return toRgbHex(rgb);
}

/** @param {string} color @returns {[number, number, number]} OKLab. */
function toLab(color) {
  const { l, c, h } = toOklch(color);
  return [l, c * Math.cos((h * Math.PI) / 180), c * Math.sin((h * Math.PI) / 180)];
}

/**
 * Mix two colours in OKLCH: lightness and chroma linearly, hue the short
 * way round. Unlike OKLab, a mix of two far-apart hues stays vivid instead
 * of passing through grey (orange → blue goes by way of pink, not mud).
 *
 * @param {string} a - First colour.
 * @param {string} b - Second colour.
 * @param {number} t - 0 gives `a`, 1 gives `b`.
 * @returns {string} `#rrggbb`.
 *
 * @example
 * mixOklch('#c9502a', '#a9bdf2', 0.5); // a clear rose, not a muddy mauve
 */
export function mixOklch(a, b, t) {
  const p = toOklch(a);
  const q = toOklch(b);
  // A near-grey has no meaningful hue: take the other colour's.
  const ph = p.c < 0.02 ? q.h : p.h;
  const qh = q.c < 0.02 ? p.h : q.h;
  const dh = ((qh - ph + 540) % 360) - 180;
  return fromOklch({ l: p.l + (q.l - p.l) * t, c: p.c + (q.c - p.c) * t, h: (ph + dh * t + 360) % 360 });
}

/** Near-black used wherever white doesn't read. */
export const NEAR_BLACK = '#111111';

/**
 * A colour for a mark on one or more backgrounds: `prefer` when it clears
 * `ratio` against every one of them, else whichever of white and
 * near-black has the better worst case.
 *
 * For icons and other non-text marks WCAG 1.4.11 asks 3:1 (text needs
 * 4.5:1), so `onBackground(bg, 3, 'white')` keeps white on mid-tone fills
 * where a text rule would flip to black.
 *
 * @param {string | string[]} backgrounds - The colour(s) under the mark.
 * @param {number} [ratio=3] - Contrast to clear.
 * @param {'white' | 'black' | string} [prefer='white'] - The colour to use when it clears `ratio`.
 * @returns {string} `#rrggbb`.
 *
 * @example
 * onBackground('#e0533d', 3, 'white'); // '#ffffff' (3.6:1)
 * onBackground('#ffe14d', 3, 'white'); // '#111111'
 */
export function onBackground(backgrounds, ratio = 3, prefer = 'white') {
  const bgs = [].concat(/** @type {any} */ (backgrounds)).map(toHex);
  const want = prefer === 'white' ? '#ffffff' : prefer === 'black' ? NEAR_BLACK : toHex(prefer);
  const worst = (/** @type {string} */ c) => Math.min(...bgs.map((b) => contrastRatio(c, b)));
  if (worst(want) >= ratio) return want;
  return worst('#ffffff') >= worst(NEAR_BLACK) ? '#ffffff' : NEAR_BLACK;
}

/**
 * The colour of an eased multi-stop gradient at `t` (0–1), the way the
 * `linear` and `radial` layers draw it (smoothstep between stops, in OKLab).
 *
 * @param {string[]} colors - Two or more stops, evenly spaced.
 * @param {number} t - Position along the gradient.
 * @param {boolean} [ease=true] - Ease between stops.
 * @returns {string} `#rrggbb`.
 */
export function gradientAt(colors, t, ease = true) {
  const list = colors.map(toHex);
  if (list.length === 1) return list[0];
  const n = list.length - 1;
  const x = Math.max(0, Math.min(1, t)) * n;
  const i = Math.min(n - 1, Math.floor(x));
  const f = x - i;
  return mixOklab(list[i], list[i + 1], ease ? f * f * (3 - 2 * f) : f);
}
