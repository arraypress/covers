// Making filters cheap for librsvg without changing what they draw.

/** Split each `feMorphology` into an x pass and a y pass (identical output, O(r) not O(r²)). */
export function separableMorphology(markup: string): string;
/** Whether a chain of primitives only paints where its source does. */
export function bounded(markup: string): boolean;
/** How far filter primitives reach from what they read, in their units (an overestimate). */
export function filterReach(markup: string): number;
