# Ç5-A tur 2b — ajan ARA raporu (AYNEN; ajan a5b6e29fe068192ef; ajan raporu kanıt değildir — ana oturum yeniden koşar; dar kontrole VERİLMEZ)

# Ç5-A TUR 2b — ARA RAPOR

Dal `worktree-agent-a5b6e29fe068192ef`. Taban `c5a2b-taban` (c3dc4a36). PUSH YOK. Ağaçta yalnız `?? node_modules` bağı var.
Ortam (sonda, 20:00 UTC): yük 0,48 / 4 çekirdek, boş bellek 13 GB, boş disk 8,1 GB.

**Durum:**
- **İş 4: DURDU.** Kodlanmadı. Nedeni aşağıda. Baş mimar kararı ve kullanıcı sorusu gerekiyor.
- **İş 2: BİTTİ.** Kodu, testleri, mutantları, komşuları, ekran senaryosu, kâhinleri ve kanıtı commit'li.
- **Kalan işler (yeni temiz ajana, ders 46):** İş 3, İş 1, İş 8, DÜŞÜK-2, İş 5 ek testleri.
  - Gerekçe: İş 3, İş 2 büyüklüğünde. Yarım iş bırakmamak ve sırayı bozmamak için durdum.
- **YARIM iş yok.**

## BU TURUN DEĞİŞTİRDİĞİ GÖZLENEBİLİR DAVRANIŞ (önce → sonra)

Dayanak: §3.3, KG-15 A, EK-1 M7, B14 (a), B16, S76 = A, S164 = C, D 12.11 15:57 (4).

**1. Yönetim › Sistem › Dönem Kilidi ve Mutabakat kartına "Kural Farkı Düzeltme" düğmesi eklendi** (önce yoktu).
- Açılan pencerede şunlar var:
  - Fiş Satırları
  - Fişle Düzeltilmeyen Fark (alt defter hesabı, nedeniyle)
  - Farkı Doğuran Kayıtlar (tarih, kaynak, açıklama, hesap farkı)
  - Yazılmış Düzeltme Fişleri (her birinde Ters Kaydet)
  - Onay kutusu ve "Fişi Kaydet"
- Pasif düğmenin nedeni görünür yazıyla çıkıyor:
  - kilit yok
  - kilit bugün: "Kilit bugünün tarihinde; düzeltme fişi yarın yazılabilir."
  - kilitli dönemde onay bekleyen Açılış Olabilir kaydı var (B16)
  - fark kalmadı
- Uçlar: `GET` / `POST /api/admin/ledger/rule-diff-correction` (`system.manage`; Muhasebe 403).

**2. Fiş kuralı ve örnek maddeler.** Fiş türü `rule-diff-correction`, sınıfı olağan, tarihi kilit + 1.
- 1–5 sınıfı hesaplar birikimli farkla, 6 / 7 sınıfı yıl yıl yazılır. Önceki yılın borç yönlü farkı 681'e, alacak yönlü farkı 671'e gider.
- v2.4.9 verisi (kilit 31.12.2025), fiş 01.01.2026: B 500 11.900 / B 681 10.400 / A 519 22.300.
- v2.0.26 verisi (kilit 05.10.2026, aynı yıl), fiş 06.10.2026: B 500 127.800 / A 519 127.800.

**3. Mutabakat Testi kilitli eski veride.**
- Önce: "Kural Değişikliği Farkı" uyarısıyla dönüyordu.
- Fişten sonra: uyarısız (`ok: true`). Öğe "… — Düzeltildi (Fiş 2026-000001)" adıyla bilgi olarak listede kalıyor.
- Yönetim satırında yeni cümle: "Bilgi: Kural Değişikliği Farkı (Kilitli Dönem: …) — Düzeltildi (Fiş …); kilitli dönemin farkı ilk açık güne alındı."
- Fiş ters kaydedilince uyarı geri geliyor.
- Defter Mutabakatı raporunda öğe "… — Düzeltildi (Fiş …)" adıyla "Tutarlı" görünüyor.

**4. Fazla düzeltme uyarısı (yeni).** Fişten sonra kilit kaldırılır ya da yeniden kilitlenirse:
- kilit olmasa da bir uyarı çıkıyor: "… Kural Farkı Düzeltme Fişi (…) artık fazla — … ters kaydedin."

**5. Değişmeyenler** (sayıyla): Mutabakat Günlüğü, zil ve tarama.
- Fiş, ters kayıt ve ikinci fiş Mutabakat Günlüğü'ne +0 satır yazdı, zil 0.
- Düzeltme fişi olmayan veride çıktı aynı (yeni alan yok).

## İş 4 — DURDU (§17.8)

**Bugünkü kodda yeniden üretim** (`docs/kanit/2026-11-13/c5a2b-is4-uret.json`):
- Veri: F1 1.000 (−60 gün), şüpheliye alma 1.000 (−40), F2 500 (−30, kayıttan sonra).
- F1'e bağlı nakit 400: defterde `A 120 400`. S25 (c) `128` bekler.
- Bağsız nakit 100: `A 128 100`. Değişmez, doğru.
- F2'ye bağlı çek 300: `A 128 300`. S14 "sonradan kesilmiş 120" der.
- Kuyruğun dışa verdiği dağılım son durumda `F1 500 + F2 100`. F2 kayıttan sonra kesildiği hâlde M13'ün ikinci geçişiyle kuyrukta.

**Durma nedenleri:**
1. **Eksik alan.** Kural tahsilat anındaki dağılımı ve o kalemi taşıyan kaydı istiyor. `buildObligations().doubtful` yalnız son durumu veriyor, kalem başına toplam olarak, kayıt kimliği olmadan.
2. **Döngü.** Kuyruğun `doubtfulRecords` kalanları defterin ikinci yükleyicisinden (`doubtfulState`) geliyor. Kural defteri kuyruğa bağlayınca ikisi birbirine bağlanıyor. Ancak zamana göre ilerleyen bir kuyruk çağrısıyla çözülebilir.
3. **İki okuma.** M13'ün ikinci geçişi ile S14 metni ayrışıyor (aşağıda soru).
4. **Sınır dosya sınırı dışında.** SUPHELI_NORMAL_ASIM sınırının yalnız 120'ye kalan kısma uygulanması (kâhin Y4 / Z6) `routes/accounts.mjs` `assertNormalRoom` içinde (`doubtfulSkipOf` üzerinden). Bu dosyaya yazma yasak.

## İş 2 — ayrıntı

### Değişen yol
- `server/lib/ledger-opening.mjs:254–` (dosyanın sonu): `nextDayOf`, `PRIOR_YEAR_ACCOUNTS`, `ruleDiffCorrectionPlan`, `postedRuleDiffCorrections`.
- `server/lib/ledger-snapshots.mjs`:
  - :975 `ruleDiff({ detail })`: isteğe bağlı madde başına fark. Varsayılan çıktı aynı.
  - :1105– `checks()`: düzeltme durumu, `corrected` / `correction`.
  - :226 `createLedgerSnapshots({ subledger })`.
- `server/routes/ledger.mjs`: :632 / :636 iki uç; `subledger: () => subledgerAccounts()`.
- İstemci: `client/assets/hof-kural-farki.js` (yeni), `client/admin.html` (düğme + betik etiketi), `client/assets/admin.js` (`loadIntegrity` cümlesi + `hof:rule-diff-changed` yenilemesi).

### Okuyucular (ders 10; tarama `ruleDiff|rule-diff`)

| Okuyucu | Etkisi |
|---|---|
| integrity.mjs run (Mutabakat Testi, açılış ve arka plan taraması; işçi iş parçacıkları da `registerLedgerRoutes` üzerinden `subledger` alıyor) | Düzeltme durumu öğeye işleniyor |
| report-center Defter Mutabakatı | Öğe adı + "Tutarlı" |
| admin.js | Düzeltildi / fazla düzeltme cümlesi |
| muhasebe sürücüsü | Salt okur |
| Testler (32 dosya) | Komşu listesinde |

### Yeni test `test/kural-farki-duzeltme-250.test.mjs`
- Sonuç: 7/7, hem UTC hem Europe/Istanbul.
- Tabanda 7/7 kırmızı. Neden: uç yok (404, ön izleme alanları tanımsız).
- Vakalar:
  - [1] v2.4.9 verisi. Beklenen sayılar fikstürün v2.4.9 mizanından ve ham tablolardan (2025'in 602'si = yüklenen kartların T'si). Programın kodundan türetilmedi.
  - [2] v2.0.26 verisi: aynı yıl, Muhasebe 403, iki kişi aynı anda (tek fiş).
  - [3] kilit bugün.
  - [4] B16 sıra zorlaması + fişten sonra kararı değişen satır (kalan fark ve ikinci fiş; önceki yılın farkı 681).
  - [5] fazla düzeltme.
  - [6] kilitsiz veri.
  - [7] S164 = C kapı dışı yazım.
- Değişmez her fişten sonra sınandı: 1–5 sınıfı karma bakiyeler = yeni kuralla baştan türetilmiş defter.

### Mutantlar (`test/kural-farki-duzeltme-250-mutasyon.mjs`): 10/10 değerle yakalandı
1. Yıl yıl eşleme yok
2. 671 ↔ 681 ters
3. Alt defter hesabı fişe giriyor
4. "Düzeltildi" fiş toplamına bakmadan veriliyor
5. Sıra zorlaması (B16) kaldırılmış
6. Kilit bugünken düğme etkin
7. İmza denetlenmiyor
8. Fazla düzeltme görünmüyor
9. Fark işareti ters
10. Fiş tarihi kilit + 1 yerine kilit günü

### ÖZEL DİKKAT — S127 (`c5a2b-is2-s127-cift-duzeltme.json`)
- v2.4.9 verisinde eski kurala bağlı dört kart var. Kilitli dönemde olan ikisi kural farkında `602 +6.000 / 519 −6.000` ve `602 +2.400 / 519 −2.400` olarak görünüyor.
- Fiş bunları bir kez düzeltiyor.
- Fişten sonra karma ve baştan türetme 1–5 sınıfında eşit: 100 10.800, 120 15.500, 519 −26.300, 500 0. **Çift düzeltme yok.**

### S164 = C (bu turda yalnız bir örnek denendi)
- Kilitli bir Borç Yaz satırının tutarı kapı dışından +100 değiştirildi:
  - ön izlemenin fiş satırları değişmedi,
  - kayıt kaynak listesinde "fişle düzeltilmez" diye görünüyor,
  - 120 +10.000 kuruş farkı nedeniyle dışarıda,
  - kaydet 409 `ledger-integrity` (kapı kilit izini görüyor), fiş yazılmadı.
- İkinci örnek (fatura bağının kapı dışı değişmesi) DENENMEDİ.

### Kural farkı fişi yazılınca / ters kaydedilince
- Tarama: `ledger:rule-diff` sapma kümesinde değil.
- Mutabakat Günlüğü +0, zil 0.

## KABUL KOŞULLARI

**A. Defter kâhini:** 187/187 (0 fark, 0 atlanan, 0 reddedilen), yeni ve taban, iki TZ.

**B. Cari kâhini:**
- Taban = yeni = 16.449/16.449.
- Yapım aşaması listesi kendi kopyamda yeniden üretildi: 41 → 41 (yeni 0, kapanan 0, değişen 0). Tabanınki ile birebir.
- 'Ç5-A' paketinde kayıt yok. Başka paketin kaydı değişmedi.

**C. Muhasebe sürücüsü:**
- Taban ve yeni aynı: 8.456 test, 862 fark, 44 atlanan.
- `gerileme.py` 226/226: program çıktısı birebir.
- `siniflama.json`'da bu turun kuralına ait Ç5 kaydı yok; kalkan / yeni fark yok.

**D. v2.4.9 verisi:** güncelle → ön izleme → fiş → değişmez → Düzeltildi → ters kayıt → uyarı geri; sayılar yukarıda.
- Sınıf listesinin kapsadıkları (ilk iki satır kilitli verilerin kural farkında görünen türleri):
  - v2.4.9 verisinde (kilitli): Kasa açılışı, cari açılışı, Excel kartı (S127 dahil), "Excel'de ödenmiş" satırları.
  - v2.0.26 verisinde (kilitli): 44 madde.
  - kilitsiz v2.4.9 verisi.
  - KG-16 adayının onay / ret durumu.
- Kapsamadıkları (DENENMEDİ):
  - şüpheli kaydı olan cari × kilitli v2.4.9 verisi,
  - banka / stok / açılış evrakı açılışının ayrı ayrı sınıfı (bu verilerin kural farkı listelerinde ayrıca görünmüyor).

**E. Hız: ÖLÇÜLEMEDİ.**
- Ölçüm kilidi (`flock -x -w 2400`, tek seferlik bekleme) 19:20–20:00 arası alınamadı. Ana oturumun `b8a-e2e.sh` koşusu paylaşımlı kilidi tutuyordu.
- Düzenek hazır: `c5a2b-betik/olc.mjs`, `kos.sh`, `hepsi.sh` (taban ↔ yeni, kilitsiz + kilitli, iki TZ, 3 tur, ön izleme yolu eklendi).
- Değişen istekler:
  - Mutabakat Testi / Defter Mutabakatı / açılış taraması: `checks()`'e tek SQL eklendi; fiş yoksa yalnız `LIMIT 1` sorgusu.
  - Yeni ön izleme: bir `ruleDiff` + plan.
- **Ana oturum ölçmeli.**

**F. Değişmezler:**
- Σ borç = Σ alacak (fiş defteri `voucherProblems` + kapı).
- Cari / Kasa / KDV / stok değişmez: fiş alt defter hesabına yazamaz (K6 + plan dışlaması).
- 1–5 sınıfı karma = baştan, her fişten sonra testte.

**G. Ekran** (`test/e2e/senaryo-acilis-duzeni-250.mjs`'e İş 2 adımları eklendi):
- Sonuç: 27/27, Istanbul ve UTC.
- Tabanda kırmızı. Neden: `page.click #adm-rule-diff-open` zaman aşımı (düğme yok).
- Kapsananlar: gerçek tıklama, onay kutusuna Tab ile ulaşma + Boşluk ile işaretleme, insan hızı, pasif + neden, Ters Kaydet.
- Komşu senaryolar:

| Senaryo | Sonuç |
|---|---|
| senaryo-kasa-acilis-uyari-250 | 20/20 |
| senaryo-donem-kilidi-ilerleme-250 | 39/39 |
| senaryo-226 | 22/22 |
| senaryo-213 | 64/64 |
| senaryo-211 (yazım düzeni gezintisi) | 59/59 |
| yazim-duzeni testi | 6/6 |

- Ekran görüntülerine baktım: `c5a2b-is2-02 … 05-*.png`.
- Muhasebe 403 yalnız API'de denendi.

**Komşular (G2, taramayla):** 32 dosya, 337/337 × iki TZ (`c5a2b-komsu/`). platform-tasinabilirlik 6/6.

## Değişen mevcut beklentiler
- `senaryo-acilis-duzeni-250`: yalnız yeni adımlar eklendi; eski beklentiler aynen.
- admin.js'te düzeltme fişi yokken cümle bayt bayt aynı (tur 2a'nın beklentisi geçti).

## CI listesine eklenecek
- `test/e2e/senaryo-acilis-duzeni-250.mjs` (tur 2a'dan beri bekliyor; şimdi İş 2 adımlarıyla).
- `test/kural-farki-duzeltme-250.test.mjs` `*.test.mjs` deseninde.

## Windows'ta izlenecek (ders 48)
- `kural-farki-duzeltme-250`: fikstür açıp siliyor, kilit kaldırıp yeniden koyuyor.

## Ç6 / Ç7 / devir için hazır bıraktıklarım
- `ruleDiffCorrectionPlan` ve `postedRuleDiffCorrections`: D4 ve Ç6 aynı planı okuyabilir.
- `ledger:rule-diff` öğesinin `corrected` / `correction` alanları: Ç6'nın "Kesin Değil — Kural Değişikliği Farkı" nedeni `corrected` ile düşer.

## Ana oturumun yeniden koşacağı komutlar (beklenen)
- `node --test test/kural-farki-duzeltme-250.test.mjs` → 7/7 iki TZ. Tabanda 7/7 kırmızı (404).
- `node test/kural-farki-duzeltme-250-mutasyon.mjs --kopya <HEAD kopyası>` → 10/10.
- `node test/e2e/senaryo-acilis-duzeni-250.mjs` → 27/27. `DEPO=<taban kopyası>` ile kırmızı (düğme yok).
- `npm run test:kahin-defter` → 187/187.
- `npm run test:kahin-cari` → 16.449/16.449, liste 41.
- Hız: `hepsi.sh` düzeneği.

## Ekran yürüyüşü için adımlar
1. Kilitli eski veriyle başla (ör. surum-2.0.26-zincir ya da v2.4.9 kilitli veri).
2. Yönetim › Sistem: satırda "Uyarı … Kural Değişikliği Farkı".
3. Kural Farkı Düzeltme penceresini aç: satırlar ve Farkı Doğuran Kayıtlar listesi; Fişi Kaydet pasif, nedeni yazılı.
4. Onay kutusunu işaretle → Fişi Kaydet.
5. Satırda "Bilgi: … Düzeltildi (Fiş 2026-000001)".
6. Yevmiye / Hesap Planı Mizanı'nda fiş tarihinde 500 / 519 (önceki yıl verisinde 681).
7. Pencereyi yeniden aç: pasif, neden "Fişle düzeltilebilen fark kalmadı." → Ters Kaydet → uyarı geri.
8. Kilit bugüne alınınca: pasif, neden "Kilit bugünün tarihinde; düzeltme fişi yarın yazılabilir."
- Aday onayı (İş 3) ve eşleştirme fişi (İş 1) ekranları henüz yok.

## Commit'ler

| Commit | İçerik |
|---|---|
| 96acf193 | Tasarım notu §17.8 (koddan önce) |
| 03c0c609 | İş 2 sunucu + test + mutasyon dosyası |
| 891046cf | İş 2 ekran |
| cdd64cff | İş 2 ekran senaryosu |
| 0c5b6664 | Tasarım notu §17.9 (sonuçlar) |
| 3548840e | Kanıt: `docs/kanit/2026-11-13/c5a2b-*` |

## BAŞ MİMAR KARARI GEREKİYOR
1. **İş 4'ün yolu.**
   - Seçenek (a): kuyruğa iki dış alan eklenir:
     - belirli bir ana kadar (tahsilat öncesi) dağılım,
     - kalem başına kayıt kimliği.
     Defter tahsilat tahsilat ilerleyerek okur. Bu Ç5-B dosyasıdır; o turun birleşiminden sonra yapılmalı.
   - Seçenek (b): defter kuralı `doubtful-gl`'de kuyruğun sıra anahtarıyla kendi zamana bağlı dağılımını kurar. "Tek kuyruk" ilkesine aykırı; önermiyorum.
   - Öneri: (a). Ayrıca sınır (`routes/accounts.mjs assertNormalRoom`) aynı turda değişmeli.
2. **Fiş varken kilit kaldırma.** Bugün engellenmiyor; fazla düzeltme uyarısı + Ters Kaydet ile çözülüyor. Öneri: böyle kalsın (C3 §7 "Kilidi Aç → Yeniden Kilitle" yolu bozulmasın).
3. **671 / 681 eşlemesinin yılı.** Son etkin düzeltmenin yılı alınıyor. Kilit, düzeltmeden sonra yıl sonunu aşarsa kalan fark yeni yıla göre öneriliyor. Öneri: BİLİNEN SINIR.
4. **Dosya sınırı yorumları** (değerlendir):
   - `ledger-snapshots.mjs`'e "Düzeltildi" hesabı dışında `ruleDiff({ detail })` seçeneği ve `subledger` parametresi eklendi (varsayılan çıktı aynı).
   - `client/admin.html`'e düğme ve betik etiketi eklendi (yeni ekranın bağlanması).

## KULLANICIYA SORULMALI (İş 4; para / defter kuralı, ders 43)
**Durum:** Şüpheli kaydı açık caride, kayıttan SONRA kesilmiş bir faturaya bağlı tahsilat var. Arada "Normal Cari Hesaba İşle" ödemesi eski faturayı kuyrukta kapatmış.
- Kuyruk (M13, ikinci geçiş) yeni faturanın bir kısmını şüpheli kuyruğuna alıyor.
- S14 metni "sonradan kesilmiş fatura 120" diyor.

**Örnek** (karar metinlerinden hesap; kural kodlanmadığı için programda koşulmadı):
- F1 1.000; şüpheliye alma 1.000; F2 500 kayıttan sonra; Normal Cari Hesaba İşle 400; F2'ye bağlı çek 300.
- Okuma A (S14 metni, kâhin Y2): çek A 120 300. Sınır (yalnız 120 kısmı) bu çeki büyük olasılıkla reddeder: 120 odası 100.
- Okuma B (kuyruğun dağılımı): çek A 128 300; 128'in bakiyesi 700.

**Seçenekler:**
- A: S14 metni geçerli, kayıttan sonra kesilen fatura her zaman 120.
- B: Kuyruğun ikinci geçişi geçerli.
- C: Uç durum böyle kalsın (BİLİNEN SINIR).

**Öneri:** A (karar metniyle ve kâhinle aynı).

**Yaygın programlarda nasıl:** doğrulanmış kaynak yok, yazmıyorum.

## KAPSAM DIŞI BULGULAR
Yok.

## DOĞRULANMADI / DENENMEYEN / KOŞULMADI / ÖLÇÜLEMEDİ
- **DENENMEYEN:**
  - Şüpheli kaydı olan cari × kilitli v2.4.9 verisi sınıfı.
  - S164'ün ikinci örneği (fatura bağının kapı dışı değişmesi).
  - Yedekten geri yükleme ve Silinenler ile fiş.
  - İki şirket.
  - Ekranda (UI'da) iki kişi aynı anda; yalnız API'de denendi.
- **KOŞULMADI:** tam `npm test` (kural gereği), CI.
- **ÖLÇÜLEMEDİ:** hız (E).

## Not defteri klasörlerim
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2b-q4`: betikler, kanıt (ham), notlar. Taban ve mutasyon kopyaları silindi.
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2b-olcum`: ölçüm düzeneği; çıktı yok.
- Kâhin araçları kendi `/tmp/kahin-defter-*` ve `/tmp/kahin-cari-*` klasörlerini bıraktı (aracın kendisi). Joker silme yasak olduğu için dokunmadım.
