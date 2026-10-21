# Portfolio Website

My personal portfolio site: experience, services, projects and a contact form. Each page is a single self-contained HTML file (no build step), designed and built with Claude.

| Version | File | Look |
|---|---|---|
| **Main** | [`index.html`](index.html) | Light gallery page with an animated visor figure that reflects a live forecast line, plus a day/night toggle |
| Dark orb | [`versions/dark-orb/index.html`](versions/dark-orb/index.html) | Cinematic dark page that opens on a live liquid orb |
| Studio | [`versions/studio/index.html`](versions/studio/index.html) | Light visor design without night mode |

## Features

- Responsive from phone to desktop, with safe-area support
- Animated hero, scroll-linked experience timeline and interactive service cards
- Project showcase and skills overview
- Contact form with validation and a spam honeypot, backed by an [n8n workflow](https://github.com/rigoordonio/n8n-workflows) that sends an AI-drafted reply
- Respects reduced-motion settings; keyboard and screen-reader friendly

## Run it

Open any `index.html` in a browser. To host it for free, turn on **GitHub Pages** (Settings → Pages → Deploy from branch → `main`).
