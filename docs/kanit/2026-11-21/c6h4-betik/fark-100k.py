# Kilitli temiz 100 bin: eski (5ee4d99e) ↔ yeni yanıtlar (olc-fis.mjs çıktıları). Kural farkı nedeni ve bilgi satırı dışındaki her alan AYNI olmalı.
# Kullanım: python3 -I fark-100k.py <eski öneki> <yeni öneki>
import json, sys
def strip(body):
    d = body.get("data", body)
    out = dict(d)
    out.pop("bilgi", None)
    out["kesinDegil"] = [r for r in d.get("kesinDegil", []) if r.get("kod") != "kural-farki"]
    return out
def rule(body):
    d = body.get("data", body)
    r = next((x for x in d.get("kesinDegil", []) if x.get("kod") == "kural-farki"), None)
    return (len(r.get("ayrinti") or []) if r else None, d.get("bilgi"))
bad = 0
for side in ["once", "sonra"]:
    a = json.load(open(f"{sys.argv[1]}-{side}.json", encoding="utf-8"))
    b = json.load(open(f"{sys.argv[2]}-{side}.json", encoding="utf-8"))
    for name in a:
        same = strip(a[name]) == strip(b[name])
        bad += 0 if same else 1
        print(f"{side} · {name}: neden dışı {'AYNI' if same else 'FARKLI'} · eski kural-farki {rule(a[name])} · yeni {rule(b[name])}")
print(f"SONUÇ: {bad} fark")
sys.exit(1 if bad else 0)
