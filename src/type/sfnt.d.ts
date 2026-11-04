// A small TrueType reader.

/** A parsed TrueType face. */
export interface JsFace {
  kind: 'js';
  upem: number;
  ascender: number;
  descender: number;
  capHeight: number;
  /** A glyph's outline, font units, y up. */
  glyphToPath: (gid: number) => string;
  /** Glyphs with kerned advances, font units. */
  shape: (text: string) => { gid: number; cluster: number; advance: number }[];
  /** Variation axes (fvar). */
  axes: Record<string, { min: number; default: number; max: number }>;
  family: string;
}

/** Parse a TrueType font (sfnt bytes; not CFF). */
export function parseSfnt(bytes: Uint8Array): JsFace;
