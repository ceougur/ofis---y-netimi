# Dar kontrol Ç5-B: oku.mjs çıktılarını karşılaştırır ve yeni kodun değişmezlerini denetler.
# Kullanım: python3 -I coz.py <yeni.json> [<eski.json> <v249.json>]
import json, sys

def load(p):
    with open(p) as f:
        return json.load(f)

new = load(sys.argv[1])
old = load(sys.argv[2]) if len(sys.argv) > 2 else None
v249 = load(sys.argv[3]) if len(sys.argv) > 3 else None
r2 = lambda x: round((x or 0) + 0.0, 2)
issues = []
for aid, a in new["accounts"].items():
    bal = r2(a["balance"])
    # D1: Σ net kalemler = bakiye (EK-1 §4 (değişmez 9))
    if abs(r2(a.get("netSum")) - bal) > 0.011:
        issues.append(f"D1 {a['name']}: Σ net kalem {a.get('netSum')} ≠ bakiye {bal}")
    # D2: cari kartı = liste
    if r2(a.get("overdueDebt")) != r2(a.get("listOverdue")):
        issues.append(f"D2 {a['name']}: kart gecikmiş {a.get('overdueDebt')} ≠ liste {a.get('listOverdue')}")
    # D3: kart gecikmiş = Vade Takip gecikmiş tahsil (cari kalemleri; çek / senet hariç)
    if abs(r2(a.get("overdueDebt")) - r2(a.get("vadeLateIn"))) > 0.011:
        issues.append(f"D3 {a['name']}: kart gecikmiş {a.get('overdueDebt')} ≠ Vade Takip gecikmiş {a.get('vadeLateIn')} · gecikmiş kalemleri {a.get('overdueKinds')} · vade {[x for x in a.get('vadeRows', []) if x.split('|')[3] < new['today']]}")
    # D4: önbellek = baştan
    if a.get("cacheEqualsFresh") is not True:
        issues.append(f"D4 {a['name']}: önbellek ≠ baştan ({a.get('cacheEqualsFresh')})")
    # D5: 0 ≤ gecikmiş ≤ max(0, bakiye)
    if r2(a.get("overdueDebt")) > max(0, bal) + 0.011:
        issues.append(f"D5 {a['name']}: gecikmiş {a.get('overdueDebt')} > max(0, bakiye {bal})")
    # D6: yalnız satış tarafı (alış / iade yok) carisinde Σ fatura açığı + taksitsiz kart kalanı... yalnız bilgi: Σ satış faturası açığı vs bakiye
    sales = [i for i in a["invoices"] if i["kind"] in ("sale", "smm")]
    others = [i for i in a["invoices"] if i["kind"] not in ("sale", "smm")]
    if sales and not others:
        s = r2(sum(i["open"] or 0 for i in sales))
        if s > max(0, bal) + 0.011:
            issues.append(f"D6 {a['name']}: Σ satış faturası açığı {s} > bakiye {bal} (taksitli: {[i['no'] for i in sales if i['planId']]})")
print("\n".join(issues) or "değişmez ihlali yok")
print("Mutabakat Testi (yeni):", new.get("integrity"))
if old:
    print("\n--- eski ↔ yeni farkları (fatura durumu / açık) ---")
    for aid, a in new["accounts"].items():
        o = old["accounts"].get(aid)
        if not o:
            continue
        om = {i["id"]: i for i in o["invoices"]}
        diffs = []
        for i in a["invoices"]:
            j = om.get(i["id"])
            if j and (r2(j["open"]) != r2(i["open"]) or j["state"] != i["state"]):
                diffs.append(f"{i['no']}({i['kind']}{',taksitli' if i['planId'] else ''}) {j['state']} {j['open']} → {i['state']} {i['open']}")
        so = r2(sum(i["open"] or 0 for i in o["invoices"] if i["kind"] in ("sale", "smm")))
        sn = r2(sum(i["open"] or 0 for i in a["invoices"] if i["kind"] in ("sale", "smm")))
        if diffs:
            print(f"{a['name']} (bakiye {a['balance']}; Σ satış açığı eski {so} → yeni {sn}; gecikmiş eski(taksit) {o.get('oldOverdue')} → yeni {a.get('overdueDebt')}):")
            for d in diffs:
                print("   ", d)
if v249:
    print("\n--- v2.4.9 ↔ eski (aynı kural olmalı) ---")
    n = 0
    for aid, a in old["accounts"].items():
        o = v249["accounts"].get(aid)
        om = {i["id"]: i for i in o["invoices"]}
        for i in a["invoices"]:
            j = om.get(i["id"])
            if j and (r2(j["open"]) != r2(i["open"]) or j["state"] != i["state"]):
                n += 1
                print(f"  {a['name']} {i['no']}: v249 {j['state']} {j['open']} · eski {i['state']} {i['open']}")
    print("fark sayısı", n)
