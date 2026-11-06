// A mark's construction, read from its paths.

/** A circle the mark's curves are drawn on. */
export interface GuideCircle {
  cx: number;
  cy: number;
  r: number;
  /** How much of it the mark draws, radians. */
  sweep: number;
}

/** A line the mark's straight edges lie on. */
export interface GuideLine {
  /** Radians, 0–π. */
  angle: number;
  /** A point on it. */
  x: number;
  y: number;
  /** The mark's edges on it, in total. */
  length: number;
}

/** A mark's construction, in its own (512 grid) units. */
export interface MarkGuides {
  /** Its real bounds. */
  box: { x: number; y: number; width: number; height: number };
  /** The radius of the circle in its box. */
  inscribed: number;
  /** The radius of the circle round its outline, from the box's centre. */
  circumscribed: number;
  /** Its curves' circles, the most drawn first. */
  circles: GuideCircle[];
  /** Its straight edges' lines, the longest first. */
  lines: GuideLine[];
}

/** Read a mark's construction (null when it draws nothing); at most `circles` and `lines` of each (6). */
export function markGuides(markup: string, options?: { circles?: number; lines?: number }): MarkGuides | null;
