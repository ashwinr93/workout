"""Pre-record every phrase the workout coach says.

Reads the phrases from the app (allPhrases() in speech.js, via node), speaks each one with the Kokoro
neural voice, and writes audio/<clipId>.m4a plus audio/manifest.json
(clipId -> duration in seconds). Clips that already exist are skipped, so
re-running after editing a cue only records the changed phrases.

Setup (once):
    python3 -m venv .venv && .venv/bin/pip install kokoro-onnx soundfile
    download kokoro-v1.0.onnx and voices-v1.0.bin from
    https://github.com/thewh1teagle/kokoro-onnx/releases (model-files-v1.0)

Usage:
    .venv/bin/python tools/make_audio.py --models /path/to/model/dir [--voice af_heart] [--fresh]
"""
import argparse
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "audio")
FADE_S = 0.015     # tiny fade in/out so clips never start or end with a click
PAD_S = 0.08       # a little silence either side


def load_phrases():
    js = 'const d=require("./tools/load.cjs"); console.log(JSON.stringify(d.allPhrases().map(t=>[d.clipId(t),t])))'
    return json.loads(subprocess.check_output(["node", "-e", js], cwd=ROOT))


def trim_and_fade(audio, sr):
    loud = np.where(np.abs(audio) > 0.01)[0]
    if len(loud):
        audio = audio[max(0, loud[0] - int(0.02 * sr)): loud[-1] + int(0.05 * sr)]
    n = int(FADE_S * sr)
    if len(audio) > 2 * n:
        ramp = np.linspace(0, 1, n, dtype=audio.dtype)
        audio[:n] *= ramp
        audio[-n:] *= ramp[::-1]
    pad = np.zeros(int(PAD_S * sr), dtype=audio.dtype)
    return np.concatenate([pad, audio, pad])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", required=True, help="folder with kokoro-v1.0.onnx and voices-v1.0.bin")
    ap.add_argument("--voice", default="af_heart")
    ap.add_argument("--speed", type=float, default=0.95)
    ap.add_argument("--fresh", action="store_true", help="re-record every clip (e.g. after changing voice)")
    args = ap.parse_args()

    os.makedirs(OUT, exist_ok=True)
    kokoro = Kokoro(os.path.join(args.models, "kokoro-v1.0.onnx"), os.path.join(args.models, "voices-v1.0.bin"))
    lang = "en-gb" if args.voice.startswith("b") else "en-us"
    phrases = load_phrases()
    manifest_path = os.path.join(OUT, "manifest.json")
    manifest = {} if args.fresh or not os.path.exists(manifest_path) else json.load(open(manifest_path))

    wanted = set()
    for i, (cid, text) in enumerate(phrases, 1):
        wanted.add(cid)
        dest = os.path.join(OUT, cid + ".m4a")
        if not args.fresh and cid in manifest and os.path.exists(dest):
            continue
        audio, sr = kokoro.create(text, voice=args.voice, speed=args.speed, lang=lang)
        audio = trim_and_fade(audio.astype(np.float32), sr)
        with tempfile.NamedTemporaryFile(suffix=".wav") as wav:
            sf.write(wav.name, audio, sr, subtype="PCM_16")
            subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "64000", wav.name, dest], check=True)
        manifest[cid] = round(len(audio) / sr, 2)
        print(f"[{i}/{len(phrases)}] {cid} {text}", flush=True)

    # drop clips for phrases that no longer exist
    for cid in list(manifest):
        if cid not in wanted:
            manifest.pop(cid)
            try:
                os.remove(os.path.join(OUT, cid + ".m4a"))
            except FileNotFoundError:
                pass
    json.dump(manifest, open(manifest_path, "w"), indent=0, sort_keys=True)
    print(f"{len(manifest)} clips in {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
