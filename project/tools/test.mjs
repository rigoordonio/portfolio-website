#!/usr/bin/env node
/* Browser tests: builds each theme, serves it, and drives it in Chromium with Playwright.
   Covers the console, navigation and mobile menu, the Services detail card (open/close, focus trap, deep links,
   press, no-JS, reduced motion), the contact form (validation, spam traps, endpoint success and error),
   axe WCAG 2.2 AA scans and horizontal overflow at 375 to 1920 px, tap targets, and the 404 page.
   node tools/test.mjs [light|dark]        set HEADED=1 to watch */
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {serve} from './serve.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const themes = process.argv[2] ? [process.argv[2]] : ['light', 'dark'];
const WIDTHS = [375, 768, 1024, 1440, 1920];
const ENDPOINT = 'https://forms.example.test/submit';
const EMAIL = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8')).person.email;
/* headless Chromium renders WebGL in software and logs driver notices about it; they are not page errors */
const NOISE = /GPU stall due to ReadPixels|swiftshader|software WebGL|GL Driver Message|WebGL: CONTEXT_LOST/i;

let passed = 0, failed = 0;
const fails = [];
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failed++; fails.push(name); console.log(`  ✗ ${name}\n      ${String(e.message || e).split('\n').slice(0, 6).join('\n      ')}`); }
}
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
const eq = (a, b, msg) => assert(JSON.stringify(a) === JSON.stringify(b), `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

const browser = await chromium.launch({headless: !process.env.HEADED, args: ['--enable-unsafe-swiftshader']});

for (const theme of themes) {
  console.log(`\n${theme}`);
  const build = (out, extra = []) => execFileSync(process.execPath, [join(ROOT, 'tools/build.mjs'), '--theme', theme, '--out', out, ...extra], {stdio: 'pipe'});
  build(join(ROOT, '.build', theme));
  build(join(ROOT, '.build', theme + '-endpoint'), ['--endpoint', ENDPOINT]);
  const site = await serve(join(ROOT, '.build', theme));
  const siteEp = await serve(join(ROOT, '.build', theme + '-endpoint'));
  const problems = [];   // console errors, warnings, failed requests: checked at the end of the theme
  const pokes = {month: 41, off: false};   // stands in for /api/poke, which needs Redis

  const open = async (opts = {}, path = '', base = site.url) => {
    const {width = 1440, height = 900, reducedMotion = 'no-preference', js = true, touch, permissions, fast} = opts;
    const ctx = await browser.newContext({viewport: {width, height}, reducedMotion, colorScheme: process.env.SCHEME || 'light', javaScriptEnabled: js,
      hasTouch: touch ?? width < 800, isMobile: false, permissions});
    const page = await ctx.newPage();
    /* the GitHub graph's public data API: served locally so tests never depend on the network */
    await page.route('https://github-contributions-api.jogruber.de/**', r => r.fulfill({contentType: 'application/json', body: JSON.stringify({total: {2026: 55}, contributions: Array.from({length: 302}, (_, i) => { const c = (i * 7) % 11 < 2 ? (i % 4) + 1 : 0; return {date: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10), count: c, level: Math.min(c, 4)}; })})}));
    await page.route('**/api/poke', r => {
      if (pokes.off) return r.fulfill({contentType: 'application/json', body: JSON.stringify({enabled: false})});
      if (r.request().method() === 'POST') pokes.month++;
      r.fulfill({contentType: 'application/json', body: JSON.stringify({enabled: true, month: pokes.month, total: pokes.month + 100})});
    });
    const planned = url => url.startsWith(ENDPOINT) || url.includes('/missing-page');   // the mocked 500 and the 404 test
    page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !NOISE.test(m.text()) && !planned(m.location().url || '')) problems.push(`${width}px console.${m.type()}: ${m.text()}`); });
    page.on('pageerror', e => problems.push(`${width}px page error: ${e.message}`));
    page.on('requestfailed', r => { if (!r.url().startsWith(ENDPOINT)) problems.push(`request failed: ${r.url()} ${r.failure()?.errorText}`); });
    page.on('response', r => { if (r.status() >= 400 && !planned(r.url())) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
    await page.goto(base + path, {waitUntil: 'load'});
    if (js && !fast) await page.evaluate(() => document.fonts.ready);
    return {page, ctx, close: () => ctx.close()};
  };
  /* scroll through once so every reveal and lazy part has run, then return to the top */
  const scrollThrough = async page => {
    await page.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * .6) { scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); }
      scrollTo(0, 0); await new Promise(r => setTimeout(r, 300));
    });
  };
  const axe = async page => {
    if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({content: AXE});
    return page.evaluate(async () => (await window.axe.run(document, {
      runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']},
    })).violations.map(v => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`));
  };
  const accState = page => page.$$eval('.acc-item', els => els.map(el => {
    const b = el.querySelector('.acc-btn'), p = el.querySelector('.acc-panel'), cs = getComputedStyle(p);
    return {id: el.id, open: el.classList.contains('is-open'), expanded: b.getAttribute('aria-expanded'),
      controls: b.getAttribute('aria-controls') === p.id, visible: cs.visibility === 'visible' && p.getBoundingClientRect().height > 20};
  }));
  const settle = page => page.waitForTimeout(450);

  /* ---------- page basics ---------- */
  await test('loads with the right title, one h1 and the pre-rendered services', async () => {
    const {page, close} = await open();
    assert((await page.title()).length >= 50, 'title too short');
    eq(await page.locator('h1').count(), 1, 'h1 count');
    const raw = await (await page.request.get(site.url)).text();
    assert(raw.includes('id="forecasting-panel"'), 'services are not in the served HTML');
    eq((await accState(page)).length, 5, 'service rows');
    await close();
  });

  await test('headings stay in order after scripts render the carousel and cards', async () => {
    const {page, close} = await open();
    const levels = await page.$$eval('h1,h2,h3,h4,h5,h6', hs => hs.filter(h => !h.closest('[aria-hidden="true"]')).map(h => +h.tagName[1]));
    const skips = levels.map((l, i) => i && l > levels[i - 1] + 1 ? `h${levels[i - 1]}→h${l}` : '').filter(Boolean);
    assert(!skips.length && levels[0] === 1, 'heading skips: ' + skips.join(', '));
    await close();
  });

  /* ---------- navigation ---------- */
  await test('navbar links scroll to their section and mark it current', async () => {
    const {page, close} = await open();
    for (const id of ['services', 'contact', 'about']) {
      await page.click(`#site-nav a[href="#${id}"]`);
      await page.waitForFunction(id => Math.abs(document.getElementById(id).getBoundingClientRect().top) < 140, id, {timeout: 4000});
      await page.waitForFunction(id => document.querySelector(`#site-nav a[href="#${id}"]`).getAttribute('aria-current') === 'true', id, {timeout: 2000});
    }
    eq(await page.$$eval('#site-nav a[aria-current]', a => a.length), 1, 'links marked current');
    await close();
  });

  await test('skip link is the first tab stop and moves focus to main', async () => {
    const {page, close} = await open();
    await page.keyboard.press('Tab');
    await page.waitForFunction(() => /^(none|matrix\(1, 0, 0, 1, 0, 0\))$/.test(getComputedStyle(document.activeElement).transform), null, {timeout: 3000}).catch(() => {});   // it slides in
    const skip = await page.evaluate(() => { const a = document.activeElement, r = a.getBoundingClientRect(); return {cls: a.className, inView: r.top >= 0 && r.bottom <= innerHeight && r.width > 0}; });
    assert(skip.cls.includes('skip') && skip.inView, 'first Tab did not show the skip link: ' + JSON.stringify(skip));
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.activeElement.id === 'main' || location.hash === '#main', null, {timeout: 2000});
    await close();
  });

  await test('keyboard focus is always visible', async () => {
    const {page, close} = await open();
    await page.keyboard.press('Tab');
    const missing = [];
    for (const sel of ['#site-nav a', '.acc-btn', '#enquiry input', '#enquiry select', '#enquiry textarea', '#enquiry button[type=submit]', 'footer a', '.copy']) {
      await page.locator(sel).first().focus();
      const ring = await page.evaluate(() => { const cs = getComputedStyle(document.activeElement);
        return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2 || /rgb/.test(cs.boxShadow) && cs.boxShadow !== 'none'; });
      if (!ring) missing.push(sel);
    }
    assert(!missing.length, 'no visible focus on: ' + missing.join(', '));
    await close();
  });

  await test('mobile menu opens, closes on link, Escape and outside tap, and hides links while closed', async () => {
    const {page, close} = await open({width: 375, height: 760});
    const navVisible = () => page.$eval('#site-nav', n => getComputedStyle(n).visibility === 'visible');
    assert(await page.isVisible('.menu-btn'), 'menu button hidden at 375px');
    assert(!(await navVisible()), 'closed menu links are still visible or focusable');
    await page.click('.menu-btn'); await settle(page);
    assert(await navVisible(), 'menu did not open'); eq(await page.getAttribute('.menu-btn', 'aria-expanded'), 'true', 'aria-expanded');
    await page.click('#site-nav a[href="#services"]'); await settle(page);
    eq(await page.getAttribute('.menu-btn', 'aria-expanded'), 'false', 'menu after choosing a link');
    await page.click('.menu-btn'); await page.keyboard.press('Escape'); await settle(page);
    eq(await page.getAttribute('.menu-btn', 'aria-expanded'), 'false', 'menu after Escape');
    eq(await page.evaluate(() => document.activeElement.classList.contains('menu-btn')), true, 'focus returns to the menu button');
    await page.click('.menu-btn'); await page.mouse.click(180, 600); await settle(page);
    eq(await page.getAttribute('.menu-btn', 'aria-expanded'), 'false', 'menu after tapping outside');
    await close();
  });

  /* ---------- services: tap a row, it lifts into a detail card ---------- */
  const SPELLS = {'data-analytics': 'bars', forecasting: 'line', 'machine-learning': 'cluster', 'data-engineering': 'pipeline', 'ai-llm': 'prompt'};
  const dlgState = page => page.evaluate(() => {
    const d = document.getElementById('svc-detail'), a = document.activeElement;
    return {open: d.open, title: d.querySelector('.svc-title').textContent, items: d.querySelectorAll('.svc-list li').length,
      focusInside: d.contains(a), expanded: [...document.querySelectorAll('.acc-btn')].map(b => b.getAttribute('aria-expanded')),
      spell: d.querySelector('.svc-stage svg')?.dataset.spell || null, active: a?.id || a?.className};
  });
  /* wait until smooth scrolling has stopped (the dark page scrolls smoothly) */
  const still = async page => { let a = -1, b = await page.evaluate(() => scrollY); while (a !== b) { await page.waitForTimeout(150); a = b; b = await page.evaluate(() => scrollY); } };
  const openRow = async (page, id) => { await page.locator('#' + id + '-btn').scrollIntoViewIfNeeded(); await still(page); await page.click('#' + id + '-btn'); await page.waitForTimeout(1300); };

  await test('services: rows are buttons wired to the detail dialog, each with its spell icon', async () => {
    const {page, close} = await open();
    const s = await accState(page);
    eq(s.map(x => x.id), Object.keys(SPELLS), 'service ids');
    eq(s.map(x => x.expanded), ['false', 'false', 'false', 'false', 'false'], 'aria-expanded');
    eq(await page.$$eval('.acc-btn', b => b.every(x => x.tagName === 'BUTTON' && x.closest('h3') && x.getAttribute('aria-controls') === 'svc-detail' && x.getAttribute('aria-haspopup') === 'dialog')), true, 'buttons in headings, controlling the dialog');
    eq(await page.$$eval('.acc-item', els => els.map(e => e.querySelector('.svc-ico')?.dataset.spell)), Object.values(SPELLS), 'row icons');
    eq(await page.$$eval('.svc-ico,.svc-stage', e => e.every(x => x.getAttribute('aria-hidden') === 'true')), true, 'spells hidden from screen readers');
    await close();
  });

  await test('services: a tap opens the card with its spell and projects, without moving the page', async () => {
    const {page, close} = await open();
    for (const [id, spell] of Object.entries(SPELLS)) {
      await page.$eval('#' + id + '-btn', b => b.scrollIntoView({block: 'center', behavior: 'instant'})); await still(page);   // centred, so the fixed header never covers it
      const y = await page.evaluate(() => scrollY);
      await page.click('#' + id + '-btn'); await page.waitForTimeout(1300);
      const st = await dlgState(page);
      assert(st.open && st.focusInside, id + ': dialog not open or focus outside it');
      eq(st.spell, spell, id + ' spell');
      eq(st.items, await page.$$eval(`#${id} .acc-list li`, l => l.length), id + ' projects');
      eq(await page.evaluate(() => scrollY), y, id + ': page scrolled');
      const pos = await page.evaluate(() => { const r = document.querySelector('.svc-card').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight + 1 && r.left >= 0 && r.right <= innerWidth + 1; });
      assert(pos, id + ': card is off screen');
      eq(await page.evaluate(() => getComputedStyle(document.querySelector('.svc-scrim')).opacity), '1', id + ' scrim');
      await page.click('.svc-close'); await page.waitForTimeout(1000);
      eq((await dlgState(page)).open, false, id + ' closed');
    }
    await close();
  });

  await test('services: Esc, the close button and a click outside close it, and focus returns to the row', async () => {
    const {page, close} = await open();
    for (const how of ['esc', 'button', 'outside']) {
      await openRow(page, 'forecasting');
      eq((await dlgState(page)).expanded[1], 'true', how + ': aria-expanded while open');
      if (how === 'esc') await page.keyboard.press('Escape');
      else if (how === 'button') await page.click('.svc-close');
      else await page.mouse.click(4, 4);
      await page.waitForTimeout(1000);
      const st = await dlgState(page);
      eq([st.open, st.active, st.expanded[1]], [false, 'forecasting-btn', 'false'], how);
    }
    await close();
  });

  await test('services: Tab and Shift+Tab stay inside the open card', async () => {
    const {page, close} = await open();
    await openRow(page, 'data-engineering');
    for (const key of ['Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
      await page.keyboard.press(key);
      assert((await dlgState(page)).focusInside, 'focus left the card after ' + key);
    }
    await close();
  });

  await test('services: Enter opens a row from the keyboard', async () => {
    const {page, close} = await open();
    await page.locator('#machine-learning-btn').scrollIntoViewIfNeeded();
    await page.focus('#machine-learning-btn'); await page.keyboard.press('Enter'); await page.waitForTimeout(1300);
    const st = await dlgState(page);
    eq([st.open, st.title, st.focusInside], [true, 'Machine Learning', true], 'after Enter');
    await close();
  });

  await test('services: closing mid-flight reverses smoothly and leaves no stuck state', async () => {
    const {page, close} = await open();
    await page.locator('#ai-llm-btn').scrollIntoViewIfNeeded();
    await page.click('#ai-llm-btn'); await page.waitForTimeout(140); await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    const st = await dlgState(page);
    eq([st.open, st.expanded[4]], [false, 'false'], 'after interrupt');
    eq(await page.evaluate(() => document.documentElement.classList.contains('svc-lock')), false, 'scroll lock released');
    await openRow(page, 'ai-llm'); eq((await dlgState(page)).open, true, 'opens again');
    await close();
  });

  await test('services: press scales the row to 0.97 in 100ms; motion values come from the tokens', async () => {
    const {page, close} = await open();
    const b = page.locator('#forecasting-btn'); await b.scrollIntoViewIfNeeded(); await still(page);
    const box = await b.boundingBox();
    await page.mouse.move(box.x + 40, box.y + box.height / 2); await page.mouse.down(); await page.waitForTimeout(160);
    const sc = await page.$eval('#forecasting-btn', e => new DOMMatrixReadOnly(getComputedStyle(e).transform).a);
    assert(Math.abs(sc - .97) < .002, 'pressed scale ' + sc);
    await page.mouse.move(4, 4); await page.mouse.up(); await page.waitForTimeout(700);
    eq(await page.$eval('#forecasting-btn', e => new DOMMatrixReadOnly(getComputedStyle(e).transform).a), 1, 'released scale');
    eq(await page.evaluate(() => getComputedStyle(document.getElementById('services')).getPropertyValue('--acc-ease').trim()), 'cubic-bezier(.22,1,.36,1)', '--acc-ease token');
    await close();
  });

  await test('services: no long tasks while the card opens and the spell plays', async () => {
    const {page, close} = await open();
    await page.locator('#data-analytics-btn').scrollIntoViewIfNeeded(); await page.waitForTimeout(1500);
    await page.evaluate(() => { window.__lt = []; new PerformanceObserver(l => window.__lt.push(...l.getEntries().map(e => e.duration))).observe({type: 'longtask'}); });
    await page.click('#data-analytics-btn'); await page.waitForTimeout(1300);
    const lt = await page.evaluate(() => window.__lt);
    assert(!lt.some(d => d > 100), 'long tasks: ' + lt.map(Math.round).join(', '));
    await close();
  });

  await test('services: a deep link like /#forecasting opens that card', async () => {
    const {page, close} = await open({}, '#forecasting');
    await page.waitForTimeout(1300);
    const st = await dlgState(page);
    eq([st.open, st.title], [true, 'Forecasting'], 'deep link');
    await page.keyboard.press('Escape'); await page.waitForTimeout(900);
    await page.evaluate(() => { location.hash = '#data-engineering'; }); await page.waitForTimeout(1300);
    eq((await dlgState(page)).title, 'Data Engineering & Pipelines', 'hashchange');
    await close();
  });

  await test('services: reduced motion uses a 150ms crossfade and shows each spell at rest', async () => {
    const {page, close} = await open({reducedMotion: 'reduce'});
    await page.locator('#forecasting-btn').scrollIntoViewIfNeeded();
    await page.click('#forecasting-btn'); await page.waitForTimeout(250);
    const r = await page.evaluate(() => ({open: document.getElementById('svc-detail').open,
      running: document.querySelector('.svc-stage svg').getAnimations({subtree: true}).length,
      veil: getComputedStyle(document.querySelector('.svc-stage .veil')).transform,
      card: getComputedStyle(document.querySelector('.svc-card')).opacity}));
    eq([r.open, r.running, r.card], [true, 0, '1'], 'reduced motion open');
    assert(/matrix\(0,/.test(r.veil), 'forecast hidden under reduced motion: ' + r.veil);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    eq((await dlgState(page)).open, false, 'closed within 300ms');
    await close();
  });

  await test('services: axe is clean with the card open', async () => {
    const {page, close} = await open();
    await openRow(page, 'ai-llm');
    const v = await axe(page); assert(!v.length, v.join('\n'));
    await close();
  });

  await test('without JavaScript every service panel and every section is readable', async () => {
    const {page, close} = await open({js: false});
    await page.waitForTimeout(2500);   // the hero's CSS entrance animation still runs without JS
    const s = await accState(page);
    assert(s.every(x => x.visible), 'hidden panels without JS: ' + s.filter(x => !x.visible).map(x => x.id));
    eq(await page.$$eval('.acc-icon', i => i.filter(x => getComputedStyle(x).display !== 'none').length), 0, 'open/close icons shown without JS');
    const hidden = await page.$$eval('main h1, main h2, main h3, main p', els => els.filter(e => { const cs = getComputedStyle(e); return cs.visibility === 'hidden' || +cs.opacity < .99; }).length);
    eq(hidden, 0, 'invisible text without JS');
    await close();
  });

  /* ---------- contact form ---------- */
  const fill = async page => {
    await page.fill('#f-name', 'Test Person'); await page.fill('#f-email', 'test@example.com');
    await page.fill('#f-co', 'Example Co'); await page.selectOption('#f-svc', {label: 'Forecasting'});
    await page.fill('#f-msg', 'We need a rolling revenue forecast for four regions.');
  };
  const note = page => page.$eval('#form-note', n => ({text: n.textContent.trim(), cls: n.className, href: n.querySelector('a')?.getAttribute('href') || ''}));

  await test('form: empty submit shows errors, marks fields invalid and focuses the first one', async () => {
    const {page, close} = await open();
    await page.click('#send');
    eq(await page.$$eval('#enquiry [aria-invalid="true"]', e => e.map(x => x.id)), ['f-name', 'f-email', 'f-msg'], 'invalid fields');
    eq(await page.evaluate(() => document.activeElement.id), 'f-name', 'focused field');
    assert((await page.textContent('#e-email')).length > 5, 'no email error text');
    assert((await note(page)).text.includes('Check the highlighted fields'), 'no summary note');
    await page.fill('#f-name', 'A'); eq(await page.getAttribute('#f-name', 'aria-invalid'), 'false', 'error clears while typing');
    eq(await page.$$eval('#enquiry input:not([type=hidden]):not(#f-hp), #enquiry select, #enquiry textarea', e => e.filter(x => !x.closest('label')).length), 0, 'controls without a label');
    eq(await page.$$eval('#f-name,#f-email,#f-co', e => e.map(x => x.autocomplete)), ['name', 'email', 'organization'], 'autocomplete');
    await close();
  });

  await test('form: without an endpoint, a valid message opens as a ready email', async () => {
    const {page, close} = await open();
    await page.waitForTimeout(3100);   // past the 3 s bot trap
    await fill(page); await page.click('#send');
    const n = await note(page);
    assert(n.text.startsWith('Your message is ready'), 'note: ' + n.text);
    assert(n.href.startsWith(`mailto:${EMAIL}?subject=Enquiry%3A%20Forecasting&body=`), 'mailto link: ' + n.href);
    await close();
  });

  await test('form: honeypot and too-fast submits look sent but send nothing', async () => {
    const {page, close} = await open({fast: true}, '', siteEp.url);
    let calls = 0; await page.route(ENDPOINT, r => { calls++; r.fulfill({status: 200, body: '{}'}); });
    await page.evaluate(() => {   // a bot fills and submits in one go, well under 3 s after load
      const set = (id, v) => { document.getElementById(id).value = v; };
      set('f-name', 'Bot'); set('f-email', 'bot@example.com'); set('f-msg', 'Buy cheap links for your website today.');
      document.getElementById('enquiry').requestSubmit();
    });
    assert((await note(page)).text.includes('has been sent'), 'fast submit note');
    await page.waitForTimeout(3100);
    await fill(page); await page.$eval('#f-hp', i => { i.value = 'http://spam.example'; }); await page.click('#send');
    assert((await note(page)).text.includes('has been sent'), 'honeypot note');
    eq(calls, 0, 'requests sent for spam');
    eq(await page.$eval('#f-hp', i => [i.tabIndex, i.closest('[aria-hidden="true"]') !== null]), [-1, true], 'honeypot hidden from people');
    await close();
  });

  await test('form: with an endpoint, success resets the form and failure explains what to do', async () => {
    const {page, close} = await open({}, '', siteEp.url);
    let body = '', status = 200;
    await page.route(ENDPOINT, r => { body = r.request().postData() || ''; r.fulfill({status, contentType: 'application/json', body: '{"ok":true}'}); });
    await page.waitForTimeout(3100);
    await fill(page); await page.click('#send');
    await page.waitForFunction(() => document.querySelector('#form-note').textContent.includes('reply by email'));
    assert(body.includes('Test Person') && body.includes('test@example.com') && body.includes('_gotcha'), 'posted fields');
    eq(await page.inputValue('#f-name'), '', 'form reset after success');
    status = 500; await fill(page); await page.click('#send');
    await page.waitForFunction(() => document.querySelector('#form-note').classList.contains('bad'));
    const n = await note(page);
    assert(n.text.startsWith('Sorry') && n.href === `mailto:${EMAIL}`, 'error note: ' + n.text);
    eq(await page.inputValue('#f-name'), 'Test Person', 'form kept after failure');
    eq(await page.getAttribute('#send', 'aria-busy'), null, 'button left busy');
    await close();
  });

  await test('poke: the total is shared, so pokes from two visitors add up', async () => {
    const a = await open(), b = await open();
    const reach = async p => { await p.evaluate(() => scrollTo(0, 1400)); await p.waitForSelector('.poke.on'); };
    const shown = p => p.$eval('.pk-n', e => e.textContent);
    await reach(a.page); await reach(b.page);
    await a.page.waitForFunction(() => document.querySelector('.pk-n').textContent === '41');
    eq([await shown(a.page), await a.page.$eval('.pk-lbl', e => e.textContent)], ['41', 'Pokes this month'], 'starts from the shared total');
    await a.page.click('.pk-btn');
    await a.page.waitForFunction(() => document.querySelector('.pk-n').textContent === '42');
    await b.page.click('.pk-btn');
    await b.page.waitForFunction(() => document.querySelector('.pk-n').textContent === '43');
    await a.page.reload({waitUntil: 'load'}); await reach(a.page);
    await a.page.waitForFunction(() => document.querySelector('.pk-n').textContent === '43');
    eq(pokes.month, 43, 'the server holds both pokes');
    await a.close(); await b.close();
  });

  await test('poke: without the shared counter it falls back to this visitor\'s own pokes', async () => {
    pokes.off = true;
    try {
      const v = await open();
      await v.page.evaluate(() => scrollTo(0, 1400)); await v.page.waitForSelector('.poke.on');
      await v.page.click('.pk-btn');
      await v.page.waitForFunction(() => document.querySelector('.pk-n').textContent === '1');
      eq(await v.page.$eval('.pk-lbl', e => e.textContent), 'Your pokes', 'label');
      await v.close();
    } finally { pokes.off = false; }
  });

  await test('copy button copies the email address', async () => {
    const {page, close} = await open({permissions: ['clipboard-read', 'clipboard-write']});
    await page.locator('.copy').scrollIntoViewIfNeeded(); await page.click('.copy');
    eq(await page.evaluate(() => navigator.clipboard.readText()), EMAIL, 'clipboard');
    await close();
  });

  /* ---------- theme features that must keep working ---------- */
  if (theme !== 'dark') {
    await test('light: card deck deals, and the chart loupe reads out a value', async () => {
      const {page, close} = await open();
      const topCard = () => page.$$eval('#deck .pcard', c => c.findIndex(x => x.getAttribute('aria-hidden') === 'false'));
      const before = await topCard(); await page.click('#next'); await settle(page);
      assert((await topCard()) !== before, 'deck did not move');
      const box = await page.locator('#chart').boundingBox(); await page.locator('#chart').scrollIntoViewIfNeeded();
      await page.waitForTimeout(800);   // smooth scroll
      const b2 = await page.locator('#chart').boundingBox();
      await page.mouse.move(b2.x + b2.width * .6, b2.y + b2.height * .5);
      assert(!(await page.textContent('#readout')).includes('Hover or drag'), 'loupe readout did not change');
      assert(box.width > 100, 'chart has no size');
      await close();
    });
  } else {
    await test('dark: carousel moves and the particle chart switches mode', async () => {
      const {page, close} = await open();
      const pos = () => page.$eval('#rail', r => r.scrollLeft);
      const before = await pos(); await page.locator('#next').scrollIntoViewIfNeeded(); await page.click('#next'); await page.waitForTimeout(900);
      assert((await pos()) > before, 'carousel did not move');
      const dots = page.locator('.dots button');
      await dots.nth(1).scrollIntoViewIfNeeded(); await dots.nth(1).click();
      eq(await dots.evaluateAll(b => b.map(x => x.getAttribute('aria-pressed'))), ['false', 'true', 'false'], 'pressed state');
      await close();
    });
  }

  /* ---------- layout, targets and axe at each width ---------- */
  for (const width of WIDTHS) {
    await test(`${width}px: no horizontal scroll, no content wider than the screen, axe finds no WCAG 2.2 AA issues`, async () => {
      const {page, close} = await open({width, height: width < 800 ? 800 : 900, reducedMotion: 'reduce'});
      await scrollThrough(page);
      const wide = await page.evaluate(() => {
        const W = document.documentElement.clientWidth, out = [];
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
          if (!r.width || r.right <= W + 1 || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
          let a = el.parentElement, clipped = false;
          while (a && a !== document.body) { if (/hidden|clip|auto|scroll/.test(getComputedStyle(a).overflowX)) { clipped = true; break; } a = a.parentElement; }
          if (!clipped) out.push(`${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${[...el.classList].join('.')} right=${Math.round(r.right)}`);
        }
        return {scroll: document.documentElement.scrollWidth - W, out: out.slice(0, 5)};
      });
      assert(wide.scroll <= 0 && !wide.out.length, `overflow ${wide.scroll}px; wider than screen: ${wide.out.join(', ')}`);
      const v = await axe(page);
      assert(!v.length, v.join('\n'));
      await close();
    });
  }

  await test('375px: every standalone tap target is at least 44x44', async () => {
    const {page, close} = await open({width: 375, height: 800, reducedMotion: 'reduce'});
    await page.click('.menu-btn'); await settle(page);
    const small = await page.evaluate(() => [...document.querySelectorAll('a,button,input,select,textarea,summary')].filter(el => {
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      if (!r.width || cs.visibility === 'hidden' || el.closest('[aria-hidden="true"],.skip,.hp')) return false;
      if (cs.display === 'inline' && el.closest('p,li')?.textContent.trim().length > el.textContent.trim().length + 2) return false;   // links inside a sentence
      return r.height < 43.5 || r.width < 43.5;
    }).map(el => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${[...el.classList].join('.')} "${el.textContent.trim().slice(0, 20)}" ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`));
    assert(!small.length, small.slice(0, 8).join('\n'));
    await close();
  });

  await test('1440px with motion on: axe is clean after the reveal animations finish', async () => {
    const {page, close} = await open();
    await scrollThrough(page);
    const v = [];
    for (const id of ['services', 'ai-portfolio', 'contact']) {   // axe only judges contrast on screen, so stop at each busy section
      await page.evaluate(id => document.getElementById(id).scrollIntoView({behavior: 'instant'}), id); await page.waitForTimeout(1500);
      v.push(...(await axe(page)).map(x => `#${id}: ${x}`));
    }
    assert(!v.length, v.join('\n'));
    await close();
  });

  await test('640px (a 1280px screen at 200% zoom): nothing overflows', async () => {
    const {page, close} = await open({width: 640, height: 400, reducedMotion: 'reduce'});
    await scrollThrough(page);
    eq(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0, 'horizontal overflow');
    await close();
  });

  /* ---------- 404 and crawl files ---------- */
  await test('unknown URLs get the 404 page with a 404 status', async () => {
    const {page, close} = await open({}, 'missing-page');
    eq((await page.request.get(site.url + 'missing-page')).status(), 404, 'status');
    assert((await page.textContent('h1')).includes('does not exist'), '404 heading');
    eq(await page.getAttribute('a.btn', 'href'), '/', 'home link');
    const v = await axe(page); assert(!v.length, v.join('\n'));
    await close();
  });

  await test('robots.txt, sitemap.xml, manifest, icons and social image are served', async () => {
    const ctx = await browser.newContext();
    for (const [f, type] of [['robots.txt', 'text/plain'], ['sitemap.xml', 'application/xml'], ['site.webmanifest', 'application/manifest+json'],
      ['favicon.ico', 'image/x-icon'], ['favicon.svg', 'image/svg+xml'], ['apple-touch-icon.png', 'image/png'], ['icon-192.png', 'image/png'],
      ['icon-512.png', 'image/png'], ['icon-maskable-512.png', 'image/png'], ['og-image.png', 'image/png']]) {
      const r = await ctx.request.get(site.url + f);
      assert(r.status() === 200 && r.headers()['content-type'].startsWith(type), `${f}: ${r.status()} ${r.headers()['content-type']}`);
    }
    await ctx.close();
  });

  await test('no console errors or warnings, failed requests or missing files on any page load above', async () => {
    const uniq = [...new Set(problems)];
    assert(!uniq.length, uniq.slice(0, 10).join('\n'));
  });

  site.close(); siteEp.close();
}

await browser.close();
console.log(`\n${passed} passed, ${failed} failed${failed ? ':\n  - ' + fails.join('\n  - ') : ''}`);
process.exit(failed ? 1 : 0);
