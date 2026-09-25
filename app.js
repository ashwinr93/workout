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
 *   Figure     the muscle map: badges and front/back figures, male or female
 *   Plans      which plan is your week: from a link, the last one used on this device, or none yet
 *   UI         rendering the screens (tabs: My week, Plans, Exercises; a plan's preview)
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
const REVIEW_MODE = QUERY.has("review");         // screenshots for review (tests/review.js): nothing is saved
// Staging (…/workout/staging/) shares the live site's origin, so its saved data gets its own keys
// This release (the deploy's commit; "dev" locally): data files are fetched with it, so they match the page
const BUILD = document.querySelector('meta[name="build"]')?.content || "dev";
const STORE_PREFIX = /\/staging\//.test(location.pathname) ? "staging:" : "";
const store = {
  get(k, fallback) { try { const v = localStorage.getItem(STORE_PREFIX + k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(STORE_PREFIX + k, JSON.stringify(v)); } catch {} },
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
    if (TEST_MODE || REVIEW_MODE) return;       // test and review runs never touch the saved log
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
    return fetch(`audio/manifest.json?v=${BUILD}`).then((r) => r.json())
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
    // before a main exercise's first set, and only when the rest has room: what it works
    const works = next && next.section === "main" && next.set === 1 && next.side !== "Right side" && st.dur >= 30;
    return [
      { texts: [SAY.rest(st.dur), ...(next ? [SAY.nextUp(), SAY.name(next.key, Workout.variantOf(next.key)), ...nextSet] : [])], intro: true },
      works ? { texts: [SAY.works(next.key, Workout.variantOf(next.key))], gap: 0.8, intro: true } : null,
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

  // In the warm-up (or a rest before its next move): the player offers to skip the rest of it
  inWarmup() {
    const st = this.step();
    return !this.preview && !!st && (st.type === "work" ? st.section === "warm" : this.nextWork()?.section === "warm");
  },
  skipWarmup() {
    const n = this.steps.findIndex((st) => st.type === "work" && st.section !== "warm");
    log("skip warm-up");
    if (n < 0) return this.finish();
    this.cur = n; this.render();
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
    const back = this.returnTo; this.returnTo = null;
    UI.show(back || (this.day ? "day" : "home"));
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
    if (REVIEW_MODE) return;
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

// A demo's still for exercise rows: YouTube's thumbnail (or the still in `thumb`, for a black
// first frame; tools/thumbs.mjs), on a calm placeholder while it loads
const thumb = (v) => `<img src="https://i.ytimg.com/vi/${v.id}/${v.thumb || "mqdefault"}.jpg" alt="" loading="lazy" width="320" height="180">`;
const SWAP_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7"/></svg>`;
// Icons for the plan menu (outline, like the swap icon)
const MENU_ICON = (d) => `<span class="menu-ic"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg></span>`;
const MENU_ICONS = {
  adjust: MENU_ICON('<path d="M4 6h10"/><path d="M18 6h2"/><circle cx="16" cy="6" r="2"/><path d="M4 12h4"/><path d="M12 12h8"/><circle cx="10" cy="12" r="2"/><path d="M4 18h12"/><path d="M20 18h0"/><circle cx="18" cy="18" r="2"/>'),
  ai: MENU_ICON('<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
  share: MENU_ICON('<path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>'),
  swap: MENU_ICON('<path d="M7 4 3 8l4 4"/><path d="M3 8h14"/><path d="m17 20 4-4-4-4"/><path d="M21 16H7"/>'),
};

/* ============================================================ Figure: the muscle map
   Body art traced from the owner's images (figures/<male|female>.json, see design/README.md):
   front (f) and back (b) views, each a list of [muscle, svg path, bounding box]. Screens write an
   empty slot (Figure.slot) and paint() fills every slot once the figure chosen on this device
   has loaded, and again when the choice changes. */
const Figure = {
  // Main muscles solid green; helping muscles striped green (the #fig-help pattern in index.html),
  // so the two read apart at a glance instead of by comparing two shades of green
  COLORS: { body: "#4b5260", main: "#3ddc97", help: "url(#fig-help)" },
  kind: store.get("figure", "male") === "female" ? "female" : "male",
  data: null, fetched: {},                        // kind → promise of that figure

  get(kind) {
    return this.fetched[kind] ||= fetch(`figures/${kind}.json?v=${BUILD}`).then((r) => r.json())
      .catch((e) => { delete this.fetched[kind]; log("figure not loaded:", e.message); });
  },
  // The chosen figure; the other one is fetched afterwards so switching is instant
  load() {
    return this.get(this.kind).then((d) => {
      if (d) { this.data = d; this.paint(); }
      this.get(this.kind === "male" ? "female" : "male");
    });
  },
  // Switching: the current figure stays on screen until the new one is ready
  choose(kind) {
    if (kind === this.kind) return;
    this.kind = kind;
    store.set("figure", kind);
    return this.load();
  },
  // type: "badge" (a circle framed on the main muscles) or "full" (front and back)
  slot(type, muscles, label = "") {
    return `<span class="fig ${type}" data-fig="${type}" data-m="${esc(JSON.stringify(muscles))}" role="img" aria-label="${esc(label)}"></span>`;
  },
  paint(root = document) {
    if (!this.data) return;
    for (const el of root.querySelectorAll("[data-fig]")) {
      const m = JSON.parse(el.dataset.m);
      el.innerHTML = el.dataset.fig === "badge" ? this.badge(m) : this.svg("f", m) + this.svg("b", m);
    }
  },
  svg(view, m, box = this.data[view].box) {
    const role = (n) => (m.main.includes(n) ? "main" : m.help.includes(n) ? "help" : "body");   // the class lets a screen recolour them
    return `<svg viewBox="${box.map((v) => Math.round(v)).join(" ")}" aria-hidden="true">${this.data[view].parts.map(([n, d]) => `<path class="${role(n)}" d="${d}" fill="${this.COLORS[role(n)]}"/>`).join("")}</svg>`;
  },
  // A square around the main muscles, on the view where they take up the most room
  badge(m) {
    const main = (view) => this.data[view].parts.filter(([n]) => m.main.includes(n)).map((p) => p[2]);
    const area = (view) => main(view).reduce((a, [, , w, h]) => a + w * h, 0);
    const view = area("f") >= area("b") ? "f" : "b", boxes = main(view);
    if (!boxes.length) return this.svg(view, m);
    const x0 = Math.min(...boxes.map((b) => b[0])), y0 = Math.min(...boxes.map((b) => b[1]));
    const x1 = Math.max(...boxes.map((b) => b[0] + b[2])), y1 = Math.max(...boxes.map((b) => b[1] + b[3]));
    const side = Math.max(420, 1.6 * Math.max(x1 - x0, y1 - y0));   // room for the body around them, for contrast
    return this.svg(view, m, [(x0 + x1 - side) / 2, (y0 + y1 - side) / 2, side, side]);
  },
  // A session's muscles: main = what its exercises mainly work (most often first), help = the rest
  session(entries) {
    const count = {}, help = new Set();
    for (const e of entries) {
      const m = variant(e.key, Workout.variantOf(e.key)).muscles;
      m.main.forEach((k) => { count[k] = (count[k] || 0) + 1; });
      m.help.forEach((k) => help.add(k));
    }
    const main = Object.keys(count).sort((a, b) => count[b] - count[a]);
    return { main, help: [...help].filter((k) => !count[k]) };
  },
};

/* ============================================================ Plans: which plan is your week
   A plan arrives in a link (#v1/…) or is started from the Plans tab. The one you're following is
   remembered on the device, so the plain address brings you back to it. Someone who has never
   picked one lands on the Plans tab. (People who used the app before plans existed had the owner's
   week, stored as "plan": null; they keep it.) */
const Plans = {
  current: null,
  MAX_RECENT: 6,

  boot() {
    const hash = location.hash.slice(1);
    if (hash) return this.open(hash);
    const saved = REVIEW_MODE ? null : this.saved();
    const r = typeof saved === "string" ? parsePlan(saved) : null;
    if (r?.plan && !r.problems.length) this.use(r.plan);
    else if (saved === null) this.use(null);                       // before plans existed: the owner's week
    else this.none();
  },
  // the stored plan link; null for the owner's week in older versions; undefined if never chosen
  saved() { try { const v = localStorage.getItem(STORE_PREFIX + "plan"); return v === null ? undefined : JSON.parse(v); } catch { return undefined; } },
  // A plan link from an AI (or a bookmark): open it, or explain what needs fixing
  open(text) {
    const r = parsePlan(text);
    log("plan link:", r.plan ? r.plan.title : "none", "problems:", r.problems.length, "fixes:", r.fixes.join("; "));
    if (r.problems.length || !r.plan) return UI.fix(r);
    this.use(r.plan);
  },
  // Make a plan your week (null: the owner's week, the example)
  use(plan) {
    if (!plan || plan.link === EXAMPLE_PLAN.link) plan = examplePlan();
    const program = PROGRAMS.find((p) => p.link === plan.link);   // a ready-made plan keeps its proper name
    if (program?.title) plan.title = program.title;
    this.current = plan;
    if (!TEST_MODE && !REVIEW_MODE) {
      store.set("plan", plan.link);
      store.set("plans", [{ link: plan.link, title: plan.title }, ...this.recent().filter((p) => p.link !== plan.link)].slice(0, this.MAX_RECENT));
      history.replaceState(null, "", this.url());
    }
    Workout.day = null;
    UI.home(); UI.show("home");
  },
  // No plan yet: My week says so, and you start on the Plans tab
  none() { this.current = null; UI.home(); UI.tab("plans"); },
  // This page's address for your week (bookmarkable: the plan lives in it)
  url() { return location.pathname + location.search + (!this.current || this.current.example ? "" : "#" + this.current.link); },
  recent() { return REVIEW_MODE ? [] : store.get("plans", []); },
  // Take a plan off Your plans (never the one you're following)
  forget(link) { if (!REVIEW_MODE && link !== this.current?.link) store.set("plans", this.recent().filter((p) => p.link !== link)); },
  link(plan = this.current) { return SITE + (plan.example ? "" : "#" + plan.link); },
};
addEventListener("resize", () => UI.fitMuscleKey());   // turning the phone changes how much fits
// A new plan link opened while the app is already open (e.g. tapped in the AI chat)
window.addEventListener("hashchange", () => {
  const hash = location.hash.slice(1);
  if (hash && hash !== Plans.current?.link && !Video.active) Plans.open(hash);
});

/* ============================================================ UI */
const UI = {
  cueIdx: 0, cueTimer: null, exitArmed: 0, rows: [],
  TABS: ["home", "plans", "exercises"],

  show(screen) {
    for (const id of ["home", "plans", "plan-view", "exercises", "day", "player", "create", "fix"]) $(id).hidden = id !== screen;
    this.screen = screen;
    const tabbed = this.TABS.includes(screen);
    $("tabbar").hidden = !tabbed;
    if (tabbed) this.tabNow = screen;
    for (const b of $("tabbar").querySelectorAll("button")) b.setAttribute("aria-current", b.dataset.tab === screen ? "page" : "false");
    window.scrollTo(0, 0);
    if (screen === "day") this.fitMuscleKey();   // it can only be measured while showing
  },
  tab(name) {
    if (name === "exercises") this.exercises();
    if (name === "plans") this.plans();
    this.show(name);
  },
  // Back to a screen: tabs re-render, others are shown as they were
  back(to) { if (this.TABS.includes(to)) this.tab(to); else this.show(to); },
  // Tapping an exercise anywhere plays its preview, then comes back here
  preview(key, d) { Workout.returnTo = this.screen; Workout.startPreview(key, d || dose(key)); },

  /* ---------- Plans: your own plans (made with AI), then the ready-made ones, filtered by goal;
     creating your own comes after browsing */
  goal: null,
  plans() {
    // rebuilt only when something on it changed, so coming back to the tab doesn't reload its photos
    const key = JSON.stringify([this.goal, Plans.current?.link, Plans.recent().map((p) => p.link)]);
    if (key === this.plansKey) return;
    this.plansKey = key;
    const chip = (k, name) => `<button class="chip" data-goal="${k}" aria-pressed="${this.goal === k}">${esc(name)}</button>`;
    $("plans-goals").innerHTML = chip("", "All").replace('aria-pressed="false"', `aria-pressed="${!this.goal}"`) + Object.entries(GOALS).map(([k, n]) => chip(k, n)).join("");
    const own = this.goal ? [] : this.ownPlans(), ready = this.readyPlans().filter((e) => !this.goal || e.goals.includes(this.goal));
    const cards = (list, first) => `<div class="plan-cards">${list.map((e, i) => this.planTile(e, first && i < 2)).join("")}</div>`;
    $("plans-list").innerHTML = (own.length ? `<div class="label section-label">Your plans</div>${cards(own, true)}<div class="label section-label">Ready-made plans</div>` : "")
      + cards(ready, !own.length) + `<div class="create-tile"><b>None of these quite fit?</b>
        <span class="muted">Tell an AI your goals, any aches and what you train with, and it builds a plan for you.</span>
        <button class="link-accent" id="plans-create-2">Create your own with AI ›</button></div>`;
    $("plans-create-2").onclick = () => this.create(false);
  },
  // Everything a plan's card and preview show. A ready-made plan (programs.js) has it written down;
  // for one you made, it's worked out from its exercises.
  readyPlans() {
    return PROGRAMS.map((p) => ({ id: p.id, plan: this.programPlan(p), goals: p.goals, level: p.level, mins: p.mins, gear: p.gear, about: p.about, photo: p.photo }));
  },
  ownPlans() {
    const known = new Set([EXAMPLE_PLAN.link, ...PROGRAMS.map((p) => p.link)]);
    const links = [Plans.current, ...Plans.recent()].filter((p) => p && !known.has(p.link) && !p.example).map((p) => p.link);
    return [...new Set(links)].map((link, i) => this.ownEntry(parsePlan(link).plan, `own-${i}`));
  },
  ownEntry(plan, id) {
    const keys = plan.days.flatMap((d) => (d.items || []).map((x) => x.key));
    const kind = keys.length && keys.every((k) => EX[k].type === "stretch") ? "stretch"
      : Object.keys(GEAR).reverse().find((g) => keys.some((k) => EX[k].gear.includes(g))) || "bodyweight";
    return { id, plan, goals: [], own: true, mins: null, photo: OWN_PHOTOS[kind],
      level: keys.some((k) => EX[k].videos.some((_, vi) => variant(k, vi).level === "intermediate")) ? "intermediate" : "beginner",
      gear: kind === "stretch" ? "Stretching" : GEAR[kind].name,
      about: "Your own plan, made with AI. Open a day to see its exercises, or adjust the plan with AI." };
  },
  planEntry(id) { return [...this.ownPlans(), ...this.readyPlans()].find((e) => e.id === id); },
  // The card facts for any plan: a ready-made one's, or worked out for one you made
  entryOf(plan) { return this.readyPlans().find((e) => e.plan.link === plan.link) || this.ownEntry(plan, "own"); },
  // A card that makes one statement: how many days, what it is, what you need (the whole card opens it)
  planTile(e, eager) {
    const mine = Plans.current?.link === e.plan.link;
    return `<button class="plan-tile" data-id="${e.id}"><img class="plan-photo" src="${photoUrl(e)}" alt=""${eager ? "" : ' loading="lazy"'}>
      ${mine ? '<span class="mine">Your week</span>' : ""}
      ${this.planDays(e.plan)}
      <span class="plan-name">${esc(e.plan.title)}</span>
      <span class="plan-meta"><span class="plan-level">${this.levelLabel(e)}</span>${esc(this.planFacts(e, false))}</span>
      <span class="plan-chev" aria-hidden="true">›</span></button>`;
  },
  programPlan(p) {
    if (p.link === EXAMPLE_PLAN.link) return examplePlan();
    const plan = parsePlan(p.link).plan;
    if (p.title) plan.title = p.title;
    return plan;
  },
  // "3 days a week + 1 walk", with the number big
  planDays(plan) {
    const w = this.planWeek(plan);
    return `<span class="plan-days"><b>${w.train}</b> day${w.train === 1 ? "" : "s"} a week${w.extra ? ` <small>+ ${w.extra}</small>` : ""}</span>`;
  },
  levelLabel(e) { return e.own ? "Made with AI" : e.level === "beginner" ? "Beginner" : "Intermediate"; },
  // A plan's week: training days, and any walks or other activities ("3 days + 3 walks")
  planWeek(plan) {
    const acts = plan.days.filter((d) => d.kind === "activity"), train = plan.days.length - acts.length;
    const walks = acts.every((d) => d.activity.key === "walk"), n = acts.length;
    return { train, extra: n ? `${n} ${walks ? (n === 1 ? "walk" : "walks") : n === 1 ? "activity" : "activities"}` : "" };
  },
  // "35 min · Resistance bands"; with the week: "3 days + 3 walks · 35 min · Resistance bands"
  planFacts(e, week = true) {
    const w = this.planWeek(e.plan);
    return [week ? `${w.train} day${w.train === 1 ? "" : "s"}${w.extra ? ` + ${w.extra}` : ""}` : "", e.mins ? `${e.mins} min` : "", e.gear].filter(Boolean).join(" · ");
  },
  // One plan's preview: browsing never changes your week; "Start this plan" does, after asking
  planView(id) {
    const e = this.planEntry(id), plan = e.plan, mine = Plans.current?.link === plan.link;
    // each day opens its day screen (muscles, exercises to preview, even a try-out session)
    const dayCard = (d, i) => `<button class="card plan-day" data-day="${i}"><span><span class="label">${DAY_NAMES[d.d]}</span><b>${esc(d.name)}</b>
      <span class="muted">${esc(d.kind === "activity" ? this.daySummary(d) : d.items.map((x) => EX[x.key].name).join(" · "))}</span></span><span class="chev">›</span></button>`;
    $("plan-view-body").innerHTML = `<div class="plan-hero"><img class="plan-photo" src="${photoUrl(e)}" alt="">
        <div>${this.planDays(e.plan)}<h1 class="title">${esc(plan.title)}</h1></div></div>
      <p class="plan-meta view-meta"><span class="plan-level">${this.levelLabel(e)}</span>${esc(this.planFacts(e, false))}</p>
      <p class="card-text">${esc(e.about)}</p>
      ${plan.days.map(dayCard).join("")}
      <p class="note"><button class="link" id="plan-adjust">Adjust it to suit you with AI</button>${
        e.own && !mine ? ' · <button class="link" id="plan-forget">Remove from Your plans</button>' : ""}</p>`;
    $("plan-view-body").onclick = (ev) => { const b = ev.target.closest("button[data-day]"); if (b) this.openDay(plan.days[+b.dataset.day], "plan-view"); };
    $("plan-adjust").onclick = () => this.create(true, plan.link);
    if ($("plan-forget")) $("plan-forget").onclick = () => { Plans.forget(plan.link); this.tab("plans"); };
    $("plan-start").textContent = mine ? "This is your week" : "Start this plan";
    $("plan-start").disabled = mine;
    $("plan-start").onclick = () => (Plans.current ? this.confirmPlan(plan) : this.startPlan(plan));
    $("plan-view-back").onclick = () => this.tab("plans");
    this.show("plan-view");
  },
  confirmPlan(plan) {
    $("plan-confirm-title").textContent = `Switch to ${plan.title}?`;
    $("plan-confirm-text").textContent = `It replaces ${Plans.current.title} as your week. You can switch back anytime from Plans.`;
    $("plan-confirm-no").textContent = `Keep ${Plans.current.title}`;
    $("plan-confirm").hidden = false;
    $("plan-confirm-yes").onclick = () => { $("plan-confirm").hidden = true; this.startPlan(plan); };
    $("plan-confirm-no").onclick = () => { $("plan-confirm").hidden = true; };
  },
  startPlan(plan) { log("start plan:", plan.title); Plans.use(plan.example ? null : plan); }, 

  /* ---------- Exercises: the library, searchable and filterable */
  exFilter: { q: "", gear: null, area: null },
  exercises() {
    const F = this.exFilter;
    const chips = (list, on, attr) => list.map(([k, name]) => `<button class="chip" data-${attr}="${k}" aria-pressed="${on === k}">${esc(name)}</button>`).join("");
    $("ex-gear").innerHTML = chips(Object.entries(GEAR).map(([k, g]) => [k, g.name]), F.gear, "gear");
    $("ex-area").innerHTML = chips(Object.entries(AREAS).map(([k, a]) => [k, a.name]), F.area, "area");
    $("ex-search").value = F.q;
    this.exerciseList();
  },
  // What the filters leave, A to Z; grouped by body area (A to Z) under the area of its first main muscle
  exerciseMatches() {
    const F = this.exFilter, q = F.q.trim().toLowerCase(), allowed = F.gear && GEAR[F.gear].with;
    return Object.keys(EX).sort((a, b) => EX[a].name.localeCompare(EX[b].name)).filter((k) => {   // A to Z
      const ex = EX[k], v = ex.videos.map((_, vi) => variant(k, vi).name.toLowerCase());
      return (!q || v.some((n) => n.includes(q)) || ex.name.toLowerCase().includes(q) || muscleList(ex.muscles.main).toLowerCase().includes(q))
        && (!allowed || ex.gear.some((g) => allowed.includes(g)))
        && (!F.area || areasOf(k).includes(F.area));
    });
  },
  exerciseList() {
    const listKey = JSON.stringify([this.exFilter, Figure.kind]);   // unchanged: keep the list (and its loaded thumbnails)
    if (listKey === this.exListKey) return;
    this.exListKey = listKey;
    const F = this.exFilter, keys = this.exerciseMatches(), n = keys.length;
    // "18 leg exercises you can do with dumbbells or just your body weight"
    const kit = { bodyweight: "with just your body weight", bands: "with bands or just your body weight",
      dumbbells: "with dumbbells or just your body weight", gym: "in a gym" }[F.gear];
    const what = `${n} ${F.area ? AREAS[F.area].name.toLowerCase().replace(/s$/, "") + " " : ""}exercise${n === 1 ? "" : "s"}`;
    $("ex-note").textContent = F.gear ? `${what} you can do ${kit}` : F.q || F.area ? `${what}` : `All ${n} exercises`;
    const groups = Object.keys(AREAS).map((a) => [a, keys.filter((k) => (F.area || areasOf(k)[0]) === a && areasOf(k).includes(a))]).filter(([, ks]) => ks.length);
    $("ex-results").innerHTML = n ? groups.map(([a, ks]) => `<div class="label section-label">${AREAS[a].name}</div>
      <div class="ex-list">${ks.map((k) => this.libraryRow(k)).join("")}</div>`).join("")
      : `<p class="note">No exercises match. Try fewer filters or another word.</p>`;
    Figure.paint($("ex-results"));
  },
  libraryRow(key) {
    const ex = EX[key], m = ex.muscles;
    return `<button class="ex-row" data-ex="${key}" aria-label="Preview ${esc(ex.name)}">
      ${thumb(ex.videos[0])}
      <div><div class="ex-title">${esc(ex.name)}</div><div class="ex-meta">${esc(muscleList(m.main))} · ${ex.level === "beginner" ? "Beginner" : "Intermediate"}</div></div>
      ${Figure.slot("badge", m, muscleList(m.main))}<span class="chev">›</span></button>`;
  },



  /* ---------- home */
  home() {
    const plan = Plans.current;
    $("week-empty").hidden = !!plan;
    for (const id of ["week-hero", "days", "plan-card"]) $(id).hidden = !plan;
    $("week-browse").onclick = () => this.tab("plans");
    $("week-create").onclick = () => this.create(false);
    if (!plan) { $("plan-title").textContent = ""; document.title = "Workout Coach"; return; }
    document.title = `${plan.title} · Workout Coach`;
    $("plan-title").textContent = plan.title;
    $("week-photo").src = photoUrl(this.entryOf(plan));
    $("plan-subtitle").textContent = plan.subtitle || this.planSummary(plan);
    const today = new Date().getDay(), order = plan.days.map((day, i) => [day, i]).sort(([a], [b]) => ((a.d - today + 7) % 7) - ((b.d - today + 7) % 7));
    $("days").innerHTML = order.map(([day, i]) => `
      <button class="day-card${day.d === today ? " today" : ""}" data-i="${i}">
        <span class="day-name label"><span>${DAY_NAMES[day.d]}</span>${day.d === today ? '<span class="today">Today</span>' : ""}</span>
        <span class="day-focus">${esc(day.name)}</span>
        <span class="goal">${esc(day.goal || this.daySummary(day))}</span>
      </button>`).join("");
    $("days").onclick = (e) => { const b = e.target.closest(".day-card"); if (b) this.openDay(plan.days[+b.dataset.i]); };
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
  // Under the days: one row that opens a sheet to change your week with AI, share it, or switch plan
  planCard() {
    $("plan-card").innerHTML = `<button class="menu-row" id="pc-open">${MENU_ICONS.adjust}<span><b>Change or share this plan</b>
      <small>Adjust it with AI, share it, or switch</small></span><span class="chev">›</span></button>`;
    $("pc-open").onclick = () => this.planMenu();
  },
  planMenu() {
    const opt = (id, icon, title, sub) => `<button class="menu-opt" id="${id}">${MENU_ICONS[icon]}<span><b>${title}</b><small>${sub}</small></span></button>`;
    $("plan-menu-title").textContent = Plans.current.title;
    $("plan-menu-status").textContent = "";
    $("plan-menu-opts").innerHTML = opt("pm-change", "ai", "Change it with AI", "Your AI gets this plan and asks what to change")
      + opt("pm-share", "share", "Share", "Send the link: it opens this exact plan")
      + opt("pm-switch", "swap", "Switch plan", "Your own plans and the ready-made ones");
    const close = () => { $("plan-menu").hidden = true; };
    $("pm-change").onclick = () => { close(); this.create(true); };
    $("pm-switch").onclick = () => { close(); this.tab("plans"); };
    // the phone's share sheet where there is one (Messages, WhatsApp, AirDrop…); otherwise copy the link
    $("pm-share").onclick = async () => {
      const url = Plans.link();
      if (navigator.share) {
        try { await navigator.share({ title: Plans.current.title, url }); close(); return; }
        catch (e) { if (e.name === "AbortError") return; }
      }
      $("plan-menu-status").textContent = (await copyText(url)) ? "Link copied" : "Couldn't copy the link";
    };
    $("plan-menu-cancel").onclick = close;
    $("plan-menu").onclick = (e) => { if (e.target === $("plan-menu")) close(); };   // tap outside the sheet
    $("plan-menu").hidden = false;
  },

  /* ---------- create or change a plan with an AI */
  create(change, link = Plans.current?.link) {
    const text = coachPrompt(change ? link : null), from = this.screen;
    $("create-back").onclick = () => this.back(from || "home");
    $("create-title").textContent = change ? "Change your plan" : "Create your own plan";
    $("create-intro").textContent = change
      ? "Pick an AI you use. It gets your current plan, asks what you'd like to change, and gives you a new link."
      : "Pick an AI you already use. It asks about your goals, any aches, where you train (at home, in a gym or anywhere) and what's there, and how much time you have. Then it gives you a link to your own plan in this app. It uses your own AI account, so it's free.";
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
  // from: the screen its back button returns to (your week, or the plan being previewed)
  openDay(day, from = "home") {
    this.dayFrom = from;
    $("day-back").textContent = from === "home" ? "‹ Days" : "‹ Plan";
    Object.assign(Workout, { day, warm: true, cool: true });
    $("day-kicker").textContent = DAY_NAMES[day.d];
    $("day-title").textContent = day.name;
    this.day();
    this.show("day");
  },
  exRow(entry) {
    const ex = EX[entry.key], m = variant(entry.key, Workout.variantOf(entry.key)).muscles;
    this.rows.push(entry);
    return `<button class="ex-row" data-r="${this.rows.length - 1}" aria-label="Preview ${esc(ex.name)}">
      ${thumb(ex.videos[Workout.variantOf(entry.key)] || ex.videos[0])}
      <div><div class="ex-title">${esc(ex.name)}</div><div class="ex-meta">${esc(this.amount(entry.dose))} · ${esc(muscleList(m.main))}</div></div>
      ${Figure.slot("badge", m, muscleList(m.main))}<span class="chev">›</span></button>`;
  },
  amount(d) {
    const amount = d.time ? `${fmt(d.time)}${d.perSide ? " each side" : ""}` : amountText(d);
    return d.sets > 1 ? `${d.sets} × ${amount}` : amount;
  },
  // Front and back figures for the day's own exercises, with a small swap icon under them to view
  // the other figure (a way of looking at the picture, not a workout setting; remembered on the device)
  dayMuscles(entries) {
    const s = Figure.session(entries), other = Figure.kind === "male" ? "female" : "male";
    return `<div class="day-muscles">${Figure.slot("full", s, muscleList(s.main))}${this.muscleGroups(s)}
      <button class="fig-toggle" data-kind="${other}" aria-label="Show ${other} figure" title="Show ${other} figure">${SWAP_ICON}</button></div>`;
  },
  // The figure's key: each group marked by a bar drawn like its muscles (solid main, striped helping)
  muscleGroups(m) {
    const group = (label, tone, keys) => keys.length
      ? `<div class="muscle-group ${tone}"><div class="label">${label}</div><div class="names" data-keys="${keys.join(",")}">${esc(muscleList(keys))}</div></div>` : "";
    return `<div class="muscle-groups">${group("Main", "main", m.main)}${group("Helping", "help", m.help)}</div>`;
  },
  // Swapping the figure redraws only the figure card, not the exercise rows
  redrawDayMuscles() {
    const card = $("day-body").querySelector(".day-muscles");
    card.outerHTML = this.dayMuscles(this.dayMain);
    Figure.paint($("day-body").querySelector(".day-muscles"));
    this.fitMuscleKey();
  },
  // The day card's key stays within the figures' height: a long list ends "and 3 more" (helping
  // muscles give way first); the figures still show every muscle
  fitMuscleKey() {
    const card = $("day-body").querySelector(".day-muscles");
    if (!card || !card.offsetParent) return;
    const fig = card.querySelector(".fig.full"), key = card.querySelector(".muscle-groups");
    const groups = [...key.querySelectorAll(".names")].map((el) => ({ el, keys: el.dataset.keys.split(","), n: 0 }));
    const show = (g) => { g.el.textContent = muscleList(g.keys.slice(0, g.n)) + (g.n < g.keys.length ? ` and ${g.keys.length - g.n} more` : ""); };
    groups.forEach((g) => { g.n = g.keys.length; show(g); });
    const over = () => key.getBoundingClientRect().bottom > fig.getBoundingClientRect().bottom + 0.5;   // below the feet
    for (const g of [...groups].reverse()) while (over() && g.n > 1) { g.n--; show(g); }
  },
  section(label, entries) { return entries.length ? `<div class="label section-label">${label}</div><div class="ex-list">${entries.map((e) => this.exRow(e)).join("")}</div>` : ""; },
  // An optional part of the day (warm-up, cool-down): its section header carries the switch, and
  // its exercises are listed only while it's on (switching just shows or hides them: nothing reloads)
  optional(id, on, label, sub, entries, what) {
    return `<div class="section-head"><span class="label">${label}</span><small>${sub}</small>
      <button class="switch" id="${id}" aria-pressed="${on}" aria-label="Include the ${what}"></button></div>
      <div class="ex-list" id="${id}-list"${on ? "" : " hidden"}>${entries.map((e) => this.exRow(e)).join("")}</div>`;
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
      this.dayMain = all.main;
      $("day-body").innerHTML = this.dayMuscles(all.main)
        + this.optional("wu-toggle", W.warm, "Warm-up", `${WARMUP.length} moves · 6–8 min`, all.warm, "warm-up")
        + this.section(day.kind === "stretch" ? "Stretches" : "Workout", p.main)
        + (all.cool.length ? this.optional("cd-toggle", W.cool, "Cool-down stretches", `${all.cool.length} · about ${all.cool.length * 3} min`, all.cool, "cool-down stretches") : "");
      $("start-bar").innerHTML = `<button class="big-btn" id="start-btn">Start workout ▶</button>`;
      $("start-btn").onclick = () => W.start({ warm: W.warm, cool: W.cool, label });
      const flip = (id, part) => { W[part] = !W[part]; $(id).setAttribute("aria-pressed", W[part]); $(`${id}-list`).hidden = !W[part]; };
      $("wu-toggle").onclick = () => flip("wu-toggle", "warm");
      if ($("cd-toggle")) $("cd-toggle").onclick = () => flip("cd-toggle", "cool");
    }
    // Only phones mirror to a TV; the tip sits where you're about to start
    if (matchMedia("(pointer: coarse)").matches)
      $("day-body").insertAdjacentHTML("beforeend", `<p class="note tv-tip">Want it bigger? Mirror your phone to a TV: turn off Rotation Lock, hold the phone sideways, then Control Center → Screen Mirroring.</p>`);
    $("day-body").onclick = (e) => {
      const f = e.target.closest(".fig-toggle");
      if (f) { Figure.choose(f.dataset.kind); return this.redrawDayMuscles(); }
      const r = e.target.closest(".ex-row"); if (r) { const x = this.rows[+r.dataset.r]; this.preview(x.key, x.dose); }
    };
    Figure.paint($("day-body"));
    this.fitMuscleKey();
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
    const what = st.preview ? `${this.facts(st.key, Workout.variantOf(st.key)).level}${st.sets > 1 ? ` · ${st.sets} sets` : ""}`
      : st.section === "warm" ? "Warm-up"
      : st.section === "cool" ? `Cool-down${st.sets > 1 ? ` · set ${st.set} of ${st.sets}` : ""}`
      : `Set ${st.set} of ${st.sets}`;
    const m = variant(st.key, Workout.variantOf(st.key)).muscles;
    return `${esc(what)}${st.side ? ` · <span class="side">${st.side}</span>` : ""} · <span class="muscles">${esc(muscleList(m.main))}</span>`;
  },
  // An exercise's quick facts. A preview shows each beside what it's about (level in the top line,
  // equipment under the target, joints with the safety line); the rest screen, all on one line.
  facts(key, vi) {
    const ex = EX[key], v = variant(key, vi), joints = (l) => l.map((j) => JOINTS[j]).join(", ");
    return { level: v.level === "beginner" ? "Beginner" : "Intermediate",
      equip: ex.equip === "none" ? "No equipment" : ex.equip[0].toUpperCase() + ex.equip.slice(1),
      joints: [v.easyOn.length ? `Easy on ${joints(v.easyOn)}` : "", v.loads.length ? `Loads ${joints(v.loads)}` : ""].filter(Boolean).join(" · ") };
  },
  exerciseFacts(key, vi) { const f = this.facts(key, vi); return [f.level, f.equip, f.joints].filter(Boolean).join(" · "); },
  target(d) {
    return d.time ? `<b>${fmt(d.time)}</b> ${d.perSide ? "each side" : "hold"}`
      : `<b>${esc(d.reps)}${d.measure === "m" ? " m" : ""}</b> ${esc(d.unit)}`;
  },
  work(st) {
    const vi = Workout.variantOf(st.key), v = variant(st.key, vi), hold = st.dose.time && !st.preview, f = st.preview && this.facts(st.key, vi);
    $("panel").innerHTML = `<div class="panel-body">
      <div class="context">${this.context(st)}</div>
      <div class="head"><div class="head-text"><h2 class="name">${esc(v.name)}</h2>
        ${hold ? `<div class="hold" id="hold"><span class="clock" id="clock"></span><span class="state" id="hold-state"></span></div>`
               : `<div class="target-row"><div class="target">${this.target(st.dose)}</div>${f ? `<p class="equip">${esc(f.equip)}</p>` : ""}</div>`}</div>
        ${Figure.slot("badge", v.muscles, muscleList(v.muscles.main))}</div>
      <i class="grow"></i>
      <div class="focus"><div class="label">Focus</div><p>${esc(v.key)}</p></div>
      <div class="form">
        <ul class="cues" id="cues">${v.cues.map((c, i) => `<li${i ? "" : ' class="on"'}>${esc(c)}</li>`).join("")}</ul>
        <div class="dots" id="dots">${v.cues.map((_, i) => `<i${i ? "" : ' class="on"'}></i>`).join("")}</div>
      </div>
      <i class="grow"></i>
      <p class="safety">${esc(v.stop)}</p>
      ${f && f.joints ? `<p class="joints">${esc(f.joints)}</p>` : ""}
      </div>
      <div class="controls">
        ${st.preview ? `<button class="ctl primary" id="c-done">Close</button>`
          : `<button class="ctl" id="c-prev" aria-label="Back">‹</button>${hold ? `<button class="ctl" id="c-pause">Pause</button>` : ""}${
             Workout.inWarmup() ? `<button class="ctl" id="c-skipwarm">Skip warm-up</button>` : ""}
             <button class="ctl primary" id="c-done">${hold ? "Skip ›" : "Done ✓"}</button>`}
      </div>`;
    $("c-done").onclick = st.preview ? () => Workout.exit() : () => { Beep.done(); Workout.go(1); };
    if ($("c-skipwarm")) $("c-skipwarm").onclick = () => Workout.skipWarmup();
    if (!st.preview) $("c-prev").onclick = () => Workout.go(-1);
    if (hold) $("c-pause").onclick = () => Workout.togglePause();
    $("cues").onclick = () => this.showCue(this.cueIdx + 1, true);   // tap for the next cue
    this.cueIdx = 0; this.restartCues();
    this.timer();
    Figure.paint($("panel"));
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
        ${nex ? `<div class="rest-info"><div class="upnext"><div><div class="label">Up next</div><h3>${esc(nex.name)}</h3>${detail ? `<div class="muted">${esc(detail)}</div>` : ""}</div>${Figure.slot("badge", nex.muscles, muscleList(nex.muscles.main))}</div>
        <div class="focus"><div class="label">Focus</div><p>${esc(nex.key)}</p></div>
        <p class="rest-facts">${esc(this.exerciseFacts(next.key, Workout.variantOf(next.key)))}</p></div>` : ""}
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
    Figure.paint($("panel"));
  },

  finished(mins) {
    $("progress").style.width = "100%";
    $("stage").hidden = true; $("finished").hidden = false;
    // what the session worked: its main exercises (a warm-up or stretch-only session: all of it)
    const work = Workout.steps.filter((st) => st.type === "work"), main = work.filter((st) => st.section === "main");
    const worked = Figure.session((main.length ? main : work).filter((st, i, all) => all.findIndex((x) => x.key === st.key) === i));
    $("finished").innerHTML = `<h1 class="title">Workout complete</h1>
      <p class="muted">${esc(Workout.label)} · ${mins} min</p>
      ${Figure.slot("full", worked, muscleList(worked.main))}
      ${this.muscleGroups(worked)}
      <button class="big-btn" id="done-close">Back to the plan</button>
      ${Plans.current?.example && !Workout.preview ? '<button class="link" id="done-create">Create your own plan</button>' : ""}`;
    $("done-close").onclick = () => { Workout.day = null; Workout.exit(); };
    if ($("done-create")) $("done-create").onclick = () => { Workout.day = null; Workout.exit(); this.create(false); };
    Figure.paint($("finished"));
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
$("day-back").onclick = () => { Workout.day = null; UI.show(UI.dayFrom); };
$("plans-create").onclick = () => UI.create(false);
$("plans-goals").onclick = (e) => { const b = e.target.closest("button[data-goal]"); if (b) { UI.goal = b.dataset.goal || null; UI.plans(); } };
$("plans-list").onclick = (e) => { const b = e.target.closest(".plan-tile[data-id]"); if (b) UI.planView(b.dataset.id); };
$("tabbar").onclick = (e) => { const b = e.target.closest("button[data-tab]"); if (b) UI.tab(b.dataset.tab); };
$("ex-search").oninput = (e) => { UI.exFilter.q = e.target.value; UI.exerciseList(); };
const chipFilter = (id, field) => ($(id).onclick = (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const k = b.dataset[field]; UI.exFilter[field] = UI.exFilter[field] === k ? null : k;
  for (const c of $(id).children) c.setAttribute("aria-pressed", c === b && UI.exFilter[field] === k);
  UI.exerciseList();
});
chipFilter("ex-gear", "gear"); chipFilter("ex-area", "area");
$("ex-results").onclick = (e) => { const b = e.target.closest("[data-ex]"); if (b) UI.preview(b.dataset.ex); };
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
Figure.load();
if (QUERY.has("debug")) debugBar();
if (TEST_MODE) document.body.appendChild(Object.assign(document.createElement("script"), { src: "tests/selftest.js" }));
if (REVIEW_MODE) document.body.appendChild(Object.assign(document.createElement("script"), { src: "tests/review.js" }));
