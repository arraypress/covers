// Tile paints.
import type { TilePaint } from './index.js';

/** Tile kinds. */
export const TILES: readonly ('checker' | 'stripes' | 'dots' | 'grid' | 'custom')[];
/** A tile paint as a `<pattern>` and its fill value. */
export function tile(v: TilePaint, o: { id: string; box: { x: number; y: number; width: number; height: number }; canvas: { width: number; height: number } }): { defs: string; value: string };
