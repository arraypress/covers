// The `barcode` layer.
import type { Color, Length, BaseLayer, Anchor } from '../index.js';
import type { RenderContext, Markup } from '../render/context.js';

export interface BarcodeLayer extends BaseLayer {
  type: 'barcode';
  /** Encoded as Code 128 (set B). */
  value?: string;
  content?: string;
  kind?: 'code128' | 'seeded';
  x?: Length | `${number}%`; y?: Length | `${number}%`; width?: Length | `${number}%`; height?: Length | `${number}%`;
  color?: Color;
  text?: boolean | string;
  size?: Length; font?: string; weight?: number; letterSpacing?: number;
}


/** Draw a Code 128 barcode (or decorative bars). */
export function barcode(layer: BarcodeLayer, ctx: RenderContext): Promise<Markup>;
