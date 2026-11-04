/**
 * Effects: what any layer takes as `effects: [{ kind, … }]`, applied in
 * order (innermost first) in the layer's own coordinates. Three sorts:
 *
 * - **Filters**: one SVG `<filter>` each, over the canvas padded so blurs
 *   and glows don't clip (colour, light, detail, grain…).
 * - **Pixels**: what filters can't do (spin and zoom blur, bokeh,
 *   distortions, pixel sorting, ASCII…), drawn once at the layer's
 *   resolution, processed on a typed array and embedded (`pixels.js`).
 * - **Copies**: the layer's own markup drawn again (`extrude`, `mirror`),
 *   so vectors stay vectors.
 *
 * Any of them takes a `mask` (`mask.js`): a gradient or layers saying
 * where, and how much, it applies.
 *
 * @module effects
 */

import { num } from '../svg.js';
import { len } from '../geometry.js';
import { filterElement } from './util.js';
import { blur, shadow, border } from './light.js';
import { rough, wear, xerox, grit } from './ink.js';
import { duotone, levels, saturate, matrix, threshold, photocopy } from './tone.js';
import { halftone } from './halftone.js';
import { dither, ditherRaster } from './dither.js';
import { expandDropShadows } from './drop-shadow.js';
import { extrude } from './extrude.js';
import { roundBorder } from './round-border.js';
import { separableMorphology, bounded, filterReach } from './region.js';
import { curves, gradientMap, posterize, invert, hue, colorBalance, channelMixer, sepia, vibrance } from './grade.js';
import { look } from './looks.js';
import { bloom, halation } from './glow.js';
import { vignette, lightLeak, lensFlare } from './optics.js';
import { grain, paper, dust } from './film.js';
import { scanlines, crt, vhs, jpeg } from './screen.js';
import { sketch, edges, emboss, sharpen } from './detail.js';
import { chromatic, chromaticRadial, glitch, pixelate } from './digital.js';
import { spin, zoom, rays } from './polar.js';
import { lens, tilt } from './lens.js';
import { motion as motionPixels } from './motion.js';
import { wave, ripple, twirl, bulge, fisheye, kaleidoscope, glass, displace } from './distort.js';
import { sort, stretch } from './sort.js';
import { newsprint } from './newsprint.js';
import { ascii } from './ascii.js';
import { mirror } from './symmetry.js';
import { pixelEffect } from './pixels.js';
import { gradientImage, lerpPrimitives, maskOverlay, RESOLVED } from './mask.js';
import { EFFECT_OPTIONS } from './options.js';

export { transformAttr } from './transform.js';
export { paint } from './paint.js';
export { expandDropShadows } from './drop-shadow.js';
export { EFFECT_OPTIONS, EFFECT_COMMON } from './options.js';
export { checkMask, RESOLVED, maskImage } from './mask.js';

/** Scripts, event-handler attributes (a name starting `on`) and `javascript:` URLs. */
const UNSAFE = /<script|(?:^|[\s"'/])on[a-z]+\s*=|javascript:/i;

/**
 * `filter`: raw primitives, the escape hatch. `{{seed}}` is a seeded
 * number, `{{id}}` the layer's id prefix. `feDropShadow` is spelled out
 * as primitives, so its `in` is honoured everywhere (librsvg ignores it).
 *
 * @param {{ markup?: string }} fx
 * @param {import('../layers.js').RenderContext} ctx
 * @returns {string}
 */
function raw(fx, ctx) {
  const markup = String(fx.markup ?? '');
  if (UNSAFE.test(markup)) throw new TypeError('Filter markup may not contain scripts or event handlers');
  return expandDropShadows(markup.replace(/\{\{seed\}\}/g, () => String(ctx.rng.int(1, 9999))).replace(/\{\{id\}\}/g, ctx.id));
}

/** Effects drawn as one filter (every kind but `motion`), by name. @type {Record<string, (fx: any, ctx: import('../layers.js').RenderContext) => string>} */
const KINDS = {
  blur, shadow, glow: shadow, border, wear, rough, warp: rough, xerox, photocopy, duotone, grayscale: levels, levels, saturate, matrix, grit, halftone, dither, threshold, filter: raw,
  curves, gradientMap, posterize, invert, hue, colorBalance, channelMixer, sepia, look,
  bloom, halation, vignette, lightLeak, lensFlare,
  grain, paper, scanlines,
  sketch, edges, emboss, sharpen,
  chromatic, rgbSplit: chromatic,
};

/** Effects computed on pixels, by name. @type {Record<string, (img: import('./buffer.js').Pixels, fx: any, ctx: any) => any>} */
const PIXEL = {
  zoom, spin, rays, lens, tilt, motion: motionPixels,
  wave, ripple, twirl, bulge, pinch: bulge, fisheye, kaleidoscope, glass, displace,
  sort, stretch, vibrance, dust, crt, vhs, jpeg, newsprint,
  chromatic: chromaticRadial, glitch, pixelate, mosaic: pixelate, ascii,
};

/** Effects drawn as copies of the layer's markup. @type {Record<string, (fx: any, m: { defs: string, body: string }, ctx: any, id: string) => { defs: string, body: string }>} */
const COPIES = { extrude, mirror };

/**
 * What a pixel effect falls back to where nothing can draw pixels (a
 * Worker): a filter close to it (`tilt`: a Gaussian through its band), or
 * nothing (the layer is drawn without it).
 *
 * @type {Record<string, (fx: any, ctx: any) => string>}
 */
const FALLBACK = {
  lens: (fx, ctx) => blur({ kind: 'blur', radius: len(fx.radius, ctx.canvas, '1.2vmin') * 0.5 }, ctx),
  // A Gaussian through the band (an effect's own mask is mixed on top).
  tilt: (fx, ctx) => blur({ kind: 'blur', radius: len(fx.radius, ctx.canvas, '1.4vmin') * 0.7 }, ctx)
    + (fx.mask ? '' : lerpPrimitives(gradientImage({ gradient: 'band', center: fx.center, angle: fx.angle, from: fx.width ?? '8vmin', to: len(fx.width ?? '8vmin', ctx.canvas) + len(fx.falloff ?? '22vmin', ctx.canvas) }, ctx, 0.25))),
};

/** Every effect kind, for validation and docs. */
export const EFFECTS = Object.freeze(Object.keys(EFFECT_OPTIONS));

/** Effects computed outside SVG filters (on pixels, or as copies of the markup), always. */
export const RASTER_EFFECTS = Object.freeze(['dither', 'extrude', ...Object.keys(COPIES).filter((k) => k !== 'extrude'), ...Object.keys(PIXEL).filter((k) => k !== 'chromatic' && k !== 'motion')]);

/** @param {any} fx @returns {any} An effect given as a string, as an object. */
const asEffect = (fx) => (typeof fx === 'string' ? { kind: fx } : fx);

/**
 * Whether an effect is computed on pixels: the pixel kinds, `chromatic`
 * with `mode: 'radial'`, and `motion` when rasterising (librsvg can't
 * blur along a turned axis, and the pixel blur holds the edge).
 *
 * @param {any} fx
 * @param {{ raster?: boolean }} [ctx]
 * @returns {boolean}
 */
export function isPixel(fx, ctx) {
  const e = asEffect(fx);
  if (!e || !Object.hasOwn(PIXEL, e.kind)) return false;
  if (e.kind === 'chromatic') return e.mode === 'radial';
  if (e.kind === 'motion') return Boolean(ctx?.raster);
  return true;
}

/**
 * Whether an effect needs something that draws pixels (so `renderSvg`
 * loads sharp in Node): pixel effects, `dither`, a round `border`.
 *
 * @param {any} fx
 * @returns {boolean}
 */
export function needsPixels(fx) {
  const e = asEffect(fx);
  return Boolean(e) && (isPixel(e) || e.kind === 'dither' || (e.kind === 'border' && e.shape === 'circle'));
}

/**
 * Whether an effect is drawn without an SVG filter (pixels, copies, a
 * round `border`).
 *
 * @param {any} fx
 * @param {{ raster?: boolean }} [ctx]
 * @returns {boolean}
 */
export const isRaster = (fx, ctx) => {
  const e = asEffect(fx);
  return Boolean(e) && (e.kind === 'dither' || Object.hasOwn(COPIES, e.kind) || isPixel(e, ctx) || (e.kind === 'border' && e.shape === 'circle'));
};

/**
 * An effect drawn without an SVG filter: on pixels, as copies, or a round
 * `border`; with its `mask` (a pixel mix, or for copies an SVG mask).
 * Undefined where nothing can draw pixels (its filter is used instead).
 *
 * @param {any} fx
 * @param {{ defs: string, body: string }} m
 * @param {import('../layers.js').RenderContext} ctx
 * @param {number} i - The effect's index (for unique ids).
 * @returns {Promise<{ defs: string, body: string } | undefined>}
 */
export async function rasterEffect(fx, m, ctx, i) {
  const id = `${ctx.id}x${i}`;
  if (isPixel(fx, ctx)) return pixelEffect(fx, m, ctx, (img) => PIXEL[fx.kind](img, fx, ctx));
  let out;
  if (Object.hasOwn(COPIES, fx.kind)) out = COPIES[fx.kind](fx, m, ctx, id);
  else if (fx.kind === 'border') out = await roundBorder(fx, m, ctx);
  else out = await ditherRaster(fx, m, ctx, id);
  if (!out || !fx.mask) return out;
  return maskOverlay(m.body, out, fx.mask, ctx, `${id}m`);
}

/** Region padding by kind, as a fraction of the canvas. */
const PAD = /** @type {Record<string, number>} */ ({ blur: 0.25, shadow: 0.25, glow: 0.25, warp: 0.25, bloom: 0.25, lens: 0.25, tilt: 0.25 });

/**
 * Wrap markup in a layer's filter effects.
 *
 * `motion` (a directional blur at any `angle`) blurs along x in a frame
 * turned to the angle; every other kind is one filter. A pixel effect
 * here (nothing could draw pixels) takes its fallback filter, or is left
 * out.
 *
 * Each takes `colorSpace` (`'sRGB'`, the default, or `'linearRGB'`, the
 * SVG default a browser's own filters use), `pad` and `mask`: a gradient
 * mask is mixed inside the filter; a layer mask too when it has been
 * drawn as an image, else the effect is drawn over the layer through an
 * SVG mask.
 *
 * @param {string} body
 * @param {import('./index.js').Effect | import('./index.js').Effect[]} list
 * @param {import('../layers.js').RenderContext} ctx
 * @param {number} [start=0] - Index of the first effect (ids stay unique when a list is applied in runs).
 * @param {{ x: number, y: number, width: number, height: number }} [content] - The box the layer paints, when known: filters that stay inside their source get a region that size (plus their padding) instead of the canvas.
 * @param {string} [prior=''] - The defs drawn so far (an SVG mask fallback repeats the layer).
 * @returns {{ defs: string, body: string }}
 * @throws {TypeError} On an unknown kind.
 */
export function applyEffects(body, list, ctx, start = 0, content, prior = '') {
  const effects = Array.isArray(list) ? list : [list];
  let defs = '';
  let out = body;
  /** What the layer paints so far (grows with each effect's padding), when known. */
  let painted = content;
  effects.forEach((e, i) => {
    if (!e) return;
    const fx = /** @type {any} */ (asEffect(e));
    const id = `${ctx.id}x${start + i}`;
    const before = out;
    const mask = fx.mask;
    // A layer mask not drawn as an image: the effect goes over the layer through an SVG mask.
    const overlay = mask && mask.layers && !mask[RESOLVED]?.image;
    /** @param {number} pad @param {number} [angle] @returns {string} The mix with the source, for a mask. */
    const mix = (pad, angle = 0) => (!mask || overlay ? '' : lerpPrimitives(mask.layers ? mask[RESOLVED].image : gradientImage(mask, ctx, pad, angle)));
    if (fx.kind === 'motion') {
      const a = fx.angle ?? 0;
      const c = `${num(ctx.width / 2)} ${num(ctx.height / 2)}`;
      const pad = fx.pad ?? 0.3;
      defs += filterElement(id, ctx, pad, `<feGaussianBlur stdDeviation="${num(len(fx.length ?? '3vmin', ctx.canvas))} ${num(len(fx.spread ?? 0, ctx.canvas))}"/>${mix(pad, a)}`, fx.colorSpace);
      out = `<g transform="rotate(${num(a)} ${c})"><g filter="url(#${id})"><g transform="rotate(${num(-a)} ${c})">${out}</g></g></g>`;
      painted = undefined;
    } else {
      const make = Object.hasOwn(KINDS, fx.kind) ? KINDS[fx.kind] : FALLBACK[fx.kind];
      if (!make) {
        if (Object.hasOwn(PIXEL, fx.kind) || Object.hasOwn(COPIES, fx.kind)) return;
        throw new TypeError(`Unknown effect "${fx.kind}" (${EFFECTS.join(', ')})`);
      }
      const pad = fx.pad ?? PAD[fx.kind] ?? 0.05;
      let primitives = make(fx, ctx);
      if (!primitives) return;
      primitives += mix(pad);
      // For librsvg: separable morphology, and a region the size of what's painted.
      if (/** @type {any} */ (ctx).raster) primitives = separableMorphology(primitives);
      const region = painted && bounded(primitives) ? grow(painted, pad, ctx) : undefined;
      // How far it reaches at the output's resolution (renderImage's tiles overlap by that).
      /** @type {any} */ (ctx).noteReach?.(filterReach(primitives) * (/** @type {any} */ (ctx).res ?? 1));
      painted = region;
      defs += filterElement(id, ctx, pad, primitives, fx.colorSpace, region);
      out = `<g filter="url(#${id})">${out}</g>`;
    }
    if (overlay) {
      const got = maskOverlay(before, { defs: prior + defs, body: out }, mask, ctx, `${id}m`);
      defs = got.defs.slice(prior.length);
      out = got.body;
      painted = undefined;
    }
  });
  return { defs, body: out };
}

/**
 * A painted box grown by an effect's padding, inside the canvas's padded region.
 *
 * @param {{ x: number, y: number, width: number, height: number }} box
 * @param {number} pad - Fraction of the canvas.
 * @param {{ width: number, height: number }} ctx
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
function grow(box, pad, ctx) {
  const px = ctx.width * pad;
  const py = ctx.height * pad;
  const x0 = Math.max(-px, box.x - px);
  const y0 = Math.max(-py, box.y - py);
  const x1 = Math.min(ctx.width + px, box.x + box.width + px);
  const y1 = Math.min(ctx.height + py, box.y + box.height + py);
  return { x: x0, y: y0, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
}
