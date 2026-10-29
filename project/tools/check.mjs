#!/usr/bin/env node
/* Static checks (the project's "lint"): builds each theme into .build/<theme>, then checks
   HTML validity, SEO head rules, heading outline, links, structured data, inline script syntax,
   referenced files and the crawl files. No browser needed.   node tools/check.mjs [light|dark] */
import {readFileSync, existsSync, readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {HtmlValidate} from 'html-validate';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
const themes = process.argv[2] ? [process.argv[2]] : ['light', 'dark'];
/* style="--i:2" attributes feed CSS custom properties for staggered motion; they are intentional */
const hv = new HtmlValidate({extends: ['html-validate:recommended'], rules: {'no-inline-style': 'off'}});
let failed = 0;
const report = (ok, label, detail = '') => { if (!ok) failed++; console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ' (' + detail + ')' : ''}`); };

const attr = (tag, name) => (tag.match(new RegExp(`\\s${name}="([^"]*)"`)) || [])[1];
const meta = (html, key) => { const t = html.match(new RegExp(`<meta (?:name|property)="${key}"[^>]*>`)); return t && attr(t[0], 'content'); };
const unesc = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const pngSize = f => { const b = readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const scripts = html => [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map(m => ({type: attr(m[0].slice(0, m[0].indexOf('>') + 1), 'type') || 'text/javascript', src: /\ssrc=/.test(m[1]), code: m[2]}));

function checkScripts(html, where) {
  const bad = [];
  scripts(html).forEach(({type, src, code}, i) => {
    if (src) return;
    try {
      if (/json/.test(type)) JSON.parse(code);
      else if (type === 'text/javascript' || type === 'module') new vm.Script(code, {filename: `${where}#script${i}`});
    } catch (e) { bad.push(`script ${i}: ${e.message}`); }
  });
  report(!bad.length, `${where}: inline scripts and JSON parse`, bad.join('; '));
}

/* the two source pages also run on their own as previews, so check them directly too */
console.log('\nSource pages');
for (const f of ['rigo-portfolio-light.html', 'rigo-portfolio-dark.html']) {
  const html = readFileSync(join(ROOT, f), 'utf8');
  checkScripts(html, f);
  const data = html.match(/<script type="application\/json" id="services-data">([\s\S]*?)<\/script>/);
  let services = [];
  try { services = JSON.parse(data[1]); } catch {}
  const shapeOk = services.length === 5 && services.every(s => s.id && s.name && s.projects?.length && s.projects.every(p => p.title && p.outcome && p.org && Array.isArray(p.tags) && p.tags.length));
  report(shapeOk, `${f}: services data has 5 services, each project has org, title, outcome and tags`);
}
try {
  for (const t of readdirSync(join(ROOT, 'tools')).filter(n => n.endsWith('.mjs'))) execFileSync(process.execPath, ['--check', join(ROOT, 'tools', t)]);
  report(true, 'tools/*.mjs: syntax');
} catch (e) { report(false, 'tools/*.mjs: syntax', e.message.split('\n')[0]); }

for (const theme of themes) {
  const out = join(ROOT, '.build', theme);
  console.log(`\n${theme} build`);
  execFileSync(process.execPath, [join(ROOT, 'tools/build.mjs'), '--theme', theme, '--out', out], {stdio: ['ignore', 'pipe', 'inherit']});
  const html = readFileSync(join(out, 'index.html'), 'utf8');
  const site = new URL(cfg.siteUrl).href.replace(/\/?$/, '/'), base = new URL(site).pathname;

  /* 1. valid HTML */
  for (const f of ['index.html', '404.html']) {
    const r = await hv.validateFile(join(out, f));
    const msgs = r.results.flatMap(x => x.messages.map(m => `${m.ruleId} ${m.line}:${m.column} ${m.message}`));
    report(r.valid, `${f}: html-validate (recommended)`, msgs.slice(0, 5).join('; '));
  }

  /* 2. SEO head */
  const title = unesc((html.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
  const desc = unesc(meta(html, 'description') || '');
  report(title.length >= 50 && title.length <= 60, 'title is 50–60 characters', `${title.length}: ${title}`);
  report(desc.length >= 140 && desc.length <= 160, 'meta description is 140–160 characters', String(desc.length));
  report((html.match(/<link rel="canonical" href="([^"]+)"/) || [])[1] === site, 'canonical URL', site);
  const social = ['og:type', 'og:title', 'og:description', 'og:url', 'og:image', 'og:image:alt', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image'];
  const missing = social.filter(k => !meta(html, k));
  report(!missing.length, 'Open Graph and Twitter tags', missing.join(', '));
  report(/<html lang="en">/.test(html) && /<meta name="viewport"/.test(html) && /<meta name="theme-color"/.test(html), 'lang, viewport and theme-color');
  const keywords = ['data analytics', 'forecasting', 'machine learning', 'AI data engineer', 'Abu Dhabi'];
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').toLowerCase();
  const absent = keywords.filter(k => !text.includes(k.toLowerCase()));
  report(!absent.length, 'target keywords appear in visible copy', absent.join(', '));

  /* 3. headings and semantics (static HTML; the browser test re-checks after scripts run) */
  const levels = [...html.matchAll(/<h([1-6])\b/g)].map(m => +m[1]);
  const skips = levels.map((l, i) => i && l > levels[i - 1] + 1 ? `h${levels[i - 1]}→h${l}` : '').filter(Boolean);
  report(levels.filter(l => l === 1).length === 1 && levels[0] === 1, 'exactly one h1, and it comes first', `${levels.filter(l => l === 1).length} h1`);
  report(!skips.length, 'heading levels never skip', skips.join(', '));
  const landmarks = ['<header', '<nav', '<main', '<footer', '<section', '<article'].filter(t => !html.includes(t));
  report(!landmarks.length, 'header, nav, main, section, article and footer present', landmarks.join(', '));
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map(m => m[0]);
  report(imgs.every(t => /\salt="/.test(t)), 'every <img> has alt text', `${imgs.length} images`);

  /* 4. links: in-page anchors resolve, local files exist */
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));
  const hrefs = [...html.matchAll(/\shref="([^"]+)"/g)].map(m => unesc(m[1]));
  const deadAnchors = hrefs.filter(h => h.startsWith('#') && h.length > 1 && !ids.has(decodeURIComponent(h.slice(1))));
  report(!deadAnchors.length, 'every #anchor link points at an element', deadAnchors.join(', '));
  const services = JSON.parse(html.match(/<script type="application\/json" id="services-data">([\s\S]*?)<\/script>/)[1]);
  const deepLinks = services.flatMap(s => s.projects.map(p => p.href).filter(h => h?.startsWith('#'))).filter(h => !ids.has(h.slice(1)));
  report(!deepLinks.length && services.every(s => ids.has(s.id) && ids.has(s.id + '-panel')), 'services render with deep-link ids and project links resolve', deepLinks.join(', '));
  const local = [...html.matchAll(/\s(?:href|src)="([^"]+)"/g), ...html.matchAll(/url\(([^)]+)\)/g)].map(m => m[1].replace(/['"]/g, ''))
    .filter(u => u.startsWith(base) && !u.startsWith('//')).map(u => u.slice(base.length).split(/[?#]/)[0]).filter(Boolean);
  const missingFiles = [...new Set(local)].filter(u => !existsSync(join(out, u)));
  report(!missingFiles.length, 'every local file the page references exists', missingFiles.join(', ') || `${new Set(local).size} files`);
  const external = [...new Set(hrefs.filter(h => /^https?:/.test(h) && !h.startsWith(site)))];
  report(external.every(h => h.startsWith('https://')), 'external links use https', external.join(', '));
  const blankNoOpener = [...html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)].filter(m => !/rel="[^"]*noopener/.test(m[0]));
  report(!blankNoOpener.length, 'target=_blank links carry rel=noopener');

  /* 5. structured data and scripts */
  checkScripts(html, 'index.html');
  let types = [];
  try { types = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'].map(n => n['@type']); } catch {}
  const needTypes = ['WebSite', 'ProfilePage', 'Person', 'ProfessionalService', 'CreativeWork'].filter(t => !types.includes(t));
  report(!needTypes.length, 'JSON-LD has WebSite, ProfilePage, Person, ProfessionalService and CreativeWork', needTypes.join(', ') || `${types.length} nodes`);

  /* 6. crawl files, icons, manifest */
  const robots = readFileSync(join(out, 'robots.txt'), 'utf8');
  report(/^User-agent: \*/m.test(robots) && robots.includes(`Sitemap: ${site}sitemap.xml`), 'robots.txt allows crawling and names the sitemap');
  report(readFileSync(join(out, 'sitemap.xml'), 'utf8').includes(`<loc>${site}</loc>`), 'sitemap.xml lists the canonical URL');
  const manifest = JSON.parse(readFileSync(join(out, 'site.webmanifest'), 'utf8'));
  const iconFiles = manifest.icons.map(i => i.src.slice(base.length));
  report(manifest.name && manifest.theme_color && iconFiles.every(f => existsSync(join(out, f))) && manifest.icons.some(i => i.purpose === 'maskable'), 'web manifest with existing icons, including maskable');
  report(['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'].every(f => existsSync(join(out, f))), 'favicon set');
  report(pngSize(join(out, 'og-image.png')).join('x') === '1200x630', 'social image is 1200x630');
  const nf = readFileSync(join(out, '404.html'), 'utf8');
  report(/<meta name="robots" content="noindex">/.test(nf) && nf.includes(`href="${base}"`), '404 page is noindex and links home');

  /* 7. nothing secret ships */
  const leaks = [/process\.env/, /\bsk-[A-Za-z0-9]{20,}/, /AKIA[0-9A-Z]{16}/, /gh[pousr]_[A-Za-z0-9]{30,}/, /-----BEGIN [A-Z ]*PRIVATE KEY/]
    .filter(re => readdirSync(out).filter(f => /\.(html|js|json|txt|xml|webmanifest)$/.test(f)).some(f => re.test(readFileSync(join(out, f), 'utf8'))));
  report(!leaks.length, 'no environment variables, keys or tokens in the output', leaks.map(String).join(', '));
}

console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
