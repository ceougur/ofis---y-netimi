#!/usr/bin/env python3
"""Bakım 2 mutantları DEĞERLE mi yakalanıyor (çökmeden, çıktı farklı)? Program AÇILMAZ.
  python3 -I mutant_deger.py <cari_klasoru> <defter_klasoru>"""
import importlib.util
import json
import os
import sys


def yukle_mod(ad, yol):
    spec = importlib.util.spec_from_file_location(ad, yol)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def main(argv):
    C = yukle_mod("cari_m", os.path.join(argv[1], "model.py"))
    D = yukle_mod("defter_m", os.path.join(argv[2], "kahin.py"))
    kalan = 0
    cs = sorted(f for f in os.listdir(os.path.join(argv[1], "senaryolar")) if f.endswith(".json"))
    for n in (214, 215, 216, 217, 218):
        deger = []
        for f in cs:
            with open(os.path.join(argv[1], "senaryolar", f), encoding="utf-8") as g:
                sen = json.load(g)
            if sen.get("dil") != C.DIL:
                continue
            taban = C.Model(sen, 0, "2.5.0").kos()["denetimler"]
            try:
                m = C.Model(sen, n, "2.5.0").kos()["denetimler"]
            except Exception as e:
                print("  cari mutant %d %s: ÇÖKTÜ %s" % (n, f, e))
                continue
            fark = [k for k in sorted(set(taban) | set(m)) if taban.get(k, {}).get("b") != m.get(k, {}).get("b")]
            if fark:
                deger.append("%s (%d denetim, ör. %s: %s → %s)" % (f, len(fark), fark[0], json.dumps(taban.get(fark[0], {}).get("b"), ensure_ascii=False)[:80],
                                                                    json.dumps(m.get(fark[0], {}).get("b"), ensure_ascii=False)[:80]))
        print("cari mutant %d (%s): DEĞERLE %s" % (n, C.MUTASYONLAR[n], ("YAKALANDI — " + " | ".join(deger[:3])) if deger else "YAKALANMADI"))
        kalan += not deger
    ds = [os.path.join(argv[2], "senaryo.json")] + [os.path.join(argv[2], "senaryolar", f) for f in sorted(os.listdir(os.path.join(argv[2], "senaryolar"))) if f.endswith(".json")]
    for n in (35, 36, 37, 38):
        deger = []
        for p in ds:
            with open(p, encoding="utf-8") as g:
                sen = json.load(g)
            taban = D.hesapla(sen, None, 0, "2.5.0")
            try:
                m = D.hesapla(sen, None, n, "2.5.0")
            except SystemExit as e:
                print("  defter mutant %d %s: ÇÖKTÜ %s" % (n, os.path.basename(p), e))
                continue
            t2 = {k: v for k, v in taban.items() if k != "mutasyon"}
            m2 = {k: v for k, v in m.items() if k != "mutasyon"}
            if t2 != m2:
                fark = [k for k in sorted(t2) if t2[k] != m2.get(k)]
                deger.append("%s (%s)" % (os.path.basename(p), ",".join(fark)))
        print("defter mutant %d (%s): DEĞERLE %s" % (n, D.MUTASYONLAR_250[n], ("YAKALANDI — " + " | ".join(deger[:3])) if deger else "YAKALANMADI"))
        kalan += not deger
    print("# tests 9\n# pass %d\n# fail %d" % (9 - kalan, kalan))
    return 1 if kalan else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
