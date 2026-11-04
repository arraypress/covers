// Distortions on pixels.
import type { Effect } from './index.js';
import type { Pixels } from './buffer.js';

/** `wave`. */
export function wave(img: Pixels, fx: Extract<Effect, { kind: 'wave' }>, ctx: object): Uint8ClampedArray;
/** `ripple`. */
export function ripple(img: Pixels, fx: Extract<Effect, { kind: 'ripple' }>, ctx: object): Uint8ClampedArray;
/** `twirl`. */
export function twirl(img: Pixels, fx: Extract<Effect, { kind: 'twirl' }>, ctx: object): Uint8ClampedArray;
/** `bulge` and `pinch`. */
export function bulge(img: Pixels, fx: Extract<Effect, { kind: 'bulge' | 'pinch' }>, ctx: object): Uint8ClampedArray;
/** `fisheye`. */
export function fisheye(img: Pixels, fx: Extract<Effect, { kind: 'fisheye' }>): Uint8ClampedArray;
/** `kaleidoscope`. */
export function kaleidoscope(img: Pixels, fx: Extract<Effect, { kind: 'kaleidoscope' }>): Uint8ClampedArray;
/** `glass`. */
export function glass(img: Pixels, fx: Extract<Effect, { kind: 'glass' }>, ctx: object): Uint8ClampedArray;
/** `displace`. */
export function displace(img: Pixels, fx: Extract<Effect, { kind: 'displace' }>, ctx: object): Promise<Uint8ClampedArray>;
