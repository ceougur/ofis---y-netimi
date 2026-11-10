# Bağımsız defter kâhini (temiz oda): programın kodunu GÖRMEDEN, yalnız senaryo.json'daki iş olaylarından Tekdüzen Hesap Planı'na göre
# elle yevmiye kurar ve beklenenleri yazar: her "kontrol" noktasında mizan; sonda cari bakiyeler, stok miktarları, aylık KDV (fatura
# kaynaklı hesaplanan/indirilecek), alacak yaşlandırma toplamları.
#
# Kurallar (kaynak: TDHP, KDV Kanunu / KDV GUT, VUK, GİB tevkifat oranları; ürün sahibinin 18.10.2026 kararları MM3–MM5):
#   açılış fişi           : varlık B / 500 A; yükümlülük 500 B / A; STOK AÇILIŞI B 153 / A 500 (miktar × alış fiyatı) — karar MM4
#   satış                 : B 120 ödenecek / A 600 matrah, A 391 (KDV − tevkifat); peşin B 100|102 / A 120
#   satıştan iade         : B 610 matrah, B 391 KDV / A 120
#   alış                  : B 153 (stoklu) | 770 (gider) matrah, B 191 KDV / A 360 (tevkifat + stopaj), A 320 ödenecek; peşin B 320 / A 100|102
#   alıştan iade          : B 320 / A 153|770 matrah, A 191 KDV
#   tahsilat / ödeme      : nakit 100, havale 102, POS B 108 / A 120 ve aynı gün valör B 102 net + B 653 komisyon / A 108; kart ödemesi B 320 / A 309
#   çek / senet           : alınan çek 101, senet 121; verilen çek 103; ciro B 320 / A 101; tahsile ver 101 içi; karşılıksız B 120 / A 101
#   şüpheli               : B 128 / A 120 (cari kartı değişmez); karşılık B 654 / A 129
#   banka                 : masraf (BSMV dahil) B 770 / A 102; faiz geliri B 102 net + B 193 stopaj / A 642; faiz gideri + BSMV B 780 / A 102
#   kasa                  : virman B 102 / A 100; kasa gideri B 770 / A 100
#   taksitli satış        : mevcut borcu taksitlendirir (ikinci kez borç yazılmaz); taksit tahsili B 100 / A 120
#   vergi ödemesi (MM3)   : B 360 tutar (+ B 689 gecikme zammı) / A 102 (banka) | A 100 (kasa)
#   KDV mahsup (MM3)      : ayın 391 ve 191 hareketi sıfırlanır: B 391 H / A 191 İ; fark > 0 → önce devreden 190'dan (A 190), kalanı A 360;
#                           fark ≤ 0 → B 190 (İ − H) devreden. Geri alma: ters kayıt.
#   yaşlandırma (MM5)     : müşteri başına Toplam = cari kartı bakiyesi (borçlu ise) + portföydeki alınan çek/senet; faturasız bakiye de
#                           (devir, karşılıksız çek) "Faturasız" kalem olarak girer → Toplam = kart bakiyesi + portföy evrakı.
#   31b-MM3 (2.4.4, 22.10.2026; mali müşavir turu — 18.10'daki MM3 ile karıştırılmasın) Stopaj ve Tevkifat Özeti: satış ve SMM "Bizden kesilen (193)"
#                           tarafında (müşterinin bizden kestiği stopaj, KDV tevkifatı), alış "Bizim kestiğimiz (360)" tarafında; İADE ASIL BELGENİN TARAFINDA
#                           EKSİ: satıştan iade 193 tarafında −, alıştan iade 360 tarafında −. Kaynak: TDHP (193 Peşin Ödenen Vergiler, 360 Ödenecek Vergi ve
#                           Fonlar), KDV GUT I/C-2.1.3, KDVK 35 (iadede vergi düzeltmesi); [KULLANICI] 22.10 21:27 UTC "MM3 … satıştan iadeyi 'bizim kestiğimiz'
#                           sayıyor → ters yön". Özet satırları (Bizim Ödeyeceğimiz Stopaj / Tevkifat) 360 tarafının toplamı (iade eksiyle).
#   31b-MM8 yevmiye sırası  : aynı günün maddeleri tarih → olay sınıfı (BELGE önce, sonra para/cari hareketleri) → yazım sırası (ders 31; [KULLANICI] 22.10
#                           21:27 UTC "MM8 yevmiye aynı gün sırası"). Belge = fatura / iade; para/cari = tahsilat, ödeme, evrak, banka, kasa. Para/cari sınıfının
#                           kendi içindeki alt sırası kaynakta yok → denetlenmez; senaryonun yevmiyeSiraGunleri günlerinde yalnız "belge önce" denetlenir.
# Yuvarlama: kalem başına kuruş, yarım yukarı. Tutarlar kuruş tamsayısı.
#
# Kullanım: python3 -I kahin.py senaryo.json [--yapilan yapilan.json] [--mutasyon N] > beklenen.json
import json
import sys
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

TEVKIFAT = {"612": (9, 10), "624": (2, 10), "627": (5, 10), "601": (4, 10), "602": (9, 10), "616": (5, 10)}
GIDER_HESABI = {"marketing": "760", "freight": "760", "asset": "255", "commission": "653"}  # öbür gider türleri 770

def kurus(x):
    return int((Decimal(str(x)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))

def oranla(x, pay, payda):  # x kuruş × pay / payda, yarım yukarı
    return int((Decimal(x) * pay / payda).quantize(Decimal("1"), rounding=ROUND_HALF_UP))

def main(argv):
    path = argv[1]
    yapilan = None
    mut = 0
    if "--yapilan" in argv:
        yapilan = set(json.load(open(argv[argv.index("--yapilan") + 1], encoding="utf-8")))
    if "--mutasyon" in argv:
        mut = int(argv[argv.index("--mutasyon") + 1])
    sen = json.load(open(path, encoding="utf-8"))
    olaylar = [o for o in sen["olaylar"] if yapilan is None or o["id"] in yapilan or o["tur"] in ("cari", "urun", "kontrol")]
    by = {o["id"]: o for o in sen["olaylar"]}

    J = []  # (tarih, olay, [(hesap, borç, alacak)])
    def fis(tarih, olay, *satirlar):
        satirlar = [s for s in satirlar if s[1] or s[2]]
        b = sum(s[1] for s in satirlar); a = sum(s[2] for s in satirlar)
        assert b == a, (olay, b, a)
        J.append((tarih, olay, satirlar))
    B = lambda h, x: (h, x, 0)
    A = lambda h, x: (h, 0, x)

    cari = defaultdict(int)          # borç +
    tip = {o["id"]: o["tip"] for o in olaylar if o["tur"] == "cari"}
    stok = defaultdict(lambda: Decimal(0))
    urun = {o["id"]: o for o in olaylar if o["tur"] == "urun"}
    faturalar = {}
    cekler = {}
    kdv_ay = defaultdict(lambda: {"hesaplanan": 0, "indirilecek": 0})
    mahsuplar = {}
    pos_oran = {}
    kontroller = {}
    kontrol_sirasi = []
    stopaj_ozet = defaultdict(lambda: {"satirlar": {}, "bizimStopaj": 0, "bizimTevkifat": 0})  # 31b-MM3
    sinif_gun = defaultdict(list)  # 31b-MM8: gün → [olay sınıfı yazım sırasıyla]
    PARA = {"tahsilat", "odeme", "cek", "ciro", "tahsile_ver", "karsiliksiz", "masraf", "faiz_gelir", "faiz_gider", "virman", "kasa_gider", "taksit_tahsil", "vergi_odeme"}

    def bakiye():
        out = defaultdict(int)
        for _, _, satirlar in J:
            for h, b, a in satirlar:
                out[h] += b - a
        return dict(out)

    def kalem_hesapla(k, kdv_dahil, iade_kaynak=None):
        src = iade_kaynak or k
        miktar = Decimal(str(k["miktar"]))
        fiyat = Decimal(str(src["fiyat"]))
        brut = kurus(miktar * fiyat)
        isk = oranla(brut, Decimal(str(src.get("isk", 0))), 100)
        sonra = brut - isk
        r = src["kdv"]
        if kdv_dahil:
            net = oranla(sonra, 100, 100 + r)
            kdv = sonra - net
            if mut == 1:
                kdv = oranla(sonra, r, 100)
                net = sonra - kdv
        else:
            net = sonra
            kdv = oranla(net, r, 100)
        tev = 0
        if src.get("tevkifat"):
            p, q = TEVKIFAT[src["tevkifat"]]
            tev = oranla(kdv, p, q)
        if src.get("urun"):
            hesap = "153"
        else:
            hesap = GIDER_HESABI.get(src.get("gider", ""), "770")
        return {"net": net, "kdv": kdv, "tev": tev, "hesap": hesap, "urun": src.get("urun"), "miktar": miktar}

    for o in olaylar:
        t = o.get("tarih", "")
        tur = o["tur"]
        oid = o["id"]
        if tur in ("cari",):
            continue
        if tur == "urun":
            if o.get("acilisMiktar") and mut != 7:
                stok[oid] += Decimal(str(o["acilisMiktar"]))
                fis(o["acilisTarih"], oid, B("153", kurus(Decimal(str(o["acilisMiktar"])) * Decimal(str(o["alis"])))), A("500", kurus(Decimal(str(o["acilisMiktar"])) * Decimal(str(o["alis"])))))
            elif o.get("acilisMiktar"):
                stok[oid] += Decimal(str(o["acilisMiktar"]))
            continue
        if tur == "kasa_acilis":
            fis(t, oid, B("100", kurus(o["tutar"])), A("500", kurus(o["tutar"])))
        elif tur == "banka_hesap":
            fis(t, oid, B("102", kurus(o["acilis"])), A("500", kurus(o["acilis"])))
        elif tur in ("kart_hesap",):
            pass
        elif tur == "pos":
            pos_oran[oid] = Decimal(str(o["oran"]))
        elif tur == "cari_acilis":
            x = kurus(o["tutar"])
            if o["yon"] == "borc":
                cari[o["cari"]] += x
                fis(t, oid, B("120" if tip[o["cari"]] == "customer" else "320", x), A("500", x))
            else:
                cari[o["cari"]] -= x
                fis(t, oid, B("500", x), A("320" if tip[o["cari"]] == "supplier" else "120", x))
        elif tur == "fatura":
            ft = o["fatura"]
            asil = faturalar.get(o.get("asil")) if o.get("asil") else None
            kdv_dahil = asil["olay"].get("kdvDahil", False) if asil else o.get("kdvDahil", False)
            if asil:
                kalemler = [kalem_hesapla(k, kdv_dahil, asil["olay"]["kalemler"][k["satir"]]) for k in o["kalemler"]]
            else:
                kalemler = [kalem_hesapla(k, kdv_dahil) for k in o["kalemler"]]
            net = sum(k["net"] for k in kalemler); kdv = sum(k["kdv"] for k in kalemler); tev = sum(k["tev"] for k in kalemler)
            stopaj = oranla(net, Decimal(str(o.get("stopaj", 0))), 100) if o.get("stopaj") else 0
            odenecek = net + kdv - tev - stopaj
            ay = t[:7]
            c = o["cari"]
            satirlar = []
            if ft == "satis":
                satirlar = [B("120", odenecek)] + [A("600", k["net"]) for k in kalemler] + [A("391", kdv - (0 if mut == 4 else tev))]
                if mut == 4:
                    satirlar[0] = B("120", odenecek + tev)
                cari[c] += odenecek
                kdv_ay[ay]["hesaplanan"] += kdv - tev
                for k in kalemler:
                    if k["urun"]: stok[k["urun"]] -= k["miktar"]
            elif ft == "satis_iade":
                satirlar = [B("600" if mut == 2 else "610", k["net"]) for k in kalemler] + [B("391", kdv - tev), A("120", odenecek)]
                cari[c] -= odenecek
                kdv_ay[ay]["hesaplanan"] -= kdv - tev
                for k in kalemler:
                    if k["urun"]: stok[k["urun"]] += k["miktar"]
            elif ft == "alis":
                satirlar = [B(k["hesap"], k["net"]) for k in kalemler] + [B("191", kdv), A("193" if mut == 3 else "360", tev + stopaj), A("320", odenecek)]
                if mut == 3:  # stopaj 193'e (yanlış taraf ve hesap)
                    satirlar = [B(k["hesap"], k["net"]) for k in kalemler] + [B("191", kdv), A("360", tev), A("193", stopaj), A("320", odenecek)]
                cari[c] -= odenecek
                kdv_ay[ay]["indirilecek"] += kdv
                for k in kalemler:
                    if k["urun"]: stok[k["urun"]] += k["miktar"]
            elif ft == "alis_iade":
                satirlar = [B("320", odenecek), B("360", tev + stopaj)] + [A(k["hesap"], k["net"]) for k in kalemler] + [A("191", kdv)]
                cari[c] += odenecek
                kdv_ay[ay]["indirilecek"] -= kdv
                for k in kalemler:
                    if k["urun"]: stok[k["urun"]] -= k["miktar"]
            fis(t, oid, *satirlar)
            sinif_gun[t].append("belge")
            # 31b-MM3: Stopaj ve Tevkifat Özeti satırı (stopaj ya da tevkifat varsa; iade asıl belgenin tarafında eksi)
            if tev or stopaj:
                taraf = "Bizden kesilen (193)" if ft in ("satis", "satis_iade") else "Bizim kestiğimiz (360)"
                if mut == 11 and ft == "satis_iade":
                    taraf = "Bizim kestiğimiz (360)"  # 31b-MM3 öncesi hata: satıştan iade 360 tarafında
                isaret = -1 if ft in ("satis_iade", "alis_iade") and mut != 12 else 1
                ad_ = by[c]["ad"]
                stopaj_ozet[ay]["satirlar"]["%s|%s" % (t, ad_)] = {"taraf": taraf, "matrah": isaret * net, "stopaj": isaret * stopaj, "tevkifat": isaret * tev}
                if taraf.startswith("Bizim"):
                    stopaj_ozet[ay]["bizimStopaj"] += isaret * stopaj
                    stopaj_ozet[ay]["bizimTevkifat"] += isaret * tev
            od = o.get("odeme") or {}
            pesin = []
            for yol, hesap in (("nakit", "100"), ("havale", "102")):
                if od.get(yol):
                    x = kurus(od[yol])
                    if ft in ("satis",):
                        fis(t, oid + ":peşin", B(hesap, x), A("120", x)); cari[c] -= x
                    else:
                        fis(t, oid + ":peşin", B("320", x), A(hesap, x)); cari[c] += x
                    pesin.append((hesap, x))
            faturalar[oid] = {"olay": o, "kalemler": kalemler, "odenecek": odenecek, "ay": ay, "kdv": kdv, "tev": tev, "pesin": pesin, "tur": ft}
        elif tur == "iptal":
            f = faturalar[o["fatura"]]
            for tarih, olay, satirlar in list(J):
                if olay in (o["fatura"], o["fatura"] + ":peşin"):
                    fis(t, oid, *[(h, a, b) for h, b, a in satirlar])
            ft = f["tur"]; c = f["olay"]["cari"]
            if ft == "satis":
                cari[c] -= f["odenecek"]
                for h, x in f["pesin"]: cari[c] += x
                kdv_ay[f["ay"]]["hesaplanan"] -= f["kdv"] - f["tev"]
                for k in f["kalemler"]:
                    if k["urun"]: stok[k["urun"]] += k["miktar"]
            else:
                raise SystemExit("iptal: yalnız satış faturası modellenir")
        elif tur == "tahsilat":
            x = kurus(o["tutar"]); c = o["cari"]
            cari[c] -= x
            if o["yol"] == "nakit": fis(t, oid, B("100", x), A("120", x))
            elif o["yol"] == "havale": fis(t, oid, B("102", x), A("120", x))
            elif o["yol"] == "pos":
                kom = oranla(x, list(pos_oran.values())[0], 100)
                fis(t, oid, B("108", x), A("120", x))
                if mut == 5: fis(t, oid + ":valör", B("102", x), A("108", x))
                else: fis(t, oid + ":valör", B("102", x - kom), B("653", kom), A("108", x))
        elif tur == "odeme":
            x = kurus(o["tutar"]); c = o["cari"]
            cari[c] += x
            hesap = {"nakit": "100", "havale": "102", "kart": "309"}[o["yol"]]
            fis(t, oid, B("320", x), A(hesap, x))
        elif tur == "cek":
            x = kurus(o["tutar"]); c = o["cari"]
            if o["yon"] == "alinan":
                hesap = "121" if o["evrak"] == "senet" else "101"
                fis(t, oid, B(hesap, x), A("120", x)); cari[c] -= x
                cekler[oid] = {"durum": "portfoy", "tutar": x, "cari": c, "hesap": hesap}
            else:
                hesap = "321" if o["evrak"] == "senet" else "103"
                fis(t, oid, B("320", x), A(hesap, x)); cari[c] += x
                cekler[oid] = {"durum": "verildi", "tutar": x, "cari": c, "hesap": hesap}
        elif tur == "ciro":
            ck = cekler[o["cek"]]; x = ck["tutar"]
            fis(t, oid, B("320", x), A(ck["hesap"], x)); cari[o["cari"]] += x; ck["durum"] = "ciro"
        elif tur == "tahsile_ver":
            ck = cekler[o["cek"]]; ck["durum"] = "bankada"
            fis(t, oid, B(ck["hesap"], ck["tutar"]), A(ck["hesap"], ck["tutar"]))
        elif tur == "karsiliksiz":
            ck = cekler[o["cek"]]; x = ck["tutar"]
            if mut != 10:
                fis(t, oid, B("120", x), A(ck["hesap"], x)); cari[ck["cari"]] += x
            ck["durum"] = "karsiliksiz"
        elif tur == "supheli":
            x = kurus(o["tutar"]); fis(t, oid, B("128", x), A("120", x))
        elif tur == "karsilik":
            x = kurus(o["tutar"]); fis(t, oid, B("654", x), A("129", x))
        elif tur == "masraf":
            x = kurus(o["tutar"]); fis(t, oid, B("770", x), A("102", x))
        elif tur == "faiz_gelir":
            x = kurus(o["brut"]); s = oranla(x, Decimal(str(o["stopajOran"])), 100)
            fis(t, oid, B("102", x - s), B("193", s), A("642", x))
        elif tur == "faiz_gider":
            x = kurus(o["tutar"]) + kurus(o.get("vergi", 0)); fis(t, oid, B("780", x), A("102", x))
        elif tur == "virman":
            x = kurus(o["tutar"]); fis(t, oid, B("102", x), A("100", x))
        elif tur == "kasa_gider":
            x = kurus(o["tutar"]); fis(t, oid, B("770", x), A("100", x))
        elif tur == "taksit_tahsil":
            x = kurus(o["tutar"]); c = faturalar[o["fatura"]]["olay"]["cari"]
            cari[c] -= x
            fis(t, oid, B("100" if o["yol"] == "nakit" else "102", x), A("120", x))
        elif tur == "vergi_odeme":
            x = kurus(o["tutar"]); z = kurus(o.get("gecikmeZammi", 0))
            para = "102" if o["yol"] == "banka" else "100"
            if mut == 9: fis(t, oid, B("360", x + z), A(para, x + z))
            else: fis(t, oid, B("360", x), B("689", z), A(para, x + z))
        elif tur == "kdv_mahsup":
            H = kdv_ay[o["ay"]]["hesaplanan"]; I = kdv_ay[o["ay"]]["indirilecek"]
            devreden = bakiye().get("190", 0)
            if H - I > 0:
                kullan = 0 if mut == 6 else min(devreden, H - I)
                fis(t, oid, B("391", H), A("191", I), A("190", kullan), A("360", H - I - kullan))
            else:
                fis(t, oid, B("391", H), B("190", I - H), A("191", I))
            mahsuplar[oid] = True
        elif tur == "kdv_mahsup_geri_al":
            for tarih, olay, satirlar in list(J):
                if olay == o["mahsup"]:
                    fis(t, oid, *[(h, a, b) for h, b, a in satirlar])
        elif tur == "kontrol":
            kontroller[oid] = {h: v for h, v in sorted(bakiye().items()) if v != 0}
            kontrol_sirasi.append(oid)
        else:
            raise SystemExit(f"tanınmayan olay türü: {tur}")
        if tur in PARA:
            sinif_gun[t].append("para")

    bugun = sen["bugun"]
    # Yaşlandırma (MM5): müşteri başına Toplam = borçlu kart bakiyesi + portföydeki alınan evrak.
    yas = {}
    for c, tp in tip.items():
        if tp != "customer": continue
        portfoy = sum(ck["tutar"] for ck in cekler.values() if ck["cari"] == c and ck["durum"] == "portfoy")
        faturasiz_atla = mut == 8 and c in ("M4", "M5")
        toplam = (0 if faturasiz_atla else max(cari[c], 0)) + portfoy
        if toplam: yas[by[c]["ad"]] = toplam
    out = {
        "kontroller": kontroller,
        "kontrolSirasi": kontrol_sirasi,
        "cari": {by[c]["ad"]: v for c, v in cari.items() if c in tip},
        "stok": {urun[u]["kod"]: format(q.normalize(), "f") for u, q in stok.items()},
        "kdv": {ay: v for ay, v in sorted(kdv_ay.items())},
        "yaslandirma": {"cariler": yas, "toplam": sum(yas.values())},
        # 31b-MM3: yalnız senaryonun stopajAylari (ay → satırlar "tarih|cari" + 360 tarafı özetleri)
        "stopajOzet": {ay: stopaj_ozet[ay] for ay in sen.get("stopajAylari", [])},
        # 31b-MM8: gün → "belge-once" (gün iki sınıfı da içeriyorsa; mutasyon 13 sınıfsız yazım sırası)
        "yevmiyeSira": {g: (("belge-once" if mut != 13 else ("belge-once" if sinif_gun[g] == sorted(sinif_gun[g]) else "karisik"))
                            if {"belge", "para"} <= set(sinif_gun[g]) else "tek-sinif") for g in sen.get("yevmiyeSiraGunleri", [])},
        "mutasyon": mut,
    }
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)

if __name__ == "__main__":
    main(sys.argv)
