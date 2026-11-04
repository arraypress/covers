// The `shape` layer.
import type { Color, Length, BaseLayer, Anchor } from '../index.js';
import type { RenderContext, Markup } from '../render/context.js';
import type { Paint } from '../effects/paint.js';

/** One exact shape (see the README's `shape` table). */
export interface ShapeSpec {
  kind?: 'rect' | 'circle' | 'ellipse' | 'line' | 'polygon' | 'polyline' | 'star' | 'burst' | 'scallop' | 'rays' | 'ring' | 'sector' | 'arch' | 'wave' | 'path' | 'cut';
  x?: Length | `${number}%`; y?: Length | `${number}%`; width?: Length | `${number}%`; height?: Length | `${number}%`;
  cx?: Length | `${number}%`; cy?: Length | `${number}%`; r?: Length; rx?: Length; ry?: Length;
  x1?: Length | `${number}%`; y1?: Length | `${number}%`; x2?: Length | `${number}%`; y2?: Length | `${number}%`;
  points?: number | [Length, Length][];
  inner?: Length; count?: number; start?: number; end?: number; depth?: Length;
  amplitude?: Length; wavelength?: Length; phase?: number; band?: Length;
  d?: string; viewBox?: [number, number, number, number];
  radius?: Length;
  edge?: 'deckle' | 'torn' | 'zigzag' | 'wave' | 'scallop' | { kind: 'deckle' | 'torn' | 'zigzag' | 'wave' | 'scallop'; size?: Length; step?: Length; sides?: ('top' | 'right' | 'bottom' | 'left')[] };
  rotate?: number;
  /** Rotate about this point (px or `'%'`) instead of the centre. */
  origin?: [Length | `${number}%`, Length | `${number}%`] | { x?: Length | `${number}%`; y?: Length | `${number}%` };
  /** `arch`: the arc and its sides only (stroked). */
  open?: boolean;
  /** A blur radius, drawn padded: soft orbs with no edge fade or square edge. */
  soft?: Length;
  /** `cut`: grow (or shrink) the format's die-cut outline. */
  outset?: Length;
  /** Where the dash pattern starts. */
  dashOffset?: Length;
  fill?: Paint; stroke?: Paint; strokeWidth?: Length;
  strokes?: { color: Color; width: Length; dash?: Length[] }[];
  dash?: 'dashed' | 'dotted' | Length[];
  linecap?: 'butt' | 'round' | 'square'; linejoin?: 'miter' | 'round' | 'bevel'; fillRule?: 'nonzero' | 'evenodd';
  opacity?: number;
}

export interface ShapeLayer extends BaseLayer, Omit<ShapeSpec, 'opacity'> {
  type: 'shape';
  /** Several shapes in one layer (layer-level fill, stroke, … are their defaults). */
  items?: ShapeSpec[];
}


/** Draw one shape, or `items` of them. */
export function shape(layer: ShapeLayer, ctx: RenderContext): Promise<Markup>;
/** A dash pattern as an SVG `stroke-dasharray`. */
export function dashArray(dash: 'dashed' | 'dotted' | Length[], width: number, ctx: RenderContext): string;
