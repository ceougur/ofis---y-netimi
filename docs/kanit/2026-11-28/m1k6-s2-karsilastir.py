# m1k6: s2-karisik çıktıları — taban (eski) ile yeni kodda rapor SAYILARI birebir mi; not metni farkları sınıflandırılır.
# python3 -I s2-karsilastir.py <yeni.jsonl> <eski.jsonl>
import json, sys

def oku(p):
    out = {}
    for line in open(p, encoding="utf-8"):
        line = line.strip()
        if line.startswith("{"):
            r = json.loads(line)
            out[r["seed"]] = r
    return out

yeni, eski = oku(sys.argv[1]), oku(sys.argv[2])
hata = [s for s, r in {**yeni, **eski}.items() if "error" in r]
ortak = [s for s in yeni if s in eski and "error" not in yeni[s] and "error" not in eski[s]]
sayi = [s for s in ortak if yeni[s]["each"] != eski[s]["each"] or yeni[s]["range"] != eski[s]["range"] or yeni[s]["offs"] != eski[s]["offs"]]
bozuk_y = [s for s in ortak if yeni[s]["broken"]]
bozuk_e = [s for s in ortak if eski[s]["broken"]]
notfark = [s for s in ortak if yeni[s]["notes"] != eski[s]["notes"]]
yon = sum(1 for s in ortak if "azalmayı düşmemiş" in yeni[s]["notes"].get("Zincirle Uyuşmayan Mahsup Fişi", ""))
eski_ters = sum(1 for s in ortak if "daha önceki bir ayda" in eski[s]["notes"].get("Zincirle Uyuşmayan Mahsup Fişi", ""))
yeni_ters = sum(1 for s in ortak if "daha önceki bir ayda" in yeni[s]["notes"].get("Zincirle Uyuşmayan Mahsup Fişi", ""))
uyus = sum(1 for s in ortak if "Zincirle Uyuşmayan Mahsup Fişi" in yeni[s]["notes"])
print(f"tohum yeni {len(yeni)} eski {len(eski)} · ortak {len(ortak)} · hata {len(hata)} {hata[:10]}")
print(f"SAYI FARKI (aylar / aralık / fişler) yeni ≠ eski: {len(sayi)} {sayi[:20]}")
print(f"kural bozulan: yeni {len(bozuk_y)} eski {len(bozuk_e)}")
print(f"uyuşmazlık notu olan {uyus} · yeni 'azalmayı düşmemiş' {yon} · 'daha önceki bir ayda': eski {eski_ters} yeni {yeni_ters} · not metni farkı {len(notfark)}")
# Not farkı yalnız uyuşmazlık notunda olmalı (aralık tam — kısa not çıkmaz; s2 yalnız tam aralığın notlarını yazar).
baska = [s for s in notfark if {k for k in set(yeni[s]["notes"]) | set(eski[s]["notes"]) if yeni[s]["notes"].get(k) != eski[s]["notes"].get(k)} != {"Zincirle Uyuşmayan Mahsup Fişi"}]
print(f"uyuşmazlık notu DIŞINDA not farkı: {len(baska)} {baska[:10]}")
for s in notfark[:3]:
    print(f"  tohum {s}\n    eski {eski[s]['notes'].get('Zincirle Uyuşmayan Mahsup Fişi', '')[:400]}\n    yeni {yeni[s]['notes'].get('Zincirle Uyuşmayan Mahsup Fişi', '')[:400]}")
for s in sayi[:5]:
    print(f"  SAYI FARKI tohum {s}: yeni {yeni[s]['each']} {yeni[s]['range']} · eski {eski[s]['each']} {eski[s]['range']}")
