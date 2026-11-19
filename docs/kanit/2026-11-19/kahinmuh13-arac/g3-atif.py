#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Muhasebe kâhini bakımı 13 — G3 atfı: rastgele tohumlarda değişen anahtarların HEPSİ S192 = A'nın tek kuyruk payından mı (README Ü12)?
Yeni model kaynağında yalnız S192 benimsemesi kapatılır (ozel = True — bakım 12'nin M13 payı); bu kopyanın rastgele çıktısı eski kâhinin beklenen dosyasıyla
(`susmalar` hariç) AYNI olmalı. Program AÇILMAZ.

  python3 -I g3-atif.py --eski <eski test/bagimsiz/muhasebe> --yeni <yeni test/bagimsiz/muhasebe>
"""
import importlib.util
import json
import os
import sys
import types


def arg(ad):
    return sys.argv[sys.argv.index(ad) + 1]


ESKI, YENI = arg("--eski"), arg("--yeni")
sys.path.insert(0, YENI)
src = open(os.path.join(YENI, "model.py"), encoding="utf-8").read()
ESKI_PARCA = "            ozel = pf is None or pfb != pf or self.s192_ozel(c, tarih)\n"
assert src.count(ESKI_PARCA) == 1
mod = types.ModuleType("model")
mod.__file__ = os.path.join(YENI, "model.py")
exec(compile(src.replace(ESKI_PARCA, "            ozel = True\n"), mod.__file__, "exec"), mod.__dict__)
sys.modules["model"] = mod
import uretici as U  # noqa: E402

gecen, toplam = 0, 0
for t in U.TOHUMLAR:
    s = U.uret(t)
    r = mod.kos(s, mod.Kurallar())
    yeni = {k: r[k] for k in ("raporlar", "redler", "degismezler", "devirler", "acilis_olabilir") if k in r}
    eski = json.load(open(os.path.join(ESKI, "senaryolar", "beklenen", s["ad"] + ".json"), encoding="utf-8"))["dallar"]["A"]
    eski = {k: v for k, v in eski.items() if k != "susmalar"}
    yeni = json.loads(json.dumps(yeni, ensure_ascii=False, sort_keys=True))
    toplam += 1
    ok = yeni == eski
    gecen += ok
    print(f"{s['ad']}: S192 benimsemesi kapalıyken eski beklenenle {'AYNI' if ok else 'FARKLI'}")
print(f"# tests {toplam}\n# pass {gecen}\n# fail {toplam - gecen}")
print(f"{gecen}/{toplam} denetim geçti")
sys.exit(0 if gecen == toplam else 1)
