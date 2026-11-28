# KDV Özeti küçük tur 8 — rapor taslağı (ajan; taban t251-aday-taban = 4c94030c)

Kapsam: mali müşavir S ORTA-1 (mahsuptan sonra İndirilecek KDV azalışı, sonraki aylar zaten mahsuplu → azalma raporun hiçbir ayında düşülmüyor; kayıtsız ay
zincirde yok) + aynı sınıf: dar kontrol tur 6 + 7 DOĞRULANMADI (fişsiz hareketsiz ayın tek ay raporu ön izlemeden ayrılıyor, tohum 86) + 27.11 B maddesi
(hareketsiz sonraki ay tek başına seçilince not yok). Mahsup fişi, ön izleme ve defter DEĞİŞMEZ; istemci görünümüne dokunulmaz.

## 0. NASIL BOZULUR (koddan ÖNCE)

Eksenler — her biri test / betikte en az bir durumla denenir:

1. Mahsuptan sonraki değişiklik: (a) İndirilecek KDV AZALIŞI (alış İptal Et), (b) Hesaplanan KDV ARTIŞI (geç satış — "güncel değil"), (c) İndirilecek artışı
   (geç alış — "güncel değil"), (d) satış İptal Et; (a) ile (b)/(c) aynı ayda (karma).
2. Azalmanın düşüleceği sonraki ay: (a) KAYITLI (391 / 191 satırı var) ve mahsupsuz, (b) KAYITSIZ (hiç satırı yok) ve mahsupsuz — ORTA-1'in Temmuz'u,
   (c) kayıtsız ama aralığın DIŞINDA (aralık azalmanın ayından önce biter), (d) kayıtsız ve bugünkü (bitmemiş) ay, (e) aralık sonu bugünden sonra (gelecek aylar
   zincire girmez — "bugünü aşmadan").
3. Sonraki aylar: hepsi mahsuplu (fişler azalmadan ÖNCE kesilmiş — azalma hiçbir fişte düşülmemiş), bazısı mahsupsuz (azalma ilk mahsupsuz ayda düşülür),
   azalmadan SONRA kesilmiş fiş (fiş azalmayı düşmüş — S4 normal akışı; satır yine görünmeli), atlanan ay (zincirle uyuşmayan fiş).
4. Dönem seçenekleri: Bu Ay, Geçen Ay, Son 30 Gün, Bu Yıl, Tüm Zamanlar, elle tek ay, elle çok ay (azalmanın ayını içeren / içermeyen; düşüldüğü ayı içeren /
   içermeyen), ay ortasında başlayan / biten aralık, aralık sonu bugünden sonra.
5. Yıl dönümü (azalma Aralık'ta, düşüldüğü ay Ocak; ay adında yıl).
6. İki saat dilimi (TZ=UTC, TZ=Europe/Istanbul; ay sonu / ay başı sınırı).
7. Fişsiz hareketsiz ay (dar kontrolün tohum 86 sınıfı): rapor = ön izleme mi; ayrılıyorsa açıklayan not var mı.
8. Hareketsiz sonraki ay tek başına (27.11 B): önceki "güncel değil" ayın bugünkü devredeni taşınıyor — not çıkıyor mu.
9. Birden çok azalma ayı (Şubat ve Nisan) → satırdaki ay listesi; azalmanın bir kısmı bir fişte, kalanı sonraki ayda.
10. Değişmezler: aralığın Ödenecek − Sonraki + Önceki = 391 − 191 (azalmanın düşüldüğü ayı içeren aralıkta); ayların Ödenecek toplamı = aralığın; ay zinciri sürekli;
    kayıtsız ay raporu = o ayın ön izlemesi (önceki aylar sırayla mahsupluysa); ön izleme / fiş / defter tabanla BİREBİR; ekran = PDF = Excel (satır ve not aynı
    yanıttan).
11. Hız: zincire giren ay sayısı artar (ilk KDV ayından bugüne kadar takvim ayları); 100 bin satırda kötüleşmemeli (bellekte, yeni sorgu yok).
12. Eski veri / şema: mahsup fişi tablosu yok, hiç KDV yok (boş veri), yalnız açılış.
