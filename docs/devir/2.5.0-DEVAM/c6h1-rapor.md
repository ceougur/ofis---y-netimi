# Ç6-HESAP TUR 1 — RAPOR

Ç6-HESAP tur 1'in üç işi bitti ve commit'lendi: tasarım notu, dönem sonu stok değerlemesi, Gelir Tablosu hesabı ve okuma ucu. Taban 58a6ca63, uç 4cabebf6, PUSH YOK.

Açık kalan üç nokta var:
- **Hacim bütçesi:** 100 bin satırda Gelir Tablosu süresi 3 sn sınırında, kilitli kipte biraz üstünde (aşağıda, B-c).
- **Çapraz yıl özel aralık:** kitapta tanımsız olduğu için kodlanmadı; uç 400 dönüyor (aşağıda, S-b).
- **`gozlem` zorlama kipi:** uç testi bu kipte kırmızı. Kanca testin kendi kilidinin dondurmasını tutuyor ve bırakmıyor; ön koşul gerçekleşmedi (aşağıda).

## Tasarım özeti (`docs/erp/C6-HESAP-TASARIM.md`)
**Yeni dosyalar:**
- `server/lib/stock-valuation.mjs`: değerlemenin TEK işlevi. `loadValuationInput` iki toplu sorgu yapar. `createStockValuation` iki giriş verir: `at(t)` ve `yearEnd(Y)`. D3 / D4 `yearEnd(K)` çağıracak.
- `server/lib/financial-statements.mjs`: `incomeStatement`, `estimatedCost`, `periodRuleDiff`, TEK Kesin Değil toplayıcısı `notFinalReasons`, `footnotes` ve ortak giriş `incomeStatementOf` / `stockValuationOf`. Tur 2 Bilanço'yu buraya ekleyecek.
- `server/lib/financial-statements-worker.mjs`: salt okunur bağlantı, tek okuma işlemi.
- `server/routes/financial-statements.mjs`: okuma ucu.
- `server/app.mjs`: yalnız rota kaydı.

**Tek kaynak:** Gelir Tablosu'nun her tutarı `ledger.book({from: 1 Ocak, to})` maddelerinden gelir. Değerleme stok hareketlerinden yalnız miktar ve birim maliyet okur.

**Satışların maliyeti (defter biçimi):** T(t) = DSS(Y−1) + 153'ün [1 Ocak, t] defter hareketi (N-01 ve kapanış sınıfı hariç) − DSS(t). Dönem tutarı T(b) − T(a−1). Dayanak kitap §5.2, EK-1 M4 ve M6.

**Sınıflama:** hesap önekinden yapılır, yani Ç7b'nin 601'i ve .90 alt hesapları baştan karşılanır. 760 → 631, 770 → 632, 780 → 660. `.90` alt hesaplar ayrı alt satırda; 770.90 "Sınıflandırılmamış Kasa / Banka Giderleri", 649.90 "Sınıflandırılmamış Kasa Gelirleri" adıyla. Kapanış sınıfı (voucher-close) dahil değil, N-01 dahil.

**Ara dönem tahmini:** kitapta tanımlı (EK-1 M6 / E3), kodlandı.

## Örnek veri
**Birim testleri (elle hesaplandı):**
- Ürün P, 2025: açılış 500, alış 1.200, iade 350, miktar 2.
  - Birim maliyet 1350 / 25 = 54,00; DSS 108,00; SMM 1.242,00.
- Ürün P, 2026-03-31: birim (108 + 660) / 12 = 64,00; DSS 448,00.
- Gelir Tablosu Ç1 2026:
  - A 10.500 · B 1.000 · Net 9.500 · D 240 (tahmini) · E 500 (631 ← 760: 200; 632 ← 770.90: 300).
  - F 90 · G 40 · J 10 · Dönem Net Kârı 8.800,00.
  - Aylar toplamı = çeyrek = yıl tutuyor.

**API'den girilen veri, [01.01, 30.09]:** A 2.500 · B 200 · D 1.242 (tahmini) · E 300 · F 1.000 · Dönem Net Kârı 1.758,00.

## Testler
Yeni test dosyaları: `test/c6h-degerleme.test.mjs`, `test/c6h-gelir-tablosu.test.mjs`, `test/c6h-uc.test.mjs`. Hepsi iki TZ'de 34/34 geçti.

- **Taban kırmızısı:** 3/3 dosya düştü. Neden `Cannot find module` (stock-valuation, financial-statements). Bu tek başına diş sayılmaz; dişi mutantlar veriyor.
- **Mutantlar:** 15 mutant × 2 koşu = 30/30 YAKALANDI. Liste:
  - 7/A yansıtmayı yok sayma, 610 işaretini ters çevirme, alış iadesini birim maliyetten düşmeme.
  - KG-9'da eksi değer, dönem sınırını bir gün kaydırma, kapanış sınıfını dahil etme, .90'ı ana satıra katma.
  - Kilitli dönemde canlı türetmeyi okuma, DBS'yi önceki yıldan almama, T(a−1)'i yok sayma.
  - G-1 kesme, KG-10 kart fiyatı yok, silinen ürünü sayma, N-01'i 153 akışına katma, kural farkını görmeme.

**İç tutarlılık:** kalemlerin defter tutarları Hesap Planı Mizanı'nın 6 / 7 hareketleriyle birebir. Yıl, çeyrek, ay ve boş ay denendi.

**Uç testinin denedikleri:**
- İş parçacığı ↔ iş parçacığısız sonuç birebir; veri değişince önbellek düşüyor.
- Yetki: Muhasebe 200, Personel ve Avukat 403.
- Kilit konunca sayılar aynı. Kural değişikliği benzetiminde kilitli dönem donmuş defterden, açık dönem canlıdan okunuyor ve "kural-farki" nedeni çıkıyor.
- İki şirket karışmıyor.

**Dondurma zorlama kipleri:**
- `bitir`: test yeşil 7/7. Ön koşul yok, çünkü açılışta bekleyen dondurma yok.
- `gozlem`: kırmızı 6/7. Kanca testin kendi kilidinin dondurmasını tutuyor ve bırakmıyor (`lockAndWait` 120 sn); ön koşul gerçekleşmedi. Düzenek açılıştaki dondurma için kurulmuş, bu teste uymuyor; ürün hatası değil diye değerlendiriyorum ama DOĞRULANMADI.

## Hacim (temiz 100 bin satır, `/dev/shm` kopyası, yük < 2, ölçüm kilidi özel)
| Ölçüm | Kilitsiz (ortanca) | Kilitli 30.06.2026 (ortanca) |
|---|---|---|
| Gelir Tablosu, yıllık ve dört çeyrek | 2,84–3,03 sn (en kötü 3,25) | 2,97–3,47 sn |
| Değerleme | ~0,7 sn | ~0,7 sn |
| Önbellekten | ~5 ms | ~5 ms |

- **Kilitli kipteki ilk sürüm:** 5,8 sn idi. Bütün kilitli geçmişi karşılaştıran `snapshots.ruleDiff` 2,7 sn yiyordu. Yerine dönemin kilitli kısmında yıl × hesap toplamlarını karşılaştıran `periodRuleDiff` koydum (commit d3ef7c92).
- **Kalan sürenin kaynağı:** canlı türetme (`build`) 2,1–2,5 sn sürüyor; Hesap Planı Mizanı'yla aynı maliyet.
- **Olay döngüsü:** istek başına en çok ~10–14 ms. 95 örnekte 5 kez 59–118 ms sıçrama var; nedeni DOĞRULANMADI.

## Komşu testleri ve kâhin
- **Komşu yığını:** 96 dosya taramayla bulundu (app.mjs'i anan, rota / lib tarayan, overview.view testleri) + 3 yeni dosya. UTC 1138/1138, Europe/Istanbul 1138/1138.
- **`test:kahin-defter`:** önce 187/187, sonra 187/187, 0 fark.
- **`test:kahin-cari`:** önce 17253/17253, sonra 17253/17253.
- Değişen sayı yok.

## Sürücü bakımı için
`GET /api/workspace/financial-statements/income-statement?from&to` (varsayılan Bu Yıl) şu alanları döner:
- `items[{kod, ad, gelir, tutarMinor, tahmini?, aciklama?, hesaplar[{hesap, ad, tutarMinor, tahmini?, altlar[{hesap, ad, tutarMinor}]}]}]`
- `subtotals{netSatislar, brutSatisKari, faaliyetKari, olaganKar, donemKari, donemNetKari}`
- `smm{estimated, minor, dssPrevMinor, dssMinor, stockFlowMinor, stockMovesMinor, differenceMinor}`
- `kesinDegil[{kod, baslik, aciklama, ayrinti?}]`, `footnotes[{kod, metin, ...Minor}]`, `warnings`, `bookType`, `bilgiAmacli`, `entryCount`

`GET .../stock-valuation?date` şu alanları döner:
- `totals{dbsMinor, openingMinor, purchaseMinor, returnMinor, dssMinor, smmStockMinor}`
- `products[...]`, `negative`, `warnings[{type, ...}]`, `previousYearEnd`

Tutarlar kuruş tamsayı.

## Yeniden koşulacak komutlar
- Yeni testler: `HUKUK_LICENSE_URL=http://127.0.0.1:9 node --test test/c6h-degerleme.test.mjs test/c6h-gelir-tablosu.test.mjs test/c6h-uc.test.mjs`, TZ=UTC ve TZ=Europe/Istanbul. Beklenen 34/34.
- Mutasyon: `bash docs/kanit/2026-11-19/c6h1-betik/mutasyon.sh 2`. Mutantlar dosyası not defterindeki yolu arar; betikteki `N` yolu ayarlanmalı. Beklenen 15 × 2 YAKALANDI.
- Komşu ve kâhin: `c6h1-betik/komsu-kos.sh` + `komsu.txt`. Beklenen 1138/1138 × 2, kâhin defter 187, cari 17253.
- Hacim: `c6h1-betik/hiz.sh kilitsiz|kilitli 5`, ölçüm kilidi özel.

## Commit'ler
f6b00958 (tasarım) · ebf10c10 (değerleme) · 0df70ccb (Gelir Tablosu + uç) · 0dd3156a (test eki) · d3ef7c92 (hız: periodRuleDiff) · 74598387 (tasarım eki) · 4cabebf6 (Kanıt: `docs/kanit/2026-11-19/c6h1-*` + `c6h1-betik/`)

## BAŞ MİMAR KARARI GEREKİYOR
- **B-a (D4 zamanı):** kapanmış (N-01 yazılmış) yılın ara dönemi ne gösterecek?
  - Bugünkü kod: yılda 621 varsa o yıl kesin sayılır, tahmin eklenmez; bu yüzden aylar o yılda yalnız Aralık'ta SMM gösterir.
  - Öneri: 31.12'yi içermeyen parçada T(b) − T(a−1), N-01 yalnız 31.12 parçasında.
- **B-b:** stok hareketleri ile 153 ayrışırsa bu uyarı mı, Kesin Değil nedeni mi? Kod şu an uyarı veriyor, tutarı gösteriyor. Programın kendi yolunda fark 0 ölçüldü.
- **B-c (hacim):** bütçe sınırda ya da az üstünde.
  - Öneri (a): BİLİNEN SINIR (2.1.0 kararıyla; önbellek yinelemeyi ~5 ms yapıyor).
  - Seçenek (b): kilitli yıllarda donmuş toplamı SQL'den okuyup canlı türetmeyi açık döneme kısmak. ledger.mjs / ledger-snapshots değişikliği gerekir, bu turun dosya sınırı dışında.
- **Kesin Değil sınıflaması:** "Defter mutabakatı farkı" (alt defter ↔ bilanço hesapları) Bilanço'nun nedeni sayıldı, tur 2'de eklenecek. Gelir Tablosu dengesiz maddeyi kendisi sayıyor.
- **Dipnot 3'ün tutarı:** dönemin 770.90 tutarı olarak tanımlandı. Ç7b'den önce Kasa çıkışı 770 ana hesapta, bu yüzden dipnot bugün yalnız 770.90 kısmını gösterir.

## KULLANICIYA SORULMALI
- **S-a (para) — silinmiş ürün kartının kalan miktarı dönem sonu stokuna girsin mi?**
  - A (kodlanan): girmez. Silindiği günden itibaren değeri 0 olur, alışları satışların maliyetine düşer; programın envanter raporlarıyla aynı.
  - B: girer, miktar × birim maliyet.
  - Yaygın programlarda hareketli stok kartı silinmiyor (DOĞRULANMADI). Öneri A.
- **S-b (para) — iki mali yıla taşan özel aralıkta satışların maliyeti nasıl hesaplansın?**
  - A (öneri): yıl yıl parçalara bölünür, toplanabilirlik korunur.
  - B: aralık tek yılda olmak zorunda (bugünkü kod 400 `gelir-tablosu-tek-yil` döner).
  - C: uç durum böyle kalsın (BİLİNEN SINIR).
- **S-c (uç) — alış iadesinin değeri alışlardan büyükse birim maliyet eksi çıkıyor; ne yapılsın?**
  - A (kodlanan): eksi değer + uyarı.
  - B: 0'a kırpılsın + Kesin Değil.
  - C: uç durum böyle kalsın (BİLİNEN SINIR).

## DOĞRULANMADI
- Olay döngüsündeki 59–118 ms sıçramaların nedeni.
- KG-10'un kart fiyatı bugünkü kart fiyatı (son alış). Geçmiş tarihli rapor kart fiyatı değişince değişebilir; olası BİLİNEN SINIR.

## DENENMEYEN
- Açılışta bekleyen dondurma sürerken gelen Gelir Tablosu isteği.
- Yedek → geri yükle okuması.
- 1.000.000 satırla ölçüm.
- Windows.
- Ekran yürüyüşü: ekran yok, Ç6-EKRAN'ın işi.
- Tam `npm test`: görev gereği koşulmadı.

## Not defteri ve ortam
- Not defteri klasörleri:
  - `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h1-ns` (betikler)
  - `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c6h1-kanit` (ham çıktılar)
- Taban kopyası ve `/dev/shm/c6h1-olcum` silindi.
- Son durum: yük 1,04 / 4 çekirdek, bellek boş 7 GB, disk boş 6,8 GB.
