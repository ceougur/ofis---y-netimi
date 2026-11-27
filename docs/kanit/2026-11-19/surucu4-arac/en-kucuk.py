"""En küçük örnekler (elle yazılmış olay listesi; tanımlar s117'den) → senaryo + kâhin beklenen (kâhin klasörüne YAZMAZ).
python3 -I en-kucuk.py <kök> <çıktı klasörü> <ad>  (olaylar aşağıdaki ÖRNEKLER sözlüğünden)"""
import json, os, sys
sys.dont_write_bytecode = True
kok, cikti, ad = sys.argv[1:4]
sys.path.insert(0, os.path.join(kok, "test", "bagimsiz", "muhasebe"))
import model as M  # noqa: E402

T = json.load(open(os.path.join(kok, "test/bagimsiz/muhasebe/senaryolar/s117-a5-s192-tek-kuyruk-payi.json"), encoding="utf-8"))
R = lambda ad_, **k: dict({"tur": "rapor", "ad": ad_}, **k)
ORNEKLER = {
    # P-ADAYI / R: şüpheliye almadan ÖNCE bağsız ödemeyle kapanmış faturaya, şüpheliye almadan SONRA bağlı tahsilat (rastgele-1 C4 P308'in en küçüğü)
    "ek-bag-sonra": [
        {"tur": "satis_faturasi", "id": "F1", "cari": "C1", "tarih": "2026-01-05", "M": 1000, "K": 0, "vade": "2026-01-10"},
        {"tur": "satis_faturasi", "id": "F2", "cari": "C1", "tarih": "2026-01-06", "M": 1000, "K": 0, "vade": "2026-01-20"},
        {"tur": "satis_faturasi", "id": "F3", "cari": "C1", "tarih": "2026-01-07", "M": 2000, "K": 0, "vade": "2026-03-31"},
        {"tur": "tahsilat", "id": "P1", "cari": "C1", "tarih": "2026-01-15", "tutar": 1000, "yol": "nakit"},
        {"tur": "supheliye_al", "id": "S1", "cari": "C1", "tarih": "2026-02-01", "tutar": 1000},
        R("af0205", rapor="acik_faturalar", cari="C1", tarih="2026-02-05"),
        {"tur": "tahsilat", "id": "P2", "cari": "C1", "tarih": "2026-02-10", "tutar": 1000, "yol": "nakit", "fatura": "F1"},
        R("sk", rapor="supheli_kayitlari", cari="C1"),
        R("mz", rapor="mizan", bas="2026-01-01", son="2026-02-28"),
    ],
    # Açık Faturalar raporunda şüpheliye alınmış fatura (bağ yok)
    "ek-supheli-acik": [
        {"tur": "satis_faturasi", "id": "F1", "cari": "C1", "tarih": "2026-01-05", "M": 1000, "K": 0, "vade": "2026-01-10"},
        {"tur": "satis_faturasi", "id": "F2", "cari": "C1", "tarih": "2026-01-06", "M": 500, "K": 0, "vade": "2026-03-31"},
        {"tur": "supheliye_al", "id": "S1", "cari": "C1", "tarih": "2026-02-01", "tutar": 1000},
        R("af", rapor="acik_faturalar", cari="C1", tarih="2026-02-05"),
        R("g", rapor="gecikmis", cari="C1", tarih="2026-02-05"),
    ],
}
y = {k: v for k, v in T.items() if k not in ("olaylar", "elle", "aciklama", "kapsam")}
y.update({"ad": ad, "aciklama": "sürücü bakımı 4 en küçük örnek", "kapsam": [], "olaylar": ORNEKLER[ad], "dallar": ["A"]})
os.makedirs(os.path.join(cikti, "beklenen"), exist_ok=True)
json.dump(y, open(os.path.join(cikti, ad + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
r = M.kos(y, M.Kurallar.etiketten("A"))
b = {"dil": M.DIL, "ad": ad, "dallar": {"A": {k: r[k] for k in ("raporlar", "redler", "degismezler", "devirler", "acilis_olabilir", "susmalar") if k in r}}}
json.dump(b, open(os.path.join(cikti, "beklenen", ad + ".json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)
print(ad, "redler", r["redler"], "susmalar", r.get("susmalar"))
for k, v in r["raporlar"].items():
    if k == "mz":
        v = {h: x["bakiye"] for h, x in v["satirlar"].items() if x["bakiye"]}
    print(k, json.dumps(v, ensure_ascii=False)[:500])
