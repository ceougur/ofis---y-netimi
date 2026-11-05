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
    bekliyor mu — değilse durur); son küçük işlem sayıyı ve toplamları doğrular, koşuyu `done` yapar, izi (`ledger.snapshot.frozen`) yazar. Uç işin bitmesini bekler (yanıt dondurma
    bittikten sonra); ilerleme `ledger.freeze.progress` olayıyla ve `GET /api/workspace/ledger/lock` (`freeze`) ile.
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
- `ledger:snapshot` "Donmuş Defter" (yapı): görünen satır sayısı / borç / alacak / ağırlık = son koşunun durum toplamları; kapsam = kilit (bekleyen koşu → uyarı "Dondurma Sürüyor");
  kaynak izi (`lockDigestOf(kapsam, { version: digest_version })`) = saklanan iz. Ucuz SQL; tam taramada.
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
- `thawSync({ to, user, reason })` (Devri Yenile'nin arşivi açması; G7) ve `lockChanged(...)`.
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
