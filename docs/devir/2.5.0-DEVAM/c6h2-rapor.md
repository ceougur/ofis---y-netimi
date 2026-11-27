## Ç6-HESAP TUR 2 RAPORU (Bilanço hesabı + Kesin Değil + B-a + S209)

Bilanço hesabı yazıldı, okuma ucu açıldı, üç kod maddesi kodlandı. Kanıtın büyük kısmı yeşil. **Ama hacim bütçesi aşıldı:** 100 bin satırda Bilanço kilitsiz ~4,7 sn, kilitli ~6,6 sn (bütçe ≤ 3 sn). Bu konu B-g sorusuna yazıldı, karar baş mimarda.

- **Çalışma alanı:** ağaç agent-a7236347e0f8b6e8c, taban c6h2-taban = 469a3d9b, son uç **4b9d6c5e**. PUSH yok.
- **Dosya sınırı:** yalnız tur 1'in Ç6 dosyalarına, `test/c6h-*` dosyalarına ve tasarım notuna yazıldı (financial-statements.mjs, financial-statements-worker.mjs, routes/financial-statements.mjs, stock-valuation.mjs). app.mjs ve türetme dosyaları değişmedi; göç yok.

### Tasarım notu (docs/erp/C6-HESAP-TASARIM.md) — ne değişti
- **§6 kesinleşti:**
  - **Maddeler:** `ledger.check()` bir kez çağrılıyor (Defter Mutabakatı'nın aynı işlevi). Onun canlı türetmesi `book({to:t, live})`'a veriliyor; ikinci tam türetme yok.
  - **Boyutlar:** hesap / alt hesap / cari boyutunda tek geçiş, madde başına sorgu yok.
  - **Brütleştirme:** planın `reverseBalanceOf` kuralıyla yapılıyor. Alacaklı 127 için EK-2 S.36 önerisi uygulandı (B-f).
  - **153:** tahminse DSS_t, kesinse defter.
  - **Kapanmış yıl:** fiş tablosundan okunuyor — t'ye kadar ters kaydı olmayan Kapanış / Önceki Yıl Sonucu fişinin en geç günü 31.12.K ise K ve önceki yıllar kapanmış sayılıyor (EK-1 M4).
  - **Hesaplanmış iki satır:** ikisi de `incomeStatement`'tan geliyor. Geçmiş yıllar yıl yıl; kârlı yıllar 570 kısmında, zararlı yıllar 580 kısmında.
  - **Aktif = Pasif:** tutmazsa ayrı fark satırı çıkıyor.
- **§7:** Kesin Değil sırası, B-a ve S209 yazıldı.
- **§8:** okuma ucu ve ölçüm sonuçları.
- **§9:** "nasıl bozulur" listesine 8 ve 9 eklendi.
- **§10:** S-c, B-a ve B-d kapatıldı; yeni sorular B-e, B-f, B-g.

### Örnek veriyle Bilanço (test/c6h-bilanco.test.mjs; elle hesap testte yazılı)
Kapanmamış 2025 + 2026, t = 30.06.2026:
- **Aktif 2.320,00:**
  - I.A 1.760: Kasa 1.730 + 102.02 80 + 103 −50 (düzenleyici hesap eksi)
  - I.C 240: yalnız borçlu müşteri C2
  - I.E 200: 153 = DSS 100 (tahmini) + 159 ← borçlu tedarikçi 100
  - I.H 120: 191 100 + 198 ← borçlu 360 20
- **Pasif 2.320,00:**
  - III.A 300 ← KMH 102.01: 30
  - III.D 340 ← alacaklı müşteri C1: 300
  - 391: 240
  - V.F hesaplanmış Dönem Net Kârı 100 (= aynı t'nin Gelir Tablosu)
  - Geçmiş Yıllar — Kapanmamış, 570 kısmı (2025): 650
  - 519: 1.000
- **Kapanış Fişi senaryosu:** 2025 kapatılınca sonuç 590'a geçiyor, Geçmiş Yıllar satırı boşalıyor. Fiş ters kaydedilince 2025 yeniden kapanmamış sayılıyor (API testinde 800,00 ile).
- **API testi** (aynı adlı iki "Ayşe Yılmaz" ile), 30.09: Aktif = Pasif = 4.248,00. Ayşe 1 120'de 2.800, Ayşe 2 340'ta 400.
- **Büyük veri (temiz 100 bin):** fark 0. Hesaplanmış Dönem Net Kârı = Gelir Tablosu yıl 2026 = 51.248.200,44 TL.

### Kesin Değil nedenleri — hangi veride hangisi
- **Tamamlanmamış Açılış:** 519 ≠ 0.
- **Satışların Maliyeti Tahminidir:** stoklu dönem.
- **Defter Mutabakatı Farkı:** `check()`'in mutabakatı okunuyor, başarısız denetimler ayrıntıda. API testinde kural benzetimiyle 120 denetimi başarısız oluyor ve neden görünüyor.
- **Aktif ile Pasif Eşit Değil:** dengesiz madde varken; fark 1,00.
- **Kural Değişikliği Farkı:** kilitli t'de; ayrıntı "2026 · 120: 100,00", "2026 · 600: −100,00".
- **Eksi Stok** (KG-9) ve **Eksi Birim Maliyet** (S209).
- **İmkânsız Ters Bakiye:** eksi kasa −10,00; borçlu 300.01 40,00.
- **Borçlu 360** (KG-14).
- **Kapanmamış Önceki Yıl:** 2025.
- **Bilgi Amaçlı:** Defter Türü bilanço esası değilse.

### B-a ve S209 (sayıyla)
- **B-a** (kapanmış 2026, N-01 = 266,67; test/c6h-ba.test.mjs):
  - Aylar: Ocak 240,00, Şubat–Kasım 0, Aralık 266,67 − 240,00 = 26,67 → toplam 266,67 = yıl. Aralık parçası tahmin taşıdığı için Kesin Değil yazıyor.
  - Çeyrekler: 240 / 0 / 0 / 26,67.
  - Yıllık sonuç kesin.
- **S209** (test/c6h-s209.test.mjs): ürün Q için pay −50 / payda 5 → değer 0, kırpılan −50,00 ayrıntıda görünüyor. Satışların maliyeti −50,00; Gelir Tablosu ve Bilanço aynı nedeni ve aynı değeri gösteriyor.
- **Tur 1 testinde değişen beklenti:** test/c6h-degerleme.test.mjs'deki "eksi değer + uyarı" beklentisi S209 kararıyla "0 + kırpılan" oldu.

### Kırmızı kanıt (c6h2-taban kopyası; nedenler okundu)
| Test | Eski kodda sonuç | Neden |
|---|---|---|
| c6h-bilanco | 1/1 kırmızı | `balanceSheet` dışa açık değil ("uç yok"; dişi mutantlarda) |
| c6h-bilanco-uc | 8/8 kırmızı | 404 "Endpoint bulunamadı." |
| c6h-ba | 4/5 kırmızı | sayıyla: Ocak 0 ≠ 24000, Aralık 26667 ≠ 2667 (yıllık kesin testi eski kodda da yeşil — beklenen) |
| c6h-s209 | 3/3 kırmızı | sayıyla: DSS −5000 ≠ 0, maliyet 0 ≠ −5000 |
| c6h-degerleme (yeni beklenti) | 1/12 kırmızı | −8000 ≠ 0 |

Yeni kodda: UTC 71/71, Europe/Istanbul 71/71 (son uç fe693f47).

### Mutantlar
15 mutant × 2 koşu (UTC + Europe/Istanbul) = **30/30 yakalandı**. Taban f2e3aab9'da da, son uç fe693f47'de de koşuldu. Liste ve testler (betikteki adlarıyla):

| Mutant | Kapsam | Yakalayan test |
|---|---|---|
| M1 | netleştirme | c6h-bilanco |
| M2 | alacaklı 120 kendi kaleminde kalıyor | c6h-bilanco |
| M3 | düzenleyici işaret ters | c6h-bilanco |
| M4a | Dönem Net Kârı ayrı formülle | c6h-ba + c6h-bilanco |
| M4b | Dönem Net Kârı bir gün kaymış | c6h-ba |
| M5 | kapanmış yıl da sayılıyor | c6h-bilanco |
| M6 | 153 defterden | c6h-ba + c6h-bilanco |
| M7a | borçlu 360 nedeni düşüyor | c6h-bilanco |
| M7b | aktif-pasif nedeni düşüyor | c6h-bilanco |
| M7c | mutabakat nedeni düşüyor | c6h-bilanco-uc |
| M7d | kapanmamış yıl nedeni düşüyor | c6h-bilanco |
| M8 | B-a: N-01 ara parçaya katılıyor | c6h-ba |
| M9 | S209 kırpma yok | c6h-s209 + c6h-degerleme |
| M10 | kilitli t'de canlı türetme | c6h-bilanco-uc |
| M11 | ters kaydı olan kapanış yılı kapatıyor | c6h-bilanco-uc |

### İç tutarlılık
- Hesap başına defter bakiyesi = aynı t'nin Hesap Planı Mizanı (1–5); API testinde 31.03 ve 30.09'da denetlendi.
- Bilançoda gösterilen tutar = defter (153 hariç: DSS_t). Brütleştirme yalnız kalemi değiştiriyor.
- Hesaplanmış Dönem Net Kârı = Gelir Tablosu ucu; 31.01, 31.03, 30.06, 30.09 ve 31.12'de (gelecek tarih) denetlendi.
- Aktif = Pasif şu durumlarda tutuyor: boş veri, tek kayıt, tam veri, kilitli / kilitsiz t, kapanmamış önceki yıl, 29 Şubat 2028.
- İki şirket karışmıyor. 002'de yedek → kayıt → geri yükleme sonrası Bilanço yedekteki gibi.
- Aynı gün kayıtlarının sırası sonucu değiştirmiyor (ders 31).
- İş parçacığı ve iş parçacığısız yol aynı sonucu veriyor.

### Hacim (ÖZEL kilit; geçerli koşu yükü 0,5–1,4)
- **Bilanço:**
  - kilitsiz: ortanca 4,66–4,75 sn
  - kilitli: 6,22–6,81 sn — **BÜTÇE AŞILDI**
  - olay döngüsü en çok 10,9–27 ms; önbellekten 3,6 / 7,9 ms
- **Sürenin dağılımı:**
  - canlı türetme 2,0–2,6 sn (Gelir Tablosu ile ortak)
  - mutabakatın cari listesi + SQL 1,0–1,4 sn
  - kilitli kipte donmuş dönemin tamamının okunması 1,75–1,92 sn
  - değerleme 0,4 sn
  - Bilanço hesabı 0,8–1,2 sn (fe693f47 ile yıl başına tam geçiş kalktı; büyük veride örnek sayılar aynı)
- **Gelir Tablosu önce / sonra, aynı kopyada:** en kötü +%4,4 → kötüleşen yok.
- **Geçersiz yineleme:** fe693f47'den sonraki kilitsiz yinelemenin başlangıç yükü 4,35'ti (başka ajan kilitsiz test koşuyordu). Geçersiz sayıldı ve dosya adında işaretli.

### Komşular ve kâhin
- **G2 komşu** (80 dosya, taramayla — komsu-bul.sh): UTC 938/938, Europe/Istanbul 938/938.
- **Kâhin önce = sonra:** defter 187 denetim / 0 fark; cari 17253 denetim / 0 fark (7 bilinen sınır, yapım aşaması 0).
- **Dondurma zorlama:**
  - bitir: ön koşul gerçekleşmedi, test yeşil 8/8.
  - gozlem: 7/8, "dondurma 120000 ms'de bitmedi". Tur 1'in c6h-uc'si ile aynı sonuç; açılış dondurmalı kurgu kullanıcının 20.11 kuralıyla 2.5.1'e bırakıldı.

### Sürücü için okuma ucu
`GET /api/workspace/financial-statements/balance-sheet?date=YYYY-MM-DD` (varsayılan bugün; yetki `overview.view`).

Çıktı alanları:
- date, year, bookType, bilgiAmacli, entryCount
- aktif / pasif: { gruplar: [{ grup, ad, kalemler: [{ kod, ad, hesaplar: [{ hesap, ad, tutarMinor, tahmini?, hesaplanmis?, altlar, kaynaklar?, cariSayisi?, yillar? }], tutarMinor }], tutarMinor }], tutarMinor }
  - Hesaplanmış "Geçmiş Yıllar — Kapanmamış" kalemi kod `V.GY` ile V.F'den sonra geliyor.
- hesaplanmis: { donemNetKari, gecmisYillar[] }
- toplamlar: { aktifMinor, pasifMinor, farkMinor }
- fark
- accounts: [{ hesap, ad, defterMinor, bilancoMinor, dagilim[] }]
- smm: { kesin, dssMinor, defter153Minor, closedYear }
- kesinDegil, footnotes, warnings

Stok değerlemesi ucuna eklenenler: `clipped`, ürün satırında `kirpilanMinor`; Gelir Tablosu ucuna `smm.posted`.

### Ana oturumun yeniden koşacağı komutlar
Betikler: docs/kanit/2026-11-20/c6h2-betik/.

| Komut | Beklenen |
|---|---|
| `TZ=UTC` ve `TZ=Europe/Istanbul` ile `node --test test/c6h-bilanco.test.mjs test/c6h-bilanco-uc.test.mjs test/c6h-ba.test.mjs test/c6h-s209.test.mjs test/c6h-degerleme.test.mjs test/c6h-gelir-tablosu.test.mjs test/c6h-uc.test.mjs` | 71/71 |
| `mutasyon.sh` | 30 yakalandı / 0 yaşadı |
| `kirmizi.sh` (eski kopya `/dev/shm/c6h2-eski` = git archive c6h2-taban + node_modules bağı) | yukarıdaki kırmızı sayıları |
| komşu: komsu.txt ile `yuk-b.sh` | 938/938 × 2 |
| `npm run test:kahin-defter` | 187 / 0 |
| `npm run test:kahin-cari` | 17253 / 0 |
| hacim: `hiz-hepsi.sh` (ÖZEL kilit) | kilitsiz ~4,7 sn, kilitli ~6,6 sn |

### Commit'ler (sırasıyla)
| Commit | İçerik |
|---|---|
| b21c0400 | Tasarım notu |
| dd3e93d5 | Bilanço + okuma ucu |
| dd865ecd | Kesin Değil nedenleri |
| a105b993 | B-a |
| f2e3aab9 | S209 |
| d3b2da11 | Kaynak adedi (sunum) |
| f65e6d42 | Kanıt |
| 6b8614f2 | Kanıt |
| fe693f47 | Hız düzeltmesi |
| ee4a05e2 | Tasarım (hacim) |
| 4b9d6c5e | Kanıt |

### BAŞ MİMAR KARARI GEREKİYOR
- **B-g (hacim):**
  - Seçenekler: (a) BİLİNEN SINIR — aşım "az" değil, kullanıcı ilk açılışta 5–7 sn bekler; (b) donmuş dönemin toplamlarını ledger-snapshots'ta SQL ile okumak (kilitli ~−1,8 sn); (c) mutabakat sonucunu Mutabakat Testi'nin son tam taramasından okumak (integrity.mjs'e okuyucu, ~−1,2 sn, en çok 15 dk eski); (d) B-c(b).
  - Öneri: (b) + (c) Ç6-EKRAN'dan önce, dosya izniyle; o zamana kadar (a).
- **B-e:** "biten ay mahsupsuz" uyarısı ve "Önceki Yıl KDV Mahsubu Yapılmamış" nedeni KDV dönemi boyutuna bağlı. Bu alan Ç7b'nin dosyalarında olduğu için kodlanmadı (toplayıcıda kodu hazır, besleyen yok). Öneri: Ç7b birleşince Ç6-EKRAN ile.
- **B-f (sınıflama):** alacaklı 127 EK-2 S.36 önerisiyle 340'a alındı (kart bazında). Seçenek: kendi kaleminde eksi + Kesin Değil. Mali müşavir A onayı gerekiyor.
- **Kapanmış yıl tanımı** (§6): yukarıdaki fiş kuralı benim yorumum. D4'ün fiş yapısı gelince doğrulanmalı.

### SONRAKİ SÜRÜME (2.5.1)
- Açılış dondurmalı uç kurgusu: gozlem kipi kırmızısı tur 1 ile aynı.
- Kâhin / sürücü eşlemesi: Bilanço alanları sürücü bakımı 4'te.

### KULLANICIYA SORULMALI
Yok. B-a ve S209 verilen kararlarla kodlandı; yeni para kuralı çıkmadı.

### DOĞRULANMADI
- B-g'deki (b) / (c) kazanç tahminleri ölçülmedi.
- Olay döngüsünde Gelir Tablosu'nda bir ölçümde 105 ms sıçrama görüldü (tur 1'deki gibi; nedeni doğrulanmadı).

### DENENMEYEN
- 1 M satır (tur 3 kabulü).
- Eski sürüm sınıf testi (ders 53 b; tur 3).
- Windows / CI.
- e2e ve ekran (Ç6-EKRAN).
- Tam `npm test`.
- Şüpheli alacaklı veride iş parçacığı ↔ iş parçacığısız mutabakat eşitliği.
- Gerçek D4 fişleriyle (prior-year-result) kapanış.

### Not defteri
- Klasör: /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h2-ana
- Taslak rapor: docs/kanit/2026-11-20/c6h2-rapor-taslak.md
- /dev/shm kopyaları silindi.
- Ortam: disk 7,6 GB boş, bellek 9 GB boş, yük 4,2 / 4 çekirdek (diğer ajanların koşuları).
