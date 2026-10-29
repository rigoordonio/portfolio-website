# Rigo Ordonio portfolio

> **Current state (2026-10-29).** The live site, https://rigoordonio.vercel.app/, is the merged day/night page. It is generated from the light page, so edit `rigo-portfolio-light.html` and rebuild:
>
> ```bash
> cp rigo-portfolio-light.html rigo-portfolio-merged.html
> python3 snippets/merge.py rigo-portfolio-merged.html snippets/theme.css snippets/theme.js
> node tools/build.mjs --theme merged --out .build/vercel
> # copy .build/vercel into ../site/ without .nojekyll and _headers (headers live in ../site/vercel.json), then push
> ```
>
> The site opens in night mode unless the visitor saved a choice. `snippets/` holds the pieces the merge adds (day/night transition, Poke button, GitHub graph, motion layer). `ig-story/` and `nfc-card/` are the launch assets: the Instagram story video and its source, and the NFC business card.

Two versions of one portfolio, each a single HTML file with inline CSS and plain JavaScript:

- `rigo-portfolio-light.html`: the light "Studio" version (the default build)
- `rigo-portfolio-dark.html`: the dark version

Each file opens on its own in a browser and powers the live previews. A small build script turns either one into a deployable site in `dist/`. No framework, and nothing to compile.

## Quick start

```bash
npm install
npx playwright install chromium   # once, for tests, Lighthouse and npm run assets
npm run build                     # builds the theme set in site.config.json into dist/
npm run preview                   # builds, then serves dist/ at http://127.0.0.1:8080
```

## Commands

| Command | What it does |
|---|---|
| `npm run build` | Builds `dist/` from the theme in `site.config.json` (`build:light`, or `build:dark` into `dist-dark/`) |
| `npm run check` | The lint step. Builds both themes and checks HTML validity (html-validate), title and description length, canonical, Open Graph and Twitter tags, one `h1` and heading order, landmarks, alt text, anchor links, local files, JSON-LD, inline script syntax, robots, sitemap, manifest, icons, and that no keys or env vars ship |
| `npm test` | Browser tests in Chromium for both themes: console errors, navigation and mobile menu, Services detail card (open and close by tap, Esc, X and outside click, focus trap, deep links, press scale, long tasks, reduced motion, no-JS), the contact form (validation, honeypot, endpoint success and failure), axe WCAG 2.2 AA at 375, 768, 1024, 1440 and 1920 px, horizontal overflow, tap targets and the 404 page |
| `npm run lighthouse` | Lighthouse mobile and desktop for both themes; JSON reports go to `reports/` |
| `npm run assets` | Regenerates favicons, app icons and the 1200x630 social images in `assets/` |
| `npm run verify` | `check`, then `test`, then `build` |

There is no type-check step because the project has no TypeScript.

## Editing content

- **Services and their projects** live in one JSON block in each page: search for `id="services-data"`. Each service has an `id` (used for deep links such as `/#forecasting`), a `name`, a `spell` (`bars`, `line`, `cluster`, `pipeline` or `prompt`: the animation its card plays) and a list of projects. Each project has `title`, `org`, `outcome` (one line, with a metric when there is one), `tags` (shown as `Python · SQL · dbt`) and an optional `href` to a project on the page. Put "in progress" in `org` for unfinished work; it is marked as unfinished in the structured data too. The page renders the list in the browser, and the build pre-renders it into the HTML for search engines.
- **Everything else** (copy, experience, projects) is plain HTML in the page files. Edit both files if a change applies to both versions.
- **Site settings** live in `site.config.json`:
  - `siteUrl`: the live address. It drives the canonical URL, sitemap, robots and social tags. Change it when you have your own domain.
  - `theme`: `light` or `dark` for `npm run build`.
  - `title` and `description`: keep them 50–60 and 140–160 characters (`npm run check` enforces this).
  - `formEndpoint`: see below.
  - `analytics`: see below.
  - `person`: name, job title, city and links used in structured data.

## Contact form

With `formEndpoint` empty, a valid message opens in the visitor's email app, addressed to you. To receive messages directly, create a form at a form service that accepts a JSON or form POST (Formspree, Web3Forms, Basin, Getform), paste its URL into `formEndpoint` and rebuild. The form posts its fields plus `_gotcha`, a honeypot that Formspree drops automatically.

Spam protection: a hidden honeypot field, plus a time trap that ignores submits sent within 3 seconds of page load. Both act as if the message was sent and send nothing.

## Analytics

Off by default. Set `analytics.provider` in `site.config.json` and rebuild:

- `"ga4"` with `"id": "G-XXXXXXX"` for Google Analytics 4
- `"plausible"` (optional `id` = your domain)
- `"vercel"` for Vercel Web Analytics (enable it in the Vercel dashboard too)

The page calls `window.siteAnalytics?.(name)` for `contact_ready` and `contact_sent`, so those events reach whichever provider you pick.

## Deploying

`dist/` is a plain static folder. Upload or point any static host at it:

- **GitHub Pages:** push `dist/` to a `gh-pages` branch, or use the "Static HTML" Pages workflow with `dist` as the path. `.nojekyll` is included. For a project page (`username.github.io/repo/`), put that full URL in `siteUrl`; links adjust to the sub-path.
- **Netlify or Cloudflare Pages:** build command `npm run build`, output folder `dist`. `_headers` sets security and font caching headers.
- **Vercel:** framework "Other", build command `npm run build`, output `dist`.

All of them serve `404.html` for unknown URLs.

## Project layout

```
rigo-portfolio-light.html   light page (source of truth)
rigo-portfolio-dark.html    dark page (source of truth)
site.config.json            domain, SEO title and description, form, analytics, person
assets/fonts/               self-hosted WOFF2 subsets and their @font-face CSS
assets/icons/<theme>/       favicon.ico/.svg, apple-touch-icon, manifest icons
assets/og-<theme>.png       1200x630 social share images
tools/                      build, check, test, lighthouse, serve, make-assets
dist/                       built light site, ready to upload
motion-notes.md             which motion effect sits on which element
```

Fonts are Schibsted Grotesk, Geist Mono, Bricolage Grotesque, Figtree and JetBrains Mono, all under the SIL Open Font License.
