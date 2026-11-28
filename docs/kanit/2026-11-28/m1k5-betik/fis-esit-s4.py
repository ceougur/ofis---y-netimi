"""fis-esit-s4.sh'in karşılaştırıcısı: fiş / ön izleme / defter satırları taban = yeni mi; rapor satırlarının farkı dökülür. Kullanım: python3 -I fis-esit-s4.py <taban> <yeni> <TZ>"""
import re
import sys

a = [line.rstrip("\n") for line in open(sys.argv[1], encoding="utf-8") if line.strip()]
b = [line.rstrip("\n") for line in open(sys.argv[2], encoding="utf-8") if line.strip()]
FIS = re.compile(r"^(\S+ fişi|\d: fişler|Nisan ön izlemesi|\d: defter)")
fa = [line for line in a if FIS.match(line)]
fb = [line for line in b if FIS.match(line)]
print(f"{sys.argv[3]} kararın örneği + yan etki: fiş / ön izleme / defter satırı taban {len(fa)} · yeni {len(fb)} · BİREBİR {'EVET' if fa == fb and len(fa) >= 14 else 'HAYIR'}")
for x, y in zip(fa, fb):
    if x != y:
        print("  FARK taban:", x[:260], "\n       yeni :", y[:260])
ra = [line for line in a if not FIS.match(line)]
rb = [line for line in b if not FIS.match(line)]
for x, y in zip(ra, rb):
    if x != y:
        print("  rapor taban:", x[:260], "\n        yeni :", y[:260])
if len(ra) != len(rb):
    print(f"  rapor satırı sayısı taban {len(ra)} · yeni {len(rb)}")
