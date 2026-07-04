/*!
 * Lumenward — variant isolation audit.
 * Copyright (c) 2026 Lumenward. All rights reserved.
 *
 * Each distribution bundle must contain ONLY its own platform surface, so no
 * variant can break (or leak into) another platform's rules:
 *   - playables: fully offline except the YouTube SDK; no ads, no Supabase
 *   - local (itch): fully offline; no YouTube, no ads, no Supabase
 *   - web: strict-CSP; ad/leaderboard code allowed but inert without env
 *
 * Usage: node tests/audit.mjs   (expects dist/ to exist — run build first)
 */
import { readFileSync } from "node:fs";

const fails = [];
function check(cond, msg) {
  if (!cond) fails.push(msg);
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${msg}`);
}

function origins(src) {
  return [...new Set(src.match(/https?:\/\/[a-z0-9.-]+/gi) || [])].map((u) =>
    u.replace(/^https?:\/\//i, ""),
  );
}

function audit(name, files, { allowOrigins, forbid }) {
  const src = files.map((f) => readFileSync(f, "utf8")).join("\n");
  const found = origins(src).filter((o) => !allowOrigins.includes(o.toLowerCase()));
  check(found.length === 0, `${name}: no unexpected network origins (${found.join(", ") || "none"})`);
  for (const [label, re] of forbid) {
    check(!re.test(src), `${name}: contains no ${label}`);
  }
}

console.log("\n[audit] variant isolation");

audit("playables", ["dist/playables/app.min.js", "dist/playables/index.html"], {
  allowOrigins: ["www.youtube.com", "www.w3.org"],
  forbid: [
    ["AdSense/ad code", /adsbygoogle|adBreak\s*\(/i],
    ["Supabase/leaderboard endpoints", /supabase\.co|\/rest\/v1\//i],
  ],
});

audit("local (itch)", ["dist/local/app.min.js", "dist/local/index.html"], {
  allowOrigins: ["www.w3.org"],
  forbid: [
    ["YouTube SDK references", /youtube\.com\/game_api|ytgame/i],
    ["AdSense/ad code", /adsbygoogle|adBreak\s*\(/i],
    ["Supabase/leaderboard endpoints", /supabase\.co|\/rest\/v1\//i],
  ],
});

// Web may carry ad/leaderboard capability, but with no env configured the
// bundle must not point at any concrete third-party origin except schema.org
// metadata and (when configured) the ones injected deliberately.
const webSrc =
  readFileSync("dist/web/app.min.js", "utf8") + readFileSync("dist/web/index.html", "utf8");
const webAllowed = ["schema.org", "www.w3.org", "openapi.vercel.sh", "lumenward.vercel.app"];
const webEnvConfigured = /LLEnv=\{[^}]*"adsenseClient":"(?!")/.test(webSrc) || /supabase\.co/.test(webSrc);
if (!webEnvConfigured) {
  const found = origins(webSrc).filter((o) => !webAllowed.includes(o.toLowerCase()));
  check(
    found.length === 0,
    `web (no env): no live third-party origins baked in (${found.join(", ") || "none"})`,
  );
} else {
  console.log("  note: web build has env-configured integrations (expected on deploy builds)");
}

if (fails.length) {
  console.error(`\nAUDIT FAILED (${fails.length}):\n - ${fails.join("\n - ")}`);
  process.exit(1);
}
console.log("\nAUDIT OK");
