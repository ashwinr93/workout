// Which demo videos show YouTube ads? Plays each one in Chrome (real YouTube, no ad
// blocker) and watches the player's own "ad-showing" state for a few seconds.
//   node ad-scan.mjs                 all videos in library.js
//   node ad-scan.mjs ID1 ID2 ...     just these (e.g. candidates for a swap)
// "AD" = the player's data includes ad slots for this video (the channel runs ads), or an ad played.
import { chromium } from "playwright";
import { createRequire } from "node:module";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const TRIES = 1, WATCH_MS = 7000;
let ids = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const label = {};
if (!ids.length) {
  const { EX } = createRequire(import.meta.url)(path.join(ROOT, "tools/load.cjs"));
  for (const [k, e] of Object.entries(EX)) {
    e.videos.forEach((v) => (label[v.id] ??= k));
    if (e.backup) label[e.backup] ??= k + " (alt)";
  }
  ids = Object.keys(label);
}

const browser = await chromium.launch({ headless: !process.argv.includes("--headed"), args: ["--autoplay-policy=no-user-gesture-required"] });
const results = [];
for (const id of ids) {
  let adSeen = 0, slow = 0, keysSeen = 0, talk = false;
  for (let t = 0; t < TRIES; t++) {
    const ctx = await browser.newContext();          // fresh cookies each try
    const page = await ctx.newPage();
    // The player's data says whether YouTube may put ads on this video (ad slots / ad config)
    let adData = false; talk = false;
    page.on("response", async (r) => {
      if (!/youtubei\/v1\/player|get_video_info/.test(r.url())) return;
      const body = await r.text().catch(() => "");
      if (/"adPlacements"|"playerAds"|"adSlots"/.test(body)) adData = true; // this video carries ads
      if (/"captionTracks"/.test(body)) talk = true;                          // speech → YouTube made captions
    });
    await page.goto(`https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1`, { referer: "https://ashwinr93.github.io/" });
    const start = Date.now();
    let ad = false, playedAt = 0;
    while (Date.now() - start < WATCH_MS) {
      ad ||= await page.evaluate(() => !!document.querySelector(".html5-video-player.ad-showing, .ad-interrupting")).catch(() => false);
      if (!playedAt && await page.evaluate(() => { const v = document.querySelector("video"); return !!v && v.currentTime > 0.2; }).catch(() => false)) playedAt = Date.now() - start;
      await new Promise((r) => setTimeout(r, 300));
    }
    if (ad || adData) adSeen++;
    if (adData) keysSeen++;
    if (!playedAt || playedAt > 6000) slow++;
    await ctx.close();
  }
  results.push({ id, what: label[id] || "", adSeen, slow, keysSeen, talk });
  process.stderr.write(".");
}
await browser.close();
const withAds = results.filter((r) => r.adSeen);
console.log(`\n${withAds.length}/${results.length} videos showed an ad (${TRIES} tries each)`);
for (const r of withAds) console.log(`  AD   ${r.id}  ${r.what}  (${r.adSeen}/${TRIES})`);
for (const r of results.filter((r) => !r.adSeen && r.slow)) console.log(`  SLOW ${r.id}  ${r.what}`);
if (process.argv.includes("--talk")) console.log("talking: " + results.filter((r) => r.talk).map((r) => r.id).join(" ") + "\nsilent/music: " + results.filter((r) => !r.talk).map((r) => r.id).join(" "));
