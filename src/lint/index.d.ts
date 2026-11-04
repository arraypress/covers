// Release cover art checks.
import type { Cover, CoverOptions } from '../index.js';
export { imageSize } from './image-size.js';

/** A problem `lint` found. */
export interface LintIssue {
  rule: 'aspect' | 'resolution' | 'url' | 'handle' | 'contact' | 'price' | 'promo' | 'platform' | 'date' | 'physical' | 'legibility' | 'metadata' | 'barcode' | 'upscaled';
  severity: 'error' | 'warning';
  message: string;
  layer?: string;
  text?: string;
}


/** Check a cover against Spotify's artwork requirements and distributors' content rules. */
export function lint(input: CoverOptions | Cover, options?: { target?: 'spotify' | 'release'; artist?: string; title?: string; size?: number }): Promise<{ ok: boolean; target: string; issues: LintIssue[] }>;
