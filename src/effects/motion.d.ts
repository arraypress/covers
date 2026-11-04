// The motion blur on pixels (renderImage).
import type { Effect } from './index.js';
import type { Pixels } from './buffer.js';

/** A Gaussian blur along an angle, on pixels. */
export function motion(img: Pixels, fx: Extract<Effect, { kind: 'motion' }>, ctx: object): Uint8ClampedArray;
