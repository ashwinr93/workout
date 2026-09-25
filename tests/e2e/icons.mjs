// Renders icons/icon.svg to the PNGs the Home Screen and browsers use (icons/icon-180/192/512.png), and
// icon-maskable-512.png: Android crops that one to its own shape (circle, squircle…), so it's the full
// square; the ring sits inside the middle 80% that every shape keeps.
//   cd tests/e2e && node icons.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const svg = fs.readFileSync(path.join(ROOT, "icons/icon.svg"), "utf8");
const browser = await chromium.launch();
const square = svg.replace(/rx="112"/, 'rx="0"');
for (const [name, size] of [["icon-180", 180], ["icon-192", 192], ["icon-512", 512], ["icon-maskable-512", 512]]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  // Apple rounds the corners itself, and Android masks the maskable one: both get the full square
  const art = name === "icon-180" || name.includes("maskable") ? square : svg;
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${art}`);
  await page.screenshot({ path: path.join(ROOT, `icons/${name}.png`), omitBackground: true });
  await page.close();
}
await browser.close();
console.log("wrote icons/icon-180.png, icon-192.png, icon-512.png, icon-maskable-512.png");
