# Ç5-A tur 3 — kod ajanının raporu: DURDU (13.11.2026; AYNEN; ajan raporu kanıt değil)

# Ç5-A TUR 3 — RAPOR: DURDU (dosya sınırı yetmiyor; BAŞ MİMAR KARARI GEREKİYOR)

Ortam (23:09 UTC): yük 1,17, 4 çekirdek; boş bellek 8 GB; boş disk 6,7 GB.
Dal: `worktree-agent-ae4bfffba32b5f7e7`. Taban `c5a3-taban` 9b543ae4. Ağaç ana daldan açılmıştı, ileri sarılamadı; kendi commit'im yoktu, `reset --hard` ile tabana sıfırlandı. İki commit attım, push yok:
- `11112f95` — tasarım notu §18 (yalnız belge; koddan önce)
- `321202d4` — "Kanıt:" commit'i

## EN BAŞTA: değişen gözlenebilir davranış
**YOK.** Ürün kodu, test, kâhin, `test/bagimsiz/**`, `.github/**` ve package.json değişmedi. Değişen yalnız şu iki dosya:
- `docs/erp/C5-ACILIS-TASARIM.md` (§18 eklendi)
- `docs/kanit/2026-11-13/c5a2-tur3-taban-uret.txt`

## Tabanda yeniden üretim (ders 6)
Ana oturumun `is4-soru.mjs` betiğinin kopyasıyla koştum. Her son adım ayrı açılışta, TZ Europe/Istanbul, beş koşunun çıkışı 0. Sonuçlar ana oturumun 20:06 okumasıyla **BİREBİR** aynı.

Ortak durum: Fatura 1 1.000 → şüpheliye alma 1.000 → Fatura 2 500 (kayıttan sonra) → Normal Cari 400. Bu noktada 120 = 100, 128 = 1.000, kuyruk dağılımı Fatura 1 600 + Fatura 2 400.

| Son adım | Taban | S168 = B kararının beklediği |
|---|---|---|
| Fatura 2'ye bağlı çek 300 | 200, A 128 300 | Aynı sayı. Tabanda nedeni farklı: bağlı evrak her zaman en eski kayıttan 128'e düşüyor. |
| Fatura 2'ye bağlı nakit 300 | 409 doubtful-normal-exceeds | KABUL, A 128 300 |
| Fatura 2'ye bağlı nakit 100 | 200, A 120 100 (120 = 0) | A 128 100 (128 = 900, 120 = 100) |
| Fatura 1'e bağlı nakit 300 | 409 | KABUL, A 128 300 |
| Bağsız nakit 300 | 200, A 128 300 | Değişmez |

Mutabakat Testi beşinde de bulgusuz.

## Neden durdum (görev metni: "sınır yetmiyorsa DUR ve raporla")
1. **Kuyruğun girdisi yazılamaz dosyalarda kuruluyor.** `buildObligations` saf bir işlev, ama girdisini yalnız fatura servisinin kapanış içi işlevleri kuruyor (`server/routes/invoices.mjs`):
   - `accountSettleInput`
   - `chequeLinks` — çek / senet bağı `cheque_events.invoice_id` + `cheques.invoice_id` üzerinden; çekin cari satırında `invoice_id` yok
   - `obligationExtras` / `doubtfulRecordsOf` (:760–786)
   - `linkTimesOf` (:793), `chequeLinkMoments` (:830), `lockResolver`
   - carinin satırları: `routes/accounts.mjs entriesOf` (:138) + `routes/plans.mjs forAccount` (:1751) → `lib/accounts.mjs accountLedger`

   Dışarıya yalnız `obligationsFor / obligationsOf / allObligations` açık.
2. **Defter türetmesi fatura servisine ulaşmıyor.**
   - `routes/ledger.mjs`'in bağımlılıklarında fatura servisi yok.
   - `lib/ledger-freeze-worker.mjs:36` defteri yalnız store ile kuruyor (dondurma ve kural farkı yolu).
   - `lib/integrity-scan-worker.mjs:29–32` cari servisini `invoices: () => null` ile kuruyor.
   - İkinci yükleyici (`lib/bank/doubtful.mjs doubtfulState / doubtfulCredits`) yalnız store alıyor.

   Kural kuyruğa bağlanırsa bu yolların hepsi aynı kuyruğu kurabilmeli; yoksa donmuş ↔ canlı ve kapı ↔ yevmiye ayrışır.
3. **Döngü.** Kuyruğun şüpheli kalanları ikinci yükleyiciden geliyor (`routes/invoices.mjs:760–772`). İkinci yükleyici kuyruğu okursa özyineleme olur. Çözüm, iç çağrının kalanı dışarıdan alması; bu da `obligationExtras`'ın (yazılamaz) değişmesini istiyor.
4. **Yazılabilir dosyalarla tek yol kopya.** `bank/doubtful.mjs`'e store'dan ikinci bir girdi kurucu yazmak `routes/invoices.mjs` SQL'inin kopyası olur. Bu, K-1'in reddettiği "defterde ayrı dağılım"ın girdi düzeyindeki ikizi; K-1'in "kuyruk yalnız iki alan verir" sınırını da aşar.
5. **Ekran etiketi de yazılamaz yerde.** "Normal Cariye İşlendi" etiketi `routes/accounts.mjs:188` (`doubtfulNormal = doubtfulSkipOf`) → `client/assets/hof-accounts.js:361` zincirinden geliyor. Yeni kuralda kısmen 128'e düşen bağlı tahsilatta yanlış olur; kaynağı sınırın kodu değil.

## BAŞ MİMAR KARARI GEREKİYOR (§18.3)
- **(a) ÖNERİ — girdi kurucusunu taşı.** Kuyruğun girdi kurucusu store'a bağlı yeni bir saf modüle taşınır (`server/lib/obligation-input.mjs`); davranış aynı kalır.
  - Fatura servisi ve iki defter yükleyicisi bu modülü çağırır; işçilerde de çalışır.
  - İki tur: "3a" yalnız taşıma + bayt bayt eşdeğerlik testi (her carinin kuyruğu) + hız; "3b" kural.
  - Eksi: Ç5-B dosyalarına dokunur (`routes/invoices.mjs`, `routes/accounts.mjs`, `routes/plans.mjs`).
- **(b) Kopya kurucu + kalıcı eşdeğerlik testi.** Ç5-B dosyaları değişmez, ama iki kurucu zamanla ayrışabilir.
- **(c) Fatura servisini deftere enjekte et.** `routes/ledger.mjs` + `app.mjs` + üç işçi tam servis ağacı kurar. Ağır; servisin olmadığı yolda defter farklı türetir. RET önerisi.

Kod turunun izleyeceği tasarım §18.4'te:
- kuyruğun kendi olay anahtarıyla `obligationsBefore(input, cut)`
- kalem başına `records: [{ recordId, minor }]`
- bağlı alacakta 128 = min(tutar, kalemin o anki şüpheli payı), kalanı 120
- sınır yalnız 120'ye düşecek kısımda
- 120 ↔ 128 farkı B14 (a)

"Nasıl bozulur?" listesi §18.5'te, okuyucular §18.7'de (sunucuda 8 dosya, 35 test), hız etkisi §18.8'de.

## KULLANICIYA SORULMALI
Şimdilik yok; ayırt edici örnek kurulamadı. Kod turunda yeniden üretilmesi gereken iki açık nokta (§18.6):
1. **Fatura peşini** (15.10 kararıyla 120): net görünümde 120 ≥ 0 iken peşin anında yeni faturanın şüpheli payı hesapla 0 çıkıyor. DOĞRULANMADI; avanslı caride üretilirse sorulur.
2. **Avanslı caride kuyruk ↔ 128:** kuyruğun şüpheli toplamı ile 128 ayrışıyor mu — DOĞRULANMADI.

## Kabul koşulları A–G
Hepsi **KOŞULMADI**, çünkü kod değişmedi. Önce / sonra karşılaştırması anlamsız; kâhin koşuları da yük olduğu için tabanı yalnız sayı yazmak için koşmadım.
- Bilgi: tabandaki `test/bagimsiz/cari/YAPIM-ASAMASI.json`'da paketi "Ç5-A" olan kayıt **yok**. 31 kayıt var: 17 "eşleme", 14 "Ç5-B tur 2".
- Muhasebe sürücüsünün bu kurala ait sınıflama satırı `R4-SUPHELI-EVRAK-FATURA-BAGI`.

## Diğer başlıklar
- **Taban kırmızısı / mutantlar / komşular / hız:** yok — yeni test yok, ölçüm yapılmadı (ÖLÇÜLMEDİ).
- **Program ↔ kâhin farkları:** koşulmadı.
- **KAPSAM DIŞI BULGULAR:** yok.
- **DOĞRULANMADI / DENENMEYEN:** §18.6'daki iki nokta; v2.4.9 verisiyle sınıf testi (kabul D) yapılmadı.
- **CI listesine eklenecek senaryo:** yok.

## Ana oturumun yeniden koşması için
Sırayla `SON=0` … `SON=4` ile beş kez:

`HUKUK_LICENSE_URL=http://127.0.0.1:9 TZ=Europe/Istanbul ROOT=<ağaç> SON=<0..4> timeout -k 5 300 node /tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3-k2/is4-soru.mjs`

Beklenen: yukarıdaki tablonun taban sütunu.

## Bıraktığım klasörler
- Not defteri: `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3-k2` — betik + yardımcı kopyaları, beş çıktı, kanıt üreteci `kanit-yaz.py`.
- Ajan ağacında izlenmeyen `node_modules` bağlantısı duruyor.
