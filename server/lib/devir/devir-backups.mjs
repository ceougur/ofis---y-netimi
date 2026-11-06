// 2.5.0 D2 — KALICI DEVİR YEDEĞİ (docs/devir/D2-ALTYAPI-TASARIM.md §6; DEVIR-PLANI G5).
//
// Sorun (P1): "devir-oncesi" etiketli sıradan yedek rutin sayılıyordu (SAFETY_LABEL'de yok → ~7,5 iş gününde budanır); etiket eklemek de yetmezdi (güvenlik
// yedekleri 20'lik kuyruğu paylaşır). Ayrıca yedek yalnız veri tabanıydı: arşiv klasörü, belgeler/, secret.key, mesaj-arsivi/ yedekte yoktu.
// Çözüm: devir yedeği AYRI SINIF ve AYRI KUYRUK — şirketin yedek klasöründe devir-yedekleri/<zaman>-<etiket>/ alt klasörü. Budama (lib/backup.mjs pruneBackups)
// yalnız klasörün kendi düzeyindeki yedek dosyalarını görür → bu klasörler HİÇ budanmaz; ad / kod değişince yedek klasörüyle birlikte taşınır.
// İçerik: veri tabanının tutarlı kopyası (createBackup: VACUUM INTO + şirket kimliği + kullanım defteri), arsiv/ (bütün arşivler), belgeler/, mesaj-arsivi/,
// secret.key (şifreli ayarların anahtarı — yedekten dönünce entegratör / WhatsApp gizlileri açılabilsin) ve devir-yedegi.json (her dosyanın boyu + SHA-256).
// Önce <ad>.yaziliyor klasörüne yazılır, bitince asıl adına alınır: yarım kalan yedek listede "tamam" görünmez.
// Geri yükleme (Devri Geri Al) D4'ün işi; burada oluşturma, listeleme ve doğrulama.
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { cp } from "node:fs/promises";
import path from "node:path";
import { createBackup } from "../backup.mjs";
import { HttpError } from "../http.mjs";
import { ARCHIVE_ROOT, isArchiveTransient } from "./archives.mjs";

export const DEVIR_BACKUP_DIR = "devir-yedekleri";
export const DEVIR_BACKUP_MANIFEST = "devir-yedegi.json";
// Etiket sınıfı: devirden, Devri Yenile'den ve Devri Geri Al'dan önce (G5: üçü de aynı sınıf).
export const DEVIR_BACKUP_LABEL = /^(?:devir-oncesi|devri-yenile-oncesi|devri-geri-al-oncesi)-\d{4}$/;
const NAME = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-z0-9-]+$/;
// Şirket klasöründen yedeğe giren dosyalar (company-separate.mjs COMPANY_FILES ile aynı + arşiv).
export const DEVIR_BACKUP_ITEMS = [ARCHIVE_ROOT, "belgeler", "mesaj-arsivi", "secret.key"];

export const devirBackupRoot = companyBackupDir => path.join(companyBackupDir, DEVIR_BACKUP_DIR);
const stampNow = () => new Date().toISOString().replace(/[:.]/g, "-");
const posix = value => value.split(path.sep).join("/");

function hashFile(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(file, { highWaterMark: 1 << 20 })
      .on("data", chunk => hash.update(chunk))
      .on("error", reject)
      .on("end", () => resolve(hash.digest("hex")));
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
  try {
    // keep: bu alt klasörde tek veri tabanı dosyası durur; budama ona dokunmaz (createBackup'ın kendi budaması yalnız bu klasörü görür).
    const database = createBackup(db, partial, { label, keep: 1000, company, stamp, usageRows });
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
    renameSync(partial, final);
    return { name, path: final, size: manifest.size, files: files.length, manifest };
  } catch (error) {
    rmSync(partial, { recursive: true, force: true });
    throw error;
  }
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
    entries = readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory());
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
