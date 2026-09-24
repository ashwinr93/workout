// Finds demo videos whose YouTube thumbnail (mqdefault.jpg) is too dark to read as a picture
// (often a black first frame) and picks the brightest of YouTube's other stills (mq1/mq2/mq3).
// Prints what it finds; --write adds `thumb: "mqN"` to those videos in library.js.
//   node tools/thumbs.mjs [--write]
// Uses macOS `sips` to shrink each image to a tiny BMP, whose pixels are then averaged.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

const ROOT = path.resolve(import.meta.dirname, "..");
const ctx = createRequire(import.meta.url)(path.join(ROOT, "tools/load.cjs"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "thumbs-"));
const DARK = 20;   // mean brightness (0-255) below which a thumbnail reads as a black box (dark gym footage sits around 25-45)

// mean brightness and contrast of an image URL
async function measure(url) {
  const r = await fetch(url);
  if (!r.ok) return null;
  const jpg = path.join(tmp, "t.jpg"), bmp = path.join(tmp, "t.bmp");
  fs.writeFileSync(jpg, Buffer.from(await r.arrayBuffer()));
  execFileSync("sips", ["-s", "format", "bmp", "-z", "18", "32", jpg, "--out", bmp], { stdio: "ignore" });
  const b = fs.readFileSync(bmp), off = b.readUInt32LE(10), w = b.readInt32LE(18), h = Math.abs(b.readInt32LE(22)), bpp = b.readUInt16LE(28) / 8;
  const row = Math.ceil((w * bpp) / 4) * 4, lum = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = off + y * row + x * bpp;
    lum.push(0.114 * b[i] + 0.587 * b[i + 1] + 0.299 * b[i + 2]);
  }
  const mean = lum.reduce((a, v) => a + v, 0) / lum.length;
  const sd = Math.sqrt(lum.reduce((a, v) => a + (v - mean) ** 2, 0) / lum.length);
  return { mean, sd };
}

const ids = [...new Set(Object.values(ctx.EX).flatMap((ex) => ex.videos.map((v) => v.id)))];
const picks = {};
for (const id of ids) {
  const base = await measure(`https://i.ytimg.com/vi/${id}/mqdefault.jpg`);
  if (!base || base.mean >= DARK) continue;
  let best = null;
  for (const n of [1, 2, 3]) {
    const m = await measure(`https://i.ytimg.com/vi/${id}/mq${n}.jpg`);
    if (m && m.mean >= DARK && (!best || m.mean + m.sd > best.score)) best = { n, score: m.mean + m.sd };
  }
  console.log(`${id}: mqdefault brightness ${base.mean.toFixed(0)} → ${best ? `mq${best.n}` : "no brighter still"}`);
  if (best) picks[id] = `mq${best.n}`;
}
if (process.argv.includes("--write")) {
  const file = path.join(ROOT, "library.js");
  let src = fs.readFileSync(file, "utf8");
  for (const [id, thumb] of Object.entries(picks)) {
    src = src.replace(new RegExp(`(\\{ id: "${id}")(, thumb: "mq\\d")?`, "g"), `$1, thumb: "${thumb}"`);
  }
  fs.writeFileSync(file, src);
  console.log(`library.js: ${Object.keys(picks).length} thumbnails set`);
}
fs.rmSync(tmp, { recursive: true, force: true });
