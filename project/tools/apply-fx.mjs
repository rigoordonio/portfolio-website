#!/usr/bin/env node
/* Puts snippets/futuristic-layer.html at the end of a page, replacing an earlier copy.  node tools/apply-fx.mjs [page.html] */
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const page = resolve(ROOT, process.argv[2] || 'rigo-portfolio-merged.html');
const layer = readFileSync(resolve(ROOT, 'snippets/futuristic-layer.html'), 'utf8').trim();
let html = readFileSync(page, 'utf8').replace(/\n?<!-- fx:start -->[\s\S]*?<!-- fx:end -->\n?/, '');
writeFileSync(page, html.replace(/\s*$/, '\n') + layer + '\n');
console.log('futuristic layer applied to', page);
