# Keşif: mobil kâhinin kart alanları ↔ cari kâhini 2.5.0'ın (tek kuyruk) aynı alanları, öneri birleşiminde (kod değişmeden)
import importlib.util, json, sys, os
sys.dont_write_bytecode = True
KOK = sys.argv[1]


def yukle(ad, yol):
    sp = importlib.util.spec_from_file_location(ad, yol)
    m = importlib.util.module_from_spec(sp)
    sys.modules[ad] = m
    sp.loader.exec_module(m)
    return m


K = yukle("kahin", os.path.join(KOK, "test/bagimsiz/mobil-yazma/kahin.py"))
kabul = json.load(open(os.path.join(KOK, "test/bagimsiz/mobil-yazma/kabul.json"), encoding="utf-8"))
CARI = K.CARI
yakala = {}
orj = K.cari_sonuclari


def sarmal(adimlar, cariler, bugun):
    r = orj(adimlar, cariler, bugun)
    m = CARI.Model({"dil": CARI.DIL, "ad": "x", "bugun": bugun, "adimlar": []}, 0, "2.5.0")
    red = []
    for a in adimlar:
        m._onbellek = {}
        s = getattr(m, a["islem"])(a)
        if isinstance(s, tuple):
            red.append((a["id"], s[:2]))
    m._onbellek = {}
    kart = {}
    for no, kt in m.kartlar.items():
        n = m.tyk250(kt["cari"])["neden"]
        if n:
            kart[no] = ("NEDEN", sorted(n))
            continue
        pay = m.kart_odenen(no, kt)
        kart[no] = (sum(pay), pay)
    yakala.setdefault("son", []).append({"kart": kart, "red": red, "sus": list(m.sus_kart)})
    return r


K.cari_sonuclari = sarmal
for s in kabul["senaryolar"]:
    sen = s["senaryo"]
    if not any(a["islem"] == "kart_ac" for a in sen["adimlar"]):
        continue
    yakala.clear()
    out = K.Kahin(sen, dict(K.ONERI)).kos()
    if isinstance(out, dict) and "beklenen" in out:
        out = out["beklenen"]
    son = yakala.get("son", [])
    ozet = [("RED/SUS", z["red"], z["sus"]) for z in son if z["red"] or z["sus"]]
    print("==", sen["ad"], "kontrol koşusu:", len(son), "red/sus:", ozet[:3])
    if son:
        print("   2.5.0 kart (son çağrı):", son[-1]["kart"])
    kk = {k: v for k, v in (out.items() if isinstance(out, dict) else []) if ":kart:" in k and (k.endswith(":odenen") or k.endswith(":kalan"))}
    print("   mobil:", dict(list(sorted(kk.items()))[-12:]))
