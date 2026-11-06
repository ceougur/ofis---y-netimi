// 2.5.0 D2 testlerinin ortak yardımcıları (docs/devir/D2-ALTYAPI-TASARIM.md §10). Test dosyası DEĞİL (adı .test.mjs ile bitmez).
//   - writeRoutes / getRoutes: programın bütün yazma / sabit okuma uçları KAYNAKTAN (tahminle değil; yeni uç eklenince kendiliğinden girer). Yazma uçlarında
//     kayıt sayısı kaynaktaki router.post/put/patch/delete çağrı sayısıyla karşılaştırılır (sessizce atlanan kayıt olmasın).
//   - fingerprint: dosyanın mantıksal parmak izi (tablo → satır özeti); ortak katman tabloları / ortak ayar anahtarları ayrılabilir.
//   - makeArchive: D4'ün (devri yapan iş akışı) bırakacağı arşivin BENZETİMİ — şirket dosyasının tutarlı kopyası (VACUUM INTO) arsiv/<yıl>/'a, içine arşiv işareti,
//     çalışma dosyasına devir yılı, kayıt defterine girdi (sha256). Devrin para / budama kuralı burada YOK (D3–D4).
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { ARCHIVE_MARK_KEY, DEVIR_YEARS_KEY, archiveDirOf, hashFile } from "../server/lib/devir/archives.mjs";
import { commonLayer } from "../server/lib/company-backups.mjs";
import { resolveDbPath } from "../server/lib/db-path.mjs";

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "server");

function sources() {
  const out = [];
  const walk = folder => {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".mjs")) out.push({ file: full, text: readFileSync(full, "utf8") });
    }
  };
  walk(SERVER);
  return out;
}
// Dosyadaki "/api/…" sabitleri (const BASE = "/api/…"; girintili de) — şablondaki ${BASE} ve çıplak BASE bunlarla çözülür.
const constantsOf = text => new Map([...text.matchAll(/const (\w+) = "(\/api\/[^"]+)"/g)].map(match => [match[1], match[2]]));

/** Bütün yazma uçları: [{ method, route, path, file }] — :parametre ve çözülemeyen ${…} "x" olur (kapı yönlendiriciden önce; yol yine de gerçek kayıttır). */
export function writeRoutes() {
  const found = [];
  let registrations = 0;
  for (const { file, text } of sources()) {
    const constants = constantsOf(text);
    registrations += [...text.matchAll(/router\.(post|put|patch|delete)\(/g)].length;
    for (const match of text.matchAll(/router\.(post|put|patch|delete)\(\s*(?:"(\/api\/[^"]+)"|`([^`]+)`|([A-Z_]+)\b)/g)) {
      const method = match[1].toUpperCase();
      let route = match[2] ?? match[3] ?? constants.get(match[4]) ?? null;
      if (route === null) continue;
      route = route.replace(/\$\{(\w+)\}/g, (all, name) => constants.get(name) ?? "x");
      if (!route.startsWith("/api/")) continue;
      found.push({ method, route, path: route.replace(/:[A-Za-z]+/g, "x"), file: path.relative(SERVER, file).split(path.sep).join("/") });
    }
  }
  return { routes: found, registrations };
}

/** Bütün sabit GET uçları (parametresiz; canlı olay akışı hariç) — test/sema-kapisi-bs7.test.mjs ile aynı tarama. */
export function getRoutes() {
  const found = new Set();
  for (const { text } of sources()) {
    const constants = constantsOf(text);
    for (const match of text.matchAll(/router\.get\(\s*(?:"(\/api\/[^"]+)"|`([^`]+)`)/g)) {
      const route = match[1] ?? match[2].replace(/\$\{(\w+)\}/g, (all, name) => constants.get(name) ?? all);
      if (route.startsWith("/api/") && !route.includes(":") && !route.includes("${")) found.add(route);
    }
  }
  found.delete("/api/events");
  return [...found].sort();
}

// Ortak katman yolları (server/app.mjs HUB_ONLY ile aynı ifade; değişirse test kırılır — aşağıdaki assert).
export const HUB_ONLY = /^\/api\/(auth|public|license|companies|health|admin\/(users|roles|recovery|update|backups|mobile|devir|maintenance))(\/|$)/;
// Bakım kipinde ortak katmanda da kapalı olanlar (server/app.mjs MAINTENANCE_HUB_BLOCKED).
export const HUB_BLOCKED = /^\/api\/(?:companies(?!\/select$)(?:\/|$)|admin\/(?:backups|update|devir)(?:\/|$))/;

/** Dosyanın mantıksal parmak izi. skip: atlanacak tablolar; commonSettings: false → settings'te yalnız ORTAK OLMAYAN anahtarlar (001'de giriş / lisans yazılır). */
export function fingerprint(file, { skip = [], commonSettings = true } = {}) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const out = { user_version: db.prepare("PRAGMA user_version").get().user_version };
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name);
    out.schema = createHash("sha256").update(JSON.stringify(db.prepare("SELECT type, name, sql FROM sqlite_master ORDER BY type, name").all())).digest("hex");
    for (const table of tables) {
      if (skip.includes(table)) continue;
      const sql = table === "settings" && !commonSettings ? `SELECT * FROM settings WHERE NOT (${commonLayer().settingsSql})` : `SELECT * FROM "${table}"`;
      const rows = db.prepare(sql).all().map(row => JSON.stringify(row)).sort();
      out[table] = createHash("sha256").update(rows.join("\n")).digest("hex");
    }
    return out;
  } finally {
    db.close();
  }
}
export const diffKeys = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(key => a[key] !== b[key]);

/** Şirket kaydı (dir alanıyla) — API'nin döndürdüğü özet nesne veri klasörünü taşımaz. */
export const companyOf = (app, id) => app.companies.get(id);
export const companyDbFile = (app, id) => resolveDbPath(app.companies.dirsOf(companyOf(app, id)).dataDir);

/**
 * D4 benzetimi: şirketin o anki dosyasından arşiv (VACUUM INTO → arsiv/<yıl>/destekofis.sqlite, günlük kipi DELETE), arşivin içine işaret, çalışma dosyasına
 * devir yılı (setSetting: canlı örneğin deposu), kayıt defterine girdi. register: false → yalnız dosyalar (diskten tanıma testleri).
 */
export async function makeArchive(app, companyId, { year = "2025", cutoff = `${year}-12-31`, runId = `devir-${year}-test`, register = true, liveYears = true, mark = true, markCompanyId = companyId } = {}) {
  const company = companyOf(app, companyId);
  const dir = archiveDirOf(app.companies.dirsOf(company).dataDir, year);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "destekofis.sqlite");
  const target = file.replace(/'/g, "''");
  app.context.withCompanyDb(company, db => db.exec(`VACUUM INTO '${target}'`));
  if (mark) {
    const archiveDb = new DatabaseSync(file);
    try {
      archiveDb.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(ARCHIVE_MARK_KEY, JSON.stringify({ companyId: markCompanyId, year, cutoff, runId, createdAt: new Date().toISOString() }), new Date().toISOString());
      archiveDb.prepare("DELETE FROM settings WHERE key = ?").run(DEVIR_YEARS_KEY);
    } finally {
      archiveDb.close();
    }
  }
  if (liveYears) {
    const live = companyId === app.companyId ? app.store : app.openCompany(companyId)?.store;
    const years = (() => {
      try {
        return JSON.parse((live ? live.setting(DEVIR_YEARS_KEY, "") : "") || "[]");
      } catch {
        return [];
      }
    })().filter(item => item.year !== year);
    const value = JSON.stringify([...years, { year, cutoff, runId, at: new Date().toISOString() }]);
    if (live) live.setSetting(DEVIR_YEARS_KEY, value);
    else {
      const db = new DatabaseSync(companyDbFile(app, companyId));
      try {
        db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(DEVIR_YEARS_KEY, value, new Date().toISOString());
      } finally {
        db.close();
      }
    }
  }
  const sha256 = await hashFile(file);
  if (register) app.companies.addArchive(companyId, { year, cutoff, runId, sha256, schemaVersion: schemaOf(file), createdAt: new Date().toISOString() });
  return { file, dir, sha256, year, runId };
}
export function schemaOf(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return db.prepare("PRAGMA user_version").get().user_version;
  } finally {
    db.close();
  }
}
/** Dosyanın içindeki bir ayarı doğrudan yazar (kapalı / açık olmayan dosya; benzetim). */
export function writeSettingRaw(file, key, value) {
  const db = new DatabaseSync(file);
  try {
    db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value, new Date().toISOString());
  } finally {
    db.close();
  }
}
