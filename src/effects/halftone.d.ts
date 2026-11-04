// The riso halftone.
import type { Effect } from './index.js';
import type { RenderContext } from '../render/context.js';

/** The `halftone` effect's filter primitives. */
export function halftone(fx: Extract<Effect, { kind: 'halftone' }>, ctx: RenderContext): string;
/** Halftone screen shapes. */
export const HALFTONE_SHAPES: readonly ('dot' | 'line' | 'square' | 'diamond' | 'cross')[];
