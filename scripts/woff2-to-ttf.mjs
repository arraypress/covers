/**
 * Convert WOFF2 fonts to TTF/OTF (a bare sfnt), for runtimes with no Brotli
 * (most Cloudflare Workers), where covers can't decode WOFF2 itself. Node
 * decodes WOFF2 directly; this writes the result once so the font can ship
 * as `.ttf`.
 *
 *   node scripts/woff2-to-ttf.mjs font.woff2 [more.woff2 …]
 *
 * Writes `font.ttf` (or `.otf` for a CFF font) beside each input. Uses the
 * library's own decoder (Node's zlib for Brotli); when that's missing it
 * tries fontTools (`fonttools ttLib.woff2 decompress`) or Google's
 * `woff2_decompress`, if either is on the PATH.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { decodeFont } from '../src/fonts.js';

const files = process.argv.slice(2);
if (!files.length) {
  console.error('Usage: node scripts/woff2-to-ttf.mjs font.woff2 [more.woff2 …]');
  process.exit(1);
}

/** @param {string[]} cmd @returns {boolean} Whether a command ran. */
const tryRun = (cmd) => {
  try {
    execFileSync(cmd[0], cmd.slice(1), { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

for (const file of files) {
  const base = file.replace(/\.woff2$/i, '');
  try {
    const sfnt = decodeFont(readFileSync(file));
    const out = `${base}.${sfnt[0] === 0x4f ? 'otf' : 'ttf'}`;
    writeFileSync(out, sfnt);
    console.log(`${file} → ${out}`);
  } catch (err) {
    const out = `${base}.ttf`;
    if (tryRun(['fonttools', 'ttLib.woff2', 'decompress', '-o', out, file]) || tryRun(['woff2_decompress', file])) console.log(`${file} → ${out} (external tool)`);
    else console.error(`${file}: ${/** @type {Error} */ (err).message}`);
  }
}
