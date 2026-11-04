// Chromatic aberration, glitch and pixelate.
import type { Effect } from './index.js';
import type { RenderContext } from '../render/context.js';
import type { Pixels } from './buffer.js';
import type { PixelResult } from './pixels.js';

/** The directional `chromatic` (and `rgbSplit`) effect's filter primitives. */
export function chromatic(fx: Extract<Effect, { kind: 'chromatic' | 'rgbSplit' }>, ctx: RenderContext): string;
/** Radial `chromatic`, on pixels. */
export function chromaticRadial(img: Pixels, fx: Extract<Effect, { kind: 'chromatic' }>, ctx: object): Uint8ClampedArray;
/** `glitch`, on pixels. */
export function glitch(img: Pixels, fx: Extract<Effect, { kind: 'glitch' }>, ctx: object): Uint8ClampedArray;
/** `pixelate` (and `mosaic`), on pixels. */
export function pixelate(img: Pixels, fx: Extract<Effect, { kind: 'pixelate' | 'mosaic' }>, ctx: object): PixelResult;
