// Saves every plan photo named in programs.js (PROGRAMS and OWN_PHOTOS) into photos/, from Unsplash,
// 1000 px wide, so the site serves them itself. Only missing files are fetched; run after adding or
// swapping a photo, then `node tools/credits.mjs`.
//   node tools/photos.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = path.resolve(import.meta.dirname, "..");
const ctx = createRequire(import.meta.url)(path.join(ROOT, "tools/load.cjs"));
const dir = path.join(ROOT, "photos");
fs.mkdirSync(dir, { recursive: true });

const photos = [...ctx.PROGRAMS.map((p) => p.photo), ...Object.values(ctx.OWN_PHOTOS)];
let fetched = 0;
for (const ph of photos) {
  const file = path.join(dir, `${ph.page}.jpg`);
  if (fs.existsSync(file)) continue;
  const r = await fetch(`https://images.unsplash.com/photo-${ph.img}?w=1000&q=68&fm=jpg&fit=crop`);
  if (!r.ok) { console.log(`couldn't fetch ${ph.page}: HTTP ${r.status}`); continue; }
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  fetched++;
}
const used = new Set(photos.map((ph) => `${ph.page}.jpg`));
const unused = fs.readdirSync(dir).filter((f) => !used.has(f));
console.log(`${photos.length} photos, ${fetched} fetched${unused.length ? `; not used any more: ${unused.join(" ")}` : ""}`);
