// 2.5.0 Ç5-A tur 3a (tasarım notu docs/erp/C5-ACILIS-TASARIM.md §18.9; BAŞ MİMAR KARARI 13.11 — §18.3 (a)): Tek Yükümlülük Kuyruğu'nun (lib/obligation-queue.mjs buildObligations)
// ve fatura kapamasının (lib/invoice-settle.mjs) GİRDİ KURUCUSU — yalnız store ile kurulur (servis ağacı yok; saat yok — gün parametreyle). Gövdeler routes/invoices.mjs
// registerInvoiceRoutes kapanışından AYNEN taşındı (girinti aynı; kapanış değişkeni yalnız store). Fatura servisi BİR örnek kurar (kilit izi belleği örnekte — ömrü aynı);
// defter yükleyicileri ve işçiler (tur 3b) kendi örneğini kurar: createObligationInput({ store }). Carinin satırları çağırandan gelir (§18.9 (4)) ya da — tur 3b (§18.11) — modül kendisi kurar
// (ledgerLines / accountInput / batchInputs; lib/account-lines.mjs).
import { parseJson } from "./http.mjs";
import { INVOICE_KINDS } from "./invoice-math.mjs";
import { lockAtOf, lockHistory } from "./obligation-queue.mjs";
import { doubtfulState } from "./bank/doubtful.mjs";
import { dayText } from "./plans.mjs";
import { createAccountLines } from "./account-lines.mjs";

export function createObligationInput({ store }) {
  // v2.0.17: mahsup fişinin karşı belgesinin adı ("Mahsup · ALS2026…" / "Mahsup · Alacak Yaz 15.09.2026").
  function offsetLabel(offset) {
    if (offset.counterType === "invoice") {
      const counter = store.get("SELECT number, kind FROM invoices WHERE id = ?", offset.counterId);
      return counter ? `Mahsup · ${INVOICE_KINDS[counter.kind]?.short || "Fatura"} ${counter.number}` : "Mahsup · fatura";
    }
    const entry = store.get("SELECT kind, date, note FROM account_entries WHERE id = ?", offset.counterId);
    return entry ? `Mahsup · ${entry.kind === "credit" ? "Alacak Yaz" : "Borç Yaz"} ${dayText(entry.date)}${entry.note ? ` (${entry.note})` : ""}` : "Mahsup · cari satırı";
  }
  // Çek/senet olaylarının kapama girdisi (iki yol da bu tek kuralla): satırın olay türü (chequeEvents), faturaya bağı (links) ve karşılıksızın ters
  // çevirdiği satır (reversals). events: { chequeId, kind, invoiceId, own (cheques.invoice_id), effects } — olay sırasında (rowid). planned: taksitli faturalar.
  //   - Faturanın kendi evrakı (fatura kesilirken alınan/verilen; cheques.invoice_id = olay bağı) ve faturayla ciro: bağ her zaman (v2.0.15).
  //   - 2.4.4 UX18: "Kapatılacak Fatura" ile alınan/verilen evrak (yalnız olay bağı): cari kartından kurulan bağ gibi taksitli faturada yok sayılır
  //     (taksitli fatura kendi kartıyla kapanır; v2.0.23 Bulgu 2 — eski/bozuk veride de).
  //   - Karşılıksız (bounce) satırı, alış/ciro satırını ters çevirir: alındığı caride borç satırı alış satırını, ciro edilen caride alacak satırı
  //     ciroyu. Kapama bu çifti birlikte çıkarır → evrakın kapattığı fatura (bağlıysa bağlı fatura, bağsızsa en eski açık fatura) kendi tarihiyle
  //     yeniden açılır, kalan ödemeler en eski açık faturadan yeniden dağılır (lib/invoice-settle.mjs; taksitli faturanın evrakında değil).
  //     2.4.4: önce yalnız bağlı evrakta (31a F2); bağsız evrak da (31a F3, kullanıcı kararı 22.10.2026 "en yaygın uygulama").
  function chequeLinks(events, planned, links, chequeEvents, reversals) {
    const byCheque = new Map();
    for (const event of events) {
      if (!byCheque.has(event.chequeId)) byCheque.set(event.chequeId, []);
      byCheque.get(event.chequeId).push(event);
    }
    for (const list of byCheque.values()) {
      const linked = new Map();
      for (const event of list) {
        // İptal edilen faturanın evrakında olay etkileri geri alınmıştır ve alan nesne olarak işaretlenir ({ reverted }).
        const effects = parseJson(event.effects, []);
        const lines = (Array.isArray(effects) ? effects : []).filter(effect => effect?.table === "account_entries" && effect.id);
        const own = event.kind === "endorse" || (Boolean(event.own) && event.own === event.invoiceId);
        const link = event.invoiceId && (own || !planned.has(event.invoiceId)) ? event.invoiceId : "";
        for (const effect of lines) {
          chequeEvents.set(effect.id, event.kind);
          if (event.kind === "bounce") {
            const from = linked.get(effect.accountId || "");
            if (from) reversals.set(effect.id, from);
            continue;
          }
          if (link) links.set(effect.id, link);
          if (["receive", "issue", "endorse"].includes(event.kind)) linked.set(effect.accountId || "", effect.id);
        }
      }
    }
  }
  const groupBy = (rows, field) => {
    const map = new Map();
    for (const row of rows) {
      const id = row[field];
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(row);
    }
    return map;
  };
  // Toplu yolun kapama girdileri (bütün cariler; birkaç toplu sorgu). allPaymentStates ve allEntryStates (2.4.5 madde 6) aynı tablolardan okur.
  function settleTables() {
    // issuedAt (v2.0.23): borcun doğduğu an (Mevcut Borç kartının kapsamı, lib/invoice-settle.mjs).
    const invoicesOf = groupBy(store.all("SELECT id, account_id AS accountId, kind, status, try_payable AS payable, original_id AS originalId, due_date AS dueDate, plan_id AS planId, COALESCE(NULLIF(issued_at, ''), created_at) AS issuedAt FROM invoices"), "accountId");
    const baseLinks = new Map();
    for (const entry of store.all("SELECT id, account_id AS accountId, source_id AS invoiceId FROM account_entries WHERE source = 'invoice' AND kind IN ('in', 'out')")) {
      if (!baseLinks.has(entry.accountId)) baseLinks.set(entry.accountId, new Map());
      baseLinks.get(entry.accountId).set(entry.id, entry.invoiceId);
    }
    // v2.0.23: taksitli faturaya cari kartından kurulmuş bağ (eski veri) yok sayılır: taksitli fatura kendi kartıyla kapanır.
    const planned = new Set(store.all("SELECT id FROM invoices WHERE plan_id <> ''").map(row => row.id));
    // 2.2.0: POS komisyon kesintisi/iadesi (source 'bank') yalnız bağlandığı komisyon faturasını kapatır (pos-fee, lib/invoice-settle.mjs).
    for (const entry of store.all("SELECT id, account_id AS accountId, invoice_id AS invoiceId FROM account_entries WHERE source IN ('', 'bank') AND invoice_id <> ''")) {
      if (planned.has(entry.invoiceId)) continue;
      if (!baseLinks.has(entry.accountId)) baseLinks.set(entry.accountId, new Map());
      baseLinks.get(entry.accountId).set(entry.id, entry.invoiceId);
    }
    // Çek olayı, cari başına yolda olduğu gibi evrakın carisine, ciro edilen cariye ve olayın carisine sayılır.
    const eventsOf = new Map();
    for (const event of store.all("SELECT ev.cheque_id AS chequeId, ev.kind, ev.invoice_id AS invoiceId, ev.effects_json AS effects, c.invoice_id AS own, c.account_id AS a1, c.endorse_account_id AS a2, ev.account_id AS a3 FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id ORDER BY ev.rowid")) {
      for (const accountId of new Set([event.a1, event.a2, event.a3].filter(Boolean))) {
        if (!eventsOf.has(accountId)) eventsOf.set(accountId, []);
        eventsOf.get(accountId).push(event);
      }
    }
    const offsetsOf = groupBy(store.all("SELECT id, account_id AS accountId, invoice_id AS invoiceId, counter_type AS counterType, counter_id AS counterId, amount, date, note, created_at AS createdAt FROM invoice_offsets ORDER BY date, created_at"), "accountId");
    const planTotals = new Map(store.all("SELECT id, total FROM plans WHERE deleted_at IS NULL").map(row => [row.id, Number(row.total) || 0]));
    const scheduleOf = groupBy(store.all("SELECT plan_id AS planId, due_date AS dueDate, amount FROM plan_items ORDER BY due_date"), "planId");
    return { invoicesOf, baseLinks, planned, eventsOf, offsetsOf, planTotals, scheduleOf };
  }
  function batchSettleInput(accountId, lines, tables, day) {
    const links = new Map(tables.baseLinks.get(accountId) || []);
    const chequeEvents = new Map();
    const reversals = new Map();
    chequeLinks(tables.eventsOf.get(accountId) || [], tables.planned, links, chequeEvents, reversals);
    const offsets = (tables.offsetsOf.get(accountId) || []).map(({ accountId: _, ...offset }) => ({ ...offset, label: offsetLabel(offset) }));
    const invoices = (tables.invoicesOf.get(accountId) || []).map(({ accountId: _, ...item }) => (item.planId ? { ...item, planTotal: tables.planTotals.get(item.planId) || 0, schedule: (tables.scheduleOf.get(item.planId) || []).map(({ planId: __, ...row }) => row) } : item));
    return { lines, invoices, links, chequeEvents, reversals, offsets, today: day };
  }
  // Veri tabanı işleminin içinde (yazmalar henüz kesinleşmemiş, geri alınabilir) önbellek ne okunur ne yazılır: geri
  // alınan işlemin durumu saklanıp sonra gösterilmesin (total_changes() geri alınca azalmaz).
  const settleKey = day => `${store.get("SELECT total_changes() AS n").n}|${store.get("PRAGMA data_version").data_version}|${day}`;
  // Kapamanın girdisine TYK'nın ekleri: bütün kartların taksit takvimi (S50, M1e), elle satırın Vade Tarihi (S1: yoksa belge günü) ve Beklenen Ödeme Tarihi (S52 / S67 /
  // S69 takvim kalemi), açık şüpheli kayıtların kalanı (M13), kilit izi (karar (3), S11, S19 — yazım anındaki kilit; B12 göç yerine denetim izinden).
  const groupInto = (map, key, value) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  };
  let lockCache = { key: "", at: null };
  function lockResolver() {
    const key = settleKey("");
    if (!store.inTransaction && lockCache.key === key && lockCache.at) return lockCache.at;
    let rows = [];
    try {
      rows = store.all("SELECT type, payload_json AS payload, created_at AS at FROM audit_events WHERE entity_id = 'period' AND type IN ('ledger.period.locked', 'ledger.period.unlocked') ORDER BY rowid");
    } catch {
      rows = [];
    }
    const at = lockAtOf(lockHistory(rows));
    if (!store.inTransaction) lockCache = { key, at };
    return at;
  }
  function doubtfulRecordsOf(parties = null) {
    const out = new Map();
    try {
      if (!store.get("SELECT 1 AS found FROM doubtful_receivables LIMIT 1")) return out;
      const { records, state } = doubtfulState(store, parties ? { parties } : {});
      for (const record of records) {
        const s = state.get(record.id);
        if (s && s.remaining > 0) groupInto(out, record.party, { date: record.date, remainingMinor: s.remaining });
      }
    } catch {
      return out; // şüpheli tabloları yoksa (göç öncesi veri)
    }
    return out;
  }
  // 2.5.0 Ç5-A tur 3c (§19.1 DÖNGÜ): doubtful — şüpheli kalanları DIŞARIDAN (Map cari → [{ id, date, remainingMinor }]; lib/bank/doubtful.mjs ayırıcısının o anki durumu); verilmezse bugünkü doubtfulRecordsOf.
  function obligationExtras(accountId = null, doubtful = null) {
    const only = accountId ? " AND p.account_id = ?" : "";
    const args = accountId ? [accountId] : [];
    const schedules = new Map();
    for (const row of store.all(`SELECT i.id, i.plan_id AS planId, i.seq, i.due_date AS dueDate, i.amount FROM plan_items i JOIN plans p ON p.id = i.plan_id AND p.deleted_at IS NULL WHERE 1 = 1${only} ORDER BY i.due_date, i.seq`, ...args)) groupInto(schedules, row.planId, { id: row.id, seq: row.seq, dueDate: row.dueDate, amount: row.amount });
    const dueDates = new Map();
    const promises = new Map();
    // 2.5.0 TEK ADAY HIZ (t3hiz; ders 47): tek cari yolunda `+source` — dizinsiz planlayıcı `source = ''` için idx_account_entries_source'u seçip BÜTÜN elle satırları dolaşıyordu (100 bin
    // satırda ~18 ms; şüpheli ↔ kuyruk ayırıcısı bunu her kurulumda çağırır). Satır kümesi AYNI; sıra eski planın sırası (source_id, rowid) — haritalar yalnız get ile okunur, yine de aynı
    // tutuldu (eşdeğerlik test/t3hiz-esdegerlik-250.test.mjs: eski sorgu hakem). Bütün cariler yolu DEĞİŞMEDİ.
    const datedSql = accountId
      ? "SELECT id, account_id AS accountId, due_date AS dueDate, expected_date AS expectedDate FROM account_entries WHERE account_id = ? AND +source = '' AND kind IN ('debt', 'credit') AND (due_date <> '' OR expected_date <> '') ORDER BY source_id, rowid"
      : "SELECT id, account_id AS accountId, due_date AS dueDate, expected_date AS expectedDate FROM account_entries WHERE source = '' AND kind IN ('debt', 'credit') AND (due_date <> '' OR expected_date <> '')";
    for (const row of store.all(datedSql, ...args)) {
      if (row.dueDate) dueDates.set(row.id, row.dueDate);
      if (row.expectedDate) promises.set(row.id, row.expectedDate);
    }
    const lockAt = lockResolver();
    return { schedules, dueDates, promises, doubtful: doubtful || doubtfulRecordsOf(accountId ? [accountId] : null), lockAt, linkTimes: lockAt.active ? linkTimesOf(accountId) : new Map(), linkMoments: lockAt.active ? chequeLinkMoments(accountId) : new Map() };
  }
  // Ç5-B tur 2a (O-1, karar (3) — "kilitten sonraki bağ"): bağın KURULDUĞU an. Bağ (Kapatılacak Fatura, "Hangi Taksite") kaydın düzeltilmesiyle kurulduysa / değiştiyse an,
  // bağı değiştiren son düzeltmenin denetim izindeki anıdır (account.entry.updated: önceki ↔ yeni invoiceId; plan.entry.updated: önceki ↔ yeni itemId); değişmediyse kaydın
  // oluşturulma anı (bugünkü kural). Önceden kilit yalnız oluşturulma anına göre okunuyordu: kilitten ÖNCE yazılmış, kilitten SONRA düzeltmeyle kilitli dönemdeki faturaya bağlanan
  // tahsilat kilidi aşıyor, kilitli dönemde bağsız kapanmış faturanın kapatanı serbest kalıp başka kalemi kapatıyordu (dar kontrol DK-C5B O-1; yeni kayıtla kurulan aynı bağ
  // doğruydu). Tutar / tarih düzeltmesi bağın anını değiştirmez (bağ aynı). Kilit izi yoksa okunmaz. Dönüş: satır kimliği (defterdeki) → an.
  function linkTimesOf(accountId = null) {
    const out = new Map();
    const rows = (type, entityIn, previousKey, nextKey, prefix) => {
      try {
        for (const row of store.all(
          `SELECT entity_id AS id, MAX(created_at) AS at FROM audit_events WHERE type = ? AND entity_id IN (${entityIn})
             AND COALESCE(json_extract(payload_json, '$.previous.${previousKey}'), '') <> COALESCE(json_extract(payload_json, '$.${nextKey}'), '') GROUP BY entity_id`,
          type, ...(accountId ? [accountId] : []),
        )) if (row.id && row.at) out.set(`${prefix}${row.id}`, row.at);
      } catch {
        // denetim izi okunamadı (göç öncesi veri): oluşturulma anı
      }
    };
    rows("account.entry.updated", `SELECT id FROM account_entries WHERE invoice_id <> ''${accountId ? " AND account_id = ?" : ""}`, "invoiceId", "invoiceId", "");
    rows("plan.entry.updated", `SELECT e.id FROM plan_entries e JOIN plans p ON p.id = e.plan_id WHERE COALESCE(e.item_id, '') <> ''${accountId ? " AND p.account_id = ?" : ""}`, "itemId", "itemId", "plan-entry:");
    return out;
  }
  // Ç5-B tur 2b-1 (DK-C5BT2A ORTA-1; karar (3), O-1'in kardeşi): çek / senedin "Kapatılacak Fatura" bağı ilk olaydadır (cheque_events receive / issue .invoice_id) ve
  // evrak düzeltmesiyle kurulur / değişir / kalkar (cheque.updated izinde `invoiceId` yalnız bağ değişince yazılır — routes/cheques.mjs). Bağın anı = bağı değiştiren son
  // düzeltmenin anı, yoksa ilk olayın kaydı. KESİN an: tutar / cari / tarih düzeltmesi olayın cari satırlarını YENİDEN yazar (yeni satır kimliği, yeni kayıt anı) ama bağ aynıdır
  // — cari tahsilatının "tutar / tarih düzeltmesi bağın anını değiştirmez" kuralıyla aynı (önceden yeni satırın anı bağın anı sayılıyordu). Önceden bu iz hiç okunmuyordu:
  // kilitten SONRA düzeltmeyle kurulan çek bağı kilidi aşıyordu (gecikmiş 0 → 300; aynı bağ yeni evrakla 0). Dönüş: satır kimliği (defterdeki) → an.
  // Ç5-B kapanış düzeltmesi (hız; Borç Yaz — kabul koşulu iş listesi D "… S132"): TEK cari sorgusu carinin KENDİ evrak satırlarından sürülür. Önceden bütün ilk olaylar
  // (alınan / verilen evrak) taranıp cariye süzülüyordu — kilit açıkken her yazımda (100 bin satırlık veride ~16 ms). Kuyruk bu haritaya yalnız carinin defter satırlarını
  // sorar; evrakın cari satırı her zaman evrakın kimliğini taşır (routes/cheques.mjs applyEffects: source 'cheque', source_id = evrak) — o satırı yazan olay o evrakındır.
  // Bu yüzden carinin evrak satırı olan evrakların olayları yeter: carinin defter satırları için harita öncekiyle AYNI (eşdeğerlik: test/takvim-govde-250.test.mjs — eski
  // sorgu hakem; 100 bin satırlık veride 1.484 cari, 102.295 defter satırı, fark 0). Cari süzgeci aynen durur. Bütün cariler yolu (tek tarama) değişmedi.
  const MOMENT_COLUMNS = `SELECT ev.effects_json AS effects, ev.created_at AS created,
           (SELECT MAX(a.created_at) FROM audit_events a WHERE a.entity_id = ev.cheque_id AND a.type = 'cheque.updated' AND json_extract(a.payload_json, '$.invoiceId') IS NOT NULL) AS changed`;
  const MOMENTS_ALL_SQL = `${MOMENT_COLUMNS}
         FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id
         WHERE ev.kind IN ('receive', 'issue') AND ev.invoice_id <> ''`;
  const MOMENTS_ONE_SQL = `${MOMENT_COLUMNS}
         FROM (SELECT DISTINCT source_id AS id FROM account_entries WHERE account_id = ?1 AND +source = 'cheque') own
           CROSS JOIN cheque_events ev ON ev.cheque_id = own.id
           CROSS JOIN cheques c ON c.id = ev.cheque_id
         WHERE +ev.kind IN ('receive', 'issue') AND ev.invoice_id <> '' AND (c.account_id = ?1 OR c.endorse_account_id = ?1 OR ev.account_id = ?1)`;
  function chequeLinkMoments(accountId = null) {
    const out = new Map();
    try {
      for (const row of accountId ? store.all(MOMENTS_ONE_SQL, accountId) : store.all(MOMENTS_ALL_SQL)) {
        const at = String(row.changed || "") > String(row.created || "") ? String(row.changed) : String(row.created || "");
        if (!at) continue;
        const effects = parseJson(row.effects, []);
        for (const effect of Array.isArray(effects) ? effects : []) if (effect?.table === "account_entries" && effect.id) out.set(effect.id, at);
      }
    } catch {
      // denetim izi / çek tabloları okunamadı (göç öncesi veri): satırın kayıt anı
    }
    return out;
  }
  const withExtras = (input, extras, accountId) => ({ ...input, schedules: extras.schedules, dueDates: extras.dueDates, promises: extras.promises, doubtfulRecords: extras.doubtful.get(accountId) || [], lockAt: extras.lockAt, linkTimes: extras.linkTimes, linkMoments: extras.linkMoments });
  // Bir carinin kapama girdisi (tek carili yol): carinin defteri + faturaları + bağlar (paymentStates ve entryStates aynı kuralla).
  function accountSettleInput(accountId, ledger, day) {
    // Bu carinin bütün faturaları (listede olmayanlar da kapamada yer tutar).
    const all = store.all("SELECT id, kind, status, try_payable AS payable, original_id AS originalId, due_date AS dueDate, plan_id AS planId, COALESCE(NULLIF(issued_at, ''), created_at) AS issuedAt FROM invoices WHERE account_id = ?", accountId);
    const links = new Map();
    // 2.5.0 TEK ADAY HIZ (t3hiz): `+source` (yukarıdaki datedSql notu — idx_account_entries_source bütün fatura peşinlerini dolaşıyordu, ~40 ms); küme aynı, sıra eski planınki.
    for (const entry of store.all("SELECT id, source_id AS invoiceId FROM account_entries WHERE account_id = ? AND +source = 'invoice' AND kind IN ('in', 'out') ORDER BY source_id, rowid", accountId)) links.set(entry.id, entry.invoiceId);
    // v2.0.17: cari kartından "Kapatılacak Fatura" seçilerek girilen tahsilat/ödeme.
    // v2.0.23: taksitli faturaya kurulmuş bağ (eski veri) yok sayılır (toplu yolla aynı kural).
    const planned = new Set(all.filter(item => item.planId).map(item => item.id));
    for (const entry of store.all("SELECT id, invoice_id AS invoiceId FROM account_entries WHERE account_id = ? AND source IN ('', 'bank') AND invoice_id <> ''", accountId)) if (!planned.has(entry.invoiceId)) links.set(entry.id, entry.invoiceId);
    // Çek/senet satırlarının olay türü (karşılıksız → yükümlülük yeniden açılır) ve faturaya bağı.
    const chequeEvents = new Map();
    const reversals = new Map();
    // Bağlı fatura başka carinin olsa (bozuk veri) kapamada zaten yer almaz (yalnız bu carinin faturaları); taksitli olanlar bu carinin kümesinde.
    // 2.5.0 TEK ADAY HIZ (t3hiz): üç kolun VEYA'sı her olay satırında evrakı arayan tam taramaydı (~17 ms); kollar ayrı (evrakın carisi idx_cheques_account'tan) ve birleşimi — olay kümesi
    // ve sırası (rowid) AYNI (evrak kimliği tekil: her olay en çok bir evrakla eşleşir).
    chequeLinks(store.all(`SELECT ev.cheque_id AS chequeId, ev.kind, ev.invoice_id AS invoiceId, ev.effects_json AS effects, c.invoice_id AS own FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id
      WHERE ev.rowid IN (SELECT x.rowid FROM cheques y CROSS JOIN cheque_events x ON x.cheque_id = y.id WHERE y.account_id = ?1
        UNION SELECT x.rowid FROM cheques y CROSS JOIN cheque_events x ON x.cheque_id = y.id WHERE y.endorse_account_id = ?1
        UNION SELECT rowid FROM cheque_events WHERE account_id = ?1) ORDER BY ev.rowid`, accountId), planned, links, chequeEvents, reversals);
    const offsets = store.all("SELECT id, invoice_id AS invoiceId, counter_type AS counterType, counter_id AS counterId, amount, date, note, created_at AS createdAt FROM invoice_offsets WHERE account_id = ? ORDER BY date, created_at", accountId).map(offset => ({ ...offset, label: offsetLabel(offset) }));
    const plansById = new Map();
    for (const invoice of all.filter(item => item.planId)) {
      const plan = store.get("SELECT total FROM plans WHERE id = ? AND deleted_at IS NULL", invoice.planId);
      const schedule = store.all("SELECT due_date AS dueDate, amount FROM plan_items WHERE plan_id = ? ORDER BY due_date", invoice.planId);
      plansById.set(invoice.id, { planTotal: Number(plan?.total) || 0, schedule });
    }
    return { lines: ledger, invoices: all.map(item => ({ ...item, ...(plansById.get(item.id) || {}) })), links, chequeEvents, reversals, offsets, today: day };
  }
  // 2.5.0 Ç5-A tur 3b (§18.11 (4)): carinin SATIRLARI da modülün kendisinden (lib/account-lines.mjs — routes/accounts.mjs allLedgers'ın satır kuralı, routes/plans.mjs'in kart haritası;
  // servis ağacı yok). Taşıma değil: yalnız taşınan parçaları bağlar. Eski "satırlar parametreyle" yolları (accountSettleInput / batchSettleInput) AYNEN kalır.
  // Örnek gerekince (ilk çağrıda) kurulur; bellekleri (iade kesimi, satış kaynağı) bu modül örneğinin ömründedir.
  let accountLines = null;
  const linesOwn = () => (accountLines ||= createAccountLines({ store }));
  // Silinmemiş carilerin (ids verilirse yalnız onların) defter satırları: Map(cari → satırlar); plans: kart haritası (ledgerPlansByAccount) — çok carili çağıran BİR kez verir.
  function ledgerLines({ ids = null, plans = null } = {}) {
    const own = linesOwn();
    const list = Array.isArray(ids) ? JSON.stringify(ids.map(String)) : "";
    const scope = list ? "SELECT value FROM json_each(?)" : "";
    const args = list ? [list] : [];
    const rows = store.all(`SELECT id FROM accounts WHERE deleted_at IS NULL${scope ? ` AND id IN (${scope})` : ""} ORDER BY name COLLATE NOCASE`, ...args);
    const entries = own.entriesByAccount(scope, args);
    return own.ledgerLinesOf(rows, entries, plans || own.ledgerPlansByAccount());
  }
  // Tek carinin kuyruk girdisi (routes/invoices.mjs obligationsFor'un girdisi); ledger verilmezse satırlar ledgerLines'tan (silinmiş / olmayan cari: satırsız).
  function accountInput(accountId, day, ledger = null) {
    return withExtras(accountSettleInput(accountId, ledger || ledgerLines({ ids: [accountId] }).get(accountId) || [], day), obligationExtras(accountId), accountId);
  }
  // Bütün (ya da ids) carilerin kuyruk girdileri: Map(cari → girdi) — routes/invoices.mjs allSettled'in kurgusu (settleTables + batchSettleInput + obligationExtras()).
  function batchInputs(day, { ledgers = null, ids = null } = {}) {
    const map = ledgers || ledgerLines({ ids });
    const tables = settleTables();
    const extras = obligationExtras();
    const out = new Map();
    for (const [accountId, lines] of map) out.set(accountId, withExtras(batchSettleInput(accountId, lines, tables, day), extras, accountId));
    return out;
  }
  return { offsetLabel, chequeLinks, settleTables, batchSettleInput, settleKey, lockResolver, doubtfulRecordsOf, obligationExtras, linkTimesOf, chequeLinkMoments, withExtras, accountSettleInput, ledgerLines, accountInput, batchInputs };
}
