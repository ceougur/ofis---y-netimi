## Ç5-A TUR 2e — RAPOR (dal `worktree-agent-a43a9593927943672`, taban `c5a2e-taban` 4967d07d, uç 866c2ab6; PUSH YOK)

Ortam (sonda): yük 1,70 / 4 çekirdek, boş bellek 13 GB, boş disk 9,6 GB.

### DEĞİŞEN GÖZLENEBİLİR DAVRANIŞLAR (önce → sonra)

1. **Kural Farkı ön izlemesi ve kaydı** (`GET/POST /api/admin/ledger/rule-diff-correction`)
   - Dar kontrolün örneği (v2.4.9 verisi). Fiş 2026-000001 (B 500 / A 602 700) yazılmış; bugün 10.01.2027, kilit 31.12.2026.
   - Önce: ön izleme açıktı ve 01.01.2027 tarihli B 602 700 / A 671 700 öneriyordu; POST 200 dönüyordu.
   - Sonra: ön izleme kapalı (`rule-diff-nothing`, "Fişle düzeltilebilen fark kalmadı."); POST 409. 2027 mizanı 602 = 0, 671 = 0.
2. **Aynı yıl düzeltilmiş fark + düzeltilmemiş 2026 farkı** (R2 300 TL reddedildi, kilit 31.12.2026)
   - Önce: B 519 300 / B 602 700 / A 671 1.000.
   - Sonra: B 519 300 / A 671 300.
3. **Fazla düzeltme yıl sonundan sonra** (kilit kaldırılıp yeniden konunca)
   - Tutar aynı: 700.
   - Önerilen satırlar değişti: B 602 700 / A 500 700 → B 681 700 / A 500 700.
   - Gerekçe: EK-1 M7 + S174'ün "fiş kendi yılında" kuralından türettim; aşağıda ayrıca değerlendirmeye sundum.
4. **Mutabakat Testi / Yönetim satırı:** eşleme yılı "son etkin fişin yılı" iken artık tek tanımdan geliyor. Tutar alanlarında gözlenen bir değişiklik yok (E6 eşdeğer). Fiş yokken çıktı bayt bayt aynı.
5. **Yetki** (`POST /api/workspace/opening-review/:id` ve toplu `POST /api/workspace/opening-review`)
   - Avukat / Muhasebe kilitli satırda (kilit günü dahil) tek karar ya da geri alma: 200 → 403 `opening-review-locked`.
   - Toplu kararda seçimde tek bir kilitli satır varsa işlem bütün olarak 403 alır, hiçbir karar yazılmaz. İleti yöneticiye kalan kayıtları sayar, örneğin "…Yöneticiye kalan kayıtlar: 02.10.2026 Yetki Müşteri 700,00 TL; 05.10.2026 …".
   - Yönetici, açık dönem satırları ve GET uçları değişmedi.
6. **Ekran (Açılış Olabilir Kayıtlar):** sayfadaki kayıtlar toplu kararla bitince liste artık boş kalmıyor; kalan kayıtlar görünüyor ve sayfa çubuğu doğru çiziliyor.
7. **İpucu metni:** "Yönetim › Kural Farkı Düzeltme'den" → "Yönetim › Sistem › Kural Farkı Düzeltme'den".

### Bulgular: tabanda yeniden üretim ve değişen yol

**ORTA-1**
- Tabanda yeniden üretildi (p1-yil.mjs, çıkış 0; çıktı `c5a2e-ozet/taban-p1-ist.out`): `[2]` adımında ön izleme açık, B 602 700 / A 671 700.
- Yıl kuralının TEK tanımı: `server/lib/ledger-opening.mjs:303` `ruleDiffCorrectionYear` (kilit + 1'in yılı; kilit yoksa donmuş dönem, o da yoksa bugün).
- Bu tanımı okuyan yerler:
  - `server/routes/ledger.mjs:611` (`correctionView`; GET ve POST ön izleme / kayıt)
  - `server/lib/ledger-snapshots.mjs:1128` (`checks()`): Mutabakat Testi, Defter Mutabakatı (integrity.mjs:561 üzerinden), açılış ve arka plan taraması, Yönetim satırı
- Fişin kendi yılıyla düşülmesi:
  - `postedRuleDiffCorrections().byYear` (:416): ters kayıt asıl fişin yılına sayılır.
  - `ruleDiffCorrectionPlan({ postedByYear })` (:362–385).
- Tek yıl fişinde sonuç eskisiyle aynı (`expected − posted`; y4 testi bunu sınıyor).

**DÜŞÜK-4:** `server/routes/opening-review.mjs:26, 39, 91, 107` (`assertLockedAllowed`, yetki `system.manage`).

**DÜŞÜK-1:** `client/assets/hof-acilis-olabilir.js:40, 60–68`. Tabanda yeniden üretildi: satır 0, "Onay bekleyen kayıt yok".

**DÜŞÜK-3:** `server/lib/ledger-snapshots.mjs:1146`.

### Yeni ve genişleyen testler: tabanda kırmızı, yeni kodda yeşil (iki TZ)

| Test | Taban | Yeni kod |
|---|---|---|
| `test/kural-farki-yil-250.test.mjs` | 1/7 (6 kırmızı) | 7/7 |
| `test/acilis-olabilir-yetki-250.test.mjs` | 0/3 | 3/3 |
| `senaryo-acilis-olabilir-250` (250 aday vakası) | 43/45 | 45/45 |
| `kural-farki-duzeltme-250` [5] (DÜŞÜK-3 metni) | kırmızı | yeşil |

Kırmızıların nedenleri iletide okundu:
- **kural-farki-yil y7:** gerçekleşen B 519 300 / B 602 700 / A 671 1.000; beklenen B 519 300 / A 671 300.
- **kural-farki-yil y1:** eski kodda yeni işlev olmadığı için düşüyor.
- **kural-farki-yil y6:** tabanda da yeşil (N1 vakası, ürün zaten doğru).
- **yetki testi:** 200 dönüyor, 403 bekleniyor.
- **ekran senaryosu:** satır 0.
- **kural-farki-duzeltme [5]:** eski ipucu metni.

DÜŞÜK-2'nin testleri tabanda yeşil, çünkü ürün doğru; dişlerini mutantlarla gösterdim:
- `kural-farki-duzeltme-250` [8] (N4) ve `s160-kilitli-tahsilat-bagi-250` yeni describe (N12): tabanda 8/8, iki TZ.

Yeni iki test B7 zorlamasının `bitir` ve `gozlem` kiplerinde yeşil; ön koşul gerçekleşti.

### Mutant tablosu (`c5a2e-ozet/mutant.out`)

Dar kontrolün mutantları (hepsi değerle öldü):

| Mutant | Önce | Sonra: hangi test, hangi değerle |
|---|---|---|
| N1 | yaşıyor | y6 — "iki madde de dışarıda" |
| N3 | yaşıyor | y7 — "ters kaydedilmiş fiş listede yok" |
| N4 | yaşıyor | kfd [8] — "dışarıda kalan alt defter farkı varken Düzeltildi yok" |
| N9 | yaşıyor | y7 — zil `lockedCandidate` 2 |
| N10 | yaşıyor | y7 — "onay bekleyen 2 kayıt" |
| N11 | yaşıyor | y7 — "fişin yılı 2026: aynı hesap (602)" |
| N12 | yaşıyor | s160 — 409 ≠ 200 |

Tur 2e'nin kendi mutantları:

| Mutant | Sonuç |
|---|---|
| E1 (eşleme yılı = kilit + 1 yazılmış fişe de uygulanır; taban davranışı) | öldü: y2, y3, y5, y7 |
| E2 (kilit gününün yılı) | öldü: y1, y7 |
| E3 (ters kayıt kendi yılına sayılır) | öldü: y7 7. adım |
| E4 (önceki yılın fişinin 671 / 681 satırı ham farka sayılır) | ilk koşuda yaşadı; iki yıl sonu vakası eklendi, y3 ile öldü |
| E5 (kalan hep 671'e) | öldü |
| E6 (Yönetim satırının yılı = son etkin fişin yılı) | yaşıyor — EŞDEĞER (öğe yalnız tutar taşır, eşleme tutarı değiştirmez) |
| E7–E10 (yetki) | öldü |

### Kabul koşulları

**A — defter kâhini:** 187/187, iki TZ; taban ve yeni aynı.

**B — cari kâhini:** 17.136/17.136; taban ve yeni aynı. Liste `KAHIN_YAPIM_ASAMASI` ile kendi kopyamda yeniden üretildi: depodaki listeyle bayt bayt aynı, 0 kayıt.

**C — eşdeğerlik** (fiş yok, aday kararı yok; taban ↔ yeni):
- Üç fikstür (s127, 2.0.26-zincir, s127-kilitsiz) × iki TZ: BİREBİR.
- Temiz 100 bin satır (153.803 madde), kilitsiz ve 30.06.2026 kilitli: BİREBİR.
- Karşılaştırılan çıktılar: Mutabakat Testi, Defter Mutabakatı, Yevmiye, Hesap Planı Mizanı, Alt Hesap Mizanı, defter, aday listesi, bütün maddeler.

**D — kalıcı testler ve ekran senaryoları:**
- Komşu taraması dahil 39 dosya: 720/720, iki TZ.
- Ekran senaryoları iki TZ'de yeşil: senaryo-acilis-duzeni-250 27/27, senaryo-acilis-olabilir-250 45/45, senaryo-acilis-eslestirme-250 29/29.
- Beklentisi değişen mevcut test yok; yalnız yeni assert ekledim:
  - kfd [5]: ipucu metni tam (eskiden yalnız "artık fazla" aranıyordu).
  - kfd [8]: N4 assert'leri.
  - s160: yeni describe.
  - senaryo-acilis-olabilir: sona yeni bölüm.

**E — hız:** ölçüm kilidiyle, yük 1,0–1,7, temiz 100 bin satır, iki tur, taban ↔ yeni. Kötüleşen yol yok.
- Kilitli (31.12.2026; yazılmış fiş eşleme yılından önce):

  | Yol | Taban en iyi | Yeni en iyi | Taban ortanca | Yeni ortanca |
  |---|---|---|---|---|
  | Kural Farkı ön izleme | 3.734 ms | 3.819 ms | 3.769 / 4.153 | 3.942 / 4.074 |
  | Mutabakat Testi | 7.955 | 8.012 | 8.129 / 8.198 | 8.515 / 8.184 |
  | Defter Mutabakatı | 10.330 | 10.306 | 10.469 / 10.529 | 10.925 / 10.348 |

  En kötü fark +%4,7.
- Kilitsiz: yeni ≤ taban.
- 5.000 aday:
  - Toplu karar (1.000 kayıt): 359–423 ms ↔ taban 363–440 ms.
  - Tek karar en iyi: 6 ↔ 7 ms.
  - Liste ve zil aynı.

### Ana oturumun yeniden koşacağı komutlar ve beklenen sayılar

- `TZ=UTC|Europe/Istanbul HUKUK_LICENSE_URL=http://127.0.0.1:9 node --test` şu dosyalarla:
  - `test/kural-farki-yil-250.test.mjs` → 7/7
  - `test/acilis-olabilir-yetki-250.test.mjs` → 3/3
  - `test/kural-farki-duzeltme-250.test.mjs` → 8/8
  - `test/s160-kilitli-tahsilat-bagi-250.test.mjs` → 8/8
- Taban kırmızısı: `git worktree add --detach … c5a2e-taban` kopyasına yeni testler kopyalanır → 1/7 ve 0/3. Taban kırmızısı için ders 54'e uygun `git worktree` kopyası şart, çünkü testler v2.4.9 etiketi istiyor.
- `PLAYWRIGHT_BROWSERS_PATH=… node test/e2e/senaryo-acilis-olabilir-250.mjs` → 45/45.
- Kâhinler: defter 187/187, cari 17.136/17.136.

### Ana oturumun ekran yürüyüşü için adımlar

1. **Yıl sonunda pencerenin pasifleşmesi:** v2.4.9'da 02.10 "Açılış bakiyesi" 700, kilit 05.10 → güncel kodda bugün 05.01.2027.
   - Açılış Olabilir'de reddet → Kural Farkı penceresi B 500 / A 602 700 (06.10.2026) → Fişi Kaydet.
   - Dönem Kilidi'ni 31.12.2026'ya al → Kural Farkı penceresi pasif, neden "Fişle düzeltilebilen fark kalmadı."; Mutabakat satırı "Düzeltildi (Fiş 2026-000001)".
2. **250 aday:** Sonraki Sayfa → sayfadaki kutuları seç → Seçilenleri Onayla → kalan 200 kayıt görünür, sayfa çubuğu yok.
3. **Muhasebe rolü:** kilitli adaya API'den karar → 403 ve ileti.

### Commit'ler

| Commit | İçerik |
|---|---|
| 1c84063a | ORTA-1 |
| 1b984469 | DÜŞÜK-4 |
| b8825618 | DÜŞÜK-1 |
| 3b4ab952 | DÜŞÜK-2 |
| 7c05fad4 | DÜŞÜK-3 |
| 94a1d0c5 | tasarım notu §17.14 (§17.13 ORTA-1 commit'inde) |
| 866c2ab6 | Kanıt: `docs/kanit/2026-11-14/c5a2e-*` ve `c5a2e-ozet/` |

### BAŞ MİMAR KARARI GEREKİYOR

**Fazla düzeltmenin yıl sonundan sonraki hesabı** (değişen davranış 3)
- Tek yıl kuralının doğal sonucu: B 681 700 / A 500 700. Eskiden B 602 / A 500 öneriyordu.
- Tutar ve uyarı aynı; ipucu yine "fişi ters kaydedin" diyor.
- Öneri: M7'yle tutarlı olduğu için kalsın.

### KULLANICIYA SORULMALI (kodlanmadı; bugünkü davranış kaldı, testle sabitlendi — y7 7. adım)

**Soru:** 2026'nın düzeltme fişi 2027'de TERS kaydedilirse fark hangi yılın sayılsın?

**Sayılar:** ters kayıt 2027'nin defterine B 602 700 yazar. 2026'da 602 alacak 700 fazla kalır (donmuş dönem güncel kuralla + fiş), 2027'de 602 borç 700 olur. Program bugün "kural farkı yok" diyor; fiş ile tersi birbirini götürüyor.

**Seçenekler:**
- **A (öneri, bugünkü):** ters kayıt asıl fişin yılına sayılır; uyarı yok. Geri alınabilir.
- **B:** ters kayıt kendi yılına sayılır; program 2027'de B 681 700 / A 602 700 sınıflama fişi önerir. E3 mutantının davranışı.
- **C:** uç durum böyle kalsın (BİLİNEN SINIR).

**Yaygın programlarda:** doğrulanmış dayanak yok.

### KAPSAM DIŞI BULGULAR

- `client/assets/admin.js:1158`: Yönetim satırının uyarı cümlesi de "Yönetim › Kural Farkı Düzeltme" diyor (yazım düzeni / yer eksik). Dosya sınırı dışında; senaryo-acilis-duzeni-250:103 bu metni bekliyor.

### DOĞRULANMADI

- E6 mutantı yalnız mantıkla EŞDEĞER sayıldı.
- y6 (N1) saf işleve elle kurulmuş girdiyle yazıldı; zincirleme dışlamayı programın kendi yolundan üretemedim.

### DENENMEYEN

- Windows.
- İki kişinin aynı anda kilitli adaya kararı.
- Silinenler'den dönen aday.
- Yedekten geri yükleme ile yıl kuralı.
- Tam `npm test` (ana oturumun işi).

### ÖLÇÜLEMEDİ

- Kural Farkı kaydı (POST) süresi. 2. denemede istek kimliği kısa olduğu için 400 döndü; 3. denemede ölçüm kilidi doluydu. Yolu ön izlemeyle aynı plan + bir fiş yazımı.
- Kilit denemelerinin kaydı `c5a2e-ozet/hiz-denemeler.txt` içinde.

### Bıraktığım not defteri klasörü

`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a2e-k3` (4 MB). Büyük kopyalar ve iki `git worktree` silindi; betikler ve çıktılar duruyor. Çalışma ağacımda yalnız izlenmeyen `node_modules` bağı ve git'in yok saydığı `test/e2e/artifacts` var.
