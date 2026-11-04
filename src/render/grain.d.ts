// Raster grain for renderImage.
import type { GrainLayer, Rng } from '../index.js';

/** Seeded film-grain values at full size (one channel, or three with `monochrome: false`). */
export function noise(sharp: unknown, width: number, height: number, layer: GrainLayer, rng: Rng): Promise<{ data: Uint8Array; channels: 1 | 3 }>;
/** Blend grain into RGBA pixels in place. */
export function applyGrain(pixels: Uint8Array, grain: { data: Uint8Array; channels: 1 | 3; width: number; height: number }, layer: GrainLayer): void;
