// Colour grading.
import type { Effect } from './index.js';
import type { Pixels } from './buffer.js';

/** A monotone cubic through points, sampled as a table. */
export function curveTable(points: [number, number][], n?: number): number[];
/** A component transfer from three tables (R, G, B). */
export function transfer(tables: number[][]): string;
/** A gradient's colour at `t`, 0–1 channels. */
export function sampleGradient(colors: string[], stops: number[], t: number, space: 'srgb' | 'oklab'): [number, number, number];
/** A colour balance's tables, per channel. */
export function balanceTables(fx: { shadows?: number[]; midtones?: number[]; highlights?: number[] }): number[][];
/** The `curves` effect's filter primitives. */
export function curves(fx: Extract<Effect, { kind: 'curves' }>): string;
/** The `gradientMap` effect's filter primitives. */
export function gradientMap(fx: Extract<Effect, { kind: 'gradientMap' }>): string;
/** The `posterize` effect's filter primitives. */
export function posterize(fx: Extract<Effect, { kind: 'posterize' }>): string;
/** The `invert` effect's filter primitives. */
export function invert(fx: Extract<Effect, { kind: 'invert' }>): string;
/** The `hue` effect's filter primitives. */
export function hue(fx: Extract<Effect, { kind: 'hue' }>): string;
/** The `colorBalance` effect's filter primitives. */
export function colorBalance(fx: Extract<Effect, { kind: 'colorBalance' }>): string;
/** The `channelMixer` effect's filter primitives. */
export function channelMixer(fx: Extract<Effect, { kind: 'channelMixer' }>): string;
/** The `sepia` effect's filter primitives. */
export function sepia(fx: Extract<Effect, { kind: 'sepia' }>): string;
/** `vibrance`, on pixels. */
export function vibrance(img: Pixels, fx: Extract<Effect, { kind: 'vibrance' }>): Uint8ClampedArray;
