# Workout Coach

A static web app that plays a weekly workout plan with YouTube demo videos, a pre-recorded coach voice, and timers. It opens with the owner's own plan (from their "Joint-Friendly Workout Routine" PDF), which they use on an iPhone held **landscape**, AirPlay-mirrored to a TV (Xiaomi), and sometimes on a Mac (Firefox).

Anyone can get their own plan without code: **Create your own plan** opens an AI chat (their own account) with a message from `prompt.js`; the AI interviews them and writes the plan as a link (`#v1/…`), which the app reads. Audience: beginners to moderately experienced people (not bodybuilders), at home or in a gym, including shy gym-goers.

Live: https://ashwinr93.github.io/workout/ (branch `main`). Staging: https://ashwinr93.github.io/workout/staging/ (branch `staging`). Both are published by `.github/workflows/pages.yml` (GitHub Pages, source "GitHub Actions"); a push to either branch redeploys both. Staging keeps its saved data under separate keys (`STORE_PREFIX`). `gh` is logged in as ashwinr93.

## Files

| File | What it is |
|---|---|
| `index.html` | Markup only (home, day, create-a-plan, fix-a-link, player screens) |
| `styles.css` | Design tokens and layout; compact rules for landscape phone (`max-height: 520px`) and portrait phone |
| `library.js` | The exercise library (`EX`), `WARMUP`, `COOLDOWN`, `ACTIVITIES` (walk, run, sport…), `variant()`, `MUSCLES` (figure muscle → name on screen), `muscleList()` |
| `figures/` | `male.json`, `female.json`: the muscle map, traced from the owner's images by `design/trace/` (never hand-drawn; see `design/README.md`) |
| `plan.js` | The plan link format: `DOSE` (the amounts a plan may use), `parsePlan()` (forgiving reader → plan, problems, fixes), `planLink()`, `dose()` (plan numbers over library defaults), `EXAMPLE_PLAN` (the owner's week as a link, plus its subtitle and day goals) |
| `speech.js` | All narration wording: `SAY`, `SPOKEN_NAMES`, `speakable()`, `clipId()`, `allPhrases()` (every phrase any plan can produce) |
| `prompt.js` | `coachPrompt()` (the AI message, generated from the library), `AI_CHATS` (prefill links; Gemini is copy-and-open), `SITE` |
| `app.js` | The app, one owner per concern: `Diag`, `Beep`, `Voice` (coach), `Video` (YouTube), `Sound` (who talks), `Narration` (what's said when), `Workout` (steps/timer), `Figure` (muscle map: badges, front/back figures, male/female), `Plans` (which plan is open), `UI`, `Diagnostics` (phone check) |
| `tools/load.cjs` | Loads the four data files in Node as the browser does (used by the tools and scripts) |
| `audio/` | One `.m4a` per phrase, named by `clipId(text)`, plus `manifest.json` (id → seconds) |
| `tools/credits.mjs` | Rebuilds the README's "Demo videos" credits from `library.js` (run after adding/swapping a video) |
| `tools/make_audio.py` | Records every phrase from `allPhrases()` with the Kokoro voice `af_heart` |
| `tests/selftest.js` | Fast self-test (virtual clock, fake YouTube); runs with `index.html?selftest` |
| `tests/review.js` | `index.html?review=<screen>` opens one screen for screenshots (home, home-end, day, day-end, create, player, rest, finish; a plan link after `#`); nothing is saved |
| `tests/e2e/` | Playwright: `real-browsers.mjs` (real YouTube, real clicks), `ad-scan.mjs` (ads + which demos have a voice), `review.mjs` (review screenshots, below), `screenshots.mjs` (regenerates `docs/*.png` for the README) |
| `README.md` | Public story, usage tips and "make it yours" guide — keep it true when behaviour changes; re-run `screenshots.mjs` after visual changes |

### Exercise data (`EX` in `library.js`)
`name`, `sets?`, `reps`+`unit` **or** `time` (seconds) — defaults, a plan sets its own — `perSide?`, `measure?` (`"m"`: reps are metres), `rest`, `equip` + `about` (short; the AI prompt lists them), `kind?` (`"stretch"`), `muscles` (`{ main, help }`, names from `MUSCLES`; for stretches, what's stretched; a variant demo can override), `key` (the one cue that matters most → "Focus"), `cues` (in the order the demo shows them), `stop` (safety), `videos` (main first, then alternates: `{ id, label?, start?, end?, voice?, name?, key?, cues?, stop? }`). `voice: true` means someone talks in the demo; `name`/`key`/`cues`/`stop` on a video make it a variant with its own text.

## Product rules (decided with the owner — keep them)
- **One sound at a time.** `Sound.mode` is `coach` | `video` | `off`. Coach is the default at the start of every workout/preview; Video lasts only for that session. On a demo with no voice, the coach speaks even in Video mode. Unmuting with YouTube's own speaker switches to Video. The app never mutes a video on a guess.
- **Ad-free demos only.** Any new or swapped video must pass `ad-scan.mjs` (no "AD"). No ad-blocker / cross-site-tracking workarounds.
- **One movement per exercise.** Two movements → two exercises, or one demo showing both. Multiple demos on one exercise are either/or alternates behind ‹ › (never auto-cycled).
- **Variants follow the demo.** When a demo is a different variant (pigeon vs figure-4, floor vs bench, sumo vs goblet…), give that video entry its own `name`/`key`/`cues`/`stop`; the screen and the coach then use the active demo's text (`variant(key, vi)`), switching demos restarts the coaching, and the choice is remembered per exercise (`store "demos"`). Plain alternates showing the same movement share the exercise's text.
- **Trim intros/outros** (logos, title cards, "subscribe" endings) with `start`/`end`; check first/last seconds via YouTube storyboards.
- **Cues must match what the demo shows/says.** Where a demo contradicts the PDF's joint-safety guidance, the PDF wins.
- **Wording:** every cue must read well *and* sound natural when the coach says it — no bracketed asides, no pose-name labels ("Cow: …", "Y: …") — just the instruction (use "First… / Next… / Finally…" for sequences), no ALL-CAPS emphasis, no "DB" prefix in names. The self-test's Wording check enforces this.
- **Screen hierarchy:** exercise name > target pill (holds: big countdown) > Focus card > current cue (follows the voice) > quiet amber safety line; Done is the biggest button. Must fit an iPhone in landscape (~852×320 usable) and portrait. Panel = scrollable `.panel-body` + `.controls` pinned to the bottom; never let flex squeeze content (`flex-shrink:0` on body children) — trim copy/spacing instead. The top bar stays inside the safe area (Dynamic Island). The Home Screen app uses an opaque status bar (`apple-mobile-web-app-status-bar-style: black`): with `black-translucent`, iOS 26 launches the page scrolled to −62 pt and later lets content slide under the status bar.
- **Coach pacing:** set 1: name and target, the cues spread through the set, then the Focus last as "Remember, …" (never before the movement has been described). Cues never restate the Focus — each cue adds something new. Set 2 (or the second side): the Focus is the one reminder; later sets rotate other cues. Holds spread cues then the Focus, before "Ten seconds left". Rests say what's next and "Ten seconds. Get ready."
- **Muscle map:** main muscles `#3ddc97`, helping `#1d8f62`, body `#4b5260` (chosen so helping stays visible against the body on small figures), and every list of muscles carries its colour dot and "Main:"/"Helping:" label. Badges frame themselves on the main muscles (view with the most main-muscle area). Rows: badge + "amount · main muscles"; player: main muscles in the set line and a badge beside the name/target (portrait: beside the target, name keeps the full width); rest: badge beside "Up next"; day summary card and finish screen: full front and back figures. Real muscle names on screen, never simplified. The male/female figure is switched by a quiet "Show female/male figure" link under the day card's figures (`store "figure"`): only where the figures are visible, never as a prominent control (it looked like it changed the workout) and not on the home page (meaningless before you've seen a figure) or the player; never in the plan link, never asked by the AI.
- **Plans come only from the library.** An AI picks exercises and amounts; it never adds content. Every amount in `DOSE` has a recorded clip (standard rep ranges only: 6–8, 8–10, 10–12, 12–15, 15–20). The parser fixes what it safely can (case, spaces, near-miss ids, out-of-range numbers) and reports the rest on the "This link needs a fix" screen with a message to paste back to the AI. Keep the link format backwards compatible (`v1`); a breaking change needs `v2` with `v1` still readable.
- **A plan lives in its link.** The last plan opened is remembered on the device (`store "plan"`, recent ones in `"plans"`); no plan → the example. Nothing about the person is stored or sent anywhere.
- **Day kinds:** workout; stretch (only stretches: section "cool", 10 s rests); activity (one activity, e.g. `sport` for the owner's football: warm-up and cool-down buttons, no player).
- **AI prefill:** ChatGPT, Claude, Copilot, Perplexity, Grok, Le Chat take the message via `?q=` (owner-tested). Gemini can't, so it's copy-and-open — switch it when Google supports a prompt parameter. No custom GPTs/Gems/Projects (users would have to remember them).
- Polish and clean engineering matter to the owner: no patch-on-patch fixes; restructure when needed.

## Working agreements
- **Default flow: tested changes go to staging first** (`git push --force origin HEAD:staging`; prod is untouched), the owner checks them on the phone, then "push it" / "push to prod" → push `main`. Confirm each deploy: the "Deploy Pages" run finished (`gh run list --workflow pages.yml`) and the files at that address updated.
- **Review screenshots only when the owner asks** (they slow iteration): `cd tests/e2e && TMPDIR=/private/tmp/claude-501/pwtmp node review.mjs --out <dir>` → `sheet-desktop.png`, `sheet-iphone-portrait.png` (the iPhone simulator's Safari), `sheet-iphone-landscape.png` (WebKit at 852×393; this Mac can't rotate the simulator). `--screens` limits the screens, `--base <url>` shoots staging or live. Anything that depends on the Home Screen app (status bar, top safe area) needs the simulator's Home Screen app by hand.
- **Test before handing anything back** (below) — the owner doesn't want to find regressions by hand.

## Testing (run all before handing back; each is cheap)
1. **Self-test:** `python3 -m http.server <port>` in this folder, open `index.html?selftest=manual` in the browser pane, then in one JS call: `SELFTEST.run().then(()=>0)` and loop on a MessageChannel until `SELFTEST.done`; read `SELFTEST.report`. Never `await setTimeout` in that page (the test replaces it with a virtual clock). Layout: resize to 852×320, 402×700 and 393×760 and run `SELFTEST.run({days:[], previews:false})`. If the page looks stale, `fetch(file, {cache:'reload'})` then reload.
2. **Real browsers:** `cd tests/e2e && npm install && TMPDIR=/private/tmp/claude-501/pwtmp node real-browsers.mjs --quick` (drop `--quick` to time every demo in Chrome). Known: Firefox won't launch under Playwright on this Mac; Playwright's WebKit can't decode AAC, so its voice checks are skipped.
3. **iPhone (real WebKit):** `xcrun simctl boot "iPhone 17"`, `xcrun simctl openurl booted "http://localhost:<port>/index.html?selftest"`, wait ~30 s, `xcrun simctl io booted screenshot <file>` and read the on-screen report. For tapped flows use the iOS Simulator tool and `?debug` (status bar: sound mode, video state, last line spoken).
4. **Afterwards, always:** `xcrun simctl shutdown all` (a demo left playing in the simulator loops audio on the owner's speakers), close browser-pane tabs, stop test servers. Test audio plays on the owner's Mac.
5. Things only the real phone shows (AirPlay, Low Power Mode): ask the owner for Home → Diagnostics → Run phone check → Copy log.

## Changing the coach's wording
Edit text in `library.js` (cues, Focus, safety) or `speech.js` (coach phrases), then re-record only the changed phrases:
```
.venv/bin/python tools/make_audio.py --models <dir with kokoro-v1.0.onnx and voices-v1.0.bin>
```
Setup (if the venv/models are gone — they were kept in `/private/tmp/claude-501/tts`, which a restart clears): see the header of `tools/make_audio.py` (kokoro-onnx, soundfile; model files from github.com/thewh1teagle/kokoro-onnx releases, `model-files-v1.0`). Voice: `af_heart`, speed 0.95. Every phrase the app can say must have a clip; the self-test fails on "no recording for …".

## Adding or swapping a demo video
1. Find candidates (YouTube search); prefer short, clear, side-on demos.
2. `node tests/e2e/ad-scan.mjs --talk <ids>` — reject any "AD"; the output tells you which have a voice (`voice: true`).
3. Check intro/outro frames and set `start`/`end`; check the cues match what the demo does.
4. `node tools/credits.mjs` to update the README credits.
5. Fill in `equip`/`about` (and `kind: "stretch"` for stretches) so the AI prompt describes it; record its clips (`make_audio.py`).
6. Run the tests.
