"""WK 20: eski senaryoların TAM sonucu (girdi + elle + model + başlık / açıklama / kaynak) eski ↔ yeni senaryolar.json bayt bayt.
Kullanım: python3 -I eski_tam_fark.py <eski senaryolar.json> <yeni senaryolar.json>
Beklenen (ÖNCEDEN yazıldı): eski 389 senaryodan YALNIZ SW3-03 ve S61-02 değişir (R3T — Y20-14 / Y20-16; elle + kaynak + tam sonuç onceki_uyari), sıra korunur;
üst alanlardan yalnız 'kararlar'a S70, S71, R3T eklenir. TAP çıktı."""
import json
import sys

eski = json.load(open(sys.argv[1], encoding="utf-8"))
yeni = json.load(open(sys.argv[2], encoding="utf-8"))
DEGISEN = {"SW3-03", "S61-02"}


def d(o):
    return json.dumps(o, sort_keys=True, ensure_ascii=False)


def fark(a, b, yol=""):
    if isinstance(a, dict) and isinstance(b, dict):
        out = []
        for k in sorted(set(a) | set(b)):
            if k not in a:
                out.append(f"{yol}.{k}: (yok) → {d(b[k])[:160]}")
            elif k not in b:
                out.append(f"{yol}.{k}: {d(a[k])[:160]} → (yok)")
            else:
                out += fark(a[k], b[k], f"{yol}.{k}")
        return out
    if isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        return [x for i, (p, q) in enumerate(zip(a, b)) for x in fark(p, q, f"{yol}[{i}]")]
    return [] if d(a) == d(b) else [f"{yol}: {d(a)[:160]} → {d(b)[:160]}"]


ok = bad = 0
n = 0
es = eski["senaryolar"]
ys = {s["ad"]: s for s in yeni["senaryolar"]}
for i, s in enumerate(es):
    n += 1
    y = ys.get(s["ad"])
    onek = next((k for k in DEGISEN if s["ad"].startswith(k + "-")), None)
    if y is None:
        bad += 1
        print(f"not ok {n} - {s['ad']}: yeni dosyada yok")
        continue
    ayni = d(s) == d(y)
    if onek is None and ayni:
        ok += 1
        print(f"ok {n} - {s['ad']}: bayt bayt aynı")
    elif onek is not None and not ayni:
        ok += 1
        print(f"ok {n} - {s['ad']}: BEKLENEN DEĞİŞİKLİK (G3 — R3T)")
        for x in fark(s, y):
            print(f"  # {x}")
    else:
        bad += 1
        print(f"not ok {n} - {s['ad']}: {'beklenmeyen değişiklik' if not ayni else 'beklenen değişiklik yok'}")
        for x in fark(s, y)[:20]:
            print(f"  # {x}")
n += 1
sira = [s["ad"] for s in yeni["senaryolar"]][:len(es)] == [s["ad"] for s in es]
print(("ok" if sira else "not ok") + f" {n} - eski {len(es)} senaryonun sırası korunuyor (yeni dosyanın ilk {len(es)} senaryosu)")
ok += sira; bad += not sira
n += 1
ust = [k for k in sorted(set(eski) | set(yeni)) if k != "senaryolar" and d(eski.get(k)) != d(yeni.get(k))]
kar_ok = ust == ["kararlar"] and {k: v for k, v in yeni["kararlar"].items() if k not in ("S70", "S71", "R3T")} == eski["kararlar"] \
    and set(yeni["kararlar"]) - set(eski["kararlar"]) == {"S70", "S71", "R3T"}
print(("ok" if kar_ok else "not ok") + f" {n} - üst alanlardan yalnız kararlar değişti, yalnız S70 / S71 / R3T eklendi (değişen üst alanlar: {ust})")
ok += kar_ok; bad += not kar_ok
print(f"1..{ok + bad}")
for ad, k in (("tests", ok + bad), ("pass", ok), ("fail", bad), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
    print(f"# {ad} {k}")
sys.exit(0 if bad == 0 else 1)
