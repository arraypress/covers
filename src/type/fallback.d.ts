// Glyph fallback.
import type { LoadedFont } from '../fonts.js';
import type { Shaped } from '../text.js';
import type { RenderContext } from '../render/context.js';

/** The faces to fall back to: the layer's `fallback`, fonts registered with `fallback: true`, then the built-in symbols. */
export function fallbackFaces(ctx: RenderContext, o: { fallback?: string | string[]; weight?: number; style?: string }): Promise<LoadedFont[]>;
/** Whether a face has a glyph for a character. */
export function covers(face: LoadedFont, ch: string): boolean;
/** Shape a line, falling back face by face where the face lacks a glyph. */
export function shapeText(face: LoadedFont, text: string, size: number, tracking: number, fallbacks?: LoadedFont[]): Shaped;
