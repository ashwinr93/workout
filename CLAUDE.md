# Joint-Friendly Workout

A static web app that plays the owner's weekly workout (from their "Joint-Friendly Workout Routine" PDF) with YouTube demo videos, a pre-recorded coach voice, and timers. They use it on an iPhone held **landscape**, AirPlay-mirrored to a TV (Xiaomi), and sometimes on a Mac (Firefox).

Live: https://ashwinr93.github.io/workout/ — GitHub Pages from `ashwinr93/workout`, branch `main`. `gh` is logged in as ashwinr93.

## Files

| File | What it is |
|---|---|
| `index.html` | Markup only (home, day, player screens) |
| `styles.css` | Design tokens and layout; compact rules for landscape phone (`max-height: 520px`) and portrait phone |
| `data.js` | Exercises (`EX`), `WARMUP`, `COOLDOWN`, `DAYS`, and all narration wording (`SAY`, `SPOKEN_NAMES`, `allPhrases()`, `clipId()`) |
| `app.js` | The app, one owner per concern: `Diag`, `Beep`, `Voice` (coach), `Video` (YouTube), `Sound` (who talks), `Narration` (what's said when), `Workout` (steps/timer), `UI`, `Diagnostics` (phone check) |
| `audio/` | One `.m4a` per phrase, named by `clipId(text)`, plus `manifest.json` (id → seconds) |
| `tools/make_audio.py` | Records every phrase from `data.js` with the Kokoro voice `af_heart` |
| `tests/selftest.js` | Fast self-test (virtual clock, fake YouTube); runs with `index.html?selftest` |
| `tests/e2e/` | Playwright: `real-browsers.mjs` (real YouTube, real clicks), `ad-scan.mjs` (ads + which demos have a voice) |

### Exercise data (`EX` in `data.js`)
`name`, `sets?`, `reps`+`unit` **or** `time` (seconds), `perSide?`, `rest`, `key` (the one cue that matters most → "Focus"), `cues` (in the order the demo shows them), `stop` (safety), `videos` (main first, then alternates: `{ id, label?, start?, end?, voice? }`). `voice: true` means someone talks in the demo.

## Product rules (decided with the owner — keep them)
- **One sound at a time.** `Sound.mode` is `coach` | `video` | `off`. Coach is the default at the start of every workout/preview; Video lasts only for that session. On a demo with no voice, the coach speaks even in Video mode. Unmuting with YouTube's own speaker switches to Video. The app never mutes a video on a guess.
- **Ad-free demos only.** Any new or swapped video must pass `ad-scan.mjs` (no "AD"). No ad-blocker / cross-site-tracking workarounds.
- **One movement per exercise.** Two movements → two exercises, or one demo showing both. Multiple demos on one exercise are either/or alternates behind ‹ › (never auto-cycled).
- **Trim intros/outros** (logos, title cards, "subscribe" endings) with `start`/`end`; check first/last seconds via YouTube storyboards.
- **Cues must match what the demo shows/says.** Where a demo contradicts the PDF's joint-safety guidance, the PDF wins.
- **Wording:** every cue must read well *and* sound natural when the coach says it — no bracketed asides (name a position as a leading label instead: "Cow: breathe in…"), no ALL-CAPS emphasis, no "DB" prefix in names. The self-test's Wording check enforces this.
- **Screen hierarchy:** exercise name > target pill (holds: big countdown) > Focus card > current cue (follows the voice) > quiet amber safety line; Done is the biggest button. Must fit an iPhone in landscape (~852×320 usable) and portrait.
- **Coach pacing:** set 1 gets intro + all cues spread through the set; later sets get the set number + one reminder; holds spread cues and say "Ten seconds left"; rests say what's next and "Ten seconds. Get ready."
- Polish and clean engineering matter to the owner: no patch-on-patch fixes; restructure when needed.

## Working agreements
- **Push only when the owner asks** ("push it"). Then confirm the Pages build finished and the live files updated.
- **Test before handing anything back** (below) — the owner doesn't want to find regressions by hand.

## Testing (run all before handing back; each is cheap)
1. **Self-test:** `python3 -m http.server <port>` in this folder, open `index.html?selftest=manual` in the browser pane, then in one JS call: `SELFTEST.run().then(()=>0)` and loop on a MessageChannel until `SELFTEST.done`; read `SELFTEST.report`. Never `await setTimeout` in that page (the test replaces it with a virtual clock). Layout: resize to 852×320 and 393×760 and run `SELFTEST.run({days:[], previews:false})`. If the page looks stale, `fetch(file, {cache:'reload'})` then reload.
2. **Real browsers:** `cd tests/e2e && npm install && TMPDIR=/private/tmp/claude-501/pwtmp node real-browsers.mjs --quick` (drop `--quick` to time every demo in Chrome). Known: Firefox won't launch under Playwright on this Mac; Playwright's WebKit can't decode AAC, so its voice checks are skipped.
3. **iPhone (real WebKit):** `xcrun simctl boot "iPhone 17"`, `xcrun simctl openurl booted "http://localhost:<port>/index.html?selftest"`, wait ~30 s, `xcrun simctl io booted screenshot <file>` and read the on-screen report. For tapped flows use the iOS Simulator tool and `?debug` (status bar: sound mode, video state, last line spoken).
4. **Afterwards, always:** `xcrun simctl shutdown all` (a demo left playing in the simulator loops audio on the owner's speakers), close browser-pane tabs, stop test servers. Test audio plays on the owner's Mac.
5. Things only the real phone shows (AirPlay, Low Power Mode): ask the owner for Home → Diagnostics → Run phone check → Copy log.

## Changing the coach's wording
Edit text in `data.js`, then re-record only the changed phrases:
```
.venv/bin/python tools/make_audio.py --models <dir with kokoro-v1.0.onnx and voices-v1.0.bin>
```
Setup (if the venv/models are gone — they were kept in `/private/tmp/claude-501/tts`, which a restart clears): see the header of `tools/make_audio.py` (kokoro-onnx, soundfile; model files from github.com/thewh1teagle/kokoro-onnx releases, `model-files-v1.0`). Voice: `af_heart`, speed 0.95. Every phrase the app can say must have a clip; the self-test fails on "no recording for …".

## Adding or swapping a demo video
1. Find candidates (YouTube search); prefer short, clear, side-on demos.
2. `node tests/e2e/ad-scan.mjs --talk <ids>` — reject any "AD"; the output tells you which have a voice (`voice: true`).
3. Check intro/outro frames and set `start`/`end`; check the cues match what the demo does.
4. Run the tests.
