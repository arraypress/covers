// Content-hash cache keys.
import type { Cover, CoverOptions, RenderImageOptions } from '../index.js';

/** A stable cache key for a cover and its output options (40 hex characters). */
export function coverKey(input: CoverOptions | Cover, options?: RenderImageOptions): Promise<string>;
