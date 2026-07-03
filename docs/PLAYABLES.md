# YouTube Playables — Submission Guide (2026)

Lumenward's primary target. You already submitted the interest form — this doc
covers what happens next and exactly what to upload.

## Program reality check (verified mid-2026)

- **Official name:** YouTube Playables (instant games inside the YouTube
  app/web). First tested Nov 2023 for Premium users; free launch for all US
  users May 28, 2024, then UK/CA/AU and more markets.
- **Status:** active and growing (~550 games), but the **Developer Portal is
  private-preview / invitation-only**. Interest-form review can take weeks to
  months. An alternative faster path is publishing through an approved partner
  (e.g. Playgama) if you don't want to wait.
- **Monetization:** YouTube serves all ads (pre-roll automatically; interstitial
  and rewarded via the SDK). Revenue share is a **limited pilot** being expanded
  gradually — do not count on payouts until YouTube confirms your inclusion.
  **Your own ads/IAP are forbidden** in Playables builds.
- Docs hub: `developers.google.com/youtube/gaming/playables`

## What this repo already does for you

`npm run zip:playables` produces `lumenward-playables.zip`:

- fully offline (CI audits the bundle and fails if any origin other than
  `www.youtube.com` appears);
- loads the SDK first (`<script src="https://www.youtube.com/game_api/v1">`);
- calls `firstFrameReady()` then `gameReady()` after the first rendered frame;
- saves best score + settings through `saveData()` / local fallback;
- reports each run's final score via `sendScore()`;
- responsive from 9:32 to 32:9, touch + mouse, state survives resize;
- bundle ≈ 0.2 MB (limits: file ≤ 30 MB, initial ≤ 15 MB, total ≤ 250 MB).

SDK calls are feature-detected and wrapped in try/catch, so the identical
bundle also runs standalone (that's how CI smoke-tests it). **When portal
access arrives, re-verify the exact SDK method names against the live SDK
reference** — the adapter probes common shapes (`ytgame.game.*`, `ytgame.ads.*`,
`ytgame.engagement.*`) but the private-preview API may evolve.

## When the portal invitation arrives

1. Sign in to the YouTube Playables Developer Portal.
2. Create a new Playable draft.
3. Upload `lumenward-playables.zip` (CI also attaches it to every run as the
   `lumenward-playables` artifact).
4. Metadata: title **Lumenward**; genre Arcade/Action; description — use the
   README's first paragraph; publisher/developer — your name.
5. Submit for certification. It reviews **design, stability, performance,
   integration, privacy, trust & safety**; typically several business days.

## Certification checklist (map to our build)

- [x] Runs entirely offline, no external requests
- [x] `firstFrameReady` / `gameReady` called
- [x] Touch and mouse input; no keyboard required (Space/Esc are extras)
- [x] All aspect ratios render correctly; resize keeps game state
- [x] No own monetization, no external links (privacy page ships in-bundle)
- [x] Stable 60fps target with adaptive particle quality on weak devices
- [x] No data collection (localStorage only) — matches privacy requirements
- [ ] Ads (`requestInterstitialAd` / `requestRewardedAd`): the adapter supports
      them but they stay unused until YouTube confirms your ads rollout — then
      decide placements (natural breakpoints only).

## Fallback if the invitation stalls

Publish the same offline bundle via an approved partner (Playgama publishes to
Playables on your behalf) or keep momentum on itch.io/CrazyGames while waiting —
see DISTRIBUTION.md.
