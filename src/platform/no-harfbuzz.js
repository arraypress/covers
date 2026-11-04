/**
 * What `#harfbuzz` resolves to in Cloudflare Workers (the `workerd` and
 * `worker` export conditions): harfbuzzjs needs to compile WebAssembly
 * trampolines at runtime, which Workers forbid, and its loader imports
 * `node:module`. Importing this fails, so text falls back to the built-in
 * JavaScript outliner (`sfnt.js`).
 *
 * @module no-harfbuzz
 */

throw new Error('HarfBuzz is not available in Cloudflare Workers; covers draws text with its JavaScript outliner there');
