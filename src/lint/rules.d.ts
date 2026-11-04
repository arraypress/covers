// The text rules lint applies.
import type { LintIssue } from './index.js';

/** `[rule, severity, pattern, what it is]`. */
export const RULES: readonly [LintIssue['rule'], LintIssue['severity'], RegExp, string][];
