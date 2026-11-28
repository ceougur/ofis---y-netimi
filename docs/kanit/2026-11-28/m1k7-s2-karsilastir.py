# m1k7: dar kontrolün s2-karisik çıktıları — taban (t251-m1k6) ile yeni kodda rapor SAYILARI birebir mi; not metni farkı YALNIZ devreden farkı kolunun onarım cümlesinde mi.
# python3 -I m1k7-s2-karsilastir.py <yeni.jsonl> <eski.jsonl>
import json, re, sys

OLD = "bu ayın ve sonraki mahsupları geri alıp ayları sırayla mahsup edin)"
NEW = re.compile(r"mahsup fişi güncel olmayan ilk aydan \(([^)]+)\) başlayarak mahsupları geri alın, ayları sırayla yeniden mahsup edin\)$")
M = "Zincirle Uyuşmayan Mahsup Fişi"

def oku(p):
    out = {}
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line.startswith("{"):
            r = json.loads(line)
            out[r["seed"]] = r
    return out

yeni, eski = oku(sys.argv[1]), oku(sys.argv[2])
hata = sorted(s for s, r in {**yeni, **eski}.items() if "error" in r)
ortak = [s for s in yeni if s in eski and "error" not in yeni[s] and "error" not in eski[s]]
sayi = [s for s in ortak if yeni[s]["each"] != eski[s]["each"] or yeni[s]["range"] != eski[s]["range"] or yeni[s]["offs"] != eski[s]["offs"]]
bozuk_y = [s for s in ortak if yeni[s]["broken"]]
bozuk_e = [s for s in ortak if eski[s]["broken"]]
notfark = [s for s in ortak if yeni[s]["notes"] != eski[s]["notes"]]
baska, onarim, eksi_degisti = [], [], []
for s in notfark:
    y, e = yeni[s]["notes"], eski[s]["notes"]
    keys = {k for k in set(y) | set(e) if y.get(k) != e.get(k)}
    if keys != {M}:
        baska.append(s)
        continue
    ey, ee = y.get(M, ""), e.get(M, "")
    m = NEW.search(ey)
    # Beklenen tek fark: eski 'bu ayın ve sonraki …' → yeni 'ilk aydan (X) …', cümlenin önceki kısmı (neden cümleleri) birebir; eski cümlede eksi yön ('düşmemiş') yok.
    if m and ee.endswith(OLD) and ey[: m.start()] == ee[: -len(OLD)] and "azalmayı düşmemiş" not in ee:
        onarim.append((s, m.group(1)))
    else:
        eksi_degisti.append(s)
aynen_eski = sum(1 for s in ortak if yeni[s]["notes"].get(M, "").endswith(OLD))
eksi = sum(1 for s in ortak if "azalmayı düşmemiş" in yeni[s]["notes"].get(M, ""))
print(f"tohum yeni {len(yeni)} eski {len(eski)} · ortak {len(ortak)} · hata {len(hata)} {hata[:10]}")
print(f"SAYI FARKI (aylar / aralık / fişler) yeni ≠ eski: {len(sayi)} {sayi[:20]}")
print(f"kural bozulan: yeni {len(bozuk_y)} eski {len(bozuk_e)}")
print(f"not farkı {len(notfark)}: devreden kolunun onarım cümlesi {len(onarim)} · beklenmeyen biçim {len(eksi_degisti)} {eksi_degisti[:10]} · uyuşmazlık notu DIŞINDA {len(baska)} {baska[:10]}")
print(f"yeni kodda: eski cümleyi AYNEN taşıyan uyuşmazlık notu {aynen_eski} · eksi yönlü ('düşmemiş') {eksi}")
print(f"onarım ayları (tohum, ay): {onarim[:30]}")
for s, _ in onarim[:2]:
    print(f"  tohum {s}\n    eski {eski[s]['notes'].get(M, '')[:500]}\n    yeni {yeni[s]['notes'].get(M, '')[:500]}")
for s in sayi[:5]:
    print(f"  SAYI FARKI tohum {s}: yeni {yeni[s]['each']} {yeni[s]['range']} · eski {eski[s]['each']} {eski[s]['range']}")
