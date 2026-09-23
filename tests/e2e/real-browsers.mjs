// Real-browser checks with the real YouTube player and real (trusted) clicks.
//   cd tests/e2e && npm install && npx playwright install chromium firefox webkit
//   node real-browsers.mjs [--quick]     (--quick: fewer videos timed)
// Browsers use their normal "no sound without a user gesture" autoplay rules.
import { chromium, firefox, webkit } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const QUICK = process.argv.includes("--quick");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".m4a": "audio/mp4" };

// tiny static server for the site folder
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/index.html`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const player = (page) => page.evaluate(() => ({
  muted: yt && yt.isMuted ? yt.isMuted() : null, state: yt && yt.getPlayerState ? yt.getPlayerState() : null,
  id: yt && yt.getVideoData ? yt.getVideoData().video_id : null, mode: audioMode, hint: !$("video-hint").hidden,
}));
const diag = (page) => page.evaluate(() => DIAG.slice());
async function waitFor(page, fn, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await page.evaluate(fn).catch(() => false)) return true; await sleep(250); }
  return false;
}

async function runBrowser(name, launcher, opts) {
  const lines = [], fail = (m) => lines.push("  ✗ " + m), pass = (m) => lines.push("  ✓ " + m);
  let browser;
  try { browser = await launcher.launch(opts); }
  catch (e) { return `✗ ${name}\n  ✗ browser didn't launch: ${e.message.split("\n")[0]}`; }
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => { if (!/doubleclick|googleads|youtube/i.test(e.message)) errors.push(e.message); });
  try {
    await page.goto(BASE);
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem("audioMode", '"coach"'); });
    await page.goto(BASE);
    if (!(await waitFor(page, () => window.YT && YT.Player && ytReady, 20000))) throw new Error("YouTube player never loaded");
    let aac = true; // set after the first voice clip is tried

    // 1. How long each demo takes to start playing (muted autoplay)
    const keys = await page.evaluate(() => Object.keys(EX).filter((k) => k !== "couchSun"));
    const sample = QUICK || name !== "Chrome" ? keys.filter((_, i) => i % 6 === 0) : keys;
    const slow = [], dead = [];
    for (const key of sample) {
      const t = Date.now();
      await page.evaluate((k) => { exitPlayer(); startPreview(k); }, key);
      const ok = await waitFor(page, () => yt.getPlayerState() === 1, 15000);
      const ms = Date.now() - t;
      if (!ok) dead.push(key); else if (ms > 6000) slow.push(`${key} ${(ms / 1000).toFixed(1)}s`);
    }
    await page.evaluate(() => exitPlayer());
    if (dead.length) fail(`demos never started: ${dead.join(", ")}`);
    if (slow.length) fail(`slow demos (>6 s): ${slow.join(", ")}`);
    if (!dead.length && !slow.length) pass(`${sample.length} demos start within 6 s`);

    // 2. A real workout with real clicks
    await page.click("text=Tuesday");
    await page.click("#start-btn");
    await waitFor(page, () => yt.getPlayerState() === 1, 15000);
    await sleep(4000);
    let p = await player(page), d = await diag(page);
    // Playwright's WebKit build has no AAC decoder (real Safari does): skip voice checks there
    aac = !d.some((l) => l.includes("NotSupportedError"));
    if (!aac) lines.push("  – this build can't play AAC voice files (real Safari can); voice checks skipped");
    !aac ? (p.muted ? pass("Coach mode: video muted") : fail("Coach mode: video not muted")) :
    p.muted && d.some((l) => l.includes("said:")) ? pass("Coach mode: coach talks, video muted") : fail(`Coach mode: muted=${p.muted}, coach spoke=${d.some((l) => l.includes("said:"))}`);

    await page.click("#sound-btn");
    await sleep(3500);
    p = await player(page);
    !p.muted && p.state === 1 ? pass("tap Video: video plays with sound") : fail(`tap Video: muted=${p.muted} state=${p.state} hint=${p.hint}`);
    const saidBefore = (await diag(page)).filter((l) => l.includes("said:")).length;

    // advance with Done / Skip rest until a different exercise's demo loads
    const firstKey = await page.evaluate(() => steps[cur].key);
    for (let i = 0; i < 12; i++) {
      const k = await page.evaluate(() => steps[cur].type === "work" && steps[cur].key);
      if (k && k !== firstKey) break;
      await page.click(await page.$("#c-done") ? "#c-done" : "#c-skip");
      await sleep(400);
    }
    await waitFor(page, () => yt.getPlayerState() === 1, 15000);
    await sleep(3500);
    p = await player(page);
    !p.muted && p.mode === "video" ? pass("video sound carries over to the next exercise") : fail(`carry-over: muted=${p.muted} mode=${p.mode} hint=${p.hint}`);
    const saidAfter = (await diag(page)).filter((l) => l.includes("said:")).length;
    saidAfter === saidBefore ? pass("coach silent in Video mode") : fail(`coach spoke ${saidAfter - saidBefore} lines in Video mode`);

    await page.click("#voice-btn");
    await sleep(4000);
    p = await player(page); d = await diag(page);
    !aac ? (p.muted ? pass("tap Coach: video mutes") : fail("tap Coach: video not muted")) :
    p.muted && d.filter((l) => l.includes("said:")).length > saidAfter ? pass("tap Coach: video mutes, coach restarts this exercise") : fail(`tap Coach: muted=${p.muted} coach spoke=${d.filter((l) => l.includes("said:")).length > saidAfter}`);

    // YouTube's own speaker button inside the video
    const frame = page.frameLocator("#yt");
    await page.hover("#yt").catch(() => {});
    const clicked = await frame.locator(".ytp-mute-button").click({ timeout: 5000 }).then(() => true).catch(() => false);
    if (clicked) {
      await sleep(1500);
      p = await player(page);
      !p.muted && p.mode === "video" ? pass("video's own speaker switches the app to Video") : fail(`video's own speaker: muted=${p.muted} mode=${p.mode}`);
    } else lines.push("  – couldn't reach YouTube's speaker button (controls hidden)");

    d = await diag(page);
    const bad = aac ? d.filter((l) => /clip blocked|clip error|no clip|JS error/.test(l)) : [];
    bad.length ? fail("voice problems: " + bad.slice(0, 3).join(" | ")) : pass("no voice clip errors");
    errors.length ? fail("page errors: " + errors.slice(0, 3).join(" | ")) : pass("no page errors");
  } catch (e) { fail("crashed: " + e.message.split("\n")[0]); }
  await browser.close();
  return `${lines.some((l) => l.includes("✗")) ? "✗" : "✓"} ${name}\n${lines.join("\n")}`;
}

const out = [];
out.push(await runBrowser("Chrome", chromium, { args: ["--autoplay-policy=document-user-activation-required"] }));
out.push(await runBrowser("Firefox", firefox, { firefoxUserPrefs: { "media.autoplay.default": 1 } }));
out.push(await runBrowser("WebKit (Safari engine)", webkit, {}));
console.log(out.join("\n"));
server.close();
