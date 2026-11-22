#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cari kâhini bakımı 28 (§40) — bakım 27 aracının uyarlaması: `--yapim-asamasi-yaz` ile kendi kopyada üretilen listeyi ayrıştırır. Görev metni: "yeni senaryoların kayıtları paket 'S255 izleyen tur 4' diye"
(S255 = A'nın kodu ayrı bir kod turunda — programda HENÜZ yok). Listeye giren: YALNIZ yeni d60 senaryosunun kayıtları (paket "S255 izleyen tur 4"; üreticinin kendiliğinden verdiği etiket — kural metnine göre "Ç5-B tur 2" /
"Ç7b" / "AYRIŞTIRILMADI" — DEĞİŞTİRİLİR, çünkü üretici paketi kural metninden tahmin ediyor, bu farkların kaynağı S255). Öbür senaryolardaki her kayıt program şüphesi 'P' diye RAPORLANIR, listeye girmez (ders 40).
ESKİ liste ↔ yeni liste farkı (yeni / kapanan / değişen) dökülür.
  python3 -I yapim-ayir.py <üretilen liste> <depodaki eski liste> <yazılacak depo listesi> <döküm json>"""
import json
import sys

uretilen, eski_yol, hedef, dokum_yol = sys.argv[1:5]
U = json.load(open(uretilen, encoding="utf-8"))
E = json.load(open(eski_yol, encoding="utf-8"))
YENI_SENARYO = {"d60-c5-s255-s254-bagli-odeme-kartli-fatura"}
PAKET = "S255 izleyen tur 4"
secilen, disarida = [], []
for e in U["kayitlar"]:
    if e["senaryo"] in YENI_SENARYO:
        secilen.append(dict(e, paket=PAKET))
    else:
        disarida.append(e)
anah = lambda e: (e["senaryo"], e["anahtar"])  # noqa: E731
eskiK = {anah(e): e for e in E["kayitlar"]}
yeniK = {anah(e): e for e in secilen}
dokum = {"uretilen_toplam": len(U["kayitlar"]), "uretici_paketleri": {}, "listeye_giren": len(secilen),
         "listeye_girmeyen_P": [{"senaryo": e["senaryo"], "anahtar": e["anahtar"], "beklenen": e["beklenen"], "program": e["program"]} for e in disarida],
         "yeni": sorted("%s %s" % k for k in yeniK if k not in eskiK), "kapanan": sorted("%s %s" % k for k in eskiK if k not in yeniK),
         "degisen": sorted("%s %s" % k for k in yeniK if k in eskiK and (yeniK[k]["beklenen"], yeniK[k]["program"]) != (eskiK[k]["beklenen"], eskiK[k]["program"]))}
for e in U["kayitlar"]:
    dokum["uretici_paketleri"][e["paket"]] = dokum["uretici_paketleri"].get(e["paket"], 0) + 1
out = dict(E, kayitlar=secilen)
if PAKET not in out.get("paketler", []):
    out["paketler"] = [p for p in out.get("paketler", []) if p != "AYRIŞTIRILMADI"] + [PAKET, "AYRIŞTIRILMADI"]
with open(hedef, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
    f.write("\n")
with open(dokum_yol, "w", encoding="utf-8") as f:
    json.dump(dokum, f, ensure_ascii=False, indent=1)
print("üretilen %d kayıt (üreticinin paketleri %s) · listeye giren (d60 — %s) %d · girmeyen (P şüphesi) %d · eski liste %d → yeni %d (yeni %d, kapanan %d, değişen %d)" % (
    len(U["kayitlar"]), json.dumps(dokum["uretici_paketleri"], ensure_ascii=False), PAKET, len(secilen), len(disarida), len(E["kayitlar"]), len(secilen), len(dokum["yeni"]), len(dokum["kapanan"]), len(dokum["degisen"])))
