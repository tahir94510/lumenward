/*!
 * Lumenward — minimal, dependency-free ZIP writer.
 * Copyright (c) 2026 Lumenward. All rights reserved.
 *
 * Packs a directory into a .zip (deflate) so distribution bundles (the YouTube
 * Playables offline package, the itch.io upload) can be produced in CI with no
 * external tools. Usage: node tools/zip.mjs <srcDir> <outFile.zip>
 */
import { deflateRawSync } from "node:zlib";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (buf) => {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
})();

function walk(dir, base = dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, base, out);
    else out.push({ abs: p, name: relative(base, p).split(sep).join("/") });
  }
  return out;
}

function u16(n) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(n >>> 0, 0);
  return b;
}
function u32(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n >>> 0, 0);
  return b;
}

function zipDir(srcDir, outFile) {
  const files = walk(srcDir).sort((a, b) => a.name.localeCompare(b.name));
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const data = readFileSync(f.abs);
    const crc = CRC(data);
    const comp = deflateRawSync(data, { level: 9 });
    const nameBuf = Buffer.from(f.name, "utf8");
    const local = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(8), // deflate
      u16(0),
      u16(0x21), // dos time/date (arbitrary, valid)
      u32(crc),
      u32(comp.length),
      u32(data.length),
      u16(nameBuf.length),
      u16(0),
      nameBuf,
      comp,
    ]);
    chunks.push(local);
    central.push(
      Buffer.concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(8),
        u16(0),
        u16(0x21),
        u32(crc),
        u32(comp.length),
        u32(data.length),
        u16(nameBuf.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        nameBuf,
      ]),
    );
    offset += local.length;
  }
  const centralBuf = Buffer.concat(central);
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralBuf.length),
    u32(offset),
    u16(0),
  ]);
  writeFileSync(outFile, Buffer.concat([...chunks, centralBuf, end]));
  console.log(`zipped ${files.length} files -> ${outFile} (${(offset / 1024).toFixed(1)} KB)`);
}

const [srcDir, outFile] = process.argv.slice(2);
if (!srcDir || !outFile) {
  console.error("usage: node tools/zip.mjs <srcDir> <outFile.zip>");
  process.exit(1);
}
zipDir(srcDir, outFile);
