// An ordered (Bayer) dither.
import type { Effect } from './index.js';
import type { RenderContext, Markup } from '../render/context.js';

/** The `dither` effect's filter primitives. */
export function dither(fx: Extract<Effect, { kind: 'dither' }>, ctx: RenderContext): string;
/** The dither on pixels (the layer drawn once per cell, thresholded, embedded nearest-neighbour); undefined where nothing can rasterise. */
export function ditherRaster(fx: Extract<Effect, { kind: 'dither' }>, m: Markup, ctx: RenderContext, id: string): Promise<Markup | undefined>;
