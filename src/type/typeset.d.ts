// The text layer with its 1.1 options.
import type { TextLayer } from '../index.js';
import type { RenderContext, Markup } from '../render/context.js';

/** The options that switch a text layer onto the poster typesetter. */
export const TYPE_OPTIONS: readonly (keyof TextLayer)[];
/** Whether a text layer uses any of them. */
export function wantsType(layer: TextLayer): boolean;
/** Draw a text layer with its 1.1 options. */
export function typeset(layer: TextLayer, ctx: RenderContext): Promise<Markup>;
