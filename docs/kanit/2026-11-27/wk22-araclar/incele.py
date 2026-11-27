#!/usr/bin/env python3
# WK 22: I19 ihlalinin incelenmesi — rastgele senaryonun bir carisi için olaylar, borç girdisi, Meta iletileri, Atlandı'lar, yanıtlar.
import os
import random
import sys
import json
import importlib.util

kok = os.path.abspath(sys.argv[1]); tohum = int(sys.argv[2]); no_ = int(sys.argv[3]); cid = sys.argv[4]
sys.path.insert(0, kok)
spec = importlib.util.spec_from_file_location("kahin_test", os.path.join(kok, "kahin_test.py"))
kt = importlib.util.module_from_spec(spec); spec.loader.exec_module(kt)
kahin = kt.kahin
rnd = random.Random(tohum)
for no in range(no_ + 1):
    g, _ = kt.c5c_rastgele(rnd, no)
b = kt._IzliBenzetim(g, kahin.tam_secim({}), "hizli"); r = b.calistir()
iso = lambda ms: kahin.iso(ms, b.tz)
print("borc:", json.dumps(next(c for c in g["cariler"] if c["id"] == cid)["borc"], ensure_ascii=False))
print("kanca:", g["meta_davranis"]["kanca"].get(cid), "mesaj:", g["meta_davranis"]["mesaj"].get(cid), "ayar:", g.get("ayar"))
for o in sorted(g["olaylar"], key=lambda o: kahin.zaman_ayristir(o["t"], b.T0)):
    if cid in json.dumps(o) or o["tur"] in ("devir", "devri_geri_al") or (o.get("toplu") and any(cid == x.split("/")[-1] for x in r["isler"] if x.startswith(o["toplu"] + "/"))):
        print(iso(kahin.zaman_ayristir(o["t"], b.T0)), json.dumps(o, ensure_ascii=False))
for (s, c, sab, ts) in b.iz_ileti:
    if c == cid:
        print("META", iso(ts), sab)
for x in b.iz_atla:
    if x[2] == cid:
        print("ATLA", iso(x[0]), x[1], x[3])
for k, v in r["isler"].items():
    if k.split("/")[1].split("#")[0] == cid:
        print("İŞ", k, json.dumps({a: v.get(a) for a in ("durum", "post", "degiskenler", "atlanma_nedeni")}, ensure_ascii=False))
for k, v in (r.get("yeniden") or {}).items():
    if cid in json.dumps(v):
        print("YANIT", k, json.dumps(v, ensure_ascii=False))
print("elenen:", {k: v[cid] for k, v in r["elenen"].items() if cid in v})
