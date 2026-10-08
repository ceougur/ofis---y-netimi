// v20 (banka çekirdeği) göçünün denetim yardımcıları (2.1.0 Aşama 2, dilim 2; docs/BANKA-MODULU-PLAN.md §10.5, K11).
// Fikstürdeki her şirket veri dosyası bir KOPYADA önce v19'a (2.0.26'nın şeması) getirilir, tabloların bütün satırları ve
// kilit izi alınır; sonra v20 uygulanır ve aynı tablolar aynı kolonlarla yeniden okunur. Kural: hiçbir mevcut satır değişmez.
// İzinli farklar yalnız: settings'e meta.schema.v20At eklenir; ortak katmanda (001) users.grants_json ve roles.permissions_json'a
// yalnız banka yetkileri (bank.*) eklenir (yetki göçü K4, §9.1).
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createStore } from "../../server/lib/db.mjs";
import { MIGRATIONS } from "../../server/lib/migrations.mjs";
import { companyDbFile, readRegistry } from "./uretici.mjs";

/** Fikstürdeki ayrı veri dosyaları ve sahibi şirketler (ortak dosyalı şirketler aynı dosyada). */
export function fixtureDatabases(dataDir) {
  const registry = readRegistry(dataDir) || [{ id: "sirket-001", code: "001", name: "", dir: "" }];
  const out = new Map();
  for (const company of registry) {
    const file = companyDbFile(dataDir, company);
    if (!existsSync(file)) continue;
    if (!out.has(file)) out.set(file, { file, companies: [] });
    out.get(file).companies.push({ id: company.id, code: company.code, name: company.name });
  }
  return [...out.values()];
}

/** Dosyanın kopyasını açar (WAL dahil): { db, store, dir, close() }. Asıl dosyaya dokunulmaz. */
export function openCopy(file) {
  const dir = mkdtempSync(path.join(tmpdir(), "goc-v20-"));
  const copy = path.join(dir, path.basename(file));
  copyFileSync(file, copy);
  if (existsSync(`${file}-wal`)) copyFileSync(`${file}-wal`, `${copy}-wal`);
  const db = new DatabaseSync(copy);
  db.exec("PRAGMA busy_timeout = 10000;");
  const store = createStore(db);
  return { db, store, dir, file: copy, close: () => { db.close(); rmSync(dir, { recursive: true, force: true }); } };
}

/** Bekleyen göçleri verilen sürüme kadar (dahil) uygular (göç koşucusunun yaptığı gibi; yedeksiz). */
export function migrateTo(store, version, context = {}) {
  const current = store.get("PRAGMA user_version").user_version;
  for (const migration of MIGRATIONS.filter(item => item.version > current && item.version <= version)) {
    store.tx(() => {
      migration.up(store, context);
      store.exec(`PRAGMA user_version = ${migration.version}`);
    });
  }
  return store.get("PRAGMA user_version").user_version;
}

/** Bütün tabloların kolonları ve satırları (rowid sırasıyla; satır = kolon değerlerinin JSON'u). */
export function snapshot(db, only = null) {
  const out = {};
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
  for (const name of tables) {
    if (only && !only[name]) continue;
    const cols = only ? only[name].cols : db.prepare(`PRAGMA table_info("${name}")`).all().map(col => col.name);
    // WITHOUT ROWID tablolar (v20: fx_rates, bank_holidays) birincil anahtar sırasıyla (rowid yok).
    const withoutRowid = db.prepare("SELECT wr FROM pragma_table_list WHERE name = ?").get(name)?.wr === 1;
    const order = withoutRowid ? cols.map((_, index) => index + 1).join(", ") : "rowid";
    const rows = db.prepare(`SELECT ${cols.map(col => `"${col}"`).join(", ")} FROM "${name}" ORDER BY ${order}`).all();
    out[name] = { cols, rows: rows.map(row => JSON.stringify(cols.map(col => (row[col] instanceof Uint8Array ? Buffer.from(row[col]).toString("base64") : row[col])))) };
  }
  return out;
}

const BANK_KEY = /^bank\.[a-z]+$/;
const parse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
const grantsOf = value => {
  const raw = parse(value || "[]", []);
  if (Array.isArray(raw)) return { add: raw, remove: [] };
  return { add: Array.isArray(raw?.add) ? raw.add : [], remove: Array.isArray(raw?.remove) ? raw.remove : [] };
};

/**
 * Göç öncesi ve sonrası anlık görüntülerini karşılaştırır. Dönüş: farkların açıklaması (boş = birebir aynı). hub: ortak katman
 * dosyası mı (yetki göçü yalnız orada).
 */
export function compareSnapshots(before, after, { hub }) {
  const problems = [];
  for (const [name, table] of Object.entries(before)) {
    const next = after[name];
    if (!next) {
      problems.push(`${name}: tablo göçten sonra yok`);
      continue;
    }
    if (name === "settings") {
      const keyAt = table.cols.indexOf("key");
      const strip = rows => rows.filter(row => JSON.parse(row)[keyAt] !== "meta.schema.v20At");
      if (JSON.stringify(strip(table.rows)) !== JSON.stringify(strip(next.rows))) problems.push("settings: meta.schema.v20At dışında ayar değişti");
      continue;
    }
    const special = { users: "grants_json", roles: "permissions_json" }[name];
    if (special && table.cols.includes(special)) {
      const at = table.cols.indexOf(special);
      if (table.rows.length !== next.rows.length) {
        problems.push(`${name}: satır sayısı ${table.rows.length} → ${next.rows.length}`);
        continue;
      }
      table.rows.forEach((row, index) => {
        const a = JSON.parse(row);
        const b = JSON.parse(next.rows[index]);
        const restA = a.filter((_, i) => i !== at);
        const restB = b.filter((_, i) => i !== at);
        if (JSON.stringify(restA) !== JSON.stringify(restB)) problems.push(`${name}[${index}]: ${special} dışındaki kolonlar değişti`);
        if (a[at] === b[at]) return;
        if (!hub) {
          problems.push(`${name}[${index}]: ortak katman dışında ${special} değişti`);
          return;
        }
        if (name === "roles") {
          const was = parse(a[at], []);
          const now = parse(b[at], []);
          const added = now.filter(item => !was.includes(item));
          if (!was.every(item => now.includes(item)) || !added.every(item => BANK_KEY.test(item))) problems.push(`roles[${index}]: yalnız banka yetkisi eklenmeli (${a[at]} → ${b[at]})`);
        } else {
          const was = grantsOf(a[at]);
          const now = grantsOf(b[at]);
          for (const side of ["add", "remove"]) {
            const added = now[side].filter(item => !was[side].includes(item));
            if (!was[side].every(item => now[side].includes(item)) || !added.every(item => BANK_KEY.test(item))) problems.push(`users[${index}].${side}: yalnız banka yetkisi eklenmeli (${a[at]} → ${b[at]})`);
          }
        }
      });
      continue;
    }
    if (JSON.stringify(table.rows) !== JSON.stringify(next.rows)) {
      const changed = table.rows.findIndex((row, index) => row !== next.rows[index]);
      problems.push(`${name}: satırlar değişti (${table.rows.length} → ${next.rows.length}; ilk fark ${changed}: ${String(table.rows[changed]).slice(0, 160)} → ${String(next.rows[changed]).slice(0, 160)})`);
    }
  }
  return problems;
}
