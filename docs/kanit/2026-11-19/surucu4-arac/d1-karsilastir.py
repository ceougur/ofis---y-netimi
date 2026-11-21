import sys
p = sys.argv[1]
t = open(p, encoding="utf-8").read()


def rep(a, b, n=1):
    global t
    assert t.count(a) == n, (a[:80], t.count(a))
    t = t.replace(a, b)


# 1. ETIKET: Ç7b'nin koda giren satırları kalkar
rep('''    "KG2-H03": ("kitap H-03 / KG-2 A (ürün sahibi 05.11 'hepsi A'): taksit Yeni Borç 600.90; bugün CHART 602 'Taksitli Satış'", "KG-2 (D bölümü (2); iş kodu atanmamış)"),
    "KG3-KAYIT": ("iş listesi D (3): 'KG-3 kayıt (dosya) tahsilatı gelir değil → Sınıflandırılmamış Tahsilatlar'; bugün CHART 602 'Kayıt Tahsilatları'", "KG-3 (iş kodu atanmamış)"),
    "KG7-INDIRIM": ("iş listesi D (6): 'KG-7 alış faturasında KDV İndirim Dönemi'; kitap KG-7 B = hep belge ayı (bugünkü)", "KG-7 (iş kodu atanmamış; kesme çizgisinde 2.5.1'e kayabilir)"),
    "KG8-IADE-KDV": ("kitap KG-8 (K değil; 'baş mimar + mali müşavir A'): satıştan iade KDV'si B 191; B seçeneği 391", "KG-8 (iş kodu atanmamış)"),
    "KG24-IHRACAT": ("kitap KG-24 A (K değil): ihracat 601; B 600 (bugün CHART'ta 601 yok — çekirdek §1)", "Ç1 + türetme (iş kodu atanmamış)"),
    "F06-GIDER-TURU": ("kitap F-06: 'Gider türü → hesap eşlemesi Ç1'de yazılır (DOĞRULANMADI)' — finansman 780", "Ç1"),
''', '''    # SÜRÜCÜ BAKIMI 4 (19.11.2026; Ç7b tur 2–2e + kâhin bakımı 13): Ç7b'nin koda giren kuralları (KG-2 belgesiz 600.90 / 610.90, KG-3 kayıt tahsilatı 336.90 + kural geçiş günü,
    # KG-4, KG-7 KDV İndirim Dönemi, KG-8 / F-08 iade KDV'si + geçiş günü + B-6, KG-24 ihracat 601, F-06 / M14 gider türleri, 649.90) programda — KG2-H03, KG3-KAYIT, KG7-INDIRIM,
    # KG8-IADE-KDV, KG24-IHRACAT, F06-GIDER-TURU BUGÜN dönüşümleri kalktı (program = kâhin olmalı; değilse fark önce HATADIR — ders 6). Kalan: Kartı Kapat 'Borçta Kalsın' (Ç7b tur 3).
''')
rep('''    "BUGUN-DALI": "BUGÜN-DALI (KG-7 = B)",
    "KG2-H03": "Ç7b-KG2",
    "KG3-KAYIT": "Ç7b-KG3",
    "KG7-INDIRIM": "Ç7b-KG7",
    "KG8-IADE-KDV": "Ç7b-KG8 (P2)",
    "KG24-IHRACAT": "Ç7b-KG24",
    "F06-GIDER-TURU": "Ç7b-F06",
''', '''    "BUGUN-DALI": "BUGÜN-DALI",
''')
rep('''        elif tur == "taksit_karti" and h == M.BELGESIZ_GELIR:
            n = "602"
            et.add("KG2-H03")
        elif tur == "kayit_tahsilati" and h in (M.CARISIZ_PASIF, M.CARISIZ_GELIR):
            n = "602"
            et.add("KG3-KAYIT")
        elif tur == "satis_iade_faturasi" and h == "191":
            n = "391"
            et.add("KG8-IADE-KDV")
        elif h == M.IHRACAT_GELIR:
            n = "600"
            et.add("KG24-IHRACAT")
        elif h == "780" and tur in ("alis_faturasi", "alis_iade_faturasi") and v.get("gider_turu") == "finansman":
            n = "770"
            et.add("F06-GIDER-TURU")
''', '''        # SÜRÜCÜ BAKIMI 4: KG2-H03 / KG3-KAYIT / KG8-IADE-KDV / KG24-IHRACAT / F06-GIDER-TURU dönüşümleri kalktı (Ç7b tur 2–2e programda).
''')
# 2. BUGÜN dalı: KG-7 = B kalktı (KG-7 A programda — Ç7b tur 2d)
rep('''bugun_dal.update({"KG7": "B"})   # KG-6''', '''# SÜRÜCÜ BAKIMI 4: KG-7 = B kalktı — KDV İndirim Dönemi programda (Ç7b tur 2d / 2e; invoices.vat_period); BUGÜN dalı = kâhinin dalı. Önceki not: KG-6''')
rep('''RED_DAL_KIMLIK = sorted({"Ç7b-KG7"} if any(o.get("indirim_ayi") or any(d.get("indirim_ayi") for d in o.get("duzeltmeler", [])) for o in S["olaylar"]) else set()) or ["BUGÜN-DALI (KG-7 = B)"]''',
    '''RED_DAL_KIMLIK = ["BUGÜN-DALI"]   # SÜRÜCÜ BAKIMI 4: KG-7 = B kalktı (bugün dalı kâhinin dalı)''')
rep('''DAL_ETIKETI = sorted(({"KG7-INDIRIM"} if any(o.get("indirim_ayi") for o in S["olaylar"]) or any(d.get("indirim_ayi") for o in S["olaylar"] for d in o.get("duzeltmeler", [])) else set())) or ["BUGUN-DALI"]''',
    '''DAL_ETIKETI = ["BUGUN-DALI"]   # SÜRÜCÜ BAKIMI 4: KG7-INDIRIM kalktı''')
open(p, "w", encoding="utf-8").write(t)
print("tamam")
