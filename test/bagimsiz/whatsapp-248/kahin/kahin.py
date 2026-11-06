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

KÂHİN GÜNCELLEMESİ 9 (01.11.2026): kullanıcının 01.11.2026 06:28 UTC onayladığı 8 davranış J1–J8 + 05:58 UTC n3 BİLİNEN SINIR (J9) — metinler AYNEN
KARARLAR'da, yorumlar README §14 (kodlamadan önce yazıldı): teslim her durumda (Meta Bekletti / iptal / durdurulmuş / başarısız / süresi dolmuş / dosyada yok /
silinmiş şirket) DENEMEYE yazılır ve R3'te sayılır; Meta Bekletti'deki ileti teslim edilince iş kapanır (2. deneme gitmez); geç failed her durumda "almadı";
Süresi Doldu son kabul edilen denemeden; "Bu Ay" teslim edilen DENEME sayısı; kanca yanıt katmanı (503: bildirim kaydedilemez / şirket geçici açılamaz /
yanıt beklenirken tanınmayan ≤ 5 dk; öbürü 200); onarım bekleyen kabul varken yeni gönderim başlamaz; Tüm Hareketler'in kişiye özel dönemi o günün
Bu Ay / Geçen Ay'ına eşitse aynı dönem; n3 (kuyruktaki ikinci iş birincinin geç tesliminden sonra da gider) BİLİNEN SINIR.
GÜNCELLEME 9b (01.11.2026 07:07 + 07:11 UTC, J10/J11): S9-1 "Gitmesin" yalnız belirsizlik onaylarında — Sonucu Belirsiz işteki Yine de Gönder (ve o zincirdeki
Başarısızları Yeniden Dene) bekleyen işte eski iletinin teslimi gelirse yeni ileti gitmez, iş "Atlandı — Daha Önce Gönderildi"; düz yeniden deneme ve R3 Yine de Gönder
kapsanmaz (ikinci kopya gider). S9-2 — Tüm Hareketler {{3}} ve PDF dönemi = ilk hareket – AÇILIŞ günü (hareketsiz: açılış – açılış); J8 kişiye özel dönem TEK okuma
(ilk – açılış günü) — README §14.10–14.11.
GÜNCELLEME 9c (07:11 seçenek metni, J12): ekstre İÇERİĞİ (ad, firma, {{3}}, bakiye, PDF, dosya adı) toplu işin AÇILIŞINDA hazırlanır, gönderim ertesi güne kaysa /
kuyrukta hareket girse / yeniden gönderilse de değişmez (§7a 1'in ekstre yorumunun yerine); telefon, eleme denetimleri ve Ödeme Hatırlatma gönderim anında;
Tüm Hareketler'e açılış gününden sonra tarihli hareket girmez — README §14.13.
GÜNCELLEME 9d (liste metni madde 7): J7 "onarım bekleyen kabul" = Meta kabul etti ama kabul GÖNDERİM DEFTERİNE yazılamadı (`defter_yazilamaz`); onarım = defter yeniden
yazılabilir olunca; eski "defterde var, şirket dosyasına yazılamadı" okuması (dosya_yazilamaz) KALKTI — README §14.15.
GÜNCELLEME 10 (2.4.9 W, KULLANICI KARARI 03.11.2026, W1): teslim süresi = Meta'nın şablon listesinde o şablon için bildirdiği değer (teslim_suresi_sn), yoksa
30 gün (+1 sa payı; son kabul edilen denemeden, J4; W2 W-KÖK + W3: etkin süre = max(KABUL ANINDAKİ, güncel)); 2.4.8'in 72 sa ayarı okunmaz; Meta API medyayı 30 günde kendisi siler (Meta'da silme sayısı yalnız 30 günü
dolmamış medyayı sayar, 30 günden eski medya yeniden kullanılmaz) — README §15.
GÜNCELLEME 11 (2.5.0, KULLANICI KARARLARI 05.11.2026 S-W1, S-W2, 18:37, 19:15, 21:08 S-W4 ve S7 — metinler AYNEN KARARLAR SW1, SW2, SD1837, SD1915, SW4, S7;
yorumlar README §16, kodlamadan önce yazıldı): n3 (kuyruktaki ikinci iş birincinin geç tesliminden sonra da gider) BİLİNEN SINIR değil KARAR; Süresi Doldu deneme 24 saatlik
farklı alıcı penceresinde sayılmaz; bağlantının süresi dolunca (`baglanti_suresi_doldu`) o şirketin süren toplu işleri Duraklatıldı, yeni gönderim başlamaz, yeniden bağlanınca
(`yeniden_baglan`) yalnız Devam Et ile kalanlara gider; Meta 190 / 0 reddinde o anda iletisi gitmeyen kişi Başarısız DEĞİL, bekleyenlere döner (bağlantı Süresi Doldu); kod 102
bugünkü gibi; şüpheli alacak kaydı açık müşteri Ödeme Hatırlatma'da `supheli_alacak` ile elenir, elle seçilirse ({{4}} şüphesiz gecikmiş tutarla) gider. Yeniden bağlanmadan
Devam Et karar metninde yok → üç okuma koşulur, ayrışan yapraklar {"secenek"} (kime / kaç kez üçünde aynı).
GÜNCELLEME 12 (2.5.0, KULLANICI KARARI 06.11.2026 03:35 UTC "hepsi A" — metinler AYNEN KARARLAR S7A, S7B; yorumlar README §17, kodlamadan önce yazıldı ve ayrı commit'lendi):
S7-a elle seçilen şüpheli alacaklı caride şüphesiz gecikmiş borç yoksa "Gecikmiş Borç Yok" ile elenir (başlatmada ve gönderim anında); S7-b toplu gönderim kuyruktayken
şüpheli alacak kaydı açılan, elle işaretsiz cari gönderim anında "Atlandı — Şüpheli Alacağı Var" (Devam Et, Başarısızları Yeniden Dene, Meta Bekletti 2. denemesi dahil);
elle işareti yalnız başlatmada etiketli cariye ve işte kalır. İşteki Yine de Gönder + kuyrukta açılan şüpheli kaydı (S7-c) KULLANICIYA SORULMALI — kâhin hata verir.
GÜNCELLEME 13 (2.5.0, KULLANICI KARARI 06.11.2026 04:50 UTC "hepsine A" S16, S17 + 05.11 21:30 karar (5) — metinler AYNEN KARARLAR S16, S17, NB5; yorumlar README §18, kodlamadan önce
yazıldı ve ayrı commit'lendi): S16 işteki Yine de Gönder basıldığı anda şüpheli kaydı açık Ödeme Hatırlatma işi elle seçim sayılır (onay penceresinde "Şüpheli Alacağı Var" —
`yeniden.<etiket>.supheli_etiketi`), şüphesiz tutarla gider, yoksa elenir (anı karar metninde yok → `s16_an` iki okuma, `secenek`); (5) Ödeme Hatırlatma {{4}} net borcu aşmaz, net borcu
≤ 0 olan elenir (ad karar metninde yok → `secenek` gecikmis_borc_yok / net_borc_yok); S17 elle seçilen şüpheli alacaklıda sınır şüpheli kalemler HARİÇ net borç. S7-c hatası daraldı:
basma anında kaydı YOKKEN sonra açılan (S7-d) KULLANICIYA SORULMALI — kâhin hata verir.
GÜNCELLEME 14 (2.5.0, KULLANICI KARARI 06.11.2026 05:30 UTC "a" — S22, metin AYNEN KARARLAR S22; yorumlar README §19, kodlamadan önce yazıldı ve ayrı commit'lendi): S7-d KAPANDI —
işteki Yine de Gönder (ya da o zincirdeki Başarısızları Yeniden Dene) ile gönderime alınmış, basma anında şüpheli kaydı OLMAYAN (elle işaretsiz) Ödeme Hatırlatma işinde gönderim anında
kayıt açıksa S7-b gibi "Atlandı — Şüpheli Alacağı Var" (`supheli_alacak`; Sınır, Devam Et, zincirdeki yeniden deneme, Meta Bekletti 2. denemesi); yol: kayıt açıkken asıl işte yeniden
Yine de Gönder → S16 (elle, şüphesiz tutarla). Bekleyen ileti varken kayıt açıkken yeniden basma (S7-e: S22 ↔ F1) KULLANICIYA SORULMALI — kâhin hata verir.
GÜNCELLEME 15 (2.5.0, KULLANICI KARARLARI 06.11.2026 06:03 UTC "a" — S23 — ve 05.11.2026 ~16:48 S-W3; metinler AYNEN KARARLAR S23, SW3; yorumlar README §20, kodlamadan önce yazıldı ve
ayrı commit'lendi): S7-e KAPANDI — belirsizlik onayıyla gönderim anından ÖNCE bekleyen, elle işaretsiz Ödeme Hatırlatma işinde kayıt açıkken asıl işte yeniden Yine de Gönder → bekleyen iş S16
ile elle sayılır (yanıtta `elle_sayilan`, etiket), yeni iş / deneme açılmaz, F1 "Zaten Kuyrukta" bu durumda uygulanmaz, gönderim anında şüphesiz tutarla gider (basmada şüphesiz tutar yoksa
S16 anının iki okuması `s23_an` — `secenek`; okumalar kime / kaç kez ayrışırsa S23-a KULLANICIYA SORULMALI). S-W3: gönderim kaydının içeriği, telefonu ve PDF'i işin son gönderim denemesinden
1 takvim yılı sonra (yerel an) ya da silme talebinde (`kvkk_sil`) hemen silinir (`icerik_silindi`); tarih, dönem, cari kimliği, şablon adı + sonuç anonim iz kalır → R3 / Sonucu Belirsiz /
"Bu Ay" aynen; telefon gönderim anında karttan (silinen telefon kullanılmaz); geri yüklenen işe aynı süre kuralı. Bekleyen / belirsiz işte silme (S-W3-a), silinmiş Ekstre'nin yeniden
gönderimi (S-W3-b) KULLANICIYA SORULMALI — kâhin hata verir; talepten önceki yedeğin geri yüklenmesinde içerik (S-W3-c) `plan_susuyor`.
GÜNCELLEME 16 (2.5.0, KULLANICI KARARI 06.11.2026 06:52 UTC "a" — S29–S32 hepsi A; metinler AYNEN KARARLAR S29, S30, S31, S32; yorumlar README §21, kodlamadan önce yazıldı ve ayrı
commit'lendi): S29 (S23-a) KAPANDI — S23 yeniden basmasında şüphesiz tutar yoksa da bekleyen iş elle sayılır, gönderim anındaki şüphesiz tutarla gider (`s23_an` kalktı; yoksa "Gecikmiş Borç
Yok"). S30 (S-W3-a) KAPANDI — silme talebi / 1 yıl dolumu anında bekleyen iş gönderilmez (içerik + telefon silinir; kapanma anı iki okuma `s30_an`: anında "Atlandı" / gönderim anında; ayrıştığı
sıra S30-a KULLANICIYA SORULMALI), Sonucu Belirsiz iş iz olarak kalır ve aynı dönemde eler. S31 (S-W3-b) KAPANDI — içeriği silinmiş Ekstre işi aynı iş üzerinden yeniden gönderilemez (`elenen`
`icerik_silindi`), Ödeme Hatırlatma'daki karşılığı S31-a KULLANICIYA SORULMALI (kâhin hata verir). S32 (S-W3-c) KAPANDI — silme talebi kaydı makinede (şirket + cari + an) kalır, geri
yüklemeden sonra yeniden uygulanır (talepten önce yazılmış içerik / telefon gelmez); başka bilgisayarda (S32-a) `plan_susuyor`.
GÜNCELLEME 17 (2.5.0, KULLANICI KARARLARI 06.11.2026 08:06 UTC "a" — S34–S38 öneriler (S37 = B) — ve 07:00 S33, 08:08 S41; metinler AYNEN KARARLAR S34, S35, S36, S37, S38, S33, S41; yorumlar
README §22, kodlamadan önce yazıldı ve ayrı commit'lendi): S34 (S29-a) KAPANDI — S16 ilk Yine de Gönder'inde şüphesiz tutar yoksa da iş ALINIR (elle), gönderim anındaki tutarla gider, yoksa
"Atlandı — Gecikmiş Borç Yok" (`s16_an` kalktı). S35 (S30-a) KAPANDI — silme talebi (ve 1 yıl dolumu — README Y17-6) anında bekleyen iş O ANDA "Atlandı — Silme Talebi", kuyruktan çıkar
(`s30_an` kalktı). S36 (S30-b) — içeriği silinmiş Sonucu Belirsiz Ekstre'de aynı dönem yolu yok (hesap aynen). S37 (S31-a = B) — içeriği silinmiş Ödeme Hatırlatma aynı iş üzerinden yeniden
gönderilir, içerik gönderim anında karttan. S38 (S32-a) — silme talebi kayıtları taşımada yeni bilgisayara gider ve orada uygulanır. S33 / S41 — yeni girdi `ayar.baglanti_yolu` (yol1 / yol2;
yoksa yol2) ve kanca `adres` (alternatif / uygulama): Yol 2'de işareti ve işlemeyi yalnız imzalı bildirim, Yol 1'de imzasız bildirim kabul; uygulama düzeyi adrese gelen bildirim aynı kurallarla.
Gönderiliyor anında talep (S35-a) ve tanınmayan iletiye ait bildirimin işareti (S33-a) KULLANICIYA SORULMALI.

KÂHİN GÜNCELLEMESİ 8 (31.10.2026): H1 (kullanıcı) — Yine de Gönder ile açılan iş kabul/teslim edilince KAYNAK Sonucu Belirsiz deneme o kişi için artık
elemez (kişi "Daha Önce Gönderildi"; yol R3 Yine de Gönder); açılan iş başarısız/belirsiz kalırsa kaynak elemeye devam eder. H2–H4 (baş mimar, G0 İLKEYLE):
taşımada "Gönderiliyor" kalan iş Sonucu Belirsiz; iş dosyada yokken gelen İMZALI geç kabul/teslim defterdeki sonucu belli olmayan son deneme için sayılır;
R3 "son gönderim" = son kabul/teslim edilen denemenin anı — README §13.

KÂHİN GÜNCELLEMESİ 7 (31.10.2026): G6 (baş mimar, G0 (3) İLKEYLE) — Son 3 Ay / Tüm Hareketler'in o günkü tarihleri özel aralığa birebir eşitse aynı dönem
(iki yön; 7 gün penceresi bu eşlikte de). Son 3 Ay'ın tarih uçları karar metninde yok → G0 (3) gereği kâhinin dört okumasından BİRİ eşitse; Tüm Hareketler = kişinin
ilk hareketi – o gün (baş mimar KAYIT'ı) — README §12.

KÂHİN GÜNCELLEMESİ 6 (31.10.2026): G0 genel ilke (kesin almadıysa sayılmaz / almış olabilirse Sonucu Belirsiz / aldıysa aynı dönemde elenir, şüphede aynı
dönem / çıkmaz yok / taşınan-geri yüklenen veride aynı kurallar) + G1 "o gün" = toplu işin (yeniden denemede asıl işin) açıldığı gün, G2 D4'ün iki okuması BİRLİKTE
(hazır seçimin o günkü tarihleri + kendi günlerinde Bu Ay'a eşit özel aralıklar), G3 taşınan veride dosyadaki belirsiz eler, G4 sıfırlama ile duran Meta Bekletti
sayılmaz, G5 Meta Bekletti sonrası belirsiz eler. G0 ile çözülen yerler kodda "İLKEYLE".

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
ONARIM = "onarim_bekleyen_kabul"                      # J7 (Y9e-1/2): kabulü gönderim defterine yazılamamış deneme varken yeni gönderim başlamaz (baslamadi nedeni)
SURE_DOLDU_NEDEN = "baglanti_suresi_doldu"            # SD1837 (Y11-8/11): bağlantının süresi doldu — toplu işin durma nedeni + başlatma reddi nedeni (kâhin adı)
DURDU_BAGLANTI = "Durduruldu (Bağlantı)"              # yalnız M189 (P6 §3 madde 3'ün 18:37 öncesi notu: Durduruldu + Yine de Gönder)
SUPHELI = "supheli_alacak"                            # S7 (Y11-18): elenme nedeni ("Şüpheli Alacağı Var" etiketi)
BELIRTEC_KODLARI = {190, 0}                           # SD1915 (190) + SW4 (0 "190 gibi"); 102 kararın DIŞINDA (Y11-15)
DEVAM_OKUMALARI = ("ret", "bekle", "dene")            # yeniden bağlanmadan Devam Et'in üç okuması (README §16.4) — ilki model, öbürleri seçenek
# güncelleme 15'in S23_OKUMALARI ("gonderim", "basma") güncelleme 16'da KALKTI: S29 = A 'gonderim' okumasını kesinleştirdi, 'basma' S29'un B seçeneğidir (M223) — README §21 Y16-3
# güncelleme 13'ün S16_OKUMALARI ("basma", "gonderim") güncelleme 17'de KALKTI: S34 = A 'gonderim' okumasını kesinleştirdi, 'basma' S34'ün B seçeneğidir (M236) — README §22 Y17-3
# güncelleme 16'nın S30_OKUMALARI ("aninda", "gonderimde") güncelleme 17'de KALKTI: S35 = A 'aninda' okumasını kesinleştirdi, 'gonderimde' S35'in B seçeneğidir (M238) — README §22 Y17-7
OKUMALAR = {"devam_sd": DEVAM_OKUMALARI}
BAGLANTI_YOLLARI = ("yol2", "yol1")                   # güncelleme 17 (README §22 Y17-24): ayar.baglanti_yolu — ilki varsayılan (eski senaryolar: imza kapıcıda doğrulanır)
S30_BEKLEYEN = {BEKLIYOR, SINIR, DURAKLATILDI, LISANS, SORULUYOR, BEKLEME_131049, HAZIRLANIYOR}   # S30 (Y16-9): isteği henüz gitmemiş bekleyen iş (zincir dahil)
SILME_NEDEN = {"talep": "silme_talebi", "sure": "saklama_suresi"}   # S30 (Y16-10) + S35 (Y17-7): bekleyen işin atlanma nedeni — "Atlandı — Silme Talebi" (S35 metni); 1 yıl adı kâhinin
ICERIK_SILINDI = "icerik_silindi"                     # S31 (Y16-17): içeriği silinmiş Ekstre işinin yeniden gönderiminde elenme nedeni (kâhin adı — "neden görünür")
NET_BORC_YOK = "net_borc_yok"                         # güncelleme 13 (Y13-7): karar (5) "bize alacaklı" / S17 net sınırı elemesinin olası ikinci adı (karar metninde ad yok)
TANINMAYAN_503 = 5 * 60 * 1000                        # J6: yanıt beklenirken tanınmayan bildirime en çok 5 dk 503
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
KAPANDI_TESLIMSIZ = {BASARISIZ, IPTAL, DURDU_GERI_YUKLEME, TASINAN}
BEKLETTI_BEKLEYEN = {BEKLEME_131049, DURAKLATILDI, LISANS, SORULUYOR, BEKLIYOR, SINIR}   # J2 + Y9-7: Meta Bekletti iletisi henüz yeniden gönderilmemiş
YENIDEN_BEKLEYEN = {BEKLIYOR, SINIR, DURAKLATILDI, LISANS, SORULUYOR, HAZIRLANIYOR}       # J10 (Y9c-1/2): yeni denemesi henüz istek olarak gitmemiş iş   # K3/K7: teslim olmadan kapanan iş (geç teslim gelirse "Daha Önce Gönderildi" sayılır)
S23_BEKLEYEN = {BEKLIYOR, SINIR, DURAKLATILDI, LISANS, SORULUYOR, BEKLEME_131049}        # S23 (Y15-1): gönderim anından ÖNCE bekleyen iş (Hazırlanıyor / Gönderiliyor gönderim anını geçti — F1 aynen)
PDF_SUSUYOR = {IPTAL, DURDU_GERI_YUKLEME, TASINAN}    # §11 S3 yalnız teslim / başarısız / süresi doldu'yu sayar → bu durumlarda PDF silinmesi PLAN SUSUYOR

# Plan §6 W2 + §7a 12 hata sınıfları
DURAKLATAN = {0, 190, 10, 131005, 368, 131031, 131042, 133010, 131045, 132001, 132000, 132012, 132018, 132007, 132015, 132016}
DURAKLATAN_ARALIK = range(200, 300)
ALICI = {131026, 131021, 131009}
GECICI = {131000, 131016, 130429, 80007, 4, 131057, 1, 2, 133004}   # §7a 12, 15 + R1: Meta'nın YANIT verdiği geçici hatalar (bağlantı yok → R1 beklemesi)
SINIR_KODLARI = {131048}                                                       # §7a 12 → madde 30
GECICI_DIZI = (30 * SN, 2 * DK, 15 * DK)                                        # §7a 15: 30 sn → 2 dk → 15 dk, sonra Başarısız
ICERIK_SABLON = {"ekstre": "destekofis_ekstre", "hatirlatma": "destekofis_odeme_hatirlatma"}
TTL_VARSAYILAN = 30 * GUN   # W1 (KULLANICI KARARI 03.11.2026, W §15): Meta listesinde değer yoksa 30 gün (Meta varsayılanı; program TTL göndermez/düzenlemez)
TTL_ESKI_248 = 72 * SA      # 2.4.8'in teslim süresi (§11 S2 A "3 gün"; ttlHours 72) — 2.4.9'da OKUNMAZ (yalnız M7, W1 Y10-4)
TTL_PAYI = 1 * SA           # §6 W2 + §7a 16 "TTL + 1 sa"; W §15 "(+1 sa)" (Y10-2)
MEDYA_OMRU = 30 * GUN       # Meta belgesi: API medya kimliği 30 gün (sahte Meta medyaOmruMs) — Y10-7
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
    "M7": "W1 (Y10-4): Meta bildirmezse 2.4.8'in 72 sa teslim süresi (ttlHours / eski varsayılan) kullanılır — 30 gün yerine (eski M7'nin TERSİ)",
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
    "M58": "telefon (ve hatırlatma verisi) gönderimde değil başlatmada okunur — güncelleme 9c: ekstre içeriğinin açılışta hazırlanması artık doğru model (M163)",
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
    # ---- kâhin güncellemesi 6 (31.10.2026, G0 genel ilke + G1–G5) ----
    "M120": "G2: hazır seçimin o günkü tarihleri eşliğe girmez (03.11 Bu Ay ↔ 05.11 özel 01.11–03.11 eşleşmez)",
    "M121": "G2: kendi günlerinde Bu Ay'a eşit iki farklı özel aralık aynı dönem sayılmaz",
    "M122": "G1: özel aralığın / hazır seçimin 'o gün'ü gönderim günü (toplu işin açıldığı gün değil; sınırla ertesi güne kayan başka dönem)",
    "M123": "G2: hazır seçimin 'bugün'ü UTC'ye göre (gece yarısı yerel ≠ UTC)",
    "M124": "G3: taşınan veride şirket dosyasındaki Sonucu Belirsiz sayılmaz (yalnız yeni bilgisayarın defteri)",
    "M125": "G4: Şirket Verisini Sıfırla ile durmuş teslimsiz Meta Bekletti 'Daha Önce Gönderildi' sayılır",
    "M126": "G5: Meta Bekletti sonrası 2. denemesi Sonucu Belirsiz kalan kişi elenmez",
    "M127": "G0 (1, 4): asıl işte Başarısız, sonraki denemesi teslimsiz duran (Durduruldu / Taşınan / İptal / Süresi Doldu) kişi asıl işten yeniden gönderilmez",
    "M128": "G0 (4): işteki Yine de Gönder yalnız ŞU AN Sonucu Belirsiz duran işte (asıl işte belirsiz kalan denemenin yolu yok — çıkmaz)",
    # ---- kâhin güncellemesi 7 (31.10.2026, G6 — baş mimar, G0 (3) İLKEYLE) ----
    "M129": "G6: Son 3 Ay / Tüm Hareketler ile o günkü tarihlerine birebir eşit özel aralık eşleşmez",
    "M130": "G6: Son 3 Ay / Tüm ↔ özel aralık çapraz eşliğinde 7 gün penceresi yok",
    "M131": "H1: Yine de Gönder ile açılan işin kabul/teslimi kaynak Sonucu Belirsiz denemeyi çözmez (D6 gibi elemeye devam eder)",
    "M132": "H1: Yine de Gönder kaynak belirsizi açılan işin SONUCUNA bakmadan çözer (başarısız/belirsiz kalsa da)",
    "M133": "H2: taşımada Gönderiliyor kalan iş 'Taşınan Veri — Durduruldu' olur (Sonucu Belirsiz değil)",
    "M134": "H3: iş şirket dosyasında yokken gelen imzalı geç kabul/teslim yok sayılır",
    "M135": "H4: R3 'son gönderim' tarihi SAYILMAYAN (başarısız) denemeler dahil son denemenin anı",
    "M136": "H4: R3 'son gönderim' tarihi UTC günüyle yazılır (yerel gün değil)",
    # ---- kâhin güncellemesi 9 (01.11.2026, J1–J9) ----
    "M137": "J1 + Y9-7: Meta Bekletti'den Duraklatıldı / Lisans / Bekliyor'a geçmiş işte teslim yok sayılır (iş kapanmaz, 2. deneme gider)",
    "M138": "J1 + J5: dosyada olmayan işin (yedeğe dönüş / silinmiş şirket) geç teslimi 'Bu Ay'a girmez (güncelleme 8 yorum 5)",
    "M139": "J2: Meta Bekletti'deki iletinin teslimi yok sayılır (iş kapanmaz, 24 sa sonraki 2. deneme gider)",
    "M140": "J3: dosyada olmayan işin wamid'i bilinen kabulüne gelen geç failed yok sayılır (kabul 'Daha Önce Gönderildi' sayılmaya devam eder)",
    "M141": "J4: Süresi Doldu ilk kabul edilen denemeden ölçülür",
    "M142": "J5: 'Bu Ay' iş başına bir teslim sayar (deneme başına değil; dosyada olmayan işin teslimi de girmez)",
    "M143": "J6: yanıt beklenirken tanınmayan bildirim 200 ile düşürülür (Meta yinelemez, bildirim kaybolur)",
    "M144": "J6: şirket geçici açılamazken bildirim 200 ile düşürülür",
    "M145": "J6: bildirim kaydedilemezken 200 (bildirim kaybolur)",
    "M146": "J6: silinmiş (kalıcı) şirketin bildirimine 503 (Meta boşuna yineler; teslim yazılmaz)",
    "M147": "J7: defterde onarım bekleyen kabul varken yeni gönderim başlar",
    "M148": "J8: Tüm Hareketler'in kişiye özel dönemi Bu Ay / Geçen Ay ile hiç eşleşmez",
    "M150": "J8: Tüm Hareketler'de 'o günün Bu Ay'ı' kanonu yok (yalnız Bu Ay / Geçen Ay gönderiminin kendi günündeki tarih eşliği)",
    "M151": "SW1'in tersi (n3 A seçeneği; J9 artık KARAR): gönderimden hemen önce R3 bir kez daha denetlenir — kuyruktaki ikinci iş birincinin teslimiyle elenir",
    "M152": "J1 + Y9-5: dosyadaki işin aşılmış (Yine de Gönder ile geride kalmış) belirsiz denemesine iş kimliğiyle gelen geç bildirim düşer (eski kâhin)",
    "M153": "J3 + Y9-5: eski denemenin geç failed'ı işin ŞU ANKİ (kabul edilmiş) denemesini Başarısız yapar",
    # ---- kâhin güncellemesi 9b (01.11.2026 07:07 + 07:11 UTC, J10 = S9-1, J11 = S9-2; M149 kalktı — S9-3 tek okuma artık doğru model) ----
    "M154": "J10 (S9-1 a): Sonucu Belirsiz işteki Yine de Gönder bekleyen işte eski iletinin teslimi yeni iletiyi durdurmaz",
    "M155": "J11 (S9-2): Tüm Hareketler {{3}} bitişi son hareket tarihi (açılış günü değil)",
    "M156": "J11 + J8: hareketsiz caride Tüm Hareketler'in dönemi yok (eşleşmez — eski Y9-18)",
    "M157": "J11 + S9-3: kişiye özel dönemin 'ilk – son hareket' okuması da eşleşir (S9-2 öncesi birleşim)",
    "M158": "J11 (07:11): Tüm Hareketler {{3}} bitişi iletinin GERÇEKTEN gönderildiği gün (açılış günü değil)",
    "M159": "J11 + Y9c-7: Tüm Hareketler eşliğine gerçek gönderim günü de girer (düşen Y9b-4 birleşimi)",
    "M160": "J10 (07:11 c): belirsizlik zinciri dışındaki düz Başarısızları Yeniden Dene de durdurulur (düşen Y9b-2 İLKEYLE)",
    "M161": "J10 (07:11 b): R3 uyarısına rağmen bilerek seçilen Yine de Gönder de önceki işin teslimiyle durdurulur",
    "M162": "J11 (07:11 'metin PDF ile aynı'): Tüm Hareketler PDF'inde dönem uçları yok (eski: None)",
    # ---- kâhin güncellemesi 9c (07:11 seçenek metni, J12) ----
    "M163": "J12: ekstre içeriği GÖNDERİM ANINDA okunur (§7a 1'in eski ekstre yorumu; açılışta hazırlanmaz)",
    "M164": "J12 + Y9d-3: Tüm Hareketler içeriğine açılış gününden sonra tarihli hareket girer (eski 'bütün hesap')",
    # ---- kâhin güncellemesi 9d (J7 düzeltmesi, liste metni madde 7) ----
    "M165": "J7 (Y9e-2): defter yeniden yazılabilir olunca eksik kabul onarılmaz (yeni gönderim düğmesi pasif kalır)",
    # ---- kâhin güncellemesi 10 (2.4.9 W, KULLANICI KARARI 03.11.2026: teslim süresi 30 gün) ----
    "M166": "W1 (Y10-1): Meta'nın şablon listesinde bildirdiği teslim süresi yok sayılır (hep 30 gün)",
    "M167": "W1 (Y10-2): 1 saatlik pay yok — Süresi Doldu tam süre dolunca (30. günde)",
    "M168": "W1 (Y10-7): Meta medyayı 30 günde silmez — 30 günden eski PDF'in kesinleşmede silinmesi Meta'da sayılır",
    "M169": "W1 (Y10-8): bir şablonda bildirilen teslim süresi bütün şablonlara uygulanır (şablon başına değil)",
    "M170": "W2 (W-KÖK, Y10-10): teslim süresi kabul anındaki değerden değil Meta'nın GÜNCEL listesinden (sonradan kısalan süre önceden kabul edilmiş işe uygulanır)",
    "M171": "W3 (S10-6, Y10-14): yalnız kabul anındaki süre — sonradan UZAYAN süre önceden kabul edilmiş işe uygulanmaz (max yok; S10-6'nın A okuması)",
    # ---- kâhin güncellemesi 11 (2.5.0, 05.11.2026: SW1, SW2, SD1837, SD1915, SW4, S7) ----
    "M172": "SD1915: Meta 190 / 0 alan kişi Başarısız (Başarısızları Yeniden Dene — 19:15 öncesi düzen; bağlantı durumu yok)",
    "M173": "SW4: Meta 0 (AuthException) alan kişi Başarısız, bağlantı Süresi Doldu olmaz (S-W4 öncesi; yalnız 190 belirteç reddi)",
    "M174": "SD1915 + SD1837: belirteç reddinde (190 / 0) toplu iş duraklamaz — işçi kalan kişilere de istek gönderir (her biri reddedilir)",
    "M175": "SD1837: program bağlantının süresinin dolduğunu bildiği hâlde toplu işi duraklatmaz; Meta'nın 190 reddine kadar göndermeyi dener",
    "M176": "SD1837: yeniden bağlanınca duran toplu iş Devam Et beklemeden kendiliğinden sürer",
    "M177": "SD1837 'kimseye ikinci ileti gitmez': Devam Et teslimi beklenen (Meta Kabul Etti / Gönderildi) kişilere de yeniden gönderir",
    "M178": "SW2: Süresi Doldu ileti 24 saatlik farklı alıcı penceresinde sayılır (A seçeneği — eski kâhin)",
    "M179": "P6 W-1 (a): bağlantı Süresi Doldu iken yeni toplu gönderim başlar",
    "M180": "SW4: kod 102 de 190 gibi işlenir (karar dışı)",
    "M181": "S7: şüpheli alacak kaydı açık cari seçimde elenmez — şüphesiz kısım gider (S7'nin B seçeneği)",
    "M182": "S7: elle seçilen şüpheli alacaklı caride {{4}} şüpheli tutarı da içerir",
    "M183": "S7: elle seçilen şüpheli alacaklı cari de elenir (elle seçim yolu yok — çıkmaz)",
    "M184": "SD1915: PDF yüklemesinde 190 / 0 alan kişi Başarısız (yalnız ileti isteğinde bekleyenlere döner)",
    "M185": "SD1915: 190 / 0 alan kişi Sonucu Belirsiz sayılır (almış olabilir) — bekleyenlere dönmez",
    "M186": "SD1915 + J2: Meta Bekletti 2. denemesi 190 ile reddedilip beklerken 1. iletinin teslimi işi kapatmaz (2. deneme yine gider)",
    "M187": "SW2: Süresi Doldu olan alıcı pencereden tümüyle düşer (aynı alıcının sayılan başka kabulü olsa da)",
    "M188": "SD1915: 190 / 0 ile reddedilen deneme 'Daha Önce Gönderildi' sayılır (kesin gitmedi sayılmaz)",
    "M189": "SD1837 öncesi plan notu (P6 §3 madde 3): süre dolunca bekleyen işler 'Durduruldu', Devam Et ile sürmez",
    # ---- kâhin güncellemesi 12 (2.5.0, 06.11.2026 03:35 UTC: S7A, S7B) ----
    "M190": "S7A'nın tersi (S7-a B seçeneği): elle seçilen şüpheli alacaklı caride şüphesiz gecikmiş borç yokken başlatmada elenmez, ileti yine gider",
    "M191": "S7A (Y12-2): elle seçilen şüpheli caride şüphesiz gecikmiş borç yalnız başlatmada denetlenir — kuyrukta kapanırsa gönderim anında ileti yine gider",
    "M192": "S7B'nin tersi (S7-b B seçeneği): kuyruktayken şüpheli alacak kaydı açılan elle seçilmemiş cari başlatmadaki seçimle gider (şüphesiz tutarla)",
    "M193": "S7B (Y12-8): elle işareti Devam Et / Başarısızları Yeniden Dene'ye taşınmaz — elle seçilmiş şüpheli cari de gönderim anında atlanır",
    "M194": "S7B (Y12-7, Y11-17): şüpheli işaretli kalem kalanı 0 olsa da kayıt açık sayılır (kuyrukta kapanan kayıt da atlatır)",
    "M195": "S7B (Y12-4): Meta Bekletti 2. denemesi gönderim anı sayılmaz — kuyrukta şüpheli açılan cariye 2. deneme gider",
    "M196": "S7B (Y12-5, ilke 1/4): 'Şüpheli Alacağı Var' ile atlanan iş 'Zaten Kuyrukta' sayılır — yeni gönderimde elle seçilen de elenir (çıkmaz)",
    "M197": "S7B (Y12-6): gönderim anında 'Gecikmiş Borç Yok' denetimi şüpheli denetiminden ÖNCE (başlatma sırasının tersi)",
    "M198": "S7A + §7a 20 (Y12-1): 'vadesi geçmiş' bugünü UTC günüyle (yerel gün değil)",
    # ---- kâhin güncellemesi 13 (2.5.0, 06.11.2026 04:50 UTC: S16, S17 + 05.11 21:30 karar (5) = NB5) ----
    "M199": "S16'nın tersi (B seçeneği): işteki Yine de Gönder elle seçim sayılmaz — şüpheli kaydı açık kişi gönderim anında 'Atlandı — Şüpheli Alacağı Var' (o gün yol kalmaz)",
    "M200": "S16 'yoksa elenir'in tersi: Yine de Gönder ile elle sayılan caride şüphesiz tutar yokken de iş alınır ve ileti gider (gecikmiş denetimi atlanır)",
    "M201": "S16: Yine de Gönder onay penceresinde 'Şüpheli Alacağı Var' etiketi yok",
    "M202": "S17'nin tersi (B seçeneği): elle seçilen şüpheli alacaklı caride sınır carinin TOPLAM net borcu (şüpheli kalemler dahil)",
    "M203": "S17 (Y13-8): net borçtan yalnız vadesi geçmiş şüpheli kalemler düşülür (vadesi gelmemiş şüpheli kalem net borçta kalır)",
    "M204": "NB5'in tersi (eski §7a 20): gecikmiş tutar net borçla sınırlanmaz, bize alacaklı kişi elenmez",
    "M205": "NB5 (Y13-7): yalnız net borç < 0 elenir — net borcu 0 olan kişiye 0,00 TL'lik hatırlatma gider",
    "M206": "NB5 (Y13-6/7): net borç yalnız başlatmada denetlenir — kuyrukta bize alacaklı olan kişiye gönderim anında yine gider",
    "M207": "NB5 (Y13-7 sırası): net denetimi §7a 20 kalem denetiminden ÖNCE — vadesi geçmiş kalemi olmayan alacaklı kişi de net adıyla elenir",
    "M208": "S16 tetiği (Y13-1): basma anında kalanı 0 olan (kapanmış) şüpheli kalem de 'Şüpheli Alacağı Var' sayılır (etiket + elle)",
    "M209": "S16 (Y13-4 + Y12-9): onay penceresinin etiketi Ekstre işinde de görünür",
    # ---- kâhin güncellemesi 14 (2.5.0, 06.11.2026 05:30 UTC: S22 = eski S7-d) ----
    "M210": "S22'nin tersi (B seçeneği): işteki Yine de Gönder kişiye özel onaylı seçim — basmada kayıt yokken sonra açılan işte de elle sayılır, gönderim anında şüphesiz tutarla gider",
    "M211": "S22 (Y14-2): atlama etiketi yanlış ad — belirsizlik onayı işinde 'Şüpheli Alacağı Var' yerine J10'un 'Daha Önce Gönderildi'si",
    "M212": "S22 yolu (Y14-4): Atlandı — Şüpheli Alacağı Var işin asıl işten yeniden Yine de Gönder'inde S16 uygulanmaz (elle sayılmaz) — kayıt açık kişi yine atlanır (çıkmaz)",
    # ---- kâhin güncellemesi 15 (2.5.0, 06.11.2026 06:03 UTC: S23 = eski S7-e; 05.11.2026 ~16:48 S-W3) ----
    "M213": "S23'ün tersi (B seçeneği): F1 aynen — kayıt açıkken bekleyen işte yeniden basma 'Zaten Kuyrukta' ile elenir, iş elle sayılmaz; gönderim anında S22 ile 'Atlandı — Şüpheli Alacağı Var'",
    "M214": "S23 'yeni iş açılmaz'ın tersi: yeniden basma asıl işten yeni bir iş açar (elle) ve bekleyen iş de elle sayılır — ikisi de gider (aynı kişiye ikinci ileti)",
    "M215": "S-W3 'anonim iz kalır'ın tersi (B seçeneği): silinen kaydın izi de silinir — R3 / Sonucu Belirsiz görmez, aynı dönemde ikinci ileti uyarısız gider",
    "M216": "S-W3 (Y15-13): saklama sınırı bir gün geç (1 yıl + 1 gün)",
    "M217": "S-W3 (Y15-13): saklama sınırı bir gün erken (1 yıl − 1 gün)",
    "M218": "S-W3 (Y15-16): silinen telefon yeniden kullanılır — kart telefonu boşsa kişinin silinmiş gönderim kaydındaki telefona gider",
    "M219": "S-W3 (Y15-15): silme talebi içeriği / telefonu / PDF'i silmez (yalnız süre dolunca silinir)",
    "M220": "S-W3 (Y15-13): 1 yıl UTC gününe göre — kaydın UTC günü + 1 yıl, o UTC gününün başında silinir (yerel an değil)",
    "M221": "S-W3 (Y15-17): silme talebinden sonra o kişinin teslimleri 'Bu Ay'dan düşer",
    "M222": "S-W3 (Y15-18, ilke 5): geri yüklenen işe saklama kuralı uygulanmaz — 1 yıldan eski içerik yedekten geri gelir ve kalır",
    # ---- kâhin güncellemesi 16 (2.5.0, 06.11.2026 06:52 UTC: S29 = eski S23-a, S30 = S-W3-a, S31 = S-W3-b, S32 = S-W3-c) ----
    "M223": "S29'un tersi (B seçeneği): yeniden basmada şüphesiz tutar yoksa iş elle sayılmaz (yanıtta 'Gecikmiş Borç Yok' ile elenir) — gönderim anında S22 'Atlandı — Şüpheli Alacağı Var'",
    "M224": "S29 (Y16-2/4) zaman sınırı: şüphesiz tutar yeniden basma anının gününe göre sabitlenir — gönderim anına kadar vadesi geçen kalem sayılmaz ('Gecikmiş Borç Yok')",
    "M225": "S30'un tersi (B seçeneği): silme talebi / 1 yıl dolumu anında bekleyen iş karttaki güncel bilgiyle gider (silme yalnız geçmiş kayıtları kapsar)",
    "M226": "S30 'Sonucu Belirsiz izi kalır'ın tersi: silmede belirsiz denemenin izi de gider — aynı dönemde yeni gönderim 'Sonucu Belirsiz' ile elenmez",
    "M227": "S30 (Y16-9) bekleyen kümesi: Meta Bekletti iş bekleyen sayılmaz — 2. deneme karttaki bilgiyle gider",
    "M228": "S30 (Y16-9) bekleyen kümesi: Duraklatıldı / Lisans Nedeniyle Durdu / açılışta sorulan iş bekleyen sayılmaz — Devam Et'te karttaki bilgiyle gider",
    "M229": "S30 (Y16-14): 1 yıl kuralı yalnız içeriği yazılmış işe — içeriği hiç yazılmamış bekleyen (Ödeme Hatırlatma) iş 1 yıl sonra Devam Et'te gider",
    "M230": "S31'in tersi (B seçeneği): içeriği silinmiş Ekstre işi yeniden gönderilir — içerik açılış günü verisiyle yeniden üretilip gider",
    "M231": "S31 (Y16-16) yol sınırı: yalnız Başarısızları Yeniden Dene kapalı — işteki Yine de Gönder içeriği silinmiş (Sonucu Belirsiz) Ekstre'yi yeniden üretip gönderir",
    "M232": "S32'nin tersi (B seçeneği): geri yüklemede silme talebi yeniden uygulanmaz — talepten önceki yedekten içerik / telefon geri gelir",
    "M233": "S32 (Y16-22) zaman sınırı: yeniden uygulamada talepten SONRA yazılmış içerik de silinir",
    "M234": "S32 (Y16-20): silme talebi kaydı şirket dosyasında (yedekle birlikte) — talepten önceki yedek geri yüklenince kayıt da kaybolur, sonraki geri yüklemelerde de uygulanmaz",
    "M235": "S31 'neden görünür'ün tersi: içeriği silinmiş Ekstre işi yeniden gönderime sessizce alınmaz — kişi yanıtta ne alınan ne elenen listesinde",
    # ---- kâhin güncellemesi 17 (README §22): S34, S35, S36, S37, S38, S33, S41 ve Yol 1 — her kararın karşı seçeneği + sınır kaymaları
    "M236": "S34'ün tersi (B seçeneği): ilk Yine de Gönder'de şüphesiz tutar yoksa kişi basmada 'Gecikmiş Borç Yok' ile elenir, iş Sonucu Belirsiz kalır (eski s16_an 'basma' okuması)",
    "M237": "S34 (Y17-2/4) zaman sınırı: ilk Yine de Gönder'de tutar yoksa şüphesiz tutar basma anının gününe göre sabitlenir — gönderim anına kadar vadesi geçen kalem sayılmaz",
    "M238": "S35'in tersi (B seçeneği): silme talebinde bekleyen iş gönderim anına kadar kuyrukta sayılır ('Zaten Kuyrukta'), kendi gönderim anında atlanır",
    "M239": "S35 (Y17-8) sınır: talep anında kapanan ('Atlandı — Silme Talebi') iş 'Zaten Kuyrukta' sayılır — aynı dönem yeni gönderim elenir",
    "M240": "S35 (Y17-6) kapsam: anında kapanma yalnız silme talebinde — 1 yıl dolumunda bekleyen iş gönderim anına kadar kuyrukta kalır",
    "M241": "S36'nın tersi (B seçeneği): içeriği silinmiş Sonucu Belirsiz Ekstre'nin kişisi yeni gönderimde 'Sonucu Belirsiz' yerine R3 uyarısıyla gelir, onaylı Yine de Gönder ile gider",
    "M242": "S36 (Y17-13) dönem sınırı: içeriği silinmiş Sonucu Belirsiz Ekstre izi dönem eşliğine bakmadan eler — sonraki dönem de gitmez",
    "M243": "S37'nin tersi (A seçeneği): içeriği silinmiş Ödeme Hatırlatma da Ekstre gibi yeniden gönderilemez ('içerik silindi' ile elenir)",
    "M244": "S37 (Y17-16) yol sınırı: yalnız Başarısızları Yeniden Dene açık — işteki Yine de Gönder içeriği silinmiş Ödeme Hatırlatma'yı 'içerik silindi' ile eler",
    "M245": "S38'in tersi (B seçeneği): silme talebi kayıtları taşınmaz — yeni bilgisayarda talep öncesi yedek geri yüklenince içerik / telefon geri gelir",
    "M246": "S38 (Y17-20) zaman sınırı: taşınan talep kaydının anı taşıma anı olur — talepten sonra (taşımadan önce) yazılmış içerik de geri yüklemede silinir",
    "M247": "S33'ün tersi (B seçeneği, bugünkü program): Yol 2'de imzasız bildirim de (wamid tanınmasa bile) 'bildirim yolu çalışıyor' işaretini koyar — TTL + 1 sa'te Süresi Doldu",
    "M248": "S41'in tersi (B seçeneği): uygulama düzeyi adrese gelen bildirim işlenmez (200, yok sayılır) — teslim bilgisi kaybolur",
    "M249": "S41 'aynı kurallar'ın tersi: uygulama düzeyi adreste imza aranmaz — Yol 2'de imzasız bildirim de işlenir",
    "M250": "Yol 1 'imzasız kabul'ün tersi (S41 metni): Yol 1'de de imzasız bildirim düşer (§7a 3) — Meta'nın bildirimleri işlenmez",
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
    "G0": {"kaynak_turu": "kullanıcı (genel ilke 'a')",
           "metin": ["WhatsApp \"kime kaç kez\" belirsizliklerinde (1) kesin ALMADIYSA sayılmaz (teslim yok; iptal / geri yükleme / taşıma / sıfırlama ile duran); (2) ALMIŞ "
                     "OLABİLİRSE (Sonucu Belirsiz) elenir, tek yol işteki onaylı Yine de Gönder; (3) ALDIYSA aynı dönemde elenir, dönem eşliğinde şüphede AYNI dönem; (4) ÇIKMAZ "
                     "yok — elenen her kişinin bir gönderme yolu kalır; (5) taşınan / geri yüklenen veride aynı bilgisayardaki kurallar."]},
    "G1": {"kaynak_turu": "kullanıcı",
           "metin": ["yeniden denemede (Başarısızları Yeniden Dene + işteki Yine de Gönder'in açtığı iş) özel aralığın \"o gün\"ü ASIL işin açıldığı gündür; tek toplu iş içinde "
                     "de gün = toplu işin açıldığı gün (gönderim günü değil; günlük sınırla ertesi güne kayan kişi aynı dönemdedir). Yalnız ekstre; hatırlatmanın gün kuralı "
                     "(E3/F2) değişmez."]},
    "G2": {"kaynak_turu": "kullanıcı",
           "metin": ["HAZIR seçimle (Bu Ay / Geçen Ay) yapılan gönderimin o günkü tarihleri de eşliğe girer: 03.11 \"Bu Ay\" gönderilen kişi 05.11'de özel 01.11–03.11'de "
                     "\"Daha Önce Gönderildi\". Kendi günlerinde Bu Ay'a eşit iki farklı özel aralık aynı dönem kalır."]},
    "G3": {"kaynak_turu": "kullanıcı",
           "metin": ["taşınan veride şirket dosyasında Sonucu Belirsiz duran iş kişiyi \"Sonucu Belirsiz\" ile eler (yeni toplu iş + yeniden deneme), işteki Yine de Gönder "
                     "çalışır. Dosyadan gelen kabul/teslime 7 gün + asıl işin Yine de Gönder sınırı aynen uygulanır."]},
    "G4": {"kaynak_turu": "kullanıcı",
           "metin": ["Şirket Verisini Sıfırla ile durmuş, teslim edilmemiş Meta Bekletti sayılmaz; geç teslim gelirse sayılır."]},
    "G5": {"kaynak_turu": "kullanıcı",
           "metin": ["Meta Bekletti sonrası 2. deneme Sonucu Belirsiz kalırsa kişi \"Sonucu Belirsiz\" ile elenir; işteki Yine de Gönder onaylı çalışır."]},
    "G6": {"kaynak_turu": "BAŞ MİMAR (G0 (3) İLKEYLE; ana oturum iletisi)",
           "metin": ["\"Son 3 Ay\" / \"Tüm Hareketler\" gönderiminin o günkü (toplu işin açıldığı gün; yeniden denemede asıl işin günü) tarihleri, özel aralığın "
                     "tarihleriyle BİREBİR aynıysa aynı dönem (R3 + Zaten Kuyrukta + Sonucu Belirsiz; iki yön); Son 3 Ay / Tüm'ün 7 gün penceresi bu eşlikte de geçerli "
                     "(7 günden eskiyse ayrı dönem)."]},
    "H1": {"kaynak_turu": "kullanıcı (ana oturum iletisi, aynen)",
           "metin": ["\"Yine de Gönder\" ile açılan iş kabul/teslim edilince KAYNAK Sonucu Belirsiz deneme o kişi için artık \"Sonucu Belirsiz\" saymaz; kişi \"Daha Önce "
                     "Gönderildi\" olur, yolu yeni gönderimdeki R3 \"Yine de Gönder\"; Yine de Gönder ile açılan iş başarısız/belirsiz kalırsa kaynak belirsiz sayılmaya "
                     "devam eder (D6/F1 aynen)."]},
    "H2": {"kaynak_turu": "BAŞ MİMAR (G0 İLKEYLE; ana oturum iletisi)",
           "metin": ["veri başka bilgisayara taşınınca \"Gönderiliyor\"da kalmış iş \"Sonucu Belirsiz\" olur (kişi elenir, işteki Yine de Gönder)."]},
    "H3": {"kaynak_turu": "BAŞ MİMAR (G0 İLKEYLE; ana oturum iletisi)",
           "metin": ["iş dosyada yokken (sıfırlama / geri yükleme) gelen İMZALI geç kabul/teslim, defterde sonucu belli olmayan son deneme için sayılır."]},
    "H4": {"kaynak_turu": "BAŞ MİMAR (G0 İLKEYLE; ana oturum iletisi)",
           "metin": ["R3 uyarısındaki \"son gönderim\" tarihi son kabul/teslim edilen denemenin anıdır."]},
    "J1": {"kaynak_turu": "kullanıcı (KARAR 01.11.2026 06:28 UTC madde 1; CLAUDE.md 'Açık iş', aynen)",
           "metin": ["(1) teslim her durumda sayılır — Meta delivered/read derse kişi aldı, aynı dönemde \"Daha Önce Gönderildi\"; iş bekletilmiş/iptal/durdurulmuş/"
                     "başarısız/süresi dolmuş/geri yüklenmiş/şirket silinmiş olsa da; iş yeniden açılmaz"]},
    "J2": {"kaynak_turu": "kullanıcı (KARAR 01.11.2026 06:28 UTC madde 2, aynen)",
           "metin": ["(2) Meta Bekletti'deki ileti teslim edilirse iş kapanır, 24 sa sonraki 2. deneme gitmez"]},
    "J3": {"kaynak_turu": "kullanıcı (KARAR 01.11.2026 06:28 UTC madde 3, aynen)",
           "metin": ["(3) geç \"teslim edilemedi\" her durumda geçerli (geri yükleme/sıfırlama/silinmiş şirket sonrası da) → kişi almadı, yeniden gönderilebilir"]},
    "J4": {"kaynak_turu": "kullanıcı (KARAR 01.11.2026 06:28 UTC madde 4, aynen)",
           "metin": ["(4) Süresi Doldu (3 gün) Meta'nın son kabul ettiği denemeden ölçülür"]},
    "J5": {"kaynak_turu": "kullanıcı (KARAR 01.11.2026 06:28 UTC madde 5, aynen)",
           "metin": ["(5) Bu Ay Gönderilen her teslim edilen denemeyi sayar (bekletme sonrası iki teslim → 2; BİLİNEN SINIR: kişiye 2 ileti, önlenemez)"]},
    "J6": {"kaynak_turu": "kullanıcı (KARAR 01.11.2026 06:28 UTC madde 6, aynen)",
           "metin": ["(6) Meta'ya 503 \"sonra tekrar dene\": bildirim kaydedilemezse, şirket geçici açılamazken, yanıt beklenirken tanınmayan bildirime en çok 5 dk "
                     "(aynı numarayı başka araçla kullananda o aracın bildirimleri de)"]},
    "J7": {"kaynak_turu": "kullanıcı (KARAR 01.11.2026 06:28 UTC madde 7, aynen)",
           "metin": ["(7) defterde onarım bekleyen kabul varken yeni gönderim başlamaz, düğme pasif + neden",
                     "06:28'de onaya sunulan ve AYNEN onaylanan liste metni madde 7 (ana oturum iletisi): Gönderim defteri onarılmadan yeni gönderim başlamaz. Meta'nın kabulü "
                     "deftere yazılamadıysa yeni gönderim düğmesi pasif kalır ve ekranda nedeni yazar. Böylece ikinci ileti gitmez."]},
    "J8": {"kaynak_turu": "kullanıcı (KARAR 01.11.2026 06:28 UTC madde 8, aynen); 'kişiye özel dönem'in iki okuması BİRLİKTE — kâhin, İLKEYLE G0 (3) (README §14 Y9-15)",
           "metin": ["(8) dönem eşliği: Tüm Hareketler'in kişiye özel dönemi o günün Bu Ay/Geçen Ay'ıyla aynıysa aynı dönem; hareketsiz carinin dönemi iletideki dönem."]},
    "J9": {"kaynak_turu": "kullanıcı (KARAR 01.11.2026 05:58 UTC 'Şimdi durdur' + 'Bilinen sınır', aynen; senaryo tanımı iş listesi n3 sorusu)",
           "metin": ["n3 (kuyruktaki ikinci iş, birincinin geç teslimiyle 2 ileti) → BİLİNEN SINIR, 2.5.0 (ders 45).",
                     "aynı kişi + aynı dönem için kuyruktaki İKİNCİ iş, birincinin geç teslimi geldikten sonra da gidiyor (2 ileti; eski kodda da). A: gönderimden hemen "
                     "önce R3 bir kez daha (Yine de Gönder kararları korunur). B (incelemeci önerisi, ders 45): bugünkü gibi; BİLİNEN SINIR, 2.5.0."]},
    "J10": {"kaynak_turu": "kullanıcı (KARAR 01.11.2026 07:07 + 07:11 UTC, S9-1 ve kapsamı, aynen); 'Atlandı — Daha Önce Gönderildi / Bu Ay değişmez' ana oturum iletisi (README §14.11)",
            "metin": ["S9-1 (kime kaç kez) \"Gitmesin\" — Yine de Gönder onaylanmış ama yeni ileti henüz gitmemişken eski iletinin teslimi gelirse yeni ileti GİTMEZ "
                      "(ilke 3; belirsizlik kalktı).",
                      "KARAR (kullanıcı, 01.11.2026 07:11 UTC): S9-1 KAPSAMI \"Yalnız belirsizlik onayları\" — (a) Sonucu Belirsiz işteki Yine de Gönder kapsanır; (c) Başarısızları "
                      "Yeniden Dene yalnız (a) zincirinden gelen yeniden denemede kapsanır; (b) yeni gönderimde \"Daha Önce Gönderildi\" uyarısına rağmen bilerek seçilen Yine de "
                      "Gönder KAPSANMAZ (ikinci kopya gider).",
                      "ana oturum iletisi (CLAUDE.md'de yok): iş \"Atlandı — Daha Önce Gönderildi\", Bu Ay değişmez — ana oturum teyidi: BAŞ MİMAR KARARI (adlandırma); atlanan sayılmaz, eski teslim J5 ile sayılır"]},
    "J11": {"kaynak_turu": "kullanıcı (KARAR 01.11.2026 07:07 + 07:11 UTC, S9-2 ve günü, aynen)",
            "metin": ["S9-2 \"İlk hareket – gönderim günü\" — Tüm Hareketler ekstresinin dönem metni ({3}) ilk hareket tarihi – gönderim günü; hareketsiz caride gönderim "
                      "günü – gönderim günü.",
                      "S9-2 GÜNÜ \"Ekstrenin hazırlandığı gün\" — \"gönderim günü\" = gönderimin açıldığı, ekstre ve bakiyenin hazırlandığı gün (kod değişmez; metin PDF ile aynı)."]},
    "J12": {"kaynak_turu": "kullanıcı (07:11'de seçilen seçeneğin metni AYNEN — ana oturum iletisi); §7a 1'in ekstre yorumunun YERİNE (ana oturum)",
            "metin": ["'Gönderim günü' = gönderimin açıldığı, ekstrenin ve bakiyenin hazırlandığı gün. İleti metni PDF'teki dönem ve bakiyeyle aynı kalır (ekstre tarihi = "
                      "düzenleme tarihi, yaygın uygulama).",
                      "sorunun metni: \"Ekstre PDF'i ve bakiye açılış gününde hazırlanıyor\""]},
    "W1": {"kaynak_turu": "kullanıcı (KARAR 03.11.2026 ~18:45 UTC, W SORU T0) + ana oturum onayı (~18:50 UTC) — docs/2.4.9-IS-LISTESI.md ve "
                          "docs/2.4.9-tasarim/W-whatsapp-sablon.md §15, AYNEN; J4 metnindeki \"(3 gün)\"ün YERİNE",
           "metin": ["KULLANICI KARARI (03.11 ~18:45 UTC, W SORU T0): Meta'nın utility'de izin verdiği en uzun özel süre 12 SAAT çıktı → kullanıcı \"30 gün (Meta varsayılanı)\" "
                     "seçti; SORU 1 A DEĞİŞTİ: program TTL göndermez/düzenlemez, ttlHours (72) kalkar, Süresi Doldu = Meta'nın bildirdiği değer yoksa 30 gün. T1, T2 düştü.",
                     "KULLANICI (AskUserQuestion, 03.11; SORU T0, 12 saatlik üst sınır öğrenildikten sonra KARAR 03.11 SORU 1 A'yı DEĞİŞTİRDİ): TESLİM SÜRESİ = 30 GÜN (Meta "
                     "varsayılanı). Program şablon açarken TTL GÖNDERMEZ, onaylı şablonun TTL'ini DÜZENLEMEZ. SORU T1 ve T2 bu kararla DÜŞER (30 günde bildirim kaçma "
                     "penceresi pratikte yok, §7).",
                     "\"Süresi Doldu\" ve PDF silme: Meta listesinin bildirdiği değer varsa o, yoksa 30 gün (+1 sa) […]. Kayıtlı eski TTL ret/düzenleme kayıtları okunmaz, "
                     "zarar vermez; eski kurulumlarda 72 sa ile açılmış şablon varsa (Meta reddettiği için yok) liste değeri geçerli.",
                     "W kâhini (kahin.py TTL = 72 sa) KODU GÖRMEYEN ayrı ajanla karar metninden 30 güne güncellenir (ders 5, 40) — kod ajanı kâhine dokunmaz."]},
    "W2": {"kaynak_turu": "kullanıcı (03.11.2026 ~20:05 UTC, \"2.5.0 bırakmasak büyük bir iş mi?\" → W-KÖK 2.4.9'A ALINDI) — docs/2.4.9-IS-LISTESI.md son satır, AYNEN; "
                          "İLKEYLE (ilke 2); program henüz uygulamıyor (ana oturum iletisi: ayrışma beklenir)",
           "metin": ["KULLANICI (03.11 ~20:05 UTC, \"2.5.0 bırakmasak büyük bir iş mi?\") → W-KÖK 2.4.9'A ALINDI: iş KABUL ANINDAKİ teslim süresiyle değerlendirilir (Meta "
                     "listesindeki süre sonradan kısalırsa önceden kabul edilmiş iş eski süreyle; o an süre bilinmiyorsa 30 gün) — İLKEYLE (ilke 2 \"almış olabilirse "
                     "elenir\"), yeni soru yok."]},
    "W3": {"kaynak_turu": "kullanıcı (03.11.2026 ~21:00 UTC, AskUserQuestion; kâhinin S10-6 sorusu) — docs/2.4.9-IS-LISTESI.md son satır, AYNEN; program henüz uygulamıyor",
           "metin": ["KULLANICI KARARI (03.11 ~21:00 UTC, AskUserQuestion; kâhinin S10-6 sorusu): süre kabulden sonra UZARSA önceden kabul edilmiş iş UZUN süreyle (30 gün) "
                     "değerlendirilir → etkin süre = max(kabul anındaki, güncel); kabulde bilinmiyorsa 30 gün. W-KÖK ajanına ve kâhine iletildi."]},
    # ---- kâhin güncellemesi 11 (2.5.0; docs/2.5.0-IS-LISTESI.md D + C, docs/erp/WHATSAPP-PAKETI-2.5.0-PLANI.md §1/§4/§4a, ana oturum görev iletisi — AYNEN) ----
    "SW1": {"kaynak_turu": "kullanıcı (05.11.2026 ~16:48 UTC, AskUserQuestion; iş listesi D + P6 §4, aynen) — J9'un BİLİNEN SINIR'ının YERİNE (n3 KARAR); soru metni P6 §4a",
            "metin": ["S-W1 (05.11 ~16:48): n3 = \"İkinci de gitsin\". Bugünkü davranış; genel ilke (2)'nin bu duruma özel istisnası.",
                      "KULLANICI KARARLARI (05.11 ~16:48, WhatsApp, aynen): S-W1 n3 = \"İkinci de gitsin\" (bugünkü davranış; genel ilke (2)'nin bu duruma özel istisnası)",
                      "S-W1 (n3) = \"İkinci de gitsin\" → bugünkü davranış KALIR (kod değişmez); n3 BİLİNEN SINIR değil KARAR. Genel ilke (2)'nin bu duruma özel istisnası (kullanıcı kararı). "
                      "WhatsApp kâhini \"kuyruktaki ikinci iş, birincinin teslimi beklenirken de gider\" kuralına göre (ders 40: kural karar metninden).",
                      "soru (P6 §4a): S-W1 (n3): Kuyrukta bekleyen ikinci iş, aynı kişiye aynı dönem için gönderilmiş ve teslimi beklenen (\"Meta Kabul Etti\") bir ileti varken ne olsun? "
                      "A (ÖNERİ): elenir (\"Zaten Gönderiliyor\"); birinci Başarısız olursa ikinci için onaylı \"Yine de Gönder\" yolu açılır — ilke 2 (\"almış olabilirse elenir\"). "
                      "B: ikinci de gider (bugünkü davranış; nadiren aynı kişiye 2 ileti)."]},
    "SW2": {"kaynak_turu": "kullanıcı (05.11.2026 ~16:48 UTC, AskUserQuestion; iş listesi D + P6 §4, aynen); soru metni P6 §4a",
            "metin": ["S-W2 (05.11 ~16:48): SORU 2 = \"Sayılmasın\". Süresi Doldu ileti 24 saatlik sınıra sayılmaz; bugünkü kural.",
                      "S-W2 (SORU 2) = \"Sayılmasın\" → bugünkü kural KALIR (Süresi Doldu ileti 24 saatlik alıcı sınırına sayılmaz). WhatsApp kâhini buna göre güncellenir "
                      "(`pencere_farkli_alici` ailesindeki TTL farkları kural farkı olarak kapanır).",
                      "soru (P6 §4a): S-W2 (SORU 2): Teslim süresi dolan (\"Süresi Doldu\") ileti, Meta'nın 24 saatlik alıcı sınırı hesabında sayılsın mı? A (ÖNERİ, güvenli taraf): "
                      "sayılır — sınıra yaklaşılan günde program biraz erken durur; Meta reddi hiç yaşanmaz. B: sayılmaz (bugünkü) — sınıra yakın günde Meta birkaç iletiyi reddedebilir "
                      "(red zaten işleniyor, ileti kaybolmaz, ertesi gün gider). Meta belgesi Süresi Doldu iletiyi sayıp saymadığını açık yazmıyor (DOĞRULANMADI)."]},
    "SD1837": {"kaynak_turu": "kullanıcı (05.11.2026 ~18:37 UTC, AskUserQuestion; iş listesi D + P6 §4, aynen); 'süre dolunca gönderim başlatılamaz' PLAN P6 §1 W-1 (a) (karar değil)",
               "metin": ["18:37: \"WhatsApp bağlantısının süresi dolduğunda kuyruktaki / süren toplu gönderim işleri\" → \"Duraklasın, sonra sürsün\": iş 'Duraklatıldı' olur; yeniden "
                         "bağlanınca 'Devam Et' ile yalnız kalan kişilere gider, kimseye ikinci ileti gitmez. Plan §3 madde 3'teki \"Durduruldu + Yine de Gönder\" notunun YERİNE geçer.",
                         "KULLANICI KARARI 05.11 ~18:37 (AskUserQuestion, W-1 ajanının KULLANICIYA SORULMALI 1): \"WhatsApp bağlantısının süresi dolduğunda kuyruktaki / süren toplu "
                         "gönderim işleri\" → \"Duraklasın, sonra sürsün (Önerilen)\": iş 'Duraklatıldı' olur; yeniden bağlanınca 'Devam Et' ile yalnız kalan kişilere gider, kimseye ikinci "
                         "ileti gitmez (bugünkü Meta 190 davranışı). Plan §3 madde 3'teki \"Durduruldu + Yine de Gönder\" notunun YERİNE geçer. WhatsApp kâhini (WK) bu metinden.",
                         "plan (P6 §1 W-1): BELİRTEÇ: (a) şimdi — bağlantının belirteç süresini izle; bitişe 7 gün kala ve sonra her gün en çok bir kez \"WhatsApp bağlantınızın süresi "
                         "doluyor — yeniden bağlayın\" uyarısı (Yönetim → WhatsApp + bildirim); süre dolunca gönderim başlatılamaz, neden görünür yazı; \"Yeniden Bağla\" her zaman açık."]},
    "SD1915": {"kaynak_turu": "kullanıcı (05.11.2026 ~19:15 UTC, AskUserQuestion; W1W2 dar kontrolünün KULLANICIYA SORULMALI'sı; iş listesi D + P6 §4, aynen)",
               "metin": ["19:15: \"Toplu WhatsApp gönderimi sürerken Meta anahtarı reddederse (süre doldu ya da iptal — Meta hata 190), o anda iletisi gitmeyen kişi ne olsun?\" → "
                         "\"Bekleyenlere dönsün\": iletisi kesin gitmediği için kalan kişilerle bekler, yeniden bağlanınca 'Devam Et' ile ona da gider. Bugünkü 'Başarısız + Başarısızları "
                         "Yeniden Dene' davranışının YERİNE.",
                         "KULLANICI KARARI 05.11 ~19:15: \"Bekleyenlere dönsün (Önerilen)\": iletisi kesin gitmediği için kalan kişilerle bekler, yeniden bağlanınca 'Devam Et' ile ona da "
                         "gider (18:37 kararının 'yalnız kalan kişilere gider' okuması; ilke 1). Bugünkü 'Başarısız + Başarısızları Yeniden Dene' davranışının YERİNE."]},
    "SW4": {"kaynak_turu": "kullanıcı (05.11.2026 21:08 UTC, sohbette sorulan soruya yanıt 'hepsi A'; iş listesi C + D, aynen); 'Kod 102 bu kararın DIŞINDA' ana oturum görev iletisi",
            "metin": ["S-W4 (05.11 21:08): \"Kod 0 da 190 gibi işlensin\": Meta belirteci 0 koduyla (\"AuthException\") reddederse bağlantı 'Süresi Doldu' olur, o anda iletisi gitmeyen "
                      "kişi bekleyenlere döner, yeniden bağlanınca 'Devam Et' ile kalanlara gider. Kod 102 bu kararın DIŞINDA; kâhinde bugünkü hâliyle kalır.",
                      "S-W4 = A — \"Kod 0 da 190 gibi işlensin\": Meta belirteci 0 koduyla (\"AuthException\") reddederse bağlantı 'Süresi Doldu' olur, o anda iletisi gitmeyen kişi "
                      "bekleyenlere döner, yeniden bağlanınca 'Devam Et' ile kalanlara gider (19:15 kararının 0'a genişletilmesi). → W TUR 2 (kod) + WK (kâhin).",
                      "soru (iş listesi C): S-W4 (W1W2 dar kontrol DÜŞÜK-1: Meta kod 0 \"AuthException\" da 190 gibi mi — A öneri / B yalnız 190)"]},
    "S7": {"kaynak_turu": "kullanıcı (05.11.2026 21:08 UTC 'hepsi A'; iş listesi C + D, aynen) + aynı ailenin 18:55 S3 kararı (mali müşavir EK-1, aynen)",
           "metin": ["S7 (05.11 21:08): \"Müşteri otomatik listeye girmesin\": şüpheli alacak kaydı (icra / dava) açık olan müşteriye otomatik Ödeme Hatırlatma gitmez; ekranda "
                     "\"Şüpheli Alacağı Var\" etiketiyle görünür, istenirse elle seçilir (iletide şüphelisiz gecikmiş tutar yazar).",
                     "S7 = A — \"Müşteri otomatik listeye girmesin\": şüpheli alacak kaydı (icra / dava) açık olan müşteriye otomatik Ödeme Hatırlatma gitmez; ekranda \"Şüpheli Alacağı "
                     "Var\" etiketiyle görünür, istenirse elle seçilir (iletide şüphelisiz gecikmiş tutar yazar). → Ç5 (B1 ortak gecikmiş tanımı + WhatsApp elemesi) + muhasebe kâhini "
                     "(kâhin bakımı 2) + WK.",
                     "soru (iş listesi C): S7 (EK-2 Soru 29: şüpheli alacağı olan müşteriye otomatik Ödeme Hatırlatma — A öneri \"otomatik listeye girmesin\" / B \"şüphelisiz kısım gitsin\")",
                     "18:55 S3: \"Şüpheli alacağa alınmış borç otomatik Ödeme Hatırlatma'ya girsin mi\" → \"Hayır, elle seçilebilir\""]},
    # ---- kâhin güncellemesi 12 (2.5.0; docs/2.5.0-IS-LISTESI.md D "KULLANICI KARARI 06.11 03:35 UTC" + C soru metni — AYNEN) ----
    "S7A": {"kaynak_turu": "kullanıcı (06.11.2026 03:35 UTC, 'hepsi A'; iş listesi D + C, aynen) — WK güncellemesi 11'in KULLANICIYA SORULMALI S7-a'sı (README §16.4)",
            "metin": ["KULLANICI KARARI 06.11 03:35 UTC (AYNEN: \"hepsi A\"; sorular C bölümünde, öneriyle soruldu):",
                      "S7-a = A: şüpheli alacak kaydı açık müşteri ELLE seçilse de şüphesiz gecikmiş borcu yoksa \"Gecikmiş Borç Yok\" ile elenir (ileti gitmez).",
                      "İŞ ATAMASI: S7-a, S7-b → Ç5 (B1 ortak gecikmiş / S7) + WK kâhin bakımı; …",
                      "soru (iş listesi C, SORULDU 05.11 21:56 → YANITLANDI 06.11 03:35 \"hepsi A\"): S7-a: şüpheli alacak kaydı açık müşteri ELLE seçildi ama şüphesiz gecikmiş borcu yok — "
                      "A öneri \"Gecikmiş Borç Yok\" ile elensin / B ileti yine gitsin."]},
    "S7B": {"kaynak_turu": "kullanıcı (06.11.2026 03:35 UTC, 'hepsi A'; iş listesi D + C, aynen) — WK güncellemesi 11'in KULLANICIYA SORULMALI S7-b'si (README §16.4)",
            "metin": ["KULLANICI KARARI 06.11 03:35 UTC (AYNEN: \"hepsi A\"; sorular C bölümünde, öneriyle soruldu):",
                      "S7-b = A: toplu gönderim kuyruktayken şüpheli alacak kaydı açılan, elle seçilmemiş müşteri gönderim anında atlanır (\"Şüpheli Alacağı Var\").",
                      "İŞ ATAMASI: S7-a, S7-b → Ç5 (B1 ortak gecikmiş / S7) + WK kâhin bakımı; …",
                      "soru (iş listesi C, SORULDU 05.11 21:56 → YANITLANDI 06.11 03:35 \"hepsi A\"): S7-b: toplu gönderim kuyruktayken şüpheli alacak kaydı açılan, elle seçilmemiş "
                      "müşteri — A öneri gönderim anında atlansın (\"Şüpheli Alacağı Var\") / B başlatmadaki seçimle gitsin."]},
    # ---- kâhin güncellemesi 13 (2.5.0; docs/2.5.0-IS-LISTESI.md D "KULLANICI KARARI 06.11 04:50 UTC" + C soru metni, D "KULLANICI KARARLARI 05.11 (21:30 …)" (5) — AYNEN) ----
    "S16": {"kaynak_turu": "kullanıcı (06.11.2026 04:50 UTC, 'benden beklediğin cevapların hepsine A yap'; iş listesi D + C, aynen) — WK güncellemesi 12'nin KULLANICIYA SORULMALI S7-c'si (README §17.4)",
            "metin": ["KULLANICI KARARI 06.11 04:50 UTC (AYNEN: \"benden beklediğin cevapların hepsine A yap\"; sorular C bölümünde, öneriyle soruldu):",
                      "S16 = A: Sonucu Belirsiz iş beklerken şüpheli alacak kaydı açıldıysa \"Yine de Gönder\" elle seçim sayılır; ileti şüphesiz tutarla gider (yoksa elenir); onay penceresinde "
                      "\"Şüpheli Alacağı Var\".",
                      "İŞ ATAMASI: … S16, S17 → Ç5 (WhatsApp elemesi) + WK güncellemesi 13.",
                      "soru (iş listesi C, SORULDU 06.11 04:05 → YANITLANDI 06.11 04:50 \"hepsine A\"): S16 (S7-c): Ödeme Hatırlatma işi Sonucu Belirsiz; beklerken carinin şüpheli alacak "
                      "kaydı açıldı; iş elle seçilmemişti; \"Yine de Gönder\" basılırsa — A öneri: elle seçim sayılır, ileti şüphesiz tutarla gider (şüphesiz tutar yoksa elenir), onay "
                      "penceresinde \"Şüpheli Alacağı Var\" yazar / B: \"Atlandı — Şüpheli Alacağı Var\" (o gün gönderim yolu kalmaz)."]},
    "S17": {"kaynak_turu": "kullanıcı (06.11.2026 04:50 UTC, 'hepsine A'; iş listesi D + C, aynen) — WK güncellemesi 12'nin bilgi notu '(5) × S7' (README §17.4)",
            "metin": ["KULLANICI KARARI 06.11 04:50 UTC (AYNEN: \"benden beklediğin cevapların hepsine A yap\"; sorular C bölümünde, öneriyle soruldu):",
                      "S17 = A: elle seçilen şüpheli alacaklı caride iletideki şüphesiz gecikmiş tutar, şüpheli kalemler HARİÇ net borçla sınırlanır.",
                      "soru (iş listesi C, SORULDU 06.11 04:05 → YANITLANDI 06.11 04:50 \"hepsine A\"): S17 (S7 × karar (5)): elle seçilen şüpheli alacaklı caride iletideki gecikmiş tutar — "
                      "A öneri: şüphesiz gecikmiş tutar, şüpheli kalemler HARİÇ net borçla sınırlanır / B: carinin toplam net borcuyla sınırlanır."]},
    "NB5": {"kaynak_turu": "kullanıcı (05.11.2026, 21:30 UTC'de işlendi; 7 soruya 'önerilerini uygula' → A; iş listesi D, aynen) — karar (5); eleme adı karar metninde yok (README §18 Y13-7)",
            "metin": ["KULLANICI KARARLARI 05.11 (21:30 UTC'de işlendi; sohbette sorulan 7 soruya yanıt, AYNEN: \"önerilerini uygula\" → yedisi de A).",
                      "(5) 2B-S4 / S9 = A \"Bakiyeden Netleşsin\": gecikmiş tutar carinin net borcunu aşmaz (alış faturası düşülür); bize alacaklı kişiye hatırlatma gitmez; faturaların Açık / "
                      "Ödendi durumu yalnız Mahsup Et ile.",
                      "İŞ ATAMASI: (1)(2)(3)(5) → Ç5 (B1 ortak gecikmiş / kapama) + kâhin bakımı 2; …"]},
    # ---- kâhin güncellemesi 14 (2.5.0; docs/2.5.0-IS-LISTESI.md D "KULLANICI KARARI 06.11 05:30 UTC" + C soru metni — AYNEN) ----
    "S22": {"kaynak_turu": "kullanıcı (06.11.2026 05:30 UTC, 'a'; iş listesi D + C, aynen) — WK güncellemesi 13'ün KULLANICIYA SORULMALI S7-d'si (README §18.4)",
            "metin": ["KULLANICI KARARI 06.11 05:30 UTC (AYNEN: \"a\"; soru C bölümünde S22, öneriyle soruldu):",
                      "S22 = A: işteki Yine de Gönder basıldığında şüpheli kaydı yoktu, iş gönderim beklerken kayıt açıldı → S7-b gibi gönderim anında \"Atlandı — Şüpheli Alacağı Var\"; "
                      "yol kalır (kayıt açıkken yeniden Yine de Gönder basılırsa S16 ile şüphesiz tutarla gider). İŞ ATAMASI: Ç5 (WhatsApp elemesi) + WK güncellemesi 14.",
                      "soru (iş listesi C, SORULDU 06.11 05:29 → YANITLANDI 06.11 05:30 \"a\"): S22 (S7-d ★): işteki Yine de Gönder basıldığında carinin şüpheli kaydı YOKTU; iş gönderim "
                      "beklerken (Sınır, Duraklatıldı → Devam Et ya da zincirdeki yeniden deneme) şüpheli kayıt açıldı — A öneri: S7-b gibi gönderim anında \"Atlandı — Şüpheli Alacağı Var\"; "
                      "yol kalır (kayıt açıkken yeniden Yine de Gönder basılırsa S16 ile şüphesiz tutarla gider) / B: Yine de Gönder kişiye özel onaylı seçimdir, elle sayılır, şüphesiz "
                      "tutarla gider."]},
    # ---- kâhin güncellemesi 15 (2.5.0; docs/2.5.0-IS-LISTESI.md D "KULLANICI KARARI 06.11 06:03 UTC" + C soru metni; D "KULLANICI KARARLARI (05.11 ~16:48 …)" S-W3 + P6 §1/§3/§4/§4a — AYNEN) ----
    "S23": {"kaynak_turu": "kullanıcı (06.11.2026 06:03 UTC, 'a'; iş listesi D + C, aynen) — WK güncellemesi 14'ün KULLANICIYA SORULMALI S7-e'si (README §19.4)",
            "metin": ["KULLANICI KARARI 06.11 06:03 UTC (AYNEN: \"a\"; soru C bölümünde S23, öneriyle soruldu):",
                      "S23 = A: Yine de Gönder basıldı (şüpheli kaydı yoktu), iş gönderim beklerken kayıt açıldı, kullanıcı gönderim anından önce kayıt açıkken asıl işte YENİDEN Yine de Gönder "
                      "bastı → bekleyen iş S16 ile elle sayılır, gönderim anında şüphesiz tutarla gider; yeni iş açılmaz (F1 \"Zaten Kuyrukta\" bu duruma uygulanmaz). İŞ ATAMASI: Ç5 (WhatsApp "
                      "elemesi) + WK güncellemesi 15.",
                      "soru (iş listesi C, SORULDU 06.11 06:01 → YANITLANDI 06.11 06:03 \"a\"): S23 (S7-e ★): Yine de Gönder basıldı (şüpheli kaydı yoktu), iş gönderim beklerken kayıt açıldı ve "
                      "kullanıcı gönderim anı gelmeden, kayıt açıkken asıl işte Yine de Gönder'e YENİDEN bastı. S22'nin \"kayıt açıkken yeniden basılırsa S16 ile gider\" cümlesi ile F1 \"bekleyen "
                      "ileti varsa Zaten Kuyrukta\" kuralı çatışıyor — A öneri: bekleyen iş S16 ile elle sayılır, gönderim anında şüphesiz tutarla gider; yeni iş açılmaz / B: F1 aynen: \"Zaten "
                      "Kuyrukta\" ile elenir, sonra bekleyen ileti atlanır; gitmesi için bir basış daha gerekir."]},
    "SW3": {"kaynak_turu": "kullanıcı (05.11.2026 ~16:48 UTC, AskUserQuestion; iş listesi D + P6 §4, aynen); soru metni P6 §4a; P6 §1 W-3 satırı ve §3 madde 6–7 (plan, karar değil)",
            "metin": ["KULLANICI KARARLARI (05.11 ~16:48, WhatsApp, aynen): … S-W3 W-3 = \"1 yıl + anonim iz\" (içerik / telefon / PDF 1 yıl ya da talepte hemen silinir; tarih, dönem, cari "
                      "kimliği, şablon adı anonim iz).",
                      "S-W3 (W-3) = \"1 yıl + anonim iz (Önerilen)\" → içerik, telefon ve PDF 1 yıl sonra ya da silme talebinde hemen silinir; tarih, dönem, cari kimliği ve şablon adı anonim "
                      "iz kalır.",
                      "plan (P6 §1 W-3): Gönderim kayıtları saklama süresi + KVKK silme yolu (wa_jobs, wa_job_pdfs, makine defteri — bugün süresiz, defter silme tetikle engelli). | S-W3 "
                      "kararına göre. Önerilen: içerik ve telefon süre sonunda ya da silme talebinde silinir; \"gönderildi\" izi (tarih, dönem, cari kimliği, şablon) anonim kalır → aynı kişiye "
                      "aynı dönemde ikinci ileti gitmez (ilke 3, 5).",
                      "plan (P6 §3 \"Nasıl bozulur?\" madde 6): Saklama süresi dolan kayıt + aynı dönem yeni gönderim denemesi; KVKK silme talebinden sonra aynı kişi yeniden seçilir. "
                      "(madde 7): Geri yükleme / devir Geri Al sonrası aynı dönem gönderimi.",
                      "soru (P6 §4a): S-W3 (W-3): Gönderim kayıtları ne kadar saklansın, silme talebinde ne kalsın? A (ÖNERİ): içerik, telefon ve PDF 1 yıl sonra (ya da silme talebinde hemen) "
                      "silinir; tarih, dönem, cari kimliği ve şablon adı anonim iz olarak kalır → aynı kişiye aynı dönemde ikinci ileti gitmez. B: silme talebinde her şey silinir — o kişiye "
                      "aynı dönem iletisi yeniden gidebilir."]},
    # ---- kâhin güncellemesi 16 (2.5.0; docs/2.5.0-IS-LISTESI.md D "KULLANICI KARARI 06.11 06:52 UTC" + C soru metni (SORULDU 06:50 → YANITLANDI 06:52) — AYNEN) ----
    "S29": {"kaynak_turu": "kullanıcı (06.11.2026 06:52 UTC, 'a'; iş listesi D + C, aynen) — WK güncellemesi 15'in KULLANICIYA SORULMALI S23-a'sı (README §20.5)",
            "metin": ["KULLANICI KARARI 06.11 06:52 UTC (AYNEN: \"a\"; sorular C bölümünde S29–S32, öneriyle soruldu; hepsi A):",
                      "S29 = A: kayıt açıkken yeniden Yine de Gönder basıldığında şüphesiz tutar yoktu, gönderim anına kadar doğdu → gönderim anındaki şüphesiz tutarla gider.",
                      "İŞ ATAMASI: S29 → Ç5 + WK güncellemesi 16; …",
                      "soru (iş listesi C, SORULDU 06.11 06:50 → YANITLANDI 06.11 06:52 \"a\"): S29 (S23-a ★): kayıt açıkken yeniden Yine de Gönder basıldığında şüphesiz tutar YOKTU, gönderim "
                      "anına kadar doğdu (yeni vadesi geçen kalem) — A öneri: gönderim anındaki şüphesiz tutarla gider / B: S22 gibi \"Atlandı — Şüpheli Alacağı Var\"."]},
    "S30": {"kaynak_turu": "kullanıcı (06.11.2026 06:52 UTC, 'a'; iş listesi D + C, aynen) — WK güncellemesi 15'in KULLANICIYA SORULMALI S-W3-a'sı (README §20.5)",
            "metin": ["KULLANICI KARARI 06.11 06:52 UTC (AYNEN: \"a\"; sorular C bölümünde S29–S32, öneriyle soruldu; hepsi A):",
                      "S30 = A: KVKK silme talebi ya da 1 yıl dolumu anında bekleyen iş gönderilmez (telefon / içerik silindi); Sonucu Belirsiz izi kalır (aynı dönem elenir).",
                      "İŞ ATAMASI: … S30–S32 → W-3 kodu + WK güncellemesi 16 (kâhin önce).",
                      "soru (iş listesi C): S30 (S-W3-a ★): KVKK silme talebi ya da 1 yıl dolumu anında kişinin BEKLEYEN ya da Sonucu Belirsiz işi var — A öneri: bekleyen iş gönderilmez "
                      "(telefon / içerik silindi), belirsiz izi kalır (aynı dönem elenir) / B: bekleyen iş karttaki güncel bilgiyle gider."]},
    "S31": {"kaynak_turu": "kullanıcı (06.11.2026 06:52 UTC, 'a'; iş listesi D + C, aynen) — WK güncellemesi 15'in KULLANICIYA SORULMALI S-W3-b'si (README §20.5); karar metni YALNIZ Ekstre",
            "metin": ["KULLANICI KARARI 06.11 06:52 UTC (AYNEN: \"a\"; sorular C bölümünde S29–S32, öneriyle soruldu; hepsi A):",
                      "S31 = A: içeriği silinmiş Ekstre işi yeniden gönderilemez (neden görünür); yol yeni Ekstre gönderimi.",
                      "soru (iş listesi C): S31 (S-W3-b ★): içeriği silinmiş Ekstre işi yeniden gönderilmek istenirse — A öneri: o iş yeniden gönderilemez (neden görünür), yol yeni Ekstre "
                      "gönderimi / B: içerik ilk günün verisiyle yeniden üretilip gider."]},
    "S32": {"kaynak_turu": "kullanıcı (06.11.2026 06:52 UTC, 'a'; iş listesi D + C, aynen) — WK güncellemesi 15'in S-W3-c'si (README §20.5; KVKK)",
            "metin": ["KULLANICI KARARI 06.11 06:52 UTC (AYNEN: \"a\"; sorular C bölümünde S29–S32, öneriyle soruldu; hepsi A):",
                      "S32 = A: silme talebinden önce alınmış yedek geri yüklenince silinmiş içerik / telefon GELMEZ; silme talepleri makinede kayıtlı kalır ve geri yüklemeden sonra yeniden "
                      "uygulanır (ilke 5).",
                      "soru (iş listesi C): S32 (S-W3-c, KVKK): silme talebinden ÖNCE alınmış yedek geri yüklenince silinmiş içerik / telefon geri gelir mi — A öneri: gelmez; geri yüklemede "
                      "silme talepleri yeniden uygulanır (talep kaydı makinede kalır; ilke 5) / B: yedek aynen gelir, kullanıcı yeniden siler.",
                      "İLKEYLE (WK 15; plan §0 genel ilke, soru değil, teslim notuna \"İLKEYLE\"): içeriği silinmiş kayıtta da R3 \"Yine de Gönder\" açık kalır (ilke 4, çıkmaz yok); kapanmış "
                      "işteki belirsiz deneme izi yine eler (ilke 2)."]},
    # ---- kâhin güncellemesi 17 (2.5.0; docs/2.5.0-IS-LISTESI.md D "KULLANICI KARARI 06.11 08:06 UTC" (S34–S38), "06.11 07:00 UTC" (S33), "06.11 08:08 UTC" (S41) + C soru metinleri — AYNEN) ----
    "S34": {"kaynak_turu": "kullanıcı (06.11.2026 08:06 UTC, 'a' = öneriler; iş listesi D + C, aynen) — WK güncellemesi 16'nın KULLANICIYA SORULMALI S29-a'sı (README §21.7)",
            "metin": ["KULLANICI KARARI 06.11 08:06 UTC (AYNEN: \"a\"; sorular C bölümünde S34–S40, öneriyle soruldu; kullanıcıya \"önerileri kabul ediyorsanız 'a' yeterli (S37'de öneri B)\" "
                      "denmişti → \"a\" = ÖNERİLER):",
                      "S34 = A: ilk Yine de Gönder'de şüphesiz tutar yok, gönderim anına kadar doğuyor → iş alınır, gönderim anındaki tutarla gider (S29 ile aynı).",
                      "İŞ ATAMASI: S34–S38 → WK GÜNCELLEMESİ 17 (kâhin önce) → W-3 kodu (S30–S32 + S35–S38) + Ç5 (S34); …",
                      "soru (iş listesi C, SORULDU 06.11 07:39 → YANITLANDI 06.11 08:06 \"a\"): S34 (S29-a ★): İLK Yine de Gönder basıldığında şüphesiz tutar yok, gönderim anına kadar doğuyor — "
                      "A öneri: iş alınır, gönderim anındaki tutarla gider (S29 ile aynı) / B: basmada elenir."]},
    "S35": {"kaynak_turu": "kullanıcı (06.11.2026 08:06 UTC, 'a' = öneriler; iş listesi D + C, aynen) — WK güncellemesi 16'nın KULLANICIYA SORULMALI S30-a'sı (README §21.7)",
            "metin": ["KULLANICI KARARI 06.11 08:06 UTC (AYNEN: \"a\"; sorular C bölümünde S34–S40, öneriyle soruldu; … \"a\" = ÖNERİLER):",
                      "S35 = A: silme talebinde bekleyen iş talep anında kapanır (\"Atlandı — Silme Talebi\").",
                      "soru (iş listesi C): S35 (S30-a ★): silme talebinde bekleyen iş ne zaman kapanır (fark yalnız iş kapanmadan aynı kişiye aynı dönem yeni gönderim denenirse) — A öneri: talep "
                      "anında kapanır (\"Atlandı — Silme Talebi\") / B: gönderim anına kadar kuyrukta sayılır (\"Zaten Kuyrukta\").",
                      "ana oturum görev metni (WK 17): WK 16'nın s30_an seçenekli yaprakları S35 ile kesinleşir (README §22 Y17-6: 1 yıl dolumu dahil — BAŞ MİMAR teyidi)."]},
    "S36": {"kaynak_turu": "kullanıcı (06.11.2026 08:06 UTC, 'a' = öneriler; iş listesi D + C, aynen) — WK güncellemesi 16'nın KULLANICIYA SORULMALI S30-b'si (README §21.7)",
            "metin": ["KULLANICI KARARI 06.11 08:06 UTC (AYNEN: \"a\"; sorular C bölümünde S34–S40, öneriyle soruldu; … \"a\" = ÖNERİLER):",
                      "S36 = A: Sonucu Belirsiz Ekstre işinin içeriği silinince aynı dönem için yol kalmaz; sonraki dönem gider (ilke 4'ün bu duruma özel istisnası, kullanıcı onaylı).",
                      "soru (iş listesi C): S36 (S30-b ★): Sonucu Belirsiz Ekstre işinin içeriği silinince aynı dönem için gönderme yolu kalmıyor (ilke 4 ile çatışır) — A öneri: böyle kalsın, "
                      "sonraki dönem gider / B: yeni gönderimde uyarıyla onaylı Yine de Gönder açık."]},
    "S37": {"kaynak_turu": "kullanıcı (06.11.2026 08:06 UTC, 'a' = öneriler — S37'de öneri B; iş listesi D + C, aynen) — WK güncellemesi 16'nın KULLANICIYA SORULMALI S31-a'sı (README §21.7)",
            "metin": ["KULLANICI KARARI 06.11 08:06 UTC (AYNEN: \"a\"; sorular C bölümünde S34–S40, öneriyle soruldu; kullanıcıya \"önerileri kabul ediyorsanız 'a' yeterli (S37'de öneri B)\" "
                      "denmişti → \"a\" = ÖNERİLER):",
                      "S37 = B (öneri): içeriği silinmiş ÖDEME HATIRLATMA işi aynı iş üzerinden yeniden gönderilebilir; içerik gönderim anında karttan yeniden hazırlanıp gider.",
                      "soru (iş listesi C): S37 (S31-a ★): içeriği silinmiş ÖDEME HATIRLATMA işi aynı iş üzerinden yeniden gönderilebilir mi — A: Ekstre gibi gönderilemez / B öneri: içerik gönderim "
                      "anında hazırlandığı için karttan yeniden hazırlanıp gider."]},
    "S38": {"kaynak_turu": "kullanıcı (06.11.2026 08:06 UTC, 'a' = öneriler; iş listesi D + C, aynen) — WK güncellemesi 16'nın S32-a'sı (README §21.7; KVKK, ileti sayısını etkilemez)",
            "metin": ["KULLANICI KARARI 06.11 08:06 UTC (AYNEN: \"a\"; sorular C bölümünde S34–S40, öneriyle soruldu; … \"a\" = ÖNERİLER):",
                      "S38 = A: başka bilgisayara taşımada silme talebi kayıtları taşınır ve yeni bilgisayarda da uygulanır (ilke 5).",
                      "soru (iş listesi C): S38 (S32-a, KVKK; ileti sayısını etkilemez): başka bilgisayara taşımada silme talepleri — A öneri (ilke 5): talep kayıtları taşınır, yeni bilgisayarda da "
                      "uygulanır / B: uygulanmaz."]},
    "S33": {"kaynak_turu": "kullanıcı (06.11.2026 07:00 UTC, 'a'; iş listesi D + C, aynen) — WhatsApp küçük işler ajanının KULLANICIYA SORULMALI S-WY-1'i; WK 17'ye ana oturum iletisiyle eklendi",
            "metin": ["KULLANICI KARARI 06.11 07:00 UTC (AYNEN: \"a\"; soru C bölümünde S33, öneriyle soruldu):",
                      "S33 = A: Yol 2'de \"bildirim yolu çalışıyor\" işaretini yalnız İMZALI (Meta imzası doğrulanmış) bildirim koyar (ilke 2). İŞ ATAMASI: WHATSAPP KÜÇÜK İŞLER TUR 1 (dar kontrol "
                      "bulgularıyla birlikte, yeni ajan, xhigh).",
                      "soru (iş listesi C, SORULDU 06.11 06:58 → YANITLANDI 06.11 07:00 \"a\"): S33 (S-WY-1): Yol 2'de imzasız tek bir bildirim (sahte istek ya da kapıcıda uygulama sırrı eksik) wamid "
                      "tanınmasa bile 200 alıyor ve \"bildirim yolu çalışıyor\" işaretini koyuyor → teslim bilgisi gelmeyen iş TTL + 1 sa sonra \"Süresi Doldu\", kişi aynı dönemde yeniden "
                      "\"gönderilecek\" görünür, İKİNCİ İLETİ mümkün (ölçüldü: sahte POST yokken \"Daha Önce Gönderildi\", varken \"gönderilecek\") — A öneri: Yol 2'de işareti yalnız İMZALI bildirim "
                      "koyar (ilke 2: almış olabilirse elenir) / B: bugünkü gibi kalır.",
                      "ana oturum iletisi (WK 17'ye ekleme, 06.11.2026): Yol 1 (Elle Bağla) imzasız bildirim kabul etmeye devam eder."]},
    "S41": {"kaynak_turu": "kullanıcı (06.11.2026 08:08 UTC, 'A'; iş listesi D + C, aynen) — WhatsApp küçük işler dar kontrolünün ORTA-1'i; WK 17'ye ana oturum iletisiyle eklendi",
            "metin": ["KULLANICI KARARI 06.11 08:08 UTC (AYNEN: \"A\"; soru C bölümünde S41, öneriyle soruldu):",
                      "S41 = A: Meta'da WABA'nın alternatif bildirim adresi yokken teslim / teslim edilemedi bildirimi uygulama düzeyi adrese gelirse, bu kurulumda kaydı olan WABA'nın bildirimi "
                      "alternatif adresle AYNI kurallarla işlenir (Yol 1 imzasız kabul, Yol 2 yalnız imzalı) ve Meta'daki adres hemen yeniden denetlenir. Baş mimar kararı (5) \"uygulama düzeyi "
                      "POST işlenmez\" bu durum için KALKTI.",
                      "soru (iş listesi C, SORULDU 06.11 08:04 → YANITLANDI 06.11 08:08 \"A\"): S41: Meta'da WABA'nın alternatif bildirim adresi yokken (ör. gövdesiz subscribed_apps adımı yinelenince) "
                      "teslim / teslim edilemedi bildirimi UYGULAMA DÜZEYİ adrese (/wa/kanca/…) gelirse — bugün 200 dönüp işlenmiyor (baş mimar kararı (5)); iş \"sent\" kalıyor, süre dolunca "
                      "\"Süresi Doldu\", iletiyi almış kişi aynı dönemde yeniden \"gönderilecek\" (ölçüldü, s3 betiği; Meta'nın gerçekten oraya gönderdiği sahte Meta ile DOĞRULANMADI) — A öneri: bu "
                      "kurulumda kaydı olan WABA'nın bildirimi alternatif adresle AYNI kurallarla işlenir (Yol 1 imzasız kabul, Yol 2 yalnız imzalı) + Meta'daki adres hemen yeniden denetlenir / "
                      "B: bugünkü gibi işlenmez, BİLİNEN SINIR.",
                      "ana oturum iletisi (WK 17'ye ekleme, 06.11.2026): teslim bilgisi kaybolmaz, \"Süresi Doldu\" yüzünden aynı dönemde ikinci ileti gitmez."]},
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


def yil_sonra(ms, tz):
    """S-W3 (README §20 Y15-13): 1 takvim yılı sonrası — yerel saat diliminde aynı tarih ve saat (29 Şubat → 28 Şubat), an hassasiyetinde."""
    d = datetime.fromtimestamp(ms / 1000, tz)
    try:
        d2 = d.replace(year=d.year + 1)
    except ValueError:
        d2 = d.replace(year=d.year + 1, day=28)
    return int(round(d2.timestamp() * 1000))


def donem_coz(donem, t, tz, sablon="ekstre", mut=()):
    """K1: dönem seçimi → {"secim", "anahtar" (eşlik anahtarı), "okumalar": [(bas, son) …]}.
    Eşlik: Bu Ay / Geçen Ay → ("ay", "YYYY-AA") gösterdikleri takvim ayı (seçim adı fark etmez); Son 3 Ay / Tüm Hareketler → ("secim", ad) + R3'te 7 gün;
    özel aralık → ("aralik", bas, son) birebir; Ödeme Hatırlatma → ("gun", yerel gün) (★5). "okumalar": karar metninin TARİH UÇLARINI belirlemediği
    seçimlerde olası okumaların hepsi (kâhin yorumu 17); okumalar arasında ayrışan yaprak {"plan_susuyor"} olur."""
    bugun = datetime.fromtimestamp(t / 1000, timezone.utc if "M123" in mut else tz).date()
    if sablon != "ekstre":
        return {"secim": "hatirlatma", "anahtar": ("gun", bugun.isoformat()), "okumalar": [(None, None)], "tarih": None, "kanon": None, "tarihler": (), "bugun": bugun.isoformat()}
    if donem is None or donem == "tum" or (isinstance(donem, dict) and donem.get("secim") == "tum"):
        return {"secim": "tum", "anahtar": ("secim", "tum"), "okumalar": [(None, None)], "tarih": None, "kanon": None, "tarihler": None, "bugun": bugun.isoformat()}
    if "secim" not in donem:
        # "kanon" (G2 ikinci yarısı): özel aralık KENDİ GÜNÜNDEKİ (toplu işin açıldığı gün — G1) hazır seçime birebir eşitse o seçimin ayı
        ilk = bugun.replace(day=1); gson = ilk - timedelta(days=1); kanon = None
        if (donem["bas"], donem["son"]) == (ilk.isoformat(), bugun.isoformat()):
            kanon = ("ay", ilk.strftime("%Y-%m"))
        elif (donem["bas"], donem["son"]) == (gson.replace(day=1).isoformat(), gson.isoformat()):
            kanon = ("ay", gson.strftime("%Y-%m"))
        return {"secim": "ozel", "anahtar": ("aralik", donem["bas"], donem["son"]), "okumalar": [(donem["bas"], donem["son"])],
                "tarih": (donem["bas"], donem["son"]), "kanon": kanon, "tarihler": ((donem["bas"], donem["son"]),), "bugun": bugun.isoformat()}
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
    # G6: Son 3 Ay'ın o günkü tarihleri = olası okumaların HEPSİ (tarih uçları karar metninde yok — G0 (3) şüphede aynı dönem)
    tarihler = tuple(tekil) if s == "son_3_ay" else ((tarih_,) if tarih_ else ())
    return {"secim": s, "anahtar": anahtar, "okumalar": tekil, "tarih": tarih_, "kanon": None, "tarihler": tarihler, "bugun": bugun.isoformat()}


def tum_tarihleri(cari_, bugun, mut=()):
    """G6: "Tüm Hareketler"in o günkü tarihleri = kişinin İLK hareketi – o gün (baş mimar KAYIT'ı; karar metninde yok — README §12); hareketi yoksa yok.
    J8 + J11 (README §14.10 Y9b-4): kişiye özel dönem = iletideki dönem = ilk hareket – gün (TEK okuma; M157 eski "ilk – son hareket" okumasını ekler).
    Hareketsiz cari (Y9b-5): gün – gün (M156 eski: tarih yok)."""
    tarihler_ = [h["tarih"] for h in cari_.get("hareketler", []) if "M164" in mut or h["tarih"] <= bugun]   # Y9d-3: açılıştan sonra tarihli hareket dönemde yok
    if not tarihler_:
        return () if "M156" in mut else ((bugun, bugun),)
    oku = [(min(tarihler_), bugun)]
    if "M157" in mut and (min(tarihler_), max(tarihler_)) not in oku:
        oku.append((min(tarihler_), max(tarihler_)))
    return tuple(oku)


def tum_kanon(tarihler_, bugun_iso):
    """J8 (Y9-16): Tüm Hareketler'in kişiye özel dönemi o günün (toplu işin açıldığı gün — G1) Bu Ay'ına (ayın 1'i – o gün) ya da Geçen Ay'ına (önceki ayın 1'i –
    son günü; D4 tarihleri) eşitse o kişi için O AYIN dönemi ("ay", YYYY-AA) — G2 kanon düzeni; yoksa None."""
    b = date.fromisoformat(bugun_iso)
    ilk = b.replace(day=1); gson = ilk - timedelta(days=1)
    for x in tarihler_ or ():
        if x == (ilk.isoformat(), b.isoformat()):
            return ("ay", ilk.strftime("%Y-%m"))
        if x == (gson.replace(day=1).isoformat(), gson.isoformat()):
            return ("ay", gson.strftime("%Y-%m"))
    return None


def donem_eslesir(a, b, mut=()):
    """K1 + D4 + G2: a, b = (eşlik anahtarı, tarih, kanon). Aynı dönem:
    - aynı anahtar (aynı takvim ayı / aynı seçim / birebir özel aralık);
    - G2 (1): özel aralık ↔ hazır seçim (Bu Ay / Geçen Ay): özel aralığın tarihleri hazır seçimin KENDİ (açılış) günündeki tarihlerine birebir eşit;
    - G2 (2): özel aralık kendi (açılış) günündeki hazır seçime eşitse o ayın dönemi — öbür özel aralıkla da, hazır seçimle de ("kanon").
    G0 (3) "şüphede aynı dönem": D4'ün iki okuması (eski yorum 23 ve öbür okuma) artık BİRLİKTE uygulanır."""
    if a[0] == b[0]:
        return True
    tur = {a[0][0], b[0][0]}
    if tur == {"aralik"} and "M121" not in mut:
        return a[2] is not None and a[2] == b[2]
    if tur == {"secim", "aralik"} and "M129" not in mut:              # G6 (İLKEYLE G0 3): Son 3 Ay / Tüm'ün o günkü tarihleri = özel aralık (7 gün eslesir'de)
        sec, ozel = (a, b) if a[0][0] == "secim" else (b, a)
        if ozel[1] is not None and ozel[1] in (sec[3] or ()):
            return True
        # J8 (Y9-16) + G2 (2): Tüm Hareketler o kişi için bir ayın dönemiyse (kanon), kendi gününde o aya eşit özel aralıkla da aynı dönem
        return "M148" not in mut and sec[2] is not None and sec[2] == ozel[2]
    if tur == {"secim", "ay"} and "M148" not in mut:                  # J8: Tüm Hareketler ↔ Bu Ay / Geçen Ay (7 gün eslesir'de, Y9-17)
        sec, ay_ = (a, b) if a[0][0] == "secim" else (b, a)
        if sec[0] != ("secim", "tum"):
            return False
        if sec[2] is not None and sec[2] == ay_[0]:                     # Y9-16: kişiye özel dönem = o günün Bu Ay / Geçen Ay'ı → o ayın dönemi
            return True
        return ay_[1] is not None and ay_[1] in ((sec[3] if len(sec) > 3 else None) or ())   # öbür yön: Bu Ay / Geçen Ay'ın KENDİ günündeki tarihleri
    if tur == {"ay", "aralik"} and "M106" not in mut:
        ay_, ozel = (a, b) if a[0][0] == "ay" else (b, a)
        if "M120" not in mut and ozel[1] is not None and ozel[1] == ay_[1]:
            return True
        if "M121" not in mut and ozel[2] is not None and ozel[2] == ay_[0]:
            return True
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
        self.medya_t = []; self.silme_n = 0  # Y10-7: medya yükleme anları; Meta'da GERÇEKTEN silinen (30 günü dolmamış) medya sayısı
        self.kod = None; self.deneme_49 = 0; self.teslim_t = None; self.kabul_t = None
        self.belirsiz_t = None; self.elendi_neden = None; self.meta_sayi = 0; self.gecici_deneme = 0
        # kâhin güncellemesi 2
        self.kayitlar = []          # bu işin gönderim denemeleri (Benzetim.kayitlar kimlikleri) — "Gönderiliyor" anında açılır (talep)
        self.son_kayit = None       # durum değişikliklerinin yazıldığı son deneme (yeni deneme açılınca kopar)
        self.asil_durum = None      # ilk kez yeniden denemeye / Yine de Gönder'e alındığında asıl işteki durumu (programda asıl iş bu durumda kalır)
        self.yeniden = False        # yeniden deneme / Yine de Gönder ile gönderime alındı mı (K4 mutasyonları)
        self.yine_kaynak = ()       # H1: bu iş "Yine de Gönder" ile açıldıysa kaynak Sonucu Belirsiz denemeleri (yeni denemeye "kaynaklar" olarak yazılır)
        self.gec_teslim = None      # K3/K7: teslimsiz kapandıktan sonra gelen teslimin durumu (Teslim Edildi / Okundu) — ekran durumu KÂHİN SUSUYOR
        self.icerik_silindi = None  # S-W3 (Y15-10): içerik + telefon + PDF silindi — "sure" (1 yıl) / "talep" (KVKK); yeniden gönderimde yeni içerik yazılınca kalkar (Y15-21)
        self.icerik_t = None        # S-W3: içeriğin / telefonun işe son yazıldığı an (gönderim anı) — talepten önceki yedekten dönen iş (S-W3-c) bununla tanınır


class Toplu:
    def __init__(self, etiket, sablon, donem, sirket, t, kullanici, coz=None, send_again=False, sira=0):
        self.etiket = etiket; self.sablon = sablon; self.donem = donem; self.sirket = sirket; self.t = t; self.kullanici = kullanici
        self.isler = []; self.durum = "aktif"; self.neden = None; self.gecici = 0
        self.bas = 0; self.sablon_okuma = t; self.okuma_sayac = 0
        self.coz = coz or {"secim": None, "anahtar": None, "okumalar": [(None, None)]}   # K1: başlatmada çözülen dönem (K4: yeniden denemede TAŞINIR)
        self.send_again = send_again     # K5: başlatmada R3 uyarısına "Yine de Gönder" denildi mi
        self.sira = sira                 # K8: aynı anda açılan toplu işlerin sırası


class Benzetim:
    def __init__(self, sen, secim=None, zaman="hizli", mut=frozenset(), okuma=None):
        self.sen = sen; self.zaman = zaman; self.mut = set(mut)
        # güncelleme 11: karar metninin sustuğu yerde okuma (yalnız hesapla_tek; kime / kaç kez okumalarda aynı) + hangi okumaya düşüldüğü
        self.okuma = dict(okuma or {}); self.okuma_izi = set()
        self.baglanti_sd = set()     # SD1837 / SD1915 / SW4: bağlantısı 'Süresi Doldu' olan şirketler (program bilir)
        self.meta_belirtec = {}      # şirket → Meta'nın o şirketin belirtecine döndüğü kod (190 / 0); yeniden bağlanana dek her istek reddedilir
        self.pencere_kayit = []      # SW2: (kabul t, waba, alıcı, deneme kimliği, iş anahtarı) — Süresi Doldu denemenin kabulü pencerede sayılmaz
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
        # kâhin güncellemesi 9: kanca yanıt katmanı (J6), silinmiş şirket (J1/J3), onarım bekleyen kabul (J7)
        self.bildirim_yazilamaz = False; self.acilamaz = set(); self.defter_kilit = False; self.silinen = set()
        self.kanca_yanit = {"200": 0, "503": 0}; self.tanin_ilk = {}; self.yanit_bekleyen = set(); self.ic_sira = 10 ** 6
        self.kanca_cikti = bool(sen.get("kanca_yanit_cikti"))
        self.kontroller = {}; self.baslamadi = {}; self.elenen = {}
        # kâhin güncellemesi 15 (S-W3): silme talepleri (makine düzeyi: (şirket, cari) → an), silinen telefonlar (yalnız M218), saklama alt sınırı (ufku 1 yıldan kısa senaryoda bakılmaz)
        self.kvkk = {}; self.silinen_tel = {}
        # kâhin güncellemesi 16 (S32, Y16-20): talep kaydı makinede (şirket + cari → an); yedekteki kayıt yalnız M234. Güncelleme 17 (S38, Y17-20): taşımada yeni bilgisayara gider
        self.yedek_kvkk = {}
        # kâhin güncellemesi 17 (S33 / S41, README §22 Y17-24): bağlantı yolu — Yol 2 (WhatsApp'ı Bağla; imza kapıcıda doğrulanır — eski senaryoların düzeni) / Yol 1 (Elle Bağla; imzasız kabul)
        self.yol = self.ayar.get("baglanti_yolu") or BAGLANTI_YOLLARI[0]
        if self.yol not in BAGLANTI_YOLLARI:
            raise ValueError(f"girdi: ayar.baglanti_yolu {self.yol!r} (yol1 / yol2)")
        self.saklama_alt = yil_sonra(self.T0, self.tz) - 2 * GUN
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
                for z in (self.ttl_zamani(t), self.okuma_zamani(), self.sablon_okuma_zamani(), self.saklama_zamani()):
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
            self.saklama_isle(t)                                          # S-W3 (Y15-13/14): 1 yılı dolan gönderim kaydının içeriği silinir (program açıkken)
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
                if tp.sirket in self.baglanti_sd:
                    # README §16.4: yeniden bağlanmadan Devam Et karar metninde yok → üç okuma (ret / bekle / dene); kime / kaç kez üçünde aynı
                    self.okuma_izi.add("devam_sd")
                    if self.okuma.get("devam_sd", DEVAM_OKUMALARI[0]) == "ret":
                        return                                           # (a) reddedilir / etkisiz: toplu iş Duraklatıldı kalır
                tp.durum = "aktif"; tp.neden = None; tp.gecici = 0; tp.bas = 0
                tp.baglanti_neden = False; tp.belirtec_neden = None
                for j in tp.isler:
                    if j.durum in (DURAKLATILDI, SORULUYOR, LISANS):
                        self.durum(j, BEKLIYOR, t); j.next_at = t
                        if "M193" in self.mut:
                            j.supheli_elle = False                       # Y12-8'in tersi: elle işareti Devam Et'e taşınmaz
                    elif "M177" in self.mut and j.durum in (KABUL, GONDERILDI):   # SD1837 "kimseye ikinci ileti gitmez"in tersi
                        self.durum(j, BEKLIYOR, t); j.next_at = t
            else:
                tp.durum = "iptal"
                for j in tp.isler:
                    if j.durum in DURDURULABILIR:
                        self.durum(j, IPTAL, t)
        elif tur in ("basarisizlari_yeniden_dene", "yine_de_gonder"):
            if self.toplular[o["toplu"]].sirket in self.baglanti_sd:
                raise ValueError("KÂHİN SUSUYOR (README §16.4): bağlantı Süresi Doldu iken işteki Yine de Gönder / Başarısızları Yeniden Dene modellenmedi")
            (self.yeniden_dene if tur == "basarisizlari_yeniden_dene" else self.yine_de_gonder)(o, t)
        elif tur == "baglanti_suresi_doldu":                            # SD1837 (Y11-7): programın izlediği belirteç süresi doldu; Meta da o belirteci 190 ile reddeder
            s = o.get("sirket", "A")
            self.meta_belirtec[s] = 190
            if "M175" not in self.mut:
                self.sure_doldu(s, t, SURE_DOLDU_NEDEN)
        elif tur == "yeniden_baglan":                                   # SD1837 (Y11-9): yeni geçerli belirteç; duran toplu iş KENDİLİĞİNDEN sürmez (Devam Et)
            s = o.get("sirket", "A")
            self.baglanti_sd.discard(s); self.meta_belirtec.pop(s, None)
            if "M176" in self.mut:
                for tp in self.toplular.values():
                    if tp.sirket == s and tp.durum == "duraklatildi" and getattr(tp, "baglanti_neden", False):
                        self.olay({"tur": "devam", "toplu": tp.etiket}, t)
        elif tur == "yedek_al":                                         # K6/K7: şirket dosyasının o anki kopyası (makine defteri yedeğe girmez)
            self.yedekler[o["ad"]] = copy.deepcopy((self.toplular, self.toplu_sira, self.isler))
            self.yedek_kvkk[o["ad"]] = dict(self.kvkk)                   # yalnız M234 okur (S32: talep kaydı yedeğe GİRMEZ — Y16-20)
        elif tur in ("geri_yukle", "sifirla", "tasindi"):
            if "M13" in self.mut:
                return
            if tur == "geri_yukle" and o.get("yedek"):
                self.dosyayi_geri_yukle(o["yedek"])
                if "M234" in self.mut:
                    self.kvkk = dict(self.yedek_kvkk.get(o["yedek"], {}))   # M234: talep kaydı dosyadaymış gibi yedekle döner
            if tur == "tasindi":
                self.defter = set()                                     # başka bilgisayar: makine defteri o bilgisayarda yok (§6 W2)
                # S38 = A (KULLANICI KARARI 06.11.2026 08:06 UTC; README §22 Y17-20/21): silme talebi kayıtları (şirket + cari + an) taşınır, yeni bilgisayarda da uygulanır — self.kvkk aynen
                if "M245" in self.mut:
                    self.kvkk = {}                                      # M245 (S38'in B'si): talep kaydı eski bilgisayarda kalır
                elif "M246" in self.mut:
                    self.kvkk = {k: t for k in self.kvkk}               # M246: taşınan kaydın anı taşıma anı olur
            for tp in self.toplular.values():
                for j in tp.isler:
                    if tur == "tasindi" and j.durum == GONDERILIYOR:
                        if "M133" in self.mut:
                            self.durum(j, TASINAN, t)
                        else:                                           # H2 (İLKEYLE G0 2): taşımada Gönderiliyor kalan → Sonucu Belirsiz (işteki Yine de Gönder)
                            self.durum(j, BELIRSIZ, t); j.belirsiz_t = t
                        continue
                    if j.durum in DURDURULABILIR:
                        if tur == "sifirla" and j.son_kayit is not None:
                            self.kayitlar[j.son_kayit]["sifir"] = True          # G4: sıfırlamayla duran deneme (yalnız M125 kullanır)
                        self.durum(j, TASINAN if tur == "tasindi" else DURDU_GERI_YUKLEME, t)   # §7a 26
            if tur == "geri_yukle" and "M232" not in self.mut:
                self.talepleri_uygula(t)                                # S32 (Y16-21/22): makinedeki silme talepleri geri yüklemeden SONRA, aynı anda yeniden uygulanır
        elif tur == "liste":
            self.liste(o, t)
        elif tur == "kvkk_sil":                                         # S-W3 (Y15-15): KVKK silme talebi — o carinin gönderim kayıtlarının içeriği / telefonu / PDF'i HEMEN silinir; iz kalır
            cid = o["id"]
            s = self.cariler[cid]["sirket"]
            self.kvkk[(s, cid)] = t
            for j in list(self.isler.values()):
                if j.sirket == s and j.cari == cid and "M219" not in self.mut:
                    self.icerik_sil(j, t, "talep")
            for rec in self.kayitlar.values():                         # makine defteri + dosyadaki denemeler: kâhinde zaten içeriksiz (yalnız iz)
                if rec["sirket"] == s and rec["cari"] == cid:
                    rec["talep_t"] = t                                  # yalnız M221
                    if "M215" in self.mut:
                        rec["iz_silindi"] = True                        # M215: iz de silinir (B seçeneği)
                    if "M226" in self.mut and rec["son_durum"] == BELIRSIZ:
                        rec["belirsiz_silindi"] = True                  # M226: S30 'Sonucu Belirsiz izi kalır'ın tersi
        elif tur == "sirket_sil":                                       # J1/J3 (Y9-4): şirket KALICI silinir — dosyası gider, defter / "Bu Ay" / pencere kalır
            self.sirket_sil(o["sirket"])
        elif tur == "sirket_acilamaz":                                  # J6: şirket geçici açılamıyor (bildirimine 503)
            (self.acilamaz.add if o["acik"] else self.acilamaz.discard)(o["sirket"])
        elif tur == "bildirim_yazilamaz":                               # J6: bildirim kaydedilemiyor (503)
            self.bildirim_yazilamaz = bool(o["acik"])
        elif tur == "defter_yazilamaz":                                 # J7 (Y9e-1): gönderim defteri (makine düzeyi) yazılamıyor; kapanınca onarım
            self.defter_kilit = bool(o["acik"])
            if not self.defter_kilit and "M165" not in self.mut:
                for rec in self.kayitlar.values():
                    rec.pop("onarim", None)                             # Y9e-2: eksik kabul deftere yazıldı
        elif tur == "_yanit":                                           # J6/J7: gecikmeli Meta yanıtı (iç olay)
            self.yanit_gel(o, t)
        elif tur == "meta_basamak":
            self.meta["basamak"] = o["basamak"]
        elif tur == "meta_sablon":
            st = self.meta["sablonlar"].setdefault(o["ad"], {"durum": None, "kategori": None})
            for k in ("durum", "kategori", "teslim_suresi_sn"):        # W2: Meta listesindeki teslim süresi değişebilir (None = bildirmez)
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
            ek = {"opaque": o.get("opaque"), "sahte": True, "imzali": bool(o.get("imzali")), "olay_t": t}
            if o.get("adres"):
                ek["adres"] = o["adres"]                                # güncelleme 17 (S41, Y17-24): bildirimin geldiği adres (yoksa alternatif)
            self.kanca_planla(t, wamid, o["durum"], o.get("kod"), ek)
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
            m196 = "M196" in self.mut and j.durum == ATLANDI and j.elendi_neden == SUPHELI   # Y12-5'in tersi: S7-b ile atlanan iş kuyrukta sayılır
            m196 = m196 or ("M239" in self.mut and j.durum == ATLANDI and j.elendi_neden in SILME_NEDEN.values())   # S35 (Y17-8)'in tersi: talep anında kapanan iş kuyrukta sayılır
            if j.sirket != sirket or j.cari != cid or (j.durum not in durumlar and not m196) or self.toplular[j.toplu].sablon != sablon:
                continue
            if sablon == "hatirlatma":
                if "M105" in self.mut and j.anahtar_donem != ctx[0]:
                    continue
                return True
            if not donem_eslesir((j.anahtar_donem, j.tarih_donem, j.kanon_donem, j.tarihler_donem), ctx, self.mut):
                continue
            if "M72" in self.mut and ctx[0][0] == "secim" and t - self.toplular[j.toplu].t >= R3_PENCERE:
                continue
            return True        # güncelleme 17: S35 = A — talep anında kapanan iş Atlandı'dır, kuyrukta değil (güncelleme 16'nın S30-a hatası kalktı; M238 / M240 işi kuyrukta tutar)
        return False

    def dosyadaki_kayitlar(self):
        ids = set()
        for j in self.isler.values():
            ids.update(j.kayitlar)
        return ids

    def gorunen_kayitlar(self):
        """Gönderim denemeleri: makine defteri ∪ şirket dosyasındaki işlerin kendi denemeleri (kâhin yorumu 18; D7 + D8 kullanıcı kararı) → [(kayıt, dosyada mı)]."""
        dosyada = self.dosyadaki_kayitlar()
        return [(self.kayitlar[i], i in dosyada, i) for i in sorted(set(self.defter) | dosyada)
                if not ("M215" in self.mut and self.kayitlar[i].get("iz_silindi"))]   # S-W3 (Y15-11): silinen kaydın anonim izi KALIR (M215 siler)

    def sayilir(self, rec):
        """§7a R3 + K3 + K7: "Daha Önce Gönderildi" = Meta Kabul Etti ve sonrası; Süresi Doldu, Başarısız (Meta Bekletti 2. deneme reddi dahil), İptal,
        geri yükleme / taşıma ile duran (teslim yok) SAYILMAZ; teslim (delivered/read) bildirimi geldiyse SAYILIR."""
        if rec["teslim"] and ("M76" not in self.mut or rec["son_durum"] in GONDERILMIS):
            return True
        if not rec["kabul"]:
            return False
        sd = rec["son_durum"]
        return (sd in GONDERILMIS or ("M67" in self.mut and sd == BASARISIZ) or ("M77" in self.mut and sd == BEKLEME_131049)
                or ("M78" in self.mut and sd == IPTAL) or ("M79" in self.mut and sd in (DURDU_GERI_YUKLEME, TASINAN))
                or ("M125" in self.mut and rec.get("sifir")))

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
        if not donem_eslesir((rec["anahtar"], rec.get("tarih"), rec.get("kanon"), rec.get("tarihler")), ctx, self.mut):
            return False
        sec_ctx, sec_rec = ctx[0][0] == "secim", rec["anahtar"][0] == "secim"
        if sec_ctx and sec_rec:
            if "M71" in self.mut:
                return False
            return "M70" in self.mut or (t if pencere_t is None else pencere_t) - rec["t"] <= R3_PENCERE   # İLKEYLE G0 (3): tam 7. gün şüphede aynı dönem
        if sec_ctx or sec_rec:                                       # G6: Son 3 Ay / Tüm ↔ özel aralık — 7 gün penceresi bu eşlikte de
            return "M130" in self.mut or (t if pencere_t is None else pencere_t) - rec["t"] <= R3_PENCERE
        return True

    def onceden_gonderildi(self, cid, sablon, ctx, sirket, t, sinir=None, pencere_t=None):
        """§7a R3 + K1/K3/K5/K7 + D3/D7/D8: eşleşen ve sayılan denemelerin en son gönderim anı (programın saati, K5), yoksa None.
        sinir (K5): asıl işin "Yine de Gönder" kararı varsa asıl işin açılış anı — o andan ÖNCEKİ (ve aynı andaki) gönderimler yok sayılır.
        Kaynak: makine defteri (D7: geri yüklemeden sonra yalnız defterde kalan kabul SAYILIR) ∪ şirket dosyası (D8: taşınan veride dosyadaki kabul / teslim SAYILIR)."""
        if "M65" in self.mut:
            return None
        en = None; en_tum = None
        for rec, dosyada, rid in self.gorunen_kayitlar():
            if ("M103" in self.mut and not dosyada) or ("M104" in self.mut and rid not in self.defter):
                continue
            if not self.eslesir(rec, cid, sablon, ctx, sirket, t, pencere_t):
                continue
            if sinir is not None and rec["t"] < sinir:                  # İLKEYLE G0 (3): açılışla AYNI ANDA giden şüphede "sonra" (elenir)
                continue
            en_tum = rec["t"] if en_tum is None else max(en_tum, rec["t"])
            if self.sayilir(rec):
                en = rec["t"] if en is None else max(en, rec["t"])   # H4: son kabul/teslim edilen (sayılan) denemenin anı
        return en_tum if ("M135" in self.mut and en is not None) else en

    def silinmis_belirsiz_ekstre_t(self, cid, sablon, ctx, sirket, t):
        """Yalnız M241 (S36'nın B seçeneği, README §22 Y17-13): kişinin aynı dönemdeki Sonucu Belirsiz denemesi içeriği silinmiş bir EKSTRE işinin ise o denemenin anı, değilse None."""
        if sablon != "ekstre":
            return None
        for rec, dosya_mi, _rid in self.gorunen_kayitlar():
            sahip = self.isler.get(rec["is"])
            if (dosya_mi and rec["son_durum"] == BELIRSIZ and sahip is not None and sahip.icerik_silindi
                    and self.eslesir(rec, cid, sablon, ctx, sirket, t, belirsiz=True)):
                return rec["t"]
        return None

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
        gorunen = self.gorunen_kayitlar()
        cozulen = set()                                                    # H1: Yine de Gönder ile açılan iş kabul/teslim edildi → kaynak belirsiz artık elemez
        if "M131" not in self.mut:
            for r2, _, _ in gorunen:
                if r2.get("kaynaklar") and ("M132" in self.mut or self.sayilir(r2)):
                    cozulen.update(r2["kaynaklar"])
        bulunan = None
        for rec, dosya_mi, rid in gorunen:
            if rid in cozulen:
                continue
            if rid == haric or rec["son_durum"] != BELIRSIZ:
                continue
            if not self.eslesir(rec, cid, sablon, ctx, sirket, t, belirsiz=True):
                m242 = ("M242" in self.mut and sablon == "ekstre" and rec["sablon"] == sablon and rec["cari"] == cid and rec["sirket"] == sirket
                        and getattr(self.isler.get(rec["is"]), "icerik_silindi", None))   # S36 (Y17-13) dönem sınırının tersi: silinmiş belirsiz Ekstre izi her dönemi eler
                if not m242:
                    continue
            if "M226" in self.mut and rec.get("belirsiz_silindi"):        # S30 (Y16-13): silinen kişinin belirsiz izi KALIR (M226 siler)
                continue
            if "M124" in self.mut and rid not in self.defter:              # G3'ün tersi: taşınan veride dosyadaki belirsiz sayılmaz
                continue
            sahip = self.isler.get(rec["is"])
            if "M126" in self.mut and sahip is not None and sahip.deneme_49 >= 1:   # G5'in tersi
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
        if j.icerik_silindi and tp.sablon == "ekstre":
            # S31 (Y16-16/17): Ekstre'de çağıranlar (yeniden_dene / yine_de_gonder) bu işi `icerik_silindi` ile eler; buraya yalnız S31'in B'si (M230 / M231) gelir:
            # içerik açılış günü verisiyle yeniden üretilir (J12 düzeni), iş gider
            j.hazir = self.icerik(self.cariler[j.cari], tp, tp.t, j)
        # S37 = B (KULLANICI KARARI 06.11.2026 08:06 UTC; README §22 Y17-16/17): içeriği silinmiş Ödeme Hatırlatma aynı iş üzerinden yeniden gönderilir — içerik (ve telefon) gönderim
        # anında karttan yeniden hazırlanır (isci; `icerik_silindi` orada kalkar). Güncelleme 16'nın S31-a hatası kalktı.
        if j.asil_durum is None:
            j.asil_durum = j.durum
        if j.durum == ATLANDI:
            j.elendi_neden = None                                        # güncelleme 13 (S16 'gonderim' okuması) + 14 (S22 yolu, Y14-4): Atlandı işin asıl işten yeniden gönderimi — eski atlanma nedeni kalkar
        j.son_kayit = None
        j.yeniden = True
        j.yine_kaynak = ()
        if "M193" in self.mut:
            j.supheli_elle = False                                       # Y12-8'in tersi: elle işareti yeniden denemeye taşınmaz
        if "M87" in self.mut:
            j.coz_ozel = donem_coz(tp.donem, t, self.tz, tp.sablon, self.mut)
            j.anahtar_donem, j.tarih_donem, j.kanon_donem, j.tarihler_donem = self.kisi_ctx(j.coz_ozel, j.cari)
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
            if self.s31_eler(j, tp, sonuc):
                continue                                                # S31 (Y16-16/17): içeriği silinmiş Ekstre işi yeniden gönderilemez — tek neden, E2 sırasından önce
            ctx = (j.anahtar_donem, j.tarih_donem, j.kanon_donem, j.tarihler_donem)
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
                    elif "M127" in self.mut:
                        continue
                    # İLKEYLE G0 (1, 4): sonraki denemesi teslimsiz durdu (Durduruldu / Taşınan / İptal / Süresi Doldu / Atlandı) → kesin almadı → yeniden gönderilir
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
        sonuc = {"elenen": {}, "alinan": [], "oneri": None, "supheli_etiketi": []}
        # İLKEYLE G0 (4) + D6 "her seferinde onaylı Yine de Gönder": asıl işte belirsiz kalan deneme (hedef "asil") de Yine de Gönder ile gönderilebilir — çıkmaz yok
        asil_belirsiz = o.get("hedef") == "asil" and j.asil_durum == BELIRSIZ and "M128" not in self.mut
        if j.durum == BELIRSIZ or asil_belirsiz:
            if self.s31_eler(j, tp, sonuc, yine=True):                 # S31 (Y16-16/17): içeriği silinmiş (Sonucu Belirsiz) Ekstre işi bu yolla da gönderilemez
                if o.get("etiket"):
                    self.yeniden_sonuc[o["etiket"]] = sonuc
                return
            ctx = (j.anahtar_donem, j.tarih_donem, j.kanon_donem, j.tarihler_donem)
            c = self.cariler[j.cari]
            hat = tp.sablon == "hatirlatma"
            # S16 (Y13-1): basma ANINDA şüpheli kaydı açık Ödeme Hatırlatma carisi (M208: kapanmış kalem de açık sayılır)
            acik = hat and (self.supheli_acik(c) or ("M208" in self.mut and any(v.get("supheli") for v in c.get("vadeler", []))))
            # S23 (eski S7-e, README §20 Y15-1): belirsizlik onayıyla gönderim anından ÖNCE bekleyen, elle işaretsiz işte kayıt AÇIKKEN asıl işte yeniden basma → bekleyen iş S16
            # ile elle sayılır, yeni iş açılmaz, F1 "Zaten Kuyrukta" uygulanmaz (Y15-2…4); Hazırlanıyor / Gönderiliyor ve elle işaretli iş F1 aynen (aşağıdaki yol)
            s23 = (acik and j.durum in S23_BEKLEYEN and getattr(j, "belirsiz_onay", False) and not getattr(j, "supheli_elle", False)
                   and "M199" not in self.mut)
            if (acik or ("M209" in self.mut and not hat and self.supheli_acik(c))) and "M201" not in self.mut:
                sonuc["supheli_etiketi"].append(j.cari)                    # Y13-4: onay penceresinde "Şüpheli Alacağı Var" (yanıttan önce — elense de görünür)
            if s23:
                self.s23_yeniden_bas(j, tp, c, t, sonuc)
                if o.get("etiket"):
                    self.yeniden_sonuc[o["etiket"]] = sonuc
                return
            s16 = (acik and "M199" not in self.mut                          # S16: Yine de Gönder elle seçim sayılır (M199: B seçeneği)
                   and not ("M212" in self.mut and j.durum == ATLANDI and j.elendi_neden == SUPHELI))   # M212: S22 yolunda (Y14-4) yeniden basmada S16 yok
            s16_engel = None
            if s16 and "M200" not in self.mut:
                s16_engel = self.hatirlatma_engeli(c, t)                    # basma anında şüphesiz tutar (S7A + S17 / NB5 sınırı — Y13-3, Y13-8)
            # S34 = A (KULLANICI KARARI 06.11.2026 08:06 UTC; README §22 Y17-1…3): basmada şüphesiz tutar yoksa da iş ALINIR (elle), gönderim anındaki tutarla gider, yoksa gönderim
            # anında "Atlandı — Gecikmiş Borç Yok" (S16 "yoksa elenir" gönderim anında; güncelleme 13'ün `s16_an` iki okuması ve "ayrışma" hatası kalktı)
            if s16_engel is not None and "M236" in self.mut:
                sonuc["elenen"][j.cari] = s16_engel                         # M236 (S34'ün B'si): basmada elenir; iş Sonucu Belirsiz kalır
            elif "M111" not in self.mut and self.kuyrukta(j.cari, tp.sablon, ctx, tp.sirket, t):
                sonuc["elenen"][j.cari] = "zaten_kuyrukta"                  # E2 + F1: işteki Yine de Gönder'de de bekleyen ileti eler
            elif "M118" in self.mut and self.belirsiz_kaynagi(j.cari, tp.sablon, ctx, tp.sirket, t, haric=j.son_kayit):
                sonuc["elenen"][j.cari] = BELIRSIZ_NEDEN                    # M118: F1'in tersi (başka denemenin belirsizi eler)
            elif self.onceden_gonderildi(j.cari, tp.sablon, ctx, tp.sirket, t, sinir=self.karar_siniri(tp, "M83"),
                                         pencere_t=tp.t if "M98" in self.mut else None) is not None:
                sonuc["elenen"][j.cari] = DAHA_ONCE
            else:
                kaynak = tuple(r for r in j.kayitlar if self.kayitlar[r]["son_durum"] == BELIRSIZ)   # H1: aşılan Sonucu Belirsiz deneme(ler)
                self.tasi(j, tp, t)
                j.yine_kaynak = kaynak
                j.belirsiz_onay = True                                          # J10 (07:11 a): belirsizlik onayı izi (yeniden denemeye taşınır — c)
                if s16:
                    j.supheli_elle = True                                       # S16 (Y13-2): elle seçim sayılır — işte kalır (Y12-7 / Y12-8)
                j.s34_t = t if s16_engel is not None else None                  # S34: basmada şüphesiz tutar yoktu (yalnız M237 okur — tutarı basma anına sabitler)
                if "M200" in self.mut and acik and "M199" not in self.mut:
                    j.m200 = True
                tp.durum = "aktif"; tp.bas = 0
                sonuc["alinan"].append(j.cari)
        if o.get("etiket"):
            self.yeniden_sonuc[o["etiket"]] = sonuc

    def s23_yeniden_bas(self, j, tp, c, t, sonuc):
        """S23 = A (KULLANICI KARARI 06.11.2026 06:03 UTC; README §20 Y15-2…6): bekleyen iş S16 ile ELLE sayılır (işaret işte kalır — Y12-7 / Y12-8), yeni iş / deneme açılmaz (iş
        durumu ve bekleme anı değişmez — Y15-3), F1 "Zaten Kuyrukta" uygulanmaz (Y15-4); gönderim anında şüphesiz tutarla gider (isci: S7 elle yolu, S17). Yanıtta `elle_sayilan`.
        S29 = A (KULLANICI KARARI 06.11.2026 06:52 UTC; README §21 Y16-1…3): basmada şüphesiz tutar YOKSA da iş elle sayılır — gönderim anındaki şüphesiz tutarla gider, yoksa
        gönderim anında "Atlandı — Gecikmiş Borç Yok" (güncelleme 15'in `s23_an` iki okuması kalktı; 'basma' okuması S29'un B seçeneği = M223)."""
        sonuc["elle_sayilan"] = []                                         # S23 tetiği (anahtar var)
        if "M213" in self.mut:                                             # S23'ün B seçeneği: F1 aynen
            sonuc["elenen"][j.cari] = "zaten_kuyrukta"
            return
        engel = self.hatirlatma_engeli(c, t)                               # basma anında şüphesiz tutar (S7-a + S17 + (5))
        if engel is not None and "M223" in self.mut:
            sonuc["elenen"][j.cari] = engel                                # S29'un B seçeneği: yanıtta elenir, iş işaretsiz kalır (gönderim anında S22)
            return
        j.supheli_elle = True                                              # S23 + S29: bekleyen iş elle sayılır (basmada tutar olsun olmasın)
        sonuc["elle_sayilan"].append(j.cari)
        if engel is not None:
            j.s29_t = t                                                    # S29: basmada şüphesiz tutar yoktu (yalnız M224 okur — tutarı basma anına sabitler)
        if "M214" in self.mut:                                             # 'yeni iş açılmaz'ın tersi: asıl işten yeni (elle) iş — bekleyen iş de gider
            n = 2
            anahtar = f"{tp.etiket}/{j.cari}#{n}"
            while anahtar in self.isler:
                n += 1; anahtar = f"{tp.etiket}/{j.cari}#{n}"
            j2 = Is(anahtar, tp.etiket, j.cari, j.sirket)
            for a in ("anahtar_donem", "tarih_donem", "kanon_donem", "tarihler_donem", "coz_ozel"):
                setattr(j2, a, getattr(j, a, None))
            j2.supheli_elle = True; j2.belirsiz_onay = True; j2.yeniden = True; j2.asil_durum = BELIRSIZ; j2.next_at = t
            tp.isler.append(j2); self.isler[anahtar] = j2
            sonuc["alinan"].append(j.cari)

    # ---- S-W3: saklama süresi + KVKK silme (README §20 Y15-10…22) ----------------------------------------------------------------
    def kart_telefonu(self, cid):
        """§7a 1, 6 + Y15-16: telefon GÖNDERİM ANINDA carinin kartından — silinen telefon yeniden kullanılmaz (M218: kart boşsa silinmiş kayıttaki telefon)."""
        c = self.cariler[cid]
        ham = c.get("telefon")
        if ham is None and "M218" in self.mut:
            ham = self.silinen_tel.get((c["sirket"], cid))
        return ham

    def saklama_baslangici(self, j):
        """Y15-13: işin SON gönderim denemesinin anı (Gönderiliyor); denemesi yoksa toplu işin açılış anı."""
        if j.kayitlar:
            return max(self.kayitlar[r]["t"] for r in j.kayitlar)
        tp = self.toplular.get(j.toplu)
        return tp.t if tp is not None else self.T0

    def saklama_bitisi(self, j):
        """Y15-13: başlangıç + 1 takvim yılı (yerel an). M216 / M217: ±1 gün; M220: UTC günü (kaydın UTC günü + 1 yıl, o günün başı)."""
        b = self.saklama_baslangici(j)
        if "M220" in self.mut:
            d = datetime.fromtimestamp(b / 1000, timezone.utc)
            return yil_sonra(int(datetime(d.year, d.month, d.day, tzinfo=timezone.utc).timestamp() * 1000), timezone.utc)
        s = yil_sonra(b, self.tz)
        if "M216" in self.mut:
            s += GUN
        if "M217" in self.mut:
            s -= GUN
        return s

    def icerikli(self, j):
        return not j.icerik_silindi and (j.telefon is not None or j.icerik is not None or getattr(j, "hazir", None) is not None)

    def saklanacak(self, j):
        """S-W3 (Y15-13) + S30 (Y16-14): 1 yıl kuralının baktığı iş — içeriği / telefonu duran iş ve (S30) içeriği henüz yazılmamış BEKLEYEN iş (M229 bakmaz)."""
        if j.icerik_silindi:
            return False
        return self.icerikli(j) or (j.durum in S30_BEKLEYEN and "M229" not in self.mut)

    def saklama_zamani(self):
        if self.saklama_alt > self.bitis:
            return None
        en = None
        for j in self.isler.values():
            if self.saklanacak(j) and not ("M222" in self.mut and getattr(j, "yedekten", False)):
                z = self.saklama_bitisi(j)
                if en is None or z < en:
                    en = z
        return en

    def saklama_isle(self, t):
        """SW3 (Y15-13/18): 1 yılı dolan işin içeriği silinir — yedekten dönen iş dahil (ilke 5; M222 ayırır); S30: bekleyen iş gönderilmez."""
        if self.saklama_alt > self.bitis:
            return
        for j in list(self.isler.values()):
            if self.saklanacak(j) and t >= self.saklama_bitisi(j) and not ("M222" in self.mut and getattr(j, "yedekten", False)):
                self.icerik_sil(j, t, "sure")

    def icerik_sil(self, j, t, neden):
        """SW3 (Y15-10/11): içerik (değişkenler, PDF, dosya adı, açılışta hazırlanan ekstre) + telefon silinir; iz (tarih, dönem, cari, şablon + sonuç ve sayaçlar) kalır.
        S30 = A (KULLANICI KARARI 06.11.2026 06:52 UTC; README §21 Y16-8…14): BEKLEYEN iş (S30_BEKLEYEN; zincir dahil) GÖNDERİLMEZ; Sonucu Belirsiz iş iz olarak KALIR (aynı dönem eler —
        belirsiz_kaynagi). S35 = A (KULLANICI KARARI 06.11.2026 08:06 UTC; README §22 Y17-6…8): bekleyen iş talep (ve 1 yıl dolumu) ANINDA kapanır — "Atlandı — Silme Talebi"
        (`silme_talebi` / `saklama_suresi`), kuyrukta değil (güncelleme 16'nın `s30_an` iki okuması kalktı; 'gonderimde' okuması M238 / M240). Gönderiliyor (istek gitti, yanıt bekleniyor)
        modellenmedi — S35 "bekleyen iş" der (README §22.9 S35-a ★)."""
        if j.durum == GONDERILIYOR:
            raise ValueError("KULLANICIYA SORULMALI S35-a (README §22.9; WK 16 KÂHİN SUSUYOR §21.7, Y16-9): " + ("silme talebi" if neden == "talep" else "1 yıllık saklama süresinin dolması")
                             + f" anında iş Gönderiliyor (istek gitti, yanıt bekleniyor — {j.anahtar}) — S35 yalnız bekleyen işi söyler; kodlanmadı")
        bekleyen = j.durum in S30_BEKLEYEN and not ("M225" in self.mut                                       # S30'un B seçeneği: kartla gider
                                                    or ("M227" in self.mut and j.durum == BEKLEME_131049)
                                                    or ("M228" in self.mut and j.durum in (DURAKLATILDI, LISANS, SORULUYOR)))
        if j.telefon is not None:
            self.silinen_tel[(j.sirket, j.cari)] = j.telefon                # yalnız M218 okur
        j.telefon = None; j.icerik = None
        if getattr(j, "hazir", None) is not None:
            j.hazir = None
        j.icerik_silindi = neden
        if "M215" in self.mut:
            for r in j.kayitlar:
                self.kayitlar[r]["iz_silindi"] = True
        if "M226" in self.mut:
            for r in j.kayitlar:
                if self.kayitlar[r]["son_durum"] == BELIRSIZ:
                    self.kayitlar[r]["belirsiz_silindi"] = True          # M226: S30 'Sonucu Belirsiz izi kalır'ın tersi
        if bekleyen:
            ad = SILME_NEDEN[neden]
            if "M238" in self.mut or ("M240" in self.mut and neden == "sure"):
                j.silme_bekliyor = ad                                     # M238 / M240 (S35'in B'si): içeriksiz kuyrukta kalır ("Zaten Kuyrukta"); isci gönderim anında atlar
            else:
                self.atla(j, ad, t)                                       # S35 = A: o anda "Atlandı — Silme Talebi" — kuyrukta değil, R3'te sayılmaz

    def s31_eler(self, j, tp, sonuc, yine=False):
        """S31 = A (KULLANICI KARARI 06.11.2026 06:52 UTC; README §21 Y16-16/17): içeriği silinmiş EKSTRE işi aynı iş üzerinden yeniden gönderilemez — yanıtta `elenen`
        `icerik_silindi` ("neden görünür"; M235 yazmaz), iş durumu değişmez. M230 (B: içerik yeniden üretilir) iki yolda, M231 yalnız işteki Yine de Gönder'de eleme yapmaz.
        S37 = B (KULLANICI KARARI 06.11.2026 08:06 UTC; README §22 Y17-16/17): Ödeme Hatırlatma bu yoldan ELENMEZ — yeniden gönderilir, içerik gönderim anında karttan (M243: A seçeneği,
        iki yolda elenir; M244: yalnız işteki Yine de Gönder'de elenir)."""
        if not j.icerik_silindi or "M230" in self.mut or (yine and "M231" in self.mut):
            return False
        if tp.sablon != "ekstre" and not ("M243" in self.mut or (yine and "M244" in self.mut)):
            return False
        if "M235" not in self.mut:
            sonuc["elenen"][j.cari] = ICERIK_SILINDI
        return True

    def icerik_yazim_ani(self, j):
        """S32 (Y16-21): işin içeriğinin / telefonunun yazıldığı an — gönderim anı (icerik_t); yalnız açılışta hazırlanmış Ekstre içeriği varsa toplu işin açılış anı; içerik yoksa None."""
        if j.icerik_t is not None:
            return j.icerik_t
        if getattr(j, "hazir", None) is not None and j.toplu in self.toplular:
            return self.toplular[j.toplu].t
        return None

    def talepleri_uygula(self, t):
        """S32 = A (KULLANICI KARARI 06.11.2026 06:52 UTC; README §21 Y16-20…23): geri yüklemeden SONRA makinedeki silme talepleri yeniden uygulanır — geri yüklenen dosyada
        o carinin talep anından ÖNCE yazılmış içeriği + telefonu silinir (GELMEZ); talepten SONRA yazılmış içerik kalır (M233 onu da siler)."""
        for j in list(self.isler.values()):
            tt = self.kvkk.get((j.sirket, j.cari))
            yazim = self.icerik_yazim_ani(j)
            if tt is None or j.icerik_silindi or yazim is None:
                continue
            if yazim < tt or "M233" in self.mut:
                self.icerik_sil(j, t, "talep")

    def icerik_gorunum(self, j):
        """İşin içerik alanları (sonuç ve `kontrol {icerik: true}`): silinmişse null + icerik_silindi. S32 (Y16-21): talepten önceki yedekten dönen içerik geri yüklemede yeniden
        silinir (güncelleme 15'in S-W3-c plan_susuyor'u kalktı); S38 (Y17-21/22): taşımadan sonra da (talep kaydı taşınır) — güncelleme 16'nın S32-a plan_susuyor'u kalktı."""
        g = {"telefon": j.telefon, "degiskenler": j.icerik["degiskenler"] if j.icerik else None,
             "pdf": j.icerik["pdf"] if j.icerik else None, "dosya_adi": j.icerik["dosya_adi"] if j.icerik else None}
        if j.icerik_silindi:
            g["icerik_silindi"] = True
        return g

    def dosyayi_geri_yukle(self, ad):
        """Daha önce alınmış yedeğe dönüş: şirket dosyası (toplu işler + işler) yedekteki hâline döner; makine defteri, Meta'nın kaydı, gönderim sayacı,
        "Bu Ay" (§7a 19) ve bekleyen kancalar KALIR. Yedekten sonra açılan işler dosyadan çıkar (Meta'daki iletileri kalır)."""
        toplular, sira, isler = copy.deepcopy(self.yedekler[ad])
        self.toplular, self.toplu_sira, self.isler = toplular, sira, isler
        for j in isler.values():
            j.yedekten = True                                            # S-W3 (Y15-18): yedekten dönen iş — saklama kuralı aynen (yalnız M222 ayırır)
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

    def gecikmis(self, c, t, supheli_dahil=False):
        """§7a 20: vadesi geçmiş açık kalemler (girdi: cari 'vadeler' [{vade, kalan, supheli?}]; gecikmiş = vade < bugün — kâhin yorumu).
        S7 (Y11-19): şüpheli alacak kaydına alınmış kalem ({"supheli": true}) Ödeme Hatırlatma'nın gecikmiş tutarına GİRMEZ (supheli_dahil yalnız M182).
        S7A (Y12-1): şüpheli alacaklı caride "şüphesiz gecikmiş borç" = bu küme (yerel gün; M198 UTC günü)."""
        bugun = tarih(t, timezone.utc if "M198" in self.mut else self.tz)
        return sorted((v for v in c.get("vadeler", []) if v["vade"] < bugun and Decimal(str(v["kalan"])) > 0 and (supheli_dahil or not v.get("supheli"))),
                      key=lambda v: v["vade"])

    def supheli_acik(self, c):
        """S7 (Y11-17): carinin açık şüpheli alacak kaydı var mı (kalanı > 0 olan {"supheli": true} kalem; vadesine bakılmaz).
        S7B (Y12-7): kuyrukta kapanan kayıt (bütün şüpheli kalemlerin kalanı 0) açık DEĞİL (M194 kalanına bakmaz)."""
        return any(v.get("supheli") and ("M194" in self.mut or Decimal(str(v["kalan"])) > 0) for v in c.get("vadeler", []))

    def net_borc(self, c, t):
        """NB5 (Y13-6): net borç = hareketlerden bakiye (borç − alacak; alış faturası alacak tarafında), {{5}} ile aynı kesim (tarih ≤ bugün, yerel gün).
        S17 (Y13-8): şüpheli kalemler HARİÇ — açık şüpheli kalemlerin (kalanı > 0; vadesine bakılmaz) kalanı düşülür; kayıt kapalıysa düşülecek yok (formül (5)'e iner).
        M202 (S17 B): düşülmez (toplam net borç); M182 (şüpheli dahil tutar): düşülmez; M203: yalnız vadesi geçmiş şüpheli kalem düşülür."""
        bugun = tarih(t, self.tz)
        bakiye = sum((Decimal(str(h.get("borc", 0))) - Decimal(str(h.get("alacak", 0))) for h in c["hareketler"] if h["tarih"] <= bugun), Decimal("0"))
        if "M202" in self.mut or "M182" in self.mut:
            return bakiye
        sup = sum((Decimal(str(v["kalan"])) for v in c.get("vadeler", [])
                   if v.get("supheli") and Decimal(str(v["kalan"])) > 0 and ("M203" not in self.mut or v["vade"] < bugun)), Decimal("0"))
        return bakiye - sup

    def hatirlatma_tutari(self, c, t):
        """§7a 20 + NB5 + S17: (vadesi geçmiş şüphesiz kalemler, {{4}} tutarı = min(kalemlerin toplamı, şüphesiz net borç)) — kalem yoksa (kalemler, None).
        M182: toplam şüpheli kalemleri de içerir (sınır da şüpheli dahil); M204: net sınırı yok (eski §7a 20)."""
        gec = self.gecikmis(c, t)
        if not gec:
            return gec, None
        kalemler = self.gecikmis(c, t, supheli_dahil=True) if "M182" in self.mut else gec
        toplam = sum((Decimal(str(v["kalan"])) for v in kalemler), Decimal("0"))
        if "M204" in self.mut:
            return gec, toplam
        return gec, min(toplam, self.net_borc(c, t))

    def hatirlatma_engeli(self, c, t, gonderim=False):
        """§7a 20 + S7A + NB5 + S17 (Y13-3, Y13-7, Y13-8): Ödeme Hatırlatma'da hatırlatılacak tutar yoksa eleme adı, varsa None.
        Sıra: vadesi geçmiş (şüphesiz) kalem kümesi boş → 'gecikmis_borc_yok' (eski ad aynen); sınırlanmış tutar ≤ 0 → ad karar metninde yok → secenek (NET_ENGEL)."""
        if "M207" in self.mut and self.net_borc(c, t) <= 0:
            return self.NET_ENGEL
        gec, tutar = self.hatirlatma_tutari(c, t)
        if not gec:
            return "gecikmis_borc_yok"
        if "M204" in self.mut or (gonderim and "M206" in self.mut):
            return None
        if tutar < 0 or (tutar == 0 and "M205" not in self.mut):
            return self.NET_ENGEL
        return None

    def baslat(self, o, t):
        etiket = o["etiket"]; sirket = o.get("sirket", "A"); sablon = o.get("sablon", "ekstre")
        kullanici = o.get("kullanici", "yonetici")
        istek = o.get("istek")
        if istek is not None and istek in self.istekler and "M38" not in self.mut:   # §7a 9: aynı istek kimliği tek toplu iş
            self.ayni_istek[etiket] = self.istekler[istek]
            return
        neden = None
        if self.meta_belirtec.get(sirket) is not None and sirket not in self.baglanti_sd:
            raise ValueError("KÂHİN SUSUYOR (README §16.4): Meta belirteci geçersizken (program bilmiyor) toplu gönderim başlatma modellenmedi")
        st = self.meta["sablonlar"].get(ICERIK_SABLON[sablon]) or {}
        if not self.ayar["bagli"]:                                          # §7a 29 sırası
            neden = "bagli_degil"
        elif sirket in self.baglanti_sd and "M179" not in self.mut:
            neden = SURE_DOLDU_NEDEN                                        # P6 §1 W-1 (a) "süre dolunca gönderim başlatılamaz" (Y11-11: bağlantı durumundan hemen sonra)
        elif not self.kullanicilar.get(kullanici, {}).get("whatsapp.send") and "M18y" not in self.mut:
            neden = "yetki_yok"
        elif not self.lisans and "M18" not in self.mut:
            neden = "lisans_salt_okunur"
        elif not self.ayar["onay"] and "M17" not in self.mut:
            neden = "onay_yok"
        elif "M8" not in self.mut and (st.get("durum") != "APPROVED" or st.get("kategori") != "UTILITY"):
            neden = "sablon_uygun_degil"
        elif "M147" not in self.mut and any(r.get("onarim") for r in self.kayitlar.values()):
            neden = ONARIM                                                  # J7 (Y9e-2): kabulü deftere yazılamamış deneme (sıranın sonunda)
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
            tel, tur_ = numara(self.kart_telefonu(cid))                   # Y15-16: karttan (silinen telefon kullanılmaz)
            if tel is None:
                elenen[cid] = tur_; continue                              # §7a 6: E.164'e çevrilemeyen elenir
            if tur_ == "sabit" and "M53" in self.mut:
                elenen[cid] = "sabit_hat"; continue                       # §7a 6 (K1): sabit hat / yurt dışı ELENMEZ
            if tel in telefonlar and "M54" in self.mut:
                elenen[cid] = "ayni_telefon"; continue                    # §7a 8 (K2): aynı telefon iki cari → iki ileti
            elle = sablon == "hatirlatma" and cid in (o.get("supheli_elle") or ())   # Y12-9: elle seçim yalnız Ödeme Hatırlatma'da anlamlı
            s7_b_secenegi = False
            if sablon == "hatirlatma" and self.supheli_acik(c):
                # S7 (Y11-18): şüpheli alacak kaydı açık müşteri otomatik listeye girmez ("Şüpheli Alacağı Var"); elle seçilirse şüphesiz gecikmiş tutarla gider
                if "M183" in self.mut or (not elle and "M181" not in self.mut):
                    elenen[cid] = SUPHELI; continue
                # S7A (Y12-1): elle seçilse de şüphesiz gecikmiş borcu yoksa aşağıdaki §7a 20 denetimiyle "Gecikmiş Borç Yok" (M190: B seçeneği — ileti yine gider)
                s7_b_secenegi = "M190" in self.mut and elle
            elif elle:
                # Y12-3: "elle seçim" S7'de etiketli cari için tanımlı — başlatmada açık şüpheli kaydı olmayan cari için kâhin anlam uydurmaz
                raise ValueError("girdi tutarsız (README §17 Y12-3): supheli_elle yalnız başlatmada 'Şüpheli Alacağı Var' etiketli cariye verilir — " + cid)
            if sablon == "hatirlatma" and "M44" not in self.mut and not s7_b_secenegi:
                engel = self.hatirlatma_engeli(c, t)                      # §7a 20 (+ S7A: şüphesiz kalemler; + NB5 / S17: net borç ≤ 0 — Y13-7, Y13-8)
                if engel is not None:
                    elenen[cid] = engel; continue
            ctx = self.kisi_ctx(coz, cid)                                  # J8: Tüm Hareketler'de kişiye özel kanon
            neden = None                                                  # E2: TEK neden, sıra Zaten Kuyrukta → Sonucu Belirsiz → Daha Önce Gönderildi
            m241_t = None
            for k in (("belirsiz", "kuyruk") if "M112" in self.mut else ("kuyruk", "belirsiz")):
                if k == "kuyruk" and "M37" not in self.mut and self.kuyrukta(cid, sablon, ctx, sirket, t):
                    neden = "zaten_kuyrukta"                              # §7a 9 + K1 eşlik + K2 + D2(b)
                elif (k == "belirsiz" and "M101" not in self.mut and "M107" not in self.mut and not ("M102" in self.mut and o.get("onceki") == "gonder")
                      and self.belirsiz_kaynagi(cid, sablon, ctx, sirket, t, yalniz_dosya=True)):
                    m241_t = self.silinmis_belirsiz_ekstre_t(cid, sablon, ctx, sirket, t) if "M241" in self.mut else None
                    if m241_t is None:
                        neden = BELIRSIZ_NEDEN                            # D1 (+ E1: yalnız dosyadaki; + E3 hatırlatmada aynı yerel gün); S36 = A: içeriği silinmiş belirsiz Ekstre de
                if neden:
                    break
            if m241_t is not None and not neden:                          # M241 (S36'nın B'si): R3 uyarısıyla gelir; varsayılan Bunları Çıkar, onaylı Yine de Gönder ile gider
                onceki.append(m241_t)
                if o.get("onceki", "cikar") != "gonder":
                    elenen[cid] = DAHA_ONCE; continue
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
            j.supheli_elle = elle                                         # S7: şüpheli alacaklı cari elle seçildi
            j.anahtar_donem = coz["anahtar"]; j.tarih_donem = coz["tarih"]; j.kanon_donem = ctx[2]; j.coz_ozel = None
            j.tarihler_donem = ctx[3]
            if "M58" in self.mut:
                j.telefon = tel; j.icerik = self.icerik(c, tp, t, j)
            elif sablon == "ekstre" and "M163" not in self.mut and "M158" not in self.mut:
                j.hazir = self.icerik(c, tp, t, j)                        # J12 (Y9d-1): ekstre içeriği toplu işin AÇILIŞINDA hazırlanır (işe gönderimde yazılır)
            tp.isler.append(j)
            self.isler[anahtar] = j
        self.elenen[etiket] = elenen
        if onceki:
            self.onceki_uyari[etiket] = {"sayi": len(onceki), "son": tarih(max(onceki), timezone.utc if "M136" in self.mut else self.tz)}
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
            if d_bas is None:                                   # J11 + J12 (Y9d-3): ilk hareket – açılış günü; açılıştan sonra tarihli hareket girmez
                gun = tarih(t, self.tz) if "M158" in self.mut else tarih(tp.t, self.tz)
                bas = son = None; devir = Decimal("0")
                donem_h = hareketler if "M164" in self.mut else [(tr, d) for tr, d in hareketler if tr <= gun]
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
            if d_bas is None:                                   # J11 (S9-2 + 07:11, Y9c-5/6): {{3}} ve PDF = ilk hareket – AÇILIŞ günü; hareketsiz: açılış – açılış
                ilk = min((tr for tr, _d in donem_h), default=gun)
                bitis = max((tr for tr, _d in donem_h), default=gun) if "M155" in self.mut else gun
                metin3 = donem_metni(ilk, bitis, self.mut)
                if "M162" not in self.mut:
                    bas, son = ilk, bitis                       # "metin PDF ile aynı" (devir 0; açılış gününe kadarki hareketler — Y9d-3)
            else:
                metin3 = donem_metni(bas, son, self.mut)
            return {
                "degiskenler": [ad, firma, metin3, para(mesaj_bakiye, self.mut)],   # §7a 23: {{4}} dönem sonu bakiyesi
                "pdf": {"cari_ad": ad, "donem_bas": bas, "donem_son": son, "devir": str(kurus(devir)),
                        "hareket_sayisi": len(donem_h), "donem_sonu_bakiye": str(kurus(sonu))},
                "dosya_adi": {"on_ek": f"Ekstre {tam_ad} " if isinstance(ad, str) else {"kisaltilabilir": f"Ekstre {tam_ad}"}, "son_ek": ".pdf"},
            }
        bugun = tarih(t, self.tz)
        bakiye = sum((d for tr, d in hareketler if tr <= bugun), Decimal("0"))
        gec, toplam = self.hatirlatma_tutari(c, t)                      # S7 (Y11-19): şüphesiz kalemler — {{3}} ve {{4}} aynı kalemlerden; NB5 / S17: {{4}} net borçla sınırlı (Y13-6, Y13-8)
        if gec:
            vade, tutar = tr_tarih(gec[0]["vade"]), para(toplam, self.mut)   # Y13-6: {{3}} en eski vadesi geçmiş açık kalem (netleşme kalemi kapatmaz)
        else:
            vade, tutar = {"plan_susuyor": "gecikmiş borç yok (yalnız M44'te)"}, {"plan_susuyor": "gecikmiş borç yok"}
        bak = {"plan_susuyor": self.S7_BAKIYE_SUSUYOR} if self.supheli_acik(c) else para(bakiye, self.mut)
        return {"degiskenler": [ad, firma, vade, tutar, bak], "pdf": None, "dosya_adi": None}   # §7a 20

    # ---- işçi ---------------------------------------------------------------------------------------------------------------
    def _ilerlet(self, tp):
        while tp.bas < len(tp.isler) and tp.isler[tp.bas].durum not in GERI_DONEBILIR:
            tp.bas += 1

    def engelli(self, tp):
        """§6 W2 "Gönderiliyor istekten ÖNCE yazılır": şirket dosyası yazılamıyor (J7) ya da şirket geçici açılamıyorsa (J6) o şirketin işçisi istek göndermez."""
        return (self.defter_kilit or tp.sirket in self.acilamaz          # Y9e-3: talep deftere yazılamıyorsa istek gitmez
                or (self.okuma.get("devam_sd") == "bekle" and tp.sirket in self.baglanti_sd))   # README §16.4 okuma (b): bağlantı Süresi Doldu iken istek yok

    def isci_zamani(self):
        en = None
        for e in self.toplu_sira:
            tp = self.toplular[e]
            if tp.durum != "aktif" or self.engelli(tp):
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

    def suresi_doldu_kabul(self, rid, anahtar):
        """SW2 (Y11-3/4): bu kabulün denemesi ŞU AN Süresi Doldu mu (sonradan teslim gelirse artık değil)."""
        rec = self.kayitlar.get(rid) if rid is not None else None
        if rec is not None:
            return rec["son_durum"] == SURESI_DOLDU
        j = self.isler.get(anahtar)
        return j is not None and j.durum == SURESI_DOLDU

    def pencere_kumesi(self, waba, t):
        p = self.pencere.get(waba, {})
        if "M6" in self.mut:
            gun_bas = int(datetime.fromtimestamp(t / 1000, self.tz).replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000)
            return {a: x for a, x in p.items() if x >= gun_bas}
        # §6 W2: kayan 24 saatte "Meta Kabul Etti" olmuş FARKLI alıcı; SW2 (Y11-3): Süresi Doldu yazılmış denemenin kabulü SAYILMAZ (alıcının başka sayılan kabulü varsa alıcı sayılır)
        kume = {}; dolan = set()
        for (x, w, alici, rid, anahtar) in self.pencere_kayit:
            if w != waba or not x > t - GUN:
                continue
            if "M178" not in self.mut and self.suresi_doldu_kabul(rid, anahtar):
                dolan.add(alici)
                continue
            kume[alici] = max(kume.get(alici, 0), x)
        if "M187" in self.mut:
            kume = {a: x for a, x in kume.items() if a not in dolan}
        return kume

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
            if tp.durum != "aktif" or self.engelli(tp):
                continue
            self._ilerlet(tp)
            for j in tp.isler[tp.bas:]:
                if j.durum not in CALISIR or j.next_at > t:
                    continue
                if getattr(j, "silme_bekliyor", None):
                    # yalnız M238 / M240 (S35'in B'si — eski 'gonderimde' okuması): içeriği silinmiş bekleyen iş kendi gönderim anında (eleme denetimi) atlanır — ileti gitmez
                    ad_ = j.silme_bekliyor; j.silme_bekliyor = None
                    self.atla(j, ad_, t)
                    continue
                c = self.cariler[j.cari]
                waba = self.wabalar[tp.sirket]
                if (c["silindi"] or c["pasif"] or c["istemiyor"]) and "M57" not in self.mut:   # §7a 2: kuyrukta işaretlenen / silinen / pasif → Atlandı
                    self.atla(j, "silindi" if c["silindi"] else ("pasif" if c["pasif"] else "istemiyor"), t)
                    continue
                if "M58" not in self.mut or j.telefon is None:                    # §7a 1 + §7a 2: telefon ve eleme GÖNDERİM ANINDA (ekstre içeriği açılışta — J12)
                    tel, tur_ = numara(self.kart_telefonu(j.cari))            # Y15-16: karttan (silinen telefon kullanılmaz)
                    if tel is None:
                        self.atla(j, tur_, t)
                        continue
                    if tp.sablon == "hatirlatma":
                        # S7B (Y12-4/5): gönderim anında açık şüpheli kaydı + elle işaretsiz iş → "Atlandı — Şüpheli Alacağı Var" (Meta Bekletti 2. denemesi dahil)
                        acik = self.supheli_acik(c) and "M181" not in self.mut
                        elle_is = getattr(j, "supheli_elle", False)
                        sup = (acik and not elle_is and "M192" not in self.mut
                               and not ("M195" in self.mut and j.durum == BEKLEME_131049))
                        # S22 (eski S7-d, README §19 Y14-1/2): belirsizlik onayıyla (işteki Yine de Gönder ya da o zincirdeki yeniden deneme) bekleyen, basma anında kaydı
                        # OLMAYAN (elle işaretsiz) iş; kayıt gönderim beklerken açıldı → S7-b gibi gönderim anında "Atlandı — Şüpheli Alacağı Var" (S16 basma anında kaydı açık olanı
                        # zaten elle yapar — Y13-2); yol: kayıt açıkken asıl işte yeniden Yine de Gönder → S16 (Y14-4)
                        s22 = sup and getattr(j, "belirsiz_onay", False)
                        if s22 and "M210" in self.mut:
                            j.supheli_elle = elle_is = True; sup = s22 = False     # S22'nin tersi (B seçeneği): Yine de Gönder elle sayılır, şüphesiz tutarla gider
                        sup_ad = DAHA_ONCE if (s22 and "M211" in self.mut) else SUPHELI   # M211: yanlış etiket
                        # §7a 20 + S7A (Y12-2) + NB5 / S17 (Y13-7, Y13-8): hatırlatılacak tutar gönderim anında da (M191: elle şüpheli caride yalnız başlatmada; M206: net yalnız başlatmada)
                        engel = (None if ("M44" in self.mut or ("M191" in self.mut and elle_is and acik) or getattr(j, "m200", False))
                                 else self.hatirlatma_engeli(c, t, gonderim=True))
                        # S34 = A (README §22 Y17-2/4): ilk Yine de Gönder'de şüphesiz tutar yoktuysa gönderim anındaki tutar geçer (güncelleme 13'ün "S16 elemenin anı" hatası kalktı);
                        # M237 tutarı basma anına sabitler (zaman sınırı kayması)
                        if "M237" in self.mut and getattr(j, "s34_t", None) is not None and engel is None and elle_is:
                            engel = self.hatirlatma_engeli(c, j.s34_t, gonderim=True)
                        # S29 = A (README §21 Y16-2/4): S23 yeniden basmasında şüphesiz tutar yoktuysa gönderim anındaki tutar geçer (güncelleme 15'in S23-a hatası kalktı);
                        # M224 tutarı basma anına sabitler (zaman sınırı kayması)
                        if "M224" in self.mut and getattr(j, "s29_t", None) is not None and engel is None and elle_is:
                            engel = self.hatirlatma_engeli(c, j.s29_t, gonderim=True)
                        sira = ((engel, engel is not None), (sup_ad, sup)) if "M197" in self.mut else ((sup_ad, sup), (engel, engel is not None))
                        neden_ = next((n_ for n_, v_ in sira if v_), None)           # Y12-6: sıra başlatmadaki gibi (Y11-18)
                        if neden_ is not None:
                            self.atla(j, neden_, t)
                            continue
                    j.telefon = tel[1:] if "M16" in self.mut else tel
                    hazir = getattr(j, "hazir", None)
                    if tp.sablon == "ekstre" and hazir is not None:          # J12: açılışta hazırlanan ekstre — gönderim ertesi güne kaysa / yeniden gönderilse de AYNI
                        j.icerik = hazir
                    else:                                                     # Y9d-2: hatırlatma gönderim anında (M163 / M158: ekstre de, eski düzen)
                        j.icerik = self.icerik(c, tp, t, j)
                    j.icerik_t = t; j.icerik_silindi = None                   # S-W3 (Y15-21): yeniden gönderimde yeni içerik — silinmiş işaret kalkar
                blok = self.blok.get(("toplu", tp.etiket), 0) if "M52" in self.mut else self.blok.get(("waba", waba), 0)
                if blok > t:                                                  # §7a 30: Meta sınır hatası → WABA'nın bütün işleri 24 sa
                    self.durum(j, SINIR, t); j.next_at = blok
                    continue
                oda = self.oda_zamani(waba, j.telefon, t, self.sinir_degeri(waba), onbellek)
                if oda is None or oda > t:
                    self.durum(j, SINIR, t); j.next_at = oda if oda is not None else t + GUN
                    continue
                if "M161" in self.mut and tp.send_again and not j.yeniden:      # J10 b'nin tersi (R3 Yine de Gönder de durdurulur)
                    ctx = (j.anahtar_donem, j.tarih_donem, j.kanon_donem, j.tarihler_donem)
                    if any(r.get("teslim") and r.get("teslim_t", 0) > tp.t and self.eslesir(r, j.cari, tp.sablon, ctx, tp.sirket, t)
                           for r, _d, _i in self.gorunen_kayitlar()):
                        self.atla(j, DAHA_ONCE, t)
                        continue
                if "M151" in self.mut and not tp.send_again and not j.yeniden:   # J9 A seçeneği (bugün YOK — n3 BİLİNEN SINIR)
                    ctx = (j.anahtar_donem, j.tarih_donem, j.kanon_donem, j.tarihler_donem)
                    if self.onceden_gonderildi(j.cari, tp.sablon, ctx, tp.sirket, t) is not None:
                        self.atla(j, DAHA_ONCE, t)
                        continue
                self.gonder(j, tp, waba, t)
                return

    def meta_yanit_mesaj(self, j, deneme):
        if self.meta["kapali"]:
            return "baglanti_reddi"
        if self.meta_belirtec.get(j.sirket) is not None:       # SD1915 / SW4: belirteç Meta'da geçersiz → her istek reddedilir (sahte Meta: deneme sayacı yine artar)
            return {"hata": self.meta_belirtec[j.sirket]}
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

    def meta_yanit_medya(self, j):
        if self.meta_belirtec.get(j.sirket) is not None:       # SD1915 / SW4: PDF yüklemesi de reddedilir (genel medya sırası yine ilerler)
            return {"hata": self.meta_belirtec[j.sirket]}
        liste = self.davranis.get("medya", [])
        return liste[self.medya_toplam - 1] if self.medya_toplam - 1 < len(liste) else "kabul"

    def gonder(self, j, tp, waba, t):
        ts = t + self.adim
        self.isci_bos = ts
        j.son_kayit = None                                  # önceki deneme kesinleşti; bu gönderim yeni deneme
        self.durum(j, HAZIRLANIYOR, t)
        if tp.sablon == "ekstre":                           # §2.3 / W3; §7a 15: geçerli medya yeniden kullanılır
            canli = (len(j.medyalar) > j.silinen_n and (not j.medya_t or t - j.medya_t[-1] <= MEDYA_OMRU or "M168" in self.mut)) \
                or ("M36" in self.mut and j.medyalar)       # Y10-7: Meta 30 günde siler → 30 günden eski medya geçerli değil
            if not canli:
                while True:
                    if self.meta["kapali"]:
                        return self.baglanti_yok(j, tp, ts)
                    self.medya_toplam += 1
                    y = self.meta_yanit_medya(j)
                    if y == "kabul":
                        j.medyalar.append(f"m:{j.anahtar}#{len(j.medyalar) + 1}"); j.medya_t.append(t)
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
        if isinstance(y, dict) and "gec_kabul" in y:        # J6/J7: Meta kabul etti, HTTP yanıtı (zaman aşımından önce) gecikmeli — program "Gönderiliyor"da bekler
            self.meta_ileti(j, ts, programa=False)
            varis = zaman_ayristir(y["gec_kabul"], ts)
            self.yanit_bekleyen.add(j.anahtar)
            self.isci_bos = max(self.isci_bos, varis)
            self.ic_sira += 1
            self.olaylar.append([varis, self.ic_sira, {"tur": "_yanit", "is": j.anahtar, "rid": j.son_kayit,
                                                       "wamid": f"wamid.{j.anahtar}#{j.meta_sayi}"}])
            return
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

    def belirtec_kodu(self, kod):
        """SD1915 (190) + SW4 (0 "190 gibi"); 102 kararın DIŞINDA (Y11-15; M180 ekler). M173: 0 bugünkü hesap hatası gibi (S-W4 öncesi)."""
        k = set(BELIRTEC_KODLARI) | ({102} if "M180" in self.mut else set())
        if "M173" in self.mut:
            k.discard(0)
        return isinstance(kod, int) and not isinstance(kod, bool) and kod in k

    def sure_doldu(self, sirket, t, neden, belirtec=False):
        """SD1837 (Y11-7/8) + SD1915 / SW4 (Y11-12): bağlantı 'Süresi Doldu' — o şirketin süren (aktif / Bağlantı Bekleniyor) toplu işleri Duraklatıldı, içindeki
        Bekliyor / Sınır / Hazırlanıyor / Meta Bekletti işler 'Duraklatıldı'; Meta Kabul Etti / Gönderildi işlere dokunulmaz. Yeniden bağlanınca Devam Et ile sürer."""
        self.baglanti_sd.add(sirket)
        if "M174" in self.mut and belirtec:
            return
        for e in self.toplu_sira:
            tp = self.toplular[e]
            if tp.sirket != sirket or tp.durum not in ("aktif", "baglanti_bekleniyor"):
                continue
            tp.durum = "duraklatildi"; tp.neden = neden; tp.baglanti_neden = True
            tp.belirtec_neden = neden if belirtec else None
            for x in tp.isler:
                if x.durum in (BEKLIYOR, SINIR, HAZIRLANIYOR, BEKLEME_131049):
                    self.durum(x, DURDU_BAGLANTI if ("M189" in self.mut and not belirtec) else DURAKLATILDI, t)

    def belirtec_reddi(self, j, tp, kod, ts):
        """SD1915 + SW4 (Y11-12…14): Meta belirteci reddetti (190 / 0) — o anda iletisi gitmeyen kişi Başarısız DEĞİL, bekleyenlere döner ('Duraklatıldı'; kesin gitmedi:
        R3'te sayılmaz, Sonucu Belirsiz değil — ilke 1); bağlantı 'Süresi Doldu' (belirteç Meta'da yeniden bağlanana dek geçersiz); yeniden bağlanınca Devam Et ile gider."""
        self.meta_belirtec[tp.sirket] = kod
        if "M185" in self.mut:
            self.belirsiz(j, ts)
            return self.sure_doldu(tp.sirket, ts, kod, belirtec=True)
        j.kod = kod; j.belirtec_kodu = kod
        if j.son_kayit is not None:                                    # ileti isteği reddedildi: bu deneme kesin gitmedi
            rec = self.kayitlar[j.son_kayit]
            if "M188" in self.mut:
                rec["kabul"] = True; rec["son_durum"] = KABUL
            else:
                rec["son_durum"] = DURAKLATILDI; rec["belirtec_reddi"] = kod
            onceki = [r for r in j.kayitlar if r != j.son_kayit]
            j.son_kayit = None
            if onceki and "M186" not in self.mut:
                r0 = self.kayitlar[onceki[-1]]
                if r0.get("bekletti") and not r0.get("teslim") and r0["son_durum"] == BEKLEME_131049:
                    j.son_kayit = onceki[-1]                           # Y11-14 (İLKEYLE G0 3 + J2): 2. deneme gitmedi → iş yine Meta Bekletti iletisini taşır
        self.durum(j, DURAKLATILDI, ts)
        self.sure_doldu(tp.sirket, ts, kod, belirtec=True)

    def hata_isle(self, j, tp, kod, ts, post_yok=False):
        if self.belirtec_kodu(kod) and "M172" not in self.mut and not (post_yok and "M184" in self.mut):
            return self.belirtec_reddi(j, tp, kod, ts)
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
        if j.son_kayit is not None:
            self.kayitlar[j.son_kayit]["bekletti"] = True   # J2: bu denemenin iletisi Meta Bekletti'de (teslim gelirse iş kapanır)
        if "M60" in self.mut:
            self.kesinlesti(j, t)
        self.durum(j, BEKLEME_131049, t); j.next_at = t + (0 if "M19" in self.mut else GUN)
        tp.bas = 0

    def kisi_tarihleri(self, coz, cid):
        """G6: dönemin o günkü tarihleri (kişi başına): Tüm Hareketler'de kişinin ilk hareketi – o gün (+ J8: ilk – son hareket); öbürlerinde donem_coz()'un listesi."""
        if coz.get("tarihler") is None:
            return tum_tarihleri(self.cariler[cid], coz["bugun"], self.mut)
        return coz["tarihler"]

    def kisi_ctx(self, coz, cid):
        """Eşlik bağlamı (anahtar, tarih, kanon, tarihler) — J8: Tüm Hareketler'de kanon kişiye özel (o günün Bu Ay / Geçen Ay'ı)."""
        tarihler_ = self.kisi_tarihleri(coz, cid)
        kanon = coz["kanon"]
        if coz["secim"] == "tum" and "M148" not in self.mut and "M150" not in self.mut:
            kanon = tum_kanon(tarihler_, coz["bugun"])
        return (coz["anahtar"], coz["tarih"], kanon, tarihler_)

    def kayit_ac(self, j, tp, ts):
        self.kayit_sira += 1
        rid = self.kayit_sira
        tarih_, kanon_, tarihler_ = j.tarih_donem, j.kanon_donem, j.tarihler_donem   # G1: "o gün" = toplu işin (yeniden denemede asıl işin) açıldığı gün
        if "M122" in self.mut and tp.sablon == "ekstre":
            c2 = donem_coz(tp.donem, ts, self.tz, tp.sablon, self.mut)
            _a, tarih_, kanon_, tarihler_ = self.kisi_ctx(c2, j.cari)
        if j.anahtar_donem == ("secim", "tum") and "M159" in self.mut:
            # M159 (düşen Y9b-4): eşliğe gerçek gönderim günü de girer — Y9c-7: dönem açılış günüyle (TEK okuma)
            gun = tarih(ts, self.tz)
            ek = tum_tarihleri(self.cariler[j.cari], gun, self.mut)
            tarihler_ = tuple(dict.fromkeys(tuple(tarihler_ or ()) + ek))
            if kanon_ is None and "M148" not in self.mut and "M150" not in self.mut:
                kanon_ = tum_kanon(ek, gun)
        self.kayitlar[rid] = {"sirket": j.sirket, "cari": j.cari, "sablon": tp.sablon, "anahtar": j.anahtar_donem, "tarih": tarih_, "kanon": kanon_, "tarihler": tarihler_, "t": ts, "is": j.anahtar,
                              "kabul": False, "teslim": False, "son_durum": GONDERILIYOR, "kaynaklar": j.yine_kaynak}
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
        liste = plan.get(j.anahtar, plan.get(j.cari, plan.get("*", [])))   # güncelleme 9: anahtar iş ("T1/B") de olabilir
        if isinstance(liste, dict):
            liste = liste.get(str(j.meta_sayi), liste.get("*", []))
        for k in liste:
            ek = dict(k[2]) if len(k) > 2 else {}
            olay_t = zaman_ayristir(k[1], ts)
            varis = zaman_ayristir(ek["varis"], ts) if "varis" in ek else olay_t
            ek.setdefault("opaque", j.anahtar)
            # Meta'nın kancası: Yol 2'de imza kapıcıda doğrulanır (§7a 3); güncelleme 17 (Y17-26): Yol 1'de kapıcı doğrulayamaz — imzasız gelir (kanca_al'da kabul edilir)
            ek["olay_t"] = olay_t; ek["imzali"] = self.yol != "yol1"
            for _ in range(int(ek.get("tekrar", 1))):
                self.kanca_planla(varis, wamid, k[0], ek.get("kod"), ek)

    def programa_kabul(self, j, wamid, ts, meta_t=None):
        tp = self.toplular[j.toplu]
        waba = self.wabalar[tp.sirket]
        j.wamidler.append(wamid); self.wamid_is[wamid] = j
        j.kabul_t = ts
        j.ttl_kabul = self.ttl_listeden(j)                   # W2 (W-KÖK): bu kabulün teslim süresi = kabul anındaki değer (yoksa 30 gün)
        if getattr(j, "ilk_kabul_t", None) is None:
            j.ilk_kabul_t = ts                               # yalnız M141 (J4'ün tersi) kullanır
        if j.son_kayit is not None:
            rec = self.kayitlar[j.son_kayit]
            rec["kabul"] = True; self.wamid_kayit[wamid] = j.son_kayit
            if meta_t is not None and "M82" in self.mut:
                rec["t"] = meta_t                            # M82: Meta'nın bildirim saati (K5: programın saati olmalı)
        if "M50" not in self.mut:
            j.kod = None                                     # §7a 32
        # S30 (README §21 Y16-13): içeriği / telefonu silinmiş Sonucu Belirsiz işe geç kabul — alıcı pencerede işin kimliğiyle sayılır (silme pencereyi azaltmaz, Y15-22)
        alici = j.telefon if j.telefon is not None else f"silinmis:{j.anahtar}"
        p = self.pencere.setdefault(waba, {})
        p[alici] = max(p.get(alici, 0), ts)
        self.pencere_kayit.append((ts, waba, alici, j.son_kayit, j.anahtar))   # SW2: deneme başına (Süresi Doldu olan sayılmaz)
        tp.okuma_sayac += 1                                  # §7a R2: son kategori okumasından beri ileti
        self.kabul_kaydi.append((ts, waba, tp.sirket, alici, j.anahtar))
        self.durum(j, KABUL, ts)

    # ---- kanca ----------------------------------------------------------------------------------------------------------------
    def kanca_planla(self, t, wamid, durum, kod, ek):
        self.kanca_sira += 1
        heapq.heappush(self.kancalar, (t, self.kanca_sira, wamid, durum, kod, ek))

    def kanca_varis(self, t, wamid, durum, kod, ek):
        if not (self.acik and self.tunel):
            if "M28" not in self.mut:
                self.meta_kuyruk.append((t, wamid, durum, kod, ek))   # programa ULAŞMADI (kapıcı/bağlantı) — Meta yineler; yanıt sayımına girmez
            return
        self.kanca_al(t, t, wamid, durum, kod, ek)

    def kuyruk_isle(self, t):
        if not (self.acik and self.tunel):
            return
        kuyruk, self.meta_kuyruk = self.meta_kuyruk, []
        for (ilk, wamid, durum, kod, ek) in kuyruk:
            if t - ilk <= KANCA_OMRU:
                self.kanca_al(t, ilk, wamid, durum, kod, ek)

    # ---- J6: kanca yanıt katmanı ----------------------------------------------------------------------------------------------
    def kanca_al(self, t, ilk, wamid, durum, kod, ek):
        """Programa ULAŞAN bildirim: imzalıysa yanıt (200 / 503) verilir; 503 alanı Meta yineler (kuyruk, `kanca_kuyrugu` olayı). İmzasız bildirim kapıcıda
        düşer (§7a 3) — yanıt sayımına girmez.
        Güncelleme 17 (README §22 Y17-25…28): S41 = A — uygulama düzeyi adrese (`adres: "uygulama"`) gelen bildirim alternatif adresle AYNI kurallarla (M248: işlenmez; M249: orada imza aranmaz);
        Yol 1'de imzasız bildirim KABUL edilir ve imzalı gibi işlenir (S41 "Yol 1 imzasız kabul"; M250: düşer); Yol 2'de yalnız imzalı (S33)."""
        if ek.get("adres") == "uygulama":
            if "M248" in self.mut:
                return                                                 # S41'in B'si: 200, işlenmez — teslim bilgisi kaybolur
            if "M249" in self.mut and not ek.get("imzali"):
                ek = dict(ek, imzali=True)                             # 'aynı kurallar'ın tersi: uygulama adresinde imza aranmaz
        if not ek.get("imzali") and self.yol == "yol1" and "M250" not in self.mut:
            ek = dict(ek, imzali=True, yol1_imzasiz=True)              # Yol 1: kapıcı imzayı doğrulayamaz — imzasız bildirim kabul (gerçeği de sahtesi de)
        if not ek.get("imzali"):
            return self.kanca_isle(t, wamid, durum, kod, ek)
        kod_http, isle = self.kanca_kodu(t, wamid, ek, durum)
        self.kanca_yanit[str(kod_http)] += 1
        if kod_http == 503:
            self.meta_kuyruk.append((ilk, wamid, durum, kod, ek))
            return
        if isle:                                             # 200 ama kaydedilemedi (yalnız M144 / M145): bildirim KAYBOLUR
            self.kanca_isle(t, wamid, durum, kod, ek)

    def bildirim_sirketi(self, wamid, ek):
        j = self.wamid_is.get(wamid)
        if j is not None:
            return j.sirket
        rid = self.wamid_kayit.get(wamid)
        if rid is not None:
            return self.kayitlar[rid]["sirket"]
        op = ek.get("opaque")
        aday = self.isler.get(op)
        if aday is not None:
            return aday.sirket
        for r in sorted(self.defter):
            if self.kayitlar[r]["is"] == op:
                return self.kayitlar[r]["sirket"]
        return None

    def taniniyor(self, wamid, ek):
        """Y9-11 (c): bildirim programın bildiği bir denemeye bağlanabiliyor mu (wamid; ya da iş kimliği → sonucu belli olmayan deneme)."""
        if wamid in self.wamid_is or wamid in self.wamid_kayit:
            return True
        op = ek.get("opaque")
        aday = self.isler.get(op)
        if aday is not None:
            return aday.durum == BELIRSIZ or self.asilmis_kayit(aday) is not None
        return any(self.kayitlar[r]["is"] == op for r in self.defter)

    def kanca_kodu(self, t, wamid, ek, durum):
        """J6 (Y9-11) → (HTTP kodu, işlenir mi): 503 = bildirim kaydedilemez / şirketi geçici açılamaz / şirket dosyası yazılamaz / yanıt beklenirken tanınmayan
        (ilk görülmesinden ≤ 5 dk); öbürü 200 (silinmiş — kalıcı — şirket dahil). M144 / M145: 200 verilir ama bildirim kaydedilemez → kaybolur."""
        if self.bildirim_yazilamaz or self.defter_kilit:                  # Y9e-3: defter yazılamazken bildirim de kaydedilemez
            return (200, False) if "M145" in self.mut else (503, False)
        sirket = self.bildirim_sirketi(wamid, ek)
        if sirket is not None:
            if sirket in self.silinen:
                return (503, False) if "M146" in self.mut else (200, True)
            if sirket in self.acilamaz:
                return (200, False) if "M144" in self.mut else (503, False)
        if self.yanit_bekleyen and "M143" not in self.mut and not self.taniniyor(wamid, ek):
            ilk = self.tanin_ilk.setdefault((wamid, durum, ek.get("olay_t")), t)
            if t - ilk <= TANINMAYAN_503:
                return (503, False)
        return (200, True)

    def yanit_gel(self, o, t):
        """J6/J7: gecikmeli Meta yanıtı geldi. Program kapanmışsa yanıt kayboldu (açılışta Sonucu Belirsiz). Gönderim defteri yazılamıyorsa iş dosyada Meta Kabul Etti
        olur ama kabul defterde eksik kalır → onarım bekleyen kabul (Y9e-1)."""
        self.yanit_bekleyen.discard(o["is"])
        j = self.isler.get(o["is"])
        if j is None or not self.acik or j.durum != GONDERILIYOR or j.son_kayit != o["rid"]:
            return
        tp = self.toplular[j.toplu]
        self.programa_kabul(j, o["wamid"], t)
        tp.gecici = 0; j.gecici_deneme = 0
        if self.defter_kilit:                                # J7 (Y9e-1): iş dosyada Meta Kabul Etti, kabul gönderim defterine YAZILAMADI → onarım bekler
            self.kayitlar[o["rid"]]["onarim"] = True

    def sirket_sil(self, sirket):
        """Y9-4: şirket kalıcı silinir — toplu işleri ve işleri şirket dosyasıyla gider; makine defteri, "Bu Ay", sınır penceresi, Meta'daki iletiler kalır."""
        self.silinen.add(sirket)
        for e in [e for e in self.toplu_sira if self.toplular[e].sirket == sirket]:
            self.toplu_sira.remove(e); del self.toplular[e]
        for k in [k for k, j in self.isler.items() if j.sirket == sirket]:
            j = self.isler.pop(k)
            for w in [w for w, x in self.wamid_is.items() if x is j]:
                del self.wamid_is[w]
            self.ttl_aktif.pop(k, None); self.yanit_bekleyen.discard(k)

    def asilmis_kayit(self, j):
        """Y9-5: işin sonucu belli olmayan (kabulü bilinmeyen; Sonucu Belirsiz / Gönderiliyor kalmış) ESKİ denemesi — şu an yanıt beklenen deneme hariç."""
        aday = [r for r in j.kayitlar if not self.kayitlar[r]["kabul"] and self.kayitlar[r]["son_durum"] in (BELIRSIZ, GONDERILIYOR)
                and not (r == j.son_kayit and j.durum in (GONDERILIYOR, BELIRSIZ))]
        return max(aday) if aday else None

    def deneme_teslim(self, rec, olay_t):
        """J1 + J5: deneme teslim edildi (delivered/read) — "Bu Ay" denemeye göre, ay = ilk teslim bildiriminin zamanı."""
        if not rec.get("teslim"):
            rec["teslim"] = True; rec["teslim_t"] = olay_t; rec["teslim_n"] = 1
        else:
            rec["teslim_n"] = rec.get("teslim_n", 1) + 1    # yalnız M12 kullanır

    def eski_deneme_failed(self, rec):
        """J3 (Y9-8): teslim edilmemiş (eski / dosyada olmayan) denemeye geç failed → o deneme Başarısız (kişi almadı)."""
        if rec is not None and not rec.get("teslim"):
            rec["son_durum"] = BASARISIZ

    def kanca_isle(self, t, wamid, durum, kod, ek):
        if not ek.get("imzali") and "M24" not in self.mut:
            if "M247" in self.mut:                           # S33'ün B'si (bugünkü program): imzasız bildirim de (wamid tanınmasa bile) "bildirim yolu çalışıyor" işaretini koyar
                s_ = self.meta_mesajlari.get(wamid) or self.wamid_is.get(wamid)
                w_ = self.wabalar.get(s_.sirket) if s_ is not None else self.wabalar.get(ek.get("sirket", "A"))
                if w_ is not None:
                    self.son_kanca[w_] = t
            return                                           # §7a 3 + S33 (Y17-25): Yol 2'de imzasız olay düşer ve işareti koymaz (GUV-06)
        sahibi = self.meta_mesajlari.get(wamid) or self.wamid_is.get(wamid)
        if sahibi is not None and ek.get("imzali"):
            self.son_kanca[self.wabalar[sahibi.sirket]] = t   # §7a 16: kanca yolu çalışıyor
        olay_t = ek.get("olay_t", t)
        teslim_olayi = durum in ("delivered", "read")
        j = self.wamid_is.get(wamid)
        if j is None:
            aday = self.isler.get(ek.get("opaque"))            # §7a 3: iş kimliği eşleşirse çözülür; sayaçlara ve pencereye girer
            if aday is None:
                if ek.get("imzali") and "M134" not in self.mut:
                    return self.dosyasiz_kanca(wamid, durum, ek, olay_t)   # H3: iş şirket dosyasında yok (geri yükleme / silinmiş şirket)
                return
            if aday.durum == BELIRSIZ:
                j = aday
                self.programa_kabul(j, wamid, j.belirsiz_t, meta_t=olay_t)   # K5: kabul anı programın saati (gönderim anı), Meta'nın bildirim saati değil
            else:
                rid0 = self.asilmis_kayit(aday) if (ek.get("imzali") and "M152" not in self.mut) else None
                if rid0 is None:
                    return
                rec0 = self.kayitlar[rid0]                     # Y9-5: aşılmış belirsiz deneme — bildirim o DENEMEYE yazılır
                rec0["kabul"] = True; rec0["son_durum"] = KABUL
                self.wamid_kayit[wamid] = rid0; self.wamid_is[wamid] = aday; aday.wamidler.append(wamid)
                j = aday
        rid = self.wamid_kayit.get(wamid)
        rec = self.kayitlar.get(rid)
        guncel = rid is not None and rid == j.son_kayit       # bildirim işin ŞU ANKİ denemesine mi
        if j.durum == SURESI_DOLDU:                          # §7a 17: gerçek bilgi yazılır
            if teslim_olayi and "M42" not in self.mut:
                if rec is not None:
                    self.deneme_teslim(rec, olay_t)
                self.durum(j, TESLIM if durum == "delivered" else OKUNDU, t)
                self.teslim_yaz(j, olay_t)
            return
        if j.durum in KAPANDI_TESLIMSIZ:                     # K3/K7 + J1: teslimsiz kapandıktan sonra gelen teslim sayılır, iş yeniden AÇILMAZ (Y9-3)
            if teslim_olayi:
                if rec is not None:
                    self.deneme_teslim(rec, olay_t)
                yeni = TESLIM if durum == "delivered" else OKUNDU
                if j.gec_teslim is None or SIRA[yeni] > SIRA[j.gec_teslim]:
                    j.gec_teslim = yeni
                self.teslim_yaz(j, olay_t); self.kesinlesti(j, t)
            elif durum == "failed" and not guncel:
                self.eski_deneme_failed(rec)
            return
        if rec is not None and rec.get("bekletti") and guncel and j.durum in BEKLETTI_BEKLEYEN:
            # J2 + Y9-6/7: Meta Bekletti'deki (henüz yeniden gönderilmemiş) ileti teslim edildi → iş KAPANIR, 2. deneme gitmez
            kapat = (teslim_olayi and not ("M139" in self.mut and j.durum == BEKLEME_131049)
                     and not ("M137" in self.mut and j.durum != BEKLEME_131049))
            if kapat:
                self.deneme_teslim(rec, olay_t)
                if "M50" not in self.mut:
                    j.kod = None                             # §7a 32
                self.durum(j, TESLIM if durum == "delivered" else OKUNDU, t)
                self.teslim_yaz(j, olay_t); self.kesinlesti(j, t)
            return
        if (teslim_olayi and rec is not None and j.son_kayit is None and rid in j.kayitlar and j.durum in YENIDEN_BEKLEYEN
                and "M154" not in self.mut and (getattr(j, "belirsiz_onay", False) or "M160" in self.mut)):
            # J10 (S9-1 "Gitmesin" + 07:11 kapsam, Y9c-1/2): belirsizlik onayıyla (ya da o zincirdeki yeniden denemeyle) bekleyen işin ESKİ iletisi teslim
            # edildi → yeni ileti GİTMEZ; iş "Atlandı — Daha Önce Gönderildi"; eski teslim J5 gereği sayılır (Y9c-4), PDF silinir
            self.deneme_teslim(rec, olay_t)
            if "M50" not in self.mut:
                j.kod = None                                 # §7a 32
            self.atla(j, DAHA_ONCE, t)
            self.teslim_yaz(j, olay_t); self.kesinlesti(j, t)
            return
        if j.durum not in SIRA:
            # J1 (Y9-2/5): iş başka durumdayken gelen teslim YALNIZ denemeye yazılır; eski denemenin failed'ı o denemeyi Başarısız yapar (J3)
            if teslim_olayi and rec is not None and "M152" not in self.mut:
                self.deneme_teslim(rec, olay_t)
            elif durum == "failed" and not guncel:
                self.eski_deneme_failed(rec)
            return
        if teslim_olayi and rec is not None:
            self.deneme_teslim(rec, olay_t)
        if durum == "failed" and not guncel and rec is not None and "M153" not in self.mut:
            return self.eski_deneme_failed(rec)               # J3 + Y9-5: eski denemenin failed'ı şu anki denemeye dokunmaz
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

    def dosyasiz_kanca(self, wamid, durum, ek, olay_t):
        """H3 (İLKEYLE G0 2, 5) + J1/J3/J5: iş şirket dosyasında yokken (geri yükleme / silinmiş şirket) gelen İMZALI geç bildirim makine defterindeki denemeye
        yazılır. wamid biliniyorsa o deneme: teslim → teslim sayılır (R3 + "Bu Ay", J1/J5 — güncelleme 8 yorum 5 KALKTI), failed → teslim edilmemişse Başarısız
        (J3: kişi almadı). Bilinmiyorsa iş kimliğiyle (opaque) defterdeki SON deneme, yalnız sonucu belli değilse (Sonucu Belirsiz / Gönderiliyor)."""
        teslim_olayi = durum in ("delivered", "read")
        rid = self.wamid_kayit.get(wamid)
        if rid is not None:
            if rid in self.defter:
                rec = self.kayitlar[rid]
                if teslim_olayi:
                    self.deneme_teslim(rec, olay_t); rec["dosyasiz_teslim"] = True
                elif durum == "failed" and "M140" not in self.mut:
                    self.eski_deneme_failed(rec)
            return
        adaylar = [r for r in self.defter if self.kayitlar[r]["is"] == ek.get("opaque")]
        if not adaylar:
            return
        rid = max(adaylar)
        rec = self.kayitlar[rid]
        if rec["kabul"] or rec["son_durum"] not in (BELIRSIZ, GONDERILIYOR):
            return
        rec["kabul"] = True; self.wamid_kayit[wamid] = rid
        rec["son_durum"] = {"sent": GONDERILDI, "delivered": TESLIM, "read": OKUNDU, "failed": BASARISIZ}.get(durum, KABUL)
        if teslim_olayi:
            self.deneme_teslim(rec, olay_t); rec["dosyasiz_teslim"] = True

    def teslim_yaz(self, j, olay_t):
        if j.teslim_t is None:
            j.teslim_t = olay_t                              # §7a 17: durum zamanı kanca timestamp'i
            self.teslim_kaydi.append((j, olay_t))

    def kesinlesti(self, j, t):
        """§11 S3 A: kesinleşince PDF Meta'dan silinir (her medya bir kez). Y10-7: Meta API medya kimliğini 30 günde kendisi siler — 30 günü dolmuş medyanın
        silinmesi Meta'da bir şey silmez (çıktıdaki medya_silme = Meta'da silinen); silinen_n programın sildiği/geçersiz saydığı önektir (değişmez denetimleri)."""
        for i in range(j.silinen_n, len(j.medyalar)):
            yuklenme = j.medya_t[i] if i < len(j.medya_t) else t
            if "M168" in self.mut or t - yuklenme <= MEDYA_OMRU:
                j.silme_n += 1
        j.silinen_n = len(j.medyalar)

    # ---- TTL, basamak ve şablon okuma ---------------------------------------------------------------------------------------
    def ttl_suresi(self, j):
        """W2 (W-KÖK, KULLANICI 03.11.2026 ~20:05 UTC) Y10-10/11: kabul anındaki teslim süresi (programa_kabul'de işe yazılır; bilinmiyorsa 30 gün);
        W3 (S10-6 KULLANICI KARARI 03.11 ~21:00 UTC) Y10-14: etkin süre = max(kabul anındaki, güncel liste). M170 yalnız güncel liste, M171 yalnız kabul anındaki."""
        guncel = self.ttl_listeden(j)
        if "M170" in self.mut or getattr(j, "ttl_kabul", None) is None:
            return guncel
        if "M171" in self.mut:
            return j.ttl_kabul
        return max(j.ttl_kabul, guncel)

    def ttl_listeden(self, j):
        """W1 (KULLANICI KARARI 03.11.2026, W §15) Y10-1/4/8: Meta'nın şablon listesinde O ŞABLON için O AN bildirdiği teslim süresi (teslim_suresi_sn = Meta
        message_send_ttl_seconds), yoksa 30 gün. 2.4.8'in 72 sa ayarı (ayar.eski_ttl_saat / eski varsayılan) OKUNMAZ (yalnız M7)."""
        ad = ICERIK_SABLON[self.toplular[j.toplu].sablon] if j.toplu in self.toplular else None
        sn = (self.meta["sablonlar"].get(ad) or {}).get("teslim_suresi_sn") if ad else None
        if "M169" in self.mut and not sn:
            sn = next((v.get("teslim_suresi_sn") for _, v in sorted(self.meta["sablonlar"].items()) if v and v.get("teslim_suresi_sn")), None)
        if sn and "M166" not in self.mut:
            return int(sn) * SN
        if "M7" in self.mut:
            return int(self.ayar.get("eski_ttl_saat") or 72) * SA
        return TTL_VARSAYILAN

    def ttl_son(self, j):
        """§6 W2 + §7a 16 + W1 (Y10-2): süre + 1 sa payı; J4: Meta'nın SON kabul ettiği denemeden (her kabulde kabul_t yenilenir; M141 ilk kabulden)."""
        taban = j.ilk_kabul_t if ("M141" in self.mut and getattr(j, "ilk_kabul_t", None) is not None) else j.kabul_t
        return taban + self.ttl_suresi(j) + (0 if "M167" in self.mut else TTL_PAYI)

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

    # README §16.4: kime / kaç kez DEĞİŞMEYEN, karar metninin sustuğu gösterimler
    DEVAM_SD_SUSUYOR = ("bağlantı Süresi Doldu iken (yeniden bağlanmadan) Devam Et: karar metni yalnız 'yeniden bağlanınca Devam Et ile' der — reddedilir / bekler / "
                        "dener ve Meta reddeder (üçünde de ileti gitmez)")
    BELIRTEC_NEDEN_SUSUYOR = "190 / 0 ile duran toplu işin neden adı (hata kodu ya da 'Bağlantı Süresi Doldu') karar metninde yok"
    BELIRTEC_KOD_SUSUYOR = "190 / 0 alıp bekleyenlere dönen işin hata kodu karar metninde yok ('kalan kişilerle bekler')"
    S7_BAKIYE_SUSUYOR = "S7: şüpheli alacak kaydı açık caride Ödeme Hatırlatma {{5}} güncel bakiye karar metninde yok (yalnız 'şüphelisiz gecikmiş tutar')"
    # README §18.4 (güncelleme 13): kime / kaç kez DEĞİŞMEYEN, karar metninin sustuğu yerler (S16_AN_SUSUYOR güncelleme 17'de KALKTI — S34 = A, README §22 Y17-3)
    NET_ADI_SUSUYOR = ("karar (5) / S17 net borç elemesinin adı karar metninde yok ('Gecikmiş Borç Yok' ya da ayrı 'Net Borcu Yok') — ileti iki adda da gitmez")
    NET_ENGEL = {"secenek": ["gecikmis_borc_yok", NET_BORC_YOK], "susuyor": NET_ADI_SUSUYOR}
    # güncelleme 15'in S23_AN_SUSUYOR'u (s23_an) güncelleme 16'da KALKTI — S29 = A (README §21 Y16-3)
    # güncelleme 16'nın S30_AN_SUSUYOR'u (s30_an) güncelleme 17'de KALKTI — S35 = A (README §22 Y17-7)
    OKUMA_SUSUYOR = {"devam_sd": DEVAM_SD_SUSUYOR}

    def belirtec_bekliyor(self, j):
        return j.kod is not None and j.kod == getattr(j, "belirtec_kodu", None) and j.durum not in SIRA and j.durum not in KESIN

    def toplu_nedeni(self, tp):
        if tp.durum == "duraklatildi" and tp.neden is not None and tp.neden == getattr(tp, "belirtec_neden", None):
            return {"secenek": [tp.neden, SURE_DOLDU_NEDEN], "susuyor": self.BELIRTEC_NEDEN_SUSUYOR}
        return tp.neden

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
            "medya_silme": {"plan_susuyor": self.PDF_SILME_SUSUYOR} if susan else sum(j.silme_n for j in self.isler.values()),
            "toplular": {e: self.toplular[e].durum for e in self.toplu_sira},
        }
        if not self.ozet:
            k["isler"] = {a: self.gorunen(j) for a, j in sorted(self.isler.items())}
        if o.get("icerik"):                                                  # S-W3 (Y15-10): o anki içerik görünümü (yalnız istenirse — eski denetimler değişmez)
            k["icerik"] = {a: self.icerik_gorunum(j) for a, j in sorted(self.isler.items())}
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
                "hata_kodu": ({"secenek": [j.kod, None], "susuyor": self.GEC_TESLIM_SUSUYOR} if (gec and j.kod is not None)
                              else {"secenek": [j.kod, None], "susuyor": self.BELIRTEC_KOD_SUSUYOR} if self.belirtec_bekliyor(j) else j.kod),
                "post": j.post, "kabul": len(j.wamidler), "meta_ileti": j.meta_sayi,
                "medya_yukleme": len(j.medyalar), "medya_silme": {"plan_susuyor": self.PDF_SILME_SUSUYOR} if self.pdf_susuyor(j) else j.silme_n,
                "atlanma_nedeni": j.elendi_neden,
            }
            ig = self.icerik_gorunum(j)                                      # S-W3 (Y15-10): silinmişse içerik alanları null + icerik_silindi (yalnız silinmiş işte)
            for alan in ("telefon", "degiskenler", "pdf", "dosya_adi"):
                isler[k][alan] = ig[alan]
            if "icerik_silindi" in ig:
                isler[k]["icerik_silindi"] = ig["icerik_silindi"]

        def topla(alan):
            o = {}
            for j in self.isler.values():
                o[j.cari] = o.get(j.cari, 0) + alan(j)
            return dict(sorted(o.items()))
        medya_silme = topla(lambda j: j.silme_n)
        for j in self.isler.values():
            if self.pdf_susuyor(j):
                medya_silme[j.cari] = {"plan_susuyor": self.PDF_SILME_SUSUYOR}
        # §7a 19 + J5: "Bu Ay Gönderilen İleti Sayısı" = TESLİM edilen DENEME (delivered/read), ay = o denemenin ilk teslim zamanı (Türkiye saati), kapsam WABA;
        # dosyada olmayan işin ve silinmiş şirketin denemeleri dahil (J1; güncelleme 8 yorum 5 kalktı)
        bu_ay = {}
        if "M31" in self.mut:
            kayitlar = [(w, t_) for (t_, w, *_r) in self.kabul_kaydi]
        elif "M142" in self.mut:                              # eski kâhin: iş başına ilk teslim
            kayitlar = [(self.wabalar[j.sirket], j.kabul_t if "M43" in self.mut else t_) for (j, t_) in self.teslim_kaydi]
        else:
            kayitlar = []
            for rid in sorted(self.kayitlar):
                rec = self.kayitlar[rid]
                if (not rec.get("teslim") or ("M138" in self.mut and rec.get("dosyasiz_teslim"))
                        or ("M221" in self.mut and rec.get("talep_t") is not None)):   # Y15-17: silme talebi "Bu Ay"ı azaltmaz (M221 düşürür)
                    continue
                kayitlar += [(self.wabalar[rec["sirket"]], rec["t"] if "M43" in self.mut else rec["teslim_t"])] * (rec["teslim_n"] if "M12" in self.mut else 1)
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
            "toplular": {e: {"durum": self.toplular[e].durum, "neden": self.toplu_nedeni(self.toplular[e]), "is_sayisi": len(self.toplular[e].isler)} for e in self.toplu_sira},
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
            sonuc["yeniden"] = {k: {"elenen": dict(sorted(v["elenen"].items())), "alinan": v["alinan"], "oneri": v["oneri"],
                                    **({"supheli_etiketi": v["supheli_etiketi"]} if v.get("supheli_etiketi") else {}),   # Y13-4: yalnız boş değilse (eski çıktılar değişmez)
                                    **({"elle_sayilan": v["elle_sayilan"]} if "elle_sayilan" in v else {})}           # Y15-2: yalnız S23 tetiğinde
                                for k, v in sorted(self.yeniden_sonuc.items())}
        if self.listeler:                                      # K8
            sonuc["listeler"] = dict(sorted(self.listeler.items()))
        if self.kanca_cikti:                                   # J6 (Y9-11): programın imzalı bildirimlere verdiği yanıtlar
            sonuc["kanca_yanitlari"] = dict(self.kanca_yanit)
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


def secenek_birlestir(degerler, neden):
    """Karar metninin sustuğu OKUMALAR (kime / kaç kez hepsinde aynı) arasında ayrışan yaprak → {"secenek": [...], "susuyor": neden} (program seçeneklerden biri
    olmalı); aynı yapıdaki sözlük / liste içine iner; içteki seçenek yaprakları düzleşir; {"plan_susuyor"} denetlenmez kalır."""
    ilk = degerler[0]
    if all(_metin(d) == _metin(ilk) for d in degerler):
        return ilk
    yaprak = lambda d: isinstance(d, dict) and ("secenek" in d or "plan_susuyor" in d or set(d) in ({"biri"}, {"kisaltilabilir"}))
    if all(isinstance(d, dict) and not yaprak(d) and set(d) == set(ilk) for d in degerler):
        return {k: secenek_birlestir([d[k] for d in degerler], neden) for k in ilk}
    if all(isinstance(d, list) for d in degerler) and all(len(d) == len(ilk) for d in degerler):
        return [secenek_birlestir([d[i] for d in degerler], neden) for i in range(len(ilk))]
    for d in degerler:
        if isinstance(d, dict) and "plan_susuyor" in d:
            return d
    secenekler = []; nedenler = []
    for d in degerler:
        for x in (d["secenek"] if isinstance(d, dict) and "secenek" in d else [d]):
            if not any(_metin(x) == _metin(y) for y in secenekler):
                secenekler.append(x)
        if isinstance(d, dict) and "secenek" in d and d.get("susuyor") not in nedenler:
            nedenler.append(d["susuyor"])
    if neden not in nedenler:
        nedenler.append(neden)
    return {"secenek": secenekler, "susuyor": " + ".join(nedenler)}


def okuma_birlesimleri(anahtarlar):
    """OKUMALAR'daki anahtarların bütün birleşimleri, hepsi ilk (model) okumada olan birleşim HARİÇ; sıra: itertools.product (ilk anahtar en yavaş değişir)."""
    adlar = sorted(anahtarlar)
    for degerler in itertools.product(*[OKUMALAR[a] for a in adlar]):
        okuma = dict(zip(adlar, degerler))
        if any(okuma[a] != OKUMALAR[a][0] for a in adlar):
            yield okuma


def hesapla_tek(sen, kismi=None, mut=frozenset()):
    """İki zaman ucu (birleştirme {"biri"}); güncelleme 11: koşu karar metninin sustuğu bir duruma düştüyse (yeniden bağlanmadan Devam Et) öbür okumalar da koşulur,
    ayrışan yapraklar {"secenek"} (README §16.4). Güncelleme 13: okumalar genel (OKUMALAR: devam_sd, s16_an — README §18.4); koşuda karşılaşılan her okuma anahtarının
    bütün birleşimleri koşulur (yeni anahtar çıkarsa küme genişler)."""
    sonuclar = []
    for zaman in ZAMANLAR:
        b = Benzetim(sen, tam_secim(kismi or {}), zaman, mut)
        r = b.calistir()
        izi = set(b.okuma_izi)
        if izi:
            while True:
                tum = [r]; genis = set(izi)
                for okuma in okuma_birlesimleri(izi):
                    b2 = Benzetim(sen, tam_secim(kismi or {}), zaman, mut, okuma=okuma)
                    tum.append(b2.calistir())
                    genis |= b2.okuma_izi
                if genis == izi:
                    break
                izi = genis
            r = secenek_birlestir(tum, " + ".join(Benzetim.OKUMA_SUSUYOR[a] for a in sorted(izi)))
        sonuclar.append(r)
    return birlestir(sonuclar)


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
