# Ç3 — Kilitli Dönemin Defterini Dondurma: Tasarım Notu (2.5.0)

Durum: KOD AJANI TASARIMI (05.11.2026); Ç3 TUR 1 (06.11.2026; dar kontrol ORTA-1/2/3, K4, DÜŞÜK-3, kural sürümü kuralı — §4, §5, §7, §8, §9, §11, §12, §17). Kaynak: `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md` §0, §1, §4 (aynen), §8, §9, §13, §14; `docs/erp/C2-FIS-DEFTERI-TASARIM.md` §5, §8, §11;
kural kitabı KG-15 ve EK-1 M7; `docs/devir/DEVIR-PLANI.md` G0, G1, G3, G6, G7; `docs/BANKA-MODULU-PLAN.md` §3.11/4 ve §3.11a. Kod: `server/lib/ledger-snapshots.mjs` (çekirdek),
`server/lib/ledger-freeze-worker.mjs` (iş parçacığı), `server/lib/ledger-rule-249/` (2.4.9 kural kopyası), göç 47 (`server/lib/migrations.mjs`), `routes/ledger.mjs` (kilit kancası,
karma okuma), `lib/integrity.mjs` (fark denetimi, `adoptLock`), `routes/report-center.mjs` (Yevmiye Defteri, Hesap Planı Mizanı, Defter Mutabakatı).

## 1. İlke
Türetilmiş defter korunur (ERP E1): donmuş defter ikinci bir para motoru DEĞİLDİR. Kilit konunca o güne kadarki türetilmiş yevmiye satırları olduğu gibi saklanır; kilitli dönemin
raporları bu kopyadan okunur. Kural değişmeden donmuş = canlı (birebir; §10 E1). Kural değişince kilitli dönem DEĞİŞMEZ, fark "Kural Değişikliği Farkı" olarak gösterilir (sessiz
değişiklik yok, düzeltme yok — düzeltme fişi Ç5'in işi, KG-15 A / EK-1 M7).

## 2. Şema (göç 47, yalnız ekleyici)
- `ledger_snapshot_runs` (koşu başlığı; küçük tablo, kilit her değiştiğinde bir satır): `no` (INTEGER PK, sıra) · `id` (TEKİL) · `kind` (freeze | thaw) · `state` (pending | done |
  abandoned) · `from_date` (koşu başlarken kapsam; dışlayan alt sınır, '' = baştan) · `through` (yeni kapsam; thaw'da geri çekilen gün, '' = hiç) · `rule_version` · `reason` (lock |
  voucher-closing | migration | repair | api) · bu koşunun satır / madde / borç / alacak toplamları · koşudan SONRA görünen bütün donmuş satırların durumu (`state_lines`,
  `state_debit`, `state_credit`, `state_weight` = Σ hesap kodu × (borç − alacak)) · `source_digest` + `digest_version` (kilitli dönemin kaynak izi; §8) · `created_by/at`, `finished_at`.
- `ledger_snapshots` (donmuş satır; WITHOUT ROWID, birincil anahtar (`run`, `run_seq`)): `run` · `run_seq` (koşu içinde yevmiye sırası) · `entry_id` (madde kimliği, ör. `account:<id>`,
  `voucher-close:<id>`) · `line_no` · `date` · `cls` (JOURNAL_CLASS sınıf numarası) · `seq` (kaynak satırın yazım sırası; yoksa NULL) · `account` · `sub` · `party` · `debit_minor` ·
  `credit_minor` · `source` ve `text` (Yevmiye Defteri'nin "İşlem" ve "Açıklama" kolonu; yalnız maddenin ilk satırında) · `rule_version`. İndeks (`date`, `run`, `run_seq`): tarih aralığı
  okuması, sıralı okuma ve bayat satır silme.
- Sıra: donmuş okuma `ORDER BY date, run, run_seq`. Koşuların tarih aralıkları ayrık ve ardışıktır ((from, through]), bu yüzden bu sıra dondurma anındaki yevmiye sırasının AYNISIDIR
  (hesap adı saklanmaz, kod saklanır — Ç1'in 770 adı donmuş dönemde de yeni ad).
- KAPSAM (coverage): `state = 'done'` olan son koşunun `through`'u (freeze ya da thaw). Bekleyen / bırakılan koşu kapsamı değiştirmez. Okuyucular yalnız `date <= kapsam` satırları
  görür; kapsamın üstündeki satır BAYATTIR (geri çekilmiş dönemin ya da yarım kalmış koşunun) ve görünmez.

## 3. Değişmezlik (tetikleyiciler; Ç2 deseni)
- Satır: UPDATE → RAISE(ABORT). DELETE → yalnız BAYAT satır (date > kapsam) ya da dondurma izi olmayan satır silinebilir; kapsam içindeki ve işlem geçmişinde dondurma izi
  (`ledger.snapshot.frozen`, `entity_id = ledger-snapshot-run:<no>`) olan satır silinemez. INSERT → yalnız EN SON koşuya, o koşu `freeze` + `pending` iken, tarihi (from, through]
  içinde; aynı (`run`, `run_seq`) ikinci kez eklenemez (INSERT OR REPLACE silme tetikleyicisini çalıştırmadan satır değiştirirdi).
- Başlık: DELETE → ABORT. UPDATE → yalnız `pending → done | abandoned` geçişi; kimlik, tür, aralık, kural sürümü, neden değişemez. INSERT → bekleyen başka koşu yokken; freeze'in
  `from_date`'i kapsama eşit ve kapsamın üstünde bayat satır yok (önce temizlenir); thaw `done` doğar.
- Tetikleyicileri yalnız Şirket Verisini Sıfırla (`clearSnapshots`) aynı işlemde kaldırıp yeniden kurar (DDL işlemsel).
- NEDEN iz koşullu silme: 2.4.9 (BS-7 kapısını bilmez) 47'lik dosyayı yazılabilir açabilir; onun Şirket Verisini Sıfırla'sı MOVEMENT_TABLES'taki `ledger_snapshots`'ı (2.1.0'dan beri
  listede) siler ve aynı işlemde önce `audit_events`'i siler → iz gider → silme geçer (2.4.9'un sıfırlaması bozulmaz). 2.5.0 açılışında onarım kapsamı kilide indirir (§7).

## 4. Kilit kancası (iki yol, tek işlev)
`snapshots.lockChanged({ previous, next, user, reason, mode })` — `PUT /api/admin/period-lock` ve `vouchers.postAll(…, { lockThrough })` (Ç2) aynı işlevi çağırır.
- İLERİ (next > kapsam): bekleyen koşu varsa `abandoned`; bayat satırlar temizlenir; `pending` freeze koşusu (from = kapsam, through = next, kural = güncel) kilitle AYNI işlemde yazılır.
  - EŞZAMANLI kip (`postAll` lockThrough, D4, göç dışı iç çağrılar): aynı işlemde türetilir (`build()` işlemin içinden okur — yeni kapanış fişleri dahil), satırlar yazılır, koşu `done`.
    Kilit + fişler + donmuş satırlar tek işlem (biri düşerse hiçbiri yok).
  - İŞ PARÇACIĞI kipi (`PUT period-lock`): kilit + bekleyen koşu küçük bir işlemde; sonra `ledger-freeze-worker.mjs` salt okunur bağlantıda, tek okuma işleminde (WAL anlık görüntüsü)
    koşunun kuralıyla türetir, (from, through] satırlarını ve kaynak izini 2.000'lik parçalar hâlinde gönderir; ana iş parçacığı her parçayı küçük bir işlemde yazar (koşu hâlâ en son ve
    bekliyor mu — değilse durur); son küçük işlem sayıyı ve toplamları doğrular, koşuyu `done` yapar, izi (`ledger.snapshot.frozen`) yazar. Uç işin bitmesini bekler (yanıt dondurma
    bittikten sonra); ilerleme `ledger.freeze.progress` olayıyla ve `GET /api/workspace/ledger/lock` (`freeze`) ile.
- GERİ (next < kapsam): bekleyen koşu `abandoned`; `thaw` koşusu (through = next, `done`) kilitle aynı işlemde; bayat satırlar (date > next) parça parça silinir (görünmezler).
  İz: `ledger.snapshot.thawed` (işlem geçmişi) + kilidin kendi izi (`ledger.period.unlocked/locked`).
- ESKİ KURALLI BEKLEYEN KOŞU (tur 1, ORTA-3 ve ailesi; plan §4 "göçte 2.4.9 KURALIYLA"): göçün / onarımın 2.4.9 koşusu ya da bu programın bilmediği kuralın koşusu güncel kurala
  HİÇBİR yolda geçmez. Aynı güne yeniden kilit → koşu sürer (kuralı ne olursa olsun). Kilit koşunun içine çekilir (kapsam < hedef < koşunun günü) → koşu bırakılır, (kapsam, hedef]
  AYNI kuralla. Kilit ilerletilir → koşu sürer, iz `ledger.snapshot.extended` ({ through }) bu programın ilerlettiği günü kaydeder; koşu tamamlanınca AYNI işlemde (koşunun günü, iz
  günü] güncel kuralla yeni bekleyen koşu (`continueAfter`); kilit iz gününün de ötesindeyse (eski sürüm ilerletti) kalanı GAP_RULE. Eşzamanlı kipte (postAll lockThrough) koşu ve
  kalan dönem aynı işlemde donar; kuralı bilinmeyen koşu eşzamanlı dondurulamaz → işlem düşer (kilit + fiş yazılmaz). Güncel kurallı bekleyen koşu önceki davranışla (bırakılır,
  yenisi). Kilit kapsamın altına çekilirse her koşu bırakılır (thaw).
- ATOMİKLİK (BAŞ MİMAR KARARI önerisi K1): iş parçacığı kipinde kilit önce konur, donma arkasından gelir. Her an: donmuş ≤ kapsam ≤ kilit; (kapsam, kilit] kilitli ama donmamış
  dönem bekleyen koşunun kuralıyla CANLI okunur (aynı kural, aynı veri → donunca aynı satırlar). Kilitli dönemin kaynağı kilit konduğu anda bütün yazma yollarında kapalıdır
  (period, kapının kilit izi). Yarım durumda okuma hiçbir zaman yanlış değildir; çökme / kapanma → bekleyen koşu açılışta sürdürülür (§7). Gerekçe: 1.000.000 satırda satırları kilitle
  aynı işlemde yazmak olay döngüsünü saniyelerce kilitler (ders 47); "kilit en sonda" bütün yazma yollarında ayrı bir "bekleyen kilit" isterdi — kilidin kendisi zaten odur.
- Kapı: kilit değişince `integrity.adoptLock({ lock, digest })` — iz iş parçacığının anlık görüntüsünden gelir (dondurma bitince). O ana kadar iz "bekliyor": kilitli döneme dokunan
  yazım (süzgecin kilit nedeni) 409 period-locked ile reddedilir; başka nedenle tam kapıya düşen ilk işlem izi kendisi ölçüp benimser, iş parçacığının izi gelince karşılaştırılır
  (fark = kapının görmediği değişiklik → Mutabakat Günlüğü). Önceki davranış (`integrity.start()` = ana iş parçacığında tam tarama, 100.000 satırda saniyeler) kilit ucundan kalktı.

## 5. 2.4.9 kural kopyası (`server/lib/ledger-rule-249/`)
- v2.4.9 etiketinin (ccf0b0ca) türetme kapanışı: `general-ledger.mjs`, `cheque-gl.mjs`, `doubtful-gl.mjs`, `money.mjs` AYNEN; `ledger-rows.mjs` (routes/ledger.mjs rows / refs / build
  AYNEN, kayıt işlevinin içinden çıkarılmış) ve `doubtful-rows.mjs` (bank/doubtful.mjs doubtfulRows ve sorguları AYNEN). Yalnız içe aktarma satırları kopyanın kendi klasörüne
  bakar. `index.mjs`: `buildRule249(store)` + saklanan fişler (kural dışı; 2.4.9 dosyasında yoktur, eksiksizlik için aynen eklenir).
- Dosyaların sha256'sı testte sabittir (değiştirilemez). Eşdeğerlik: aynı veride v2.4.9 GERÇEK kodunun (`git archive v2.4.9`) `build()`'i = kopyanın `buildRule249()`'u, madde madde
  (kimlik, tarih, kaynak, açıklama, satırlar) — `test/donmus-defter-249-esdegerlik.mjs`.
- Kural kayıt defteri: `{ "2.4.9": buildRule249, [LEDGER_RULE_VERSION]: güncel build }`. `LEDGER_RULE_VERSION = "2.5.0"` (general-ledger.mjs); Ç5 / Ç7 her türetme değişikliğinde
  yükseltir. Kural tuzağı testi: güncel kural "2.5.0" iken güncel türetme = 2.4.9 kopyası (tutarda; Ç1'in 770 adı hariç) — Ç5'in ilk kural değişikliği bu testi bilerek değiştirir.
- Kullanım: YALNIZ göç (§6) ve eski sürümün ileri götürdüğü kilit (§7). BİLİNEN SINIR (kullanıcıya söylenir): 2.4.9'dan önceki kural değişiklikleri (ör. senet 121/321, 2.3.0) geri
  alınmaz; donma 2.4.9 sonucudur.
- KURAL SÜRÜMÜ KURALI (tur 1): `LEDGER_RULE_VERSION` yükselince ÖNCEKİ güncel kural silinmez. Önceki kuralın türetmesi `server/lib/ledger-rule-<sürüm, noktasız>/` klasörüne AYNEN
  kopyalanır (2.4.9 deseni: sha256 sabit, eşdeğerlik o sürümün gerçek koduyla). Kopya kayıt defterine eklenir: `createLedgerSnapshots` `rules` ve dondurma iş parçacığının kural
  seçimi. Yeni sürüm `RULE_HISTORY`'nin sonuna eklenir (`lib/ledger-snapshots.mjs`; eskiden yeniye, son öğe güncel kural, öğe silinmez). Gerekçe: o sürümde açılmış bekleyen koşu
  (göç, onarım, yarım dondurma) ve kilitli dönemin yeniden donması kendi kuralını bulmalı. Bulamazsa koşu bekler, görünür bulgu olur (§7). Denetim (test/donmus-defter-tur1-250.test.mjs
  "§5 kural kayıt defteri"): (1) son öğe = `LEDGER_RULE_VERSION`; (2) bilinen önek ["2.4.9", "2.5.0"] korunur; (3) her önceki sürümün kopya klasörü var; (4) kayıt defteri = geçmiş;
  (5) her sürümün bekleyen koşusu iş parçacığında kendi kuralıyla donar.

## 6. Göç 47 ve büyük veri
- Göç: iki tablo + indeks + tetikleyiciler; kilit varsa (`ledger.lockedUntil`) BEKLEYEN koşu (from '', through = kilit, kural "2.4.9", neden migration). Türetme göçte YAPILMAZ.
- Açılıştan sonra (setImmediate; ilk şirkette dinlemeye başlayınca, şirket örneğinde açılınca) bekleyen koşu iş parçacığında 2.4.9 kopyasıyla donar. Arada raporlar kilitli dönemi
  bekleyen koşunun kuralıyla (2.4.9 kopyası) canlı okur → göçten önce / sonra / donduktan sonra aynı sayılar.
- Gerekçe (BAŞ MİMAR KARARI önerisi K2): 1.000.000 satırda türetme ~55 sn; göçte yapılsa 001 açılışı ve 002'nin tembel açılışı (istek içinde) bir dakika beklerdi; supervisor açılış
  süresi riski. Bakım kipi gerekmez: kilitli dönem zaten yazılamaz, açık dönem yazımı donmuş satırları etkilemez.
- Kopya / geri yükleme: VACUUM INTO tabloları ve tetikleyicileri taşır; bekleyen koşu geri yüklenen dosyada da açılışta sürer. Eski (≤ 46) yedek geri yüklenince göç 47 yeniden koşar.

## 7. Açılış onarımı (eski sürüm, yarım koşu)
Sıra: göçlerden ve Ç2 onarımından sonra, kapıdan önce; BS-7 yeni şemalı dosyada koşmaz.
- (tur 1, ORTA-2) EKSİK / DEĞİŞMİŞ DONMUŞ SATIR ÖNCE: görünen donmuş satırların sayısı, borcu, alacağı ve ağırlığı son tamamlanan koşunun kayıtlı toplamlarıyla (`state_*`) karşılaştırılır.
  2.4.9'un Şirket Verisini Sıfırla'sı satırları siler, koşuları bilmez; eski kodda kilit aynı güne / ileri konunca kilitli yıl boş donmuş defterden okunuyordu. Tutmuyorsa kapsam
  SAĞLAMA NOKTASINA iner (thaw, neden repair). Sağlama noktası, toplamları bugün de tutan, kendinden sonraki hiçbir geri çekmenin altına inmediği en son tamamlanmış koşunun günüdür;
  yoksa baştan. Geri çekmenin toplamı ölçülen değerdir ("önceki − kaldırılan" değil; satırlar zaten silinmiş). Kilit kapsamın ötesindeyse dönem aşağıdaki maddeyle GAP_RULE kuralıyla
  yeniden donar (KULLANICI KARARI 06.11 03:35 S13 = A). Bedeli: her açılışta donmuş satırlar üzerinde tek toplam sorgusu (ölçüm §17).
- Bekleyen koşu var → iş parçacığında sürdürülür (bayat satırlar önce silinir). Kuralı kayıt defterinde yoksa (tur 1) koşu BEKLER, güncel kurala geçirilmez ve yarım dondurulmaz. Neden
  ilerlemede (`status().error`) ve Mutabakat Testi'nde ("Bekleyen Dondurmanın Kuralı Bu Programda Yok", ad "· Dondurma Bekliyor") görünür; raporlar o dönemi güncel kuralla okur.
- Eski kurallı bekleyen koşu (tur 1) ile eski sürüm kilidi değiştirdiyse: kilit koşunun ötesindeyse koşu sürer (kalan dönem §4 `continueAfter`); gerisindeyse (kapsam, kilit] aynı
  kuralla. Güncel kurallı bekleyen koşuda önceki davranış: bırakılır, (kapsam, kilit] GAP_RULE.
- Kilit > kapsam, bekleyen yok (yalnız eski sürüm yapabilir: 2.5.0 kilit koyunca koşu açar) → BEKLEYEN koşu, kural GAP_RULE = "2.4.9" (KULLANICI KARARI S13 = A; §12), neden repair.
- Kilit < kapsam (eski sürüm kilidi açtı ya da sıfırladı) → thaw koşusu (neden repair), bayat satırlar temizlenir.
- Kilit = kapsam ama kaynak izi tutmuyor (eski sürüm kilidi açıp değiştirip aynı güne yeniden kilitledi; dış yazım) → yalnız bulgu ("Donmuş Dönemin Kaynağı Değişti"); otomatik düzeltme
  yok. Çözüm: Kilidi Aç → Yeniden Kilitle (güncel kuralla yeniden donar).

## 8. Fark denetimi ve kapı
- `ledger:snapshot` "Donmuş Defter" (yapı): görünen satır sayısı / borç / alacak / ağırlık = son koşunun durum toplamları; kapsam = kilit (bekleyen koşu kilide kadar sürüyorsa
  sorun sayılmaz, adında "Dondurma Sürüyor"); kaynak izi (`lockDigestOf(kapsam, { version: digest_version })`) = saklanan iz ("Donmuş Dönemin Kaynağı Değişti"). Ucuz SQL; tam
  taramada. Düzey "uyarı" (kapıda koşmaz, işlemleri engellemez; çözüm Kilidi Aç → Yeniden Kilitle) — banka-210-onarim'in "kilitli satırı elle boz" senaryosu bunu böyle görür.
- `ledger:rule-diff` "Kural Değişikliği Farkı (Kilitli Dönem)": kapsam içindeki her madde donmuş ↔ güncel türetme (tarih + satırlar: hesap, alt hesap, cari, borç, alacak; sıra ve yazım
  sırası karşılaştırılmaz — VACUUM INTO rowid'i değiştirebilir). Fiş maddeleri (voucher-*) saklanan satırdır: donmuş kopyayla karşılaştırılır, yeniden türetilmez (Ç2 §11). Fark: sayı
  (madde) + yıl / hesap / alt hesap / cari bazında tutar (`ruleDiff()`; Ç5'in Kural Farkı Düzeltme Fişi bunu okur). Düzey "uyarı" (`severity: warning`, ok false): yeni işlemleri
  ENGELLEMEZ (kapının tabanında; kural sürümle değişir, kullanıcının işi değil).
- İLETİLER (tur 1, K4; `ruleDiffHint`). Nedeni bilinmeyen ayrışma "kural değişti" diye adlandırılmaz. Kaynak izinin kapsamadığı türetme alanları da (account_entries.note, is_opening, …)
  aynı farkı doğurur. Açıklama nedene göre:
  - eksik / değişmiş donmuş satır: "Fark donmuş defterdeki eksik ya da değişmiş satırlardan (Donmuş Defter denetimi); kural değişikliği değildir. …";
  - kaynak izi değişti: "Kilitli dönemin kaynak kayıtları dondurmadan sonra değişti …; fark bundan ya da defter kuralının değişmesinden olabilir. …";
  - neden bilinmiyor (tarafsız): "Kilitli dönemin donmuş defteri güncel türetmeden farklı: neden defter kuralının program sürümüyle değişmesi ya da kilitli dönemin kaynak verisinin
    kapının görmediği bir yolla değişmesi olabilir. …".
  Eksik satır `ledger:snapshot`'ta ayrı iletiyle çıkar: "Donmuş Defterde Eksik Satır: GG.AA.YYYY ve öncesinde N satır görünüyor, M satır donmuştu (…); program yeniden açılınca kilitli
  dönem yeniden donar" (değişmişse "Donmuş Defterin Satırları Değişmiş: …"). Denetim adları Yazım düzeninde; parantez içindeki ad parçaları da büyük harfle: "Donmuş Defter
  (31.12.2026 ve Öncesi)" / "(Yok)" · "Dondurma Sürüyor" / "Dondurma Bekliyor"; "Kural Değişikliği Farkı (Kilitli Dönem: 31.12.2026 ve Öncesi)".
  AÇIK (dosya sınırı): `routes/report-center.mjs:719` Defter Mutabakatı alt başlığı hâlâ "Defter kuralı program sürümüyle değişti …" cümlesini taşıyor (yalnız kural farkı varken).
  Bu tur yalnız ledger-snapshots.mjs'e dokunur; cümle Ç3 tur 2'de ya da report-center'a dokunan işte tarafsızlaşır (ana oturuma bildirildi).
- Nerede: açılış (`integrity.start` taban), Mutabakat Testi, 15 dakikalık arka plan taraması (iş parçacığı), Defter Mutabakatı raporu. COMMIT kapısında YOK (BAŞ MİMAR KARARI önerisi
  K3: kural yalnız sürümle değişir; kilitli dönemin kaynağını COMMIT'te LOCK_SQL korur; 100.000 satırda her yazıma ~yüzlerce ms eklerdi).
- Görünürlük: donmuş koşu hiç yoksa iki denetim de görünmez (kilitsiz şirketin denetim listesi ve sayısı 2.4.9 ile aynı).
- FINANCIAL / integrity-scope / LOCK_SQL (BAŞ MİMAR KARARI önerisi K5): donmuş tablolar ÜÇÜNDE DE YOK. FINANCIAL'da olsaydı her parça yazımı tam kapıya düşerdi (100.000 satırda
  parça başına saniyeler); donmuş satır kaynak değildir (kapının koruduğu alt defterlerden türetilmiş kopyadır) — koruması tetikleyiciler + durum toplamları + fark denetimi. LOCK_SQL'de
  olsaydı kilit konduktan sonra donma tamamlanınca iz değişir, kapı kendi dondurmasını "Kapanmış dönem değişemez" diye reddederdi. integrity-scope yalnız FINANCIAL tablolarını görür.
  `LOCK_SQL_VERSION = "2.5.0"` (integrity.mjs): koşunun kaynak izinin hangi LOCK_SQL tanımıyla alındığı.

## 9. Okuma yolları
| Yol | Kaynak |
|---|---|
| Yevmiye Defteri (rapor) | KARMA (`ledger.book({ to })`): ≤ kapsam donmuş; aralığın sonu ≤ kapsam ise yalnız tablo (canlı türetme yok) |
| Hesap Planı Mizanı (rapor), `GET /api/workspace/ledger` mizanı | KARMA (`check({ book: true })`); "Mutabakat tutarlı / farklı" CANLI (alt defterler güncel kuralla) |
| Defter Mutabakatı (rapor) | mutabakat CANLI + `ledger:snapshot` / `ledger:rule-diff` satırları (fark varsa hesap bazında) |
| Mutabakat kapısı, Mutabakat Testi, İşlem Kartı (süzgeçli) | CANLI (alt defter ↔ ana defter güncel kuralla; karma okuma kural değişince sahte fark doğururdu — §3.11a dersi) |
| KDV Mahsup Fişi ay tutarları (`routes/tax.mjs`), Alt Hesap Mizanı (Banka; tek kaynaktan) | DEĞİŞMEDİ (canlı); Ç7a / Ç7b notu (§13) |
| Büyük Defter, Gelir Tablosu, Bilanço (Ç6) | KARMA (`ledger.book`) kullanacak |
Yan kazanç (BAŞ MİMAR KARARI önerisi K8): yalnız aralığı tamamen donmuş dönemdeki rapor (ör. geçen yılın Yevmiye Defteri) canlı türetme yapmaz. Açık dönemi kapsayan raporda canlı
türetme bütün geçmişi kurmaya devam eder: şüpheli alacak ayırması ve kart kapanışı carinin TAM geçmişini ister; kısmi türetme Ç6'da ölçümle (plan §8).
- DONMUŞ MİZAN ÖNBELLEĞİ (tur 1, ORTA-1): anahtar = son TAMAMLANAN koşunun kimliği (`id`, rastgele) | kapsam | data_version | from | üst sınır. Her dondurma, geri çekme ve Şirket
  Verisini Sıfırla'dan sonraki her koşu yeni kimlik alır. Önceki anahtar (kapsam | MAX(no) | data_version) sıfırlamada bozuluyordu: no 1'den başlar, data_version aynı bağlantının
  yazımında değişmez. Sıfırla + aynı güne yeniden kilitten sonra Hesap Planı Mizanı eski verinin toplamını gösteriyordu.
- ARA DİLİM (tur 1, DÜŞÜK-3, ders 47). Göç / onarım penceresi = bekleyen eski kurallı koşu sürerken. (kapsam, koşunun günü] o kuralla okunur; bu, rapor başına İKİNCİ tam türetmedir.
  - Aralığın sonu koşunun dönemindeyse (geçen yılın Yevmiye Defteri) yalnız o kuralla türetilir, güncel türetme kurulmaz.
  - Aralık koşunun gününden sonra başlıyorsa ara dilim okunmaz.
  - Öbür okumalarda ara dilim koşu başına bir kez kurulur. Anahtar: koşunun kimliği | data_version | bu nesnenin DIŞINDAKİ yazımların total_changes'ı. Dondurma parçalarının yazımı
    anahtarı değiştirmez; işlem içinde saklanmaz (GG2).
  - İki kural bu dönemde aynı maddeleri veriyorsa yalnız "aynı" bilgisi ve güncel dilimin parmak izi saklanır (bellek yok; isabette parmak iziyle yeniden sınanır). Farklıysa dilimin
    kendisi saklanır (en çok 200.000 madde; üstü saklanmaz).
  - Çıktı önbelleksiz yolla birebir.

## 10. Sıfırlama, geri yükleme, iki şirket
- Şirket Verisini Sıfırla (iki kip): `clearSnapshots` (tetikleyiciler kaldırılır, iki tablo silinir, tetikleyiciler kurulur); kilit zaten sıfırlamada kalkar ("ledger." KEEP_SETTINGS'te
  YOK). Süren iş durur (koşu yok olur). `ledger_snapshots` MOVEMENT_TABLES döngüsünden çıkarıldı (silme tetikleyicisi döngüyü düşürürdü; sayılar `clearSnapshots`'tan).
- Geri yükleme: dosya takası; açık örnek kapanır (`app.close` süren işi durdurur, iş parçacığını sonlandırır). Bekleyen koşu yeni dosyada açılışta sürer.
- İki şirket: ayrı dosya, ayrı kancalar, ayrı işler. Şirket silme: klasör gider.
- Devri Geri Al (D4): dosya takası.

## 11. D4 ve Ç5 için iç API (`server.app.ledger.snapshots` / `createLedgerSnapshots`)
- `state()` → { coverage, lock, pending: { no, through, rule } | null, runs } · `entries({ from, to })` donmuş maddeler (yevmiye biçimi) · `book({ to })` karma yevmiye.
- `freezeSync({ through, user, reason, rule })` — işlemin İÇİNDE çağrılır (D4 kopyası, kapanış fişleri): türet + yaz + done; dönüş koşu özeti. D4 arşivde K'ye kadar kilitlerken
  `vouchers.postAll(…, { lockThrough: K })` bunu kendisi çağırır (kapanış fişleri donmuş satırlarda).
- `ruleDiff({ through })` → { entries: N, sample, balances: [{ year, account, sub, party, frozenMinor, liveMinor, differenceMinor }] } — Ç5'in Kural Farkı Düzeltme Fişi
  (tarih kilit + 1, M7: aynı yıl eski hesabın tersi, önceki yıl 671 / 681) bu tutarlardan kurulur. Fişin kendisi açık dönemde, olağan sınıfta (Ç2 `post`); donmuş satırlara dokunmaz.
- `lockChanged({ next, user, reason, sync })` — kilidi değiştiren işlemin içinde (Devri Yenile'nin arşivi açması da: geri çekme = thaw; G7). `purgeStale()`, `runPending()`,
  `digestOf(lock)`, `repairOnOpen()`, `cancel()` / `close()`, `status()`.
- D4 notları: arşiv kopyasında `freezeSync` iş parçacığının KENDİ bağlantısında (bakım kipi); yeni yıl dosyasında kapsam K (arşivin donmuş satırları yeni yılda YOK — G3: ≤K budanır;
  `pruneThrough` D4'ün dar işlevi, tetikleyici kaldırma deseniyle). Ç2'nin satır tetikleyicisi (`ledger_voucher_lines_closed`) her eklemede COUNT(*) yapar: binlerce satırlı devir
  açılış fişinde karesel — D4 ölçmeli.
- D4'E KISITLAR (tur 1; dar kontrol E kaydı 06.11 03:08, karar (7) A):
  (1) Geri çekme tarih bazındadır. Devri Yenile arşivin kilidini açarsa (thaw) arşivin BÜTÜN donmuş satırları kalkar. Yeniden donarken o anın kuralıyla türetilir: arşiv yılı sessizce
      yeni kurala geçer. D4 ya yalnız voucher-* satırlarını değiştiren dar bir işlev kurar (kapanış / açılış fişlerini siler-yazar, öbür donmuş satırlara dokunmaz) ya da arşivin kendi
      kuralı kayıt defterinde tutulur ve yeniden donma `freezeSync({ rule })` ile o kuralla yapılır.
  (2) Yeni yıl dosyasında ≤ K budaması (`pruneThrough`) koşu başlıklarının durum toplamlarını (`state_*`) güncellemezse açılış onarımı (§7, tur 1) satırları "eksik" görür. Kapsamı
      indirir, dönemi GAP_RULE ile yeniden dondurmaya kalkar (ORTA-2'nin boş okuma deseninin tersi). Budama ya yeni bir thaw / özet koşusuyla toplamları yazar ya da ≤ K'yi kapsam dışı
      bırakır.
  (3) `freezeSync` bekleyen koşuyu kuralına bakmadan bırakır (D4'ün açık API'si). Bekleyen eski kurallı koşu (göç 2.4.9) varken D4 bunu çağırırsa göç dönemi verilen kuralla donar. D4
      önce bekleyen koşunun bitmesini bekler (`runPending`) ya da `rule`'ü bekleyen koşunun kuralından seçer.
  (4) Karar (3) / Ç5 bunları Ç3 açısından olanaksız kılmıyor; ruleDiff farkı yakalar.

## 12. BAŞ MİMAR KARARI önerileri (ders 40) ve KULLANICIYA SORULMALI
- K1 Kilit önce, donma arkasından (§4). K2 Göçte bekleyen koşu, donma açılıştan sonra (§6). K3 Fark denetimi yalnız tam taramada (§8). K4 "Kural Değişikliği Farkı" uyarı düzeyinde,
  işlemleri engellemez. K5 Donmuş tablolar FINANCIAL / LOCK_SQL / integrity-scope dışında (§8). K6 Silme tetikleyicisi dondurma izine bağlı (§3). K7 Geri çekme mantıksal, fiziksel
  silme parça parça (§4). K8 Yan kazanç sınırlı (§9). K9 Kural sürümü etiketi + 2.4.9 kopyası kayıt defterinde (§5). K10 Karma okuma yalnız defter raporlarında; mutabakat canlı (§9).
  K11 Kaynak izi koşuda saklanır, tutmazsa yalnız bulgu (§7). K12 Kilit ucu tam taramayı (integrity.start) ana iş parçacığında koşmaz (§4).
- S1 / S13 — KULLANICI KARARI 06.11 03:35: A (2.4.9 kopyası). Soru (ders 43; hangi kural sürümünün donduracağı hesap sınıflamasını belirler): eski sürüm (≤ 2.4.9; BS-7 kapısını
  bilmez) 2.5.0 dosyasında kilidi İLERİ götürdüyse aradaki dönem hangi kuralla donsun? (A) 2.4.9 kopyasıyla: kilidi koyan programın kuralı, kullanıcı kilitlerken o raporları gördü;
  (B) güncel kuralla. Kapsam (dar kontrol ORTA-2): eski sürüm dosyayı SIFIRLAYIP yeniden kilitlediyse yeniden donan dönem de bu kuralla. Seçim tek sabittir: `GAP_RULE = RULE_249`
  (lib/ledger-snapshots.mjs). Kullanıldığı yerler: açılış onarımı (kilit > kapsam; eksik satırdan sonra yeniden donma), `continueAfter` (eski sürümün ilerlettiği kalan dönem).
- K1 — BAŞ MİMAR KARARI (dar kontrol 06.11 03:08, kullanıcıya gösterilecek; ders 40). "Kilit önce, donma arkasından", planın §4 "kilit ile donmuş satırlar TUTARLI ve ATOMİK yazılır"
  sözünden SAPMADIR, ama mantıksal olarak atomiktir. Kapsam tek işlemde döner (koşu `pending → done`). (kapsam, kilit] arası kilitli ama donmamış dönem bekleyen koşunun kuralıyla
  canlı okunur ve doğrudur. Kaynağı kilitle aynı anda bütün yazma yollarında kapanır. Yarıda kesilme açılışta sürer. Gerekçe: 1 M satırda kilitle aynı işlemde yazmak olay döngüsünü
  dakikaya yakın kilitlerdi (ders 47).
- Tur 1 BAŞ MİMAR KARARLARI (ders 40; kullanıcıya gösterilecek; hiçbiri yeni para kuralı değildir):
  (a) Eski kurallı bekleyen koşunun dönemi, kilit başka güne gidince de koşunun kuralıyla donar (§4). Bu programın ilerlettiği kalan dönem güncel kuralla donar. Dayanak: plan §4
      "göçte 2.4.9 KURALIYLA" ve S13 A'nın gerekçesi "kilidi koyan programın kuralı". Güncel kurallı bekleyen koşuda davranış DEĞİŞMEDİ.
  (b) Bilinmeyen kuralın bekleyen koşusu bekler, görünür bulgu olur (dar kontrol "görünür bulgu, yarım donmuş defter yok").
  (c) Eksik satırda sağlama noktası: kapsam baştan değil, sağlam son koşunun gününe iner. Önceki koşuların satırları kendi kurallarıyla korunur; yalnız eksik dönem GAP_RULE ile yeniden
      donar (S13 kapsamı).
  (d) Ara dilim önbelleği (§9): çıktı birebir, yalnız hız.
- Kural kitabı sorusu YOK: Ç3 para kuralı değiştirmez; KG-15 A (kullanıcı kararı 05.11 "hepsi A") gösterimi ve düzeltme fişini zaten kararlaştırdı.

## 12a. Uygulamada netleşenler (05.11 gece)
- Kilit ucu artık `integrity.start()` (ana iş parçacığında tam tarama) çağırmaz: `adoptLock({ lock, digest: null })` → dondurma bitince iş parçacığının izi; geri çekmede iz
  `digestOf` ile ayrı iş parçacığında. İz beklerken kilitli döneme dokunan yazım 409 (period-lock); tam tarama da bekleyen izi benimser.
- Göç 47 yeniden koşarsa (tablolar zaten var) koşu eklemez (banka-230-supheli-bozma N senaryosu: sürüm numarası elle düşürülen dosya); kapsam ↔ kilit farkını açılış onarımı giderir.
- Açılış sonradan düşerse dondurma başlatması geri alınır (`setImmediate` geri alma yığınında; createapp-acilis-geri-alma-249 T4 / T11).
- Ana oturum notu (22:0x): Ç2'nin `withTriggersLifted`'i yalnız fiş tetikleyicilerini adlarıyla kaldırıp kurar; donmuş defter tetikleyicileri ayrı adlıdır ve etkilenmez — iki kipte
  sıfırlamadan ve Ç2 onarımlı açılıştan sonra sqlite_master'da sayılır (test F13, F13c, F12). Kilidi değiştiren BÜTÜN yollar: PUT period-lock (kanca), postAll lockThrough (kanca,
  eşzamanlı), Şirket Verisini Sıfırla (clearSnapshots + kilit silinir), geri yükleme (dosya takası; açılış onarımı kapsamı kilide eşitler), eski sürümün ayar yazımı (açılış onarımı) —
  her biri testli (F1–F4, F10, F13, F13b, F12, eski sürüm betiği). postAll lockThrough PUT ucunun ön adımlarını (pos.beforeLock) çağırmaz: Ç2 düzeltme turunun / D4'ün işi.
- 2.4.9'un Şirket Verisini Sıfırla'sı GERÇEK kodla denendi (test/donmus-defter-eski-surum-250.mjs): donmuş satırlar varken 200, satırlar silinir, 2.5.0 açılışında kapsam boşa iner.

## 13. Ç5 / Ç7 notları
- Ç5 kural değişikliği girince `LEDGER_RULE_VERSION` yükseltilir ve kural tuzağı testi bilerek güncellenir; kilitli dönemin raporları değişmez, Defter Mutabakatı "Kural Değişikliği
  Farkı" gösterir; Kural Farkı Düzeltme Fişi `ruleDiff()`'ten (tarih = kilit + 1; kilit bugünse yarın → bugün 400 date-future, Ç2 §11).
- Ç7b (KG-7 / KG-8 KDV): `routes/tax.mjs` monthFigures canlı türetmeden okur; kilitli ayın "Güncel Değil" işareti kural değişince yanılır → karma okumaya (`ledger.book`) geçirilmeli.
- Ç7a (KG-19 108.90): Alt Hesap Mizanı (Banka) tek kaynaktan; defterle aynı kalması için kuralın oraya da girmesi gerekir.

## 14. Nasıl bozulur? (önce yazıldı; testler bu listeden)
F1 kilit koy → donmuş = canlı (madde madde, mizan yıl yıl) · F2 kilit ilerlet (iki koşu, ardışık aralık) · F3 kilit geri çek → kapsam iner, bayat satır görünmez ve silinir, iz · F4 yeniden
kilitle → yeniden donar · F5 kural değişikliği benzetimi (türetme değişir) → kilitli dönemin Yevmiye / Hesap Planı Mizanı aynı, açık dönem yeni kuralla, Defter Mutabakatı ve Mutabakat
Testi "Kural Değişikliği Farkı", `ruleDiff` tutarları · F6 tetikleyiciler: UPDATE, DELETE (kapsam içi), INSERT OR REPLACE, kapalı koşuya satır, eski koşuya satır · F7 yarıda kesilme:
iş parçacığı / süreç öldürme (SIGKILL) dondurma sırasında → açılışta sürer, sonuç aynı; disk dolu → yarım koşu görünmez · F8 aynı anda iki kilit isteği; kilit sırasında yazım (kilitli
döneme 409, açık döneme 200) · F9 gün / yıl dönümü kilidi (31.12 / 01.01), iki saat dilimi · F10 fişli dönem (Ç2) kilitlenince fiş satırları donmuş defterde; postAll lockThrough tek işlem
· F11 v2.4.9 GERÇEK koduyla üretilmiş kilitli veri → göç → donmuş = 2.4.9 türetmesi, raporlar önce / sonra birebir · F12 eski sürüm (2.4.9 kodu) 47'lik dosyada kilidi açar / ilerletir /
sıfırlar → açılış onarımı · F13 Sıfırla (iki kip), yedek → geri yükle, iki şirket · F14 kaynak izi (dış yazım) · F15 hacim: 100.000 satırda kilit + dondurma süresi, olay döngüsü,
raporların kilitli / açık okuma süresi önce / sonra.

## 15. Kanıt (docs/kanit/2026-11-05/c3-*; her koşu tools/kanit.mjs kos)
- Testler: test/donmus-defter-250.test.mjs (13) + test/donmus-defter-yasam-250.test.mjs (7) = 20; yeni kodda 20/20 (UTC ve Europe/Istanbul). Kırmızı: eski kod a2796dd4 (`git archive`,
  ayrı kopya) 0/20 — nedenler "donmuş defter yok (ledger.snapshots)", "2.4.9 kural kopyası yok", "LOCK_SQL_VERSION yok" (c3-kirmizi-eski-a2796dd4).
- Dar liste (Ç2'nin 169 dosyası + Ç3'ün okuduğu yollar + kaynak tarayan genel testler = 191 dosya; 8c3a0436): UTC 2180/2181 — tek kırmızı platform-tasinabilirlik, kanıt betiğimdeki
  `new URL(import.meta.url).pathname` (Windows'ta kırılır; 26935fe5'te düzeldi, yeniden 6/6: c3-dar-UTC-platform); Europe/Istanbul 2181/2181 (00:00–03:00 İstanbul aralığında koştu).
  banka-210-onarim (v2.0.25 / v2.0.26 etiketleri getirildiği için bu kez ATLANMADI, koştu) ilk koşuda Ç3'ün "Donmuş Defter" bulgusunu engelleyici saydı → bulgu uyarı düzeyine alındı (§12a).
- e2e (8c3a0436 / 26935fe5): sema-kapisi-bs7 12/12 (LATEST + 1 = 48), senaryo-defter-243 24/24, senaryo-224 69/69, senaryo-226 22/22, senaryo-213 64/64, gg244-numara-tarih-onay 40/40,
  gg243-banka-kart-aciklama 11/11, senaryo-220-yedek 37/37, senaryo-banka-210 424/424. Kâhin defter 176/176, kâhin cari 8698/8698.
- Mutasyon (test/donmus-defter-250-mutasyon.mjs, `git archive HEAD` kopyası): 16 mutasyonun 16'sı beklenen nedenle yakalandı (c3-mutasyon-son + c3-mutasyon-son-15): karma okuma, satır kaybı ×2, kilit günü,
  kilit ↔ donma ayrışması, geri çekme izi, fark denetimi, göç kuralı, UPDATE / DELETE tetikleyicisi, sıfırlama, açılış onarımı, postAll kancası, kaynak izi, bayat satır, 2.4.9 kopyası.
- Eşdeğerlik: (1) v2.4.9 GERÇEK koduyla üretilmiş veri (motor tohum 11, 1.500 işlem; kilit 31.08.2026 v2.4.9'un ucuyla) → göç 47 → bekleyen 2.4.9 koşusu → donmuş = v2.4.9 türetmesi
  836 / 836 madde; 2.4.9 kopyası = v2.4.9 gerçek kodu 1.142 / 1.142 madde; kilitli yılın Yevmiye Defteri (1.359 satır) ve kilit gününe kadar bütün Yevmiye Defteri (1.913 satır) TAM satırlarıyla,
  Hesap Planı Mizanı (32 hesap) göçten önce / sonra birebir (yalnız 770 adı) — 17/17 (c3-esdegerlik-v249). (2) 2.0.26 zincir fikstürü (4 şirket; 001 göç koşusuyla, 002–004 uçla
  kilitlenerek): donmuş = canlı, karma = canlı, mizan yıl yıl, karma mizanın SQL yolu = canlı mizan, geri çek + yeniden kilitle — 48/48 (c3-esdegerlik-zincir). (3) aynı v2.4.9 verisinde
  bu kodla 12/12 (c3-esdegerlik-motor-v249).
- Gerçek kod kopyasıyla kural değişikliği (sürüm yükseltmesi): kilitli yılın Yevmiye Defteri ve Hesap Planı Mizanı birebir, açık dönem yeni kuralla, "Kural Değişikliği Farkı" 4 madde,
  ruleDiff tutarları, yeni kilit yeni etiketle, geri çek + yeniden kilitle → açılan dönem yeni kuralla — 14/14 (c3-kural-degisikligi).
- Eski sürüm (2.4.9 GERÇEK kodu) 47'lik dosyada kilidi ilerletir / kaldırır / Şirket Verisini Sıfırla (donmuş satırlar varken 200) → 2.5.0 açılış onarımı — 20/20 (c3-eski-surum-v249).
- Hız (aynı veri kopyası, flock, 226.734 para satırı / ~400.000 satır, kilit 31.12.2025 → 274.616 donmuş satır; taban a2796dd4 ↔ yeni; makine yükü JSON'da):
  | Yol | Taban | Yeni |
  |---|---|---|
  | Dönem kilidi (+ dondurma) | 9.491 ms, olay döngüsü 9.485 ms | 9.573 ms (parça 500), olay döngüsü en çok 30 ms (parça 1000: 7,4–8,0 sn, 28–69 ms) |
  | Kilidi geri çek | 8.981 ms, olay döngüsü 8.973 ms | 2.128–2.270 ms, olay döngüsü 53–61 ms (thaw işlemindeki SQL toplamı) |
  | Yevmiye Defteri, kilitli yıl | 2.280 ms | 707–755 ms (yalnız tablo) |
  | Yevmiye Defteri, açık dönem | 2.537 ms | 2.343–2.393 ms |
  | Hesap Planı Mizanı, kilitli yıl | 3.175 ms | 3.598 ms (medyan; ilk açılış +~0,55 sn donmuş SQL toplamı, sonra önbellekte) |
  | Açık döneme yazım (kilitten sonra) | 39 ms | 25–32 ms |
  Kilit ucu artık tam taramayı ana iş parçacığında koşmuyor (taban: kilit ve geri çekme boyunca bütün sunucu bekliyordu). Raporların canlı türetmesi (2–4 sn, olay döngüsünü kilitler) Ç3'ten
  önce de böyleydi — plan §8'in rapor bütçesi Ç6'nın işi.
- WINDOWS'A DUYARLI (ders 48; ilk gönderimde CI'nin Windows işlerinde görülmeli): test/donmus-defter-yasam-250.test.mjs F7a (dondurma sırasında ayrı süreç SIGKILL → TerminateProcess,
  öldürülen sürecin dosyası yeniden açılır), F13b (002 yedeğinden geri yükleme = dosya takası; dondurma iş parçacığının salt okunur tutamağı), test/fixtures/donma-isci.mjs; dondurma iş
  parçacığı (lib/ledger-freeze-worker.mjs) bağlantısını satırları göndermeden ÖNCE kapatır, ama iptal türetme sürerken gelirse terminate() ile kesilir (tutamağın bırakılması Node'a kalır).
- İKİNCİ BAĞLANTI AÇAN YOLLAR (ana oturum notu 23:0x, db.mjs PRAGMA sırası; düzeltme ayrı ajanda): (1) lib/ledger-freeze-worker.mjs — salt okunur `openDatabase(dbPath, { readOnly: true })`:
  PUT period-lock'ta ileri kilitte (koşu), açılışta bekleyen koşu varsa (göç 47'nin 2.4.9 koşusu, yarım koşu, onarım), kilit geri çekilince ya da dondurma bitmeyince yalnız iz için
  (`digestOf`); (2) testlerde: F7a ayrı süreç (ana sunucu kapalıyken), yaşam testinin ham okuma / yazmaları (`new DatabaseSync`, sunucu kapandıktan sonra), eski sürüm / eşdeğerlik
  betiklerinin ham okumaları (sunucular kapalı). Eşzamanlı ikinci bağlantı yalnız (1)'de; iş parçacığı salt okunurdur (WAL kipi ayarlamaz).

## 16. Ç3 tamamlama (06.11.2026): 1.000.000 satırda bellek taşması (ders 6, 15, 47)
- BULGU (yeniden üretildi; docs/kanit/2026-11-06/c3-olcum-cekirdek-1000000*.log, c3-yeniden-uret-1m-oncesi): programın ürettiği 1.000.000 verisinde (001: 2.254.506 para satırı, ~4 M satır)
  kilit konunca dondurma iş parçacığı Ana Defter'i türetirken yığın (~2 GB) doldu. Kimi koşuda bütün süreç `FATAL ERROR … StatementSync::All` ile çöktü (SIGABRT), kimi koşuda iş parçacığı
  "Worker terminated due to reaching memory limit" ile düştü (süreç ayakta; aynı dosya, aynı kod — taşmanın yerli kodun içine mi JS'e mi denk geldiği). Kalan durum: kilit konmuş
  (31.12.2025), koşu `pending`, 0 donmuş satır; açılışta bekleyen koşu sürdürülür (app.mjs runPending) → her açılışta aynı türetme, aynı sonuç (çökme döngüsü olabilir).
  Kilitsiz canlı türetme de (raporlar, kapının tam taraması) ana iş parçacığında aynı yerde çöküyordu (41. sn) — Ç3'ten önce de (v2.4.9 aynı sorgular).
- KÖK NEDEN (dosya:satır): routes/ledger.mjs:63 (rows() `all` yardımcısı → store.all) — node:sqlite'ın all()'ı her satırı SÖZLÜK KİPLİ nesne kurar (v8::Object::New + ad sözlüğü;
  18 kolonlu cari satırı ~1.349 bayt, hızlı kipli kopyası ~615 bayt; deney c3-tamam-a1). 1M'de account_entries (1.022.380 satır, :85) tek başına 1.475 MB; çöküş stock_moves (:126)
  sorgusunda. 2.4.9 kopyası (ledger-rule-249/ledger-rows.mjs) aynı sorgularla. Ek yükler: iş parçacığı bütün (from, through] satırlarını tek dizide kuruyordu; kilit izi (integrity.mjs
  lockDigestOf) kilitli dönemin bütün kaynak satırlarını store.all ile okuyordu; donmuş okuma (entries) ve Kural Değişikliği Farkı (ruleDiff) bütün donmuş satırları dizi + nesne olarak.
- DÜZELTME (davranış AYNEN): lib/lean-rows.mjs — leanRows / leanAll (iterate; aynı anahtar, sıra, değer; hızlı kipli düz nesne; kolon başına ≤ 65.536 farklı kısa metin tek kopya),
  leanStore (2.4.9 kopyası değişmeden sıkı depoyla okur), eachRow (kopyasız akış). rows() leanAll; kural kayıt defteri ve iş parçacığı buildRule249(leanStore(store)); snapshotBatches
  (iş parçacığı ve eşzamanlı kip satırları parça parça üretir); frozenEntries (donmuş okuma akışlı); ruleDiff donmuş tarafı akışlı (sonuç önceki uygulamayla birebir: B3 referans);
  lockDigestOf eachRow. İş parçacığının yığın taşması "Bellek yetmedi: …" (süreç ayakta, koşu bekler).
- EŞDEĞERLİK: 100.000 verisinde türetmenin sha256'sı store.all ↔ sıkı okuma, güncel kural ve 2.4.9 kopyası — 4 / 4 aynı (154.328 madde); 1M'de iki kural aynı sha256 (1.532.720 madde);
  test/donmus-defter-bellek-250.test.mjs B1 / B3 (eski sürüm verisi, madde madde, bütün alanlar); donmuş = canlı yıl yıl 100k (4 yıl) ve 1M (2022–2025: 74.955 / 383.454 / 385.331 / 384.686
  madde) — ölçüm aracı --esdeger; v2.4.9 eşdeğerliği 17/17, motor 12/12, zincir 48/48, kural değişikliği 14/14, eski sürüm 20/20, kâhin defter 176/176, kâhin cari 8698/8698.
- ÖLÇÜM (flock; makine YÜK ALTINDA, yük 0,7–4,7 — süreler son adayda boş makinede yinelenir; bellek yükten etkilenmez): tepe RSS süreç geneli (ana + iş parçacığı), VmHWM, her adımdan
  önce sıfırlanır (önceki adımın geri verilmemiş yığını sayılır). Son koşular c3-tamam-olcum-100k-yeni / -100k-eski-40ad9bed / -1m-yeni (+ -veri.json); yalnız dondurma
  c3-olcum-cekirdek-1000000-yeni-dondurma (--canli-yok; temiz tepe).
  | Yol | 100.000 eski (40ad9bed) | 100.000 yeni | 1.000.000 eski | 1.000.000 yeni |
  |---|---|---|---|---|
  | Canlı türetme (ana iş parçacığı) | 2,3–2,8 sn · 426 MB | 2,7–2,9 sn · 247 MB | ÇÖKTÜ (41. sn, yığın 2 GB) | 25,9–27,6 sn · 1.424–1.438 MB |
  | Kilit + dondurma (yalnız) | 7,8–8,2 sn · döngü 22–29 ms · 985 MB | 8,1–8,5 sn · döngü 19–30 ms · 503–539 MB | ÇÖKTÜ / "memory limit" (~85 sn) | 83,5 sn · döngü 457 ms (*) · 1.744 MB · 2.741.312 satır |
  | Kilit + dondurma (canlı türetmeden sonra) | — | — | — | 94,8 sn · döngü 305 ms (***) · 2.845 MB |
  | Donmuş okuma, kilitli yıl (S.entries) | 443–477 ms · 453–495 MB | 505–570 ms · 311 MB | (ölçülemedi) | 5,4–7,3 sn (döngü aynı) · 384.686 madde |
  | Hesap Planı Mizanı kilitli yıl (ilk) | 603–629 ms | 534–569 ms | — | 6,1–6,6 sn (sonra önbellek 1 ms) |
  | Kural Değişikliği Farkı (canlı türetme dahil) | 4,7–5,2 sn · 796 MB | 4,7–5,1 sn · 418 MB | — | 55–58 sn · 1.827–1.858 MB |
  | Kilidi geri çek | 484–492 ms · döngü 45–52 ms | 441–512 ms · döngü 45–49 ms | — | 4,6–5,8 sn · döngü 510–543 ms (**) |
  (*) tek boşluk: kilit işleminin kendisi — yeni kopyalanmış 2,5 GB dosyada İLK yazım işlemi (WAL / fsync; c3-tamam-betikler/diag-kilit: ilk setLock 338 ms, ikinci 3 ms, lockChanged 2–4 ms);
  dondurma boyunca 50 ms'yi aşan başka boşluk yok. (**) thaw()'ın geri çekilen dönem toplamı (tek SQL, ~900.000 satır; 100k'de 45–61 ms) — BİLİNEN SINIR / öneri aşağıda. (***) türetme
  sürerken ana iş parçacığının 305 ms'lik duraklaması: önceki adımın (ölçüm aracının ana iş parçacığında kurduğu 1,5 M maddelik canlı türetme) çöpünün toplanması; yazım parçalarında 55–105 ms
  (yük 4,1–4,7). Donmuş okuma 100k'de %14–20 yavaş (satır kopyası + tek kopya metin; bellek karşılığı).
- BELLEK SINIRLI DENEME (dişli; c3-bellek-sinirli-200mb-100k-*): `node --max-old-space-size=200` (iş parçacığına da uygulanır) + 100.000 verisi: yeni kod dondurmayı tamamlar (274.616 satır,
  tepe 290 MB), eski kod (40ad9bed) "Worker terminated due to reaching memory limit". Çökmüş 1M dosyası (kilit + bekleyen koşu) yeni kodla açılınca 95 sn'de tamamlandı (2.741.312 satır).
- KANIT (docs/kanit/2026-11-06/c3-tamam-*; düzeltme 9d507460): yeni testler B1–B5 (test/donmus-defter-bellek-250.test.mjs) eski kodda (40ad9bed, ayrı kopya) 1/5 — B1 / B2 lean-rows yok,
  B3 "güncel kural: kaynak sorguları store.all'a düşmemeli", B5 "buildRule249 sıkı depo olmadan çağrılıyor"; B4 eski kodda da geçer (parça parça yazım vardı) — iki saat diliminde; yeni
  kodda 5/5. Mutasyon 23/23 (16 eski + 2 ve 7 yeni yerlerinde + 17–23: rows store.all, 2.4.9 kopyası iki yerde sıkı depo olmadan, donmuş okuma store.all, sıkı satır kopyalanmaz, kilit izi
  store.all, akışlı fark denetiminin ikinci adımı). Komşular (G2: değişen dosyaları / uçlarını anan 242 dosya = öncülün 191'i + 51) UTC 2626/2626, Europe/Istanbul 2626/2626; e2e 9 senaryo
  (sema-kapisi-bs7 12, senaryo-defter-243 24, senaryo-224 69, senaryo-226 22, senaryo-213 64, gg244 40, gg243 11, senaryo-220-yedek 37, senaryo-banka-210 424).
- BİLİNEN SINIR / ÖNERİ: (1) türetme hâlâ bütün geçmişi bellekte kurar (iki kural kopyası AYNEN kalsın diye; 1M'de ~1,4 GB, yığın sınırının ~%70'i) — bundan büyük veride ya da az
  bellekli bilgisayarda iş parçacığı yine taşabilir (süreç çoğunlukla ayakta, ama taşma yerli kodun içine denk gelirse V8 süreci düşürür); kalıcı çözüm parçalı türetme (Ç6, ölçümle).
  (2) Kilidi geri çekme 1M'de olay döngüsünü ~0,5 sn tutar (öneri: geri çekilen dönemin toplamı işlemden önce iş parçacığında; ya da gün toplamları tablosu). (3) Raporlar ve tam tarama
  ana iş parçacığında: 1M'de Yevmiye Defteri kilitli yıl 5,4 sn, Hesap Planı Mizanı ilk 6,6 sn, Kural Değişikliği Farkı (açılış taraması, Mutabakat Testi, Defter Mutabakatı) ~28 sn
  akış + canlı türetme — plan §8 rapor bütçesi Ç6'nın işi (rapor iş parçacığı). (4) Büyük veride açılış (repairOwnCards) dakikalar — Ç3 dışı, AH.

## 17. Ç3 tur 1 (06.11.2026): dar kontrol bulgularının düzeltmesi — kanıt
Kaynak: iş listesi E "06.11 03:08 Ç3 DAR KONTROLÜ BİTTİ" (YÜKSEK 0, ORTA 3, DÜŞÜK 3) ve KARAR. Taban 10ed14cf (Ç3 2ba5ac0b'de birleşik). Dosya sınırı: yalnız lib/ledger-snapshots.mjs + testler
+ bu not; routes/ledger.mjs, app.mjs, ledger-vouchers.mjs, migrations.mjs (Ç2 tur 1) ve kilit ucu (DÜŞÜK-1, PUT bekleme / ilerleme: Ç3 tur 2) dokunulmadı. Commit'ler 1f9ffb69
(düzeltme + testler), 2b0e57f1 / cd7ca1a3 (ara dilim karşılaştırmasının hızı), 8523e126 (test iletisi). Kanıtlar docs/kanit/2026-11-06/c3t1-* (her koşu tools/kanit.mjs kos).

### Yapılanlar
- ORTA-1 (§9): donmuş mizan önbelleği son tamamlanan koşunun kimliğiyle (`frozenTrial`).
- ORTA-2 (§7): açılış onarımı önce görünen donmuş satırları kayıtlı toplamlarla karşılaştırır (`damagedFrom`). Tutmazsa kapsam sağlama noktasına iner; geri çekmenin toplamı ölçülür.
  Kilitli dönem GAP_RULE ile yeniden donar (S13 = A). Eksik satır iletisi ayrı (§8).
- ORTA-3 + aile (§4, §7):
  - Aynı güne yeniden kilitte bekleyen koşu kuralı ne olursa olsun sürer.
  - Eski kurallı bekleyen koşu kilit başka güne gidince de güncel kurala geçmez (`carryLock`, `continueAfter`, `ledger.snapshot.extended`). Eşzamanlı kip de aynı kuralla.
  - Açılış onarımı eski kurallı koşuyu korur.
  - Bilinmeyen kuralın koşusu bekler; görünür bulgu olur ("Dondurma Bekliyor"); eşzamanlı kilit düşer.
- K4 (§8): `ruleDiffHint` nedene göre / tarafsız; denetim adları Yazım düzeninde.
- DÜŞÜK-3 (§9): kilitli yılın Yevmiye Defteri bekleyen kuralla tek türetme; ara dilim koşu başına bir kez (veri sürümü + kendi yazımları hariç total_changes); "aynı" bilgisi parmak
  iziyle; işlem içinde saklanmaz.
- §5 kural sürümü kuralı + `RULE_HISTORY` + kayıt defteri denetimi.

### Testler ve kırmızı / yeşil (ders 7, 38)
- test/donmus-defter-tur1-250.test.mjs (12).
  - Eski kod 10ed14cf (ayrı kopya): UTC 0/12, Europe/Istanbul 0/12 (c3t1-kirmizi-eski-10ed14cf-*). İletilerdeki nedenler:
    - "mizan eski veriyi gösteriyor (önbellek): 1000 ≠ canlı 5000";
    - "bekleyen 2.4.9 koşusu aynı güne yeniden kilitte bırakıldı";
    - "ilerletilen / eşzamanlı kilit eski kurallı dönemi güncel kurala geçirdi";
    - "bilinmeyen kuralın bekleyen koşusu güncel kurala geçti";
    - "Yazım düzeni (parantez içi)";
    - "RULE_HISTORY yok" (varlık; diş mutasyon 39 / 40'ta);
    - "göç penceresinde kilitli yılın Yevmiye Defteri güncel türetme de kurdu";
    - "kilitli yılın Yevmiye Defteri boş donmuş defterden okunuyor (0 satır, canlı 12)";
    - "eski kapsamın satırı kayıp";
    - "son koşunun satırları eksik okunuyor (6 / 12)";
    - "bekleyen 2.4.9 koşusu ilerletilen kilitte bırakıldı".
  - Yeni kod: 12/12, iki saat diliminde.
- test/donmus-defter-eski-sifirla-250.mjs (v2.4.9 GERÇEK kodu, `git archive v2.4.9`; dar kontrolün p5 / p5b'si; G6).
  - Eski kod: 6/18; ön koşullar geçer, 12 kırmızı (Yevmiye 0 / 2 satır, Kasa yok, Mutabakat Testi "Donmuş satırlar eksik").
  - Yeni kod: 18/18 UTC ve Europe/Istanbul.
- Dar kontrol betikleri yeniden üretildi (iki TZ).
  - Eski kod: p1 "1000 ≠ 5000", p10 "2.5.0 kuralıyla dondu", p5 / p5b "HATA".
  - Yeni kod: p1 tutarlı, p10 "2.4.9 kuralıyla dondu", p5 / p5b "raporlar dolu" (Yevmiye 2 satır, Kasa 7.777, Mutabakat Testi tutarlı).
- Mevcut testler, yeni kodda (c3t1-yeni-*): tur1 + donmus-defter-250 + yaşam + bellek 37/37, iki TZ. Ayrıca:
  - eski sürüm v2.4.9 20/20;
  - kural değişikliği (gerçek kod kopyası) 14/14;
  - v2.4.9 eşdeğerliği 17/17 (G6; v2.4.9 dökümü önceki turun eski.json'u), motor 12/12, zincir 48/48;
  - kaynak tarayan genel testler 67/67.
- Komşular (G2): Ç3 tamamlamanın 242 dosyası + yeni test = 243 dosya. test/ taraması (ledger-snapshots, period-lock, hesap-mizani, yevmiye, defter-mutabakati, ledger/integrity,
  ledger_snapshot, donmus-defter-*, fis-defteri-*, sema-kapisi-bs7, kaynak tarayan genel testler) 109 dosya çıkardı, hepsi listede. Sonuç UTC 2639/2639, Europe/Istanbul 2639/2639
  (c3t1-komsu-*).
- e2e (cd7ca1a3, 13 senaryo, hepsi GEÇTİ — c3t1-e2e-*):

  | Senaryo | Adım |
  |---|---|
  | sema-kapisi-bs7 | 12 |
  | senaryo-defter-243 | 24 |
  | senaryo-224 | 69 |
  | senaryo-226 | 22 |
  | senaryo-213 | 64 |
  | gg244-numara-tarih-onay | 40 |
  | gg243-banka-kart-aciklama | 11 |
  | senaryo-220-yedek | 37 |
  | senaryo-banka-210 | 424 |
  | gg244-secilenleri-gonder | 45 |
  | gg243-tumunu-gonder | 17 |
  | senaryo-fatura-243 | 61 |
  | gg243-dar2-ekran | 21 |

  İlk 9'u Ç3'ün listesi; son 4'ü dönem kilidini anan senaryolar.
- G3: eski testlerin beklentisi DEĞİŞMEDİ (`git diff --diff-filter=M 10ed14cf..` test/'te yalnız mutasyon betiği: 24–46 ve TUR1 tabana eklendi).
- Mutasyon (test/donmus-defter-250-mutasyon.mjs; 24–46 eklendi, taban dört dosya):
  - 1f9ffb69 kopyasında 46'nın 45'i. Kaçan 34'tü: test yakaladı ama iletisi nedeni adlandırmıyordu ("[]"); ileti düzeltildi.
  - Son kod cd7ca1a3 kopyasında 24–46: 23/23.
  - 1–23'ün hedefleri bu turda değişmedi.

### Ölçüm (flock, aynı veri kopyası: c3-olcum-veri; ders 15, 47)
Önce = 10ed14cf, sonra = cd7ca1a3. Göç / onarım penceresi: kilit 31.12.2025 eski sürümden, bekleyen 2.4.9 koşusu, dondurma çalışmıyor. Olay döngüsü en çok = monitorEventLoopDelay
ile 10 ms setInterval'ın büyüğü (ısınmalı); çağrılar eşzamanlı olduğundan ≈ süre. Makine yük altında (yük 2,6–7,2; JSON'da). Çıktının sha256'sı önce = sonra.

| Yol | 100.000 önce | 100.000 sonra | 1.000.000 önce | 1.000.000 sonra |
|---|---|---|---|---|
| Hesap Planı Mizanı 2025 — 1. okuma | 5,2 sn | 6,4 sn (yük 6,9) | 78,5 sn | 68,3 sn |
| Hesap Planı Mizanı 2025 — 2. okuma | 5,5 sn | 3,4 sn | 62,1 sn | 29,8 sn |
| Yevmiye Defteri 2025 — 1. okuma | 5,0 sn | 3,2 sn | 70,7 sn | 27,8 sn |
| Yevmiye Defteri 2025 — 2. okuma | 4,8 sn | 3,4 sn | 62,2 sn | 28,4 sn |
| Tepe RSS | 375–834 MB | 375–821 MB | 2.118–2.161 MB | 1.798–2.147 MB |
| Dondurma (iş parçacığı) | 8,8 sn · döngü 46 ms | 9,2 sn · döngü 79 ms | 77,3 sn · döngü 142 ms | 96,7 sn · döngü 300 ms |
| Açılış onarımı (tutarlı defter) | 0 ms | 150–289 ms | 0–1 ms | 1.613–1.662 ms |

- Kilitsiz tek türetme 1 M'de: mizan 27,9 sn, Yevmiye 25,3 sn (dar kontrol p8). Penceredeki 2. okumalar ve Yevmiye'nin 1. okuması tek türetmeye indi.
- Mizanın 1. okuması iki türetmeyi kurar (ara dilim kurulur). Karşılaştırma maliyeti 100.000'de: sameEntries 0,25 sn, parmak izi 0,11 sn (profil-karsilastir). 1. okumadaki fark yük
  gürültüsü içinde.
- Dondurma kodu değişmedi (iş parçacığı aynı; ana iş parçacığında yalnız yazım sayacı). 77 / 97 sn ve 142 / 300 ms yük ve önceki adımın çöpü (§16 (***)) içinde; §16'da 83,5–94,8 sn.
- Açılış onarımının bedeli `damagedFrom`'un tek toplam sorgusudur: 2.741.312 donmuş satırda 1,6 sn, ana iş parçacığında, açılışta. BİLİNEN SINIR / ÖNERİ aşağıda.

### Windows'a duyarlı (ders 48)
test/donmus-defter-tur1-250.test.mjs "ORTA-2 / ORTA-3 açılış" bölümü (4 test) sunucuyu kapatır, dosyayı ham bağlantıyla (`DatabaseSync`) değiştirir (audit_events + ledger_snapshots
silme, kilit ayarı), yeniden açar. Açılış onarımı satırları aynı işlemde siler ve yeniden yazar. "Yarıda kesilme" testi dondurma iş parçacığını parça yazımında keser (kanca), sunucuyu
kapatıp yeniden açar. İlk gönderimde CI'nin Windows işlerinde görülmeli. test/donmus-defter-eski-sifirla-250.mjs CI'de koşmaz (--eski kopya ister).

### BAŞ MİMAR KARARLARI, KULLANICIYA SORULMALI, BİLİNEN SINIR
- BAŞ MİMAR KARARLARI: §12 "Tur 1" (a)–(d) ve K1 notu.
- KULLANICIYA SORULMALI: yok. S13 yanıtlandı (A); yeni para / kapama / kural seçimi açılmadı.
- BİLİNEN SINIR:
  - Penceredeki ilk mizan okuması hâlâ iki türetme (1 M ~68–78 sn, olay döngüsü kilitli). Kalıcı çözüm rapor iş parçacığı (Ç6, plan §8).
  - Farklı kurallı ara dilim 200.000 maddeden büyükse saklanmaz.
  - Açılış onarımının toplam sorgusu 1 M'de 1,6 sn. Öneri (2.5.1): açılışta yalnız sayım; tam toplam 15 dakikalık taramada.
  - Eksik satır onarımı ilerletme izini bırakır: eksik dönemin tamamı GAP_RULE ile donar (S13 kapsamı).
  - Bilinmeyen kuralın koşusu bekledikçe o dönem güncel kuralla okunur (görünür bulgu).
  - routes/report-center.mjs:719 alt başlığı hâlâ "Defter kuralı program sürümüyle değişti" diyor (dosya sınırı; §8).
