# WK 19: eski senaryoların (taban eaa29f94, değişiklikten ÖNCE alınmış senaryolar.json kopyası) TAM sonuç farkı — senaryo senaryo, yaprak yaprak. TAP + özet.
# Kullanım: python3 -I fark.py <eski senaryolar.json> <yeni senaryolar.json> [beklenen değişen adlar virgülle]
import json, sys

eski = json.load(open(sys.argv[1], encoding="utf-8"))
yeni = json.load(open(sys.argv[2], encoding="utf-8"))
beklenen_degisen = set(x for x in (sys.argv[3].split(",") if len(sys.argv) > 3 else []) if x)


def m(o):
    return json.dumps(o, sort_keys=True, ensure_ascii=False)


def yapraklar(a, b, yol=""):
    if isinstance(a, dict) and isinstance(b, dict):
        out = []
        for k in sorted(set(a) | set(b)):
            out += yapraklar(a.get(k, "<YOK>"), b.get(k, "<YOK>"), f"{yol}.{k}" if yol else k)
        return out
    if isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        out = []
        for i, (x, y) in enumerate(zip(a, b)):
            out += yapraklar(x, y, f"{yol}[{i}]")
        return out
    return [] if m(a) == m(b) else [(yol, a, b)]


ys = {s["ad"]: s for s in yeni["senaryolar"]}
sira_eski = [s["ad"] for s in eski["senaryolar"]]
sira_yeni = [s["ad"] for s in yeni["senaryolar"]][:len(sira_eski)]
satir = []; gecen = kalan = 0; degisen = []
for i, s in enumerate(eski["senaryolar"], 1):
    y = ys.get(s["ad"])
    if y is None:
        satir.append(f"not ok {i} - {s['ad']}: yeni dosyada YOK"); kalan += 1; continue
    if m(s) == m(y):
        satir.append(f"ok {i} - {s['ad']}: bayt bayt aynı (girdi + elle + tam sonuç + başlık / açıklama / kaynak)"); gecen += 1; continue
    degisen.append(s["ad"])
    f = yapraklar(s, y)
    durum = "ok" if s["ad"] in beklenen_degisen else "not ok"
    gecen += durum == "ok"; kalan += durum != "ok"
    satir.append(f"{durum} {i} - {s['ad']}: DEĞİŞTİ ({len(f)} yaprak){' — beklenen (G3)' if durum == 'ok' else ' — BEKLENMEYEN'}")
    for yol, a, b in f:
        satir.append(f"  # {yol}: {m(a)[:220]} → {m(b)[:220]}")
i = len(eski["senaryolar"]) + 1
satir.append(f"{'ok' if sira_eski == sira_yeni else 'not ok'} {i} - eski senaryoların sırası korunuyor"); gecen += sira_eski == sira_yeni; kalan += sira_eski != sira_yeni
i += 1
ust = [k for k in sorted(set(eski) | set(yeni)) if k != "senaryolar" and m(eski.get(k)) != m(yeni.get(k))]
kar_eski, kar_yeni = eski.get("kararlar", {}), yeni.get("kararlar", {})
kar_deg = [k for k in kar_eski if m(kar_eski[k]) != m(kar_yeni.get(k))]
eklenen = [k for k in kar_yeni if k not in kar_eski]
ok_ust = ust in ([], ["kararlar"]) and not kar_deg
satir.append(f"{'ok' if ok_ust else 'not ok'} {i} - üst alanlar: değişen {ust}; kararlar'a eklenen {eklenen}; eski kararlarda değişen {kar_deg}"); gecen += ok_ust; kalan += not ok_ust
print("\n".join(satir))
print(f"# değişen eski senaryolar: {degisen}")
print(f"1..{gecen + kalan}")
for ad, n in (("tests", gecen + kalan), ("pass", gecen), ("fail", kalan), ("cancelled", 0), ("skipped", 0), ("todo", 0)):
    print(f"# {ad} {n}")
sys.exit(0 if kalan == 0 else 1)
