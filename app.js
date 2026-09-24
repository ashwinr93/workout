/* Workout player — app
 *
 * Parts (each owns its own state):
 *   Diag       rolling diagnostics log (Home → Diagnostics)
 *   Beep       countdown beeps
 *   Voice      the coach: pre-recorded clips (audio/*.m4a), played in order on a schedule
 *   Video      the YouTube demo player
 *   Sound      which one talks — the coach, the demo video, or neither
 *   Narration  what the coach says on each step, and when
 *   Workout    the session: steps, timer, moving between steps
 *   Plans      which plan is open: from the link, the last one used on this device, or the example
 *   UI         rendering the screens
 * Data lives in library.js (exercises), plan.js (plan links), speech.js (what the coach says)
 * and prompt.js (the message that has an AI chat write a plan).
 */
"use strict";

/* ============================================================ utilities */
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = (sec) => { sec = Math.max(0, Math.round(sec)); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`; };
const QUERY = new URLSearchParams(location.search);
const TEST_MODE = QUERY.has("selftest");
const store = {
  get(k, fallback) { try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
// Copy text from inside a tap; falls back to a hidden text box where the clipboard API is missing
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  const t = Object.assign(document.createElement("textarea"), { value: text });
  t.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(t); t.select();
  let ok = false; try { ok = document.execCommand("copy"); } catch {}
  t.remove(); return ok;
}

/* ============================================================ Diag */
const Diag = {
  lines: store.get("diag", []),
  saveTimer: null,
  log(...parts) {
    const text = parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join(" ");
    this.lines.push(`${new Date().toTimeString().slice(0, 8)} ${text}`);
    if (this.lines.length > 500) this.lines.splice(0, this.lines.length - 500);
    if (TEST_MODE) return;                      // test runs never touch the saved log
    clearTimeout(this.saveTimer);               // write at most about once a second
    this.saveTimer = setTimeout(() => store.set("diag", this.lines), 1000);
  },
  clear() { this.lines.length = 0; store.set("diag", []); },
};
const log = (...parts) => Diag.log(...parts);
window.addEventListener("error", (e) => log("JS error:", e.message, `${(e.filename || "").split("/").pop()}:${e.lineno}`));

/* ============================================================ Beep */
const Beep = {
  ctx: null,
  wake() {
    // Let sound play even with the iPhone's silent switch on (Safari 16.4+)
    try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch {}
    try { this.ctx ||= new (window.AudioContext || window.webkitAudioContext)(); this.ctx.resume(); } catch {}
  },
  play(freq = 880, dur = 0.14, vol = 0.18) {
    try {
      this.ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      const o = this.ctx.createOscillator(), g = this.ctx.createGain(), t = this.ctx.currentTime;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);                 // soft attack and release: no clicks
      g.gain.linearRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur);
    } catch {}
  },
  tick: () => Beep.play(660), go: () => Beep.play(1320, 0.25), done: () => Beep.play(1320, 0.1),
};

/* ============================================================ Voice (the coach)
   Every phrase is pre-recorded (audio/<clipId>.m4a, see tools/make_audio.py) and played
   through one <audio> element; iPhones allow that once it has been started by a tap.
   A plan is a list of lines, each { texts, cue?, at? (s after step start) | when? (fn),
   gap? (s after the previous line), late? (s it may run late before being dropped) }. */
const SILENCE = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
const Voice = {
  el: new Audio(),
  manifest: {},                                   // clipId → seconds
  unlocked: false,
  fetched: new Set(),
  gen: 0, queue: [], playing: false, lastEnd: 0, stepT0: 0, safety: null,

  load() {
    this.el.preload = "auto";
    return fetch("audio/manifest.json").then((r) => r.json())
      .then((m) => { this.manifest = m; log("voice clips loaded:", Object.keys(m).length); })
      .catch((e) => log("voice clips NOT loaded:", e.message));
  },
  url: (text) => `audio/${clipId(text)}.m4a`,

  // Must run inside a tap; afterwards clips can play on their own
  unlock() {
    Beep.wake();
    if (!this.playing) this.el.src = SILENCE;       // mid-sentence: just resume the current clip
    const p = this.el.play();
    if (p && p.then) p.then(() => { this.unlocked = true; }, (e) => {
      this.unlocked = e.name === "AbortError";      // a real clip replaced the silence: playback is allowed
      if (!this.unlocked) log("voice unlock failed:", e.name);
    });
  },
  // Warm the cache with this step's clips so each line starts instantly
  prefetch(lines) {
    if (TEST_MODE) return;
    for (const line of lines) for (const text of line.texts) {
      const url = this.url(text);
      if (!this.fetched.has(url) && this.manifest[clipId(text)]) { this.fetched.add(url); fetch(url).catch(() => {}); }
    }
  },

  reset() {
    this.gen++; this.queue = []; this.playing = false; clearTimeout(this.safety);
    try { this.el.pause(); } catch {}
    try { speechSynthesis.cancel(); } catch {}
  },
  plan(lines) {
    this.reset();
    this.stepT0 = this.lastEnd = Date.now();
    this.queue = lines.filter((l) => l && l.texts.length);
    this.prefetch(this.queue);
  },
  sayNow(texts) { this.plan([{ texts, gap: 0 }]); this.tick(); },
  idle() { return !this.playing && !this.queue.length; },

  // Called every tick: start the next line when it's due
  tick() {
    if (!Sound.coachSpeaks() || !this.queue.length) return;
    const line = this.queue[0], now = Date.now();
    const due = line.when ? line.when() : (now - this.stepT0) / 1000 >= (line.at || 0);
    if (due && !line.dueAt) line.dueAt = now;
    if (!due || this.playing || now - this.lastEnd < (line.gap ?? 0.6) * 1000) return;
    this.queue.shift();
    // Time-critical lines ("Go", "Ten seconds left") are dropped rather than said late
    if (line.late != null && (now - line.dueAt) / 1000 > line.late) return;
    this.speak(line);
  },
  speak(line) {
    const gen = this.gen;
    this.playing = true;
    if (line.cue != null) UI.showCue(line.cue, true);
    let i = 0;
    const next = () => {
      if (gen !== this.gen) return;
      if (i >= line.texts.length) { this.playing = false; this.lastEnd = Date.now(); return; }
      const text = line.texts[i++];
      this.playClip(text, () => setTimeout(next, i < line.texts.length ? 250 : 0), gen);
    };
    next();
  },
  playClip(text, done, gen) {
    let finished = false;
    const finish = () => { if (finished || gen !== this.gen) return; finished = true; clearTimeout(this.safety); done(); };
    const dur = this.manifest[clipId(text)];
    if (!dur) { log("no recording, device voice:", text); return this.deviceSpeak(text, finish); }
    this.el.onended = finish;
    this.el.src = this.url(text);
    const p = this.el.play();
    if (p && p.then) p.then(() => { this.unlocked = true; log("said:", text.slice(0, 50)); }, (e) => {
      log("clip blocked:", e.name, text.slice(0, 30));
      if (e.name === "NotAllowedError") { this.unlocked = false; finish(); }
      else if (e.name === "AbortError") finish();
      else this.deviceSpeak(text, finish);        // this file can't play here: use the device voice
    });
    this.safety = setTimeout(finish, (dur + 4) * 1000);   // one clip must never stall the coach
  },
  deviceSpeak(text, done) {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.onend = u.onerror = done;
      speechSynthesis.speak(u);
      this.safety = setTimeout(done, 12000);
    } catch { done(); }
  },
};
// If the phone ever revokes playback (e.g. after leaving the app), the next tap re-enables it
document.addEventListener("click", () => { if (!Voice.unlocked) Voice.unlock(); }, true);

/* ============================================================ Video (YouTube demos)
   Browsers (iPhones especially) may refuse sound until the video itself is tapped. When that
   happens the demo keeps playing muted and we ask for a tap; the app never mutes on a guess. */
const Video = {
  yt: null, ready: false, active: false,
  key: null, list: [], idx: 0, tried: new Set(), pending: null,
  blocked: false, lastMuteCall: 0, stallTimer: null, soundTimer: null,

  load() {
    if (TEST_MODE) return;                        // the self-test supplies its own player
    window.onYouTubeIframeAPIReady = () => this.create();
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  },
  create() {
    this.yt = new YT.Player("yt", {
      playerVars: { autoplay: 1, mute: 1, playsinline: 1, controls: 1, rel: 0, modestbranding: 1, iv_load_policy: 3,
        disablekb: 1, fs: 0, cc_load_policy: 1, cc_lang_pref: "en", hl: "en" },
      events: {
        onReady: () => { this.ready = true; this.applySound(); if (this.pending && this.active) this.play(this.pending); this.pending = null; },
        onStateChange: (e) => this.onState(e.data),
        onError: (e) => { log("video error", e.data, this.current()?.id); this.onError(); },
      },
    });
  },
  onState(state) {
    const S = YT.PlayerState;
    log("video", this.current()?.id, ["unstarted", "ended", "playing", "paused", "buffering", "", "cued"][state + 1] ?? state, "muted:", this.yt.isMuted());
    if (!this.active) { if (state === S.PLAYING || state === S.BUFFERING) this.yt.pauseVideo(); return; }
    if (state === S.ENDED) this.restart();                       // demos loop
    if (state === S.CUED) this.yt.playVideo();
    if (state === S.PLAYING) { clearTimeout(this.stallTimer); if (!this.blocked) this.hint(null); this.watchSound(); }
  },

  current() { return this.list[this.idx]; },
  talks() { return !!this.current()?.voice; },

  // The demo you last chose for this exercise (remembered across sessions)
  preferred(key) { const i = store.get("demos", {})[key] || 0; return i < EX[key].videos.length ? i : 0; },
  // The exercise's demo, kept running across its sets
  showExercise(key) {
    if (this.key === key) return;
    this.key = key; this.list = EX[key].videos; this.tried = new Set();
    this.show(this.preferred(key));
  },
  // ‹ › : another demo; if it's a different variant, the screen and coach switch to it
  choose(i) {
    if (this.list.length < 2) return;
    const before = this.idx;
    this.show(i);
    store.set("demos", { ...store.get("demos", {}), [this.key]: this.idx });
    if (isVariant(this.list[before]) || isVariant(this.current())) Workout.variantChanged();
  },
  show(i) {
    this.idx = (i + this.list.length) % this.list.length;
    this.tried.add(this.idx);
    UI.demoNav(); UI.soundButtons();
    this.play(this.current());
    // Switched to a silent demo in Video mode with nothing left to say: the coach picks up
    if (Sound.mode === "video" && !this.talks() && Voice.idle()) Narration.resume();
  },
  play(v) {
    if (!this.active) return;
    if (!this.ready) { this.pending = v; return; }
    $("video-fallback").hidden = true;
    this.yt.loadVideoById({ videoId: v.id, startSeconds: v.start || 0, endSeconds: v.end || undefined });
    this.applySound();
    if (!this.blocked) this.hint(null);
    this.watchStall();
  },
  restart() { const v = this.current(); if (this.ready && v) { this.yt.seekTo(v.start || 0, true); this.yt.playVideo(); } },
  onError() {
    const untried = this.list.findIndex((_, i) => !this.tried.has(i));
    if (untried >= 0) return this.show(untried);
    $("video-fallback").innerHTML = `<div>This demo can't play here.</div><a href="https://www.youtube.com/watch?v=${this.current().id}" target="_blank" rel="noopener">Open it on YouTube ↗</a>`;
    $("video-fallback").hidden = false;
  },

  applySound() {
    if (!this.ready) return;
    this.lastMuteCall = Date.now();
    if (Sound.videoSounds()) { this.yt.unMute(); this.yt.setVolume(100); } else this.yt.mute();
  },
  // After a clip starts, check whether the browser actually let it make sound
  watchSound() {
    clearTimeout(this.soundTimer);
    if (!Sound.videoSounds()) return;
    this.soundTimer = setTimeout(() => {
      if (this.active && Sound.videoSounds() && this.yt.getPlayerState() === YT.PlayerState.PLAYING && this.yt.isMuted()) {
        this.blocked = true; this.hint("Tap the video's 🔇 icon to hear it"); log("video sound blocked by browser");
      }
    }, 2500);
  },
  // A clip that hasn't started: nudge it, then ask for a tap
  watchStall() {
    clearTimeout(this.stallTimer);
    this.stallTimer = setTimeout(() => {
      if (!this.active || this.yt.getPlayerState() === YT.PlayerState.PLAYING) return;
      this.yt.playVideo();
      this.stallTimer = setTimeout(() => {
        if (this.active && this.yt.getPlayerState() !== YT.PlayerState.PLAYING) { this.hint("Tap the video to play it"); log("video stalled"); }
      }, 5000);
    }, 4000);
  },
  // Every tick: notice the user unmuting with YouTube's own speaker button
  poll() {
    if (!this.ready || !this.active) return;
    const muted = this.yt.isMuted(), playing = this.yt.getPlayerState() === YT.PlayerState.PLAYING;
    if (!muted && playing && Sound.mode !== "video" && this.talks() && Date.now() - this.lastMuteCall > 1500) Sound.set("video", true);
    if (!muted && this.blocked) { this.blocked = false; this.hint(null); }
  },
  hint(msg) { $("video-hint").textContent = msg || ""; $("video-hint").hidden = !msg; },
  start() { this.active = true; this.key = null; },
  stop() {
    clearTimeout(this.stallTimer); clearTimeout(this.soundTimer); this.hint(null);
    this.active = false; this.pending = null; this.key = null;
    try { if (this.ready) { this.yt.pauseVideo(); this.yt.stopVideo(); this.yt.mute(); } } catch {}
  },
  resume() { if (this.active && this.ready) { this.yt.playVideo(); this.watchStall(); } },
};

/* ============================================================ Sound: one thing talks
   coach  — the coach speaks, demos are muted
   video  — the demo's own voice (on demos with no voice, the coach speaks instead)
   off    — silence (beeps only)
   Every workout and preview starts with the coach; Video lasts for that session. */
const Sound = {
  mode: (() => { const m = store.get("audioMode", "coach"); return ["coach", "video", "off"].includes(m) ? m : "coach"; })(),

  coachSpeaks() { return this.mode === "coach" || (this.mode === "video" && !Video.talks()); },
  videoSounds() { return this.mode === "video" && Video.talks(); },

  // fromVideo: changed with YouTube's own speaker button, so don't touch the player
  set(mode, fromVideo) {
    if (mode === this.mode) return;
    log("sound:", this.mode, "→", mode, fromVideo ? "(video controls)" : "");
    this.mode = mode; store.set("audioMode", mode);
    Video.blocked = false; Video.hint(null);
    if (!fromVideo) Video.applySound();          // inside the tap, which browsers need for sound
    UI.soundButtons();
    if (this.coachSpeaks()) Narration.resume(); else Voice.reset();
    if (this.videoSounds() && !fromVideo && Video.active) { Video.yt.playVideo(); Video.watchSound(); }
  },
  sessionDefault() { if (this.mode === "video") { this.mode = "coach"; store.set("audioMode", "coach"); } },
};

/* ============================================================ Narration: what the coach says, and when
   Order on the first set: name and target, the form cues through the set, then the Focus
   ("Remember, …") to close. Later sets get one reminder: the Focus on set 2, then other cues. */
const Narration = {
  // Exercise step. Holds also get how long "get in position" lasts.
  work(st) {
    const vi = Workout.variantOf(st.key), n = variant(st.key, vi).cues.length;
    const cue = (c, extra) => ({ texts: [SAY.cue(st.key, c, vi)], cue: c, ...extra });
    const focus = (extra) => ({ texts: [SAY.remember(), SAY.key(st.key, vi)], ...extra });
    const name = SAY.name(st.key, vi), cues = [...Array(n).keys()];
    if (st.preview) return { lines: [{ texts: [name] }, ...cues.map((c) => cue(c, { gap: 1.2 })), focus({ gap: 1.2 })] };

    const first = st.set === 1 && st.side !== "Right side";
    const secondVisit = (st.set === 2 && st.side !== "Right side") || (st.set === 1 && st.side === "Right side");
    const reminderCue = n > 1 ? 1 + (st.set - 3 + (st.side === "Right side" ? 1 : 0) + 2 * (n - 1)) % (n - 1) : 0;
    const reminder = (extra) => (secondVisit ? focus(extra) : cue(reminderCue, extra));
    const setIntro = st.section === "warm" || st.sets < 2 ? [] : [SAY.setOf(st.set, st.sets), ...(st.set === st.sets ? [SAY.lastSet()] : [])];

    if (st.dose.time) {
      const hold = st.dose.time, side = st.side ? [SAY.side(st.side)] : [];
      const intro = st.side === "Right side" ? [SAY.switchSides(), SAY.side("Right side")]
        : first ? [name, ...setIntro, SAY.target(st.dose), ...side]
        : [...setIntro, ...side];
      // "Get in position" lasts at least 6 s (10 s the first time) and always outlasts the intro
      const introSec = intro.reduce((t, x) => t + (Voice.manifest[clipId(x)] || 2) + 0.25, 0.6);
      const ready = Math.ceil(Math.max(first ? 10 : 6, introSec + 1.5));
      const at = (sec) => Object.assign(() => Workout.timer.phase === "work" && Workout.timer.total - Workout.timer.left >= sec, { sec });
      const lines = [{ texts: intro, intro: true }, { texts: [SAY.go()], when: () => Workout.timer.phase === "work", late: 1.5, gap: 0, intro: true }];
      if (first) {
        // cues then the Focus, spread over the hold and finished before the last 10 s
        const every = Math.max(7, Math.min(25, (hold - 13) / (n + 1)));
        cues.forEach((c) => { const t = 3 + c * every; if (t < hold - 8) lines.push(cue(c, { when: at(t), gap: 1.5 })); });
        const t = 3 + n * every;
        if (t < hold - 8) lines.push(focus({ when: at(t), gap: 1.5 }));
      } else if (hold >= 30) lines.push(reminder({ when: at(10), gap: 1.5 }));
      if (hold >= 30) lines.push({ texts: [SAY.tenLeft()], when: at(hold - 10), late: 3, gap: 0.5 });
      return { lines, ready };
    }
    if (st.section === "warm")   // warm-ups move quickly: name and target, setup cue, one every ~7 s, then the Focus
      return { lines: [{ texts: [name, SAY.target(st.dose)] }, cue(0, { gap: 0.8 }),
        ...cues.slice(1).map((c, k) => cue(c, { at: 8 + k * 7, gap: 2 })), focus({ at: 8 + (n - 1) * 7, gap: 2 })] };
    if (first)                   // setup while you pick up the weights, a cue every ~9 s while you lift, then the Focus
      return { lines: [{ texts: [name, ...setIntro, SAY.target(st.dose)] }, cue(0, { gap: 0.8 }),
        ...cues.slice(1).map((c, k) => cue(c, { at: 12 + k * 9, gap: 2 })), focus({ at: 12 + (n - 1) * 9, gap: 2 })] };
    return { lines: [{ texts: [...setIntro, SAY.target(st.dose)] }, reminder({ at: 8, gap: 2 })] };
  },

  rest(st, next) {
    const nextSet = next && next.section !== "warm" && next.sets > 1 ? [SAY.setOf(next.set, next.sets)] : [];
    return [
      { texts: [SAY.rest(st.dur), ...(next ? [SAY.nextUp(), SAY.name(next.key, Workout.variantOf(next.key)), ...nextSet] : [])], intro: true },
      st.dur >= 20 ? { texts: [SAY.tenToGo()], when: () => Workout.timer.phase === "rest" && Workout.timer.left <= 10.5, late: 2 } : null,
    ];
  },

  // Coach switched on mid-step: pick up from where the step is now
  resume() {
    const st = Workout.step();
    if (!st || !Video.active) return;
    const t = Workout.timer;
    let lines = st.type === "rest" ? this.rest(st, Workout.nextWork()) : this.work(st).lines;
    lines = lines.filter((l) => l && !(
      (st.type === "rest" && l.intro && t.left < 12) ||                          // rest nearly over
      (t.phase === "work" && l.intro) ||                                         // past "get in position"
      (t.phase === "work" && l.when?.sec != null && l.when.sec < t.total - t.left))); // cue time already passed
    Voice.plan(lines);
  },
};

/* ============================================================ Workout: the session */
const Workout = {
  day: null, warm: true, cool: true,
  steps: [], cur: 0, preview: false, label: "", startedAt: 0, tickId: null, wakeLock: null,
  timer: { phase: null, left: 0, total: 0, paused: false, t0: 0 },

  step() { return this.steps[this.cur]; },
  // Which demo (and so which variant's text) applies to an exercise right now
  variantOf(key) { return Video.key === key ? Video.idx : Video.preferred(key); },
  // The user switched to a different variant: redraw the panel and coach that variant from the top
  variantChanged() {
    const st = this.step();
    if (!st) return;
    if (st.type === "work") { UI.work(st); Voice.plan(Narration.work(st).lines); }
    else UI.rest(st, this.nextWork());
  },
  nextWork() { return this.steps.slice(this.cur + 1).find((s) => s.type === "work") || null; },

  // The day's parts, each exercise with its dose: warm-up, the day's own exercises (a stretch day's
  // are cool-down stretches), then the cool-down stretches the day doesn't already have
  parts(day, warm = true, cool = true) {
    const own = new Set(day.items.map((i) => i.key)), main = day.kind === "stretch" ? "cool" : "main";
    const entry = (key, item, section) => ({ key, section, dose: dose(key, item, section) });
    return {
      warm: warm ? WARMUP.map((key) => entry(key, {}, "warm")) : [],
      main: day.items.map((i) => entry(i.key, i, main)),
      cool: cool && day.kind !== "stretch" ? COOLDOWN.filter((k) => !own.has(k)).map((key) => entry(key, {}, "cool")) : [],
    };
  },
  build(day, warm, cool) {
    const p = this.parts(day, warm, cool), plan = [...p.warm, ...p.main, ...p.cool], steps = [];
    plan.forEach(({ key, section, dose: d }, i) => {
      for (let set = 1; set <= d.sets; set++) {
        for (const side of d.time && d.perSide ? ["Left side", "Right side"] : [null]) steps.push({ type: "work", key, set, sets: d.sets, side, section, dose: d });
        const last = i === plan.length - 1 && set === d.sets;
        if (!last && d.rest) steps.push({ type: "rest", dur: d.rest });
      }
    });
    return steps;
  },

  start({ warm, cool, label }) {
    this.begin(this.build(this.day, warm, cool), label, false);
    log("start workout:", label, "sound:", Sound.mode);
  },
  startPreview(key, d = dose(key)) {
    this.begin([{ type: "work", key, set: 1, sets: d.sets, side: null, section: "main", dose: d, preview: true }], "Preview", true);
  },
  begin(steps, label, preview) {
    Sound.sessionDefault();
    Voice.unlock();                              // inside the tap that started the session
    Object.assign(this, { steps, cur: 0, preview, label, startedAt: Date.now() });
    UI.show("player");
    $("stage").hidden = false; $("finished").hidden = true;
    Video.start();
    UI.soundButtons();
    this.keepAwake();
    clearInterval(this.tickId); this.tickId = setInterval(() => this.tick(), 250);
    this.render();
  },
  exit() {
    clearInterval(this.tickId); this.tickId = null;
    Voice.reset(); Video.stop(); UI.stopCues();
    try { this.wakeLock?.release(); } catch {}
    UI.show(this.day ? "day" : "home");
  },
  go(delta) {
    const n = this.cur + delta;
    if (n < 0) return;
    if (n >= this.steps.length) return this.finish();
    this.cur = n; this.render();
  },
  render() {
    const st = this.step();
    log("step", `${this.cur + 1}/${this.steps.length}`, st.type, st.key || "", st.set ? `set ${st.set}` : "", st.side || "");
    UI.progress();
    if (st.type === "work") {
      Video.showExercise(st.key);
      const plan = Narration.work(st);
      this.timer = st.dose.time && !st.preview
        ? { phase: "ready", left: plan.ready, total: st.dose.time, paused: false, t0: Date.now() }
        : { phase: null };
      UI.work(st);
      Voice.plan(plan.lines);
    } else {
      const next = this.nextWork();
      if (next) Video.showExercise(next.key);    // show what's coming up during the rest
      this.timer = { phase: "rest", left: st.dur, total: st.dur, paused: false, t0: Date.now() };
      UI.rest(st, next);
      Voice.plan(Narration.rest(st, next));
    }
  },
  finish() {
    clearInterval(this.tickId); this.tickId = null; this.timer.phase = null;
    Video.stop(); UI.stopCues();
    const mins = Math.round((Date.now() - this.startedAt) / 60000);
    UI.finished(mins);
    Voice.sayNow([SAY.done()]);
    const history = store.get("log", []);
    history.push({ day: this.label, at: Date.now(), mins });
    store.set("log", history.slice(-60));
  },

  tick() {
    Video.poll();
    UI.elapsed();
    Voice.tick();
    const t = this.timer, now = Date.now();
    if (!t.phase || t.paused) { t.t0 = now; return; }
    const before = Math.ceil(t.left);
    t.left -= (now - t.t0) / 1000; t.t0 = now;
    const whole = Math.ceil(t.left);
    if (whole !== before && whole >= 1 && whole <= 3) Beep.tick();
    UI.timer();
    if (t.left > 0) return;
    if (t.phase === "ready") { t.phase = "work"; t.left = t.total; Beep.go(); UI.timer(); }
    else { t.phase = null; Beep.go(); this.go(1); }
  },
  togglePause() { this.timer.paused = !this.timer.paused; UI.pauseButton(); },
  addRest(sec) { this.timer.total += sec; this.timer.left += sec; UI.timer(); },

  async keepAwake() { try { this.wakeLock = await navigator.wakeLock?.request("screen"); } catch {} },
};

document.addEventListener("visibilitychange", () => {
  log(document.hidden ? "app hidden" : "app visible");
  if (document.hidden || !Video.active) return;
  if (Voice.playing && Voice.el.paused) Voice.el.play().catch((e) => log("voice resume failed:", e.name));
  Workout.keepAwake();
  setTimeout(() => Video.resume(), 300);        // iOS pauses video in the background
});

/* ============================================================ Plans: which plan is open
   A plan arrives in the link (#v1/…). The last one opened is remembered on the device, so the plain
   address brings you back to it; with none, the example plan (the owner's week) opens. */
const Plans = {
  current: null,
  MAX_RECENT: 6,

  boot() {
    const hash = location.hash.slice(1);
    if (hash) return this.open(hash);
    const saved = store.get("plan", null), r = saved ? parsePlan(saved) : null;
    this.use(r && r.plan && !r.problems.length ? r.plan : null);
  },
  // A plan link from an AI (or a bookmark): open it, or explain what needs fixing
  open(text) {
    const r = parsePlan(text);
    log("plan link:", r.plan ? r.plan.title : "none", "problems:", r.problems.length, "fixes:", r.fixes.join("; "));
    if (r.problems.length || !r.plan) return UI.fix(r);
    this.use(r.plan);
  },
  use(plan) {
    if (!plan || plan.link === EXAMPLE_PLAN.link) plan = examplePlan();
    this.current = plan;
    if (!TEST_MODE) {
      store.set("plan", plan.example ? null : plan.link);
      if (!plan.example) store.set("plans", [{ link: plan.link, title: plan.title }, ...this.recent().filter((p) => p.link !== plan.link)].slice(0, this.MAX_RECENT));
      history.replaceState(null, "", location.pathname + location.search + (plan.example ? "" : "#" + plan.link));
    }
    Workout.day = null;
    UI.home(); UI.show("home");
  },
  recent() { return store.get("plans", []); },
  link(plan = this.current) { return SITE + (plan.example ? "" : "#" + plan.link); },
};
// A new plan link opened while the app is already open (e.g. tapped in the AI chat)
window.addEventListener("hashchange", () => {
  const hash = location.hash.slice(1);
  if (hash && hash !== Plans.current?.link && !Video.active) Plans.open(hash);
});

/* ============================================================ UI */
const UI = {
  cueIdx: 0, cueTimer: null, exitArmed: 0, rows: [],

  show(screen) {
    for (const id of ["home", "day", "player", "create", "fix"]) $(id).hidden = id !== screen;
    window.scrollTo(0, 0);
  },

  /* ---------- home */
  home() {
    const plan = Plans.current;
    document.title = `${plan.title} · Workout Coach`;
    $("plan-title").textContent = plan.title;
    $("plan-subtitle").textContent = plan.subtitle || this.planSummary(plan);
    $("plan-rules").hidden = !plan.rules?.length;
    $("plan-rules-title").textContent = plan.rulesTitle || "";
    $("plan-rules-list").innerHTML = (plan.rules || []).map(([lead, text]) => `<li><b>${esc(lead)}</b> ${esc(text)}</li>`).join("");
    const today = new Date().getDay();
    $("days").innerHTML = plan.days.map((day, i) => `
      <button class="day-card${day.d === today ? " today" : ""}" data-i="${i}">
        <span class="day-name label"><span>${DAY_NAMES[day.d]}</span>${day.d === today ? '<span class="today">Today</span>' : ""}</span>
        <span class="day-focus">${esc(day.name)}</span>
        <span class="goal">${esc(day.goal || this.daySummary(day))}</span>
      </button>`).join("");
    $("days").onclick = (e) => { const b = e.target.closest(".day-card"); if (b) this.openDay(plan.days[+b.dataset.i]); };
    $("plan-cta").hidden = !plan.example;
    $("plan-cta").onclick = () => this.create(false);
    this.planCard();
  },
  planSummary(plan) {
    const count = (kind, word) => { const n = plan.days.filter((d) => d.kind === kind).length; return n ? `${n} ${word} day${n === 1 ? "" : "s"}` : ""; };
    return [count("workout", "workout"), count("activity", "activity"), count("stretch", "stretch")].filter(Boolean).join(" · ");
  },
  daySummary(day) {
    if (day.kind === "activity") {
      const act = ACTIVITIES[day.activity.key].name, mins = day.activity.mins ? `${day.activity.mins} min` : "";
      return [act.toLowerCase() === day.name.toLowerCase() ? "" : act, mins].filter(Boolean).join(" · ") || act;
    }
    const n = day.items.length;
    return `${n} ${day.kind === "stretch" ? "stretch" : "exercise"}${n === 1 ? "" : day.kind === "stretch" ? "es" : "s"}`;
  },
  // Under the days: an invitation to make your own plan (on the example), or managing yours
  planCard() {
    const plan = Plans.current, others = [...Plans.recent().filter((p) => p.link !== plan.link), ...(plan.example ? [] : [{ example: true, title: EXAMPLE_PLAN.title }])];
    $("plan-card").classList.toggle("invite", !!plan.example);
    $("plan-card").innerHTML = (plan.example
      ? `<h2 class="invite-title">Get a plan made for you</h2>
         <p class="card-text">This week is an example. Chat with an AI you already use about your goals, any aches and what you have to train with, and it builds your own plan, with these videos and this coach.</p>
         <ol class="steps"><li>Pick your AI</li><li>Answer a few questions</li><li>Tap the link it gives you</li></ol>
         <div class="card-actions"><button class="big-btn" id="pc-create">Create your own plan</button></div>`
      : `<div class="label">Your plan</div>
         <p class="card-text">Bookmark this page or add it to your Home Screen: the plan lives in its link.</p>
         <div class="card-actions"><button class="tool" id="pc-change">Change it with AI</button><button class="tool" id="pc-share">Copy link</button><button class="tool" id="pc-create">Create a new plan</button><span class="note" id="pc-status"></span></div>`)
      + (others.length ? `<div class="label" style="margin-top:16px">Other plans on this device</div>
         <div class="plan-list">${others.map((p, i) => `<button class="link" data-i="${i}">${esc(p.title)}${p.example ? " (example)" : ""}</button>`).join("")}</div>` : "");
    $("pc-create").onclick = () => this.create(false);
    if ($("pc-change")) $("pc-change").onclick = () => this.create(true);
    if ($("pc-share")) $("pc-share").onclick = async () => { $("pc-status").textContent = (await copyText(Plans.link())) ? "Link copied" : "Couldn't copy"; };
    $("plan-card").querySelector(".plan-list")?.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-i]"); if (!b) return;
      const p = others[+b.dataset.i];
      Plans.use(p.example ? null : parsePlan(p.link).plan);
    });
  },

  /* ---------- create or change a plan with an AI */
  create(change) {
    const text = coachPrompt(change ? Plans.current.link : null);
    $("create-title").textContent = change ? "Change your plan" : "Create your own plan";
    $("create-intro").textContent = change
      ? "Pick an AI you use. It gets your current plan, asks what you'd like to change, and gives you a new link."
      : "Pick an AI you already use. It asks about your goals, any aches, your equipment and your time, then gives you a link to your own plan in this app. It uses your own AI account, so it's free.";
    // Every choice is a plain link, so the phone can hand it to the AI's app when it's installed.
    // Where the chat can't take the message in its address (Gemini), the same tap copies it first.
    $("ai-list").innerHTML = AI_CHATS.map((ai, i) => `<a class="ai-btn" data-i="${i}" href="${esc(chatLink(ai, text))}" target="_blank" rel="noopener">Open ${esc(ai.name)}${
      ai.paste ? " <small>Copies the message; paste it in</small>" : ""}</a>`).join("");
    $("ai-list").onclick = (e) => {
      const a = e.target.closest("a.ai-btn"), ai = a && AI_CHATS[+a.dataset.i];
      if (!ai?.paste) return;
      copyText(text).then((ok) => { $("create-status").textContent = ok ? `Message copied. Paste it into ${ai.name}'s message box and send.` : "Couldn't copy the message. Use the button below."; });
    };
    $("copy-prompt").onclick = async () => { $("create-status").textContent = (await copyText(text)) ? "Message copied. Paste it into any AI chat." : "Couldn't copy the message."; };
    $("create-status").textContent = "";
    this.show("create");
  },

  /* ---------- a plan link with mistakes: say what, and give the person a message for their AI */
  fix(r) {
    const message = "The workout app couldn't read parts of my plan link:\n"
      + r.problems.map((p) => `- ${p}`).join("\n")
      + "\nPlease fix only those parts, using the exercises and amounts from your instructions, and give me the corrected link.";
    $("fix-msg").textContent = message;
    $("fix-status").textContent = "";
    $("fix-copy").onclick = async () => { $("fix-status").textContent = (await copyText(message)) ? "Copied. Paste it into your AI chat." : "Couldn't copy; select the message and copy it."; };
    $("fix-anyway").hidden = !r.plan;
    $("fix-anyway").onclick = () => Plans.use(r.plan);
    $("fix-home").onclick = () => { history.replaceState(null, "", location.pathname + location.search); Plans.boot(); };
    this.show("fix");
  },

  /* ---------- day */
  openDay(day) {
    Object.assign(Workout, { day, warm: true, cool: true });
    $("day-kicker").textContent = DAY_NAMES[day.d];
    $("day-title").textContent = day.name;
    this.day();
    this.show("day");
  },
  describe(d) {
    const amount = d.time ? `${fmt(d.time)}${d.perSide ? " each side" : ""}` : amountText(d);
    return (d.sets > 1 ? `${d.sets} × ${amount}` : amount) + (d.rest ? ` · rest ${d.rest}s` : "");
  },
  exRow(entry) {
    const ex = EX[entry.key];
    this.rows.push(entry);
    return `<button class="ex-row" data-r="${this.rows.length - 1}">
      <img src="https://i.ytimg.com/vi/${ex.videos[0].id}/mqdefault.jpg" alt="" loading="lazy">
      <div><div class="ex-title">${esc(ex.name)}</div><div class="ex-meta">${esc(this.describe(entry.dose))}</div></div>
      <span class="chev">Preview ›</span></button>`;
  },
  section(label, entries) { return entries.length ? `<div class="label section-label">${label}</div><div class="ex-list">${entries.map((e) => this.exRow(e)).join("")}</div>` : ""; },
  toggle(id, on, title, sub) {
    return `<button class="toggle" id="${id}" aria-pressed="${on}"><span class="switch"></span><span><b>${title}</b><small>${sub}</small></span></button>`;
  },
  day() {
    const W = Workout, day = W.day, all = W.parts(day), p = W.parts(day, W.warm, W.cool), label = `${DAY_NAMES[day.d]} · ${day.name}`;
    this.rows = [];
    if (day.kind === "activity") {
      const act = ACTIVITIES[day.activity.key];
      $("day-body").innerHTML = `<div class="match-card"><b>${esc(this.daySummary(day))}</b><p class="muted" style="margin-top:6px">${esc(act.tip)} No lifting today: do the warm-up before you start and the cool-down stretches afterwards.</p></div>`
        + this.section("Warm-up before", all.warm) + this.section("Cool-down after", all.cool);
      $("start-bar").innerHTML = `<button class="big-btn" id="start-pre">Warm-up ▶</button><button class="big-btn" id="start-post">Cool-down ▶</button>`;
      $("start-pre").onclick = () => W.start({ warm: true, cool: false, label: `${label} · warm-up` });
      $("start-post").onclick = () => W.start({ warm: false, cool: true, label: `${label} · cool-down` });
    } else {
      $("day-body").innerHTML = `<div class="toggles">${this.toggle("wu-toggle", W.warm, "Include dynamic warm-up", `${WARMUP.length} moves · 6–8 min`)}${
        all.cool.length ? this.toggle("cd-toggle", W.cool, "Include post-workout flexibility", `${all.cool.length} stretches · about ${all.cool.length * 3} min`) : ""}</div>`
        + this.section("Warm-up", p.warm)
        + this.section(day.kind === "stretch" ? "Stretches" : "Workout", p.main)
        + this.section("Post-workout flexibility", p.cool);
      $("start-bar").innerHTML = `<button class="big-btn" id="start-btn">Start workout ▶</button>`;
      $("start-btn").onclick = () => W.start({ warm: W.warm, cool: W.cool, label });
      $("wu-toggle").onclick = () => { W.warm = !W.warm; this.day(); };
      if ($("cd-toggle")) $("cd-toggle").onclick = () => { W.cool = !W.cool; this.day(); };
    }
    $("day-body").onclick = (e) => { const r = e.target.closest(".ex-row"); if (r) { const x = this.rows[+r.dataset.r]; Workout.startPreview(x.key, x.dose); } };
  },

  /* ---------- player: top bar */
  progress() {
    const W = Workout, work = W.steps.filter((s) => s.type === "work").length;
    const done = W.steps.slice(0, W.cur).filter((s) => s.type === "work").length;
    this.whereText = W.preview ? "Preview" : `${W.label} · ${Math.min(done + 1, work)}/${work}`;
    $("progress").parentElement.hidden = W.preview;
    $("progress").style.width = `${(100 * W.cur) / Math.max(1, W.steps.length)}%`;
    this.elapsed();
  },
  elapsed() { $("where").textContent = `${this.whereText} · ${fmt((Date.now() - Workout.startedAt) / 1000)}`; },
  demoNav() {
    const multi = Video.list.length > 1, v = Video.current();
    $("vid-prev").hidden = $("vid-next").hidden = $("vid-count").hidden = !multi;
    $("vid-count").textContent = `Demo ${Video.idx + 1}/${Video.list.length}${v.label ? ` · ${v.label}` : ""}`;
  },
  speaker(on) {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/>${on ? '<path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>' : '<path d="M3 3l18 18"/>'}</svg>`;
  },
  soundButtons() {
    const set = (el, on, label, title = "") => {
      el.innerHTML = `${this.speaker(on)}<span>${label}</span>`;
      el.classList.toggle("on", on); el.setAttribute("aria-pressed", on); el.title = title;
    };
    const video = Sound.mode === "video", silentDemo = video && !Video.talks();
    set($("voice-btn"), Sound.coachSpeaks(), "Coach", silentDemo ? "This demo has no voice, so the coach is talking" : "");
    set($("sound-btn"), video, "Video");
    $("sound-btn").classList.toggle("idle", silentDemo);
  },

  /* ---------- player: exercise */
  context(st) {
    const what = st.preview ? `Preview${st.sets > 1 ? ` · ${st.sets} sets` : ""}`
      : st.section === "warm" ? "Warm-up"
      : st.section === "cool" ? `Cool-down${st.sets > 1 ? ` · set ${st.set} of ${st.sets}` : ""}`
      : `Set ${st.set} of ${st.sets}`;
    return `${esc(what)}${st.side ? ` · <span class="side">${st.side}</span>` : ""}`;
  },
  target(d) {
    return d.time ? `<b>${fmt(d.time)}</b> ${d.perSide ? "each side" : "hold"}`
      : `<b>${esc(d.reps)}${d.measure === "m" ? " m" : ""}</b> ${esc(d.unit)}`;
  },
  work(st) {
    const v = variant(st.key, Workout.variantOf(st.key)), hold = st.dose.time && !st.preview;
    $("panel").innerHTML = `<div class="panel-body">
      <div class="context">${this.context(st)}</div>
      <h2 class="name">${esc(v.name)}</h2>
      ${hold ? `<div class="hold" id="hold"><span class="clock" id="clock"></span><span class="state" id="hold-state"></span></div>`
             : `<div class="target">${this.target(st.dose)}</div>`}
      <div class="focus"><div class="label">Focus</div><p>${esc(v.key)}</p></div>
      <div class="form">
        <ul class="cues" id="cues">${v.cues.map((c, i) => `<li${i ? "" : ' class="on"'}>${esc(c)}</li>`).join("")}</ul>
        <div class="dots" id="dots">${v.cues.map((_, i) => `<i${i ? "" : ' class="on"'}></i>`).join("")}</div>
      </div>
      <p class="safety">${esc(v.stop)}</p>
      </div>
      <div class="controls">
        ${st.preview ? `<button class="ctl primary" id="c-done">Close preview</button>`
          : `<button class="ctl" id="c-prev" aria-label="Back">‹</button>${hold ? `<button class="ctl" id="c-pause">Pause</button>` : ""}
             <button class="ctl primary" id="c-done">${hold ? "Skip ›" : "Done ✓"}</button>`}
      </div>`;
    $("c-done").onclick = st.preview ? () => Workout.exit() : () => { Beep.done(); Workout.go(1); };
    if (!st.preview) $("c-prev").onclick = () => Workout.go(-1);
    if (hold) $("c-pause").onclick = () => Workout.togglePause();
    $("cues").onclick = () => this.showCue(this.cueIdx + 1, true);   // tap for the next cue
    this.cueIdx = 0; this.restartCues();
    this.timer();
  },
  timer() {
    const t = Workout.timer;
    if (t.phase === "rest") {
      if (!$("rest-num")) return;
      $("rest-num").textContent = Math.max(0, Math.ceil(t.left));
      $("rest-arc").style.strokeDashoffset = this.ringLength * (1 - Math.max(0, t.left) / t.total);
    } else if (t.phase && $("clock")) {
      $("clock").textContent = fmt(Math.ceil(t.left));
      $("hold").classList.toggle("ready", t.phase === "ready");
      $("hold-state").textContent = t.phase === "ready" ? "Get in position" : t.paused ? "Paused" : "Hold";
    }
  },
  pauseButton() { if ($("c-pause")) $("c-pause").textContent = Workout.timer.paused ? "Resume" : "Pause"; this.timer(); },

  // The spoken cue is highlighted (and on small screens it's the only one shown)
  showCue(i, fromVoice) {
    const items = $("cues")?.children, dots = $("dots")?.children;
    if (!items?.length) return;
    this.cueIdx = (i + items.length) % items.length;
    for (let j = 0; j < items.length; j++) { items[j].classList.toggle("on", j === this.cueIdx); dots[j].classList.toggle("on", j === this.cueIdx); }
    if (fromVoice) this.restartCues();
  },
  restartCues() { clearInterval(this.cueTimer); this.cueTimer = setInterval(() => this.showCue(this.cueIdx + 1), 9000); },
  stopCues() { clearInterval(this.cueTimer); },

  /* ---------- player: rest */
  ringLength: 2 * Math.PI * 54,
  rest(st, next) {
    this.stopCues();
    const nex = next && variant(next.key, Workout.variantOf(next.key));
    const detail = next ? [next.section === "warm" ? "" : `Set ${next.set} of ${next.sets}`, next.side].filter(Boolean).join(" · ") : "";
    $("panel").innerHTML = `<div class="panel-body">
      <div class="context rest">Rest</div>
      <div class="rest-main">
        <div class="ring">
          <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="54" fill="none" stroke="var(--line)" stroke-width="8"/>
            <circle id="rest-arc" cx="60" cy="60" r="54" fill="none" stroke="var(--rest)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${this.ringLength}" stroke-dashoffset="0"/></svg>
          <div class="num" id="rest-num">${st.dur}</div>
        </div>
        ${nex ? `<div class="rest-info"><div class="upnext"><div class="label">Up next</div><h3>${esc(nex.name)}</h3>${detail ? `<div class="muted">${esc(detail)}</div>` : ""}</div>
        <div class="focus"><div class="label">Focus</div><p>${esc(nex.key)}</p></div></div>` : ""}
      </div>
      </div>
      <div class="controls">
        <button class="ctl" id="c-prev" aria-label="Back">‹</button>
        <button class="ctl" id="c-add">+15s</button>
        <button class="ctl primary rest" id="c-skip">Skip rest ›</button>
      </div>`;
    $("c-prev").onclick = () => Workout.go(-1);
    $("c-add").onclick = () => Workout.addRest(15);
    $("c-skip").onclick = () => Workout.go(1);
  },

  finished(mins) {
    $("progress").style.width = "100%";
    $("stage").hidden = true; $("finished").hidden = false;
    $("finished").innerHTML = `<div class="emoji">💪</div><h1 class="title">Workout complete</h1>
      <p class="muted">${esc(Workout.label)} · ${mins} min</p><button class="big-btn" id="done-close">Back to the plan</button>`;
    $("done-close").onclick = () => { Workout.day = null; Workout.exit(); };
  },

  exitButton() {
    // Leaving a workout takes two taps; a preview closes at once
    if (Workout.preview || Date.now() - this.exitArmed < 2500) { this.exitArmed = 0; this.resetExit(); return Workout.exit(); }
    this.exitArmed = Date.now();
    $("exit-btn").textContent = "Tap again to exit"; $("exit-btn").classList.add("confirm");
    setTimeout(() => { if (Date.now() - this.exitArmed >= 2400) this.resetExit(); }, 2600);
  },
  resetExit() { $("exit-btn").textContent = "✕"; $("exit-btn").classList.remove("confirm"); },
};

/* ============================================================ Diagnostics panel & phone check */
const Diagnostics = {
  render() { $("diag-text").textContent = Diag.lines.slice(-250).join("\n"); },
  async copy() {
    try { await navigator.clipboard.writeText(Diag.lines.join("\n")); $("diag-status").textContent = "Copied ✓"; }
    catch {
      const r = document.createRange(); r.selectNodeContents($("diag-text"));
      getSelection().removeAllRanges(); getSelection().addRange(r);
      $("diag-status").textContent = "Selected; use Copy from the menu";
    }
  },
  // ~30 s of real playback on the device: voice clips, a beep, and a demo's autoplay/sound rules
  async phoneCheck() {
    Voice.unlock();                              // must happen inside this tap
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const btn = $("diag-check"); btn.disabled = true; btn.textContent = "Checking…";
    let problems = 0;
    const note = (ok, msg) => { if (!ok) problems++; log("check:", ok ? "PASS" : "FAIL", msg); this.render(); };
    log("=== phone check", navigator.userAgent.match(/OS [\d_]+/)?.[0] || "", "standalone:", !!navigator.standalone, "sound:", Sound.mode);

    const texts = [SAY.name("rdl"), SAY.key("rdl"), SAY.go()], events = [];
    const onPlay = () => events.push("start"), onEnd = () => events.push("end");
    Voice.el.addEventListener("playing", onPlay); Voice.el.addEventListener("ended", onEnd);
    const mode = Sound.mode; Sound.mode = "coach";
    Voice.sayNow(texts);
    const deadline = performance.now() + texts.reduce((t, x) => t + (Voice.manifest[clipId(x)] || 2) * 1000 + 300, 3000);
    while (performance.now() < deadline && !Voice.idle()) await wait(200);
    Sound.mode = mode;
    Voice.el.removeEventListener("playing", onPlay); Voice.el.removeEventListener("ended", onEnd);
    note(Object.keys(Voice.manifest).length > 0, `voice recordings available (${Object.keys(Voice.manifest).length})`);
    note(events.filter((e) => e === "end").length === 3, `coach voice finished ${events.filter((e) => e === "end").length}/3 clips`);
    note(!events.some((e, i) => e === "start" && events[i - 1] === "start"), "voice clips never overlapped");

    Beep.play(880, 0.2);
    note(Beep.ctx?.state === "running", `beep audio ${Beep.ctx ? Beep.ctx.state : "unavailable"}`);

    if (!window.YT?.Player) note(false, "YouTube player didn't load");
    else {
      $("diag-video").hidden = false;
      const box = document.createElement("div"); $("diag-video").replaceChildren(box);
      let state = -9;
      const p = new YT.Player(box, { width: 200, height: 112, videoId: EX.armcircles.videos[0].id,
        playerVars: { autoplay: 1, mute: 1, playsinline: 1 },
        events: { onReady: (e) => e.target.playVideo(), onStateChange: (e) => { state = e.data; }, onError: (e) => note(false, `demo video error ${e.data}`) } });
      const until = performance.now() + 10000;
      while (state !== 1 && performance.now() < until) await wait(250);
      note(state === 1, `demo video autoplays muted (${state === 1 ? "yes" : `no, state ${state}; Low Power Mode blocks this`})`);
      if (state === 1) {
        p.unMute(); p.setVolume(100); await wait(2000);
        const ok = p.getPlayerState() === 1 && !p.isMuted();
        note(ok, `demo sound can turn on without tapping the video (${ok ? "yes" : "no, needs a tap on the video"})`);
      }
      p.destroy(); $("diag-video").hidden = true;
    }
    log("=== phone check done:", problems, "problems");
    this.render();
    btn.disabled = false; btn.textContent = "Run phone check";
  },
};

// ?debug: a one-line status bar for device testing (sound mode, video state, last line spoken)
function debugBar() {
  const bar = document.createElement("div");
  bar.setAttribute("role", "status");
  bar.style.cssText = "position:fixed;left:0;right:0;bottom:0;z-index:9998;background:#300;color:#fff;font:11px monospace;padding:2px 6px;pointer-events:none";
  document.body.appendChild(bar);
  setInterval(() => {
    const said = [...Diag.lines].reverse().find((l) => l.includes("said:")) || "";
    const v = Video.ready ? `muted=${Video.yt.isMuted()} state=${Video.yt.getPlayerState()}` : "no player";
    bar.textContent = `DBG sound=${Sound.mode} ${v} hint=${!$("video-hint").hidden} unlocked=${Voice.unlocked} last=${said.slice(9, 60)}`;
  }, 500);
}

/* ============================================================ boot */
$("day-back").onclick = () => { Workout.day = null; UI.show("home"); };
$("create-back").onclick = () => UI.show("home");
$("exit-btn").onclick = () => UI.exitButton();
$("vid-prev").onclick = () => Video.choose(Video.idx - 1);
$("vid-next").onclick = () => Video.choose(Video.idx + 1);
$("vid-restart").onclick = () => Video.restart();
$("voice-btn").onclick = () => Sound.set(Sound.mode === "coach" ? "off" : "coach");
$("sound-btn").onclick = () => Sound.set(Sound.mode === "video" ? "coach" : "video");
$("diag-open").onclick = () => { $("diag").hidden = !$("diag").hidden; Diagnostics.render(); };
$("diag-clear").onclick = () => { Diag.clear(); Diagnostics.render(); };
$("diag-copy").onclick = () => Diagnostics.copy();
$("diag-check").onclick = () => Diagnostics.phoneCheck();

log("--- page loaded", navigator.userAgent.replace(/^Mozilla\/5.0 /, ""), "standalone:", !!navigator.standalone);
Voice.load();
Video.load();
Plans.boot();
if (QUERY.has("debug")) debugBar();
if (TEST_MODE) document.body.appendChild(Object.assign(document.createElement("script"), { src: "tests/selftest.js" }));
