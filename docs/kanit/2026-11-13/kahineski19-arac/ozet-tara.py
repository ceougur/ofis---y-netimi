#!/usr/bin/env python3
"""Bakım 19 madde 4 taraması: belirsiz'de adı geçen (kalem düzeyinde SUS) carinin hâlâ yazılan toplam / özet anahtarları.
  python3 -I ozet-tara.py <test/bagimsiz/cari klasörü>"""
import importlib.util, json, os, re, subprocess, sys
from collections import Counter
K = os.path.abspath(sys.argv[1])
spec = importlib.util.spec_from_file_location("m", os.path.join(K, "model.py")); M = importlib.util.module_from_spec(spec); spec.loader.exec_module(M)
sen = []
d = os.path.join(K, "senaryolar")
for f in sorted(os.listdir(d)):
    if f.endswith(".json"):
        with open(os.path.join(d, f), encoding="utf-8") as g:
            sen.append((f[:-5], json.load(g)))
for tur in ("s1", "ux18"):
    for t in range(1, 11):
        o = subprocess.run([sys.executable, "-I", os.path.join(K, "uretici.py"), "--tur", tur, "--tohum", str(t), "--islem", "120"], capture_output=True, check=True).stdout
        sen.append(("rastgele-%s-%d" % (tur, t), json.loads(o)))
OZET = ("cariToplam", "gecikmis", "acikToplam", "acikEsitBakiye", "taksitDisi")
satir = []
for ad, s in sen:
    kc = {a["ad"]: a["cari"] for a in s["adimlar"] if a["islem"] in ("kart_ac", "stok_satis_taksit")}
    cariler = {a["ad"] for a in s["adimlar"] if a["islem"] == "cari_ac"}
    try:
        o = M.Model(json.loads(json.dumps(s)), 0, "2.5.0").kos()
    except SystemExit:
        continue
    den = o["denetimler"]
    for b in o.get("belirsiz", []):
        k = b.split(":")[0]
        cs = set()
        for m in re.finditer(r"\bcari (\S+)", b):
            cs.add(m.group(1).rstrip(",;:)"))
        for m in re.finditer(r"\bkart (\S+)", b):
            x = m.group(1).rstrip(",;:)")
            if x in kc:
                cs.add(kc[x])
        cs &= cariler
        neden = re.findall(r"S1\d\d(?: = [A-C])?|SK-\d+", b)
        for c in cs:
            for key in den:
                p = key.split(":")
                if p[0] != k:
                    continue
                if (len(p) >= 4 and p[2] == "cariToplam" and ":".join(p[3:]) == c) or (len(p) >= 4 and p[1] == "cari" and ":".join(p[2:-1]) == c and p[-1] in OZET):
                    satir.append((ad, key, json.dumps(den[key]["b"], ensure_ascii=False), ",".join(sorted(set(neden))) or b[:120]))
uniq = sorted(set(satir))
for x in uniq:
    print(" | ".join(x))
print("toplam", len(uniq))
c = Counter(x[3] for x in uniq)
for n, v in c.most_common():
    print("  %4d  %s" % (v, n))
