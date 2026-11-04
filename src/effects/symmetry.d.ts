// Mirror, as copies of the markup.
import type { Effect } from './index.js';
import type { Markup } from '../render/context.js';

/** `mirror`: one side reflected onto the other. */
export function mirror(fx: Extract<Effect, { kind: 'mirror' }>, m: Markup, ctx: { width: number; height: number; res?: number }, id: string): Markup;
