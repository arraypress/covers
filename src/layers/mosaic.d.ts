// The `mosaic` layer.
import type { Color, Length, BaseLayer } from '../index.js';
import type { RenderContext, Markup } from '../render/context.js';
import type { PixelGrid } from '@logomarks/core/edit';
import type { MarkGeometry } from './mark-geometry.js';

export interface MosaicLayer extends BaseLayer {
  type: 'mosaic';
  /** The mark's paths, on a 512 grid. */
  markup: string;
  /** The box the mosaic is fitted and centred in (default the canvas). */
  x?: Length | `${number}%`; y?: Length | `${number}%`; width?: Length | `${number}%`; height?: Length | `${number}%`;
  /** Cells across the mark's longest side, 4–48. Default 10. */
  cells?: number;
  /** The gap between cells, a share of a cell. Default 0.12. */
  gap?: number;
  /** Cell corner radius, a share of a cell. Default 0. */
  radius?: number;
  /** The share of filled cells left out, by the layer's seed (0–0.9). Default 0.12. */
  drop?: number;
  /** Default the palette's accent. */
  color?: Color;
  /** A small asterisk or dot in one empty cell beside the mark. */
  accent?: 'asterisk' | 'dot' | false;
  /** Default `color`. */
  accentColor?: Color;
}

/** Draw a mark as a mosaic of square cells. */
export function mosaic(layer: MosaicLayer, ctx: RenderContext): Markup;
/** The mosaic's grid over a mark: `cells` across its longest side, centred on its bounds. */
export function mosaicGrid(geo: MarkGeometry, cells?: number): PixelGrid;
