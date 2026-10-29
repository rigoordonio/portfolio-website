#!/usr/bin/env node
/* Build a deployable static site from one of the two single-file pages.
   The pages stay the source of truth (they also run on their own as previews); this adds what a
   real host needs: a full SEO <head>, JSON-LD, self-hosted fonts, icons, manifest, social image,
   robots.txt, sitemap.xml, a 404 page and a pre-rendered Services section.

   node tools/build.mjs [--theme light|dark] [--out dist] [--endpoint https://...]   */
import {readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, readdirSync, existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const cfg = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
const theme = arg('theme', cfg.theme);
const OUT = resolve(ROOT, arg('out', 'dist'));
const endpoint = arg('endpoint', cfg.formEndpoint || '');

/* per-theme values the head, manifest and 404 page need */
const THEMES = {
  light: {
    source: 'rigo-portfolio-light.html', bg: '#f7f7f5', fg: '#121212', muted: '#5c5c58', accent: '#c2410c', rule: '#e4e3df', scheme: 'light',
    fonts: 'fonts-light.css', preload: ['schibsted-grotesk-latin.woff2'],
    display: '"Schibsted Grotesk","Schibsted Fallback",ui-sans-serif,system-ui,sans-serif',
    body: '"Schibsted Grotesk","Schibsted Fallback",ui-sans-serif,system-ui,sans-serif',
    mono: '"Geist Mono",ui-monospace,SFMono-Regular,Menlo,monospace', dot: 'radial-gradient(circle at 35% 35%,#ffb627,#ff5a1f)',
  },
  dark: {
    source: 'rigo-portfolio-dark.html', bg: '#06070a', fg: '#eceae4', muted: '#9aa0ab', accent: '#7fe0d4', rule: '#1d222c', scheme: 'dark',
    fonts: 'fonts-dark.css', preload: ['bricolage-grotesque-latin.woff2', 'figtree-latin.woff2'],
    display: '"Bricolage Grotesque","Bricolage Fallback",ui-sans-serif,system-ui,sans-serif',
    body: '"Figtree","Figtree Fallback",ui-sans-serif,system-ui,sans-serif',
    mono: '"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace', dot: 'conic-gradient(#7fe0d4,#c9b8ff,#f2c58a,#7fe0d4)',
  },
};
/* merged: the Studio page with a night mode; head, icons and fonts come from light */
THEMES.merged = {...THEMES.light, source: 'rigo-portfolio-merged.html'};
const T = THEMES[theme];
const assetTheme = theme === 'merged' ? 'light' : theme;
if (!T) throw new Error(`Unknown theme "${theme}". Use light, dark or merged.`);

const SITE = new URL(cfg.siteUrl).href.replace(/\/?$/, '/');   // absolute, ends with /
const BASE = new URL(SITE).pathname;                             // "/" or "/repo/" on GitHub project pages
const abs = p => SITE + p, rel = p => BASE + p;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const P = cfg.person;
const must = (cond, msg) => { if (!cond) throw new Error('build: ' + msg); };

/* ---------- 1. split the source page into its style block and body ---------- */
const src = readFileSync(join(ROOT, T.source), 'utf8');
const cut = src.indexOf('</style>') + '</style>'.length;
must(cut > 8, 'no <style> block in ' + T.source);
const pageCss = src.slice(src.indexOf('<style>'), cut);
let body = src.slice(cut).trim();

/* ---------- 2. pre-render the services accordion with the page's own render code ---------- */
const dataMatch = body.match(/<script type="application\/json" id="services-data">([\s\S]*?)<\/script>/);
const codeMatch = body.match(/\/\* services:render:start[^*]*\*\/([\s\S]*?)\/\* services:render:end \*\//);
must(dataMatch && codeMatch, 'services data or render code markers not found');
const services = JSON.parse(dataMatch[1]);
const renderServices = new Function(codeMatch[1] + ';return renderServices')();
must(body.includes('<div class="acc" id="svc-acc"></div>'), 'empty #svc-acc container not found');
body = body.replace('<div class="acc" id="svc-acc"></div>', `<div class="acc" id="svc-acc">${renderServices(services)}</div>`);

/* style blocks in the body (the motion layer) move to the head, where HTML allows them */
const bodyStyles = [];
body = body.replace(/<style\b[^>]*>[\s\S]*?<\/style>\n?/g, m => { bodyStyles.push(m.trim()); return ''; });

/* ---------- 3. contact form endpoint (Formspree, Web3Forms, Basin...). Empty = mailto hand-off ---------- */
if (endpoint) body = body.replace('<form id="enquiry"', `<form id="enquiry" action="${esc(endpoint)}" method="post" data-endpoint="${esc(endpoint)}"`);

/* ---------- 4. structured data ---------- */
const person = {
  '@type': 'Person', '@id': SITE + '#person', name: P.name, alternateName: P.alternateName, jobTitle: P.jobTitle,
  worksFor: {'@type': 'Organization', name: P.worksFor},
  address: {'@type': 'PostalAddress', addressLocality: P.city, addressCountry: P.countryCode},
  email: 'mailto:' + P.email, url: SITE, image: abs('og-image.png'), sameAs: P.sameAs, knowsAbout: P.knowsAbout,
};
const slug = s => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const seen = new Set(), works = [];
services.forEach(s => s.projects.forEach(p => {
  if (seen.has(p.title)) return; seen.add(p.title);
  const demo = /^demo/i.test(p.org), org = p.org.replace(/\s*·.*$/, '');
  works.push({
    '@type': 'CreativeWork', '@id': SITE + '#work-' + slug(p.title), name: p.title, description: p.outcome,
    url: SITE + (p.href || '#' + s.id), about: s.name, keywords: p.tags.join(', '),
    creativeWorkStatus: /in progress/i.test(p.org) ? 'Incomplete' : 'Published',
    creator: {'@id': SITE + '#person'},
    ...(demo ? {} : {sourceOrganization: {'@type': 'Organization', name: org}}),
  });
}));
const graph = {
  '@context': 'https://schema.org',
  '@graph': [
    {'@type': 'WebSite', '@id': SITE + '#website', url: SITE, name: P.alternateName, description: cfg.description, inLanguage: 'en', publisher: {'@id': SITE + '#person'}},
    {'@type': 'ProfilePage', '@id': SITE + '#webpage', url: SITE, name: cfg.title, isPartOf: {'@id': SITE + '#website'}, about: {'@id': SITE + '#person'}, mainEntity: {'@id': SITE + '#person'}, inLanguage: 'en'},
    person,
    {
      '@type': 'ProfessionalService', '@id': SITE + '#service', name: `${P.alternateName}: Data Analytics, Forecasting & AI`, url: SITE,
      description: cfg.description, image: abs('og-image.png'), email: P.email, founder: {'@id': SITE + '#person'},
      address: {'@type': 'PostalAddress', addressLocality: P.city, addressCountry: P.countryCode},
      areaServed: [{'@type': 'City', name: P.city}, {'@type': 'Country', name: P.country}], knowsAbout: P.knowsAbout,
      hasOfferCatalog: {'@type': 'OfferCatalog', name: 'Services', itemListElement: services.map(s => ({
        '@type': 'Offer', itemOffered: {'@type': 'Service', name: s.name, url: SITE + '#' + s.id, provider: {'@id': SITE + '#person'}},
      }))},
    },
    ...works,
  ],
};

/* ---------- 5. analytics hook: off unless site.config.json names a provider ---------- */
const A = cfg.analytics || {};
const analytics = {
  none: '',
  ga4: A.id && `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(A.id)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config',${JSON.stringify(A.id)});window.siteAnalytics=(n,p)=>gtag('event',n,p||{});</script>`,
  plausible: `<script defer data-domain="${esc(A.id || new URL(SITE).host)}" src="https://plausible.io/js/script.js"></script>
<script>window.plausible=window.plausible||function(){(plausible.q=plausible.q||[]).push(arguments)};window.siteAnalytics=(n,p)=>plausible(n,{props:p||{}});</script>`,
  vercel: `<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};window.siteAnalytics=(n,p)=>va('event',{name:n,data:p||{}});</script>
<script defer src="/_vercel/insights/script.js"></script>`,
}[A.provider || 'none'];
must(analytics !== undefined, `analytics.provider must be none, ga4, plausible or vercel (got "${A.provider}")`);
must(A.provider !== 'ga4' || A.id, 'analytics.provider ga4 needs analytics.id (G-XXXXXXX)');

/* ---------- 6. head ---------- */
const fontsCss = readFileSync(join(ROOT, 'assets/fonts', T.fonts), 'utf8').replaceAll('url(/fonts/', `url(${BASE}fonts/`);
const tidyCss = css => css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s+/gm, '').replace(/\n{2,}/g, '\n');
const icons = `<link rel="icon" href="${rel('favicon.ico')}" sizes="32x32">
<link rel="icon" href="${rel('favicon.svg')}" type="image/svg+xml">
<link rel="apple-touch-icon" href="${rel('apple-touch-icon.png')}">
<link rel="manifest" href="${rel('site.webmanifest')}">
<meta name="theme-color" content="${T.bg}">
<meta name="color-scheme" content="${T.scheme}">`;
const preload = T.preload.map(f => `<link rel="preload" href="${rel('fonts/' + f)}" as="font" type="font/woff2" crossorigin>`).join('\n');
const head = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(cfg.title)}</title>
<meta name="description" content="${esc(cfg.description)}">
<link rel="canonical" href="${SITE}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="author" content="${esc(P.name)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(P.alternateName)}">
<meta property="og:locale" content="en_US">
<meta property="og:url" content="${SITE}">
<meta property="og:title" content="${esc(cfg.title)}">
<meta property="og:description" content="${esc(cfg.description)}">
<meta property="og:image" content="${abs('og-image.png')}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(cfg.socialImageAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(cfg.title)}">
<meta name="twitter:description" content="${esc(cfg.description)}">
<meta name="twitter:image" content="${abs('og-image.png')}">
<meta name="twitter:image:alt" content="${esc(cfg.socialImageAlt)}">
${icons}
${preload}
<script>document.documentElement.classList.add('js')</script>${theme === 'merged' ? `\n<script>/* theme before first paint: saved choice, else night */\n(()=>{let t;try{t=localStorage.getItem('theme')}catch(e){}if(t!=='dark'&&t!=='light')t='dark';document.documentElement.dataset.theme=t})();</script>` : ''}
<style>
${tidyCss(fontsCss)}</style>
${tidyCss(pageCss)}${bodyStyles.map(s => '\n' + tidyCss(s)).join('')}
<script type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>${analytics ? '\n' + analytics : ''}`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
${head}
</head>
<body>
${body}
</body>
</html>
`;

/* ---------- 7. 404 page: same fonts and colours, points back into the one-page site ---------- */
const notFound = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Page not found · ${esc(P.alternateName)}</title>
<meta name="description" content="This page does not exist. Go back to ${esc(P.alternateName)}'s portfolio: data analytics, forecasting, machine learning and AI.">
<meta name="robots" content="noindex">
${icons}
${preload}
<style>
${tidyCss(fontsCss)}
*{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:${T.bg};color:${T.fg};font:17px/1.6 ${T.body};-webkit-font-smoothing:antialiased;display:grid;place-items:center;padding:24px max(16px,env(safe-area-inset-left,0px))}
main{max-width:560px;display:grid;gap:20px}
.brand{display:flex;align-items:center;gap:10px;font:700 18px ${T.display};letter-spacing:-.02em;margin:0}
.brand i{width:10px;height:10px;border-radius:50%;background:${T.dot}}
.code{font:400 13px ${T.mono};letter-spacing:.14em;color:${T.muted};margin:0}
h1{font:800 clamp(36px,7vw,60px)/1.02 ${T.display};letter-spacing:-.03em;margin:0;text-wrap:balance}
p{margin:0;color:${T.muted}}
nav{display:flex;flex-wrap:wrap;gap:8px 20px;align-items:center}
a{color:${T.fg};display:inline-flex;align-items:center;min-height:44px;text-underline-offset:4px;text-decoration-color:${T.accent}}
.btn{padding:0 22px;border-radius:999px;background:${T.fg};color:${T.bg};font-weight:600;text-decoration:none;min-height:48px}
:focus-visible{outline:2px solid ${T.accent};outline-offset:3px;border-radius:6px}
</style>
</head>
<body>
<main>
  <p class="brand"><i aria-hidden="true"></i>${esc(P.alternateName)}</p>
  <p class="code">Error 404</p>
  <h1>This page does not exist.</h1>
  <p>The link may be old or mistyped. Everything lives on one page, so start from the homepage or jump to a section.</p>
  <nav aria-label="Site sections">
    <a class="btn" href="${BASE}">Go to the homepage</a>
    <a href="${BASE}#services">Services</a>
    <a href="${BASE}#projects">Projects</a>
    <a href="${BASE}#contact">Contact</a>
  </nav>
</main>
</body>
</html>
`;

/* ---------- 8. write everything ---------- */
rmSync(OUT, {recursive: true, force: true});
mkdirSync(join(OUT, 'fonts'), {recursive: true});
writeFileSync(join(OUT, 'index.html'), html);
writeFileSync(join(OUT, '404.html'), notFound);
writeFileSync(join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${abs('sitemap.xml')}\n`);
const today = new Date().toISOString().slice(0, 10);
writeFileSync(join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>1.0</priority></url>
</urlset>
`);
writeFileSync(join(OUT, 'site.webmanifest'), JSON.stringify({
  name: `${P.alternateName} · Data Analytics, Forecasting & AI`, short_name: P.alternateName, description: cfg.description,
  start_url: BASE, scope: BASE, display: 'standalone', background_color: T.bg, theme_color: T.bg, lang: 'en',
  icons: [
    {src: rel('icon-192.png'), sizes: '192x192', type: 'image/png'},
    {src: rel('icon-512.png'), sizes: '512x512', type: 'image/png'},
    {src: rel('icon-maskable-512.png'), sizes: '512x512', type: 'image/png', purpose: 'maskable'},
  ],
}, null, 2) + '\n');
/* Netlify and Cloudflare Pages read _headers; GitHub Pages ignores it, harmlessly */
writeFileSync(join(OUT, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  X-Frame-Options: SAMEORIGIN
/fonts/*
  Cache-Control: public, max-age=31536000, immutable
`);
writeFileSync(join(OUT, '.nojekyll'), '');
const fontFiles = [...fontsCss.matchAll(/fonts\/([\w.-]+\.woff2)/g)].map(m => m[1]);
fontFiles.forEach(f => copyFileSync(join(ROOT, 'assets/fonts', f), join(OUT, 'fonts', f)));
const iconDir = join(ROOT, 'assets/icons', assetTheme);
must(existsSync(iconDir), `missing ${iconDir}: run npm run assets`);
readdirSync(iconDir).forEach(f => copyFileSync(join(iconDir, f), join(OUT, f)));
copyFileSync(join(ROOT, 'assets', `og-${assetTheme}.png`), join(OUT, 'og-image.png'));

console.log(`Built ${theme} site → ${OUT.replace(ROOT + '/', '')}/ (index ${(html.length / 1024).toFixed(1)} KB, ${fontFiles.length} fonts, canonical ${SITE}${endpoint ? ', form → ' + endpoint : ''})`);
