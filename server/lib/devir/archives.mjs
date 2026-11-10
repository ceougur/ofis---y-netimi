// 2.5.0 D2 — yıl sonu devrinin ARŞİV dosyaları (docs/devir/D2-ALTYAPI-TASARIM.md §2–§4; DEVIR-PLANI G1.6, G6, §2.1–§2.3).
//
// Arşiv AYRI ŞİRKET DEĞİLDİR (şirket sınırına sayılmaz): şirketin veri klasöründe <veri>/arsiv/<yıl>/destekofis.sqlite (001'de kök veri klasörü).
// Kayıt defteri sirketler.json'da şirketin "archives" alanıdır (lib/companies.mjs); her girdi { year, cutoff, runId, sha256, size, schemaVersion, … }.
// Dosya kendini tanıtır: arşivin içinde ARCHIVE_MARK_KEY ayarı (şirket kimliği + yıl + devir çalışma kimliği), çalışma (yeni yıl) dosyasında
// DEVIR_YEARS_KEY (hangi yılların hangi devir çalışmasıyla arşive ayrıldığı). Bu iki işaret D4'te (devri yapan iş akışı) yazılır; D2 okur:
//   - kayıt defteri kaybolursa / eski sürüm alanı düşürürse arşiv diskten YALNIZ iki işaret tutarlıysa yeniden tanınır (yarım devirde "K yılı iki dosyada" olmaz);
//   - "Yedekten Geri Yükle" yedekteki DEVIR_YEARS_KEY'i kayıt defteriyle karşılaştırır (lib/company-backups.mjs assertDevirConsistent).
// Bütünlük: kayıttaki sha256 ↔ dosyanın özeti; yanında arsiv-kaydi.json (kaydın kopyası — kayıt defteri kaybolunca özet buradan geri gelir).
// Bu dosya yalnız dosya düzeyi yardımcıları taşır; HTTP / uygulama düzeyi açılış lib/devir/archive-open.mjs'de.
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { resolveDbPath } from "../db-path.mjs";

export const ARCHIVE_ROOT = "arsiv";
export const ARCHIVE_MARK_KEY = "devir.archive";
export const DEVIR_YEARS_KEY = "devir.years";
export const ARCHIVE_SIDECAR = "arsiv-kaydi.json";
export const ARCHIVE_READ_ONLY_CODE = "archive-read-only";
// Arşivin göçünden önceki hâli aynı klasörde tutulur (yalnız en son göçünki; eski sürüme dönüşte elle başvurulur).
export const PRE_MIGRATION_PREFIX = "goc-oncesi-v";
// 2.5.0 D2 tur 2 (dar kontrol ORTA-1): göç arşivin KOPYASINDA yapılır (lib/devir/archive-open.mjs migrateArchive); kopya bitince asıl dosyanın adına taşınır.
// Yarıda kalan göçün kopyası bir sonraki göçte silinir; devir yedeğine girmez (geçici dosya).
export const MIGRATION_WORK_FILE = "goc-calisma.sqlite";
export const isArchiveTransient = name => String(name).startsWith(PRE_MIGRATION_PREFIX) || String(name).startsWith(MIGRATION_WORK_FILE);

// 2.5.0 D2 tur 3 (dar kontrol ORTA-2; BAŞ MİMAR 10.11): arşivin YANINDA işlenmemiş günlük. Boş olmayan -wal: WAL kipinde kesinleşmiş ama ana dosyaya işlenmemiş kayıt
// (özet yalnız ana dosyanındır; kopya / göç onu görmez); boş olmayan -journal: yarıda kalmış yazım (salt okunur bağlantı geri alamaz). Böyle arşiv "değişmiş" sayılır
// (K2 aynen: eski şema → 409 archive-changed, son şema → uyarıyla salt okunur), GÖÇ ETMEZ ve yan dosya SİLİNMEZ. Boş (0 bayt) -wal / -journal ve -shm zararsızdır.
// D4 sözleşmesi: arşiv yan dosyasız bırakılır (checkpoint + DELETE günlük kipi + kapalı), özet ondan sonra alınır.
export const ARCHIVE_JOURNALS = Object.freeze(["-wal", "-journal"]);
/** Arşivin yanındaki boş olmayan günlük dosyasının soneki ("-wal" | "-journal"), yoksa "". Okunamayan (yok dışında hata) yan dosya varmış sayılır. */
export function archiveSideFile(file) {
  for (const suffix of ARCHIVE_JOURNALS) {
    try {
      if (statSync(`${file}${suffix}`).size > 0) return suffix;
    } catch (error) {
      if (error?.code !== "ENOENT") return suffix;
    }
  }
  return "";
}
/**
 * Yalnız BOŞ yan dosyaları siler (0 bayt -wal / -journal; işlenmemiş günlük yoksa -shm) — göçün sonucu asıl dosyanın yerine geçmeden önce, eski boş günlük yeni
 * dosyaya uygulanmasın. Boş olmayan -wal / -journal varsa HİÇBİR ŞEY silinmez, soneki döner (değişmiş arşiv).
 */
export function clearEmptySideFiles(file) {
  const side = archiveSideFile(file);
  if (side) return side;
  for (const suffix of [...ARCHIVE_JOURNALS, "-shm"]) rmSync(`${file}${suffix}`, { force: true });
  return "";
}

const YEAR = /^\d{4}$/;
export const validYear = value => YEAR.test(String(value ?? "")) && Number(value) >= 2000 && Number(value) <= 2999;
// Yol her zaman yıldan hesaplanır (kayıttaki "dir" alanına güvenilmez: elle düzenlenmiş kayıt defteri klasör dışına çıkamaz).
export const archiveDirOf = (companyDataDir, year) => path.join(companyDataDir, ARCHIVE_ROOT, String(year));
export const archiveFileOf = (companyDataDir, year) => resolveDbPath(archiveDirOf(companyDataDir, year));
export const archiveKey = (companyId, year) => `${companyId}@arsiv-${year}`;

/**
 * Dosyanın SHA-256 özeti — akışla (olay döngüsü büyük dosyada kilitlenmez; ders 47). Sonuç dosya tutamağı KAPANDIKTAN sonra döner (2.5.0 D2 tur 2): ardından gelen
 * yeniden adlandırma / silme Windows'ta açık tutamağa çarpmasın (ders 48).
 */
export function hashFile(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    let digest = null;
    const stream = createReadStream(file, { highWaterMark: 1 << 20 });
    stream.on("data", chunk => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => {
      digest = hash.digest("hex");
    });
    stream.on("close", () => (digest === null ? reject(new Error(`Dosyanın özeti alınamadı: ${file}`)) : resolve(digest)));
  });
}

const parse = value => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};
function withReadOnly(file, fn) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}
const settingOf = (db, key) => {
  try {
    return db.prepare("SELECT value FROM settings WHERE key = ?").get(key)?.value ?? null;
  } catch {
    return null;
  }
};
const cleanYears = value =>
  (Array.isArray(value) ? value : [])
    .filter(item => item && validYear(item.year))
    .map(item => ({ year: String(item.year), cutoff: String(item.cutoff || ""), runId: String(item.runId || ""), at: String(item.at || "") }));

/** Çalışma dosyasının devir yılları (DEVIR_YEARS_KEY): [{ year, cutoff, runId, at }]; ayar yoksa / okunamazsa []. db: açık bağlantı ya da dosya yolu. */
export function readDevirYears(source) {
  try {
    const read = db => cleanYears(parse(settingOf(db, DEVIR_YEARS_KEY)));
    return typeof source === "string" ? (existsSync(source) ? withReadOnly(source, read) : []) : read(source);
  } catch {
    return [];
  }
}
/** Ayar metninden (store.setting) devir yılları. */
export const devirYearsOfSetting = raw => cleanYears(parse(raw));

/** Arşiv dosyasının olguları: { schemaVersion, mark } ya da okunamıyorsa null. */
export function readArchiveFacts(file) {
  try {
    return withReadOnly(file, db => {
      const mark = parse(settingOf(db, ARCHIVE_MARK_KEY));
      return {
        schemaVersion: Number(db.prepare("PRAGMA user_version").get().user_version) || 0,
        mark: mark && typeof mark === "object" && validYear(mark.year) ? { companyId: String(mark.companyId || ""), year: String(mark.year), cutoff: String(mark.cutoff || ""), runId: String(mark.runId || ""), createdAt: String(mark.createdAt || "") } : null,
      };
    });
  } catch {
    return null;
  }
}

/** Şirket veri klasöründeki arşiv klasörleri (arsiv/<yıl>/ içinde veri dosyası olanlar). Okunamayan klasör atlanır. */
export function scanArchiveDirs(companyDataDir) {
  const root = path.join(companyDataDir, ARCHIVE_ROOT);
  let names = [];
  try {
    names = readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory() && validYear(entry.name)).map(entry => entry.name).sort();
  } catch {
    return [];
  }
  return names.map(year => ({ year, dir: archiveDirOf(companyDataDir, year), file: archiveFileOf(companyDataDir, year) })).filter(item => existsSync(item.file));
}

// Kayıt girdisinin dosyada tutulan alanları (sirketler.json ve yan dosya aynı biçim).
// pending*: göçün kopyası hazır ve asıl dosyanın adına taşınmak üzere (2.5.0 D2 tur 2 — iki aşamalı göç; lib/devir/archive-open.mjs). Taşımadan sonra süreç ölürse
// dosyanın özeti pendingSha256'yı tutar; açılışta / Doğrula'da kabul edilip kesinleştirilir.
export const ARCHIVE_FIELDS = ["year", "cutoff", "runId", "sha256", "size", "schemaVersion", "createdAt", "createdBy", "backup", "migratedAt", "migratedFrom", "previousSha256", "verifiedAt", "recovered", "pendingSha256", "pendingFrom", "pendingAt"];
export function cleanArchiveEntry(entry) {
  if (!entry || !validYear(entry.year)) return null;
  const out = {};
  for (const field of ARCHIVE_FIELDS) if (entry[field] !== undefined && entry[field] !== null && entry[field] !== "") out[field] = entry[field];
  out.year = String(entry.year);
  out.dir = path.join(ARCHIVE_ROOT, out.year).split(path.sep).join("/");
  return out;
}

/** Yan dosya (arsiv-kaydi.json): kaydın kopyası. Yazılamazsa sessiz (asıl kayıt sirketler.json). */
export function writeSidecar(archiveDir, entry, companyId) {
  try {
    if (!existsSync(archiveDir)) return false;
    const file = path.join(archiveDir, ARCHIVE_SIDECAR);
    writeFileSync(`${file}.tmp`, JSON.stringify({ companyId, ...cleanArchiveEntry(entry) }, null, 2));
    renameSync(`${file}.tmp`, file);
    return true;
  } catch {
    return false;
  }
}
export function readSidecar(archiveDir) {
  try {
    const value = JSON.parse(readFileSync(path.join(archiveDir, ARCHIVE_SIDECAR), "utf8"));
    return value && typeof value === "object" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Diskte olup kayıtta olmayan arşivin tanınıp tanınmayacağı (kayıt defteri kaybı / eski sürümün alanı düşürmesi; DEVIR-PLANI G10.26).
 * Tanınır: arşivin işareti bu şirketin ve bu yılın + çalışma dosyasının devir yılları aynı yılı AYNI devir çalışmasıyla taşır. Tutmazsa (yarım kalmış devir:
 * arşiv yazılmış ama çalışma dosyası takas edilmemiş) TANINMAZ — tanınsaydı K yılı hem arşivde hem çalışma dosyasında görünürdü.
 * Dönüş: { entry } ya da { reason }.
 */
// recovered: şirket kaydı diskten kurtarıldı (kimliği yeni üretilmiş olabilir — companies.mjs fromDisk); arşiv şirketin KENDİ klasöründe durduğundan işaretteki eski
// kimlik kabul edilir, tutarlılık çalışma dosyasının devir kaydıyla (aynı yıl + aynı devir çalışması) kurulur.
export function adoptionOf({ companyId, item, liveYears, recovered = false }) {
  let size = 0;
  try {
    size = statSync(item.file).size;
  } catch {
    return { reason: "dosya okunamadı" };
  }
  const facts = readArchiveFacts(item.file);
  if (!facts) return { reason: "arşiv dosyası açılamadı" };
  if (!facts.mark) return { reason: "arşiv işareti yok" };
  if (facts.mark.companyId !== companyId && !recovered) return { reason: `başka şirketin arşivi (${facts.mark.companyId || "bilinmiyor"})` };
  if (facts.mark.year !== item.year) return { reason: `klasör yılı (${item.year}) ile işaret yılı (${facts.mark.year}) farklı` };
  const live = (liveYears || []).find(row => row.year === item.year);
  if (!live) return { reason: "çalışma dosyasında bu yılın devri yok (yarım kalmış devir olabilir)" };
  if (facts.mark.runId && live.runId && facts.mark.runId !== live.runId) return { reason: "devir çalışması çalışma dosyasındakiyle aynı değil" };
  const sidecar = readSidecar(item.dir);
  const trusted = Boolean(sidecar && sidecar.companyId === facts.mark.companyId && String(sidecar.year) === item.year && String(sidecar.runId || "") === facts.mark.runId);
  const sha = trusted ? String(sidecar.sha256 || "") : "";
  // 2.5.0 D2 tur 2: yarıda kalan göçün bekleyen özeti de kaydın kopyasından gelir (kayıt defteri kaybı + taşımadan sonra kesilen göç — dosya bekleyen özeti tutar).
  const pending = trusted && sidecar.pendingSha256 ? { pendingSha256: String(sidecar.pendingSha256), pendingFrom: sidecar.pendingFrom, pendingAt: sidecar.pendingAt } : {};
  return {
    entry: cleanArchiveEntry({ year: item.year, cutoff: facts.mark.cutoff || live.cutoff, runId: facts.mark.runId, sha256: sha, size, schemaVersion: facts.schemaVersion, createdAt: facts.mark.createdAt, backup: sidecar?.backup, recovered: true, ...pending }),
  };
}
