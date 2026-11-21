# Kullanım: python3 -I surucu-fark.py <taban sürücü çıktısı> <yeni sürücü çıktısı>
# Her senaryo × TZ için AYNI olmayan satırları (rapor satırları + redler + adım farkları) çıkarır; tabanda olup yenide olmayan (KALKAN), yenide olup tabanda olmayan (YENİ)
# ve değeri değişen satırları adıyla yazar; kimlik / sınıf sayılarını iki yanda verir.
import json, os, sys, collections


def rows(root):
    out = {}
    for tz in ("UTC", "Europe-Istanbul"):
        d = os.path.join(root, tz)
        for name in sorted(os.listdir(d)):
            if not name.endswith(".fark.json"):
                continue
            j = json.load(open(os.path.join(d, name), encoding="utf-8"))
            sen = name[: -len(".fark.json")]
            for rk, r in (j.get("raporlar") or {}).items():
                for s in r.get("satirlar") or []:
                    if s.get("sinif") == "AYNI":
                        continue
                    key = (sen, tz, "rapor", rk, str(s.get("alan")), str(s.get("anahtar")))
                    out[key] = (s.get("sinif"), "|".join(map(str, s.get("kimlik") or [])) if isinstance(s.get("kimlik"), list) else str(s.get("kimlik") or ""), str(s.get("program"))[:160], str(s.get("kahin"))[:160])
            for i, s in enumerate(j.get("redler") or []):
                if s.get("sonuc") == "AYNI":
                    continue
                key = (sen, tz, "red", str(s.get("no")), str(s.get("tur")), str(s.get("id")))
                out[key] = (s.get("sonuc"), str(s.get("kimlik") or ""), json.dumps(s.get("program"), ensure_ascii=False)[:200], json.dumps(s.get("kahin"), ensure_ascii=False)[:160])
            for i, s in enumerate(j.get("adim_farklari") or []):
                key = (sen, tz, "adim", str(i), "", "")
                out[key] = (s.get("sinif", "?"), str(s.get("kimlik") or ""), json.dumps(s, ensure_ascii=False)[:240], "")
    return out


a, b = rows(sys.argv[1]), rows(sys.argv[2])
def say(x):
    c = collections.Counter((v[0], v[1][:70]) for v in x.values())
    return c
print("TABAN sınıf × kimlik:")
for k, v in sorted(say(a).items(), key=str):
    print("  ", k, v)
print("YENİ sınıf × kimlik:")
for k, v in sorted(say(b).items(), key=str):
    print("  ", k, v)
print("\nKALKAN (tabanda var, yenide yok):", len(set(a) - set(b)))
for k in sorted(set(a) - set(b)):
    print("  ", k, a[k])
print("\nYENİ (yenide var, tabanda yok):", len(set(b) - set(a)))
for k in sorted(set(b) - set(a)):
    print("  ", k, b[k])
ch = [k for k in set(a) & set(b) if a[k] != b[k]]
print("\nDEĞİŞEN (iki yanda da AYNI değil, değer / sınıf farklı):", len(ch))
for k in sorted(ch):
    print("  ", k, "\n     taban", a[k], "\n     yeni ", b[k])
