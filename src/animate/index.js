/**
 * Animation: `motion` plays in the SVG itself (CSS keyframes, no script);
 * keyframes draw one frame at a time (`renderSvg(cover, { t })`).
 *
 * @module animate
 */

export { renderMotion } from './motion.js';
export { motionList, progress, easing, MOTION_PRESETS } from './timing.js';
export { createSheet, nameSheet } from './sheet.js';
export { animate, isAnimated, valueAt, interpolate } from './keyframes.js';
