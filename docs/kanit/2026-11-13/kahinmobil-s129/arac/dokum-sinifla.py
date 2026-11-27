# dokum.json'daki her değişen kart beklentisini karar sınıfına ayırır:
#  S129-bagsiz: eski skaler (kartın kendi hesabı) → yeni skaler; Ödenen / taksit Ödenen ARTTI, Kalan AZALDI (bağsız tahsilatın kuyruk payı)
#  SM-1: yeni ya da eski değer liste (avanslı kart — K8-AVANS × S129 iki okuma)
#  ACIKLANAMAYAN: öbürü
# Ayrıca: adımı değişen senaryolarda yalnız 'aciklama' mı değişti?
import json, sys, collections
d = json.load(open(sys.argv[1], encoding="utf-8"))
say = collections.Counter()
ornek = collections.defaultdict(list)
for x in d:
    if "anahtar" not in x:
        continue
    e, y, s = x["eski"], x["yeni"], x["sinif"]
    if isinstance(y, list) or isinstance(e, list):
        c = "SM-1"
        if isinstance(y, list) and not isinstance(e, list) and s == "kart:odenen" and e not in y:
            c = "ACIKLANAMAYAN"
        if s == "kart:odenen" and isinstance(y, list) and isinstance(e, int) and e in y:
            c = "SM-1 (eski değer listede)"
        if s == "kart:kalan" and isinstance(y, list) and isinstance(e, list):
            c = "SM-1+S129 (kalan listesi)"
    elif isinstance(e, int) and isinstance(y, int):
        if (s in ("kart:odenen", "kart:taksit<i>:odenen") and y > e) or (s == "kart:kalan" and y < e):
            c = "S129-bagsiz"
        else:
            c = "ACIKLANAMAYAN"
    else:
        c = "ACIKLANAMAYAN"
    say[(x["senaryo"][:3], s, c)] += 1
    if len(ornek[c]) < 6:
        ornek[c].append(x)
for k in sorted(say):
    print(k, say[k])
for c, l in ornek.items():
    print("==", c)
    for x in l:
        print("  ", x["senaryo"], x["anahtar"], x["eski"], "->", x["yeni"])
