# S223 küçük turu — rapor taslağı (adım adım)

Taban: c7b-aday = df7e93ca. Karar: S223 = A, S228 = A (görev metni docs/devir/2.5.0-DEVAM/s223-istem.txt).

## 0. NASIL BOZULUR (koddan önce)
1. Büyük / küçük harf: 'AHMET YILMAZ' ↔ 'Ahmet Yılmaz' (SQLite NOCASE yalnız A–Z katlar: 'I' → 'i', oysa Türkçe 'ı').
2. I / ı ve İ / i her konumda: 'İLKER IŞIK' ↔ 'İlker Işık', 'ILGIN' ↔ 'Ilgın' (baş, orta, son harf).
3. İngilizce olmayan harfler hiç katlanmıyor: 'ŞÜKRÜ ÖZÇELİK' ↔ 'Şükrü Özçelik', 'ĞÜLER' gibi (Ş Ğ Ü Ö Ç).
4. Boşluk: çift boşluk, baş / son boşluk, sekme, bölünmez boşluk (U+00A0) — NOCASE eşit saymaz.
5. Unicode yazım farkı: 'İ' ayrık noktalı ('I' + U+0307) — NFC ile birleşir.
6. Var olan ÇİFT cari (S228): 'Ahmet Yılmaz' + 'AHMET YILMAZ' ikisi telefonsuz, aynı grupta → Türkçe katlamada iki aday; bugünkü
   bağlantı (yazımı birebir olan) KORUNMALI; yalnız bugün hiç bulunamayan satır Türkçe katlamayla bulunmalı.
7. Aynı dosyada aynı kişi iki satır, biri büyük harfle: ilk satırın açtığı cari / kart ikinciye görünmeli (yükleme içi harita).
8. Telefonlu satır + aynı adlı (Türkçe katlamayla) FARKLI telefonlu cari → FARKLI kişi kalır (yeni cari).
9. Cari No + ad (cari Excel): aynı No + büyük harfli ad → aynı cari; farklı No → değil.
10. Tablodaki kayıt bağı (case_key) önceliği bozulmamalı; başka kayda bağlı cari kullanılmamalı (v2.0.8).
11. Silinmiş cari aday OLMAMALI (deleted_at).
12. Telefonsuz satır + aynı grupta tek / birden çok (Türkçe katlamayla) cari: tek → o; çok → şüpheli (yeni cari / atlama, bugünkü gibi).
13. Aynı Excel ikinci kez: telefonsuz / No'suz cari satırı yine yeni cari açar (2.0.19 kuralı AYNEN); taksitte çift kart açılmaz.
14. Ön izleme ↔ yükleme aynı sonuç (Tablodan Aktar: ön izlemede 'match' denen kişi aktarımda da o cariye).
15. Geri Al: yalnız kendi açtığı cariyi / kartı siler (eşleşen var olan cari silinmez).
16. Kilitli dönem: satır kilit nedeniyle atlanınca iç işlem geri alınır; yükleme içi haritaya eklenen (geri alınmış) cari sonraki satıra ADAY OLMAMALI.
17. İki şirket: harita şirket başına (store başına) — öbür şirketin carisi görünmemeli.
18. Cari Excel 'Güncelle' kipi: eşleşen carinin adı satırdaki yazımla değişir; haritada yeni adıyla bulunmalı (eski adla bulunmamalı).
19. Çek / senet içe aktarma önbelleği: anahtar Türkçe küçük harf, sorgu NOCASE → aynı dosyada 'AHMET YILMAZ' ve 'Ahmet Yılmaz' ilk satırın sonucunu paylaşıyor.
20. Yinelenen kart anahtarı (taksit Excel): yalnız ASCII katlıyor → 'AHMET YILMAZ' satırı 'Ahmet Yılmaz' kartını görmüyor → çift kart.
21. İngilizce klavyeyle harf DEĞİŞİMİ ('IBRAHIM' ↔ 'İbrahim', 'Yilmaz' ↔ 'Yılmaz') — KAPSAM DIŞI; yalnız davranış yazılır
    (NOCASE bugün 'YILMAZ' ↔ 'Yilmaz'ı eşit sayıyor; S228 = A sırası bunu korur: bugünkü karşılaştırma önce).
22. Hız: satır başına tam tablo taraması / 100 bin caride satır başına harita kurmak.

## 1. TARAMA
(aşağıda doldurulur)
