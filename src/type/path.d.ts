// Paths for text.
import type { Length } from '../index.js';

/** A path for text: an arc, circle, ellipse or wave, or any path data. */
export type TextPath = string | { d: string } | {
  kind?: 'circle' | 'arc' | 'ellipse' | 'wave';
  cx?: Length | `${number}%`; cy?: Length | `${number}%`; r?: Length; rx?: Length; ry?: Length;
  /** Degrees, 0 at 12 o'clock, clockwise. */
  start?: number; end?: number;
  direction?: 'cw' | 'ccw'; side?: 'outside' | 'inside';
  x1?: Length; x2?: Length; y?: Length; amplitude?: Length; wavelength?: Length; phase?: number;
};


/** A text path as path data, px. */
export function textPathD(p: TextPath, canvas: { width: number; height: number }): string;
/** A sampler along path data: point and unit tangent at a distance (continuing straight past the ends). */
export function pathSampler(d: string): { length: number; at: (s: number) => { x: number; y: number; tx: number; ty: number } };
