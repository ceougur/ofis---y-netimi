# Ç6-HESAP tur 5: iki fark5.mjs çıktısını BAYT BAYT karşılaştırır (her anahtarın JSON metni). Çağrı: python3 -I fark5.py <tur4.json> <yeni.json>
import json, sys
a = json.load(open(sys.argv[1], encoding="utf-8"))
b = json.load(open(sys.argv[2], encoding="utf-8"))
keys = sorted(set(a) | set(b))
bad = [k for k in keys if a.get(k) != b.get(k)]
states = {}
for k in keys:
    parts = k.split("|")
    st = parts[1] if len(parts) > 2 else parts[-1]
    states[st] = states.get(st, 0) + 1
rule = sum(1 for k in keys if '"kod":"kural-farki"' in (a.get(k) or ""))
info = sum(1 for k in keys if '"bilgi":[' in (a.get(k) or ""))
non200 = sum(1 for k in keys if (a.get(k) or "").startswith('{"status":') and not (a.get(k) or "").startswith('{"status":200'))
print(f"anahtar {len(keys)} · durumlar {states}")
print(f"kural-farki nedenli yanıt {rule} · bilgi satırlı yanıt {info} · 200 olmayan okuma {non200}")
for k in keys:
    if k.split("|")[-1] in ("fis", "yonetim", "PUT", "ters"):
        print(f"  {k}: tur4 {a.get(k)} · yeni {b.get(k)}")
for k in bad[:20]:
    print(f"FARK {k}\n  tur4 {str(a.get(k))[:300]}\n  yeni {str(b.get(k))[:300]}")
print(f"SONUÇ: {len(bad)} fark / {len(keys)}")
sys.exit(1 if bad else 0)
