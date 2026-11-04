// The colour under a box, for auto contrast.
import type { Cover, Layer } from '../index.js';
import type { Markup } from './context.js';

/** A sampler: the average colour (`#rrggbb`) under a box of the parts drawn so far, or undefined where nothing can rasterise. */
export function backdropSampler(c: Cover, sharp: unknown, documentFor: (c: Cover, parts: Markup[]) => string, loadSharp: (required: boolean) => Promise<unknown>): (box: { x: number; y: number; width: number; height: number }, parts: (Markup & { layer: Layer })[]) => Promise<string | undefined>;
