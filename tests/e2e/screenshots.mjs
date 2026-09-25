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

// The link preview chat apps and X show when the site is shared (og:image): a card, not a screenshot,
// 1200×630 and a small JPEG (WhatsApp drops preview images over about 300 KB). The app's name, what it
// is in one line, and the player as it looks mid-set.
const img = (f) => `data:image/png;base64,${fs.readFileSync(path.join(OUT, f)).toString("base64")}`;
const icon = `data:image/svg+xml;base64,${fs.readFileSync(path.join(ROOT, "icons/icon.svg")).toString("base64")}`;
page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
// the player sits beside the words (from the name down), not beside the icon above them
await page.setContent(`<body style="margin:0;width:1200px;height:630px;background:#0d1015;color:#eef1f5;font-family:-apple-system,system-ui,sans-serif;overflow:hidden;
    display:grid;grid-template-columns:430px 660px;column-gap:24px;align-content:center;padding-left:60px;box-sizing:border-box">
  <img src="${icon}" style="width:84px;height:84px;border-radius:20px;grid-column:1">
  <div style="grid-column:1;grid-row:2;align-self:center;margin-top:26px">
    <div style="font-size:62px;font-weight:800;letter-spacing:-1.5px;line-height:1.02">Workout Coach</div>
    <div style="font-size:28px;line-height:1.3;margin-top:18px;color:#c9ced6">A simple, free workout coach in your browser</div>
    <div style="font-size:22px;line-height:1.45;margin-top:26px;color:#3ddc97;font-weight:650">Demo videos · A coach voice · Timers</div>
    <div style="font-size:22px;line-height:1.45;color:#8b95a3">No sign-up, no ads, nothing to install</div>
  </div>
  <img src="${img("player.png")}" style="grid-column:2;grid-row:2;align-self:center;margin-top:26px;width:660px;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.6);border:1px solid #232a33">
</body>`);
await page.screenshot({ path: `${OUT}/share.jpg`, type: "jpeg", quality: 82 });
await page.close();

await browser.close();
server.close();
console.log("wrote docs/home.png, docs/plans.png, docs/day.png, docs/player.png, docs/share.jpg");
