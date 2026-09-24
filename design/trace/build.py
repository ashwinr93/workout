"""Turn the labelled regions into smooth SVG paths for the app.

Usage: python build.py <segment outdir> <labels.json> <out.json>
Writes {f: {box, parts: [[muscle, svgPath, [x,y,w,h]], …]}, b: {…}} (f = front view, b = back view)."""
import json, sys
import cv2
import numpy as np

S, LABELS_PATH, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
data = json.load(open(S + "/regions.json"))

LAB = json.load(open(LABELS_PATH))
LABELS, LABELS_B = LAB["f"], LAB["b"]

def smooth_path(pts, eps=1.6):
    c = np.array(pts, np.int32).reshape(-1, 1, 2)
    p = cv2.approxPolyDP(c, eps, True).reshape(-1, 2).astype(float)
    n = len(p)
    if n < 3:
        return ""
    # closed Catmull-Rom spline -> cubic Béziers (tension 1/6)
    d = f"M{p[0][0]:.0f},{p[0][1]:.0f}"
    for i in range(n):
        p0, p1, p2, p3 = p[i - 1], p[i], p[(i + 1) % n], p[(i + 2) % n]
        c1 = p1 + (p2 - p0) / 6
        c2 = p2 - (p3 - p1) / 6
        d += f"C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.0f},{p2[1]:.0f}"
    return d + "Z"

regions = {r["id"]: r for r in data["regions"]}
out, seen = {}, set()
for side, labels in (("f", LABELS), ("b", LABELS_B)):
    parts, xs, ys = [], [], []
    for name, ids in labels.items():
        for i in ids:
            r = regions[i]
            assert r["side"] == side, (i, side)
            seen.add(i)
            x0, y0, bw, bh = r["bbox"]
            parts.append([name, smooth_path(r["pts"]), [x0, y0, bw, bh]])
            x, y, w, h = r["bbox"]; xs += [x, x + w]; ys += [y, y + h]
    pad = 6
    out[side] = {"box": [min(xs) - pad, min(ys) - pad, max(xs) - min(xs) + 2 * pad, max(ys) - min(ys) + 2 * pad], "parts": parts}
missing = sorted(set(regions) - seen)
print("unlabelled regions:", missing)
out = {"f": out["f"], "b": out["b"]}
open(OUT, "w").write(json.dumps(out, separators=(",", ":")))
print(OUT, sum(len(v["parts"]) for v in out.values()), "parts")
