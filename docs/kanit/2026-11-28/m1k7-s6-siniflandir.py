# m1k7: onarım üretecinde notun 'ilk aydan (X)' onarımı sonuç VERMEYEN tohumlar sınıflandırılır — X'ten ÖNCE 'Mahsup Edilmemiş Ay' var mı (s2 yeni çıktısının notundan;
# aynı tohum → aynı veri). Onarım cümlesi yalnız mahsup FİŞİ olan ayları söyler; mahsupsuz ayın kendi notu ('ayları sırayla mahsup edin') ayrıca uygulanmalı.
# python3 -I m1k7-s6-siniflandir.py <s6.jsonl> <s2-yeni.jsonl>
import json, re, sys

AY = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]
PAT = r"(?:" + "|".join(AY) + r") \d{4}"

def ym(t):
    a, y = t.split()
    return f"{y}-{AY.index(a) + 1:02d}"

s6 = {r["seed"]: r for r in (json.loads(l) for l in open(sys.argv[1], encoding="utf-8") if l.startswith("{"))}
s2 = {r["seed"]: r for r in (json.loads(l) for l in open(sys.argv[2], encoding="utf-8") if l.startswith("{"))}
good = good_pend = bad_pend = 0
bad_nopend, kollar = [], {"devreden": 0, "eksi": 0}
for sd, r in sorted(s6.items()):
    o = r.get("onarim")
    if not o:
        continue
    note = s2[sd]["notes"].get("Zincirle Uyuşmayan Mahsup Fişi", "")
    kollar["eksi" if "azalmayı düşmemiş" in note else "devreden"] += 1
    pend = s2[sd]["notes"].get("Mahsup Edilmemiş Ay", "").split(" (")[0]
    before = [m for m in (ym(x) for x in re.findall(PAT, pend)) if m < o["start"]]
    ok = o["uyusmazlikKalkti"] and o["denge"] and o["ayToplami"] and o["raporFis"]
    if ok:
        good += 1
        good_pend += bool(before)
    elif before:
        bad_pend += 1
    else:
        bad_nopend.append(sd)
print(f"{sys.argv[1].split('/')[-1]}: onarım uygulanan {good + bad_pend + len(bad_nopend)} (devreden kolu içeren {kollar['devreden']}, eksi yönlü {kollar['eksi']}) · "
      f"not KALKTI {good} (bunların {good_pend}'inde başlangıçtan önce mahsupsuz ay vardı) · KALKMADI ve başlangıçtan önce mahsupsuz ay VAR {bad_pend} · "
      f"KALKMADI, önce mahsupsuz ay YOK {len(bad_nopend)} {bad_nopend[:10]}")
