#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Bağımsız TUTAR kâhini (2.4.4 madde 31a, B3 Netten Brüte + B4 e-SMM UBL tutarları) — temiz oda.

Programın kodunu GÖRMEDEN, yalnız KARARLAR.md'deki kurallarla (GVK 94/1 ve 94/2-b, KDV GUT tevkifat oranları — GİB UBL-TR kod listesi,
EDM e-SMM dip toplam anlamları — Ek_bilgi.txt, SENARYO-DILI §6.1 yuvarlama ve §6.3 kalem matrahı) beklenenleri hesaplar.

  python3 -I test/bagimsiz/tutar/model.py --uret --tohum 1 --adet 60 > girdi.json       # tohumlu girdi tablosu
  python3 -I test/bagimsiz/tutar/model.py girdi.json [--program program.json] [--mutasyon N] > beklenen.json

--program verilirse türetme denetimleri (kaydedilen matrahtan vergi, XML dip toplamları) programın KAYDETTİĞİ matrah/kalem değerleriyle
kurulur (girdi = programın matrahı; beklenen = kuralın sonucu); yoksa yalnız girdiden çıkan denetimler (oran, Net Ücret = N, en küçük brüt).
Yalnız tamsayı kuruş; ağ ve saat yok.
"""
import json
import random
import sys

TEVKIFAT = {"602": (9, 10), "616": (5, 10)}  # GİB UBL-TR_Codelist.xml WithholdingTaxTypeWithPercent: 60290, 61650
VARSAYILAN_STOPAJ = 2000  # baz puan; GVK 94/2-b serbest meslek %20 (programın ayar varsayılanı, kullanıcı değiştirmedi)
BIRINCIL = {"GIB", "EDM", "KULLANICI", "PLAN"}

MUTASYONLAR = {
    1: "Gerçek kişi alıcıya da %20 stopaj (GVK 94/1 yok sayılır)",
    2: "Birden çok brüt aynı Net Ücreti verirse en BÜYÜĞÜ seçilir",
    3: "KDV dahil fiyatlı makbuzda Netten Brüte KDV hariç matrahı birim fiyat sanır",
    4: "Stopaj kalem kalem yuvarlanır (ÇATAL B tek dal sanılır)",
    5: "602 tevkifatı 5/10 sanılır",
    6: "XML TaxInclusiveAmount = Net Ücret + KDV sanılır (EDM 'Tahsil Edilen KDV' yerine)",
    7: "Ödenecek = Net Ücret + KDV (tevkifat düşülmez)",
}


def rh(a, b):
    """a / b, yarım birim sıfırdan uzağa (SENARYO-DILI §6.1)."""
    if a < 0:
        return -rh(-a, b)
    return (2 * a + b) // (2 * b)


def kurus(metin):
    s = str(metin).strip()
    if "," in s:
        tam, ond = s.split(",", 1)
        ond = (ond + "00")[:2]
    else:
        tam, ond = s, "00"
    return int(tam) * 100 + int(ond)


def oran_bp(metin):
    s = str(metin)
    if "," in s:
        tam, ond = s.split(",", 1)
        return int(tam) * 100 + int((ond + "00")[:2])
    return int(s) * 100


class Hesap:
    def __init__(self, mut=0):
        self.mut = mut

    def stopaj_orani(self, satir):
        if satir.get("oran") is not None:
            return oran_bp(satir["oran"]), "AJAN" if satir["alici"] != "firma" else "GIB"  # elle oran geçer
        if satir["alici"] == "firma" or self.mut == 1:
            return VARSAYILAN_STOPAJ, "GIB"
        return 0, "GIB"  # GVK 94/1: ticari faaliyeti olmayan gerçek kişi stopaj yükümlüsü değil

    def kalem(self, fiyat, kdv, dahil):
        """(matrah, kdv) kuruş; iskontosuz, miktar 1 (SENARYO-DILI §6.3)."""
        if dahil:
            m = rh(fiyat * 100, 100 + kdv)
            return m, fiyat - m
        return fiyat, rh(fiyat * kdv, 100)

    def tevkifat(self, kdv_tutar, kod):
        if not kod:
            return 0
        pay, payda = TEVKIFAT[kod]
        if self.mut == 5 and kod == "602":
            pay, payda = 5, 10
        return rh(kdv_tutar * pay, payda)

    def belge(self, matrahlar, kdvler, kodlar, r, catal="A"):
        B = sum(matrahlar)
        if catal == "A" and self.mut != 4:
            S = rh(B * r, 10000)
        else:
            S = sum(rh(m * r, 10000) for m in matrahlar)
        K = sum(kdvler)
        T = sum(self.tevkifat(k, c) for k, c in zip(kdvler, kodlar))
        net = B - S
        odenecek = net + K - (0 if self.mut == 7 else T)
        return {"brut": B, "stopaj": S, "kdv": K, "tevkifat": T, "net": net, "odenecek": odenecek}

    def en_kucuk(self, satir, r, catal):
        """Net Ücret = N olan en küçük ilk kalem matrahı (KDV hariç) ya da KDV dahil fiyat; yoksa None."""
        N = kurus(satir["net"])
        kdv1 = satir["kdv"]
        dahil = satir.get("dahil", False)
        ekler = [(kurus(e["fiyat"]), e["kdv"], e.get("tevkifat")) for e in satir.get("ekler", [])]
        ek_m = [self.kalem(f, k, dahil) for f, k, _ in ekler]

        def net_of(m1):
            ms = [m1] + [m for m, _ in ek_m]
            B = sum(ms)
            S = rh(B * r, 10000) if catal == "A" else sum(rh(m * r, 10000) for m in ms)
            return B - S

        lo, hi = 0, max(1, 2 * N + 10)
        while net_of(hi) < N:
            hi *= 2
        while lo < hi:  # Net(m1) azalmayan → en küçük m1 (Net ≥ N)
            mid = (lo + hi) // 2
            if net_of(mid) >= N:
                hi = mid
            else:
                lo = mid + 1
        m1 = lo
        if net_of(m1) != N:
            return None
        if self.mut == 2:
            while net_of(m1 + 1) == N:
                m1 += 1
        if dahil:
            fiyat = m1 + rh(m1 * kdv1, 100) if self.mut != 3 else m1
            return {"matrah": m1, "fiyat": fiyat, "geriDonus": rh(fiyat * 100, 100 + kdv1)}
        return {"matrah": m1, "fiyat": m1, "geriDonus": m1}


def denetimler(girdi, program=None, mut=0):
    h = Hesap(mut)
    out = {}

    def d(k, b, e, kural):
        out[k] = {"b": b, "e": e, "k": kural}

    for s in girdi["satirlar"]:
        i = s["id"]
        r, et_r = h.stopaj_orani(s)
        iskonto = s.get("iskonto") not in (None, "0")
        a0 = h.en_kucuk(s, r, "A")  # iskonto matrahı değiştirmez: hedef matrah aynı (birim fiyatı iskontolu satırda denetlenmez)
        if a0 is None or a0["matrah"] <= 0:
            # öbür kalemlerin Net Ücreti yazılan tutara ulaşıyor/aşıyor: ilk kaleme sıfırdan büyük brüt bulunamaz → ret
            d("%s:gfn:durum" % i, "ret", "AJAN", "B3 çözümsüz Net Ücret reddedilir")
            continue
        d("%s:gfn:durum" % i, "ok", "AJAN", "B3 Netten Brüte ucu yanıt verir")
        if s["alici"] == "kimliksiz":
            dahil = s.get("dahil", False)
            ilk = (a0["matrah"], rh(a0["matrah"] * s["kdv"], 100)) if iskonto else h.kalem(a0["fiyat"], s["kdv"], dahil)
            ekl = [h.kalem(kurus(e["fiyat"]), e["kdv"], dahil) for e in s.get("ekler", [])]
            toplam = sum(m + k for m, k in [ilk] + ekl)
            if toplam > 3000000:
                # GİB (KURALLAR-244 A6): nihai tüketicide 30.000 TL üstü belgede gerçek TCKN + ad + adres zorunlu; 11111111111 yazılamaz
                d("%s:kayit:durum" % i, "ret", "GIB", "A6 30.000 TL üstü nihai tüketici")
                continue
        d("%s:gfn:stopajOrani" % i, r, et_r, "B3.1 GVK 94/1 yükümlü / 94/2-b %20 / elle oran")
        d("%s:kayit:durum" % i, "ok", "AJAN", "B3 makbuz kaydedilir")
        d("%s:kayit:stopajOrani" % i, r, et_r, "B3.1")
        d("%s:kayit:netUcret" % i, kurus(s["net"]), "GIB", "B3.2 Net Ücret = Brüt − Stopaj = yazılan net")
        if not iskonto:
            a = h.en_kucuk(s, r, "A")
            bb = h.en_kucuk(s, r, "B")
            if a:
                ek = sum(h.kalem(kurus(e["fiyat"]), e["kdv"], s.get("dahil", False))[0] for e in s.get("ekler", []))
                catal = a["matrah"] != (bb or {}).get("matrah")
                d("%s:kayit:brut" % i, a["matrah"] + ek, "CATAL" if catal else "AJAN", "B3.3 en küçük brüt (uzlaşım)" + (" — ÇATAL: kalem kalem stopajla %s" % ((bb["matrah"] + ek) if bb else "yok") if catal else ""))
                d("%s:gfn:birimFiyat" % i, a["fiyat"], "CATAL" if catal else "AJAN", "B3.3 ilk kalemin birim fiyatı" + (" (KDV dahil: matrah + yuvarla(matrah × KDV))" if s.get("dahil") else ""))
                if s.get("dahil") and a["geriDonus"] != a["matrah"]:
                    d("%s:not:dahilGeriDonus" % i, "uyusmaz", "CATAL", "B3.4 KDV dahil fiyattan matrah geri hesabı farklı (KDV-DAHIL sınıfı)")
        if program is None or i not in program.get("satirlar", {}):
            continue
        p = program["satirlar"][i]
        kalemler = p.get("kalemler") or []
        if not kalemler:
            continue
        ms = [x["matrah"] for x in kalemler]
        ks = [x["kdv"] for x in kalemler]
        cs = [x.get("tevkifatKodu") or None for x in kalemler]
        # kalemin KDV'si kendi matrahından (KDV hariç: yuvarla(M × oran); KDV dahil: fiyat − M) — programın kalem matrahı girdi
        ks_b = []
        for x in kalemler:
            if s.get("dahil"):
                ks_b.append(x["fiyatTutari"] - x["matrah"])
            else:
                ks_b.append(rh(x["matrah"] * x["kdvOrani"], 100))
        for j, (x, kb) in enumerate(zip(kalemler, ks_b)):
            d("%s:kalem%d:kdv" % (i, j + 1), kb, "GIB" if not iskonto else "YAYGIN", "B3.5 KDV = matrah × oran (kalem başına kuruşa)")
        A = h.belge(ms, ks, cs, r, "A")
        Bt = h.belge(ms, ks, cs, r, "B")
        catal_s = A["stopaj"] != Bt["stopaj"]
        d("%s:kayit:stopaj" % i, A["stopaj"], "CATAL" if catal_s else "GIB",
          "B3.6 stopaj = yuvarla(brüt × oran)" + (" — ÇATAL: kalem kalem %d" % Bt["stopaj"] if catal_s else ""))
        d("%s:kayit:kdv" % i, sum(ks_b), "GIB" if not iskonto else "YAYGIN", "B3.5 KDV toplamı = kalemlerin KDV'si")
        t_kalem = sum(h.tevkifat(k, c) for k, c in zip(ks, cs))
        t_belge = sum(h.tevkifat(sum(k for k, c2 in zip(ks, cs) if c2 == c), c) for c in set(c for c in cs if c))
        d("%s:kayit:tevkifat" % i, t_kalem, "CATAL" if t_kalem != t_belge else "GIB",
          "B3.7 tevkifat = yuvarla(KDV × pay/payda) (602 = 9/10, 616 = 5/10)" + (" — ÇATAL: belge düzeyi %d" % t_belge if t_kalem != t_belge else ""))
        S_p, K_p, T_p, B_p = p["stopaj"], p["kdv"], p["tevkifat"], p["brut"]
        d("%s:kayit:odenecek" % i, B_p - S_p + K_p - (0 if mut == 7 else T_p), "GIB", "B3.8 Ödenecek = Net Ücret + KDV − tevkifat (programın kendi tutarlarıyla)")
        d("%s:gfn:kayitAyni" % i, True, "AJAN", "B3.9 Netten Brüte ön hesabı = kaydedilen makbuz")
        x = p.get("xml")
        if not x:
            continue
        # B4 — e-SMM UBL dip toplamları (EDM Ek_bilgi.txt anlamları) ve kalem toplamları (UBL 2.1)
        d("%s:xml:LineExtensionAmount" % i, B_p, "EDM", "B4.1 'Brüt Ücret'")
        d("%s:xml:TaxExclusiveAmount" % i, B_p - S_p, "EDM", "B4.2 'Net Ücret Tutarı' = brüt − stopaj")
        d("%s:xml:TaxInclusiveAmount" % i, (B_p - S_p + K_p) if mut == 6 else (K_p - T_p), "EDM", "B4.3 'Tahsil Edilen KDV' = KDV − tevkifat")
        d("%s:xml:PayableAmount" % i, B_p - S_p + K_p - T_p, "EDM", "B4.4 'Net Alınan' = Net Ücret + Tahsil Edilen KDV")
        if r:
            d("%s:xml:0003:TaxAmount" % i, S_p, "EDM", "B4.5 GV stopajı (0003) = makbuzun stopajı")
            d("%s:xml:0003:Percent" % i, r, "EDM", "B4.5 0003 oranı")
        d("%s:xml:0015:TaxAmount" % i, K_p, "EDM", "B4.6 KDV (0015) toplamı")
        if T_p:
            d("%s:xml:WithholdingTaxAmount" % i, T_p, "EDM", "B4.7 KDV tevkifatı")
        d("%s:xml:kalemLineExtensionToplami" % i, B_p, "GIB", "B4.8 Σ kalem LineExtensionAmount = belge (UBL)")
        if r:
            d("%s:xml:kalem0003Toplami" % i, S_p, "AJAN", "B4.9 Σ kalem stopajı = belge stopajı (dağıtım)")
            for j, m in enumerate(ms):
                d("%s:xml:kalem%d:0003SapmaKurus" % (i, j + 1), "<=1", "AJAN", "B4.10 kalem stopajı kendi matrah × oranından en çok 1 kuruş sapar")
        d("%s:xml:kalemPriceToplami" % i, B_p - S_p + K_p - T_p, "EDM", "B4.11 Σ kalem 'Net Tahsilat' (PriceAmount) = Net Alınan")
        for j in range(len(ms)):
            d("%s:xml:kalem%d:netKimlik" % (i, j + 1), True, "EDM", "B4.12 InvoicedQuantity 'Net Ücret' = kalem brüt − kalem stopaj; PriceAmount = net + KDV − tevkifat")
    return {"ad": girdi["ad"], "denetimler": dict(sorted(out.items()))}


def uret(tohum, adet):
    rnd = random.Random(tohum)
    # Çapa satırları (her tohumda aynı): KURALLAR-244 [AJAN] 26 örneklerinin GİRDİLERİ (çıktıları beklenen sayılmaz) + çatal örnekleri
    satirlar = [
        {"id": "c01", "alici": "kisi", "kdv": 20, "dahil": False, "net": "1000"},
        {"id": "c02", "alici": "firma", "kdv": 20, "dahil": False, "net": "1000"},
        {"id": "c03", "alici": "firma", "kdv": 20, "dahil": True, "net": "1000"},
        {"id": "c04", "alici": "kisi", "kdv": 20, "dahil": True, "net": "1000,03"},
        {"id": "c05", "alici": "firma", "kdv": 10, "dahil": False, "net": "1000", "oran": "17"},
        {"id": "c06", "alici": "firma", "kdv": 20, "dahil": False, "net": "1000", "tevkifat": "602"},
        {"id": "c07", "alici": "firma", "kdv": 20, "dahil": False, "net": "80,02", "ekler": [{"fiyat": "100,03", "kdv": 20}]},
        {"id": "c08", "alici": "firma", "kdv": 20, "dahil": False, "net": "500,01", "tevkifat": "616",
         "ekler": [{"fiyat": "100,03", "kdv": 20, "tevkifat": "616"}, {"fiyat": "100,03", "kdv": 10}]},
        {"id": "c09", "alici": "kisi", "kdv": 20, "dahil": False, "net": "1000", "oran": "20"},
        {"id": "c10", "alici": "firma", "kdv": 20, "dahil": False, "net": "0,01"},
    ]
    for n in range(adet):
        alici = rnd.choices(["firma", "kisi", "kimliksiz"], weights=[50, 35, 15])[0]
        s = {"id": "s%03d" % n, "alici": alici, "kdv": rnd.choice([20, 20, 10, 1]), "dahil": rnd.random() < 0.25}
        u = rnd.random()
        if u < 0.08:
            s["oran"] = rnd.choice(["17", "10", "0", "20", "15"])
        net = rnd.choice([1, rnd.randint(1, 9999), rnd.randint(1, 100000) * 100, rnd.randint(1, 10 ** 8), rnd.randint(1, 10 ** 11)])
        s["net"] = "%d,%02d" % (net // 100, net % 100)
        if rnd.random() < 0.25:
            s["tevkifat"] = rnd.choice(["602", "616"])
        if rnd.random() < 0.3:
            s["ekler"] = [{"fiyat": "%d,%02d" % divmod(rnd.randint(1, 500000), 100), "kdv": rnd.choice([20, 10]),
                           **({"tevkifat": rnd.choice(["602", "616"])} if rnd.random() < 0.3 else {})}
                          for _ in range(rnd.randint(1, 2))]
        if rnd.random() < 0.08:
            s["iskonto"] = rnd.choice(["10", "12,5"])
        satirlar.append(s)
    return {"dil": "destekofis-tutar/1", "ad": "tutar-%d-%d" % (tohum, adet), "aciklama": "model.py --uret --tohum %d --adet %d" % (tohum, adet), "satirlar": satirlar}


def main(argv):
    if "--mutasyonlar" in argv:
        sys.stdout.write(json.dumps(MUTASYONLAR, ensure_ascii=False, indent=2) + "\n")
        return 0
    if "--uret" in argv:
        t = int(argv[argv.index("--tohum") + 1]) if "--tohum" in argv else 1
        n = int(argv[argv.index("--adet") + 1]) if "--adet" in argv else 60
        sys.stdout.write(json.dumps(uret(t, n), ensure_ascii=False, indent=1) + "\n")
        return 0
    mut = int(argv[argv.index("--mutasyon") + 1]) if "--mutasyon" in argv else 0
    with open(argv[1], encoding="utf-8") as f:
        girdi = json.load(f)
    program = None
    if "--program" in argv:
        with open(argv[argv.index("--program") + 1], encoding="utf-8") as f:
            program = json.load(f)
    sys.stdout.write(json.dumps(denetimler(girdi, program, mut), ensure_ascii=False, indent=2, sort_keys=True) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
