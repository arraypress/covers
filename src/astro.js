/**
 * Astro helpers: a static endpoint that renders one cover per entry.
 *
 * ```ts
 * // src/pages/covers/[slug].webp.ts
 * import { getCollection } from 'astro:content';
 * import { coverEndpoint } from '@arraypress/covers/astro';
 *
 * export const { getStaticPaths, GET } = coverEndpoint({
 *   getEntries: () => getCollection('posts'),
 *   cover: (post) => ({ recipe: 'gridTitle', seed: post.id, title: post.data.title }),
 * });
 * ```
 *
 * `astro build` writes `dist/covers/<slug>.webp` for every entry; `astro
 * dev` renders on request. Renders are cached by content hash in
 * `node_modules/.cache/covers`, so an unchanged cover is read back instead
 * of drawn again, across builds.
 *
 * No Astro import: the endpoint is plain `getStaticPaths` / `GET`
 * functions, so this module works with any Astro version (and is easy to
 * test).
 *
 * @module @arraypress/covers/astro
 */

import { renderImage, MIME } from './index.js';

/**
 * Build `getStaticPaths` and `GET` for a cover route.
 *
 * @template T
 * @param {import('./astro.js').CoverEndpointOptions<T>} options
 * @returns {{ getStaticPaths: () => Promise<{ params: Record<string, string>, props: { entry: T } }[]>, GET: (context: { params: Record<string, string | undefined>, props?: { entry?: T } }) => Promise<Response> }}
 *
 * @example
 * export const { getStaticPaths, GET } = coverEndpoint({
 *   getEntries: () => getCollection('posts'),
 *   cover: (post) => ({ recipe: 'aurora', seed: post.id, title: post.data.title, palette: 'dusk' }),
 * });
 */
export function coverEndpoint(options) {
  const { getEntries, cover } = options;
  if (typeof getEntries !== 'function' || typeof cover !== 'function') {
    throw new TypeError('coverEndpoint() needs getEntries and cover functions');
  }
  const param = options.param ?? 'slug';
  const slugOf = options.slug ?? ((/** @type {any} */ e) => String(e.id ?? e.slug));
  const format = options.format ?? 'webp';
  const cache = options.cache ?? true;

  const getStaticPaths = async () => {
    const entries = await getEntries();
    return entries.map((entry) => ({ params: { [param]: slugOf(entry) }, props: { entry } }));
  };

  /** @param {{ params: Record<string, string | undefined>, props?: { entry?: any } }} context */
  const GET = async ({ params, props }) => {
    let entry = props?.entry;
    // On-demand routes get no props: look the entry up by its slug.
    if (entry === undefined) entry = (await getEntries()).find((e) => slugOf(e) === params[param]);
    if (entry === undefined) return new Response('Not found', { status: 404 });
    const body = await renderImage(await cover(entry), { format, quality: options.quality, cache });
    return new Response(new Uint8Array(body), {
      headers: { 'Content-Type': MIME[format], 'Content-Length': String(body.length) },
    });
  };

  return { getStaticPaths, GET };
}

/**
 * The URL of an entry's cover, for `<img src>` and `og:image`.
 *
 * @param {string} slug - The entry's slug (the route param).
 * @param {{ base?: string, format?: keyof typeof MIME }} [options] - Route base (default `'/covers'`) and extension (default `'webp'`).
 * @returns {string} e.g. `'/covers/my-post.webp'`.
 *
 * @example
 * coverUrl(post.id); // '/covers/hello-world.webp'
 */
export function coverUrl(slug, options = {}) {
  const base = (options.base ?? '/covers').replace(/\/+$/, '');
  const path = String(slug).split('/').map(encodeURIComponent).join('/');
  return `${base}/${path}.${options.format ?? 'webp'}`;
}
