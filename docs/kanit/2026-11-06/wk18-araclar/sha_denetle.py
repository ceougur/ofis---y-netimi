#!/usr/bin/env python3
"""WK 18: docs/kanit/2026-11-06/wk18-*.json içindeki ham_cikti_sha256 ↔ aynı adlı .log dosyasının sha256'sı."""
import glob
import hashlib
import json
import os
import sys

d = sys.argv[1]
kotu = 0
for j in sorted(glob.glob(os.path.join(d, "wk18-*.json"))):
    k = json.load(open(j, encoding="utf-8"))
    log = j[:-5] + ".log"
    h = hashlib.sha256(open(log, "rb").read()).hexdigest()
    ok = h == k["ham_cikti_sha256"] and k["kirli"] == 0 and k["hukum"] == "GEÇTİ"
    kotu += 0 if ok else 1
    print(("tamam " if ok else "UYUŞMAZ ") + os.path.basename(j), k["commit"][:8], k["ozet"]["gecen"], "/", k["ozet"]["toplam"])
sys.exit(1 if kotu else 0)
