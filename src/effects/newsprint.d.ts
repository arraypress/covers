// A four-colour process halftone.
import type { Effect } from './index.js';
import type { Pixels } from './buffer.js';

/** `newsprint`, on pixels. */
export function newsprint(img: Pixels, fx: Extract<Effect, { kind: 'newsprint' }>, ctx: object): Uint8ClampedArray;
