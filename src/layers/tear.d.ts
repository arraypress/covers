// The `tear` layer.
import type { Color, Length, BaseLayer, Anchor } from '../index.js';
import type { RenderContext, Markup } from '../render/context.js';
import type { Paint } from '../paint/index.js';

export interface TearLayer extends BaseLayer {
  type: 'tear';
  from?: [Length | `${number}%`, Length | `${number}%`];
  to?: [Length | `${number}%`, Length | `${number}%`];
  side?: 'above' | 'below' | 'left' | 'right';
  color?: Paint;
  sheetOpacity?: number;
  step?: Length; jitter?: Length;
  rip?: false | { color?: Color; width?: Length; opacity?: number };
  fibres?: false | { color?: Color; width?: Length; opacity?: number; length?: [Length, Length]; spread?: Length };
  ripColor?: Color;
}


/** Draw torn paper: the sheet, its rip and fibres. */
export function tear(layer: TearLayer, ctx: RenderContext): Markup;
