import json, sys
sys.path.insert(0, sys.argv[1])
sys.dont_write_bytecode = True
import kahin
eski = json.load(open(sys.argv[2], encoding="utf-8"))
def gez(a, b, yol, out):
    if isinstance(a, list) and isinstance(b, list) and len(a) == len(b):
        for i, (x, y) in enumerate(zip(a, b)):
            gez(x, y, f"{yol}[{i}]", out)
    elif isinstance(a, dict) and isinstance(b, dict):
        for k in sorted(set(a) | set(b)):
            gez(a.get(k, "<YOK>"), b.get(k, "<YOK>"), f"{yol}.{k}" if yol else k, out)
    elif json.dumps(a, sort_keys=True, ensure_ascii=False) != json.dumps(b, sort_keys=True, ensure_ascii=False):
        out.append((yol, a, b))
degisen = 0
for sen in eski["senaryolar"]:
    g = dict(sen["girdi"]); g["ad"] = sen["ad"]
    yeni = kahin.hesapla(g)
    out = []
    gez(sen["beklenen"], yeni, "", out)
    if out:
        degisen += 1
        print("DEĞİŞTİ", sen["ad"])
        for yol, a, b in out[:12]:
            print("   ", yol, ":", json.dumps(a, ensure_ascii=False)[:120], "→", json.dumps(b, ensure_ascii=False)[:120])
print(f"{degisen} / {len(eski['senaryolar'])} eski senaryonun tam sonucu değişti")
