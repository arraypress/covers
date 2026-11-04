// Ink and print effects.
import type { Effect } from './index.js';
import type { RenderContext } from '../render/context.js';

/** The `rough | warp` effect's filter primitives. */
export function rough(fx: Extract<Effect, { kind: 'rough' | 'warp' }>, ctx: RenderContext): string;
/** The `wear` effect's filter primitives. */
export function wear(fx: Extract<Effect, { kind: 'wear' }>, ctx: RenderContext): string;
/** The `xerox` effect's filter primitives. */
export function xerox(fx: Extract<Effect, { kind: 'xerox' }>, ctx: RenderContext): string;
/** The `grit` effect's filter primitives. */
export function grit(fx: Extract<Effect, { kind: 'grit' }>, ctx: RenderContext): string;
