// Optical blurs on pixels: lens bokeh and tilt-shift.
import type { Effect } from './index.js';
import type { Pixels } from './buffer.js';

/** One row of an aperture: its span (pixel offsets) and how much of the row it fills. */
export interface Span { dy: number; l: number; r: number; wgt: number }
/** An aperture (a disc, or a polygon of `blades` sides) as anti-aliased spans. */
export function aperture(R: number, blades: number, rotation: number): Span[];
/** Convolve premultiplied float RGBA with an aperture. */
export function convolveSpans(src: Float32Array, w: number, h: number, spans: Span[]): Float32Array;
/** `lens`: a lens blur with bokeh. */
export function lens(img: Pixels, fx: Extract<Effect, { kind: 'lens' }>, ctx: object): Uint8ClampedArray;
/** `tilt`: tilt-shift. */
export function tilt(img: Pixels, fx: Extract<Effect, { kind: 'tilt' }>, ctx: object): Uint8ClampedArray;
