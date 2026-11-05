// A motion's transform and opacity as tracks of stops.
import type { ResolvedMotion } from './timing.js';

/** One animated property: its stops (evenly spaced in time) and how a value is written. */
export interface Track<T = any> {
  stops: T[];
  /** Stops sampled along a path with the easing applied (CSS plays them linearly). */
  sampled?: boolean;
  /** A value as a CSS declaration, for keyframes. */
  css(v: T): string;
  /** A value as SVG attributes, for the still (`null` when it's the layer at rest). */
  attr(v: T): Record<string, string> | null;
}

/** A value at progress `p` (0–1) through evenly spaced stops, eased between each pair. */
export function atStops<T>(stops: T[], p: number, ease: (x: number) => number): T;
/** A motion's tracks, outermost first: translate (or path), rotate, scale, opacity. */
export function tracks(m: ResolvedMotion, canvas: { width: number; height: number }): Track[];
