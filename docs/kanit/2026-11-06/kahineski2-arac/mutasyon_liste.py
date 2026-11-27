#!/usr/bin/env python3
"""kos.mjs'in mutasyon kümesini (elle senaryolar + kipler) programsız kurar: python3 -I mutasyon_liste.py <cari_klasoru> <cikti.json>"""
import importlib.util
import json
import os
import sys

s = importlib.util.spec_from_file_location("m", os.path.join(sys.argv[1], "model.py"))
M = importlib.util.module_from_spec(s)
s.loader.exec_module(M)
d = os.path.abspath(os.path.join(sys.argv[1], "senaryolar"))
liste = []
for f in sorted(os.listdir(d)):
    if not f.endswith(".json"):
        continue
    p = os.path.join(d, f)
    with open(p, encoding="utf-8") as g:
        sen = json.load(g)
    if M.gecersiz_245(sen):
        k = ["2.4.4"]
    elif sen.get("dil") == M.DIL:
        k = ["2.5.0", "2.4.9", "2.4.6", "2.4.5"]
    else:
        k = ["2.5.0", "2.4.4"]
    liste.append({"dosya": p, "kipler": k})
with open(sys.argv[2], "w", encoding="utf-8") as g:
    json.dump(liste, g)
print(len(liste))
