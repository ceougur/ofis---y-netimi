# Ç5-K — Kasa Açılış Kuralları: Tasarım Notu (2.5.0)

Durum: TASARIM (06.11.2026, Ç5-K kod ajanı; koddan ÖNCE commit). Taban f5903164 (çalışma dalı + muhasebe kâhini bakımı 7).
Kaynak (yalnız karar metinleri): `docs/erp/C5-ACILIS-TASARIM.md` §1.6, §2.9, §4 madde 12, §5, §6, §7, §9 B1 / B11; `docs/2.5.0-IS-LISTESI.md` D (S12, S20, S26, S40, S44, S45 AYNEN,
Z9 BAŞ MİMAR KARARI 07:59, B1–B17 BAŞ MİMAR KARARLARI 10:53), C (S54–S57 SORULDU, yanıt yok); kâhin README `test/bagimsiz/muhasebe/README.md` (T9–T13, Y15–Y18, Z9–Z10,
X7–X13, V1–V10, "Sürücü için"). Kâhinin KODU değiştirilmez (ders 40); para kuralı değişmez (defter: B 100 / A 500 aynen — Ç5-A'nın işi).

## 0. Kararlar (AYNEN) ve programdaki karşılığı
| Karar | Metin (özet, aynen kaynaklı) | Programda |
|---|---|---|
| S12 = A | Kasa açılışından ÖNCE tarihli yeni Kasa hareketi bankadaki gibi reddedilir (409; bankanın `bank-before-opening` ikizi) | YENİ ortak denetim (§2): 409 `cash-before-opening`; kâhin KASA_ACILIS_ONCE |
| S12 kapsam (kâhin T9; tasarım §2.9) | 100'e yazan HER kaynak; aynı gün olur; açılış yoksa kural yok | §1'deki bütün yollar tek denetimden geçer (yol başına kod yok) |
| B11 (BAŞ MİMAR, T12) | Düzeltme de reddedilir: tarihi açılıştan önceye alan ya da açılıştan önce tarihli kaydı Kasa'ya çeviren düzeltme | aynı denetim, düzeltmede (önceki hâl ↔ yeni hâl, §2.3) |
| S20 = A | Yedekte / eski sürüm verisinde açılıştan önceki nakit satırı AYNEN gelir; Mutabakat Testi uyarı | yedek geri yükleme ayrı bağlantıdır (kapı görmez, aynen gelir); göç satırlara dokunmaz; YENİ uyarı denetimi `cash:before-opening` "Kasa Açılışından Önce Tarihli Hareket" (düzey uyarı, §3) |
| Z9 (BAŞ MİMAR 07:59) | Silinenler'den geri alınan da aynı | Silinenler geri yüklemesi denetimin "geri yükleme kapsamı"nda (§2.4) — S12 uygulanmaz, uyarı sürer |
| S26 / S40 / S44 = A | Böyle kaydın tarihi değişmeden tutarı, açıklaması, carisi, fatura / taksit bağı, "Normal Cari Hesaba İşle" seçimi düzeltilebilir; uyarı sürer | tarihi değişmeyen düzeltme kabul (§2.3: önceki hâl nakit + aynı gün) |
| S45 = A | Kapatılacak Fatura ya da taksit kartıyla bağlıysa carisinin düzeltilmesi "önce bağı kaldırın" ile red (düzeltmenin TAMAMI) | §4: programda cari hareketinin carisini değiştiren yol YOK (PUT /accounts/:id/entries/:entryId gövdesinde cari alanı yok; taksit tahsilatının cari / kart alanı yok) → red edilecek istek oluşamaz; yolsuzluk ayrıca KULLANICIYA / BAŞ MİMARA (§8) |
| R8 / EK-2B 33 | Kasa açılışı ilk nakit hareketinden sonraya DÜZELTMEDE de 409 | bugünkü kod denetlendi (§5): giriş, düzeltme (iki uç), geri yükleme kapsıyor; Kasa ↔ açılış dönüşümü yolu yok |
| S54–S57 | SORULDU, yanıt yok | bugünkü davranış kalır; testte "S5x yanıtı bekleniyor" işaretli (§6) |

## 1. 100'e yazan bütün yollar (kaynak taraması; K6 tarayıcısıyla `test/bank-post-tarayici.mjs writeSites`, para tablosuna INSERT / UPDATE)
Nakit (100) = para satırı (`lib/bank/money-lines.mjs isMoneyRow`) ve `method = 'cash'` (money-lines WAY_SQL "cash"); Kasa açılışının işaretli satırı hareket değildir.
Para tabloları: `payments`, `cash_entries`, `account_entries`, `plan_entries`, `stock_moves`, `cheque_events` (bank_lines'ta nakit rolü yok).

| # | Yol (ekran) | Yazım yeri (dosya:satır, taban f5903164) | Tablo |
|---|---|---|---|
| 1 | Kasa Giriş / Kasa Çıkış | routes/cash.mjs:385 (POST /cash); düzeltme :542 (PUT /cash/:id) | cash_entries |
| 2 | Bankadan Kasaya / Kasadan Bankaya (nakit bacağı) | routes/cash.mjs:455 (POST /cash/transfer); düzeltme :543 (ikiz) | cash_entries |
| 3 | Kasa'dan Vergi Ödemesi (+ gecikme zammı) | routes/tax.mjs:148 (POST tax/payments, way cash) | cash_entries |
| 4 | Cari nakit tahsilat / ödeme (Kapatılacak Fatura, Normal Cari Hesaba İşle) | routes/accounts.mjs:751 addEntry ← POST /accounts/:id/entries (:1018); düzeltme :1110 (PUT :1057) | account_entries |
| 5 | Fatura peşin tahsilat / ödeme (satış, alış, e-SMM) ve iade faturasının nakit para iadesi | routes/accounts.mjs:751 addEntry ← invoiceEntry (:1738) ← routes/invoices.mjs writeIssued (:2431); Düzenle (POST invoices/:id/edit :3102: eski satır silinir, yenisi yazılır — özeti aynı satır olayını korur, :1003–1021) | account_entries (source invoice) |
| 6 | Taksit tahsilatı / iadesi (nakit) | routes/plans.mjs:924 (POST plans/:id/entries :890); düzeltme :988 (PUT :939) | plan_entries |
| 7 | Kayıt (dosya) tahsilatı | routes/workspace.mjs:438 (POST cases/:key/payments :415); düzeltme :485 (PUT payments/:id :463) | payments |
| 8 | Taksite Aktar / geri alması (kayıt ve cari tahsilatı ↔ kart) | routes/plans.mjs:1628 adoptPayment; routes/plan-transfer.mjs:662, :677 (imports/:id/undo) — satır tablo değiştirir, olay (İşlem No) aynı | plan_entries ↔ payments / account_entries |
| 9 | Çekin / senedin Kasa'dan tahsili; verilen evrakın nakit ödemesi | routes/cheques.mjs:341 writeEvent ← POST cheques/:id/actions (:578, action collect / pay, method cash) | cheque_events |
| 10 | Kasa'ya yansıyan stok (peşin nakit alım / satış / iade) | routes/stock.mjs:368 insertMove ← POST stock/:id/moves (:427), stok açılışı (:258); düzeltme :544 (PUT :496) | stock_moves (pay cash) |
| 11 | Mobil yazma (telefondan tahsilat / ödeme) | lib/mobile-write.mjs → yukarıdaki uçlar (aynı bank.post) | 4, 7 |
| 12 | Silinenler'den geri yükleme | routes/trash.mjs:369 (tahsilat), :427 (Kasa hareketi + transfer ikizi), :483 (taksit hareketi); accounts.restoreEntry (:1907), stock.restoreMove (:817) trash.mjs'ten çağrılır | hepsi |
| — | Para satırı DEĞİL (S12 dışı) | çekin alındı / verildi / ciro / karşılıksız olayları, cari Borç / Alacak Yaz ve açılışı, taksit açılışı (opening = 1), çekle sayılan taksit tahsilatı (cheque_id), açık hesaba stok, POS kesintisi (source bank, kart yolu), Banka Fişi (bank_lines) | — |
| — | Yalnız bağ / açıklama (tarih ve yol değişmez) | lib/bank/accounts.mjs:1047, :1050 (Bu Hesaba Ata), lib/bank/repair.mjs:129, lib/bank/post.mjs:239 (fin_ref), dataset-bonds.mjs:593 (case_key), invoices.mjs:2626 (invoice_id), plans.mjs:416 / :797 (item_id) | — |
| — | Ayrı bağlantı / ham (kapı dışı) | şirket yedeğinin geri yüklenmesi (ayrı bağlantı — S20 "aynen"), göçler (store.raw), Şirket Verisini Sıfırla | — |

## 2. Ortak denetimin yeri ve kuralı
### 2.1 Yer: mutabakat kapısının yanındaki COMMIT denetimi (tek yer)
Para satırı yazan her yol `bank.post`'tan geçer ama nakit satırı için banka hesabı seçimi (`module-ref.mjs pickRef`) her yolda ÇAĞRILMAZ (Kasa Giriş / Çıkış, Vergi Ödemesi,
Taksite Aktar, Silinenler, peşin nakit — nakit dalı `family = ""` ile hemen döner). Yol başına çağrı eklemek (a) yasaklı dosyalara (routes/accounts.mjs, invoices.mjs,
plans.mjs …) dokunur, (b) yeni bir yolda unutulur. Bu yüzden denetim `store.addCommitGuard` (lib/db.mjs'in kamu API'si; mutabakat kapısı da böyle kurulur) ile en dış
işlemin COMMIT'inden hemen önce, işlemde YAZILAN para satırlarına (kapsam: `scope.rows` eklenen / düzeltilen satırlar, `scope.before` önceki hâller) uygulanır:
- YENİ dosya yok: `server/lib/cash-opening.mjs` → `installCashOpeningGuard(store)` (kural, önbellek, geri yükleme kapsamı), `cashBeforeOpening(store, money)` (uyarı satırları).
- Kurulum: `routes/cash.mjs registerCashRoutes` (şirket başına bir store → bir denetim; Mutabakat kapısından ÖNCE kurulur → reddin nedeni önce söylenir).
- Sıfır maliyet yolu: işlemde para tablosu yoksa ya da yazılan satırların hiçbiri nakit değilse açılış hiç okunmaz.

### 2.2 Kural (S12 + T12)
D = Kasa açılış tarihi (`cash_entries.is_opening = 1`, işaretli nakit giriş; yoksa kural yok — T11). İşlemde yazılmış (eklenen ya da düzeltilen) her NAKİT satırı R için,
R.tarih < D ise:
1. R'nin önceki hâli P bulunur (§2.3). P var ve P de nakit hareketi ve P.tarih = R.tarih → KABUL (tarih değişmedi: S26 / S40 / S44; uyarı sürer).
2. P var ama tarih değişmiş ya da P nakit değildi (havale → nakit, açık hesap → peşin) → 409 `cash-before-opening` (T12 / B11: düzeltme de red; kayıt olduğu gibi kalır — ROLLBACK).
3. P yok: işlem Silinenler geri yüklemesiyse KABUL (S20 + Z9), değilse 409 `cash-before-opening` (S12).
R.tarih = D ya da sonrası → kural yok (aynı gün olur — T10). Silme hiçbir zaman reddedilmez.
409 gövdesi: `{ code: "cash-before-opening", field: "date", date, openingDate }`; ileti: "İşlem tarihi (gg.aa.yyyy) Kasa açılışından (gg.aa.yyyy) önce; o günlerin nakdi Kasa
açılış bakiyesinin içindedir (iki kez sayılır). Tarihi açılış günü ya da sonrası yapın; hareket gerçekten açılıştan önceyse yönetici Kasa → Açılış Bakiyesi'nin tarihini öne
alabilir." (banka metninin ikizi; çıkmaz yok — açılışı öne almak serbest, T11). Düzeltmede "Düzeltilen tarih …".

### 2.3 Önceki hâl (kimlik) — aynı kayıt mı?
Aynı işlemde bir satırın önceki hâli şu sırayla eşlenir (ilk eşleşen):
(a) aynı tablo + aynı `id` (UPDATE; aynı kimlikle sil + yaz); (b) aynı `event_id` (İşlem No) — Taksite Aktar / geri alması, fatura Düzenle'de özeti aynı peşin satır;
(c) faturanın peşin satırı: aynı fatura (`source = 'invoice'`, `source_id`) ve aynı gün, işlemde silinmiş nakit satırı — fatura Düzenle peşin satırı her zaman silip yeniden
yazar; tutar değişince yeni olay açılır (invoices.mjs:1003–1021) → (b) tutmaz; faturanın kendi peşini aynı gün kaldıkça "aynı kayıt"tır (S26: tutar düzeltmesi).
Rowid eşlemesi KULLANILMAZ (SQLite en büyük rowid'i yeniden verir: silinen başka satırın rowid'i yeni satıra geçebilir).

### 2.4 Geri yükleme kapsamı (S20, Z9)
`routes/trash.mjs` Silinenler'in geri yükleme ucu, para satırı geri getiren her dalı `restoringCash(store, fn)` içinde çalıştırır (tahsilat, Kasa hareketi + ikizi, taksit hareketi,
cari hareketi, stok hareketi, fatura). Kapsam yalnız o çağrının işlemine uygulanır (eşzamanlı başka istek etkilenmez: denetim eşzamanlı, düğüm tek iş parçacığı; derinlik sayacı
+ finally). Kapsam S12'yi (madde 3) kaldırır; tarih / tutar kuralları (dönem kilidi, ileri tarih) aynen. Yedek geri yükleme (Yedekler → Geri Yükle) ayrı bağlantıdır → veri aynen.
Carinin / kartın / çekin Silinenler'den dönmesi para satırına dokunmaz (yalnız üst kayıt) → denetim görmez, satırlar aynen görünür.

### 2.5 Açılış tarihinin önbelleği (ders 47)
Açılışsız şirkette `SELECT … FROM cash_entries WHERE is_opening = 1` tam taramadır: 101.554 Kasa satırında 38 ms (ölçüldü; açılış varken tarih indeksiyle 0,003 ms). Her nakit
yazımında çalışacağı için store başına önbellek: değer + damga (`changeCounters()`: data_version ve izlenmeyen yazım sayısı = total − tracked). Geçersiz: başka bağlantı yazdı
(data_version), store dışı yazım oldu, ya da işlemde açılış satırına dokunuldu (bu işlemin önceki ya da yeni hâlinde `is_opening = 1` — o işlemde yeniden okunur, COMMIT'ten
sonra düşer; geri alınırsa düşer). Bütçe (§7): nakit yazımında ≤ +2 ms ya da ≤ %5, olay döngüsü değişmez.

## 3. Uyarı denetimi (S20; Mutabakat Testi)
`lib/integrity.mjs run()` YALNIZ tam taramada (açılış, Mutabakat Testi, arka plan taraması, Defter Mutabakatı — `ledger:rule-diff` ile aynı yer; COMMIT kapısında YOK: kapı
geri yüklemeyi reddetmesin): `{ code: "cash:before-opening", name: "Kasa Açılışından Önce Tarihli Hareket", ok: count === 0, count, severity: "warning", hint, sample }`.
Satırlar money-lines'tan (görünür nakit satırları, `before: D`): sample "Kaynak · kimlik · tarih". Açılış yoksa ya da satır yoksa denetim listede YOK (denetim sayısı 2.4.9 ile
aynı). Düzey uyarı: Mutabakat Testi ok = false (gizlenmez, G4 / dates:future gibi), kapıyı ve yazımı engellemez. Açılış öne alınınca kalkar (s71).

## 4. S45 ve S40'ın "cari" parçası programda
- Cari tahsilat / ödemesinin düzeltmesi (PUT /accounts/:id/entries/:entryId) carisini DEĞİŞTİRMEZ (gövdede cari yok; `UPDATE account_entries` SET listesinde account_id yok —
  routes/accounts.mjs:1110). Taksit tahsilatı kartın satırıdır (kart / cari alanı yok, plans.mjs:988). Kayıt tahsilatı, Kasa Giriş carisizdir. → S45'in reddedeceği istek
  programda kurulamaz (red kendiliğinden); S40'ın "cari düzeltmesi KABUL" parçası da kurulamaz.
- ÇIKMAZ (yeni, S12'den): yanlış cariye girilmiş, geri yüklenmiş açılış öncesi nakit tahsilatının doğru cariye alınması bugün "sil + doğru cariye yeniden gir" iledir; S12 bu
  yeniden girişi (yeni hareket) reddeder. Yol: önce Kasa açılışını öne almak (yönetici). → BAŞ MİMAR KARARI GEREKİYOR (§8 B-K1); bu pakette kod yok (routes/accounts.mjs Ç5-A /
  Ç5-B'nin dosyası).
- S44 alanları programda: Kapatılacak Fatura (invoice_id) ve Normal Cari Hesaba İşle (doubtful_skip) PUT ile düzeltilir (tarih aynı → kabul); "taksit kartı bağı" değişikliği
  (cari tahsilatını karta / kartlar arası taşıma) programda tek kayıt düzeltmesi olarak YOK (Taksite Aktar yalnız tablodan kayıt tahsilatı için).

## 5. R8 / EK-2B 33 (kod denetimi)
- Giriş: POST /cash/opening → `assertOpening` (routes/cash.mjs:264–270): tarih > ilk nakit hareketi (açılış hariç, `firstCashMovement`) → 409 cash-opening-after-first.
- Düzeltme: POST /cash/opening (var olan açılış, :348–351 prepare) ve PUT /cash/:id (açılış satırı, :516 `openingAfter` → :533 assertOpening) — tarih VE tutar düzeltmesinde
  koşul aynı (yalnız tutar değişip tarih ilk hareketten sonraysa da 409; ilk hareket geri yüklenmiş açılış öncesi satır olabilir — Y16 "geri yüklenen dahil").
- Silinenler'den açılışın geri yüklenmesi: trash.mjs:401–403 aynı kural (kâhin Y15 R8'i geri yüklemede uygulamaz — senaryo yok, DENENMEYEN; bugünkü kural kalır, §8 B-K2).
- Kasa ↔ açılış dönüşümü: işaret düzeltmeyle değişmez (PUT /cash/:id `is_opening` yazmaz; açılış çıkışa çevrilemez :519); başka yol `is_opening` yazmaz (göç 22 hariç) → dönüşüm yolu YOK.
- Açılış silinir, araya hareket girer, açılış geri yüklenir: geri yükleme R8'le reddedilir (hareket açılıştan önceye düşemez) — X13 durumu programda oluşamaz.

## 6. Testler (her karar ≥ 1 test + karşı mutant; eski kodda f5903164 BEKLENEN NEDENLE kırmızı)
`test/kasa-acilis-once-250.test.mjs` (birim + API, iki TZ):
- S12 yol tablosu: §1'in yolları (1 Kasa Giriş, 1b Kasa Çıkış, 2 Bankadan Kasaya, 2b Kasadan Bankaya, 3 Vergi Ödemesi nakit, 4 cari nakit tahsilat, 4b cari nakit ödeme, 5 satış faturası
  peşin nakit, 5b satıştan iade nakit para iadesi, 6 taksit tahsilatı nakit, 7 kayıt tahsilatı, 9 çekin Kasa'dan tahsili, 9b verilen çekin nakit ödemesi, 10 nakit stok alımı) × (açılıştan
  bir gün önce → 409 + veri tabanında satır yok / aynı gün → 200 / sonra → 200); nakit OLMAYAN eşleri (havale, açık hesap, çek alma) açılıştan önce 200.
- Açılışsız Kasa: açılıştan önceki her tarih 200; açılış sonradan girilir (≤ ilk hareket) → kural işler; açılış öne alınır → kural yeni tarihle.
- T12 / B11: Kasa Giriş, cari tahsilat, kayıt tahsilatı, taksit tahsilatı, stok, transfer düzeltmesinde tarihi açılıştan önceye çekme 409 (satır değişmez); havale → nakit çevirme
  (açılıştan önce tarihli) 409; açılıştan önce tarihli satırın açılıştan SONRAYA alınması 200 (uyarı kalkar).
- S20: v2.4.9'un GERÇEK koduyla (`git archive v2.4.9`, ayrı kopya) üretilmiş veri — açılış 01.02, sonra 20.01 Kasa Giriş, 25.01 cari nakit tahsilat (2.4.9 S12'yi bilmez) — (a) göç
  (aynı klasör 2.5.0 ile açılır), (b) yedek (2.4.9 yedeği → 2.5.0 Yedekler → Geri Yükle): satırlar aynen, Mutabakat Testi `cash:before-opening` uyarı (count 2), Mizan aynı.
- S26 / S40 / S44 (bu veride): tutar, açıklama, Kapatılacak Fatura bağı (ekle / kaldır / başka fatura), Normal Cari Hesaba İşle düzeltmesi 200 + uyarı sürer; aynı düzeltmede tarih
  açılıştan önceki başka güne → 409 (tutar da yazılmaz).
- Z9: Silinenler'den geri alınan açılış öncesi Kasa hareketi / tahsilat / taksit hareketi / transfer 200 + uyarı; ardından tutar düzeltmesi 200; tarih düzeltmesi 409.
- S45: programda cari değiştirme isteği kurulamaz (gövdedeki `accountId` yok sayılır; satır carisinde kalır) — test bunu gösterir (§4).
- S54–S57: "S5x yanıtı bekleniyor" işaretli; bugünkü davranış ölçülür, beklenti olarak sabitlenmez (yalnız gözlem).
- Gün dönümü / iki TZ: sahte saat (config.now) açılış günü 00:30 ve 23:30 İstanbul; aynı gün kabul her iki TZ'de. Aynı adlı iki cari (biri açılış öncesi reddedilen, öbürü aynı gün
  kabul). İki şirket: 001'in açılışı 002'yi etkilemez (002'de açılışsız, aynı tarih 200).
- Karşı mutantlar (`test/kasa-acilis-once-250-mutasyon.mjs`, ayrı kopyada): denetimi kaldır; bir tabloyu (cheque_events / stock_moves / payments) denetimden çıkar; aynı günü reddet
  (`<=`); düzeltmede önceki hâli yok say (S26 red); geri yükleme kapsamını kaldır (Z9 red); kimlik eşlemesinde (b) / (c) yok (Taksite Aktar / fatura Düzenle red); uyarıyı kaldır;
  önbelleği hiç düşürme (açılış öne alınınca eski tarih). Hepsi yakalanmalı.

## 7. Hacim bütçesi (ders 47; ölçüm aynı veri kopyasıyla önce / sonra, flock scratchpad/olcum.lock)
| Yol | Bütçe | Ölçüm |
|---|---|---|
| Nakit yazımı (Kasa Giriş, cari nakit tahsilat) — 100.000+ nakit satırlı şirket (c3 ölçüm verisi 001: 178.610 nakit satırı) | ≤ +2 ms ya da ≤ %5 (medyan), olay döngüsü en çok değişmez | önce / sonra, açılışlı ve açılışsız |
| Açılış tarihi (önbellek ıskası, açılışsız, 101.554 Kasa satırı) | bir kez (önbellek) | 38 ms tam tarama → sonra 0 |
| Mutabakat Testi uyarı denetimi | tam taramaya ≤ +200 ms | önce / sonra |

## 7b. "Nasıl bozulur?" (önce yazıldı; testler buradan — tasarım §4 madde 12 + ekler)
1. Bir yol denetimden kaçar (Vergi Ödemesi, çek tahsili, stok, peşin, transfer, taksit, kayıt, mobil) — her yol ayrı test.
2. Aynı gün reddedilir (`<=`); bir gün önce kabul edilir (`<` yerine `<` yanlış alan: oluşturma tarihi, vade).
3. Açılışsız Kasa'da kural çalışır (boş tarihle karşılaştırma) → her nakit 409.
4. Düzeltme açığı: tarihi önceye çeken düzeltme geçer; ya da tarih değişmeyen düzeltme (S26) reddedilir; havale → nakit çevirme geçer.
5. Fatura Düzenle peşini silip yazdığı için açılış öncesi faturanın yalnız notu / tutarı düzeltilince 409 (yanlış red).
6. Taksite Aktar / geri alması (satır tablo değiştirir) açılış öncesi tahsilatı "yeni" sayıp reddeder.
7. Silinenler geri yüklemesi reddedilir (Z9) ya da geri yükleme kapsamı sızar (aynı anda başka istek, hata sonrası finally yok).
8. Yedekten / göçten gelen açılış öncesi satır bozulur, silinir ya da Mutabakat Testi'nde kırmızı (uyarı değil) / hiç görünmez; uyarı kapıyı tetikleyip geri yüklemeyi engeller.
9. Önbellek bayatlar: açılış girilir / öne alınır / silinir / başka bağlantı (yedek geri yükleme, iki süreç) yazar → eski tarihle karar.
10. Rowid yeniden kullanımı: silinen satırın rowid'ini alan yeni satır "önceki hâl" sanılır.
11. Saat dilimi: tarih metin karşılaştırması (YYYY-AA-GG) — gece yarısı İstanbul / UTC ayrışması (sahte saat), 31.12 / 01.01.
12. İki şirket: 001'in açılışı / önbelleği 002'ye sızar.
13. Aynı adlı iki cari: red yanlış cariye yazılmış gibi görünür.
14. Ret yarım yazım bırakır (fatura peşin reddi faturayı yazar) — ROLLBACK tam mı.
15. Hız: her nakit yazımında tam tarama (açılışsız 38 ms) — olay döngüsü kilitlenir.

## 8. BAŞ MİMAR KARARI GEREKİYOR / KULLANICIYA SORULMALI (kodlanmadı)
- **B-K1 (çıkmaz, §4):** geri yüklenmiş açılış öncesi nakit cari tahsilatının carisini düzeltmek (S40 = A "kabul") programda yok; S12 sonrası tek yol Kasa açılışını öne almak.
  Seçenekler: (a) cari hareketi düzeltmesine "Cari" alanı (yalnız bağsız satırda; bağlıysa S45 iletisi) — routes/accounts.mjs (Ç5-A / Ç5-B dosyası), ayrı iş — ÖNERİ; (b) BİLİNEN SINIR
  ("açılışı öne alın, silip yeniden girin, açılışı geri alın" — kilitli dönemde olmaz).
- **B-K2 (uç; kâhin Y15 ↔ program):** Silinenler'den Kasa AÇILIŞININ geri yüklenmesi ilk nakit hareketinden sonraysa program bugün 409 (R8); kâhin Y15 "R8 geri yüklemede uygulanmaz"
  okur (senaryo yok). Seçenekler: (a) bugünkü gibi red (açılış sonraya düşmez; X13 durumu oluşmaz) — ÖNERİ; (b) geri yüklensin, uyarı versin. Uç durum: "Uç durum böyle kalsın (BİLİNEN SINIR)".
- **B-K3 (fatura peşini):** açılıştan önce tarihli nakit peşinli fatura S12'de TAMAMEN reddedilir (kâhinde yalnız peşin tahsilatı — README bakım 3 "Sürücü için"); kayıt bütünlüğü için
  belgeyi yarım yazmamak doğru görünüyor (yaygın uygulama) — BAŞ MİMAR değerlendirir.
- S54–S57: SORULDU (yanıt yok) — kod değişmez. → GÜNCELLEME 06.11 (kullanıcı: S54–S57 = A; ana oturum kararı): S56 Ç5-K'de yalnız test + mutant (kural 2.3.0'dan
  routes/accounts.mjs:773 `assertNormalRoom` → 409 doubtful-normal-exceeds; kod değişmez). S54, S55, S57 Ç5-B'ye (routes/accounts.mjs PUT entries "Cari" alanı +
  bağlıysa 409; S54'te bağ yeni carinin belgesine; invoice-settle bağ tarihi). BAŞ MİMAR KARARI: S57 kayıt (cari hareketi) düzeyidir; taksit KARTININ carisinin
  tahsilatlarıyla birlikte değişmesi (plans.mjs:640–660) S57 kapsamında değil.

## 9. Uygulama (koddan sonra eklendi)
- Kod: `server/lib/cash-opening.mjs` (installCashOpeningGuard, restoringCash, cashBeforeOpening, isCashMovement, cashOpeningDate), `server/routes/cash.mjs` (kurulum),
  `server/routes/trash.mjs` (geri yükleme ucu restoringCash içinde; gövde restoreItem'e alındı), `server/lib/integrity.mjs` (yalnız `cash:before-opening` uyarısı,
  tam taramada). Göç YOK; defter kuralı değişmez (mizan v2.4.9 ile birebir — test).
- Önceki hâl eşlemesinde tasarımdaki (a)–(c)'ye iki ek: (d) olaysız (eski sürümden) silinen nakit satırı aynı gün ve tutarla başka tabloya taşınmışsa (Taksite Aktar)
  aynı kayıt; (e) bu işlemde EKLENİP düzeltilen satırın `scope.before`'daki eklendiği hâli önceki hâl sayılmaz (rowid > son COMMIT'teki en büyük rowid; başka bağlantı
  yazdıysa — data_version — eklenmemiş sayılır, kabul yönünde).
- Testler: `test/kasa-acilis-once-250.test.mjs` (41), `test/kasa-acilis-once-250-mutasyon.mjs` (19 karşı mutant, ayrı kopyada).
- Sürücü: `test/bagimsiz/muhasebe-surucu/program.mjs` — `yedekten` olayları v2.4.9'un gerçek koduyla (son `yedekten` olayına kadar; sonra göç), Kasa Giriş / Çıkış Sil ve
  Düzenle, cari / taksit tahsilatı Düzenle (tutar, tarih, açıklama, yol, Kapatılacak Fatura, Normal Cari), `mutabakat_uyarilari` raporu; uyarı düzeyindeki Mutabakat
  Testi sapması değişmezi bozmaz. `karsilastir.py` — `mutabakat_uyarilari` karşılaştırması. Programda yolu olmayan: cari değiştirme (uygulanmadı, Ç5-B), taksit kartı
  bağı değişikliği (api_yok → B-K4).
- **B-K4 (yeni; BAŞ MİMAR / ana oturum):** S44 = A "taksit kartı bağı düzeltilebilir" — programda cari tahsilatını karta, karttaki tahsilatı cariye ya da kartlar arası
  taşıyan tek kayıt düzeltmesi YOK (kâhin s81 #31 / #32 / #36, s82 #30). Yol hangi pakette (routes/plans.mjs + routes/accounts.mjs; Ç5-K dosyası değil)?
- **B-K5 (sürücü bakımı):** `karsilastir.py` son bölümündeki BUGÜN sezgisi (S12'den önce yazılmış "Kasa açılışından önce kabul edilen nakit = Ç5-S12 U") artık eski:
  geri yüklenen / açılıştan önce girilip açılışı öne alınan satırları da U sayıyor; asıl S12 karşılaştırması `redler`'de (hepsi AYNI). Görev metni sürücüye yalnız eşleme
  eklemeye izin verdiği için kaldırılmadı; kaldırılması ana oturum onayıyla.

## 10. Tur 2 (dar kontrol 10.11 bulguları; BAŞ MİMAR KARARI 10.11 "DK-D2C5K" — DURMA KURALI, yalnız bunlar; taban ad9f8769 = kod 78855096)
### 10.1 ORTA-1 (GERİLEME) — uyarı "sapma / Fark Var" gibi görünüyordu, ilk yazımı tam kapıya düşürüyordu
- Sorun: `cash:before-opening` (§3) `ok:false, severity:"warning"` dönüyordu ama ekran (admin.js) ve Defter Mutabakatı yalnız `legacy` alanına bakıyordu → Yönetim › Sistem'de
  kırmızı "1 denetimde sapma var", raporda "Fark Var" + "yöneticiye bildirin"; `familyOf` kodu tanımıyor → "all" → açılıştan sonraki ilk nakit yazımı TAM KAPI (105.000 satırda
  13 ms → 1.221 ms); geri yüklemeden sonraki tarama "kapının görmediği yeni sapma" günlüğü + zil. 2.4.9'da aynı veri "N denetim tamam"dı.
- KARAR (S20 = A "Mutabakat Testi uyarı verir"; sunum, para kuralı değil): denetim SAPMA DEĞİL UYARIDIR. Seçilen yol: denetime `notice: true` işareti (YENİ alan; `ok:false`,
  `severity:"warning"`, `failures` içinde kalır — gizlenmez, API biçimi ve `ok` anlamı değişmez). `legacy` düzeneği yeniden KULLANILMADI — gerekçe: (1) `legacy` hem
  ekranda hem raporda "eski sürümden kalan" metnini ve Sonuç'ta "Fark Var"ı getirir (Silinenler'den geri alınan satır için yanlış; raporun Sonuç'u legacy'de de "Fark Var");
  (2) kapı / tarama `legacy`'yi imzada `gateCount` olarak okur, ilk görünüşte yine "yeni sapma" sayılırdı. Yani `legacy` ile de aynı dört tüketici (ekran, rapor, kapı alanı,
  tarama) değişecekti; ayrı işaret daha az yer değiştirir ve anlamı tektir.
- Kime ne görünür:
  - Yönetim › Sistem (client/assets/admin.js): uyarılar sapma listesinden ayrılır. Başka sapma yoksa metin 2.4.9'daki gibi "Mutabakat: N denetim tamam — …" (N = uyarı hariç
    denetim sayısı = 2.4.9'daki sayı), ardından "Uyarı (yeni işlemleri engellemez): Kasa Açılışından Önce Tarihli Hareket — K hareket. <sunucunun hint'i>"; renk SARI
    (adm-warn-text). Gerçek sapma varsa kırmızı "… denetimde sapma var (…)" (uyarı listede YOK) + aynı uyarı cümlesi. Eski sürümden kalan satır (legacy) davranışı aynen.
  - Defter Mutabakatı (ekran / PDF / Excel aynı veri): satırın durumu "Uyarı"; Sonuç bu satır yüzünden "Fark Var" OLMAZ ("Tutarlı"); alt başlık 2.4.9'daki cümleden sonra
    "Uyarı (yeni işlemleri engellemez): … — K hareket (aşağıda “Uyarı”)." + hint; "yöneticiye bildirin" yalnız gerçek farkta.
  - Kapı (lib/integrity-scope.mjs familyOf): "cash:before-opening" → null (alanı yok; tam kapıyı tetiklemez). Ayrıca lib/integrity.mjs start(): taban, açılış günlüğü
    ("baseline") ve sunucu günlüğü yalnız sapmaları taşır (uyarı "güncelleme öncesinden kalan … sapma" yazılmaz) — iki kat koruma.
  - Tarama (settleScan; Mutabakat Testi ve iş parçacığı): uyarı "yeni sapma" sayılmaz — integrity_log "scan" ve zil (integrity.alert) yok; sayı artsa da (yeni satırı S12 reddeder).
- Kılavuz: Defter Mutabakatı cümlesine "Uyarı yazan satır fark değildir, ne yapılacağı raporun üstünde yazar" eklendi (HTML + PDF, pdf-denetle 39/39).
### 10.2 DÜŞÜK-1 — "bu işlemde eklendi" sezgisi (§9 (e)) dış yazımda kabul yönünde kapanıyordu
- Sorun: önceki hâl eşlemesi, bu işlemde EKLENİP düzeltilen satırın eklendiği hâlini "son COMMIT'teki en büyük rowid'den büyük" diye tanıyordu; başka bağlantı yazınca
  (data_version) "bilinmez → eklenmemiş" sayılıyordu (p12: RED → dış yazımdan sonra KABUL → RED). Bugün 19 API yolunun hiçbiri ekleyip aynı işlemde düzeltmiyor (ulaşılamaz),
  ama tetiklenirse açılıştan önce tarihli YENİ nakit kabul edilirdi (yanlış para) — sakınca süzgeci: bu turda kapatıldı.
- Çözüm (ortak katmana en az dokunan): lib/db.mjs işlem kapsamı iki küme daha tutar — `scope.inserted` (bu işlemde eklenen rowid'ler; eklemede) ve `scope.born` (önceki hâli
  YAKALANDIĞI ANDA bu işlemde eklenmiş satırın hâli olan rowid'ler; sil + aynı rowid'le yeniden ekle durumunda önceki hâl işlem öncesi satırdır, born DEĞİL). cash-opening
  `insertedHere` = `scope.born`. Dış yazım sonucu değiştirmez; COMMIT'ten sonraki MAX(rowid) okumaları (6 tablo) kalktı. Kapının (integrity-scope) okuduğu `rows` / `before`
  aynen.
### 10.3 DÜŞÜK-3 — yaşayan mutantlara test (yalnız test)
- K5 (açılış silinince önbellek), K6 (olaysız satırın Taksite Aktar'la taşınması — ön koşul bugün ürün yolundan kurulamaz: olay 2.1.0, Kasa açılışı 2.2.0, ilk hareketten
  sonraya açılış 409, Silinenler'den dönen olaysız satır yeni olay alır → satır 2.0.26 biçiminde yazılıp açılış taramasıyla benimsenir; kalan adımlar ürün yolu), K8 (başka
  bağlantı / store dışı yazım açılışı değiştirince önbellek; 002 + yedekten geri yükleme), K14 (uyarının örnek metni). K7 EŞDEĞER: "|| same[0]" yokken de aynı 409
  cash-before-opening (yalnız ileti / change alanı farklı).
### 10.4 Testler ve mutasyon
- `test/kasa-acilis-uyari-250.test.mjs` (7: temiz veri; denetim alanları + K14; tarama günlüğü / zil (iş parçacığı dahil, sayı artınca); Defter Mutabakatı ekran / PDF / Excel;
  familyOf; yeniden açılış — günlük + ilk yazımın kapı yolu `scoped`; gerçek sapmayla birlikte), `test/kasa-acilis-iz-250.test.mjs` (10: p12 dört adım; işlem kapsamı
  sözleşmesi; 19 yol × (dış yazım yok / var) 409 + aynı gün 200; K5; K6; K8 × 3), `test/e2e/senaryo-kasa-acilis-uyari-250.mjs` (Yönetim › Sistem + Raporlar ekranı;
  ci.yml + release.yml + kapı listesi). `test/kasa-acilis-once-250.test.mjs` DEĞİŞMEDİ (41/41).
- Mutasyon: `test/kasa-acilis-tur2-250-mutasyon.mjs` (U1–U9 bu turun ürün değişiklikleri, K5–K8, K14; K7 eşdeğer). Ölçüm: ana oturum sakin makinede (görev metni).
