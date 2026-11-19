# ci.yml'deki e2e adlarından (ci-e2e.txt) cari VE taksit / iade yoluna dokunan senaryoları seçer (tarama). Kullanım: python3 -I e2e-sec.py <kök> <ci-e2e.txt>
import json, re, sys, os
root, lst = sys.argv[1], sys.argv[2]
scripts = json.load(open(os.path.join(root, "package.json")))["scripts"]
cari = re.compile(r"api/workspace/accounts|Cari Kart|Cari Listesi|Tahsilat")
kart = re.compile(r"api/workspace/plans|Taksit|sale_return|installments|coversBalance|Mevcut Borç|Vade Takip|obligation|tyk", re.I)
out = []
for name in open(lst).read().split():
    cmd = scripts.get(name, "")
    files = re.findall(r"test/e2e/[A-Za-z0-9_./-]+\.mjs", cmd)
    if not files:
        continue
    text = open(os.path.join(root, files[0]), encoding="utf-8").read()
    if "tyk" in name or (cari.search(text) and kart.search(text)):
        out.append(name)
print(" ".join(out))
print(len(out), file=sys.stderr)
