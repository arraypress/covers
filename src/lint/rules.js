/**
 * The text rules `lint` applies: what distributors reject on cover art.
 *
 * @module lint/rules
 */

/** Text rules: id, severity, pattern, what's wrong. */
export const RULES = /** @type {[string, 'error' | 'warning', RegExp, string][]} */ ([
  ['url', 'error', /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9][a-z0-9-]*\.(?:com|net|org|io|co|uk|fm|app|dev|me|tv|music|shop|store|info|biz|xyz|fair|art|band|live|link|studio|club|gg|ly|to|de|fr|nl)\b/i, 'a website address'],
  ['handle', 'error', /(?:^|[\s(])@[A-Za-z0-9_.]{2,}/, 'a social media handle'],
  ['contact', 'error', /[\w.+-]+@[\w-]+\.[\w.]+|(?:\+\d{1,3}[ .-]?)?(?:\(\d{2,5}\)[ .-]?|\d{2,5}[ .-])\d{3,4}[ .-]?\d{3,4}\b/, 'contact details (email or phone)'],
  ['price', 'error', /[$£€¥]\s?\d|\b\d+(?:[.,]\d+)?\s?(?:usd|eur|gbp)\b|\bfree(?:\s+(?:download|entry|in|stream))?\b|\bbuy now\b|\bon sale\b/i, 'a price or a sales line'],
  ['promo', 'error', /\b(?:out now|coming soon|new (?:single|album|ep|music)|available (?:now|everywhere)|pre-?(?:save|order)|stream (?:it )?now|listen now)\b/i, 'promotional wording'],
  // Brand names that are only ever the platform; "Tidal" is also a word, so it counts with a cue ("on Tidal", "stream Tidal") or on its own.
  ['platform', 'error', /\b(?:spotify|apple music|itunes|youtube|bandcamp|soundcloud|deezer|amazon music|tiktok|instagram)\b|\b(?:on|via|stream(?:ing)?(?:\s+on)?|listen(?:\s+on)?|available\s+on|find\s+us\s+on|follow\s+(?:us\s+)?on)\s+tidal\b|^\s*tidal\s*$/im, 'a store or platform name'],
  // Months and short day names count next to a number ("Sat 14", "14 March"); a full day name counts alone; "Second Sun" doesn't.
  ['date', 'warning', /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?\b|\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\b|\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\b(?:mon|tues?|wed|thu(?:rs?)?|fri|sat|sun)\.?,?\s+\d{1,2}\b|\b\d{1,2}(?:st|nd|rd|th)?,?\s+(?:mon|tues?|wed|thu(?:rs?)?|fri|sat|sun)\b|\b(?:mon|tues|wednes|thurs|fri|satur|sun)day\b|\b(?:today|tonight|this (?:week|weekend|friday))\b/i, 'a date or time frame'],
  ['physical', 'warning', /\b(?:cd|vinyl|cassette|lp|7")\b/i, 'a physical format'],
]);
