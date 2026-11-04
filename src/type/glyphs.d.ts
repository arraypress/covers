// Per-glyph control.
import type { Shaped } from '../text.js';
import type { Length, Color } from '../index.js';

/** Per-glyph scale, shift, turn and colour (arrays cycle; counted across the block, spaces skipped). */
export interface GlyphControl {
  scale?: number | number[];
  scaleX?: number | number[];
  scaleY?: number | number[];
  dx?: Length | Length[];
  dy?: Length | Length[];
  /** Degrees. */
  rotate?: number | number[];
  color?: Color | Color[];
  /** Transforms about the glyph's middle (default) or its baseline. */
  origin?: 'center' | 'baseline';
  /** A scaled glyph takes its scaled width (default true). */
  advance?: boolean;
}

/** Apply per-glyph control to a shaped line (`start`: the line's first glyph's index in the block). */
export function controlGlyphs(run: Shaped, spec: GlyphControl | undefined, o: { start: number; size: number; capHeight: number; canvas: { width: number; height: number }; text: string }): { run: Shaped; count: number };
/** How many glyphs a line counts (non-space characters). */
export function glyphCount(text: string): number;
