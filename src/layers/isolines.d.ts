// Isolines of a sampled field, and a mark's signed distance field.
import type { MarkGeometry } from './mark-geometry.js';

/** A signed distance field over a mark: positive outside, negative inside, mark units. */
export interface DistanceField {
  values: Float32Array;
  width: number;
  height: number;
  /** The mark point of the first sample. */
  x0: number;
  y0: number;
  /** Mark units between samples. */
  step: number;
}

/** A mark's signed distance field over its box plus `reach`, `samples` across its longest side (500); exact near `levels`, where lines will be traced. */
export function distanceField(geo: MarkGeometry, reach: number, levels?: number[], samples?: number): DistanceField;
/** Where a field (row by row, `w` × `h`) crosses `level`: polylines of `[column, row]`, closed ones ending on their first point. */
export function isolines(f: ArrayLike<number>, w: number, h: number, level: number): number[][][];
/** A polyline simplified within `tol` and smoothed (two rounds of Chaikin, corners rounded by at most `round`), as path data. */
export function smoothLine(pts: number[][], tol?: number, round?: number): string;
