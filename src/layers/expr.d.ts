// `{#…}` expressions for repeat instances.

/** Evaluate an expression over variables (no `eval`: a small parser). */
export function evaluate(src: string, vars: Record<string, number | string | boolean>): unknown;
/** A value with its `{#…}` expressions filled in (nested repeats left alone). */
export function fill<T>(v: T, vars: Record<string, number | string | boolean>): T;
