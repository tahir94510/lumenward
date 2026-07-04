# Monetization Guide (2026)

Honest summary of where money actually comes from, per channel, and exactly
what to flip on when each approval lands. Everything ships ready but **off by
default** — the game never degrades when a credential is missing.

## Revenue map

| Channel | Who pays | What you must do | Status in this repo |
|---|---|---|---|
| YouTube Playables | YouTube's own ads (pre-roll automatic; interstitial/rewarded via SDK). Revenue share is a **limited pilot** | Get portal access; wait for/confirm inclusion in the ads pilot | SDK hooks ready & gated |
| CrazyGames | ~60% of ad revenue (after recoup) | Get accepted; add their thin SDK adapter | Adapter interface ready |
| GameDistribution | 33% of net ad revenue | Submit; add their SDK adapter | Adapter interface ready |
| Own site (Vercel) | Google AdSense **H5 Games Ads** (rewarded + interstitial) | AdSense account + H5 allowlisting for your domain | Fully implemented, env-gated |
| itch.io | Donations / pay-what-you-want | Nothing — enable donations on the project page | N/A (no code needed) |
| Google Play (TWA) | No ads in this build; it's a distribution/brand channel | — | AAB pipeline ready |

**Important policy rule:** portal builds (Playables/CrazyGames/GD) must never
contain your own AdSense — that's why ads exist only in the `web` variant and
only when `LUMENWARD_ADSENSE_CLIENT` is set at build time.

## AdSense H5 Games Ads (your own domain)

1. Have an approved AdSense account (adsense.google.com).
2. Apply for **H5 Games Ads** (support.google.com/adsense/answer/1705831) with
   your game URL. Google reviews that the domain hosts an actual playable game.
3. Once allowlisted, set `LUMENWARD_ADSENSE_CLIENT=ca-pub-XXXXXXXXXXXXXXXX`
   (Vercel env + GitHub secret) and redeploy.

What turns on automatically:
- the AdSense H5 loader tag in `index.html` (web build only);
- CSP entries for Google ad origins;
- `LLPlatform.rewardedAd()` → the **"SECOND WIND"** continue offer can be wired
  into the gameover screen (rewarded, opt-in, never interrupts gameplay);
- `LLPlatform.interstitial()` → use only at natural breaks (e.g. every few
  runs, never mid-run). H5 policy forbids surprise interstitials.

Design rules baked in (and to keep): rewarded ads are always **player-initiated
and optional**; no purchase pressure, no fake urgency, no pay-to-win. That
keeps the game family-safe and inside 2026 consumer-protection expectations.

## Optional global leaderboard (Supabase free tier)

Off until you create a project at supabase.com:

1. New project → SQL Editor → run **`supabase/schema.sql`** from this repo
   (idempotent: table + index + RLS policies). Skipping this step is what
   causes a 404 on `POST /rest/v1/scores`.
2. Set `LUMENWARD_SUPABASE_URL` and `LUMENWARD_SUPABASE_KEY` (the anon key)
   in Vercel/GitHub, rebuild — the web build submits each run's score on
   game over and shows a **TOP GUARDIANS** top-5 on the game-over screen.

Free tier is plenty for a leaderboard; if the game takes off, upgrade later —
nothing else changes.

## What NOT to do (protects certification & ratings)

- No developer ads or IAP in any portal/Playables bundle.
- No loot boxes / gambling-like randomized purchases (all-ages game).
- No dark patterns: no fake near-misses, no artificial urgency, no streak
  shaming. The addictive pull comes from honest skill tension — that's the
  durable (and policy-safe) kind.
