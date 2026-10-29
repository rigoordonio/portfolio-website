#!/usr/bin/env node
/* Lighthouse, mobile and desktop presets, on a gzip-serving local build.
   node tools/lighthouse.mjs [light|dark]            build that theme (default: both) and audit it
   node tools/lighthouse.mjs --dir <folder> --name x  audit any folder that has an index.html
   Reports land in reports/lh-<name>-<preset>.json. Uses CHROME_PATH, or Playwright's Chromium. */
import {execFile, execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdirSync, readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {serve} from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : undefined; };
const chrome = process.env.CHROME_PATH || (await import('playwright')).chromium.executablePath();
const LH = join(ROOT, 'node_modules/.bin/lighthouse');
mkdirSync(join(ROOT, 'reports'), {recursive: true});

const targets = arg('dir') ? [{name: arg('name') || 'custom', dir: resolve(arg('dir'))}]
  : (process.argv[2] && !process.argv[2].startsWith('--') ? [process.argv[2]] : ['light', 'dark']).map(t => {
    execFileSync(process.execPath, [join(ROOT, 'tools/build.mjs'), '--theme', t, '--out', join(ROOT, '.build', t)], {stdio: 'pipe'});
    return {name: t, dir: join(ROOT, '.build', t)};
  });

const rows = [];
for (const {name, dir} of targets) {
  const site = await serve(dir);
  for (const preset of ['mobile', 'desktop']) {
    const out = join(ROOT, 'reports', `lh-${name}-${preset}.json`);
    /* async on purpose: the static server runs in this same process and must keep answering */
    await promisify(execFile)(LH, [site.url, ...(preset === 'desktop' ? ['--preset=desktop'] : []), '--quiet', '--output=json', `--output-path=${out}`,
      '--only-categories=performance,accessibility,best-practices,seo', '--chrome-flags=--headless=new --no-sandbox --disable-gpu'],
      {env: {...process.env, CHROME_PATH: chrome}, maxBuffer: 64 * 1024 * 1024});
    const r = JSON.parse(readFileSync(out, 'utf8')), c = r.categories, a = r.audits, s = k => Math.round(c[k].score * 100);
    rows.push({name, preset, perf: s('performance'), a11y: s('accessibility'), bp: s('best-practices'), seo: s('seo'),
      lcp: a['largest-contentful-paint'].displayValue, cls: a['cumulative-layout-shift'].displayValue, tbt: a['total-blocking-time'].displayValue,
      below: Object.values(a).filter(x => x.score !== null && x.score < .9 && !['informative', 'notApplicable', 'manual'].includes(x.scoreDisplayMode)).map(x => x.id)});
    const w = rows.at(-1);
    console.log(`${name.padEnd(14)} ${preset.padEnd(8)} perf ${w.perf}  a11y ${w.a11y}  bp ${w.bp}  seo ${w.seo}  | LCP ${w.lcp}  CLS ${w.cls}  TBT ${w.tbt}${w.below.length ? '\n' + ' '.repeat(24) + 'below 0.9: ' + w.below.join(', ') : ''}`);
  }
  site.close();
}
const low = rows.filter(r => Math.min(r.perf, r.a11y, r.bp, r.seo) < 90);
if (low.length) { console.log(`\nUnder 90: ${low.map(r => r.name + ' ' + r.preset).join(', ')}`); process.exitCode = 1; }
