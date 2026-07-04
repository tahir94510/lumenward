# Distribution Guide (2026)

One codebase, four channels. Recommended order: **itch.io (today) →
CrazyGames/GameDistribution (revenue while you wait) → YouTube Playables (when
invited) → Google Play (TWA)**. Everything here is free.

---

## 1. itch.io (publish today, zero gatekeeping)

1. Create an account → Dashboard → "Create new project".
2. Kind of project: **HTML**. Upload `lumenward-itch.zip`
   (`npm run zip:itch`; CI also produces it as an artifact).
3. Check **"This file will be played in the browser"**.
4. Viewport: check **Mobile friendly** + **Fullscreen button**; manual size
   960×720 works well, but fullscreen is the real experience.
5. Pricing: free or "$0 or donate" (itch has no ad network; revenue here is
   donations/pay-what-you-want; itch's cut defaults to 10%, adjustable).
6. Metadata: genre Action/Arcade; tags: `arcade`, `retro`, `high-score`,
   `one-button`, `space`; screenshots — grab from the game (F11 fullscreen).

**Automated uploads:** the CI `itch` job pushes `dist/local` to
`ITCH_TARGET:html5` via butler on every main-branch push once you add the
`BUTLER_API_KEY` secret and `ITCH_TARGET` repo variable (see ENV.md).

## 2. CrazyGames (free, real ad revenue share)

- Apply at `developer.crazygames.com` with the itch.io or Vercel link.
- Revenue: ~60% of ad revenue after recoup (their published example); optional
  2-month launch exclusivity boosts the share; **no exclusivity required**.
- When accepted, they'll ask for their SDK (ad breaks + loading events). Add a
  `crazygames.js` adapter next to `src/platform/web.js` — the adapter interface
  (`init/ready/rewardedAd/interstitial/submitScore`) already matches their SDK
  shape, so it's a thin wrapper. Upload the `dist/local` bundle.

## 3. GameDistribution (free aggregator, 33% net revenue)

- Sign up at `gamedistribution.com/developers`, submit the `dist/local` build.
- They syndicate to 2000+ publisher sites; payout €100 threshold, ~60 days.
- Their SDK is also adapter-shaped; add when accepted.

## 4. Google Play (you already own a Play Console account)

The PWA wraps as a **Trusted Web Activity** producing a signed `.aab`.

**One-time setup:**

1. Deploy the web build to your domain (Vercel). The repo's
   `.well-known/assetlinks.json` ships with the web build — it proves domain
   ownership to Android.
2. Generate a keystore (once, keep it safe):
   ```bash
   keytool -genkeypair -v -keystore android.keystore -alias lumenward \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
3. Add the three Android secrets from ENV.md to GitHub. CI then builds the
   signed `app-release-bundle.aab` artifact on every main push (Bubblewrap,
   JDK 17, config in `twa-manifest.json`).
4. Play Console → Create app → upload the `.aab` to Internal testing first.
5. After the first upload, Play App Signing re-signs the app: copy the
   **SHA-256 fingerprint** from Play Console → Setup → App integrity into
   `.well-known/assetlinks.json` (replace the placeholder), redeploy the web
   build, then promote to production.

**Store listing tips:** category Arcade; content rating questionnaire — no
violence against humans, no user data collected (matches privacy.html); the
"Data safety" form: "No data collected". **Target API:** new submissions after
Aug 31, 2026 must target Android 16 (API 36) — check `twa-manifest.json`'s
generated project or regenerate with the latest Bubblewrap, which tracks the
required target automatically.

## 5. Vercel (your current host)

`vercel.json` builds `dist/web` (`npm run build:web`) — no build artifacts live
in git. The clean project name is claimed: **lumenward.vercel.app**. Set the
env vars from ENV.md in Vercel only when you enable ads/leaderboard.

> **Seeing red CSP violations in your own console?** Two known third-party
> injections trigger them and both are harmless to players:
> 1. **Vercel Toolbar / Vercel Live** injects an inline feedback script when
>    *you* (a logged-in project member) view the site; our strict CSP blocks
>    it by design. For a clean console: Vercel Dashboard → your project →
>    Settings → **Vercel Toolbar** → disable (or use a private window).
>    Regular visitors never load it.
> 2. **Browser extensions** ("sandbox eval code" entries) injecting scripts
>    are likewise blocked by the CSP — that's the CSP protecting the page.
>
> Do not add these hashes to the CSP: toolbar script hashes rotate on every
> Vercel release (the mysterious stale hash in the original game's CSP was
> exactly such a snapshot).
