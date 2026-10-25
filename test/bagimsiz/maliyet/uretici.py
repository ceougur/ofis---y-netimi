#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Maliyet Hesap Kartı kâhini — tohumlu, TÜRETİLMİŞ senaryo üreticisi (dil "destekofis-maliyet/1").

Girdi değerleri rastgele üretilir (random.Random, dizge tohumu → her platformda aynı); müşterinin fiyatı/miktarı/farkı DEĞİLDİR.
Her senaryonun beklenen sonuçları kahin.py modelinden hesaplanıp senaryonun yanına yazılır (kabul.json).

    python3 -I test/bagimsiz/maliyet/uretici.py                 # kabul.json'u yeniden üretir (varsayılan tohum 1-3)
    python3 -I test/bagimsiz/maliyet/uretici.py --tohum 4-6 --cikti -   # ek tohumlar, standart çıktıya

Senaryo aileleri ve "nasıl bozulur?" listesiyle eşlemesi README.md §5'te.
"""
import json
import os
import random
import sys
from decimal import Decimal

sys.dont_write_bytecode = True
for _akis in (sys.stdout, sys.stderr):
    if hasattr(_akis, "reconfigure"):
        _akis.reconfigure(encoding="utf-8", errors="replace")   # Windows: -I ile PYTHONIOENCODING yok sayılır, boru ANSI kod sayfasına düşer
HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)   # python3 -I betiğin klasörünü sys.path'e koymaz
import kahin  # noqa: E402

VARSAYILAN_TOHUM = "1-3"

# ---------------------------------------------------------------------------------------------------------------------------------
# Türetilmiş değerler (müşteri değeri değil)
# ---------------------------------------------------------------------------------------------------------------------------------


def ondalik(r, lo, hi, basamak):
    olcek = 10 ** basamak
    n = r.randint(int(round(lo * olcek)), int(round(hi * olcek)))
    return float(Decimal(n) / Decimal(olcek))


def miktar(r):
    return float(r.randint(1, 12)) if r.random() < 0.4 else ondalik(r, 0.1, 60, r.choice([1, 2, 3]))


def fiyat(r):
    return ondalik(r, 0.25, 2500, 2) if r.random() < 0.8 else ondalik(r, 0.01, 5, 4)


def oran(r):
    return float(r.randint(0, 40)) if r.random() < 0.6 else ondalik(r, 0, 40, 1)


def bolen(r):
    return float(r.randint(80, 300)) if r.random() < 0.6 else ondalik(r, 50, 300, 1)


def taban(r):
    return float(r.randint(10, 250) * 100) if r.random() < 0.5 else ondalik(r, 1000, 25000, 2)


def fark(r):
    return float(r.randint(-8, 120) * 25) if r.random() < 0.7 else ondalik(r, -100, 1500, 2)


def gramaj_satiri(r, elle=False):
    d = {"giden_mt": ondalik(r, 1, 50, 1), "boy": ondalik(r, 0.5, 6.5, 2), "br_gramaj": ondalik(r, 0.05, 2.5, 3), "alis_ft": ondalik(r, 50, 400, 2)}
    if elle:
        d["giden_kg"] = ondalik(r, 0.5, 20, 3)
    return d


def tohum(*parca):
    return random.Random("maliyet|" + "|".join(str(p) for p in parca))


# ---------------------------------------------------------------------------------------------------------------------------------
# Adımlar (README §5)
# ---------------------------------------------------------------------------------------------------------------------------------
AC = {"islem": "ac"}
KAYDET = {"islem": "kaydet"}
YAC = {"islem": "yeniden_ac"}
YBAS = {"islem": "yeniden_baslat"}


def OKU(*k):
    return {"islem": "oku", "kartlar": list(k)}


def YAZ(kart, satir, **alanlar):
    return {"islem": "satir_yaz", "kart": kart, "satir": satir, "alanlar": alanlar}


def EKLE(kart, satir, **alanlar):
    return {"islem": "satir_ekle", "kart": kart, "satir": satir, "alanlar": alanlar}


def SIL(kart, satir):
    return {"islem": "satir_sil", "kart": kart, "satir": satir}


def AD(kart, hedef, ad, kimlik=None):
    a = {"islem": "ad_degistir", "kart": kart, "hedef": hedef, "ad": ad}
    if kimlik is not None:
        a["kimlik"] = kimlik
    return a


def ORAN(kart, adim, deger):
    return {"islem": "oran_degistir", "kart": kart, "adim": adim, "oran": deger}


def BOLEN(kart, deger):
    return {"islem": "bolen_degistir", "kart": kart, "bolen": deger}


def ELLE(kart, adim, deger):
    return {"islem": "elle_yaz", "kart": kart, "adim": adim, "deger": deger}


def TABAN(kart, h, d):
    return {"islem": "taban_yaz", "kart": kart, "hucre": h, "deger": d}


def FARK(kart, h, d):
    return {"islem": "fark_yaz", "kart": kart, "hucre": h, "deger": d}


def BILGI(kart, satir, sira, d):
    return {"islem": "bilgi_yaz", "kart": kart, "satir": satir, "sira": sira, "deger": d}


def CIK(yanit=None):
    a = {"islem": "cik"}
    if yanit:
        a["yanit"] = yanit
    return a


def S(kimlik, aile, adimlar, katman="api", karar=None, gerektirir=None, aciklama=""):
    s = {"kimlik": kimlik, "aile": aile, "katman": katman, "adimlar": adimlar}
    if karar:
        s["karar"] = karar
    if gerektirir:
        s["gerektirir"] = gerektirir
    if aciklama:
        s["aciklama"] = aciklama
    return s


# ---------------------------------------------------------------------------------------------------------------------------------
# Aileler
# ---------------------------------------------------------------------------------------------------------------------------------


def _doldur_zincir(kod, r, satirlar=None):
    k = kahin.KARTLAR[kod]
    return [YAZ(kod, s["kimlik"], miktar=miktar(r), fiyat=fiyat(r)) for s in k["satirlar"] if satirlar is None or s["kimlik"] in satirlar]


def zincir_aileleri(kod, tohumlar):
    k = kahin.KARTLAR[kod]
    R = [s["kimlik"] for s in k["satirlar"]]
    bolmeli = any(a["islem"] == "bolme" for a in k["adimlar"])
    elle = any(a["islem"] == "elle" for a in k["adimlar"])
    out = []
    out.append(S(f"{kod}/bos", "bos", [AC, OKU(kod)], aciklama="boş yapı: hesaplanan her değer 0 (V1)"))
    r = tohum(kod, "tek")
    out.append(S(f"{kod}/tek-satir", "tek-satir", [AC, YAZ(kod, r.choice(R), miktar=miktar(r), fiyat=fiyat(r)), KAYDET, OKU(kod)]))
    for t in tohumlar:
        r = tohum(kod, "dolu", t)
        out.append(S(f"{kod}/dolu/t{t}", "dolu", [AC] + _doldur_zincir(kod, r) + [KAYDET, OKU(kod)]))
    r = tohum(kod, "yari")
    yari = []
    for i, sid in enumerate(R):
        yari.append(YAZ(kod, sid, **({"miktar": miktar(r)} if i % 3 == 0 else {"fiyat": fiyat(r)} if i % 3 == 1 else
                                      {"miktar": miktar(r), "fiyat": fiyat(r)})))
    out.append(S(f"{kod}/yari-bos", "yari-bos", [AC] + yari + [KAYDET, OKU(kod)], aciklama="yalnız miktar ya da yalnız fiyat: tutar 0"))
    r = tohum(kod, "ekle")
    out.append(S(f"{kod}/satir-ekle", "satir-ekle", [AC] + _doldur_zincir(kod, r, R[:3]) + [
        EKLE(kod, "e1", ad="Silikon", birim="Adet", miktar=miktar(r), fiyat=fiyat(r)),
        EKLE(kod, "e2", miktar=miktar(r), fiyat=fiyat(r)), KAYDET, OKU(kod),
        EKLE(kod, "e3", ad="Conta", birim="Mt", miktar=miktar(r), fiyat=fiyat(r)), KAYDET, OKU(kod)],
        aciklama="eklenen satır yalnız satır kuralına (miktar × fiyat → ARA) girer (V6)"))
    r = tohum(kod, "sil")
    out.append(S(f"{kod}/satir-sil", "satir-sil", [AC] + _doldur_zincir(kod, r) + [
        EKLE(kod, "e1", miktar=miktar(r), fiyat=fiyat(r)), KAYDET, OKU(kod), SIL(kod, R[1]), SIL(kod, "e1"), KAYDET, OKU(kod)]))
    r = tohum(kod, "hepsini-sil")
    out.append(S(f"{kod}/hepsini-sil", "satir-sil", [AC] + _doldur_zincir(kod, r) + [SIL(kod, sid) for sid in R] + [
        KAYDET, OKU(kod), EKLE(kod, "e1", ad="Tek Kalem", miktar=miktar(r), fiyat=fiyat(r)), KAYDET, OKU(kod)]))
    r = tohum(kod, "ayni-ad")
    s1 = k["satirlar"][0]
    out.append(S(f"{kod}/sil-ayni-adla-ekle", "sil-ayni-adla-ekle", [AC] + _doldur_zincir(kod, r) + [KAYDET, OKU(kod), SIL(kod, "s1"),
        EKLE(kod, "e1", ad=s1["ad"], birim=s1["birim"], miktar=miktar(r), fiyat=fiyat(r)), KAYDET, OKU(kod)],
        aciklama="sil + aynı adla yeniden aç: eski satırın değeri dönmez"))
    r = tohum(kod, "ad")
    out.append(S(f"{kod}/ad-degistir", "ad-degistir", [AC] + _doldur_zincir(kod, r) + [KAYDET, OKU(kod),
        AD(kod, "kart", "Deneme Kartı"), AD(kod, "satir", k["satirlar"][1]["ad"], "s1"), AD(kod, "adim", "Masraf Payı", "yuzde"),
        YAZ(kod, R[2], birim="Gr"), KAYDET, OKU(kod)],
        aciklama="✎ ad hesaba girmez; aynı adlı iki satır iki ayrı satırdır (V8)"))
    r = tohum(kod, "oran")
    out.append(S(f"{kod}/oran-degistir", "oran-degistir", [AC] + _doldur_zincir(kod, r) + [KAYDET, OKU(kod),
        ORAN(kod, "yuzde", oran(r)), ORAN(kod, "yuzde_ekle", oran(r)), KAYDET, OKU(kod)],
        aciklama="oran değişir, etiket değişmez (V9)"))
    r = tohum(kod, "oran-sifir")
    out.append(S(f"{kod}/oran-sifir", "oran-degistir", [AC] + _doldur_zincir(kod, r) + [ORAN(kod, "yuzde", 0.0), ORAN(kod, "yuzde_ekle", 0.0),
                                                                                    KAYDET, OKU(kod)]))
    if bolmeli:
        r = tohum(kod, "bolen")
        out.append(S(f"{kod}/bolen-degistir", "bolen-degistir", [AC] + _doldur_zincir(kod, r) + [KAYDET, OKU(kod), BOLEN(kod, bolen(r)),
                                                                                              KAYDET, OKU(kod)]))
        for ad_, deger in (("bolen-sifir", 0.0), ("bolen-bos", None)):
            r = tohum(kod, ad_)
            out.append(S(f"{kod}/{ad_}", "bolen-sifir", [AC] + _doldur_zincir(kod, r) + [KAYDET, OKU(kod), BOLEN(kod, deger), KAYDET, OKU(kod)],
                         karar=kahin.KARAR_BOLEN_0, aciklama="KARAR GEREKİR K1: ret (bölen değişmez) ya da tanımsız (yalnız bölme adımı boş + hata)"))
    r = tohum(kod, "negatif")
    neg = [YAZ(kod, R[0], miktar=-miktar(r), fiyat=fiyat(r)), YAZ(kod, R[1], miktar=miktar(r), fiyat=-fiyat(r)),
           YAZ(kod, R[2], miktar=-miktar(r), fiyat=-fiyat(r))] + _doldur_zincir(kod, r, R[3:]) + [ORAN(kod, "yuzde", -5.5)]
    if bolmeli:
        neg.append(BOLEN(kod, -150.0))
    out.append(S(f"{kod}/negatif", "negatif", [AC] + neg + [KAYDET, OKU(kod)], aciklama="Excel gibi hesaplanır, doğrulama yok (AÇIK A10)"))
    r = tohum(kod, "ondalik")
    ond = [YAZ(kod, sid, miktar=ondalik(r, 0, 50, r.choice([6, 7, 9])), fiyat=ondalik(r, 0, 999, r.choice([4, 5, 6]))) for sid in R]
    ond += [YAZ(kod, R[0], miktar=0.1, fiyat=0.2), YAZ(kod, R[1], miktar=0.2, fiyat=0.1), ORAN(kod, "yuzde", 17.25), ORAN(kod, "yuzde_ekle", 12.125)]
    if bolmeli:
        ond.append(BOLEN(kod, 133.3333))
    out.append(S(f"{kod}/ondalik", "ondalik", [AC] + ond + [KAYDET, YAC, OKU(kod)], aciklama="ara değer yuvarlanmaz; girdi yuvarlanmadan saklanır (V3, V4)"))
    r = tohum(kod, "buyuk")
    out.append(S(f"{kod}/buyuk", "buyuk", [AC, YAZ(kod, R[0], miktar=999999999999.999, fiyat=9999999.99),
                                           YAZ(kod, R[1], miktar=123456789012.345, fiyat=98765.4321)] + _doldur_zincir(kod, r, R[2:]) + [KAYDET, YAC, OKU(kod)],
                 aciklama="15 anlamlı basamağa kadar girdi; tamsayı kuruş taşması yakalanır"))
    r = tohum(kod, "kaydet")
    out.append(S(f"{kod}/kaydet-yeniden-ac", "kaydet-yeniden-ac", [AC] + _doldur_zincir(kod, r) + [KAYDET, YAC, OKU(kod),
        YAZ(kod, R[0], miktar=miktar(r), fiyat=fiyat(r)), KAYDET, YAC, OKU(kod)]))
    if elle:
        r = tohum(kod, "elle")
        out.append(S(f"{kod}/elle", "elle", [AC] + _doldur_zincir(kod, r) + [ELLE(kod, "cm_elle", 12.5), KAYDET, OKU(kod),
            YAZ(kod, R[0], miktar=miktar(r), fiyat=fiyat(r)), ORAN(kod, "yuzde_ekle", oran(r)), KAYDET, OKU(kod),
            ELLE(kod, "cm_elle", None), KAYDET, YAC, OKU(kod)],
            aciklama="CM maliyeti elle hücre: hiçbir adıma girmez, hiçbir adımdan hesaplanmaz (tutarsızlık 4, V11)"))
    return out


def arayuz_aileleri(kod):
    k = kahin.KARTLAR[kod]
    r = tohum(kod, "arayuz")
    if k["tur"] == "zincir":
        doldur = _doldur_zincir(kod, r)
        degistir = YAZ(kod, k["satirlar"][0]["kimlik"], miktar=miktar(r), fiyat=fiyat(r))
        canli_ek = [ORAN(kod, "yuzde", oran(r)), OKU(kod)]
    elif k["tur"] == "gramaj":
        doldur = [YAZ(kod, s["kimlik"], **gramaj_satiri(r, s["elle_kg"])) for s in k["satirlar"]]
        degistir = YAZ(kod, "s2", boy=ondalik(r, 0.5, 6.5, 2))
        canli_ek = [YAZ(kod, "s3", alis_ft=ondalik(r, 50, 400, 2)), OKU(kod)]
    else:
        doldur = _doldur_matris(kod, r, _sembol_degerleri(k["sekme"], "arayuz"))
        ilk_fark = next(a for a, h in k["hucreler"].items() if h["tur"] == "formul")
        degistir = TABAN(kod, "r1c1", taban(r))
        canli_ek = [FARK(kod, ilk_fark, fark(r)), OKU(kod)]
    out = [
        S(f"{kod}/arayuz/canli", "canli", [AC] + doldur + [OKU(kod)] + canli_ek, katman="arayuz",
          aciklama="Kaydet'ten önce ekrandaki değerler (canlı hesap)"),
        S(f"{kod}/arayuz/cik-kaydetmeden", "cik", [AC] + doldur + [KAYDET, degistir, CIK("kaydetme"), AC, OKU(kod)], katman="arayuz",
          aciklama="değişiklikle Çık → soru; Kaydetmeden Çık → son kayıtlı hâl"),
        S(f"{kod}/arayuz/cik-kaydet", "cik", [AC] + doldur + [CIK("kaydet"), AC, OKU(kod)], katman="arayuz"),
        S(f"{kod}/arayuz/cik-degisiksiz", "cik", [AC] + doldur + [KAYDET, CIK(), AC, OKU(kod)], katman="arayuz",
          aciklama="kaydedilmiş, değişmemiş kartta Çık sorusu YOK (ders 34)"),
        S(f"{kod}/arayuz/ad-kaydetmeden", "cik", [AC] + doldur + [KAYDET, OKU(kod), AD(kod, "kart", "Geçici Ad"), CIK("kaydetme"), AC, OKU(kod)],
          katman="arayuz", aciklama="kaydedilmeyen ✎ ad geri döner"),
    ]
    return out


def gramaj_aileleri(tohumlar):
    kod = "mika/profil-agirliklari"
    k = kahin.KARTLAR[kod]
    R = [s["kimlik"] for s in k["satirlar"]]

    def doldur(r, satirlar=None):
        return [YAZ(kod, s["kimlik"], **gramaj_satiri(r, s["elle_kg"])) for s in k["satirlar"] if satirlar is None or s["kimlik"] in satirlar]

    out = [S(f"{kod}/bos", "bos", [AC, OKU(kod)])]
    r = tohum(kod, "tek")
    out.append(S(f"{kod}/tek-satir", "tek-satir", [AC, YAZ(kod, "s2", boy=ondalik(r, 0.5, 6.5, 2), br_gramaj=ondalik(r, 0.05, 2.5, 3),
                                                            alis_ft=ondalik(r, 50, 400, 2)), KAYDET, OKU(kod)]))
    for t in tohumlar:
        out.append(S(f"{kod}/dolu/t{t}", "dolu", [AC] + doldur(tohum(kod, "dolu", t)) + [KAYDET, OKU(kod)]))
    r = tohum(kod, "ekle")
    out.append(S(f"{kod}/satir-ekle", "satir-ekle", [AC] + doldur(r, R[:4]) + [
        EKLE(kod, "e1", parca="Kapak Profili", cins="Kgr", boy=ondalik(r, 0.5, 6.5, 2), br_gramaj=ondalik(r, 0.05, 2.5, 3), alis_ft=ondalik(r, 50, 400, 2)),
        EKLE(kod, "e2", giden_mt=5.0, boy=ondalik(r, 0.5, 6.5, 2), br_gramaj=ondalik(r, 0.05, 2.5, 3), alis_ft=ondalik(r, 50, 400, 2)),
        KAYDET, OKU(kod)], aciklama="eklenen satır R = Boy × Br. Gramaj (elle kuralı geçmez), iki toplama girer (V6)"))
    r = tohum(kod, "sil")
    out.append(S(f"{kod}/satir-sil", "satir-sil", [AC] + doldur(r) + [KAYDET, OKU(kod), SIL(kod, "s1"), SIL(kod, "s7"), KAYDET, OKU(kod)]))
    out.append(S(f"{kod}/elle", "elle", [AC, YAZ(kod, "s1", boy=10.0, br_gramaj=10.0, alis_ft=40.0, giden_kg=2.5), KAYDET, OKU(kod),
                                         YAZ(kod, "s1", boy=3.0), KAYDET, OKU(kod), YAZ(kod, "s1", giden_kg=None), KAYDET, OKU(kod)],
                 aciklama="R20 elle: Boy / Br. Gramaj değişince Giden Kğ değişmez (tutarsızlık 6)"))
    r = tohum(kod, "giden-mt")
    out.append(S(f"{kod}/giden-mt", "giden-mt", [AC] + doldur(r) + [KAYDET, OKU(kod)] + [YAZ(kod, sid, giden_mt=ondalik(r, 1, 99, 1)) for sid in R] +
                 [KAYDET, OKU(kod)], aciklama="Giden Mt hiçbir hesaba girmez (tutarsızlık 22)"))
    r = tohum(kod, "negatif")
    out.append(S(f"{kod}/negatif", "negatif", [AC] + doldur(r) + [YAZ(kod, "s2", boy=-2.5), YAZ(kod, "s3", alis_ft=-40.0),
                                                                  YAZ(kod, "s1", giden_kg=-1.25), KAYDET, OKU(kod)]))
    r = tohum(kod, "ondalik")
    out.append(S(f"{kod}/ondalik", "ondalik", [AC] + [YAZ(kod, sid, boy=ondalik(r, 0, 7, 7), br_gramaj=ondalik(r, 0, 3, 8),
                                                              alis_ft=ondalik(r, 0, 500, 6)) for sid in R[1:]] +
                 [YAZ(kod, "s1", giden_kg=0.1, alis_ft=0.2), KAYDET, YAC, OKU(kod)]))
    out.append(S(f"{kod}/buyuk", "buyuk", [AC, YAZ(kod, "s2", boy=999999999.999, br_gramaj=99999.999, alis_ft=9999999.99),
                                           YAZ(kod, "s1", giden_kg=123456789012.345, alis_ft=98765.4321), KAYDET, YAC, OKU(kod)]))
    r = tohum(kod, "kaydet")
    out.append(S(f"{kod}/kaydet-yeniden-ac", "kaydet-yeniden-ac", [AC] + doldur(r) + [KAYDET, YAC, OKU(kod),
        YAZ(kod, "s5", boy=ondalik(r, 0.5, 6.5, 2)), KAYDET, YAC, OKU(kod)]))
    r = tohum(kod, "ad")
    out.append(S(f"{kod}/ad-degistir", "ad-degistir", [AC] + doldur(r) + [KAYDET, OKU(kod), AD(kod, "kart", "Profil Tablosu"),
        AD(kod, "satir", k["satirlar"][2]["parca"], "s2"), YAZ(kod, "s4", cins="Gr"), KAYDET, OKU(kod)]))
    return out


def _sembol_degerleri(sekme, t):
    """Aynı sekmede aynı sembol aynı sayı (FORMÜL TABLOSU §4): K2'nin iki seçeneğinde de geçerli girdi."""
    r = tohum(sekme, "sembol", t)
    semboller = sorted({h["sembol"] for k in kahin.kartlar("matris", sekme) for h in k["hucreler"].values() if h["tur"] == "formul"},
                       key=lambda x: int(x[1:]))
    return {s: fark(r) for s in semboller}


def _doldur_matris(kod, r, sembol=None, hucre_basina=False):
    k = kahin.KARTLAR[kod]
    adimlar = []
    for a, h in k["hucreler"].items():
        if h["tur"] == "taban":
            adimlar.append(TABAN(kod, a, taban(r)))
    for a, h in k["hucreler"].items():
        if h["tur"] == "formul":
            adimlar.append(FARK(kod, a, fark(r) if hucre_basina else sembol[h["sembol"]]))
    return adimlar


def matris_aileleri(kod, tohumlar):
    k = kahin.KARTLAR[kod]
    sekme = k["sekme"]
    tabanlar = [a for a, h in k["hucreler"].items() if h["tur"] == "taban"]
    out = [S(f"{kod}/bos", "bos", [AC, OKU(kod)])]
    r = tohum(kod, "taban")
    out.append(S(f"{kod}/taban", "taban", [AC] + [TABAN(kod, a, taban(r)) for a in tabanlar] + [KAYDET, OKU(kod)],
                 aciklama="fark boş = 0 (V2): türeyen hücre kaynağına eşit"))
    for t in tohumlar[:2]:
        out.append(S(f"{kod}/sembol/t{t}", "sembol", [AC] + _doldur_matris(kod, tohum(kod, "sembol", t), _sembol_degerleri(sekme, t)) +
                     [KAYDET, OKU(kod)]))
    out.append(S(f"{kod}/hucre-basina/t1", "hucre-basina", [AC] + _doldur_matris(kod, tohum(kod, "hucre", 1), hucre_basina=True) + [KAYDET, OKU(kod)],
                 gerektirir=[f"{kahin.KARAR_FARK}=hucre"], aciklama="KARAR GEREKİR K2: her formül hücresinin kendi farkı (Excel'deki gibi)"))
    r = tohum(kod, "uc")
    uc = [TABAN(kod, a, v) for a, v in zip(tabanlar, [999999999999.99, -1500.5, 0.000001, 12345.678901] * 4)]
    sembol = _sembol_degerleri(sekme, "uc")
    for i, s in enumerate(sorted(sembol, key=lambda x: int(x[1:]))):
        sembol[s] = [0.0, -275.0, 0.01, 99999999999.99, 12.3456789][i % 5]
    uc += [FARK(kod, a, sembol[h["sembol"]]) for a, h in k["hucreler"].items() if h["tur"] == "formul"]
    out.append(S(f"{kod}/uc-degerler", "uc-degerler", [AC] + uc + [KAYDET, YAC, OKU(kod)]))
    r = tohum(kod, "taban-degistir")
    out.append(S(f"{kod}/taban-degistir", "taban-degistir", [AC] + _doldur_matris(kod, r, _sembol_degerleri(sekme, 1)) + [KAYDET, OKU(kod)] +
                 [TABAN(kod, a, taban(r)) for a in tabanlar] + [KAYDET, OKU(kod)], aciklama="taban değişince bağlı her hücre kayar"))
    r = tohum(kod, "fark-degistir")
    sembol = _sembol_degerleri(sekme, 2)
    hedef = sorted({h["sembol"] for h in k["hucreler"].values() if h["tur"] == "formul"}, key=lambda x: int(x[1:]))[0]
    yeni = fark(r)
    out.append(S(f"{kod}/fark-degistir", "fark-degistir", [AC] + _doldur_matris(kod, r, sembol) + [KAYDET, OKU(kod)] +
                 [FARK(kod, a, yeni) for a, h in k["hucreler"].items() if h["tur"] == "formul" and h["sembol"] == hedef] + [KAYDET, OKU(kod)],
                 aciklama=f"{hedef} farkının bütün hücreleri birlikte değişir (iki K2 seçeneğinde de geçerli)"))
    r = tohum(kod, "ad")
    out.append(S(f"{kod}/ad-degistir", "ad-degistir", [AC] + _doldur_matris(kod, r, _sembol_degerleri(sekme, 1)) + [KAYDET, OKU(kod),
        AD(kod, "kart", "Deneme Listesi"), AD(kod, "sutun", "Siyah Profil", "c2"), AD(kod, "olcu", "141 - 155", "r1"), KAYDET, OKU(kod)]))
    r = tohum(kod, "kaydet")
    out.append(S(f"{kod}/kaydet-yeniden-ac", "kaydet-yeniden-ac", [AC] + _doldur_matris(kod, r, _sembol_degerleri(sekme, 3)) + [KAYDET, YAC, OKU(kod)]))
    elle = [a for a in tabanlar if not a.startswith("r1c")]
    if elle:
        r = tohum(kod, "elle")
        ust = [a for a in tabanlar if a.startswith("r1c")]
        out.append(S(f"{kod}/elle-bagimsiz", "elle", [AC] + _doldur_matris(kod, r, _sembol_degerleri(sekme, 1)) + [KAYDET, OKU(kod)] +
                     [TABAN(kod, a, taban(r)) for a in ust] + [KAYDET, OKU(kod)],
                     aciklama="elle hücreler (I5, H15:K15, B30) üst satır değişince değişmez; altlarındaki zincir elle hücreden devam eder"))
    return out


def sekme_aileleri(sekme, tohumlar):
    zk = [k["kod"] for k in kahin.kartlar("zincir", sekme)]
    tum = [k["kod"] for k in kahin.KARTLAR.values() if k["sekme"] == sekme and k["tur"] in ("zincir", "gramaj")]
    gram = [k for k in kahin.kartlar("gramaj", sekme)]
    out = []

    def doldur(r, ortak_fiyat=None):
        adimlar = []
        for kod in zk:
            for s in kahin.KARTLAR[kod]["satirlar"]:
                f = ortak_fiyat if (ortak_fiyat is not None and s["kimlik"] == "s1") else fiyat(r)
                adimlar.append(YAZ(kod, s["kimlik"], miktar=miktar(r), fiyat=f))
        for g in gram:
            adimlar += [YAZ(g["kod"], s["kimlik"], **gramaj_satiri(r, s["elle_kg"])) for s in g["satirlar"]]
        return adimlar

    for t in tohumlar[:1]:
        out.append(S(f"{sekme}/sekme-dolu/t{t}", "sekme", [AC] + doldur(tohum(sekme, "dolu", t)) + [KAYDET, OKU(*tum)]))
    r = tohum(sekme, "oran-yalitim")
    out.append(S(f"{sekme}/oran-yalitim", "yalitim", [AC] + doldur(r) + [KAYDET, OKU(*tum), ORAN(zk[0], "yuzde", oran(r)),
                                                                           ORAN(zk[0], "yuzde_ekle", oran(r)), KAYDET, OKU(*tum)],
                 aciklama="oran kart başına: öbür kartlar (aynı oranlılar dahil) değişmez (V10)"))
    r = tohum(sekme, "bolen-yalitim")
    out.append(S(f"{sekme}/bolen-yalitim", "yalitim", [AC] + doldur(r) + [KAYDET, OKU(*tum), BOLEN(zk[0], bolen(r)), KAYDET, OKU(*tum)]))
    r = tohum(sekme, "fiyat-yalitim")
    out.append(S(f"{sekme}/fiyat-yalitim", "yalitim", [AC] + doldur(r, ortak_fiyat=fiyat(r)) + [KAYDET, OKU(*tum),
        YAZ(zk[0], "s1", fiyat=fiyat(r)), KAYDET, OKU(*tum)],
        aciklama="aynı adlı malzemenin fiyatı kartlar arasında paylaşılmaz (tutarsızlık 16–20, V10)"))
    return out


def bilgi_aileleri():
    out = [S("bilgi/bos", "bos", [AC, OKU(*[k["kod"] for k in kahin.kartlar("bilgi")])])]
    for sekme in ("liste-1", "liste-2"):
        mk = [k["kod"] for k in kahin.kartlar("matris", sekme)]
        bk = [k["kod"] for k in kahin.kartlar("bilgi", sekme)]
        r = tohum(sekme, "bilgi")
        sembol = _sembol_degerleri(sekme, 1)
        adimlar = [AC]
        for kod in mk:
            adimlar += _doldur_matris(kod, r, sembol)
        adimlar += [KAYDET, OKU(*(mk + bk))]
        for kod in bk:
            for s in kahin.KARTLAR[kod]["satirlar"]:
                for i in range(s["hucre"]):
                    deger = f"{r.randint(1, 99) * 50} TL" if kod.endswith("katlanir-kapi") else fark(r) + 1.0
                    adimlar.append(BILGI(kod, s["kimlik"], i, deger))
        adimlar += [KAYDET, OKU(*(mk + bk))]
        out.append(S(f"{sekme}/bilgi-bagsiz", "bilgi", adimlar, aciklama="fark / montaj / katlanır kapı satırları hiçbir hesaba bağlı değil (tutarsızlık 15)"))
    return out


def tohumlari_coz(metin):
    bas, _, son = metin.partition("-")
    return list(range(int(bas), int(son or bas) + 1))


def senaryolar(tohumlar):
    out = [S("sablon", "sablon", [{"islem": "sablon_oku"}], aciklama="boş yapı: sekme/kart kodları, adım sırası, oran/bölen, elle hücreler, matris kuralları")]
    for k in kahin.kartlar("zincir"):
        out += zincir_aileleri(k["kod"], tohumlar)
    out += gramaj_aileleri(tohumlar)
    for k in kahin.kartlar("matris"):
        out += matris_aileleri(k["kod"], tohumlar)
    out += bilgi_aileleri()
    for sekme in ("cam", "mika"):
        out += sekme_aileleri(sekme, tohumlar)
    for kod in ("cam/100x100-oval-kabin", "mika/170-2s2c-h182", "mika/80-lik-yan-panel", "mika/profil-agirliklari", "liste-1/seri-2-sabit-2-acilir"):
        out += arayuz_aileleri(kod)
    for kod in ("cam/100x100-oval-kabin", "mika/profil-agirliklari", "liste-2/seri-kose-girisli"):
        r = tohum(kod, "yeniden-baslat")
        k = kahin.KARTLAR[kod]
        if k["tur"] == "zincir":
            doldur, degis = _doldur_zincir(kod, r), YAZ(kod, "s2", miktar=miktar(r))
        elif k["tur"] == "gramaj":
            doldur, degis = [YAZ(kod, s["kimlik"], **gramaj_satiri(r, s["elle_kg"])) for s in k["satirlar"]], YAZ(kod, "s2", boy=1.75)
        else:
            doldur, degis = _doldur_matris(kod, r, _sembol_degerleri(k["sekme"], 1)), TABAN(kod, "r1c1", taban(r))
        out.append(S(f"{kod}/yeniden-baslat", "yeniden-baslat", [AC] + doldur + [KAYDET, degis, KAYDET, YBAS, AC, OKU(kod)],
                     aciklama="program yeniden başlayınca son Kaydet'teki değerler (V22)"))
    kimlikler = [s["kimlik"] for s in out]
    if len(set(kimlikler)) != len(kimlikler):
        raise SystemExit("senaryo kimliği iki kez üretildi")
    return out


def kabul_uret(tohumlar):
    out = []
    for s in senaryolar(tohumlar):
        if s.get("karar"):
            bek = {sec: kahin.beklenen_hesapla(s["adimlar"], {s["karar"]: sec}) for sec in kahin.SECENEKLER[s["karar"]]}
        else:
            bek = {"*": kahin.beklenen_hesapla(s["adimlar"])}
        s = dict(s)
        s["beklenen"] = bek
        out.append(s)
    return {"dil": kahin.DIL, "tohumlar": tohumlar, "uretici": "test/bagimsiz/maliyet/uretici.py", "senaryolar": out}


def yaz(veri, akis):
    """Satır başına bir senaryo (git farkı okunur); NaN/sonsuz yazılmaz."""
    bas = {k: v for k, v in veri.items() if k != "senaryolar"}
    akis.write("{\n")
    for k in sorted(bas):
        akis.write(f"{json.dumps(k)}: {json.dumps(bas[k], ensure_ascii=False, sort_keys=True, allow_nan=False)},\n")
    akis.write('"senaryolar": [\n')
    akis.write(",\n".join(json.dumps(s, ensure_ascii=False, sort_keys=True, allow_nan=False, separators=(",", ":")) for s in veri["senaryolar"]))
    akis.write("\n]\n}\n")


def main(argv):
    t = VARSAYILAN_TOHUM
    cikti = os.path.join(HERE, "kabul.json")
    i = 0
    while i < len(argv):
        if argv[i] == "--tohum":
            t, i = argv[i + 1], i + 2
        elif argv[i] == "--cikti":
            cikti, i = argv[i + 1], i + 2
        else:
            raise SystemExit(f"bilinmeyen seçenek {argv[i]}")
    veri = kabul_uret(tohumlari_coz(t))
    if cikti == "-":
        yaz(veri, sys.stdout)
    else:
        with open(cikti, "w", encoding="utf-8", newline="\n") as f:
            yaz(veri, f)
        oku = sum(1 for s in veri["senaryolar"] for a in s["adimlar"] if a["islem"] == "oku")
        print(f"{cikti}: {len(veri['senaryolar'])} senaryo, {oku} okuma (tohum {t})")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
