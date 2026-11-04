/**
 * What a render reports for `lint`, scaled to canvas px.
 *
 * @module render/report
 */

/**
 * A report hook for a stack drawn `k` times larger: text sizes become
 * canvas px (the box is dropped, being in the stack's own units). Other
 * entries carry their own scale and pass through.
 *
 * @param {((e: any) => void) | undefined} report
 * @param {number} k
 * @returns {((e: any) => void) | undefined}
 */
export function scaledReport(report, k) {
  if (!report || k === 1) return report;
  return (e) => report(e.kind === 'text' ? { ...e, size: e.size * k, capHeight: e.capHeight * k, box: null } : e);
}
