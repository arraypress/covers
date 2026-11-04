import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { renderSvg } from '../src/index.js';

// Runs the package inside workerd with `wrangler dev` (tests/worker/).
// Opt-in, since it needs wrangler and takes a few seconds: COVERS_WORKER=1.
const enabled = process.env.COVERS_WORKER === '1';

test('Cloudflare Worker: covers render, text through the JS outliner', { skip: !enabled && 'set COVERS_WORKER=1 (needs wrangler)', timeout: 90_000 }, async () => {
  const port = 8700 + Math.floor(Math.random() * 200);
  const dev = spawn('wrangler', ['dev', '--local', '--port', String(port)], { cwd: new URL('./worker/', import.meta.url).pathname, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('wrangler dev did not start')), 60_000);
      const on = (/** @type {Buffer} */ d) => { if (/Ready on/.test(String(d))) { clearTimeout(t); resolve(undefined); } };
      dev.stdout.on('data', on);
      dev.stderr.on('data', on);
    });
    const get = async (name) => {
      const r = await fetch(`http://127.0.0.1:${port}/?case=${name}`);
      const body = await r.text();
      assert.equal(r.status, 200, body.slice(0, 500));
      return body;
    };
    // Vector and text covers: the same bytes as Node (the outliner and HarfBuzz agree on these).
    assert.equal(await get('bigType'), await renderSvg({ recipe: 'bigType', seed: 'worker', title: 'Rendered in a Worker', label: 'Edge', width: 600 }));
    for (const name of ['brand', 'riso', 'poster']) assert.match(await get(name), /^<svg xmlns/, name);
    const issues = JSON.parse(await get('lint')).issues.map((i) => i.rule);
    assert.ok(issues.includes('promo') && issues.includes('url'), String(issues));
  } finally {
    dev.kill('SIGINT');
  }
});
