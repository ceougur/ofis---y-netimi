#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cari kâhini bakımı 24: `--yapim-asamasi-yaz` ile kendi kopyada üretilen listeyi ayrıştırır (görev metni: yalnız programın HENÜZ YAPMADIĞI BİLİNEN kısım — girdi §1 (e) Düzenle ile azaltma,
§1 (f) iki kart — fark verirse listeye kayıt; öbür farklar program şüphesi 'P' diye RAPORLANIR, listeye girmez — ders 40). Kayıt seçimi: d53'ün Düzenle carileri P4 / A4 (adımlar dz4 / dza4; fatura FP4 / FA4;
kart KP4 / KA4) → paket "Ç7b". İki kart (P6 / A6) farkı çıkmazsa kayıt yok. ESKİ liste ↔ yeni liste farkı (yeni / kapanan / değişen) dökülür.
  python3 -I yapim-ayir.py <üretilen liste> <depodaki eski liste> <yazılacak depo listesi> <döküm json>"""
import json
import sys

uretilen, eski_yol, hedef, dokum_yol = sys.argv[1:5]
U = json.load(open(uretilen, encoding="utf-8"))
E = json.load(open(eski_yol, encoding="utf-8"))
DUZENLE = (":P4:", ":A4:", ":FP4:", ":FA4:", ":KP4:", ":KA4:", "adim:dz4:", "adim:dza4:")
IKI_KART = (":P6:", ":A6:", ":F6A:", ":G6A:", ":K6A:", ":K6B:", ":L6A:", ":L6B:")
secilen, disarida = [], []
for e in U["kayitlar"]:
    a = e["senaryo"] + " " + e["anahtar"]
    if e["senaryo"] in ("d53-c5-s234-kapali-kart-iade", "d54-c5-s234-acik-kart-iade") and any(x in e["anahtar"] for x in DUZENLE + IKI_KART):
        secilen.append(dict(e, paket="Ç7b"))
    else:
        disarida.append(e)
anah = lambda e: (e["senaryo"], e["anahtar"])
eskiK = {anah(e): e for e in E["kayitlar"]}
yeniK = {anah(e): e for e in secilen}
dokum = {"uretilen_toplam": len(U["kayitlar"]), "listeye_giren": len(secilen), "listeye_girmeyen_P": [{"senaryo": e["senaryo"], "anahtar": e["anahtar"], "beklenen": e["beklenen"], "program": e["program"]} for e in disarida],
         "yeni": sorted("%s %s" % k for k in yeniK if k not in eskiK), "kapanan": sorted("%s %s" % k for k in eskiK if k not in yeniK),
         "degisen": sorted("%s %s" % k for k in yeniK if k in eskiK and (yeniK[k]["beklenen"], yeniK[k]["program"]) != (eskiK[k]["beklenen"], eskiK[k]["program"]))}
out = dict(E, kayitlar=secilen)
if "Ç7b" not in out.get("paketler", []):
    out["paketler"] = [p for p in out.get("paketler", []) if p != "AYRIŞTIRILMADI"] + ["Ç7b", "AYRIŞTIRILMADI"]
with open(hedef, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
    f.write("\n")
with open(dokum_yol, "w", encoding="utf-8") as f:
    json.dump(dokum, f, ensure_ascii=False, indent=1)
print("üretilen %d kayıt · listeye giren (Düzenle / iki kart — Ç7b) %d · girmeyen (P şüphesi) %d · eski liste %d → yeni %d (yeni %d, kapanan %d, değişen %d)" % (
    len(U["kayitlar"]), len(secilen), len(disarida), len(E["kayitlar"]), len(secilen), len(dokum["yeni"]), len(dokum["kapanan"]), len(dokum["degisen"])))
