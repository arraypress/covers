// `motion`: a layer moving in the SVG itself, as CSS keyframes.
import type { Length, TextPath } from '../index.js';
import type { Easing } from './timing.js';
import type { Sheet } from './sheet.js';

/** A coordinate: px, `'%'` of the layer's grid, or a length. */
type Coordinate = Length | `${number}%`;

/** A named motion. */
export type MotionPreset = 'drift' | 'spin' | 'breathe' | 'blink' | 'marquee';

/** One motion on a layer. A single value moves from the layer at rest to it; a list is stops, evenly spaced in time. */
export interface Motion {
  /** Start from a preset's defaults. */
  preset?: MotionPreset;
  /** `[x, y]` to move by (px in the layer's grid, `'%'` of it, or lengths), or points to visit. */
  translate?: [Coordinate, Coordinate] | [Coordinate, Coordinate][];
  /** Travel a path from where the layer is (the easing spans the whole path). */
  path?: string | TextPath;
  /** Degrees to turn to, or a list of angles. */
  rotate?: number | number[];
  /** A factor to grow to, or a list (about `origin`). */
  scale?: number | number[];
  scaleX?: number | number[];
  scaleY?: number | number[];
  /** 0–1 to fade to (times the layer's own opacity), or a list. */
  opacity?: number | number[];
  /** What turns and scales are about: `[x, y]` (px, `'%'` or lengths). Default the centre. */
  origin?: [Coordinate, Coordinate] | { x?: Coordinate; y?: Coordinate } | 'center';
  /** Layer options as lists of stops (`{ axes: { wdth: [62, 150] } }`), drawn frame by frame and played as outline morphs. */
  vary?: Record<string, unknown>;
  /** `vary`: frames drawn per stop. Default 12. */
  frames?: number;
  /** Text on a path runs along it, one repeat of its words per `duration` (the words must repeat). */
  marquee?: boolean;
  /** Seconds per iteration. Default 2 (or the preset's). */
  duration?: number;
  /** Seconds before it starts; negative starts it part-way. */
  delay?: number;
  /** Between each pair of stops. Default `'linear'`. */
  easing?: Easing;
  direction?: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  /** Default `'infinite'`. */
  iterations?: number | 'infinite';
}

/** How a layer with motion is being drawn. */
export interface MotionScope {
  /** Playing: CSS keyframes into `sheet`. */
  live: boolean;
  /** The still's time, seconds (none: at rest). */
  t?: number;
  sheet?: Sheet;
  /** The layer drawn with its stream from the start (`extra` joins its context). */
  draw(layer: any, extra?: Record<string, unknown>): Promise<{ defs: string; body: string }>;
}

/** A layer with its motion: the still (at `t`, or at rest) and, live, the keyframes that play it. */
export function renderMotion(layer: any, ctx: { canvas: { width: number; height: number } }, o: MotionScope): Promise<{ defs: string; body: string }>;
