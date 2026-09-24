# Muscle map: handoff

Status: built into the app (Sep 2026). The app reads `figures/male.json` and `figures/female.json`; this folder holds the source images and the tracing pipeline that makes them.

## What the feature is
Show which muscles an exercise works, for people who don't know muscle names. Rules the owner signed off on after many rounds:

- **Artwork:** traced from the owner's ChatGPT images, `male-front-back.png` and `female-front-back.png` (flat grey body, black lines between muscles, front on the left and back on the right). **Never hand-draw the body in SVG.** The owner rejected about 6 hand-drawn versions (blocky, short, feminine stance on the male figure, stick calves). Tracing the image-model art is what worked.
- **Colours:** body grey `#4b5260`, main muscles solid `#3ddc97` (the app's accent), helping muscles striped in the same green (two shades of green, first `#1f9e6a` then `#1d8f62`, were too hard to tell apart on a small figure). No outlines: the thin dark lines are just gaps between shapes showing the background.
- **Where it appears (little text where space is tight):**
  - Exercise rows (day screen): a 44px **circular badge** at the right, plus the muscle names in the existing meta line, e.g. "3 × 8–10 · Hamstrings, glutes".
  - Player: the muscle names added to the existing set label ("Set 1 of 3 · Chest, shoulders") and a badge (~76px) beside the exercise name. Nothing else on the panel moves.
  - Rest screen: a larger badge beside the countdown and "Up next".
  - Day summary card and finish screen: full front and back figures, with main and helping muscles for the whole session.
  - Never draw over the YouTube video.
- **Badges frame themselves:** zoom to a square around the bounding boxes of the *main* muscles, padded ×1.6, minimum 420 units (the owner asked for enough surrounding body to show the contrast; ×1.22 / 280 was too tight). So any exercise, including user-created ones, gets a sensible badge. See `focus()` in the mockup code below.
- **Male/female figure:** both traced with identical muscle names. Where the choice lives is decided below.
- `muscle-map-male-female.png` is the approved mockup.

## Muscle names (the same on both figures)
Front: head, neck, traps, delts, chest, biceps, triceps, forearms, hands, obliques, abs, hip, adductors, quads, knees, calves, shins, feet.
Back: head, traps, delts, upperback, triceps, forearms, hands, lats, lowerback, glutes, quads, adductors, hams, knees, calves, feet.
Only muscles are ever highlighted; head, neck, hands, knees and feet are silhouette only (hip is now hip flexors, and back-view delts become rear delts; see below). (On the male back view the hand and lower forearm are one shape, labelled forearms.)

## Pipeline (`trace/`)
Needs Python with `numpy pillow opencv-python-headless`; use a venv outside the repo.
1. `python trace/segment.py <image.png> <outdir>` upscales ×2, finds every enclosed grey region, and writes `regions.json` plus a numbered map `regions.png`.
2. Label the numbers in `trace/labels-<male|female>.json` (`{"f": {muscle: [ids]}, "b": {...}}`). The numbers depend on the image, so re-check `regions.png` whenever the image changes.
3. `python trace/build.py <outdir> trace/labels-<male|female>.json ../figures/<male|female>.json` writes `{f:{box, parts:[[muscle, svgPath, [x,y,w,h]], …]}, b:{…}}`. Paths are smoothed Catmull-Rom curves, about 65 KB per figure.
4. Verify by rendering every muscle highlighted alone on the full figure (a grid), and check that each lands where it should.

Rendering is just `<path fill=…>` per part inside an `<svg viewBox>` (the figure's `box`, or the badge crop). No strokes are needed.

## Decided in the personalisation session (2026-09-24)
- **Muscles live on the exercise** in `library.js` (`muscles: { main: [...], help: [...] }`), overridden on a video variant only when the demo works different muscles (sumo vs goblet). Plans never carry muscles; the app looks them up, so every AI-made plan gets badges. The AI prompt lists them too.
- **Figure choice is a device setting** ("Figure: male · female" on the day summary card, remembered per device). Not in the plan link, never asked by the AI. Default male until chosen.
- **Hip flexors:** the front `hip` region lights up as `hipflexors` (couch stretch). It stops being silhouette-only.
- **Rear delts:** the back-view delts are relabelled `reardelts`; front-view `delts` means front/side delts.
- **Real names on screen** (e.g. "Lats", "Rear delts", "Hamstrings"), never simplified: seeing the term next to the highlighted body part teaches people the gym vocabulary over time.
  On-screen names: Traps, Delts, Rear delts, Chest, Upper back, Lats, Lower back, Biceps, Triceps, Forearms, Abs, Obliques, Glutes, Hip flexors, Adductors, Quads, Hamstrings, Calves, Shins. (Owner chose Chest, Upper back, Lower back and Shins over Pecs, Rhomboids, Erectors and Tibialis.)
- **Badge view:** when main muscles are on both views, the badge shows the view with the most main-muscle area; the full figures show everything.

## Still to do
1. Muscles per exercise: drafted and reviewed with the owner; they go into `library.js` with Phase 2's exercise details.
2. Relabel `hip` → `hipflexors` and back-view `delts` → `reardelts` in both label files, then rebuild the figures.
3. Build: ship both `figure.js` outputs (consider lazy-loading, since they're 65 KB each), add the badge, meta-line text, summary and finish views, extend the self-test (every exercise has muscles, every name exists on the figure), and keep the layout checks passing at 852×320, 402×700 and 393×760.
4. The figure switch on the day summary card.
5. Optional: the coach says "This one works your …" during rests (needs new recordings).
