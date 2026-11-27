## Ç6-HESAP tur 4 (ORTA-1, ORTA-2, S236 = A) — rapor

Dal: `worktree-agent-adeefec4f86e1240e`, uç **f73f4f5a**, taban 5ee4d99e. Push yok, ağaç temiz (yalnız `node_modules` bağı var).

**Önce en önemli iki nokta:**
- **Hızda bir KÖTÜLEŞME var, kodu değiştirmedim.** Fiş yazıldıktan sonra, fişin dönemini içeren Gelir Tablosu %43–47 yavaşladı. Ayrıntı ve seçenekler aşağıda; karar sizde.
- **Dosya sınırının dışına çıktım.** Göç 54 yüzünden var olan üç testte göç numarası beklentisini 53 → 54 yaptım. Bu değişiklik ayrı commit'te ve geri alınabilir.

### Davranış: önce → sonra
**ORTA-1** — Kilitli kopyada Kesin Değil "Kural Değişikliği Farkı" artık alt hesap satırlarıyla çıkıyor. Tablo ve dipnot 3 / 6 donmuş tutarı göstermeye devam ediyor. Kilitsiz kopyada neden yok. Beklenen sayıları rapordan elle doğruladım.

| Sınıf | Dönem | Önce | Sonra |
|---|---|---|---|
| pos | GT 2026 ilk yarı ve Bilanço 20.10 | yalnız "bilgi amaçlı" | "2026 · 602: 1.000,00 TL" + "2026 · 602 (602.90): −1.000,00 TL" |
| stok | 2026 | neden yok | 600: 400,00 / 600 (600.90): −400,00 / 610: −100,00 / 610 (610.90): 100,00 |
| kasa | 2026 ilk yarı | neden yok | 770: −300,00 / 770 (770.90): 300,00 (dipnot 3 kilitli kopyada 0, kilitsizde 30000) |
| kasa | 2025 | neden yok | 649: 1.000,00 / 649 (649.90): −1.000,00 |

- Bilanço'nun farkı cari boyutunu da taşıyor (ör. "2026 · 120 · Ayşe Yılmaz: 100,00 TL").
- Bu yüzden c6h-bilanco-uc ve c6h-esdegerlik testlerinde birer beklentiyi değiştirdim ("BEKLENTİ BİLEREK DEĞİŞTİ").

**ORTA-2** — Fişten sonra t ≥ fiş günü ise neden düşüyor.
- Yerine yeni `bilgi` alanı geliyor: `[{kod:"kural-farki-duzeltildi", baslik:"Kural Farkı Düzeltildi (Fiş 2026-000001)"}]`. Bu alan yalnız doluyken yanıtta; fişsiz şirketin yanıtı birebir eski.
- Dört sınıfta (kasa, satış faturası, banka, taksit) sonuç Yönetim'in "kalan 0 / rule-diff-nothing" demesiyle aynı.
- Fişten önceki tarihlerin tabloları neden dahil AYNEN (Bilanço 30.06 ve 31.12.2025, GT 2025, GT 2026 ilk yarı). Aktif = Pasif her tarihte; fişin 6 / 7 neti 0.
- **KALAN ≠ 0 kurgusu:** kasa fikstüründe fişten sonra kilit 31.12.2025'e geri çekildi. Bilanço'nun nedeni KALAN ile çıkıyor: "770: 300,00 TL" + "770 (770.90): −300,00 TL"; bu, Yönetim ön izlemesinin satırlarıyla aynı.
- **Ters kayıt:** ters kayıt gününden sonra ham neden geri geliyor; fiş ile ters kayıt arasındaki günlerde bilgi satırı var.
- **Gelir Tablosu:** fiş dönemin içindeyse aynı kural uygulanıyor; dışındaysa neden aynen kalıyor.

**S236 = A** — Kurgu dar kontrolün s5'i, iki saat diliminde. Beklenenler elle hesaplandı.

| Adım | Kilitli 2025 (satışların maliyeti / dönem kârı / Bilanço 153 / Geçmiş Yıllar) | Açık yıl 2026 (01.01–10.03) |
|---|---|---|
| Kilitten sonra | −50000 / 50000 / 60000 / [[2025, 50000]] | maliyet 0, 153 = 60000 |
| K kartı 50 → 80 | değişmedi | değişmedi (K'nın birim maliyeti dönem başından gelir) |
| H Ürün → Hizmet | değişmedi | maliyet 10000, 153 = 50000, kâr −10000 |
| K silindi / geri alındı | değişmedi | maliyet 60000 → 10000 |
| Kilit kaldırıldı | −70000 / 70000 / 80000 (güncel kartla) | — |
| Yeniden kilit, sonra K 80 → 60 | −70000 kalır | — |

- Eski kodda K 50 → 80 adımından sonra kilitli 2025 −80000 / 153 = 90000 oluyordu.
- Kapsam sınırı: değerleme 31.12 günü donmuş kartla 60000, 01.01 günü güncel kartla 50000.
- v2.4.9 stok fikstürü: göç 54, göç 47'nin koşusuna göç anındaki kartları yazıyor. Bütün ürünler Hizmet'e çevrilince kilitli dönem değişmedi; kilitsiz kopyada stok 0'a indi.

### Tasarım kararları (koddan önce yazıldı: C6-HESAP-TASARIM §11, §7 düzeltmesi; C3-DONDURMA-TASARIM §21)
- **ORTA-1:** `frozenSums`'ün boyutu yetiyordu, yeni okuyucu yazmadım. Yalnız `frozenPartOf` ve `periodRuleDiff` anahtarına alt hesap eklendi; `party` seçeneği verilirse cari de girer (yalnız Bilanço verir).
- **ORTA-2 hızlı yol:** `ruleDiffCorrectionPlan` aynen kullanılıyor. Girdi, kapsamın tamamı için `periodRuleDiff`'ten anahtar başına tek "madde".
  - Neden eşdeğer: plan toplamları madde ayrımına bakmaz; madde ayrımı yalnız alt defter dışlamasında kullanılır ve dışlama ancak bir alt defter anahtarının birikimli farkı ≠ 0 iken başlar.
  - O durumda KALAN ≠ 0 kesin, ama ayrıntı için yavaş yol gerekir; bu yüzden neden bugünkü gibi ham farkla yazılıyor.
  - Fişler t gününe kadar sayılıyor (`postedCorrectionsAt`: aynı sorgu + tarih süzgeci). `snapshots.ruleDiff` mali tablolara girmedi.
- **S236:** saklanan şey kartın değerlemeye giren alanları (tür, alış fiyatı, `deleted_at`), hesaplanmış değer değil — tek formül her t ≤ kapsam için aynı sayıyı versin diye.
  - Kartlar koşu açılırken (`insertRun`, aynı işlem) dondurulur. Okuma: t'yi kapsayan en son tamamlanmış koşunun kartı; t > kapsamsa güncel kart.
  - Hizmet'e çevrilen kalemin dönem başı değeri o yılın satışların maliyetine düşer.
  - Tablonun adı tasarımda `ledger_snapshot_items` idi; `ledger_valuation_cards` yaptım. Ç3 testleri tetikleyicileri `LIKE 'ledger_snapshot%'` ile sayıyor; bu ad o listeyi bozmuyor.
- **Nasıl bozulur listesi:** §11.4 madde 10–12 (alt hesap / cari; fişten önce / sonra / ters kayıt / KALAN ≠ 0 / yanlış yıl / fişi düşmeme; kart fiyatı / tür / silme / geri alma, kilidi kaldırma ve yeniden kilitleme, sınır günü, göç, tetikleyiciler, sıfırlama).

### Göç 54 ve komşular
- Göç 54 yalnız ekleyici: `ledger_valuation_cards` tablosu + 3 tetikleyici (değiştirme yok; yalnız en son bekleyen koşuya ekleme; tamamlanmış ve kapsam içindeki satır silinemez). Yeniden koşunca yazmıyor.
- `clearSnapshots` tabloyu siliyor ve tetikleyicileri yeniden kuruyor; testte denendi.
- Komşu yığını (140 dosya: değişen dosyaları anan testler, şema kapısı, geri yükleme, göç zinciri, donmuş defter, dönem kilidi): UTC **1414/1414**, İstanbul **1414/1414**.
- **v2.4.9 sınıf testi:** 13 sınıf × 2 kip, 78 fark; yazılı olmayan 0, değeri değişen 0. Test yalnız sayı alanlarını karşılaştırıyor, yeni neden satırları bir alan değil; bu yüzden `beklenen-farklar.json`'a satır eklemedim.

### Hız (temiz 100 bin, özel kilit, dönüşümlü, her biri 5 tekrar, başta yük 1,0–1,6)
Tam tablo: `docs/kanit/2026-11-21/c6h4-ham/hiz-tablo.out`.
- **Kilitsiz:** bütün isteklerin yanıt özeti eski = yeni. Bilanço 31.12.2026 en iyi 4.748 / 4.602 ↔ 4.640 / 4.947 ms; GT yıl 2026 en iyi 3.096 / 2.999 ↔ 3.100 / 3.066 ms. Denk.
- **Kilitli:** sayılar aynı. 12 yanıtın 12'sinde neden satırları dışında her alan aynı (`fark-100k.out`).
  - Bilanço 31.12.2026 en iyi 5.322 / 5.640 ↔ 5.635 / 5.477, ortanca 5.585 / 6.255 ↔ 6.130 / 5.661 ms.
  - GT yıl 2026 en iyi 2.959 / 3.250 ↔ 3.064 / 3.283 ms.
  - Gürültü içinde; ortanca ve en iyi birlikte %10'u aşan yok.
- **Dondurma koşusu** (kart dondurması dahil): eski 8.935 / 10.175 ↔ yeni 9.617 / 9.337 ms.
- **Olay döngüsü en çok:** iki kodda da 10–140 ms arası tek tük sıçramalar.

**KÖTÜ — fişten sonra, fiş dönemin içindeyken GT yıl 2026:**

| | En iyi (ms) | Ortanca (ms) |
|---|---|---|
| Eski | 3.204 / 3.202 | 3.361 / 3.264 |
| Yeni | 4.690 / 4.573 | 4.818 / 4.781 |

- Aynı durumda Bilanço değişmedi: 5.513 / 5.319 ↔ 5.531 / 5.595 ms.
- Ölçümün ilk eski koşusunda başta yük 2,29 idi (kurala göre geçersiz); öbür üçü geçerli.
- **Parça ayrıştırması** (`parca.out`): kapsamın tamamının `frozenSums`'ü 1.191–1.305 ms + tam `periodRuleDiff` 156–209 ms + alt defter hesap listesi 72 ms ≈ +1,4 sn.

### Kırmızı kanıt, mutantlar, kâhinler
- **Eski kodda (5ee4d99e kopyası) 15/15 kırmızı, iki saat diliminde, hepsi beklenen nedenle:** neden yok / neden düşmedi / kilitli 2025 −80000 / KALAN yerine ham satırlar / ters kayıtla fiş arasında neden var.
  - Dört eşdeğerlik sınaması "işlev yok" diye düşüyor; onların dişini m2, m3 ve m5 veriyor.
- **8 mutantın 8'i yakalandı**, iki saat diliminde aynı sayıyla:

| Mutant | Kırmızı sınama |
|---|---|
| m1 alt hesabı anahtardan düşür | 7 |
| m2 yazılmış fişi düşme | 10 |
| m3 KALAN'ı yanlış yılla düş | 6 |
| m4 tarih süzgecini kaldır | 1 |
| m5 hızlı yolu boz | 6 |
| m6 donmuş yerine güncel kartı oku | 2 |
| m7 kapsam sınırını bir gün kaydır | 2 |
| m8 çözülünce donmuşu okumaya devam et | 1 |

- **Kâhinler önce = sonra:** defter 187/187 (iki TZ), cari 17648/17648 (iki TZ; 7 bilinen sınır), maliyet 41306/41306, tutar 3559/3559, muhasebe `test_model.py` 0 başarısız.
- Dar kontrolün s2 / s3 / s5 betikleri yeni kodda: s2 "SONUÇ: 0 fark"; s5 iki TZ'de aynı ve kilitli yıl değişmiyor.

### Yeniden koşmanız için
- Yeni testler: `HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=UTC node --test test/c6h-alt-hesap-farki.test.mjs test/c6h-kural-farki-fis.test.mjs test/c6h-degerleme-dondurma.test.mjs` → 15/15. Aynısı `TZ=Europe/Istanbul` ile de 15/15.
- Betikler `docs/kanit/2026-11-21/c6h4-betik/` içinde ve aşağıdaki not defteri yollarını içeriyor:
  - `komsu-kos.sh <TZ>` → 1414/1414
  - `kirmizi.sh` → 15 kırmızı (önce `eski-kur.sh`)
  - `mutasyon.sh` → 8/8
  - `kahin.sh`
  - `hiz.sh`, `hiz-fis.sh`, `parca.sh` (özel kilitle)

### Commit'ler
| Commit | İçerik |
|---|---|
| 24c1563e | tasarım notu |
| b0a73c5b | ORTA-1 |
| 9fbf911b | ORTA-2 |
| a1226bc6 | S236 + göç 54 |
| 3a17196b | üç testin göç numarası (dosya sınırı dışı) |
| 3293c1b1 | testlerin kırmızı düzeni |
| 78fc025c | tablo adı |
| f73f4f5a | Kanıt (`docs/kanit/2026-11-21/c6h4-ham`, `c6h4-betik`, `c6h4-rapor-taslak.md`) |

### BAŞ MİMAR KARARI GEREKİYOR
1. **Hız KÖTÜ** (fişten sonra, fişin dönemini içeren GT; 100 binde +1,4 sn; 1 M'de ölçmedim). Seçenekler:
   - (a) **BİLİNEN SINIR.** Yalnız etkin bir fişin gününü içeren GT'de olur; önbellek tekrarı ms düzeyinde.
   - (b) GT'nin kendi yıl okuması ile KALAN'ın kapsam okumasını tek bir `frozenSums(from:"", through:kapsam, split:a)` çağrısında birleştirmek. Yıl kısmı aynı çıktıdan alınır; ikinci SQL kalkar, ama okunan aralık yıldan bütün geçmişe genişler.
   - (c) KALAN'ı GT'den kaldırıp yalnız Bilanço'da tutmak. Bu durumda fişten sonra kasa sınıfının GT 2026'sı ORTA-1'in yeni nedenini yanlışlıkla gösterir.
   - Önerim (b): ölçüldükten sonra hâlâ %10'u aşarsa (a).
2. **Üç testin göç numarası (3a17196b):** `donmus-defter-250`, `donmus-defter-yasam-250`, `kural-farki-kapi-disi-250` dosya sınırının dışında. Onaylamazsanız göç 54 yerine başka bir saklama yolu gerekir.
3. **Alt defter farkı varken** (100 bin veride Yönetim'de "dışlanan 7") fişten sonra neden ham farkla kalıyor; Mutabakat Testi'nin "Düzeltildi" ölçütüyle aynı. Kesin ayrıntı istenirse yavaş yol gerekir. Önerim: böyle kalsın.

### SONRAKİ SÜRÜME (2.5.1)
- `bilgi` satırını 100 binlik veride göremedim (orada alt defter dışlaması var). Fikstürlerde görüldü.
- v2.4.9 sınıf testine Kesin Değil ve bilgi alanlarını eklemek (yalnız test).

### KULLANICIYA SORULMALI
Yok. Süreklilik konusunda iki okuma arasında sayısal fark bulmadım.

### DOĞRULANMADI
- Açılış onarımının bir dönemi yeniden dondurduğu durumda o dönem onarım anının kartını alıyor (tasarım §11.3'te BİLİNEN SINIR olarak yazılı; yalnız eski sürümün bozduğu dosyada olur). Programın kendi yolundan bunu üretmedim.

### DENENMEYEN
1 M satır, Windows, tam `npm test`, e2e ve ekran yürüyüşü, Ç6-EKRAN, D4 kapanış fişi yolu, iki şirkette dondurma (komşu testler dışında).

### Not defteri ve ortam
- Not defteri: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h4-ag`. Eski kod kopyası silindi; `/dev/shm`'de bu işten kalan bir şey yok.
- Ortam (bitişte): yük 0,9 / 4 çekirdek, bellek boş ~2 GB (kullanılabilir 10 GB), disk boş 6,4 GB.
- Ana oturumun özel kilitli ölçümünü ve başka ajanların paylaşılan koşularını kilit sırasıyla bekledim; ölçümlerin başta / sonda yükleri günlüklerde.