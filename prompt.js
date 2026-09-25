/* "Create your own plan": the message that turns any AI chat into a coach that interviews the
   person and writes their plan as a link (plan.js). It is built from the library, so it always
   lists exactly the exercises the app has. */

// Plan links point back at the copy of the app that made the message (live site, staging or a
// local server); outside a browser (the tools), at the live site
const SITE = typeof location !== "undefined" && /^https?:/.test(location.protocol)
  ? location.origin + location.pathname.replace(/[^/]*$/, "")
  : "https://ashwinr93.github.io/workout/";

// The AIs the app opens directly (checked in a real browser, Sep 2026). ChatGPT and Claude take the
// message in their address; Gemini and DeepSeek can't (no such parameter, and DeepSeek's sign-in
// drops it), so the app copies the message and opens them for the person to paste. Any other AI:
// "Copy the message". `note` is what the button promises.
const AI_CHATS = [
  { name: "ChatGPT", url: "https://chatgpt.com/?q=", plus: true, note: "Opens with your message ready" },
  { name: "Claude", url: "https://claude.ai/new?q=", note: "Opens with your message ready (sign in to Claude first)" },
  { name: "Gemini", url: "https://gemini.google.com/app", paste: true, note: "Copies your message: paste it in and send" },
  { name: "DeepSeek", url: "https://chat.deepseek.com/", paste: true, note: "Copies your message: paste it in and send" },
];
// The message in an address, as short as the address rules allow: punctuation that's valid in a
// query stays as it is, and a space is "+" where the chat was seen to read it that way (`plus`);
// line breaks and the characters that end a query (# & = +) are escaped. (Long addresses fail on
// some chats' servers, so the message is kept compact: about 11,000 characters for ChatGPT.)
const inQuery = (text, plus) => {
  const q = encodeURIComponent(text).replace(/%(2C|3A|2F|3B|40|3F|21|24|27)/g, (m) => decodeURIComponent(m));
  return plus ? q.replace(/%20/g, "+") : q;
};
const chatLink = (ai, text) => (ai.paste ? ai.url : ai.url + inQuery(text, ai.plus));

function coachPrompt(current) {
  const joints = (list) => list.map((j) => JOINTS[j]).join(", ");
  // one line per exercise: "bwsquat: Bodyweight Squat | squat, beginner | quads, glutes | loads knees | no kit | harder: gobletsquat"
  const line = (k) => {
    const ex = EX[k], how = ex.time ? " (hold)" : ex.measure === "m" ? " (carry, metres)" : ex.perSide || /each side/.test(ex.unit) ? " (each side)" : "";
    // a demo variant can be easier or harder than the main one (goblet vs sumo): give the range
    const levels = [...new Set(ex.videos.map((_, vi) => variant(k, vi).level))].sort();
    // joints every version loads, then what a particular version adds ("pigeon version also loads knees")
    const vs = ex.videos.map((_, vi) => variant(k, vi)), common = vs[0].loads.filter((j) => vs.every((v) => v.loads.includes(j)));
    const extra = vs.map((v) => [v.name, v.loads.filter((j) => !common.includes(j))]).filter(([, l]) => l.length)
      .map(([n, l]) => `${n.toLowerCase()} version ${common.length ? "also " : ""}loads ${joints(l)}`);
    const joint = [ex.easyOn.length ? `easy on ${joints(ex.easyOn)}` : "", common.length ? `loads ${joints(common)}` : "", ...extra].filter(Boolean).join("; ");
    const alt = [ex.easier ? `easier: ${ex.easier.join(", ")}` : "", ex.harder ? `harder: ${ex.harder.join(", ")}` : ""].filter(Boolean).join("; ");
    return [`${k}: ${ex.name}${how}`, `${TYPES[ex.type]}, ${levels.join(" to ")}`, muscleList(ex.muscles.main).toLowerCase(),
      joint || "-", ex.equip === "none" ? "no kit" : ex.equip, ...(alt ? [alt] : [])].join(" | ");
  };
  const keys = Object.keys(EX).filter((k) => !WARMUP.includes(k));
  const strength = keys.filter((k) => EX[k].type !== "stretch"), stretches = keys.filter((k) => EX[k].type === "stretch");
  const acts = Object.keys(ACTIVITIES).join(", ");
  const R = DOSE.reps, H = DOSE.hold;
  const example = `${SITE}#v1/t:Home-Strength/mon:Full-Body-A:boxsquat.3x10-12,sarow.3x10,slbridge.2x10,planktaps.3x30s`
    + `/wed:Brisk-Walk:walk.30m/fri:Full-Body-B:rdl.3x8-10,floorpress.3x10,stepup.2x8,suitcase.3x40/sun:Stretch:couch.1x60s,pigeon.1x60s`;

  return `You're a friendly, encouraging strength coach. Help me build a weekly plan for a free app that plays each exercise with a demo video, a coach voice and timers. I may be a beginner and a bit shy about exercise, so keep it simple and kind.

1. INTERVIEW ME
Chat like a coach, not a form: one short question at a time, in everyday words. Before each question, respond to my last answer so I know you understood (not just "Got it"). If an answer is short or vague, ask what I mean and offer examples to pick from (for "posture": rounded shoulders, head poking forward, a stiff back after sitting).
Find out, one thing per question, in about 8 questions:
- what I want from it, in my own words
- anything that aches or was injured, and when I notice it
- where I'll train: home, gym, outdoors or a mix. Gym: assume a normal gym and only ask what I can't or won't use. Home: ask what I have ("nothing" is fine).
- days a week, and minutes per session
- how much I've trained before
- any sport or cardio I already do (these become activity days)
If I mention chest pain, dizziness or fainting, recent surgery, a new injury, or severe or constant pain, kindly tell me to see a doctor or physio first and don't build a plan.
When you have what you need, show the plan in that same reply.

2. BUILD THE PLAN
Use only these exercises, by id. Never invent one; if something I need isn't covered, say so.
id: name (reps unless marked) | movement, level | main muscles | joints | kit | easier/harder

Strength
${strength.map(line).join("\n")}

Stretches (holds; good on recovery days)
${stretches.map(line).join("\n")}

Activities (a whole day, no exercises): ${acts}.

The app adds a warm-up and cool-down stretches to every session; don't include them.
- At least 2 strength days a week, plus 150-300 minutes of brisk activity (walks count). For weight loss, aim high and keep the strength days.
- 3-6 exercises a day, fitting my session length (about 5 minutes per strength exercise, 2 per stretch).
- Balance the week: squat or lunge, hinge, push, pull and core, with at least as many pulls as pushes (more if my shoulders bother me).
- For anything that hurts, avoid exercises that load that joint and prefer ones easy on it. Say why you chose them.
- Beginners: beginner exercises, fewer sets, and the easier alternative where there is one.
- Gym machines only if I train in a gym; barbells only if I already lift with one.
- Sets ${DOSE.sets.min}-${DOSE.sets.max}. Reps ${R.min}-${R.max}, or a range: ${R.ranges.map((r) => r.replace("–", "-")).join(", ")} (per side for "each side"). Holds ${H.min}-${H.max} seconds in steps of ${H.step}. Carries ${DOSE.metres.join(", ")} metres. Activities: minutes in steps of 5.
- Only the days I said I can train.

3. MY LINK
Show a short summary: the days, each exercise by its name (never the id), sets and reps, and one line on why. Ask if I want changes. When I'm happy, reply with one line of encouragement, then the link on its own line as a Markdown link whose text is the whole address, like [https://…](https://…), not in a code block.
Format: ${SITE}#v1/t:TITLE/DAY:NAME:ITEMS/DAY:NAME:ITEMS
- TITLE and NAME: short, words joined with hyphens. DAY: mon, tue, wed, thu, fri, sat or sun.
- ITEMS, comma-separated: id.SETSxREPS (or id.SETSxLOW-HIGH), id.SETSxSECONDSs for holds, id.SETSxMETRES for carries. An activity day has one item: activity.MINUTESm
- Only letters, numbers and / : . , - (no spaces).
Example: ${example}

${current
    ? `This is my current plan: ${SITE}#${current}\nRead it, tell me briefly what's in it, and ask what I'd like to change. Then give me a new link in the same format.`
    : `If I come back later with my link and want changes, read the plan from the link, ask what I'd like to change, and give me a new link.\n\nLet's start: ask me your first question.`}`;
}
