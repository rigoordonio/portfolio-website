# Futuristic motion layer: what went where

Applies to `rigo-portfolio-dark.html` and `rigo-portfolio-light.html`. New code lives in the `style#motion` and `script#motion` blocks just before the end of each file; delete both to remove it. Small edits to existing motion are marked `/* motion: */`.

## Effect map

| # | Effect | Dark version | Light version | Why |
|---|---|---|---|---|
| 1 | Boot sequence | Sweep line on `.nav::after`; existing `.fade-in` and split headline retimed to blur(8px)→0 in order: nav, eyebrow, h1 words (40ms stagger), sub, buttons, stats. Ends at ~1.2s | Same sweep; `.hero .label`, `h1`, `.sub`, `.ctas`, `.stats` boot in order. Visor figure left out | Refined the dark hero's existing fade-ins instead of adding a second set |
| 2 | Text decode | Every `h2` on first view, 800ms | Every `h2` on first view, 800ms | Hero h1 skipped (already animates). Gradient words keep styling; `aria-label` holds the real text |
| 3 | Scan-line wipe | Replaces `.rv` fade-up. Rows wipe left to right: `.way`, `.delivered > div`, `.skills > div`. Everything else top to bottom | Same; rows: `.svc`, `.delivered > div`, `.skills > div`, `.step` | Glowing edge is a body-level overlay, so nothing shifts |
| 4 | Holographic hover | Existing `.card` tilt kept; added to `.role-card`, `.delivered > div`, `.proj` (skips dimmed carousel cards). Buttons get reflection only | `.step`, `.role`, `.delivered > div`, contact form (3° max). Deck and chart skipped | Max 6°, reflection follows the mouse |
| 5 | Glow pulse | `.btn.solid` in pearl, 3.6s | `.btn.solid` in ember, 3.6s | Outer shadow on a pseudo-element, opacity only; pauses off screen |
| 6 | Cursor | Existing cursor: tighter trail and sharper easing | New dot + ring in ink; grows over links, buttons, cards; hidden over the forecast chart | Desktop only |
| 7 | Ambient depth | Faint 48px grid (tide 6%) above the orb; orb parallax on scroll | Grid at 4% ink; visor glow halo parallax | Grid drifts slowly, pauses off screen |
| 8 | Counters | Hero stats start when in view, 1s, after the boot | Same | Tabular numbers keep width steady |

## Checks
- Text, colors, fonts and the position and size of every element on the page match the earlier version at 1300px and 390px wide. The only differences are mid-animation positions of existing motion (marquee, odometer, word swap).
- No horizontal scroll at 390px. No console errors.
- Touch devices: no cursor, tilt or reflections. Reduced motion: no boot, decode, wipe, parallax or pulsing; everything shows immediately.

## Services: tap a row, it lifts into a card (added 2026-10-17)

Both pages, in the services script block and the `.svc-*` / `.spell` CSS. No animation library: a small spring (stiffness 400, damping 30) in plain JavaScript plus the Web Animations API.

| Moment | What moves | Value | Source |
|---|---|---|---|
| Press | row scales to 0.97 | 100ms `ease-out` | brief |
| Release | row springs back to 1 | spring k=400, c=30 (as a CSS `linear()` curve, ~550ms; `--m-ease` 550ms where `linear()` is unsupported) | brief; fallback `--m-ease` |
| Open and close | row surface grows into the card; icon and title travel; + turns into × | same spring, run per frame so a mid-way close reverses from where it is | brief |
| Neighbours | scrim over the page at 60% of the page colour, so the rest reads at ~40% | follows the spring | brief |
| Spell | starts 120ms into the lift, plays once (600–900ms), then holds | per spell, below | `--acc-ease`, `--m-ease` |
| Content | projects rise 8px→0 and fade in after the card settles, 50ms apart | 300ms `--acc-ease`; out 200ms `--acc-ease` | Services panel open/close and the 8px reveal |
| Hover preview (desktop only) | the row icon plays about a fifth of its spell | .55s `--m-ease` | `--m-ease` and .55s from the motion layer |
| Reduced motion | card and scrim crossfade; spells show their end state | 150ms `--acc-ease` | brief |

Spells: bars grow on the spring, 60ms apart, tallest flashes the accent (450ms `--acc-ease`); forecast history draws (450ms `--acc-ease`), the dashed forecast is uncovered (350ms) and its band fades in (300ms); a packet travels the pipe (600ms linear) and each node pulses (300ms `--acc-ease`); points drift into clusters (550ms `--m-ease`) and links draw (280ms `--acc-ease`); the question types at 14ms per letter, then answer words stream in 38ms apart (150ms fade each).

