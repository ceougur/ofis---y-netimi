#!/usr/bin/env python3
"""Kâhin bakımı 4 — eski kâhinin (e6e5610f) yeni senaryolardaki kırmızısının NEDENİ (ders 38).

  python3 kahin4_neden.py <eski kâhin klasörü> <yeni kâhin klasörü>

Eski model.py ile yeni senaryolar_elle.py'nin s58, s66–s72 senaryoları koşulur; eskinin bilmediği rapor (mutabakat_uyarilari) atlanır.
Her elle anahtar için beklenen ↔ eski değer, sonra eski modelin değişmez hataları yazılır.
"""
import copy
import importlib.util
import sys


def yukle(ad, yol):
    spec = importlib.util.spec_from_file_location(ad, yol)
    m = importlib.util.module_from_spec(spec)
    sys.modules[ad] = m
    spec.loader.exec_module(m)
    return m


eski, yeni = sys.argv[1], sys.argv[2]
M = yukle("model", eski + "/model.py")                     # ESKİ model
E = yukle("senaryolar_elle", yeni + "/senaryolar_elle.py")  # YENİ senaryolar
KOK = ("redler", "acilis_olabilir", "degismezler", "devirler")


def yol_al(sonuc, yol):
    p = yol.split("/")
    x = sonuc if p[0] in KOK else sonuc["raporlar"]
    for seg in p:
        if isinstance(x, list):
            i = int(seg)
            if i >= len(x):
                return "<yok>"
            x = x[i]
        elif isinstance(x, dict) and seg in x:
            x = x[seg]
        else:
            return "<yok>"
    if p == ["redler"]:
        return [r["kod"] for r in x]
    return x


def hatalar(d, on=""):
    out = []
    if isinstance(d, dict):
        for k, v in d.items():
            out += hatalar(v, f"{on}/{k}")
    elif isinstance(d, list) and d:
        out.append(f"{on}: {d}")
    return out


SECILEN = ("s58", "s66", "s67", "s68", "s69", "s70", "s71", "s72")
toplam = 0
for s in E.SENARYOLAR:
    if not s["ad"].startswith(SECILEN):
        continue
    x = copy.deepcopy(s)
    x.update(copy.deepcopy(E.TANIM))
    atlanan = [o["ad"] for o in x["olaylar"] if o["tur"] == "rapor" and o["rapor"] == "mutabakat_uyarilari"]
    x["olaylar"] = [o for o in x["olaylar"] if not (o["tur"] == "rapor" and o["rapor"] == "mutabakat_uyarilari")]
    print(f"== {s['ad']} (eskinin bilmediği rapor atlandı: {atlanan or 'yok'})")
    try:
        r = M.kos(x)
    except Exception as e:                                   # noqa: BLE001
        print(f"   ESKİ MODEL HATA VERDİ: {type(e).__name__}: {e}")
        toplam += 1
        continue
    fark = 0
    for yol, bek in s["elle"]["A"].items():
        if yol.split("/")[0] in atlanan:
            print(f"   {yol}: beklenen {bek} — eski kâhinde rapor YOK")
            fark += 1
            continue
        g = yol_al(r, yol)
        if g == "<yok>" and bek == 0:
            continue
        if g != bek:
            print(f"   {yol}: beklenen {bek} ≠ eski {g}")
            fark += 1
    for h in hatalar(r["degismezler"], "degismez"):
        print(f"   ESKİ DEĞİŞMEZ KIRMIZI {h}")
        fark += 1
    print(f"   → {fark} fark")
    toplam += fark
print(f"# eski kâhinde fark toplamı {toplam}")
