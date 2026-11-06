"""WK 14: eski (taban 549359b0, değişiklikten önce alınmış kopya) senaryolar.json ↔ yeni senaryolar.json.
Eski her senaryonun BÜTÜN kaydı (ad, başlık, açıklama, kaynak, serbest, girdi, elle, TAM beklenen) bayt bayt aynı mı; üst alanlar; yeni senaryolar listesi.
Çıktı TAP özetli (# tests/pass/fail …) — kanit.mjs sayıları okur."""
import json
import sys

eski_yol, yeni_yol = sys.argv[1], sys.argv[2]


def d(o):
    return json.dumps(o, sort_keys=True, ensure_ascii=False)


E = json.load(open(eski_yol, encoding="utf-8"))
Y = json.load(open(yeni_yol, encoding="utf-8"))
ey = {s["ad"]: s for s in Y["senaryolar"]}
ayni = fark = yok = 0
for s in E["senaryolar"]:
    y = ey.get(s["ad"])
    if y is None:
        yok += 1
        print("not ok - YOK", s["ad"])
        continue
    if d(s) == d(y):
        ayni += 1
        print("ok - AYNI", s["ad"])
    else:
        fark += 1
        alanlar = [k for k in sorted(set(s) | set(y)) if d(s.get(k)) != d(y.get(k))]
        print("not ok - FARK", s["ad"], alanlar)
eski_adlar = {x["ad"] for x in E["senaryolar"]}
yeni = [s["ad"] for s in Y["senaryolar"] if s["ad"] not in eski_adlar]
sira_ayni = [s["ad"] for s in Y["senaryolar"] if s["ad"] not in yeni] == [s["ad"] for s in E["senaryolar"]]
print(f"# eski senaryo {len(E['senaryolar'])}: bayt bayt AYNI {ayni}, FARKLI {fark}, yeni dosyada YOK {yok}; eski sıra korunuyor: {sira_ayni}")
print(f"# yeni senaryo {len(yeni)}: {', '.join(yeni)}")
for k in sorted(set(E) | set(Y)):
    if k == "senaryolar":
        continue
    if d(E.get(k)) != d(Y.get(k)):
        if k == "kararlar":
            ek = [x for x in Y[k] if x not in E[k]]
            cik = [x for x in E[k] if x not in Y[k]]
            deg = [x for x in E[k] if x in Y[k] and d(E[k][x]) != d(Y[k][x])]
            print(f"# üst alan kararlar: eklenen {ek}, çıkan {cik}, değişen {deg}")
        else:
            print(f"# üst alan FARKLI: {k}")
    else:
        print(f"# üst alan aynı: {k}")
n = len(E["senaryolar"])
print(f"1..{n}")
for ad, v in (("tests", n), ("pass", ayni), ("fail", fark + yok), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
    print(f"# {ad} {v}")
sys.exit(0 if (fark == 0 and yok == 0 and sira_ayni) else 1)
