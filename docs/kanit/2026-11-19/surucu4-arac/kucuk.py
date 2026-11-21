"""Bir senaryodan bir carinin olaylarını (ve açılışları) bir olay numarasına kadar alıp küçük senaryo + kâhin beklenen dosyası üretir (kâhinin klasörüne YAZMAZ).
python3 -I kucuk.py <kök> <senaryo.json> <cari> <son no> <çıktı klasörü> <ad> [rapor json listesi]"""
import json, os, sys
sys.dont_write_bytecode = True
kok, sen, cari, son, cikti, ad = sys.argv[1:7]
raporlar = json.loads(sys.argv[7]) if len(sys.argv) > 7 else []
sys.path.insert(0, os.path.join(kok, "test", "bagimsiz", "muhasebe"))
import model as M  # noqa: E402

s = json.load(open(sen, encoding="utf-8"))
O = s["olaylar"][: int(son)]
idler = {o.get("id") for o in O if o.get("cari") == cari} - {None}
tut = []
for o in O:
    if o["tur"] in ("kasa_acilis", "banka_acilis", "kart_acilis", "kredi_acilis") or o.get("cari") == cari or (o.get("kayit") in idler) or (o.get("kaynak") in idler):
        if o["tur"] == "rapor" or (os.environ.get("SON_TARIH") and (o.get("tarih") or "") > os.environ["SON_TARIH"]):
            continue
        tut.append(o)
y = dict(s)
y["ad"] = ad
y["olaylar"] = tut + raporlar
y.pop("elle", None)
y["dallar"] = ["A"]
os.makedirs(os.path.join(cikti, "beklenen"), exist_ok=True)
json.dump(y, open(os.path.join(cikti, ad + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
r = M.kos(y, M.Kurallar.etiketten("A"))
b = {"dil": M.DIL, "ad": ad, "dallar": {"A": {k: r[k] for k in ("raporlar", "redler", "degismezler", "devirler", "acilis_olabilir", "susmalar") if k in r}}}
json.dump(b, open(os.path.join(cikti, "beklenen", ad + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)
print(ad, len(tut), "olay;", "redler", r["redler"], "susmalar", r.get("susmalar"))
for k, v in r["raporlar"].items():
    print(k, json.dumps(v, ensure_ascii=False)[:600])
