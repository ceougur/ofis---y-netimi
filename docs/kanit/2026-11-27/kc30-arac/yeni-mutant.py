#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bakım 30: yeni mutantlar (367–375) ayrı koşu — oz-test.py §2 kuralıyla (DEĞERLE: elle tablonun bir `elleBeklenen` değeri kırmızıya döner; SUS kuralı mutantında
`elleYok` / `elleBelirsiz` de sayılır). Her mutant için yakalayan elle senaryolar ve ilk kırmızı anahtar yazılır.
  python3 -I yeni-mutant.py <kâhin klasörü> [mutant,…]"""
import importlib.util
import json
import os
import sys


def main(argv):
    kl = argv[1]
    muts = [int(x) for x in argv[2].split(",")] if len(argv) > 2 else list(range(367, 376))
    spec = importlib.util.spec_from_file_location("kahin_cari_model_k30m", os.path.join(kl, "model.py"))
    M = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(M)
    d = os.path.join(kl, "senaryolar")
    sus_kurali = {375}
    yakalanmayan = 0
    for n in muts:
        yakalayan = []
        for f in sorted(os.listdir(d)):
            sen = json.load(open(os.path.join(d, f), encoding="utf-8"))
            if sen.get("dil") != M.DIL or not sen.get("elleBeklenen"):
                continue
            m = M.Model(sen, n, "2.5.0")
            r = m.kos()
            out, bel = r["denetimler"], r["belirsiz"]
            kirmizi = [k for k, b in sen["elleBeklenen"].items() if out.get(k, {}).get("b", "ANAHTAR YOK") != b]
            if n in sus_kurali:
                kirmizi += [k for k in (sen.get("elleYok") or []) if k in out]
                kirmizi += ["belirsiz:" + "+".join(x) for x in (sen.get("elleBelirsiz") or []) if not any(all(y in b for y in x) for b in bel)]
            if kirmizi:
                yakalayan.append("%s:%s (%d)" % (f[:3], kirmizi[0], len(kirmizi)))
        print("mutasyon %d (%s): %s" % (n, M.MUTASYONLAR.get(n, "?")[:90], ("YAKALANDI " + "; ".join(yakalayan[:4])) if yakalayan else "YAKALANMADI"))
        yakalanmayan += not yakalayan
    print("# tests %d" % len(muts))
    print("# pass %d" % (len(muts) - yakalanmayan))
    print("# fail %d" % yakalanmayan)
    print("%d/%d mutasyon yakalandı" % (len(muts) - yakalanmayan, len(muts)))
    return 0 if not yakalanmayan else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
