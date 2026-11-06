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
  bekleyenlere döner (SD1915, 5), S-W4 kod 0 = 190 (SW4, 3), S7 şüpheli alacaklı müşteri otomatik listeye girmez (S7, 2); HESAP-0 ve J9-01/02 değişti (README §16);
kâhin güncellemesi 12 (2.5.0, KULLANICI KARARI 06.11.2026 03:35 UTC "hepsi A"): S7-a elle seçilen şüpheli alacaklıda şüphesiz gecikmiş yoksa "Gecikmiş Borç Yok" (S7A, 3),
  S7-b kuyruktayken şüpheli kaydı açılan elle seçilmemiş cari gönderim anında "Atlandı — Şüpheli Alacağı Var" (S7B, 5) — README §17;
kâhin güncellemesi 13 (2.5.0, KULLANICI KARARI 06.11.2026 04:50 UTC "hepsine A" + 05.11 21:30 karar (5)): S16 Sonucu Belirsiz işte şüpheli kaydı açıkken Yine de Gönder elle seçim (S16, 4),
  S17 elle şüpheli caride şüphesiz net borç sınırı (S17, 2), karar (5) net borç sınırı + bize alacaklı elenir (NB5, 2) — README §18;
kâhin güncellemesi 14 (2.5.0, KULLANICI KARARI 06.11.2026 05:30 UTC "a"): S22 (eski S7-d) — Yine de Gönder basıldığında şüpheli kaydı yoktu, gönderim beklerken açıldı → gönderim anında
  "Atlandı — Şüpheli Alacağı Var"; yol: kayıt açıkken yeniden Yine de Gönder → S16 (S22, 6) — README §19;
kâhin güncellemesi 15 (2.5.0, KULLANICI KARARI 06.11.2026 06:03 UTC "a" + 05.11.2026 ~16:48 S-W3): S23 (eski S7-e) — gönderim beklerken kayıt açılan işte asıl işte yeniden Yine de Gönder →
  bekleyen iş elle sayılır, yeni iş açılmaz, gönderim anında şüphesiz tutarla gider (S23, 5); S-W3 — içerik / telefon / PDF 1 yıl sonra ya da silme talebinde silinir, anonim iz kalır
  (SW3, 5) — README §20;
kâhin güncellemesi 16 (2.5.0, KULLANICI KARARI 06.11.2026 06:52 UTC "a" — S29–S32 hepsi A): S29 (eski S23-a) yeniden basmada şüphesiz tutar yoksa da iş elle sayılır, gönderim anındaki
  tutarla gider (S29, 4); S30 (S-W3-a) silme talebi / 1 yıl dolumu anında bekleyen iş gönderilmez, belirsiz iz eler (S30, 3); S31 (S-W3-b) içeriği silinmiş Ekstre işi yeniden gönderilemez
  (S31, 2); S32 (S-W3-c) talep kaydı makinede, geri yüklemede yeniden uygulanır (S32, 2); S23-05 ve SW3-05'in beklentisi kesinleşti — README §21;
kâhin güncellemesi 17 (2.5.0, KULLANICI KARARLARI 06.11.2026 08:06 S34–S38, 07:00 S33, 08:08 S41): S34 2, S35 2, S36 2, S37 2, S38 2, S33 2, S41 2 — README §22;
kâhin güncellemesi 18 (2.5.0, KULLANICI KARARI 06.11.2026 08:54 UTC "a" — S42, S43; BAŞ MİMAR KARARI 08:52 Y17-6): S42 Gönderiliyor işte silme talebi — içerik / telefon hemen silinir, yanıt ize
  yazılır, yeniden gönderim gerektiren yanıtta o anda "Atlandı — Silme Talebi" (S42, 4: kabul, yanıt yok, yeniden gönderim / kesin olumsuz, yerel gün dönümü); S43 wamid'i tanınmayan bildirim
  işareti koymaz (S43, 3: Yol 2 imzalı, Yol 1 imzasız, iş kimliğiyle tanınan sınır) — README §23. Yeni girdi: gecikmeli Meta yanıtı {"gec": süre, "yanit": …}.
kâhin güncellemesi 20 (2.5.0, KULLANICI KARARI 06.11.2026 13:09 UTC "önerilerini uygula" — S70, S71 = A; BAŞ MİMAR KARARI 12:33 DÜŞÜK-2 R3T): S70 her Atlandı sırasında geç teslim → Teslim
  Edildi (S70, 6: Meta Bekletti × İstemiyor / Pasif / Silinmiş / Şüpheli / Gecikmiş Borç Yok / Telefonsuz, zincir × silme / İstemiyor, S42, J10, ay dönümü); S71 içeriği + kart telefonu silinmiş
  Ödeme Hatırlatma'da işteki Yine de Gönder "Telefon Yok" (S71, 2); R3T R3 uyarı sayısı telefonsuz ama daha önce almış kişiyi de sayar (R3T, 1; SW3-03 ve S61-02 değişti) — README §25.

Her senaryo: GİRDİ (cariler, seçim, saat, sahte Meta davranışı, olaylar) + ELLE yazılmış beklenen (yalnız plandan, kâhinin modelinden
bağımsız hesaplanmış anahtar sayılar). `python3 -I senaryolar.py` modeli koşar; elle beklenen ile model AYNI değilse dosya YAZILMAZ,
çıkış 1 (iki ayrı türetme birbirini denetler). Aynıysa `senaryolar.json` (girdi + elle + modelin bütün beklenen sonucu) yazılır.

Başlıklar plan §8 "Nasıl bozulur?" listesinden: ÇİFT, KAYIP, YANLIŞ KİŞİ, YANLIŞ İÇERİK, HESAP / META, GÜVENLİK, TARİH, ÖLÇEK, (+ TEMEL, ŞİRKET).
Kaynak sütununda "§7a n" = plan netleştirmesi n, "R1–R3" = §7a revizyonu (30.10.2026). Serbest seçim YOK.
Zaman ifadeleri: "+5s", "+2h", "+3d", "cokme+10m" (çökmeye göre). Sahte Meta davranışı (meta_davranis):
  mesaj: {cari | "*": [yanıt1, yanıt2, …] | yanıt}  — o alıcının n. POST'u (sahte sunucu kuralı: yol messages + to + deneme n)
         yanıt ∈ "kabul" | "yanitsiz_kabul" (Meta aldı, yanıt kayboldu: koptu "sonra" / gecikme / işlenmiş gövdesiz 5xx)
                 | "yanitsiz_red" (Meta almadı, yanıt yok: koptu "once" / işlenmemiş gövdesiz 5xx) | {"hata": kod} | {"sinir": true}
                 | {"gec_kabul": süre} (J6) | {"gec": süre, "yanit": yukarıdakilerden biri} (güncelleme 18: yanıt programa GECİKMELİ gelir, o süre "Gönderiliyor")
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
YENI_250 = ("SW1", "SW2", "SD1837", "SD1915", "SW4", "S7", "S7A", "S7B", "S16", "S17", "NB5", "S22", "S23", "SW3", "S29", "S30", "S31", "S32",
            "S34", "S35", "S36", "S37", "S38", "S33", "S41", "S42", "S43",
            "S58", "S59", "S60", "S61", "S62", "S63",
            "S70", "S71", "R3T")   # kahin_test I4: bu başlıklar "eski senaryo" değil (S7A, S7B: güncelleme 12; S16, S17, NB5: 13; S22: 14; S23, SW3: 15; S29–S32: 16; S33–S38, S41: 17; S42, S43: 18; S58–S63: 19; S70, S71, R3T: 20)


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


# ======================================================================== kâhin güncellemesi 12 (2.5.0, KULLANICI KARARI 06.11.2026 03:35 UTC "hepsi A": S7A, S7B — README §17)
def _v(vade, kalan, supheli=False):
    return {"vade": vade, "kalan": kalan, **({"supheli": True} if supheli else {})}


A_HAT = ["Ayşe Yılmaz", FIRMA, "10.10.2026", "500,00 TL", "1.250,00 TL"]          # A(vadeler=[10.10 500]) Ödeme Hatırlatma değişkenleri (S7-01 / S7-02 ile aynı)
SUS7 = {"plan_susuyor": S7S}


def A7():
    return A(vadeler=[_v("2026-10-10", 500)])


# ---- S7A: elle seçilen şüpheli alacaklı caride şüphesiz gecikmiş borç yoksa "Gecikmiş Borç Yok" ile elenir (ileti gitmez) ----
S("S7A-01-elle-supheli-suphesiz-gecikmis-yok-elenir", "S7A",
  "Ödeme Hatırlatma, dört şüpheli alacaklı cari ELLE seçildi: SA2 (şüphesiz kalemin vadesi gelmedi), SC (şüphesiz kalemin vadesi BUGÜN — gecikmiş değil), SD (şüphesiz kalem kapanmış) "
  "'Gecikmiş Borç Yok' ile elenir; SB (şüphesiz 150 TL gecikmiş) gider; yalnız SA2 seçilen T2'nin kaydı oluşmaz",
  "S7A (Y12-1) + S7 + §7a 20, 31",
  [A7(),
   cari("SA2", "Sinan Vadesiz", "0542 100 20 31", [("2026-09-01", 800, 0)], vadeler=[_v("2026-10-05", 500, True), _v("2026-11-20", 300)]),
   cari("SB", "Burcu Kısmi", "0542 200 30 41", [("2026-09-01", 550, 0)], vadeler=[_v("2026-10-01", 400, True), _v("2026-10-12", 150)]),
   cari("SC", "Cem Bugün", "0542 300 40 51", [("2026-09-01", 300, 0)], vadeler=[_v("2026-10-04", 200, True), _v("2026-10-30", 100)]),
   cari("SD", "Deniz Ödedi", "0542 400 50 61", [("2026-09-01", 250, 0)], vadeler=[_v("2026-10-06", 250, True), _v("2026-10-08", 0)])],
  [baslat("+0s", "T1", ["A", "SA2", "SB", "SC", "SD"], sablon="hatirlatma", supheli_elle=["SA2", "SB", "SC", "SD"]),
   baslat("+1h", "T2", ["SA2"], sablon="hatirlatma", supheli_elle=["SA2"])],
  {"elenen": {"T1": {"SA2": "gecikmis_borc_yok", "SC": "gecikmis_borc_yok", "SD": "gecikmis_borc_yok"}, "T2": {"SA2": "gecikmis_borc_yok"}},
   "olusmadi": ["T2"], "toplular.T1.is_sayisi": 2,
   "isler.T1/SB.degiskenler": ["Burcu Kısmi", FIRMA, "12.10.2026", "150,00 TL", SUS7], "isler.T1/SB.durum": "Teslim Edildi",
   "isler.T1/A.degiskenler": A_HAT, "meta.post": {"A": 1, "SB": 1}},
  meta_davranis={"kanca": {"*": K_STD}})

S("S7A-02-elle-supheli-kuyrukta-suphesiz-kapanir-gonderimde-atlanir", "S7A",
  "Günlük sınır 1: elle seçilen SE / SF / SH sınırda bekler; 2. saatte SE'nin şüphesiz kalemi ödenir, SF'ninki şüpheli kaydına alınır, SH'ninki kısmen ödenir → pencere açılınca "
  "SE ve SF gönderim anında 'Atlandı — Gecikmiş Borç Yok' (POST 0), SH gönderim anındaki şüphesiz tutarla (180,00 TL) gider",
  "S7A (Y12-2) + §7a 2, 20 + Y9d-2", [A7(),
   cari("SE", "Selin Ödedi", "0542 500 60 71", [("2026-09-01", 500, 0)], vadeler=[_v("2026-10-05", 300, True), _v("2026-10-12", 200)]),
   cari("SF", "Ferhat Devredildi", "0542 600 70 81", [("2026-09-01", 370, 0)], vadeler=[_v("2026-10-03", 250, True), _v("2026-10-14", 120)]),
   cari("SH", "Hülya Kısmi", "0542 700 80 91", [("2026-09-01", 400, 0)], vadeler=[_v("2026-10-02", 100, True), _v("2026-10-11", 300)])],
  [baslat("+0s", "T1", ["A", "SE", "SF", "SH"], sablon="hatirlatma", supheli_elle=["SE", "SF", "SH"]),
   olay("+2h", "cari", id="SE", vadeler=[_v("2026-10-05", 300, True), _v("2026-10-12", 0)], hareket_ekle={"tarih": "2026-10-30", "borc": 0, "alacak": 200}),
   olay("+2h", "cari", id="SF", vadeler=[_v("2026-10-03", 250, True), _v("2026-10-14", 120, True)]),
   olay("+2h", "cari", id="SH", vadeler=[_v("2026-10-02", 100, True), _v("2026-10-11", 180)], hareket_ekle={"tarih": "2026-10-30", "borc": 0, "alacak": 120}),
   kontrol("+3h", "K1")],
  {"elenen": {},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/SE": "Sınır Nedeniyle Bekliyor", "T1/SF": "Sınır Nedeniyle Bekliyor", "T1/SH": "Sınır Nedeniyle Bekliyor"},
   "isler.T1/SE.durum": "Atlandı", "isler.T1/SE.atlanma_nedeni": "gecikmis_borc_yok",
   "isler.T1/SF.durum": "Atlandı", "isler.T1/SF.atlanma_nedeni": "gecikmis_borc_yok",
   "isler.T1/SH.durum": "Teslim Edildi", "isler.T1/SH.degiskenler": ["Hülya Kısmi", FIRMA, "11.10.2026", "180,00 TL", SUS7],
   "meta.post": {"A": 1, "SE": 0, "SF": 0, "SH": 1}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("S7A-03-gece-yarisi-suphesiz-vade-yerel-gun", "S7A",
  "30.10 23:50 (yerel): elle seçilen SG'nin tek şüphesiz kalemi 30.10 vadeli — bugün gecikmiş DEĞİL → 'Gecikmiş Borç Yok'; 20 dk sonra 31.10 00:10 yerel (UTC'de hâlâ 30.10) "
  "yeniden elle seçilince gecikmiş → gider (30.10.2026, 150,00 TL)",
  "S7A (Y12-1) + §7a 20 (kâhin yorumu 5: vade < bugün, yerel gün)",
  [A7(), cari("SG", "Gizem Gece", "0542 800 90 01", [("2026-09-01", 550, 0)], vadeler=[_v("2026-10-01", 400, True), _v("2026-10-30", 150)])],
  [baslat("+0s", "T1", ["A", "SG"], sablon="hatirlatma", supheli_elle=["SG"]), baslat("+20m", "T2", ["SG"], sablon="hatirlatma", supheli_elle=["SG"])],
  {"elenen": {"T1": {"SG": "gecikmis_borc_yok"}}, "olusmadi": [], "toplular.T1.is_sayisi": 1, "isler.T1/A.degiskenler": A_HAT,
   "isler.T2/SG.degiskenler": ["Gizem Gece", FIRMA, "30.10.2026", "150,00 TL", SUS7], "isler.T2/SG.durum": "Teslim Edildi", "meta.post": {"A": 1, "SG": 1}},
  baslangic="2026-10-30T23:50:00+03:00", meta_davranis={"kanca": {"*": K_STD}})

# ---- S7B: toplu gönderim kuyruktayken şüpheli alacak kaydı açılan, elle seçilmemiş müşteri gönderim anında atlanır ("Şüpheli Alacağı Var") ----
S("S7B-01-sinirda-supheli-acilan-atlanir-yeni-gonderimde-elle-gider", "S7B",
  "Günlük sınır 1: B7, D7, C7 sınırda bekler; 1. saatte B7'nin tek gecikmiş kalemi ve D7'nin bir kalemi şüpheli kaydına alınır → pencere açılınca B7 ve D7 'Atlandı — Şüpheli Alacağı Var' "
  "(B7'de şüphesiz gecikmiş de yok: neden yine şüpheli — sıra), C7 gider; ertesi gün D7 ELLE seçilince 'Zaten Kuyrukta' / R3 yok, şüphesiz 100,00 TL ile gider (çıkmaz yok)",
  "S7B (Y12-4/5/6) + G0 (1, 4) + §7a 2, 4", [A7(),
   cari("B7", "Bora Tümü", "0543 100 20 30", [("2026-09-01", 200, 0)], vadeler=[_v("2026-10-12", 200)]),
   cari("D7", "Dilek Kısmi", "0543 200 30 40", [("2026-09-01", 400, 0)], vadeler=[_v("2026-10-08", 300), _v("2026-10-20", 100)]),
   cari("C7", "Cihan Temiz", "0543 300 40 50", [("2026-09-01", 250, 0)], vadeler=[_v("2026-10-15", 250)])],
  [baslat("+0s", "T1", ["A", "B7", "D7", "C7"], sablon="hatirlatma"),
   olay("+1h", "cari", id="B7", vadeler=[_v("2026-10-12", 200, True)]),
   olay("+1h", "cari", id="D7", vadeler=[_v("2026-10-08", 300, True), _v("2026-10-20", 100)]),
   kontrol("+2h", "K1"), kontrol("+24h5m", "K2"),
   baslat("+25h", "T2", ["D7"], sablon="hatirlatma", supheli_elle=["D7"]), kontrol("+26h", "K3")],
  {"elenen": {}, "olusmadi": [],
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B7": "Sınır Nedeniyle Bekliyor", "T1/C7": "Sınır Nedeniyle Bekliyor", "T1/D7": "Sınır Nedeniyle Bekliyor"},
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/B7": "Atlandı", "T1/C7": "Teslim Edildi", "T1/D7": "Atlandı"},
   "kontroller.K3.isler.T2/D7": "Sınır Nedeniyle Bekliyor",
   "isler.T1/B7.atlanma_nedeni": "supheli_alacak", "isler.T1/D7.atlanma_nedeni": "supheli_alacak",
   "isler.T1/C7.degiskenler": ["Cihan Temiz", FIRMA, "15.10.2026", "250,00 TL", "250,00 TL"],
   "isler.T2/D7.durum": "Teslim Edildi", "isler.T2/D7.degiskenler": ["Dilek Kısmi", FIRMA, "20.10.2026", "100,00 TL", SUS7],
   "meta.post": {"A": 1, "B7": 0, "C7": 1, "D7": 1}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("S7B-02-duraklatmada-supheli-acilan-atlanir-elle-secilen-gider", "S7B",
  "Toplu iş hemen duraklatılır; X7'ye şüpheli kaydı açılır, ELLE seçilmiş SE7'ye ikinci şüpheli kalem eklenir → Devam Et: X7 'Atlandı — Şüpheli Alacağı Var', SE7 elle kalır ve "
  "gönderim anındaki şüphesiz tutarla (18.10.2026, 200,00 TL) gider",
  "S7B (Y12-4/7/8) + S7 + Y9d-2", [A7(),
   cari("X7", "Ece Duraklatılan", "0543 400 50 60", [("2026-09-01", 450, 0)], vadeler=[_v("2026-10-09", 400), _v("2026-10-16", 50)]),
   cari("SE7", "Sema Elle", "0543 500 60 70", [("2026-09-01", 1100, 0)], vadeler=[_v("2026-10-02", 600, True), _v("2026-10-11", 300), _v("2026-10-18", 200)])],
  [baslat("+0s", "T1", ["A", "X7", "SE7"], sablon="hatirlatma", supheli_elle=["SE7"]), olay("+0s", "duraklat", toplu="T1"),
   olay("+1m", "cari", id="X7", vadeler=[_v("2026-10-09", 400, True), _v("2026-10-16", 50)]),
   olay("+2m", "cari", id="SE7", vadeler=[_v("2026-10-02", 600, True), _v("2026-10-11", 300, True), _v("2026-10-18", 200)]),
   kontrol("+2m30s", "K1"), olay("+3m", "devam", toplu="T1"), kontrol("+10m", "K2")],
  {"elenen": {},
   "kontroller.K1.isler": {"T1/A": "Duraklatıldı", "T1/SE7": "Duraklatıldı", "T1/X7": "Duraklatıldı"},
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/SE7": "Teslim Edildi", "T1/X7": "Atlandı"},
   "isler.T1/X7.atlanma_nedeni": "supheli_alacak", "isler.T1/SE7.degiskenler": ["Sema Elle", FIRMA, "18.10.2026", "200,00 TL", SUS7],
   "meta.post": {"A": 1, "SE7": 1, "X7": 0}},
  meta_davranis={"kanca": {"*": K_STD}})

S("S7B-03-kuyrukta-acilan-kayit-kapanirsa-gider", "S7B",
  "Toplu iş duraklatılmışken KP7'ye şüpheli kaydı açılır, sonra icra tahsil edilir (şüpheli kalemin kalanı 0) → kayıt KAPALI: Devam Et ile KP7 bütün gecikmişiyle "
  "(13.10.2026, 150,00 TL) ve güncel bakiyeyle gider",
  "S7B (Y12-7) + Y11-17 (kayıt açık = kalanı > 0)", [A7(),
   cari("KP7", "Kenan Tahsil", "0543 600 70 80", [("2026-09-05", 450, 0)], vadeler=[_v("2026-10-07", 300), _v("2026-10-13", 150)])],
  [baslat("+0s", "T1", ["A", "KP7"], sablon="hatirlatma"), olay("+0s", "duraklat", toplu="T1"),
   olay("+1m", "cari", id="KP7", vadeler=[_v("2026-10-07", 300, True), _v("2026-10-13", 150)]),
   olay("+2m", "cari", id="KP7", vadeler=[_v("2026-10-07", 0, True), _v("2026-10-13", 150)], hareket_ekle={"tarih": "2026-10-30", "borc": 0, "alacak": 300}),
   olay("+3m", "devam", toplu="T1")],
  {"isler.T1/KP7.durum": "Teslim Edildi", "isler.T1/KP7.atlanma_nedeni": None,
   "isler.T1/KP7.degiskenler": ["Kenan Tahsil", FIRMA, "13.10.2026", "150,00 TL", "150,00 TL"], "meta.post": {"A": 1, "KP7": 1}},
  meta_davranis={"kanca": {"*": K_STD}})

S("S7B-04-meta-bekletti-ikinci-denemede-supheli-atlanir", "S7B",
  "MB7'nin ilk iletisi Meta Bekletti (131049); 1. saatte şüpheli kaydı açılır → 24 saat sonraki 2. deneme gönderim anıdır: 'Atlandı — Şüpheli Alacağı Var', POST 1",
  "S7B (Y12-4/5) + §7a 14 + K7", [cari("MB7", "Mert Bekletilen", "0543 700 80 90", [("2026-09-01", 550, 0)], vadeler=[_v("2026-10-10", 350)]), A7()],
  [baslat("+0s", "T1", ["MB7", "A"], sablon="hatirlatma"),
   olay("+1h", "cari", id="MB7", vadeler=[_v("2026-10-01", 200, True), _v("2026-10-10", 350)]),
   kontrol("+2h", "K1"), kontrol("+25h", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/MB7": BEKLETTI},
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/MB7": "Atlandı"},
   "isler.T1/MB7.atlanma_nedeni": "supheli_alacak", "isler.T1/MB7.post": 1, "meta.post": {"A": 1, "MB7": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(1)}}},
  meta_davranis={"kanca": {"MB7": K49, "*": K_STD}})

S("S7B-05-yeniden-denemede-supheli-atlanir-elle-isaret-tasinir", "S7B",
  "R7 ve elle seçilmiş RE7 alıcı hatasıyla (131021) Başarısız; R7'ye şüpheli kaydı açılır → Başarısızları Yeniden Dene (toplu işlem, elle seçim DEĞİL): R7 gönderim anında "
  "'Atlandı — Şüpheli Alacağı Var', RE7'nin elle işareti taşınır → şüphesiz tutarla (17.10.2026, 220,00 TL) gider",
  "S7B (Y12-8) + K3 + K4 / K5 düzeni + §7a 12, 32", [A7(),
   cari("R7", "Rıza Yeniden", "0543 800 90 00", [("2026-09-01", 380, 0)], vadeler=[_v("2026-10-09", 300), _v("2026-10-19", 80)]),
   cari("RE7", "Reyhan Elle", "0543 900 00 10", [("2026-09-01", 720, 0)], vadeler=[_v("2026-10-03", 500, True), _v("2026-10-17", 220)])],
  [baslat("+0s", "T1", ["A", "R7", "RE7"], sablon="hatirlatma", supheli_elle=["RE7"]), kontrol("+30m", "K1"),
   olay("+1h", "cari", id="R7", vadeler=[_v("2026-10-09", 300, True), _v("2026-10-19", 80)]),
   olay("+2h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), kontrol("+3h", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/R7": "Başarısız", "T1/RE7": "Başarısız"},
   "yeniden.Y1": {"elenen": {}, "alinan": ["R7", "RE7"], "oneri": None},
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/R7": "Atlandı", "T1/RE7": "Teslim Edildi"},
   "isler.T1/R7.atlanma_nedeni": "supheli_alacak", "isler.T1/RE7.hata_kodu": None,
   "isler.T1/RE7.degiskenler": ["Reyhan Elle", FIRMA, "17.10.2026", "220,00 TL", SUS7], "meta.post": {"A": 1, "R7": 1, "RE7": 2}},
  meta_davranis={"mesaj": {"R7": [{"hata": 131021}, "kabul"], "RE7": [{"hata": 131021}, "kabul"]}, "kanca": {"*": K_STD}})


# ======================================================================== kâhin güncellemesi 13 (2.5.0, KULLANICI KARARI 06.11.2026 04:50 UTC "hepsine A": S16, S17 + 05.11 21:30 karar (5) = NB5 — README §18)
# Elle beklenen YALNIZ karar metinlerinden (kahin.KARARLAR S16, S17, NB5) ve README §18.2 yorumlarından (kodlamadan önce yazıldı, ayrı commit). Yeni olay türü YOK; yeni girdi alanı
# hareketlerde "belge": "alis_faturasi" (sürücü bunu ALIŞ FATURASI olarak girer — kalemleri kapatmaz; kâhin yalnız borç / alacak tutarını okur). Yeni çıktı alanı
# yeniden.<etiket>.supheli_etiketi (Y13-4; yalnız boş değilse).
AF = "alis_faturasi"
# güncelleme 13'ün S16A (s16_an iki okuma metni) güncelleme 17'de KALKTI — S34 = A (README §22 Y17-3)
NETS = "karar (5) / S17 net borç elemesinin adı karar metninde yok ('Gecikmiş Borç Yok' ya da ayrı 'Net Borcu Yok') — ileti iki adda da gitmez"
NET = {"secenek": ["gecikmis_borc_yok", "net_borc_yok"], "susuyor": NETS}


def _h(tarih_, borc, alacak, belge=None):
    return {"tarih": tarih_, "borc": borc, "alacak": alacak, **({"belge": belge} if belge else {})}


def cari_h(id_, ad, tel, hareketler, **kw):
    return {"id": id_, "ad": ad, "telefon": tel, "hareketler": list(hareketler), **kw}


# ---- S16: Sonucu Belirsiz iş beklerken şüpheli kaydı açıldıysa işteki Yine de Gönder elle seçim sayılır (şüphesiz tutarla gider, yoksa elenir; onay penceresinde etiket) ----
S("S16-01-yine-de-gonder-supheli-acik-elle-sayilir-suphesiz-tutarla-gider", "S16",
  "U'nun Ödeme Hatırlatma iletisi Sonucu Belirsiz; 1. saatte 06.10 kalemi şüpheli kaydına alınır → 2. saatte işteki Yine de Gönder: onay penceresinde 'Şüpheli Alacağı Var', elle sayılır, "
  "şüphesiz tutarla (14.10.2026, 300,00 TL = şüphesiz net borç 700 − 400) gider; aynı anda şüpheli kaydı açık EY'nin Ekstre işinde Yine de Gönder etiketsiz ve S7'siz gider",
  "S16 (Y13-1/2/4) + S17 (Y13-8) + Y12-9", [A7(),
   cari_h("U", "Ufuk Belirsiz", "0544 100 20 30", [_h("2026-09-01", 700, 0)], vadeler=[_v("2026-10-06", 400), _v("2026-10-14", 300)]),
   cari_h("EY", "Ekin Ekstre", "0544 200 30 40", [_h("2026-10-03", 600, 0)], vadeler=[_v("2026-10-05", 600, True)])],
  [baslat("+0s", "T1", ["U", "A"], sablon="hatirlatma"), baslat("+0s", "T2", ["EY"]),
   olay("+1h", "cari", id="U", vadeler=[_v("2026-10-06", 400, True), _v("2026-10-14", 300)]),
   olay("+2h", "yine_de_gonder", toplu="T1", cari="U", etiket="Y1"), olay("+2h", "yine_de_gonder", toplu="T2", cari="EY", etiket="Y2"), kontrol("+3h", "K1")],
  {"elenen": {}, "yeniden.Y1": {"elenen": {}, "alinan": ["U"], "oneri": None, "supheli_etiketi": ["U"]}, "yeniden.Y2": {"elenen": {}, "alinan": ["EY"], "oneri": None},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/U": "Teslim Edildi", "T2/EY": "Teslim Edildi"},
   "isler.T1/U.degiskenler": ["Ufuk Belirsiz", FIRMA, "14.10.2026", "300,00 TL", SUS7], "isler.T1/U.post": 2, "isler.T1/U.atlanma_nedeni": None,
   "isler.T2/EY.degiskenler": ["Ekin Ekstre", FIRMA, DON, "600,00 TL"], "meta.post": {"A": 1, "EY": 2, "U": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(3)}}},
  meta_davranis={"mesaj": {"U": ["yanitsiz_kabul", "kabul"], "EY": ["yanitsiz_kabul", "kabul"]},
                 "kanca": {"U": {"1": [], "2": K_STD}, "EY": {"1": [], "2": K_STD}, "*": K_STD}})

S("S16-02-yine-de-gonder-suphesiz-tutar-yok-elenir-ertesi-gun-gider", "S16",
  "X'in iletisi Sonucu Belirsiz; 1. saatte tek vadesi geçmiş kalemi (10.10) şüpheli kaydına alınır, öbür kalemin vadesi BUGÜN → 2. saatte Yine de Gönder: etiket görünür, şüphesiz tutar yok → "
  "güncelleme 17 (S34 = A, README §22 Y17-2/3): iş ALINIR (elle), hemen gönderim anında da tutar yok → 'Atlandı — Gecikmiş Borç Yok' (güncelleme 13'te anı secenek'ti; ad tarihsel: 'elenir'); "
  "ertesi gün asıl işte yeniden Yine de Gönder: 30.10 kalemi artık gecikmiş → 150,00 TL ile gider (çıkmaz yok)",
  "S16 (Y13-3) + S34 (Y17-2/3) + S7A + S17 + G0 (2, 4)", [A7(),
   cari_h("X", "Nazlı Vadeli", "0544 300 40 50", [_h("2026-09-01", 450, 0)], vadeler=[_v("2026-10-10", 300), _v("2026-10-30", 150)])],
  [baslat("+0s", "T1", ["X", "A"], sablon="hatirlatma"),
   olay("+1h", "cari", id="X", vadeler=[_v("2026-10-10", 300, True), _v("2026-10-30", 150)]),
   olay("+2h", "yine_de_gonder", toplu="T1", cari="X", etiket="Y1"), kontrol("+3h", "K1"),
   olay("+24h", "yine_de_gonder", toplu="T1", cari="X", etiket="Y2", hedef="asil"), kontrol("+25h", "K2")],
  {"elenen": {},
   "yeniden.Y1": {"elenen": {}, "alinan": ["X"], "oneri": None, "supheli_etiketi": ["X"]},
   "kontroller.K1.isler.T1/X": "Atlandı",
   "yeniden.Y2": {"elenen": {}, "alinan": ["X"], "oneri": None, "supheli_etiketi": ["X"]},
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/X": "Teslim Edildi"},
   "isler.T1/X.degiskenler": ["Nazlı Vadeli", FIRMA, "30.10.2026", "150,00 TL", SUS7], "isler.T1/X.post": 2, "isler.T1/X.atlanma_nedeni": None,
   "meta.post": {"A": 1, "X": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta_davranis={"mesaj": {"X": ["yanitsiz_kabul", "kabul"]}, "kanca": {"X": {"1": [], "2": K_STD}, "*": K_STD}})

S("S16-03-kayit-basmadan-once-kapanir-etiket-yok-butun-gecikmisle-gider", "S16",
  "KB'nin iletisi Sonucu Belirsiz; 1. saatte 07.10 kalemi şüpheli kaydına alınır, 90. dakikada icra tahsil edilir (kalan 0) → 2. saatte Yine de Gönder: kayıt KAPALI — etiket yok, elle değil, "
  "bütün gecikmişle (15.10.2026, 250,00 TL) ve güncel bakiyeyle gider",
  "S16 (Y13-1/5) + Y12-7 + Y11-17", [A7(),
   cari_h("KB", "Kaan Kapanan", "0544 400 50 60", [_h("2026-09-01", 600, 0)], vadeler=[_v("2026-10-07", 350), _v("2026-10-15", 250)])],
  [baslat("+0s", "T1", ["KB", "A"], sablon="hatirlatma"),
   olay("+1h", "cari", id="KB", vadeler=[_v("2026-10-07", 350, True), _v("2026-10-15", 250)]),
   olay("+90m", "cari", id="KB", vadeler=[_v("2026-10-07", 0, True), _v("2026-10-15", 250)], hareket_ekle=_h("2026-10-30", 0, 350)),
   olay("+2h", "yine_de_gonder", toplu="T1", cari="KB", etiket="Y1")],
  {"yeniden.Y1": {"elenen": {}, "alinan": ["KB"], "oneri": None}, "isler.T1/KB.durum": "Teslim Edildi",
   "isler.T1/KB.degiskenler": ["Kaan Kapanan", FIRMA, "15.10.2026", "250,00 TL", "250,00 TL"], "meta.post": {"A": 1, "KB": 2}},
  meta_davranis={"mesaj": {"KB": ["yanitsiz_kabul", "kabul"]}, "kanca": {"KB": {"1": [], "2": K_STD}, "*": K_STD}})

S("S16-04-s16-elle-isareti-zincirdeki-yeniden-denemeye-tasinir", "S16",
  "ZR'nin iletisi Sonucu Belirsiz; kayıt açılır → Yine de Gönder (etiket, elle) alıcı hatasıyla (131021) Başarısız; 1. iletinin geç 'teslim edilemedi'si gelir (almadı) → Başarısızları "
  "Yeniden Dene (o belirsizlik zinciri): elle işareti taşınır, şüphesiz tutarla (16.10.2026, 400,00 TL) gider",
  "S16 (Y13-2) + Y12-8 + J10 (07:11 c) + J3 + S17", [A7(),
   cari_h("ZR", "Zehra Zincir", "0544 500 60 70", [_h("2026-09-01", 900, 0)], vadeler=[_v("2026-10-04", 500), _v("2026-10-16", 400)])],
  [baslat("+0s", "T1", ["ZR", "A"], sablon="hatirlatma"),
   olay("+1h", "cari", id="ZR", vadeler=[_v("2026-10-04", 500, True), _v("2026-10-16", 400)]),
   olay("+2h", "yine_de_gonder", toplu="T1", cari="ZR", etiket="Y1"), kontrol("+2h45m", "K1"),
   olay("+3h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y2"), kontrol("+4h", "K2")],
  {"yeniden.Y1": {"elenen": {}, "alinan": ["ZR"], "oneri": None, "supheli_etiketi": ["ZR"]},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/ZR": "Başarısız"}, "yeniden.Y2": {"elenen": {}, "alinan": ["ZR"], "oneri": None},
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/ZR": "Teslim Edildi"}, "isler.T1/ZR.hata_kodu": None,
   "isler.T1/ZR.degiskenler": ["Zehra Zincir", FIRMA, "16.10.2026", "400,00 TL", SUS7], "meta.post": {"A": 1, "ZR": 3}},
  meta_davranis={"mesaj": {"ZR": ["yanitsiz_kabul", {"hata": 131021}, "kabul"]},
                 "kanca": {"ZR": {"1": [["failed", "+5s", {"kod": 131026, "varis": "+2h30m"}]], "*": K_STD}, "*": K_STD}})

# ---- S17: elle seçilen şüpheli alacaklıda iletideki şüphesiz gecikmiş tutar şüpheli kalemler HARİÇ net borçla sınırlanır ----
S("S17-01-elle-supheli-suphesiz-net-borcla-sinirlanir", "S17",
  "Beş elle seçilen şüpheli alacaklı: SN1 şüphesiz gecikmiş 300 ama şüphesiz net borç 200 (alış faturası) → 200,00 TL; SN3 vadesi gelmemiş şüpheli kalem de düşülür → 250,00 TL; SN2 (şüphesiz net "
  "−50), SN4 (bize alacaklı), SN5 (şüphesiz net tam 0) elenir — eleme adı karar metninde yok (secenek)",
  "S17 (Y13-8) + NB5 (Y13-7) + S7A + S7", [A7(),
   cari_h("SN1", "Nuri Sınırlı", "0545 100 20 30", [_h("2026-09-01", 900, 0), _h("2026-10-05", 0, 100, AF)], vadeler=[_v("2026-10-03", 600, True), _v("2026-10-12", 300)]),
   cari_h("SN2", "Nalan Eksi", "0545 200 30 40", [_h("2026-09-01", 550, 0), _h("2026-10-08", 0, 200, AF)], vadeler=[_v("2026-10-02", 400, True), _v("2026-10-11", 150)]),
   cari_h("SN3", "Nevin Gelecek", "0545 300 40 50", [_h("2026-09-01", 500, 0), _h("2026-10-09", 0, 50, AF)], vadeler=[_v("2026-10-13", 300), _v("2026-11-15", 200, True)]),
   cari_h("SN4", "Necla Alacaklı", "0545 400 50 60", [_h("2026-09-01", 300, 0), _h("2026-10-06", 0, 500, AF)], vadeler=[_v("2026-10-01", 100, True), _v("2026-10-10", 200)]),
   cari_h("SN5", "Nihat Sıfır", "0545 500 60 70", [_h("2026-09-01", 500, 0), _h("2026-10-07", 0, 100, AF)], vadeler=[_v("2026-10-04", 400, True), _v("2026-10-14", 100)])],
  [baslat("+0s", "T1", ["A", "SN1", "SN2", "SN3", "SN4", "SN5"], sablon="hatirlatma", supheli_elle=["SN1", "SN2", "SN3", "SN4", "SN5"])],
  {"elenen": {"T1": {"SN2": NET, "SN4": NET, "SN5": NET}}, "olusmadi": [], "toplular.T1.is_sayisi": 3, "isler.T1/A.degiskenler": A_HAT,
   "isler.T1/SN1.degiskenler": ["Nuri Sınırlı", FIRMA, "12.10.2026", "200,00 TL", SUS7], "isler.T1/SN1.durum": "Teslim Edildi",
   "isler.T1/SN3.degiskenler": ["Nevin Gelecek", FIRMA, "13.10.2026", "250,00 TL", SUS7], "meta.post": {"A": 1, "SN1": 1, "SN3": 1}},
  meta_davranis={"kanca": {"*": K_STD}})

S("S17-02-gonderim-aninda-suphesiz-net-borc-yeniden-hesaplanir", "S17",
  "Günlük sınır 1: elle seçilen SN6 ve SN7 sınırda bekler; 2. saatte ikisine alış faturası girer → pencere açılınca SN6 gönderim anındaki şüphesiz net borçla (120,00 TL) gider, SN7'nin "
  "şüphesiz net borcu −50 → gönderim anında 'Atlandı' (ad secenek), POST 0",
  "S17 (Y13-8) + NB5 (Y13-6/7) + Y9d-2 + §7a 2", [A7(),
   cari_h("SN6", "Oya Kuyruk", "0545 600 70 80", [_h("2026-09-01", 800, 0)], vadeler=[_v("2026-10-02", 300, True), _v("2026-10-09", 250)]),
   cari_h("SN7", "Ömer Ters", "0545 700 80 90", [_h("2026-09-01", 600, 0)], vadeler=[_v("2026-10-03", 200, True), _v("2026-10-12", 150)])],
  [baslat("+0s", "T1", ["A", "SN6", "SN7"], sablon="hatirlatma", supheli_elle=["SN6", "SN7"]),
   olay("+2h", "cari", id="SN6", hareket_ekle=_h("2026-10-30", 0, 380, AF)), olay("+2h", "cari", id="SN7", hareket_ekle=_h("2026-10-30", 0, 450, AF)),
   kontrol("+3h", "K1")],
  {"elenen": {}, "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/SN6": "Sınır Nedeniyle Bekliyor", "T1/SN7": "Sınır Nedeniyle Bekliyor"},
   "isler.T1/SN6.durum": "Teslim Edildi", "isler.T1/SN6.degiskenler": ["Oya Kuyruk", FIRMA, "09.10.2026", "120,00 TL", SUS7],
   "isler.T1/SN7.durum": "Atlandı", "isler.T1/SN7.atlanma_nedeni": NET, "meta.post": {"A": 1, "SN6": 1, "SN7": 0}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

# ---- NB5 (karar 5): gecikmiş tutar net borcu aşmaz (alış faturası düşülür); bize alacaklı kişiye hatırlatma gitmez ----
S("NB5-01-net-borc-siniri-bize-alacakli-elenir", "NB5",
  "Ödeme Hatırlatma: P5'in vadesi geçmiş 700'ü alış faturasıyla net 400 → {{4}} 400,00 TL ({{3}} en eski açık kalem aynen); Q5 bize alacaklı, R5 net borç tam 0 → elenir (ad secenek); S5 net = "
  "gecikmiş (vadesi gelmemiş kalem sayılmaz) → 250,00 TL; vadesi geçmiş kalemi olmayan C 'Gecikmiş Borç Yok' (eski ad); Q5'e Ekstre '(Alacaklı)' ile gider",
  "NB5 (Y13-6/7/9) + §7a 20, 22", [A7(),
   cari_h("P5", "Pelin Netleşen", "0546 100 20 30", [_h("2026-09-05", 400, 0), _h("2026-09-15", 300, 0), _h("2026-10-20", 0, 300, AF)],
          vadeler=[_v("2026-10-05", 400), _v("2026-10-15", 300)]),
   cari_h("Q5", "Kemal Alacaklı", "0546 200 30 40", [_h("2026-09-05", 200, 0), _h("2026-10-10", 0, 350, AF)], vadeler=[_v("2026-10-05", 200)]),
   cari_h("R5", "Rana Sıfır", "0546 300 40 50", [_h("2026-09-08", 300, 0), _h("2026-10-12", 0, 300, AF)], vadeler=[_v("2026-10-08", 300)]),
   cari_h("S5", "Suat Eşit", "0546 400 50 60", [_h("2026-09-09", 250, 0), _h("2026-09-20", 100, 0), _h("2026-10-15", 0, 100, AF)],
          vadeler=[_v("2026-10-09", 250), _v("2026-11-20", 100)]),
   C()],
  [baslat("+0s", "T1", ["A", "P5", "Q5", "R5", "S5", "C"], sablon="hatirlatma"), baslat("+1h", "T2", ["Q5"])],
  {"elenen": {"T1": {"C": "gecikmis_borc_yok", "Q5": NET, "R5": NET}}, "olusmadi": [], "toplular.T1.is_sayisi": 3, "isler.T1/A.degiskenler": A_HAT,
   "isler.T1/P5.degiskenler": ["Pelin Netleşen", FIRMA, "05.10.2026", "400,00 TL", "400,00 TL"], "isler.T1/P5.durum": "Teslim Edildi",
   "isler.T1/S5.degiskenler": ["Suat Eşit", FIRMA, "09.10.2026", "250,00 TL", "250,00 TL"],
   "isler.T2/Q5.degiskenler": ["Kemal Alacaklı", FIRMA, DON, "150,00 TL (Alacaklı)"], "isler.T2/Q5.durum": "Teslim Edildi",
   "meta.post": {"A": 1, "P5": 1, "Q5": 1, "S5": 1}},
  meta_davranis={"kanca": {"*": K_STD}})

S("NB5-02-gonderim-aninda-bize-alacakli-atlanir-tutar-yeniden", "NB5",
  "Günlük sınır 1: V5 ve W5 sınırda bekler; 2. saatte ikisine alış faturası girer → pencere açılınca (31.10) V5 bize alacaklı: 'Atlandı' (ad secenek), POST 0; W5 gönderim anındaki net borçla "
  "(150,00 TL; vadesi gelmemiş 10.11 kalemi sayılmaz) gider",
  "NB5 (Y13-6/7) + Y9d-2 + §7a 2", [A7(),
   cari_h("V5", "Veli Döndü", "0546 500 60 70", [_h("2026-09-01", 400, 0)], vadeler=[_v("2026-10-08", 400)]),
   cari_h("W5", "Gül Azalan", "0546 600 70 80", [_h("2026-09-01", 400, 0)], vadeler=[_v("2026-10-07", 300), _v("2026-11-10", 100)])],
  [baslat("+0s", "T1", ["A", "V5", "W5"], sablon="hatirlatma"),
   olay("+2h", "cari", id="V5", hareket_ekle=_h("2026-10-30", 0, 500, AF)), olay("+2h", "cari", id="W5", hareket_ekle=_h("2026-10-30", 0, 250, AF)),
   kontrol("+3h", "K1")],
  {"elenen": {}, "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/V5": "Sınır Nedeniyle Bekliyor", "T1/W5": "Sınır Nedeniyle Bekliyor"},
   "isler.T1/V5.durum": "Atlandı", "isler.T1/V5.atlanma_nedeni": NET, "isler.T1/W5.durum": "Teslim Edildi",
   "isler.T1/W5.degiskenler": ["Gül Azalan", FIRMA, "07.10.2026", "150,00 TL", "150,00 TL"], "meta.post": {"A": 1, "V5": 0, "W5": 1}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})


# ======================================================================== kâhin güncellemesi 14 (2.5.0, KULLANICI KARARI 06.11.2026 05:30 UTC "a": S22 = eski S7-d — README §19)
# Elle beklenen YALNIZ karar metninden (kahin.KARARLAR S22) ve README §19.2 yorumlarından (kodlamadan önce yazıldı, ayrı commit). Yeni olay türü / girdi / çıktı alanı YOK.
# Ortak düzen: işteki Yine de Gönder basıldığında şüpheli kaydı YOK (iş elle işaretsiz, etiket yok); gönderim beklerken kayıt açılır → gönderim anında "Atlandı — Şüpheli Alacağı Var"
# (POST yok); yol: kayıt açıkken asıl işte yeniden Yine de Gönder → S16 (etiket, elle, şüphesiz tutar). Yeniden basma hep Atlandı'dan SONRA (S7-e — README §19.4 — girilmez).
def _bel(*cariler_):
    """Her carinin 1. iletisi yanıtsız kabul (Sonucu Belirsiz, bildirimi yok), sonrakiler kabul + teslim."""
    return {"mesaj": {c: ["yanitsiz_kabul", "kabul", "kabul"] for c in cariler_},
            "kanca": {**{c: {"1": [], "*": K_STD} for c in cariler_}, "*": K_STD}}


# ---- S22: Yine de Gönder basıldığında şüpheli kaydı yoktu, gönderim beklerken açıldı → S7-b gibi gönderim anında atlanır; yol: kayıt açıkken yeniden Yine de Gönder (S16) ----
S("S22-01-sinirda-bekleyen-yine-de-gonder-supheli-acilir-atlanir-yeniden-basma-gider", "S22",
  "Günlük sınır 1: SU ve SV'nin iletisi Sonucu Belirsiz, A gider; 1. saatte ikisine işteki Yine de Gönder (kayıt yok, etiket yok) → sınırda bekler; 2. saatte ikisinin de şüpheli kaydı açılır → "
  "ertesi gün pencere açılınca gönderim anında 'Atlandı — Şüpheli Alacağı Var' (POST yok); SU'ya asıl işte yeniden Yine de Gönder: etiket, elle, şüphesiz tutarla (15.10.2026, 300,00 TL "
  "= şüphesiz net borç 800 − 500) gider; SV atlanmış kalır",
  "S22 (Y14-1/2/3a/4) + S16 + S17 + Y12-5 + G0 (1, 2, 4)", [A7(),
   cari_h("SU", "Sinem Sınırda", "0547 100 20 30", [_h("2026-09-01", 800, 0)], vadeler=[_v("2026-10-06", 500), _v("2026-10-15", 300)]),
   cari_h("SV", "Savaş Bekleyen", "0547 200 30 40", [_h("2026-09-01", 450, 0)], vadeler=[_v("2026-10-09", 450)])],
  [baslat("+0s", "T1", ["SU", "SV", "A"], sablon="hatirlatma"),
   olay("+1h", "yine_de_gonder", toplu="T1", cari="SU", etiket="Y1"), olay("+1h", "yine_de_gonder", toplu="T1", cari="SV", etiket="Y2"), kontrol("+1h30m", "K1"),
   olay("+2h", "cari", id="SU", vadeler=[_v("2026-10-06", 500, True), _v("2026-10-15", 300)]), olay("+2h", "cari", id="SV", vadeler=[_v("2026-10-09", 450, True)]),
   kontrol("+24h5m", "K2"), olay("+25h", "yine_de_gonder", toplu="T1", cari="SU", etiket="Y3", hedef="asil"), kontrol("+26h", "K3")],
  {"elenen": {}, "olusmadi": [],
   "yeniden.Y1": {"elenen": {}, "alinan": ["SU"], "oneri": None}, "yeniden.Y2": {"elenen": {}, "alinan": ["SV"], "oneri": None},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/SU": "Sınır Nedeniyle Bekliyor", "T1/SV": "Sınır Nedeniyle Bekliyor"},
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/SU": "Atlandı", "T1/SV": "Atlandı"},
   "yeniden.Y3": {"elenen": {}, "alinan": ["SU"], "oneri": None, "supheli_etiketi": ["SU"]},
   "kontroller.K3.isler": {"T1/A": "Teslim Edildi", "T1/SU": "Teslim Edildi", "T1/SV": "Atlandı"},
   "isler.T1/SU.degiskenler": ["Sinem Sınırda", FIRMA, "15.10.2026", "300,00 TL", SUS7], "isler.T1/SU.post": 2, "isler.T1/SU.atlanma_nedeni": None,
   "isler.T1/SV.durum": "Atlandı", "isler.T1/SV.atlanma_nedeni": "supheli_alacak", "isler.T1/SV.post": 1,
   "meta.post": {"A": 1, "SU": 2, "SV": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis=_bel("SU", "SV"))

S("S22-02-duraklatildi-devam-et-atlanir-ayni-gun-yeni-is-belirsiz-yeniden-basma-gider", "S22",
  "DR ve DS'nin iletisi Sonucu Belirsiz; 1. saatte işteki Yine de Gönder + toplu iş hemen duraklatılır; 2. saatte ikisinin şüpheli kaydı açılır → Devam Et: ikisi de gönderim anında "
  "'Atlandı — Şüpheli Alacağı Var'; DR'ye asıl işte yeniden Yine de Gönder: elle, şüphesiz tutarla (18.10.2026, 300,00 TL) gider; DS aynı gün yeni gönderimde ELLE seçilse de "
  "'Sonucu Belirsiz' ile elenir (eski deneme hâlâ belirsiz — tek yol işteki Yine de Gönder)",
  "S22 (Y14-1/2/3b/4) + S16 + D1 + E3 + G0 (2, 4)", [A7(),
   cari_h("DR", "Derya Duraklatılan", "0547 300 40 50", [_h("2026-09-01", 900, 0)], vadeler=[_v("2026-10-04", 600), _v("2026-10-18", 300)]),
   cari_h("DS", "Doruk Durdurulan", "0547 400 50 60", [_h("2026-09-01", 350, 0)], vadeler=[_v("2026-10-11", 200), _v("2026-10-21", 150)])],
  [baslat("+0s", "T1", ["DR", "DS", "A"], sablon="hatirlatma"),
   olay("+1h", "yine_de_gonder", toplu="T1", cari="DR", etiket="Y1"), olay("+1h", "yine_de_gonder", toplu="T1", cari="DS", etiket="Y2"), olay("+1h", "duraklat", toplu="T1"),
   kontrol("+1h30m", "K1"),
   olay("+2h", "cari", id="DR", vadeler=[_v("2026-10-04", 600, True), _v("2026-10-18", 300)]), olay("+2h", "cari", id="DS", vadeler=[_v("2026-10-11", 200, True), _v("2026-10-21", 150)]),
   olay("+3h", "devam", toplu="T1"), kontrol("+3h5m", "K2"),
   olay("+4h", "yine_de_gonder", toplu="T1", cari="DR", etiket="Y3", hedef="asil"), kontrol("+4h5m", "K3"),
   baslat("+5h", "T2", ["DS"], sablon="hatirlatma", supheli_elle=["DS"])],
  {"yeniden.Y1": {"elenen": {}, "alinan": ["DR"], "oneri": None}, "yeniden.Y2": {"elenen": {}, "alinan": ["DS"], "oneri": None},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/DR": "Duraklatıldı", "T1/DS": "Duraklatıldı"},
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/DR": "Atlandı", "T1/DS": "Atlandı"},
   "yeniden.Y3": {"elenen": {}, "alinan": ["DR"], "oneri": None, "supheli_etiketi": ["DR"]},
   "kontroller.K3.isler": {"T1/A": "Teslim Edildi", "T1/DR": "Teslim Edildi", "T1/DS": "Atlandı"},
   "isler.T1/DR.degiskenler": ["Derya Duraklatılan", FIRMA, "18.10.2026", "300,00 TL", SUS7], "isler.T1/DR.post": 2,
   "isler.T1/DS.durum": "Atlandı", "isler.T1/DS.atlanma_nedeni": "supheli_alacak", "isler.T1/DS.post": 1,
   "elenen": {"T2": {"DS": "sonucu_belirsiz"}}, "olusmadi": ["T2"],
   "meta.post": {"A": 1, "DR": 2, "DS": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta_davranis=_bel("DR", "DS"))

S("S22-03-zincirdeki-yeniden-denemede-supheli-atlanir-yeni-gonderimde-elle-gider", "S22",
  "ZN ve ZM'nin iletisi Sonucu Belirsiz → işteki Yine de Gönder (kayıt yok) alıcı hatasıyla (131021) Başarısız; ZM'nin şüpheli kaydı Başarısız iken açılır; 1. iletilerin geç 'teslim "
  "edilemedi'si gelir → zincirdeki Başarısızları Yeniden Dene ikisini alır, toplu iş duraklatılır; ZN'nin kaydı yeniden deneme beklerken açılır → Devam Et: ikisi de 'Atlandı — Şüpheli "
  "Alacağı Var'; aynı gün yeni gönderimde ZN ELLE seçilir: belirsiz deneme kalmadığından elenmez, şüphesiz tutarla (17.10.2026, 400,00 TL) gider",
  "S22 (Y14-1/2/3c/5) + J10 (07:11 c) + J3 + K6 + Y12-5 + Y12-8 + S7 + G0 (1, 4)", [A7(),
   cari_h("ZN", "Zafer Zincir", "0547 500 60 70", [_h("2026-09-01", 1000, 0)], vadeler=[_v("2026-10-03", 600), _v("2026-10-17", 400)]),
   cari_h("ZM", "Zümrüt Önceden", "0547 600 70 80", [_h("2026-09-01", 500, 0)], vadeler=[_v("2026-10-08", 500)])],
  [baslat("+0s", "T1", ["ZN", "ZM", "A"], sablon="hatirlatma"),
   olay("+1h", "yine_de_gonder", toplu="T1", cari="ZN", etiket="Y1"), olay("+1h", "yine_de_gonder", toplu="T1", cari="ZM", etiket="Y2"),
   olay("+2h", "cari", id="ZM", vadeler=[_v("2026-10-08", 500, True)]), kontrol("+2h45m", "K1"),
   olay("+3h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y3"), olay("+3h", "duraklat", toplu="T1"),
   olay("+3h30m", "cari", id="ZN", vadeler=[_v("2026-10-03", 600, True), _v("2026-10-17", 400)]), olay("+4h", "devam", toplu="T1"), kontrol("+4h5m", "K2"),
   baslat("+5h", "T2", ["ZN"], sablon="hatirlatma", supheli_elle=["ZN"])],
  {"yeniden.Y1": {"elenen": {}, "alinan": ["ZN"], "oneri": None}, "yeniden.Y2": {"elenen": {}, "alinan": ["ZM"], "oneri": None},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/ZM": "Başarısız", "T1/ZN": "Başarısız"},
   "yeniden.Y3": {"elenen": {}, "alinan": ["ZN", "ZM"], "oneri": None},
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/ZM": "Atlandı", "T1/ZN": "Atlandı"},
   "isler.T1/ZN.atlanma_nedeni": "supheli_alacak", "isler.T1/ZM.atlanma_nedeni": "supheli_alacak", "isler.T1/ZN.post": 2, "isler.T1/ZM.post": 2,
   "elenen": {}, "olusmadi": [], "toplular.T2.is_sayisi": 1,
   "isler.T2/ZN.durum": "Teslim Edildi", "isler.T2/ZN.degiskenler": ["Zafer Zincir", FIRMA, "17.10.2026", "400,00 TL", SUS7],
   "meta.post": {"A": 1, "ZM": 2, "ZN": 3}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta_davranis={"mesaj": {"ZN": ["yanitsiz_kabul", {"hata": 131021}, "kabul"], "ZM": ["yanitsiz_kabul", {"hata": 131021}]},
                 "kanca": {"T1/ZN": {"1": [["failed", "+5s", {"kod": 131026, "varis": "+2h30m"}]], "*": K_STD},
                           "T1/ZM": {"1": [["failed", "+5s", {"kod": 131026, "varis": "+2h30m"}]], "*": K_STD}, "*": K_STD}})

S("S22-04-kayit-gonderimden-once-kapanirsa-butun-gecikmisle-gider-acik-kalan-atlanir", "S22",
  "KQ ve KA'nın iletisi Sonucu Belirsiz; işteki Yine de Gönder + duraklatma; ikisinin şüpheli kaydı açılır, KQ'nunki Devam Et'ten ÖNCE kapanır (icra tahsili, kalan 0) → Devam Et: KQ "
  "kayıt kapalı — etiketsiz, bütün gecikmişiyle (15.10.2026, 250,00 TL) ve güncel bakiyeyle gider; kaydı açık kalan KA 'Atlandı — Şüpheli Alacağı Var'",
  "S22 (Y14-2/6) + Y12-7 + Y11-17 + NB5", [A7(),
   cari_h("KQ", "Kerem Kapanan", "0547 700 80 90", [_h("2026-09-01", 600, 0)], vadeler=[_v("2026-10-07", 350), _v("2026-10-15", 250)]),
   cari_h("KA", "Kader Açık", "0547 800 90 00", [_h("2026-09-01", 400, 0)], vadeler=[_v("2026-10-09", 250), _v("2026-10-19", 150)])],
  [baslat("+0s", "T1", ["KQ", "KA", "A"], sablon="hatirlatma"),
   olay("+1h", "yine_de_gonder", toplu="T1", cari="KQ", etiket="Y1"), olay("+1h", "yine_de_gonder", toplu="T1", cari="KA", etiket="Y2"), olay("+1h", "duraklat", toplu="T1"),
   olay("+2h", "cari", id="KQ", vadeler=[_v("2026-10-07", 350, True), _v("2026-10-15", 250)]), olay("+2h", "cari", id="KA", vadeler=[_v("2026-10-09", 250, True), _v("2026-10-19", 150)]),
   olay("+2h30m", "cari", id="KQ", vadeler=[_v("2026-10-07", 0, True), _v("2026-10-15", 250)], hareket_ekle=_h("2026-10-30", 0, 350)),
   olay("+3h", "devam", toplu="T1"), kontrol("+3h5m", "K1")],
  {"yeniden.Y1": {"elenen": {}, "alinan": ["KQ"], "oneri": None}, "yeniden.Y2": {"elenen": {}, "alinan": ["KA"], "oneri": None},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/KA": "Atlandı", "T1/KQ": "Teslim Edildi"},
   "isler.T1/KQ.degiskenler": ["Kerem Kapanan", FIRMA, "15.10.2026", "250,00 TL", "250,00 TL"], "isler.T1/KQ.post": 2, "isler.T1/KQ.atlanma_nedeni": None,
   "isler.T1/KA.durum": "Atlandı", "isler.T1/KA.atlanma_nedeni": "supheli_alacak", "isler.T1/KA.post": 1,
   "meta.post": {"A": 1, "KA": 1, "KQ": 2}},
  meta_davranis=_bel("KQ", "KA"))

S("S22-05-ay-sonu-gece-yarisi-atlanir-yerel-gunle-yeniden-basma", "S22",
  "31.10 23:30 (yerel): GY'nin iletisi Sonucu Belirsiz; 23:40 Yine de Gönder + duraklatma; 23:50 şüpheli kaydı açılır → 01.11 00:10 yerel (UTC'de hâlâ 31.10) Devam Et: 'Atlandı — Şüpheli "
  "Alacağı Var'; 00:20 yeniden Yine de Gönder: yerel güne göre 31.10 kalemi artık gecikmiş → elle, 31.10.2026 / 300,00 TL ile gider; 'Bu Ay' teslim ayı Türkiye saatiyle (Ekim 1 + Kasım 1)",
  "S22 (Y14-2/4/9) + S16 + S7A + §7a 19, 20", [A7(),
   cari_h("GY", "Gülay Gece", "0547 900 00 11", [_h("2026-09-01", 700, 0)], vadeler=[_v("2026-10-05", 400), _v("2026-10-31", 300)])],
  [baslat("+0s", "T1", ["GY", "A"], sablon="hatirlatma"),
   olay("+10m", "yine_de_gonder", toplu="T1", cari="GY", etiket="Y1"), olay("+10m", "duraklat", toplu="T1"),
   olay("+20m", "cari", id="GY", vadeler=[_v("2026-10-05", 400, True), _v("2026-10-31", 300)]), kontrol("+25m", "K1"),
   olay("+40m", "devam", toplu="T1"), kontrol("+45m", "K2"), olay("+50m", "yine_de_gonder", toplu="T1", cari="GY", etiket="Y2", hedef="asil"), kontrol("+55m", "K3")],
  {"elenen": {}, "yeniden.Y1": {"elenen": {}, "alinan": ["GY"], "oneri": None},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/GY": "Duraklatıldı"}, "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/GY": "Atlandı"},
   "yeniden.Y2": {"elenen": {}, "alinan": ["GY"], "oneri": None, "supheli_etiketi": ["GY"]}, "kontroller.K3.isler": {"T1/A": "Teslim Edildi", "T1/GY": "Teslim Edildi"},
   "isler.T1/GY.degiskenler": ["Gülay Gece", FIRMA, "31.10.2026", "300,00 TL", SUS7], "isler.T1/GY.post": 2, "isler.T1/GY.atlanma_nedeni": None,
   "isler.T1/A.degiskenler": A_HAT, "meta.post": {"A": 1, "GY": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(1), "2026-11": ay_kova(1)}}},
  baslangic="2026-10-31T23:30:00+03:00", meta_davranis=_bel("GY"))

S("S22-06-meta-bekletti-ikinci-denemede-atlanir-yeniden-basma-gider", "S22",
  "MB'nin iletisi Sonucu Belirsiz; işteki Yine de Gönder'in iletisi Meta Bekletti (131049); 2. saatte şüpheli kaydı açılır → 24 saat sonraki 2. deneme gönderim anıdır: 'Atlandı — Şüpheli "
  "Alacağı Var' (2. deneme gitmez); ertesi gün yeniden Yine de Gönder: elle, şüphesiz tutarla (16.10.2026, 250,00 TL) gider (Meta Bekletti iletisi 'Daha Önce Gönderildi' sayılmaz)",
  "S22 (Y14-2/3d/4) + Y12-4 + §7a 14 + K7 + S16", [A7(),
   cari_h("MB", "Melek Bekletilen", "0548 100 20 30", [_h("2026-09-01", 650, 0)], vadeler=[_v("2026-10-06", 400), _v("2026-10-16", 250)])],
  [baslat("+0s", "T1", ["MB", "A"], sablon="hatirlatma"), olay("+1h", "yine_de_gonder", toplu="T1", cari="MB", etiket="Y1"),
   olay("+2h", "cari", id="MB", vadeler=[_v("2026-10-06", 400, True), _v("2026-10-16", 250)]), kontrol("+3h", "K1"), kontrol("+25h5m", "K2"),
   olay("+26h", "yine_de_gonder", toplu="T1", cari="MB", etiket="Y2", hedef="asil"), kontrol("+27h", "K3")],
  {"yeniden.Y1": {"elenen": {}, "alinan": ["MB"], "oneri": None},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/MB": BEKLETTI}, "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/MB": "Atlandı"},
   "yeniden.Y2": {"elenen": {}, "alinan": ["MB"], "oneri": None, "supheli_etiketi": ["MB"]}, "kontroller.K3.isler": {"T1/A": "Teslim Edildi", "T1/MB": "Teslim Edildi"},
   "isler.T1/MB.degiskenler": ["Melek Bekletilen", FIRMA, "16.10.2026", "250,00 TL", SUS7], "isler.T1/MB.post": 3,
   "meta.post": {"A": 1, "MB": 3}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta_davranis={"mesaj": {"MB": ["yanitsiz_kabul", "kabul", "kabul"]}, "kanca": {"MB": {"1": [], "2": K49, "3": K_STD}, "*": K_STD}})


# ======================================================================== kâhin güncellemesi 15 (2.5.0, KULLANICI KARARI 06.11.2026 06:03 UTC "a": S23 = eski S7-e — README §20)
# Elle beklenen YALNIZ karar metninden (kahin.KARARLAR S23) ve README §20.2 yorumlarından (kodlamadan önce yazıldı, ayrı commit). Yeni çıktı alanı yeniden.<etiket>.elle_sayilan
# (S23 tetiğinde). Ortak düzen: işteki Yine de Gönder basıldığında şüpheli kaydı YOK; iş gönderim anından ÖNCE beklerken kayıt açılır; kullanıcı kayıt açıkken asıl işte YENİDEN basar →
# bekleyen iş elle sayılır (etiket + elle_sayilan), yeni iş / deneme açılmaz, işin durumu değişmez; gönderim anında şüphesiz tutarla gider (S22'nin "Atlandı"sı yerine).
S23S = ("S23 yeniden basmasında şüphesiz tutar yok: S16 'yoksa elenir'in anı karar metninde yok — bekleyen iş elle sayılıp gönderim anında 'Gecikmiş Borç Yok' ile mi atlanır, yanıtta "
        "elenip iş işaretsiz kalarak gönderim anında S22 ile mi atlanır — iki okumada da ileti gitmez")
SINIR_B = "Sınır Nedeniyle Bekliyor"


def s23_yanit(cari_, elenen=None):
    """S23 tetiğinde yeniden basmanın yanıtı: onay penceresinde etiket, kişi elle sayıldı (alınan / elenen değil)."""
    return {"elenen": elenen or {}, "alinan": [], "oneri": None, "supheli_etiketi": [cari_], "elle_sayilan": [cari_]}


S("S23-01-sinirda-bekleyen-yeniden-basma-elle-sayilir-pencere-acilinca-gider", "S23",
  "Günlük sınır 1: SR ve SV'nin iletisi Sonucu Belirsiz, A gider; 1. saatte ikisine işteki Yine de Gönder (kayıt yok) → sınırda bekler; 2. saatte ikisinin şüpheli kaydı açılır; 3. saatte "
  "SR'ye kayıt açıkken asıl işte YENİDEN Yine de Gönder: bekleyen iş elle sayılır (etiket + elle_sayilan), yeni iş açılmaz, iş sınırda beklemeyi sürdürür; 4. saatte bir kez daha basılır: iş "
  "artık elle işaretli → F1 aynen 'Zaten Kuyrukta'; ertesi gün pencere açılınca SR şüphesiz tutarla (15.10.2026, 300,00 TL = 800 − 500) gider, yeniden basılmayan SV 'Atlandı — Şüpheli "
  "Alacağı Var' (S22)",
  "S23 (Y15-1/2/3/4/5) + S16 + S17 + S22 + F1", [A7(),
   cari_h("SR", "Serkan Sınırda", "0549 100 20 30", [_h("2026-09-01", 800, 0)], vadeler=[_v("2026-10-06", 500), _v("2026-10-15", 300)]),
   cari_h("SV", "Sevgi Bekleyen", "0549 200 30 40", [_h("2026-09-01", 450, 0)], vadeler=[_v("2026-10-09", 450)])],
  [baslat("+0s", "T1", ["SR", "SV", "A"], sablon="hatirlatma"),
   olay("+1h", "yine_de_gonder", toplu="T1", cari="SR", etiket="Y1"), olay("+1h", "yine_de_gonder", toplu="T1", cari="SV", etiket="Y2"), kontrol("+1h30m", "K1"),
   olay("+2h", "cari", id="SR", vadeler=[_v("2026-10-06", 500, True), _v("2026-10-15", 300)]), olay("+2h", "cari", id="SV", vadeler=[_v("2026-10-09", 450, True)]),
   olay("+3h", "yine_de_gonder", toplu="T1", cari="SR", etiket="Y3", hedef="asil"), kontrol("+3h5m", "K2"),
   olay("+4h", "yine_de_gonder", toplu="T1", cari="SR", etiket="Y4", hedef="asil"), kontrol("+24h5m", "K3")],
  {"elenen": {}, "olusmadi": [],
   "yeniden.Y1": {"elenen": {}, "alinan": ["SR"], "oneri": None}, "yeniden.Y2": {"elenen": {}, "alinan": ["SV"], "oneri": None},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/SR": SINIR_B, "T1/SV": SINIR_B},
   "yeniden.Y3": s23_yanit("SR"),
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/SR": SINIR_B, "T1/SV": SINIR_B}, "kontroller.K2.toplam_post": 3,
   "yeniden.Y4": {"elenen": {"SR": "zaten_kuyrukta"}, "alinan": [], "oneri": None, "supheli_etiketi": ["SR"]},
   "kontroller.K3.isler": {"T1/A": "Teslim Edildi", "T1/SR": "Teslim Edildi", "T1/SV": "Atlandı"},
   "isler.T1/SR.degiskenler": ["Serkan Sınırda", FIRMA, "15.10.2026", "300,00 TL", SUS7], "isler.T1/SR.post": 2, "isler.T1/SR.atlanma_nedeni": None,
   "isler.T1/SV.durum": "Atlandı", "isler.T1/SV.atlanma_nedeni": "supheli_alacak", "isler.T1/SV.post": 1,
   "toplular.T1.is_sayisi": 3, "meta.post": {"A": 1, "SR": 2, "SV": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis=_bel("SR", "SV"))

S("S23-02-duraklatildi-yeniden-basma-elle-devam-et-ile-gider-kayitsiz-zaten-kuyrukta", "S23",
  "DK, DL ve DT'nin iletisi Sonucu Belirsiz; 1. saatte üçüne işteki Yine de Gönder + toplu iş hemen duraklatılır; 2. saatte DK ve DL'nin şüpheli kaydı açılır; 2,5. saatte DK'ya (kayıt "
  "açık) ve DT'ye (kayıt YOK) asıl işte yeniden Yine de Gönder: DK elle sayılır, DT F1 aynen 'Zaten Kuyrukta'; Devam Et: DK şüphesiz tutarla (18.10.2026, 300,00 TL) gider, DL 'Atlandı — "
  "Şüpheli Alacağı Var' (S22), DT bütün gecikmişle ve güncel bakiyeyle (12.10.2026, 400,00 TL, 400,00 TL) gider",
  "S23 (Y15-1/2/3/4/5) + S16 + S17 + S22 + F1 + §7a 20", [A7(),
   cari_h("DK", "Doğan Kuyrukta", "0549 300 40 50", [_h("2026-09-01", 900, 0)], vadeler=[_v("2026-10-04", 600), _v("2026-10-18", 300)]),
   cari_h("DL", "Dilek Atlanan", "0549 400 50 60", [_h("2026-09-01", 350, 0)], vadeler=[_v("2026-10-11", 200), _v("2026-10-21", 150)]),
   cari_h("DT", "Duygu Kayıtsız", "0549 500 60 70", [_h("2026-09-01", 400, 0)], vadeler=[_v("2026-10-12", 250), _v("2026-10-25", 150)])],
  [baslat("+0s", "T1", ["DK", "DL", "DT", "A"], sablon="hatirlatma"),
   olay("+1h", "yine_de_gonder", toplu="T1", cari="DK", etiket="Y1"), olay("+1h", "yine_de_gonder", toplu="T1", cari="DL", etiket="Y2"),
   olay("+1h", "yine_de_gonder", toplu="T1", cari="DT", etiket="Y3"), olay("+1h", "duraklat", toplu="T1"), kontrol("+1h30m", "K1"),
   olay("+2h", "cari", id="DK", vadeler=[_v("2026-10-04", 600, True), _v("2026-10-18", 300)]), olay("+2h", "cari", id="DL", vadeler=[_v("2026-10-11", 200, True), _v("2026-10-21", 150)]),
   olay("+2h30m", "yine_de_gonder", toplu="T1", cari="DK", etiket="Y4", hedef="asil"), olay("+2h30m", "yine_de_gonder", toplu="T1", cari="DT", etiket="Y5", hedef="asil"),
   kontrol("+2h45m", "K2"), olay("+3h", "devam", toplu="T1"), kontrol("+3h5m", "K3")],
  {"yeniden.Y1": {"elenen": {}, "alinan": ["DK"], "oneri": None}, "yeniden.Y2": {"elenen": {}, "alinan": ["DL"], "oneri": None},
   "yeniden.Y3": {"elenen": {}, "alinan": ["DT"], "oneri": None},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/DK": "Duraklatıldı", "T1/DL": "Duraklatıldı", "T1/DT": "Duraklatıldı"},
   "yeniden.Y4": s23_yanit("DK"), "yeniden.Y5": {"elenen": {"DT": "zaten_kuyrukta"}, "alinan": [], "oneri": None},
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/DK": "Duraklatıldı", "T1/DL": "Duraklatıldı", "T1/DT": "Duraklatıldı"}, "kontroller.K2.toplam_post": 4,
   "kontroller.K3.isler": {"T1/A": "Teslim Edildi", "T1/DK": "Teslim Edildi", "T1/DL": "Atlandı", "T1/DT": "Teslim Edildi"},
   "isler.T1/DK.degiskenler": ["Doğan Kuyrukta", FIRMA, "18.10.2026", "300,00 TL", SUS7], "isler.T1/DK.post": 2, "isler.T1/DK.atlanma_nedeni": None,
   "isler.T1/DL.atlanma_nedeni": "supheli_alacak", "isler.T1/DL.post": 1,
   "isler.T1/DT.degiskenler": ["Duygu Kayıtsız", FIRMA, "12.10.2026", "400,00 TL", "400,00 TL"], "isler.T1/DT.post": 2,
   "toplular.T1.is_sayisi": 4, "meta.post": {"A": 1, "DK": 2, "DL": 1, "DT": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(3)}}},
  meta_davranis=_bel("DK", "DL", "DT"))

S("S23-03-zincirdeki-yeniden-deneme-beklerken-yeniden-basma-elle-gider", "S23",
  "ZK'nın iletisi Sonucu Belirsiz → işteki Yine de Gönder (kayıt yok) alıcı hatasıyla (131021) Başarısız; 1. iletinin geç 'teslim edilemedi'si gelir → zincirdeki Başarısızları Yeniden "
  "Dene ZK'yı alır, toplu iş duraklatılır; yeniden deneme beklerken şüpheli kaydı açılır ve kullanıcı asıl işte yeniden Yine de Gönder'e basar → bekleyen iş elle sayılır; Devam Et: "
  "şüphesiz tutarla (17.10.2026, 400,00 TL = 1.000 − 600) gider (S22-03'teki 'Atlandı' yerine)",
  "S23 (Y15-1/2/3/5/8) + J10 (07:11 c) + J3 + K6 + S16 + S17", [A7(),
   cari_h("ZK", "Zeki Zincir", "0549 600 70 80", [_h("2026-09-01", 1000, 0)], vadeler=[_v("2026-10-03", 600), _v("2026-10-17", 400)])],
  [baslat("+0s", "T1", ["ZK", "A"], sablon="hatirlatma"), olay("+1h", "yine_de_gonder", toplu="T1", cari="ZK", etiket="Y1"), kontrol("+2h45m", "K1"),
   olay("+3h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y2"), olay("+3h", "duraklat", toplu="T1"),
   olay("+3h30m", "cari", id="ZK", vadeler=[_v("2026-10-03", 600, True), _v("2026-10-17", 400)]),
   olay("+3h45m", "yine_de_gonder", toplu="T1", cari="ZK", etiket="Y3", hedef="asil"), kontrol("+3h50m", "K2"),
   olay("+4h", "devam", toplu="T1"), kontrol("+4h5m", "K3")],
  {"yeniden.Y1": {"elenen": {}, "alinan": ["ZK"], "oneri": None},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/ZK": "Başarısız"},
   "yeniden.Y2": {"elenen": {}, "alinan": ["ZK"], "oneri": None}, "yeniden.Y3": s23_yanit("ZK"),
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/ZK": "Duraklatıldı"}, "kontroller.K2.toplam_post": 3,
   "kontroller.K3.isler": {"T1/A": "Teslim Edildi", "T1/ZK": "Teslim Edildi"},
   "isler.T1/ZK.degiskenler": ["Zeki Zincir", FIRMA, "17.10.2026", "400,00 TL", SUS7], "isler.T1/ZK.post": 3, "isler.T1/ZK.atlanma_nedeni": None,
   "meta.post": {"A": 1, "ZK": 3}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta_davranis={"mesaj": {"ZK": ["yanitsiz_kabul", {"hata": 131021}, "kabul"]},
                 "kanca": {"T1/ZK": {"1": [["failed", "+5s", {"kod": 131026, "varis": "+2h30m"}]], "*": K_STD}, "*": K_STD}})

S("S23-04-meta-bekletti-beklerken-yeniden-basma-ikinci-denemede-gider", "S23",
  "MK'nın iletisi Sonucu Belirsiz; işteki Yine de Gönder'in iletisi Meta Bekletti (131049); 2. saatte şüpheli kaydı açılır; 4. saatte (2. denemeden önce) asıl işte yeniden Yine de Gönder → "
  "bekleyen iş elle sayılır, Meta Bekletti beklemesi sürer; 24 saat sonraki 2. deneme gönderim anıdır: şüphesiz tutarla (16.10.2026, 250,00 TL) gider (S22-06'daki 'Atlandı' yerine)",
  "S23 (Y15-1/2/3/5) + §7a 14 + Y12-4 + S16 + S17", [A7(),
   cari_h("MK", "Mine Bekletilen", "0549 700 80 90", [_h("2026-09-01", 650, 0)], vadeler=[_v("2026-10-06", 400), _v("2026-10-16", 250)])],
  [baslat("+0s", "T1", ["MK", "A"], sablon="hatirlatma"), olay("+1h", "yine_de_gonder", toplu="T1", cari="MK", etiket="Y1"),
   olay("+2h", "cari", id="MK", vadeler=[_v("2026-10-06", 400, True), _v("2026-10-16", 250)]), kontrol("+3h", "K1"),
   olay("+4h", "yine_de_gonder", toplu="T1", cari="MK", etiket="Y2", hedef="asil"), kontrol("+5h", "K2"), kontrol("+25h5m", "K3")],
  {"yeniden.Y1": {"elenen": {}, "alinan": ["MK"], "oneri": None},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/MK": BEKLETTI}, "yeniden.Y2": s23_yanit("MK"),
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/MK": BEKLETTI}, "kontroller.K2.toplam_post": 3,
   "kontroller.K3.isler": {"T1/A": "Teslim Edildi", "T1/MK": "Teslim Edildi"},
   "isler.T1/MK.degiskenler": ["Mine Bekletilen", FIRMA, "16.10.2026", "250,00 TL", SUS7], "isler.T1/MK.post": 3, "isler.T1/MK.atlanma_nedeni": None,
   "meta.post": {"A": 1, "MK": 3}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta_davranis={"mesaj": {"MK": ["yanitsiz_kabul", "kabul", "kabul"]}, "kanca": {"MK": {"1": [], "2": K49, "3": K_STD}, "*": K_STD}})

S("S23-05-yeniden-basmada-suphesiz-tutar-yok-iki-okuma-ileti-gitmez", "S23",
  "NZ'nin iletisi Sonucu Belirsiz; işteki Yine de Gönder + duraklatma; 2. saatte şüpheli kaydı açılır (öbür kalemin vadesi BUGÜN — şüphesiz gecikmiş yok); 3. saatte asıl işte yeniden "
  "Yine de Gönder: güncelleme 16 (S29 = A, README §21 Y16-3) — şüphesiz tutar yoksa da bekleyen iş elle sayılır (güncelleme 15'teki iki okuma kalktı; ad tarihsel); aynı gün Devam Et: "
  "gönderim anında da şüphesiz tutar yok → 'Atlandı — Gecikmiş Borç Yok', ileti gitmez",
  "S23 (Y15-6) + S29 (Y16-2/3) + S16 + S7A + Y12-2", [A7(),
   cari_h("NZ", "Nur Sıfırlı", "0549 800 90 00", [_h("2026-09-01", 500, 0)], vadeler=[_v("2026-10-08", 350), _v("2026-10-30", 150)])],
  [baslat("+0s", "T1", ["NZ", "A"], sablon="hatirlatma"),
   olay("+1h", "yine_de_gonder", toplu="T1", cari="NZ", etiket="Y1"), olay("+1h", "duraklat", toplu="T1"),
   olay("+2h", "cari", id="NZ", vadeler=[_v("2026-10-08", 350, True), _v("2026-10-30", 150)]),
   olay("+3h", "yine_de_gonder", toplu="T1", cari="NZ", etiket="Y2", hedef="asil"), kontrol("+3h5m", "K1"),
   olay("+4h", "devam", toplu="T1"), kontrol("+4h5m", "K2")],
  {"yeniden.Y1": {"elenen": {}, "alinan": ["NZ"], "oneri": None},
   "yeniden.Y2": s23_yanit("NZ"),
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/NZ": "Duraklatıldı"}, "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/NZ": "Atlandı"},
   "isler.T1/NZ.durum": "Atlandı", "isler.T1/NZ.atlanma_nedeni": "gecikmis_borc_yok", "isler.T1/NZ.post": 1,
   "meta.post": {"A": 1, "NZ": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(1)}}},
  meta_davranis=_bel("NZ"))


# ======================================================================== kâhin güncellemesi 15 (2.5.0, KULLANICI KARARI 05.11.2026 ~16:48 S-W3 "1 yıl + anonim iz" — README §20)
# Elle beklenen YALNIZ karar metninden (kahin.KARARLAR SW3) ve README §20.3 yorumlarından (kodlamadan önce yazıldı, ayrı commit). Yeni olay `kvkk_sil {id}` (silme talebi); yeni denetim
# seçeneği `kontrol {icerik: true}` (işlerin o anki içerik görünümü); yeni çıktı alanı isler.<iş>.icerik_silindi (yalnız silinmiş işte). 1 yıl = işin son gönderim denemesinden 1 takvim yılı
# (yerel an); senaryoların yılında 29 Şubat yok. Denetimler sınırdan ±1–2 saat (başlangıç okumaları — açılış / deneme / teslim — aralarında saniyeler).
SIL = {"telefon": None, "degiskenler": None, "pdf": None, "dosya_adi": None, "icerik_silindi": True}
SW3S = ("silme talebinden ÖNCE alınmış yedek geri yüklenince silinen içerik / telefon / PDF'in geri gelip gelmediği (talebin yeniden uygulanması) karar metninde yok "
        "(README §20.5 S-W3-c, KVKK — kime / kaç kez değil)")
PS3 = {"plan_susuyor": SW3S}
T0_KASIM = "2026-11-02T10:00:00+03:00"
DON_27 = "01.10.2027 – 31.10.2027"
DON_KASIM = "01.11.2026 – 30.11.2026"


def kontrol_ic(t, ad):
    return {"t": t, "tur": "kontrol", "ad": ad, "icerik": True}


def _ek(ad, tel, donem_metni_, bas, son, devir, hareket, sonu, tutar):
    return {"telefon": tel, "degiskenler": [ad, FIRMA, donem_metni_, tutar],
            "pdf": {"cari_ad": ad, "donem_bas": bas, "donem_son": son, "devir": devir, "hareket_sayisi": hareket, "donem_sonu_bakiye": sonu},
            "dosya_adi": {"on_ek": f"Ekstre {ad} ", "son_ek": ".pdf"}}


A_EKIM = _ek("Ayşe Yılmaz", "+905321112233", DON, "2026-10-01", "2026-10-31", "1000.00", 2, "1250.00", "1.250,00 TL")
B_EKIM = _ek("Mehmet Kaya", "+905332223344", DON, "2026-10-01", "2026-10-31", "0.00", 1, "2000.00", "2.000,00 TL")
B_EKIM27 = _ek("Mehmet Kaya", "+905332223344", DON_27, "2027-10-01", "2027-10-31", "2000.00", 0, "2000.00", "2.000,00 TL")
A_KASIM = _ek("Ayşe Yılmaz", "+905321112233", DON_KASIM, "2026-11-01", "2026-11-30", "1250.00", 0, "1250.00", "1.250,00 TL")
B_KASIM = _ek("Mehmet Kaya", "+905332223344", DON_KASIM, "2026-11-01", "2026-11-30", "2000.00", 0, "2000.00", "2.000,00 TL")
DO = "daha_once_gonderildi"

S("SW3-01-bir-yil-siniri-iki-yani-sure-dolunca-ayni-donem-daha-once-gonderildi", "SW3",
  "02.11.2026 10:00 'Geçen Ay' (Ekim) ekstresi A ve B'ye gider; 1 yıl dolmadan 2 saat önce içerik / telefon / PDF durur, 2 saat sonra silinmiştir (iş durumu kalır); süre dolduktan sonra "
  "aynı dönem (özel 01.10.2026 – 31.10.2026) yeniden gönderim denemesinde ikisi de anonim izle 'Daha Önce Gönderildi' (uyarıdaki son tarih 02.11.2026), toplu iş oluşmaz; R3 'Yine de "
  "Gönder' ile A'ya gider (İLKEYLE G0 4); sonraki dönem (Ekim 2027) B'ye uyarısız gider",
  "SW3 (Y15-10/11/12/13) + P6 §3 madde 6 + R3 + D4 + G0 (3, 4)", [A(), B()],
  [baslat("+0s", "T1", "AB", donem=GECEN_AY), kontrol_ic("+364d22h", "K1"), kontrol_ic("+365d2h", "K2"),
   baslat("+365d3h", "T2", "AB", donem=EKIM), baslat("+365d4h", "T3", "A", donem=EKIM, onceki="gonder"), baslat("+365d5h", "T4", "B", donem=GECEN_AY),
   kontrol_ic("+365d6h", "K3")],
  {"kontroller.K1.icerik": {"T1/A": A_EKIM, "T1/B": B_EKIM}, "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Teslim Edildi"},
   "kontroller.K2.icerik": {"T1/A": SIL, "T1/B": SIL}, "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/B": "Teslim Edildi"},
   "elenen": {"T2": {"A": DO, "B": DO}}, "olusmadi": ["T2"],
   "onceki_uyari": {"T2": {"sayi": 2, "son": "2026-11-02"}, "T3": {"sayi": 1, "son": "2026-11-02"}},
   "kontroller.K3.icerik": {"T1/A": SIL, "T1/B": SIL, "T3/A": A_EKIM, "T4/B": B_EKIM27},
   "isler.T1/A.durum": "Teslim Edildi", "isler.T1/A.icerik_silindi": True, "isler.T1/A.telefon": None, "isler.T3/A.durum": "Teslim Edildi", "isler.T4/B.durum": "Teslim Edildi",
   "meta.post": {"A": 2, "B": 2}, "bu_ay": {"W1": {"2026-11": ay_kova(2), "2027-11": ay_kova(2)}}},
  baslangic=T0_KASIM, bitis="+366d", meta_davranis={"kanca": {"*": K_STD}})

S("SW3-02-gece-yarisi-yerel-gun-utc-farkli-bir-yil-siniri", "SW3",
  "01.11.2026 00:30 yerel (UTC'de 31.10 21:30) 'Geçen Ay' ekstresi A'ya gider; 31.10.2027 23:30 yerel (sınırdan 1 saat önce) içerik durur, 01.11.2027 01:30 yerel (sınırdan 1 saat sonra — "
  "UTC'de iki denetim de 31.10) silinmiştir; sonra aynı dönem (özel Ekim 2026) 'Daha Önce Gönderildi' (son 01.11.2026, yerel gün), sonraki dönem (Ekim 2027) gider; 'Bu Ay' Türkiye saatiyle",
  "SW3 (Y15-13) + H4 + §7a 19", [A()],
  [baslat("+0s", "T1", "A", donem=GECEN_AY), kontrol_ic("+364d23h", "K1"), kontrol_ic("+365d1h", "K2"),
   baslat("+365d1h30m", "T2", "A", donem=EKIM), baslat("+365d2h", "T3", "A", donem=GECEN_AY)],
  {"kontroller.K1.icerik": {"T1/A": A_EKIM}, "kontroller.K1.t": "2027-10-31T23:30:00+03:00",
   "kontroller.K2.icerik": {"T1/A": SIL}, "kontroller.K2.t": "2027-11-01T01:30:00+03:00",
   "elenen": {"T2": {"A": DO}}, "olusmadi": ["T2"], "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-11-01"}},
   "isler.T3/A.degiskenler": ["Ayşe Yılmaz", FIRMA, DON_27, "1.250,00 TL"], "isler.T1/A.icerik_silindi": True,
   "meta.post": {"A": 2}, "bu_ay": {"W1": {"2026-11": ay_kova(1), "2027-11": ay_kova(1)}}},
  baslangic="2026-11-01T00:30:00+03:00", bitis="+365d3h", meta_davranis={"kanca": {"*": K_STD}})

S("SW3-03-silme-talebi-ayni-donem-elenir-sonraki-donem-gider-silinen-telefon-kullanilmaz", "SW3",
  "A, B, C'ye Ekim ekstresi gider; 1. saatte A ve C silme talebinde bulunur (C'nin kartındaki telefon da silinir): A ve C'nin içerik / telefon / PDF'i hemen silinir, B'ninki durur; aynı "
  "dönem yeni gönderimde A ve B anonim izle 'Daha Önce Gönderildi', C 'Telefonsuz' (silinen telefon kullanılmaz), toplu iş oluşmaz; R3 'Yine de Gönder' ile A'ya yeni içerikle gider; "
  "sonraki dönem (Kasım) A ve B'ye gider, C yine 'Telefonsuz'; 'Bu Ay' düşmez (Kasım 4, Aralık 2)",
  "SW3 (Y15-10/11/12/15/16/17) + P6 §3 madde 6 + §7a 6 + R3 + J5 + R3T (Y20-14: uyarı sayısı 3 — telefonsuz C de sayılır)", [A(), B(), C()],
  [baslat("+0s", "T1", "ABC", donem=GECEN_AY),
   olay("+1h", "kvkk_sil", id="A"), olay("+1h", "kvkk_sil", id="C"), olay("+1h", "cari", id="C", telefon=None), kontrol_ic("+1h30m", "K1"),
   baslat("+2h", "T2", "ABC", donem=GECEN_AY), baslat("+3h", "T3", "A", donem=GECEN_AY, onceki="gonder"),
   baslat("+29d", "T4", "ABC", donem=GECEN_AY), kontrol_ic("+29d1h", "K2")],
  {"kontroller.K1.icerik": {"T1/A": SIL, "T1/B": B_EKIM, "T1/C": SIL},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Teslim Edildi", "T1/C": "Teslim Edildi"},
   "elenen": {"T2": {"A": DO, "B": DO, "C": "telefonsuz"}, "T4": {"C": "telefonsuz"}}, "olusmadi": ["T2"],
   "onceki_uyari": {"T2": {"sayi": 3, "son": "2026-11-02"}, "T3": {"sayi": 1, "son": "2026-11-02"}},   # güncelleme 20 R3T: 2 → 3 (telefonsuz C de sayılır)
   "kontroller.K2.icerik": {"T1/A": SIL, "T1/B": B_EKIM, "T1/C": SIL, "T3/A": A_EKIM, "T4/A": A_KASIM, "T4/B": B_KASIM},
   "isler.T1/A.icerik_silindi": True, "isler.T1/C.icerik_silindi": True, "isler.T1/B.telefon": "+905332223344",
   "meta.post": {"A": 3, "B": 2, "C": 1}, "bu_ay": {"W1": {"2026-11": ay_kova(4), "2026-12": ay_kova(2)}}},
  baslangic=T0_KASIM, bitis="+30d", meta_davranis={"kanca": {"*": K_STD}})

S("SW3-04-geri-yukleme-bir-yildan-eski-icerik-donunce-silinir", "SW3",
  "A'ya Ekim ekstresi gider, 1. saatte yedek alınır; 1 yıl dolunca içerik silinir; 1 yıl 2 saatte o yedek geri yüklenir: dönen işin içeriği 1 yıldan eski olduğu için DÖNDÜĞÜ ANDA silinir "
  "(ilke 5); aynı dönem yeni gönderimde 'Daha Önce Gönderildi' (dosyadaki / defterdeki iz)",
  "SW3 (Y15-13/18) + G0 (5) + D7 + §7a 26", [A()],
  [baslat("+0s", "T1", "A", donem=GECEN_AY), olay("+1h", "yedek_al", ad="Y0"), kontrol_ic("+365d1h", "K1"),
   olay("+365d2h", "geri_yukle", yedek="Y0"), kontrol_ic("+365d2h", "K2"), baslat("+365d3h", "T2", "A", donem=EKIM)],
  {"kontroller.K1.icerik": {"T1/A": SIL}, "kontroller.K2.icerik": {"T1/A": SIL}, "kontroller.K2.isler": {"T1/A": "Teslim Edildi"},
   "elenen": {"T2": {"A": DO}}, "olusmadi": ["T2"], "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-11-02"}},
   "isler.T1/A.icerik_silindi": True, "meta.post": {"A": 1}, "bu_ay": {"W1": {"2026-11": ay_kova(1)}}},
  baslangic=T0_KASIM, bitis="+366d", meta_davranis={"kanca": {"*": K_STD}})

S("SW3-05-silme-talebinden-once-alinan-yedek-geri-yuklenir-icerik-susuyor-r3-kesin", "SW3",
  "A ve B'ye Ekim ekstresi gider; 1. saatte yedek alınır, 2. saatte A silme talebinde bulunur (içerik silinir); 3. saatte talepten ÖNCEKİ yedek geri yüklenir: güncelleme 16 (S32 = A, "
  "README §21 Y16-21) — talep makinede kayıtlı, geri yüklemeden sonra yeniden uygulanır → A'nın içeriği / telefonu GELMEZ (güncelleme 15'te denetlenmiyordu; ad tarihsel), B'ninki durur; "
  "aynı dönem yeni gönderimde A ve B 'Daha Önce Gönderildi', R3 'Yine de Gönder' ile A'ya yeni içerikle gider; 'Bu Ay' düşmez",
  "SW3 (Y15-12/17/18) + S32 (Y16-21) + G0 (4, 5) + D7 + J5", [A(), B()],
  [baslat("+0s", "T1", "AB", donem=GECEN_AY), olay("+1h", "yedek_al", ad="Y0"), olay("+2h", "kvkk_sil", id="A"), kontrol_ic("+2h30m", "K1"),
   olay("+3h", "geri_yukle", yedek="Y0"), kontrol_ic("+3h30m", "K2"),
   baslat("+4h", "T2", "AB", donem=GECEN_AY), baslat("+5h", "T3", "A", donem=GECEN_AY, onceki="gonder"), kontrol_ic("+6h", "K3")],
  {"kontroller.K1.icerik": {"T1/A": SIL, "T1/B": B_EKIM},
   "kontroller.K2.icerik": {"T1/A": SIL, "T1/B": B_EKIM},
   "elenen": {"T2": {"A": DO, "B": DO}}, "olusmadi": ["T2"],
   "onceki_uyari": {"T2": {"sayi": 2, "son": "2026-11-02"}, "T3": {"sayi": 1, "son": "2026-11-02"}},
   "kontroller.K3.icerik.T3/A": A_EKIM, "isler.T1/A.durum": "Teslim Edildi",
   "meta.post": {"A": 2, "B": 1}, "bu_ay": {"W1": {"2026-11": ay_kova(3)}}},
  baslangic=T0_KASIM, bitis="+1d", meta_davranis={"kanca": {"*": K_STD}})


# ======================================================================== kâhin güncellemesi 16 (2.5.0, KULLANICI KARARI 06.11.2026 06:52 UTC "a": S29–S32 hepsi A — README §21)
# Elle beklenen YALNIZ karar metinlerinden (kahin.KARARLAR S29, S30, S31, S32) ve README §21.2–21.5 yorumlarından (kodlamadan önce yazıldı, ayrı commit). Yeni atlanma nedenleri silme_talebi /
# saklama_suresi (S30), yeni elenme nedeni icerik_silindi (S31); yeni olay / girdi alanı YOK. Güncelleme 16'da S30'un kapanma anı iki okumaydı (`s30_an`, ara denetimde `secenek`);
# güncelleme 17'de S35 = A (README §22 Y17-7): bekleyen iş talep / 1 yıl dolumu ANINDA "Atlandı" — S30-01 / 02 / 03'ün ara denetimleri kesinleşti (G3; açıklamalardaki "secenek" tarihsel).
IS = "icerik_silindi"


# ---- S29: S23 yeniden basmasında şüphesiz tutar yoktu, gönderim anına kadar doğdu → gönderim anındaki şüphesiz tutarla gider (bekleyen iş elle sayılır) ----
S("S29-01-yeniden-basmada-tutar-yok-ertesi-gun-devam-et-gonderim-anindaki-tutarla-gider", "S29",
  "NZ2 ve NY'nin iletisi Sonucu Belirsiz; 1. saatte işteki Yine de Gönder (kayıt yok) + duraklatma; 2. saatte ikisinin şüpheli kaydı açılır; 3. saatte asıl işte yeniden Yine de Gönder: "
  "şüphesiz tutar YOK (NZ2'nin öbür kalemi bugün vadeli, NY'ninki 20.11'de) → ikisi de elle sayılır; ertesi gün Devam Et: NZ2'nin 30.10 kalemi artık gecikmiş → gönderim anındaki tutarla "
  "(30.10.2026, 150,00 TL = şüphesiz net 500 − 350) gider; NY'de gönderim anında da tutar yok → 'Atlandı — Gecikmiş Borç Yok'",
  "S29 (Y16-1/2/4) + S23 + S17 + S7A + Y12-2", [A7(),
   cari_h("NZ2", "Nil Ertesi", "0546 100 20 30", [_h("2026-09-01", 500, 0)], vadeler=[_v("2026-10-08", 350), _v("2026-10-30", 150)]),
   cari_h("NY", "Necla Yok", "0546 200 30 40", [_h("2026-09-01", 400, 0)], vadeler=[_v("2026-10-09", 250), _v("2026-11-20", 150)])],
  [baslat("+0s", "T1", ["NZ2", "NY", "A"], sablon="hatirlatma"),
   olay("+1h", "yine_de_gonder", toplu="T1", cari="NZ2", etiket="Y1"), olay("+1h", "yine_de_gonder", toplu="T1", cari="NY", etiket="Y2"), olay("+1h", "duraklat", toplu="T1"),
   olay("+2h", "cari", id="NZ2", vadeler=[_v("2026-10-08", 350, True), _v("2026-10-30", 150)]), olay("+2h", "cari", id="NY", vadeler=[_v("2026-10-09", 250, True), _v("2026-11-20", 150)]),
   olay("+3h", "yine_de_gonder", toplu="T1", cari="NZ2", etiket="Y3", hedef="asil"), olay("+3h", "yine_de_gonder", toplu="T1", cari="NY", etiket="Y4", hedef="asil"),
   kontrol("+3h5m", "K1"), olay("+24h", "devam", toplu="T1"), kontrol("+24h5m", "K2")],
  {"elenen": {}, "olusmadi": [],
   "yeniden.Y1": {"elenen": {}, "alinan": ["NZ2"], "oneri": None}, "yeniden.Y2": {"elenen": {}, "alinan": ["NY"], "oneri": None},
   "yeniden.Y3": s23_yanit("NZ2"), "yeniden.Y4": s23_yanit("NY"),
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/NY": "Duraklatıldı", "T1/NZ2": "Duraklatıldı"}, "kontroller.K1.toplam_post": 3,
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/NY": "Atlandı", "T1/NZ2": "Teslim Edildi"},
   "isler.T1/NZ2.degiskenler": ["Nil Ertesi", FIRMA, "30.10.2026", "150,00 TL", SUS7], "isler.T1/NZ2.post": 2, "isler.T1/NZ2.atlanma_nedeni": None,
   "isler.T1/NY.durum": "Atlandı", "isler.T1/NY.atlanma_nedeni": "gecikmis_borc_yok", "isler.T1/NY.post": 1,
   "toplular.T1.is_sayisi": 3, "meta.post": {"A": 1, "NY": 1, "NZ2": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta_davranis=_bel("NZ2", "NY"))

S("S29-02-gece-yarisi-yerel-gun-tutar-dogar-utc-gunu-farkli", "S29",
  "31.10 23:30 (yerel): GN'nin iletisi Sonucu Belirsiz; 23:35 Yine de Gönder + duraklatma; 23:40 şüpheli kaydı açılır; 23:45 yeniden Yine de Gönder: 31.10 kalemi henüz gecikmiş değil → "
  "tutar yok, elle sayılır; 01.11 00:10 yerel (UTC'de hâlâ 31.10) Devam Et: YEREL güne göre 31.10 kalemi gecikmiş → 31.10.2026 / 200,00 TL ile gider; 'Bu Ay' Türkiye saatiyle (Ekim 1 + Kasım 1)",
  "S29 (Y16-2/4) + S23 + Y14-9 + §7a 19, 20", [A7(),
   cari_h("GN", "Gece Nur", "0546 300 40 50", [_h("2026-09-01", 600, 0)], vadeler=[_v("2026-10-05", 400), _v("2026-10-31", 200)])],
  [baslat("+0s", "T1", ["GN", "A"], sablon="hatirlatma"),
   olay("+5m", "yine_de_gonder", toplu="T1", cari="GN", etiket="Y1"), olay("+5m", "duraklat", toplu="T1"),
   olay("+10m", "cari", id="GN", vadeler=[_v("2026-10-05", 400, True), _v("2026-10-31", 200)]),
   olay("+15m", "yine_de_gonder", toplu="T1", cari="GN", etiket="Y2", hedef="asil"), kontrol("+20m", "K1"),
   olay("+40m", "devam", toplu="T1"), kontrol("+45m", "K2")],
  {"elenen": {}, "yeniden.Y1": {"elenen": {}, "alinan": ["GN"], "oneri": None}, "yeniden.Y2": s23_yanit("GN"),
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/GN": "Duraklatıldı"}, "kontroller.K1.t": "2026-10-31T23:50:00+03:00",
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/GN": "Teslim Edildi"}, "kontroller.K2.t": "2026-11-01T00:15:00+03:00",
   "isler.T1/GN.degiskenler": ["Gece Nur", FIRMA, "31.10.2026", "200,00 TL", SUS7], "isler.T1/GN.post": 2, "isler.T1/GN.atlanma_nedeni": None,
   "isler.T1/A.degiskenler": A_HAT, "meta.post": {"A": 1, "GN": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(1), "2026-11": ay_kova(1)}}},
  baslangic="2026-10-31T23:30:00+03:00", meta_davranis=_bel("GN"))

S("S29-03-meta-bekletti-ikinci-denemede-tutar-dogar-net-borcla-sinirli", "S29",
  "MZ'nin iletisi Sonucu Belirsiz; işteki Yine de Gönder'in iletisi Meta Bekletti (131049); 2. saatte şüpheli kaydı açılır; 4. saatte yeniden Yine de Gönder: 30.10 kalemi bugün vadeli → "
  "şüphesiz tutar yok, elle sayılır, Meta Bekletti beklemesi sürer; 24 saat sonraki 2. deneme gönderim anıdır: 30.10 kalemi (300) gecikmiş, şüphesiz net borç 900 − 300 (tahsilat) − 400 "
  "(şüpheli) = 200 → 30.10.2026 / 200,00 TL ile gider (S17 gönderim anında)",
  "S29 (Y16-2/4) + S23 + S17 (Y13-8) + NB5 + §7a 14", [A7(),
   cari_h("MZ", "Mert Bekleme", "0546 400 50 60", [_h("2026-09-01", 900, 0), _h("2026-10-29", 0, 300)], vadeler=[_v("2026-10-06", 400), _v("2026-10-30", 300)])],
  [baslat("+0s", "T1", ["MZ", "A"], sablon="hatirlatma"), olay("+1h", "yine_de_gonder", toplu="T1", cari="MZ", etiket="Y1"),
   olay("+2h", "cari", id="MZ", vadeler=[_v("2026-10-06", 400, True), _v("2026-10-30", 300)]), kontrol("+3h", "K1"),
   olay("+4h", "yine_de_gonder", toplu="T1", cari="MZ", etiket="Y2", hedef="asil"), kontrol("+5h", "K2"), kontrol("+26h", "K3")],
  {"yeniden.Y1": {"elenen": {}, "alinan": ["MZ"], "oneri": None},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/MZ": BEKLETTI}, "yeniden.Y2": s23_yanit("MZ"),
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/MZ": BEKLETTI}, "kontroller.K2.toplam_post": 3,
   "kontroller.K3.isler": {"T1/A": "Teslim Edildi", "T1/MZ": "Teslim Edildi"},
   "isler.T1/MZ.degiskenler": ["Mert Bekleme", FIRMA, "30.10.2026", "200,00 TL", SUS7], "isler.T1/MZ.post": 3, "isler.T1/MZ.atlanma_nedeni": None,
   "meta.post": {"A": 1, "MZ": 3}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta_davranis={"mesaj": {"MZ": ["yanitsiz_kabul", "kabul", "kabul"]}, "kanca": {"MZ": {"1": [], "2": K49, "3": K_STD}, "*": K_STD}})

S("S29-04-sinirda-yeni-gecikmis-kalem-eklenir-kayit-kapanirsa-butun-gecikmisle", "S29",
  "Günlük sınır 1: SQ ve SK'nin iletisi Sonucu Belirsiz, A gider; 1. saatte ikisine işteki Yine de Gönder → sınırda bekler; 2. saatte şüpheli kayıtları açılır (SQ'nun tek kalemi şüpheliye); "
  "3. saatte ikisine yeniden Yine de Gönder: şüphesiz tutar yok → elle sayılır; 4. saatte SQ'ya eski vadeli yeni fatura (20.10, 200) girer; 5. saatte SK'nin icra tahsili kaydı kapatır; "
  "pencere açılınca SQ gönderim anındaki tutarla (20.10.2026, 200,00 TL = 700 − 500), ertesi gün SK kayıt kapalı → bütün gecikmişiyle ve güncel bakiyeyle (30.10.2026, 150,00 TL, 150,00 TL) gider",
  "S29 (Y16-2/4/5) + S23 + Y12-7 + S17 + NB5", [A7(),
   cari_h("SQ", "Sena Yeni", "0546 500 60 70", [_h("2026-09-01", 500, 0)], vadeler=[_v("2026-10-07", 500)]),
   cari_h("SK", "Sarp Kapanan", "0546 600 70 80", [_h("2026-09-01", 450, 0)], vadeler=[_v("2026-10-08", 300), _v("2026-10-30", 150)])],
  [baslat("+0s", "T1", ["SQ", "SK", "A"], sablon="hatirlatma"),
   olay("+1h", "yine_de_gonder", toplu="T1", cari="SQ", etiket="Y1"), olay("+1h", "yine_de_gonder", toplu="T1", cari="SK", etiket="Y2"), kontrol("+1h30m", "K1"),
   olay("+2h", "cari", id="SQ", vadeler=[_v("2026-10-07", 500, True)]), olay("+2h", "cari", id="SK", vadeler=[_v("2026-10-08", 300, True), _v("2026-10-30", 150)]),
   olay("+3h", "yine_de_gonder", toplu="T1", cari="SQ", etiket="Y3", hedef="asil"), olay("+3h", "yine_de_gonder", toplu="T1", cari="SK", etiket="Y4", hedef="asil"),
   olay("+4h", "cari", id="SQ", vadeler=[_v("2026-10-07", 500, True), _v("2026-10-20", 200)], hareket_ekle=_h("2026-10-20", 200, 0)),
   olay("+5h", "cari", id="SK", vadeler=[_v("2026-10-08", 0, True), _v("2026-10-30", 150)], hareket_ekle=_h("2026-10-30", 0, 300)),
   kontrol("+6h", "K2"), kontrol("+25h", "K3")],
  {"elenen": {}, "yeniden.Y1": {"elenen": {}, "alinan": ["SQ"], "oneri": None}, "yeniden.Y2": {"elenen": {}, "alinan": ["SK"], "oneri": None},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/SK": SINIR_B, "T1/SQ": SINIR_B},
   "yeniden.Y3": s23_yanit("SQ"), "yeniden.Y4": s23_yanit("SK"),
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/SK": SINIR_B, "T1/SQ": SINIR_B},
   "kontroller.K3.isler": {"T1/A": "Teslim Edildi", "T1/SK": SINIR_B, "T1/SQ": "Teslim Edildi"},
   "isler.T1/SQ.degiskenler": ["Sena Yeni", FIRMA, "20.10.2026", "200,00 TL", SUS7], "isler.T1/SQ.post": 2,
   "isler.T1/SK.durum": "Teslim Edildi", "isler.T1/SK.degiskenler": ["Sarp Kapanan", FIRMA, "30.10.2026", "150,00 TL", "150,00 TL"], "isler.T1/SK.post": 2,
   "meta.post": {"A": 1, "SK": 2, "SQ": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(2), "2026-11": ay_kova(1)}}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis=_bel("SQ", "SK"))


# ---- S30: silme talebi / 1 yıl dolumu anında bekleyen iş gönderilmez (telefon / içerik silindi); Sonucu Belirsiz izi kalır (aynı dönem elenir) ----
S("S30-01-talep-duraklatildi-meta-bekletti-zincir-gonderilmez-belirsiz-iz-eler", "S30",
  "Ekim ekstresi: A gider, E'ninki Sonucu Belirsiz; B'nin işi hemen duraklatılır (hiç gitmedi); D'ninki Meta Bekletti (131049); 1. saatte E'ye işteki Yine de Gönder + duraklatma (zincir); "
  "2. saatte B, D, E silme talebinde bulunur → üç bekleyen iş GÖNDERİLMEZ (içerik / telefon silinir; güncelleme 17 — S35 = A: talep ANINDA 'Atlandı — Silme Talebi'); Devam Et ve 24 saat "
  "sonra da Atlandı (silme_talebi), POST yok; ertesi gün aynı dönem yeni gönderimde B ve D gider (karttaki telefonla, yeni içerikle; Meta Bekletti iletisi sayılmaz — K7), E belirsiz izle "
  "'Sonucu Belirsiz' (D6); E'nin asıl işinde Yine de Gönder içeriği silinmiş Ekstre için kapalı (S31)",
  "S30 (Y16-8/9/10/12/13) + S35 (Y17-7) + S31 (Y16-17) + D1 + D6 + K7 + G0 (1, 2)", [A(), B(), D(), E()],
  [baslat("+0s", "T1", "AE"), baslat("+0s", "T2", "B"), olay("+0s", "duraklat", toplu="T2"), baslat("+0s", "T3", "D"),
   olay("+1h", "yine_de_gonder", toplu="T1", cari="E", etiket="Y1"), olay("+1h", "duraklat", toplu="T1"), kontrol("+1h30m", "K1"),
   olay("+2h", "kvkk_sil", id="B"), olay("+2h", "kvkk_sil", id="D"), olay("+2h", "kvkk_sil", id="E"), kontrol_ic("+2h30m", "K2"),
   olay("+3h", "devam", toplu="T1"), olay("+3h", "devam", toplu="T2"), kontrol("+26h", "K3"),
   baslat("+27h", "T4", "BDE"), olay("+28h", "yine_de_gonder", toplu="T1", cari="E", etiket="Y2", hedef="asil"), kontrol_ic("+29h", "K4")],
  {"yeniden.Y1": {"elenen": {}, "alinan": ["E"], "oneri": None},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/E": "Duraklatıldı", "T2/B": "Duraklatıldı", "T3/D": BEKLETTI},
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/E": "Atlandı", "T2/B": "Atlandı", "T3/D": "Atlandı"},
   "kontroller.K2.icerik": {"T1/A": A_EKIM, "T1/E": SIL, "T2/B": SIL, "T3/D": SIL},
   "kontroller.K3.isler": {"T1/A": "Teslim Edildi", "T1/E": "Atlandı", "T2/B": "Atlandı", "T3/D": "Atlandı"},
   "elenen": {"T4": {"E": "sonucu_belirsiz"}}, "olusmadi": [], "onceki_uyari": {}, "toplular.T4.is_sayisi": 2,
   "yeniden.Y2": {"elenen": {"E": IS}, "alinan": [], "oneri": None},
   "isler.T1/E.atlanma_nedeni": "silme_talebi", "isler.T2/B.atlanma_nedeni": "silme_talebi", "isler.T3/D.atlanma_nedeni": "silme_talebi",
   "isler.T1/E.post": 1, "isler.T2/B.post": 0, "isler.T3/D.post": 1, "isler.T1/E.icerik_silindi": True, "isler.T2/B.icerik_silindi": True,
   "kontroller.K4.icerik.T4/B": B_EKIM, "kontroller.K4.icerik.T4/D": _ek("Hasan Çelik", "+905354445566", DON, "2026-10-01", "2026-10-31", "0.00", 1, "750.00", "750,00 TL"),
   "isler.T4/B.durum": "Teslim Edildi", "isler.T4/D.durum": "Teslim Edildi",
   "meta.post": {"A": 1, "B": 1, "D": 2, "E": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(3)}}},
  meta_davranis={"mesaj": {"E": ["yanitsiz_kabul", "kabul"]}, "kanca": {"T1/E": {"1": [], "*": K_STD}, "T3/D": {"1": K49, "*": K_STD}, "*": K_STD}})

S("S30-02-talep-sinir-lisans-gonderilmez-belirsiz-hatirlatma-ayni-gun-elenir-ertesi-gun-gider", "S30",
  "Ödeme Hatırlatma, günlük sınır 2: BE'nin iletisi Sonucu Belirsiz, A ve XN gider, SB ve LS sınırda bekler; 1. saatte SB (Sınır) ve BE (Sonucu Belirsiz) silme talebinde bulunur; 2. saatte "
  "lisans salt okunur (LS 'Lisans Nedeniyle Durdu'), 3. saatte LS silme talebinde bulunur; SB ve LS GÖNDERİLMEZ (silme_talebi — güncelleme 17, S35 = A: talep ANINDA Atlandı); BE iş Sonucu "
  "Belirsiz kalır, içeriği silinir; aynı gün yeni gönderimde BE 'Sonucu Belirsiz' ile elenir (E3), SB ve LS yeni işle (karttaki telefonla) sınır açılınca gider; ertesi gün BE uyarısız gider",
  "S30 (Y16-9/10/13) + S35 (Y17-7) + E3 + D1 + §7a 25 + G0 (1, 2, 4)", [A7(),
   cari_h("BE", "Betül Belirsiz", "0543 100 20 30", [_h("2026-09-01", 300, 0)], vadeler=[_v("2026-10-10", 300)]),
   cari_h("XN", "Ece Normal", "0543 200 30 40", [_h("2026-09-01", 250, 0)], vadeler=[_v("2026-10-12", 250)]),
   cari_h("SB", "Selim Sınırda", "0543 300 40 50", [_h("2026-09-01", 400, 0)], vadeler=[_v("2026-10-11", 400)]),
   cari_h("LS", "Leyla Lisans", "0543 400 50 60", [_h("2026-09-01", 350, 0)], vadeler=[_v("2026-10-13", 350)])],
  [baslat("+0s", "T1", ["BE", "A", "XN", "SB", "LS"], sablon="hatirlatma"), kontrol("+30m", "K0"),
   olay("+1h", "kvkk_sil", id="SB"), olay("+1h", "kvkk_sil", id="BE"), olay("+2h", "lisans", yazilabilir=False), olay("+3h", "kvkk_sil", id="LS"),
   kontrol_ic("+3h30m", "K1"), olay("+4h", "lisans", yazilabilir=True), olay("+5h", "devam", toplu="T1"), kontrol("+5h5m", "K2"),
   baslat("+6h", "T2", ["BE", "SB", "LS"], sablon="hatirlatma"), baslat("+50h", "T3", ["BE"], sablon="hatirlatma")],
  {"kontroller.K0.isler": {"T1/A": "Teslim Edildi", "T1/BE": "Sonucu Belirsiz", "T1/LS": SINIR_B, "T1/SB": SINIR_B, "T1/XN": "Teslim Edildi"},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/BE": "Sonucu Belirsiz", "T1/LS": "Atlandı", "T1/SB": "Atlandı", "T1/XN": "Teslim Edildi"},
   "kontroller.K1.icerik.T1/BE": SIL, "kontroller.K1.icerik.T1/SB": SIL, "kontroller.K1.icerik.T1/LS": SIL,
   "kontroller.K1.icerik.T1/XN": {"telefon": "+905432003040", "degiskenler": ["Ece Normal", FIRMA, "12.10.2026", "250,00 TL", "250,00 TL"], "pdf": None, "dosya_adi": None},
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/BE": "Sonucu Belirsiz", "T1/LS": "Atlandı", "T1/SB": "Atlandı", "T1/XN": "Teslim Edildi"},
   "isler.T1/SB.atlanma_nedeni": "silme_talebi", "isler.T1/LS.atlanma_nedeni": "silme_talebi", "isler.T1/SB.post": 0, "isler.T1/LS.post": 0,
   "isler.T1/BE.durum": "Sonucu Belirsiz", "isler.T1/BE.icerik_silindi": True, "isler.T1/BE.telefon": None, "isler.T1/BE.post": 1,
   "elenen": {"T2": {"BE": "sonucu_belirsiz"}}, "olusmadi": [], "toplular.T2.is_sayisi": 2,
   "isler.T2/SB.degiskenler": ["Selim Sınırda", FIRMA, "11.10.2026", "400,00 TL", "400,00 TL"], "isler.T2/SB.durum": "Teslim Edildi",
   "isler.T2/LS.degiskenler": ["Leyla Lisans", FIRMA, "13.10.2026", "350,00 TL", "350,00 TL"], "isler.T2/LS.durum": "Teslim Edildi",
   "isler.T3/BE.degiskenler": ["Betül Belirsiz", FIRMA, "10.10.2026", "300,00 TL", "300,00 TL"], "isler.T3/BE.durum": "Teslim Edildi",
   "meta.post": {"A": 1, "BE": 2, "LS": 1, "SB": 1, "XN": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(4), "2026-11": ay_kova(1)}}},
  ayar={"gunluk_ust_sinir": 2}, meta_davranis={"mesaj": {"BE": ["yanitsiz_kabul", "kabul"]}, "kanca": {"T1/BE": {"1": [], "*": K_STD}, "*": K_STD}})

S("S30-03-bir-yil-dolumu-bekleyen-isler-gonderilmez-belirsiz-iz-eler", "S30",
  "02.11.2026: A'ya Ekim ekstresi gider; B'nin ekstresi ve HC'nin Ödeme Hatırlatma'sı hemen duraklatılır (hiç gitmez; HC'nin içeriği hiç yazılmadı); D'ninki Sonucu Belirsiz; 1 yıl dolmadan "
  "2 saat önce içerikler durur; 1 yıl dolunca bekleyen B ve HC GÖNDERİLMEZ (saklama_suresi — güncelleme 17, S35 = A + Y17-6: dolum ANINDA Atlandı), A ve D'nin içeriği silinir (D Sonucu "
  "Belirsiz kalır); Devam Et'te ikisi Atlandı, POST yok; aynı dönem yeni gönderimde A 'Daha Önce Gönderildi' (iz), D 'Sonucu Belirsiz' (iz), B yeni içerikle gider; HC'ye yeni hatırlatma gider",
  "S30 (Y16-9/10/13/14) + S35 (Y17-6/7) + SW3 (Y15-11/12/13) + D1 + D4 + R3 + G0 (1, 2, 4)", [A(), B(), D(),
   cari_h("HC", "Hilal Cari", "0543 500 60 70", [_h("2026-10-01", 500, 0)], vadeler=[_v("2026-10-15", 500)])],
  [baslat("+0s", "T1", "A", donem=GECEN_AY), baslat("+0s", "T2", "B", donem=GECEN_AY), olay("+0s", "duraklat", toplu="T2"),
   baslat("+0s", "T3", ["HC"], sablon="hatirlatma"), olay("+0s", "duraklat", toplu="T3"), baslat("+0s", "T4", "D", donem=GECEN_AY),
   kontrol_ic("+364d22h", "K1"), kontrol_ic("+365d2h", "K2"), olay("+365d3h", "devam", toplu="T2"), olay("+365d3h", "devam", toplu="T3"), kontrol("+365d4h", "K3"),
   baslat("+365d5h", "T5", "ABD", donem=EKIM), baslat("+365d6h", "T6", ["HC"], sablon="hatirlatma"), kontrol_ic("+365d7h", "K4")],
  {"kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T2/B": "Duraklatıldı", "T3/HC": "Duraklatıldı", "T4/D": "Sonucu Belirsiz"},
   "kontroller.K1.icerik.T1/A": A_EKIM, "kontroller.K1.icerik.T4/D": _ek("Hasan Çelik", "+905354445566", DON, "2026-10-01", "2026-10-31", "0.00", 1, "750.00", "750,00 TL"),
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T2/B": "Atlandı", "T3/HC": "Atlandı", "T4/D": "Sonucu Belirsiz"},
   "kontroller.K2.icerik": {"T1/A": SIL, "T2/B": SIL, "T3/HC": SIL, "T4/D": SIL},
   "kontroller.K3.isler": {"T1/A": "Teslim Edildi", "T2/B": "Atlandı", "T3/HC": "Atlandı", "T4/D": "Sonucu Belirsiz"},
   "isler.T2/B.atlanma_nedeni": "saklama_suresi", "isler.T3/HC.atlanma_nedeni": "saklama_suresi", "isler.T2/B.post": 0, "isler.T3/HC.post": 0,
   "elenen": {"T5": {"A": DO, "D": "sonucu_belirsiz"}}, "olusmadi": [], "onceki_uyari": {"T5": {"sayi": 1, "son": "2026-11-02"}},
   "kontroller.K4.icerik.T5/B": B_EKIM,
   "kontroller.K4.icerik.T6/HC": {"telefon": "+905435006070", "degiskenler": ["Hilal Cari", FIRMA, "15.10.2026", "500,00 TL", "500,00 TL"], "pdf": None, "dosya_adi": None},
   "isler.T4/D.durum": "Sonucu Belirsiz", "isler.T4/D.icerik_silindi": True,
   "meta.post": {"A": 1, "B": 1, "D": 1, "HC": 1}, "bu_ay": {"W1": {"2026-11": ay_kova(1), "2027-11": ay_kova(2)}}},
  baslangic=T0_KASIM, bitis="+366d", meta_davranis={"mesaj": {"D": "yanitsiz_kabul"}, "kanca": {"T4/D": {"1": []}, "*": K_STD}})


# ---- S31: içeriği silinmiş Ekstre işi yeniden gönderilemez (neden görünür); yol yeni Ekstre gönderimi ----
S("S31-01-talep-sonrasi-basarisizlari-yeniden-dene-silinmis-ekstre-elenir-yeni-gonderim-gider", "S31",
  "Ekim ekstresi: A ve B alıcı hatasıyla (131021) Başarısız, C gider; 1. saatte A silme talebinde bulunur (içerik silinir); 2. saatte Başarısızları Yeniden Dene: A 'içerik silindi' nedeniyle "
  "alınmaz (iş Başarısız kalır), B alınır ve gider; 3. saatte aynı dönem yeni Ekstre gönderimi: A'nın Başarısız denemesi sayılmaz → uyarısız, yeni içerikle gider",
  "S31 (Y16-16/17/18) + K3 + SW3 (Y15-16)", [A(), B(), C()],
  [baslat("+0s", "T1", "ABC"), olay("+1h", "kvkk_sil", id="A"), kontrol_ic("+1h30m", "K1"),
   olay("+2h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), kontrol("+2h30m", "K2"), baslat("+3h", "T2", "A"), kontrol_ic("+3h30m", "K3")],
  {"kontroller.K1.icerik.T1/A": SIL, "kontroller.K1.icerik.T1/B": B_EKIM,
   "yeniden.Y1": {"elenen": {"A": IS}, "alinan": ["B"], "oneri": None},
   "kontroller.K2.isler": {"T1/A": "Başarısız", "T1/B": "Teslim Edildi", "T1/C": "Teslim Edildi"},
   "elenen": {}, "olusmadi": [], "onceki_uyari": {}, "kontroller.K3.icerik.T2/A": A_EKIM, "kontroller.K3.icerik.T1/A": SIL,
   "isler.T1/A.durum": "Başarısız", "isler.T1/A.post": 1, "isler.T1/A.icerik_silindi": True, "isler.T2/A.durum": "Teslim Edildi",
   "meta.post": {"A": 2, "B": 2, "C": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(3)}}},
  meta_davranis={"mesaj": {"A": [{"hata": 131021}, "kabul"], "B": [{"hata": 131021}, "kabul"]}, "kanca": {"*": K_STD}})

S("S31-02-bir-yil-sonra-silinmis-ekstre-yeniden-dene-ve-yine-de-gonder-kapali", "S31",
  "02.11.2026 'Geçen Ay' ekstresi: A Başarısız (131021), B Sonucu Belirsiz; 1 yıl dolunca ikisinin içeriği silinir; sonra Başarısızları Yeniden Dene (A) ve işteki Yine de Gönder (B) "
  "'içerik silindi' nedeniyle alınmaz; aynı dönem yeni gönderimde A uyarısız gider, B belirsiz izle 'Sonucu Belirsiz' (S30 — aynı dönemde yol kalmaz, README §21.7 S30-b); sonraki dönem "
  "(Ekim 2027) B'ye gider",
  "S31 (Y16-16/17/18) + S30 (Y16-13) + SW3 (Y15-13) + K3 + D1", [A(), B()],
  [baslat("+0s", "T1", "AB", donem=GECEN_AY), kontrol_ic("+364d22h", "K1"), kontrol_ic("+365d2h", "K2"),
   olay("+365d3h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), olay("+365d3h", "yine_de_gonder", toplu="T1", cari="B", etiket="Y2"),
   baslat("+365d4h", "T2", "AB", donem=EKIM), baslat("+365d5h", "T3", "B", donem=GECEN_AY)],
  {"kontroller.K1.icerik": {"T1/A": A_EKIM, "T1/B": B_EKIM}, "kontroller.K2.icerik": {"T1/A": SIL, "T1/B": SIL},
   "yeniden.Y1": {"elenen": {"A": IS}, "alinan": [], "oneri": None}, "yeniden.Y2": {"elenen": {"B": IS}, "alinan": [], "oneri": None},
   "elenen": {"T2": {"B": "sonucu_belirsiz"}}, "olusmadi": [], "onceki_uyari": {},
   "isler.T1/A.durum": "Başarısız", "isler.T1/B.durum": "Sonucu Belirsiz", "isler.T2/A.degiskenler": ["Ayşe Yılmaz", FIRMA, DON, "1.250,00 TL"],
   "isler.T3/B.degiskenler": ["Mehmet Kaya", FIRMA, DON_27, "2.000,00 TL"], "isler.T3/B.durum": "Teslim Edildi",
   "meta.post": {"A": 2, "B": 2}, "bu_ay": {"W1": {"2027-11": ay_kova(2)}}},
  baslangic=T0_KASIM, bitis="+366d", meta_davranis={"mesaj": {"A": [{"hata": 131021}, "kabul"], "B": ["yanitsiz_kabul", "kabul"]},
                                                   "kanca": {"T1/B": {"1": [], "*": K_STD}, "*": K_STD}})


# ---- S32: silme talebinden önce alınmış yedek geri yüklenince silinmiş içerik / telefon GELMEZ; talepler makinede kalır, geri yüklemeden sonra yeniden uygulanır ----
S("S32-01-talepten-once-ve-sonra-alinan-iki-yedek-icerik-gelmez-sonraki-icerik-kalir", "S32",
  "02.11.2026 A ve B'ye Ekim ekstresi gider; 1. saatte yedek Y0 (talepten ÖNCE); 2. saatte A silme talebinde bulunur; 3. saatte A'ya Kasım ekstresi gider (talepten SONRA yazılan içerik); "
  "4. saatte yedek Y1 (talepten SONRA); 5. saatte Y0 geri yüklenir → talep yeniden uygulanır: A'nın Ekim içeriği / telefonu GELMEZ, B'ninki durur; 6. saatte Y1 geri yüklenir → A'nın Ekim "
  "içeriği silinmiş kalır, talepten sonraki Kasım içeriği DURUR; aynı dönem (Ekim) yeni gönderimde A ve B 'Daha Önce Gönderildi'",
  "S32 (Y16-20/21/22) + SW3 (Y15-12) + D7 + G0 (5)", [A(), B()],
  [baslat("+0s", "T1", "AB", donem=GECEN_AY), olay("+1h", "yedek_al", ad="Y0"), olay("+2h", "kvkk_sil", id="A"),
   baslat("+3h", "T2", "A", donem={"bas": "2026-11-01", "son": "2026-11-30"}), olay("+4h", "yedek_al", ad="Y1"),
   olay("+5h", "geri_yukle", yedek="Y0"), kontrol_ic("+5h", "K1"), olay("+6h", "geri_yukle", yedek="Y1"), kontrol_ic("+6h", "K2"),
   baslat("+7h", "T3", "AB", donem=EKIM)],
  {"kontroller.K1.icerik": {"T1/A": SIL, "T1/B": B_EKIM}, "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Teslim Edildi"},
   "kontroller.K2.icerik": {"T1/A": SIL, "T1/B": B_EKIM, "T2/A": A_KASIM},
   "elenen": {"T3": {"A": DO, "B": DO}}, "olusmadi": ["T3"], "onceki_uyari": {"T3": {"sayi": 2, "son": "2026-11-02"}},
   "isler.T1/A.icerik_silindi": True, "isler.T2/A.durum": "Teslim Edildi", "isler.T2/A.telefon": "+905321112233",
   "meta.post": {"A": 2, "B": 1}, "bu_ay": {"W1": {"2026-11": ay_kova(3)}}},
  baslangic=T0_KASIM, bitis="+1d", meta_davranis={"kanca": {"*": K_STD}})

S("S32-02-talepten-once-yedekte-basarisiz-ve-belirsiz-geri-yukleme-sonrasi-silinmis", "S32",
  "Ekim ekstresi: B gider, C alıcı hatasıyla Başarısız, D Sonucu Belirsiz; 1. saatte yedek; 2. saatte C ve D silme talebinde bulunur; 3. saatte talepten önceki yedek geri yüklenir → "
  "talepler yeniden uygulanır: C ve D'nin içeriği / telefonu GELMEZ (D Sonucu Belirsiz kalır); C'nin Başarısızları Yeniden Dene'si ve D'nin işteki Yine de Gönder'i 'içerik silindi' (S31); "
  "aynı dönem yeni gönderimde C gider (Başarısız sayılmaz), D 'Sonucu Belirsiz' (iz)",
  "S32 (Y16-21/23/24) + S31 + S30 (Y16-13) + K3 + D1", [B(), C(), D()],
  [baslat("+0s", "T1", "BCD"), olay("+1h", "yedek_al", ad="Y0"), olay("+2h", "kvkk_sil", id="C"), olay("+2h", "kvkk_sil", id="D"),
   olay("+3h", "geri_yukle", yedek="Y0"), kontrol_ic("+3h", "K1"),
   olay("+4h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), olay("+4h", "yine_de_gonder", toplu="T1", cari="D", etiket="Y2"),
   baslat("+5h", "T2", "CD")],
  {"kontroller.K1.icerik": {"T1/B": B_EKIM, "T1/C": SIL, "T1/D": SIL},
   "kontroller.K1.isler": {"T1/B": "Teslim Edildi", "T1/C": "Başarısız", "T1/D": "Sonucu Belirsiz"},
   "yeniden.Y1": {"elenen": {"C": IS}, "alinan": [], "oneri": None}, "yeniden.Y2": {"elenen": {"D": IS}, "alinan": [], "oneri": None},
   "elenen": {"T2": {"D": "sonucu_belirsiz"}}, "olusmadi": [], "isler.T2/C.durum": "Teslim Edildi",
   "isler.T2/C.degiskenler": ["Zeynep Demir", FIRMA, DON, "0,00 TL"], "isler.T1/C.post": 1, "isler.T1/D.post": 1,
   "meta.post": {"B": 1, "C": 2, "D": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta_davranis={"mesaj": {"C": [{"hata": 131021}, "kabul"], "D": ["yanitsiz_kabul", "kabul"]}, "kanca": {"T1/D": {"1": [], "*": K_STD}, "*": K_STD}})


# ======================================================================== kâhin güncellemesi 17 (2.5.0, KULLANICI KARARLARI 06.11.2026 08:06 "a" S34–S38 (S37 = B), 07:00 S33, 08:08 S41 — README §22)
# Elle beklenen YALNIZ karar metinlerinden (kahin.KARARLAR S34, S35, S36, S37, S38, S33, S41) ve README §22.2–22.7 yorumlarından (kodlamadan önce yazıldı, ayrı commit). Yeni girdi alanları:
# ayar.baglanti_yolu ("yol1" / "yol2"; yoksa yol2) ve kanca `adres` ("alternatif" / "uygulama"; meta_davranis.kanca öğesinin ek nesnesinde ve sahte_kanca olayında). Yeni olay YOK.
C_EKIM = _ek("Zeynep Demir", "+905343334455", DON, "2026-10-01", "2026-10-31", "0.00", 0, "0.00", "0,00 TL")
UYG = {"adres": "uygulama"}


def _hat(tel, ad, vade, tutar):
    """Ödeme Hatırlatma işinin içerik görünümü (kontrol {icerik}); {{5}} güncel bakiye = tutar (tek kalem, tek hareket)."""
    return {"telefon": tel, "degiskenler": [ad, FIRMA, vade, tutar, tutar], "pdf": None, "dosya_adi": None}


# ---- S34: İLK Yine de Gönder'de şüphesiz tutar yok, gönderim anına kadar doğuyor → iş alınır, gönderim anındaki tutarla gider (S29 ile aynı) ----
S("S34-01-ilk-yine-de-gonder-tutar-yok-is-alinir-ertesi-gun-gonderim-anindaki-tutarla", "S34",
  "P1 ve P2'nin iletisi Sonucu Belirsiz; 1. saatte ikisinin şüpheli kaydı açılır (P1'in öbür kalemi BUGÜN vadeli, P2'ninki 20.11'de); 2. saatte işteki Yine de Gönder (İLK basma, kayıt açık, "
  "şüphesiz tutar YOK) → ikisi de ALINIR (elle; onay penceresinde etiket) ve iş hemen duraklatılır; ertesi gün Devam Et: P1'in 30.10 kalemi artık gecikmiş → gönderim anındaki tutarla "
  "(30.10.2026, 150,00 TL = şüphesiz net 500 − 350) gider; P2'de gönderim anında da tutar yok → 'Atlandı — Gecikmiş Borç Yok'",
  "S34 (Y17-1/2/3/4) + S16 + S17 + S7A + Y12-2", [A7(),
   cari_h("P1", "Pelin İlk", "0547 100 20 30", [_h("2026-09-01", 500, 0)], vadeler=[_v("2026-10-08", 350), _v("2026-10-30", 150)]),
   cari_h("P2", "Pınar Hiç", "0547 200 30 40", [_h("2026-09-01", 400, 0)], vadeler=[_v("2026-10-09", 250), _v("2026-11-20", 150)])],
  [baslat("+0s", "T1", ["P1", "P2", "A"], sablon="hatirlatma"),
   olay("+1h", "cari", id="P1", vadeler=[_v("2026-10-08", 350, True), _v("2026-10-30", 150)]), olay("+1h", "cari", id="P2", vadeler=[_v("2026-10-09", 250, True), _v("2026-11-20", 150)]),
   olay("+2h", "yine_de_gonder", toplu="T1", cari="P1", etiket="Y1"), olay("+2h", "yine_de_gonder", toplu="T1", cari="P2", etiket="Y2"), olay("+2h", "duraklat", toplu="T1"),
   kontrol("+3h", "K1"), olay("+24h", "devam", toplu="T1"), kontrol("+24h5m", "K2")],
  {"elenen": {}, "olusmadi": [],
   "yeniden.Y1": {"elenen": {}, "alinan": ["P1"], "oneri": None, "supheli_etiketi": ["P1"]}, "yeniden.Y2": {"elenen": {}, "alinan": ["P2"], "oneri": None, "supheli_etiketi": ["P2"]},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/P1": "Duraklatıldı", "T1/P2": "Duraklatıldı"}, "kontroller.K1.toplam_post": 3,
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/P1": "Teslim Edildi", "T1/P2": "Atlandı"},
   "isler.T1/P1.degiskenler": ["Pelin İlk", FIRMA, "30.10.2026", "150,00 TL", SUS7], "isler.T1/P1.post": 2, "isler.T1/P1.atlanma_nedeni": None,
   "isler.T1/P2.durum": "Atlandı", "isler.T1/P2.atlanma_nedeni": "gecikmis_borc_yok", "isler.T1/P2.post": 1,
   "meta.post": {"A": 1, "P1": 2, "P2": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta_davranis=_bel("P1", "P2"))

S("S34-02-ilk-yine-de-gonder-gece-yarisi-yerel-gun-tutar-dogar", "S34",
  "31.10 23:30 (yerel): G1'in iletisi Sonucu Belirsiz; 23:35 şüpheli kaydı açılır; 23:40 işteki Yine de Gönder (İLK basma): 31.10 kalemi henüz gecikmiş değil → tutar yok, iş ALINIR ve hemen "
  "duraklatılır; 01.11 00:10 yerel (UTC'de hâlâ 31.10) Devam Et: YEREL güne göre 31.10 kalemi gecikmiş → 31.10.2026 / 200,00 TL (600 − 400) ile gider; 'Bu Ay' Türkiye saatiyle (Ekim 1 + Kasım 1)",
  "S34 (Y17-2/4) + S16 + S17 + Y14-9 + §7a 19, 20", [A7(),
   cari_h("G1", "Gizem Gece", "0547 300 40 50", [_h("2026-09-01", 600, 0)], vadeler=[_v("2026-10-05", 400), _v("2026-10-31", 200)])],
  [baslat("+0s", "T1", ["G1", "A"], sablon="hatirlatma"),
   olay("+5m", "cari", id="G1", vadeler=[_v("2026-10-05", 400, True), _v("2026-10-31", 200)]),
   olay("+10m", "yine_de_gonder", toplu="T1", cari="G1", etiket="Y1"), olay("+10m", "duraklat", toplu="T1"), kontrol("+20m", "K1"),
   olay("+40m", "devam", toplu="T1"), kontrol("+45m", "K2")],
  {"elenen": {}, "yeniden.Y1": {"elenen": {}, "alinan": ["G1"], "oneri": None, "supheli_etiketi": ["G1"]},
   "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/G1": "Duraklatıldı"}, "kontroller.K1.t": "2026-10-31T23:50:00+03:00",
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/G1": "Teslim Edildi"}, "kontroller.K2.t": "2026-11-01T00:15:00+03:00",
   "isler.T1/G1.degiskenler": ["Gizem Gece", FIRMA, "31.10.2026", "200,00 TL", SUS7], "isler.T1/G1.post": 2, "isler.T1/G1.atlanma_nedeni": None,
   "isler.T1/A.degiskenler": A_HAT, "meta.post": {"A": 1, "G1": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(1), "2026-11": ay_kova(1)}}},
  baslangic="2026-10-31T23:30:00+03:00", meta_davranis=_bel("G1"))


# ---- S35: silme talebinde bekleyen iş talep anında kapanır ("Atlandı — Silme Talebi") — kuyrukta değil, aynı dönem yeni gönderim gider ----
S("S35-01-talep-aninda-kapanir-ayni-donem-yeni-gonderim-gider-meta-bekletti-gec-teslim", "S35",
  "Ekim ekstresi: A gider; B'nin işi hemen duraklatılır (hiç gitmedi); D'ninki Meta Bekletti (131049; 1. iletinin teslimi 3. saatte GEÇ gelecek); 1. saatte B ve D silme talebinde bulunur → "
  "ikisinin işi talep ANINDA 'Atlandı — Silme Talebi' (içerik / telefon silinir, POST yok); 70. dakikada aynı dönem yeni gönderim: B ve D 'Zaten Kuyrukta' DEĞİL (kapanan iş kuyrukta sayılmaz) → "
  "karttaki telefonla, yeni içerikle gider (D'nin Meta Bekletti iletisi K7 gereği sayılmaz); 2. saatte Devam Et etkisiz; 3. saatte D'nin 1. iletisinin teslimi gelir → deneme teslim sayılır "
  "(J1, 'Bu Ay') — güncelleme 19 (S59 = A, README §24 Y19-10): iş 'Teslim Edildi' olur (atlanma nedeni kalkar; PDF'i talep anında bakım turunda silinmişti — S60); D iki ileti almış olur (K7 "
  "düzeni, README §22 Y17-9); 4. saatte aynı dönem B ve D 'Daha Önce Gönderildi'",
  "S35 (Y17-6/7/8/9) + S30 + K7 + J1 + J5 + §7a 9 + S59 (Y19-10) + S60 (Y19-16)", [A(), B(), D()],
  [baslat("+0s", "T1", "A"), baslat("+0s", "T2", "B"), olay("+0s", "duraklat", toplu="T2"), baslat("+0s", "T3", "D"),
   olay("+1h", "kvkk_sil", id="B"), olay("+1h", "kvkk_sil", id="D"), kontrol_ic("+1h", "K1"),
   baslat("+70m", "T4", "BD"), olay("+2h", "devam", toplu="T2"), kontrol_ic("+2h30m", "K2"), kontrol("+3h30m", "K3"), baslat("+4h", "T5", "BD")],
  {"kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T2/B": "Atlandı", "T3/D": "Atlandı"}, "kontroller.K1.icerik.T2/B": SIL, "kontroller.K1.icerik.T3/D": SIL,
   "elenen": {"T5": {"B": DO, "D": DO}}, "olusmadi": ["T5"], "onceki_uyari": {"T5": {"sayi": 2, "son": "2026-10-30"}}, "toplular.T4.is_sayisi": 2,
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T2/B": "Atlandı", "T3/D": "Atlandı", "T4/B": "Teslim Edildi", "T4/D": "Teslim Edildi"},
   "kontroller.K2.icerik.T4/B": B_EKIM, "kontroller.K2.icerik.T4/D": _ek("Hasan Çelik", "+905354445566", DON, "2026-10-01", "2026-10-31", "0.00", 1, "750.00", "750,00 TL"),
   "kontroller.K3.isler.T3/D": "Teslim Edildi",                                             # güncelleme 19 (S59 = A): eskiden "Atlandı" (Y17-9)
   "isler.T2/B.atlanma_nedeni": "silme_talebi", "isler.T3/D.atlanma_nedeni": None, "isler.T3/D.medya_silme": 1,   # güncelleme 19: S59 (atlanma nedeni eskiden silme_talebi) + S60
   "isler.T2/B.post": 0, "isler.T3/D.post": 1, "isler.T3/D.icerik_silindi": True,
   "meta.post": {"A": 1, "B": 1, "D": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(4)}}},
  meta_davranis={"kanca": {"T3/D": {"1": [["sent", "+1s"], ["failed", "+10s", {"kod": 131049}], ["delivered", "+20s", {"varis": "+3h"}]], "*": K_STD}, "*": K_STD}})

S("S35-02-hatirlatma-talep-sonrasi-ayni-gun-yeni-gonderim-gece-yarisi-belirsiz-yerel-gun", "S35",
  "31.10 23:00 (yerel; UTC 20:00) Ödeme Hatırlatma: A gider, BH'nin iletisi Sonucu Belirsiz; SH'nin işi ayrı toplu işte hemen duraklatılır; 23:20 SH ve BH silme talebinde bulunur → SH'nin işi "
  "talep ANINDA 'Atlandı — Silme Talebi', BH Sonucu Belirsiz kalır (içerik silinir); 23:50 aynı gün yeni hatırlatma: SH 'Zaten Kuyrukta' DEĞİL → karttaki telefonla, gönderim anındaki "
  "içerikle gider, BH aynı YEREL gün 'Sonucu Belirsiz' (E3); 01.11 00:10 yerel (UTC'de hâlâ 31.10) BH'ye yeni hatırlatma gider (yerel gün değişti); Devam Et etkisiz",
  "S35 (Y17-6/7/8/10) + S30 + E3 + D2 + Y14-9", [A7(),
   cari_h("BH", "Berk Belirsiz", "0548 100 20 30", [_h("2026-09-01", 300, 0)], vadeler=[_v("2026-10-10", 300)]),
   cari_h("SH", "Sinan Hatır", "0548 200 30 40", [_h("2026-09-01", 400, 0)], vadeler=[_v("2026-10-12", 400)])],
  [baslat("+0s", "T1", ["BH", "A"], sablon="hatirlatma"), baslat("+0s", "T2", ["SH"], sablon="hatirlatma"), olay("+0s", "duraklat", toplu="T2"),
   olay("+20m", "kvkk_sil", id="SH"), olay("+20m", "kvkk_sil", id="BH"), kontrol_ic("+25m", "K1"),
   baslat("+50m", "T3", ["SH", "BH"], sablon="hatirlatma"), baslat("+70m", "T4", ["BH"], sablon="hatirlatma"), olay("+80m", "devam", toplu="T2"), kontrol_ic("+85m", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/BH": "Sonucu Belirsiz", "T2/SH": "Atlandı"}, "kontroller.K1.icerik.T1/BH": SIL, "kontroller.K1.icerik.T2/SH": SIL,
   "elenen": {"T3": {"BH": "sonucu_belirsiz"}}, "olusmadi": [], "onceki_uyari": {}, "toplular.T3.is_sayisi": 1,
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/BH": "Sonucu Belirsiz", "T2/SH": "Atlandı", "T3/SH": "Teslim Edildi", "T4/BH": "Teslim Edildi"},
   "kontroller.K2.icerik.T3/SH": _hat("+905482003040", "Sinan Hatır", "12.10.2026", "400,00 TL"),
   "kontroller.K2.icerik.T4/BH": _hat("+905481002030", "Berk Belirsiz", "10.10.2026", "300,00 TL"), "kontroller.K2.t": "2026-11-01T00:25:00+03:00",
   "isler.T2/SH.atlanma_nedeni": "silme_talebi", "isler.T2/SH.post": 0, "isler.T1/BH.icerik_silindi": True, "isler.T1/BH.post": 1,
   "meta.post": {"A": 1, "BH": 2, "SH": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(2), "2026-11": ay_kova(1)}}},
  baslangic="2026-10-31T23:00:00+03:00", meta_davranis={"mesaj": {"BH": ["yanitsiz_kabul", "kabul"]}, "kanca": {"T1/BH": {"1": []}, "*": K_STD}})


# ---- S36: Sonucu Belirsiz Ekstre işinin içeriği silinince aynı dönem için yol kalmaz; sonraki dönem gider (ilke 4'ün bu duruma özel istisnası) ----
S("S36-01-silinmis-belirsiz-ekstre-ayni-donem-yol-yok-sonraki-donem-gider", "S36",
  "30.10 Ekim ekstresi: B gider, A'nınki Sonucu Belirsiz; 1. saatte A silme talebinde bulunur (içerik silinir, iş Sonucu Belirsiz kalır); aynı dönem: 2. saatte yeni gönderim 'Sonucu Belirsiz', "
  "3. saatte R3 'Yine de Gönder' bayrağıyla da 'Sonucu Belirsiz' (belirsiz elemesi R3'ten önce — E2), 4. saatte işteki Yine de Gönder 'içerik silindi' (S31) → aynı dönem için YOL YOK (S36); "
  "02.11'de 'Geçen Ay' (= Ekim, D4) yine 'Sonucu Belirsiz'; aynı gün sonraki dönem (Kasım) gider",
  "S36 (Y17-13/14/15) + S30 + S31 + D1 + D4 + E2", [A(), B()],
  [baslat("+0s", "T1", "AB"), olay("+1h", "kvkk_sil", id="A"), baslat("+2h", "T2", "A"), baslat("+3h", "T3", "A", onceki="gonder"),
   olay("+4h", "yine_de_gonder", toplu="T1", cari="A", etiket="Y1"),
   baslat("+3d", "T4", "A", donem=GECEN_AY), baslat("+3d30m", "T5", "A", donem={"bas": "2026-11-01", "son": "2026-11-30"}), kontrol_ic("+3d1h", "K1")],
  {"elenen": {"T2": {"A": "sonucu_belirsiz"}, "T3": {"A": "sonucu_belirsiz"}, "T4": {"A": "sonucu_belirsiz"}}, "olusmadi": ["T2", "T3", "T4"], "onceki_uyari": {},
   "yeniden.Y1": {"elenen": {"A": IS}, "alinan": [], "oneri": None},
   "kontroller.K1.icerik": {"T1/A": SIL, "T1/B": B_EKIM, "T5/A": A_KASIM},
   "isler.T1/A.durum": "Sonucu Belirsiz", "isler.T1/A.icerik_silindi": True, "isler.T1/A.post": 1, "isler.T5/A.durum": "Teslim Edildi",
   "meta.post": {"A": 2, "B": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(1), "2026-11": ay_kova(1)}}},
  meta_davranis={"mesaj": {"A": ["yanitsiz_kabul", "kabul"]}, "kanca": {"T1/A": {"1": []}, "*": K_STD}})

S("S36-02-silinmis-belirsiz-son-3-ay-yedi-gun-icinde-yol-yok-sonra-gider", "S36",
  "'Son 3 Ay' ekstresi: B gider, A'nınki Sonucu Belirsiz; 1. saatte A silme talebinde bulunur; 1. gün R3 'Yine de Gönder' bayrağıyla ve 6 gün 23. saatte aynı seçim 'Sonucu Belirsiz' (7 gün "
  "içinde aynı dönem — K1 / D3); 7 gün 2. saatte aynı seçim artık sonraki dönem → uyarısız gider",
  "S36 (Y17-13/15) + S30 + K1 + D3 + E2", [A(), B()],
  [baslat("+0s", "T1", "AB", donem={"secim": "son_3_ay"}), olay("+1h", "kvkk_sil", id="A"),
   baslat("+1d", "T2", "A", donem={"secim": "son_3_ay"}, onceki="gonder"), baslat("+6d23h", "T3", "A", donem={"secim": "son_3_ay"}),
   baslat("+7d2h", "T4", "A", donem={"secim": "son_3_ay"})],
  {"elenen": {"T2": {"A": "sonucu_belirsiz"}, "T3": {"A": "sonucu_belirsiz"}}, "olusmadi": ["T2", "T3"], "onceki_uyari": {},
   "isler.T1/A.durum": "Sonucu Belirsiz", "isler.T1/A.icerik_silindi": True, "isler.T4/A.durum": "Teslim Edildi", "isler.T4/A.telefon": "+905321112233",
   "meta.post": {"A": 2, "B": 1}},
  meta_davranis={"mesaj": {"A": ["yanitsiz_kabul", "kabul"]}, "kanca": {"T1/A": {"1": []}, "*": K_STD}})


# ---- S37 (= B): içeriği silinmiş Ödeme Hatırlatma işi aynı iş üzerinden yeniden gönderilir; içerik gönderim anında karttan yeniden hazırlanır ----
S("S37-01-talep-sonrasi-hatirlatma-yeniden-dene-ve-yine-de-gonder-karttan-gider", "S37",
  "30.10 Ödeme Hatırlatma: A gider, RF ve RT alıcı hatasıyla (131021) Başarısız, RB Sonucu Belirsiz; 1. saatte RF, RB, RT silme talebinde bulunur (RT'nin kartındaki telefon da silinir) → "
  "içerikler silinir; 2. saatte Başarısızları Yeniden Dene: RF ALINIR (S37 = B; 'içerik silindi' elemesi yok) ve gönderim anında karttan yeniden hazırlanan içerikle gider; RT (kart telefonu da "
  "silinmiş) güncelleme 19 (S61 = A, README §24 Y19-21): başlatmada 'Telefon Yok' ile ALINMAZ, iş Başarısız kalır (eskiden alınıp gönderim anında 'Atlandı — Telefonsuz' — Y17-17); 3. saatte "
  "RB'ye işteki Yine de Gönder: alınır, karttan hazırlanan içerikle gider",
  "S37 (Y17-16/17/18) + SW3 (Y15-16) + E2 + §7a 2, 6 + S61 (Y19-20/21)", [A7(),
   cari_h("RF", "Rana Fail", "0549 100 20 30", [_h("2026-09-01", 400, 0)], vadeler=[_v("2026-10-11", 400)]),
   cari_h("RB", "Rıza Belirsiz", "0549 200 30 40", [_h("2026-09-01", 350, 0)], vadeler=[_v("2026-10-13", 350)]),
   cari_h("RT", "Tuna Telsiz", "0549 300 40 50", [_h("2026-09-01", 450, 0)], vadeler=[_v("2026-10-14", 450)])],
  [baslat("+0s", "T1", ["A", "RF", "RB", "RT"], sablon="hatirlatma"),
   olay("+1h", "kvkk_sil", id="RF"), olay("+1h", "kvkk_sil", id="RB"), olay("+1h", "kvkk_sil", id="RT"), olay("+1h", "cari", id="RT", telefon=None), kontrol_ic("+1h30m", "K1"),
   olay("+2h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), olay("+3h", "yine_de_gonder", toplu="T1", cari="RB", etiket="Y2"), kontrol_ic("+4h", "K2")],
  {"kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/RB": "Sonucu Belirsiz", "T1/RF": "Başarısız", "T1/RT": "Başarısız"},
   "kontroller.K1.icerik": {"T1/A": _hat("+905321112233", "Ayşe Yılmaz", "10.10.2026", "500,00 TL") | {"degiskenler": A_HAT}, "T1/RB": SIL, "T1/RF": SIL, "T1/RT": SIL},
   "yeniden.Y1": {"elenen": {"RT": "telefonsuz"}, "alinan": ["RF"], "oneri": None}, "yeniden.Y2": {"elenen": {}, "alinan": ["RB"], "oneri": None},   # güncelleme 19: S61 (eskiden RT alınırdı)
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/RB": "Teslim Edildi", "T1/RF": "Teslim Edildi", "T1/RT": "Başarısız"},
   "kontroller.K2.icerik": {"T1/A": _hat("+905321112233", "Ayşe Yılmaz", "10.10.2026", "500,00 TL") | {"degiskenler": A_HAT},
                            "T1/RB": _hat("+905492003040", "Rıza Belirsiz", "13.10.2026", "350,00 TL"),
                            "T1/RF": _hat("+905491002030", "Rana Fail", "11.10.2026", "400,00 TL"), "T1/RT": SIL},
   "isler.T1/RT.atlanma_nedeni": None, "isler.T1/RT.durum": "Başarısız", "isler.T1/RT.hata_kodu": 131021, "isler.T1/RT.post": 1, "isler.T1/RF.hata_kodu": None,   # güncelleme 19: S61
   "meta.post": {"A": 1, "RB": 2, "RF": 2, "RT": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(3)}}},
  meta_davranis={"mesaj": {"RF": [{"hata": 131021}, "kabul"], "RT": [{"hata": 131021}, "kabul"], "RB": ["yanitsiz_kabul", "kabul"]},
                 "kanca": {"T1/RB": {"1": [], "*": K_STD}, "*": K_STD}})

S("S37-02-bir-yil-sonra-hatirlatma-yeniden-dene-ve-yine-de-gonder-karttan-gider", "S37",
  "02.11.2026 Ödeme Hatırlatma: HF alıcı hatasıyla (131021) Başarısız, HB Sonucu Belirsiz; 1 yıl dolmadan 2 saat önce içerikler durur, 2 saat sonra silinmiştir; 1 yıl 3. saatte "
  "Başarısızları Yeniden Dene (HF) ve işteki Yine de Gönder (HB): ikisi de ALINIR, içerik gönderim anında karttan yeniden hazırlanır (vadesi geçmiş kalemler 1 yıl sonra da açık) ve gider",
  "S37 (Y17-16/17/18) + SW3 (Y15-13) + E2 + E3", [
   cari_h("HF", "Hande Fail", "0549 400 50 60", [_h("2026-10-01", 500, 0)], vadeler=[_v("2026-10-15", 500)]),
   cari_h("HB", "Hakan Belirsiz", "0549 500 60 70", [_h("2026-10-01", 600, 0)], vadeler=[_v("2026-10-16", 600)])],
  [baslat("+0s", "T1", ["HF", "HB"], sablon="hatirlatma"), kontrol_ic("+364d22h", "K1"), kontrol_ic("+365d2h", "K2"),
   olay("+365d3h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), olay("+365d3h", "yine_de_gonder", toplu="T1", cari="HB", etiket="Y2"), kontrol_ic("+365d4h", "K3")],
  {"kontroller.K1.icerik": {"T1/HB": _hat("+905495006070", "Hakan Belirsiz", "16.10.2026", "600,00 TL"), "T1/HF": _hat("+905494005060", "Hande Fail", "15.10.2026", "500,00 TL")},
   "kontroller.K2.icerik": {"T1/HB": SIL, "T1/HF": SIL}, "kontroller.K2.isler": {"T1/HB": "Sonucu Belirsiz", "T1/HF": "Başarısız"},
   "yeniden.Y1": {"elenen": {}, "alinan": ["HF"], "oneri": None}, "yeniden.Y2": {"elenen": {}, "alinan": ["HB"], "oneri": None},
   "kontroller.K3.icerik": {"T1/HB": _hat("+905495006070", "Hakan Belirsiz", "16.10.2026", "600,00 TL"), "T1/HF": _hat("+905494005060", "Hande Fail", "15.10.2026", "500,00 TL")},
   "kontroller.K3.isler": {"T1/HB": "Teslim Edildi", "T1/HF": "Teslim Edildi"},
   "meta.post": {"HB": 2, "HF": 2}, "bu_ay": {"W1": {"2027-11": ay_kova(2)}}},
  baslangic=T0_KASIM, bitis="+366d", meta_davranis={"mesaj": {"HF": [{"hata": 131021}, "kabul"], "HB": ["yanitsiz_kabul", "kabul"]},
                                                   "kanca": {"T1/HB": {"1": [], "*": K_STD}, "*": K_STD}})


# ---- S38: başka bilgisayara taşımada silme talebi kayıtları taşınır ve yeni bilgisayarda da uygulanır (ilke 5) ----
S("S38-01-tasima-oncesi-talep-yeni-bilgisayarda-geri-yuklemede-uygulanir", "S38",
  "02.11.2026 A ve B'ye Ekim ekstresi gider; 1. saatte yedek Y0; 2. saatte A silme talebinde bulunur; 3. saatte A'ya Kasım ekstresi (talepten SONRA yazılan içerik); 4. saatte yedek Y1; 5. saatte "
  "veri başka bilgisayara TAŞINIR (talep kaydı da gider); yeni bilgisayarda 6. saatte Y0 geri yüklenir → A'nın Ekim içeriği GELMEZ, B'ninki durur; 7. saatte Y1 → Kasım içeriği DURUR; 8. saatte "
  "aynı dönem (Ekim) A ve B taşınan dosyadaki izle 'Daha Önce Gönderildi'",
  "S38 (Y17-20/21/22) + S32 (Y16-21/22) + D8 + G0 (5)", [A(), B()],
  [baslat("+0s", "T1", "AB", donem=GECEN_AY), olay("+1h", "yedek_al", ad="Y0"), olay("+2h", "kvkk_sil", id="A"),
   baslat("+3h", "T2", "A", donem={"bas": "2026-11-01", "son": "2026-11-30"}), olay("+4h", "yedek_al", ad="Y1"), olay("+5h", "tasindi"),
   olay("+6h", "geri_yukle", yedek="Y0"), kontrol_ic("+6h", "K1"), olay("+7h", "geri_yukle", yedek="Y1"), kontrol_ic("+7h", "K2"),
   baslat("+8h", "T3", "AB", donem=EKIM)],
  {"kontroller.K1.icerik": {"T1/A": SIL, "T1/B": B_EKIM}, "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Teslim Edildi"},
   "kontroller.K2.icerik": {"T1/A": SIL, "T1/B": B_EKIM, "T2/A": A_KASIM},
   "elenen": {"T3": {"A": DO, "B": DO}}, "olusmadi": ["T3"], "onceki_uyari": {"T3": {"sayi": 2, "son": "2026-11-02"}},
   "isler.T1/A.icerik_silindi": True, "isler.T2/A.telefon": "+905321112233",
   "meta.post": {"A": 2, "B": 1}, "bu_ay": {"W1": {"2026-11": ay_kova(3)}}},
  baslangic=T0_KASIM, bitis="+1d", meta_davranis={"kanca": {"*": K_STD}})

S("S38-02-tasima-sonrasi-talep-ve-zincirleme-tasima", "S38",
  "02.11.2026 A, B, C'ye Ekim ekstresi gider; 1. saatte yedek Y0; 2. saatte A silme talebinde bulunur (eski bilgisayar); 3. saatte taşıma (bilgisayar 2); 4. saatte C silme talebinde bulunur "
  "(yeni bilgisayar); 5. saatte Y0 geri yüklenir → A ve C'nin içeriği GELMEZ (taşınan ve yerel talep); 6. saatte ikinci taşıma (bilgisayar 3), 7. saatte Y0 yeniden geri yüklenir → yine "
  "GELMEZ; 8. saatte aynı dönem üçü 'Daha Önce Gönderildi'",
  "S38 (Y17-20/21/22) + S32 (Y16-20/21) + D8 + G0 (5)", [A(), B(), C()],
  [baslat("+0s", "T1", "ABC", donem=GECEN_AY), olay("+1h", "yedek_al", ad="Y0"), olay("+2h", "kvkk_sil", id="A"), olay("+3h", "tasindi"),
   olay("+4h", "kvkk_sil", id="C"), kontrol_ic("+4h30m", "K1"), olay("+5h", "geri_yukle", yedek="Y0"), kontrol_ic("+5h", "K2"),
   olay("+6h", "tasindi"), olay("+7h", "geri_yukle", yedek="Y0"), kontrol_ic("+7h", "K3"), baslat("+8h", "T2", "ABC", donem=EKIM)],
  {"kontroller.K1.icerik": {"T1/A": SIL, "T1/B": B_EKIM, "T1/C": SIL}, "kontroller.K2.icerik": {"T1/A": SIL, "T1/B": B_EKIM, "T1/C": SIL},
   "kontroller.K3.icerik": {"T1/A": SIL, "T1/B": B_EKIM, "T1/C": SIL}, "kontroller.K3.isler": {"T1/A": "Teslim Edildi", "T1/B": "Teslim Edildi", "T1/C": "Teslim Edildi"},
   "elenen": {"T2": {"A": DO, "B": DO, "C": DO}}, "olusmadi": ["T2"], "onceki_uyari": {"T2": {"sayi": 3, "son": "2026-11-02"}},
   "meta.post": {"A": 1, "B": 1, "C": 1}, "bu_ay": {"W1": {"2026-11": ay_kova(3)}}},
  baslangic=T0_KASIM, bitis="+1d", meta_davranis={"kanca": {"*": K_STD}})


# ---- S33: Yol 2'de "bildirim yolu çalışıyor" işaretini yalnız İMZALI bildirim koyar; Yol 1 (Elle Bağla) imzasız bildirim kabul etmeye devam eder ----
S("S33-01-yol-2-imzasiz-bildirim-isaret-koymaz-sure-dolmaz-ayni-donem-daha-once", "S33",
  "Yol 2, teslim süresi 12 sa: A ve B'nin iletisi Meta Kabul Etti, Meta'dan hiç bildirim gelmez; 1. saatte wamid'i tanınmayan İMZASIZ 'delivered', 2. saatte B'nin gerçek wamid'iyle İMZASIZ 'sent' "
  "gelir → ikisi de işlenmez ve 'bildirim yolu çalışıyor' işaretini KOYMAZ → 14. saatte iki iş de Meta Kabul Etti'de (Süresi Doldu olmaz); 15. saatte aynı dönem ikisi 'Daha Önce Gönderildi'",
  "S33 (Y17-25) + §7a 3, 16 + W1 + G0 (2)", [A(), B()],
  [baslat("+0s", "T1", "AB"), olay("+1h", "sahte_kanca", wamid="wamid.SAHTE-YOL2", durum="delivered"), olay("+2h", "sahte_kanca", durum="sent", **{"is": "T1/B"}),
   kontrol("+14h", "K1"), baslat("+15h", "T2", "AB")],
  {"kontroller.K1.isler": {"T1/A": "Meta Kabul Etti", "T1/B": "Meta Kabul Etti"}, "isler.T1/A.durum": "Meta Kabul Etti", "isler.T1/B.durum": "Meta Kabul Etti",
   "elenen": {"T2": {"A": DO, "B": DO}}, "olusmadi": ["T2"], "onceki_uyari": {"T2": {"sayi": 2, "son": "2026-10-30"}},
   "meta.post": {"A": 1, "B": 1}, "bu_ay": {}},
  ayar={"baglanti_yolu": "yol2"}, meta=META_12SA, meta_davranis={"kanca": {"*": []}})

S("S33-02-yol-1-imzasiz-bildirim-kabul-isaret-ve-sure-dolumu-sahte-de-islenir", "S33",
  "Yol 1 (Elle Bağla — kapıcı imzayı doğrulayamaz), teslim süresi 12 sa: Meta'nın bildirimleri İMZASIZ gelir ve İŞLENİR — A Teslim Edildi, B yalnız 'sent' alır (Gönderildi; bildirim yolu işareti "
  "konur); C'ye Meta bildirimi gelmez, 1. saatte C'nin gerçek wamid'iyle İMZASIZ sahte 'delivered' gelir ve Yol 1'de o da İŞLENİR (BİLİNEN RİSK — README §22 Y17-26); 14. saatte B Süresi Doldu; "
  "15. saatte aynı dönem: A ve C 'Daha Önce Gönderildi', B'ye yeniden gider",
  "S33 (Y17-26) + S41 (Y17-26) + §7a 16, 17 + W1", [A(), B(), C()],
  [baslat("+0s", "T1", "ABC"), olay("+1h", "sahte_kanca", durum="delivered", **{"is": "T1/C"}), kontrol("+2h", "K1"), kontrol("+14h", "K2"), baslat("+15h", "T2", "ABC")],
  {"kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Gönderildi", "T1/C": "Teslim Edildi"},
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/B": "Süresi Doldu", "T1/C": "Teslim Edildi"},
   "elenen": {"T2": {"A": DO, "C": DO}}, "olusmadi": [], "onceki_uyari": {"T2": {"sayi": 2, "son": "2026-10-30"}}, "toplular.T2.is_sayisi": 1,
   "isler.T2/B.durum": "Süresi Doldu", "meta.post": {"A": 1, "B": 2, "C": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  ayar={"baglanti_yolu": "yol1"}, meta=META_12SA, meta_davranis={"kanca": {"A": K_STD, "B": [["sent", "+1s"]], "C": []}})


# ---- S41: uygulama düzeyi adrese gelen bildirim alternatif adresle AYNI kurallarla (Yol 1 imzasız kabul, Yol 2 yalnız imzalı); teslim bilgisi kaybolmaz ----
S("S41-01-yol-2-uygulama-duzeyi-adres-imzali-islenir-imzasiz-duser", "S41",
  "Yol 2, teslim süresi 12 sa: A'nın 'sent'i alternatif adrese, 'delivered'ı UYGULAMA DÜZEYİ adrese; B'nin iki bildirimi de uygulama düzeyi adrese (imzalı) → ikisi Teslim Edildi (teslim bilgisi "
  "kaybolmaz); C yalnız 'sent' alır, 1. saatte uygulama düzeyi adrese C'nin wamid'iyle İMZASIZ 'delivered' gelir → düşer; 14. saatte C Süresi Doldu; 15. saatte aynı dönem: A ve B 'Daha Önce "
  "Gönderildi' (Süresi Doldu yüzünden ikinci ileti yok), C'ye yeniden gider",
  "S41 (Y17-27/28) + S33 (Y17-25) + §7a 3, 16 + W1 + G0 (2, 3)", [A(), B(), C()],
  [baslat("+0s", "T1", "ABC"), olay("+1h", "sahte_kanca", durum="delivered", adres="uygulama", **{"is": "T1/C"}), kontrol("+2h", "K1"), kontrol("+14h", "K2"),
   baslat("+15h", "T2", "ABC")],
  {"kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Teslim Edildi", "T1/C": "Gönderildi"},
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/B": "Teslim Edildi", "T1/C": "Süresi Doldu"},
   "elenen": {"T2": {"A": DO, "B": DO}}, "olusmadi": [], "onceki_uyari": {"T2": {"sayi": 2, "son": "2026-10-30"}}, "toplular.T2.is_sayisi": 1,
   "isler.T2/C.durum": "Süresi Doldu", "meta.post": {"A": 1, "B": 1, "C": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta=META_12SA, meta_davranis={"kanca": {"A": [["sent", "+1s"], ["delivered", "+5s", UYG]], "B": [["sent", "+1s", UYG], ["delivered", "+5s", UYG]], "C": [["sent", "+1s"]]}})

S("S41-02-yol-1-uygulama-duzeyi-adres-imzasiz-kabul", "S41",
  "Yol 1, teslim süresi 12 sa: A'nın iki bildirimi de uygulama düzeyi adrese İMZASIZ gelir → Yol 1'de kabul, A Teslim Edildi; B yalnız 'sent' alır (alternatif adres) → 14. saatte Süresi Doldu; "
  "15. saatte aynı dönem A 'Daha Önce Gönderildi', B'ye yeniden gider",
  "S41 (Y17-26/27) + §7a 16 + W1", [A(), B()],
  [baslat("+0s", "T1", "AB"), kontrol("+2h", "K1"), kontrol("+14h", "K2"), baslat("+15h", "T2", "AB")],
  {"kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Gönderildi"}, "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/B": "Süresi Doldu"},
   "elenen": {"T2": {"A": DO}}, "olusmadi": [], "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}}, "toplular.T2.is_sayisi": 1,
   "meta.post": {"A": 1, "B": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(1)}}},
  ayar={"baglanti_yolu": "yol1"}, meta=META_12SA, meta_davranis={"kanca": {"A": [["sent", "+1s", UYG], ["delivered", "+5s", UYG]], "B": [["sent", "+1s"]]}})


# ======================================================================== kâhin güncellemesi 18 (2.5.0, KULLANICI KARARI 06.11.2026 08:54 UTC "a" — S42, S43; README §23)
# Elle beklenen YALNIZ karar metinlerinden (kahin.KARARLAR S42, S43; BAŞ MİMAR KARARI 08:52 Y17-6) ve README §23.2–23.3 yorumlarından (kodlamadan önce yazıldı, ayrı commit). Yeni girdi: gecikmeli
# Meta yanıtı {"gec": süre, "yanit": "kabul" | "yanitsiz_kabul" | "yanitsiz_red" | {"hata": kod} | {"sinir": true}} (README §23 Y18-9) — program o süre "Gönderiliyor"da bekler; talep o aralıkta.
# Aralık iki zaman ucunda da açık seçildi: k. iş (0'dan) gönderime k × (adım + gecikme)'de girer, yanıtı (k + 1) × (adım + gecikme)'de gelir (adım 0,5 sn / 5 sn). Yeni olay YOK.
def _ys(gec, yanit):
    return {"gec": gec, "yanit": yanit}


GEC_K = [["sent", "+1s", {"varis": "+1m"}], ["delivered", "+5s", {"varis": "+1m"}]]   # gecikmeli kabulün bildirimleri yanıttan SONRA ulaşır (J6 503 penceresi dışı)


# ---- S42: silme talebi anında iş Gönderiliyor → içerik / telefon hemen silinir; yanıt ize yazılır; yeniden gönderim gerektiren yanıtta iş o anda "Atlandı — Silme Talebi" ----
S("S42-01-gonderiliyor-talep-kabul-gonderildi-izi-ayni-donem-daha-once", "S42",
  "Ekim ekstresi A, B: A'nın isteğine Meta'nın yanıtı 10 sn gecikir (Gönderiliyor); 5. saniyede A silme talebinde bulunur → içerik ve telefon HEMEN silinir, iş Gönderiliyor'da kalır (B işçiyi "
  "bekler); yanıt KABUL → 'gönderildi' izi, iş Meta Kabul Etti, sonra Teslim Edildi (içerik silinmiş kalır); 1. saatte aynı dönem A ve B 'Daha Önce Gönderildi' (R3, son 30.10); 2. saatte R3 "
  "'Yine de Gönder' ile A'ya karttaki telefonla, yeni içerikle gider (İLKEYLE WK 15)",
  "S42 (Y18-1/2/3) + SW3 (Y15-10/12) + R3 + J6", [A(), B()],
  [baslat("+0s", "T1", "AB"), olay("+5s", "kvkk_sil", id="A"), kontrol_ic("+7s", "K1"), kontrol_ic("+2m", "K2"),
   baslat("+1h", "T2", "AB"), baslat("+2h", "T3", "A", onceki="gonder"), kontrol_ic("+2h5m", "K3")],
  {"kontroller.K1.isler": {"T1/A": "Gönderiliyor", "T1/B": "Bekliyor"}, "kontroller.K1.icerik.T1/A": SIL, "kontroller.K1.toplam_post": 1,
   "kontroller.K1.durum_sayilari": {"Bekliyor": 1, "Gönderiliyor": 1},
   "kontroller.K2.isler": {"T1/A": "Teslim Edildi", "T1/B": "Teslim Edildi"}, "kontroller.K2.icerik": {"T1/A": SIL, "T1/B": B_EKIM},
   "elenen": {"T2": {"A": DO, "B": DO}}, "olusmadi": ["T2"], "onceki_uyari.T2": {"sayi": 2, "son": "2026-10-30"},
   "kontroller.K3.icerik.T3/A": A_EKIM, "kontroller.K3.icerik.T1/A": SIL, "isler.T3/A.durum": "Teslim Edildi",
   "isler.T1/A.durum": "Teslim Edildi", "isler.T1/A.telefon": None, "isler.T1/A.icerik_silindi": True, "isler.T1/A.post": 1, "isler.T1/A.kabul": 1, "isler.T1/A.atlanma_nedeni": None,
   "meta.post": {"A": 2, "B": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(3)}}},
  meta_davranis={"mesaj": {"A": [_ys("+10s", "kabul"), "kabul"]}, "kanca": {"T1/A": {"1": GEC_K, "*": K_STD}, "*": K_STD}})

S("S42-02-gonderiliyor-talep-yanit-yok-belirsiz-iz-ayni-donem-elenir", "S42",
  "Ekim ekstresi A, B ve Ödeme Hatırlatma HY: üç isteğe de yanıt gelmez (zaman aşımı 15 sn; Meta iletiyi aldı); her biri Gönderiliyor iken silme talebi → içerik / telefon hemen silinir, zaman "
  "aşımında iş ve deneme Sonucu Belirsiz (iz KALIR); 1. saatte aynı dönem A, B ve aynı YEREL gün HY 'Sonucu Belirsiz' ile elenir; 90. dakikada A'nın işteki Yine de Gönder'i 'içerik silindi' "
  "(Ekstre — S31 / S36), HY'ninki ALINIR ve karttan hazırlanan içerikle gider (S37); 2. saatte B'nin iletisine Meta'nın imzalı geç bildirimi gelir → iş Teslim Edildi (H1 / J1); 3. saatte "
  "aynı dönem A 'Sonucu Belirsiz', B 'Daha Önce Gönderildi'; 3. gün Kasım ekstresi A'ya gider",
  "S42 (Y18-1/2/4) + S30 + D1 + E2 + E3 + H1 + J1 + S31 + S36 + S37", [A(), B(),
   cari_h("HY", "Hülya Yanıtsız", "0550 100 20 30", [_h("2026-09-01", 300, 0)], vadeler=[_v("2026-10-10", 300)])],
  [baslat("+0s", "T1", "AB"), olay("+5s", "kvkk_sil", id="A"), olay("+25s", "kvkk_sil", id="B"),
   baslat("+1m", "T2", ["HY"], sablon="hatirlatma"), olay("+65s", "kvkk_sil", id="HY"), kontrol_ic("+2m", "K1"),
   baslat("+1h", "T3", "AB"), baslat("+1h", "T4", ["HY"], sablon="hatirlatma"),
   olay("+90m", "yine_de_gonder", toplu="T1", cari="A", etiket="Y1"), olay("+90m", "yine_de_gonder", toplu="T2", cari="HY", etiket="Y2"), kontrol_ic("+100m", "K2"),
   baslat("+3h", "T5", "AB"), baslat("+3d", "T6", "A", donem={"bas": "2026-11-01", "son": "2026-11-30"})],
  {"kontroller.K1.isler": {"T1/A": "Sonucu Belirsiz", "T1/B": "Sonucu Belirsiz", "T2/HY": "Sonucu Belirsiz"},
   "kontroller.K1.icerik": {"T1/A": SIL, "T1/B": SIL, "T2/HY": SIL},
   "elenen": {"T3": {"A": "sonucu_belirsiz", "B": "sonucu_belirsiz"}, "T4": {"HY": "sonucu_belirsiz"}, "T5": {"A": "sonucu_belirsiz", "B": DO}},
   "olusmadi": ["T3", "T4", "T5"], "onceki_uyari": {"T5": {"sayi": 1, "son": "2026-10-30"}},
   "yeniden.Y1": {"elenen": {"A": IS}, "alinan": [], "oneri": None}, "yeniden.Y2": {"elenen": {}, "alinan": ["HY"], "oneri": None},
   "kontroller.K2.isler.T2/HY": "Teslim Edildi", "kontroller.K2.icerik.T2/HY": _hat("+905501002030", "Hülya Yanıtsız", "10.10.2026", "300,00 TL"),
   "isler.T1/A.durum": "Sonucu Belirsiz", "isler.T1/A.icerik_silindi": True, "isler.T1/A.post": 1,
   "isler.T1/B.durum": "Teslim Edildi", "isler.T1/B.icerik_silindi": True, "isler.T1/B.telefon": None, "isler.T2/HY.post": 2, "isler.T6/A.durum": "Teslim Edildi",
   "meta.post": {"A": 2, "B": 1, "HY": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(2), "2026-11": ay_kova(1)}}},
  meta_davranis={"mesaj": {"A": [_ys("+15s", "yanitsiz_kabul"), "kabul"], "B": [_ys("+15s", "yanitsiz_kabul")], "HY": [_ys("+15s", "yanitsiz_kabul"), "kabul"]},
                 "kanca": {"T1/A": {"1": [], "*": K_STD}, "T1/B": {"1": [["sent", "+1s", {"varis": "+2h"}], ["delivered", "+5s", {"varis": "+2h"}]]},
                           "T2/HY": {"1": [], "*": K_STD}, "*": K_STD}})

S("S42-03-gonderiliyor-talep-yeniden-gonderim-gerektiren-yanit-atlandi-kesin-olumsuz-basarisiz", "S42",
  "Ayrı toplu işlerde Ekim ekstresi; Meta'nın yanıtı 10 sn gecikir ve her biri Gönderiliyor iken silme talebi gelir: G geçici hata (131000) → yeniden gönderim gerekir → o anda 'Atlandı — "
  "Silme Talebi'; M 131049 → Meta Bekletti yerine o anda Atlandı; R alıcı hatası (131021, kesin) → Başarısız (iz Başarısız; yeniden gönderim gerektirmez); S sınır hatası → WABA 24 saat bloklanır "
  "(öbür etkiler aynen) ve S o anda Atlandı; N (talep YOK) geçici hata → 30 sn sonra yeniden gönderilir, gider. 6. dakikada R'ye Başarısızları Yeniden Dene 'içerik silindi' (S31); 10. dakikada aynı "
  "dönem G, M, R, S yeni işle (karttaki telefonla) ALINIR (Atlandı / Başarısız iz sayılmaz) ama WABA bloğu yüzünden 24 saat Sınır'da bekler, sonra gider",
  "S42 (Y18-1/2/5/6/7) + S35 (Y17-8) + S31 + K3 + §7a 12–15, 30", [
   cari("G", "Gül Geçici", "0551 100 20 30", [("2026-10-05", 400, 0)]), cari("M", "Mert Bekletti", "0551 200 30 40", [("2026-10-06", 500, 0)]),
   cari("R", "Rıfat Ret", "0551 300 40 50", [("2026-10-07", 600, 0)]), cari("N", "Nur Normal", "0551 400 50 60", [("2026-10-08", 700, 0)]),
   cari("S", "Sena Sınır", "0551 500 60 70", [("2026-10-09", 800, 0)])],
  [baslat("+0s", "T1", ["G"]), olay("+5s", "kvkk_sil", id="G"), baslat("+1m", "T2", ["M"]), olay("+65s", "kvkk_sil", id="M"),
   baslat("+2m", "T3", ["R"]), olay("+125s", "kvkk_sil", id="R"), baslat("+3m", "T4", ["N"]), kontrol("+200s", "K1"),
   baslat("+4m", "T5", ["S"]), olay("+245s", "kvkk_sil", id="S"), kontrol_ic("+5m", "K2"),
   olay("+6m", "basarisizlari_yeniden_dene", toplu="T3", etiket="Y1"), baslat("+10m", "T6", ["G", "M", "R", "S"]), kontrol("+1h", "K3"), kontrol("+25h", "K4")],
  {"kontroller.K1.isler": {"T1/G": "Atlandı", "T2/M": "Atlandı", "T3/R": "Başarısız", "T4/N": "Bekliyor"},
   "kontroller.K2.isler": {"T1/G": "Atlandı", "T2/M": "Atlandı", "T3/R": "Başarısız", "T4/N": "Teslim Edildi", "T5/S": "Atlandı"},
   "kontroller.K2.icerik": {"T1/G": SIL, "T2/M": SIL, "T3/R": SIL, "T5/S": SIL,
                            "T4/N": _ek("Nur Normal", "+905514005060", DON, "2026-10-01", "2026-10-31", "0.00", 1, "700.00", "700,00 TL")},
   "isler.T1/G.atlanma_nedeni": "silme_talebi", "isler.T2/M.atlanma_nedeni": "silme_talebi", "isler.T5/S.atlanma_nedeni": "silme_talebi",
   "isler.T3/R.durum": "Başarısız", "isler.T3/R.hata_kodu": 131021, "isler.T3/R.icerik_silindi": True, "isler.T3/R.atlanma_nedeni": None,
   "isler.T1/G.post": 1, "isler.T2/M.post": 1, "isler.T3/R.post": 1, "isler.T5/S.post": 1, "isler.T4/N.post": 2,
   "yeniden.Y1": {"elenen": {"R": IS}, "alinan": [], "oneri": None}, "elenen": {}, "olusmadi": [], "toplular.T6.is_sayisi": 4,
   "kontroller.K3.isler": {"T1/G": "Atlandı", "T2/M": "Atlandı", "T3/R": "Başarısız", "T4/N": "Teslim Edildi", "T5/S": "Atlandı",
                           "T6/G": SINIR_B, "T6/M": SINIR_B, "T6/R": SINIR_B, "T6/S": SINIR_B},
   "kontroller.K4.isler": {"T1/G": "Atlandı", "T2/M": "Atlandı", "T3/R": "Başarısız", "T4/N": "Teslim Edildi", "T5/S": "Atlandı",
                           "T6/G": "Teslim Edildi", "T6/M": "Teslim Edildi", "T6/R": "Teslim Edildi", "T6/S": "Teslim Edildi"},
   "isler.T6/G.degiskenler": ["Gül Geçici", FIRMA, DON, "400,00 TL"], "isler.T6/G.telefon": "+905511002030",
   "meta.post": {"G": 2, "M": 2, "N": 2, "R": 2, "S": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(5)}}},
  meta_davranis={"mesaj": {"G": [_ys("+10s", {"hata": 131000}), "kabul"], "M": [_ys("+10s", {"hata": 131049}), "kabul"], "R": [_ys("+10s", {"hata": 131021}), "kabul"],
                           "N": [_ys("+10s", {"hata": 131000}), "kabul"], "S": [_ys("+10s", {"sinir": True}), "kabul"]}, "kanca": {"*": K_STD}})

S("S42-04-gonderiliyor-talep-gece-yarisi-yerel-gun-iz-gonderim-aninda", "S42",
  "31.10 23:59:50 (yerel; UTC 20:59:50) Ödeme Hatırlatma GB: istek 23:59:5x'te gider, yanıt gelmez (zaman aşımı 01.11'de); 23:59:56'da silme talebi → içerik silinir, iş Sonucu Belirsiz (iz "
  "GÖNDERİM ANINDA, 31.10); 01.11 00:24:50'de yeni hatırlatma GB'ye GİDER (yerel gün değişti — E3; UTC'de aynı gün). 01.11 23:59:50'de GK: istek gider, Meta'nın kabulü 10 sn gecikir (02.11'de "
  "gelir); 23:59:56'da talep → içerik silinir, kabul ize yazılır (iz 01.11), teslim 02.11; 02.11 00:24:50'de yeni hatırlatma GK'ye GİDER (aynı gün değil — D2 a), 00:44:50'de aynı gün "
  "'Daha Önce Gönderildi' (son 02.11)",
  "S42 (Y18-2/3/4/8) + K5 + D2 + E3 + Y14-9 + §7a 19", [
   cari_h("GB", "Gonca Belirsiz", "0552 100 20 30", [_h("2026-09-01", 300, 0)], vadeler=[_v("2026-10-10", 300)]),
   cari_h("GK", "Gani Kabul", "0552 200 30 40", [_h("2026-09-01", 400, 0)], vadeler=[_v("2026-10-12", 400)])],
  [baslat("+0s", "T1", ["GB"], sablon="hatirlatma"), olay("+6s", "kvkk_sil", id="GB"), kontrol_ic("+8s", "K1"), kontrol("+1m", "K2"),
   baslat("+25m", "T2", ["GB"], sablon="hatirlatma"),
   baslat("+24h", "T3", ["GK"], sablon="hatirlatma"), olay("+24h6s", "kvkk_sil", id="GK"), kontrol_ic("+24h8s", "K3"), kontrol("+24h2m", "K4"),
   baslat("+24h25m", "T4", ["GK"], sablon="hatirlatma"), baslat("+24h45m", "T5", ["GK"], sablon="hatirlatma")],
  {"kontroller.K1.isler": {"T1/GB": "Gönderiliyor"}, "kontroller.K1.icerik.T1/GB": SIL, "kontroller.K1.t": "2026-10-31T23:59:58+03:00",
   "kontroller.K2.isler": {"T1/GB": "Sonucu Belirsiz"},
   "isler.T1/GB.durum": "Sonucu Belirsiz", "isler.T1/GB.icerik_silindi": True, "isler.T1/GB.post": 1,
   "isler.T2/GB.durum": "Teslim Edildi", "isler.T2/GB.degiskenler": ["Gonca Belirsiz", FIRMA, "10.10.2026", "300,00 TL", "300,00 TL"], "isler.T2/GB.telefon": "+905521002030",
   "kontroller.K3.isler.T3/GK": "Gönderiliyor", "kontroller.K3.icerik.T3/GK": SIL, "kontroller.K3.t": "2026-11-01T23:59:58+03:00",
   "kontroller.K4.isler.T3/GK": "Teslim Edildi", "isler.T3/GK.icerik_silindi": True, "isler.T3/GK.telefon": None,
   "isler.T4/GK.durum": "Teslim Edildi", "isler.T4/GK.degiskenler": ["Gani Kabul", FIRMA, "12.10.2026", "400,00 TL", "400,00 TL"],
   "elenen": {"T5": {"GK": DO}}, "olusmadi": ["T5"], "onceki_uyari": {"T5": {"sayi": 1, "son": "2026-11-02"}},
   "meta.post": {"GB": 2, "GK": 2}, "bu_ay": {"W1": {"2026-11": ay_kova(3)}}},
  baslangic="2026-10-31T23:59:50+03:00",
  meta_davranis={"mesaj": {"GB": [_ys("+15s", "yanitsiz_kabul"), "kabul"], "GK": [_ys("+10s", "kabul"), "kabul"]},
                 "kanca": {"T1/GB": {"1": []}, "T3/GK": {"1": [["sent", "+20s"], ["delivered", "+30s"]]}, "*": K_STD}})


# ---- S43: wamid'i tanınmayan (bu kurulumun göndermediği) bildirim "bildirim yolu çalışıyor" işaretini KOYMAZ (Yol 2 imzalı, Yol 1 imzasız kabul); iş kimliğiyle tanınan koyar ----
S("S43-01-yol-2-imzali-taninmayan-bildirim-isaret-koymaz-ayni-donem-daha-once", "S43",
  "Yol 2, teslim süresi 12 sa: A ve B'nin iletisi Meta Kabul Etti, Meta'dan bu iletilere hiç bildirim gelmez; 1. saatte wamid'i tanınmayan (başka uygulamanın) İMZALI 'delivered', 6. saatte "
  "İMZALI 'read' gelir → kabul edilir (200) ama işareti KOYMAZ → 14. saatte iki iş de Meta Kabul Etti (Süresi Doldu olmaz); 15. saatte aynı dönem ikisi 'Daha Önce Gönderildi'",
  "S43 (Y18-12/14/15/16) + §7a 16 + J6 + W1 + G0 (2)", [A(), B()],
  [baslat("+0s", "T1", "AB"), olay("+1h", "sahte_kanca", wamid="wamid.BASKA-KURULUM-1", durum="delivered", imzali=True),
   olay("+6h", "sahte_kanca", wamid="wamid.BASKA-KURULUM-2", durum="read", imzali=True), kontrol("+14h", "K1"), baslat("+15h", "T2", "AB")],
  {"kontroller.K1.isler": {"T1/A": "Meta Kabul Etti", "T1/B": "Meta Kabul Etti"}, "isler.T1/A.durum": "Meta Kabul Etti", "isler.T1/B.durum": "Meta Kabul Etti",
   "elenen": {"T2": {"A": DO, "B": DO}}, "olusmadi": ["T2"], "onceki_uyari": {"T2": {"sayi": 2, "son": "2026-10-30"}},
   "kanca_yanitlari": {"200": 2, "503": 0}, "meta.post": {"A": 1, "B": 1}, "bu_ay": {}},
  ayar={"baglanti_yolu": "yol2"}, meta=META_12SA, kanca_yanit_cikti=True, meta_davranis={"kanca": {"*": []}})

S("S43-02-yol-1-imzasiz-taninmayan-bildirim-kabul-isaret-koymaz", "S43",
  "Yol 1 (Elle Bağla — imzasız bildirim kabul), teslim süresi 12 sa: A ve B'nin iletisi Meta Kabul Etti, Meta'dan bildirim gelmez; 1. saatte wamid'i tanınmayan İMZASIZ 'delivered' gelir → Yol 1'de "
  "kabul edilir (200) ama işareti KOYMAZ → 14. saatte iki iş de Meta Kabul Etti; 15. saatte aynı dönem ikisi 'Daha Önce Gönderildi' (S33'ün Yol 2'de kapattığı yol Yol 1'de de kapalı)",
  "S43 (Y18-12/14/15/16) + S41 (Y17-26) + §7a 16 + W1 + G0 (2)", [A(), B()],
  [baslat("+0s", "T1", "AB"), olay("+1h", "sahte_kanca", wamid="wamid.BASKA-KURULUM-1", durum="delivered"), kontrol("+14h", "K1"), baslat("+15h", "T2", "AB")],
  {"kontroller.K1.isler": {"T1/A": "Meta Kabul Etti", "T1/B": "Meta Kabul Etti"},
   "elenen": {"T2": {"A": DO, "B": DO}}, "olusmadi": ["T2"], "onceki_uyari": {"T2": {"sayi": 2, "son": "2026-10-30"}},
   "kanca_yanitlari": {"200": 1, "503": 0}, "meta.post": {"A": 1, "B": 1}, "bu_ay": {}},
  ayar={"baglanti_yolu": "yol1"}, meta=META_12SA, kanca_yanit_cikti=True, meta_davranis={"kanca": {"*": []}})

S("S43-03-yol-2-is-kimligiyle-taninan-bildirim-isaret-koyar-sure-dolar", "S43",
  "Yol 2, teslim süresi 12 sa: A'nın iletisi Meta Kabul Etti (bildirimi yok); C'nin isteğine yanıt gelmez (Sonucu Belirsiz — wamid'i programda yok); 1. saatte Meta'nın C iletisine İMZALI 'sent' "
  "bildirimi gelir → bu kurulumun iletisi, iş kimliğiyle TANINIR (tanınmayan sınıfına girmez): C çözülür (Gönderildi) ve işaret KONUR → 14. saatte A ve C Süresi Doldu; 15. saatte aynı dönem ikisine "
  "yeniden gider (Süresi Doldu sayılmaz — K3)",
  "S43 (Y18-13) + §5 yorum 4 + §7a 16 + H1 + K3 + W1", [A(), C()],
  [baslat("+0s", "T1", "AC"), kontrol("+2h", "K1"), kontrol("+14h", "K2"), baslat("+15h", "T2", "AC")],
  {"kontroller.K1.isler": {"T1/A": "Meta Kabul Etti", "T1/C": "Gönderildi"}, "kontroller.K2.isler": {"T1/A": "Süresi Doldu", "T1/C": "Süresi Doldu"},
   "elenen": {}, "olusmadi": [], "onceki_uyari": {}, "toplular.T2.is_sayisi": 2,
   "isler.T2/A.durum": "Süresi Doldu", "isler.T2/C.durum": "Süresi Doldu",          # işaret (1. saat) 7 gün geçerli → yeni iletiler de 15 + 13 = 28. saatte Süresi Doldu (ufuk 10 gün)
   "meta.post": {"A": 2, "C": 2}, "bu_ay": {}},
  ayar={"baglanti_yolu": "yol2"}, meta=META_12SA,
  meta_davranis={"mesaj": {"C": ["yanitsiz_kabul", "kabul"]}, "kanca": {"T1/C": {"1": [["sent", "+1s", {"varis": "+1h"}]]}, "*": []}})


# ======================================================================== kâhin güncellemesi 19 (2.5.0, KULLANICI KARARI 06.11.2026 12:06 UTC "ÖNERİLERİNİ UYGULA": S58–S63 = A — README §24)
# Elle beklenen YALNIZ karar metinlerinden (kahin.KARARLAR S58…S63) ve README §24.2–24.7 yorumlarından (kodlamadan önce yazıldı, ayrı commit). Yeni olaylar `yol_degisti {sirket, yol}` (S58) ve
# `kanca_kaydi {sirket}` (S63); yeni girdi alanı `ayar.baglanti_yollari {şirket: yol1 | yol2}` (S63). Yeni çıktı alanı YOK.
TESLIM_E = "Teslim Edildi"
KABUL_E = "Meta Kabul Etti"
SD = "Süresi Doldu"
TS = "telefonsuz"
K49_GEC = lambda varis: [["sent", "+1s"], ["failed", "+10s", {"kod": 131049}], ["delivered", "+20s", {"varis": varis}]]   # Meta Bekletti + 1. iletinin GEÇ teslimi


def iki_sirket(*cariler_):
    return {"firmalar": {"A": "Alfa Ltd.", "B": "Beta Ltd."}, "wabalar": {"A": "W1", "B": "W1"}}


# ---- S58: bağlantı yolu (kip) değişince "bildirim yolu çalışıyor" işareti sıfırlanır — yeni yolun bildirimi gelmeden TTL + 1 sa'i geçen iş Süresi Doldu OLMAZ ----
S("S58-01-yol-1-den-yol-2-ye-teslim-suresinden-once-isaret-sifirlanir-sure-dolmaz", "S58",
  "Yol 1 (Elle Bağla), teslim süresi 12 sa: A'nın iletisi Teslim Edildi (imzasız bildirim kabul — işaret konur), B'nin iletisine Meta'dan bildirim gelmez; 2. saatte bağlantı Yol 2'ye geçer → işaret "
  "SIFIRLANIR; 14. saatte (B'nin TTL + 1 sa'i 13. saatte doldu) B 'Meta Kabul Etti'de (Süresi Doldu olmaz); 15. saatte aynı dönem A ve B 'Daha Önce Gönderildi' (son 30.10), toplu iş oluşmaz",
  "S58 (Y19-1/2/3) + §7a 16 + S41 + W1 + R3 + G0 (2)", [A(), B()],
  [baslat("+0s", "T1", "AB"), olay("+2h", "yol_degisti", yol="yol2"), kontrol("+14h", "K1"), baslat("+15h", "T2", "AB")],
  {"kontroller.K1.isler": {"T1/A": TESLIM_E, "T1/B": KABUL_E}, "isler.T1/B.durum": KABUL_E,
   "elenen": {"T2": {"A": DO, "B": DO}}, "olusmadi": ["T2"], "onceki_uyari": {"T2": {"sayi": 2, "son": "2026-10-30"}},
   "meta.post": {"A": 1, "B": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(1)}}},
  ayar={"baglanti_yolu": "yol1"}, meta=META_12SA, meta_davranis={"kanca": {"A": K_STD, "B": []}})

S("S58-02-yol-2-den-yol-1-e-teslim-suresinden-sonra-sure-doldu-kalir-yeni-yolun-ilk-bildirimi", "S58",
  "Yol 2, teslim süresi 12 sa: A Teslim Edildi (işaret), B'ye bildirim yok → 13. saatte Süresi Doldu; 15. saatte Yol 1'e geçilir (işaret sıfırlanır) — B Süresi Doldu KALIR; 16. saatte C'ye ekstre "
  "gider, bildirimi gelmez; 30. saatte (C'nin TTL + 1 sa'i 29. saatte doldu) C 'Meta Kabul Etti'de (yeni yolun bildirimi yok); 31. saatte E'ye ekstre gider, Yol 1'de imzasız bildirimi kabul edilir "
  "(yeni yolun ilk bildirimi → işaret) → süresi geçmiş C o anda Süresi Doldu (§7a 16); 33. saatte aynı dönem B ve C'ye yeniden gider (Süresi Doldu sayılmaz — K3), A ve E 'Daha Önce Gönderildi'",
  "S58 (Y19-2/3/4) + §7a 16, 17 + S41 + K3 + W1 + R3", [A(), B(), C(), E()],
  [baslat("+0s", "T1", "AB"), kontrol("+14h", "K1"), olay("+15h", "yol_degisti", yol="yol1"), kontrol("+15h30m", "K2"),
   baslat("+16h", "T2", "C"), kontrol("+30h", "K3"), baslat("+31h", "T3", "E"), kontrol("+32h", "K4"), baslat("+33h", "T4", "ABCE")],
  {"kontroller.K1.isler": {"T1/A": TESLIM_E, "T1/B": SD}, "kontroller.K2.isler": {"T1/A": TESLIM_E, "T1/B": SD},
   "kontroller.K3.isler": {"T1/A": TESLIM_E, "T1/B": SD, "T2/C": KABUL_E},
   "kontroller.K4.isler": {"T1/A": TESLIM_E, "T1/B": SD, "T2/C": SD, "T3/E": TESLIM_E},
   "elenen": {"T4": {"A": DO, "E": DO}}, "olusmadi": [], "onceki_uyari": {"T4": {"sayi": 2, "son": "2026-10-31"}}, "toplular.T4.is_sayisi": 2,
   "meta.post": {"A": 1, "B": 2, "C": 2, "E": 1}},
  ayar={"baglanti_yolu": "yol2"}, meta=META_12SA, meta_davranis={"kanca": {"A": K_STD, "B": [], "C": [], "E": K_STD}})

S("S58-03-geri-donus-yol-1-yol-2-yol-1-her-degisim-sifirlar-eski-isaret-gelmez", "S58",
  "Yol 1, teslim süresi 12 sa: A Teslim Edildi (işaret), B'ye bildirim yok; 1. saatte Yol 2'ye, 2. saatte yeniden Yol 1'e dönülür — HER değişim işareti sıfırlar, eski kipe dönmek o kipin eski "
  "işaretini GERİ GETİRMEZ (Y19-5); 14. saatte B 'Meta Kabul Etti'de; 15. saatte aynı dönem A ve B 'Daha Önce Gönderildi'",
  "S58 (Y19-2/5) + §7a 16 + W1 + R3 + G0 (2)", [A(), B()],
  [baslat("+0s", "T1", "AB"), olay("+1h", "yol_degisti", yol="yol2"), olay("+2h", "yol_degisti", yol="yol1"), kontrol("+14h", "K1"), baslat("+15h", "T2", "AB")],
  {"kontroller.K1.isler": {"T1/A": TESLIM_E, "T1/B": KABUL_E},
   "elenen": {"T2": {"A": DO, "B": DO}}, "olusmadi": ["T2"], "onceki_uyari": {"T2": {"sayi": 2, "son": "2026-10-30"}},
   "meta.post": {"A": 1, "B": 1}},
  ayar={"baglanti_yolu": "yol1"}, meta=META_12SA, meta_davranis={"kanca": {"A": K_STD, "B": []}})


# ---- S59: silme talebiyle "Atlandı" olmuş Meta Bekletti işine GEÇ teslim → "Teslim Edildi" (Y17-9 değişti); İptal'deki ekran KÂHİN SUSUYOR kalır ----
S("S59-01-talep-atlandi-meta-bekletti-gec-teslim-teslim-edildi-iptal-ile-karsilastirma", "S59",
  "Ekim ekstresi: D ve E'nin iletisi Meta Bekletti (131049); 30. dakikada E'nin toplu işi İptal Edilir; 1. saatte D silme talebinde bulunur → 'Atlandı — Silme Talebi' (içerik silinir; PDF bakım "
  "turunda silinir — S60); 3. saatte D'nin 1. iletisinin GEÇ teslimi gelir → D 'Teslim Edildi' (S59: atlanma nedeni kalkar, 2. deneme yine gitmez, POST 1; 'Bu Ay' +1); E'nin 1. iletisinin geç "
  "teslimi de gelir → E'nin ekranı İptal / Teslim Edildi seçenekli kalır (K3 / K7 KÂHİN SUSUYOR — S59 İptal'i kapsamaz); 5. saatte D'ye gelen geç 'failed' yok sayılır (§7a 18); 6. saatte aynı "
  "dönem D ve E 'Daha Önce Gönderildi' (J1)",
  "S59 (Y19-9/10/12) + S35 + S60 + J1 + J5 + K3 / K7 + §7a 17, 18", [D(), E()],
  [baslat("+0s", "T1", "D"), baslat("+0s", "T2", "E"), olay("+30m", "iptal", toplu="T2"), olay("+1h", "kvkk_sil", id="D"), kontrol_ic("+2h", "K1"),
   kontrol("+4h", "K2"), kontrol("+5h30m", "K3"), baslat("+6h", "T3", "DE")],
  {"kontroller.K1.isler": {"T1/D": "Atlandı", "T2/E": "İptal"}, "kontroller.K1.icerik.T1/D": SIL,
   "kontroller.K2.isler": {"T1/D": TESLIM_E, "T2/E": {"secenek": ["İptal", TESLIM_E], "susuyor": GEC}}, "kontroller.K2.medya_silme": 2,
   "kontroller.K3.isler.T1/D": TESLIM_E,
   "isler.T1/D.durum": TESLIM_E, "isler.T1/D.atlanma_nedeni": None, "isler.T1/D.hata_kodu": None, "isler.T1/D.post": 1, "isler.T1/D.medya_silme": 1,
   "isler.T1/D.icerik_silindi": True, "isler.T1/D.telefon": None,
   "elenen": {"T3": {"D": DO, "E": DO}}, "olusmadi": ["T3"], "onceki_uyari": {"T3": {"sayi": 2, "son": "2026-10-30"}},
   "meta.post": {"D": 1, "E": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta_davranis={"kanca": {"T1/D": {"1": K49_GEC("+3h") + [["failed", "+30s", {"kod": 131026, "varis": "+5h"}]], "*": K_STD},
                           "T2/E": {"1": K49_GEC("+3h"), "*": K_STD}, "*": K_STD}})

S("S59-02-teslim-talepten-once-ve-sonra-iki-sira-teslim-edildi-ay-donumu", "S59",
  "31.10 21:00 (yerel; UTC 18:00) Ekim ekstresi: B ve D'nin iletisi Meta Bekletti; D 22:00'de silme talebinde bulunur → Atlandı (PDF silinir — S60); B'nin 1. iletisi 23:30'da teslim edilir "
  "(J2: iş Teslim Edildi, 2. deneme gitmez), B 01.11 00:30'da silme talebinde bulunur → içerik silinir, iş Teslim Edildi KALIR; D'nin 1. iletisi 01.11 22:00'de (24 saatlik 2. deneme anı geçtikten "
  "sonra) GEÇ teslim edilir → D 'Teslim Edildi' (S59) — iki sıra aynı son duruma iner (Y19-11); 'Bu Ay' Ekim 1 (B) + Kasım 1 (D; Türkiye saatiyle teslim ayı); 02.11 00:00'da aynı dönem B ve D "
  "'Daha Önce Gönderildi'",
  "S59 (Y19-9/10/11) + S60 + J2 + J5 + §7a 19 + Y15-20", [B(), D()],
  [baslat("+0s", "T1", "BD"), olay("+1h", "kvkk_sil", id="D"), kontrol("+2h", "K1"), olay("+3h30m", "kvkk_sil", id="B"), kontrol_ic("+4h", "K2"),
   kontrol("+26h", "K3"), baslat("+27h", "T2", "BD")],
  {"kontroller.K1.isler": {"T1/B": BEKLETTI, "T1/D": "Atlandı"},
   "kontroller.K2.isler": {"T1/B": TESLIM_E, "T1/D": "Atlandı"}, "kontroller.K2.icerik": {"T1/B": SIL, "T1/D": SIL}, "kontroller.K2.medya_silme": 2,
   "kontroller.K3.isler": {"T1/B": TESLIM_E, "T1/D": TESLIM_E}, "kontroller.K3.t": "2026-11-01T23:00:00+03:00",
   "isler.T1/D.atlanma_nedeni": None, "isler.T1/D.post": 1, "isler.T1/B.post": 1, "isler.T1/B.icerik_silindi": True,
   "elenen": {"T2": {"B": DO, "D": DO}}, "olusmadi": ["T2"], "onceki_uyari": {"T2": {"sayi": 2, "son": "2026-10-31"}},
   "meta.post": {"B": 1, "D": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(1), "2026-11": ay_kova(1)}}},
  baslangic="2026-10-31T21:00:00+03:00",
  meta_davranis={"kanca": {"T1/B": {"1": [["sent", "+1s"], ["failed", "+10s", {"kod": 131049}], ["delivered", "+2h30m"]]},
                           "T1/D": {"1": [["sent", "+1s"], ["failed", "+10s", {"kod": 131049}], ["delivered", "+25h"]]}, "*": K_STD}})


# ---- S60: içeriği silinip Atlandı olan işin Meta'daki PDF'i bir sonraki bakım turunda silinir; Sonucu Belirsiz (kapanmamış) işte uygulanmaz; İptal eskisi gibi KÂHİN SUSUYOR ----
S("S60-01-atlandi-meta-bekletti-ve-s42-pdf-silinir-belirsiz-silinmez", "S60",
  "Ekim ekstresi: G'nin isteğine Meta'nın yanıtı 10 sn gecikir (geçici hata 131000) ve istek sürerken (5. sn) G silme talebinde bulunur → yanıt anında 'Atlandı — Silme Talebi' (S42) → PDF silinir; 1. "
  "dakikada D (Meta Bekletti), U ve V (yanıt gelmez — Sonucu Belirsiz) gönderilir; 1. saatte D, U, V silme talebinde bulunur → D 'Atlandı' (PDF bakım turunda silinir), U ve V Sonucu Belirsiz kalır "
  "(iş kapanmadı — PDF silinmez); 3. saatte silinen PDF 2 (G, D); 4. saatte V'nin iletisine imzalı GEÇ teslim → V Teslim Edildi (kesinleşir, PDF silinir); 5. saatte 3; U'nun PDF'i ufukta da durur",
  "S60 (Y19-15/16/17) + S42 + S35 + S30 + H1 + §11 S3 + Y10-7", [
   cari("G", "Gül Geçici", "0551 100 20 30", [("2026-10-05", 400, 0)]), D(),
   cari("U", "Umut Belirsiz", "0551 600 70 80", [("2026-10-06", 300, 0)]), cari("V", "Veli Geçteslim", "0551 700 80 90", [("2026-10-07", 200, 0)])],
  [baslat("+0s", "T1", ["G"]), olay("+5s", "kvkk_sil", id="G"), baslat("+1m", "T2", ["D", "U", "V"]),
   olay("+1h", "kvkk_sil", id="D"), olay("+1h", "kvkk_sil", id="U"), olay("+1h", "kvkk_sil", id="V"), kontrol_ic("+3h", "K1"), kontrol("+5h", "K2")],
  {"kontroller.K1.isler": {"T1/G": "Atlandı", "T2/D": "Atlandı", "T2/U": "Sonucu Belirsiz", "T2/V": "Sonucu Belirsiz"}, "kontroller.K1.medya_silme": 2,
   "kontroller.K1.icerik": {"T1/G": SIL, "T2/D": SIL, "T2/U": SIL, "T2/V": SIL},
   "kontroller.K2.isler": {"T1/G": "Atlandı", "T2/D": "Atlandı", "T2/U": "Sonucu Belirsiz", "T2/V": TESLIM_E}, "kontroller.K2.medya_silme": 3,
   "isler.T1/G.medya_silme": 1, "isler.T2/D.medya_silme": 1, "isler.T2/U.medya_silme": 0, "isler.T2/V.medya_silme": 1,
   "isler.T1/G.atlanma_nedeni": "silme_talebi", "isler.T2/D.atlanma_nedeni": "silme_talebi", "isler.T2/U.durum": "Sonucu Belirsiz", "isler.T2/U.medya_yukleme": 1,
   "meta.medya_silme": {"D": 1, "G": 1, "U": 0, "V": 1}, "meta.post": {"D": 1, "G": 1, "U": 1, "V": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(1)}}},
  meta_davranis={"mesaj": {"G": [_ys("+10s", {"hata": 131000}), "kabul"], "U": ["yanitsiz_kabul", "kabul"], "V": ["yanitsiz_kabul", "kabul"]},
                 "kanca": {"T2/D": {"1": K49, "*": K_STD}, "T2/U": {"1": []}, "T2/V": {"1": [["delivered", "+5s", {"varis": "+4h"}]]}, "*": K_STD}})

S("S60-02-iptal-pdf-susuyor-atlandi-silinir-teslim-sonra-talep-bir-kez", "S60",
  "Ekim ekstresi: W, X ve Y'nin iletisi Meta Bekletti; W'nin 1. iletisi 20. dakikada teslim edilir (J2: Teslim Edildi, PDF kesinleşmede silinir); 30. dakikada X'in toplu işi İptal Edilir; 1. saatte "
  "W, X ve Y silme talebinde bulunur → Y 'Atlandı' (PDF bakım turunda silinir — S60), X İptal kalır (içerik silinir; PDF'i eskisi gibi KÂHİN SUSUYOR — S60 İptal'i kapsamaz), W Teslim Edildi kalır "
  "(PDF bir kez silinmişti); ufukta silinen PDF: W 1, Y 1, X denetlenmez",
  "S60 (Y19-15/16/17) + S35 + J2 + §11 S3 + Y15-20", [
   cari("W", "Vedat Teslim", "0552 100 20 30", [("2026-10-05", 100, 0)]), cari("X", "Xenia İptal", "0552 200 30 40", [("2026-10-06", 200, 0)]),
   cari("Y", "Yasin Atlandı", "0552 300 40 50", [("2026-10-07", 300, 0)])],
  [baslat("+0s", "T1", ["W", "Y"]), baslat("+0s", "T2", ["X"]), olay("+30m", "iptal", toplu="T2"),
   olay("+1h", "kvkk_sil", id="W"), olay("+1h", "kvkk_sil", id="X"), olay("+1h", "kvkk_sil", id="Y"), kontrol_ic("+3h", "K1")],
  {"kontroller.K1.isler": {"T1/W": TESLIM_E, "T1/Y": "Atlandı", "T2/X": "İptal"}, "kontroller.K1.icerik": {"T1/W": SIL, "T1/Y": SIL, "T2/X": SIL},
   "isler.T1/W.medya_silme": 1, "isler.T1/Y.medya_silme": 1, "isler.T2/X.medya_silme": {"plan_susuyor": kahin.Benzetim.PDF_SILME_SUSUYOR},
   "isler.T1/Y.atlanma_nedeni": "silme_talebi", "isler.T2/X.durum": "İptal", "isler.T1/W.durum": TESLIM_E,
   "meta.post": {"W": 1, "X": 1, "Y": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(1)}}},
  meta_davranis={"kanca": {"T1/W": {"1": [["sent", "+1s"], ["failed", "+10s", {"kod": 131049}], ["delivered", "+20m"]]}, "T1/Y": {"1": K49}, "T2/X": {"1": K49}, "*": K_STD}})


# ---- S61: içeriği ve kart telefonu silinmiş Ödeme Hatırlatma işi yeniden denenince "Telefon Yok" ile ALINMAZ (iş Başarısız kalır, neden görünür; yeni gönderimle aynı) ----
TY = cari_h("TY", "Tuncay Yok", "0549 310 41 51", [_h("2026-09-01", 450, 0)], vadeler=[_v("2026-10-14", 450)])
TK = cari_h("TK", "Tülay Kart", "0549 320 42 52", [_h("2026-09-01", 300, 0)], vadeler=[_v("2026-10-15", 300)])

S("S61-01-hatirlatma-telefonsuz-alinmaz-is-basarisiz-ekstre-icerik-silindi-telefon-girilince-gider", "S61",
  "30.10 Ödeme Hatırlatma: A gider, TY ve TK alıcı hatasıyla (131021) Başarısız; Ekim ekstresinde TE de Başarısız; 1. saatte TY, TK, TE silme talebinde bulunur ve kartlarındaki telefonlar silinir; "
  "2. saatte Başarısızları Yeniden Dene: TY ve TK 'Telefon Yok' (telefonsuz) ile ALINMAZ, işler Başarısız kalır (S61); Ekstre'de TE 'içerik silindi' (S31 — S61 Ekstre'ye uygulanmaz); aynı anda yeni "
  "hatırlatma TY'yi aynı nedenle eler (yeni gönderimle aynı); 3. saatte TK'nin kartına telefon yeniden girilir (kullanıcı girer — silinen kayıttan değil); 4. saatte Başarısızları Yeniden Dene TK'yi ALIR (S37: "
  "içerik ve telefon karttan) ve gider, TY yine 'Telefon Yok'",
  "S61 (Y19-20/21/22) + S37 + S31 + SW3 (Y15-16) + §7a 6", [A7(), TY, TK, cari("TE", "Ekin Ekstre", "0549 330 43 53", [("2026-10-05", 600, 0)])],
  [baslat("+0s", "T1", ["A", "TY", "TK"], sablon="hatirlatma"), baslat("+0s", "T2", ["TE"]),
   olay("+1h", "kvkk_sil", id="TY"), olay("+1h", "kvkk_sil", id="TK"), olay("+1h", "kvkk_sil", id="TE"),
   olay("+1h", "cari", id="TY", telefon=None), olay("+1h", "cari", id="TK", telefon=None), olay("+1h", "cari", id="TE", telefon=None), kontrol_ic("+1h30m", "K1"),
   olay("+2h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), olay("+2h", "basarisizlari_yeniden_dene", toplu="T2", etiket="Y2"),
   baslat("+2h", "T3", ["TY"], sablon="hatirlatma"), olay("+3h", "cari", id="TK", telefon="0549 320 42 52"),
   olay("+4h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y3"), kontrol_ic("+5h", "K2")],
  {"kontroller.K1.isler": {"T1/A": TESLIM_E, "T1/TK": "Başarısız", "T1/TY": "Başarısız", "T2/TE": "Başarısız"},
   "kontroller.K1.icerik.T1/TY": SIL, "kontroller.K1.icerik.T1/TK": SIL, "kontroller.K1.icerik.T2/TE": SIL,
   "yeniden.Y1": {"elenen": {"TK": TS, "TY": TS}, "alinan": [], "oneri": None}, "yeniden.Y2": {"elenen": {"TE": IS}, "alinan": [], "oneri": None},
   "elenen.T3": {"TY": TS}, "olusmadi": ["T3"],
   "yeniden.Y3": {"elenen": {"TY": TS}, "alinan": ["TK"], "oneri": None},
   "kontroller.K2.isler": {"T1/A": TESLIM_E, "T1/TK": TESLIM_E, "T1/TY": "Başarısız", "T2/TE": "Başarısız"},
   "kontroller.K2.icerik.T1/TK": _hat("+905493204252", "Tülay Kart", "15.10.2026", "300,00 TL"), "kontroller.K2.icerik.T1/TY": SIL,
   "isler.T1/TY.durum": "Başarısız", "isler.T1/TY.hata_kodu": 131021, "isler.T1/TY.atlanma_nedeni": None, "isler.T1/TY.post": 1, "isler.T1/TY.icerik_silindi": True,
   "isler.T1/TK.post": 2, "isler.T2/TE.durum": "Başarısız",
   "meta.post": {"A": 1, "TE": 1, "TK": 2, "TY": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta_davranis={"mesaj": {"TY": [{"hata": 131021}], "TK": [{"hata": 131021}, "kabul"], "TE": [{"hata": 131021}]}, "kanca": {"*": K_STD}})

S("S61-02-telefon-yok-e2-nedenlerinden-once-yeni-gonderimle-ayni-sira", "S61",
  "30.10 Ödeme Hatırlatma: RS ve RD'nin ilk işi alıcı hatasıyla (131021) Başarısız; 10. dakikada ikisine yeni hatırlatma: RS'ninki Sonucu Belirsiz, RD'ninki Teslim Edildi; 1. saatte ikisi silme talebinde "
  "bulunur, kart telefonları silinir; 2. saatte asıl işte Başarısızları Yeniden Dene: ikisi de 'Telefon Yok' ile elenir — telefon denetimi E2 nedenlerinden (aynı gün Sonucu Belirsiz / Daha Önce "
  "Gönderildi) ÖNCE, yeni gönderimdeki sırayla aynı; aynı anda yeni hatırlatma da ikisini 'Telefon Yok' ile eler",
  "S61 (Y19-21) + E2 + E3 + K6 + SW3 (Y15-16) + R3T (Y20-16: aynı gün almış telefonsuz RD yeni hatırlatmada R3 uyarısında sayılır)", [
   cari_h("RS", "Rasim Sıra", "0549 410 51 61", [_h("2026-09-01", 350, 0)], vadeler=[_v("2026-10-13", 350)]),
   cari_h("RD", "Ruhi Daha", "0549 420 52 62", [_h("2026-09-01", 250, 0)], vadeler=[_v("2026-10-12", 250)])],
  [baslat("+0s", "T1", ["RS", "RD"], sablon="hatirlatma"), baslat("+10m", "T2", ["RS", "RD"], sablon="hatirlatma"), kontrol("+30m", "K1"),
   olay("+1h", "kvkk_sil", id="RS"), olay("+1h", "kvkk_sil", id="RD"), olay("+1h", "cari", id="RS", telefon=None), olay("+1h", "cari", id="RD", telefon=None),
   olay("+2h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y1"), baslat("+2h", "T3", ["RS", "RD"], sablon="hatirlatma")],
  {"kontroller.K1.isler": {"T1/RD": "Başarısız", "T1/RS": "Başarısız", "T2/RD": TESLIM_E, "T2/RS": "Sonucu Belirsiz"},
   "yeniden.Y1": {"elenen": {"RD": TS, "RS": TS}, "alinan": [], "oneri": None},
   "elenen.T3": {"RD": TS, "RS": TS}, "olusmadi": ["T3"], "onceki_uyari": {"T3": {"sayi": 1, "son": "2026-10-30"}},   # güncelleme 20 R3T (Y20-16)
   "isler.T1/RS.durum": "Başarısız", "isler.T1/RD.durum": "Başarısız", "isler.T1/RS.post": 1, "isler.T1/RD.post": 1,
   "isler.T2/RS.durum": "Sonucu Belirsiz", "isler.T2/RS.icerik_silindi": True,
   "meta.post": {"RD": 2, "RS": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(1)}}},
  meta_davranis={"mesaj": {"RS": [{"hata": 131021}, "yanitsiz_kabul"], "RD": [{"hata": 131021}, "kabul"]}, "kanca": {"T2/RS": {"1": []}, "*": K_STD}})


# ---- S62: salt okunur lisansta KVKK silme talebi AÇIK — talep ve sonuçları geçerli lisanstaki gibi (kâhinde hesap aynen; karar kaynağı + senaryo + mutant) ----
S("S62-01-salt-okunurda-talep-acik-lisans-bekleyen-atlandi-belirsiz-iz-geri-yuklemede-uygulanir", "S62",
  "Ekim ekstresi: A ve B Teslim Edildi, U Sonucu Belirsiz, D Meta Bekletti; 10. dakikada yedek Y0; 30. dakikada (geçerli lisans) B silme talebinde bulunur; 1. saatte lisans salt okunur (D 'Lisans "
  "Nedeniyle Durdu'); 2. saatte SALT OKUNURDA A, U ve D silme talebinde bulunur → talep AÇIK: içerikler silinir, D talep anında 'Atlandı — Silme Talebi' (PDF silinir — S60), U Sonucu Belirsiz kalır; "
  "3. saatte lisans geçerli, 4. saatte D'nin toplu işinde Devam Et etkisiz (D gitmez); 5. saatte talepten önceki Y0 geri yüklenir → salt okunurda yapılan talepler de makinede kayıtlı, yeniden "
  "uygulanır (içerik GELMEZ — S32); 6. saatte aynı dönem A ve B 'Daha Önce Gönderildi', U 'Sonucu Belirsiz', D yeni işle gider (Meta Bekletti sayılmaz — K7)",
  "S62 (Y19-25/26/27) + S35 + S30 + S32 + S60 + §7a 25, 26 + K7 + D1", [A(), B(), cari("U", "Umut Belirsiz", "0551 600 70 80", [("2026-10-06", 300, 0)]), D()],
  [baslat("+0s", "T1", "ABU"), baslat("+0s", "T2", "D"), olay("+10m", "yedek_al", ad="Y0"), olay("+30m", "kvkk_sil", id="B"),
   olay("+1h", "lisans", yazilabilir=False), kontrol("+1h30m", "K1"),
   olay("+2h", "kvkk_sil", id="A"), olay("+2h", "kvkk_sil", id="U"), olay("+2h", "kvkk_sil", id="D"), kontrol_ic("+2h30m", "K2"),
   olay("+3h", "lisans", yazilabilir=True), olay("+4h", "devam", toplu="T2"), kontrol("+4h30m", "K3"),
   olay("+5h", "geri_yukle", yedek="Y0"), kontrol_ic("+5h30m", "K4"), baslat("+6h", "T3", "ABUD")],
  {"kontroller.K1.isler": {"T1/A": TESLIM_E, "T1/B": TESLIM_E, "T1/U": "Sonucu Belirsiz", "T2/D": "Lisans Nedeniyle Durdu"},
   "kontroller.K2.isler": {"T1/A": TESLIM_E, "T1/B": TESLIM_E, "T1/U": "Sonucu Belirsiz", "T2/D": "Atlandı"},
   "kontroller.K2.icerik": {"T1/A": SIL, "T1/B": SIL, "T1/U": SIL, "T2/D": SIL},
   "kontroller.K3.isler": {"T1/A": TESLIM_E, "T1/B": TESLIM_E, "T1/U": "Sonucu Belirsiz", "T2/D": "Atlandı"}, "kontroller.K3.medya_silme": 3, "kontroller.K3.toplam_post": 4,
   "kontroller.K4.icerik": {"T1/A": SIL, "T1/B": SIL, "T1/U": SIL, "T2/D": SIL}, "kontroller.K4.isler.T2/D": GERI,
   "elenen": {"T3": {"A": DO, "B": DO, "U": "sonucu_belirsiz"}}, "olusmadi": [], "onceki_uyari": {"T3": {"sayi": 2, "son": "2026-10-30"}}, "toplular.T3.is_sayisi": 1,
   "isler.T3/D.durum": TESLIM_E, "meta.post": {"A": 1, "B": 1, "D": 2, "U": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(3)}}},
  meta_davranis={"mesaj": {"U": ["yanitsiz_kabul", "kabul"]}, "kanca": {"T2/D": {"1": K49, "*": K_STD}, "T1/U": {"1": []}, "*": K_STD}})

S("S62-02-salt-okunurda-talep-sinir-lisans-atlandi-yeni-gonderim-baslamaz-lisans-donunce-gider", "S62",
  "Ödeme Hatırlatma, günlük sınır 1: BH'nin isteğine yanıt gelmez (Sonucu Belirsiz), A gider, SB sınırda bekler; 1. saatte lisans salt okunur (SB 'Lisans Nedeniyle Durdu'); 2. saatte SALT OKUNURDA SB "
  "ve BH silme talebinde bulunur → SB talep anında 'Atlandı — Silme Talebi', BH Sonucu Belirsiz kalır (içerik silinir); 2 sa 10 dk'da salt okunurda yeni hatırlatma BAŞLAMAZ (talep yeni iş "
  "üretmez); 3. saatte lisans geçerli; 4. saatte yeni hatırlatma: SB 'Zaten Kuyrukta' DEĞİL (kapanan iş) → alınır, sınır penceresi açılınca karttaki telefonla gider; BH aynı yerel gün 'Sonucu Belirsiz'",
  "S62 (Y19-25/26) + S35 + S30 + E3 + §7a 25, 29 + SW2", [
   cari_h("BH", "Berk Belirsiz", "0548 100 20 30", [_h("2026-09-01", 300, 0)], vadeler=[_v("2026-10-10", 300)]), A7(),
   cari_h("SB", "Selim Sınırda", "0543 300 40 50", [_h("2026-09-01", 400, 0)], vadeler=[_v("2026-10-11", 400)])],
  [baslat("+0s", "T1", ["BH", "A", "SB"], sablon="hatirlatma"), kontrol("+30m", "K0"), olay("+1h", "lisans", yazilabilir=False), kontrol("+1h30m", "K1"),
   olay("+2h", "kvkk_sil", id="SB"), olay("+2h", "kvkk_sil", id="BH"), kontrol_ic("+2h5m", "K2"), baslat("+2h10m", "T2", ["SB"], sablon="hatirlatma"),
   olay("+3h", "lisans", yazilabilir=True), baslat("+4h", "T3", ["SB", "BH"], sablon="hatirlatma"), kontrol("+4h5m", "K3"), kontrol("+25h", "K4")],
  {"kontroller.K0.isler": {"T1/A": TESLIM_E, "T1/BH": "Sonucu Belirsiz", "T1/SB": SINIR_B},
   "kontroller.K1.isler": {"T1/A": TESLIM_E, "T1/BH": "Sonucu Belirsiz", "T1/SB": "Lisans Nedeniyle Durdu"},
   "kontroller.K2.isler": {"T1/A": TESLIM_E, "T1/BH": "Sonucu Belirsiz", "T1/SB": "Atlandı"}, "kontroller.K2.icerik.T1/SB": SIL, "kontroller.K2.icerik.T1/BH": SIL,
   "baslamadi": {"T2": "lisans_salt_okunur"},
   "elenen.T3": {"BH": "sonucu_belirsiz"}, "toplular.T3.is_sayisi": 1, "kontroller.K3.isler.T3/SB": SINIR_B, "kontroller.K4.isler.T3/SB": TESLIM_E,
   "isler.T1/SB.atlanma_nedeni": "silme_talebi", "isler.T1/SB.post": 0, "isler.T1/BH.icerik_silindi": True,
   "isler.T3/SB.degiskenler": ["Selim Sınırda", FIRMA, "11.10.2026", "400,00 TL", "400,00 TL"], "isler.T3/SB.telefon": "+905433004050",
   "meta.post": {"A": 1, "BH": 1, "SB": 1}},
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"mesaj": {"BH": ["yanitsiz_kabul", "kabul"]}, "kanca": {"T1/BH": {"1": []}, "*": K_STD}})

S("S62-03-salt-okunurda-bir-yil-supurmesi-surer-bekleyen-atlandi", "S62",
  "02.11.2026 'Geçen Ay' (Ekim) ekstresi: A gider; B'nin işi hemen duraklatılır (hiç gitmedi); 200. günde lisans salt okunur; 1 yıl dolmadan 2 saat önce A'nın içeriği durur; 1 yıl 2. saatte (SALT "
  "OKUNURDA) süpürme sürer: A'nın içeriği silinir, bekleyen B 'Atlandı — Saklama Süresi'; lisans dönünce aynı dönem (özel Ekim 2026) A 'Daha Önce Gönderildi', B yeni içerikle gider",
  "S62 (Y19-26) + SW3 (Y15-13) + S35 (Y17-6) + R3", [A(), B()],
  [baslat("+0s", "T1", "A", donem=GECEN_AY), baslat("+0s", "T2", "B", donem=GECEN_AY), olay("+0s", "duraklat", toplu="T2"),
   olay("+200d", "lisans", yazilabilir=False), kontrol_ic("+364d22h", "K1"), kontrol_ic("+365d2h", "K2"),
   olay("+365d3h", "lisans", yazilabilir=True), baslat("+365d4h", "T3", "AB", donem=EKIM), kontrol_ic("+365d5h", "K3")],
  {"kontroller.K1.isler": {"T1/A": TESLIM_E, "T2/B": "Duraklatıldı"}, "kontroller.K1.icerik.T1/A": A_EKIM,
   "kontroller.K2.isler": {"T1/A": TESLIM_E, "T2/B": "Atlandı"}, "kontroller.K2.icerik": {"T1/A": SIL, "T2/B": SIL},
   "isler.T2/B.atlanma_nedeni": "saklama_suresi", "isler.T2/B.post": 0,
   "elenen": {"T3": {"A": DO}}, "olusmadi": [], "onceki_uyari": {"T3": {"sayi": 1, "son": "2026-11-02"}}, "toplular.T3.is_sayisi": 1,
   "kontroller.K3.icerik.T3/B": B_EKIM, "isler.T3/B.durum": TESLIM_E,
   "meta.post": {"A": 1, "B": 1}, "bu_ay": {"W1": {"2026-11": ay_kova(1), "2027-11": ay_kova(1)}}},
  baslangic=T0_KASIM, bitis="+366d", meta_davranis={"kanca": {"*": K_STD}})


# ---- S63: aynı WABA iki şirkette farklı Meta uygulamalarıyla — kanca kaydı WABA + uygulama başına (bir şirketin kaydı öbürünün teslim bilgisini kaybettirmez); işaret ŞİRKET başına ----
S("S63-01-iki-uygulama-once-a-sonra-b-kaydolur-teslim-bilgisi-iki-sirkette-isaret-ayri", "S63",
  "Aynı WABA (W1): şirket A Elle Bağla (Yol 1), şirket B WhatsApp'ı Bağla (Yol 2) — iki ayrı Meta uygulaması; teslim süresi 12 sa. A kanca kaydını yapar, A1'e gönderim Teslim Edildi (A'nın işareti); "
  "1. saatte B kaydını yapar — A'nın kaydını DÜŞÜRMEZ; 2. saatte B1'e gönderim (Meta bildirimi yok); 3. saatte A2'ye gönderim → bildirimi A'ya gelir, Teslim Edildi; 17. saatte A2 Teslim, B1 'Meta "
  "Kabul Etti'de (A'nın bildirimleri B'nin işaretini koymaz — B1 Süresi Doldu olmaz); 18. saatte aynı dönem A2 ve B1 'Daha Önce Gönderildi'",
  "S63 (Y19-28/29/30/31) + BAŞ MİMAR 11:27 (1) + §7a 16 + S41 + W1 + R3", [
   sirket_cari("A1", "A", "0551 000 00 01"), sirket_cari("A2", "A", "0551 000 00 02"), sirket_cari("B1", "B", "0552 000 00 01")],
  [olay("+0s", "kanca_kaydi", sirket="A"), baslat("+0s", "T1", ["A1"], sirket="A"), olay("+1h", "kanca_kaydi", sirket="B"),
   baslat("+2h", "T2", ["B1"], sirket="B"), baslat("+3h", "T3", ["A2"], sirket="A"), kontrol("+17h", "K1"),
   baslat("+18h", "T4", ["A2"], sirket="A"), baslat("+18h", "T5", ["B1"], sirket="B")],
  {"kontroller.K1.isler": {"T1/A1": TESLIM_E, "T2/B1": KABUL_E, "T3/A2": TESLIM_E},
   "elenen": {"T4": {"A2": DO}, "T5": {"B1": DO}}, "olusmadi": ["T4", "T5"],
   "onceki_uyari": {"T4": {"sayi": 1, "son": "2026-10-30"}, "T5": {"sayi": 1, "son": "2026-10-30"}},
   "isler.T2/B1.durum": KABUL_E, "meta.post": {"A1": 1, "A2": 1, "B1": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  ayar={"baglanti_yollari": {"A": "yol1", "B": "yol2"}}, meta=META_12SA, **iki_sirket(),
  meta_davranis={"kanca": {"A1": K_STD, "A2": K_STD, "B1": []}})

S("S63-02-iki-uygulama-sira-degisimi-once-b-sonra-a-kaydolur", "S63",
  "S63-01'in kayıt SIRASI ters: B (Yol 2) önce kaydolur ve B1 Teslim Edildi (B'nin işareti); 1. saatte A (Yol 1) kaydolur — B'nin kaydını DÜŞÜRMEZ; 2. saatte A1'e gönderim (bildirim yok); 3. saatte "
  "B2'ye gönderim → bildirimi B'ye gelir, Teslim Edildi; 17. saatte A1 'Meta Kabul Etti'de (B'nin bildirimleri A'nın işaretini koymaz); 18. saatte aynı dönem B2 ve A1 'Daha Önce Gönderildi'",
  "S63 (Y19-28/29/30) + BAŞ MİMAR 11:27 (1) + §7a 16 + W1 + R3", [
   sirket_cari("A1", "A", "0551 000 00 01"), sirket_cari("B1", "B", "0552 000 00 01"), sirket_cari("B2", "B", "0552 000 00 02")],
  [olay("+0s", "kanca_kaydi", sirket="B"), baslat("+0s", "T1", ["B1"], sirket="B"), olay("+1h", "kanca_kaydi", sirket="A"),
   baslat("+2h", "T2", ["A1"], sirket="A"), baslat("+3h", "T3", ["B2"], sirket="B"), kontrol("+17h", "K1"),
   baslat("+18h", "T4", ["B2"], sirket="B"), baslat("+18h", "T5", ["A1"], sirket="A")],
  {"kontroller.K1.isler": {"T1/B1": TESLIM_E, "T2/A1": KABUL_E, "T3/B2": TESLIM_E},
   "elenen": {"T4": {"B2": DO}, "T5": {"A1": DO}}, "olusmadi": ["T4", "T5"],
   "onceki_uyari": {"T4": {"sayi": 1, "son": "2026-10-30"}, "T5": {"sayi": 1, "son": "2026-10-30"}},
   "meta.post": {"A1": 1, "B1": 1, "B2": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  ayar={"baglanti_yollari": {"A": "yol1", "B": "yol2"}}, meta=META_12SA, **iki_sirket(),
  meta_davranis={"kanca": {"B1": K_STD, "B2": K_STD, "A1": []}})

S("S63-03-ayni-uygulama-iki-sirket-tek-kayit-isaret-yine-ayri", "S63",
  "Aynı WABA, iki şirket de WhatsApp'ı Bağla (Yol 2 — AYNI uygulama, tek kayıt paylaşılır): A kaydolur, A1 Teslim Edildi; 1. saatte B kaydolur — A'nın bildirimleri gelmeye devam eder; 2. saatte "
  "B1'e gönderim (bildirim yok); 3. saatte A2 Teslim Edildi; 17. saatte B1 'Meta Kabul Etti'de (aynı kipte de işaret şirketler arası paylaşılmaz — BAŞ MİMAR 11:27 (1)); 18. saatte aynı dönem A2 ve "
  "B1 'Daha Önce Gönderildi'",
  "S63 (Y19-28/29/30) + BAŞ MİMAR 11:27 (1) + §7a 16 + W1 + R3", [
   sirket_cari("A1", "A", "0551 000 00 01"), sirket_cari("A2", "A", "0551 000 00 02"), sirket_cari("B1", "B", "0552 000 00 01")],
  [olay("+0s", "kanca_kaydi", sirket="A"), baslat("+0s", "T1", ["A1"], sirket="A"), olay("+1h", "kanca_kaydi", sirket="B"),
   baslat("+2h", "T2", ["B1"], sirket="B"), baslat("+3h", "T3", ["A2"], sirket="A"), kontrol("+17h", "K1"),
   baslat("+18h", "T4", ["A2"], sirket="A"), baslat("+18h", "T5", ["B1"], sirket="B")],
  {"kontroller.K1.isler": {"T1/A1": TESLIM_E, "T2/B1": KABUL_E, "T3/A2": TESLIM_E},
   "elenen": {"T4": {"A2": DO}, "T5": {"B1": DO}}, "olusmadi": ["T4", "T5"],
   "meta.post": {"A1": 1, "A2": 1, "B1": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  ayar={"baglanti_yollari": {"A": "yol2", "B": "yol2"}}, meta=META_12SA, **iki_sirket(),
  meta_davranis={"kanca": {"A1": K_STD, "A2": K_STD, "B1": []}})


# ======================================================================== kâhin güncellemesi 20 (2.5.0, KULLANICI KARARI 06.11.2026 13:09 UTC "önerilerini uygula": S70, S71 = A;
# BAŞ MİMAR KARARI 06.11 12:33 DÜŞÜK-2 R3T — README §25)
# Elle beklenen YALNIZ karar metinlerinden (kahin.KARARLAR S70, S71, R3T) ve README §25.2–25.4 yorumlarından (kodlamadan önce yazıldı, ayrı commit). Yeni olay / girdi / çıktı alanı YOK.
OKUNDU_E = "Okundu"
ATL = "Atlandı"
BEL = "Sonucu Belirsiz"


# ---- S70: Atlandı olmuş işe geç teslim → HER Atlandı sırasında "Teslim Edildi" (read: Okundu) — S59 düzeni; nedeni ve denemesi ne olursa olsun ----
S("S70-01-meta-bekletti-istemiyor-pasif-silinmis-atlandi-gec-teslim-ve-read-teslim-edildi", "S70",
  "Ekim ekstresi: A Teslim Edildi; D, E ve F'nin iletisi Meta Bekletti (131049); 23. saatte D İstemiyor, E Pasif yapılır, F silinir → 24 saat sonraki 2. deneme gönderim anında üçü 'Atlandı' "
  "(İstemiyor / Pasif / Silinmiş; PDF'leri Meta'da durur); 30. saatte D'nin, 30 sa 30 dk'da F'nin 1. iletisine GEÇ teslim, 31. saatte E'ye GEÇ okundu → D ve F 'Teslim Edildi', E 'Okundu' (S70: atlanma "
  "nedeni ve 131049 kalkar, PDF kesinleşmede silinir, 2. deneme gitmez, POST 1); 32. saatte D'ye gelen geç 'failed' yok sayılır (§7a 18); işaretler kaldırılınca aynı dönem dördü 'Daha Önce "
  "Gönderildi' (J1)",
  "S70 (Y20-1/2/6) + S59 + J1 + J2 + J5 + §7a 2, 17, 18, 32 + §11 S3 + R3", [A(), D(), E(), F()],
  [baslat("+0s", "T1", "ADEF"), olay("+23h", "cari", id="D", istemiyor=True), olay("+23h", "cari", id="E", pasif=True), olay("+23h", "cari", id="F", silindi=True),
   kontrol("+25h", "K1"), kontrol("+33h", "K2"),
   olay("+34h", "cari", id="D", istemiyor=False), olay("+34h", "cari", id="E", pasif=False), olay("+34h", "cari", id="F", silindi=False), baslat("+35h", "T2", "ADEF")],
  {"kontroller.K1.isler": {"T1/A": TESLIM_E, "T1/D": ATL, "T1/E": ATL, "T1/F": ATL}, "kontroller.K1.medya_silme": 1,
   "kontroller.K2.isler": {"T1/A": TESLIM_E, "T1/D": TESLIM_E, "T1/E": OKUNDU_E, "T1/F": TESLIM_E}, "kontroller.K2.medya_silme": 4,
   "isler.T1/D.durum": TESLIM_E, "isler.T1/D.atlanma_nedeni": None, "isler.T1/D.hata_kodu": None, "isler.T1/D.post": 1, "isler.T1/D.medya_silme": 1,
   "isler.T1/E.durum": OKUNDU_E, "isler.T1/E.atlanma_nedeni": None, "isler.T1/E.post": 1, "isler.T1/F.durum": TESLIM_E, "isler.T1/F.atlanma_nedeni": None,
   "elenen": {"T2": {"A": DO, "D": DO, "E": DO, "F": DO}}, "olusmadi": ["T2"], "onceki_uyari": {"T2": {"sayi": 4, "son": "2026-10-30"}},
   "meta.post": {"A": 1, "D": 1, "E": 1, "F": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(4)}}},
  meta_davranis={"kanca": {"T1/D": {"1": K49 + [["delivered", "+30h"], ["failed", "+32h", {"kod": 131026}]]}, "T1/E": {"1": K49 + [["read", "+31h"]]},
                           "T1/F": {"1": K49 + [["delivered", "+30h30m"]]}, "*": K_STD}})

S("S70-02-hatirlatma-meta-bekletti-supheli-ve-gecikmis-borc-yok-atlandi-gec-teslim-ay-donumu", "S70",
  "31.10 00:30 (yerel; UTC 30.10 21:30) Ödeme Hatırlatma: A Teslim Edildi; SP ve GB'nin iletisi Meta Bekletti; 1. saatte SP'nin şüpheli alacak kaydı açılır, GB'nin borcu ödenir (vadesi geçmiş "
  "kalem kalmaz) → 2. deneme gönderim anında SP 'Atlandı — Şüpheli Alacağı Var', GB 'Atlandı — Gecikmiş Borç Yok'; 01.11 01:30 yerelde (UTC'de 31.10 22:30) SP'nin 1. iletisine GEÇ teslim → 'Teslim "
  "Edildi', 01.11 02:30'da GB'ye GEÇ okundu → 'Okundu' (S70); 'Bu Ay' teslim ayı Türkiye saatiyle: Ekim 1 (A), Kasım 2 (SP, GB)",
  "S70 (Y20-1/2) + S7B + §7a 20 + J5 + §7a 19 + H4", [
   cari_h("SP", "Sena Şüpheli", "0544 100 20 30", [_h("2026-09-01", 550, 0)], vadeler=[_v("2026-10-10", 350)]),
   cari_h("GB", "Gaye Borçsuz", "0544 200 30 40", [_h("2026-09-01", 450, 0)], vadeler=[_v("2026-10-12", 450)]), A7()],
  [baslat("+0s", "T1", ["SP", "GB", "A"], sablon="hatirlatma"),
   olay("+1h", "cari", id="SP", vadeler=[_v("2026-10-01", 200, True), _v("2026-10-10", 350)]),
   olay("+1h", "cari", id="GB", hareket_ekle=_h("2026-10-31", 0, 450), vadeler=[]),
   kontrol("+24h30m", "K1"), kontrol("+27h", "K2")],
  {"kontroller.K1.isler": {"T1/A": TESLIM_E, "T1/GB": ATL, "T1/SP": ATL}, "kontroller.K1.t": "2026-11-01T01:00:00+03:00",
   "kontroller.K2.isler": {"T1/A": TESLIM_E, "T1/GB": OKUNDU_E, "T1/SP": TESLIM_E},
   "isler.T1/SP.durum": TESLIM_E, "isler.T1/SP.atlanma_nedeni": None, "isler.T1/SP.hata_kodu": None, "isler.T1/SP.post": 1,
   "isler.T1/GB.durum": OKUNDU_E, "isler.T1/GB.atlanma_nedeni": None, "isler.T1/GB.post": 1,
   "meta.post": {"A": 1, "GB": 1, "SP": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(1), "2026-11": ay_kova(2)}}},
  baslangic="2026-10-31T00:30:00+03:00",
  meta_davranis={"kanca": {"T1/SP": {"1": K49 + [["delivered", "+25h"]]}, "T1/GB": {"1": K49 + [["read", "+26h"]]}, "*": K_STD}})

S("S70-03-zincir-silme-talebi-ve-istemiyor-atlandi-eski-belirsiz-iletiye-gec-teslim", "S70",
  "Ekim ekstresi: ZS ve ZI'nin iletisi Sonucu Belirsiz; 1. saatte ikisine işteki Yine de Gönder, toplu iş hemen duraklatılır (zincir); 2. saatte ZS silme talebinde bulunur → 'Atlandı — Silme Talebi' "
  "(PDF bakım turunda silinir — S60), ZI İstemiyor yapılır; 3. saatte ZS'nin ESKİ (belirsiz) iletisine imzalı GEÇ teslim → ZS 'Teslim Edildi' (S70 zincir sırası); 4. saatte Devam Et → ZI gönderim "
  "anında 'Atlandı — İstemiyor'; 5. saatte ZI'nin eski iletisine GEÇ okundu → 'Okundu' (PDF kesinleşmede silinir); İstemiyor kaldırılınca aynı dönem ikisi 'Daha Önce Gönderildi' (J1), yeni ileti "
  "gitmez (POST 1)",
  "S70 (Y20-1/2/6) + Y9-5 + J10 + S35 + S60 + J1 + R3", [
   cari("ZS", "Zafer Silme", "0545 100 20 30", [("2026-10-05", 300, 0)]), cari("ZI", "Zuhal İstemez", "0545 200 30 40", [("2026-10-06", 400, 0)])],
  [baslat("+0s", "T1", ["ZS", "ZI"]), olay("+1h", "yine_de_gonder", toplu="T1", cari="ZS", etiket="Y1"), olay("+1h", "yine_de_gonder", toplu="T1", cari="ZI", etiket="Y2"),
   olay("+1h", "duraklat", toplu="T1"), olay("+2h", "kvkk_sil", id="ZS"), olay("+2h", "cari", id="ZI", istemiyor=True), kontrol_ic("+2h30m", "K1"),
   olay("+4h", "devam", toplu="T1"), kontrol("+4h30m", "K2"), kontrol("+5h30m", "K3"), olay("+6h", "cari", id="ZI", istemiyor=False), baslat("+7h", "T2", ["ZS", "ZI"])],
  {"yeniden.Y1.alinan": ["ZS"], "yeniden.Y2.alinan": ["ZI"],
   "kontroller.K1.isler": {"T1/ZI": "Duraklatıldı", "T1/ZS": ATL}, "kontroller.K1.icerik.T1/ZS": SIL, "kontroller.K1.medya_silme": 1,
   "kontroller.K2.isler": {"T1/ZI": ATL, "T1/ZS": TESLIM_E}, "kontroller.K3.isler": {"T1/ZI": OKUNDU_E, "T1/ZS": TESLIM_E}, "kontroller.K3.medya_silme": 2,
   "isler.T1/ZS.durum": TESLIM_E, "isler.T1/ZS.atlanma_nedeni": None, "isler.T1/ZS.post": 1, "isler.T1/ZS.icerik_silindi": True, "isler.T1/ZS.medya_silme": 1,
   "isler.T1/ZI.durum": OKUNDU_E, "isler.T1/ZI.atlanma_nedeni": None, "isler.T1/ZI.post": 1, "isler.T1/ZI.medya_silme": 1,
   "elenen": {"T2": {"ZI": DO, "ZS": DO}}, "olusmadi": ["T2"], "onceki_uyari": {"T2": {"sayi": 2, "son": "2026-10-30"}},
   "meta.post": {"ZI": 1, "ZS": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta_davranis={"mesaj": {"ZS": ["yanitsiz_kabul", "kabul"], "ZI": ["yanitsiz_kabul", "kabul"]},
                 "kanca": {"T1/ZS": {"1": [["delivered", "+5s", {"varis": "+3h"}]]}, "T1/ZI": {"1": [["read", "+5s", {"varis": "+5h"}]]}, "*": K_STD}})

S("S70-04-s42-meta-bekletti-ikinci-deneme-silme-atlandi-birinci-iletiye-gec-teslim", "S70",
  "Ekim ekstresi: MS'nin iletisi Meta Bekletti; 24 saat sonraki 2. denemenin yanıtı 2 dakika gecikir ve istek sürerken (24 sa 1 dk) MS silme talebinde bulunur → yanıt geçici hata (131000), yeniden "
  "gönderim gerekir → 'Atlandı — Silme Talebi' (S42; PDF silinir — S60); 25. saatte 1. iletisine GEÇ teslim → 'Teslim Edildi' (S70: son deneme olmayan ileti; hata kodu kalkar, POST 2 aynen); aynı "
  "dönem 'Daha Önce Gönderildi'",
  "S70 (Y20-1/2) + S42 + S60 + §7a 14, 15, 32 + J1 + R3", [cari("MS", "Murat Sürüyor", "0546 100 20 30", [("2026-10-07", 500, 0)]), A()],
  [baslat("+0s", "T1", ["MS", "A"]), olay("+24h1m", "kvkk_sil", id="MS"), kontrol_ic("+24h5m", "K1"), kontrol("+26h", "K2"), baslat("+27h", "T2", ["MS"])],
  {"kontroller.K1.isler": {"T1/A": TESLIM_E, "T1/MS": ATL}, "kontroller.K1.icerik.T1/MS": SIL, "kontroller.K1.medya_silme": 2,
   "kontroller.K2.isler": {"T1/A": TESLIM_E, "T1/MS": TESLIM_E}, "kontroller.K2.medya_silme": 2,
   "isler.T1/MS.durum": TESLIM_E, "isler.T1/MS.atlanma_nedeni": None, "isler.T1/MS.hata_kodu": None, "isler.T1/MS.post": 2, "isler.T1/MS.medya_silme": 1,
   "isler.T1/MS.icerik_silindi": True,
   "elenen": {"T2": {"MS": DO}}, "olusmadi": ["T2"], "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}},
   "meta.post": {"A": 1, "MS": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta_davranis={"mesaj": {"MS": ["kabul", _ys("+2m", {"hata": 131000})]}, "kanca": {"T1/MS": {"1": K49 + [["delivered", "+25h"]]}, "*": K_STD}})

S("S70-05-j10-daha-once-gonderildi-atlandi-obur-eski-denemeye-teslim-edildi", "S70",
  "Ekim ekstresi: JD'nin 1. iletisi Sonucu Belirsiz; 1. saatte işteki Yine de Gönder → 2. ileti de Sonucu Belirsiz; 2. saatte yeniden Yine de Gönder, toplu iş duraklatılır; 3. saatte bir eski "
  "iletiye imzalı teslim → J10 'Atlandı — Daha Önce Gönderildi' (yeni ileti gitmez); 4. saatte ÖBÜR eski iletiye de teslim → 'Teslim Edildi' (S70: J10 işi de bir Atlandı sırası); POST 2, 'Bu Ay' 2 "
  "(iki deneme — J5); aynı dönem 'Daha Önce Gönderildi'",
  "S70 (Y20-1/3) + J10 + Y9-5 + J1 + J5 + R3", [cari("JD", "Jale Çift", "0547 100 20 30", [("2026-10-08", 600, 0)])],
  [baslat("+0s", "T1", ["JD"]), olay("+1h", "yine_de_gonder", toplu="T1", cari="JD", etiket="Y1"),
   olay("+2h", "yine_de_gonder", toplu="T1", cari="JD", etiket="Y2"), olay("+2h", "duraklat", toplu="T1"),
   kontrol("+3h30m", "K1"), kontrol("+4h30m", "K2"), baslat("+5h", "T2", ["JD"])],
  {"yeniden.Y1.alinan": ["JD"], "yeniden.Y2.alinan": ["JD"],
   "kontroller.K1.isler": {"T1/JD": ATL}, "kontroller.K2.isler": {"T1/JD": TESLIM_E},
   "isler.T1/JD.durum": TESLIM_E, "isler.T1/JD.atlanma_nedeni": None, "isler.T1/JD.post": 2, "isler.T1/JD.medya_silme": 1,
   "elenen": {"T2": {"JD": DO}}, "olusmadi": ["T2"], "onceki_uyari": {"T2": {"sayi": 1, "son": "2026-10-30"}},
   "meta.post": {"JD": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta_davranis={"mesaj": {"JD": ["yanitsiz_kabul", "yanitsiz_kabul", "kabul"]},
                 "kanca": {"T1/JD": {"1": [["delivered", "+5s", {"varis": "+4h"}]], "2": [["delivered", "+5s", {"varis": "+2h"}]]}}})

S("S70-06-telefonsuz-atlandi-meta-bekletti-gec-teslim-r3-uyarisinda-sayilir", "S70",
  "Ekim ekstresi: B Teslim Edildi; TF'nin iletisi Meta Bekletti; 23. saatte TF'nin kartındaki telefon silinir → 2. deneme gönderim anında 'Atlandı — Telefonsuz'; 30. saatte 1. iletisine GEÇ teslim → "
  "'Teslim Edildi' (S70); aynı dönem yeni gönderimde B 'Daha Önce Gönderildi', TF 'Telefonsuz' — R3 uyarısı 2 kişi (TF de sayılır — R3T); yalnız TF seçilince uyarı 1 kişi (Y20-16)",
  "S70 (Y20-1/2) + R3T (Y20-14/16) + J1 + §7a 1, 2 + R3", [B(), cari("TF", "Tarık Fonsuz", "0548 100 20 30", [("2026-10-09", 700, 0)])],
  [baslat("+0s", "T1", ["B", "TF"]), olay("+23h", "cari", id="TF", telefon=None), kontrol("+25h", "K1"), kontrol("+31h", "K2"),
   baslat("+32h", "T2", ["B", "TF"]), baslat("+33h", "T3", ["TF"])],
  {"kontroller.K1.isler": {"T1/B": TESLIM_E, "T1/TF": ATL}, "kontroller.K2.isler": {"T1/B": TESLIM_E, "T1/TF": TESLIM_E},
   "isler.T1/TF.durum": TESLIM_E, "isler.T1/TF.atlanma_nedeni": None, "isler.T1/TF.hata_kodu": None, "isler.T1/TF.post": 1,
   "elenen": {"T2": {"B": DO, "TF": TS}, "T3": {"TF": TS}}, "olusmadi": ["T2", "T3"],
   "onceki_uyari": {"T2": {"sayi": 2, "son": "2026-10-30"}, "T3": {"sayi": 1, "son": "2026-10-30"}},
   "meta.post": {"B": 1, "TF": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(2)}}},
  meta_davranis={"kanca": {"T1/TF": {"1": K49 + [["delivered", "+30h"]]}, "*": K_STD}})


# ---- S71: içeriği ve kart telefonu silinmiş Ödeme Hatırlatma'da işteki Yine de Gönder (asıl işte basma dahil) → "Telefon Yok" ile ALINMAZ, iş Sonucu Belirsiz kalır ----
S("S71-01-hatirlatma-yine-de-gonder-telefonsuz-alinmaz-asil-iste-de-yeniden-dene-ve-ekstre-ile-karsilastirma", "S71",
  "30.10 Ödeme Hatırlatma: YB ve YZ'nin iletisi Sonucu Belirsiz, YF alıcı hatasıyla (131021) Başarısız; Ekim ekstresinde YE Sonucu Belirsiz; 1. saatte YZ'ye işteki Yine de Gönder, toplu iş "
  "duraklatılır (zincir); 2. saatte dördü silme talebinde bulunur ve kart telefonları silinir (YZ'nin bekleyen işi 'Atlandı — Silme Talebi'); 3. saatte: YB'ye işteki Yine de Gönder → 'Telefon Yok' ile "
  "ALINMAZ, iş Sonucu Belirsiz kalır (S71); YZ'ye ASIL işte Yine de Gönder → aynı (asıl işte basma dahil); Başarısızları Yeniden Dene → YF 'Telefon Yok' (S61); Ekstre'de YE'ye Yine de Gönder → 'içerik "
  "silindi' (S31 — S71 Ekstre'ye uygulanmaz); 4. saatte YB'nin kartına telefon yeniden girilir; 5. saatte işteki Yine de Gönder YB'yi ALIR, içerik karttan hazırlanıp gider (S37)",
  "S71 (Y20-8/9/11) + S61 + S31 + S37 + S35 + SW3 (Y15-16)", [
   cari_h("YB", "Yasemin Belirsiz", "0549 510 61 71", [_h("2026-09-01", 400, 0)], vadeler=[_v("2026-10-14", 400)]),
   cari_h("YZ", "Yavuz Zincir", "0549 520 62 72", [_h("2026-09-01", 300, 0)], vadeler=[_v("2026-10-15", 300)]),
   cari_h("YF", "Yeter Başarısız", "0549 530 63 73", [_h("2026-09-01", 200, 0)], vadeler=[_v("2026-10-16", 200)]),
   cari("YE", "Yıldız Ekstre", "0549 540 64 74", [("2026-10-05", 600, 0)])],
  [baslat("+0s", "T1", ["YB", "YZ", "YF"], sablon="hatirlatma"), baslat("+0s", "T2", ["YE"]),
   olay("+1h", "yine_de_gonder", toplu="T1", cari="YZ", etiket="Y1"), olay("+1h", "duraklat", toplu="T1"),
   olay("+2h", "kvkk_sil", id="YB"), olay("+2h", "kvkk_sil", id="YZ"), olay("+2h", "kvkk_sil", id="YF"), olay("+2h", "kvkk_sil", id="YE"),
   olay("+2h", "cari", id="YB", telefon=None), olay("+2h", "cari", id="YZ", telefon=None), olay("+2h", "cari", id="YF", telefon=None), olay("+2h", "cari", id="YE", telefon=None),
   olay("+3h", "yine_de_gonder", toplu="T1", cari="YB", etiket="Y2"), olay("+3h", "yine_de_gonder", toplu="T1", cari="YZ", etiket="Y3", hedef="asil"),
   olay("+3h", "basarisizlari_yeniden_dene", toplu="T1", etiket="Y4"), olay("+3h", "yine_de_gonder", toplu="T2", cari="YE", etiket="Y5"),
   kontrol_ic("+3h30m", "K1"), olay("+4h", "cari", id="YB", telefon="0549 510 61 71"), olay("+5h", "yine_de_gonder", toplu="T1", cari="YB", etiket="Y6"),
   kontrol_ic("+6h", "K2")],
  {"yeniden.Y1.alinan": ["YZ"],
   "kontroller.K1.isler": {"T1/YB": BEL, "T1/YF": "Başarısız", "T1/YZ": ATL, "T2/YE": BEL},
   "kontroller.K1.icerik.T1/YB": SIL, "kontroller.K1.icerik.T1/YZ": SIL, "kontroller.K1.icerik.T2/YE": SIL,
   "yeniden.Y2": {"elenen": {"YB": TS}, "alinan": [], "oneri": None}, "yeniden.Y3": {"elenen": {"YZ": TS}, "alinan": [], "oneri": None},
   "yeniden.Y4": {"elenen": {"YF": TS}, "alinan": [], "oneri": None}, "yeniden.Y5": {"elenen": {"YE": IS}, "alinan": [], "oneri": None},
   "yeniden.Y6": {"elenen": {}, "alinan": ["YB"], "oneri": None},
   "kontroller.K2.isler": {"T1/YB": TESLIM_E, "T1/YF": "Başarısız", "T1/YZ": ATL, "T2/YE": BEL},
   "kontroller.K2.icerik.T1/YB": _hat("+905495106171", "Yasemin Belirsiz", "14.10.2026", "400,00 TL"),
   "isler.T1/YZ.durum": ATL, "isler.T1/YZ.atlanma_nedeni": "silme_talebi", "isler.T1/YZ.post": 1, "isler.T1/YB.post": 2,
   "isler.T1/YF.durum": "Başarısız", "isler.T1/YF.hata_kodu": 131021, "isler.T1/YF.post": 1, "isler.T2/YE.durum": BEL, "isler.T2/YE.post": 1,
   "meta.post": {"YB": 2, "YE": 1, "YF": 1, "YZ": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(1)}}},
  meta_davranis={"mesaj": {"YB": ["yanitsiz_kabul", "kabul"], "YZ": ["yanitsiz_kabul", "kabul"], "YF": [{"hata": 131021}], "YE": ["yanitsiz_kabul"]},
                 "kanca": {"T1/YB": {"1": [], "*": K_STD}, "T1/YZ": {"1": []}, "T2/YE": {"1": []}, "*": K_STD}})

S("S71-02-telefon-yok-zaten-kuyruktan-once-kart-telefonu-dolu-is-gider", "S71",
  "30.10 Ödeme Hatırlatma: YK ve YM'nin iletisi Sonucu Belirsiz; 1. saatte ikisi silme talebinde bulunur (içerik silinir, kart telefonları durur); ertesi gün YK'ye yeni hatırlatma (dünkü belirsiz "
  "bugünküyü elemez — E3) açılır ve hemen duraklatılır (kuyrukta); 25. saatte YK'nin kart telefonu silinir; 26. saatte işteki Yine de Gönder: YK 'Telefon Yok' ile alınmaz — telefon denetimi 'Zaten "
  "Kuyrukta'dan ÖNCE (S71 = S61 ile aynı yön); YM'nin kart telefonu dolu → ALINIR, içerik karttan hazırlanıp gider (S37)",
  "S71 (Y20-9/10/12) + S61 (Y19-21) + S37 + F1 + D2 + E3", [
   cari_h("YK", "Yaprak Kuyruk", "0549 610 71 81", [_h("2026-09-01", 500, 0)], vadeler=[_v("2026-10-13", 500)]),
   cari_h("YM", "Yener Mobil", "0549 620 72 82", [_h("2026-09-01", 350, 0)], vadeler=[_v("2026-10-14", 350)])],
  [baslat("+0s", "T1", ["YK", "YM"], sablon="hatirlatma"), olay("+1h", "kvkk_sil", id="YK"), olay("+1h", "kvkk_sil", id="YM"),
   baslat("+24h", "T2", ["YK"], sablon="hatirlatma"), olay("+24h", "duraklat", toplu="T2"), olay("+25h", "cari", id="YK", telefon=None), kontrol("+25h30m", "K1"),
   olay("+26h", "yine_de_gonder", toplu="T1", cari="YK", etiket="Y1"), olay("+26h", "yine_de_gonder", toplu="T1", cari="YM", etiket="Y2"), kontrol_ic("+27h", "K2")],
  {"kontroller.K1.isler": {"T1/YK": BEL, "T1/YM": BEL, "T2/YK": "Duraklatıldı"}, "olusmadi": [],
   "yeniden.Y1": {"elenen": {"YK": TS}, "alinan": [], "oneri": None}, "yeniden.Y2": {"elenen": {}, "alinan": ["YM"], "oneri": None},
   "kontroller.K2.isler": {"T1/YK": BEL, "T1/YM": TESLIM_E, "T2/YK": "Duraklatıldı"},
   "kontroller.K2.icerik.T1/YM": _hat("+905496207282", "Yener Mobil", "14.10.2026", "350,00 TL"), "kontroller.K2.icerik.T1/YK": SIL,
   "isler.T1/YK.durum": BEL, "isler.T1/YK.post": 1, "isler.T1/YM.post": 2,
   "meta.post": {"YK": 1, "YM": 2}, "bu_ay": {"W1": {"2026-10": ay_kova(1)}}},
  meta_davranis={"mesaj": {"YK": ["yanitsiz_kabul", "kabul"], "YM": ["yanitsiz_kabul", "kabul"]},
                 "kanca": {"T1/YK": {"1": []}, "T1/YM": {"1": [], "*": K_STD}, "*": K_STD}})


# ---- R3T (BAŞ MİMAR 12:33 DÜŞÜK-2): R3 uyarı sayısı (ve son tarihi) telefonsuz ama daha önce almış kişiyi de sayar; elenme nedeni Telefonsuz kalır ----
S("R3T-01-telefonsuz-daha-once-almis-uyari-sayisi-ve-son-tarih-tek-basina-uyari-sonraki-donem-yok", "R3T",
  "Ekim ekstresi (özel aralık): A'ya 30.10'da, C'ye 01.11'de gider; C'nin kartındaki telefon silinir; 02.11'de aynı dönem A ve C seçilir → A 'Daha Önce Gönderildi', C 'Telefonsuz'; R3 uyarısı 2 kişi, "
  "son tarih 01.11 (C'nin gönderimi — Y20-15); yalnız C seçilince uyarı 1 kişi (Y20-16); uyarıda 'Yine de Gönder' ile A'ya gider, C yine 'Telefonsuz' (numarası yok); sonraki dönem (Kasım) A'ya uyarısız "
  "gider, C 'Telefonsuz' ve uyarı yok",
  "R3T (Y20-14/15/16) + R3 + H4 + §7a 6 + SW3 (Y15-16)", [A(), C()],
  [baslat("+0s", "T1", "A", donem=EKIM), baslat("+2d", "T2", "C", donem=EKIM), olay("+2d1h", "cari", id="C", telefon=None),
   baslat("+3d", "T3", "AC", donem=EKIM), baslat("+3d1h", "T4", "C", donem=EKIM), baslat("+3d2h", "T5", "AC", donem=EKIM, onceki="gonder"),
   baslat("+3d3h", "T6", "AC", donem={"bas": "2026-11-01", "son": "2026-11-30"})],
  {"elenen": {"T3": {"A": DO, "C": TS}, "T4": {"C": TS}, "T5": {"C": TS}, "T6": {"C": TS}}, "olusmadi": ["T3", "T4"],
   "onceki_uyari": {"T3": {"sayi": 2, "son": "2026-11-01"}, "T4": {"sayi": 1, "son": "2026-11-01"}, "T5": {"sayi": 2, "son": "2026-11-01"}},
   "isler.T5/A.durum": TESLIM_E, "isler.T6/A.durum": TESLIM_E,
   "meta.post": {"A": 3, "C": 1}, "bu_ay": {"W1": {"2026-10": ay_kova(1), "2026-11": ay_kova(3)}}},
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
