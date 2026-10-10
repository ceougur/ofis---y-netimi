// Ders 20 — "ara sıra kırmızı zorla üretilir" (CI 532, Windows Node 22, eb1437e): packaging.test.mjs'de "'surum' ve 'yedek' alt
// komutları çalışır" adımı "001 · Şirket 1: yedek alınamadı (disk I/O error)" ile düştü; aynı kod 531/533'te yeşildi.
//
// Ön koşul (koddan): bir önceki test hizmeti `service.child.kill("SIGTERM")` ile kapatıyor. Windows'ta Node bu sinyali
// TerminateProcess ile uygular (yalnız bootstrap süreci; SIGTERM işleyicisi ÇALIŞMAZ) → servis yöneticisinin uygulama alt
// süreci bir süre daha yaşar, IPC kopunca ("disconnect") kendi kapanışını yapar (sunucu, iş parçacıkları, db.close → WAL
// denetim noktası, -wal/-shm silme). Test bootstrap'ın çıkışını bekleyip HEMEN `bootstrap.mjs yedek` çalıştırır; yedek, kapanmakta
// olan uygulamayla AYNI veri tabanını açar. Linux'ta SIGTERM yakalanır, servis yöneticisi uygulamanın çıkışını bekler — yarış yok.
//
// Bu betik ön koşulu Linux'ta ZORLA kurar (SIGTERM yerine SIGKILL = Windows'taki TerminateProcess davranışı) ve yedeği, uygulama
// süreci GERÇEKTEN hâlâ yaşarken başlatır; her denemede ön koşulun oluşup oluşmadığı (uygulama süreci yedek başlarken yaşıyor mu)
// kayda yazılır. Ayrıca hizmet AÇIKKEN (yazma sürerken) yedek kipi vardır: müşterinin gerçek kullanımı.
//
// Kullanım: node --disable-warning=ExperimentalWarning test/yedek-hizmet-yaris.mjs [oksuz|acik|hepsi] [deneme sayısı]
// Çıkış kodu: herhangi bir yedek başarısızsa 1. Özet satırı: "# deneme N · onkosul M · basarisiz K".
import { execFile, spawn } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
const mode = process.argv[2] || "hepsi";
const tries = Math.max(1, Number(process.argv[3] || 10));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const freePort = () =>
  new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
const alive = pid => {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
};

function stageInstall(installRoot) {
  const target = path.join(installRoot, "app", version);
  for (const name of ["server", "client", "package.json"]) cpSync(path.join(root, name), path.join(target, name), { recursive: true });
  mkdirSync(path.join(target, "tools"), { recursive: true });
  cpSync(path.join(root, "tools", "backup.mjs"), path.join(target, "tools", "backup.mjs"));
  writeFileSync(path.join(installRoot, "app", "current.json"), JSON.stringify({ version }));
  cpSync(path.join(root, "packaging", "windows", "bootstrap.mjs"), path.join(installRoot, "bootstrap.mjs"));
}

const serviceEnv = port => ({ ...process.env, PORT: String(port), HOST: "127.0.0.1", HUKUK_DISCOVERY_PORT: "0", HUKUK_LOG_LEVEL: "warn", HUKUK_ADMIN_PASSWORD: "Test-Admin-2026!", HUKUK_DATA_DIR: "", HUKUK_BACKUP_DIR: "", HUKUK_UPDATES: "0" });

async function startService(installRoot) {
  const port = await freePort();
  const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(installRoot, "bootstrap.mjs")], { env: serviceEnv(port), stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", chunk => (output += chunk));
  child.stderr.on("data", chunk => (output += chunk));
  for (let attempt = 0; attempt < 300; attempt += 1) {
    try {
      const state = await (await fetch(`http://127.0.0.1:${port}/__supervisor/health`)).json();
      if (state.phase === "ready" && state.childPid) return { child, port, appPid: state.childPid, output: () => output };
    } catch {
      // henüz açılmadı
    }
    if (child.exitCode !== null) break;
    await sleep(100);
  }
  child.kill("SIGKILL");
  throw new Error(`Servis açılmadı:\n${output}`);
}

// bootstrap.mjs yedek — çıkış kodu, çıktı ve süre ayrı ayrı alınır (boru/kuyruk yok).
function runBackup(installRoot) {
  return new Promise(resolve => {
    const started = Date.now();
    execFile(process.execPath, ["--disable-warning=ExperimentalWarning", path.join(installRoot, "bootstrap.mjs"), "yedek"], { env: { ...process.env, HUKUK_DATA_DIR: "", HUKUK_BACKUP_DIR: "" } }, (error, stdout, stderr) => {
      resolve({ code: error ? (error.code ?? 1) : 0, stdout: String(stdout).trim(), stderr: String(stderr).trim(), ms: Date.now() - started });
    });
  });
}

async function login(port) {
  const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password: "Test-Admin-2026!" }) });
  const cookie = (response.headers.get("set-cookie") || "").split(";")[0];
  return { status: response.status, cookie };
}

const results = [];
const record = row => {
  results.push(row);
  console.log(JSON.stringify(row));
};

// Öksüz uygulama süreci: bootstrap SIGKILL (Windows TerminateProcess), uygulama kendi kapanışını (db.close) yaparken yedek.
// Öldürme anı yedeğin başlangıcına göre kaydırılır (−150…+400 ms): uygulamanın kapanışı yedeğin içine denk gelsin. Ön koşul:
// yedek başlarken uygulama süreci yaşıyor VE servis yöneticisi yedek bitmeden öldürüldü (kapanış yedekle kesişti).
async function orphanRound(index) {
  const installRoot = mkdtempSync(path.join(tmpdir(), "destekofis-yedek-yaris-"));
  stageInstall(installRoot);
  let appPid = null;
  try {
    const service = await startService(installRoot);
    appPid = service.appPid;
    const exited = new Promise(resolve => service.child.once("exit", resolve));
    const offset = Math.round(-150 + Math.random() * 550);
    let killedAt = 0;
    const kill = () => {
      killedAt = Date.now();
      service.child.kill("SIGKILL");
    };
    if (offset < 0) {
      kill();
      await sleep(-offset);
    }
    const appAliveAtStart = alive(appPid);
    const backupStart = Date.now();
    const pending = runBackup(installRoot);
    if (offset >= 0) setTimeout(kill, offset);
    const backup = await pending;
    const backupEnd = backupStart + backup.ms;
    if (!killedAt) kill();
    await exited;
    record({ kip: "oksuz", deneme: index, onkosul: appAliveAtStart && killedAt <= backupEnd, oldurmeOfseti: killedAt - backupStart, kod: backup.code, ms: backup.ms, hata: backup.stderr.slice(-400) || null });
  } finally {
    for (let i = 0; i < 200 && alive(appPid); i += 1) await sleep(50);
    if (alive(appPid)) {
      try {
        process.kill(appPid, "SIGKILL");
      } catch {}
      for (let i = 0; i < 100 && alive(appPid); i += 1) await sleep(50);
    }
    rmSync(installRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

// Hizmet açık ve yazma sürüyorken yedek (müşterinin Başlat menüsünden "Yedek al" kullanımı).
async function openRound(index) {
  const installRoot = mkdtempSync(path.join(tmpdir(), "destekofis-yedek-acik-"));
  stageInstall(installRoot);
  let service = null;
  try {
    service = await startService(installRoot);
    const { status } = await login(service.port);
    let writes = 0;
    let writeErrors = 0;
    let running = true;
    const writer = (async () => {
      while (running) {
        // Lisans denemesi başlamadan (ağsız kurulum) program salt okunurdur; giriş yine de veri tabanına yazar (oturum satırı).
        const response = await fetch(`http://127.0.0.1:${service.port}/api/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "admin", password: "Test-Admin-2026!" }) }).catch(() => null);
        if (response?.status === 200) writes += 1;
        else writeErrors += 1;
        await response?.arrayBuffer().catch(() => {});
      }
    })();
    await sleep(200);
    const backup = await runBackup(installRoot);
    running = false;
    await writer;
    record({ kip: "acik", deneme: index, onkosul: status === 200 && writes > 0 && alive(service.appPid), giris: status, yazilan: writes, yazmaHatasi: writeErrors, kod: backup.code, ms: backup.ms, hata: backup.stderr.slice(-400) || null });
  } finally {
    if (service) {
      const exited = new Promise(resolve => service.child.once("exit", resolve));
      service.child.kill("SIGTERM");
      await exited;
      for (let i = 0; i < 100 && alive(service.appPid); i += 1) await sleep(50);
    }
    rmSync(installRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  }
}

for (let index = 1; index <= tries; index += 1) {
  if (mode === "oksuz" || mode === "hepsi") await orphanRound(index);
  if (mode === "acik" || mode === "hepsi") await openRound(index);
}
for (const kip of [...new Set(results.map(row => row.kip))]) {
  const rows = results.filter(row => row.kip === kip);
  const withPre = rows.filter(row => row.onkosul);
  console.log(`# ${kip}: deneme ${rows.length} · onkosul ${withPre.length} · basarisiz ${rows.filter(row => row.kod !== 0).length} (onkosullu basarisiz ${withPre.filter(row => row.kod !== 0).length})`);
}
const failed = results.filter(row => row.kod !== 0).length;
console.log(`# deneme ${results.length} · onkosul ${results.filter(row => row.onkosul).length} · basarisiz ${failed}`);
process.exitCode = failed ? 1 : 0;
