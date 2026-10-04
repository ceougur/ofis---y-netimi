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
  const FINANCIAL = new Set(["payments", "cash_entries", "accounts", "account_entries", "plans", "plan_items", "plan_entries", "stock_items", "stock_moves", "cheques", "cheque_events"]);
  const WRITE = /^\s*(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|UPDATE(?:\s+OR\s+\w+)?|DELETE\s+FROM|REPLACE\s+INTO)\s+["`]?(\w+)/i;
  const guards = [];
  // v2.0.22 (yük ölçümü): carinin yalnız BİLGİ kolonlarına (ad, telefon, adres, not, grup, ek alan, vergi bilgisi…) yazan
  // UPDATE para defterini değiştirmez — Ana Defter ve mutabakat carinin yalnız id, type (120/320/336) ve deleted_at
  // kolonlarını okur. Bu yazım mutabakat kapısını (her yazmada bütün defterin yeniden denetimi) tetiklemez. Beyaz liste:
  // listede olmayan kolon (type, status, deleted_at…) ya da çözülemeyen SET ifadesi yine finansal sayılır.
  const INFO_COLUMNS = {
    accounts: new Set(["ref_no", "name", "phone", "email", "address", "registered_on", "group_id", "subgroup_id", "note", "fields_json", "case_key", "case_source", "case_title", "updated_by", "updated_at",
      "tax_no", "tax_office", "mersis_no", "trade_registry", "party_kind", "first_name", "family_name", "city", "district", "postal_code", "country", "website", "iban", "due_days", "e_invoice", "e_alias", "e_profile"]),
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
  const writesTo = sql => {
    const match = WRITE.exec(sql);
    return match ? match[1].toLowerCase() : "";
  };
  const store = {
    db,
    get: (sql, ...args) => prepare(sql).get(...args),
    all: (sql, ...args) => prepare(sql).all(...args),
    run: (sql, ...args) => {
      const table = writesTo(sql);
      if (table && FINANCIAL.has(table) && !infoOnly(table, sql)) {
        if (depth === 0 && guards.length) return store.tx(() => store.run(sql, ...args));
        touched.add(table);
      }
      return prepare(sql).run(...args);
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
    // İç içe çağrılabilen işlem; iç seviyelerde SAVEPOINT kullanılır.
    tx(fn) {
      const savepoint = `sp_${depth}`;
      if (depth === 0) {
        db.exec("BEGIN IMMEDIATE");
        touched = new Set();
      } else db.exec(`SAVEPOINT ${savepoint}`);
      depth += 1;
      try {
        const result = fn();
        if (depth === 1 && touched.size && guards.length) {
          const tables = new Set(touched);
          for (const guard of guards) guard.check({ tables });
        }
        depth -= 1;
        if (depth === 0) {
          db.exec("COMMIT");
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
          const tables = new Set(touched);
          touched = new Set();
          if (tables.size) for (const guard of guards) guard.rolledBack?.({ tables, error });
        } else db.exec(`ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
        throw error;
      }
    },
    setting(key, fallback = null) {
      const row = prepare("SELECT value FROM settings WHERE key = ?").get(key);
      return row ? row.value : fallback;
    },
    setSetting(key, value, userId = null) {
      prepare("INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by")
        .run(key, String(value ?? ""), new Date().toISOString(), userId);
    },
  };
  return store;
}
