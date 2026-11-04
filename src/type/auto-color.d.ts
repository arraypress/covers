// Auto contrast for `color: 'auto'`.
import type { RenderContext } from '../render/context.js';

/** Backdrop luma (0–1) above which `color: 'auto'` picks the dark colour (0.72). */
export const AUTO_THRESHOLD: number;
/** Rec. 601 luma of a colour, 0–1. */
export function luma(c: string): number;
/** White or near-black (or `autoColors`) by the luma of what's drawn under `box`. */
export function autoColor(layer: { autoColors?: [string, string]; autoThreshold?: number }, ctx: RenderContext, box: { x: number; y: number; width: number; height: number }): Promise<string>;
