// Film grain, paper, dust and scratches.
import type { Effect } from './index.js';
import type { RenderContext } from '../render/context.js';
import type { Pixels } from './buffer.js';

/** The `grain` effect's filter primitives. */
export function grain(fx: Extract<Effect, { kind: 'grain' }>, ctx: RenderContext): string;
/** The `paper` effect's filter primitives. */
export function paper(fx: Extract<Effect, { kind: 'paper' }>, ctx: RenderContext): string;
/** `dust`, on pixels. */
export function dust(img: Pixels, fx: Extract<Effect, { kind: 'dust' }>, ctx: object): Uint8ClampedArray;
