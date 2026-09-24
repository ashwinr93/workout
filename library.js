/* The exercise library: every exercise a plan can use, with its demos and coaching text.
   Plans (plan.js) pick exercises from here by key and set the sets/reps/holds.

   Exercise fields
     name, sets?, reps + unit (rep-based) or time (seconds, a hold), perSide?, rest (seconds)
            sets/reps/time are the defaults when a plan doesn't give them; rest is used as given
     measure? "m" when reps is a distance in metres (carries)
     equip  what it needs, in a few words
     gear   what kind of kit it takes (GEAR): the Exercises filter; a list when either works
     muscles { main: [...], help: [...] }, names from MUSCLES; for stretches, what's stretched
     type   movement pattern (TYPES); "stretch" for static stretches (a day of only stretches is a stretch day)
     level  "beginner" | "intermediate"
     easyOn, loads  joints (JOINTS) it is kind to / puts real demand on; checked against published
            biomechanics and physiotherapy guidance, not guessed
     easier?, harder?  keys of gentler / tougher exercises for the same job (kept symmetric)
   The AI prompt lists all of these, so a plan can be balanced and steer around sore joints.
     key    the one form cue that matters most (shown prominently, spoken first)
     cues   step-by-step form cues, in the order the demo shows them
     stop   when to back off (joint safety)
     videos main demo first, then alternates:
            { id: YouTube id, label?, start?/end? (seconds, trims intros/outros),
              voice?: true if someone talks in it (otherwise the coach speaks even in Video mode),
              name?/key?/cues?/stop?/muscles?/level?/easyOn?/loads?: set when the demo is a different
                variant of the exercise
                (e.g. figure-4 vs pigeon); the screen and the coach then follow that demo }
   Every demo is ad-free and checked by tests/e2e/ad-scan.mjs.
*/
const EX = {

  // ---------- Warm-up ----------
  catcow: {
    name: "Cat-Cow → Child's Pose", reps: "8", unit: "slow reps",
    equip: "none", gear: ["bodyweight"],
    muscles: { main: ["lowerback", "upperback"], help: ["abs", "lats"] },
    type: "mobility", level: "beginner", easyOn: ["lowerback", "shoulders"], loads: ["wrists", "knees"],
    key: "Move slowly, with your breath",
    why: "Loosens the spine and shoulders without putting load on the joints.",
    cues: [
      "Start on all fours, hands under shoulders and knees under hips",
      "Breathe in, let your belly drop, and lift your chest and tailbone",
      "Breathe out, round your back up, and tuck your chin",
      "Sit your hips back toward your heels with arms long, then come back up"
    ],
    stop: "Stop if you feel sharp back pain. If sitting back hurts your knees, put a cushion behind them.",
    videos: [
      { id: "Kegpy6v-NfA" },
      { id: "vuyUwtHl694", label: "Alternate", start: 14, end: 72, voice: true }
    ]
  },
  armcircles: {
    name: "Arm Circles", reps: "10", unit: "each direction",
    equip: "none", gear: ["bodyweight"],
    muscles: { main: ["delts", "reardelts"], help: ["traps", "upperback"] },
    type: "mobility", level: "beginner", easyOn: ["shoulders"], loads: [],
    key: "Palms down; start small, finish big",
    why: "Warms up the shoulders without any load.",
    cues: [
      "Stand tall with your arms straight out at shoulder height, palms down",
      "After 10, reverse direction",
      "Keep your shoulders down, away from your ears"
    ],
    stop: "If you feel a pinch at the top or front of the shoulder, make the circles smaller.",
    videos: [
      { id: "ndmSvkEdNQQ", voice: true },
      { id: "UVMEnIaY8aU", label: "Alternate", start: 8, end: 21, voice: true }
    ]
  },
  threadneedle: {
    name: "Thread the Needle", reps: "10", unit: "each side",
    equip: "none", gear: ["bodyweight"],
    muscles: { main: ["upperback"], help: ["reardelts", "lats", "obliques"] },
    type: "mobility", level: "beginner", easyOn: ["shoulders", "lowerback"], loads: ["wrists", "knees"],
    key: "Twist from the upper back; keep your hips still",
    why: "Rotates the upper back and makes room at the top of the shoulder.",
    cues: [
      "Start on all fours, hands under shoulders and knees under hips",
      "Reach one arm under your body as far as it goes, shoulder toward the floor",
      "Then rotate open and reach that arm to the ceiling, eyes following your hand",
      "Breathe out as you rotate. Do all reps on one side, then switch"
    ],
    stop: "If your lower back twists or your shoulder pinches, make the movement smaller.",
    videos: [
      { id: "YuAJ1i76Hek", start: 5, voice: true }
    ]
  },
  hip9090: {
    name: "90/90 Hip Swivels", reps: "8", unit: "each side",
    equip: "none", gear: ["bodyweight"],
    muscles: { main: ["glutes", "adductors"], help: ["obliques"] },
    type: "mobility", level: "beginner", easyOn: ["lowerback"], loads: ["hips", "knees"],
    key: "Your knees move; your feet stay planted",
    why: "Rotates the hips in both directions without twisting the knee.",
    cues: [
      "Sit with both legs bent to 90°: front leg and back leg",
      "Sit tall; put your hands behind you only if you need support",
      "Lift the back knee first and rotate both knees to the other side",
      "Finish with both legs at 90° again. That's 1 rep"
    ],
    stop: "If the inside or outside of your knee hurts, set your feet wider and don't go as far.",
    videos: [
      { id: "YxECcOkUCEY", end: 38, voice: true },
      { id: "F1XdXdCjERk", label: "Alternate", start: 4, end: 16 }
    ]
  },
  revlungetwist: {
    name: "Reverse Lunge + Twist", reps: "6", unit: "each side",
    equip: "none", gear: ["bodyweight"],
    muscles: { main: ["quads", "glutes"], help: ["obliques", "hams", "adductors"] },
    type: "lunge", level: "beginner", easyOn: ["knees"], loads: [],
    key: "Step back, and keep the front shin vertical",
    why: "Stepping backward keeps the front shin vertical, which protects the front knee.",
    cues: [
      "If you like, hold a light plate or ball in front of you",
      "Step back and lower until both knees are near 90°",
      "At the bottom, rotate your chest toward the front leg, then turn back and step forward"
    ],
    stop: "If your front knee hurts, take a shorter step and don't go as low.",
    videos: [
      { id: "LrIE5onzj68", start: 9, end: 45, voice: true },
      { id: "UuBs5AqO3JY", label: "Alternate" }
    ]
  },

  // ---------- Upper body ----------
  inclinepress: {
    name: "Neutral-Grip Incline Press", sets: 3, reps: "8–10", unit: "reps", rest: 90,
    muscles: { main: ["chest", "delts"], help: ["triceps"] },
    type: "push", level: "beginner", easyOn: ["shoulders"], loads: ["elbows"], easier: ["floorpress"],
    equip: "dumbbells, adjustable bench", gear: ["bodyweight"], gear: ["bodyweight"], gear: ["bodyweight"], gear: ["bodyweight"], gear: ["bodyweight"], gear: ["dumbbells"],
    key: "Bench at 30°–45°, palms facing each other",
    why: "Avoids pinching the shoulder. Keep your elbows at 45°.",
    cues: [
      "Set the bench to a low incline, 30–45°",
      "Start with the dumbbells on your knees, then lie back and kick them up",
      "Pull your shoulder blades together. A slight natural arch is fine",
      "Lower to chest level with elbows about 45° from your body",
      "Press up in a slight arc so the dumbbells finish over your shoulders"
    ],
    stop: "If you feel a pinch at the front of the shoulder, don't lower as far, or use a lighter weight.",
    videos: [
      { id: "2SU_K4-knrc", start: 4, voice: true },
      { id: "g4tj2lnUgpM", label: "Alternate", end: 11 }
    ]
  },
  sarow: {
    name: "Single-Arm Row", sets: 3, reps: "10–12", unit: "reps each side", rest: 60,
    muscles: { main: ["lats", "upperback"], help: ["biceps", "reardelts", "forearms"] },
    type: "pull", level: "beginner", easyOn: ["lowerback", "shoulders"], loads: [],
    equip: "dumbbell, bench", gear: ["dumbbells"],
    key: "Pull toward your hip, not your chest",
    why: "Keep your back flat and pause for 1 second at the top.",
    cues: [
      "One hand and one knee on the bench, back flat like a table",
      "Let the dumbbell hang, then drive your elbow straight back",
      "Pause for 1 second at the top",
      "Lower slowly without twisting. Do all reps on one side, then switch"
    ],
    stop: "If your lower back strains, brace your core harder or use a lighter weight.",
    videos: [
      { id: "ZRSGpBUVcNw" },
      { id: "DMo3HJoawrU", label: "Alternate" }
    ]
  },
  floorpress: {
    name: "Floor Press", sets: 3, reps: "10–12", unit: "reps", rest: 90,
    muscles: { main: ["chest", "triceps"], help: ["delts"] },
    type: "push", level: "beginner", easyOn: ["shoulders"], loads: [], harder: ["inclinepress"],
    equip: "dumbbells", gear: ["dumbbells"],
    key: "Palms in; the floor limits the range",
    why: "Protects the front of the shoulder joint.",
    cues: [
      "Lie on the floor with knees bent and feet flat",
      "Keep your elbows about 45° from your body",
      "Lower until your upper arms touch the floor. Pause, don't bounce",
      "Press straight up over your chest"
    ],
    stop: "If your elbow or shoulder hurts at the bottom, use a lighter weight and slow the lowering down.",
    videos: [
      { id: "oqnNivBhveM", end: 11, voice: true },
      { id: "IaY4EncHDHU", label: "Alternate", start: 4, end: 20, voice: true }
    ]
  },
  csrow: {
    name: "Chest-Supported Incline Row", sets: 3, reps: "12–15", unit: "reps", rest: 60,
    muscles: { main: ["upperback", "lats"], help: ["reardelts", "biceps"] },
    type: "pull", level: "beginner", easyOn: ["lowerback"], loads: [], harder: ["bbrow"],
    equip: "dumbbells, adjustable bench", gear: ["dumbbells"],
    key: "Keep your chest glued to the bench",
    why: "Resting your chest on the bench takes strain off the lower back.",
    cues: [
      "Set the bench to 30–45° and lie chest-down, arms hanging straight",
      "Let your shoulders stretch fully at the bottom",
      "Row the dumbbells toward your hips and squeeze your shoulder blades at the top",
      "Lower slowly, and don't shrug"
    ],
    stop: "If your neck tenses up, tuck your chin and keep your shoulders down.",
    videos: [
      { id: "ym-Mp8tCF00", start: 8, end: 76, voice: true }
    ]
  },
  facepull: {
    name: "Face Pulls / Band Pull-Aparts", sets: 3, reps: "15–20", unit: "reps", rest: 60,
    muscles: { main: ["reardelts", "upperback"], help: ["traps"] },
    type: "pull", level: "beginner", easyOn: ["shoulders"], loads: [],
    equip: "dumbbells or a band", gear: ["dumbbells", "bands"],
    key: "Light weight; stop at eye level",
    why: "Key for the rear shoulders and keeping the shoulder blades stable.",
    cues: [
      "Hinge forward with arms hanging, or lie chest-down on an incline bench",
      "Pull the dumbbells up and out, elbows high and wide",
      "Don't pull further back; that turns it into a back exercise",
      "Lower slowly, with control"
    ],
    stop: "If anything pinches, go lighter.",
    videos: [
      { id: "nzTY7j9ocR8", name: "Face Pulls", label: "Dumbbells", voice: true },
      { id: "stwYTTPXubo", name: "Band Pull-Aparts", label: "Band", start: 8, end: 44, voice: true,
        key: "Light band; squeeze your shoulder blades",
        cues: [
          "Hold the band at shoulder height, arms straight, hands shoulder-width apart",
          "Pull the band apart until it touches your chest",
          "Squeeze your shoulder blades together for 2 seconds",
          "Return slowly, with control"
        ] }
    ]
  },

  // ---------- Lower body and core ----------
  rdl: {
    name: "Romanian Deadlift", sets: 3, reps: "8–10", unit: "reps", rest: 90,
    muscles: { main: ["hams", "glutes"], help: ["lowerback", "forearms", "adductors"] },
    type: "hinge", level: "intermediate", easyOn: ["knees"], loads: ["lowerback"], easier: ["slbridge", "sumodl"], harder: ["deadlift"],
    equip: "dumbbells", gear: ["dumbbells"],
    key: "Hinge at the hips with soft knees",
    why: "Puts no shear on the knee and protects the kneecap tendon.",
    cues: [
      "Stand tall with your chest up, shoulders back, core tight, and pelvis tucked",
      "Push your hips back as if touching a wall behind you",
      "Lower until you feel the hamstring stretch; stop before your back rounds",
      "Drive your hips forward to stand. Let your eyes follow down so your neck stays neutral"
    ],
    stop: "If your lower back rounds or hurts, stop higher up the shin.",
    videos: [
      { id: "xAL7lHwj30E" }
    ]
  },
  boxsquat: {
    name: "Box Squat to Bench", sets: 3, reps: "10–12", unit: "reps", rest: 90,
    muscles: { main: ["quads", "glutes"], help: ["adductors", "hams", "lowerback"] },
    type: "squat", level: "beginner", easyOn: [], loads: ["knees"],
    equip: "bench or sturdy chair, dumbbells optional", gear: ["bodyweight"],
    key: "Tap the bench, don't sit down; shins stay vertical",
    why: "Keeps the knees from pushing forward. Drive through your heels.",
    cues: [
      "Rest the dumbbells on your shoulders, or hold one at your chest",
      "Push your hips back and lower toward the bench",
      "Spread the floor with your feet so your knees stay out",
      "Drive through your heels to stand"
    ],
    stop: "If your knees hurt, use a higher surface to sit to.",
    videos: [
      { id: "DqWrOnzZ5No", voice: true }
    ]
  },
  slbridge: {
    name: "Single-Leg Glute Bridge", sets: 3, reps: "12", unit: "reps each side", rest: 60,
    muscles: { main: ["glutes"], help: ["hams"] },
    type: "hinge", level: "beginner", easyOn: ["lowerback", "knees"], loads: [], harder: ["rdl"], easier: ["glutebridge"],
    equip: "none", gear: ["bodyweight"],
    key: "Squeeze for 2 seconds at the top",
    why: "Lying flat takes load off the spine and isolates the glutes.",
    cues: [
      "Lie on your back and hug one knee to your chest. This keeps your lower back from arching",
      "Put the other foot flat, close to your hips",
      "Press through that foot and lift your hips, keeping them level",
      "Lower slowly. Do all reps on one side, then switch"
    ],
    stop: "If your hamstring cramps, move your foot closer to your hips.",
    videos: [
      { id: "vdmlNaXSjd4", start: 4 },
      { id: "AVAXhy6pl7o", label: "Alternate", start: 2, voice: true }
    ]
  },
  calfraise: {
    name: "Standing Calf Raises", sets: 3, reps: "15", unit: "reps", rest: 45,
    muscles: { main: ["calves"], help: [] },
    type: "calves", level: "beginner", easyOn: ["knees"], loads: ["ankles"],
    equip: "a step", gear: ["bodyweight"],
    key: "Go slowly and hold the top for 2 seconds",
    why: "Builds ankle and Achilles stability.",
    cues: [
      "Stand with the balls of your feet on a step about 5–8 cm high, heels hanging off",
      "Breathe out and rise as high as you can",
      "Lower slowly until your heels are below the step or touch the floor"
    ],
    stop: "If your Achilles hurts, skip the step and use a smaller range.",
    videos: [
      { id: "SRUtMJ0tE2A", start: 2, end: 23, voice: true },
      { id: "ADIDoYt_ko4", label: "Alternate", end: 11 }
    ]
  },
  planktaps: {
    name: "Plank with Shoulder Taps", sets: 3, time: 45, rest: 60,
    muscles: { main: ["abs", "obliques"], help: ["delts", "glutes"] },
    type: "core", level: "intermediate", easyOn: ["lowerback"], loads: ["wrists", "shoulders"], easier: ["deadbug"],
    equip: "none", gear: ["bodyweight"],
    key: "Keep your hips square; no rocking",
    why: "Keeps the spine from twisting. Tap slowly.",
    cues: [
      "Start in a high plank, hands under shoulders, body braced in a straight line",
      "Set your feet wider for more stability",
      "Slowly tap one hand to the opposite shoulder, alternating sides"
    ],
    stop: "If your wrists or lower back hurt, drop to your knees.",
    videos: [
      { id: "0PrTUpElJ44", start: 3, end: 13 }
    ]
  },

  // ---------- Mobility ----------
  couch: {
    name: "Couch Stretch", sets: 2, time: 120, perSide: true, rest: 20,
    muscles: { main: ["quads", "hipflexors"], help: [] },
    type: "stretch", level: "beginner", easyOn: [], loads: ["knees"],
    equip: "wall or couch", gear: ["bodyweight"],
    key: "Squeeze the glute of your back leg",
    why: "Releases tight quads and hip flexors that pull on the kneecap tendon.",
    cues: [
      "Kneel with your back foot up on the couch or bench behind you and the knee on a pillow",
      "Step the other foot forward into a lunge",
      "For more stretch, reach your arms up or lean back slightly"
    ],
    stop: "If your kneecap feels pressure, add padding or move the knee farther from the wall.",
    videos: [
      { id: "fHKndvWwenc", start: 16, end: 57, voice: true },
      { id: "Fg-lwNBzVV8", label: "Alternate", start: 4, end: 50, voice: true }
    ]
  },
  doorway: {
    name: "Doorway Chest Stretch", sets: 2, time: 120, rest: 20,
    muscles: { main: ["chest"], help: ["delts", "biceps"] },
    type: "stretch", level: "beginner", easyOn: ["shoulders"], loads: [],
    equip: "doorway", gear: ["bodyweight"],
    key: "Gentle stretch; there should be no shoulder pain",
    why: "Opens the chest without straining the front of the shoulder.",
    cues: [
      "Use a doorway narrow enough to rest both forearms on the frame",
      "Keep your elbows at or just below shoulder height",
      "Put one foot in front of the other to protect your lower back",
      "Lean through gently until you feel the stretch across your chest"
    ],
    stop: "If you feel pinching or tingling down the arm, lower your elbows.",
    videos: [
      { id: "CEQMx4zFwYs", start: 4, end: 30, voice: true }
    ]
  },
  tibraise: {
    name: "Tibialis Raises", sets: 2, reps: "20", unit: "reps", rest: 30,
    muscles: { main: ["shins"], help: [] },
    type: "calves", level: "beginner", easyOn: ["knees"], loads: [],
    equip: "a wall", gear: ["bodyweight"],
    key: "Lift your toes high and lower them slowly",
    why: "Strengthens the shin muscles that slow you down, which helps protect the knees in football.",
    cues: [
      "Lean your hips and back against a wall with your legs straight",
      "Keep your knees straight and quads tight; don't hike your hips",
      "Feet farther from the wall makes it easier; closer makes it harder"
    ],
    stop: "If your shins cramp, shorten the set and shake it out.",
    videos: [
      { id: "OPEuhclsTUQ", voice: true },
      { id: "nQKgHwi8W9E", label: "Alternate", end: 21 }
    ]
  },

  // ---------- Upper body: shoulders and arms ----------
  seatedohp: {
    name: "Seated Neutral Overhead Press", sets: 3, reps: "10–12", unit: "reps", rest: 90,
    muscles: { main: ["delts"], help: ["triceps", "traps"] },
    type: "pushup", level: "intermediate", easyOn: ["lowerback"], loads: ["shoulders"], harder: ["ohp"],
    equip: "dumbbells, bench", gear: ["dumbbells"],
    key: "Press slightly forward, not out to the sides",
    why: "Palms facing in, elbows slightly forward, core braced.",
    cues: [
      "Sit upright with your back supported and kick the dumbbells up to shoulder height",
      "Palms face each other, elbows slightly in front of your body",
      "Lower back to shoulder level. Keep your ribs down and don't arch"
    ],
    stop: "If your shoulder pinches, shorten the range.",
    videos: [
      { id: "7oH0algsdww", start: 4, voice: true }
    ]
  },
  pullover: {
    name: "Pullovers", sets: 3, reps: "12", unit: "reps", rest: 60,
    muscles: { main: ["lats", "chest"], help: ["triceps", "abs"] },
    type: "pullup", level: "intermediate", easyOn: ["lowerback"], loads: ["shoulders"],
    equip: "one dumbbell", gear: ["dumbbells"],
    key: "Soft elbows; comfortable range only",
    why: "Only lower to a comfortable shoulder stretch.",
    cues: [
      "Lie on the floor with knees bent, one dumbbell held over your chest with both hands",
      "Keep a slight bend in your elbows and don't let it change",
      "Lower the weight behind your head until it lightly touches the floor",
      "Pull it back until it's over your chest, and no further"
    ],
    stop: "If your shoulder feels uncomfortable, stop earlier.",
    videos: [
      { id: "qALakTR1nRI", name: "Floor Pullovers", label: "Floor", start: 1, end: 19 },
      { id: "FK4rHfWKEac", name: "Bench Pullovers", label: "Bench", start: 7, end: 55, voice: true,
        cues: [
          "Lie on a bench with feet flat, one dumbbell held over your chest with both hands",
          "Keep a slight bend in your elbows and don't let it change",
          "Lower the weight behind your head only as far as is comfortable",
          "Pull it back until it's over your chest, and no further"
        ],
        stop: "The demo goes deeper than you need to. If your shoulder feels uncomfortable, stop earlier." }
    ]
  },
  hammercurl: {
    name: "Incline Hammer Curls", sets: 3, reps: "12", unit: "reps", rest: 60,
    muscles: { main: ["biceps", "forearms"], help: [] },
    type: "arms", level: "beginner", easyOn: ["elbows", "wrists"], loads: [],
    equip: "dumbbells, adjustable bench", gear: ["dumbbells"],
    key: "Palms facing in; keep your upper arms still",
    why: "The neutral grip protects the elbow and shoulder tendons.",
    cues: [
      "Set the bench to 45–60° and let your arms hang straight down",
      "Curl up with your thumbs pointing up",
      "Don't swing or lean back",
      "Lower slowly all the way down"
    ],
    stop: "If the front of your shoulder strains at the bottom, raise the bench.",
    videos: [
      { id: "1Z6XiaBxwHQ", end: 11 },
      { id: "cbRSu8Ws_hs", label: "Alternate", end: 48, voice: true }
    ]
  },
  triceps: {
    name: "Overhead / Floor Triceps Extension", sets: 3, reps: "12–15", unit: "reps", rest: 60,
    muscles: { main: ["triceps"], help: [] },
    type: "arms", level: "beginner", easyOn: [], loads: ["elbows"],
    equip: "one or two dumbbells", gear: ["dumbbells"],
    key: "Keep your elbows tucked in",
    why: "Stop right away if your shoulder pinches.",
    cues: [
      "Lie on your back, dumbbells over your chest, palms facing each other",
      "Angle your arms slightly back toward your head",
      "Bend only at the elbows and lower just past 90°",
      "Press back up; your upper arms stay still"
    ],
    stop: "If your shoulder pinches, stop right away.",
    videos: [
      { id: "Py4I0J6i2kY", name: "Floor Triceps Extensions", label: "Floor", voice: true },
      { id: "HADoxgsslvw", name: "Overhead Triceps Extensions", label: "Overhead", end: 8, level: "intermediate",
        loads: ["elbows", "shoulders"],
        cues: [
          "Sit tall and hold one dumbbell overhead with both hands",
          "Keep your elbows pointing forward, close to your head",
          "Lower the dumbbell behind your head by bending your elbows",
          "Straighten your arms fully; your upper arms stay still"
        ],
        stop: "If your shoulder pinches, stop right away and switch to the floor version." }
    ]
  },
  ytw: {
    name: "Y-T-W Raises", sets: 2, reps: "10", unit: "reps of each letter", rest: 60,
    muscles: { main: ["reardelts", "upperback"], help: ["traps"] },
    type: "pull", level: "beginner", easyOn: ["shoulders"], loads: [],
    equip: "none or very light dumbbells, adjustable bench", gear: ["bodyweight"],
    key: "Use 2–4 kg at most",
    why: "Rebuilds the small stabilizing muscles of the rotator cuff.",
    cues: [
      "Lie chest-down on an incline bench, arms hanging",
      "First, raise your arms up and out at 45°, thumbs up",
      "Next, raise your arms straight out to the sides, thumbs up",
      "Finally, bend your elbows at your sides and squeeze your shoulder blades back and down"
    ],
    stop: "If anything hurts, use lighter dumbbells or none at all.",
    videos: [
      { id: "OFQduBFpDrY", label: "Incline bench" },
      { id: "WAnSCSJbQYw", label: "Incline, with A" }
    ]
  },

  // ---------- Lower body: single-leg and carries ----------
  dbrevlunge: {
    name: "Reverse Lunges", sets: 3, reps: "10", unit: "reps each side", rest: 90,
    muscles: { main: ["quads", "glutes"], help: ["adductors", "hams", "calves"] },
    type: "lunge", level: "intermediate", easyOn: [], loads: ["knees"], easier: ["stepup", "splitsquat"],
    equip: "dumbbells optional", gear: ["bodyweight"],
    key: "Always step backward, never forward",
    why: "Keeps the front shin vertical so there's no twisting force on the knee.",
    cues: [
      "Stand with feet hip-width apart, dumbbells at your sides, palms facing in",
      "Brace your core and step one leg back",
      "Lower until your back knee hovers just above the floor, both knees near 90°",
      "Keep your chest upright and push through the front foot to return"
    ],
    stop: "If your front knee hurts, take a shorter step, don't go as deep, or use lighter weights.",
    videos: [
      { id: "RZKXLMxPF_I", start: 9, end: 54, voice: true }
    ]
  },
  sumodl: {
    name: "Sumo / Goblet Deadlift", sets: 3, reps: "10–12", unit: "reps", rest: 90,
    muscles: { main: ["glutes", "adductors", "hams"], help: ["quads", "lowerback", "forearms", "traps"] },
    type: "hinge", level: "intermediate", easyOn: ["knees"], loads: ["lowerback"], harder: ["rdl"],
    equip: "one dumbbell", gear: ["dumbbells"],
    key: "Wide stance; knees follow your toes",
    why: "Less compression on the knees while still loading the glutes.",
    cues: [
      "Feet wide, toes turned out 30–45°",
      "Brace your abs, then push your hips back and your knees out",
      "Keep your chest up, grab the dumbbell, and stand by driving through your whole foot",
      "Squeeze your glutes at the top"
    ],
    stop: "If your lower back rounds, shorten the range by starting the dumbbell on a block.",
    videos: [
      { id: "xK4ED_yQcoU", name: "Sumo Deadlift", label: "Sumo", voice: true },
      { id: "TC2jOPCNYhU", name: "Goblet Deadlift", label: "Goblet", end: 33, level: "beginner",
        muscles: { main: ["glutes", "hams"], help: ["quads", "lowerback", "forearms"] },
        key: "Chest up, back flat; knees follow your toes",
        cues: [
          "Stand with feet a little wider than your hips, one dumbbell on the floor between them",
          "Push your hips back and bend your knees to grab the top of the dumbbell",
          "Keep your chest up and stand by driving through your whole foot",
          "Squeeze your glutes at the top"
        ] }
    ]
  },
  stepup: {
    name: "Step-Ups", sets: 3, reps: "10", unit: "reps each side", rest: 60,
    muscles: { main: ["quads", "glutes"], help: ["hams", "calves", "adductors"] },
    type: "lunge", level: "beginner", easyOn: [], loads: ["knees"], harder: ["dbrevlunge", "splitsquat"],
    equip: "bench or sturdy step, dumbbells optional", gear: ["bodyweight"],
    key: "Use a step low enough that your knee is at 90° or less",
    why: "Push through the heel of your leading leg.",
    cues: [
      "Stand facing a step lower than the one in the demo, dumbbells at your sides",
      "Place your whole foot on the step",
      "Push through that heel to stand tall; don't push off the back foot",
      "Step down slowly. Do all reps on one side, then switch"
    ],
    stop: "If your knee hurts, use a lower step.",
    videos: [
      { id: "DxUNi119Qzs" }
    ]
  },
  suitcase: {
    name: "Suitcase Carries", sets: 3, reps: "40", measure: "m", unit: "carry, switching hands halfway", rest: 60,
    muscles: { main: ["obliques", "forearms"], help: ["traps", "abs", "lowerback", "glutes"] },
    type: "carry", level: "beginner", easyOn: ["lowerback"], loads: [],
    equip: "one heavy dumbbell, space to walk", gear: ["dumbbells"],
    key: "Walk tall without leaning",
    why: "Trains core and side-to-side hip stability.",
    cues: [
      "Pick the dumbbell up with one hand the way you'd do a deadlift",
      "Stand tall with your shoulders level and ribs down",
      "Walk slowly in a straight line",
      "Switch hands halfway"
    ],
    stop: "If you can't stay upright, use a lighter weight.",
    videos: [
      { id: "3RKKnZhhelE", voice: true },
      { id: "bAnCoDrvXc4", label: "Alternate", start: 4 }
    ]
  },

  // ---------- Stretches ----------
  pigeon: {
    name: "Pigeon Pose / Figure-4", sets: 1, time: 120, perSide: true, rest: 10,
    muscles: { main: ["glutes"], help: [] },
    type: "stretch", level: "intermediate", easyOn: ["hips"], loads: ["knees"],
    equip: "none", gear: ["bodyweight"],
    key: "Gentle stretch; no knee pain",
    why: "Stretches the glutes and the deep hip rotators.",
    cues: [
      "From all fours, bring the leg you're stretching forward and across under your body",
      "Slide the other leg straight back",
      "Sit back into the stretch, keeping your hips square",
      "Breathe slowly and relax into it"
    ],
    stop: "If your front knee hurts, switch to the figure-4 demo.",
    videos: [
      { id: "1o7awuDGzag", name: "Pigeon Pose", label: "Pigeon", start: 1, end: 20, voice: true },
      { id: "xVq2-g_leTI", name: "Figure-4 Stretch", label: "Figure-4", start: 11, voice: true, level: "beginner", loads: [],
        key: "Gentle stretch; keep your lower back down",
        cues: [
          "Lie on your back with both knees bent",
          "Cross one ankle over the other knee",
          "Pull the bottom thigh toward your chest",
          "Breathe slowly and relax into it"
        ],
        stop: "If you feel it in the knee rather than the hip, ease off." }
    ]
  },
  crossbody: {
    name: "Cross-Body Shoulder Stretch", sets: 1, time: 30, perSide: true, rest: 10,
    muscles: { main: ["reardelts"], help: ["upperback"] },
    type: "stretch", level: "beginner", easyOn: ["shoulders"], loads: [],
    equip: "none", gear: ["bodyweight"],
    key: "Keep the shoulder down, away from your ear",
    why: "Stretches the back of the shoulder capsule.",
    cues: [
      "Bring one arm straight across your chest",
      "Hold it just above the elbow with your other hand",
      "Gently pull until you feel the stretch at the back of the shoulder"
    ],
    stop: "If you feel pinching at the front of the shoulder, ease off.",
    videos: [
      { id: "aIq0fLi8iak", start: 4, voice: true }
    ]
  },
  tricepsstretch: {
    name: "Overhead Triceps Stretch", sets: 1, time: 30, perSide: true, rest: 10,
    muscles: { main: ["triceps"], help: ["lats"] },
    type: "stretch", level: "beginner", easyOn: [], loads: [],
    equip: "none", gear: ["bodyweight"],
    key: "Gentle pressure; keep your ribs down",
    why: "Stretches the triceps and the back of the shoulder.",
    cues: [
      "Reach one hand down between your shoulder blades",
      "With the other hand, gently push that elbow back",
      "Don't arch your lower back"
    ],
    stop: "If your shoulder pinches, lower the elbow or ease the pressure.",
    videos: [
      { id: "_IOHtPSYGbk", start: 4, voice: true }
    ]
  },
  hamstring: {
    name: "Hamstring Doorway Stretch", sets: 1, time: 60, perSide: true, rest: 10,
    muscles: { main: ["hams"], help: ["calves"] },
    type: "stretch", level: "beginner", easyOn: ["lowerback"], loads: [],
    equip: "doorway", gear: ["bodyweight"],
    key: "Keep your lower back flat on the floor",
    why: "Stretches the hamstrings without stressing the lower back.",
    cues: [
      "Lie on your back in a doorway",
      "Rest one leg straight up the door frame and keep the other flat through the doorway",
      "Scoot closer to the frame to make the stretch stronger",
      "Breathe slowly and let the leg relax"
    ],
    stop: "If you feel tingling down the leg, back off. That's a nerve, not the muscle.",
    videos: [
      { id: "VWk9QD10Xjg", start: 1, voice: true },
      { id: "b7k-9CZVYbA", label: "Alternate", end: 49, voice: true }
    ]
  },
  // ---------- Bodyweight and bands (batch 1) ----------
  bwsquat: {
    name: "Bodyweight Squat", sets: 3, reps: "10–12", unit: "reps", rest: 60,
    equip: "none", gear: ["bodyweight"],
    muscles: { main: ["quads", "glutes"], help: ["adductors", "hams"] },
    type: "squat", level: "beginner", easyOn: [], loads: ["knees"], harder: ["gobletsquat"],
    key: "Sit back and down; knees follow your toes",
    cues: [
      "Stand with your feet about shoulder-width apart, toes turned out slightly",
      "Reach your arms forward as you sit your hips back and down",
      "Keep your chest up and your knees in line with your toes",
      "Push through your whole foot to stand tall"
    ],
    stop: "If your knees hurt, only go as low as feels comfortable.",
    videos: [
      { id: "3fl7uYmiMVw" },
      { id: "P-yaD24bUE8", label: "Side view", start: 30, end: 39, voice: true }
    ]
  },
  gobletsquat: {
    name: "Goblet Squat", sets: 3, reps: "8–10", unit: "reps", rest: 90,
    equip: "one dumbbell", gear: ["dumbbells"],
    muscles: { main: ["quads", "glutes"], help: ["adductors", "hams", "upperback"] },
    type: "squat", level: "beginner", easyOn: [], loads: ["knees"], easier: ["bwsquat"], harder: ["bbsquat"],
    key: "Chest tall; elbows inside your knees",
    cues: [
      "Hold one dumbbell upright against your chest, elbows pointing down",
      "Set your feet a little wider than your hips, toes slightly out",
      "Sit down between your heels, keeping your chest tall",
      "Drive through your feet to stand"
    ],
    stop: "If your knees or lower back hurt, don't go as deep.",
    videos: [
      { id: "2LnkzQ7paAc", start: 2, end: 27, voice: true }
    ]
  },
  splitsquat: {
    name: "Split Squat", sets: 3, reps: "8", unit: "reps each side", rest: 60,
    equip: "none, dumbbells optional", gear: ["bodyweight"],
    muscles: { main: ["quads", "glutes"], help: ["adductors", "hams", "calves"] },
    type: "lunge", level: "beginner", easyOn: [], loads: ["knees"], easier: ["stepup"], harder: ["dbrevlunge"],
    key: "Go straight down, not forward",
    cues: [
      "Stand in a long split stance, one foot forward and the back foot on its toes",
      "Keep your hands on your hips and your chest upright",
      "Lower straight down until your back knee nearly touches the floor",
      "Push through your front foot to rise. Do all reps on one side, then switch"
    ],
    stop: "If your front knee hurts, take a longer stance and don't go as low.",
    videos: [
      { id: "qW5OGJ62ZjY", start: 4, end: 51, voice: true }
    ]
  },
  inclinepushup: {
    name: "Incline Push-Up", sets: 3, reps: "10–12", unit: "reps", rest: 60,
    equip: "a bench or sturdy table", gear: ["bodyweight"],
    muscles: { main: ["chest", "triceps"], help: ["delts", "abs"] },
    type: "push", level: "beginner", easyOn: [], loads: ["wrists"], harder: ["pushup"],
    key: "Body in one straight line from head to heels",
    cues: [
      "Put your hands on the edge of a bench, a little wider than your shoulders",
      "Walk your feet back until your body is a straight line",
      "Lower your chest to the bench with your elbows angled back, not flared out",
      "Press back up, keeping your body in one piece"
    ],
    stop: "If your wrists or shoulders hurt, use a higher surface.",
    videos: [
      { id: "E--Ls5QtFqI", end: 13 }
    ]
  },
  pushup: {
    name: "Push-Up", sets: 3, reps: "8–10", unit: "reps", rest: 90,
    equip: "none", gear: ["bodyweight"],
    muscles: { main: ["chest", "triceps"], help: ["delts", "abs"] },
    type: "push", level: "intermediate", easyOn: [], loads: ["wrists", "shoulders"], easier: ["inclinepushup"],
    key: "Keep your hips in line; don't let them sag",
    cues: [
      "Hands under your shoulders, legs straight, body in a straight line",
      "Brace your stomach and squeeze your glutes",
      "Lower your chest toward the floor, elbows angled back",
      "Push the floor away to straighten your arms"
    ],
    stop: "If your wrists hurt, hold dumbbell handles. If your shoulders hurt, put your hands on a bench.",
    videos: [
      { id: "ZR1QBUtC1GY", start: 12, end: 55, voice: true }
    ]
  },
  bandpulldown: {
    name: "Band Pulldown", sets: 3, reps: "12–15", unit: "reps", rest: 60,
    equip: "a resistance band anchored high on a door", gear: ["bands"],
    muscles: { main: ["lats"], help: ["biceps", "upperback", "reardelts"] },
    type: "pullup", level: "beginner", easyOn: [], loads: [], harder: ["latpulldown"],
    key: "Elbows down to your sides; shoulders away from your ears",
    cues: [
      "Anchor the band high on a door and kneel facing it, arms reaching up",
      "Pull your elbows down toward your ribs",
      "Squeeze your shoulder blades down and together at the bottom",
      "Let your arms rise slowly back up"
    ],
    stop: "If your shoulder pinches at the top, don't reach as high.",
    videos: [
      { id: "84D8bVJWB3s", start: 38, end: 103, voice: true }
    ]
  },
  bandrow: {
    name: "Band Seated Row", sets: 3, reps: "12–15", unit: "reps", rest: 60,
    equip: "a resistance band", gear: ["bands"],
    muscles: { main: ["upperback", "lats"], help: ["biceps", "reardelts"] },
    type: "pull", level: "beginner", easyOn: [], loads: [], harder: ["cablerow"],
    key: "Sit tall; don't lean back to pull",
    cues: [
      "Sit tall with your legs out in front and the band anchored low in front of you",
      "Pull the band toward your lower ribs, elbows close to your sides",
      "Squeeze your shoulder blades together at the end",
      "Let your arms straighten slowly"
    ],
    stop: "If your lower back aches, bend your knees a little more.",
    videos: [
      { id: "aafaCFMvDKk", start: 10, end: 45 },
      { id: "b3035OyY4c8", label: "Alternate", start: 14, end: 73, voice: true }
    ]
  },
  glutebridge: {
    name: "Glute Bridge", sets: 3, reps: "12", unit: "reps", rest: 45,
    equip: "none", gear: ["bodyweight"],
    muscles: { main: ["glutes"], help: ["hams"] },
    type: "hinge", level: "beginner", easyOn: ["lowerback", "knees"], loads: [], harder: ["slbridge"],
    key: "Squeeze your glutes at the top; don't arch your back",
    cues: [
      "Lie on your back, knees bent, feet flat and hip-width apart",
      "Rest your arms by your sides, palms down",
      "Press through your heels and lift your hips until your body is straight from knees to shoulders",
      "Lower slowly back down"
    ],
    stop: "If your hamstrings cramp, move your feet closer to your hips.",
    videos: [
      { id: "tqp5XQPpTxY" }
    ]
  },
  deadbug: {
    name: "Dead Bug", sets: 3, reps: "8", unit: "reps each side", rest: 45,
    equip: "none", gear: ["bodyweight"],
    muscles: { main: ["abs"], help: ["obliques", "hipflexors"] },
    type: "core", level: "beginner", easyOn: ["lowerback"], loads: [], harder: ["planktaps"],
    key: "Lower back stays on the floor",
    cues: [
      "Lie on your back with your arms reaching up and knees bent over your hips",
      "Press your lower back gently into the floor",
      "Slowly lower one arm overhead and the opposite leg toward the floor",
      "Bring them back and switch sides"
    ],
    stop: "If your lower back lifts or hurts, don't lower your arm and leg as far.",
    videos: [
      { id: "GbSC02oU3To", start: 10, end: 61, voice: true }
    ]
  },
  birddog: {
    name: "Bird Dog", sets: 3, reps: "8", unit: "reps each side", rest: 45,
    equip: "none", gear: ["bodyweight"],
    muscles: { main: ["lowerback", "glutes"], help: ["abs", "delts"] },
    type: "core", level: "beginner", easyOn: ["lowerback"], loads: ["wrists", "knees"],
    key: "Keep your hips level; don't twist",
    cues: [
      "Start on all fours, hands under shoulders and knees under hips",
      "Brace your stomach so your back stays flat",
      "Reach one arm forward and the opposite leg back until both are level with your body",
      "Pause, bring them back, and switch sides"
    ],
    stop: "If kneeling hurts your knees, add padding. If your wrists hurt, make fists.",
    videos: [
      { id: "xEDnlOxeJH4", start: 10, end: 73, voice: true }
    ]
  },
  sideplank: {
    name: "Kneeling Side Plank", sets: 2, time: 30, perSide: true, rest: 30,
    equip: "none", gear: ["bodyweight"],
    muscles: { main: ["obliques"], help: ["abs", "glutes", "delts"] },
    type: "core", level: "beginner", easyOn: ["lowerback"], loads: [],
    key: "Hips up and forward; don't let them sag",
    cues: [
      "Lie on your side, knees bent, elbow under your shoulder",
      "Lift your hips so your body is straight from knees to head",
      "Keep your top hand on your hip and breathe steadily"
    ],
    stop: "If your shoulder hurts, lower down and rest.",
    videos: [
      { id: "UurF0EhHFLg", end: 36, voice: true }
    ]
  },
  wallslide: {
    name: "Wall Slides", sets: 2, reps: "10", unit: "reps", rest: 30,
    equip: "a wall and a small towel", gear: ["bodyweight"],
    muscles: { main: ["delts"], help: ["traps", "upperback"] },
    type: "mobility", level: "beginner", easyOn: ["shoulders"], loads: [],
    key: "Move slowly, only as high as is comfortable",
    cues: [
      "Stand facing a wall with your hands on a towel against it",
      "Slide your hands up the wall as far as is comfortable",
      "Keep your shoulders down, away from your ears",
      "Slide back down slowly"
    ],
    stop: "If you feel a sharp pinch, stop lower down.",
    videos: [
      { id: "Eaj_NG5_hIo", start: 9, end: 46, voice: true }
    ]
  }
,

  // ---------- Gym machines and barbells (batch 2) ----------
  legpress: {
    name: "Leg Press", sets: 3, reps: "10–12", unit: "reps", rest: 90,
    equip: "a leg press machine (gym)", gear: ["gym"],
    muscles: { main: ["quads", "glutes"], help: ["hams", "adductors", "calves"] },
    type: "squat", level: "beginner", easyOn: ["lowerback"], loads: ["knees"],
    key: "Lower back stays on the pad",
    cues: [
      "Sit with your back flat against the pad",
      "Place your feet hip-width apart in the middle of the platform",
      "Lower the platform until your knees bend to about a right angle",
      "Press through your heels to push it back, without locking your knees"
    ],
    stop: "If your knees or lower back hurt, don't lower the platform as far.",
    videos: [
      { id: "p5dCqF7wWUw", start: 26, end: 57, voice: true }
    ]
  },
  latpulldown: {
    name: "Lat Pulldown", sets: 3, reps: "10–12", unit: "reps", rest: 60,
    equip: "a lat pulldown machine (gym)", gear: ["gym"],
    muscles: { main: ["lats"], help: ["biceps", "upperback", "reardelts"] },
    type: "pullup", level: "beginner", easyOn: [], loads: [], easier: ["bandpulldown"],
    key: "Pull to your chest, never behind your neck",
    cues: [
      "Sit with your thighs under the pads and grip the handles a little wider than your shoulders",
      "Lean back slightly and pull down to your upper chest",
      "Squeeze your shoulder blades down and together",
      "Let the handles rise slowly until your arms are straight"
    ],
    stop: "If your shoulders pinch, use a narrower grip and don't reach as high.",
    videos: [
      { id: "oMJmAHRZXBk", start: 34, end: 71, voice: true }
    ]
  },
  cablerow: {
    name: "Seated Cable Row", sets: 3, reps: "10–12", unit: "reps", rest: 60,
    equip: "a cable row machine (gym)", gear: ["gym"],
    muscles: { main: ["upperback", "lats"], help: ["biceps", "reardelts"] },
    type: "pull", level: "beginner", easyOn: [], loads: [], easier: ["bandrow"],
    key: "Sit tall; move your arms, not your back",
    cues: [
      "Sit tall with your feet on the platform and knees slightly bent",
      "Pull the handle to your stomach, elbows close to your sides",
      "Squeeze your shoulder blades together",
      "Reach forward slowly to straighten your arms"
    ],
    stop: "If your lower back aches, bend your knees more and stay upright.",
    videos: [
      { id: "f_r95UajQcg", end: 30, voice: true }
    ]
  },
  chestpress: {
    name: "Machine Chest Press", sets: 3, reps: "10–12", unit: "reps", rest: 90,
    equip: "a chest press machine (gym)", gear: ["gym"],
    muscles: { main: ["chest", "triceps"], help: ["delts"] },
    type: "push", level: "beginner", easyOn: [], loads: [], harder: ["benchpress"],
    key: "Shoulders back; don't lock your elbows",
    cues: [
      "Set the seat so the handles are in line with your chest",
      "Grip the handles and press them out until your arms are almost straight",
      "Keep your shoulder blades back against the seat",
      "Bring the handles back slowly"
    ],
    stop: "If the front of your shoulder hurts, don't let the handles come as far back.",
    videos: [
      { id: "sqNwDkUU_Ps", start: 26, end: 56, voice: true }
    ]
  },
  bbsquat: {
    name: "Barbell Back Squat", sets: 3, reps: "6–8", unit: "reps", rest: 120,
    equip: "a barbell and squat rack", gear: ["gym"],
    muscles: { main: ["quads", "glutes"], help: ["adductors", "hams", "lowerback", "abs"] },
    type: "squat", level: "intermediate", easyOn: [], loads: ["knees", "lowerback"], easier: ["gobletsquat"],
    key: "Chest up; knees out over your toes",
    cues: [
      "Squeeze your shoulder blades together to make a shelf and rest the bar across your upper back",
      "Stand up to lift the bar and take small steps back",
      "Set your feet about shoulder-width apart, toes turned out slightly",
      "Keep your eyes and chest up and push your knees out as you go down",
      "Press through the ground to stand back up"
    ],
    stop: "Squat inside a rack with the safety bars set. If your knees or back hurt, lower the weight and the depth.",
    videos: [
      { id: "ZaSetOZFo-k", start: 16, end: 55, voice: true }
    ]
  },
  deadlift: {
    name: "Barbell Deadlift", sets: 3, reps: "5", unit: "reps", rest: 120,
    equip: "a barbell and plates", gear: ["gym"],
    muscles: { main: ["glutes", "hams", "lowerback"], help: ["quads", "traps", "forearms", "upperback"] },
    type: "hinge", level: "intermediate", easyOn: ["knees"], loads: ["lowerback"], easier: ["rdl"],
    key: "Back flat; bar stays close to your legs",
    cues: [
      "Stand with the bar over the middle of your feet",
      "Push your hips back and bend your knees to grip the bar just outside your legs",
      "Lift your chest and flatten your back to take the slack out of the bar",
      "Push the floor away and stand tall, keeping the bar close to your legs",
      "Lower it the same way"
    ],
    stop: "If your lower back rounds or hurts, stop and lighten the weight.",
    videos: [
      { id: "S5JSZKURFPo", start: 17, end: 45, voice: true }
    ]
  },
  benchpress: {
    name: "Barbell Bench Press", sets: 3, reps: "6–8", unit: "reps", rest: 120,
    equip: "a barbell, bench and rack", gear: ["gym"],
    muscles: { main: ["chest", "triceps"], help: ["delts"] },
    type: "push", level: "intermediate", easyOn: [], loads: ["shoulders"], easier: ["chestpress"],
    key: "Shoulder blades squeezed together, feet planted",
    cues: [
      "Lie on the bench with your eyes under the bar and your feet flat on the floor",
      "Grip the bar a little wider than your shoulders",
      "Lower the bar to the middle of your chest with your elbows angled in",
      "Press it back up over your shoulders"
    ],
    stop: "Use a spotter or safety arms. If your shoulder hurts at the bottom, lower the weight.",
    videos: [
      { id: "xS3MqdFppiY", start: 5 }
    ]
  },
  ohp: {
    name: "Barbell Overhead Press", sets: 3, reps: "6–8", unit: "reps", rest: 90,
    equip: "a barbell and rack", gear: ["gym"],
    muscles: { main: ["delts", "triceps"], help: ["traps", "upperback", "abs"] },
    type: "pushup", level: "intermediate", easyOn: [], loads: ["shoulders", "lowerback"], easier: ["seatedohp"],
    key: "Squeeze your glutes; don't lean back",
    cues: [
      "Hold the bar at your collarbones, hands just outside your shoulders",
      "Squeeze your glutes and brace your stomach",
      "Press the bar straight up, moving your head back out of the way",
      "Finish with the bar over your head, then lower it back to your chest"
    ],
    stop: "If your lower back arches or your shoulder pinches, use a lighter weight.",
    videos: [
      { id: "afR3tPH6y_g", start: 7, end: 42, voice: true }
    ]
  },
  bbrow: {
    name: "Barbell Bent-Over Row", sets: 3, reps: "8–10", unit: "reps", rest: 90,
    equip: "a barbell", gear: ["gym"],
    muscles: { main: ["upperback", "lats"], help: ["biceps", "reardelts", "lowerback", "forearms"] },
    type: "pull", level: "intermediate", easyOn: [], loads: ["lowerback"], easier: ["csrow"],
    key: "Flat back; pull to your lower ribs",
    cues: [
      "Hold the bar with your hands just outside your legs",
      "Push your hips back and lean forward with a flat back",
      "Pull the bar to your lower ribs",
      "Lower it slowly with control"
    ],
    stop: "If your lower back aches, don't lean as far forward.",
    videos: [
      { id: "rqTOAM8WoeM", start: 10, end: 26, voice: true }
    ]
  },

  // ---------- Gap fillers (batch 3) ----------
  tablerow: {
    name: "Table Row", sets: 3, reps: "8–10", unit: "reps", rest: 60,
    equip: "a sturdy table", gear: ["bodyweight"],
    muscles: { main: ["upperback", "lats"], help: ["biceps", "reardelts", "abs"] },
    type: "pull", level: "beginner", easyOn: [], loads: [],
    key: "Body straight; pull your chest to the table",
    cues: [
      "Lie under a sturdy table and grip its edge, hands shoulder-width apart",
      "Bend your knees with feet flat, or straighten your legs to make it harder",
      "Pull your chest up toward the table, squeezing your shoulder blades",
      "Lower yourself slowly until your arms are straight"
    ],
    stop: "Only use a table that can't tip or slide. If your shoulders hurt, bend your knees more.",
    videos: [
      { id: "DfVqXebqoaw", start: 4, end: 35, voice: true }
    ]
  },
  lowjacks: {
    name: "Low-Impact Jacks", sets: 3, time: 30, rest: 30,
    equip: "none", gear: ["bodyweight"],
    muscles: { main: ["calves", "delts"], help: ["quads", "glutes"] },
    type: "cardio", level: "beginner", easyOn: [], loads: [],
    key: "Keep moving at a pace you can talk through",
    cues: [
      "Step one foot out to the side as you raise both arms overhead",
      "Step back in as your arms come down",
      "Switch sides and keep a steady rhythm"
    ],
    stop: "If you feel dizzy or can't catch your breath, slow down or rest.",
    videos: [
      { id: "0N6_Pqk5DPI", start: 5, end: 19 }
    ]
  },
  curlup: {
    name: "McGill Curl-Up", sets: 3, reps: "6", unit: "reps each side", rest: 30,
    equip: "none", gear: ["bodyweight"],
    muscles: { main: ["abs"], help: ["obliques"] },
    type: "core", level: "beginner", easyOn: ["lowerback"], loads: [],
    key: "Lift only your head and shoulders",
    cues: [
      "Lie on your back with one knee bent and the other leg straight",
      "Slide your hands under your lower back to keep its natural curve",
      "Brace your stomach and lift your head and shoulders slightly off the floor",
      "Hold for ten seconds, then lower. Switch legs halfway"
    ],
    stop: "Don't curl up any higher. If your neck strains, tuck your chin slightly.",
    videos: [
      { id: "I_drRVYlHbc", start: 5, end: 33, voice: true }
    ]
  },
  legcurl: {
    name: "Seated Leg Curl", sets: 3, reps: "10–12", unit: "reps", rest: 60,
    equip: "a leg curl machine (gym)", gear: ["gym"],
    muscles: { main: ["hams"], help: ["calves"] },
    type: "legs", level: "beginner", easyOn: [], loads: [],
    key: "Slow on the way back up",
    cues: [
      "Adjust the machine so your knees line up with its pivot and the pad rests just above your ankles",
      "Lower the thigh pad so your legs are held firmly",
      "Curl your heels down and back under the seat",
      "Let your legs rise back up slowly"
    ],
    stop: "If the back of your knee hurts, use a lighter weight and a smaller range.",
    videos: [
      { id: "TAbolZJ6Lg4", start: 17, end: 54 }
    ]
  },
  legext: {
    name: "Leg Extension", sets: 3, reps: "10–12", unit: "reps", rest: 60,
    equip: "a leg extension machine (gym)", gear: ["gym"],
    muscles: { main: ["quads"], help: [] },
    type: "legs", level: "beginner", easyOn: [], loads: ["knees"],
    key: "Lift and lower slowly, no swinging",
    cues: [
      "Adjust the seat so your knees line up with the machine's pivot",
      "Set the pad on the front of your lower shins",
      "Straighten your legs to lift the pad, squeezing your thighs",
      "Lower slowly back down"
    ],
    stop: "If your kneecaps hurt, use a lighter weight and stop short of straightening your legs fully.",
    videos: [
      { id: "EAR4tit2Dac", start: 10, end: 53 }
    ]
  }
};

// The optional warm-up before every session, and the cool-down stretches after it
// (one round each side, short rests; stretches the day already has are left out)
const WARMUP = ["catcow", "armcircles", "threadneedle", "hip9090", "revlungetwist"];
const COOLDOWN = ["pigeon", "couch", "crossbody", "tricepsstretch", "hamstring"];

// Activity days: cardio or sport done on your own, with the warm-up before and the stretches after.
// No demo video; the day screen shows the activity and a tip.
const ACTIVITIES = {
  walk:  { name: "Brisk walk", tip: "Walk fast enough that you can talk, but not sing." },
  run:   { name: "Run", tip: "Easy pace: you should be able to speak in short sentences." },
  cycle: { name: "Cycle", tip: "Steady pace, outdoors or on a bike at the gym." },
  swim:  { name: "Swim", tip: "Steady laps with short breaks when you need them." },
  hike:  { name: "Hike", tip: "Take the hills slowly and keep a steady breath." },
  sport: { name: "Sport", tip: "Play as usual. Warm up before you start and stretch afterwards." },
  class: { name: "Fitness class", tip: "Any class you enjoy: dance, spin, aerobics, a sports session." },
};

// An exercise as done with demo `vi`. A demo can be a different variant of the exercise
// (figure-4 instead of pigeon) with its own name, Focus, cues and safety note; otherwise
// it shows the same movement and the exercise's own text applies.
function variant(key, vi = 0) {
  const ex = EX[key], v = ex.videos[vi] || {};
  return { name: v.name || ex.name, key: v.key || ex.key, cues: v.cues || ex.cues, stop: v.stop || ex.stop,
    muscles: v.muscles || ex.muscles, level: v.level || ex.level, easyOn: v.easyOn || ex.easyOn, loads: v.loads || ex.loads,
    spoken: v.name ? speakable(v.name) : SPOKEN_NAMES[key] || ex.name };
}
const isVariant = (v) => !!(v.name || v.cues || v.key);

// Movement patterns, so a week can be balanced (names as the AI prompt shows them)
const TYPES = {
  squat: "squat", hinge: "hinge", lunge: "lunge / single leg", push: "push (forward)", pushup: "push (overhead)",
  pull: "pull (rowing)", pullup: "pull (overhead)", core: "core", carry: "carry", calves: "calves and shins",
  arms: "arms", legs: "legs (machine)", cardio: "cardio (low impact)", mobility: "mobility", stretch: "stretch",
};
// Kinds of kit, for the Exercises filter. Choosing one also shows everything that needs less:
// bodyweight moves go with any kit, and a gym has it all.
const GEAR = {
  bodyweight: { name: "Bodyweight", with: ["bodyweight"] },
  bands: { name: "Bands", with: ["bodyweight", "bands"] },
  dumbbells: { name: "Dumbbells", with: ["bodyweight", "dumbbells"] },
  gym: { name: "Gym", with: ["bodyweight", "bands", "dumbbells", "gym"] },
};
// Body areas, for grouping and filtering exercises by what they mainly work
const AREAS = {   // alphabetical: the order of the Exercises tab's chips and groups
  arms: { name: "Arms", muscles: ["biceps", "triceps", "forearms"] },
  back: { name: "Back", muscles: ["lats", "upperback", "lowerback", "traps"] },
  chest: { name: "Chest", muscles: ["chest"] },
  core: { name: "Core", muscles: ["abs", "obliques"] },
  legs: { name: "Legs", muscles: ["quads", "glutes", "hams", "adductors", "calves", "shins", "hipflexors"] },
  shoulders: { name: "Shoulders", muscles: ["delts", "reardelts"] },
};
// The areas an exercise mainly works, its first main muscle's area first (where it's listed)
const areasOf = (key) => {
  const main = EX[key].muscles.main, first = Object.keys(AREAS).find((a) => AREAS[a].muscles.includes(main[0]));
  return [first, ...Object.keys(AREAS).filter((a) => a !== first && main.some((m) => AREAS[a].muscles.includes(m)))];
};

// Joints an exercise can be easy on or load
const JOINTS = { shoulders: "shoulders", elbows: "elbows", wrists: "wrists", lowerback: "lower back", hips: "hips", knees: "knees", ankles: "ankles" };

// The muscles the figures can highlight (figures/*.json), with the names shown on screen: the real
// ones people hear in a gym, so seeing them next to the highlighted body part teaches them
const MUSCLES = {
  traps: "Traps", delts: "Delts", reardelts: "Rear delts", chest: "Chest", upperback: "Upper back",
  lats: "Lats", lowerback: "Lower back", biceps: "Biceps", triceps: "Triceps", forearms: "Forearms",
  abs: "Abs", obliques: "Obliques", glutes: "Glutes", hipflexors: "Hip flexors", adductors: "Adductors",
  quads: "Quads", hams: "Hamstrings", calves: "Calves", shins: "Shins",
};
// A list of equal parts, not a sentence: ["hams", "glutes"] → "Hamstrings, Glutes" (or with sep " · ")
const muscleList = (keys, sep = ", ") => keys.map((k) => MUSCLES[k]).join(sep);
