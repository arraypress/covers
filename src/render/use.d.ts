// Reusable stacks: `defs` and `use`.
import type { Layer, BaseLayer, Length } from '../index.js';
import type { LayerTransform } from '../effects/transform.js';
import type { RenderContext, Markup } from './context.js';

/** `defs`: named layers (each with an `id`) that `use` draws; nothing is drawn here. */
export interface DefsLayer extends BaseLayer { type: 'defs'; layers: Layer[] }

/** `use`: a named layer drawn again, placed. */
export interface UseLayer extends BaseLayer {
  type: 'use';
  /** The `id` of a layer in an earlier `defs`. */
  ref: string;
  x?: Length | `${number}%`; y?: Length | `${number}%`;
  /** Degrees, about the copy's origin. */
  rotate?: number;
  scale?: number | [number, number];
  /** A transform instead of x, y, rotate and scale. */
  place?: LayerTransform | string;
  /** Options for this copy only (drawn on its own). */
  with?: Record<string, unknown>;
}

/** Register a defs layer's named layers. */
export function registerDefs(layer: DefsLayer, ctx: RenderContext): Markup;
/** Draw a named layer, placed. */
export function renderUse(layer: UseLayer, ctx: RenderContext): Promise<Markup>;
