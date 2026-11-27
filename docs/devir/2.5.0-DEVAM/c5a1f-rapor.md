<!-- Ajan raporu AYNEN (13.11.2026; ajan sözü — kanıt değil; ana oturumun yeniden koşusu KAYIT'ta). DAR KONTROL AJANINA VERİLMEZ (prensip §3). -->
## Ç5-A tur 1f: rapor (dal `worktree-agent-af550e32f1aedd444`, uç **883c4e57**, gönderilmedi)

Kilitli dönemde kapı dışından değişen alanlar artık bulunuyor. İzlenen her alanda kapı dışı değişiklik `ledger:snapshot` + `period-lock` bulgusu, bir Mutabakat Günlüğü satırı ve bir zil üretiyor. Meşru yolların yanıt kodları tabanla aynı ve hepsi sessiz. **Yeni 409 alan istek yok.**

Birleşmeden önce senden iki karar gerekiyor:
- **Donma süresi:** temiz 100 bin satırda %10 eşiğini 0,7 puan aşıyor (aşağıda).
- **Cari satırının fatura bağı:** bilerek kodlanmadı (aşağıda).

Kapsayıcı 05:07'de yeniden başladı. O ana kadar biten koşuların çıktıları sağlamdı. Kesilen tek iş bir test incelemesiydi, yeniden koşuldu.

### Değişen ürün dosyaları
**`server/lib/integrity.mjs`**
- Kilit izine (LOCK_SQL) dokuz girdi eklendi, hepsi `since "2.5.0"`; LOCK_SQL_VERSION "2.5.0" kaldı.
  - SINIF 1: `cash_transfer_lock`, `account_source_lock` (kaynak + kaynak kimliği + şüpheli işareti tek taramada), `plan_entries_bond_lock`, `stock_reason_lock`, `invoices_gl_lock` (kırılım + tevkifat + stopaj), `cheque_collections_event_lock`, `plans_unregistered_lock` (Kayıt Tarihi boş kart).
  - SINIF 2'nin yanlış alarm vermeyen alt kümesi:
    - `cheques_bounce_lock`: yalnız kilitli dönemde karşılıksız olayı olan evrak; durumu, türetmenin seçtiği karşılıksız günü ve carinin borç satırı var mı.
    - `cheques_free_lock`: kilitli dönemin "cariye işlenmemiş" evrak kümesi.
- Hız için kilit izine önbellek eklendi. Anahtar: total_changes + data_version + schema_version. Açık işlemde kullanılmıyor.
  - Neden: Mutabakat Testi aynı izi iki kez hesaplıyordu ve ilk ölçümde +%12,8 çıktı.

**`server/lib/integrity-scope.mjs`**
- LOCK_FIELDS yeni alanları biliyor; tahsil kaydının verilme bloğuna `event_id` eklendi.
- Kayıt Tarihi boş kart için denetim eklendi.
- Evrak olguları için `chequeLockRelevant` eklendi. Kilitli evrağın bugünkü tahsili ya da cirosu tam kapıya düşmüyor.

**Test değişiklikleri**
- `test/goc-243-stok-acilis.test.mjs`: göç öncesi iz sürümsüz alınıyordu; şimdi iki taraf da 2.4.2 tanımıyla karşılaştırılıyor. Zorunlu değişiklik (K11 deseni).
- Yeni: `test/kilit-izi-alanlar-250.test.mjs`, `test/defter-kaynak-iz-250.test.mjs`.

### Alan tablosu (§16.2; önce → sonra = satır içi tarama: bulgu / günlük / zil)
| Alan | Sınıf | Kilitli türetme değişir mi (fark satırı) | Meşru yazım | Önce | Sonra |
|---|---|---|---|---|---|
| transfer bağı | 1 | evet (2) | yok | başka denetim görüyordu | + snapshot/period-lock |
| cari kaynağı | 1 | evet (2) | yok | 0/0/0 | bulunuyor |
| kaynak kimliği | 1 | evet / koşullu | yok | başka denetim görüyordu | + snapshot/period-lock |
| şüpheli işareti | 1 | evet (2) | yok | 0/0/0 | bulunuyor |
| taksitin evrak bağı | 1 | evet (2) | yok | money:event | + snapshot/period-lock |
| taksitin açılış alanı | 1 | evet (2) | yok | 0/0/0 | bulunuyor |
| stok nedeni (iki yol) | 1 | evet (2/2) | yok (kilitte 409) | 0/0/0 | bulunuyor |
| fatura kırılımı | 1 | evet (2) | yok | 0/0/0 | bulunuyor |
| tevkifat / stopaj | 1 | evet (2) | yok | başka denetim görüyordu | + snapshot/period-lock |
| tahsil kaydının başlığı | 1 | evet (4) | yok | cheque:collections | + snapshot/period-lock |
| boş tarihli kartın oluşturma anı | 1 | koşullu | yok (API boş tarih yazmıyor; betik) | — | bulunuyor |
| ikinci karşılıksız olayı | 1 | koşullu (2) | yok | 0/0/0 | bulunuyor |
| evrak durumu (kilitli karşılıksız) | 2 → dar | evet (2) | yok (geri alma 409) | 0/0/0 | bulunuyor |
| evrağın carisi | 2 → olgu | carili → boş: 2 | cari seçimi 200, türetme farkı 0 | başka denetim görüyordu | + snapshot/period-lock |
| fatura bağı | 2 | koşullu (2) | **var ve kilitli defteri değiştiriyor** | 0/0/0 | 0/0/0 (kodlanmadı) |

Tabloda olup dokunulmayanlar:
- Olaysız karşılıksız durumu ve carisiz evrağa cari yazımı: türetme de değişmiyor, izlenmiyor.
- Banka alt hesabı: `bank:sub` denetimi zaten görüyor; kapıdan da değişmiyor (PUT 200 ama değer aynı kalıyor).

### Meşru yollar (taban → yeni, hepsi sessiz)
- **200 → 200:** bugünkü tahsil (carisiz), karşılıksız (cari seçilmeden / cari seçimiyle / carili), ciro, tahsile verilmiş evrağın tahsili, kart kapatma, Kayıt Tarihi boş isteği, kilit kaldırma / koyma, açık dönem fatura iptali, Silinenler'den transfer geri alma.
- **409 → 409:** kilitli karşılıksızı geri alma, kilitli evrağın carisini düzenleme, kilitli kartı silme, kilitli tahsilatın bağını düzenleme.
- Kalıcı testte ayrıca sessiz çıktı: yedek → geri yükleme, Şirket Verisini Sıfırla, v2.0.26 ve v2.4.9 gerçek kilitli verisiyle iki açılışlı güncelleme.

### BAŞ MİMAR KARARI GEREKİYOR
1. **Cari satırının fatura bağı (§16.4).** Betikle gösterildi:
   - 09.10 tarihli tahsilat 15.10 tarihli faturaya bağlanabiliyor.
   - Kilitten sonra fatura bugün iptal edilince kilitli 09.10 maddesi 120 → 128'e kayıyor ve hiçbir denetim görmüyor.
   - Seçenekler:
     - **A (öneri):** kilitli tahsilatın bağı değişecekse 409 + iz girdisi; bu yeni bir 409 olur.
     - **B:** kilitli satırın bağı iptalde kalsın; para kuralı değişir, **kullanıcıya sorulmalı** (K4).
     - **C:** uç durum böyle kalsın (BİLİNEN SINIR).
2. **Donma süresi +%10,7** (7.856 → 8.696 ms, ölçüm kilidiyle, geçerli). Kilit konunca arka planda bir kez çalışıyor; iz iş parçacığının kendi bağlantısında hesaplandığı için önbellek burada yardım etmiyor.
   - Seçenekler: BİLİNEN SINIR olarak kabul, ya da dokuz girdinin taramasını küçülten ayrı bir hız turu.
3. **N7 (DÜŞÜK-A) eşdeğer mutant:** süzgecin `plan_imports` dalına hiçbir yazım ulaşmıyor, çünkü `lib/db.mjs` SCOPE_TABLES bu tabloyu yakalamıyor.
   - Para tablosuyla aynı işlemde yazılırsa gateVerify'da "eşdeğerlik ihlali" çıkıyor; üretimde kabul ediliyor, tarama sonra `period-lock` olarak buluyor. Meşru yazan yol yok.
   - Seçenekler: SCOPE_TABLES'a ekleyip eşleme yazmak (Excel yükleme hızı riski) ya da ölü dalı kaldırmak.
4. **SINIF 3 BİLİNEN SINIR adayları:** POS alt hesabı (dış değişikliği gören denetim doğrulanmadı), sunucu saat dilimi (KG-5 yerel günü), aynı tarihli satır sırası (VACUUM INTO bu SQLite'ta rowid'i koruyor — betik, 133/133).

### Kalıcı kaynak tarama testi
- Yöntem:
  - Türetme (`build()`) koşulurken hazırlanan 30 sorgu yakalanıyor; okunan sütunlar EXPLAIN bayt kodundan çıkarılıyor (188 sütun).
  - Her sütunda kilitli satırın değeri bozuluyor ve kilit izinin değişip değişmediğine bakılıyor. Kaynak metni ayrıştırılmadığı için CRLF'ye duyarlı değil.
- Sonuç: 128 sütun izde. İstisnalar: 27 sütun (açıklama alanları, `opening_review`, `invoice_id`, banka / POS tanımı, `vat_offsets.created_at`), tetikleyiciyle korunan 4 tablo, 16 rowid.
- Sınırı: dizinden sıralı okunan sütun (`cheque_events.created_at`) EXPLAIN'de görünmüyor; o alanı davranış testi koruyor.
- Önbellek için eşdeğerlik testi de bu dosyada.

### DÜŞÜK-A'nın dört mutantı
- N3: kaynak tarama testi yakaladı.
- N17, N18: [8] testi yakaladı.
- N7: eşdeğer (yukarıda).

### Eski kod kırmızısı (`c5a1f-taban` ayrı kopyası)
- Kaynak tarama testi beklenen nedenle kırmızı. İletide eksik 14 sütun listeleniyor: `account_entries.doubtful_skip/source/source_id`, `cash_entries.transfer_id`, `cheque_collections.event_id`, `cheques.account_id/status`, `invoices.gl_json/try_stoppage/try_withheld`, `plan_entries.cheque_id/opening`, `plans.created_at`, `stock_moves.reason`.
- İki dosya birlikte iki TZ'de 37 test, 33 kırmızı. Nedeni her türde "ledger:snapshot bulunmalı".
- [4], [6] ×2 ve [8] tabanda da yeşil; bunlar gerileme koruması.

### Kabul koşulları
- **A.**
  - Yeni testler (son sürüm) UTC ve İstanbul'da 39/39 yeşil.
  - Mutantlar: 11 iz girdisi, 8 süzgeç, 3 önbellek ve 2 kaynak testi (K1, K2) mutantının hepsi yakalandı.
  - Yaşayan üç mutant: S6 zararsız (tahsil kaydı kapsamlı yolun `cheque:collections` denetimiyle zaten tam kapıya düşüyor), M3 pratikte eşdeğer, N7 eşdeğer.
  - kd2 (v2.0.26 verisi):

    | kip | taban (bulgu / günlük / zil) | yeni |
    |---|---|---|
    | plan-entry-opening | 0 / 0 / 0 | ledger:snapshot + period-lock / 1 / 1 |
    | acct-source | 0 / 0 / 0 | ledger:snapshot + period-lock / 1 / 1 |
    | review-both | 0 / 0 / 0 | 0 / 0 / 0 (BİLİNEN SINIR) |
    | cash-transfer | — | uygun satır yok |
    | acct-gl | — | `accounts.gl` sütunu yok |
    | cheque-status | 0 | 0 (olaysız değişiklik; türetme de değişmiyor) |

    Kapalıyken kipte sapma iki kipte de kalıyor (`ledger:snapshot:1`). Kural farkı 45/127.800 ve 46/128.200 iki tarafta aynı.
- **B / C.** Komşu ve Ç5-A listesi 101 dosya, 1106 test: önbellekten sonra UTC ve İstanbul'da 1106/1106 yeşil. 15 ekran senaryosunun hepsi yeşil (sema-kapisi-bs7 dahil); liste kanıtta.
- **D.** Kâhin taban ve yeni aynı sayılarda, iki TZ: defter 187/187; cari 84 senaryo, 15.166 denetim, 0 fark.
- **E. Hız** (resmî, ölçüm kilidiyle, yük < 2):
  - Kilitli veride Mutabakat Testi 13.765 → 9.156 ms (−%33,5). Borç Yaz −%1,8, evrak yazımı +%0,4, kilitli evrağın tahsili −%11,7, açılış −%5,6.
  - Kilitsiz kipte bütün yollar −%19 ile +%4,5 arasında.
  - **Donma +%10,7** (karar 2).

### KULLANICIYA SORULMALI
Yalnız 1-B seçilirse (para kuralı).

### KAPSAM DIŞI BULGULAR
- `goc-243-stok-acilis` ara sıra kırmızı. Neden: `integrity.failures` içinde kural farkı uyarısı, büyük olasılıkla dondurmanın bitişiyle yarış. Tabanda da bir kez görüldü; ders 20 gereği zorlanmadı.
- Faturalar ve `plan_imports` kapının para tabloları listesinde değil; bu tablolara tek başına yapılan yazım kapıdan geçmiyor.

### DENENEN / DENENMEYEN / BİLİNEN SINIRLAR
- **DENENEN:** v2.4.9 gerçek koduyla üretilmiş veri; iki TZ; satır içi, arka plan ve kapalıyken yolları; meşru olaylar; geri yükleme, sıfırlama, iki eski sürümden güncelleme; mutasyon; kâhin; ekran senaryoları; hız.
- **DENENMEYEN:**
  - Gerçek POS kesinti bağlama ve e-Belge numaralama yolları; yalnız kapıdan geçen aynı yazımları denendi.
  - İki şirket.
  - Dondurma sürerken işlem.
  - Tam `npm test` (ana oturuma).
  - Ekran yürüyüşü.
  - 1 milyon satırda ölçüm.
- **BİLİNEN SINIRLAR:** açılış durumu ile kopyasının birlikte değiştirilmesi; yüklenen kartın kilitten sonra tarihli açılış satırı (§15.2); kilitli karşılıksızı olan, durumu daha önce dışarıdan bozulmuş evrakta süzgecin karşılıksız dışı geçişe bakmaması; M3.

### Süreç sapmaları
- Bir commit'te (5a99925e) tasarım notu ile kanıt aynı commit'e girdi.
- Bir tanı ölçümü paylaşımlı kilitle koşuldu: ölçüm kilidi 1,5 saatten uzun doluydu. Bu ölçüm kabul sayılmadı, kanıtta "paylaşımlı" diye adlandırıldı.

### Bıraktığım klasörler
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a1f-is` (betikler, `sablon1` verisi)
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a1f-kanit`
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a1f-olcum` (`hepsi.sh` ile ölçüm yeniden koşulabilir)
- `/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/c5a1f-taban` (git worktree; ölçüm için bırakıldı, işi bitince kaldırılabilir)
- Mutant kopyası silindi.
- Kanıt: `docs/kanit/2026-11-13/c5a1f-*`. Tasarım notu: `docs/erp/C5-ACILIS-TASARIM.md` §16.

Ortam: yük 0,90 / 4 çekirdek, bellek boş 9 GB, disk boş 9,4 GB.
