"""Split design/figure.png into its enclosed grey regions and draw a numbered map for labelling."""
import json, sys
import cv2
import numpy as np

SRC, OUT = sys.argv[1], sys.argv[2]
img = cv2.imread(SRC)
img = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
grey = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
mask = (grey > 90).astype(np.uint8)            # body grey ~128; lines and background dark
mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
n, lab, stats, cent = cv2.connectedComponentsWithStats(mask, connectivity=4)

H, W = grey.shape
regions = []
for i in range(1, n):
    x, y, w, h, area = stats[i]
    if area < 300:
        continue
    comp = (lab == i).astype(np.uint8) * 255
    cs, _ = cv2.findContours(comp, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    c = max(cs, key=cv2.contourArea)
    regions.append({"id": len(regions), "side": "f" if cent[i][0] < W / 2 else "b",
                    "cx": float(cent[i][0]), "cy": float(cent[i][1]), "area": int(area),
                    "bbox": [int(x), int(y), int(w), int(h)],
                    "pts": c.reshape(-1, 2).tolist()})

# numbered map: each region tinted, id written at its centroid
vis = np.zeros_like(img)
rng = np.random.default_rng(3)
for r in regions:
    col = [int(v) for v in rng.integers(70, 230, 3)]
    cv2.drawContours(vis, [np.array(r["pts"], np.int32)], -1, col, -1)
for r in regions:
    t = str(r["id"]); cx, cy = int(r["cx"]), int(r["cy"])
    cv2.putText(vis, t, (cx - 9 * len(t), cy + 7), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 0, 0), 4, cv2.LINE_AA)
    cv2.putText(vis, t, (cx - 9 * len(t), cy + 7), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)
cv2.imwrite(OUT + "/regions.png", vis)
json.dump({"w": W, "h": H, "regions": regions}, open(OUT + "/regions.json", "w"))
print(len(regions), "regions;", sum(r["side"] == "f" for r in regions), "front,", sum(r["side"] == "b" for r in regions), "back")
