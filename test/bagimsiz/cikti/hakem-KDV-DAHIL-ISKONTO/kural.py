# Hakem: düzeltilmiş §6.3 satır 2 (KDV dahil, iskontolu) kuralını 33 tohumun bütün faturalarına uygula; program ve A ile karşılaştır.
# Kural (brüt-koruyan; planın "dahil" kalıbı): İ = rh(brüt·p/10000); G = brüt − İ; M = rh(G·100/(100+r)); K = G − M; T = G.
import json, glob, os, sys
C = sys.argv[1]
def rh(a, b):  # a/b, yarım sıfırdan uzağa (a,b > 0)
    q, r = divmod(a, b)
    return q + (1 if 2 * r >= b else 0)
def kurus(t):
    t = t.strip(); tam, _, on = t.partition(",")
    return int(tam) * 100 + (int(on) * (10 if len(on) == 1 else 1) if on else 0)
def bp(t):
    tam, _, on = t.partition(",")
    return int(tam) * 100 + (int(on) * (10 if len(on) == 1 else 1) if on else 0)
def kalem(k, kural):
    b = k["miktar"] * kurus(k["birimFiyat"]); r = k["kdvOrani"]; p = bp(k.get("iskontoOrani", "0"))
    if k["kdvDahil"] and p == 0:
        M = rh(b * 100, 100 + r); return M, b - M, b
    if k["kdvDahil"]:
        if kural == "hakem":
            I = rh(b * p, 10000); G = b - I; M = rh(G * 100, 100 + r); return M, G - M, G
        H = rh(b * 100, 100 + r); M = H - rh(H * p, 10000); K = rh(M * r, 100); return M, K, M + K
    M = b - rh(b * p, 10000); K = rh(M * r, 100); return M, K, M + K
say = {"fatura": 0, "dahilIskontolu": 0, "hakem=P": 0, "hakem≠P": 0, "dil=P": 0, "dil≠P": 0, "A≠P": 0, "A=dil": 0}
ornek = []
for f in sorted(glob.glob(os.path.join(C, "senaryolar", "rastgele-*-500.json"))):
    ad = os.path.basename(f)[:-5]
    s = json.load(open(f))
    try:
        P = json.load(open(os.path.join(C, "ham", ad + ".program.json")))["faturalar"]
        Ad = json.load(open(os.path.join(C, "ham", ad + ".a.json")))
        A = Ad["faturalar"] if "faturalar" in Ad else Ad["alternatifler"][0]["faturalar"]
    except FileNotFoundError:
        continue
    for st in s["adimlar"]:
        if st.get("islem") != "fatura" or st["ad"] not in P or st["ad"] not in A:
            continue
        say["fatura"] += 1
        dI = any(k["kdvDahil"] and k.get("iskontoOrani") for k in st["kalemler"])
        if dI: say["dahilIskontolu"] += 1
        h = [sum(x) for x in zip(*[kalem(k, "hakem") for k in st["kalemler"]])]
        d = [sum(x) for x in zip(*[kalem(k, "dil") for k in st["kalemler"]])]
        p = [P[st["ad"]]["matrah"], P[st["ad"]]["kdv"], P[st["ad"]]["toplam"]]
        a = [A[st["ad"]]["matrah"], A[st["ad"]]["kdv"], A[st["ad"]]["toplam"]]
        say["hakem=P" if h == p else "hakem≠P"] += 1
        say["dil=P" if d == p else "dil≠P"] += 1
        if a != p: say["A≠P"] += 1
        if a == d: say["A=dil"] += 1
        if h != p and len(ornek) < 10: ornek.append((ad, st["ad"], "hakem", h, "program", p))
print(json.dumps(say, ensure_ascii=False)); print(ornek)
