#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Rastgele UX18 senaryosu üretici (dil "destekofis-cari/1"; ders 17 rastgele sıra). Tohumlu, belirlenimli.

  python3 -I test/bagimsiz/cari/uretici.py --tohum 3 --islem 60 > senaryo.json
  python3 -I test/bagimsiz/cari/uretici.py --tur s1 --tohum 3 --islem 60 > senaryo.json   # /3 (2.4.5 madde 6, S1 + K6.1–K6.4)

--tur s1 (24.10.2026, 2.4.5 kâhini): iki müşteri (D, E) + bir tedarikçi (S); Açılış Bakiyesi (vadeli/vadesiz, tedarikçide alacak yönlü), satış ve alış
faturaları, elle Borç / Alacak (Vade Tarihi, Beklenen Ödeme Tarihi; ara sıra kaydın tarihinden önce ya da biçimsiz → 400 beklenir), KS7 bağsız kapatıcılar (faturasız stok
Satış İadesi, Şüpheli Alacağa Al + Değersiz Alacak Yaz) ve KS7.1 tedarikçiye nedensiz stok çıkışı (yükümlülük), bağsız ve faturaya bağlı
tahsilat / ödeme, bağsız alınan çek + karşılıksız, hareket silme / Silinenler'den geri yükleme, Düzenle (tutar / vade / beklenen), Cari görüntüleme yetkisi
kaldırılmış kullanıcı (yarı tohumda). UX18 akışından AYRI (rastgele-ux18-<t> değişmez). Ufkun sınır günü (bugün + 7, KS5 dahil) de üretilir.
2.4.6 (25.10.2026, KS8–KS10): müşteriye cari Ödeme (iade geri ödemesi — geri ödenmemiş stok iadesi varken: tam / kısmi / fazla), tedarikçiye faturasız Alış İadesi
(preturn; madde 10) ve tedarikçiden geri Tahsilat (KS9 simetri); Projeksiyon denetimleri (KS10) her kontrolde kâhinden.

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


def vkn(rt, gecerli=True):
    """VKN (GİB sağlama hanesi); gecerli=False → sağlama hanesi bilerek bozuk."""
    ilk = "".join(str(rt.randint(0, 9)) for _ in range(9))
    for c in range(10):
        if M.vkn_gecerli(ilk + str(c)) == gecerli:
            return ilk + str(c)
    return ilk + "0"


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
    # kara kutu yoklamasındaki tanınan adlardan (ORTAM). Yer tutucular sağlama hanesi tutmaz → kimlik sayılmaz (ad kuralı; baş mimar kararı 23.10).
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
    # Kimliksiz satır (baş mimar kararı 23.10): çok kimlikli adın (ad1) aynı dosya no'lu kimliksiz satırı kimlik sütunu olmayan sekmede → o kişiye katılır;
    # aynı dosya no'su olmayan kimliksiz kaydı → adın kimliksiz grubu (ayrı kişi); tek kimlikli adda yer tutucu değer → kimliksiz → tek kimliğe katılır.
    aidat26.append({"no": no1, "isim": ad1, "hucreler": {"Telefon": "", "Tutar": para(tutar())}})
    if rt.random() < 0.5:
        uye.append(satir(yeni()[0], ad1, ""))
    uye.append(satir(yeni()[0], ad3, yer))  # mutant 33 her tohumda: geçersiz değer kimlik sayılırsa ad3 iki kişiye bölünür
    rt.shuffle(uye)
    sekmeler.append({"ad": "Üyeler", "tur": "serbest", "basliklar": ["Telefon", baslik, "Tutar"], "kayitlar": uye})
    # KİMLİK SÜTUNU TUTAR DEĞİLDİR (baş mimar kararı 23.10): "Vergi No" başlıklı sekme, geçerli ve geçersiz VKN karışık; geçerli VKN aynı adı ayırır, geçersiz
    # değer kimlik sayılmaz (ad kuralı), aynı geçersiz değer farklı adlarda.
    vb = rt.choice(["Vergi No", "Vergi Numarası", "Vergi Kimlik"])
    firma = lambda no, ad, v: {"no": no, "isim": ad, "hucreler": {"Telefon": "", vb: v, "Tutar": para(tutar())}}  # noqa: E731
    fr = []
    (f1, fa1), (f2, _) = yeni(), yeni()
    v1, v2 = vkn(rt), vkn(rt)
    fr += [firma(f1, fa1, v1), firma(f2, fa1, v2)]
    if rt.random() < 0.5:
        fr.append(firma(yeni()[0], fa1, v1))
    if rt.random() < 0.5:
        fr.append(firma(yeni()[0], fa1, ""))
    (f3, fa3), (f4, _) = yeni(), yeni()
    fr += [firma(f3, fa3, vkn(rt, False)), firma(f4, fa3, "")]
    bozuk = vkn(rt, False)
    fr += [firma(no, ad, bozuk) for no, ad in [yeni() for _ in range(2)]]
    rt.shuffle(fr)
    sekmeler.append({"ad": "Firmalar", "tur": "serbest", "basliklar": ["Telefon", vb, "Tutar"], "kayitlar": fr})
    # VERGİ SÜTUNU BORÇ DEĞİLDİR ([KULLANICI] 23.10.2026 karar A): Fatura No + Müşteri + Tutar + vergi sütunu + Genel Toplam + Vade (yarı tohumlarda Tahsil Edilen);
    # adlar tekil (Fatura No'lu sekmede kayıt anahtarı rapordan adla çözülür).
    vs = rt.choice(["KDV", "Vergi", "Vergi Tutarı", "Stopaj", "Tevkifat", "ÖTV"])
    tahsil = rt.random() < 0.5
    fb = ["Telefon", "Tutar", vs, "Genel Toplam"] + (["Tahsil Edilen"] if tahsil else []) + ["Vade"]
    fat = []
    for i in range(rt.randint(2, 4)):
        _, ad = yeni()
        t = tutar()
        v = t * rt.choice([1, 8, 10, 18, 20]) // 100
        h = {"Telefon": "", "Tutar": para(t), vs: para(v), "Genel Toplam": para(t + v), "Vade": "%02d.07.2026" % rt.randint(1, 28)}
        if tahsil:
            h["Tahsil Edilen"] = para(rt.choice([0, (t + v) // 2, t + v, t + v + rt.randint(1, 5000)]))
        fat.append({"no": "F%d-%03d" % (tohum, n[0]), "isim": ad, "hucreler": h})
    sekmeler.append({"ad": "Faturalar", "tur": "serbest", "ilk": ["Fatura No", "Müşteri"], "basliklar": fb, "kayitlar": fat})
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
    sen = {"dil": "destekofis-cari/2", "ad": "rastgele-ux18-%d" % tohum, "aciklama": "uretici.py --tohum %d --islem %d" % (tohum, islem),
           "dayanak": "KARARLAR.md B2, B3 (K1–K3), B3c (C3), B3d (karar A), B5b (K5); ders 17", "bugun": bugun.isoformat(), "adimlar": adimlar}
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
        elif op == "stok_iade":
            adimlar.append({"id": sid, "islem": "stok_iade", "cari": musteri, "tutar": tl(rnd.randint(100, 200000)), "tarih": t})
        elif op == "stok_satis_hesap":  # KS7.1: tedarikçiye nedensiz stok çıkışı — yükümlülük (ödeme değil)
            adimlar.append({"id": sid, "islem": "stok_satis_hesap", "cari": "S", "tutar": tl(rnd.randint(100, 150000)), "tarih": t})
        elif op == "supheli_degersiz":
            # PLAN §3.11b (a) + K3/K7 (24.10.2026, Uzun Doğrulama #640): aynı gün (ya da sonra) tarihli alacak satırları kaydın kalanından düşer → değersiz tutarı kâhinin
            # hesapladığı KALANLA sınırlanır; arada bir bilerek aşan adım (ret doubtful-writeoff-exceeds) ve kalan 0'da adım (ret doubtful-closed) üretilir; kayıt her
            # durumda kapanır (kalan tamamı değersiz yazılır) — açık kayıt sınırı (doubtful-normal-exceeds) dışında kalınır.
            x = rnd.randint(1, max(1, m.bakiye(musteri) - sum(v for v in m.supheli_durum(musteri).values() if v > 0)))
            ad = "SP%s" % sid
            adimlar.append({"id": sid, "islem": "supheli_al", "ad": ad, "cari": musteri, "tutar": tl(x), "tarih": t})
            kalan = durum().supheli_kalan(ad)
            if kalan is None:
                pass  # kayıt açılamadı (ret) — değersiz adımı yok
            elif kalan <= 0:
                adimlar.append({"id": sid + "d", "islem": "degersiz", "supheli": ad, "tutar": tl(x), "tarih": t})  # ret: doubtful-closed
            else:
                if rnd.random() < 0.2:
                    adimlar.append({"id": sid + "a", "islem": "degersiz", "supheli": ad, "tutar": tl(kalan + rnd.randint(1, max(1, x))), "tarih": t})  # ret: aşan
                adimlar.append({"id": sid + "d", "islem": "degersiz", "supheli": ad, "tutar": tl(kalan), "tarih": t})
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


def uret_s1(tohum, islem):
    """/3 rastgele S1 dizisi (2.4.5 madde 6). Geçerlilik: fatura tarihleri artan; bağlı tahsilat/ödeme faturanın o anki açığını aşmaz; karşılıksız yalnız
    portföydeki evrakta; silinen yalnız etkin hareket, geri yüklenen yalnız silinmiş; Açılış silinmez. Durum kâhin modeliyle (model.py) izlenir."""
    rnd = random.Random(tohum * 104729 + 5)
    bugun = date(2026, 6, 30)
    sinir = (bugun + timedelta(days=M.UFUK_GUN)).isoformat()
    gun = date(2026, 3, 2)

    def ileri(t, en_cok):
        # KS5 (24.10.2026): ufkun sınır günü (bugün + 7) DAHİL — o gün de üretilir (önceki sürüm kaçınıyordu); sınır günü olasılığı artırılır
        x = (date.fromisoformat(t) + timedelta(days=rnd.randint(0, en_cok))).isoformat()
        return sinir if rnd.random() < 0.05 and sinir >= t else x

    def vadeler(t, bozuk=0.0):
        out = {}
        if rnd.random() < 0.7:
            out["vade"] = ileri(t, 130)
        if rnd.random() < 0.35:
            out["beklenen"] = ileri(t, 130)
        if rnd.random() < bozuk:
            alan = rnd.choice(["vade", "beklenen"])
            tur = rnd.choice(["once", "once", "bicim"])
            out[alan] = (date.fromisoformat(t) - timedelta(days=rnd.randint(1, 20))).isoformat() if tur == "once" else "%s.%s.%s" % (t[8:], t[5:7], t[:4])
        return out

    def acilis(ad, isim, tur):
        a = {"id": "c-" + ad.lower(), "islem": "cari_ac", "ad": ad, "isim": isim, "tarih": "2026-03-01"}
        if tur == "tedarikci":
            a["tur"] = "tedarikci"
        if rnd.random() < 0.75:
            a["acilis"] = tl(rnd.randint(100, 400000))
            if tur == "tedarikci":
                a["acilisYon"] = "alacak"
            v = vadeler("2026-03-01")
            if "vade" in v:
                a["acilisVade"] = v["vade"]
            if "beklenen" in v:
                a["acilisBeklenen"] = v["beklenen"]
        return a
    adimlar = [acilis("D", "Rastgele Delta %d" % tohum, "musteri"), acilis("E", "Rastgele Epsilon %d" % tohum, "musteri"),
               acilis("S", "Rastgele Sigma Tedarik %d" % tohum, "tedarikci")]
    if rnd.random() < 0.5:
        adimlar.append({"id": "u-v", "islem": "kullanici_ac", "ad": "V%d" % tohum, "rol": "avukat", "kaldir": ["accounts.view"]})
    sen = {"dil": M.DIL, "ad": "rastgele-s1-%d" % tohum, "aciklama": "uretici.py --tur s1 --tohum %d --islem %d" % (tohum, islem),
           "dayanak": "KARARLAR.md C (2.4.5 madde 6: S1, K6.1–K6.4); ders 17", "bugun": bugun.isoformat(), "adimlar": adimlar}
    n_f = n_a = n_e = 0
    kontrol = 0

    def durum():
        m = M.Model(dict(sen, adimlar=list(adimlar)))
        m.kos()
        return m

    for i in range(islem):
        gun = min(bugun, gun + timedelta(days=rnd.choice([0, 0, 1, 1, 2, 3])))
        t = gun.isoformat()
        m = durum()
        sid = "s%03d" % i
        musteri = rnd.choice(["D", "E"])
        acik_s = {f: v for f, v in m.aciklar(musteri).items() if m.faturalar[f]["tur"] == "satis" and v > 0}
        acik_a = {f: v for f, v in m.kuyruk_borc("S").items() if f in m.faturalar and v > 0}
        etkin = [h for h, x in m.hareketler.items() if x["aktif"] and x["tur"] in ("tahsilat", "borc", "alacak", "odeme")]
        silinen = [h for h, x in m.hareketler.items() if not x["aktif"] and x["tur"] in ("tahsilat", "borc", "alacak", "odeme")]
        elle = [h for h, x in m.hareketler.items() if x["aktif"] and x["tur"] in ("borc", "alacak")]
        portfoy = [e for e, x in m.evraklar.items() if x["durum"] == "portfoy"]
        secenek = [("fatura", 12), ("borc", 14), ("tahsilat", 14), ("alis", 6), ("alacak", 7), ("odeme", 7), ("evrak", 4), ("stok_iade", 4), ("stok_satis_hesap", 3),
                   ("alis_iade", 3)]
        # 2.4.6 KS8 / KS9: geri ödenmemiş iade kalemi (müşteride stok iadesi / tedarikçide alış iadesi) varsa geri ödeme adımı (kâhinin hesabıyla)
        G, _ = m._geri_odemeler(musteri)
        iade_kalan = sum(t - G.get(ad, 0) for _, ad, t in m._iade_kalemleri(musteri))
        _, Gp = m._geri_odemeler("S")
        alis_kalan = sum(x["tutar"] - Gp.get(xn, 0) for xn, x in m.kapaticilar.items() if x["aktif"] and x["cari"] == "S" and x["tur"] == "alis_iade")
        if iade_kalan > 0:
            secenek.append(("musteri_odeme", 5))
        if alis_kalan > 0:
            secenek.append(("tedarikci_tahsilat", 3))
        if m.bakiye(musteri) - sum(v for v in m.supheli_durum(musteri).values() if v > 0) > 0:
            secenek.append(("supheli_degersiz", 3))  # KS7 (b): Şüpheli Alacağa Al + aynı gün tamamını Değersiz Alacak Yaz (kayıt kapanır — açık kayıt sınırına girmez)
        if acik_s:
            secenek.append(("bagli_tahsilat", 6))
        if acik_a:
            secenek.append(("bagli_odeme", 3))
        if portfoy:
            secenek.append(("karsiliksiz", 3))
        if etkin:
            secenek.append(("hareket_sil", 5))
        if silinen:
            secenek.append(("hareket_geri_yukle", 4))
        if elle:
            secenek.append(("hareket_duzenle", 5))
        op = rnd.choices([o for o, _ in secenek], weights=[w for _, w in secenek])[0]
        tutar = rnd.choice([rnd.randint(1, 50) * 10000, rnd.randint(100, 300000)])
        if op == "fatura":
            n_f += 1
            adimlar.append({"id": sid, "islem": "fatura", "ad": "G%d" % n_f, "cari": musteri, "tutar": tl(tutar), "tarih": t})
        elif op == "alis":
            n_a += 1
            adimlar.append({"id": sid, "islem": "fatura", "ad": "A%d" % n_a, "cari": "S", "tur": "alis", "tutar": tl(tutar), "tarih": t})
        elif op in ("borc", "alacak"):
            a = {"id": sid, "islem": op, "cari": musteri if op == "borc" else "S", "tutar": tl(tutar), "tarih": t}
            a.update(vadeler(t, bozuk=0.08))
            adimlar.append(a)
        elif op == "tahsilat":
            a = {"id": sid, "islem": "tahsilat", "cari": musteri, "tutar": tl(rnd.randint(100, 350000)), "tarih": t}
            if rnd.random() < 0.12:
                a["vade"] = ileri(t, 40)  # K6.1: tahsilat alan taşımaz — gönderilirse kaydedilmez
            adimlar.append(a)
        elif op == "bagli_tahsilat":
            f = rnd.choice(sorted(acik_s))
            adimlar.append({"id": sid, "islem": "tahsilat", "cari": musteri, "tutar": tl(rnd.randint(1, acik_s[f])), "tarih": t, "fatura": f})
        elif op == "odeme":
            adimlar.append({"id": sid, "islem": "odeme", "cari": "S", "tutar": tl(rnd.randint(100, 250000)), "tarih": t})
        elif op == "bagli_odeme":
            f = rnd.choice(sorted(acik_a))
            adimlar.append({"id": sid, "islem": "odeme", "cari": "S", "tutar": tl(rnd.randint(1, acik_a[f])), "tarih": t, "fatura": f})
        elif op == "alis_iade":  # KS9 (madde 10): tedarikçiye faturasız Alış İadesi (preturn) — borç tarafında bağsız ödeme
            adimlar.append({"id": sid, "islem": "alis_iade", "cari": "S", "tutar": tl(rnd.randint(100, 150000)), "tarih": t})
        elif op in ("musteri_odeme", "tedarikci_tahsilat"):
            # KS8 / KS9 simetri: iade bedelinin geri ödenmesi — tam, kısmi ya da fazla (fazlası avans)
            kalan = iade_kalan if op == "musteri_odeme" else alis_kalan
            x = rnd.choice([kalan, rnd.randint(1, kalan), kalan + rnd.randint(1, 50000)])
            adimlar.append({"id": sid, "islem": "odeme" if op == "musteri_odeme" else "tahsilat", "cari": musteri if op == "musteri_odeme" else "S", "tutar": tl(x), "tarih": t})
        elif op == "stok_iade":
            adimlar.append({"id": sid, "islem": "stok_iade", "cari": musteri, "tutar": tl(rnd.randint(100, 200000)), "tarih": t})
        elif op == "stok_satis_hesap":  # KS7.1: tedarikçiye nedensiz stok çıkışı — yükümlülük (ödeme değil)
            adimlar.append({"id": sid, "islem": "stok_satis_hesap", "cari": "S", "tutar": tl(rnd.randint(100, 150000)), "tarih": t})
        elif op == "supheli_degersiz":
            # PLAN §3.11b (a) + K3/K7 (24.10.2026, Uzun Doğrulama #640): aynı gün (ya da sonra) tarihli alacak satırları kaydın kalanından düşer → değersiz tutarı kâhinin
            # hesapladığı KALANLA sınırlanır; arada bir bilerek aşan adım (ret doubtful-writeoff-exceeds) ve kalan 0'da adım (ret doubtful-closed) üretilir; kayıt her
            # durumda kapanır (kalan tamamı değersiz yazılır) — açık kayıt sınırı (doubtful-normal-exceeds) dışında kalınır.
            x = rnd.randint(1, max(1, m.bakiye(musteri) - sum(v for v in m.supheli_durum(musteri).values() if v > 0)))
            ad = "SP%s" % sid
            adimlar.append({"id": sid, "islem": "supheli_al", "ad": ad, "cari": musteri, "tutar": tl(x), "tarih": t})
            kalan = durum().supheli_kalan(ad)
            if kalan is None:
                pass  # kayıt açılamadı (ret) — değersiz adımı yok
            elif kalan <= 0:
                adimlar.append({"id": sid + "d", "islem": "degersiz", "supheli": ad, "tutar": tl(x), "tarih": t})  # ret: doubtful-closed
            else:
                if rnd.random() < 0.2:
                    adimlar.append({"id": sid + "a", "islem": "degersiz", "supheli": ad, "tutar": tl(kalan + rnd.randint(1, max(1, x))), "tarih": t})  # ret: aşan
                adimlar.append({"id": sid + "d", "islem": "degersiz", "supheli": ad, "tutar": tl(kalan), "tarih": t})
        elif op == "evrak":
            n_e += 1
            adimlar.append({"id": sid, "islem": "evrak", "ad": "EV%d" % n_e, "cari": musteri, "tur": "cek", "tutar": tl(rnd.randint(100, 200000)), "tarih": t})
        elif op == "karsiliksiz":
            adimlar.append({"id": sid, "islem": "karsiliksiz", "evrak": rnd.choice(sorted(portfoy)), "tarih": t})
        elif op == "hareket_sil":
            adimlar.append({"id": sid, "islem": "hareket_sil", "hareket": rnd.choice(sorted(etkin))})
        elif op == "hareket_geri_yukle":
            adimlar.append({"id": sid, "islem": "hareket_geri_yukle", "hareket": rnd.choice(sorted(silinen))})
        elif op == "hareket_duzenle":
            h = rnd.choice(sorted(elle))
            x = m.hareketler[h]
            a = {"id": sid, "islem": "hareket_duzenle", "hareket": h}
            if rnd.random() < 0.4:
                a["tutar"] = tl(rnd.randint(100, 300000))
            v = vadeler(x["tarih"], bozuk=0.1)
            for alan in ("vade", "beklenen"):
                if rnd.random() < 0.5:
                    a[alan] = v.get(alan, "")
            if len(a) == 3:
                a["vade"] = ileri(x["tarih"], 60)
            adimlar.append(a)
        if (i + 1) % 10 == 0:
            kontrol += 1
            adimlar.append({"id": "k%d" % kontrol, "islem": "kontrol"})
    adimlar.append({"id": "kson", "islem": "kontrol"})
    return sen


def main(argv):
    tohum = int(argv[argv.index("--tohum") + 1]) if "--tohum" in argv else 1
    islem = int(argv[argv.index("--islem") + 1]) if "--islem" in argv else 60
    tur = argv[argv.index("--tur") + 1] if "--tur" in argv else "ux18"
    sen = uret_s1(tohum, islem) if tur == "s1" else uret(tohum, islem)
    sys.stdout.write(json.dumps(sen, ensure_ascii=False, indent=1) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
