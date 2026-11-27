"""En küçük örnek: s118'in yalnız C1 kısmı (S200 × Açık Faturalar). python3 -I en-kucuk.py <depo kökü> <çıktı klasörü>
Beklenen dosya kâhinin MODELİYLE üretilir (kâhinin klasörüne yazılmaz; yalnız içe aktarılır, bayt kodu yazılmaz)."""
import json, os, sys
sys.dont_write_bytecode = True
kok, out = sys.argv[1], sys.argv[2]
sys.path.insert(0, os.path.join(kok, "test", "bagimsiz", "muhasebe"))
import model as M  # noqa: E402

s = json.load(open(os.path.join(kok, "test/bagimsiz/muhasebe/senaryolar/s118-a1-s200-elle-once-sonra-fatura.json"), encoding="utf-8"))
ev = s["olaylar"]
s2 = dict(s)
s2["ad"] = "ek-s200-acik-fatura"
s2["aciklama"] = "Sürücü bakımı 5 en küçük örnek: S200 kartı faturanın bir kısmını içine alır; Açık Faturalar F1 kalanı (kâhin net 20.000 ↔ program brüt 50.000)."
s2["cariler"] = {"C1": s["cariler"]["C1"]}
s2["olaylar"] = [ev[1], ev[4], ev[5], ev[9], ev[10]]   # F1, BY1, TK1, g1 (16.02), af1 (16.02)
os.makedirs(out, exist_ok=True)
json.dump(s2, open(os.path.join(out, "ek-s200-acik-fatura.senaryo.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
r = M.Model(s2, M.Kurallar()).kos()
json.dump({"dallar": {"A": r}}, open(os.path.join(out, "ek-s200-acik-fatura.beklenen.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1, sort_keys=True)
print(json.dumps(r["raporlar"], ensure_ascii=False))
