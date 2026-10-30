#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WhatsApp toplu gönderim kâhininin SENARYO KÜMESİ — DestekOfis 2.4.8 K0 (plan §7a kararlarına + revizyon R1–R3'e SABİT).

Her senaryo: GİRDİ (cariler, seçim, saat, sahte Meta davranışı, olaylar) + ELLE yazılmış beklenen (yalnız plandan, kâhinin modelinden
bağımsız hesaplanmış anahtar sayılar). `python3 -I senaryolar.py` modeli koşar; elle beklenen ile model AYNI değilse dosya YAZILMAZ,
çıkış 1 (iki ayrı türetme birbirini denetler). Aynıysa `senaryolar.json` (girdi + elle + modelin bütün beklenen sonucu) yazılır.

Başlıklar plan §8 "Nasıl bozulur?" listesinden: ÇİFT, KAYIP, YANLIŞ KİŞİ, YANLIŞ İÇERİK, HESAP / META, GÜVENLİK, TARİH, ÖLÇEK, (+ TEMEL, ŞİRKET).
Kaynak sütununda "§7a n" = plan netleştirmesi n, "R1–R3" = §7a revizyonu (30.10.2026). Serbest seçim YOK.
Zaman ifadeleri: "+5s", "+2h", "+3d", "cokme+10m" (çökmeye göre). Sahte Meta davranışı (meta_davranis):
  mesaj: {cari | "*": [yanıt1, yanıt2, …] | yanıt}  — o alıcının n. POST'u (sahte sunucu kuralı: yol messages + to + deneme n)
         yanıt ∈ "kabul" | "yanitsiz_kabul" (Meta aldı, yanıt kayboldu: koptu "sonra" / gecikme / işlenmiş gövdesiz 5xx)
                 | "yanitsiz_red" (Meta almadı, yanıt yok: koptu "once" / işlenmemiş gövdesiz 5xx) | {"hata": kod} | {"sinir": true}
  medya: [yanıt1, …]  — GENEL sıra (sahte sunucu medya isteğinde alıcı bilmez): "kabul" | "yanitsiz"
  kanca: {cari | "*": [[durum, gecikme, {kod, tekrar, varis}], …] | {"<n. ileti>": [...]}}  — Meta'nın o iletiye göndereceği (İMZALI) durum kancaları
  sahte_kanca olayı: imzasız (imzali yok) olay — kapıcıda imza doğrulanamaz (§7a 3).
"""
import json
import os
import sys

sys.dont_write_bytecode = True
_BURASI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _BURASI)
import kahin  # noqa: E402

T0 = "2026-10-30T10:00:00+03:00"
EKIM = {"bas": "2026-10-01", "son": "2026-10-31"}
EYLUL = {"bas": "2026-09-01", "son": "2026-09-30"}
ARALIK = {"bas": "2026-12-01", "son": "2026-12-31"}
K_STD = [["sent", "+1s"], ["delivered", "+5s"]]
FIRMA = "Deneme Ticaret Ltd. Şti."
DON = "01.10.2026 – 31.10.2026"          # §7a 21 (U+2013)
BEKLETTI = "Meta Bekletti (24 Saat Sonra Yeniden)"
SORU = "PLAN-SUSUYOR:24-saatten-eski-devam-sorusu"
GERI = "Durduruldu (Geri Yükleme)"


def cari(id_, ad, tel, hareketler=(), **kw):
    return {"id": id_, "ad": ad, "telefon": tel, "hareketler": [{"tarih": t, "borc": b, "alacak": a} for (t, b, a) in hareketler], **kw}


def A(**kw):
    return cari("A", "Ayşe Yılmaz", kw.pop("telefon", "0532 111 22 33"), [("2026-09-10", 1000, 0), ("2026-10-05", 500, 0), ("2026-10-20", 0, 250)], **kw)


def B(**kw):
    return cari("B", "Mehmet Kaya", kw.pop("telefon", "0533 222 33 44"), [("2026-10-15", 2000, 0)], **kw)


def C(**kw):
    return cari("C", "Zeynep Demir", kw.pop("telefon", "0534 333 44 55"), [("2026-08-01", 300, 0), ("2026-09-01", 0, 300)], **kw)


def D(**kw):
    return cari("D", "Hasan Çelik", kw.pop("telefon", "0535 444 55 66"), [("2026-10-10", 750, 0)], **kw)


def E(**kw):
    return cari("E", "Elif Şahin", kw.pop("telefon", "0536 555 66 77"), [("2026-10-11", 80, 0)], **kw)


def F():
    return cari("F", "Fatma Aydın", "0537 666 77 88", [("2026-10-12", 10, 0)])


def G():
    return cari("G", "Gökhan Arslan", "0538 777 88 99", [("2026-10-13", 20, 0)])


def baslat(t, etiket, secim, sablon="ekstre", donem=EKIM, **kw):
    o = {"t": t, "tur": "baslat", "etiket": etiket, "secim": list(secim), "sablon": sablon, **kw}
    if sablon == "ekstre":
        o["donem"] = donem
    return o


def kontrol(t, ad):
    return {"t": t, "tur": "kontrol", "ad": ad}


def olay(t, tur, **kw):
    return {"t": t, "tur": tur, **kw}


def ay_kova(teslim):
    return {"teslim": teslim, "yaklasik_usd": f"{0.0009 * teslim:.4f}"}


SENARYOLAR = []


def S(ad, baslik, aciklama, kaynak, cariler, olaylar, elle, **kw):
    SENARYOLAR.append({"ad": ad, "baslik": baslik, "aciklama": aciklama, "kaynak": kaynak, "baslangic": kw.pop("baslangic", T0),
                       "cariler": cariler, "olaylar": olaylar, "elle": [({}, elle)], **kw})


# ======================================================================== TEMEL
S("TEMEL-01-ekstre-uc-kisi", "TEMEL", "Seç → Gönder: üç cari, her birine dönemli ekstre PDF + şablon; teslim kancası", "§1, §2.2–2.3, §6 W2–W5, §11 S3, §7a 21/23",
  [A(), B(), C()], [baslat("+0s", "T1", "ABC"), kontrol("+1h", "K1")],
  {"isler.T1/A.durum": "Teslim Edildi", "isler.T1/A.telefon": "+905321112233",
   "isler.T1/A.degiskenler": ["Ayşe Yılmaz", FIRMA, DON, "1.250,00 TL"],
   "isler.T1/A.pdf": {"cari_ad": "Ayşe Yılmaz", "donem_bas": "2026-10-01", "donem_son": "2026-10-31", "devir": "1000.00", "hareket_sayisi": 2, "donem_sonu_bakiye": "1250.00"},
   "isler.T1/B.degiskenler": ["Mehmet Kaya", FIRMA, DON, "2.000,00 TL"],
   "isler.T1/C.degiskenler": ["Zeynep Demir", FIRMA, DON, "0,00 TL"],
   "isler.T1/C.pdf": {"cari_ad": "Zeynep Demir", "donem_bas": "2026-10-01", "donem_son": "2026-10-31", "devir": "0.00", "hareket_sayisi": 0, "donem_sonu_bakiye": "0.00"},
   "isler.T1/A.dosya_adi": {"on_ek": "Ekstre Ayşe Yılmaz ", "son_ek": ".pdf"},
   "isler.T1/A.sablon": "destekofis_ekstre", "isler.T1/A.hata_kodu": None,
   "meta.post": {"A": 1, "B": 1, "C": 1}, "meta.medya_yukleme": {"A": 1, "B": 1, "C": 1}, "meta.medya_silme": {"A": 1, "B": 1, "C": 1},
   "bu_ay": {"W1": {"2026-10": ay_kova(3)}}, "kontroller.K1.durum_sayilari": {"Teslim Edildi": 3}},
  meta_davranis={"kanca": {"*": K_STD}})

S("TEMEL-02-odeme-hatirlatma", "TEMEL", "Ödeme hatırlatma: {{3}} en eski gecikmiş vade, {{4}} vadesi geçmiş toplam, {{5}} güncel bakiye; gecikmişi olmayan elenir (vadesi bugün olan gecikmiş değil)",
  "§1, §6 W5, §7a 20",
  [A(vadeler=[{"vade": "2026-09-30", "kalan": 0}, {"vade": "2026-10-20", "kalan": 200}, {"vade": "2026-10-10", "kalan": 500}, {"vade": "2026-11-15", "kalan": 550}]),
   B(), cari("H", "Hande Vade", "0539 888 99 00", [("2026-10-01", 300, 0)], vadeler=[{"vade": "2026-10-30", "kalan": 300}])],
  [baslat("+0s", "T1", ["A", "B", "H"], sablon="hatirlatma")],
  {"isler.T1/A.sablon": "destekofis_odeme_hatirlatma",
   "isler.T1/A.degiskenler": ["Ayşe Yılmaz", FIRMA, "10.10.2026", "700,00 TL", "1.250,00 TL"],
   "elenen.T1": {"B": "gecikmis_borc_yok", "H": "gecikmis_borc_yok"}, "toplular.T1.is_sayisi": 1,
   "isler.T1/A.pdf": None, "meta.medya_yukleme": {"A": 0}, "meta.toplam_medya_yukleme": 0, "meta.post": {"A": 1},
   "durum_sayilari": {"Teslim Edildi": 1}},
  meta_davranis={"kanca": {"*": K_STD}})

S("TEMEL-03-okundu-teslimsiz", "TEMEL", "Meta delivered göndermeden read gönderebilir (belge): Okundu = teslim edildi sayılır", "§6 W2, §7a 19, Meta status webhook",
  [A()], [baslat("+0s", "T1", "A")],
  {"isler.T1/A.durum": "Okundu", "bu_ay.W1.2026-10": ay_kova(1), "meta.medya_silme": {"A": 1}},
  meta_davranis={"kanca": {"A": [["sent", "+1s"], ["read", "+10s"]]}})

S("TEMEL-04-sirasiz-kanca", "TEMEL", "Kancalar sırasız: read → delivered → sent; durum yalnız ileri", "§6 W2, §7a 18",
  [A()], [baslat("+0s", "T1", "A")],
  {"isler.T1/A.durum": "Okundu", "bu_ay.W1.2026-10": ay_kova(1), "meta.medya_silme": {"A": 1}},
  meta_davranis={"kanca": {"A": [["read", "+3s"], ["delivered", "+4s"], ["sent", "+5s"]]}})

S("TEMEL-05-teslimden-sonra-failed", "TEMEL", "delivered'dan SONRA gelen failed yok sayılır", "§7a 18",
  [A()], [baslat("+0s", "T1", "A")],
  {"isler.T1/A.durum": "Teslim Edildi", "isler.T1/A.hata_kodu": None, "bu_ay.W1.2026-10": ay_kova(1)},
  meta_davranis={"kanca": {"A": [["sent", "+1s"], ["delivered", "+5s"], ["failed", "+10s", {"kod": 131026}]]}})

# ======================================================================== ÇİFT
S("CIFT-01-zaman-asimi-meta-aldi", "ÇİFT", "Yanıt gelmedi ama Meta iletiyi aldı: Sonucu Belirsiz, yeniden GÖNDERİLMEZ; imzalı kanca iş kimliğiyle (opaque) gelir, iş çözülür ve sayaca girer",
  "§6 W2 ÇİFT GÖNDERİM YOK; §3; §7a 3, 19", [A()], [baslat("+0s", "T1", "A")],
  {"meta.post": {"A": 1}, "meta.toplam_meta_ileti": 1, "isler.T1/A.durum": "Teslim Edildi", "meta.kabul": {"A": 1}, "meta.medya_silme": {"A": 1},
   "bu_ay": {"W1": {"2026-10": ay_kova(1)}}},
  meta_davranis={"mesaj": {"A": ["yanitsiz_kabul"]}, "kanca": {"A": K_STD}})

S("CIFT-02-yanitsiz-yine-de-gonder", "ÇİFT", "Meta almadı, yanıt yok → Sonucu Belirsiz; kullanıcı 'Yine de Gönder' → ikinci POST, aynı (geçerli) medya",
  "§6 W2, W4 'Yine de Gönder'; §7a 15", [A()],
  [baslat("+0s", "T1", "A"), kontrol("+30m", "K1"), olay("+1h", "yine_de_gonder", toplu="T1", cari="A")],
  {"meta.post": {"A": 2}, "meta.toplam_meta_ileti": 1, "isler.T1/A.durum": "Teslim Edildi",
   "kontroller.K1.isler": {"T1/A": "Sonucu Belirsiz"}, "kontroller.K1.toplam_post": 1, "meta.medya_yukleme": {"A": 1}, "meta.medya_silme": {"A": 1}},
  meta_davranis={"mesaj": {"A": ["yanitsiz_red"]}, "kanca": {"A": K_STD}})

S("CIFT-03-yine-de-gonder-cift-gider", "ÇİFT", "Meta aldı, yanıt kayboldu, kancası gelmedi, kullanıcı 'Yine de Gönder': Meta'da İKİ ileti (uyarının nedeni)",
  "§6 W2 ('çift gidebilir' uyarısı)", [A()],
  [baslat("+0s", "T1", "A"), olay("+1h", "yine_de_gonder", toplu="T1", cari="A")],
  {"meta.post": {"A": 2}, "meta.toplam_meta_ileti": 2, "meta.kabul": {"A": 1}, "isler.T1/A.durum": "Teslim Edildi", "meta.medya_yukleme": {"A": 1}},
  meta_davranis={"mesaj": {"A": ["yanitsiz_kabul"]}, "kanca": {"A": {"2": K_STD}}})

S("CIFT-04-cokme-istek-ulasti", "ÇİFT", "'Gönderiliyor' anında süreç öldü (istek Meta'ya ulaştı); açılış: o iş Sonucu Belirsiz, toplu iş sürer, Meta'nın imzalı kancası işi çözer",
  "§6 W2, §8 ÇİFT, §7a 3/10", [A(), B(), C()],
  [baslat("+0s", "T1", "ABC"), {"tur": "cokme", "cari": "B", "istek_ulasti": True}, olay("cokme+10m", "ac"), olay("cokme+11m", "kanca_kuyrugu")],
  {"meta.post": {"A": 1, "B": 1, "C": 1}, "meta.toplam_meta_ileti": 3, "meta.kabul": {"A": 1, "B": 1, "C": 1},
   "durum_sayilari": {"Teslim Edildi": 3}, "bu_ay.W1.2026-10": ay_kova(3)},
  meta_davranis={"kanca": {"*": K_STD}})

S("CIFT-05-cokme-istek-ulasmadi", "ÇİFT", "'Gönderiliyor' yazıldı, istek gitmeden süreç öldü: yine Sonucu Belirsiz (program bilemez), Meta'da ileti yok; toplu iş sürer",
  "§6 W2, §7a 10", [A(), B(), C()],
  [baslat("+0s", "T1", "ABC"), {"tur": "cokme", "cari": "B", "istek_ulasti": False}, olay("cokme+5m", "ac"), olay("cokme+6m", "kanca_kuyrugu")],
  {"meta.post": {"A": 1, "B": 0, "C": 1}, "isler.T1/B.durum": "Sonucu Belirsiz", "meta.medya_yukleme.B": 1, "meta.medya_silme.B": 0,
   "meta.toplam_meta_ileti": 2, "isler.T1/A.durum": "Teslim Edildi", "isler.T1/C.durum": "Teslim Edildi"},
  meta_davranis={"kanca": {"*": K_STD}})

S("CIFT-06-cift-tik", "ÇİFT", "Çift tık: aynı istek kimliğiyle iki başlatma → tek toplu iş", "§8 ÇİFT, §7a 9",
  [A(), B()], [baslat("+0s", "T1", "AB", istek="R1"), baslat("+200ms", "T2", "AB", istek="R1")],
  {"ayni_istek": {"T2": "T1"}, "toplular": {"T1": {"durum": "aktif", "neden": None, "is_sayisi": 2}}, "meta.post": {"A": 1, "B": 1}},
  meta_davranis={"kanca": {"*": K_STD}})

S("CIFT-07-iki-sekme", "ÇİFT", "İki sekme (ayrı istek) 5 sn arayla aynı seçim, sınır 1: bekleyen B ve C 'Zaten Kuyrukta', gönderilmiş A 'Daha Önce Gönderildi' (varsayılan Bunları Çıkar) → ikinci toplu iş oluşmaz",
  "§8 ÇİFT, §7a 9, §7a R3, §7a 31", [A(), B(), C()], [baslat("+0s", "T1", "ABC", istek="R1"), baslat("+5s", "T2", "ABC", istek="R2"), kontrol("+1h", "K1")],
  {"elenen.T2": {"A": "daha_once_gonderildi", "B": "zaten_kuyrukta", "C": "zaten_kuyrukta"}, "olusmadi": ["T2"], "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}},
   "kontroller.K1.toplam_post": 1, "meta.post": {"A": 1, "B": 1, "C": 1}, "durum_sayilari": {"Teslim Edildi": 3}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("CIFT-07b-iki-sekme-yine-de-gonder", "ÇİFT", "CIFT-07 + kullanıcı uyarıda 'Yine de Gönder' seçti: gönderilmiş A'ya İKİNCİ ileti; bekleyenler yine 'Zaten Kuyrukta'",
  "§7a 9, §7a R3 (açık bayrak)", [A(), B(), C()], [baslat("+0s", "T1", "ABC", istek="R1"), baslat("+5s", "T2", "ABC", istek="R2", onceki="gonder"), kontrol("+1h", "K1")],
  {"elenen.T2": {"B": "zaten_kuyrukta", "C": "zaten_kuyrukta"}, "toplular.T2.is_sayisi": 1, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}},
   "kontroller.K1.toplam_post": 2, "meta.post": {"A": 2, "B": 1, "C": 1}, "durum_sayilari": {"Teslim Edildi": 4}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("CIFT-08-iki-kullanici-ayni-cari", "ÇİFT", "İki kullanıcı, çakışan cari (B) sınırda bekliyor — B'ye tek ileti", "§8 ÇİFT, §7a 9 (iki kullanıcı dahil)",
  [A(), B(), C()], [baslat("+0s", "T1", "AB"), baslat("+1s", "T2", "BC", kullanici="muhasebe")],
  {"elenen.T2": {"B": "zaten_kuyrukta"}, "meta.post": {"A": 1, "B": 1, "C": 1}, "isler.T2/C.durum": "Teslim Edildi", "toplular.T2.is_sayisi": 1},
  ayar={"gunluk_ust_sinir": 1}, kullanicilar={"yonetici": {"whatsapp.send": True}, "muhasebe": {"whatsapp.send": True}}, meta_davranis={"kanca": {"*": K_STD}})

S("CIFT-09-basarisizlari-yeniden-dene", "ÇİFT", "'Başarısızları Yeniden Dene' yalnız kesin Başarısız'ı gönderir (silinmiş PDF yeniden yüklenir); kabul edilmiş ve Sonucu Belirsiz'e dokunmaz",
  "§6 W4, §7a 15/32", [A(), B(), C()],
  [baslat("+0s", "T1", "ABC"), kontrol("+30m", "K1"), olay("+1h", "basarisizlari_yeniden_dene", toplu="T1")],
  {"kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Başarısız", "T1/C": "Sonucu Belirsiz"},
   "meta.post": {"A": 1, "B": 2, "C": 1}, "isler.T1/B.durum": "Teslim Edildi", "isler.T1/B.hata_kodu": None, "isler.T1/C.durum": "Sonucu Belirsiz",
   "meta.medya_yukleme": {"A": 1, "B": 2, "C": 1}, "meta.medya_silme": {"A": 1, "B": 2, "C": 0}},
  meta_davranis={"mesaj": {"B": [{"hata": 131009}], "C": ["yanitsiz_red"]}, "kanca": {"*": K_STD}})

S("CIFT-10-yinelenen-kanca", "ÇİFT", "Meta aynı kancayı birçok kez gönderir: etkisiz; teslim bir kez sayılır, PDF bir kez silinir",
  "§6 W9 'yinelenen olay etkisiz', Meta 7 gün yeniden deneme", [A()], [baslat("+0s", "T1", "A")],
  {"isler.T1/A.durum": "Okundu", "bu_ay.W1.2026-10": ay_kova(1), "meta.medya_silme": {"A": 1}},
  meta_davranis={"kanca": {"A": [["sent", "+1s", {"tekrar": 2}], ["delivered", "+5s", {"tekrar": 3}], ["read", "+1m", {"tekrar": 2}]]}})

S("CIFT-11-medya-yanitsiz", "ÇİFT", "Medya yükleme yanıtsız → yeniden yüklenir; ileti bir kez", "§6 W2, §7a 15", [A()], [baslat("+0s", "T1", "A")],
  {"meta.toplam_medya_yukleme": 2, "meta.medya_yukleme": {"A": 1}, "meta.post": {"A": 1}, "isler.T1/A.durum": "Teslim Edildi", "meta.medya_silme": {"A": 1}},
  meta_davranis={"medya": ["yanitsiz", "kabul"], "kanca": {"*": K_STD}})

S("CIFT-12-geri-yukleme-dirilmez", "ÇİFT", "Günlük üst sınır 2; yedekten geri yükleme: bekleyenler 'Durduruldu (Geri Yükleme)', makine sayacı azalmaz",
  "§6 W2, §7a 26", [A(), B(), C(), D(), E(), F(), G()],
  [baslat("+0s", "T1", "ABCDE"), olay("+1h", "geri_yukle"), baslat("+2h", "T2", "FG"), kontrol("+23h", "K1"), kontrol("+25h", "K2")],
  {"kontroller.K1.toplam_post": 2,
   "kontroller.K1.durum_sayilari": {GERI: 3, "Sınır Nedeniyle Bekliyor": 2, "Teslim Edildi": 2},
   "kontroller.K2.toplam_post": 4, "meta.toplam_post": 4, "isler.T2/F.durum": "Teslim Edildi", "isler.T2/G.durum": "Teslim Edildi",
   "durum_sayilari": {GERI: 3, "Teslim Edildi": 4}},
  ayar={"gunluk_ust_sinir": 2}, meta_davranis={"kanca": {"*": K_STD}})

S("CIFT-13-veri-tasindi", "ÇİFT", "Veri başka makineye taşındı: bitmemiş işler 'Taşınan Veri — Durduruldu', gönderim yok", "§6 W2",
  [A(), B(), C()], [baslat("+0s", "T1", "ABC"), olay("+1h", "tasindi"), kontrol("+30h", "K1")],
  {"kontroller.K1.toplam_post": 1, "meta.toplam_post": 1, "durum_sayilari": {"Taşınan Veri — Durduruldu": 2, "Teslim Edildi": 1}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("CIFT-15-daha-once-basarisiz", "ÇİFT", "Önceki toplu işte A Başarısız (131026), B Teslim Edildi; aynı dönem yeniden: A gider, B 'Daha Önce Gönderildi'",
  "§7a R3 (kâhin yorumu: Başarısız 'gönderilmiş' sayılmaz)", [A(), B()], [baslat("+0s", "T1", "AB"), baslat("+1h", "T2", "AB")],
  {"elenen.T2": {"B": "daha_once_gonderildi"}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}}, "toplular.T2.is_sayisi": 1,
   "meta.post": {"A": 2, "B": 1}, "isler.T2/A.durum": "Başarısız", "isler.T2/A.hata_kodu": 131026},
  meta_davranis={"kanca": {"A": [["sent", "+1s"], ["failed", "+3s", {"kod": 131026}]], "B": K_STD}})

S("CIFT-16-daha-once-suresi-doldu", "ÇİFT", "Önceki ileti Süresi Doldu (teslim edilmedi); aynı dönem yeniden: gider (kâhin yorumu: Süresi Doldu 'gönderilmiş' sayılmaz)",
  "§7a R3, §7a 16", [A()], [baslat("+0s", "T1", "A"), kontrol("+3d2h", "K1"), baslat("+4d", "T2", "A")],
  {"kontroller.K1.isler": {"T1/A": "Süresi Doldu"}, "elenen": {}, "onceki_uyari": {}, "meta.post": {"A": 2}, "isler.T2/A.durum": "Süresi Doldu"},
  meta_davranis={"kanca": {"A": [["sent", "+1s"]]}})

S("CIFT-17-baska-donem", "ÇİFT", "Eylül ekstresi gönderilmiş cariye Ekim ekstresi: başka dönem, uyarı yok", "§7a R3 (aynı dönem)",
  [A()], [baslat("+0s", "T1", "A", donem=EYLUL), baslat("+1h", "T2", "A")],
  {"elenen": {}, "onceki_uyari": {}, "meta.post": {"A": 2}, "durum_sayilari": {"Teslim Edildi": 2}},
  meta_davranis={"kanca": {"*": K_STD}})

S("CIFT-14-geri-yukleme-sonra-baslat", "ÇİFT", "Geri yüklemeyle duran işin carisi yeniden seçilir: duran iş 'Zaten Kuyrukta' saymaz, yeni iş gider",
  "§7a 9 + 26 (Durduruldu bekleyen/gönderilmekte değil)", [A(), B()],
  [baslat("+0s", "T1", "AB"), olay("+1h", "geri_yukle"), baslat("+2h", "T2", "B"), kontrol("+3h", "K1")],
  {"kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": GERI, "T2/B": "Sınır Nedeniyle Bekliyor"}, "elenen": {},
   "meta.post": {"A": 1, "B": 1}, "isler.T2/B.durum": "Teslim Edildi"},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

# ======================================================================== KAYIP
S("KAYIP-01-kapaliyken-kanca", "KAYIP", "Program kapalıyken gelen teslim kancası: Meta yeniden dener, açılınca işlenir", "§3 C, Meta 7 gün",
  [A(), B()], [baslat("+0s", "T1", "AB"), olay("+1h", "kapat"), kontrol("+2h30m", "K1"), olay("+3h", "ac"), olay("+3h1m", "kanca_kuyrugu"), kontrol("+3h30m", "K2")],
  {"kontroller.K1.durum_sayilari": {"Gönderildi": 2}, "kontroller.K1.medya_silme": 0,
   "kontroller.K2.durum_sayilari": {"Teslim Edildi": 2}, "kontroller.K2.medya_silme": 2},
  meta_davranis={"kanca": {"*": [["sent", "+1s"], ["delivered", "+2h"]]}})

S("KAYIP-02-sekiz-gun-kapali", "KAYIP", "Program 8 gün kapalı: kanca 7 günde düştü, hiç kanca işlenmedi (kanca yolu yok) → 'Meta Kabul Etti'de kalır, PDF silinmez",
  "§3 C eksi, §7a 16", [A()], [baslat("+0s", "T1", "A"), olay("+1h", "kapat"), olay("+8d", "ac"), olay("+8d1m", "kanca_kuyrugu"), kontrol("+8d2m", "K1")],
  {"isler.T1/A.durum": "Meta Kabul Etti", "kontroller.K1.isler": {"T1/A": "Meta Kabul Etti"}, "meta.medya_silme": {"A": 0}, "bu_ay": {}},
  meta_davranis={"kanca": {"A": [["delivered", "+2h"]]}})

S("KAYIP-03-tunel-kapali", "KAYIP", "Tünel kapalıyken gönderim sürer, kancalar Meta kuyruğunda bekler", "§6 W9 (tünel kuralı), §3 C",
  [A()], [olay("+0s", "tunel", acik=False), baslat("+0s", "T1", "A"), kontrol("+30m", "K1"), olay("+1h", "tunel", acik=True), olay("+1h1m", "kanca_kuyrugu")],
  {"kontroller.K1.isler": {"T1/A": "Meta Kabul Etti"}, "isler.T1/A.durum": "Teslim Edildi"},
  meta_davranis={"kanca": {"*": K_STD}})

S("KAYIP-04-guncelleme-kapat-ac", "KAYIP", "Güncelleme kurulumu (düzgün kapanış) gönderim sırasında: kaldığı yerden sürer, çift yok", "§6 W2, §8 KAYIP",
  [A(), B(), C(), D()], [baslat("+0s", "T1", "ABCD"), olay("+3s", "kapat"), olay("+10m", "ac"), olay("+10m1s", "kanca_kuyrugu"), kontrol("+20m", "K1")],
  {"meta.post": {"A": 1, "B": 1, "C": 1, "D": 1}, "kontroller.K1.durum_sayilari": {"Teslim Edildi": 4}},
  meta_davranis={"kanca": {"*": K_STD}})

S("KAYIP-05-meta-ulasilamaz", "KAYIP", "Meta'ya bağlantı hiç kurulamıyor 1 saat: iş Başarısız OLMAZ; toplu iş 'Bağlantı Bekleniyor', bağlantı dönünce kendiliğinden sürer",
  "§7a 11, R1", [A()], [olay("+0s", "meta_kapali", kapali=True), baslat("+0s", "T1", "A"), kontrol("+10m", "K0"), kontrol("+50m", "K1"), olay("+1h", "meta_kapali", kapali=False),
                         kontrol("+1h30m", "K2")],
  {"kontroller.K0.isler": {"T1/A": "Bekliyor"}, "kontroller.K0.toplular": {"T1": "baglanti_bekleniyor"}, "kontroller.K1.isler": {"T1/A": "Bekliyor"},
   "kontroller.K1.toplular": {"T1": "baglanti_bekleniyor"}, "kontroller.K1.toplam_post": 0, "kontroller.K1.medya_silme": 0,
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi"}, "kontroller.K2.toplular": {"T1": "aktif"},
   "isler.T1/A.durum": "Teslim Edildi", "isler.T1/A.hata_kodu": None, "meta.post": {"A": 1}, "meta.toplam_medya_yukleme": 1, "toplular.T1": {"durum": "aktif", "neden": None, "is_sayisi": 1}},
  meta_davranis={"kanca": {"*": K_STD}})

S("KAYIP-06-meta-ulasilamaz-uc-kisi", "KAYIP", "Meta'ya ulaşılamıyor, üç cari: bağlantı hataları '5 art arda'ya sayılmaz, kimse Başarısız olmaz; toplu iş 'Bağlantı Bekleniyor'da bekler, dönünce üçü de gider",
  "§6 W2, §7a 11, 15, R1", [A(), B(), C()],
  [olay("+0s", "meta_kapali", kapali=True), baslat("+0s", "T1", "ABC"), kontrol("+10m", "K1"), olay("+1h", "meta_kapali", kapali=False), kontrol("+2h", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Bekliyor", "T1/B": "Bekliyor", "T1/C": "Bekliyor"}, "kontroller.K1.toplam_post": 0, "kontroller.K1.toplular": {"T1": "baglanti_bekleniyor"},
   "toplular.T1.neden": None, "meta.post": {"A": 1, "B": 1, "C": 1}, "kontroller.K2.durum_sayilari": {"Teslim Edildi": 3}},
  meta_davranis={"kanca": {"*": K_STD}})

S("KAYIP-07-baglanti-arada-koptu", "KAYIP", "B iki geçici hata (Meta yanıt verdi) aldıktan sonra internet koptu: bekleme deneme sayacını ARTIRMAZ; dönünce üçüncü hata + kabul (Başarısız değil)",
  "§7a 15, R1", [A(), B()],
  [baslat("+0s", "T1", "AB"), olay("+1m", "meta_kapali", kapali=True), kontrol("+20m", "K1"), olay("+30m", "meta_kapali", kapali=False), kontrol("+1h30m", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Bekliyor"}, "kontroller.K1.toplular": {"T1": "baglanti_bekleniyor"}, "kontroller.K1.toplam_post": 3,
   "kontroller.K2.toplam_post": 5, "kontroller.K2.isler.T1/B": "Teslim Edildi",
   "isler.T1/B.durum": "Teslim Edildi", "isler.T1/B.hata_kodu": None, "meta.post": {"A": 1, "B": 4}, "toplular.T1.durum": "aktif"},
  meta_davranis={"mesaj": {"B": [{"hata": 131000}] * 3}, "kanca": {"*": K_STD}})

# ======================================================================== YANLIŞ KİŞİ
S("KISI-01-telefon-kuyrukta-degisti", "YANLIŞ KİŞİ", "Sınır nedeniyle bekleyen işin carisinin telefonu değişti: gönderim anındaki numara", "§8 YANLIŞ KİŞİ, §7a 1",
  [A(), B()], [baslat("+0s", "T1", "A"), baslat("+1s", "T2", "B"), olay("+1h", "cari", id="B", telefon="0533 999 88 77"), kontrol("+2h", "K1")],
  {"meta.post": {"A": 1, "B": 1}, "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T2/B": "Sınır Nedeniyle Bekliyor"}, "isler.T2/B.telefon": "+905339998877"},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("KISI-02-ayni-adli-iki-cari", "YANLIŞ KİŞİ", "Aynı adlı iki cari: her biri kendi numarasına, kendi bakiyesiyle", "§8 YANLIŞ KİŞİ, CLAUDE.md test kuralı",
  [cari("X1", "Ali Veli", "0535 111 11 11", [("2026-10-02", 100, 0)]), cari("X2", "Ali Veli", "0536 222 22 22", [("2026-10-03", 900, 0)])],
  [baslat("+0s", "T1", ["X1", "X2"])],
  {"isler.T1/X1.telefon": "+905351111111", "isler.T1/X2.telefon": "+905362222222",
   "isler.T1/X1.degiskenler": ["Ali Veli", FIRMA, DON, "100,00 TL"], "isler.T1/X2.degiskenler": ["Ali Veli", FIRMA, DON, "900,00 TL"],
   "isler.T1/X1.pdf.donem_sonu_bakiye": "100.00", "isler.T1/X2.pdf.donem_sonu_bakiye": "900.00", "meta.post": {"X1": 1, "X2": 1}},
  meta_davranis={"kanca": {"*": K_STD}})

S("KISI-03-ayni-kisi-iki-kez", "YANLIŞ KİŞİ", "Seçimde aynı cari iki kez: tek iş (UNIQUE batch+account)", "§6 W2 göç",
  [A(), B()], [baslat("+0s", "T1", ["A", "A", "B"])],
  {"toplular.T1.is_sayisi": 2, "meta.post": {"A": 1, "B": 1}}, meta_davranis={"kanca": {"*": K_STD}})

S("KISI-04-hucrede-iki-numara", "YANLIŞ KİŞİ", "Telefon hücresinde iki numara ('/'): ilki", "§8, §7a 7",
  [A(telefon="0532 111 22 33 / 0533 444 55 66")], [baslat("+0s", "T1", "A")],
  {"isler.T1/A.telefon": "+905321112233", "meta.post": {"A": 1}}, meta_davranis={"kanca": {"*": K_STD}})

S("KISI-05-sabit-hat", "YANLIŞ KİŞİ", "Sabit hat ELENMEZ (Meta karar verir): kabul, kancada 131026 → Başarısız, PDF silinir", "§8, §2.7, §7a 6 (K1)",
  [cari("L", "Lale Kaya", "0212 555 11 22", [("2026-10-01", 10, 0)])], [baslat("+0s", "T1", ["L"])],
  {"isler.T1/L.durum": "Başarısız", "isler.T1/L.hata_kodu": 131026, "isler.T1/L.telefon": "+902125551122", "meta.medya_silme": {"L": 1}, "elenen": {}, "bu_ay": {}},
  meta_davranis={"kanca": {"L": [["sent", "+1s"], ["failed", "+3s", {"kod": 131026}]]}})

S("KISI-06-yurt-disi", "YANLIŞ KİŞİ", "Yurt dışı numara (+49) ELENMEZ", "§8, §7a 6 (K1)",
  [cari("Y", "Yusuf Kurt", "+49 151 2345 6789", [("2026-10-01", 10, 0)])], [baslat("+0s", "T1", ["Y"])],
  {"isler.T1/Y.telefon": "+4915123456789", "isler.T1/Y.durum": "Teslim Edildi", "elenen": {}},
  meta_davranis={"kanca": {"*": K_STD}})

S("KISI-07-telefonsuz-gecersiz", "YANLIŞ KİŞİ", "Telefonsuz / rakamsız hücreler ve E.164'e çevrilemeyen numaralar elenir", "§6 W4 özet, §7a 6",
  [A(), cari("N1", "Nur Ak", None), cari("N2", "Naz Bal", "-"), cari("N3", "Nil Can", "   "), cari("N4", "Nihat Dal", "yok"),
   cari("N5", "Nevin Ek", "123"), cari("N6", "Necla Fe", "0532 111")],
  [baslat("+0s", "T1", ["A", "N1", "N2", "N3", "N4", "N5", "N6"])],
  {"elenen.T1": {"N1": "telefonsuz", "N2": "telefonsuz", "N3": "telefonsuz", "N4": "telefonsuz", "N5": "gecersiz", "N6": "gecersiz"},
   "meta.post": {"A": 1}, "toplular.T1.is_sayisi": 1},
  meta_davranis={"kanca": {"*": K_STD}})

S("KISI-08-istemiyor", "YANLIŞ KİŞİ", "'WhatsApp Mesajı İstemiyor' işaretli cari toplu gönderimden çıkar", "§1, W6",
  [A(), B(istemiyor=True), C()], [baslat("+0s", "T1", "ABC")],
  {"elenen.T1": {"B": "istemiyor"}, "meta.post": {"A": 1, "C": 1}}, meta_davranis={"kanca": {"*": K_STD}})

S("KISI-09-istemiyor-sonradan", "YANLIŞ KİŞİ", "Kuyrukta beklerken 'İstemiyor' işaretlendi: Atlandı (neden), ileti yok", "§8 YANLIŞ KİŞİ, §7a 2",
  [A(), B()], [baslat("+0s", "T1", "A"), baslat("+1s", "T2", "B"), olay("+1h", "cari", id="B", istemiyor=True), kontrol("+25h", "K1")],
  {"meta.post": {"A": 1, "B": 0}, "isler.T2/B.durum": "Atlandı", "isler.T2/B.atlanma_nedeni": "istemiyor", "kontroller.K1.isler.T2/B": "Atlandı"},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("KISI-10-silindi-kuyrukta", "YANLIŞ KİŞİ", "Kuyrukta beklerken cari silindi: Atlandı", "§8 YANLIŞ KİŞİ, §7a 2",
  [A(), B()], [baslat("+0s", "T1", "A"), baslat("+1s", "T2", "B"), olay("+1h", "cari", id="B", silindi=True), kontrol("+25h", "K1")],
  {"meta.post": {"A": 1, "B": 0}, "isler.T2/B.durum": "Atlandı", "isler.T2/B.atlanma_nedeni": "silindi", "meta.medya_yukleme.B": 0},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("KISI-11-numara-bicimleri", "YANLIŞ KİŞİ", "Numara her zaman '+' ve ülke koduyla (Meta: '+' yoksa işletme ülke kodu eklenir)", "§2.2, §7a 6",
  [A(telefon="+90 (532) 111-22-33"), B(telefon="0 533 222 33 44"), C(telefon="905343334455"), D(telefon="5354445566"), E(telefon="0090 536 555 66 77")],
  [baslat("+0s", "T1", "ABCDE")],
  {"isler.T1/A.telefon": "+905321112233", "isler.T1/B.telefon": "+905332223344", "isler.T1/C.telefon": "+905343334455",
   "isler.T1/D.telefon": "+905354445566", "isler.T1/E.telefon": "+905365556677", "elenen": {}},
  meta_davranis={"kanca": {"*": K_STD}})

S("KISI-12-ayni-telefon-iki-cari", "YANLIŞ KİŞİ", "Aynı telefonlu iki cari → İKİ ileti (her biri kendi ekstresi); sınır 1'de aynı alıcı pencerede yer tutmaz",
  "§7a 8 (K2), §7a 4", [cari("X1", "Ali Veli", "0535 111 11 11", [("2026-10-02", 100, 0)]), cari("X2", "Veli Ali", "0535 111 11 11", [("2026-10-03", 900, 0)])],
  [baslat("+0s", "T1", ["X1", "X2"]), kontrol("+1h", "K1")],
  {"meta.post": {"X1": 1, "X2": 1}, "isler.T1/X2.telefon": "+905351111111", "isler.T1/X2.degiskenler": ["Veli Ali", FIRMA, DON, "900,00 TL"],
   "kontroller.K1.durum_sayilari": {"Teslim Edildi": 2}, "kontroller.K1.pencere_farkli_alici.W1": 1},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("KISI-13-hepsi-elendi", "YANLIŞ KİŞİ", "Bütün seçilenler elenince toplu iş kaydı OLUŞMAZ; nedenler listelenir", "§7a 31",
  [cari("N1", "Nur Ak", None), B(istemiyor=True), cari("N5", "Nevin Ek", "123")], [baslat("+0s", "T1", ["N1", "B", "N5"])],
  {"olusmadi": ["T1"], "toplular": {}, "elenen.T1": {"N1": "telefonsuz", "B": "istemiyor", "N5": "gecersiz"}, "meta.toplam_post": 0, "meta.toplam_medya_yukleme": 0})

S("KISI-14-ayiricilar", "YANLIŞ KİŞİ", "Hücrede birden çok numara: satır sonu, ';' ve ',' ayırıcıları — ilki", "§7a 7",
  [A(telefon="0532 111 22 33\n0533 444 55 66"), B(telefon="0533 222 33 44; 0533 000 00 00"), C(telefon="0534 333 44 55, 0534 000 00 00")],
  [baslat("+0s", "T1", "ABC")],
  {"isler.T1/A.telefon": "+905321112233", "isler.T1/B.telefon": "+905332223344", "isler.T1/C.telefon": "+905343334455"},
  meta_davranis={"kanca": {"*": K_STD}})

S("KISI-15-pasif", "YANLIŞ KİŞİ", "Pasif cari başlatmada elenir; kuyruktayken pasif yapılan Atlandı", "§7a 2",
  [A(pasif=True), B(), C()], [baslat("+0s", "T1", "ABC"), olay("+1h", "cari", id="C", pasif=True)],
  {"elenen.T1": {"A": "pasif"}, "isler.T1/C.durum": "Atlandı", "isler.T1/C.atlanma_nedeni": "pasif", "meta.post": {"B": 1, "C": 0}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

# ======================================================================== YANLIŞ İÇERİK
P_LISTE = [("P1", "Pınar Bir", [("2026-10-01", 111, 0)], "111,00 TL", "111.00", "0.00", 1),
           ("P2", "Pelin İki", [("2026-10-02", 222.5, 0)], "222,50 TL", "222.50", "0.00", 1),
           ("P3", "Polat Üç", [("2026-10-03", 3333.33, 0)], "3.333,33 TL", "3333.33", "0.00", 1),
           ("P4", "Pakize Dört", [("2026-10-04", 50, 0), ("2026-10-05", 0, 6)], "44,00 TL", "44.00", "0.00", 2),
           ("P5", "Poyraz Beş", [("2026-09-30", 5.05, 0)], "5,05 TL", "5.05", "5.05", 0)]
S("ICERIK-01-pdf-karismasi", "YANLIŞ İÇERİK", "Beş cari, beş ayrı PDF: başka carinin PDF'i/bakiyesi gitmez; metin = PDF", "§6 W2 (aynı cari okuması), W3",
  [cari(i, ad, f"0541 000 00 0{n + 1}", h) for n, (i, ad, h, *_r) in enumerate(P_LISTE)], [baslat("+0s", "T1", [p[0] for p in P_LISTE])],
  {**{f"isler.T1/{i}.degiskenler": [ad, FIRMA, DON, m] for (i, ad, _h, m, *_r) in P_LISTE},
   **{f"isler.T1/{i}.pdf": {"cari_ad": ad, "donem_bas": "2026-10-01", "donem_son": "2026-10-31", "devir": dv, "hareket_sayisi": hs, "donem_sonu_bakiye": b}
      for (i, ad, _h, _m, b, dv, hs) in P_LISTE},
   "meta.medya_yukleme": {p[0]: 1 for p in P_LISTE}},
  meta_davranis={"kanca": {"*": K_STD}})

S("ICERIK-02-devir-ve-donem-uclari", "YANLIŞ İÇERİK", "Devir (dönem öncesi) + ayın 1'i ve son günü dahil, dönem sonundan sonraki (ileri tarihli) hareket hariç",
  "§1 (PDF seçilen döneme uyar), §8 dönem sınırı, §7a 22",
  [cari("Q", "Kemal Uç", "0542 111 22 33", [("2026-09-30", 100, 0), ("2026-10-01", 200, 0), ("2026-10-31", 0, 50), ("2026-11-01", 999, 0)])],
  [baslat("+0s", "T1", ["Q"])],
  {"isler.T1/Q.pdf": {"cari_ad": "Kemal Uç", "donem_bas": "2026-10-01", "donem_son": "2026-10-31", "devir": "100.00", "hareket_sayisi": 2, "donem_sonu_bakiye": "250.00"},
   "isler.T1/Q.degiskenler": ["Kemal Uç", FIRMA, DON, "250,00 TL"]},
  meta_davranis={"kanca": {"*": K_STD}})

S("ICERIK-03-yil-donumu", "YANLIŞ İÇERİK", "1 Ocak 00:00:30'da Aralık ekstresi; 'Bu Ay' Ocak'a (teslim ayı) yazılır", "§8 TARİH / YANLIŞ İÇERİK (yıl dönümü), §7a 19/21",
  [cari("R", "Rana Yıl", "0543 111 22 33", [("2026-11-30", 1000, 0), ("2026-12-01", 0, 400), ("2026-12-31", 50, 0), ("2027-01-01", 7, 0)])],
  [baslat("+0s", "T1", ["R"], donem=ARALIK)],
  {"isler.T1/R.pdf": {"cari_ad": "Rana Yıl", "donem_bas": "2026-12-01", "donem_son": "2026-12-31", "devir": "1000.00", "hareket_sayisi": 2, "donem_sonu_bakiye": "650.00"},
   "isler.T1/R.degiskenler": ["Rana Yıl", FIRMA, "01.12.2026 – 31.12.2026", "650,00 TL"], "bu_ay": {"W1": {"2027-01": ay_kova(1)}}},
  baslangic="2027-01-01T00:00:30+03:00", meta_davranis={"kanca": {"*": K_STD}})

S("ICERIK-04-turkce-emoji-satir-sonu", "YANLIŞ İÇERİK", "Türkçe karakter + emoji korunur; satır sonu/sekme/çok boşluk tek boşluk", "§2.2 değişken temizliği",
  [cari("S", "Şükrü\nÖğüt\t😀   Çağ", "0544 111 22 33", [("2026-10-01", 1, 0)])], [baslat("+0s", "T1", ["S"])],
  {"isler.T1/S.degiskenler": ["Şükrü Öğüt 😀 Çağ", "İzmir Dış Ticaret A.Ş.", DON, "1,00 TL"],
   "isler.T1/S.dosya_adi.on_ek": "Ekstre Şükrü Öğüt 😀 Çağ ", "isler.T1/S.pdf.cari_ad": "Şükrü Öğüt 😀 Çağ"},
  firmalar={"A": "İzmir  Dış\tTicaret\nA.Ş."}, meta_davranis={"kanca": {"*": K_STD}})

UZUN = "Uzun " + "Ad" * 150
S("ICERIK-05-cok-uzun-ad", "YANLIŞ İÇERİK", "305 karakterlik ad: program kısaltabilir (sınır D0), öneki korunur", "§2.2 (D0 uzunluk)",
  [cari("U", UZUN, "0545 111 22 33", [("2026-10-01", 1, 0)])], [baslat("+0s", "T1", ["U"])],
  {"isler.T1/U.degiskenler": [{"kisaltilabilir": UZUN}, FIRMA, DON, "1,00 TL"], "isler.T1/U.dosya_adi.on_ek": {"kisaltilabilir": "Ekstre " + UZUN}},
  meta_davranis={"kanca": {"*": K_STD}})

S("ICERIK-06-eksi-bakiye", "YANLIŞ İÇERİK", "Alacaklı (eksi) bakiye: metin '500,00 TL (Alacaklı)', PDF -500", "§8 YANLIŞ İÇERİK, §7a 22",
  [cari("V", "Veli Alacaklı", "0546 111 22 33", [("2026-10-10", 0, 500)])], [baslat("+0s", "T1", ["V"])],
  {"isler.T1/V.degiskenler": ["Veli Alacaklı", FIRMA, DON, "500,00 TL (Alacaklı)"], "isler.T1/V.pdf.donem_sonu_bakiye": "-500.00"},
  meta_davranis={"kanca": {"*": K_STD}})

S("ICERIK-07-tutar-bicimi", "YANLIŞ İÇERİK", "Tutar biçimi 1.234.567,89 TL / 0,50 TL / 1.000,00 TL; yarım kuruş yukarı (0,005 → 0,01)", "§8 (1.250,00 TL örneği), §7a 22 (2 ondalık)",
  [cari("W1", "Vural Bir", "0547 000 00 01", [("2026-10-01", 1234567.89, 0)]), cari("W2", "Vural İki", "0547 000 00 02", [("2026-10-01", 0.5, 0)]),
   cari("W3", "Vural Üç", "0547 000 00 03", [("2026-10-01", 1000, 0)]), cari("W4", "Vural Dört", "0547 000 00 04", [("2026-10-01", "0.005", 0)])],
  [baslat("+0s", "T1", ["W1", "W2", "W3", "W4"])],
  {"isler.T1/W1.degiskenler": ["Vural Bir", FIRMA, DON, "1.234.567,89 TL"], "isler.T1/W2.degiskenler": ["Vural İki", FIRMA, DON, "0,50 TL"],
   "isler.T1/W3.degiskenler": ["Vural Üç", FIRMA, DON, "1.000,00 TL"], "isler.T1/W4.degiskenler": ["Vural Dört", FIRMA, DON, "0,01 TL"], "isler.T1/W4.pdf.donem_sonu_bakiye": "0.01"},
  meta_davranis={"kanca": {"*": K_STD}})

S("ICERIK-08-tum-hareketler", "YANLIŞ İÇERİK", "'Tüm Hareketler' = bütün hesap (devir 0); dönem metni PLAN SUSUYOR", "§1, §7a 21 (yalnız tarihli dönem)",
  [A()], [baslat("+0s", "T1", "A", donem="tum")],
  {"isler.T1/A.pdf": {"cari_ad": "Ayşe Yılmaz", "donem_bas": None, "donem_son": None, "devir": "0.00", "hareket_sayisi": 3, "donem_sonu_bakiye": "1250.00"},
   "isler.T1/A.degiskenler": ["Ayşe Yılmaz", FIRMA, {"plan_susuyor": "Tüm Hareketler dönem metni"}, "1.250,00 TL"]},
  meta_davranis={"kanca": {"*": K_STD}})

S("ICERIK-09-kuyrukta-bakiye-degisti", "YANLIŞ İÇERİK", "Sınırda beklerken cariye hareket girdi: metin ve PDF gönderim anında AYNI okumadan", "§6 W2 (metin = PDF), §7a 1",
  [A(), B()], [baslat("+0s", "T1", "A"), baslat("+1s", "T2", "B"), olay("+1h", "cari", id="B", hareket_ekle={"tarih": "2026-10-30", "borc": 1000, "alacak": 0})],
  {"isler.T2/B.degiskenler": ["Mehmet Kaya", FIRMA, DON, "3.000,00 TL"], "isler.T2/B.pdf.donem_sonu_bakiye": "3000.00", "isler.T2/B.pdf.hareket_sayisi": 2},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("ICERIK-10-ttl-sonrasi-teslim", "YANLIŞ İÇERİK", "Teslim kancası TTL + 1 sa'ten sonra geldi: önce Süresi Doldu, sonra gerçek bilgi Teslim Edildi; ay = teslim zamanı (Kasım)",
  "§11 S2 A, §7a 16/17/19", [A()], [baslat("+0s", "T1", "A"), kontrol("+72h30m", "K1"), kontrol("+73h30m", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Gönderildi"}, "kontroller.K2.isler": {"T1/A": "Süresi Doldu"}, "meta.medya_silme": {"A": 1},
   "isler.T1/A.durum": "Teslim Edildi", "bu_ay": {"W1": {"2026-11": ay_kova(1)}}},
  meta_davranis={"kanca": {"A": [["sent", "+1s"], ["delivered", "+76h"]]}})

S("ICERIK-11-ttl-icinde-gec-teslim", "YANLIŞ İÇERİK", "Teslim 70. saatte (TTL içinde): Teslim Edildi; 'Bu Ay' teslim ayına (Kasım)", "§11 S2 A, §7a 19",
  [A()], [baslat("+0s", "T1", "A"), kontrol("+73h30m", "K1")],
  {"kontroller.K1.isler": {"T1/A": "Teslim Edildi"}, "bu_ay": {"W1": {"2026-11": ay_kova(1)}}},
  meta_davranis={"kanca": {"A": [["sent", "+1s"], ["delivered", "+70h"]]}})

S("ICERIK-12-hatirlatma-kuyrukta-odendi", "YANLIŞ İÇERİK", "Hatırlatma sınırda beklerken gecikmiş borç ödendi: gönderim anında 'Gecikmiş Borç Yok' → Atlandı",
  "§7a 1, 2, 20", [A(vadeler=[{"vade": "2026-10-10", "kalan": 1250}]), B(vadeler=[{"vade": "2026-10-20", "kalan": 2000}])],
  [baslat("+0s", "T1", "AB", sablon="hatirlatma"), olay("+1h", "cari", id="B", vadeler=[]), kontrol("+25h", "K1")],
  {"isler.T1/A.degiskenler": ["Ayşe Yılmaz", FIRMA, "10.10.2026", "1.250,00 TL", "1.250,00 TL"], "isler.T1/B.durum": "Atlandı",
   "isler.T1/B.atlanma_nedeni": "gecikmis_borc_yok", "meta.post": {"A": 1, "B": 0}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

# ======================================================================== HESAP / META (eşzamanlı hata → İLK hatada DURAKLAR)
for kod in (0, 10, 200, 131005, 368, 131031, 131042, 133010, 131045):
    S(f"HESAP-{kod}", "HESAP / META", f"Hesap/yetki hatası {kod}: toplu iş İLK hatada durur; hatayı alan Başarısız (kodlu), bekleyen Duraklatıldı; Devam Et ile sürer",
      "§6 W2 hata sınıfı, §7a 13", [A(), B(), C()], [baslat("+0s", "T1", "ABC"), kontrol("+30m", "K1"), olay("+1h", "devam", toplu="T1"), kontrol("+2h", "K2")],
      {"kontroller.K1.toplam_post": 2, "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Başarısız", "T1/C": "Duraklatıldı"},
       "isler.T1/B.hata_kodu": kod, "meta.post": {"A": 1, "B": 1, "C": 1}, "meta.medya_silme.B": 1, "toplular.T1.durum": "aktif",
       "durum_sayilari": {"Başarısız": 1, "Teslim Edildi": 2}},
      meta_davranis={"mesaj": {"B": [{"hata": kod}]}, "kanca": {"*": K_STD}})

for kod in (132000, 132001, 132007, 132012, 132015, 132016, 132018):
    S(f"SABLON-GONDERIM-{kod}", "HESAP / META", f"Şablon hatası {kod} gönderimde: toplu iş durur, neden {kod}", "§6 W2, §7a 13",
      [A(), B(), C()], [baslat("+0s", "T1", "ABC")],
      {"toplular.T1": {"durum": "duraklatildi", "neden": kod, "is_sayisi": 3}, "meta.post.B": 1, "isler.T1/B.durum": "Başarısız", "isler.T1/B.hata_kodu": kod,
       "durum_sayilari": {"Başarısız": 1, "Duraklatıldı": 1, "Teslim Edildi": 1}},
      meta_davranis={"mesaj": {"B": {"hata": kod}}, "kanca": {"*": K_STD}})

for kod in (100, 131008, 135000, 131053, 131047, 131050, 131051, 130403, 131064, 131063, 133016, 987654):
    S(f"HATA-SINIFSIZ-{kod}", "HESAP / META", f"Planın sınıflamadığı kod {kod}: o İŞ Başarısız (kodlu), toplu iş sürer", "§7a 12",
      [A(), B(), C()], [baslat("+0s", "T1", "ABC")],
      {"isler.T1/B.durum": "Başarısız", "isler.T1/B.hata_kodu": kod, "toplular.T1.durum": "aktif", "meta.post": {"A": 1, "B": 1, "C": 1},
       "meta.medya_silme.B": 1, "durum_sayilari": {"Başarısız": 1, "Teslim Edildi": 2}},
      meta_davranis={"mesaj": {"B": {"hata": kod}}, "kanca": {"*": K_STD}})

for ad, durum, kategori in (("PENDING", "PENDING", "UTILITY"), ("REJECTED", "REJECTED", "UTILITY"), ("PAZARLAMA", "APPROVED", "MARKETING"),
                            ("DURAKLATILMIS", "PAUSED", "UTILITY"), ("YOK", None, None)):
    S(f"SABLON-BASLATMA-{ad}", "HESAP / META", f"Ekstre şablonu {durum}/{kategori}: gönderim BAŞLAMAZ (medya da yüklenmez)", "§2.4, W5, §7a 27/29",
      [A(), B()], [baslat("+0s", "T1", "AB")],
      {"baslamadi": {"T1": "sablon_uygun_degil"}, "meta.toplam_post": 0, "meta.toplam_medya_yukleme": 0},
      meta={"sablonlar": {"destekofis_ekstre": {"durum": durum, "kategori": kategori}}})

S("SABLON-BASLATMA-YALNIZ-HATIRLATMA", "HESAP / META", "Hatırlatma şablonu Pazarlama'ya alındı: ekstre başlar, hatırlatma başlamaz", "§2.4, §7a 27",
  [A(), B(vadeler=[{"vade": "2026-10-20", "kalan": 2000}])], [baslat("+0s", "T1", "A"), baslat("+1s", "T2", "B", sablon="hatirlatma")],
  {"baslamadi": {"T2": "sablon_uygun_degil"}, "meta.post": {"A": 1}},
  meta={"sablonlar": {"destekofis_odeme_hatirlatma": {"durum": "APPROVED", "kategori": "MARKETING"}}}, meta_davranis={"kanca": {"*": K_STD}})

S("SABLON-SONRAKI-TOPLU", "HESAP / META", "Şablon arada duraklatıldı (Meta): sonraki toplu iş başlarken okunur, başlamaz", "§2.4 (her toplu gönderimden önce)",
  [A(), B()], [baslat("+0s", "T1", "A"), olay("+1h", "meta_sablon", ad="destekofis_ekstre", durum="PAUSED"), baslat("+2h", "T2", "B")],
  {"baslamadi": {"T2": "sablon_uygun_degil"}, "meta.post": {"A": 1}}, meta_davranis={"kanca": {"*": K_STD}})

S("SABLON-PAZARLAMA-ARADA", "HESAP / META", "Toplu iş sürerken şablon Pazarlama'ya alındı: en geç 10 dakikalık okumada iş durur ('Şablon Pazarlama'ya Alındı')", "§7a 27, R2",
  [A(), B(), C()], [baslat("+0s", "T1", "ABC"), olay("+30m", "meta_sablon", ad="destekofis_ekstre", kategori="MARKETING"), kontrol("+2h", "K1")],
  {"toplular.T1": {"durum": "duraklatildi", "neden": "Şablon Pazarlama'ya Alındı", "is_sayisi": 3},
   "kontroller.K1.durum_sayilari": {"Duraklatıldı": 2, "Teslim Edildi": 1}, "meta.post": {"A": 1, "B": 0, "C": 0}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("SABLON-PAZARLAMA-10-DK", "HESAP / META", "Kategori 5. dakikada Pazarlama; B geçici hatayla 17,5. dakikayı bekliyor: 10. dakika okumasında iş durur, B gönderilmez",
  "§7a 27, R2 (en geç 10 dk), §7a 15", [A(), B(), C()],
  [baslat("+0s", "T1", "ABC"), olay("+5m", "meta_sablon", ad="destekofis_ekstre", kategori="MARKETING"), kontrol("+9m", "K0"), kontrol("+20m", "K1"), kontrol("+2h", "K2")],
  {"kontroller.K0.toplular": {"T1": "aktif"}, "kontroller.K1.durum_sayilari": {"Duraklatıldı": 1, "Teslim Edildi": 2},
   "toplular.T1": {"durum": "duraklatildi", "neden": "Şablon Pazarlama'ya Alındı", "is_sayisi": 3}, "meta.post": {"A": 1, "B": 3, "C": 1}},
  meta_davranis={"mesaj": {"B": [{"hata": 131000}] * 3}, "kanca": {"*": K_STD}})

# ---- geçici hatalar
S("GECICI-01-131000-iki-kez", "HESAP / META", "131000 iki kez, sonra kabul: 30 sn → 2 dk bekleme, toplu iş sürer; hata kodu temizlenir", "§6 W2, §7a 15/32",
  [A(), B(), C()], [baslat("+0s", "T1", "ABC"), kontrol("+1m", "K1")],
  {"kontroller.K1.toplam_post": 4, "meta.post": {"A": 1, "B": 3, "C": 1}, "durum_sayilari": {"Teslim Edildi": 3}, "toplular.T1.durum": "aktif",
   "isler.T1/B.hata_kodu": None},
  meta_davranis={"mesaj": {"B": [{"hata": 131000}, {"hata": 131000}]}, "kanca": {"*": K_STD}})

S("GECICI-02-bes-art-arda", "HESAP / META", "Servis sürekli 131016: 5 ardışık geçici hatada toplu iş durur; 5. hatayı alan Başarısız", "§6 W2, §7a 13/15",
  [A(), B(), C()], [baslat("+0s", "T1", "ABC")],
  {"meta.toplam_post": 5, "meta.post": {"A": 2, "B": 2, "C": 1}, "toplular.T1": {"durum": "duraklatildi", "neden": 131016, "is_sayisi": 3},
   "isler.T1/B.durum": "Başarısız", "durum_sayilari": {"Başarısız": 1, "Duraklatıldı": 2}},
  meta_davranis={"mesaj": {"*": {"hata": 131016}}})

S("GECICI-03-uc-sonra-kabul", "HESAP / META", "Üç ardışık geçici hata (30 sn, 2 dk, 15 dk) sonra kabul", "§7a 15",
  [A(), B()], [baslat("+0s", "T1", "AB"), kontrol("+10m", "K1"), kontrol("+20m", "K2")],
  {"kontroller.K1.toplam_post": 4, "kontroller.K2.toplam_post": 5, "meta.post": {"A": 1, "B": 4}, "isler.T1/B.durum": "Teslim Edildi", "toplular.T1.durum": "aktif"},
  meta_davranis={"mesaj": {"B": [{"hata": 131000}] * 3}, "kanca": {"*": K_STD}})

S("GECICI-03b-dort-hata-basarisiz", "HESAP / META", "Dört ardışık geçici hata: 3 yeniden denemeden sonra iş Başarısız (kodlu); toplu iş sürer", "§7a 15",
  [A(), B()], [baslat("+0s", "T1", "AB"), kontrol("+20m", "K1")],
  {"kontroller.K1.isler.T1/B": "Başarısız", "isler.T1/B.hata_kodu": 131000, "meta.post": {"A": 1, "B": 4}, "toplular.T1.durum": "aktif",
   "durum_sayilari": {"Başarısız": 1, "Teslim Edildi": 1}, "meta.medya_silme.B": 1},
  meta_davranis={"mesaj": {"B": [{"hata": 131000}] * 4}, "kanca": {"*": K_STD}})

for kod in (130429, 131057, 80007, 4, 1, 2, 133004):
    S(f"GECICI-{kod}", "HESAP / META", f"Geçici {kod} bir kez: aynı kişi 30 sn bekleyip yeniden", "§6 W2, §7a 12/15",
      [A(), B()], [baslat("+0s", "T1", "AB"), kontrol("+20s", "K1")],
      {"kontroller.K1.isler.T1/B": "Bekliyor", "meta.post": {"A": 1, "B": 2}, "durum_sayilari": {"Teslim Edildi": 2}},
      meta_davranis={"mesaj": {"B": [{"hata": kod}]}, "kanca": {"*": K_STD}})

S("GECICI-131056", "HESAP / META", "131056 (aynı alıcıya kısa sürede çok): o kişi 1 dk sonra; öbürleri sürer", "§6 W2",
  [A(), B(), C()], [baslat("+0s", "T1", "ABC"), kontrol("+50s", "K1"), kontrol("+3m", "K2")],
  {"kontroller.K1.isler.T1/B": "Bekliyor", "kontroller.K2.isler.T1/B": "Teslim Edildi", "meta.post": {"A": 1, "B": 2, "C": 1}},
  meta_davranis={"mesaj": {"B": [{"hata": 131056}]}, "kanca": {"*": K_STD}})

# ---- 131049 ve alıcı hataları
S("ALICI-131049-bir-kez", "HESAP / META", "131049 (ekosistem) kancada: 'Meta Bekletti', PDF silinmez; 24 saat sonra bir kez daha aynı medyayla; ikinci teslim",
  "§6 W2, §7a 14", [A()], [baslat("+0s", "T1", "A"), kontrol("+12h", "K1"), kontrol("+23h", "K2"), kontrol("+25h", "K3")],
  {"kontroller.K1.isler": {"T1/A": BEKLETTI}, "kontroller.K1.toplam_post": 1, "kontroller.K1.medya_silme": 0, "kontroller.K2.toplam_post": 1,
   "kontroller.K3.toplam_post": 2, "isler.T1/A.durum": "Teslim Edildi", "isler.T1/A.hata_kodu": None, "meta.post": {"A": 2}, "meta.kabul": {"A": 2},
   "bu_ay.W1.2026-10": ay_kova(1), "meta.medya_yukleme": {"A": 1}, "meta.medya_silme": {"A": 1}},
  meta_davranis={"kanca": {"A": {"1": [["failed", "+10s", {"kod": 131049}]], "2": K_STD}}})

S("ALICI-131049-iki-kez", "HESAP / META", "131049 ikinci denemede de: Başarısız (en çok bir kez)", "§6 W2, §7a 14",
  [A()], [baslat("+0s", "T1", "A"), kontrol("+25h", "K1")],
  {"isler.T1/A.durum": "Başarısız", "isler.T1/A.hata_kodu": 131049, "meta.post": {"A": 2}, "kontroller.K1.isler": {"T1/A": "Başarısız"},
   "meta.medya_yukleme": {"A": 1}, "meta.medya_silme": {"A": 1}},
  meta_davranis={"kanca": {"A": {"*": [["failed", "+10s", {"kod": 131049}]]}}})

S("ALICI-131049-esanli", "HESAP / META", "131049 eşzamanlı yanıtta: 24 saat sonra bir kez", "§6 W2, §7a 14",
  [A()], [baslat("+0s", "T1", "A"), kontrol("+12h", "K1"), kontrol("+25h", "K2")],
  {"kontroller.K1.toplam_post": 1, "kontroller.K1.isler": {"T1/A": BEKLETTI}, "kontroller.K2.toplam_post": 2, "isler.T1/A.durum": "Teslim Edildi",
   "meta.medya_yukleme": {"A": 1}},
  meta_davranis={"mesaj": {"A": [{"hata": 131049}]}, "kanca": {"*": K_STD}})

S("ALICI-131026-kancada", "HESAP / META", "WhatsApp kullanmayan numara: kabul edilir, kancada failed 131026 → Başarısız; toplu iş sürer; teslim olmayan 'Bu Ay'a girmez",
  "§2.7, §6 W2, §7a 19", [A(), B()], [baslat("+0s", "T1", "AB")],
  {"isler.T1/B.durum": "Başarısız", "isler.T1/B.hata_kodu": 131026, "meta.medya_silme": {"A": 1, "B": 1}, "isler.T1/A.durum": "Teslim Edildi",
   "bu_ay.W1.2026-10": ay_kova(1)},
  meta_davranis={"kanca": {"A": K_STD, "B": [["sent", "+1s"], ["failed", "+3s", {"kod": 131026}]]}})

S("ALICI-131021-esanli", "HESAP / META", "Alıcı = gönderen (131021): o iş Başarısız, toplu iş sürer", "§6 W2",
  [A(), B(), C()], [baslat("+0s", "T1", "ABC")],
  {"isler.T1/B.durum": "Başarısız", "meta.post": {"A": 1, "B": 1, "C": 1}, "toplular.T1.durum": "aktif", "durum_sayilari": {"Başarısız": 1, "Teslim Edildi": 2}},
  meta_davranis={"mesaj": {"B": [{"hata": 131021}]}, "kanca": {"*": K_STD}})

# ======================================================================== ÖLÇEK / SINIR
def kalabalik(n, on="K"):
    return [cari(f"{on}{i:04d}", f"Kişi {i:04d}", f"0550 000 {i:04d}") for i in range(1, n + 1)]


KAL300 = kalabalik(300)
S("SINIR-01-250-uzeri", "ÖLÇEK", "Basamak 250, 300 kişi: 250'si ilk 24 saatte, 50'si ertesi pencerede kendiliğinden", "§2.5, §6 W2",
  KAL300, [baslat("+0s", "T1", [c["id"] for c in KAL300]), kontrol("+23h", "K1"), kontrol("+25h", "K2")],
  {"kontroller.K1.durum_sayilari": {"Sınır Nedeniyle Bekliyor": 50, "Teslim Edildi": 250}, "kontroller.K1.pencere_farkli_alici.W1": 250,
   "kontroller.K2.durum_sayilari": {"Teslim Edildi": 300}, "kontroller.K2.pencere_farkli_alici.W1": 50, "meta.toplam_post": 300},
  ozet_cikti=True, meta={"basamak": 250}, meta_davranis={"kanca": {"*": K_STD}})

S("SINIR-02-basamak-artti", "ÖLÇEK", "Gönderim sırasında Meta basamağı 2.000'e çıktı: 6 saatlik okumada bekleyenler sürer", "§6 W2 (6 saatte bir)",
  KAL300, [baslat("+0s", "T1", [c["id"] for c in KAL300]), olay("+2h", "meta_basamak", basamak=2000), kontrol("+5h", "K1"), kontrol("+7h", "K2")],
  {"kontroller.K1.durum_sayilari": {"Sınır Nedeniyle Bekliyor": 50, "Teslim Edildi": 250}, "kontroller.K2.durum_sayilari": {"Teslim Edildi": 300}},
  ozet_cikti=True, meta={"basamak": 250}, meta_davranis={"kanca": {"*": K_STD}})

S("SINIR-03-elle-ust-sinir", "ÖLÇEK", "Elle günlük üst sınır 3 (Meta 250): sınır = min", "§6 W2 (dailyCap)",
  [A(), B(), C(), D(), E()], [baslat("+0s", "T1", "ABCDE"), kontrol("+1h", "K1"), kontrol("+25h", "K2")],
  {"kontroller.K1.durum_sayilari": {"Sınır Nedeniyle Bekliyor": 2, "Teslim Edildi": 3}, "kontroller.K2.durum_sayilari": {"Teslim Edildi": 5}},
  ayar={"gunluk_ust_sinir": 3}, meta_davranis={"kanca": {"*": K_STD}})

S("SINIR-04-meta-sinir-hatasi", "ÖLÇEK", "Meta sınır hatası (portföyün başka gönderimi; kod D0): aynı WABA'nın BÜTÜN işleri 24 saat bekler (sonraki toplu iş dahil)",
  "§6 W2, §7a 30", [A(), B(), C(), D(), E()], [baslat("+0s", "T1", "ABCD"), baslat("+2h", "T2", "E"), kontrol("+3h", "K1"), kontrol("+26h", "K2")],
  {"meta.post": {"A": 1, "B": 2, "C": 1, "D": 1, "E": 1}, "kontroller.K2.durum_sayilari": {"Teslim Edildi": 5},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Sınır Nedeniyle Bekliyor", "T1/C": "Sınır Nedeniyle Bekliyor", "T1/D": "Sınır Nedeniyle Bekliyor",
                           "T2/E": "Sınır Nedeniyle Bekliyor"}, "kontroller.K1.toplam_post": 2},
  meta_davranis={"mesaj": {"B": [{"sinir": True}]}, "kanca": {"*": K_STD}})

S("SINIR-05-pencerede-sayili-alici", "ÖLÇEK", "Sınır dolu (2); ikinci toplu iş: A zaten pencerede → GEÇER, C yeni → bekler", "§6 W2 (FARKLI alıcı), §7a 4",
  [A(), B(), C()], [baslat("+0s", "T1", "AB"), baslat("+1h", "T2", "AC", donem=EYLUL), kontrol("+2h", "K1"), kontrol("+25h", "K2")],
  {"kontroller.K1.isler.T2/C": "Sınır Nedeniyle Bekliyor", "kontroller.K1.isler.T2/A": "Teslim Edildi", "kontroller.K2.durum_sayilari": {"Teslim Edildi": 4}},
  ayar={"gunluk_ust_sinir": 2}, meta_davranis={"kanca": {"*": K_STD}})

S("SINIR-06-gece-yarisi-kayan", "TARİH", "Sınır 3, 23:00'te 3 ileti; 00:30'daki toplu iş takvim gününe değil kayan 24 saate bakar", "§6 W2 (kayan 24 saat), §8 TARİH",
  [A(), B(), C(), D(), E()], [baslat("+0s", "T1", "ABC"), baslat("+1h30m", "T2", "DE"), kontrol("+2h", "K1"), kontrol("+23h30m", "K2"), kontrol("+25h", "K3")],
  {"kontroller.K1.durum_sayilari": {"Sınır Nedeniyle Bekliyor": 2, "Teslim Edildi": 3}, "kontroller.K2.durum_sayilari": {"Sınır Nedeniyle Bekliyor": 2, "Teslim Edildi": 3},
   "kontroller.K3.durum_sayilari": {"Teslim Edildi": 5}, "bu_ay.W1.2026-10.teslim": 5},
  baslangic="2026-10-30T23:00:00+03:00", ayar={"gunluk_ust_sinir": 3}, meta_davranis={"kanca": {"*": K_STD}})

S("SINIR-07-131048", "ÖLÇEK", "131048 (spam oranı sınırı): iş beklerken aynı WABA'nın bütün işleri 24 saat bekler; sonra kendiliğinden; hata kodu temizlenir",
  "§7a 12 + 30", [A(), B(), C(), D()], [baslat("+0s", "T1", "ABC"), baslat("+2h", "T2", "D"), kontrol("+3h", "K1"), kontrol("+25h", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Sınır Nedeniyle Bekliyor", "T1/C": "Sınır Nedeniyle Bekliyor", "T2/D": "Sınır Nedeniyle Bekliyor"},
   "kontroller.K2.durum_sayilari": {"Teslim Edildi": 4}, "meta.post": {"A": 1, "B": 2, "C": 1, "D": 1}, "isler.T1/B.hata_kodu": None},
  meta_davranis={"mesaj": {"B": [{"hata": 131048}]}, "kanca": {"*": K_STD}})


def sirket_cari(id_, sirket, tel):
    return cari(id_, f"Cari {id_}", tel, [("2026-10-01", 10, 0)], sirket=sirket)


S("SIRKET-01-ayni-waba", "ŞİRKET", "İki şirket aynı WABA'yı kullanır: sınır sayacı ve 'Bu Ay' ortak (WABA kapsamı)", "§6 W2, §7a 19",
  [sirket_cari("A1", "A", "0551 000 00 01"), sirket_cari("A2", "A", "0551 000 00 02"), sirket_cari("B1", "B", "0552 000 00 01"), sirket_cari("B2", "B", "0552 000 00 02")],
  [baslat("+0s", "T1", ["A1", "A2"], sirket="A"), baslat("+1m", "T2", ["B1", "B2"], sirket="B"), kontrol("+1h", "K1"), kontrol("+25h", "K2")],
  {"kontroller.K1.toplam_kabul": 3, "kontroller.K1.pencere_farkli_alici.W1": 3, "kontroller.K2.toplam_kabul": 4,
   "isler.T1/A1.degiskenler": ["Cari A1", "Alfa Ltd.", DON, "10,00 TL"], "isler.T2/B1.degiskenler": ["Cari B1", "Beta Ltd.", DON, "10,00 TL"],
   "bu_ay": {"W1": {"2026-10": ay_kova(4)}}},
  firmalar={"A": "Alfa Ltd.", "B": "Beta Ltd."}, wabalar={"A": "W1", "B": "W1"}, ayar={"gunluk_ust_sinir": 3},
  meta_davranis={"kanca": {"*": K_STD}})

S("SIRKET-02-ayri-waba", "ŞİRKET", "İki şirket ayrı WABA: sayaçlar ayrı", "§6 W2, §7a 19",
  [sirket_cari("A1", "A", "0551 000 00 01"), sirket_cari("B1", "B", "0552 000 00 01")],
  [baslat("+0s", "T1", ["A1"], sirket="A"), baslat("+1m", "T2", ["B1"], sirket="B"), kontrol("+1h", "K1")],
  {"kontroller.K1.pencere_farkli_alici": {"W1": 1, "W2": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(1)}, "W2": {"2026-10": ay_kova(1)}}},
  firmalar={"A": "Alfa Ltd.", "B": "Beta Ltd."}, wabalar={"A": "W1", "B": "W2"}, meta_davranis={"kanca": {"*": K_STD}})

S("SIRKET-03-sinir-hatasi-ayri-waba", "ŞİRKET", "Meta sınır hatası yalnız o WABA'yı bekletir; öbür şirketin WABA'sı sürer", "§7a 30",
  [sirket_cari("A1", "A", "0551 000 00 01"), sirket_cari("A2", "A", "0551 000 00 02"), sirket_cari("B1", "B", "0552 000 00 01")],
  [baslat("+0s", "T1", ["A1", "A2"], sirket="A"), baslat("+1m", "T2", ["B1"], sirket="B"), kontrol("+1h", "K1")],
  {"kontroller.K1.isler": {"T1/A1": "Sınır Nedeniyle Bekliyor", "T1/A2": "Sınır Nedeniyle Bekliyor", "T2/B1": "Teslim Edildi"}},
  firmalar={"A": "Alfa Ltd.", "B": "Beta Ltd."}, wabalar={"A": "W1", "B": "W2"}, meta_davranis={"mesaj": {"A1": [{"sinir": True}]}, "kanca": {"*": K_STD}})

KAL2000 = kalabalik(2000)
S("OLCEK-01-iki-bin", "ÖLÇEK", "2.000 carilik toplu gönderim (basamak 2.000): her biri bir kez, PDF her biri bir kez silinir", "§8 ÖLÇEK",
  KAL2000, [baslat("+0s", "T1", [c["id"] for c in KAL2000]), kontrol("+3h", "K1")],
  {"kontroller.K1.durum_sayilari": {"Teslim Edildi": 2000}, "kontroller.K1.medya_silme": 2000, "meta.toplam_post": 2000, "meta.toplam_medya_yukleme": 2000,
   "isler_post_dagilimi": {"1": 2000}},
  ozet_cikti=True, meta={"basamak": 2000}, meta_davranis={"kanca": {"*": K_STD}})

KAL600 = kalabalik(600)
S("OLCEK-02-uc-gune-yayilan", "ÖLÇEK", "Basamak 250, 600 kişi: üç güne yayılır (250 / 250 / 100)", "§8 ÖLÇEK (250 sınırında birkaç güne yayılan iş), §7a 24",
  KAL600, [baslat("+0s", "T1", [c["id"] for c in KAL600]), kontrol("+23h", "K1"), kontrol("+25h", "K2"), kontrol("+47h", "K3"), kontrol("+49h", "K4")],
  {"kontroller.K1.durum_sayilari": {"Sınır Nedeniyle Bekliyor": 350, "Teslim Edildi": 250}, "kontroller.K2.durum_sayilari": {"Sınır Nedeniyle Bekliyor": 100, "Teslim Edildi": 500},
   "kontroller.K3.durum_sayilari": {"Sınır Nedeniyle Bekliyor": 100, "Teslim Edildi": 500}, "kontroller.K4.durum_sayilari": {"Teslim Edildi": 600}, "meta.toplam_post": 600},
  ozet_cikti=True, meta={"basamak": 250}, meta_davranis={"kanca": {"*": K_STD}})

KAL500 = kalabalik(500)
S("OLCEK-03-kanca-yagmuru", "ÖLÇEK", "500 ileti × 9 kanca (3× yinelenen, sırasız): son durum Okundu, teslim 500, PDF 500 kez silinir", "§8 ÖLÇEK (kanca yağmuru)",
  KAL500, [baslat("+0s", "T1", [c["id"] for c in KAL500]), kontrol("+2h", "K1")],
  {"kontroller.K1.durum_sayilari": {"Okundu": 500}, "kontroller.K1.medya_silme": 500, "bu_ay": {"W1": {"2026-10": ay_kova(500)}}},
  ozet_cikti=True, meta={"basamak": 2000},
  meta_davranis={"kanca": {"*": [["read", "+2s", {"tekrar": 3}], ["delivered", "+4s", {"tekrar": 3}], ["sent", "+6s", {"tekrar": 3}]]}})

S("OLCEK-04-pazarlama-300", "ÖLÇEK", "300 kişi, basamak 250; 50'si sınırda beklerken şablon Pazarlama'ya alındı: en geç 10 dakikalık okumada 50'si Duraklatıldı", "§7a 27, R2",
  KAL300, [baslat("+0s", "T1", [c["id"] for c in KAL300]), olay("+2h30m", "meta_sablon", ad="destekofis_ekstre", kategori="MARKETING"), kontrol("+4h", "K1")],
  {"kontroller.K1.durum_sayilari": {"Duraklatıldı": 50, "Teslim Edildi": 250}, "toplular.T1.neden": "Şablon Pazarlama'ya Alındı", "meta.toplam_post": 250},
  ozet_cikti=True, meta={"basamak": 250}, meta_davranis={"kanca": {"*": K_STD}})

S("OLCEK-05-pazarlama-100-ileti", "ÖLÇEK", "300 kişi (sınırsız); kategori 10. saniyede Pazarlama: 100. iletiden sonraki okumada iş durur — Pazarlama ücretiyle giden ileti en çok 100 (≈ 1 USD)",
  "§7a 27, R2 (her 100 iletide)", KAL300,
  [baslat("+0s", "T1", [c["id"] for c in KAL300]), olay("+10s", "meta_sablon", ad="destekofis_ekstre", kategori="MARKETING"), kontrol("+1h", "K1")],
  {"kontroller.K1.durum_sayilari": {"Duraklatıldı": 200, "Teslim Edildi": 100}, "kontroller.K1.toplam_post": 100, "toplular.T1.neden": "Şablon Pazarlama'ya Alındı",
   "meta.toplam_post": 100, "meta.toplam_medya_yukleme": 100},
  ozet_cikti=True, meta={"basamak": 2000}, meta_davranis={"kanca": {"*": K_STD}})

# ======================================================================== GÜVENLİK
S("GUV-01-yetkisiz", "GÜVENLİK", "whatsapp.send yetkisi olmayan kullanıcı başlatamaz", "§4",
  [A()], [baslat("+0s", "T1", "A", kullanici="personel")],
  {"baslamadi": {"T1": "yetki_yok"}, "meta.toplam_post": 0, "meta.toplam_medya_yukleme": 0},
  kullanicilar={"yonetici": {"whatsapp.send": True}, "personel": {}})

S("GUV-02-salt-okunur-lisans", "GÜVENLİK", "Salt okunur lisansta yeni gönderim başlamaz", "§4",
  [A()], [baslat("+0s", "T1", "A")], {"baslamadi": {"T1": "lisans_salt_okunur"}, "meta.toplam_post": 0}, ayar={"lisans_yazilabilir": False})

S("GUV-03-lisans-arada-biter", "GÜVENLİK", "Gönderim sürerken lisans salt okunur: bekleyenler 'Lisans Nedeniyle Durdu'; kanca kabulü sürer", "§4",
  [A(), B(), C(), D()], [baslat("+0s", "T1", "ABCD"), olay("+1h", "lisans", yazilabilir=False), kontrol("+3h", "K1"), kontrol("+30h", "K2")],
  {"kontroller.K1.durum_sayilari": {"Lisans Nedeniyle Durdu": 2, "Teslim Edildi": 2}, "kontroller.K2.durum_sayilari": {"Lisans Nedeniyle Durdu": 2, "Teslim Edildi": 2},
   "meta.toplam_post": 2},
  ayar={"gunluk_ust_sinir": 2}, meta_davranis={"kanca": {"*": [["sent", "+1s"], ["delivered", "+2h"]]}})

S("GUV-04-onay-yok", "GÜVENLİK", "'Aydınlatma metnimi okudum…' onayı işaretsiz: toplu gönderim BAŞLAMAZ", "§1, W4, §7a 28",
  [A(), B()], [baslat("+0s", "T1", "AB")], {"baslamadi": {"T1": "onay_yok"}, "meta.toplam_post": 0, "meta.toplam_medya_yukleme": 0}, ayar={"onay": False})

S("GUV-05-sahte-kanca", "GÜVENLİK", "Bilinmeyen wamid'li imzasız sahte durum olayları düşer", "§3, §7a 3",
  [A()], [baslat("+0s", "T1", "A"), olay("+1h", "sahte_kanca", wamid="wamid.SAHTE", durum="delivered"),
          olay("+1h1m", "sahte_kanca", wamid="wamid.SAHTE2", durum="failed", kod=131026)],
  {"isler.T1/A.durum": "Teslim Edildi", "bu_ay.W1.2026-10": ay_kova(1), "meta.toplam_kabul_program": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("GUV-06-sahte-opaque", "GÜVENLİK", "İmzasız sahte olay Sonucu Belirsiz işin kimliğini (opaque) taşıyor: DÜŞER, iş Sonucu Belirsiz kalır", "§3, §7a 3 (GUV-06 kapandı)",
  [A()], [baslat("+0s", "T1", "A"), olay("+1h", "sahte_kanca", wamid="wamid.SAHTE", durum="delivered", opaque="T1/A")],
  {"meta.toplam_meta_ileti": 0, "meta.post": {"A": 1}, "meta.kabul": {"A": 0}, "isler.T1/A.durum": "Sonucu Belirsiz", "bu_ay": {}},
  meta_davranis={"mesaj": {"A": ["yanitsiz_red"]}})

S("GUV-07-bagli-degil", "GÜVENLİK", "API bağlantısı yok: otomatik gönderim yok (wa.me yolu sürer)", "§1, §7a 29",
  [A()], [baslat("+0s", "T1", "A")], {"baslamadi": {"T1": "bagli_degil"}, "meta.toplam_post": 0}, ayar={"bagli": False})

S("GUV-08-lisans-geri-gelir", "GÜVENLİK", "Lisans yeniden yazılabilir olunca 'Lisans Nedeniyle Durdu' işler kendiliğinden SÜRMEZ; Devam Et ile sürer", "§4, §7a 25",
  [A(), B(), C(), D()], [baslat("+0s", "T1", "ABCD"), olay("+1h", "lisans", yazilabilir=False), olay("+2h", "lisans", yazilabilir=True), kontrol("+3h", "K1"),
                         kontrol("+26h", "K2"), olay("+27h", "devam", toplu="T1"), kontrol("+28h", "K3")],
  {"kontroller.K1.durum_sayilari": {"Lisans Nedeniyle Durdu": 2, "Teslim Edildi": 2}, "kontroller.K2.durum_sayilari": {"Lisans Nedeniyle Durdu": 2, "Teslim Edildi": 2},
   "kontroller.K2.toplam_post": 2, "kontroller.K3.durum_sayilari": {"Teslim Edildi": 4}, "meta.toplam_post": 4},
  ayar={"gunluk_ust_sinir": 2}, meta_davranis={"kanca": {"*": K_STD}})

S("GUV-09-sahte-gercek-wamid", "GÜVENLİK", "İmzasız sahte 'delivered' gerçek işin wamid'iyle: düşer; iş TTL'de Süresi Doldu, 'Bu Ay'a girmez", "§7a 3, 16",
  [A()], [baslat("+0s", "T1", "A"), olay("+1h", "sahte_kanca", durum="delivered", **{"is": "T1/A"}), kontrol("+2h", "K1")],
  {"kontroller.K1.isler": {"T1/A": "Gönderildi"}, "isler.T1/A.durum": "Süresi Doldu", "bu_ay": {}, "meta.medya_silme": {"A": 1}},
  meta_davranis={"kanca": {"A": [["sent", "+1s"]]}})

S("GUV-10-yetki-ve-baglanti-sirasi", "GÜVENLİK", "Başlatma reddi sırası: bağlı değil → yetki → lisans → onay → şablon (hepsi eksikken ilk neden)", "§7a 29",
  [A(), B()], [baslat("+0s", "T1", "A", kullanici="personel"), baslat("+1m", "T2", "B")],
  {"baslamadi": {"T1": "bagli_degil", "T2": "bagli_degil"}, "meta.toplam_post": 0},
  ayar={"bagli": False, "onay": False, "lisans_yazilabilir": False}, kullanicilar={"yonetici": {"whatsapp.send": True}, "personel": {}},
  meta={"sablonlar": {"destekofis_ekstre": {"durum": "PAUSED", "kategori": "UTILITY"}}})

S("GUV-11-yetki-lisans-onay-sirasi", "GÜVENLİK", "Bağlı; yetkisiz + salt okunur + onaysız → 'yetki_yok'; yetkili + salt okunur + onaysız → 'lisans_salt_okunur'", "§7a 29",
  [A(), B()], [baslat("+0s", "T1", "A", kullanici="personel"), baslat("+1m", "T2", "B")],
  {"baslamadi": {"T1": "yetki_yok", "T2": "lisans_salt_okunur"}, "meta.toplam_post": 0},
  ayar={"onay": False, "lisans_yazilabilir": False}, kullanicilar={"yonetici": {"whatsapp.send": True}, "personel": {}},
  meta={"sablonlar": {"destekofis_ekstre": {"durum": "PAUSED", "kategori": "UTILITY"}}})

S("GUV-12-onay-sablon-sirasi", "GÜVENLİK", "Yetkili, yazılabilir; onaysız + şablon uygunsuz → 'onay_yok'", "§7a 29",
  [A()], [baslat("+0s", "T1", "A")], {"baslamadi": {"T1": "onay_yok"}, "meta.toplam_post": 0},
  ayar={"onay": False}, meta={"sablonlar": {"destekofis_ekstre": {"durum": "PAUSED", "kategori": "UTILITY"}}})

# ======================================================================== TARİH
S("TARIH-01-ay-sonu", "TARİH", "31.10 23:59:50 kabul, 01.11 00:00:20 teslim: 'Bu Ay' teslim ayı (Kasım, Türkiye saati)", "§6 W4, §7a 19",
  [A()], [baslat("+0s", "T1", "A")],
  {"bu_ay": {"W1": {"2026-11": ay_kova(1)}}},
  baslangic="2026-10-31T23:59:50+03:00", meta_davranis={"kanca": {"A": [["sent", "+1s"], ["delivered", "+30s"]]}})

S("TARIH-02-ttl-sonu", "TARİH", "Yalnız 'sent' geldi (kanca yolu çalışıyor): TTL + 1 saatte Süresi Doldu, PDF silinir; öncesinde değil", "§6 W2, §11 S2/S3, §7a 16",
  [A()], [baslat("+0s", "T1", "A"), kontrol("+72h30m", "K1"), kontrol("+73h30m", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Gönderildi"}, "kontroller.K1.medya_silme": 0, "kontroller.K2.isler": {"T1/A": "Süresi Doldu"}, "kontroller.K2.medya_silme": 1},
  meta_davranis={"kanca": {"A": [["sent", "+1s"]]}})

S("TARIH-03-kancasiz", "TARİH", "Bağlantıda hiç kanca gelmedi (kanca yolu yok): 'Meta Kabul Etti'de kalır, PDF silinmez ('Durum Bilinmiyor' yok)", "§7a 16",
  [A()], [baslat("+0s", "T1", "A"), kontrol("+73h30m", "K1"), kontrol("+7d1h", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Meta Kabul Etti"}, "kontroller.K2.isler": {"T1/A": "Meta Kabul Etti"}, "isler.T1/A.durum": "Meta Kabul Etti",
   "meta.medya_silme": {"A": 0}})

S("TARIH-03b-kancasiz-yol-calisiyor", "TARİH", "A'ya hiç kanca gelmedi ama aynı bağlantıda B'nin kancaları geldi (yol çalışıyor): A TTL + 1 saatte Süresi Doldu", "§7a 16",
  [A(), B()], [baslat("+0s", "T1", "AB"), kontrol("+72h30m", "K1"), kontrol("+73h30m", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Meta Kabul Etti", "T1/B": "Teslim Edildi"}, "kontroller.K2.isler": {"T1/A": "Süresi Doldu", "T1/B": "Teslim Edildi"},
   "meta.medya_silme": {"A": 1, "B": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(1)}}},
  meta_davranis={"kanca": {"B": K_STD}})

S("TARIH-04-eski-toplu-sinirda", "TARİH", "Program 29 saat kapalı; 24 saatten eski toplu işte SINIR nedeniyle bekleyen kendiliğinden sürer", "§7a 24",
  [A(), B()], [baslat("+0s", "T1", "AB"), olay("+1h", "kapat"), olay("+30h", "ac"), kontrol("+30h30m", "K1"), olay("+31h", "devam", toplu="T1"), kontrol("+32h", "K2")],
  {"kontroller.K1.toplam_post": 2, "kontroller.K2.toplam_post": 2},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("TARIH-05-eski-toplu", "TARİH", "Program 25 saat kapalı: 24 saatten eski toplu işte kapalıyken sırası gelen iş açılışta SORULUR; Devam Et ile sürer", "§6 W2, §7a 24",
  [A(), B()], [baslat("+0s", "T1", "AB"), olay("+200ms", "kapat"), olay("+25h", "ac"), olay("+25h1m", "kanca_kuyrugu"), kontrol("+25h30m", "K1"),
               olay("+26h", "devam", toplu="T1"), kontrol("+27h", "K2")],
  {"kontroller.K1.toplam_post": 1, "kontroller.K1.durum_sayilari": {SORU: 1, "Teslim Edildi": 1},
   "kontroller.K2.toplam_post": 2, "durum_sayilari": {"Teslim Edildi": 2}},
  meta_davranis={"kanca": {"*": K_STD}})

S("TARIH-06-genc-toplu-kapat-ac", "TARİH", "24 saatten genç toplu iş: program kapanıp açılınca sormadan sürer", "§7a 24 (yalnız 24 saatten eski)",
  [A(), B()], [baslat("+0s", "T1", "AB"), olay("+200ms", "kapat"), olay("+23h", "ac"), olay("+23h1m", "kanca_kuyrugu"), kontrol("+23h30m", "K1")],
  {"kontroller.K1.toplam_post": 2, "kontroller.K1.durum_sayilari": {"Teslim Edildi": 2}},
  meta_davranis={"kanca": {"*": K_STD}})


# ======================================================================== üretim / denetim

def _esit(a, b):
    return json.dumps(a, sort_keys=True, ensure_ascii=False) == json.dumps(b, sort_keys=True, ensure_ascii=False)


def girdi(s):
    return {k: v for k, v in s.items() if k not in ("elle",)}


def elle_denetle(s, beklenen):
    """Elle yazılmış beklenen ↔ modelin sonucu. Kısmi seçim {} ise bütün gruplar; değilse o seçime uyan gruplar."""
    farklar = []
    for kismi, yollar in s["elle"]:
        gruplar = [g for g in beklenen if any(all(sec.get(k) == v for k, v in kismi.items()) for sec in g["secimler"])]
        if not gruplar:
            farklar.append(f"{s['ad']}: {kismi} hiçbir gruba uymuyor")
        for g in gruplar:
            for yol, deger in yollar.items():
                m = kahin.yol_al(g["sonuc"], yol)
                if not _esit(m, deger):
                    farklar.append(f"{s['ad']} {kismi or '*'} [{g['secimler'][0]}…] {yol}: elle {json.dumps(deger, ensure_ascii=False)[:160]} ≠ model {json.dumps(m, ensure_ascii=False)[:160]}")
    return farklar


def tum_senaryolar():
    return SENARYOLAR


def main(argv):
    sadece = argv[argv.index("--sadece") + 1] if "--sadece" in argv else None
    yaz = "--yazma" not in argv
    cikti = []
    farklar = []
    tutan = 0
    for s in SENARYOLAR:
        if sadece and sadece not in s["ad"]:
            continue
        beklenen = kahin.hesapla(girdi(s))
        f = elle_denetle(s, beklenen)
        farklar += f
        tutan += 0 if f else 1
        cikti.append({"ad": s["ad"], "baslik": s["baslik"], "aciklama": s["aciklama"], "kaynak": s["kaynak"], "serbest": s.get("serbest", []),
                      "girdi": {k: v for k, v in girdi(s).items() if k not in ("ad", "baslik", "aciklama", "kaynak")},
                      "elle": [{"secim": k, "yollar": y} for k, y in s["elle"]], "beklenen": beklenen})
    for f in farklar:
        print("FARK", f)
    sayi = {}
    for s in SENARYOLAR:
        sayi[s["baslik"]] = sayi.get(s["baslik"], 0) + 1
    print(f"{len(cikti)} senaryo; başlıklar: " + ", ".join(f"{k} {v}" for k, v in sayi.items()))
    print(f"{tutan}/{len(cikti)} denetim geçti (elle beklenen = model)")
    if farklar:
        print(f"{len(farklar)} fark — senaryolar.json YAZILMADI")
        return 1
    if yaz and not sadece:
        with open(os.path.join(_BURASI, "senaryolar.json"), "w", encoding="utf-8") as f:
            json.dump({"kaynak": "docs/erp/WHATSAPP-API-PLANI-2.4.8.md (30.10.2026) + Meta belgeleri; kâhin test/bagimsiz/whatsapp-248/kahin/kahin.py",
                       "netlestirme": "plan §7a 1–32 (30.10.2026; K1–K3 ürün sahibi, öbürleri baş mimar + ürün sahibi 'önerilerin uygun') — serbest seçim yok",
                       "serbest_secimler": {k: list(v) for k, v in kahin.SERBEST.items()}, "sablonlar": kahin.SABLONLAR, "senaryolar": cikti}, f, ensure_ascii=False, indent=1)
            f.write("\n")
        print("senaryolar.json yazıldı")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
