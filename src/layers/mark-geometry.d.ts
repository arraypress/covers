// A mark's geometry from its markup, read with @logomarks/core.
import type { FillPath } from '@logomarks/core/raster';

/** A mark read from its paths. */
export interface MarkGeometry {
  /** Its filled paths as rings, with their fill rules. */
  paths: FillPath[];
  /** Its real bounds, grid units. */
  box: { x: number; y: number; width: number; height: number };
  /** The share of its box it inks, 0–1. */
  density: number;
}

/** Read a mark (paths on a 512 grid); null when it draws nothing. */
export function markGeometry(markup: string): MarkGeometry | null;
