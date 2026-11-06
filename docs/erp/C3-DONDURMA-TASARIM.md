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
    bekliyor mu — değilse durur); son küçük işlem sayıyı ve toplamları doğrular, koşuyu `done` yapar, izi (`ledger.snapshot.frozen`) yazar. Uç işin bitmesini BEKLEMEZ (Ç3 tur 2, §18:
    kilit + koşu yazılınca yanıt; dondurma arkada); ilerleme `ledger.freeze.progress` olayıyla ve `GET /api/workspace/ledger/lock` (`freeze`: pending, active) ile.
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

## 18. Ç3 tur 2 (06.11.2026): kilit ucunun sırası ve arkada dondurma (dar kontrol DÜŞÜK-1 → ORTA; plan §8 "1.000.000: hedef ≤ 2 dk, İLERLEME")
Ürün SON: 7f5c4170 (ara commit'ler 25d0f145 → 4bf815ea → 34b901b2 → 7f5c4170; nedenleri aşağıda "TASARIMIN YOLU"); test 57a41e80 … 8f9e767d; araç 9dda14d4; taban 40473f17. Kanıt
docs/kanit/2026-11-06/c3t2-* (OKU-BENI).
- YENİDEN ÜRETİM (ders 6; taban 40473f17, `git archive` ayrı kopya):
  (a) DÜŞÜK-1 (dar kontrol betiği p7; bekleme döngülü p7b, iki TZ): dondurma sürerken `lockedUntil: "2099-01-01"` → 400 "Gelecekteki bir dönem kilitlenemez."; süren dondurma "durdu",
  kapsam boş, koşu bekliyor, sürdüren yok. Kök neden routes/ledger.mjs PUT: `cancel()` doğrulamadan (setLock işlemin içinde) ÖNCEydi; POS ön adımı da doğrulanmamış tarihle çalışıyordu.
  (b) PUT bekleme: 1.000.000 verisinde (001: 2.254.506 para satırı) gerçek routes/ledger.mjs ucu + gerçek yönlendirici + gerçek HTTP; istemci 30 sn'de keser (hof-core.js sendApi
  timeoutMs): istemci 30.003 / 30.004 ms'de "Sunucu zamanında yanıt vermedi. (client-timeout)"; sunucu kilidi koymuş, 79–92 sn'de dondurmuş (2.741.312 satır) — başarılı kilit ekranda
  hata. createApp ile 1.000.000 açılışı 22 dakikada bitmediği için (Ç3 dışı bulgu AH, repairOwnCards) çekirdek kip; 100.000'de gerçek sunucu (createApp) PUT 7,7–8,4 sn.
- SIRA (routes/ledger.mjs PUT period-lock): doğrula (`period.checkLock` — setLock ile AYNI kural, yazmadan; setLock da onu çağırır) → ön adım (`beforeLock`: POS) → başka güne süren
  dondurmayı durdur (`cancel`) → bayat satırlar → kilit + koşu (tek işlem) → iz "bekliyor" (`adoptLock` null) → arka iş (`afterLock`) → YANIT (arka iş bitince, en çok 5 sn).
  Reddedilecek istek (400 geçersiz / gelecek tarih, 409 POS) hiçbir şeye dokunmaz (K1, K2). Durdurduktan sonra kilit işlemi düşerse (kapı 409, disk) durdurulan koşu sahipsiz kalmaz:
  `afterLock(mevcut kilit)` onu arkada sürdürür (K3).
- ARKA İŞ (`afterLock`, `lockJobs`): iki iş PARALEL — (1) kapının kilit izi ayrı iş parçacığında (`snapshots.digestOf`); (2) bayat satırlar (`purgeStale`) → bekleyen koşu
  (`runPending`; dondurmanın kendi izi de gelince freezeRun `adoptLock` karşılaştırır, fark Mutabakat Günlüğü'ne §4). Bu arada kilit başka güne alındıysa iz benimsenmez. İş düşerse yanıt
  düşmez: günlükte uyarı; koşu bekler, sonraki kilitte / açılışta sürer.
- YANIT BÜTÇESİ (BAŞ MİMAR KARARI önerisi T2-2; `LOCK_WAIT_MS` = 5 sn): yanıt arka işi (iz + dondurma) en çok 5 sn bekler. KISA iş (küçük / orta şirket) bütçe içinde biter: yanıt bitmiş
  dondurmayla — ESKİ DAVRANIŞ AYNEN (yanıttan sonra veri tabanına arka yazım yok, kapının izi hazır). UZUN iş (1.000.000) bütçe dolunca yanıt; dondurma arkada, kart ilerleme gösterir;
  istemcinin 30 sn sınırı aşılmaz. KARAR metni "kilit + koşu yazılınca yanıt verir" idi: harfiyen uygulanınca (4bf815ea) iki gerileme G2 komşu taramasında YENİDEN ÜRETİLDİ:
  (i) test/banka-210-gg-kapi D8 "kilitli satırın kimliğini değiştir → 409": 40473f17 2/2, 4bf815ea 0/2 — iz "bekliyor"ken tam kapı kilitli dönemin iz karşılaştırmasını (ikinci katman)
  yapamaz; kapsam süzgecinin kilit nedeni dışından gelen kilitli satır değişikliği kabul edilir ve kendi (değişmiş) izini benimser. (ii) test/banka-230-supheli-bozma I/J kilitten hemen
  sonra sayıların fotoğrafını çekip "hiçbir şey yazılmaz" der; dondurmanın izi (audit_events +1) fotoğraftan sonra yazılıyordu (34b901b2'de kırmızı). Gerekçe: eski testlerin
  beklentisini değiştirmek (G3) yerine kısa dondurmada eski sözleşme korunur; yalnız uzun dondurma (planın derdi: 30 sn sınırı) arkaya geçer. İz dondurmayla paralel ölçüldüğü için
  100.000'de iz (~2,6 sn) bütçe içinde gelir (dondurma ~8 sn sürse de ikinci katman yanıttan önce hazır).
- TASARIMIN YOLU (ders 6, 40 — kayıt için): 25d0f145 "iz önce" (yanıt izi sınırsız bekler) gerekçesi YANLIŞTI ("kilitli fişin Ters Kaydet'i iz beklerken 409" — yeniden üretilince 200;
  bugün tarihli ayna fiş kapsam süzgecinin kilit sınıfında değil) ve 1 M'de yanıt 29,1 sn → geri alındı (4bf815ea, harfiyen: yanıt kilit + koşu yazılınca). G2 taraması (i)'yi buldu
  → iz paralel + 5 sn bütçe (34b901b2); (ii)'yi buldu → bütçe bütün arka işe (7f5c4170). Test K8 Ters Kaydet'in dondurma sürerken 200'ünü korur.
- KAPANIŞ: `server.app.ledger.snapshots.close` routes/ledger.mjs'te sarılır — süren dondurmayı durdurur (`snapshots.close`) VE arka işi (iz + dondurma) bekler (iz iş parçacığı dosyayı
  tutarken bağlantı kapanmaz; Windows'ta geri yükleme / silme dosya takası, ders 48; test K7). Öbür iç API aynen.
- YANIT BİÇİMİ (geriye uyumlu; alan eklendi): PUT ve GET /api/workspace/ledger/lock → `freeze` = `snapshots.status()` + `pending` ({ no, from, through, rule } | null) + `active`
  (süren iş: dondurma, bayat satır temizliği, kilit izi). PUT'un `frozenThrough`'u yanıt anındaki kapsamdır (kısa işte kilit; uzun işte önceki kapsam; geri çekmede yeni kapsam).
  ÇAĞIRANLAR (G4, test/ ve tools/ tarandı): admin.js (kart, aşağıda); test/fixtures/donma-bekle.mjs (`waitForFreeze` / `lockAndWait`: GET → `freeze.active` düşene kadar);
  donmus-defter-250 / -yasam-250 testleri ve -esdegerlik / -eski-surum / -kural / -olcum betikleri, tools/kapi-olcum.mjs (uçtan sonra kapsamı / satırları okuyan ya da dosyayı kapatıp
  dışarıdan değiştiren her adım bekler — büyük veride bütçe dolabilir); muhasebe sürücüsü (yanıttaki `frozenThrough`'u yalnız kayda yazar, gerileme.py "kilit" alanını karşılaştırmaz —
  değişmedi); Ç2 `postAll(lockThrough)` DEĞİŞMEDİ (eşzamanlı kip: kilit + fiş + donmuş satırlar aynı işlemde; ön adımı aynı `beforeLock`).
- ARADA (uzun işte; K1 kararı sürer): kilit konmuştur (bütün yazma yolları kilitli tarihi 409 period-locked ile reddeder); kilitli dönem bekleyen koşunun kuralıyla canlı okunur (raporlar
  aynı, test K4); iz bütçe içinde geldiyse ikinci katman çalışır (K4); açık döneme yazım ve kilitli fişin bugün tarihli Ters Kaydet'i 200 (K4, K8).
- İSTEMCİ (client/assets/admin.js, Yönetim → Sistem → Dönem Kilidi ve Mutabakat): kart `freeze`'e göre yazar — sürerken "… ve öncesi kilitli. Kilitli dönemin defteri donduruluyor
  (N satır yazıldı)… Bu sırada çalışmaya devam edebilirsiniz."; düşünce "… Kilitli dönemin defteri dondurulamadı (<neden>). Kilit yerinde; kilidi yeniden kaydedin ya da programı
  yeniden açın, dondurma yeniden denenir." (sarı); koşu bekliyor ama süren iş yoksa "… dondurulmayı bekliyor; …". Sürerken ARKA PLAN isteğiyle yoklar (ilk 0,5 sn, sonra 1,5 sn),
  bitince / düşünce durur, 5 ardışık yoklama hatasında durur; bir yoklama dondurmayı sürerken gördüyse bitişte "Kilitli dönemin defteri donduruldu." bildirimi. Mutabakat Testi
  yoklamada yeniden koşmaz (1 M'de tam tarama ~30 sn). Yalnız Yönetim panelinde; ana uygulamada istek yok (senaryo-222 "toplam istek ≤ 50" etkilenmez). Metinler cümle düzeninde
  (Yazım düzeni: bildirim / durum cümlesi). Kılavuz DEĞİŞMEDİ (kart kendisi anlatıyor; kılavuzun "Dönem kilidi" maddesi doğru kalıyor) → PDF üretilmedi. e2e
  test/e2e/senaryo-donem-kilidi-ilerleme-250.mjs (ci.yml + release.yml + package.json).
- BİLİNEN SINIR: (1) 1.000.000'da (iz ~29 sn paralel) yanıttan sonra ~25 sn kapının izi bekler: o arada kilitli döneme dokunan yazım "dönem kilidi yeni kondu" ile reddedilir (zaten kilitle
  yasak olanlar) ve kapsam süzgecinin kilit nedeni dışından gelen kilitli satır değişikliği ikinci katmanı görmez (D8 sınıfı; yalnız store dışı / iç yollar); dondurmanın izi (veri ~80 sn)
  benimsenince fark Mutabakat Günlüğü'ne yazılır. Kalıcı çözüm önerisi: dondurma iş parçacığı kaynak izini türetmeden ÖNCE ölçüp erkenden göndersin (ledger-freeze-worker.mjs +
  ledger-snapshots.mjs — tur 1'in dosyaları, bu turda dokunulmadı) — ikinci iş parçacığı gereksizleşir. (2) İz ve dondurma aynı veriyi paralel okur (yük altında dondurma uzar).
  (3) Kısa / uzun ayrımı süreye bağlıdır (5 sn): çok yavaş makinede küçük şirketin dondurması da arkaya geçebilir (davranış doğru kalır; yalnız yanıt sözleşmesi uzun işinki olur).
  (4) Dondurma sürerken kapanış (program kapatma, geri yükleme) dondurmayı durdurur; koşu açılışta sürer (§7) — tasarım gereği. (5) Kart "donduruldu" bildirimini yalnız bir yoklama
  dondurmayı SÜRERKEN gördüyse verir (zamanlamaya bağlı).
- ÖLÇÜM (test/donmus-defter-kilit-ucu-olcum-250.mjs; flock scratchpad/olcum.lock, her koşu taze kopya; programın kendi verisi tools/kapi-olcum.mjs --yalniz-kur; 4 çekirdek; makine YÜKÜ
  başka ajanlar yüzünden değişken — her satırda yazılı; süreler son adayda boş makinede yinelenir). İstemci 30 sn'de keser (sendApi). Olay döngüsü 5 ms'lik yoklayıcı; pencereye yalnız
  pencere açıldıktan sonra başlayan boşluk yazılır (ilk araç sürümü kurulumun boşluğunu pencereye taşıyordu — düzeltildi).
  | Yol | Eski (40473f17) | Son (7f5c4170) |
  |---|---|---|
  | 100.000 gerçek sunucu (createApp; 226.734 para satırı) — kilit yanıtı | 7.728 / 8.425 ms (dondurmayı bekler; yük 3,2–3,7) · döngü 16–19 ms | 5.017 / 5.030 ms (bütçe; iz içinde) · döngü 13 / 20 ms (yük 6,9–7,8) |
  | 100.000 — dondurmanın bitişi | = yanıt | 11.173 / 13.253 ms arkada (yük 7–8) · döngü en çok 27 / 47 ms · 50 ms üstü boşluk 0. Yük ~3'te (aynı iş, 4bf815ea / 34b901b2): 8,1–8,7 sn, döngü 24–65 ms |
  | 1.000.000 çekirdek (gerçek uç + HTTP; 2.254.506 para satırı) — kilit yanıtı | YOK: 30.003 / 30.004 ms "Sunucu zamanında yanıt vermedi" (yük 3,3–4,3) | 5.054 ms (bütçe) · döngü 35 ms (yük 9,7) |
  | 1.000.000 — kilit izi / dondurmanın bitişi | — / 79,3–91,6 sn (kullanıcı bilmiyor) | iz 35,6 sn · dondurma 122,3 sn (yük 9–10; yük ~3'te 4bf815ea: 79,6 sn) · döngü en çok 75 ms (5 boşluk > 50 ms) · yoklama 116 (en uzun 77 ms) |
  | Ara tasarımlar (kayıt) | — | 4bf815ea (yanıt hemen): 100.000 15 / 20 ms, 1.000.000 82 ms; 25d0f145 (iz sınırsız): 100.000 2.646 ms, 1.000.000 29.132 ms |
  Plan §8: "100.000 kilit + dondurma ≤ 10 sn" yük ~3'te KARŞILANDI (8,1–8,7 sn), yük 7–8'de AŞILDI (11,2 / 13,3 sn; boş makinede son adayda yinelenir); "olay döngüsü ≤ 50 ms" 100.000'de
  KARŞILANDI (27 / 47 ms; yük ~3'te bir koşuda 65 ms); "1.000.000 hedef ≤ 2 dk, İLERLEME": yük ~3'te 79,6 sn KARŞILANDI, yük 9–10'da 122 sn (sınırda); yanıt 30 sn sınırının altında
  (5,05 sn), kartta ilerleme. 1.000.000'da olay döngüsü dondurma sürerken 75–116 ms (yük altı; §16'daki 55–105 ms ile aynı aile) — BİLİNEN SINIR.
- TESTLER / KANIT (docs/kanit/2026-11-06/c3t2-*; her koşu tools/kanit.mjs kos):
  - Yeni test/donmus-defter-kilit-ucu-250.test.mjs K1–K9 (+ değişen donmus-defter-250 / -yasam-250): son kodda 29/29 TZ=UTC ve TZ=Europe/Istanbul (c3t2-yeni-utc / -istanbul).
    Dondurma kancayla TUTULUR (süre değil — ders 20: iz 3 sn sürünce süreli dondurma uçtan önce bitiyordu, zorla üretildi c3t2-zorla; ZORLA_IZ_MS=3000 ile K1–K7 7/7).
  - Kırmızı (ders 7, 38): eski kod 40473f17 ayrı kopyada 1/9 iki TZ (c3t2-kirmizi-eski-40473f17-*): K1 "reddedilen istek süren dondurmayı durdurdu (… running false, phase durdu)",
    K3 "durdurulan koşu sahipsiz kaldı", K4 "uç dondurmayı bekledi (… 20.004 ms)", K9 "iz bütçesi dolunca yanıt (~5 sn; 20.008 ms)" — BEKLENEN NEDENLE; K5 / K6 / K7 / K8 eski kodda
    ön koşul ya da alan yokluğuyla kırmızı (kanıt sayılmaz; dişleri mutasyonla); K2 eski kodda da yeşil (davranış doğruydu; dişi mutant 202). p7b (dar kontrol betiği): yeni 1/1, eski 0/1 iki TZ.
  - Mutasyon (test/donmus-defter-250-mutasyon.mjs; 23 + 201–209): 32/32 beklenen nedenle, taban 34/34 (c3t2-mutasyon). Mutant 201 ilk koşuda POS denetimiyle yakalanıyordu (kurtarma
    yolu durdurulan koşuyu yeniden açıyor, "dondurma sürüyor" geçiyordu) → K1'e "baştan başlamadı" denetimi; 205 / 206 bütçe tasarımında yaşıyordu → K7 / K5'e iz tutma.
  - G2 komşular (162 dosya: period-lock / ledger/lock / frozenThrough / snapshots / createPeriod / setLock / routes/ledger / admin.js anan + kaynak tarayan + Ç3 / Ç2 / BS-7 testleri):
    TZ=UTC 1.841/1.841 (c3t2-komsu-utc; koşu 3a4737a5'te başladı, 66480b5f / 4af0aafc koşu sırasında girdi — yalnız kapanış satırı + K testi; K testleri ayrıca son kodla); bu tarama
    D8 ve I/J gerilemelerini buldu (yukarıda). TZ=Europe/Istanbul (son kod 4af0aafc) 1.840/1.841 (c3t2-komsu-istanbul): tek kırmızı banka-210-rapor-is-parcacigi-kapanis H2
    "sorgusu süren iş parçacığı yuvada: 0" — bu turun farkına dokunmayan rapor iş parçacığı testi (report-runner; 100 ms zaman aşımı iş parçacığı SQL'e başlamadan dolunca terminate işler,
    yuva boşalır). Koşu sırasında makine yükü 13–15 (4 çekirdek). Aynı dosya İstanbul'da 3/3 yeşil (c3t2-rapor-is-parcacigi-istanbul-1..3); ZORLA (ders 20; 8 meşgul döngüyle CPU açlığı):
    son kodda 2/3, eski kod 40473f17'de 3/3 aynı iletiyle kırmızı (c3t2-zorla/rapor-is-parcacigi-zorla.txt) → önceden var olan test yarışı, ürün değil, bu turun gerilemesi değil.
    Pencere zorlama (ders 20): HOF_TEST_DONMA_GECIKME_MS=6000 (> LOCK_WAIT_MS; dondurma bitişi 6 sn gecikir, kilit yanıtı dondurma bitmeden gelir) dönem kilidi koyan 37 komşu
    dosyada 583/583 (c3t2-komsu-utc-gecikme6000). Gecikme yalnız startTestServer'da işler (createApp'i doğrudan açan 19 dosyada ön koşul OLUŞMAZ — onlar için kanıt değil); bu yüzden
    startTestServer kullanan 18 dosya, her kilit PUT yanıtının freeze.active'ini sayan bir ön yüklemeyle (onkosul-yukle.mjs, yalnız fetch sarar) yeniden koşuldu: 347/347
    (c3t2-komsu-utc-gecikme6000-onkosul); 120 PUT'un 109'u 200, bunların 57'si dondurma SÜRERKEN yanıtlandı (ön koşul 18 dosyanın HER BİRİNDE en az bir kez oluştu; ham
    c3t2-ham/onkosul-6000.jsonl). (1.500 ms ilk düşünülmüştü; bütçe içinde kaldığı için pencereyi açmıyor, koşulmadı.)
  - e2e 12 senaryo (c3t2-e2e-*): senaryo-donem-kilidi-ilerleme-250 22/22, senaryo-222 60/60 (istek sayısı), senaryo-213 64/64, senaryo-224 69/69, senaryo-226 22/22, gg243-banka-kart-aciklama
    11/11, gg244-numara-tarih-onay 40/40, senaryo-form-izolasyon-243 188/188, sema-kapisi-bs7 12/12, senaryo-defter-243 24/24, senaryo-220-yedek 37/37, senaryo-banka-210 424/424.
  - WINDOWS'A DUYARLI (ders 48; CI'nin Windows işlerinde görülmeli): K7 (dondurma + iz arkadayken kapanış, aynı dosyayı yeniden açma), yasam F7a / F13b (değişmedi; şimdi lockAndWait).

## 19. Ç3 tur 3 (06.11.2026): birleşik Ç3 tur 1-2 dar kontrolünün bulguları + S46 = A + Ç3 küçük işler
Kaynak: iş listesi E "06.11 09:49 BİRLEŞİK Ç3 TUR 1-2 DAR KONTROL BİTTİ" (YÜKSEK-1, ORTA-1, ORTA-2 → S46, DÜŞÜK-1; DÜŞÜK-2 → 2.5.1) ve KARAR (BAŞ MİMAR; DURMA KURALI). Taban 834cd0ad
(sınama birleşimi: ana dal + Ç3 tur 2). Kanıt docs/kanit/2026-11-06/c3t3-* (her koşu tools/kanit.mjs kos). Bu bölüm §4 (bayat satırlar), §7 (eksik satırda yeniden donma kuralı) ve §8'deki
"AÇIK (dosya sınırı)" notunun yerine geçer.

### Yapılanlar
- YÜKSEK-1 (dar kontrol p1 / p3 / p5; 100.000'de 20.500 satır kayıp): kök neden routes/ledger.mjs afterLock'taki koşulsuz `purgeStale()` — aynı güne yinelenen kilidin arka işi süren
  dondurmanın yazdığı satırları "bayat" sayıp siliyordu (kapsamın üstündeki her satır), `complete()` satır sayısını kendi sayacından yazıyordu → donmuş defter eksik, rapor sessiz.
  - Yazılan koşu korunur (lib/ledger-snapshots.mjs `writing`, `keptRun`): iş parçacığı kipinde koşunun bu denemedeki satırları yazılmaya başlayınca (denemenin kendi temizliğinden
    sonra) koşu bekledikçe HİÇBİR silme yolu onlara dokunmaz. `purgeStale` tek döngüdür (çağıran sürenine katılır) ve HER parçadan önce yeniden bakar (döngü sürerken başlayan
    dondurma da korunur); `purgeStaleInTx` aynı koşuyu dışlar; `lockNeedsCleanup` saymaz. Dayanak (göç 47 tetikleyicileri): koşu bekledikçe kapsamın üstündeki satırların hepsi
    onundur (bayat satır varken freeze koşusu açılamaz, satır yalnız en son bekleyen koşuya eklenir) → yazılırken silinecek başka satır yoktur. Yazılmayan bekleyen koşunun satırları
    önceki (yarıda kesilmiş) denemesinindir — her deneme baştan yazar (run_seq 1), silinir (BAŞ MİMAR uygulaması, aşağıda). Eşzamanlı kipte koşuyu devralan işlem (carryLock sync)
    yarım satırları kendisi siler ve baştan yazar.
  - Koşu tablo doğrulanmadan tamamlanmaz (`complete(…, table)`): tablodaki satır sayısı, borç, alacak ve ağırlık yazılan sayaçla tutmazsa koşu "tamam" OLMAZ — görünür hata
    ("Donmuş defter: koşunun tabloda N satırı var, M satır yazılmıştı …; dondurma tamamlanmadı, yeniden denenecek"), koşu bekler, kapsam yerinde, kilitli dönem bekleyen koşunun
    kuralıyla canlı okunur (K1); yeniden kilit / açılış baştan yazar. İş parçacığı kipinde ölçüm 20.000'lik run_seq aralıklarıyla, aralar olay döngüsüne bırakılarak (`runTotalsInParts`,
    aşama "doğrulama"); eşzamanlı kipte işlemin içinde tek toplam.
- ORTA-1 (dar kontrol p6: 1.000.000'da "Kilidi Aç → Yeniden Kilitle" 30.002 ms, istemci sınırı): kök neden PUT'taki bütçesiz `purgeStale()` (geri çekilen dönemin ~2,7 M bayat satırı).
  KARAR seçenek (i): yanıt bütçesi (LOCK_WAIT_MS = 5 sn) bütün uca (temizlik + arka iş). Kilit yeni bir freeze koşusu açacaksa ve kapsamın üstünde (yazılan koşununkiler dışında)
  satır varsa (`lockNeedsCleanup`; lockChanged'in kararlarıyla aynı — aynı gün ve eski kurallı koşunun ilerletilmesi koşu açmaz) temizlik bütçe kadar beklenir; bitmediyse
  409 `ledger-cleanup-running` "Önceki dönemin defter temizliği sürüyor; temizlik bitince yeniden kilitleyin. İlerleme bu kartta görünür." (+ `freeze`), kilit ve koşular değişmez,
  temizlik arkada sürer; durdurulan dondurma (başka güne istek) temizlikten sonra arkada sürer (K3 deseni). Kilit işleminin içinde büyük DELETE yok (ders 47). İlerleme
  `status().cleanup` = { running, removed } → GET / PUT `freeze.cleanup`; `freeze.active` açılıştaki temizliği de sayar.
- DÜŞÜK-1: "Kilitli dönemin defteri donduruldu." bildirimi yalnız kilit varken ve kapsam = kilit iken (client/assets/admin.js watchFreeze).
- İstemci (KARAR (i)): dondurma ya da temizlik sürerken Kilitle PASİF; nedeni düğmenin altında görünür yazı (#adm-period-busy; düğmenin title'ı da): "Kilitle, kilitli dönemin defteri
  dondurulurken kullanılamaz; dondurma bitince açılır." / "Kilitle, önceki dönemin defter temizliği sürerken kullanılamaz; temizlik bitince açılır."; form gönderimi (Enter, programatik)
  kilit isteği göndermez, nedeni bildirir. Temizlik sürerken kart "… Önceki dönemin defter temizliği sürüyor (N satır silindi)…" yazar ve yoklar. Kilidi Kaldır açık kalır (geri çekme
  temizlik istemez). 409 gelirse kart yenilenir. Kılavuz DEĞİŞMEDİ (kart kendisi anlatıyor).
- ORTA-2 → S46 = A (KULLANICI KARARI 06.11, "a"): açılış onarımı eksilen / değişen donmuş dönemi, o dönemi donduran koşunun dondurma izi (`ledger.snapshot.frozen`) duruyorsa
  koşunun KENDİ kuralıyla (eksilme eski sürüm DIŞI bir nedenle: dış silme, program hatası — ör. YÜKSEK-1'in eski kodu), iz yoksa (2.4.9'un Şirket Verisini Sıfırla'sı önce işlem
  geçmişini siler) S13 gereği GAP_RULE ile yeniden dondurur. Uygulama: geri çekmeden ÖNCE görünen defterin koşu bileşimi (`composition`: her aralığı en son hangi tamamlanmış koşu
  dondurdu; geri çekmeler keser) → yeniden donma planı (`repairPlan`; aynı kurallı ardışık dilimler birleşir) → planın ötesi (eski sürümün ilerlettiği kilit) GAP_RULE (S13) → ilk dilim
  bekleyen koşu, kalan dilimler koşunun izinde (`ledger.snapshot.plan`), `continueAfter` sürdürür (ilerletme izi yeni koşuya taşınır). Kuralı bu programda olmayan dilim bekler
  (tur 1 (b)).
- Ç3 küçük işler: (a) routes/report-center.mjs Defter Mutabakatı alt başlığı artık denetimin kendi iletisi (`ruleDiffHint`; nedeni bilinmeyen ayrışmada tarafsız) + "Yeni işlemler
  engellenmez (aşağıda “Kural Değişikliği Farkı”)." — "Defter kuralı program sürümüyle değişti" kalktı (§8 AÇIK notu kapandı). (b) routes/ledger.mjs `logRow`: Mutabakat Testi
  günlüğünde geçersiz JSON ayrıntı (2.4.9'un 20.000 karakterde kesik kaydı) yanıtı düşürmez; satır `detail: null`, `detailUnreadable: true`, `detailNote: "Kayıt ayrıntısı okunamadı
  (kesik ya da bozuk kayıt; N karakter)."` (ders 4: okunamayan boş değildir), öbür alanlar aynen. (c) admin.js: Mutabakat Testi çalışamazsa satır sessizce boşalmaz —
  "Mutabakat Testi çalıştırılamadı: <neden>" (kırmızı).

### Testler ve kırmızı / yeşil (ders 7, 38; her koşu tools/kanit.mjs kos; docs/kanit/2026-11-06/c3t3-*)
- Yeni test/donmus-defter-tur3-250.test.mjs (11) + genişleyen K6 (test/donmus-defter-kilit-ucu-250.test.mjs: "donmuş = canlı" + "görünen satır = koşunun kayıtlı satırı", ön koşul kapıyla:
  ikinci istekten önce koşunun satırları yazılmış, dondurma "batch" kancasında tutuluyor — süreye bağlı değil, ders 20). Son kod (2d42d493): 20/20 TZ=UTC ve TZ=Europe/Istanbul
  (c3t3-son-yeni-utc / -istanbul).
  | Test | Ne | Eski kod 834cd0ad (ayrı kopya, iki TZ aynı) |
  |---|---|---|
  | K6, T1 (p1), T2 (p5) | yazım adımında aynı güne kilit; eski kurallı açılış koşusu | "… arka işi süren koşunun yazdığı satırları sildi (0 / 5)", "(0 / 15)" — BEKLENEN NEDEN |
  | T3 | dışarıdan eksilen satır → koşu tamamlanmaz | "eksik satırlı koşu tamamlandı (kapsam 2026-12-31 …)" — BEKLENEN NEDEN |
  | T4, T4b | temizlik sürerken 409; açılıştaki temizlik süren iş | ön koşul ("temizliği sürüyor (tutuldu)": eski kodda temizlik kancası / alanı yok) — kanıt sayılmaz; dişi mutant 311–314 + 1.000.000 ölçümü |
  | T5 | Defter Mutabakatı alt başlığı | "alt başlık nedeni bilinmeyen ayrışmayı "kural değişti" diye adlandırıyor: Defter kuralı program sürümüyle değişti …" — BEKLENEN NEDEN |
  | T6b / T6 | kesik Mutabakat Günlüğü kaydı | "Mutabakat Testi kesik kayıtla düştü: 500" — BEKLENEN NEDEN; T6 (v2.4.9 + v2.0.26 GERÇEK kodu, etiketli) kopyada etiket olmadığı için atlanır → ayrı betik (c3t3-t6-eski-yeni-utc): v2.4.9 kendi Mutabakat Testi 500, eski 834cd0ad 500, yeni 200 (kesik satır 1: detail null, "… 20000 karakter") |
  | U1, U3 | S46: izli dönem kendi kuralıyla; karışık plan | "eksilen 2.5.0 dönemi 2.4.9 kuralıyla yeniden dondu (S46 = A …)", "plan dilimleri kendi kurallarıyla donmalı …" — BEKLENEN NEDEN |
  | U2 | izsiz → 2.4.9 | eski kodda da yeşil (davranış aynı; dişi mutant 352 + tur 1 testleri) |
  Eski kod 9/19 (UTC ve İstanbul; c3t3-kirmizi-eski-834cd0ad-son-*).
- e2e test/e2e/senaryo-donem-kilidi-ilerleme-250.mjs genişledi (dar kontrol p2 / p3 karşılıkları + temizlik + Ç3 küçük işler (c)): 1. adımda Kilitle pasif + neden + form gönderimi
  istek göndermez; 2. adımda bitince açık; 5) dondurma sürerken Kilidi Kaldır → "donduruldu" bildirimi YOK; 6) temizlik sürerken kart "… temizliği sürüyor (N satır silindi)…",
  Kilitle pasif + neden, yoklama, bitince açık ve yeniden Kilitle; 7) Mutabakat Testi 500 (sahte yanıt) → "Mutabakat Testi çalıştırılamadı: …" kırmızı. Yeni kod 39/39; eski kod
  834cd0ad 29/39 (c3t3-kirmizi-eski-834cd0ad-e2e-utc): "dondurma sürerken Kilitle pasif ✗", "pasif düğmenin nedeni görünür ✗", "form gönderimi … (1 PUT) ✗", "kilit kaldırılınca
  "donduruldu" bildirimi çıkmadı: [… "Kilitli dönemin defteri donduruldu."] ✗", "mutabakat satırı: "" ✗" — BEKLENEN NEDENLER (6. adımın temizlik metni eski kodda kancasız, ön koşul).
- Dar kontrol betikleri yeni kodda (kendi kopyalarım, c3t3-betik): p1 TUTARLI (84 / 84 / 84; ikinci istekten sonra tabloda 15 satır kaldı — eskide 0), p5 TUTARLI (80; eskide 65 / 80).
  p3 (ekrandan aynı güne Kilitle) yeni kodda yapılamaz (düğme pasif) — karşılığı e2e 1. adım.
- G3: eski testlerin beklentisi DEĞİŞMEDİ (`git diff --diff-filter=M 834cd0ad..` test/'te: K6 adı + yeni denetimler; e2e yalnız eklenen adımlar; mutasyon dosyasında 15, 203, 206, 208,
  209'un kaynak metni yeni koda göre — aynı hata, yeni yerinde).
- Mutasyon (test/donmus-defter-250-mutasyon.mjs; e2e mutantları için betik kipi eklendi): koşu 1 (a430c4ee kopyası) var olan 55 mutantın 55'i + 301–304 (59/59) beklenen nedenle
  yakalandı; koşu 2 (son kod 2d42d493 kopyası; T4b / U testlerinin kapanış düzeltmesinden sonra) 23/23: 15, 203, 206, 208, 209 (metni güncellenen) + 301–304, 311–314, 321–324, 331,
  341, 342, 351–353 (c3t3-mutasyon-tur3). Koşu 1, mutant 314'ün T4b'yi asılı bırakacağı görülünce durduruldu (eski kodda da aynı: ilk sunucu kapanmadan denetim düşüyordu) →
  test düzeltildi (closeOnce), koşu 2. Kapsam dışı / eşdeğer: purgeStaleInTx'in yazılan koşuyu dışlaması (işlem içi temizlik çağıranları önce koşuyu bırakır / tamamlar; savunma).

### Windows'a duyarlı (ders 48; ilk gönderimde CI'nin Windows işlerinde görülmeli)
test/donmus-defter-tur3-250.test.mjs T2, T4b, U1–U3 sunucuyu kapatır, dosyayı ham bağlantıyla (`DatabaseSync`) değiştirir (ayar, tetikleyici kaldır / kur, satır / iz silme) ve aynı
dosyayı yeniden açar; T4b temizliği yarıda keser, kapatır, açılışta sürdürür. T6 2.4.9 / 2.0.26 / güncel kodu aynı klasörde sırayla açar (etiket yoksa atlanır). Dondurma ve kilit izi
iş parçacıkları değişmedi (tablo doğrulaması ana iş parçacığındaki bağlantıda).

### BAŞ MİMAR KARARI GEREKİYOR (uygulamada verilen yorumlar; ders 40 — gerekçeli, ana oturum değerlendirir)
- B1 "Bekleyen koşunun satırları silinmez" yorumu: korunan, bu denemede YAZILAN koşudur (yazım bayrağı + hâlâ en son bekleyen). Yazılmayan bekleyen koşunun satırları önceki (yarıda
  kesilmiş) denemesinindir ve silinir. Gerekçe: her deneme baştan yazar (run_seq 1); korunsalardı başka güne kilitte durdurulan koşunun satırları kilit işleminin İÇİNDE tek DELETE ile
  silinirdi (KARAR: işlem içinde büyük DELETE yok) ve ilk denemenin artığı ikinci denemenin birincil anahtarıyla çakışırdı.
- B2 Yanıt bütçesi (5 sn) bütün uca paylaştırıldı (temizlik + arka iş): temizlik bütçenin bir kısmını kullandıysa kısa dondurma da yanıttan sonra bitebilir (T2-2'nin "kısa işte eski
  davranış" sözü yalnız temizlik gerekmeyen kilitte birebir). Gerekçe: KARAR "uç 5 sn bütçesini aşmaz".
- B3 409 yalnız geri çekmenin temizliğinde değil, başka güne kilitte durdurulan dondurmanın artığı bütçede silinemezse de döner (aynı ileti); durdurulan koşu temizlikten sonra arkada
  baştan sürer (K3 deseni). Ekrandan bu yol yok (Kilitle dondurma sürerken pasif); yalnız API.
- B4 Dondurma / temizlik sürerken Kilidi Kaldır AÇIK kalır (geri çekme temizlik gerektirmez; KARAR yalnız Kilitle'yi pasif sayar).
- B5 S46 = A'nın uygulaması: eksilen dönem koşu koşu ele alınır (dilim başına izi duran koşunun kendi kuralı, izsizi GAP_RULE); kuralı bu programda olmayan dilim bekler (tur 1 (b)).
- B6 Kesik kayıt satırı atlanmaz, `detailUnreadable` ile görünür kalır (ders 4: okunamayan boş değildir); öbür alanlar aynen.

### KULLANICIYA SORULMALI
Yok. S46 yanıtlandı (A); yeni para / kapama / kural seçimi açılmadı.

### BİLİNEN SINIR
- Yeniden donma planı sürerken (açılış onarımından sonra, dondurma arkada) yönetici kilidi BAŞKA güne alırsa güncel kurallı plan dilimi lockChanged'in olağan kuralına düşer (koşu
  bırakılır, (kapsam, hedef] güncel kuralla); planın kalan izsiz dilimleri de güncel kuralla donar. Bugün iki kural aynı sonucu verir (kural tuzağı testi); çok seyrek (eski sürüm +
  eksik satır + plan sürerken kilit değişikliği). Ç5 kural değişikliğiyle anlam kazanır → Ç5 / D4 notu.
- Plan sürerken (bekleyen koşunun gününden sonraki) izli eski kurallı dilimler bu arada güncel kuralla canlı okunur (bugün aynı sonuç).
- 409'un iletisi başka güne kilitte durdurulan dondurmanın artığında da "Önceki dönemin defter temizliği sürüyor" der (B3).
- Kartın yoklaması 5 kez üst üste düşerse Kilitle son görülen durumda (pasif) kalabilir; kart yeniden açılınca düzelir.
- Tablo doğrulaması dondurmaya ek süre katar (ölçüm aşağıda).
- DÜŞÜK-2 (kilit ilerletilince süren eski kurallı koşu baştan başlar; hız) → 2.5.1 (KARAR).

### Komşular (G2, ders 10) ve e2e
- test/ taraması (period-lock, ledger/lock, ledger/integrity, defter-mutabakati, ledger-snapshots, ledger.snapshots, routes/ledger.mjs, integrity_log, frozenThrough, lockAndWait,
  waitForFreeze + admin.js / client/assets anan + kaynak tarayan genel testler) = 129 dosya (liste c3t3-ham/komsu-liste-tam.txt), TZ=UTC, 2d42d493: 1.471 / 1.473 (c3t3-komsu-utc).
  İki kırmızı: (1) banka-210-saat statik taraması — kilit ucunun bütçe süresi `Date.now()` ile ölçülüyordu → `performance.now()` (76bc91b8; yeniden GEÇTİ, c3t3-komsu-saat-yeniden);
  (2) sema-kapisi-bs7 "001'e … whatsapp.appWebhook" — tabanda (834cd0ad, ayrı kopya) AYNI iletiyle kırmızı (c3t3-taban-834cd0ad-sema-kapisi-bs7): ana daldaki WE gerilemesi, bu
  turun değil.
- Son kod 76bc91b8: yeni testler + K + banka-210-saat 32/32 UTC ve İstanbul (c3t3-final-yeni-*); donmuş defter 4 dosya + yazım / platform / lisans tarayıcıları İstanbul 54/54
  (c3t3-donmus-istanbul); e2e senaryo-donem-kilidi-ilerleme-250 39/39 (c3t3-final-e2e-donem-kilidi), senaryo-222 60/60 ("toplam istek ≤ 50"), senaryo-defter-243 24/24.

### Ölçüm (flock scratchpad/olcum.lock; programın kendi verisi scratchpad/c3-olcum-veri; makine yükü satırlarda; dar kontrolün betikleri kendi kopyalarımda — c3t3-ham/)
| Yol | Eski 834cd0ad (dar kontrol p4 / p6) | Yeni |
|---|---|---|
| 100.000 — yazım sürerken aynı güne kilit (p4 A2; ön koşul: 1.000 satır yazılmışken) | HATA: 254.116 görünen / 274.616 kayıtlı (20.500 satır kayıp); yanıt 5.048 ms | TUTARLI 274.616 / 274.616 / 274.616 (canlı); yanıt 4.895 ms, döngü 215 ms (yük 8,7–9,2; eskide bitiş adımında 182 ms) |
| 100.000 — Kilidi Aç → hemen Yeniden Kilitle (p4 B) | 4.497 ms / 5.006 ms 200 | Kilidi Aç 3.139 ms (temizlik bütçede bitti), Yeniden Kilitle 5.006 ms 200, TUTARLI (yük 8,7–11,2) |
| 1.000.000 — Kilidi Aç (p6; 2.741.312 donmuş satır) | 5.034 ms | 5.005 ms (bütçe; temizlik arkada, 765.500 satır silinmiş) |
| 1.000.000 — Yeniden Kilitle (hemen) | YOK: 30.002 ms "Sunucu zamanında yanıt vermedi" (yük 17) | 409 ledger-cleanup-running, 5.009 ms, döngü 64 ms (1.471.000 silinmiş); ilerleme GET 23 ms |
| 1.000.000 — temizlik bitişi → Yeniden Kilitle | — | +7,8 s (2,74 M satır ~18 sn'de silindi); kilit 200 5.011 ms |
| 1.000.000 — dondurma (iki kez) | 192,9 s / 215,7 s (yük 17–19) | 106,0 s / 93,8 s; görünen = kayıtlı = 2.741.312; TUTARLI (yük 4,7–5,3; komşu koşusu paralel) |
| 1.000.000 — tablo doğrulaması (yeni adım) | — | 138 parça × 20.000 satır, parça en uzun 8 ms, toplam 543 ms |
Olay döngüsü dondurma boyunca en çok 319 / 289 ms (1 M): doğrulama parçası ≤ 8 ms olduğundan kaynağı doğrulama değil; §16 / §18'deki aile (yük ve çöp toplama; eski p6'da 134 / 396 ms)
— BİLİNEN SINIR (kalıcı çözüm rapor / defter iş parçacığı, Ç6). Süreler son adayda boş makinede yinelenir.

## 20. Ç3 tur 4 (06.11.2026): Ç3 tur 3 dar kontrolünün bulguları (ORTA-1 S46 planı, DÜŞÜK-1 test dişi, DÜŞÜK-2 yorum)
Kaynak: Ç3 tur 3 dar kontrolü (06.11 ~14:40; ORTA-1, DÜŞÜK-1, DÜŞÜK-2; DÜŞÜK-3 → 2.5.1) ve KARAR (BAŞ MİMAR; DURMA KURALI — yalnız bunlar). Taban f4a43cbd; ürün + test 16959ab7.
Kanıt docs/kanit/2026-11-06/c3t4-* (her koşu tools/kanit.mjs kos; OKU-BENI). §19'daki "BİLİNEN SINIR" maddeleri sürer.

### Yapılanlar
- ORTA-1 (S46 = A AYNEN uygulanır; yeni kural yok). Kök neden: açılış onarımının yeniden donma planı (§19 S46) ilk dilimi bekleyen koşu, kalan dilimleri koşunun izinde (PLAN_TRACE)
  tutar; ilk dilim GÜNCEL kurallıysa (bileşim: (…, 30.06] bu programın 2.5.0 koşusu, (30.06, 31.12] eski sürümün ilerlettiği kilidin GAP_RULE koşusu) koşunun günü kilitten önce
  kalır ve iki yol onu "başka güne kilit" sayıyordu: (a) `repairOnOpen` yarıda kesilen koşuyu yalnız kuralı güncel değilse sürdürüyordu → bırakılıyor, plan düşüyor, bütün dönem
  GAP_RULE ile donuyordu (2.4.9 / 2.4.9); (b) aynı güne yeniden kaydetme (`routes/ledger.mjs` PUT `cancel()`, `lockNeedsCleanup`, `lockChanged`) yalnız bekleyen koşunun gününe
  bakıyordu → koşu bırakılıyor, (kapsam, kilit] güncel kuralla donuyordu (2.5.0 / 2.5.0). İlk dilim 2.4.9 iken (tur 3 U3) iki yol da "eski kurallı koşu" kolundan geçtiği için plan
  korunuyordu — asimetri. Kartın hata durumundaki iki önerisi ("kilidi yeniden kaydedin", "programı yeniden açın") planı düşürüyordu.
  - `repairOnOpen` (lib/ledger-snapshots.mjs): TAŞINAN koşu = kuralı güncel değil YA DA yeniden donma planı izi (PLAN_TRACE) YA DA koşunun gününün ötesinde ilerletme izi
    (EXTENDED_TRACE) olan bekleyen koşu (dar kontrolün önerisi + ilerletme izi). Günü kilitten önceyse sürer, kalan dönemi `continueAfter` açar; günü kilidin ötesindeyse (eski sürüm
    kilidi geri çekti) bırakılır, (kapsam, kilit] koşunun kuralıyla.
  - `lockChanged({ previous, … })`: kilit DEĞİŞMİYORSA (hedef = önceki kilit; koşunun günü hedeften önce) bekleyen koşu — kuralı ne olursa olsun — izleriyle sürer. Eşzamanlı kipte
    yol yok (`postAll(lockThrough)` kancayı yalnız kilit ilerleyince çağırır).
  - `routes/ledger.mjs` PUT: kilit değişmiyorsa süren dondurma durdurulmaz (`cancel()` yok); `lockNeedsCleanup` aynı ayrımla `false` (temizlik beklenmez, 409 yok — bekleyen koşu
    sürer, koşu açılmaz; denemenin artığını arka iş siler). `lockChanged`'e verilen `previous` İŞLEMİN İÇİNDE okunur (yukarıdaki beklemelerde — durdurma, temizlik — başka bir istek
    kilidi değiştirmiş olabilir; "kilit değişmedi" kararı bayat değere dayanmaz). Savunma: bugünkü yollarda kilit değişmeyen istek beklemeye girmez (testte eşdeğer; mutant yok).
  - Aynı kökün eşi (S13 = A): eski kurallı koşu sürerken ESKİ SÜRÜMÜN ilerlettiği kilit aynı güne yeniden kaydedilince `carryLock` "bu program kilidi ilerletti" izini yazıyordu →
    eski sürümün ilerlettiği dönem güncel kuralla donuyordu. Şimdi kilit değişmediği için iz yazılmaz, dönem GAP_RULE (2.4.9) ile donar (test W1).
- DÜŞÜK-1 (test dişi): koşu "before-done" (iş parçacığı bitti, tablo doğrulamasından önce) ve "doğrulama" (ilk parça özetlendi) pencerelerinde tutulup aynı güne PUT atılır.
  Doğrulamanın penceresi için `runTotalsInParts`'a YALNIZ TEST kancası "verify" ({ run, low, upto }; her parçadan önce) ve kanca nesnesinin `verifyLines`'ı (küçük veride parça boyu)
  eklendi. Üretimde kanca yok, parça 20.000 (değişmedi). Yazım bayrağı (`writing`) bu pencerelerde zaten duruyordu (eski kodda da yeşil); dişi mutant 901 / 902.
- DÜŞÜK-2 (yalnız dış araçla; davranış DEĞİŞMEDİ): `complete()` yorumu "donmuş defter hiçbir zaman eksik satırla 'tamam' olmaz" yanlıştı → "programın kendi silme yolları yazılan
  koşuya yazımdan tamamlanmaya kadar dokunmaz; tablo doğrulaması ölçmeden önce ya da henüz özetlenmemiş parçada eksilen satırı görür; parçası özetlendikten SONRA dış bir bağlantıyla
  silinen satırı GÖRMEZ" (BİLİNEN SINIR, aşağıda).

### Testler ve kırmızı / yeşil (ders 7, 38; her koşu tools/kanit.mjs kos)
Yeni test/donmus-defter-tur4-250.test.mjs (13; ön koşullar kancayla tutulur — süreye bağlı değil, ders 20; her ön koşul ayrıca denetlenir). Yeni kod 16959ab7: G2 komşu koşusunda
UTC 13/13 (c3t4-komsu-UTC), İstanbul 13/13 (c3t4-donmus-Europe-Istanbul). Eski kod f4a43cbd (`git worktree` ayrı kopya; yalnız yeni test dosyası kopyalandı — ders 23, 51): iki saat
diliminde 4/13, aynı 9 kırmızı (c3t4-kirmizi-eski-f4a43cbd-UTC / -Europe-Istanbul).
| Test | Ne | Eski kod f4a43cbd (iki TZ aynı) |
|---|---|---|
| V1 s46, X1 | plan sürerken kapanış → yeniden açılış (dar kontrol "kapanis"; X1 = v2.4.9 GERÇEK koduyla ilerletilmiş kilit) | "(…, 30.06] 2.4.9 kuralıyla dondu (S46 = A: 2.5.0)" — BEKLENEN NEDEN |
| V2 s46, X2 | ilk dilim hata → aynı güne yeniden kaydetme (dar kontrol "aynigun") | "(30.06, 31.12] 2.5.0 kuralıyla dondu (S46 = A: 2.4.9)" — BEKLENEN NEDEN |
| V3 s46, V3 u3 | ilk dilim yazılırken aynı güne yeniden kaydetme | "kilit değişmezken (aynı gün) planın dondurması durduruldu ya da baştan başladı" — BEKLENEN NEDEN (PUT `cancel()`) |
| V4 s46 | ilk dilim hata, artık satırlar + temizlik tutulur → aynı gün | "kilit değişmezken (aynı gün) temizlik istendi: 409 ledger-cleanup-running" — BEKLENEN NEDEN (`lockNeedsCleanup`) |
| W1 | eski kurallı koşu + eski sürüm ilerletmesi + hata + aynı gün (S13) | "eski sürümün ilerlettiği dönem (30.06, 31.12] 2.5.0 kuralıyla dondu (S13 = A: 2.4.9)" — BEKLENEN NEDEN |
| V1 u3, V2 u3, V4 u3 | ilk dilim 2.4.9 (tur 3 U3) — gerileme denetimi | eski kodda da yeşil (plan bu sırada korunuyordu) |
| D1 | "before-done" penceresinde aynı gün | eski kodda da yeşil (davranış doğruydu; dişi mutant 901) |
| D2 | "doğrulama" penceresinde aynı gün | ön koşul ("verify" kancası eski kodda yok) — kanıt sayılmaz; dişi mutant 901 / 902 |
- Dar kontrolün kendi betikleri (kendi kopyalarım; c3t4-ham): s46-plan.mjs tam / kapanis / aynigun, bileşim s46 ve SIRA=u3, iki TZ: 12/12 "S46A_uyuyor: true", görünen = kayıtlı =
  canlı (84); y1-yollar.mjs Y1–Y7 iki TZ tutarlı (84 / 88); y3-409.mjs C1–C4 iki TZ tutarlı.
- G3: eski testlerin beklentisi DEĞİŞMEDİ (mutasyon dosyasında yalnız 202'nin kaynak metni yeni koda göre — aynı hata, yeni yerinde; T4 tabana eklendi).

### Mutasyon (test/donmus-defter-250-mutasyon.mjs; kopya `git archive 16959ab7`; c3t4-mutasyon)
Taban 67 + e2e 39 yeşil; 79 / 79 mutant beklenen nedenle yakalandı (var olan 73 + bu turun 6'sı): 401 "taşınan koşu yalnız kurala bakar" (V1 s46), 402 "lockChanged kilit değişmezken
bekleyen koşuyu bırakır" (V2 / W1), 403 "PUT kilit değişmezken de durdurur" (V3), 404 "lockNeedsCleanup kilit değişmezken de temizlik ister" (V4), 901 "yazım bayrağı iş parçacığı
bitince, doğrulamadan önce kalkar" (dar kontrolün mutantı; D1, D2), 902 "yazım bayrağı doğrulama başlarken kalkar" (D2). Eşdeğer / kapsam dışı: PUT'un önceki kilidi işlemin içinde
okuması (savunma; yukarıda).

### Komşular (G2, ders 10) ve e2e
- test/ taraması (period-lock, ledger/lock, lockChanged, lockNeedsCleanup, repairOnOpen, snapshotRepair, ledger-snapshots, ledger.snapshots, routes/ledger, frozenThrough, lockAndWait,
  waitForFreeze, __testFreezeHook, ledger/integrity, defter-mutabakati, integrity_log, ledger_snapshot) ∪ tur 3 listesi = 132 dosya (c3t4-ham/komsu-birlesik.txt), TZ=UTC, 16959ab7:
  1.501 / 1.501 (c3t4-komsu-UTC; banka-210-gg-kapi, banka-230-supheli-bozma, mutabakat-*, report-center, sema-kapisi-bs7, silinenler-donem-kilidi-244 dahil). TZ=Europe/Istanbul donmuş
  defter + fiş defteri + dönem kilidi + mutabakat + kaynak tarayan genel testler (20 dosya): 204 / 204 (c3t4-donmus-Europe-Istanbul).
- e2e (ders 28): senaryo-donem-kilidi-ilerleme-250 39/39, senaryo-duzeltme-kilidi-tur3-250 110/110, senaryo-defter-243 24/24, senaryo-222 60/60 ("toplam istek ≤ 50").

### Windows'a duyarlı (ders 48; ilk gönderimde CI'nin Windows işlerinde görülmeli)
test/donmus-defter-tur4-250.test.mjs V1–V4, X1–X2, W1: sunucuyu kapatır, dosyayı ham bağlantıyla (`DatabaseSync`) değiştirir (kilit ayarı, tetikleyici kaldır / kur, satır silme)
ve aynı dosyayı yeniden açar; V1 / X1 / W1 dondurma iş parçacığı satır yazarken (kancada tutulu) kapatır. X1–X2 v2.4.9 GERÇEK kodunu aynı klasörde açar (etiket yoksa atlanır).
Dondurma ve kilit izi iş parçacıkları değişmedi.

### BAŞ MİMAR KARARI GEREKİYOR
- B4-1 (uygulamada verilen yorum; ders 40): KARAR "kilit değişmiyorsa lockChanged bekleyen koşuyu sürdürür" bütün bekleyen koşulara (kuralı ne olursa olsun) uygulandı. Sonucu: eski
  kurallı koşu + eski sürümün ilerlettiği kilit + aynı güne yeniden kaydetme → ilerletilen dönem GAP_RULE (S13 = A) — önceki davranış güncel kuraldı (W1). Gerekçe: aynı güne kaydetme
  kilidi ilerletmez; ilerletme izi yalnız bu programın ilerlettiği günü kaydeder (§4). Bugün iki kural aynı sonucu verir (kural tuzağı testi).
- B4-2 (YENİ KUŞKU, YENİDEN ÜRETİLDİ — KARAR VERİLMEDİ; kapsam dışı, önceden var): ilerletme izinin DEVAM koşusu. Sıra: eski sürüm kilidi 30.06 → açılış onarımının 2.4.9 koşusu →
  bu program kilidi 30.09'a ilerletir (iz 30.09) → kesinti → eski sürüm kilidi 31.12'ye ilerletir → açılış: 2.4.9 koşusu tamamlanır, `continueAfter` (30.06, 30.09] güncel kurallı
  koşu açar (izsiz; (30.09, 31.12] GAP_RULE'u ancak bu koşu tamamlanınca açılır) → bu koşu yazılırken kesinti → açılış: güncel kurallı, izsiz, günü kilitten önce → bırakılır,
  (30.06, 31.12] GAP_RULE (beklenen (30.06, 30.09] 2.5.0). Betik c3t4-ham/v5-ilerletme-devami.mjs: yeni kod 16959ab7 ve eski kod f4a43cbd AYNI "FARKLI" (koşular 1 done 2.4.9 ·
  2 abandoned 2.5.0 · 3 done 30.06→31.12 2.4.9). Aynı güne yeniden kaydetme yolu bu turda düzeldi (kilit değişmezken koşu sürer). Seçenekler: (a) öneri — `continueAfter` ilerletme
  devamının kalanını (iz günü, kilit] GAP_RULE dilimi olarak devam koşusunun PLAN_TRACE'ine yazar (yeni kural yok; ORTA-1 düzeltmesi koşuyu taşınan sayar); (b) uç durum böyle kalsın
  (BİLİNEN SINIR: eski sürümün iki kez kullanılması + iki kesinti; bugün iki kural aynı sonuç).

### KULLANICIYA SORULMALI
Yok (yeni para / kapama / kural seçimi açılmadı).

### BİLİNEN SINIR
- DÜŞÜK-2: iş parçacığı kipinde tablo doğrulaması, parçası özetlendikten SONRA dış bir bağlantıyla (programın dışında bir araç) silinen satırı görmez; koşu o satır olmadan "tamam"
  olabilir. Mutabakat Testi "Donmuş Defterde Eksik Satır" (görünen ≠ kayıtlı) ile gösterir, açılış onarımı dönemi yeniden dondurur (§7). Programın kendi silme yolları dokunmaz.
- DÜŞÜK-3 (kalıcı hata veren dondurma + başka güne kilit = 409 döngüsü) → 2.5.1 (KARAR).
- §19'daki plan maddeleri sürer: plan sürerken kilit BAŞKA güne alınırsa güncel kurallı plan dilimi lockChanged'in olağan kuralına düşer; plan sürerken izli eski kurallı dilimler
  güncel kuralla canlı okunur (bugün aynı sonuç).

### Ölçüm (ders 47, 52; flock -x scratchpad/olcum.lock; programın kendi verisi — kapi-olcum-yama.mjs kopyam, --hedef 1000000 --yalniz-kur; taze kopya; /proc/loadavg satırlarda)
Bu turun dondurma yoluna tek eki doğrulama parçası başına bir `await` (kancasız; 138 parça). 1.000.000 verisi (001: 2.741.312 donmuş satır), çekirdek kip (dar kontrol p6 ile aynı kurulum:
gerçek routes/ledger.mjs uçları + yönlendirici + HTTP), kilit 31.12.2025 → dondurmanın bitişi; olay döngüsü 5 ms'lik yoklayıcı (c3t4-ham/olcum-1m-dondurma.mjs.txt).
| Koşu | Yük (1 dk) ölçümden önce / sırasında | Kilit yanıtı | Dondurmanın bitişi (kilitten) | Olay döngüsü en çok (50 ms üstü boşluk) | Sonuç |
|---|---|---|---|---|---|
| 1 (16959ab7, 15:56) | 5,42 / 4,83–4,97 | 5.029 ms 200 (bütçe), döngü 21 ms | ~93,2 sn (5,0 + 0,2 + 88,0) | 172 ms (2) | TUTARLI 2.741.312 = 2.741.312 — GEÇERSİZ (yük > 2) |
| 2 (16959ab7, 16:09) | 6,81 / 6,93–6,96 | 5.041 ms 200 (bütçe), döngü 50 ms | ~123,9 sn (5,0 + 0,2 + 118,7) | 338 ms (43) | TUTARLI — GEÇERSİZ (yük > 2) |
İki deneme de GEÇERSİZ: makinede başka ajanların kilitsiz yükü (tam `npm test`, kâhin mutasyonu) sürdü; 1 dk ortalaması 2'nin altına inmedi. Yük ~5'te olay döngüsü 172 ms (tur 3:
289–319 ms, yük 4,7–5,3; dar kontrol: 575 ms, yük 11–16 — §16 / §18 / §19 ailesi, kaynak yük ve çöp toplama). DOĞRULANMADI: boş makinede (yük ≤ 2) değer — son adayda yinelenir
(komut c3t4-ham/kos-olcum.sh.txt; veri c3t4-ham/veri-kur-1m.sh.txt ile yeniden üretilir, ~8 dk).
