/* Ready-made plans (the Plans tab). Each is an ordinary plan link (plan.js), so starting one is
   the same as opening a plan an AI wrote. Designed from published guidance:
   - beginners: 2–3 full-body sessions a week, 8–12 reps, 1–3 sets (ACSM progression models)
   - muscle: each muscle about 10+ hard sets a week, trained twice a week (Schoenfeld's meta-analyses)
   - strength: heavier sets of about 5 (ACSM)
   - everyone: 150–300 minutes of moderate activity a week and strength work on 2+ days (WHO 2020)
   title: the name as shown (a link can only carry letters and hyphens)
   goals: lose (Lose weight) · strong (Get stronger) · move (Move better)
   photo: the card's picture, from Unsplash (free to use under the Unsplash License; credited in the
   README by tools/credits.mjs): img = its id on images.unsplash.com, page = its unsplash.com/photos/ id */
const GOALS = { lose: "Lose weight", strong: "Get stronger", move: "Move better" };
const photoUrl = (p, w) => `https://images.unsplash.com/photo-${p.photo.img}?w=${w}&q=70&auto=format&fit=crop`;
// A plan you made with AI gets a photo that matches what it uses: the most kit any of its exercises
// needs (GEAR in library.js), or stretching when it's all stretches
const OWN_PHOTOS = {
  bodyweight: { img: "1758599878222-04c0d21c275b", by: "Vitaly Gariev", page: "cr1x1-_EUbw" },
  bands: { img: "1658314755811-73c806249f31", by: "Centre for Ageing Better", page: "kB4FXX1KXhQ" },
  dumbbells: { img: "1659614871735-e133639e4b28", by: "engin akyurt", page: "1lkg9MLl_rU" },
  gym: { img: "1571019652329-224804d6d663", by: "Jonathan Borba", page: "VgZsyPiZLKw" },
  stretch: { img: "1593811167565-4672e6c8ce4c", by: "THLT LCX", page: "893qZckG6I4" },
};

const PROGRAMS = [
  { id: "start", photo: { img: "1758599880618-3f03f2a401b4", by: "Vitaly Gariev", page: "funsezUxxe4" }, title: "Start Here: Full Body", goals: ["strong"], level: "beginner", gear: "Bodyweight and a sturdy table", mins: 30,
    about: "Your first plan: three short full-body sessions with just your body weight, plus a weekend walk.",
    link: "v1/t:Start-Here-Full-Body"
      + "/mon:Full-Body-A:bwsquat.2x10-12,inclinepushup.2x8-10,tablerow.2x8-10,glutebridge.2x12,deadbug.2x8"
      + "/wed:Full-Body-B:splitsquat.2x8,inclinepushup.2x10-12,tablerow.2x8-10,birddog.2x8,sideplank.2x20s"
      + "/fri:Full-Body-C:bwsquat.3x10-12,inclinepushup.3x8-10,tablerow.3x8-10,glutebridge.3x12,curlup.2x6"
      + "/sat:Walk:walk.30m" },
  { id: "lose", photo: { img: "1518609571773-39b7d303a87b", by: "bruce mars", page: "oLStrTTMz2s" }, title: "Lose Weight at Home", goals: ["lose"], level: "beginner", gear: "Resistance bands", mins: 35,
    about: "Three strength sessions keep your muscle while you lose fat, and walks add the activity. What you eat still does most of the work.",
    link: "v1/t:Lose-Weight-at-Home"
      + "/mon:Strength-A:bwsquat.3x12,inclinepushup.3x10-12,bandrow.3x12-15,glutebridge.3x12,lowjacks.3x30s"
      + "/tue:Brisk-Walk:walk.40m"
      + "/wed:Strength-B:splitsquat.3x8,bandpulldown.3x12-15,stepup.2x10,deadbug.3x8,lowjacks.3x30s"
      + "/thu:Brisk-Walk:walk.40m"
      + "/fri:Strength-C:bwsquat.3x12,inclinepushup.3x10-12,bandrow.3x12-15,birddog.3x8,lowjacks.3x45s"
      + "/sat:Long-Walk:walk.60m" },
  { id: "gym-first", photo: { img: "1675026482808-33f7515ecddd", by: "Nate Johnston", page: "SMSpk9fprcU" }, title: "Gym First Steps", goals: ["strong"], level: "beginner", gear: "Gym machines", mins: 40,
    about: "For your first weeks in a gym: machines that guide the movement, so you can focus on doing it right.",
    link: "v1/t:Gym-First-Steps"
      + "/mon:Legs-and-Push:legpress.2x10-12,chestpress.2x10-12,legcurl.2x10-12,glutebridge.2x12"
      + "/wed:Pull-and-Core:latpulldown.2x10-12,cablerow.2x10-12,legext.2x10-12,deadbug.2x8"
      + "/fri:Full-Body:legpress.3x10-12,chestpress.3x10-12,latpulldown.3x10-12,sideplank.2x20s" },
  { id: "muscle-db", photo: { img: "1714646442222-128928b04214", by: "Vitaly Gariev", page: "1P2iWpwuNAs" }, title: "Build Muscle: Dumbbells", goals: ["strong"], level: "intermediate", gear: "Dumbbells and a bench", mins: 50,
    about: "Build muscle at home: upper and lower body twice a week each, with enough sets for every muscle to grow.",
    link: "v1/t:Build-Muscle-Dumbbells"
      + "/mon:Upper-A:inclinepress.3x8-10,sarow.3x10-12,seatedohp.3x10-12,csrow.3x10-12,hammercurl.3x10-12,triceps.3x10-12"
      + "/tue:Lower-A:gobletsquat.3x8-10,rdl.3x8-10,splitsquat.3x8,calfraise.3x12-15,planktaps.3x30s"
      + "/thu:Upper-B:floorpress.3x8-10,csrow.3x10-12,pullover.3x12,facepull.3x15-20,hammercurl.2x12,triceps.2x12"
      + "/fri:Lower-B:sumodl.3x10-12,dbrevlunge.3x10,stepup.3x10,slbridge.3x12,suitcase.3x40" },
  { id: "muscle-gym", photo: { img: "1546483875-ad9014c88eba", by: "Cathy Pham", page: "3jAN9InapQI" }, title: "Build Muscle: Gym", goals: ["strong"], level: "intermediate", gear: "Gym", mins: 55,
    about: "Build muscle in a gym: machines, dumbbells and barbells, with upper and lower body twice a week each.",
    link: "v1/t:Build-Muscle-Gym"
      + "/mon:Upper-A:chestpress.3x8-10,latpulldown.3x10-12,seatedohp.3x10-12,cablerow.3x10-12,hammercurl.3x10-12,triceps.3x10-12"
      + "/tue:Lower-A:legpress.3x10-12,rdl.3x8-10,legcurl.3x10-12,legext.3x10-12,calfraise.3x12-15"
      + "/thu:Upper-B:inclinepress.3x8-10,bbrow.3x8-10,latpulldown.3x10-12,facepull.3x15-20,chestpress.2x10-12"
      + "/fri:Lower-B:bbsquat.3x8-10,splitsquat.3x8,legcurl.3x10-12,glutebridge.3x12,planktaps.3x30s" },
  { id: "barbell", photo: { img: "1761839258420-5c3e2f2e2a74", by: "Land O'Lakes, Inc.", page: "IYLLF511aOY" }, title: "Barbell Strength Basics", goals: ["strong"], level: "intermediate", gear: "Barbell and rack", mins: 50,
    about: "Get stronger on the big barbell lifts with heavier sets of five. Best if you've lifted a barbell before.",
    link: "v1/t:Barbell-Strength-Basics"
      + "/mon:Day-A:bbsquat.3x5,benchpress.3x5,bbrow.3x6-8,planktaps.3x30s"
      + "/wed:Day-B:deadlift.3x5,ohp.3x5,latpulldown.3x8-10,curlup.2x6"
      + "/fri:Day-A:bbsquat.3x5,benchpress.3x5,bbrow.3x6-8,suitcase.3x40" },
  { id: "posture", photo: { img: "1758611971431-c876c0a21346", by: "Vitaly Gariev", page: "07mA-tEIJ6A" }, title: "Desk Worker: Posture and Back", goals: ["move"], level: "beginner", gear: "Resistance bands", mins: 25,
    about: "For desk days, a stiff back and rounded shoulders: upper-back and core work that's kind to your spine.",
    link: "v1/t:Desk-Worker-Posture-and-Back"
      + "/mon:Upper-Back:bandrow.3x12-15,facepull.3x15-20,wallslide.2x10,curlup.2x6,birddog.2x8,doorway.2x45s"
      + "/wed:Hips-and-Core:glutebridge.3x12,deadbug.2x8,sideplank.2x20s,ytw.2x10,couch.2x45s"
      + "/fri:Pull-and-Core:bandpulldown.3x12-15,bandrow.3x12-15,curlup.2x6,birddog.2x8,sideplank.2x20s,crossbody.1x30s" },
  { id: "joint", photo: { img: "1660155002587-3b0efeeec64f", by: "Michael Faix", page: "z9VbZ4tM3Zc" }, goals: ["strong", "move"], level: "intermediate", gear: "Dumbbells and a bench", mins: 50,
    about: "The author's own week: an upper/lower split that protects the shoulders and knees, built around a football match.",
    link: null },   // the example plan (plan.js)
  { id: "mobility", photo: { img: "1758599879024-7379d769f664", by: "Vitaly Gariev", page: "EUk6LRg9alk" }, title: "Mobility and Recovery", goals: ["move"], level: "beginner", gear: "Bodyweight", mins: 20,
    about: "Short sessions to loosen stiff hips, back and shoulders. Good on rest days or on their own.",
    link: "v1/t:Mobility-and-Recovery"
      + "/wed:Mobility:hip9090.2x8,threadneedle.2x10,wallslide.2x10,couch.1x60s,pigeon.1x60s,hamstring.1x60s"
      + "/sat:Stretch:doorway.1x60s,crossbody.1x30s,tricepsstretch.1x30s,pigeon.1x60s,hamstring.1x60s,couch.1x60s" },
];
PROGRAMS.find((p) => p.id === "joint").link = EXAMPLE_PLAN.link;
