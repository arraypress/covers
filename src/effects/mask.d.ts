// Where an effect applies: a gradient, or layers.
import type { Length, Layer } from '../index.js';

/** A point as fractions of the canvas. */
type Point = [number, number] | { x: number; y: number };

/** Options every mask form takes. */
interface MaskCommon {
  /** Swap where the effect applies and where it doesn't. */
  invert?: boolean;
  /** A smooth step between none and full (default true); false is linear. */
  ease?: boolean;
}

/** Where an effect applies, from none (0) to full (1). */
export type EffectMask =
  | (MaskCommon & { gradient: 'linear'; from?: Point; to?: Point })
  | (MaskCommon & { gradient: 'radial'; center?: Point; from?: Length; to?: Length; aspect?: number })
  | (MaskCommon & { gradient: 'band'; center?: Point; angle?: number; from?: Length; to?: Length })
  | (MaskCommon & { layers: Layer[] });

/** A mask image placed over a filter's region. */
export interface MaskImage {
  href: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The gradient forms. */
export const MASK_GRADIENTS: readonly ('linear' | 'radial' | 'band')[];
/** Where a resolved layer mask is kept on a mask (its markup, and an image where one could be drawn). */
export const RESOLVED: unique symbol;
/** Check a mask, throwing a readable error. */
export function checkMask(spec: unknown, where?: string): void;
/** A gradient mask as a function of a point in the layer's units, 0–1. */
export function maskField(spec: EffectMask, ctx: { width: number; height: number; canvas: { width: number; height: number } }): (x: number, y: number) => number;
/** A mask on a grid over a box of the layer, a byte a cell; undefined where a layer mask can't be drawn. */
export function maskGrid(spec: EffectMask, ctx: object, box: { x: number; y: number; width: number; height: number }, cols: number, rows: number, angle?: number): Promise<Uint8Array | undefined>;
/** A gradient mask on a grid (synchronous). */
export function gradientGrid(spec: EffectMask, ctx: object, box: { x: number; y: number; width: number; height: number }, cols: number, rows: number, angle?: number): Uint8Array;
/** The mask as a small greyscale image over a filter's region. */
export function maskImage(spec: EffectMask, ctx: object, pad: number, angle?: number): Promise<MaskImage | undefined>;
/** A gradient mask as an image, synchronously. */
export function gradientImage(spec: EffectMask, ctx: object, pad: number, angle?: number): MaskImage;
/** Filter primitives mixing the chain's result with its source through a mask image. */
export function lerpPrimitives(image: MaskImage): string;
/** Mix pixels before and after an effect through a mask, in place on `out`. */
export function lerpPixels(src: Uint8ClampedArray, out: Uint8ClampedArray, m: Uint8Array): Uint8ClampedArray;
/** The effect drawn over the layer through an SVG mask. */
export function maskOverlay(before: string, after: { defs: string; body: string }, spec: EffectMask, ctx: object, id: string): { defs: string; body: string };
