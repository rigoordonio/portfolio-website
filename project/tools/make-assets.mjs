#!/usr/bin/env node
/* Generate icons and the 1200x630 social image for both themes into assets/.
   Needs Playwright (dev dependency). Run after changing the brand mark or headline: npm run assets */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {chromium} from 'playwright';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FONTS = pathToFileURL(join(ROOT, 'assets/fonts')).href;

/* brand mark: the page's glowing dot on a dark tile */
const MARK = {
  dark: {tile: '#06070a', defs: `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7fe0d4"/><stop offset=".5" stop-color="#c9b8ff"/><stop offset="1" stop-color="#f2c58a"/></linearGradient>`},
  light: {tile: '#121212', defs: `<radialGradient id="g" cx=".38" cy=".36" r=".7"><stop offset="0" stop-color="#ffb627"/><stop offset="1" stop-color="#ff5a1f"/></radialGradient>`},
};
const svgMark = (t, {round = true, r = 15} = {}) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${MARK[t].defs}</defs><rect width="64" height="64"${round ? ' rx="14"' : ''} fill="${MARK[t].tile}"/><circle cx="32" cy="32" r="${r}" fill="url(#g)"/></svg>`;

/* .ico container holding PNG images (supported by every current browser) */
const ico = pngs => {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let off = head.length;
  pngs.forEach(({size, buf}, i) => {
    const e = 6 + i * 16;
    head.writeUInt8(size >= 256 ? 0 : size, e); head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6); head.writeUInt32LE(buf.length, e + 8); head.writeUInt32LE(off, e + 12);
    off += buf.length;
  });
  return Buffer.concat([head, ...pngs.map(p => p.buf)]);
};

const figure = readFileSync(join(ROOT, 'rigo-portfolio-light.html'), 'utf8').match(/<svg id="figure"[\s\S]*?<\/svg>/)[0];
const OG = {
  light: `<style>
@font-face{font-family:S;src:url(${FONTS}/schibsted-grotesk-latin.woff2) format('woff2');font-weight:400 800}
@font-face{font-family:M;src:url(${FONTS}/geist-mono-latin.woff2) format('woff2')}
body{margin:0;width:1200px;height:630px;background:#f7f7f5;color:#121212;font-family:S;overflow:hidden;position:relative}
.grid{position:absolute;inset:0;background:linear-gradient(rgba(18,18,18,.05) 1px,transparent 1px) 0 0/48px 48px,linear-gradient(90deg,rgba(18,18,18,.05) 1px,transparent 1px) 0 0/48px 48px;-webkit-mask:radial-gradient(70% 80% at 30% 50%,#000 30%,transparent 85%)}
.copy{position:absolute;left:72px;top:64px;width:640px;display:grid;gap:26px}
.brand{display:flex;align-items:center;gap:12px;font-weight:700;font-size:26px;letter-spacing:-.02em}
.brand i{width:16px;height:16px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ffb627,#ff5a1f);box-shadow:0 0 16px #ff5a1f}
h1{margin:18px 0 0;font-size:76px;font-weight:800;line-height:.98;letter-spacing:-.045em}
h1 em{font-style:normal;background:linear-gradient(90deg,#ff5a1f,#ffb627);-webkit-background-clip:text;color:transparent}
.meta{font-family:M;font-size:19px;letter-spacing:.06em;text-transform:uppercase;color:#5c5c58}
.fig{position:absolute;right:40px;bottom:-40px;width:430px;height:516px}
.fig svg{width:100%;height:100%}
</style><div class="grid"></div>
<div class="copy"><div class="brand"><i></i>Rigo Ordonio</div><h1>I turn commercial data into <em>forecasts</em> leaders trust.</h1><div class="meta">Global Business Analyst · Abu Dhabi</div></div>
<div class="fig">${figure}</div>
<script>const pts=[],p2=[];for(let i=0;i<=40;i++){const x=92+i*216/40,u=i/40,y=176-26*u+9*Math.sin(u*9+2.4)+4*Math.sin(u*23-1.4);pts.push(x+','+y);p2.push(x+','+(y+12+6*Math.sin(u*5+2)))}
document.getElementById('refl').setAttribute('points',pts.join(' '));document.getElementById('refl2').setAttribute('points',p2.join(' '));</script>`,
  dark: `<style>
@font-face{font-family:D;src:url(${FONTS}/bricolage-grotesque-latin.woff2) format('woff2');font-weight:400 800}
@font-face{font-family:M;src:url(${FONTS}/jetbrains-mono-latin.woff2) format('woff2')}
body{margin:0;width:1200px;height:630px;background:#06070a;color:#eceae4;font-family:D;overflow:hidden;position:relative}
.halo{position:absolute;right:-180px;top:-60px;width:900px;height:760px;background:radial-gradient(closest-side,rgba(42,35,80,.9),rgba(13,26,34,.6) 55%,transparent)}
.orb{position:absolute;right:-30px;top:140px;width:370px;height:370px;border-radius:50%;background:radial-gradient(circle at 34% 28%,rgba(255,255,255,.55),transparent 9%),radial-gradient(circle at 45% 40%,#14142a 0%,#07080d 70%);box-shadow:inset 0 0 50px 6px rgba(201,184,255,.45),inset -40px -50px 90px rgba(127,224,212,.35),inset 30px 20px 70px rgba(242,197,138,.18),0 0 120px 20px rgba(122,96,220,.28)}
.grid{position:absolute;inset:0;background:linear-gradient(rgba(127,224,212,.07) 1px,transparent 1px) 0 0/48px 48px,linear-gradient(90deg,rgba(127,224,212,.07) 1px,transparent 1px) 0 0/48px 48px;-webkit-mask:radial-gradient(70% 80% at 30% 50%,#000 30%,transparent 85%)}
.copy{position:absolute;left:72px;top:64px;width:720px;display:grid;gap:26px}
.brand{display:flex;align-items:center;gap:12px;font-weight:800;font-size:26px;letter-spacing:-.02em}
.brand i{width:14px;height:14px;border-radius:50%;background:conic-gradient(#7fe0d4,#c9b8ff,#f2c58a,#7fe0d4)}
h1{margin:18px 0 0;font-size:74px;font-weight:800;line-height:1;letter-spacing:-.03em}
h1 em{font-style:normal;background:linear-gradient(100deg,#7fe0d4,#c9b8ff 45%,#f2c58a);-webkit-background-clip:text;color:transparent}
.meta{font-family:M;font-size:19px;letter-spacing:.12em;text-transform:uppercase;color:#9aa0ab}
</style><div class="halo"></div><div class="orb"></div><div class="grid"></div>
<div class="copy"><div class="brand"><i></i>Rigo Ordonio</div><h1>I turn commercial data into forecasts leaders can <em>trust.</em></h1><div class="meta">Global Business Analyst · Abu Dhabi</div></div>`,
};

const browser = await chromium.launch();
const page = await browser.newPage();
const shot = async (html, w, h) => {
  await page.setViewportSize({width: w, height: h});
  await page.setContent(`<!doctype html><html><body style="margin:0">${html}</body></html>`, {waitUntil: 'load'});
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({type: 'png', omitBackground: true, clip: {x: 0, y: 0, width: w, height: h}}); /* transparent corners on rounded icons */
};
const svgImg = (svg, size) => `<img style="display:block;width:${size}px;height:${size}px" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}">`;

for (const t of ['light', 'dark']) {
  const dir = join(ROOT, 'assets/icons', t);
  mkdirSync(dir, {recursive: true});
  writeFileSync(join(dir, 'favicon.svg'), svgMark(t) + '\n');
  const sizes = {};
  for (const s of [16, 32, 48]) sizes[s] = await shot(svgImg(svgMark(t), s), s, s);
  writeFileSync(join(dir, 'favicon.ico'), ico([16, 32, 48].map(s => ({size: s, buf: sizes[s]}))));
  writeFileSync(join(dir, 'apple-touch-icon.png'), await shot(svgImg(svgMark(t, {round: false}), 180), 180, 180));
  writeFileSync(join(dir, 'icon-192.png'), await shot(svgImg(svgMark(t), 192), 192, 192));
  writeFileSync(join(dir, 'icon-512.png'), await shot(svgImg(svgMark(t), 512), 512, 512));
  writeFileSync(join(dir, 'icon-maskable-512.png'), await shot(svgImg(svgMark(t, {round: false, r: 12}), 512), 512, 512));
  await page.goto(pathToFileURL(join(ROOT, 'assets')).href + '/');   /* file:// origin so the local fonts load */
  writeFileSync(join(ROOT, 'assets', `og-${t}.png`), await shot(OG[t], 1200, 630));
  console.log(`assets/${t}: icons + og-${t}.png`);
}
await browser.close();
