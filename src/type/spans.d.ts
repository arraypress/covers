// Mixed runs in one text layer.
import type { LoadedFont } from '../fonts.js';
import type { Shaped } from '../text.js';
import type { RenderContext } from '../render/context.js';
import type { Length, Color } from '../index.js';

/** A span as written in a text layer's `spans`. */
export interface TextSpan {
  content: string;
  font?: string; weight?: number; style?: 'normal' | 'italic'; axes?: Record<string, number>;
  /** Size relative to the layer's (default 1). */
  scale?: number;
  /** Size outright. */
  size?: Length;
  color?: Color; fill?: Color;
  /** Em. */
  letterSpacing?: number;
  /** Baseline shift (down is positive). */
  dy?: Length;
  transform?: 'uppercase' | 'lowercase' | 'none';
}

/** A resolved span. */
export interface Span { text: string; face: LoadedFont; scale: number; tracking: number; paint: string | undefined; dy: number }

/** Resolve a layer's spans (faces loaded, sizes relative to `size`). */
export function loadSpans(layer: { spans: (TextSpan | string)[]; font?: string; weight?: number; style?: string; axes?: Record<string, number>; letterSpacing?: number; transform?: string }, ctx: RenderContext, size: number): Promise<Span[]>;
/** Spans as lines (split at `\n`, wrapped at `maxWidth`). */
export function spanLines(spans: Span[], size: number, maxWidth: number, fallbacks: LoadedFont[]): Span[][];
/** Shape a line of spans as one run. */
export function shapeSpans(line: Span[], size: number, extra: number, base: LoadedFont | undefined, fallbacks: LoadedFont[]): Shaped;
/** A line's text. */
export function spanText(line: Span[]): string;
