# Bağımsız beklenen (temiz oda, tur 2): YALNIZ docs/BANKA-MODULU-PLAN.md §3.14, §3.7 #9/#21, §3.11 madde 5 metninden ve genel muhasebe
# kuralından. Programın kodu burada kullanılmaz. Takvim elle (TR 2026: 29.10 tatil, 28.10 yarım gün = iş günü, Cmt/Paz tatil).
#   satış faturası (cari)          : B 120(cari) net+KDV / A 600 net / A 391 KDV
#   alınan evrak (cariden)         : B 101.01 / A 120(cari)            (fatura ödemesi ve taksite sayılan evrak da cariden alınmıştır)
#   alınan evrak (carisiz)         : B 101.01 / A 602                  (2.0.15'ten beri "cariye işlenmemiş evrak" kuralı; özelliğin dışı)
#   taksit kartı (cari)            : B 120(cari) / A 602
#   Bankaya Tahsile Ver            : B 101.02 / A 101.01
#   Bankadan Geri Al               : B 101.01 / A 101.02
#   Tahsil (bankada tahsildeyken)  : B 102.x(kaydın hesabı) / A 101.02
#   Tahsil (portföyden, nakit)     : B 100 / A 101.01
#   Karşılıksız (tahsildeyken)     : B 120(cari) / A 101.02 ; carisiz: B 770 / A 101.02
#   Son işlemi Geri Al             : o madde kalkar; kayıt yeniden "Bankada Tahsilde"
#   hesap açılışı                  : B 102.x / A 500
# Nakit akışı / Vade Takip: tahsildeki evrak iş günü(max(vade, veriliş)); portföydeki evrak vade.
import json, sys, datetime as dt
from collections import defaultdict

TATIL = {"2026-10-29", "2027-01-01", "2026-01-01", "2026-04-23", "2026-05-01", "2026-05-19", "2026-07-15", "2026-08-30"}


def is_gunu(iso):
    d = dt.date.fromisoformat(iso)
    while d.weekday() >= 5 or d.isoformat() in TATIL:
        d += dt.timedelta(days=1)
    return d.isoformat()


def k(x):
    return int(round(float(x) * 100))


def calis(spec):
    H = spec["hesaplar"]
    madde = []  # {id, tarih, satir: [(hesap, borc, alacak, cari)]}
    cek = {}
    for ad, h in H.items():
        madde.append({"id": f"acilis:{ad}", "tarih": h["acilis"], "satir": [(h["sub"], k(h["tutar"]), 0, None), ("500", 0, k(h["tutar"]), None)]})
    for i, o in enumerate(spec["olaylar"]):
        t = o["t"]
        if t == "fatura":
            net = k(o["net"]); kdv = k(o["net"] * o["kdv"] / 100)
            madde.append({"id": f"fatura:{o['id']}", "tarih": o["tarih"], "satir": [("120", net + kdv, 0, o["cari"]), ("600", 0, net, None), ("391", 0, kdv, None)]})
            c = o["cek"]
            cek[o["id"]] = {"id": o["id"], "tutar": k(c["tutar"]), "cari": o["cari"], "vade": c["vade"], "durum": "portfoy", "banka": None, "verilme": None, "gecmis": []}
            madde.append({"id": f"al:{o['id']}", "tarih": o["tarih"], "satir": [("101.01", k(c["tutar"]), 0, None), ("120", 0, k(c["tutar"]), o["cari"])]})
        elif t == "taksit-karti":
            madde.append({"id": f"kart:{o['id']}", "tarih": o["tarih"], "satir": [("120", k(o["tutar"]), 0, o["cari"]), ("602", 0, k(o["tutar"]), None)]})
        elif t == "al":
            cek[o["id"]] = {"id": o["id"], "tutar": k(o["tutar"]), "cari": o.get("cari"), "vade": o["vade"], "durum": "portfoy", "banka": None, "verilme": None, "gecmis": []}
            karsi = ("120", 0, k(o["tutar"]), o["cari"]) if o.get("cari") else ("602", 0, k(o["tutar"]), None)
            madde.append({"id": f"al:{o['id']}", "tarih": o["tarih"], "satir": [("101.01", k(o["tutar"]), 0, None), karsi]})
        elif t == "ver":
            c = cek[o["id"]]
            assert c["durum"] == "portfoy" and not c["banka"]
            c["banka"] = o["hesap"]; c["verilme"] = o["tarih"]
            madde.append({"id": f"ver:{o['id']}:{i}", "tarih": o["tarih"], "satir": [("101.02", c["tutar"], 0, None), ("101.01", 0, c["tutar"], None)]})
        elif t == "geri":
            c = cek[o["id"]]
            assert c["banka"]
            madde.append({"id": f"geri:{o['id']}:{i}", "tarih": o["tarih"], "satir": [("101.01", c["tutar"], 0, None), ("101.02", 0, c["tutar"], None)]})
            c["banka"] = None; c["verilme"] = None
        elif t == "tahsil":
            c = cek[o["id"]]
            mid = f"tahsil:{o['id']}:{i}"
            if c["banka"]:
                assert o.get("yol", "bank") == "bank"
                satir = [(H[c["banka"]]["sub"], c["tutar"], 0, None), ("101.02", 0, c["tutar"], None)]
            elif o.get("yol") == "cash":
                satir = [("100", c["tutar"], 0, None), ("101.01", 0, c["tutar"], None)]
            else:
                satir = [(H[o["hesap"]]["sub"], c["tutar"], 0, None), ("101.01", 0, c["tutar"], None)]
            madde.append({"id": mid, "tarih": o["tarih"], "satir": satir})
            c["gecmis"].append((mid, c["banka"], c["verilme"]))
            c["durum"] = "tahsil"; c["banka"] = None; c["verilme"] = None
        elif t == "karsiliksiz":
            c = cek[o["id"]]
            mid = f"karsiliksiz:{o['id']}:{i}"
            alt = "101.02" if c["banka"] else "101.01"
            borc = ("120", c["tutar"], 0, c["cari"]) if c["cari"] else ("770", c["tutar"], 0, None)
            madde.append({"id": mid, "tarih": o["tarih"], "satir": [borc, (alt, 0, c["tutar"], None)]})
            c["gecmis"].append((mid, c["banka"], c["verilme"]))
            c["durum"] = "karsiliksiz"; c["banka"] = None; c["verilme"] = None
        elif t == "son-islemi-geri-al":
            c = cek[o["id"]]
            mid, banka, verilme = c["gecmis"].pop()
            madde[:] = [m for m in madde if m["id"] != mid]
            c["durum"] = "portfoy"; c["banka"] = banka; c["verilme"] = verilme
        else:
            raise SystemExit(f"bilinmeyen olay {t}")
    return madde, cek


def bakiye(madde, to=None, frm=None):
    out = defaultdict(int)
    cari = defaultdict(int)
    for m in madde:
        if to and m["tarih"] > to:
            continue
        if frm and m["tarih"] < frm:
            continue
        for hesap, b, a, p in m["satir"]:
            out[hesap] += b - a
            if hesap == "120" and p:
                cari[p] += b - a
    out["101"] = out.get("101.01", 0) + out.get("101.02", 0)
    out["102"] = sum(v for h, v in out.items() if h.startswith("102."))
    return dict(out), dict(cari)


def aralik(madde, a, b):
    alt = {}
    for s in ["101.01", "101.02", "102.01", "102.02", "100"]:
        devir = sum(bb - aa for m in madde if m["tarih"] < a for h, bb, aa, _ in m["satir"] if h == s)
        borc = sum(bb for m in madde if a <= m["tarih"] <= b for h, bb, aa, _ in m["satir"] if h == s)
        alacak = sum(aa for m in madde if a <= m["tarih"] <= b for h, bb, aa, _ in m["satir"] if h == s)
        alt[s] = {"devir": devir, "borc": borc, "alacak": alacak, "bakiye": devir + borc - alacak}
    return alt


def gun(madde, d):
    return sorted([[h, b, a] for m in madde if m["tarih"] == d for h, b, a, _ in m["satir"]])


def main():
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    madde, cek = calis(spec)
    son, cari = bakiye(madde)
    akis = []
    for c in cek.values():
        if c["durum"] != "portfoy":
            continue
        if c["banka"]:
            akis.append({"id": c["id"], "tarih": is_gunu(max(c["vade"], c["verilme"])), "tutar": c["tutar"], "banka": c["banka"], "tahsilde": True})
        else:
            akis.append({"id": c["id"], "tarih": c["vade"], "tutar": c["tutar"], "banka": None, "tahsilde": False})
    out = {
        "son": {"hesap": son, "cari": cari},
        "kesitler": {d: bakiye(madde, to=d)[0] for d in spec["kesitler"]},
        "araliklar": [{"from": a, "to": b, "alt": aralik(madde, a, b)} for a, b in spec["araliklar"]],
        "gunler": {d: gun(madde, d) for d in spec["gunler"]},
        "akis": sorted(akis, key=lambda x: (x["tarih"], x["id"])),
        "tahsildeki": sorted([{"id": c["id"], "tutar": c["tutar"], "banka": c["banka"], "verilme": c["verilme"]} for c in cek.values() if c["durum"] == "portfoy" and c["banka"]], key=lambda x: x["id"]),
        "portfoy": sorted([{"id": c["id"], "tutar": c["tutar"]} for c in cek.values() if c["durum"] == "portfoy" and not c["banka"]], key=lambda x: x["id"]),
    }
    json.dump(out, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
