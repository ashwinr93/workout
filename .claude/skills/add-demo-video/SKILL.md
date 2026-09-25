---
name: add-demo-video
description: Use when adding a new exercise to Workout Coach's library, or adding, swapping or re-trimming an exercise's YouTube demo video. Covers finding ad-free demos, choosing start/end trims, writing the exercise data and cues, credits and tests.
---

# Adding or swapping a demo video

Scripts run from the repo root with `TMPDIR=/private/tmp/claude-501/pwtmp` (Playwright needs it on this Mac).

1. **Find candidates** (YouTube search). Prefer short, clear, side-on demos of exactly one movement (two movements → two exercises, or one demo showing both).
2. **Ad scan:** `node tests/e2e/ad-scan.mjs --talk <ids>`. Reject any with "AD" (ad-free demos only; no ad-blocker workarounds). The output says which have someone talking: `voice: true`.
3. **Vet:** `node tests/e2e/vet.mjs --out <dir> <ids>` gives title, channel, length and a frame sheet (about every second). Pick `start`/`end` past logos, title cards, chatter and "subscribe" end cards, and write the cues from what the frames show, in the order shown.
4. **Check the trims:** `node tests/e2e/trims.mjs --out <dir> <ids>` shows the real player's frames at the start, +1 s, +2.5 s and just before the end. The first must already show the exercise (no logo, intro or other exercise); the last must show no end cards. `--at 40,42,44` probes exact seconds. Run it with no ids to check every demo before a release.
5. **Thumbnail:** `node tools/thumbs.mjs` flags a black first frame; `--write` picks a brighter still (`thumb` on the video).
6. **Exercise data** in `library.js` (fields listed in CLAUDE.md, "Exercise data"):
   - `videos`: main first, then alternates `{ id, label?, start?, end?, voice? }`. A demo showing a different variant (pigeon vs figure-4, floor vs bench…) gets its own `name`/`key`/`cues`/`stop` (see `docs/decisions.md`, Demo variants).
   - `equip`, `type`, `level`, `easier`/`harder` (symmetric), `muscles` (`{ main, help }`, names from `MUSCLES`), so the AI prompt describes it.
   - `easyOn`/`loads`: check each joint claim against a published biomechanics or physio source. Never guess. A joint is never in both.
   - `key`, `cues`, `stop`: follow the change-coach-wording skill, and record the new clips.
7. **Credits:** `node tools/credits.mjs` rebuilds the README's demo credits.
8. **Test:** the self-test (CLAUDE.md, Testing) and `real-browsers.mjs --quick`; the walkthrough too if the exercise is in a ready-made plan's workout.
