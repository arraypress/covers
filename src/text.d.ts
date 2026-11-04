// Text: shaping, line breaking and outline drawing.
import type { LoadedFont } from './fonts.js';

/** A shaped run: glyph ids and pen positions, px. */
export interface Shaped {
  /** Pen positions, px. A glyph from another face (fallback, a span) carries it, its own size, a paint key and a transform. */
  glyphs: { gid: number; x: number; y: number; cluster?: number; face?: LoadedFont; size?: number; paint?: string; t?: [number, number, number, number, number, number] }[];
  /** Advance width, px. */
  width: number;
}

/** Laid-out text. */
export interface Layout {
  lines: { text: string; run: Shaped }[];
  size: number;
  truncated: boolean;
  width: number;
}

/** Shape one line at a size with letter-spacing (px between clusters). */
export function shape(face: LoadedFont, text: string, size: number, tracking: number, hb?: unknown): Shaped;
/** A glyph's outline as parsed commands, font units (cached on the face). */
export function outline(face: LoadedFont, gid: number): (string | number)[];
/** Shaped glyphs as SVG path data, px. */
export function runPath(face: LoadedFont, run: Shaped, size: number, x: number, baseline: number): string;
/** Break text into lines: greedy, optionally balanced, shrinking toward `minSize`, truncated past `maxLines`. */
export function layout(o: { face: LoadedFont; hb?: unknown; text: string; size: number; minSize?: number; letterSpacing?: number; maxWidth?: number; maxLines?: number; ellipsis?: string; balance?: boolean }): Layout;
/** Collapse spaces, trim lines and apply a case. */
export function caseText(s: string, t: string | undefined): string;
