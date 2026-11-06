// Placing a mark by its real bounds and writing its outline in canvas units.
import type { RenderContext } from '../render/context.js';

/** A box, canvas or mark units. */
export interface Box { x: number; y: number; width: number; height: number }

/** A mark placed in an area: canvas x = mark x × k + dx. */
export interface MarkFit {
  k: number;
  dx: number;
  dy: number;
  /** The area it was fitted in, canvas units. */
  area: Box;
}

/** The layer's box (`x`, `y`, `width`, `height`; default the canvas), canvas units. */
export function layerBox(layer: { x?: unknown; y?: unknown; width?: unknown; height?: unknown }, ctx: Pick<RenderContext, 'canvas'>): Box;
/** Fit a mark's bounds (plus `reach` round them) into an area, centred: the longest side takes `share` of the area's shorter side, never past the area. */
export function fitMark(box: Box, area: Box, share?: number, reach?: number): MarkFit;
/** A mark's filled shapes as path data in canvas units, each with its fill rule. */
export function markPaths(markup: string, fit: MarkFit): { d: string; evenodd: boolean }[];
