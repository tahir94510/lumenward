# Lumenward

**Guard the last light.** A fast, skill-based retro arcade game: asteroids curve
in from the void — sweep them away with your pointer before they shatter the
final star. Chain combos, chase brink saves, survive the escalating storm.

Self-contained HTML5 canvas + procedural WebAudio (zero asset downloads, zero
tracking, works offline). One codebase builds for the web, YouTube Playables,
itch.io, and Google Play.

> Formerly "Last Light" — renamed to **Lumenward** for a distinctive,
> trademarkable identity.

## Play / run locally

```bash
npm ci
npm run dev        # builds and serves http://localhost:5173
```

Any static server also works after a build (`npx serve dist/web`).

## How it plays

- **Sweep** asteroids with mouse (hover) or touch (drag) before they reach the star.
- Multi-hit asteroids (amber = 2 hits, rose = 3) crack before they pop.
- **Combo**: quick consecutive pops build a multiplier ladder — every 4th step
  triggers **FLOW**.
- **BRINK**: destroy an asteroid at the last instant near the star for a big
  bonus, slow-mo, and a rising chime. Honest, skill-earned tension.
- 3 hits on the star ends the run; grab orbiting heal sparks to recover.
- Sound, volume, and reduced-motion preferences persist between sessions.

## Build system

```bash
npm run build            # all three variants -> dist/
npm run build:web        # self-hosted (Vercel/Pages) -> dist/web
npm run build:playables  # fully-offline YouTube Playables bundle
npm run verify           # build + syntax + headless gameplay smoke tests
npm run zip:playables    # lumenward-playables.zip (Developer Portal upload)
npm run zip:itch         # lumenward-itch.zip (itch.io upload)
```

| Variant | Ads | Cloud save | Leaderboard | Network |
|---|---|---|---|---|
| `web` | AdSense H5 (env-gated, off by default) | — | optional Supabase (env-gated) | strict CSP, only what's configured |
| `playables` | YouTube-served only (SDK) | YouTube `saveData` | YouTube `sendScore` | **none except the YouTube SDK** |
| `local` | none | — | local best only | **none** |

Source lives in `src/` (game core, config, platform adapters); `build.mjs`
assembles, templates the CSP per variant, and minifies with esbuild. Vercel
builds and serves `dist/web` via `vercel.json` — no build artifacts live in git.

## Distribution & docs

| Doc | What it covers |
|---|---|
| [docs/PLAYABLES.md](docs/PLAYABLES.md) | YouTube Playables: program status, submission, certification checklist, monetization reality |
| [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md) | itch.io, CrazyGames, GameDistribution, Google Play (TWA/AAB) step-by-step |
| [docs/MONETIZATION.md](docs/MONETIZATION.md) | Revenue per platform, AdSense H5 setup, what to flip on when approvals arrive |
| [docs/ENV.md](docs/ENV.md) | Every env var / CI secret and where to set it |
| [docs/TRADEMARK.md](docs/TRADEMARK.md) | Name/brand protection notes |

CI (GitHub Actions) builds and smoke-tests every push, audits the Playables
bundle for accidental network calls, and uploads ready-to-submit artifacts.
Publishing jobs (itch.io, Android AAB) activate automatically once their
secrets exist — see [docs/ENV.md](docs/ENV.md).

## License

Proprietary / source-available. See [LICENSE](LICENSE). The Lumenward name,
code, and assets may not be reused or redistributed.

---

# Lumenward (Türkçe)

**Son ışığı koru.** Hızlı, beceri tabanlı retro arcade: asteroidler boşluktan
kavis çizerek gelir — yıldıza ulaşmadan işaretçinle süpür. Kombo zincirle,
kıl payı kurtarışlar (BRINK) yakala, yükselen fırtınada hayatta kal.

Tamamen kendi içinde (dış indirme yok, takip yok, çevrimdışı çalışır). Tek
kod tabanı; web, YouTube Playables, itch.io ve Google Play için paketlenir.

## Çalıştırma

```bash
npm ci
npm run dev   # derler ve http://localhost:5173 sunar
```

## Derleme ve dağıtım

- `npm run build` → üç sürüm (`dist/web`, `dist/playables`, `dist/local`)
- `npm run verify` → derleme + sözdizimi + başsız oynanış testleri
- `npm run zip:playables` / `zip:itch` → yüklemeye hazır ZIP'ler

Platform rehberleri `docs/` klasöründe (yukarıdaki tabloya bak): YouTube
Playables başvurusu, itch.io, Play Store (AAB), gelir kurulumu ve tüm
env/secret listesi. CI her push'ta derler, test eder ve yüklemeye hazır
paketleri artifact olarak üretir.

## Lisans

Tescilli / kaynağı-görülebilir. [LICENSE](LICENSE) dosyasına bak. Lumenward
adı, kodu ve varlıkları izinsiz kopyalanamaz ve yeniden dağıtılamaz.
