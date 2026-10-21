import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { coverEndpoint, coverUrl } from '../src/astro.js';

const posts = [
  { id: 'hello-world', data: { title: 'Hello world' } },
  { id: 'second-post', data: { title: 'A second post' } },
];

test('coverEndpoint: getStaticPaths and GET', async () => {
  const cache = await mkdtemp(join(tmpdir(), 'covers-astro-'));
  try {
    const { getStaticPaths, GET } = coverEndpoint({
      getEntries: async () => posts,
      cover: (post) => ({ recipe: 'aurora', seed: post.id, title: post.data.title, width: 320 }),
      cache,
    });

    const paths = await getStaticPaths();
    assert.deepEqual(paths.map((p) => p.params), [{ slug: 'hello-world' }, { slug: 'second-post' }]);
    assert.equal(paths[0].props.entry, posts[0]);

    const res = await GET({ params: paths[0].params, props: paths[0].props });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/webp');
    const body = Buffer.from(await res.arrayBuffer());
    assert.equal((await sharp(body).metadata()).width, 320);
    assert.equal(res.headers.get('content-length'), String(body.length));

    // On-demand (no props): looked up by slug; unknown slugs 404.
    const lookedUp = await GET({ params: { slug: 'second-post' } });
    assert.equal(lookedUp.status, 200);
    assert.equal((await GET({ params: { slug: 'missing' } })).status, 404);
  } finally {
    await rm(cache, { recursive: true, force: true });
  }
});

test('coverEndpoint: custom param, slug and format', async () => {
  const { getStaticPaths, GET } = coverEndpoint({
    getEntries: () => [{ handle: 'x' }],
    slug: (e) => e.handle,
    param: 'id',
    format: 'png',
    cache: false,
    cover: () => ({ layers: [{ type: 'solid' }], width: 50, height: 50 }),
  });
  const [path] = await getStaticPaths();
  assert.deepEqual(path.params, { id: 'x' });
  const res = await GET(path);
  assert.equal(res.headers.get('content-type'), 'image/png');
  assert.throws(() => coverEndpoint({}), /getEntries and cover/);
});

test('coverUrl', () => {
  assert.equal(coverUrl('hello-world'), '/covers/hello-world.webp');
  assert.equal(coverUrl('blog/post one', { base: '/og/', format: 'png' }), '/og/blog/post%20one.png');
});
