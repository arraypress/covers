// Blurs about a centre, on pixels.
import type { Effect } from './index.js';
import type { Pixels } from './buffer.js';

/** `spin`: a rotational blur. */
export function spin(img: Pixels, fx: Extract<Effect, { kind: 'spin' }>): Uint8ClampedArray;
/** `zoom`: a radial blur toward the centre. */
export function zoom(img: Pixels, fx: Extract<Effect, { kind: 'zoom' }>): Uint8ClampedArray;
/** `rays`: god rays from a light. */
export function rays(img: Pixels, fx: Extract<Effect, { kind: 'rays' }>): Uint8ClampedArray;
