// Tutarlı SQLite yedekleri: "VACUUM INTO" çalışan veritabanının anlık, bozulmayan bir kopyasını üretir.
import { existsSync, mkdirSync, readdirSync, renameSync, rmdirSync, rmSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

// Yedek adı (v2.0.20): "destekofis-<şirket kodu>-<zaman>[-etiket].sqlite" — ör. destekofis-002-2026-10-03T09-15-00-000Z-manuel.sqlite.
// Önceki adlar tanınmaya, listelenmeye ve geri yüklenmeye devam eder: "destekofis-<zaman>…" (2.0.19'a kadar, kodsuz) ve
// "hukuk-ofisi-<zaman>…" (1.6.0 öncesi). Ad aynı zamanda güvenlik süzgecidir (yol ayıracı, nokta-nokta geçemez): kod
// üç rakam, zaman rakam/T/Z/tire, etiket küçük harf/rakam/tire.
export const BACKUP_PREFIX = "destekofis";
export const BACKUP_NAME = /^(?:destekofis|hukuk-ofisi)-[0-9TZ-]+(?:-[a-z0-9-]+)?\.sqlite$/;
const PARTS = /^(?:destekofis|hukuk-ofisi)-(?:(\d{3})-)?(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)(?:-([a-z0-9-]+))?\.sqlite$/;
// Yedeğin içindeki kimlik tablosu (v2.0.20): dosya hangi şirkete ait olduğunu kendisi söyler; geri yüklemede yanlış
// şirkete yükleme bununla reddedilir. Canlı veritabanında bu tablo yoktur (yalnız yedek kopyada).
export const BACKUP_META_TABLE = "backup_meta";
const CODE = /^\d{3}$/;

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

/** Yedek adını parçalar: { code (yoksa null), stamp, label } ya da tanınmayan adda null. */
export function parseBackupName(name) {
  if (!BACKUP_NAME.test(String(name))) return null;
  const match = PARTS.exec(String(name));
  return match ? { code: match[1] || null, stamp: match[2], label: match[3] || "" } : { code: null, stamp: null, label: "" };
}

// Sıralama adın önekine göre değil zamanına göre yapılır; eski ve yeni önekli yedekler doğru sırada kalır.
const stampOf = item => parseBackupName(item.name)?.stamp || new Date(item.mtimeMs).toISOString().replace(/[:.]/g, "-");
export const compareBackups = (a, b) => {
  const left = stampOf(a);
  const right = stampOf(b);
  return left < right ? 1 : left > right ? -1 : a.name < b.name ? 1 : a.name > b.name ? -1 : 0;
};

/**
 * Şirketin yedek klasörünün adı (v2.0.20, kullanıcı kararı): "<kod> - <ad>", ör. "001 - Şirket 1". Windows'ta geçersiz
 * karakterler (\ / : * ? " < > | ve denetim karakterleri) boşluğa çevrilir, sondaki nokta/boşluk atılır; Türkçe harfler
 * kalır. Ad boş kalırsa yalnız kod. Kod üç rakam olduğundan klasör adı Windows'un ayrılmış adlarıyla (CON, NUL…) çakışmaz.
 */
export function companyFolderName({ code, name }) {
  const safeCode = CODE.test(String(code ?? "")) ? String(code) : "000";
  const clean = String(name ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "")
    .slice(0, 80)
    .replace(/[. ]+$/g, "")
    .trim();
  return clean ? `${safeCode} - ${clean}` : safeCode;
}

export function listBackups(backupDir) {
  try {
    return readdirSync(backupDir)
      .filter(name => BACKUP_NAME.test(name))
      .map(name => {
        const stats = statSync(path.join(backupDir, name));
        if (!stats.isFile()) return null;
        return { name, size: stats.size, createdAt: stats.mtime.toISOString(), mtimeMs: stats.mtimeMs };
      })
      .filter(Boolean)
      .sort(compareBackups);
  } catch {
    return [];
  }
}

// Budama (v2.0.20): rutin yedekler (otomatik, "manuel", "drive-deneme") son `keep` adet; işlem öncesi güvenlik yedekleri
// (sıfırlama, silme, geri yükleme, güncelleme, göç, sayfa silme öncesi) AYRI sayılır ve son SAFETY_KEEP adedi kalır —
// rutin kopyalar güvenlik yedeklerini klasörden itip silemez (gözden geçirme bulgusu: haftada bir siliniyorlardı).
export const SAFETY_KEEP = 20;
// Güvenlik yedeği: bilinen işlem öncesi etiketler (bilinmeyen etiket rutin sayılır; eski davranış).
const SAFETY_LABEL = /^(?:sifirlama-oncesi|silme-oncesi|geri-yukleme-oncesi|guncelleme-oncesi|basarisiz-guncelleme|pre-migration|sayfa-silme-oncesi|ayirma-oncesi)(?:-|$)/;
const isRoutine = name => !SAFETY_LABEL.test(parseBackupName(name)?.label || "");
export function pruneBackups(backupDir, keep) {
  const removed = [];
  const all = listBackups(backupDir);
  const routine = all.filter(item => isRoutine(item.name));
  const safety = all.filter(item => !isRoutine(item.name));
  for (const item of [...routine.slice(keep), ...safety.slice(Math.max(SAFETY_KEEP, keep))]) {
    try {
      unlinkSync(path.join(backupDir, item.name));
      rmSync(path.join(backupDir, `${item.name}-wal`), { force: true }); // ham (kopyalanmış) güvenlik yedeğinin günlüğü
      removed.push(item.name);
    } catch {
      // Silinemeyen yedek bir sonraki turda tekrar denenir.
    }
  }
  return removed;
}

/** Yedeğin içine şirket kimliğini yazar (yalnız kopyaya; canlı veritabanına dokunmaz). */
export function writeBackupIdentity(file, company, extra = {}) {
  const copy = new DatabaseSync(file);
  try {
    copy.exec("PRAGMA journal_mode = DELETE");
    copy.exec(`CREATE TABLE IF NOT EXISTS ${BACKUP_META_TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    const value = JSON.stringify({ id: company.id, code: company.code, name: company.name, ...extra, createdAt: new Date().toISOString() });
    copy.prepare(`INSERT OR REPLACE INTO ${BACKUP_META_TABLE} (key, value) VALUES ('company', ?)`).run(value);
  } finally {
    copy.close();
  }
}

/** Yedekteki şirket kimliği: { id, code, name, … } ya da (eski yedek, okunamayan dosya) null. */
export function readBackupIdentity(file) {
  let copy;
  try {
    copy = new DatabaseSync(file, { readOnly: true });
    const row = copy.prepare(`SELECT value FROM ${BACKUP_META_TABLE} WHERE key = 'company'`).get();
    const value = row ? JSON.parse(row.value) : null;
    return value && typeof value === "object" && value.id ? value : null;
  } catch {
    return null;
  } finally {
    try {
      copy?.close();
    } catch {
      // zaten kapalı
    }
  }
}

/**
 * Yedek alır. `company` ({ id, code, name }) verilirse adda şirket kodu olur ve kimlik dosyanın içine yazılır (v2.0.20).
 * `stamp` aynı turda alınan bütün şirket yedeklerine aynı zamanı verir.
 */
export function createBackup(db, backupDir, { label = "", keep = 30, company = null, stamp: fixedStamp = "" } = {}) {
  mkdirSync(backupDir, { recursive: true });
  const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  const code = company && CODE.test(String(company.code ?? "")) ? `${company.code}-` : "";
  const nameAt = when => `${BACKUP_PREFIX}-${code}${when}${safeLabel ? `-${safeLabel}` : ""}.sqlite`;
  // Aynı milisaniyede aynı adla ikinci yedek istenirse (art arda iki tıklama) zaman bir milisaniye ileri alınır.
  let name = nameAt(fixedStamp || stamp());
  for (let step = 1; existsSync(path.join(backupDir, name)) && step < 1000; step += 1) name = nameAt(new Date(Date.now() + step).toISOString().replace(/[:.]/g, "-"));
  const target = path.join(backupDir, name);
  // Önce geçici adla yazılır, bitince asıl adına alınır: yarıda kesilen (elektrik, servis durdurma) yedek geçerli bir
  // yedek gibi listelenip geri yüklenemez. Eski yarım dosyalar (1 saatten eski) temizlenir.
  const partial = `${target}.yaziliyor`;
  for (const stale of readdirSync(backupDir).filter(file => file.endsWith(".yaziliyor"))) {
    try {
      if (Date.now() - statSync(path.join(backupDir, stale)).mtimeMs > 3_600_000) rmSync(path.join(backupDir, stale), { force: true });
    } catch {
      // başka süreç yazıyor olabilir
    }
  }
  rmSync(partial, { force: true });
  db.exec(`VACUUM INTO '${partial.replace(/'/g, "''")}'`);
  let identity = false;
  if (code) {
    try {
      writeBackupIdentity(partial, company, { label: safeLabel });
      identity = true;
    } catch {
      // Kimlik yazılamasa da yedek geçerlidir; şirketin kendi klasöründe durduğu için yalnız o şirkete geri yüklenir.
    }
  }
  renameSync(partial, target);
  pruneBackups(backupDir, keep);
  return { name, path: target, size: statSync(target).size, folder: path.basename(backupDir), company: company ? { id: company.id, code: company.code, name: company.name } : null, identity };
}

/**
 * Klasörü yeni adına taşır (şirketin adı/kodu değişince). Önce tek seferde yeniden adlandırma denenir; olmazsa (ör.
 * Windows'ta klasör Gezgin'de açık) dosyalar tek tek taşınır. Hiçbir dosya silinmez; hedefte aynı adlı dosya varsa
 * kaynakta kalır. Dönen `left`: taşınamayıp eski klasörde kalan dosya sayısı.
 */
export function moveBackupFolder(from, to) {
  if (path.resolve(from) === path.resolve(to) || !existsSync(from)) return { moved: 0, left: 0 };
  // Windows (NTFS) gibi yerel ayarsız büyük harfle: "MAVI" = "Mavi", "İ" ≠ "i".
  const sameIgnoringCase = path.resolve(from).toUpperCase() === path.resolve(to).toUpperCase();
  if (!existsSync(to) || sameIgnoringCase) {
    try {
      mkdirSync(path.dirname(to), { recursive: true });
      renameSync(from, to);
      return { renamed: true, moved: 0, left: 0 };
    } catch {
      if (sameIgnoringCase) return { moved: 0, left: 0 }; // büyük/küçük harf farkı: aynı klasör, yedekler yerinde
    }
  }
  mkdirSync(to, { recursive: true });
  let moved = 0;
  let left = 0;
  for (const name of readdirSync(from)) {
    const source = path.join(from, name);
    const target = path.join(to, name);
    if (existsSync(target)) {
      left += 1;
      continue;
    }
    try {
      renameSync(source, target);
      moved += 1;
    } catch {
      left += 1;
    }
  }
  if (!left) {
    try {
      rmdirSync(from);
    } catch {
      // boş klasör kalabilir
    }
  }
  return { moved, left };
}

/**
 * Otomatik yedek: açılışta son yedek eskiyse kısa bir gecikmeyle yedek alır, sonra düzenli aralıkla kontrol eder.
 * (v1.0.0'da yalnızca 6 saatlik setInterval vardı; sunucu her akşam kapanıyorsa yedek hiç alınmayabiliyordu.)
 * v2.0.20: `targets()` birden çok hedef döndürür (her şirket ayrı: { backupDir, label, run }); verilmezse tek veritabanı.
 */
export function startBackupScheduler({ db, backupDir, intervalHours, keep, startDelayMs, log, onBackup = null, targets = null }) {
  const list = targets || (() => [{ backupDir, label: "", run: () => createBackup(db, backupDir, { keep }) }]);
  const tick = () => runDueBackups({ targets: list, intervalHours, log, onBackup });
  const first = setTimeout(tick, startDelayMs);
  const timer = setInterval(tick, Math.min(intervalHours * 3_600_000, 30 * 60_000));
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}

/** Zamanı gelen hedefleri yedekler (son yedeği `intervalHours`'tan eski ya da hiç yedeği olmayan). Asla fırlatmaz. */
export function runDueBackups({ targets, intervalHours, log, onBackup = null }) {
  const intervalMs = intervalHours * 3_600_000;
  const results = [];
  let items = [];
  try {
    items = targets();
  } catch (error) {
    log?.error?.("Yedeklenecek şirketler okunamadı", error);
    return results;
  }
  for (const target of items) {
    const latest = listBackups(target.backupDir)[0];
    if (latest && Date.now() - latest.mtimeMs < intervalMs) continue;
    // Son yedekten beri veri dosyası hiç değişmediyse (kimsenin açmadığı şirket) aynı içerikli yeni kopya alınmaz.
    if (latest && target.changedAt) {
      let changed = Infinity;
      try {
        changed = target.changedAt();
      } catch {
        changed = Infinity;
      }
      if (Number.isFinite(changed) && changed <= latest.mtimeMs) continue;
    }
    try {
      const result = target.run();
      if (!result) continue;
      results.push(result);
      log?.info?.(`Yedek oluşturuldu: ${result.name}`);
      onBackup?.(result); // Drive'a kopya (v2.0.2); asla fırlatmaz
    } catch (error) {
      log?.error?.(`Yedekleme hatası${target.label ? ` (${target.label})` : ""}`, error);
    }
  }
  return results;
}
