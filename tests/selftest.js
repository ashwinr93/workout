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
  // YouTube stand-in that behaves like a browser-embedded player:
  //  - clips take FY.delay ms to start
  //  - FY.policy "block": unMute() is ignored (like iPhones / Firefox) until the user taps the
  //    video's own speaker (FY.userUnmute), after which the iframe may play sound for later clips
  window.YT = { PlayerState: { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } };
  const FY = { policy: "allow", delay: 300, state: -1, muted: true, activated: false, timer: null };
  const setState = (d) => { FY.state = d; onVideoState({ data: d }); };
  FY.userUnmute = () => { FY.activated = true; FY.muted = false; };
  FY.userMute = () => { FY.muted = true; };
  FY.reset = (o = {}) => Object.assign(FY, { policy: "allow", delay: 300, muted: true, activated: false }, o);
  yt = {
    loadVideoById() { clearTimeout(FY.timer); setState(-1); FY.timer = setTimeout(() => setState(1), FY.delay); },
    mute() { FY.muted = true; },
    unMute() { if (FY.policy === "allow" || FY.activated) FY.muted = false; },
    isMuted: () => FY.muted, getPlayerState: () => FY.state,
    playVideo() { if (FY.state !== 1) { clearTimeout(FY.timer); FY.timer = setTimeout(() => setState(1), FY.delay); } },
    pauseVideo() { FY.state = 2; }, stopVideo() { clearTimeout(FY.timer); FY.state = 5; },
    setVolume() {}, seekTo() {},
  };
  ytReady = true;

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
    FY.reset(); audioMode = "coach"; voiceOn = true; demoSound = false;
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

  // The Coach / Video buttons and the video's own speaker, the way a person uses them
  async function runAudioScenarios() {
    const fails = [], check = (ok, msg) => { if (!ok) fails.push(msg); };
    const saidSince = (n) => T.said.slice(n).map((x) => x.text);
    const btnOn = (id) => $(id).classList.contains("on");
    const settle = (sec) => until(() => false, sec);
    const clickBtn = (id) => $(id).click();
    const reset = async (mode, fy) => {
      exitPlayer(); FY.reset(fy); audioMode = mode; voiceOn = mode === "coach"; demoSound = mode === "video"; soundBlocked = false;
      T.said = []; await settle(0.5);
    };

    // 1. Coach mode: a preview speaks straight away and the video stays muted
    await reset("coach");
    startPreview("catcow"); await settle(6);
    check(saidSince(0).includes(SAY.name("catcow")), "coach silent on cat-cow preview in Coach mode");
    check(FY.muted, "video not muted in Coach mode");
    check(btnOn("voice-btn") && !btnOn("sound-btn"), "buttons don't show Coach on / Video off");

    // 2. Tap Video: coach stops at once, video unmutes, buttons swap
    let n = T.said.length;
    clickBtn("sound-btn"); await settle(8);
    check(audioMode === "video", "tapping Video didn't switch to video");
    check(!FY.muted, "video still muted after tapping Video");
    check(T.said.length === n && !T.playingUntil, "coach kept talking after tapping Video");
    check(!btnOn("voice-btn") && btnOn("sound-btn"), "buttons don't show Video on / Coach off");

    // 3. Tap Coach while video is on: video mutes and the coach restarts this exercise right away
    n = T.said.length;
    clickBtn("voice-btn"); await settle(6);
    check(audioMode === "coach" && FY.muted, "tapping Coach didn't mute the video / switch to coach");
    check(saidSince(n).includes(SAY.name("catcow")), "coach didn't restart the current exercise when switched back on");

    // 4. Tap Coach again: silence; tap once more: talks again immediately
    clickBtn("voice-btn"); n = T.said.length; await settle(20);
    check(audioMode === "off" && T.said.length === n, "coach still talking after switching it off");
    check(!btnOn("voice-btn") && !btnOn("sound-btn"), "a button still shows on in Off mode");
    clickBtn("voice-btn"); await settle(6);
    check(saidSince(n).length > 0, "coach didn't talk after switching back on mid-exercise");

    // 5. Unmuting with the video's own speaker counts as choosing Video; coach goes quiet
    n = T.said.length;
    FY.userUnmute(); await settle(4);
    check(audioMode === "video", "unmuting on the video didn't switch the app to Video");
    check(!T.playingUntil && T.said.length === n, "coach talked over a video unmuted from its own controls");

    // 6. Phone blocks video sound: app says so, never mutes on its own, coach stays quiet
    await reset("video", { policy: "block" });
    openDay(1); startWorkout({ warm: false, cool: false, label: "t" }); await settle(6);
    check(!$("video-hint").hidden, "no hint when the phone blocked the video's sound");
    check(audioMode === "video" && T.said.length === 0, "coach talked in Video mode while video sound was blocked");
    // ...the user taps the video's speaker; the next exercise keeps its sound
    FY.userUnmute(); await settle(2);
    check($("video-hint").hidden, "hint stayed after the user unmuted the video");
    go(1); go(1); await settle(3);
    check(!FY.muted && audioMode === "video", "video sound didn't carry over to the next exercise");

    // 7. Slow-starting clip in Video mode: the app must not mute it
    await reset("video", { delay: 7000 });
    startPreview("armthread"); await settle(12);
    check(!FY.muted, "slow-loading clip got muted by the app");
    check(FY.state === 1, "slow clip never started");

    // 8. Coach switched on during a hold: no intro or "Go", only what's still ahead
    await reset("off");
    openDay(1); startWorkout({ warm: false, cool: false, label: "t" });
    cur = steps.findIndex((x) => x.key === "planktaps"); renderStep();
    await until(() => timer.phase === "work" && timer.total - timer.left > 20, 60);
    n = T.said.length; clickBtn("voice-btn"); await settle(25);
    const late = saidSince(n);
    check(!late.includes(SAY.name("planktaps")) && !late.includes(SAY.go()), "intro/Go replayed when coach switched on mid-hold");
    check(late.includes(SAY.tenLeft()), "coach switched on mid-hold missed 'Ten seconds left'");

    await reset("coach");
    return { name: "Sound buttons & video sound", steps: 8, lines: 0, fails };
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
    const safely = async (name, f) => { try { return await f(); } catch (e) { return { name, steps: 0, lines: 0, fails: ["test crashed: " + e.message] }; } };
    if (previews) results.push(await safely("Previews", runPreviews));
    if (previews) results.push(await safely("Sound buttons & video sound", runAudioScenarios));
    if (layout) results.push(layoutCheck());
    const bad = results.filter((r) => r.fails.length);
    SELFTEST.report = [
      `SELFTEST ${bad.length ? "FAIL" : "PASS"} (${results.length} parts)`,
      ...results.map((r) => `${r.fails.length ? "✗" : "✓"} ${r.name}${r.steps ? ` · ${r.steps} steps` : ""}${r.lines ? ` · ${r.lines} lines` : ""}` +
        (r.fails.length ? "\n    " + r.fails.slice(0, 8).join("\n    ") + (r.fails.length > 8 ? `\n    …and ${r.fails.length - 8} more` : "") : "")),
    ].join("\n");
    SELFTEST.done = true;
    // show the report on the page too (for devices where there's no console, e.g. the iPhone simulator)
    let box = document.getElementById("selftest-report");
    if (!box) { box = document.createElement("pre"); box.id = "selftest-report"; box.setAttribute("aria-label", "selftest report");
      box.style.cssText = "position:fixed;inset:0;z-index:9999;margin:0;padding:16px;overflow:auto;background:#000;color:#fff;font:13px/1.4 monospace;white-space:pre-wrap";
      document.body.appendChild(box); }
    box.textContent = SELFTEST.report;
    return SELFTEST.report;
  }

  window.SELFTEST = { run, layoutCheck, done: false, report: "" };
  if (!/[?&]selftest=manual\b/.test(location.search)) rawTimeout(() => run(), 300);
  window.SELFTEST.timers = timers;
})();
