// Kurulum düzeni: C:\HukukOfisiMerkezi\app\<sürüm>\ klasörleri ve etkin sürümü gösteren app\current.json.
//
// current.json: { version, previous?, pending?, backup?, schemaBefore?, selectedAt, confirmedAt?, fallbackFrom?, rolledBackFrom? }
//   pending: true  → sürüm yeni etkinleştirildi, ilk başarılı açılışta onaylanır; açılamazsa "previous"a dönülür.
//   fallbackFrom   → bootstrap etkin sürümü açamayıp bu sürüme döndü; o sürüm başarısız sayılır.
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { compareVersions, isVersion } from "./semver.mjs";

export const currentFile = appsDir => path.join(appsDir, "current.json");

export function readJsonFile(file, fallback = null) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

// Windows'ta antivirüs yeni yazılan dosyaları kısa süre tutabilir (EPERM/EBUSY); yeniden adlandırma birkaç kez denenir.
export function renameWithRetry(from, to, attempts = 12) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      renameSync(from, to);
      return;
    } catch (error) {
      if (attempt >= attempts || !["EPERM", "EBUSY", "EACCES", "ENOTEMPTY"].includes(error.code)) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, Math.min(1000, 50 * attempt));
    }
  }
}

// Önce geçici dosyaya yazıp yeniden adlandırır: elektrik kesilse bile yarım dosya kalmaz.
export function writeJsonAtomic(file, value) {
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`);
  renameWithRetry(temp, file);
}

export function readCurrent(appsDir) {
  const data = readJsonFile(currentFile(appsDir));
  return data && typeof data === "object" && isVersion(data.version) ? data : null;
}

export function writeCurrent(appsDir, data) {
  const clean = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== null));
  writeJsonAtomic(currentFile(appsDir), clean);
  return clean;
}

export const versionDir = (appsDir, version) => path.join(appsDir, version);
export const isInstalledVersion = (appsDir, version) => Boolean(version) && existsSync(path.join(appsDir, version, "server", "supervisor.mjs"));

export function installedVersions(appsDir) {
  try {
    return readdirSync(appsDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && isVersion(entry.name) && isInstalledVersion(appsDir, entry.name))
      .map(entry => entry.name)
      .sort((a, b) => compareVersions(b, a));
  } catch {
    return [];
  }
}

export function packageVersion(dir) {
  return readJsonFile(path.join(dir, "package.json"), {})?.version || null;
}

// Uygulama klasörü bir kurulumun app\<sürüm> klasörü mü? (Geliştirme ortamında değildir; güncelleyici kapalı kalır.)
export function detectInstall({ installRoot, appDir }) {
  const appsDir = path.join(path.resolve(installRoot), "app");
  const resolved = path.resolve(appDir);
  const version = packageVersion(resolved);
  const installed = path.dirname(resolved) === appsDir && path.basename(resolved) === version && existsSync(appsDir);
  return { installed, appsDir, version };
}

// Etkin, önceki ve çalışan servis yöneticisinin sürümü dışındaki eski sürümleri ve yarım kalmış geçici klasörleri siler.
export function pruneVersions(appsDir, keep = []) {
  const keepSet = new Set(keep.filter(Boolean));
  const removed = [];
  let entries = [];
  try {
    entries = readdirSync(appsDir, { withFileTypes: true });
  } catch {
    return removed;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const stale = (isVersion(entry.name) && !keepSet.has(entry.name)) || /^\..+\.tmp$/.test(entry.name);
    if (!stale) continue;
    try {
      rmSync(path.join(appsDir, entry.name), { recursive: true, force: true, maxRetries: 3 });
      removed.push(entry.name);
    } catch {
      // Kilitli dosya varsa bir sonraki temizlikte yeniden denenir.
    }
  }
  return removed;
}
