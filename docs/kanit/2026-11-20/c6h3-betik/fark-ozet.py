# Sınıf testinin gerçek fark listesini (C6H3_FARK_YAZ çıktısı) sınıf × kip × tarih tablosu olarak yazar. Kullanım: python3 -I fark-ozet.py <farklar.json>
import json
import sys
from collections import defaultdict

rows = json.load(open(sys.argv[1], encoding="utf-8"))
by = defaultdict(list)
for r in rows:
    by[(r["sinif"], r["kip"])].append(r)
for (sinif, kip), items in sorted(by.items()):
    print(f"== {sinif} · {kip} ({len(items)})")
    for r in items:
        print(f"   {r['tarih']:<10} {r['alan']:<28} {r['eski']:>12} → {r['yeni']:>12}  (fark {int(r['yeni']) - int(r['eski']):>+12})")
print(f"TOPLAM {len(rows)}")
