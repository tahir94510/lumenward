# Environment Variables & CI Secrets

Every credential the project can use, where to set it, and what turns on.
**Everything is optional** — with zero configuration the game builds, runs, and
deploys as a fully offline experience.

## Build-time env vars (Vercel → Project Settings → Environment Variables, and/or GitHub → Secrets)

| Variable | Example | Effect when set |
|---|---|---|
| `LUMENWARD_ADSENSE_CLIENT` | `ca-pub-1234567890123456` | Web build loads AdSense H5; rewarded "continue" + interstitial hooks activate; CSP widens to Google ad origins only |
| `LUMENWARD_SUPABASE_URL` | `https://abcd1234.supabase.co` | Web build can submit/fetch global leaderboard scores |
| `LUMENWARD_SUPABASE_KEY` | `eyJhbGciOi...` (anon key) | Auth for the leaderboard REST calls |
| `LUMENWARD_CANONICAL` | `https://lumenward.vercel.app` | Canonical origin used in the web build's SEO tags (defaults to this value) |

These are read by `build.mjs` at build time and injected as `window.LLEnv`.
They never affect the `playables`/`local` variants, which stay offline.

## GitHub Actions secrets (repo → Settings → Secrets and variables → Actions)

| Secret | Used by job | How to get it |
|---|---|---|
| `BUTLER_API_KEY` | `itch` | itch.io → Settings → API keys |
| `ANDROID_KEYSTORE_B64` | `android` | `base64 -w0 android.keystore` after generating it (see DISTRIBUTION.md §4) |
| `BUBBLEWRAP_KEYSTORE_PASSWORD` | `android` | The keystore password you chose |
| `BUBBLEWRAP_KEY_PASSWORD` | `android` | The key password you chose |

### Repository *variables* (not secrets)

| Variable | Used by job | Example |
|---|---|---|
| `ITCH_TARGET` | `itch` | `youruser/lumenward` |

Jobs check for their credentials first and **skip gracefully** when absent, so
CI is green from day one.

## Rotation & safety

- The Supabase **anon** key is public by design (it's shipped to browsers);
  security comes from the Row-Level-Security policies in MONETIZATION.md.
- Never commit the keystore or its passwords; `.gitignore` already excludes
  `*.keystore`, `*.jks`, and `play-service-account*.json`.
- If a key leaks: itch/AdSense/Supabase keys can all be revoked & reissued from
  their dashboards; the Android keystore cannot — Play App Signing protects you
  (Google holds the release key; yours is only the upload key, replaceable via
  Play Console support).
