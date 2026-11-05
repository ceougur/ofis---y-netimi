#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WhatsApp toplu gönderim kâhininin SENARYO KÜMESİ — DestekOfis 2.4.8 K0 (plan §7a kararlarına + revizyon R1–R3'e SABİT;
kâhin güncellemesi 2: ürün sahibinin 31.10.2026 kararları K1–K8 — başlıklar K1…K8, 34 senaryo;
kâhin güncellemesi 3: ★ soruların yanıtları D1–D8 — başlıklar D1…D8, 19 senaryo;
kâhin güncellemesi 4: N2–N5 yanıtları E1–E4 + N6 — başlıklar E1…E4, N6, 12 senaryo;
kâhin güncellemesi 5: P1/P2 yanıtları F1/F2 — başlıklar F1, F2, 5 senaryo;
kâhin güncellemesi 6: G0 genel ilke + G1–G5 — başlıklar G0…G5, 16 senaryo;
kâhin güncellemesi 7: G6 (baş mimar, G0 3 İLKEYLE) — başlık G6, 5 senaryo;
kâhin güncellemesi 8: H1 (kullanıcı) + H2–H4 (baş mimar, G0 İLKEYLE) — başlıklar H1…H4, 8 senaryo;
kâhin güncellemesi 9: 01.11.2026 kullanıcı onaylı 8 davranış J1–J8 + n3 BİLİNEN SINIR J9 — başlıklar J1…J9, 29 senaryo;
kâhin güncellemesi 9b: S9-1 (+ kapsam a/b/c) J10, S9-2 (+ gün) J11 — 8 senaryo;
kâhin güncellemesi 9c: ekstre içeriği açılışta hazırlanır J12 — 3 senaryo;
kâhin güncellemesi 10: 2.4.9 W KULLANICI KARARI 03.11.2026 teslim süresi 30 gün (Meta bildirirse o) W1 — başlık W1, 5 senaryo; 9 eski senaryonun düzeneği/beklentisi;
  W-KÖK (03.11 ~20:05 UTC) iş kabul anındaki süreyle W2 — başlık W2, 2 senaryo; S10-6 kararı max(kabul, güncel) W3 — başlık W3, 1 senaryo);
kâhin güncellemesi 11 (2.5.0, 05.11.2026): S-W1 n3 KARAR (SW1, 3), S-W2 Süresi Doldu pencerede sayılmaz (SW2, 2), 18:37 süre dolunca duraklasın (SD1837, 3), 19:15 190 alan
  bekleyenlere döner (SD1915, 5), S-W4 kod 0 = 190 (SW4, 3), S7 şüpheli alacaklı müşteri otomatik listeye girmez (S7, 2); HESAP-0 ve J9-01/02 değişti (README §16).

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
# kâhin güncellemesi 10 (W1, Y10-9): Meta şablon listesinde ekstre için 12 sa (43.200 sn — utility'de izin verilen en uzun özel süre) bildirir — eski TTL senaryolarının düzeneği
META_12SA = {"sablonlar": {"destekofis_ekstre": {"durum": "APPROVED", "kategori": "UTILITY", "teslim_suresi_sn": 43200}}}


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

S("CIFT-16-daha-once-suresi-doldu", "ÇİFT", "Önceki ileti Süresi Doldu (Meta listede 12 sa bildirir; teslim edilmedi); aynı dönem yeniden: gider (kâhin yorumu: Süresi Doldu 'gönderilmiş' sayılmaz)",
  "§7a R3, §7a 16, W1 (Y10-9)", [A()], [baslat("+0s", "T1", "A"), kontrol("+3d2h", "K1"), baslat("+4d", "T2", "A")],
  {"kontroller.K1.isler": {"T1/A": "Süresi Doldu"}, "elenen": {}, "onceki_uyari": {}, "meta.post": {"A": 2}, "isler.T2/A.durum": "Süresi Doldu"},
  meta=META_12SA, meta_davranis={"kanca": {"A": [["sent", "+1s"]]}})

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

S("ICERIK-08-tum-hareketler", "YANLIŞ İÇERİK", "'Tüm Hareketler' = bütün hesap (devir 0); dönem metni ve PDF dönemi ilk hareket – açılış günü (güncelleme 9b, J11; eskiden PLAN SUSUYOR)",
  "§1, §7a 21, J11 (S9-2 + 07:11)",
  [A()], [baslat("+0s", "T1", "A", donem="tum")],
  {"isler.T1/A.pdf": {"cari_ad": "Ayşe Yılmaz", "donem_bas": "2026-09-10", "donem_son": "2026-10-30", "devir": "0.00", "hareket_sayisi": 3, "donem_sonu_bakiye": "1250.00"},
   "isler.T1/A.degiskenler": ["Ayşe Yılmaz", FIRMA, "10.09.2026 – 30.10.2026", "1.250,00 TL"]},
  meta_davranis={"kanca": {"*": K_STD}})

S("ICERIK-09-kuyrukta-bakiye-degisti", "YANLIŞ İÇERİK", "Sınırda beklerken cariye hareket girdi: ekstre (metin + PDF) toplu işin AÇILIŞINDA hazırlandığı gibi gider (güncelleme 9c, J12; eskiden gönderim anında)",
  "§6 W2 (metin = PDF), J12 (§7a 1'in ekstre yorumunun yerine)",
  [A(), B()], [baslat("+0s", "T1", "A"), baslat("+1s", "T2", "B"), olay("+1h", "cari", id="B", hareket_ekle={"tarih": "2026-10-30", "borc": 1000, "alacak": 0})],
  {"isler.T2/B.degiskenler": ["Mehmet Kaya", FIRMA, DON, "2.000,00 TL"], "isler.T2/B.pdf.donem_sonu_bakiye": "2000.00", "isler.T2/B.pdf.hareket_sayisi": 1},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("ICERIK-10-ttl-sonrasi-teslim", "YANLIŞ İÇERİK", "Teslim kancası süre + 1 sa'ten sonra geldi (Meta listede 12 sa): önce Süresi Doldu, sonra gerçek bilgi Teslim Edildi; ay = teslim zamanı (Kasım)",
  "W1 (Y10-1/9), §7a 16/17/19", [A()], [baslat("+0s", "T1", "A"), kontrol("+11h30m", "K1"), kontrol("+13h30m", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Gönderildi"}, "kontroller.K2.isler": {"T1/A": "Süresi Doldu"}, "meta.medya_silme": {"A": 1},
   "isler.T1/A.durum": "Teslim Edildi", "bu_ay": {"W1": {"2026-11": ay_kova(1)}}},
  meta=META_12SA, meta_davranis={"kanca": {"A": [["sent", "+1s"], ["delivered", "+2d"]]}})

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
    if kod == 0:
        # güncelleme 11 (SW4 "Kod 0 da 190 gibi" + SD1915 + SD1837): B Başarısız DEĞİL, bekleyenlere döner; bağlantı Süresi Doldu → yeniden bağlanınca Devam Et (olay eklendi)
        S("HESAP-0", "HESAP / META", "Belirteç reddi 0 (AuthException; S-W4: 190 gibi): toplu iş İLK hatada durur; B bekleyenlere döner (Duraklatıldı — Başarısız DEĞİL), bağlantı "
          "Süresi Doldu; yeniden bağlanınca Devam Et ile B ve C gider (B'nin PDF'i yeniden yüklenmez)",
          "§6 W2 hata sınıfı, §7a 13 + SW4 + SD1915 + SD1837", [A(), B(), C()],
          [baslat("+0s", "T1", "ABC"), kontrol("+30m", "K1"), olay("+50m", "yeniden_baglan"), olay("+1h", "devam", toplu="T1"), kontrol("+2h", "K2")],
          {"kontroller.K1.toplam_post": 2, "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Duraklatıldı", "T1/C": "Duraklatıldı"},
           "kontroller.K1.toplular": {"T1": "duraklatildi"}, "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/B": "Teslim Edildi", "T1/C": "Teslim Edildi"},
           "isler.T1/B.hata_kodu": None, "meta.post": {"A": 1, "B": 2, "C": 1}, "meta.medya_yukleme": {"A": 1, "B": 1, "C": 1}, "meta.medya_silme.B": 1,
           "toplular.T1": {"durum": "aktif", "neden": None, "is_sayisi": 3}, "durum_sayilari": {"Teslim Edildi": 3}},
          meta_davranis={"mesaj": {"B": [{"hata": kod}]}, "kanca": {"*": K_STD}})
        continue
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

S("GUV-09-sahte-gercek-wamid", "GÜVENLİK", "İmzasız sahte 'delivered' gerçek işin wamid'iyle: düşer; iş Gönderildi'de kalır (30 gün dolmadı — W1), 'Bu Ay'a girmez, PDF silinmez", "§7a 3, 16, W1",
  [A()], [baslat("+0s", "T1", "A"), olay("+1h", "sahte_kanca", durum="delivered", **{"is": "T1/A"}), kontrol("+2h", "K1")],
  {"kontroller.K1.isler": {"T1/A": "Gönderildi"}, "isler.T1/A.durum": "Gönderildi", "bu_ay": {}, "meta.medya_silme": {"A": 0}},
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

S("TARIH-02-ttl-sonu", "TARİH", "Yalnız 'sent' geldi (kanca yolu çalışıyor; Meta listede 12 sa bildirir): süre + 1 saatten sonra Süresi Doldu, PDF silinir; süre dolmadan değil", "§6 W2, §11 S3, §7a 16, W1 (Y10-1/9)",
  [A()], [baslat("+0s", "T1", "A"), kontrol("+11h30m", "K1"), kontrol("+13h30m", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Gönderildi"}, "kontroller.K1.medya_silme": 0, "kontroller.K2.isler": {"T1/A": "Süresi Doldu"}, "kontroller.K2.medya_silme": 1},
  meta=META_12SA, meta_davranis={"kanca": {"A": [["sent", "+1s"]]}})

S("TARIH-03-kancasiz", "TARİH", "Bağlantıda hiç kanca gelmedi (kanca yolu yok; Meta listede 12 sa bildirir): süre dolsa da 'Meta Kabul Etti'de kalır, PDF silinmez ('Durum Bilinmiyor' yok)", "§7a 16, W1 (Y10-5/9)",
  [A()], [baslat("+0s", "T1", "A"), kontrol("+73h30m", "K1"), kontrol("+7d1h", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Meta Kabul Etti"}, "kontroller.K2.isler": {"T1/A": "Meta Kabul Etti"}, "isler.T1/A.durum": "Meta Kabul Etti",
   "meta.medya_silme": {"A": 0}}, meta=META_12SA)

S("TARIH-03b-kancasiz-yol-calisiyor", "TARİH", "A'ya hiç kanca gelmedi ama aynı bağlantıda B'nin kancaları geldi (yol çalışıyor; Meta listede 12 sa): A süre + 1 saatten sonra Süresi Doldu", "§7a 16, W1 (Y10-9)",
  [A(), B()], [baslat("+0s", "T1", "AB"), kontrol("+11h30m", "K1"), kontrol("+13h30m", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Meta Kabul Etti", "T1/B": "Teslim Edildi"}, "kontroller.K2.isler": {"T1/A": "Süresi Doldu", "T1/B": "Teslim Edildi"},
   "meta.medya_silme": {"A": 1, "B": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(1)}}},
  meta=META_12SA, meta_davranis={"kanca": {"B": K_STD}})

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


# ======================================================================== KÂHİN GÜNCELLEMESİ 2 (31.10.2026): kullanıcı kararları K1–K8
# Elle beklenen YALNIZ karar metninden (kahin.KARARLAR; README §7). Dönem seçimi: {"secim": "bu_ay" | "gecen_ay" | "son_3_ay"}; "tum" = Tüm Hareketler;
# {"bas", "son"} = özel aralık. Yeniden deneme / Yine de Gönder olaylarında "etiket" → sonuç "yeniden.<etiket>" = {elenen, alinan, oneri};
# "hedef": "asil" = düğmeye ASIL toplu işte basılır. "yedek_al" {ad} + "geri_yukle" {yedek} = önceden alınmış yedeğe dönüş. "liste" {ad, bas, son, devam} (K8).
BU_AY = {"secim": "bu_ay"}
GECEN_AY = {"secim": "gecen_ay"}
SON3 = {"secim": "son_3_ay"}
SUS_BU_AY = {"plan_susuyor": "'bu_ay' seçiminin tarih uçları karar metninde yok (kâhin yorumu 17)"}
GEC = "teslimsiz kapanan işe (Başarısız/İptal/Durduruldu/Taşınan) geç gelen teslimin ekran durumu (K3/K7 yalnız 'sayılır' der)"
K49 = [["sent", "+1s"], ["failed", "+10s", {"kod": 131049}]]          # Meta Bekletti (kanca ile 131049)


def Y(**kw):
    return cari("Y", "Yusuf Eski", kw.pop("telefon", "0541 111 22 33"), [("2026-01-15", 400, 0)], **kw)


def Z(**kw):
    return cari("Z", "Zehra Eski", kw.pop("telefon", "0542 222 33 44"), [("2026-02-10", 600, 0)], **kw)


def H(**kw):
    return cari("H", "Hande Vade", "0539 888 99 00", [("2026-10-01", 300, 0)], vadeler=[{"vade": "2026-10-20", "kalan": 300}], **kw)


def yeniden(elenen=None, alinan=(), oneri=None):
    return {"elenen": elenen or {}, "alinan": list(alinan), "oneri": oneri}


# ---- K1: dönem eşliği ----
S("K1-01-ay-sonu-bu-ay-sonra-gecen-ay", "K1", "31.10 'Bu Ay' (Ekim) gönderilen A, B; 01.11 'Geçen Ay' (yine Ekim) seçiminde 'Daha Önce Gönderildi'; yalnız C gider",
  "K1 (T2-1 A + dk3 'a': Bu Ay/Geçen Ay aynı takvim ayı → aynı dönem)", [A(), B(), C()],
  [baslat("+0s", "T1", "AB", donem=BU_AY), baslat("+1d", "T2", "ABC", donem=GECEN_AY), kontrol("+1d1h", "K1")],
  {"elenen": {"T2": {"A": "daha_once_gonderildi", "B": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 2, "son": "2026-10-31"}},
   "toplular.T2.is_sayisi": 1, "isler.T1/A.degiskenler": ["Ayşe Yılmaz", FIRMA, DON, "1.250,00 TL"],
   "isler.T1/A.pdf": {"cari_ad": "Ayşe Yılmaz", "donem_bas": "2026-10-01", "donem_son": "2026-10-31", "devir": "1000.00", "hareket_sayisi": 2, "donem_sonu_bakiye": "1250.00"},
   "isler.T2/C.degiskenler": ["Zeynep Demir", FIRMA, DON, "0,00 TL"],
   "isler.T2/C.pdf": {"cari_ad": "Zeynep Demir", "donem_bas": "2026-10-01", "donem_son": "2026-10-31", "devir": "0.00", "hareket_sayisi": 0, "donem_sonu_bakiye": "0.00"},
   "meta.post": {"A": 1, "B": 1, "C": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(2), "2026-11": ay_kova(1)}}},
  baslangic="2026-10-31T10:00:00+03:00", meta_davranis={"kanca": {"*": K_STD}})

S("K1-02-yil-donumu", "K1", "31.12 'Bu Ay' (Aralık) gönderilen A: 01.01 'Geçen Ay' (Aralık) elenir; 01.01 'Bu Ay' (Ocak) gider", "K1 (takvim ayı; 31.12 → 01.01)",
  [A()], [baslat("+0s", "T1", "A", donem=BU_AY), baslat("+1d", "T2", "A", donem=GECEN_AY), baslat("+1d1m", "T3", "A", donem=BU_AY), kontrol("+1d1h", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-12-31"}},
   "isler.T1/A.degiskenler": ["Ayşe Yılmaz", FIRMA, "01.12.2026 – 31.12.2026", "1.250,00 TL"], "toplular.T3.is_sayisi": 1,
   "isler.T3/A.degiskenler": ["Ayşe Yılmaz", FIRMA, SUS_BU_AY, "1.250,00 TL"], "isler.T3/A.pdf.donem_bas": "2027-01-01", "isler.T3/A.pdf.devir": "1250.00",
   "isler.T3/A.pdf.hareket_sayisi": 0, "meta.post": {"A": 2}, "bu_ay": {"W1": {"2026-12": ay_kova(1), "2027-01": ay_kova(1)}}},
  baslangic="2026-12-31T10:00:00+03:00", meta_davranis={"kanca": {"*": K_STD}})

S("K1-03-yarim-ay-bu-ay-sonra-tam-ay-gecen-ay", "K1", "15.10 'Bu Ay' (yarım Ekim) gönderilen D; 03.11 'Geçen Ay' (tam Ekim) varsayılan Bunları Çıkar ile elenir, 'Yine de Gönder' ile ikinci ileti",
  "K1 (yarım ay Bu Ay sonra tam ay Geçen Ay da uyarı alır), R3", [D()],
  [baslat("+0s", "T1", "D", donem=BU_AY), baslat("+19d", "T2", "D", donem=GECEN_AY), baslat("+19d1m", "T3", "D", donem=GECEN_AY, onceki="gonder"), kontrol("+19d1h", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"D": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-15"}, "T3": {"sayi": 1, "son": "2026-10-15"}},
   "toplular.T3.is_sayisi": 1, "meta.post": {"D": 2}, "isler.T1/D.pdf.donem_bas": "2026-10-01", "isler.T1/D.pdf.hareket_sayisi": 1,
   "isler.T1/D.pdf.donem_sonu_bakiye": "750.00", "isler.T3/D.degiskenler": ["Hasan Çelik", FIRMA, DON, "750,00 TL"]},
  baslangic="2026-10-15T10:00:00+03:00", bitis="+19d2h", meta_davranis={"kanca": {"*": K_STD}})

S("K1-04-zaten-kuyrukta-ay-donumu", "K1", "31.10 23:00 'Bu Ay' sınır 1: B bekliyor; 01.11 00:30 'Geçen Ay' (Ekim) B 'Zaten Kuyrukta'; B 01.11 23:00'te Ekim dönemiyle gider",
  "K1 ('Zaten Kuyrukta' da aynı eşlikle), §7a 9", [A(), B()],
  [baslat("+0s", "T1", "AB", donem=BU_AY), baslat("+1h30m", "T2", "B", donem=GECEN_AY), kontrol("+2h", "K1"), kontrol("+25h", "K2")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"B": "zaten_kuyrukta"}}, "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Sınır Nedeniyle Bekliyor"},
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/B": "Teslim Edildi"}, "isler.T1/B.degiskenler": ["Mehmet Kaya", FIRMA, DON, "2.000,00 TL"],
   "meta.post": {"A": 1, "B": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(1), "2026-11": ay_kova(1)}}},
  baslangic="2026-10-31T23:00:00+03:00", ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("K1-05-son-3-ay-7-gun", "K1", "'Son 3 Ay' Y, Z gönderildi; 1. gün 'Tüm Hareketler' (başka seçim) Y'ye gider; 6. gün 'Son 3 Ay' Y elenir; 8. gün 'Son 3 Ay' Z gider",
  "K1 (Son 3 Ay / Tüm Hareketler aynı seçimle son 7 gün)", [Y(), Z()],
  [baslat("+0s", "T1", "YZ", donem=SON3), baslat("+1d", "T2", "Y", donem="tum"), baslat("+6d", "T3", "Y", donem=SON3), baslat("+8d", "T4", "Z", donem=SON3),
   kontrol("+8d1h", "K1")],
  {"olusmadi": ["T3"], "elenen": {"T3": {"Y": "daha_once_gonderildi"}}, "onceki_uyari": {"T3": {"sayi": 1, "son": "2026-10-30"}}, "toplular.T2.is_sayisi": 1,
   "toplular.T4.is_sayisi": 1, "meta.post": {"Y": 2, "Z": 2}, "isler.T1/Y.pdf.devir": "400.00", "isler.T1/Y.pdf.hareket_sayisi": 0,
   "isler.T1/Y.pdf.donem_sonu_bakiye": "400.00", "isler.T2/Y.pdf": {"cari_ad": "Yusuf Eski", "donem_bas": "2026-01-15", "donem_son": "2026-10-31", "devir": "0.00",
                                                                     "hareket_sayisi": 1, "donem_sonu_bakiye": "400.00"}},
  meta_davranis={"kanca": {"*": K_STD}})

S("K1-06-tum-hareketler-7-gun", "K1", "'Tüm Hareketler' Y gönderildi; 6 gün 23 saat sonra aynı seçim elenir, 8 gün 1 saat sonra gider", "K1 (Tüm Hareketler aynı seçimle son 7 gün)",
  [Y()], [baslat("+0s", "T1", "Y", donem="tum"), baslat("+6d23h", "T2", "Y", donem="tum"), baslat("+8d1h", "T3", "Y", donem="tum"), kontrol("+8d2h", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"Y": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}}, "toplular.T3.is_sayisi": 1,
   "meta.post": {"Y": 2}},
  meta_davranis={"kanca": {"*": K_STD}})

S("K1-07-hatirlatma-ayni-yerel-gun", "K1", "Ödeme Hatırlatma 30.10 23:50 gönderildi: 23:55 elenir; 31.10 00:10 (yerel yeni gün, UTC'de hâlâ 30.10) gider; 00:15 'Yine de Gönder' ile üçüncü",
  "K1 (Ödeme Hatırlatma aynı gün — ★5 baş mimar, README §7 S1), R3", [H()],
  [baslat("+0s", "T1", "H", sablon="hatirlatma"), baslat("+5m", "T2", "H", sablon="hatirlatma"), baslat("+20m", "T3", "H", sablon="hatirlatma"),
   baslat("+25m", "T4", "H", sablon="hatirlatma", onceki="gonder"), kontrol("+1h", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"H": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}, "T4": {"sayi": 1, "son": "2026-10-31"}},
   "toplular.T3.is_sayisi": 1, "toplular.T4.is_sayisi": 1, "meta.post": {"H": 3},
   "isler.T3/H.degiskenler": ["Hande Vade", FIRMA, "20.10.2026", "300,00 TL", "300,00 TL"]},
  baslangic="2026-10-30T23:50:00+03:00", meta_davranis={"kanca": {"*": K_STD}})

S("K1-08-hatirlatma-zaten-kuyrukta-ayni-gun", "K1", "Ödeme Hatırlatma sınır 1: I bekliyor; aynı gün ikinci hatırlatmada I 'Zaten Kuyrukta'", "K1 ('Zaten Kuyrukta' aynı eşlikle), §7a 9",
  [H(), cari("I", "İsmail Vade", "0540 999 00 11", [("2026-10-02", 500, 0)], vadeler=[{"vade": "2026-10-25", "kalan": 500}])],
  [baslat("+0s", "T1", ["H", "I"], sablon="hatirlatma"), baslat("+1h", "T2", ["I"], sablon="hatirlatma"), kontrol("+2h", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"I": "zaten_kuyrukta"}}, "kontroller.K1.isler": {"T1/H": "Teslim Edildi", "T1/I": "Sınır Nedeniyle Bekliyor"},
   "meta.post": {"H": 1, "I": 1}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("K1-09-bu-ay-gecen-ay-farkli-ay", "K1", "30.10 'Bu Ay' (Ekim) ve 'Geçen Ay' (Eylül) farklı takvim ayı: ikisi de gider", "K1 (takvim ayı farklı → farklı dönem)",
  [A()], [baslat("+0s", "T1", "A", donem=BU_AY), baslat("+1h", "T2", "A", donem=GECEN_AY), kontrol("+2h", "K1")],
  {"elenen": {}, "onceki_uyari": {}, "meta.post": {"A": 2}, "isler.T2/A.degiskenler": ["Ayşe Yılmaz", FIRMA, "01.09.2026 – 30.09.2026", "1.000,00 TL"],
   "isler.T1/A.pdf.devir": "1000.00", "isler.T1/A.pdf.hareket_sayisi": 2, "isler.T1/A.pdf.donem_sonu_bakiye": "1250.00",
   "isler.T1/A.degiskenler": ["Ayşe Yılmaz", FIRMA, SUS_BU_AY, "1.250,00 TL"]},
  meta_davranis={"kanca": {"*": K_STD}})

S("K1-10-ozel-aralik-birebir", "K1", "Özel aralık 01.10–15.10 gönderildi: 01.10–16.10 başka dönem (gider); 01.10–15.10 yeniden elenir", "K1 (özel aralık birebir)",
  [A()], [baslat("+0s", "T1", "A", donem={"bas": "2026-10-01", "son": "2026-10-15"}), baslat("+1h", "T2", "A", donem={"bas": "2026-10-01", "son": "2026-10-16"}),
          baslat("+2h", "T3", "A", donem={"bas": "2026-10-01", "son": "2026-10-15"})],
  {"olusmadi": ["T3"], "elenen": {"T3": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T3": {"sayi": 1, "son": "2026-10-30"}}, "meta.post": {"A": 2},
   "isler.T1/A.degiskenler": ["Ayşe Yılmaz", FIRMA, "01.10.2026 – 15.10.2026", "1.500,00 TL"],
   "isler.T2/A.degiskenler": ["Ayşe Yılmaz", FIRMA, "01.10.2026 – 16.10.2026", "1.500,00 TL"]},
  meta_davranis={"kanca": {"*": K_STD}})

# ---- K2: "Zaten Kuyrukta" yaşa bakılmaz ----
S("K2-01-son-3-ay-bekleyen-yasi-yok", "K2", "'Son 3 Ay' sınır 1, toplu iş duraklatıldı: Z 8 gündür bekliyor; 8. gün 'Son 3 Ay' Z 'Zaten Kuyrukta', Y gider (7 gün geçti)",
  "K2 (Son 3 Ay: bekleyen işin yaşına bakılmaz), K1 (R3 7 gün)", [Y(), Z()],
  [baslat("+0s", "T1", "YZ", donem=SON3), olay("+1m", "duraklat", toplu="T1"), baslat("+8d", "T2", "YZ", donem=SON3), kontrol("+8d1h", "K1")],
  {"elenen": {"T2": {"Z": "zaten_kuyrukta"}}, "onceki_uyari": {}, "toplular.T2.is_sayisi": 1, "meta.post": {"Y": 2, "Z": 0},
   "kontroller.K1.isler": {"T1/Y": "Teslim Edildi", "T1/Z": "Duraklatıldı", "T2/Y": "Teslim Edildi"}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("K2-02-tum-hareketler-bekleyen-yasi-yok-iptal-sonra", "K2", "'Tüm Hareketler' Y 9 gündür duraklatılmış işte: 'Zaten Kuyrukta'; asıl iş iptal edilince yeni seçimde gider",
  "K2 (Tüm Hareketler: yaşa bakılmaz), §7a 9", [A(), Y()],
  [baslat("+0s", "T1", "AY", donem="tum"), olay("+1m", "duraklat", toplu="T1"), baslat("+9d", "T2", "Y", donem="tum"), olay("+9d1m", "iptal", toplu="T1"),
   baslat("+9d2m", "T3", "Y", donem="tum"), kontrol("+9d1h", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"Y": "zaten_kuyrukta"}}, "isler.T1/Y.durum": "İptal", "isler.T3/Y.durum": "Teslim Edildi", "toplular.T1.durum": "iptal",
   "meta.post": {"A": 1, "Y": 1}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

# ---- K3: Süresi Doldu / Başarısız (teslimsiz) sayılmaz; geç teslim sayılır ----
S("K3-01-basarisiz-sayilmaz-ay-donumu", "K3", "31.10 'Bu Ay': A Başarısız (131026), B Teslim; 01.11 'Geçen Ay': A yeniden gider, B 'Daha Önce Gönderildi'",
  "K3 (Başarısız teslim edilmemiş → sayılmaz), K1", [A(), B()],
  [baslat("+0s", "T1", "AB", donem=BU_AY), baslat("+1d", "T2", "AB", donem=GECEN_AY)],
  {"elenen": {"T2": {"B": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-31"}}, "toplular.T2.is_sayisi": 1,
   "meta.post": {"A": 2, "B": 1}, "isler.T2/A.durum": "Başarısız", "isler.T2/A.hata_kodu": 131026},
  baslangic="2026-10-31T10:00:00+03:00", meta_davranis={"kanca": {"A": [["sent", "+1s"], ["failed", "+3s", {"kod": 131026}]], "B": K_STD}})

S("K3-02-meta-bekletti-ret-sonra-gec-teslim-sayilir", "K3", "Meta Bekletti; 24 saat sonra 2. deneme reddedildi (Başarısız); sonra 1. iletinin teslim bildirimi geldi → aynı dönem 'Daha Önce Gönderildi'",
  "K3 + K7 (geç delivered gelirse sayılır), §7a 19", [A()],
  [baslat("+0s", "T1", "A"), kontrol("+1h", "K1"), kontrol("+24h1m", "K2"), baslat("+25h", "T2", "A")],
  {"kontroller.K1.isler": {"T1/A": BEKLETTI}, "kontroller.K2.isler": {"T1/A": "Başarısız"}, "olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi"}},
   "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}}, "meta.post": {"A": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(1)}},
   "isler.T1/A.durum": {"secenek": ["Başarısız", "Teslim Edildi"], "susuyor": GEC}},
  meta_davranis={"mesaj": {"A": ["kabul", {"hata": 131049}]}, "kanca": {"A": {"1": K49 + [["delivered", "+24h30m"]]}}})

# ---- K7: Meta Bekletti (teslim yok) — ret / iptal / geri yükleme / taşıma ----
S("K7-01-meta-bekletti-ikinci-deneme-reddi-sayilmaz", "K7", "Meta Bekletti işin 2. denemesi reddedildi (Başarısız, teslim yok): aynı dönem yeni seçimde gider",
  "K7 (2. denemesi reddedilirse sayılmaz — dk7 baş mimar, P3'ten)", [A()],
  [baslat("+0s", "T1", "A"), kontrol("+24h1m", "K1"), baslat("+25h", "T2", "A")],
  {"kontroller.K1.isler": {"T1/A": "Başarısız"}, "elenen": {}, "onceki_uyari": {}, "toplular.T2.is_sayisi": 1, "meta.post": {"A": 3},
   "isler.T2/A.durum": BEKLETTI},
  bitis="+25h30m", meta_davranis={"mesaj": {"A": ["kabul", {"hata": 131049}]}, "kanca": {"A": {"1": K49}}})

S("K7-02-iptal-meta-bekletti-sayilmaz", "K7", "Meta Bekletti iş İPTAL edildi (teslim yok): aynı dönem yeni seçimde gider", "K7 (10:10 'a')",
  [A()], [baslat("+0s", "T1", "A"), olay("+1h", "iptal", toplu="T1"), baslat("+2h", "T2", "A"), kontrol("+2h30m", "K1")],
  {"isler.T1/A.durum": "İptal", "elenen": {}, "onceki_uyari": {}, "toplular.T2.is_sayisi": 1, "meta.post": {"A": 2},
   "kontroller.K1.isler": {"T1/A": "İptal", "T2/A": BEKLETTI}},
  bitis="+3h", meta_davranis={"kanca": {"A": {"1": K49}}})

S("K7-03-iptal-meta-bekletti-gec-teslim-sayilir", "K7", "Meta Bekletti iş iptal edildi, sonra 1. iletinin teslim bildirimi geldi: aynı dönem 'Daha Önce Gönderildi'",
  "K7 (10:10 'a': geç teslim bildirimi gelirse sayılır)", [A()],
  [baslat("+0s", "T1", "A"), olay("+1h", "iptal", toplu="T1"), baslat("+2h", "T2", "A")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}}, "meta.post": {"A": 1},
   "bu_ay": {"W1": {"2026-10": ay_kova(1)}}, "isler.T1/A.durum": {"secenek": ["İptal", "Teslim Edildi"], "susuyor": GEC}, "isler.T1/A.medya_silme": 1},
  meta_davranis={"kanca": {"A": {"1": K49 + [["delivered", "+1h30m"]]}}})

S("K7-04-geri-yukleme-meta-bekletti-sayilmaz", "K7", "Meta Bekletti iş yedekten geri yüklemeyle durdu (teslim yok): aynı dönem yeni seçimde gider",
  "K7 (11:00 'A'), §7a 26", [A()],
  [baslat("+0s", "T1", "A"), olay("+1h", "geri_yukle"), baslat("+2h", "T2", "A"), kontrol("+2h30m", "K1")],
  {"isler.T1/A.durum": GERI, "elenen": {}, "onceki_uyari": {}, "toplular.T2.is_sayisi": 1, "meta.post": {"A": 2},
   "kontroller.K1.isler": {"T1/A": GERI, "T2/A": BEKLETTI}},
  bitis="+3h", meta_davranis={"kanca": {"A": {"1": K49}}})

S("K7-05-tasima-meta-bekletti-gec-teslim-sayilir", "K7", "Meta Bekletti iş başka bilgisayara taşınmayla durdu, sonra 1. iletinin teslim bildirimi geldi: 'Daha Önce Gönderildi'",
  "K7 (11:00 'A': taşıma + geç teslim)", [A()],
  [baslat("+0s", "T1", "A"), olay("+1h", "tasindi"), baslat("+2h", "T2", "A")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}}, "meta.post": {"A": 1},
   "bu_ay": {"W1": {"2026-10": ay_kova(1)}}, "isler.T1/A.durum": {"secenek": ["Taşınan Veri — Durduruldu", "Teslim Edildi"], "susuyor": GEC}},
  meta_davranis={"kanca": {"A": {"1": K49 + [["delivered", "+1h30m"]]}}})

# ---- K4: yeniden deneme / Yine de Gönder asıl işin döneminde ----
S("K4-01-ay-sonu-yeniden-deneme-donemi-tasinir", "K4", "31.10 'Bu Ay': A Başarısız; 01.11 Başarısızları Yeniden Dene A'ya EKİM ekstresi gönderir; 01.11 'Geçen Ay' (Ekim) A ve B elenir",
  "K4 (dönem asıl işten taşınır), K1", [A(), B()],
  [baslat("+0s", "T1", "AB", donem=BU_AY), olay("+1d", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), baslat("+1d30m", "T2", "AB", donem=GECEN_AY),
   kontrol("+1d1h", "K1")],
  {"yeniden": {"Y1": yeniden(alinan="A")}, "isler.T1/A.durum": "Teslim Edildi", "isler.T1/A.hata_kodu": None,
   "isler.T1/A.degiskenler": ["Ayşe Yılmaz", FIRMA, DON, "1.250,00 TL"],
   "isler.T1/A.pdf": {"cari_ad": "Ayşe Yılmaz", "donem_bas": "2026-10-01", "donem_son": "2026-10-31", "devir": "1000.00", "hareket_sayisi": 2, "donem_sonu_bakiye": "1250.00"},
   "olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi", "B": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 2, "son": "2026-11-01"}},
   "meta.post": {"A": 2, "B": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(1), "2026-11": ay_kova(1)}}},
  baslangic="2026-10-31T10:00:00+03:00", meta_davranis={"mesaj": {"A": [{"hata": 131026}]}, "kanca": {"*": K_STD}})

S("K4-02-yil-donumu-yeniden-deneme", "K4", "31.12 'Bu Ay': A Başarısız; 01.01 yeniden deneme ARALIK ekstresi; 01.01 'Geçen Ay' (Aralık) elenir, 'Bu Ay' (Ocak) gider",
  "K4, K1 (31.12 → 01.01)", [A()],
  [baslat("+0s", "T1", "A", donem=BU_AY), olay("+1d", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), baslat("+1d30m", "T2", "A", donem=GECEN_AY),
   baslat("+1d31m", "T3", "A", donem=BU_AY), kontrol("+1d1h", "K1")],
  {"yeniden": {"Y1": yeniden(alinan="A")}, "isler.T1/A.degiskenler": ["Ayşe Yılmaz", FIRMA, "01.12.2026 – 31.12.2026", "1.250,00 TL"],
   "olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2027-01-01"}}, "toplular.T3.is_sayisi": 1,
   "meta.post": {"A": 3}},
  baslangic="2026-12-31T10:00:00+03:00", meta_davranis={"mesaj": {"A": [{"hata": 131026}]}, "kanca": {"*": K_STD}})

S("K4-03-son-3-ay-yeniden-deneme-secim-tasinir", "K4", "'Son 3 Ay' Y Başarısız; 2. gün Başarısızları Yeniden Dene (seçim taşınır); 3. gün 'Son 3 Ay' Y 'Daha Önce Gönderildi'",
  "K4 (yeniden deneme asıl işin döneminde), K1 (7 gün) — güncelleme 3'te Yine de Gönder yerine yeniden deneme (D6 ile iki neden aynı anda: README §8.4)", [Y()],
  [baslat("+0s", "T1", "Y", donem=SON3), olay("+2d", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), baslat("+3d", "T2", "Y", donem=SON3), kontrol("+3d1h", "K1")],
  {"yeniden": {"Y1": yeniden(alinan="Y")}, "olusmadi": ["T2"], "elenen": {"T2": {"Y": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-11-01"}},
   "meta.post": {"Y": 2}, "isler.T1/Y.durum": "Teslim Edildi"},
  meta_davranis={"mesaj": {"Y": [{"hata": 131026}]}, "kanca": {"*": K_STD}})

# ---- K5: asıl işin "Yine de Gönder" kararı taşınır ----
S("K5-01-karar-yeniden-denemeye-tasinir", "K5", "T0'da gönderilmiş A'ya T1 'Yine de Gönder' ile; T1'de A Başarısız → Başarısızları Yeniden Dene A'yı gönderir (açılıştan önceki kabul yok sayılır)",
  "K5 (07:05 'a şıkkı')", [A()],
  [baslat("+0s", "T0", "A"), baslat("+1h", "T1", "A", onceki="gonder"), olay("+2h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), kontrol("+3h", "K1")],
  {"onceki_uyari": {"T1": {"sayi": 1, "son": "2026-10-30"}}, "yeniden": {"Y1": yeniden(alinan="A")}, "meta.post": {"A": 3}, "isler.T1/A.durum": "Teslim Edildi",
   "isler.T1/A.hata_kodu": None, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta_davranis={"mesaj": {"A": ["kabul", {"hata": 131026}]}, "kanca": {"*": K_STD}})

S("K5-02-acilistan-sonra-baska-isle-giden-elenir", "K5", "T1 (Yine de Gönder) A Başarısız; T1 açıldıktan SONRA T2 ile A'ya aynı dönem gitti → T1'in yeniden denemesinde A 'Daha Önce Gönderildi'",
  "K5 (sonradan başka işle giden yine elenir)", [A()],
  [baslat("+0s", "T0", "A"), baslat("+1h", "T1", "A", onceki="gonder"), baslat("+2h", "T2", "A", onceki="gonder"),
   olay("+3h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1")],
  {"onceki_uyari": {"T1": {"sayi": 1, "son": "2026-10-30"}, "T2": {"sayi": 1, "son": "2026-10-30"}},
   "yeniden": {"Y1": yeniden(elenen={"A": "daha_once_gonderildi"})}, "meta.post": {"A": 3}, "isler.T1/A.durum": "Başarısız"},
  meta_davranis={"mesaj": {"A": ["kabul", {"hata": 131026}, "kabul"]}, "kanca": {"*": K_STD}})

S("K5-03-sonra-programin-saatine-gore", "K5", "T2 (T1'den sonra) Sonucu Belirsiz; Meta'nın bildirimi saat kaymasıyla T1'den ÖNCEYİ gösteriyor — 'sonra' programın saatine göre: T1 yeniden denemesinde A elenir",
  "K5 ('sonra' programın kendi saati — dk6 okuması)", [A()],
  [baslat("+0s", "T0", "A"), baslat("+1h", "T1", "A", onceki="gonder"), baslat("+2h", "T2", "A", onceki="gonder"),
   olay("+3h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1")],
  {"yeniden": {"Y1": yeniden(elenen={"A": "daha_once_gonderildi"})}, "meta.post": {"A": 3}, "isler.T2/A.durum": "Teslim Edildi", "isler.T1/A.durum": "Başarısız"},
  meta_davranis={"mesaj": {"A": ["kabul", {"hata": 131026}, "yanitsiz_kabul"]},
                 "kanca": {"A": {"1": [["sent", "2026-10-30T10:30:00+03:00", {"varis": "+30m"}], ["delivered", "2026-10-30T10:31:00+03:00", {"varis": "+31m"}]]}}})

S("K5-04-isteki-yine-de-gonder-karari-tasir", "K5", "T1 (Yine de Gönder) A Sonucu Belirsiz; işteki Yine de Gönder asıl işin kararıyla gider (T0 kabulü yok sayılır)",
  "K5 (işteki Yine de Gönder'e taşınır)", [A()],
  [baslat("+0s", "T0", "A"), baslat("+1h", "T1", "A", onceki="gonder"), olay("+2h", "yine_de_gonder", toplu="T1", cari="A", etiket="G1"), kontrol("+3h", "K1")],
  {"yeniden": {"G1": yeniden(alinan="A")}, "meta.post": {"A": 3}, "meta.toplam_meta_ileti": 2, "isler.T1/A.durum": "Teslim Edildi"},
  meta_davranis={"mesaj": {"A": ["kabul", "yanitsiz_red", "kabul"]}, "kanca": {"*": K_STD}})

S("K5-05-karar-yokken-onceki-gec-teslim-sayilir", "K5", "T0 Meta Bekletti iptal (sayılmaz) → T1 uyarısız A'yı alır, A Başarısız; T0'ın geç teslimi gelir; T1'de karar YOK → yeniden denemede A elenir",
  "K5 (sınır yalnız Yine de Gönder kararıyla), K7 (geç teslim sayılır)", [A()],
  [baslat("+0s", "T0", "A"), olay("+1h", "iptal", toplu="T0"), baslat("+1h30m", "T1", "A"), olay("+3h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1")],
  {"elenen": {}, "onceki_uyari": {}, "toplular.T1.is_sayisi": 1, "yeniden": {"Y1": yeniden(elenen={"A": "daha_once_gonderildi"})}, "meta.post": {"A": 2},
   "isler.T1/A.durum": "Başarısız", "isler.T0/A.durum": {"secenek": ["İptal", "Teslim Edildi"], "susuyor": GEC}},
  meta_davranis={"mesaj": {"A": ["kabul", {"hata": 131026}]}, "kanca": {"A": {"1": K49 + [["delivered", "+2h30m"]]}}})

# ---- K6: yeniden denemede Sonucu Belirsiz elemesi + öneri ----
S("K6-01-yeniden-denemesi-belirsiz-elenir", "K6", "A Başarısız → yeniden deneme Sonucu Belirsiz → asıl işte ikinci kez Başarısızları Yeniden Dene: A 'Sonucu Belirsiz' elenir (öneri işteki Yine de Gönder); Yine de Gönder ile gider",
  "K6 (08:00 'A', 11:45 'A')", [A()],
  [baslat("+0s", "T1", "A"), olay("+1h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), kontrol("+1h30m", "K1"),
   olay("+2h", "basarisizlari_yeniden_dene", toplu="T1", hedef="asil", etiket="Y2"), olay("+3h", "yine_de_gonder", toplu="T1", cari="A", etiket="G1"), kontrol("+4h", "K2")],
  {"yeniden": {"Y1": yeniden(alinan="A"), "Y2": yeniden(elenen={"A": "sonucu_belirsiz"}, oneri="isteki_yine_de_gonder"), "G1": yeniden(alinan="A")},
   "kontroller.K1.isler": {"T1/A": "Sonucu Belirsiz"}, "kontroller.K2.toplam_post": 3, "meta.post": {"A": 3}, "isler.T1/A.durum": "Teslim Edildi"},
  meta_davranis={"mesaj": {"A": [{"hata": 131026}, "yanitsiz_red", "kabul"]}, "kanca": {"*": K_STD}})

S("K6-02-asil-isin-karari-belirsizi-gecmez", "K6", "T1 'Yine de Gönder' kararıyla açıldı; yeniden denemesi Sonucu Belirsiz: ikinci yeniden denemede yine 'Sonucu Belirsiz' elenir; işteki Yine de Gönder kararla gider",
  "K6 (09:35 'A': karar Sonucu Belirsiz elemesini geçmez), K5", [A()],
  [baslat("+0s", "T0", "A"), baslat("+1h", "T1", "A", onceki="gonder"), olay("+2h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"),
   olay("+3h", "basarisizlari_yeniden_dene", toplu="T1", hedef="asil", etiket="Y2"), olay("+4h", "yine_de_gonder", toplu="T1", cari="A", etiket="G1")],
  {"yeniden": {"Y1": yeniden(alinan="A"), "Y2": yeniden(elenen={"A": "sonucu_belirsiz"}, oneri="isteki_yine_de_gonder"), "G1": yeniden(alinan="A")},
   "meta.post": {"A": 4}, "isler.T1/A.durum": "Teslim Edildi"},
  meta_davranis={"mesaj": {"A": ["kabul", {"hata": 131026}, "yanitsiz_red", "kabul"]}, "kanca": {"*": K_STD}})

S("K6-03-acilistan-once-belirsiz-geri-yukleme-sonrasi", "K6", "T0 Sonucu Belirsiz, sonra T0'dan ÖNCEKİ yedek geri yüklendi (iş dosyada yok); T2 'Yine de Gönder' kararıyla, A Başarısız: yeniden denemede A 'Sonucu Belirsiz' elenir, öneri 'yeni gönderim başlatın'",
  "K6 (09:35 'A': açılıştan önce belirsiz kalan da eler; 11:45 'A': iş yoksa yeni gönderim)", [A()],
  [olay("+0s", "yedek_al", ad="Y0"), baslat("+1s", "T0", "A"), olay("+10m", "geri_yukle", yedek="Y0"), kontrol("+15m", "K1"), baslat("+20m", "T1", "A"),
   baslat("+30m", "T2", "A", onceki="gonder"), olay("+40m", "basarisizlari_yeniden_dene", toplu="T2", etiket="Y1"), kontrol("+50m", "K2")],
  {"kontroller.K1.isler": {}, "kontroller.K1.toplular": {}, "elenen": {}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}},
   "yeniden": {"Y1": yeniden(elenen={"A": "sonucu_belirsiz"}, oneri="yeni_gonderim")}, "meta.post": {"A": 2}, "meta.toplam_post": 3,
   "isler.T1/A.durum": "Meta Kabul Etti", "isler.T2/A.durum": "Başarısız"},
  meta_davranis={"mesaj": {"A": ["yanitsiz_red", "kabul", {"hata": 131026}]}},
  bilinen_ihlal={"post_toplam": {"neden": "geri yüklemeyle dosyadan çıkan işin POST'u Meta'da kalır; iş başına sayım dosyadaki işlerden (sürücü de böyle)"}})

S("K6-04-hic-basarisiz-olmamis-belirsiz-aday-degil", "K6", "Asıl işte A Başarısız, B Sonucu Belirsiz (hiç Başarısız olmadı): Başarısızları Yeniden Dene yalnız A'yı alır; B adayı değil (yanıtta yok)",
  "K6 kapsamı + §6 W4 (yalnız kesin Başarısız; kâhin yorumu 20)", [A(), B()],
  [baslat("+0s", "T1", "AB"), olay("+1h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), kontrol("+2h", "K1")],
  {"yeniden": {"Y1": yeniden(alinan="A")}, "meta.post": {"A": 2, "B": 1}, "isler.T1/B.durum": "Sonucu Belirsiz", "isler.T1/A.durum": "Teslim Edildi"},
  meta_davranis={"mesaj": {"A": [{"hata": 131026}], "B": ["yanitsiz_red"]}, "kanca": {"*": K_STD}})


# ---- K8: Gönderimler listesi ----
def _gun(i):
    from datetime import date as _d, timedelta as _td
    return (_d(2026, 1, 1) + _td(days=i)).isoformat()


_K8_1 = [baslat(f"+{i}m", f"T{i:02d}", "A", donem={"bas": _gun(i), "son": _gun(i)}) for i in range(1, 66)]
S("K8-01-sayfalama-imlec-kaymaz", "K8", "65 gönderim + kaydı oluşmayan 1: en yeni önce 30'ar; ilk sayfadan sonra yeni gönderim girince 'Daha Fazla Göster' kaymaz",
  "K8 (08:20: Daha Fazla Göster 30'ar, imleçli; en yeni önce)", [A(), cari("Q", "İstemez Kişi", "0543 000 11 22", istemiyor=True)],
  _K8_1 + [baslat("+30m30s", "TX", ["Q"]), olay("+70m", "liste", ad="L1"), baslat("+71m", "T66", "A", donem={"bas": _gun(66), "son": _gun(66)}),
           olay("+72m", "liste", ad="L2", devam="L1"), olay("+73m", "liste", ad="L3", devam="L2"), olay("+74m", "liste", ad="L4")],
  {"olusmadi": ["TX"],
   "listeler.L1": {"etiketler": [f"T{i:02d}" for i in range(65, 35, -1)], "daha_fazla": True},
   "listeler.L2": {"etiketler": [f"T{i:02d}" for i in range(35, 5, -1)], "daha_fazla": True},
   "listeler.L3": {"etiketler": [f"T{i:02d}" for i in range(5, 0, -1)], "daha_fazla": False},
   "listeler.L4": {"etiketler": [f"T{i:02d}" for i in range(66, 36, -1)], "daha_fazla": True},
   "meta.toplam_post": 66},
  ozet_cikti=True, meta_davranis={"kanca": {"*": K_STD}})

S("K8-02-tarih-suzgeci-yerel-gun", "K8", "Başlangıç/Bitiş YEREL gün, iki uç dahil (23:59:30, 00:00:30, 23:59:50, 00:00:10 sınırları; UTC'de gün farklı); Başlangıç > Bitiş reddedilir",
  "K8 (Başlangıç/Bitiş tarih süzgeci)", [A()],
  [baslat("+30s", "T1", "A", donem={"bas": _gun(1), "son": _gun(1)}), baslat("+1m30s", "T2", "A", donem={"bas": _gun(2), "son": _gun(2)}),
   baslat("+12h1m", "T3", "A", donem={"bas": _gun(3), "son": _gun(3)}), baslat("+24h50s", "T4", "A", donem={"bas": _gun(4), "son": _gun(4)}),
   baslat("+24h1m10s", "T5", "A", donem={"bas": _gun(5), "son": _gun(5)}),
   olay("+25h", "liste", ad="L1", bas="2026-10-30", son="2026-10-30"), olay("+25h", "liste", ad="L2", bas="2026-10-29", son="2026-10-30"),
   olay("+25h", "liste", ad="L3", bas="2026-10-31", son="2026-10-31"), olay("+25h", "liste", ad="L4", bas="2026-10-31", son="2026-10-30")],
  {"listeler": {"L1": {"etiketler": ["T4", "T3", "T2"], "daha_fazla": False}, "L2": {"etiketler": ["T4", "T3", "T2", "T1"], "daha_fazla": False},
                "L3": {"etiketler": ["T5"], "daha_fazla": False}, "L4": {"ret": "bas_son_ters"}}},
  baslangic="2026-10-29T23:59:00+03:00", ozet_cikti=True, meta_davranis={"kanca": {"*": K_STD}})

_K8_3 = ([baslat(f"+{10 * (i - 1)}m", f"T{i:02d}", "A", donem={"bas": _gun(i), "son": _gun(i)}) for i in range(1, 34)]
         + [baslat(f"+24h{i}m", f"T{i:02d}", "A", donem={"bas": _gun(i), "son": _gun(i)}) for i in (34, 35)])
S("K8-03-suzgec-ile-sayfalama", "K8", "Tek günde 33 gönderim + ertesi gün 2: o günün süzgecinde 30 + 'Daha Fazla Göster' ile 3; ertesi gün süzgecinde 2",
  "K8 (süzgeç + imleç birlikte)", [A()],
  _K8_3 + [olay("+25h", "liste", ad="L1", bas="2026-10-30", son="2026-10-30"), olay("+25h1m", "liste", ad="L2", devam="L1"),
           olay("+25h2m", "liste", ad="L3", bas="2026-10-31", son="2026-10-31")],
  {"listeler": {"L1": {"etiketler": [f"T{i:02d}" for i in range(33, 3, -1)], "daha_fazla": True},
                "L2": {"etiketler": ["T03", "T02", "T01"], "daha_fazla": False}, "L3": {"etiketler": ["T35", "T34"], "daha_fazla": False}}},
  baslangic="2026-10-30T00:10:00+03:00", ozet_cikti=True, meta_davranis={"kanca": {"*": K_STD}})


# ======================================================================== KÂHİN GÜNCELLEMESİ 3 (31.10.2026): ★ soruların yanıtları D1–D8
# Kaynak: iş listesi "★ SORU n/8" (kullanıcı yanıtları; metinler kahin.KARARLAR D1–D8). Yeni olay türü YOK (yedek_al / geri_yukle {yedek} / etiketli yeniden deneme
# güncelleme 2'den). Sınırlar: ay sonu, yıl dönümü, gece yarısı (yerel ≠ UTC), 6g23s / 7g1s.
KF = [["sent", "+1s"], ["failed", "+3s", {"kod": 131026}]]


def I_(**kw):
    return cari("I", "İsmail Vade", "0540 999 00 11", [("2026-10-02", 500, 0)], vadeler=[{"vade": "2026-10-25", "kalan": 500}], **kw)


# ---- D1: Sonucu Belirsiz kişi YENİ toplu işte de elenir ----
S("D1-01-belirsiz-yeni-toplu-iste-elenir", "D1", "A Sonucu Belirsiz: yeni seçimde 'Sonucu Belirsiz' elenir (B 'Daha Önce Gönderildi'); R3'teki 'Yine de Gönder' bu elemeyi geçmez; işteki Yine de Gönder ile gider",
  "D1 (madde 1 'b': yeni toplu işte de elenir; çaresi işteki Yine de Gönder)", [A(), B()],
  [baslat("+0s", "T1", "AB"), baslat("+1h", "T2", "AB"), baslat("+2h", "T3", "AB", onceki="gonder"), olay("+3h", "yine_de_gonder", toplu="T1", cari="A", etiket="G1"),
   kontrol("+4h", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"A": "sonucu_belirsiz", "B": "daha_once_gonderildi"}, "T3": {"A": "sonucu_belirsiz"}},
   "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}, "T3": {"sayi": 1, "son": "2026-10-30"}}, "toplular.T3.is_sayisi": 1,
   "yeniden": {"G1": yeniden(alinan="A")}, "meta.post": {"A": 2, "B": 2}, "isler.T1/A.durum": "Teslim Edildi"},
  meta_davranis={"mesaj": {"A": ["yanitsiz_red", "kabul"]}, "kanca": {"*": K_STD}})

S("D1-02-belirsiz-ay-sonu-eslik", "D1", "31.10 'Bu Ay' A Sonucu Belirsiz: 01.11 'Geçen Ay' (Ekim) 'Sonucu Belirsiz' elenir; 01.11 'Bu Ay' (Kasım) gider", "D1 (eşlik K1: takvim ayı)",
  [A()], [baslat("+0s", "T1", "A", donem=BU_AY), baslat("+1d", "T2", "A", donem=GECEN_AY), baslat("+1d1m", "T3", "A", donem=BU_AY), kontrol("+1d1h", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"A": "sonucu_belirsiz"}}, "toplular.T3.is_sayisi": 1, "meta.post": {"A": 2}, "isler.T1/A.durum": "Sonucu Belirsiz",
   "isler.T3/A.durum": "Teslim Edildi"},
  baslangic="2026-10-31T10:00:00+03:00", meta_davranis={"mesaj": {"A": ["yanitsiz_red"]}, "kanca": {"*": K_STD}})

S("D1-03-belirsiz-son-3-ay-7-gun", "D1", "'Son 3 Ay' Y Sonucu Belirsiz: 6 gün 23 saat sonra aynı seçim 'Sonucu Belirsiz' elenir; 7 gün 1 saat sonra gider", "D1 + D6 (Son 3 Ay: son 7 gün, gönderim anından)",
  [Y()], [baslat("+0s", "T1", "Y", donem=SON3), baslat("+6d23h", "T2", "Y", donem=SON3), baslat("+7d1h", "T3", "Y", donem=SON3), kontrol("+7d2h", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"Y": "sonucu_belirsiz"}}, "toplular.T3.is_sayisi": 1, "meta.post": {"Y": 2}, "isler.T3/Y.durum": "Teslim Edildi"},
  meta_davranis={"mesaj": {"Y": ["yanitsiz_red"]}, "kanca": {"*": K_STD}})

# ---- D2: Ödeme Hatırlatma — R3 aynı yerel gün; Zaten Kuyrukta gün bakılmadan ----
S("D2-01-hatirlatma-dunden-bekleyen-bugunku-eler", "D2", "30.10 23:00 hatırlatma sınır 1: I bekliyor; 31.10 10:00 (yerel ve UTC'de başka gün) yeni hatırlatmada I 'Zaten Kuyrukta'",
  "D2 (madde 2 'a' (b): süren hatırlatma işi varken yenisi gün bakılmadan Zaten Kuyrukta)", [H(), I_()],
  [baslat("+0s", "T1", ["H", "I"], sablon="hatirlatma"), baslat("+11h", "T2", ["I"], sablon="hatirlatma"), kontrol("+11h30m", "K1"), kontrol("+25h", "K2")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"I": "zaten_kuyrukta"}}, "kontroller.K1.isler": {"T1/H": "Teslim Edildi", "T1/I": "Sınır Nedeniyle Bekliyor"},
   "kontroller.K2.isler": {"T1/H": "Teslim Edildi", "T1/I": "Teslim Edildi"}, "meta.post": {"H": 1, "I": 1}},
  baslangic="2026-10-30T23:00:00+03:00", ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("D2-02-hatirlatma-uc-gundur-bekleyen-ve-ertesi-gun-serbest", "D2", "Duraklatılmış hatırlatmada I 3 gündür bekliyor: yeni hatırlatmada 'Zaten Kuyrukta'; H'ye 3 gün sonra yeni hatırlatma gider (aynı gün değil)",
  "D2 (b: gün bakılmadan Zaten Kuyrukta; a: ertesi gün serbest)", [H(), I_()],
  [baslat("+0s", "T1", ["H", "I"], sablon="hatirlatma"), olay("+1m", "duraklat", toplu="T1"), baslat("+3d", "T2", ["I"], sablon="hatirlatma"),
   baslat("+3d1m", "T3", ["H"], sablon="hatirlatma"), kontrol("+3d1h", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"I": "zaten_kuyrukta"}}, "onceki_uyari": {}, "toplular.T3.is_sayisi": 1,
   "kontroller.K1.isler": {"T1/H": "Teslim Edildi", "T1/I": "Duraklatıldı", "T3/H": "Teslim Edildi"}, "meta.post": {"H": 2, "I": 0}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

# ---- D3: Son 3 Ay / Tüm'de yeniden deneme ve Yine de Gönder için 7 gün YENİ GÖNDERİM ANINDAN ----
S("D3-01-yeniden-deneme-7-gun-yeni-gonderimden", "D3", "T1 'Son 3 Ay' A Başarısız; T2 (1 saat sonra) A'ya gitti: T1'in yeniden denemesi 6g23s sonra elenir, 7g1s sonra gider (7 gün asıl işin açılışından değil)",
  "D3 (madde 5 'a')", [A()],
  [baslat("+0s", "T1", "A", donem=SON3), baslat("+1h", "T2", "A", donem=SON3), olay("+7d", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"),
   olay("+7d2h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y2"), kontrol("+7d3h", "K1")],
  {"yeniden": {"Y1": yeniden(elenen={"A": "daha_once_gonderildi"}), "Y2": yeniden(alinan="A")}, "meta.post": {"A": 3}, "isler.T1/A.durum": "Teslim Edildi",
   "toplular.T2.is_sayisi": 1},
  meta_davranis={"mesaj": {"A": [{"hata": 131026}]}, "kanca": {"*": K_STD}})

S("D3-02-yine-de-gonder-7-gun-yeni-gonderimden", "D3", "T1 'Tüm Hareketler' A Sonucu Belirsiz; 8. gün T2 (belirsiz 7 günü geçti) A'ya gitti; T1'de Yine de Gönder 6g23s sonra elenir, 7g2s sonra gider",
  "D3 (madde 5 'a'), D1 (7 gün)", [A()],
  [baslat("+0s", "T1", "A", donem="tum"), baslat("+8d", "T2", "A", donem="tum"), olay("+14d23h", "yine_de_gonder", toplu="T1", cari="A", etiket="G1"),
   olay("+15d2h", "yine_de_gonder", toplu="T1", cari="A", etiket="G2"), kontrol("+15d3h", "K1")],
  {"elenen": {}, "yeniden": {"G1": yeniden(elenen={"A": "daha_once_gonderildi"}), "G2": yeniden(alinan="A")}, "meta.post": {"A": 3},
   "isler.T1/A.durum": "Teslim Edildi", "isler.T2/A.durum": "Teslim Edildi"},
  bitis="+15d4h", meta_davranis={"mesaj": {"A": ["yanitsiz_red"]}, "kanca": {"*": K_STD}})

# ---- D4: özel aralık ↔ aynı tarihli hazır seçim aynı dönem ----
S("D4-01-ozel-aralik-ayni-gun-bu-ay", "D4", "15.10 'Bu Ay' (01.10–15.10) gönderildi: aynı gün özel 01.10–15.10 elenir; özel 01.10–14.10 gider",
  "D4 (madde 6 'b': Bu Ay = ayın 1'i – bugün)", [A()],
  [baslat("+0s", "T1", "A", donem=BU_AY), baslat("+1h", "T2", "A", donem={"bas": "2026-10-01", "son": "2026-10-15"}),
   baslat("+2h", "T3", "A", donem={"bas": "2026-10-01", "son": "2026-10-14"}), kontrol("+3h", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-15"}}, "toplular.T3.is_sayisi": 1,
   "meta.post": {"A": 2}, "isler.T3/A.degiskenler": ["Ayşe Yılmaz", FIRMA, "01.10.2026 – 14.10.2026", "1.500,00 TL"]},
  baslangic="2026-10-15T10:00:00+03:00", meta_davranis={"kanca": {"*": K_STD}})

S("D4-02-ay-sonu-bu-ay-sonra-ozel-aralik", "D4", "31.10 'Bu Ay' (01.10–31.10) gönderildi: 01.11 özel 01.10–31.10 (= 'Geçen Ay') elenir; özel 01.11–01.11 gider",
  "D4 (Geçen Ay = önceki ayın 1'i – son günü; ay sonu → 1'i)", [A()],
  [baslat("+0s", "T1", "A", donem=BU_AY), baslat("+1d", "T2", "A", donem={"bas": "2026-10-01", "son": "2026-10-31"}),
   baslat("+1d1m", "T3", "A", donem={"bas": "2026-11-01", "son": "2026-11-01"}), kontrol("+1d1h", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-31"}}, "toplular.T3.is_sayisi": 1,
   "meta.post": {"A": 2}},
  baslangic="2026-10-31T10:00:00+03:00", meta_davranis={"kanca": {"*": K_STD}})

S("D4-03-yil-donumu-ozel-aralik-zaten-kuyrukta", "D4", "31.12 23:00 özel 01.12–31.12 sınır 1: B bekliyor; 01.01 00:30 'Geçen Ay' (Aralık) B 'Zaten Kuyrukta'",
  "D4 (Zaten Kuyrukta da; 31.12 → 01.01, gece yarısı)", [A(), B()],
  [baslat("+0s", "T1", "AB", donem={"bas": "2026-12-01", "son": "2026-12-31"}), baslat("+1h30m", "T2", "B", donem=GECEN_AY), kontrol("+2h", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"B": "zaten_kuyrukta"}}, "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Sınır Nedeniyle Bekliyor"},
   "meta.post": {"A": 1, "B": 1}},
  baslangic="2026-12-31T23:00:00+03:00", ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

# ---- D5: asıl işte Başarısız, sonraki denemesi kabul edilmiş / bekleyen ----
S("D5-01-sonraki-denemesi-kabul-daha-once", "D5", "A Başarısız → yeniden deneme teslim edildi → asıl işte yeniden Başarısızları Yeniden Dene: A 'Daha Önce Gönderildi'",
  "D5 (madde 9 'a')", [A()],
  [baslat("+0s", "T1", "A"), olay("+1h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"),
   olay("+2h", "basarisizlari_yeniden_dene", toplu="T1", hedef="asil", etiket="Y2"), kontrol("+3h", "K1")],
  {"yeniden": {"Y1": yeniden(alinan="A"), "Y2": yeniden(elenen={"A": "daha_once_gonderildi"})}, "meta.post": {"A": 2}, "isler.T1/A.durum": "Teslim Edildi"},
  meta_davranis={"mesaj": {"A": [{"hata": 131026}]}, "kanca": {"*": K_STD}})

S("D5-02-sonraki-denemesi-bekliyor-zaten-kuyrukta", "D5", "Sınır 1: A Başarısız → yeniden deneme sınırda bekliyor → asıl işte yeniden Başarısızları Yeniden Dene: A 'Zaten Kuyrukta'",
  "D5 (madde 9 'a')", [A(), B()],
  [baslat("+0s", "T1", "AB"), olay("+1h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"),
   olay("+2h", "basarisizlari_yeniden_dene", toplu="T1", hedef="asil", etiket="Y2"), kontrol("+3h", "K1")],
  {"yeniden": {"Y1": yeniden(alinan="A"), "Y2": yeniden(elenen={"A": "zaten_kuyrukta"})}, "kontroller.K1.isler": {"T1/A": "Sınır Nedeniyle Bekliyor", "T1/B": "Teslim Edildi"},
   "meta.post": {"A": 2, "B": 1}, "isler.T1/A.durum": "Teslim Edildi"},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"mesaj": {"A": [{"hata": 131026}]}, "kanca": {"*": K_STD}})

# ---- D6: Yine de Gönder ile aşılmış eski Sonucu Belirsiz deneme de sayılır ----
S("D6-01-asilmis-belirsiz-yeni-toplu-iste-eler", "D6", "A Sonucu Belirsiz → Yine de Gönder → Başarısız (131026): eski belirsiz deneme sayılır, yeni seçimde A 'Sonucu Belirsiz'",
  "D6 (madde 10 'a'), D1", [A()],
  [baslat("+0s", "T1", "A"), olay("+1h", "yine_de_gonder", toplu="T1", cari="A", etiket="G1"), kontrol("+2h", "K1"), baslat("+3h", "T2", "A")],
  {"yeniden": {"G1": yeniden(alinan="A")}, "kontroller.K1.isler": {"T1/A": "Başarısız"}, "olusmadi": ["T2"], "elenen": {"T2": {"A": "sonucu_belirsiz"}},
   "meta.post": {"A": 2}},
  meta_davranis={"mesaj": {"A": ["yanitsiz_red", "kabul"]}, "kanca": {"A": {"1": KF}}})

S("D6-02-asilmis-belirsiz-yeniden-denemede-eler", "D6", "A Sonucu Belirsiz → Yine de Gönder → Başarısız: Başarısızları Yeniden Dene A'yı 'Sonucu Belirsiz' ile eler (öneri işteki Yine de Gönder)",
  "D6 (madde 10 'a'), K6", [A()],
  [baslat("+0s", "T1", "A"), olay("+1h", "yine_de_gonder", toplu="T1", cari="A", etiket="G1"), olay("+2h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1")],
  {"yeniden": {"G1": yeniden(alinan="A"), "Y1": yeniden(elenen={"A": "sonucu_belirsiz"}, oneri="isteki_yine_de_gonder")}, "meta.post": {"A": 2},
   "isler.T1/A.durum": "Başarısız"},
  meta_davranis={"mesaj": {"A": ["yanitsiz_red", "kabul"]}, "kanca": {"A": {"1": KF}}})

S("D6-03-asilmis-belirsiz-son-3-ay-7-gun", "D6", "'Son 3 Ay' Y: belirsiz → Yine de Gönder → Başarısız; 6g23s sonra yeni seçimde 'Sonucu Belirsiz', 7g1s sonra gider (7 gün belirsiz denemenin gönderim anından)",
  "D6 (Son 3 Ay / Tüm'de son 7 gün gönderim anından)", [Y()],
  [baslat("+0s", "T1", "Y", donem=SON3), olay("+1h", "yine_de_gonder", toplu="T1", cari="Y", etiket="G1"), baslat("+6d23h", "T2", "Y", donem=SON3),
   baslat("+7d1h", "T3", "Y", donem=SON3), kontrol("+7d2h", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"Y": "sonucu_belirsiz"}}, "toplular.T3.is_sayisi": 1, "meta.post": {"Y": 3}, "isler.T3/Y.durum": "Başarısız"},
  meta_davranis={"mesaj": {"Y": ["yanitsiz_red", "kabul", "kabul"]}, "kanca": {"Y": {"1": KF}}})

# ---- D7: geri yüklemeden sonra yalnız makine defterinde kalan KABUL R3'te sayılır ----
S("D7-01-geri-yukleme-sonrasi-defterdeki-kabul-sayilir", "D7", "Yedek alındı, A'ya gönderildi (Meta Kabul Etti), önceki yedek geri yüklendi (iş dosyada yok): aynı dönem 'Daha Önce Gönderildi'",
  "D7 (madde 13 'a')", [A()],
  [olay("+0s", "yedek_al", ad="Y0"), baslat("+1s", "T1", "A"), olay("+10m", "geri_yukle", yedek="Y0"), kontrol("+15m", "K1"), baslat("+20m", "T2", "A")],
  {"kontroller.K1.isler": {}, "olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}},
   "meta.toplam_post": 1, "meta.post": {}},
  bilinen_ihlal={"post_toplam": {"neden": "geri yüklemeyle dosyadan çıkan işin POST'u Meta'da kalır; iş başına sayım dosyadaki işlerden"}})

S("D7-02-geri-yukleme-ay-donumu-defterdeki-kabul", "D7", "31.10 22:00 yedek, 'Bu Ay' A'ya gönderildi, yedek geri yüklendi; 01.11 01:00 'Geçen Ay' (Ekim) 'Daha Önce Gönderildi'",
  "D7, K1 (ay sonu → 1'i, gece yarısı)", [A()],
  [olay("+0s", "yedek_al", ad="Y0"), baslat("+1s", "T1", "A", donem=BU_AY), olay("+1h", "geri_yukle", yedek="Y0"), baslat("+3h", "T2", "A", donem=GECEN_AY)],
  {"olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-31"}}, "meta.toplam_post": 1},
  baslangic="2026-10-31T22:00:00+03:00",
  bilinen_ihlal={"post_toplam": {"neden": "geri yüklemeyle dosyadan çıkan işin POST'u Meta'da kalır; iş başına sayım dosyadaki işlerden"}})

# ---- D8: taşınan veride dosyadaki kabul / teslim / okundu R3'te sayılır ----
S("D8-01-tasinan-veride-dosyadaki-ileti-sayilir", "D8", "A Teslim, B Okundu, C Meta Kabul Etti; veri başka bilgisayara taşındı: yeni seçimde üçü de 'Daha Önce Gönderildi'",
  "D8 (madde 14 'a'; eski ★6 düştü)", [A(), B(), C()],
  [baslat("+0s", "T1", "ABC"), olay("+1h", "tasindi"), baslat("+2h", "T2", "ABC")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi", "B": "daha_once_gonderildi", "C": "daha_once_gonderildi"}},
   "onceki_uyari": {"T2": {"sayi": 3, "son": "2026-10-30"}}, "meta.post": {"A": 1, "B": 1, "C": 1},
   "isler.T1/A.durum": "Teslim Edildi", "isler.T1/B.durum": "Okundu", "isler.T1/C.durum": "Meta Kabul Etti"},
  bitis="+3h", meta_davranis={"kanca": {"A": K_STD, "B": K_STD + [["read", "+1m"]], "C": []}})

S("D8-02-tasinan-veride-yine-de-gonder", "D8", "Taşınan veride A Teslim Edildi: varsayılan Bunları Çıkar ile elenir; 'Yine de Gönder' ile ikinci ileti",
  "D8 (varsayılan Bunları Çıkar), R3", [A()],
  [baslat("+0s", "T1", "A"), olay("+1h", "tasindi"), baslat("+2h", "T2", "A"), baslat("+2h1m", "T3", "A", onceki="gonder"), kontrol("+3h", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}, "T3": {"sayi": 1, "son": "2026-10-30"}},
   "toplular.T3.is_sayisi": 1, "meta.post": {"A": 2}},
  meta_davranis={"kanca": {"*": K_STD}})


# ======================================================================== KÂHİN GÜNCELLEMESİ 4 (31.10.2026): N2–N5 yanıtları E1–E4 + N6
# Kaynak: ana oturumun iletisi (kullanıcı kararları AYNEN, kahin.KARARLAR E1–E4, N6). Yeni olay türü YOK.
GERI_IHLAL = {"post_toplam": {"neden": "geri yüklemeyle dosyadan çıkan işin POST'u Meta'da kalır; iş başına sayım dosyadaki işlerden"}}

S("E1-01-dosyada-ve-defterde-belirsiz", "E1", "A'nın belirsizi yalnız makine defterinde (geri yükleme), B'ninki dosyada: yeni işte B 'Sonucu Belirsiz' elenir, A alınır; A Başarısız olunca yeniden denemede 'Sonucu Belirsiz' (öneri yeni gönderim); yeni gönderimle gider",
  "E1 (N2 'a'; yorum 21 teyit)", [A(), B()],
  [olay("+0s", "yedek_al", ad="Y0"), baslat("+1s", "T0", "A"), olay("+10m", "geri_yukle", yedek="Y0"), baslat("+15m", "T1", "B"), baslat("+20m", "T2", "AB"),
   olay("+30m", "basarisizlari_yeniden_dene", toplu="T2", etiket="Y1"), baslat("+40m", "T3", "A"), kontrol("+1h", "K1")],
  {"elenen": {"T2": {"B": "sonucu_belirsiz"}}, "toplular.T2.is_sayisi": 1, "yeniden": {"Y1": yeniden(elenen={"A": "sonucu_belirsiz"}, oneri="yeni_gonderim")},
   "toplular.T3.is_sayisi": 1, "isler.T3/A.durum": "Teslim Edildi", "meta.post": {"A": 2, "B": 1}, "meta.toplam_post": 4},
  meta_davranis={"mesaj": {"A": ["yanitsiz_red", {"hata": 131026}, "kabul"], "B": ["yanitsiz_red"]}, "kanca": {"*": K_STD}}, bilinen_ihlal=GERI_IHLAL)

# ---- E2: TEK neden; sıra her yerde Zaten Kuyrukta → Sonucu Belirsiz → Daha Önce Gönderildi ----
S("E2-01-yeni-is-uclu-cakisma", "E2", "A: önceden gönderildi (R3) + aşılmış belirsiz deneme + Yine de Gönder ile sınırda bekliyor; yeni seçimde 'Yine de Gönder' denilse de TEK neden 'Zaten Kuyrukta', R3 uyarısına girmez",
  "E2 (N3 'a'), D1, D6", [A(), B()],
  [baslat("+0s", "T0", "A"), baslat("+1h", "T1", "A", onceki="gonder"), baslat("+25h59m", "TB", "B"), olay("+26h", "yine_de_gonder", toplu="T1", cari="A", etiket="G1"),
   baslat("+26h30m", "T2", "A", onceki="gonder"), kontrol("+26h40m", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"A": "zaten_kuyrukta"}}, "onceki_uyari": {"T1": {"sayi": 1, "son": "2026-10-30"}}, "yeniden": {"G1": yeniden(alinan="A")},
   "kontroller.K1.isler": {"T0/A": "Teslim Edildi", "T1/A": "Sınır Nedeniyle Bekliyor", "TB/B": "Teslim Edildi"}, "meta.post": {"A": 3, "B": 1}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"mesaj": {"A": ["kabul", "yanitsiz_red", "kabul"]}, "kanca": {"*": K_STD}})

S("E2-02-yeni-is-belirsiz-ve-r3-yine-de-gonder", "E2", "A belirsiz + önceden gönderildi, B önceden gönderildi; yeni seçimde 'Yine de Gönder': B gider, A 'Sonucu Belirsiz' (uyarı sayısı yalnız B)",
  "E2 (R3'te Yine de Gönder seçilse de gitmez; uyarıya girmez)", [A(), B()],
  [baslat("+0s", "T0", "AB"), baslat("+1h", "T1", "A", onceki="gonder"), baslat("+2h", "T2", "AB", onceki="gonder"), kontrol("+3h", "K1")],
  {"elenen": {"T2": {"A": "sonucu_belirsiz"}}, "onceki_uyari": {"T1": {"sayi": 1, "son": "2026-10-30"}, "T2": {"sayi": 1, "son": "2026-10-30"}},
   "toplular.T2.is_sayisi": 1, "meta.post": {"A": 2, "B": 2}},
  meta_davranis={"mesaj": {"A": ["kabul", "yanitsiz_red"]}, "kanca": {"*": K_STD}})

S("E2-03-yeniden-denemede-kuyrukta-once-belirsiz", "E2", "A'nın defterde belirsizi var ve başka işte sınırda bekliyor: asıl işin yeniden denemesinde TEK neden 'Zaten Kuyrukta' (Sonucu Belirsiz değil)",
  "E2 (yeniden denemede sıra), E1, N6", [A(), B()],
  [olay("+0s", "yedek_al", ad="Y0"), baslat("+1s", "T0", "A"), olay("+10m", "geri_yukle", yedek="Y0"), baslat("+20m", "T1", "A"), baslat("+30m", "T2", ["B", "A"]),
   olay("+40m", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), kontrol("+50m", "K1")],
  {"yeniden": {"Y1": yeniden(elenen={"A": "zaten_kuyrukta"})}, "kontroller.K1.isler": {"T1/A": "Başarısız", "T2/A": "Sınır Nedeniyle Bekliyor", "T2/B": "Teslim Edildi"},
   "meta.post": {"A": 2, "B": 1}, "meta.toplam_post": 4},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"mesaj": {"A": ["yanitsiz_red", {"hata": 131026}]}, "kanca": {"*": K_STD}}, bilinen_ihlal=GERI_IHLAL)

S("E2-04-yeniden-denemede-uclu-cakisma", "E2", "A: defterde belirsiz + asıl işin açılışından sonra gönderildi (R3) + başka işte sınırda bekliyor: yeniden denemede TEK neden 'Zaten Kuyrukta'",
  "E2 (üçlü, yeniden deneme)", [A(), B()],
  [olay("+0s", "yedek_al", ad="Y0"), baslat("+1s", "T0", "A"), olay("+10m", "geri_yukle", yedek="Y0"), baslat("+20m", "T1", "A"), baslat("+30m", "T2", "A"),
   baslat("+25h30m", "T3", ["B", "A"], onceki="gonder"), olay("+26h30m", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), kontrol("+26h40m", "K1")],
  {"yeniden": {"Y1": yeniden(elenen={"A": "zaten_kuyrukta"})}, "onceki_uyari": {"T3": {"sayi": 1, "son": "2026-10-30"}},
   "kontroller.K1.isler": {"T1/A": "Başarısız", "T2/A": "Teslim Edildi", "T3/A": "Sınır Nedeniyle Bekliyor", "T3/B": "Teslim Edildi"},
   "meta.post": {"A": 3, "B": 1}, "meta.toplam_post": 5},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"mesaj": {"A": ["yanitsiz_red", {"hata": 131026}, "kabul"]}, "kanca": {"*": K_STD}}, bilinen_ihlal=GERI_IHLAL)

S("E2-05-yeniden-denemede-belirsiz-once-r3", "E2", "A: defterde belirsiz + asıl işin açılışından sonra gönderildi: yeniden denemede TEK neden 'Sonucu Belirsiz' (Daha Önce Gönderildi değil), öneri yeni gönderim",
  "E2 (ikili, yeniden deneme), E1", [A()],
  [olay("+0s", "yedek_al", ad="Y0"), baslat("+1s", "T0", "A"), olay("+10m", "geri_yukle", yedek="Y0"), baslat("+20m", "T1", "A"), baslat("+30m", "T2", "A"),
   olay("+40m", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1")],
  {"yeniden": {"Y1": yeniden(elenen={"A": "sonucu_belirsiz"}, oneri="yeni_gonderim")}, "meta.post": {"A": 2}, "meta.toplam_post": 3, "isler.T2/A.durum": "Teslim Edildi"},
  meta_davranis={"mesaj": {"A": ["yanitsiz_red", {"hata": 131026}, "kabul"]}, "kanca": {"*": K_STD}}, bilinen_ihlal=GERI_IHLAL)

S("E2-06-isteki-yine-de-gonder-zaten-kuyrukta", "E2", "'Son 3 Ay' Y belirsiz; 8. gün (belirsiz 7 günü geçti) başka işte Y sınırda bekliyor: işteki Yine de Gönder 'Zaten Kuyrukta' ile elenir",
  "E2 (işteki Yine de Gönder'in açtığı işte de sıra), K2", [Y(), B()],
  [baslat("+0s", "T1", "Y", donem=SON3), baslat("+8d", "T2", ["B", "Y"], donem=SON3), olay("+8d1h", "yine_de_gonder", toplu="T1", cari="Y", etiket="G1"), kontrol("+8d2h", "K1")],
  {"elenen": {}, "yeniden": {"G1": yeniden(elenen={"Y": "zaten_kuyrukta"})},
   "kontroller.K1.isler": {"T1/Y": "Sonucu Belirsiz", "T2/B": "Teslim Edildi", "T2/Y": "Sınır Nedeniyle Bekliyor"}, "meta.post": {"Y": 2, "B": 1}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"mesaj": {"Y": ["yanitsiz_red"]}, "kanca": {"*": K_STD}})

# ---- E3: hatırlatmada Sonucu Belirsiz eşliği aynı YEREL gün ----
S("E3-01-hatirlatma-belirsiz-ayni-yerel-gun", "E3", "30.10 23:50 hatırlatma H belirsiz: 23:55 yeni hatırlatmada 'Sonucu Belirsiz'; 31.10 00:10 (yerel yeni gün, UTC'de hâlâ 30.10) gider",
  "E3 (N4 'a'; gece yarısı yerel ≠ UTC)", [H()],
  [baslat("+0s", "T1", "H", sablon="hatirlatma"), baslat("+5m", "T2", "H", sablon="hatirlatma"), baslat("+20m", "T3", "H", sablon="hatirlatma"), kontrol("+1h", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"H": "sonucu_belirsiz"}}, "toplular.T3.is_sayisi": 1, "meta.post": {"H": 2}, "isler.T1/H.durum": "Sonucu Belirsiz",
   "isler.T3/H.durum": "Teslim Edildi"},
  baslangic="2026-10-30T23:50:00+03:00", meta_davranis={"mesaj": {"H": ["yanitsiz_red"]}, "kanca": {"*": K_STD}})

S("E3-02-hatirlatma-yeniden-deneme-ayni-gun-belirsiz", "E3", "Hatırlatma H Başarısız → yeniden denemesi belirsiz → aynı gün asıl işte yeniden deneme: 'Sonucu Belirsiz' (öneri işteki Yine de Gönder)",
  "E3, K6", [H()],
  [baslat("+0s", "T1", "H", sablon="hatirlatma"), olay("+10m", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"),
   olay("+20m", "basarisizlari_yeniden_dene", toplu="T1", hedef="asil", etiket="Y2")],
  {"yeniden": {"Y1": yeniden(alinan="H"), "Y2": yeniden(elenen={"H": "sonucu_belirsiz"}, oneri="isteki_yine_de_gonder")}, "meta.post": {"H": 2}},
  baslangic="2026-10-30T23:00:00+03:00", meta_davranis={"mesaj": {"H": [{"hata": 131026}, "yanitsiz_red"]}, "kanca": {"*": K_STD}})

# ---- E4: Son 3 Ay / Tüm'de sonraki denemenin kabulü 7 günden eskiyse yeniden gönderilir ----
S("E4-01-son-3-ay-sonraki-teslim-7-gun", "E4", "'Son 3 Ay' A Başarısız → yeniden denemesi teslim edildi; asıl işten yeniden deneme 6g23s sonra 'Daha Önce Gönderildi', 7g1s sonra yeniden gönderilir",
  "E4 (N5 'a': 7 gün kuralı D5'e üstün)", [A()],
  [baslat("+0s", "T1", "A", donem=SON3), olay("+1h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"),
   olay("+7d", "basarisizlari_yeniden_dene", toplu="T1", hedef="asil", etiket="Y2"), olay("+7d2h", "basarisizlari_yeniden_dene", toplu="T1", hedef="asil", etiket="Y3"),
   kontrol("+7d3h", "K1")],
  {"yeniden": {"Y1": yeniden(alinan="A"), "Y2": yeniden(elenen={"A": "daha_once_gonderildi"}), "Y3": yeniden(alinan="A")}, "meta.post": {"A": 3},
   "isler.T1/A.durum": "Teslim Edildi"},
  meta_davranis={"mesaj": {"A": [{"hata": 131026}]}, "kanca": {"*": K_STD}})

S("E4-02-tum-hareketler-sonraki-teslim-7-gun", "E4", "'Tüm Hareketler' A Başarısız → yeniden denemesi teslim edildi; 6g23s sonra 'Daha Önce Gönderildi', 7g1s sonra yeniden gönderilir",
  "E4 (Tüm Hareketler)", [A()],
  [baslat("+0s", "T1", "A", donem="tum"), olay("+1h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"),
   olay("+7d", "basarisizlari_yeniden_dene", toplu="T1", hedef="asil", etiket="Y2"), olay("+7d2h", "basarisizlari_yeniden_dene", toplu="T1", hedef="asil", etiket="Y3")],
  {"yeniden": {"Y1": yeniden(alinan="A"), "Y2": yeniden(elenen={"A": "daha_once_gonderildi"}), "Y3": yeniden(alinan="A")}, "meta.post": {"A": 3},
   "isler.T1/A.durum": "Teslim Edildi"},
  meta_davranis={"mesaj": {"A": [{"hata": 131026}]}, "kanca": {"*": K_STD}})

# ---- N6: yeniden denemede başka işte bekleyen kişi "Zaten Kuyrukta" ----
S("N6-01-yeniden-denemede-baska-iste-bekleyen", "N6", "A asıl işte Başarısız; başka işte sınırda bekliyor: asıl işin yeniden denemesinde 'Zaten Kuyrukta'",
  "N6 (E2 sırasıyla Zaten Kuyrukta)", [A(), B()],
  [baslat("+0s", "T1", "A"), baslat("+30m", "T2", ["B", "A"]), olay("+40m", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), kontrol("+50m", "K1")],
  {"yeniden": {"Y1": yeniden(elenen={"A": "zaten_kuyrukta"})}, "kontroller.K1.isler": {"T1/A": "Başarısız", "T2/A": "Sınır Nedeniyle Bekliyor", "T2/B": "Teslim Edildi"},
   "meta.post": {"A": 2, "B": 1}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"mesaj": {"A": [{"hata": 131026}]}, "kanca": {"*": K_STD}})


# ======================================================================== KÂHİN GÜNCELLEMESİ 5 (31.10.2026): P1/P2 yanıtları F1/F2 (kural değişmedi; senaryo)
S("F1-01-iki-belirsiz-is-isteki-yine-de-gonder-gider", "F1", "'Son 3 Ay' A: TX'te belirsiz, 8. gün TY'de de belirsiz; TX'te işteki Yine de Gönder TY'nin belirsizine bakmadan gider",
  "F1 (P1 'a': başka işin Sonucu Belirsiz'i işteki Yine de Gönder'i elemez)", [A()],
  [baslat("+0s", "TX", "A", donem=SON3), baslat("+8d", "TY", "A", donem=SON3), olay("+8d1h", "yine_de_gonder", toplu="TX", cari="A", etiket="G1"), kontrol("+8d2h", "K1")],
  {"elenen": {}, "yeniden": {"G1": yeniden(alinan="A")}, "isler.TX/A.durum": "Teslim Edildi", "isler.TY/A.durum": "Sonucu Belirsiz", "meta.post": {"A": 3}},
  meta_davranis={"mesaj": {"A": ["yanitsiz_red", "yanitsiz_red", "kabul"]}, "kanca": {"*": K_STD}})

S("F1-02-asilmis-belirsiz-ve-bekleyen-zaten-kuyrukta", "F1", "'Son 3 Ay' A: TX'te iki kez belirsiz (biri aşılmış); 8. gün TY'de sınırda bekliyor: TX'te işteki Yine de Gönder 'Zaten Kuyrukta'",
  "F1 (bekleyen ileti varsa Zaten Kuyrukta yine eler), E2", [A(), B()],
  [baslat("+0s", "TX", "A", donem=SON3), olay("+1h", "yine_de_gonder", toplu="TX", cari="A", etiket="G0"), baslat("+8d", "TY", ["B", "A"], donem=SON3),
   olay("+8d1h", "yine_de_gonder", toplu="TX", cari="A", etiket="G1"), kontrol("+8d2h", "K1")],
  {"yeniden": {"G0": yeniden(alinan="A"), "G1": yeniden(elenen={"A": "zaten_kuyrukta"})},
   "kontroller.K1.isler": {"TX/A": "Sonucu Belirsiz", "TY/A": "Sınır Nedeniyle Bekliyor", "TY/B": "Teslim Edildi"}, "meta.post": {"A": 3, "B": 1}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"mesaj": {"A": ["yanitsiz_red", "yanitsiz_red"]}, "kanca": {"*": K_STD}})

S("F1-03-asilmis-eski-belirsiz-isteki-yine-de-gonder-gider", "F1", "A belirsiz → Yine de Gönder yine belirsiz → ikinci Yine de Gönder aşılmış eski belirsize bakmadan gider",
  "F1 (aşılmış eski deneme işteki Yine de Gönder'i elemez)", [A()],
  [baslat("+0s", "T1", "A"), olay("+1h", "yine_de_gonder", toplu="T1", cari="A", etiket="G1"), olay("+2h", "yine_de_gonder", toplu="T1", cari="A", etiket="G2"),
   kontrol("+3h", "K1")],
  {"yeniden": {"G1": yeniden(alinan="A"), "G2": yeniden(alinan="A")}, "kontroller.K1.isler": {"T1/A": "Teslim Edildi"}, "meta.post": {"A": 3}},
  meta_davranis={"mesaj": {"A": ["yanitsiz_red", "yanitsiz_red", "kabul"]}, "kanca": {"*": K_STD}})

S("F2-01-hatirlatma-yeniden-deneme-ertesi-gun", "F2", "Pazartesi 23:40 hatırlatma H Başarısız; 23:45 yeniden denemesi belirsiz; 23:50 asıl işten yeniden deneme 'Sonucu Belirsiz'; Salı 00:10 (yerel yeni gün, UTC'de hâlâ Pazartesi) gider",
  "F2 (P2 'a': aynı gün = yeniden denemenin yerel günü; gece yarısı yerel ≠ UTC)", [H()],
  [baslat("+0s", "T1", "H", sablon="hatirlatma"), olay("+5m", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"),
   olay("+10m", "basarisizlari_yeniden_dene", toplu="T1", hedef="asil", etiket="Y2"), olay("+30m", "basarisizlari_yeniden_dene", toplu="T1", hedef="asil", etiket="Y3"),
   kontrol("+1h", "K1")],
  {"yeniden": {"Y1": yeniden(alinan="H"), "Y2": yeniden(elenen={"H": "sonucu_belirsiz"}, oneri="isteki_yine_de_gonder"), "Y3": yeniden(alinan="H")},
   "kontroller.K1.isler": {"T1/H": "Teslim Edildi"}, "meta.post": {"H": 3}},
  baslangic="2026-11-02T23:40:00+03:00", meta_davranis={"mesaj": {"H": [{"hata": 131026}, "yanitsiz_red"]}, "kanca": {"*": K_STD}})


S("F2-02-hatirlatma-dunku-belirsiz-bugunku-r3", "F2", "Pazartesi H Başarısız, yeniden denemesi belirsiz; Salı yeni hatırlatma gider (dünkü belirsiz elemez); Salı asıl işten yeniden deneme bu kez 'Daha Önce Gönderildi' (aynı gün R3)",
  "F2 (yeniden denemenin günü), E3, D2 (a), E2 sırası", [H()],
  [baslat("+0s", "T1", "H", sablon="hatirlatma"), olay("+5m", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), baslat("+1d", "T2", "H", sablon="hatirlatma"),
   olay("+1d1m", "basarisizlari_yeniden_dene", toplu="T1", hedef="asil", etiket="Y2"), kontrol("+1d1h", "K1")],
  {"yeniden": {"Y1": yeniden(alinan="H"), "Y2": yeniden(elenen={"H": "daha_once_gonderildi"})}, "toplular.T2.is_sayisi": 1, "elenen": {},
   "kontroller.K1.isler": {"T1/H": "Sonucu Belirsiz", "T2/H": "Teslim Edildi"}, "meta.post": {"H": 3}},
  baslangic="2026-11-02T10:00:00+03:00", meta_davranis={"mesaj": {"H": [{"hata": 131026}, "yanitsiz_red", "kabul"]}, "kanca": {"*": K_STD}})


# ======================================================================== KÂHİN GÜNCELLEMESİ 6 (31.10.2026): G0 genel ilke + G1–G5
# ---- G0: "kime kaç kez" genel ilke (İLKEYLE çözülen yerler) ----
S("G0-01-sonraki-denemesi-teslimsiz-durdu-yeniden-gider", "G0", "Sınır 1: A Başarısız → yeniden denemesi sınırda → geri yüklemeyle durdu (teslim yok) → asıl işten yeniden deneme A'yı gönderir (İLKEYLE: kesin almadı, çıkmaz yok)",
  "G0 (1, 4) — eski plan_susuyor yaprağı", [A(), B()],
  [baslat("+0s", "T1", "AB"), olay("+1h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), olay("+2h", "geri_yukle"), kontrol("+2h30m", "K1"),
   olay("+3h", "basarisizlari_yeniden_dene", toplu="T1", hedef="asil", etiket="Y2")],
  {"yeniden": {"Y1": yeniden(alinan="A"), "Y2": yeniden(alinan="A")}, "kontroller.K1.isler": {"T1/A": GERI, "T1/B": "Teslim Edildi"},
   "meta.post": {"A": 2, "B": 1}, "isler.T1/A.durum": "Teslim Edildi"},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"mesaj": {"A": [{"hata": 131026}]}, "kanca": {"*": K_STD}})

S("G0-02-asil-isteki-belirsiz-deneme-yine-de-gonder", "G0", "A belirsiz → Yine de Gönder → Başarısız; yeniden deneme 'Sonucu Belirsiz' (öneri işteki Yine de Gönder); asıl işte belirsiz kalan denemeye Yine de Gönder gider (İLKEYLE: çıkmaz yok)",
  "G0 (4) + D6 ('her seferinde onaylı Yine de Gönder')", [A()],
  [baslat("+0s", "T1", "A"), olay("+1h", "yine_de_gonder", toplu="T1", cari="A", etiket="G1"), olay("+2h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"),
   olay("+3h", "yine_de_gonder", toplu="T1", cari="A", hedef="asil", etiket="G2"), kontrol("+4h", "K1")],
  {"yeniden": {"G1": yeniden(alinan="A"), "Y1": yeniden(elenen={"A": "sonucu_belirsiz"}, oneri="isteki_yine_de_gonder"), "G2": yeniden(alinan="A")},
   "meta.post": {"A": 3}, "isler.T1/A.durum": "Teslim Edildi"},
  meta_davranis={"mesaj": {"A": ["yanitsiz_red", "kabul", "kabul"]}, "kanca": {"A": {"1": KF, "2": K_STD}}})

# ---- G1: "o gün" = toplu işin (yeniden denemede asıl işin) açıldığı gün ----
S("G1-01-ozel-aralik-sinirla-ertesi-gun-ayni-donem", "G1", "15.10 23:00 özel 01.10–15.10 (= o günün Bu Ay'ı) sınır 1: B 16.10'da gider; 20.10 özel 01.10–20.10 (= o günün Bu Ay'ı) A ve B 'Daha Önce Gönderildi'",
  "G1 (tek toplu işte gün = açılış günü), G2", [A(), B()],
  [baslat("+0s", "T1", "AB", donem={"bas": "2026-10-01", "son": "2026-10-15"}), kontrol("+1h", "K1"), baslat("+4d11h", "T2", "AB", donem={"bas": "2026-10-01", "son": "2026-10-20"})],
  {"kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Sınır Nedeniyle Bekliyor"}, "olusmadi": ["T2"],
   "elenen": {"T2": {"A": "daha_once_gonderildi", "B": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 2, "son": "2026-10-16"}},
   "isler.T1/B.degiskenler": ["Mehmet Kaya", FIRMA, "01.10.2026 – 15.10.2026", "2.000,00 TL"], "meta.post": {"A": 1, "B": 1}},
  baslangic="2026-10-15T23:00:00+03:00", ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("G1-02-bu-ay-sinirla-ertesi-gun-ayni-donem", "G1", "15.10 23:00 'Bu Ay' (01.10–15.10) sınır 1: B 16.10'da gider; 20.10 özel 01.10–15.10'da B 'Daha Önce Gönderildi' (tarih açılış gününün)",
  "G1, G2 (hazır seçimin o günkü tarihleri)", [A(), B()],
  [baslat("+0s", "T1", "AB", donem=BU_AY), baslat("+4d11h", "T2", "B", donem={"bas": "2026-10-01", "son": "2026-10-15"})],
  {"olusmadi": ["T2"], "elenen": {"T2": {"B": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-16"}}, "meta.post": {"A": 1, "B": 1}},
  baslangic="2026-10-15T23:00:00+03:00", ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("G1-03-yeniden-deneme-ertesi-gun-asil-isin-gunu", "G1", "15.10 22:00 özel 01.10–15.10: A Başarısız; 16.10 02:00 yeniden deneme (o gün = asıl işin günü); 20.10 özel 01.10–20.10'da A 'Daha Önce Gönderildi'",
  "G1 (yeniden denemede o gün = asıl işin açıldığı gün; gece yarısı)", [A()],
  [baslat("+0s", "T1", "A", donem={"bas": "2026-10-01", "son": "2026-10-15"}), olay("+4h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"),
   baslat("+4d12h", "T2", "A", donem={"bas": "2026-10-01", "son": "2026-10-20"})],
  {"yeniden": {"Y1": yeniden(alinan="A")}, "olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-16"}},
   "meta.post": {"A": 2}},
  baslangic="2026-10-15T22:00:00+03:00", meta_davranis={"mesaj": {"A": [{"hata": 131026}]}, "kanca": {"*": K_STD}})

# ---- G2: hazır seçimin o günkü tarihleri + kendi günlerinde Bu Ay'a eşit özel aralıklar ----
S("G2-01-bu-ay-0311-ozel-0511", "G2", "03.11 'Bu Ay' (01.11–03.11) gönderildi: 05.11 özel 01.11–03.11 'Daha Önce Gönderildi'; özel 01.11–04.11 gider", "G2 (birinci cümle)",
  [A()], [baslat("+0s", "T1", "A", donem=BU_AY), baslat("+2d", "T2", "A", donem={"bas": "2026-11-01", "son": "2026-11-03"}),
          baslat("+2d1m", "T3", "A", donem={"bas": "2026-11-01", "son": "2026-11-04"})],
  {"olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-11-03"}}, "toplular.T3.is_sayisi": 1,
   "meta.post": {"A": 2}},
  baslangic="2026-11-03T10:00:00+03:00", meta_davranis={"kanca": {"*": K_STD}})

S("G2-02-iki-ozel-aralik-kendi-gunlerinde-bu-ay", "G2", "03.11 özel 01.11–03.11 (o günün Bu Ay'ı) gönderildi: 05.11 özel 01.11–05.11 (o günün Bu Ay'ı) 'Daha Önce Gönderildi'; özel 01.11–04.11 gider",
  "G2 (ikinci cümle)", [A()],
  [baslat("+0s", "T1", "A", donem={"bas": "2026-11-01", "son": "2026-11-03"}), baslat("+2d", "T2", "A", donem={"bas": "2026-11-01", "son": "2026-11-05"}),
   baslat("+2d1m", "T3", "A", donem={"bas": "2026-11-01", "son": "2026-11-04"})],
  {"olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-11-03"}}, "toplular.T3.is_sayisi": 1,
   "meta.post": {"A": 2}},
  baslangic="2026-11-03T10:00:00+03:00", meta_davranis={"kanca": {"*": K_STD}})

S("G2-03-gece-yarisi-bu-ay-yerel-gun", "G2", "04.11 00:10 (UTC'de 03.11) 'Bu Ay' = 01.11–04.11: 05.11 özel 01.11–04.11 'Daha Önce Gönderildi', özel 01.11–03.11 gider",
  "G2 + gece yarısı yerel ≠ UTC", [A()],
  [baslat("+0s", "T1", "A", donem=BU_AY), baslat("+1d", "T2", "A", donem={"bas": "2026-11-01", "son": "2026-11-04"}),
   baslat("+1d1m", "T3", "A", donem={"bas": "2026-11-01", "son": "2026-11-03"})],
  {"olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-11-04"}}, "toplular.T3.is_sayisi": 1,
   "meta.post": {"A": 2}},
  baslangic="2026-11-04T00:10:00+03:00", meta_davranis={"kanca": {"*": K_STD}})

# ---- G3: taşınan veride dosyadaki Sonucu Belirsiz eler; dosyadan gelen kabul/teslim 7 gün + K5 sınırı ----
S("G3-01-tasinan-belirsiz-yeni-iste-eler", "G3", "A Sonucu Belirsiz; veri taşındı: yeni seçimde 'Sonucu Belirsiz'; işteki Yine de Gönder ile gider", "G3", [A()],
  [baslat("+0s", "T1", "A"), olay("+1h", "tasindi"), baslat("+2h", "T2", "A"), olay("+3h", "yine_de_gonder", toplu="T1", cari="A", etiket="G1"), kontrol("+4h", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"A": "sonucu_belirsiz"}}, "yeniden": {"G1": yeniden(alinan="A")}, "isler.T1/A.durum": "Teslim Edildi", "meta.post": {"A": 2}},
  meta_davranis={"mesaj": {"A": ["yanitsiz_red", "kabul"]}, "kanca": {"*": K_STD}})

S("G3-02-tasinan-belirsiz-yeniden-denemede-eler", "G3", "A Başarısız → yeniden denemesi belirsiz; veri taşındı: asıl işten yeniden deneme 'Sonucu Belirsiz' (öneri işteki Yine de Gönder); Yine de Gönder ile gider",
  "G3", [A()],
  [baslat("+0s", "T1", "A"), olay("+30m", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), olay("+1h", "tasindi"),
   olay("+2h", "basarisizlari_yeniden_dene", toplu="T1", hedef="asil", etiket="Y2"), olay("+3h", "yine_de_gonder", toplu="T1", cari="A", etiket="G1")],
  {"yeniden": {"Y1": yeniden(alinan="A"), "Y2": yeniden(elenen={"A": "sonucu_belirsiz"}, oneri="isteki_yine_de_gonder"), "G1": yeniden(alinan="A")},
   "meta.post": {"A": 3}, "isler.T1/A.durum": "Teslim Edildi"},
  meta_davranis={"mesaj": {"A": [{"hata": 131026}, "yanitsiz_red", "kabul"]}, "kanca": {"*": K_STD}})

S("G3-03-tasinan-teslim-son-3-ay-7-gun", "G3", "'Son 3 Ay' A teslim edildi, ertesi saat veri taşındı: 6g23s sonra 'Daha Önce Gönderildi', 7g1s sonra gider (dosyadan gelen teslim, 7 gün)",
  "G3 (7 gün), D8", [A()],
  [baslat("+0s", "T1", "A", donem=SON3), olay("+1h", "tasindi"), baslat("+6d23h", "T2", "A", donem=SON3), baslat("+7d1h", "T3", "A", donem=SON3)],
  {"olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}}, "toplular.T3.is_sayisi": 1,
   "meta.post": {"A": 2}},
  meta_davranis={"kanca": {"*": K_STD}})

S("G3-04-tasinan-asil-isin-yine-de-gonder-siniri", "G3", "T0'da gönderilmiş A'ya T1 'Yine de Gönder' ile, A Başarısız; veri taşındı: yeniden deneme T0'ı (açılıştan önce, dosyadan) yok sayar, A gider",
  "G3 (asıl işin Yine de Gönder sınırı aynen), K5", [A()],
  [baslat("+0s", "T0", "A"), baslat("+1h", "T1", "A", onceki="gonder"), olay("+2h", "tasindi"), olay("+3h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1")],
  {"onceki_uyari": {"T1": {"sayi": 1, "son": "2026-10-30"}}, "yeniden": {"Y1": yeniden(alinan="A")}, "meta.post": {"A": 3}, "isler.T1/A.durum": "Teslim Edildi"},
  meta_davranis={"mesaj": {"A": ["kabul", {"hata": 131026}]}, "kanca": {"*": K_STD}})

# ---- G4: Şirket Verisini Sıfırla ile duran Meta Bekletti ----
S("G4-01-sifirlama-meta-bekletti-sayilmaz", "G4", "Meta Bekletti iş Şirket Verisini Sıfırla ile durdu (teslim yok): aynı dönem yeni seçimde gider", "G4, G0 (1)",
  [A()], [baslat("+0s", "T1", "A"), olay("+1h", "sifirla"), baslat("+2h", "T2", "A"), kontrol("+2h30m", "K1")],
  {"isler.T1/A.durum": GERI, "elenen": {}, "onceki_uyari": {}, "toplular.T2.is_sayisi": 1, "meta.post": {"A": 2},
   "kontroller.K1.isler": {"T1/A": GERI, "T2/A": BEKLETTI}},
  bitis="+3h", meta_davranis={"kanca": {"A": {"1": K49}}})

S("G4-02-sifirlama-meta-bekletti-gec-teslim-sayilir", "G4", "Meta Bekletti iş sıfırlamayla durdu, sonra 1. iletinin teslim bildirimi geldi: 'Daha Önce Gönderildi'", "G4 (geç teslim gelirse sayılır)",
  [A()], [baslat("+0s", "T1", "A"), olay("+1h", "sifirla"), baslat("+2h", "T2", "A")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}}, "meta.post": {"A": 1},
   "bu_ay": {"W1": {"2026-10": ay_kova(1)}}, "isler.T1/A.durum": {"secenek": [GERI, "Teslim Edildi"], "susuyor": GEC}},
  meta_davranis={"kanca": {"A": {"1": K49 + [["delivered", "+1h30m"]]}}})

# ---- G5: Meta Bekletti sonrası 2. deneme Sonucu Belirsiz ----
S("G5-01-meta-bekletti-ikinci-deneme-belirsiz-elenir", "G5", "Meta Bekletti; 24 saat sonra 2. deneme Sonucu Belirsiz: yeni seçimde 'Sonucu Belirsiz'; işteki Yine de Gönder ile gider", "G5, G0 (2)",
  [A()], [baslat("+0s", "T1", "A"), kontrol("+24h30m", "K1"), baslat("+25h", "T2", "A"), olay("+26h", "yine_de_gonder", toplu="T1", cari="A", etiket="G1"), kontrol("+27h", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Sonucu Belirsiz"}, "olusmadi": ["T2"], "elenen": {"T2": {"A": "sonucu_belirsiz"}}, "yeniden": {"G1": yeniden(alinan="A")},
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi"}, "meta.post": {"A": 3}},
  meta_davranis={"mesaj": {"A": ["kabul", "yanitsiz_red", "kabul"]}, "kanca": {"A": {"1": K49, "2": K_STD}}})

S("G5-02-meta-bekletti-ikinci-deneme-cozuldu-teslim", "G5", "Meta Bekletti; 2. deneme yanıtsız ama Meta aldı, imzalı teslim bildirimi işi çözdü: yeni seçimde 'Daha Önce Gönderildi' (belirsiz kalmadı)",
  "G5 ('belirsiz KALIRSA'), §7a 3", [A()],
  [baslat("+0s", "T1", "A"), baslat("+25h", "T2", "A")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-31"}}, "isler.T1/A.durum": "Teslim Edildi",
   "meta.post": {"A": 2}},
  meta_davranis={"mesaj": {"A": ["kabul", "yanitsiz_kabul"]}, "kanca": {"A": {"1": K49, "2": [["sent", "+1s"], ["delivered", "+30m"]]}}})


# ======================================================================== KÂHİN GÜNCELLEMESİ 7 (31.10.2026): G6 (baş mimar, G0 (3) İLKEYLE)
S("G6-01-son-3-ay-ozel-aralik-7-gun", "G6", "30.10 'Son 3 Ay' Y (o günkü okumalardan biri 30.07–30.10): 6g23s sonra özel 30.07–30.10 'Daha Önce Gönderildi', 7g1s sonra gider",
  "G6 (Son 3 Ay → özel aralık; 7 gün penceresi bu eşlikte de)", [Y()],
  [baslat("+0s", "T1", "Y", donem=SON3), baslat("+6d23h", "T2", "Y", donem={"bas": "2026-07-30", "son": "2026-10-30"}),
   baslat("+7d1h", "T3", "Y", donem={"bas": "2026-07-30", "son": "2026-10-30"})],
  {"olusmadi": ["T2"], "elenen": {"T2": {"Y": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}}, "toplular.T3.is_sayisi": 1,
   "meta.post": {"Y": 2}},
  meta_davranis={"kanca": {"*": K_STD}})

S("G6-02-ozel-aralik-tum-hareketler-kisiye-gore", "G6", "Özel 15.01–30.10 Y ve Z'ye gönderildi; aynı gün 'Tüm Hareketler': Y'nin o günkü tarihleri (ilk hareket 15.01 – bugün) eşit → elenir; Z'ninki (10.02 – bugün) değil → gider",
  "G6 (özel aralık → Tüm Hareketler; Tüm = kişinin ilk hareketi – o gün, README §12)", [Y(), Z()],
  [baslat("+0s", "T1", "YZ", donem={"bas": "2026-01-15", "son": "2026-10-30"}), baslat("+1h", "T2", "YZ", donem="tum")],
  {"elenen": {"T2": {"Y": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}}, "toplular.T2.is_sayisi": 1, "meta.post": {"Y": 1, "Z": 2}},
  meta_davranis={"kanca": {"*": K_STD}})

S("G6-03-son-3-ay-bekleyen-ozel-aralik-gece-yarisi", "G6", "01.11 00:30 (UTC'de 31.10) 'Son 3 Ay' sınır 1: Y bekliyor; 01:30 özel 01.09–01.11 (o günkü okumalardan biri) Y 'Zaten Kuyrukta'",
  "G6 (Zaten Kuyrukta; gece yarısı yerel ≠ UTC)", [A(), Y()],
  [baslat("+0s", "T1", ["A", "Y"], donem=SON3), baslat("+1h", "T2", "Y", donem={"bas": "2026-09-01", "son": "2026-11-01"}), kontrol("+2h", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"Y": "zaten_kuyrukta"}}, "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/Y": "Sınır Nedeniyle Bekliyor"},
   "meta.post": {"A": 1, "Y": 1}},
  baslangic="2026-11-01T00:30:00+03:00", ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("G6-04-tum-hareketler-belirsiz-ozel-aralik", "G6", "'Tüm Hareketler' Y Sonucu Belirsiz; aynı gün özel 15.01–30.10 'Sonucu Belirsiz'; işteki Yine de Gönder ile gider",
  "G6 (Sonucu Belirsiz; Tüm → özel)", [Y()],
  [baslat("+0s", "T1", "Y", donem="tum"), baslat("+1h", "T2", "Y", donem={"bas": "2026-01-15", "son": "2026-10-30"}),
   olay("+2h", "yine_de_gonder", toplu="T1", cari="Y", etiket="G1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"Y": "sonucu_belirsiz"}}, "yeniden": {"G1": yeniden(alinan="Y")}, "meta.post": {"Y": 2}},
  meta_davranis={"mesaj": {"Y": ["yanitsiz_red", "kabul"]}, "kanca": {"*": K_STD}})

S("G6-05-son-3-ay-yeniden-deneme-asil-isin-gunu", "G6", "30.10 23:00 'Son 3 Ay' Y Başarısız; 31.10 01:00 yeniden deneme (tarihler asıl işin 30.10'undan); 31.10 10:00 özel 30.07–30.10 'Daha Önce Gönderildi'",
  "G6 + G1 (yeniden denemede asıl işin günü; gece yarısı)", [Y()],
  [baslat("+0s", "T1", "Y", donem=SON3), olay("+2h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"),
   baslat("+11h", "T2", "Y", donem={"bas": "2026-07-30", "son": "2026-10-30"})],
  {"yeniden": {"Y1": yeniden(alinan="Y")}, "olusmadi": ["T2"], "elenen": {"T2": {"Y": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-31"}},
   "meta.post": {"Y": 2}},
  baslangic="2026-10-30T23:00:00+03:00", meta_davranis={"mesaj": {"Y": [{"hata": 131026}]}, "kanca": {"*": K_STD}})


# ======================================================================== KÂHİN GÜNCELLEMESİ 8 (31.10.2026): H1 (kullanıcı) + H2–H4 (baş mimar, G0 İLKEYLE)
S("H1-01-yine-de-gonder-teslim-daha-once", "H1", "B Sonucu Belirsiz; işteki Yine de Gönder teslim edildi → yeni gönderimde 'Daha Önce Gönderildi' (Sonucu Belirsiz değil); R3 Yine de Gönder ile gider",
  "H1 + H4 (kaynak belirsiz çözüldü; son gönderim = Yine de Gönder denemesi)", [B()],
  [baslat("+0s", "T1", "B"), olay("+1h", "yine_de_gonder", toplu="T1", cari="B", etiket="G1"), baslat("+2h", "T2", "B"),
   baslat("+3h", "T3", "B", onceki="gonder")],
  {"yeniden": {"G1": yeniden(alinan="B")}, "olusmadi": ["T2"], "elenen": {"T2": {"B": "daha_once_gonderildi"}},
   "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}, "T3": {"sayi": 1, "son": "2026-10-30"}}, "toplular.T3.is_sayisi": 1, "meta.post": {"B": 3}},
  meta_davranis={"mesaj": {"B": ["yanitsiz_red", "kabul", "kabul"]}, "kanca": {"*": K_STD}})

S("H1-02-yine-de-gonder-basarisiz-belirsiz-surer", "H1", "Yine de Gönder ile açılan iş Başarısız → kaynak belirsiz sürer: R3 Yine de Gönder'li yeni gönderimde de 'Sonucu Belirsiz'; asıl işte yeniden Yine de Gönder teslim → sonra 'Daha Önce Gönderildi'",
  "H1 (başarısız kalırsa D6/F1 aynen; G0 4 çıkmaz yok)", [B()],
  [baslat("+0s", "T1", "B"), olay("+1h", "yine_de_gonder", toplu="T1", cari="B", etiket="G1"), baslat("+2h", "T2", "B", onceki="gonder"),
   olay("+3h", "yine_de_gonder", toplu="T1", cari="B", etiket="G2", hedef="asil"), baslat("+4h", "T3", "B")],
  {"yeniden": {"G1": yeniden(alinan="B"), "G2": yeniden(alinan="B")}, "olusmadi": ["T2", "T3"],
   "elenen": {"T2": {"B": "sonucu_belirsiz"}, "T3": {"B": "daha_once_gonderildi"}}, "onceki_uyari": {"T3": {"sayi": 1, "son": "2026-10-30"}}, "meta.post": {"B": 3}},
  meta_davranis={"mesaj": {"B": ["yanitsiz_red", {"hata": 131026}, "kabul"]}, "kanca": {"*": K_STD}})

S("H1-03-gece-yarisi-son-3-ay-yine-de-gonder", "H1", "31.10 23:40 'Son 3 Ay' Y belirsiz; 01.11 00:10 (UTC'de 31.10) Yine de Gönder teslim; 00:40 'Daha Önce Gönderildi', son gönderim 01.11 (yerel gün); R3 Yine de Gönder ile gider",
  "H1 + H4 (gece yarısı yerel ≠ UTC)", [Y()],
  [baslat("+0s", "T1", "Y", donem=SON3), olay("+30m", "yine_de_gonder", toplu="T1", cari="Y", etiket="G1"), baslat("+1h", "T2", "Y", donem=SON3),
   baslat("+1h10m", "T3", "Y", donem=SON3, onceki="gonder")],
  {"yeniden": {"G1": yeniden(alinan="Y")}, "olusmadi": ["T2"], "elenen": {"T2": {"Y": "daha_once_gonderildi"}},
   "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-11-01"}, "T3": {"sayi": 1, "son": "2026-11-01"}}, "toplular.T3.is_sayisi": 1, "meta.post": {"Y": 3}},
  baslangic="2026-10-31T23:40:00+03:00", meta_davranis={"mesaj": {"Y": ["yanitsiz_red", "kabul", "kabul"]}, "kanca": {"*": K_STD}})

S("H2-01-tasima-gonderiliyor-belirsiz", "H2", "'Gönderiliyor' anında süreç öldü (istek gitmedi), veri başka bilgisayara taşındı: iş Sonucu Belirsiz (Taşınan değil) → yeni gönderimde elenir, işteki Yine de Gönder ile gider",
  "H2 (İLKEYLE G0 2)", [B()],
  [baslat("+0s", "T1", "B"), {"tur": "cokme", "cari": "B", "istek_ulasti": False}, olay("cokme+5m", "tasindi"), olay("cokme+10m", "ac"),
   baslat("cokme+20m", "T2", "B"), olay("cokme+30m", "yine_de_gonder", toplu="T1", cari="B", etiket="G1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"B": "sonucu_belirsiz"}}, "yeniden": {"G1": yeniden(alinan="B")},
   "isler.T1/B.durum": "Teslim Edildi", "meta.post": {"B": 1}},
  meta_davranis={"kanca": {"*": K_STD}})

S("H2-02-tasima-gonderiliyor-gec-kanca", "H2", "'Gönderiliyor' anında süreç öldü (istek ulaştı), veri taşındı: iş Sonucu Belirsiz; yeni bilgisayarda Meta'nın imzalı kancası işi çözer → yeni gönderimde 'Daha Önce Gönderildi'",
  "H2 + G3 (taşınan veride belirsiz; kanca çözer)", [B()],
  [baslat("+0s", "T1", "B"), {"tur": "cokme", "cari": "B", "istek_ulasti": True}, olay("cokme+5m", "tasindi"), olay("cokme+10m", "ac"),
   olay("cokme+11m", "kanca_kuyrugu"), baslat("cokme+20m", "T2", "B")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"B": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}},
   "isler.T1/B.durum": "Teslim Edildi", "meta.post": {"B": 1}},
  meta_davranis={"kanca": {"*": K_STD}})

S("H3-01-geri-yukleme-dosyasiz-gec-kabul", "H3", "Yedekten sonra açılan T1/B Sonucu Belirsiz; yedeğe dönüldü (iş dosyada yok); 3 saat sonra Meta'nın imzalı kancası → defterdeki son deneme sayılır: 'Daha Önce Gönderildi'",
  "H3 (İLKEYLE G0 2, 5; E1 defterdeki belirsiz yeni işi elemezdi)", [B()],
  [olay("+0s", "yedek_al", ad="Y0"), baslat("+1m", "T1", "B"), olay("+1h", "geri_yukle", yedek="Y0"), baslat("+5h", "T2", "B"),
   baslat("+6h", "T3", "B", onceki="gonder")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"B": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}, "T3": {"sayi": 1, "son": "2026-10-30"}},
   "toplular.T3.is_sayisi": 1},
  meta_davranis={"mesaj": {"B": ["yanitsiz_kabul", "kabul"]}, "kanca": {"B": {"1": [["sent", "+3h"], ["delivered", "+3h1m"]], "*": K_STD}}}, bilinen_ihlal=GERI_IHLAL)

S("H3-02-geri-yukleme-meta-bekletti-gec-teslim", "H3", "Yedekten sonra açılan T1/B Meta Bekletti; yedeğe dönüldü (iş dosyada yok); geç imzalı teslim → sayılır: 'Daha Önce Gönderildi'",
  "H3 + 11:00 kararı (geri yüklemeyle duran Meta Bekletti geç teslimde sayılır)", [B()],
  [olay("+0s", "yedek_al", ad="Y0"), baslat("+1m", "T1", "B"), olay("+1h", "geri_yukle", yedek="Y0"), baslat("+5h", "T2", "B")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"B": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}}},
  meta_davranis={"kanca": {"B": {"1": [["sent", "+1s"], ["failed", "+10s", {"kod": 131049}], ["delivered", "+3h"]], "*": K_STD}}}, bilinen_ihlal=GERI_IHLAL)

S("H4-01-r3-son-gonderim-son-kabul-gece-yarisi", "H4", "31.10 00:30 (UTC'de 30.10) B teslim; 01.11 00:30 R3 Yine de Gönder ile giden deneme Başarısız; 01.11 10:30 uyarıdaki son gönderim 31.10 (başarısız deneme değil, yerel gün)",
  "H4 (gece yarısı yerel ≠ UTC)", [B()],
  [baslat("+0s", "T1", "B"), baslat("+1d", "T2", "B", onceki="gonder"), baslat("+1d10h", "T3", "B")],
  {"onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-31"}, "T3": {"sayi": 1, "son": "2026-10-31"}}, "toplular.T2.is_sayisi": 1, "olusmadi": ["T3"],
   "elenen": {"T3": {"B": "daha_once_gonderildi"}}, "meta.post": {"B": 2}},
  baslangic="2026-10-31T00:30:00+03:00", meta_davranis={"mesaj": {"B": ["kabul", {"hata": 131026}]}, "kanca": {"*": K_STD}})


# ======================================================================== KÂHİN GÜNCELLEMESİ 9 (01.11.2026): J1–J8 (KARAR 06:28 UTC) + J9 n3 BİLİNEN SINIR (KARAR 05:58 UTC)
# Elle beklenen YALNIZ karar metninden ve README §14 yorumlarından (kodlamadan önce yazıldı). Yeni girdiler: "kanca" planında anahtar iş de olabilir ("T1/B");
# mesaj yanıtı {"gec_kabul": "+10s"} (Meta kabul eder, HTTP yanıtı zaman aşımından önce gecikmeli gelir); olaylar sirket_sil {sirket}, sirket_acilamaz {sirket, acik},
# bildirim_yazilamaz {acik}, defter_yazilamaz {acik} (9d; eski dosya_yazilamaz kalktı); senaryo alanları kanca_yanit_cikti (çıktıda kanca_yanitlari) ve bilinen_sinir (BİLİNEN SINIR işareti).
YANLIZ_KS = [["sent", "+1s"]]
SIL_IHLAL = {"post_toplam": {"neden": "silinen şirketin / dosyadan çıkan işin POST'u Meta'da kalır; iş başına sayım dosyadaki işlerden"}}
BS_J5 = {"J5": "kişiye 2 ileti (Meta Bekletti 1. iletisi 2. deneme gittikten sonra teslim) — J5 metninde BİLİNEN SINIR, önlenemez"}
# güncelleme 11: n3 BİLİNEN SINIR değil KARAR (SW1 "İkinci de gitsin", 05.11.2026) — J9-01/02'nin bilinen_sinir işareti kalktı


def P_(**kw):
    return cari("P", "Pelin Kara", "0543 111 22 33", [("2026-11-01", 100, 0), ("2026-11-03", 50, 0)], **kw)


def Q_(**kw):
    return cari("Q", "Kemal Ekim", "0544 222 33 44", [("2026-10-01", 200, 0), ("2026-10-31", 0, 50)], **kw)


def R_(**kw):
    return cari("R", "Rana Ortada", "0545 333 44 55", [("2026-10-15", 70, 0)], **kw)


def S_(**kw):
    return cari("S", "Selin Kasım", "0546 444 55 66", [("2026-11-01", 100, 0), ("2026-11-02", 30, 0)], **kw)


# ---- J1: teslim her durumda sayılır; iş yeniden açılmaz ----
S("J1-01-duraklatilmis-meta-bekletti-teslim-is-kapanir", "J1", "Meta Bekletti iken toplu iş duraklatıldı; 1. iletinin teslimi geldi → iş kapanır (Teslim Edildi); Devam Et 2. denemeyi göndermez; yeni gönderimde 'Daha Önce Gönderildi'",
  "J1 + J2 (Y9-7: durdurulmuş olsa da; 2. deneme gitmez)", [A()],
  [baslat("+0s", "T1", "A"), olay("+1h", "duraklat", toplu="T1"), kontrol("+1h30m", "K1"), kontrol("+2h1m", "K2"), olay("+3h", "devam", toplu="T1"),
   kontrol("+26h", "K3"), baslat("+26h1m", "T2", "A")],
  {"kontroller.K1.isler": {"T1/A": "Duraklatıldı"}, "kontroller.K2.isler": {"T1/A": "Teslim Edildi"}, "kontroller.K3.isler": {"T1/A": "Teslim Edildi"},
   "meta.post": {"A": 1}, "isler.T1/A.hata_kodu": None, "isler.T1/A.medya_silme": 1, "bu_ay": {"W1": {"2026-10": ay_kova(1)}}, "toplular.T1.durum": "aktif",
   "olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}}},
  meta_davranis={"kanca": {"A": {"1": K49 + [["delivered", "+2h"]], "2": K_STD}}})

S("J1-02-suresi-doldu-sonra-teslim-daha-once", "J1", "A Süresi Doldu (kanca yolu çalışıyor; Meta listede 12 sa), 4. gün teslim bildirimi → Teslim Edildi; 5. gün aynı dönem 'Daha Önce Gönderildi' (son 30.10); 'Bu Ay' teslim ayına (Kasım)",
  "J1 (süresi dolmuş olsa da) + §7a 17 + H4 + W1 (Y10-9)", [A(), B()],
  [baslat("+0s", "T1", "AB"), kontrol("+3d2h", "K1"), baslat("+5d", "T2", "A")],
  {"kontroller.K1.isler": {"T1/A": "Süresi Doldu", "T1/B": "Teslim Edildi"}, "isler.T1/A.durum": "Teslim Edildi", "olusmadi": ["T2"],
   "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}},
   "bu_ay": {"W1": {"2026-10": ay_kova(1), "2026-11": ay_kova(1)}}, "meta.post": {"A": 1, "B": 1}},
  meta=META_12SA, meta_davranis={"kanca": {"A": [["sent", "+1s"], ["delivered", "+4d"]], "B": K_STD}})

S("J1-03-silinmis-sirket-gec-bildirim", "J1", "Şirket A silindi; A1'in geç teslimi (ortak WABA'nın 'Bu Ay'ına girer) ve A2'nin geç failed'ı 200 ile kabul edilir; şirket B'nin gönderimi sürer",
  "J1 + J3 + J5 + J6 (Y9-4: silinmiş şirket; kalıcı → 200)",
  [sirket_cari("A1", "A", "0551 000 00 01"), sirket_cari("A2", "A", "0551 000 00 02"), sirket_cari("B1", "B", "0552 000 00 01")],
  [baslat("+0s", "T1", ["A1", "A2"], sirket="A"), olay("+1h", "sirket_sil", sirket="A"), baslat("+3h", "T2", ["B1"], sirket="B"), kontrol("+3h1m", "K1")],
  {"toplular": {"T2": {"durum": "aktif", "neden": None, "is_sayisi": 1}}, "kontroller.K1.isler": {"T2/B1": "Teslim Edildi"}, "durum_sayilari": {"Teslim Edildi": 1},
   "bu_ay": {"W1": {"2026-10": ay_kova(2)}}, "kanca_yanitlari": {"200": 6, "503": 0}, "meta.toplam_meta_ileti": 3, "meta.post": {"B1": 1}},
  firmalar={"A": "Alfa Ltd.", "B": "Beta Ltd."}, wabalar={"A": "W1", "B": "W1"}, kanca_yanit_cikti=True, bilinen_ihlal=SIL_IHLAL,
  meta_davranis={"kanca": {"A1": [["sent", "+1s"], ["delivered", "+2h"]], "A2": [["sent", "+1s"], ["failed", "+2h", {"kod": 131026}]], "B1": K_STD}})

S("J1-04-asilmis-belirsiz-gec-teslim-iki-deneme", "J1", "B Sonucu Belirsiz (Meta aldı); Yine de Gönder teslim; 1. iletinin bildirimi 2 saat sonra iş kimliğiyle gelir → o denemeye yazılır: 'Bu Ay' 2; yeni gönderimde 'Daha Önce Gönderildi'",
  "J1 + J5 (Y9-5: aşılmış belirsiz denemenin geç teslimi)", [B()],
  [baslat("+0s", "T1", "B"), olay("+1h", "yine_de_gonder", toplu="T1", cari="B", etiket="G1"), kontrol("+3h", "K1"), baslat("+4h", "T2", "B")],
  {"yeniden": {"G1": yeniden(alinan="B")}, "kontroller.K1.isler": {"T1/B": "Teslim Edildi"}, "meta.post": {"B": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}},
   "olusmadi": ["T2"], "elenen": {"T2": {"B": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}}},
  meta_davranis={"mesaj": {"B": ["yanitsiz_kabul", "kabul"]},
                 "kanca": {"T1/B": {"1": [["sent", "+1s", {"varis": "+2h"}], ["delivered", "+5s", {"varis": "+2h1m"}]], "2": K_STD}}})

S("J1-05-asilmis-belirsiz-gec-teslim-yeni-deneme-basarisiz", "J1", "B Sonucu Belirsiz; Yine de Gönder Başarısız (131026); 1. iletinin geç teslimi gelir → kişi aldı: yeni gönderimde 'Daha Önce Gönderildi' (Sonucu Belirsiz değil)",
  "J1 (başarısız olsa da) + Y9-5; H1 (eski: kaynak belirsiz elemeye devam ederdi)", [B()],
  [baslat("+0s", "T1", "B"), olay("+1h", "yine_de_gonder", toplu="T1", cari="B", etiket="G1"), kontrol("+1h30m", "K1"), baslat("+4h", "T2", "B")],
  {"yeniden": {"G1": yeniden(alinan="B")}, "kontroller.K1.isler": {"T1/B": "Başarısız"}, "isler.T1/B.durum": {"secenek": ["Başarısız", "Teslim Edildi"], "susuyor": GEC},
   "olusmadi": ["T2"], "elenen": {"T2": {"B": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}},
   "bu_ay": {"W1": {"2026-10": ay_kova(1)}}, "meta.post": {"B": 2}},
  meta_davranis={"mesaj": {"B": ["yanitsiz_kabul", "kabul"]},
                 "kanca": {"T1/B": {"1": [["sent", "+1s", {"varis": "+2h"}], ["delivered", "+5s", {"varis": "+2h1m"}]],
                                    "2": [["sent", "+1s"], ["failed", "+10s", {"kod": 131026}]]}}})

S("J1-06-meta-bekletti-ret-gec-teslim-yeniden-acilmaz", "J1", "Meta Bekletti 2. denemesi reddedildi (Başarısız); 1. iletinin geç teslimi → Başarısızları Yeniden Dene A'yı 'Daha Önce Gönderildi' ile eler (iş yeniden açılmaz)",
  "J1 (iş yeniden açılmaz, Y9-3) + K3 + D5", [A()],
  [baslat("+0s", "T1", "A"), kontrol("+24h1m", "K1"), olay("+25h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), kontrol("+25h1m", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Başarısız"}, "yeniden": {"Y1": yeniden(elenen={"A": "daha_once_gonderildi"})}, "meta.post": {"A": 2},
   "bu_ay": {"W1": {"2026-10": ay_kova(1)}}, "isler.T1/A.durum": {"secenek": ["Başarısız", "Teslim Edildi"], "susuyor": GEC}},
  meta_davranis={"mesaj": {"A": ["kabul", {"hata": 131049}]}, "kanca": {"A": {"1": K49 + [["delivered", "+24h30m"]]}}})

# ---- J2: Meta Bekletti'deki ileti teslim edilirse iş kapanır ----
S("J2-01-meta-bekletti-teslim-is-kapanir", "J2", "Meta Bekletti (131049 kancada); 2 saat sonra 1. ileti teslim edildi → iş Teslim Edildi, PDF silinir, 24 sa sonraki 2. deneme GİTMEZ; yeni gönderimde 'Daha Önce Gönderildi'",
  "J2 (Y9-6) + J1", [A()],
  [baslat("+0s", "T1", "A"), kontrol("+1h", "K1"), kontrol("+2h1m", "K2"), kontrol("+25h", "K3"), baslat("+26h", "T2", "A")],
  {"kontroller.K1.isler": {"T1/A": BEKLETTI}, "kontroller.K2.isler": {"T1/A": "Teslim Edildi"}, "kontroller.K3.isler": {"T1/A": "Teslim Edildi"},
   "meta.post": {"A": 1}, "meta.medya_silme": {"A": 1}, "isler.T1/A.hata_kodu": None, "bu_ay": {"W1": {"2026-10": ay_kova(1)}},
   "olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}}},
  meta_davranis={"kanca": {"A": {"1": K49 + [["delivered", "+2h"]], "2": K_STD}}})

S("J2-02-meta-bekletti-okundu-is-kapanir", "J2", "Meta Bekletti; 1. ileti OKUNDU (delivered'sız) → iş Okundu, 2. deneme gitmez; öbür kişi normal", "J2 (read = teslim, Meta)",
  [A(), B()], [baslat("+0s", "T1", "AB"), kontrol("+3h1m", "K1"), kontrol("+30h", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Okundu", "T1/B": "Teslim Edildi"}, "kontroller.K2.isler": {"T1/A": "Okundu", "T1/B": "Teslim Edildi"},
   "meta.post": {"A": 1, "B": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}, "durum_sayilari": {"Okundu": 1, "Teslim Edildi": 1}},
  meta_davranis={"kanca": {"A": {"1": K49 + [["read", "+3h"]], "2": K_STD}, "B": K_STD}})

# ---- J3: geç "teslim edilemedi" her durumda geçerli ----
S("J3-01-geri-yukleme-sonrasi-gec-failed-yeniden-gonderilir", "J3", "Yedekten sonra açılan T1/B kabul; yedeğe dönüldü (defterdeki kabul 'Daha Önce Gönderildi' — D7); geç failed gelince kişi almadı → yeni gönderimde gider",
  "J3 (geri yükleme sonrası da) + D7 (Y9-8)", [B()],
  [olay("+0s", "yedek_al", ad="Y0"), baslat("+1m", "T1", "B"), olay("+1h", "geri_yukle", yedek="Y0"), baslat("+2h", "T2", "B"), baslat("+4h", "T3", "B"),
   kontrol("+4h1m", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"B": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}}, "toplular.T3.is_sayisi": 1,
   "kontroller.K1.isler": {"T3/B": "Teslim Edildi"}, "bu_ay": {"W1": {"2026-10": ay_kova(1)}}},
  meta_davranis={"kanca": {"T1/B": [["sent", "+1s"], ["failed", "+3h", {"kod": 131026}]], "*": K_STD}}, bilinen_ihlal=GERI_IHLAL)

S("J3-02-sifirlama-sonrasi-gec-failed-yeniden-gonderilir", "J3", "Şirket Verisini Sıfırla'dan sonra (kâhinde iş dosyada kalır, S-13) kabul 'Daha Önce Gönderildi'; geç failed → Başarısız, yeni gönderimde gider",
  "J3 (sıfırlama sonrası da)", [B()],
  [baslat("+0s", "T1", "B"), olay("+1h", "sifirla"), baslat("+2h", "T2", "B"), baslat("+4h", "T3", "B"), kontrol("+4h1m", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"B": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}}, "toplular.T3.is_sayisi": 1,
   "isler.T1/B.durum": "Başarısız", "isler.T3/B.durum": "Teslim Edildi", "meta.post": {"B": 2}},
  meta_davranis={"kanca": {"T1/B": [["sent", "+1s"], ["failed", "+3h", {"kod": 131026}]], "*": K_STD}})

S("J3-03-asilmis-belirsiz-gec-failed-kisi-almadi", "J3", "B Sonucu Belirsiz; Yine de Gönder Başarısız; 1. iletinin geç failed'ı iş kimliğiyle gelir → kimse almadı: yeni gönderimde B gider (Sonucu Belirsiz ile elenmez)",
  "J3 + Y9-5 + G0 (1)", [B()],
  [baslat("+0s", "T1", "B"), olay("+1h", "yine_de_gonder", toplu="T1", cari="B", etiket="G1"), baslat("+3h", "T2", "B"), kontrol("+3h1m", "K1")],
  {"yeniden": {"G1": yeniden(alinan="B")}, "elenen": {}, "onceki_uyari": {}, "toplular.T2.is_sayisi": 1,
   "kontroller.K1.isler": {"T1/B": "Başarısız", "T2/B": "Teslim Edildi"}, "meta.post": {"B": 3}},
  meta_davranis={"mesaj": {"B": ["yanitsiz_kabul", "kabul", "kabul"]},
                 "kanca": {"T1/B": {"1": [["failed", "+5s", {"kod": 131026, "varis": "+2h"}]], "2": [["sent", "+1s"], ["failed", "+10s", {"kod": 131026}]]}, "*": K_STD}})

S("J3-04-eski-denemenin-failed-i-simdiki-kabulu-bozmaz", "J3", "B Sonucu Belirsiz; Yine de Gönder kabul (Gönderildi); 1. iletinin geç failed'ı yalnız o denemeye yazılır — iş Gönderildi kalır, sonra Teslim Edildi",
  "J3 + Y9-5 (eski denemenin failed'ı şu anki denemeye dokunmaz)", [B()],
  [baslat("+0s", "T1", "B"), olay("+1h", "yine_de_gonder", toplu="T1", cari="B", etiket="G1"), kontrol("+2h30m", "K1"), kontrol("+3h30m", "K2")],
  {"yeniden": {"G1": yeniden(alinan="B")}, "kontroller.K1.isler": {"T1/B": "Gönderildi"}, "kontroller.K2.isler": {"T1/B": "Teslim Edildi"},
   "isler.T1/B.durum": "Teslim Edildi", "bu_ay": {"W1": {"2026-10": ay_kova(1)}}, "meta.post": {"B": 2}},
  meta_davranis={"mesaj": {"B": ["yanitsiz_kabul", "kabul"]},
                 "kanca": {"T1/B": {"1": [["failed", "+5s", {"kod": 131026, "varis": "+2h"}]], "2": [["sent", "+1s"], ["delivered", "+2h"]]}}})

# ---- J4: Süresi Doldu son kabul edilen denemeden ----
S("J4-01-suresi-doldu-son-kabulden-meta-bekletti", "J4", "Meta Bekletti; 24 sa sonra 2. deneme kabul (Gönderildi, teslim yok): Süresi Doldu 2. kabulden süre + 1 sa sonra (Meta listede 12 sa: 30. saatte hâlâ Gönderildi, 38. saatte Süresi Doldu)",
  "J4 (Y9-9) + §6 W2 + W1 (Y10-3/9)", [A(), B()],
  [baslat("+0s", "T1", "AB"), kontrol("+30h", "K1"), kontrol("+38h", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Gönderildi", "T1/B": "Teslim Edildi"}, "kontroller.K2.isler": {"T1/A": "Süresi Doldu", "T1/B": "Teslim Edildi"},
   "meta.post": {"A": 2, "B": 1}, "isler.T1/A.medya_silme": 1, "bu_ay": {"W1": {"2026-10": ay_kova(1)}}},
  meta=META_12SA, meta_davranis={"kanca": {"A": {"1": K49, "2": YANLIZ_KS}, "B": K_STD}})

S("J4-02-suresi-doldu-son-kabulden-yine-de-gonder", "J4", "B Sonucu Belirsiz (bildirimsiz); 1. gün Yine de Gönder kabul (Gönderildi): Süresi Doldu Yine de Gönder'in kabulünden süre + 1 sa sonra (Meta listede 12 sa: 30. saatte Gönderildi, 38. saatte Süresi Doldu)",
  "J4 (Y9-9) + W1 (Y10-3/9)", [B(), A()],
  [baslat("+0s", "T1", "BA"), olay("+1d", "yine_de_gonder", toplu="T1", cari="B", etiket="G1"), kontrol("+30h", "K1"), kontrol("+38h", "K2")],
  {"yeniden": {"G1": yeniden(alinan="B")}, "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Gönderildi"},
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/B": "Süresi Doldu"}, "meta.post": {"A": 1, "B": 2}},
  meta=META_12SA, meta_davranis={"mesaj": {"B": ["yanitsiz_kabul", "kabul"]}, "kanca": {"T1/B": {"1": [], "2": YANLIZ_KS}, "A": K_STD}})

# ---- J5: "Bu Ay" her teslim edilen denemeyi sayar ----
S("J5-01-bekletme-sonrasi-iki-teslim", "J5", "Meta Bekletti; 2. deneme teslim; SONRA 1. iletinin de teslimi geldi → 'Bu Ay' 2 (kişiye 2 ileti — BİLİNEN SINIR)",
  "J5 (bekletme sonrası iki teslim → 2)", [A()],
  [baslat("+0s", "T1", "A"), kontrol("+25h", "K1"), kontrol("+31h", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Teslim Edildi"}, "kontroller.K2.isler": {"T1/A": "Teslim Edildi"}, "isler.T1/A.durum": "Teslim Edildi",
   "meta.post": {"A": 2}, "meta.meta_ileti": {"A": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta_davranis={"kanca": {"A": {"1": K49 + [["delivered", "+30h"]], "2": K_STD}}}, bilinen_sinir=BS_J5)

S("J5-02-iki-teslim-ay-donumu-yerel", "J5", "30.10 Meta Bekletti; 31.10 2. deneme teslim (Ekim); 1. iletinin teslimi 01.11 01:00 (UTC'de 31.10) → 'Bu Ay' Ekim 1 + Kasım 1 (Türkiye saati)",
  "J5 + §7a 19 (teslim ayı Türkiye saati; gece yarısı yerel ≠ UTC)", [A()],
  [baslat("+0s", "T1", "A")],
  {"isler.T1/A.durum": "Teslim Edildi", "meta.post": {"A": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(1), "2026-11": ay_kova(1)}}},
  meta_davranis={"kanca": {"A": {"1": K49 + [["delivered", "+39h"]], "2": K_STD}}}, bilinen_sinir=BS_J5)

# ---- J6: kanca yanıtı (503 / 200) ve eşgüçlülük ----
S("J6-01-yanit-beklenirken-taninmayan-503-yineleme", "J6", "Meta yanıtı 10 sn gecikir; bu arada gelen A bildirimleri ve başka aracın bildirimi 503; Meta yineleyince 200: A Teslim Edildi (tek bildirimle aynı), başka aracınki düşer",
  "J6 (Y9-11 c, Y9-12, Y9-13 eşgüçlülük)", [A()],
  [baslat("+0s", "T1", "A"), olay("+7s", "sahte_kanca", wamid="wamid.BASKA-ARAC", durum="delivered", imzali=True), olay("+2m", "kanca_kuyrugu"), kontrol("+3m", "K1")],
  {"isler.T1/A.durum": "Teslim Edildi", "kontroller.K1.isler": {"T1/A": "Teslim Edildi"}, "kanca_yanitlari": {"200": 3, "503": 3},
   "bu_ay": {"W1": {"2026-10": ay_kova(1)}}, "meta.post": {"A": 1}, "meta.kabul": {"A": 1}},
  kanca_yanit_cikti=True, meta_davranis={"mesaj": {"A": [{"gec_kabul": "+10s"}]}, "kanca": {"A": [["sent", "+1s"], ["delivered", "+3s"]]}})

S("J6-02-sirket-gecici-acilamaz-503", "J6", "Şirket geçici açılamazken gelen teslim bildirimi 503; şirket açılıp Meta yineleyince 200 → Teslim Edildi",
  "J6 (Y9-11 b)", [A()],
  [baslat("+0s", "T1", "A"), olay("+30s", "sirket_acilamaz", sirket="A", acik=True), kontrol("+2m", "K1"), olay("+5m", "sirket_acilamaz", sirket="A", acik=False),
   olay("+6m", "kanca_kuyrugu"), kontrol("+7m", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Gönderildi"}, "kontroller.K2.isler": {"T1/A": "Teslim Edildi"}, "kanca_yanitlari": {"200": 2, "503": 1},
   "bu_ay": {"W1": {"2026-10": ay_kova(1)}}, "meta.post": {"A": 1}},
  kanca_yanit_cikti=True, meta_davranis={"kanca": {"A": [["sent", "+1s"], ["delivered", "+1m"]]}})

S("J6-03-bildirim-kaydedilemez-503", "J6", "Bildirim kaydedilemezken gelen teslim 503; kayıt düzelip Meta yineleyince 200 → Teslim Edildi",
  "J6 (Y9-11 a)", [A()],
  [baslat("+0s", "T1", "A"), olay("+30s", "bildirim_yazilamaz", acik=True), kontrol("+2m", "K1"), olay("+5m", "bildirim_yazilamaz", acik=False),
   olay("+6m", "kanca_kuyrugu"), kontrol("+7m", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Gönderildi"}, "kontroller.K2.isler": {"T1/A": "Teslim Edildi"}, "kanca_yanitlari": {"200": 2, "503": 1},
   "bu_ay": {"W1": {"2026-10": ay_kova(1)}}, "meta.post": {"A": 1}},
  kanca_yanit_cikti=True, meta_davranis={"kanca": {"A": [["sent", "+1s"], ["delivered", "+1m"]]}})

# ---- J7: onarım bekleyen kabul varken yeni gönderim başlamaz ----
S("J7-01-onarim-bekleyen-kabul-yeni-gonderim-baslamaz", "J7", "Meta yanıtı geldiğinde GÖNDERİM DEFTERİ yazılamıyor → iş dosyada Meta Kabul Etti ama kabul defterde eksik (onarım bekliyor): yeni gönderim BAŞLAMAZ (neden); defter onarılıp program yeniden açılınca A 'Daha Önce Gönderildi', C gider",
  "J7 (liste metni madde 7, Y9e-1/2 — 9d düzeltmesi)", [A(), C()],
  [baslat("+0s", "T1", "A"), olay("+7s", "defter_yazilamaz", acik=True), baslat("+1m", "T2", "C"), olay("+5m", "defter_yazilamaz", acik=False),
   olay("+6m", "kapat"), olay("+7m", "ac"), baslat("+11m", "T3", "AC"), kontrol("+12m", "K1")],
  {"baslamadi": {"T2": "onarim_bekleyen_kabul"}, "elenen": {"T3": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T3": {"sayi": 1, "son": "2026-10-30"}},
   "toplular.T3.is_sayisi": 1, "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T3/C": "Teslim Edildi"}, "meta.post": {"A": 1, "C": 1},
   "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta_davranis={"mesaj": {"A": [{"gec_kabul": "+10s"}]}, "kanca": {"A": [["sent", "+1s", {"varis": "+10m"}], ["delivered", "+5s", {"varis": "+10m"}]], "C": K_STD}})

S("J7-02-onarim-sirasinda-bildirim-sonra-tek-ileti", "J7", "Defter onarım beklerken gelen bildirim kaydedilemez (503, Meta yineler); defter onarılınca A Teslim Edildi, tek ileti; yeni gönderim onarımdan sonra başlar",
  "J7 (liste metni madde 7) + J6 (Y9e-3)", [A(), C()],
  [baslat("+0s", "T1", "A"), olay("+7s", "defter_yazilamaz", acik=True), baslat("+3m", "T2", "C"), olay("+5m", "defter_yazilamaz", acik=False),
   olay("+6m", "kanca_kuyrugu"), baslat("+7m", "T3", "C"), kontrol("+8m", "K1")],
  {"baslamadi": {"T2": "onarim_bekleyen_kabul"}, "isler.T1/A.durum": "Teslim Edildi", "toplular.T3.is_sayisi": 1, "meta.post": {"A": 1, "C": 1},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T3/C": "Teslim Edildi"}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}, "kanca_yanitlari": {"200": 4, "503": 2}},
  kanca_yanit_cikti=True, meta_davranis={"mesaj": {"A": [{"gec_kabul": "+10s"}]}, "kanca": {"A": [["sent", "+1m"], ["delivered", "+2m"]], "C": K_STD}})

# ---- J8: Tüm Hareketler'in kişiye özel dönemi ↔ o günün Bu Ay / Geçen Ay'ı ----
S("J8-01-tum-hareketler-bu-ay-ayni-gun", "J8", "05.11 Tüm Hareketler: P'nin dönemi 01.11–05.11 (= o günün Bu Ay'ı) → aynı gün Bu Ay'da 'Daha Önce Gönderildi'; R (15.10–) gider",
  "J8 (Y9-15 okuma 'ilk hareket – o gün', Y9-16)", [P_(), R_()],
  [baslat("+0s", "T1", "PR", donem="tum"), baslat("+1h", "T2", "PR", donem=BU_AY), kontrol("+2h", "K1")],
  {"elenen": {"T2": {"P": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-11-05"}}, "toplular.T2.is_sayisi": 1,
   "meta.post": {"P": 1, "R": 2}},
  baslangic="2026-11-05T10:00:00+03:00", meta_davranis={"kanca": {"*": K_STD}})

S("J8-02-tum-hareketler-gecen-ay-ayni-gun", "J8", "05.11 Tüm Hareketler: Q'nun hareketleri 01.10–31.10 ama kişiye özel dönemi 01.10–05.11 (ilk hareket – açılış günü) ≠ Geçen Ay → aynı gün Geçen Ay'da Q da R de gider",
  "J8 + J11 (güncelleme 9b: S9-3 tek okuma — eski 'ilk – son hareket' okuması düştü, beklenti DEĞİŞTİ)", [Q_(), R_()],
  [baslat("+0s", "T1", "QR", donem="tum"), baslat("+1h", "T2", "QR", donem=GECEN_AY), kontrol("+2h", "K1")],
  {"elenen": {}, "onceki_uyari": {}, "toplular.T2.is_sayisi": 2, "meta.post": {"Q": 2, "R": 2},
   "isler.T1/Q.degiskenler": ["Kemal Ekim", FIRMA, "01.10.2026 – 05.11.2026", "150,00 TL"]},
  baslangic="2026-11-05T10:00:00+03:00", meta_davranis={"kanca": {"*": K_STD}})

S("J8-03-tum-hareketler-kanon-sonraki-gun-bu-ay", "J8", "03.11 Tüm Hareketler: S'nin dönemi 01.11–03.11 (= o günün Bu Ay'ı → Kasım); 05.11 Bu Ay (01.11–05.11) aynı dönem: 'Daha Önce Gönderildi'",
  "J8 (Y9-16: o günün Bu Ay'ı → o ayın dönemi; K1 takvim ayı)", [S_()],
  [baslat("+0s", "T1", "S", donem="tum"), baslat("+2d", "T2", "S", donem=BU_AY), kontrol("+2d1h", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"S": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-11-03"}}, "meta.post": {"S": 1}},
  baslangic="2026-11-03T10:00:00+03:00", meta_davranis={"kanca": {"*": K_STD}})

S("J8-04-tum-hareketler-bekleyen-bu-ay-zaten-kuyrukta", "J8", "05.11 Tüm Hareketler sınır 1: P bekliyor; aynı gün Bu Ay'da P 'Zaten Kuyrukta'",
  "J8 + K2 (Zaten Kuyrukta aynı eşlikle)", [R_(), P_()],
  [baslat("+0s", "T1", "RP", donem="tum"), baslat("+1h", "T2", "P", donem=BU_AY), kontrol("+2h", "K1")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"P": "zaten_kuyrukta"}}, "kontroller.K1.isler": {"T1/P": "Sınır Nedeniyle Bekliyor", "T1/R": "Teslim Edildi"},
   "meta.post": {"P": 1, "R": 1}},
  baslangic="2026-11-05T10:00:00+03:00", ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("J8-05-ay-sonu-tum-sonra-gecen-ay-gece-yarisi", "J8", "31.10 23:30 Tüm Hareketler: Q'nun dönemi 01.10–31.10 (= o günün Bu Ay'ı → Ekim); 01.11 00:30 (UTC'de 31.10) Geçen Ay (Ekim) 'Daha Önce Gönderildi'",
  "J8 (Y9-16) + K1 (ay sonu, gece yarısı yerel ≠ UTC)", [Q_()],
  [baslat("+0s", "T1", "Q", donem="tum"), baslat("+1h", "T2", "Q", donem=GECEN_AY)],
  {"olusmadi": ["T2"], "elenen": {"T2": {"Q": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-31"}}, "meta.post": {"Q": 1}},
  baslangic="2026-10-31T23:30:00+03:00", meta_davranis={"kanca": {"*": K_STD}})

S("J8-06-ozel-aralik-kanon-sonra-tum-hareketler", "J8", "03.11 özel 01.11–03.11 (o günün Bu Ay'ı → Kasım); 05.11 Tüm Hareketler: S'nin dönemi 01.11–05.11 (o günün Bu Ay'ı → Kasım) aynı dönem: 'Daha Önce Gönderildi'",
  "J8 (Y9-16) + G2 (2) kanon", [S_()],
  [baslat("+0s", "T1", "S", donem={"bas": "2026-11-01", "son": "2026-11-03"}), baslat("+2d", "T2", "S", donem="tum")],
  {"olusmadi": ["T2"], "elenen": {"T2": {"S": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-11-03"}}, "meta.post": {"S": 1}},
  baslangic="2026-11-03T10:00:00+03:00", meta_davranis={"kanca": {"*": K_STD}})

# ---- J9: n3 — kuyruktaki ikinci iş birincinin geç tesliminden sonra da gider (güncelleme 11: BİLİNEN SINIR değil KARAR — SW1 "İkinci de gitsin") ----
S("J9-01-n3-iptal-sonrasi-ikinci-is-gec-teslim-iki-ileti", "J9", "T1/A Meta Bekletti → İptal (sayılmaz); T2/A açıldı ve duraklatıldı; T1'in geç teslimi geldi; Devam Et → T2/A YİNE gider: 2 ileti (n3; KARAR SW1)",
  "J9 (n3; KARAR 05:58) + SW1 (05.11 'İkinci de gitsin') + K7", [A()],
  [baslat("+0s", "T1", "A"), olay("+1h", "iptal", toplu="T1"), baslat("+2h", "T2", "A"), olay("+2h", "duraklat", toplu="T2"), kontrol("+3h1m", "K1"),
   olay("+4h", "devam", toplu="T2"), kontrol("+4h1m", "K2"), baslat("+5h", "T3", "A")],
  {"kontroller.K1.isler": {"T1/A": {"secenek": ["İptal", "Teslim Edildi"], "susuyor": GEC}, "T2/A": "Duraklatıldı"},
   "kontroller.K2.isler": {"T1/A": {"secenek": ["İptal", "Teslim Edildi"], "susuyor": GEC}, "T2/A": "Teslim Edildi"},
   "meta.post": {"A": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}, "olusmadi": ["T3"], "elenen": {"T3": {"A": "daha_once_gonderildi"}},
   "onceki_uyari": {"T3": {"sayi": 1, "son": "2026-10-30"}}},
  meta_davranis={"kanca": {"T1/A": K49 + [["delivered", "+3h"]], "*": K_STD}})

S("J9-02-n3-basarisiz-sonrasi-ikinci-is-gec-teslim-iki-ileti", "J9", "T1/A Başarısız (failed 131026, sayılmaz); T2/A açıldı ve duraklatıldı; T1'in geç teslimi geldi; Devam Et → T2/A YİNE gider: 2 ileti (n3; KARAR SW1)",
  "J9 (n3; 'failed sonrası geç teslim') + SW1 + K3", [A()],
  [baslat("+0s", "T1", "A"), baslat("+1h", "T2", "A"), olay("+1h", "duraklat", toplu="T2"), olay("+4h", "devam", toplu="T2"), baslat("+5h", "T3", "A")],
  {"meta.post": {"A": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}, "isler.T2/A.durum": "Teslim Edildi",
   "isler.T1/A.durum": {"secenek": ["Başarısız", "Teslim Edildi"], "susuyor": GEC}, "olusmadi": ["T3"], "elenen": {"T3": {"A": "daha_once_gonderildi"}}},
  meta_davranis={"kanca": {"T1/A": [["sent", "+1s"], ["failed", "+10s", {"kod": 131026}], ["delivered", "+3h"]], "*": K_STD}})


# ======================================================================== KÂHİN GÜNCELLEMESİ 9b (01.11.2026 07:07 + 07:11 UTC): J10 = S9-1 (+ kapsam a/b/c), J11 = S9-2 (+ gün)
GECIKMELI_B = {"1": [["sent", "+1s", {"varis": "+2h"}], ["delivered", "+5s", {"varis": "+2h1m"}]], "2": K_STD}   # B'nin 1. iletisi Meta'da, bildirimi 2 saat gecikir


def N_(id_, ad, tel):
    return cari(id_, ad, tel, [])


# ---- J10: S9-1 "Gitmesin" — yalnız belirsizlik onayları ----
S("J10-01-a-yine-de-gonder-sinirda-eski-teslim-gitmez", "J10", "B Sonucu Belirsiz; işteki Yine de Gönder sınırda bekliyor; eski iletinin teslimi gelir → yeni ileti GİTMEZ: 'Atlandı — Daha Önce Gönderildi'",
  "J10 (07:11 a, Y9c-1) + J5 (eski teslim sayılır, Y9c-4)", [B(), A()],
  [baslat("+0s", "T1", "BA"), olay("+1h", "yine_de_gonder", toplu="T1", cari="B", etiket="G1"), kontrol("+1h30m", "K1"), kontrol("+2h2m", "K2"),
   kontrol("+25h", "K3"), baslat("+26h", "T2", "B")],
  {"yeniden": {"G1": yeniden(alinan="B")}, "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Sınır Nedeniyle Bekliyor"},
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/B": "Atlandı"}, "kontroller.K3.isler": {"T1/A": "Teslim Edildi", "T1/B": "Atlandı"},
   "isler.T1/B.atlanma_nedeni": "daha_once_gonderildi", "isler.T1/B.medya_silme": 1, "meta.post": {"A": 1, "B": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}},
   "olusmadi": ["T2"], "elenen": {"T2": {"B": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"mesaj": {"B": ["yanitsiz_kabul", "kabul"]}, "kanca": {"T1/B": GECIKMELI_B, "A": K_STD}})

S("J10-02-a-yine-de-gonder-duraklatilmis-eski-teslim-gitmez", "J10", "B Sonucu Belirsiz; Yine de Gönder verilip toplu iş hemen duraklatıldı; eski iletinin teslimi gelir → Atlandı; Devam Et göndermez",
  "J10 (07:11 a, Y9c-1)", [B()],
  [baslat("+0s", "T1", "B"), olay("+1h", "yine_de_gonder", toplu="T1", cari="B", etiket="G1"), olay("+1h", "duraklat", toplu="T1"), kontrol("+1h30m", "K1"),
   kontrol("+2h2m", "K2"), olay("+3h", "devam", toplu="T1"), kontrol("+3h1m", "K3"), baslat("+4h", "T2", "B")],
  {"yeniden": {"G1": yeniden(alinan="B")}, "kontroller.K1.isler": {"T1/B": "Duraklatıldı"}, "kontroller.K2.isler": {"T1/B": "Atlandı"},
   "kontroller.K3.isler": {"T1/B": "Atlandı"}, "isler.T1/B.atlanma_nedeni": "daha_once_gonderildi", "meta.post": {"B": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(1)}},
   "olusmadi": ["T2"], "elenen": {"T2": {"B": "daha_once_gonderildi"}}},
  meta_davranis={"mesaj": {"B": ["yanitsiz_kabul", "kabul"]}, "kanca": {"T1/B": GECIKMELI_B}})

S("J10-03-c-belirsiz-zinciri-yeniden-deneme-eski-teslim-gitmez", "J10", "B Sonucu Belirsiz → Yine de Gönder Başarısız; 1. iletinin geç failed'ı (almadı) → Başarısızları Yeniden Dene (duraklatıldı); sonra 1. iletinin teslimi → zincir (a)'dan: yeniden deneme GİTMEZ, Atlandı",
  "J10 (07:11 c, Y9c-2) + J3 + J1", [B()],
  [baslat("+0s", "T1", "B"), olay("+1h", "yine_de_gonder", toplu="T1", cari="B", etiket="G1"), olay("+2h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"),
   olay("+2h", "duraklat", toplu="T1"), kontrol("+2h30m", "K1"), kontrol("+3h1m", "K2"), olay("+4h", "devam", toplu="T1"), kontrol("+4h1m", "K3")],
  {"yeniden": {"G1": yeniden(alinan="B"), "Y1": yeniden(alinan="B")}, "kontroller.K1.isler": {"T1/B": "Duraklatıldı"}, "kontroller.K2.isler": {"T1/B": "Atlandı"},
   "kontroller.K3.isler": {"T1/B": "Atlandı"}, "isler.T1/B.atlanma_nedeni": "daha_once_gonderildi", "meta.post": {"B": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(1)}}},
  meta_davranis={"mesaj": {"B": ["yanitsiz_kabul", {"hata": 131026}, "kabul"]},
                 "kanca": {"T1/B": {"1": [["failed", "+5s", {"kod": 131026, "varis": "+1h30m"}], ["delivered", "+6s", {"varis": "+3h"}]], "*": K_STD}}})

S("J10-04-c-duz-yeniden-deneme-eski-teslim-ikinci-kopya-gider", "J10", "A Başarısız (belirsizlik onayı yok); Başarısızları Yeniden Dene duraklatıldı; eski iletinin geç teslimi gelir → kapsam dışı: Devam Et ile yeniden deneme GİDER (2 ileti)",
  "J10 (07:11 c: yalnız (a) zinciri; Y9c-2) + J1 (teslim sayılır)", [A()],
  [baslat("+0s", "T1", "A"), olay("+1h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), olay("+1h", "duraklat", toplu="T1"), kontrol("+3h1m", "K1"),
   olay("+4h", "devam", toplu="T1"), kontrol("+4h1m", "K2")],
  {"yeniden": {"Y1": yeniden(alinan="A")}, "kontroller.K1.isler": {"T1/A": "Duraklatıldı"}, "kontroller.K2.isler": {"T1/A": "Teslim Edildi"},
   "meta.post": {"A": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta_davranis={"kanca": {"T1/A": {"1": [["sent", "+1s"], ["failed", "+10s", {"kod": 131026}], ["delivered", "+3h"]], "2": K_STD}}})

S("J10-05-b-r3-yine-de-gonder-onceki-teslim-ikinci-kopya-gider", "J10", "B'ye T1 kabul edildi (teslim henüz yok); T2'de R3 uyarısına rağmen Yine de Gönder seçildi, duraklatıldı; T1'in teslimi gelir → kapsam dışı: T2/B GİDER (ikinci kopya)",
  "J10 (07:11 b, Y9c-3) + R3", [B()],
  [baslat("+0s", "T1", "B"), baslat("+1h", "T2", "B", onceki="gonder"), olay("+1h", "duraklat", toplu="T2"), kontrol("+3h1m", "K1"), olay("+4h", "devam", toplu="T2"),
   kontrol("+4h1m", "K2")],
  {"onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}}, "toplular.T2.is_sayisi": 1, "kontroller.K1.isler": {"T1/B": "Teslim Edildi", "T2/B": "Duraklatıldı"},
   "kontroller.K2.isler": {"T1/B": "Teslim Edildi", "T2/B": "Teslim Edildi"}, "meta.post": {"B": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta_davranis={"kanca": {"T1/B": [["sent", "+1s"], ["delivered", "+3h"]], "*": K_STD}})

# ---- J11: S9-2 — Tüm Hareketler {{3}} ve PDF dönemi = ilk hareket – açılış günü ----
S("J11-01-tum-hareketler-metni-acilis-gunu-sinirla-ertesi-gun", "J11", "05.11 23:30 Tüm Hareketler sınır 1: P aynı gün, R ertesi gün gider; ikisinin {{3}} ve PDF dönemi de ilk hareket – 05.11 (açılış günü)",
  "J11 (S9-2 + 07:11: ertesi güne kaysa da açılış günü; metin PDF ile aynı)", [P_(), R_()],
  [baslat("+0s", "T1", "PR", donem="tum"), kontrol("+1h", "K1")],
  {"kontroller.K1.isler": {"T1/P": "Teslim Edildi", "T1/R": "Sınır Nedeniyle Bekliyor"}, "isler.T1/R.durum": "Teslim Edildi",
   "isler.T1/P.degiskenler": ["Pelin Kara", FIRMA, "01.11.2026 – 05.11.2026", "150,00 TL"],
   "isler.T1/R.degiskenler": ["Rana Ortada", FIRMA, "15.10.2026 – 05.11.2026", "70,00 TL"],
   "isler.T1/P.pdf": {"cari_ad": "Pelin Kara", "donem_bas": "2026-11-01", "donem_son": "2026-11-05", "devir": "0.00", "hareket_sayisi": 2, "donem_sonu_bakiye": "150.00"},
   "isler.T1/R.pdf": {"cari_ad": "Rana Ortada", "donem_bas": "2026-10-15", "donem_son": "2026-11-05", "devir": "0.00", "hareket_sayisi": 1, "donem_sonu_bakiye": "70.00"}},
  baslangic="2026-11-05T23:30:00+03:00", ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("J11-02-hareketsiz-cari-metni-ve-eslik", "J11", "Hareketsiz N1: 01.11 Tüm ({{3}} 01.11–01.11 = o günün Bu Ay'ı) → 03.11 Bu Ay 'Daha Önce Gönderildi'; hareketsiz N2: 05.11 Tüm (05.11–05.11) → aynı gün Bu Ay gider, özel 05.11–05.11 elenir",
  "J11 + J8 (hareketsiz carinin dönemi iletideki dönem; Y9b-5)", [N_("N1", "Nur Hareketsiz", "0547 555 66 77"), N_("N2", "Naci Hareketsiz", "0548 666 77 88")],
  [baslat("+0s", "T1", ["N1"], donem="tum"), baslat("+2d", "T2", ["N1"], donem=BU_AY), baslat("+4d", "T3", ["N2"], donem="tum"),
   baslat("+4d1h", "T4", ["N2"], donem=BU_AY), baslat("+4d2h", "T5", ["N2"], donem={"bas": "2026-11-05", "son": "2026-11-05"})],
  {"isler.T1/N1.degiskenler": ["Nur Hareketsiz", FIRMA, "01.11.2026 – 01.11.2026", "0,00 TL"],
   "isler.T3/N2.degiskenler": ["Naci Hareketsiz", FIRMA, "05.11.2026 – 05.11.2026", "0,00 TL"],
   "isler.T1/N1.pdf": {"cari_ad": "Nur Hareketsiz", "donem_bas": "2026-11-01", "donem_son": "2026-11-01", "devir": "0.00", "hareket_sayisi": 0, "donem_sonu_bakiye": "0.00"},
   "olusmadi": ["T2", "T5"], "elenen": {"T2": {"N1": "daha_once_gonderildi"}, "T5": {"N2": "daha_once_gonderildi"}},
   "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-11-01"}, "T5": {"sayi": 1, "son": "2026-11-05"}}, "toplular.T4.is_sayisi": 1, "meta.post": {"N1": 1, "N2": 2}},
  baslangic="2026-11-01T10:00:00+03:00", meta_davranis={"kanca": {"*": K_STD}})

S("J11-03-ertesi-gune-kayan-kisi-acilis-gunuyle-eslesir", "J11", "05.11 23:30 Tüm sınır 1: U 06.11'de gider ama dönemi 01.11–05.11 (açılış günü); 07.11 özel 01.11–06.11 GİDER, özel 01.11–05.11 'Daha Önce Gönderildi'",
  "J11 (07:11) + J8 (Y9c-7 tek okuma) + G6", [R_(), cari("U", "Ufuk Kasım", "0549 777 88 99", [("2026-11-01", 40, 0)])],
  [baslat("+0s", "T1", "RU", donem="tum"), baslat("+1d10h30m", "T2", "U", donem={"bas": "2026-11-01", "son": "2026-11-06"}),
   baslat("+1d11h", "T3", "U", donem={"bas": "2026-11-01", "son": "2026-11-05"})],
  {"isler.T1/U.degiskenler": ["Ufuk Kasım", FIRMA, "01.11.2026 – 05.11.2026", "40,00 TL"], "toplular.T2.is_sayisi": 1, "olusmadi": ["T3"],
   "elenen": {"T3": {"U": "daha_once_gonderildi"}}, "meta.post": {"R": 1, "U": 2}},
  baslangic="2026-11-05T23:30:00+03:00", ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})


# ======================================================================== KÂHİN GÜNCELLEMESİ 9c (07:11 seçenek metni): J12 — ekstre içeriği açılışta hazırlanır
S("J12-01-yine-de-gonder-ekstre-icerigi-acilistaki-gibi", "J12", "B Sonucu Belirsiz (Meta almadı); kuyrukta B'ye 1.000 TL hareket girdi; işteki Yine de Gönder AÇILIŞTA hazırlanan ekstreyi gönderir (2.000,00 TL)",
  "J12 (Y9d-1: yeniden gönderilse de değişmez) + K4", [B()],
  [baslat("+0s", "T1", "B"), olay("+30m", "cari", id="B", hareket_ekle={"tarih": "2026-10-30", "borc": 1000, "alacak": 0}),
   olay("+1h", "yine_de_gonder", toplu="T1", cari="B", etiket="G1")],
  {"yeniden": {"G1": yeniden(alinan="B")}, "isler.T1/B.durum": "Teslim Edildi", "isler.T1/B.degiskenler": ["Mehmet Kaya", FIRMA, DON, "2.000,00 TL"],
   "isler.T1/B.pdf": {"cari_ad": "Mehmet Kaya", "donem_bas": "2026-10-01", "donem_son": "2026-10-31", "devir": "0.00", "hareket_sayisi": 1, "donem_sonu_bakiye": "2000.00"},
   "meta.post": {"B": 2}},
  meta_davranis={"mesaj": {"B": ["yanitsiz_red", "kabul"]}, "kanca": {"*": K_STD}})

S("J12-02-tum-hareketler-acilistan-sonra-tarihli-hareket-girmez", "J12", "30.10 Tüm Hareketler: F2'nin 15.11 tarihli hareketi ekstreye girmez (05.10–30.10, 300,00 TL); yalnız ileri tarihli hareketi olan G2 hareketsiz gibi (30.10–30.10, 0,00 TL)",
  "J12 + J11 (Y9d-3; Y9c-6 çözüldü)",
  [cari("F2", "Ferhat İleri", "0550 111 22 33", [("2026-10-05", 300, 0), ("2026-11-15", 500, 0)]), cari("G2", "Gül İleri", "0550 222 33 44", [("2026-11-20", 90, 0)])],
  [baslat("+0s", "T1", ["F2", "G2"], donem="tum")],
  {"isler.T1/F2.degiskenler": ["Ferhat İleri", FIRMA, "05.10.2026 – 30.10.2026", "300,00 TL"],
   "isler.T1/F2.pdf": {"cari_ad": "Ferhat İleri", "donem_bas": "2026-10-05", "donem_son": "2026-10-30", "devir": "0.00", "hareket_sayisi": 1, "donem_sonu_bakiye": "300.00"},
   "isler.T1/G2.degiskenler": ["Gül İleri", FIRMA, "30.10.2026 – 30.10.2026", "0,00 TL"],
   "isler.T1/G2.pdf": {"cari_ad": "Gül İleri", "donem_bas": "2026-10-30", "donem_son": "2026-10-30", "devir": "0.00", "hareket_sayisi": 0, "donem_sonu_bakiye": "0.00"}},
  meta_davranis={"kanca": {"*": K_STD}})

S("J12-03-tum-hareketler-sinirla-ertesi-gun-kuyrukta-hareket", "J12", "05.11 23:30 Tüm sınır 1: R ertesi gün gider; 06.11'de R'ye hareket girdi — ekstre açılıştaki gibi (15.10–05.11, 70,00 TL, 1 hareket)",
  "J12 (Y9d-1, Y9d-3) + J11", [P_(), R_()],
  [baslat("+0s", "T1", "PR", donem="tum"), olay("+10h30m", "cari", id="R", hareket_ekle={"tarih": "2026-11-06", "borc": 25, "alacak": 0}), kontrol("+11h", "K1")],
  {"kontroller.K1.isler": {"T1/P": "Teslim Edildi", "T1/R": "Sınır Nedeniyle Bekliyor"}, "isler.T1/R.durum": "Teslim Edildi",
   "isler.T1/R.degiskenler": ["Rana Ortada", FIRMA, "15.10.2026 – 05.11.2026", "70,00 TL"],
   "isler.T1/R.pdf": {"cari_ad": "Rana Ortada", "donem_bas": "2026-10-15", "donem_son": "2026-11-05", "devir": "0.00", "hareket_sayisi": 1, "donem_sonu_bakiye": "70.00"}},
  baslangic="2026-11-05T23:30:00+03:00", ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})


# ======================================================================== kâhin güncellemesi 10 — 2.4.9 W: teslim süresi 30 gün (KULLANICI KARARI 03.11.2026)
# W1: Meta'nın şablon listesinde bildirdiği teslim süresi, yoksa 30 gün; Süresi Doldu son kabulden süre + 1 sa (yalnız kanca yolu çalışıyorsa); 2.4.8'in 72 sa ayarı okunmaz;
# 30 gün dolmadan Meta Kabul Etti / Gönderildi "Daha Önce Gönderildi" + R3 Yine de Gönder açık (İLKEYLE 2, 4); Meta medyayı 30 günde kendisi siler (Y10-7). README §15.
S("W1-01-varsayilan-30-gun-eski-72-sa-okunmaz", "W1",
  "Meta listede süre bildirmez, 2.4.8'den 72 sa ayarı kalmış (okunmaz): A'ya yalnız 'sent' gelir; 4. günde hâlâ Gönderildi, 5. gün aynı dönem 'Daha Önce Gönderildi'; "
  "28. gün C'nin gönderimi kanca yolunu canlı tutar; 30 gün + 30 dk'da hâlâ Gönderildi (1 sa payı), 30 gün + 2 sa'te Süresi Doldu — PDF'i Meta 30 günde kendisi silmiştir (Meta'da silme 0); "
  "Süresi Doldu'dan sonra aynı dönem yeniden gider (P3)",
  "W1 (Y10-1/2/4/6/7) + §7a 16 + K3/P3", [A(), B(), C()],
  [baslat("+0s", "T1", "AB"), kontrol("+4d", "K1"), baslat("+5d", "T2", "A"), baslat("+28d", "T3", "C"),
   kontrol("+30d30m", "K2"), kontrol("+30d2h", "K3"), baslat("+30d3h", "T4", "A")],
  {"kontroller.K1.isler": {"T1/A": "Gönderildi", "T1/B": "Teslim Edildi"},
   "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "olusmadi": ["T2"], "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}},
   "kontroller.K2.isler": {"T1/A": "Gönderildi", "T1/B": "Teslim Edildi", "T3/C": "Teslim Edildi"},
   "kontroller.K3.isler": {"T1/A": "Süresi Doldu", "T1/B": "Teslim Edildi", "T3/C": "Teslim Edildi"}, "kontroller.K3.medya_silme": 2,
   "isler.T1/A.medya_silme": 0, "isler.T1/A.medya_yukleme": 1, "isler.T4/A.durum": "Teslim Edildi",
   "meta.post": {"A": 2, "B": 1, "C": 1}, "meta.medya_silme": {"A": 1, "B": 1, "C": 1},
   "bu_ay": {"W1": {"2026-10": ay_kova(1), "2026-11": ay_kova(2)}}},
  bitis="+31d", ayar={"eski_ttl_saat": 72}, meta_davranis={"kanca": {"T1/A": YANLIZ_KS, "A": K_STD, "B": K_STD, "C": K_STD}})

S("W1-02-30-gun-dolmadan-daha-once-yine-de-gonder", "W1",
  "Meta bildirmez (30 gün): A Gönderildi (teslim yok); 29. gün aynı dönem 'Daha Önce Gönderildi' (almış olabilir — İLKEYLE 2), T2 oluşmaz; uyarıda 'Yine de Gönder' ile "
  "A'ya ikinci ileti gider (çıkmaz yok — İLKEYLE 4)",
  "W1 (Y10-1/6) + R3 + ilke (2), (4)", [A(), B()],
  [baslat("+0s", "T1", "AB"), baslat("+29d", "T2", "A"), baslat("+29d1m", "T3", "A", onceki="gonder"), kontrol("+29d2h", "K1")],
  {"elenen": {"T2": {"A": "daha_once_gonderildi"}}, "olusmadi": ["T2"],
   "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}, "T3": {"sayi": 1, "son": "2026-10-30"}},
   "kontroller.K1.isler": {"T1/A": "Gönderildi", "T1/B": "Teslim Edildi", "T3/A": "Teslim Edildi"},
   "meta.post": {"A": 2, "B": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(1), "2026-11": ay_kova(1)}}},
  bitis="+29d3h", meta_davranis={"kanca": {"T1/A": YANLIZ_KS, "A": K_STD, "B": K_STD}})

S("W1-03-meta-bildirir-12-sa-sablon-basina", "W1",
  "Meta listede ekstre için 12 sa bildirir, Ödeme Hatırlatma için bildirmez: A'nın ekstresi 12 + 1 sa'ten sonra Süresi Doldu (PDF silinir), D'nin hatırlatması 4. günde hâlâ "
  "Gönderildi (30 gün); Süresi Doldu'dan sonra A'ya aynı dönem ekstre yeniden gider",
  "W1 (Y10-1/8) + §7a 16 + K3/P3", [A(), B(), D(vadeler=[{"vade": "2026-10-10", "kalan": 750}])],
  [baslat("+0s", "T1", "AB"), baslat("+1m", "T2", "D", sablon="hatirlatma"), kontrol("+11h30m", "K1"), kontrol("+13h30m", "K2"),
   baslat("+14h", "T3", "A"), kontrol("+4d", "K3")],
  {"kontroller.K1.isler": {"T1/A": "Gönderildi", "T1/B": "Teslim Edildi", "T2/D": "Gönderildi"},
   "kontroller.K2.isler": {"T1/A": "Süresi Doldu", "T1/B": "Teslim Edildi", "T2/D": "Gönderildi"},
   "kontroller.K3.isler": {"T1/A": "Süresi Doldu", "T1/B": "Teslim Edildi", "T2/D": "Gönderildi", "T3/A": "Teslim Edildi"},
   "elenen": {}, "isler.T1/A.medya_silme": 1, "isler.T2/D.durum": "Gönderildi", "meta.post": {"A": 2, "B": 1, "D": 1}},
  meta=META_12SA, meta_davranis={"kanca": {"T1/A": YANLIZ_KS, "T2/D": YANLIZ_KS, "A": K_STD, "B": K_STD}})

S("W1-04-ay-sonu-12-sa-gec-teslim", "W1",
  "31.10 20:00 gönderim, Meta 12 sa bildirir: 01.11 07:30'da Gönderildi, 09:30'da Süresi Doldu; 02.11'de geç teslim → Teslim Edildi ('Bu Ay' Kasım); 03.11 aynı dönem "
  "'Daha Önce Gönderildi' (son 31.10)",
  "W1 (Y10-1) + §7a 17/19 + J1 + H4", [A(), B()],
  [baslat("+0s", "T1", "AB"), kontrol("+11h30m", "K1"), kontrol("+13h30m", "K2"), baslat("+3d", "T2", "A")],
  {"kontroller.K1.isler": {"T1/A": "Gönderildi", "T1/B": "Teslim Edildi"}, "kontroller.K2.isler": {"T1/A": "Süresi Doldu", "T1/B": "Teslim Edildi"},
   "isler.T1/A.durum": "Teslim Edildi", "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "olusmadi": ["T2"],
   "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-31"}}, "meta.post": {"A": 1, "B": 1}, "meta.medya_silme": {"A": 1, "B": 1},
   "bu_ay": {"W1": {"2026-10": ay_kova(1), "2026-11": ay_kova(1)}}},
  baslangic="2026-10-31T20:00:00+03:00", meta=META_12SA, meta_davranis={"kanca": {"A": [["sent", "+1s"], ["delivered", "+2d"]], "B": K_STD}})

S("W1-05-varsayilan-30-gun-meta-bekletti-son-kabulden", "W1",
  "Meta bildirmez (30 gün); A Meta Bekletti, 24 sa sonra 2. deneme kabul (yalnız 'sent'): 30 gün + 12 sa'te hâlâ Gönderildi (süre 2. kabulden), 31 gün + 2 sa'te Süresi Doldu; "
  "aynı medya 2. denemede kullanılır, 30 günü dolduğu için Meta'da silme 0",
  "W1 (Y10-1/3/7) + J4 + §7a 14/15", [A(), B(), C()],
  [baslat("+0s", "T1", "AB"), baslat("+29d", "T2", "C"), kontrol("+30d12h", "K1"), kontrol("+31d2h", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Gönderildi", "T1/B": "Teslim Edildi", "T2/C": "Teslim Edildi"},
   "kontroller.K2.isler": {"T1/A": "Süresi Doldu", "T1/B": "Teslim Edildi", "T2/C": "Teslim Edildi"},
   "isler.T1/A.medya_yukleme": 1, "isler.T1/A.medya_silme": 0, "meta.post": {"A": 2, "B": 1, "C": 1}},
  bitis="+31d3h", meta_davranis={"kanca": {"A": {"1": K49, "2": YANLIZ_KS}, "B": K_STD, "C": K_STD}})


# ---- W2 (W-KÖK, KULLANICI 03.11.2026 ~20:05 UTC): iş KABUL ANINDAKİ teslim süresiyle değerlendirilir; o an bilinmiyorsa 30 gün (İLKEYLE 2). Program henüz uygulamıyor
# (ana oturum) → sürücü koşusunda bu iki senaryonun ayrışması BEKLENİR. Uzama (12 sa → 30 gün): S10-6 KULLANICI KARARI W3 (aşağıda W3-01, README §15.7).
S("W2-01-kabulde-bilinmiyor-sonra-12-sa", "W2",
  "Kabul anında Meta listede süre bildirmez (30 gün); 14 sa sonra liste 12 sa bildirir: A Süresi Doldu OLMAZ (Gönderildi kalır), 16. saatte aynı dönem 'Daha Önce Gönderildi' "
  "(ikinci ileti gitmez), uyarıda 'Yine de Gönder' ile gider; liste değiştikten sonra kabul edilen C yeni süreyle (12 sa) Süresi Doldu",
  "W2 (Y10-10/11/12) + W1 + R3 + ilke (2), (4) + W3", [A(), B(), C()],
  [baslat("+0s", "T1", "AB"), olay("+14h", "meta_sablon", ad="destekofis_ekstre", teslim_suresi_sn=43200), kontrol("+15h", "K1"),
   baslat("+16h", "T2", "A"), baslat("+16h1m", "T3", "A", onceki="gonder"), baslat("+16h2m", "T4", "C"), kontrol("+30h", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Gönderildi", "T1/B": "Teslim Edildi"},
   "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "olusmadi": ["T2"],
   "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}, "T3": {"sayi": 1, "son": "2026-10-30"}},
   "kontroller.K2.isler": {"T1/A": "Gönderildi", "T1/B": "Teslim Edildi", "T3/A": "Teslim Edildi", "T4/C": "Süresi Doldu"},
   "isler.T1/A.durum": "Gönderildi", "isler.T1/A.medya_silme": 0, "isler.T4/C.medya_silme": 1, "meta.post": {"A": 2, "B": 1, "C": 1}},
  meta_davranis={"kanca": {"T1/A": YANLIZ_KS, "T4/C": YANLIZ_KS, "A": K_STD, "B": K_STD}})

S("W2-02-kabulde-30-gun-sonra-12-sa-kisalir", "W2",
  "Kabul anında Meta listede 30 gün bildirir; 20 sa sonra 12 sa'e kısalır: önceden kabul edilmiş A eski süreyle (30 gün) — 21. saatte Gönderildi, 22. saatte aynı dönem "
  "'Daha Önce Gönderildi'; kısalmadan sonra kabul edilen C 12 + 1 sa'ten sonra Süresi Doldu",
  "W2 (Y10-10/12) + W1 + R3 + W3", [A(), B(), C()],
  [baslat("+0s", "T1", "AB"), olay("+20h", "meta_sablon", ad="destekofis_ekstre", teslim_suresi_sn=43200), kontrol("+21h", "K1"),
   baslat("+22h", "T2", "A"), baslat("+22h1m", "T3", "C"), kontrol("+36h", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Gönderildi", "T1/B": "Teslim Edildi"},
   "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "olusmadi": ["T2"], "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}},
   "kontroller.K2.isler": {"T1/A": "Gönderildi", "T1/B": "Teslim Edildi", "T3/C": "Süresi Doldu"},
   "isler.T1/A.durum": "Gönderildi", "meta.post": {"A": 1, "B": 1, "C": 1}},
  meta={"sablonlar": {"destekofis_ekstre": {"durum": "APPROVED", "kategori": "UTILITY", "teslim_suresi_sn": 2592000}}},
  meta_davranis={"kanca": {"T1/A": YANLIZ_KS, "T3/C": YANLIZ_KS, "A": K_STD, "B": K_STD}})


# ---- W3 (S10-6 KULLANICI KARARI 03.11.2026 ~21:00 UTC): süre kabulden sonra UZARSA önceden kabul edilmiş iş UZUN süreyle; etkin süre = max(kabul anındaki, güncel).
# Program henüz uygulamıyor (ana oturum) — programa karşı koşuda ayrışma BEKLENİR.
S("W3-01-kabulde-12-sa-sonra-30-gun-uzar", "W3",
  "Kabul anında Meta listede 12 sa bildirir; 6. saatte liste 30 gün'e uzar: önceden kabul edilmiş A uzun süreyle — 14. saatte Süresi Doldu YOK (Gönderildi), 15. saatte aynı "
  "dönem 'Daha Önce Gönderildi' (ikinci ileti gitmez), uyarıda 'Yine de Gönder' ile gider",
  "W3 (Y10-14) + W2 + W1 + R3 + ilke (2), (4)", [A(), B()],
  [baslat("+0s", "T1", "AB"), olay("+6h", "meta_sablon", ad="destekofis_ekstre", teslim_suresi_sn=2592000), kontrol("+14h", "K1"),
   baslat("+15h", "T2", "A"), baslat("+15h1m", "T3", "A", onceki="gonder"), kontrol("+2d", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Gönderildi", "T1/B": "Teslim Edildi"},
   "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "olusmadi": ["T2"],
   "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}, "T3": {"sayi": 1, "son": "2026-10-30"}},
   "kontroller.K2.isler": {"T1/A": "Gönderildi", "T1/B": "Teslim Edildi", "T3/A": "Teslim Edildi"},
   "isler.T1/A.durum": "Gönderildi", "isler.T1/A.medya_silme": 0, "meta.post": {"A": 2, "B": 1}},
  meta=META_12SA, meta_davranis={"kanca": {"T1/A": YANLIZ_KS, "A": K_STD, "B": K_STD}})


# ======================================================================== KÂHİN GÜNCELLEMESİ 11 (2.5.0, 05.11.2026): SW1, SW2, SD1837, SD1915, SW4, S7
# Elle beklenen YALNIZ karar metinlerinden (kahin.KARARLAR) ve README §16.2 yorumlarından (kodlamadan önce yazıldı). Yeni olaylar: baglanti_suresi_doldu {sirket} (programın izlediği
# belirteç süresi doldu; Meta da 190 döner), yeniden_baglan {sirket} (yeni geçerli belirteç); başlatmada supheli_elle [cari]; vadeler[].supheli. Meta'nın {"hata": 190 | 0} yanıtından
# sonra belirteç yeniden bağlanana dek geçersiz sayılır (README §16.8 S-37). "secenek" yaprakları: yeniden bağlanmadan Devam Et'in üç okuması (README §16.4).
DSD = ("bağlantı Süresi Doldu iken (yeniden bağlanmadan) Devam Et: karar metni yalnız 'yeniden bağlanınca Devam Et ile' der — reddedilir / bekler / "
       "dener ve Meta reddeder (üçünde de ileti gitmez)")
BNS = "190 / 0 ile duran toplu işin neden adı (hata kodu ya da 'Bağlantı Süresi Doldu') karar metninde yok"
BKS = "190 / 0 alıp bekleyenlere dönen işin hata kodu karar metninde yok ('kalan kişilerle bekler')"
S7S = "S7: şüpheli alacak kaydı açık caride Ödeme Hatırlatma {{5}} güncel bakiye karar metninde yok (yalnız 'şüphelisiz gecikmiş tutar')"
TASINAN_D = "Taşınan Veri — Durduruldu"
YENI_250 = ("SW1", "SW2", "SD1837", "SD1915", "SW4", "S7")          # kahin_test I4: bu başlıklar "eski senaryo" değil


def SA_(**kw):
    return cari("SA", "Seda Şüpheli", "0541 100 20 30", [("2026-09-01", 500, 0)],
                vadeler=[{"vade": "2026-10-05", "kalan": 300, "supheli": True}, {"vade": "2026-10-12", "kalan": 200}], **kw)


# ---- SW1: n3 "İkinci de gitsin" — kuyruktaki ikinci iş birincinin teslimi beklenirken / geldikten sonra da gider (J9 artık KARAR) ----
S("SW1-01-gec-teslim-ikinci-is-beklerken-gelir-iki-ileti", "SW1",
  "T1/A Meta Bekletti → İptal (sayılmaz); T2/A açıldı, ilk isteği geçici hata (130429) aldı ve 30 sn bekliyor; o sırada T1'in geç teslimi geldi → T2/A YİNE gider: 2 ileti",
  "SW1 (Y11-1/2) + J9 + K7 + §7a 15", [A()],
  [baslat("+0s", "T1", "A"), olay("+1m", "iptal", toplu="T1"), baslat("+2m", "T2", "A"), kontrol("+2m25s", "K1"), kontrol("+5m", "K2"), baslat("+10m", "T3", "A")],
  {"kontroller.K1.isler": {"T1/A": {"secenek": ["İptal", "Teslim Edildi"], "susuyor": GEC}, "T2/A": "Bekliyor"},
   "kontroller.K2.isler": {"T1/A": {"secenek": ["İptal", "Teslim Edildi"], "susuyor": GEC}, "T2/A": "Teslim Edildi"},
   "meta.post": {"A": 3}, "meta.kabul": {"A": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}},
   "olusmadi": ["T3"], "elenen": {"T3": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T3": {"sayi": 1, "son": "2026-10-30"}}},
  meta_davranis={"mesaj": {"A": ["kabul", {"hata": 130429}]}, "kanca": {"T1/A": K49 + [["delivered", "+2m15s"]], "*": K_STD}})

S("SW1-02-gec-teslim-yedi-gun-sonra-iki-ileti", "SW1",
  "T1/A Meta Bekletti → İptal; T2/A gider ve teslim edilir; T1'in teslimi 7 gün sonra gelir: 2 ileti ('Bu Ay' Ekim 1 + Kasım 1); sonra aynı dönem 'Daha Önce Gönderildi'",
  "SW1 (Y11-2; P6 §3 madde 4 '7 gün geç') + J1 + J5", [A()],
  [baslat("+0s", "T1", "A"), olay("+1m", "iptal", toplu="T1"), baslat("+2m", "T2", "A"), kontrol("+1h", "K1"), kontrol("+7d1h", "K2"), baslat("+7d2h", "T3", "A")],
  {"kontroller.K1.isler": {"T1/A": "İptal", "T2/A": "Teslim Edildi"},
   "kontroller.K2.isler": {"T1/A": {"secenek": ["İptal", "Teslim Edildi"], "susuyor": GEC}, "T2/A": "Teslim Edildi"},
   "meta.post": {"A": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(1), "2026-11": ay_kova(1)}},
   "olusmadi": ["T3"], "elenen": {"T3": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T3": {"sayi": 1, "son": "2026-10-30"}}},
  meta_davranis={"kanca": {"T1/A": K49 + [["delivered", "+7d"]], "*": K_STD}})

S("SW1-03-birinci-basarisiz-kalir-ikinci-gider-tek-ileti", "SW1",
  "T1/A Başarısız (failed 131026) kalır, geç teslim yok; T2/A gider: tek ileti",
  "SW1 (Y11-2; P6 §3 madde 4 'birinci Başarısız olur') + K3", [A()],
  [baslat("+0s", "T1", "A"), baslat("+1h", "T2", "A")],
  {"isler.T1/A.durum": "Başarısız", "isler.T2/A.durum": "Teslim Edildi", "elenen": {}, "onceki_uyari": {}, "meta.post": {"A": 2}, "meta.kabul": {"A": 2},
   "bu_ay": {"W1": {"2026-10": ay_kova(1)}}},
  meta_davranis={"kanca": {"T1/A": KF, "*": K_STD}})

# ---- SW2: Süresi Doldu ileti 24 saatlik farklı alıcı penceresinde sayılmaz ----
S("SW2-01-suresi-doldu-pencerede-sayilmaz-yeni-is-gider", "SW2",
  "Sınır 1, Meta listede 12 sa: A Gönderildi (teslim yok) → 13. saatte Süresi Doldu, pencere 0; 14. saatte başlatılan B hemen gider (A'nın kabulü sayılmaz)",
  "SW2 (Y11-3) + §6 W2 + W1 (Y10-1) + §7a 16", [A(), B()],
  [baslat("+0s", "T1", "A"), kontrol("+12h30m", "K0"), kontrol("+13h30m", "K1"), baslat("+14h", "T2", "B"), kontrol("+15h", "K2")],
  {"kontroller.K0.isler": {"T1/A": "Gönderildi"}, "kontroller.K0.pencere_farkli_alici": {"W1": 1},
   "kontroller.K1.isler": {"T1/A": "Süresi Doldu"}, "kontroller.K1.pencere_farkli_alici": {"W1": 0},
   "kontroller.K2.isler": {"T1/A": "Süresi Doldu", "T2/B": "Teslim Edildi"}, "kontroller.K2.pencere_farkli_alici": {"W1": 1},
   "meta.post": {"A": 1, "B": 1}, "meta.medya_silme": {"A": 1, "B": 1}},
  ayar={"gunluk_ust_sinir": 1}, meta=META_12SA, meta_davranis={"kanca": {"T1/A": YANLIZ_KS, "*": K_STD}})

S("SW2-02-ayni-aliciya-sayilan-baska-kabul-varsa-sayilir", "SW2",
  "Sınır 2, Meta listede 12 sa: A ve A2 aynı telefon (K2); A Süresi Doldu, A2 teslim edildi → alıcı pencerede yine sayılır; 14. saatte T2'de B gider, C sınırda bekler",
  "SW2 (Y11-3: deneme başına) + §7a 8 (K2) + §7a 4", [A(), cari("A2", "Ayşe İkinci", "0532 111 22 33", [("2026-10-10", 50, 0)]), B(), C()],
  [baslat("+0s", "T1", ["A", "A2"]), kontrol("+13h30m", "K1"), baslat("+14h", "T2", "BC"), kontrol("+15h", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Süresi Doldu", "T1/A2": "Teslim Edildi"}, "kontroller.K1.pencere_farkli_alici": {"W1": 1},
   "kontroller.K2.isler": {"T1/A": "Süresi Doldu", "T1/A2": "Teslim Edildi", "T2/B": "Teslim Edildi", "T2/C": "Sınır Nedeniyle Bekliyor"},
   "kontroller.K2.pencere_farkli_alici": {"W1": 2}, "isler.T2/C.durum": "Teslim Edildi", "meta.post": {"A": 1, "A2": 1, "B": 1, "C": 1}},
  ayar={"gunluk_ust_sinir": 2}, meta=META_12SA, meta_davranis={"kanca": {"T1/A": YANLIZ_KS, "*": K_STD}})

# ---- SD1837: bağlantının süresi dolunca kuyruktaki / süren toplu işler Duraklatıldı; yeniden bağlanınca Devam Et ile yalnız kalanlar ----
S("SD1837-01-sure-dolunca-duraklar-yeniden-baglaninca-devam-yalniz-kalanlar", "SD1837",
  "Sınır 2: A teslim, B Gönderildi, C ve D sınırda, T2/E sınırda; 2. saatte bağlantının süresi doldu → T1, T2 Duraklatıldı; 26. saatte yeniden bağlandı (kendiliğinden sürmez); "
  "27. saatte T1'de Devam Et → yalnız C ve D gider (B'ye ikinci ileti yok); T2 Devam Et'siz bekler",
  "SD1837 (Y11-7/8/9/10)", [A(), B(), C(), D(), E()],
  [baslat("+0s", "T1", "ABCD"), baslat("+1h", "T2", "E"), olay("+2h", "baglanti_suresi_doldu"), kontrol("+3h", "K1"), olay("+26h", "yeniden_baglan"),
   kontrol("+26h30m", "K2"), olay("+27h", "devam", toplu="T1"), kontrol("+28h", "K3")],
  {"kontroller.K1.toplular": {"T1": "duraklatildi", "T2": "duraklatildi"}, "kontroller.K1.toplam_post": 2,
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Gönderildi", "T1/C": "Duraklatıldı", "T1/D": "Duraklatıldı", "T2/E": "Duraklatıldı"},
   "kontroller.K2.toplular": {"T1": "duraklatildi", "T2": "duraklatildi"},
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/B": "Gönderildi", "T1/C": "Duraklatıldı", "T1/D": "Duraklatıldı", "T2/E": "Duraklatıldı"},
   "kontroller.K3.isler": {"T1/A": "Teslim Edildi", "T1/B": "Gönderildi", "T1/C": "Teslim Edildi", "T1/D": "Teslim Edildi", "T2/E": "Duraklatıldı"},
   "kontroller.K3.toplam_post": 4,
   "toplular": {"T1": {"durum": "aktif", "neden": None, "is_sayisi": 4}, "T2": {"durum": "duraklatildi", "neden": "baglanti_suresi_doldu", "is_sayisi": 1}},
   "meta.post": {"A": 1, "B": 1, "C": 1, "D": 1, "E": 0}, "bu_ay": {"W1": {"2026-10": ay_kova(3)}}},
  ayar={"gunluk_ust_sinir": 2}, meta_davranis={"kanca": {"T1/B": YANLIZ_KS, "*": K_STD}})

S("SD1837-02-yeniden-baglanmadan-devam-et-ileti-gitmez", "SD1837",
  "Sınır 1: A teslim, B ve C sınırda; 1. saatte süre doldu; 2. saatte yeniden bağlanmadan Devam Et (üç okuma: reddedilir / bekler / dener — Meta reddeder) → kimseye ileti gitmez; "
  "30. saatte yeniden bağlandı, 31. saatte Devam Et → B ve C birer kez gider",
  "SD1837 (Y11-9/10) + SD1915 + P6 W-1 (a) — README §16.4 seçenek", [A(), B(), C()],
  [baslat("+0s", "T1", "ABC"), olay("+1h", "baglanti_suresi_doldu"), olay("+2h", "devam", toplu="T1"), kontrol("+3h", "K1"), olay("+30h", "yeniden_baglan"),
   kontrol("+30h30m", "K2"), olay("+31h", "devam", toplu="T1"), kontrol("+3d", "K3"), baslat("+3d1h", "T2", "B")],
  {"kontroller.K1.toplam_post": 1, "kontroller.K1.toplular": {"T1": {"secenek": ["duraklatildi", "aktif"], "susuyor": DSD}},
   "kontroller.K1.isler.T1/B": {"secenek": ["Duraklatıldı", "Bekliyor", "Sınır Nedeniyle Bekliyor"], "susuyor": DSD},
   "kontroller.K2.isler.T1/B": {"secenek": ["Duraklatıldı", "Teslim Edildi"], "susuyor": DSD},
   "kontroller.K3.isler": {"T1/A": "Teslim Edildi", "T1/B": "Teslim Edildi", "T1/C": "Teslim Edildi"},
   "meta.post": {"A": 1, "B": 1, "C": 1}, "meta.kabul": {"A": 1, "B": 1, "C": 1}, "meta.toplam_medya_yukleme": {"secenek": [3, 4], "susuyor": DSD},
   "toplular.T1": {"durum": "aktif", "neden": None, "is_sayisi": 3}, "bu_ay": {"W1": {"2026-10": ay_kova(2), "2026-11": ay_kova(1)}},
   "olusmadi": ["T2"], "elenen": {"T2": {"B": "daha_once_gonderildi"}}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("SD1837-03-sure-dolunca-yeni-gonderim-baslamaz", "SD1837",
  "Bağlantının süresi doldu: 1. saatte yeni toplu gönderim BAŞLAMAZ ('baglanti_suresi_doldu'); yeniden bağlandıktan sonra başlar",
  "SD1837 + P6 W-1 (a) 'süre dolunca gönderim başlatılamaz' (Y11-11)", [A()],
  [olay("+0s", "baglanti_suresi_doldu"), baslat("+1h", "T1", "A"), olay("+2h", "yeniden_baglan"), baslat("+3h", "T2", "A")],
  {"baslamadi": {"T1": "baglanti_suresi_doldu"}, "toplular": {"T2": {"durum": "aktif", "neden": None, "is_sayisi": 1}}, "isler.T2/A.durum": "Teslim Edildi",
   "meta.post": {"A": 1}, "meta.toplam_medya_yukleme": 1},
  meta_davranis={"kanca": {"*": K_STD}})

# ---- SD1915: Meta 190 → o anda iletisi gitmeyen kişi bekleyenlere döner (Başarısız değil) ----
S("SD1915-01-ileti-isteginde-190-bekleyenlere-doner", "SD1915",
  "B'nin ileti isteğine Meta 190: B Başarısız DEĞİL, Duraklatıldı (C ile bekler), bağlantı Süresi Doldu; yeniden bağlanınca kendiliğinden sürmez; Devam Et ile B (aynı PDF) ve C gider; "
  "sonra aynı dönem B 'Daha Önce Gönderildi'",
  "SD1915 (Y11-12/13) + SD1837", [A(), B(), C()],
  [baslat("+0s", "T1", "ABC"), kontrol("+30m", "K1"), olay("+1h", "yeniden_baglan"), kontrol("+1h30m", "K2"), olay("+2h", "devam", toplu="T1"), kontrol("+2h1m", "K3"),
   baslat("+3h", "T2", "B")],
  {"kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Duraklatıldı", "T1/C": "Duraklatıldı"}, "kontroller.K1.toplular": {"T1": "duraklatildi"},
   "kontroller.K1.toplam_post": 2, "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/B": "Duraklatıldı", "T1/C": "Duraklatıldı"},
   "kontroller.K3.isler": {"T1/A": "Teslim Edildi", "T1/B": "Teslim Edildi", "T1/C": "Teslim Edildi"},
   "meta.post": {"A": 1, "B": 2, "C": 1}, "meta.medya_yukleme": {"A": 1, "B": 1, "C": 1}, "meta.toplam_medya_yukleme": 3, "isler.T1/B.hata_kodu": None,
   "toplular": {"T1": {"durum": "aktif", "neden": None, "is_sayisi": 3}}, "bu_ay": {"W1": {"2026-10": ay_kova(3)}},
   "olusmadi": ["T2"], "elenen": {"T2": {"B": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}}},
  meta_davranis={"mesaj": {"B": [{"hata": 190}]}, "kanca": {"*": K_STD}})

S("SD1915-02-pdf-yuklemesinde-190-bekleyenlere-doner", "SD1915",
  "B'nin PDF yüklemesine Meta 190: B Duraklatıldı (ileti isteği yok), toplu iş durur; yeniden bağlanıp Devam Et ile B'nin PDF'i yüklenir, B ve C gider",
  "SD1915 (Y11-12/13)", [A(), B(), C()],
  [baslat("+0s", "T1", "ABC"), kontrol("+30m", "K1"), olay("+1h", "yeniden_baglan"), olay("+2h", "devam", toplu="T1"), kontrol("+2h1m", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Duraklatıldı", "T1/C": "Duraklatıldı"}, "kontroller.K1.toplular": {"T1": "duraklatildi"},
   "kontroller.K1.toplam_post": 1, "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/B": "Teslim Edildi", "T1/C": "Teslim Edildi"},
   "meta.post": {"A": 1, "B": 1, "C": 1}, "meta.medya_yukleme": {"A": 1, "B": 1, "C": 1}, "meta.toplam_medya_yukleme": 4, "isler.T1/B.hata_kodu": None,
   "toplular.T1.durum": "aktif"},
  meta_davranis={"medya": ["kabul", {"hata": 190}], "kanca": {"*": K_STD}})

S("SD1915-03-meta-bekletti-ikinci-deneme-190-ilk-ileti-teslim-is-kapanir", "SD1915",
  "A Meta Bekletti; 24 sa sonraki 2. deneme 190 ile reddedildi (gitmedi) → A Duraklatıldı; beklerken 1. ileti teslim edildi → iş kapanır (Teslim Edildi); yeniden bağlanıp Devam Et "
  "2. denemeyi GÖNDERMEZ; yeni gönderimde 'Daha Önce Gönderildi'",
  "SD1915 (Y11-14) + J2 + İLKEYLE G0 (3)", [A()],
  [baslat("+0s", "T1", "A"), kontrol("+24h30m", "K1"), kontrol("+25h30m", "K2"), olay("+26h", "yeniden_baglan"), olay("+27h", "devam", toplu="T1"),
   kontrol("+27h1m", "K3"), baslat("+28h", "T2", "A")],
  {"kontroller.K1.isler": {"T1/A": "Duraklatıldı"}, "kontroller.K1.toplular": {"T1": "duraklatildi"}, "kontroller.K1.toplam_post": 2,
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi"}, "kontroller.K3.isler": {"T1/A": "Teslim Edildi"}, "kontroller.K3.toplam_post": 2,
   "meta.post": {"A": 2}, "meta.kabul": {"A": 1}, "isler.T1/A.hata_kodu": None, "meta.medya_silme": {"A": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(1)}},
   "olusmadi": ["T2"], "elenen": {"T2": {"A": "daha_once_gonderildi"}}},
  meta_davranis={"mesaj": {"A": ["kabul", {"hata": 190}]}, "kanca": {"A": {"1": K49 + [["delivered", "+25h"]]}}})

S("SD1915-04-geri-yukleme-reddedilen-sayilmaz", "SD1915",
  "B 190 ile bekliyor; geri yükleme → B ve C 'Durduruldu (Geri Yükleme)' (dirilmez); yeniden bağlandıktan sonra yeni gönderimde A 'Daha Önce Gönderildi', B ve C elenmez, birer kez gider",
  "SD1915 + G0 (1, 5) (Y11-16) + §7a 26", [A(), B(), C()],
  [baslat("+0s", "T1", "ABC"), olay("+1h", "geri_yukle"), olay("+2h", "yeniden_baglan"), baslat("+3h", "T2", "ABC"), kontrol("+3h1m", "K1")],
  {"isler.T1/B.durum": GERI, "isler.T1/C.durum": GERI, "kontroller.K1.isler.T2/B": "Teslim Edildi", "kontroller.K1.isler.T2/C": "Teslim Edildi",
   "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}}, "toplular.T2.is_sayisi": 2,
   "toplular.T1.neden": {"secenek": [190, "baglanti_suresi_doldu"], "susuyor": BNS}, "isler.T1/B.hata_kodu": {"secenek": [190, None], "susuyor": BKS},
   "meta.post": {"A": 1, "B": 2, "C": 1}, "meta.kabul": {"A": 1, "B": 1, "C": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(3)}}},
  meta_davranis={"mesaj": {"B": [{"hata": 190}]}, "kanca": {"*": K_STD}})

S("SD1915-05-tasima-reddedilen-sayilmaz-kod-0", "SD1915",
  "B kod 0 ile bekliyor (S-W4); veri başka bilgisayara taşındı → B ve C 'Taşınan Veri — Durduruldu'; yeniden bağlandıktan sonra yeni gönderimde A 'Daha Önce Gönderildi' (dosyadaki teslim), "
  "B ve C birer kez gider",
  "SD1915 + SW4 + G0 (1, 5) (Y11-16) + D8", [A(), B(), C()],
  [baslat("+0s", "T1", "ABC"), olay("+1h", "tasindi"), olay("+2h", "yeniden_baglan"), baslat("+3h", "T2", "ABC"), kontrol("+3h1m", "K1")],
  {"isler.T1/B.durum": TASINAN_D, "isler.T1/C.durum": TASINAN_D, "kontroller.K1.isler.T2/B": "Teslim Edildi", "kontroller.K1.isler.T2/C": "Teslim Edildi",
   "elenen": {"T2": {"A": "daha_once_gonderildi"}}, "toplular.T2.is_sayisi": 2,
   "toplular.T1.neden": {"secenek": [0, "baglanti_suresi_doldu"], "susuyor": BNS}, "isler.T1/B.hata_kodu": {"secenek": [0, None], "susuyor": BKS},
   "meta.post": {"A": 1, "B": 2, "C": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(3)}}},
  meta_davranis={"mesaj": {"B": [{"hata": 0}]}, "kanca": {"*": K_STD}})

# ---- SW4: kod 0 da 190 gibi; 102 bugünkü gibi ----
S("SW4-01-kod-0-ayni-sirketin-oburu-toplu-isi-de-duraklar", "SW4",
  "B'nin ileti isteğine Meta 0 (AuthException): B bekleyenlere döner, bağlantı Süresi Doldu → aynı şirketin süren T2'si de Duraklatıldı (D'ye istek yok); yeniden bağlanıp iki işte "
  "Devam Et ile B, C, D gider",
  "SW4 (Y11-15) + SD1915 + SD1837 (Y11-8)", [A(), B(), C(), D()],
  [baslat("+0s", "T1", "ABC"), baslat("+0s", "T2", "D"), kontrol("+30m", "K1"), olay("+1h", "yeniden_baglan"), olay("+2h", "devam", toplu="T1"),
   olay("+2h1m", "devam", toplu="T2"), kontrol("+2h2m", "K2")],
  {"kontroller.K1.toplular": {"T1": "duraklatildi", "T2": "duraklatildi"}, "kontroller.K1.toplam_post": 2,
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Duraklatıldı", "T1/C": "Duraklatıldı", "T2/D": "Duraklatıldı"},
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/B": "Teslim Edildi", "T1/C": "Teslim Edildi", "T2/D": "Teslim Edildi"},
   "meta.post": {"A": 1, "B": 2, "C": 1, "D": 1},
   "toplular": {"T1": {"durum": "aktif", "neden": None, "is_sayisi": 3}, "T2": {"durum": "aktif", "neden": None, "is_sayisi": 1}}},
  meta_davranis={"mesaj": {"B": [{"hata": 0}]}, "kanca": {"*": K_STD}})

S("SW4-02-kod-0-pdf-yuklemesinde", "SW4",
  "C'nin PDF yüklemesine Meta 0: C Duraklatıldı (ileti isteği yok), toplu iş durur; yeniden bağlanıp Devam Et ile C'nin PDF'i yüklenir ve C gider",
  "SW4 (Y11-15) + SD1915 (Y11-13)", [A(), B(), C()],
  [baslat("+0s", "T1", "ABC"), kontrol("+30m", "K1"), olay("+1h", "yeniden_baglan"), olay("+2h", "devam", toplu="T1"), kontrol("+2h1m", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Teslim Edildi", "T1/C": "Duraklatıldı"}, "kontroller.K1.toplular": {"T1": "duraklatildi"},
   "kontroller.K1.toplam_post": 2, "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/B": "Teslim Edildi", "T1/C": "Teslim Edildi"},
   "meta.post": {"A": 1, "B": 1, "C": 1}, "meta.medya_yukleme": {"A": 1, "B": 1, "C": 1}, "meta.toplam_medya_yukleme": 4, "isler.T1/C.hata_kodu": None},
  meta_davranis={"medya": ["kabul", "kabul", {"hata": 0}], "kanca": {"*": K_STD}})

S("SW4-03-kod-102-bugunku-gibi", "SW4",
  "B'nin ileti isteğine Meta 102 (kararın DIŞINDA): o iş Başarısız (kodlu), toplu iş sürer (C gider), bağlantı Süresi Doldu OLMAZ — sonraki gönderim başlar",
  "SW4 ('Kod 102 bu kararın DIŞINDA') + §7a 12", [A(), B(), C(), D()],
  [baslat("+0s", "T1", "ABC"), kontrol("+30m", "K1"), baslat("+1h", "T2", "D"), kontrol("+1h1m", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Başarısız", "T1/C": "Teslim Edildi"}, "kontroller.K1.toplular": {"T1": "aktif"},
   "kontroller.K2.isler.T2/D": "Teslim Edildi", "isler.T1/B.hata_kodu": 102, "baslamadi": {}, "toplular.T2": {"durum": "aktif", "neden": None, "is_sayisi": 1},
   "meta.post": {"A": 1, "B": 1, "C": 1, "D": 1}, "meta.medya_silme.B": 1},
  meta_davranis={"mesaj": {"B": [{"hata": 102}]}, "kanca": {"*": K_STD}})

# ---- S7: şüpheli alacak kaydı açık müşteri otomatik Ödeme Hatırlatma listesine girmez; elle seçilirse şüphesiz gecikmiş tutarla gider ----
S("S7-01-supheli-alacakli-otomatik-listeye-girmez", "S7",
  "Ödeme Hatırlatma: SA (şüpheli + şüphesiz gecikmiş) ve VI (yalnız şüpheli) 'Şüpheli Alacağı Var' ile elenir; şüpheli kaydı kapanmış (kalan 0) KK ve A gider",
  "S7 (Y11-17/18) + §7a 20", [A(vadeler=[{"vade": "2026-10-10", "kalan": 500}]), SA_(),
                             cari("VI", "Veli İcra", "0541 200 30 40", [("2026-09-15", 400, 0)], vadeler=[{"vade": "2026-10-01", "kalan": 400, "supheli": True}]),
                             cari("KK", "Kader Kapandı", "0541 300 40 50", [("2026-09-20", 100, 0)],
                                  vadeler=[{"vade": "2026-10-03", "kalan": 0, "supheli": True}, {"vade": "2026-10-15", "kalan": 100}])],
  [baslat("+0s", "T1", ["A", "SA", "VI", "KK"], sablon="hatirlatma")],
  {"elenen": {"T1": {"SA": "supheli_alacak", "VI": "supheli_alacak"}}, "toplular.T1.is_sayisi": 2,
   "isler.T1/A.degiskenler": ["Ayşe Yılmaz", FIRMA, "10.10.2026", "500,00 TL", "1.250,00 TL"],
   "isler.T1/KK.degiskenler": ["Kader Kapandı", FIRMA, "15.10.2026", "100,00 TL", "100,00 TL"], "meta.post": {"A": 1, "KK": 1}},
  meta_davranis={"kanca": {"*": K_STD}})

S("S7-02-supheli-alacakli-elle-secilir-suphelisiz-tutar", "S7",
  "Ödeme Hatırlatma'da SA elle seçildi: gider, {{3}} şüphesiz en eski gecikmiş vade (12.10.2026), {{4}} şüphesiz gecikmiş tutar (200,00 TL), {{5}} karar susuyor; aynı cariye "
  "Ekstre etkilenmez (S7 yalnız Ödeme Hatırlatma)",
  "S7 (Y11-17/19) + §7a 20", [A(vadeler=[{"vade": "2026-10-10", "kalan": 500}]), SA_()],
  [baslat("+0s", "T1", ["A", "SA"], sablon="hatirlatma", supheli_elle=["SA"]), baslat("+1h", "T2", ["SA"])],
  {"elenen": {}, "isler.T1/SA.degiskenler": ["Seda Şüpheli", FIRMA, "12.10.2026", "200,00 TL", {"plan_susuyor": S7S}],
   "isler.T1/A.degiskenler": ["Ayşe Yılmaz", FIRMA, "10.10.2026", "500,00 TL", "1.250,00 TL"],
   "isler.T2/SA.degiskenler": ["Seda Şüpheli", FIRMA, DON, "500,00 TL"], "isler.T2/SA.durum": "Teslim Edildi", "meta.post": {"A": 1, "SA": 2}},
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
                       "netlestirme": "plan §7a 1–32 (30.10.2026; K1–K3 ürün sahibi, öbürleri baş mimar + ürün sahibi 'önerilerin uygun') — serbest seçim yok; "
                                      "kâhin güncellemesi 2: ürün sahibi kararları K1–K8 (31.10.2026, 'kararlar' alanı, metinler AYNEN)",
                       "serbest_secimler": {k: list(v) for k, v in kahin.SERBEST.items()}, "sablonlar": kahin.SABLONLAR, "kararlar": kahin.KARARLAR,
                       "senaryolar": cikti}, f, ensure_ascii=False, indent=1)
            f.write("\n")
        print("senaryolar.json yazıldı")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
