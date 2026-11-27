// 2.5.0 D2 — KALICI DEVİR YEDEĞİ (docs/devir/D2-ALTYAPI-TASARIM.md §6; DEVIR-PLANI G5).
//
// Sorun (P1): "devir-oncesi" etiketli sıradan yedek rutin sayılıyordu (SAFETY_LABEL'de yok → ~7,5 iş gününde budanır); etiket eklemek de yetmezdi (güvenlik
// yedekleri 20'lik kuyruğu paylaşır). Ayrıca yedek yalnız veri tabanıydı: arşiv klasörü, belgeler/, secret.key, mesaj-arsivi/ yedekte yoktu.
// Çözüm: devir yedeği AYRI SINIF ve AYRI KUYRUK — şirketin yedek klasöründe devir-yedekleri/<zaman>-<etiket>/ alt klasörü. Budama (lib/backup.mjs pruneBackups)
// yalnız klasörün kendi düzeyindeki yedek dosyalarını görür → bu klasörler HİÇ budanmaz; ad / kod değişince yedek klasörüyle birlikte taşınır.
// İçerik: veri tabanının tutarlı kopyası (createBackup: VACUUM INTO + şirket kimliği + kullanım defteri), arsiv/ (bütün arşivler), belgeler/, mesaj-arsivi/,
// secret.key (şifreli ayarların anahtarı — yedekten dönünce entegratör / WhatsApp gizlileri açılabilsin) ve devir-yedegi.json (her dosyanın boyu + SHA-256).
// Önce <ad>.yaziliyor klasörüne yazılır, bitince asıl adına alınır: yarım kalan yedek listede "tamam" görünmez.
// 2.5.1 D4-ÖN (CI Windows Node 22, 26.11: son ada alırken EPERM): Windows'ta antivirüs / dizinleyici yeni yazılan dosyayı kısa süre tutar; klasörün içinde açık tutamak
// varken klasör taşınamaz. Taşıma programın öbür taşıma yollarının yardımcısıyla (lib/app-layout.mjs renameWithRetry: EPERM / EBUSY / EACCES / ENOTEMPTY, 12 deneme)
// yeniden denenir. BEKLEME OLAY DÖNGÜSÜNÜ TUTAR: yalnız geçici hatada, denemeler arası 50, 100, … 550 ms — en kötü durumda toplam ~3,3 sn (ilk denemede başarırsa 0);
// yedek bakım kipinde alınır (D4), kısa tutma kabul. Taşıma son denemede de olmazsa (ya da yeniden denenmeyen bir hatada) yazılmış klasör SİLİNMEZ: listede "yarım"
// kalır (içerik tamdır), anlaşılır Türkçe hata (503 devir-backup-move) döner. Yazma sırasındaki hatada yarım klasör silinir; silme de düşerse (Windows'ta tutulan dosya)
// asıl hata ezilmez (ders 21), kalan klasör listede "yarım".
// Geri yükleme (Devri Geri Al) D4'ün işi; burada oluşturma, listeleme ve doğrulama.
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, rmdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { cp } from "node:fs/promises";
import path from "node:path";
import { renameWithRetry } from "../app-layout.mjs";
import { createBackup } from "../backup.mjs";
import { HttpError } from "../http.mjs";
import { ARCHIVE_ROOT, isArchiveTransient } from "./archives.mjs";

export const DEVIR_BACKUP_DIR = "devir-yedekleri";
export const DEVIR_BACKUP_MANIFEST = "devir-yedegi.json";
// 2.5.1 D4-ÖN tur 2: veri tabanı kopyasının yazıldığı KISA çalışma klasörü (devir-yedekleri\.vt\; Windows 260 karakter sınırı) — yedek listesinde görünmez.
export const DEVIR_BACKUP_WORK = ".vt";
// Etiket sınıfı: devirden, Devri Yenile'den ve Devri Geri Al'dan önce (G5: üçü de aynı sınıf).
export const DEVIR_BACKUP_LABEL = /^(?:devir-oncesi|devri-yenile-oncesi|devri-geri-al-oncesi)-\d{4}$/;
const NAME = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-z0-9-]+$/;
// Şirket klasöründen yedeğe giren dosyalar (company-separate.mjs COMPANY_FILES ile aynı + arşiv).
export const DEVIR_BACKUP_ITEMS = [ARCHIVE_ROOT, "belgeler", "mesaj-arsivi", "secret.key"];

export const devirBackupRoot = companyBackupDir => path.join(companyBackupDir, DEVIR_BACKUP_DIR);
const stampNow = () => new Date().toISOString().replace(/[:.]/g, "-");
const posix = value => value.split(path.sep).join("/");

// 2.5.1 D4-ÖN tur 2 (H4, docs/devir/2.5.1-DEVAM/d4ont2-rapor.md): özet, akışın tutamağı KAPANINCA ("close") döner — "end"de dönünce son dosyanın tutamağı
// klasör son adına alınırken hâlâ kapanıyor olabiliyordu (Windows'ta açık tutamaklı klasör taşınamaz; yeniden deneme örtüyordu, kendi tutamağımız yarışa girmez).
function hashFile(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    let digest = null;
    createReadStream(file, { highWaterMark: 1 << 20 })
      .on("data", chunk => hash.update(chunk))
      .on("error", reject)
      .on("end", () => {
        digest = hash.digest("hex");
      })
      .on("close", () => (digest === null ? reject(new Error(`okuma yarıda kaldı: ${file}`)) : resolve(digest)));
  });
}
function walk(dir, base = dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, out);
    else if (entry.isFile()) out.push(full);
  }
  return out;
}
async function manifestFiles(dir) {
  const files = [];
  for (const file of walk(dir).sort()) {
    if (path.basename(file) === DEVIR_BACKUP_MANIFEST) continue;
    files.push({ path: posix(path.relative(dir, file)), size: statSync(file).size, sha256: await hashFile(file) });
  }
  return files;
}

/**
 * Kalıcı devir yedeği alır. db: şirketin açık bağlantısı ya da kısa süreli salt okunur bağlantı (VACUUM INTO okuma işidir).
 * @returns {{ name, path, size, files, manifest }}
 */
export async function createDevirBackup({ db, company, companyDataDir, backupDir, label, year, runId = "", by = null, usageRows = null, stamp = stampNow() }) {
  if (!DEVIR_BACKUP_LABEL.test(String(label || ""))) throw new HttpError(400, "Devir yedeği etiketi devir-oncesi-<yıl>, devri-yenile-oncesi-<yıl> ya da devri-geri-al-oncesi-<yıl> olmalı.");
  const root = devirBackupRoot(backupDir);
  mkdirSync(root, { recursive: true });
  const name = `${stamp}-${label}`;
  if (!NAME.test(name)) throw new HttpError(400, "Geçersiz devir yedeği adı.");
  const final = path.join(root, name);
  if (existsSync(final)) throw new HttpError(409, "Aynı adla devir yedeği zaten var.", { code: "devir-backup-exists" });
  const partial = `${final}.yaziliyor`;
  rmSync(partial, { recursive: true, force: true });
  mkdirSync(partial, { recursive: true });
  const work = path.join(root, DEVIR_BACKUP_WORK);
  let written = null;
  let staged = null;
  try {
    // 2.5.1 D4-ÖN tur 2 (CI #1115 Windows: "unable to open database file"; docs/devir/2.5.1-DEVAM/d4ont2-rapor.md §1): veri tabanı kopyası yarım klasöre DOĞRUDAN
    // yazılınca yolda zaman + etiket iki kez geçiyordu (<zaman>-<etiket>.yaziliyor\destekofis-<kod>-<zaman>-<etiket>.sqlite.yaziliyor-journal); SQLite Windows'ta
    // 260 karakteri aşan yolu açamaz → uzun etiketli (Devri Yenile / Devri Geri Al) ya da uzun adlı şirkette devir yedeği HİÇ alınamıyordu. Kopya kısa çalışma
    // klasöründe (devir-yedekleri\.vt\) yazılır, sonra yarım klasöre taşınır (node:fs uzun yolu taşır). keep: çalışma klasöründe tek dosya durur; budama yalnız onu görür.
    removeStaleWork(work);
    const database = createBackup(db, work, { label, keep: 1000, company, stamp, usageRows, moveRetry: true });
    staged = database.path;
    renameWithRetry(staged, path.join(partial, database.name));
    staged = null;
    removeWorkDir(work);
    const included = [];
    for (const item of DEVIR_BACKUP_ITEMS) {
      const source = path.join(companyDataDir, item);
      if (!existsSync(source)) continue;
      // Arşivin göç öncesi kopyaları (goc-oncesi-v*.sqlite) yedeğe girmez: arşivin kendisi yeter, yedek iki kat büyümesin. 2.5.0 D2 tur 2: yarıda kalmış göçün
      // çalışma kopyası (goc-calisma.sqlite*) da girmez (geçici dosya; bir sonraki göç siler).
      await cp(source, path.join(partial, item), { recursive: true, errorOnExist: true, force: false, filter: src => !(item === ARCHIVE_ROOT && isArchiveTransient(path.basename(src))) });
      included.push(item);
    }
    const files = await manifestFiles(partial);
    const manifest = {
      kind: "devir-yedegi",
      version: 1,
      name,
      label,
      year: String(year || ""),
      runId: String(runId || ""),
      company: { id: company.id, code: company.code, name: company.name },
      createdAt: new Date().toISOString(),
      createdBy: by ? { id: by.id || "", name: by.display_name || by.username || "" } : null,
      database: database.name,
      included,
      files,
      size: files.reduce((sum, file) => sum + file.size, 0),
    };
    writeFileSync(path.join(partial, DEVIR_BACKUP_MANIFEST), JSON.stringify(manifest, null, 2));
    written = { size: manifest.size, files: files.length, manifest };
  } catch (error) {
    try {
      if (staged) rmSync(staged, { force: true });
      rmSync(partial, { recursive: true, force: true });
    } catch {
      // temizlik hatası asıl hatayı ezmez (ders 21); kalan klasör listede "yarım"
    }
    removeWorkDir(work);
    throw writeFailure(error, label);
  }
  try {
    renameWithRetry(partial, final);
  } catch (error) {
    throw new HttpError(503, `Devir yedeği yazıldı ama tamamlanamadı: yedek klasörü son adına alınamadı (${moveFailureReason(error)}). ${operationOf(label)} bu yedek tamamlanmadan yapılmaz; verilerinizde değişiklik olmadı. Birkaç dakika bekleyip yeniden deneyin. Yazılan yedek silinmedi: Yönetim → Yedekler → Devir Yedekleri'nde “Yarım Kaldı” olarak görünür.`, { code: "devir-backup-move", cause: String(error?.code || error?.message || error), partial: path.basename(partial), retryAfter: 30 });
  }
  return { name, path: final, ...written };
}
// Kısa çalışma klasörünün (DEVIR_BACKUP_WORK) yarıda kesilmiş eski yazımı (1 saatten eski) silinir; klasör boşalınca kaldırılır.
function removeStaleWork(work) {
  let entries = [];
  try {
    entries = readdirSync(work);
  } catch {
    return;
  }
  for (const entry of entries) {
    try {
      if (Date.now() - statSync(path.join(work, entry)).mtimeMs > 3_600_000) rmSync(path.join(work, entry), { recursive: true, force: true });
    } catch {
      // başka bir yedek yazıyor olabilir
    }
  }
}
function removeWorkDir(work) {
  try {
    rmdirSync(work);
  } catch {
    // boş değil (eşzamanlı yazım) ya da yok
  }
}
// İletide geçen iş adı (etiket sınıfından).
const operationOf = label => (String(label).startsWith("devri-yenile-oncesi") ? "Devri Yenile" : String(label).startsWith("devri-geri-al-oncesi") ? "Devri Geri Al" : "Devir");
// DEVİR NEDEN DURDU (kullanıcı kararı 27.11.2026): yazma hatası kullanıcıya açık Türkçe — ne oldu, neden, ne yapmalı, nereye; iç kod / İngilizce ileti yalnız makine alanında (cause).
function writeFailure(error, label) {
  if (error instanceof HttpError) return error;
  const code = String(error?.code || "");
  const sqlite = code === "ERR_SQLITE_ERROR" ? Number(error?.errcode) & 0xff : 0;
  let why = "dosyalar yedek klasörüne yazılamadı";
  let todo = "Birkaç dakika sonra yeniden deneyin; sorun sürerse bu iletiyi destek ekibine iletin.";
  if (sqlite === 13 || code === "ENOSPC") {
    why = "diskte yer kalmadı";
    todo = "Yedeklerin bulunduğu diskte yer açıp yeniden deneyin.";
  } else if (sqlite === 14 || code === "ENAMETOOLONG") {
    why = "veri tabanının kopyası yedek klasöründe açılamadı (klasörün yolu çok uzun ya da klasöre yazma izni yok)";
    todo = "Şirket adı çok uzunsa Yönetim → Şirketler'den kısaltıp ya da programı daha kısa bir klasöre kurup yeniden deneyin.";
  } else if (code === "EPERM" || code === "EBUSY" || code === "EACCES" || sqlite === 5 || sqlite === 6) {
    why = "yedek klasöründeki bir dosya başka bir programca (ör. virüs tarayıcısı) kullanılıyor ya da klasöre yazma izni yok";
    todo = "Birkaç dakika bekleyip yeniden deneyin.";
  }
  const cause = String(sqlite ? `${code} ${error?.errcode} ${error?.message || ""}` : code || error?.message || error).trim();
  return new HttpError(503, `Devir yedeği alınamadı: ${why}. ${operationOf(label)} bu yedek olmadan yapılmaz; verilerinizde değişiklik olmadı. ${todo}`, { code: "devir-backup-write", cause, retryAfter: 30 });
}
// Taşıma hatasının kullanıcıya giden nedeni (iç kod iletiye girmez; makine alanında cause).
function moveFailureReason(error) {
  const code = String(error?.code || "");
  if (code === "EPERM" || code === "EBUSY" || code === "EACCES") return "klasördeki bir dosya başka bir programca (ör. virüs tarayıcısı) kullanılıyor";
  if (code === "ENOTEMPTY" || code === "EEXIST") return "aynı adla klasör var";
  return "dosya sistemi taşımaya izin vermedi";
}

const readManifest = dir => {
  try {
    const value = JSON.parse(readFileSync(path.join(dir, DEVIR_BACKUP_MANIFEST), "utf8"));
    return value && value.kind === "devir-yedegi" ? value : null;
  } catch {
    return null;
  }
};

/** Şirketin devir yedekleri (yenisi önce). Yarım (.yaziliyor) klasör "yarım" durumuyla gelir; bildirgesi okunamayan "bozuk". Hiçbir dosyaya dokunmaz. */
export function listDevirBackups(companyBackupDir) {
  const root = devirBackupRoot(companyBackupDir);
  let entries = [];
  try {
    entries = readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && entry.name !== DEVIR_BACKUP_WORK);
  } catch {
    return [];
  }
  return entries
    .map(entry => {
      const dir = path.join(root, entry.name);
      if (entry.name.endsWith(".yaziliyor")) return { name: entry.name.slice(0, -".yaziliyor".length), state: "yarim", dir };
      const manifest = readManifest(dir);
      if (!manifest) return { name: entry.name, state: "bozuk", dir };
      return { name: manifest.name, state: "tamam", dir, label: manifest.label, year: manifest.year, runId: manifest.runId, company: manifest.company, createdAt: manifest.createdAt, createdBy: manifest.createdBy, size: manifest.size, files: manifest.files.length, included: manifest.included, database: manifest.database };
    })
    .sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
}

/** Bildirgeyle karşılaştırır: her dosya var mı, boyu ve özeti aynı mı; bildirgede olmayan dosya var mı. */
export async function verifyDevirBackup(dir) {
  const manifest = readManifest(dir);
  if (!manifest) return { ok: false, missing: [], changed: [], extra: [], error: "devir-yedegi.json okunamadı" };
  const missing = [];
  const changed = [];
  for (const file of manifest.files) {
    const full = path.join(dir, ...file.path.split("/"));
    if (!existsSync(full)) {
      missing.push(file.path);
      continue;
    }
    if (statSync(full).size !== file.size || (await hashFile(full)) !== file.sha256) changed.push(file.path);
  }
  const known = new Set(manifest.files.map(file => file.path));
  const extra = walk(dir).map(file => posix(path.relative(dir, file))).filter(file => file !== DEVIR_BACKUP_MANIFEST && !known.has(file));
  return { ok: !missing.length && !changed.length && !extra.length, missing, changed, extra, files: manifest.files.length };
}
