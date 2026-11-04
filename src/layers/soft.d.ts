// Soft (blurred) shapes, drawn padded.
import type { RenderContext, Markup } from '../render/context.js';

/** Blur markup by `sigma`, padded 3σ round `box` (raster with sharp, else an SVG blur). */
export function soften(m: Markup, box: { x: number; y: number; width: number; height: number }, sigma: number, ctx: RenderContext, id: string): Promise<Markup>;
