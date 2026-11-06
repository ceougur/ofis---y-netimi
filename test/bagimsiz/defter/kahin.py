# Bağımsız defter kâhini (temiz oda): programın kodunu GÖRMEDEN, yalnız senaryo.json'daki iş olaylarından Tekdüzen Hesap Planı'na göre
# elle yevmiye kurar ve beklenenleri yazar: her "kontrol" noktasında mizan; sonda cari bakiyeler, stok miktarları, aylık KDV (fatura
# kaynaklı hesaplanan/indirilecek), alacak yaşlandırma toplamları.
#
# Kurallar (kaynak: TDHP, KDV Kanunu / KDV GUT, VUK, GİB tevkifat oranları; ürün sahibinin 18.10.2026 kararları MM3–MM5):
#   açılış fişi           : varlık B / 500 A; yükümlülük 500 B / A; STOK AÇILIŞI B 153 / A 500 (miktar × alış fiyatı) — karar MM4
#                           (2.5.0: karşı hesap 519 — aşağıda "2.5.0 Ç5 bakımı")
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
# 2.5.0 Ç5 bakımı (06.11.2026; KARARLAR.md "2.5.0 Ç5 bakımı" — kodu görmeyen el; kaynak her kuralın yanında orada): kural seti "2.5.0" (varsayılan) ↔ "2.4.9"
# (yukarıdaki 2.4.3 kuralları AYNEN; çıktı eski kâhinle bayt bayt aynı).
#   D1 açılış karşılığı 519 (kasa, banka, stok, cari açılış İŞARETLİ) · D2 açıklamadan açılış tanınmaz (Borç Yaz 602, Alacak Yaz 770) · D3 açılış evrakı 519
#   (alınan B 101|121 / A 519, verilen B 519 / A 103|321) · D4 S48 karşılıksız carisiz açılış evrakı (cari seçilirse B CH, seçilmezse B 519) · D5 S49 formdan carisiz
#   evrak (alınan A 649, verilen B 770) · D6 göç "Açılış Olabilir" (KG-16, S47, S51, B6, B8, S53) · D7 kilitli dönem 2.4.9 kuralıyla donar (Ç3, S13, B15) · D8 Kural
#   Farkı Düzeltme Fişi (KG-15, M7, B16) · D9 KG-5 Excel taksit kartı B CH (T − P) / A 519 · D10 S12 / B11 Kasa açılışından önce tarihli hareket / düzeltme ret.
#
# Kullanım: python3 -I kahin.py senaryo.json [--yapilan yapilan.json] [--mutasyon N] [--kural 2.5.0|2.4.9] > beklenen.json
import json
import sys
from collections import defaultdict
from decimal import Decimal, ROUND_HALF_UP

TEVKIFAT = {"612": (9, 10), "624": (2, 10), "627": (5, 10), "601": (4, 10), "602": (9, 10), "616": (5, 10)}
GIDER_HESABI = {"marketing": "760", "freight": "760", "asset": "255", "commission": "653"}  # öbür gider türleri 770
KURALLAR = ("2.5.0", "2.4.9")
VARSAYILAN_KURAL = "2.5.0"
# 2.5.0 mutantları (her kararın B seçeneği; KARARLAR.md "Mutantlar") — 1–13 2.4.3'ten (kos.mjs MUTASYONLAR)
MUTASYONLAR_250 = {
    14: "D1 (30.10 B): açılış karşı hesabı 500",
    15: "D2 (M-02 B): açıklaması 'açılış' ile başlayan yeni Borç / Alacak Yaz açılış sayılır",
    16: "D3 (30.10 (1) B): açılış evrakı 602 / 770'e",
    17: "D4 (S48 B): karşılıksız carisiz açılış evrakı gidere (770)",
    18: "D4 (S48): cari seçilse de 519 (cari borçlanmaz)",
    19: "D5 (S49 B): formdan carisiz evrak 519'a",
    20: "D5 (S49 C): formdan carisiz evrak 602 / 770 (bugünkü)",
    21: "D9 (KG-5 B): Excel taksit kartı yeni satış (B CH T / A 600 T; B 519 P / A CH P)",
    22: "D6 (S47 B): onay bekleyen aday 602 / 770'te",
    23: "D6 (KG-16 B): 'Açılış Olabilir' listesi yok (aday sessizce 602 / 770, onay etkisiz)",
    24: "D6 (B6 B): Türkçe katlama yok (yalnız 'Açılış' tam yazımı aday)",
    25: "D6 (B6 B): 'Devir' / 'Devreden' de aday",
    26: "D6 (S51 B): Silinenler'den geri alınan açılış (carinin başka açılışı varken) reddedilir",
    27: "D6 (S53 B): göçte son tamamlanmış yılın 31 Aralık'ına kendiliğinden kilit (eski kuralla donar)",
    28: "D7 (Ç3 yok): kilitli dönemin maddeleri de göçte yeni kurala geçer",
    29: "D8 (KG-15 B): Kural Farkı Düzeltme Fişi yazılmaz",
    30: "D8 (M7 B): önceki mali yılın farkı da 602 / 770'e (671 / 681 yok)",
    31: "D8 (B16 B): onay bekleyen aday varken Kural Farkı fişi yazılır",
    32: "D10 (S12 B): Kasa açılışından önce tarihli Kasa hareketi kabul",
    33: "D10 (B11 B): Kasa hareketinin tarihini açılıştan önceye alan düzeltme kabul",
    34: "D10 (EK-2B 33 B): Kasa açılışının tarihi Kasa'nın ilk hareketinden sonra olabilir",
}
ACILIS_TURLERI = ("kasa_acilis", "banka_hesap", "urun", "cari_acilis", "borc_yaz", "alacak_yaz", "acilis_evrak", "cek_carisiz", "excel_taksit_karti")


def kurus(x):
    return int((Decimal(str(x)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))

def oranla(x, pay, payda):  # x kuruş × pay / payda, yarım yukarı
    return int((Decimal(x) * pay / payda).quantize(Decimal("1"), rounding=ROUND_HALF_UP))

def tr_katla(metin, katla=True):
    """B6 [BAŞ MİMAR]: Türkçe küçük harf (İ→i, I→ı) + ç→c, ı→i, ş→s katlaması (katla=False: yalnız Türkçe küçük harf)."""
    s = str(metin or "").strip().replace("İ", "i").replace("I", "ı").lower()
    if katla:
        s = s.replace("ç", "c").replace("ı", "i").replace("ş", "s")
    return s

def kg16_aday(aciklama, mut=0):
    """D6 KG-16 A + B6: açıklama "Açılış" ile BAŞLIYOR mu (Türkçe katlamayla; "Devir" / "Devreden" girmez). Ortada geçen "açılış" SK-1 (kâhin kurmaz).
    Mutant 24: katlama yok (yalnız "Açılış"ın Türkçe küçük harfi tam); 25: "Devir" / "Devreden" de aday."""
    if mut == 24:
        return str(aciklama or "").strip().startswith("Açılış")
    k = tr_katla(aciklama)
    if mut == 25 and (k.startswith("devir") or k.startswith("devreden")):
        return True
    if k.startswith("acilis"):
        return True
    if "acilis" in k:
        raise SystemExit("SK-1 KULLANICIYA SORULMALI: açıklamasında 'açılış' ortada geçen eski kayıt (%r) — kâhin bu durumu kurmaz" % aciklama)
    return False


def hesapla(sen, yapilan=None, mut=0, kural=VARSAYILAN_KURAL):
    if kural not in KURALLAR:
        raise SystemExit("kural seti %s değil" % "/".join(KURALLAR))
    Y = kural == "2.5.0"
    olaylar = [o for o in sen["olaylar"] if yapilan is None or o["id"] in yapilan or o["tur"] in ("cari", "urun", "kontrol")]
    by = {o["id"]: o for o in sen["olaylar"]}
    goc_i = next((i for i, o in enumerate(olaylar) if o["tur"] == "goc"), None)
    if goc_i is not None and not Y:
        raise SystemExit("göç olayı yalnız 2.5.0 kuralında anlamlı")

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
    # 2.5.0 Ç5
    retler = []                      # D10 / D6 / D8: beklenen reddedilen olaylar
    kaynak = {}                      # açılış türü kaynak kayıtları: olay id → {o, eski, aday, karar, silindi}
    kasa_acilis_tarihi = [None]
    kasa_hareket = {}                # D10: Kasa hareketi olay id → tarih (S12, B11 düzeltmesi, EK-2B 33)
    kilit = [None]                   # D7: göçte donan son gün (L)
    tanimsiz_eski = set()            # D7: 2.4.9 karşılığı kararda olmayan eski madde (gözlenirse hata)

    def kasa_once(t):
        """D10 S12 A: Kasa açılışından ÖNCE tarihli yeni Kasa hareketi reddedilir (açılış günü kabul). Mutant 32: kabul."""
        return Y and kasa_acilis_tarihi[0] is not None and t < kasa_acilis_tarihi[0] and mut != 32

    def bakiye():
        out = defaultdict(int)
        for _, _, satirlar in J:
            for h, b, a in satirlar:
                out[h] += b - a
        return dict(out)

    def ch(c):
        return "120" if tip[c] == "customer" else "320"

    def turet(o, k, aday=False, karar=None):
        """Açılış türü olayın maddesi: k = "2.4.9" (eski / donmuş) ya da "2.5.0". aday: KG-16 listesinde (onay bekliyor ya da onaylandı)."""
        tur = o["tur"]
        G = "519" if (k == "2.5.0" and mut != 14) else "500"
        if tur == "kasa_acilis":
            x = kurus(o["tutar"]); return [B("100", x), A(G, x)]
        if tur == "banka_hesap":
            x = kurus(o["acilis"]); return [B("102", x), A(G, x)]
        if tur == "urun":
            x = kurus(Decimal(str(o["acilisMiktar"])) * Decimal(str(o["alis"]))); return [B("153", x), A(G, x)]
        if tur == "cari_acilis":
            x = kurus(o["tutar"]); c = o["cari"]
            if o["yon"] == "borc":
                return [B("120" if tip[c] == "customer" else "320", x), A(G, x)]
            return [B(G, x), A("320" if tip[c] == "supplier" else "120", x)]
        if tur in ("borc_yaz", "alacak_yaz"):
            x = kurus(o["tutar"]); c = o["cari"]
            if k == "2.4.9":
                acik = str(o.get("aciklama") or "").strip()
                if acik.startswith("Açılış"):
                    karsi = "500"  # 2.4.9 kuralı: eski kâhinin "Açılış bakiyesi" açıklamalı cari açılış olayıyla aynı
                elif "acilis" in tr_katla(acik):
                    # büyük-küçük harf değişkeli açılış açıklaması: 2.4.9'daki karşılığı kararda yok → madde GÖZLENİRSE (göç öncesi kontrol, donmuş dönem, fiş) hata
                    tanimsiz_eski.add(o["id"])
                    karsi = "602" if tur == "borc_yaz" else "770"
                else:
                    karsi = "602" if tur == "borc_yaz" else "770"
            else:
                yeni_acilis = mut == 15 and not o.get("eski") and kg16_aday(o.get("aciklama"))
                if (aday and karar != "red" and not (mut == 22 and karar is None)) or yeni_acilis:
                    karsi = G
                else:
                    karsi = "602" if tur == "borc_yaz" else "770"  # C-01 / C-02 (KG-4 A; .90 ana hesapta)
            return [B(ch(c), x), A(karsi, x)] if tur == "borc_yaz" else [B(karsi, x), A(ch(c), x)]
        if tur == "acilis_evrak":
            x = kurus(o["tutar"])
            eski_gg = k == "2.4.9" or mut == 16
            if o["yon"] == "alinan":
                return [B("121" if o["evrak"] == "senet" else "101", x), A("602" if eski_gg else G, x)]
            return [B("770" if eski_gg else G, x), A("321" if o["evrak"] == "senet" else "103", x)]
        if tur == "cek_carisiz":
            x = kurus(o["tutar"])
            if k == "2.4.9" or mut == 20:
                gel, gid = "602", "770"  # S49 C: bugünkü gibi
            elif mut == 19:
                gel, gid = G, G
            else:
                gel, gid = "649", "770"  # S49 A: 649.90 / 770.90
            if o["yon"] == "alinan":
                return [B("121" if o["evrak"] == "senet" else "101", x), A(gel, x)]
            return [B(gid, x), A("321" if o["evrak"] == "senet" else "103", x)]
        if tur == "excel_taksit_karti":
            if k == "2.4.9":
                raise SystemExit("2.4.9 kuralında tanımsız: Excel taksit kartının eski defter karşılığı kararda yok")
            T = kurus(o["toplam"]); P = kurus(o.get("odenen", 0)); c = o["cari"]
            if mut == 21:
                return [B(ch(c), T), A("600", T), B(G, P), A(ch(c), P)]
            return [B(ch(c), T - P), A(G, T - P)]
        raise AssertionError(tur)

    def acilis_fisi(o, tarih):
        """Açılış türü olayın maddesini kurallara göre yazar ve kaynağı kaydeder (göçte yeniden türetmek için)."""
        eski = goc_i is not None and not kaynak_goc_gecti[0]
        if eski:
            o = dict(o, eski=True)
        kaynak[o["id"]] = {"o": o, "eski": eski, "aday": False, "karar": None, "silindi": False, "tarih": tarih}
        fis(tarih, o["id"], *turet(o, "2.4.9" if (eski or not Y) else "2.5.0"))

    def madde_bul(oid):
        return next((i for i, (_, olay, _) in enumerate(J) if olay == oid), None)

    def yeniden(oid):
        """Kaynağın maddesini güncel durumuna göre yeniden yazar (donmuş değilse)."""
        kk = kaynak[oid]
        i = madde_bul(oid)
        if kk["silindi"]:
            if i is not None:
                J.pop(i)
            return
        satir = [s for s in turet(kk["o"], "2.5.0", kk["aday"], kk["karar"]) if s[1] or s[2]]
        tanimsiz_eski.discard(oid)
        if i is None:
            fis(kk["tarih"], oid, *satir)
        else:
            J[i] = (J[i][0], oid, satir)

    def donmus(tarih):
        return kilit[0] is not None and tarih <= kilit[0] and mut != 28

    kaynak_goc_gecti = [False]

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
                acilis_fisi(o, o["acilisTarih"])
            elif o.get("acilisMiktar"):
                stok[oid] += Decimal(str(o["acilisMiktar"]))
            continue
        if tur == "kasa_acilis":
            if Y and any(x < t for x in kasa_hareket.values()) and mut != 34:
                retler.append(oid)  # D10 EK-2B 33 (TÜRETİLDİ): açılış tarihi Kasa'nın açılış dışı ilk hareketinden sonra olamaz (aynı gün olur)
            else:
                kasa_acilis_tarihi[0] = t
                acilis_fisi(o, t)
        elif tur == "banka_hesap":
            acilis_fisi(o, t)
        elif tur in ("kart_hesap",):
            pass
        elif tur == "pos":
            pos_oran[oid] = Decimal(str(o["oran"]))
        elif tur == "cari_acilis":
            x = kurus(o["tutar"])
            if o["yon"] == "borc":
                cari[o["cari"]] += x
            else:
                cari[o["cari"]] -= x
            acilis_fisi(o, t)
        elif tur in ("borc_yaz", "alacak_yaz"):
            if not Y:
                raise SystemExit("2.4.9 kuralında %s olayı yok (eski kâhin tanımaz)" % tur)
            x = kurus(o["tutar"])
            cari[o["cari"]] += x if tur == "borc_yaz" else -x
            acilis_fisi(o, t)
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
        elif tur == "tahsilat" and o["yol"] == "nakit" and kasa_once(t):
            retler.append(oid)  # D10 S12: nakit tahsilat Kasa hareketidir
        elif tur == "odeme" and o["yol"] == "nakit" and kasa_once(t):
            retler.append(oid)
        elif tur == "tahsilat":
            x = kurus(o["tutar"]); c = o["cari"]
            cari[c] -= x
            if o["yol"] == "nakit":
                kasa_hareket[oid] = t
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
            if o["yol"] == "nakit":
                kasa_hareket[oid] = t
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
        elif tur in ("acilis_evrak", "cek_carisiz"):
            # D3 (M-08 / M-09) ve D5 (S49): cariye işlenmemiş evrak — cari bakiyesi değişmez
            if not Y:
                raise SystemExit("2.4.9 kuralında %s olayı yok (eski kâhin tanımaz)" % tur)
            x = kurus(o["tutar"])
            if o["yon"] == "alinan":
                hesap = "121" if o["evrak"] == "senet" else "101"
                cekler[oid] = {"durum": "portfoy", "tutar": x, "cari": None, "hesap": hesap, "tur": tur}
            else:
                hesap = "321" if o["evrak"] == "senet" else "103"
                cekler[oid] = {"durum": "verildi", "tutar": x, "cari": None, "hesap": hesap, "tur": tur}
            acilis_fisi(o, t)
        elif tur == "ciro":
            ck = cekler[o["cek"]]; x = ck["tutar"]
            fis(t, oid, B("320", x), A(ck["hesap"], x)); cari[o["cari"]] += x; ck["durum"] = "ciro"
        elif tur == "tahsile_ver":
            ck = cekler[o["cek"]]; ck["durum"] = "bankada"
            fis(t, oid, B(ck["hesap"], ck["tutar"]), A(ck["hesap"], ck["tutar"]))
        elif tur == "karsiliksiz":
            ck = cekler[o["cek"]]; x = ck["tutar"]
            if ck["cari"] is None:
                if ck.get("tur") == "cek_carisiz":
                    raise SystemExit("SK-2 KULLANICIYA SORULMALI: formdan girilmiş carisiz (açılış değil) evrakın karşılıksızı — kâhin bu durumu kurmaz")
                # D4 S48 A: program cariyi sorar; seçilirse cari borçlanır, seçilmezse B 519 / A 101|121 ("açılış geri alınmış")
                secilen = o.get("cari")
                if secilen and mut != 18:
                    fis(t, oid, B(ch(secilen), x), A(ck["hesap"], x)); cari[secilen] += x
                    ck["cari"] = secilen
                else:
                    fis(t, oid, B("770" if mut == 17 else "519", x), A(ck["hesap"], x))
            elif mut != 10:
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
            x = kurus(o["tutar"])
            if kasa_once(t):
                retler.append(oid)  # D10 S12 A: Kasa açılışından önce tarihli Kasa hareketi reddedilir
            else:
                fis(t, oid, B("770", x), A("100", x))
                kasa_hareket[oid] = t
        elif tur == "kasa_duzelt":
            # D10 B11 [BAŞ MİMAR]: Kasa hareketinin tarihini açılıştan önceye alan düzeltme reddedilir; madde tarihi değişir (kümülatif mizan aynı)
            if o["hareket"] in kasa_hareket and kasa_acilis_tarihi[0] is not None and o["tarih"] < kasa_acilis_tarihi[0] and mut != 33:
                retler.append(oid)
            elif o["hareket"] in kasa_hareket:
                i = madde_bul(o["hareket"])
                J[i] = (o["tarih"], J[i][1], J[i][2])
                kasa_hareket[o["hareket"]] = o["tarih"]
        elif tur == "taksit_tahsil":
            x = kurus(o["tutar"]); c = faturalar[o["fatura"]]["olay"]["cari"]
            cari[c] -= x
            fis(t, oid, B("100" if o["yol"] == "nakit" else "102", x), A("120", x))
        elif tur == "excel_taksit_karti":
            # D9 KG-5 A: Excel'den yüklenen taksit kartı açılış alacağı (tek madde, P maddesiz)
            x = kurus(o["toplam"]) - kurus(o.get("odenen", 0))
            cari[o["cari"]] += x
            acilis_fisi(o, t)
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
        elif tur == "goc":
            # D6 / D7: 2.4.9 → 2.5.0 sürüm geçişi. Önceki kayıtlar ESKİ (2.4.9'un yazdığı). L = göç anındaki dönem kilidi (S13 GAP_RULE: 2.4.9 kuralıyla donar);
            # mutant 27 (S53 B): son tamamlanmış yılın 31 Aralık'ına kendiliğinden kilit.
            L = o.get("kilit")
            if mut == 27:
                yil_sonu = "%d-12-31" % (int(t[:4]) - 1)
                L = max(L or "", yil_sonu)
            kilit[0] = L
            kaynak_goc_gecti[0] = True
            for kid, kk in kaynak.items():
                ko = kk["o"]
                if ko["tur"] in ("borc_yaz", "alacak_yaz") and kk["eski"] and mut != 23:
                    kk["aday"] = kg16_aday(ko.get("aciklama"), mut)
                if not kk["silindi"] and donmus(kk["tarih"]) and kid in tanimsiz_eski:
                    raise SystemExit("D7: donmuş dönemde 2.4.9 karşılığı kararda olmayan eski kayıt %s — kâhin kurmaz" % kid)
                if kk["silindi"] or donmus(kk["tarih"]):
                    continue  # silinmiş kaydın maddesi yok; donmuş madde 2.4.9 kuralıyla kalır
                yeniden(kid)  # S53 A: kilitsiz dönemin maddesi yeni kurala geçer
        elif tur == "acilis_onay":
            kk = kaynak[o["kayit"]]
            if not kk["aday"]:
                if mut == 23:
                    continue  # KG-16 B: liste yok — onay etkisiz
                retler.append(oid)  # listede olmayan kayıt onaylanamaz / reddedilemez (liste dışı kayıt — işlem yok)
                continue
            kk["karar"] = o["karar"]
            if not donmus(kk["tarih"]):
                yeniden(o["kayit"])
        elif tur == "kayit_sil":
            kk = kaynak[o["kayit"]]
            if donmus(kk["tarih"]):
                retler.append(oid)  # kilitli dönemde kaynak değişmez (G-7)
                continue
            kk["silindi"] = True
            i = madde_bul(o["kayit"])
            if i is not None:
                J.pop(i)
            if kk["o"]["tur"] == "cari_acilis":
                x = kurus(kk["o"]["tutar"]); cari[kk["o"]["cari"]] -= x if kk["o"]["yon"] == "borc" else -x
            elif kk["o"]["tur"] in ("borc_yaz", "alacak_yaz"):
                x = kurus(kk["o"]["tutar"]); cari[kk["o"]["cari"]] -= x if kk["o"]["tur"] == "borc_yaz" else -x
        elif tur == "kayit_geri_al":
            kk = kaynak[o["kayit"]]
            ko = kk["o"]
            baska = ko["tur"] == "cari_acilis" and any(
                k2 != o["kayit"] and v2["o"]["tur"] == "cari_acilis" and v2["o"]["cari"] == ko["cari"] and not v2["silindi"] for k2, v2 in kaynak.items())
            if baska and mut == 26:
                retler.append(oid)  # S51 B: geri alma reddedilir
                continue
            kk["silindi"] = False
            if baska:
                kk["aday"] = True  # S51 A: carinin başka açılışı varken geri alınan açılış "Açılış Olabilir" listesine
            elif ko["tur"] in ("borc_yaz", "alacak_yaz") and kk["eski"] and kaynak_goc_gecti[0] and mut != 23:
                kk["aday"] = kg16_aday(ko.get("aciklama"), mut)  # B8: göç öncesi kaydın dönüşü de aday
            if ko["tur"] == "cari_acilis":
                if baska:
                    ko_aday = dict(ko, tur="borc_yaz" if ko["yon"] == "borc" else "alacak_yaz", aciklama="Açılış (geri alındı)")
                    kk["o"] = ko_aday  # listede: onaya kadar 519 (S47), red → C-01 / C-02
                x = kurus(ko["tutar"]); cari[ko["cari"]] += x if ko["yon"] == "borc" else -x
            elif ko["tur"] in ("borc_yaz", "alacak_yaz"):
                x = kurus(ko["tutar"]); cari[ko["cari"]] += x if ko["tur"] == "borc_yaz" else -x
            yeniden(o["kayit"])
        elif tur == "kural_farki_fisi":
            # D8 KG-15 A + M7 + B16: ilk açık gün (L + 1); donmuş maddelerin yeni ↔ eski farkı
            L = kilit[0]
            if L is None:
                raise SystemExit("kural_farki_fisi: kilit yok")
            bekleyen = [k2 for k2, v2 in kaynak.items() if v2["aday"] and v2["karar"] is None and not v2["silindi"] and donmus(v2["tarih"])]
            if bekleyen and mut != 31:
                retler.append(oid)  # B16: onay bekleyen aday varken fiş pasif
                continue
            if mut == 29:
                continue
            import datetime
            ft_ = o.get("tarih") or (datetime.date.fromisoformat(L) + datetime.timedelta(days=1)).isoformat()
            fark = defaultdict(int)
            for k2, v2 in kaynak.items():
                if v2["silindi"] or not donmus(v2["tarih"]):
                    continue
                yeni = defaultdict(int)
                for h, b_, a_ in turet(v2["o"], "2.5.0", v2["aday"], v2["karar"]):
                    yeni[h] += b_ - a_
                eski_ = defaultdict(int)
                for h, b_, a_ in turet(v2["o"], "2.4.9"):
                    eski_[h] += b_ - a_
                onceki_yil = v2["tarih"][:4] < ft_[:4] and mut != 30
                for h in set(yeni) | set(eski_):
                    d = yeni[h] - eski_[h]
                    if not d:
                        continue
                    if onceki_yil and h[0] in "67":
                        fark["681" if d > 0 else "671"] += d  # M7: önceki mali yıl — gider yönü 681, gelir yönü 671
                    else:
                        fark[h] += d
            satir = [B(h, d) if d > 0 else A(h, -d) for h, d in sorted(fark.items()) if d]
            if satir:
                fis(ft_, oid, *satir)
        elif tur == "kontrol":
            if tanimsiz_eski - {k2 for k2, v2 in kaynak.items() if v2["silindi"]}:
                raise SystemExit("D7: 2.4.9 karşılığı kararda olmayan eski madde kontrolde gözlenir (%s) — kâhin kurmaz" % sorted(tanimsiz_eski))
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
    if Y:
        # 2.5.0 Ç5: beklenen retler (D10 S12 / B11, D6 S51 B, D8 B16, kilitli kaynak) ve onay bekleyen "Açılış Olabilir" listesi (D6)
        out["kural"] = kural
        out["retler"] = sorted(retler)
        out["acilisOlabilir"] = sorted(k2 for k2, v2 in kaynak.items() if v2["aday"] and v2["karar"] is None and not v2["silindi"])
    return out


def main(argv):
    path = argv[1]
    yapilan = None
    mut = 0
    kural = VARSAYILAN_KURAL
    if "--yapilan" in argv:
        yapilan = set(json.load(open(argv[argv.index("--yapilan") + 1], encoding="utf-8")))
    if "--mutasyon" in argv:
        mut = int(argv[argv.index("--mutasyon") + 1])
    if "--kural" in argv:
        kural = argv[argv.index("--kural") + 1]
    if "--mutasyonlar" in argv:
        json.dump({str(k): v for k, v in MUTASYONLAR_250.items()}, sys.stdout, ensure_ascii=False, indent=1)
        return
    sen = json.load(open(path, encoding="utf-8"))
    out = hesapla(sen, yapilan, mut, kural)
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)

if __name__ == "__main__":
    main(sys.argv)
