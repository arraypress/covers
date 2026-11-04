// The `extrude` effect.
import type { RenderContext, Markup } from '../render/context.js';

/** A layer drawn again behind itself, a step further each time, in a darker colour. */
export function extrude(fx: { kind: 'extrude'; depth?: import('../index.js').Length; angle?: number; offset?: [import('../index.js').Length, import('../index.js').Length]; steps?: number; color?: string; to?: string }, m: Markup, ctx: RenderContext, id: string): Markup;
