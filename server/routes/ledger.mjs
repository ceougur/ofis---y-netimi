// Ana Defter servisi (v2.0.13): alt defterleri, alt defterlerin kendi süzgeçleriyle okur (silinen cari/kart/evrak dışarıda;
// Kasa'dan düşen hareket ana defterde de yoktur), yevmiyeyi ve mizanı kurar, mutabakat kapısını çalıştırır.
//   GET /api/workspace/ledger?from=&to=  → mizan + mutabakat (Finans raporları yetkisi)
// Rapor merkezi "Hesap Planı Mizanı", "Yevmiye Defteri" ve "Defter Mutabakatı" raporlarını bu servisten üretir.
import { ACCOUNT_PLAN, CHART, journal, moneyAccount, reconcile, trialBalance } from "../lib/general-ledger.mjs";
import { DOUBTFUL_GL } from "../lib/doubtful-gl.mjs";
import { doubtfulExpected, doubtfulRows, doubtfulUsed } from "../lib/bank/doubtful.mjs";
import { systemClock } from "../lib/clock.mjs";
import { HttpError, ok, readJson, text } from "../lib/http.mjs";
import { VOUCHER_TYPES, createLedgerVouchers, voucherJournalRows } from "../lib/ledger-vouchers.mjs";
import { createLedgerSnapshots } from "../lib/ledger-snapshots.mjs";
import { createHash } from "node:crypto";
import { nextDayOf, oldRulePinnedPlans, postedRuleDiffCorrections, ruleDiffCorrectionPlan } from "../lib/ledger-opening.mjs";
import { leanAll } from "../lib/lean-rows.mjs";
import { roundMoney } from "../lib/money.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
// Carisiz evrak satırlarının yazım sırası tabanı (MM8): cari satırlarının rowid'lerinden büyük (aynı gün aynı sınıfta onlardan sonra gelir).
const FREE_SEQ = 1e15;
// İstemcinin istek kimliği (lib/idempotency.mjs FORMAT ile aynı): fişin istek kimliği "api:<kimlik>".
const REQUEST_ID = /^[A-Za-z0-9_-]{16,100}$/;
/**
 * Mutabakat Günlüğü satırı (Mutabakat Testi yanıtı). 2.4.9 ve öncesi kaydın ayrıntısını 20.000 karakterde KESİYORDU (bank/repair: 2.0.26 "Tüm Hareketleri Sil" sonrası yüzlerce
 * iptal başlığı; integrity taban kaydı): geçersiz JSON bütün yanıtı (HTTP 500) düşürmesin (Ç3 tur 3, Ç3 küçük işler (b)). Okunamayan ayrıntı BOŞ sayılmaz (ders 4): detail null,
 * detailUnreadable true ve neden; satırın öbür alanları aynen.
 */
export function logRow(row) {
  try {
    return { ...row, detail: JSON.parse(row.detail || "[]") };
  } catch {
    return { ...row, detail: null, detailUnreadable: true, detailNote: `Kayıt ayrıntısı okunamadı (kesik ya da bozuk kayıt; ${String(row.detail || "").length} karakter).` };
  }
}

export function registerLedgerRoutes(router, { store, auth, audit = () => {}, events = null, period = null, now = systemClock, cash = () => null, accounts = () => null, integrity = () => null, money = null, pos = () => null, config = {}, log = null, canWriteInBackground = () => true, schemaGate = null, __testLedgerRule = null, __testFreezeHook = null, freezeBatchLines = 0 }) {
  const has = table => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", table));
  // v2.1.0 (§3.11): para satırının hesap bağı (fin_ref; '' = Hesabı Atanmamış). v19 dosyasında (araçlar) kolon yoktur: ''.
  const refOf = (table, alias) => (store.all(`PRAGMA table_info(${table})`).some(column => column.name === "fin_ref") ? `${alias}.fin_ref` : "''");
  const hasColumn = (table, name) => store.all(`PRAGMA table_info(${table})`).some(column => column.name === name);
  // Banka hesabı ve POS kartları (alt hesap kodları): yevmiyede moneyAccount, beklenenlerde yolun alt hesabı.
  function refs() {
    const out = { accounts: {}, pos: {} };
    if (has("bank_accounts")) for (const row of store.all("SELECT id, kind, gl, gl_sub AS glSub FROM bank_accounts")) out.accounts[row.id] = { kind: row.kind, gl: row.gl, glSub: row.glSub };
    if (has("pos_terminals")) for (const row of store.all("SELECT id, gl_sub AS glSub FROM pos_terminals")) out.pos[row.id] = { glSub: row.glSub };
    return out;
  }
  // filter (v2.1.0, §3.11 mutabakat kapısı "dokunulan varlıklar"): yalnız bu varlıkların satırları — { parties, plans, cheques, invoices,
  // events, money: { tablo: kimlikler } }. Her tabloda verilen varlıklardan birine ait satırlar (VEYA); hiçbiri o tabloya uymuyorsa tablo
  // boş gelir. filter yoksa sorgular 2.0.26'dakiyle aynıdır (bütün satırlar).
  function rows(filter = null) {
    const out = { payments: [], cashEntries: [], accountEntries: [], plans: [], planEntries: [], stockMoves: [], chequeEvents: [], invoices: [], bankLines: [], refs: refs() };
    const params = {};
    const list = (name, values) => {
      if (!values || !values.length) return null;
      params[name] = JSON.stringify([...values]);
      return `(SELECT value FROM json_each(:${name}))`;
    };
    const set = filter ? {
      parties: list("parties", filter.parties), plans: list("plans", filter.plans), cheques: list("cheques", filter.cheques), invoices: list("invoices", filter.invoices), events: list("events", filter.events),
      payments: list("m_payments", filter.money?.payments), cash: list("m_cash", filter.money?.cash_entries), entries: list("m_entries", filter.money?.account_entries),
      planEntries: list("m_plan_entries", filter.money?.plan_entries), moves: list("m_moves", filter.money?.stock_moves), chequeEvents: list("m_cheque_events", filter.money?.cheque_events),
    } : null;
    // Tablonun süzgeci: koşullardan (null olmayanlar) en az biri; filter var ama hiçbiri yoksa satır yok. Koşullar satır kimliği kümesine
    // çevrilir (alias.id IN (alt sorgu UNION alt sorgu …)): her alt sorgu kendi indeksini kullanır. Kolonlar arası OR (e.account_id IN …
    // OR e.id IN …) indekssiz tam taramaya düşüyordu (100.000 satırda fatura sorgusu ~60 ms). keys: [değer, alt sorgu ($ = liste)].
    const where = (alias, keys, glue = "WHERE") => {
      if (!filter) return "";
      const kept = keys.filter(([value]) => value).map(([value, sql]) => sql.replace("$", value));
      return ` ${glue} ${kept.length ? `${alias}.id IN (${kept.join(" UNION ")})` : "0"}`;
    };
    const own = name => `SELECT value FROM json_each(:${name})`;
    // Süzgeçte satır tablosu dış döngüdür (CROSS JOIN yalnız sırayı belirler; sonuç aynı iç birleşim): istatistiksiz planlayıcı aksi hâlde
    // görünürlük JOIN'inin indeksiyle (accounts.deleted_at) bütün tabloyu dolaşabilir. Süzgeçsiz sorgular 2.1.0 dilim 4'teki gibidir.
    const J = filter ? "CROSS JOIN" : "JOIN";
    // Aynı nedenle süzgeçte durum kolonlarının indeksi kapatılır (tekli +: değer aynı, yalnız indeks seçilmez): i.status = 'issued'
    // indeksi, kimlik kümesinin birincil anahtarından önce seçiliyordu (100.000 satırda ~55 ms).
    const X = filter ? "+" : "";
    // Yalnız sorguda geçen adlı parametreler verilir (node:sqlite bilinmeyen adı reddeder). 2.5.0 Ç3 tamamlama (ders 47; lib/lean-rows.mjs): bütün geçmişin kaynak satırları
    // sıkı nesnelerle okunur (store.all'ın sözlük kipli satırı ~1,35 KB; 1.000.000 satırda yalnız bunlar yığını doldurup programı çökertiyordu). Değerler aynı.
    const all = (sql, query = true) => (query ? leanAll(store, sql, Object.fromEntries(Object.entries(params).filter(([name]) => sql.includes(`:${name})`)))) : []);
    const wanted = (...values) => !filter || values.some(Boolean);
    out.payments = all(`SELECT id, p.rowid AS seq, amount, date, note, method, ${refOf("payments", "p")} AS ref FROM payments p${where("p", [[set?.payments, own("m_payments")]])}`, wanted(set?.payments));
    // Kasa ↔ Banka transferinin nakit bacağı banka bacağının hesabını (ikiz satırın fin_ref'i) taşır: madde tek, banka tarafı onun hesabıdır.
    const cashRef = refOf("cash_entries", "c");
    // Yargıç Y2/Y3: Kasa açılışı işaretten (göç 22; v21 ve öncesi dosyada kolon yok: 0 — sıradan giriş).
    const cashOpening = store.all("PRAGMA table_info(cash_entries)").some(column => column.name === "is_opening") ? "c.is_opening" : "0";
    // 2.4.3 MM3 (göç 29): Kasa'dan vergi ödemesinin ayrıntısı (B 360 · B 689 / A 100). v28 ve öncesi dosyada kolon yok: ''.
    const cashTax = store.all("PRAGMA table_info(cash_entries)").some(column => column.name === "tax_json") ? "c.tax_json" : "''";
    out.cashEntries = all(
      `SELECT c.id, c.rowid AS seq, c.kind, c.amount, c.date, c.description, c.method, c.transfer_id AS transferId, ${cashOpening} AS isOpening, ${cashTax} AS taxJson, ${cashRef} AS ref,
              CASE WHEN c.transfer_id <> '' THEN COALESCE((SELECT ${cashRef === "''" ? "''" : "t.fin_ref"} FROM cash_entries t WHERE t.transfer_id = c.transfer_id AND t.id <> c.id LIMIT 1), '') ELSE '' END AS bankRef
       FROM cash_entries c${where("c", [[set?.cash, own("m_cash")]])}`,
      wanted(set?.cash),
    );
    // Bankaya Tahsile Ver (plan §3.14): tahsil kaydı tablosu varsa satır bayrakları (yevmiyede 101.01 ↔ 101.02; general-ledger journal()).
    const collections = has("cheque_collections");
    if (has("accounts")) {
      // bankReturned: bankada tahsildeyken karşılıksız dönen evrakın karşılıksız maddesi (carinin kendi borç satırı) — alacağı 101.02.
      const returned = collections
        ? "CASE WHEN e.source = 'cheque' AND e.kind = 'debt' AND c.direction = 'in' AND e.account_id = c.account_id AND EXISTS (SELECT 1 FROM cheque_collections k WHERE k.cheque_id = c.id AND k.status = 'returned') THEN 1 ELSE 0 END"
        : "0";
      const entryKeys = [[set?.parties, "SELECT id FROM account_entries WHERE account_id IN $"], [set?.entries, own("m_entries")], [set?.cheques, "SELECT id FROM account_entries WHERE source = 'cheque' AND source_id IN $"]];
      out.accountEntries = all(
        `SELECT e.id, e.rowid AS seq, e.kind, e.amount, e.date, e.note, e.source, e.source_id AS sourceId, e.method, ${refOf("account_entries", "e")} AS ref, a.type AS accountType, e.account_id AS party,
                COALESCE(c.direction, '') AS chequeDirection, COALESCE(c.instrument, '') AS chequeInstrument, COALESCE(m.reason, '') AS moveReason, ${returned} AS bankReturned,
                e.invoice_id AS invoiceId, e.doubtful_skip AS doubtfulSkip
         FROM account_entries e ${J} accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
           LEFT JOIN cheques c ON e.source = 'cheque' AND c.id = e.source_id
           LEFT JOIN stock_moves m ON e.source = 'stock' AND m.id = e.source_id${where("e", entryKeys)}`,
        wanted(set?.parties, set?.entries, set?.cheques),
      );
      // 2.5.0 Ç5-A (§2.3; KG-16): açılış işaretten — Açılış Bakiyesi satırı (is_opening, göç 35) ve "Açılış Olabilir" durumu (opening_review, göç 48). Eski dosyada kolon yok.
      // Ç5-A tur 1c (hız, ders 47; C5-ACILIS-TASARIM §13 H1): iki kolon bütün satırlarda okunmaz (100.000 satırda türetme başına ~100 ms satır dönüşümü) — yalnız işaretli ya da
      // aday / onaylı satırların değerleri ayrı küçük sorguyla (AYNI süzgeçle) okunur ve o satır nesnelerine AYNI değerlerle yazılır. Öbür satırlarda alan yoktur: journal()'ın
      // isOpeningEntry'si yine false (0 / '' / rejected ile aynı). Evrakın carisiz satırları (free-in / free-out; kendi isOpening'leri) aşağıda, bundan SONRA eklenir.
      const entryOpening = hasColumn("account_entries", "is_opening");
      const entryReview = hasColumn("account_entries", "opening_review");
      if ((entryOpening || entryReview) && out.accountEntries.length) {
        const flagged = new Map();
        for (const row of all(
          `SELECT e.id, ${entryOpening ? "e.is_opening" : "0"} AS isOpening, ${entryReview ? "e.opening_review" : "''"} AS openingReview FROM account_entries e
           WHERE (${[entryOpening ? "e.is_opening = 1" : "", entryReview ? "e.opening_review IN ('candidate', 'confirmed')" : ""].filter(Boolean).join(" OR ")})${where("e", entryKeys, "AND")}`,
          wanted(set?.parties, set?.entries, set?.cheques),
        )) flagged.set(row.id, row);
        if (flagged.size) {
          for (const row of out.accountEntries) {
            const flag = flagged.get(row.id);
            if (flag) {
              row.isOpening = flag.isOpening;
              row.openingReview = flag.openingReview;
            }
          }
        }
      }
    }
    if (has("plans")) {
      // Kartın carisi silindiyse kart cari defterinde görünmez: ana defterde "carisiz kart" hesabında izlenir.
      // 2.5.0 Ç5-A (KG-5; B5): yüklenen kart (import_id) — yükleme damgası (plan_imports.created_at; yerel günü journal()'da) ve açılış satırlarının toplamı (P). Eski dosyada: yok.
      const imported = hasColumn("plans", "import_id") && has("plan_imports");
      const planKeys = [[set?.parties, "SELECT id FROM plans WHERE account_id IN $"], [set?.plans, own("plans")]];
      out.plans = all(
        `SELECT p.id, p.rowid AS seq, p.total, p.status, p.covers_balance AS coversBalance, COALESCE(NULLIF(p.registered_on, ''), substr(p.created_at, 1, 10)) AS date, COALESCE(p.closed_at, substr(p.updated_at, 1, 10)) AS closedOn,
                COALESCE(a.type, '') AS accountType, COALESCE(a.id, '') AS party,
                COALESCE((SELECT SUM(CASE WHEN e.kind = 'in' THEN e.amount ELSE -e.amount END) FROM plan_entries e WHERE e.plan_id = p.id), 0) AS paid
         FROM plans p LEFT JOIN accounts a ON a.id = p.account_id AND a.deleted_at IS NULL WHERE ${X}p.deleted_at IS NULL${where("p", planKeys, "AND")}`,
        wanted(set?.parties, set?.plans),
      );
      // Doğrulama T11: taksite sayılmış evrakın karşılıksız ters kaydı (çekli 'out'); bankada tahsildeyken döndüyse alacağı 101.02 (satır bazında).
      const planReturned = collections
        ? "CASE WHEN e.kind = 'out' AND e.cheque_id <> '' AND EXISTS (SELECT 1 FROM cheque_collections k WHERE k.cheque_id = e.cheque_id AND k.status = 'returned') THEN 1 ELSE 0 END"
        : "0";
      // 2.2.0 İz 4.2 (plan §3.11a): taksite sayılan evrakın türü (senet 121, çek 101); evrak silinmiş olsa da türü okunur (satır deftere girer).
      const planInstrument = has("cheques") ? "CASE WHEN e.cheque_id <> '' THEN COALESCE((SELECT x.instrument FROM cheques x WHERE x.id = e.cheque_id), '') ELSE '' END" : "''";
      out.planEntries = all(
        `SELECT e.id, e.rowid AS seq, e.plan_id AS planId, e.kind, e.amount, e.date, e.note, e.method, ${refOf("plan_entries", "e")} AS ref, e.cheque_id AS chequeId, ${planInstrument} AS chequeInstrument, e.opening, COALESCE(a.type, '') AS accountType, COALESCE(a.id, '') AS party, ${planReturned} AS bankReturned,
                COALESCE(NULLIF(p.registered_on, ''), substr(p.created_at, 1, 10)) AS planDate, p.covers_balance AS planCovers
         FROM plan_entries e ${J} plans p ON p.id = e.plan_id AND p.deleted_at IS NULL LEFT JOIN accounts a ON a.id = p.account_id AND a.deleted_at IS NULL${where("e", [[set?.parties, "SELECT pe.id FROM plans pp JOIN plan_entries pe ON pe.plan_id = pp.id WHERE pp.account_id IN $"], [set?.plans, "SELECT id FROM plan_entries WHERE plan_id IN $"], [set?.planEntries, own("m_plan_entries")], [set?.cheques, "SELECT id FROM plan_entries WHERE cheque_id IN $"]])}`,
        wanted(set?.parties, set?.plans, set?.planEntries, set?.cheques),
      );
      // Ç5-A tur 1c (hız, ders 47; C5-ACILIS-TASARIM §13 H2): yüklenen kartın alanları (importId, importedAt, openingPaid — tur 1'deki AYNI SQL ifadeleri) ve taksit satırının
      // planImported'ı (kartı yüklenmiş mi: p.import_id <> '') bütün kartlarda / satırlarda okunmaz; yalnız yüklenen kartlar (silinmemiş, import_id ≠ '') ayrı sorguyla okunur ve o
      // kart nesnelerine / o kartların taksit satırlarına AYNI değerlerle yazılır. Süzgeçli yolda (kapı) sorgu yalnız okunan kartların ve taksit satırlarının kartlarıyla sınırlı
      // (taksit satırının kartı kart süzgecinde olmayabilir). Öbür kartlarda / satırlarda alan yok (journal()'da '' / 0 ile aynı).
      if (imported && (out.plans.length || out.planEntries.length)) {
        const scope = filter ? [...new Set([...out.plans.map(plan => plan.id), ...out.planEntries.map(entry => entry.planId)])] : null;
        const details = new Map();
        for (const row of leanAll(
          store,
          `SELECT p.id, p.import_id AS importId, COALESCE((SELECT x.created_at FROM plan_imports x WHERE x.id = p.import_id), '') AS importedAt,
                  COALESCE((SELECT SUM(e.amount) FROM plan_entries e WHERE e.plan_id = p.id AND e.kind = 'in' AND e.opening = 1), 0) AS openingPaid
           FROM plans p WHERE ${X}p.deleted_at IS NULL AND p.import_id <> ''${scope ? " AND p.id IN (SELECT value FROM json_each(?))" : ""}`,
          ...(scope ? [JSON.stringify(scope)] : []),
        )) details.set(row.id, row);
        if (details.size) {
          for (const plan of out.plans) {
            const detail = details.get(plan.id);
            if (detail) {
              plan.importId = detail.importId;
              plan.importedAt = detail.importedAt;
              plan.openingPaid = detail.openingPaid;
            }
          }
          for (const entry of out.planEntries) if (details.has(entry.planId)) entry.planImported = 1;
        }
      }
      // 2.5.0 Ç5-A tur 1b (S127 = A, "bir olay tek kez yazılır"; C5-ACILIS-TASARIM §12.1): KG-5'ten önceki kuralla donmuş dönemin iki yanına düşen yüklenen kart eski yapısıyla
      // (journal() pinnedOld). Karar kart başına, süzgeçsiz verilir (süzgeçli kapı aynı kartı aynı kuralla görür). Donmuş koşu yoksa sorgu yok.
      // Ç5-A tur 1d (İş F, hız; ders 47; C5-ACILIS-TASARIM §14.7): kart / taksit satırı okunmadıysa karar sorulmaz (işaretlenecek nesne yok); süzgeçli yolda yalnız okunan kartlar
      // (ve taksit satırlarının kartları) değerlendirilir — karar kart başına olduğu için sonuç aynı (= süzgeçsiz karar ∩ okunan kartlar).
      if (imported && (out.plans.length || out.planEntries.length)) {
        const pinned = oldRulePinnedPlans(store, filter ? { ids: [...out.plans.map(plan => plan.id), ...out.planEntries.map(entry => entry.planId)] } : {});
        if (pinned.size) {
          for (const plan of out.plans) if (pinned.has(plan.id)) plan.pinnedOld = 1;
          for (const entry of out.planEntries) if (pinned.has(entry.planId)) entry.planPinned = 1;
        }
      }
    }
    // Fatura (v2.0.15): yalnız kesilmiş olanlar (taslak ve iptal deftere girmez). Carisi silinmiş fatura olamaz (silme engelli).
    if (has("invoices")) {
      out.invoices = all(
        `SELECT i.id, i.rowid AS seq, i.kind, i.issue_date AS date, i.number, i.gl_json AS glJson, i.try_vat AS tryVat, i.try_withheld AS tryWithheld, i.try_stoppage AS tryStoppage,
                i.try_payable AS tryPayable, a.type AS accountType, a.id AS party
         FROM invoices i ${J} accounts a ON a.id = i.account_id AND a.deleted_at IS NULL WHERE ${X}i.status = 'issued'${where("i", [[set?.parties, "SELECT id FROM invoices WHERE account_id IN $"], [set?.invoices, own("invoices")]], "AND")}`,
        wanted(set?.parties, set?.invoices),
      );
    }
    if (has("stock_moves")) out.stockMoves = all(`SELECT m.id, m.rowid AS seq, m.kind, m.amount, m.date, m.note, m.pay, m.method, m.reason, ${refOf("stock_moves", "m")} AS ref FROM stock_moves m WHERE ${X}m.pay = 'cash' AND m.amount > 0${where("m", [[set?.moves, own("m_moves")]], "AND")}`, wanted(set?.moves));
    // MM4 (2.4.3, göç 29): açılış stoku — işaretli (is_opening) yalnız miktar girişi; değeri miktar × hareketin birim fiyatı (kuruşa yuvarlanır). Ürün
    // sonradan silinse de açılış deftere girer (aralıklı envanter: 153 = dönem başı + alışlar; peşin alım gibi). v28 ve öncesi dosyada kolon yok: satır yok.
    if (has("stock_moves") && store.all("PRAGMA table_info(stock_moves)").some(column => column.name === "is_opening")) {
      out.stockOpenings = all(
        `SELECT m.id, m.rowid AS seq, m.qty, m.unit_price AS unitPrice, m.date, m.note, COALESCE(i.name, '') AS itemName, COALESCE(i.unit, '') AS unit FROM stock_moves m LEFT JOIN stock_items i ON i.id = m.item_id
         WHERE ${X}m.is_opening = 1 AND m.kind = 'in' AND m.pay = 'none'${where("m", [[set?.moves, own("m_moves")]], "AND")}`,
        wanted(set?.moves),
      );
    }
    // Banka Fişi satırları (v2.1.0): THP kodu, alt hesap ve kuruş yazım anında saklanır.
    if (has("bank_lines") && has("fin_events")) {
      out.bankLines = all(`SELECT l.event_id AS eventId, e.rowid AS eventSeq, l.seq, l.role, l.gl, l.sub, l.side, l.try_minor AS tryMinor, e.date, e.no, e.description FROM bank_lines l ${J} fin_events e ON e.id = l.event_id${filter ? ` WHERE ${set?.events ? `l.event_id IN ${set.events}` : "0"}` : ""} ORDER BY e.date, l.event_id, l.seq`, wanted(set?.events));
    }
    if (has("cheques")) {
      const eventOf = refOf("cheque_events", "ev") === "''" ? "''" : "ev.event_id";
      // closesDeposit: bu tahsil olayı bankada tahsildeki evrakın kaydını kapattı (collected, close_event_id = olayın başlığı) — tahsil maddesinin
      // alacağı 101.02. Satır bazında: İşlem Kartı ve kapı yalnız bu satırla kurduğunda da aynı sonuç (doğrulama G1).
      const closes = collections && eventOf !== "''"
        ? "CASE WHEN ev.kind = 'collect' AND ev.event_id <> '' AND EXISTS (SELECT 1 FROM cheque_collections k WHERE k.cheque_id = ev.cheque_id AND k.status = 'collected' AND k.close_event_id = ev.event_id) THEN 1 ELSE 0 END"
        : "0";
      out.chequeEvents = all(`SELECT ev.id, ev.rowid AS seq, ev.kind, ev.amount, ev.date, ev.note, ev.method, ${refOf("cheque_events", "ev")} AS ref, ${eventOf} AS eventId, ${closes} AS closesDeposit, c.instrument AS instrument FROM cheque_events ev ${J} cheques c ON c.id = ev.cheque_id AND c.deleted_at IS NULL WHERE ${X}ev.kind IN ('collect', 'pay')${where("ev", [[set?.chequeEvents, own("m_cheque_events")], [set?.cheques, "SELECT id FROM cheque_events WHERE cheque_id IN $"]], "AND")}`, wanted(set?.chequeEvents, set?.cheques));
      // Cariye işlenmemiş evrak: carisi/kartı olmayan (ör. cari açılmamış bir kişiden alınan çek) ya da Excel'den
      // "carilere dokunmadan" alınan açılış portföyü. Cari etkisi yoktur; portföye girişi ve karşılıksız/iade çıkışı ana
      // defterde doğrudan gelir/gider karşılığıyla izlenir (portföy mutabakatı tutsun).
      // 2.5.0 Ç5-A (§2.5; B4): açılış evrakı işaretten (cheques.is_opening, göç 49 — Excel "Açılış portföyü"); eski dosyada kolon yok: 0 (formdan carisiz evrak kuralı).
      const chequeOpening = hasColumn("cheques", "is_opening") ? "c.is_opening" : "0";
      for (const row of all(
        `SELECT c.id, c.rowid AS seq, c.direction, c.instrument, c.amount, c.issue_date AS date, c.status, c.serial_no AS serialNo, ${chequeOpening} AS isOpening,
                (SELECT ev.date FROM cheque_events ev WHERE ev.cheque_id = c.id AND ev.kind = 'bounce' ORDER BY ev.created_at DESC LIMIT 1) AS bouncedOn,
                ${collections ? "EXISTS (SELECT 1 FROM cheque_collections k WHERE k.cheque_id = c.id AND k.status = 'returned')" : "0"} AS bankReturned,
                EXISTS (SELECT 1 FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
                        WHERE e.source = 'cheque' AND e.source_id = c.id AND e.account_id = c.account_id AND e.kind = 'debt') AS hasDebt
         FROM cheques c
         WHERE ${X}c.deleted_at IS NULL
           AND NOT EXISTS (SELECT 1 FROM plan_entries pe JOIN plans p ON p.id = pe.plan_id AND p.deleted_at IS NULL WHERE pe.cheque_id = c.id)
           AND NOT EXISTS (SELECT 1 FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL
                           WHERE e.source = 'cheque' AND e.source_id = c.id AND e.account_id = c.account_id
                             AND e.kind = CASE WHEN c.direction = 'in' THEN 'credit' ELSE 'debt' END)${where("c", [[set?.cheques, own("cheques")]], "AND")}`,
        wanted(set?.cheques),
      )) {
        const note = `Cariye işlenmemiş evrak${row.serialNo ? ` No ${row.serialNo}` : ""}`;
        // Yazım sırası (MM8): evrakın rowid'i cari satırlarınınkiyle karşılaştırılamaz (başka tablo) → aynı gün cari satırlarından SONRA, evrakların
        // yazım sırasıyla (general-ledger journalOrder).
        const seq = FREE_SEQ + Number(row.seq);
        const isOpening = Number(row.isOpening) === 1 ? 1 : 0;
        if (row.direction === "in") {
          out.accountEntries.push({ id: `free-in:${row.id}`, seq, kind: "credit", amount: row.amount, date: row.date, note, source: "cheque", chequeDirection: "in", chequeInstrument: row.instrument, accountType: "", free: true, isOpening });
          if (row.status === "bounced" && row.bouncedOn && !row.hasDebt) out.accountEntries.push({ id: `free-bounce:${row.id}`, seq, kind: "debt", amount: row.amount, date: row.bouncedOn, note: `${note} · karşılıksız`, source: "cheque", chequeDirection: "in", chequeInstrument: row.instrument, accountType: "", free: true, bounce: true, isOpening, bankReturned: Number(row.bankReturned) ? 1 : 0 });
        } else out.accountEntries.push({ id: `free-out:${row.id}`, seq, kind: "debt", amount: row.amount, date: row.date, note, source: "cheque", chequeDirection: "out", chequeInstrument: row.instrument, accountType: "", free: true, isOpening });
      }
    }
    // Bankaya Tahsile Ver (plan §3.14): tahsil kayıtları (101.01 ↔ 101.02). Silinmiş evrakın kaydı (tahsildeyken silinemez) deftere girmez.
    // closedByCollect: kayıt bu çekin tahsil olayıyla kapandı (o tahsilin maddesi A 101.02; ayrı kapanış maddesi yok). Değilse (açılış onarımının
    // "eski sürüm" kapanışı) kapanış tarihinde B 101.01 / A 101.02.
    if (collections && has("fin_events")) {
      out.chequeCollections = all(
        `SELECT k.id, k.rowid AS seq, k.status, k.given_date AS givenDate, k.closed_date AS closedDate, k.close_event_id AS closeEventId, c.serial_no AS serialNo, c.instrument AS instrument,
                COALESCE(NULLIF((SELECT f.try_minor FROM fin_events f WHERE f.id = k.event_id), 0), CAST(ROUND(c.amount * 100) AS INTEGER)) AS amountMinor,
                CASE WHEN k.status = 'collected' AND k.close_event_id <> '' AND EXISTS (SELECT 1 FROM cheque_events ev WHERE ev.cheque_id = k.cheque_id AND +ev.kind = 'collect' AND ev.event_id = k.close_event_id) THEN 1 ELSE 0 END AS closedByCollect
         FROM cheque_collections k ${J} cheques c ON c.id = k.cheque_id AND c.deleted_at IS NULL${filter ? ` WHERE ${set?.cheques ? `k.cheque_id IN ${set.cheques}` : "0"}` : ""}`,
        wanted(set?.cheques),
      );
    }
    // Şüpheli Ticari Alacaklar (2.3.0 İz 1; plan §3.11b; lib/bank/doubtful.mjs): kayıtlar ve karşılıklar — süzgeçte yalnız dokunulan carilerinki
    // (carinin bütün satırlarıyla; yalnız para satırı / evrak / fatura süzgecinde yüklenmez: ayırma carinin tam geçmişini ister, o denetimler
    // kontrol hesabına bakmaz).
    if (!filter || set?.parties) out.doubtful = doubtfulRows(store, { parties: filter ? filter.parties : null });
    // 2.4.3 MM3: KDV Mahsup Fişleri (etkin ve geri alınmış; geri alınanın ters kaydı aynı gün). Süzgeçli kurulumda (kapının dokunulan varlıkları)
    // yüklenmez: mahsup tablosuna yazım tam kapıya düşer (integrity-scope "kapsam dışı").
    if (!filter && has("vat_offsets")) out.vatOffsets = store.all("SELECT id, rowid AS seq, month, date, out_minor AS outMinor, in_minor AS inMinor, carry_in_minor AS carryInMinor, carry_out_minor AS carryOutMinor, payable_minor AS payableMinor, status FROM vat_offsets ORDER BY date, created_at, rowid");
    // 2.5.0 Ç2: saklanan fiş defteri (lib/ledger-vouchers.mjs; tek toplu sorgu). Süzgeçli kurulumda yüklenmez (KDV mahsubu gibi): fiş yazımı her zaman tam kapıya
    // düşer (integrity-scope FULL_TABLES). Alt defter hesabına (beklenen bakiyesi olan her hesap: cari kontrol hesapları dahil) fiş yazılmaz — Ç2 tur 1: fiş denetiminde
    // 400 (aşağıda subledgerAccounts); kapı ikinci katman (C2-FIS-DEFTERI-TASARIM.md §11).
    if (!filter) out.vouchers = voucherJournalRows(store);
    return out;
  }
  // 2.5.0 Ç5-A: carisiz evrakın karşı hesabı journal()'da (açılış evrakı 519, formdan carisiz 649.90 / 770.90 — S49); 2.4.9'da burada 602 / 770'e çevriliyordu.
  function build(filter = null) {
    const entries = journal(rows(filter));
    // YALNIZ TEST (test/donmus-defter-250.test.mjs): kural değişikliği benzetimi — canlı türetmenin çıktısı değiştirilir (sürüm yükseltmesi). Üretimde kanca yok.
    return __testLedgerRule?.fn ? __testLedgerRule.fn(entries) : entries;
  }
  // 2.5.0 Ç3 — kilitli dönemin donmuş defteri (lib/ledger-snapshots.mjs; docs/erp/C3-DONDURMA-TASARIM.md). Kilit iki yoldan değişir (PUT period-lock ve fişlerin postAll
  // lockThrough'u); ikisi de lockChanged'i kilitle aynı işlemde çağırır.
  const snapshots = createLedgerSnapshots({
    store, period, now, build: () => build(), integrity, events, log, dbPath: config?.dbPath || "", batchLines: freezeBatchLines || 500, hook: __testFreezeHook,
    canWrite: () => !schemaGate && canWriteInBackground() !== false,
    // Ç5-A tur 2b İş 2: "Düzeltildi" hesabı alt defter hesaplarını (fişe yazılmaz) bilir; subledgerAccounts aşağıda tanımlı (çağrı anında hazır).
    subledger: () => subledgerAccounts(),
  });
  /**
   * Karma yevmiye (Yevmiye Defteri, Hesap Planı Mizanı, Ç6 raporları): kilitli dönem donmuş defterden, açık dönem canlı türetmeden. to ≤ kapsam ise canlı türetme yapılmaz.
   * Mutabakat (alt defter ↔ ana defter) ve kapı canlı türetmeyle (check(), build()) — alt defterler güncel kuralla.
   */
  const book = ({ from = "", to = "", live = null } = {}) => snapshots.book({ from, to, live });
  // Alt defterlerin kendi hesabı (beklenen bakiyeler): Kasa ve Banka yola göre, cariler türe göre, portföy durumuna göre.
  // accountList (v2.0.22): mutabakat denetimi aynı anda (aynı veriyle) cari listesini zaten hesapladıysa yeniden hesaplanmaz.
  // v2.1.0 (K5, §3.11): Kasa ve banka tarafı TEK KAYNAKTAN (lib/bank/money-lines.mjs) yol bazında: 100 = nakit, 102 = havale, 108 = POS,
  // 309 = kurumsal kart, 300 = kredi. 300/309 satırı yalnız kullanıldığında (kart/kredi hesabı tanımlı ya da hareketi var) açılır: banka
  // kullanmayan kurulumun Defter Mutabakatı ve Mutabakat Testi'nin denetim listesi 2.0.26 ile aynı kalır. Tanınmayan yol hiçbir beklenene
  // girmez (yevmiye onu 100'e yazar; fark 2.0.26'daki gibi görünür ve money:method yakalar).
  const groupsOf = () => (money ? money.groups() : []);
  // every (2.5.0 Ç2 tur 1): yalnız kullanılınca açılan satırlar (309, 300, 121 / 321, 190, 128 / 129) de açılır — "bu kurulumda hangi hesaplar bir alt defterin hesabıdır"
  // sorusunun yanıtı (subledgerAccounts; fiş koruması). Tutarlar every kipinde kullanılmaz (accountList ve groups boş verilir). Mutabakat her zaman every'siz çağırır.
  function expected(accountList = null, groups = groupsOf(), { every = false } = {}) {
    const way = name => groups.filter(group => group.way === name).reduce((sum, group) => sum + Number(group.cents), 0);
    const used = kind => has("bank_accounts") && Boolean(store.get("SELECT 1 AS found FROM bank_accounts WHERE kind = ? LIMIT 1", kind));
    const out = { 100: roundMoney(way("cash") / 100), 102: roundMoney(way("bank") / 100), 108: roundMoney(way("card") / 100), 120: 0, 320: 0, 336: 0 };
    if (every || used("card") || groups.some(group => group.way === "ccard")) out[309] = roundMoney(way("ccard") / 100);
    if (every || used("loan") || groups.some(group => group.way === "loan")) out[300] = roundMoney(way("loan") / 100);
    const list = accountList || (accounts()?.list ? accounts().list({ id: "ledger", role: "admin", permissions: [] }, { status: "all" }).accounts : []);
    for (const account of list) {
      const code = { customer: "120", supplier: "320", other: "336" }[account.type] || "120";
      out[code] = roundMoney(out[code] + (Number(account.balance) || 0));
    }
    // Çek/senet alt defteri (2.2.0 İz 4.2, plan §3.11a): portföydeki alınan çek 101, senet 121; ödenecek verilen çek 103, senet 321. 121/321
    // satırı yalnız senet girilmişse (silinmiş olsa da) açılır: senet kullanmayan kurulumun Defter Mutabakatı ve Mutabakat Testi'nin denetim
    // listesi 2.1.0 ile aynı kalır (300/309 kuralı gibi). Senedi olmayan veride yevmiye 121/321'e satır yazmaz.
    if (has("cheques")) {
      const live = "deleted_at IS NULL";
      const sums = store.get(
        `SELECT COALESCE(SUM(CASE WHEN ${live} AND direction = 'in' AND status = 'portfolio' AND instrument <> 'note' THEN amount END), 0) AS c101,
                COALESCE(SUM(CASE WHEN ${live} AND direction = 'in' AND status = 'portfolio' AND instrument = 'note' THEN amount END), 0) AS c121,
                COALESCE(SUM(CASE WHEN ${live} AND direction = 'out' AND status = 'pending' AND instrument <> 'note' THEN amount END), 0) AS c103,
                COALESCE(SUM(CASE WHEN ${live} AND direction = 'out' AND status = 'pending' AND instrument = 'note' THEN amount END), 0) AS c321,
                COALESCE(MAX(instrument = 'note'), 0) AS notes
         FROM cheques`,
      );
      out[101] = roundMoney(sums.c101);
      out[103] = -roundMoney(sums.c103);
      if (every || Number(sums.notes)) {
        out[121] = roundMoney(sums.c121);
        out[321] = -roundMoney(sums.c321);
      }
    }
    // Taksit alt defteri — carisiz (ya da carisi silinmiş) kartların kalan alacağı: kart tutarı − net tahsilat; kapatılan
    // kartın kalanı vazgeçilen alacaktır (sıfırlanır). Carili kartların alacağı cari bakiyesinin içindedir (120/320/336).
    if (has("plans")) {
      let open = 0;
      for (const plan of store.all(
        `SELECT p.total, p.status, p.covers_balance AS coversBalance,
                COALESCE((SELECT SUM(CASE WHEN e.kind = 'in' THEN e.amount ELSE -e.amount END) FROM plan_entries e WHERE e.plan_id = p.id), 0) AS paid
         FROM plans p LEFT JOIN accounts a ON a.id = p.account_id AND a.deleted_at IS NULL WHERE p.deleted_at IS NULL AND a.id IS NULL`,
      )) {
        const total = plan.coversBalance ? 0 : Number(plan.total) || 0;
        const left = roundMoney((Number(plan.total) || 0) - (Number(plan.paid) || 0));
        open = roundMoney(open + total - (Number(plan.paid) || 0) - (plan.status === "closed" ? Math.max(0, left) : 0));
      }
      out[127] = open;
    }
    // Vergi hesapları (v2.0.15) — fatura alt defterinin kendi toplamları: 191 İndirilecek KDV (alış − alıştan iade), 391
    // Hesaplanan KDV (satış − satıştan iade; tevkifat düşülmüş), 360 tevkifat ve stopaj (alıcı olarak kestiklerimiz),
    // 193 stopaj (müşterinin bizden kestiği). Borç bakiyesi artı.
    if (has("invoices")) {
      const sums = store.get(
        `SELECT COALESCE(SUM(CASE kind WHEN 'purchase' THEN CAST(ROUND(try_vat * 100) AS INTEGER) WHEN 'purchase_return' THEN -CAST(ROUND(try_vat * 100) AS INTEGER) END), 0) AS v191,
                COALESCE(SUM(CASE WHEN kind IN ('sale', 'smm') THEN -(CAST(ROUND(try_vat * 100) AS INTEGER) - CAST(ROUND(try_withheld * 100) AS INTEGER))
                                  WHEN kind = 'sale_return' THEN CAST(ROUND(try_vat * 100) AS INTEGER) - CAST(ROUND(try_withheld * 100) AS INTEGER) END), 0) AS v391,
                COALESCE(SUM(CASE kind WHEN 'purchase' THEN -(CAST(ROUND(try_withheld * 100) AS INTEGER) + CAST(ROUND(try_stoppage * 100) AS INTEGER))
                                       WHEN 'purchase_return' THEN CAST(ROUND(try_withheld * 100) AS INTEGER) + CAST(ROUND(try_stoppage * 100) AS INTEGER) END), 0) AS v360,
                COALESCE(SUM(CASE WHEN kind IN ('sale', 'smm') THEN CAST(ROUND(try_stoppage * 100) AS INTEGER) END), 0) AS v193
         FROM invoices i WHERE i.status = 'issued' AND EXISTS (SELECT 1 FROM accounts a WHERE a.id = i.account_id AND a.deleted_at IS NULL)`,
      );
      out[191] = roundMoney(sums.v191 / 100);
      out[391] = roundMoney(sums.v391 / 100);
      out[360] = roundMoney(sums.v360 / 100);
      out[193] = roundMoney(sums.v193 / 100);
    }
    // 2.4.3 MM3 — Vergi Ödemesi ve KDV Mahsup Fişi (ikinci yükleyici: kendi tablolarından SQL; yevmiye general-ledger'ın kuralıyla). 360: bankadan
    // ödenen vergi (Banka Fişi satırı, ters kaydı dahil) + Kasa'dan ödenen vergi (cash_entries.tax_json) borç; etkin mahsubun ödenecek KDV'si alacak.
    // 391 / 191: etkin mahsubun ayı kapatan tutarları; 190 (yalnız mahsup kullanılmışsa satır açılır): yeni devreden − kullanılan devreden.
    if (has("bank_lines")) {
      const paid = store.get("SELECT COALESCE(SUM(CASE side WHEN 'D' THEN try_minor ELSE -try_minor END), 0) AS n FROM bank_lines WHERE gl = '360'").n;
      if (paid) out[360] = roundMoney((out[360] || 0) + paid / 100);
    }
    if (store.all("PRAGMA table_info(cash_entries)").some(column => column.name === "tax_json")) {
      const paid = store.get("SELECT COALESCE(SUM(CAST(json_extract(tax_json, '$.taxMinor') AS INTEGER)), 0) AS n FROM cash_entries WHERE tax_json <> '' AND kind = 'out' AND json_valid(tax_json)").n;
      if (paid) out[360] = roundMoney((out[360] || 0) + paid / 100);
    }
    if (has("vat_offsets") && (every || store.get("SELECT 1 AS found FROM vat_offsets LIMIT 1"))) {
      const v = store.get("SELECT COALESCE(SUM(out_minor), 0) AS o, COALESCE(SUM(in_minor), 0) AS i, COALESCE(SUM(carry_out_minor - carry_in_minor), 0) AS c, COALESCE(SUM(payable_minor), 0) AS p FROM vat_offsets WHERE status = 'active'");
      out[391] = roundMoney((out[391] || 0) + v.o / 100);
      out[191] = roundMoney((out[191] || 0) - v.i / 100);
      out[190] = roundMoney(v.c / 100);
      out[360] = roundMoney((out[360] || 0) - v.p / 100);
    }
    // Banka Fişi'nin stopaj satırı (faizden kesilen; §3.11): 193'e eklenir.
    if (has("bank_lines")) {
      const stoppage = store.get("SELECT COALESCE(SUM(CASE side WHEN 'D' THEN try_minor ELSE -try_minor END), 0) AS n FROM bank_lines WHERE gl = '193'").n;
      if (stoppage) out[193] = roundMoney((out[193] || 0) + stoppage / 100);
    }
    // Şüpheli Ticari Alacaklar (2.3.0 İz 1; plan §3.11b/4 "128 = Σ etkin şüpheli − kapananlar; 129 = Σ karşılık − çözülen"): ikinci yükleyici
    // (SQL alacak satırları + aynı ayırma kuralı; lib/bank/doubtful.mjs). Carinin kontrol hesabı (120/320/336) kalan şüpheli kadar düşer (cari
    // kartı bakiyesi değişmez: 120 + 128 = kart). 128/129 satırı yalnız şüpheli alacak kullanılmışsa açılır (300/309, 121/321 kuralı).
    if (every || doubtfulUsed(store)) {
      const d = doubtfulExpected(store);
      for (const [control, minor] of d.byControl) out[control] = roundMoney((out[control] || 0) - minor / 100);
      out[DOUBTFUL_GL.doubtful] = roundMoney(d.openMinor / 100);
      out[DOUBTFUL_GL.provision] = -roundMoney(d.provisionMinor / 100);
    }
    return out;
  }
  // Alt hesap beklenenleri (§3.11 bank:sub): tek kaynağın (yol, hesap) grupları yevmiyeyle aynı kuralla (moneyAccount) alt hesaba.
  function expectedSubs(groups = groupsOf(), refList = refs()) {
    const out = new Map();
    for (const group of groups) {
      if (!["bank", "card", "ccard", "loan"].includes(group.way)) continue;
      const { sub } = moneyAccount(group.way === "ccard" ? "card" : group.way, group.ref, refList);
      if (sub) out.set(sub, (out.get(sub) || 0) + Number(group.cents));
    }
    return out;
  }
  // book (2.5.0 Ç3): mizan karma yevmiyeden (kilitli dönem donmuş); mutabakat her zaman canlı türetmeyle.
  function check({ from = "", to = "", accountList = null, book: useBook = false } = {}) {
    const entries = build();
    // Karma mizan: donmuş dönem SQL toplamıyla (snapshots.trial; trialBalance(book()) ile aynı sonuç).
    const trial = useBook ? snapshots.trial({ from, to, live: entries }) : trialBalance(entries, { from, to });
    const groups = groupsOf();
    // Mutabakat tüm zamanlarla yapılır (alt defter bakiyeleri bugüne kadarki her şeyi içerir).
    const reconciliation = reconcile(from || to || useBook ? trialBalance(entries) : trial, expected(accountList, groups));
    return { entries, trial, reconciliation, groups };
  }
  // Alt defterlerin hesapları (2.5.0 Ç2 tur 1; fiş koruması, lib/ledger-vouchers.mjs ownedAccounts): Defter Mutabakatı'nın beklenen bakiyelerinin anahtarları, modül
  // kullanılmış olsun olmasın (every). Elle yazılmış ikinci liste yok: expected()'e yeni alt defter satırı eklenince fiş koruması da onu kapsar. Anahtarlar yalnız şemaya
  // bağlıdır (tutarlar every kipinde boş veriyle hesaplanır) → örnek başına bir kez.
  let owned = null;
  const subledgerAccounts = () => (owned ??= new Set(Object.keys(expected([], [], { every: true }))));
  // Kilitten önceki adım (2.2.0, plan §4.4/6) — PUT period-lock ve vouchers.postAll lockThrough AYNI işlev (Ç2 tur 1, madde 6): kilitlenecek döneme düşen vadesi gelmiş
  // POS kalemleri önce bankaya aktarılır; hâlâ bekleyen varsa 409 bank-pending-before-lock + liste (uyarı; "Yine de Kilitle" = force).
  const beforeLock = (target, force = false) => {
    if (target) pos()?.beforeLock?.(String(target), force === true);
  };
  router.get("/api/workspace/ledger", async ({ req, res, url }) => {
    auth.requirePermission(req, "overview.view");
    const from = text(url.searchParams.get("from"));
    const to = text(url.searchParams.get("to"));
    if ((from && !DATE.test(from)) || (to && !DATE.test(to))) throw new HttpError(400, "Geçerli bir tarih aralığı seçin.");
    const { entries, trial, reconciliation } = check({ from, to, book: true });
    ok(res, { trial, reconciliation, entryCount: entries.length });
  });
  // 2.5.0 Ç3 tur 2 (docs/erp/C3-DONDURMA-TASARIM.md §18; plan §8 "1.000.000: hedef ≤ 2 dk, İLERLEME"): kilit ucu dondurmanın bitmesini SINIRSIZ BEKLEMEZ — kilit + bekleyen koşu
  // (tek işlem) yazılınca arka iş (kapının kilit izi ayrı iş parçacığında ‖ bayat satırlar → dondurma; lockJobs) başlar, yanıt en çok LOCK_WAIT_MS bekler. 1.000.000 satırda dondurma
  // ~85 sn: beklense istemcinin 30 sn sınırı (hof-core.js sendApi) başarılı kilidi "Sunucu zamanında yanıt vermedi" diye gösterirdi. Bu arada kilitli dönem bekleyen koşunun kuralıyla
  // canlı okunur (K1). İlerleme: GET /api/workspace/ledger/lock → freeze (pending: bekleyen koşu, active: süren iş var).
  const lockJobs = new Set();
  let closing = false;
  // Yanıtın arka işi bekleme bütçesi (ms; BAŞ MİMAR KARARI önerisi T2-2). Kısa iş (küçük / orta şirket) bütçe içinde biter: yanıt dondurma + iz bittikten sonra — eski davranış aynen
  // (yanıttan sonra veri tabanına arka iş yazmaz: dondurma izi, satırlar; test/banka-230-supheli-bozma I/J "hiçbir şey yazılmaz" kilitten hemen sonra sayıların fotoğrafını çeker).
  // Uzun iş (1.000.000) bütçe dolunca yanıt, dondurma arkada, kart ilerlemeyi gösterir. Kapının kilit izi dondurmayla PARALEL ölçülür: iz "bekliyor"ken tam kapı kilitli dönemin
  // iz karşılaştırmasını (ikinci katman) yapamaz — kilitli satırı kapsam süzgecinin kilit nedeni dışından değiştiren yazım kabul edilir ve kendi (değişmiş) izini benimser
  // (test/banka-210-gg-kapi D8). 100.000 satırda iz ~2,6 sn → bütçe içinde (dondurma ~8 sn arkada); 1.000.000'da iz ~29 sn → pencere BİLİNEN SINIR §18.
  const LOCK_WAIT_MS = 5000;
  const settleWithin = (promise, ms) =>
    new Promise(resolve => {
      const timer = setTimeout(resolve, ms);
      timer.unref?.();
      promise.then(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  // active: süren iş (dondurma, bayat satır temizliği — açılıştaki de, kilit izi). cleanup: temizlik ilerlemesi (Ç3 tur 3 ORTA-1; kart gösterir, sürerken Kilitle pasif).
  function freezeView() {
    const status = snapshots.status();
    const waiting = snapshots.state().pending;
    return { ...status, pending: waiting ? { no: waiting.no, from: waiting.from, through: waiting.through, rule: waiting.rule } : null, active: Boolean(status.running || status.cleanup?.running || lockJobs.size) };
  }
  /**
   * Kilitten sonraki iki iş, PARALEL (job; uç yanıtı bunu LOCK_WAIT_MS kadar bekler): (1) kapının kilit izi ayrı iş parçacığında (digestOf); (2) bayat satırlar → bekleyen koşu
   * (dondurma; onun izi de gelince freezeRun adoptLock karşılaştırır, fark Mutabakat Günlüğü'ne). Bu arada kilit başka güne alındıysa (başka istek) iz o kilidin izi değildir,
   * benimsenmez. İz gelene kadar kapı "bekliyor"dur: kilitli döneme dokunan yazım (kapsam süzgecinin kilit nedeni) 409; bugün tarihli düzeltmeler (kilitli fişin Ters Kaydet'i)
   * bu sınıfta değildir (test K8). Hata yanıtı düşürmez: günlüğe yazılır; koşu bekler ve sonraki kilitte / açılışta sürer.
   */
  function afterLock(lockedUntil) {
    const gate = integrity();
    const still = () => !closing && Boolean(lockedUntil) && period.lockedUntil() === lockedUntil && Boolean(gate?.adoptLock) && Boolean(gate.lockPending?.(lockedUntil));
    const traced = (async () => {
      if (!still()) return;
      // YALNIZ TEST (test/donmus-defter-kilit-ucu-250.test.mjs K9): izi bütçeden uzun sürdürür (büyük şirket benzetimi). Üretimde kanca yok.
      await __testFreezeHook?.fn?.("trace", { lock: lockedUntil });
      // Kapanış başladıysa iz iş parçacığı hiç açılmaz (dosya tutamağı; Windows'ta dosya takası).
      if (!still()) return;
      const digest = await snapshots.digestOf(lockedUntil);
      if (still()) gate.adoptLock({ lock: lockedUntil, digest });
    })();
    const frozen = (async () => {
      if (closing) return;
      await snapshots.purgeStale();
      await snapshots.runPending();
    })();
    const job = Promise.allSettled([traced, frozen]).then(results => {
      for (const [index, result] of results.entries()) {
        if (result.status === "rejected") log?.warn?.(`Dönem kilidinden sonraki ${index ? "dondurma" : "kilit izi"} tamamlanamadı (${result.reason?.message || result.reason}); koşu bekliyor, sonraki kilitte ya da açılışta sürer.`);
      }
    });
    const tracked = job.finally(() => lockJobs.delete(tracked));
    lockJobs.add(tracked);
    return { job: tracked, traced: traced.catch(() => {}) };
  }
  // Dönem kilidi (v2.0.13): kilitli tarih ve öncesine hareket eklenemez/düzeltilemez/silinemez. Yalnız yönetici değiştirir.
  router.get("/api/workspace/ledger/lock", async ({ req, res }) => {
    auth.requirePermission(req, "overview.view");
    ok(res, { lockedUntil: period?.lockedUntil() || "", today: period?.today() || "", frozenThrough: snapshots.coverage(), freeze: freezeView() });
  });
  router.put("/api/admin/period-lock", async ({ req, res }) => {
    const user = auth.requirePermission(req, "system.manage");
    if (!period) throw new HttpError(503, "Dönem kilidi hazır değil.");
    const body = await readJson(req);
    // Yanıt bütçesi (LOCK_WAIT_MS) bütün uca: bayat satır temizliği + arka iş (Ç3 tur 3 ORTA-1). Süre ölçümü (iş saati değil): tekdüze saat.
    const started = performance.now();
    const budget = () => Math.max(0, LOCK_WAIT_MS - (performance.now() - started));
    // Sıra (Ç3 tur 2, dar kontrol DÜŞÜK-1): doğrula → ön adım (POS) → süren dondurmayı durdur → kilit + koşu (tek işlem). Reddedilecek istek (geçersiz / gelecek tarih 400,
    // POS 409) hiçbir şeye dokunmaz: süren dondurma sürer.
    const target = period.checkLock(body?.lockedUntil);
    beforeLock(target, body?.force === true);
    const previous = period.lockedUntil();
    // 2.5.0 Ç3 (§4): başka güne süren dondurma durdurulur; bayat satırlar (geri çekilmiş dönem) kilitten önce parça parça silinir.
    // Ç3 tur 4 (ORTA-1): kilit DEĞİŞMİYORSA (aynı güne yeniden kaydetme) bekleyen koşu — günü kilitten önce olsa da (yeniden donma planının ilk dilimi, ilerletilmiş kilitte
    // eski kurallı koşu) — durdurulmaz; lockChanged onu sürdürür (aynı ayrım lockNeedsCleanup'ta).
    const waiting = snapshots.state().pending;
    let stopped = false;
    if (waiting && waiting.through !== target && target !== previous) {
      await snapshots.cancel();
      stopped = true;
    }
    let lockedUntil;
    try {
      // Ç3 tur 3 (ORTA-1; dar kontrol: 1.000.000 satırda "Kilidi Aç → Yeniden Kilitle" geri çekilen dönemin ~2,7 M bayat satırını kilitten önce bütçesiz siliyordu → istemcinin
      // 30 sn sınırı). Yeni koşu açılacaksa ve kapsamın üstünde satır varsa temizlik (tek döngü; arkada sürüyorsa ona katılır) bütçe kadar beklenir; bitmediyse 409 + neden,
      // temizlik arkada sürer, kart ilerlemesini gösterir. Kilit işleminin içinde büyük DELETE yok (ders 47). Gerekmiyorsa (geri çekme, aynı gün) hiç beklenmez.
      if (snapshots.lockNeedsCleanup(target)) {
        await settleWithin(snapshots.purgeStale().catch(error => log?.warn?.(`Donmuş defter: bayat satır temizliği tamamlanamadı (${error?.message || error}).`)), budget());
        if (snapshots.lockNeedsCleanup(target)) {
          throw new HttpError(409, "Önceki dönemin defter temizliği sürüyor; temizlik bitince yeniden kilitleyin. İlerleme bu kartta görünür.", { code: "ledger-cleanup-running", freeze: freezeView() });
        }
      }
      // Kilit + donmuş defter koşusu aynı işlemde (kilit önce, donma arkasından; yarım durumda kilitli dönem bekleyen koşunun kuralıyla canlı okunur).
      lockedUntil = store.tx(() => {
        // Kilidin İŞLEMDEKİ önceki değeri (Ç3 tur 4): yukarıdaki beklemelerde (durdurma, temizlik) başka bir istek kilidi değiştirmiş olabilir; lockChanged'in "kilit değişmedi"
        // kararı (bekleyen koşu sürer) bayat değere dayanmaz.
        const previous = period.lockedUntil();
        const value = period.setLock(target);
        snapshots.lockChanged({ previous, next: value, user, reason: "lock" });
        return value;
      });
    } catch (error) {
      // Durdurulan koşu sahipsiz kalmaz: kilit yazılamadıysa (kapı, disk) önceki bekleyen koşu arkada sürer.
      if (stopped) afterLock(period.lockedUntil());
      throw error;
    }
    audit(user, lockedUntil ? "ledger.period.locked" : "ledger.period.unlocked", "period", { previous, lockedUntil });
    // Kapının kilit izi ana iş parçacığında tam taramayla ölçülmez (önceden integrity.start(); 100.000 satırda saniyeler): iz dondurmanın / ayrı iş parçacığının anlık
    // görüntüsünden gelir, o ana kadar "bekliyor" (kilitli döneme dokunan yazım reddedilir).
    const gate = integrity();
    if (gate?.adoptLock) gate.adoptLock({ lock: lockedUntil, digest: null });
    else gate?.start?.();
    // Yanıt arka iş (iz ‖ dondurma) bitince — bütçenin kalanı kadar (en çok LOCK_WAIT_MS); uzun işte iş arkada sürer.
    await settleWithin(afterLock(lockedUntil).job, budget());
    ok(res, { lockedUntil, frozenThrough: snapshots.coverage(), freeze: freezeView() });
  });
  // 2.5.0 Ç2 — saklanan fiş defteri (lib/ledger-vouchers.mjs). Kapanış / açılış / eşleştirme fişlerini Ç3, Ç5 ve D4 iç API'yle (vouchers) yazar; kullanıcıya serbest
  // fiş girişi YOK (2.5.1). Fişler Yevmiye Defteri ve Hesap Planı Mizanı'nda görünür (ayrı ekran 2.5.1). Uçlar dönem kilidini koyabilen yetkiyle (system.manage):
  //   GET  /api/admin/ledger/vouchers?from=&to=&type=   → fişler (satırlarıyla)
  //   POST /api/admin/ledger/vouchers/:id/reverse        → ters kayıt fişi (R-03); gövde { date?, description?, requestId } ya da başlık x-hof-request
  const vouchers = createLedgerVouchers({ store, period, now, onLockChanged: change => snapshots.lockChanged({ ...change, sync: true }), ownedAccounts: subledgerAccounts, beforeLock });
  router.get("/api/admin/ledger/vouchers", async ({ req, res, url }) => {
    auth.requirePermission(req, "system.manage");
    const from = text(url.searchParams.get("from"));
    const to = text(url.searchParams.get("to"));
    const type = text(url.searchParams.get("type"));
    if ((from && !DATE.test(from)) || (to && !DATE.test(to))) throw new HttpError(400, "Geçerli bir tarih aralığı seçin.", { code: "date-invalid" });
    if (type && !Object.hasOwn(VOUCHER_TYPES, type)) throw new HttpError(400, "Fiş türü geçerli değil.", { code: "voucher-type" });
    ok(res, { vouchers: vouchers.list({ from, to, type }) });
  });
  router.post("/api/admin/ledger/vouchers/:id/reverse", async ({ req, res, params }) => {
    const user = auth.requirePermission(req, "system.manage");
    const body = (await readJson(req)) || {};
    const requestId = text(req.headers["x-hof-request"]) || text(body.requestId);
    if (!REQUEST_ID.test(requestId)) throw new HttpError(400, "İstek kimliği gerekli.", { code: "request-id-invalid" });
    const voucher = vouchers.reverse(user, text(params.id), { date: text(body.date), description: body.description, requestKey: `api:${requestId}` });
    if (!voucher.replayed) events?.publish?.("workspace.changed", { kind: "ledger", actorId: user.id, actorName: user.display_name }, { except: user.id });
    ok(res, { voucher, replayed: voucher.replayed === true });
  });
  // 2.5.0 Ç5-A tur 2b İş 2 — Kural Farkı Düzeltme Fişi (docs/erp/C5-ACILIS-TASARIM.md §3.3, §17.8; KG-15 A; EK-1 M7; BAŞ MİMAR B14 (a), B16; KULLANICI S76 = A, S164 = C):
  //   GET  /api/admin/ledger/rule-diff-correction  → ön izleme: kilit, fiş tarihi (kilit + 1), satırlar (düzeltilmemiş kalan), dışarıda kalan alt defter farkı, farkı doğuran
  //                                                   maddeler (hangi kayıt, hangi hesap), yazılmış düzeltmeler, pasiflik nedeni, satırların imzası
  //   POST /api/admin/ledger/rule-diff-correction  → { requestId, digest, confirm: true }: imza ön izlemeninkiyle aynıysa fiş (rule-diff-correction, olağan sınıf) yazılır
  // Yetki system.manage (fiş defteri ve dönem kilidiyle aynı). Kural Farkı kapıda koşmaz; fiş Ç2'nin post sözleşmesiyle (kilit, ileri tarih, alt defter hesabı, istek kimliği).
  const SHOWN_SOURCES = 500;
  const accountName = code => ACCOUNT_PLAN[code]?.ad || CHART[code] || code;
  function lockedCandidates(lock) {
    if (!lock || !has("account_entries") || !hasColumn("account_entries", "opening_review")) return 0;
    return Number(store.get("SELECT COUNT(*) AS n FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL WHERE e.opening_review = 'candidate' AND e.date <= ?", lock)?.n) || 0;
  }
  function correctionView() {
    const lock = period?.lockedUntil() || "";
    const today = period?.today() || "";
    const cover = snapshots.coverage();
    const pendingFreeze = snapshots.state().pending;
    const date = lock ? nextDayOf(lock) : "";
    const posted = postedRuleDiffCorrections(store);
    const diff = cover && !pendingFreeze ? snapshots.ruleDiff({ detail: true }) : { through: cover, count: 0, sample: [], balances: [], entries: [] };
    const year = Number(date.slice(0, 4)) || Number(String(today).slice(0, 4));
    const plan = ruleDiffCorrectionPlan({ diff, subledger: subledgerAccounts(), year, posted: posted.net });
    const candidates = lockedCandidates(lock);
    let reason = "";
    let code = "";
    if (!lock) [reason, code] = ["Dönem kilidi yok; düzeltilecek kilitli dönem farkı yok.", "rule-diff-no-lock"];
    else if (pendingFreeze || cover !== lock) [reason, code] = ["Kilitli dönemin defteri dondurulurken düzeltme fişi yazılmaz; dondurma bitince yeniden açın.", "rule-diff-freezing"];
    else if (candidates) [reason, code] = [`Önce Açılış Olabilir listesini tamamlayın: kilitli dönemde onay bekleyen ${candidates} kayıt var (Cariler › Açılış Olabilir Kayıtlar).`, "rule-diff-candidates"];
    else if (!plan.lines.length) [reason, code] = [posted.active.length ? "Fişle düzeltilebilen fark kalmadı." : "Düzeltilecek kural farkı yok.", "rule-diff-nothing"];
    else if (date > today) [reason, code] = ["Kilit bugünün tarihinde; düzeltme fişi yarın yazılabilir.", "rule-diff-lock-today"];
    const lines = plan.lines.map(line => ({ ...line, name: accountName(line.account) }));
    const digest = createHash("sha256").update(JSON.stringify({ date, lines: plan.lines })).digest("hex").slice(0, 32);
    const sources = plan.sources.slice(0, SHOWN_SOURCES).map(item => ({ ...item, deltas: item.deltas.map(delta => ({ ...delta, name: accountName(delta.account) })) }));
    return {
      lockedUntil: lock, frozenThrough: cover, today, date, count: diff.count, lines, digest,
      totalMinor: plan.lines.reduce((sum, line) => sum + line.debit, 0),
      excluded: plan.excluded.map(row => ({ ...row, name: accountName(row.account), reason: "Alt defter hesabı: bakiyesi kendi modülünün kayıtlarından gelir, fişle düzeltilmez (Kilidi Aç → Yeniden Kilitle ile kilitli dönem güncel kuralla yeniden donar)." })),
      sources, sourceCount: plan.sources.length, candidates,
      vouchers: posted.active.map(voucher => ({ ...voucher, noText: vouchers.voucherNoText(voucher.year, voucher.no) })),
      disabled: Boolean(reason), reason, code,
    };
  }
  router.get("/api/admin/ledger/rule-diff-correction", async ({ req, res }) => {
    auth.requirePermission(req, "system.manage");
    ok(res, correctionView());
  });
  router.post("/api/admin/ledger/rule-diff-correction", async ({ req, res }) => {
    const user = auth.requirePermission(req, "system.manage");
    const body = (await readJson(req)) || {};
    const requestId = text(req.headers["x-hof-request"]) || text(body.requestId);
    if (!REQUEST_ID.test(requestId)) throw new HttpError(400, "İstek kimliği gerekli.", { code: "request-id-invalid" });
    const requestKey = `api:rule-diff:${requestId}`;
    // Yinelenen istek (ağ, çift tıklama): ilk fiş döner (yeniden plan kurulmaz — fiş yazıldıktan sonra kalan fark yoktur).
    const seen = store.get("SELECT id FROM ledger_vouchers WHERE request_key = ?", requestKey);
    if (seen) return ok(res, { voucher: { ...vouchers.get(seen.id), replayed: true }, replayed: true });
    if (body.confirm !== true) throw new HttpError(400, "Fiş, ön izlemedeki satırlar onaylanarak yazılır.", { code: "rule-diff-confirm" });
    const view = correctionView();
    if (view.disabled) throw new HttpError(view.code === "rule-diff-lock-today" ? 400 : 409, view.reason, { code: view.code });
    // S164 = C + iki kişi aynı anda: kullanıcı ön izlemede gördüğü satırları onaylar; arada fark değiştiyse (başka fiş, aday kararı, kayıt) yazılmaz.
    if (text(body.digest) !== view.digest) throw new HttpError(409, "Ön izlemeden sonra kural farkı değişti; ön izlemeyi yenileyip satırları yeniden gözden geçirin.", { code: "rule-diff-changed" });
    const voucher = vouchers.post(user, {
      type: "rule-diff-correction", date: view.date, description: `Kural Değişikliği Farkı (Kilitli Dönem: ${view.lockedUntil.split("-").reverse().join(".")} ve Öncesi)`,
      source: "Kural Farkı Düzeltme", requestKey, lines: view.lines.map(({ account, sub, debit, credit }) => ({ account, sub, debit, credit })),
    });
    if (!voucher.replayed) events?.publish?.("workspace.changed", { kind: "ledger", actorId: user.id, actorName: user.display_name }, { except: user.id });
    ok(res, { voucher, replayed: voucher.replayed === true });
  });
  // Mutabakat testi (tüm denetimler) ve geri alınan işlemlerin günlüğü.
  router.get("/api/workspace/ledger/integrity", async ({ req, res }) => {
    auth.requirePermission(req, "overview.view");
    const service = integrity();
    if (!service) throw new HttpError(503, "Mutabakat katmanı hazır değil.");
    // v2.1.0 (§3.11): Mutabakat Testi tam taramadır — kapının görmediği yeni sapma integrity_log'a ("scan") ve zile yazılır.
    const result = service.scan ? service.scan().result : service.run();
    ok(res, { ...result, log: service.recent(50).map(logRow) });
  });
  // Gözden geçirme B8 (Aşama 2): carinin yevmiyedeki kontrol hesabı (120/320/336) bakiyesi — partyBalances(journal(rows({ parties })))
  // ile AYNI kural, SQL toplamıyla (kuruş tamsayısı). Mutabakat kapısının süzgeci hareketi çok (binlerce satır) olan carilerde bunu
  // kullanır: carinin bütün satırlarının yevmiye maddesi kurulmadan (30.000 satırlı caride ~230 ms → ~10 ms). İki yolun eşitliği
  // test/banka-210-gg-cari.test.mjs'te (her cari, karışık veri) denetlenir. Yalnız silinmemiş cariler (yevmiye de onları okur).
  //   cari satırı: fatura kaynaklı borç/alacak satırı faturanın kendisinden gelir (0); çek ve stok kaynaklı: borç +, diğer −;
  //                elle: borç/ödeme +, alacak/tahsilat −
  //   taksit kartı: Mevcut Borcu taksitlendirmeyen kart + tutar; kapatılmış kart − vazgeçilen kalan; tahsilat −, iade +
  //   fatura (kesilmiş): satış/SMM/alıştan iade + ödenecek, satıştan iade/alış − ödenecek
  function partyTotals(ids) {
    const list = JSON.stringify([...ids]);
    const c = column => `CAST(ROUND(${column} * 100) AS INTEGER)`;
    const out = new Map();
    if (!has("accounts")) return out;
    const parts = [
      has("account_entries") ? `COALESCE((SELECT SUM(CASE
          WHEN e.source = 'invoice' AND e.kind IN ('debt', 'credit') THEN 0
          WHEN e.source IN ('cheque', 'stock') THEN CASE WHEN e.kind = 'debt' THEN ${c("e.amount")} ELSE -${c("e.amount")} END
          WHEN e.kind IN ('debt', 'out') THEN ${c("e.amount")}
          WHEN e.kind IN ('credit', 'in') THEN -${c("e.amount")}
          ELSE 0 END) FROM account_entries e WHERE e.account_id = a.id), 0)` : "0",
      has("plans") ? `COALESCE((SELECT SUM(CASE WHEN p.covers_balance THEN 0 ELSE ${c("p.total")} END
          - CASE WHEN p.status = 'closed' THEN MAX(0, ${c(`(p.total - COALESCE((SELECT SUM(CASE WHEN x.kind = 'in' THEN x.amount ELSE -x.amount END) FROM plan_entries x WHERE x.plan_id = p.id), 0))`)}) ELSE 0 END)
          FROM plans p WHERE p.account_id = a.id AND +p.deleted_at IS NULL), 0)` : "0",
      has("plans") && has("plan_entries") ? `COALESCE((SELECT SUM(CASE WHEN pe.kind = 'in' THEN -${c("pe.amount")} ELSE ${c("pe.amount")} END) FROM plans p CROSS JOIN plan_entries pe ON pe.plan_id = p.id WHERE p.account_id = a.id AND +p.deleted_at IS NULL), 0)` : "0",
      has("invoices") ? `COALESCE((SELECT SUM(CASE WHEN ${c("i.try_payable")} <= 0 THEN 0 WHEN i.kind IN ('sale', 'smm', 'purchase_return') THEN ${c("i.try_payable")} WHEN i.kind IN ('sale_return', 'purchase') THEN -${c("i.try_payable")} ELSE 0 END) FROM invoices i WHERE i.account_id = a.id AND +i.status = 'issued'), 0)` : "0",
    ];
    for (const row of store.all(`SELECT a.id, ${parts.join(" + ")} AS cents FROM json_each(?) j CROSS JOIN accounts a ON a.id = j.value WHERE +a.deleted_at IS NULL`, list)) out.set(row.id, Number(row.cents) || 0);
    return out;
  }
  /** Carinin yevmiyeye giren satır sayısı (cari satırı + fatura + taksit tahsilatı): süzgecin "çok hareketli cari" eşiği için. */
  function partyRowCounts(ids) {
    const list = JSON.stringify([...ids]);
    const parts = [has("account_entries") ? "(SELECT COUNT(*) FROM account_entries e WHERE e.account_id = j.value)" : "0", has("invoices") ? "(SELECT COUNT(*) FROM invoices i WHERE i.account_id = j.value)" : "0", has("plans") && has("plan_entries") ? "(SELECT COUNT(*) FROM plans p CROSS JOIN plan_entries pe ON pe.plan_id = p.id WHERE p.account_id = j.value)" : "0"];
    return new Map(store.all(`SELECT j.value AS id, ${parts.join(" + ")} AS n FROM json_each(?) j`, list).map(row => [row.id, Number(row.n) || 0]));
  }
  // Kapanış (app.close, açılış geri alması; Ç3 tur 2): süren dondurma durur (snapshots.close) ve kilitten sonraki arka iş (afterLock) biter — iz iş parçacığı dosyayı tutarken
  // bağlantı kapanmaz (Windows'ta geri yükleme / silme dosya takası, ders 48). Öbür iç API aynen (server.app.ledger.snapshots).
  const exposed = {
    ...snapshots,
    async close() {
      closing = true;
      await snapshots.close();
      await Promise.allSettled([...lockJobs]);
    },
  };
  return { build, book, check, expected, expectedSubs, refs, partyTotals, partyRowCounts, vouchers, snapshots: exposed, freezeView };
}
