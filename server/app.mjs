// DestekOfis merkezi sunucusu: uygulamayı kurar, göçleri çalıştırır ve HTTP isteklerini yönlendirir.
import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { createAudit } from "./lib/audit.mjs";
import { createAuth } from "./lib/auth.mjs";
import { createChat } from "./lib/chat.mjs";
import { createEventHub } from "./lib/events.mjs";
import { startBackupScheduler } from "./lib/backup.mjs";
import { createClientState } from "./lib/client-state.mjs";
import { DEFAULT_ADMIN_PASSWORD, loadConfig } from "./lib/config.mjs";
import { createStore, openDatabase } from "./lib/db.mjs";
import { HttpError, SECURITY_HEADERS, assertSameOrigin, fail, ok, send } from "./lib/http.mjs";
import { createLogger } from "./lib/logger.mjs";
import { runMigrations } from "./lib/migrations.mjs";
import { hashPassword } from "./lib/passwords.mjs";
import { createRouter } from "./lib/router.mjs";
import { createSheetsReader } from "./lib/sheets.mjs";
import { createSourceService } from "./lib/sources.mjs";
import { createStaticHandler, notFoundPage } from "./lib/static.mjs";
import { createSupervisorLink } from "./lib/supervisor-link.mjs";
import { registerAdminRoutes } from "./routes/admin.mjs";
import { registerAuthRoutes } from "./routes/auth.mjs";
import { registerChatRoutes } from "./routes/chat.mjs";
import { registerTrpcRoutes } from "./routes/trpc.mjs";
import { registerWorkspaceRoutes } from "./routes/workspace.mjs";

function ensureInitialAdmin(store, config, log) {
  if (store.get("SELECT id FROM users WHERE username = ? COLLATE NOCASE", config.adminUsername)) return;
  const timestamp = new Date().toISOString();
  const mustChange = config.adminPassword === DEFAULT_ADMIN_PASSWORD ? 1 : 0;
  store.run(
    "INSERT INTO users (id, username, display_name, role, password_hash, must_change_password, created_at, updated_at) VALUES (?, ?, ?, 'admin', ?, ?, ?, ?)",
    `user-${crypto.randomUUID()}`, config.adminUsername, "Ofis yöneticisi", hashPassword(config.adminPassword), mustChange, timestamp, timestamp,
  );
  log.info(`İlk yönetici hesabı oluşturuldu: ${config.adminUsername}${mustChange ? " (ilk girişte parola değiştirilecek)" : ""}`);
}

export function createApp(overrides = {}) {
  const config = loadConfig(overrides);
  const log = overrides.log || createLogger(config.logLevel);
  const startedAt = new Date().toISOString();
  mkdirSync(config.dataDir, { recursive: true });
  mkdirSync(config.backupDir, { recursive: true });

  const db = openDatabase(config.dbPath);
  const store = createStore(db);
  const migration = runMigrations(store, { backupDir: config.backupDir, keep: config.backupKeep, log });
  ensureInitialAdmin(store, config, log);

  const audit = createAudit(store);
  const auth = createAuth({ store, config, audit });
  const clientState = createClientState({ store, audit });
  const readGoogleSheet = createSheetsReader({ fetchImpl: config.fetchImpl, cacheMs: config.sheetsCacheMs });
  const sources = createSourceService({ store, audit, readGoogleSheet, bumpClientState: clientState.bump });
  const serveStatic = createStaticHandler(config.publicDir);
  const supervisorLink = overrides.supervisorLink ?? (config.supervised ? createSupervisorLink(process) : null);
  // Canlı olay kanalı: oturumu kapanan (çıkış, parola değişikliği, pasifleştirme) bağlantılar ping turunda düşer.
  const events = createEventHub({ log, pingMs: config.eventsPingMs, isValid: client => auth.sessionAlive(client.tokenHash) });
  const chat = createChat({ store, events, audit });
  const context = { config, log, store, auth, audit, sources, clientState, startedAt, supervisorLink, events, chat };

  const router = createRouter();
  router.get("/api/health", async ({ res }) => ok(res, { service: "destekofis-merkezi", status: "ok", version: config.version, time: new Date().toISOString(), uptimeSeconds: Math.round(process.uptime()) }));
  registerAuthRoutes(router, context);
  registerAdminRoutes(router, context);
  registerWorkspaceRoutes(router, context);
  registerChatRoutes(router, context);
  registerTrpcRoutes(router, context);

  async function handle(req, res) {
    const url = new URL(req.url || "/", "http://localhost");
    const pathname = url.pathname;
    try {
      if (pathname.startsWith("/api/")) {
        if (!["GET", "HEAD"].includes(req.method)) assertSameOrigin(req, config.trustProxy);
        const matched = router.match(req.method, pathname);
        if (!matched) throw new HttpError(404, "Endpoint bulunamadı.");
        if (matched.methodNotAllowed) throw new HttpError(405, "Bu yöntem desteklenmiyor.");
        await matched.handler({ req, res, url, params: matched.params });
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, "Bu yöntem desteklenmiyor.");
      if (serveStatic(req, res, pathname)) return;
      if (String(req.headers.accept || "").includes("text/html")) return notFoundPage(res);
      send(res, 404, { ok: false, error: "Sayfa bulunamadı." });
    } catch (error) {
      if (error instanceof HttpError) {
        const headers = error.extra?.retryAfter ? { "retry-after": String(error.extra.retryAfter) } : {};
        if (res.headersSent) return res.end();
        return send(res, error.status, { ok: false, error: error.message, ...error.extra }, headers);
      }
      log.error(`API hatası ${req.method} ${pathname}`, error);
      if (res.headersSent) return res.end();
      fail(res, 500, "Sunucu işlemi tamamlayamadı.");
    }
  }

  const server = createServer((req, res) => {
    handle(req, res).catch(error => {
      log.error("Beklenmeyen hata", error);
      if (!res.headersSent) send(res, 500, { ok: false, error: "Sunucu işlemi tamamlayamadı." }, SECURITY_HEADERS);
    });
  });
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;
  server.requestTimeout = 5 * 60_000;

  const stopBackups = config.scheduleBackups
    ? startBackupScheduler({ db, backupDir: config.backupDir, intervalHours: config.backupIntervalHours, keep: config.backupKeep, startDelayMs: config.backupOnStartDelayMs, log })
    : () => {};
  auth.purgeExpiredSessions();
  const sessionTimer = setInterval(() => auth.purgeExpiredSessions(), 3_600_000);
  sessionTimer.unref();

  // Servis yöneticisine (supervisor) iletilen özet bilgi: keşif yanıtlarında ofis adı ve sürüm görünür.
  const infoListeners = new Set();
  const info = () => ({
    version: config.version,
    instanceId: store.setting("meta.instanceId"),
    officeName: store.setting("office.name", ""),
    schemaVersion: store.get("PRAGMA user_version").user_version,
  });
  context.notifyInfoChange = () => {
    for (const listener of infoListeners) listener(info());
  };

  let closed = false;
  return {
    config,
    log,
    store,
    db,
    server,
    migration,
    events,
    info,
    onInfoChange(listener) {
      infoListeners.add(listener);
      return () => infoListeners.delete(listener);
    },
    listen(port = config.port, host = config.host) {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          resolve(server.address());
        });
      });
    },
    async close() {
      if (closed) return;
      closed = true;
      stopBackups();
      clearInterval(sessionTimer);
      auth.limiter.stop();
      events.stop();
      await new Promise(resolve => {
        server.close(() => resolve());
        server.closeAllConnections?.();
      });
      db.close();
    },
  };
}
