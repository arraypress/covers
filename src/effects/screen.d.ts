// Screens and signals.
import type { Effect } from './index.js';
import type { RenderContext } from '../render/context.js';
import type { Pixels } from './buffer.js';
import type { PixelResult } from './pixels.js';

/** The `scanlines` effect's filter primitives. */
export function scanlines(fx: Extract<Effect, { kind: 'scanlines' }>, ctx: RenderContext): string;
/** `crt`, on pixels. */
export function crt(img: Pixels, fx: Extract<Effect, { kind: 'crt' }>, ctx: object): Uint8ClampedArray;
/** `vhs`, on pixels. */
export function vhs(img: Pixels, fx: Extract<Effect, { kind: 'vhs' }>, ctx: object): Uint8ClampedArray;
/** `jpeg`: through a real JPEG encoder, on pixels. */
export function jpeg(img: Pixels, fx: Extract<Effect, { kind: 'jpeg' }>, ctx: object): Promise<PixelResult | Uint8ClampedArray>;
