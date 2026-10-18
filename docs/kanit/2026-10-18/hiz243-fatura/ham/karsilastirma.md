
### D1 (5 ekran + 0 API, 632 sn)

| Ölçü | once | sonra | cekirdek |
|---|---|---|---|
| Belge (koşuda yazılan) | 85 | 88 | 86 |
| Doğruluk denetimi geçti / kaldı | 9 / 0 | 9 / 0 | 9 / 0 |
| Ekran hata / API hata / karakter kaybı / sayfa hatası | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| Sunucu CPU ort / en çok (%) | 49 / 87 | 29 / 56 | 31 / 62 |
| Olay döngüsü p99 en çok (ms) | 1.034 | 390 | 354 |
| Tarayıcı API isteği toplam (adet) | 6.514 | 6.650 | 5.509 |
| GET /api/workspace/stock/alerts adet · p50/p95 ms | 1.611 · 55/661 | 1.655 · 3/401 | 613 · 47/522 |
| POST /api/workspace/invoices/calc adet · p50/p95 ms | 1.423 · 5/823 | 1.473 · 4/471 | 1.445 · 4/453 |
| GET /api/workspace/dues adet · p50/p95 ms | 500 · 589/1.223 | 488 · 461/808 | 492 · 484/917 |
| GET /api/workspace/invoices adet · p50/p95 ms | 422 · 514/1.219 | 429 · 228/656 | 419 · 218/736 |
| GET /api/workspace/tasks adet · p50/p95 ms | 158 · 110/732 | 161 · 66/613 | 156 · 53/507 |
| GET /api/workspace/cheques adet · p50/p95 ms | 153 · 177/1.158 | 156 · 77/653 | 151 · 95/718 |
| GET /api/workspace/bank/badge adet · p50/p95 ms | 153 · 569/1.463 | 156 · 326/821 | 151 · 234/781 |
| Takvim (dues) yanıt baytı toplam (MB) | 1405.1 | 1135.4 | 1132.5 |
| Bütün API yanıt baytı toplam (MB) | 1480.8 | 1210.6 | 1211.9 |
| Ekran: Liste açılışı (menü → satırlar) p50/p95 ms (n) | 506/1.651 (81) | 467/1.091 (85) | 577/1.143 (83) |
| Ekran: Cari arama (son tuş → liste) p50/p95 ms (n) | 195/839 (77) | 193/799 (80) | 196/842 (78) |
| Ekran: Ürün arama (son tuş → liste) p50/p95 ms (n) | 198/938 (300) | 194/834 (310) | 197/832 (303) |
| Ekran: Toplam güncellenmesi (Tab → Genel Toplam) p50/p95 ms (n) | 64/900 (300) | 50/469 (310) | 43/450 (303) |
| Ekran: Kaydet ve Gönder → kart p50/p95 ms (n) | 364/2.123 (57) | 327/1.288 (59) | 321/1.435 (58) |
| Ekran: Liste arama (Enter → sonuç) p50/p95 ms (n) | 304/1.439 (15) | 172/836 (16) | 172/324 (16) |
| Ekran: Daha Fazla Göster (sayfa çevirme) p50/p95 ms (n) | 780/1.979 (20) | 469/968 (22) | 546/1.611 (22) |
| Ekran: Form açılışı (senaryo tık → form hazır) p50/p95 ms (n) | 214/477 (77) | 219/548 (80) | 197/510 (78) |
| Ekran: Fatura kartı açılışı p50/p95 ms (n) | 144/3.123 (16) | 81/827 (17) | 119/412 (16) |
| Ekran: PDF açılışı (indirme tamam) p50/p95 ms (n) | 414/1.655 (31) | 96/608 (33) | 85/866 (31) |
| Ekran: Rapor açılışı (Satış Faturaları, Bu Yıl) p50/p95 ms (n) | 756/2.251 (7) | 741/1.176 (7) | 789/1.170 (7) |
| Düzen kayması (CLS) pencere başına en az–en çok | 1.22–2.30 | 0.17–0.70 | 0.09–0.39 |
| CLS içinde Fatura/diğer pencere kayması (section.hof-modal) toplam | 7.78 | 0.27 | 0.33 |
| 30 sn bekleme aşımı (ekran) | 0 | 0 | 0 |

### D2 (8 ekran + 2 API, 638 sn)

| Ölçü | once | sonra | cekirdek |
|---|---|---|---|
| Belge (koşuda yazılan) | 222 | 332 | 350 |
| Doğruluk denetimi geçti / kaldı | 9 / 0 | 9 / 0 | 9 / 0 |
| Ekran hata / API hata / karakter kaybı / sayfa hatası | 8 / 1 / 0 / 0 | 3 / 0 / 0 / 0 | 2 / 0 / 0 / 0 |
| Sunucu CPU ort / en çok (%) | 105 / 109 | 98 / 107 | 93 / 109 |
| Olay döngüsü p99 en çok (ms) | 4.140 | 2.156 | 2.017 |
| Tarayıcı API isteği toplam (adet) | 9.825 | 11.859 | 11.663 |
| GET /api/workspace/stock/alerts adet · p50/p95 ms | 1.840 · 997/2.330 | 2.264 · 508/1.496 | 1.674 · 539/1.466 |
| POST /api/workspace/invoices/calc adet · p50/p95 ms | 1.273 · 1.223/2.860 | 1.468 · 549/1.692 | 1.546 · 505/1.602 |
| GET /api/workspace/dues adet · p50/p95 ms | 1.258 · 1.224/2.564 | 1.288 · 757/1.754 | 1.283 · 732/1.618 |
| GET /api/workspace/invoices adet · p50/p95 ms | 1.058 · 1.370/2.663 | 1.363 · 737/1.670 | 1.407 · 684/1.600 |
| GET /api/workspace/tasks adet · p50/p95 ms | 507 · 878/2.066 | 659 · 480/1.317 | 714 · 408/1.287 |
| GET /api/workspace/cheques adet · p50/p95 ms | 499 · 817/2.015 | 651 · 407/1.283 | 706 · 467/1.194 |
| GET /api/workspace/bank/badge adet · p50/p95 ms | 499 · 1.369/2.392 | 651 · 738/1.462 | 706 · 755/1.423 |
| Takvim (dues) yanıt baytı toplam (MB) | 3563.4 | 3386.2 | 3410.9 |
| Bütün API yanıt baytı toplam (MB) | 3720.3 | 3603.9 | 3604.4 |
| Ekran: Liste açılışı (menü → satırlar) p50/p95 ms (n) | 2.268/4.066 (79) | 1.594/2.678 (90) | 1.585/2.597 (91) |
| Ekran: Cari arama (son tuş → liste) p50/p95 ms (n) | 1.821/2.887 (69) | 844/1.875 (80) | 824/1.922 (83) |
| Ekran: Ürün arama (son tuş → liste) p50/p95 ms (n) | 1.437/3.322 (265) | 842/1.968 (303) | 825/1.868 (322) |
| Ekran: Toplam güncellenmesi (Tab → Genel Toplam) p50/p95 ms (n) | 1.244/2.851 (265) | 539/1.647 (303) | 458/1.458 (322) |
| Ekran: Kaydet ve Gönder → kart p50/p95 ms (n) | 5.061/11.184 (43) | 2.289/5.325 (48) | 2.471/5.424 (50) |
| Ekran: Liste arama (Enter → sonuç) p50/p95 ms (n) | 2.253/3.045 (14) | 1.116/2.229 (19) | 1.143/1.974 (17) |
| Ekran: Daha Fazla Göster (sayfa çevirme) p50/p95 ms (n) | 2.543/7.556 (13) | 2.340/4.543 (32) | 2.204/4.021 (27) |
| Ekran: Form açılışı (senaryo tık → form hazır) p50/p95 ms (n) | 401/829 (69) | 425/854 (80) | 468/875 (83) |
| Ekran: Fatura kartı açılışı p50/p95 ms (n) | 2.966/5.127 (19) | 1.499/3.010 (21) | 1.008/2.534 (18) |
| Ekran: PDF açılışı (indirme tamam) p50/p95 ms (n) | 1.503/2.481 (24) | 624/1.915 (26) | 646/1.581 (29) |
| Ekran: Rapor açılışı (Satış Faturaları, Bu Yıl) p50/p95 ms (n) | 3.007/5.229 (12) | 1.705/2.996 (18) | 1.518/3.167 (12) |
| Düzen kayması (CLS) pencere başına en az–en çok | 3.61–5.20 | 0.84–1.97 | 0.36–1.50 |
| CLS içinde Fatura/diğer pencere kayması (section.hof-modal) toplam | 32.97 | 2.48 | 1.65 |
| 30 sn bekleme aşımı (ekran) | 6 | 0 | 0 |
