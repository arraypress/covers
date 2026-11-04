/**
 * `@arraypress/covers/node`: the same API, with Node's modules installed
 * up front. Needed only on Node older than 20.16 (no
 * `process.getBuiltinModule`), or in a bundle where you want the file
 * system wired in explicitly.
 *
 * @module @arraypress/covers/node
 */

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as zlib from 'node:zlib';
import * as path from 'node:path';
import * as module from 'node:module';
import * as url from 'node:url';
import { installNode } from './platform/index.js';

installNode({ fs, fsp, zlib, path, module, url });

export * from './index.js';
