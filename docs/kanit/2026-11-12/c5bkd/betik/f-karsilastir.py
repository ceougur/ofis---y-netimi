"""Kabul F — dar kontrolün kayıtlı çıktısı (dk-c5bkap-x7/kanit/<ad>-yeni.json; 8d6ea9c9) ↔ benim kodum (c5bkd-kanit/F/<ad>-yeni.json): yaprak yaprak fark.
Farklar alan adına göre sınıflanır: S129'un GÖSTERİLEN alanları (kart totals.remaining / paid, items[].paid → betiklerde own / paid / paidItems) ↔ ÖBÜR (beklenmeyen)."""
import json, re, sys

S = "/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad"
SHOWN = re.compile(r"\.kartlar\[\d+\]\.(own|paid|paidItems(\[\d+\])?)$")
# Kimlik / an taşıyan yapraklar koşudan koşuya değişir (rastgele kimlik, kayıt anı) — sayı değil.
VOLATILE = re.compile(r"kayitAnlari|\.no$|\bid\b|@20\d\d-\d\d-\d\dT")


def leaves(v, path=""):
    if isinstance(v, dict):
        for k in v:
            yield from leaves(v[k], f"{path}.{k}")
    elif isinstance(v, list):
        for i, x in enumerate(v):
            yield from leaves(x, f"{path}[{i}]")
    else:
        yield path, v


total = {"ayni": 0, "s129": 0, "ucucu": 0, "obur": 0}
for ad in sys.argv[1:] or ["s95-98", "karar1", "karar2", "karar3", "bayat"]:
    try:
        a = dict(leaves(json.load(open(f"{S}/dk-c5bkap-x7/kanit/{ad}-yeni.json", encoding="utf-8"))))
        b = dict(leaves(json.load(open(f"{S}/c5bkd-kanit/F/{ad}-yeni.json", encoding="utf-8"))))
    except Exception as e:
        print(f"{ad}: OKUNAMADI ({e})")
        continue
    same = s129 = vol = 0
    other = []
    for k in sorted(set(a) | set(b)):
        if a.get(k, "<yok>") == b.get(k, "<yok>"):
            same += 1
        elif SHOWN.search(k):
            s129 += 1
        elif VOLATILE.search(k) or VOLATILE.search(str(a.get(k, ""))) or VOLATILE.search(str(b.get(k, ""))):
            vol += 1
        else:
            other.append((k, a.get(k, "<yok>"), b.get(k, "<yok>")))
    total["ayni"] += same; total["s129"] += s129; total["ucucu"] += vol; total["obur"] += len(other)
    print(f"{ad}: yaprak {len(set(a) | set(b))} · aynı {same} · S129 gösterim alanı {s129} · uçucu (kimlik / an) {vol} · ÖBÜR FARK {len(other)}")
    for k, x, y in other[:40]:
        print(f"   {k}: dar kontrol {x!r} → benim {y!r}")
print("TOPLAM", total)
