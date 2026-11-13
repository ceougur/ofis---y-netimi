"""Eski kabul.json ↔ yeni kabul.json farkı (bakım 2): senaryo / grup / anahtar başına; her fark kararla sınıflanır, açıklanamayan → BEKLENMEYEN.
Kullanım: python3 -I kabul-fark.py <eski> <yeni> <döküm.json>"""
import json
import re
import sys

eski = json.load(open(sys.argv[1], encoding="utf-8"))
yeni = json.load(open(sys.argv[2], encoding="utf-8"))
E = {s["ad"]: s for s in eski["senaryolar"]}
Y = {s["ad"]: s for s in yeni["senaryolar"]}
dokum = {"yeni_senaryo": sorted(set(Y) - set(E)), "kalkan_senaryo": sorted(set(E) - set(Y)), "adimi_degisen": [], "degisen": [], "beklenmeyen": [],
         "ust_alan_degisen": sorted(k for k in set(eski) | set(yeni) if k != "senaryolar" and eski.get(k) != yeni.get(k))}
say = {}


def sinifla(anahtar, ev, yv):
    if re.search(r":kart:[A-Z0-9_]+:odenen$", anahtar) and isinstance(ev, list) and isinstance(yv, int) and yv == max(ev):
        return "S154 B — SM-1 listesi okuma (b)'ye (karttan alınan paranın tamamı) indi"
    if re.search(r":kart:[A-Z0-9_]+:kalan$", anahtar) and isinstance(ev, list) and yv == 0 and 0 in ev:
        return "S154 B — avanslı kartın Kalan listesi 0'a indi (kararın 'Kalan 0')"
    return None


for ad in sorted(set(E) & set(Y)):
    e, y = E[ad], Y[ad]
    if e["senaryo"] != y["senaryo"]:
        dokum["adimi_degisen"].append(ad)
    if e.get("aciklama") != y.get("aciklama"):
        dokum.setdefault("aciklamasi_degisen", []).append(ad)
    eg = {json.dumps(g["secim"], sort_keys=True): g for g in e["gruplar"]}
    yg = {json.dumps(g["secim"], sort_keys=True): g for g in y["gruplar"]}
    if set(eg) != set(yg):
        dokum["beklenmeyen"].append({"senaryo": ad, "neden": "grup (seçim) kümesi değişti", "eski": sorted(eg), "yeni": sorted(yg)})
    for sec in sorted(set(eg) & set(yg)):
        be, by = eg[sec]["beklenen"], yg[sec]["beklenen"]
        if eg[sec]["alternatifler"] != yg[sec]["alternatifler"]:
            dokum["beklenmeyen"].append({"senaryo": ad, "secim": sec, "neden": "alternatifler değişti"})
        for a in sorted(set(be) | set(by)):
            ev, yv = be.get(a, "__YOK__"), by.get(a, "__YOK__")
            if ev == yv:
                continue
            sinif = sinifla(a, ev, yv) if "__YOK__" not in (ev, yv) else None
            kayit = {"senaryo": ad, "secim": sec, "anahtar": a, "eski": ev, "yeni": yv, "sinif": sinif}
            if sinif:
                dokum["degisen"].append(kayit)
                say[(ad.split("-")[0], sinif)] = say.get((ad.split("-")[0], sinif), 0) + 1
            else:
                dokum["beklenmeyen"].append(kayit)
dokum["ozet"] = sorted([list(k) + [v] for k, v in say.items()])
json.dump(dokum, open(sys.argv[3], "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)
print("yeni senaryo:", dokum["yeni_senaryo"])
print("kalkan senaryo:", dokum["kalkan_senaryo"])
print("adımı değişen:", dokum["adimi_degisen"])
print("açıklaması değişen:", dokum.get("aciklamasi_degisen", []))
print("üst alan değişen:", dokum["ust_alan_degisen"])
for r in dokum["ozet"]:
    print("DEGISEN", r)
print("toplam değişen %d, BEKLENMEYEN %d" % (len(dokum["degisen"]), len(dokum["beklenmeyen"])))
for b in dokum["beklenmeyen"][:20]:
    print("BEKLENMEYEN", json.dumps(b, ensure_ascii=False)[:300])
sys.exit(1 if dokum["beklenmeyen"] else 0)
