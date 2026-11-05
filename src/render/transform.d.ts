// A layer's `transform` option as an SVG transform.
import type { Length } from '../index.js';

/** A transform any layer takes (about `origin`, default the canvas centre). */
export interface LayerTransform {
  translate?: [Length, Length] | { x?: Length; y?: Length };
  /** Degrees. */
  rotate?: number;
  scale?: number | [number, number];
  skewX?: number;
  skewY?: number;
  /** `'x'` flips left–right, `'y'` top–bottom. */
  mirror?: 'x' | 'y' | 'both';
  /** `[x, y]` px, or `'center'`. */
  origin?: [Length, Length] | { x?: Length; y?: Length } | 'center';
}


/** A `transform` option as an SVG transform string (a string is used as written). */
export function transformAttr(t: LayerTransform | string | undefined, canvas: { width: number; height: number }): string | undefined;

/** An affine matrix `[a, b, c, d, e, f]`, as SVG's `matrix()`. */
export type Affine = [number, number, number, number, number, number];
/** A transform (string or object form) as one matrix. */
export function transformMatrix(t: LayerTransform | string | undefined, canvas: { width: number; height: number }): Affine;
/** How much a matrix enlarges what it draws: smallest and largest stretch, and their geometric mean. */
export function stretchOf(m: Affine): { min: number; max: number; mean: number };
/** The inverse of an affine matrix. */
export function invert(m: Affine): Affine;
/** A point through an affine matrix. */
export function apply(m: Affine, x: number, y: number): [number, number];
/** The identity matrix. */
export const IDENTITY: Readonly<Affine>;
/** `m × n`: `n` applied first, in `m`'s space. */
export function compose(m: Affine, n: Affine): Affine;
