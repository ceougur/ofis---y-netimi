#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WK 16 — eski senaryoların TAM sonucu: taban (ee344d86, değişiklikten önce alınmış senaryolar.json) ↔ yeni senaryolar.json.
Kullanım: python3 -I tam_sonuc_fark.py <eski senaryolar.json> <yeni senaryolar.json>
Her eski senaryo için ad sırası, girdi, elle, beklenen, baslik, aciklama, kaynak ayrı ayrı karşılaştırılır; değişen yapraklar (beklenen içinde) listelenir.
"""
import json
import sys


def metin(x):
    return json.dumps(x, sort_keys=True, ensure_ascii=False)


def yaprak_fark(a, b, yol=""):
    if isinstance(a, dict) and isinstance(b, dict):
        out = []
        for k in sorted(set(a) | set(b)):
            out += yaprak_fark(a.get(k, "<YOK>"), b.get(k, "<YOK>"), f"{yol}.{k}" if yol else k)
        return out
    if isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        out = []
        for i, (x, y) in enumerate(zip(a, b)):
            out += yaprak_fark(x, y, f"{yol}[{i}]")
        return out
    return [] if metin(a) == metin(b) else [f"{yol}: {metin(a)[:140]} → {metin(b)[:140]}"]


def main(argv):
    eski = json.load(open(argv[0], encoding="utf-8"))
    yeni = json.load(open(argv[1], encoding="utf-8"))
    ye = {s["ad"]: s for s in yeni["senaryolar"]}
    sira_eski = [s["ad"] for s in eski["senaryolar"]]
    sira_yeni = [s["ad"] for s in yeni["senaryolar"] if s["ad"] in set(sira_eski)]
    print(f"eski senaryo {len(sira_eski)}, yeni dosyada {len(yeni['senaryolar'])}; eski sıra korunuyor: {sira_eski == sira_yeni}")
    ayni = degisen = 0
    for s in eski["senaryolar"]:
        y = ye.get(s["ad"])
        if y is None:
            print(f"YOK {s['ad']}")
            degisen += 1
            continue
        alanlar = [k for k in ("girdi", "elle", "beklenen", "baslik", "aciklama", "kaynak", "serbest") if metin(s.get(k)) != metin(y.get(k))]
        if not alanlar:
            ayni += 1
            continue
        degisen += 1
        print(f"DEĞİŞTİ {s['ad']}: alanlar {alanlar}")
        for f in yaprak_fark(s["beklenen"], y["beklenen"])[:12]:
            print(f"    beklenen {f}")
        for f in yaprak_fark(s["elle"], y["elle"])[:12]:
            print(f"    elle {f}")
    ust = [k for k in sorted(set(eski) | set(yeni)) if k != "senaryolar" and metin(eski.get(k)) != metin(yeni.get(k))]
    print(f"üst alanlardan değişen: {ust}")
    if "kararlar" in ust:
        print(f"    kararlara eklenen: {sorted(set(yeni['kararlar']) - set(eski['kararlar']))}; değişen eski karar: "
              f"{[k for k in eski['kararlar'] if metin(eski['kararlar'][k]) != metin(yeni['kararlar'].get(k))]}")
    print(f"# eski senaryolar: AYNI {ayni}, DEĞİŞEN {degisen}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
