/* Everything the coach says. Every phrase is pre-recorded as audio/<clipId>.m4a by
   tools/make_audio.py, which reads allPhrases() from this file. */

const SPOKEN_NAMES = {
  catcow: "Cat cow, into child's pose", armcircles: "Arm circles", threadneedle: "Thread the needle",
  hip9090: "Ninety ninety hip swivels", revlungetwist: "Reverse lunge with a twist",
  inclinepress: "Neutral grip incline press", sarow: "Single arm dumbbell row",
  floorpress: "Dumbbell floor press", csrow: "Chest supported incline row",
  facepull: "Face pulls, or band pull aparts", rdl: "Romanian deadlift",
  boxsquat: "Box squat to the bench", slbridge: "Single leg glute bridge",
  calfraise: "Standing calf raises", planktaps: "Plank with shoulder taps",
  couch: "Couch stretch", doorway: "Doorway chest stretch",
  tibraise: "Tibialis raises", seatedohp: "Seated neutral grip overhead press",
  pullover: "Dumbbell pullovers", hammercurl: "Incline hammer curls",
  triceps: "Triceps extensions", ytw: "Y, T, W raises", dbrevlunge: "Dumbbell reverse lunges",
  sumodl: "Sumo deadlift", stepup: "Step ups", suitcase: "Suitcase carries",
  pigeon: "Pigeon pose, or figure four", crossbody: "Cross body shoulder stretch",
  tricepsstretch: "Overhead triceps stretch", hamstring: "Hamstring doorway stretch",
  bwsquat: "Bodyweight squat", gobletsquat: "Goblet squat", splitsquat: "Split squat",
  inclinepushup: "Incline push ups", pushup: "Push ups", bandpulldown: "Band pulldown",
  bandrow: "Band seated row", glutebridge: "Glute bridge", deadbug: "Dead bug", birddog: "Bird dog",
  sideplank: "Kneeling side plank", wallslide: "Wall slides",
};

// Written text → words that read naturally aloud
function speakable(t) {
  return t
    .replace(/\s*–\s*(?=\d)/g, " to ")
    .replace(/°/g, " degrees")
    .replace(/≤/g, "at most ")
    .replace(/(\d)\s*kg\b/g, "$1 kilograms")
    .replace(/(\d)\s*cm\b/g, "$1 centimeters")
    .replace(/(\d)\s*m\b/g, "$1 meters")
    .replace(/Figure-4/g, "Figure four")
    .replace(/[–—;]/g, ",");
}
const NUM_WORDS = ["zero", "one", "two", "three", "four", "five"];
const sentence = (t) => (/[.!?]$/.test(t.trim()) ? t.trim() : t.trim() + ".");
const durationWords = (sec) => sec % 60 ? `${sec} seconds` : sec === 60 ? "one minute" : `${NUM_WORDS[sec / 60]} minutes`;
// A dose's amount as written: "10–12 reps each side", "40 m carry, …"
const amountText = (d) => `${d.reps}${d.measure === "m" ? " m" : ""} ${d.unit}`;

const SAY = {
  name: (key, vi) => sentence(variant(key, vi).spoken),
  // d: a dose (plan.js)
  target: (d) => d.time ? sentence(`Hold for ${durationWords(d.time)}${d.perSide ? " each side" : ""}`)
                        : sentence(speakable(amountText(d))),
  key: (key, vi) => sentence(speakable(variant(key, vi).key)),
  cue: (key, i, vi) => sentence(speakable(variant(key, vi).cues[i])),
  setOf: (s, n) => `Set ${NUM_WORDS[s]} of ${NUM_WORDS[n]}.`,
  remember: () => "Remember,",               // leads into the Focus cue, said last
  lastSet: () => "Last set.",
  side: (side) => sentence(side),            // "Left side." / "Right side."
  switchSides: () => "Switch sides.",
  go: () => "Go.",
  tenLeft: () => "Ten seconds left.",
  rest: (sec) => `Rest ${durationWords(sec)}.`,
  nextUp: () => "Next up,",
  tenToGo: () => "Ten seconds. Get ready.",
  done: () => "Workout complete. Nice work.",
};

// Stable short id for a phrase: FNV-1a hash of the text
function clipId(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}

// Every phrase the app can say, for any plan
function allPhrases() {
  const out = new Set();
  for (const [key, ex] of Object.entries(EX)) {
    doseOptions(key).forEach((d) => out.add(SAY.target(d)));
    ex.videos.forEach((_, vi) => {
      out.add(SAY.name(key, vi)); out.add(SAY.key(key, vi));
      variant(key, vi).cues.forEach((_, i) => out.add(SAY.cue(key, i, vi)));
    });
    if (ex.rest) out.add(SAY.rest(ex.rest));
  }
  out.add(SAY.rest(dose(COOLDOWN[0], {}, "cool").rest));
  for (let n = 1; n <= DOSE.sets.max; n++) for (let s = 1; s <= n; s++) out.add(SAY.setOf(s, n));
  [SAY.side("Left side"), SAY.side("Right side"), SAY.remember(), SAY.lastSet(), SAY.switchSides(), SAY.go(), SAY.tenLeft(),
   SAY.nextUp(), SAY.tenToGo(), SAY.done()].forEach((t) => out.add(t));
  return [...out];
}
