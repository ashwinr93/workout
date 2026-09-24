/* Plans: which exercises happen on which days, and how much of each.

   A plan travels in the link, after "#", in a short form an AI can write and a person can read:

     #v1/t:Home-Strength/mon:Full-Body-A:boxsquat.3x10-12,sarow.3x10,planktaps.3x30s/wed:Brisk-Walk:walk.30m

     v1                  format version
     t:Title             the plan's name, words joined with hyphens
     mon:Day-Name:items  one part per training day (mon … sun); days left out are rest days
       exercise.SETSxREPS       sarow.3x10, or a standard range: sarow.3x10-12
       exercise.SETSxSECONDSs   planktaps.3x30s (holds)
       exercise.SETSxMETRES     suitcase.3x40 (carries)
       exercise                 the library's default amount
       activity.MINUTESm        walk.30m, or just "sport": an activity day (one activity, nothing else)
     A day of only stretches is a stretch day.

   parsePlan() is forgiving: it ignores case and spaces, fixes near-miss exercise names, and moves
   numbers to the nearest amount the coach has a recording for. What it can't fix is reported as a
   problem the person can hand back to their AI.
*/

// The amounts a plan can ask for; the coach has a recording for each (see allPhrases in speech.js)
const DOSE = {
  sets: { min: 1, max: 5 },
  reps: { min: 5, max: 20, ranges: ["6–8", "8–10", "10–12", "12–15", "15–20"] },
  hold: { min: 15, max: 120, step: 5 },
  metres: [20, 30, 40, 50, 60],
  minutes: { min: 10, max: 180, step: 5 },
};
const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];            // index = Date.getDay()
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// The example plan: the owner's own week. The link can't carry the extra text, so it's added here.
const EXAMPLE_PLAN = {
  link: "v1/t:Joint-Friendly-Strength-and-Flexibility"
    + "/mon:Upper-Body-A:inclinepress.3x8-10,sarow.3x10-12,floorpress.3x10-12,csrow.3x12-15,facepull.3x15-20"
    + "/tue:Lower-Body-A:rdl.3x8-10,boxsquat.3x10-12,slbridge.3x12,calfraise.3x15,planktaps.3x45s"
    + "/wed:Active-Recovery:couch.2x120s,doorway.2x120s,tibraise.2x20"
    + "/thu:Football-Match:sport"
    + "/fri:Upper-Body-B:seatedohp.3x10-12,pullover.3x12,hammercurl.3x12,triceps.3x12-15,ytw.2x10"
    + "/sat:Lower-Body-B:dbrevlunge.3x10,sumodl.3x10-12,stepup.3x10,suitcase.3x40"
    + "/sun:Rest-and-Recovery:pigeon.1x120s,couch.1x120s,crossbody.1x30s,tricepsstretch.1x30s,hamstring.1x60s",
  title: "Joint-Friendly Strength & Flexibility",
  subtitle: "4-day upper/lower split · Dumbbells & bench · Football-optimized",
  goals: {
    mon: "Chest/back strength + shoulder stability",
    tue: "Posterior chain & knee-friendly quads",
    wed: "Thoracic spine & hip mobility",
    thu: "High-intensity cardio & agility",
    fri: "Hypertrophy & rotator cuff care",
    sat: "Single-leg balance, hips & knee prehab",
    sun: "Full-body static stretching",
  },
};

// How much of an exercise a step does: the plan's numbers over the library's defaults.
// Warm-ups are one round; cool-down stretches are one round with short rests.
function dose(key, item = {}, section = "main") {
  const ex = EX[key];
  const d = { sets: item.sets ?? ex.sets ?? 1, reps: item.reps ?? ex.reps, time: item.time ?? ex.time,
    unit: ex.unit, perSide: !!ex.perSide, measure: ex.measure, rest: ex.rest };
  if (section === "warm") d.sets = 1;
  if (section === "cool") Object.assign(d, { sets: item.sets ?? 1, rest: 10 });
  return d;
}

// Every amount a plan may give this exercise (the coach needs a recording for each)
function doseOptions(key) {
  const ex = EX[key], out = [dose(key)];
  if (WARMUP.includes(key)) return out;
  const each = (values, field) => values.forEach((v) => out.push({ ...dose(key), [field]: v }));
  if (ex.time) each(range(DOSE.hold.min, DOSE.hold.max, DOSE.hold.step), "time");
  else if (ex.measure === "m") each(DOSE.metres.map(String), "reps");
  else each([...range(DOSE.reps.min, DOSE.reps.max, 1).map(String), ...DOSE.reps.ranges], "reps");
  return out;
}
function range(a, b, step) { const out = []; for (let v = a; v <= b; v += step) out.push(v); return out; }

/* ---------- reading a link */
const dashed = (s) => s.replace(/[\s_]+/g, "-");
const words = (s) => s.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
const nearest = (v, values) => values.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
const clamp = (v, { min, max }) => Math.min(max, Math.max(min, v));

function editDistance(a, b) {
  const row = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length];
}
// An exercise or activity id, allowing for small typos ("box-squat", "boxsqaut")
function findId(raw, table) {
  const id = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (table[id]) return id;
  if (id.length < 5) return null;
  let best = null, bestD = 3;
  for (const k of Object.keys(table)) { const d = editDistance(id, k.toLowerCase()); if (d < bestD) { best = k; bestD = d; } }
  return best;
}

// Reps as the coach says them: a single count, or the nearest standard range
function repsFrom(lo, hi) {
  if (hi == null || hi === lo) return String(clamp(lo, DOSE.reps));
  const mid = (lo + hi) / 2, mids = DOSE.reps.ranges.map((r) => r.split("–").map(Number)).map(([a, b]) => (a + b) / 2);
  return DOSE.reps.ranges[mids.indexOf(nearest(mid, mids))];
}

function parseItem(raw, fixes) {
  const m = raw.match(/^([a-z0-9_-]+?)(?:\.(\d+)(?:x(\d+)(?:-(\d+))?(s|sec|m)?|(m|min|mins))?)?$/i);
  if (!m) return { problem: `"${raw}" isn't written as exercise.SETSxREPS` };
  const [, rawId, a, b, c, unitAB, unitA] = m;
  const act = findId(rawId, ACTIVITIES);
  if (act && !EX[rawId.toLowerCase()]) {
    if (b) return { problem: `"${raw}": an activity takes minutes, like ${act}.30m` };
    const mins = a ? nearest(clamp(+a, DOSE.minutes), range(DOSE.minutes.min, DOSE.minutes.max, DOSE.minutes.step)) : null;
    return { activity: { key: act, mins } };
  }
  const key = findId(rawId, EX);
  if (!key) return { problem: `"${rawId}" isn't an exercise the app has` };
  if (key !== rawId.toLowerCase()) fixes.push(`read "${rawId}" as ${key}`);
  if (a && !b) return { problem: `"${raw}": give sets and reps, like ${key}.3x10` };
  const ex = EX[key], item = { key };
  if (!a) return { item };
  item.sets = clamp(+a, DOSE.sets);
  const n = +b;
  if (ex.time) item.time = clamp(Math.round(n / DOSE.hold.step) * DOSE.hold.step, DOSE.hold);
  else if (ex.measure === "m") item.reps = String(nearest(n, DOSE.metres));
  else if (unitAB && /^s/i.test(unitAB)) { item.reps = ex.reps; fixes.push(`${key} is done in reps, not seconds`); }
  else item.reps = repsFrom(n, c == null ? null : +c);
  return { item };
}

function parseDay(part, fixes) {
  const [rawDay, ...rest] = part.split(":");
  const d = WEEKDAYS.indexOf(rawDay.slice(0, 3).toLowerCase());
  if (d < 0 || !/^[a-z]+$/i.test(rawDay)) return { problem: `"${rawDay}" isn't a day of the week (mon, tue, wed…)` };
  const list = rest.length > 1 ? rest.slice(1).join(":") : rest[0] || "";
  const name = rest.length > 1 ? words(rest[0]).slice(0, 40) : "";
  const items = [], problems = [];
  let activity = null;
  // spaces arrive as "-": keep hyphens only inside a rep range ("10-12")
  for (const raw of list.split(",").map((s) => s.replace(/(?<!\d)-|-(?!\d)/g, "")).filter(Boolean)) {
    const r = parseItem(raw, fixes);
    if (r.problem) problems.push(`${DAY_NAMES[d]}: ${r.problem}`);
    else if (r.activity) activity = r.activity;
    else items.push(r.item);
  }
  if (activity && items.length) problems.push(`${DAY_NAMES[d]}: an activity day can't also have exercises`);
  if (!activity && !items.length && !problems.length) problems.push(`${DAY_NAMES[d]}: has no exercises`);
  const kind = activity ? "activity" : items.every((i) => EX[i.key].kind === "stretch") ? "stretch" : "workout";
  const fallback = activity ? ACTIVITIES[activity.key].name : kind === "stretch" ? "Stretching" : "Workout";
  return { day: { d, key: WEEKDAYS[d], name: name || fallback, kind, items, activity }, problems };
}

// Link text → { plan, problems, fixes }. `plan` is null when nothing usable was found.
function parsePlan(text) {
  let s = String(text || "").trim().replace(/^.*?#/, "");
  try { s = decodeURIComponent(s); } catch {}
  s = s.replace(/–/g, "-").trim().replace(/\s+/g, "-");
  const parts = s.split("/").filter(Boolean), problems = [], fixes = [];
  if (/^v\d+$/i.test(parts[0] || "")) { if (parts[0].toLowerCase() !== "v1") problems.push(`this link needs a newer version of the app (${parts[0]})`); parts.shift(); }
  let title = "";
  const days = [];
  for (const part of parts) {
    if (/^t:/i.test(part)) { title = words(part.slice(2)).slice(0, 60); continue; }
    const r = parseDay(part, fixes);
    if (r.problem) { problems.push(r.problem); continue; }
    problems.push(...r.problems);
    if (days.some((x) => x.d === r.day.d)) { problems.push(`${DAY_NAMES[r.day.d]} appears twice`); continue; }
    if (r.day.items.length || r.day.activity) days.push(r.day);
  }
  days.sort((a, b) => ((a.d + 6) % 7) - ((b.d + 6) % 7));    // Monday first
  if (!days.length && !problems.length) problems.push("the link has no days in it");
  const plan = days.length ? { title: title || "My plan", days } : null;
  if (plan) plan.link = planLink(plan);
  return { plan, problems, fixes };
}

// A plan → its link text (without the site address), in the tidy form
function planLink(plan) {
  const item = (i) => i.key + (i.sets == null ? "" : `.${i.sets}x${i.time ? i.time + "s" : String(i.reps).replace("–", "-")}`);
  const day = (x) => `${x.key}:${dashed(x.name)}:` + (x.activity ? x.activity.key + (x.activity.mins ? `.${x.activity.mins}m` : "") : x.items.map(item).join(","));
  return ["v1", `t:${dashed(plan.title)}`, ...plan.days.map(day)].join("/");
}

// The example plan, with its extra text
function examplePlan() {
  const { plan } = parsePlan(EXAMPLE_PLAN.link);
  const { title, subtitle, goals } = EXAMPLE_PLAN;
  Object.assign(plan, { title, subtitle, example: true, link: EXAMPLE_PLAN.link });
  plan.days.forEach((d) => { d.goal = goals[d.key]; });
  return plan;
}
