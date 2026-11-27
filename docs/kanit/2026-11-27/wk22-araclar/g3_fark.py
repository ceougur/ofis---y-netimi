#!/usr/bin/env python3
# WK 22 G3: taban (t251-wk21, değişiklikten önce alınmış kopya) senaryolar.json ↔ yeni senaryolar.json — eski 414 senaryonun girdi + elle + TAM model sonucu (başlık / kaynak /
# açıklama dahil) bayt bayt; değişen her yaprak yolu dökülür; açıklanmış değişiklik listesi (README §27.7) dışındaki her değişiklik BEKLENMEYEN sayılır. Üst alanlar ayrıca.
# Kullanım: python3 -I <bu dosya> <taban senaryolar.json> <yeni senaryolar.json>
import json
import sys

eski = json.load(open(sys.argv[1], encoding="utf-8"))
yeni = json.load(open(sys.argv[2], encoding="utf-8"))
ACIKLANMIS = {   # senaryo önekleri → izinli yol önekleri (README §27.7; S-W21-3 = A)
    "S23-04": ("elle[0].yollar.isler.T1/MK.degiskenler[2]", "elle[0].yollar.isler.T1/MK.degiskenler[3]",
               "beklenen[0].sonuc.isler.T1/MK.degiskenler[2]", "beklenen[0].sonuc.isler.T1/MK.degiskenler[3]"),
    "S29-03": ("elle[0].yollar.isler.T1/MZ.degiskenler[2]", "elle[0].yollar.isler.T1/MZ.degiskenler[3]",
               "beklenen[0].sonuc.isler.T1/MZ.degiskenler[2]", "beklenen[0].sonuc.isler.T1/MZ.degiskenler[3]"),
}


def yapraklar(o, yol=""):
    if isinstance(o, dict):
        for k, v in o.items():
            yield from yapraklar(v, f"{yol}.{k}" if yol else k)
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from yapraklar(v, f"{yol}[{i}]")
    else:
        yield yol, o


ys = {s["ad"]: s for s in yeni["senaryolar"]}
ayni = degisen = beklenmeyen = 0
for s in eski["senaryolar"]:
    y = ys.get(s["ad"])
    if y is None:
        print(f"not ok YOK {s['ad']}"); beklenmeyen += 1; continue
    a = json.dumps(s, ensure_ascii=False, sort_keys=True); b = json.dumps(y, ensure_ascii=False, sort_keys=True)
    if a == b:
        ayni += 1; continue
    degisen += 1
    ea = dict(yapraklar(s)); eb = dict(yapraklar(y))
    yollar = sorted(set(ea) | set(eb))
    farkli = [p for p in yollar if ea.get(p, "<yok>") != eb.get(p, "<yok>")]
    izin = next((v for k, v in ACIKLANMIS.items() if s["ad"].startswith(k)), None)
    for p in farkli:
        acik = izin is not None and p.startswith(izin)
        if not acik:
            beklenmeyen += 1
        print(f"{'  ' if acik else 'BEKLENMEYEN '}{s['ad'][:40]} {p}: {json.dumps(ea.get(p, '<yok>'), ensure_ascii=False)[:90]} → {json.dumps(eb.get(p, '<yok>'), ensure_ascii=False)[:90]}")
yeni_adlar = [a for a in ys if a not in {s["ad"] for s in eski["senaryolar"]}]
print(f"# eski {len(eski['senaryolar'])} senaryo: {ayni} bayt bayt aynı, {degisen} değişti; yeni senaryo {len(yeni_adlar)}: {', '.join(x[:8] for x in yeni_adlar)}")
for k in sorted(set(eski) | set(yeni)):
    if k == "senaryolar":
        continue
    if eski.get(k) != yeni.get(k):
        if k == "kararlar":
            ek = set(yeni[k]) - set(eski[k]); ck = set(eski[k]) - set(yeni[k]); dk = [x for x in eski[k] if x in yeni[k] and eski[k][x] != yeni[k][x]]
            print(f"# üst alan kararlar: eklenen {sorted(ek)}, çıkan {sorted(ck)}, değişen {dk}")
            if ck or dk:
                beklenmeyen += 1
        else:
            print(f"BEKLENMEYEN üst alan {k} değişti"); beklenmeyen += 1
print(f"# tests 1\n# pass {1 if beklenmeyen == 0 else 0}\n# fail {0 if beklenmeyen == 0 else 1}\n# cancelled 0\n# skipped 0\n# todo 0\n# beklenmeyen değişiklik {beklenmeyen}")
sys.exit(0 if beklenmeyen == 0 else 1)
