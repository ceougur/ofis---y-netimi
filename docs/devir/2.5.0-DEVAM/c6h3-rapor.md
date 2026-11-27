## Ç6-HESAP TUR 3 RAPORU — kabul ve B-g (b)

B-g (b) kodlandı; sonuçlar eski okumayla birebir. Kilitli dönemde Bilanço 100 bin satırda ~2 sn, 1 M satırda ~12 sn kısaldı. **Ama 100 bin satırda bütçe (≤ 3 sn) hâlâ aşılıyor:** Bilanço ~5,5–6 sn, Gelir Tablosu ~3,3–3,7 sn. Karar gereği bu kullanıcıya sayıyla sorulacak (aşağıda).

- **Dal ucu:** eb69d0ea (ağaç agent-ab54e5fc492a09964, taban c6h2-uc = 4b9d6c5e). PUSH yok.
- **Ürün farkı:** yalnız iki dosya. `server/lib/ledger-snapshots.mjs`'in sonuna yeni okuyucu `frozenSums` eklendi (var olan işlevlere dokunulmadı). `server/lib/financial-statements.mjs`'e `frozenPartOf` ve isteğe bağlı `frozen` girdisi eklendi.
- **Dokunulmayanlar:** app.mjs, routes, türetme dosyaları. Göç yok.

### Değişen gözlenebilir davranış: YOK
- **Eşdeğerlik testi** (`test/c6h-esdegerlik.test.mjs`): yeni okuma ile c6h2-uc'nin okuması deepStrictEqual ile birebir. Sıra, işaret ve Kesin Değil ayrıntısının sırası da aynı.
  - Kurgu: API verisi, 6 aşamada 12 tarih ve 11 Gelir Tablosu dönemi.
  - Aşamalar: kilitsiz; boş donmuş dönem; kilit 31.03 (kural farkıyla); kilit kaldır → Kapanış Fişi → yeniden kilit; kilit 30.06.
  - Ek: saf işlev düzeyinde 3 kapsam.
- **Eski kod ↔ yeni kod, aynı veri kopyasında:** uçların tam JSON'unun sha256 özeti aynı. 100 binde 13 istek × iki kip (iki şirket dahil), 1 M'de kilitli 7 istek.

### Hız (ortanca / en iyi, ms; ölçümler özel kilitle, başta yük < 2)
| Yol | Kip | Veri | Eski | Yeni | Olay döngüsü en çok (yeni) |
|---|---|---|---|---|---|
| Bilanço 31.12.2026 | kilitli | 100 bin | 7.990 / 7.348 | 5.929 / 5.184 | 9,5 |
| Bilanço 30.06 / 31.03 / 31.12.2025 | kilitli | 100 bin | 7.864 / 7.099 / 7.481 | 6.151 / 5.725 / 5.534 | 19–57 (bir ilk istekte 225) |
| Gelir Tablosu yıl / Ç2 / Ç3 2026 | kilitli | 100 bin | 4.114 / 4.202 / 4.165 | 3.680 / 3.458 / 3.454 | 10–22 |
| Değerleme 31.12 | kilitli | 100 bin | 961 | 763 | 15 |
| Şirket 2 Bilanço / Gelir Tablosu | kilitli | 100 bin | 905 / 673 | 832 / 579 | ≤ 17 |
| Bilanço 31.12 | kilitsiz | 100 bin | 5.299 / 5.125 | 5.874 / 5.529 (yük 2,27 — GEÇERSİZ) | 13 |
| Bilanço 31.12 | kilitli | 1 M | 71.732 / 68.078 | 59.792 / 58.391 (en kötü 69.549) | 54 (ilk istekte 396) |
| Bilanço 30.06 | kilitli | 1 M | 71.951 / 69.071 | 58.290 / 56.870 | 27 |
| Gelir Tablosu yıl / Ç3 | kilitli | 1 M | 36.150 / 37.036 | 33.019 / 32.026 | 29–31 |
| Bilanço / Gelir Tablosu / değerleme | kilitsiz | 1 M | ölçülmedi | 51.668 / 32.786 / 8.307 | değerlemede 145 |

- **Kilitsiz kötüleşme yok.** Uç ölçümünde kilitsiz Bilanço yeni kodda %5–10 yavaş göründü. Bu yüzden aynı süreçte, aynı girdiyle, dönüşümlü A/B koştum: balanceSheetOf ortanca 4.793 ↔ 4.846 ms, en iyi 4.527 ↔ 4.527 (≤ %1). Kilitsiz yol aynı kod; yanıt özetleri de aynı.
- **Bellek (rss):** 100 binde 1,2–1,9 GB, 1 M'de 5,1–6,3 GB.
- **Dondurma:** 100 binde 9,8 sn, 1 M'de 101 sn.

### Bütçeyi aşan yolların parça ayrıştırması (100 bin, yeni kod, iş parçacığısız; kod değiştirilmedi)
- **Kilitli:**
  - `check()`: 3,45–4,05 sn (canlı türetme 2,26–2,68 sn + mutabakatın beklenenleri)
  - donmuş toplam SQL: 1,16–1,62 sn
  - biçimlendirme: 11–22 ms; kapsam sonrası maddeler: 15 ms; kural farkı: 0,10–0,13 sn
  - değerleme girdisi: 0,44–0,48 sn; Bilanço hesabı: 0,12–0,17 sn
- **Kilitsiz:** `check()` 3,48–4,18 sn · değerleme 0,42–0,55 sn · Bilanço hesabı 0,81–0,86 sn.
- **Sonuç:** kilitli Bilanço artık kilitsizle aynı düzeyde. Kalan sürenin çoğu canlı türetme ve mutabakat (B-c / B-d bedeli, dosya sınırımın dışında).

### Eski sürüm sınıf testi (ders 53 (b); kalıcı)
- **Dosyalar:** test `test/c6h-v249-sinif.test.mjs`, fikstür `test/fixtures/c6h-v249/` (yaklaşık 1,1 MB). Üretici `uret.mjs.txt`: v2.4.9 = ccf0b0ca gerçek kodu, programın kendi API'si.
- **Kapsam:** 13 sınıf × kilitsiz / kilitli. Kilitli kopyada kilidi v2.4.9'un kendisi koyuyor (30.06.2026); 2.5.0 açılışta bunu 2.4.9 kuralıyla donduruyor.
  - Sınıflar: boş; satış faturası (peşin, açık, iadeli, KDV'siz); alış faturası (ödenmiş, açık, iadeli); kasa; banka; POS; çek / senet; taksit kartı (cari ve carisiz); elle borç / alacak (avanslı müşteri ve avans verilen tedarikçi dahil); açılış; stok hareketi; şüpheli alacak; vergi ödemesi.
- **Karşılaştırma:** v2.4.9'un kendi okuduğu sayılarla, üç tarihte (31.12.2025, 30.06.2026, 20.10.2026). v2.4.9 tarafı: Hesap Planı Mizanı (1–5 bakiye, 6 / 7 dönem hareketi), Kasa / Banka ekranı, stok değeri, Cari Listesi (borçlu / alacaklı müşteri ve tedarikçi toplamı ve sayısı).
- **Sonuç:** 64 fark, hepsi karar numaralı. Yazılı olmayan fark 0. Her sınıfta Aktif = Pasif. UTC ve İstanbul geçti.

| Fark | v2.4.9 → 2.5.0 | Karar |
|---|---|---|
| Açılış karşı hesabı (kasa, banka, satış, açılış sınıfları; yalnız kilitsiz) | 500 → 519, aynı tutar | K1 (KG-1 A, M-01…M-07, S47); "Açılış bakiyesi" açıklamalı işaretsiz elle borç için ayrıca KG-16 A |
| Stok değeri (alış faturası ve stok sınıfları) | örn. 1.495,00 → 1.470,00; 1.188,00 → 1.104,92 | Çekirdek §13 + kitap §5.1 (dönemsel ağırlıklı ortalama; v2.4.9 miktar × kartın son alış fiyatı) |
| Kâr / satışların maliyeti (satış ve stok sınıfları) | fark = −satışların maliyeti (örn. 750 → 400) | KG-11 A (YÜKSEK-1); stok sınıfında ayrıca S-06 — parasız giriş değerlemeye girdiği için 2025'te satışların maliyeti eksi |
| Şüpheli alacaklı cari | Cari Listesi'nde borçlu; Bilanço'da 128 satırında | BANKA-MODULU-PLAN §3.11b (iki sürümde de defterde 128) |

- **Testin dişi:** 5 ürün mutantından 4'ünü yakaladı (120 yerinde, alış iadesi düşülmez, 153 defterden, cari boyutu atla). "Gelir Tablosu kilitlide canlıyı okur" mutantını bu test yakalamadı; bu verilerde 6 / 7 hesaplarında iki kural aynı sonucu veriyor. O mutantı eşdeğerlik testi yakalıyor.

### Durum ve sıra
- **İki şirket:** 100 bin / 1 M uç özetleri birebir. tur 2'nin c6h-bilanco-uc testi (iki şirket, yedek → kayıt → geri yükleme) son uçta yeşil.
- **Kilit kaldırma → yeniden kilitleme ve kapanış fişi:** eşdeğerlik testinin aşamalarında.
- **Aynı gün sırası (ders 31):** c6h-bilanco testinde yeşil.
- **Dondurma zorlama:**
  - bitir: ön koşul oluşmadı, test 6/6 yeşil.
  - gozlem: kırmızı; neden okundu: "test timed out after 120000ms" (kanca dondurmayı tutuyor). tur 1–2 ile aynı sınıf, zaten 2.5.1'de.

### Mutantlar (son kod, iki TZ; bütün Ç6 testleri)
- **Kapsam:** 47 mutant × 2 = 94 koşu. tur 1'in 15, tur 2'nin 15 mutantı (hedef metni bu turda değişen 6'sı aynı anlamla yeni metne taşındı, adlarında "'" var) + tur 3'ün 17 mutantı.
- **Tur 3 mutantları:** donmuş toplamın son günü düşer; kapsam bir gün geri / ileri; alt hesap atlanır; cari atlanır; Kural Değişikliği Farkı Bilanço'da / Gelir Tablosu'nda düşer; donmuş kural tarafı yok; sınıf kimlikten okunmaz; fiş ayrımı yok; dengesiz madde sayılmaz; ilk görünüş sırası yok; 153'e dönem sonu sınıfı girer; kapanış sınıfı Gelir Tablosu'na girer; Gelir Tablosu kısım ayracı yok; kapsam sonrası maddeler okunmaz; madde sayısı yok.
- **Sonuç:** 209e0610'da 92/94 yakalandı. "Alt hesap atlanır" mutantı iki TZ'de yaşadı: API verisinde donmuş dönemde alt hesap yoktu. Teste banka hesabı (102.NN) eklendi; 1dd224f1'de bu mutant ve "cari atlanır" mutantı iki TZ'de yakalandı. Ürün kodu iki uç arasında aynı.

### Yeni testlerin kırmızı kanıtı (c6h2-uc kopyası; ders 51 gereği yalnız yeni yardımcılar `frozenSums` / `frozenPartOf` eklendi)
- **Eşdeğerlik testi:** iki TZ'de 5/6 kırmızı.
  - API testi: "Bilanço 2025-03-01 donmuş satırları madde madde okumadı ([{"to":"2025-03-01"}])" — eski yol donmuş dönemi madde madde okuyor.
  - Saf işlev testleri: "kural farkı 2025-05-31" (eski işlevler `frozen` girdisini bilmiyor) ve ayrıntı listesi boş ("[]").
- **Sınıf testi:** eski kodda da aynı sonucu verir (davranış aynı); dişi yukarıdaki mutantlar.
- **Yeni kodda:** Ç6 testleri 78/78, UTC ve İstanbul.

### Komşu ve kâhin
- **G2 komşu:** 184 dosya, taramayla (`komsu-bul.sh`). Değişen iki dosyayı, ledger-snapshots okuyucularını, dönem kilidini, uçları, overview.view'u, rapor iş parçacığını, şema kapısını ve geri yüklemeyi anan testler. UTC 2187/2187, İstanbul 2187/2187.
- **Kâhin önce (c6h2-uc) = sonra:** defter 187 denetim / 0 fark; cari 17253 denetim / 0 fark, 7 bilinen sınır, yapım aşaması 0.
- **Mutabakat / donmuş defter testleri** (koddan sonra): 42/42.

### Ana oturumun yeniden koşacağı komutlar
Betikler `docs/kanit/2026-11-20/c6h3-betik/` altında.

| Komut | Beklenen |
|---|---|
| `TZ=UTC` ve `TZ=Europe/Istanbul` ile `node --test test/c6h-esdegerlik.test.mjs test/c6h-v249-sinif.test.mjs test/c6h-bilanco.test.mjs test/c6h-bilanco-uc.test.mjs test/c6h-ba.test.mjs test/c6h-s209.test.mjs test/c6h-degerleme.test.mjs test/c6h-gelir-tablosu.test.mjs test/c6h-uc.test.mjs` | 78/78; sınıf testi "64 fark; yazılı olmayan 0" |
| `bash mutasyon.sh` (yük kilidiyle) | 94 YAKALANDI |
| Kırmızı: `/dev/shm/c6h3-kirmizi`'de (c6h2-uc + yeni test + iki yardımcı; RAM diskte duruyor) `node --test test/c6h-esdegerlik.test.mjs` | 5/6 kırmızı, nedenler yukarıdaki |
| Hız: özel kilitle `hiz-hepsi.sh` (100 bin) ve `ab.mjs` | yukarıdaki tablo |
| `komsu-kos.sh <TZ> 1 \| 2`, `kahin.sh once \| sonra` | 2187/2187 × 2; 187/0 ve 17253/0 |

### Commit'ler (sırayla)
- 051cf1bd tasarım
- a715cdd7 kod + eşdeğerlik testi
- 00416203 kanıt (100 bin)
- 74e420e3 sınıf testi
- 346feb9a tasarım (ölçüm)
- 720c2b68, b111a70b, 17a9a898 kanıt (1 M)
- 209e0610 kanıt (kilitsiz yineleme, A/B)
- 1dd224f1 eşdeğerlik testi düzeltmesi
- 66e68067, 6981a541, eb69d0ea kanıt

### BAŞ MİMAR KARARI GEREKİYOR
- **Değerleme ucunun olay döngüsü 1 M'de 131–174 ms** (iki kodda da; tur 1'in yolu, bu turun değişikliği değil). Bütçe ≤ 50 ms. Ayrıca ilk Bilanço isteğinde 396–861 ms. Olası neden: büyük sonucun ana iş parçacığına taşınması ve JSON'a çevrilmesi — DOĞRULANMADI. Kullanıcının gördüğü bir takılma olabilir.
- **Ek hız seçenekleri:**
  - Seçenek (i): donmuş toplam SQL'inin (1,2–1,6 sn) daha ucuz kurulması — kimlik önekini satır başına değil madde başına hesaplamak. Bu benim dosya sınırımın içinde, ama "bütçe aşılırsa kod değiştirme" kuralı yüzünden yapmadım; ölçülmedi.
  - Seçenek (ii): B-c (b) / (d) — canlı türetmeyi açık döneme kısmak. ledger.mjs'te, dosya sınırımın dışında.

### KULLANICIYA SORULMALI (karar 20.11 11:37: "tur 3'ten sonra süre hâlâ bütçeyi aşıyorsa sayıyla")
Bilanço 100 bin satırda ~5,5–6 sn (kilitli ve kilitsiz), Gelir Tablosu ~3,3–3,7 sn; bütçe ≤ 3 sn. Önbellekten ~4 ms. 1 M'de Bilanço 50–60 sn (hedef ≤ 60 sn, sınırda).
- **A (öneri):** BİLİNEN SINIR. İlk açılış 5–6 sn, sonraki açılışlar önbellekten; kalan iş 2.5.1'de B-c ile.
- **B:** 2.5.0'da ek iş — yukarıdaki seçenek (i) ve (ii); tahmini kazanç ~1–2,5 sn, ölçülmedi.
- Yaygın programlarda: doğrulanmış kaynak yok.

### SONRAKİ SÜRÜME (2.5.1)
- Sınıf testi fikstürü ~1,1 MB (28 küçük veri dosyası). Gerekirse sıkıştırma ya da birleştirme.
- Dondurma zorlamasının gozlem kipi (tur 1–2 ile aynı).

### DOĞRULANMADI
- Değerleme ucundaki olay döngüsü sıçramasının ve ilk Bilanço isteğindeki takılmanın nedeni.

### DENENMEYEN
- 1 M kilitsiz eski kod: kilitsiz yol aynı kod; 100 binde özetler ve A/B ölçümü aynı.
- 1 M'de 2 şirket kilitli eski / yeni ayrı tablo yok; özetler aynı.
- Tam `npm test` (görev gereği; ana oturum koşar).
- 30 kullanıcı / yük altında ölçüm.
- Sınıf testinde kural değişikliği farkı (2.4.9 donmuş ↔ 2.5.0 canlı) Kesin Değil nedeninin içeriği karşılaştırılmadı; yalnız sayılar karşılaştırıldı.

### Not defteri ve geçici dosyalar
- **Not defteri:** `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h3-ana` (betik/, kanit/, günlükler).
- **RAM diskte kalanlar:** `/dev/shm/c6h3-eski` (c6h2-uc) ve `/dev/shm/c6h3-kirmizi`. 1 M verisi ve öbür kopyalar silindi.
- Disk boş 7,4 GB.
