# Website audit (before changes)

Audited 2026-10-17 on both versions: `rigo-portfolio-dark.html` and `rigo-portfolio-light.html`.
Tools: Lighthouse 13.5 (mobile and desktop presets), axe-core 4.14 at 375, 768, 1024, 1440 and 1920 px, and a Playwright structure crawl.

## Stack and architecture

- **Two standalone single-file pages** (dark 74 KB, light 68 KB). Inline CSS and vanilla JS, no framework, no build step, no `package.json`, no lint or test commands in the project.
- **Routing:** one page with hash sections (`#about`, `#experience`, `#services`, `#projects`, `#contact`).
- **Design tokens** live on `:root`.
  - Dark: `--ink`, `--ink-2`, `--line`, `--fg`, `--fg-dim`, accents `--tide`, `--pearl`, `--amber`; fonts Bricolage Grotesque, Figtree, JetBrains Mono.
  - Light: `--paper`, `--card`, `--ink`, `--ink-2`, `--rule`, accents `--ember`, `--gold`; fonts Schibsted Grotesk, Geist Mono.
- **Motion layer** sits in its own style and script blocks at the end of each file.
- **Hosting:** only private Claude previews today. There is no domain, `<head>` metadata or deployable folder.

## Baseline Lighthouse

| Version | Perf (mobile / desktop) | Accessibility | Best practices | SEO | Mobile LCP | Desktop CLS |
|---|---|---|---|---|---|---|
| Dark | 83 / 95 | 95 | 96 | 90 | 3.3 s | 0.136 |
| Light | 88 / 99 | 96 | 96 | 90 | 2.9 s | 0 |

## Top issues, ranked

**Technical SEO**
1. High: no meta description, canonical, Open Graph or Twitter tags, structured data, `robots.txt`, `sitemap.xml`, 404 page or favicon. The missing favicon also causes a console error, which costs Best Practices points.
2. High: the heading outline is broken. About and Skills have no `<h2>`, and the dark page puts an `<h3>` before any `<h2>` (axe flags `heading-order`). The light `<h1>` source text reads "forecastsdashboardsautomationsAI tools" to crawlers.
3. Medium: the target keywords (machine learning, data engineering, AI data engineer, Abu Dhabi) barely appear in key places.
4. Medium: project tiles are not headings or articles, and nothing links a service to the projects behind it.

**Performance**
1. High on mobile: the Google Fonts stylesheet blocks rendering for 0.8 to 1.6 s, which pushes mobile LCP to 2.9 to 3.3 s.
2. Medium: dark desktop CLS is 0.136, because the headline is split into animated words after the first paint.
3. Low: the dark WebGL orb and particles use the main thread heavily, but they already pause off-screen, so they stay.

**Accessibility**
1. High: two contrast failures. Dark About words sit at 1.74:1 before they light up, and light 12 px orange labels sit at 2.9 to 3.1:1.
2. Medium: several tap targets are under 44 px (dark logo link 29 px tall, LinkedIn link 27 px tall, chart dots 30 px wide).
3. Medium: `id="motion"` is used twice, which is invalid HTML.
4. Low: experience bullets run 84 to 130 characters per line.

**UI/UX**
1. Medium: the footer is a single line with no contact details, socials or quick links.
2. Medium: Services is a 6-card grid (dark) or a 6-row list (light). The brief asks for a 5-service accordion.
3. Low: paragraphs leave orphaned last words.

**Production readiness**
1. High: the contact form isn't connected to anything and has no spam protection.
2. Medium: there's no web manifest, theme-color, social share image, analytics hook, or build, lint and test commands.

## Plan

1. Keep the two HTML files as the single source of truth, since they also power the live previews.
2. Add `tools/build.mjs`. It turns the chosen version into a deployable `dist/` folder with:
   - full `<head>` SEO and JSON-LD
   - self-hosted fonts
   - favicons, manifest and social share image
   - `robots.txt`, `sitemap.xml` and `404.html`
   - a pre-rendered Services section
3. Fix both pages: headings and semantics, contrast, tap targets, line lengths and footer. Add the collapsible Services section, driven by one editable data block. Make the form production-ready (honeypot, time trap, endpoint, `mailto` fallback) and add an analytics hook that is off by default.
4. Add `npm run build`, `check` (HTML validation and SEO rules), `test` (Playwright and axe at five widths, reduced motion, no-JS) and `lighthouse`. Run them all and fix whatever they find.

**Defaults picked** (both change in one line of `site.config.json`):
- **Domain:** `https://rigoordonio.github.io/`, a GitHub Pages address on the owner's GitHub account. Swap in your real domain when you have one.
- **Main version:** light, because it has no WebGL and scores better on mobile. Dark builds with `"theme": "dark"`.
