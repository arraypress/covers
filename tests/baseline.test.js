import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { renderSvg } from '../src/index.js';
import { baselineCases } from './fixtures/baseline-cases.js';

// Every built-in recipe and every 1.0 layer type, across palettes, aspects
// and options, renders the same SVG bytes as 1.0.0 did (hashes recorded with
// the 1.0.0 code before any 1.1 change: tests/fixtures/baseline-svg.json).
test('1.0 covers render byte-identical SVG in 1.1', async () => {
  const want = JSON.parse(await readFile(new URL('./fixtures/baseline-svg.json', import.meta.url), 'utf8'));
  const cases = await baselineCases();
  assert.equal(cases.length, Object.keys(want).length);
  const changed = [];
  for (const c of cases) {
    const got = createHash('sha256').update(await renderSvg(c.options)).digest('hex');
    if (got !== want[c.name]) changed.push(c.name);
  }
  assert.deepEqual(changed, [], `${changed.length} of ${cases.length} covers changed`);
});
