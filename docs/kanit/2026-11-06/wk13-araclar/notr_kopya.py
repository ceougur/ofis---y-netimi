# -*- coding: utf-8 -*-
"""WK13: eski kâhinin NÖTR kopyası — YALNIZ S7-c hata satırı etkisiz (karar yokken düşülecek yol: hata vermeden S7-b sırası = S16'nın B seçeneği).
Kullanım: python3 -I notr_kopya.py <eski kahin klasörü> <hedef klasör>"""
import os
import shutil
import sys

kaynak, hedef = sys.argv[1], sys.argv[2]
os.makedirs(hedef, exist_ok=True)
for ad in ("kahin.py", "senaryolar.py", "kahin_test.py", "senaryolar.json"):
    shutil.copyfile(os.path.join(kaynak, ad), os.path.join(hedef, ad))
yol = os.path.join(hedef, "kahin.py")
with open(yol, encoding="utf-8") as f:
    metin = f.read()
eski = "                        if sup and getattr(j, \"belirsiz_onay\", False):\n                            raise ValueError("
yeni = "                        if False and sup and getattr(j, \"belirsiz_onay\", False):   # WK13 NÖTR: S7-c hatası etkisiz\n                            raise ValueError("
assert metin.count(eski) == 1, "S7-c satırı bulunamadı"
with open(yol, "w", encoding="utf-8") as f:
    f.write(metin.replace(eski, yeni))
print("nötr kopya:", yol)
