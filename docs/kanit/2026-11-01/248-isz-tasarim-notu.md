# İŞ Z (2.4.8) — WhatsApp önizleme / başlatma ölçek düzeltmesi: TASARIM NOTU (kod yazılmadan önce; onay bekler)

Dal is/perf-248 (wt-perf-248), taban b2e7bf19. Yazan: İş Z düzeltme ajanı (xhigh). Tarih 01.11.2026 ~16:50 UTC.

## 1. Profil (ölçüldü; flock /tmp/destekofis-olcum.lock altında, T9 verisinin KENDİ kopyam)

Betik `test/isz-248/profil.mjs` (T9 düzeneğinin kopyası `test/isz-248/ortak.mjs`; gerçek program, sahte Meta ayrı süreç, saat 2026-11-02T10:00+03:00 sabit;
her önizlemenin çevresinde V8 profilcisi açık → işlev başına KAPSAYICI süre). Ham çıktı: `<not defteri>/isz-7d2f5a/profil-taban.json`, `profil-gecmis40.json`.

Taban (taban-2910: 3.014 cari, 57.227 cari hareketi, 94 kart; geçmiş YOK), 2.000 cari, profilci açık:

| önizleme | süre | olay döngüsü en çok | detail (kapsayıcı) | openingEntryOf | refundablesOf | entryStates | deleteBlock | gerekli çekirdek* | queued |
|---|---|---|---|---|---|---|---|---|---|
| Geçen Ay | 23,9 sn | 23,9 sn | 23,6 sn | **19,7 sn** | 1,0 | 0,92 | 0,68 | 0,78 sn | 0,06 |
| Bu Ay | 27,7 | 27,7 | 27,4 | **22,9** | 1,1 | 1,05 | 0,76 | 0,93 | 0,08 |
| Son 3 Ay | 25,7 | 25,7 | 25,4 | **21,2** | 1,1 | 0,95 | 0,70 | 0,81 | 0,07 |
| Tüm Hareketler | 25,6 | 25,6 | 25,4 | **21,2** | 1,2 | 0,93 | 0,68 | 0,82 | — |
| Ödeme Hatırlatma | 24,5 | 24,5 | 24,3 | **20,3** | 1,1 | 0,87 | 0,68 | 0,77 | — |
| Tümünü Seç (3.014) | 38,0 | 38,0 | 37,5 | **31,6** | 1,4 | 1,37 | 1,04 | 1,22 | 0,09 |

\* gerekli çekirdek = plan()'ın gerçekten kullandığı okumalar: accountRow + entriesOf (cari hareketleri) + plans().forAccount (taksit kartları) + accountLedger.

Geçmişli (gecmis-40: aynı cariler + 58 toplu iş, 80.126 iş satırı, defterde 72.155 talep): önizleme 26,1 / 26,1 / 28,1 / 29,0 / 25,8 / 41,4 sn (aynı sıra);
geçmişe bağlı ek maliyet (detail dışında): queued 0,49 sn (kişi başı bir sorgu × 2.000), defter sentBefore 0,33 sn (Geçen Ay) … **2,38 sn (Tüm Hareketler)**,
unsettledBefore 0,30 sn.

KÖK NEDEN (sayılarla): kişi başı `accounts().detail` (tam cari kartı) 2.000 × ~11,8 ms. Bunun %83'ü kartın EKRAN eki `openingEntryOf` (routes/accounts.mjs:546,
2.4.6 madde 12): `WHERE account_id = ? AND is_opening = 1 AND source = '' …` sorgusunu SQLite `idx_account_entries_source (source=?)` ile çalıştırıyor — `source = ''`
neredeyse bütün satırlar → her cari için ~57.000 satır taranıyor (EXPLAIN QUERY PLAN: "SEARCH account_entries USING INDEX idx_account_entries_source (source=?)").
Kalanı da ekran ekleri (geri ödenecek iadeler, fatura kalanları, silme engeli, şüpheli özeti). plan()'ın ihtiyacı olan çekirdek 2.000 caride ~0,8 sn.
Geçmişte ikincil: "Tüm Hareketler"in kişiye özel R3 sorgusu (defter.mjs SENT_BEFORE_SQL, sentBeforeKeyed) — `k.period_key IN (json_each)` claim_keys birincil
anahtarıyla (job_id, attempt, period_key=?) HER talep için listedeki HER anahtarla ayrı yoklanıyor: 72.000 talep × ~2.000 anahtar. Ölçüm (kendi kopyam, yalnız okuma):
2.000 kişi anahtarıyla 1.660–1.789 ms; aynı sorgu `+k.period_key IN (…)` ile (dizin yoklaması kapalı, üyelik geçici listede) **267–302 ms, aynı satırlar**
(0 / 16.000 satır, iki pencere). Genel anahtarlarla (3 anahtar) 558 → 455 ms.

## 2. Değişim (üç parça; davranış AYNEN)

### Z1 — plan()'ın cari okuması: tam kart yerine kartın ÇEKİRDEĞİ (TEK değişim yeri: queue.mjs plan() içindeki `load`)
- routes/accounts.mjs'e YENİ servis işlevi `waFacts(id, user)` (yalnız ekleme; detail() DEĞİŞMEZ):
  `account = accountRow(id)` (aynı sorgu, aynı silinmiş süzgeci, aynı 404) → `planList = plans().forAccount(account.id, user)` (aynı işlev) →
  `ledger = accountLedger(entriesOf(account.id), planList)` (aynı işlevler, aynı sıra) → `{ ...account, plans: <detail'deki AYNI eşleme>, ledger: ledger.lines, totals: ledger.totals }`.
  Kartın plan() kullanmayan ekleri okunmaz: açılış satırı (openingEntryOf), refundables, fatura kalanları (entryStates), silme engeli, şüpheli özeti, kart iadesi /
  iade etiketi / editable işaretleri. Detail'deki plan eşlemesi (id, name, refNo, status, state, totals, next, itemCount, registeredOn, total, coversBalance) tek
  yardımcıya alınır, detail() de onu kullanır (çıktısı bit bit aynı — yalnız kodun yeri).
- queue.mjs plan(): `accounts().detail(id, user)` → `accounts().waFacts(id, user)` (try/catch → null → "Cari Silinmiş" aynen); selection()'daki hazırlık denetimi
  `detail` yerine `waFacts`. **Gönderim anındaki okuma (queue.mjs ≈1157 `detail`) ve eligibility()/overdueOf() DOKUNULMAZ** — aynı kural tek yerde, iki çağıran.
- NEDEN AYNI SONUÇ: plan() karttan yalnız şunları okur (koddan sayıldı): id, name, phone, status, waOptOut, deletedAt/deleted_at (iki yolda da yok), totals.overdue,
  plans[].status / next.remaining / next.dueDate (overdueOf), ledger[].date (Tüm Hareketler'in ilk hareketi; queued / movedSentBefore / movedUnsettled'ın "all" satırları).
  Bunların HEPSİ detail()'de accountRow + forAccount + entriesOf + accountLedger'dan gelir; waFacts AYNI işlevleri AYNI girdiyle çağırır. Atlanan ekler bu alanlara
  girmez (accountLedger'a giden hareketlerin doubtfulSkip/doubtfulNormal/cardRefund işaretleri yalnız satır etiketidir; tarih, sıra ve totals.overdue bunlardan
  bağımsız — accountLedger koduyla doğrulandı: tarih/at sırası ve overdue yalnız kartların totals.overdue'su).
- BİLİNÇLİ TEK FARK (ONAY İSTENİR): eski kodda kartın bir EKRAN EKİ hata fırlatırsa (ör. fatura modülü bozuk veride entryStates) kişi önizlemede "Cari Silinmiş"
  görünüyordu; yeni kodda o ekler okunmadığından kişi önizlemede uygun görünür, gönderim anında (≈1157, tam kart) aynı hata yine "Cari Silinmiş" ile eler. Olağan
  veride fark yok (eşitlik testi ölçer). İstenmezse: waFacts ekleri de okur — o zaman kazanç yok, Z1 anlamsızlaşır.

### Z2 — "Zaten Kuyrukta" satırları plan() başında BİR sorguyla (queue.mjs queued)
- Bugün: kişi başı `SELECT … FROM wa_jobs j JOIN wa_batches b … WHERE j.account_id = ? AND b.kind = ? AND b.state IN ('running','paused') AND j.state IN (OPEN_JOB)`.
- Yeni: plan() başında aynı koşullarla (account_id koşulu olmadan) TEK sorgu → Map(cari → satırlar); queued() eşleşmeyi AYNI kodla (queueKeysOf / keyDayOfBatch /
  firstOfAll / sameKeys) bu satırlarda yapar. queued yalnız plan()'da çağrılıyor (grep); dönüşü yalnız doğruluk değeri olarak kullanılıyor (sıra önemsiz).
- NEDEN AYNI: plan() eşzamanlı (await yok) → kişi başı sorguların hepsi aynı anlık veriyi görüyordu; tek sorgu aynı satır kümesini verir (koşullar aynı, yalnız
  carilere göre gruplanır). Atomiklik: createBatch'te plan → iş satırı yazımı arasına await / setImmediate EKLENMEZ (bugünkü gibi eşzamanlı).

### Z3 — defter R3 sorgusunda dizin yoklaması kapatılır (defter.mjs SENT_BEFORE_SQL, tek karakter)
- `AND k.period_key IN (SELECT value FROM json_each(?))` → `AND +k.period_key IN (SELECT value FROM json_each(?))` (yalnız SENT_BEFORE_SQL; UNSETTLED_SQL'deki
  aynı yapı ölçümde 12–29 ms — dokunulmaz).
- NEDEN AYNI: SQLite'ta tekli `+` değer değiştirmez (belgede "no-op"); claim_keys STRICT TEXT, BINARY harmanlama (+ harmanlamayı korur), karşı yan json_each
  metni → karşılaştırma aynı; yalnız sorgu planı değişir. Ölçümde satır sayıları aynı; eşitlik testi satır satır karşılaştırır.
- Bu parça "kime kaç kez" çekirdeğinin sorgusuna dokunur (sonuç değil, plan). İstenmezse çıkarılır: o zaman geçmişli veride "Tüm Hareketler" önizlemesi ~+2 sn kalır
  (BİLİNEN SINIR; geçmiş büyüdükçe artar).

### Dokunulmayanlar
Eleme sırası ("Zaten Kuyrukta" → "Sonucu Belirsiz" → "Daha Önce Gönderildi"), dönem anahtarları (donem.mjs), sentBefore/unsettledBefore/movedSentBefore/
movedUnsettled/dropSettledSources mantığı, createBatch'in yazdığı satırlar ve sırası, retryFailed / sendAnyway (createBatch üzerinden aynı plan()), işçi ve gönderim
anı içerik hazırlığı, detail() ve cari kartı. Göç yok.

## 3. Beklenen süre (TAHMİN: profildeki çekirdek + kalan sorgular; profilcisiz biraz daha az — ölçümle doğrulanacak)
| durum | bugün | beklenen |
|---|---|---|
| taban 2.000 (her dönem, hatırlatma) | 22,5–27,7 sn | ~0,8–1,0 sn |
| taban Tümünü Seç 3.014 | 37,7–39,8 sn | ~1,4 sn |
| geçmişli 2.000 Geçen Ay / Bu Ay / Son 3 Ay | 26–28 sn | ~1,4–1,6 sn |
| geçmişli 2.000 Tüm Hareketler | 29,0 sn | ~1,5 sn (Z3'süz ~3,4 sn) |
| geçmişli Tümünü Seç 3.014 | 41,4 sn | ~2,0 sn |
| başlatma | 25,9 sn | önizleme + ~0,1 sn yazım |
Olay döngüsü kilidi aynı ölçüde (önizleme/başlatma yine eşzamanlı; bütçe içinde kaldığı için parçalama eklenmez).

## 4. Test matrisi
1. KALICI test `test/whatsapp-onizleme-olcek-248.test.mjs` (npm test'e girer; dar listeye eklenir), küçük veri, programın API'siyle:
   - T-a: önizleme (Geçen Ay, Bu Ay, Son 3 Ay, Özel, Tüm Hareketler, Hatırlatma) ve toplu iş açma sırasında `accounts.detail` çağrı sayısı = 0 (eski kodda = kişi
     sayısı → KIRMIZI, ileti "kişi başı tam cari kartı okundu: N"); gönderim anında (işçi) detail çağrılır (dokunulmayan yol hâlâ kartı okur).
   - T-b: önizlemede "Zaten Kuyrukta" sorgusu (wa_jobs ⋈ wa_batches, running/paused) sayısı = 1 (eski kodda = kişi sayısı → KIRMIZI).
   - T-c: defterin R3 kişiye özel sorgusunun planında claim_keys "period_key=?" dizin yoklaması YOK (EXPLAIN QUERY PLAN; eski kodda VAR → KIRMIZI). (SQL metnine
     erişim için defter.mjs yalnız test amaçlı `SENT_BEFORE_SQL` dışa aktarır — onay istenir; istenmezse T-c kaynak tarayan bir denetime iner.)
   - T-d (eşitlik, kalıcı): sınıflar — olağan, silinmiş, pasif, "WhatsApp Mesajı İstemiyor", telefonsuz, geçersiz / yurt dışı / sabit hat, aynı telefonlu iki cari,
     gecikmiş borçlu / borçsuz (taksit kartı), kapatılmış kartlı, hareketsiz, yalnız ileri tarihli hareketli, iki şirket — her cari için `waFacts` ↔ `detail` plan()
     alanlarında DERİN EŞİT; önizlemenin eleme nedenleri sınıf tanımından beklenen değerlerle (kâhin = sınıf tanımı, programın çıktısı değil).
   - MUTASYON (ayrı kopyada, ders 23): M1 waFacts waOptOut'u 0 okur, M2 waFacts kartları boş verir (gecikmiş borç yok), M3 Z2 sorgusu 'paused'ı unutur,
     M4 Z3 `+` kaldırılır → her biri en az bir denetimde KIRMIZI.
2. BÜYÜK VERİ EŞİTLİĞİ (betik, kanıt; `test/isz-248/esitlik-*.mjs`): ESKİ kod (git archive b2e7bf19, ayrı kopya) ↔ YENİ kod, aynı veri kopyası, aynı sabit saat,
   aynı işlem dizisi, çıktılar normalleştirilip (rastgele toplu iş/iş kimlikleri ve wamid ilk görülme sırasıyla) DERİN EŞİTLİK:
   veri A = taban-2910 göç + sınıf hazırlığı @ 2026-11-02; B1 = gecmis-40 + hazırlık (+8 toplu iş "taşınan" defter) @ 2026-11-02; B2 = aynı @ 2026-03-26 (geçmişin
   ayı: Daha Önce Gönderildi / 7 gün penceresi gerçekten eşleşir). Adımlar (veri başına ~70): 8 dönem (Geçen Ay, Bu Ay, Son 3 Ay, Tüm, Özel=Geçen Ay, Özel=Bu Ay,
   Özel 2026-02, Özel aralık) × sendAgain false/true; Hatırlatma ×2; Tümünü Seç ×2; belirsizli carilerle önizleme + açma (Sonucu Belirsiz, uncertainOpen iletisi);
   Başarısızları Yeniden Dene ×4 (zincir dahil); Yine de Gönder ×4; kuyruk açma (Geçen Ay 600, Tüm 600, Hatırlatma) + aynı istek kimliği + 9 kuyruklu önizleme; iptal;
   30 kişilik gerçek gönderim (işçi boşaltır) → gönderim sonrası 17 önizleme (Daha Önce Gönderildi + sendAgain) + 2 açma (biri hepsi elenir → ret iletisi); 2. şirket
   (bağlantı + 6 önizleme + açma + kuyruklu önizleme). Her adımda yanıt kodu + gövdenin tamamı + açılan işin bütün kişi satırları. Ölçüt: fark 0.
   Ek: Z3 için defterde özgün ↔ yeni SQL, gerçek parametre kümeleriyle (bütün dönem anahtarları, gerçek kişi anahtarları) satır satır eşit.
3. SÜRE önce/sonra (aynı veri, aynı betik, profilcisiz, 2 koşu, flock): taban 2.000 her dönem + hatırlatma, Tümünü Seç 3.014, başlatma 2.000 ve 3.014; geçmişli
   2.000 her dönem; p50 / en çok + olay döngüsü en çok. Kırılgan zaman eşiği kalıcı teste girmez.
4. Bitiş: WhatsApp dar listesi (önceki ajanların 94 dosyası + yeni test + mobil-ozet-247 / mobil-ozet-olcek-247) UTC + Europe/Istanbul; 5 WhatsApp e2e; T9
   önizleme/başlatma ölçümünün yeni kodla tekrarı. Tam npm test YOK (adayda). Kanıt `tools/kanit.mjs kos` → docs/kanit/2026-11-01/248-isz-*, ayrı "Kanıt:" commit'i.
   Commit'ler: (1) kod (accounts.mjs waFacts + plan eşleme yardımcısı, queue.mjs load + queued, defter.mjs +), (2) testler + test/isz-248 betikleri, (3) kanıt.

## 5. KÖR NOKTA (bu işin kapsamı DIŞI — öneri)
`openingEntryOf`'un sorgu planı her cari kartı açılışında ~10 ms (57.000 satırda; satır sayısıyla doğrusal — 1.000.000 satırda ~150 ms tahmin) ve gönderim anında
her iletide aynı maliyet. Düzeltme tek satır (`+source = ''` ya da INDEXED BY idx_account_entries_account) ama cari kartının ortak yolu (ders 10: detail, setOpeningDue,
1823 bayrak yolu) → öneri 2.4.9 (DURDURMA KURALI: yalnız YÜKSEK/ORTA). Ana oturum isterse ayrı commit olarak bu işe eklenebilir.

## 6. Ana oturumdan istenen onaylar
(a) Z1 + Z2 (zorunlu çekirdek), (b) Z3 (defter sorgu planı; istenmezse BİLİNEN SINIR), (c) §2 Z1'deki hata durumu farkı, (d) T-c için defter.mjs'den test amaçlı
SQL dışa aktarımı, (e) KÖR NOKTA §5 bu işte mi 2.4.9'da mı.

## 7. EK (ana oturum isteği, 16:5x UTC): (A) / (B) / (A+B) yan yana — ölçümle
(A) openingEntryOf sorgusu doğru dizinle (göç GEREKMEZ; var olan idx_account_entries_account): `+source = ''` ya da `INDEXED BY idx_account_entries_account`.
Ölçüm (kendi kopyam, salt okuma, 3.014 carinin TAMAMI; `<not defteri>/isz-7d2f5a/acilis-olc.mjs`): özgün 30.027 ms (cari başına 9,963 ms; plan "idx_account_entries_source
(source=?)"), `+source` 118 ms (0,039 ms; plan "idx_account_entries_account (account_id=?)"), INDEXED BY 117 ms; SONUÇ 3.014/3.014 birebir aynı (isDeepStrictEqual).
INDEXED BY dizin yoksa hata verir → tercih `+source`. openingEntryOf'u kullanan yollar (ders 10): detail() (→ cari kartı GET ve yazım sonrası yanıtlar, WhatsApp işçisi gönderim
anı queue.mjs:1157, elle gönderim /whatsapp/targets, ekstre overview.mjs:322, report-center.mjs:1741, plans.mjs:429/481, stock.mjs:442, plan-transfer.mjs:155,
invoices.mjs:801), setOpeningDue (PUT cari), restoredOpening (Silinenler'den geri yükleme). Hepsi yalnız ilk satırı (rowid sırası) okur → aynı satır = aynı sonuç.
Beklenen: (A) yalnız → detail ~11,8 → ~1,9 ms/cari → önizleme 2.000'de ~3,8 sn, 3.014'te ~5,7 sn (bütçe DIŞI; geçmişte +0,5–2,4). (B) yalnız (Z1+Z2+Z3) → ~0,8–1,6 sn
(bütçe İÇİ). (A+B) → önizleme (B) ile aynı; ek kazanç cari kartı açılışı ve gönderim anı (~10 ms/ileti) — KARAR (ana oturum): (A) bu işte YOK → 2.4.9.
İstemcinin 30 sn zaman aşımı: düzeltmeden sonra önizleme/başlatma 2.000–3.014 caride ~1–2 sn → 30 sn sınırına yaklaşmaz, "Sunucu zamanında yanıt vermedi" bu ölçekte
sorun olmaktan çıkar (5.000 kişilik üst sınırda da tahmin ~3 sn); zaman aşımında aynı istek kimliğiyle ikinci iş açılmaması zaten korunuyor (T9 tumunu-sec-baslat).

## 8. ONAY (ana oturum, 01.11.2026 ~17:00 UTC)
(a) Z1+Z2 ONAY, (b) Z3 ONAY (yalnız SENT_BEFORE_SQL'de `+`; özgün ↔ yeni SQL gerçek parametre kümeleriyle satır satır eşitlik ŞART), (c) hata durumu farkı ONAY (teslim
notunda "davranış notu"), (d) test amaçlı SQL dışa aktarımı ONAY (adı açıkça test amaçlı), (e) openingEntryOf → 2.4.9.
EK ŞARTLAR: (1) plan eşlemesi ortak yardımcıya taşındığı için GET cari detayı ESKİ ↔ YENİ birebir: taban-2910'da 3.014 carinin tamamı derin eşitlik + kalıcı testte bir
denetim; detail()'i kullanan testler dar listeye (liste kanıta), iki TZ. (2) createBatch'te await / sıra verme YOK. (3) M5: plan eşleme yardımcısında alan yanlış → cari
kartı eşitliği KIRMIZI. (4) kalıcı testlerin eski kodda beklenen nedenle kırmızı iletileri kanıta. (5) ağır koşular flock ile.
