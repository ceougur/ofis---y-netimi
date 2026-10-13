#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Sürüm 3 (evrak) kurallarına bilerek hata koyar; test/bagimsiz/test_surum3.py her birini yakalamalı (KANIT KURALI 3).

Kullanım (depo kökünden):  python3 docs/kanit/2026-10-12/kahin-senet/mutasyon_surum3.py
Her mutasyon kâhinin geçici bir kopyasında uygulanır (depodaki dosya değişmez); test dosyası kopyaya yönlendirilir.
Çıkış: 0 hepsi yakalandı · 1 en az biri kaçtı.
"""
import os
import shutil
import subprocess
import sys
import tempfile

KOK = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", ".."))
BAG = os.path.join(KOK, "test", "bagimsiz")

MUTASYONLAR = [
    ("a", "senet tahsilde 101.02", 'EVRAK_TAHSILDE = {"cek": "101.02", "senet": "121.02"}',
     'EVRAK_TAHSILDE = {"cek": "101.02", "senet": "101.02"}'),
    ("a", "verilen senet 103", 'EVRAK_VERILEN = {"cek": "103", "senet": "321"}',
     'EVRAK_VERILEN = {"cek": "103", "senet": "103"}'),
    ("a", "tahsildeki tahsil portföyden", '            alacak = EVRAK_TAHSILDE[e["tur"]]\n        else:',
     '            alacak = EVRAK_PORTFOY[e["tur"]]\n        else:'),
    ("a", "karşılıksız hep portföyden", 'alacak = EVRAK_TAHSILDE[e["tur"]] if e["durum"] == "tahsilde" else EVRAK_PORTFOY[e["tur"]]',
     'alacak = EVRAK_PORTFOY[e["tur"]]'),
    ("a", "ciro tahsilde 4xx", 'ih.ekle(4, 409, "cheque-deposited", "PLAN", "tahsildeki evrak ciro edilemez")',
     'ih.ekle(4, "4xx", None, None, "tahsildeki evrak ciro edilemez")'),
    ("a", "alıştan önce tahsile verme serbest", 'ih.ekle(4, "4xx", None, None, "tahsile verme alış tarihinden önce [PLAN §3.14]")',
     'pass'),
    ("a", "tahsilde başka hesap serbest", 'ih.ekle(2, 400, None, None, "tahsildeki evrak başka hesaba tahsil edilemez")\n                raise Dur()',
     'pass'),
    ("a", "tahsildeki evrak silinir", 'ih.ekle(4, 409, "cheque-deposited", "PLAN", "tahsildeki evrak silinemez")', 'pass'),
    ("a", "geri al ters yön", '(EVRAK_PORTFOY[e["tur"]], T, 0, None), (EVRAK_TAHSILDE[e["tur"]], 0, T, None)],\n                         "geri_al"',
     '(EVRAK_TAHSILDE[e["tur"]], T, 0, None), (EVRAK_PORTFOY[e["tur"]], 0, T, None)],\n                         "geri_al"'),
    ("a", "BELİRSİZ-27 yok", '                belirsiz[ck].add("BELİRSİZ-27")', '                pass'),
    ("b", "senet portföy 101.01", 'PORTFOY_HESABI = {"cek": "101.01", "senet": "121.01"}', 'PORTFOY_HESABI = {"cek": "101.01", "senet": "101.01"}'),
    ("b", "verilen senet 103", 'VERILEN_HESABI = {"cek": "103", "senet": "321"}', 'VERILEN_HESABI = {"cek": "103", "senet": "103"}'),
    ("b", "tahsildeki tahsil portföyden", '        alacak = TAHSILDE_HESABI[e["tur"]]\n    elif e["durum"] == "portfoy":',
     '        alacak = PORTFOY_HESABI[e["tur"]]\n    elif e["durum"] == "portfoy":'),
    ("b", "silmede cheque-deposited yok", '            c.ekle(4, 409, "cheque-deposited", "PLAN")\n        elif e["gecmis"]:',
     '            pass\n        elif e["gecmis"]:'),
    ("b", "hesap uygunluğu yok", '    hesap_uygun = h["durum"] == "aktif" and h["tur"] in HAVALE_TURLERI',
     '    hesap_uygun = True'),
    ("b", "ödemede eksi bakiye yok", '    _evrak_yaz(c, e, "evrak_odeme", tarih, satirlar, "odendi")\n    eksi_denetle(c, etki_hesapla(satirlar), tarih)',
     '    _evrak_yaz(c, e, "evrak_odeme", tarih, satirlar, "odendi")'),
    ("b", "tahsil edilmiş evrak tekrar", '    if e["durum"] not in ("portfoy", "tahsilde"):\n        c.ekle(4, "4xx")\n    c.acilis_oncesi(hk, tarih)',
     '    c.acilis_oncesi(hk, tarih)'),
    ("b", "ciro karşı hesap 120", '    satirlar = [(d.cari_kodu(ck), "B", e["T"], ck), (PORTFOY_HESABI[e["tur"]], "A", e["T"], None)]',
     '    satirlar = [(d.cari_kodu(e["cari"]), "B", e["T"], e["cari"]), (PORTFOY_HESABI[e["tur"]], "A", e["T"], None)]'),
]


def main():
    kacan = []
    for model, ad, eski, yeni in MUTASYONLAR:
        with tempfile.TemporaryDirectory() as d:
            kopya = os.path.join(d, "bagimsiz")
            shutil.copytree(BAG, kopya, ignore=shutil.ignore_patterns("cikti"))
            yol = os.path.join(kopya, "model_" + model, "model.py")
            s = open(yol, encoding="utf-8").read()
            if s.count(eski) != 1:
                print("UYGULANAMADI  model_%s %s (metin %d kez)" % (model, ad, s.count(eski)))
                kacan.append(ad)
                continue
            open(yol, "w", encoding="utf-8").write(s.replace(eski, yeni))
            p = subprocess.run([sys.executable, "-I", os.path.join(kopya, "test_surum3.py")], capture_output=True, text=True)
            son = (p.stderr.strip().splitlines() or ["?"])[-1]
            if p.returncode != 0:
                print("YAKALANDI  model_%s %-36s %s" % (model, ad, son))
            else:
                print("KAÇTI      model_%s %-36s %s" % (model, ad, son))
                kacan.append(ad)
    print("toplam %d yakalanan %d kaçan %s" % (len(MUTASYONLAR), len(MUTASYONLAR) - len(kacan), kacan))
    return 1 if kacan else 0


if __name__ == "__main__":
    sys.exit(main())
