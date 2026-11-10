"""2.4.9 ↔ 2.5.0 cari kâhini çıktı farkı (G3 sınıflaması): her senaryoda değişen / eklenen / kalkan denetim anahtarları, anahtar sınıfına göre.
Kullanım: python3 -I fark_cari.py <model.py> <senaryo.json ...> [--ayrinti]"""
import json, subprocess, sys, re, os
from collections import Counter, defaultdict
MODEL = sys.argv[1]
ayr = "--ayrinti" in sys.argv
dosyalar = [a for a in sys.argv[2:] if a.endswith(".json")]

def out(d, kural):
    r = subprocess.run([sys.executable, "-I", MODEL, d, "--kural", kural], capture_output=True)
    if r.returncode:
        return None
    return json.loads(r.stdout)["denetimler"]

def sinif(k):
    p = k.split(":")
    if p[0] == "adim":
        return "adim:" + p[-1]
    if len(p) >= 2 and p[1] == "mizan":
        return "mizan:" + p[2]
    if len(p) >= 3:
        return p[1] + ":" + (p[-1] if p[1] in ("fatura", "hareket", "cari", "kart") else p[2])
    return k
genel = Counter()
for d in dosyalar:
    a, b = out(d, "2.4.9"), out(d, "2.5.0")
    if a is None or b is None:
        print("%s: koşmadı (2.4.9=%s 2.5.0=%s)" % (os.path.basename(d), a is not None, b is not None))
        continue
    deg = [k for k in a if k in b and a[k]["b"] != b[k]["b"]]
    yeni = [k for k in b if k not in a]
    kalk = [k for k in a if k not in b]
    if not (deg or yeni or kalk):
        continue
    c = Counter(("değişti " + sinif(k)) for k in deg) + Counter(("eklendi " + sinif(k)) for k in yeni) + Counter(("kalktı " + sinif(k)) for k in kalk)
    genel.update(c)
    print("%s: %d değişti, %d eklendi, %d kalktı — %s" % (os.path.basename(d), len(deg), len(yeni), len(kalk), ", ".join("%s ×%d" % x for x in sorted(c.items()))))
    if ayr:
        for k in deg:
            print("    ≠ %s: 2.4.9 %s → 2.5.0 %s" % (k, json.dumps(a[k]["b"], ensure_ascii=False), json.dumps(b[k]["b"], ensure_ascii=False)))
        for k in yeni:
            print("    + %s: %s" % (k, json.dumps(b[k]["b"], ensure_ascii=False)))
        for k in kalk:
            print("    − %s: %s" % (k, json.dumps(a[k]["b"], ensure_ascii=False)))
print("GENEL:", ", ".join("%s ×%d" % x for x in sorted(genel.items())))
