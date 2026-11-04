// Light spreading from the bright parts.
import type { Effect } from './index.js';
import type { RenderContext } from '../render/context.js';

/** The `bloom` effect's filter primitives. */
export function bloom(fx: Extract<Effect, { kind: 'bloom' }>, ctx: RenderContext): string;
/** The `halation` effect's filter primitives. */
export function halation(fx: Extract<Effect, { kind: 'halation' }>, ctx: RenderContext): string;
