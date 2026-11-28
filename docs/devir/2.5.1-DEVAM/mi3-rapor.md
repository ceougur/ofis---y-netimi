# Müşteri İstekleri Tur 3 — Rapor (taslak; adım adım doldurulur)

Taban: `t251-mi3-taban` (bb6be861). Kapsam: dar kontrol Mİ ORTA-1 (dönem 'Tarih Aralığı'na çevrilip günler seçilmeden 'Bu Dönemde Ödeme
Yapanlar' açıkken eski ödeyenler + 'Tümüne WhatsApp' + dönemsiz PDF / Excel), kalıcı ekran adımı (DK-PROBE), Grup Özeti testinde 'Diğer' dişi.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı)

Değişmez kurallar (her satırda denetlenir):
- K1 Ekranda görünen satırlar = PDF'in satırları = Excel'in satırları (aynı dönem, aynı 'ödeme yapanlar' süzgeci, aynı grup / tür / arama / bakiye).
- K2 Toplu WhatsApp (ekstre / mesaj) ekranda görünenden FAZLA kişiye gidemez; 'Bu Dönemde Ödeme Yapanlar' kutusu işaretliyken 'Tümüne WhatsApp' düğmesi hiç görünmez
  (karar (5)) ve başlık kutusu yalnız ekrandaki carileri seçer.
- K3 Ekranın gösterdiği dönem her zaman yazılıdır (Tahsilat kartındaki dönem metni); seçicide yazan dönem henüz uygulanmamışsa bu açıkça söylenir.
- K4 Sayılar değişmez: Grup Özeti, Liste, rapor eşdeğerliği aynı (yalnız görünüm / düğme / süzgeç taşıma).

Bozulma listesi (testler buradan çıkar):
1. Dönem seçicinin her seçeneği (Yok, Bugün, Dün, Bu Hafta, Bu Ay, Tarih Aralığı) × 'ödeme yapanlar' kapalı / açık.
2. Tarih Aralığı: iki gün boş; yalnız başlangıç; yalnız bitiş; başlangıç bitişten sonra (elle yazılarak — min / max atlatılır); geçerli aralık.
   Her birinde: ekrandaki satırlar, Tahsilat kartının dönem metni, PDF ve Excel bağlantısının dönem / paid değeri, 'Tümüne WhatsApp' var mı.
3. 'Ödeme yapanlar' açıkken aralık eksikken kutunun işareti kaldırılır / yeniden konur (bekleyen değişiklik); sonra günler seçilir.
4. Aralık eksikken başka süzgeç değişir (grup, tür, arama, bakiye, durum sekmesi) → yeniden yükleme hangi dönemle?
5. Aralık eksikken Grup Özeti'ne geçip dönmek (Liste ↔ Grup Özeti); hiç uygulanmış dönem yokken (Yok → Tarih Aralığı) Grup Özeti'ne geçmek.
6. Pencereyi kapatıp yeniden açmak (görünüm modül içinde kalır); sayfa yenileme (her şey varsayılana döner).
7. Toplu WhatsApp ekstre / mesaj: seçim yok (Tümüne), tek tek seçim, başlık kutusu ('Hepsini seç' — Daha Fazla Göster varken), 'Hepsi eksi birkaçı'.
8. PDF / Yazdır / Excel (Liste ve Grup Özeti) her durumda ekranla aynı dönem.
9. Arka plan yenilemesi (başka bilgisayardan değişiklik) aralık eksikken: hangi dönemle?
10. Klavye: dönem seçicide Tab + ok tuşlarıyla seçim, tarih kutularına yazma (ders 12).
11. Grup Özeti 'Diğer' sütunu (POS Komisyon İadesi / Kredi Kartına İade): değer varken sütun ve TOPLAM; 'Diğer' sınıfı kapatılınca test kırmızı olmalı.
