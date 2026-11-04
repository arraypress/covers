// The named formats, as data.

/** Where a platform crops or covers an image, px of the canvas. */
export interface Zones {
  /** `[x, y, w, h]`: anchored text and icons are laid out inside it. */
  safe: [number, number, number, number];
  avoid?: { name: string; rect?: [number, number, number, number]; circle?: [number, number, number] }[];
  crops?: { name: string; rect: [number, number, number, number] }[];
  /** Where the numbers come from. */
  source?: string;
}


/** The named formats. */
export type FormatName =
  | 'release' | 'spotify-canvas' | 'bandcamp-header'
  | 'instagram-post' | 'instagram-square' | 'instagram-story' | 'instagram-reel' | 'youtube-thumbnail' | 'youtube-banner' | 'og'
  | 'avatar' | 'x-avatar' | 'youtube-avatar' | 'x-header' | 'linkedin-banner' | 'linkedin-company' | 'facebook-cover'
  | 'twitch-banner' | 'discord-banner' | 'discord-profile' | 'bluesky-banner' | 'pinterest' | 'tiktok-cover'
  | 'flyer' | 'a6' | 'a5' | 'a4' | 'a3' | 'a2'
  | 'business-card' | 'business-card-us' | 'letterhead' | 'letterhead-us' | 'compliment-slip'
  | 'sticker' | 'sticker-square' | 'ticket' | 'badge' | 'lanyard-pass';


/** A format: a size in a unit, with print defaults or safe zones. */
export interface Format {
  width: number;
  height: number;
  unit: 'px' | 'mm' | 'in';
  label: string;
  bleed?: number;
  safe?: number;
  cut?: import('./cut.js').Cut;
  zones?: Zones;
}


/** The named formats. */
export const FORMATS: Readonly<Record<FormatName, Readonly<Format>>>;
/** The zones of a circle-cropped avatar of side `n`. */
export function avatarZones(n: number): Zones;
