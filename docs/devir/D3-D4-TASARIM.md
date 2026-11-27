# D3 / D4 — Devir planının bugünkü koda karşı okunması ve tasarım notu (2.5.1, P-D)

Hazırlayan: P-D ajanı (high), 27.11.2026. Taban `t251-taban` (64396478). KOD VE TEST YAZILMADI — yalnız belge. Görev metni `docs/devir/2.5.1-DEVAM/pd-istem.txt`.
Kaynaklar: `docs/devir/DEVIR-PLANI.md` (G bölümü geçerli), `docs/devir/D2-ALTYAPI-TASARIM.md` (§12 sözleşme), `docs/erp/MUHASEBE-CEKIRDEGI-PLANI.md` §13–§14, kural kitabı + EK-1 / EK-2 / EK-2B
(3-M, 3-N, §5, §6, KG, M1–M14, S. 23–40), tasarım notları C2 §11, C3 §4 / §11, C5 §2, C5B §3, C6 §1 / §3 / §5 / §8, iş listesi 2.5.0 A / B / D, kod (aşağıda dosya:satır, taban
`t251-taban`). Kâhin MODEL kodu okunmadı; muhasebe kâhini README'sinin yalnız giriş / senaryo dili / dallar / değişmezler bölümleri okundu (README henüz "güncel kurallar dizini"ne
bölünmemiş — 2.5.1 iç işi).
Bölüm 5 (sorular) ve 7 (kâhin girdisi) `docs/devir/2.5.1-DEVAM/pd-rapor.md`'de. `DEVIR-PLANI.md`'ye dokunulmadı; eskiyen yerleri §1.3'te ve raporda.

Kısaltmalar: K = kesim tarihi (yalnız 31 Aralık, EK-1 M11); G = 519 Eşleştirilecek Açılış Bakiyeleri; TYK = tek yükümlülük kuyruğu (Ç5-B); CH = cari kontrol hesabı (120 / 320 / 336).

---

## 1. Plan ↔ kod eşlemesi

### 1.1 Planın adımları bugün neye dayanacak

| Plan adımı | Bugünkü kod (dayanak) | Durum / D işi |
|---|---|---|
| G1.1 bakım kipi (001 dahil 503, arka plan yazıcıları, güncelleme tutması) | `server/lib/devir/maintenance.mjs:40` createMaintenance (`run`, `enter`, `exit`), `:196` applyWriteGuard (001 geçici tetikleyiciler); `server/app.mjs:394` canWriteInBackground; `server/lib/update-orchestrator.mjs:61-67` update:hold | HAZIR (D2). D4 `maintenance.run(şirket, { reason: "devir", runId }, fn)` içinde çalışır (D2 §12) |
| G1.2 / G5 kalıcı devir yedeği | `server/lib/devir/devir-backups.mjs:61` createDevirBackup; `server/lib/company-backups.mjs:750` createDevirBackupFor | HAZIR; ama `devir-backups.mjs:101` `renameSync(partial, final)` YENİDEN DENEMESİZ (26.11 Windows CI EPERM) → D4 ÖN KOŞULU (§4.9) |
| G1.3 kopyada üretim (VACUUM INTO, worker) | `server/lib/backup.mjs:152` ve `server/lib/company-separate.mjs:57` VACUUM INTO; worker deseni `server/lib/financial-statements-worker.mjs:15-40` (salt okunur bağlantıda router kurup hesap), `server/lib/ledger-freeze-worker.mjs:18` | YOK — D4 yazar (worker'da YAZILABİLİR kopya bağlantısı; bugünkü işçiler hep salt okunur) |
| G1.4 değişmezler kopyalarda | Mizan `server/lib/general-ledger.mjs:950` trialBalance, `:987` reconcile; beklenenler `server/routes/ledger.mjs:340` expected; Mutabakat `server/lib/integrity.mjs:480` run; bilanço / dönem sonucu `server/lib/financial-statements.mjs:213` incomeStatement, `:609` balanceSheet | Hesap işlevleri HAZIR; devir değişmezlerini koşan katman YOK (D3 saf hesap + D4) |
| G1.5 takas 002+ / 001 | `server/lib/company-backups.mjs:221` swapInRestoredFile, `:648` stageRootRestore (`devirCheck`), `:680` restoreCompany (`allowPaused`), `:130` transplantCommon, `:246` applyStagedRestore | HAZIR desen; `swapInRestoredFile` içindeki `renameSync` (:242) YENİDEN DENEMESİZ (ders 48) |
| G1.6 arşiv kaydı + diskten tanıma | `server/lib/companies.mjs:475` createArchiveRegistry (`:487` addArchive, `:495` updateArchive, `:501` removeArchive, `:519` reconcileArchives); `server/lib/devir/archives.mjs:17-27` (yol, işaret anahtarları `devir.archive` / `devir.years`), `:189` adoptionOf | HAZIR (D2). Sıra şartı D2 §2: arşiv dosyası `arsiv/<yıl>/`'a takasla aynı adımda |
| §2.2 / G8 arşivde yazma yasağı, salt okunur örnek | `server/app.mjs:698` assertArchiveWritable, `:196` writeGate, `:799` openArchive; `server/lib/devir/archive-open.mjs:172` prepareArchive (iki aşamalı göç `:120`, yeniden denemeli taşıma `:95`) | HAZIR (D2). Devri Yenile için YAZILABİLİR arşiv örneği YOK (D2 §12) → D4 |
| §2.3 / G6 arşivin göçü, şema kapısı | `server/lib/devir/archive-open.mjs:120` migrateArchive; LATEST_VERSION `server/lib/migrations.mjs:2246` (= 54) | HAZIR. 2.5.1'in devir göçü (§4.3) 55+ olur → 2.5.0 o dosyayı BS-7 kapısıyla salt okunur açar (G6 deseni tutar) |
| G2 açık kalem (AYRI AÇIK KALEM) | TYK: `server/lib/obligation-queue.mjs:107` buildObligations → `:1266` `items` (side, vade, remaining, doubtful), `:43` lockHistory; toplu girdi `server/lib/obligation-input.mjs:106` batchSettleInput; toplu kullanım örneği `server/routes/invoices.mjs:724-735`; satır alanları `account_entries.source / source_id / invoice_id / due_date / expected_date / is_opening / refund_of` (`migrations.mjs:602-616`, `:1089`, `:1336-1337`, `:1362`, `:1385`) | Kaynak HAZIR (Ç5-B). Plan "invoice-settle.mjs:166-180" diyor → ESKİDİ (§1.3). Kapsam M2 A ile fatura dışına genişledi |
| G2 cari net açılış (iki satır / tek satır), defterde tek net madde (KG-17 / M3) | Cari açılış işareti `account_entries.is_opening` (göç 35, `migrations.mjs:1362`); açılış tanıma `server/lib/general-ledger.mjs:298` isOpeningEntry; karşı hesap `:37` OPENING_GL = "519" | Satır türü HAZIR; "devir satırları defterde cari başına tek net madde" kuralı YOK → D4 (defter kuralı, `routes/ledger.mjs:313` build) |
| G3 tablo sınıflaması | §2 (aşağıda) | 86 tablo; G3'te adıyla olmayan 5 tablo AÇIK |
| G4 / §5 ön denetim | e-Belge bekleyen / Listeden Sil: `routes/invoices.mjs` (eUnsent, unsentSql — satırlar G11'deki gibi kaydı); bank_jobs; Mutabakat `integrity.mjs:480`; KG-16 adayları `server/lib/ledger-opening.mjs:215` createOpeningReview; Kural Farkı `server/lib/ledger-snapshots.mjs` ruleDiff (`:1196` API) | Okuma kaynakları HAZIR; ön denetim katmanı YOK → D3 (saf) + D5 (ekran) |
| G7 Devri Yenile / Devri Geri Al | Fiş defteri: `server/lib/ledger-vouchers.mjs:97` withTriggersLifted (modül içi), `:379` postAll (`lockThrough`), `:348` nextNo; dondurma `server/lib/ledger-snapshots.mjs:568` lockChanged (thaw), `:650` freezeSync; geri yükleme `company-backups.mjs:680` restoreCompany | Dar silme / yeniden yazma yolu YOK (karar (7) A — D4); kalıcı yedek HAZIR |
| §4.1 / N-09 modül açılışları | Kasa `server/lib/cash-opening.mjs`; banka `server/lib/bank/accounts.mjs:724` (opening_date), `:1043` (açılıştan önceki hareket 409); stok `stock_moves.is_opening`; taksit `plan_entries.opening`; evrak `cheques.is_opening` (göç 49); hepsi 519'a (C5 §2, `general-ledger.mjs:37`) | Mekanizmalar HAZIR; devir çağrısı YOK (D4). Çek "devir" olayı YOK: `migrations.mjs:732` kind CHECK ('receive','issue','collect','endorse','pay','bounce') → GÖÇ (§4.3) |
| §4.3 / N-01…N-08 kapanış fişi | `ledger-vouchers.mjs:26-41` VOUCHER_TYPES (closing: closing / period-end sınıfı; prior-year-result), CLOSING_TYPES; hesaplar `general-ledger.mjs:181` 519, `:194-197` 570 / 580 / 590 / 591, `:204` 621, `:222-230` 671 / 681 / 689 / 690 / 691 / 692; 7/A yansıtma `:103-109` | Fiş türleri ve hesaplar HAZIR (Ç1 / Ç2). Kapanış maddelerini üreten işlev YOK → D3 (saf) + D4 (yazım) |
| §11.4 / N-01 stok değerlemesi | `server/lib/stock-valuation.mjs:55` loadValuationInput, `:107` createStockValuation, `yearEnd(K)` (`:105`); `financial-statements.mjs:932` stockValuationOf | HAZIR — TEK işlev (C6 §3; BAŞ MİMAR 06.11 (2)) |
| Dönem sonucu / kapanış bilançosu | `financial-statements.mjs:213` incomeStatement, `:609` balanceSheet, `:884` closingDayOf, `:465` incomeStatementOf | HAZIR (Ç6-HESAP). D3 / D4 YALNIZ bunlardan alır (BAŞ MİMAR 06.11 (2)). Gelir Tablosu BULGU-1 (kilit geri çekilince neden adı) 2.5.1 "Ç6 öncesi" işinde |
| N-13 devir açılış fişi / 519 eşleşmesi | `ledger-opening.mjs:45` openingCounterpart, `:500` openingMatchBalance, `:538` openingMatchPlan, `:589` openingMatchState | Kısmen HAZIR; K6 kısıtı (alt defter hesabına fiş yazılamaz, `ledger-vouchers.mjs:305-315`) → 190 / 191 / 391 / 360 / 128 / 129 açılışının yeri D4'te seçilir (§4.5) |
| KDV devri (M8) | `server/routes/tax.mjs:167` vatPeriods (invoices.vat_period'dan), `:171` figureTable | Dönem etiketi FATURADAN okunuyor → ≤K faturalar budanınca etiket kaybolur → D4 tasarım şartı (§1.2 madde 5) |
| §7.5 kilit + kilit izi | `server/lib/period.mjs:22` LOCK_KEY, `:88` setLock; iz `integrity.mjs:140` LOCK_SQL, `:370` lockDigestOf; donmuş defter kapsamı `ledger-snapshots.mjs` | HAZIR; "devir-closed" (kilit kaldırılsa da K öncesine yazılamaz) kuralı YOK → D4 |
| G8 belge temizliği arşivi görür | `server/lib/documents.mjs:92` purge (yalnız canlı `case_documents.sha256` kümesine bakar) | YOK → D4 ÖN KOŞULU |
| G5 / §7 "Yedekten Geri Yükle" arşivi bilir | `company-backups.mjs:791` assertDevirConsistent | HAZIR (D2) |
| §4.4 numara tabanı | `routes/invoices.mjs:2014` FLOOR_KEY `invoice.numberFloor`; `server/lib/number-floor.mjs:29` mergeFloor | Mekanizma HAZIR; (seri, K) MAX(seq) tabanının devirde yazılması YOK → D4 |
| Defter Türü (arşiv kendi türünü taşır) | `server/lib/book-type.mjs:10` `accounting.bookType` (tek ayar, tarihçe yok) | settings arşive kopyalanır → kendiliğinden sağlanır; yeni yılda tür değişirse arşiv eski türde kalır (istenen) |
| WhatsApp saklama (W-3) | `server/lib/whatsapp/saklama.mjs` (1 yıl + anonim iz; silme talepleri makinede, geri yüklemeden sonra yeniden uygulanır) | Salt okunur arşivde saklama / silme talebi UYGULANAMAZ → BAŞ MİMAR KARARI GEREKİYOR (rapor) |
| Hacim (G9) | ölçülmüş: Bilanço 100 bin ~5,5–6 sn, 1 M ~58–60 sn; Gelir Tablosu 100 bin ~3,3–3,7 sn (S224) | Ön izleme bütçesi (≤ 10 sn, 100 bin) RİSKTE → §3.8 |

### 1.2 2.5.0'da değişen çekirdek planı nerede eskitti (tasarım şartına dönüşenler)

1. **Tek borç sırası (Ç5-B, EK-1 §1, M1, M2 A, S1, S2, S6 = A, 24 = A, 28 = A):** G2 "açık FATURA kalemi" → bugün TYK'nın açık BORÇ / ALACAK kalemi (fatura kalanı, Borç Yaz kalanı, açılış kalanı,
   karşılıksız evrak borcu, kapatılmış kart kalanı — M2 A, BAŞ MİMAR KARARI 05.11 18:55). Kaynak `buildObligations(...).items`. Vade = asıl vade; vadesiz kalemde TYK'nın vadesi belge
   günüdür (S1 A, S91 A) → devir satırının `due_date`'i boş BIRAKILAMAZ (K+1 tarihli satırda vadesizlik K+1'de vadeli sayılır, gecikmiş K+1 günü ayrışır — kâhin değişmezi (4)
   `m2_gecikmis_ayni` kırılır): **due_date = asıl vade, vadesizde asıl belge günü** (türetildi: M2 A değişmezi + S1 A). Ödeme Sözü (`expected_date`) de taşınır (aynı değişmez + S67 / S69).
2. **Açılış düzeni (Ç5, 30.10 kararı, KG-1):** §4.1 ve §4.3'teki "karşı hesap 500" → 519 (`general-ledger.mjs:37`); "account_entries.is_opening eklenir" → var (göç 35); "açılış farkı fişi" →
   N-13 + 519 eşleşmesi; arşivde eşleştirilmemiş 519 aynen taşınır (C5 §2 satır 168; değişmez "yeni yıl G = arşiv G").
3. **Saklanan fiş (Ç2):** §4.3 "Defter fiş saklamaz / ledger_vouchers yeni tablo" → göç 46'da var; tür adları `closing | opening | opening-match | prior-year-result | rule-diff-correction`
   (plan `opening-diff` diyordu). K6: fiş alt defter hesabına (Kasa, banka, cari, evrak, carisiz taksit, KDV ve vergi, şüpheli) YAZAMAZ → N-13'ün 190 / 191 / 391 / 360 / 128 / 129 satırları
   fişe giremez (C2 §11a). Devri Yenile = "yalnız devrin ürettiği fişler silinip yeniden yazılır, yevmiyede tek açılış fişi" (karar (7) A) ama silme yolu modül içi; D4 dört kısıtı (C2 §11a).
4. **Dondurma (Ç3):** arşiv K'ye kadar kilitlenince donar (`postAll lockThrough` → freezeSync aynı işlemde, C3 §4). Yeni yıl dosyasında ≤K donmuş satırlar YOK → budama işlevi (`pruneThrough`)
   koşu başlıklarının `state_*` toplamlarıyla tutarlı olmalı (C3 §11 kısıt (2)); Devri Yenile'nin thaw'ı arşivin BÜTÜN donmuş satırlarını kaldırır (kısıt (1)) → arşiv kuralı korunmalı.
   Ç3'ün bıraktığı "postAll lockThrough eşzamanlı kipi 1 M'de ana iş parçacığında tek işlem" maddesi §4.10'da.
5. **KDV İndirim Dönemi (Ç7b, KG-7 A, M8):** dönem etiketi `invoices.vat_period`'da (göç 52) ve KDV ayları `tax.mjs:167-169` ile FATURADAN okunuyor. G3'e göre kapanmış ≤K faturalar yeni yıldan
   budanır, açık olanlar da açık kaleme döner (G2) → yeni yılda hiçbir ≤K fatura yok → "dönemi Ocak olan Aralık alışı"nın 191'i yeni yılın Ocak mahsubunda KAYBOLUR. Açılıştaki 191 / 391
   DÖNEM BOYUTUYLA taşınmalı (M8 (1)–(4) A) ve figureTable bu etiketi açılış satırından okumalı; tersine dönemi ≤ Aralık olan açılış 191 / 391'i HİÇBİR mahsuba girmemeli (bugün 01.01 tarihli
   açılış satırı "Ocak hareketi" sayılırdı — C2 §11 notu). → D4 tasarım şartı + göç gereksinimi (§4.3 G-3).
6. **Defter Türü (Ç4):** tek ayar (`book-type.mjs:10`); arşiv dosyası ayarları kopya taşıdığı için "arşiv kendi Defter Türü'nü taşır" (iş listesi D4 notu) ayrıca kod istemez; değişmez testi gerekir.
7. **Kartı Kapat kuralı (Ç7b göç 53, `plans.close_rule`) ve KG-5 Excel kartı (Ç5-A):** kart satırı ≤K tarihli olarak YENİ YILDA KALIR (G3 "kart kalır") ama defter maddesi kartın kendi satırından
   türetiliyor: KG-5 kartı `routes/ledger.mjs:146-181` (plan_imports.created_at yükleme günü — `plan_imports` ≤K budanınca tarih boş kalır), şüpheli alacak `server/lib/doubtful-gl.mjs:137`
   (kaydın kendi `date`'i ≤K). Yeni yılda bu satırlar ≤K tarihli madde ÜRETİR → "yeni yıl dosyasında ≤K tarihli madde yok" (kitap §6.6, EK-1 M12, kâhin `m12_k_oncesi_satir`) ve
   "arşiv K = yeni yıl K+1" kırılır. → D4 GENEL KURALI (§4.4): devirli dosyada ≤K kaynaklı türetme kapalıdır; açık kayıtların etkisi yalnız devir açılış satırlarıyla gelir.
8. **WhatsApp saklama (W-3):** arşiv `wa_jobs` / `wa_job_pdfs` / `wa_batches` içeriğini (telefon, PDF, metin) kopya taşır; arşiv salt okunur → 1 yıl saklama ve KVKK silme talebi arşivde HİÇ
   uygulanmaz (S-W3, S32, S38 kararlarının arşivde delinmesi). → raporda BAŞ MİMAR KARARI GEREKİYOR.
9. **Şema kapısı (BS-7) ve göç sayısı:** G3 "75 canlı tablo (göç 1–45)" → bugün 86 (göç 54'e kadar); 2.5.0'ın eklediği 5 tablo G3'te yok (§2). `ledger_snapshots` G3'te "ölü ad" yazıyor →
   artık gerçek tablo (göç 47), silme tetikleyicili (C3 §3).

### 1.3 Planın eskiyen yerleri (DEVIR-PLANI.md'ye DOKUNULMADI; ana oturum düzeltir)

| Yer | Eskiyen | Bugünkü doğru |
|---|---|---|
| Başlık "Durum: 2.5.0'DA UYGULANIYOR"; §10 "Sürüm: 2.5.0" | sürüm | D3–D6 2.5.1 (kullanıcı 21.11 21:32) |
| §2 "yerinde budama + arşiv kopyası", "çalışan dosyada tek işlem" | yöntem | G1 kopyada üret → doğrula → takas |
| §3 tablo (cari "is_opening eklenir", denetim izi "≤K silinir", çöp "boşaltılır") | sınıflar | G3 (audit_events DOKUNULMAZ; trash seçici) + §2 bu belge |
| §4.1 "karşı hesap 500", "Ayrı bir is_opening sütunu eklenir" | hesap, göç | 519; göç 35'te var |
| §4.2 devir faturası (`devir_year`, `devir_remaining`) | yöntem | G2 AYRI AÇIK KALEM + M2 A (bütün TYK kalemleri) |
| §4.3 "Defter fiş saklamaz", "690…692 YOK", "opening-diff", "karşı hesap 500" | çekirdek | göç 46, CHART'ta var, VOUCHER_TYPES, 519 + N-13 |
| §4.4, §5, §6, §7.4, G11 satır numaraları | kod yerleri | §1.1 bu belge (ör. restoreCompany `company-backups.mjs:680`, stageRootRestore `:648`) |
| §7.1 "son göç 30", göç listesi | göç | LATEST 54; is_opening / ledger_vouchers var; devir_* sütunları YOK (gerekmez) |
| §7.2 dosya adları (`plan.mjs`, `split.mjs`, `report.mjs`, `archive.mjs`) | modül | D2: `archives.mjs`, `archive-open.mjs`, `maintenance.mjs`, `devir-backups.mjs`; D3/D4 adları §6 |
| §7.4 "settleInvoices invoice-settle.mjs" | kapama | TYK `obligation-queue.mjs:107` |
| §7.6 "busyCompanies devir boyunca" | bakım | `devir/maintenance.mjs` (D2) |
| G1.1 "e-Belge turları durur" | yazıcı | programda zamanlanmış e-Belge turu yok (D2 §5.3) |
| G2 son paragraf "invoice-settle.mjs:166-180" | kapama | TYK |
| G2 "Fatura ve satırları yeni yılda YOK" ↔ G3 "AÇIK OLAN KALIR: invoices / invoice_lines (açık → G2 açık kalem …)" | İÇ ÇELİŞKİ | G2 geçerli: açık fatura da yeni yılda YOK, açık kalem olur (G3'ün parantezi bunu söylüyor; başlık yanıltıcı) — D4 G2'ye göre |
| G3 "75 canlı tablo"; `ledger_snapshots` "ölü ad"; listede olmayan 5 tablo | şema | §2 |
| G3 "açık kalır; ≤K olay bağı çözülür" (doubtful_*, plans, cheques) | tarih | kayıt kalır ama ≤K tarihli maddesi yeni yılda ÜRETİLMEMELİ (§1.2 madde 7, §4.4) |
| G3 "bank_accounts (opening_date K+1'e — kural D2'de)" | iş | D2 yapmadı → D4 |
| G8 "belge temizliği arşivin başvurularını görür" | iş | D2 yapmadı (D2 §12) → D4 ön koşulu |
| G8 "users ortak katmandan okunur (DOĞRULANACAK)" | doğrulama | hâlâ doğrulanmadı → D4 testi |
| G12 "Çekirdek Ç1 → Ç2 → Ç3 → Ç5 bitmeden" | sıra | Ç6-HESAP + MA'dan sonra (BAŞ MİMAR 06.11 07:55 (2)); ikisi de bitti |
| G13 "Açık sorular" | durum | dördü G14'te yanıtlı (rapor §5) |
| §9 "Kâhin test/bagimsiz/devir/" | yer | devir kâhini muhasebe kâhininin içinde (`test/bagimsiz/muhasebe/`, `devir` / `devri_yenile` / `devri_geri_al` olayları, 28 senaryo); sürücü devir olaylarını bugün "uygulanmadı" sayar (`test/bagimsiz/muhasebe-surucu/program.mjs:1219`) |

---

## 2. Tablo sınıflaması (G3, bugünkü şema)

Tarama: `server/lib/migrations.mjs` içindeki her `CREATE TABLE` (göç 1–54) → **86 tablo** (geçici `integrity_log_v20` hariç; o yeniden adlandırılıp `integrity_log` olur). Betik:
`/tmp/claude-0/-home-user/de5e1cbf-7e68-5683-b7bb-f27655eaed4f/scratchpad/pd-betik/tablolar.py` (G3 metniyle ad ad karşılaştırır; not defteri, depoda değil). Geri yüklemede gelen 2 koşullu tablo (`backup_meta` `server/lib/backup.mjs:99`, `edoc_usage_defter` `:187`) ve
makine düzeyindeki dosyalar (`usage` `server/lib/einvoice/kullanim-defteri.mjs:21`; WhatsApp defteri `server/lib/whatsapp/defter.mjs:38-112` 16 tablo; silme talepleri
`server/lib/whatsapp/saklama.mjs:63`) ayrıca.

Sınıflar: **D** dokunulmaz (yeni yılda aynen; arşivde kopya) · **O** ortak katman · **B** ≤K budanır, yeni yılda açılış (K+1) · **A** açık olan kalır, kapanmış ≤K budanır ·
**S** kesim sonrası satırlar aynen kalır (B ve A'da örtük) · **Ab** arşivde boşaltılır · **AÇIK** G3'te adıyla yok.

| Tablo (göç) | Arşivde | Yeni yılda | Sınıf / not |
|---|---|---|---|
| users (1), roles (15) | ayna / kopya | aynen | O (001 dosyasında; 002+ ayna). 001 takasında canlıdan aktarılır (transplantCommon) |
| sessions (1), mobile_access, mobile_codes, mobile_devices, mobile_sessions (38) | boşaltılır | aynen | O + Ab |
| settings (1) | kopya + `devir.archive`, kilit = K | aynen + yıla bağlı anahtarlar (aşağıda) | D (seçici) |
| records, overrides, deleted_records, notes, phones, liens, tasks, messages (1), case_notes, source_snapshots (2), case_documents (5) | kopya | aynen | D (`belgeler/` dosyaları şirket klasöründe — G8) |
| chat_conversations, chat_members, chat_messages (3) | kopya | aynen | D (G3 `chat_*`) |
| dataset_rows, dataset_imports (4), free_sheets, free_rows, free_cells, free_history (5) | kopya | aynen | D (G3 `free_*`) |
| plan_groups (7), accounts (12), stock_items (12) | kopya | aynen | D (silinmişler dahil; stok değeri stock_items.unit_price'tan DEĞİL — yearEnd) |
| audit_events (1), integrity_log (17) | kopya | aynen | D (G3; §3'ün "≤K silinir"i eski). `ledger.voucher.created` izleri ASLA budanmaz (C2 §11 D4 kısıtı (1)) |
| edoc_usage, edoc_usage_meta (37) | kopya | aynen | D — DELETE / UPDATE tetikleyicisi; budamaya girerse işlem düşer |
| einvoice_inbox (18) | kopya | aynen | D (çekme 30 gün uuid elemesi) |
| invoice_repeats (18) | kopya | aynen + aktif ≤K şablonun TASLAK kopyası | D (G2 şablon kuralı) |
| message_sends (17), wa_batches, wa_jobs (40), wa_job_pdfs (45) | kopya (bkz. not) | aynen | D yeni yılda; ARŞİVDE KVKK sorunu → rapor BAŞ MİMAR KARARI GEREKİYOR (öneri: arşivde içerik / telefon / PDF anonim ize indirilir ya da Ab) |
| maliyet_sekmeler, maliyet_kartlar, maliyet_satirlar, maliyet_adimlar, maliyet_hucreler, maliyet_basliklar (34) | kopya | aynen | D (G3 `maliyet_*`) |
| staff_members (31) | kopya | aynen | D |
| pos_terminals, pos_rates, fx_rates, bank_holidays (20) | kopya | aynen | D |
| bank_accounts (20) | kopya | aynen; `opening_date` = K+1 | D (alan güncellemesi D4) |
| bank_statements, bank_statement_lines, bank_matches (20) | kopya | aynen | D (yazan kod yok — G3) |
| request_keys (20) | kopya | aynen | D (30 günde kendiliğinden) |
| payments (1) | ≤K tam | ≤K budanır | B (Kasa açılışı kapsar) |
| cash_entries (5) | ≤K tam | ≤K budanır; tek açılış K+1 | B |
| account_entries (12) | ≤K tam | ≤K budanır; cari net açılış + AÇIK KALEMLER (K+1, source 'devir') | B + S |
| stock_moves (12) | ≤K tam | ≤K budanır; ürün başına açılış K+1 (miktar eksi dahil, değer yearEnd — M5, KG-9) | B + S |
| plan_entries (7) | ≤K tam | ≤K budanır; açık kartta tek açılış (taksit dağılımı korunur) | B + S |
| plans, plan_items (7) | kopya | KART KALIR; ≤K tarihli maddesi yeni yılda üretilmez (§4.4); fatura bağı → arşiv başvurusu | A (G3 "kart kalır") |
| plan_imports (14) | kopya | ≤K budanır; ≤K içe aktarmanın Geri Al'ı kapanır | B — DİKKAT: KG-5 maddesi yükleme günü bu tablodan (`routes/ledger.mjs:179`) |
| fin_events, bank_lines (20) | ≤K tam | ≤K budanır; hesap açılışı K+1; K sonrası ters kaydın `reversal_of` bağı çözülür | B + S |
| vat_offsets (29) | ≤K tam | ≤K budanır (Aralık mahsubu 31.12 tarihli → arşivde) | B |
| invoice_offsets (19) | ≤K tam | ≤K budanır; K sonrası mahsup → açık kaleme | B + S |
| invoices, invoice_lines (18) | ≤K tam | ≤K budanır (AÇIK OLANLAR DA → açık kalem, G2); K sonrası aynen | B + S (G2 / G3 iç çelişkisi §1.3) |
| pos_sales (20) | ≤K tam | ≤K budanır; BEKLEYEN KALEMİ OLAN satış kalır (pos_items ↔ pos_sales INNER JOIN) | A |
| pos_items (20) | kopya | bekleyen kalem kalır (N-11 108.NN K+1) | A |
| bank_plans (20) | kopya | tamamlanmış / tekrarsız ≤K budanır | A |
| bank_jobs (20) | kopya | biten ≤K budanır; bekleyen ön denetimde DURDURUR | A |
| trash (6) | kopya | yalnız yük tarihi ≤K para kalemleri budanır | A (seçici) |
| cheques (13) | kopya | açık evrak kalır, kapanmış ≤K budanır | A |
| cheque_events (13) | ≤K tam | açık evrakın ≤K olayları tek "devir" olayına (K+1) | A — GÖÇ: kind CHECK (`migrations.mjs:732`) |
| cheque_collections (20) | kopya | bekleyen kalır | A |
| doubtful_receivables, doubtful_provisions (23) | kopya | açık kayıt kalır; kapanmış ≤K budanır; ≤K tarihli maddesi üretilmez, 128 / 129 N-12 ile K+1 | A (§4.4) |
| **ledger_vouchers, ledger_voucher_lines (46)** | ≤K fişler + kapanış fişleri (K) | ≤K budanır (dar işlev, rowid sırası korunur, izler kalır); N-13 açılış fişi K+1 | **AÇIK** → öneri B (C2 §11 önerisi) |
| **ledger_snapshot_runs, ledger_snapshots (47)** | K'ye kadar donar (freezeSync) | ≤K budanır (`pruneThrough`, `state_*` tutarlı); kapsam = K | **AÇIK** → öneri B (C3 §11) |
| **ledger_valuation_cards (54)** | koşularla birlikte kalır | koşusu budananlar gider | **AÇIK** → koşusunun sınıfı (S236 = A: kilit anının kartları) |
| backup_meta, edoc_usage_defter (koşullu) | kopya | aynen | D |
| makine: usage, WhatsApp defteri, silme talepleri, `sirketler.json` | — | dokunulmaz | D (şirket / cari kimlikleri değişmez → eleme sürer) |

**settings — yıla bağlı anahtarlar (yeni yıl dosyasında):** `ledger.lockedUntil` = K; `devir.years` += { year, cutoff, runId, at } (D2); `invoice.numberFloor` → her (seri, K) için
MAX(seq) TABANI (G3); `invoice.settings.start{…}`, `bank.pos.draftMonth`, `invoice.restoreNotice` (G3 listesi aynen); `meta.bank.seq.<yıl>` ve `plans.receiptSeq` dokunulmaz;
`ledger.ruleShiftThrough` (göç 51) dokunulmaz (≤K değer; yeni yılda etkisiz); `accounting.bookType` dokunulmaz (arşiv kendi kopyasını taşır). Arşivde: `devir.archive`; kilit = K; arşivin
kendi Defter Türü aynen.

**AÇIK (adıyla, G3'te yok):** `ledger_vouchers`, `ledger_voucher_lines`, `ledger_snapshot_runs`, `ledger_snapshots` (G3'te yalnız "ölü ad" diye), `ledger_valuation_cards`. Öneri sınıfları
yukarıda (C2 / C3 tasarım notlarının önerisi — BAŞ MİMAR KARARI olarak gösterilir). Planın §8.16 / §9 "şemadaki her tablo sınıflamada" testi bugün YOK → D4'te yazılır (bu tablo kaynak;
yeni tablo eklenince kırılır).

---

## 3. D3 tasarımı — saf hesap + Devir Raporu

### 3.1 İlke: "devir planı = yazım kümesi"
D3 HİÇBİR ŞEY YAZMAZ. Tek saf işlev, devrin bütün sonucunu bir DEVİR PLANI nesnesi olarak üretir; ön izleme sayıları, Devir Raporu ve D4'ün yazımı AYNI nesneden gelir (plan §7.3 "ön izleme ve
rapor aynı fonksiyonu kullanır" + G1 kopyada üretim). D4 planı yalnız UYGULAR (kopyalarda) ve sonra iki dosyanın ÖLÇÜLMÜŞ bakiyelerini aynı rapor işlevine verir: rapor = plan ↔ ölçüm.
Belirlenimli: aynı veri + aynı girdi → bayt bayt aynı plan (anahtarlar sıralı, kimlikler `devir-<yıl>-<varlık>-<kaynak kimliği>` — G7). Tutarlar kuruş tamsayı (kuruş toleransı YOK — §0).

### 3.2 Modül sınırı (öneri; dosya adları §6)
| Dosya | Görev |
|---|---|
| `server/lib/devir/plan.mjs` | `buildDevirPlan(reader, { K, option, mode, previous })` — saf; okuyucu arayüzü dışında veri tabanı bilmez |
| `server/lib/devir/plan-reader.mjs` | Tek okuma işleminde (WAL anlık görüntüsü) toplu SQL ile girdi: ≤K / >K satır sayıları, TYK girdisi (batchSettleInput + withExtras), mizan (yevmiye TEK kez), Ç6 işlevleri, değerleme `yearEnd(K)`, kasa / banka / POS / evrak / kart / şüpheli durumları |
| `server/lib/devir/preflight.mjs` | Ön denetim (§5 + G4) — saf; DURDURUR / UYARIR listesi, her madde "Git" hedefiyle |
| `server/lib/devir/report.mjs` | Devir Raporu satırları (§3.4) + PDF / Excel üreticisi (ekran = PDF = Excel; alt TOPLAM satırları — kalıcı ürün kararı) |
| `server/lib/devir/plan-worker.mjs` | İş parçacığı: salt okunur bağlantı, `BEGIN` tek okuma, okuyucu → plan → ön denetim → rapor; ilerleme iletileri |
| `server/routes/devir.mjs` (ek) | `POST /api/admin/devir/preview` (iş başlatır, iş kimliği), `GET …/preview/:id` (durum / sonuç), `GET …/preview/:id/report.pdf|xlsx`; system.manage; ortak katmanda (HUB_ONLY deseni) |

Girdi: `{ companyId, K (yalnız geçmiş bir yılın 31.12'si — M11; değilse 400 DEVIR_K_31_ARALIK / DEVIR_K_GELECEK), option: "borc-alacak" (varsayılan) | "sadece-bakiye", today, mode: "devir" |
"yenile", previous (yenilemede önceki devrin satırları), archives (kayıt defteri) }`.
Çıktı (özet): `{ meta { K, option, runId, dataVersion, bookType, ruleVersion }, preflight { blockers[], warnings[] }, archive { closingVouchers[] (K tarihli), lockThrough: K },
newYear { prune { tablo → ölçüt, satır sayısı }, cash, accounts[] { cari, K bakiyesi, açılış satırları[], açık kalemler[] }, stock[], bank[], cards[], credits[], posPending[], cheques[],
plans[], doubtful[], vat[] (dönem boyutlu), openingVoucher (N-13'ün fişe girebilen satırları), settings, links[] (K sonrası bağların yeni hedefi / arşiv başvurusu), repeats[] (taslak şablon) },
counts, report }`.

### 3.3 Ön izleme sayılarının TANIMI (sihirbaz 4. adım, plan §1 madde 5)
Hepsi plandan SAYILIR (ayrı sorgu yok — sayı ile yazılan aynı kaynaktan).
| Sayı | Tanım |
|---|---|
| Cari | (a) yeni yıla geçen cari KARTI = bütün kartlar, silinmişler dahil (§11.3); (b) açılış satırı yazılacak cari = K bakiyesi (CH; 128 hariç) ≠ 0 YA DA açık kalemi olan (M12; bakiyesi 0 ve açık kalemi yok → satır YOK); tutar: Σ borçlu, Σ alacaklı K bakiyesi |
| Açık fatura / açık kalem | TYK'nın K'deki açık yükümlülük kalemleri (M2 A): fatura kalanı ayrı sayı + tutar (satış / alış); fatura dışı kalemler (Borç Yaz, açılış kalanı, karşılıksız evrak borcu, kapatılmış kart kalanı) ayrı sayı + tutar. HARİÇ: taksit kartının tükettiği kalemler (kart taşır — M2), şüpheli kuyruğundaki pay (128 — M13) |
| Taksit kartı | açık kart (kalanı > 0) sayısı + Σ kalan; kapalı kart sayısı (kart kalır, hareketi tek açılış satırına iner — §3.8) |
| Çek / senet | açık evrak durum bazında adet + tutar: alınan portföyde (101.01 / 121.01), tahsilde (101.02 / 121.02), ciro edilmiş (bizde değil, iz için), karşılıksız (cari borcu açık kalemde), verilen ödenmemiş (103 / 321) |
| Banka hesabı | hesap sayısı (açılış yazılacak = K bakiyesi ≠ 0 ya da hesap etkin) + K bakiyesi; ayrıca şirket kartı (309.NN), kredi (300.NN), POS bekleyen kalem sayısı + brüt (108.NN) |
| Stok kalemi | açılışı yazılacak ürün = K miktarı ≠ 0 ve silinmemiş (S207 = A: silinmiş kart envantere girmez); Σ değer = DSS_K; eksi stoklu ürün sayısı (M5: miktar eksi devreder, değer 0) |
| Kasa | K bakiyesi (tek açılış) |
| Şüpheli alacak | açık kayıt sayısı; 128 ve 129 K bakiyeleri |
| Taşınacak hareket | tablo bazında K'den SONRA tarihli satır sayısı (yeni yılda aynen kalan); ayrıca ≤K budanacak satır sayısı; değişmez: arşiv ≤K + yeni yıl >K = devir öncesi (kitap §6.6) |
| Tahmini süre | ölçülmüş satır / sn katsayısıyla (§3.10 ölçümünden); "yaklaşık" |

### 3.4 Devir Raporu satırları (plan §1 madde 8; kitap §6)
Başlık: şirket, K, seçenek, Defter Türü (arşivin), devir çalışma kimliği, "590 / 591 vergi öncesi dönem sonucudur" (§11.5 / KG-13 A), tarih; Devri Yenile'de "önceki ↔ yeni".
1. **Hesap hesap (kuruşu kuruşuna):** her bilanço hesabı (1–5 sınıfı) alt hesap ve cari boyutuyla: Arşiv K Kapanış (Borç / Alacak / Bakiye) · Yeni Yıl K+1 Açılış · Fark (= 0; ≠ 0 → devir
   DURUR). Alt TOPLAM: Σ aktif, Σ pasif, 519 satırı (değişmez: yeni yıl G = arşiv G).
2. **Kapanış:** 6 / 7 sınıfı hesap bakiyeleri (kapanış öncesi), N-01 dönem sonu stok değerleme farkı (153 ↔ 621), yansıtmalar (N-02 / N-03), 690, 691 (= 0, KG-13 A), 692, 590 / 591;
   her kapanmamış önceki yıl için "Önceki Yıl Sonucu Fişi (Y)" satırı (570.Y / 580.Y — M4, EK-2 S26). Değişmez: 590 / 591 = devir öncesi hesaplanmış Dönem Net Kârı (Ç6 `balanceSheet`
   `hesaplanmis.donemNetKari`), Σ önceki yıl sonuçları = `hesaplanmis.gecmisYillar` (aynı K).
3. **Modül modül (K'de iki dosyada eşit — kitap §6.4):** Kasa; her banka hesabı / kart / kredi / POS; her cari (K bakiyesi, açılış satırları, açık kalem sayısı ve tutarı, şüpheli 128);
   taksit kartları (açık kalan); çek / senet (durum bazında); stok (ürün: miktar, birim maliyet, değer, dayanak; "Eksi Stokla Devreden Ürünler" — M5); KDV (190, 191 dönem dönem, 391 dönem
   dönem, 360); şüpheli 128 / 129.
4. **Hareket sayıları:** tablo bazında devir öncesi = arşiv ≤K + yeni yıl >K.
5. **Listeler:** UYARIR maddeleri (G4), "Bağı Arşiv Başvurusuna Çevrilen Ödemeler" (K sonrası bağ → kapanmış ≤K fatura; 28 = A: bağsız gibi dağılır), S24 kayıtları (K öncesine yönelen
   Ocak karşılıksızı / bağı — K kilidiyle değerlendirildi), taşınan tekrarlayan fatura şablonları, KG-16 bekleyen adaylar (rapor S-2'ye bağlı), Kural Farkı durumu (rapor S-3'e bağlı).
6. **Devri Yenile ek:** önceki ↔ yeni her satır farkı; "Bağı Değişen Ödemeler", "Gecikmiş Tutarı Değişen Cariler" (M9), çakışma listesi (DEVIR_YENILE_CAKISMA).
Ekran = PDF = Excel; her bölümün alt TOPLAM satırı.

### 3.5 AYRI AÇIK KALEMİN tek borç sırasından üretimi (G2 + M2 A + M12 + M13)
1. **K'deki kuyruk:** her cari için `buildObligations(withExtras(batchSettleInput(cari, ≤K satırlar, tablolar, gün = K+1), extras, cari))` (`obligation-queue.mjs:107`, `obligation-input.mjs:106`;
   toplu kullanım deseni `routes/invoices.mjs:724-735`), kilit geçmişine K eklenmiş olarak (28 = A: kilitli / devredilmiş dönemde bağsız kapanmış kalem sonraki bağla açılmaz → K'nin durumu
   yalnız ≤K kayıtlardan; S24 = A: Ocak'ta devirden önce yazılmış karşılıksız / bağ K kilidiyle değerlendirilir). >K satırlar kuyruğa GİRMEZ (yeni yılda kendi yerlerinde kalırlar).
2. **Her açık kalem** (`items`: side, vade, remaining − doubtful > 0; kartın tükettiği kalem HARİÇ) → bir `account_entries` satırı: yön = kalemin yönü (müşteri borcu `debt`, bizim borcumuz
   `credit`), tutar = kalan − şüpheli pay, tarih K+1, `due_date` = **asıl vade; vadesizde asıl belge günü** (§1.2 madde 1 — türetildi), `expected_date` = Ödeme Sözü (varsa), açıklama
   "Devir: <belge no / tür> (<belge tarihi>)", `source` = 'devir', `source_id` = kalem anahtarı, kimlik `devir-<K yılı>-kalem-<kaynak>`. Satır GELİR / GİDER DEĞİLDİR: defterde B CH / A 519
   (satışta) ya da B 519 / A CH (alışta) — N-10, G14 KABUL. Defterde cari başına TEK NET madde (KG-17 A / M3): açık kalemler ve net satır birlikte tek madde; ekstrede ayrı satırlar.
3. **Net satır(lar):** cari K bakiyesi (CH; 128 hariç) − Σ açık kalemler (yön işaretli) = net (avans, fazla ödeme ya da kartların karşıladığı kısım — M2). "Borç ve Alacakları Aktar": iki satır
   — Borç Toplamı = ≤K bütün borç hareketleri (açılışlar dahil) − devreden açık BORÇ kalemleri; Alacak Toplamı = ≤K bütün alacak hareketleri − devreden açık ALACAK kalemleri (M12).
   "Sadece Bakiyeyi Aktar": tek "Devir Bakiyesi" satırı. `is_opening = 1`, tarih K+1, VADESİZ (EK-2 S27), sıfır satır yazılmaz; bakiyesi 0 ve açık kalemsiz cariye HİÇ satır yok (M12).
   Aynı gün sırası: Borç Toplamı → Alacak Toplamı (ya da Devir Bakiyesi) → açık kalemler vade sırasıyla (eşitse belge tarihi) (M12).
4. **TASARIM TEHLİKESİ (koddan; BAŞ MİMAR KARARI — türetildi, soru değil):** iki satırlı seçenekte "Alacak Toplamı" TYK'da bağsız alacak gibi işlenirse S2 sırasıyla (vadesi en önce gelen)
   vadesi K'den önce olan GECİKMİŞ açık kalemi kapatır → gecikmiş devirle değişir (M2 değişmezi ve §11.2 "fark yalnız ekstrede görünüşte" kırılır). KURAL: devrin Borç Toplamı / Alacak Toplamı
   satırları TYK'ya girmeden ÖNCE birbiriyle netleşir; kuyruğa yalnız net (EK-2 S27'deki "net kalan satırı") girer. İki seçenekte gecikmiş, kalan, bakiye AYNI (test: iki seçenek × gecikmiş kalem).
5. **Kartın karşıladığı kısım:** net satıra girer (M2) ve "gecikmiş hesabına borç kalemi olarak girmez" → yeni yılda kart, alttaki borç olarak bu net payı tüketmeli (M1e). Fatura kartında
   (`plans.invoice_id`) fatura yeni yılda YOK → kartın bağı arşiv başvurusuna döner, alttaki borç = net pay. Kâhin değişmezi (4) ile sınanır (s27, s45). Risk: TYK'nın "kart → alttaki borç"
   eşlemesi devir satırını tanımalı (D4 kodu + kâhin karşılaştırması).
6. **Şüpheli (M13):** şüpheli kuyruğundaki tutar CH açık kalemi DEĞİL; `doubtful_receivables` açık kaydı kalır, 128 / 129 N-12 ile K+1 açılır; fatura başvurusu (belge no) kayıtta korunur.
   Değişmez: CH açılışı + Σ CH açık kalemleri = CH bakiyesi (128 hariç); carinin bakiyesi (CH + 128) K = K+1.
7. **K sonrası bağlar** (G2): `account_entries.invoice_id`, `invoice_offsets`, `cheque_events.invoice_id` / `cheques.invoice_id`, `fin_events.invoice_id`, `plans.invoice_id`, iade bağı
   (`account_entries.refund_of`, G14 (1)) → açık faturanın DEVİR KALEMİNE; kapanmış ≤K faturaya yönelen bağ → arşiv başvurusu (yıl + belge no + tarih) ve 28 = A gereği bağsız ödeme gibi
   dağılır, program kayıtta yazar. Plan `links[]` bunların listesini taşır (Devir Raporu §3.4 madde 5).

### 3.6 Kapanış fişi (arşivde, K tarihli — N-01 … N-08, EK-1 M4, EK-2 S25 / S40)
Sıra ve sınıf (C2 §11; yevmiye G-4): (1) her kapanmamış önceki yıl Y için "Önceki Yıl Sonucu Fişi (Y)" (`prior-year-result`, kapanış sınıfı; eskiden yeniye; 570.Y / 580.Y) → (2) N-01 dönem
sonu stok değerleme (`closing` türü, `period-end` sınıfı; tutar = SMM_K = DSS_(K−1) + alış − iade − DSS_K; "153 bakiyesi − DSS" ancak önceki yıl fişlerinden SONRA buna eşit — M4) → (3) N-02 / N-03
7/A yansıtma (631 / 632 / 660 ← 761 / 771 / 781; 761 / 771 / 781 ↔ 760 / 770 / 780; `general-ledger.mjs:103-109`) → (4) N-04 6 sınıfı → 690 (691 HARİÇ) → (5) N-05 691 / 370: KG-13 A, tutar 0,
satır YAZILMAZ → (6) N-06 690 → 692 ve **691 → 692 (B 692 / A 691; 691, 690'a DEĞİL 692'ye kapanır — EK-2 S40)** → (7) N-07 692 → 590 (kâr) / 591 (zarar).
Tutarlar: dönem sonucu, N-01 ve önceki yıl sonuçları YALNIZ Ç6-HESAP işlevlerinden (`incomeStatement`, `balanceSheet.hesaplanmis`, `createStockValuation(...).yearEnd`) — BAŞ MİMAR 06.11 (2);
hesap başına kapanış satırları aynı yevmiyenin mizanından; değişmez Σ (N-04 + N-06) = Ç6 Dönem Net Kârı. Kapanıştan sonra: 6 / 7 sınıfı (690, 691, 692 dahil) = 0, 153 = DSS_K (kitap §6.1).
691 ≠ 0 yolu programda yok (KG-13 A; elle fiş ekranı yok) → D4'te AYRI birim testi 691 ≠ 0 veriyle (iş listesi D4 notu).
Yazım D4'te: `vouchers.postAll(user, [ … ], { lockThrough: K })` arşiv kopyasında (aynı işlemde kilit + freezeSync — C3 §4 eşzamanlı kip).

### 3.7 Açılış (yeni yılda, K+1) ve geçici hesabın eşleşmesi
- Modül açılışları (N-09, karşı hesap 519 — kitap 3-M): Kasa (`cash_entries.is_opening`), cari (§3.5), banka / kart / kredi (`fin_events` opening, `bank_accounts.opening_date` = K+1 —
  `bank/accounts.mjs:724`; `:1043` açılıştan önceki hareketi 409 ile reddeder — kalan >K hareketler K+1 ve sonrası olduğundan tutar), stok (`stock_moves.is_opening`), çek / senet ("devir"
  olayı — §4.3 göç), taksit (`plan_entries.opening`), POS bekleyen (N-11 108.NN), şüpheli (N-12 128 / 129), KDV (190, 191@dönem, 391@dönem, 360 — §3.8).
- N-13 tamamlayıcı fiş (`opening` türü): her bilanço hesabı için arşiv K bakiyesi − modül açılışlarının karşıladığı = fark, karşı taraf 519. K6 (fiş alt defter hesabına yazamaz) yüzünden
  fişe girebilenler pratikte 500–503, 52x, 54x, 570, 580, 590, 591 (ve alt defteri olmayan öteki hesaplar); alt defter hesaplarının farkı fişle KAPATILAMAZ → fark ≠ 0 ise devir DURUR (kural:
  her alt defter hesabı kendi modül açılışıyla tam karşılanır). Sonuç: yeni yıl 519 = arşiv 519 (eşleştirilmemiş açılış aynen taşınır — C5 §2), 590 / 591 AYNEN açılır (§11.1; rapor S-1).

### 3.8 Modül ayrıntıları
- **Stok (§11.4, KG-9 / KG-10, M5, S207):** `yearEnd(K)` ürün bazında { miktar (eksi dahil), birim maliyet, değer, dayanak }; açılış hareketi miktar = K miktarı, birim = değer ÷ miktar
  (miktar > 0), eksi miktarda değer 0; silinmiş ürün kartına açılış YAZILMAZ (S207 = A — plan §8.6 "153'te kalır" ESKİDİ); Σ açılış değeri = DSS_K = arşiv 153 (N-01 sonrası).
  Yeni yılın ortalamasında eksi dönem başı miktar 0 sayılır (M5) — Ç6 değerlemesinin "DBS = açılış hareketleri" yolu (C6 §3) bunu karşılamalı (D4 testi).
- **Çek / senet:** açık evrak (portföy, tahsilde, ciroda, karşılıksız, verilen ödenmemiş) kalır; ≤K olayları tek "devir" olayına (K+1, durum ve hesap korunur: 101.01 / 101.02 / 121.01 /
  121.02 / 103 / 321, karşı 519); ciroda evrakın defter bakiyesi yok (yalnız iz). Kapanmış ≤K evrak budanır.
- **Banka / POS:** hesap başına K bakiyesi (`bank/money-lines.mjs` bakiyeleri); bekleyen POS kalemi olan satış ve kalemi kalır (`pos_items` ↔ `pos_sales` INNER JOIN — G3), açılışı 108.NN
  K+1; hesabı atanmamış 102.00 / 108.00 K bakiyesi de taşınmalı (değişmez 2) — alt defter yeri D4'te (risk; kâhinde senaryo yok — rapor §7).
- **Taksit kartları:** açık kartta ≤K tahsilatlar tek açılış (`plan_entries.opening` = K'ye kadar ödenen; Kasa'ya girmez), taksit dağılımı korunur; KAPALI / ödenmiş kart da kalır ve aynı tek
  açılışı alır (yoksa yeni yılda tahsilatsız kart TYK'da açık borç gibi görünür — türetildi, değişmez (4)); "Borçta Kalsın" kapanmış kartın kalanı açık kalem (M2). KG-5 Excel kartı ve fatura
  kartının ≤K maddesi yeni yılda ÜRETİLMEZ (§4.4).
- **KDV (M8 1–5):** 190, 191 (KDV dönemi boyutuyla: `vat_period`, boşsa belge ayı), 391 (belge ayı boyutuyla), 360 K bakiyeleri AYNEN; dönemi ≤ Aralık olan 191 / 391 yeni yılın HİÇBİR
  mahsubuna girmez (Bilanço Kesin Değil "Önceki Yıl KDV Mahsubu Yapılmamış" + ay listesi — EK-2 S34); dönemi Ocak olan Aralık alışının 191'i Ocak mahsubuna girer. Aralık mahsubu yapılmamışsa
  G4 UYARIR (yol: Devri Yenile). DİKKAT: Aralık KDV beyannamesi Ocak'ın son haftasında verildiği için Ocak başındaki devirlerin çoğu bu uyarıya düşer → sihirbazda belirgin uyarı + "Önce
  Aralık Mahsubunu Yapın" bağlantısı (BAŞ MİMAR önerisi; G4 "UYARIR" aynen kalır).
- **Arşivin Defter Türü:** arşiv `settings`'in kopyasını taşır (`book-type.mjs:10`) → arşivin raporları kendi türüyle; yeni yılda tür değişse de arşiv değişmez (iş listesi D4 notu) — değişmez testi.

### 3.9 Arka planda koşma
İş parçacığında, salt okunur bağlantıda, TEK okuma işleminde (WAL anlık görüntüsü — `financial-statements-worker.mjs:15-40` deseni: router + hizmetler iş parçacığında kurulur). Ana iş parçacığı
yalnız işi başlatır / ilerlemeyi iletir / sonucu tutar; olay döngüsü en çok ≤ 50 ms. Aynı şirkette aynı anda tek ön izleme (ikinci istek süreni döndürür). Sonuçta `dataVersion` (okuma
anındaki veri damgası) → D4 başlarken plan KOPYADA yeniden hesaplanır; ön izleme ile kopyadaki plan farklıysa (araya kayıt girmiş) sihirbaz uyarır. Ön izleme bakım kipi GEREKTİRMEZ (salt
okuma); çakışan yazımlar sonucu bayatlatır, bozamaz. İş parçacığı öldürülürse (kesinti) sonuç yok, veri aynı.

### 3.10 Hacim bütçesi ve ölçüm planı (G9; ders 47, 52, 53)
- BÜTÇE: ön izleme 100.000 para satırında ≤ 10 sn (iş parçacığında), olay döngüsü en çok ≤ 50 ms; 1.000.000'da ÖLÇÜLÜR (sayı kullanıcıya). Devir (D4: kopya + değişmezler) 1.000.000'da ≤ 5 dk.
- RİSK (ölçülmüş girdilerden): Ç6 Bilanço 100 bin ~5,5–6 sn, 1 M ~58–60 sn; Gelir Tablosu 100 bin ~3,3–3,7 sn (S224). İkisi + TYK toplu kuyruğu + mizan ayrı ayrı yevmiye kurarsa 10 sn AŞILIR.
  ÖNLEM (tasarım): yevmiye TEK kez kurulur; mizan, Gelir Tablosu, değerleme, TYK aynı girdiyi paylaşır; kapanış bilançosu için tam `balanceSheet` (MSUGT sınıflaması, brütleştirme) GEREKMEZ —
  kapanış = hesap bazında mizan + Ç6'nın dönem sonucu / değerleme işlevleri (tek kaynak korunur); `balanceSheet` yalnız Devir Raporu'nun 590 / 591 karşılaştırması için. Aşılırsa S224
  deseniyle kullanıcıya SAYIYLA sorulur (hız; ders 43 değil).
- ÖLÇÜM: ana oturumun düzeneğinde (temiz-100k; `scratchpad/ana-kabul`), programın KENDİ ürettiği veriyle (ders 17), 1 M kopyada; bileşen bileşen (okuma, yevmiye, TYK, değerleme, plan, rapor)
  + toplam + olay döngüsü en çok; `flock -x scratchpad/olcum.lock`, /proc/loadavg yazılır (ders 52); önce / sonra aynı kopya (ders 15). D3 var olan bir yolun yanıtını değiştirmez (yeni uçlar)
  → ders 53 (a) yeni uçlar + D3'ün dokunduğu Ç6 / TYK yolları (dokunursa).

### 3.11 "Nasıl bozulur?" (plan §8 1–16 + G10 17–28 aynen geçerli; aşağıdakiler bugünkü koddan EKLENEN — testler buradan)
29. İki satırlı seçenekte Alacak Toplamı gecikmiş açık kalemi kapatır (§3.5 madde 4) — iki seçenek × K'de gecikmiş kalem; gecikmiş(K+1), gecikmiş(vade+1) devirli = devirsiz.
30. Vadesiz açık kalem (vadesiz fatura, vadesiz Borç Yaz, karşılıksız evrak) K+1 tarihli satırda vadesizlik yüzünden gecikmişten çıkar / gün sayısı sıfırlanır (§1.2 madde 1).
31. Ödeme Sözü olan açık kalem — söz taşınmazsa takvim / Vade Takip ayrışır.
32. Kapalı ve "Borçta Kalsın" ile kapanmış kart; KG-5 Excel kartı; fatura kartı — yeni yılda ≤K tarihli madde, tahsilatsız açık kart görünümü (§1.2 madde 7, §3.8).
33. Açık şüpheli kaydı yeni yılda kendi ≤K tarihinde J-01 maddesi üretir (`doubtful-gl.mjs:137`) → 120 / 128 bozulur.
34. Dönemi Ocak olan Aralık alış faturası (KG-7) — budanınca Ocak mahsubundan düşer; dönemi Aralık olan 191 açılışı Ocak mahsubuna yanlışlıkla girer (§1.2 madde 5).
35. Hesabı atanmamış 102.00 / 108.00 bakiyesi ve Devir Kapanışı yapılmış hesap (S179 / S184 / S215) — açılışı taşınmaz, değişmez 2 kırılır.
36. KG-16 "Açılış Olabilir" onay bekleyen aday devirde (rapor S-2).
37. Kural Değişikliği Farkı (KG-15) düzeltilmemiş arşiv (rapor S-3).
38. Ön izlemeden sonra kayıt girilir, devir başlatılır (dataVersion farkı).
39. Aynı veride iki ön izleme; ön izleme sürerken Şirket Verisini Sıfırla / geri yükleme / şirket silme (iş parçacığı kapanışı — Ç3 DÜŞÜK-2 deseni).
40. Ön izleme işi sürerken bakım kipi açılır (Devri Başlat) — ön izleme sonucu bayat sayılır.
41. Silinmiş ürünün K miktarı (S207 A: açılış yok) — plan §8.6'nın eski "153'te kalır" beklentisi TEST EDİLMEZ (eskidi).
42. 001'de ön izleme (ortak katman aynı dosyada — budama sayıları users / roles / mobile_* / sessions'ı saymamalı).

### 3.12 Test planı (D3)
- **Kâhin karşılaştırması (ders 5, 40):** muhasebe kâhininin devir olayları (`devir {K, secenek}`; 28 senaryo + 3 rastgele tohum) sürücüde artık "uygulanmadı" değil: sürücü D3 planını
  (D4'ten sonra iki dosyayı) okur, kâhinin `acilis` çıktısıyla (açık kalemler, cariler, ekstre, kartlar, şüpheli, stok, eksi stok, N13) ve kapanış / mizan çıktısıyla karşılaştırır. Fark önce
  hatadır (ders 6); yapım aşaması listesi kuralı (CLAUDE.md SÜREN ESASLAR) aynen.
- **Gerçek veri (test kuralı, ders 17):** `v2.5.0` etiketinin GERÇEK koduyla (`git worktree add --detach`, ders 23 / 54) API'den üretilmiş 12+ aylık veri (binlerce cari / satır, 001 + 002),
  + v2.4.9 verisinin göç zinciri. Bu verinin devirsiz eşi: aynı olaylar devirsiz, aynı kilitle (28 = A) — gecikmiş, bakiyeler, 1–4 sınıfı aynı ("devir şirketin durumunu değiştirmez").
- **Değişmezler:** kitap §6 (1–6), EK-1 §4 (devir maddeleri) ve §3.11'den: iki seçenek eşdeğer; ≤K tarihli madde yok; ön izleme sayıları = planın yazım kümesi; plan belirlenimli (iki koşu bayt bayt).
- **Eski kod kırmızısı (ders 7, 38):** D3 yeni modül — eski kodda "modül yok" kırmızısı kanıt sayılmaz; dişi eski sürümün gerçek koduyla FARK testi (devirsiz eşdeğer) ve mutasyon taşır.
- **Mutasyon (para çekirdeği):** açık kalem vadesi (vadesizde belge günü), net satır formülü ve netleşmesi, M13 şüpheli payı, N-01 tutarı, 691 → 692, kapanış sırası, KDV dönem etiketi, kartın
  tükettiği kalemin dışlanması, bakiyesi 0 cariye satır yazılmaması.
- **Yarıda kesilme ve zaman:** iş parçacığı öldürülür → veri aynı, sonraki ön izleme baştan; iki TZ (UTC, Europe/Istanbul), sahte saat 31.12 23:59 / 01.01 00:00, Şubat'ta devir, 29 Şubat'lı
  yıl (ders 13, 22).
- **Hacim:** §3.10.
