# Lumenward — Name & Brand Protection Notes

## Why the rename (from "Last Light")

"Last Light" collides hard with *Metro: Last Light* (major AAA title) and many
other games/films. Titles are **not protected by copyright** at all — only a
**trademark** protects a game's name — and a crowded name is both untrademarkable
in practice and bad for search discoverability. "Lumenward" (lumen = light +
ward = guardian; "toward the light" / "warden of the light") was chosen after
checking Steam/itch/web for collisions in mid-2026: none found. The runner-up
name was "Novaward" (also clean at the time of checking).

## Current protection status

- **Copyright** — automatic on the code, art, music, and text. Asserted via the
  `LICENSE` file, the banner embedded in every built `app.min.js`, and headers
  in the source files. The repo can stay public: visibility does not weaken
  copyright, and the browser build was always world-readable anyway.
- **Trademark** — *not yet registered.* Registration is what actually stops a
  copycat from shipping a "Lumenward" clone on an app store.

## Before you invest in the brand (checklist)

1. Re-verify availability the week you file (things change): search USPTO TESS
   (US) and EUIPO eSearch (EU) for "Lumenward"; search Google Play, App Store,
   Steam, and itch.io.
2. Register the domain you'll standardize on (and the Vercel project name
   `lumenward`).
3. If/when revenue justifies it (~$250–350/class USPTO): file in **Class 9**
   (downloadable game software) and **Class 41** (online game services). An
   attorney is optional but reduces rejection risk; the Madrid Protocol extends
   one filing to more countries later.
4. Keep dated evidence of first use (this repo's git history, store listings,
   the Vercel deploy) — useful in any dispute.

## Enforcement playbook (public repo, readable client code)

- Someone re-hosting the game or a thin reskin → **DMCA takedown** to their
  host/platform (GitHub, itch, app stores all have forms). The embedded
  copyright banner + git history are your evidence.
- Someone using the *name* → trademark territory; a registration makes
  platform takedowns near-automatic, otherwise you rely on confusing-similarity
  arguments.
- Don't bother with heavy JS obfuscation: it can't keep the logic secret, adds
  payload and runtime cost, and risks CSP issues. Minification + license +
  (eventually) trademark is the pragmatic, industry-standard posture.
