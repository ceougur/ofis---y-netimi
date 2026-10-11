# Hakem: KDV dahil iskontolu kalemlerde iskontolu KDV dahil tutar tam kuruş çıkıyorsa (yuvarlama gerekmiyorsa) doğru toplam tartışmasızdır.
# Bu kalemlerde dil §6.3 satır 2 (A/B) ve brüt-koruyan kural (program) bu kesin değeri veriyor mu?
import json, glob, os, sys
C = sys.argv[1]
def rh(a, b):
    q, r = divmod(a, b); return q + (1 if 2 * r >= b else 0)
def kurus(t):
    tam, _, on = t.strip().partition(","); return int(tam) * 100 + (int(on) * (10 if len(on) == 1 else 1) if on else 0)
bp = kurus
n = kesin = dil_yanlis = hakem_yanlis = 0; ornek = []
for f in sorted(glob.glob(os.path.join(C, "senaryolar", "rastgele-*-500.json"))):
    for st in json.load(open(f))["adimlar"]:
        if st.get("islem") != "fatura": continue
        for k in st["kalemler"]:
            if not (k["kdvDahil"] and k.get("iskontoOrani")): continue
            n += 1
            b = k["miktar"] * kurus(k["birimFiyat"]); r = k["kdvOrani"]; p = bp(k["iskontoOrani"])
            if (b * (10000 - p)) % 10000: continue
            kesin += 1; G = b * (10000 - p) // 10000
            H = rh(b * 100, 100 + r); M = H - rh(H * p, 10000); T_dil = M + rh(M * r, 100)
            T_h = b - rh(b * p, 10000)
            if T_dil != G:
                dil_yanlis += 1
                if len(ornek) < 6: ornek.append((os.path.basename(f), st["ad"], k["birimFiyat"], k["iskontoOrani"], r, "kesin", G, "dil", T_dil, "program", T_h))
            if T_h != G: hakem_yanlis += 1
print(json.dumps({"dahilIskontoluKalem": n, "kesinTutarliKalem": kesin, "dilKuraliKesindenSapan": dil_yanlis, "programKuraliKesindenSapan": hakem_yanlis}))
for o in ornek: print(o)
