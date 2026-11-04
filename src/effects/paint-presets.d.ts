// Named paints: chrome, steel and gold, painted as a reflected horizon.
import type { GradientPaint } from './paint.js';
import type { Color, Length } from '../index.js';

/** Paint presets, by name. */
export const PRESETS: Readonly<Record<'chrome' | 'steel' | 'gold', Readonly<GradientPaint>>>;
/** The keyline metal paints bring: a thin light edge, then a dark one. */
export const KEYLINE: readonly { readonly color: Color; readonly width: Length }[];
/** The keyline a fill brings with it (a preset's, unless `keyline: false`). */
export function presetStrokes(fill: unknown): { color: Color; width: Length }[] | undefined;
