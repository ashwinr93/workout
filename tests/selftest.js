/* Automated self-test. Open index.html?selftest (loaded only in that mode; ?selftest=manual waits for SELFTEST.run()).

   Plays every session end to end on a virtual clock (time jumps straight to the next timer,
   so a 45-minute workout takes well under a second), with the voice clips and YouTube
   replaced by silent stand-ins. It "presses Done" whenever the coach has finished talking,
   then checks what was said on every step. Also: sound-button scenarios and on-screen fit.

   Results: window.SELFTEST.report (short text; also shown on the page) once SELFTEST.done is true.
*/
(() => {
  /* ---------- virtual clock */
  const rawTimeout = window.setTimeout.bind(window);
  let vnow = Date.now(), nextId = 1;
  const timers = new Map();
  Date.now = () => vnow;
  window.setTimeout = (f, ms = 0, ...a) => { const id = nextId++; timers.set(id, { at: vnow + Math.max(0, ms), f, a, every: 0 }); return id; };
  window.setInterval = (f, ms = 0, ...a) => { const id = nextId++; timers.set(id, { at: vnow + Math.max(1, ms), f, a, every: Math.max(1, ms) }); return id; };
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);
  const macrotask = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  let fired = 0;
  async function step() {                       // run the next due timer, let promises settle
    let id = null, t = null;
    for (const [k, v] of timers) if (!t || v.at < t.at) { id = k; t = v; }
    if (!t) { vnow += 100; await macrotask(); return; }
    vnow = Math.max(vnow, t.at);
    if (t.every) t.at += t.every; else timers.delete(id);
    try { t.f(...t.a); } catch (e) { T.errors.push(e.message); }
    await Promise.resolve(); await Promise.resolve();
    if (++fired % 300 === 0) await macrotask();
  }
  async function until(pred, maxSec) { const end = vnow + maxSec * 1000; while (!pred() && vnow < end) await step(); return pred(); }
  const settle = (sec) => until(() => false, sec);

  /* ---------- silent stand-ins */
  const textById = Object.fromEntries(allPhrases().map((t) => [clipId(t), t]));
  const T = { said: [], overlaps: [], deviceSpeech: [], errors: [], playingUntil: 0 };
  Voice.el.play = function () {
    if (this.src.startsWith("data:")) return Promise.resolve();
    const id = this.src.split("/").pop().replace(".m4a", ""), dur = Voice.manifest[id] || 1;
    if (Date.now() < T.playingUntil - 50) T.overlaps.push(`step ${Workout.cur + 1}: "${textById[id]}"`);
    T.playingUntil = Date.now() + dur * 1000;
    T.said.push({ step: Workout.cur, text: textById[id] || "?" + id });
    const el = this, src = this.src;
    setTimeout(() => { if (el.src === src && T.playingUntil) { T.playingUntil = 0; el.onended && el.onended(); } }, dur * 1000);
    return Promise.resolve();
  };
  Voice.el.pause = () => { T.playingUntil = 0; };
  speechSynthesis.speak = (u) => { T.deviceSpeech.push(u.text); setTimeout(() => u.onend && u.onend(), 1500); };
  Beep.play = () => {};
  window.addEventListener("error", (e) => T.errors.push(e.message));

  // YouTube stand-in that behaves like an embedded player in a browser:
  //  - clips take FY.delay ms to start
  //  - FY.policy "block": unMute() is ignored (like iPhones / Firefox) until the user taps the
  //    video's own speaker (FY.userUnmute); after that the iframe may play sound for later clips
  window.YT = { PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } };
  const FY = { policy: "allow", delay: 300, state: -1, muted: true, activated: false, timer: null };
  const setState = (s) => { FY.state = s; Video.onState(s); };
  FY.userUnmute = () => { FY.activated = true; FY.muted = false; };
  FY.reset = (o = {}) => Object.assign(FY, { policy: "allow", delay: 300, muted: true, activated: false }, o);
  Video.yt = {
    loadVideoById() { clearTimeout(FY.timer); setState(-1); FY.timer = setTimeout(() => setState(1), FY.delay); },
    mute() { FY.muted = true; }, unMute() { if (FY.policy === "allow" || FY.activated) FY.muted = false; },
    isMuted: () => FY.muted, getPlayerState: () => FY.state,
    playVideo() { if (FY.state !== 1) { clearTimeout(FY.timer); FY.timer = setTimeout(() => setState(1), FY.delay); } },
    pauseVideo() { FY.state = 2; }, stopVideo() { clearTimeout(FY.timer); FY.state = 5; }, setVolume() {}, seekTo() {},
  };
  Video.ready = true;

  const openDay = (i) => UI.openDay(Plans.current.days[i]);
  const useSound = (mode) => { Sound.mode = mode; UI.soundButtons(); };

  /* ---------- what each step must say */
  function expected(st) {
    if (st.type === "rest") return [SAY.rest(st.dur), ...(st.dur >= 20 ? [SAY.tenToGo()] : [])];
    const hold = st.dose.time, vi = Workout.variantOf(st.key), must = [], first = st.set === 1 && st.side !== "Right side";
    if (st.side === "Right side") must.push(SAY.switchSides());
    const n = variant(st.key, vi).cues.length, every = hold && Math.max(7, Math.min(25, (hold - 13) / (n + 1)));
    const fits = (slot) => !hold || 3 + slot * every < hold - 8;
    if (first) {
      must.push(SAY.name(st.key, vi));
      for (let c = 0; c < n; c++) if (fits(c)) must.push(SAY.cue(st.key, c, vi));
      if (fits(n)) must.push(SAY.remember(), SAY.key(st.key, vi));        // the Focus closes the coaching
    } else {
      if (st.section !== "warm" && st.sets > 1 && st.side !== "Right side") must.push(SAY.setOf(st.set, st.sets));
      const secondVisit = (st.set === 2 && st.side !== "Right side") || (st.set === 1 && st.side === "Right side");
      if (secondVisit && (!hold || hold >= 30)) must.push(SAY.remember(), SAY.key(st.key, vi));   // Focus is the first reminder
    }
    if (first) must.push(SAY.target(st.dose));
    if (hold) { must.push(SAY.go()); if (hold >= 30) must.push(SAY.tenLeft()); }
    return must;
  }

  /* ---------- a whole session, pressing Done like a person would */
  async function runSession(day, opts) {
    const fails = [];
    Object.assign(T, { said: [], overlaps: [], deviceSpeech: [], errors: [] });
    FY.reset(); useSound("coach"); store.set("demos", {});
    UI.openDay(day); Workout.start(opts);
    const W = Workout, n = W.steps.length;
    let lastCur = -1, stepStart = 0;
    while ($("finished").hidden) {
      await step();
      if (W.cur !== lastCur) { lastCur = W.cur; stepStart = Date.now(); }
      const st = W.step();
      if ((Date.now() - stepStart) / 1000 > 400) { fails.push(`step ${W.cur + 1} stuck`); W.go(1); continue; }
      if (st.type === "work" && !st.dose.time && Voice.idle() && Date.now() - Voice.lastEnd > 1500) W.go(1);
    }
    await settle(5);
    W.steps.forEach((st, i) => {
      const said = T.said.filter((s) => s.step === i).map((s) => s.text);
      for (const m of expected(st)) if (!said.includes(m))
        fails.push(`step ${i + 1} ${st.key || st.type}${st.set ? ` set ${st.set}` : ""}${st.side ? ` ${st.side}` : ""}: missing "${m}"`);
    });
    if (!T.said.some((s) => s.text === SAY.done())) fails.push(`never said "${SAY.done()}"`);
    T.overlaps.forEach((o) => fails.push("overlap " + o));
    T.deviceSpeech.forEach((t) => fails.push(`no recording for "${t}"`));
    T.errors.forEach((e) => fails.push("JS error " + e));
    $("done-close").click();
    return { name: opts.label, steps: n, lines: T.said.length, fails };
  }

  async function runPreviews() {
    const fails = [];
    store.set("demos", {});
    for (const key of Object.keys(EX)) {
      T.said = []; T.overlaps = [];
      Workout.startPreview(key);
      await until(() => Voice.idle(), 120);
      const said = T.said.map((s) => s.text), want = [SAY.name(key, 0), ...variant(key, 0).cues.map((_, c) => SAY.cue(key, c, 0)), SAY.remember(), SAY.key(key, 0)];
      if (JSON.stringify(said) !== JSON.stringify(want)) fails.push(`preview ${key}: said ${said.length}/${want.length} lines or wrong order`);
      T.overlaps.forEach((o) => fails.push(`preview ${key} overlap ${o}`));
      Workout.exit(); await settle(1);
      if (T.playingUntil) fails.push(`preview ${key}: voice kept playing after close`);
    }
    return { name: "Previews", steps: Object.keys(EX).length, lines: 0, fails };
  }

  /* ---------- Coach / Video buttons and the video's own speaker, the way a person uses them */
  async function runSoundScenarios() {
    const fails = [], check = (ok, msg) => { if (!ok) fails.push(msg); };
    const saidSince = (n) => T.said.slice(n).map((x) => x.text);
    const on = (id) => $(id).classList.contains("on");
    const reset = async (mode, fy) => { Workout.exit(); FY.reset(fy); useSound(mode); Video.blocked = false; T.said = []; await settle(0.5); };
    const voiced = (k) => !!EX[k].videos[0].voice;
    const jumpTo = (key) => { Workout.cur = Workout.steps.findIndex((x) => x.key === key); Workout.render(); };
    check(!voiced("catcow") && voiced("revlungetwist") && voiced("inclinepress") && !voiced("sarow") && voiced("floorpress"),
      "test assumptions about which demos talk no longer hold (update the scenarios)");

    // 1. Every session starts with the coach, even if Video was chosen last time
    await reset("video");
    Workout.startPreview("catcow"); await settle(6);
    check(Sound.mode === "coach", "didn't start in Coach mode");
    check(saidSince(0).includes(SAY.name("catcow")), "coach silent on cat-cow preview");
    check(FY.muted, "video not muted in Coach mode");
    check(on("voice-btn") && !on("sound-btn"), "buttons don't show Coach on / Video off");

    // 2. Talking demo, tap Video: coach stops at once, video unmutes, buttons swap
    await reset("coach");
    Workout.startPreview("revlungetwist"); await settle(3);
    let n = T.said.length;
    $("sound-btn").click(); await settle(8);
    check(Sound.mode === "video" && !FY.muted, "tapping Video didn't unmute the video");
    check(T.said.length === n && !T.playingUntil, "coach kept talking after tapping Video");
    check(!on("voice-btn") && on("sound-btn"), "buttons don't show Video on / Coach off");

    // 3. Tap Coach: video mutes and the coach restarts this exercise right away
    n = T.said.length;
    $("voice-btn").click(); await settle(6);
    check(Sound.mode === "coach" && FY.muted, "tapping Coach didn't mute the video");
    check(saidSince(n).includes(SAY.name("revlungetwist")), "coach didn't restart the exercise when switched back on");

    // 4. Tap Coach again: silence; once more: talks again immediately
    $("voice-btn").click(); n = T.said.length; await settle(20);
    check(Sound.mode === "off" && T.said.length === n, "coach still talking after switching it off");
    check(!on("voice-btn") && !on("sound-btn"), "a button still shows on in Off mode");
    $("voice-btn").click(); await settle(6);
    check(saidSince(n).length > 0, "coach didn't talk after switching back on");

    // 5. Unmuting a talking demo with its own speaker counts as choosing Video
    n = T.said.length;
    FY.userUnmute(); await settle(4);
    check(Sound.mode === "video", "unmuting on the video didn't switch the app to Video");
    check(!T.playingUntil && T.said.length === n, "coach talked over a video unmuted from its own controls");

    // 6. Video mode on a silent demo: the coach speaks, the video stays muted
    await reset("coach");
    openDay(0); Workout.start({ warm: false, cool: false, label: "t" }); await settle(2);
    $("sound-btn").click(); await settle(2);
    n = T.said.length;
    jumpTo("sarow"); await settle(8);
    check(FY.muted, "silent demo was unmuted in Video mode");
    check(saidSince(n).includes(SAY.name("sarow")), "coach silent on a demo with no voice in Video mode");
    check(on("voice-btn") && $("sound-btn").classList.contains("idle"), "buttons don't show the coach filling in");
    jumpTo("floorpress"); await settle(4);
    check(!FY.muted && Sound.mode === "video", "Video mode didn't resume on the next demo with a voice");

    // 7. Phone blocks video sound: the app says so, never mutes on its own, coach stays quiet
    await reset("coach", { policy: "block" });
    openDay(0); Workout.start({ warm: false, cool: false, label: "t" }); await settle(2);
    $("sound-btn").click(); n = T.said.length; await settle(6);
    check(!$("video-hint").hidden, "no hint when the phone blocked the video's sound");
    check(Sound.mode === "video" && T.said.length === n, "coach talked in Video mode while video sound was blocked");
    FY.userUnmute(); await settle(2);
    check($("video-hint").hidden, "hint stayed after the user unmuted the video");
    jumpTo("floorpress"); await settle(3);
    check(!FY.muted && Sound.mode === "video", "video sound didn't carry over to the next exercise");

    // 8. Slow-starting clip in Video mode: the app must not mute it
    await reset("coach", { delay: 7000 });
    Workout.startPreview("armcircles"); $("sound-btn").click(); await settle(12);
    check(!FY.muted, "slow-loading clip got muted by the app");
    check(FY.state === 1, "slow clip never started");

    // 9. Coach switched on during a hold: no intro or "Go", only what's still ahead
    await reset("off");
    openDay(1); Workout.start({ warm: false, cool: false, label: "t" });
    jumpTo("planktaps");
    await until(() => Workout.timer.phase === "work" && Workout.timer.total - Workout.timer.left > 20, 60);
    n = T.said.length; $("voice-btn").click(); await settle(25);
    const late = saidSince(n);
    check(!late.includes(SAY.name("planktaps")) && !late.includes(SAY.go()), "intro/Go replayed when coach switched on mid-hold");
    check(late.includes(SAY.tenLeft()), "coach switched on mid-hold missed 'Ten seconds left'");

    // 10. Switching to a different variant (pigeon → figure-4): screen and coach follow, choice is remembered
    await reset("coach"); store.set("demos", {});
    Workout.startPreview("pigeon"); await settle(2);
    n = T.said.length; $("vid-next").click(); await settle(30);
    const fig = variant("pigeon", 1), pig = variant("pigeon", 0);
    check($("panel").querySelector(".name").textContent === fig.name, "name didn't switch to the figure-4 variant");
    check([...$("cues").children].map((li) => li.textContent).join("|") === fig.cues.join("|"), "cues on screen didn't switch to the figure-4 variant");
    const after = saidSince(n);
    check(after.includes(SAY.name("pigeon", 1)) && after.includes(SAY.cue("pigeon", 0, 1)), "coach didn't coach the figure-4 variant");
    check(!pig.cues.some((c, i) => !fig.cues.includes(c) && after.includes(SAY.cue("pigeon", i, 0))), "coach still read pigeon-only cues after switching to figure-4");
    Workout.exit(); await settle(0.5);
    Workout.startPreview("pigeon"); await settle(1);
    check(Video.idx === 1 && $("panel").querySelector(".name").textContent === fig.name, "the chosen variant wasn't remembered");
    store.set("demos", {});

    await reset("coach");
    return { name: "Sound buttons & video sound", steps: 10, lines: 0, fails };
  }

  /* ---------- the coaching panel fits the current window size: nothing overlaps, nothing needs
     scrolling, and the buttons sit at the bottom of the screen */
  function panelProblems(label) {
    const out = [], body = $("panel").querySelector(".panel-body"), controls = $("panel").querySelector(".controls");
    if (body.scrollHeight > body.clientHeight + 1) out.push(`${label}: doesn't fit (needs scrolling)`);
    const kids = [...body.children].filter((k) => k.offsetParent && k.getBoundingClientRect().height > 0);
    for (let a = 0; a < kids.length - 1; a++) {
      const r1 = kids[a].getBoundingClientRect(), r2 = kids[a + 1].getBoundingClientRect();
      if (r1.bottom > r2.top + 0.5) out.push(`${label}: ${kids[a].className || kids[a].tagName} overlaps ${kids[a + 1].className || kids[a + 1].tagName}`);
    }
    const cues = $("cues"), dots = $("dots");
    if (cues && dots && dots.offsetParent && cues.getBoundingClientRect().bottom > dots.getBoundingClientRect().top + 0.5) out.push(`${label}: cue text overlaps the dots`);
    if ($("player").getBoundingClientRect().bottom - controls.getBoundingClientRect().bottom > 40) out.push(`${label}: buttons aren't at the bottom of the screen`);
    return out;
  }
  function layoutCheck() {
    const fails = [];
    openDay(0); Workout.start({ warm: true, cool: true, label: "layout" });
    for (const key of Object.keys(EX)) for (let vi = 0; vi < EX[key].videos.length; vi++) for (const set of [1, 2]) for (const side of [null, "Left side"]) {
      store.set("demos", { [key]: vi }); Video.key = null;
      Workout.steps = [{ type: "work", key, set, sets: dose(key).sets, side, section: "main", dose: dose(key) }]; Workout.cur = 0; Workout.render();
      const items = [...$("cues").children], oneAtATime = items.filter((li) => getComputedStyle(li).display !== "none").length === 1;
      const name = $("panel").querySelector(".name");
      if (name.getBoundingClientRect().height > 2.5 * parseFloat(getComputedStyle(name).lineHeight || getComputedStyle(name).fontSize)) fails.push(`${key}: name wraps to 3+ lines`);
      items.forEach((_, i) => { if (oneAtATime) UI.showCue(i); fails.push(...panelProblems(`${key}${vi ? " (variant " + (vi + 1) + ")" : ""}${oneAtATime ? " cue " + (i + 1) : ""}`)); });
    }
    // previews also show the exercise's quick facts (level, equipment, joints)
    for (const key of Object.keys(EX)) for (let vi = 0; vi < EX[key].videos.length; vi++) {
      store.set("demos", { [key]: vi }); Video.key = null;
      Workout.steps = [{ type: "work", key, set: 1, sets: dose(key).sets, side: null, section: "main", dose: dose(key), preview: true }]; Workout.cur = 0; Workout.preview = true; Workout.render();
      const items = [...$("cues").children], oneAtATime = items.filter((li) => getComputedStyle(li).display !== "none").length === 1;
      items.forEach((_, i) => { if (oneAtATime) UI.showCue(i); fails.push(...panelProblems(`preview ${key}${vi ? " (variant " + (vi + 1) + ")" : ""}${oneAtATime ? " cue " + (i + 1) : ""}`)); });
    }
    Workout.preview = false;
    store.set("demos", {});
    // rest screens, with each exercise as "up next"
    for (const key of Object.keys(EX)) {
      Workout.steps = [{ type: "rest", dur: 90 }, { type: "work", key, set: 2, sets: 3, side: "Left side", section: "main", dose: dose(key) }]; Workout.cur = 0; Workout.render();
      fails.push(...panelProblems(`rest before ${key}`));
    }
    Workout.exit();
    // the day card's muscle key stays within the height of the figures beside it
    for (const p of PROGRAMS) parsePlan(p.link).plan.days.filter((d) => d.kind !== "activity").forEach((day) => {
      UI.openDay(day);
      const card = $("day-body").querySelector(".day-muscles"), key = card.querySelector(".muscle-groups").getBoundingClientRect(), fig = card.querySelector(".fig.full").getBoundingClientRect();
      if (key.height > fig.height + 1) fails.push(`${p.id} ${day.name}: the day card's muscle names run past the figures`);
    });
    return { name: `Layout ${innerWidth}×${innerHeight}`, steps: 0, lines: 0, fails: [...new Set(fails)] };
  }

  /* ---------- wording: every line must read well AND sound natural when spoken */
  function wordingCheck() {
    const fails = [];
    for (const [key, ex] of Object.entries(EX)) ex.videos.forEach((_, vi) => {
      const v = variant(key, vi);
      const texts = [["name", v.name], ["key", v.key], ["unit", ex.unit], ["stop", v.stop], ...v.cues.map((c, i) => [`cue ${i + 1}`, c])];
      for (const [field, t] of texts) {
        if (!t) continue;
        if (/[()]/.test(t)) fails.push(`${key} ${field}: bracketed aside (sounds odd when spoken): "${t}"`);
        if (field.startsWith("cue") && /^[A-Z][\w'’ -]{0,24}:/.test(t)) fails.push(`${key} ${field}: starts with a label; give the instruction plainly: "${t}"`);
        if (/\b[A-Z]{2,}\b/.test(t.replace(/\b(Y-T-W)\b/g, ""))) fails.push(`${key} ${field}: ALL-CAPS word: "${t}"`);
      }
    });
    return { name: "Wording", steps: 0, lines: 0, fails };
  }

  /* ---------- the muscle map: every exercise names its muscles, and both figures have every muscle */
  async function muscleCheck() {
    const fails = [], figures = {};
    for (const kind of ["male", "female"]) figures[kind] = await fetch(`figures/${kind}.json`).then((r) => r.json());
    for (const [kind, F] of Object.entries(figures)) {
      const names = new Set([...F.f.parts, ...F.b.parts].map((p) => p[0]));
      for (const m of Object.keys(MUSCLES)) if (!names.has(m)) fails.push(`${kind} figure has no "${m}"`);
    }
    for (const key of Object.keys(EX)) EX[key].videos.forEach((_, vi) => {
      const m = variant(key, vi).muscles, where = `${key}${vi ? ` (demo ${vi + 1})` : ""}`;
      if (!m?.main?.length) return fails.push(`${where}: no main muscles`);
      for (const n of [...m.main, ...m.help]) if (!MUSCLES[n]) fails.push(`${where}: unknown muscle "${n}"`);
      if (m.main.some((n) => m.help.includes(n))) fails.push(`${where}: a muscle is both main and helping`);
    });
    return { name: "Muscle map", steps: 0, lines: 0, fails };
  }

  /* ---------- what the AI knows about each exercise: movement, level, joints, easier/harder */
  function detailsCheck() {
    const fails = [], LEVELS = ["beginner", "intermediate"];
    for (const [key, ex] of Object.entries(EX)) {
      if (!TYPES[ex.type]) fails.push(`${key}: unknown type "${ex.type}"`);
      ex.videos.forEach((_, vi) => {
        const v = variant(key, vi), where = `${key}${vi ? ` (demo ${vi + 1})` : ""}`;
        if (!LEVELS.includes(v.level)) fails.push(`${where}: level must be beginner or intermediate`);
        for (const j of [...(v.easyOn || []), ...(v.loads || [])]) if (!JOINTS[j]) fails.push(`${where}: unknown joint "${j}"`);
        if (!Array.isArray(v.easyOn) || !Array.isArray(v.loads)) fails.push(`${where}: easyOn and loads must be lists`);
        else if (v.easyOn.some((j) => v.loads.includes(j))) fails.push(`${where}: a joint is both easy on and loaded`);
      });
      for (const [dir, back] of [["easier", "harder"], ["harder", "easier"]]) for (const other of ex[dir] || []) {
        if (!EX[other]) fails.push(`${key}.${dir}: no exercise "${other}"`);
        else if (WARMUP.includes(other) || WARMUP.includes(key)) fails.push(`${key}.${dir}: warm-ups aren't a progression`);
        else if (!(EX[other][back] || []).includes(key)) fails.push(`${key}.${dir} has ${other}, but ${other}.${back} doesn't have ${key}`);
      }
    }
    return { name: "Exercise details", steps: 0, lines: 0, fails };
  }

  /* ---------- Exercises tab and exercise pages */
  async function exercisesCheck() {
    const fails = [], check = (ok, msg) => { if (!ok) fails.push(msg); };
    for (const k of Object.keys(EX)) {
      if (!EX[k].gear?.length || EX[k].gear.some((g) => !GEAR[g])) fails.push(`${k}: gear must list kinds from GEAR`);
      if (!areasOf(k).length) fails.push(`${k}: main muscles fall in no body area`);
    }
    const F = UI.exFilter, keep = { ...F };
    UI.tab("exercises");
    check(!$("exercises").hidden && !$("tabbar").hidden, "Exercises tab didn't open with the tab bar");
    check(UI.exerciseMatches().length === Object.keys(EX).length, "with no filters, not every exercise is listed");
    Object.assign(F, { q: "", gear: "bodyweight", area: null });
    check(UI.exerciseMatches().every((k) => EX[k].gear.includes("bodyweight")), "Bodyweight shows exercises that need kit");
    Object.assign(F, { gear: "dumbbells" });
    const dbs = UI.exerciseMatches();
    check(dbs.includes("gobletsquat") && dbs.includes("bwsquat") && !dbs.includes("legpress"), "Dumbbells should show dumbbell and bodyweight exercises, not machines");
    Object.assign(F, { gear: "gym" });
    check(UI.exerciseMatches().length === Object.keys(EX).length, "Gym should show every exercise");
    Object.assign(F, { gear: null, q: "squat" });
    check(UI.exerciseMatches().includes("bbsquat") && !UI.exerciseMatches().includes("sarow"), "search for 'squat' is wrong");
    Object.assign(F, keep); UI.exerciseList();
    UI.tab("exercises");
    $("ex-results").querySelector('[data-ex="rdl"]').click(); await settle(1);
    check(!$("player").hidden && Workout.preview && Workout.step().key === "rdl", "tapping an exercise didn't play its preview");
    Workout.exit(); await settle(0.5);
    check(!$("exercises").hidden, "closing the preview didn't return to Exercises");
    UI.show("home");
    return { name: "Exercises tab", steps: 0, lines: 0, fails };
  }

  /* ---------- Plans tab: every ready-made plan is valid, browsing never changes your week */
  async function plansCheck() {
    const fails = [], check = (ok, msg) => { if (!ok) fails.push(msg); };
    for (const p of PROGRAMS) {
      const r = parsePlan(p.link);
      check(!r.problems.length && !r.fixes.length && r.plan?.link === p.link, `${p.id}: plan link isn't clean (${[...r.problems, ...r.fixes].join("; ")})`);
      check(p.goals.every((g) => GOALS[g]) && ["beginner", "intermediate"].includes(p.level), `${p.id}: goals or level missing`);
      check(p.photo?.img && p.photo.by && p.photo.page, `${p.id}: no card photo (with its photographer, for the README credits)`);
    }
    for (const k of [...Object.keys(GEAR), "stretch"]) {
      check(OWN_PHOTOS[k]?.img && OWN_PHOTOS[k].by && OWN_PHOTOS[k].page, `no photo for your own plans that use ${k}`);
    }
    const mine = Plans.current;
    Plans.none();
    check(!$("plans").hidden && !$("tabbar").hidden, "with no plan, the app didn't start on Plans");
    UI.show("home"); check(!$("week-empty").hidden, "My week with no plan doesn't say so");
    UI.tab("plans");
    check($("plans-list").querySelectorAll('.plan-tile[data-id]:not([data-id^="own-"])').length === PROGRAMS.length, "Plans doesn't list every plan");
    check(!!$("plans-list").querySelector(".create-tile"), "no create-your-own card at the end of Plans");
    UI.goal = "lose"; UI.plans();
    check([...$("plans-list").querySelectorAll(".plan-tile[data-id]")].every((b) => PROGRAMS.find((p) => p.id === b.dataset.id).goals.includes("lose")), "goal filter shows other goals");
    UI.goal = null; UI.plans();
    Plans.use(null);                                           // a week to compare against
    $("pc-switch").click();
    check(!$("plans").hidden, "My week's Switch plan didn't open Plans");
    const before = Plans.current.link;
    UI.tab("plans"); UI.planView("gym-first");
    check(Plans.current.link === before, "opening a plan's preview changed your week");
    $("plan-view-back").click();
    check(!$("plans").hidden && Plans.current.link === before, "backing out of a preview changed your week");
    UI.planView("gym-first"); $("plan-start").click();
    check(!$("plan-confirm").hidden, "starting a plan over your week didn't ask first");
    $("plan-confirm-no").click();
    check(Plans.current.link === before && $("plan-confirm").hidden, "Keep didn't keep your week");
    $("plan-start").click(); $("plan-confirm-yes").click();
    check(Plans.current.title === "Gym First Steps" && !$("home").hidden, "Start this plan didn't make it your week");
    UI.planView("gym-first");
    check($("plan-start").disabled, "your own week's preview still offers to start it");
    $("plan-view-body").querySelector("[data-day]").click();
    check(!$("day").hidden && Workout.day?.name === "Legs and Push", "tapping a day in a plan didn't open that day");
    $("day-body").querySelector(".ex-row[data-r]").click(); await settle(1);
    check(!$("player").hidden && Workout.step().preview, "tapping an exercise on a plan's day didn't play its preview");
    Workout.exit(); await settle(0.5);
    check(!$("day").hidden, "closing the preview didn't return to the day");
    $("day-back").click();
    check(!$("plan-view").hidden, "back from a plan's day didn't return to the plan");
    // a plan you made with AI gets the same card, under Your plans, with a photo that fits its kit
    Plans.use(parsePlan(USER_PLAN).plan); UI.tab("plans");
    const own = $("plans-list").querySelector('.plan-tile[data-id^="own-"]');
    check(own?.querySelector(".mine") && own.querySelector(".plan-photo")?.src.includes("images.unsplash.com"), "your own plan has no card (with a photo) under Your plans");
    own?.click();
    check(!$("plan-view").hidden && $("plan-start").disabled, "your own plan's card doesn't open its preview");
    if (mine) Plans.use(mine.example ? null : mine); else Plans.use(null);
    return { name: "Plans tab", steps: PROGRAMS.length, lines: 0, fails: fails.filter(Boolean) };
  }

  /* ---------- plan links, the AI message, and a recording for everything a plan can ask for */
  function planCheck() {
    const fails = [], check = (ok, msg) => { if (!ok) fails.push(msg); };
    const ex = parsePlan(EXAMPLE_PLAN.link);
    check(!ex.problems.length && !ex.fixes.length, `example plan link has problems: ${[...ex.problems, ...ex.fixes].join("; ")}`);
    check(ex.plan?.link === EXAMPLE_PLAN.link, "example plan link doesn't come back unchanged");
    check(ex.plan?.days.map((d) => d.kind).join() === "workout,workout,workout,activity,workout,workout,stretch", "example plan's days aren't Mon–Sun with Thursday an activity and Sunday stretches");
    // forgiving: spaces, case, near-miss names, odd numbers
    const loose = parsePlan(`${SITE}#V1/t:My Plan/Monday:Leg Day: Box-Squat.3x9–11, sarow.9x25, planktaps.3x33, rdl.3x10s/wed:walk.32m`);
    check(!loose.problems.length, `forgiving link reported problems: ${loose.problems.join("; ")}`);
    const mon = loose.plan?.days[0], items = mon?.items || [];
    check(loose.plan?.title === "My Plan" && mon?.name === "Leg Day", "titles with spaces weren't read");
    check(items[0]?.key === "boxsquat" && items[0]?.reps === "8–10", "near-miss name or odd range wasn't fixed");
    check(items[1]?.sets === 5 && items[1]?.reps === "20", "too many sets/reps weren't brought into range");
    check(items[2]?.time === 35, "a hold wasn't rounded to 5 seconds");
    check(items[3]?.reps === EX.rdl.reps, "seconds on a rep exercise didn't fall back to its reps");
    check(loose.plan?.days[1]?.kind === "activity" && loose.plan.days[1].activity.mins === 30, "activity minutes weren't read");
    // what can't be fixed is reported
    const bad = parsePlan("v1/t:X/mon:A:bulgariansplitsquat.3x8,sarow.3x10/tue:B:walk.30m,sarow.3x10/fun:C:sarow/mon:D:rdl");
    check(bad.problems.length === 4, `expected 4 problems, got ${bad.problems.length}: ${bad.problems.join("; ")}`);
    check(bad.plan?.days.length === 2, "the usable days of a link with problems weren't kept");
    check(parsePlan("").plan === null && parsePlan("").problems.length === 1, "an empty link wasn't reported");
    check(parsePlan("v2/t:X/mon:A:sarow").problems.some((p) => /newer version/.test(p)), "a newer link version wasn't reported");
    // the AI message lists every exercise, and its example link is valid
    const prompt = coachPrompt(), exampleLink = prompt.match(/^Example:\n(\S+)/m)?.[1];
    for (const k of Object.keys(EX)) if (!WARMUP.includes(k)) check(new RegExp(`^${k} - `, "m").test(prompt), `the AI message doesn't list ${k}`);
    const exP = parsePlan(exampleLink || "");
    check(exampleLink && !exP.problems.length && !exP.fixes.length, `the AI message's example link isn't valid: ${[...exP.problems, ...exP.fixes].join("; ")}`);
    check(coachPrompt(EXAMPLE_PLAN.link).includes(EXAMPLE_PLAN.link), "the change-my-plan message doesn't include the plan");
    // every phrase any plan can make the coach say is recorded
    const missing = allPhrases().filter((t) => !Voice.manifest[clipId(t)]);
    missing.slice(0, 5).forEach((t) => fails.push(`no recording for "${t}"`));
    if (missing.length > 5) fails.push(`…and ${missing.length - 5} more phrases with no recording`);
    return { name: "Plan links & AI message", steps: 0, lines: 0, fails };
  }
  // A plan that isn't the example: other amounts, every newer exercise, a stretch day and an activity day
  const USER_PLAN = "v1/t:Test-Plan/mon:Full-Body:sarow.4x6-8,planktaps.2x20s,suitcase.2x60,boxsquat.5x15-20,couch.1x15s/tue:Batch-1-A:bwsquat.3x10,gobletsquat.2x8-10,splitsquat.2x8,inclinepushup.2x10,pushup.2x8,bandpulldown.2x12-15"
    + "/wed:Walk:walk.30m/thu:Batch-1-B:bandrow.2x12,glutebridge.2x12,deadbug.2x8,birddog.2x8,sideplank.2x30s,wallslide.2x10"
    + "/fri:Batch-2:legpress.2x10,latpulldown.2x10-12,cablerow.2x10,chestpress.2x10,bbsquat.2x6-8,deadlift.2x5,benchpress.2x6-8,ohp.2x6-8,bbrow.2x8-10"
    + "/sat:Stretch:pigeon.2x30s,hamstring.1x15s";

  async function run({ days = Plans.current.days.map((_, i) => i), previews = true, layout = true } = {}) {
    SELFTEST.done = false;
    Plans.use(null);                                            // the example plan (nothing saved in test mode)
    const results = [];
    const safely = async (name, f) => { try { return await f(); } catch (e) { return { name, steps: 0, lines: 0, fails: ["test crashed: " + e.message] }; } };
    await Figure.load();                                        // badges and figures are part of the layout
    results.push(wordingCheck());
    results.push(await safely("Muscle map", muscleCheck));
    results.push(await safely("Exercise details", async () => detailsCheck()));
    results.push(await safely("Exercises tab", exercisesCheck));
    results.push(await safely("Plans tab", plansCheck));
    results.push(await safely("Plan links & AI message", async () => planCheck()));
    const sessions = async (plan, which) => {
      for (const i of which) {
        const day = plan.days[i], name = `${DAY_NAMES[day.d].slice(0, 3)} ${day.name}`;
        if (day.kind === "activity") {
          results.push(await safely(`${name} warm-up`, () => runSession(day, { warm: true, cool: false, label: `${name} warm-up` })));
          results.push(await safely(`${name} cool-down`, () => runSession(day, { warm: false, cool: true, label: `${name} cool-down` })));
        } else results.push(await safely(name, () => runSession(day, { warm: true, cool: true, label: name })));
      }
    };
    await sessions(Plans.current, days);
    if (days.length) {
      const user = parsePlan(USER_PLAN).plan;
      await sessions(user, user.days.map((_, i) => i).filter((i) => user.days[i].kind !== "activity"));
    }
    if (previews) for (const p of PROGRAMS.filter((x) => x.link !== EXAMPLE_PLAN.link)) {   // every ready-made plan plays
      const plan = parsePlan(p.link).plan;
      await sessions(plan, plan.days.map((_, i) => i).filter((i) => plan.days[i].kind !== "activity"));
    }
    if (previews) {
      results.push(await safely("Previews", runPreviews));
      results.push(await safely("Sound buttons & video sound", runSoundScenarios));
    }
    if (layout) results.push(await safely("Layout", async () => layoutCheck()));
    const bad = results.filter((r) => r.fails.length);
    SELFTEST.report = [`SELFTEST ${bad.length ? "FAIL" : "PASS"} (${results.length} parts)`,
      ...results.map((r) => `${r.fails.length ? "✗" : "✓"} ${r.name}${r.steps ? ` · ${r.steps} steps` : ""}${r.lines ? ` · ${r.lines} lines` : ""}`
        + (r.fails.length ? "\n    " + r.fails.slice(0, 8).join("\n    ") + (r.fails.length > 8 ? `\n    …and ${r.fails.length - 8} more` : "") : "")),
    ].join("\n");
    SELFTEST.done = true;
    let box = document.getElementById("selftest-report");       // visible on devices without a console
    if (!box) {
      box = Object.assign(document.createElement("pre"), { id: "selftest-report" });
      box.style.cssText = "position:fixed;inset:0;z-index:9999;margin:0;padding:16px;overflow:auto;background:#000;color:#fff;font:13px/1.4 monospace;white-space:pre-wrap";
      document.body.appendChild(box);
    }
    box.textContent = SELFTEST.report;
    return SELFTEST.report;
  }

  window.SELFTEST = { run, layoutCheck, wordingCheck, planCheck, detailsCheck, done: false, report: "", timers };
  if (QUERY.get("selftest") !== "manual") rawTimeout(() => run(), 300);
})();
