// The `construction` layer.
import type { Color, Length, BaseLayer } from '../index.js';
import type { RenderContext, Markup } from '../render/context.js';

export interface ConstructionLayer extends BaseLayer {
  type: 'construction';
  /** The mark's paths, on a 512 grid. */
  markup: string;
  /** The box the sheet fills (default the canvas); the mark is centred in it. */
  x?: Length | `${number}%`; y?: Length | `${number}%`; width?: Length | `${number}%`; height?: Length | `${number}%`;
  /** The share of the box's shorter side the mark's longest side takes. Default 0.6. */
  size?: number;
  /** Grid cells across the mark's longest side; 0 none. Default 8. */
  grid?: number;
  /** The most circles read from its curves. Default 6. */
  circles?: number;
  /** The most lines read from its straight edges. Default 6. */
  lines?: number;
  /** The guides. Default the palette's accent. */
  color?: Color;
  /** Default `color`. */
  gridColor?: Color;
  /** Default 0.3. */
  gridOpacity?: number;
  /** Default the palette's text; `'none'` leaves the mark out. */
  markColor?: Color | 'none';
  /** The guides' opacity over the mark, 0–1. Default 0.4. */
  over?: number;
  /** Guide width. Default `'0.15vmin'`. */
  stroke?: Length;
}

/** Draw a mark over its own construction: grid, box, centre cross, its circles and lines. */
export function construction(layer: ConstructionLayer, ctx: RenderContext): Markup;
