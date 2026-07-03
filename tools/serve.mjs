/*!
 * Lumenward — tiny static file server for local development / smoke tests.
 * Copyright (c) 2026 Lumenward. All rights reserved.
 * Usage: node tools/serve.mjs [dir] [port]
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";

const dir = process.argv[2] || "dist/web";
const port = Number(process.argv[3] || 5173);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p === "/") p = "/index.html";
    const file = join(dir, normalize(p).replace(/^(\.\.[/\\])+/, ""));
    const s = await stat(file);
    if (!s.isFile()) throw new Error("not a file");
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404");
  }
});
server.listen(port, () => console.log(`serving ${dir} at http://localhost:${port}`));
