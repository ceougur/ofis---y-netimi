### 1 eşzamanlı kullanıcı

İstek/sn: 0.2 → 0.7 · tüm istekler p50/p95/en çok (ms): 2660 / 6530 / 7129 → 94 / 2622 / 3005
Olay döngüsü p95 / p99 / en çok (ms): 14.7 / 2501.9 / 6157 → 25.1 / 260.6 / 1374
Sonuç: ÖNCE hata yok · SONRA hata yok; Mutabakat Testi 001 TAMAM, 002 TAMAM; bağımsız fark 001 Kasa 0,00 Banka 0,00, 002 Kasa 0,00 Banka 0,00

| İşlem | adet ÖNCE → SONRA | ÖNCE p50 / p95 / en çok (ms) | SONRA p50 / p95 / en çok (ms) |
|---|---|---|---|
| Banka Hareketleri listesi | 9 → 22 | 2759 / 4513 / 4513 | 46 / 492 / 812 |
| Banka Fişi (masraf) | 2 → 7 | 301 / 1882 / 1882 | 39 / 251 / 251 |
| Cari tahsilat (havale) | 4 → 17 | 1414 / 5079 / 5079 | 131 / 384 / 384 |
| Cari arama | 12 → 21 | 1943 / 4488 / 4488 | 69 / 359 / 441 |
| Satış faturası (peşin nakit) | 3 → 16 | 2268 / 4358 / 4358 | 79 / 1133 / 1133 |
| Cari tahsilat (nakit) | 7 → 12 | 2102 / 4794 / 4794 | 24 / 305 / 305 |
| Cari ödeme (nakit) | 3 → 2 | 4902 / 6885 / 6885 | 96 / 107 / 107 |
| Rapor açma | 7 → 20 | 4781 / 7129 / 7129 | 1494 / 2860 / 3005 |
| Bankalar arası transfer | — → 8 | — | 29 / 366 / 366 |

| Ekran (gerçek Chromium) | ÖNCE p50 / p95 / en çok (ms) | SONRA p50 / p95 / en çok (ms) |
|---|---|---|
| Cari araması: tuş → harf (adet 176 → 172) | 18 / 66 / 256 | 8 / 34 / 192 |
| Cari araması: son tuş → sonuç (adet 44 → 43) | 151 / 4609 / 5689 | 632 / 881 / 1368 |
| Banka Hareketleri: hesap süzgeci (adet 1 → 28) | 5669 / 5669 / 5669 | 179 / 604 / 710 |
| Ekrandan + Masraf → listede (adet 1 → 14) | 7723 / 7723 / 7723 | 1660 / 2327 / 2327 |
| Başkasının kaydı açık listede (adet 0 → 14) | — / — / — | 1050 / 1501 / 1501 |
| Raporlar penceresi açılış (adet 11 → 28) | 2449 / 3435 / 3435 | 818 / 1899 / 2215 |
| Banka Bakiye Raporu ön izleme (adet 11 → 28) | 4620 / 6595 / 6595 | 900 / 1489 / 1500 |
| PDF (adet 11 → 28) | 3187 / 5850 / 5850 | 565 / 832 / 1002 |
| Excel (adet 11 → 28) | 2579 / 3901 / 3901 | 550 / 1240 / 2161 |
| Banka penceresi turu / yeniden açılış | — | 28 / 0 |
| Ekran hataları | 4 | 2 |

### 10 eşzamanlı kullanıcı

İstek/sn: 1.4 → 5.1 · tüm istekler p50/p95/en çok (ms): 5225 / 11180 / 21749 → 557 / 3482 / 7622
Olay döngüsü p95 / p99 / en çok (ms): 6249.5 / 8451.5 / 10234 → 652.2 / 863 / 1296
Sonuç: ÖNCE hata yok · SONRA hata yok; Mutabakat Testi 001 TAMAM, 002 TAMAM; bağımsız fark 001 Kasa 0,00 Banka 0,00, 002 Kasa 0,00 Banka 0,00

| İşlem | adet ÖNCE → SONRA | ÖNCE p50 / p95 / en çok (ms) | SONRA p50 / p95 / en çok (ms) |
|---|---|---|---|
| Cari tahsilat (nakit) | 59 → 144 | 4558 / 11951 / 21749 | 395 / 1063 / 1642 |
| Rapor açma | 78 → 174 | 6081 / 11528 / 17664 | 2188 / 5685 / 7622 |
| Cari ödeme (nakit) | 43 → 55 | 5574 / 9819 / 11416 | 434 / 833 / 1048 |
| Banka Hareketleri listesi | 45 → 91 | 5786 / 12063 / 14325 | 490 / 953 / 1467 |
| Cari arama | 60 → 135 | 4587 / 10829 / 12121 | 436 / 1121 / 1536 |
| Cari tahsilat (havale) | 47 → 109 | 5133 / 11180 / 12576 | 526 / 1087 / 1485 |
| Satış faturası (peşin nakit) | 54 → 112 | 4651 / 11133 / 11502 | 467 / 1039 / 1420 |
| Bankalar arası transfer | 30 → 55 | 4447 / 9995 / 10061 | 501 / 1096 / 1432 |
| Banka Fişi (masraf) | 26 → 68 | 5198 / 10060 / 10335 | 448 / 1150 / 3811 |

| Ekran (gerçek Chromium) | ÖNCE p50 / p95 / en çok (ms) | SONRA p50 / p95 / en çok (ms) |
|---|---|---|
| Cari araması: tuş → harf (adet 304 → 168) | 10 / 17 / 41 | 8 / 65 / 146 |
| Cari araması: son tuş → sonuç (adet 76 → 42) | 138 / 4580 / 11134 | 849 / 1365 / 1667 |
| Banka Hareketleri: hesap süzgeci (adet 1 → 24) | 3417 / 3417 / 3417 | 355 / 1057 / 1151 |
| Ekrandan + Masraf → listede (adet 1 → 12) | 6226 / 6226 / 6226 | 2556 / 4595 / 4595 |
| Başkasının kaydı açık listede (adet 0 → 12) | — / — / — | 1398 / 2681 / 2681 |
| Raporlar penceresi açılış (adet 11 → 17) | 4832 / 11332 / 11332 | 1387 / 3307 / 3307 |
| Banka Bakiye Raporu ön izleme (adet 11 → 17) | 7290 / 11747 / 11747 | 2007 / 6086 / 6086 |
| PDF (adet 11 → 17) | 6661 / 11360 / 11360 | 1477 / 5000 / 5000 |
| Excel (adet 11 → 17) | 6392 / 8050 / 8050 | 1513 / 4100 / 4100 |
| Banka penceresi turu / yeniden açılış | — | 24 / 0 |
| Ekran hataları | 9 | 1 |

### 20 eşzamanlı kullanıcı

İstek/sn: 1.7 → 6.7 · tüm istekler p50/p95/en çok (ms): 8310 / 17855 / 87234 → 759 / 9088 / 15668
Olay döngüsü p95 / p99 / en çok (ms): 6899.6 / 12952 / 16131 → 745.5 / 1069.5 / 1429
Sonuç: ÖNCE hata yok · SONRA hata yok; Mutabakat Testi 001 TAMAM, 002 TAMAM; bağımsız fark 001 Kasa 0,00 Banka 0,00, 002 Kasa 0,00 Banka 0,00

| İşlem | adet ÖNCE → SONRA | ÖNCE p50 / p95 / en çok (ms) | SONRA p50 / p95 / en çok (ms) |
|---|---|---|---|
| Satış faturası (peşin nakit) | 63 → 133 | 6729 / 16225 / 24545 | 685 / 1469 / 11431 |
| Cari tahsilat (nakit) | 73 → 173 | 7117 / 14593 / 19753 | 562 / 1324 / 1580 |
| Cari arama | 97 → 207 | 8502 / 17855 / 21345 | 653 / 1347 / 2152 |
| Banka Fişi (masraf) | 38 → 65 | 6409 / 18129 / 18925 | 636 / 1454 / 1549 |
| Cari ödeme (nakit) | 46 → 88 | 7594 / 21189 / 24641 | 597 / 1336 / 1684 |
| Banka Hareketleri listesi | 56 → 177 | 7870 / 16919 / 20667 | 624 / 1390 / 1936 |
| Rapor açma | 76 → 207 | 9427 / 20562 / 23290 | 7557 / 13115 / 15668 |
| Cari tahsilat (havale) | 78 → 153 | 9419 / 17809 / 87234 | 711 / 1465 / 2178 |
| Bankalar arası transfer | 31 → 76 | 8299 / 18359 / 20395 | 777 / 1558 / 2193 |

| Ekran (gerçek Chromium) | ÖNCE p50 / p95 / en çok (ms) | SONRA p50 / p95 / en çok (ms) |
|---|---|---|
| Cari araması: tuş → harf (adet 252 → 176) | 12 / 29 / 66 | 9 / 65 / 156 |
| Cari araması: son tuş → sonuç (adet 60 → 44) | 141 / 154 / 5307 | 160 / 1547 / 1603 |
| Banka Hareketleri: hesap süzgeci (adet 1 → 21) | 4492 / 4492 / 4492 | 518 / 1776 / 1863 |
| Ekrandan + Masraf → listede (adet 1 → 11) | 19937 / 19937 / 19937 | 3574 / 4406 / 4406 |
| Başkasının kaydı açık listede (adet 0 → 10) | — / — / — | 1419 / 3952 / 3952 |
| Raporlar penceresi açılış (adet 8 → 7) | 8246 / 14910 / 14910 | 1786 / 2922 / 2922 |
| Banka Bakiye Raporu ön izleme (adet 8 → 7) | 11289 / 19665 / 19665 | 7801 / 11485 / 11485 |
| PDF (adet 8 → 7) | 5520 / 16113 / 16113 | 7228 / 9570 / 9570 |
| Excel (adet 8 → 7) | 6730 / 18812 / 18812 | 6916 / 11214 / 11214 |
| Banka penceresi turu / yeniden açılış | — | 21 / 0 |
| Ekran hataları | 9 | 1 |

