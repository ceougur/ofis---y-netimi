#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Cari kâhini bakımı 26 (§38): bakım 25 aracının kopyası — listeye giren kayıt YOK (girdide yapım aşaması kısmı yok). Eski not: Cari kâhini bakımı 25 (§37) — bakım 24 aracının uyarlaması: `--yapim-asamasi-yaz` ile kendi kopyada üretilen listeyi ayrıştırır. Listeye girecek kısım görev metnindeki "programın henüz yapmadığı BİLİNEN
kısım" — S241'in azaltma kolu (d57 K1 / K2 / K3: Düzenle fazlası avans; açık / kapanmış / kendi kartı) ve §3 (d56 L1 / L2: kartın içine almadığı faturanın iadesi / iptali kartı değiştirmez); paket "Ç7b". Öbür farklar
program şüphesi 'P' diye RAPORLANIR, listeye girmez (ders 40). ESKİ liste ↔ yeni liste farkı (yeni / kapanan / değişen) dökülür.
  python3 -I yapim-ayir.py <üretilen liste> <depodaki eski liste> <yazılacak depo listesi> <döküm json>"""
import json
import sys

uretilen, eski_yol, hedef, dokum_yol = sys.argv[1:5]
U = json.load(open(uretilen, encoding="utf-8"))
E = json.load(open(eski_yol, encoding="utf-8"))
# bakım 26 (§38): girdi bu bakımda "programın henüz yapmadığı bilinen kısım" BELİRTMİYOR → listeye giren YOK; üretilen her kayıt program şüphesi 'P' (raporda), listeye girmez (ders 40).
BILINEN25 = {}
secilen, disarida = [], []
for e in U["kayitlar"]:
    if any(x in e["anahtar"] for x in BILINEN25.get(e["senaryo"], ())):
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
print("üretilen %d kayıt · listeye giren (S241 azaltma / §3 — Ç7b) %d · girmeyen (P şüphesi) %d · eski liste %d → yeni %d (yeni %d, kapanan %d, değişen %d)" % (
    len(U["kayitlar"]), len(secilen), len(disarida), len(E["kayitlar"]), len(secilen), len(dokum["yeni"]), len(dokum["kapanan"]), len(dokum["degisen"])))
