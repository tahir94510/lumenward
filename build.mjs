/*!
 * Lumenward — build script.
 * Copyright (c) 2026 Lumenward. All rights reserved.
 *
 * Produces per-target bundles from a single source tree:
 *   web        -> repo root (Vercel/Pages deploy) + dist/web
 *   playables  -> dist/playables  (fully offline, YouTube SDK)
 *   local      -> dist/local      (itch.io / plain static, fully offline)
 *
 * A "target" bundle = [LLEnv prelude] + config.js + platform/_core.js +
 * platform/<target>.js + game.js, minified with esbuild, plus a templated
 * index.html / manifest / privacy page and the shared static assets.
 *
 * Usage: node build.mjs [web|playables|local|all]
 */
import esbuild from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, "src");
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const VERSION = pkg.version;
const TITLE = "Lumenward";

const ENV = {
  adsenseClient: process.env.LUMENWARD_ADSENSE_CLIENT || "",
  supabaseUrl: process.env.LUMENWARD_SUPABASE_URL || "",
  supabaseKey: process.env.LUMENWARD_SUPABASE_KEY || "",
};
// Canonical origin of the self-hosted deployment (SEO tags, web target only).
const CANONICAL = (process.env.LUMENWARD_CANONICAL || "https://lumenward.vercel.app").replace(
  /\/$/,
  "",
);

// Structured data + canonical/social tags — injected into the web head only,
// so the offline (Playables/itch) bundles stay free of external references.
const SEO_HEAD = `  <link rel="canonical" href="${CANONICAL}/" />
  <meta property="og:url" content="${CANONICAL}/" />
  <meta name="keywords" content="retro arcade game, browser game, free online game, asteroid game, high score, skill game, space game, html5 game" />
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"VideoGame","name":"${TITLE}","url":"${CANONICAL}/","image":"${CANONICAL}/og-image.png","description":"Sweep asteroids, chain risky combos, and guard the final light in a fast, skill-based retro arcade challenge.","genre":["Arcade","Action"],"gamePlatform":["Web browser","Android"],"applicationCategory":"Game","operatingSystem":"Any","playMode":"SinglePlayer","offers":{"@type":"Offer","price":"0","priceCurrency":"USD"},"author":{"@type":"Organization","name":"${TITLE}"}}</script>`;

const OFFLINE_CSP =
  "default-src 'self'; script-src 'self'; script-src-attr 'none'; style-src 'unsafe-inline'; " +
  "img-src 'self' data:; media-src 'self' blob:; connect-src 'none'; worker-src 'self'; " +
  "object-src 'none'; base-uri 'none'; form-action 'none'; upgrade-insecure-requests";

function supabaseOrigin() {
  try {
    return ENV.supabaseUrl ? new URL(ENV.supabaseUrl).origin : "";
  } catch {
    return "";
  }
}

function webCsp() {
  // If no paid features are configured, keep the strict offline policy.
  if (!ENV.adsenseClient && !ENV.supabaseUrl) return OFFLINE_CSP;
  const adScript = ENV.adsenseClient
    ? " https://pagead2.googlesyndication.com https://www.googletagservices.com"
    : "";
  const adFrame = ENV.adsenseClient
    ? " https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com"
    : "";
  const conn = [
    "'self'",
    supabaseOrigin(),
    ENV.adsenseClient ? "https://pagead2.googlesyndication.com https://www.google.com" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    `default-src 'self'; script-src 'self'${adScript}; style-src 'unsafe-inline'; ` +
    `img-src 'self' data: https:; media-src 'self' blob:; connect-src ${conn}; ` +
    `frame-src${adFrame || " 'none'"}; object-src 'none'; base-uri 'none'`
  );
}

const PLAYABLES_CSP =
  "default-src 'self'; script-src 'self' https://www.youtube.com; script-src-attr 'none'; " +
  "style-src 'unsafe-inline'; img-src 'self' data: https:; media-src 'self' blob:; " +
  "connect-src 'self' https://www.youtube.com; frame-src https://www.youtube.com; " +
  "object-src 'none'; base-uri 'none'";

const TARGETS = {
  web: {
    csp: webCsp(),
    flags: { ads: true, cloud: false, board: true },
    headExtra:
      SEO_HEAD +
      (ENV.adsenseClient
        ? `\n  <script async data-ad-client="${ENV.adsenseClient}" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js" crossorigin="anonymous"></script>`
        : ""),
    og: { image: "og-image.png", w: "1200", h: "630", card: "summary_large_image" },
    extraAssets: ["og-image.png"],
    env: ENV,
  },
  playables: {
    csp: PLAYABLES_CSP,
    flags: { ads: false, cloud: true, board: true },
    headExtra: `<script src="https://www.youtube.com/game_api/v1"></script>`,
    og: { image: "icon-512.png", w: "512", h: "512", card: "summary" },
    extraAssets: [],
    env: { adsenseClient: "", supabaseUrl: "", supabaseKey: "" },
  },
  local: {
    csp: OFFLINE_CSP,
    flags: { ads: false, cloud: false, board: false },
    headExtra: "",
    og: { image: "icon-512.png", w: "512", h: "512", card: "summary" },
    extraAssets: [],
    env: { adsenseClient: "", supabaseUrl: "", supabaseKey: "" },
  },
};

const STATIC_ASSETS = ["icon.svg", "icon-192.png", "icon-512.png", "robots.txt"];

function tmpl(str, map) {
  return Object.keys(map).reduce(
    (s, k) => s.replaceAll(k, map[k]),
    str,
  );
}

function buildJs(target, spec) {
  const envPrelude =
    "window.LLEnv=" +
    JSON.stringify({
      adsenseClient: spec.env.adsenseClient,
      supabaseUrl: spec.env.supabaseUrl,
      supabaseKey: spec.env.supabaseKey,
    }) +
    ";";
  const config = tmpl(readFileSync(join(SRC, "config.js"), "utf8"), {
    __LL_VERSION__: VERSION,
    __LL_VARIANT__: target,
    __LL_ADS__: String(spec.flags.ads),
    __LL_CLOUD__: String(spec.flags.cloud),
    __LL_BOARD__: String(spec.flags.board),
  });
  const core = readFileSync(join(SRC, "platform", "_core.js"), "utf8");
  const adapter = readFileSync(join(SRC, "platform", `${target}.js`), "utf8");
  const game = readFileSync(join(SRC, "game.js"), "utf8");
  return [envPrelude, config, core, adapter, game].join("\n;\n");
}

async function writeVariant(target, outDir) {
  const spec = TARGETS[target];
  mkdirSync(outDir, { recursive: true });

  // ---- JS bundle ----
  const src = buildJs(target, spec);
  const out = await esbuild.transform(src, {
    minify: true,
    legalComments: "none",
    target: ["es2019"],
  });
  // Embedded copyright/ownership banner survives minification (a deterrent and
  // a clear ownership signal in any dispute — the browser build is readable).
  const banner =
    `/*! ${TITLE} v${VERSION} (${target}) — Copyright (c) 2026 ${TITLE}. ` +
    `All rights reserved. Proprietary; see LICENSE. */\n`;
  writeFileSync(join(outDir, "app.min.js"), banner + out.code);

  // ---- index.html ----
  const html = tmpl(readFileSync(join(SRC, "index.template.html"), "utf8"), {
    __TITLE__: TITLE,
    __VERSION__: VERSION,
    __CSP__: spec.csp,
    __HEAD_EXTRA__: spec.headExtra,
    __OG_IMAGE__: spec.og.image,
    __OG_W__: spec.og.w,
    __OG_H__: spec.og.h,
    __TW_CARD__: spec.og.card,
  });
  writeFileSync(join(outDir, "index.html"), html);

  // ---- manifest ----
  const manifest = {
    name: TITLE,
    short_name: TITLE,
    description:
      "Sweep asteroids, chase brink saves and chain risky combos, and guard the final light in a fast skill-based retro arcade challenge.",
    start_url: "./index.html",
    scope: "./",
    display: "fullscreen",
    orientation: "any",
    background_color: "#05050d",
    theme_color: "#080713",
    categories: ["games", "entertainment"],
    icons: [
      { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
      { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      { src: "icon.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
    ],
    id: "./lumenward",
    display_override: ["fullscreen", "standalone"],
    lang: "en",
  };
  writeFileSync(join(outDir, "manifest.webmanifest"), JSON.stringify(manifest, null, 2));

  // ---- privacy page (varies by target) ----
  const adsLine =
    target === "web" && spec.env.adsenseClient
      ? "<p>The web version may show ads served by Google (AdSense). Google may use cookies to serve ads based on prior visits; see Google's ad policies. No other tracking is used.</p>"
      : "<p>This version shows no ads and sends no gameplay data to any server.</p>";
  const boardLine =
    target === "web" && spec.env.supabaseUrl
      ? "<p>If you submit a high score to the optional global leaderboard, only the score and a display name you provide are stored.</p>"
      : "";
  const privacy =
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${TITLE} Privacy</title>` +
    `<style>body{font-family:system-ui;background:#05050d;color:#fff0b7;line-height:1.6;max-width:760px;margin:40px auto;padding:0 20px}</style>` +
    `</head><body><h1>Privacy Policy — ${TITLE}</h1>` +
    `<p>${TITLE} stores your best score locally in your browser (localStorage). It does not collect personal data.</p>` +
    adsLine +
    boardLine +
    `</body></html>`;
  writeFileSync(join(outDir, "privacy.html"), privacy);

  // ---- static assets ----
  for (const a of STATIC_ASSETS.concat(spec.extraAssets || [])) {
    const from = join(ROOT, a);
    if (existsSync(from)) copyFileSync(from, join(outDir, a));
  }
  // Digital Asset Links for the Android TWA — web target only.
  if (target === "web") {
    const dal = join(ROOT, ".well-known", "assetlinks.json");
    if (existsSync(dal)) {
      mkdirSync(join(outDir, ".well-known"), { recursive: true });
      copyFileSync(dal, join(outDir, ".well-known", "assetlinks.json"));
    }
  }

  return join(outDir, "app.min.js");
}

async function main() {
  const which = (process.argv[2] || "all").toLowerCase();
  const list = which === "all" ? ["web", "playables", "local"] : [which];
  for (const t of list) {
    if (!TARGETS[t]) throw new Error(`Unknown target: ${t}`);
    const outDir = join(ROOT, "dist", t);
    if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
    const jsPath = await writeVariant(t, outDir);
    const size = readFileSync(jsPath).length;
    console.log(`  build ${t.padEnd(10)} -> ${jsPath}  (${(size / 1024).toFixed(1)} KB)`);
  }
  console.log("build complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
