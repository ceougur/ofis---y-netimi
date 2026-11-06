# Ç3 — Kilitli Dönemin Defterini Dondurma: Tasarım Notu (2.5.0)

Durum: KOD AJANI TASARIMI (05.11.2026). Kaynak: `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md` §0, §1, §4 (aynen), §8, §9, §13, §14; `docs/erp/C2-FIS-DEFTERI-TASARIM.md` §5, §8, §11;
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

## 6. Göç 47 ve büyük veri
- Göç: iki tablo + indeks + tetikleyiciler; kilit varsa (`ledger.lockedUntil`) BEKLEYEN koşu (from '', through = kilit, kural "2.4.9", neden migration). Türetme göçte YAPILMAZ.
- Açılıştan sonra (setImmediate; ilk şirkette dinlemeye başlayınca, şirket örneğinde açılınca) bekleyen koşu iş parçacığında 2.4.9 kopyasıyla donar. Arada raporlar kilitli dönemi
  bekleyen koşunun kuralıyla (2.4.9 kopyası) canlı okur → göçten önce / sonra / donduktan sonra aynı sayılar.
- Gerekçe (BAŞ MİMAR KARARI önerisi K2): 1.000.000 satırda türetme ~55 sn; göçte yapılsa 001 açılışı ve 002'nin tembel açılışı (istek içinde) bir dakika beklerdi; supervisor açılış
  süresi riski. Bakım kipi gerekmez: kilitli dönem zaten yazılamaz, açık dönem yazımı donmuş satırları etkilemez.
- Kopya / geri yükleme: VACUUM INTO tabloları ve tetikleyicileri taşır; bekleyen koşu geri yüklenen dosyada da açılışta sürer. Eski (≤ 46) yedek geri yüklenince göç 47 yeniden koşar.

## 7. Açılış onarımı (eski sürüm, yarım koşu)
Sıra: göçlerden ve Ç2 onarımından sonra, kapıdan önce; BS-7 yeni şemalı dosyada koşmaz.
- Bekleyen koşu var → iş parçacığında sürdürülür (bayat satırlar önce silinir; koşunun kuralı kayıt defterinde yoksa koşu bırakılır, güncel kuralla yenisi açılır).
- Kilit > kapsam, bekleyen yok (yalnız eski sürüm yapabilir: 2.5.0 kilit koyunca koşu açar) → BEKLEYEN koşu, kural "2.4.9" (KULLANICIYA SORULMALI S1; §12), neden repair.
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

## 12. BAŞ MİMAR KARARI önerileri (ders 40) ve KULLANICIYA SORULMALI
- K1 Kilit önce, donma arkasından (§4). K2 Göçte bekleyen koşu, donma açılıştan sonra (§6). K3 Fark denetimi yalnız tam taramada (§8). K4 "Kural Değişikliği Farkı" uyarı düzeyinde,
  işlemleri engellemez. K5 Donmuş tablolar FINANCIAL / LOCK_SQL / integrity-scope dışında (§8). K6 Silme tetikleyicisi dondurma izine bağlı (§3). K7 Geri çekme mantıksal, fiziksel
  silme parça parça (§4). K8 Yan kazanç sınırlı (§9). K9 Kural sürümü etiketi + 2.4.9 kopyası kayıt defterinde (§5). K10 Karma okuma yalnız defter raporlarında; mutabakat canlı (§9).
  K11 Kaynak izi koşuda saklanır, tutmazsa yalnız bulgu (§7). K12 Kilit ucu tam taramayı (integrity.start) ana iş parçacığında koşmaz (§4).
- KULLANICIYA SORULMALI S1 (ders 43 — hangi kural sürümünün donduracağı, hesap sınıflamasını belirler): eski sürüm (≤ 2.4.9; BS-7 kapısını bilmez) 2.5.0 dosyasında kilidi İLERİ
  götürdüyse aradaki dönem hangi kuralla donsun? (A, öneri) 2.4.9 kopyasıyla — kilidi koyan programın kuralı, kullanıcı kilitlerken o raporları gördü; (B) güncel kuralla. Ç3'ün
  kodunda iki seçenek bugün AYNI sonucu verir (güncel kural = 2.4.9 tutarda); seçim tek sabittir (`GAP_RULE`), Ç5'ten önce kesinleşmeli.
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
