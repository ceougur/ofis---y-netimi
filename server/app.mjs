// DestekOfis merkezi sunucusu: uygulamayı kurar, göçleri çalıştırır ve HTTP isteklerini yönlendirir.
import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createAudit } from "./lib/audit.mjs";
import { createAccess } from "./lib/access.mjs";
import { createAuth } from "./lib/auth.mjs";
import { createRecovery } from "./lib/recovery.mjs";
import { createChat } from "./lib/chat.mjs";
import { createChatArchive } from "./lib/chat-archive.mjs";
import { createEventHub } from "./lib/events.mjs";
import { startBackupScheduler } from "./lib/backup.mjs";
import { createCloudBackup } from "./lib/cloud-backup.mjs";
import { createClientState } from "./lib/client-state.mjs";
import { DEFAULT_ADMIN_PASSWORD, loadConfig } from "./lib/config.mjs";
import { createDatasetService } from "./lib/dataset.mjs";
import { createProfileService } from "./lib/profile.mjs";
import { createAnalysisRunner } from "./lib/insight/worker.mjs";
import { createAlertScheduler } from "./lib/alerts.mjs";
import { createLicenseService } from "./lib/license.mjs";
import { createStore, openDatabase } from "./lib/db.mjs";
import { HttpError, SECURITY_HEADERS, assertSameOrigin, fail, ok, send } from "./lib/http.mjs";
import { createLogger } from "./lib/logger.mjs";
import { runMigrations } from "./lib/migrations.mjs";
import { hashPassword } from "./lib/passwords.mjs";
import { createRouter } from "./lib/router.mjs";
import { createSheetsReader } from "./lib/sheets.mjs";
import { createStaticHandler, notFoundPage } from "./lib/static.mjs";
import { createSupervisorLink } from "./lib/supervisor-link.mjs";
import { runScoped } from "./lib/session-scope.mjs";
import { registerAdminRoutes } from "./routes/admin.mjs";
import { registerAuthRoutes } from "./routes/auth.mjs";
import { registerCashRoutes } from "./routes/cash.mjs";
import { registerLedgerRoutes } from "./routes/ledger.mjs";
import { registerWhatsappRoutes } from "./routes/whatsapp.mjs";
import { createIntegrity } from "./lib/integrity.mjs";
import { registerDueRoutes } from "./routes/dues.mjs";
import { registerPlanRoutes } from "./routes/plans.mjs";
import { registerPlanTransfer } from "./routes/plan-transfer.mjs";
import { registerAccountRoutes } from "./routes/accounts.mjs";
import { registerStockRoutes } from "./routes/stock.mjs";
import { registerChequeRoutes } from "./routes/cheques.mjs";
import { registerOverviewRoutes } from "./routes/overview.mjs";
import { registerReportCenter } from "./routes/report-center.mjs";
import { registerDocumentRoutes } from "./routes/documents.mjs";
import { registerFreeRoutes } from "./routes/free.mjs";
import { createFreeSheets } from "./lib/free-sheets.mjs";
import { createTrash } from "./lib/trash.mjs";
import { registerTrashRoutes } from "./routes/trash.mjs";
import { registerChatRoutes } from "./routes/chat.mjs";
import { registerDatasetRoutes } from "./routes/dataset.mjs";
import { registerInsightRoutes } from "./routes/insight.mjs";
import { registerReportRoutes } from "./routes/reports.mjs";
import { registerTemplateRoutes } from "./routes/templates.mjs";
import { registerLicenseRoutes } from "./routes/license.mjs";
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
  // Roller ve etkin yetkiler (v2.0.10): yerleşik 4 rol + ofisin tanımladığı roller + kişiye özel ekle/çıkar.
  const access = createAccess({ store });
  const auth = createAuth({ store, config, audit, access });
  // Yönetici parolası kurtarma (v2.0.10): kurtarma anahtarı ya da sunucu bilgisayarında üretilen tek seferlik kod.
  const recovery = createRecovery({ store, dataDir: config.dataDir, log });
  const clientState = createClientState({ store, audit });
  const readGoogleSheet = createSheetsReader({ fetchImpl: config.fetchImpl, cacheMs: config.sheetsCacheMs });
  const serveStatic = createStaticHandler(config.publicDir);
  const supervisorLink = overrides.supervisorLink ?? (config.supervised ? createSupervisorLink(process) : null);
  // Canlı olay kanalı: oturumu kapanan (çıkış, parola değişikliği, pasifleştirme) bağlantılar ping turunda düşer.
  const events = createEventHub({ log, pingMs: config.eventsPingMs, maxAgeMs: config.eventsMaxAgeMs, isValid: client => auth.sessionAlive(client.tokenHash) });
  const chat = createChat({ store, events, audit, roles: access });
  // 30 günden eski sohbet mesajları veri klasöründeki mesaj-arsivi/ klasörüne taşınır (v2.0.2).
  const chatArchive = createChatArchive({ store, dir: path.join(config.dataDir, "mesaj-arsivi"), log });
  // Lisans (Faz 3): süresi dolan, engellenen veya doğrulanamayan kurulum salt okunur çalışır. Veri eşitlemesi de
  // o sürede durur. Uygulama nesnesi aşağıda kurulduğundan eşitleme denetimi geç bağlanır.
  let license = null;
  // Drive'a yedek (v2.0.2): kullanıcı Drive bağlantısı/klasörü bağladıysa her yedek oraya da kopyalanır. Lisans nesnesi
  // aşağıda kurulduğundan geç bağlanır; kopya hatası yerel yedeği hiçbir zaman engellemez.
  const cloudBackup = createCloudBackup({ store, log, services: config.licenseServices.split(",").map(item => item.trim()).filter(Boolean), keep: config.backupKeep, license: { summary: () => license?.summary?.() } });
  const mirrorBackup = result => {
    if (!result?.path) return;
    cloudBackup.mirror(result).catch(error => log.warn(`Drive kopyası başarısız: ${error.message}`));
  };
  // Kalıcı çalışma verisi: içeri alınan Excel/Sheets satırları + bağlı Sheet'in zamanlanmış eşitlemesi.
  const dataset = createDatasetService({
    store,
    audit,
    readGoogleSheet,
    bumpClientState: clientState.bump,
    events,
    log,
    backupDir: config.backupDir,
    backupKeep: config.backupKeep,
    autoSync: config.datasetAutoSync,
    tickMs: config.datasetTickMs,
    canWrite: () => !license || license.writable(),
    afterBackup: mirrorBackup,
  });
  clientState.useDataset(() => dataset.info());
  // Serbest sayfalar (v2.0.1): kullanıcının "+" ile açtığı Excel benzeri sekmeler; tablo görünümüne satır olarak girer.
  const trash = createTrash(store);
  const free = createFreeSheets({ store, audit, dataset, trash });
  dataset.setFreeProvider(free);
  // Ofis profili: sektör, kelime dağarcığı, kalemle değiştirilen başlıklar ve verinin önbellekli analizi.
  // Analiz ayrı iş parçacığında koşar; sunucu bu sırada istekleri yanıtlar (yerel-önce: ofis bilgisayarı kilitlenmez).
  const analysisRunner = createAnalysisRunner({ log, enabled: overrides.analysisWorker !== false });
  const profile = createProfileService({ store, dataset, audit, events, log, free, runner: analysisRunner });
  profile.init();
  dataset.onChange(() => profile.invalidate());
  const licenseOptions = overrides.license || {};
  license = createLicenseService({
    store,
    audit,
    events,
    log,
    dataDir: config.dataDir,
    version: config.version,
    services: config.licenseServices,
    fetchImpl: config.fetchImpl,
    usedBefore: () => profile.usedBefore(),
    ...licenseOptions,
  });
  license.init();
  dataset.start();
  const context = { config, log, store, auth, access, recovery, audit, clientState, startedAt, supervisorLink, events, chat, chatArchive, dataset, profile, license, free, trash, cloudBackup };

  const router = createRouter();
  router.get("/api/health", async ({ res }) => ok(res, { service: "destekofis-merkezi", status: "ok", version: config.version, time: new Date().toISOString(), uptimeSeconds: Math.round(process.uptime()) }));
  registerAuthRoutes(router, context);
  registerAdminRoutes(router, context);
  // Taksit servisi (context.plans) daha sonra kurulur; işlem geçmişi ona istek anında ulaşır (v2.0.6).
  registerWorkspaceRoutes(router, { ...context, plans: () => context.plans });
  context.cash = registerCashRoutes(router, context);
  // Taksitler (v2.0.4): Kasa ve tahsilat takvimi bu servisin hareketlerini ve gecikmelerini okur.
  // Cari ve Stok (v2.0.6): taksit kartları cariye bağlıdır; stok hareketi Kasa'ya ya da cariye yazılabilir. Servisler
  // birbirine istek anında ulaşır (kurulum sırası: taksit → cari → stok).
  // Tablodan taksit kartına aktarma (v2.0.8): "/api/workspace/plans/from-table" ve "/imports" kalıpları kartın
  // "/api/workspace/plans/:id" kalıbından önce kaydedilir (yönlendirici ilk eşleşeni seçer).
  context.planTransfer = registerPlanTransfer(router, { ...context, plans: () => context.plans, accounts: () => context.accounts });
  context.plans = registerPlanRoutes(router, { ...context, accounts: () => context.accounts, cheques: () => context.cheques });
  context.accounts = registerAccountRoutes(router, { ...context, plans: () => context.plans, cheques: () => context.cheques });
  context.stock = registerStockRoutes(router, { ...context, accounts: () => context.accounts, plans: () => context.plans });
  // Çek / Senet (v2.0.7): cari ve taksit defterine bağlı; Kasa tahsil/ödeme olaylarını okur.
  context.cheques = registerChequeRoutes(router, { ...context, accounts: () => context.accounts, plans: () => context.plans });
  // Ana Defter (v2.0.13): alt defterlerden türetilen çift yönlü yevmiye, hesap planı mizanı ve mutabakat kapısı.
  context.ledger = registerLedgerRoutes(router, { ...context, cash: () => context.cash, accounts: () => context.accounts, integrity: () => context.integrity });
  // Mutabakat kapısı (v2.0.13): para taşıyan her işlem COMMIT'ten önce alt defter ↔ ana defter denetiminden geçer;
  // sapma yaratacaksa ROLLBACK edilir ve günlüğe yazılır (lib/integrity.mjs).
  context.integrity = createIntegrity({ store, ledger: () => context.ledger, log });
  context.integrity.start();
  // WhatsApp ile ekstre ve mesaj (v2.0.13): tek ya da toplu; alıcıları sunucu hazırlar, gönderimler cari kartına yazılır.
  registerWhatsappRoutes(router, { ...context, accounts: () => context.accounts });
  // ANLIK DURUM (v2.0.7): Kasa, Cari, Stok ve Çek/Senet'in kendi hesaplarını okur (tek kaynak); raporlar.
  // Vade takip ve nakit akışı (v2.0.9) tablolardaki ödeme günlerini de okur (tüm veri oturumları; routes/reports.mjs).
  context.overview = registerOverviewRoutes(router, { ...context, cash: () => context.cash, accounts: () => context.accounts, plans: () => context.plans, stock: () => context.stock, cheques: () => context.cheques, tables: () => context.tableReports });
  // Rapor merkezi (v2.0.7): programdaki her bilginin hazır raporu; ekranda ön izleme, PDF ve Excel.
  context.reportCenter = registerReportCenter(router, { ...context, cash: () => context.cash, accounts: () => context.accounts, plans: () => context.plans, stock: () => context.stock, cheques: () => context.cheques, overview: () => context.overview, ledger: () => context.ledger, integrity: () => context.integrity });
  registerDueRoutes(router, context);
  const documents = registerDocumentRoutes(router, context);
  registerTrashRoutes(router, { ...context, documents });
  registerFreeRoutes(router, { ...context, readGoogleSheet });
  registerChatRoutes(router, context);
  registerDatasetRoutes(router, context);
  registerInsightRoutes(router, context);
  context.tableReports = registerReportRoutes(router, context);
  // Sektöre uygun taslak Excel (v2.0.9): açılış ekranından indirilir.
  registerTemplateRoutes(router, context);
  registerLicenseRoutes(router, context);
  registerTrpcRoutes(router, context);

  async function handle(req, res) {
    const url = new URL(req.url || "/", "http://localhost");
    const pathname = url.pathname;
    try {
      if (pathname.startsWith("/api/")) {
        if (!["GET", "HEAD"].includes(req.method)) {
          assertSameOrigin(req, config.trustProxy);
          license.assertWritable(req.method, pathname);
        }
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

  // Her istek, isteği yapan kullanıcının seçtiği veri oturumunda çalışır (v2.0.1; kullanıcı gerektiğinde bir kez okunur).
  const scoped = (req, res) => {
    let resolved;
    return runScoped({ user: () => (resolved === undefined ? (resolved = auth.currentUser(req) || null) : resolved) }, () => handle(req, res));
  };
  const server = createServer((req, res) => {
    scoped(req, res).catch(error => {
      log.error("Beklenmeyen hata", error);
      if (!res.headersSent) send(res, 500, { ok: false, error: "Sunucu işlemi tamamlayamadı." }, SECURITY_HEADERS);
    });
  });
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;
  server.requestTimeout = 5 * 60_000;

  const stopBackups = config.scheduleBackups
    ? startBackupScheduler({ db, backupDir: config.backupDir, intervalHours: config.backupIntervalHours, keep: config.backupKeep, startDelayMs: config.backupOnStartDelayMs, log, onBackup: mirrorBackup })
    : () => {};
  if (overrides.startLicenseTimers !== false) license.start();
  // Gün dönümünde tüm ekranlara "alerts.refresh" (olay tabanlı uyarı akışı, v2.0.2).
  const alertScheduler = createAlertScheduler({ events, log });
  if (overrides.alertScheduler !== false) alertScheduler.start();
  auth.purgeExpiredSessions();
  const sessionTimer = setInterval(() => auth.purgeExpiredSessions(), 3_600_000);
  sessionTimer.unref();
  // Sohbet arşivi: açılıştan kısa süre sonra ve 6 saatte bir (v2.0.2).
  const archiveChat = () => {
    try {
      chatArchive.run();
    } catch (error) {
      log.error("Sohbet arşivi çalışmadı", error);
    }
  };
  const archiveStart = overrides.chatArchive === false ? null : setTimeout(archiveChat, 20_000);
  archiveStart?.unref?.();
  const archiveTimer = overrides.chatArchive === false ? null : setInterval(archiveChat, 6 * 3_600_000);
  archiveTimer?.unref?.();

  // Servis yöneticisine (supervisor) iletilen özet bilgi: keşif yanıtlarında ofis adı ve sürüm görünür.
  const infoListeners = new Set();
  const info = () => ({
    version: config.version,
    instanceId: store.setting("meta.instanceId"),
    officeName: store.setting("office.name", ""),
    schemaVersion: store.get("PRAGMA user_version").user_version,
    license: license.status().state,
  });
  context.notifyInfoChange = () => {
    for (const listener of infoListeners) listener(info());
  };

  let closed = false;
  return {
    config,
    log,
    store,
    integrity: context.integrity,
    db,
    server,
    migration,
    events,
    license,
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
      clearTimeout(archiveStart);
      clearInterval(archiveTimer);
      alertScheduler.stop();
      auth.limiter.stop();
      dataset.stop();
      documents.stop();
      license.stop();
      events.stop();
      await new Promise(resolve => {
        server.close(() => resolve());
        server.closeAllConnections?.();
      });
      await analysisRunner.close();
      db.close();
    },
  };
}
