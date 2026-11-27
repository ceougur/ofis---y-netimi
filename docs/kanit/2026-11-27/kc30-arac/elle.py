#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bakım 30: bir kâhin kopyasının (model.py klasörü) elle tabloya karşı sonucu.
  python3 -I elle.py <model klasörü> <senaryo.json> [--mut N] [--kirmizi-bekle]
Çıktı: her elle denetim (tuttu / kırmızı), son satır "N/M elle denetim tuttu". --kirmizi-bekle: en az bir kırmızı yoksa çıkış 1 (eski kâhin kırmızısı için)."""
import importlib.util
import json
import os
import sys


def main(argv):
    kl, sp = argv[1], argv[2]
    mut = int(argv[argv.index("--mut") + 1]) if "--mut" in argv else 0
    spec = importlib.util.spec_from_file_location("kahin_cari_model_k30", os.path.join(kl, "model.py"))
    M = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(M)
    sen = json.load(open(sp, encoding="utf-8"))
    m = M.Model(sen, mut, "2.5.0")
    r = m.kos()
    out, bel = r["denetimler"], r["belirsiz"]
    top = tut = 0
    for k_, b in sorted((sen.get("elleBeklenen") or {}).items()):
        g = out.get(k_, {}).get("b", "ANAHTAR YOK")
        top += 1
        tut += g == b
        print(("  ok " if g == b else "  ✗  ") + "%s elle %s · kâhin %s" % (k_, json.dumps(b, ensure_ascii=False), json.dumps(g, ensure_ascii=False)))
    for k_ in sen.get("elleYok") or []:
        top += 1
        tut += k_ not in out
        print(("  ok " if k_ not in out else "  ✗  ") + "%s yok · kâhin %s" % (k_, json.dumps(out.get(k_), ensure_ascii=False)))
    for p in sen.get("elleBelirsiz") or []:
        ps = p if isinstance(p, list) else [p]
        v = any(all(x in b for x in ps) for b in bel)
        top += 1
        tut += v
        print(("  ok " if v else "  ✗  ") + "belirsiz %s" % " + ".join(ps))
    print("%d/%d elle denetim tuttu" % (tut, top))
    if "--kirmizi-bekle" in argv:
        return 0 if tut < top else 1
    return 0 if tut == top else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
