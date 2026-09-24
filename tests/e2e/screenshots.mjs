// Screenshots for the README (docs/*.png), taken from the real app with real YouTube.
//   cd tests/e2e && node screenshots.mjs
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.join(ROOT, "docs");
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".m4a": "audio/mp4",
  ".jpg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}/index.html`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--mute-audio", "--autoplay-policy=no-user-gesture-required"] });
const phone = { deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function open(viewport) {
  const page = await browser.newPage({ viewport, ...phone });
  await page.addInitScript(() => localStorage.setItem("plan", "null"));   // the owner's week, not a newcomer's Plans tab
  await page.goto(BASE);
  await page.waitForFunction(() => typeof Video !== "undefined" && Video.ready, null, { timeout: 20000 });
  return page;
}
// Start a day's workout (no warm-up) and wait until its first demo is playing
async function playFirst(page, dayName) {
  await page.evaluate((n) => {
    const day = Plans.current.days.find((d) => DAY_NAMES[d.d] === n);
    UI.openDay(day);
    Workout.start({ warm: false, cool: false, label: `${n} · ${day.name}` });
  }, dayName);
  await page.waitForFunction(() => Video.yt.getPlayerState() === 1, null, { timeout: 20000 });
  await sleep(4000); // past any first-frame blur
}

// Phone, portrait: home, Plans and a day
let page = await open({ width: 402, height: 874 });
await sleep(1000);                                  // the plan's photo
await page.screenshot({ path: `${OUT}/home.png` });
await page.evaluate(() => UI.tab("plans"));
await sleep(1500);
await page.screenshot({ path: `${OUT}/plans.png` });
await page.evaluate(() => UI.openDay(Plans.current.days.find((d) => DAY_NAMES[d.d] === "Tuesday")));
await sleep(1500);
await page.screenshot({ path: `${OUT}/day.png` });
await page.close();

// Phone, landscape (what gets mirrored to the TV)
page = await open({ width: 852, height: 393 });
await playFirst(page, "Monday");
await page.screenshot({ path: `${OUT}/player.png` });
await page.close();

// The link preview a chat app shows when the site is shared (og:image, 1200×630)
page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.addInitScript(() => localStorage.setItem("plan", "null"));
await page.goto(BASE);
await page.evaluate(() => UI.tab("plans"));
await sleep(2000);
await page.screenshot({ path: `${OUT}/share.png` });
await page.close();

await browser.close();
server.close();
console.log("wrote docs/home.png, docs/plans.png, docs/day.png, docs/player.png, docs/share.png");
