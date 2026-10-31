#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""WhatsApp toplu gönderim KÂHİNİ — DestekOfis 2.4.8 K0 (temiz oda; yalnız standart kütüphane).

Kaynak YALNIZ plan: docs/erp/WHATSAPP-API-PLANI-2.4.8.md (§1, §2.2–§2.7, §3, §4, §6 W2–W6, §7a NETLEŞTİRMELER 1–32, §8, §11 S1–S4 = A).
Programın kodu (server/, client/, bulut/) GÖRÜLMEDİ. Meta davranışı (kanca biçimi, "read, delivered'ı içerir", 7 gün yeniden deneme)
Meta belgesinden. İlk sürümde planın sustuğu 15 nokta "serbest seçim"di; plan §7a (30.10.2026; K1–K3 ürün sahibi, öbürleri baş mimar
kararı + ürün sahibi "önerilerin uygun") hepsini kararlaştırdı → SERBEST artık BOŞ, her kural sabit (kaynak satırında "§7a n").
Revizyon R1–R3 (30.10.2026 15:18 UTC, plan §7a sonu): R1 Meta'ya hiç ulaşılamıyorsa "Bağlantı Bekleniyor" (Başarısız değil, deneme sayacı
artmaz, bağlantı dönünce kendiliğinden sürer); R2 şablon kategorisi her 100 iletide ve en geç 10 dakikada bir okunur; R3 aynı cari + şablon + dönem
daha önce gönderilmişse uyarı, varsayılan "Bunları Çıkar", açık "Yine de Gönder" bayrağıyla gider.
§7a metninin yine yoruma açık bıraktığı ayrıntılar README "Kâhin yorumları"nda listelidir.

KÂHİN GÜNCELLEMESİ 2 (31.10.2026, temiz oda; program kodu GÖRÜLMEDİ): ürün sahibinin 31.10.2026 kararları K1–K8 (metinleri AYNEN KARARLAR'da,
kaynak CLAUDE.md "Açık iş" KARAR satırları + docs/2.4.8-IS-LISTESI.md) kâhine eklendi: dönem eşliği (Bu Ay/Geçen Ay takvim ayı, Son 3 Ay/Tüm Hareketler
7 gün içinde aynı seçim, özel aralık birebir, hatırlatma aynı gün), "Zaten Kuyrukta" aynı eşlik + yaşa bakılmaz, Süresi Doldu/Başarısız ve Meta Bekletti
(ret/iptal/geri yükleme/taşıma) "Daha Önce Gönderildi" sayılmaz (geç teslimde sayılır), yeniden deneme asıl işin döneminde, asıl işin Yine de Gönder
kararı taşınır (açılıştan önceki kabuller yok sayılır), yeniden denemede Sonucu Belirsiz elemesi + öneri, Gönderimler listesi (30'ar, imleç, yerel gün).
Karar metninin sustuğu yerler {"plan_susuyor": …} ya da {"secenek": [...], "susuyor": …} yaprağıdır (README §7 "KÂHİN SUSUYOR").

KÂHİN GÜNCELLEMESİ 4 (31.10.2026): N2–N5 yanıtları E1–E4 (KARARLAR) — yorum 21 teyit (defterdeki belirsiz yeni işte elemez, yeniden denemede eler), TEK neden
ve HER YERDE sıra Zaten Kuyrukta → Sonucu Belirsiz → Daha Önce Gönderildi (elenen R3 uyarısına girmez), hatırlatmada belirsiz eşliği aynı yerel gün, Son 3 Ay / Tüm'de
sonraki denemenin kabulü 7 günden eskiyse yeniden gönderilir; N6: yeniden denemede başka işte bekleyen "Zaten Kuyrukta".

KÂHİN GÜNCELLEMESİ 3 (31.10.2026, temiz oda): README §7.4'teki ★ soruların kullanıcı yanıtları D1–D8 (KARARLAR): Sonucu Belirsiz kişi yeni toplu işte de
"Sonucu Belirsiz" ile elenir (eski yorum 3 "Zaten Kuyrukta" düştü), hatırlatmada Zaten Kuyrukta gün bakılmadan, Son 3 Ay / Tüm'de yeniden denemenin 7 günü yeni
gönderim anından, özel aralık ↔ aynı tarihli hazır seçim aynı dönem, asıl işten yeniden denenen kişinin sonraki denemesi kabul edildiyse "Daha Önce Gönderildi" /
bekliyorsa "Zaten Kuyrukta", Yine de Gönder ile aşılmış eski belirsiz deneme de sayılır, geri yükleme sonrası defterdeki kabul ve taşınan veride dosyadaki ileti R3'te sayılır.

Planın uygulamaya bıraktığı tek serbestlik işçinin adım süresi ("~1 sn"): İKİ UÇLA koşulur (hızlı 0,5 sn, yavaş 5 sn). Sıra artık plan
kuralı (§7a 5: seçim sırası). İki koşuda aynı çıkan değer KESİN; ayrışan değer {"biri": [...]} olur (program bunlardan birini vermeli).

Komut satırı:
  python3 -I kahin.py hesapla senaryo.json
  python3 -I kahin.py karsilastir beklenen.json program.json
"""
import copy
import heapq
import itertools
import json
import re
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

SN = 1000
DK = 60 * SN
SA = 60 * DK
GUN = 24 * SA
TR = timezone(timedelta(hours=3))   # §7a 19 "Türkiye saati" (UTC+3, yaz saati yok)

# Plan §6 W2 + §7a ekran durumları (adlar AYNEN plandan)
BEKLIYOR = "Bekliyor"
HAZIRLANIYOR = "Hazırlanıyor"
GONDERILIYOR = "Gönderiliyor"
KABUL = "Meta Kabul Etti"
GONDERILDI = "Gönderildi"
TESLIM = "Teslim Edildi"
OKUNDU = "Okundu"
BASARISIZ = "Başarısız"
BELIRSIZ = "Sonucu Belirsiz"
SINIR = "Sınır Nedeniyle Bekliyor"
DURAKLATILDI = "Duraklatıldı"
IPTAL = "İptal"
SURESI_DOLDU = "Süresi Doldu"
LISANS = "Lisans Nedeniyle Durdu"                     # §4, §7a 25
TASINAN = "Taşınan Veri — Durduruldu"                 # §6 W2
DURDU_GERI_YUKLEME = "Durduruldu (Geri Yükleme)"      # §7a 26
ATLANDI = "Atlandı"                                   # §7a 2
BEKLEME_131049 = "Meta Bekletti (24 Saat Sonra Yeniden)"   # §7a 14
SORULUYOR = "PLAN-SUSUYOR:24-saatten-eski-devam-sorusu"    # §7a 24 "açılışta sorulur" — iş durumu adı verilmedi
SABLON_PAZARLAMA = "Şablon Pazarlama'ya Alındı"       # §7a 27 (toplu işin durma nedeni)
BAGLANTI = "BAGLANTI"                                 # bağlantı kurulamadı (§7a 11) — Meta kodu yok; kâhinin iç etiketi (yalnız M61'de iş koduna yazılır)
BAGLANTI_BEKLENIYOR = "Bağlantı Bekleniyor"           # §7a R1: Meta'ya hiç ulaşılamıyorsa toplu işin durma nedeni
DAHA_ONCE = "daha_once_gonderildi"                    # §7a R3: elenme nedeni ("Daha Önce Gönderildi")
BELIRSIZ_NEDEN = "sonucu_belirsiz"                    # K6: yeniden denemede elenme nedeni ("Sonucu Belirsiz")
ONERI_IS = "isteki_yine_de_gonder"                    # K6: iş dosyada dururken eleme iletisi yalnız "işteki Yine de Gönder"i önerir
ONERI_YENI = "yeni_gonderim"                          # K6: iş dosyada yoksa (geri yükleme sonrası) "yeni gönderim başlatın"
R3_PENCERE = 7 * 24 * 60 * 60 * 1000                  # K1: Son 3 Ay / Tüm Hareketler "son 7 gün içinde aynı seçim" (kâhin yorumu 16: kayan 7 × 24 saat)
SAYFA = 30                                            # K8: Gönderimler listesi 30'ar
SECIMLER = ("bu_ay", "gecen_ay", "son_3_ay", "tum")   # K1: hazır dönem seçimleri (özel aralık = {"bas", "son"})

SIRA = {KABUL: 1, GONDERILDI: 2, TESLIM: 3, OKUNDU: 4}
GONDERILMIS = {KABUL, GONDERILDI, TESLIM, OKUNDU}     # §7a R3 "Meta Kabul Etti ve sonrası" (kâhin yorumu: Süresi Doldu / Başarısız sayılmaz)
SABLON_OKUMA_ARALIK = 10 * 60 * 1000                  # §7a R2: en geç 10 dakikada bir
SABLON_OKUMA_ILETI = 100                              # §7a R2: her 100 iletide
KESIN = {TESLIM, OKUNDU, BASARISIZ, SURESI_DOLDU}
CALISIR = (BEKLIYOR, SINIR, BEKLEME_131049)
GERI_DONEBILIR = {BEKLIYOR, SINIR, BEKLEME_131049, HAZIRLANIYOR, DURAKLATILDI, LISANS, SORULUYOR, GONDERILIYOR}
DURDURULABILIR = {BEKLIYOR, SINIR, BEKLEME_131049, HAZIRLANIYOR, DURAKLATILDI, SORULUYOR, LISANS}
KUYRUKTA = {BEKLIYOR, HAZIRLANIYOR, GONDERILIYOR, SINIR, DURAKLATILDI, BEKLEME_131049, LISANS, SORULUYOR}  # §7a 9 (+10)
# Kâhin güncellemesi 3 (D1, kullanıcı "b"): Sonucu Belirsiz artık "Zaten Kuyrukta" DEĞİL — yeni toplu işte ayrı "Sonucu Belirsiz" elemesi (eski yorum 3 düştü)
KAPANDI_TESLIMSIZ = {BASARISIZ, IPTAL, DURDU_GERI_YUKLEME, TASINAN}   # K3/K7: teslim olmadan kapanan iş (geç teslim gelirse "Daha Önce Gönderildi" sayılır)
PDF_SUSUYOR = {IPTAL, DURDU_GERI_YUKLEME, TASINAN}    # §11 S3 yalnız teslim / başarısız / süresi doldu'yu sayar → bu durumlarda PDF silinmesi PLAN SUSUYOR

# Plan §6 W2 + §7a 12 hata sınıfları
DURAKLATAN = {0, 190, 10, 131005, 368, 131031, 131042, 133010, 131045, 132001, 132000, 132012, 132018, 132007, 132015, 132016}
DURAKLATAN_ARALIK = range(200, 300)
ALICI = {131026, 131021, 131009}
GECICI = {131000, 131016, 130429, 80007, 4, 131057, 1, 2, 133004}   # §7a 12, 15 + R1: Meta'nın YANIT verdiği geçici hatalar (bağlantı yok → R1 beklemesi)
SINIR_KODLARI = {131048}                                                       # §7a 12 → madde 30
GECICI_DIZI = (30 * SN, 2 * DK, 15 * DK)                                        # §7a 15: 30 sn → 2 dk → 15 dk, sonra Başarısız
ICERIK_SABLON = {"ekstre": "destekofis_ekstre", "hatirlatma": "destekofis_odeme_hatirlatma"}
TTL = 72 * SA          # §11 S2 A
TTL_PAYI = 1 * SA      # §6 W2
KANCA_OMRU = 7 * GUN   # Meta: 7 güne kadar yeniden deneme; §7a 16 "son 7 günde en az bir kanca"
UCRET_USD = Decimal("0.0009")

# §7a 23 + W5: programın açması beklenen şablonlar (dil tr, kategori UTILITY)
SABLONLAR = {
    "destekofis_ekstre": {"baslik": "DOCUMENT",
                          "govde": "Sayın {{1}}, {{2}} firmasındaki cari hesabınızın {{3}} dönemine ait ekstresi ektedir. Dönem sonu bakiyesi: {{4}}. İyi günler dileriz.",
                          "alt_satir": "KVKK aydınlatma metni için firmamıza başvurabilirsiniz.", "dil": "tr", "kategori": "UTILITY"},
    "destekofis_odeme_hatirlatma": {"baslik": None,
                                    "govde": "Sayın {{1}}, {{2}} firmasındaki hesabınızda {{3}} vadeli {{4}} tutarında ödemeniz bulunmaktadır. Güncel bakiye: {{5}}. Ödeme yaptıysanız bu mesajı dikkate almayınız.",
                                    "alt_satir": None, "dil": "tr", "kategori": "UTILITY"},
}

SERBEST = {}   # §7a bütün PLAN SUSUYOR noktalarını kararlaştırdı (30.10.2026). Yeni belirsizlik çıkarsa buraya seçenek olarak eklenir.
ZAMANLAR = ("hizli", "yavas")
ADIM = {"hizli": 500, "yavas": 5 * SN}

MUTASYONLAR = {
    "M1": "gönderim sınırı FARKLI alıcı yerine kabul sayısıyla",
    "M2": "'WhatsApp Mesajı İstemiyor' yok sayılır",
    "M3": "yanıtsız istek kendiliğinden yeniden gönderilir",
    "M4": "PDF (medya) kesinleşmeden, kabulde silinir",
    "M5": "aynı cari iki kez seçilince iki iş",
    "M6": "sınır kayan 24 saat yerine takvim günü",
    "M7": "TTL 3 gün yerine 30 gün",
    "M8": "şablon durumu/kategorisi başlatmada denetlenmez",
    "M9": "5 ardışık geçici hatada duraklamaz",
    "M10": "hesap/şablon hatası toplu işi duraklatmaz",
    "M11": "read'den sonra gelen delivered durumu geri alır",
    "M12": "yinelenen delivered teslim sayacını artırır",
    "M13": "yedekten geri yükleme bitmemiş işleri durdurmaz",
    "M14": "ekstrede devir (dönem öncesi bakiye) atlanır",
    "M15": "ekstre seçilen döneme uymaz (bütün hareketler)",
    "M16": "numara '+' olmadan gönderilir",
    "M17": "bir kez onay işaretsizken de başlar",
    "M18": "salt okunur lisansta başlar",
    "M18b": "lisans gönderim sırasında salt okunura geçince işçi durmaz",
    "M18y": "whatsapp.send yetkisi denetlenmez",
    "M19": "131049'da 24 saat beklemeden yeniden gönderir",
    "M20": "131049'da sınırsız yeniden gönderir",
    "M21": "Meta basamağı 6 saatte bir yeniden okunmaz",
    "M22": "'Başarısızları Yeniden Dene' Sonucu Belirsiz işi de gönderir",
    "M22b": "'Başarısızları Yeniden Dene' kabul edilmiş/teslim edilmiş işi de gönderir",
    "M23": "elle günlük üst sınır (dailyCap) yok sayılır",
    "M24": "imzasız (sahte) kanca Sonucu Belirsiz'i çözer",
    "M27": "24 saatten eski toplu iş (kapalı kalan) açılışta sorulmadan sürer",
    "M28": "program kapalıyken gelen kanca kaybolur (Meta yeniden denemesi yok sayılır)",
    "M29": "Süresi Doldu'da PDF silinmez",
    "M30": "failed 131026 işi Başarısız yapmaz",
    "M31": "'Bu Ay' sayacı teslim yerine kabulü sayar",
    "M32": "alıcı hatası (131009) toplu işi duraklatır",
    "M34": "mesajdaki bakiye dönemden bağımsız (PDF ile ayrışır)",
    "M35": "Meta sınır hatası işi Başarısız yapar",
    "M36": "yeniden denemede silinmiş medya kimliği kullanılır",
    "M37": "'Zaten Kuyrukta' denetimi yok (bekleyen cariye ikinci iş)",
    "M38": "aynı istek kimliği yeni toplu iş açar",
    "M39": "geçici hata sınırsız yeniden denenir (3 yeniden denemeden sonra Başarısız olmaz)",
    "M40": "toplu işi durduran hatayı alan iş Başarısız değil Duraklatıldı",
    "M41": "kanca yolu hiç çalışmamışken de TTL sonunda Süresi Doldu",
    "M42": "Süresi Doldu'dan sonra gelen teslim yok sayılır",
    "M43": "'Bu Ay' ayı teslim yerine kabul zamanından",
    "M44": "hatırlatmada gecikmiş borcu olmayan cari elenmez",
    "M45": "eksi bakiye '(Alacaklı)' eki olmadan",
    "M46": "lisans yeniden yazılabilir olunca işler kendiliğinden sürer",
    "M47": "sınıfsız hata kodu toplu işi duraklatır",
    "M48": "şablon kategorisi gönderim sürerken denetlenmez",
    "M49": "bütün seçilenler elenince boş toplu iş kaydı oluşur",
    "M50": "başarılı işin hata kodu temizlenmez",
    "M51": "131048 işi Başarısız yapar (beklemez)",
    "M52": "Meta sınır hatasında yalnız o toplu iş bekler (WABA'nın hepsi değil)",
    "M53": "sabit hat elenir",
    "M54": "aynı telefonlu ikinci cari elenir",
    "M55": "dönem metni ISO biçiminde",
    "M56": "24 saatten eski toplu işte sınır bekleyen iş de sorulur",
    "M57": "kuyrukta 'İstemiyor' işaretlenen cariye yine gönderilir",
    "M58": "iş verisi gönderimde değil başlatmada okunur",
    "M59": "bağlantı kurulamadığında Sonucu Belirsiz (bekleme değil)",
    "M60": "131049'da PDF silinir ve yeniden yüklenir",
    "M61": "bağlantı yokken iş geçici hata sayılır (30 sn → 2 dk → 15 dk → Başarısız; R1 öncesi)",
    "M62": "bağlantı dönünce 'Bağlantı Bekleniyor' toplu iş kendiliğinden sürmez",
    "M63": "şablon kategorisi saatte bir okunur (R2 öncesi)",
    "M64": "şablon kategorisi 100 iletide okunmaz (yalnız 10 dk)",
    "M65": "daha önce gönderilmiş cari bayraksız da gönderilir (R3 yok)",
    "M66": "'Yine de Gönder' bayrağı yok sayılır (daha önce gönderilen hep elenir)",
    "M67": "daha önce Başarısız olan iş de 'Daha Önce Gönderildi' sayılır",
    # ---- kâhin güncellemesi 2 (31.10.2026, K1–K8) ----
    "M68": "K1: Bu Ay/Geçen Ay eşliği seçim adına göre (aynı takvim ayı farklı seçim adıyla eşleşmez)",
    "M69": "K1: Bu Ay/Geçen Ay eşliği birebir tarih aralığıyla (Bu Ay bitişi bugün; yarım ay Bu Ay ≠ tam ay Geçen Ay)",
    "M70": "K1: Son 3 Ay/Tüm Hareketler R3'te 7 gün penceresi yok (aynı seçim her zaman aynı dönem)",
    "M71": "K1: Son 3 Ay/Tüm Hareketler'de R3 hiç uygulanmaz (eski kâhin)",
    "M72": "K2: 'Zaten Kuyrukta'ya da 7 gün penceresi uygulanır (7 günden eski bekleyen iş elemez)",
    "M73": "K1: Ödeme Hatırlatma'da R3 yok (eski kâhin)",
    "M74": "K1: Ödeme Hatırlatma 'aynı gün' UTC gününe göre",
    "M75": "K1: Son 3 Ay ile Tüm Hareketler aynı seçim sayılır",
    "M76": "K3/K7: teslimsiz kapanan işe (Başarısız/İptal/Durduruldu/Taşınan) geç gelen teslim R3'te sayılmaz",
    "M77": "K7: Meta Bekletti 2. denemesi reddedilen kişi (teslim yok) 'Daha Önce Gönderildi' sayılır",
    "M78": "K7: İPTAL edilen Meta Bekletti (teslim yok) 'Daha Önce Gönderildi' sayılır",
    "M79": "K7: geri yükleme / taşıma ile duran Meta Bekletti (teslim yok) 'Daha Önce Gönderildi' sayılır",
    "M80": "K5: asıl işin 'Yine de Gönder' kararı Başarısızları Yeniden Dene'ye taşınmaz",
    "M81": "K5: asıl işin 'Yine de Gönder' kararı açılıştan SONRAKİ kabulleri de yok sayar",
    "M82": "K5: çözülen Sonucu Belirsiz iletinin zamanı Meta'nın bildirim saatinden (programın saati değil)",
    "M83": "K5: işteki 'Yine de Gönder' asıl işin kararını taşımaz",
    "M84": "K6: Başarısızları Yeniden Dene Sonucu Belirsiz kişiye yeniden gönderir (eleme yok)",
    "M85": "K6: asıl işin 'Yine de Gönder' sınırı Sonucu Belirsiz elemesine de uygulanır (açılıştan önceki belirsiz yok sayılır)",
    "M86": "K6: iş dosyada yokken de eleme önerisi 'işteki Yine de Gönder'",
    "M87": "K4: yeniden deneme dönemi bugüne göre yeniden hesaplanır (seçim korunur)",
    "M88": "K4: yeniden deneme / Yine de Gönder dönemi özel aralık sayılır (seçim düşer)",
    "M89": "K8: Gönderimler listesi eskiden yeniye",
    "M90": "K8: sayfa 30 değil 20",
    "M91": "K8: Daha Fazla Göster ofsetle (araya giren yeni gönderim sayfayı kaydırır)",
    "M92": "K8: tarih süzgeci UTC gününe göre",
    "M93": "K8: Bitiş günü süzgece dahil değil",
    "M94": "K8: Başlangıç > Bitiş reddedilmez (boş liste)",
    "M95": "K5: asıl işte 'Yine de Gönder' kararı yokken de açılıştan önceki kabuller yok sayılır",
    "M96": "K1: Bu Ay ile Geçen Ay her zaman aynı dönem sayılır (takvim ayına bakılmaz)",
    "M97": "K6: asıl işin 'Yine de Gönder' kararı Sonucu Belirsiz elemesini tümüyle geçer",
    # ---- kâhin güncellemesi 3 (31.10.2026, ★ soruların yanıtları D1–D8) ----
    "M98": "D3: Son 3 Ay/Tüm'de yeniden deneme / Yine de Gönder için 7 gün asıl işin açılışından (yeni gönderim anından değil)",
    "M99": "D5: asıl işte Başarısız, sonraki denemesi kabul edilmiş / bekleyen kişi asıl işten yeniden gönderilir (eleme yok)",
    "M100": "D6: 'Yine de Gönder' ile aşılmış eski Sonucu Belirsiz deneme sayılmaz",
    "M101": "D1: yeni toplu işte Sonucu Belirsiz kişi 'Zaten Kuyrukta' sayılır (eski yorum 3)",
    "M102": "D1: R3 uyarısındaki 'Yine de Gönder' (toplu iş) Sonucu Belirsiz elemesini geçer",
    "M103": "D7: geri yüklemeden sonra yalnız makine defterinde kalan kabul R3'te sayılmaz",
    "M104": "D8: taşınan veride şirket dosyasındaki kabul / teslim R3'te sayılmaz (yalnız yeni bilgisayarın defteri — eski ★6)",
    "M105": "D2: hatırlatmada 'Zaten Kuyrukta' yalnız aynı gün (dünden bekleyen bugünküyü elemez)",
    "M106": "D4: özel aralık ile aynı tarihli hazır seçim (Bu Ay / Geçen Ay) hiç eşleşmez",
    "M107": "D1: yeni toplu işte Sonucu Belirsiz kişi elenmez (alınır)",
    "M108": "D1 + yorum 21: yeni toplu işte YALNIZ makine defterinde kalan Sonucu Belirsiz de eler",
    # ---- kâhin güncellemesi 4 (31.10.2026, N2–N5 yanıtları E1–E4 + N6) ----
    "M109": "E2: yeniden denemede Sonucu Belirsiz, Zaten Kuyrukta'dan ÖNCE denetlenir (eski yorum 22 sırası)",
    "M110": "E2: yeniden denemede Daha Önce Gönderildi, Sonucu Belirsiz'den ÖNCE denetlenir",
    "M111": "E2: işteki Yine de Gönder'de Zaten Kuyrukta denetimi yok",
    "M112": "E2: yeni toplu işte Sonucu Belirsiz, Zaten Kuyrukta'dan ÖNCE denetlenir",
    "M113": "E2: Zaten Kuyrukta / Sonucu Belirsiz ile elenen R3 uyarı sayısına girer",
    "M114": "E3: hatırlatmada Sonucu Belirsiz eşliği UTC günü",
    "M115": "E3: hatırlatmada Sonucu Belirsiz eşliği gün bakılmadan (dünkü belirsiz bugünküyü eler)",
    "M116": "E4: 7 günden eski sonraki kabul / teslim de 'Daha Önce Gönderildi' (D5 7 gün kuralına üstün)",
    "M117": "N6: yeniden denemede başka işte bekleyen kişi elenmez (yalnız kendi sonraki denemesi)",
    # ---- kâhin güncellemesi 5 (31.10.2026, P1/P2 yanıtları F1/F2) ----
    "M118": "F1: işteki Yine de Gönder BAŞKA bir denemenin Sonucu Belirsiz'iyle (başka iş ya da aşılmış eski deneme) kişiyi eler",
    "M119": "F2: hatırlatmanın yeniden denemesinde 'aynı gün' asıl işin günü (yeniden denemenin günü değil)",
}

# Kâhin güncellemesi 2'nin kaynak karar metinleri (AYNEN; CLAUDE.md "Açık iş" + docs/2.4.8-IS-LISTESI.md, 31.10.2026). "kaynak_turu": kullanıcı kararı mı,
# yoksa baş mimar / ana oturum okuması mı (ders 40: baş mimar okuması teyit gerektirir — README §7).
KARARLAR = {
    "K1": {"kaynak_turu": "kullanıcı (T2-1 A + dk3 'a'); hatırlatma 'aynı gün' BAŞ MİMAR ★5 (Grup 5) — kullanıcı teyidi yok",
           "metin": ["KARAR (kullanıcı, 31.10.2026 ~03:20 UTC: \"önerilerini yap\"): T2-1 = A (\"Daha Önce Gönderildi\" dönem eşliği: aynı cari + şablon + "
                     "dönem seçimi; Bu Ay / Geçen Ay aynı takvim ayı; Son 3 Ay / Tüm Hareketler aynı seçimle son 7 gün; özel aralık birebir; varsayılan Bunları Çıkar)",
                     "KARAR (kullanıcı, 31.10.2026 ~05:25 UTC: \"a\"): dar kontrol 3 ORTA-1 → A — \"Bu Ay\"/\"Geçen Ay\" aynı takvim ayını gösteriyorsa aynı dönem "
                     "(R3 \"Daha Önce Gönderildi\" + \"Zaten Kuyrukta\")",
                     "BAŞ MİMAR KARARLARI GRUP 5 ★5: R3'te ödeme hatırlatmanın \"dönemi\" gönderim günü (aynı gün ikinci hatırlatma elenir)"]},
    "K2": {"kaynak_turu": "kullanıcı",
           "metin": ["KARAR (kullanıcı, 31.10.2026 ~06:45 UTC: \"a\"): \"Son 3 Ay\"/\"Tüm Hareketler\"de kuyrukta aynı seçimle bekleyen iş varsa kişi yaşına "
                     "bakılmadan \"Zaten Kuyrukta\" elenir (kod böyle, değişmez)."]},
    "K3": {"kaynak_turu": "kullanıcı (P3); 'geç teslim gelirse sayılır' K7 metnindeki 'P3 ile aynı'dan; Başarısız plan R3 + kâhin yorumu 15",
           "metin": ["P3 = SAYILMAZ (Süresi Doldu iş \"Daha Önce Gönderildi\" sayılmaz — kişi iletiyi almadı)"]},
    "K4": {"kaynak_turu": "ana oturum (dk4 ORTA-1: 'Karar gerekmez (aynı toplu iş = aynı dönem; kâhin de böyle)')",
           "metin": ["yeniden deneme / Yine de Gönder asıl işin kayıtlı dönemini (from, to, preset) taşır"]},
    "K5": {"kaynak_turu": "kullanıcı; 'sonra = programın saati' dk6 ORTA okuması (baş mimar)",
           "metin": ["KARAR (kullanıcı, 31.10.2026 ~07:05 UTC: \"a şıkkı\"): dar kontrol 5 ORTA-1 → A — asıl toplu işin \"Yine de Gönder\" kararı Başarısızları "
                     "Yeniden Dene'ye ve işteki Yine de Gönder'e taşınır; yalnız asıl işin açılışından ÖNCEKİ kabuller yok sayılır, sonradan başka işle giden yine "
                     "elenir; elenme nedeni iletide görünür."]},
    "K6": {"kaynak_turu": "kullanıcı (08:00, 09:35, 11:45)",
           "metin": ["KARAR (kullanıcı, 31.10.2026 ~08:00 UTC: \"A\"): \"Başarısızları Yeniden Dene\"de önceki yeniden denemesi \"Sonucu Belirsiz\" kalan kişi "
                     "\"Sonucu Belirsiz\" nedeniyle elenir; göndermek için işteki \"Yine de Gönder\" (iki kez gidebilir onayı) kullanılır.",
                     "KARAR (kullanıcı, 31.10.2026 ~09:35 UTC: \"A\"): asıl işin \"Yine de Gönder\" sınırı \"Sonucu Belirsiz\" elemesine uygulanmaz — asıl iş açılmadan "
                     "önce belirsiz kalmış ileti de Başarısızları Yeniden Dene'de kişiyi eler (göndermek için işteki Yine de Gönder, onaylı); kod böyle.",
                     "KARAR (kullanıcı, 31.10.2026 ~11:45 UTC: \"A\"): Sonucu Belirsiz iş dosyada dururken eleme iletisi YALNIZ onaylı yolu (\"işteki Yine de Gönder\") "
                     "önerir; iş yoksa (geri yükleme sonrası) \"yeni gönderim başlatın\"."]},
    "K7": {"kaynak_turu": "kullanıcı (10:10, 11:00); 2. deneme reddi dk7 BAŞ MİMAR KARARI (P3'ten)",
           "metin": ["KARAR (kullanıcı, 31.10.2026 ~10:10 UTC: \"a\"): İPTAL edilen \"Meta Bekletti\" (teslim edilmemiş) ileti \"Daha Önce Gönderildi\" sayılmaz "
                     "(P3 ile aynı); geç teslim bildirimi gelirse sayılır.",
                     "KARAR (kullanıcı, 31.10.2026 ~11:00 UTC: \"A\"): yedekten geri yükleme ya da başka bilgisayara taşıma ile durmuş \"Meta Bekletti\" (teslim yok) da "
                     "\"Daha Önce Gönderildi\" sayılmaz (iptal kuralı aynen); geç teslim gelirse sayılır."]},
    "D1": {"kaynak_turu": "kullanıcı (★ SORU madde 1 'b')",
           "metin": ["\"Sonucu Belirsiz\" kalmış kişi YENİ toplu işte de elenir, neden \"Sonucu Belirsiz\" (Başarısızları Yeniden Dene'deki kuralla aynı eşlik: aynı tür "
                     "+ dönem eşliği); göndermek için işteki \"Yine de Gönder\" (onaylı)."]},
    "D2": {"kaynak_turu": "kullanıcı (★ SORU madde 2 'a')",
           "metin": ["Ödeme Hatırlatma (a) R3: aynı yerel gün ikinci hatırlatma \"Daha Önce Gönderildi\" (varsayılan Bunları Çıkar), ertesi gün serbest; (b) süren "
                     "(bekleyen/gönderilmekte) hatırlatma işi varken yenisi GÜN BAKILMADAN \"Zaten Kuyrukta\" (dünden bekleyen bugünküyü eler)."]},
    "D3": {"kaynak_turu": "kullanıcı (★ SORU madde 5 'a')",
           "metin": ["Son 3 Ay / Tüm Hareketler'de Başarısızları Yeniden Dene ve Yine de Gönder için 7 gün YENİ GÖNDERİM ANINDAN geriye."]},
    "D4": {"kaynak_turu": "kullanıcı (★ SORU madde 6 'b')",
           "metin": ["özel aralığın tarihleri o gün hazır seçimin (\"Geçen Ay\" = önceki ayın 1'i–son günü; \"Bu Ay\" = ayın 1'i–bugün) tarihleriyle BİREBİR aynıysa "
                     "aynı dönem (R3 + Zaten Kuyrukta)."]},
    "D5": {"kaynak_turu": "kullanıcı (★ SORU madde 9 'a')",
           "metin": ["asıl işte Başarısız, sonraki yeniden denemesi kabul/teslim edilmiş kişi asıl işte yeniden denenince \"Daha Önce Gönderildi\", bekliyorsa "
                     "\"Zaten Kuyrukta\" ile elenir."]},
    "D6": {"kaynak_turu": "kullanıcı (★ SORU madde 10 'a')",
           "metin": ["\"Yine de Gönder\" ile aşılmış eski Sonucu Belirsiz deneme de sayılır, kişiyi \"Sonucu Belirsiz\" ile eler (her seferinde onaylı Yine de Gönder). "
                     "Eşlik: aynı tür + dönem eşliği; Son 3 Ay / Tüm'de son 7 gün gönderim anından."]},
    "D7": {"kaynak_turu": "kullanıcı (★ SORU madde 13 'a')",
           "metin": ["yedekten geri yüklemeden sonra yalnız makine defterinde kalan KABUL edilmiş ileti R3'te sayılır."]},
    "D8": {"kaynak_turu": "kullanıcı (★ SORU madde 14 'a'); BAŞ MİMAR ★6 düşer",
           "metin": ["başka bilgisayara TAŞINAN veride şirket dosyasında Meta Kabul Etti / Teslim Edildi / Okundu duran ileti, yeni bilgisayarın defterinde yoksa R3'te "
                     "sayılır (\"Daha Önce Gönderildi\", varsayılan Bunları Çıkar)."]},
    "E1": {"kaynak_turu": "kullanıcı (N2 'a'; yorum 21 teyit)",
           "metin": ["geri yüklemeden sonra YALNIZ makine defterinde kalan Sonucu Belirsiz deneme (iş şirket dosyasında yok) yeni toplu işte kişiyi ELEMEZ; Başarısızları "
                     "Yeniden Dene'de defterdeki belirsiz yine eler (ileti \"yeni gönderim başlatın\")."]},
    "E2": {"kaynak_turu": "kullanıcı (N3 'a')",
           "metin": ["birden çok eleme nedeni varsa TEK neden yazılır; sıra HER YERDE (yeni toplu iş + Başarısızları Yeniden Dene + işteki Yine de Gönder'in açtığı iş) "
                     "\"Zaten Kuyrukta\" → \"Sonucu Belirsiz\" → \"Daha Önce Gönderildi\"; Zaten Kuyrukta / Sonucu Belirsiz ile elenen R3 uyarısına GİRMEZ, R3'te "
                     "\"Yine de Gönder\" seçilse de gitmez."]},
    "E3": {"kaynak_turu": "kullanıcı (N4 'a')",
           "metin": ["Ödeme Hatırlatma'da Sonucu Belirsiz elemesinin eşliği AYNI YEREL GÜN — dünkü belirsiz hatırlatma bugünkü yeni hatırlatmayı elemez; aynı gün başlatılan eler."]},
    "E4": {"kaynak_turu": "kullanıcı (N5 'a')",
           "metin": ["Son 3 Ay / Tüm'de asıl işin yeniden denemesinde sonraki denemenin kabul/teslimi yeni gönderim anından geriye 7 gün içindeyse \"Daha Önce Gönderildi\", "
                     "7 günden eskiyse yeniden gönderilir (7 gün kuralı D5'e üstün)."]},
    "N6": {"kaynak_turu": "kullanıcı (ana oturum iletisi: 'E2 sırasıyla Zaten Kuyrukta')",
           "metin": ["N6 (\"başka işte bekleyen kişi yeniden denemede\") E2 sırasıyla \"Zaten Kuyrukta\"."]},
    "F1": {"kaynak_turu": "kullanıcı (P1 'a')",
           "metin": ["işteki \"Yine de Gönder\" (onaylı tek yol) BAŞKA bir denemenin Sonucu Belirsiz'iyle (defterdeki ya da aşılmış eski) kişiyi ELEMEZ; kişide bekleyen "
                     "ileti varsa \"Zaten Kuyrukta\" yine eler."]},
    "F2": {"kaynak_turu": "kullanıcı (P2 'a')",
           "metin": ["Ödeme Hatırlatma'nın yeniden denemesinde \"aynı gün\" YENİDEN DENEMENİN yerel günüdür; dünkü belirsiz bugünkü yeniden denemeyi elemez, aynı gün eler."]},
    "K8": {"kaynak_turu": "kullanıcı (08:20 'şimdi yap'); en yeni önce / yerel gün / iki uç dahil / ters aralık ret ana oturum görev metni",
           "metin": ["KARAR (kullanıcı, 31.10.2026 ~08:20 UTC: \"şimdi yap\"): WhatsApp Gönderimleri ekranına 2.4.8'de \"Daha Fazla Göster\" (30'ar, imleçli) + "
                     "Başlangıç/Bitiş tarih süzgeci (eski gönderimlere erişim)."]},
}

# ---- yardımcılar -----------------------------------------------------------------------------------------------------------

def zaman_ayristir(metin, t0, cokme=None):
    """'+90s' / '+15m' / '+2h' / '+3d' / '+1d2h' (t0'a göre), 'cokme+10m' (çökmeye göre; çökme olmadıysa None), ISO."""
    if isinstance(metin, (int, float)):
        return t0 + int(metin)
    m = re.fullmatch(r"(cokme)?\+((?:\d+(?:\.\d+)?(?:ms|[dhms]))+)", metin)
    if m:
        taban = t0
        if m.group(1):
            if cokme is None:
                return None
            taban = cokme
        toplam = 0
        for sayi, birim in re.findall(r"(\d+(?:\.\d+)?)(ms|[dhms])", m.group(2)):
            toplam += float(sayi) * {"d": GUN, "h": SA, "m": DK, "s": SN, "ms": 1}[birim]
        return taban + int(toplam)
    return int(datetime.fromisoformat(metin).timestamp() * 1000)


def iso(ms, tz):
    return datetime.fromtimestamp(ms / 1000, tz).isoformat(timespec="seconds")


def tarih(ms, tz):
    return datetime.fromtimestamp(ms / 1000, tz).date().isoformat()


def ay(ms):
    return datetime.fromtimestamp(ms / 1000, TR).strftime("%Y-%m")


def tr_tarih(iso_tarih):
    y, a, g = iso_tarih.split("-")
    return f"{g}.{a}.{y}"


def temizle(s):
    """§2.2: değişken değerleri tek satıra indirilir (satır sonu, sekme, çok boşluk). Kâhin: her boşluk dizisi tek boşluk, uçlar kırpılır."""
    return re.sub(r"\s+", " ", str(s)).strip()


KISALTMA_ESIGI = 60   # D0: Meta değişken uzunluk sınırı yerel belgede yok; eşiği aşan değer "kısaltılabilir"


def deger(s):
    t = temizle(s)
    return t if len(t) <= KISALTMA_ESIGI else {"kisaltilabilir": t}


def kurus(d):
    """§7a 22: 2 ondalık; yuvarlama yarım yukarı (kâhin yorumu) — metin ve PDF AYNI yuvarlamayla."""
    return Decimal(d).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def para(d, mut=()):
    """§8 '1.250,00 TL'; §7a 22 eksi bakiye '1.234,56 TL (Alacaklı)'."""
    d = kurus(d)
    tam, kesir = f"{abs(d):.2f}".split(".")
    metin = "{:,}".format(int(tam)).replace(",", ".") + f",{kesir} TL"
    if d < 0:
        return ("-" + metin) if "M45" in mut else metin + " (Alacaklı)"
    return metin


def donem_metni(bas, son, mut=()):
    """§7a 21: '01.10.2026 – 31.10.2026'."""
    if bas is None:
        return {"plan_susuyor": "Tüm Hareketler dönem metni"}
    if "M55" in mut:
        return f"{bas}/{son}"
    return f"{tr_tarih(bas)} – {tr_tarih(son)}"


def ay_sonu(d):
    return (date(d.year + (d.month == 12), d.month % 12 + 1, 1) - timedelta(days=1))


def ay_ekle(d, n):
    """d'den n ay ötesi; gün ay uzunluğuna kırpılır (31.12 − 3 ay → 30.09)."""
    y, m = divmod(d.year * 12 + (d.month - 1) + n, 12)
    ilk = date(y, m + 1, 1)
    return ilk.replace(day=min(d.day, ay_sonu(ilk).day))


def donem_coz(donem, t, tz, sablon="ekstre", mut=()):
    """K1: dönem seçimi → {"secim", "anahtar" (eşlik anahtarı), "okumalar": [(bas, son) …]}.
    Eşlik: Bu Ay / Geçen Ay → ("ay", "YYYY-AA") gösterdikleri takvim ayı (seçim adı fark etmez); Son 3 Ay / Tüm Hareketler → ("secim", ad) + R3'te 7 gün;
    özel aralık → ("aralik", bas, son) birebir; Ödeme Hatırlatma → ("gun", yerel gün) (★5). "okumalar": karar metninin TARİH UÇLARINI belirlemediği
    seçimlerde olası okumaların hepsi (kâhin yorumu 17); okumalar arasında ayrışan yaprak {"plan_susuyor"} olur."""
    bugun = datetime.fromtimestamp(t / 1000, tz).date()
    if sablon != "ekstre":
        return {"secim": "hatirlatma", "anahtar": ("gun", bugun.isoformat()), "okumalar": [(None, None)], "tarih": None, "kanon": None}
    if donem is None or donem == "tum" or (isinstance(donem, dict) and donem.get("secim") == "tum"):
        return {"secim": "tum", "anahtar": ("secim", "tum"), "okumalar": [(None, None)], "tarih": None, "kanon": None}
    if "secim" not in donem:
        # "kanon": D4'ün ÖBÜR okuması (yalnız sağlamlık denetimi I5, OKUMA_Y): özel aralık KENDİ GÜNÜNDEKİ hazır seçime birebir eşitse o seçimin ayı
        ilk = bugun.replace(day=1); gson = ilk - timedelta(days=1); kanon = None
        if (donem["bas"], donem["son"]) == (ilk.isoformat(), bugun.isoformat()):
            kanon = ("ay", ilk.strftime("%Y-%m"))
        elif (donem["bas"], donem["son"]) == (gson.replace(day=1).isoformat(), gson.isoformat()):
            kanon = ("ay", gson.strftime("%Y-%m"))
        return {"secim": "ozel", "anahtar": ("aralik", donem["bas"], donem["son"]), "okumalar": [(donem["bas"], donem["son"])],
                "tarih": (donem["bas"], donem["son"]), "kanon": kanon}
    s = donem["secim"]
    if s not in SECIMLER:
        raise ValueError(f"bilinmeyen dönem seçimi: {s}")
    if s == "bu_ay":
        ilk = bugun.replace(day=1)
        okumalar = [(ilk, bugun), (ilk, ay_sonu(bugun))]
        tarih_ = (ilk.isoformat(), bugun.isoformat())                    # D4: "Bu Ay" = ayın 1'i – bugün (eşlik için)
        anahtar = ("ay", ilk.strftime("%Y-%m"))
        if "M69" in mut:
            anahtar = ("aralik", ilk.isoformat(), bugun.isoformat())
    elif s == "gecen_ay":
        son = bugun.replace(day=1) - timedelta(days=1)
        okumalar = [(son.replace(day=1), son)]
        tarih_ = (son.replace(day=1).isoformat(), son.isoformat())       # D4: "Geçen Ay" = önceki ayın 1'i – son günü
        anahtar = ("ay", son.strftime("%Y-%m"))
        if "M69" in mut:
            anahtar = ("aralik", son.replace(day=1).isoformat(), son.isoformat())
    else:   # son_3_ay
        uc = ay_ekle(bugun, -3)
        okumalar = [(uc, bugun), (uc + timedelta(days=1), bugun), (ay_ekle(bugun, -2).replace(day=1), bugun),
                    (uc.replace(day=1), bugun.replace(day=1) - timedelta(days=1))]
        anahtar = ("secim", "son_3_ay")
        tarih_ = None
    if "M68" in mut and anahtar[0] == "ay":
        anahtar = ("ay", anahtar[1], s)
    if "M96" in mut and anahtar[0] == "ay":
        anahtar = ("ay", "*")
    if "M75" in mut and anahtar == ("secim", "son_3_ay"):
        anahtar = ("secim", "tum")
    tekil = []
    for b, e in okumalar:
        if (b.isoformat(), e.isoformat()) not in tekil:
            tekil.append((b.isoformat(), e.isoformat()))
    return {"secim": s, "anahtar": anahtar, "okumalar": tekil, "tarih": tarih_, "kanon": None}


def donem_eslesir(a, b, mut=()):
    """K1 + D4: a, b = (eşlik anahtarı, tarih, kanon). Aynı anahtar (aynı takvim ayı / aynı seçim / birebir özel aralık) ya da özel aralık ↔ hazır seçim
    (Bu Ay / Geçen Ay) tarihleri BİREBİR aynı; hazır seçimin tarihi kendi gününde çözülür (D4 "o gün" — kâhin yorumu 23). Öbür okuma (OKUMA_Y, yalnız I5):
    özel aralık kendi günündeki hazır seçime eşitse o ayın dönemi. Senaryolar iki okumada aynı sonucu verir (I5)."""
    if a[0] == b[0]:
        return True
    if {a[0][0], b[0][0]} == {"ay", "aralik"} and "M106" not in mut:
        if "OKUMA_Y" in mut:
            ay_, ozel = (a, b) if a[0][0] == "ay" else (b, a)
            return ozel[2] is not None and ozel[2] == ay_[0]
        return a[1] is not None and a[1] == b[1]
    return False


def susuyor_birlestir(degerler, neden):
    """Okumalar arasında ayrışan yaprak → {"plan_susuyor": neden}; aynı olan değer olduğu gibi (liste/sözlük yapısı korunur)."""
    ilk = degerler[0]
    if all(_metin(d) == _metin(ilk) for d in degerler):
        return ilk
    if all(isinstance(d, dict) for d in degerler) and all(set(d) == set(ilk) for d in degerler) and "plan_susuyor" not in ilk:
        return {k: susuyor_birlestir([d[k] for d in degerler], neden) for k in ilk}
    if all(isinstance(d, list) for d in degerler) and all(len(d) == len(ilk) for d in degerler):
        return [susuyor_birlestir([d[i] for d in degerler], neden) for i in range(len(ilk))]
    return {"plan_susuyor": neden}


def numara(ham):
    """Telefon → ('+…', tür) ya da (None, neden). §2.2 '+' + ülke kodu; §7a 6 geçersiz = E.164'e çevrilemeyen (uzunluk/ülke kodu);
    §7a 7 hücrede birden çok numara: '/', ',', ';', satır sonu → ilki. Kâhin yorumu: '0'+10, '90'+10, 10 hane (TR), '00' ve '+' önekleri."""
    if ham is None:
        return None, "telefonsuz"
    ilk = re.split(r"\s*(?:[/,;]|\r?\n)\s*", str(ham).strip())[0]
    r = re.sub(r"\D", "", ilk)
    if not r:
        return None, "telefonsuz"
    if ilk.strip().startswith("+"):
        e = r
    elif r.startswith("00"):
        e = r[2:]
    elif r.startswith("0") and len(r) == 11:
        e = "90" + r[1:]
    elif r.startswith("90") and len(r) == 12:
        e = r
    elif len(r) == 10 and r[0] != "0":
        e = "90" + r
    else:
        return None, "gecersiz"
    if e.startswith("90"):
        if len(e) != 12:
            return None, "gecersiz"
        return "+" + e, ("mobil" if e[2] == "5" else "sabit")
    if not 8 <= len(e) <= 15:
        return None, "gecersiz"
    return "+" + e, "yurtdisi"


# ---- iş / toplu iş ---------------------------------------------------------------------------------------------------------

class Is:
    def __init__(self, anahtar, toplu, cari, sirket="A"):
        self.anahtar = anahtar; self.toplu = toplu; self.cari = cari; self.sirket = sirket
        self.durum = BEKLIYOR; self.telefon = None; self.icerik = None; self.next_at = 0
        self.post = 0; self.medyalar = []; self.silinen_n = 0; self.wamidler = []   # silme yalnız kesinleşmede → önek
        self.kod = None; self.deneme_49 = 0; self.teslim_t = None; self.kabul_t = None
        self.belirsiz_t = None; self.elendi_neden = None; self.meta_sayi = 0; self.gecici_deneme = 0
        # kâhin güncellemesi 2
        self.kayitlar = []          # bu işin gönderim denemeleri (Benzetim.kayitlar kimlikleri) — "Gönderiliyor" anında açılır (talep)
        self.son_kayit = None       # durum değişikliklerinin yazıldığı son deneme (yeni deneme açılınca kopar)
        self.asil_durum = None      # ilk kez yeniden denemeye / Yine de Gönder'e alındığında asıl işteki durumu (programda asıl iş bu durumda kalır)
        self.yeniden = False        # yeniden deneme / Yine de Gönder ile gönderime alındı mı (K4 mutasyonları)
        self.gec_teslim = None      # K3/K7: teslimsiz kapandıktan sonra gelen teslimin durumu (Teslim Edildi / Okundu) — ekran durumu KÂHİN SUSUYOR


class Toplu:
    def __init__(self, etiket, sablon, donem, sirket, t, kullanici, coz=None, send_again=False, sira=0):
        self.etiket = etiket; self.sablon = sablon; self.donem = donem; self.sirket = sirket; self.t = t; self.kullanici = kullanici
        self.isler = []; self.durum = "aktif"; self.neden = None; self.gecici = 0
        self.bas = 0; self.sablon_okuma = t; self.okuma_sayac = 0
        self.coz = coz or {"secim": None, "anahtar": None, "okumalar": [(None, None)]}   # K1: başlatmada çözülen dönem (K4: yeniden denemede TAŞINIR)
        self.send_again = send_again     # K5: başlatmada R3 uyarısına "Yine de Gönder" denildi mi
        self.sira = sira                 # K8: aynı anda açılan toplu işlerin sırası


class Benzetim:
    def __init__(self, sen, secim=None, zaman="hizli", mut=frozenset()):
        self.sen = sen; self.zaman = zaman; self.mut = set(mut)
        self.T0 = zaman_ayristir(sen["baslangic"], 0)
        self.tz = datetime.fromisoformat(sen["baslangic"]).tzinfo or timezone.utc
        self.adim = ADIM[zaman]
        self.ayar = {"bagli": True, "onay": True, "gunluk_ust_sinir": None, "lisans_yazilabilir": True, **sen.get("ayar", {})}
        self.kullanicilar = sen.get("kullanicilar", {"yonetici": {"whatsapp.send": True}})
        self.cariler = {c["id"]: {"sirket": "A", "istemiyor": False, "silindi": False, "pasif": False, "hareketler": [], "vadeler": [], **copy.deepcopy(c)} for c in sen["cariler"]}
        self.firmalar = sen.get("firmalar", {"A": "Deneme Ticaret Ltd. Şti."})
        self.wabalar = sen.get("wabalar", {"A": "W1"})
        m = sen.get("meta", {})
        self.meta = {"basamak": m.get("basamak", 250), "kapali": False,
                     "sablonlar": {"destekofis_ekstre": {"durum": "APPROVED", "kategori": "UTILITY"},
                                   "destekofis_odeme_hatirlatma": {"durum": "APPROVED", "kategori": "UTILITY"}, **copy.deepcopy(m.get("sablonlar", {}))}}
        self.davranis = sen.get("meta_davranis", {})
        self.toplular = {}; self.toplu_sira = []; self.isler = {}
        self.pencere = {}            # waba → {alıcı: son kabul t} — program sayacı (makine düzeyi, WABA'ya göre)
        self.kabul_kaydi = []        # (t, waba, sirket, alici, anahtar)
        self.teslim_kaydi = []       # (is, olay_t)
        self.program_basamak = {}; self.son_okuma = {}
        self.blok = {}
        self.acik = True; self.tunel = True; self.lisans = self.ayar["lisans_yazilabilir"]
        self.isci_bos = self.T0
        self.post_hedef = {}; self.medya_toplam = 0
        self.meta_mesajlari = {}; self.wamid_is = {}
        self.kancalar = []; self.kanca_sira = 0; self.meta_kuyruk = []
        self.ttl_aktif = {}
        self.son_kanca = {}          # waba → son İMZALI kancanın işlendiği an (§7a 16 "kanca yolu çalışıyor")
        self.istekler = {}           # istek kimliği → toplu etiketi (§7a 9)
        self.onceki_uyari = {}       # §7a R3: etiket → {sayi, son} ("N kişiye bu dönem daha önce gönderildi (son tarih)")
        self.ayni_istek = {}; self.olusmadi = []
        # kâhin güncellemesi 2: gönderim denemeleri (talep) — "makine defteri" (geri yüklemede kalır, taşımada yeni makinede boş) + işlerin kendi kayıtları
        self.kayitlar = {}; self.kayit_sira = 0; self.defter = set(); self.wamid_kayit = {}
        self.yedekler = {}; self.yeniden_sonuc = {}; self.listeler = {}; self.liste_imlec = {}; self.toplu_sayac = 0
        self.bitis = zaman_ayristir(sen["bitis"], self.T0) if sen.get("bitis") else self.T0 + 10 * GUN
        self.cokme = None
        self.kontroller = {}; self.baslamadi = {}; self.elenen = {}
        self.ozet = bool(sen.get("ozet_cikti"))
        self.degismez = {"silinmis_medyayla_gonderim": 0, "kesin_oncesi_medya_silme": 0,
                         "artisiz_numaraya_gonderim": 0, "lisanssiz_gonderim": 0, "duraklatilmis_toplu_gonderim": 0}
        self.olaylar = []
        for i, o in enumerate(sen.get("olaylar", [])):
            if o["tur"] == "cokme":
                self.cokme = dict(o)
                continue
            self.olaylar.append([zaman_ayristir(o["t"], self.T0), i, o])

    # ---- zaman çizelgesi --------------------------------------------------------------------------------------------------
    def calistir(self):
        t = self.T0
        for _ in range(1_000_000):
            adaylar = [o[0] for o in self.olaylar if o[0] is not None]
            if self.kancalar:
                adaylar.append(self.kancalar[0][0])
            if self.acik:
                for z in (self.ttl_zamani(t), self.okuma_zamani(), self.sablon_okuma_zamani()):
                    if z is not None:
                        adaylar.append(max(z, t))
                if self.lisans:
                    hazir = self.isci_zamani()
                    if hazir is not None:
                        adaylar.append(max(hazir, self.isci_bos, t))
            if not adaylar or min(adaylar) > self.bitis:
                return self.sonuc()
            t = max(t, min(adaylar))
            self.adim_isle(t)
        raise RuntimeError("benzetim bitmedi (sonsuz döngü?)")

    def adim_isle(self, t):
        simdi = sorted((o for o in self.olaylar if o[0] is not None and o[0] <= t), key=lambda o: (o[0], o[1]))
        for o in simdi:
            if o[2]["tur"] != "kontrol":
                self.olaylar.remove(o)
                self.olay(o[2], t)
        while self.kancalar and self.kancalar[0][0] <= t:
            _, _, wamid, durum, kod, ek = heapq.heappop(self.kancalar)
            self.kanca_varis(t, wamid, durum, kod, ek)
        if self.acik:
            self.ttl_isle(t)
            self.okuma_isle(t)
            self.sablon_okuma_isle(t)
            if self.lisans and self.isci_bos <= t:
                self.isci(t)
        for o in simdi:
            if o[2]["tur"] == "kontrol":
                self.olaylar.remove(o)
                self.kontrol(o[2], t)

    def sifirla_bas(self):
        for tp in self.toplular.values():
            tp.bas = 0

    # ---- senaryo olayları ---------------------------------------------------------------------------------------------------
    def olay(self, o, t):
        tur = o["tur"]
        if tur == "baslat":
            self.baslat(o, t)
        elif tur == "cari":
            c = self.cariler[o["id"]]
            for k in ("telefon", "istemiyor", "silindi", "pasif", "ad"):
                if k in o:
                    c[k] = o[k]
            if "hareket_ekle" in o:
                c["hareketler"].append(o["hareket_ekle"])
            if "vadeler" in o:
                c["vadeler"] = o["vadeler"]
        elif tur == "kapat":
            self.acik = False
        elif tur == "ac":
            self.ac(t)
        elif tur == "tunel":
            self.tunel = o["acik"]
        elif tur == "kanca_kuyrugu":
            self.kuyruk_isle(t)
        elif tur == "lisans":
            if "M18b" in self.mut:
                return
            self.lisans = o["yazilabilir"]
            for tp in self.toplular.values():
                for j in tp.isler:
                    if not self.lisans and j.durum in (BEKLIYOR, SINIR, HAZIRLANIYOR, BEKLEME_131049):
                        self.durum(j, LISANS, t)
                    elif self.lisans and j.durum == LISANS and "M46" in self.mut:
                        self.durum(j, BEKLIYOR, t); j.next_at = t; tp.bas = 0
            # §7a 25: yeniden yazılabilir olunca LISANS işleri kendiliğinden SÜRMEZ ("Devam Et")
        elif tur in ("duraklat", "devam", "iptal"):
            tp = self.toplular[o["toplu"]]
            if tur == "duraklat":
                tp.durum = "duraklatildi"; tp.neden = "kullanici"
                for j in tp.isler:
                    if j.durum in (BEKLIYOR, SINIR, BEKLEME_131049):
                        self.durum(j, DURAKLATILDI, t)
            elif tur == "devam":
                tp.durum = "aktif"; tp.neden = None; tp.gecici = 0; tp.bas = 0
                for j in tp.isler:
                    if j.durum in (DURAKLATILDI, SORULUYOR, LISANS):
                        self.durum(j, BEKLIYOR, t); j.next_at = t
            else:
                tp.durum = "iptal"
                for j in tp.isler:
                    if j.durum in DURDURULABILIR:
                        self.durum(j, IPTAL, t)
        elif tur == "basarisizlari_yeniden_dene":
            self.yeniden_dene(o, t)
        elif tur == "yine_de_gonder":
            self.yine_de_gonder(o, t)
        elif tur == "yedek_al":                                         # K6/K7: şirket dosyasının o anki kopyası (makine defteri yedeğe girmez)
            self.yedekler[o["ad"]] = copy.deepcopy((self.toplular, self.toplu_sira, self.isler))
        elif tur in ("geri_yukle", "sifirla", "tasindi"):
            if "M13" in self.mut:
                return
            if tur == "geri_yukle" and o.get("yedek"):
                self.dosyayi_geri_yukle(o["yedek"])
            if tur == "tasindi":
                self.defter = set()                                     # başka bilgisayar: makine defteri o bilgisayarda yok (§6 W2)
            for tp in self.toplular.values():
                for j in tp.isler:
                    if j.durum in DURDURULABILIR:
                        self.durum(j, TASINAN if tur == "tasindi" else DURDU_GERI_YUKLEME, t)   # §7a 26
        elif tur == "liste":
            self.liste(o, t)
        elif tur == "meta_basamak":
            self.meta["basamak"] = o["basamak"]
        elif tur == "meta_sablon":
            st = self.meta["sablonlar"].setdefault(o["ad"], {"durum": None, "kategori": None})
            for k in ("durum", "kategori"):
                if k in o:
                    st[k] = o[k]
        elif tur == "meta_kapali":
            self.meta["kapali"] = o["kapali"]
            if not o["kapali"] and "M62" not in self.mut:         # §7a R1: bağlantı dönünce kendiliğinden sürer
                for tp in self.toplular.values():
                    if tp.durum == "baglanti_bekleniyor":
                        tp.durum = "aktif"; tp.neden = None; tp.bas = 0
        elif tur == "sahte_kanca":
            wamid = o.get("wamid", "wamid.SAHTE")
            if "is" in o:                                    # sahte olay gerçek bir işin wamid'ini taşır (saldırgan wamid'i biliyor)
                wamid = self.isler[o["is"]].wamidler[-1]
            self.kanca_planla(t, wamid, o["durum"], o.get("kod"),
                              {"opaque": o.get("opaque"), "sahte": True, "imzali": bool(o.get("imzali")), "olay_t": t})
        else:
            raise ValueError(f"bilinmeyen olay: {tur}")

    def ac(self, t):
        self.acik = True
        self.isci_bos = max(self.isci_bos, t)
        self.sifirla_bas()
        for tp in self.toplular.values():
            for j in tp.isler:
                if j.durum == GONDERILIYOR:        # §6 W2: yanıtsız istek (program kapandı) → Sonucu Belirsiz; §7a 10 toplu iş sürer
                    self.durum(j, BELIRSIZ, t); j.belirsiz_t = t
                elif j.durum == HAZIRLANIYOR:
                    self.durum(j, BEKLIYOR, t)
            if tp.durum == "aktif" and t - tp.t > GUN and "M27" not in self.mut:
                # §7a 24: SINIR (ve Meta Bekletti) nedeniyle bekleyen kendiliğinden sürer; program kapalı kaldığı için duran açılışta sorulur
                for j in tp.isler:
                    if j.durum == BEKLIYOR or (j.durum == SINIR and "M56" in self.mut):
                        self.durum(j, SORULUYOR, t)

    # ---- başlatma -----------------------------------------------------------------------------------------------------------
    def kuyrukta(self, cid, sablon, ctx, sirket, t, yalniz=None):
        """§7a 9 + K1/K2 + D2(b): aynı cari + şablon + dönem EŞLİĞİ için bekleyen / gönderilmekte iş (süre penceresi yok — K2: Son 3 Ay / Tüm Hareketler'de
        bekleyen işin yaşına bakılmaz). Hatırlatmada GÜN BAKILMADAN (D2 b: dünden bekleyen bugünküyü eler). ctx = (eşlik anahtarı, tarih) — donem_coz()."""
        durumlar = KUYRUKTA | ({BELIRSIZ} if "M101" in self.mut else set())
        for j in self.isler.values():
            if yalniz is not None and j is not yalniz:
                continue
            if j.sirket != sirket or j.cari != cid or j.durum not in durumlar or self.toplular[j.toplu].sablon != sablon:
                continue
            if sablon == "hatirlatma":
                if "M105" in self.mut and j.anahtar_donem != ctx[0]:
                    continue
                return True
            if not donem_eslesir((j.anahtar_donem, j.tarih_donem, j.kanon_donem), ctx, self.mut):
                continue
            if "M72" in self.mut and ctx[0][0] == "secim" and t - self.toplular[j.toplu].t >= R3_PENCERE:
                continue
            return True
        return False

    def dosyadaki_kayitlar(self):
        ids = set()
        for j in self.isler.values():
            ids.update(j.kayitlar)
        return ids

    def gorunen_kayitlar(self):
        """Gönderim denemeleri: makine defteri ∪ şirket dosyasındaki işlerin kendi denemeleri (kâhin yorumu 18; D7 + D8 kullanıcı kararı) → [(kayıt, dosyada mı)]."""
        dosyada = self.dosyadaki_kayitlar()
        return [(self.kayitlar[i], i in dosyada, i) for i in sorted(set(self.defter) | dosyada)]

    def sayilir(self, rec):
        """§7a R3 + K3 + K7: "Daha Önce Gönderildi" = Meta Kabul Etti ve sonrası; Süresi Doldu, Başarısız (Meta Bekletti 2. deneme reddi dahil), İptal,
        geri yükleme / taşıma ile duran (teslim yok) SAYILMAZ; teslim (delivered/read) bildirimi geldiyse SAYILIR."""
        if rec["teslim"] and ("M76" not in self.mut or rec["son_durum"] in GONDERILMIS):
            return True
        if not rec["kabul"]:
            return False
        sd = rec["son_durum"]
        return (sd in GONDERILMIS or ("M67" in self.mut and sd == BASARISIZ) or ("M77" in self.mut and sd == BEKLEME_131049)
                or ("M78" in self.mut and sd == IPTAL) or ("M79" in self.mut and sd in (DURDU_GERI_YUKLEME, TASINAN)))

    def eslesir(self, rec, cid, sablon, ctx, sirket, t, pencere_t=None, belirsiz=False):
        """K1 + D4 dönem eşliği: Bu Ay / Geçen Ay aynı takvim ayı; özel aralık birebir ya da aynı tarihli hazır seçim; Son 3 Ay / Tüm Hareketler aynı seçim +
        son 7 gün (D3: yeni gönderim anından geriye — pencere_t yalnız M98'de); hatırlatma aynı (yerel) gün (D2 a)."""
        if rec["sirket"] != sirket or rec["cari"] != cid or rec["sablon"] != sablon:
            return False
        if sablon == "hatirlatma":
            if belirsiz:                                     # E3: Sonucu Belirsiz eşliği aynı YEREL gün
                if "M115" in self.mut:
                    return True
                tz = timezone.utc if "M114" in self.mut else self.tz
                return tarih(rec["t"], tz) == tarih(t, tz)
            if "M73" in self.mut:
                return False
            tz = timezone.utc if "M74" in self.mut else self.tz
            return tarih(rec["t"], tz) == tarih(t, tz)
        if not donem_eslesir((rec["anahtar"], rec.get("tarih"), rec.get("kanon")), ctx, self.mut):
            return False
        if ctx[0][0] == "secim":
            if "M71" in self.mut:
                return False
            return "M70" in self.mut or (t if pencere_t is None else pencere_t) - rec["t"] < R3_PENCERE
        return True

    def onceden_gonderildi(self, cid, sablon, ctx, sirket, t, sinir=None, pencere_t=None):
        """§7a R3 + K1/K3/K5/K7 + D3/D7/D8: eşleşen ve sayılan denemelerin en son gönderim anı (programın saati, K5), yoksa None.
        sinir (K5): asıl işin "Yine de Gönder" kararı varsa asıl işin açılış anı — o andan ÖNCEKİ (ve aynı andaki) gönderimler yok sayılır.
        Kaynak: makine defteri (D7: geri yüklemeden sonra yalnız defterde kalan kabul SAYILIR) ∪ şirket dosyası (D8: taşınan veride dosyadaki kabul / teslim SAYILIR)."""
        if "M65" in self.mut:
            return None
        en = None
        for rec, dosyada, rid in self.gorunen_kayitlar():
            if ("M103" in self.mut and not dosyada) or ("M104" in self.mut and rid not in self.defter):
                continue
            if not self.eslesir(rec, cid, sablon, ctx, sirket, t, pencere_t) or not self.sayilir(rec):
                continue
            if sinir is not None and rec["t"] <= sinir:
                continue
            en = rec["t"] if en is None else max(en, rec["t"])
        return en

    def karar_siniri(self, tp, tasima_mut):
        """K5: asıl işin "Yine de Gönder" kararı yeniden denemeye / işteki Yine de Gönder'e taşınır → sınır = asıl işin açılış anı."""
        if "M95" in self.mut:
            return tp.t
        if not tp.send_again or tasima_mut in self.mut:
            return None
        return float("inf") if "M81" in self.mut else tp.t

    def belirsiz_kaynagi(self, cid, sablon, ctx, sirket, t, sinir=None, yalniz_dosya=False, haric=None):
        """K6 + D1 + D6: kişinin aynı şablon + dönem eşliğinde (Son 3 Ay / Tüm'de son 7 gün, gönderim anından) "Sonucu Belirsiz" kalan denemesi →
        "dosya" (deneme şirket dosyasındaki bir işin — D6: "Yine de Gönder" ile AŞILMIŞ eski belirsiz deneme DAHİL) / "defter" (yalnız makine defterinde:
        iş geri yüklemeyle dosyadan çıktı) / None. 09:35 kararı: asıl işin Yine de Gönder sınırı bu elemeye UYGULANMAZ (sinir yalnız M85'te).
        yalniz_dosya: yeni toplu işte yalnız dosyadaki denemeler (kâhin yorumu 21 — D1'in çaresi "işteki Yine de Gönder" ancak iş dosyadaysa var)."""
        mevcut = {x.son_kayit for x in self.isler.values() if x.durum == BELIRSIZ and x.son_kayit is not None}
        bulunan = None
        for rec, dosya_mi, rid in self.gorunen_kayitlar():
            if rid == haric or rec["son_durum"] != BELIRSIZ or not self.eslesir(rec, cid, sablon, ctx, sirket, t, belirsiz=True):
                continue
            if sinir is not None and rec["t"] <= sinir:
                continue
            if dosya_mi:
                if "M100" in self.mut and rid not in mevcut:
                    continue
                return "dosya"
            if not yalniz_dosya or "M108" in self.mut:
                bulunan = "defter"
        return bulunan

    def tasi(self, j, tp, t):
        """Yeniden deneme / Yine de Gönder: iş yeniden gönderime alınır. K4: dönem asıl işten taşınır (M87/M88 bunu bozar)."""
        if j.asil_durum is None:
            j.asil_durum = j.durum
        j.son_kayit = None
        j.yeniden = True
        if "M87" in self.mut:
            j.coz_ozel = donem_coz(tp.donem, t, self.tz, tp.sablon, self.mut)
            j.anahtar_donem, j.tarih_donem, j.kanon_donem = j.coz_ozel["anahtar"], j.coz_ozel["tarih"], j.coz_ozel["kanon"]
        elif "M88" in self.mut and tp.sablon == "ekstre":
            b, e = tp.coz["okumalar"][0]
            j.anahtar_donem = ("aralik", b, e)
        self.durum(j, BEKLIYOR, t); j.next_at = t

    def yeniden_dene(self, o, t):
        """§6 W4 "Başarısızları Yeniden Dene" (yalnız kesin Başarısız) + K4/K5/K6. hedef "asil": düğmeye asıl toplu işte basılır (programda yeniden deneme
        yeni toplu iş açar, asıl işte kişi Başarısız kalır → kâhinde asil_durum)."""
        tp = self.toplular[o["toplu"]]
        asil = o.get("hedef") == "asil"
        hedef = {BASARISIZ}
        if "M22" in self.mut:
            hedef.add(BELIRSIZ)
        if "M22b" in self.mut:
            hedef |= {TESLIM, OKUNDU, KABUL, GONDERILDI}
        sinir = self.karar_siniri(tp, "M80")
        pencere_t = tp.t if "M98" in self.mut else None                 # D3: Son 3 Ay / Tüm'de 7 gün YENİ GÖNDERİM ANINDAN (M98: asıl işin açılışından)
        sonuc = {"elenen": {}, "alinan": [], "oneri": None}
        for j in tp.isler:
            g = j.asil_durum if (asil and j.asil_durum is not None) else j.durum
            if g not in hedef:
                continue
            ctx = (j.anahtar_donem, j.tarih_donem, j.kanon_donem)
            sonraki = j.durum not in hedef and j.durum != BELIRSIZ       # asıl işte Başarısız, sonraki denemesi başka durumda
            if not (sonraki and "M99" in self.mut):
                # E2: TEK neden, sıra Zaten Kuyrukta → Sonucu Belirsiz → Daha Önce Gönderildi (M109 / M110 sırayı bozar)
                sira = ("belirsiz", "kuyruk", "r3") if "M109" in self.mut else (("kuyruk", "r3", "belirsiz") if "M110" in self.mut else ("kuyruk", "belirsiz", "r3"))
                neden = None
                for k in sira:
                    if k == "kuyruk":
                        if self.kuyrukta(j.cari, tp.sablon, ctx, tp.sirket, t, yalniz=j if "M117" in self.mut else None):
                            neden = "zaten_kuyrukta"                       # D5 + N6: kendi sonraki denemesi ya da başka işte bekliyor
                    elif k == "belirsiz":
                        gun_t = tp.t if ("M119" in self.mut and tp.sablon == "hatirlatma") else t   # F2: hatırlatmada yeniden denemenin yerel günü
                        kaynak = self.belirsiz_kaynagi(j.cari, tp.sablon, ctx, tp.sirket, gun_t, sinir=sinir if "M85" in self.mut else None)
                        if "M97" in self.mut and tp.send_again:
                            kaynak = None
                        if kaynak and "M84" not in self.mut and j.durum not in GONDERILMIS:
                            neden = BELIRSIZ_NEDEN                          # K6 (+ D6 aşılmış, + E1 defterdeki)
                            oneri = ONERI_IS if (kaynak == "dosya" or "M86" in self.mut) else ONERI_YENI
                            sonuc["oneri"] = ONERI_IS if ONERI_IS in (sonuc["oneri"], oneri) else oneri
                    elif self.onceden_gonderildi(j.cari, tp.sablon, ctx, tp.sirket, t, sinir=sinir, pencere_t=pencere_t) is not None:
                        neden = DAHA_ONCE                                   # K5 / D5 / E4: 7 gün içinde (Son 3 Ay / Tüm) giden — sonraki denemesi dahil
                    if neden:
                        break
                if neden:
                    sonuc["elenen"][j.cari] = neden
                    continue
                if sonraki:
                    if j.durum in GONDERILMIS and "M116" not in self.mut:
                        pass                                                # E4: sonraki denemenin kabulü 7 günden eski (Son 3 Ay / Tüm) → yeniden gönderilir
                    elif j.durum in GONDERILMIS:
                        sonuc["elenen"][j.cari] = DAHA_ONCE
                        continue
                    else:
                        sonuc["elenen"][j.cari] = {"plan_susuyor": f"asıl işte Başarısız, sonraki denemesi {j.durum}: asıl işten yeniden denenince ne olur"}
                        continue
            self.tasi(j, tp, t); j.gecici_deneme = 0
            sonuc["alinan"].append(j.cari)
        if sonuc["alinan"] or not o.get("etiket"):
            if tp.durum != "iptal":
                tp.durum = "aktif"
            tp.bas = 0; tp.gecici = 0
        if o.get("etiket"):
            self.yeniden_sonuc[o["etiket"]] = sonuc

    def yine_de_gonder(self, o, t):
        """§6 W2/W4 "Yine de Gönder" (Sonucu Belirsiz, çift gidebilir onayıyla) + K4/K5: asıl işin dönemi ve Yine de Gönder kararı taşınır;
        açılıştan sonra başka işle aynı kişiye aynı dönem giden varsa elenir. K6: bu yol Sonucu Belirsiz elemesine takılmaz (onaylı yol)."""
        j = self.isler[f'{o["toplu"]}/{o["cari"]}']
        tp = self.toplular[o["toplu"]]
        sonuc = {"elenen": {}, "alinan": [], "oneri": None}
        if j.durum == BELIRSIZ:
            ctx = (j.anahtar_donem, j.tarih_donem, j.kanon_donem)
            if "M111" not in self.mut and self.kuyrukta(j.cari, tp.sablon, ctx, tp.sirket, t):
                sonuc["elenen"][j.cari] = "zaten_kuyrukta"                  # E2 + F1: işteki Yine de Gönder'de de bekleyen ileti eler
            elif "M118" in self.mut and self.belirsiz_kaynagi(j.cari, tp.sablon, ctx, tp.sirket, t, haric=j.son_kayit):
                sonuc["elenen"][j.cari] = BELIRSIZ_NEDEN                    # M118: F1'in tersi (başka denemenin belirsizi eler)
            elif self.onceden_gonderildi(j.cari, tp.sablon, ctx, tp.sirket, t, sinir=self.karar_siniri(tp, "M83"),
                                         pencere_t=tp.t if "M98" in self.mut else None) is not None:
                sonuc["elenen"][j.cari] = DAHA_ONCE
            else:
                self.tasi(j, tp, t)
                tp.durum = "aktif"; tp.bas = 0
                sonuc["alinan"].append(j.cari)
        if o.get("etiket"):
            self.yeniden_sonuc[o["etiket"]] = sonuc

    def dosyayi_geri_yukle(self, ad):
        """Daha önce alınmış yedeğe dönüş: şirket dosyası (toplu işler + işler) yedekteki hâline döner; makine defteri, Meta'nın kaydı, gönderim sayacı,
        "Bu Ay" (§7a 19) ve bekleyen kancalar KALIR. Yedekten sonra açılan işler dosyadan çıkar (Meta'daki iletileri kalır)."""
        toplular, sira, isler = copy.deepcopy(self.yedekler[ad])
        self.toplular, self.toplu_sira, self.isler = toplular, sira, isler
        self.wamid_is = {w: j for j in isler.values() for w in j.wamidler}
        for w, j in list(self.meta_mesajlari.items()):
            self.meta_mesajlari[w] = isler.get(j.anahtar, j)
        self.ttl_aktif = {j.anahtar: j for j in isler.values() if j.durum in (KABUL, GONDERILDI)}

    def liste(self, o, t):
        """K8: WhatsApp Gönderimleri — en yeni önce, 30'ar sayfa, imleçli "Daha Fazla Göster" (araya yeni gönderim girince sayfa kaymaz), Başlangıç/Bitiş
        YEREL gün, iki uç dahil, Başlangıç > Bitiş → ret. Liste = şirket dosyasındaki toplu işler (kayıt oluşmayan yok, §7a 31); tarih = açılış anı (kâhin yorumu 19)."""
        ad = o["ad"]; sirket = o.get("sirket", "A")
        if o.get("devam"):
            im = self.liste_imlec[o["devam"]]
            bas, son, sonra, atla = im["bas"], im["son"], im["son_oge"], im["gosterilen"]
        else:
            bas, son, sonra, atla = o.get("bas"), o.get("son"), None, 0
        if bas and son and bas > son and "M94" not in self.mut:
            self.listeler[ad] = {"ret": "bas_son_ters"}
            return
        tz = timezone.utc if "M92" in self.mut else self.tz

        def uyar(tp):
            g = tarih(tp.t, tz)
            return (not bas or g >= bas) and (not son or (g < son if "M93" in self.mut else g <= son))
        yeni_once = "M89" not in self.mut
        ogeler = sorted((tp for tp in self.toplular.values() if tp.sirket == sirket and uyar(tp)), key=lambda tp: (tp.t, tp.sira), reverse=yeni_once)
        if "M91" in self.mut:
            kalan = ogeler[atla:]
        elif sonra is not None:
            kalan = [tp for tp in ogeler if ((tp.t, tp.sira) < sonra if yeni_once else (tp.t, tp.sira) > sonra)]
        else:
            kalan = ogeler
        n = 20 if "M90" in self.mut else SAYFA
        sayfa, daha = kalan[:n], len(kalan) > n
        self.listeler[ad] = {"etiketler": [tp.etiket for tp in sayfa],
                             "daha_fazla": daha if (daha or len(sayfa) < n) else {"plan_susuyor": "tam sayfa, kalan yok: Daha Fazla Göster görünür mü"}}
        self.liste_imlec[ad] = {"bas": bas, "son": son, "son_oge": (sayfa[-1].t, sayfa[-1].sira) if sayfa else sonra, "gosterilen": atla + len(sayfa)}

    def gecikmis(self, c, t):
        """§7a 20: vadesi geçmiş açık kalemler (girdi: cari 'vadeler' [{vade, kalan}]; gecikmiş = vade < bugün — kâhin yorumu)."""
        bugun = tarih(t, self.tz)
        return sorted((v for v in c.get("vadeler", []) if v["vade"] < bugun and Decimal(str(v["kalan"])) > 0), key=lambda v: v["vade"])

    def baslat(self, o, t):
        etiket = o["etiket"]; sirket = o.get("sirket", "A"); sablon = o.get("sablon", "ekstre")
        kullanici = o.get("kullanici", "yonetici")
        istek = o.get("istek")
        if istek is not None and istek in self.istekler and "M38" not in self.mut:   # §7a 9: aynı istek kimliği tek toplu iş
            self.ayni_istek[etiket] = self.istekler[istek]
            return
        neden = None
        st = self.meta["sablonlar"].get(ICERIK_SABLON[sablon]) or {}
        if not self.ayar["bagli"]:                                          # §7a 29 sırası
            neden = "bagli_degil"
        elif not self.kullanicilar.get(kullanici, {}).get("whatsapp.send") and "M18y" not in self.mut:
            neden = "yetki_yok"
        elif not self.lisans and "M18" not in self.mut:
            neden = "lisans_salt_okunur"
        elif not self.ayar["onay"] and "M17" not in self.mut:
            neden = "onay_yok"
        elif "M8" not in self.mut and (st.get("durum") != "APPROVED" or st.get("kategori") != "UTILITY"):
            neden = "sablon_uygun_degil"
        if neden:
            self.baslamadi[etiket] = neden
            return
        if istek is not None:
            self.istekler[istek] = etiket
        waba = self.wabalar[sirket]
        coz = donem_coz(o.get("donem"), t, self.tz, sablon, self.mut)            # K1: dönem seçimi başlatmada çözülür (K4: yeniden denemede taşınır)
        self.toplu_sayac += 1
        tp = Toplu(etiket, sablon, o.get("donem"), sirket, t, kullanici, coz=coz, send_again=o.get("onceki") == "gonder", sira=self.toplu_sayac)
        elenen = {}; goruldu = set(); telefonlar = set(); onceki = []
        for cid in o["secim"]:
            if cid in goruldu and "M5" not in self.mut:
                continue                                                  # UNIQUE(batch_id, account_id)
            goruldu.add(cid)
            c = self.cariler[cid]
            if c["silindi"] or c["pasif"]:
                elenen[cid] = "silindi" if c["silindi"] else "pasif"; continue
            if c["istemiyor"] and "M2" not in self.mut:
                elenen[cid] = "istemiyor"; continue
            tel, tur_ = numara(c.get("telefon"))
            if tel is None:
                elenen[cid] = tur_; continue                              # §7a 6: E.164'e çevrilemeyen elenir
            if tur_ == "sabit" and "M53" in self.mut:
                elenen[cid] = "sabit_hat"; continue                       # §7a 6 (K1): sabit hat / yurt dışı ELENMEZ
            if tel in telefonlar and "M54" in self.mut:
                elenen[cid] = "ayni_telefon"; continue                    # §7a 8 (K2): aynı telefon iki cari → iki ileti
            if sablon == "hatirlatma" and not self.gecikmis(c, t) and "M44" not in self.mut:
                elenen[cid] = "gecikmis_borc_yok"; continue               # §7a 20
            ctx = (coz["anahtar"], coz["tarih"], coz["kanon"])
            neden = None                                                  # E2: TEK neden, sıra Zaten Kuyrukta → Sonucu Belirsiz → Daha Önce Gönderildi
            for k in (("belirsiz", "kuyruk") if "M112" in self.mut else ("kuyruk", "belirsiz")):
                if k == "kuyruk" and "M37" not in self.mut and self.kuyrukta(cid, sablon, ctx, sirket, t):
                    neden = "zaten_kuyrukta"                              # §7a 9 + K1 eşlik + K2 + D2(b)
                elif (k == "belirsiz" and "M101" not in self.mut and "M107" not in self.mut and not ("M102" in self.mut and o.get("onceki") == "gonder")
                      and self.belirsiz_kaynagi(cid, sablon, ctx, sirket, t, yalniz_dosya=True)):
                    neden = BELIRSIZ_NEDEN                                # D1 (+ E1: yalnız dosyadaki; + E3 hatırlatmada aynı yerel gün)
                if neden:
                    break
            if neden:
                if "M113" in self.mut:                                    # E2: bu nedenlerle elenen R3 uyarısına GİRMEZ (M113 sokar)
                    ot = self.onceden_gonderildi(cid, sablon, ctx, sirket, t)
                    if ot is not None:
                        onceki.append(ot)
                elenen[cid] = neden; continue
            onceki_t = self.onceden_gonderildi(cid, sablon, ctx, sirket, t)   # R3 + K1 (hatırlatma dahil) + D4 + D7 + D8
            if onceki_t is not None:                                      # §7a R3: uyarı + "Yine de Gönder" / "Bunları Çıkar" (varsayılan)
                onceki.append(onceki_t)
                if o.get("onceki", "cikar") != "gonder" or "M66" in self.mut:
                    elenen[cid] = DAHA_ONCE; continue
            telefonlar.add(tel)
            anahtar = f"{etiket}/{cid}"
            n = 1
            while anahtar in self.isler:
                n += 1; anahtar = f"{etiket}/{cid}#{n}"
            j = Is(anahtar, etiket, cid, sirket)
            j.next_at = t
            j.anahtar_donem = coz["anahtar"]; j.tarih_donem = coz["tarih"]; j.kanon_donem = coz["kanon"]; j.coz_ozel = None
            if "M58" in self.mut:
                j.telefon = tel; j.icerik = self.icerik(c, tp, t, j)
            tp.isler.append(j)
            self.isler[anahtar] = j
        self.elenen[etiket] = elenen
        if onceki:
            self.onceki_uyari[etiket] = {"sayi": len(onceki), "son": tarih(max(onceki), self.tz)}
        if not tp.isler and "M49" not in self.mut:
            self.olusmadi.append(etiket)                                  # §7a 31: kayıt OLUŞMAZ, nedenler listelenir
            return
        self.toplular[etiket] = tp; self.toplu_sira.append(etiket)
        self.program_basamak[waba] = self.meta["basamak"]; self.son_okuma[waba] = t   # §6 W2: basamak gönderimden önce okunur

    # ---- içerik (değişkenler + PDF) -----------------------------------------------------------------------------------------
    def icerik(self, c, tp, t, j=None):
        coz = j.coz_ozel if (j is not None and getattr(j, "coz_ozel", None)) else tp.coz
        if tp.sablon == "ekstre" and coz["secim"] != "tum" and len(coz["okumalar"]) > 1:
            return susuyor_birlestir([self._icerik(c, tp, t, b, s) for (b, s) in coz["okumalar"]],
                                     f"'{coz['secim']}' seçiminin tarih uçları karar metninde yok (kâhin yorumu 17)")
        b, s = coz["okumalar"][0]
        return self._icerik(c, tp, t, b, s)

    def _icerik(self, c, tp, t, d_bas, d_son):
        ad = deger(c["ad"]); firma = deger(self.firmalar[tp.sirket]); tam_ad = temizle(c["ad"])
        hareketler = [(h["tarih"], Decimal(str(h.get("borc", 0))) - Decimal(str(h.get("alacak", 0)))) for h in c["hareketler"]]
        if tp.sablon == "ekstre":
            if d_bas is None:
                bas = son = None; devir = Decimal("0"); donem_h = hareketler
            else:
                bas, son = d_bas, d_son
                if "M15" in self.mut:
                    devir = Decimal("0"); donem_h = hareketler
                else:
                    devir = sum((d for tr, d in hareketler if tr < bas), Decimal("0"))
                    donem_h = [(tr, d) for tr, d in hareketler if bas <= tr <= son]   # §7a 22: uçlar dahil; dönem sonundan sonrası girmez
                if "M14" in self.mut:
                    devir = Decimal("0")
            sonu = devir + sum((d for _, d in donem_h), Decimal("0"))
            mesaj_bakiye = sum((d for _, d in hareketler), Decimal("0")) if "M34" in self.mut else sonu
            return {
                "degiskenler": [ad, firma, donem_metni(bas, son, self.mut), para(mesaj_bakiye, self.mut)],   # §7a 23: {{4}} dönem sonu bakiyesi
                "pdf": {"cari_ad": ad, "donem_bas": bas, "donem_son": son, "devir": str(kurus(devir)),
                        "hareket_sayisi": len(donem_h), "donem_sonu_bakiye": str(kurus(sonu))},
                "dosya_adi": {"on_ek": f"Ekstre {tam_ad} " if isinstance(ad, str) else {"kisaltilabilir": f"Ekstre {tam_ad}"}, "son_ek": ".pdf"},
            }
        bugun = tarih(t, self.tz)
        bakiye = sum((d for tr, d in hareketler if tr <= bugun), Decimal("0"))
        gec = self.gecikmis(c, t)
        if gec:
            vade, tutar = tr_tarih(gec[0]["vade"]), para(sum((Decimal(str(v["kalan"])) for v in gec), Decimal("0")), self.mut)
        else:
            vade, tutar = {"plan_susuyor": "gecikmiş borç yok (yalnız M44'te)"}, {"plan_susuyor": "gecikmiş borç yok"}
        return {"degiskenler": [ad, firma, vade, tutar, para(bakiye, self.mut)], "pdf": None, "dosya_adi": None}   # §7a 20

    # ---- işçi ---------------------------------------------------------------------------------------------------------------
    def _ilerlet(self, tp):
        while tp.bas < len(tp.isler) and tp.isler[tp.bas].durum not in GERI_DONEBILIR:
            tp.bas += 1

    def isci_zamani(self):
        en = None
        for e in self.toplu_sira:
            tp = self.toplular[e]
            if tp.durum != "aktif":
                continue
            self._ilerlet(tp)
            for j in tp.isler[tp.bas:]:
                if j.durum in CALISIR and (en is None or j.next_at < en):
                    en = j.next_at
        return en

    def sinir_degeri(self, waba):
        L = self.program_basamak.get(waba, self.meta["basamak"])
        cap = self.ayar.get("gunluk_ust_sinir")
        if cap is not None and "M23" not in self.mut:
            L = min(L, cap)
        return L

    def pencere_kumesi(self, waba, t):
        p = self.pencere.get(waba, {})
        if "M6" in self.mut:
            gun_bas = int(datetime.fromtimestamp(t / 1000, self.tz).replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000)
            return {a: x for a, x in p.items() if x >= gun_bas}
        return {a: x for a, x in p.items() if x > t - GUN}

    def sigar(self, kume, alici, L):
        return len(kume) + (0 if alici in kume else 1) <= L      # §7a 4: penceresinde sayılmış alıcı GEÇER

    def oda_zamani(self, waba, alici, t, L, onbellek):
        if "M1" in self.mut:
            k = onbellek.setdefault(("m1", waba), sorted(x for (x, w, *_r) in self.kabul_kaydi if w == waba and x > t - GUN))
            return t if len(k) < L else k[len(k) - L] + GUN
        p = self.pencere.get(waba, {})
        if len(p) < L and "M6" not in self.mut:
            return t
        kk = ("kume", waba)
        if kk not in onbellek:
            onbellek[kk] = self.pencere_kumesi(waba, t)
        kume = onbellek[kk]
        if self.sigar(kume, alici, L):
            return t
        anahtar = ("oda", waba, alici in kume)
        if anahtar in onbellek:
            return onbellek[anahtar]
        if "M6" in self.mut:
            ertesi = datetime.fromtimestamp(t / 1000, self.tz).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
            onbellek[anahtar] = int(ertesi.timestamp() * 1000)
            return onbellek[anahtar]
        sonuc = None
        zamanlar = sorted(kume.items(), key=lambda kv: kv[1])
        for i, (_a, x) in enumerate(zamanlar):
            aday = x + GUN
            if aday <= t:
                continue
            if self.sigar({a: y for a, y in zamanlar[i + 1:] if y > aday - GUN}, alici, L):
                sonuc = aday
                break
        onbellek[anahtar] = sonuc
        return sonuc

    def atla(self, j, neden, t):
        j.elendi_neden = neden
        self.durum(j, ATLANDI, t)

    def isci(self, t):
        onbellek = {}
        for e in self.toplu_sira:
            tp = self.toplular[e]
            if tp.durum != "aktif":
                continue
            self._ilerlet(tp)
            for j in tp.isler[tp.bas:]:
                if j.durum not in CALISIR or j.next_at > t:
                    continue
                c = self.cariler[j.cari]
                waba = self.wabalar[tp.sirket]
                if (c["silindi"] or c["pasif"] or c["istemiyor"]) and "M57" not in self.mut:   # §7a 2: kuyrukta işaretlenen / silinen / pasif → Atlandı
                    self.atla(j, "silindi" if c["silindi"] else ("pasif" if c["pasif"] else "istemiyor"), t)
                    continue
                if "M58" not in self.mut or j.icerik is None:                     # §7a 1: veri GÖNDERİM ANINDA okunur
                    tel, tur_ = numara(c.get("telefon"))
                    if tel is None:
                        self.atla(j, tur_, t)
                        continue
                    if tp.sablon == "hatirlatma" and not self.gecikmis(c, t) and "M44" not in self.mut:
                        self.atla(j, "gecikmis_borc_yok", t)
                        continue
                    j.telefon = tel[1:] if "M16" in self.mut else tel
                    j.icerik = self.icerik(c, tp, t, j)
                blok = self.blok.get(("toplu", tp.etiket), 0) if "M52" in self.mut else self.blok.get(("waba", waba), 0)
                if blok > t:                                                  # §7a 30: Meta sınır hatası → WABA'nın bütün işleri 24 sa
                    self.durum(j, SINIR, t); j.next_at = blok
                    continue
                oda = self.oda_zamani(waba, j.telefon, t, self.sinir_degeri(waba), onbellek)
                if oda is None or oda > t:
                    self.durum(j, SINIR, t); j.next_at = oda if oda is not None else t + GUN
                    continue
                self.gonder(j, tp, waba, t)
                return

    def meta_yanit_mesaj(self, j, deneme):
        if self.meta["kapali"]:
            return "baglanti_reddi"
        kurallar = self.davranis.get("mesaj", {})
        liste = kurallar.get(j.cari, kurallar.get("*"))
        if liste is None:
            yanit = "kabul"
        elif isinstance(liste, (str, dict)):
            yanit = liste
        else:
            yanit = liste[deneme - 1] if deneme - 1 < len(liste) else "kabul"
        if yanit == "kabul":
            st = self.meta["sablonlar"].get(ICERIK_SABLON[self.toplular[j.toplu].sablon]) or {}
            durum = st.get("durum")
            if durum == "PAUSED":
                return {"hata": 132015}
            if durum == "DISABLED":
                return {"hata": 132016}
            if durum != "APPROVED":
                return {"hata": 132001}
        return yanit

    def meta_yanit_medya(self):
        liste = self.davranis.get("medya", [])
        return liste[self.medya_toplam - 1] if self.medya_toplam - 1 < len(liste) else "kabul"

    def gonder(self, j, tp, waba, t):
        ts = t + self.adim
        self.isci_bos = ts
        j.son_kayit = None                                  # önceki deneme kesinleşti; bu gönderim yeni deneme
        self.durum(j, HAZIRLANIYOR, t)
        if tp.sablon == "ekstre":                           # §2.3 / W3; §7a 15: geçerli medya yeniden kullanılır
            canli = len(j.medyalar) > j.silinen_n or ("M36" in self.mut and j.medyalar)
            if not canli:
                while True:
                    if self.meta["kapali"]:
                        return self.baglanti_yok(j, tp, ts)
                    self.medya_toplam += 1
                    y = self.meta_yanit_medya()
                    if y == "kabul":
                        j.medyalar.append(f"m:{j.anahtar}#{len(j.medyalar) + 1}")
                        break
                    if y == "yanitsiz":                     # §6 W2: yeniden yüklenir; §7a 15: medya yükleme hataları "5 art arda"ya sayılır
                        tp.gecici += 1
                        if tp.gecici >= 5 and "M9" not in self.mut:
                            return self.duraklatan(j, tp, "medya", ts)
                        continue
                    if isinstance(y, dict) and "hata" in y:
                        return self.hata_isle(j, tp, y["hata"], ts, post_yok=True)
                    raise ValueError(f"senaryo medya yanıtı modellenmedi: {y}")
        self.durum(j, GONDERILIYOR, ts)                     # §6 W2: istekten ÖNCE yazılır
        self.kayit_ac(j, tp, ts)                            # gönderim denemesi (talep) — makine defterine ve işin kaydına
        c = self.cokme
        if c and not c.get("oldu") and c.get("cari") == j.cari and c.get("toplu", tp.etiket) == tp.etiket:
            c["oldu"] = True
            if c.get("istek_ulasti", True):
                self.post_say(j, tp, ts)
                self.meta_ileti(j, ts, programa=False)
            self.acik = False
            for o in self.olaylar:
                if o[0] is None:
                    o[0] = zaman_ayristir(o[2]["t"], self.T0, cokme=ts)
            return
        if j.telefon and not j.telefon.startswith("+"):
            self.degismez["artisiz_numaraya_gonderim"] += 1
        if not self.lisans:
            self.degismez["lisanssiz_gonderim"] += 1
        if tp.durum != "aktif":
            self.degismez["duraklatilmis_toplu_gonderim"] += 1
        if tp.sablon == "ekstre" and len(j.medyalar) <= j.silinen_n and "M36" not in self.mut:
            self.degismez["silinmis_medyayla_gonderim"] += 1
        if "M36" in self.mut and tp.sablon == "ekstre" and len(j.medyalar) <= j.silinen_n:
            self.degismez["silinmis_medyayla_gonderim"] += 1
        if self.meta["kapali"]:                             # §7a 11: bağlantı hiç kurulamadı → geçici
            return self.baglanti_yok(j, tp, ts)
        y = self.meta_yanit_mesaj(j, self.post_hedef.get(j.telefon, 0) + 1)
        self.post_say(j, tp, ts)
        if y == "kabul":
            self.meta_ileti(j, ts, programa=True)
            if "M4" in self.mut:
                self.kesinlesti(j, ts)
            tp.gecici = 0; j.gecici_deneme = 0               # §7a 15: sayaç başarılı gönderimle sıfırlanır
            return
        if y in ("yanitsiz_kabul", "yanitsiz_red"):
            if y == "yanitsiz_kabul":
                self.meta_ileti(j, ts, programa=False)
            if "M3" in self.mut:
                self.durum(j, BEKLIYOR, ts); j.next_at = ts + GECICI_DIZI[0]
                return
            return self.belirsiz(j, ts)
        kod = y.get("hata") if isinstance(y, dict) else None
        if (isinstance(y, dict) and y.get("sinir")) or kod in SINIR_KODLARI:   # §7a 12 + 30
            if "M35" in self.mut or ("M51" in self.mut and kod in SINIR_KODLARI):
                j.kod = kod; self.durum(j, BASARISIZ, ts); self.kesinlesti(j, ts)
                return
            kapsam = ("toplu", tp.etiket) if "M52" in self.mut else ("waba", waba)
            self.blok[kapsam] = ts + GUN
            self.durum(j, SINIR, ts); j.next_at = ts + GUN
            return
        self.hata_isle(j, tp, kod, ts)

    def baglanti_yok(self, j, tp, ts):
        """§7a 11 + R1: Meta'ya HİÇ ulaşılamadı (istek gitmediği kesin) → iş Başarısız SAYILMAZ, deneme sayacı artmaz; toplu iş
        'Bağlantı Bekleniyor' diye durur, bağlantı dönünce kendiliğinden sürer."""
        if "M59" in self.mut:
            return self.belirsiz(j, ts)
        if "M61" in self.mut:
            return self.hata_isle(j, tp, BAGLANTI, ts, post_yok=True)
        self.durum(j, BEKLIYOR, ts); j.next_at = ts
        tp.durum = "baglanti_bekleniyor"; tp.neden = BAGLANTI_BEKLENIYOR

    def belirsiz(self, j, ts):
        self.durum(j, BELIRSIZ, ts); j.belirsiz_t = ts       # §7a 10: toplu iş SÜRER

    def duraklatan(self, j, tp, kod, ts):
        """§6 W2 İLK hatada DURAKLAR; §7a 13: hatayı alan iş Başarısız (kodlu), bekleyenler Duraklatıldı."""
        j.kod = kod
        if "M40" in self.mut:
            self.durum(j, BEKLIYOR, ts)
        else:
            self.durum(j, BASARISIZ, ts); self.kesinlesti(j, ts)
        tp.durum = "duraklatildi"; tp.neden = kod
        for x in tp.isler:
            if x.durum in (BEKLIYOR, SINIR, HAZIRLANIYOR, BEKLEME_131049):
                self.durum(x, DURAKLATILDI, ts)

    def hata_isle(self, j, tp, kod, ts, post_yok=False):
        j.kod = kod
        self.durum(j, BEKLIYOR, ts)
        if kod in DURAKLATAN or (isinstance(kod, int) and kod in DURAKLATAN_ARALIK):
            if "M10" in self.mut:
                self.durum(j, BASARISIZ, ts); self.kesinlesti(j, ts)
                return
            return self.duraklatan(j, tp, kod, ts)
        if kod in ALICI:
            self.durum(j, BASARISIZ, ts); self.kesinlesti(j, ts)
            if "M32" in self.mut:
                self.duraklatan(j, tp, kod, ts)
            return
        if kod == 131049:
            return self.k131049(j, tp, ts)
        if kod == 131056:
            j.next_at = ts + DK
            return
        if kod in GECICI or kod == BAGLANTI:                # §7a 15: 30 sn → 2 dk → 15 dk, sonra Başarısız; 5 art arda → toplu iş durur (BAGLANTI yalnız M61)
            tp.gecici += 1; j.gecici_deneme += 1
            if tp.gecici >= 5 and "M9" not in self.mut:
                return self.duraklatan(j, tp, kod, ts)
            if j.gecici_deneme > len(GECICI_DIZI) and "M39" not in self.mut:
                self.durum(j, BASARISIZ, ts); self.kesinlesti(j, ts)
                return
            j.next_at = ts + GECICI_DIZI[min(j.gecici_deneme, len(GECICI_DIZI)) - 1]
            return
        # §7a 12: sınıfsız ve tanınmayan kod → o İŞ Başarısız (kodlu), toplu iş sürer
        if "M47" in self.mut:
            return self.duraklatan(j, tp, kod, ts)
        self.durum(j, BASARISIZ, ts); self.kesinlesti(j, ts)

    def k131049(self, j, tp, t):
        """§6 W2: 131049 → 24 saat sonra en çok bir kez; §7a 14: 'Meta Bekletti', PDF silinmez, aynı medya."""
        if j.deneme_49 >= 1 and "M20" not in self.mut:
            j.kod = 131049; self.durum(j, BASARISIZ, t); self.kesinlesti(j, t)
            return
        j.deneme_49 += 1; j.kod = 131049
        if "M60" in self.mut:
            self.kesinlesti(j, t)
        self.durum(j, BEKLEME_131049, t); j.next_at = t + (0 if "M19" in self.mut else GUN)
        tp.bas = 0

    def kayit_ac(self, j, tp, ts):
        self.kayit_sira += 1
        rid = self.kayit_sira
        self.kayitlar[rid] = {"sirket": j.sirket, "cari": j.cari, "sablon": tp.sablon, "anahtar": j.anahtar_donem, "tarih": j.tarih_donem, "kanon": j.kanon_donem, "t": ts, "is": j.anahtar,
                              "kabul": False, "teslim": False, "son_durum": GONDERILIYOR}
        self.defter.add(rid); j.kayitlar.append(rid); j.son_kayit = rid

    def post_say(self, j, tp, ts):
        j.post += 1
        self.post_hedef[j.telefon] = self.post_hedef.get(j.telefon, 0) + 1

    def meta_ileti(self, j, ts, programa):
        j.meta_sayi += 1
        wamid = f"wamid.{j.anahtar}#{j.meta_sayi}"
        self.meta_mesajlari[wamid] = j
        if programa:
            self.programa_kabul(j, wamid, ts)
        plan = self.davranis.get("kanca", {})
        liste = plan.get(j.cari, plan.get("*", []))
        if isinstance(liste, dict):
            liste = liste.get(str(j.meta_sayi), liste.get("*", []))
        for k in liste:
            ek = dict(k[2]) if len(k) > 2 else {}
            olay_t = zaman_ayristir(k[1], ts)
            varis = zaman_ayristir(ek["varis"], ts) if "varis" in ek else olay_t
            ek.setdefault("opaque", j.anahtar)
            ek["olay_t"] = olay_t; ek["imzali"] = True        # Meta'nın kancası: imza kapıcıda doğrulanır (§7a 3)
            for _ in range(int(ek.get("tekrar", 1))):
                self.kanca_planla(varis, wamid, k[0], ek.get("kod"), ek)

    def programa_kabul(self, j, wamid, ts, meta_t=None):
        tp = self.toplular[j.toplu]
        waba = self.wabalar[tp.sirket]
        j.wamidler.append(wamid); self.wamid_is[wamid] = j
        j.kabul_t = ts
        if j.son_kayit is not None:
            rec = self.kayitlar[j.son_kayit]
            rec["kabul"] = True; self.wamid_kayit[wamid] = j.son_kayit
            if meta_t is not None and "M82" in self.mut:
                rec["t"] = meta_t                            # M82: Meta'nın bildirim saati (K5: programın saati olmalı)
        if "M50" not in self.mut:
            j.kod = None                                     # §7a 32
        p = self.pencere.setdefault(waba, {})
        p[j.telefon] = max(p.get(j.telefon, 0), ts)
        tp.okuma_sayac += 1                                  # §7a R2: son kategori okumasından beri ileti
        self.kabul_kaydi.append((ts, waba, tp.sirket, j.telefon, j.anahtar))
        self.durum(j, KABUL, ts)

    # ---- kanca ----------------------------------------------------------------------------------------------------------------
    def kanca_planla(self, t, wamid, durum, kod, ek):
        self.kanca_sira += 1
        heapq.heappush(self.kancalar, (t, self.kanca_sira, wamid, durum, kod, ek))

    def kanca_varis(self, t, wamid, durum, kod, ek):
        if not (self.acik and self.tunel):
            if "M28" not in self.mut:
                self.meta_kuyruk.append((t, wamid, durum, kod, ek))
            return
        self.kanca_isle(t, wamid, durum, kod, ek)

    def kuyruk_isle(self, t):
        if not (self.acik and self.tunel):
            return
        kuyruk, self.meta_kuyruk = self.meta_kuyruk, []
        for (ilk, wamid, durum, kod, ek) in kuyruk:
            if t - ilk <= KANCA_OMRU:
                self.kanca_isle(t, wamid, durum, kod, ek)

    def kanca_isle(self, t, wamid, durum, kod, ek):
        if not ek.get("imzali") and "M24" not in self.mut:
            return                                           # §7a 3: imzasız olay düşer (GUV-06)
        sahibi = self.meta_mesajlari.get(wamid) or self.wamid_is.get(wamid)
        if sahibi is not None and ek.get("imzali"):
            self.son_kanca[self.wabalar[sahibi.sirket]] = t   # §7a 16: kanca yolu çalışıyor
        olay_t = ek.get("olay_t", t)
        j = self.wamid_is.get(wamid)
        if j is None:
            aday = self.isler.get(ek.get("opaque"))            # §7a 3: iş kimliği eşleşirse çözülür; sayaçlara ve pencereye girer
            if not (aday and aday.durum == BELIRSIZ):
                return
            j = aday
            self.programa_kabul(j, wamid, j.belirsiz_t, meta_t=olay_t)   # K5: kabul anı programın saati (gönderim anı), Meta'nın bildirim saati değil
        rec = self.kayitlar.get(self.wamid_kayit.get(wamid))
        teslim_olayi = durum in ("delivered", "read")
        if j.durum == SURESI_DOLDU:                          # §7a 17: gerçek bilgi yazılır
            if teslim_olayi and "M42" not in self.mut:
                if rec is not None:
                    rec["teslim"] = True
                self.durum(j, TESLIM if durum == "delivered" else OKUNDU, t)
                self.teslim_yaz(j, olay_t)
            return
        if j.durum in KAPANDI_TESLIMSIZ:                     # K3/K7: teslimsiz kapandıktan sonra gelen teslim — "Daha Önce Gönderildi" sayılır, §7a 19 "Bu Ay"a girer
            if teslim_olayi:
                if rec is not None:
                    rec["teslim"] = True
                yeni = TESLIM if durum == "delivered" else OKUNDU
                if j.gec_teslim is None or SIRA[yeni] > SIRA[j.gec_teslim]:
                    j.gec_teslim = yeni
                self.teslim_yaz(j, olay_t); self.kesinlesti(j, t)
            return
        if teslim_olayi and rec is not None and j.durum in SIRA:
            rec["teslim"] = True
        if j.durum not in SIRA:
            return
        if durum == "sent":
            if SIRA[j.durum] < 2:
                self.durum(j, GONDERILDI, t)
        elif durum == "delivered":
            if SIRA[j.durum] < 3 or ("M11" in self.mut and j.durum == OKUNDU):
                self.durum(j, TESLIM, t); self.teslim_yaz(j, olay_t); self.kesinlesti(j, t)
            elif "M12" in self.mut:
                self.teslim_kaydi.append((j, olay_t))
        elif durum == "read":
            if SIRA[j.durum] < 4:
                self.durum(j, OKUNDU, t); self.teslim_yaz(j, olay_t); self.kesinlesti(j, t)
        elif durum == "failed" and SIRA[j.durum] < 3:      # §7a 18: delivered/read'den sonra gelen failed yok sayılır
            if kod == 131049:
                return self.k131049(j, self.toplular[j.toplu], t)
            j.kod = kod
            if "M30" in self.mut and kod == 131026:
                return
            self.durum(j, BASARISIZ, t); self.kesinlesti(j, t)

    def teslim_yaz(self, j, olay_t):
        if j.teslim_t is None:
            j.teslim_t = olay_t                              # §7a 17: durum zamanı kanca timestamp'i
            self.teslim_kaydi.append((j, olay_t))

    def kesinlesti(self, j, t):
        """§11 S3 A: kesinleşince PDF Meta'dan silinir (her medya bir kez)."""
        j.silinen_n = len(j.medyalar)

    # ---- TTL, basamak ve şablon okuma ---------------------------------------------------------------------------------------
    def ttl_son(self, j):
        return j.kabul_t + (30 * GUN if "M7" in self.mut else TTL) + TTL_PAYI

    def yol_calisiyor(self, j, t):
        """§7a 16: bağlantıda son 7 günde en az bir (imzalı) kanca geldiyse kanca yolu çalışıyor."""
        if "M41" in self.mut:
            return True
        s = self.son_kanca.get(self.wabalar[j.sirket])
        return s is not None and s >= t - KANCA_OMRU

    def ttl_zamani(self, t):
        en = None
        for j in self.ttl_aktif.values():
            d = max(self.ttl_son(j), t)
            if self.yol_calisiyor(j, d) and (en is None or d < en):
                en = d
        return en

    def ttl_isle(self, t):
        for j in list(self.ttl_aktif.values()):
            if t >= self.ttl_son(j) and self.yol_calisiyor(j, t):   # kanca yolu yoksa "Meta Kabul Etti"de kalır ("Durum Bilinmiyor" yok)
                self.durum(j, SURESI_DOLDU, t)
                if "M29" not in self.mut:
                    self.kesinlesti(j, t)

    def bekleyen_var(self, waba):
        for e in self.toplu_sira:
            tp = self.toplular[e]
            if tp.durum == "aktif" and self.wabalar[tp.sirket] == waba:
                self._ilerlet(tp)
                if any(j.durum in CALISIR for j in tp.isler[tp.bas:]):
                    return True
        return False

    def okuma_zamani(self):
        if "M21" in self.mut:
            return None
        en = None
        for waba, son in self.son_okuma.items():
            if self.bekleyen_var(waba):
                aday = son + 6 * SA
                if en is None or aday < en:
                    en = aday
        return en

    def okuma_isle(self, t):
        if "M21" in self.mut:
            return
        for waba, son in list(self.son_okuma.items()):
            if t >= son + 6 * SA and self.bekleyen_var(waba):   # §6 W2: basamak 6 saatte bir
                eski = self.program_basamak.get(waba)
                self.program_basamak[waba] = self.meta["basamak"]; self.son_okuma[waba] = t
                if eski is not None and self.meta["basamak"] > eski:
                    for j in self.isler.values():
                        if j.durum == SINIR and self.wabalar[self.toplular[j.toplu].sirket] == waba:
                            j.next_at = min(j.next_at, t)

    def toplu_bekleyen(self, tp):
        self._ilerlet(tp)
        return any(j.durum in CALISIR for j in tp.isler[tp.bas:])

    def sablon_okuma_zamani(self):
        if "M48" in self.mut:
            return None
        en = None
        for e in self.toplu_sira:
            tp = self.toplular[e]
            if tp.durum == "aktif" and self.toplu_bekleyen(tp):
                aday = tp.sablon_okuma + (SA if "M63" in self.mut else SABLON_OKUMA_ARALIK)
                if en is None or aday < en:
                    en = aday
        return en

    def sablon_okuma_isle(self, t):
        """§7a 27 + R2: şablon kategorisi toplu iş sürerken HER 100 İLETİDE ve EN GEÇ 10 DAKİKADA bir okunur (hangisi önce);
        MARKETING görülünce iş durur. Okuma işçinin sıradaki gönderiminden önce yapılır (adim_isle sırası)."""
        if "M48" in self.mut:
            return
        aralik = SA if "M63" in self.mut else SABLON_OKUMA_ARALIK
        sayiyla = "M63" not in self.mut and "M64" not in self.mut
        for e in self.toplu_sira:
            tp = self.toplular[e]
            if tp.durum == "aktif" and (t >= tp.sablon_okuma + aralik or (sayiyla and tp.okuma_sayac >= SABLON_OKUMA_ILETI)) and self.toplu_bekleyen(tp):
                tp.sablon_okuma = t; tp.okuma_sayac = 0
                st = self.meta["sablonlar"].get(ICERIK_SABLON[tp.sablon]) or {}
                if st.get("kategori") != "UTILITY":
                    tp.durum = "duraklatildi"; tp.neden = SABLON_PAZARLAMA
                    for x in tp.isler:
                        if x.durum in (BEKLIYOR, SINIR, BEKLEME_131049):
                            self.durum(x, DURAKLATILDI, t)

    # ---- durum, kontrol, sonuç ------------------------------------------------------------------------------------------------
    def durum(self, j, yeni, t):
        j.durum = yeni
        if j.son_kayit is not None:
            self.kayitlar[j.son_kayit]["son_durum"] = yeni
        if yeni in (KABUL, GONDERILDI):
            self.ttl_aktif[j.anahtar] = j
        else:
            self.ttl_aktif.pop(j.anahtar, None)

    # K3/K7: teslimsiz kapanan işe geç teslim gelince EKRAN durumu karar metninde yok ("sayılır" der) → iki seçenek
    GEC_TESLIM_SUSUYOR = "teslimsiz kapanan işe (Başarısız/İptal/Durduruldu/Taşınan) geç gelen teslimin ekran durumu (K3/K7 yalnız 'sayılır' der)"
    PDF_SILME_SUSUYOR = "İptal / geri yükleme / taşıma ile duran işin PDF'i (§11 S3 yalnız teslim / başarısız / süresi doldu der)"

    def gorunen(self, j):
        if j.gec_teslim and j.durum in KAPANDI_TESLIMSIZ:
            return {"secenek": [j.durum, j.gec_teslim], "susuyor": self.GEC_TESLIM_SUSUYOR}
        return j.durum

    def durum_sayilari(self):
        a, b = {}, {}
        for j in self.isler.values():
            a[j.durum] = a.get(j.durum, 0) + 1
            d = j.gec_teslim if (j.gec_teslim and j.durum in KAPANDI_TESLIMSIZ) else j.durum
            b[d] = b.get(d, 0) + 1
        a, b = dict(sorted(a.items())), dict(sorted(b.items()))
        return a if a == b else {"secenek": [a, b], "susuyor": self.GEC_TESLIM_SUSUYOR}

    def pdf_susuyor(self, j):
        return j.durum in PDF_SUSUYOR and len(j.medyalar) > j.silinen_n

    def kontrol(self, o, t):
        susan = any(self.pdf_susuyor(j) for j in self.isler.values())
        k = {
            "t": iso(t, self.tz),
            "durum_sayilari": self.durum_sayilari(),
            "toplam_post": sum(self.post_hedef.values()),
            "toplam_kabul": len(self.kabul_kaydi),
            "pencere_farkli_alici": {w: len(self.pencere_kumesi(w, t)) for w in sorted(set(self.wabalar.values()))},
            "medya_silme": {"plan_susuyor": self.PDF_SILME_SUSUYOR} if susan else sum(j.silinen_n for j in self.isler.values()),
            "toplular": {e: self.toplular[e].durum for e in self.toplu_sira},
        }
        if not self.ozet:
            k["isler"] = {a: self.gorunen(j) for a, j in sorted(self.isler.items())}
        self.kontroller[o["ad"]] = k

    def sonuc(self):
        isler = {}
        for k, j in sorted(self.isler.items()):
            gec = j.gec_teslim and j.durum in KAPANDI_TESLIMSIZ
            isler[k] = {
                "durum": self.gorunen(j), "telefon": j.telefon, "sablon": ICERIK_SABLON[self.toplular[j.toplu].sablon] if j.toplu in self.toplular else None,
                "degiskenler": j.icerik["degiskenler"] if j.icerik else None,
                "pdf": j.icerik["pdf"] if j.icerik else None,
                "dosya_adi": j.icerik["dosya_adi"] if j.icerik else None,
                "hata_kodu": {"secenek": [j.kod, None], "susuyor": self.GEC_TESLIM_SUSUYOR} if (gec and j.kod is not None) else j.kod,
                "post": j.post, "kabul": len(j.wamidler), "meta_ileti": j.meta_sayi,
                "medya_yukleme": len(j.medyalar), "medya_silme": {"plan_susuyor": self.PDF_SILME_SUSUYOR} if self.pdf_susuyor(j) else j.silinen_n,
                "atlanma_nedeni": j.elendi_neden,
            }

        def topla(alan):
            o = {}
            for j in self.isler.values():
                o[j.cari] = o.get(j.cari, 0) + alan(j)
            return dict(sorted(o.items()))
        medya_silme = topla(lambda j: j.silinen_n)
        for j in self.isler.values():
            if self.pdf_susuyor(j):
                medya_silme[j.cari] = {"plan_susuyor": self.PDF_SILME_SUSUYOR}
        # §7a 19: "Bu Ay Gönderilen İleti Sayısı" = TESLİM edilen (Teslim + Okundu), ay = teslim zamanı (Türkiye saati), kapsam WABA
        bu_ay = {}
        kayitlar = ([(self.wabalar[j.sirket], j.kabul_t if "M43" in self.mut else t_) for (j, t_) in self.teslim_kaydi]
                    if "M31" not in self.mut else [(w, t_) for (t_, w, *_r) in self.kabul_kaydi])
        for waba, t_ in kayitlar:
            b = bu_ay.setdefault(waba, {}).setdefault(ay(t_), {"teslim": 0})
            b["teslim"] += 1
        for kv in bu_ay.values():
            for b in kv.values():
                b["yaklasik_usd"] = str((UCRET_USD * b["teslim"]).quantize(Decimal("0.0001")))
        for j in self.isler.values():
            if j.silinen_n and j.durum in (KABUL, GONDERILDI, BELIRSIZ):
                self.degismez["kesin_oncesi_medya_silme"] += 1
        sonuc = {
            "baslamadi": dict(sorted(self.baslamadi.items())),
            "elenen": {k: dict(sorted(v.items())) for k, v in sorted(self.elenen.items()) if v},
            "olusmadi": sorted(self.olusmadi),
            "ayni_istek": dict(sorted(self.ayni_istek.items())),
            "onceki_uyari": dict(sorted(self.onceki_uyari.items())),
            "toplular": {e: {"durum": self.toplular[e].durum, "neden": self.toplular[e].neden, "is_sayisi": len(self.toplular[e].isler)} for e in self.toplu_sira},
            "durum_sayilari": self.durum_sayilari(),
            "meta": {"post": topla(lambda j: j.post), "kabul": topla(lambda j: len(j.wamidler)), "meta_ileti": topla(lambda j: j.meta_sayi),
                     "medya_yukleme": topla(lambda j: len(j.medyalar)), "medya_silme": medya_silme,
                     "toplam_post": sum(self.post_hedef.values()), "toplam_kabul_program": len(self.kabul_kaydi),
                     "toplam_meta_ileti": len(self.meta_mesajlari), "toplam_medya_yukleme": self.medya_toplam},
            "kontroller": self.kontroller,
            "bu_ay": {k: dict(sorted(v.items())) for k, v in sorted(bu_ay.items())},
            "degismez": dict(self.degismez),
        }
        if self.yeniden_sonuc:                                 # K4–K6: yeniden deneme / Yine de Gönder yanıtı (yalnız etiketli olaylar)
            sonuc["yeniden"] = {k: {"elenen": dict(sorted(v["elenen"].items())), "alinan": v["alinan"], "oneri": v["oneri"]}
                                for k, v in sorted(self.yeniden_sonuc.items())}
        if self.listeler:                                      # K8
            sonuc["listeler"] = dict(sorted(self.listeler.items()))
        if self.ozet:
            sonuc["meta"] = {k: v for k, v in sonuc["meta"].items() if k.startswith("toplam")}
            sonuc["isler_ornek"] = {k: isler[k] for k in sorted(isler)[:3]}
            sonuc["isler_post_dagilimi"] = dict(sorted({str(n): sum(1 for j in self.isler.values() if j.post == n) for n in {j.post for j in self.isler.values()}}.items()))
        else:
            sonuc["isler"] = isler
        return sonuc


# ---- birleştirme (zaman serbestliği) ----------------------------------------------------------------------------------------

def _metin(d):
    return json.dumps(d, sort_keys=True, ensure_ascii=False)


def birlestir(degerler):
    """Aynı yapıdaki sonuçları birleştirir: hepsinde aynı → değer; ayrışan yaprak → {"biri": sıralı benzersiz}."""
    if all(isinstance(d, dict) and set(d) != {"biri"} and set(d) != {"kisaltilabilir"} and "plan_susuyor" not in d and "secenek" not in d for d in degerler):
        anahtarlar = []
        for d in degerler:
            for k in d:
                if k not in anahtarlar:
                    anahtarlar.append(k)
        return {k: birlestir([d.get(k, "<YOK>") for d in degerler]) for k in anahtarlar}
    if all(_metin(d) == _metin(degerler[0]) for d in degerler):
        return degerler[0]
    benzersiz = {}
    for d in degerler:
        for a in (d["biri"] if isinstance(d, dict) and set(d) == {"biri"} else [d]):
            benzersiz[_metin(a)] = a
    return {"biri": [benzersiz[k] for k in sorted(benzersiz)]}


def secim_birlesimleri(serbest):
    adlar = list(serbest)
    for degerler in itertools.product(*[SERBEST[a] for a in adlar]):
        yield dict(zip(adlar, degerler))


def tam_secim(kismi):
    s = {k: v[0] for k, v in SERBEST.items()}
    s.update(kismi)
    return s


def hesapla_tek(sen, kismi=None, mut=frozenset()):
    return birlestir([Benzetim(sen, tam_secim(kismi or {}), zaman, mut).calistir() for zaman in ZAMANLAR])


def hesapla(sen, mut=frozenset()):
    """Senaryonun beklenen sonucu: [{secimler, sonuc}] (SERBEST boş olduğundan tek grup)."""
    if sen.get("serbest"):
        raise ValueError("senaryo serbest seçim bildiriyor ama §7a hepsini kararlaştırdı")
    gruplar = []
    for kismi in secim_birlesimleri([]):
        gruplar.append({"secimler": [kismi], "sonuc": hesapla_tek(sen, kismi, mut)})
    return gruplar


def yol_al(o, yol):
    for p in yol.split("."):
        if isinstance(o, dict) and p in o:
            o = o[p]
        else:
            return "<YOK>"
    return o


def grup_bul(beklenen, secim):
    for g in beklenen:
        for s in g["secimler"]:
            if all(secim.get(k) == v for k, v in s.items()):
                return g
    return None


def karsilastir(beklenen, program, secim=None):
    """beklenen: hesapla() çıktısı; program: aynı biçimde tek sonuç (sürücü üretir) → farklar listesi.
    {"biri": [...]} yaprağında program değeri listeden biri olmalı; {"plan_susuyor": …} denetlenmez; {"kisaltilabilir": tam} önek kabul eder;
    {"secenek": [...], "susuyor": neden} (kâhin güncellemesi 2) program değeri seçeneklerden biri olmalı (karar metni hangisi olduğunu söylemiyor)."""
    grup = grup_bul(beklenen, tam_secim(secim or {}))
    if grup is None:
        return ["seçim hiçbir gruba uymuyor"]
    farklar = []

    def gez(b, p, yol):
        if isinstance(b, dict) and set(b) == {"biri"}:
            if p not in b["biri"]:
                farklar.append(f"{yol}: beklenen şunlardan biri {b['biri']}, program {p!r}")
            return
        if isinstance(b, dict) and "plan_susuyor" in b:
            return
        if isinstance(b, dict) and "secenek" in b:             # kâhin güncellemesi 2: karar metni iki ekrandan hangisi olduğunu söylemiyor (KÂHİN SUSUYOR)
            if not any(_metin(x) == _metin(p) for x in b["secenek"]):
                farklar.append(f"{yol}: beklenen şunlardan biri (karar susuyor) {b['secenek']}, program {p!r}")
            return
        if isinstance(b, dict) and set(b) == {"kisaltilabilir"}:
            on = str(p).rstrip("…").rstrip() if isinstance(p, str) else ""
            if not on or not b["kisaltilabilir"].startswith(on):
                farklar.append(f"{yol}: beklenen {b['kisaltilabilir'][:40]!r}… ya da öneki, program {p!r}")
            return
        if isinstance(b, dict):
            if not isinstance(p, dict):
                farklar.append(f"{yol}: beklenen nesne, program {p!r}")
                return
            for k, v in b.items():
                gez(v, p.get(k, "<YOK>"), f"{yol}.{k}" if yol else k)
            return
        if b != p:
            farklar.append(f"{yol}: beklenen {b!r}, program {p!r}")
    gez(grup["sonuc"], program, "")
    return farklar


def main(argv):
    if len(argv) >= 2 and argv[0] == "hesapla":
        with open(argv[1], encoding="utf-8") as f:
            veri = json.load(f)
        liste = veri if isinstance(veri, list) else [veri]
        cikti = [{"ad": s.get("ad"), "beklenen": hesapla(s)} for s in liste]
        json.dump(cikti if isinstance(veri, list) else cikti[0], sys.stdout, ensure_ascii=False, indent=1)
        print()
        return 0
    if len(argv) >= 3 and argv[0] == "karsilastir":
        with open(argv[1], encoding="utf-8") as f:
            beklenen = json.load(f)
        with open(argv[2], encoding="utf-8") as f:
            program = json.load(f)
        farklar = karsilastir(beklenen.get("beklenen", beklenen) if isinstance(beklenen, dict) else beklenen, program)
        for f_ in farklar:
            print("FARK", f_)
        print(f"{len(farklar)} fark")
        return 1 if farklar else 0
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
