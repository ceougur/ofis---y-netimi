"""En küçük örnek 2: yalnız fatura, Carinin Mevcut Borcu kartı faturanın tamamını alır (elle borç yok). python3 -I en-kucuk2.py <depo kökü> <çıktı klasörü>"""
import json, os, sys
sys.dont_write_bytecode = True
kok, out = sys.argv[1], sys.argv[2]
sys.path.insert(0, os.path.join(kok, "test", "bagimsiz", "muhasebe"))
import model as M  # noqa: E402

s = json.load(open(os.path.join(kok, "test/bagimsiz/muhasebe/senaryolar/s118-a1-s200-elle-once-sonra-fatura.json"), encoding="utf-8"))
ev = s["olaylar"]
s2 = dict(s)
s2["ad"] = "ek-mevcut-borc-tum-fatura"
s2["aciklama"] = "Sürücü bakımı 5 en küçük örnek 2: elle borç yok; Mevcut Borç kartı (50.000) faturanın (50.000) tamamını alır; Açık Faturalar F1."
s2["cariler"] = {"C1": s["cariler"]["C1"]}
kart = dict(ev[5], toplam=50000, taksitler=[{"tutar": 25000, "vade": "2026-03-01"}, {"tutar": 25000, "vade": "2026-04-01"}])
s2["olaylar"] = [ev[1], kart, ev[9], ev[10]]   # F1, TK1 (50.000), g1 (16.02), af1 (16.02)
os.makedirs(out, exist_ok=True)
json.dump(s2, open(os.path.join(out, "ek-mevcut-borc-tum-fatura.senaryo.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
r = M.Model(s2, M.Kurallar()).kos()
json.dump({"dallar": {"A": r}}, open(os.path.join(out, "ek-mevcut-borc-tum-fatura.beklenen.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)
print(json.dumps(r["raporlar"], ensure_ascii=False))
