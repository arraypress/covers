import type { CoverOptions, Cover, MIME } from './index.js';

export interface CoverEndpointOptions<T> {
  /** The entries to make covers for, e.g. `() => getCollection('posts')`. */
  getEntries: () => T[] | Promise<T[]>;
  /** An entry's cover. */
  cover: (entry: T) => CoverOptions | Cover | Promise<CoverOptions | Cover>;
  /** An entry's slug. Default `entry.id ?? entry.slug`. */
  slug?: (entry: T) => string;
  /** The route param, matching the file name (`[slug].webp.ts`). Default `'slug'`. */
  param?: string;
  /** Default `'webp'`; match the file name's extension. */
  format?: keyof typeof MIME;
  quality?: number;
  /** Content-hash cache: `true` (default) for `node_modules/.cache/covers`, a directory, or `false`. */
  cache?: boolean | string;
}

export interface CoverRouteContext<T> {
  params: Record<string, string | undefined>;
  props?: { entry?: T };
}

/** `getStaticPaths` and `GET` for `src/pages/covers/[slug].webp.ts`. */
export function coverEndpoint<T>(options: CoverEndpointOptions<T>): {
  getStaticPaths: () => Promise<{ params: Record<string, string>; props: { entry: T } }[]>;
  GET: (context: CoverRouteContext<T>) => Promise<Response>;
};

/** `'/covers/<slug>.webp'`. */
export function coverUrl(slug: string, options?: { base?: string; format?: keyof typeof MIME }): string;
