// Die-cut outlines for print formats.

/** A die-cut: a plain trim, 3 mm corners, a circle, corners in mm, or a path drawn from its grid into the trim. */
export type Cut = 'rect' | 'rounded' | 'circle' | { radius: number } | { d: string; viewBox?: [number, number, number, number] };

/** One path segment, canvas px. */
export interface Segment { cmd: 'M' | 'L' | 'C' | 'Z'; pts: number[] }

/** The cut outline round a box (px per mm for corner radii; `outset` grows the radii with the box). */
export function cutPath(cut: Cut | undefined, box: { x: number; y: number; width: number; height: number }, mm: number, outset?: number): Segment[];
