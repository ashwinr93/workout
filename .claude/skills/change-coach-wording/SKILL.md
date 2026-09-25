---
name: change-coach-wording
description: Use when changing anything the coach says or the screen shows as exercise text in Workout Coach — an exercise's cues, Focus (key) or safety line (stop) in library.js, or a coach phrase in speech.js — including new exercises' text. Covers the wording rules and re-recording the voice clips.
---

# Changing the coach's wording

Every line the coach can say is a pre-recorded clip, so a text change isn't finished until its clip exists.

## 1. Edit the text
- Exercise text is in `library.js`: `cues` (in the order the demo shows them), `key` (the Focus: the one cue that matters most), `stop` (safety). A demo that shows a different variant has its own `name`/`key`/`cues`/`stop` on its video entry.
- Coach phrases are in `speech.js` (`SAY`); spoken name fixes are in `SPOKEN_NAMES`.

## 2. Keep to the wording rules
- It must read well on screen *and* sound natural spoken: no bracketed asides, no pose-name labels ("Cow: …", "Y: …"), just the instruction; "First… / Next… / Finally…" for sequences; no ALL-CAPS emphasis; no "DB" prefix in names.
- Cues match what the demo shows and says; where a demo contradicts the PDF's joint-safety guidance, the PDF wins.
- Cues never restate the Focus; each adds something new (the coach says the Focus last as "Remember, …").
- Pacing rules are in `docs/decisions.md` (Coach pacing).

## 3. Re-record only the changed phrases
```
.venv/bin/python tools/make_audio.py --models <dir with kokoro-v1.0.onnx and voices-v1.0.bin>
```
It records only phrases without a clip (`--fresh` redoes all). Voice `af_heart`, speed 0.95; clips go to `audio/` named by `clipId(text)`, with `audio/manifest.json`.

If the venv or models are gone (they were kept in `/private/tmp/claude-501/tts`, which a restart clears): see the header of `tools/make_audio.py` (kokoro-onnx, soundfile; model files from github.com/thewh1teagle/kokoro-onnx releases, `model-files-v1.0`).

## 4. Check
Run the self-test (CLAUDE.md, Testing): its Wording check enforces the rules above, and it fails on "no recording for …" if any phrase lacks a clip. Listen to one or two new clips if a word might be mispronounced (fix with `SPOKEN_NAMES`, then re-record).
