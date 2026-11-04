// The layer as text art.
import type { Effect } from './index.js';
import type { Pixels } from './buffer.js';
import type { PixelResult } from './pixels.js';

/** `ascii`, on pixels (one pixel per font pixel, scaled up crisp). */
export function ascii(img: Pixels, fx: Extract<Effect, { kind: 'ascii' }>, ctx: object): PixelResult;
