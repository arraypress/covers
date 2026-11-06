// The `outline` layer.
import type { Color, Length, BaseLayer } from '../index.js';
import type { RenderContext, Markup } from '../render/context.js';

export interface OutlineLayer extends BaseLayer {
  type: 'outline';
  /** The mark's paths, on a 512 grid. */
  markup: string;
  /** The box the lines are fitted and centred in (default the canvas). */
  x?: Length | `${number}%`; y?: Length | `${number}%`; width?: Length | `${number}%`; height?: Length | `${number}%`;
  /** The share of the box's shorter side the whole set's longest side takes. Default 1. */
  size?: number;
  /** Contour lines, 0–8: the outline and more round it, `gap` apart. 0 draws the mark solid. Default 4. */
  lines?: number;
  /** Between lines, a share of the mark's longest side. Default 0.05. */
  gap?: number;
  /** Lines round the mark (`'out'`, the default) or inside it (`'in'`). */
  direction?: 'out' | 'in';
  /** Line width. Default `'0.4vmin'`. */
  stroke?: Length;
  /** Default the palette's text. */
  color?: Color;
}

/** Draw a mark as contour lines (or solid), fitted by its real bounds. */
export function outline(layer: OutlineLayer, ctx: RenderContext): Markup;
