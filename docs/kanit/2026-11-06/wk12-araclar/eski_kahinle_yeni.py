#!/usr/bin/env python3
"""WK güncellemesi 12: ESKİ kâhin (taban b12a03d6'nın değişiklikten önce alınmış kopyası) yeni senaryolarla koşulur.
Kullanım: eski_kahinle_yeni.py <eski kâhin klasörü> <yeni senaryolar.json> [notr]
  notr: eski kopyadaki iki 'KULLANICIYA SORULMALI' hatasının YALNIZ kendisi etkisiz kılınır (kopyada bellekte; dosyaya yazılmaz) —
        bu, eski kâhinin karar yokken düşeceği yolu gösterir (başlatmada §7a 20 'Gecikmiş Borç Yok'; gönderim anında şüpheli denetimi yok = S7-b'nin B'si)."""
import importlib.util
import json
import sys
import types

sys.dont_write_bytecode = True
eski_klasor, json_yol = sys.argv[1], sys.argv[2]
notr = len(sys.argv) > 3 and sys.argv[3] == "notr"
with open(f"{eski_klasor}/kahin.py", encoding="utf-8") as f:
    kaynak = f.read()
if notr:
    satirlar = []
    n = 0
    for s in kaynak.split("\n"):
        if "raise ValueError(\"KULLANICIYA SORULMALI S7-" in s:
            girinti = s[:len(s) - len(s.lstrip())]
            satirlar.append(girinti + "pass  # notr: eski kâhinin S7-a / S7-b hatası etkisiz")
            n += 1
        else:
            satirlar.append(s)
    kaynak = "\n".join(satirlar)
    print(f"notr kopya: {n} hata satırı etkisiz kılındı")
kahin = types.ModuleType("kahin_eski")
exec(compile(kaynak, f"{eski_klasor}/kahin.py", "exec"), kahin.__dict__)

with open(json_yol, encoding="utf-8") as f:
    yeni = json.load(f)


def esit(a, b):
    return json.dumps(a, sort_keys=True, ensure_ascii=False) == json.dumps(b, sort_keys=True, ensure_ascii=False)


kirmizi = ayni = 0
for s in yeni["senaryolar"]:
    if s["baslik"] not in ("S7A", "S7B"):
        continue
    girdi = {"ad": s["ad"], "baslik": s["baslik"], "aciklama": s["aciklama"], "kaynak": s["kaynak"], **s["girdi"]}
    try:
        b = kahin.hesapla(girdi)
    except Exception as e:  # noqa: BLE001
        kirmizi += 1
        print(f"KIRMIZI {s['ad']}: eski kâhin hata verdi — {type(e).__name__}: {str(e)[:170]}")
        continue
    farklar = []
    for el in s["elle"]:
        for g in b:
            for yol, deger in el["yollar"].items():
                m = kahin.yol_al(g["sonuc"], yol)
                if not esit(m, deger):
                    farklar.append(f"{yol}: elle {json.dumps(deger, ensure_ascii=False)[:120]} ≠ eski {json.dumps(m, ensure_ascii=False)[:120]}")
    if farklar:
        kirmizi += 1
        print(f"KIRMIZI {s['ad']}: {len(farklar)} fark")
        for x in farklar[:6]:
            print(f"    {x}")
    else:
        ayni += 1
        print(f"AYNI    {s['ad']}")
print(f"# yeni senaryo {kirmizi + ayni}: KIRMIZI {kirmizi}, AYNI {ayni}")
