// The `group` layer.
import type { Length, Layer, BaseLayer, Anchor } from '../index.js';
import type { RenderContext, Markup } from './context.js';

/** `group`: a stack drawn as one, on its own design grid. */
export interface GroupLayer extends BaseLayer {
  type: 'group';
  layers: Layer[];
  /** The children's coordinate grid, e.g. `[0, 0, 400, 500]`. */
  viewBox?: [number, number, number, number];
  x?: Length | `${number}%`; y?: Length | `${number}%`; width?: Length | `${number}%`; height?: Length | `${number}%`;
  /** Default `'contain'`. */
  fit?: 'contain' | 'cover' | 'stretch' | 'width' | 'height';
  /** Where a fitted grid sits. Default `'center'`. */
  align?: Anchor;
  clipToBox?: boolean;
}


/** Draw a group: its stack on its grid, fitted into its box. */
export function renderGroup(layer: GroupLayer, ctx: RenderContext, decorate?: (m: Markup, gctx: RenderContext) => Promise<Markup>): Promise<Markup>;
/** An anchor as fractions `[x, y]` of the free space. */
export function alignOf(a?: string): [number, number];
