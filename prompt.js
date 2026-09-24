/* "Create your own plan": the message that turns any AI chat into a coach that interviews the
   person and writes their plan as a link (plan.js). It is built from the library, so it always
   lists exactly the exercises the app has. */

// Plan links point back at the copy of the app that made the message (live site, staging or a
// local server); outside a browser (the tools), at the live site
const SITE = typeof location !== "undefined" && /^https?:/.test(location.protocol)
  ? location.origin + location.pathname.replace(/[^/]*$/, "")
  : "https://ashwinr93.github.io/workout/";

// Chats that accept a message in the address (checked by hand, Sep 2026). Gemini doesn't:
// the app copies the message and opens Gemini for the person to paste.
const AI_CHATS = [
  { name: "ChatGPT", url: "https://chatgpt.com/?q=" },
  { name: "Claude", url: "https://claude.ai/new?q=" },
  { name: "Gemini", url: "https://gemini.google.com/app", paste: true },
  { name: "Microsoft Copilot", url: "https://copilot.microsoft.com/?q=" },
  { name: "Perplexity", url: "https://www.perplexity.ai/search?q=" },
  { name: "Grok", url: "https://grok.com/?q=" },
  { name: "Le Chat", url: "https://chat.mistral.ai/chat?q=" },
];
const chatLink = (ai, text) => (ai.paste ? ai.url : ai.url + encodeURIComponent(text));

function coachPrompt(current) {
  const joints = (list) => list.map((j) => JOINTS[j]).join(", ");
  const line = (k) => {
    const ex = EX[k], how = ex.time ? "hold, seconds" : ex.measure === "m" ? "carry, metres" : ex.perSide || /each side/.test(ex.unit) ? "reps each side" : "reps";
    // a demo variant can be easier or harder than the main one (goblet vs sumo): give the range
    const levels = [...new Set(ex.videos.map((_, vi) => variant(k, vi).level))].sort();
    // joints every version loads, then what a particular version adds ("pigeon version also loads knees")
    const vs = ex.videos.map((_, vi) => variant(k, vi)), common = vs[0].loads.filter((j) => vs.every((v) => v.loads.includes(j)));
    const extra = vs.map((v) => [v.name, v.loads.filter((j) => !common.includes(j))]).filter(([, l]) => l.length)
      .map(([n, l]) => `${n.toLowerCase()} version ${common.length ? "also " : ""}loads ${joints(l)}`);
    return [`${k} - ${ex.name} (${how})`, `${TYPES[ex.type]}, ${levels.join(" to ")}`,
      `works ${muscleList(ex.muscles.main).toLowerCase()}`,
      ex.easyOn.length ? `easy on ${joints(ex.easyOn)}` : "", common.length ? `loads ${joints(common)}` : "", ...extra,
      `needs ${ex.equip}`,
      ex.easier ? `easier: ${ex.easier.join(", ")}` : "", ex.harder ? `harder: ${ex.harder.join(", ")}` : ""].filter(Boolean).join(" - ");
  };
  const keys = Object.keys(EX).filter((k) => !WARMUP.includes(k));
  const strength = keys.filter((k) => EX[k].type !== "stretch"), stretches = keys.filter((k) => EX[k].type === "stretch");
  const acts = Object.entries(ACTIVITIES).map(([k, a]) => `${k} (${a.name.toLowerCase()})`).join(", ");
  const R = DOSE.reps, H = DOSE.hold;
  const example = `${SITE}#v1/t:Home-Strength/mon:Full-Body-A:boxsquat.3x10-12,sarow.3x10,slbridge.2x10,planktaps.3x30s`
    + `/wed:Brisk-Walk:walk.30m/fri:Full-Body-B:rdl.3x8-10,floorpress.3x10,stepup.2x8,suitcase.3x40/sun:Stretch:couch.1x60s,pigeon.1x60s`;

  return `You are a friendly, encouraging strength coach. Help me build a weekly workout for a free app that plays each exercise with a demo video, a coach voice and timers. I may be a complete beginner and a bit shy about exercise, so keep things simple and kind.

STEP 1 - INTERVIEW ME
Talk like a coach chatting with me, not a form. Ask one short question at a time in everyday words, and wait for my answer. Before each new question, respond to what I just said in a way that shows you understood it (no bare "Got it."). If I give a short or vague answer, ask what I mean before moving on, and offer a few examples I can pick from, since I may not know the right words.
For example, if I say "posture", ask what bothers me about it: shoulders rounding forward, head poking forward, a stiff or achy back after sitting, or how I look in photos. Then connect it to the next question.
Things to find out:
- what I want to get out of it, in my own words
- anything that aches or has been injured, and when I notice it (link this to my goal where it fits)
- where I'll train: at home, in a gym, outdoors, or a mix. If it's a gym, assume a normal gym and only ask if there's anything I can't or don't want to use; don't make me list equipment. If it's at home, ask what I have, and "nothing" is a fine answer.
- how many days a week, and how many minutes a session
- how much I've trained before
- any sport or cardio I already do (these become activity days)
Only ask about one thing per question. Stop after about 8 questions.
If I mention chest pain, dizziness or fainting, recent surgery, a new injury, or pain that is severe or constant, kindly tell me to see a doctor or physiotherapist first, and don't build a plan.

STEP 2 - BUILD THE PLAN
Use ONLY exercises from this list, by their id. Never invent one, even if it would suit me better. If the list can't cover something I need, tell me.
Format: id - name (how it's counted) - movement, level - main muscles - joints it is easy on / puts load on - equipment - easier / harder alternatives

Strength
${strength.map(line).join("\n")}

Stretches (holds; good on recovery days)
${stretches.map(line).join("\n")}

Activities, for cardio and sport days (no exercises that day): ${acts}.

The app adds a 5-minute warm-up before and a short cool-down stretch after every session automatically, so don't include them.

Guidelines
- Aim for at least 2 strength days a week, plus cardio: 150 to 300 minutes a week of brisk activity (walks count). If I want to lose weight, lean toward the higher end and keep the strength days, as they hold on to muscle.
- 3 to 6 exercises on a strength day; fit my session length (about 5 minutes per strength exercise, 2 per stretch).
- Balance the week's movements: cover squat or lunge, hinge, push, pull and core across the week, and at least as many pulls as pushes (more pulls if my shoulders bother me).
- For anything I said hurts, avoid exercises that load that joint and prefer ones that are easy on it. Tell me why you chose what you did.
- Beginners: beginner-level exercises, fewer sets, and the easier alternative where there is one.
- Gym machines only if I train in a gym. Barbell exercises only if I tell you I already lift with a barbell; otherwise use their easier alternatives.
- Sets ${DOSE.sets.min}-${DOSE.sets.max}. Reps: a number from ${R.min} to ${R.max}, or one of these ranges: ${R.ranges.map((r) => r.replace("–", "-")).join(", ")}. For "each side" exercises, reps are per side. Holds: ${H.min} to ${H.max} seconds, in steps of ${H.step}. Carries: ${DOSE.metres.join(", ")} metres. Activities: minutes, in steps of 5.
- Only plan the days I said I can train; leave the other days out.

STEP 3 - GIVE ME MY LINK
Show a short summary of the plan (days, exercises, sets and reps, one line on why). Ask if I want any changes. When I'm happy, reply with one line of encouragement, then the link below on a line of its own, as plain text, not in a code block and not hidden behind link text.

Link format:
${SITE}#v1/t:TITLE/DAY:NAME:ITEMS/DAY:NAME:ITEMS
- TITLE: a short name for my plan, words joined with hyphens
- DAY: mon, tue, wed, thu, fri, sat or sun
- NAME: a short name for that day, words joined with hyphens
- ITEMS: comma-separated exercises, each written as id.SETSxREPS (or id.SETSxLOW-HIGH for a range), id.SETSxSECONDSs for holds, id.SETSxMETRES for carries. An activity day has just one item: activity.MINUTESm
- Use only letters, numbers and the characters / : . , -  No spaces.

Example:
${example}

${current
    ? `This is my current plan: ${SITE}#${current}\nRead it, tell me briefly what's in it, and ask what I'd like to change. Then give me a new link in the same format.`
    : `If I come back later with my link and want changes, read the plan from the link, ask what I'd like to change, and give me a new link in the same format.\n\nLet's start: ask me your first question.`}`;
}
