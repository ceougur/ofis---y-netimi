#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Rastgele UX18 senaryosu üretici (dil "destekofis-cari/1"; ders 17 rastgele sıra). Tohumlu, belirlenimli.

  python3 -I test/bagimsiz/cari/uretici.py --tohum 3 --islem 60 > senaryo.json

Üç müşteri + bir tedarikçi; satış faturaları (bazısı kendi çekiyle), bağsız/bağlı nakit tahsilat, faturaya bağlı/bağsız alınan
çek/senet, karşılıksız, tahsil, ciro, evrak sil / geri yükle, bağ değiştir, fatura iptali; her ~10 adımda kontrol.
Geçerlilik (senaryo kurmaz): fatura tarihleri artan (VUK sıra-tarih), bağlı nakit tahsilat faturanın o anki açığını aşmaz,
evrak işlemi yalnız portföydeki evrakta, iptal edilen faturada bağlı nakit ya da kendi evrakı yok, silinen evrakın geçmişi yok.
Açıklar kısıt için kâhin modeliyle (model.py) hesaplanır; programdan hiçbir şey okunmaz.
"""
import importlib.util
import json
import os
import random
import sys
from datetime import date, timedelta

BURASI = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("kahin_cari_model", os.path.join(BURASI, "model.py"))
M = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(M)


def tl(k):
    return "%d,%02d" % (k // 100, k % 100)


def para(k):
    """kuruş → "1.234,56 ₺" (tablo hücresi)."""
    tam = "{:,}".format(k // 100).replace(",", ".")
    return "%s,%02d ₺" % (tam, k % 100)


def tckn(rt):
    """Geçerli TCKN (GİB/NVİ denetim haneleri): 10. hane = ((1+3+5+7+9) × 7 − (2+4+6+8)) mod 10, 11. hane = ilk 10 hanenin toplamı mod 10."""
    d = [rt.randint(1, 9)] + [rt.randint(0, 9) for _ in range(8)]
    d10 = ((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10
    return "".join(map(str, d + [d10, (sum(d) + d10) % 10]))


def rastgele_tablo(rt, tohum):
    """/2 (23.10.2026, K1–K3 [KULLANICI]): carisiz tablo kayıtları — dönem sekmeleri ("2025 Aidat" / "2026 Aidat"; aynı sekmede tekrar eden ve iki sekmede ortak
    dosya no), Kalan'sız Tutar + Tahsil Edilen (ödenen > tutar dahil), Toplam Borç + Kalan Borç (Kalan boş / 0), tek tutar + "Kalan Gün", Ödeme Sözleri."""
    n = [0]

    def yeni():
        n[0] += 1
        return "T%d/%03d" % (tohum, n[0]), "Tablo Kişi %d-%d" % (tohum, n[0])

    def tutar():
        return rt.choice([rt.randint(1, 99) * 100, rt.randint(100, 900000)]) * 1
    sekmeler = []
    aidat25, aidat26 = [], []
    ortak = [yeni() for _ in range(rt.randint(0, 2))]
    for no, ad in [yeni() for _ in range(rt.randint(1, 3))] + ortak:
        for _ in range(rt.choice([1, 1, 2, 3])):  # K1: aynı sekmede tekrar
            aidat25.append({"no": no, "isim": ad, "hucreler": {"Telefon": "", "Tutar": para(tutar())}})
    for no, ad in [yeni() for _ in range(rt.randint(1, 3))] + ortak:  # K2: ortak dosya no iki dönem sekmesinde
        for _ in range(rt.choice([1, 1, 2])):
            aidat26.append({"no": no, "isim": ad, "hucreler": {"Telefon": "", "Tutar": para(tutar())}})
    sekmeler.append({"ad": "2025 Aidat", "tur": "serbest", "basliklar": ["Telefon", "Tutar"], "kayitlar": aidat25})
    sekmeler.append({"ad": "2026 Aidat", "tur": "serbest", "basliklar": ["Telefon", "Tutar"], "kayitlar": aidat26})
    servis = []
    for no, ad in [yeni() for _ in range(rt.randint(1, 3))]:
        t = tutar()
        o = rt.choice([0, t // 2, t, t + rt.randint(1, 50000)])  # ödenen > tutar → 0
        servis.append({"no": no, "isim": ad, "hucreler": {"Telefon": "", "Tutar": para(t), "Tahsil Edilen": para(o)}})
    sekmeler.append({"ad": "Okul Servisi", "tur": "serbest", "basliklar": ["Telefon", "Tutar", "Tahsil Edilen"], "kayitlar": servis})
    borclu = []
    for no, ad in [yeni() for _ in range(rt.randint(1, 3))]:
        t = tutar()
        kalan = rt.choice(["", para(0), para(rt.randint(0, t))])
        borclu.append({"no": no, "isim": ad, "hucreler": {"Telefon": "", "Toplam Borç": para(t), "Kalan Borç": kalan}})
    sekmeler.append({"ad": "Borçlular", "tur": "serbest", "basliklar": ["Telefon", "Toplam Borç", "Kalan Borç"], "kayitlar": borclu})
    kira = [{"no": no, "isim": ad, "hucreler": {"Telefon": "", "Aylık Ücret": para(tutar()), "Kalan Gün": str(rt.randint(1, 30))}}
            for no, ad in [yeni() for _ in range(rt.randint(1, 2))]]
    sekmeler.append({"ad": "Kira", "tur": "serbest", "basliklar": ["Telefon", "Aylık Ücret", "Kalan Gün"], "kayitlar": kira})
    hepsi = aidat25 + aidat26 + servis + borclu
    soz = [{"no": r["no"], "isim": r["isim"], "tarih": "2026-07-0%d" % rt.randint(1, 9), "tutar": "%d" % rt.randint(1, 5000)}
           for r in rt.sample(hepsi, min(len(hepsi), rt.randint(0, 2)))]
    soz += [{"no": no, "isim": ad, "tarih": "2026-07-05", "tutar": "%d" % rt.randint(1, 5000)} for no, ad in [yeni() for _ in range(rt.randint(0, 1))]]
    if soz:
        sekmeler.append({"ad": "Ödeme Sözleri", "tur": "soz", "kayitlar": soz})
    # C3 ([KULLANICI] 23.10.2026) kişi gruplaması: ortak/yer tutucu kimlik FARKLI adlarda, aynı ad iki kimlik (+ bazen aynı kimlikle ikinci dosya), kimliksiz +
    # kimlikli aynı ad, iki sekmede aynı kişi (kimlik sütunu olmayan "2026 Aidat"ta aynı adın kimliksiz yeni dosyası), farklı ad aynı gerçek TCKN. Başlık adı
    # kara kutu yoklamasındaki tanınan adlardan (ORTAM). Aynı adın iki kimliği varken kimliksiz satır ÜRETİLMEZ (kural tanımsız).
    baslik = rt.choice(["TC Kimlik No", "TCKN", "Kimlik No"])
    uye = []
    satir = lambda no, ad, kim: {"no": no, "isim": ad, "hucreler": {"Telefon": "", baslik: kim, "Tutar": para(tutar())}}  # noqa: E731
    yer = rt.choice(["11111111111", "0000000000", "2222222222"])
    for no, ad in [yeni() for _ in range(rt.randint(2, 3))]:
        uye.append(satir(no, ad, yer))
    (no1, ad1), (no2, _) = yeni(), yeni()
    k1, k2 = tckn(rt), tckn(rt)
    uye += [satir(no1, ad1, k1), satir(no2, ad1, k2)]
    if rt.random() < 0.5:
        uye.append(satir(yeni()[0], ad1, k1))
    (no3, ad3), (no4, _) = yeni(), yeni()
    k3 = tckn(rt)
    uye += [satir(no3, ad3, k3), satir(no4, ad3, "")]
    aidat26.append({"no": yeni()[0], "isim": ad3, "hucreler": {"Telefon": "", "Tutar": para(tutar())}})
    if rt.random() < 0.5:
        no5, ad5 = yeni()
        uye.append(satir(no5, ad5, k3))
    rt.shuffle(uye)
    sekmeler.append({"ad": "Üyeler", "tur": "serbest", "basliklar": ["Telefon", baslik, "Tutar"], "kayitlar": uye})
    rt.shuffle(sekmeler)  # sekme sırası (K2 04:09: farklı sekmedeki aynı dosya no ayrı borç — sonuç sıradan bağımsız)
    return {"id": "tablo", "islem": "tablo_yukle", "sekmeler": sekmeler}


def uret(tohum, islem):
    rnd = random.Random(tohum)
    bugun = date(2026, 6, 30)
    gun = date(2026, 3, 2)
    adimlar = [{"id": "c-a", "islem": "cari_ac", "ad": "A", "isim": "Rastgele Alfa %d" % tohum},
               {"id": "c-b", "islem": "cari_ac", "ad": "B", "isim": "Rastgele Beta %d" % tohum},
               {"id": "c-c", "islem": "cari_ac", "ad": "C", "isim": "Rastgele Gama %d" % tohum},
               {"id": "c-t", "islem": "cari_ac", "ad": "T", "isim": "Rastgele Tedarik %d" % tohum, "tur": "tedarikci"}]
    # /2 (23.10.2026): carisiz rastgele tablo (K1–K3) ve yarı tohumlarda Kasa yetkisi kaldırılmış kullanıcı (K5); ayrı akış — UX18 dizisi değişmez
    rt = random.Random(tohum * 7919 + 17)
    adimlar.insert(0, rastgele_tablo(rt, tohum))
    if rt.random() < 0.5:
        adimlar.insert(1, {"id": "u-y", "islem": "kullanici_ac", "ad": "Y%d" % tohum, "rol": "avukat", "kaldir": ["cash.view"]})
    sen = {"dil": M.DIL, "ad": "rastgele-ux18-%d" % tohum, "aciklama": "uretici.py --tohum %d --islem %d" % (tohum, islem),
           "dayanak": "KARARLAR.md B2, B3 (K1–K3), B3c (C3), B5b (K5); ders 17", "bugun": bugun.isoformat(), "adimlar": adimlar}
    n_f = n_e = 0
    kontrol = 0

    def durum():
        m = M.Model(dict(sen, adimlar=list(adimlar)))
        for a in adimlar:
            if a["islem"] != "kontrol":
                getattr(m, a["islem"])(a)
        return m

    for i in range(islem):
        gun = min(bugun, gun + timedelta(days=rnd.choice([0, 0, 1, 1, 2])))
        t = gun.isoformat()
        m = durum()
        cari = rnd.choice(["A", "B", "C"])
        acik = m.aciklar(cari)
        faturalar = [ad for ad, f in m.faturalar.items() if f["cari"] == cari and f["durum"] == "kesildi" and f["tur"] == "satis" and not f["taksitli"]]
        portfoy = [ad for ad, e in m.evraklar.items() if e["durum"] == "portfoy" and e["cari"] is not None]
        silinen = [ad for ad, e in m.evraklar.items() if e["durum"] == "silindi"
                   and (e["fatura"] is None or m.faturalar[e["fatura"]]["durum"] == "kesildi")]
        sid = "s%03d" % i
        bagimsiz = [e for e in portfoy if not m.evraklar[e]["kendi"]]
        acik_f = [f for f in faturalar if acik.get(f, 0) > 0]
        iptal_ed = [f for f in faturalar
                    if not any(tx["aktif"] and tx["fatura"] == f for tx in m.tahsilatlar.values())
                    and not any(e["kendi"] and e["fatura"] == f for e in m.evraklar.values())]
        gecmissiz = [e for e in bagimsiz if not any(x.get("evrak") == e for x in adimlar)]
        secenek = [("fatura", 26), ("tahsilat", 10), ("evrak", 16)]
        if acik_f:
            secenek.append(("bagli_tahsilat", 9))
        if portfoy:
            secenek += [("karsiliksiz", 8), ("tahsil", 5), ("ciro", 3)]
        if bagimsiz:
            secenek.append(("bag_degistir", 4))
        if gecmissiz:
            secenek.append(("evrak_sil", 4))
        if silinen:
            secenek.append(("evrak_geri_yukle", 3))
        if iptal_ed:
            secenek.append(("fatura_iptal", 3))
        if not faturalar:
            secenek = [("fatura", 1)]
        op = rnd.choices([o for o, _ in secenek], weights=[w for _, w in secenek])[0]
        if op == "fatura":
            n_f += 1
            tutar = rnd.choice([rnd.randint(1, 50) * 100, rnd.randint(100, 500000)])
            a = {"id": sid, "islem": "fatura", "ad": "F%d" % n_f, "cari": cari, "tutar": tl(tutar), "tarih": t}
            if rnd.random() < 0.12:
                n_e += 1
                a["evrak"] = {"ad": "E%d" % n_e, "tur": rnd.choice(["cek", "senet"]), "tutar": tl(rnd.randint(1, tutar))}
            adimlar.append(a)
        elif op == "tahsilat":
            adimlar.append({"id": sid, "islem": "tahsilat", "cari": cari, "tutar": tl(rnd.randint(1, 300000)), "tarih": t})
        elif op == "bagli_tahsilat":
            f = rnd.choice(acik_f)
            adimlar.append({"id": sid, "islem": "tahsilat", "cari": cari, "tutar": tl(rnd.randint(1, acik[f])), "tarih": t, "fatura": f})
        elif op == "evrak":
            n_e += 1
            a = {"id": sid, "islem": "evrak", "ad": "E%d" % n_e, "cari": cari, "tur": rnd.choice(["cek", "senet"]),
                 "tutar": tl(rnd.randint(1, 400000)), "tarih": t}
            if rnd.random() < 0.7:
                a["fatura"] = rnd.choice(faturalar)
            adimlar.append(a)
        elif op in ("karsiliksiz", "tahsil"):
            adimlar.append({"id": sid, "islem": op, "evrak": rnd.choice(portfoy), "tarih": t})
        elif op == "ciro":
            adimlar.append({"id": sid, "islem": "ciro", "evrak": rnd.choice(portfoy), "cari": "T", "tarih": t})
        elif op == "evrak_sil":
            adimlar.append({"id": sid, "islem": "evrak_sil", "evrak": rnd.choice(gecmissiz)})
        elif op == "evrak_geri_yukle":
            adimlar.append({"id": sid, "islem": "evrak_geri_yukle", "evrak": rnd.choice(silinen)})
        elif op == "fatura_iptal":
            adimlar.append({"id": sid, "islem": "fatura_iptal", "fatura": rnd.choice(iptal_ed), "tarih": t})
        elif op == "bag_degistir":
            e = rnd.choice(bagimsiz)
            ec = m.evraklar[e]["cari"]
            hedef = [f for f, x in m.faturalar.items() if x["cari"] == ec and x["durum"] == "kesildi" and x["tur"] == "satis" and not x["taksitli"]]
            adimlar.append({"id": sid, "islem": "bag_degistir", "evrak": e, "fatura": rnd.choice(hedef + [""])})
        if (i + 1) % 10 == 0:
            kontrol += 1
            adimlar.append({"id": "k%d" % kontrol, "islem": "kontrol"})
    adimlar.append({"id": "kson", "islem": "kontrol"})
    return sen


def main(argv):
    tohum = int(argv[argv.index("--tohum") + 1]) if "--tohum" in argv else 1
    islem = int(argv[argv.index("--islem") + 1]) if "--islem" in argv else 60
    sys.stdout.write(json.dumps(uret(tohum, islem), ensure_ascii=False, indent=1) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
