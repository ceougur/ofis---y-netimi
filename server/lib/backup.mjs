// Tutarlı SQLite yedekleri: "VACUUM INTO" çalışan veritabanının anlık, bozulmayan bir kopyasını üretir.
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import path from "node:path";

export const BACKUP_NAME = /^hukuk-ofisi-[0-9TZ-]+(?:-[a-z0-9-]+)?\.sqlite$/;

const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

export function listBackups(backupDir) {
  try {
    return readdirSync(backupDir)
      .filter(name => BACKUP_NAME.test(name))
      .map(name => {
        const stats = statSync(path.join(backupDir, name));
        return { name, size: stats.size, createdAt: stats.mtime.toISOString(), mtimeMs: stats.mtimeMs };
      })
      .sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0));
  } catch {
    return [];
  }
}

export function pruneBackups(backupDir, keep) {
  const removed = [];
  for (const item of listBackups(backupDir).slice(keep)) {
    try {
      unlinkSync(path.join(backupDir, item.name));
      removed.push(item.name);
    } catch {
      // Silinemeyen yedek bir sonraki turda tekrar denenir.
    }
  }
  return removed;
}

export function createBackup(db, backupDir, { label = "", keep = 30 } = {}) {
  mkdirSync(backupDir, { recursive: true });
  const safeLabel = String(label).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  const name = `hukuk-ofisi-${stamp()}${safeLabel ? `-${safeLabel}` : ""}.sqlite`;
  const target = path.join(backupDir, name);
  db.exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);
  pruneBackups(backupDir, keep);
  return { name, path: target, size: statSync(target).size };
}

// Açılışta son yedek eskiyse kısa bir gecikmeyle yedek alır, sonra düzenli aralıkla kontrol eder.
// (v1.0.0'da yalnızca 6 saatlik setInterval vardı; sunucu her akşam kapanıyorsa yedek hiç alınmayabiliyordu.)
export function startBackupScheduler({ db, backupDir, intervalHours, keep, startDelayMs, log }) {
  const intervalMs = intervalHours * 3_600_000;
  const due = () => {
    const latest = listBackups(backupDir)[0];
    return !latest || Date.now() - latest.mtimeMs >= intervalMs;
  };
  const tick = () => {
    if (!due()) return;
    try {
      const result = createBackup(db, backupDir, { keep });
      log.info(`Yedek oluşturuldu: ${result.name}`);
    } catch (error) {
      log.error("Yedekleme hatası", error);
    }
  };
  const first = setTimeout(tick, startDelayMs);
  const timer = setInterval(tick, Math.min(intervalMs, 30 * 60_000));
  first.unref();
  timer.unref();
  return () => {
    clearTimeout(first);
    clearInterval(timer);
  };
}
