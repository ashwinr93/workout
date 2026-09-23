/* Workout data: exercises, weekly plan, and everything the coach says.

   Exercise fields
     name, sets?, reps + unit (rep-based) or time (seconds, a hold), perSide?, rest (seconds)
     key    the one form cue that matters most (shown prominently, spoken first)
     cues   step-by-step form cues, in the order the demo shows them
     stop   when to back off (joint safety)
     videos main demo first, then alternates:
            { id: YouTube id, label?, start?/end? (seconds, trims intros/outros),
              voice?: true if someone talks in it (otherwise the coach speaks even in Video mode) }
   Every demo is ad-free and checked by tests/e2e/ad-scan.mjs.
*/
const EX = {

  // ---------- Warm-up ----------
  catcow: {
    name: "Cat-Cow → Child's Pose", reps: "8", unit: "slow reps",
    key: "Move slowly, with your breath",
    why: "Loosens the spine and shoulders without putting load on the joints.",
    cues: [
      "Get on all fours: hands under shoulders, knees under hips",
      "Cow: breathe in, let your belly drop, and lift your chest and tailbone",
      "Cat: breathe out, round your back up, and tuck your chin",
      "Child's pose: sit your hips back toward your heels with arms long, then come back up"
    ],
    stop: "Stop if you feel sharp back pain. If sitting back hurts your knees, put a cushion behind them.",
    videos: [
      { id: "Kegpy6v-NfA" },
      { id: "vuyUwtHl694", label: "Alternate", start: 14, end: 72, voice: true }
    ]
  },
  armcircles: {
    name: "Arm Circles", reps: "10", unit: "each direction",
    key: "Palms down; start small, finish big",
    why: "Warms up the shoulders without any load.",
    cues: [
      "Stand tall with your arms straight out at shoulder height, palms down",
      "Start with small circles and gradually make them bigger",
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
    key: "Twist from the upper back; keep your hips still",
    why: "Rotates the upper back and makes room at the top of the shoulder.",
    cues: [
      "Get on all fours: hands under shoulders, knees under hips",
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
    key: "Step back, and keep the front shin vertical",
    why: "Stepping backward keeps the front shin vertical, which protects the front knee.",
    cues: [
      "If you like, hold a light plate or ball in front of you",
      "Step back and lower until both knees are near 90°",
      "Keep the front knee behind your toes, over the ankle",
      "At the bottom, rotate your chest toward the front leg, then turn back and step forward"
    ],
    stop: "If your front knee hurts, take a shorter step and don't go as low.",
    videos: [
      { id: "LrIE5onzj68", start: 9, end: 45, voice: true },
      { id: "UuBs5AqO3JY", label: "Alternate" }
    ]
  },

  // ---------- Monday: Upper A ----------
  inclinepress: {
    name: "Neutral-Grip Incline Press", sets: 3, reps: "8–10", unit: "reps", rest: 90,
    key: "Bench at 30°–45°, palms facing each other",
    why: "Avoids pinching the shoulder. Keep your elbows at 45°.",
    cues: [
      "Set the bench to a low incline, 30–45°",
      "Start with the dumbbells on your knees, then lie back and kick them up",
      "Palms face each other; pull your shoulder blades together. A slight natural arch is fine",
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
    key: "Pull toward your hip, not your chest",
    why: "Keep your back flat and pause for 1 second at the top.",
    cues: [
      "One hand and one knee on the bench, back flat like a table",
      "Let the dumbbell hang, then drive your elbow back toward your hip",
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
    key: "Palms facing each other; the floor limits the range",
    why: "Protects the front of the shoulder joint.",
    cues: [
      "Lie on the floor with knees bent and feet flat",
      "Palms face each other, elbows about 45° from your body",
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
    key: "Keep your chest glued to the bench",
    why: "Resting your chest on the bench takes strain off the lower back.",
    cues: [
      "Set the bench to 30–45° and lie chest-down, arms hanging straight",
      "Let your shoulders stretch fully at the bottom",
      "Row the dumbbells toward your hips and squeeze your shoulder blades at the top",
      "Lower slowly. Keep your chest on the pad and don't shrug"
    ],
    stop: "If your neck tenses up, tuck your chin and keep your shoulders down.",
    videos: [
      { id: "ym-Mp8tCF00", start: 8, end: 76, voice: true }
    ]
  },
  facepull: {
    name: "Face Pulls / Band Pull-Aparts", sets: 3, reps: "15–20", unit: "reps", rest: 60,
    key: "Light weight; stop at eye level",
    why: "Key for the rear shoulders and keeping the shoulder blades stable.",
    cues: [
      "Dumbbells: hinge forward with arms hanging, or lie chest-down on an incline bench",
      "Pull the dumbbells up and out to about eye level, elbows high and wide",
      "Don't pull further back; that turns it into a back exercise",
      "Band: arms straight at shoulder height; pull it apart, squeeze 2 seconds, return slowly"
    ],
    stop: "If anything pinches, go lighter.",
    videos: [
      { id: "nzTY7j9ocR8", label: "DB face pull", voice: true },
      { id: "stwYTTPXubo", label: "Band pull-apart", start: 8, end: 44, voice: true }
    ]
  },

  // ---------- Tuesday: Lower A ----------
  rdl: {
    name: "Romanian Deadlift", sets: 3, reps: "8–10", unit: "reps", rest: 90,
    key: "Hinge at the hips with soft knees",
    why: "Puts no shear on the knee and protects the kneecap tendon.",
    cues: [
      "Stand tall: chest up, shoulders back, core tight, pelvis tucked for a neutral back",
      "Push your hips back as if touching a wall behind you, knees soft",
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
    key: "Tap the bench, don't sit down; shins stay vertical",
    why: "Keeps the knees from pushing forward. Drive through your heels.",
    cues: [
      "Rest the dumbbells on your shoulders, or hold one at your chest",
      "Push your hips back and lower until you just tap the bench",
      "Don't relax onto it. Spread the floor with your feet so your knees stay out",
      "Drive through your heels to stand"
    ],
    stop: "If your knees hurt, use a higher surface to sit to.",
    videos: [
      { id: "DqWrOnzZ5No", voice: true }
    ]
  },
  slbridge: {
    name: "Single-Leg Glute Bridge", sets: 3, reps: "12", unit: "reps each side", rest: 60,
    key: "Squeeze for 2 seconds at the top",
    why: "Lying flat takes load off the spine and isolates the glutes.",
    cues: [
      "Lie on your back and hug one knee to your chest. This keeps your lower back from arching",
      "Put the other foot flat, close to your hips",
      "Press through that foot and lift your hips, keeping them level",
      "Hold 2 seconds at the top and lower slowly. Do all reps on one side, then switch"
    ],
    stop: "If your hamstring cramps, move your foot closer to your hips.",
    videos: [
      { id: "vdmlNaXSjd4", start: 4 },
      { id: "AVAXhy6pl7o", label: "Alternate", start: 2, voice: true }
    ]
  },
  calfraise: {
    name: "Standing Calf Raises", sets: 3, reps: "15", unit: "reps", rest: 45,
    key: "Go slowly and hold the top for 2 seconds",
    why: "Builds ankle and Achilles stability.",
    cues: [
      "Stand with the balls of your feet on a step about 5–8 cm high, heels hanging off",
      "Breathe out and rise as high as you can",
      "Hold the top for 2 seconds",
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
    key: "Keep your hips square; no rocking",
    why: "Keeps the spine from twisting. Tap slowly.",
    cues: [
      "High plank: hands under shoulders, body braced in a straight line",
      "Set your feet wider for more stability",
      "Slowly tap one hand to the opposite shoulder, alternating sides",
      "Move as little as possible. No hip rocking"
    ],
    stop: "If your wrists or lower back hurt, drop to your knees.",
    videos: [
      { id: "0PrTUpElJ44", start: 3, end: 13 }
    ]
  },

  // ---------- Wednesday: Active recovery ----------
  couch: {
    name: "Couch Stretch", sets: 2, time: 120, perSide: true, rest: 20,
    key: "Squeeze the glute of your back leg",
    why: "Releases tight quads and hip flexors that pull on the kneecap tendon.",
    cues: [
      "Kneel with your back foot up on the couch or bench behind you and the knee on a pillow",
      "Step the other foot forward into a lunge",
      "Squeeze the glute of the back leg; this deepens the stretch",
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
    key: "Lift your toes high and lower them slowly",
    why: "Strengthens the shin muscles that slow you down, which helps protect the knees in football.",
    cues: [
      "Lean your hips and back against a wall with your legs straight",
      "Pull your toes up toward your shins as high as you can",
      "Keep your knees straight and quads tight; don't hike your hips",
      "Feet farther from the wall makes it easier; closer makes it harder"
    ],
    stop: "If your shins cramp, shorten the set and shake it out.",
    videos: [
      { id: "OPEuhclsTUQ", voice: true },
      { id: "nQKgHwi8W9E", label: "Alternate", end: 21 }
    ]
  },

  // ---------- Friday: Upper B ----------
  seatedohp: {
    name: "Seated Neutral Overhead Press", sets: 3, reps: "10–12", unit: "reps", rest: 90,
    key: "Press slightly in front of you, not straight out to the sides",
    why: "Palms facing in, elbows slightly forward, core braced.",
    cues: [
      "Sit upright with your back supported and kick the dumbbells up to shoulder height",
      "Palms face each other, elbows slightly in front of your body",
      "Press up so the weights end slightly in front of your head",
      "Lower back to shoulder level. Keep your ribs down and don't arch"
    ],
    stop: "If your shoulder pinches, shorten the range or tilt the bench back a little.",
    videos: [
      { id: "7oH0algsdww", start: 4, voice: true }
    ]
  },
  pullover: {
    name: "Pullovers", sets: 3, reps: "12", unit: "reps", rest: 60,
    key: "Soft elbows; comfortable range only",
    why: "Only lower to a comfortable shoulder stretch.",
    cues: [
      "Lie on the floor or a bench, holding one dumbbell over your chest with both hands",
      "Keep a slight bend in your elbows and don't let it change",
      "Lower the weight behind your head only as far as is comfortable",
      "On the floor, stop when it touches. Pull back until it's over your chest, no further"
    ],
    stop: "The bench demo goes deep; you don't need to. If your shoulder feels uncomfortable, stop earlier.",
    videos: [
      { id: "qALakTR1nRI", label: "Floor (safer range)", start: 1, end: 19 },
      { id: "FK4rHfWKEac", label: "Bench", start: 7, end: 55, voice: true }
    ]
  },
  hammercurl: {
    name: "Incline Hammer Curls", sets: 3, reps: "12", unit: "reps", rest: 60,
    key: "Palms facing in; keep your upper arms still",
    why: "The neutral grip protects the elbow and shoulder tendons.",
    cues: [
      "Set the bench to 45–60° and let your arms hang straight down",
      "Curl up with your thumbs pointing up",
      "Keep your elbows back and still; don't swing",
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
    key: "Keep your elbows tucked in",
    why: "Stop right away if your shoulder pinches.",
    cues: [
      "Floor: lie back, dumbbells over your chest, palms facing each other",
      "Angle your arms slightly back toward your head, then bend only at the elbows",
      "Lower just past 90° and press back up; your upper arms stay still",
      "Overhead: sit with one dumbbell in both hands, elbows tucked in and pointing forward"
    ],
    stop: "If your shoulder pinches, stop right away and use the floor version.",
    videos: [
      { id: "Py4I0J6i2kY", label: "Floor version", voice: true },
      { id: "HADoxgsslvw", label: "Overhead version", end: 8 }
    ]
  },
  ytw: {
    name: "Y-T-W Raises", sets: 2, reps: "10", unit: "reps of each letter", rest: 60,
    key: "Use 2–4 kg at most",
    why: "Rebuilds the small stabilizing muscles of the rotator cuff.",
    cues: [
      "Lie chest-down on an incline bench, arms hanging, with light weights of 2–4 kg",
      "Y: raise your arms up and out at 45°, thumbs up",
      "T: raise your arms straight out to the sides, thumbs up",
      "W: elbows bent at your sides, squeeze your shoulder blades back and down"
    ],
    stop: "If anything hurts, use lighter dumbbells or none at all.",
    videos: [
      { id: "OFQduBFpDrY", label: "Incline bench" },
      { id: "WAnSCSJbQYw", label: "Incline, with A" }
    ]
  },

  // ---------- Saturday: Lower B ----------
  dbrevlunge: {
    name: "Reverse Lunges", sets: 3, reps: "10", unit: "reps each side", rest: 90,
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
      { id: "xK4ED_yQcoU", label: "Sumo", voice: true },
      { id: "TC2jOPCNYhU", label: "Goblet", end: 33 }
    ]
  },
  stepup: {
    name: "Step-Ups", sets: 3, reps: "10", unit: "reps each side", rest: 60,
    key: "Use a step low enough that your knee is at 90° or less",
    why: "Push through the heel of your leading leg.",
    cues: [
      "Stand facing a low step, dumbbells at your sides. The box in the demo is higher than you need",
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
    name: "Suitcase Carries", sets: 3, reps: "40 m", unit: "carry, switching hands halfway", rest: 60,
    key: "Walk tall without leaning",
    why: "Trains core and side-to-side hip stability.",
    cues: [
      "Pick the dumbbell up with one hand the way you'd do a deadlift",
      "Stand tall with your shoulders level and ribs down",
      "Walk slowly in a straight line; don't let the weight pull you sideways",
      "Switch hands halfway"
    ],
    stop: "If you can't stay upright, use a lighter weight.",
    videos: [
      { id: "3RKKnZhhelE", voice: true },
      { id: "bAnCoDrvXc4", label: "Alternate", start: 4 }
    ]
  },

  // ---------- Post-workout flexibility (and Sunday) ----------
  pigeon: {
    name: "Pigeon Pose / Figure-4", sets: 1, time: 120, perSide: true, rest: 10,
    key: "Gentle stretch; no knee pain",
    why: "Stretches the glutes and the deep hip rotators.",
    cues: [
      "Pigeon: from all fours, bring the leg you're stretching forward and across under your body",
      "Slide the other leg straight back, then sit back into the stretch",
      "Figure-4, easier on the knees: on your back, ankle over the other knee, pull that thigh in",
      "Keep your hips square; breathe slowly and relax into it"
    ],
    stop: "If your front knee hurts in pigeon, switch to the lying figure-4.",
    videos: [
      { id: "1o7awuDGzag", label: "Pigeon", start: 1, end: 20, voice: true },
      { id: "xVq2-g_leTI", label: "Figure-4", start: 11, voice: true }
    ]
  },
  crossbody: {
    name: "Cross-Body Shoulder Stretch", sets: 1, time: 30, perSide: true, rest: 10,
    key: "Keep the shoulder down, away from your ear",
    why: "Stretches the back of the shoulder capsule.",
    cues: [
      "Bring one arm straight across your chest",
      "Hold it just above the elbow with your other hand",
      "Gently pull until you feel the stretch at the back of the shoulder",
      "Keep both shoulders relaxed and low"
    ],
    stop: "If you feel pinching at the front of the shoulder, ease off.",
    videos: [
      { id: "aIq0fLi8iak", start: 4, voice: true }
    ]
  },
  tricepsstretch: {
    name: "Overhead Triceps Stretch", sets: 1, time: 30, perSide: true, rest: 10,
    key: "Gentle pressure; keep your ribs down",
    why: "Stretches the triceps and the back of the shoulder.",
    cues: [
      "Reach one hand down between your shoulder blades",
      "With the other hand, gently push that elbow back",
      "Keep your ribs down; don't arch your lower back",
      "Aim for a gentle stretch, not pain"
    ],
    stop: "If your shoulder pinches, lower the elbow or ease the pressure.",
    videos: [
      { id: "_IOHtPSYGbk", start: 4, voice: true }
    ]
  },
  hamstring: {
    name: "Hamstring Doorway Stretch", sets: 1, time: 60, perSide: true, rest: 10,
    key: "Keep your lower back flat on the floor",
    why: "Stretches the hamstrings without stressing the lower back.",
    cues: [
      "Lie on your back in a doorway",
      "Rest one leg straight up the door frame and keep the other flat through the doorway",
      "Scoot closer to the frame to make the stretch stronger",
      "Keep your lower back flat and relax"
    ],
    stop: "If you feel tingling down the leg, back off. That's a nerve, not the muscle.",
    videos: [
      { id: "VWk9QD10Xjg", start: 1, voice: true },
      { id: "b7k-9CZVYbA", label: "Alternate", end: 49, voice: true }
    ]
  }
};

EX.couchSun = { ...EX.couch, sets: 1, rest: 10 }; // Sunday / cool-down: one round each side

const WARMUP = ["catcow", "armcircles", "threadneedle", "hip9090", "revlungetwist"];
// Post-workout flexibility (the PDF's Sunday static-stretch list), offered after every session
const COOLDOWN = ["pigeon", "couchSun", "crossbody", "tricepsstretch", "hamstring"];

// d follows Date.getDay(): 0 = Sunday
const DAYS = [
  { d: 1, name: "Monday", focus: "Upper Body A", goal: "Chest/back strength + shoulder stability",
    items: ["inclinepress", "sarow", "floorpress", "csrow", "facepull"] },
  { d: 2, name: "Tuesday", focus: "Lower Body A", goal: "Posterior chain & knee-friendly quads",
    items: ["rdl", "boxsquat", "slbridge", "calfraise", "planktaps"] },
  { d: 3, name: "Wednesday", focus: "Active Recovery", goal: "Thoracic spine & hip mobility",
    items: ["couch", "doorway", "tibraise"] },
  { d: 4, name: "Thursday", focus: "Football Match", goal: "High-intensity cardio & agility", items: [], match: true },
  { d: 5, name: "Friday", focus: "Upper Body B", goal: "Hypertrophy & rotator cuff care",
    items: ["seatedohp", "pullover", "hammercurl", "triceps", "ytw"] },
  { d: 6, name: "Saturday", focus: "Lower Body B", goal: "Single-leg balance, hips & knee prehab",
    items: ["dbrevlunge", "sumodl", "stepup", "suitcase"] },
  { d: 0, name: "Sunday", focus: "Rest & Recovery", goal: "Full-body static stretching",
    items: COOLDOWN, isCooldown: true },
];

/* ---------------------------------------------------------------------
   Narration. Every phrase is pre-recorded as audio/<clipId>.m4a by
   tools/make_audio.py, which reads allPhrases() from this file.
   --------------------------------------------------------------------- */
const SPOKEN_NAMES = {
  catcow: "Cat cow, into child's pose", armcircles: "Arm circles", threadneedle: "Thread the needle",
  hip9090: "Ninety ninety hip swivels", revlungetwist: "Reverse lunge with a twist",
  inclinepress: "Neutral grip incline press", sarow: "Single arm dumbbell row",
  floorpress: "Dumbbell floor press", csrow: "Chest supported incline row",
  facepull: "Face pulls, or band pull aparts", rdl: "Romanian deadlift",
  boxsquat: "Box squat to the bench", slbridge: "Single leg glute bridge",
  calfraise: "Standing calf raises", planktaps: "Plank with shoulder taps",
  couch: "Couch stretch", couchSun: "Couch stretch", doorway: "Doorway chest stretch",
  tibraise: "Tibialis raises", seatedohp: "Seated neutral grip overhead press",
  pullover: "Dumbbell pullovers", hammercurl: "Incline hammer curls",
  triceps: "Triceps extensions", ytw: "Y, T, W raises", dbrevlunge: "Dumbbell reverse lunges",
  sumodl: "Sumo deadlift", stepup: "Step ups", suitcase: "Suitcase carries",
  pigeon: "Pigeon pose, or figure four", crossbody: "Cross body shoulder stretch",
  tricepsstretch: "Overhead triceps stretch", hamstring: "Hamstring doorway stretch",
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

const SAY = {
  name: (key) => sentence(SPOKEN_NAMES[key] || EX[key].name),
  target: (key) => {
    const ex = EX[key];
    return ex.time ? sentence(`Hold for ${durationWords(ex.time)}${ex.perSide ? " each side" : ""}`)
                   : sentence(speakable(`${ex.reps} ${ex.unit}`));
  },
  key: (key) => sentence(speakable(EX[key].key)),
  cue: (key, i) => sentence(speakable(EX[key].cues[i])),
  setOf: (s, n) => `Set ${NUM_WORDS[s]} of ${NUM_WORDS[n]}.`,
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

// Every phrase the app can say
function allPhrases() {
  const out = new Set();
  for (const [key, ex] of Object.entries(EX)) {
    out.add(SAY.name(key)); out.add(SAY.target(key)); out.add(SAY.key(key));
    ex.cues.forEach((_, i) => out.add(SAY.cue(key, i)));
    const n = ex.sets || 1;
    for (let s = 1; s <= n; s++) out.add(SAY.setOf(s, n));
    if (ex.rest) out.add(SAY.rest(ex.rest));
  }
  [SAY.side("Left side"), SAY.side("Right side"), SAY.lastSet(), SAY.switchSides(), SAY.go(), SAY.tenLeft(),
   SAY.nextUp(), SAY.tenToGo(), SAY.done()].forEach((t) => out.add(t));
  return [...out];
}

if (typeof module !== "undefined") module.exports = { EX, WARMUP, COOLDOWN, DAYS, SAY, clipId, allPhrases };
