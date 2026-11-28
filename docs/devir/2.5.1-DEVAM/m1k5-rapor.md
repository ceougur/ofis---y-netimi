# M1 KÜÇÜK TUR 5 — KDV Özeti: 'güncel değil' ay S4 birikimine bugünkü İndirilecek KDV'siyle (S-DKM1K-1 = A) — RAPOR (TASLAK)

Taban `t251-m1k4` (4850ae2a, küçük tur 4'ün dal ucu). PUSH YOK. Yalnız Rapor Merkezi'nin KDV Özeti görünümü; KDV Mahsup Fişi, ön izlemesi ve defter DEĞİŞMEZ.

## 0. NASIL BOZULUR (koddan ÖNCE yazıldı; testler bu listeden çıkar)
Eksenler: 'güncel değil' ay (G) × değişiklik türü (İndirilecek KDV artışı / azalışı / satış KDV'si değişimi) × G'nin fiş yönü (ödenecek / devreden) × G'den sonra gelen ay
(fişi zincirde kalan ve İ'si azalan ay / mahsupsuz ay / ikinci 'güncel değil' ay).
1. G'de İ ARTTI (ödenecek yönde kalır), arkasından fişi zincirde kalan İ'si AZALAN ay, sonra mahsupsuz ay — kararın örneği (S1): azalma hiçbir ayda sayılmıyor mu? (taban 1.400, beklenen 1.600)
2. Aynı, G devreden yönde kesilmiş (fiş devreden) — İ artışı devredeni büyütür; azalma sonraki ayda bir kez.
3. G'de İ arttı, arkasından azalan ay YOK, mahsupsuz ay — artış bir kez (devredenle / ödenecekle) sayılır, S4 birikimine ikinci kez girmez (eksi değil artı yönde sapma olmamalı).
4. G'de YALNIZ satış KDV'si değişti (İ aynı) — bugünkü değer = saklı değer; düzeltme sayıyı değiştirmemeli (S-M1K2-1 / S-M1K3-1 (a) örnekleri AYNEN).
5. G'de İ arttı + 391 değişti (İ + 391) — küçük tur 4 örneği AYNEN.
6. İki ardışık 'güncel değil' ay, sonra azalan ay — her artış kendi ayında bir kez, azalma sonraki ayda.
7. Azalan ay ÖNCE, G sonra (sıra değişir) — azalma G'nin ayında S4 ile düşülür; G bugünkü kayıtlardan; toplam 391 − 191.
8. G'den sonraki ay MAHSUP EDİLİRSE (ön izlemeyle — defter S4'ü saklı İ'lerle hesaplar): rapor ile ön izleme ayrışır mı, fiş 'Zincirle Uyuşmayan' sayılır mı, not metni doğru mu,
   aralık toplamı yine 391 − 191 mi (YAN ETKİ ÖLÇÜMÜ — iş 3).
9. Yıl dönümü: G Aralık, azalan ay Ocak (sonraki yıl), mahsupsuz Şubat — Bu Yıl / Geçen Yıl / Aralık–Şubat aralıkları.
10. Onarım: G'yi ve sonrasını geri al + aylar sırayla yeniden mahsup → rapor = fişler, aralık toplamı = 391 − 191 = fişlerin toplamı.
11. Rastgele sıra (300 tohum, dar kontrolün s2 düzeni) + yıl dönümü (150 tohum, s2b): her tohumda Ocak–Temmuz Ödenecek − Sonraki + Önceki = 391 − 191; ay ayların Ödenecek toplamı = aralık;
    ay zinciri sürekli (bir ayın Sonraki'si = sonraki ayın Önceki'si).
12. İki TZ (UTC, Europe/Istanbul); iki şirket (001 / 002 birbirine karışmaz); ekran = PDF = Excel.
13. Kararların öbür örnekleri (S-DKM1-1, S-M1K-1, S-M1K2-1, S-M1K3-1 (a) / (b)) AYNEN kalır — mevcut 55 sınama + mutantlar.
14. Ön izleme / fiş / defter tabanla BİREBİR (tur 3–4'ün eşitlik betikleri).

(Raporun kalanı işler bittikçe yazılır.)
