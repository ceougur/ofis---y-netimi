# Ç5-A tur 3a (yalnız taşıma) — kod ajanının raporu (14.11.2026; AYNEN; ajan raporu kanıt değil — ana oturum yeniden koşar; dar kontrole VERİLMEZ)

# Ç5-A TUR 3a — RAPOR (yalnız taşıma; davranış aynı)

Ortam: yük 2,12 / 4 çekirdek, boş bellek 12 GB, boş disk 6,0 GB. Dal `worktree-agent-a068d42a7b77ba335`, taban `c5a3a-taban` (321202d4). Push yapılmadı.

## Davranışın değişmediğinin kanıtı (kabul A)
Döküm betiği `dok.mjs` dışa açık yüzün hepsini döktü: her carinin `obligationsFor`, önbellekli `obligationsOf` (soğuk / ılık), `allObligations().get(id)` ve `entryStates` çıktısı; ayrıca `allEntryStates`, `paymentStates`, `repairScreen` ve `cardLedgerState`. Map'ler anahtar sırasıyla, `overdue(gün)` üç günde serileştirildi. Taban ile yeni kod aynı verinin iki taze kopyasında, durağan saatle koştu.

| Veri | Kapsam | Satır | SHA-256 | Fark |
|---|---|---|---|---|
| Temiz 100 bin satır | 2 şirket, 1.890 cari, 37.941 fatura, 5.928 kartlı fatura | 1.892 | 365a8f75…a323 iki tarafta da | 0 (`cmp` aynı) |
| v2.4.9 fikstürü (`tyk-fark-v249`) | 50 cari | 51 | 5fe1e924…2650 iki tarafta da | 0 |
| Kendi sınıf verim | kalıcı testin hakemi (30 cari-durum) | — | UTC ve İstanbul üretimleri bayt bayt aynı | 0 |

## Taşınanlar (gövdede değişen satır yok)
`routes/invoices.mjs`'in 631–639, 647–733, 740–844 ve 986–1009. satırları (toplam 225 satır), `lib/obligation-input.mjs` içindeki `createObligationInput({ store })` kapanışının 13–236. satırlarına taşındı. Girinti aynı kaldı. Betikle doğrulandı: taşınan satırlar tabandaki diziyle birebir aynı.

- **Taşınan işlevler:** `offsetLabel`, `chequeLinks`, `groupBy`, `settleTables`, `batchSettleInput`, `settleKey`, `groupInto`, `lockCache` + `lockResolver`, `doubtfulRecordsOf`, `obligationExtras`, `linkTimesOf`, `MOMENT_*` + `chequeLinkMoments`, `withExtras`, `accountSettleInput`.
- **Servis tarafında değişenler (yalnız bunlar):**
  - İki içe aktarma satırı: `doubtfulState` ile `lockAtOf / lockHistory` servisten modüle geçti, servise `createObligationInput` içe aktarıldı.
  - 632. satır: `const { offsetLabel, settleTables, batchSettleInput, settleKey, obligationExtras, withExtras, accountSettleInput } = createObligationInput({ store })`.
  - Çağıran satırların metni değişmedi.
  - Önbellekler (`settledCache`, `oneCache`, `accountPrints` / `printSql`) ve `settleKey`'in metni aynen kaldı. Kilit belleği modül örneğinde; servis tek örnek kurduğu için ömrü aynı.
- **Modülün dışa açık yüzü:** `offsetLabel, chequeLinks, settleTables, batchSettleInput, settleKey, lockResolver, doubtfulRecordsOf, obligationExtras, linkTimesOf, chequeLinkMoments, withExtras, accountSettleInput`.
  - Bağımlılığı yalnız `store`. Saat yok (gün parametreyle gelir), ayar okunmaz.
  - İçe aktardıkları yalnız lib: http (parseJson), invoice-math, plans (dayText), obligation-queue (lockAtOf / lockHistory), bank/doubtful.
- **Çağıranlar (taramayla):** üretimde yalnız `routes/invoices.mjs`. Ayrıntısı tasarım notu §18.9 (3)'te. Başka sunucu dosyası bu adları çağırmıyor, testlerde yalnız yorumlarda geçiyor. Servis yüzü (`obligationsFor / obligationsOf / allObligations`) ve onu çağıranlar değişmedi.

## BAŞ MİMAR KARARI GEREKİYOR — carinin satırlarını kuran zincir taşınmadı
`accounts.mjs entriesOf`, `plans.mjs ledgerPlansByAccount / returnCuts / saleSources` ve `accountLedger` zinciri bu turun dosya sınırıyla taşınamıyor:
- `test/r2-249/mutasyon.mjs`, M1–M7 desenlerini doğrudan `server/routes/plans.mjs` yoluyla `returnCuts / scanReturnCuts` gövdelerine uyguluyor.
- O dosya yazılabilir listede yok. Taşınırsa bu yedi mutant "metin bulunamadı" olur (diş kaybı).
- Yarım zincir 3b'ye bir şey kazandırmadığı için `entriesOf`'a da dokunmadım. Modülün girdi işlevleri carinin satırlarını bugünkü gibi parametre alıyor.

Seçenekler (§18.9 (4)):
- **(i) Öneri:** 3b'nin başında zincir de modüle taşınır. Girinti aynı kalacağı için r2-249'da yalnız `PL` dosya yolu değişir (tyk-mutasyon'un plans desenleri de öyle). Bunun için o dosyanın yazılabilir listeye alınması gerekir.
- **(ii)** Modül kart haritasını bir sağlayıcıdan alır, işçi plans servisini kurar. Bu (c) seçeneğine yaklaşır; önermiyorum.

## Kabul B–F
- **B — kalıcı test `test/obligation-input-250.test.mjs`:**
  - Sınıflar: bağsız / bağlı tahsilat, çek bağı + karşılıksız, şüpheli kaydı, taksit kartı + kart tahsilatı, faturasız iade, Vade / Beklenen Ödeme Tarihi, mahsup, kilitten sonra düzeltmeyle kurulan bağ (cari tahsilatı ve çek), 002'de kilit sonradan konup bağ kuruluyor. İki şirket, iki durum (kilitli / kilit değişti).
  - Denetimler: (1) ayrı salt okunur bağlantıda yalnız store ile kurulan modül = servis yüzü (tek cari yolu, toplu yol, işlem içi okuma); (2) servis çıktısı = `test/fixtures/obligation-input-250-hakem.json`. Hakemi tabanda `HAKEM_YAZ` ile testin kendisi üretti.
  - Sonuç: UTC 1/1 ve İstanbul 1/1 yeşil.
  - Tabanda KIRMIZI, iki TZ: "lib/obligation-input.mjs yüklenemedi (taşıma yok): Cannot find module …".
- **B — mutantlar (`test/obligation-input-250-mutasyon.mjs`): 14 / 14 değerle yakalandı.**
  - Çek bağını atla, karşılıksızı ters çevirme, şüpheliyi boş ver, iki bağ anı kayması, kilit hep açık, mahsup etiketi, Vade, söz tarihi, kart takvimi, toplu yolda çek bağı, tek yolda Kapatılacak Fatura, toplu yolda mahsup: hakem ya da iki ayrı yolun karşılaştırması yakaladı.
  - M7 (kilit belleği anahtarsız): ilk koşuda kriterim dışında kaldı (13/14). Bir önbellek mutantı olduğu için yeni kurulan örnekle karşılaştırma onu değerle yakalıyor; kriteri yalnız bu mutant için genişlettim, ayrı commit'te. Yeniden koşu 14/14. `mut.log` ilk, `mut.out` ikinci koşu.
- **C — kâhinler (taban = yeni):**
  - Defter: 187 denetim, 0 fark.
  - Cari: 16.459 / 16.459, ayrıca 31 yapım aşaması kaydı.
  - Yapım aşaması listesi kendi kopyamda yeniden üretildi: FARKSIZ (yeni 0, kapanan 0, değeri değişen 0). Depodaki liste değişmedi.
- **D — komşular ve mutasyon:**
  - 188 test dosyası (değişen dosyayı adıyla ya da fatura API'sini anan; liste `c5a3a-ham/komsu-listesi.txt`): UTC 2.199/2.199, İstanbul 2.199/2.199, çıkış 0.
  - Mutabakat / Defter testleri (10 dosya): iki TZ 63/63.
  - Kaynak denetimleri (lisans yalıtımı, platform, yazım düzeni): 17/17.
  - `tyk-mutasyon-250`: taşınan yedi deseni (O1-API, O1C-a/b/d, D05, D06, KD5-c) modül yoluna aldım; desen metinleri aynı, desen sayımı 120/120 tek eşleşme. API tabanı 24/24 ve yedisi de ÖLDÜ.
- **E — hız: ÖLÇÜLEMEDİ.** Ölçüm kilidi iki denemede de doluydu (01:02 ve 01:07; `flock -x -n` çıkış 1) ve yük ~2 idi. Betik hazır: `…/c5a3a-t1/betik/hiz.sh` (taban → yeni → taban → yeni, 5 tekrar, değişen yollar).
- **F — ekran senaryoları: hepsi yeşil.** tyk-tur2a-250 51, cari-243 70, cari-vade-245 45, fatura-243 61, kayit-tahsilat-244 47, tahsile-ver-220 140, supheli-230 67, ux18-244 27, kart-iade-gecmis-250 8, duzeltme-kilidi-250 79, senaryo-219 74.
- **Dondurma zorlaması (B7):**
  - 'bitir' kipinde ön koşul gerçekleşmedi (test boş veriyle açılıyor, açılışta bekleyen dondurma yok); test yeşil.
  - 'gozlem' kipinde 240 sn'de asıldı. Aynı asılma, kilidi test ortasında koyan mevcut `tyk-tur2a-250 O-1` testinde de üretildi; zorlama düzeneğinin davranışı, bu teste özgü değil.

## Tur 3b için
- **Kurulum:** defter yükleyicileri ve işçiler `createObligationInput({ store })` kurar.
  - Tek cari: `buildObligations(withExtras(accountSettleInput(id, satırlar, gün), obligationExtras(id), id))`.
  - Toplu: `settleTables()` + `batchSettleInput` + `obligationExtras()`.
  - Carinin satırları yukarıdaki karara bağlı.
- **Döngü (§18.2 madde 3):** öneri, `obligationExtras`'ın şüpheli kalanlarını dışarıdan alabilen bir parametre kazanması (varsayılanı bugünkü `doubtfulRecordsOf`). `lib/bank/doubtful.mjs` modülü yalnız işlev içinde kullanır; üst düzeyde değer okumayan ESM döngüsü çalışır ama ayrıca sınanmalı.

## Kapsam dışı bulgular
- Dondurma zorlama betiğinin 'gozlem' kipi, kilidi test ortasında koyan testlerde asılıyor (yeniden üretildi). Ürün kusuru değil, düzenek kusuru.

## Doğrulanmadı / denenmedi / koşulmadı
- Hız (E) koşulmadı.
- `tyk-mutasyon-250`'nin geri kalan 113 deseni koşulmadı; hedefledikleri metin değişmedi.
- Tam `npm test` koşulmadı (görev gereği).
- Yedekten geri yükleme sonrası ve eşzamanlı istek ayrıca sınanmadı. Önbellek anahtarı ve kod aynı kaldığı için bunları komşu testleri kapsıyor.

## Windows'ta izlenecek
`test/obligation-input-250.test.mjs`: ayrı salt okunur bağlantı açıyor ve ikinci şirketin veri dosyasını okuyor (ders 48).

## Ana oturumun yeniden koşması için
- **Kalıcı test:** `TZ=UTC` ve `TZ=Europe/Istanbul` ile `node --test test/obligation-input-250.test.mjs` → beklenen 1/1.
- **Taban kırmızısı:** taban kopyasında aynı test dosyası + hakem → beklenen 0/1, ileti "lib/obligation-input.mjs yüklenemedi".
- **Mutasyon:** `node test/obligation-input-250-mutasyon.mjs --kopya <git archive HEAD kopyası>` → beklenen "SONUÇ: 14 geçti, 0 kaldı".
- **Taşınan desenler:** `node test/tyk-mutasyon-250.mjs --klasor <boş klasör> --yalniz O1-API,O1C-a,O1C-b,O1C-d,D05,D06,KD5-c` → beklenen 7/7.
- **Eşdeğerlik:** `bash …/c5a3a-t1/betik/esd.sh <ad> <veri kaynağı> [şimdi]` (taban kopyası `…/c5a3a-t1/taban` silindi; betikteki yol yeniden açılmalı) → beklenen "BAYT BAYT AYNI", temiz 100 bin için SHA-256 365a8f75….
- **Diğer:** kâhinler `npm run test:kahin-defter` (187 / 0 fark), `npm run test:kahin-cari` (16.459/16.459); komşu listesi `docs/kanit/2026-11-14/c5a3a-ham/komsu-listesi.txt` → 2.199/2.199.

## Commit listesi
- dec4b8b3 — §18.9 (koddan önce)
- 0ae3329f — taşıma + tyk-mutasyon desen yolları
- 23d657dc — kalıcı test + hakem + mutasyon betiği
- 5d881cbf — M7 kriteri
- 133c9056 — §18.10 sonuçlar
- dc32f620 — Kanıt
- bac4b267 — Kanıt: Mutabakat

## Not defteri
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a3a-t1`: betik/, esd/ (özetler, sha256; büyük dökümler silindi), kahin/, kanit/, hakem-taban-*.json, *.log / *.out. Taban, mut ve v249 kopyaları silindi; /dev/shm'de kopya kalmadı.
- Kâhin defter koşuları ham çıktılarını kendi seçtikleri `/tmp/kahin-defter-SE9Jfk` ve `/tmp/kahin-defter-WVBJBw` klasörlerine yazdı; silmedim (joker silme yok).

Kanıt dosyaları `docs/kanit/2026-11-14/c5a3a-*`, tasarım notu `docs/erp/C5-ACILIS-TASARIM.md` §18.9–§18.10.
