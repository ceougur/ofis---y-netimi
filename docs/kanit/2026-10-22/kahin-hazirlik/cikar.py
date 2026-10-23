import re, sys
src = open(sys.argv[1], encoding="utf-8").read().split("## Teslim notları", 1)[1]
# madde paragraflarını birleştir ("- " ile başlar, devam satırları iki boşlukla)
paras, cur = [], None
for line in src.splitlines():
    if line.startswith("- "):
        if cur: paras.append(cur)
        cur = line[2:].strip()
    elif line.startswith("  ") and cur is not None:
        cur += " " + line.strip()
if cur: paras.append(cur)
stops = [" DENENMEDİ", " AÇIK (", " AÇIK:", " GÖZLEM", " BİLİNEN SINIR", " ÇATAL (", " Baş mimar kararı", " DENENMEYEN"]
for p in paras:
    head = p.split(" ", 1)[0] + " " + p.split(" ", 2)[1] if " " in p else p
    for key in ("KÂHİN KURALLARI", "KÂHİN KURALI", "K33 kâhine kodu görmeyen ajan yazacak — KURAL:"):
        i = p.find(key)
        if i >= 0:
            seg = p[i:]
            cut = min([seg.find(s) for s in stops if seg.find(s) > 0] or [len(seg)])
            print("### " + p[:60] + " …\n" + seg[:cut].strip() + "\n")
            break
