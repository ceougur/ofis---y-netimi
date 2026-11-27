#!/usr/bin/env python3
# WK 22: kahin_test.py yaması — I18 (S-W21 hataları → A sonuçları, B mutantları ayrışır; mb_elle yok), I19 üreticisi (Yine de Gönder, çapraz etiket, iki etiketli kişi) + değişmezler,
# izin listeleri (SW21), mutasyon ipuçları (M317–M325). Her yer değiştirme TAM BİR kez eşleşmeli.
import sys

yol = sys.argv[1]
s = open(yol, encoding="utf-8").read()


def degis(eski, yeni, n=1):
    global s
    k = s.count(eski)
    if k != n:
        sys.exit(f"eşleşme {k} ≠ {n}: {eski[:120]!r}")
    s = s.replace(eski, yeni)


# başlık
degis('''     okumalarında kime / kaç kez alanları AYNI; yeni girdiler yalnız C5C başlıklarında; her C5C başlığı ≥ 2 senaryo
''', '''     okumalarında kime / kaç kez alanları AYNI; yeni girdiler yalnız C5C başlıklarında; her C5C başlığı ≥ 2 senaryo.
     Güncelleme 22 (S-W21-1 / 2 / 3 = A — README §27): (b) eski hata girdileri artık A sonucunu verir (S-W21-1: elle, 'Ödeme Sözü Var' etiketi, POST 2; S-W21-2: 'Atlandı — Şüpheli Alacağı Var';
     S-W21-2 (b): iki etiket birlikte aşılır, elle değerlerle gider) ve B mutantları (M317, M318, M319) aynı girdide ayrışır; hata metinleri yok; (c) `mb_elle` okuması yok, S23-04 / S29-03 tek değerli
     (M321 ile karar metnindeki B sayıları 650 / 400 TL), Devri Geri Al (devir_geri) iki okumada kime / kaç kez AYNI; `soz_etiketi` yalnız SW21 senaryolarında; SW21 ≥ 5 senaryo
''')
degis('''     Gönder ile o nedenle elenmez — karşı-olgu koşuları)
"""''', '''     Gönder ile o nedenle elenmez — karşı-olgu koşuları). Güncelleme 22: üretici çapraz etiket (Şüpheli ↔ Söz, iki etiket birlikte) ve işteki / asıl işteki Yine de Gönder üretir;
     (1)'in istisnasına onaylı işteki Yine de Gönder girer; yeni değişmez (4) S-W21-2 A: "Atlandı — <etiket>" yalnız işin herhangi bir işaretleme anında (Yine de Ekle başlatması, kabul edilen /
     elle sayılan Yine de Gönder basışı) kişide OLMAYAN etiketle; (5) S-W21-1 A: söz sürerken kabul edilen Yine de Gönder yanıtında 'Ödeme Sözü Var' etiketi
"""''')

# mutasyon ipuçları
degis('''    "M316": "C5C4-02-gece-yarisini-gecen-is-gonderim-gunu-ve-gonderim-anindaki-tutar",
}''', '''    "M316": "C5C4-02-gece-yarisini-gecen-is-gonderim-gunu-ve-gonderim-anindaki-tutar",
    # güncelleme 22 (README §27.6)
    "M317": "SW21-01-sonucu-belirsiz-yine-de-gonder-suren-soz-elle-gider-ayni-gun-bir-ertesi-gun-serbest",
    "M318": "SW21-03-yine-de-ekle-sonradan-gelen-etiketle-atlanir-baslatmada-iki-etiket-birlikte-asilir-ayni-gun-yol",
    "M319": "SW21-03-yine-de-ekle-sonradan-gelen-etiketle-atlanir-baslatmada-iki-etiket-birlikte-asilir-ayni-gun-yol",
    "M320": "SW21-04-yine-de-gonder-basma-anindaki-iki-etiket-birlikte-asilir-elle-iz-degismeyen-meta-bekletti-ayni-icerik",
    "M321": "SW21-02-bekleyen-belirsizlik-onayli-iste-soz-asil-iste-yeniden-basma-elle-ikinci-deneme-gonderim-anindaki-tutar",
    "M322": "SW21-04-yine-de-gonder-basma-anindaki-iki-etiket-birlikte-asilir-elle-iz-degismeyen-meta-bekletti-ayni-icerik",
    "M323": "SW21-02-bekleyen-belirsizlik-onayli-iste-soz-asil-iste-yeniden-basma-elle-ikinci-deneme-gonderim-anindaki-tutar",
    "M324": "SW21-05-soz-icin-elle-bekleyen-ise-supheli-asil-iste-yeniden-basma-s23-iz-iki-etiketi-asar",
    "M325": "SW21-01-sonucu-belirsiz-yine-de-gonder-suren-soz-elle-gider-ayni-gun-bir-ertesi-gun-serbest",
}''')

# I2
degis('''              "C5C4", "C5C5", "C5C6", "C5C7", "C5C8", "C5C9"):
        if not kahin.KARARLAR.get(k, {}).get("metin"):''', '''              "C5C4", "C5C5", "C5C6", "C5C7", "C5C8", "C5C9", "SW21"):
        if not kahin.KARARLAR.get(k, {}).get("metin"):''')

# I10 (e)
degis('''            if "supheli_etiketi" in y and s["baslik"] not in ("S16", "S22", "S23", "S29", "S34", "C5C6"):''',
      '''            if "supheli_etiketi" in y and s["baslik"] not in ("S16", "S22", "S23", "S29", "S34", "C5C6", "SW21"):   # 22: SW21 (S16 + S-W21-1 birlikte)''')

# I12/I13 elle_sayilan
degis('''        if s["baslik"] not in ("S23", "S29") and any("elle_sayilan" in y for y in (r.get("yeniden") or {}).values()):
            h.append(f"{s['ad']}: S23 / S29 dışında elle_sayilan")''', '''        if s["baslik"] not in ("S23", "S29", "SW21") and any("elle_sayilan" in y for y in (r.get("yeniden") or {}).values()):   # güncelleme 22: SW21 (S23'ün söz karşılığı — Y22-4)
            h.append(f"{s['ad']}: S23 / S29 / SW21 dışında elle_sayilan")''')

# I14 okumalar
degis('''    # güncelleme 21 (README §26): devir_geri (8.2 adı) ve mb_elle (S-W21-3) okumaları eklendi — s16_an / s30_an yine YOK
    if set(kahin.OKUMALAR) != {"devam_sd", "devir_geri", "mb_elle"} or hasattr(kahin, "S16_OKUMALARI") or hasattr(kahin, "S30_OKUMALARI"):
        h.append(f"okumalar: {sorted(kahin.OKUMALAR)} (yalnız devam_sd + güncelleme 21'in devir_geri / mb_elle'si kalmalı)")''',
      '''    # güncelleme 21 (README §26): devir_geri (8.2 adı) ve mb_elle (S-W21-3) okumaları eklendi — s16_an / s30_an yine YOK; güncelleme 22 (README §27 Y22-8): mb_elle KALKTI (S-W21-3 = A)
    if set(kahin.OKUMALAR) != {"devam_sd", "devir_geri"} or hasattr(kahin, "S16_OKUMALARI") or hasattr(kahin, "S30_OKUMALARI"):
        h.append(f"okumalar: {sorted(kahin.OKUMALAR)} (yalnız devam_sd + güncelleme 21'in devir_geri'si kalmalı)")''')

# I18 başlık + (b) + (c) + (d)
degis('''@test("I güncelleme 21 (Ç5-C): borç girdisi doğrulaması; KULLANICIYA SORULMALI S-W21-1 / S-W21-2 hata verir; S-W21-3 ve Devri Geri Al okumalarında kime / kaç kez AYNI; yeni girdiler yalnız C5C başlıklarında")''',
      '''@test("I güncelleme 21 (Ç5-C): borç girdisi doğrulaması; güncelleme 22: S-W21-1 / S-W21-2 eski hata girdileri A sonucunu verir, B mutantları ayrışır; mb_elle yok; Devri Geri Al okumalarında kime / kaç kez AYNI; yeni girdiler yalnız C5C / SW21 başlıklarında")''')

degis('''    # (b) KULLANICIYA SORULMALI (README §26.4) — kodlanmadı, kâhin hata verir
    g_w1 = _c5c_temel''', '''    # (b) güncelleme 21'in KULLANICIYA SORULMALI girdileri (README §26.4) — güncelleme 22'de S-W21-1 / 2 = A (README §27): hata YOK, A sonucu; B mutantı aynı girdide ayrışır
    def hesap(g, ad, mut=frozenset()):
        try:
            return kahin.hesapla(g, frozenset(mut))[0]["sonuc"]
        except ValueError as e:
            h.append(f"{ad}: hata verdi: {e}")
            return None
    g_w1 = _c5c_temel''')

degis('''    hata_bekle(g_w1, "S-W21-1", "S-W21-1 (Yine de Gönder + süren söz)")''',
      '''    r = hesap(g_w1, "S-W21-1 (Yine de Gönder + süren söz)")
    if r is not None and (r["isler"]["T1/W"]["post"] != 2 or r["isler"]["T1/W"]["durum"] != kahin.TESLIM or r["yeniden"]["Y1"].get("soz_etiketi") != ["W"]
                          or r["isler"]["T1/W"]["degiskenler"][3] != "100,00 TL"):
        h.append(f"S-W21-1 = A: POST {r['isler']['T1/W']['post']}, durum {r['isler']['T1/W']['durum']}, yanıt {r['yeniden']['Y1']}")
    r = hesap(g_w1, "S-W21-1 M317", ["M317"])
    if r is not None and (r["isler"]["T1/W"]["durum"] != kahin.ATLANDI or r["isler"]["T1/W"].get("atlanma_nedeni") != SOZ_ or r["isler"]["T1/W"]["post"] != 1):
        h.append(f"S-W21-1 B (M317) ayrışmadı: {r['isler']['T1/W']['durum']} / POST {r['isler']['T1/W']['post']}")''')

degis('''    hata_bekle(g_w2, "S-W21-2", "S-W21-2 (söz için eklenene şüpheli)")''',
      '''    r = hesap(g_w2, "S-W21-2 (söz için eklenene şüpheli)")
    if r is not None and (r["isler"]["T1/Y"]["durum"] != kahin.ATLANDI or r["isler"]["T1/Y"].get("atlanma_nedeni") != SUP_ or r["isler"]["T1/Y"]["post"] != 0):
        h.append(f"S-W21-2 = A: {r['isler']['T1/Y']['durum']} / {r['isler']['T1/Y'].get('atlanma_nedeni')} / POST {r['isler']['T1/Y']['post']}")
    r = hesap(g_w2, "S-W21-2 M318", ["M318"])
    if r is not None and r["isler"]["T1/Y"]["post"] != 1:
        h.append(f"S-W21-2 B (M318) ayrışmadı: POST {r['isler']['T1/Y']['post']}")''')

degis('''    hata_bekle(g_w2b, "S-W21-2 (b)", "S-W21-2 (b) (başlatmada iki etiket)")
    # B seçeneklerinin (mutant) aynı girdide hesaplandığı: S-W21-1'de M293 (söz denetimi yok) gönderir
    try:
        r = kahin.hesapla(g_w1, frozenset(["M293"]))[0]["sonuc"]
        if r["isler"]["T1/W"]["post"] != 2:
            h.append(f"S-W21-1 girdisi M293 ile POST {r['isler']['T1/W']['post']} ≠ 2")
    except ValueError as e:
        h.append(f"S-W21-1 girdisi M293 ile hata: {e}")
    # (c) okumalar: S-W21-3 (mb_elle) ve Devri Geri Al (devir_geri) — her okumada kime / kaç kez alanları aynı
    alanlar = ("elenen", "olusmadi", "onceki_uyari", "bu_ay", "baslamadi")
    for ad_, anahtar in (("S23-04", "mb_elle"), ("S29-03", "mb_elle"), ("C5C8-02", "devir_geri")):''',
      '''    r = hesap(g_w2b, "S-W21-2 (b) (başlatmada iki etiket)")
    if r is not None and (r["elenen"].get("T1") or r["isler"]["T1/Y"]["durum"] != kahin.TESLIM or r["isler"]["T1/Y"]["degiskenler"][3] != "100,00 TL"):
        h.append(f"S-W21-2 (b) = A: elenen {r['elenen']}, {r['isler'].get('T1/Y', {}).get('durum')}")
    r = hesap(g_w2b, "S-W21-2 (b) M319", ["M319"])
    if r is not None and r["elenen"].get("T1", {}).get("Y") != SOZ_:
        h.append(f"S-W21-2 (b) M319 ayrışmadı: elenen {r['elenen']}")
    # güncelleme 21'in S-W21 hata metinleri kalktı (kodda ve beklenenlerde)
    kaynak_ = open(os.path.join(_BURASI, "kahin.py"), encoding="utf-8").read()
    if 'raise ValueError("KULLANICIYA SORULMALI S-W21' in kaynak_:
        h.append("kahin.py'de güncelleme 21'in S-W21 hata metni duruyor")
    for s in TUM:
        if s["baslik"] == "SW21" and "S-W21" not in s["kaynak"]:
            h.append(f"{s['ad']}: SW21 senaryosu kaynakta S-W21 kararını anmıyor")
    # (c) okumalar: S-W21-3 (mb_elle) KALKTI (güncelleme 22) — S23-04 / S29-03 tek değerli, M321 (B) karar metnindeki sayıları verir; Devri Geri Al (devir_geri) iki okuması sürer
    if "mb_elle" in kahin.OKUMALAR or hasattr(kahin.Benzetim, "MB_ELLE_SUSUYOR"):
        h.append("mb_elle okuması hâlâ var")
    for ad_, cid, tok, a_, b_ in (("S23-04", "MK", "T1/MK", ("16.10.2026", "250,00 TL"), ("06.10.2026", "650,00 TL")),
                                   ("S29-03", "MZ", "T1/MZ", ("30.10.2026", "200,00 TL"), ("06.10.2026", "400,00 TL"))):
        s = next(x for x in TUM if x["ad"].startswith(ad_))
        for mut, bek in ((frozenset(), a_), (frozenset(["M321"]), b_)):
            sonuclar = kahin.hesapla(senaryolar.girdi(s), mut)
            if len(sonuclar) != 1:
                h.append(f"{ad_} {sorted(mut)}: {len(sonuclar)} okuma grubu ≠ 1")
            d = sonuclar[0]["sonuc"]["isler"][tok]["degiskenler"]
            if tuple(d[2:4]) != bek:
                h.append(f"{ad_} {sorted(mut)}: {d[2:4]} ≠ {bek}")
    alanlar = ("elenen", "olusmadi", "onceki_uyari", "bu_ay", "baslamadi")
    for ad_, anahtar in (("C5C8-02", "devir_geri"),):''')

degis('''        if yeni and not s["baslik"].startswith("C5C"):
            h.append(f"{s['ad']}: C5C dışında yeni girdi {yeni}")''', '''        if yeni and not s["baslik"].startswith(("C5C", "SW21")):
            h.append(f"{s['ad']}: C5C / SW21 dışında yeni girdi {yeni}")
        y_ = beklenen(s)[0]["sonuc"].get("yeniden") or {}
        if s["baslik"] != "SW21" and any("soz_etiketi" in v for v in y_.values()):
            h.append(f"{s['ad']}: SW21 dışında soz_etiketi (Y22-3)")
    n_sw = sum(1 for s in TUM if s["baslik"] == "SW21")
    if n_sw < 5:
        h.append(f"SW21: {n_sw} < 5 senaryo")''')

# I19 üreticisi
degis('''    """I19 üreticisi (tohumlu): her carinin tek bir etiket türü vardır (düz / söz / şüpheli / tedarikçi — çapraz etiket S-W21-2 ve basma anında söz S-W21-1 üretilmez); borç girdisi
    3 gün içinde rastgele değişir; başlatma (Yine de Ekle, R3 'Yine de Gönder'), duraklat / Devam Et, Başarısızları Yeniden Dene, devir / Devri Geri Al, sınır, Meta yanıtları rastgele."""
    bk, ell = senaryolar.bk, senaryolar.ell
    turler = ("duz", "soz", "supheli", "tedarikci")''', '''    """I19 üreticisi (tohumlu): carinin etiket türü düz / söz / şüpheli / tedarikçi ya da (güncelleme 22) ÇAPRAZ (Şüpheli, Söz ya da ikisi birlikte — S-W21-2); borç girdisi
    3 gün içinde rastgele değişir; başlatma (Yine de Ekle, R3 'Yine de Gönder'), duraklat / Devam Et, Başarısızları Yeniden Dene, (güncelleme 22) işteki / asıl işteki Yine de Gönder
    (S-W21-1, S23), devir / Devri Geri Al, sınır, Meta yanıtları rastgele."""
    bk, ell = senaryolar.bk, senaryolar.ell
    turler = ("duz", "soz", "supheli", "tedarikci", "capraz", "capraz")''')

degis('''        for m in anlar:
            secenek = {"duz": [None, None, "gecikmis_borc_yok"], "soz": [None, kahin.SOZ, kahin.SOZ, "gecikmis_borc_yok"],
                       "supheli": [None, kahin.SUPHELI, kahin.SUPHELI, "gecikmis_borc_yok"], "tedarikci": [None, kahin.TEDARIKCI]}[tur]
            n_ = rnd.choice(secenek)
            tutar = str(rnd.choice((100, 250, 600, 1000, 1100))) + ".00"
            vade = f"{rnd.randint(1, 28):02d}.10.2026"
            if n_ is None:
                e = bk(f"+{m}m", vade=vade, tutar=tutar, bakiye=tutar)
            elif n_ in (kahin.SOZ, kahin.SUPHELI):
                e = bk(f"+{m}m", n_, elle=(ell(neden="gecikmis_borc_yok") if rnd.random() < 0.2 else ell(vade, tutar, tutar)))
            else:
                e = bk(f"+{m}m", n_)''', '''        for m in anlar:
            secenek = {"duz": [None, None, "gecikmis_borc_yok"], "soz": [None, kahin.SOZ, kahin.SOZ, "gecikmis_borc_yok"],
                       "supheli": [None, kahin.SUPHELI, kahin.SUPHELI, "gecikmis_borc_yok"], "tedarikci": [None, kahin.TEDARIKCI],
                       "capraz": [None, kahin.SOZ, kahin.SUPHELI, "iki", "iki"]}[tur]
            n_ = rnd.choice(secenek)
            tutar = str(rnd.choice((100, 250, 600, 1000, 1100))) + ".00"
            vade = f"{rnd.randint(1, 28):02d}.10.2026"
            if n_ is None:
                e = bk(f"+{m}m", vade=vade, tutar=tutar, bakiye=tutar)
            elif n_ == "iki":                                               # güncelleme 22: Şüpheli + Söz birlikte (S-W21-2 (b)); TEK neden 2.5 sırasıyla Şüpheli
                e = bk(f"+{m}m", kahin.SUPHELI, etiketler=[kahin.SUPHELI, kahin.SOZ],
                       elle=(ell(neden="gecikmis_borc_yok") if rnd.random() < 0.2 else ell(vade, tutar, tutar)))
                n_ = kahin.SUPHELI
            elif n_ in (kahin.SOZ, kahin.SUPHELI):
                e = bk(f"+{m}m", n_, elle=(ell(neden="gecikmis_borc_yok") if rnd.random() < 0.2 else ell(vade, tutar, tutar)))
            else:
                e = bk(f"+{m}m", n_)''')

degis('''        if rnd.random() < 0.2:
            olaylar.append({"t": f"+{m + rnd.randint(30, 900)}m", "tur": "basarisizlari_yeniden_dene", "toplu": et})
    if rnd.random() < 0.35:''', '''        if rnd.random() < 0.2:
            olaylar.append({"t": f"+{m + rnd.randint(30, 900)}m", "tur": "basarisizlari_yeniden_dene", "toplu": et})
        for c_ in secim:                                                    # güncelleme 22: işteki / asıl işteki Yine de Gönder (S-W21-1, S16, S23 — Sonucu Belirsiz değilse etkisiz)
            if rnd.random() < 0.35:
                y_ = {"t": f"+{m + rnd.randint(20, 600)}m", "tur": "yine_de_gonder", "toplu": et, "cari": c_, "etiket": f"Y{k + 1}{c_}"}
                if rnd.random() < 0.3:
                    y_["hedef"] = "asil"
                olaylar.append(y_)
                if rnd.random() < 0.4:
                    olaylar.append({"t": f"+{m + rnd.randint(620, 1500)}m", "tur": "yine_de_gonder", "toplu": et, "cari": c_, "etiket": f"Y{k + 1}{c_}b", "hedef": "asil"})
    if rnd.random() < 0.35:''')

degis('''    # oluşmayan toplu işe (seçilenlerin hepsi elendi — §7a 31) yönelen duraklat / Devam Et / yeniden deneme olaylarını çıkar (üretici düzeni; kural değil)
    for _ in range(20):
        try:
            kahin.Benzetim(g, kahin.tam_secim({}), "hizli").calistir()
            break
        except KeyError as e:
            ad = e.args[0]
            g["olaylar"] = [o for o in g["olaylar"] if o.get("toplu") != ad]''', '''    # oluşmayan toplu işe (seçilenlerin hepsi elendi — §7a 31) yönelen duraklat / Devam Et / yeniden deneme olaylarını ve (güncelleme 22) işi olmayan kişiye Yine de Gönder'i çıkar
    # (üretici düzeni; kural değil)
    for _ in range(60):
        try:
            kahin.Benzetim(g, kahin.tam_secim({}), "hizli").calistir()
            break
        except KeyError as e:
            ad = e.args[0]
            if isinstance(ad, str) and "/" in ad:
                tp_, c_ = ad.split("/", 1)
                g["olaylar"] = [o for o in g["olaylar"] if not (o["tur"] == "yine_de_gonder" and o.get("toplu") == tp_ and o.get("cari") == c_)]
            else:
                g["olaylar"] = [o for o in g["olaylar"] if o.get("toplu") != ad]''')

# I19 değişmezleri
degis('''    onay = set()
    for o in g["olaylar"]:
        if o["tur"] == "baslat" and o.get("onceki") == "gonder":
            for c in o["secim"]:
                onay.add((o.get("sirket", "A"), c, gun(kahin.zaman_ayristir(o["t"], b.T0))))''', '''    onay = set()
    for o in g["olaylar"]:
        if o["tur"] == "baslat" and o.get("onceki") == "gonder":
            for c in o["secim"]:
                onay.add((o.get("sirket", "A"), c, gun(kahin.zaman_ayristir(o["t"], b.T0))))
    # güncelleme 22: onaylı işteki Yine de Gönder (ilke 2 — Sonucu Belirsiz'in tek yolu) — kabul edilen basıştan sonraki ilk ileti (o günü ve iletinin gittiği gün) istisna
    yine_kabul = []                                                       # (an, toplu, cari, kabul mü, elle sayıldı mı)
    for o in g["olaylar"]:
        if o["tur"] == "yine_de_gonder":
            y_ = (r.get("yeniden") or {}).get(o["etiket"]) or {}
            yine_kabul.append((kahin.zaman_ayristir(o["t"], b.T0), o["toplu"], o["cari"], o["cari"] in (y_.get("alinan") or []), o["cari"] in (y_.get("elle_sayilan") or []), y_))
    for (tb, _tp, c, kabul, _el, _y) in yine_kabul:
        if kabul:
            sonraki = [ts for (s_, c_, sab, ts) in b.iz_ileti if c_ == c and sab == "hatirlatma" and ts >= tb]
            if sonraki:
                onay.add(("A", c, gun(min(sonraki))))''')

degis('''    for (t_, c, n) in adaylar[:6]:''', '''    # (4) güncelleme 22 — S-W21-2 A (README §27 Y22-5/6): "Atlandı — Şüpheli / Söz" yalnız işin işaretleme anlarının (Yine de Ekle başlatması, kabul edilen ya da elle sayılan Yine de Gönder
    #     basışı) HİÇBİRİNDE kişide olmayan etiketle (iz o anlardaki etiket türlerini aşar); (5) S-W21-1 A (Y22-3): basma anında söz süren kişiye kabul edilen / elle sayılan basışın yanıtında
    #     'Ödeme Sözü Var' etiketi
    def etiket_an(c, ms):
        e = None
        for x in next(cc for cc in g["cariler"] if cc["id"] == c)["borc"]:
            if kahin.zaman_ayristir(x["t"], b.T0) <= ms:
                e = x
        et = list(e.get("etiketler") or ([e["neden"]] if e.get("neden") in kahin.ETIKET_SIRASI else []))
        return set(et)
    isaret = {}                                                           # iş anahtarı → işaretleme anları
    for o in g["olaylar"]:
        if o["tur"] == "baslat" and o.get("yine_de_ekle"):
            for c in o["yine_de_ekle"]:
                isaret.setdefault(f"{o['etiket']}/{c}", []).append(kahin.zaman_ayristir(o["t"], b.T0))
    for (tb, tp_, c, kabul, el, y_) in yine_kabul:
        if kabul or el:
            isaret.setdefault(f"{tp_}/{c}", []).append(tb)
            if kahin.SOZ in etiket_an(c, tb) and y_.get("soz_etiketi") != [c]:
                h.append(f"(5) {tp_}/{c} @{tb}: basma anında söz sürüyor, onayda 'Ödeme Sözü Var' yok ({y_})")
    for (t_, anahtar, c, n) in b.iz_atla:
        if n in (kahin.SOZ, kahin.SUPHELI):
            anlar_ = [x for x in isaret.get(anahtar, []) if x <= t_]
            if any(n in etiket_an(c, x) for x in anlar_):
                h.append(f"(4) {anahtar} @{t_}: '{n}' ile Atlandı ama iz bu etiketi işaretleme anında aşmıştı")
    for (t_, c, n) in adaylar[:6]:''')

open(yol, "w", encoding="utf-8").write(s)
print("tamam")
