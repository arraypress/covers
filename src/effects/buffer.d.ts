// Pixel helpers shared by the pixel effects.
import type { Length } from '../index.js';

/** A layer drawn as pixels: RGBA, 8-bit, not premultiplied. */
export interface Pixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  /** Pixels per layer unit. */
  scale: number;
  /** Every pixel has alpha 255. */
  opaque: boolean;
}

/** sRGB byte → linear light, 0–1. */
export const TO_LINEAR: Float32Array;
/** Linear light (clipped) to an sRGB byte. */
export function toSrgb(v: number): number;
/** A length in pixels. */
export function px(v: Length | undefined, ctx: { canvas: { width: number; height: number } }, img: Pixels, fallback: Length): number;
/** A point given as fractions of the canvas, in pixels. */
export function pointPx(p: [number, number] | { x: number; y: number } | undefined, img: { width: number; height: number }, fallback?: [number, number]): [number, number];
/** A point as fractions. */
export function fraction(p: [number, number] | { x: number; y: number } | undefined, fallback: [number, number]): [number, number];
/** 0–1. */
export function clamp01(v: number): number;
/** Hermite step from a to b. */
export function smoothstep(a: number, b: number, v: number): number;
/** A premultiplied copy (the same buffer when opaque). */
export function premultiplied(img: Pixels): Uint8ClampedArray;
/** Undo premultiplying, in place. */
export function unpremultiply(d: Uint8ClampedArray): Uint8ClampedArray;
/** Bilinear RGBA sample, the edge held, written to `out` at `o`. */
export function bilinear(src: Uint8ClampedArray, w: number, h: number, x: number, y: number, out: Uint8ClampedArray | Float32Array, o: number): void;
/** Resample every pixel from where `map` says it came from. */
export function remap(img: Pixels, map: (x: number, y: number, at: Float64Array) => void): Uint8ClampedArray;
/** Box radii for three passes approximating a Gaussian. */
export function boxesFor(sigma: number): number[];
/** A box blur along rows (0) or columns (1), the edge held. */
export function boxPass(src: Uint8ClampedArray | Float32Array, dst: Uint8ClampedArray | Float32Array, w: number, h: number, ch: number, r: number, dir: 0 | 1): void;
/** A Gaussian blur in place (three box passes each way). */
export function gaussian<T extends Uint8ClampedArray | Float32Array>(data: T, w: number, h: number, ch: number, sigma: number, sigmaY?: number): T;
/** Downsample by a whole factor, averaging blocks. */
export function shrink(src: Uint8ClampedArray, w: number, h: number, f: number): { data: Uint8ClampedArray; width: number; height: number };
/** Upscale, bilinear. */
export function enlarge(src: Uint8ClampedArray, sw: number, sh: number, w: number, h: number): Uint8ClampedArray;
/** Upscale, nearest neighbour. */
export function nearest(src: Uint8ClampedArray, sw: number, sh: number, w: number, h: number): Uint8ClampedArray;
/** Rec. 709 luma of a pixel, 0–255. */
export function luma(d: ArrayLike<number>, i: number): number;
/** The effect's own seed (hashed), else one from the layer's stream. */
export function seedFor(fx: { seed?: number | string }, ctx: { rng: { int: (a: number, b: number) => number } }): number;
/** An integer hash of a lattice point and a seed, 0–1. */
export function hash2(x: number, y: number, seed: number): number;
/** Smooth value noise, -1–1. */
export function valueNoise(x: number, y: number, seed: number): number;
/** Fractal value noise, about -1–1. */
export function fractalNoise(x: number, y: number, seed: number, octaves?: number): number;
/** A fractal noise field for every pixel, -1–1. */
export function noiseField(w: number, h: number, period: number, seed: number, octaves?: number): Float32Array;
