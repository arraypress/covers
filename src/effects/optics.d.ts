// Light on the lens and the film.
import type { Effect } from './index.js';
import type { RenderContext } from '../render/context.js';

/** The `vignette` effect's filter primitives. */
export function vignette(fx: Extract<Effect, { kind: 'vignette' }>, ctx: RenderContext): string;
/** The `lightLeak` effect's filter primitives. */
export function lightLeak(fx: Extract<Effect, { kind: 'lightLeak' }>, ctx: RenderContext): string;
/** The `lensFlare` effect's filter primitives. */
export function lensFlare(fx: Extract<Effect, { kind: 'lensFlare' }>, ctx: RenderContext): string;
