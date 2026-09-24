// SQLite bağlantısı ve küçük sorgu yardımcıları (node:sqlite, bağımlılıksız).
import { DatabaseSync } from "node:sqlite";

export function openDatabase(dbPath, { readOnly = false } = {}) {
  const db = readOnly ? new DatabaseSync(dbPath, { readOnly: true }) : new DatabaseSync(dbPath);
  if (!readOnly) db.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
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
  const store = {
    db,
    get: (sql, ...args) => prepare(sql).get(...args),
    all: (sql, ...args) => prepare(sql).all(...args),
    run: (sql, ...args) => prepare(sql).run(...args),
    exec: sql => db.exec(sql),
    // İç içe çağrılabilen işlem; iç seviyelerde SAVEPOINT kullanılır.
    tx(fn) {
      const savepoint = `sp_${depth}`;
      if (depth === 0) db.exec("BEGIN IMMEDIATE");
      else db.exec(`SAVEPOINT ${savepoint}`);
      depth += 1;
      try {
        const result = fn();
        depth -= 1;
        if (depth === 0) db.exec("COMMIT");
        else db.exec(`RELEASE ${savepoint}`);
        return result;
      } catch (error) {
        depth -= 1;
        if (depth === 0) db.exec("ROLLBACK");
        else db.exec(`ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
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
