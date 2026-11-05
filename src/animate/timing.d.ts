// Motion timing: presets, defaults, easing, and where a motion is at any time (CSS semantics).
import type { Motion, MotionPreset } from './motion.js';

/** An easing: CSS's named curves (`in`, `out`, `inOut` are ease-in, ease-out, ease-in-out), a hold (`step`), or a cubic Bézier. */
export type Easing = 'linear' | 'ease' | 'in' | 'out' | 'inOut' | 'step' | [number, number, number, number];

/** A motion with its preset expanded and every timing option filled in. */
export interface ResolvedMotion extends Omit<Motion, 'iterations'> {
  duration: number;
  delay: number;
  easing: Easing;
  direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';
  /** `Infinity` for `'infinite'`. */
  iterations: number;
}

/** Named motions: each is a motion's defaults. */
export const MOTION_PRESETS: Readonly<Record<MotionPreset, Readonly<Motion>>>;
/** A layer's `motion` as resolved motions (presets expanded, defaults filled in); throws on an unknown preset, direction or easing. */
export function motionList(v: unknown): ResolvedMotion[];
/** An easing as a function on 0–1. */
export function easing(e: Easing): (x: number) => number;
/** An easing as CSS writes it. */
export function cssEasing(e: Easing): string;
/** How far through its stops a motion is at `t` seconds (0–1, direction applied; `animation-fill-mode: both`). */
export function progress(m: ResolvedMotion, t: number): number;
/** A motion's CSS `animation` timing (everything but the name); `linear` when its stops were sampled eased. */
export function cssTiming(m: ResolvedMotion, o?: { linear?: boolean; delay?: number }): string;
