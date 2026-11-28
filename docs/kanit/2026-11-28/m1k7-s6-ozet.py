# m1k7: onarım üretecinin (m1k6-s6-onarim.mjs) çıktısı — notta 'ilk aydan (X)' olan her tohumda onarımdan sonra uyuşmazlık notu kalktı mı, denge / ay toplamı / rapor = fiş tuttu mu.
# python3 -I m1k7-s6-ozet.py <s6.jsonl>…
import json, sys

for p in sys.argv[1:]:
    rows = [json.loads(l) for l in open(p, encoding="utf-8") if l.strip().startswith("{")]
    err = [r["seed"] for r in rows if "error" in r]
    rep = [r for r in rows if r.get("onarim")]
    bad = [r["seed"] for r in rep if not (r["onarim"]["uyusmazlikKalkti"] and r["onarim"]["denge"] and r["onarim"]["ayToplami"] and r["onarim"]["raporFis"])]
    kalan = [(r["seed"], r["onarim"]["degisen"][:120]) for r in rep if not r["onarim"]["guncelDegilYok"]]
    print(f"{p.split('/')[-1]}: tohum {len(rows)} · hata {len(err)} {err[:10]} · onarım uygulanan {len(rep)} · uyuşmazlık notu KALAN ya da denge / ay toplamı / rapor = fiş bozulan {len(bad)} {bad[:10]}")
    print(f"  onarımdan sonra 'Mahsuptan Sonra Değişen Ay' notu kalan {len(kalan)}: {kalan[:5]}")
