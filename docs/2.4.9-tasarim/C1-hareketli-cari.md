# 2.4.9 C1 — Hareketli Cari Silinemez (TASARIM NOTU, kod yok)

> Sınıf [XH] (iş listesi C1). Taban: dal `claude/compassionate-galileo-f9kghg`, commit 35e90e47 (C1 öncesi = "eski kod"). Yazan: tasarım ajanı,
> 03.11.2026 18:17 UTC. Kod DEĞİŞMEDİ; commit/push yok. Okunanlar: CLAUDE.md (anayasa + dersler 1–48), docs/BAGIMSIZ-DOGRULAMA-PRENSIBI.md,
> docs/2.4.9-IS-LISTESI.md (C1, KARAR 03.11 ~18:10), docs/2.4.8-IS-LISTESI.md son 15 satır (MÜŞTERİ BULGUSU, KARAR 03.11 ~11:45 A, İLKE ~11:50).
> Bu notta "İLKEYLE" = kullanıcının 03.11 ~11:50 ilkesinin TEK okumaya izin verdiği netleştirme; iki okumalı kalanlar §4'te SORU olarak durur
> (baş mimar ya da bu ajan karar vermez — ders 40, 43). Baş mimar yorumları §11'de "BAŞ MİMAR YORUMU" diye listelidir.

## 0. Kullanıcı kararları (AYNEN)

- **KARAR (03.11 ~11:45 UTC, A):** "HAREKETİ OLAN CARİ SİLİNEMEZ; program "Pasife Al" önerir (Sil düğmesi pasif + nedeni görünür yazı, deleteBlock ile aynı yer).
  HİÇ HAREKETİ OLMAYAN (yanlış açılmış) cari silinebilir. 2.4.9 kapsamına girer. … cariyi kaldıran BÜTÜN yollar (tekli Sil, toplu işlem, Excel/Sheets
  yeniden yükleme, Şirket Verisini Sıfırla hariç), daha önce silinmiş cariler Silinenler'den geri yüklenebilir kalır."
- **KARAR / İLKE (03.11 ~11:50 UTC):** "'hareket' = cariye bağlı HER PARASAL İŞLEM (tutar taşıyan her kayıt: tahsilat/ödeme, Borç/Alacak Yaz, açılış bakiyesi,
  stok hareketinin cari satırı, taksit kartı ve tahsilatları, çek/senet, fatura — taslak/iptal dahil tutarlı her belge, mahsup, iade). Biri varsa cari silinemez →
  Pasife Al. Tutar taşımayan kayıtlar (not, WhatsApp gönderim izi, değişiklik geçmişi) hareket sayılmaz. İki okumalı durum çıkarsa bu ilkeyle karar verilir,
  'İLKEYLE' diye iş listesine yazılır."
- **İş listesi C1:** "… varsa silme 409 + Sil düğmesi pasif, nedeni görünür yazı, "Pasife Al" önerisi (deleteBlock tek yer). Hareketsiz cari silinir. Cariyi kaldıran
  BÜTÜN yollar (tekli Sil, toplu işlem, Excel/Sheets yeniden yükleme, birleştirme varsa) aynı kurala. Daha önce silinmiş cariler Silinenler'den geri yüklenebilir kalır."

## 1. Bugünkü davranış ve kanıt

### 1.1 Kod (35e90e47)
- `server/routes/accounts.mjs:645-661` — `DELETE /api/workspace/accounts/:id`: `deleteBlock(account)` (649) → engel yoksa `cash.guardRemove` (652; carinin
  `kind IN ('in','out') AND source = ''` satırlarını Kasa'dan düşecek diye eksi bakiye sorusu) → `UPDATE accounts SET deleted_by, deleted_at` (655, YUMUŞAK silme;
  yorum: "hareketleri yerinde durur (Kasa'dan düşer)").
- `server/routes/accounts.mjs:684-711` — `deleteBlock`: sırayla (1) taksit kartı `plans().countForAccount` (plans.mjs:1480, `deleted_at IS NULL`), (2) stok satırı —
  YALNIZ ürünü SİLİNMEMİŞ olan (`JOIN stock_items i … AND i.deleted_at IS NULL`, 687-691), (3) çek/senet `cheques().countForAccount` (cheques.mjs:935,
  `account_id = ? OR endorse_account_id = ?`, silinmemiş), (4) fatura YALNIZ `status = 'issued'` (695-696, kod `account-has-invoices`), (5) banka hesabına bağlı satır
  `fin_ref <> ''` (699-700, kod `account-bank-linked`), (6) şüpheli alacak `doubtful().assertNone` (doubtful.mjs:592-596, `status <> 'cancelled'`, kod
  `account-doubtful-open`), (7) kapanmış dönem `assertUnlocked` (kod `period-locked`). Nakit tahsilat/ödeme, Borç/Alacak Yaz, açılış, taslak/iptal fatura,
  silinmiş ürünün stok satırı, hesabı atanmamış havale/POS ENGELLEMİYOR.
- `server/routes/accounts.mjs:181` — cari kartı (`detail`) `deleteBlock`'u yalnız `accounts.manage` olana taşır; istemci `client/assets/hof-accounts.js:372`
  Sil'i `disabled` + `title`, 374 `<ul data-delete-block><li><b>Silinemez:</b> …` yazar. `hof-accounts.js:1384-1405` `deleteAccount`: onay metni
  "“…” silinecek. Hareketleri Kasa’dan düşer." (1387); 409'da YALNIZ `account-bank-linked` / `account-has-invoices` kodlarında "Cari Silinemez → Pasife Al"
  sorar (1399); taksit/stok/çek engelleri kodsuz (yalnız ileti).
- Silinen carinin satırları her yerde `a.deleted_at IS NULL` ile dışarıda (ör. `server/routes/workspace.mjs:690`); Silinenler notu "Hareketleriyle Cari listesine geri
  döner; Kasa yeniden hesaplanır." (`accounts.mjs:1800-1810`), `restoreDeleted` (1811-1826) kilitli dönem dışında geri getirir.

### 1.2 Gerçek programda yeniden üretim (bu not için; geçici test sunucusu, `HUKUK_LICENSE_URL=http://127.0.0.1:9`, Linux, Node 22.22.0)
Betik (not defteri, depoya alınmadı): `…/scratchpad/c1-tasarim-35e90e47/bugun.mjs`; her satır ayrı yeni cari + tek hareket → kartın `deleteBlock`'u →
`DELETE …?cashForce=1` → Kasa önce/sonra. Ham çıktı (çıkış 0):

| Carideki tek kayıt | Kart deleteBlock | Silme | Kod | Kasa önce → sonra |
|---|---|---|---|---|
| hiçbiri (hareketsiz) | — | 200 | — | 0 → 0 |
| nakit tahsilat 500 | — | **200** | — | **500 → 0** |
| nakit ödeme 300 | — | **200** | — | **−300 → 0** |
| Borç Yaz 250 | — | **200** | — | 0 → 0 |
| açılış bakiyesi 400 | — | **200** | — | 0 → 0 |
| taslak fatura | — | **200** | — | 0 → 0 |
| iptal edilmiş fatura | — | **200** | — | 0 → 0 |
| kayıtlı fatura | "Bu carinin 1 faturası var; …" | 409 | account-has-invoices | 0 → 0 |
| açık hesap stok girişi, ürünü sonra silinmiş | — | **200** | — | 0 → 0 |
| taksit kartı | "Bu carinin 1 taksit kartı var. …" | 409 | (kodsuz) | 0 → 0 |
| tek tahsilatı Silinenler'e gönderilmiş | — | 200 | — | 0 → 0 |

Mevcut CI testi de aynısını gösterir: `test/asama0-226.test.mjs` A3 (yerelde koşuldu: tests 9 / pass 9 / fail 0, çıkış 0) — "Kasa'yı eksiye düşüren cari silme …
onaylanırsa 200" testinde 1.000 TL nakit tahsilatlı cari silinir, Kasa 200 → −800. Müşteri bulgusu ("cariyi silince nakit ödemeler kasadan kayboluyor") DOĞRU.

### 1.3 Ne zamandan beri (git log -S)
- Yumuşak silme + "Hareketleri Kasa’dan düşer" + taksit/stok engeli: ebe2de76 / e5041fdd (28.09.2026) → **v2.0.6**'dan beri.
- Çek/senet engeli e21a14cf → v2.0.7; kayıtlı fatura engeli 85171aeb → v2.0.15; banka bağlı engel + `account-bank-linked` 7c6405fc → v2.1.0;
  eksi bakiye sorusu (`guardRemove`) ve kilitli dönem engeli 5346ff84 → v2.0.26; şüpheli alacak engeli ec1ef3f1 → v2.3.0; `deleteBlock` tek yer + kartta pasif
  Sil 163dd5d6 → v2.4.3. Yani nakit/borç/açılış/taslak/iptal hareketli cari v2.0.6–v2.4.8 boyunca silinebiliyordu → **eski sürüm verisinde silinmiş hareketli
  cariler VAR olabilir** (§8, §9 madde 5).

## 2. "Hareket" tanımının koddaki karşılığı

Şema: `server/lib/migrations.mjs` (satırlar tabloda). "Bugün" = 35e90e47 deleteBlock'u engelliyor mu; "Yeni" = C1 sonrası.

| # | Tablo / sütun (cariye bağ) | Ne | Tutar taşır mı (dayanak) | Bugün | Yeni |
|---|---|---|---|---|---|
| H1 | `account_entries.account_id`, `source = ''`, kind in/out (602-617; method, fin_ref) | Tahsilat / Ödeme (nakit, havale, POS/kredi kartı; iade geri ödemesi `refund_of`) | EVET (`amount`) — ilke "tahsilat/ödeme", "iade" | yalnız `fin_ref <> ''` ise | HAREKET |
| H2 | aynı, kind debt/credit, `is_opening = 0` | Borç Yaz / Alacak Yaz (vade alanlarıyla) | EVET — ilke "Borç/Alacak Yaz" | hayır | HAREKET |
| H3 | aynı, `is_opening = 1` (v35) | Açılış Bakiyesi (Yeni Cari, Excel cari yükleme) | EVET — ilke "açılış bakiyesi" | hayır | HAREKET |
| H4 | `account_entries.source = 'stock'` (source_id = stock_moves.id; `stock_moves.account_id` yalnız `pay = 'account'`) | Stok hareketinin cari satırı (alım, satış, iade) | EVET — ilke "stok hareketinin cari satırı" | yalnız ürün silinmemişse | HAREKET (ürün silinmiş olsa da: satır carinin bakiyesinde durur, stock.mjs:328 "carideki karşılıkları silinmez") — İLKEYLE |
| H5 | `account_entries.source = 'invoice'` | Faturanın cari borcu/alacağı + peşin tahsilatı | EVET | fatura kayıtlıysa | HAREKET (H9'la birlikte) |
| H6 | `account_entries.source = 'cheque'` (cheques.mjs:266) | Çekin cari satırı (alındı/verildi/karşılıksız/ciro) | EVET | çek silinmemişse | HAREKET (H11'le birlikte) |
| H7 | `account_entries.source = 'doubtful'` | Değersiz Alacak satırı | EVET | şüpheli kaydı açıksa | HAREKET |
| H8 | `account_entries.source = 'bank'` (pos.mjs:509 POS iadesi, vouchers) | Banka/POS kaynaklı cari satırı | EVET | yalnız `fin_ref <> ''` | HAREKET |
| H9 | `invoices.account_id` (925-997), status draft / issued / cancelled; kind sale, purchase, sale_return, purchase_return, smm | Fatura, iade faturası, e-SMM makbuzu — taslak ve iptal dahil | EVET (`payable_total`, kalemler) — ilke "taslak/iptal dahil tutarlı her belge", "iade" | yalnız issued | HAREKET (her durum; silinen fatura tablodan kalkar, Silinenler'e gider → §4 S1) |
| H10 | `invoice_offsets.account_id` (1094-1106) | Mahsup fişi | EVET (`amount`) — ilke "mahsup" | hayır (faturayla dolaylı) | HAREKET |
| H11 | `cheques.account_id` / `endorse_account_id` (700-727), `deleted_at IS NULL`; `cheque_events.account_id` | Çek/senet (alınan, verilen, ciro alan cari) | EVET (`amount > 0` CHECK) — ilke "çek/senet" | evet | HAREKET |
| H12 | `plans.account_id` (450, 660), `deleted_at IS NULL`; `plan_items`, `plan_entries` (plan üzerinden) | Taksit kartı (açık/kapalı) + taksit tahsilatları + Excel devir açılışı | EVET (`total`, kalemler, `plan_entries.amount`) — ilke "taksit kartı ve tahsilatları" | evet | HAREKET (boş kart için §4 S2) |
| H13 | `doubtful_receivables.account_id` (1649-1657), `status <> 'cancelled'` | Şüpheli alacak kaydı (+ karşılık, değersiz) | EVET (`amount_minor > 0`) | evet | HAREKET |
| H14 | `fin_events.party_id` (1708…), `src_table = ''` (banka fişi; modül satırı YOK) ve satırı (`bank_lines`) olan | POS İptal İadesi fişi (pos.mjs:808-816, fatura silinince/iptalinde), KDV'li masraf fişi (vouchers.mjs:333), bunların Ters Kaydı | EVET (bank_lines `try_minor > 0`) — ilke "tutar taşıyan her kayıt" | hayır | HAREKET — İLKEYLE (satırsız, `cancelled` başlık tutar taşımaz → değil) |

`fin_events`'in modül satırı kopyaları (`src_table` = account_entries / plan_entries / cheque_events …) ayrıca sayılmaz: canlıysa modül satırı zaten H1–H12'de;
satırı silinmişse başlık satırsız `cancelled` kalır (tutar yok). `pos_sales` / `pos_items` cari taşımaz (fin_events üzerinden). `bank_plans.party_id` program
içinde hep '' yazılır (vouchers.mjs:891) → yok. `stock_moves.account_id` ile H4 aynı kaydın iki yüzü (sayım H4'ten).

### 2.1 Hareket DEĞİL (ilke: tutar taşımaz ya da cariye bağlı değil)
- `accounts.note`, `fields_json`, telefon, e-posta, adres, grup; `accounts.case_key` (Tablodaki Kayıt bağı) — not / bilgi.
- `message_sends`, `wa_jobs`, `wa_batches` (WhatsApp gönderim izi) — ilke "WhatsApp gönderim izi" açıkça hareket değil.
- `audit_events.entity_id` (değişiklik geçmişi) — ilke açıkça değil.
- `payments` (kayıt tahsilatı; `case_key`'e bağlı, cariye değil — 2.0.18'den beri kayıt ↔ cari ayrı; `accounts.mjs`'te `FROM payments` yok) — İLKEYLE: cariye bağlı değil.
- `einvoice_inbox` "Yeni" (alınmamış) belge — `invoice_id` boş, cari bağı yok; alınınca H9.
- `cash_entries` (Kasa elle hareketi) — cari sütunu yok.

## 3. Tek değişim yeri

**Öneri: yeni saf yardımcı `server/lib/account-movements.mjs`** — `accountMovements(store, accountId, { includeDeleted = false } = {})` →
`{ total, counts: { entries, stock, invoices, plans, cheques, offsets, doubtful, vouchers } }` + `movementText(counts)` (ileti parçası).
deleteBlock bu yardımcıyı çağırır; Taksit aktarımı geri alma (plan-transfer.mjs) ve testler de AYNI yardımcıyı kullanır.

Gerekçe: (1) Tanımı kullanan ÜÇ yer var (tekli Sil, aktarımı geri alma kalıcı silmesi, test/kâhin karşılaştırması); deleteBlock `accounts.mjs` kapanışı içinde
yerel → plan-transfer.mjs ona erişemez, bugün kendi `used` SQL'ini yazmış (plan-transfer.mjs:694-702, faturayı/mahsubu/şüpheliyi BİLMİYOR) — ders 10 "ortak yardımcı
değişince onu kullanan HER yol". (2) deleteBlock'u yerinde genişletmek ikinci tanımı plan-transfer'de bırakır (bugünkü sapmanın kökü). (3) Saf modül
`store` ile test edilir, ayrı dilde kâhinle aynı girdi üzerinde karşılaştırılır.

**SQL taslağı (tek sorgu, hepsi indeksli):**
```sql
SELECT
  (SELECT COUNT(*) FROM account_entries WHERE account_id = ?1 AND source IN ('', 'bank')) AS entries,   -- idx_account_entries_account
  (SELECT COUNT(*) FROM account_entries WHERE account_id = ?1 AND source = 'stock') AS stock,
  (SELECT COUNT(*) FROM account_entries WHERE account_id = ?1) AS allEntries,                         -- yetim satır güvencesi
  (SELECT COUNT(*) FROM invoices WHERE account_id = ?1) AS invoices,                                  -- idx_invoices_account; HER durum
  (SELECT COUNT(*) FROM invoice_offsets WHERE account_id = ?1) AS offsets,                            -- idx_invoice_offsets_account
  (SELECT COUNT(*) FROM plans WHERE account_id = ?1 AND deleted_at IS NULL) AS plans,                 -- idx_plans_account
  (SELECT COUNT(*) FROM cheques WHERE deleted_at IS NULL AND (account_id = ?1 OR endorse_account_id = ?1)) AS cheques,  -- bugünkü sayımla aynı
  (SELECT COUNT(*) FROM doubtful_receivables WHERE account_id = ?1 AND status <> 'cancelled') AS doubtful,
  (SELECT COUNT(*) FROM fin_events e WHERE e.party_id = ?1 AND +e.src_table = ''
     AND EXISTS (SELECT 1 FROM bank_lines l WHERE l.event_id = e.id)) AS vouchers                    -- idx_fin_events_party, idx_bank_lines_event
```
`total = allEntries + invoices + offsets + plans + cheques + doubtful + vouchers` (> 0 → hareketli). Tablo yoksa (göç öncesi test kurgusu) o sayaç 0
(bugünkü `sqlite_master` korumasıyla aynı; tablo listesi bir kez okunur). `includeDeleted: true` (yalnız kalıcı silme yolu, §5 Y2): ek olarak silinmiş kart
(`plans.deleted_at IS NOT NULL`), silinmiş evrak, `status = 'cancelled'` şüpheli ve açık Silinenler öğesi (`trash.restored_at IS NULL` ve
`json_extract(payload_json,'$.accountId')` ya da `'$.invoice.account_id'` = cari) sayılır — JSON taraması yalnız bu nadir yolda.

**deleteBlock yeni hâli (accounts.mjs:684):** (1) `accountMovements` → `total > 0` ise `{ message, extra: { code: "account-has-movements", counts, passive } }`;
(2) `assertUnlocked` savunma olarak SONDA kalır (yeni kuralda erişilemez: `lockedSince` yalnız H1–H12 satırlarına bakar). Eski 6 denetim (plan/stok/çek/fatura/
banka/şüpheli) yardımcıya taşınır; `doubtful().assertNone` deleteBlock'tan çıkar (tür değişikliğinde — accounts.mjs:620 — KALIR).
**Silme ucu (645):** deleteBlock `store.tx` İÇİNDE yeniden değerlendirilir (bugün tx dışında; arada `await` yok ama savunma), `cash.guardRemove` çağrısı
(652) KALKAR — hareketsiz caride `in/out` satırı olamaz, ölü kod; `?cashForce=1` yok sayılır. `guardRemove` cash.mjs'te kalır (plans.mjs:667 kullanıyor).
**restoreDeleted (1811) DEĞİŞMEZ** (kararla: eski silinmiş cariler geri yüklenebilir kalır).

**Hata kodu (BAŞ MİMAR YORUMU Y1):** tek kod `account-has-movements` (+ `extra.counts`). Eski `account-has-invoices` / `account-bank-linked` /
`account-doubtful-open` (silmede) / `period-locked` (silmede) kalkar — kullanıcıya tek kural, istemcide tek dal. Bedeli: 5 test beklentisi (§10.2).
Seçenek (önerilmez): fatura/banka/şüpheli varsa eski kodu koru, kalanlara yeni kod — sıraya bağlı kod, iki kural görünümü.

**İleti önerisi (cümle düzeni; UI/UX ajanı + kullanıcı onayı):**
- Etkin cari: "Bu carinin hareketi var (3 cari hareketi, 1 fatura, 1 taksit kartı); hareketi olan cari silinmez. Kullanmayacaksanız Pasife Al ile pasife alın:
  hareketleri ve bakiyesi korunur, cari listede Pasif altında durur."
- Pasif cari: "Bu carinin hareketi var (…); hareketi olan cari silinmez. Cari pasif: hareketleri ve bakiyesi korunur."
- Parça adları (yalnız sıfırdan büyükler, bu sırayla): "N cari hareketi" (entries + yetim), "N stok hareketi", "N fatura / makbuz (taslak ve iptal dahil)",
  "N mahsup", "N taksit kartı", "N çek / senet", "N şüpheli alacak kaydı", "N banka fişi". Eski iletilerdeki "Önce kartları silin…", "Önce stok hareketlerini
  düzeltin" yönlendirmesi KALKAR (gerçek işlemi sildirip cariyi sildirmek kalite çıtasına aykırı; Logo/Mikro/QuickBooks: hareketli cari pasife alınır).

## 4. İKİ OKUMALI — KULLANICIYA SORULACAK (karar verilmedi; ders 43: para/kayıt kuralı)

- **S1 — Silinenler'deki (silinmiş) kayıt hareket mi?** Silinmiş tahsilat/borç (Silinenler "Cari Hareketi"), silinmiş taksit kartı (`plans.deleted_at`),
  silinmiş çek/senet, silinmiş fatura/taslak (Silinenler "Fatura"), silinmiş şüpheli kaydı (`cancelled`), silinmiş stok hareketi. İlke "tutar taşıyan her kayıt"
  ikisine de izin veriyor.
  **A (öneri):** HAYIR — silinmiş kayıt carinin bakiyesinde/defterinde yok; cari silinince o kayıtların geri yüklemesi "Önce cariyi geri yükleyin" der
  (accounts.mjs:1844, cheques.mjs:958, invoices.mjs:3217), taksit kartı geri yüklenince cariyi de geri getirir (trash.mjs:303) → çıkmaz yok; deleteBlock her kart
  açılışında Silinenler'i (JSON) taramaz (ders 47). **B:** EVET — Silinenler'de kalıcı silme olmadığı için böyle bir cari hiç silinemez; her kart açılışında
  Silinenler taraması. Etkilenen testler: `test/accounts-stock.test.mjs:205`, `test/cari-243.test.mjs:123` (A'da değişmez, B'de 409).
- **S2 — Tutarı sıfır kayıt:** "Taksit kurulmadı" (kalemsiz, toplam 0) taksit kartı; 0,00 TL'lik kalemli taslak fatura (taslakta en az bir kalem zorunlu,
  invoices.mjs:1651; fiyat 0 olabilir). **A (öneri):** hareket SAY — kart/belge carinindir, cari silinirse sahipsiz kalır (bugün de boş kart silmeyi engelliyor).
  **B:** sayma (ilke "tutar taşıyan") — o zaman cari silinince boş kart/taslak ne olacak (birlikte silinsin mi) ayrıca karar ister.
- **S3 — Eski sürümde (v2.0.6–v2.4.8) silinmiş HAREKETLİ cariler:** Kasa ve raporlar onları görmemeye devam eder (geriye dönük Kasa farkı müşteride sürebilir).
  **A (öneri):** dokunulmaz (karar: "Silinenler'den geri yüklenebilir kalır"); geri yüklenen cari bir daha silinemez. **B:** 2.4.9 açılışında tek seferlik bildirim
  ("N silinmiş carinin hareketi Kasa'ya dahil değil; Silinenler'den geri yükleyebilirsiniz") — YENİ ÖZELLİK, kapsam dondu (ders 45) → 2.5.0'a önerilir.

## 5. Cariyi KALDIRAN / GİZLEYEN bütün yollar (tarama: `rg "UPDATE accounts SET[^\"]*deleted|DELETE FROM accounts"`, istemci `method: "DELETE"`, mobil yazma sözleşmesi, uç listesi)

| # | Yol | Bugün | Yeni kural |
|---|---|---|---|
| Y1 | Cari kartı → **Sil** (`DELETE /api/workspace/accounts/:id`, accounts.mjs:645; istemci hof-accounts.js:1384) | yumuşak silme, deleteBlock'un 7 engeli | `accountMovements` → 409 `account-has-movements`; hareketsizse yumuşak silme (Silinenler) |
| Y2 | **Taksit aktarımını Geri Al** (`POST /api/workspace/plans/imports/:id/undo`, plan-transfer.mjs:694-702) — aktarımın AÇTIĞI cariyi **kalıcı** `DELETE FROM accounts` | `used` = account_entries + plans (silinmiş dahil) + cheques (silinmiş dahil); fatura, mahsup, şüpheli, banka fişi, Silinenler'deki hareket/fatura SAYILMAZ → o cariye kesilmiş taslak/iptal fatura YETİM kalır; Silinenler'deki hareketi "carisi artık yok" olur (koddan; zorla üretilmedi — §12) | `accountMovements(…, { includeDeleted: true })` > 0 → cari kalır (`accountsKept`); kalıcı silme geri dönüşsüz olduğu için Silinenler'deki bağ da korunur (Y2 BAŞ MİMAR YORUMU §11) |
| Y3 | Şirket Verisini Sıfırla → **Tümünü Sıfırla** (`POST /api/companies/:id/reset` mode all, app.mjs:883 CARD_TABLES) | bütün kartlar silinir (zorunlu yedek + kod onayı + parola) | **BİLEREK HARİÇ** (karar metni). "Tüm Hareketleri Sil" cari kartlarını korur, hareketleri siler → cariler hareketsiz kalır, sonra Y1 ile silinebilir (doğal) |
| Y4 | Yedekten Geri Yükle / şirket ayırma (company-separate.mjs) | bütün veri değişir / hiçbir kayıt silinmez | kapsam dışı. Ayırma uyarı metni (client/assets/admin.js:1482) "her şirkette ona ait olmayan kayıtları silin" diyor → hareketli cari için Pasife Al gerekir (komşu metin, §8) |
| — | Toplu cari silme | YOK (cari listesinde toplu işlem yalnız Toplu Taksit ve WhatsApp) | — |
| — | Cari birleştirme | YOK | — |
| — | Excel / Sheets'ten cari yükleme, yeniden yükleme, Google Sheets alımı (accounts.mjs:1208-1432) | yalnız ekler/günceller, cari kaldırmaz | — (eşleşme `deleted_at IS NULL`; pasif cari eşleşir — §8) |
| — | Tablo (kayıt) Yerine Koy / KAYIT BAĞI (dataset-bonds.mjs:460) | yalnız `case_key` bağını taşır, cari kaldırmaz | — |
| — | Mobil yazma (mobile-write.mjs ROUTES: tahsilat, ödeme, taksit, stok, avans) | cari silme yolu YOK | — (yarış düzeltmesi mobili de kapsar, §9) |
| — | tRPC / başka API | cari silen uç yok (accounts.mjs’teki 10 yazma ucunun yalnız biri — Y1 — cari kaldırır) | — |
| G1 | **Pasife Al** (`PUT …/accounts/:id { status: "passive" }`) | gizler (Pasif sekmesi), hareket korunur | ÖNERİLEN yol; değişmez |
| R1 | Silinenler → Cari **Geri Yükle** (trash.mjs:314 → accounts.mjs:1811) | kilitli dönem dışında geri getirir, numara çakışırsa yeni numara | değişmez (karar) |
| R2 | Silinenler → Taksit kartı Geri Yükle (trash.mjs:303) | kartın silinmiş carisini de geri getirir | değişmez; gözlem: numara çakışması denetimi YOK (R1'deki `freeRef` yok) — DOĞRULANMADI, kapsam dışı DÜŞÜK |

Kaldıran yol sayısı: **2 kural uygulanacak (Y1, Y2) + 1 bilerek hariç (Y3)** (+ Y4 kapsam dışı); geri getiren 2 (R1, R2) değişmez.

## 6. Arayüz

- **Detail zaten taşıyor:** `deleteBlock: manage ? deleteBlock(account)?.message || "" : ""` (accounts.mjs:181) → istemci Sil'i pasif yapar, nedeni `data-delete-block`
  kutusunda "Silinemez:" ile yazar (hof-accounts.js:372-374). Değişen yalnız ileti metni (§3) — kod değişikliği istemcide küçük.
- **"Pasife Al" var:** aynı araç çubuğunda Sil'in solunda (`data-act="passive"`, hof-accounts.js:372; pasifte "Aktif Yap"). Öneri metinde ("Pasife Al ile pasife
  alın"); ayrı yeni düğme EKLENMEZ (çift düğme). Pasif caride ileti "Cari pasif: …" (öneri gereksiz).
- **Yarış dalı:** kart hareketsizken açıldı, bu arada başka kullanıcı/mobil hareket girdi → Sil → sunucu 409 `account-has-movements` → `deleteAccount` catch
  (hof-accounts.js:1399) kod listesine `account-has-movements` eklenir: "Cari Silinemez" penceresi + "Pasife Al" (pasifse yalnız ileti) + kart yenilenir.
- **Onay metni (1387) hareketsiz cari için:** "“…” silinecek (hareketi yok). Yönetim → Silinenler’den geri yüklenebilir." (`HOF.trashHint()`); "Hareketleri
  Kasa’dan düşer" KALKAR.
- **Yazım düzeni:** iletiler cümle düzeninde; düğme adları "Pasife Al", "Aktif Yap", pencere başlığı "Cari Silinemez" (mevcut) her sözcük büyük. `test/yazim-duzeni.test.mjs`
  ve `test/e2e/senaryo-211.mjs` yeni ad eklenmediği için etkilenmemeli; yine de adayda koşulur.
- **Kılavuz (öneri, hap bilgi):** Cari bölümüne tek satır "Hareketi olan cari silinmez; kullanmayacağınız cariyi Pasife Al ile pasife alın (hareketleri ve bakiyesi
  korunur)." → PDF aynı adayda yeniden üretilir + pdf-denetle (ders 42; K-1 zaten üretiyor).

## 7. Komşular (ders 9–10)

- **Silinenler geri yükleme (R1/R2):** değişmez; YENİ durum: geri yüklenen hareketli cari bir daha silinemez (409) — test edilir. Silinenler notu
  ("Hareketleriyle … Kasa yeniden hesaplanır") eski veride doğru kalır.
- **Kasa eksi bakiye (`cash.guardRemove`):** cari silmede gereksiz (§3) → çağrı kalkar; `test/inceleme-226.test.mjs:473-485` ve `asama0-226` A3'ün "cash-negative"
  beklentisi değişir. Geri yüklemede (R1) eksi Kasa sorusu bugün de YOK (eski silinmiş carinin ödemeleri dönünce Kasa düşebilir) — değişmez, BİLİNEN SINIR adayı.
- **Kilitli dönem:** silmede `period-locked` yerine `account-has-movements` (hareketli caride kilidi açmak da silmeye yetmez — eski "Gerekirse yönetici dönem kilidini
  açmalı" yönlendirmesi yanlış olurdu). Tür değişikliği ve geri yüklemedeki kilit (assertUnlocked) değişmez.
- **Mutabakat kapısı (integrity-scope.mjs:293, 362):** cari silme görünür carileri yeniden hesaplatır; hareketsiz caride defter değişmez → kapı etkisiz. Doğrudan SQL ile
  silmeyi yakalayan kilit izi (party_lock) değişmez.
- **Raporlar / mobil özet / WhatsApp:** hepsi `deleted_at IS NULL` ile okur — değişmez. Sonuç: bundan sonra cariler silinmek yerine pasife alınır → WhatsApp eleme
  nedeni "silindi" yerine "pasif" olur (kâhin §7a 2 ikisini de eler); Excel/e-Fatura eşleşmesi pasif cariyi bulur (`matchPerson`, `findByTaxNo` yalnız silinmişi
  dışlar) — "kişi bir kez girilir"e uygun.
- **Nihai Tüketici (taxIdentity.retailAccount):** hareketsiz işaretli cari silinirse yenisi açılır (N6, `test/nihai-tuketici-u1-244.test.mjs:108`) — değişmez; faturası olan
  işaretli cari zaten silinmez.
- **Fatura / çek / evrak geri yüklemesi silinmiş caride:** reddediyor ("Önce cariyi geri yükleyin") — değişmez (S1-A'nın dayanağı).
- **Şirket ayırma metni (admin.js:1482):** hareketli cari silinmeyeceği için metne "(hareketi olan cari silinmez; pasife alın)" eki önerilir — DÜŞÜK, yalnız 2.0.17–2.0.19'u
  yaşamış kurulumlar.
- **Yeni yardımcı her kart açılışında (detail) bir sorgu:** ders 47 — 2.000 cari / 100.000 satırda kart açılışı ve olay döngüsü önce/sonra ölçülür (bütçe: kart açılışına
  ≤ 5 ms ek). `cheques.endorse_account_id` indeksiz (bugünkü sayımda da) — ölçümde bakılır. WhatsApp gönderim anı tam kartı okur (yönetici işçisi) → iş başına bir sorgu.

## 8. Nasıl bozulur? (testler buradan çıkar)

1. **Sıra:** hareket önce → cari sil (409); cari sil önce → hareket (silinmiş cariye 404); kart açık → başka oturum hareket girer → Sil (409 + Pasife Al); hareketsiz
   cari sil → Silinenler'den geri yükle → hareket gir → yeniden sil (409).
2. **Yarış — YENİ BULGU (zorla üretildi, §9):** tahsilat isteğinin gövdesi yoldayken cari silinirse tahsilat SİLİNMİŞ cariye yazılıyor, yanıt 404. C1'in değişmezini
   ("silinmiş carinin 2.4.9'dan sonra hareketi olmaz") bozar.
3. **Her hareket türü tek başına** (§2 H1–H14) + **yetim satır** (doğrudan SQL ile kaynağı olmayan `account_entries` satırı): her biri yalnız başına 409.
4. **Kategori sızıntısı:** ürünü silinmiş stok satırı (H4), iptal edilmiş/taslak fatura (H9), ciro alan cari (H11 endorse), POS İptal İadesi fişi (fatura silinince, H14),
   hesabı atanmamış havale (H1 `fin_ref = ''`), Kredi Kartına İade (H8), Excel'den taksit devri (plan_entries opening).
5. **Eski sürüm verisi:** v2.4.8'in GERÇEK koduyla (git archive) silinmiş hareketli cari üret → 2.4.9 ile aç: Silinenler'de görünür, geri yüklenir, Kasa geri gelir,
   sonra silinemez (zincirleme göç: v2.0.26 verisi `test/banka-210-altin.test.mjs` zaten silinmiş hareketli cari taşıyor).
6. **Aynı adlı iki cari:** biri hareketli biri hareketsiz → yalnız hareketsiz silinir, yanlış kimlik silinmez; aynı adla yeniden açılan cari (banka-210-sira S2) bozulmaz.
7. **Toplu yol:** aktarım (Y2) N cari açar; bir kısmına fatura/taslak/Silinenler'e giden tahsilat girilir → Geri Al: yalnız gerçekten boş olanlar kalkar, rapor
   `accounts` / `accountsKept` sayıları doğru.
8. **Yarıda kesilme:** silme tek UPDATE (tx); Y2 tek `bank.post` işlemi — kesintide ya hep ya hiç (kesinti denemesi Y2'de).
9. **Kilitli dönem:** hareketli cari kilitliyken 409 movements (period-locked değil); hareketsiz cari kilitliyken silinir; eski silinmiş carinin kilitli satırı varsa geri yükleme
   409 period-locked (değişmez).
10. **İki şirket:** 002'de hareketli cari 409, 001'deki aynı adlı hareketsiz cari silinir (şirket parametresiyle).
11. **Yetki:** `accounts.manage` olmayan 403 (değişmez), kartta deleteBlock boş (bilgi sızmaz).
12. **Tutarsız durum:** pasif + hareketli (ileti pasif varyantı); hareketsiz ama notu/WhatsApp izi/değişiklik geçmişi olan cari (200 — ilke).

## 9. YENİ BULGU — silinmiş cariye tahsilat yarışı (ORTA önerisi; zorla üretildi)

- Yer: `server/routes/accounts.mjs:984-985` — `accountRow(params.id)` (silinmemiş mi) → `await readJson(req)` (gövde beklenir) → … `bank.post` `write` → `addEntry`
  (cari YENİDEN denetlenmez) → yanıtta `detail()` → `accountRow` 404. v2.0.6'dan beri aynı desen (`git show v2.0.6:server/routes/accounts.mjs` 410-413).
  PUT cari (604-605) aynı desende (silinmiş satıra bilgi yazımı; zararı küçük).
- Betik: `…/scratchpad/c1-tasarim-35e90e47/yaris.mjs` — hareketsiz cari; ham `http.request` başlıkları gönderir, gövdeyi tutar; 400 ms sonra `DELETE` (200 — ön koşul
  GERÇEKTEN oluştu, ders 20), sonra gövde. Çıktı (çıkış 0):
  `cari silindi (gövde beklerken) 200` · `tahsilat yanıtı 404 "Cari bulunamadı. Silinmiş olabilir."` ·
  `veri tabanı: [{kind:"in", amount:500, method:"cash", cariSilinmis:1}]` · `Kasa 0 → 0`.
  Yani reddedilmiş görünen istek 500 TL nakit tahsilatı YAZDI, cari silinmiş olduğu için Kasa'da görünmüyor — müşteri bulgusunun belirtisinin aynısı, başka yoldan.
- En küçük düzeltme önerisi: `write` içinde (tx) cari canlılığı yeniden denetlenir (`accountRow(account.id)` → 404, `bank.post` geri alır). Tek yerde savunma için
  `addEntry` başında `exists(accountId)` (bütün `addEntry` yazıcıları: tahsilat, Borç/Alacak, açılış, stok, fatura, şüpheli, POS iadesi); doğrudan INSERT yapanlar
  (cheques.mjs:266, pos.mjs:509, plan-transfer.mjs:661) kod ajanınca tek tek denetlenir ("doğrulama ile yazım arasında await yok"). Kapsam: KARAR REVİZYONU'na göre ORTA
  bu sürümde düzeltilir; C1'in değişmezine dokunduğu için C1 ajanına verilmesi önerilir — **ana oturum kararı**.

## 10. Test matrisi

### 10.1 Yeni / genişleyen testler (kırmızı kanıt: `git archive 35e90e47 | tar -x -C <not defteri>/c1-eski-35e90e47`, ders 23, 25; neden iletide okunur, ders 38)
| Test (öneri ad) | İçerik | Eski kodda (35e90e47) |
|---|---|---|
| `test/cari-hareket-249.test.mjs` T1 | H1 nakit tahsilat, nakit ödeme, havale (hesabı atanmamış), H2 Borç/Alacak, H3 açılış (Yeni Cari + Excel cari yükleme), H4 ürünü silinmiş stok satırı, H9 taslak + iptal + e-SMM, H14 POS İptal İadesi fişi, yetim satır: kart deleteBlock dolu + DELETE 409 `account-has-movements` + `deleted_at` NULL + Kasa aynı | **KIRMIZI** — "beklenen 409, gelen 200" (§1.2 tablosu) |
| aynı, T2 (koruma) | H5/H9 kayıtlı fatura, H8 banka bağlı, H10 mahsup, H11 çek (alınan, ciro alan), H12 taksit kartı (açık/kapalı), H13 şüpheli: 409 + cari duruyor | yeşil (zaten engelliyordu); kod denetimi ayrı satırda → eski kodda "kod farkı" kırmızısı KANIT SAYILMAZ (ders 38) |
| aynı, T3 | hareketsiz cari; notu, telefonu, WhatsApp izi (`message_sends`), değişiklik geçmişi olan hareketsiz cari → 200, Silinenler'de; onay metninde Kasa sorusu yok | yeşil (koruma) |
| aynı, T4 | eski silinmiş hareketli cari (doğrudan SQL `deleted_at` — eski sürüm verisi benzetimi; ayrıca §8/5 gerçek v2.4.8 verisiyle) → Geri Yükle 200, Kasa geri → yeniden sil 409 | **KIRMIZI** — yeniden silme 200 |
| aynı, T5 | aynı adlı iki cari; pasif + hareketli (ileti pasif varyantı); kilitli dönemde hareketli → `account-has-movements`; 002 şirketi | kısmen kırmızı (kilitli caride kod `period-locked` — kanıt değil; açık dönem hareketli caride 200 → KIRMIZI) |
| aynı, T6 | deleteBlock metni = DELETE iletisi (A5 deseni), yetkisiz kullanıcıya boş | yeşil (koruma) |
| `test/cari-hareket-249.test.mjs` T7 (Y2) | aktarım → aktarımın açtığı cariye taslak fatura / Silinenler'e giden tahsilat → Geri Al → cari KALIR (`accountsKept`), fatura yetim değil | **KIRMIZI beklenir** — cari kalıcı silinir (koddan; ilk kırmızı koşuda doğrulanır) |
| `test/cari-hareket-yaris-249.mjs` (ya da T8) | §9 yarışı zorla: DELETE 200 SONRA gövde → tahsilat 404 VE `account_entries`'te satır YOK | **KIRMIZI** — satır yazılıyor (§9 çıktısı) |
| mutasyon | yardımcıdan her sayaç tek tek çıkarılır → T1/T2'nin ilgili satırı kırmızı; `includeDeleted` kapatılır → T7 kırmızı | — |
| `test/e2e/senaryo-cari-243.mjs` (genişlet; ci.yml'de var) | yalnız nakit tahsilatlı caride Sil pasif + "Silinemez: … Pasife Al" + Pasife Al → Pasif rozeti; hareketsiz caride Sil açık → yeni onay metni → silindi; kart açıkken API'den tahsilat → Sil → "Cari Silinemez" penceresi | kırmızı (Sil açık) |
| kâhin | `test/bagimsiz/cari/model.py` `cari_sil` kuralsız (her zaman "ok") → kâhin ajanı (kodu görmeyen, karar metninden) kuralı + 3 senaryo ekler (hareketli ret, hareketsiz ok, geri yüklenen hareketli ret); `kahin-cari` CI'de | — |
| ölçüm (ders 47) | 2.000 cari / 100.000 satırda kart açılışı + olay döngüsü önce/sonra (aynı veri kopyası, ders 15); Y2 2.000 carilik aktarımın Geri Al'ı | — |

### 10.2 Bugünkü "silinir" davranışını bekleyen testler — BEKLENTİ DEĞİŞİKLİĞİ (ders 28: değiştiren koşar)
| Dosya:satır | Bugün | Neden değişir / öneri |
|---|---|---|
| `test/asama0-226.test.mjs:259` | Alacak Yaz'lı cariyi sil (kurulum) 200 | 409 → kurulum "eski silinmiş cari"yi doğrudan SQL ile kurar (geri yükleme kilidi testi korunur) |
| `test/asama0-226.test.mjs:271, 284` | 409 `period-locked` | 409 `account-has-movements` |
| `test/asama0-226.test.mjs:298` | açık dönem Borç Yaz'lı cari sil 200 | 409 → test "hareketsiz cari kilitliyken silinir"e dönüşür |
| `test/asama0-226.test.mjs:305-307` | 409 `cash-negative`, onaylı 200, Kasa −800 | 409 `account-has-movements` (cashForce'la da); Kasa değişmez |
| `test/asama0-226.test.mjs:314` | kilit açıkken sil + geri yükle | silme 409 → eski silinmiş (SQL) cari geri yükle; sayılar aynı |
| `test/accounts-stock.test.mjs:644` | "ürün silinince cari de silinebilir" 200 | 409 (H4 İLKEYLE) — iddia TERSİNE döner |
| `test/accounts-stock.test.mjs:205` | tahsilatı Silinenler'e giden cari silinir | S1-A: değişmez; S1-B: 409 |
| `test/cari-243.test.mjs:117, 128, 131` | iletide "1 taksit kartı var", "faturası olan cari silinemez", kod `account-has-invoices` | yeni ileti/kod; 123 (kart silindikten sonra cari silinir) S1-A'da değişmez |
| `test/cari-vade-245.test.mjs:371` | vadeli Borç Yaz'lı cari silinir | 409 → eski silinmiş (SQL) cariyle "kalem yok / geri yüklenince döner" |
| `test/projeksiyon-vade-246.test.mjs:376` | aynı | aynı |
| `test/inceleme-226.test.mjs:483-484` | cari silmede "Bu cari silinince … Nakit Kasa'dan 500,00 TL düşer" | 409 `account-has-movements`; Kasa sorusu yok (soru metni testi kayıt tahsilatı kısmında kalır) |
| `test/banka-210-tek-kaynak.test.mjs:236` | tahsilatlı cari `?cashForce=1` silinir | 409 → eski silinmiş (SQL) cariyle "Kasa/özet/Ana Defter birlikte düşer" |
| `test/banka-210-asama5-cari.test.mjs:227` | 409 `account-bank-linked` | 409 `account-has-movements` (Pasife Al 200 kalır) |
| `test/banka-230-supheli-bozma.test.mjs:208, 213` | 409 `account-doubtful-open` | 409 `account-has-movements` (tür değişikliğindeki `account-doubtful-open` — `test/supheli-230-yargic.test.mjs:120` — DEĞİŞMEZ) |
| `test/e2e/senaryo-cari-243.mjs:240` | neden metninde `/taksit kartı var/` | yeni metin ("1 taksit kartı") |
| `test/bagimsiz/whatsapp-248` KISI-10 (senaryolar.py:356, surucu.mjs:1263; CI dışı) | borçlu B carisi kuyruktayken silinir | 409 → senaryo kurulamaz; kâhin ajanı karar metninden düzenler (B hareketsiz ya da eski veri) |

### 10.3 Cari silen ama DEĞİŞMEYECEK testler (hareketsiz cari ya da eski kod; yine de adayda koşulur)
`test/accounts-stock.test.mjs:152, 578, 642`, `test/cheques-overview.test.mjs:260`, `test/nihai-tuketici-u1-244.test.mjs:114`, `test/whatsapp-onizleme-olcek-248.test.mjs:81`,
`test/banka-210-sira.test.mjs:110`, `test/banka-210-altin.test.mjs:523` (v2.0.26'nın KENDİ koduyla — eski veri kaynağı), `test/e2e/senaryo-222.mjs:392`,
`test/e2e/banka-210-daha-fazla-yaris.mjs:262` (330 hareketsiz cari), `test/bagimsiz/cari` b5-u1 s1 (hareketsiz A2), `test/bagimsiz/mobil-yazma` (kâhin zaten "yalnız hareketsiz"),
`test/excel-denetim/yedek.mjs:147`, `saldiri.mjs:214`, `test/qa/qa-fatura.mjs` N6 (409'u da kabul eder). Mutabakat motorundaki "cari-sil" (test/mutabakat/motor.mjs:1183)
cari HAREKETİ silmedir — etkilenmez.

### 10.4 Koşulacak e2e (ders 9, 37)
Dokunulan ekran: cari kartı → `senaryo-cari-243`, `senaryo-222`, `banka-210-daha-fazla`, `senaryo-211` (yazım), `senaryo-form-izolasyon-243` (escClose / onay penceresi);
adayda ci.yml'nin BÜTÜN e2e listesi (ders 37). Tam `npm test` bu adayda bir kez (ders 41 — yeni çekirdek yardımcı + para yazım yoluna denetim).

## 11. Riskler, açık sorular, BAŞ MİMAR YORUMLARI (ders 40 — kullanıcıya gösterilir)

- **Y1 (BAŞ MİMAR YORUMU):** tek hata kodu `account-has-movements` (§3) — gerekçe: tek kural, istemcide tek dal; bedeli 5 test beklentisi.
- **Y2 (BAŞ MİMAR YORUMU):** aktarımı Geri Al'ın KALICI silmesi, S1'in yanıtından bağımsız olarak Silinenler'deki bağları da sayar (geri dönüşsüz silme; yetim
  fatura/hareket olmasın). Yaygın uygulama: kalıcı silmede bağlı her iz korunur.
- **Y3 (BAŞ MİMAR YORUMU):** H4 (ürünü silinmiş stok satırı) ve H14 (cari taraflı banka fişi) İLKEYLE hareket; `cancelled` satırsız banka başlığı değil.
- **Y4 (BAŞ MİMAR YORUMU):** `cash.guardRemove` çağrısı ve deleteBlock'taki şüpheli/kilit denetimleri yeni tanımın içinde kaldığı için silinir/savunmaya iner.
- **Açık:** S1, S2, S3 (§4) kullanıcı yanıtı bekler; S1 yanıtına göre T1/T7 ve iki beklenti satırı netleşir. §9 yarış düzeltmesinin C1'e girmesi ana oturum kararı.
- **Risk:** eski veride (v2.0.6–v2.4.8) silinmiş hareketli cariler kalır (S3) — müşteri Kasa'sı bu cariler geri yüklenene kadar eksik görünür; teslim notunda BİLİNEN SINIR.
- **Risk:** bugün "sil-yeniden aç" ile düzelten kullanıcı alışkanlığı kırılır → yanlış açılmış ama hareket girilmiş cari için yol: hareketleri sil ya da başka cariye
  taşı (taksit kartı/çek taşıma var) → sonra sil; ya da Pasife Al. Kılavuz satırı (§6) bunu kısaca söyler.
- **Risk (ders 47):** deleteBlock her kart açılışında + WhatsApp gönderim anında; ölçülmeden "hızlı" denmez.

## 12. DENENEN / DENENMEYEN / DOĞRULANMADI (bu not)

- **DENENEN:** `test/asama0-226.test.mjs` A3 yerelde (9/9, çıkış 0); §1.2 betiği (11 durum, çıkış 0); §9 yarış betiği (ön koşul oluştu, çıkış 0). Hepsi 35e90e47, Linux,
  Node 22.22.0, `HUKUK_LICENSE_URL=http://127.0.0.1:9`; ham çıktılar not defterinde (`…/scratchpad/c1-tasarim-35e90e47/` — depoya alınmadı; kod ajanı kanıtı
  `tools/kanit.mjs kos` ile `docs/kanit/<gün>/` altına yeniden alır).
- **DENENMEYEN:** H10 mahsup, H11 ciro alan cari, H13 şüpheli, H14 POS İptal İadesi / KDV'li masraf fişi, e-SMM, iki şirket, Windows — yalnız koddan; T1/T2'de denenir.
- **DOĞRULANMADI (koddan, zorla üretilmedi):** Y2'de yetim fatura / "carisi artık yok" (plan-transfer.mjs:694-702 `used` sorgusu faturayı bilmiyor); R2'de numara çakışması
  (trash.mjs:303 `freeRef` yok); diğer yazıcılarda (fatura, kart, çek, stok) §9 türü yarış olmadığı (kaba tarama yalnız `accountRow → await readJson` desenini iki uçta buldu).

## 13. KULLANICI KARARLARI + ANA OTURUM ONAYI (03.11.2026 ~18:50 UTC) — kodlama bu bölümle birlikte okunur
- KULLANICI (AskUserQuestion, 03.11): **S1 → A** (Silinenler'deki kayıt hareket SAYILMAZ; Y2 kalıcı silmede §11 Y2 gereği yine sayılır), **S2 → A** (tutarı sıfır kart/taslak
  HAREKET sayılır), **S3 → A** (eski sürümde silinmiş hareketli carilere dokunulmaz; bildirim fikri iş listesi C / 2.5.0; teslim notunda BİLİNEN SINIR).
- ONAY: §2 tanım H1–H14, §3 tek değişim yeri (server/lib/account-movements.mjs, tek SQL), §5 yollar (Y1, Y2 kurala; Y3 bilerek hariç), §6 arayüz, §10 test matrisi,
  §8 bozulma listesi. BAŞ MİMAR YORUMLARI Y1–Y4 kabul (kullanıcıya teslim notunda gösterilir).
- BAŞ MİMAR KARARI — §9 yarış (silinmiş cariye tahsilat) C1'E GİRER: ORTA (KARAR REVİZYONU: bu sürümde), müşteri bulgusunun aynı belirtisi (Kasa'dan kaybolan nakit),
  C1'in değişmezi ("silinmiş caride para hareketi olmaz"). Düzeltme yazım anında (tx içinde) cari canlılığının yeniden denetlenmesi; doğrudan INSERT yapan yollar tek tek
  denetlenir (doğrulama ile yazım arasında await yok). PUT cari aynı desen: yalnız denetlenir, zararı küçükse rapora.
- Cari kâhini (`cari_sil` kuralı) KODU GÖRMEYEN ayrı ajanla karar metninden güncellenir (ders 5, 40) — kod ajanı kâhine dokunmaz.
- Kod ajanı xhigh (para/defter). Ölçüm ders 47 (2.000 cari / 100.000 satır, kart açılışı + olay döngüsü, önce/sonra aynı veri).
