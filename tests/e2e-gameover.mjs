/*!
 * Lumenward — full loop end-to-end test: start → take damage → game over →
 * retry. Uses the aria-live region as the observable state signal.
 * Copyright (c) 2026 Lumenward. All rights reserved.
 *
 * Usage: node tests/e2e-gameover.mjs [dist/web]
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
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
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
  return new Promise((r) => server.listen(0, () => r({ server, port: server.address().port })));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
function check(cond, msg) {
  if (!cond) fails.push(msg);
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${msg}`);
}

async function live(page) {
  return page.$eval("#a11y-status", (el) => el.textContent || "").catch(() => "");
}
async function waitLive(page, re, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const txt = await live(page);
    if (re.test(txt)) return txt;
    await sleep(400);
  }
  return null;
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch (e) {
    // Sandbox fallback: use the pre-provisioned Chromium when the local
    // playwright version's own browser build isn't installed.
    const guesses = [
      "/opt/pw-browsers/chromium/chrome-linux/chrome",
      ...require("node:fs")
        .readdirSync("/opt/pw-browsers")
        .filter((d) => d.startsWith("chromium-"))
        .map((d) => `/opt/pw-browsers/${d}/chrome-linux/chrome`),
    ];
    for (const p of guesses) {
      try {
        require("node:fs").accessSync(p);
        return await chromium.launch({ headless: true, executablePath: p });
      } catch {}
    }
    throw e;
  }
}

async function run() {
  await mkdir(shotDir, { recursive: true });
  const { server, port } = await serve(dir);
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e)));

  console.log(`\n[e2e] ${dir} — full run: start -> game over -> retry`);
  await page.goto(`http://localhost:${port}/index.html`, { waitUntil: "load" });
  await sleep(900);

  // Start; park the pointer in a corner so asteroids reach the star.
  await page.keyboard.press("Space");
  await page.mouse.move(4, 4);
  const started = await waitLive(page, /run started/i, 5000);
  check(!!started, `run starts ("${started}")`);

  // Wait for game over (3 asteroid arrivals; typically ~20-45s untouched).
  const over = await waitLive(page, /game over/i, 90000);
  check(!!over, `game over reached without input ("${over}")`);
  await page.screenshot({ path: join(shotDir, "e2e-gameover.png") });

  // Score persisted?
  const best = await page.evaluate(() => {
    try {
      return {
        neu: localStorage.getItem("lumenward_best"),
        old: localStorage.getItem("last_light_best"),
      };
    } catch {
      return null;
    }
  });
  check(best && best.neu !== null, `best score persisted to lumenward_best (${JSON.stringify(best)})`);

  // Retry: gameover buttons unlock ~1s after; Space restarts the run.
  await sleep(1600);
  await page.keyboard.press("Space");
  const restarted = await waitLive(page, /run started/i, 8000);
  check(!!restarted, `retry restarts a run ("${restarted}")`);
  await page.screenshot({ path: join(shotDir, "e2e-retry.png") });

  check(errs.length === 0, `no uncaught errors during the whole loop (${errs.slice(0, 2).join(" | ")})`);

  await browser.close();
  server.close();
}

run()
  .then(() => {
    if (fails.length) {
      console.error(`\nE2E FAILED (${fails.length}):\n - ${fails.join("\n - ")}`);
      process.exit(1);
    }
    console.log("\nE2E OK");
  })
  .catch((e) => {
    console.error("E2E ERROR", e);
    process.exit(1);
  });
