// Safe zones.
import type { Zones } from './presets.js';
import type { PrintInfo } from './print.js';

/** A preview overlay of the zones: safe area dashed green, covered areas red, crops blue. */
export function zonesOverlay(z: Zones, w: number, h: number): string;
/** Zones scaled by `k`. */
export function scaleZones(z: Zones, k: number): Zones;
/** A cover's safe box, px. */
export function safeBox(c: { width: number; height: number; print?: PrintInfo; zones?: Zones }): { x: number; y: number; width: number; height: number } | undefined;
