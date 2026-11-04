/**
 * Poster typesetting: what the `text` layer does with its 1.1 options, and
 * the line-setting the poster layers (tables, barcodes) share.
 *
 * @module type
 */

export { typeset, wantsType, TYPE_OPTIONS } from './typeset.js';
export { faceFor, mappedPath, setLine } from './line.js';
export { textPathD, pathSampler } from './path.js';
