# Eski ↔ yeni kabul.json: senaryo × grup (birleşim seçimi) başına değişen / kalkan / yeni beklentiler; anahtar sınıfı (alan türü) ile.
# Kullanım: python3 -I -B kabul-fark.py <eski kabul.json> <yeni kabul.json> > dokum.json ; özet stderr'e
import json, sys, re, collections

eski = json.load(open(sys.argv[1], encoding="utf-8"))
yeni = json.load(open(sys.argv[2], encoding="utf-8"))


def taban_ve_gruplar(kayit):
    """Her seçim için tam beklenen (fark_gruplar tabana uygulanır)."""
    out = {}
    taban = kayit["gruplar"][0]["beklenen"] if kayit["gruplar"] else {}
    for g in kayit["gruplar"]:
        out[json.dumps(g["secim"], sort_keys=True)] = (g["beklenen"], g.get("alternatifler", []))
    for g in kayit.get("fark_gruplar", []):
        b = dict(taban)
        for k, v in g["fark"].items():
            if v == "__yok__":
                b.pop(k, None)
            else:
                b[k] = v
        out[json.dumps(g["secim"], sort_keys=True)] = (b, g.get("alternatifler", []))
    return out


def sinif(k):
    m = re.search(r":kart:[^:]+:(odenen|kalan|fazla|tahsilatSayisi|taksit\d+:odenen)$", k)
    if m:
        return "kart:" + re.sub(r"\d+", "<i>", m.group(1))
    m = re.match(r"adim:[^:]+:(\w+)$", k)
    if m:
        return "adim:" + m.group(1)
    m = re.search(r":(cari:[^:]+:\w+|fatura:[^:]+:acik|acilis:[^:]+:kalan|kasa|kasaGun|banka|pos|kartHesap|hesapsiz|portfoy|evrakSayisi|stok:[^:]+:\w+)", k)
    return re.sub(r":[^:]+:", ":<ad>:", m.group(1)) if m else "diger"


E = {s["ad"]: s for s in eski["senaryolar"]}
Y = {s["ad"]: s for s in yeni["senaryolar"]}
dokum = []
say = collections.Counter()
for ad in sorted(set(E) | set(Y)):
    if ad not in E:
        dokum.append({"senaryo": ad, "durum": "YENİ SENARYO"})
        say["yeni-senaryo"] += 1
        continue
    if ad not in Y:
        dokum.append({"senaryo": ad, "durum": "KALKAN SENARYO"})
        say["kalkan-senaryo"] += 1
        continue
    if E[ad]["senaryo"] != Y[ad]["senaryo"]:
        dokum.append({"senaryo": ad, "durum": "ADIMLAR DEĞİŞTİ"})
        say["adim-degisti"] += 1
    eg, yg = taban_ve_gruplar(E[ad]), taban_ve_gruplar(Y[ad])
    for sec in sorted(set(eg) | set(yg)):
        if sec not in eg or sec not in yg:
            dokum.append({"senaryo": ad, "secim": sec, "durum": "grup yalnız birinde"})
            say["grup-farki"] += 1
            continue
        (eb, ea), (yb, ya) = eg[sec], yg[sec]
        for k in sorted(set(eb) | set(yb)):
            if eb.get(k, "__yok__") != yb.get(k, "__yok__"):
                dokum.append({"senaryo": ad, "secim": json.loads(sec), "anahtar": k, "sinif": sinif(k), "eski": eb.get(k, "__yok__"), "yeni": yb.get(k, "__yok__")})
                say[sinif(k)] += 1
        if ea != ya:
            dokum.append({"senaryo": ad, "secim": json.loads(sec), "durum": "alternatifler değişti"})
            say["alternatif"] += 1
json.dump(dokum, sys.stdout, ensure_ascii=False, indent=1, sort_keys=True)
sys.stdout.write("\n")
per = collections.Counter(d["senaryo"] for d in dokum)
sys.stderr.write("sınıf: %s\nsenaryo: %s\n" % (dict(sorted(say.items())), dict(sorted(per.items()))))
