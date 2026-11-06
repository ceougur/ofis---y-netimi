"""WK 14: yeni S22 senaryoları × mutantlar (YENİ kâhin) — hangi senaryo hangi mutantı DEĞERLE (elle beklenen) yakalıyor; istisnayla düşen ayrıca yazılır.
Kullanım: python3 -I mutant_matrisi.py <kâhin klasörü> <senaryolar.json> <başlık> M210 M211 …
TAP: her mutant bir test — 'ok' = en az bir senaryoda DEĞERLE yakalandı (istisna yakalama sayılmaz)."""
import json
import sys

klasor, yol, baslik = sys.argv[1:4]
mutlar = sys.argv[4:]
sys.dont_write_bytecode = True
sys.path.insert(0, klasor)
import kahin  # noqa: E402

print(f"# kâhin: {kahin.__file__}")
Y = json.load(open(yol, encoding="utf-8"))
sen = [s for s in Y["senaryolar"] if s["baslik"] == baslik]


def d(o):
    return json.dumps(o, sort_keys=True, ensure_ascii=False)


gecen = 0
for i, m in enumerate(mutlar, 1):
    satir = []
    deger = 0
    for s in sen:
        try:
            b = kahin.hesapla(dict(s["girdi"]), frozenset([m]))
        except Exception as e:  # noqa: BLE001
            satir.append(f"{s['ad'][:6]}: İSTİSNA {type(e).__name__}: {str(e)[:90]}")
            continue
        ilk = None
        for e_ in s["elle"]:
            for y_, v in e_["yollar"].items():
                if d(kahin.yol_al(b[0]["sonuc"], y_)) != d(v):
                    ilk = f"{y_}: elle {d(v)[:70]} ≠ mutant {d(kahin.yol_al(b[0]['sonuc'], y_))[:70]}"
                    break
            if ilk:
                break
        if ilk:
            deger += 1
            satir.append(f"{s['ad'][:6]}: DEĞERLE — {ilk}")
        else:
            satir.append(f"{s['ad'][:6]}: yakalamadı")
    if deger:
        gecen += 1
    print(f"{'ok' if deger else 'not ok'} {i} - {m} ({kahin.MUTASYONLAR.get(m, '?')[:110]}): {deger}/{len(sen)} senaryoda değerle")
    for x in satir:
        print(f"  # {x}")
n = len(mutlar)
print(f"1..{n}")
for ad, v in (("tests", n), ("pass", gecen), ("fail", n - gecen), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
    print(f"# {ad} {v}")
sys.exit(0 if gecen == n else 1)
