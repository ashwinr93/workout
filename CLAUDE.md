# Workout Coach

A static web app that plays a weekly workout plan with YouTube demo videos, a pre-recorded coach voice, and timers. It opens with the owner's own plan (from their "Joint-Friendly Workout Routine" PDF), which they use on an iPhone held **landscape**, AirPlay-mirrored to a TV (Xiaomi), and sometimes on a Mac (Firefox).

Anyone can get their own plan without code: **Create your own plan** opens an AI chat (their own account) with a message from `prompt.js`; the AI interviews them and writes the plan as a link (`#v1/…`), which the app reads. Audience: beginners to moderately experienced people (not bodybuilders), at home or in a gym, including shy gym-goers.

Live: https://ashwinr93.github.io/workout/ (branch `main`). Staging: https://ashwinr93.github.io/workout/staging/ (branch `staging`). Both are published by `.github/workflows/pages.yml` (GitHub Pages, source "GitHub Actions"); a push to either branch redeploys both. Staging keeps its saved data under separate keys (`STORE_PREFIX`). `gh` is logged in as ashwinr93.

## Files

| File | What it is |
|---|---|
| `index.html` | Markup only: tab screens (My week, Plans, Exercises) with a bottom tab bar, a plan's preview, day, create-a-plan, fix-a-link, player |
| `styles.css` | Design tokens and layout; compact rules for landscape phone (`max-height: 520px`) and portrait phone |
| `library.js` | The exercise library (`EX`), `WARMUP`, `COOLDOWN`, `ACTIVITIES` (walk, run, sport…), `variant()`, `MUSCLES` (figure muscle → name on screen), `muscleList()`, `GEAR` (equipment filter: each kind also shows what needs less), `AREAS` + `areasOf()` (body areas) |
| `figures/` | `male.json`, `female.json`: the muscle map, traced from the owner's images by `design/trace/` (never hand-drawn; see `design/README.md`) |
| `plan.js` | The plan link format: `DOSE` (the amounts a plan may use), `parsePlan()` (forgiving reader → plan, problems, fixes), `planLink()`, `dose()` (plan numbers over library defaults), `EXAMPLE_PLAN` (the owner's week as a link, plus its subtitle and day goals) |
| `speech.js` | All narration wording: `SAY`, `SPOKEN_NAMES`, `speakable()`, `clipId()`, `allPhrases()` (every phrase any plan can produce) |
| `programs.js` | `PROGRAMS`: the ready-made plans (plan links + title, goals, level, minutes, equipment, who it's for), designed from ACSM / Schoenfeld / WHO guidance; the owner's week is one of them |
| `prompt.js` | `coachPrompt()` (the AI message, generated from the library), `AI_CHATS` (prefill links; Gemini is copy-and-open), `SITE` |
| `app.js` | The app, one owner per concern: `Diag`, `Beep`, `Voice` (coach), `Video` (YouTube), `Sound` (who talks), `Narration` (what's said when), `Workout` (steps/timer), `Figure` (muscle map: badges, front/back figures, male/female), `Plans` (which plan is open), `UI`, `Diagnostics` (phone check) |
| `tools/load.cjs` | Loads the four data files in Node as the browser does (used by the tools and scripts) |
| `audio/` | One `.m4a` per phrase, named by `clipId(text)`, plus `manifest.json` (id → seconds) |
| `photos/` | The plan photos (Unsplash, 1000 px), saved by `tools/photos.mjs` from `photo` in `programs.js`; served by the site itself |
| `icons/`, `manifest.webmanifest` | App icon (`icon.svg`, rendered to PNGs by `tests/e2e/icons.mjs`) and the web app manifest |
| `tools/thumbs.mjs` | Flags demos whose YouTube thumbnail is a black frame and picks a brighter still (`thumb` on the video); `--write` applies it |
| `tools/photos.mjs` | Downloads any missing plan photo into `photos/` (run after adding/swapping one, then `credits.mjs`) |
| `tools/credits.mjs` | Rebuilds the README's "Demo videos" credits from `library.js` and the plan photos from `programs.js` (run after adding/swapping a video or photo) |
| `tools/make_audio.py` | Records every phrase from `allPhrases()` with the Kokoro voice `af_heart` |
| `tests/selftest.js` | Fast self-test (virtual clock, fake YouTube); runs with `index.html?selftest` |
| `tests/review.js` | `index.html?review=<screen>` opens one screen for screenshots (home, home-end, day, day-end, create, player, rest, finish; a plan link after `#`); nothing is saved |
| `tests/e2e/` | Playwright: `real-browsers.mjs` (real YouTube, real clicks), `ad-scan.mjs` (ads + which demos have a voice), `review.mjs` (review screenshots, below), `trims.mjs` (every demo's start/end frames), `screenshots.mjs` (regenerates `docs/*.png` for the README, and `docs/share.jpg`, the link preview (under 300 KB for WhatsApp)), `icons.mjs` (app icon PNGs) |
| `README.md` | The owner's own words at the top (what it is, how I use it, why this exists, make it yours: vibe coded with Claude, fork it), then usage tips and the technical guide ("Under the hood") — keep it true when behaviour changes; re-run `screenshots.mjs` after visual changes. Public wording rules (owner): don't make any one way of using it sound required (TV, phone, a particular AI), no counts that go stale (plans, exercises), modest (a simple app built to scratch an itch), British spelling, never reuse the owner's old posts verbatim |

### Exercise data (`EX` in `library.js`)
`name`, `sets?`, `reps`+`unit` **or** `time` (seconds) — defaults, a plan sets its own — `perSide?`, `measure?` (`"m"`: reps are metres), `rest`, `equip`, `type` (movement pattern from `TYPES`; `"stretch"` for stretches), `level` (beginner | intermediate), `easyOn` / `loads` (joints from `JOINTS`, **verified against published biomechanics / physio guidance — never guessed**), `easier?` / `harder?` (symmetric), `muscles` (`{ main, help }`, names from `MUSCLES`; for stretches, what's stretched; a variant demo can override these and `level`/`easyOn`/`loads`), `key` (the one cue that matters most → "Focus"), `cues` (in the order the demo shows them), `stop` (safety), `videos` (main first, then alternates: `{ id, label?, start?, end?, voice?, name?, key?, cues?, stop? }`). `voice: true` means someone talks in the demo; `name`/`key`/`cues`/`stop` on a video make it a variant with its own text.

## Product rules (decided with the owner — keep them)
The full detail and the reasons are in `docs/decisions.md`, one section per feature (named in brackets below). **Read that section before changing the feature**, and update it with the change.
- **One sound at a time:** coach | video | off; coach by default each session; never mute a video on a guess (Sound).
- **Ad-free demos only:** every new or swapped video passes `ad-scan.mjs`; no ad-blocker or tracking workarounds.
- **One movement per exercise.** Two movements → two exercises, or one demo showing both. Several demos on one exercise are either/or alternates behind ‹ › (never auto-cycled). A demo showing a different variant gets its own `name`/`key`/`cues`/`stop` (Demo variants).
- **Trim intros/outros** (logos, title cards, "subscribe" endings) with `start`/`end`; check with `trims.mjs`.
- **Cues match what the demo shows/says.** Where a demo contradicts the PDF's joint-safety guidance, the PDF wins.
- **Wording:** every cue reads well *and* sounds natural spoken: no bracketed asides, no pose-name labels ("Cow: …"), "First… / Next… / Finally…" for sequences, no ALL-CAPS, no "DB" prefix. The self-test's Wording check enforces it.
- **The screen alone says where you are** (which exercise, which set, resting or not) with the sound off (Where you are, without sound).
- **Player hierarchy:** name > target > Focus > current cue > quiet safety line; Done biggest; must fit an iPhone in landscape (~852×320) and portrait; trim copy rather than squeeze (Player screen). Quick facts stay off the coaching screen (Quick facts).
- **Coach pacing:** Focus last as "Remember, …", cues never restate it, later sets rotate (Coach pacing).
- **Real muscle names, never simplified;** the muscle map's colours, stripes and placement are fixed (Muscle map).
- **Navigation:** tabs on top-level screens only; tapping an exercise plays its preview at once; a plan's preview never changes your week; photo plan cards, no goal colours (Navigation, Plans and Exercises; My week).
- **Plans come only from the library.** An AI picks exercises and amounts; it never adds content. Every amount in `DOSE` has a recorded clip (rep ranges 6–8, 8–10, 10–12, 12–15, 15–20). The parser fixes what it safely can and sends the rest to "This link needs a fix". Keep the link format backwards compatible (`v1`); a breaking change needs `v2` with `v1` still readable.
- **A plan lives in its link;** the last plan is remembered on the device. Nothing about the person is stored or sent anywhere beyond anonymous counts (Analytics: live site only, never a plan, its title or anything typed).
- **Nimble screens:** never rebuild a screen to change one thing; images paint in the first frame (Nimble screens).
- **AI chats:** ChatGPT, Claude, Gemini, DeepSeek; keep the message compact (links under 16,000 characters); no custom GPTs/Gems/Projects (AI chats).
- **Home Screen:** the icon must open the person's plan; the manifest has no `start_url` (Home Screen).
- **Day screen:** warm-up and cool-down are optional sections with a switch; day kinds are workout, stretch and activity (Day screen).
- **Releases** stamp the commit into `index.html` so phones never mix old and new files (Releases). The link preview card is `docs/share.jpg`; bump its `?v=` when it changes (Link preview card).
- Polish and clean engineering matter to the owner: no patch-on-patch fixes; restructure when needed.

## Working agreements
- **Default flow: tested changes go to staging first** (`git push --force origin HEAD:staging`; prod is untouched), the owner checks them on the phone, then "push it" / "push to prod" → push `main`. Confirm each deploy: the "Deploy Pages" run finished (`gh run list --workflow pages.yml`) and the files at that address updated.
- **Review screenshots only when the owner asks** (they slow iteration): `cd tests/e2e && TMPDIR=/private/tmp/claude-501/pwtmp node review.mjs --out <dir>` → `sheet-desktop.png`, `sheet-iphone-portrait.png` (the iPhone simulator's Safari), `sheet-iphone-landscape.png` (WebKit at 852×393; this Mac can't rotate the simulator). `--screens` limits the screens, `--base <url>` shoots staging or live. Anything that depends on the Home Screen app (status bar, top safe area) needs the simulator's Home Screen app by hand.
- **Test before handing anything back** (below) — the owner doesn't want to find regressions by hand.

## Testing (run all before handing back; each is cheap)
1. **Self-test:** `python3 -m http.server <port>` in this folder, open `index.html?selftest=manual` in the browser pane, then in one JS call: `SELFTEST.run().then(()=>0)` and loop on a MessageChannel until `SELFTEST.done`; read `SELFTEST.report`. Never `await setTimeout` in that page (the test replaces it with a virtual clock). Layout: resize to 852×320, 402×700 and 393×760 and run `SELFTEST.run({days:[], previews:false})`. If the page looks stale, `fetch(file, {cache:'reload'})` then reload.
2. **Real browsers:** `cd tests/e2e && npm install && TMPDIR=/private/tmp/claude-501/pwtmp node real-browsers.mjs --quick` (drop `--quick` to time every demo in Chrome). Known: Firefox won't launch under Playwright on this Mac; Playwright's WebKit can't decode AAC, so its voice checks are skipped.
3. **iPhone (real WebKit):** `xcrun simctl boot "iPhone 17"`, `xcrun simctl openurl booted "http://localhost:<port>/index.html?selftest"`, wait ~30 s, `xcrun simctl io booted screenshot <file>` and read the on-screen report. For tapped flows use the iOS Simulator tool and `?debug` (status bar: sound mode, video state, last line spoken).
4. **Before any release that touches the workout flow: the first-time-user walkthrough.** `cd tests/e2e && TMPDIR=/private/tmp/claude-501/pwtmp node walkthrough.mjs --out <dir>` plays the main flow (week → today → Start → Skip warm-up → Done / Skip rest through several sets → ✕ → Leave) in real Chrome with real YouTube and **sound off**, portrait and landscape, and writes `walkthrough.txt` (what each screen says) and `sheet-portrait.png` / `sheet-landscape.png`. Read them as someone who has never seen the app: can you always tell what to do, which exercise and set you're on, and whether you're resting? Tests check what the app does; this checks what a person understands.
5. **Afterwards, always:** `xcrun simctl shutdown all` (a demo left playing in the simulator loops audio on the owner's speakers), close browser-pane tabs, stop test servers. Test audio plays on the owner's Mac.
6. Things only the real phone shows (AirPlay, Low Power Mode): ask the owner for Home → Diagnostics → Run phone check → Copy log.

## Changing the coach's wording
Edit text in `library.js` (cues, Focus, safety) or `speech.js` (coach phrases), then re-record only the changed phrases:
```
.venv/bin/python tools/make_audio.py --models <dir with kokoro-v1.0.onnx and voices-v1.0.bin>
```
Setup (if the venv/models are gone — they were kept in `/private/tmp/claude-501/tts`, which a restart clears): see the header of `tools/make_audio.py` (kokoro-onnx, soundfile; model files from github.com/thewh1teagle/kokoro-onnx releases, `model-files-v1.0`). Voice: `af_heart`, speed 0.95. Every phrase the app can say must have a clip; the self-test fails on "no recording for …".

## Adding or swapping a demo video
1. Find candidates (YouTube search); prefer short, clear, side-on demos.
2. `node tests/e2e/ad-scan.mjs --talk <ids>` — reject any "AD"; the output tells you which have a voice (`voice: true`).
3. `node tests/e2e/vet.mjs --out <dir> <ids>` — title, channel, length and a frame sheet (every ~1 s) per video: pick `start`/`end` past logos, "subscribe" end cards and chatter, and write cues from what the frames show.
4. `node tests/e2e/trims.mjs --out <dir> <ids>` — the real player's frames at the chosen start, +1 s, +2.5 s and just before the end: the first must already show the exercise (no logo, intro or other exercise), the last no end cards (`--at 40,42,44` probes exact seconds). Run it with no ids to check every demo before a release.
5. `node tools/credits.mjs` to update the README credits.
6. Fill in `equip`, `type`, `level`, `easyOn`/`loads` (check each joint claim against a published source), `easier`/`harder` and `muscles` so the AI prompt describes it; record its clips (`make_audio.py`).
7. Run the tests.
