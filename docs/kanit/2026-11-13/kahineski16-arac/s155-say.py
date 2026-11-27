#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bakım 16 (§27 Y16-1 / Y16-4 / Y16-5): S155'in RET / SUS sayıları — bütün elle senaryolar + rastgele s1 / ux18 (tohum 1..N × işlem) ve DEĞİŞMEZ: her kabul edilen adımdan sonra, şüpheli kaydı olan
her caride açık şüpheli > 0 ise bakiye ≥ açık şüpheli (Y16-1 her adımda tuttuğu için; Y16-4 / SK-35 SUS dünyalarında da). Program AÇILMAZ; yalnız model.py koşar.

  python3 -I -B s155-say.py --model <cari klasörü> [--tohum 10] [--islem 120]
Son satır "N/M denetim geçti" (tools/kanit.mjs tanır)."""
import importlib.util
import json
import os
import subprocess
import sys
from collections import Counter


def arg(ad, v):
    return sys.argv[sys.argv.index(ad) + 1] if ad in sys.argv else v


K = os.path.abspath(arg("--model", "."))
TOHUM, ISLEM = int(arg("--tohum", "10")), int(arg("--islem", "120"))
spec = importlib.util.spec_from_file_location("kahin_cari_s155say", os.path.join(K, "model.py"))
M = importlib.util.module_from_spec(spec)
spec.loader.exec_module(M)
say = Counter()
ihlal = []
_orij = M.Model._s145_adim


def _izle(self, a, fn):
    r = _orij(self, a, fn)
    if isinstance(r, tuple) and len(r) > 2 and "S155" in r[2]:
        say["ret"] += 1
    if not isinstance(r, tuple):
        for c in {sp["cari"] for sp in self.supheliler.values() if sp["cari"] in self.cariler}:
            A = self._s155_acik(c)
            self._onbellek = {}
            if A > 0 and self.bakiye(c) < A and not any(x[0] == a["id"] for x in self.sus_s145):
                ihlal.append((self.s["ad"], a["id"], c, self.bakiye(c), A))
    return r


M.Model._s145_adim = _izle
senaryolar = []
d = os.path.join(K, "senaryolar")
for f in sorted(os.listdir(d)):
    if f.endswith(".json"):
        with open(os.path.join(d, f), encoding="utf-8") as g:
            senaryolar.append(("elle", json.load(g)))
for tur in ("s1", "ux18"):
    for t in range(1, TOHUM + 1):
        out = subprocess.run([sys.executable, "-I", os.path.join(K, "uretici.py"), "--tur", tur, "--tohum", str(t), "--islem", str(ISLEM)], capture_output=True, check=True).stdout
        senaryolar.append(("rastgele", json.loads(out)))
for kaynak, sen in senaryolar:
    if sen.get("dil") != "destekofis-cari/3" and kaynak == "elle":
        pass
    try:
        m = M.Model(json.loads(json.dumps(sen)), 0, "2.5.0")
        m.kos()
    except SystemExit:
        continue
    for _aid, _c, kod, _ne in m.sus_s145:
        say["%s %s" % (kaynak, kod)] += 1
    for b in m.belirsiz:
        if " S155 — " in b:
            say["%s belirsiz" % kaynak] += 1
print("S155 sayıları (ana koşular + iki dünya alt koşuları; ret = adım reddi): %s" % ", ".join("%s %d" % kv for kv in sorted(say.items())))
print("DEĞİŞMEZ (kabul edilen adımdan sonra açık şüpheli > 0 ⇒ bakiye ≥ açık şüpheli): %d ihlal" % len(ihlal))
for x in ihlal[:20]:
    print("  ✗ %s adım %s cari %s bakiye %d < açık şüpheli %d" % x)
ok = not ihlal
print("# tests 1")
print("# pass %d" % ok)
print("# fail %d" % (not ok))
print("%d/1 denetim geçti" % ok)
sys.exit(0 if ok else 1)
