# Portfolio Website

Rigo Ordonio's portfolio: experience, services, projects and a contact form. Live at **https://rigoordonio.vercel.app/** (day and night modes, opens in night mode). Each page is a single self-contained HTML file with inline CSS and plain JavaScript, designed and built with Claude.

## What is in this repo

| Folder | What it is |
|---|---|
| [`site/`](site) | The built site that Vercel deploys (Root Directory `site/`, branch `main`). A push here redeploys it |
| [`project/`](project) | The source: the three page files, build and test tools, the day/night snippets, the Instagram launch story and the NFC card. Start with [`project/README.md`](project/README.md) |
| [`index.html`](index.html), [`versions/`](versions) | Earlier hand-made versions of the page (light gallery, dark orb, studio) |

## Features

- Responsive from phone to desktop, with safe-area support
- Day and night modes with a circular reveal transition
- Animated hero, scroll-linked experience timeline and interactive service cards
- Contact form with validation and a spam honeypot; until a form endpoint is set, a valid message opens in the visitor's email app
- GitHub contribution graph and a Poke button
- Respects reduced-motion settings; keyboard and screen-reader friendly

## Run it

Open any `index.html` in a browser, or see [`project/README.md`](project/README.md) for the build, tests and deploy steps.
