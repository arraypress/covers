// `vary`: layer options drawn frame by frame and played as outline morphs.
import type { ResolvedMotion } from './timing.js';
import type { MotionScope } from './motion.js';

/** `vary`'s values at progress `p` (0–1), merged into the layer. */
export function varied<L>(layer: L, vary: Record<string, unknown>, p: number, ease: (x: number) => number): L;
/** A layer drawn with `vary`: the still, and when live each changing outline keyframed (`d: path()`). */
export function morph(layer: any, m: ResolvedMotion, o: MotionScope): Promise<{ defs: string; body: string }>;
