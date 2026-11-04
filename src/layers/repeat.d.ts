// The `repeat` layer.
import type { Length, Layer, BaseLayer } from '../index.js';

/** `repeat`: a layer drawn many times (a grid, a ring, a line), with per-instance `{#…}` values. */
export interface RepeatLayer extends BaseLayer {
  type: 'repeat';
  /** The template (or `layers`, drawn as a group). */
  layer?: Layer;
  layers?: Layer[];
  rows?: number; cols?: number;
  count?: number;
  /** `[dx, dy]` between instances (a grid's default divides the canvas). */
  step?: [Length, Length];
  x?: Length | `${number}%`; y?: Length | `${number}%`;
  cx?: Length | `${number}%`; cy?: Length | `${number}%`; radius?: Length;
  /** Degrees, 0 up, clockwise. */
  start?: number; sweep?: number;
  /** Turn each ring instance to its angle (default true). */
  turn?: boolean;
  /** Overrides for odd instances (a checkerboard on a grid). */
  odd?: Record<string, unknown>;
  /** Overrides taken in turn. */
  cycle?: Record<string, unknown>[];
  /** An expression (`{#…}`) that leaves an instance out when true. */
  skip?: string;
}

/** The instances of a repeat, as a group of placed copies. */
export function expandRepeat(layer: RepeatLayer, ctx: { width: number; height: number; canvas: { width: number; height: number } }): Layer;
