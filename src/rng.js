/**
 * Seeded randomness.
 *
 * Every random choice a cover makes comes from a generator seeded by the
 * cover's `seed` string, so the same input always draws the same image and
 * two posts with different slugs draw different ones. Each layer gets its
 * own stream (seed + layer index + layer type), so adding or removing one
 * layer never reshuffles the others.
 *
 * @module rng
 */

/**
 * Hash a string to a 32-bit unsigned integer (cyrb53, folded to 32 bits).
 * Fast, well distributed, and stable across platforms and Node versions.
 *
 * @param {string} str - Any string.
 * @param {number} [salt=0] - Optional salt, to get several independent hashes of one string.
 * @returns {number} An integer in `[0, 2^32)`.
 *
 * @example
 * hashString('my-post');  // 1838215339 (always)
 */
export function hashString(str, salt = 0) {
  let h1 = 0xdeadbeef ^ salt;
  let h2 = 0x41c6ce57 ^ salt;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}

/**
 * A small seeded pseudo-random generator (sfc32) with helpers.
 *
 * @typedef {object} Rng
 * @property {() => number} next - A float in `[0, 1)`.
 * @property {(min: number, max: number) => number} range - A float in `[min, max)`.
 * @property {(min: number, max: number) => number} int - An integer in `[min, max]`.
 * @property {<T>(items: readonly T[]) => T} pick - One item.
 * @property {<T>(items: readonly T[]) => T[]} shuffle - A shuffled copy.
 * @property {(chance?: number) => boolean} chance - `true` with the given probability (default 0.5).
 */

/**
 * Create a seeded generator. Strings are hashed; numbers are used as-is.
 *
 * @param {string | number} seed - The seed.
 * @returns {Rng} The generator.
 *
 * @example
 * const rng = createRng('my-post');
 * rng.range(0, 360); // same angle every run
 */
export function createRng(seed) {
  const s = String(seed);
  let a = hashString(s, 1);
  let b = hashString(s, 2);
  let c = hashString(s, 3);
  let d = hashString(s, 4);

  const next = () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
  // Warm up: the first few sfc32 outputs are correlated with the seed.
  for (let i = 0; i < 12; i++) next();

  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    pick: (items) => items[Math.floor(next() * items.length)],
    shuffle: (items) => {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    chance: (p = 0.5) => next() < p,
  };
}
