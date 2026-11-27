// 2.5.0 D2 — arşivin SALT OKUNUR açılmadan önceki hazırlığı (docs/devir/D2-ALTYAPI-TASARIM.md §3–§4, §13; DEVIR-PLANI §2.1–§2.3, G6, G10.25–26).
//
// Sıra: dosya var mı → bütünlük (kayıttaki sha256 ↔ dosya; akışla, sonuç dosyanın boy + değişme zamanıyla önbellekte) → şema:
//   - şema < programın son göçü: ARŞİVİN GÖÇÜ, İKİ AŞAMALI (2.5.0 D2 tur 2 — dar kontrol ORTA-1; aşağıda migrateArchive): göç öncesi kopya
//     (goc-oncesi-v<eski>.sqlite, yalnız en sonuncusu) → göç ÇALIŞMA KOPYASINDA (goc-calisma.sqlite) → kopyanın özeti kayda BEKLEYEN özet (pendingSha256) →
//     kopya asıl dosyanın adına taşınır → kayıt kesinleşir (yeni sha256; önceki özet previousSha256'da). Asıl dosya taşımaya kadar değişmez.
//     Göç ancak bütünlük TUTARSA yapılır: değişmiş dosya güncel sürüme taşınmaz (409 archive-changed; Devir Yedekleri'nden dönülür).
//   - şema = son göç: dokunulmaz.
//   - şema > son göç (daha yeni sürümün arşivi; BS-7 kapısı arşive de): göç YOK, salt okunur açılır, şema uyarısı.
// Taşımadan sonra kesilen göç: dosyanın özeti kaydın bekleyen özetini tutar → değişmiş SAYILMAZ, kayıt kesinleştirilir (açılışta ve Doğrula'da aynı kural —
// commitPendingMigration). Değişmiş arşiv (göç gerekmiyorsa) salt okunur açılır, uyarı taşır. Kayıtta özet yoksa (diskten tanınmış arşiv) ilk doğrulamada özet kayda
// yazılır (BİLİNEN SINIR: ilk kullanımda güven). Sonuç: { file, state, warning, schemaVersion, migrated }.
// 2.5.0 D2 tur 3 (dar kontrol ORTA-2): yanında boş olmayan -wal / -journal (işlenmemiş günlük) olan arşiv DEĞİŞMİŞTİR (K2 aynen) — göç etmez, yan dosya silinmez; boş
// yan dosya yalnız göçün sonucu yerine geçerken silinir. Okunamayan (sıcak -journal) arşiv de yan dosyası varsa 409 archive-changed.
import { copyFileSync, existsSync, readdirSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { createStore, openDatabase } from "../db.mjs";
import { HttpError } from "../http.mjs";
import { LATEST_VERSION, runMigrations } from "../migrations.mjs";
import { MIGRATION_WORK_FILE, PRE_MIGRATION_PREFIX, archiveDirOf, archiveFileOf, archiveSideFile, clearEmptySideFiles, hashFile, readArchiveFacts } from "./archives.mjs";

const label = company => `${company.code} · ${company.name}`;
// 2.5.0 D2 tur 3: değişmiş arşivin nedeni (iletide; yan dosya varsa adıyla).
const changedReason = (file, side) => (side ? `yanında işlenmemiş günlük dosyası var: ${path.basename(file)}${side}` : "bütünlük özeti tutmuyor");
const changedArchive = (company, entry, file, side = "") =>
  new HttpError(409, `“${label(company)}” şirketinin ${entry.year} arşivi devirden sonra değişmiş görünüyor (${changedReason(file, side)}); programın bu sürümüne taşınmadı. Yönetici Devir Yedekleri'nden geri yükleyebilir.`, { code: "archive-changed", ...(side ? { side } : {}) });

/**
 * Bütünlük durumu: { state: "ok" | "changed" | "recovered", pending?, side?, sha256, size } — önbellek: anahtar → { size, mtimeMs, sha256 }.
 * 2.5.0 D2 tur 3 (dar kontrol ORTA-2): yanında boş olmayan -wal / -journal olan arşiv özeti tutsa da "changed" (side: sonek) — özet yalnız ana dosyanındır, işlenmemiş
 * günlükteki kayıt onda yok (lib/devir/archives.mjs archiveSideFile).
 */
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
  const side = archiveSideFile(file);
  if (side) return { state: "changed", side, sha256, size: stats.size };
  if (!entry?.sha256) return { state: "recovered", sha256, size: stats.size };
  // 2.5.0 D2 tur 2: taşımadan sonra kesilen göç — dosya programın kendi göç sonucunun özetini (bekleyen özet) tutuyor: değişmiş değildir, kayıt kesinleştirilir.
  if (entry.pendingSha256 && sha256 !== entry.sha256 && sha256 === entry.pendingSha256) return { state: "ok", pending: true, sha256, size: stats.size };
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
  // 2.5.0 D2 tur 3: yanında işlenmemiş günlük olan arşiv listede de "Değişmiş" (açılış ve Doğrula ile aynı kural; yalnız dosya boyu okunur).
  if (archiveSideFile(file)) return { state: "changed", label: "Değişmiş", size: stats.size };
  const cached = cache?.get(key);
  if (!cached || cached.size !== stats.size || cached.mtimeMs !== stats.mtimeMs) return { state: entry?.sha256 ? "unverified" : "recovered", label: entry?.sha256 ? "Denetlenmedi" : "Diskten Tanındı", size: stats.size };
  if (!entry?.sha256) return { state: "recovered", label: "Diskten Tanındı", size: stats.size };
  return cached.sha256 === entry.sha256 ? { state: "ok", label: "Doğrulandı", size: stats.size } : { state: "changed", label: "Değişmiş", size: stats.size };
}

/**
 * Taşımadan sonra kesilen göçün kaydını kesinleştirir (açılış ve Doğrula aynı kural): özet ve şema dosyanınki, göç bilgisi bekleyen alanlardan, bekleyen alanlar silinir.
 * schemaVersion: dosyanın şeması (readArchiveFacts). Dönüş: güncel kayıt.
 */
export function commitPendingMigration({ registry, company, entry, integrity, schemaVersion, log = null }) {
  const from = Number(entry.pendingFrom) || Number(entry.schemaVersion) || 0;
  const updated = registry.updateArchive(company.id, entry.year, {
    sha256: integrity.sha256,
    size: integrity.size,
    schemaVersion,
    migratedAt: entry.pendingAt || new Date().toISOString(),
    ...(from ? { migratedFrom: from } : {}),
    previousSha256: entry.sha256,
    pendingSha256: "",
    pendingFrom: "",
    pendingAt: "",
  });
  log?.warn?.(`${label(company)} ${entry.year} arşivinin göçü önceki çalışmada dosya yerine alındıktan sonra yarıda kalmıştı; dosya göçün sonucuyla aynı (özet ${integrity.sha256.slice(0, 12)}…), kayıt kesinleştirildi.`);
  return updated;
}

const removeWork = work => {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) rmSync(`${work}${suffix}`, { force: true });
};
const TRANSIENT_RENAME = new Set(["EPERM", "EBUSY", "EACCES"]);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
/** Çalışma kopyasını asıl dosyanın adına taşır (rename: atomik, hedefin yerine geçer). Windows'ta antivirüs / kısa süreli tutamak için birkaç kez dener (olay
 * döngüsü tutulmaz); her yeniden denemeden önce bakım denetimi. */
async function moveIntoPlace(work, file, guard) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      renameSync(work, file);
      return;
    } catch (error) {
      if (attempt >= 6 || !TRANSIENT_RENAME.has(error?.code)) throw error;
    }
    await sleep(100 * attempt);
    guard?.();
  }
}

// İKİ AŞAMALI GÖÇ (2.5.0 D2 tur 2 — dar kontrol ORTA-1; önceden dosya YERİNDE göç ediyor, yeni özet kayda akışla özet bittikten SONRA yazılıyordu → arada süreç
// ölünce arşiv kalıcı "Değişmiş", sonraki göçlü sürümde K2 ile hiç açılamaz). Asıl dosya taşımaya kadar DEĞİŞMEZ:
//   1. göç öncesi kopya (goc-oncesi-v<eski>.sqlite; yalnız en sonuncusu)
//   2. çalışma kopyası (goc-calisma.sqlite) yazılabilir açılır, göçler koşar, günlük kipi DELETE, kapanır; özeti akışla alınır
//   3. kayda BEKLEYEN özet (pendingSha256, pendingFrom, pendingAt)
//   4. çalışma kopyası asıl dosyanın adına taşınır (rename; Windows'ta açık tutamak yokken — özet akışı kapandı, olgu okuması ve göç bağlantısı kapandı; ders 48)
//   5. kayıt kesinleşir (sha256 = yeni özet, şema, göç bilgisi; bekleyen alanlar silinir)
// Kesinti 1–3 ya da 3–4 arasında: asıl dosya ve kayıttaki özet eski hâlinde (tutar) → sonraki açılış göçü baştan yapar (artık çalışma kopyası silinir, bekleyen özet
// yeniden yazılır). 4–5 arasında: dosya bekleyen özeti tutar → verifyArchive "ok + pending" → commitPendingMigration. Yeni kural yok: K1 (tembel göç), K2 (değişmiş + eski
// şema → 409) aynen; K2 yalnız gerçekten değişmiş dosyaya uygulanır.
// guard: ortak katmanın bakım denetimi (server/app.mjs openArchive) — özetten ve yeniden denemeden sonra; bakıma giren şirkette iş durur, çalışma kopyası silinir.
// step: YALNIZ TEST kesme noktaları (server/app.mjs __testArchiveStep; test/devir-d2-arsiv-goc-kesinti-250.test.mjs); üretimde verilmez.
async function migrateArchive({ file, dir, company, entry, previousSha256, from, registry, log, now, guard, step }) {
  for (const name of readdirSync(dir)) if (name.startsWith(PRE_MIGRATION_PREFIX)) rmSync(path.join(dir, name), { force: true });
  const copy = path.join(dir, `${PRE_MIGRATION_PREFIX}${from}.sqlite`);
  copyFileSync(file, `${copy}.yaziliyor`);
  renameSync(`${copy}.yaziliyor`, copy);
  const work = path.join(dir, MIGRATION_WORK_FILE);
  let moved = false;
  removeWork(work);
  try {
    copyFileSync(file, work);
    const db = openDatabase(work);
    try {
      runMigrations(createStore(db), { backupDir: null, log, company: { id: company.id, code: company.code, name: company.name }, now });
      db.exec("PRAGMA journal_mode = DELETE");
    } finally {
      db.close();
    }
    for (const suffix of ["-wal", "-shm"]) rmSync(`${work}${suffix}`, { force: true });
    step?.("kopya-goc-etti");
    const sha256 = await hashFile(work);
    const size = statSync(work).size;
    guard?.();
    const pendingAt = new Date().toISOString();
    registry.updateArchive(company.id, entry.year, { pendingSha256: sha256, pendingFrom: from, pendingAt });
    step?.("bekleyen-yazildi");
    // Asıl dosya hiç yazılabilir açılmaz (günlük dosyası olmaz). 2.5.0 D2 tur 3 (dar kontrol ORTA-2): yanındaki yan dosyalar KÖRÜ KÖRÜNE silinmez — önceden -wal / -shm
    // burada siliniyordu, -wal'da kesinleşmiş kayıt sessizce kayboluyordu. Boş olmayan -wal / -journal (bu arada belirmiş işlenmemiş günlük) → taşınmaz, silinmez
    // (değişmiş arşiv, K2: 409); yalnız boş olanlar, yeni dosyaya uygulanmasın diye silinir.
    const side = clearEmptySideFiles(file);
    if (side) {
      // Göç olmadı: kayıttaki bekleyen özet de geri alınır (kayıt göçten önceki hâlinde kalır).
      registry.updateArchive(company.id, entry.year, { pendingSha256: "", pendingFrom: "", pendingAt: "" });
      throw changedArchive(company, entry, file, side);
    }
    await moveIntoPlace(work, file, guard);
    moved = true;
    step?.("tasindi");
    registry.updateArchive(company.id, entry.year, { sha256, size, schemaVersion: LATEST_VERSION, migratedAt: pendingAt, migratedFrom: from, previousSha256, pendingSha256: "", pendingFrom: "", pendingAt: "" });
    return { sha256, size };
  } finally {
    if (!moved) removeWork(work);
  }
}

/**
 * @param {object} o
 * @param {object} o.company şirket kaydı
 * @param {object} o.entry arşiv kaydı (registry.archiveOf)
 * @param {object} o.registry şirket kayıt defteri (updateArchive, dirsOf)
 * @param {() => void} [o.guard] her beklemeden sonra çağrılır; fırlatırsa (bakım kipi) arşive / kayda yazılmadan durur
 * @param {(name: string) => void} [o.step] YALNIZ TEST kesme noktaları
 */
export async function prepareArchive({ company, entry, registry, log = null, now, cache = new Map(), key, guard = null, step = null }) {
  const companyDataDir = registry.dirsOf(company).dataDir;
  const dir = archiveDirOf(companyDataDir, entry.year);
  const file = archiveFileOf(companyDataDir, entry.year);
  if (!existsSync(file)) throw new HttpError(503, `“${label(company)}” şirketinin ${entry.year} arşivinin dosyası bulunamadı (silinmiş ya da taşınmış olabilir). Yönetici Yönetim → Yedekler → Devir Yedekleri'nden geri yükleyebilir.`, { code: "archive-missing" });
  const facts = readArchiveFacts(file);
  if (!facts) {
    // 2.5.0 D2 tur 3: yarıda kalmış yazımın günlüğü (-journal) yanındaysa salt okunur bağlantı dosyayı okuyamaz (geri alma yazım ister) — değişmiş arşivdir, dokunulmaz.
    const side = archiveSideFile(file);
    if (side) throw changedArchive(company, entry, file, side);
    throw new HttpError(503, `“${label(company)}” şirketinin ${entry.year} arşivi açılamadı (dosya bozuk olabilir). Yönetici Devir Yedekleri'nden geri yükleyebilir.`, { code: "archive-unreadable" });
  }
  const integrity = await verifyArchive({ file, entry, cache, key });
  // 2.5.0 D2 tur 2 (dar kontrol ORTA-2): özet alınırken şirket bakıma girdiyse arşive ve kayda hiçbir şey yazılmaz.
  guard?.();
  let warning = "";
  if (integrity.state === "recovered") {
    // İlk kullanımda güven: diskten tanınan arşivin özeti şimdi kayda girer.
    registry.updateArchive(company.id, entry.year, { sha256: integrity.sha256, size: integrity.size, verifiedAt: new Date().toISOString() });
  }
  if (integrity.pending) commitPendingMigration({ registry, company, entry, integrity, schemaVersion: facts.schemaVersion, log });
  if (integrity.state === "changed") {
    if (facts.schemaVersion < LATEST_VERSION) throw changedArchive(company, entry, file, integrity.side);
    warning = `${entry.year} arşivinin dosyası devirden sonra değişmiş görünüyor (${changedReason(file, integrity.side)}); kayıtlar yalnız görüntülenir. Yönetici Devir Yedekleri'ni denetlemeli.`;
    log?.warn?.(integrity.side
      ? `${label(company)} ${entry.year} arşivinin yanında işlenmemiş günlük dosyası var (${path.basename(file)}${integrity.side}); arşiv değişmiş sayıldı, göç edilmedi, yan dosyaya dokunulmadı.`
      : `${label(company)} ${entry.year} arşivinin bütünlük özeti tutmuyor (kayıt ${String(entry.sha256).slice(0, 12)}…, dosya ${integrity.sha256.slice(0, 12)}…).`);
  }
  let migrated = false;
  let schemaVersion = facts.schemaVersion;
  if (integrity.state !== "changed" && facts.schemaVersion < LATEST_VERSION) {
    // Önceki özet: doğrulanan dosyanınki (bekleyen özet kesinleştiyse o; diskten tanınmışsa ilk özet).
    const result = await migrateArchive({ file, dir, company, entry, previousSha256: integrity.sha256, from: facts.schemaVersion, registry, log, now, guard, step });
    cache.set(key, { size: result.size, mtimeMs: statSync(file).mtimeMs, sha256: result.sha256 });
    log?.info?.(`${label(company)} ${entry.year} arşivi programın sürümüne taşındı (şema ${facts.schemaVersion} → ${LATEST_VERSION}); göç öncesi hâli ${PRE_MIGRATION_PREFIX}${facts.schemaVersion}.sqlite.`);
    migrated = true;
    schemaVersion = LATEST_VERSION;
  }
  return { file, state: integrity.state === "recovered" ? "ok" : integrity.state, warning, schemaVersion, migrated };
}
