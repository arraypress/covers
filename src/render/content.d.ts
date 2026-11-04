// Where a layer paints, for content-sized filter regions.
import type { Markup, RenderContext } from './context.js';

/** The box a layer's markup paints, in its units (drawn small with sharp); undefined when it can't be probed. */
export function contentBox(m: Markup, ctx: RenderContext): Promise<{ x: number; y: number; width: number; height: number } | undefined>;
