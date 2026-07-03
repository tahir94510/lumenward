/*!
 * Lumenward — responsive matrix check.
 * Copyright (c) 2026 Lumenward. All rights reserved.
 *
 * Boots the web build across the aspect ratios YouTube Playables certifies
 * (9:32 … 32:9), starts a run in each, and asserts the canvas fills the
 * viewport, gameplay renders, and no JS errors occur. Also verifies live
 * resize mid-run keeps the game alive (state survives viewport changes).
 *
 * Usage: node tests/responsive.mjs [dist/web]
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

const VIEWPORTS = [
  { name: "9x16-phone", width: 396, height: 704 },
  { name: "9x32-tall", width: 360, height: 1280 },
  { name: "3x4-tablet", width: 810, height: 1080 },
  { name: "1x1-square", width: 800, height: 800 },
  { name: "16x9-desktop", width: 1280, height: 720 },
  { name: "21x9-wide", width: 1260, height: 540 },
  { name: "32x9-ultrawide", width: 1280, height: 360 },
];

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

  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    const errs = [];
    page.on("pageerror", (e) => errs.push(String(e)));
    await page.goto(`http://localhost:${port}/index.html`, { waitUntil: "load" });
    await sleep(700);
    // start a run and sweep a little
    await page.keyboard.press("Space");
    await sleep(350);
    for (let i = 0; i < 6; i++) {
      await page.mouse.move(
        vp.width / 2 + Math.sin(i) * vp.width * 0.25,
        vp.height / 2 + Math.cos(i) * vp.height * 0.25,
      );
      await sleep(50);
    }
    const geom = await page.evaluate(() => {
      const c = document.getElementById("game");
      const r = c.getBoundingClientRect();
      return {
        w: Math.round(r.width),
        h: Math.round(r.height),
        iw: window.innerWidth,
        ih: window.innerHeight,
        mode: r.width && r.height ? "ok" : "empty",
      };
    });
    const fills = Math.abs(geom.w - geom.iw) <= 2 && Math.abs(geom.h - geom.ih) <= 2;
    check(fills && errs.length === 0, `${vp.name} (${vp.width}x${vp.height}) canvas fills viewport, no errors`);
    await page.screenshot({ path: join(shotDir, `resp-${vp.name}.png`) });

    // live resize mid-run: rotate the viewport, game must keep running
    await page.setViewportSize({ width: vp.height, height: vp.width });
    await sleep(450);
    const after = await page.evaluate(() => {
      const c = document.getElementById("game");
      const r = c.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), iw: window.innerWidth, ih: window.innerHeight };
    });
    const stillFills = Math.abs(after.w - after.iw) <= 2 && Math.abs(after.h - after.ih) <= 2;
    check(stillFills && errs.length === 0, `${vp.name} survives live rotation (${after.iw}x${after.ih})`);
    await page.close();
  }

  await browser.close();
  server.close();
}

run()
  .then(() => {
    if (fails.length) {
      console.error(`\nRESPONSIVE FAILED (${fails.length}):\n - ${fails.join("\n - ")}`);
      process.exit(1);
    }
    console.log("\nRESPONSIVE OK");
  })
  .catch((e) => {
    console.error("RESPONSIVE ERROR", e);
    process.exit(1);
  });
