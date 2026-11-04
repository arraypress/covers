// Scaling what a render reports.
import type { DrawnText, DrawnImage } from './context.js';

/** A report hook for a stack drawn `k` times larger (text sizes become canvas px). */
export function scaledReport(report: ((e: DrawnText | DrawnImage) => void) | undefined, k: number): ((e: DrawnText | DrawnImage) => void) | undefined;
