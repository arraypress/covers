// The built-in 5×7 pixel face.
import type { LoadedFont } from '../fonts.js';

/** The pixel face (`font: 'pixel'`): A–Z, 0–9 and basic punctuation, as merged cell paths. */
export function pixelFace(): LoadedFont;
/** The characters it draws (lowercase is drawn as capitals). */
export const PIXEL_CHARS: string;
/** A glyph's 5×7 bitmap (35 cells row by row, `#` inked), or undefined. */
export function pixelBitmap(ch: string): string | undefined;
