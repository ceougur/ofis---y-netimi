// DestekOfis servis yöneticisi (Windows servisi olarak nssm altında çalışır).
//
//  İstemci ──► :5123 (HTTP kapısı, bu süreç) ──► 127.0.0.1:<iç port> (uygulama alt süreci)
//              :5123/udp (sunucu keşfi)
//
// - Uygulama hazır değilken (açılış, yeniden başlatma, güncelleme) istemcilere şık bir bakım sayfası gösterilir.
// - Uygulama çökerse artan beklemeyle yeniden başlatılır.
// - Keşif yanıtı uygulama yeniden başlarken bile verilir; istemciler sunucuyu her zaman bulur.
// - Kurulu düzende (app\<sürüm>) açılışta GitHub'dan güncelleme denetlenir; bkz. lib/update-orchestrator.mjs.
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, unlinkSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectInstall, packageVersion } from "./lib/app-layout.mjs";
import { BACKUP_NAME, createBackup } from "./lib/backup.mjs";
import { openDatabase } from "./lib/db.mjs";
import { startDiscoveryResponder } from "./lib/discovery.mjs";
import { createLogger } from "./lib/logger.mjs";
import { UpdateError } from "./lib/update-envelope.mjs";
import { createUpdateOrchestrator } from "./lib/update-orchestrator.mjs";
import { createUpdater } from "./lib/updater.mjs";

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RESTART_DELAYS = [1000, 2000, 5000, 10_000, 30_000];

const MESSAGES = {
  starting: { title: "Sistem başlatılıyor", text: "DestekOfis açılıyor. Sayfa birkaç saniye içinde kendiliğinden yenilenecek." },
  restarting: { title: "Sistem yeniden başlatılıyor", text: "Sunucu kısa bir süre için yeniden başlatılıyor. Sayfa kendiliğinden yenilenecek." },
  updating: { title: "Sistem güncelleniyor", text: "Sistem güncelleniyor, lütfen 1 dakika sonra tekrar deneyin. Sayfa kendiliğinden yenilenecek." },
  stopping: { title: "Sistem kapatılıyor", text: "Sunucu kapatılıyor. Birkaç dakika sonra tekrar deneyin." },
  failed: { title: "Sunucu başlatılamadı", text: "Uygulama birkaç kez başlatılamadı. Sunucu bilgisayarını yeniden başlatmayı deneyin; sorun sürerse destek ile iletişime geçin." },
};

const MARK = `<svg viewBox="0 0 100 100" width="64" height="64" aria-hidden="true"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2f8465"/><stop offset="1" stop-color="#15473a"/></linearGradient><linearGradient id="o" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6dea4"/><stop offset="1" stop-color="#cf9f4b"/></linearGradient></defs><rect width="100" height="100" rx="24" fill="url(#g)"/><path fill="#fff" fill-rule="evenodd" d="M27 22h23c17.7 0 30 12.3 30 28S67.7 78 50 78H27zM40.5 34.5v31H50c10.2 0 16.5-6.6 16.5-15.5S60.2 34.5 50 34.5z"/><circle cx="53.5" cy="50" r="5.4" fill="url(#o)"/></svg>`;

const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export function maintenanceHtml(phase, detail = "") {
  const message = MESSAGES[phase] || MESSAGES.starting;
  detail = detail ? escapeHtml(detail) : "";
  const refresh = phase === "failed" ? 30 : 5;
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="${refresh}"><title>${message.title} · DestekOfis</title><style>
  :root{color-scheme:light}*{box-sizing:border-box}body{display:grid;min-height:100vh;margin:0;place-items:center;padding:20px;background:radial-gradient(circle at 85% 0%,rgba(201,229,211,.55),transparent 35%),radial-gradient(circle at 10% 90%,rgba(242,226,196,.5),transparent 35%),#f7f5f0;color:#142b25;font:15px/1.55 "DM Sans",ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
  main{width:min(460px,100%);padding:36px 34px;border:1px solid #d9e6de;border-radius:24px;background:#fff;box-shadow:0 28px 80px rgba(23,62,43,.16);text-align:center}
  svg{border-radius:16px;box-shadow:0 12px 30px rgba(31,106,80,.25);${phase === "failed" ? "" : "animation:p 1.6s ease-in-out infinite"}}@keyframes p{50%{transform:scale(.94);opacity:.85}}
  h1{margin:22px 0 8px;font-size:24px;letter-spacing:-.03em}p{margin:0;color:#64766f}small{display:block;margin-top:22px;color:#8a9a93;font-size:12px}
  .bar{height:6px;margin:24px auto 0;width:180px;overflow:hidden;border-radius:99px;background:#e7efe9}.bar span{display:block;width:40%;height:100%;border-radius:inherit;background:linear-gradient(90deg,#2f8465,#7fbf9c);animation:b 1.2s ease-in-out infinite}@keyframes b{0%{transform:translateX(-110%)}100%{transform:translateX(260%)}}
  @media (prefers-reduced-motion:reduce){svg,.bar span{animation:none}}
  </style></head><body><main role="status" aria-live="polite">${MARK}<h1>${message.title}</h1><p>${message.text}</p>${phase === "failed" ? "" : '<div class="bar"><span></span></div>'}<small>${detail ? `${detail} · ` : ""}DestekOfis</small></main></body></html>`;
}

// nssm, servis her açıldığında 1 MB'ı aşan günlüğü "servis-YYYYMMDDTHHMMSS.mmm.log" adıyla kenara ayırır
// ama eskileri hiç silmez. Disk dolmasın diye en yeni `keep` tanesi tutulur.
const ROTATED_LOG = /^servis-\d{8}T\d{6}(?:\.\d{1,3})?\.log$/i;
export function pruneRotatedLogs(logDir, keep = 10) {
  let names;
  try {
    names = readdirSync(logDir);
  } catch {
    return [];
  }
  const removed = [];
  for (const name of names.filter(item => ROTATED_LOG.test(item)).sort().reverse().slice(keep)) {
    try {
      unlinkSync(path.join(logDir, name));
      removed.push(name);
    } catch {
      // Kullanımdaki veya izin verilmeyen dosya atlanır.
    }
  }
  return removed;
}

const freePort = () =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

const prefixLines = (stream, prefix, target) => {
  let buffer = "";
  stream.setEncoding("utf8");
  stream.on("data", chunk => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop();
    for (const line of lines) if (line) target.write(`${prefix}${line}\n`);
  });
  stream.on("end", () => buffer && target.write(`${prefix}${buffer}\n`));
};

export async function startSupervisor(options = {}) {
  const env = { ...process.env, ...(options.env || {}) };
  const installRoot = path.resolve(options.installRoot || env.HUKUK_INSTALL_ROOT || APP_ROOT);
  let appDir = path.resolve(options.appDir || APP_ROOT);
  const dataDir = path.resolve(options.dataDir || env.HUKUK_DATA_DIR || path.join(installRoot, "data"));
  const backupDir = path.resolve(options.backupDir || env.HUKUK_BACKUP_DIR || path.join(installRoot, "backups"));
  const configDir = path.resolve(options.configDir || path.join(installRoot, "config"));
  const dbPath = path.join(dataDir, "hukuk-ofisi.sqlite");
  const backupKeep = Math.max(3, Number(env.HUKUK_BACKUP_KEEP || 30));
  const port = Number(options.port ?? env.PORT ?? 5123);
  const host = options.host || env.HOST || "0.0.0.0";
  const discoveryPort = Number(options.discoveryPort ?? env.HUKUK_DISCOVERY_PORT ?? port);
  const log = options.log || createLogger(options.logLevel || env.HUKUK_LOG_LEVEL || "info");
  const readyTimeoutMs = Number(options.readyTimeoutMs ?? 90_000);
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(backupDir, { recursive: true });
  const pruned = pruneRotatedLogs(path.resolve(options.logDir || path.join(installRoot, "logs")), options.keepLogs ?? 10);
  if (pruned.length) log.info(`${pruned.length} eski servis günlüğü silindi.`);

  const state = { phase: "starting", detail: "", childPort: 0, info: {}, crashes: [], startedAt: new Date().toISOString(), restarts: 0 };
  let child = null;
  let stopping = false;
  let expectedExit = null;
  let restartTimer = null;
  let readyTimer = null;
  let publicPort = port;
  // Güncelleme deneme açılışında: uygulama "hazır" dese bile doğrulanana kadar bakım sayfası kalır ve çökme
  // hâlinde kendiliğinden yeniden başlatılmaz (karar güncelleme akışınındır).
  let hold = false;
  let trialMode = false;
  const agent = new http.Agent({ keepAlive: true, maxSockets: 128 });

  // ---------- Uygulama alt süreci ----------
  async function startChild() {
    if (stopping) return null;
    state.childPort = await freePort();
    if (stopping) return null;
    const entry = path.join(appDir, "server", "server.mjs");
    log.info(`Uygulama başlatılıyor (${path.relative(installRoot, appDir) || "."}, iç port ${state.childPort})`);
    const current = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", entry], {
      cwd: appDir,
      env: {
        ...env,
        PORT: String(state.childPort),
        HOST: "127.0.0.1",
        HUKUK_TRUST_PROXY: "1",
        HUKUK_DATA_DIR: dataDir,
        HUKUK_BACKUP_DIR: backupDir,
        HUKUK_SUPERVISED: "1",
        HUKUK_PUBLIC_PORT: String(publicPort),
      },
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      windowsHide: true,
    });
    child = current;
    let settleReady;
    current.readyPromise = new Promise(resolve => (settleReady = resolve));
    prefixLines(current.stdout, "[uygulama] ", process.stdout);
    prefixLines(current.stderr, "[uygulama] ", process.stderr);
    clearTimeout(readyTimer);
    readyTimer = setTimeout(() => {
      if (child === current && !current.isReady) {
        log.error(`Uygulama ${readyTimeoutMs / 1000} sn içinde hazır olmadı; yeniden başlatılıyor.`);
        current.kill();
      }
    }, readyTimeoutMs);
    current.on("message", message => {
      if (!message || typeof message !== "object") return;
      if (message.type === "ready") {
        clearTimeout(readyTimer);
        current.isReady = true;
        state.info = { version: message.version, instanceId: message.instanceId, officeName: message.officeName, schemaVersion: message.schemaVersion };
        if (!hold) {
          state.phase = "ready";
          state.detail = "";
        }
        log.info(`Uygulama hazır: DestekOfis ${message.version}`);
        settleReady(true);
      } else if (message.type === "info") {
        state.info = { ...state.info, version: message.version, instanceId: message.instanceId, officeName: message.officeName, schemaVersion: message.schemaVersion };
      } else if (message.type === "rpc") {
        handleRpc(current, message);
      }
    });
    current.on("exit", (code, signal) => {
      clearTimeout(readyTimer);
      settleReady(false);
      if (child === current) child = null;
      if (stopping || expectedExit === current) return;
      if (trialMode) {
        log.error(`Yeni sürüm açılırken kapandı (kod ${code ?? "-"}, sinyal ${signal ?? "-"}).`);
        return;
      }
      const now = Date.now();
      state.crashes = state.crashes.filter(time => now - time < 5 * 60_000).concat(now);
      const attempt = state.crashes.length;
      const delay = RESTART_DELAYS[Math.min(attempt - 1, RESTART_DELAYS.length - 1)];
      state.phase = attempt >= 5 ? "failed" : "restarting";
      state.restarts += 1;
      log.error(`Uygulama beklenmedik biçimde kapandı (kod ${code ?? "-"}, sinyal ${signal ?? "-"}); ${delay / 1000} sn sonra yeniden başlatılacak.`);
      clearTimeout(restartTimer);
      restartTimer = setTimeout(() => startChild().catch(error => log.error("Uygulama başlatılamadı", error)), state.phase === "failed" ? 60_000 : delay);
    });
    current.on("error", error => log.error("Uygulama süreci hatası", error));
    return current;
  }

  async function stopChild(timeoutMs = 8000) {
    clearTimeout(restartTimer);
    const current = child;
    if (!current) return;
    expectedExit = current;
    await new Promise(resolve => {
      const timer = setTimeout(() => {
        current.kill();
        resolve();
      }, timeoutMs);
      current.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
      if (current.connected) current.send({ type: "shutdown" });
      else current.kill();
    });
  }

  // ---------- Veritabanı (yalnızca uygulama durmuşken, güncelleme sırasında) ----------
  function withDatabase(fn) {
    if (!existsSync(dbPath)) return null;
    const db = openDatabase(dbPath, { readOnly: true });
    try {
      return fn(db);
    } finally {
      db.close();
    }
  }

  function restoreDatabase(name) {
    if (!BACKUP_NAME.test(String(name))) throw new Error(`Geçersiz yedek adı: ${name}`);
    const source = path.join(backupDir, name);
    if (!existsSync(source)) throw new Error(`Yedek bulunamadı: ${name}`);
    const temp = `${dbPath}.geri-yukleniyor`;
    copyFileSync(source, temp);
    for (const suffix of ["-wal", "-shm"]) rmSync(`${dbPath}${suffix}`, { force: true });
    renameSync(temp, dbPath);
  }

  async function probeChild(version) {
    const base = `http://127.0.0.1:${state.childPort}`;
    try {
      const health = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(5000) });
      const body = await health.json().catch(() => ({}));
      if (health.status !== 200 || body?.data?.status !== "ok") return { ok: false, reason: `Sağlık kontrolü başarısız (HTTP ${health.status}).` };
      if (version && body.data.version !== version) return { ok: false, reason: `Beklenen sürüm ${version}, çalışan sürüm ${body.data.version}.` };
      const index = await fetch(`${base}/`, { signal: AbortSignal.timeout(5000) });
      await index.arrayBuffer();
      if (index.status !== 200) return { ok: false, reason: `Arayüz yüklenemedi (HTTP ${index.status}).` };
      return { ok: true };
    } catch (error) {
      return { ok: false, reason: `Yeni sürüme ulaşılamadı: ${error.message}` };
    }
  }

  const controller = {
    appDir: () => appDir,
    setAppDir(dir) {
      appDir = path.resolve(dir);
    },
    appVersion: () => packageVersion(appDir),
    isRunning: () => Boolean(child),
    stopping: () => stopping,
    async start() {
      hold = false;
      trialMode = false;
      state.crashes = [];
      await startChild();
    },
    async startTrial(timeoutMs) {
      hold = true;
      trialMode = true;
      state.crashes = [];
      const current = await startChild();
      if (!current) return false;
      let timer;
      const ready = await Promise.race([current.readyPromise, new Promise(resolve => (timer = setTimeout(() => resolve(false), timeoutMs)))]);
      clearTimeout(timer);
      return ready;
    },
    async waitReady(timeoutMs) {
      const current = child;
      if (!current || current.isReady) return Boolean(current);
      let timer;
      const ready = await Promise.race([current.readyPromise, new Promise(resolve => (timer = setTimeout(() => resolve(false), timeoutMs)))]);
      clearTimeout(timer);
      return ready;
    },
    release() {
      hold = false;
      trialMode = false;
      if (child?.isReady) {
        state.phase = "ready";
        state.detail = "";
      }
    },
    stop: () => stopChild(),
    setPhase(phase, detail = "") {
      state.phase = phase;
      state.detail = detail;
    },
    probe: version => probeChild(version),
    schemaVersion: () => withDatabase(db => db.prepare("PRAGMA user_version").get().user_version),
    backupDatabase: label => withDatabase(db => createBackup(db, backupDir, { label, keep: backupKeep })),
    restoreDatabase,
  };

  // ---------- Güncelleme (yalnızca kurulu düzende) ----------
  const layout = detectInstall({ installRoot, appDir });
  const updatesWanted = options.updates ?? (env.HUKUK_UPDATES !== "0");
  let orchestrator = null;
  if (layout.installed && updatesWanted) {
    const updater = createUpdater({
      appsDir: layout.appsDir,
      configDir,
      currentVersion: layout.version,
      fetchImpl: options.fetchImpl,
      trustedKeys: options.trustedKeys,
      githubApi: options.githubApi,
      defaultFeed: options.updateFeed,
      bootstrapVersion: Number(env.HUKUK_BOOTSTRAP_VERSION || 1),
      log,
    });
    orchestrator = createUpdateOrchestrator({
      updater,
      controller,
      appsDir: layout.appsDir,
      runningVersion: packageVersion(APP_ROOT),
      log,
      retryDelays: options.updateRetryDelays,
      trialTimeoutMs: options.trialTimeoutMs ?? readyTimeoutMs,
    });
  }
  const updateUnavailable = layout.installed
    ? "Otomatik güncelleme bu kurulumda kapatılmış."
    : "Otomatik güncelleme yalnızca kurulum dosyasıyla kurulan (Windows servisi olarak çalışan) sunucularda kullanılabilir.";

  async function handleRpc(current, message) {
    const reply = payload => current.connected && current.send({ type: "rpc:result", id: message.id, ...payload });
    try {
      const [scope, action] = String(message.action || "").split(":");
      if (scope !== "update") throw new UpdateError("Bilinmeyen servis işlemi.", "UNKNOWN_ACTION");
      if (!orchestrator) {
        if (action === "status") return reply({ ok: true, result: { enabled: false, reason: updateUnavailable, currentVersion: packageVersion(appDir) } });
        throw new UpdateError(updateUnavailable, "UPDATES_DISABLED");
      }
      reply({ ok: true, result: await orchestrator.handle(action, message.payload || {}) });
    } catch (error) {
      reply({ ok: false, error: error.message, code: error.code || null });
    }
  }

  // ---------- HTTP kapısı ----------
  function maintenance(req, res) {
    const phase = state.phase === "ready" ? "restarting" : state.phase;
    const pathName = (req.url || "/").split("?")[0];
    const headers = { "retry-after": phase === "failed" ? "30" : "5", "cache-control": "no-store", "x-content-type-options": "nosniff" };
    if (pathName.startsWith("/api/")) {
      res.writeHead(503, { ...headers, "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, code: "MAINTENANCE", phase, detail: state.detail || null, error: (MESSAGES[phase] || MESSAGES.starting).text }));
      return;
    }
    res.writeHead(503, { ...headers, "content-type": "text/html; charset=utf-8" });
    res.end(req.method === "HEAD" ? undefined : maintenanceHtml(phase, state.detail));
  }

  function proxy(req, res) {
    const headers = { ...req.headers, "x-forwarded-for": req.socket.remoteAddress || "", "x-forwarded-host": req.headers.host || "", "x-forwarded-proto": "http" };
    // Canlı olay akışı (SSE) uzun süre açık kalır: ortak bağlantı havuzundan soket tüketmesin diye ayrı bağlantı kullanır.
    const streaming = String(req.headers.accept || "").includes("text/event-stream");
    const upstream = http.request({ host: "127.0.0.1", port: state.childPort, method: req.method, path: req.url, headers, agent: streaming ? false : agent }, upstreamResponse => {
      res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      if (streaming) res.flushHeaders?.();
      upstreamResponse.pipe(res);
      upstreamResponse.on("error", () => res.destroy());
    });
    upstream.on("error", () => {
      if (!res.headersSent) maintenance(req, res);
      else res.destroy();
    });
    req.on("aborted", () => upstream.destroy());
    // Tarayıcı bağlantıyı kapatınca (sekme kapandı, sayfa yenilendi) uygulamaya giden istek de kapanır.
    res.on("close", () => {
      if (!res.writableFinished) upstream.destroy();
    });
    req.pipe(upstream);
  }

  const gateway = http.createServer((req, res) => {
    if (req.url === "/__supervisor/health") {
      res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
      res.end(JSON.stringify({ phase: state.phase, detail: state.detail || null, version: state.info.version || null, restarts: state.restarts, startedAt: state.startedAt, childPid: child?.pid || null, updates: Boolean(orchestrator) }));
      return;
    }
    if (state.phase === "ready" && state.childPort && child) proxy(req, res);
    else maintenance(req, res);
  });
  gateway.keepAliveTimeout = 65_000;
  gateway.headersTimeout = 70_000;
  gateway.on("upgrade", (req, socket) => socket.destroy());
  gateway.on("clientError", (error, socket) => socket.writable && socket.end("HTTP/1.1 400 Bad Request\r\n\r\n"));

  await new Promise((resolve, reject) => {
    gateway.once("error", reject);
    gateway.listen(port, host, () => {
      gateway.off("error", reject);
      resolve();
    });
  }).catch(error => {
    if (error.code === "EADDRINUSE") log.error(`Port ${port} kullanımda. Başka bir DestekOfis (veya eski sürüm) çalışıyor olabilir.`);
    throw error;
  });
  const gatewayPort = gateway.address().port;
  publicPort = gatewayPort;
  log.info(`DestekOfis servis yöneticisi http://${host}:${gatewayPort}`);

  let discovery = null;
  let boundDiscoveryPort = discoveryPort;
  if (options.discovery !== false) {
    discovery = startDiscoveryResponder({ port: discoveryPort, httpPort: gatewayPort, log, getInfo: () => ({ ...state.info, state: state.phase }) });
    await discovery.ready
      .then(address => {
        boundDiscoveryPort = address.port;
      })
      .catch(error => {
        log.error(`UDP keşif başlatılamadı (${error.code || error.message}); istemciler sunucuyu adresle bulabilir.`);
        discovery = null;
      });
  }

  if (orchestrator) {
    await orchestrator.startup().catch(async error => {
      log.error("Güncelleme akışı başlatılamadı; uygulama normal açılıyor", error);
      if (!child) await controller.start();
    });
  } else await startChild();

  async function stop() {
    if (stopping) return;
    stopping = true;
    orchestrator?.stop();
    state.phase = "stopping";
    clearTimeout(restartTimer);
    clearTimeout(readyTimer);
    log.info("Servis yöneticisi kapatılıyor…");
    await stopChild();
    await Promise.all([
      new Promise(resolve => {
        gateway.close(() => resolve());
        gateway.closeAllConnections?.();
      }),
      discovery?.close(),
    ]);
    agent.destroy();
  }

  return {
    state,
    port: gatewayPort,
    discoveryPort: boundDiscoveryPort,
    stop,
    updates: orchestrator,
    // Bakım kipine geçip uygulamayı yeniden başlatır (isteğe bağlı olarak başka bir sürüm klasörüyle).
    async restartApp({ phase = "restarting", detail = "", nextAppDir } = {}) {
      state.phase = phase;
      state.detail = detail;
      clearTimeout(restartTimer);
      await stopChild();
      if (nextAppDir) appDir = path.resolve(nextAppDir);
      hold = false;
      trialMode = false;
      state.crashes = [];
      await startChild();
    },
    child: () => child,
  };
}

// Doğrudan çalıştırma (geliştirme veya servis): node server/supervisor.mjs
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const supervisor = await startSupervisor().catch(error => {
    console.error(error.message);
    process.exit(1);
  });
  const shutdown = async () => {
    const force = setTimeout(() => process.exit(0), 12_000);
    force.unref();
    await supervisor.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("SIGBREAK", shutdown);
}
