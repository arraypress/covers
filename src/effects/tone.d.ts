// Tone and colour.
import type { Effect } from './index.js';
import type { RenderContext } from '../render/context.js';

/** The `duotone` effect's filter primitives. */
export function duotone(fx: Extract<Effect, { kind: 'duotone' }>, ctx: RenderContext): string;
/** The `grayscale | levels` effect's filter primitives. */
export function levels(fx: Extract<Effect, { kind: 'grayscale' | 'levels' }>, ctx: RenderContext): string;
/** The `saturate` effect's filter primitives. */
export function saturate(fx: Extract<Effect, { kind: 'saturate' }>, ctx: RenderContext): string;
/** The `matrix` effect's filter primitives. */
export function matrix(fx: Extract<Effect, { kind: 'matrix' }>, ctx: RenderContext): string;
/** The `threshold` effect's filter primitives. */
export function threshold(fx: Extract<Effect, { kind: 'threshold' }>, ctx: RenderContext): string;
/** The `photocopy` effect's filter primitives. */
export function photocopy(fx: Extract<Effect, { kind: 'photocopy' }>, ctx: RenderContext): string;
