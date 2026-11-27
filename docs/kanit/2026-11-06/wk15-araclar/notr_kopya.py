#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WK 15 (ders 38): eski kâhinin (taban b91d82b9) NÖTR kopyası — YALNIZ kural yokken düşülecek yol açılır, kural EKLENMEZ:
  (1) S7-e `ValueError` koşulu etkisiz (karar yokken: F1 "Zaten Kuyrukta" + gönderim anında S22 = S23'ün B seçeneği);
  (2) `kvkk_sil` olayı tanınır ama hiçbir şey yapmaz (silme kuralı yok);
  (3) `kontrol {icerik: true}` gözlemi: işlerin o anki telefon / değişken / PDF / dosya adı (silme kuralı yok — yalnız gözlem).
Kullanım: python3 -I notr_kopya.py <eski kahin.py> <çıktı klasörü>"""
import os
import sys

kaynak, hedef = sys.argv[1], sys.argv[2]
with open(kaynak, encoding="utf-8") as f:
    m = f.read()
DEGISIM = [
    ('            if acik and j.durum in KUYRUKTA and getattr(j, "belirsiz_onay", False) and not getattr(j, "supheli_elle", False):\n',
     '            if False:   # NÖTR (WK 15, ders 38): S7-e hatası etkisiz — karar yokken F1 yolu\n'),
    ('        elif tur == "sirket_sil":',
     '        elif tur == "kvkk_sil":   # NÖTR (WK 15): olay tanınır, etkisi yok (silme kuralı yok)\n            pass\n        elif tur == "sirket_sil":'),
    ('            k["isler"] = {a: self.gorunen(j) for a, j in sorted(self.isler.items())}\n',
     '            k["isler"] = {a: self.gorunen(j) for a, j in sorted(self.isler.items())}\n'
     '        if o.get("icerik"):   # NÖTR (WK 15): yalnız gözlem\n'
     '            k["icerik"] = {a: {"telefon": j.telefon, "degiskenler": j.icerik["degiskenler"] if j.icerik else None, "pdf": j.icerik["pdf"] if j.icerik else None,\n'
     '                               "dosya_adi": j.icerik["dosya_adi"] if j.icerik else None} for a, j in sorted(self.isler.items())}\n'),
]
for eski, yeni in DEGISIM:
    n = m.count(eski)
    if n != 1:
        sys.exit(f"değişim {n} kez bulundu (1 olmalı): {eski[:80]!r}")
    m = m.replace(eski, yeni)
os.makedirs(hedef, exist_ok=True)
with open(os.path.join(hedef, "kahin.py"), "w", encoding="utf-8") as f:
    f.write(m)
print(f"nötr kopya yazıldı: {os.path.join(hedef, 'kahin.py')} ({len(DEGISIM)} değişim)")
print(f"1..{len(DEGISIM)}")
for ad_, n_ in (("tests", len(DEGISIM)), ("pass", len(DEGISIM)), ("fail", 0), ("cancelled", 0), ("skipped", 0), ("todo", 0)):   # her değişim tam 1 kez bulundu (yoksa yukarıda çıkış 1)
    print(f"# {ad_} {n_}")
