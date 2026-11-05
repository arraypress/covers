// `marquee`: text on a path running along it.
import type { ResolvedMotion } from './timing.js';
import type { Sheet } from './sheet.js';

/** The motion, as the text layer gets it. */
export interface MarqueeMotion extends ResolvedMotion {
  /** Playing (CSS), or a still. */
  live: boolean;
  /** The still's time, seconds (none: at rest). */
  t?: number;
  sheet?: Sheet;
}

/** Text laid out on its path. */
export interface MarqueeText {
  /** The shaped line (`glyphs[i].x` from its start). */
  run: { glyphs: { gid: number; x: number; face?: unknown; paint?: string }[] };
  /** Each glyph's middle, from the line's start. */
  mids: number[];
  /** Where the line starts along the path, px. */
  start: number;
  sampler: { length: number; at(s: number): { x: number; y: number; tx: number; ty: number } };
  /** The layer's id in the document (names the glyphs' defs). */
  id: string;
  /** Glyph `i` drawn in its own frame: its middle on the baseline at 0, 0. */
  glyph(i: number): string;
}

/** The marquee's part: `shift` (px) to move a still's start by, or (playing) the glyphs' defs and copies. */
export function marquee(m: MarqueeMotion, o: MarqueeText): { shift: number; defs: string; body?: string };
