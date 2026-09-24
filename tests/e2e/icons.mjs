// Renders icons/icon.svg to the PNGs the Home Screen and browsers use (icons/icon-180/192/512.png).
//   cd tests/e2e && node icons.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const svg = fs.readFileSync(path.join(ROOT, "icons/icon.svg"), "utf8");
const browser = await chromium.launch();
for (const size of [180, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  // Apple rounds the corners itself, so its icon is the full square
  const art = size === 180 ? svg.replace(/rx="112"/, 'rx="0"') : svg;
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${art}`);
  await page.screenshot({ path: path.join(ROOT, `icons/icon-${size}.png`), omitBackground: true });
  await page.close();
}
await browser.close();
console.log("wrote icons/icon-180.png, icon-192.png, icon-512.png");
