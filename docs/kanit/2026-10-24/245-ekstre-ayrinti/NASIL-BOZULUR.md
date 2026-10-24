# 6d Ayrıntılı Cari Ekstre — nasıl bozulur?
1. Seçenek kapalıyken bugünkü ekstre değişir (başlık/satır/özet/TOPLAM) → eski kodla fark testi (d2cef7c) + yapısal test.
2. Kalem toplamı ≠ fatura satırının borcu: belge iskontosu, KDV dahil fiyat, tevkifat, stopaj (SMM / kira stopajı) satırı unutulursa.
3. İade faturası alacak tarafında; kalemler iade miktarı; yön karışırsa.
4. İptal edilen / taslak / silinen fatura: defter satırı yokken kalemi görünürse; Silinenler'den geri yüklenince yeniden görünmeli.
5. Fatura Düzenle (kalem değişti) → eski kalem görünür mü (canlı okunmalı).
6. Dönem sınırı: dönem öncesi fatura kalemi görünmez; devir = dönem öncesi bakiye; Genel Toplam = devir + dönem.
7. Aynı adlı iki cari: kalemler başka carinin faturasından gelir mi (accountId / sourceId ile).
8. 002 şirketi: kalemler 001'den okunur mu.
9. Yetkisiz kullanıcı (Finans Raporları yok) → 403 aynı; cari kartında düğme görünmez.
10. Ekran ≠ PDF ≠ Excel (satır sayısı, TOPLAM / Genel Toplam).
11. Çek/senet tahsilatı ve karşılıksız: Yol "Çek"/"Senet", belge no evrak no; bakiye kâhinle aynı.
