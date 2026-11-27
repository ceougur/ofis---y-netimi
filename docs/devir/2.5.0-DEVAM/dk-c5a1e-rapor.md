# DAR KONTROL — Ç5-A tur 1e (birleşim d2d39258)

Worktree'yi `claude/epic-thompson-w0lc2l` ucuna (7daa4853) sıfırladım, çünkü ileri alma (ff) olmadı. Düzeltme, commit ve push yapmadım.

Mutantları kendi worktree'mde tek tek açıp her birinden sonra dosyayı geri yazdım. Sonda `git status -s` yalnız `?? node_modules` gösteriyor.

Ortam (sonda): yük 2,45 / 4 çekirdek, boş bellek 11 GB, boş disk 14 GB.

**Sonuç: YÜKSEK yok. ORTA 1, bu bir gerileme (G-1'in açık kalan sınıfı). DÜŞÜK 2. Kullanıcıya sorulacak 1 uç durum var.**

## GERİLEMELER

### G-1' (ORTA) — Kilitli dönemin kapı dışı bozulması bazı alanlarda hâlâ görünmüyor
**Neye göre gerileme:**
- **8e90f9cf^1'e (Ç5-A öncesi) göre gerileme.** Tur 1d ile geldi, tur 1e kapatmadı.
- d2d39258^1'e göre gerileme değil: orada da aynı.
- v2.4.9'a göre gerileme değil: v2.4.9'da donmuş defter yoktu.

**Betik:** `kd2.sh` / `kd2.mjs`, fikstür surum-2.0.26-zincir (kilit 05.10.2026). Değişikliği ayrı bağlantıyla yaptım. UTC ve İstanbul'da sonuç aynı.

| Kapı dışı değişiklik (kilitli satır) | 8e90f9cf^1 | d2d39258^1 | d2d39258 |
|---|---|---|---|
| `plan_entries.opening` çevrildi (2.800 TL taksit satırı) | bulgu ledger:rule-diff, günlük 1, zil 1, kural farkı 1 / 2.800 | bulgu 0, günlük 0, zil 0 | **bulgu 0, günlük 0, zil 0.** Kural farkı 44 → 45 madde, tutar **127.800 aynı** |
| `account_entries.source` 'cheque' → '' | bulgu, günlük 1, zil 1 (2 / 400) | 0 / 0 / 0 | **0 / 0 / 0** (kural farkı 46 / 128.200) |

**Kök neden:**
- Tur 1e yalnız beş Ç5-A işaretini kilit izine ekledi (`server/lib/integrity.mjs` LOCK_SQL).
- Türetmenin öbür girdileri izde yok: `plan_entries` girdisi (`id, plan_id, kind, amount, date, method`) ve `account_entries` girdisi (source / source_id yok).
- Yalnız kodla gördüm, betikle denemedim (DOĞRULANMADI): `cash_entries.transfer_id`, `plan_entries.cheque_id`, `invoices.gl_json / try_withheld / try_stoppage`, `cheque_collections.status`, `stock_moves.reason` (`routes/ledger.mjs` rows bunları okuyor).
- Tur 1d'den önce bunların hepsi kural farkının imzası değiştiği için bulunuyordu. 12.11 19:57 kararının "kural farkının kendi parmak izi tabanı" maddesi böyle bir genel yakalayıcıydı. Seçilen yol (K-a) bunu karşılamıyor.

**Tehlikesi:** tur 2'nin Kural Farkı Düzeltme Fişi bu bozulmayı "kural farkı" diye açık döneme yazar. Taksit satırı örneğinde tutar bile değişmiyor.

**En küçük düzeltme:** bu alanları `since: "2.5.0"` ile ize eklemek. Önce kaynak taramasıyla kilitli satırda bu alanları değiştiren meşru bir yazım olmadığı gösterilmeli; süzgeç (LOCK_FIELDS) de aynı alanları öğrenmeli. Ya da 19:57'deki parmak izi tabanı, yeni işaret izine ek olarak genel yakalayıcı olarak eklenmeli.

**Ders 46 notu:** bu ailenin önceki dar kontrolü de gerileme vermişti.

## Önceki bulguların kapanışı (önce → sonra)

| Bulgu | d2d39258^1 | d2d39258 | Durum |
|---|---|---|---|
| **G-1** — beş işaret (Kasa 0→1; cari 0→1 / 1→0; iki carinin işaretinin yer değiştirmesi; evrak işareti; kartın yükleme bağı; yükleme damgası, s127 fikstüründe) | bulgu, günlük ve zil 0 | Program açıkken: bulgu ledger:snapshot + period-lock, günlük 1, zil 1 (satır içi ve tek başına arka plan taraması). Kapalıyken + yeniden açılış: Mutabakat'ta ledger:snapshot:1 sapması kalıyor; günlük ve zil 0 (tasarım: açılışta zil yok) | Bu alanlar için kapandı. Sınıf için G-1' açık |
| **G-1** — KG-16 durumu (kilitli ve açık dönem) | 0 | opening:review:1, günlük 1, zil 1; kapalıyken sapma kalıyor | Kapandı |
| **G-2** — `s51b.mjs`: v2.4.9 verisi → göç → karar → sil → geri al | onaylı / reddedilmiş / aday → '' (602). Mizan 519 −2.600 → −2.050 TL, 602 −250 → −800 TL kaydı | Dört sınıf (iki kez sil / geri al dahil) durumunu koruyor; 120 2.850 / 519 −2.600 / 602 −250 TL hiç değişmiyor; Mutabakat temiz; kopya sapması 0 | Kapandı |
| **ORTA-3** | — | Kümede 25 kod noktası; bütün Unicode taramasında trimStart ile birebir. Gerçek göçte (`bosluk2.mjs`) uyuşmazlık 0. U+200B / 180E / 0085 / 2060 / 200D aday değil (kurala uygun) | Kapandı |
| **DÜŞÜK-1** | yaşıyordu | Mutant A1 / A8 / A16'nın üçü de yakalandı (her biri 1 test kırmızı, beklenen test adıyla) | Kapandı |
| **DÜŞÜK-2** | — | Farkı okudum: süre dolarsa ön koşul ayrı sayılıyor, çıkış 3. Gevşeme yok. Betiği koşmadım | Kapandı (koddan) |

ORTA-3 notu: v2.4.9'un API'si bu boşlukları zaten kırpıyor. Senaryo yalnız dış yazımla ya da başka bir giriş yoluyla oluşur.

## Yeni bulgular

**DÜŞÜK-A — yaşayan mutantlar (eksik test; kod doğru)**
- **N3:** yükleme damgası (`plan_imports.created_at`) izden çıkarılınca yakalanmıyor.
- **N7:** süzgeçteki `plan_imports` denetimi kaldırılınca yakalanmıyor.
- **N17:** `opening:review` denetimi COMMIT kapısına da girince yakalanmıyor. O zaman sapmadan sonra her yazım 409 alırdı.
- **N18:** karar ucunun "iki sütundan biri kararlı" koşulu kaldırılınca yakalanmıyor.
- N12 eşdeğer mutant (POS iptalinde KG-16 durumu hep ''); eksik test sayılmaz.
- Sakınca süzgeci: ürün bugün doğru, yanlış defter yok. Kod bozulursa kapı dışı değişiklik görünmez kalır, bu yüzden test eklenmeli.

**DÜŞÜK-B — "Açılış Olabilir" sapmasında çıkış yolu (K-c; `kc.mjs`)**
- Kapı dışından dört biçimde bozulan satırdan Açılış Olabilir listesi (`all=1`) yalnız 1'ini gösteriyor. Boşa düşürülen ve tanımsız değerli satırlar listede yok.
- Bu iki satıra uçtan kimlikle karar verilebiliyor (200).
- Kopyası '' ve durumu 'xyz' olan satır kararda 404 alıyor; sapma kalıcı kalıyor (sapma sayısı 4 → 1).
- Defter etkisi yok (iki durumda da 602). İpucu metni henüz olmayan bir ekranı anıyor.
- Uç `accounts.manage` yetkisiyle var. Tur 2 için: liste kopyadan da okumalı; "listede değil" durumuna geri dönülebilmeli.

## Tablolar

**Türetme girdileri** (A: program açıkken, satır içi + arka plan taraması; K: kapalıyken + yeniden açılış):

| Girdi | Bulunuyor mu |
|---|---|
| Kasa açılış işareti; cari açılış işareti (0→1, 1→0, iki carinin yer değiştirmesi) | A: evet · K: sapma kalıyor |
| Evrak açılış işareti | A: evet · K: sapma kalıyor |
| Kartın yükleme bağı; yükleme damgası | A: evet · K: sapma kalıyor |
| KG-16 durumu (kilitli ve açık dönem) | A: evet · K: sapma kalıyor |
| **KG-16 durumu ve kopyası birlikte değişirse** | **HİÇBİR denetim yok** (kural farkı 45 / 132.895,04; tasarımın sınırı) |
| plan_entries.opening, account_entries.source | **HAYIR** (G-1') |
| Kayıt Tarihi kilitten sonra, yüklemesi kilitte olan kart | Toplam +1.000 TL değiştirildi; S127'yle eski kurala bağlı olduğu için kilitli defter değişmedi (kural farkı 9 / 22.300 aynı) |
| Bu kartın taksit satırının açılış alanı | money:event denetimi buluyor |

**Meşru yollar** (`mesru.mjs`, `s51b.mjs`): önce ve sonra yanıt kodu aynı; bulgu, günlük ve zil 0.
- Kilitli satırda KG-16 onay → ret → onay: 200.
- Kilitli adayı silmek: 409.
- Kilidi ilerletme / kaldırma / yeniden koyma: 200.
- Yedek alma → 001'e aşamalı geri yükleme → yeniden açılış: 200, kopya sapması 0.
- Kilitli açılışı silmek: 409.
- v2.0.26-zincir ve v2.4.9-s127 verisiyle güncelleme, iki açılış (`guncelle.mjs`): bulgu yok, zil yok, kopya sapması 0. Görünenler yalnız kural farkı (EY-1) ve eskiden kalan ileri tarihli hareket satırı.
- Kaynak taraması: `is_opening` yalnız INSERT'lerle yazılıyor (cash.mjs:325, accounts.mjs:794 / 2089, cheques.mjs:453, trash.mjs:434) ve göçlerle. `import_id` yalnız INSERT / DELETE (plan-transfer.mjs:686). `plan_imports` güncellemesi yalnız `undone_*`.

**Kopyayı yazan yollar:** durumu yazan üç yer var: göç 48 → göç 50, `decide` (aynı işlemde), geri alma (INSERT'ten sonra tek UPDATE, aynı işlemde). Excel / Sheets durum yazmıyor (iki sütun da ''). Kopyasız kalan yol yok.

**S51 sınıf tablosu:** onaylı, reddedilmiş, aday ve listede olmayan satır sil → geri al sonrası durumunu ve defter satırını koruyor. S51'in kendi örneği (B): ikinci açılış aday ve 519'da, eski açılış işaretli dönüyor. Kilitli satır 409.

**Göç 48 / 50:**
- Göç 50 iki kez koşunca aynı sonucu veriyor (yalnız farklı satırları eşitliyor).
- Göç 49'da kalmış dosya 50'ye çıkıyor, sapma 0.
- Yarıda kesilme ve büyük veride göç süresi: DENENMEDİ.

**Test değişiklikleri:**
- K11 (`banka-210-goc`): iz 2.4.9 tanımıyla karşılaştırılıyor. Zorunlu sonuç; çıkan tek 2.5.0 girdisi eski veride satır üretmiyordu. N14 mutantı (`since` 2.4.9) 13 testte yakalandı.
- Şema sürümü beklentisi 49 → 50: zorunlu.
- Zorlama betiği: gevşeme yok.

**Mutantlar:** 18 yeni + önceki üç. Yakalanan: N1, N2, N4, N5, N6, N8, N9, N10, N11, N13, N14, N15, N16 ve A1, A8, A16. Yaşayan: N3, N7, N17, N18. Eşdeğer: N12. Taban 136 / 136 yeşil.

**Ölçüm: ÖLÇÜLEMEDİ.** Ölçüm kilidi üç denemede de doluydu (ana oturumun kabul ve kâhin koşuları); yük 2,6–4,3. Hazır betik: `olcum2.sh` + `olcum2.mjs`. Çalışması için `eski/` kopyası `git archive d2d39258^1` ile yeniden açılmalı.

## Baş mimar kararlarının değerlendirmesi

- **K-a:** dayanak beş alan için doğru (kaynak taraması ve meşru yollar betiği). Ama kapsamı 19:57 kararının genel yakalayıcısını karşılamıyor → G-1'.
- **K-b:** doğru.
  - Kapı izi `start()`'ta, göçten sonra ölçülüyor.
  - Donmuş defterin kaynak izi dondurma anında ölçülüyor.
  - Güncellemeden önce, kapalıyken yapılmış kilitli dönem değişikliği görünmez kalıyor. v2.4.9'da da öyleydi (orada iz saklanmıyordu); gerileme değil, BİLİNEN SINIR.
- **K-c:** uç ve yetki var, ekran yok. Liste eksik gösteriyor ve tanımsız değerde çıkış yolu yok (DÜŞÜK-B).

## Tur 2 için
**Kural farkına karışabilecek bozulmalar:**
- G-1' alanları.
- Durum ve kopyanın birlikte değiştirilmesi.
- Yeni kurala bağlı, yükleme günü kilitte olan kartın toplamı ya da silinmesi (meşru silme de kilitli türetmeyi değiştirir).

**Fişten önce temiz olması gerekenler:** ledger:snapshot, period-lock, opening:review, money:event, opening:519 (Açılış Karşılığı) ve G-1' için konacak denetim.

## KULLANICIYA SORULMALI (uç; iş listesi C'de sorulmamış)
**Durum:** carinin Açılış Bakiyesi silinip geri alınıyor; carinin onaylı bir "Açılış Olabilir" satırı var (yani başka bir açılışı var). Bugün geri alınan satır işaretli açılış dönüyor: carinin iki açılışı oluyor ve listeye girmiyor (`s51b`, C durumu). Eski kodda da aynı.
- **A (öneri):** onaylı satır da "başka açılış" sayılsın; geri alınan satır aday olsun.
- **B:** yalnız Açılış Bakiyesi satırı "başka açılış" sayılsın (bugünkü davranış).
- **C:** uç durum böyle kalsın (BİLİNEN SINIR).

İki okumada mizan aynı (519), çünkü aday da 519'da duruyor. Fark ancak aday reddedilirse 602'ye geçişte çıkar.

## DOĞRULANMADI
- G-1' listesindeki transfer_id, gl_json, cheque_collections.status ve öbür alanlar betikle denenmedi.

## DENENMEYEN
- Dondurma sürerken işlemler.
- Şirket Verisini Sıfırla (yeni test [5] kapsıyor).
- Eski sürüm yedeğini geri yükleme.
- İki şirket / şirket değiştirme.
- Taksit kartı silme ve yüklemeyi geri alma.
- Evrak işlemleri: ciro, tahsil, karşılıksız.
- v2.4.3 güncellemesi (betiğim hatalı tarih verdi).
- Göç 50'nin yarıda kesilmesi.
- Büyük veride göç süresi ve ölçüm.
- Zorlama betiğinin koşusu.
- Ekran / uçtan uca senaryolar.
- Kilit = bugün / dün / yıl sonu.

## Not defteri
`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/dk-c5a1e-z3`

Betikler: kd2.mjs, kd2.sh, tablo.py, mesru.mjs, s51b.mjs, bosluk2.mjs, guncelle.mjs, kc.mjs, mutant2.py, kos.sh, olcum2.mjs, olcum2.sh. Çıktılar `*.jsonl`, `*.json` ve `kos-mut-*.out` dosyalarında. Kod kopyalarım (`eski`, `c5aonce`) silindi.
