/**
 * Palettes: the colours a cover draws with.
 *
 * Every layer reads its default colours from one resolved palette:
 *
 * - `bg`      the page colour under everything
 * - `colors`  the colours of gradients, blobs, stripes and shapes
 * - `text`    type (readable on `bg`)
 * - `accent`  the one strong colour (icons, labels, spots)
 * - `muted`   secondary type (`text` mixed toward `bg`)
 * - `surface` raised things that sit on `bg` (icon tiles, pills)
 * - `mode`    `'light'` or `'dark'`, from `bg`
 *
 * A palette can be written as a preset name, an array (`[bg, ...colors]`),
 * a partial object, or derived from a theme's tokens with
 * {@link derivePalette}.
 *
 * @module palette
 */

import { relativeLuminance, contrastRatio, readableOn } from '@arraypress/color-utils';
import { toHex, toOklch, fromOklch, mixOklab } from './color.js';

/**
 * Curated presets. Each is a full palette; the light ones pair with the
 * dark ones of the same family (`paper`/`ink`, `dawn`/`dusk`, …).
 *
 * @type {Readonly<Record<string, Readonly<import('./index.js').PaletteInput>>>}
 */
export const palettes = Object.freeze({
  paper: { bg: '#f3efe7', colors: ['#f0a98a', '#a9bdf2', '#f3d27e', '#b7dcc4'], text: '#1c1a17', accent: '#c9502a' },
  ink: { bg: '#0c0d12', colors: ['#3d5afe', '#ff6b3d', '#9b4dff', '#12b5a0'], text: '#f4f4f6', accent: '#8ea0ff' },
  dawn: { bg: '#fbf1ee', colors: ['#ff9f87', '#ffc7d9', '#c9b6ff', '#ffd9a8'], text: '#2a1714', accent: '#e0533d' },
  dusk: { bg: '#100b1c', colors: ['#6a3df0', '#ff7a59', '#d1408f', '#2b3fd6'], text: '#f7f3ff', accent: '#ff9c7e' },
  ocean: { bg: '#eef4f7', colors: ['#7fb8f0', '#8de0cf', '#b9c9ff', '#d7f0ff'], text: '#0f1d29', accent: '#1f6fd1' },
  ember: { bg: '#140c08', colors: ['#ff5a1f', '#ffb020', '#d6264f', '#7a2b10'], text: '#fff4ea', accent: '#ffb35c' },
  moss: { bg: '#f1f3ea', colors: ['#a8cf8e', '#e6d48a', '#7fbfa8', '#cfe3b5'], text: '#18200f', accent: '#3f7d2c' },
  carbon: { bg: '#0a0a0b', colors: ['#3a3a40', '#5b5b66', '#26262b', '#8a8a96'], text: '#fafafa', accent: '#e4e4e7' },
  mono: { bg: '#f4f4f5', colors: ['#d4d4d8', '#e4e4e7', '#a1a1aa', '#fafafa'], text: '#18181b', accent: '#18181b' },
});

/**
 * Derive a full palette from a theme's tokens (or just an accent).
 *
 * Gradient colours are built in OKLCH around the accent's hue: one near the
 * accent, two neighbours (±40°) and a quiet complement, set pastel on light
 * backgrounds and deep on dark ones. Missing `bg` is a faint tint of the
 * accent (light) or a near-black of its hue (dark); missing `text` is a
 * near-black or near-white of the same hue that clears 7:1 on `bg`.
 *
 * @param {object} tokens
 * @param {string} tokens.accent - The theme's accent (hex, `rgb()` or `hsl()`).
 * @param {string} [tokens.bg] - The theme's background.
 * @param {string} [tokens.text] - The theme's text colour.
 * @param {string[]} [tokens.colors] - Gradient colours to use as-is instead of deriving them.
 * @param {'light' | 'dark'} [tokens.mode] - Force a mode (default: from `bg`, else light).
 * @returns {import('./index.js').Palette} A resolved palette.
 *
 * @example
 * derivePalette({ accent: '#2563eb', bg: '#fdfdfd', text: '#1d1d1f' });
 * derivePalette({ accent: 'rgb(209 254 23)', mode: 'dark' });
 */
export function derivePalette({ accent, bg, text, colors, mode } = /** @type {any} */ ({})) {
  if (!accent) throw new TypeError('derivePalette() needs an accent');
  const acc = toHex(accent);
  const a = toOklch(acc);
  const resolvedMode = mode ?? (bg ? modeOf(toHex(bg)) : 'light');
  const dark = resolvedMode === 'dark';
  const hue = a.c < 0.02 ? 260 : a.h; // a grey accent has no meaningful hue
  const chroma = Math.min(1, a.c / 0.12); // greys stay grey

  const base = bg ? toHex(bg) : fromOklch(dark ? { l: 0.16, c: 0.018 * chroma, h: hue } : { l: 0.975, c: 0.014 * chroma, h: hue });

  const derived = dark
    ? [
        { l: 0.6, c: 0.17, h: hue },
        { l: 0.48, c: 0.15, h: hue + 40 },
        { l: 0.64, c: 0.13, h: hue - 40 },
        { l: 0.36, c: 0.09, h: hue + 180 },
      ]
    : [
        { l: 0.8, c: 0.12, h: hue },
        { l: 0.87, c: 0.08, h: hue + 40 },
        { l: 0.83, c: 0.1, h: hue - 40 },
        { l: 0.92, c: 0.045, h: hue + 180 },
      ];

  return finish({
    bg: base,
    colors: colors?.length ? colors.map(toHex) : derived.map((c) => fromOklch({ ...c, c: c.c * chroma })),
    text: text ? toHex(text) : undefined,
    accent: acc,
  });
}

/**
 * Resolve any palette input to a full {@link import('./index.js').Palette}.
 *
 * - `undefined` → the `paper` preset
 * - a preset name (`'dusk'`) → that preset
 * - a single colour (`'#2563eb'`) → {@link derivePalette} from it
 * - an array → `[bg, ...colors]` (a one-item array is an accent)
 * - an object → missing fields filled in (only `accent` → derived)
 *
 * @param {import('./index.js').PaletteInput} [input] - The palette.
 * @returns {import('./index.js').Palette} The resolved palette.
 * @throws {TypeError} On an unknown preset name or an unparseable colour.
 *
 * @example
 * resolvePalette('dusk').mode;                    // 'dark'
 * resolvePalette(['#0b0b0f', '#ff6a3d', '#3d5afe']).text; // a near-white
 */
export function resolvePalette(input) {
  if (input == null) return resolvePalette(palettes.paper);
  if (typeof input === 'string') {
    if (Object.hasOwn(palettes, input)) return resolvePalette(palettes[input]);
    try {
      return derivePalette({ accent: input });
    } catch {
      throw new TypeError(`Unknown palette "${input}". Presets: ${Object.keys(palettes).join(', ')}`);
    }
  }
  if (Array.isArray(input)) {
    if (input.length === 0) return resolvePalette(undefined);
    if (input.length === 1) return derivePalette({ accent: input[0] });
    const [bg, ...colors] = input.map(toHex);
    return finish({ bg, colors, accent: colors[0] });
  }
  if (typeof input === 'object') {
    if (!input.bg && !input.colors && input.accent) return derivePalette(/** @type {any} */ (input));
    if (!input.colors?.length && input.accent) return derivePalette(/** @type {any} */ (input));
    const bg = toHex(input.bg ?? '#ffffff');
    const colors = (input.colors?.length ? input.colors : [input.accent ?? (modeOf(bg) === 'dark' ? '#ffffff' : '#000000')]).map(toHex);
    return finish({
      bg,
      colors,
      text: input.text ? toHex(input.text) : undefined,
      accent: input.accent ? toHex(input.accent) : colors[0],
      muted: input.muted ? toHex(input.muted) : undefined,
      surface: input.surface ? toHex(input.surface) : undefined,
    });
  }
  throw new TypeError('A palette is a preset name, a colour, an array of colours or an object');
}

/**
 * `'light'` or `'dark'` for a background.
 *
 * @param {string} bg - `#rrggbb`.
 * @returns {'light' | 'dark'} The mode.
 */
export function modeOf(bg) {
  // 0.18 is where black and white text have equal contrast on a surface.
  return relativeLuminance(bg) > 0.18 ? 'light' : 'dark';
}

/**
 * Fill the derived fields of a partial palette.
 *
 * @param {{ bg: string, colors: string[], accent: string, text?: string, muted?: string, surface?: string }} p
 * @returns {import('./index.js').Palette} The palette.
 */
function finish(p) {
  const mode = modeOf(p.bg);
  const dark = mode === 'dark';
  const { h, c } = toOklch(p.accent);
  const tint = Math.min(0.02, c * 0.15);
  let text = p.text;
  if (!text) {
    text = fromOklch(dark ? { l: 0.97, c: tint * 0.5, h } : { l: 0.2, c: tint, h });
    if (contrastRatio(text, p.bg) < 7) text = readableOn(text, [p.bg], { toward: dark ? '#ffffff' : '#000000', ratio: 7 });
  }
  return Object.freeze({
    mode,
    bg: p.bg,
    colors: Object.freeze(p.colors.slice()),
    text,
    accent: p.accent,
    muted: p.muted ?? mixOklab(text, p.bg, 0.38),
    surface: p.surface ?? (dark ? mixOklab(p.bg, text, 0.07) : mixOklab(p.bg, '#ffffff', 0.75)),
  });
}
