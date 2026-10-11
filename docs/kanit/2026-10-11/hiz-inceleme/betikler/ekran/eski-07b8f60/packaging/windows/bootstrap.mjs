// DestekOfis — kurulum kökündeki sabit başlatıcı (C:\HukukOfisiMerkezi\bootstrap.mjs).
// Windows servisi (nssm) bu dosyayı çalıştırır. Etkin uygulama sürümünü app\current.json'dan okur ve
// o sürümün servis yöneticisini başlatır. Etkin sürüm açılamazsa kurulu diğer sürümler denenir.
//
// Bu dosya yalnızca kurulum dosyasıyla (setup.exe) değişir; otomatik güncellemeler yalnızca app\<sürüm>
// klasörlerini ekler. Bu yüzden kasıtlı olarak küçük ve kendi başına yeterlidir (uygulama koduna bağımlı değil).
//
// Alt komutlar:
//   (yok) | servis            servisi çalıştırır
//   yedek                     elle yedek alır
//   surum                     etkin sürümü yazdırır
//   etkinlestir <sürüm>       kurulum sonrası: kurulan sürümü etkinleştirir (daha yeni bir sürüm etkinse ona dokunmaz)
//   saglik [saniye]           kurulum sonrası: servis hazır olana kadar bekler (PowerShell'e gerek kalmadan)
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Servis yöneticisi, güncelleme bildirgesindeki "requires.bootstrap" değerini bununla karşılaştırır.
export const BOOTSTRAP_VERSION = 2;

const installRoot = path.dirname(fileURLToPath(import.meta.url));
const appsDir = path.join(installRoot, "app");
const currentPath = path.join(appsDir, "current.json");
const command = process.argv[2] || "servis";

const semver = value => {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(String(value));
  return match ? [Number(match[1]), Number(match[2]), Number(match[3]), match[4] || ""] : null;
};
const compare = (a, b) => {
  const [x, y] = [semver(a), semver(b)];
  if (!x || !y) return x ? 1 : y ? -1 : 0;
  for (let index = 0; index < 3; index += 1) if (x[index] !== y[index]) return x[index] - y[index];
  if (x[3] === y[3]) return 0;
  if (!x[3]) return 1;
  if (!y[3]) return -1;
  return x[3] < y[3] ? -1 : 1;
};
const isInstalled = version => Boolean(version) && semver(version) && existsSync(path.join(appsDir, version, "server", "supervisor.mjs"));

function installedVersions() {
  if (!existsSync(appsDir)) return [];
  return readdirSync(appsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && isInstalled(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => compare(b, a));
}

function readCurrent() {
  try {
    const data = JSON.parse(readFileSync(currentPath, "utf8"));
    return data && typeof data === "object" && semver(data.version) ? data : null;
  } catch {
    return null;
  }
}

function writeCurrent(data) {
  const clean = Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== null));
  const temp = `${currentPath}.tmp`;
  writeFileSync(temp, `${JSON.stringify(clean, null, 2)}\n`);
  renameSync(temp, currentPath);
}

function currentVersion() {
  const data = readCurrent();
  if (data && isInstalled(data.version)) return data.version;
  // current.json yoksa veya bozuksa en yeni kurulu sürüm kullanılır.
  return installedVersions()[0] || null;
}

const dataEnv = () => {
  process.env.HUKUK_INSTALL_ROOT = installRoot;
  process.env.HUKUK_BOOTSTRAP_VERSION = String(BOOTSTRAP_VERSION);
  process.env.HUKUK_DATA_DIR ||= path.join(installRoot, "data");
  process.env.HUKUK_BACKUP_DIR ||= path.join(installRoot, "backups");
};

async function runService() {
  dataEnv();
  const preferred = currentVersion();
  const candidates = [preferred, ...installedVersions().filter(version => version !== preferred)].filter(Boolean);
  if (!candidates.length) {
    console.error(`DestekOfis uygulaması bulunamadı: ${appsDir}`);
    process.exit(1);
  }
  for (const version of candidates) {
    const appDir = path.join(appsDir, version);
    try {
      const { startSupervisor } = await import(pathToFileURL(path.join(appDir, "server", "supervisor.mjs")).href);
      if (version !== preferred) {
        // Servis yöneticisi bu işareti görüp açılamayan sürümü "başarısız" sayar ve bir daha kendiliğinden kurmaz.
        console.error(`Etkin sürüm (${preferred}) açılamadı; ${version} sürümüne dönülüyor.`);
        writeCurrent({ version, fallbackFrom: preferred, selectedAt: new Date().toISOString() });
      }
      const supervisor = await startSupervisor({ installRoot, appDir });
      const shutdown = async () => {
        const force = setTimeout(() => process.exit(0), 12_000);
        force.unref();
        await supervisor.stop();
        process.exit(0);
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
      process.on("SIGBREAK", shutdown);
      return;
    } catch (error) {
      console.error(`DestekOfis ${version} başlatılamadı: ${error.stack || error.message}`);
      if (error.code === "EADDRINUSE") process.exit(1);
    }
  }
  process.exit(1);
}

async function runBackup() {
  dataEnv();
  const version = currentVersion();
  if (!version) throw new Error("Kurulu sürüm bulunamadı.");
  await import(pathToFileURL(path.join(appsDir, version, "tools", "backup.mjs")).href);
}

// Kurulum dosyası çalıştıktan sonra: kurulan sürüm etkin sürümden yeni veya aynıysa onu etkinleştirir.
// Otomatik güncellemeyle daha yeni bir sürüme geçilmişse ona dokunmaz (eski kurulum dosyası sürümü düşürmez).
function activateInstalled(target) {
  if (!isInstalled(target)) {
    console.error(`Kurulan sürüm bulunamadı: ${target}`);
    process.exit(2);
  }
  const current = readCurrent();
  const active = current && isInstalled(current.version) ? current.version : null;
  if (active && compare(active, target) > 0) {
    console.log(`Daha yeni bir sürüm etkin (${active}); ${target} yedek olarak kuruldu.`);
  } else {
    writeCurrent({ version: target, previous: active && active !== target ? active : current?.previous, selectedAt: new Date().toISOString(), installedBy: "kurulum" });
    console.log(`Etkin sürüm: ${target}`);
  }
  // Etkin, önceki ve yeni kurulan dışındaki eski sürümler silinir.
  const after = readCurrent();
  const keep = new Set([after?.version, after?.previous, target].filter(Boolean));
  for (const version of installedVersions()) {
    if (keep.has(version)) continue;
    try {
      rmSync(path.join(appsDir, version), { recursive: true, force: true, maxRetries: 3 });
      console.log(`Eski sürüm silindi: ${version}`);
    } catch {
      // Bir sonraki güncellemede yeniden denenir.
    }
  }
}

// Kurulum sonrası sağlık kontrolü: /api/health 200 dönerse veya servis "bakım" yanıtı veriyorsa (açılışta güncelleme
// indiriyor) başarılı sayılır. Hazır olmazsa servis günlüğünün son satırlarını yazdırır (kurulum.log'a düşer).
async function waitHealthy(seconds) {
  const port = Number(process.env.PORT || 5123);
  const deadline = Date.now() + Math.max(1, seconds) * 1000;
  let last = "bağlantı yok";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(3000) });
      if (response.status === 200) {
        console.log("Saglik kontrolu basarili.");
        return 0;
      }
      const body = await response.json().catch(() => ({}));
      last = response.status === 503 ? (body.phase === "failed" ? "başlatılamadı" : "bakım") : `HTTP ${response.status}`;
    } catch {
      last = "bağlantı yok";
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (last === "bakım") {
    console.log("Servis calisiyor; acilis veya guncelleme suruyor.");
    return 0;
  }
  console.log(`Servis ${seconds} sn icinde hazir olmadi (son durum: ${last}).`);
  try {
    const logFile = path.join(installRoot, "logs", "servis.log");
    const tail = readFileSync(logFile, "utf8").split(/\r?\n/).filter(Boolean).slice(-15);
    if (tail.length) console.log(`--- servis.log (son satirlar) ---\n${tail.join("\n")}`);
  } catch {
    // Servis günlüğü yoksa servis hiç başlamamıştır.
  }
  return 1;
}

if (command === "yedek") await runBackup();
else if (command === "surum") console.log(currentVersion() || "yok");
else if (command === "etkinlestir") activateInstalled(process.argv[3]);
else if (command === "saglik") process.exit(await waitHealthy(Number(process.argv[3]) || 120));
else await runService();
