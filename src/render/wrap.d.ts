// The options every layer takes on top of its own.
import type { Layer, Cover } from '../index.js';
import type { RenderContext, Markup } from './context.js';

/** Options handled for every layer type. */
export const WRAP_KEYS: readonly ('effects' | 'mask' | 'knockout' | 'clip' | 'area')[];
/** Case keywords (a text layer's `transform` is its case when it's one of these). */
export const CASES: ReadonlySet<string>;
/** Whether a layer uses any of them (1.0 layers take the 1.0 path). */
export function wrapped(layer: Layer): boolean;
/** Draw a layer with its area, effects, transform and masks; blend and opacity outermost. */
export function renderWrapped(layer: Layer, ctx: RenderContext, scope: { c: Cover }, renderOne: (layer: Layer, ctx: RenderContext) => Promise<Markup>): Promise<Markup>;
/** A layer's effects, then its masks, round its markup (in `ctx`'s units: a group's grid inside a group). */
export function decorate(m: Markup, layer: Layer, ctx: RenderContext): Promise<Markup>;
