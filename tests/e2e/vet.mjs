// Look inside candidate demo videos before adding them: title, channel, length, whether someone
// talks, and a contact sheet of frames across the whole video for trimming
// intros/outros and writing cues that match what the demo shows.
//   node vet.mjs --out <dir> ID1 ID2 ...
// Writes <dir>/<id>.png (frames with their timestamps) and <dir>/<id>.txt (details).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2), oi = argv.indexOf("--out");
const OUT = oi >= 0 ? argv[oi + 1] : "vet-out";
const ids = argv.filter((a, i) => !a.startsWith("--") && i !== oi + 1);
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

for (const id of ids) {
  await page.goto(`https://www.youtube.com/watch?v=${id}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.ytInitialPlayerResponse, null, { timeout: 20000 }).catch(() => {});
  const pr = await page.evaluate(() => window.ytInitialPlayerResponse || null);
  if (!pr?.videoDetails) { console.log(id, "unavailable"); continue; }
  const d = pr.videoDetails, len = +d.lengthSeconds;
  const lines = [`${id}  "${d.title}"  by ${d.author}  ${len}s  embeddable:${pr.playabilityStatus?.playableInEmbed}`];

  // someone talks → YouTube made captions (their text can't be downloaded reliably any more)
  lines.push(`speech: ${pr.captions?.playerCaptionsTracklistRenderer?.captionTracks?.length ? "yes (voice: true)" : "none"}`);

  // storyboard: the highest-resolution level, frames laid out in sprite sheets
  const spec = pr.storyboards?.playerStoryboardSpecRenderer?.spec;
  if (spec) {
    const [base, ...levels] = spec.split("|"), L = levels.length - 1, [w, h, count, cols, rows, interval, name, sigh] = levels[L].split("#");
    const perSheet = +cols * +rows, sheets = Math.ceil(+count / perSheet);
    const urls = Array.from({ length: sheets }, (_, n) => base.replace("$L", L).replace("$N", name.replace("$M", n)) + `&sigh=${sigh}`);
    const step = +interval > 0 ? +interval / 1000 : len / +count;
    // one labelled grid of every frame (at most ~60)
    const every = Math.max(1, Math.ceil(+count / 60));
    const cells = [];
    for (let i = 0; i < +count; i += every) cells.push({ i, sheet: Math.floor(i / perSheet), col: (i % perSheet) % +cols, row: Math.floor((i % perSheet) / +cols) });
    const html = `<body style="margin:0;background:#111;color:#fff;font:12px sans-serif;display:flex;flex-wrap:wrap;gap:4px;padding:4px;width:${(+w + 4) * 8}px">${cells.map((c) =>
      `<div><div style="width:${w}px;height:${h}px;background:url('${urls[c.sheet]}') -${c.col * w}px -${c.row * h}px"></div>${(c.i * step).toFixed(1)}s</div>`).join("")}</body>`;
    const p2 = await browser.newPage({ viewport: { width: (+w + 4) * 8 + 8, height: 400 } });
    await p2.setContent(html); await p2.waitForLoadState("networkidle").catch(() => {});
    await p2.screenshot({ path: path.join(OUT, `${id}.png`), fullPage: true }); await p2.close();
    lines.push(`frames: ${count} every ${step.toFixed(1)}s → ${id}.png`);
  } else lines.push("frames: no storyboard");
  fs.writeFileSync(path.join(OUT, `${id}.txt`), lines.join("\n") + "\n");
  console.log(lines[0]);
}
await browser.close();
