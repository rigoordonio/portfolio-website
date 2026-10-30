#!/usr/bin/env node
/* Tests api/poke.js against a small in-memory stand-in for Upstash's REST pipeline: node tools/test-poke-api.mjs */
import http from 'node:http';
import {createRequire} from 'node:module';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log(`  ✓ ${name}`); } catch (e) { failed++; console.log(`  ✗ ${name}\n      ${e.message}`); } };
const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

const store = new Map(), ttl = new Map();
const run = ([cmd, key, ...args]) => {
  if (cmd === 'INCR') { const v = (+store.get(key) || 0) + 1; store.set(key, String(v)); return {result: v}; }
  if (cmd === 'GET') return {result: store.has(key) ? store.get(key) : null};
  if (cmd === 'EXPIRE') { const nx = args[1] === 'NX'; if (nx && ttl.has(key)) return {result: 0}; ttl.set(key, +args[0]); return {result: 1}; }
  return {error: `ERR unknown command ${cmd}`};
};
let down = false;
const redis = http.createServer((req, res) => {
  let body = ''; req.on('data', c => body += c);
  req.on('end', () => {
    if (down) { res.statusCode = 500; return res.end('{}'); }
    if (req.headers.authorization !== 'Bearer secret' || req.url !== '/pipeline') { res.statusCode = 401; return res.end('{}'); }
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(JSON.parse(body).map(run)));
  });
});
await new Promise(r => redis.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${redis.address().port}`;

const load = env => {
  for (const k of ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) delete process.env[k];
  Object.assign(process.env, env);
  delete require.cache[require.resolve(join(ROOT, 'api/poke.js'))];
  return require(join(ROOT, 'api/poke.js'));
};
const call = async (handler, method = 'GET', path = '/api/poke', ip = '203.0.113.7') => {
  const out = {headers: {}};
  const res = {setHeader: (k, v) => { out.headers[k] = v; }, status: c => { out.status = c; return res; }, send: b => { out.body = JSON.parse(b); return res; }};
  await handler({method, url: path, headers: {'x-forwarded-for': ip}}, res);
  return out;
};
const month = new Date().toISOString().slice(0, 7);

console.log('api/poke');
await test('without Redis it answers enabled:false, not an error', async () => {
  const r = await call(load({}));
  eq([r.status, r.body], [200, {enabled: false}], 'unconfigured GET');
  eq((await call(load({}), 'POST')).body, {enabled: false}, 'unconfigured POST');
});
const h = load({KV_REST_API_URL: url, KV_REST_API_TOKEN: 'secret'});
await test('starts at zero and is never cached', async () => {
  const r = await call(h);
  eq(r.body, {enabled: true, month: 0, total: 0}, 'fresh counts'); eq(r.headers['Cache-Control'], 'no-store', 'cache header');
});
await test('pokes from different visitors add up in one total', async () => {
  eq((await call(h, 'POST', '/api/poke', '198.51.100.1')).body, {enabled: true, month: 1, total: 1}, 'visitor A');
  eq((await call(h, 'POST', '/api/poke', '198.51.100.2')).body, {enabled: true, month: 2, total: 2}, 'visitor B');
  eq((await call(h, 'POST', '/api/poke', '198.51.100.1')).body, {enabled: true, month: 3, total: 3}, 'visitor A again');
  eq((await call(h)).body, {enabled: true, month: 3, total: 3}, 'anyone reading sees the sum');
});
await test('counts are kept per month under the UTC month key', async () => {
  eq(store.get(`pk:m:${month}`), '3', 'month key'); eq(store.get('pk:total'), '3', 'total key');
});
await test('one visitor is limited to 20 pokes a minute and the rest are ignored', async () => {
  for (let i = 0; i < 25; i++) await call(h, 'POST', '/api/poke', '192.0.2.9');
  const r = await call(h, 'POST', '/api/poke', '192.0.2.9');
  eq([r.body.limited, r.body.month], [true, 3 + 20], 'limited at 20');
  eq((await call(h, 'POST', '/api/poke', '192.0.2.10')).body.month, 24, 'others are not affected');
});
await test('no raw IP address is stored', async () => {
  eq([...store.keys()].some(k => k.includes('192.0.2') || k.includes('198.51')), false, 'keys');
});
await test('?probe uses separate counters', async () => {
  const before = store.get(`pk:m:${month}`);
  const r = await call(h, 'POST', '/api/poke?probe=1', '192.0.2.50');
  eq([r.body.month, store.get(`pk:m:${month}`)], [1, before], 'probe stays out of the real total');
});
await test('Upstash variable names from the Marketplace integration also work', async () => {
  const r = await call(load({UPSTASH_REDIS_REST_URL: url, UPSTASH_REDIS_REST_TOKEN: 'secret'}));
  eq(r.body.enabled, true, 'enabled');
});
await test('a Redis outage returns 502 with no details', async () => {
  down = true; const r = await call(h); down = false;
  eq([r.status, r.body], [502, {enabled: false, error: 'counter unavailable'}], 'outage');
});
await test('other methods are refused', async () => {
  eq((await call(h, 'DELETE')).status, 405, 'DELETE');
});

redis.close();
console.log(failed ? `\n${failed} failed` : `\nAll ${passed} passed`);
process.exit(failed ? 1 : 0);
