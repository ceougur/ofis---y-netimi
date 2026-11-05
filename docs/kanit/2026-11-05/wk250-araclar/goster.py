import json
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, sys.argv[1])
import kahin  # noqa: E402
import senaryolar  # noqa: E402

for s in senaryolar.tum_senaryolar():
    if not any(p in s["ad"] for p in sys.argv[2:]):
        continue
    r = kahin.hesapla(senaryolar.girdi(s))[0]["sonuc"]
    print("=====", s["ad"])
    print(json.dumps({k: r[k] for k in ("baslamadi", "elenen", "olusmadi", "onceki_uyari", "toplular", "durum_sayilari", "degismez", "bu_ay") if k in r}, ensure_ascii=False))
    print(json.dumps(r["meta"], ensure_ascii=False))
    for k, v in r.get("kontroller", {}).items():
        print(" ", k, json.dumps(v, ensure_ascii=False)[:600])
    for k, v in (r.get("isler") or {}).items():
        print(" ", k, json.dumps({x: v[x] for x in ("durum", "hata_kodu", "post", "kabul", "medya_yukleme", "medya_silme", "atlanma_nedeni")}, ensure_ascii=False))
