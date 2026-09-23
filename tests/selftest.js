/* Automated self-test. Open index.html?selftest (loaded only in that mode).

   Plays every session end to end on a virtual clock (time jumps straight to the
   next timer, so a 45-minute workout takes a second or two), with the voice clips
   and YouTube replaced by silent stand-ins. It "presses Done" whenever the coach
   has finished talking, then checks what was said on every step.

   Results: window.SELFTEST.report (short text) once window.SELFTEST.done is true.
   Run one part:  SELFTEST.run({ days: [1], previews: false })
*/
(() => {
  // ---- virtual clock -------------------------------------------------------------
  const rawTimeout = window.setTimeout.bind(window);
  let vnow = Date.now(), nextId = 1;
  const timers = new Map();
  Date.now = () => vnow;
  window.setTimeout = (f, ms = 0, ...a) => { const id = nextId++; timers.set(id, { at: vnow + Math.max(0, ms), f, a, every: 0 }); return id; };
  window.setInterval = (f, ms = 0, ...a) => { const id = nextId++; timers.set(id, { at: vnow + Math.max(1, ms), f, a, every: Math.max(1, ms) }); return id; };
  window.clearTimeout = window.clearInterval = (id) => timers.delete(id);
  const macrotask = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  let fired = 0;
  // Run the next due timer, then let promise callbacks settle
  async function step() {
    let id = null, t = null;
    for (const [k, v] of timers) if (!t || v.at < t.at) { id = k; t = v; }
    if (!t) { vnow += 100; await macrotask(); return; } // nothing scheduled: let time pass
    vnow = Math.max(vnow, t.at);
    if (t.every) t.at += t.every; else timers.delete(id);
    try { t.f(...t.a); } catch (e) { T.errors.push(e.message); }
    await Promise.resolve(); await Promise.resolve();
    if (++fired % 300 === 0) await macrotask(); // stay responsive
  }
  async function until(pred, maxSec) {
    const end = vnow + maxSec * 1000;
    while (!pred() && vnow < end) await step();
    return pred();
  }

  // ---- silent stand-ins --------------------------------------------------------
  const textById = Object.fromEntries(allPhrases().map((t) => [clipId(t), t]));
  const T = { said: [], overlaps: [], deviceSpeech: [], errors: [], playingUntil: 0 };
  voiceEl.play = function () {
    if (this.src.startsWith("data:")) return Promise.resolve();
    const id = this.src.split("/").pop().replace(".m4a", ""), dur = clipManifest[id] || 1;
    const now = Date.now();
    if (now < T.playingUntil - 50) T.overlaps.push(`step ${cur + 1}: "${textById[id]}"`);
    T.playingUntil = now + dur * 1000;
    T.said.push({ step: cur, text: textById[id] || "?" + id });
    const el = this, src = this.src;
    setTimeout(() => { if (el.src === src && T.playingUntil) { T.playingUntil = 0; el.onended && el.onended(); } }, dur * 1000);
    return Promise.resolve();
  };
  voiceEl.pause = () => { T.playingUntil = 0; };
  const rawSpeak = speechSynthesis.speak.bind(speechSynthesis);
  speechSynthesis.speak = (u) => { T.deviceSpeech.push(u.text); setTimeout(() => u.onend && u.onend(), 1500); };
  window.beep = () => {};
  window.addEventListener("error", (e) => T.errors.push(e.message));
  // YouTube: a player that always "plays"
  yt = { loadVideoById() {}, mute() {}, unMute() {}, setVolume() {}, playVideo() {}, pauseVideo() {}, stopVideo() {},
         seekTo() {}, isMuted: () => true, getPlayerState: () => 1 };
  ytReady = true;
  window.YT = { PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } };

  // ---- expectations ------------------------------------------------------------
  function expected(st, i) {
    const ex = EX[st.key], must = [], first = st.set === 1 && st.side !== "Right side";
    if (st.type === "rest") {
      must.push(SAY.rest(st.dur));
      if (st.dur >= 20) must.push(SAY.tenToGo());
      return must;
    }
    if (st.side === "Right side") must.push(SAY.switchSides());
    if (first) {
      must.push(SAY.name(st.key), SAY.key(st.key));
      const hold = ex.time;
      ex.cues.forEach((_, c) => {
        if (!hold) return must.push(SAY.cue(st.key, c));
        const every = Math.max(7, Math.min(25, (hold - 13) / ex.cues.length));
        if (3 + c * every < hold - 8) must.push(SAY.cue(st.key, c));
      });
    } else if (!st.warm && st.sets > 1 && st.side !== "Right side") must.push(SAY.setOf(st.set, st.sets));
    if (ex.time) { must.push(SAY.go()); if (ex.time >= 30) must.push(SAY.tenLeft()); }
    return must;
  }

  // ---- runners -----------------------------------------------------------------
  async function runSession(day, opts) {
    const fails = [];
    T.said = []; T.overlaps = []; T.deviceSpeech = []; T.errors = [];
    openDay(DAYS.indexOf(day));
    startWorkout(opts);
    const n = steps.length;
    let lastCur = -1, stepStart = 0;
    while ($("p-done").hidden) {
      await step();
      if (cur !== lastCur) { lastCur = cur; stepStart = Date.now(); }
      const st = steps[cur];
      if ((Date.now() - stepStart) / 1000 > 400) { fails.push(`step ${cur + 1} stuck`); go(1); continue; }
      // Rep-based steps wait for Done: press it once the coach has finished
      if (st && st.type === "work" && !EX[st.key].time && !coach.playing && !coach.queue.length && Date.now() - coach.lastEnd > 1500) go(1);
    }
    await until(() => false, 5);
    // what was said on each step
    steps.forEach((st, i) => {
      const said = T.said.filter((s) => s.step === i).map((s) => s.text);
      for (const m of expected(st, i)) if (!said.includes(m)) fails.push(`step ${i + 1} ${st.key || st.type}${st.set ? " set " + st.set : ""}${st.side ? " " + st.side : ""}: missing "${m}"`);
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
    for (const key of Object.keys(EX)) {
      T.said = []; T.overlaps = [];
      startPreview(key);
      const t = Date.now();
      await until(() => !coach.playing && !coach.queue.length, 120);
      const said = T.said.map((s) => s.text);
      const want = [SAY.name(key), SAY.key(key), ...EX[key].cues.map((_, c) => SAY.cue(key, c))];
      if (JSON.stringify(said) !== JSON.stringify(want)) fails.push(`preview ${key}: said ${said.length}/${want.length} lines or wrong order`);
      T.overlaps.forEach((o) => fails.push(`preview ${key} overlap ${o}`));
      exitPlayer();
      await until(() => false, 1);
      if (T.playingUntil) fails.push(`preview ${key}: voice kept playing after close`);
    }
    return { name: "Previews", steps: Object.keys(EX).length, lines: 0, fails };
  }

  // With the demo video's sound on, the coach must stay silent
  async function runVideoSoundRule() {
    const fails = [];
    demoSound = true; soundBlocked = false;
    T.said = [];
    openDay(1); startWorkout({ warm: false, cool: false, label: "video-sound" });
    await until(() => cur >= 4, 600);
    if (T.said.length) fails.push(`coach spoke ${T.said.length} lines while video sound was on`);
    // phone refused the video's sound -> video is silent -> coach should talk again
    soundBlocked = true; T.said = []; go(1);
    await until(() => T.said.length > 0, 60);
    if (!T.said.length) fails.push("coach stayed silent after the phone blocked video sound");
    demoSound = false; soundBlocked = false; exitPlayer();
    return { name: "Coach pauses for video sound", steps: 0, lines: 0, fails };
  }

  // Cues and controls must fit on screen at the current window size
  function layoutCheck() {
    const fails = [];
    openDay(0); startWorkout({ warm: true, cool: true, label: "layout" });
    for (const key of Object.keys(EX)) for (const set of [1, 2]) for (const side of [null, "Left side"]) {
      steps = [{ type: "work", key, set, sets: EX[key].sets || 1, side }]; cur = 0; renderStep();
      const items = [...document.querySelectorAll("#cues li")];
      const visible = items.filter((li) => getComputedStyle(li).display !== "none");
      const oneAtATime = visible.length === 1;
      items.forEach((li, i) => {
        if (oneAtATime) showCue(i);
        const c = $("info").querySelector(".controls").getBoundingClientRect(), p = $("info").getBoundingClientRect();
        if (c.bottom > p.bottom + 1) fails.push(`${key}: buttons pushed off screen`);
        if (oneAtATime && li.scrollHeight > li.parentElement.clientHeight + 2) fails.push(`${key} cue ${i + 1} cut off`);
      });
    }
    exitPlayer();
    return { name: `Layout ${innerWidth}×${innerHeight}`, steps: 0, lines: 0, fails: [...new Set(fails)] };
  }

  async function run({ days = DAYS.map((_, i) => i), previews = true, layout = true } = {}) {
    SELFTEST.done = false;
    const results = [];
    for (const i of days) {
      const day = DAYS[i];
      if (day.match) {
        results.push(await runSession(day, { warm: true, cool: false, label: "Thu pre-match" }));
        results.push(await runSession(day, { warm: false, cool: true, label: "Thu post-match" }));
      } else results.push(await runSession(day, { warm: true, cool: true, label: day.name.slice(0, 3) + " " + day.focus }));
    }
    if (previews) results.push(await runPreviews());
    if (previews) results.push(await runVideoSoundRule());
    if (layout) results.push(layoutCheck());
    const bad = results.filter((r) => r.fails.length);
    SELFTEST.report = [
      `SELFTEST ${bad.length ? "FAIL" : "PASS"} (${results.length} parts)`,
      ...results.map((r) => `${r.fails.length ? "✗" : "✓"} ${r.name}${r.steps ? ` · ${r.steps} steps` : ""}${r.lines ? ` · ${r.lines} lines` : ""}` +
        (r.fails.length ? "\n    " + r.fails.slice(0, 8).join("\n    ") + (r.fails.length > 8 ? `\n    …and ${r.fails.length - 8} more` : "") : "")),
    ].join("\n");
    SELFTEST.done = true;
    return SELFTEST.report;
  }

  window.SELFTEST = { run, layoutCheck, done: false, report: "" };
  if (!/[?&]selftest=manual\b/.test(location.search)) rawTimeout(() => run(), 300);
  window.SELFTEST.timers = timers;
})();
