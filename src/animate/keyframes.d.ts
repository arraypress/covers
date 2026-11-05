// Keyframes against time, for frames drawn one at a time.

/** A keyframed value. */
export interface Keyframes<T = unknown> {
  /** `[t, value]` pairs (seconds), or `{ t, value, ease }`. */
  keyframes: ([number, T] | [number, T, Ease] | { t: number; value: T; ease?: Ease })[];
  ease?: Ease;
  /** Repeat over the cover's `loop` (or the last key); `'pingpong'` goes back and forth. */
  loop?: boolean | 'pingpong';
}
/** Easing curves. */
export type Ease = 'linear' | 'in' | 'out' | 'inOut' | 'step';

/** Whether a value has keyframes anywhere in it. */
export function isAnimated(v: unknown): boolean;
/** A keyframed value at time `t` (seconds). */
export function valueAt<T>(k: Keyframes<T>, t: number, duration?: number): T;
/** A value with every keyframed part resolved at `t`. */
export function animate<T>(v: T, t: number, duration?: number): T;
/** Two values `f` (0–1) of the way between them: numbers, colours (OKLab), same-unit lengths, arrays and objects of them. */
export function interpolate<T>(a: T, b: T, f: number): T;
