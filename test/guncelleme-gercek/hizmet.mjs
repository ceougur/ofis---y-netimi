// Otomatik güncelleme gerçek çalıştırma testleri için "servis" süreci (yalnız test; ürüne girmez).
//
// Kurulu düzendeki bootstrap.mjs'in yaptığını yapar — kurulum kökünü ortam değişkenlerine yazar, app\current.json'daki etkin
// sürümün server\supervisor.mjs'ini AYRI bir süreçte açar — tek farkla: güncelleme kaynağı yereldeki sahte yayın sunucusudur ve
// test imza anahtarı güvenilir sayılır (gerçek imza anahtarı kullanılmaz; ağ dışarı çıkmaz). Süreler (15 dk boşta, 6 sa
// denetim, 60 dk yeniden bakış) yalnız seçenek verilirse kısalır; verilmezse ÜRETİM değerleri geçerlidir. Mesai kuralı da
// seçenek verilmezse sunucunun GERÇEK yerel saatidir (TZ ortam değişkeniyle saat dilimi seçilebilir).
//
// Seçenekler GUNCELLEME_TEST ortam değişkeninde (JSON): installRoot, feed, trustedKeys, timings?, quiet? ("never"|"always"),
// retryDelays?. Durum IPC ile sorulur ({type:"durum"}) — HTTP ile sorulsaydı sorgunun kendisi "kullanıcı etkinliği" sayılırdı.
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const options = JSON.parse(process.env.GUNCELLEME_TEST || "{}");
const installRoot = path.resolve(options.installRoot);
const appsDir = path.join(installRoot, "app");
process.env.HUKUK_INSTALL_ROOT = installRoot;
process.env.HUKUK_BOOTSTRAP_VERSION = "2";
process.env.HUKUK_DATA_DIR = path.join(installRoot, "data");
process.env.HUKUK_BACKUP_DIR = path.join(installRoot, "backups");

const version = JSON.parse(readFileSync(path.join(appsDir, "current.json"), "utf8")).version;
const appDir = path.join(appsDir, version);
const { startSupervisor } = await import(pathToFileURL(path.join(appDir, "server", "supervisor.mjs")).href);
const { isQuietTime } = await import(pathToFileURL(path.join(appDir, "server", "lib", "update-orchestrator.mjs")).href);
const quietTime = options.quiet === "never" ? () => false : options.quiet === "always" ? () => true : undefined;

const supervisor = await startSupervisor({
  installRoot,
  appDir,
  port: options.port ?? 0,
  host: "127.0.0.1",
  discovery: false,
  logLevel: "info",
  trustedKeys: options.trustedKeys,
  githubApi: options.feed,
  githubWeb: options.feed,
  updateFeed: "github:test/repo",
  ...(options.timings ? { updateTimings: options.timings } : {}),
  ...(quietTime ? { quietTime } : {}),
  ...(options.retryDelays ? { updateRetryDelays: options.retryDelays } : {}),
});

const clock = () => ({ localTime: new Date().toString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, offsetMinutes: -new Date().getTimezoneOffset(), quietNow: isQuietTime() });
process.send?.({ type: "hazir", port: supervisor.port, ...clock() });
process.on("message", async message => {
  if (message?.type === "durum") {
    process.send({ type: "durum", id: message.id, updates: supervisor.updates?.status() || null, activity: supervisor.activity(), phase: supervisor.state.phase, version: supervisor.state.info.version || null, ...clock() });
  } else if (message?.type === "dur") {
    await supervisor.stop();
    process.exit(0);
  }
});
const shutdown = async () => {
  await supervisor.stop();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.on("disconnect", shutdown);
