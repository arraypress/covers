// Effects computed on pixels: draw, process, mix through the mask, embed.
import type { Markup } from '../render/context.js';
import type { Pixels } from './buffer.js';

/** The most pixels an effect works on. */
export const MAX_PIXELS: number;

/** What a pixel effect returns. */
export interface PixelResult {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** Embed as PNG even when opaque. */
  lossless?: boolean;
  /** Smaller than the layer: scaled up nearest-neighbour. */
  pixelated?: boolean;
}

/** A layer's markup as RGBA pixels, `w`×`h` over its canvas; undefined where nothing can draw. */
export function drawLayer(m: Markup, ctx: object, w: number, h: number): Promise<Uint8ClampedArray | undefined>;
/** The raster size for a layer (its pixels as shown, capped). */
export function rasterSize(ctx: object, cap?: number): { w: number; h: number; scale: number };
/** Run a pixel effect on a layer's markup; undefined where nothing can draw pixels. */
export function pixelEffect(fx: { mask?: import('./mask.js').EffectMask }, m: Markup, ctx: object, run: (img: Pixels) => PixelResult | Uint8ClampedArray | Promise<PixelResult | Uint8ClampedArray>, o?: { cap?: number }): Promise<Markup | undefined>;
