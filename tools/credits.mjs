// Rebuilds the "Demo videos" credits in README.md from the videos in library.js, plus the
// plan photos in programs.js.
// Channel names come from YouTube's public oEmbed endpoint.
//   node tools/credits.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = path.resolve(import.meta.dirname, "..");
const README = path.join(ROOT, "README.md");
const START = "<!-- credits:start -->", END = "<!-- credits:end -->";

const ctx = createRequire(import.meta.url)(path.join(ROOT, "tools/load.cjs"));

// video id → exercise names it demonstrates (variant names included)
const uses = new Map();
for (const ex of Object.values(ctx.EX)) {
  for (const v of ex.videos || []) {
    if (!uses.has(v.id)) uses.set(v.id, new Set());
    uses.get(v.id).add(v.name || ex.name);
  }
}

// channel → { url, videos: [{ id, title, exercises }] }
const channels = new Map(), missing = [];
for (const [id, names] of uses) {
  const r = await fetch(`https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${id}`);
  if (!r.ok) { missing.push(id); continue; }
  const { author_name, author_url, title } = await r.json();
  if (!channels.has(author_name)) channels.set(author_name, { url: author_url, videos: [] });
  channels.get(author_name).videos.push({ id, title, exercises: [...names] });
}

const md = (s) => s.replace(/([\[\]|*_`])/g, "\\$1");
const lines = [...channels.entries()]
  .sort(([a], [b]) => a.localeCompare(b, "en", { sensitivity: "base" }))
  .map(([name, { url, videos }]) => {
    const vids = videos
      .map((v) => `[${md(v.exercises.join(" / "))}](https://www.youtube.com/watch?v=${v.id})`)
      .join(", ");
    return `- **[${md(name)}](${url})**: ${vids}`;
  });

// the ready-made plans' card photos (programs.js)
const photos = [...ctx.PROGRAMS.map((p) => [p.title || ctx.examplePlan().title, p.photo]),
  ...Object.entries(ctx.OWN_PHOTOS).map(([k, ph]) => [`Your own plans (${k === "stretch" ? "stretching" : ctx.GEAR[k].name.toLowerCase()})`, ph])]
  .map(([what, ph]) => `- [${md(what)}](https://unsplash.com/photos/${ph.page}) by ${md(ph.by)}`);

const section = [START,
  `Every demo is the creator's own video, played through YouTube's embedded player (start and end points only; nothing is downloaded or edited). Thank you to these ${channels.size} channels:`,
  "", ...lines, "",
  "The plan photos come from [Unsplash](https://unsplash.com) (free to use under the [Unsplash License](https://unsplash.com/license)) and load from Unsplash's servers. Thank you to these photographers:",
  "", ...photos, END].join("\n");

const readme = fs.readFileSync(README, "utf8");
const i = readme.indexOf(START), j = readme.indexOf(END);
if (i < 0 || j < 0) throw new Error(`README.md needs ${START} and ${END} markers`);
fs.writeFileSync(README, readme.slice(0, i) + section + readme.slice(j + END.length));
console.log(`credited ${uses.size - missing.length} videos from ${channels.size} channels`);
if (missing.length) console.log("unavailable (removed or embedding off?):", missing.join(" "));
