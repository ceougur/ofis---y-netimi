// DestekOfis — kurulum kökündeki sabit başlatıcı (C:\HukukOfisiMerkezi\bootstrap.mjs).
// Windows servisi (nssm) bu dosyayı çalıştırır. Etkin uygulama sürümünü app\current.json'dan okur ve
// o sürümün servis yöneticisini başlatır. Etkin sürüm açılamazsa kurulu diğer sürümler denenir.
//
// Alt komutlar:  (yok) servis · yedek · surum
import { existsSync, readdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const installRoot = path.dirname(fileURLToPath(import.meta.url));
const appsDir = path.join(installRoot, "app");
const command = process.argv[2] || "servis";

const semver = value => String(value).split(/[.-]/).slice(0, 3).map(part => Number(part) || 0);
const compare = (a, b) => {
  const [x, y] = [semver(a), semver(b)];
  for (let index = 0; index < 3; index += 1) if (x[index] !== y[index]) return x[index] - y[index];
  return 0;
};

function installedVersions() {
  if (!existsSync(appsDir)) return [];
  return readdirSync(appsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d+\.\d+\.\d+/.test(entry.name) && existsSync(path.join(appsDir, entry.name, "server", "supervisor.mjs")))
    .map(entry => entry.name)
    .sort((a, b) => compare(b, a));
}

function currentVersion() {
  try {
    const data = JSON.parse(readFileSync(path.join(appsDir, "current.json"), "utf8"));
    if (data && data.version && existsSync(path.join(appsDir, data.version, "server", "supervisor.mjs"))) return data.version;
  } catch {
    // current.json yoksa veya bozuksa en yeni kurulu sürüm kullanılır.
  }
  return installedVersions()[0] || null;
}

function markCurrent(version) {
  const target = path.join(appsDir, "current.json");
  const temp = `${target}.tmp`;
  writeFileSync(temp, `${JSON.stringify({ version, selectedAt: new Date().toISOString() }, null, 2)}\n`);
  renameSync(temp, target);
}

const dataEnv = () => {
  process.env.HUKUK_INSTALL_ROOT = installRoot;
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
      const supervisor = await startSupervisor({ installRoot, appDir });
      if (version !== preferred) {
        console.error(`Etkin sürüm (${preferred}) açılamadı; ${version} sürümüne dönüldü.`);
        markCurrent(version);
      }
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

if (command === "yedek") await runBackup();
else if (command === "surum") console.log(currentVersion() || "yok");
else await runService();
