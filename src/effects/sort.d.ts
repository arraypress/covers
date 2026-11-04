// Pixel sorting and pixel stretch.
import type { Effect } from './index.js';
import type { Pixels } from './buffer.js';

/** `sort`, on pixels. */
export function sort(img: Pixels, fx: Extract<Effect, { kind: 'sort' }>, ctx: object): Uint8ClampedArray;
/** `stretch`, on pixels. */
export function stretch(img: Pixels, fx: Extract<Effect, { kind: 'stretch' }>): Uint8ClampedArray;
