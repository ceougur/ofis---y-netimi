# Ç6-HESAP tur 5 (hız) — rapor taslağı (ajan; KANIT DEĞİL, ham çıktılar c6h5-ham/)

Taban f73f4f5a (tur 4). Karar 21.11 13:59 (1) seçenek (b).

## Adımlar
1. 9d072092 — tasarım §11.6 (koddan önce).
2. 30baa068 — kod: frozenSums `ruleThrough` (tek SQL; [from, through] içi eski gruplarla, dışı kaba gruplarla `outside`), fullRuleDiff(part, outside), alt defter kümesi ledger başına bir kez.
3. 03c702af — eşdeğerlik testi test/c6h-tek-okuma.test.mjs (17 sınama).
4. Yeni + tur 4 testleri iki TZ: 32/32, 32/32. Kırmızı (tur 4 kodunda): 17/17 düştü ("fullRuleDiff işlevi yok" ×15, sınır testi "Missing expected exception", toplam sınaması "fiş yazılan sınıf 0").
5. Parça / hız / komşu / mutasyon / kâhin / yanıt eşdeğerliği: süruyor.
6. Parça (tek SQL biçimi, 03c702af): tablonun kendi okuması ~130 ms, tur 4'ün kapsam okuması ~1,1–1,2 sn, tek SQL ~0,7–0,87 sn → GT fişten sonra yeni 3957 / 4328 ↔ eski 2922 / 3340 (hâlâ +%35). Salt SQL karşılaştırması: önekli bütün geçmiş gruplaması pahalı; dışarı kaba + 'voucher' süzülü ~0,36 sn.
7. 596253cf — dışarısı ayrı kaba SQL; groups / entries / firstSeen eski SQL'in aynısı; alt defter hatırlaması geri alındı (üretimde her istek yeni iş parçacığı). Eşdeğerlik testi UTC 17/17.
8. Parça (596253cf): GT yıl 2026 fişten sonra (süreç içi) yeni 3301 / 3372 · tur 4 4136 / 4258 · eski 2850 / 3589.
9. HIZ 3 tur × 3 kod × 2 kip × 5 tekrar (özel kilit, 14:48–15:46, başta yük 0,32–1,47; geçersiz ölçüm yok): fişten sonra GT (fiş içinde) yeni ÷ eski en iyi 1,222 / ortanca 1,218 (yıl), 1,205 / 1,217 (ikinci yarı) → hâlâ KÖTÜ (> %10); tur 4 1,47 / 1,47 idi. Öbür bütün yollar ≤ %7 (en iyi ve ortanca birlikte %10'u aşan yok). Yanıt özetleri tur 4 = yeni her istekte.
10. Komşu yığını (tur 4'ün 140 dosyası + c6h-tek-okuma; kod 596253cf'nin aynısı): UTC 1431/1431, İstanbul 1431/1431 (c6h5-ham/komsu-*.out).
11. Mutasyon: İLK koşu GEÇERSİZ (c6h5-ham/gecersiz-mut1/: kopyadaki test dosyası 03c702af'nin eski hâliydi — 'voucher' satırlı toplam denetimi yeni SQL'le her mutantta düşüyordu). Yeniden koşu (test güncel):
    9 mutantın 8'i yakalandı, iki TZ aynı sayılarla (m1 14, m2 2, m3 11, m4 15, m6 5, m7 8, m8 15, m9 2 kırmızı); m5 (alt defter kümesi boş) YAŞADI — fikstürlerde alt defter farkı yok; kod tur 4'ünkiyle aynı (bu turda değişmedi) → 2.5.1.
12. Kâhin-defter: UTC 187 denetim 0 fark, İstanbul 187 denetim 0 fark (tur 4: 187/187).
13. Yanıt eşdeğerliği tur 4 GERÇEK kodu (f73f4f5a) ↔ yeni, programın uçlarıyla: 26 fikstür (13 kilitli + 13 kilitsiz) × fişten önce / sonra / kilit 30.09 / kasa kilit geri / taksit ters kayıt — UTC 0 fark / 874, İstanbul 0 fark / 874; temiz 100 bin kilitli (fiş + kilit 30.09) 0 / 57, kilitsiz 0 / 19.
