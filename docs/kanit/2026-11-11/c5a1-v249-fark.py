import json, sys
for kind in ("kilitsiz", "kilitli"):
    a = json.load(open(f"{sys.argv[1]}/v249-{kind}-once.json")); b = json.load(open(f"{sys.argv[1]}/v249-{kind}-sonra.json"))
    print(f"===== {kind}: şema {a['schema']} → {b['schema']}")
    for key in ("mizan", "mizan2025", "mizan2026"):
        codes = sorted(set(a[key]) | set(b[key]))
        diff = [(c, a[key].get(c, 0), b[key].get(c, 0)) for c in codes if abs(a[key].get(c, 0) - b[key].get(c, 0)) > 0.004]
        print(f"  {key}: " + ("; ".join(f"{c} {x} → {y}" for c, x, y in diff) or "fark yok"))
    for key in ("cari", "kdv", "stok"):
        print(f"  {key}: {'AYNI' if a[key] == b[key] else 'FARKLI ' + json.dumps([a[key], b[key]], ensure_ascii=False)[:600]}")
    print(f"  yevmiye 2025 satırları: {len(a['yevmiye2025'])} → {len(b['yevmiye2025'])} · {'BAYT BAYT AYNI' if a['yevmiye2025'] == b['yevmiye2025'] else 'FARKLI'}")
    print(f"  Mutabakat Testi: {a['mutabakat']['ok']} → {b['mutabakat']['ok']} · sonra başarısız: {json.dumps(b['mutabakat']['failures'], ensure_ascii=False)[:700]}")
    print(f"  Açılış Karşılığı: {json.dumps(b['mutabakat']['acilis'], ensure_ascii=False)}")
    print(f"  Defter Mutabakatı uyumsuz satırlar: {json.dumps(b['defterMutabakati']['uyumsuz'], ensure_ascii=False)[:500]}")
    ao = b['acilisOlabilir']
    print(f"  Açılış Olabilir: {ao.get('counts')} · {[ (i['note'], i['amount']) for i in ao.get('items', [])]}")
