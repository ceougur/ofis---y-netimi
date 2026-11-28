# S2 yeni / eski karşılaştırması: kural bozulmaları, hata, yeni ≠ eski olan tohumlar ve bunların sınıfı.
# python3 -I s2-karsilastir.py <yeni.jsonl> <eski.jsonl|->
import json, sys

def oku(p):
    if p == "-":
        return {}
    out = {}
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line.startswith("{"):
            r = json.loads(line)
            out[r["seed"]] = r
    return out

yeni, eski = oku(sys.argv[1]), oku(sys.argv[2])
hata = [s for s, r in yeni.items() if "error" in r]
bozuk = [s for s, r in yeni.items() if r.get("broken")]
stale_any = sum(1 for r in yeni.values() if any(o["stale"] for o in r.get("offs", [])))
stale_in = sum(1 for r in yeni.values() if any(o["stale"] and o.get("nowIn") is not None and o["nowIn"] > o["in"] for o in r.get("offs", [])))
geri = sum(1 for r in yeni.values() if any(x.startswith("geri") for x in r.get("log", [])))
uyus = sum(1 for r in yeni.values() if "Zincirle Uyuşmayan Mahsup Fişi" in r.get("notes", {}))
print(f"tohum {len(yeni)} · hata {len(hata)} {hata[:10]} · kural bozulan {len(bozuk)}")
print(f"sınıflar: güncel değil fiş {stale_any}, İ artmış güncel değil {stale_in}, geri al {geri}, zincirle uyuşmayan {uyus}")
for s in bozuk[:15]:
    print(f"  BOZUK tohum {s}: {yeni[s]['broken']} | {'; '.join(yeni[s]['log'])}")
for s in hata[:5]:
    print(f"  HATA tohum {s}: {yeni[s]['error'][:300]}")
if eski:
    eb = [s for s, r in eski.items() if r.get("broken")]
    print(f"eski: tohum {len(eski)} · hata {sum(1 for r in eski.values() if 'error' in r)} · kural bozulan {len(eb)}")
    fark = [s for s in yeni if s in eski and "error" not in yeni[s] and "error" not in eski[s] and (yeni[s]["each"] != eski[s]["each"] or yeni[s]["range"] != eski[s]["range"])]
    notfark = [s for s in yeni if s in eski and "error" not in yeni[s] and "error" not in eski[s] and yeni[s]["notes"] != eski[s]["notes"]]
    beklenen = lambda r: any(o["stale"] and o.get("nowIn") is not None and o["nowIn"] > o["in"] for o in r["offs"])
    sinifsiz = [s for s in fark if not beklenen(yeni[s])]
    print(f"yeni ≠ eski sayı: {len(fark)} (İ artmış 'güncel değil' fişi OLMAYAN: {len(sinifsiz)} {sinifsiz[:20]}) · not metni farkı {len(notfark)}")
    for s in sinifsiz[:8]:
        print(f"  SINIFSIZ FARK tohum {s}: yeni {yeni[s]['each']} eski {eski[s]['each']} | {'; '.join(yeni[s]['log'])}")
    for s in fark[:6]:
        print(f"  fark tohum {s}: yeni aralık {yeni[s]['range']} eski {eski[s]['range']} net {yeni[s]['net']} · eski bozuk {eski[s]['broken']}")
    yalniz_eskide_bozuk = [s for s in eb if s in yeni and not yeni[s].get("broken")]
    print(f"eskide bozuk, yenide sağlam: {len(yalniz_eskide_bozuk)}; yenide bozuk, eskide sağlam: {len([s for s in bozuk if s in eski and not eski[s].get('broken')])}")
    nf = [s for s in notfark if s not in fark]
    for s in nf[:4]:
        print(f"  yalnız not farkı tohum {s}: yeni {json.dumps(yeni[s]['notes'], ensure_ascii=False)[:500]}\n     eski {json.dumps(eski[s]['notes'], ensure_ascii=False)[:500]}")
