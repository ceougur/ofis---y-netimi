// 2.5.0 D2 — arşivin SALT OKUNUR açılmadan önceki hazırlığı (docs/devir/D2-ALTYAPI-TASARIM.md §3–§4; DEVIR-PLANI §2.1–§2.3, G6, G10.25–26).
//
// Sıra: dosya var mı → bütünlük (kayıttaki sha256 ↔ dosya; akışla, sonuç dosyanın boy + değişme zamanıyla önbellekte) → şema:
//   - şema < programın son göçü: ARŞİVİN GÖÇÜ — göç öncesi kopya (goc-oncesi-v<eski>.sqlite, yalnız en sonuncusu) → dosya KISA SÜRE yazılabilir açılır, göçler
//     koşar, günlük kipi DELETE'e döner (salt okunur bağlantı -wal/-shm yazmasın), kapanır → yeni sha256 kayda (önceki özet previousSha256'da).
//     Göç ancak bütünlük TUTARSA yapılır: değişmiş dosya güncel sürüme taşınmaz (409 archive-changed; Devir Yedekleri'nden dönülür).
//   - şema = son göç: dokunulmaz.
//   - şema > son göç (daha yeni sürümün arşivi; BS-7 kapısı arşive de): göç YOK, salt okunur açılır, şema uyarısı.
// Değişmiş arşiv (göç gerekmiyorsa) salt okunur açılır, uyarı taşır. Kayıtta özet yoksa (diskten tanınmış arşiv) ilk doğrulamada özet kayda yazılır (BİLİNEN SINIR:
// ilk kullanımda güven). Sonuç: { file, state, warning, schemaVersion, migrated }.
import { copyFileSync, existsSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { createStore, openDatabase } from "../db.mjs";
import { HttpError } from "../http.mjs";
import { LATEST_VERSION, runMigrations } from "../migrations.mjs";
import { PRE_MIGRATION_PREFIX, archiveDirOf, archiveFileOf, hashFile, readArchiveFacts } from "./archives.mjs";

const label = company => `${company.code} · ${company.name}`;

/** Bütünlük durumu: { state: "ok" | "changed" | "recovered", sha256, size } — önbellek: anahtar → { size, mtimeMs, sha256 }. */
export async function verifyArchive({ file, entry, cache = new Map(), key = file }) {
  let stats;
  try {
    stats = statSync(file);
  } catch {
    return { state: "missing", sha256: "", size: 0 };
  }
  const cached = cache.get(key);
  const sha256 = cached && cached.size === stats.size && cached.mtimeMs === stats.mtimeMs ? cached.sha256 : await hashFile(file);
  cache.set(key, { size: stats.size, mtimeMs: stats.mtimeMs, sha256 });
  if (!entry?.sha256) return { state: "recovered", sha256, size: stats.size };
  return { state: sha256 === entry.sha256 ? "ok" : "changed", sha256, size: stats.size };
}

/** Arşiv kaydı için ekran durumu (özet HESAPLANMAZ; yalnız önbellek + dosya boyu / zamanı — liste ucu olay döngüsünü tutmasın). */
export function archiveStatus({ file, entry, cache, key }) {
  let stats;
  try {
    stats = statSync(file);
  } catch {
    return { state: "missing", label: "Dosya Yok" };
  }
  const cached = cache?.get(key);
  if (!cached || cached.size !== stats.size || cached.mtimeMs !== stats.mtimeMs) return { state: entry?.sha256 ? "unverified" : "recovered", label: entry?.sha256 ? "Denetlenmedi" : "Diskten Tanındı", size: stats.size };
  if (!entry?.sha256) return { state: "recovered", label: "Diskten Tanındı", size: stats.size };
  return cached.sha256 === entry.sha256 ? { state: "ok", label: "Doğrulandı", size: stats.size } : { state: "changed", label: "Değişmiş", size: stats.size };
}

function migrateArchive({ file, dir, company, from, log, now }) {
  // Göç öncesi kopya: önce eski kopyalar kaldırılır (yalnız en son göçünki kalır), sonra geçici adla kopyalanıp asıl adına alınır.
  for (const name of readdirSync(dir)) if (name.startsWith(PRE_MIGRATION_PREFIX)) rmSync(path.join(dir, name), { force: true });
  const copy = path.join(dir, `${PRE_MIGRATION_PREFIX}${from}.sqlite`);
  copyFileSync(file, `${copy}.yaziliyor`);
  renameSync(`${copy}.yaziliyor`, copy);
  const db = openDatabase(file);
  try {
    runMigrations(createStore(db), { backupDir: null, log, company: { id: company.id, code: company.code, name: company.name }, now });
    db.exec("PRAGMA journal_mode = DELETE");
  } finally {
    db.close();
  }
  for (const suffix of ["-wal", "-shm"]) rmSync(`${file}${suffix}`, { force: true });
}

/**
 * @param {object} o
 * @param {object} o.company şirket kaydı
 * @param {object} o.entry arşiv kaydı (registry.archiveOf)
 * @param {object} o.registry şirket kayıt defteri (updateArchive, dirsOf)
 */
export async function prepareArchive({ company, entry, registry, log = null, now, cache = new Map(), key }) {
  const companyDataDir = registry.dirsOf(company).dataDir;
  const dir = archiveDirOf(companyDataDir, entry.year);
  const file = archiveFileOf(companyDataDir, entry.year);
  if (!existsSync(file)) throw new HttpError(503, `“${label(company)}” şirketinin ${entry.year} arşivinin dosyası bulunamadı (silinmiş ya da taşınmış olabilir). Yönetici Yönetim → Yedekler → Devir Yedekleri'nden geri yükleyebilir.`, { code: "archive-missing" });
  const facts = readArchiveFacts(file);
  if (!facts) throw new HttpError(503, `“${label(company)}” şirketinin ${entry.year} arşivi açılamadı (dosya bozuk olabilir). Yönetici Devir Yedekleri'nden geri yükleyebilir.`, { code: "archive-unreadable" });
  const integrity = await verifyArchive({ file, entry, cache, key });
  let warning = "";
  if (integrity.state === "recovered") {
    // İlk kullanımda güven: diskten tanınan arşivin özeti şimdi kayda girer.
    registry.updateArchive(company.id, entry.year, { sha256: integrity.sha256, size: integrity.size, verifiedAt: new Date().toISOString() });
  }
  if (integrity.state === "changed") {
    if (facts.schemaVersion < LATEST_VERSION) {
      throw new HttpError(409, `“${label(company)}” şirketinin ${entry.year} arşivi devirden sonra değişmiş görünüyor (bütünlük özeti tutmuyor); programın bu sürümüne taşınmadı. Yönetici Devir Yedekleri'nden geri yükleyebilir.`, { code: "archive-changed" });
    }
    warning = `${entry.year} arşivinin dosyası devirden sonra değişmiş görünüyor (bütünlük özeti tutmuyor); kayıtlar yalnız görüntülenir. Yönetici Devir Yedekleri'ni denetlemeli.`;
    log?.warn?.(`${label(company)} ${entry.year} arşivinin bütünlük özeti tutmuyor (kayıt ${String(entry.sha256).slice(0, 12)}…, dosya ${integrity.sha256.slice(0, 12)}…).`);
  }
  let migrated = false;
  let schemaVersion = facts.schemaVersion;
  if (integrity.state !== "changed" && facts.schemaVersion < LATEST_VERSION) {
    migrateArchive({ file, dir, company, from: facts.schemaVersion, log, now });
    const sha256 = await hashFile(file);
    const size = statSync(file).size;
    cache.set(key, { size, mtimeMs: statSync(file).mtimeMs, sha256 });
    registry.updateArchive(company.id, entry.year, { sha256, size, schemaVersion: LATEST_VERSION, migratedAt: new Date().toISOString(), migratedFrom: facts.schemaVersion, previousSha256: entry.sha256 || integrity.sha256 });
    log?.info?.(`${label(company)} ${entry.year} arşivi programın sürümüne taşındı (şema ${facts.schemaVersion} → ${LATEST_VERSION}); göç öncesi hâli ${PRE_MIGRATION_PREFIX}${facts.schemaVersion}.sqlite.`);
    migrated = true;
    schemaVersion = LATEST_VERSION;
  }
  return { file, state: integrity.state === "recovered" ? "ok" : integrity.state, warning, schemaVersion, migrated };
}
