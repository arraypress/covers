// Sharpen, edges, emboss and sketch.
import type { Effect } from './index.js';
import type { RenderContext } from '../render/context.js';

/** The `sharpen` effect's filter primitives. */
export function sharpen(fx: Extract<Effect, { kind: 'sharpen' }>, ctx: RenderContext): string;
/** The `edges` effect's filter primitives. */
export function edges(fx: Extract<Effect, { kind: 'edges' }>, ctx: RenderContext): string;
/** The `emboss` effect's filter primitives. */
export function emboss(fx: Extract<Effect, { kind: 'emboss' }>, ctx: RenderContext): string;
/** The `sketch` effect's filter primitives. */
export function sketch(fx: Extract<Effect, { kind: 'sketch' }>, ctx: RenderContext): string;
