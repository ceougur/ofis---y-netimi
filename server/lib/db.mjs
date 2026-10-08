// SQLite bağlantısı ve küçük sorgu yardımcıları (node:sqlite, bağımlılıksız).
import { DatabaseSync } from "node:sqlite";

export function openDatabase(dbPath, { readOnly = false } = {}) {
  const db = readOnly ? new DatabaseSync(dbPath, { readOnly: true }) : new DatabaseSync(dbPath);
  // WAL + synchronous FULL (v2.0.6): her COMMIT diske işlenir; elektrik kesilse de tamamlanmış işlem kaybolmaz, yarım
  // işlem kalmaz (geri alınır). Yerel ofis programında yazma sıklığı düşük; güvenlik hız maliyetine değer.
  if (!readOnly) db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;");
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 10000;");
  return db;
}

export function createStore(db) {
  const cache = new Map();
  const prepare = sql => {
    let statement = cache.get(sql);
    if (!statement) {
      statement = db.prepare(sql);
      cache.set(sql, statement);
    }
    return statement;
  };
  let depth = 0;
  // v2.0.13 — mutabakat kapısı: para taşıyan tablolara yazan her işlem, en dış COMMIT'ten hemen önce kayıtlı
  // denetimlerden (store.addCommitGuard) geçer; denetim hata fırlatırsa işlem ROLLBACK edilir (yarım/sapmalı kayıt
  // diske hiç yazılmaz). İşlem dışında (tek satır) yapılan para yazımı da kendiliğinden bir işleme alınır.
  // v2.1.0 (§5.5): banka çekirdeği tabloları da para taşır (işlem başlığı, banka fişi, hesap ve POS kartı, POS satışı ve valör
  // takvimi, bankaya tahsile verilen çek). Kur, tatil, ekstre, eşleşme, plan, iş kuyruğu ve istek kimliği kapı dışında.
  const FINANCIAL = new Set(["payments", "cash_entries", "accounts", "account_entries", "plans", "plan_items", "plan_entries", "stock_items", "stock_moves", "cheques", "cheque_events",
    "fin_events", "bank_lines", "bank_accounts", "pos_terminals", "pos_sales", "pos_items", "cheque_collections"]);
  const WRITE = /^\s*(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|UPDATE(?:\s+OR\s+\w+)?|DELETE\s+FROM|REPLACE\s+INTO)\s+["`]?(\w+)/i;
  const guards = [];
  // v2.0.22 (yük ölçümü): carinin yalnız BİLGİ kolonlarına (ad, telefon, adres, not, grup, ek alan, vergi bilgisi…) yazan
  // UPDATE para defterini değiştirmez — Ana Defter ve mutabakat carinin yalnız id, type (120/320/336) ve deleted_at
  // kolonlarını okur. Bu yazım mutabakat kapısını (her yazmada bütün defterin yeniden denetimi) tetiklemez. Beyaz liste:
  // listede olmayan kolon (type, status, deleted_at…) ya da çözülemeyen SET ifadesi yine finansal sayılır.
  const INFO_COLUMNS = {
    accounts: new Set(["ref_no", "name", "phone", "email", "address", "registered_on", "group_id", "subgroup_id", "note", "fields_json", "case_key", "case_source", "case_title", "updated_by", "updated_at",
      "tax_no", "tax_office", "mersis_no", "trade_registry", "party_kind", "first_name", "family_name", "city", "district", "postal_code", "country", "website", "iban", "due_days", "e_invoice", "e_alias", "e_profile"]),
    // v2.1.0 (§5.5): işlem başlığının açıklaması ve karşı taraf metni; hesap ve POS kartlarının adı, banka bilgisi, sırası.
    fin_events: new Set(["description", "reference", "counter_name", "counter_iban", "channel", "updated_by", "updated_at"]),
    bank_accounts: new Set(["name", "bank_name", "iban", "account_no", "branch_name", "branch_code", "swift", "holder", "description", "position", "statement_template_json", "statement_day", "due_day", "show_on_invoice", "integration", "updated_by", "updated_at"]),
    pos_terminals: new Set(["name", "merchant_no", "terminal_no", "description", "updated_by", "updated_at"]),
  };
  const SET_CLAUSE = /^\s*UPDATE\s+["`]?\w+["`]?\s+SET\s+([\s\S]+?)\s+WHERE\s/i;
  const infoOnly = (table, sql) => {
    const allowed = INFO_COLUMNS[table];
    if (!allowed) return false;
    const match = SET_CLAUSE.exec(sql);
    if (!match) return false;
    const parts = match[1].split(",");
    return parts.length > 0 && parts.every(part => /^\s*["`]?\w+["`]?\s*=\s*\?\s*$/.test(part) && allowed.has(part.split("=")[0].replace(/["`\s]/g, "").toLowerCase()));
  };
  let touched = new Set();
  // Ham yazım kapsamı (v2.1.0; plan §3.3/c): göç, şirket sıfırlaması ve açılış onarımı para tablolarına bank.post dışından yazar;
  // store.raw(gerekçe, fn) bu yazımları gerekçesiyle işaretler.
  const rawScope = [];
  const writesTo = sql => {
    const match = WRITE.exec(sql);
    return match ? match[1].toLowerCase() : "";
  };
  // ---------- K6: para yazımı denetimi (v2.1.0; plan §3.3/b-c) ----------
  // policy (app kurar; lib/bank/post.mjs moneyPolicy): para tabloları, "para satırı" koşulu (lib/bank/money-lines.mjs, moneyLines'ın
  // 9 kaynağı), para alanı olmayan kolonlar ve ihlal işleyicisi. Kurulu değilse (göç kopyaları, araçlar) hiçbir denetim yok.
  //   (b) money:event — en dış işlemin başında kaynak tablolarının MAX(rowid) işareti alınır; bu işlemde eklenen (işaretten sonra ya da
  //       store.run'ın yazdığı rowid) ve para alanı değiştirilen satırlardan para satırı koşulunu sağlayıp event_id'si boş olan COMMIT'te
  //       ihlaldir.
  //   (c) money:raw — bank.post bağlamı ve store.raw kapsamı dışında para tablosuna UPDATE/DELETE (yalnız para alanı olmayan kolonlara
  //       UPDATE hariç) ihlaldir.
  // İhlaller kapı denetimlerinden SONRA, COMMIT'ten hemen önce işleyiciye verilir: test kipinde hata (ROLLBACK), üretimde günlük (iş
  // durmaz). bank.post bağlamındaki UPDATE/DELETE'in etkilediği işlem başlıkları bank.post'a bildirilir (kopya yenilenir, boşalan olay
  // iptal olur).
  let policy = null;
  // Son en dış işlemin kapı süreleri (ms): K6 işaretleri, mutabakat kapısı, K6 money:event denetimi (§3.11 ölçümü; store.lastTx).
  let txStats = { marksMs: 0, guardMs: 0, moneyMs: 0 };
  const posts = [];
  let money = null;
  let touchedEvents = new Set();
  const parsedWrites = new Map();
  // UPDATE/DELETE metnini çözer: fiil, SET kolonları, SET içindeki parametre sayısı, WHERE metni (en dış düzeyde).
  function parseWrite(sql) {
    let parsed = parsedWrites.get(sql);
    if (parsed) return parsed;
    const verb = /^\s*(\w+)/.exec(sql)[1].toUpperCase();
    const topLevel = (text, word, from = 0) => {
      let depth = 0;
      let quote = "";
      for (let k = from; k < text.length; k += 1) {
        const ch = text[k];
        if (quote) {
          if (ch === quote) quote = "";
        } else if (ch === "'" || ch === '"') quote = ch;
        else if (ch === "(") depth += 1;
        else if (ch === ")") depth -= 1;
        else if (depth === 0 && /\s/.test(text[k - 1] || " ") && text.slice(k, k + word.length).toUpperCase() === word && !/\w/.test(text[k + word.length] || "")) return k;
      }
      return -1;
    };
    const whereAt = topLevel(sql, "WHERE");
    const where = whereAt >= 0 ? sql.slice(whereAt + 5) : "";
    let set = [];
    let setParams = 0;
    if (verb === "UPDATE") {
      const setAt = topLevel(sql, "SET");
      const clause = sql.slice(setAt + 3, whereAt >= 0 ? whereAt : sql.length);
      const parts = [];
      let depth = 0;
      let start = 0;
      for (let k = 0; k < clause.length; k += 1) {
        if (clause[k] === "(") depth += 1;
        else if (clause[k] === ")") depth -= 1;
        else if (clause[k] === "," && depth === 0) {
          parts.push(clause.slice(start, k));
          start = k + 1;
        }
      }
      parts.push(clause.slice(start));
      set = parts.map(part => (/^\s*["`]?(\w+)["`]?\s*=/.exec(part)?.[1] || "?").toLowerCase());
      setParams = (clause.match(/\?/g) || []).length;
    }
    parsed = { verb, set, setParams, where };
    parsedWrites.set(sql, parsed);
    return parsed;
  }
  const freshMoney = () => ({ marks: new Map(), written: new Map(), violations: [] });
  const noteRows = (table, rowids) => {
    if (!money || !rowids.length) return;
    if (!money.written.has(table)) money.written.set(table, new Set());
    const set = money.written.get(table);
    for (const rowid of rowids) set.add(Number(rowid));
  };
  function beforeLedgerWrite(table, sql, args, before = null) {
    const parsed = parseWrite(sql);
    if (parsed.verb === "INSERT" || parsed.verb === "REPLACE" || rawScope.length) return;
    if (parsed.verb === "UPDATE" && parsed.set.length && parsed.set.every(column => policy.free[table]?.has(column))) return;
    if (!posts.length) money?.violations.push({ code: "money-raw", table, sql: sql.replace(/\s+/g, " ").trim().slice(0, 200) });
    if (!policy.sources.has(table) || table === "bank_lines") return;
    const rows = before ? before.map(row => ({ r: row.__rowid, e: row.event_id })) : store.all(`SELECT rowid AS r, event_id AS e FROM ${table}${parsed.where ? ` WHERE ${parsed.where}` : ""}`, ...args.slice(parsed.setParams));
    if (parsed.verb === "UPDATE") noteRows(table, rows.map(row => row.r));
    if (posts.length) posts.at(-1).affected(rows.map(row => row.e).filter(Boolean));
  }
  // ---------- Kapı kapsamı (v2.1.0, §3.11 kararı; lib/integrity.mjs "dokunulan varlıklar") ----------
  // En dış işlemde para tablolarına ve fatura tablolarına yazılan satırlar: eklenen/düzeltilen satırların rowid'i (COMMIT'te güncel hâli
  // okunur) ve UPDATE/DELETE'ten ÖNCEKİ hâli (bütün kolonlar). Kapı yalnız bu satırların dokunduğu varlıkları (cari, kart, çek, fatura,
  // ürün, para satırı) denetler. Çözülemeyen yazım (SQL ayrıştırılamadı, upsert/REPLACE) "unknown" işaretlenir: kapı tam denetime döner.
  // Kayıtlı yazımların değişen satır sayısı (tracked) SQLite'ın total_changes()'ıyla karşılaştırılır: store dışından (aynı bağlantıda
  // db.prepare/db.exec) yazım olduysa kapı bunu görür ve tam denetime döner; başka bağlantının yazımı PRAGMA data_version'dan görünür.
  const SCOPE_TABLES = new Set([...FINANCIAL, "invoices", "invoice_lines", "invoice_offsets"]);
  let scope = null;
  let trackedChanges = 0;
  const freshScope = () => ({ rows: new Map(), before: new Map(), unknown: "" });
  const scopeRows = table => {
    if (!scope.rows.has(table)) scope.rows.set(table, new Set());
    return scope.rows.get(table);
  };
  const UPSERT = /\bOR\s+REPLACE\b|^\s*REPLACE\s+INTO|\bON\s+CONFLICT\b/i;
  function readBefore(table, sql, args) {
    let parsed;
    try {
      parsed = parseWrite(sql);
    } catch {
      scope.unknown ||= `${table}: yazım çözülemedi`;
      return null;
    }
    if (parsed.verb === "INSERT" || parsed.verb === "REPLACE") {
      if (UPSERT.test(sql)) scope.unknown ||= `${table}: upsert`;
      return null;
    }
    if (parsed.verb !== "UPDATE" && parsed.verb !== "DELETE") {
      scope.unknown ||= `${table}: ${parsed.verb}`;
      return null;
    }
    try {
      const rows = store.all(`SELECT rowid AS __rowid, * FROM ${table}${parsed.where ? ` WHERE ${parsed.where}` : ""}`, ...args.slice(parsed.setParams));
      if (!scope.before.has(table)) scope.before.set(table, new Map());
      const before = scope.before.get(table);
      for (const row of rows) {
        if (!before.has(row.__rowid)) before.set(row.__rowid, row);
        if (parsed.verb === "UPDATE") scopeRows(table).add(row.__rowid);
      }
      return rows;
    } catch {
      scope.unknown ||= `${table}: önceki hâl okunamadı`;
      return null;
    }
  }
  function afterScopedInsert(table, sql, result) {
    if (!/^\s*(INSERT|REPLACE)/i.test(sql)) return;
    const changes = Number(result?.changes) || 0;
    const last = Number(result?.lastInsertRowid) || 0;
    if (changes > 0 && last > 0) for (let k = 0; k < changes; k += 1) scopeRows(table).add(last - changes + 1 + k);
    else if (changes > 0) scope.unknown ||= `${table}: eklenen satır kimliği yok`;
  }
  function afterLedgerInsert(table, sql, result) {
    if (!policy.sources.has(table) || !/^\s*(INSERT|REPLACE)/i.test(sql)) return;
    const changes = Number(result?.changes) || 0;
    const last = Number(result?.lastInsertRowid) || 0;
    if (changes > 0 && last > 0) noteRows(table, Array.from({ length: changes }, (_, k) => last - changes + 1 + k));
  }
  function moneyViolations() {
    const out = [...money.violations];
    for (const [table, where] of policy.sources) {
      const mark = money.marks.get(table) ?? Number.MAX_SAFE_INTEGER;
      const written = [...(money.written.get(table) || [])];
      for (const row of store.all(`SELECT id FROM ${table} WHERE (rowid > ? OR rowid IN (SELECT value FROM json_each(?))) AND ${where} AND COALESCE(event_id, '') = '' LIMIT 5`, mark, JSON.stringify(written))) out.push({ code: "money-event", table, id: row.id });
    }
    return out;
  }
  const store = {
    db,
    get: (sql, ...args) => prepare(sql).get(...args),
    all: (sql, ...args) => prepare(sql).all(...args),
    run: (sql, ...args) => {
      const table = writesTo(sql);
      if (table && FINANCIAL.has(table) && !infoOnly(table, sql)) {
        if (depth === 0 && (guards.length || policy?.ledger.has(table))) return store.tx(() => store.run(sql, ...args));
        touched.add(table);
      }
      const watched = Boolean(policy && depth > 0 && table && policy.ledger.has(table));
      const scoped = Boolean(scope && depth > 0 && table && SCOPE_TABLES.has(table) && !infoOnly(table, sql));
      const before = scoped ? readBefore(table, sql, args) : null;
      if (watched) beforeLedgerWrite(table, sql, args, before);
      const result = prepare(sql).run(...args);
      trackedChanges += Number(result?.changes) || 0;
      if (watched) afterLedgerInsert(table, sql, result);
      if (scoped) afterScopedInsert(table, sql, result);
      return result;
    },
    exec: sql => db.exec(sql),
    /** Mutabakat denetimi ekle: fn({ tables }) — hata fırlatırsa işlem geri alınır; after() başarılı COMMIT sonrası. */
    addCommitGuard(guard) {
      guards.push(guard);
      return () => guards.splice(guards.indexOf(guard), 1);
    },
    get inTransaction() {
      return depth > 0;
    },
    /** Kayıtlı yazımların değişen satır sayısı ↔ bağlantının total_changes()'ı ve data_version (store dışı yazımı görmek için). */
    changeCounters() {
      return { tracked: trackedChanges, total: Number(prepare("SELECT total_changes() AS n").get().n) || 0, version: Number(prepare("PRAGMA data_version").get().data_version) || 0 };
    },
    /** Son en dış işlemin kapı süreleri (ms): { marksMs, guardMs, moneyMs }. */
    get lastTx() {
      return { ...txStats };
    },
    /** K6 politikasını kurar (lib/bank/post.mjs moneyPolicy); null kaldırır. */
    setMoneyPolicy(next) {
      policy = next || null;
    },
    get moneyPolicy() {
      return policy;
    },
    /** bank.post bağlamı: ctx.affected(olayKimlikleri) — bu bağlamdaki UPDATE/DELETE'in dokunduğu işlem başlıkları. */
    enterPost(ctx) {
      posts.push(ctx);
    },
    leavePost(ctx) {
      const at = posts.lastIndexOf(ctx);
      if (at >= 0) posts.splice(at, 1);
    },
    get inPost() {
      return posts.length > 0;
    },
    /** Bu işlemde dokunulan işlem başlığı (plan §3.3 adım 11): kapının olay bazındaki denetimleri yalnız bunlara uygulanır. */
    touchEvent(id) {
      if (id) touchedEvents.add(id);
    },
    raw(reason, fn) {
      if (typeof reason !== "string" || !reason.trim()) throw new TypeError("store.raw: gerekçe gerekli");
      rawScope.push(reason);
      try {
        return fn();
      } finally {
        rawScope.pop();
      }
    },
    /** Etkin ham yazım kapsamının gerekçesi ("" = kapsam dışı). */
    get rawReason() {
      return rawScope.at(-1) || "";
    },
    // İç içe çağrılabilen işlem; iç seviyelerde SAVEPOINT kullanılır.
    tx(fn) {
      const savepoint = `sp_${depth}`;
      if (depth === 0) {
        db.exec("BEGIN IMMEDIATE");
        touched = new Set();
        touchedEvents = new Set();
        money = policy ? freshMoney() : null;
        txStats = { marksMs: 0, guardMs: 0, moneyMs: 0 };
        scope = guards.length ? freshScope() : null;
        // money:event işareti: işlem başındaki en büyük rowid (indeksin sonu; ucuz).
        const marksAt = performance.now();
        if (money) for (const table of policy.sources.keys()) money.marks.set(table, Number(prepare(`SELECT COALESCE(MAX(rowid), 0) AS m FROM ${table}`).get().m) || 0);
        txStats.marksMs = performance.now() - marksAt;
      } else db.exec(`SAVEPOINT ${savepoint}`);
      // İç işlem (SAVEPOINT) geri alınırsa onun içinde görülen K6 ihlali de düşer.
      const violationsAt = money ? money.violations.length : 0;
      depth += 1;
      try {
        const result = fn();
        if (depth === 1 && touched.size && guards.length) {
          const tables = new Set(touched);
          const guardAt = performance.now();
          try {
            for (const guard of guards) guard.check({ tables, events: new Set(touchedEvents), scope });
          } finally {
            txStats.guardMs = performance.now() - guardAt;
          }
        }
        // K6: kapı denetimlerinden sonra (kapının nedeni önce söylenir), COMMIT'ten önce.
        if (depth === 1 && money && touched.size) {
          const moneyAt = performance.now();
          const violations = moneyViolations();
          money.violations = [];
          txStats.moneyMs = performance.now() - moneyAt;
          if (violations.length) policy.onViolations(violations);
        }
        depth -= 1;
        if (depth === 0) {
          db.exec("COMMIT");
          money = null;
          scope = null;
          if (touched.size) {
            const tables = new Set(touched);
            touched = new Set();
            for (const guard of guards) guard.after?.({ tables });
          }
        } else db.exec(`RELEASE ${savepoint}`);
        return result;
      } catch (error) {
        depth -= 1;
        if (depth === 0) {
          db.exec("ROLLBACK");
          money = null;
          scope = null;
          const tables = new Set(touched);
          touched = new Set();
          if (tables.size) for (const guard of guards) guard.rolledBack?.({ tables, error });
        } else {
          db.exec(`ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
          if (money) money.violations.length = Math.min(money.violations.length, violationsAt);
        }
        throw error;
      }
    },
    setting(key, fallback = null) {
      const row = prepare("SELECT value FROM settings WHERE key = ?").get(key);
      return row ? row.value : fallback;
    },
    setSetting(key, value, userId = null) {
      const result = prepare("INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by")
        .run(key, String(value ?? ""), new Date().toISOString(), userId);
      trackedChanges += Number(result?.changes) || 0;
    },
  };
  return store;
}
