"""Bir senaryoda carinin olayları (no, tür, tarih, alanlar) — şüpheli / bağ analizi için.
python3 -I cari-gecmis.py <senaryo.json> <olay id ya da cari> [son no]"""
import json, sys
s = json.load(open(sys.argv[1], encoding="utf-8"))
O = s["olaylar"]
hedef = sys.argv[2]
son = int(sys.argv[3]) if len(sys.argv) > 3 else len(O)
cari = next((o.get("cari") for o in O if o.get("id") == hedef), hedef)
idler = {o.get("id") for o in O if o.get("cari") == cari} - {None}
print("cari", cari, s["cariler"].get(cari))
for i, o in enumerate(O[:son], 1):
    if o.get("cari") == cari or o.get("kaynak") in idler or o.get("hedef") in idler or o.get("kayit") in idler:
        print(i, json.dumps(o, ensure_ascii=False)[:260])
