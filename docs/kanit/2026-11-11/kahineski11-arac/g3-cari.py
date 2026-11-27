import collections
import json
import sys

W = sys.argv[1]
d = json.load(open(sys.argv[2], encoding="utf-8"))
sen = {f: json.load(open("%s/test/bagimsiz/cari/senaryolar/%s.json" % (W, f), encoding="utf-8")) for f in ("d37-c5-s126-faturali-kart", "d36-c5-s122-kart-odemesi")}
c = collections.Counter()
for x in d["dokum"]:
    k, s = x["anahtar"], sen[x["senaryo"]]
    p = k.split(":")
    adim = {a["id"]: a for a in s["adimlar"]}
    fc = {a["ad"]: a["cari"] for a in s["adimlar"] if a["islem"] == "fatura"}
    kc = {a["ad"]: a["cari"] for a in s["adimlar"] if a["islem"] == "kart_ac"}
    cari = None
    if p[1] == "cari":
        cari = p[2]
    elif p[1] == "fatura":
        cari = fc.get(p[2])
    elif p[1] == "kart":
        cari = kc.get(p[2])
    elif p[1] == "hareket":
        cari = p[3] if p[2] == "acilis" else adim[p[2]]["cari"]
    elif p[2] == "hareket":
        cari = p[4] if p[3] == "acilis" else adim[p[3]]["cari"]
    elif p[2] == "fatura":
        cari = fc.get(p[3])
    c[(x["senaryo"][:3], cari, x["sinif"], x["tur"])] += 1
for k, v in sorted(c.items(), key=lambda z: (z[0][0], str(z[0][1]))):
    print(k, v)
