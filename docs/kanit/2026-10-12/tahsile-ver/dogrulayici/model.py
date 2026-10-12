# Bağımsız beklenen (temiz oda): YALNIZ docs/BANKA-MODULU-PLAN.md §3.14 / §3.7 #9, #21 / §3.11 madde 5 metninden ve genel muhasebe kuralından
# (alınan çek cari tahsilatı: B 101 / A 120). Programın kodu bu dosyada kullanılmaz; tarih takvimi elle yazılmıştır.
#   alış (alınan çek/senet, cariden)   : B 101.01 / A 120(cari)
#   Bankaya Tahsile Ver                : B 101.02 / A 101.01   (verilme günü; 101 toplamı değişmez)
#   Tahsil Edildi (tahsildeyken)       : B 102.x  / A 101.02   (x = tahsil kaydının hesabı)
#   Bankadan Geri Al                   : B 101.01 / A 101.02
#   Karşılıksız (tahsildeyken)         : B 120(cari) / A 101.02
#   Son İşlemi Geri Al (tahsil/karşılıksız): o madde kalkar, kayıt yeniden "Bankada Tahsilde"
# Kasa (100) hiçbir adımda değişmez. Nakit akışı/Vade Takip: tahsildeki evrak vade + hesabın valörü (iş günü kuralı: hafta sonu ve resmî tatil →
# sonraki iş günü; 28.10 yarım gün iş günüdür, 29.10 Cumhuriyet Bayramı tatil). Portföydeki (tahsile verilmemiş) evrak kendi vadesinde.
import json, sys, datetime as dt

TATIL = {"2026-10-29", "2027-01-01"}

def is_gunu(iso):
    d = dt.date.fromisoformat(iso)
    while d.weekday() >= 5 or d.isoformat() in TATIL:
        d += dt.timedelta(days=1)
    return d.isoformat()

def kurus(x):
    return int(round(x * 100))

def calis(spec):
    hesaplar = spec["hesaplar"]
    madde = []  # (sira, tarih, [(hesap, alt, borc, alacak, cari)])
    cek = {}
    for ad, h in hesaplar.items():
        madde.append({"id": f"acilis:{ad}", "tarih": h["acilis"], "satir": [("102", h["sub"], kurus(h["tutar"]), 0, None), ("500", "", 0, kurus(h["tutar"]), None)]})
    adimlar = []
    for i, o in enumerate(spec["olaylar"]):
        t = o["t"]
        if t == "al":
            c = {"id": o["id"], "tutar": kurus(o["tutar"]), "cari": o["cari"], "vade": o["vade"], "tarih": o["tarih"], "durum": "portfoy", "banka": None, "verilme": None, "gecmis": [], "tur": o["tur"]}
            cek[o["id"]] = c
            madde.append({"id": f"al:{o['id']}", "tarih": o["tarih"], "satir": [("101", "101.01", c["tutar"], 0, None), ("120", "", 0, c["tutar"], c["cari"])]})
        elif t == "ver":
            c = cek[o["id"]]
            assert c["durum"] == "portfoy" and c["banka"] is None
            c["banka"] = o["hesap"]; c["verilme"] = o["tarih"]
            madde.append({"id": f"ver:{o['id']}:{i}", "tarih": o["tarih"], "satir": [("101", "101.02", c["tutar"], 0, None), ("101", "101.01", 0, c["tutar"], None)]})
        elif t == "tahsil":
            c = cek[o["id"]]
            assert c["banka"]
            mid = f"tahsil:{o['id']}:{i}"
            madde.append({"id": mid, "tarih": o["tarih"], "satir": [("102", hesaplar[c["banka"]]["sub"], c["tutar"], 0, None), ("101", "101.02", 0, c["tutar"], None)]})
            c["gecmis"].append(("tahsil", mid, c["banka"], c["verilme"]))
            c["durum"] = "tahsil"; c["banka"] = None
        elif t == "geri":
            c = cek[o["id"]]
            madde.append({"id": f"geri:{o['id']}:{i}", "tarih": o["tarih"], "satir": [("101", "101.01", c["tutar"], 0, None), ("101", "101.02", 0, c["tutar"], None)]})
            c["banka"] = None; c["verilme"] = None
        elif t == "karsiliksiz":
            c = cek[o["id"]]
            mid = f"karsiliksiz:{o['id']}:{i}"
            alt = "101.02" if c["banka"] else "101.01"
            madde.append({"id": mid, "tarih": o["tarih"], "satir": [("120", "", c["tutar"], 0, c["cari"]), ("101", alt, 0, c["tutar"], None)]})
            c["gecmis"].append(("karsiliksiz", mid, c["banka"], c["verilme"]))
            c["durum"] = "karsiliksiz"; c["banka"] = None
        elif t == "son-islemi-geri-al":
            c = cek[o["id"]]
            tur, mid, banka, verilme = c["gecmis"].pop()
            madde[:] = [m for m in madde if m["id"] != mid]
            c["durum"] = "portfoy"; c["banka"] = banka; c["verilme"] = verilme
        else:
            raise SystemExit(f"bilinmeyen olay {t}")
        adimlar.append({"sira": i, "olay": o, "anlik": anlik(madde, None, spec)})
    sonuc = {"adimlar": adimlar, "kesitler": {}, "araliklar": [], "son": {}}
    for d in spec["kesitler"]:
        sonuc["kesitler"][d] = anlik(madde, d, spec)
    for a, b in spec["araliklar"]:
        sonuc["araliklar"].append({"from": a, "to": b, "alt": aralik(madde, a, b)})
    # Nakit akışı ve Vade Takip (evrak kalemleri): açık evrak; tahsildeyse vade + iş günü (vade geçmişse veriliş gününden), değilse vade.
    akis = []
    for c in cek.values():
        if c["durum"] != "portfoy":
            continue
        if c["banka"]:
            taban = max(c["vade"], c["verilme"])
            akis.append({"id": c["id"], "tarih": is_gunu(taban), "tutar": c["tutar"], "banka": c["banka"]})
        else:
            akis.append({"id": c["id"], "tarih": c["vade"], "tutar": c["tutar"], "banka": None})
    sonuc["son"] = {"akis": sorted(akis, key=lambda x: (x["tarih"], x["id"])), "durumlar": {k: {"durum": v["durum"], "banka": v["banka"], "verilme": v["verilme"]} for k, v in cek.items()},
                    "tahsilde": {"adet": sum(1 for c in cek.values() if c["durum"] == "portfoy" and c["banka"]), "tutar": sum(c["tutar"] for c in cek.values() if c["durum"] == "portfoy" and c["banka"])},
                    "portfoy_acik": {"adet": sum(1 for c in cek.values() if c["durum"] == "portfoy"), "tutar": sum(c["tutar"] for c in cek.values() if c["durum"] == "portfoy")},
                    "banka_giris": banka_giris(madde, spec)}
    return sonuc

def anlik(madde, kadar, spec):
    alt, ana, cari = {}, {}, {}
    for m in madde:
        if kadar and m["tarih"] > kadar:
            continue
        for hesap, a, b, c, p in m["satir"]:
            ana[hesap] = ana.get(hesap, 0) + b - c
            if a:
                alt[a] = alt.get(a, 0) + b - c
            if p:
                cari[p] = cari.get(p, 0) + b - c
    return {"alt": {k: alt.get(k, 0) for k in ["101.01", "101.02", "102.01", "102.02"]}, "ana": {k: ana.get(k, 0) for k in ["100", "101", "102", "120"]}, "cari": {k: cari.get(k, 0) for k in spec["cariler"]}}

def aralik(madde, a, b):
    out = {}
    for k in ["101.01", "101.02", "102.01", "102.02"]:
        out[k] = {"devir": 0, "borc": 0, "alacak": 0}
    for m in madde:
        for hesap, alt, bo, al, p in m["satir"]:
            if alt not in out:
                continue
            if m["tarih"] < a:
                out[alt]["devir"] += bo - al
            elif m["tarih"] <= b:
                out[alt]["borc"] += bo
                out[alt]["alacak"] += al
    for k in out:
        out[k]["bakiye"] = out[k]["devir"] + out[k]["borc"] - out[k]["alacak"]
    return out

def banka_giris(madde, spec):
    # Banka Hareket Raporu: hesaba giren dış hareketler (açılış hariç), tarih sırasıyla.
    subs = {h["sub"]: ad for ad, h in spec["hesaplar"].items()}
    out = {ad: [] for ad in spec["hesaplar"]}
    for m in sorted(madde, key=lambda m: m["tarih"]):
        if m["id"].startswith("acilis:"):
            continue
        for hesap, alt, bo, al, p in m["satir"]:
            if hesap == "102":
                out[subs[alt]].append({"tarih": m["tarih"], "giris": bo, "cikis": al})
    return out

if __name__ == "__main__":
    spec = json.load(open(sys.argv[1], encoding="utf-8"))
    json.dump(calis(spec), sys.stdout, ensure_ascii=False, indent=1)
