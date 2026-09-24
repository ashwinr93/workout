// Review screenshots before a push: every screen on a desktop browser, an iPhone in portrait
// (the iPhone simulator's Safari) and an iPhone in landscape (WebKit at 852×393; this Mac can't
// rotate the simulator). Writes one contact sheet per device, plus the single shots.
//   cd tests/e2e && node review.mjs [--screens home,create] [--base <url>] [--out <dir>] [--no-sim]
//   --base  review a deployed copy (e.g. https://ashwinr93.github.io/workout/staging/) instead of this folder
// Screens are opened by tests/review.js (index.html?review=…).
import { chromium, webkit } from "playwright";
import { execFileSync } from "node:child_process";
import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const OUT = arg("out", path.join(process.env.TMPDIR || os.tmpdir(), `workout-review-${Date.now()}`));
const SIM = !process.argv.includes("--no-sim");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// name → [review screen, plan link after "#", extra wait in ms]
const OWN = "v1/t:Home-Strength/mon:Full-Body-A:boxsquat.3x10-12,sarow.3x10,slbridge.2x10,planktaps.3x30s/wed:Brisk-Walk:walk.30m/fri:Full-Body-B:rdl.3x8-10,floorpress.3x10,stepup.2x8,suitcase.3x40/sun:Stretch:couch.1x60s,pigeon.1x60s";
const SCREENS = {
  home: ["home"], "home-end": ["home-end"], day: ["day:0"], "day-end": ["day-end:0"], create: ["create"],
  plans: ["plans"], plan: ["plan:gym-first"], exercises: ["exercises"], player: ["player:0", "", 5000], rest: ["rest:0", "", 3000], finish: ["finish:0"], "own-plan": ["home", OWN], fix: ["home", "v1/t:Gym/mon:Legs:legpress.3x10,rdl.3x8-10"],
};
const names = arg("screens", "home,home-end,plans,plan,exercises,day,day-end,create,player,rest,finish,own-plan,fix").split(",");
for (const n of names) if (!SCREENS[n]) throw new Error(`unknown screen "${n}" (known: ${Object.keys(SCREENS).join(", ")})`);

// this folder, served without caching (the simulator reaches it on localhost too)
let server, base = arg("base");
if (!base) {
  const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".m4a": "audio/mp4", ".png": "image/png" };
  server = http.createServer((req, res) => {
    const f = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
    if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream", "Cache-Control": "no-store" });
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}/`;
}
const url = (n) => { const [screen, hash = ""] = SCREENS[n]; return `${base}index.html?review=${screen}&t=${Date.now()}${hash ? "#" + hash : ""}`; };
fs.mkdirSync(OUT, { recursive: true });
const shots = {};   // device → [[name, file]]

async function browserShots(device, type, context) {
  const browser = await type.launch({ args: type === chromium ? ["--mute-audio", "--autoplay-policy=no-user-gesture-required"] : [] });
  const page = await (await browser.newContext(context)).newPage();
  shots[device] = [];
  for (const n of names) {
    await page.goto(url(n));
    await page.waitForFunction(() => document.documentElement.dataset.review === "ready", null, { timeout: 15000 });
    await sleep(1500 + (SCREENS[n][2] || 0));
    const file = path.join(OUT, `${device}-${n}.png`);
    await page.screenshot({ path: file });
    shots[device].push([n, file]);
  }
  await browser.close();
}

async function simulatorShots() {
  const sim = (...a) => execFileSync("xcrun", ["simctl", ...a], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  if (!/iPhone 17 \(/.test(sim("list", "devices", "booted"))) { sim("boot", "iPhone 17"); await sleep(8000); }
  sim("openurl", "booted", url(names[0])); await sleep(10000);   // Safari's first launch is slow
  shots["iphone-portrait"] = [];
  try {
    for (const n of names) {
      sim("openurl", "booted", url(n));
      await sleep(6000 + (SCREENS[n][2] || 0));
      const file = path.join(OUT, `iphone-portrait-${n}.png`);
      sim("io", "booted", "screenshot", file);
      shots["iphone-portrait"].push([n, file]);
    }
  } finally { sim("shutdown", "all"); }   // a demo left playing loops audio on the Mac
}

// one image per device: every screen side by side, labelled
async function sheets() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
  for (const [device, list] of Object.entries(shots)) {
    const w = device === "iphone-portrait" ? 260 : 560;
    const cells = list.map(([n, f]) => `<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString("base64")}" width="${w}"><figcaption>${n}</figcaption></figure>`).join("");
    await page.setContent(`<body style="margin:0;padding:20px;background:#fff;font:15px -apple-system,sans-serif">
      <h2 style="margin:0 0 12px">${device}</h2><div style="display:flex;flex-wrap:wrap;gap:18px">${cells}</div>
      <style>figure{margin:0}img{display:block;border:1px solid #ccc;border-radius:6px}figcaption{margin-top:6px;color:#555}</style></body>`);
    await page.screenshot({ path: path.join(OUT, `sheet-${device}.png`), fullPage: true });
  }
  await browser.close();
}

try {
  await browserShots("desktop", chromium, { viewport: { width: 1440, height: 900 } });
  await browserShots("iphone-landscape", webkit, { viewport: { width: 852, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  if (SIM) await simulatorShots();
  await sheets();
} finally { server?.close(); }
console.log(`${OUT}\n` + Object.keys(shots).map((d) => `  sheet-${d}.png`).join("\n"));
