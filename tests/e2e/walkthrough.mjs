// A first-time user's walk through the main flow, for a person to look at before a release: the
// week → today's day → Start → Skip warm-up → Done and Skip rest through several sets → leave. It
// runs in a real browser with the real YouTube player, with sound OFF (the screen alone has to say
// where you are), in portrait and landscape. For each screen it saves a screenshot and a line on
// what the screen says, then a contact sheet of them all.
//   cd tests/e2e && node walkthrough.mjs [--out <dir>] [--steps 8]
// Then read <out>/walkthrough.txt and look at <out>/sheet-*.png as someone who has never seen the app:
// can you always tell what to do, which exercise and which set you're on, and whether you're resting?
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const arg = (name, dflt) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : dflt; };
const OUT = path.resolve(arg("out", path.join(ROOT, "tests/e2e/walkthrough")));
const STEPS = +arg("steps", 8);
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

// what the screen says, in words: the top line, the name, the set, the rest heading, the video cover
const says = (page) => page.evaluate(() => {
  const t = (sel) => document.querySelector(sel)?.innerText.replace(/\s+/g, " ").trim() || "";
  if (!$("player").hidden) {
    const cover = $("rest-cover").hidden ? "demo showing" : `demo covered: "${t("#rest-cover-label")} ${t("#rest-cover-name")}"`;
    if (document.querySelector(".context.rest")) return `REST ${t("#rest-num")}s · "${t("#rest-heading")}" ${t(".upnext h3")} ${t(".upnext .muted")} · ${cover}`;
    return `${t(".context")} · ${t(".name")} · ${t(".target, .clock")} · set: "${t("#set-tracker") || "(one set)"}" · buttons: ${[...document.querySelectorAll(".controls button")].map((b) => b.innerText.trim()).join(" | ")} · ${cover}`;
  }
  const screen = ["home", "plans", "day", "create", "plan-view", "exercises"].find((id) => !$(id).hidden);
  return `${screen} screen: ${t(`#${screen} h1`)}`;
});

const log = [];
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required", "--mute-audio"] });
for (const [name, viewport] of [["portrait", { width: 393, height: 852 }], ["landscape", { width: 852, height: 393 }]]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.addInitScript(() => localStorage.setItem("plan", "null"));   // the owner's week
  await page.goto(BASE);
  await page.waitForFunction(() => typeof Video !== "undefined" && Video.ready, null, { timeout: 20000 });
  const shots = [];
  const shot = async (label) => {
    await sleep(2500);                                   // the demo loads, the screen settles
    const file = `${name}-${String(shots.length + 1).padStart(2, "0")}.png`;
    await page.screenshot({ path: path.join(OUT, file) });
    const line = `${name} ${shots.length + 1} (${label}): ${await says(page)}`;
    shots.push({ file, label }); log.push(line); console.log(line);
  };
  await shot("the app opens");
  await page.tap(".day-card.today, .day-card");          // today's workout (or the first day)
  await shot("tap today's day");
  if (!(await page.$("#start-btn"))) { log.push(`${name}: today is not a workout day; stopping`); await page.close(); continue; }
  await page.tap("#start-btn");
  await page.evaluate(() => { Sound.set("off"); });      // sound off: the screen alone must say where you are
  await shot("Start workout (sound off)");
  if (await page.$("#c-skipwarm")) { await page.tap("#c-skipwarm"); await shot("Skip warm-up"); }
  for (let i = 0; i < STEPS; i++) {
    const rest = await page.$("#c-skip");
    await page.tap(rest ? "#c-skip" : "#c-done");
    await shot(rest ? "Skip rest" : "Done");
  }
  await page.tap("#exit-btn");
  await shot("tap ✕");
  await page.tap("#exit-leave");
  await shot("Leave workout");
  // a contact sheet of this run
  const html = `<body style="margin:0;background:#222;font:12px sans-serif;color:#ddd;display:grid;grid-template-columns:repeat(${name === "portrait" ? 6 : 3},1fr);gap:8px;padding:8px">`
    + shots.map((s) => `<figure style="margin:0"><img src="${s.file}" style="width:100%;display:block;border-radius:6px"><figcaption>${s.label}</figcaption></figure>`).join("") + "</body>";
  fs.writeFileSync(path.join(OUT, `sheet-${name}.html`), html);
  const sheet = await browser.newPage({ viewport: { width: 1800, height: 1000 } });
  await sheet.goto(`file://${path.join(OUT, `sheet-${name}.html`)}`);
  await sheet.screenshot({ path: path.join(OUT, `sheet-${name}.png`), fullPage: true });
  await sheet.close(); await page.close();
}
fs.writeFileSync(path.join(OUT, "walkthrough.txt"), log.join("\n") + "\n");
await browser.close(); server.close();
console.log(`\nwrote ${OUT}/walkthrough.txt and sheet-portrait.png / sheet-landscape.png`);
