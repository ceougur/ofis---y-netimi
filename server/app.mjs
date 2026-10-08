// DestekOfis merkezi sunucusu: uygulamayı kurar, göçleri çalıştırır ve HTTP isteklerini yönlendirir.
import { createServer } from "node:http";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { createAudit } from "./lib/audit.mjs";
import { createAccess } from "./lib/access.mjs";
import { createAuth } from "./lib/auth.mjs";
import { createRecovery } from "./lib/recovery.mjs";
import { createChat } from "./lib/chat.mjs";
import { createChatArchive } from "./lib/chat-archive.mjs";
import { createEventHub } from "./lib/events.mjs";
import { runDueBackups, startBackupScheduler } from "./lib/backup.mjs";
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
import { createIdempotency } from "./lib/idempotency.mjs";
import { createBank } from "./lib/bank/post.mjs";
import { LOCK_KEY, createPeriod } from "./lib/period.mjs";
import { registerDueRoutes } from "./routes/dues.mjs";
import { registerPlanRoutes } from "./routes/plans.mjs";
import { registerPlanTransfer } from "./routes/plan-transfer.mjs";
import { registerAccountRoutes } from "./routes/accounts.mjs";
import { registerStockRoutes } from "./routes/stock.mjs";
import { registerChequeRoutes } from "./routes/cheques.mjs";
import { registerInvoiceRoutes } from "./routes/invoices.mjs";
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
import { ROOT_COMPANY_ID, createCompanyRegistry, mirrorUsers, usersFingerprint } from "./lib/companies.mjs";
import { registerCompanyRoutes } from "./routes/companies.mjs";
import { createBackup } from "./lib/backup.mjs";
import { applyStagedRestore, createCompanyBackups } from "./lib/company-backups.mjs";
import { resolveDbPath } from "./lib/db-path.mjs";

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
  // Çoklu şirket (v2.0.17): hub = ilk şirket (001) + ortak katman (kullanıcılar, roller, lisans, şirket listesi).
  // Çocuk şirket örnekleri aynı createApp ile açılır; kimlik doğrulama, yetki, kurtarma ve lisans hub'dan gelir,
  // kullanıcı tablosu ad/rol gösterimi için aynalanır.
  const hub = overrides.hub || null;
  const children = new Map();
  // Bekleyen 001 geri yüklemesi (v2.0.20): veri tabanı açılmadan uygulanır (Yönetim → Yedekler → Geri Yükle).
  const stagedRestore = hub ? null : applyStagedRestore({ dataDir: config.dataDir, backupRoot: config.backupDir, dbPath: config.dbPath, keep: config.backupKeep, log });

  const db = openDatabase(config.dbPath);
  const store = createStore(db);
  // Şirket kayıt defteri yalnız hub'da; çocuklar hub'ınkini görür. (v2.0.20: göçlerden önce kurulur; göç öncesi yedek de
  // şirketin kendi yedek klasörüne gider.)
  // maxCompanies yalnız programdan verilir (çok şirketli eski kurulumu canlandıran testler); kurulumda hep MAX_COMPANIES.
  const companies = hub ? hub.companies : createCompanyRegistry({ dataDir: config.dataDir, backupDir: config.backupDir, hubStore: store, log, ...(overrides.maxCompanies ? { maxCompanies: overrides.maxCompanies } : {}) });
  const companyId = overrides.companyId || ROOT_COMPANY_ID;
  // Bu örneğin şirketi ve yedek klasörü (<yedek kökü>/<kod> - <ad>; ad/kod değişince yeni klasör — her kullanımda çözülür).
  const selfCompany = () => companies.get(companyId) || { id: companyId, code: "001", name: "", dir: "" };
  const companyIdentity = () => {
    const company = selfCompany();
    return { id: company.id, code: company.code, name: company.name };
  };
  const backupDirNow = () => companies.dirsOf(selfCompany()).backupDir;
  const takeBackup = (label, keep = config.backupKeep) => createBackup(db, backupDirNow(), { label, keep, company: companyIdentity() });
  // Bir şirketin veri tabanıyla iş: açık örneğinki, açık değilse kısa süreli salt okunur bağlantı (açıp kapatır; örnek
  // açılmaz, bağlantı sızmaz). Otomatik yedek, Yönetim → Şirketler sayıları ve geri yükleme öncesi yedek bunu kullanır.
  function withCompanyDb(company, fn) {
    if (!company || company.id === companyId) return fn(db);
    if (hub) return hub.withCompanyDb(company, fn);
    const child = children.get(company.id);
    if (child) return fn(child.db);
    const file = resolveDbPath(companies.dirsOf(company).dataDir);
    if (!existsSync(file)) return null;
    const temp = openDatabase(file, { readOnly: true });
    try {
      return fn(temp);
    } finally {
      temp.close();
    }
  }
  // Geri yüklenen ya da silinen şirket o sırada açılmaz; istek 503 ile "birkaç saniye sonra" der.
  const busyCompanies = hub ? hub.busyCompanies : new Map();
  const backups = hub ? hub.backups : createCompanyBackups({ registry: companies, dataDir: config.dataDir, keep: config.backupKeep, log, withDb: withCompanyDb, busy: busyCompanies, closeCompany: id => closeCompany(id) });
  if (!hub) {
    try {
      backups.migrate();
    } catch (error) {
      log.warn(`Yedekler şirket klasörlerine taşınamadı: ${error.message}`);
    }
  }
  const migration = runMigrations(store, { backupDir: backupDirNow(), keep: config.backupKeep, log, company: companyIdentity(), now: config.now });
  // 2.0.21 öncesinden gelen şirketler (gözden geçirme bulgusu): veri dosyası olan her şirket "açılmış" sayılır; dosyası
  // sonradan kaybolursa sessizce boş veri tabanı açılmaz (2.0.21'deki ilk açılışını beklemeden).
  if (!hub) {
    for (const company of companies.list()) {
      if (company.root || store.setting(`company.opened.${company.id}`, "")) continue;
      try {
        if (existsSync(resolveDbPath(companies.dirsOf(company).dataDir))) store.setSetting(`company.opened.${company.id}`, "1");
      } catch {
        // işaretlenemedi; ilk açılışta işaretlenir
      }
    }
  }
  if (!hub) ensureInitialAdmin(store, config, log);
  else mirrorUsers(hub.store, store);

  const audit = createAudit(store, { now: config.now });
  // Merkezi para yazımı (v2.1.0; lib/bank/post.mjs, plan §3.3 K6): bank.post + para yazımı denetimi (K6) bu şirketin store'unda.
  const bank = createBank({ store, now: config.now, log, strict: config.moneyStrict, requests: createIdempotency({ store, now: config.now }), audit });
  // Roller ve etkin yetkiler (v2.0.10): yerleşik 4 rol + ofisin tanımladığı roller + kişiye özel ekle/çıkar.
  const access = hub ? hub.access : createAccess({ store });
  const auth = hub ? hub.auth : createAuth({ store, config, audit, access });
  // Yönetici parolası kurtarma (v2.0.10): kurtarma anahtarı ya da sunucu bilgisayarında üretilen tek seferlik kod.
  const recovery = hub ? hub.recovery : createRecovery({ store, dataDir: config.dataDir, log });
  const clientState = createClientState({ store, audit });
  const readGoogleSheet = createSheetsReader({ fetchImpl: config.fetchImpl, cacheMs: config.sheetsCacheMs });
  const serveStatic = createStaticHandler(config.publicDir);
  const supervisorLink = hub ? hub.supervisorLink : overrides.supervisorLink ?? (config.supervised ? createSupervisorLink(process) : null);
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
  // v2.0.20: Drive ayarı ortak katmanda (hub) tek; bütün şirketlerin yedekleri oraya, her şirket kendi klasörüne kopyalanır.
  // Kopyalar sırayla yapılır (aynı anda iki kopya durum kaydını ezmesin).
  // Drive bağlantısı ortak katmanda tek (v2.0.20). 2.0.17–2.0.19'da bağlantı seçili şirketin dosyasına yazılıyordu: 002
  // seçiliyken bağlanan Drive ayarı ortak katmanda yoksa ondan alınır (gözden geçirme bulgusu: kopyalar sessizce duruyordu).
  if (!hub) {
    try {
      if (!store.setting("backup.cloud", "")) {
        for (const company of companies.list().filter(item => item.id !== ROOT_COMPANY_ID)) {
          const value = withCompanyDb(company, companyDb => companyDb.prepare("SELECT value FROM settings WHERE key = 'backup.cloud'").get()?.value || "");
          if (value) {
            store.setSetting("backup.cloud", value);
            log.info?.(`Drive yedek bağlantısı ${company.code} · ${company.name} şirketinin ayarından ortak katmana alındı.`);
            break;
          }
        }
      }
    } catch (error) {
      log.warn?.(`Drive yedek ayarı şirketlerden okunamadı: ${error.message}`);
    }
  }
  const cloudBackup = hub ? hub.cloudBackup : createCloudBackup({ store, log, services: config.licenseServices.split(",").map(item => item.trim()).filter(Boolean), keep: config.backupKeep, license: { summary: () => license?.summary?.() } });
  let mirrorQueue = Promise.resolve();
  const mirrorNow = result => {
    const run = mirrorQueue.then(() => cloudBackup.mirror(result));
    mirrorQueue = run.catch(() => {});
    return run;
  };
  const mirrorBackup = hub
    ? hub.mirrorBackup
    : result => {
        if (!result?.path) return;
        mirrorNow(result).catch(error => log.warn(`Drive kopyası başarısız: ${error.message}`));
      };
  // Kalıcı çalışma verisi: içeri alınan Excel/Sheets satırları + bağlı Sheet'in zamanlanmış eşitlemesi.
  const dataset = createDatasetService({
    store,
    audit,
    readGoogleSheet,
    bumpClientState: clientState.bump,
    events,
    log,
    backupKeep: config.backupKeep,
    makeBackup: label => takeBackup(label),
    autoSync: config.datasetAutoSync,
    tickMs: config.datasetTickMs,
    canWrite: () => !license || license.writable(),
    afterBackup: mirrorBackup,
  });
  clientState.useDataset(() => dataset.info());
  // Serbest sayfalar (v2.0.1): kullanıcının "+" ile açtığı Excel benzeri sekmeler; tablo görünümüne satır olarak girer.
  const trash = createTrash(store, { now: config.now });
  const free = createFreeSheets({ store, audit, dataset, trash });
  dataset.setFreeProvider(free);
  // Ofis profili: sektör, kelime dağarcığı, kalemle değiştirilen başlıklar ve verinin önbellekli analizi.
  // Analiz ayrı iş parçacığında koşar; sunucu bu sırada istekleri yanıtlar (yerel-önce: ofis bilgisayarı kilitlenmez).
  const analysisRunner = createAnalysisRunner({ log, enabled: overrides.analysisWorker !== false });
  const profile = createProfileService({ store, dataset, audit, events, log, free, runner: analysisRunner, clock: config.now });
  profile.init();
  dataset.onChange(() => profile.invalidate());
  const licenseOptions = overrides.license || {};
  if (hub) license = hub.license;
  else {
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
  }
  dataset.start();
  // Sunucunun yeniden başlatılması (001 geri yüklemesi): servis yöneticisi altında server.mjs bağlar; yoksa false.
  let restartHandler = null;
  const requestRestart = reason => {
    if (hub) return hub.requestRestart(reason);
    if (!restartHandler) return false;
    const timer = setTimeout(() => restartHandler(reason), 400);
    timer.unref?.();
    return true;
  };
  const context = {
    config, log, store, bank, auth, access, recovery, audit, clientState, startedAt, supervisorLink, events, chat, chatArchive, dataset, profile, license, free, trash, cloudBackup, companies, companyId, company: () => companies.get(companyId),
    // İş saati (v2.1.0; lib/clock.mjs): modüller "bugün"ü ve zaman damgalarını buradan okur (config.now; testlerde sahte saat).
    now: config.now,
    // Şirket yedekleri (v2.0.20): bütün şirketler, kendi klasörlerinde; Drive kopyası sıralı.
    backups, backupDir: backupDirNow, withCompanyDb, mirrorNow: hub ? hub.mirrorNow : mirrorNow, closeCompany: id => closeCompany(id), busyCompanies, requestRestart,
  };
  if (stagedRestore) {
    const actor = stagedRestore.by ? { id: stagedRestore.by, display_name: stagedRestore.byName } : null;
    audit(actor, stagedRestore.ok ? "system.backup_restored" : "system.backup_restore_failed", stagedRestore.name, { company: "001", safety: stagedRestore.safety || "", error: stagedRestore.error || "" });
    // Sonuç Yönetim → Yedekler'de gösterilir (gözden geçirme bulgusu: başarısız 001 geri yüklemesi sessiz kalıyordu;
    // kullanıcı eski veriyle çalıştığını bilmiyordu).
    try {
      store.setSetting("backup.lastRestore", JSON.stringify({ ok: stagedRestore.ok, name: stagedRestore.name, safety: stagedRestore.safety || "", error: stagedRestore.error || "", byName: stagedRestore.byName || "", at: new Date().toISOString() }));
    } catch (error) {
      log.warn?.(`Geri yükleme sonucu kaydedilemedi: ${error.message}`);
    }
  }

  const router = createRouter();
  router.get("/api/health", async ({ res }) => ok(res, { service: "destekofis-merkezi", status: "ok", version: config.version, time: new Date().toISOString(), uptimeSeconds: Math.round(process.uptime()) }));
  registerAuthRoutes(router, context);
  registerAdminRoutes(router, context);
  if (!hub) registerCompanyRoutes(router, { ...context, appFor: company => appFor(company), resetData: (company, ...args) => appFor(company).resetData(...args), closeCompany: id => closeCompany(id) });
  // Hareket tarihi ve dönem kilidi (v2.0.13): Kasa, Cari, Stok ve Taksit aynı kuralla. v2.0.26 (A1): kayıt tahsilatı da
  // (çalışma alanı rotaları) aynı kurala bağlı; bu yüzden onlardan önce kurulur.
  context.period = createPeriod({ store, now: config.now });
  // Taksit servisi (context.plans) daha sonra kurulur; işlem geçmişi ona istek anında ulaşır (v2.0.6). Kasa (eksi bakiye
  // denetimi) da sonra kurulur; istek anında okunur.
  registerWorkspaceRoutes(router, { ...context, plans: () => context.plans, cash: () => context.cash });
  context.cash = registerCashRoutes(router, context);
  // Taksitler (v2.0.4): Kasa ve tahsilat takvimi bu servisin hareketlerini ve gecikmelerini okur.
  // Cari ve Stok (v2.0.6): taksit kartları cariye bağlıdır; stok hareketi Kasa'ya ya da cariye yazılabilir. Servisler
  // birbirine istek anında ulaşır (kurulum sırası: taksit → cari → stok).
  // Tablodan taksit kartına aktarma (v2.0.8): "/api/workspace/plans/from-table" ve "/imports" kalıpları kartın
  // "/api/workspace/plans/:id" kalıbından önce kaydedilir (yönlendirici ilk eşleşeni seçer).
  context.planTransfer = registerPlanTransfer(router, { ...context, plans: () => context.plans, accounts: () => context.accounts });
  context.plans = registerPlanRoutes(router, { ...context, accounts: () => context.accounts, cheques: () => context.cheques, invoices: () => context.invoices });
  context.accounts = registerAccountRoutes(router, { ...context, plans: () => context.plans, cheques: () => context.cheques });
  context.stock = registerStockRoutes(router, { ...context, accounts: () => context.accounts, plans: () => context.plans });
  // Çek / Senet (v2.0.7): cari ve taksit defterine bağlı; Kasa tahsil/ödeme olaylarını okur.
  context.cheques = registerChequeRoutes(router, { ...context, accounts: () => context.accounts, plans: () => context.plans });
  // Fatura (v2.0.15): belge birincil kayıt; stok, cari, Kasa (peşin), çek/senet ve taksit (vadeli) aynı işlemde yazılır.
  context.invoices = registerInvoiceRoutes(router, { ...context, accounts: () => context.accounts, stock: () => context.stock, plans: () => context.plans, cheques: () => context.cheques });
  // Ana Defter (v2.0.13): alt defterlerden türetilen çift yönlü yevmiye, hesap planı mizanı ve mutabakat kapısı.
  context.ledger = registerLedgerRoutes(router, { ...context, cash: () => context.cash, accounts: () => context.accounts, integrity: () => context.integrity });
  // Mutabakat kapısı (v2.0.13): para taşıyan her işlem COMMIT'ten önce alt defter ↔ ana defter denetiminden geçer;
  // sapma yaratacaksa ROLLBACK edilir ve günlüğe yazılır (lib/integrity.mjs).
  context.integrity = createIntegrity({ store, ledger: () => context.ledger, accounts: () => context.accounts, stock: () => context.stock, plans: () => context.plans, period: () => context.period, log, now: config.now });
  context.integrity.start();
  // WhatsApp ile ekstre ve mesaj (v2.0.13): tek ya da toplu; alıcıları sunucu hazırlar, gönderimler cari kartına yazılır.
  registerWhatsappRoutes(router, { ...context, accounts: () => context.accounts });
  // ANLIK DURUM (v2.0.7): Kasa, Cari, Stok ve Çek/Senet'in kendi hesaplarını okur (tek kaynak); raporlar.
  // Vade takip ve nakit akışı (v2.0.9) tablolardaki ödeme günlerini de okur (tüm veri oturumları; routes/reports.mjs).
  context.overview = registerOverviewRoutes(router, { ...context, cash: () => context.cash, accounts: () => context.accounts, plans: () => context.plans, stock: () => context.stock, cheques: () => context.cheques, invoices: () => context.invoices, tables: () => context.tableReports });
  // Rapor merkezi (v2.0.7): programdaki her bilginin hazır raporu; ekranda ön izleme, PDF ve Excel.
  context.reportCenter = registerReportCenter(router, { ...context, cash: () => context.cash, accounts: () => context.accounts, plans: () => context.plans, stock: () => context.stock, cheques: () => context.cheques, invoices: () => context.invoices, overview: () => context.overview, ledger: () => context.ledger, integrity: () => context.integrity });
  registerDueRoutes(router, { ...context, calendar: () => context.tableReports?.calendar });
  const documents = registerDocumentRoutes(router, context);
  registerTrashRoutes(router, { ...context, documents, invoices: context.invoices });
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
  // ---------- Çoklu şirket dağıtımı (v2.0.17) ----------
  // Ortak katman yolları hub'da kalır; öbür her istek kullanıcının SEÇİLİ şirketinin örneğine gider (her şirket ayrı
  // veri tabanı ve servis kümesi). Şirket değişince istemci sayfayı yeniler; açık pencereler, olay akışı ve önbellek
  // o şirketin örneğinden gelir.
  // v2.0.20: Yedekler (admin/backups) de ortak katmanda: bütün şirketlerin yedeği tek yerden alınır, listelenir, indirilir.
  const HUB_ONLY = /^\/api\/(auth|public|license|companies|health|admin\/(users|roles|recovery|update|backups))(\/|$)/;
  function appFor(company) {
    if (!company || company.id === ROOT_COMPANY_ID) return app;
    if (hub) return hub.appFor(company);
    if (busyCompanies.has(company.id)) throw new HttpError(503, busyCompanies.get(company.id), { retryAfter: 5 });
    // v2.0.21: kaydı bozulmuş (001'in veri klasörünü gösteren) şirket açılmaz — açılışta ortak kullanıcı tablosunu yeniden
    // yazardı ve 001'in kayıtları bu şirkette görünürdü. Yönetici Yönetim → Şirketler → Ayır ile kendi klasörüne alır.
    if (companies.sharesRoot(company)) throw new HttpError(503, `“${company.code} · ${company.name}” şirketi ilk şirketin (001) veri dosyasını gösteriyor; açılmadı. Yönetici Yönetim → Şirketler'den “Ayır” ile kendi klasörüne almalı.`);
    let child = children.get(company.id);
    if (!child) {
      const dirs = companies.dirsOf(company);
      // v2.0.21 (arıza testi bulgusu): veri dosyası ya da klasörü kaybolmuş şirket için sessizce YENİ, BOŞ veri tabanı
      // açılmaz (kullanıcı şirketini boş görüp üstüne yazıyordu). Yalnız hiç açılmamış yeni şirket (boş klasör) oluşturulur;
      // bir kez açılan şirket ortak katmanda işaretlenir. Kayıp dosyada istek 503 alır; Yedekler'den geri yüklenir.
      const openedKey = `company.opened.${company.id}`;
      const file = resolveDbPath(dirs.dataDir);
      if (!existsSync(file)) {
        const fresh = existsSync(dirs.dataDir) && readdirSync(dirs.dataDir).length === 0 && !store.setting(openedKey, "");
        if (!fresh) throw new Error(`veri dosyası bulunamadı: ${file}`);
      }
      mkdirSync(dirs.dataDir, { recursive: true });
      child = createApp({
        ...overrides,
        dataDir: dirs.dataDir,
        // Yedek kökü ortak; şirketin klasörü (<kod> - <ad>) kayıt defterinden her kullanımda çözülür.
        backupDir: config.backupDir,
        log,
        companyId: company.id,
        supervisorLink: undefined,
        startLicenseTimers: false,
        // Otomatik yedek ortak katmanın zamanlayıcısında (bütün şirketler); çocuk kendi zamanlayıcısını kurmaz.
        scheduleBackups: false,
        // Şirketler aynı iş saatini paylaşır (sahte saatte de: hub'ın saati ilerleyince 002'nin de ilerler).
        now: config.now,
        hub: { store, auth, access, recovery, license, supervisorLink, companies, appFor, withCompanyDb, busyCompanies, backups, cloudBackup, mirrorBackup, mirrorNow, requestRestart, closeCompany },
      });
      child.usersStamp = usersFingerprint(store);
      children.set(company.id, child);
      if (!store.setting(openedKey, "")) store.setSetting(openedKey, "1");
      log.info(`Şirket açıldı: ${company.code} · ${company.name}`);
    } else {
      const stamp = usersFingerprint(store);
      if (child.usersStamp !== stamp) {
        mirrorUsers(store, child.store);
        child.usersStamp = stamp;
      }
    }
    return child;
  }
  const dispatch = (req, res) => {
    if (hub) return scoped(req, res);
    const pathname = (req.url || "/").split("?")[0];
    if (!pathname.startsWith("/api/") || HUB_ONLY.test(pathname)) return scoped(req, res);
    let user = null;
    try {
      user = auth.currentUser(req) || null;
    } catch {
      user = null;
    }
    // Sayfanın şirketi (v2.0.21): istemci her isteğe sayfanın açıldığı şirketi ekler (?hofCompany=). Sunucudaki seçim
    // kullanıcı başınadır; aynı hesap iki pencerede/bilgisayarda açıkken birinde şirket değişince öbür pencerenin 001'i
    // gösterirken girdiği kayıt 002'ye yazılıyordu. Artık istek sayfanın şirketine gider; seçim yalnız yeni açılan
    // sayfanın şirketini belirler. Belirtilmemişse (eski istemci, indirme bağlantısı) eskisi gibi seçili şirket.
    let requested = "";
    try {
      requested = new URL(req.url || "/", "http://x").searchParams.get("hofCompany") || "";
    } catch {
      requested = "";
    }
    let selected;
    if (requested) {
      selected = companies.get(requested);
      if (!selected) {
        send(res, 409, { ok: false, error: "Bu pencerenin şirketi artık yok (silinmiş olabilir); sayfayı yenileyin.", code: "company-missing" });
        return Promise.resolve();
      }
      if (user && !companies.canAccess(user, selected.id)) {
        send(res, 403, { ok: false, error: "Bu şirketi görme yetkiniz yok; yönetici yetki verebilir.", code: "company-forbidden" });
        return Promise.resolve();
      }
    } else selected = companies.get(companies.selectedFor(user));
    if (!selected || selected.id === ROOT_COMPANY_ID) return scoped(req, res);
    try {
      return appFor(selected).handleScoped(req, res);
    } catch (error) {
      // Şirket geri yükleniyor/siliniyor: başka şirketin verisi gösterilmez, "birkaç saniye sonra" denir.
      if (error instanceof HttpError) {
        send(res, error.status, { ok: false, error: error.message }, error.extra?.retryAfter ? { "retry-after": String(error.extra.retryAfter) } : {});
        return Promise.resolve();
      }
      // v2.0.20 (2.0.17'den kalan hata): şirket açılamazsa istek ARTIK 001'e düşmez — seçici 002'yi gösterirken girilen
      // kayıt 001'e yazılıyordu. Kullanıcıya açık hata verilir; yönetici şirketi değiştirip ya da yedekten geri yükleyebilir.
      log.error(`Şirket açılamadı (${selected.code} · ${selected.name})`, error);
      send(res, 503, { ok: false, error: `“${selected.code} · ${selected.name}” şirketinin verisi açılamadı (${error.code || error.message}). Sol üstten başka şirkete geçin; yönetici Yönetim → Yedekler'den geri yükleyebilir.`, code: "company-unavailable" }, { "retry-after": "30" });
      return Promise.resolve();
    }
  };
  // Şirket örneğini kapatır ve listeden çıkarır (geri yükleme, silme). Ortak katmandaki servisler (lisans, oturum)
  // çocuğun kapanışından etkilenmez.
  async function closeCompany(id) {
    if (hub) return hub.closeCompany(id);
    const child = children.get(id);
    if (!child) return false;
    children.delete(id);
    await child.close();
    return true;
  }
  const server = createServer((req, res) => {
    dispatch(req, res).catch(error => {
      log.error("Beklenmeyen hata", error);
      if (!res.headersSent) send(res, 500, { ok: false, error: "Sunucu işlemi tamamlayamadı." }, SECURITY_HEADERS);
    });
  });
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;
  server.requestTimeout = 5 * 60_000;

  // Otomatik yedek (v2.0.20): ortak katmanda tek zamanlayıcı BÜTÜN şirketleri yedekler — bu açılışta hiç açılmamış şirket
  // de (veri tabanı kısa süreliğine salt okunur açılır); her şirket kendi klasörüne, Drive'a da kendi klasörüne.
  const stopBackups = config.scheduleBackups && !hub
    ? startBackupScheduler({ targets: () => backups.scheduleTargets(), intervalHours: config.backupIntervalHours, keep: config.backupKeep, startDelayMs: config.backupOnStartDelayMs, log, onBackup: mirrorBackup })
    : () => {};
  if (overrides.startLicenseTimers !== false && !hub) license.start();
  // Gün dönümünde tüm ekranlara "alerts.refresh" (olay tabanlı uyarı akışı, v2.0.2).
  const alertScheduler = createAlertScheduler({ events, log, clock: config.now });
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

  // ---------- Şirket verisini sıfırla (v2.0.17, müşteri: "datayı sıfırla ama lisansım gitmesin") ----------
  // mode "movements": cari/stok kartları, Kasa hesapları, ayarlar KALIR; bakiyeler sıfır (hareketler, faturalar, taksitler,
  // çek/senet, Ana Defter, işlem geçmişi silinir). mode "all": şirket ilk açıldığı gibi boş (şirket adı/kodu, unvan/VKN/logo,
  // fatura serisi kalır). Önce ZORUNLU yedek (Yedekler'den geri yüklenir). Lisans, kullanıcılar, öbür şirketler ortak
  // katmanda; etkilenmez.
  // v2.1.0 (§5.6): banka hareketleri (işlem başlığı, banka fişi, POS satışı ve valör takvimi, bankaya tahsile verilen çek, ekstre ve
  // eşleşmeler, planlı işlemler, iş kuyruğu, istek kimlikleri) hareketle silinir; hesap ve POS kartları ile komisyon oranları kart
  // gibi ("Tümünü Sıfırla"da) silinir. Kur (fx_rates) ve banka tatilleri başvuru verisidir: silinmez. İşlem No sayacı "meta." önekiyle
  // korunur (sıfırlamadan sonra numara yeniden kullanılmaz).
  const MOVEMENT_TABLES = ["cash_entries", "payments", "account_entries", "stock_moves", "invoice_offsets", "invoice_repeats", "invoice_lines", "invoices", "einvoice_inbox", "plan_entries", "plan_items", "plan_imports", "plans", "cheque_events", "cheques", "integrity_log", "message_sends", "trash", "audit_events",
    "fin_events", "bank_lines", "pos_sales", "pos_items", "cheque_collections", "bank_statements", "bank_statement_lines", "bank_matches", "bank_plans", "bank_jobs", "request_keys", "ledger_snapshots"];
  const CARD_TABLES = ["accounts", "stock_items", "plan_groups", "dataset_rows", "dataset_imports", "records", "overrides", "deleted_records", "notes", "phones", "liens", "tasks", "case_notes", "case_documents", "source_snapshots", "free_cells", "free_rows", "free_history", "free_sheets", "messages",
    "bank_accounts", "pos_terminals", "pos_rates"];
  // v2.0.21 (rastgele sıra testi bulgusu): 001'in veri tabanı aynı zamanda ortak katmandır; kullanıcıların şirket seçimi ve
  // ŞİRKET YETKİLERİ (company.*) ile parola kurtarma anahtarı (auth.*) "Tümünü Sıfırla"da silinmez (geri yüklemedeki ortak
  // katman listesiyle aynı: company-backups.mjs COMMON_SETTINGS).
  const KEEP_SETTINGS = ["office.", "meta.", "sectors.", "client.", "invoice", "einvoice", "edoc", "whatsapp", "backup", "cloud", "drive", "license.", "update", "company.", "auth.", "bank.settings"];
  function resetData(user, { mode = "movements", resetNumbers = true } = {}) {
    if (!["movements", "all"].includes(mode)) throw new HttpError(400, "Sıfırlama türü 'movements' ya da 'all' olmalı.");
    const company = companies.get(companyId);
    // Zorunlu yedek şirketin kendi klasörüne (v2.0.20: <kod> - <ad>, adında kod, içinde şirket kimliği).
    const backup = takeBackup(`sifirlama-oncesi-${company?.code || "001"}`, Math.max(config.backupKeep, 10));
    const has = table => Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ?", table));
    const counts = {};
    // v2.0.26 (A12): dönem kilidi varken "Tüm Hareketleri Sil" kapanmış dönemin hareketlerini de siler; kilit kalsaydı mutabakat
    // kapısı işlemi geri alıyordu (409). Sıfırlamada kilit de kaldırılır (onay penceresinde yazar) ve işlem geçmişine
    // "ledger.period.unlocked" yazılır. "Tümünü Sıfırla" kilit ayarını zaten siliyordu; o da aynı kaydı bırakır.
    const unlocked = context.period?.lockedUntil?.() || "";
    store.raw("company.reset", () => store.tx(() => {
      const tables = mode === "all" ? [...MOVEMENT_TABLES, ...CARD_TABLES] : MOVEMENT_TABLES;
      for (const table of tables) {
        if (!has(table)) continue;
        counts[table] = store.get(`SELECT COUNT(*) AS n FROM ${table}`).n;
        store.run(`DELETE FROM ${table}`);
      }
      // Hesap kartları kalırken açılışları silindi: "Bakiye Doğrulandı" kalkar, kartta "Açılış Bakiyesi Gir" açılır (§5.6).
      if (mode !== "all" && has("bank_accounts")) store.run("UPDATE bank_accounts SET balance_confirmed = 0 WHERE balance_confirmed <> 0");
      if (resetNumbers) store.run("DELETE FROM settings WHERE key = 'plans.receiptSeq'");
      if (unlocked) {
        store.run("DELETE FROM settings WHERE key = ?", LOCK_KEY);
        audit(user, "ledger.period.unlocked", "period", { previous: unlocked, lockedUntil: "", reason: "company.reset", mode });
      }
      if (mode === "all") {
        for (const row of store.all("SELECT key FROM settings")) {
          if (!KEEP_SETTINGS.some(prefix => row.key.startsWith(prefix))) store.run("DELETE FROM settings WHERE key = ?", row.key);
        }
      }
      audit(user, "company.reset", companyId, { mode, resetNumbers, backup: backup?.name || "", counts, unlocked });
    }));
    // Kapı tabanı yeniden ölçülür (kilit kalktı, eski satırlar silindi; dönem kilidi değişikliğindeki gibi).
    context.integrity?.start?.();
    try {
      profile.invalidate?.();
      clientState.bump?.(user?.id || "");
    } catch {
      // önbellek tazeleme başarısız olsa da veri sıfırlandı
    }
    events?.publish("workspace.changed", { kind: "reset", actorId: user?.id, actorName: user?.display_name, mode });
    log.info(`Şirket verisi sıfırlandı (${company?.code || "001"}, ${mode}); yedek: ${backup?.name}`);
    return { mode, backup: backup?.name || "", counts, unlocked };
  }

  let closed = false;
  const app = {
    config,
    log,
    store,
    context,
    companies,
    companyId,
    handleScoped: scoped,
    resetData,
    integrity: context.integrity,
    ledger: context.ledger,
    period: context.period,
    db,
    server,
    migration,
    events,
    license,
    info,
    // Şirket yedekleri (v2.0.20): bütün şirketler; testler ve araçlar için.
    backups,
    backupDir: backupDirNow,
    // Zamanlayıcının bir turu (zamanı gelen bütün şirketler); zamanlayıcı kapalıyken de çalışır.
    runDueBackups: () => (hub ? [] : runDueBackups({ targets: () => backups.scheduleTargets(), intervalHours: config.backupIntervalHours, log, onBackup: mirrorBackup })),
    stagedRestore,
    openCompanyIds: () => (hub ? [] : [...children.keys()]),
    // Servis yöneticisi altında server.mjs bağlar: 001 geri yüklemesi için uygulama kendini düzgün kapatır, servis
    // yöneticisi yeniden açar (açılışta geri yükleme uygulanır).
    onRestartRequest(handler) {
      restartHandler = typeof handler === "function" ? handler : null;
    },
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
      // Oturum sınırlayıcı ve lisans ortak katmanın: şirket örneği kapanırken (geri yükleme, silme) durdurulmaz
      // (v2.0.17'de şirket silinince ilk şirketin lisans denetimi de duruyordu).
      if (!hub) auth.limiter.stop();
      dataset.stop();
      documents.stop();
      if (!hub) license.stop();
      events.stop();
      await new Promise(resolve => {
        server.close(() => resolve());
        server.closeAllConnections?.();
      });
      await analysisRunner.close();
      for (const child of children.values()) await child.close();
      db.close();
    },
  };
  return app;
}
