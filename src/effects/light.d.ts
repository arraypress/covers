// Blur, shadow, glow and die-cut borders.
import type { Effect } from './index.js';
import type { RenderContext } from '../render/context.js';

/** The `blur` effect's filter primitives. */
export function blur(fx: Extract<Effect, { kind: 'blur' }>, ctx: RenderContext): string;
/** The `shadow | glow` effect's filter primitives. */
export function shadow(fx: Extract<Effect, { kind: 'shadow' | 'glow' }>, ctx: RenderContext): string;
/** The `border` effect's filter primitives. */
export function border(fx: Extract<Effect, { kind: 'border' }>, ctx: RenderContext): string;
