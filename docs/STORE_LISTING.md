# Store Listing & ASO Kit

Ready-to-paste listing copy and asset map for every storefront. Screenshots
live in `marketing/` (regenerate any time: they're captured from the real
game by the marketing script — see the note at the bottom).

## Assets

| File | Size | Use |
|---|---|---|
| `icon-512.png` | 512×512 | Play Store icon, PWA, OG fallback |
| `icon-192.png` | 192×192 | PWA/homescreen |
| `icon.svg` | vector | favicon / any size |
| `og-image.png` | 1200×630 | Link previews (Open Graph / Twitter), itch banner base |
| `marketing/phone-menu.png`, `phone-gameplay.png`, `phone-gameplay-2.png` | 1080×1920 | Play Store phone screenshots (min 2 required) |
| `marketing/desktop-menu.png`, `desktop-gameplay.png` | 1920×1080 | Play Store 7"/10" tablet slots, itch/CrazyGames gallery |

Play feature graphic (1024×500) — crop `og-image.png` center or re-render at
that size if Play Console asks for it.

## Google Play (ASO)

- **App name (max 30):** `Lumenward: Retro Star Arcade` (28)
- **Short description (max 80):**
  `Sweep asteroids, chain combos, guard the last light. Retro arcade skill game.` (78)
- **Full description (max 4000):**

  ```
  The void is falling. One star remains — yours.

  Lumenward is a fast, skill-based retro arcade game. Asteroids curve in
  from the dark; sweep them away with a fingertip before they shatter the
  last light. No paywalls, no energy timers — just you, the storm, and a
  high score to beat.

  ★ ONE-TOUCH DEPTH — sweep to destroy; bigger rocks take more hits
  ★ CHAIN COMBOS — quick pops build multipliers; every 4th step ignites FLOW
  ★ BRINK SAVES — destroy an asteroid at the last instant for slow-mo,
    bonus points, and that heart-in-throat rush
  ★ ENDLESS, FAIR DIFFICULTY — hard but never impossible; every death is
    your own, every comeback is earned
  ★ RETRO ATMOSPHERE — procedural chiptune soundtrack that intensifies as
    the storm grows, scanlines, CRT glow
  ★ INSTANT RESTART — one tap and you're back in
  ★ ACCESSIBLE — reduced-motion mode, adjustable sound, haptics toggle,
    screen-reader announcements
  ★ PRIVATE BY DESIGN — no ads in this version, no tracking, no data
    collection; your best score stays on your device

  Can you keep the last light alive?
  ```

- **Category:** Arcade · **Tags:** arcade, casual, retro, high score
- **Content rating questionnaire:** no violence against people, no user
  data collected, no ads (this build), no purchases → expect Everyone/PEGI 3.
- **Data safety form:** "No data collected, no data shared."

## itch.io

- **Title:** Lumenward — **Tagline (short):** *Guard the last light.*
- **Classification:** HTML5 game · Arcade/Action · Tags: `arcade`, `retro`,
  `space`, `high-score`, `one-button`, `score-attack`, `chiptune`
- **Description:** reuse the Play full description; itch supports markdown —
  keep the ★ bullets.
- **Cover image:** 630×500 — crop `og-image.png` (star + wordmark).
- **Screenshots:** the three phone captures + `desktop-gameplay.png`.

## YouTube Playables metadata

- **Title:** Lumenward · **Genre:** Arcade
- **Description (short):** Sweep asteroids and guard the last light — a fast,
  skill-based retro arcade challenge with combos and brink saves.

## Web (SEO) — already wired into the web build

- Canonical URL + `og:url` (set `LUMENWARD_CANONICAL` env to override the
  default `https://lumenward.vercel.app`)
- `og-image.png` large-card previews (Twitter `summary_large_image`)
- JSON-LD `VideoGame` structured data (rich results eligibility)
- Keywords meta; descriptive title/description on every variant

## Regenerating screenshots

Screenshots are shot from the real `dist/web` build in headless Chromium at
2× DPR (menu + live gameplay). If the game's look changes, re-run a build and
re-capture so store art never drifts from reality. Keep at least: 2 phone
portrait (1080×1920), 1 landscape (1920×1080).
