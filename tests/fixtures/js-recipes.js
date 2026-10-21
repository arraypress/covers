/**
 * The original JavaScript recipes, kept as a fixture: the JSON recipes in
 * `recipes/*.json` must render byte-identical SVG to these for the same
 * input (see tests/json-recipes.test.js).
 */

import { mixOklab } from '../../src/color.js';
import { createRng } from '../../src/rng.js';

/**
 * The text content of a string-or-object option.
 *
 * @param {unknown} v
 * @returns {string | undefined}
 */
export function contentOf(v) {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object' && 'content' in v) return /** @type {any} */ (v).content;
  return undefined;
}

/**
 * A title layer with the shared editorial defaults.
 *
 * @param {any} o - Cover options.
 * @param {RecipeContext} c
 * @param {Partial<import('./index.js').TextLayer>} style - Recipe-specific style.
 * @returns {import('./index.js').TextLayer[]} Zero or one layer.
 */
function titleLayer(o, c, style) {
  const content = contentOf(o.title);
  if (!content) return [];
  const label = contentOf(o.label);
  return [{
    id: 'title',
    type: 'text',
    content,
    anchor: 'bottom-left',
    weight: 500,
    size: c.u * 0.066,
    minSize: c.u * 0.048,
    lineHeight: 1.08,
    letterSpacing: -0.025,
    maxLines: 3,
    ...(label ? { label: { content: label, ...(typeof o.label === 'object' ? o.label : {}) } } : {}),
    ...style,
  }];
}

/**
 * `aurora` — a soft mesh of the palette's colours with grain. Add a
 * `title` to set one in the corner.
 *
 * @param {import('./index.js').RecipeOptions} o
 * @param {RecipeContext} c
 * @returns {import('./index.js').Layer[]}
 */
/**
 * The mesh's tone band. Without a title: the reference's clear mid-tones.
 * With one: a band the palette's text clears 4.5:1 on.
 */
const tone = (o, c) => (!contentOf(o.title) ? { l: [0.55, 0.85], c: [0.12, 0.22] }
  : c.palette.mode === 'dark' ? { l: [0.34, 0.5], c: [0.12, 0.22] } : { l: [0.66, 0.82], c: [0.13, 0.2] });

/** The full-bleed field both mesh recipes share; folds and streaks are per seed. */
const meshField = (o, c) => {
  // With a title, no folds or streaks: their light edges would cut its contrast.
  const r = createRng(`${c.seed}:recipe:mesh`);
  const titled = Boolean(contentOf(o.title));
  return { id: 'mesh', type: 'mesh', count: 4, blur: '11vmax', size: [0.45, 0.8], streak: 1.8, tone: tone(o, c), fold: titled ? false : r.pick([false, false, true]), streaks: titled ? 0 : r.pick([0, 0, 0, 6]), hues: r.pick([2, 2, 3]) };
};

/** The title's label, in the title's colour (muted can't read on a mid-tone field). */
const textLabel = (t, c) => t.map((l) => ({ ...l, label: l.label ? { color: c.palette.text, ...l.label } : undefined }));

export function aurora(o, c) {
  const vary = createRng(`${c.seed}:recipe:grain`).pick(['edges', null]);
  return [
    { id: 'bg', type: 'solid' },
    meshField(o, c),
    { id: 'grain', type: 'grain', amount: 0.09, vary },
    ...textLabel(titleLayer(o, c, {}), c),
  ];
}

export function gridTitle(o, c) {
  return [
    { id: 'bg', type: 'solid' },
    meshField(o, c),
    { id: 'grid', type: 'pattern', kind: 'grid', divisions: 4, stroke: '0.3vmin', dash: 'dotted', color: '#ffffff', opacity: 0.6 },
    { id: 'grain', type: 'grain', amount: 0.08 },
    ...textLabel(titleLayer(o, c, {}), c),
  ];
}

export function iconTile(o, c) {
  const p = c.palette;
  const dark = p.mode === 'dark';
  const name = typeof o.icon === 'string' ? o.icon : undefined;
  const hasTitle = Boolean(contentOf(o.title));
  const tint = mixOklab(p.bg, p.accent, dark ? 0.1 : 0.07);
  const jitter = () => c.rng.range(-0.12, 0.12);
  const glowAt = hasTitle ? { x: 0.22 + jitter(), y: 0.26 + jitter() } : { x: 0.5 + jitter(), y: 0.5 + jitter() };
  return [
    { id: 'bg', type: 'solid', color: tint },
    { id: 'glow', type: 'radial', colors: [mixOklab(tint, p.accent, dark ? 0.32 : 0.26), tint], ...glowAt, radius: '52vmax' },
    { id: 'rings', type: 'pattern', kind: 'rings', size: hasTitle ? '6vmin' : '7vmin', center: glowAt, opacity: dark ? 0.14 : 0.16, fade: 'radial', color: dark ? p.text : p.accent },
    {
      id: 'icon',
      type: 'icon',
      ...(name ? { name } : { path: SPARK, viewBox: [0, 0, 24, 24] }),
      size: c.u * (hasTitle ? 0.075 : 0.12),
      anchor: hasTitle ? 'top-left' : 'center',
      tile: { color: dark ? mixOklab(tint, p.text, 0.09) : mixOklab(tint, '#ffffff', 0.85) },
    },
    { id: 'grain', type: 'grain', amount: 0.05 },
    ...titleLayer(o, c, {}),
  ];
}

/**
 * `bigType` — the headline is the cover: large, tight, set in the lower
 * left, shrinking to fit four lines; an optional label in the accent at
 * the top.
 *
 * @param {import('./index.js').RecipeOptions} o
 * @param {RecipeContext} c
 * @returns {import('./index.js').Layer[]}
 */
export function bigType(o, c) {
  const p = c.palette;
  const label = contentOf(o.label);
  const [x, y] = c.rng.pick([[1, 0], [0, 0], [1, 1], [0.5, 0]]);
  return [
    { id: 'bg', type: 'solid' },
    { id: 'wash', type: 'radial', colors: [mixOklab(p.bg, p.accent, p.mode === 'dark' ? 0.16 : 0.12), p.bg], x, y, radius: '110vmax' },
    { id: 'grain', type: 'grain', amount: 0.05 },
    ...(label ? [{ id: 'label', type: /** @type {const} */ ('text'), content: label, anchor: /** @type {const} */ ('top-left'), size: c.u * 0.024, weight: 600, letterSpacing: 0.09, transform: /** @type {const} */ ('uppercase'), color: p.accent, maxLines: 1, balance: false }] : []),
    ...titleLayer({ ...o, label: undefined }, c, {
      size: c.u * 0.13,
      minSize: c.u * 0.078,
      weight: 600,
      lineHeight: 0.98,
      letterSpacing: -0.045,
      maxLines: 4,
    }),
  ];
}

/**
 * `stripes` — a band of tapering stripes down one side, a spot (a disc in
 * the accent, or an icon on it) riding the band's edge, and an optional
 * title on the open side (the claude.com/resources look).
 *
 * @param {import('./index.js').RecipeOptions & { side?: 'left' | 'right' }} o
 * @param {RecipeContext} c
 * @returns {import('./index.js').Layer[]}
 */
export function stripes(o, c) {
  const p = c.palette;
  const side = o.side ?? 'right';
  const band = 0.46;
  const region = side === 'right' ? { x: 1 - band, y: 0, width: band, height: 1 } : { x: 0, y: 0, width: band, height: 1 };
  const edge = side === 'right' ? 1 - band : band;
  const spot = Math.min(c.width, c.height) * 0.34;
  const name = typeof o.icon === 'string' ? o.icon : undefined;
  const hasTitle = Boolean(contentOf(o.title));
  const spotY = (hasTitle ? 0.36 : 0.5) + c.rng.range(-0.06, 0.06);
  // A tonal ramp: the accent at the outer edge, stepping toward the page.
  const steps = c.rng.int(5, 8);
  const taper = c.rng.range(0.72, 0.86);
  const ramp = Array.from({ length: steps }, (_, i) => mixOklab(p.accent, p.bg, (i / steps) * 0.88));
  const weights = Array.from({ length: steps }, (_, i) => taper ** i);
  return [
    { id: 'bg', type: 'solid' },
    {
      id: 'stripes',
      type: 'stripes',
      direction: 'vertical',
      region,
      widths: side === 'right' ? weights.slice().reverse() : weights,
      colors: side === 'right' ? ramp.slice().reverse() : ramp,
    },
    { id: 'spot', type: 'shapes', items: [{ kind: 'circle', x: edge, y: spotY, size: spot, color: p.text }] },
    ...(name ? [{ id: 'icon', type: /** @type {const} */ ('icon'), name, size: spot * 0.4, position: { x: edge, y: spotY }, color: p.bg }] : []),
    { id: 'grain', type: 'grain', amount: 0.06 },
    ...titleLayer(o, c, {
      anchor: side === 'right' ? 'bottom-left' : 'bottom-right',
      maxWidth: c.width * (1 - band) - c.u * 0.12,
      size: c.u * 0.058,
      minSize: c.u * 0.044,
      maxLines: 4,
    }),
  ];
}

/**
 * `duotone` — a photo mapped to two colours of the palette (shadows and
 * highlights), with grain, and a title over a gentle scrim when given.
 *
 * @param {import('./index.js').RecipeOptions} o
 * @param {RecipeContext} c
 * @returns {import('./index.js').Layer[]}
 */
export function duotone(o, c) {
  const src = typeof o.image === 'string' || o.image instanceof Uint8Array ? o.image : o.image?.src;
  if (!src) throw new TypeError('The duotone recipe needs an image (a file path or bytes)');
  const p = c.palette;
  const shadow = p.mode === 'dark' ? p.bg : p.text;
  const title = titleLayer(o, c, { color: '#ffffff' });
  return [
    { id: 'image', type: 'image', src, duotone: true },
    ...(title.length ? [{ id: 'scrim', type: /** @type {const} */ ('linear'), angle: 180, colors: [shadow, shadow], opacities: [0, 0.62] }] : []),
    { id: 'grain', type: 'grain', amount: 0.07 },
    ...title.map((t) => ({ ...t, label: t.label ? { color: '#e9e9e9', ...t.label } : undefined })),
  ];
}

/** A four-point spark, the default glyph when `iconTile` gets no icon. */
const SPARK = 'M12 2c.4 4.9 2.1 7.6 7 8.6l3 .4-3 .4c-4.9 1-6.6 3.7-7 8.6-.4-4.9-2.1-7.6-7-8.6L2 11l3-.4c4.9-1 6.6-3.7 7-8.6Z';

export const jsRecipes = { aurora, gridTitle, iconTile, bigType, stripes, duotone };
