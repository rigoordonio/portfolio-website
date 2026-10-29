#!/usr/bin/env node
/* Tiny static server for previews and tests: gzip, correct types, real 404 status with 404.html.
   node tools/serve.mjs [dir=dist] [port=8080] */
import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, join, normalize, resolve, dirname} from 'node:path';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
const ZIP = new Set(['.html', '.css', '.js', '.json', '.webmanifest', '.xml', '.txt', '.svg']);

export function serve(dir, port = 0) {
  const root = resolve(dir);
  const send = async (req, res, file, status) => {
    const ext = extname(file), body = await readFile(file);
    const headers = {'Content-Type': TYPES[ext] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff',
      'Cache-Control': ext === '.woff2' ? 'public, max-age=31536000, immutable' : 'no-cache'};
    if (ZIP.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      res.writeHead(status, {...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding'}); res.end(gzipSync(body));
    } else { res.writeHead(status, headers); res.end(body); }
  };
  const server = createServer(async (req, res) => {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
    const file = join(root, normalize(path));
    if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
    try { if ((await stat(file)).isFile()) return await send(req, res, file, 200); } catch {}
    try { await send(req, res, join(root, '404.html'), 404); } catch { res.writeHead(404); res.end('Not found'); }
  });
  return new Promise(ok => server.listen(port, '127.0.0.1', () => ok({url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close()})));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const s = await serve(resolve(ROOT, process.argv[2] || 'dist'), +(process.argv[3] || 8080));
  console.log('Serving on ' + s.url);
}
