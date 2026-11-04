// Graded presets.
import type { Effect } from './index.js';

/** Preset names: fade, crossProcess, bleachBypass, tealOrange, warmFilm, coolFilm, noir. */
export const LOOK_NAMES: readonly LookName[];
/** A look's name. */
export type LookName = 'fade' | 'crossProcess' | 'bleachBypass' | 'tealOrange' | 'warmFilm' | 'coolFilm' | 'noir';
/** The `look` effect's filter primitives. */
export function look(fx: Extract<Effect, { kind: 'look' }>): string;
