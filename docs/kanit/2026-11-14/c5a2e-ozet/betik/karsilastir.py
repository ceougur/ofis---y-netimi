#!/usr/bin/env python3
# eski ↔ yeni esd çıktısı: her anahtarın gövdesi bayt bayt aynı mı; farklıysa ilk farkın yolu
import json, sys
a = json.load(open(sys.argv[1])); b = json.load(open(sys.argv[2]))
def first_diff(x, y, p=""):
    if type(x) != type(y): return f"{p}: tür {type(x).__name__} ↔ {type(y).__name__}"
    if isinstance(x, dict):
        for k in sorted(set(x) | set(y)):
            if k not in x: return f"{p}.{k}: yalnız yenide = {json.dumps(y[k], ensure_ascii=False)[:200]}"
            if k not in y: return f"{p}.{k}: yalnız eskide = {json.dumps(x[k], ensure_ascii=False)[:200]}"
            d = first_diff(x[k], y[k], f"{p}.{k}")
            if d: return d
        return None
    if isinstance(x, list):
        if len(x) != len(y): return f"{p}: uzunluk {len(x)} ↔ {len(y)}"
        for i, (u, v) in enumerate(zip(x, y)):
            d = first_diff(u, v, f"{p}[{i}]")
            if d: return d
        return None
    return None if x == y else f"{p}: {json.dumps(x, ensure_ascii=False)[:160]} ↔ {json.dumps(y, ensure_ascii=False)[:160]}"
keys = ["integrity", "ledger", "yevmiye", "hesapMizani", "altHesap", "defterMut", "adaylar"]
ok = True
for k in keys:
    d = first_diff(a[k].get("body"), b[k].get("body"), k) if a[k]["status"] == b[k]["status"] else f"{k}: durum {a[k]['status']} ↔ {b[k]['status']}"
    print(f"  {k:12s} {'AYNI' if not d else 'FARK ' + d}")
    ok = ok and not d
same_book = a["book"] == b["book"]
print(f"  {'book':12s} {'AYNI' if same_book else 'FARK'} ({len(a['book'])} ↔ {len(b['book'])} madde)")
print("SONUÇ:", "BİREBİR" if ok and same_book else "FARKLI")
