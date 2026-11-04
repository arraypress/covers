/**
 * The named formats, as data: release covers, social posts and banners
 * with their safe zones, flyers and posters, and print stationery.
 *
 * Zone figures are official where a platform publishes them (YouTube Help,
 * Meta, LinkedIn); otherwise they're community measurements, and each
 * format's `zones.source` says which.
 *
 * @module formats/presets
 */

/**
 * @typedef {object} Format
 * @property {number} width - In `unit`.
 * @property {number} height - In `unit`.
 * @property {'px' | 'mm' | 'in'} unit
 * @property {string} label - What it is.
 * @property {number} [bleed] - Default bleed, in mm (print).
 * @property {number} [safe] - Default safe margin inside the trim, in mm (print).
 * @property {string} [cut] - A die-cut shape: `'circle'` or `'rounded'`.
 * @property {import('./index.js').Zones} [zones] - Where the platform crops or covers the image (screen formats, px).
 */

/**
 * Safe zones, in px of the format's canvas.
 *
 * @typedef {object} Zones
 * @property {[number, number, number, number]} safe - `[x, y, w, h]`: where type and marks are seen on every device; anchored text and icons are laid out inside it.
 * @property {{ name: string, rect?: [number, number, number, number], circle?: [number, number, number] }[]} [avoid] - Areas covered by the platform's UI or the avatar.
 * @property {{ name: string, rect: [number, number, number, number] }[]} [crops] - What one device shows.
 * @property {string} source - Where the numbers come from (official, or a community measurement).
 */

/** A circle crop: the visible circle and the square inside it (with a little air). @param {number} n @returns {import('./index.js').Zones} */
export const avatarZones = (n) => {
  const side = Math.round((n / Math.SQRT2) * 0.94);
  const o = Math.round((n - side) / 2);
  return { safe: [o, o, side, side], avoid: [], crops: [{ name: 'circle', rect: [0, 0, n, n] }], source: 'Every listed platform crops avatars to a circle (X, Instagram, Threads, LinkedIn, YouTube, TikTok, Bluesky); the safe square is the one inscribed in it.' };
};

/** @type {Readonly<Record<string, Readonly<Format>>>} */
export const FORMATS = Object.freeze({
  // Release and streaming
  release: { width: 3000, height: 3000, unit: 'px', label: 'Release cover art (Spotify, Apple Music, Bandcamp; 3000×3000)' },
  'spotify-canvas': { width: 1080, height: 1920, unit: 'px', label: 'Spotify Canvas (9:16; a still frame or the poster for one)', zones: { safe: [60, 320, 960, 1040], avoid: [{ name: 'track info and controls', rect: [0, 1360, 1080, 560] }, { name: 'header', rect: [0, 0, 1080, 320] }], source: 'Spotify asks that Canvas carries no text and keeps its focus central; the player UI covers the bottom third (measured).' } },
  'bandcamp-header': { width: 975, height: 180, unit: 'px', label: 'Bandcamp custom header (975 wide, 40–180 tall)' },
  // Social
  'instagram-post': { width: 1080, height: 1350, unit: 'px', label: 'Instagram post, 4:5 (1080×1350)', zones: { safe: [54, 135, 972, 1080], crops: [{ name: 'profile grid (3:4)', rect: [0, 0, 1080, 1350] }, { name: 'square', rect: [0, 135, 1080, 1080] }], source: '1080×1350 is Instagram\'s portrait size; older grid and some previews crop to the central square, so key type stays in it.' } },
  'instagram-square': { width: 1080, height: 1080, unit: 'px', label: 'Instagram post, 1:1 (1080×1080)', zones: { safe: [54, 54, 972, 972], source: '1080×1080 is Instagram\'s square size.' } },
  'instagram-story': { width: 1080, height: 1920, unit: 'px', label: 'Instagram story, 9:16 (1080×1920)', zones: { safe: [65, 250, 950, 1420], avoid: [{ name: 'profile and progress', rect: [0, 0, 1080, 250] }, { name: 'reply bar', rect: [0, 1670, 1080, 250] }], source: 'Meta: keep about 14% (250 px) at the top and bottom of a story free of text and logos.' } },
  'instagram-reel': { width: 1080, height: 1920, unit: 'px', label: 'Instagram reel or reel cover, 9:16 (1080×1920)', zones: { safe: [65, 269, 950, 979], avoid: [{ name: 'top UI', rect: [0, 0, 1080, 269] }, { name: 'caption and buttons', rect: [0, 1248, 1080, 672] }, { name: 'action buttons', rect: [1015, 900, 65, 1020] }], crops: [{ name: 'profile grid (3:4)', rect: [0, 240, 1080, 1440] }], source: 'Meta: keep 14% at the top, 35% at the bottom and 6% at the sides of a reel free of text and logos.' } },
  'youtube-thumbnail': { width: 1280, height: 720, unit: 'px', label: 'YouTube thumbnail, 16:9 (1280×720)', zones: { safe: [64, 48, 1152, 600], avoid: [{ name: 'duration', rect: [1100, 640, 180, 80] }], source: 'YouTube Help: 1280×720 (16:9). The duration badge over the bottom right is measured.' } },
  og: { width: 1200, height: 630, unit: 'px', label: 'Open Graph card (link previews)', zones: { safe: [60, 40, 1080, 550], source: 'Open Graph cards show whole at 1.91:1; some clients crop to a square in the middle, so key type sits centrally.' } },
  // Avatars: every platform crops to a circle.
  avatar: { width: 1080, height: 1080, unit: 'px', label: 'Avatar, circle-cropped (X, Instagram, Threads, LinkedIn, YouTube, TikTok, Bluesky)', zones: avatarZones(1080) },
  'x-avatar': { width: 400, height: 400, unit: 'px', label: 'X profile photo (400×400, shown as a circle)', zones: avatarZones(400) },
  'youtube-avatar': { width: 800, height: 800, unit: 'px', label: 'YouTube profile picture (800×800, circle)', zones: avatarZones(800) },
  // Banners and headers
  'x-header': { width: 1500, height: 500, unit: 'px', label: 'X (Twitter) header (1500×500)', zones: { safe: [420, 60, 930, 380], avoid: [{ name: 'avatar', circle: [215, 470, 175] }], crops: [{ name: 'mobile', rect: [150, 50, 1200, 400] }], source: '1500×500 is X\'s upload size. The avatar overlapping the bottom left and the ~60 px trimmed top and bottom (and the narrower mobile view) are community measurements; X publishes no safe zone.' } },
  'linkedin-banner': { width: 1584, height: 396, unit: 'px', label: 'LinkedIn personal background (1584×396)', zones: { safe: [600, 40, 940, 316], avoid: [{ name: 'avatar', circle: [300, 380, 230] }], source: '1584×396 is LinkedIn\'s recommended size; the profile photo over the bottom left is measured from the desktop profile.' } },
  'linkedin-company': { width: 1128, height: 191, unit: 'px', label: 'LinkedIn company page cover (1128×191)', zones: { safe: [40, 24, 1048, 143], source: '1128×191 is LinkedIn\'s recommended size; the logo sits below the cover, not on it.' } },
  'youtube-banner': { width: 2560, height: 1440, unit: 'px', label: 'YouTube channel art (2560×1440; the 1546×423 centre shows on every device)', zones: { safe: [507, 508, 1546, 423], crops: [{ name: 'tv', rect: [0, 0, 2560, 1440] }, { name: 'desktop', rect: [0, 508, 2560, 423] }, { name: 'tablet', rect: [352, 508, 1855, 423] }, { name: 'mobile', rect: [507, 508, 1546, 423] }], source: 'YouTube Help: upload at least 2048×1152 and keep text and logos in the 1235×338 centre (scaled here to 2560×1440: 1546×423).' } },
  'facebook-cover': { width: 1640, height: 924, unit: 'px', label: 'Facebook page cover (16:9 upload: phones show it all, desktop a 2.63:1 band)', zones: { safe: [80, 150, 1480, 624], crops: [{ name: 'desktop', rect: [0, 150, 1640, 624] }, { name: 'mobile', rect: [0, 0, 1640, 924] }], avoid: [{ name: 'desktop profile picture', circle: [220, 774, 170] }], source: 'Meta Help: the cover shows at 820×312 on desktop and 640×360 on phones; this canvas is the 16:9 shape at 2×, with the desktop band in the middle.' } },
  'twitch-banner': { width: 1200, height: 480, unit: 'px', label: 'Twitch profile banner (1200×480)', zones: { safe: [60, 40, 1080, 400], source: '1200×480 is Twitch\'s recommended size.' } },
  'discord-banner': { width: 960, height: 540, unit: 'px', label: 'Discord server banner (960×540)', zones: { safe: [48, 40, 864, 460], source: '960×540 (16:9) is Discord\'s recommended size.' } },
  'discord-profile': { width: 680, height: 240, unit: 'px', label: 'Discord profile banner (680×240)', zones: { safe: [34, 20, 612, 150], avoid: [{ name: 'avatar', circle: [110, 240, 80] }], source: '680×240 is Discord\'s recommended size; the avatar overlapping the bottom left is measured.' } },
  'bluesky-banner': { width: 3000, height: 1000, unit: 'px', label: 'Bluesky profile banner (3000×1000)', zones: { safe: [600, 80, 2250, 760], avoid: [{ name: 'avatar', circle: [330, 960, 300] }], source: '3000×1000 is Bluesky\'s banner size; the avatar over the bottom left is measured.' } },
  // Posts
  pinterest: { width: 1000, height: 1500, unit: 'px', label: 'Pinterest pin (2:3, 1000×1500)', zones: { safe: [60, 60, 880, 1300], avoid: [{ name: 'save button', rect: [780, 1360, 220, 140] }], source: 'Pinterest recommends 1000×1500 (2:3). The UI over the lower right is measured.' } },
  'tiktok-cover': { width: 1080, height: 1920, unit: 'px', label: 'TikTok video cover (1080×1920; the profile grid crops it to 3:4)', zones: { safe: [60, 240, 900, 1080], avoid: [{ name: 'top UI', rect: [0, 0, 1080, 240] }, { name: 'caption and sound', rect: [0, 1320, 1080, 600] }, { name: 'action buttons', rect: [960, 760, 120, 1160] }], crops: [{ name: 'profile grid', rect: [0, 240, 1080, 1440] }], source: 'TikTok publishes its safe zones as template files; these margins are the commonly measured ones (240 px top, ~600 px bottom, 120 px right), with the 3:4 grid crop.' } },
  // Flyers and posters
  flyer: { width: 1600, height: 2000, unit: 'px', label: 'Digital flyer, 4:5' },
  a6: { width: 105, height: 148, unit: 'mm', label: 'A6 flyer', bleed: 3, safe: 4 },
  a5: { width: 148, height: 210, unit: 'mm', label: 'A5 flyer', bleed: 3, safe: 5 },
  a4: { width: 210, height: 297, unit: 'mm', label: 'A4 flyer or poster', bleed: 3, safe: 5 },
  a3: { width: 297, height: 420, unit: 'mm', label: 'A3 poster', bleed: 3, safe: 8 },
  a2: { width: 420, height: 594, unit: 'mm', label: 'A2 poster', bleed: 3, safe: 10 },
  // Stationery
  'business-card': { width: 85, height: 55, unit: 'mm', label: 'Business card (85×55 mm)', bleed: 3, safe: 3 },
  'business-card-us': { width: 3.5, height: 2, unit: 'in', label: 'Business card (3.5×2 in)', bleed: 3, safe: 3 },
  letterhead: { width: 210, height: 297, unit: 'mm', label: 'Letterhead (A4)', bleed: 3, safe: 15 },
  'letterhead-us': { width: 8.5, height: 11, unit: 'in', label: 'Letterhead (US Letter)', bleed: 3, safe: 15 },
  'compliment-slip': { width: 210, height: 99, unit: 'mm', label: 'Compliment slip (⅓ A4)', bleed: 3, safe: 8 },
  sticker: { width: 60, height: 60, unit: 'mm', label: 'Sticker, die-cut round (60 mm)', bleed: 2, safe: 3, cut: 'circle' },
  'sticker-square': { width: 60, height: 60, unit: 'mm', label: 'Sticker, die-cut rounded square (60 mm)', bleed: 2, safe: 3, cut: 'rounded' },
  ticket: { width: 5.5, height: 2, unit: 'in', label: 'Event ticket (5.5×2 in), 3 mm corners', bleed: 3, safe: 3, cut: { radius: 3 } },
  badge: { width: 54, height: 85.6, unit: 'mm', label: 'ID badge, CR80 portrait (54×85.6 mm)', bleed: 2, safe: 3, cut: 'rounded' },
  'lanyard-pass': { width: 105, height: 148, unit: 'mm', label: 'Lanyard pass (A6 portrait), 4 mm corners', bleed: 3, safe: 5, cut: { radius: 4 } },
});
