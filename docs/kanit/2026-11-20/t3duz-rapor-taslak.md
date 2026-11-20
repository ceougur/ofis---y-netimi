# TEK ADAY DÜZELTME TURU — rapor taslağı (adım adım büyür)

Ajan: dördüncü (devam 3) — taban `t3duz-devam3` = 7aa16bdf (doğrulandı: `git log --oneline -3` ucu 7aa16bdf). ESKİ KOD `t3duz-taban` = 780972cf
(önceki ajanın kopyası scratchpad/t3duz-d2/taban, YALNIZ OKUNUR). Not defteri scratchpad/t3duz-d3. Kanıt bu klasörde; her parçanın özeti `t3duz-ozet.txt`.

## Önceki ajanların işi (YENİDEN YAPILMADI — 'önceki ajan')
| Commit | İş | Not |
|---|---|---|
| 24bafd08 | G1 (S214 = A) Banka ve POS Hareketleri, Tüm Hesaplar 'Açılışta Sayıldı' | önceki ajan; test hesapsiz-tumu-250 |
| 0612d825 | B1 (ders 31) şüpheli ayırıcısında aynı gün sırası yazım sırasıyla | önceki ajan; test supheli-kuyruk-defter-250 'B1' |
| 9db9b69d | S212 = A bağlı tahsilatın kesiti bağın önceliğini taşır | önceki ajan; M18 |
| 8f7ef5f6 | DÜŞÜK (a) eksik testler N7, N8, N11 (N5 G1 testinde) | önceki ajan |
| 29eb3a5c | DÜŞÜK (b) S181 = B çek yolu ret iletisi | önceki ajan |
| c8d2a3ef | M12'yi öldüren test | önceki ajan |
| a79ccace, 06ba2531 | komşu beklentileri (gg2, banka-210-raporlar R2, defter-kaynak-iz-250 SINIF 3 istisnası, raporlar-230-banka) | önceki ajan; defter-kaynak-iz istisnası BAŞ MİMAR değerlendirmesine |
| fc8bd9d3, 8b66b074, db2ba915, 68b26267, 7aa16bdf | G1 hız 1 / 2 / 3 / 3b + B1 hızı; eşdeğerlik testi g1-hiz-esdegerlik-250 | önceki ajan |

Önceki ajanın sayıları (kanıt bu klasörde, 'onceki' önekli):
- `t3duz-onceki-dogrula-8b66b074.txt`: 9 dosya (yeni testler + komşu beklentileri) yeni kodda iki TZ 95 / 95; taban kopyası + yeni testler iki TZ 93 test, 14 kırmızı (8b66b074 zamanı).
- `t3duz-onceki-hiz-{kilitsiz,kilitli}-68b26267*.txt`: 68b26267'de iki kip, geçersiz blok 0, KÖTÜLEŞEN yok. 7aa16bdf bundan sonra geldi; hız hükmünü ana oturum son kodda verir (bu ajan hız ÖLÇMEDİ).
- `t3duz-onceki-mut-hiz3-68b26267.txt`: G1 hız 3 eşdeğerlik testinin mutantları H1–H5, iki TZ, hepsinde kırmızı (5 / 5).

## Bu ajanın koşuları (son kod 7aa16bdf)
(her parça bitince eklenir)

### Kâhinler önce / sonra (ders 5; kâhin dosyaları taban ↔ yeni AYNI — t3duz-taban..HEAD test/bagimsiz'e dokunmadı)
| Koşu | taban (780972cf kopyası) | yeni (7aa16bdf) |
|---|---|---|
| `npm run test:kahin-cari` | çıkış 0 · 17.253 / 17.253 | çıkış 0 · 17.253 / 17.253 |
| `npm run test:kahin-defter` | çıkış 0 · 187 / 187 | çıkış 0 · 187 / 187 |
Not: iki kâhin de tabanda yeşil — cari kâhininin (bakım 20) ve defter kâhininin senaryoları S212 / B1 / G1 durumunu içermiyor (KARARLAR.md'lerinde S212 geçmiyor); S212'yi
bekleyen kâhin muhasebe kâhini bakım 13'tür (Ç7b zincirinde, c7b2f-taban2) → sürücü bölümünde.

### Komşular (ders 10; tarama `komsu.py` + Kasa ucu = 223 dosya, dört parça; iki TZ)
