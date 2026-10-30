/* Shared Poke counter. GET returns {enabled, month, total}; POST adds one poke and returns the new counts.
   Counts live in Redis (Upstash), added from the Vercel project's Storage tab, which sets the two variables below.
   Until Redis is connected it answers {enabled:false} and the page counts only that visitor's own pokes.
   A visitor is never stored: the rate limit key is a hash of their IP and the day, and it expires after a minute. */
const crypto = require('node:crypto');

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const LIMIT = 20;   // pokes per visitor per minute
/* Pokes made on the preview pages before this counter existed (16 + 4, all from one viewer in October 2026), counted once.
   They are added to what Redis holds, so the live count can be checked against Redis alone by subtracting this. */
const EARLIER = {months: {'2026-10': 20}, total: 20};

async function redis(commands) {
  const r = await fetch(`${URL_.replace(/\/$/, '')}/pipeline`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json'},
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error(`redis ${r.status}`);
  return (await r.json()).map(x => { if (x.error) throw new Error(x.error); return x.result; });
}

module.exports = handler;
module.exports.EARLIER = EARLIER;
async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const send = (code, body) => res.status(code).send(JSON.stringify(body));
  if (req.method !== 'GET' && req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return send(405, {error: 'method not allowed'}); }
  if (!URL_ || !TOKEN) return send(200, {enabled: false});

  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  /* ?probe keeps connection checks out of the real totals */
  const p = new URL(req.url, 'http://localhost').searchParams.has('probe') ? 'probe:' : '';
  const mKey = `pk:${p}m:${month}`, tKey = `pk:${p}total`;
  const oM = p ? 0 : EARLIER.months[month] || 0, oT = p ? 0 : EARLIER.total;   // probes never include them
  try {
    let limited = false;
    if (req.method === 'POST') {
      const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
      const who = crypto.createHash('sha256').update(ip + now.toISOString().slice(0, 10)).digest('hex').slice(0, 16);
      const [hits] = await redis([['INCR', `pk:rl:${who}`], ['EXPIRE', `pk:rl:${who}`, 60, 'NX']]);
      if (hits > LIMIT) limited = true;
      else {
        const [m, t] = await redis([['INCR', mKey], ['INCR', tKey]]);
        return send(200, {enabled: true, month: m + oM, total: t + oT, ...(p ? {} : {earlier: EARLIER.total})});
      }
    }
    const [m, t] = await redis([['GET', mKey], ['GET', tKey]]);
    return send(200, {enabled: true, month: (+m || 0) + oM, total: (+t || 0) + oT, ...(p ? {} : {earlier: EARLIER.total}), ...(limited ? {limited: true} : {})});
  } catch (e) {
    return send(502, {enabled: false, error: 'counter unavailable'});
  }
}
