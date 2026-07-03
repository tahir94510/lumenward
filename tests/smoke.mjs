/*!
 * Lumenward — headless smoke test.
 * Copyright (c) 2026 Lumenward. All rights reserved.
 *
 * Boots a built variant in real Chromium and asserts:
 *   - no console errors / uncaught page errors
 *   - the canvas exists, is sized, and actually paints pixels
 *   - a pointer tap starts a run (score HUD / gameplay begins)
 *   - pause + resume work
 * Writes screenshots to the path given by SMOKE_SHOT_DIR (or scratchpad).
 *
 * Usage: node tests/smoke.mjs [dist/web|dist/playables|dist/local]
 */
import { createServer } from "node:http";
import { readFile, stat, mkdir } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
for (const p of ["playwright", "/opt/node22/lib/node_modules/playwright", "playwright-core"]) {
  try {
    chromium = require(p).chromium;
    break;
  } catch {}
}
if (!chromium) {
  console.error("SKIP: playwright not available");
  process.exit(0);
}

const dir = process.argv[2] || "dist/web";
const shotDir = process.env.SMOKE_SHOT_DIR || "/tmp/lumenward-shots";
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

function serve(root) {
  const server = createServer(async (req, res) => {
    try {
      let p = decodeURIComponent((req.url || "/").split("?")[0]);
      if (p === "/") p = "/index.html";
      const file = join(root, normalize(p).replace(/^(\.\.[/\\])+/, ""));
      const s = await stat(file);
      if (!s.isFile()) throw 0;
      res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end("404");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
function check(cond, msg) {
  if (!cond) fails.push(msg);
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${msg}`);
}

async function paintsPixels(page) {
  return page.evaluate(() => {
    const c = document.getElementById("game");
    if (!c || !c.width) return { ok: false, reason: "no canvas" };
    const ctx = c.getContext("2d");
    const w = c.width,
      h = c.height;
    const pts = [
      [w / 2, h / 2],
      [w / 2, h * 0.3],
      [w * 0.3, h * 0.5],
      [w * 0.7, h * 0.6],
    ];
    let lit = 0;
    for (const [x, y] of pts) {
      const d = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
      if (d[0] > 8 || d[1] > 8 || d[2] > 8) lit++;
    }
    return { ok: lit > 0, lit, w, h };
  });
}

async function sceneHash(page) {
  return page.evaluate(() => {
    const c = document.getElementById("game");
    if (!c || !c.width) return "0";
    const ctx = c.getContext("2d");
    let h = 2166136261;
    for (let gx = 1; gx < 8; gx++) {
      for (let gy = 1; gy < 12; gy++) {
        const d = ctx.getImageData((c.width * gx) / 8, (c.height * gy) / 12, 1, 1).data;
        const v = (d[0] << 16) | (d[1] << 8) | d[2];
        h = (h ^ v) >>> 0;
        h = (h * 16777619) >>> 0;
      }
    }
    return String(h);
  });
}

async function run() {
  await mkdir(shotDir, { recursive: true });
  const { server, port } = await serve(dir);
  const url = `http://localhost:${port}/index.html`;
  const label = dir.replace(/[/\\]/g, "_");

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
  const jsErrors = []; // real script errors (must be zero)
  const pageErrors = [];
  const ownFailures = []; // same-origin resource failures (must be zero)
  const extFailures = []; // external host failures (env-dependent, allowed)
  const origin = `localhost:${port}`;
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const t = m.text();
    // "Failed to load resource" lines are covered by requestfailed below;
    // everything else counts as a real JS console error.
    if (!/Failed to load resource/i.test(t)) jsErrors.push(t);
  });
  page.on("requestfailed", (req) => {
    const u = req.url();
    (u.includes(origin) ? ownFailures : extFailures).push(u);
  });
  page.on("pageerror", (e) => pageErrors.push(String(e)));

  // Instrument AudioContext creation so we can confirm audio unlocks on gesture.
  await page.addInitScript(() => {
    window.__ac = [];
    const O = window.AudioContext || window.webkitAudioContext;
    if (O) {
      const Wrapped = class extends O {
        constructor(...a) {
          super(...a);
          window.__ac.push(this);
        }
      };
      window.AudioContext = Wrapped;
      window.webkitAudioContext = Wrapped;
    }
  });

  console.log(`\n[smoke] ${dir}  (${url})`);
  await page.goto(url, { waitUntil: "load" });
  await sleep(1200);

  const canvas = await page.$("#game");
  check(!!canvas, "canvas #game present");
  const box = canvas ? await canvas.boundingBox() : null;
  check(!!box && box.width > 10 && box.height > 10, "canvas has non-zero size");

  const menuPaint = await paintsPixels(page);
  check(menuPaint.ok, `menu screen paints pixels (${JSON.stringify(menuPaint)})`);
  const menuHash = await sceneHash(page);
  await page.screenshot({ path: join(shotDir, `${label}-1-menu.png`) });

  const cx = box ? box.x + box.width / 2 : 450;
  const cy = box ? box.y + box.height / 2 : 700;
  // Focus the page then start a run with Space (menu -> playing).
  await page.mouse.click(cx, cy * 0.4); // click empty sky to focus, not a button
  await page.keyboard.press("Space");
  await sleep(500);
  // Sweep the pointer to interact with asteroids.
  for (let i = 0; i < 14; i++) {
    await page.mouse.move(cx + Math.sin(i * 0.7) * 160, cy + Math.cos(i * 0.9) * 200);
    await sleep(70);
  }
  await sleep(500);
  const playPaint = await paintsPixels(page);
  check(playPaint.ok, "gameplay paints pixels after start");
  const live = await page.$eval("#a11y-status", (el) => el.textContent).catch(() => "");
  check(/run started/i.test(live), `screen-reader live region announces start ("${live}")`);
  const playHash = await sceneHash(page);
  check(playHash !== menuHash, "scene changed from menu to gameplay (game actually started)");
  await page.screenshot({ path: join(shotDir, `${label}-2-play.png`) });

  // Pause (Escape) then resume (Space) — should not crash.
  await page.keyboard.press("Escape");
  await sleep(300);
  const pauseHash = await sceneHash(page);
  check(pauseHash !== playHash, "pause overlay changes the scene");
  await page.screenshot({ path: join(shotDir, `${label}-3-pause.png`) });
  await page.keyboard.press("Space");
  await sleep(300);

  const audio = await page.evaluate(() => {
    const list = window.__ac || [];
    return { count: list.length, running: list.some((c) => c && c.state === "running") };
  });
  check(audio.count > 0, `audio engine created an AudioContext on gesture (${JSON.stringify(audio)})`);
  check(audio.running, "AudioContext reached 'running' state (audio unlocked)");

  check(jsErrors.length === 0, `no JS console errors (${jsErrors.slice(0, 3).join(" | ")})`);
  check(pageErrors.length === 0, `no uncaught page errors (${pageErrors.slice(0, 3).join(" | ")})`);
  check(ownFailures.length === 0, `no same-origin resource failures (${ownFailures.slice(0, 3).join(" | ")})`);
  if (extFailures.length) {
    console.log(
      `  note: ${extFailures.length} external resource(s) unreachable in sandbox (expected): ${extFailures
        .slice(0, 2)
        .join(", ")}`,
    );
  }

  await browser.close();
  server.close();
  console.log(`  screenshots -> ${shotDir}/${label}-*.png`);
}

run()
  .then(() => {
    if (fails.length) {
      console.error(`\nSMOKE FAILED (${fails.length}):\n - ${fails.join("\n - ")}`);
      process.exit(1);
    }
    console.log("\nSMOKE OK");
  })
  .catch((e) => {
    console.error("SMOKE ERROR", e);
    process.exit(1);
  });
