// Checks every demo's trim points: what the real YouTube player shows at a demo's start, a couple of
// seconds in, and just before its end. A start that lands on a logo, an intro or someone doing a
// different exercise looks like the wrong video for a moment (the owner took it for a bug), and an
// end on a "subscribe" card looks broken too. One row of frames per demo, several demos per sheet.
//   cd tests/e2e && node trims.mjs [--out <dir>] [--at 9,11,13] [ID ...]   (--at: frames at these seconds instead)
// Look at every row: the first frame should already show the exercise, the last one still show it.
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = path.resolve(import.meta.dirname, "../..");
const argv = process.argv.slice(2), oi = argv.indexOf("--out"), ai = argv.indexOf("--at");
const AT = ai >= 0 ? argv[ai + 1].split(",").map(Number) : null;
const OUT = path.resolve(oi >= 0 ? argv[oi + 1] : path.join(ROOT, "tests/e2e/trims"));
const only = argv.filter((a, i) => !a.startsWith("--") && i !== oi + 1 && i !== ai + 1);
fs.mkdirSync(OUT, { recursive: true });
const { EX } = createRequire(import.meta.url)(path.join(ROOT, "tools/load.cjs"));

// every demo: which exercise, where it starts and ends
const demos = Object.entries(EX).flatMap(([key, ex]) => ex.videos.map((v, vi) => ({ key, vi, name: v.name || ex.name, ...v })))
  .filter((d) => !only.length || only.includes(d.id));

// a page with just the YouTube player on it (the embed needs a real http origin)
const PAGE = `<!doctype html><body style="margin:0;background:#000"><div id="p"></div>
<script src="https://www.youtube.com/iframe_api"></script><script>
window.onYouTubeIframeAPIReady = () => { window.P = new YT.Player("p", { width: 480, height: 270,
  playerVars: { mute: 1, playsinline: 1, controls: 0, rel: 0, modestbranding: 1, iv_load_policy: 3, disablekb: 1 },
  events: { onReady: () => { window.ready = true; } } }); };
</script></body>`;
const server = http.createServer((req, res) => { res.writeHead(200, { "Content-Type": "text/html" }); res.end(PAGE); });
await new Promise((r) => server.listen(0, r));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
const page = await browser.newPage({ viewport: { width: 480, height: 270 } });
await page.goto(`http://localhost:${server.address().port}/`);
await page.waitForFunction(() => window.ready, null, { timeout: 30000 });

const rows = [];
for (const d of demos) {
  await page.evaluate(({ id, start }) => { P.loadVideoById({ videoId: id, startSeconds: start || 0 }); }, d);
  const ok = await page.waitForFunction(() => P.getPlayerState() === 1 && P.getDuration() > 0, null, { timeout: 20000 }).then(() => true, () => false);
  if (!ok) { rows.push({ d, error: "didn't play" }); console.log(d.key, d.id, "didn't play"); continue; }
  const dur = await page.evaluate(() => P.getDuration());
  const s = d.start || 0, e = d.end || dur;
  const times = (AT || [s, s + 1, s + 2.5, e - 2, e - 0.6]).map((t) => Math.max(0, Math.min(t, dur - 0.3)));
  await page.evaluate(() => P.pauseVideo());
  const frames = [];
  for (const t of times) {
    await page.evaluate((t) => P.seekTo(t, true), t);
    await sleep(1400);                                   // let the seeked frame paint
    const file = `${d.id}-${t.toFixed(1)}.jpg`;
    await page.screenshot({ path: path.join(OUT, file), type: "jpeg", quality: 60 });
    frames.push({ t, file });
  }
  rows.push({ d, dur, frames });
  console.log(`${d.key}${d.vi ? ` (demo ${d.vi + 1})` : ""}  ${d.id}  start ${s}  end ${d.end ?? "(end)"}  of ${dur.toFixed(0)}s`);
}

// contact sheets: 12 demos per sheet, a row each
const label = (r) => `${r.d.key}${r.d.vi ? ` · demo ${r.d.vi + 1}` : ""} · ${r.d.name} · ${r.d.id} · start ${r.d.start ?? 0} · end ${r.d.end ?? "(end)"}${r.dur ? ` of ${r.dur.toFixed(0)}s` : ""}`;
const sheet = await browser.newPage({ viewport: { width: 1250, height: 800 } });
for (let n = 0; n * 12 < rows.length; n++) {
  const html = `<body style="margin:0;background:#1b1b1b;color:#ddd;font:13px sans-serif;padding:6px">` + rows.slice(n * 12, n * 12 + 12).map((r) =>
    `<div style="margin:4px 0 10px"><div style="margin-bottom:3px">${label(r)}</div>${r.error ? `<b style="color:#f66">${r.error}</b>` : `<div style="display:flex;flex-wrap:wrap;gap:4px">${r.frames.map((f) =>
      `<figure style="margin:0"><img src="${f.file}" width="240"><figcaption>${f.t.toFixed(1)}s</figcaption></figure>`).join("")}</div>`}</div>`).join("") + "</body>";
  fs.writeFileSync(path.join(OUT, `sheet-${n + 1}.html`), html);
  await sheet.goto(`file://${path.join(OUT, `sheet-${n + 1}.html`)}`);
  await sheet.screenshot({ path: path.join(OUT, `sheet-${n + 1}.png`), fullPage: true });
}
await browser.close(); server.close();
console.log(`\n${rows.length} demos → ${OUT}/sheet-*.png`);
