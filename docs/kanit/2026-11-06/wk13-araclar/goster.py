# -*- coding: utf-8 -*-
"""WK13: yeni senaryoların modeldeki özet çıktısı (elle beklenenden bağımsız göz denetimi). Kullanım: python3 -I goster.py <kahin klasörü> <ad öneki> ..."""
import json
import sys
sys.dont_write_bytecode = True
sys.path.insert(0, sys.argv[1])
import kahin  # noqa: E402
import senaryolar  # noqa: E402

for s in senaryolar.tum_senaryolar():
    if not any(s["ad"].startswith(p) for p in sys.argv[2:]):
        continue
    r = kahin.hesapla(senaryolar.girdi(s))[0]["sonuc"]
    print("=====", s["ad"])
    print(" elenen:", json.dumps(r["elenen"], ensure_ascii=False)[:400])
    print(" olusmadi:", r["olusmadi"], "toplular:", json.dumps(r["toplular"], ensure_ascii=False)[:300])
    print(" yeniden:", json.dumps(r.get("yeniden"), ensure_ascii=False)[:600])
    for k, j in r["isler"].items():
        print(f"  {k}: durum={json.dumps(j['durum'], ensure_ascii=False)[:120]} post={j['post']} kabul={j['kabul']} atl={json.dumps(j['atlanma_nedeni'], ensure_ascii=False)[:80]} "
              f"hk={j['hata_kodu']} d={json.dumps(j['degiskenler'], ensure_ascii=False)[:160]}")
    print(" bu_ay:", r["bu_ay"], "durum_sayilari:", json.dumps(r["durum_sayilari"], ensure_ascii=False)[:300])
    for kk, kv in r["kontroller"].items():
        print("  kontrol", kk, json.dumps(kv.get("isler"), ensure_ascii=False)[:300])
