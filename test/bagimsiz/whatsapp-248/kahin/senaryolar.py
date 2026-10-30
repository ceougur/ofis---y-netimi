#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WhatsApp toplu gönderim kâhininin SENARYO KÜMESİ — DestekOfis 2.4.8 K0.

Her senaryo: GİRDİ (cariler, seçim, saat, sahte Meta davranışı, olaylar) + ELLE yazılmış beklenen (yalnız plandan, kâhinin modelinden
bağımsız hesaplanmış anahtar sayılar). `python3 -I senaryolar.py` modeli koşar; elle beklenen ile model AYNI değilse dosya YAZILMAZ,
çıkış 1 (iki ayrı türetme birbirini denetler). Aynıysa `senaryolar.json` (girdi + elle + modelin bütün beklenen sonucu) yazılır.

Başlıklar plan §8 "Nasıl bozulur?" listesinden: ÇİFT, KAYIP, YANLIŞ KİŞİ, YANLIŞ İÇERİK, HESAP / META, GÜVENLİK, TARİH, ÖLÇEK, (+ TEMEL, ŞİRKET).
Zaman ifadeleri: "+5s", "+2h", "+3d", "cokme+10m" (çökmeye göre). Sahte Meta davranışı (meta_davranis):
  mesaj: {cari | "*": [yanıt1, yanıt2, …] | yanıt}  — o alıcının n. POST'u (sahte sunucu kuralı: yol messages + to + deneme n)
         yanıt ∈ "kabul" | "yanitsiz_kabul" (Meta aldı, yanıt kayboldu: koptu "sonra" / gecikme / işlenmiş gövdesiz 5xx)
                 | "yanitsiz_red" (Meta almadı, yanıt yok: koptu "once" / işlenmemiş gövdesiz 5xx) | {"hata": kod} | {"sinir": true}
  medya: [yanıt1, …]  — GENEL sıra (sahte sunucu medya isteğinde alıcı bilmez): "kabul" | "yanitsiz"
  kanca: {cari | "*": [[durum, gecikme, {kod, tekrar, varis}], …] | {"<n. ileti>": [...]}}  — Meta'nın o iletiye göndereceği durum kancaları
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
DON = {"donem": ["2026-10-01", "2026-10-31"]}


def cari(id_, ad, tel, hareketler=(), **kw):
    return {"id": id_, "ad": ad, "telefon": tel, "hareketler": [{"tarih": t, "borc": b, "alacak": a} for (t, b, a) in hareketler], **kw}


def A(**kw):
    return cari("A", "Ayşe Yılmaz", "0532 111 22 33", [("2026-09-10", 1000, 0), ("2026-10-05", 500, 0), ("2026-10-20", 0, 250)], **kw)


def B(**kw):
    return cari("B", "Mehmet Kaya", "0533 222 33 44", [("2026-10-15", 2000, 0)], **kw)


def C(**kw):
    return cari("C", "Zeynep Demir", "0534 333 44 55", [("2026-08-01", 300, 0), ("2026-09-01", 0, 300)], **kw)


def D():
    return cari("D", "Hasan Çelik", "0535 444 55 66", [("2026-10-10", 750, 0)])


def E():
    return cari("E", "Elif Şahin", "0536 555 66 77", [("2026-10-11", 80, 0)])


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


def ay_kova(kabul, teslim):
    return {"kabul": kabul, "teslim": teslim, "yaklasik_usd": f"{0.0009 * teslim:.4f}"}


SENARYOLAR = []


def S(ad, baslik, aciklama, kaynak, cariler, olaylar, elle, **kw):
    SENARYOLAR.append({"ad": ad, "baslik": baslik, "aciklama": aciklama, "kaynak": kaynak, "baslangic": kw.pop("baslangic", T0),
                       "cariler": cariler, "olaylar": olaylar, "elle": elle, **kw})


# ======================================================================== TEMEL
S("TEMEL-01-ekstre-uc-kisi", "TEMEL", "Seç → Gönder: üç cari, her birine dönemli ekstre PDF + şablon; teslim kancası", "§1, §2.2–2.3, §6 W2–W5, §11 S3",
  [A(), B(), C()], [baslat("+0s", "T1", "ABC"), kontrol("+1h", "K1")],
  [({}, {
      "isler.T1/A.durum": "Teslim Edildi", "isler.T1/A.telefon": "+905321112233",
      "isler.T1/A.degiskenler": ["Ayşe Yılmaz", FIRMA, DON, "1.250,00 TL"],
      "isler.T1/A.pdf": {"cari_ad": "Ayşe Yılmaz", "donem_bas": "2026-10-01", "donem_son": "2026-10-31", "devir": "1000.00", "hareket_sayisi": 2, "donem_sonu_bakiye": "1250.00"},
      "isler.T1/B.degiskenler": ["Mehmet Kaya", FIRMA, DON, "2.000,00 TL"],
      "isler.T1/C.degiskenler": ["Zeynep Demir", FIRMA, DON, "0,00 TL"],
      "isler.T1/C.pdf": {"cari_ad": "Zeynep Demir", "donem_bas": "2026-10-01", "donem_son": "2026-10-31", "devir": "0.00", "hareket_sayisi": 0, "donem_sonu_bakiye": "0.00"},
      "isler.T1/A.dosya_adi": {"on_ek": "Ekstre Ayşe Yılmaz ", "son_ek": ".pdf"},
      "isler.T1/A.sablon": "destekofis_ekstre",
      "meta.post": {"A": 1, "B": 1, "C": 1}, "meta.medya_yukleme": {"A": 1, "B": 1, "C": 1}, "meta.medya_silme": {"A": 1, "B": 1, "C": 1},
      "bu_ay.sirket": {"A": {"2026-10": ay_kova(3, 3)}}, "kontroller.K1.durum_sayilari": {"Teslim Edildi": 3},
  })], meta_davranis={"kanca": {"*": K_STD}})

S("TEMEL-02-odeme-hatirlatma", "TEMEL", "Ödeme hatırlatma şablonu: PDF yok, medya yüklenmez; {{5}} güncel bakiye", "§1, §6 W5",
  [A(), B()], [baslat("+0s", "T1", "AB", sablon="hatirlatma")],
  [({}, {
      "isler.T1/A.sablon": "destekofis_odeme_hatirlatma",
      "isler.T1/A.degiskenler": ["Ayşe Yılmaz", FIRMA, {"plan_susuyor": "vade"}, {"plan_susuyor": "tutar"}, "1.250,00 TL"],
      "isler.T1/B.degiskenler": ["Mehmet Kaya", FIRMA, {"plan_susuyor": "vade"}, {"plan_susuyor": "tutar"}, "2.000,00 TL"],
      "isler.T1/A.pdf": None, "meta.medya_yukleme": {"A": 0, "B": 0}, "meta.toplam_medya_yukleme": 0, "meta.post": {"A": 1, "B": 1},
      "durum_sayilari": {"Teslim Edildi": 2},
  })], meta_davranis={"kanca": {"*": K_STD}})

S("TEMEL-03-okundu-teslimsiz", "TEMEL", "Meta delivered göndermeden read gönderebilir (belge): Okundu = teslim edildi sayılır", "§6 W2, Meta status webhook",
  [A()], [baslat("+0s", "T1", "A")],
  [({}, {"isler.T1/A.durum": "Okundu", "bu_ay.sirket.A.2026-10": ay_kova(1, 1), "meta.medya_silme": {"A": 1}})],
  meta_davranis={"kanca": {"A": [["sent", "+1s"], ["read", "+10s"]]}})

S("TEMEL-04-sirasiz-kanca", "TEMEL", "Kancalar sırasız: read → delivered → sent; durum yalnız ileri", "§6 W2 (read'den sonra delivered yok sayılır)",
  [A()], [baslat("+0s", "T1", "A")],
  [({}, {"isler.T1/A.durum": "Okundu", "bu_ay.sirket.A.2026-10": ay_kova(1, 1), "meta.medya_silme": {"A": 1}})],
  meta_davranis={"kanca": {"A": [["read", "+3s"], ["delivered", "+4s"], ["sent", "+5s"]]}})

# ======================================================================== ÇİFT
S("CIFT-01-zaman-asimi-meta-aldi", "ÇİFT", "Yanıt gelmedi ama Meta iletiyi aldı: Sonucu Belirsiz, kendiliğinden yeniden GÖNDERİLMEZ; kanca opaque ile gelir",
  "§6 W2 ÇİFT GÖNDERİM YOK; §3", [A()], [baslat("+0s", "T1", "A")],
  [({}, {"meta.post": {"A": 1}, "meta.toplam_meta_ileti": 1}),
   ({"belirsiz_cozum": "opaque_cozer"}, {"isler.T1/A.durum": "Teslim Edildi", "meta.kabul": {"A": 1}, "meta.medya_silme": {"A": 1}, "bu_ay.sirket": {"A": {"2026-10": ay_kova(1, 1)}}}),
   ({"belirsiz_cozum": "bilinmeyen_duser"}, {"isler.T1/A.durum": "Sonucu Belirsiz", "meta.kabul": {"A": 0}, "meta.medya_silme": {"A": 0}, "bu_ay.sirket": {}})],
  serbest=["belirsiz_cozum", "belirsiz_sonrasi"], meta_davranis={"mesaj": {"A": ["yanitsiz_kabul"]}, "kanca": {"A": K_STD}})

S("CIFT-02-yanitsiz-yine-de-gonder", "ÇİFT", "Meta almadı, yanıt yok → Sonucu Belirsiz; kullanıcı 'Yine de Gönder' → ikinci POST",
  "§6 W2, W4 'Yine de Gönder'", [A()],
  [baslat("+0s", "T1", "A"), kontrol("+30m", "K1"), olay("+1h", "yine_de_gonder", toplu="T1", cari="A")],
  [({}, {"meta.post": {"A": 2}, "meta.toplam_meta_ileti": 1, "isler.T1/A.durum": "Teslim Edildi",
         "kontroller.K1.isler": {"T1/A": "Sonucu Belirsiz"}, "kontroller.K1.toplam_post": 1}),
   ({"medya_tekrar": "ayni"}, {"meta.medya_yukleme": {"A": 1}, "meta.medya_silme": {"A": 1}}),
   ({"medya_tekrar": "yeni"}, {"meta.medya_yukleme": {"A": 2}, "meta.medya_silme": {"A": 2}})],
  serbest=["medya_tekrar", "belirsiz_sonrasi"], meta_davranis={"mesaj": {"A": ["yanitsiz_red"]}, "kanca": {"A": K_STD}})

S("CIFT-03-yine-de-gonder-cift-gider", "ÇİFT", "Meta aldı, yanıt kayboldu, kullanıcı 'Yine de Gönder': Meta'da İKİ ileti (uyarının nedeni)",
  "§6 W2 ('çift gidebilir' uyarısı)", [A()],
  [baslat("+0s", "T1", "A"), olay("+1h", "yine_de_gonder", toplu="T1", cari="A")],
  [({}, {"meta.post": {"A": 2}, "meta.toplam_meta_ileti": 2, "meta.kabul": {"A": 1}, "isler.T1/A.durum": "Teslim Edildi"})],
  serbest=["medya_tekrar", "belirsiz_sonrasi"], meta_davranis={"mesaj": {"A": ["yanitsiz_kabul"]}, "kanca": {"A": {"2": K_STD}}})

S("CIFT-04-cokme-istek-ulasti", "ÇİFT", "'Gönderiliyor' anında süreç öldü (istek Meta'ya ulaştı); yeniden açılış: o iş Sonucu Belirsiz, öbürleri bir kez",
  "§6 W2, §8 ÇİFT", [A(), B(), C()],
  [baslat("+0s", "T1", "ABC"), {"tur": "cokme", "cari": "B", "istek_ulasti": True}, olay("cokme+10m", "ac"), olay("cokme+11m", "kanca_kuyrugu")],
  [({"belirsiz_sonrasi": "surer"}, {"meta.post": {"A": 1, "B": 1, "C": 1}, "meta.toplam_meta_ileti": 3, "isler.T1/A.durum": "Teslim Edildi", "isler.T1/C.durum": "Teslim Edildi"}),
   ({"belirsiz_sonrasi": "surer", "belirsiz_cozum": "opaque_cozer"}, {"isler.T1/B.durum": "Teslim Edildi", "meta.kabul": {"A": 1, "B": 1, "C": 1}}),
   ({"belirsiz_sonrasi": "surer", "belirsiz_cozum": "bilinmeyen_duser"}, {"isler.T1/B.durum": "Sonucu Belirsiz", "meta.kabul": {"A": 1, "B": 0, "C": 1}})],
  serbest=["belirsiz_cozum", "belirsiz_sonrasi", "uretim_ani"], meta_davranis={"kanca": {"*": K_STD}})

S("CIFT-05-cokme-istek-ulasmadi", "ÇİFT", "'Gönderiliyor' yazıldı, istek gitmeden süreç öldü: yine Sonucu Belirsiz (program bilemez), Meta'da ileti yok",
  "§6 W2", [A(), B()],
  [baslat("+0s", "T1", "AB"), {"tur": "cokme", "cari": "B", "istek_ulasti": False}, olay("cokme+5m", "ac"), olay("cokme+6m", "kanca_kuyrugu")],
  [({}, {"meta.post.B": 0, "isler.T1/B.durum": "Sonucu Belirsiz", "meta.medya_yukleme.B": 1, "meta.medya_silme.B": 0}),
   ({"belirsiz_sonrasi": "surer"}, {"meta.toplam_meta_ileti": 1, "isler.T1/A.durum": "Teslim Edildi"})],
  serbest=["belirsiz_sonrasi", "uretim_ani"], meta_davranis={"kanca": {"*": K_STD}})

S("CIFT-06-cift-tik", "ÇİFT", "Aynı toplu iş 200 ms arayla iki kez başlatıldı (çift tık)", "§8 ÇİFT",
  [A(), B()], [baslat("+0s", "T1", "AB"), baslat("+200ms", "T2", "AB", cift=True)],
  [({}, {"elenen.T2": {"A": "cift", "B": "cift"}, "bos_toplu": ["T2"], "meta.post": {"A": 1, "B": 1}})],
  meta_davranis={"kanca": {"*": K_STD}})

S("CIFT-07-iki-sekme", "ÇİFT", "İki sekmeden 5 sn arayla aynı seçim (ilk iş bitmiş olabilir)", "§8 ÇİFT",
  [A(), B(), C()], [baslat("+0s", "T1", "ABC"), baslat("+5s", "T2", "ABC", cift=True)],
  [({}, {"elenen.T2": {"A": "cift", "B": "cift", "C": "cift"}, "meta.post": {"A": 1, "B": 1, "C": 1}})],
  meta_davranis={"kanca": {"*": K_STD}})

S("CIFT-08-iki-kullanici-ayni-cari", "ÇİFT", "İki kullanıcı aynı anda, çakışan cari (B) — B'ye tek ileti", "§8 ÇİFT",
  [A(), B(), C()], [baslat("+0s", "T1", "AB"), baslat("+1s", "T2", "BC", kullanici="muhasebe", cift=True)],
  [({}, {"elenen.T2": {"B": "cift"}, "meta.post": {"A": 1, "B": 1, "C": 1}, "isler.T2/C.durum": "Teslim Edildi"})],
  kullanicilar={"yonetici": {"whatsapp.send": True}, "muhasebe": {"whatsapp.send": True}}, meta_davranis={"kanca": {"*": K_STD}})

S("CIFT-09-basarisizlari-yeniden-dene", "ÇİFT", "'Başarısızları Yeniden Dene' yalnız kesin Başarısız'ı gönderir; kabul edilmiş ve Sonucu Belirsiz'e dokunmaz",
  "§6 W4", [A(), B(), C()],
  [baslat("+0s", "T1", "ABC"), kontrol("+30m", "K1"), olay("+1h", "basarisizlari_yeniden_dene", toplu="T1")],
  [({"belirsiz_sonrasi": "surer"}, {
      "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T1/B": "Başarısız", "T1/C": "Sonucu Belirsiz"},
      "meta.post": {"A": 1, "B": 2, "C": 1}, "isler.T1/B.durum": "Teslim Edildi", "isler.T1/C.durum": "Sonucu Belirsiz",
      "meta.medya_yukleme": {"A": 1, "B": 2, "C": 1}, "meta.medya_silme": {"A": 1, "B": 2, "C": 0}})],
  serbest=["belirsiz_sonrasi", "uretim_ani"], meta_davranis={"mesaj": {"B": [{"hata": 131009}], "C": ["yanitsiz_red"]}, "kanca": {"*": K_STD}})

S("CIFT-10-yinelenen-kanca", "ÇİFT", "Meta aynı kancayı birçok kez gönderir: etkisiz; teslim bir kez sayılır, PDF bir kez silinir",
  "§6 W9 'yinelenen olay etkisiz', Meta 7 gün yeniden deneme", [A()], [baslat("+0s", "T1", "A")],
  [({}, {"isler.T1/A.durum": "Okundu", "bu_ay.sirket.A.2026-10": ay_kova(1, 1), "meta.medya_silme": {"A": 1}})],
  meta_davranis={"kanca": {"A": [["sent", "+1s", {"tekrar": 2}], ["delivered", "+5s", {"tekrar": 3}], ["read", "+1m", {"tekrar": 2}]]}})

S("CIFT-11-medya-yanitsiz", "ÇİFT", "Medya yükleme yanıtsız → yeniden yüklenir; ileti bir kez", "§6 W2", [A()], [baslat("+0s", "T1", "A")],
  [({}, {"meta.toplam_medya_yukleme": 2, "meta.medya_yukleme": {"A": 1}, "meta.post": {"A": 1}, "isler.T1/A.durum": "Teslim Edildi", "meta.medya_silme": {"A": 1}})],
  meta_davranis={"medya": ["yanitsiz", "kabul"], "kanca": {"*": K_STD}})

S("CIFT-12-geri-yukleme-dirilmez", "ÇİFT", "Günlük üst sınır 2; yedekten geri yükleme: bitmemiş işler dirilmez, makine sayacı azalmaz",
  "§6 W2 (sayaç şirket dosyası dışında; geri yüklemeden sonra işler DURUR)", [A(), B(), C(), D(), E(), F(), G()],
  [baslat("+0s", "T1", "ABCDE"), olay("+1h", "geri_yukle"), baslat("+2h", "T2", "FG"), kontrol("+23h", "K1"), kontrol("+25h", "K2")],
  [({}, {"kontroller.K1.toplam_post": 2,
         "kontroller.K1.durum_sayilari": {"PLAN-SUSUYOR:geri-yukleme-durdu": 3, "Sınır Nedeniyle Bekliyor": 2, "Teslim Edildi": 2},
         "kontroller.K2.toplam_post": 4, "meta.toplam_post": 4, "isler.T2/F.durum": "Teslim Edildi", "isler.T2/G.durum": "Teslim Edildi",
         "durum_sayilari": {"PLAN-SUSUYOR:geri-yukleme-durdu": 3, "Teslim Edildi": 4}})],
  ayar={"gunluk_ust_sinir": 2}, meta_davranis={"kanca": {"*": K_STD}})

S("CIFT-13-veri-tasindi", "ÇİFT", "Veri başka makineye taşındı: bitmemiş işler 'Taşınan Veri — Durduruldu', gönderim yok", "§6 W2",
  [A(), B(), C()], [baslat("+0s", "T1", "ABC"), olay("+1h", "tasindi"), kontrol("+30h", "K1")],
  [({}, {"kontroller.K1.toplam_post": 1, "meta.toplam_post": 1, "durum_sayilari": {"Taşınan Veri — Durduruldu": 2, "Teslim Edildi": 1}})],
  ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

# ======================================================================== KAYIP
S("KAYIP-01-kapaliyken-kanca", "KAYIP", "Program kapalıyken gelen teslim kancası: Meta yeniden dener, açılınca işlenir", "§3 C, Meta 7 gün",
  [A(), B()], [baslat("+0s", "T1", "AB"), olay("+1h", "kapat"), kontrol("+2h30m", "K1"), olay("+3h", "ac"), olay("+3h1m", "kanca_kuyrugu"), kontrol("+3h30m", "K2")],
  [({}, {"kontroller.K1.durum_sayilari": {"Gönderildi": 2}, "kontroller.K1.medya_silme": 0,
         "kontroller.K2.durum_sayilari": {"Teslim Edildi": 2}, "kontroller.K2.medya_silme": 2})],
  meta_davranis={"kanca": {"*": [["sent", "+1s"], ["delivered", "+2h"]]}})

S("KAYIP-02-sekiz-gun-kapali", "KAYIP", "Program 8 gün kapalı: kanca 7 günde düştü; TTL çoktan geçti", "§3 C eksi, §6 W2 Süresi Doldu / Durum Bilinmiyor",
  [A()], [baslat("+0s", "T1", "A"), olay("+1h", "kapat"), olay("+8d", "ac"), olay("+8d1m", "kanca_kuyrugu"), kontrol("+8d2m", "K1")],
  [({"kancasiz_son": "suresi_doldu"}, {"isler.T1/A.durum": "Süresi Doldu", "meta.medya_silme": {"A": 1}, "bu_ay.sirket.A.2026-10": ay_kova(1, 0)}),
   ({"kancasiz_son": "durum_bilinmiyor"}, {"isler.T1/A.durum": "Durum Bilinmiyor", "meta.medya_silme": {"A": 0}, "bu_ay.sirket.A.2026-10": ay_kova(1, 0)})],
  serbest=["kancasiz_son"], meta_davranis={"kanca": {"A": [["delivered", "+2h"]]}})

S("KAYIP-03-tunel-kapali", "KAYIP", "Tünel kapalıyken gönderim sürer, kancalar Meta kuyruğunda bekler", "§6 W9 (tünel kuralı), §3 C",
  [A()], [olay("+0s", "tunel", acik=False), baslat("+0s", "T1", "A"), kontrol("+30m", "K1"), olay("+1h", "tunel", acik=True), olay("+1h1m", "kanca_kuyrugu")],
  [({}, {"kontroller.K1.isler": {"T1/A": "Meta Kabul Etti"}, "isler.T1/A.durum": "Teslim Edildi"})],
  meta_davranis={"kanca": {"*": K_STD}})

S("KAYIP-04-guncelleme-kapat-ac", "KAYIP", "Güncelleme kurulumu (düzgün kapanış) gönderim sırasında: kaldığı yerden sürer, çift yok", "§6 W2, §8 KAYIP",
  [A(), B(), C(), D()], [baslat("+0s", "T1", "ABCD"), olay("+3s", "kapat"), olay("+10m", "ac"), olay("+10m1s", "kanca_kuyrugu"), kontrol("+20m", "K1")],
  [({}, {"meta.post": {"A": 1, "B": 1, "C": 1, "D": 1}, "kontroller.K1.durum_sayilari": {"Teslim Edildi": 4}})],
  meta_davranis={"kanca": {"*": K_STD}})

S("KAYIP-05-meta-ulasilamaz", "KAYIP", "Meta'ya bağlantı kurulamıyor (sahte sunucu kapalı) 1 saat", "§6 W2 (ağ → Sonucu Belirsiz)",
  [A()], [olay("+0s", "meta_kapali", kapali=True), baslat("+0s", "T1", "A"), kontrol("+30m", "K1"), olay("+1h", "meta_kapali", kapali=False)],
  [({"baglanti_kurulamadi": "belirsiz"}, {"isler.T1/A.durum": "Sonucu Belirsiz", "meta.post": {"A": 0}, "meta.toplam_medya_yukleme": 0,
                                          "kontroller.K1.isler": {"T1/A": "Sonucu Belirsiz"}})],
  serbest=["baglanti_kurulamadi", "belirsiz_sonrasi"], meta_davranis={"kanca": {"*": K_STD}})

# ======================================================================== YANLIŞ KİŞİ
S("KISI-01-telefon-kuyrukta-degisti", "YANLIŞ KİŞİ", "Sınır nedeniyle bekleyen işin carisinin telefonu değişti", "§8 YANLIŞ KİŞİ (iş üretilirken okunan numara)",
  [A(), B()], [baslat("+0s", "T1", "A"), baslat("+1s", "T2", "B"), olay("+1h", "cari", id="B", telefon="0533 999 88 77"), kontrol("+2h", "K1")],
  [({}, {"meta.post": {"A": 1, "B": 1}, "kontroller.K1.isler": {"T1/A": "Teslim Edildi", "T2/B": "Sınır Nedeniyle Bekliyor"}}),
   ({"uretim_ani": "baslatma"}, {"isler.T2/B.telefon": "+905332223344"}),
   ({"uretim_ani": "isleme"}, {"isler.T2/B.telefon": "+905339998877"})],
  serbest=["uretim_ani"], ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("KISI-02-ayni-adli-iki-cari", "YANLIŞ KİŞİ", "Aynı adlı iki cari: her biri kendi numarasına, kendi bakiyesiyle", "§8 YANLIŞ KİŞİ, CLAUDE.md test kuralı",
  [cari("X1", "Ali Veli", "0535 111 11 11", [("2026-10-02", 100, 0)]), cari("X2", "Ali Veli", "0536 222 22 22", [("2026-10-03", 900, 0)])],
  [baslat("+0s", "T1", ["X1", "X2"])],
  [({}, {"isler.T1/X1.telefon": "+905351111111", "isler.T1/X2.telefon": "+905362222222",
         "isler.T1/X1.degiskenler": ["Ali Veli", FIRMA, DON, "100,00 TL"], "isler.T1/X2.degiskenler": ["Ali Veli", FIRMA, DON, "900,00 TL"],
         "isler.T1/X1.pdf.donem_sonu_bakiye": "100.00", "isler.T1/X2.pdf.donem_sonu_bakiye": "900.00", "meta.post": {"X1": 1, "X2": 1}})],
  meta_davranis={"kanca": {"*": K_STD}})

S("KISI-03-ayni-kisi-iki-kez", "YANLIŞ KİŞİ", "Seçimde aynı cari iki kez: tek iş (UNIQUE batch+account)", "§6 W2 göç",
  [A(), B()], [baslat("+0s", "T1", ["A", "A", "B"])],
  [({}, {"toplular.T1.is_sayisi": 2, "meta.post": {"A": 1, "B": 1}})], meta_davranis={"kanca": {"*": K_STD}})

S("KISI-04-hucrede-iki-numara", "YANLIŞ KİŞİ", "Telefon hücresinde iki numara: ilki", "§8 (waNumber ilkini alır)",
  [A(telefon="0532 111 22 33 / 0533 444 55 66")], [baslat("+0s", "T1", "A")],
  [({}, {"isler.T1/A.telefon": "+905321112233", "meta.post": {"A": 1}})], meta_davranis={"kanca": {"*": K_STD}})

S("KISI-05-sabit-hat", "YANLIŞ KİŞİ", "Sabit hat (WhatsApp'ta yok): gönderilirse 131026 kancası → Başarısız", "§8, §2.7",
  [cari("L", "Lale Kaya", "0212 555 11 22", [("2026-10-01", 10, 0)])], [baslat("+0s", "T1", ["L"])],
  [({"sabit_hat": "gonderilir"}, {"isler.T1/L.durum": "Başarısız", "isler.T1/L.hata_kodu": 131026, "isler.T1/L.telefon": "+902125551122", "meta.medya_silme": {"L": 1}}),
   ({"sabit_hat": "elenir"}, {"elenen.T1": {"L": "sabit_hat"}, "bos_toplu": ["T1"], "meta.post": {}})],
  serbest=["sabit_hat"], meta_davranis={"kanca": {"L": [["sent", "+1s"], ["failed", "+3s", {"kod": 131026}]]}})

S("KISI-06-yurt-disi", "YANLIŞ KİŞİ", "Yurt dışı numara (+49)", "§8",
  [cari("Y", "Yusuf Kurt", "+49 151 2345 6789", [("2026-10-01", 10, 0)])], [baslat("+0s", "T1", ["Y"])],
  [({"yurtdisi": "gonderilir"}, {"isler.T1/Y.telefon": "+4915123456789", "isler.T1/Y.durum": "Teslim Edildi"}),
   ({"yurtdisi": "elenir"}, {"elenen.T1": {"Y": "yurtdisi"}, "meta.post": {}})],
  serbest=["yurtdisi"], meta_davranis={"kanca": {"*": K_STD}})

S("KISI-07-telefonsuz", "YANLIŞ KİŞİ", "Telefonsuz / rakamsız hücreler elenir (özet 'geçersiz numara')", "§6 W4 özet",
  [A(), cari("N1", "Nur Ak", None), cari("N2", "Naz Bal", "-"), cari("N3", "Nil Can", "   "), cari("N4", "Nihat Dal", "yok")],
  [baslat("+0s", "T1", ["A", "N1", "N2", "N3", "N4"])],
  [({}, {"elenen.T1": {"N1": "telefonsuz", "N2": "telefonsuz", "N3": "telefonsuz", "N4": "telefonsuz"}, "meta.post": {"A": 1}, "toplular.T1.is_sayisi": 1})],
  meta_davranis={"kanca": {"*": K_STD}})

S("KISI-08-istemiyor", "YANLIŞ KİŞİ", "'WhatsApp Mesajı İstemiyor' işaretli cari toplu gönderimden çıkar", "§1, W6",
  [A(), B(istemiyor=True), C()], [baslat("+0s", "T1", "ABC")],
  [({}, {"elenen.T1": {"B": "istemiyor"}, "meta.post": {"A": 1, "C": 1}})], meta_davranis={"kanca": {"*": K_STD}})

S("KISI-09-istemiyor-sonradan", "YANLIŞ KİŞİ", "Kuyrukta beklerken 'İstemiyor' işaretlendi", "§8 YANLIŞ KİŞİ",
  [A(), B()], [baslat("+0s", "T1", "A"), baslat("+1s", "T2", "B"), olay("+1h", "cari", id="B", istemiyor=True), kontrol("+25h", "K1")],
  [({"kuyruk_degisimi": "gonderilir"}, {"meta.post": {"A": 1, "B": 1}, "isler.T2/B.durum": "Teslim Edildi"}),
   ({"kuyruk_degisimi": "elenir"}, {"meta.post": {"A": 1, "B": 0}, "isler.T2/B.durum": "PLAN-SUSUYOR:kuyrukta-elendi"})],
  serbest=["kuyruk_degisimi"], ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("KISI-10-silindi-kuyrukta", "YANLIŞ KİŞİ", "Kuyrukta beklerken cari silindi", "§8 YANLIŞ KİŞİ",
  [A(), B()], [baslat("+0s", "T1", "A"), baslat("+1s", "T2", "B"), olay("+1h", "cari", id="B", silindi=True), kontrol("+25h", "K1")],
  [({"kuyruk_degisimi": "elenir"}, {"meta.post.B": 0, "isler.T2/B.durum": "PLAN-SUSUYOR:kuyrukta-elendi"}),
   ({"kuyruk_degisimi": "gonderilir", "uretim_ani": "baslatma"}, {"meta.post.B": 1}),
   ({"kuyruk_degisimi": "gonderilir", "uretim_ani": "isleme"}, {"meta.post.B": 0})],
  serbest=["kuyruk_degisimi", "uretim_ani"], ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("KISI-11-numara-bicimleri", "YANLIŞ KİŞİ", "Numara her zaman '+' ve ülke koduyla (Meta: '+' yoksa işletme ülke kodu eklenir)", "§2.2",
  [A(telefon="+90 (532) 111-22-33"), B(telefon="0 533 222 33 44"), C(telefon="905343334455")], [baslat("+0s", "T1", "ABC")],
  [({}, {"isler.T1/A.telefon": "+905321112233", "isler.T1/B.telefon": "+905332223344", "isler.T1/C.telefon": "+905343334455"})],
  meta_davranis={"kanca": {"*": K_STD}})

# ======================================================================== YANLIŞ İÇERİK
P_LISTE = [("P1", "Pınar Bir", [("2026-10-01", 111, 0)], "111,00 TL", "111.00", "0.00", 1),
           ("P2", "Pelin İki", [("2026-10-02", 222.5, 0)], "222,50 TL", "222.50", "0.00", 1),
           ("P3", "Polat Üç", [("2026-10-03", 3333.33, 0)], "3.333,33 TL", "3333.33", "0.00", 1),
           ("P4", "Pakize Dört", [("2026-10-04", 50, 0), ("2026-10-05", 0, 6)], "44,00 TL", "44.00", "0.00", 2),
           ("P5", "Poyraz Beş", [("2026-09-30", 5.05, 0)], "5,05 TL", "5.05", "5.05", 0)]
S("ICERIK-01-pdf-karismasi", "YANLIŞ İÇERİK", "Beş cari, beş ayrı PDF: başka carinin PDF'i/bakiyesi gitmez; metin = PDF", "§6 W2 (aynı cari okuması), W3",
  [cari(i, ad, f"0541 000 00 0{n + 1}", h) for n, (i, ad, h, *_r) in enumerate(P_LISTE)], [baslat("+0s", "T1", [p[0] for p in P_LISTE])],
  [({}, {**{f"isler.T1/{i}.degiskenler": [ad, FIRMA, DON, m] for (i, ad, _h, m, *_r) in P_LISTE},
         **{f"isler.T1/{i}.pdf": {"cari_ad": ad, "donem_bas": "2026-10-01", "donem_son": "2026-10-31", "devir": dv, "hareket_sayisi": hs, "donem_sonu_bakiye": b}
            for (i, ad, _h, _m, b, dv, hs) in P_LISTE},
         "meta.medya_yukleme": {p[0]: 1 for p in P_LISTE}})],
  meta_davranis={"kanca": {"*": K_STD}})

S("ICERIK-02-devir-ve-donem-uclari", "YANLIŞ İÇERİK", "Devir (dönem öncesi) + ayın 1'i ve son günü dahil, sonraki ay hariç", "§1 (PDF seçilen döneme uyar), §8 dönem sınırı",
  [cari("Q", "Kemal Uç", "0542 111 22 33", [("2026-09-30", 100, 0), ("2026-10-01", 200, 0), ("2026-10-31", 0, 50), ("2026-11-01", 999, 0)])],
  [baslat("+0s", "T1", ["Q"])],
  [({}, {"isler.T1/Q.pdf": {"cari_ad": "Kemal Uç", "donem_bas": "2026-10-01", "donem_son": "2026-10-31", "devir": "100.00", "hareket_sayisi": 2, "donem_sonu_bakiye": "250.00"},
         "isler.T1/Q.degiskenler": ["Kemal Uç", FIRMA, DON, "250,00 TL"]})],
  meta_davranis={"kanca": {"*": K_STD}})

S("ICERIK-03-yil-donumu", "YANLIŞ İÇERİK", "1 Ocak 00:00:30'da Aralık ekstresi; 'Bu Ay' Ocak'a yazılır", "§8 TARİH / YANLIŞ İÇERİK (yıl dönümü)",
  [cari("R", "Rana Yıl", "0543 111 22 33", [("2026-11-30", 1000, 0), ("2026-12-01", 0, 400), ("2026-12-31", 50, 0), ("2027-01-01", 7, 0)])],
  [baslat("+0s", "T1", ["R"], donem=ARALIK)],
  [({}, {"isler.T1/R.pdf": {"cari_ad": "Rana Yıl", "donem_bas": "2026-12-01", "donem_son": "2026-12-31", "devir": "1000.00", "hareket_sayisi": 2, "donem_sonu_bakiye": "650.00"},
         "isler.T1/R.degiskenler": ["Rana Yıl", FIRMA, {"donem": ["2026-12-01", "2026-12-31"]}, "650,00 TL"], "bu_ay.sirket": {"A": {"2027-01": ay_kova(1, 1)}}})],
  baslangic="2027-01-01T00:00:30+03:00", meta_davranis={"kanca": {"*": K_STD}})

S("ICERIK-04-turkce-emoji-satir-sonu", "YANLIŞ İÇERİK", "Türkçe karakter + emoji korunur; satır sonu/sekme/çok boşluk tek boşluk", "§2.2 değişken temizliği",
  [cari("S", "Şükrü\nÖğüt\t😀   Çağ", "0544 111 22 33", [("2026-10-01", 1, 0)])], [baslat("+0s", "T1", ["S"])],
  [({}, {"isler.T1/S.degiskenler": ["Şükrü Öğüt 😀 Çağ", "İzmir Dış Ticaret A.Ş.", DON, "1,00 TL"],
         "isler.T1/S.dosya_adi.on_ek": "Ekstre Şükrü Öğüt 😀 Çağ ", "isler.T1/S.pdf.cari_ad": "Şükrü Öğüt 😀 Çağ"})],
  firmalar={"A": "İzmir  Dış\tTicaret\nA.Ş."}, meta_davranis={"kanca": {"*": K_STD}})

UZUN = "Uzun " + "Ad" * 150
S("ICERIK-05-cok-uzun-ad", "YANLIŞ İÇERİK", "305 karakterlik ad: program kısaltabilir (sınır D0), öneki korunur", "§2.2 (D0 uzunluk)",
  [cari("U", UZUN, "0545 111 22 33", [("2026-10-01", 1, 0)])], [baslat("+0s", "T1", ["U"])],
  [({}, {"isler.T1/U.degiskenler": [{"kisaltilabilir": UZUN}, FIRMA, DON, "1,00 TL"], "isler.T1/U.dosya_adi.on_ek": {"kisaltilabilir": "Ekstre " + UZUN}})],
  meta_davranis={"kanca": {"*": K_STD}})

S("ICERIK-06-eksi-bakiye", "YANLIŞ İÇERİK", "Alacaklı (eksi) bakiye: PDF -500; mesaj metni biçimi PLAN SUSUYOR", "§8 YANLIŞ İÇERİK",
  [cari("V", "Veli Alacaklı", "0546 111 22 33", [("2026-10-10", 0, 500)])], [baslat("+0s", "T1", ["V"])],
  [({}, {"isler.T1/V.degiskenler": ["Veli Alacaklı", FIRMA, DON, {"plan_susuyor": "eksi bakiye metni", "tutar": "-500.00"}],
         "isler.T1/V.pdf.donem_sonu_bakiye": "-500.00"})],
  meta_davranis={"kanca": {"*": K_STD}})

S("ICERIK-07-tutar-bicimi", "YANLIŞ İÇERİK", "Tutar biçimi 1.234.567,89 TL / 0,50 TL / 1.000,00 TL", "§8 (1.250,00 TL örneği)",
  [cari("W1", "Vural Bir", "0547 000 00 01", [("2026-10-01", 1234567.89, 0)]), cari("W2", "Vural İki", "0547 000 00 02", [("2026-10-01", 0.5, 0)]),
   cari("W3", "Vural Üç", "0547 000 00 03", [("2026-10-01", 1000, 0)])],
  [baslat("+0s", "T1", ["W1", "W2", "W3"])],
  [({}, {"isler.T1/W1.degiskenler": ["Vural Bir", FIRMA, DON, "1.234.567,89 TL"], "isler.T1/W2.degiskenler": ["Vural İki", FIRMA, DON, "0,50 TL"],
         "isler.T1/W3.degiskenler": ["Vural Üç", FIRMA, DON, "1.000,00 TL"]})],
  meta_davranis={"kanca": {"*": K_STD}})

S("ICERIK-08-tum-hareketler", "YANLIŞ İÇERİK", "'Tüm Hareketler' = bütün hesap (devir 0)", "§1",
  [A()], [baslat("+0s", "T1", "A", donem="tum")],
  [({}, {"isler.T1/A.pdf": {"cari_ad": "Ayşe Yılmaz", "donem_bas": None, "donem_son": None, "devir": "0.00", "hareket_sayisi": 3, "donem_sonu_bakiye": "1250.00"},
         "isler.T1/A.degiskenler": ["Ayşe Yılmaz", FIRMA, {"donem": [None, None]}, "1.250,00 TL"]})],
  meta_davranis={"kanca": {"*": K_STD}})

S("ICERIK-09-kuyrukta-bakiye-degisti", "YANLIŞ İÇERİK", "Sınırda beklerken cariye hareket girdi: metin ve PDF AYNI okumadan", "§6 W2 (metin = PDF)",
  [A(), B()], [baslat("+0s", "T1", "A"), baslat("+1s", "T2", "B"), olay("+1h", "cari", id="B", hareket_ekle={"tarih": "2026-10-30", "borc": 1000, "alacak": 0})],
  [({"uretim_ani": "baslatma"}, {"isler.T2/B.degiskenler": ["Mehmet Kaya", FIRMA, DON, "2.000,00 TL"], "isler.T2/B.pdf.donem_sonu_bakiye": "2000.00", "isler.T2/B.pdf.hareket_sayisi": 1}),
   ({"uretim_ani": "isleme"}, {"isler.T2/B.degiskenler": ["Mehmet Kaya", FIRMA, DON, "3.000,00 TL"], "isler.T2/B.pdf.donem_sonu_bakiye": "3000.00", "isler.T2/B.pdf.hareket_sayisi": 2})],
  serbest=["uretim_ani"], ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("ICERIK-10-ttl-sonrasi-teslim", "YANLIŞ İÇERİK", "Teslim kancası TTL + 1 sa'ten sonra geldi (Meta yeniden denemesi)", "§11 S2 A, §6 W2 Süresi Doldu",
  [A()], [baslat("+0s", "T1", "A"), kontrol("+72h30m", "K1"), kontrol("+73h30m", "K2")],
  [({}, {"kontroller.K1.isler": {"T1/A": "Gönderildi"}, "kontroller.K2.isler": {"T1/A": "Süresi Doldu"}, "meta.medya_silme": {"A": 1}}),
   ({"gec_teslim": "yok_sayilir"}, {"isler.T1/A.durum": "Süresi Doldu", "bu_ay.sirket.A.2026-10": ay_kova(1, 0)}),
   ({"gec_teslim": "teslim_yazilir"}, {"isler.T1/A.durum": "Teslim Edildi"})],
  serbest=["gec_teslim", "teslim_ay"], meta_davranis={"kanca": {"A": [["sent", "+1s"], ["delivered", "+76h"]]}})

S("ICERIK-11-ttl-icinde-gec-teslim", "YANLIŞ İÇERİK", "Teslim 70. saatte (TTL içinde): Teslim Edildi", "§11 S2 A",
  [A()], [baslat("+0s", "T1", "A"), kontrol("+73h30m", "K1")],
  [({}, {"kontroller.K1.isler": {"T1/A": "Teslim Edildi"}}),
   ({"teslim_ay": "kabul"}, {"bu_ay.sirket.A": {"2026-10": ay_kova(1, 1)}}),
   ({"teslim_ay": "teslim"}, {"bu_ay.sirket.A": {"2026-10": ay_kova(1, 0), "2026-11": ay_kova(0, 1)}})],
  serbest=["teslim_ay"], meta_davranis={"kanca": {"A": [["sent", "+1s"], ["delivered", "+70h"]]}})

# ======================================================================== HESAP / META (eşzamanlı hata → İLK hatada DURAKLAR)
for kod in (0, 10, 200, 131005, 368, 131031, 131042, 133010, 131045):
    S(f"HESAP-{kod}", "HESAP / META", f"Hesap/yetki hatası {kod}: toplu iş İLK hatada durur; Devam Et ile sürer", "§6 W2 hata sınıfı",
      [A(), B(), C()], [baslat("+0s", "T1", "ABC"), kontrol("+30m", "K1"), olay("+1h", "devam", toplu="T1"), kontrol("+2h", "K2")],
      [({}, {"kontroller.K1.toplam_post": 2, "kontroller.K1.durum_sayilari": {"Duraklatıldı": 2, "Teslim Edildi": 1},
             "meta.post": {"A": 1, "B": 2, "C": 1}, "durum_sayilari": {"Teslim Edildi": 3}})],
      serbest=["medya_tekrar"], meta_davranis={"mesaj": {"B": [{"hata": kod}]}, "kanca": {"*": K_STD}})

for kod in (132000, 132001, 132007, 132012, 132015, 132016, 132018):
    S(f"SABLON-GONDERIM-{kod}", "HESAP / META", f"Şablon hatası {kod} gönderimde: toplu iş durur, neden {kod}", "§6 W2",
      [A(), B(), C()], [baslat("+0s", "T1", "ABC")],
      [({}, {"toplular.T1": {"durum": "duraklatildi", "neden": kod, "is_sayisi": 3}, "meta.post.B": 1, "isler.T1/B.durum": "Duraklatıldı",
             "durum_sayilari": {"Duraklatıldı": 2, "Teslim Edildi": 1}})],
      serbest=["uretim_ani"], meta_davranis={"mesaj": {"B": {"hata": kod}}, "kanca": {"*": K_STD}})

for ad, durum, kategori in (("PENDING", "PENDING", "UTILITY"), ("REJECTED", "REJECTED", "UTILITY"), ("PAZARLAMA", "APPROVED", "MARKETING"),
                            ("DURAKLATILMIS", "PAUSED", "UTILITY"), ("YOK", None, None)):
    S(f"SABLON-BASLATMA-{ad}", "HESAP / META", f"Ekstre şablonu {durum}/{kategori}: gönderim BAŞLAMAZ (medya da yüklenmez)", "§2.4, W5",
      [A(), B()], [baslat("+0s", "T1", "AB")],
      [({}, {"baslamadi": {"T1": "sablon_uygun_degil"}, "meta.toplam_post": 0, "meta.toplam_medya_yukleme": 0})],
      meta={"sablonlar": {"destekofis_ekstre": {"durum": durum, "kategori": kategori}}})

S("SABLON-BASLATMA-YALNIZ-HATIRLATMA", "HESAP / META", "Hatırlatma şablonu Pazarlama'ya alındı: ekstre başlar, hatırlatma başlamaz", "§2.4",
  [A(), B()], [baslat("+0s", "T1", "A"), baslat("+1s", "T2", "B", sablon="hatirlatma")],
  [({}, {"baslamadi": {"T2": "sablon_uygun_degil"}, "meta.post": {"A": 1}})],
  meta={"sablonlar": {"destekofis_odeme_hatirlatma": {"durum": "APPROVED", "kategori": "MARKETING"}}}, meta_davranis={"kanca": {"*": K_STD}})

S("SABLON-SONRAKI-TOPLU", "HESAP / META", "Şablon arada duraklatıldı (Meta): sonraki toplu iş başlarken okunur, başlamaz", "§2.4 (her toplu gönderimden önce)",
  [A(), B()], [baslat("+0s", "T1", "A"), olay("+1h", "meta_sablon", ad="destekofis_ekstre", durum="PAUSED"), baslat("+2h", "T2", "B")],
  [({}, {"baslamadi": {"T2": "sablon_uygun_degil"}, "meta.post": {"A": 1}})], meta_davranis={"kanca": {"*": K_STD}})

# ---- geçici hatalar
S("GECICI-01-131000-iki-kez", "HESAP / META", "131000 iki kez, sonra kabul: artan bekleme, toplu iş sürer", "§6 W2",
  [A(), B(), C()], [baslat("+0s", "T1", "ABC")],
  [({}, {"meta.post": {"A": 1, "B": 3, "C": 1}, "durum_sayilari": {"Teslim Edildi": 3}, "toplular.T1.durum": "aktif"})],
  serbest=["medya_tekrar"], meta_davranis={"mesaj": {"B": [{"hata": 131000}, {"hata": 131000}]}, "kanca": {"*": K_STD}})

S("GECICI-02-bes-art-arda", "HESAP / META", "Servis sürekli 131016: 5 ardışık geçici hatada toplu iş durur", "§6 W2",
  [A(), B(), C()], [baslat("+0s", "T1", "ABC")],
  [({}, {"meta.toplam_post": 5, "toplular.T1": {"durum": "duraklatildi", "neden": 131016, "is_sayisi": 3}, "durum_sayilari": {"Duraklatıldı": 3}})],
  serbest=["medya_tekrar"], meta_davranis={"mesaj": {"*": {"hata": 131016}}})

S("GECICI-03-dort-sonra-kabul", "HESAP / META", "Dört ardışık geçici hata (5'e varmaz) sonra kabul", "§6 W2",
  [A(), B()], [baslat("+0s", "T1", "AB")],
  [({}, {"meta.post": {"A": 1, "B": 5}, "isler.T1/B.durum": "Teslim Edildi", "toplular.T1.durum": "aktif"})],
  serbest=["medya_tekrar"], meta_davranis={"mesaj": {"B": [{"hata": 131000}] * 4}, "kanca": {"*": K_STD}})

for kod in (130429, 131057, 80007, 4):
    S(f"GECICI-{kod}", "HESAP / META", f"Geçici {kod} bir kez: aynı kişi bekleyip yeniden", "§6 W2",
      [A(), B()], [baslat("+0s", "T1", "AB")],
      [({}, {"meta.post": {"A": 1, "B": 2}, "durum_sayilari": {"Teslim Edildi": 2}})],
      serbest=["medya_tekrar"], meta_davranis={"mesaj": {"B": [{"hata": kod}]}, "kanca": {"*": K_STD}})

S("GECICI-131056", "HESAP / META", "131056 (aynı alıcıya kısa sürede çok): o kişi 1 dk sonra; öbürleri sürer", "§6 W2",
  [A(), B(), C()], [baslat("+0s", "T1", "ABC"), kontrol("+50s", "K1"), kontrol("+3m", "K2")],
  [({}, {"kontroller.K1.isler.T1/B": "Bekliyor", "kontroller.K2.isler.T1/B": "Teslim Edildi", "meta.post": {"A": 1, "B": 2, "C": 1}})],
  serbest=["medya_tekrar"], meta_davranis={"mesaj": {"B": [{"hata": 131056}]}, "kanca": {"*": K_STD}})

# ---- 131049 ve alıcı hataları
S("ALICI-131049-bir-kez", "HESAP / META", "131049 (ekosistem) kancada: 24 saat sonra bir kez daha; ikinci teslim", "§6 W2",
  [A()], [baslat("+0s", "T1", "A"), kontrol("+12h", "K1"), kontrol("+23h", "K2"), kontrol("+25h", "K3")],
  [({}, {"kontroller.K1.isler": {"T1/A": "PLAN-SUSUYOR:131049-bekleme"}, "kontroller.K1.toplam_post": 1, "kontroller.K2.toplam_post": 1,
         "kontroller.K3.toplam_post": 2, "isler.T1/A.durum": "Teslim Edildi", "meta.post": {"A": 2}, "meta.kabul": {"A": 2}, "bu_ay.sirket.A.2026-10": ay_kova(2, 1)}),
   ({"medya_tekrar": "ayni"}, {"meta.medya_yukleme": {"A": 1}, "meta.medya_silme": {"A": 1}}),
   ({"medya_tekrar": "yeni"}, {"meta.medya_yukleme": {"A": 2}, "meta.medya_silme": {"A": 2}})],
  serbest=["medya_tekrar"], meta_davranis={"kanca": {"A": {"1": [["failed", "+10s", {"kod": 131049}]], "2": K_STD}}})

S("ALICI-131049-iki-kez", "HESAP / META", "131049 ikinci denemede de: Başarısız (en çok bir kez)", "§6 W2",
  [A()], [baslat("+0s", "T1", "A"), kontrol("+25h", "K1")],
  [({}, {"isler.T1/A.durum": "Başarısız", "isler.T1/A.hata_kodu": 131049, "meta.post": {"A": 2}, "kontroller.K1.isler": {"T1/A": "Başarısız"}})],
  serbest=["medya_tekrar"], meta_davranis={"kanca": {"A": {"*": [["failed", "+10s", {"kod": 131049}]]}}})

S("ALICI-131049-esanli", "HESAP / META", "131049 eşzamanlı yanıtta: 24 saat sonra bir kez", "§6 W2",
  [A()], [baslat("+0s", "T1", "A"), kontrol("+12h", "K1"), kontrol("+25h", "K2")],
  [({}, {"kontroller.K1.toplam_post": 1, "kontroller.K1.isler": {"T1/A": "PLAN-SUSUYOR:131049-bekleme"}, "kontroller.K2.toplam_post": 2, "isler.T1/A.durum": "Teslim Edildi"})],
  serbest=["medya_tekrar"], meta_davranis={"mesaj": {"A": [{"hata": 131049}]}, "kanca": {"*": K_STD}})

S("ALICI-131026-kancada", "HESAP / META", "WhatsApp kullanmayan numara: kabul edilir, kancada failed 131026 → Başarısız; toplu iş sürer", "§2.7, §6 W2",
  [A(), B()], [baslat("+0s", "T1", "AB")],
  [({}, {"isler.T1/B.durum": "Başarısız", "isler.T1/B.hata_kodu": 131026, "meta.medya_silme": {"A": 1, "B": 1}, "isler.T1/A.durum": "Teslim Edildi",
         "bu_ay.sirket.A.2026-10": ay_kova(2, 1)})],
  meta_davranis={"kanca": {"A": K_STD, "B": [["sent", "+1s"], ["failed", "+3s", {"kod": 131026}]]}})

S("ALICI-131021-esanli", "HESAP / META", "Alıcı = gönderen (131021): o iş Başarısız, toplu iş sürer", "§6 W2",
  [A(), B(), C()], [baslat("+0s", "T1", "ABC")],
  [({}, {"isler.T1/B.durum": "Başarısız", "meta.post": {"A": 1, "B": 1, "C": 1}, "toplular.T1.durum": "aktif", "durum_sayilari": {"Başarısız": 1, "Teslim Edildi": 2}})],
  meta_davranis={"mesaj": {"B": [{"hata": 131021}]}, "kanca": {"*": K_STD}})

# ======================================================================== ÖLÇEK / SINIR
def kalabalik(n, on="K"):
    return [cari(f"{on}{i:04d}", f"Kişi {i:04d}", f"0550 000 {i:04d}") for i in range(1, n + 1)]


KAL300 = kalabalik(300)
S("SINIR-01-250-uzeri", "ÖLÇEK", "Basamak 250, 300 kişi: 250'si ilk 24 saatte, 50'si ertesi pencerede kendiliğinden", "§2.5, §6 W2",
  KAL300, [baslat("+0s", "T1", [c["id"] for c in KAL300]), kontrol("+23h", "K1"), kontrol("+25h", "K2")],
  [({}, {"kontroller.K1.durum_sayilari": {"Sınır Nedeniyle Bekliyor": 50, "Teslim Edildi": 250}, "kontroller.K1.pencere_farkli_alici.W1": 250,
         "kontroller.K2.durum_sayilari": {"Teslim Edildi": 300}, "kontroller.K2.pencere_farkli_alici.W1": 50, "meta.toplam_post": 300})],
  ozet_cikti=True, meta={"basamak": 250}, meta_davranis={"kanca": {"*": K_STD}})

S("SINIR-02-basamak-artti", "ÖLÇEK", "Gönderim sırasında Meta basamağı 2.000'e çıktı: 6 saatlik okumada bekleyenler sürer", "§6 W2 (6 saatte bir)",
  KAL300, [baslat("+0s", "T1", [c["id"] for c in KAL300]), olay("+2h", "meta_basamak", basamak=2000), kontrol("+5h", "K1"), kontrol("+7h", "K2")],
  [({}, {"kontroller.K1.durum_sayilari": {"Sınır Nedeniyle Bekliyor": 50, "Teslim Edildi": 250}, "kontroller.K2.durum_sayilari": {"Teslim Edildi": 300}})],
  ozet_cikti=True, meta={"basamak": 250}, meta_davranis={"kanca": {"*": K_STD}})

S("SINIR-03-elle-ust-sinir", "ÖLÇEK", "Elle günlük üst sınır 3 (Meta 250): sınır = min", "§6 W2 (dailyCap)",
  [A(), B(), C(), D(), E()], [baslat("+0s", "T1", "ABCDE"), kontrol("+1h", "K1"), kontrol("+25h", "K2")],
  [({}, {"kontroller.K1.durum_sayilari": {"Sınır Nedeniyle Bekliyor": 2, "Teslim Edildi": 3}, "kontroller.K2.durum_sayilari": {"Teslim Edildi": 5}})],
  ayar={"gunluk_ust_sinir": 3}, meta_davranis={"kanca": {"*": K_STD}})

S("SINIR-04-meta-sinir-hatasi", "ÖLÇEK", "Meta sınır hatası (portföyün başka gönderimi; kod D0): kalanlar 24 saat bekler", "§6 W2",
  [A(), B(), C(), D(), E()], [baslat("+0s", "T1", "ABCD"), baslat("+2h", "T2", "E"), kontrol("+3h", "K1"), kontrol("+26h", "K2")],
  [({}, {"meta.post": {"A": 1, "B": 2, "C": 1, "D": 1, "E": 1}, "kontroller.K2.durum_sayilari": {"Teslim Edildi": 5}, "kontroller.K1.isler.T1/B": "Sınır Nedeniyle Bekliyor"}),
   ({"sinir_hatasi_kapsam": "toplu"}, {"kontroller.K1.isler.T2/E": "Teslim Edildi"}),
   ({"sinir_hatasi_kapsam": "waba"}, {"kontroller.K1.isler.T2/E": "Sınır Nedeniyle Bekliyor"})],
  serbest=["sinir_hatasi_kapsam", "medya_tekrar"], meta_davranis={"mesaj": {"B": [{"sinir": True}]}, "kanca": {"*": K_STD}})

S("SINIR-05-pencerede-sayili-alici", "ÖLÇEK", "Sınır dolu (2); ikinci toplu iş: A zaten pencerede, C yeni", "§6 W2 (FARKLI alıcı)",
  [A(), B(), C()], [baslat("+0s", "T1", "AB"), baslat("+1h", "T2", "AC", donem=EYLUL), kontrol("+2h", "K1"), kontrol("+25h", "K2")],
  [({}, {"kontroller.K1.isler.T2/C": "Sınır Nedeniyle Bekliyor", "kontroller.K2.durum_sayilari": {"Teslim Edildi": 4}}),
   ({"sinir_mevcut_alici": "gecer"}, {"kontroller.K1.isler.T2/A": "Teslim Edildi"}),
   ({"sinir_mevcut_alici": "bekler"}, {"kontroller.K1.isler.T2/A": "Sınır Nedeniyle Bekliyor"})],
  serbest=["sinir_mevcut_alici"], ayar={"gunluk_ust_sinir": 2}, meta_davranis={"kanca": {"*": K_STD}})

S("SINIR-06-gece-yarisi-kayan", "TARİH", "Sınır 3, 23:00'te 3 ileti; 00:30'daki toplu iş takvim gününe değil kayan 24 saate bakar", "§6 W2 (kayan 24 saat), §8 TARİH",
  [A(), B(), C(), D(), E()], [baslat("+0s", "T1", "ABC"), baslat("+1h30m", "T2", "DE"), kontrol("+2h", "K1"), kontrol("+23h30m", "K2"), kontrol("+25h", "K3")],
  [({}, {"kontroller.K1.durum_sayilari": {"Sınır Nedeniyle Bekliyor": 2, "Teslim Edildi": 3}, "kontroller.K2.durum_sayilari": {"Sınır Nedeniyle Bekliyor": 2, "Teslim Edildi": 3},
         "kontroller.K3.durum_sayilari": {"Teslim Edildi": 5}, "bu_ay.sirket.A.2026-10.kabul": 5})],
  baslangic="2026-10-30T23:00:00+03:00", ayar={"gunluk_ust_sinir": 3}, meta_davranis={"kanca": {"*": K_STD}})


def sirket_cari(id_, sirket, tel):
    return cari(id_, f"Cari {id_}", tel, [("2026-10-01", 10, 0)], sirket=sirket)


S("SIRKET-01-ayni-waba", "ŞİRKET", "İki şirket aynı WABA'yı kullanır: sayaç ortak (makine düzeyi, WABA'ya göre)", "§6 W2",
  [sirket_cari("A1", "A", "0551 000 00 01"), sirket_cari("A2", "A", "0551 000 00 02"), sirket_cari("B1", "B", "0552 000 00 01"), sirket_cari("B2", "B", "0552 000 00 02")],
  [baslat("+0s", "T1", ["A1", "A2"], sirket="A"), baslat("+1m", "T2", ["B1", "B2"], sirket="B"), kontrol("+1h", "K1"), kontrol("+25h", "K2")],
  [({}, {"kontroller.K1.toplam_kabul": 3, "kontroller.K1.pencere_farkli_alici.W1": 3, "kontroller.K2.toplam_kabul": 4,
         "isler.T1/A1.degiskenler": ["Cari A1", "Alfa Ltd.", DON, "10,00 TL"], "isler.T2/B1.degiskenler": ["Cari B1", "Beta Ltd.", DON, "10,00 TL"]}),
   ({}, {"bu_ay.sirket": {"A": {"2026-10": ay_kova(2, 2)}, "B": {"2026-10": ay_kova(2, 2)}}, "bu_ay.waba": {"W1": {"2026-10": ay_kova(4, 4)}}})],
  firmalar={"A": "Alfa Ltd.", "B": "Beta Ltd."}, wabalar={"A": "W1", "B": "W1"}, ayar={"gunluk_ust_sinir": 3},
  meta_davranis={"kanca": {"*": K_STD}})

S("SIRKET-02-ayri-waba", "ŞİRKET", "İki şirket ayrı WABA: sayaçlar ayrı", "§6 W2",
  [sirket_cari("A1", "A", "0551 000 00 01"), sirket_cari("B1", "B", "0552 000 00 01")],
  [baslat("+0s", "T1", ["A1"], sirket="A"), baslat("+1m", "T2", ["B1"], sirket="B"), kontrol("+1h", "K1")],
  [({}, {"kontroller.K1.pencere_farkli_alici": {"W1": 1, "W2": 1}}),
   ({}, {"bu_ay.sirket": {"A": {"2026-10": ay_kova(1, 1)}, "B": {"2026-10": ay_kova(1, 1)}}, "bu_ay.waba": {"W1": {"2026-10": ay_kova(1, 1)}, "W2": {"2026-10": ay_kova(1, 1)}}})],
  firmalar={"A": "Alfa Ltd.", "B": "Beta Ltd."}, wabalar={"A": "W1", "B": "W2"}, meta_davranis={"kanca": {"*": K_STD}})

KAL2000 = kalabalik(2000)
S("OLCEK-01-iki-bin", "ÖLÇEK", "2.000 carilik toplu gönderim (basamak 2.000): her biri bir kez, PDF her biri bir kez silinir", "§8 ÖLÇEK",
  KAL2000, [baslat("+0s", "T1", [c["id"] for c in KAL2000]), kontrol("+3h", "K1")],
  [({}, {"kontroller.K1.durum_sayilari": {"Teslim Edildi": 2000}, "kontroller.K1.medya_silme": 2000, "meta.toplam_post": 2000, "meta.toplam_medya_yukleme": 2000,
         "isler_post_dagilimi": {"1": 2000}})],
  ozet_cikti=True, meta={"basamak": 2000}, meta_davranis={"kanca": {"*": K_STD}})

KAL600 = kalabalik(600)
S("OLCEK-02-uc-gune-yayilan", "ÖLÇEK", "Basamak 250, 600 kişi: üç güne yayılır (250 / 250 / 100)", "§8 ÖLÇEK (250 sınırında birkaç güne yayılan iş)",
  KAL600, [baslat("+0s", "T1", [c["id"] for c in KAL600]), kontrol("+23h", "K1"), kontrol("+25h", "K2"), kontrol("+47h", "K3"), kontrol("+49h", "K4")],
  [({}, {"kontroller.K1.durum_sayilari": {"Sınır Nedeniyle Bekliyor": 350, "Teslim Edildi": 250}, "kontroller.K2.durum_sayilari": {"Sınır Nedeniyle Bekliyor": 100, "Teslim Edildi": 500},
         "kontroller.K3.durum_sayilari": {"Sınır Nedeniyle Bekliyor": 100, "Teslim Edildi": 500}, "kontroller.K4.durum_sayilari": {"Teslim Edildi": 600}, "meta.toplam_post": 600})],
  ozet_cikti=True, meta={"basamak": 250}, meta_davranis={"kanca": {"*": K_STD}})

KAL500 = kalabalik(500)
S("OLCEK-03-kanca-yagmuru", "ÖLÇEK", "500 ileti × 9 kanca (3× yinelenen, sırasız): son durum Okundu, teslim 500, PDF 500 kez silinir", "§8 ÖLÇEK (kanca yağmuru)",
  KAL500, [baslat("+0s", "T1", [c["id"] for c in KAL500]), kontrol("+2h", "K1")],
  [({}, {"kontroller.K1.durum_sayilari": {"Okundu": 500}, "kontroller.K1.medya_silme": 500, "bu_ay.sirket": {"A": {"2026-10": ay_kova(500, 500)}}})],
  ozet_cikti=True, meta={"basamak": 2000},
  meta_davranis={"kanca": {"*": [["read", "+2s", {"tekrar": 3}], ["delivered", "+4s", {"tekrar": 3}], ["sent", "+6s", {"tekrar": 3}]]}})

# ======================================================================== GÜVENLİK
S("GUV-01-yetkisiz", "GÜVENLİK", "whatsapp.send yetkisi olmayan kullanıcı başlatamaz", "§4",
  [A()], [baslat("+0s", "T1", "A", kullanici="personel")],
  [({}, {"baslamadi": {"T1": "yetki_yok"}, "meta.toplam_post": 0, "meta.toplam_medya_yukleme": 0})],
  kullanicilar={"yonetici": {"whatsapp.send": True}, "personel": {}})

S("GUV-02-salt-okunur-lisans", "GÜVENLİK", "Salt okunur lisansta yeni gönderim başlamaz", "§4",
  [A()], [baslat("+0s", "T1", "A")], [({}, {"baslamadi": {"T1": "lisans_salt_okunur"}, "meta.toplam_post": 0})], ayar={"lisans_yazilabilir": False})

S("GUV-03-lisans-arada-biter", "GÜVENLİK", "Gönderim sürerken lisans salt okunur: bekleyenler 'Lisans Nedeniyle Durdu'; kanca kabulü sürer", "§4",
  [A(), B(), C(), D()], [baslat("+0s", "T1", "ABCD"), olay("+1h", "lisans", yazilabilir=False), kontrol("+3h", "K1"), kontrol("+30h", "K2")],
  [({}, {"kontroller.K1.durum_sayilari": {"Lisans Nedeniyle Durdu": 2, "Teslim Edildi": 2}, "kontroller.K2.durum_sayilari": {"Lisans Nedeniyle Durdu": 2, "Teslim Edildi": 2},
         "meta.toplam_post": 2})],
  ayar={"gunluk_ust_sinir": 2}, meta_davranis={"kanca": {"*": [["sent", "+1s"], ["delivered", "+2h"]]}})

S("GUV-04-onay-yok", "GÜVENLİK", "'Aydınlatma metnimi okudum…' onayı işaretsiz: toplu gönderim BAŞLAMAZ", "§1, W4",
  [A(), B()], [baslat("+0s", "T1", "AB")], [({}, {"baslamadi": {"T1": "onay_yok"}, "meta.toplam_post": 0, "meta.toplam_medya_yukleme": 0})], ayar={"onay": False})

S("GUV-05-sahte-kanca", "GÜVENLİK", "Bilinmeyen wamid'li sahte durum olayları düşer", "§3 (bilinmeyen olay düşer)",
  [A()], [baslat("+0s", "T1", "A"), olay("+1h", "sahte_kanca", wamid="wamid.SAHTE", durum="delivered"),
          olay("+1h1m", "sahte_kanca", wamid="wamid.SAHTE2", durum="failed", kod=131026)],
  [({}, {"isler.T1/A.durum": "Teslim Edildi", "bu_ay.sirket.A.2026-10": ay_kova(1, 1), "meta.toplam_kabul_program": 1})], meta_davranis={"kanca": {"*": K_STD}})

S("GUV-06-sahte-opaque", "GÜVENLİK", "Sahte olay Sonucu Belirsiz işin kimliğini (opaque) taşıyor — çözülürse sahte teslim yazılır (RİSK)", "§3 ↔ §6 W2 çelişkisi",
  [A()], [baslat("+0s", "T1", "A"), olay("+1h", "sahte_kanca", wamid="wamid.SAHTE", durum="delivered", opaque="T1/A")],
  [({}, {"meta.toplam_meta_ileti": 0, "meta.post": {"A": 1}}),
   ({"belirsiz_cozum": "opaque_cozer"}, {"isler.T1/A.durum": "Teslim Edildi", "bu_ay.sirket.A.2026-10": ay_kova(1, 1)}),
   ({"belirsiz_cozum": "bilinmeyen_duser"}, {"isler.T1/A.durum": "Sonucu Belirsiz", "bu_ay.sirket": {}})],
  serbest=["belirsiz_cozum", "belirsiz_sonrasi"], meta_davranis={"mesaj": {"A": ["yanitsiz_red"]}},
  bilinen_ihlal={"kabul_meta": {"belirsiz_cozum": "opaque_cozer", "neden": "sahte olay Meta'da olmayan iletiyi 'Meta Kabul Etti' yapar (RİSK, PLAN SUSUYOR 3)"}})

S("GUV-07-bagli-degil", "GÜVENLİK", "API bağlantısı yok: otomatik gönderim yok (wa.me yolu sürer)", "§1",
  [A()], [baslat("+0s", "T1", "A")], [({}, {"baslamadi": {"T1": "bagli_degil"}, "meta.toplam_post": 0})], ayar={"bagli": False})

# ======================================================================== TARİH
S("TARIH-01-ay-sonu", "TARİH", "31.10 23:59:50 kabul, 01.11 00:00:20 teslim: 'Bu Ay' sayacının ay anahtarı", "§6 W4",
  [A()], [baslat("+0s", "T1", "A")],
  [({"teslim_ay": "kabul"}, {"bu_ay.sirket": {"A": {"2026-10": ay_kova(1, 1)}}}),
   ({"teslim_ay": "teslim"}, {"bu_ay.sirket": {"A": {"2026-10": ay_kova(1, 0), "2026-11": ay_kova(0, 1)}}})],
  serbest=["teslim_ay"], baslangic="2026-10-31T23:59:50+03:00", meta_davranis={"kanca": {"A": [["sent", "+1s"], ["delivered", "+30s"]]}})

S("TARIH-02-ttl-sonu", "TARİH", "Yalnız 'sent' geldi: TTL + 1 saatte Süresi Doldu, PDF silinir; öncesinde değil", "§6 W2, §11 S2/S3",
  [A()], [baslat("+0s", "T1", "A"), kontrol("+72h30m", "K1"), kontrol("+73h30m", "K2")],
  [({}, {"kontroller.K1.isler": {"T1/A": "Gönderildi"}, "kontroller.K1.medya_silme": 0, "kontroller.K2.isler": {"T1/A": "Süresi Doldu"}, "kontroller.K2.medya_silme": 1})],
  meta_davranis={"kanca": {"A": [["sent", "+1s"]]}})

S("TARIH-03-kancasiz", "TARİH", "Hiç kanca gelmedi: TTL + 1 sa mı (Süresi Doldu), 7 gün mü (Durum Bilinmiyor)", "§6 W2 (iki kural)",
  [A()], [baslat("+0s", "T1", "A"), kontrol("+73h30m", "K1"), kontrol("+7d1h", "K2")],
  [({"kancasiz_son": "suresi_doldu"}, {"kontroller.K1.isler": {"T1/A": "Süresi Doldu"}, "kontroller.K2.isler": {"T1/A": "Süresi Doldu"}}),
   ({"kancasiz_son": "durum_bilinmiyor"}, {"kontroller.K1.isler": {"T1/A": "Meta Kabul Etti"}, "kontroller.K2.isler": {"T1/A": "Durum Bilinmiyor"}})],
  serbest=["kancasiz_son"])

S("TARIH-04-eski-toplu-sinirda", "TARİH", "Program 29 saat kapalı; sınırda bekleyen 24 saatten eski toplu iş açılışta", "§6 W2 ↔ §8 ÖLÇEK",
  [A(), B()], [baslat("+0s", "T1", "AB"), olay("+1h", "kapat"), olay("+30h", "ac"), kontrol("+30h30m", "K1"), olay("+31h", "devam", toplu="T1"), kontrol("+32h", "K2")],
  [({}, {"kontroller.K2.toplam_post": 2}),
   ({"eski_toplu_sinir": "sorulur"}, {"kontroller.K1.toplam_post": 1}),
   ({"eski_toplu_sinir": "surer"}, {"kontroller.K1.toplam_post": 2})],
  serbest=["eski_toplu_sinir"], ayar={"gunluk_ust_sinir": 1}, meta_davranis={"kanca": {"*": K_STD}})

S("TARIH-05-eski-toplu", "TARİH", "Program 25 saat kapalı: 24 saatten eski toplu iş kendiliğinden SÜRMEZ; Devam Et ile sürer", "§6 W2",
  [A(), B()], [baslat("+0s", "T1", "AB"), olay("+200ms", "kapat"), olay("+25h", "ac"), olay("+25h1m", "kanca_kuyrugu"), kontrol("+25h30m", "K1"),
               olay("+26h", "devam", toplu="T1"), kontrol("+27h", "K2")],
  [({}, {"kontroller.K1.toplam_post": 1, "kontroller.K1.durum_sayilari": {"PLAN-SUSUYOR:24-saatten-eski-devam-sorusu": 1, "Teslim Edildi": 1},
         "kontroller.K2.toplam_post": 2, "durum_sayilari": {"Teslim Edildi": 2}})],
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
                       "serbest_secimler": {k: list(v) for k, v in kahin.SERBEST.items()}, "senaryolar": cikti}, f, ensure_ascii=False, indent=1)
            f.write("\n")
        print("senaryolar.json yazıldı")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
