// The built-in 5×7 pixel face.
import type { LoadedFont } from '../fonts.js';

/** The pixel face (`font: 'pixel'`): A–Z, 0–9 and basic punctuation, as merged cell paths. */
export function pixelFace(): LoadedFont;
/** The characters it draws (lowercase is drawn as capitals). */
export const PIXEL_CHARS: string;
