// Helpers for writing filter primitives.

/** Rec. 709 luma weights. */
export const LUMA: [number, number, number];
/** A colour as 0–1 channels. */
export function rgb(c: string): [number, number, number];
/** A colour-matrix value list from 20 numbers. */
export function mat(m: number[]): string;
/** A matrix flooding RGB with a colour, alpha from a 5-number row (default the source alpha). */
export function flood(color: string, alpha?: number[]): string;
/** The effect's `seed`, else a seeded one. */
export function seedOf(ctx: { rng: { int: (a: number, b: number) => number } }, fx: { seed?: number }): number;
/** A `<filter>` over the canvas, padded by `pad` (a fraction) on each side, in user space. */
export function filterElement(id: string, ctx: { width: number; height: number }, pad: number, body: string, colorSpace?: 'sRGB' | 'linearRGB', region?: { x: number; y: number; width: number; height: number }): string;
/** Turbulence fed to a displacement map. */
export function displace(frequency: number | number[], octaves: number, seed: number, scale: number, result?: string): string;
