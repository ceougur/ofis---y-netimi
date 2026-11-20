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

### Ekran senaryoları — önceki ajan (devam 3), UTC, 7aa16bdf (her biri ayrı 'Kanıt:' commit'i; sayılar `t3duz-ozet.txt`)
| Senaryo | Çıkış | Denetim |
|---|---|---|
| banka-210-ekran-aciklama | 0 | 11 / 11 |
| senaryo-banka-210-eski-satir | 0 | 29 / 29 |
| senaryo-banka-210-temel | 0 | 80 / 80 |
| senaryo-banka-210 | **1** | 426 / 428 — adım 46 iki denetim: özet Dönem Giriş 21.500 / Dönem Sonu 160.484,25 (beklenti 26.500 / 165.484,25) ve TOPLAM Giriş 21.500 — G1'in (S214 = A) BEKLENEN etkisi; beklenti değişikliği ve koşusu aşağıda (devam 4) |
| senaryo-cari-243 | 0 | 70 / 70 |
| senaryo-pos-kart-249 | 0 | 383 / 383 |
| uiux-a-243 | 0 | 51 / 51 |
| senaryo-213 | 0 | 64 / 64 |
| senaryo-223 | 0 | 29 / 29 |
| senaryo-banka-rapor-243 | 0 | 38 / 38 |
| senaryo-supheli-230 | 0 | 67 / 67 |
| senaryo-supheli-kuyruk-250 | 0 | 15 / 15 |
| senaryo-217 | 0 | 65 / 65 |
| senaryo-ux18-244 | 0 | 27 / 27 |
| senaryo-iz1-kasa-acilis | 0 | 21 / 21 |
| senaryo-kasa-acilis-uyari-250 | 0 | 20 / 20 |
| senaryo-210 | 0 | 57 / 57 |
Not: `e2e-senaryo-banka-210-s214` (429 / 429) önceki ajanın COMMIT'SİZ uyarlamasıyla koşuldu (kapsayıcı yenilenince uyarlama kayboldu) — kanıt sayılmadı; devam 4 aynı uyarlamayı commit'leyip yeniden koştu.

### Tur 3 mutasyon dosyası (`test/supheli-kuyruk-defter-250-mutasyon.mjs`, M1–M18) — önceki ajan (devam 3), /dev/shm kopyası (7aa16bdf + 62f94abe)
- M1–M9: UTC 9 / 9 yakalandı (`mut-t3-1a2-UTC`; ilk koşu `mut-t3-1a-UTC` çıkış 1 — M4'ün deseni B1'den sonra 0 kez bulundu, araç 'YAKALANDI SAYILMAZ' diye durdu; 62f94abe deseni uyarladı), İstanbul 9 / 9 (`mut-t3-1a-Europe-Istanbul`).
- M10–M18: UTC 9 / 9 (`mut-t3-1b-UTC`), İstanbul 9 / 9 (`mut-t3-1b-Europe-Istanbul`).
- M12 (+ M16, M17, M18): 5 ayrı koşu UTC + 5 ayrı koşu İstanbul, HER koşuda 4 / 4 yakalandı → M12, 1b koşularıyla birlikte 12 / 12 koşuda öldü (B1'den önce ara sıra yaşıyordu).

## Devam 4 (beşinci ajan; taban `t3duz-devam4` = 7ce23130, doğrulandı; not defteri scratchpad/t3duz-d4)

### (1) senaryo-banka-210 adım 46 — BEKLENTİ BİLEREK DEĞİŞTİ (G1, S214 = A) — commit 78d5aaab
Önceki ajanın commit'siz uyarlaması (scratchpad/t3duz-d3-kayip-banka210.diff) uygulandı ve doğrulandı: Dönem Giriş 26.500 → 21.500, Dönem Sonu 165.484,25 → 160.484,25,
'Banka (tüm hareketler)' 160.484,25; TOPLAM Giriş 21.500; 20.09'daki hesapsız eski havale satırı KALIR, 'Açılışta Sayıldı' işaretli, tutar hücreleri boş.
Dayanak aynı koşunun kendi adımları (programın defteri): adım 41 Gerçek Banka (102) 160.484,25 + kova 0, adım 42 Banka Bakiye Raporu TOPLAM Giriş 21.500 / Dönem Sonu 160.484,25,
adım 45 Alt Hesap Mizanı'nda 102.00 YOK (5.000 Ziraat'in 01.10 açılışında sayıldı) → rapor = defter (102 + 108 = 160.484,25 + 0).
| Koşu | Kod | Çıkış | Denetim | Neden |
|---|---|---|---|---|
| `e2e-senaryo-banka-210-g1` | yeni (78d5aaab) | 0 | 429 / 429 | — |
| `e2e-senaryo-banka-210-g1-taban` | taban 780972cf (/dev/shm kopyası, server + client `git archive t3duz-taban` ile BİREBİR denetlendi) + YENİ test | 1 | 426 / 429 | adım 46'nın üç yeni denetimi: özet Dönem Giriş 26.500 / Dönem Sonu 165.484,25, TOPLAM Giriş 26.500, işaretli satır YOK — G1'den önceki davranış (BEKLENEN neden, ders 38) |
| (önceki ajan) `e2e-senaryo-banka-210` | yeni + ESKİ test | 1 | 426 / 428 | eski beklenti 26.500 ↔ program 21.500 |
Not: önceki ajanın 'taban' adlı commit'siz koşusunun çıktısı (scratchpad/t3duz-d3/e2e-senaryo-banka-210-s214-taban.out, yarıda kesilmiş) adım 46'yı yeni beklentiyle YEŞİL gösteriyor — hangi kodda koşulduğu okunamadı (ders 4: 'bilinmiyor'); kanıt sayılmadı, yukarıdaki iki koşu yerini aldı.

### (3) Mutasyonun koşulmamış kısmı (devam 4; kopyalar /dev/shm/t3duz-d4, kod 78d5aaab = 7aa16bdf + yalnız e2e beklentisi)
| Koşu | Dosya / mutantlar | UTC | Europe/Istanbul |
|---|---|---|---|
| `mut-c7a-a-*` | `test/c7a-banka-250-mutasyon.mjs` 1–12 (D-07, K-14, K-15) | 12 / 12 yakalandı | 12 / 12 |
| `mut-c7a-b-*` | aynı dosya 13–24 (K-14, KG-6) | 12 / 12 | 12 / 12 |
| `mut-hiz3-*` | scratchpad/t3duz-d4/mut-hiz3.mjs H1–H5 (G1 hız 3 eşdeğerliği; 7aa16bdf'de yeniden) | 5 / 5 | 5 / 5 |
| `mut-dusuk-git-*` | scratchpad/t3duz-d4/mut-dusuk.mjs D1–D6 (N11, N7, N8, G1 ×2, S181) — `git worktree add --detach` kopyasında | 6 / 6 | 6 / 6 |
Ç7a dosyasında kapı reddiyle yakalananlar (neden 'hesap aç …: 500 Kapı eşdeğerlik …' — ürünün yazım kapısı mutantı reddediyor, testin değer denetimine varılmıyor): 6, 7, 12
(dar kontrolün 'Ç7a'nın beş mutantının kapı reddiyle yakalanması' maddesi için ham çıktı `t3duz-mut-c7a-a-*.log`).
NOT (ders 4, 14): ilk DÜŞÜK koşusu (`mut-dusuk-UTC`, `mut-dusuk-Europe-Istanbul`, `git archive` kopyası) D1'i (N11) 'YAKALANMADI' verdi — NEDEN okundu: N11'in testi
(`kural-farki-yil-250` program bölümü) v2.4.9 etiketini ister, git'siz kopyada bölüm ATLANIR ('# v2.4.9 etiketi yok'; düğüm koşucusu atlanan describe'ı 'skipped' sayısına KATMAZ —
özet 'skipped 0' der). Etiketli `git worktree` kopyasında (ders 54) D1 iki TZ'de YAKALANDI ('kilit günü = fiş günü: fiş kilitli sayılır' iletisiyle). Bu yüzden git'siz kopyada koşulan
eski kod kırmızısı (`t3duz-taban-kirmizi-*`) bu bölümü İÇERMİYOR (N11 tabanda zaten yeşil beklenen; dişi D1 ile gösterildi). kanit aracı mutasyon betiklerinin çıktısını tanımaz
('BELİRSİZ / özet yok') — sonuç betiğin kendi 'SONUÇ' satırından okunur.
