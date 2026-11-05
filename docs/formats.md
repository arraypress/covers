# Formats, print and brand kits

## Formats

`format` sets the size from a name (`src/formats/presets.js`). Screen formats carry their **safe zone**: anchored text and icons are laid out inside it, recipes read it as `@safeX` `@safeY` `@safeWidth` `@safeHeight`, and `overlay: true` draws the zones (safe green, covered red, crops blue).

| Format | Size | Safe zone and where it comes from |
|---|---|---|
| `release` | 3000×3000 | Release cover art (Spotify, Apple Music, Bandcamp). See [lint](#lint). |
| `spotify-canvas` | 1080×1920 | Central; the player covers the bottom third (measured). Canvas should carry no text. |
| `bandcamp-header` | 975×180 | Bandcamp's custom header width (40–180 tall). |
| `instagram-post` | 1080×1350 | The central square (some previews crop to it). |
| `instagram-square` | 1080×1080 | |
| `instagram-story` | 1080×1920 | Meta: keep ~14% (250 px) top and bottom free of text and logos. |
| `instagram-reel` | 1080×1920 | Meta: 14% top, 35% bottom, 6% sides; the 3:4 grid crop. |
| `tiktok-cover` | 1080×1920 | Commonly measured margins (240 top, ~600 bottom, 120 right) and the 3:4 grid crop; TikTok publishes its zones only as template files. |
| `youtube-thumbnail` | 1280×720 | YouTube Help size; the duration badge bottom right. |
| `youtube-banner` | 2560×1440 | YouTube Help: keep text and logos in the centre 1235×338 of a 2048×1152 upload (1546×423 here); TV, desktop, tablet and mobile crops. |
| `x-header` | 1500×500 | The avatar over the bottom left; ~60 px trimmed top and bottom (community measurements; X publishes none). |
| `linkedin-banner`, `linkedin-company` | 1584×396, 1128×191 | LinkedIn's sizes; the profile photo over the banner's bottom left. |
| `facebook-cover` | 1640×924 | Meta Help: shows at 820×312 on desktop and 640×360 on phones; the desktop band in the middle, the profile picture bottom left. |
| `twitch-banner`, `discord-banner`, `discord-profile`, `bluesky-banner` | 1200×480, 960×540, 680×240, 3000×1000 | The platforms' recommended sizes; avatars over the profile banners. |
| `pinterest` | 1000×1500 | Pinterest's 2:3; the save button bottom right. |
| `avatar`, `x-avatar`, `youtube-avatar` | 1080², 400², 800² | Every platform crops avatars to a circle (X, Instagram, Threads, LinkedIn, YouTube, TikTok, Bluesky); the safe square is inscribed in it. |
| `og` | 1200×630 | |
| `flyer` | 1600×2000 | A digital 4:5 flyer. |
| `a6`, `a5`, `a4`, `a3`, `a2` | mm | Flyers and posters. |
| `business-card`, `business-card-us` | 85×55 mm, 3.5×2 in | |
| `letterhead`, `letterhead-us` | A4, US Letter | |
| `compliment-slip` | 210×99 mm | |
| `sticker`, `sticker-square` | 60 mm | Die-cut round, rounded square. |
| `ticket` | 5.5×2 in | |
| `badge`, `lanyard-pass` | 54×85.6 mm (CR80), A6 | |

A custom format is `{ width, height, unit: 'px' | 'mm' | 'in', bleed, safe, zones }`. A screen format given a `width` scales (its zones too).

### Print, pages

| Option | |
|---|---|
| `dpi` | 300. Print sizes are trim sizes in mm or inches. |
| `bleed`, `safe` | mm (default per format, bleed 3). The canvas is the bleed box; anchored text sits inside the safe margin. Tokens `@bleed` `@safe` `@trimWidth` `@trimHeight` `@mm` `@dpi`; `area: 'trim' \| 'safe'`. |
| `cropMarks`, `cutLine` | Crop marks in a slug; the die line (`CutContour`). `renderImage` writes the dpi. |
| `cut` | The die-cut: `'rounded'` (3 mm), `'circle'`, `{ radius }` (mm), or `{ d, viewBox }` (a path drawn into the trim). Tickets and lanyard passes have rounded corners by default; a `shape` of `kind: 'cut'` draws it (as a fill, or a `clip`). |
| `page` | A recipe's `"pages": ["front", "back"]` with `when: { "page": "back" }`; `renderPages(cover)` returns `{ front, back }`. |

Artwork on objects (a card on a desk, a lanyard on wood) is a mockups library, not covers.

## Brand kit

```js
const files = await kit({ name: 'Hollow Fern', tagline: 'Field recordings', palette: { accent: '#2f6b4f' }, mark, lines, person: 'Mira Okafor' }, { formats: ['avatar', 'x-header', 'business-card'] });
files['business-card'].back; // SVG
```

`kit(brand, { formats, recipe, pages, render, overlay })`: every format in `KIT_FORMATS` by default, with the built-in `brand` recipe (or one per format). Two-sided formats return `{ front, back }`.

## lint

`lint(cover, { target: 'spotify', artist, title })` → `{ ok, issues: [{ rule, severity, message, text }] }`. Spotify's own rules: square, 640–10000 px, not upscaled (3000×3000 is what stores ask for). The content rules are distributors' (they reject art that breaks them).

| Rule | Severity | |
|---|---|---|
| `aspect`, `resolution` | error (warning under 3000) | |
| `url`, `handle`, `contact`, `price`, `promo`, `platform`, `barcode` | error | Addresses, @handles, email/phone, prices and "free", "out now", store names (a name that's also a word, "Tidal", only with a cue: "on Tidal", or on its own), barcodes |
| `date`, `physical` | warning | Dates; day names spelled out, or short ones beside a number ("Sat 14", not "Second Sun"); CD, vinyl |
| `legibility` | warning | The block's smallest capitals under 4 px at a 64 px thumbnail, measured as drawn (every line, stretch, justification, group and transform scale) |
| `upscaled`, `metadata` | warning | An image drawn bigger than its pixels (through groups and transforms), or embedded smaller than drawn; words not in `artist`/`title` (a letter per layer or a knocked-out word spelled from them passes) |
