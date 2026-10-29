# Production upgrade report

Done 2026-10-17 on both versions of the portfolio. The audit that came before it is in [AUDIT.md](AUDIT.md).

The two HTML pages are still the source of truth, with the same colours, fonts, layout and motion. The new build turns either page into a deployable site in `dist/` (light by default).

## Lighthouse, before and after

All runs used the same local server with gzip, in Lighthouse 13.5 with its default mobile throttling and the desktop preset. The audit's first numbers came from a server without gzip, so they differ by a few points.

| Version | Run | Performance | Accessibility | Best practices | SEO | LCP | CLS |
|---|---|---|---|---|---|---|---|
| Light | before, mobile | 89 | 96 | 96 | 90 | 2.7 s | 0 |
| Light | **after, mobile** | **100** | **100** | **100** | **100** | **1.7 s** | **0** |
| Light | before, desktop | 100 | 96 | 96 | 90 | 0.6 s | 0 |
| Light | **after, desktop** | **100** | **100** | **100** | **100** | **0.4 s** | **0** |
| Dark | before, mobile | 86 | 95 | 96 | 90 | 3.0 s | 0 |
| Dark | **after, mobile** | **97** | **100** | **100** | **100** | **2.0 s** | **0** |
| Dark | before, desktop | 94 | 95 | 96 | 90 | 0.8 s | 0.136 |
| Dark | **after, desktop** | **100** | **100** | **100** | **100** | **0.4 s** | **0** |

Every "after" score is 90 or more. LCP is under 2.5 s, CLS is 0 and Total Blocking Time is 10 ms or less. Lighthouse cannot measure INP in a lab run; blocking time that low is the lab signal for INP under 200 ms, and real-visitor INP will show in analytics or Search Console once the site is live.

## Command results

| Command | Result |
|---|---|
| `npm run build` | Builds `dist/` (index 98 KB, 26 KB gzipped, plus 4 font files) |
| `npm run check` (lint) | **57 of 57 checks pass**: html-validate with the recommended rules, plus SEO, links, JSON-LD and script checks, on both builds and both source pages |
| `npm test` | **58 of 58 browser tests pass** (29 per version) |
| `npm run lighthouse` | All four runs at 90 or more in every category (table above) |
| Type-check | Not applicable: the project has no TypeScript |

The raw outputs, including the before and after Lighthouse JSON reports, are in `reports/`.

**What the tests found and I fixed:**
- The closed mobile menu was invisible but its links were still reachable with Tab.
- Form fields showed focus only as a faint 1 px border colour change.
- Project links inside Services and some footer links were under 44 px tall or wide.
- Dimmed "peeking" cards in the dark carousel had 2.3:1 text contrast.
- Opening a deep link such as `/#forecasting` smooth-scrolled across the whole page instead of landing on the service.

## Files changed and why

### `rigo-portfolio-light.html` and `rigo-portfolio-dark.html`

**SEO and semantics**
- Added visible `h2` headings to About and Skills, and changed the dark ID card name from `h3` to a paragraph, so the heading order no longer skips.
- Light `h1`: the rotating words now come from CSS, so crawlers and screen readers read one sentence ("I turn commercial data into forecasts leaders trust") instead of "forecastsdashboardsautomationsAI tools".
- Project tiles are now `article`s with `h3` titles and stable ids, such as `#p-unified-forecast-model`, so Services can link to them.
- The Services intro and contact copy now name data analytics, forecasting, machine learning, data engineering and AI. The contact copy also names "AI data engineer" roles.

**Services** (the new feature, details below): replaced the dark 6-card grid and the light 6-row list with the 5-service accordion.

**Accessibility**
- Fixed contrast. The dark About words start at 40% instead of 22% (3.3:1, enough for large text). The light orange labels use a darker `--ember-ink` (#c2410c, 4.8 to 5.2:1). The dark carousel's peeking cards dim only their picture, so their text stays above 4.5:1.
- Raised tap targets to at least 44 px: dark logo link, LinkedIn link, chart dots, project links, footer links.
- Added a 2 px focus ring to form fields to match the rest of the site.
- The closed mobile menu is now hidden from the keyboard. The menu also closes when you tap outside it.
- Made the ticker and marquee `role="group"` with a label, so their `aria-label` is valid.
- Duplicate `id="motion"` on the motion style and script blocks became `motion-css` and `motion-js`.

**UI polish**
- Experience paragraphs and bullets are capped at 68 characters per line.
- Paragraphs use `text-wrap: pretty`, so no orphaned last words.
- Eyebrow and label styles set weight 400 explicitly, so the new About and Skills `h2` headings look exactly like the labels they replace.
- Dark: once the page scrolls, the header fades the content beneath it, as the light version already did, so the name no longer sits on top of scrolling text. A wrapped hero label keeps its dash on the first line.

**Footer:** it was one line. It now has a short description, quick links, email and LinkedIn, a copyright line with the current year, and Back to top.

**Contact form**
- Added a honeypot field and a 3-second time trap.
- Added `name` attributes and explicit input types.
- It posts to a form service when `formEndpoint` is set, and shows success and error states. Without an endpoint it opens a ready-made email.
- It sends a `contact_ready` or `contact_sent` event to analytics, if analytics is on.

**Performance**
- The dark headline now splits into words before the first paint instead of after it. This was the 0.136 CLS.
- Added metric-matched fallback fonts, so text does not jump when the web fonts arrive.
- Added a favicon. The missing one caused a console error.

### New files

| File | Why |
|---|---|
| `site.config.json` | One place for domain, SEO title and description, form endpoint, analytics and person details |
| `tools/build.mjs` | Builds `dist/`: full SEO head, canonical, Open Graph and Twitter tags, JSON-LD, self-hosted fonts with preload, icons, manifest, theme-color, pre-rendered Services, `robots.txt`, `sitemap.xml`, `404.html`, `_headers`, `.nojekyll` |
| `tools/check.mjs` | The lint step (see above) |
| `tools/test.mjs` | Playwright and axe browser tests |
| `tools/lighthouse.mjs` | Lighthouse runner, mobile and desktop |
| `tools/serve.mjs` | Local server with gzip and a real 404 status, used by preview and tests |
| `tools/make-assets.mjs` | Generates favicons, app icons and social images |
| `assets/fonts/*` | Self-hosted Latin and Latin Extended WOFF2 subsets. Only the variable weight ranges in use, with `font-display: swap` |
| `assets/icons/{light,dark}/*`, `assets/og-*.png` | Favicon set (ICO, SVG, Apple touch, 192, 512, maskable) and 1200x630 social images |
| `package.json`, `.gitignore`, `README.md` | Commands, dev dependencies at their current versions, and how to edit, build and deploy |
| `dist/` | The built light site, ready to upload |

### Structured data in `dist/index.html`

The JSON-LD includes:
- `WebSite` and `ProfilePage`
- `Person`: name, job title, EnerMech, Abu Dhabi, LinkedIn and skills
- `ProfessionalService`: the five services as an offer catalogue, serving Abu Dhabi and the UAE
- a `CreativeWork` for each of the 16 projects. Demos and the AI assistant are marked as not finished.

## The Services section

- One JSON block per page (`id="services-data"`) drives it. To add a project, add one line. The build pre-renders it into the HTML for search engines, and it is also fully readable without JavaScript.
- It has five services: Data Analytics (3 projects), Forecasting (3), Machine Learning (3 demos), Data Engineering & Pipelines (4) and AI / LLM Solutions (3). Each project shows its organisation, title, a one-line outcome and plain-text tags such as `Python · Databricks`. Projects that have a tile on the page link to it, and demos link to the AI portfolio.
- Layout: rows with 1 px dividers and no cards, boxes or shadows. Each row shows the name on the left, and the muted project count and "+" on the right. It uses two font weights. The accent colour appears only on the "+" and the links.
- Behaviour (updated 2026-10-17): tapping a row lifts it into a detail card that plays a short animation for that service, then lists its projects. Esc, the × or a click outside closes it, and focus returns to the row. A link such as `/#forecasting` opens that card. See `motion-notes.md` for every timing.
- Each row is a real `button` inside an `h3`, with `aria-expanded` and `aria-controls` pointing at the card, which is a native modal dialog. Focus stays inside it while open.

## Not changed, and why

- **Visual identity:** colours, fonts, layout, section order and motion effects are as they were. The only visible changes are the brief's items: Services, the footer, the new About and Skills headings, a slightly darker orange for small labels (contrast), the dark carousel's peeking cards (contrast), and the dark header's fade once you scroll (readability).
- **WebGL orb and particle chart (dark):** kept. They already pause off-screen, and the dark page still scores 97 on mobile.
- **AI portfolio carousel and card deck:** still rendered by JavaScript, as before. Their content is in the Services section and JSON-LD, so search engines see it either way.
- **Two pages instead of one:** kept, because you have not picked a main version. `"theme"` in `site.config.json` switches the build.
- **Cross-browser:** the tests ran in Chromium (Chrome and Edge engine), which is the only browser in this environment. The CSS used (`color-mix`, grid `0fr`/`1fr` transitions, `text-wrap`) is supported in current Safari and Firefox, and `text-wrap: pretty` simply has no effect where it is unsupported. Run `npm test` on a Mac with WebKit installed if you want Safari confirmed.
- **No deploy:** nothing is published to a public host. That waits for your domain and your go-ahead.

## Needs your input

1. **Domain:** the build assumes `https://rigoordonio.github.io/`. Tell me the real one, or I can set up GitHub Pages under your account.
2. **Main version:** light or dark. The build defaults to light.
3. **Form endpoint:** create a free Formspree (or similar) form and send me its URL, so messages reach your inbox directly.
4. **Analytics:** GA4 ID, Plausible or Vercel, or leave it off.
5. **Metrics:** most Services outcomes have no number yet. Send any figures you can publish, such as hours saved, forecast accuracy or report count.
6. **Tags I inferred:** the tech tags on each project come from the tools listed for that role on your CV, not from notes about the project itself. Please confirm or correct them.
7. **Photo, CV PDF and GitHub link:** a portrait would make the social card and the About section more personal. A downloadable CV and a GitHub link would help recruiters.
