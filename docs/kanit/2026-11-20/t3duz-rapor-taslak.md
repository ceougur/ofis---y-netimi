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

### Muhasebe sürücüsü önce / sonra (sürücü + muhasebe kâhini bakım 13 = c7b2f-taban2'nin test/bagimsiz'i, DEĞİŞTİRİLMEDİ; `--program` taban / yeni; iki TZ)
Sürücü bu dalda (bakım 3) R-S192-BAG-SONRA kuralını taşımıyor; kural sürücü bakımı 4'te (Ç7b zinciri). Bu yüzden önceki ajan gibi c7b2f-taban2'nin
`test/bagimsiz` kopyası (scratchpad/t3duz-d3/s4c; d2'nin s4'üyle `diff -r` BİREBİR) kullanıldı; program Ç7b'siz olduğundan Ç7b kurallarının farkları
(SINIFLANMADI 33 / TZ: 600 ↔ 601, 191 ↔ 391, KDV mahsubu) iki yanda da var ve AYNI küme.
- rastgele-1 (`t3duz-surucu-r1-karsilastirma.txt`): taban R 13 / TZ (R-S192-BAG-SONRA ile ilişkili 23 satır: 10 adım + 13 rapor) → yeni R 0, R-S192-BAG-SONRA 0;
  AYNI 219 → 225; P 0 / K 0 iki yanda; SINIFLANMADI kümesi taban ↔ yeni BİREBİR (132 satır); red farkı 0; UTC = İstanbul.
  Gerileme (gerileme.py): 2 / 2 koşu FARKLI (138 fark / TZ) — ilk fark olay 616 (P308, F109'a bağlı 472.560: taban 120'den, yeni 128'den + 129 / 644 çözülme);
  yeni hiçbir karşılaştırılan alanda kâhinden UZAKLAŞMADI (yeni sınıf yok) → farkların tamamı S212 yönünde.
- rastgele-2, rastgele-3, s105, s117, s42 (`t3duz-surucu-r2-karsilastirma.txt`): rastgele-2'de taban 3 adım R-S192-BAG-SONRA (P253, P263, P284) → yeni 0;
  öbür sınıflar iki yanda aynı (P 0, K 0, R 0, red 0; SINIFLANMADI kümesi aynı); gerileme 10 koşunun 8'i BİREBİR, 2'si (rastgele-2 × iki TZ) 12 fark — S212 yönünde
  (olay 552: 120'den 128'e + 129 / 644; 564 / 600'lü olaylar: bağsız ödemenin yeniden dağılması). s117 / s42 / s105 / rastgele-3 program çıktısı BİREBİR (B1 bu
  senaryolarda sonucu değiştirmiyor).
- s81 (geri yüklenen kasa, eski sürüm v2.4.9 gerektirir): iki yanda KOŞU HATASI — sürücü eski sürümü git etiketinden açıyor; kopya klasörlerde git / etiket yok.
  DENENMEYEN (ortam sınırı; taban ve yeni aynı biçimde düşüyor).
- En küçük örnek ek-bag-sonra (sürücü bakımı 4'ün kanıtından; `t3duz-surucu-enkucuk-*`): taban ADIM 7 P2 {120: −1.000, 128: +1.000} SINIFLANMADI, Mizan 120 = 1.000 /
  128 = 1.000 (kâhin 2.000 / 0) → yeni ADIM AYNI, Mizan 120 = 2.000 / 128 = 0 AYNI. Kalan tek fark af0205 Açık Faturalar F2 program 1.000 · kâhin 0 — taban ve yenide AYNI;
  bu S213 = B (kod değişmez; kâhin bakımına — iş listesi D, sürücü bakımı 4 kararı (3)).
SONUÇ: R-S192-BAG-SONRA kuralı yeni kodda ARTIK ATEŞLEMİYOR (rastgele-1 13 → 0 R / TZ, rastgele-2 3 → 0 adım). Kural sürücü sınıflamasında duruyor (silinmedi; sürücüyü ana oturum günceller).
| Parça | dosya | UTC | Europe/Istanbul |
|---|---|---|---|
| komsu-0 | 56 | çıkış 0 · 591 / 591 | çıkış 0 · 591 / 591 |
| komsu-1 | 56 | çıkış 0 · 654 / 654 | çıkış 0 · 654 / 654 |
| komsu-2 | 54 | çıkış 0 · 625 / 625 | çıkış 0 · 625 / 625 |
| komsu-3 | 57 | çıkış 0 · 720 / 720 | çıkış 0 · 720 / 720 |
| TOPLAM | 223 | 2.590 / 2.590, fail 0, cancelled 0, skipped 0 | 2.590 / 2.590, fail 0, cancelled 0, skipped 0 |
Liste: scratchpad/t3duz-d3/komsu-tam.txt (önceki ajanın taraması; bu ajan değişen ürün dosyalarına — doubtful-gl, bank/doubtful, money-lines, obligation-queue,
routes/cheques, report-center — `komsu.py` ile yeniden taradı: 135 dosya, hepsi 223'ün içinde). Kapsam: yeni testler (hesapsiz-tumu-250, supheli-kuyruk-defter-250,
g1-hiz-esdegerlik-250, pos-komisyon-satis-gunu-250, hesapsiz-acilis-250, kural-farki-yil-250, defter-kaynak-iz-250), beklentisi değişen komşular (gg2,
banka-210-raporlar, raporlar-230-banka) ve şema kapısı / geri yükleme komşuları listede.

### Bu turda değişen 10 test dosyası — yeni kod iki TZ + taban kırmızısı (ders 7, 38, 51; taban = scratchpad/t3duz-d2/taban'ın /dev/shm kopyası + yalnız bu 10 test)
- Yeni (7aa16bdf): UTC 100 / 100, İstanbul 100 / 100 (fail 0, cancelled 0, skipped 0) — `t3duz-degisen-testler-*`.
- Taban (780972cf): iki TZ AYNI — 98 test, 79 geçti, 14 kaldı, 5 iptal (`t3duz-taban-kirmizi-*`, nedenler `t3duz-taban-kirmizi-*-nedenler.txt`). Her kırmızının NEDENİ beklenen:
  G1 — hesapsiz-tumu-250 üç test ('iki işaretli satır 0 !== 2', 'devir yalnız 22.09 POS 700000 !== 300000', 'PDF'te işaretli satır'), gg2 ('açılışta sayılmış havale … 5000 !== 0'),
  banka-210-raporlar R2 ('işaretli 0 !== 1') + aynı dosyanın son özet testi (R2 düşünce birleşim sayısı tutmuyor — ardıl), raporlar-230-banka ('Dönem Giriş (açılışta sayılmış eski havale hariç)');
  B1 — supheli-kuyruk-defter-250 'B1' ('UL-L (yazım UL, kimlikte önce L)'), defter-kaynak-iz-250 (B1'in okuduğu dört created_at / issued_at sütunu istisnada — taban okumuyor);
  S212 — üç test (nakit / çek / kısmi bağ: deepStrictEqual 120 / 128); S181 — iki test (eski ileti 'kaydı şüpheliye alma tarihinden sonraya girin…');
  G1 hız 3 eşdeğerliği — g1-hiz-esdegerlik-250 ('moneyLines bağlamda' — tabanda coverGroups yok; 5 alt test iptal).
  Tabanda YEŞİL kalanlar (var olan davranışın eksik testleri; dişleri mutasyonla): DÜŞÜK (a) N7 / N8 / N11, M12 testi.
