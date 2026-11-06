// The `marks` layer.
import type { Color, Length, BaseLayer } from '../index.js';
import type { RenderContext, Markup } from '../render/context.js';

export interface MarksLayer extends BaseLayer {
  type: 'marks';
  /** The marks: their paths on a 512 grid (or `{ markup }`). */
  marks: (string | { markup: string })[];
  /** Default from the count and the box: 3 × 3 up to 10 × 7. */
  cols?: number;
  rows?: number;
  /** The box the grid is centred in (default the canvas). */
  x?: Length | `${number}%`; y?: Length | `${number}%`; width?: Length | `${number}%`; height?: Length | `${number}%`;
  /** The share of a cell a mark's area takes. Default 0.5. */
  size?: number;
  /** `false`: each mark's bounds fitted to the same box, not optically sized. Default true. */
  optical?: boolean;
  /** Default the palette's text. */
  color?: Color;
}

/** Draw a set of marks on an even grid, optically sized the same. */
export function marks(layer: MarksLayer, ctx: RenderContext): Markup;
/** Columns and rows for `n` marks in a box of `aspect` (3 × 3 to 10 × 7; given ones kept). */
export function sheetGrid(n: number, aspect: number, cols?: number, rows?: number): { cols: number; rows: number };
