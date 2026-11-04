// The `texture` layer.
import type { Color, Length, BaseLayer, Anchor } from '../index.js';
import type { RenderContext, Markup } from '../render/context.js';

export interface TextureLayer extends BaseLayer {
  type: 'texture';
  kind?: 'paper' | 'creases' | 'concrete' | 'speck' | 'wood' | 'folds' | 'dust';
  color?: Color; amount?: number; frequency?: number | [number, number]; octaves?: number;
  depth?: number; azimuth?: number; elevation?: number;
  x?: number[]; y?: number[]; width?: Length; strength?: number;
  count?: number; size?: [Length, Length];
  region?: { x?: Length | `${number}%`; y?: Length | `${number}%`; width?: Length | `${number}%`; height?: Length | `${number}%` };
}


/** Draw a surface texture. */
export function texture(layer: TextureLayer, ctx: RenderContext): Markup;
