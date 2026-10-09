// Mutabakat kapısının "dokunulan varlıklar" yolu (v2.1.0; docs/BANKA-MODULU-PLAN.md §3.11 "Kapı ölçeği" kararı, docs/2.1.0-KANIT.md).
//
// Neden: tam kapı (lib/integrity.mjs run) her COMMIT'te bütün defteri yeniden kurar; süre veriyle doğrusal büyür (ölçüm, tools/kapi-olcum.mjs:
// 10.000 para satırında ~0,75 sn, 100.000'de ~9 sn). Bütçe (§3.11/5): 100.000'de ≤ 150 ms, 1.000.000'da ≤ 1 sn.
//
// Ne yapar: işlemin dokunduğu satırlardan (lib/db.mjs kapı kapsamı: eklenen/düzeltilen satırlar ve UPDATE/DELETE öncesi hâlleri) dokunulan
// VARLIKLARI çıkarır — cari, taksit kartı, çek/senet, fatura, ürün, stok hareketi, para satırı (Kasa ↔ Banka ikiziyle), işlem başlığı — ve tam
// kapının her denetimini YALNIZ bu varlıklar için, aynı kuralla (aynı yevmiye kodu, aynı modül hesabı, aynı SQL koşulu) yapar:
//   para      : para satırlarının yevmiyedeki 100/102/108/309/300 (ve alt hesap) satırları = tek kaynağın (moneyLines) aynı satırları
//   cari      : her dokunulan carinin defter bakiyesi (bütün satırlarıyla) = cari kartının bakiyesi (accounts.list, aynı hesap)
//   çek/senet : dokunulan evrakın yevmiyedeki 101/103 satırları = evrakın durumu; çek ↔ cari bağı
//   kart      : carisiz kartın 127 bakiyesi; kart toplamları (plans.list); vade < Kayıt Tarihi
//   fatura    : 191/391/360/193; başlık = kalemler; TL karşılığı; cari, stok, çek, taksit bağları; mahsup; iade ≤ satış
//   stok      : ürün miktarı (stock.list) = hareketler; açık hesap ↔ cari; yetim cari satırı; miktar > 0
//   satır     : kuruş ve işaret; tarih biçimi ve ileri tarih (eski satırlar tabanla); tanınmayan yol (eski satırlar tabanla)
//   denge     : kurulan her yevmiye maddesinde borç = alacak
//   kilit     : dokunulan satır kilitli döneme (ya da kilit izine giren bir varlığa) dokunuyorsa kilit izi tam hesaplanır
// Dokunulmayan varlık bu işlemde değişmemiştir; tam kapı "işlem öncesi durum"la karşılaştırdığı için onların sonucu da değişmez.
//
// Güvenlik kuralı (§3.11 "ölçülmeden zayıflatılmaz"): bu yol yalnız bir SÜZGEÇTİR, karar vermez. Aşağıdakilerden biri olursa tam kapı aynen
// (2.0.26 kuralıyla) çalışır ve kararı o verir: dokunulan varlıkta herhangi bir sapma; açılışta (taban) sapması olan bir denetimin alanına
// dokunuluyor; kilit izine giren bir şeye dokunuluyor; kilit değişti; store dışından yazım görüldü (total_changes / data_version);
// çözülemeyen yazım (upsert, ayrıştırılamayan SQL); bilinmeyen tabloya yazım. Testlerde (config.gateVerify) tam kapı HER işlemde çalışır ve bu
// yol "temiz" deyip tam kapı reddederse test kırılır (eşdeğerlik denetimi; test/banka-210-kapi-kapsam.test.mjs).
//
// Hız kuralı: bu yolun her sorgusu dokunulan KİMLİK kümesinden başlar (veriyle büyümez; ölçüm 100.000'de ~7 ms, 1.000.000'da ~9 ms).
// İstatistiksiz SQLite planlayıcısı kolonlar arası OR'da (a IN … OR b IN …) ya da durum/silinme kolonunun indeksi (deleted_at, status,
// src_table …) seçilebildiğinde bütün tabloyu dolaşır: koşul kimlik kümesine çevrilir (id IN (… UNION …)), satır tablosu CROSS JOIN ile dış
// döngü yapılır, durum kolonu tekli + ile indeksten çıkarılır. test/banka-210-kapi-plan.test.mjs bu kuralı EXPLAIN QUERY PLAN ile denetler.
import { isMoneyRow, MODULE_TABLES } from "./bank/money-lines.mjs";
import { moneyAccount, partyBalances, subBalances } from "./general-ledger.mjs";
import { toCents } from "./money.mjs";

const AUDITOR = { id: "integrity", role: "admin", permissions: [] };
const MONEY_ACCOUNTS = new Set(["100", "102", "108", "309", "300"]);
const WAY_ACCOUNT = { cash: "100", bank: "102", card: "108", ccard: "309", loan: "300" };
// Bu tablolara yazım bu yolda henüz modellenmedi (Aşama 10+ POS, §3.14 tahsile verme): tam kapı. Banka hesap kartı (bank_accounts) Aşama 3'ten
// beri bu yolda: dokunulan hesabın açılış kuralı (bank:opening) denetlenir; hareketli hesabın türü/para birimi/alt hesabı değişirse tam kapı.
const FULL_TABLES = new Set(["pos_terminals", "pos_sales", "pos_items", "cheque_collections"]);
// Hesap kartında yevmiyeyi etkileyen alanlar (yol türetmesi ve alt hesap): değişirse karar tam kapının.
const ACCOUNT_LEDGER_FIELDS = ["kind", "gl", "gl_sub", "currency"];
// Kilit izinin (lib/integrity.mjs LOCK_SQL) satır alanları: kilitli dönemdeki satırda bunlardan biri değişirse, satır eklenir ya da silinirse iz değişir.
const LOCK_FIELDS = {
  payments: { date: row => row.date, fields: ["amount", "date", "method", "fin_ref", "event_id"] },
  cash_entries: { date: row => row.date, fields: ["kind", "amount", "date", "method", "fin_ref", "event_id"] },
  account_entries: { date: row => row.date, fields: ["account_id", "kind", "amount", "date", "method", "fin_ref", "event_id", "fx_currency", "fx_minor", "fx_rate_e6", "fx_source"] },
  stock_moves: { date: row => row.date, fields: ["item_id", "kind", "qty", "amount", "date", "pay", "method", "account_id", "fin_ref", "event_id"] },
  plan_entries: { date: row => row.date, fields: ["plan_id", "kind", "amount", "date", "method", "fin_ref", "event_id"] },
  cheque_events: { date: row => row.date, fields: ["cheque_id", "kind", "amount", "date", "method", "fin_ref", "event_id"] },
  invoices: { date: row => (row.status !== "draft" ? row.issue_date : null), fields: ["kind", "status", "account_id", "issue_date", "try_payable", "try_vat"] },
  cheques: { date: row => row.issue_date, fields: ["direction", "amount", "issue_date", "deleted_at"] },
  fin_events: { date: row => row.date, fields: ["type", "date", "reversal_of", "bank_ref", "counter_ref", "amount_minor", "try_minor"] },
};
// Cari satırının kaynakları: '' (elle), fatura, çek/senet, stok, banka (POS kesintisi, Aşama 10). Kaynaklı satır kaynağına bağlıdır.
const ENTRY_SOURCES = new Set(["", "invoice", "cheque", "stock", "bank"]);
const LINKED_SOURCES = new Set(["invoice", "cheque", "stock"]);
// Kimliği değişen satır (UPDATE … SET id): bağlı satırlar (cari, kart, ürün, kilit izi) yetim kalır; bu yol modellemez (gözden geçirme D8).
const day = value => String(value || "").slice(0, 10);
// Satırın yevmiye para hesabı (lib/general-ledger.mjs moneyAccount ile aynı kural; hesaba bağlı satırda hesabın türü bilinmez: "*").
const wayAccountOf = row => {
  if (row.fin_ref) return "*";
  const method = String(row.method ?? "");
  if (method === "" || method === "cash") return "100";
  if (method === "bank") return "102";
  if (method === "card") return "108";
  return "*";
};
const LINE_ACCOUNT = { bank: "102", pos: "108", card: "309", loan: "300" };
const MONEY_ROLES = new Set(Object.keys(LINE_ACCOUNT));
const differs = (pre, post, fields) => !pre || !post || fields.some(field => String(pre[field] ?? "") !== String(post[field] ?? ""));
const json = values => JSON.stringify([...values]);
const IN = "(SELECT value FROM json_each(?))";

/** Taban sapmasının (açılışta bulunan) denetim kodu → alanı. null: denetim eski satırları kendisi ayırır (ileri tarih, yol, olay). */
export function familyOf(code) {
  if (code === "balance") return "balance";
  if (code.startsWith("gl:")) {
    const account = code.slice(3);
    // Gözden geçirme B9 (Aşama 2): para alanı hesap bazında (varlık kodu ilkesi, E1.16): 100'deki eski bir sapma yalnız nakit satırına
    // dokunan yazımı tam kapıya gönderir; havale/POS yazımı süzgeçte kalır.
    if (MONEY_ACCOUNTS.has(account)) return `money:${account}`;
    if (account === "101" || account === "103") return "cheque";
    if (["120", "320", "336"].includes(account)) return "party";
    if (account === "127") return "plan";
    if (["191", "391", "360", "193"].includes(account)) return "invoice";
    return "all";
  }
  if (code.startsWith("bank:sub:")) return `money:${code.slice(9, 12)}`;
  if (code.startsWith("bank:sub")) return "money";
  if (code === "party:accounts") return "party";
  if (code === "party:plans" || code === "plans:totals" || code === "dates:due-before-start") return "plan";
  if (code === "stock:qty" || code === "stock:account" || code === "stock:orphan") return "stock";
  if (code.startsWith("cents:")) return `rows:${code.slice(6)}`;
  if (code === "cheque:account") return "cheque";
  if (code.startsWith("invoice:")) return "invoice";
  if (code.startsWith("dates:format:")) return `rows:${code.slice(13)}`;
  if (code.startsWith("dates:future:") || code === "money:method" || code === "money:report" || code === "money:event" || code.startsWith("bank:event")) return null;
  // Aşama 3: açılış kuralı ve fiş dengesi hesap/olay bazında; süzgeç dokunulan hesap ve olaylarda kendisi denetler (eski sapmaya dokunan yazım
  // bulgu verir → tam kapı imzayla karar verir).
  if (code.startsWith("bank:opening") || code.startsWith("bank:voucher") || code.startsWith("bank:carry")) return null;
  return "all";
}

export function createScopedGate({ store, ledger, accounts, plans, stock, money, period, now, has, hasColumn, amountColumns, dated, datedWhenUsed, legacy, bankChecks, partyRows = 2000 }) {
  const all = (sql, ...args) => store.all(sql, ...args);

  // ---------- Kapsam: dokunulan satırlar → varlıklar ----------
  function derive(capture) {
    const s = {
      reason: capture?.unknown || "",
      parties: new Set(), plans: new Set(), cheques: new Set(), invoices: new Set(), items: new Set(), moves: new Set(), transfers: new Set(), events: new Set(), entries: new Set(), offsets: new Set(),
      // Aşama 3: dokunulan banka hesapları (hesap kartı, satırın bağı, olayın hesabı, fiş satırının bağı) → açılış kuralı.
      banks: new Set(),
      money: Object.fromEntries(MODULE_TABLES.map(table => [table, new Set()])),
      rows: new Map(), // tablo → [{ pre, post }]
      visible: { parties: new Set(), items: new Set() },
    };
    if (!capture) {
      s.reason ||= "kapsam yok";
      return s;
    }
    const tables = new Set([...capture.rows.keys(), ...capture.before.keys()]);
    for (const table of tables) {
      if (FULL_TABLES.has(table)) {
        s.reason ||= `${table} yazımı`;
        continue;
      }
      const rowids = [...(capture.rows.get(table) || [])];
      const posts = new Map(rowids.length ? all(`SELECT rowid AS __rowid, * FROM ${table} WHERE rowid IN ${IN}`, json(rowids)).map(row => [row.__rowid, row]) : []);
      const pres = capture.before.get(table) || new Map();
      const list = [];
      for (const rowid of new Set([...posts.keys(), ...pres.keys()])) list.push({ pre: pres.get(rowid) || null, post: posts.get(rowid) || null });
      s.rows.set(table, list);
      for (const { pre, post } of list) if (pre && post && String(pre.id ?? "") !== String(post.id ?? "")) s.reason ||= `${table}: kimlik değişti`;
      // Hesap kartının türü / para birimi / ana ve alt hesabı değişti: bağlı satırların yolu ve alt hesabı başka hesaba geçer (rota hareketli
      // hesapta bunu reddeder; hareketsiz hesapta da karar tam kapının — seyrek iş).
      if (table === "bank_accounts") for (const { pre, post } of list) if (pre && post && differs(pre, post, ACCOUNT_LEDGER_FIELDS)) s.reason ||= "bank_accounts: hesap türü / para birimi / alt hesap";
      for (const { pre, post } of list) for (const row of [pre, post]) if (row) keys(s, table, row);
      for (const { pre, post } of list) visibility(s, table, pre, post);
    }
    return s;
  }
  function keys(s, table, row) {
    const add = (set, value) => {
      if (value) set.add(String(value));
    };
    switch (table) {
      case "accounts":
        add(s.parties, row.id);
        break;
      case "account_entries":
        add(s.parties, row.account_id);
        add(s.entries, row.id);
        if (row.source === "cheque") add(s.cheques, row.source_id);
        if (row.source === "invoice") add(s.invoices, row.source_id);
        if (row.source === "stock") add(s.moves, row.source_id);
        // Gözden geçirme B6 (Aşama 2): kaynağı (çek, stok, fatura) yazılı ama kaynak kimliği boş ya da kaynağı tanınmayan cari satırı bu yolda
        // modellenmez (bağlı olduğu varlık kümesi boş kalıyor, çek/stok/fatura bağ denetimleri hiç çalışmıyordu): karar tam kapının.
        if (!ENTRY_SOURCES.has(String(row.source ?? ""))) s.reason ||= `account_entries: tanınmayan kaynak (${row.source})`;
        else if (LINKED_SOURCES.has(row.source) && !row.source_id) s.reason ||= `account_entries: kaynak kimliği boş (${row.source})`;
        add(s.invoices, row.invoice_id);
        add(s.events, row.event_id);
        break;
      case "cash_entries":
        add(s.transfers, row.transfer_id);
        add(s.events, row.event_id);
        break;
      case "payments":
        add(s.events, row.event_id);
        break;
      case "plans":
        add(s.plans, row.id);
        add(s.parties, row.account_id);
        add(s.invoices, row.invoice_id);
        break;
      case "plan_items":
        add(s.plans, row.plan_id);
        break;
      case "plan_entries":
        add(s.plans, row.plan_id);
        add(s.cheques, row.cheque_id);
        add(s.events, row.event_id);
        break;
      case "stock_items":
        add(s.items, row.id);
        break;
      case "stock_moves":
        add(s.moves, row.id);
        add(s.items, row.item_id);
        add(s.parties, row.account_id);
        add(s.invoices, row.invoice_id);
        add(s.events, row.event_id);
        break;
      case "cheques":
        add(s.cheques, row.id);
        add(s.parties, row.account_id);
        add(s.parties, row.endorse_account_id);
        add(s.plans, row.plan_id);
        add(s.invoices, row.invoice_id);
        break;
      case "cheque_events":
        add(s.cheques, row.cheque_id);
        add(s.parties, row.account_id);
        add(s.invoices, row.invoice_id);
        add(s.events, row.event_id);
        break;
      case "invoices":
        add(s.invoices, row.id);
        add(s.invoices, row.original_id);
        add(s.parties, row.account_id);
        break;
      case "invoice_lines":
        add(s.invoices, row.invoice_id);
        add(s.items, row.item_id);
        add(s.moves, row.move_id);
        if (row.origin_line_id) {
          const origin = store.get("SELECT invoice_id AS id FROM invoice_lines WHERE id = ?", row.origin_line_id);
          add(s.invoices, origin?.id);
        }
        break;
      case "invoice_offsets":
        add(s.offsets, row.id);
        add(s.invoices, row.invoice_id);
        add(s.parties, row.account_id);
        if (row.counter_type === "invoice") add(s.invoices, row.counter_id);
        else add(s.entries, row.counter_id);
        break;
      case "fin_events":
        add(s.events, row.id);
        add(s.parties, row.party_id);
        add(s.invoices, row.invoice_id);
        add(s.plans, row.plan_id);
        add(s.cheques, row.cheque_id);
        add(s.banks, row.bank_ref);
        add(s.banks, row.counter_ref);
        break;
      case "bank_lines":
        add(s.events, row.event_id);
        add(s.banks, row.ref);
        break;
      case "bank_accounts":
        add(s.banks, row.id);
        break;
      default:
        s.reason ||= `${table} yazımı (kapsam dışı)`;
    }
    // Para satırının hesap bağı (fin_ref): o hesabın açılış kuralı (Aşama 3).
    if (s.money[table]) add(s.banks, row.fin_ref);
    // Para satırı (post: güncel hâli; silinen satır iki yoldan da düşer): tek kaynağın aynı satırları denetlenir.
    if (s.money[table] && isMoneyRow(table, row)) s.money[table].add(String(row.id));
  }
  // Görünürlük değişimi: carinin türü/silinmesi, ürünün silinmesi — o varlığın bütün satırları başka hesaba geçer ya da defterden düşer.
  function visibility(s, table, pre, post) {
    if (table === "accounts" && differs(pre, post, ["type", "deleted_at"])) s.visible.parties.add(String((post || pre).id));
    if (table === "stock_items" && differs(pre, post, ["kind", "deleted_at"])) s.visible.items.add(String((post || pre).id));
  }
  // Kapanış: görünürlüğü değişen carinin para satırları, çekleri, kartları ve faturaları; dokunulan kartın, çekin, faturanın, ürünün para
  // satırları (görünürlükleri onlara bağlı); Kasa ↔ Banka ikizi; dokunulan faturanın peşin satırları ve carisi.
  function close(s) {
    const add = (set, rows, field = "id") => {
      for (const row of rows) if (row[field]) set.add(String(row[field]));
    };
    if (s.visible.parties.size) {
      const list = json(s.visible.parties);
      add(s.money.account_entries, all(`SELECT id FROM account_entries WHERE account_id IN ${IN} AND +source IN ('', 'invoice', 'bank') AND +kind IN ('in', 'out')`, list));
      add(s.cheques, all(`SELECT source_id AS id FROM account_entries WHERE account_id IN ${IN} AND +source = 'cheque'`, list));
      add(s.cheques, all(`SELECT id FROM cheques WHERE account_id IN ${IN} UNION SELECT id FROM cheques WHERE endorse_account_id IN ${IN}`, list, list));
      add(s.plans, all(`SELECT id FROM plans WHERE account_id IN ${IN}`, list));
      add(s.invoices, all(`SELECT id FROM invoices WHERE account_id IN ${IN}`, list));
    }
    if (s.invoices.size) {
      const list = json(s.invoices);
      add(s.parties, all(`SELECT account_id AS id FROM invoices WHERE id IN ${IN}`, list));
      add(s.money.account_entries, all(`SELECT id FROM account_entries WHERE source = 'invoice' AND source_id IN ${IN} AND kind IN ('in', 'out')`, list));
      // Aşama 4: faturaya bağlı KDV'li masraf başlığı (satırsız Masraf fişi): faturanın durumu ve havale ödemesi başlığın kuralıdır
      // (bank:voucher); fatura ya da ödemesi değişince başlık da denetlenir.
      if (has("fin_events")) add(s.events, all(`SELECT id FROM fin_events WHERE invoice_id IN ${IN} AND invoice_id <> '' AND +type = 'fee' AND +src_table = ''`, list));
    }
    if (s.plans.size) {
      const list = json(s.plans);
      add(s.parties, all(`SELECT account_id AS id FROM plans WHERE id IN ${IN}`, list));
      add(s.money.plan_entries, all(`SELECT id FROM plan_entries WHERE plan_id IN ${IN} AND +cheque_id = '' AND opening = 0`, list));
      // Kartla sayılan çekin 101 satırı ve "cariye işlenmemiş evrak" durumu kartın silinmesine bağlıdır.
      add(s.cheques, all(`SELECT cheque_id AS id FROM plan_entries WHERE plan_id IN ${IN} AND +cheque_id <> ''`, list));
    }
    if (s.cheques.size) add(s.money.cheque_events, all(`SELECT id FROM cheque_events WHERE cheque_id IN ${IN} AND +kind IN ('collect', 'pay')`, json(s.cheques)));
    if (s.visible.items.size) {
      const list = json(s.visible.items);
      add(s.money.stock_moves, all(`SELECT id FROM stock_moves WHERE item_id IN ${IN} AND pay = 'cash' AND amount > 0`, list));
      add(s.moves, all(`SELECT id FROM stock_moves WHERE item_id IN ${IN}`, list));
    }
    if (s.transfers.size) add(s.money.cash_entries, all(`SELECT id FROM cash_entries WHERE transfer_id IN ${IN}`, json(s.transfers)));
    // Para satırının işlem başlığı (bank:event / money:report dokunulan olaylarla aynı).
    for (const table of MODULE_TABLES) {
      if (!s.money[table].size || !hasColumn(table, "event_id")) continue;
      add(s.events, all(`SELECT event_id AS id FROM ${table} WHERE id IN ${IN} AND +event_id <> ''`, json(s.money[table])));
    }
  }

  // ---------- Kilit: dokunulan satır kilit izine giriyor mu? (LOCK_SQL'in satır koşulları) ----------
  function lockRelevant(s, lock) {
    if (!lock) return "";
    const locked = value => Boolean(value) && day(value) <= lock;
    // Kilit izinin SQL'i "tarih <= kilit" der: boş tarih ('') de izin içindedir (yalnız NULL dışında); taslak fatura izde yoktur (null).
    const inTrace = value => value !== null && value !== undefined && day(value) <= lock;
    for (const [table, list] of s.rows) {
      const rule = LOCK_FIELDS[table];
      for (const { pre, post } of list) {
        if (rule && (inTrace(pre ? rule.date(pre) : null) || inTrace(post ? rule.date(post) : null)) && differs(pre, post, rule.fields)) return `${table} kilitli dönem`;
        if (table === "plans") {
          const plain = row => row && !row.deleted_at && Number(row.covers_balance) === 0 && row.registered_on && locked(row.registered_on);
          const closedOn = row => (row.status === "closed" && !row.deleted_at ? [day(row.closed_at || row.updated_at), day(row.registered_on || row.created_at)].sort().at(-1) : "");
          if ((plain(pre) || plain(post)) && differs(pre, post, ["total", "account_id", "registered_on", "covers_balance", "deleted_at"])) return "kart kilitli dönem";
          if ((locked(pre && closedOn(pre)) || locked(post && closedOn(post))) && differs(pre, post, ["account_id", "total", "status", "closed_at", "updated_at", "registered_on", "created_at", "deleted_at"])) return "kapatılmış kart kilitli dönem";
          const id = (post || pre).id;
          if (differs(pre, post, ["account_id", "deleted_at"]) && store.get("SELECT 1 AS found FROM plan_entries WHERE plan_id = ? AND date <= ? LIMIT 1", id, lock)) return "kartın kilitli tahsilatı";
        }
        if (table === "plan_entries") {
          // Kapatılmış kartın vazgeçilen kalanı (689) kapanış gününde yazılır; karta sonradan gelen tahsilat kilitli tutarı değiştirir.
          const plan = store.get("SELECT status, closed_at AS closedAt, updated_at AS updatedAt, registered_on AS registeredOn, created_at AS createdAt, deleted_at AS deletedAt FROM plans WHERE id = ?", (post || pre).plan_id);
          if (plan && plan.status === "closed" && !plan.deletedAt && locked([day(plan.closedAt || plan.updatedAt), day(plan.registeredOn || plan.createdAt)].sort().at(-1))) return "kapatılmış kartın tahsilatı";
        }
        if (table === "accounts" && differs(pre, post, ["type", "deleted_at"])) {
          const id = (post || pre).id;
          const found = store.get(
            `SELECT 1 AS found WHERE EXISTS (SELECT 1 FROM account_entries WHERE account_id = ?1 AND date <= ?2)
               OR EXISTS (SELECT 1 FROM plans p WHERE p.account_id = ?1 AND (p.registered_on <> '' AND p.registered_on <= ?2 OR substr(p.created_at, 1, 10) <= ?2
                          OR EXISTS (SELECT 1 FROM plan_entries pe WHERE pe.plan_id = p.id AND pe.date <= ?2)))
               OR EXISTS (SELECT 1 FROM invoices WHERE account_id = ?1 AND issue_date <= ?2)`,
            id, lock,
          );
          if (found) return "kilitli dönemde hareketi olan cari";
        }
        if (table === "bank_lines" && store.get("SELECT 1 AS found FROM fin_events WHERE id = ? AND date <= ?", (post || pre).event_id, lock)) return "kilitli banka fişi";
      }
    }
    return "";
  }

  // ---------- Denetimler (yalnız kapsamdaki varlıklar; tam kapının kuralıyla) ----------
  function evaluate(s, { lock = "", baselineFamilies = new Set() } = {}) {
    const started = performance.now();
    const sections = {};
    let lapAt = started;
    const lap = name => {
      const at = performance.now();
      sections[name] = (sections[name] || 0) + at - lapAt;
      lapAt = at;
    };
    const findings = [];
    const find = (code, detail) => findings.push({ code, detail: String(detail).slice(0, 300) });
    if (s.reason) return { full: s.reason, findings, sections, ms: performance.now() - started };
    close(s);
    lap("scope");
    const touchedRows = table => (s.rows.get(table) || []).filter(item => item.post).map(item => item.post);
    const anyMoney = Object.values(s.money).some(set => set.size) || s.events.size > 0;
    // Gözden geçirme B9 (Aşama 2): dokunulan para satırlarının (önceki ve şimdiki hâli; kapanıştaki satırlar görünürlükten bağımsız, ham
    // kolonlarından) yevmiye para hesapları. "*" = belirsiz (hesaba bağlı satır, tanınmayan yol, görünürlüğü değişen cari/ürün).
    let accountsTouched = null;
    const moneyAccounts = () => {
      if (accountsTouched) return accountsTouched;
      const out = new Set();
      if (s.visible.parties.size || s.visible.items.size) out.add("*");
      for (const [table, set] of Object.entries(s.money)) {
        if (!set.size) continue;
        const ref = hasColumn(table, "fin_ref") ? "fin_ref" : "'' AS fin_ref";
        for (const row of all(`SELECT method, ${ref} FROM ${table} WHERE id IN ${IN}`, json(set))) out.add(wayAccountOf(row));
      }
      for (const [table, list] of s.rows) {
        for (const { pre, post } of list) {
          for (const row of [pre, post]) {
            if (!row) continue;
            if (table === "bank_lines") out.add(LINE_ACCOUNT[row.role] || (MONEY_ROLES.has(row.role) ? "*" : ""));
            else if (s.money[table] && isMoneyRow(table, row)) out.add(wayAccountOf(row));
          }
        }
      }
      out.delete("");
      return (accountsTouched = out);
    };
    // Eski satır kimlikleri (açılışta kuruşu/tarihi bozuk bulunanlar; tablo → Set): bu satırlardan birine dokunmayan yazım o alanın tabanını
    // değiştiremez (süzgeç dokunulan satırların kuruşunu ve tarihini kendisi denetler).
    const legacyRows = legacy.rows?.() || new Map();
    // Taban sapması olan alan dokunuluyorsa bu yol karar veremez (sapmanın "büyümediğini" yalnız tam kapı bilir).
    const touchedFamily = family => {
      if (family === "all" || family === "balance") return true;
      if (family === "money") return anyMoney;
      if (family.startsWith("money:")) {
        if (!anyMoney) return false;
        const set = moneyAccounts();
        return set.has("*") || set.has(family.slice(6));
      }
      if (family === "party") return s.parties.size > 0;
      if (family === "cheque") return s.cheques.size > 0;
      if (family === "plan") return s.plans.size > 0;
      if (family === "invoice") return s.invoices.size > 0;
      if (family === "stock") return s.items.size > 0 || s.moves.size > 0;
      if (family.startsWith("rows:")) {
        const table = family.slice(5);
        const list = s.rows.get(table) || [];
        const bad = legacyRows.get(table);
        if (!bad) return list.length > 0;
        return list.some(({ pre, post }) => (pre && bad.has(String(pre.id))) || (post && bad.has(String(post.id))));
      }
      return true;
    };
    for (const family of baselineFamilies) if (touchedFamily(family)) return { full: `taban sapması (${family})`, findings, sections, ms: performance.now() - started };
    // Evrak bazında sapan çek/senede dokunuluyor (toplamda tutan eski durum; integrity.mjs chequeDriftOf): karar tam kapının.
    const drifting = legacy.cheques?.() || new Set();
    if (drifting.size) for (const id of s.cheques) if (drifting.has(id)) return { full: "evrak bazında eski sapma (çek/senet)", findings, sections, ms: performance.now() - started };
    const lockReason = lockRelevant(s, lock);
    lap("lock");
    const service = ledger();
    const entries = [];
    const build = filter => {
      const out = service.build(filter);
      entries.push(...out);
      return out;
    };
    const sumAccount = (list, account) => list.reduce((sum, entry) => sum + entry.lines.reduce((t, line) => t + (line.account === account ? line.debit - line.credit : 0), 0), 0);

    // Para: yevmiyenin para hesapları ve alt hesapları = tek kaynağın aynı satırları (yol ve hesap bazında).
    if (anyMoney) {
      const ids = Object.fromEntries(Object.entries(s.money).filter(([, set]) => set.size).map(([table, set]) => [table, [...set]]));
      const events = [...s.events];
      const fromLedger = build({ money: ids, events });
      const groups = money().groups({ ids, events });
      const expected = {};
      for (const group of groups) {
        const account = WAY_ACCOUNT[group.way];
        if (account) expected[account] = (expected[account] || 0) + Number(group.cents);
      }
      for (const account of MONEY_ACCOUNTS) {
        const got = sumAccount(fromLedger, account);
        if (got !== (expected[account] || 0)) find(`gl:${account}`, `defter ${got / 100} / kaynak ${(expected[account] || 0) / 100}`);
      }
      const subsLedger = subBalances(fromLedger);
      const subsSource = service.expectedSubs(groups);
      for (const sub of new Set([...subsLedger.keys(), ...subsSource.keys()])) if ((subsLedger.get(sub) || 0) !== (subsSource.get(sub) || 0)) find(`bank:sub:${sub}`, `defter ${(subsLedger.get(sub) || 0) / 100} / kaynak ${(subsSource.get(sub) || 0) / 100}`);
      // Alt hesap toplamı (Aşama 3): para hesabına alt hesapsız yevmiye satırı yok.
      for (const entry of fromLedger) for (const line of entry.lines) if (["102", "108", "309", "300"].includes(line.account) && !line.sub) find("bank:sub", `${entry.id} (${line.account})`);
      // Banka Fişi stopajı (193): yevmiye = fişin satırları.
      if (events.length && has("bank_lines")) {
        const got = sumAccount(fromLedger, "193");
        const want = Number(store.get(`SELECT COALESCE(SUM(CASE side WHEN 'D' THEN try_minor ELSE -try_minor END), 0) AS n FROM bank_lines WHERE +gl = '193' AND event_id IN ${IN}`, json(events)).n);
        if (got !== want) find("gl:193", `fiş ${got / 100} / satırlar ${want / 100}`);
      }
      // Tanınmayan yol: eski satırlar tabanla (açılıştaki kimlikler); yenisi engellenir.
      if (groups.some(group => group.way === "unknown")) {
        for (const line of money().lines({ ids, events, ways: ["unknown"], light: true })) {
          const table = line.src === 9 ? "bank_lines" : [null, "payments", "cash_entries", "account_entries", "account_entries", "account_entries", "plan_entries", "stock_moves", "cheque_events"][line.src];
          if (!legacy.method().has(`${table}:${line.id}`)) find("money:method", `${table}:${line.id}=${line.method}`);
        }
      }
      lap("money");
    }

    let heavyParties = 0;
    // Cari: dokunulan her carinin defter bakiyesi (bütün satırlarıyla) = cari kartının bakiyesi. Gözden geçirme B8 (Aşama 2): yevmiyeye
    // giren satırı eşikten (partyRows) çok olan carinin defter bakiyesi yevmiye maddeleri kurulmadan, aynı kuralın SQL toplamıyla
    // (ledger.partyTotals) hesaplanır — önceden süre carinin geçmişiyle doğrusal büyüyordu (30.000 satırlı caride ~300 ms, 100.000'de ~1,1 sn).
    if (s.parties.size && accounts()?.list) {
      const ids = [...s.parties];
      const counts = service.partyRowCounts && service.partyTotals ? service.partyRowCounts(ids) : new Map();
      const heavy = ids.filter(id => (counts.get(id) || 0) > partyRows);
      const light = heavy.length ? ids.filter(id => !heavy.includes(id)) : ids;
      const balances = light.length ? partyBalances(build({ parties: light })) : new Map();
      if (heavy.length) for (const [id, cents] of service.partyTotals(heavy)) balances.set(id, cents);
      heavyParties = heavy.length;
      const list = accounts().list(AUDITOR, { status: "all", ids: [...s.parties] }).accounts;
      const seen = new Set();
      for (const account of list) {
        seen.add(account.id);
        const d = (balances.get(account.id) || 0) - toCents(account.balance);
        if (d) find("party:accounts", `${account.refNo || account.id} ${account.name}: defter ${(balances.get(account.id) || 0) / 100} / kart ${account.balance}`);
      }
      for (const [party, value] of balances) if (s.parties.has(party) && !seen.has(party) && value) find("party:accounts", `${party}: listede yok, defterde ${value / 100}`);
      lap("party");
    }

    // Çek/senet: dokunulan evrakın 101/103 satırları = durumu; çek ↔ cari bağı.
    if (s.cheques.size && has("cheques")) {
      const list = json(s.cheques);
      const fromLedger = build({ cheques: [...s.cheques] });
      const want = store.get(
        `SELECT COALESCE(SUM(CASE WHEN direction = 'in' AND status = 'portfolio' THEN CAST(ROUND(amount * 100) AS INTEGER) END), 0) AS portfolio,
                COALESCE(SUM(CASE WHEN direction = 'out' AND status = 'pending' THEN CAST(ROUND(amount * 100) AS INTEGER) END), 0) AS pending
         FROM cheques WHERE +deleted_at IS NULL AND id IN ${IN}`,
        list,
      );
      if (sumAccount(fromLedger, "101") !== Number(want.portfolio)) find("gl:101", `defter ${sumAccount(fromLedger, "101") / 100} / portföy ${want.portfolio / 100}`);
      if (sumAccount(fromLedger, "103") !== -Number(want.pending)) find("gl:103", `defter ${sumAccount(fromLedger, "103") / 100} / ödenecek ${-want.pending / 100}`);
      if (has("account_entries")) {
        const entryIds = json(s.entries);
        for (const row of all(
          `SELECT e.id FROM account_entries e LEFT JOIN cheques c ON c.id = e.source_id
           WHERE +e.source = 'cheque' AND (c.id IS NULL OR ABS(c.amount - e.amount) > 0.004)
             AND e.id IN (SELECT id FROM account_entries WHERE source = 'cheque' AND source_id IN ${IN} UNION SELECT value FROM json_each(?)) LIMIT 5`,
          list, entryIds,
        )) find("cheque:account", row.id);
      }
      lap("cheque");
    }

    // Taksit kartı: carisiz kartın 127 bakiyesi; kart toplamları (ekran) = satırlar; vade < Kayıt Tarihi.
    if (s.plans.size && has("plans")) {
      const list = json(s.plans);
      const orphanPlans = all(
        `SELECT p.id, p.name, p.total, p.status, p.covers_balance AS coversBalance,
                COALESCE((SELECT SUM(CASE WHEN e.kind = 'in' THEN e.amount ELSE -e.amount END) FROM plan_entries e WHERE e.plan_id = p.id), 0) AS paid
         FROM plans p LEFT JOIN accounts a ON a.id = p.account_id AND a.deleted_at IS NULL WHERE +p.deleted_at IS NULL AND a.id IS NULL AND p.id IN ${IN}`,
        list,
      );
      if (orphanPlans.length) {
        const balances = partyBalances(build({ plans: orphanPlans.map(plan => plan.id) }));
        for (const plan of orphanPlans) {
          const total = plan.coversBalance ? 0 : toCents(plan.total);
          const left = toCents(plan.total) - toCents(plan.paid);
          const want = total - toCents(plan.paid) - (plan.status === "closed" ? Math.max(0, left) : 0);
          const got = balances.get(`plan:${plan.id}`) || 0;
          if (got !== want) find("party:plans", `${plan.name}: defter ${got / 100} / kart ${want / 100}`);
        }
      }
      if (plans()?.list) {
        const raw = new Map(all(`SELECT p.id, p.total, COALESCE((SELECT SUM(CASE WHEN e.kind = 'in' THEN e.amount ELSE -e.amount END) FROM plan_entries e WHERE e.plan_id = p.id), 0) AS paid FROM plans p WHERE +p.deleted_at IS NULL AND p.id IN ${IN}`, list).map(row => [row.id, row]));
        for (const plan of plans().list(AUDITOR, { status: "all", ids: [...s.plans] }).plans || []) {
          const row = raw.get(plan.id);
          if (!row) continue;
          if (toCents(plan.totals.total) !== toCents(row.total) || toCents(plan.totals.paid) !== toCents(row.paid)) find("plans:totals", `${plan.refNo || plan.id} ${plan.name}`);
          else if (plan.status !== "closed" && toCents(plan.totals.remaining) !== Math.max(0, toCents(row.total) - toCents(row.paid))) find("plans:totals", `${plan.refNo || plan.id} ${plan.name}: kalan`);
        }
      }
      if (hasColumn("plan_items", "due_date") && hasColumn("plans", "registered_on")) {
        for (const row of all(`SELECT i.id FROM plans p CROSS JOIN plan_items i ON i.plan_id = p.id WHERE +p.deleted_at IS NULL AND p.registered_on <> '' AND i.due_date < p.registered_on AND p.id IN ${IN} LIMIT 5`, list)) find("dates:due-before-start", row.id);
      }
      lap("plan");
    }

    // Fatura: 191/391/360/193 ve bağlar (yalnız dokunulan faturalar ve onlara bağlı satırlar).
    if (s.invoices.size && has("invoices") && has("invoice_lines")) {
      const list = json(s.invoices);
      const c = column => `CAST(ROUND(${column} * 100) AS INTEGER)`;
      const fromLedger = build({ invoices: [...s.invoices] });
      const sums = store.get(
        `SELECT COALESCE(SUM(CASE kind WHEN 'purchase' THEN ${c("try_vat")} WHEN 'purchase_return' THEN -${c("try_vat")} END), 0) AS v191,
                COALESCE(SUM(CASE WHEN kind IN ('sale', 'smm') THEN -(${c("try_vat")} - ${c("try_withheld")}) WHEN kind = 'sale_return' THEN ${c("try_vat")} - ${c("try_withheld")} END), 0) AS v391,
                COALESCE(SUM(CASE kind WHEN 'purchase' THEN -(${c("try_withheld")} + ${c("try_stoppage")}) WHEN 'purchase_return' THEN ${c("try_withheld")} + ${c("try_stoppage")} END), 0) AS v360,
                COALESCE(SUM(CASE WHEN kind IN ('sale', 'smm') THEN ${c("try_stoppage")} END), 0) AS v193
         FROM invoices i WHERE +i.status = 'issued' AND EXISTS (SELECT 1 FROM accounts a WHERE a.id = i.account_id AND a.deleted_at IS NULL) AND i.id IN ${IN}`,
        list,
      );
      for (const [account, want] of [["191", sums.v191], ["391", sums.v391], ["360", sums.v360], ["193", sums.v193]]) {
        const got = sumAccount(fromLedger.filter(entry => entry.id.startsWith("invoice:")), account);
        if (got !== Number(want)) find(`gl:${account}`, `fatura defteri ${got / 100} / faturalar ${Number(want) / 100}`);
      }
      invoiceChecks(s, list, find);
      lap("invoice");
    }

    // Stok: ürün miktarı (ekran) = hareketler; açık hesap ↔ cari; yetim cari satırı; miktar > 0.
    if ((s.items.size || s.moves.size) && has("stock_moves")) {
      if (s.items.size && stock()?.list) {
        const list = json(s.items);
        const raw = new Map(all(`SELECT item_id AS id, SUM(CASE WHEN kind = 'in' THEN qty ELSE -qty END) AS qty FROM stock_moves WHERE item_id IN ${IN} GROUP BY item_id`, list).map(row => [row.id, row.qty]));
        for (const item of stock().list(AUDITOR, { ids: [...s.items] }).items || []) {
          if (item.kind === "service" || item.service) continue;
          if (Math.round((Number(item.qty) || 0) * 1000) !== Math.round((raw.get(item.id) || 0) * 1000)) find("stock:qty", `${item.name}: ekran ${item.qty} / hareketler ${raw.get(item.id) || 0}`);
        }
      }
      if (has("account_entries")) {
        const moves = json(s.moves);
        const items = json(s.visible.items);
        for (const row of all(
          `SELECT m.id FROM stock_moves m
             CROSS JOIN stock_items i ON i.id = m.item_id AND i.deleted_at IS NULL
             LEFT JOIN account_entries e ON e.source = 'stock' AND e.source_id = m.id
           WHERE +m.pay = 'account' AND m.amount > 0 AND (e.id IS NULL OR ABS(e.amount - m.amount) > 0.004)
             AND m.id IN (SELECT value FROM json_each(?) UNION SELECT id FROM stock_moves WHERE item_id IN ${IN}) LIMIT 5`,
          moves, items,
        )) find("stock:account", row.id);
        for (const row of all(`SELECT e.id FROM account_entries e LEFT JOIN stock_moves m ON m.id = e.source_id WHERE +e.source = 'stock' AND m.id IS NULL AND e.id IN (SELECT id FROM account_entries WHERE source = 'stock' AND source_id IN ${IN} UNION SELECT value FROM json_each(?)) LIMIT 5`, moves, json(s.entries))) find("stock:orphan", row.id);
        for (const row of all(`SELECT id FROM stock_moves WHERE NOT (qty > 0) AND id IN ${IN} LIMIT 5`, moves)) find("stock:qty", row.id);
      }
      lap("stock");
    }

    // Dokunulan cari satırlarının kaynak bağları (gözden geçirme B6): çek, stok ve fatura kaynaklı satır var olan kaynağına (ve çekte tutarına)
    // bağlı — kaynak varlık kümesi boş kalsa da (kaynak kimliği boş satır) denetlenir.
    if (s.entries.size && has("account_entries")) {
      const entryIds = json(s.entries);
      if (has("cheques")) for (const row of all(`SELECT e.id FROM json_each(?) j CROSS JOIN account_entries e ON e.id = j.value LEFT JOIN cheques c ON c.id = e.source_id WHERE +e.source = 'cheque' AND (c.id IS NULL OR ABS(c.amount - e.amount) > 0.004) LIMIT 5`, entryIds)) find("cheque:account", row.id);
      if (has("stock_moves")) for (const row of all(`SELECT e.id FROM json_each(?) j CROSS JOIN account_entries e ON e.id = j.value LEFT JOIN stock_moves m ON m.id = e.source_id WHERE +e.source = 'stock' AND m.id IS NULL LIMIT 5`, entryIds)) find("stock:orphan", row.id);
      if (has("invoices")) for (const row of all(`SELECT e.id FROM json_each(?) j CROSS JOIN account_entries e ON e.id = j.value LEFT JOIN invoices i ON i.id = e.source_id WHERE +e.source = 'invoice' AND i.id IS NULL LIMIT 5`, entryIds)) find("invoice:orphan", row.id);
      lap("links");
    }

    // Satır kuralları: kuruş ve işaret; tarih biçimi ve ileri tarih (eski ileri tarihli satırlar tabanla).
    for (const [table, column, where] of amountColumns) {
      const ids = [...new Set(touchedRows(table).map(row => row.id))];
      if (!ids.length || !hasColumn(table, column)) continue;
      for (const row of all(`SELECT t.id FROM json_each(?) j CROSS JOIN ${table} t ON t.id = j.value WHERE (ABS(${column} * 100 - ROUND(${column} * 100)) > 0.0001 OR ${column} < 0)${where ? ` AND ${where}` : ""} LIMIT 5`, json(ids))) find(`cents:${table}`, row.id);
    }
    const today = period()?.today?.() || now.today();
    for (const table of dated) {
      const ids = [...new Set(touchedRows(table).map(row => row.id))];
      if (!ids.length || !hasColumn(table, "date")) continue;
      if (datedWhenUsed.has(table) && !store.get(datedWhenUsed.get(table))) continue;
      const list = json(ids);
      for (const row of all(`SELECT t.id FROM json_each(?) j CROSS JOIN ${table} t ON t.id = j.value WHERE (t.date IS NULL OR trim(t.date) = '' OR t.date NOT GLOB '[0-9][0-9][0-9][0-9]-[01][0-9]-[0-3][0-9]' OR date(t.date) IS NULL OR date(t.date) <> t.date) LIMIT 5`, list)) find(`dates:format:${table}`, row.id);
      const known = legacy.future().get(table);
      for (const row of all(`SELECT t.id FROM json_each(?) j CROSS JOIN ${table} t ON t.id = j.value WHERE t.date > ?`, list, today)) if (!known?.has(row.id)) find(`dates:future:${table}`, row.id);
    }
    lap("rows");

    // Yevmiye maddesi dengesi: bu yolda kurulan her madde (borç = alacak).
    const seen = new Set();
    for (const entry of entries) {
      if (seen.has(entry.id)) continue;
      seen.add(entry.id);
      const net = entry.lines.reduce((sum, line) => sum + line.debit - line.credit, 0);
      if (net !== 0) find("balance", entry.id);
    }

    // İşlem başlığı ve Rapor = Özet (olay bazlı; tam kapıyla aynı kod — dokunulan olaylar).
    const bank = bankChecks();
    if (bank.ready() && s.events.size) {
      for (const item of bank.brokenEvents({ events: s.events })) if (!legacy.events().has(item.key)) find("bank:event", item.sample || item.key);
      for (const item of bank.reportMismatches({ events: s.events })) find("money:report", item.key);
      // Banka Fişi dengesi ve kuralları (Aşama 3; dokunulan olaylardan Banka Fişi olanlar).
      for (const item of bank.voucherProblems({ events: s.events })) find("bank:voucher", item.sample || item.key);
      // GG2: Devir Kapanışı sırası (dokunulan olaylardan biri Devir Kapanışı ya da ters kaydıysa).
      for (const item of bank.carryProblems({ events: s.events })) find("bank:carry", item.sample || item.key);
    }
    // Açılış kuralı (Aşama 3): dokunulan hesaplar (hesap kartı, satır bağı, olayın ya da fiş satırının hesabı).
    if (bank.ready() && s.banks.size) for (const item of bank.openingProblems({ refs: s.banks })) find("bank:opening", item.sample || item.key);
    lap("bank");
    return { full: lockReason ? `kilit (${lockReason})` : "", findings, sections, ms: performance.now() - started, scope: { parties: s.parties.size, plans: s.plans.size, cheques: s.cheques.size, invoices: s.invoices.size, items: s.items.size, money: Object.values(s.money).reduce((sum, set) => sum + set.size, 0), events: s.events.size, heavyParties, built: entries.length } };
  }

  // Fatura bağları (tam kapının 1–6. fatura denetimleri; yalnız kapsamdaki faturalar ve onlara bağlı satırlar).
  function invoiceChecks(s, list, find) {
    const c = column => `CAST(ROUND(${column} * 100) AS INTEGER)`;
    for (const row of all(
      `SELECT i.id, ${c("i.net_total")} AS hnet, ${c("i.vat_total")} AS hvat, ${c("i.withheld_total")} AS hwithheld, ${c("i.payable_total")} AS hpayable, ${c("i.stoppage_total")} AS hstoppage,
              COALESCE(SUM(${c("l.net")}), 0) AS lnet, COALESCE(SUM(${c("l.vat")}), 0) AS lvat, COALESCE(SUM(${c("l.withheld")}), 0) AS lwithheld, COALESCE(SUM(${c("l.payable")}), 0) AS lpayable, COUNT(l.id) AS lcount
       FROM invoices i LEFT JOIN invoice_lines l ON l.invoice_id = i.id WHERE i.id IN ${IN} GROUP BY i.id
       HAVING lcount = 0 OR hnet <> lnet OR hvat <> lvat OR hwithheld <> lwithheld OR hpayable <> lpayable - hstoppage LIMIT 5`,
      list,
    )) find("invoice:lines", row.id);
    for (const row of all(`SELECT id, ${c("try_net")} AS net, ${c("try_vat")} AS vat, ${c("try_withheld")} AS withheld, ${c("try_stoppage")} AS stoppage, ${c("try_payable")} AS payable, gl_json AS gl FROM invoices WHERE status <> 'draft' AND id IN ${IN}`, list)) {
      let gl = 0;
      try {
        gl = JSON.parse(row.gl || "[]").reduce((sum, item) => sum + Math.round(Number(item.net) || 0), 0);
      } catch {
        gl = Number.NaN;
      }
      if (row.payable !== row.net + row.vat - row.withheld - row.stoppage || gl !== row.net) find("invoice:try", row.id);
    }
    if (has("account_entries")) {
      for (const row of all(
        `SELECT * FROM (
           SELECT i.id, i.status, ${c("i.try_payable")} AS hpayable,
                  COALESCE((SELECT SUM(${c("e.amount")}) FROM account_entries e WHERE e.source = 'invoice' AND e.source_id = i.id AND e.kind IN ('debt', 'credit') AND e.account_id = i.account_id
                            AND e.kind = CASE WHEN i.kind IN ('sale', 'smm', 'purchase_return') THEN 'debt' ELSE 'credit' END), 0) AS posted,
                  (SELECT COUNT(*) FROM account_entries e WHERE e.source = 'invoice' AND e.source_id = i.id AND e.kind IN ('debt', 'credit')) AS postedRows,
                  (SELECT COUNT(*) FROM account_entries e WHERE e.source = 'invoice' AND e.source_id = i.id) AS anyRows
           FROM invoices i WHERE i.id IN ${IN})
         WHERE (status = 'issued' AND (posted <> hpayable OR postedRows <> 1)) OR (status <> 'issued' AND anyRows > 0) LIMIT 5`,
        list,
      )) find("invoice:account", row.id);
      for (const row of all(`SELECT e.id FROM account_entries e LEFT JOIN invoices i ON i.id = e.source_id WHERE +e.source = 'invoice' AND i.id IS NULL AND e.id IN (SELECT id FROM account_entries WHERE source = 'invoice' AND source_id IN ${IN} UNION SELECT value FROM json_each(?)) LIMIT 5`, list, json(s.entries))) find("invoice:orphan", row.id);
      if (has("invoice_offsets") && hasColumn("account_entries", "invoice_id")) {
        const entries = json(s.entries);
        const offsets = json(s.offsets);
        for (const row of all(`SELECT e.id FROM account_entries e LEFT JOIN invoices i ON i.id = e.invoice_id WHERE +e.invoice_id <> '' AND (i.id IS NULL OR i.status <> 'issued' OR i.account_id <> e.account_id) AND e.id IN (SELECT id FROM account_entries WHERE invoice_id IN ${IN} UNION SELECT value FROM json_each(?)) LIMIT 5`, list, entries)) find("invoice:offset", `bağ ${row.id}`);
        for (const row of all(
          `SELECT o.id FROM invoice_offsets o LEFT JOIN invoices i ON i.id = o.invoice_id
             LEFT JOIN invoices ci ON ci.id = o.counter_id AND o.counter_type = 'invoice' LEFT JOIN account_entries ce ON ce.id = o.counter_id AND o.counter_type = 'entry'
           WHERE (i.id IS NULL OR i.status <> 'issued' OR i.account_id <> o.account_id OR (o.counter_type = 'invoice' AND (ci.id IS NULL OR ci.status <> 'issued' OR ci.account_id <> o.account_id))
                  OR (o.counter_type = 'entry' AND (ce.id IS NULL OR ce.account_id <> o.account_id)) OR o.amount <= 0)
             AND o.id IN (SELECT id FROM invoice_offsets WHERE invoice_id IN ${IN} UNION SELECT id FROM invoice_offsets WHERE counter_id IN ${IN} UNION SELECT id FROM invoice_offsets WHERE counter_id IN ${IN} UNION SELECT value FROM json_each(?)) LIMIT 5`,
          list, list, entries, offsets,
        )) find("invoice:offset", `mahsup ${row.id}`);
        for (const row of all(`SELECT i.id FROM invoices i WHERE +i.status = 'issued' AND i.id IN ${IN} AND (SELECT COALESCE(SUM(${c("o.amount")}), 0) FROM invoice_offsets o WHERE o.invoice_id = i.id OR (o.counter_type = 'invoice' AND o.counter_id = i.id)) > ${c("i.try_payable")} LIMIT 5`, list)) find("invoice:offset", `mahsup toplamı ${row.id}`);
      }
    }
    if (has("stock_moves")) {
      for (const row of all(
        `SELECT l.id FROM invoice_lines l CROSS JOIN invoices i ON i.id = l.invoice_id AND i.status = 'issued'
           LEFT JOIN stock_moves m ON m.id = l.move_id AND m.invoice_id = i.id
         WHERE +l.move_id <> '' AND (m.id IS NULL OR ABS(m.qty - l.qty) > 0.0005)
           AND l.id IN (SELECT id FROM invoice_lines WHERE invoice_id IN ${IN} UNION SELECT id FROM invoice_lines WHERE move_id IN ${IN} AND move_id <> '') LIMIT 5`,
        list, json(s.moves),
      )) find("invoice:stock", row.id);
      for (const row of all(`SELECT m.id FROM stock_moves m LEFT JOIN invoices i ON i.id = m.invoice_id WHERE +m.invoice_id <> '' AND (i.id IS NULL OR i.status <> 'issued') AND m.id IN (SELECT id FROM stock_moves WHERE invoice_id IN ${IN} UNION SELECT value FROM json_each(?)) LIMIT 5`, list, json(s.moves))) find("invoice:stock", row.id);
    }
    if (has("cheques")) for (const row of all(`SELECT c.id FROM cheques c LEFT JOIN invoices i ON i.id = c.invoice_id WHERE +c.invoice_id <> '' AND +c.deleted_at IS NULL AND (i.id IS NULL OR i.status <> 'issued') AND c.id IN (SELECT id FROM cheques WHERE invoice_id IN ${IN} UNION SELECT value FROM json_each(?)) LIMIT 5`, list, json(s.cheques))) find("invoice:cheque", row.id);
    if (hasColumn("plans", "invoice_id")) for (const row of all(`SELECT p.id FROM plans p LEFT JOIN invoices i ON i.id = p.invoice_id WHERE +p.invoice_id <> '' AND +p.deleted_at IS NULL AND (i.id IS NULL OR i.status <> 'issued') AND p.id IN (SELECT id FROM plans WHERE invoice_id IN ${IN} UNION SELECT value FROM json_each(?)) LIMIT 5`, list, json(s.plans))) find("invoice:plan", row.id);
    // İade: kapsamdaki faturaların kalemleri asıl kalem olarak ya da iade kalemi olarak (asıl kalemleri).
    for (const row of all(
      `SELECT o.id FROM (SELECT id FROM invoice_lines WHERE invoice_id IN ${IN} UNION SELECT origin_line_id FROM invoice_lines WHERE invoice_id IN ${IN}) k
         CROSS JOIN invoice_lines o ON o.id = k.id CROSS JOIN invoices i ON i.id = o.invoice_id
         CROSS JOIN invoice_lines r ON r.origin_line_id = o.id CROSS JOIN invoices ri ON ri.id = r.invoice_id AND ri.status = 'issued'
       WHERE r.origin_line_id <> ''
       GROUP BY o.id HAVING SUM(r.qty) > o.qty + 0.0005 LIMIT 5`,
      list, list,
    )) find("invoice:returns", row.id);
  }

  return { derive, evaluate };
}

