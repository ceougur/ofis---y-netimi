# Ç5-A — defter türetmesinin okuduğu alanlar ↔ dönem kilidi izi (salt okunur kaynak taraması)

Ana oturumun notu (13.11 02:48 UTC): S146'nın hazırlığı (A ve B seçeneklerinde ortak girdi). Tarama ajanı kodu OKUYARAK çıkardı; hücreler koşularak doğrulanmadı — 'DOĞRULANMADI' yazanlar ve 'meşru yazım yok / var' hükümleri sonraki turda betikle sınanacak. Kaynak: çalışma dalı ucu (Ç5-A tur 1e birleşimi d2d39258 sonrası).

## DestekOfis: Ana Defter türetmesinin okuduğu sütunlar ve dönem kilidi izi (salt okunur tarama)

Hiçbir dosya değiştirilmedi, test koşulmadı. Kısaltmalar: **L** = `/home/user/ofis---y-netimi/server/routes/ledger.mjs` (`rows()` 49-282), **GL** = `/home/user/ofis---y-netimi/server/lib/general-ledger.mjs` (`journal()` 363-682), **INT** = `/home/user/ofis---y-netimi/server/lib/integrity.mjs` (LOCK_SQL 125-248), **SC** = `/home/user/ofis---y-netimi/server/lib/integrity-scope.mjs` (LOCK_FIELDS 54-66, `lockRelevant` 346-392).

**En önemli bulgu:** izde olmayan ama tutarı ya da hesabı değiştiren 13 sütun var. Bunlar: `cash_entries.transfer_id`, `account_entries.source` / `source_id` / `opening_review`, `plan_entries.cheque_id` / `opening`, `stock_moves.reason`, `invoices.gl_json` / `try_withheld` / `try_stoppage`, `cheque_collections.event_id`, `cheques.status` / `account_id`. Kapı dışı değişikliklerinin hiçbiri `period-lock` ya da "Donmuş Dönemin Kaynağı Değişti" denetimine görünmez. Bunlardan `opening_review`, `cheques.status` ve `cheques.account_id` kilitli satırda kapıdan geçerek de meşru olarak değişir.

**Önce bilmen gereken (tabloyu okumak için):**
- **İz nerede kullanılıyor?** Kilit izi (`lockDigestOf`, INT:256) üç yerde karşılaştırılır:
  - COMMIT tam kapısı: INT:950-952.
  - Tarama: `settleScan`, INT:1051.
  - Donmuş defterin kaynak izi: `/home/user/ofis---y-netimi/server/lib/ledger-snapshots.mjs:1059`.
- **Süzgecin rolü:** Süzgeç (SC) karar vermez. Yalnız LOCK_FIELDS ya da özel denetimlerle tam kapıya yönlendirir; tam kapı da yalnız izi karşılaştırır. `doubtful_*`, `vat_offsets`, `plan_imports` ve LOCK_FIELDS'ta olmayan öbür tablolara yazım "kapsam dışı" diye tam kapıya düşer (SC:289-290). Fiş tabloları FULL_TABLES'tadır (SC:50).
- **Kilitli dönemin raporları donmuş defterden okunur** (L:296-299). Bu yüzden ÇIKTI 2 (a)'daki "evet", CANLI türetmenin değiştiği anlamına gelir. Canlı türetmeyi kullananlar: mutabakat (`check`), yeniden dondurma, Kural Farkı. Donmuş rapor değişmez.
- **İz dışındaki tek dolaylı iz: `ledger:rule-diff`.** Donmuş ile canlı defteri yıl | hesap | alt hesap | cari toplamlarıyla karşılaştırır (ledger-snapshots.mjs:971-1000, 1080-1100).
  - Yalnız uyarıdır, sapma sayılmaz (INT:861).
  - Yalnız donmuş kapsam varsa çalışır.
  - Aynı yıl içindeki tarih kaymasını ve açıklama değişikliğini görmez.
  - Farkı "kural değişikliği" diye adlandırır.

### ÇIKTI 1 — Tablo

| tablo.sütun | türetmede nerede | defter etkisi | LOCK_SQL'de | LOCK_FIELDS / süzgeç | çalışma zamanı UPDATE (mevcut satır) |
|---|---|---|---|---|---|
| (her tablo).id | L her sorgu; GL madde kimliği | Maddenin kimliği ve varlığı | Var (her girdide id) | Kimlik değişirse tam kapı (SC:170) | yok |
| (her tablo).rowid (seq) | L:81,89,103,141,154,200,206,211,218,227,234,263; doubtful.mjs:30 | Yalnız aynı günün sırası; ayrıca şüpheli kayıtlarda eşit tarih bağı (doubtful-gl.mjs:93) | YOK | YOK | DOĞRULANMADI (VACUUM rowid'i değiştirebilir mi) |
| payments.amount | L:81; GL:402 | Tutar | payments | Var | workspace.mjs:485 (kilit 466/498) |
| payments.date | L:81; GL:402 | Tarih | payments | Var | workspace.mjs:485 |
| payments.method | L:81; GL:394,402 | 100/102/108/309 | payments | Var | workspace.mjs:485 |
| payments.fin_ref | L:37,81 | Alt hesap (102.xx/108.xx/309) | money_refs | Var | workspace.mjs:485 |
| payments.note | L:81; GL:402 | Yalnız açıklama | **YOK** | **YOK** | workspace.mjs:485 (kilitte 409) |
| cash_entries.kind | L:89; GL:411-436 | 649 ↔ 770; açılış ve vergi dalı | cash_entries | Var | cash.mjs:556 (kilit 522) |
| cash_entries.amount | L:89 | Tutar | cash_entries | Var | cash.mjs:357 (kilit 334), 556, 557 |
| cash_entries.date | L:89 | Tarih | cash_entries | Var | cash.mjs:357, 556, 557 |
| cash_entries.method | L:89; GL:408 | Para hesabı; transferde nakit bacağı | cash_entries | Var | cash.mjs:556 |
| cash_entries.fin_ref (ikizin t.fin_ref dahil) | L:83,89-90 | Alt hesap; transferde banka tarafının alt hesabı | money_refs (ikiz kendi satırıyla) | Var | cash.mjs:558 (aynı uç, kilit 522) |
| cash_entries.is_opening | L:85,89; GL:419 | B 100 / A 519, açılış sınıfı ↔ 649 | cash_opening_lock | Var | yok (göç 22) |
| cash_entries.tax_json | L:87,89; GL:425-433 | 360 / 689 ↔ 770 | cash_tax_lock | Var | yok |
| cash_entries.transfer_id | L:89-90; GL:407-414 | Transfer (100↔102, banka bacağı atlanır) ↔ gelir/gider (649/770); ikiz eşleşmesi | **YOK** | **YOK** (yalnız kapsam, SC:203) | yok (yalnız INSERT, trash.mjs:434) |
| cash_entries.description | L:89; GL:411-436 | Yalnız açıklama | **YOK** | **YOK** | cash.mjs:357, 556, 557 (kilitte 409) |
| account_entries.account_id | L:103,106 | Cari boyutu; silinmiş caride satır düşer | account_entries, party_lock | Var | accounts.mjs:1191, 1736 (kilit 1153 / stock.mjs:527) |
| account_entries.kind | L:103; GL:455-491 | Borç/alacak yönü ve madde türü | account_entries | Var | accounts.mjs:1189, 1736 |
| account_entries.amount | L:103 | Tutar | account_entries | Var | accounts.mjs:1189, 1736 |
| account_entries.date | L:103 | Tarih | account_entries | Var | accounts.mjs:1189, 1736 |
| account_entries.method | L:103; GL:489-491 | Para hesabı | account_entries | Var | accounts.mjs:1189 |
| account_entries.fin_ref | L:103 | Alt hesap | money_refs | Var | accounts.mjs:1189 |
| account_entries.is_opening | L:115-128; GL:274,480 | 519 ↔ 602/770, açılış sınıfı | account_opening_lock | Var | yok (göç 1364) |
| account_entries.opening_review | L:116-129; GL:273-274 | 519 ↔ 602/770 (candidate/confirmed = açılış) | **YOK** (bilerek, INT:237) | **YOK** | ledger-opening.mjs:244 (karar; kilit denetimi yok), accounts.mjs:2102 (geri alma); göç 1609 |
| account_entries.source | L:99,103; GL:443-476 | Madde türü: çek / fatura (atlanır) / değersiz 659 / stok / düz | **YOK** | **YOK** (yalnız kapsam ve tanınmayan kaynak, SC:192-198) | yok |
| account_entries.source_id | L:103,107-108; GL:467 | Evrak türü ve yönü, bankReturned, stok nedeni, değersiz satırın hedef kaydı | **YOK** | **YOK** | yok |
| account_entries.invoice_id | L:105; doubtful-gl.mjs:30-31 | Şüpheli kaydı varsa tahsilatın 128 ↔ 120 ayrımı | **YOK** | **YOK** | accounts.mjs:1189 (kilit 1153); pos.mjs:519 (linkFees, kilit denetimi görülmedi); invoices.mjs:2880 (iptal) |
| account_entries.doubtful_skip | L:105; GL:490 | Şüpheli kaydı varsa 128 ↔ 120 ayrımı | **YOK** | **YOK** | accounts.mjs:1189 (kilit 1153) |
| account_entries.note | L:103; GL:455-491 | Yalnız açıklama | **YOK** | **YOK** | accounts.mjs:1189, 1736; invoices.mjs:4011, 4015, 4033, 4225 (numaralama; kilit denetimi görülmedi) |
| accounts.type | L:103,142,154,201 | 120/320/336; carisiz 127 | party_lock, plans_close_lock | lockRelevant accounts (SC:369-379) | ÇIKTI 3 |
| accounts.deleted_at | L:106,144,156,202 | Satırların deftere girip girmemesi; kartın 127'ye düşmesi | party_lock (live) | SC:369 | ÇIKTI 3 |
| cheques.direction (cari satırı join'i) | L:104,107 | 101/121 ↔ 103/321 | cheques_lock (issue_date ≤ kilit) | cheques | cheques.mjs:568 yalnız çekirdek değişikliğinde (kilit 533) |
| cheques.instrument | L:104,152,227,234,263 | Çek 101/103 ↔ senet 121/321 | cheques_instrument_lock (yalnız ≠'cheque'; tür değişimi satır ekler/siler) | cheques | cheques.mjs:568 (çekirdek, kilit 533) |
| cheques.amount | L:234,264 | Carisiz evrak tutarı; tahsil kaydı tutarının yedeği | cheques_lock | cheques | cheques.mjs:568 (çekirdek) |
| cheques.issue_date | L:234 | Carisiz evrak maddesinin tarihi | cheques_lock | cheques | cheques.mjs:568 (çekirdek) |
| cheques.deleted_at | L:227,240,266 | Evrak satırlarının varlığı | cheques_lock (live) | cheques | cheques.mjs:713, 1010, 1073 |
| cheques.is_opening | L:232,234; GL:453 | 519 ↔ 649.90/770.90, açılış sınıfı | cheques_opening_lock | cheques | yok (göç 1626) |
| cheques.status | L:254 | Carisiz evrakın karşılıksız maddesinin varlığı | **YOK** (bilerek, INT:149) | **YOK** | cheques.mjs:649, 688, 1046, 1060 |
| cheques.account_id | L:238,243 | "Cariye işlenmemiş" sayılma ve hasDebt (free-in / free-bounce) | **YOK** | **YOK** | cheques.mjs:635 (karşılıksızda cari seçimi), 568 (çekirdek) |
| cheques.serial_no | L:234,247,263; doubtful.mjs:33 | Yalnız açıklama | **YOK** | **YOK** | cheques.mjs:568 (çekirdek dışı, kilitte serbest) |
| plan_entries.cheque_id (carisiz evrak süzgeci) | L:241 | Evrakın carisiz sayılması | **YOK** | **YOK** | yok |
| cheque_events.kind/amount/date/method | L:227,235; GL:635-640 | Tahsil/ödeme maddesi; karşılıksız tarihi | cheque_events_lock | Var | cheques.mjs:561 (tarih ve tutar; kilit 678 DOĞRULANMADI) |
| cheque_events.cheque_id | L:227,235 | Evrak bağı | cheque_events_lock | Var | yok |
| cheque_events.fin_ref / event_id | L:221,227 | Alt hesap; closesDeposit | money_refs | Var | yok |
| cheque_events.note | L:227 | Yalnız açıklama | **YOK** | **YOK** | yok |
| cheque_events.created_at | L:235 | Birden çok karşılıksızda hangi tarihin seçildiği | **YOK** | **YOK** | yok |
| cheque_collections.status/closed_date/close_event_id | L:225,236,263-265; GL:631-633 | 101.01 ↔ 101.02, kapanış maddesi | cheque_collections_closed (yalnız closed_date dolu ve ≤ kilit) | SC:387 | collections.mjs:204, 235, 242, 276, 328; repair.mjs:240 |
| cheque_collections.given_date / cheque_id | L:263-266 | Tahsile verme maddesinin tarihi ve evrakı | cheque_collections_given | SC:385 | repair.mjs:221 |
| cheque_collections.event_id | L:264 | Tahsile verme tutarı (fin_events.try_minor) | **YOK** | **YOK** | yok |
| plans.total | L:141; GL:505-513 | Kart alacağı, vazgeçilen kalan | plans, plans_close_lock | SC:359-360 | plans.mjs:572, 767, 832, 1368, 1657 |
| plans.status | L:141; GL:511 | 689 kapanış maddesi | plans_close_lock | SC:360 | plans.mjs:767 |
| plans.covers_balance | L:141,155; GL:505-516 | Kart maddesinin varlığı | plans (WHERE), plans_import_lock | SC:359 | görülmedi |
| plans.registered_on | L:141,155 | Kart maddesinin tarihi; şüpheli openedOn | plans, plans_close_lock | SC:359 | plans.mjs:767 (kilit 746-747); göç 518 |
| plans.created_at | L:141,155 | registered_on boşsa tarih | Yalnız plans_close_lock içinde; **plans girdisinde YOK** | SC:360 | yok |
| plans.closed_at / updated_at | L:141; GL:513 | Kapanış günü | plans_close_lock | SC:360 | plans.mjs:771, FREEZE_CLOSE (plans.mjs:29) |
| plans.deleted_at | L:144,156,241 | Kart ve satırların varlığı | plans girdilerinin WHERE'i | SC:359, 362 | plans.mjs:809, 1670; trash.mjs:308 |
| plans.account_id | L:144,156 | Cari ↔ carisiz 127 | plans, plans_party_lock, plans_close_lock | SC:359, 362 | plans.mjs:767; göç 685 |
| plans.import_id | L:168-170; GL:505-508 | KG-5 açılış (T−P, 519) ↔ 602 | plans_import_lock | SC:359 | yok |
| plan_imports.created_at | L:168; GL:508 | Yüklenen kart maddesinin tarihi (yerel gün) | plans_import_lock | SC:381 | yok |
| plan_entries.plan_id/kind/amount/date/method | L:154 | Tahsilat maddesi | plan_entries | Var | plans.mjs:1100 (kilit 1081) |
| plan_entries.fin_ref | L:154 | Alt hesap | money_refs | Var | plans.mjs:1100 |
| plan_entries.cheque_id (satırın kendi maddesi) | L:149,152,154; GL:529-539 | 101/121 ↔ para hesabı; karşılıksız ↔ iade | **YOK** | **YOK** | yok |
| plan_entries.opening | L:154,169; GL:528-532 | B 519 ↔ para; yüklenen kartta madde yok; T−P tutarı | **YOK** | **YOK** | yok |
| plan_entries.note | L:154 | Yalnız açıklama | **YOK** | **YOK** | plans.mjs:1100 (kilit 1081) |
| stock_moves.kind/amount/date/pay/method | L:206; GL:543-551 | Peşin stok maddesi | stock_moves | Var | stock.mjs:544 (kilit 527) |
| stock_moves.fin_ref | L:206 | Alt hesap | money_refs | Var | stock.mjs:544 |
| stock_moves.reason (peşin ve cari join'i) | L:104,108,206; GL:472-474, 547-549 | 600 ↔ 153 ↔ 610 | **YOK** | **YOK** | stock.mjs:544 (kilit 527) |
| stock_moves.note | L:206,211 | Yalnız açıklama | **YOK** | **YOK** | stock.mjs:544; invoices.mjs:4012, 4225 |
| stock_moves.qty/unit_price/is_opening | L:211-212; GL:313,555-559 | Açılış stoku tutarı, 153/519 | stock_opening_lock (+stock_moves) | Var | stock.mjs:544 |
| stock_moves.item_id → stock_items.name/unit | L:211 | Yalnız açıklama | item_id stock_moves'ta; name/unit **YOK** | **YOK** | stock.mjs:330 (ürün kartı, kilitsiz) |
| invoices.kind/status/account_id/issue_date | L:200-202; GL:585-612 | Madde türü, varlığı, carisi, tarihi | invoices | Var | invoices.mjs:2868 (iptal, kilit 2860), 2628/2634 (kilit 1294/2533) |
| invoices.try_payable / try_vat | L:200-201 | Kontrol hesabı tutarı / 191 / 391 | invoices | Var | 2628 (kilit 1294) |
| invoices.gl_json | L:200; GL:575-579 | Matrah hesapları (600/602/153/770/760/255 …) | **YOK** | **YOK** | invoices.mjs:2628, 2634, 2785 (taslak / kilit 1294) |
| invoices.try_withheld | L:200; GL:581 | 391 ↔ 360 tevkifat | **YOK** | **YOK** | aynı |
| invoices.try_stoppage | L:200; GL:582 | 193 / 360 stopaj | **YOK** | **YOK** | aynı |
| invoices.number | L:200; GL:584 | Yalnız açıklama | **YOK** | **YOK** | invoices.mjs:4031, 4221, 4534 (numaralama; kilit denetimi görülmedi) |
| bank_lines.event_id/seq/role/gl/sub/side/try_minor | L:218; GL:642-655 | Banka fişi satırları; 500→519 (rol) | bank_lines_lock | SC:382 (kilitli fiş) | yok |
| fin_events.date | L:218 | Fiş tarihi | fin_events_lock | Var | repair.mjs:220; event-copy.mjs:80/88 (DOĞRULANMADI) |
| fin_events.try_minor (tahsil kaydı) | L:264 | Tahsile verme tutarı | fin_events_lock | Var | repair.mjs:220 |
| fin_events.no / description | L:218; GL:644 | Yalnız açıklama | **YOK** | **YOK** | description: bank/vouchers.mjs:663 ("kilitli dönemde de"), invoices.mjs:4018, 4035, 4226; no: görülmedi |
| doubtful_receivables.account_id/date/amount_minor/reason/cheque_id/event_id/cancelled | doubtful.mjs:30-36, 45-75; doubtful-gl.mjs:226-283 | 128 / 120 alma; ayırma | doubtful_lock | Tam kapı (kapsam dışı) | doubtful.mjs:507 |
| doubtful_receivables.status (released) / closed_date / close_event_id | aynı; doubtful-gl.mjs:96 | Şüpheliden çıkar maddesi | doubtful_closed_lock (yalnız closed_date ≤ kilit) | Tam kapı | doubtful.mjs:423, 548 |
| doubtful_receivables.note | doubtful.mjs:30; doubtful-gl.mjs:259 | Yalnız açıklama | **YOK** | Tam kapı | yok |
| doubtful_provisions.doubtful_id/date/amount_minor/status/event_id | doubtful.mjs:37-38, 58-73 | 654 / 129 karşılık | doubtful_provisions_lock (cancelled) | Tam kapı | doubtful.mjs:501, 519, 561, 575 |
| doubtful_provisions.note | doubtful-gl.mjs:270 | Yalnız açıklama | **YOK** | Tam kapı | yok |
| vat_offsets.* (month, date, out/in/carry/payable_minor, status) | L:276; GL:659-666 | KDV mahsup fişi | vat_offsets_lock | Tam kapı (L:275 yorumu) | DOĞRULANMADI |
| vat_offsets.created_at | L:276 (ORDER) | Yalnız sıra | **YOK** | — | DOĞRULANMADI |
| ledger_vouchers.date/type/journal_class/year/no + ledger_voucher_lines.account/sub/party/debit/credit/seq | ledger-vouchers.mjs:226-242; GL:673-679 | Saklanan fiş | ledger_vouchers_lock | FULL_TABLES | Tetikleyici engeller (migrations.mjs:1763-1770) |
| ledger_vouchers.description | ledger-vouchers.mjs:231,236 | Yalnız açıklama | **YOK** | FULL_TABLES | Tetikleyici engeller |
| bank_accounts.kind/gl_sub, pos_terminals.gl_sub | L:40-45; GL:324-335 | Alt hesap | **YOK** | SC:175 (tam kapı) | ÇIKTI 3 |

Kısmi kapsam notları:
- `plans` girdisi yalnız `covers_balance=0` ve dolu `registered_on` kartları kapsar.
- `cheques_*` girdileri yalnız `issue_date ≤ kilit` olan evrakı kapsar.
- `cheque_collections_closed` yalnız `closed_date ≤ kilit` olanları kapsar.
- Yüklenen kartın T−P'sindeki P, açılış satırlarını tarihten bağımsız toplar (L:169). Kilitten sonra tarihli açılış satırı varsa izin dışındadır (DOĞRULANMADI: böyle satır oluşur mu).

### ÇIKTI 2 — İzde olmayanlar

"Canlı" denen her yerde donmuş rapor değişmez; canlı türetme (mutabakat, yeniden dondurma, Kural Farkı) değişir.

**Tutarı / hesabı değiştirenler:**

1. **cash_entries.transfer_id**
   - (a) Evet, canlı. Transfer ↔ 649/770; banka bacağı maddesi doğar ya da kaybolur. rule-diff görür.
   - (b) Meşru yazım yok.
2. **account_entries.source**
   - (a) Evet. Madde türü ve hesabı değişir; rule-diff görür.
   - (b) Meşru yazım yok.
3. **account_entries.source_id**
   - (a) Koşullu. Çek, stok ya da değersiz bağlı satırda hesap veya 128 hedefi değişir.
   - (b) Meşru yazım yok.
4. **account_entries.invoice_id**
   - (a) Koşullu. Yalnız carinin şüpheli kaydı varsa ve satır tahsilatsa 120 ↔ 128 kayar.
   - (b) Koşullu var. pos.mjs:519 linkFees'te kilit denetimi görülmedi. invoices.mjs:2880 iptalde bağlı satırın kilitli tarihli olup olamayacağı DOĞRULANMADI.
5. **account_entries.doubtful_skip**
   - (a) Koşullu, 4. madde gibi.
   - (b) Meşru yazım yok (accounts.mjs:1189, kilit 1153).
6. **account_entries.opening_review**
   - (a) Evet. 519 ↔ 602/770 ve açılış sınıfı değişir; rule-diff görür.
   - (b) Var: ledger-opening.mjs:244-245. Kararın ucunda (`/home/user/ofis---y-netimi/server/routes/opening-review.mjs`) kilit denetimi yok; tasarım kararı, INT:237.
7. **plan_entries.cheque_id**
   - (a) Evet. 101/121 ↔ para hesabı; karşılıksız ↔ iade. Ayrıca evrakın carisiz sayılması değişir (L:241), free-in maddesi doğar ya da kaybolur.
   - (b) Meşru yazım yok.
8. **plan_entries.opening**
   - (a) Evet. 519 ↔ para; yüklenen kartta madde var ↔ yok; T−P tutarı değişir.
   - (b) Meşru yazım yok.
9. **stock_moves.reason**
   - (a) Evet. 600 / 153 / 610 değişir.
   - (b) Meşru yazım yok (stock.mjs:544, kilit 527).
10. **invoices.gl_json**
    - (a) Evet. Matrah hesap dağılımı değişir; rule-diff görür.
    - (b) Meşru yazım yok (kilit invoices.mjs:1294, 2533).
11. **invoices.try_withheld**
    - (a) Evet: 391/360.
    - (b) Meşru yazım yok.
12. **invoices.try_stoppage**
    - (a) Evet: 193/360.
    - (b) Meşru yazım yok.
13. **cheque_collections.event_id**
    - (a) Evet: 101.01/101.02 tutarı.
    - (b) Meşru yazım yok.
14. **cheques.status**
    - (a) Koşullu. Yalnız carisiz alınan evrakta, karşılıksız olayı ≤ kilitse karşılıksız maddesi kaybolur ya da doğar.
    - (b) Var: cheques.mjs:649, 688, 1046, 1060. Kilitli tarihli evrakın bugünkü tahsil, ciro ve karşılıksızı engellenirdi.
15. **cheques.account_id**
    - (a) Evet. Carisiz ↔ carili sayılır; cari satırı yerinde kaldığı için çift madde ya da eksik madde oluşur.
    - (b) Var: cheques.mjs:635 (carisiz evrakın karşılıksızında cari seçimi).
16. **plans.created_at**
    - (a) Koşullu. Yalnız `registered_on=''` kartta maddenin tarihi değişir.
    - (b) Meşru yazım yok. Boş Kayıt Tarihi'nin bugün yazılıp yazılamayacağı DOĞRULANMADI (göç 9 boşları doldurur: migrations.mjs:518).
17. **cheque_events.created_at**
    - (a) Koşullu. Aynı evrakta birden çok karşılıksız olayı varsa maddenin tarihi değişir.
    - (b) Meşru yazım yok.

**Yalnız açıklama değiştirenler** — (a) hayır, tutar ve hesap değişmez, rule-diff görmez:

| Sütun | (b) Meşru yazım |
|---|---|
| payments.note | yok |
| cash_entries.description | yok |
| plan_entries.note | yok |
| cheque_events.note | yok |
| doubtful_receivables.note | yok |
| doubtful_provisions.note | yok |
| account_entries.note | var: invoices.mjs:4011, 4015, 4033, 4225 (numaralama) |
| stock_moves.note | var: invoices.mjs:4012 |
| invoices.number | var: invoices.mjs:4031, 4221, 4534 |
| cheques.serial_no | var: cheques.mjs:568 |
| fin_events.description | var: bank/vouchers.mjs:663; invoices.mjs:4018, 4226 |
| fin_events.no | yazım görülmedi |
| ledger_vouchers.description | tetikleyici engeller |
| stock_items.name / unit | var: stock.mjs:330 |

### ÇIKTI 3 — Satır dışı girdiler

- **Carinin türü ve silinmişliği (`accounts.type` / `deleted_at`)**
  - Kilitli defteri değiştirir: evet (120/320/336/127; satırlar düşer).
  - Gören denetim: party_lock (INT:139-147) ve SC:369-379.
  - party_lock yalnız kilitli dönemde cari satırı ya da kartı olan carileri kapsar. Faturası olup başka satırı olmayan cari var mı DOĞRULANMADI; faturanın cari satırı varsa kapsanır.
- **Hesap planı / sınıflama (ACCOUNT_PLAN, CHART, PLAN_SUBS; GL:108-231)**
  - Kod sabitidir; `journal()` sınıflamayı okumaz (GL:41). Veriyle değişmez.
- **Şirket ayarları**
  - `rows()` ve `journal()` içinde ayar okuması görülmedi (kod okuması). Hesap kodları yazım anında saklanır (`bank_lines.gl`, `gl_json`).
- **Kural sürümü (LEDGER_RULE_VERSION, aliases; GL:24,30)**
  - Kod sabiti.
  - Veri tarafı: `ledger_snapshot_runs.rule_version` ve `ledger_snapshots`. Hangi kuralla donulduğunu ve kartın eski kurala bağlanmasını (ledger-opening.mjs:114-171) belirler.
  - Koruma: tetikleyiciler (migrations.mjs:1700-1714) ve ledger:snapshot denetimleri (satır toplamı, kapsam, bilinmeyen kural; ledger-snapshots.mjs:1034-1063).
  - Tamamlanmış koşunun `rule_version`'ı dışarıdan değişirse görülür mü: DOĞRULANMADI.
- **Taksit kartının Kayıt Tarihi / yükleme bağı / yükleme damgası**
  - Gören denetim: plans, plans_import_lock (INT:131, 242-247), SC:359, 381.
  - Eksik: `registered_on` boşsa `created_at`; T−P'nin kilit sonrası açılış satırları.
- **Sunucunun saat dilimi (process TZ)**
  - Yükleme damgasının YEREL günü (GL:276-281) kart maddesinin tarihini belirler. Saat dilimi değişirse madde kilit sınırının öbür yanına geçebilir.
  - İz bunu görmez. rule-diff yalnız madde kapsam dışına çıkarsa ya da yıl değişirse görür.
- **Banka hesabı ve POS tanımları (`bank_accounts.kind/gl/gl_sub`, `pos_terminals.gl_sub`; L:40-45)**
  - Kilitli defteri değiştirir: evet (alt hesap, 309/300).
  - İzde yok. Hareketli hesapta tür ve para birimi değişikliği 409 (bank/accounts.mjs:570). Süzgeç tam kapıya yollar (SC:175), ama tam kapı tarihsel alt hesabı izle karşılaştırmaz.
  - `gl_sub`'ın düzenlenebilir olup olmadığı (bank/accounts.mjs:611 genel UPDATE; pos.mjs:342) DOĞRULANMADI. rule-diff alt hesap değişimini görür.
- **Dönem kilidinin kendisi**
  - Gören denetim: kapı "kilit değişti" (INT:922) ve ledger:snapshot kapsam ↔ kilit uyuşmazlığı (ledger-snapshots.mjs:1043).
- **rowid sırası**
  - Mizanı değiştirmez. Aynı tarihli şüpheli kayıtlarda ayırma bağı (doubtful-gl.mjs:93) 120/128 dağılımını değiştirebilir. Denetim yok.

### ÇIKTI 4 — `opening_review` ve `opening_review_gate` birlikte değişirse

Bunu gören bir denetim yok.
- `openingReviewDrift` yalnız iki sütunun farkını sayar (ledger-opening.mjs:199-208; denetim INT:527-534). İkisi aynı değere çekilirse sayı 0 olur.
- LOCK_SQL durumu bilerek dışarıda tutar (INT:237); LOCK_FIELDS'ta da yok (SC:58).
- "Açılış Karşılığı" (INT:510-518) aynı sütunu okuyan `openingCounterpart`'ı kullanır (ledger-opening.mjs:51). İki yükleyici birlikte kayar, fark çıkmaz.
- Cari mutabakatı karşı hesaba bakmaz.
- Tek dolaylı iz `ledger:rule-diff`'tir (ledger-snapshots.mjs:1080-1100). Satır donmuş kapsamdaysa 519 ↔ 602/770 farkını yıl/hesap toplamında gösterir. Ama:
  - Uyarı düzeyindedir, sapma sayılmaz (INT:861); günlüğe ya da zile gitmez.
  - Nedeni belirsiz bir ipucuyla gösterir (ledger-snapshots.mjs:112).
  - Donmuş kapsam yoksa (kilitsiz ya da dondurma bekliyor) hiç görünmez.
- Değişiklik denetim günlüğüyle (audit) karşılaştıran bir denetim bulunmadı.
