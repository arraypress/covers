// The `perforation` layer.
import type { Color, Length, BaseLayer, Anchor } from '../index.js';
import type { RenderContext, Markup } from '../render/context.js';

export interface PerforationLayer extends BaseLayer {
  type: 'perforation';
  kind?: 'holes' | 'dashes' | 'notches';
  x?: Length | `${number}%`; x1?: Length | `${number}%`; y1?: Length | `${number}%`; x2?: Length | `${number}%`; y2?: Length | `${number}%`;
  size?: Length; gap?: Length; inset?: Length; color?: Color; strokeWidth?: Length;
}


/** Draw a tear-off line. */
export function perforation(layer: PerforationLayer, ctx: RenderContext): Markup;
