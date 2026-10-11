# K2 (10.10.2026): bağımsız kâhin fark sınıfları — düzeltmeden önce (docs/kanit/2026-10-10/kahin/fark-tohum-1-33-json.tgz, HEAD ab4ebca) ve
# sonra (test/bagimsiz/cikti/fark-<t>.json, bu dal). Kullanım (depo kökünden):
#   mkdir -p /tmp/k2-onceki && tar xzf docs/kanit/2026-10-10/kahin/fark-tohum-1-33-json.tgz -C /tmp/k2-onceki
#   python3 -I docs/kanit/2026-10-10/k2-kurumsal-kart/kahin/karsilastir.py /tmp/k2-onceki test/bagimsiz/cikti 1 2 3
# Çıktı: tohum başına önce/sonra sınıf kümesi, YENİ sınıf (sonra var, önce yok) ve KART-HESABI-BAGLANMIYOR etiketli yaprakların kökü
# (fark.py:608'deki genel kural kart hesabındaki her A=B≠P farkını bu sınıfa yazar; burada her yaprağın farkı diğer bilinen sınıflarla açıklanır).
import collections
import json
import os
import sys

onceki, sonraki = sys.argv[1], sys.argv[2]
tohumlar = [int(x) for x in sys.argv[3:]] or [1, 2, 3]


def yukle(klasor, t):
    with open(os.path.join(klasor, "fark-%d.json" % t), encoding="utf-8") as fh:
        return json.load(fh)


def ana(sinif):
    s = sinif[len("TUREV:"):] if sinif.startswith("TUREV:") else sinif
    return set(s.split("+"))


genel = 0
for t in tohumlar:
    a, b = yukle(onceki, t), yukle(sonraki, t)
    sa, sb = set(a.get("siniflar") or {}), set(b.get("siniflar") or {})
    ana_a = set().union(*[ana(s) for s in sa]) if sa else set()
    ana_b = set().union(*[ana(s) for s in sb]) if sb else set()
    yeni = sorted(ana_b - ana_a)
    print("tohum %d: önce %d fark %s · sonra %d fark %s" % (t, a.get("farkSayisi"), a.get("desenSayilari"), b.get("farkSayisi"), b.get("desenSayilari")))
    print("  kalkan ana sınıflar:", sorted(ana_a - ana_b))
    print("  YENİ ana sınıflar:", yeni or "yok")
    genel += len(yeni)
    by = collections.defaultdict(dict)
    for f in b["farklar"]:
        y = f["yol"]
        k = y[1] if y[0] == "araDurumlar" else "SON"
        rest = ".".join(map(str, y[2:] if y[0] == "araDurumlar" else y))
        by[k][rest] = f
    with open(b["senaryoDosyasi"] if os.path.isabs(b["senaryoDosyasi"]) else os.path.join(os.getcwd(), b["senaryoDosyasi"]), encoding="utf-8") as fh:
        senaryo = json.load(fh)
    borclu = {x["ad"] for x in senaryo["adimlar"] if x.get("islem") == "hesap_ac" and x.get("tur") in ("kurumsal_kart", "kredi")}
    kart = [f for f in b["farklar"] if "KART-HESABI-BAGLANMIYOR" in f.get("kokSinif", "")]
    print("  KART-HESABI-BAGLANMIYOR etiketli yaprak:", len(kart))
    for f in kart:
        y = f["yol"]
        k = y[1] if y[0] == "araDurumlar" else "SON"
        rest = ".".join(map(str, y[2:] if y[0] == "araDurumlar" else y))
        g = by[k]
        if rest.endswith("kartVeKrediBorcu"):
            # Kart ve Kredi Borcu yalnız kurumsal kart (309) ve kredi (300) hesaplarından (SENARYO-DILI §8 ozet.kartVeKrediBorcu).
            parca = {key: g[key]["a"] - g[key]["program"] for key in g if key.startswith("bankaHesaplari.") and key.split(".")[1] in borclu and isinstance(g[key]["a"], int) and isinstance(g[key]["program"], int)}
            siniflar = {key: g[key].get("kokSinif") for key in parca}
            toplam = -sum(parca.values())
            print("   %s %s: fark %d = −Σ hesap farkları %d %s" % (k, rest, f["a"] - f["program"], toplam, "AÇIKLANDI" if toplam == f["a"] - f["program"] else "AÇIKLANMADI"), siniflar)
        else:
            a_, p_ = f["a"], f["program"]
            fark = {kk: a_[kk] - p_[kk] for kk in a_} if isinstance(a_, dict) else a_ - p_
            print("   %s %s: fark %s" % (k, rest, fark))
print("toplam yeni ana sınıf:", genel)
