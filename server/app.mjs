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
import { createEventHub, isSharedEvent } from "./lib/events.mjs";
import { runDueBackups, startBackupScheduler } from "./lib/backup.mjs";
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
import { LATEST_VERSION, SCHEMA_AHEAD_CODE, SCHEMA_AHEAD_MESSAGE, isSchemaAhead, runMigrations } from "./lib/migrations.mjs";
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
import { registerBankRoutes } from "./routes/bank.mjs";
import { createPosQueue } from "./lib/bank/pos.mjs";
import { registerWhatsappRoutes } from "./routes/whatsapp.mjs";
import { createIntegrity } from "./lib/integrity.mjs";
import { createIdempotency } from "./lib/idempotency.mjs";
import { createBank } from "./lib/bank/post.mjs";
import { createMoneyLines } from "./lib/bank/money-lines.mjs";
import { migrateBankGrants } from "./lib/bank/grants.mjs";
import { markLegacyRows, repairBank } from "./lib/bank/repair.mjs";
import { clearVouchers, repairLegacyReset } from "./lib/ledger-vouchers.mjs";
import { clearSnapshots } from "./lib/ledger-snapshots.mjs";
import { LOCK_KEY, createPeriod } from "./lib/period.mjs";
import { registerDueRoutes } from "./routes/dues.mjs";
import { registerPlanRoutes } from "./routes/plans.mjs";
import { registerPlanTransfer } from "./routes/plan-transfer.mjs";
import { registerAccountRoutes } from "./routes/accounts.mjs";
import { registerStockRoutes } from "./routes/stock.mjs";
import { registerChequeRoutes } from "./routes/cheques.mjs";
import { registerDoubtfulRoutes } from "./routes/doubtful.mjs";
import { registerOpeningReviewRoutes } from "./routes/opening-review.mjs";
import { registerTaxRoutes } from "./routes/tax.mjs";
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
import { registerStaffRoutes } from "./routes/staff.mjs";
import { registerMaliyetRoutes } from "./routes/maliyet.mjs";
import { ROOT_COMPANY_ID, createCompanyRegistry, mirrorUsers, usersFingerprint } from "./lib/companies.mjs";
import { registerCompanyRoutes } from "./routes/companies.mjs";
import { registerGettingStartedRoutes } from "./routes/getting-started.mjs";
import { createBackup } from "./lib/backup.mjs";
import { applyStagedRestore, commonLayer, createCompanyBackups } from "./lib/company-backups.mjs";
import { ARCHIVE_READ_ONLY_CODE, archiveFileOf, archiveKey, validYear } from "./lib/devir/archives.mjs";
import { archiveStatus, prepareArchive } from "./lib/devir/archive-open.mjs";
import { MAINTENANCE_CODE, applyWriteGuard, archiveMaintenanceMessage, createMaintenance, isMaintenanceAbort, maintenanceMessage } from "./lib/devir/maintenance.mjs";
import { registerDevirRoutes } from "./routes/devir.mjs";
import { resolveDbPath } from "./lib/db-path.mjs";
import { createReportRunner } from "./lib/report-runner.mjs";
import { USAGE_MONTHS, journalRowsOf, summarizeUsage, windowMonths } from "./lib/einvoice/kullanim.mjs";
import { openUsageLedger } from "./lib/einvoice/kullanim-defteri.mjs";
import { USAGE_BACKUP_TABLE } from "./lib/backup.mjs";
import { isoDay } from "./lib/plans.mjs";
import { MOBILE_PREFIX, captureResponse, isPhone, resolveMobile, transformMobile } from "./lib/mobile.mjs";
import { dispatchMobileWrite, matchMobileWrite } from "./lib/mobile-write.mjs";
import { createMobileRemote } from "./lib/mobile-remote.mjs";
import { mobileSyncFromConfig } from "./lib/mobile-sync.mjs";
import { registerMobileAdminRoutes } from "./routes/mobile-admin.mjs";
import { registerMobileTunnelRoutes } from "./routes/mobile-tunnel.mjs";
import { attachTunnel } from "./lib/tunnel/attach.mjs";
import { createWhatsappHub } from "./lib/whatsapp/hub.mjs";
import { createWhatsappHook, isHookRequest } from "./lib/whatsapp/hook.mjs";
import { createWriteLock } from "./lib/write-lock.mjs";

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

// Mutabakat kapısının tam taraması (v2.1.0, §3.11): arka planda bu aralıkla salt okuma.
const INTEGRITY_SCAN_MINUTES = 15;

// 2.4.9 B1 (docs/2.4.9-tasarim/B1-createApp-baglanti.md): açılış openDatabase'den SONRA düşerse (göç, kullanıcı aynası, bozuk tablo sayfası, kilit,
// geç adımlar) kurulan her kaynak tersten geri alınır: şirket dosyasının bağlantısı SENKRON kapanır (çağıran hatayı aldığında dosya serbesttir —
// Windows'ta silinebilir / geri yüklemede değiştirilebilir), zamanlayıcılar durur, hub'ın işçisinden ve olay kanalından kayıt düşer. Önceden bağlantı
// çöp toplamaya kadar açık kalıyordu (her başarısız açılış bir tutamak daha). Başarılı açılışta davranış aynen (yığın yalnız hatada okunur); asıl hata
// aynen yeniden fırlatılır (ders 21: temizlik hatası asıl hatayı ezmez).
export function createApp(overrides = {}) {
  const opening = { undo: [], log: overrides.log || null };
  try {
    const app = buildApp(overrides, opening);
    opening.undo.length = 0; // başarılı açılış: geri alma adımları bırakılır; kapanış app.close() ile (değişmedi)
    return app;
  } catch (error) {
    rollbackOpen(opening, error);
    throw error;
  }
}

function rollbackOpen({ undo, log }, cause) {
  const warn = error => {
    try {
      log?.warn?.(`Açılış geri alınırken: ${error?.message || error} (asıl hata: ${cause?.message || cause})`);
    } catch {
      // günlük de yazılamadı; asıl hata yine fırlatılır
    }
  };
  for (const step of undo.splice(0).reverse()) {
    try {
      const result = step();
      // Async kapanışlar (analiz / rapor iş parçacığı, işçinin durması, tünel) beklenmez; şirket dosyasını tutmazlar.
      if (typeof result?.catch === "function") result.catch(warn);
    } catch (error) {
      warn(error);
    }
  }
}

function buildApp(overrides, opening) {
  const { undo } = opening; // açılışta kurulan her kaynağın geri alması, kuruluş sırasıyla (yalnız hatada, tersten — rollbackOpen)
  // 2.5.0 D2 (docs/devir/D2-ALTYAPI-TASARIM.md §3): ARŞİV örneği — { year, cutoff, file, warning } yalnız ortak katmanın openArchive'ından gelir. Veri klasörü
  // şirketinkidir (belgeler/, secret.key, mesaj-arsivi/ şirket klasörüne çözülür; G8), veri tabanı arşiv dosyası (salt okunur bağlantı).
  const archive = overrides.hub && overrides.archive?.file ? overrides.archive : null;
  const baseConfig = loadConfig(overrides);
  const config = archive ? Object.freeze({ ...baseConfig, dbPath: archive.file }) : baseConfig;
  const log = overrides.log || createLogger(config.logLevel);
  opening.log = log;
  // 2.4.9 B1 (YALNIZ TEST — test/createapp-acilis-geri-alma-249.test.mjs; __testWriteLockProbe emsali): açılışın verilen aşamasında kesinti. Yalnız programdan
  // (test oluşturucusu) verilir, ortam / ayar dosyasından okunmaz; verilmezse sıfır maliyet. Çocuk örnek `...overrides` ile aynı kancayı alır (companyId ile ayrılır).
  // "geri-alma-da-duser" dönerse geri alma yığınına fırlatan bir adım da eklenir (T6: temizlik düşse de asıl hata ve öbür adımlar).
  const openFault = stage => {
    const fault = overrides.__testOpenFault?.(stage, overrides.companyId || ROOT_COMPANY_ID);
    if (!fault) return;
    if (fault === "geri-alma-da-duser") {
      undo.push(() => {
        throw new Error("test: geri alma kesintisi");
      });
    }
    throw new Error(`test: açılış kesintisi ${stage}`);
  };
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

  const db = openDatabase(config.dbPath, archive ? { readOnly: true } : undefined);
  undo.push(() => db.close());
  // 2.5.0 BS-7 (şema sürüm kapısı; docs/devir/DEVIR-PLANI.md G6): veri dosyası programın daha yeni bir sürümüyle açılmışsa (user_version > LATEST_VERSION) şirket
  // YAZILABİLİR açılmaz — göç koşmaz, yazma istekleri 409 SCHEMA_AHEAD alır, arka plan işleri yazmaz, açılıştaki onarım / ayna / kayıt adımları atlanır; okuma çalışır.
  // 002 ve sonrası (çocuk örnek) bağlantı düzeyinde de kilitlenir (PRAGMA query_only: SQLite her yazımı reddeder; gözden kaçan bir yazıcı da dosyayı değiştiremez).
  // 001'in bağlantısı ortak katmanı da taşır (giriş oturumu, lisans, şirket seçimi) → orada bağlantı kilidi yok; kapı uygulama düzeyinde.
  const schemaVersionAtOpen = Number(db.prepare("PRAGMA user_version").get().user_version) || 0;
  const schemaGate = isSchemaAhead(schemaVersionAtOpen) ? Object.freeze({ code: SCHEMA_AHEAD_CODE, version: schemaVersionAtOpen, latest: LATEST_VERSION, message: SCHEMA_AHEAD_MESSAGE }) : null;
  if (schemaGate && hub) db.exec("PRAGMA query_only = ON");
  // 2.5.0 D2: arşiv örneğinde HİÇBİR yazma isteği geçmez (403 archive-read-only); bağlantı da salt okunur. Açılıştaki onarım / ayna / göç adımları ve arka plan
  // yazıcıları yeni şemalı şirketteki (BS-7) gibi atlanır — writeGate ikisinin birleşimidir; schemaGate (ekran şeridi) yalnız şema kapısını anlatır.
  const archiveGate = archive ? Object.freeze({ code: ARCHIVE_READ_ONLY_CODE, year: String(archive.year), cutoff: String(archive.cutoff || ""), message: `${archive.year} arşivi yalnız görüntülenir; kayıt eklenemez, değiştirilemez, silinemez.`, warning: archive.warning || "", schemaAhead: Boolean(schemaGate) }) : null;
  const writeGate = schemaGate || archiveGate;
  // 2.5.0 D2 (G1.1): bakım kipi ortak katmanda tek kayıt; şirket örnekleri hub'dan okur. 002+ bakımdayken bağlantı query_only (aşağıda setMaintenanceGuard).
  let maintenance = null; // ortak katmanda aşağıda (servis yöneticisi bağlantısından sonra) kurulur
  const maintenanceOf = () => (hub ? hub.maintenance : maintenance);
  const inMaintenance = () => Boolean(!archive && maintenanceOf()?.has(overrides.companyId || ROOT_COMPANY_ID));
  if (hub && !archive && inMaintenance()) db.exec("PRAGMA query_only = ON");
  openFault("after-open");
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
  // 2.4.7 E4: yedeğe şirketin kullanım defteri satırları da girer (geri yüklemede yalnız birleştirilir).
  const takeBackup = (label, keep = config.backupKeep) => createBackup(db, backupDirNow(), { label, keep, company: companyIdentity(), usageRows: usageRowsOfSelf() });
  // Bir şirketin veri tabanıyla iş: açık örneğinki, açık değilse kısa süreli salt okunur bağlantı (açıp kapatır; örnek
  // açılmaz, bağlantı sızmaz). Otomatik yedek, Yönetim → Şirketler sayıları ve geri yükleme öncesi yedek bunu kullanır.
  function withCompanyDb(company, fn) {
    if (!company || company.id === companyId) return fn(db);
    if (hub) return hub.withCompanyDb(company, fn);
    const child = children.get(company.id);
    // BS-7: yeni şemalı (query_only) çocuğun bağlantısında VACUUM INTO (yedek) yapılamaz → kısa süreli salt okunur bağlantı (aşağıda).
    // 2.5.0 D2: bakımdaki çocuğun bağlantısı da query_only (devir yedeği / kopya kısa süreli salt okunur bağlantıdan).
    if (child && !child.schemaGate && !maintenance?.has(company.id)) return fn(child.db);
    const file = resolveDbPath(companies.dirsOf(company).dataDir);
    if (!existsSync(file)) return null;
    const temp = openDatabase(file, { readOnly: true });
    try {
      return fn(temp);
    } finally {
      temp.close();
    }
  }
  // 2.4.7 E4/E5 (S4): e-Belge kullanım defteri kurulum düzeyinde, ana veri klasöründe (şirket dosyalarının dışında; lib/einvoice/kullanim-defteri.mjs).
  // Çocuk şirket örnekleri hub'ın defterini kullanır. Bir şirketin izi deftere aktarılır (birincil anahtar çift sayımı önler); okunamayan şirket atlanır.
  const usageLedger = hub ? hub.usageLedger : openUsageLedger({ dir: config.dataDir, log, fault: overrides.edocUsageFault || null });
  if (!hub) undo.push(() => usageLedger.close());
  function usageRowsOfSelf() {
    try {
      return usageLedger.allRows();
    } catch {
      return null;
    }
  }
  const backupLedgerRowsOf = db => {
    try {
      return db.prepare(`SELECT company_id, company_code, ettn, env, kind, month, invoice_id, source, created_at FROM ${USAGE_BACKUP_TABLE}`).all();
    } catch {
      return [];
    }
  };
  function syncUsageOf(company) {
    try {
      const [rows, copy] = withCompanyDb(company, db => [journalRowsOf(db), backupLedgerRowsOf(db)]) || [[], []];
      // V15: geri yüklenen yedekteki defter kopyası (bütün şirketler) yalnız birleştirilir; sonra şirketin kendi izi.
      return usageLedger.mergeAll(copy) + usageLedger.syncFrom(company.id, company.code, rows);
    } catch (error) {
      log.warn?.(`e-Belge kullanım defteri: ${company?.code || company?.id} aktarılamadı (${error.message})`);
      return 0;
    }
  }
  function syncUsageAll() {
    const seen = new Set();
    let added = 0;
    for (const company of companies.list()) {
      if (!company?.id || seen.has(company.id)) continue;
      seen.add(company.id);
      added += syncUsageOf(company);
    }
    return added;
  }
  // Lisans doğrulamasına giden özet (S5): içinde bulunulan ay + önceki 2 ay, ay × ortam başına satır (sıfırlar dahil), bütün şirketlerin toplamı.
  function edocUsageSummary() {
    syncUsageAll();
    const months = windowMonths(context.period?.today?.() || isoDay(new Date()), USAGE_MONTHS);
    return { edoc: summarizeUsage(usageLedger.counts({ from: months[0] }), { months }) };
  }
  // Geri yüklenen ya da silinen şirket o sırada açılmaz; istek 503 ile "birkaç saniye sonra" der.
  const busyCompanies = hub ? hub.busyCompanies : new Map();
  // 2.4.8 W2: geri yüklenen şirketin süren WhatsApp toplu gönderimleri defterde durdurulur (şirket yeniden açılınca DB'de de "Durduruldu").
  const backups = hub ? hub.backups : createCompanyBackups({ registry: companies, dataDir: config.dataDir, keep: config.backupKeep, log, withDb: withCompanyDb, busy: busyCompanies, closeCompany: id => closeCompany(id), usageRowsFor: () => usageLedger.allRows(), onRestored: company => {
    try {
      whatsapp?.ledger.stopCompany(company.id, "restored", new Date(config.now()).toISOString());
    } catch (error) {
      log.warn?.(`WhatsApp gönderimleri geri yüklemeden sonra durdurulamadı (${error.message}).`);
    }
    syncUsageOf(company);
  }, paused: id => Boolean(maintenance?.has(id)) });
  if (!hub) {
    try {
      backups.migrate();
    } catch (error) {
      log.warn(`Yedekler şirket klasörlerine taşınamadı: ${error.message}`);
    }
  }
  // 2.5.0 D2: arşiv örneği göç ETMEZ — arşivin göçü açılmadan önce, kısa süreli yazılabilir bağlantıda yapıldı (lib/devir/archive-open.mjs); bu bağlantı salt okunur.
  const migration = archive ? { from: schemaVersionAtOpen, to: schemaVersionAtOpen, applied: [], backup: null, archive: true } : runMigrations(store, { backupDir: backupDirNow(), keep: config.backupKeep, log, company: companyIdentity(), now: config.now });
  openFault("after-migrations");
  // 2.4.8 W2 (lib/whatsapp/hub.mjs): WhatsApp gönderim defteri (makine düzeyi, ana veri klasöründe), tek işçi ve bağlantı kaydı — ortak katmanda tek örnek.
  // 2.5.0 WE: store = ortak katmanın deposu (Elle Bağla uygulama düzeyi webhook bilgileri kurulum başına orada, mühürlü — lib/whatsapp/app-webhook.mjs).
  const whatsapp = hub ? hub.whatsapp : createWhatsappHub({ dataDir: config.dataDir, store, now: () => new Date(config.now()), log, gapMs: config.whatsappGapMs, manual: config.whatsappWorker === "manual", fault: config.whatsappLedgerFault });
  if (!hub) {
    undo.push(() => whatsapp.ledger.close());
    undo.push(() => whatsapp.scheduler.stop()); // tersten: önce işçi (async, beklenmez; açılışta başlamamıştır), sonra defter
  }
  // 001 yedekten geri yüklendiyse (açılışta uygulandı) eski toplu gönderimler defterde durdurulur: geri yüklenen veri eski işleri diriltmez (plan §6 W2).
  if (!hub && stagedRestore?.ok) whatsapp.ledger.stopCompany(companyId, "restored", new Date(config.now()).toISOString());
  // 2.4.7 E4 (S4): açılışta bütün şirketlerin izi kullanım defterine aktarılır (önceki çalışmada deftere eklenemeyen satır tamamlanır).
  if (!hub) syncUsageAll();
  // 2.0.21 öncesinden gelen şirketler (gözden geçirme bulgusu): veri dosyası olan her şirket "açılmış" sayılır; dosyası
  // sonradan kaybolursa sessizce boş veri tabanı açılmaz (2.0.21'deki ilk açılışını beklemeden). BS-7: yeni şemalı 001'e yazılmaz.
  if (!hub && !schemaGate) {
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
  else if (!writeGate && !inMaintenance()) mirrorUsers(hub.store, store); // BS-7: yeni şemalı çocuğa kullanıcı aynası yazılmaz (yalnız ad gösterimi içindir); D2: arşive ve bakımdaki şirkete de
  openFault("after-users");
  // Gözden geçirme D5 (K4): eski sürümün (2.0.25/2.0.26) rol ya da kişi kaydında sildiği banka yetkileri ortak katmanın her açılışında geri
  // gelir (yalnız işaretsiz rol/kişi; yalnız EKLER, bugünkü yetkilerden). Çalışmasa da program açılır.
  if (!hub && !schemaGate) {
    try {
      store.tx(() => migrateBankGrants(store));
    } catch (error) {
      log.error?.("Banka yetkileri yeniden değerlendirilemedi", error);
    }
  }

  // BS-7: yeni şemalı şirkette Değişiklik Geçmişi'ne (audit_events) yazılmaz — yalnız okuma yapılır; dışa aktarma / giriş izi o sürede tutulmaz.
  // 2.5.0 D2: arşivde ve bakım kipinde de yazılmaz (bakımda giriş izi tutulmaz; takasla zaten kaybolurdu — tasarım notu §5.2).
  const audit = createAudit(store, { now: config.now, canWrite: () => !writeGate && !inMaintenance() });
  // Merkezi para yazımı (v2.1.0; lib/bank/post.mjs, plan §3.3 K6): bank.post + para yazımı denetimi (K6) bu şirketin store'unda.
  const bank = createBank({ store, now: config.now, log, strict: config.moneyStrict, requests: createIdempotency({ store, now: config.now }), audit });
  // Roller ve etkin yetkiler (v2.0.10): yerleşik 4 rol + ofisin tanımladığı roller + kişiye özel ekle/çıkar.
  const access = hub ? hub.access : createAccess({ store });
  const auth = hub ? hub.auth : createAuth({ store, config, audit, access });
  if (!hub) undo.push(() => auth.limiter.stop());
  // Yönetici parolası kurtarma (v2.0.10): kurtarma anahtarı ya da sunucu bilgisayarında üretilen tek seferlik kod.
  const recovery = hub ? hub.recovery : createRecovery({ store, dataDir: config.dataDir, log });
  const clientState = createClientState({ store, audit });
  const readGoogleSheet = createSheetsReader({ fetchImpl: config.fetchImpl, cacheMs: config.sheetsCacheMs });
  const serveStatic = createStaticHandler(config.publicDir);
  const supervisorLink = hub ? hub.supervisorLink : overrides.supervisorLink ?? (config.supervised ? createSupervisorLink(process) : null);
  // Canlı olay kanalı: oturumu kapanan (çıkış, parola değişikliği, pasifleştirme) bağlantılar ping turunda düşer.
  const events = createEventHub({ log, pingMs: config.eventsPingMs, maxAgeMs: config.eventsMaxAgeMs, isValid: client => auth.sessionAlive(client.tokenHash) });
  undo.push(() => events.stop());
  // 2.5.0 D2 (G1.1; lib/devir/maintenance.mjs): bakım kipi ortak katmanda. Kip açılınca / kapanınca veri tabanı koruması: 001'de geçici tetikleyiciler (ortak katman
  // yazılabilir kalır), açık 002+ örneğinde PRAGMA query_only (o sırada açılan örnek açılışta alır — yukarıda).
  const setMaintenanceGuard = on => {
    if (archive) return;
    if (hub) db.exec(`PRAGMA query_only = ${on || schemaGate ? "ON" : "OFF"}`);
    else if (!schemaGate) applyWriteGuard(db, on, { commonTables: commonLayer().tables, commonSettingsSql: commonLayer().settingsSql });
  };
  if (!hub) {
    maintenance = createMaintenance({
      dataDir: config.dataDir,
      log,
      supervisorLink: () => supervisorLink,
      now: () => Date.now(),
      onChange: (id, on, entry) => {
        if (id === companyId) setMaintenanceGuard(on);
        else children.get(id)?.setMaintenanceGuard(on);
        events.publish("maintenance.changed", { companyId: id, on, reason: entry?.reason || "" });
      },
    });
    undo.push(() => maintenance.stop());
  }
  // 2.4.4 (iş listesi 29): yönetim olayları (yetki, kullanıcı, şirket listesi, lisans) ortak katmanın kanalına yayınlanır; 002'yi gösteren
  // pencere 002'nin kanalına bağlıdır → bu olaylar şirket kanalına aynı hedefle (users/except) iletilir. Şirkete özgü veri olayları
  // (cari, kasa, fatura, sıfırlama…) iletilmez: her şirket kendi verisinin olayını kendi kanalında yayınlar.
  const unbridgeHubEvents = hub?.events ? hub.events.tap((event, data, target) => isSharedEvent(event, data) && events.publish(event, data, target)) : null;
  undo.push(() => unbridgeHubEvents?.());
  const chat = createChat({ store, events, audit, roles: access, canWrite: () => !writeGate && !inMaintenance() });
  // 2.4.8 İş P1 (lib/write-lock.mjs): arka plan işleri kilitli şirket dosyasına yazmayı denemez (olay döngüsü tutulmaz). __testWriteLock* yalnız test oluşturucusundan.
  const baseWriteLock = createWriteLock({ probe: overrides.__testWriteLockProbe !== false, ...(Number.isFinite(overrides.__testWriteLockBackoffMs) ? { backoffMs: overrides.__testWriteLockBackoffMs } : {}) });
  // 2.5.0 D2 (G1.1): bakım kipindeki şirket arka plan işleri için "kilitli" görünür — WhatsApp işçisi (queue.canWrite → guard) o şirketin işini yürütmez, bakımını yapmaz.
  // Yalnız bu şirketin anahtarı; makine defterinin anahtarı (LEDGER_LOCK_KEY) etkilenmez.
  const writeLock = {
    ...baseWriteLock,
    isMarked: key => (key === companyId && inMaintenance()) || baseWriteLock.isMarked(key),
    guard: (key, target) => (key === companyId && inMaintenance() ? false : baseWriteLock.guard(key, target)),
  };
  // BS-7: yeni şemalı şirkete hiçbir arka plan işi yazmaz (WhatsApp işçisi, belge temizliği, Sheets eşitlemesi, POS valör kuyruğu, oturum temizliği, sohbet arşivi,
  // mutabakat taraması, mobil özet, WhatsApp durum bildirimi 503 "yeniden denenecek"). Otomatik yedek okumadır; sürer (lib/company-backups.mjs scheduleTargets).
  // 2.5.0 D2: arşiv örneği ve bakım kipindeki şirket de (otomatik yedek bakımdaki şirketi atlar — scheduleTargets paused).
  const canWriteInBackground = () => !writeGate && !inMaintenance() && writeLock.guard(companyId, store);
  // 30 günden eski sohbet mesajları veri klasöründeki mesaj-arsivi/ klasörüne taşınır (v2.0.2).
  const chatArchive = createChatArchive({ store, dir: path.join(config.dataDir, "mesaj-arsivi"), log });
  // Lisans (Faz 3): süresi dolan, engellenen veya doğrulanamayan kurulum salt okunur çalışır. Veri eşitlemesi de
  // o sürede durur. Uygulama nesnesi aşağıda kurulduğundan eşitleme denetimi geç bağlanır.
  let license = null;
  // Drive'a yedek (v2.0.2–2.0.26) 2.1.0'da kaldırıldı (kullanıcı kararı, 10.10.2026): yedekler yalnız yerel yedek klasöründe.
  // Eski kurulumun veri tabanındaki "backup.cloud" ayarı okunmaz, silinmez; hiçbir yere kopya alınmaz.
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
    // 31e: kayıt tahsilatının anahtarı (bağı) yükleme/eşitlemede taşınırken merkezi para yazımından geçer (K6 "assign").
    bank,
    autoSync: config.datasetAutoSync,
    tickMs: config.datasetTickMs,
    // İş P1: zamanlanmış eşitleme kilitli dosyada o tur atlanır (kullanıcının "Şimdi Eşitle"si bu denetimden geçmez).
    canWrite: () => (!license || license.writable()) && canWriteInBackground(),
  });
  undo.push(() => dataset.stop());
  clientState.useDataset(() => dataset.info());
  // Serbest sayfalar (v2.0.1): kullanıcının "+" ile açtığı Excel benzeri sekmeler; tablo görünümüne satır olarak girer.
  const trash = createTrash(store, { now: config.now });
  const free = createFreeSheets({ store, audit, dataset, trash });
  dataset.setFreeProvider(free);
  // Ofis profili: sektör, kelime dağarcığı, kalemle değiştirilen başlıklar ve verinin önbellekli analizi.
  // Analiz ayrı iş parçacığında koşar; sunucu bu sırada istekleri yanıtlar (yerel-önce: ofis bilgisayarı kilitlenmez).
  const analysisRunner = createAnalysisRunner({ log, enabled: overrides.analysisWorker !== false });
  undo.push(() => analysisRunner.close());
  const profile = createProfileService({ store, dataset, audit, events, log, free, runner: analysisRunner, clock: config.now });
  if (!writeGate && !inMaintenance()) profile.init();
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
      // 2.4.7 E5 (EDM iş ortaklığı): bütün şirketlerin e-Belge kullanım sayacı, son 3 ay toplamı (lib/einvoice/kullanim.mjs). Açık olmayan şirketin
      // dosyası kısa süreli salt okunur açılır (withCompanyDb); okunamayan şirket atlanır (lisans doğrulamasını bozmaz).
      usage: () => edocUsageSummary(),
      ...licenseOptions,
    });
    undo.push(() => license.stop());
    license.init();
  }
  dataset.start();
  openFault("after-dataset");
  // Sunucunun yeniden başlatılması (001 geri yüklemesi): servis yöneticisi altında server.mjs bağlar; yoksa false.
  let restartHandler = null;
  const requestRestart = reason => {
    if (hub) return hub.requestRestart(reason);
    if (!restartHandler) return false;
    const timer = setTimeout(() => restartHandler(reason), 400);
    timer.unref?.();
    return true;
  };
  // 2.4.4 (iş listesi 29 ek): kişinin açık canlı bağlantılarını BÜTÜN şirket kanallarında kapatır (hesap pasif/silindi, oturumlar kapatıldı,
  // parola sıfırlandı) ya da yalnız verilen şirketlerde (şirket erişimi kaldırıldı). Önceden yalnız 001 kanalı kapanıyordu; 002 bağlantısı
  // ping turuna (25 sn) ya da erişim değişikliğinde bağlantı ömrüne (5 dk) kadar olay almaya devam ediyordu. Açık olmayan şirket açılmaz.
  const closeLive = ({ userId, companyIds = null }) => {
    if (hub) return hub.closeLive({ userId, companyIds });
    const match = client => client.userId === userId;
    if (!companyIds || companyIds.includes(companyId)) events.closeWhere(match);
    for (const [id, child] of children) if (!companyIds || companyIds.includes(id)) child.events.closeWhere(match);
  };
  const context = {
    // BS-7: null ya da { code, version, latest, message } — yeni şemalı veri dosyası (şirket yalnız görüntülenir).
    schemaGate,
    // 2.5.0 D2: arşiv örneğinin kapısı (null: canlı şirket) ve ortak katmanın bakım kipi kaydı.
    archive: archiveGate,
    maintenance: maintenanceOf(),
    closeLive,
    writeLock,
    canWriteInBackground,
    config, log, store, bank, auth, access, recovery, audit, clientState, startedAt, supervisorLink, events, chat, chatArchive, dataset, profile, license, free, trash, companies, companyId, company: () => companies.get(companyId),
    // İş saati (v2.1.0; lib/clock.mjs): modüller "bugün"ü ve zaman damgalarını buradan okur (config.now; testlerde sahte saat).
    now: config.now,
    // Tek kaynak (v2.1.0, K5; lib/bank/money-lines.mjs): Kasa, Banka ve POS, ANLIK DURUM ve Ana Defter'in beklenenleri buradan okur.
    // verify (testlerde gateVerify): K7'nin yazımdan sonra sakladığı toplam ve "tarihten sonra satır yok" kısayolu tam sorguyla denetlenir.
    money: createMoneyLines(store, { verify: config.gateVerify }),
    // Şirket yedekleri (v2.0.20): bütün şirketler, kendi klasörlerinde.
    backups, backupDir: backupDirNow, withCompanyDb, closeCompany: id => closeCompany(id), busyCompanies, requestRestart,
    // 2.4.7 E4 (S4): bu şirketin kullanım defteri görünümü (routes/invoices.mjs setE ve invoices-usage ucu).
    edocUsage: {
      add: row => usageLedger.add(companyId, selfCompany().code, row),
      sync: rows => {
        try {
          return usageLedger.syncFrom(companyId, selfCompany().code, rows);
        } catch (error) {
          log.warn?.(`e-Belge kullanım defteri: ${selfCompany().code} aktarılamadı (${error.message})`);
          return 0;
        }
      },
      counts: ({ from = "" } = {}) => usageLedger.counts({ from, companyId }),
    },
  };
  if (stagedRestore) {
    const actor = stagedRestore.by ? { id: stagedRestore.by, display_name: stagedRestore.byName } : null;
    // BS-7: 001 yeni şemalıyken (geri yükleme başarısız, kapı açık) denetim izi (şirket verisi) yazılmaz; sonuç satırı aşağıda YİNE yazılır.
    if (!schemaGate) audit(actor, stagedRestore.ok ? "system.backup_restored" : "system.backup_restore_failed", stagedRestore.name, { company: "001", safety: stagedRestore.safety || "", error: stagedRestore.error || "" });
    // Sonuç Yönetim → Yedekler'de gösterilir (gözden geçirme bulgusu: başarısız 001 geri yüklemesi sessiz kalıyordu;
    // kullanıcı eski veriyle çalıştığını bilmiyordu). 2.5.0 BS-7 tur 1 (dar kontrol ORTA-1): kapı açıkken de yazılır — backup.lastRestore ortak katman
    // anahtarı DEĞİLDİR (COMMON_SETTINGS yalnız backup.cloud); kapının bilinçli istisnasıdır (yalnız bu durum notu; test/sema-kapisi-bs7.test.mjs denetler); yazılmazsa kullanıcı yalnız "Yalnız Görüntülenir" şeridini görür, geri yüklemenin nedeni hiçbir yerde olmaz.
    try {
      store.setSetting("backup.lastRestore", JSON.stringify({ ok: stagedRestore.ok, name: stagedRestore.name, safety: stagedRestore.safety || "", error: stagedRestore.error || "", byName: stagedRestore.byName || "", at: new Date().toISOString() }));
    } catch (error) {
      log.warn?.(`Geri yükleme sonucu kaydedilemedi: ${error.message}`);
    }
  }

  // 2.4.7 M2 (lib/mobile-remote.mjs; docs/mobil/M2-TASARIM.md): karekodlu cihaz eşleme, eşli cihaz sınırı ve uzak isteğin kapısı — ortak katmanda tek örnek
  // (cihazlar program başına sayılır). Uzak istek yalnız ayrı yerel dinleyiciye gelir (app.listenRemote).
  context.mobileRemote = hub ? hub.mobileRemote : createMobileRemote({ store, license, clock: config.remoteNow, audit, log, publicUrl: overrides.mobileRemoteUrl || "" });
  const router = createRouter();
  router.get("/api/health", async ({ res }) => ok(res, { service: "destekofis-merkezi", status: "ok", version: config.version, time: new Date().toISOString(), uptimeSeconds: Math.round(process.uptime()) }));
  registerAuthRoutes(router, context);
  registerAdminRoutes(router, context);
  registerMobileAdminRoutes(router, context);
  registerMobileTunnelRoutes(router, context);
  if (!hub) registerCompanyRoutes(router, { ...context, appFor: company => appFor(company), resetData: (company, ...args) => appFor(company).resetData(...args), closeCompany: id => closeCompany(id) });
  // 2.5.0 D2 (routes/devir.mjs): arşiv kaydı + durum, arşiv bütünlük denetimi, devir yedekleri listesi, bakım kipi durumu — ortak katmanda.
  if (!hub) registerDevirRoutes(router, { ...context, archiveView: company => archiveView(company), archiveCache: () => archiveVerifyCache });
  // Hareket tarihi ve dönem kilidi (v2.0.13): Kasa, Cari, Stok ve Taksit aynı kuralla. v2.0.26 (A1): kayıt tahsilatı da
  // (çalışma alanı rotaları) aynı kurala bağlı; bu yüzden onlardan önce kurulur.
  context.period = createPeriod({ store, now: config.now });
  // Taksit servisi (context.plans) daha sonra kurulur; işlem geçmişi ona istek anında ulaşır (v2.0.6). Kasa (eksi bakiye
  // denetimi) da sonra kurulur; istek anında okunur.
  registerWorkspaceRoutes(router, { ...context, plans: () => context.plans, cash: () => context.cash, bankModule: () => context.bankAccounts?.module });
  context.cash = registerCashRoutes(router, context);
  // Taksitler (v2.0.4): Kasa ve tahsilat takvimi bu servisin hareketlerini ve gecikmelerini okur.
  // Cari ve Stok (v2.0.6): taksit kartları cariye bağlıdır; stok hareketi Kasa'ya ya da cariye yazılabilir. Servisler
  // birbirine istek anında ulaşır (kurulum sırası: taksit → cari → stok).
  // Tablodan taksit kartına aktarma (v2.0.8): "/api/workspace/plans/from-table" ve "/imports" kalıpları kartın
  // "/api/workspace/plans/:id" kalıbından önce kaydedilir (yönlendirici ilk eşleşeni seçer).
  context.planTransfer = registerPlanTransfer(router, { ...context, plans: () => context.plans, accounts: () => context.accounts });
  context.plans = registerPlanRoutes(router, { ...context, accounts: () => context.accounts, cheques: () => context.cheques, invoices: () => context.invoices, bankModule: () => context.bankAccounts?.module });
  context.accounts = registerAccountRoutes(router, { ...context, plans: () => context.plans, cheques: () => context.cheques, invoices: () => context.invoices, bankModule: () => context.bankAccounts?.module, doubtful: () => context.doubtful });
  // Şüpheli Ticari Alacaklar (2.3.0 İz 1; plan §3.11b): cari kartının 128/129 işlemleri; cari servisine (bakiye, Değersiz Alacak satırı) istek anında ulaşır.
  context.doubtful = registerDoubtfulRoutes(router, { ...context, accounts: () => context.accounts, bankModule: () => context.bankAccounts?.module });
  context.openingReview = registerOpeningReviewRoutes(router, context); // 2.5.0 Ç5-A: KG-16 "Açılış Olabilir" uçları (routes/opening-review.mjs)
  context.stock = registerStockRoutes(router, { ...context, accounts: () => context.accounts, plans: () => context.plans, bankModule: () => context.bankAccounts?.module });
  // Çek / Senet (v2.0.7): cari ve taksit defterine bağlı; Kasa tahsil/ödeme olaylarını okur.
  context.cheques = registerChequeRoutes(router, { ...context, accounts: () => context.accounts, plans: () => context.plans, bankModule: () => context.bankAccounts?.module });
  // Fatura (v2.0.15): belge birincil kayıt; stok, cari, Kasa (peşin), çek/senet ve taksit (vadeli) aynı işlemde yazılır.
  context.invoices = registerInvoiceRoutes(router, { ...context, accounts: () => context.accounts, stock: () => context.stock, plans: () => context.plans, cheques: () => context.cheques, bankModule: () => context.bankAccounts?.module });
  // Ana Defter (v2.0.13): alt defterlerden türetilen çift yönlü yevmiye, hesap planı mizanı ve mutabakat kapısı.
  // 2.5.0 Ç3: kilitli dönemin donmuş defteri (lib/ledger-snapshots.mjs). __testLedgerRule / __testFreezeHook / freezeBatchLines YALNIZ test oluşturucusundan (üretimde yok).
  context.ledger = registerLedgerRoutes(router, { ...context, cash: () => context.cash, accounts: () => context.accounts, integrity: () => context.integrity, pos: () => context.bankAccounts?.pos,
    __testLedgerRule: overrides.__testLedgerRule || null, __testFreezeHook: overrides.__testFreezeHook || null, freezeBatchLines: Number(overrides.freezeBatchLines) || 0 });
  // Banka (v2.1.0 Aşama 3; plan §8.1): hesap kartları, açılış, Hesabı Atanmamış Eski Hareketler, Kurulum ve Aktarım Sihirbazı, Banka Ayarları,
  // Alt Hesap Mizanı. Ana Defter servisine (Alt Hesap Mizanı) istek anında ulaşır.
  context.bankAccounts = registerBankRoutes(router, context);
  // 2.4.3 MM3: Vergi Ödemesi ve KDV Mahsup Fişi (routes/tax.mjs).
  context.tax = registerTaxRoutes(router, { ...context, ledger: () => context.ledger, cash: () => context.cash, bankAccounts: () => context.bankAccounts });
  // Mutabakat kapısı (v2.0.13): para taşıyan her işlem COMMIT'ten önce alt defter ↔ ana defter denetiminden geçer;
  // sapma yaratacaksa ROLLBACK edilir ve günlüğe yazılır (lib/integrity.mjs).
  context.integrity = createIntegrity({ canWrite: () => !writeGate && !inMaintenance(), store, ledger: () => context.ledger, accounts: () => context.accounts, stock: () => context.stock, plans: () => context.plans, period: () => context.period, money: () => context.money, pos: () => context.bankAccounts?.pos, events, strict: config.moneyStrict, verify: config.gateVerify, partyRows: config.scopePartyRows, dbPath: config.dbPath, log, now: config.now });
  // Açılış onarımı (v2.1.0, §10.6): eski sürüme (2.0.25/2.0.26) dönülüp yeniden güncellenen dosyada eski sürümün izleri kapı kurulmadan
  // toplanır (tek işlem; yalnız ilgili kayıtlar). Onarım başarısız olsa da program açılır; sapmalar kapının tabanı ve Mutabakat Testi'nde.
  // BS-7: yeni şemalı dosyada açılış onarımları koşmaz (eski kodun onarım kuralı yeni sürümün verisine uygulanmaz).
  // 2.5.0 D2: arşiv örneğinde (salt okunur) ve bakım kipinde açılan şirkette de koşmaz (bakım bitince sonraki açılışta koşar).
  const openRepairs = !writeGate && !inMaintenance();
  if (openRepairs) {
    try {
      repairBank({ store, now: config.now, period: context.period, log });
    } catch (error) {
      log.error?.("Açılış onarımı çalışmadı", error);
    }
  }
  // Açılış onarımı (v2.1.0, Canlı Hata 2): 2.0.24–2.0.26'da iade + peşin geri ödemesiyle yanlış büyümüş taksit kartları (yalnız ödenmemiş
  // kısım; kilitli döneme yazılmaz; idempotent). Başarısız olsa da program açılır.
  if (openRepairs) {
    try {
      context.ownCardRepair = context.invoices.repairOwnCards({ log });
    } catch (error) {
      log.error?.("Taksit kartı açılış onarımı çalışmadı", error);
    }
  }
  // 2.5.0 Ç2 (BS-7 tasarım girdisi; lib/ledger-vouchers.mjs repairLegacyReset): fiş defterini bilmeyen eski sürümde yapılan Şirket Verisini Sıfırla'dan artakalan fişler
  // kapı kurulmadan kaldırılır (iz: Mutabakat Günlüğü "repair" + işlem geçmişi). Başarısız olsa da program açılır.
  if (openRepairs) {
    try {
      context.voucherRepair = repairLegacyReset({ store, now: config.now, log, companyId });
    } catch (error) {
      log.error?.("Fiş defteri açılış onarımı çalışmadı", error);
    }
  }
  // 2.5.0 Ç3 (docs/erp/C3-DONDURMA-TASARIM.md §7): eski sürümün değiştirdiği kilit donmuş defterle eşitlenir (ileri: bekleyen koşu; geri: kapsam iner). Kapıdan önce; BS-7
  // yeni şemalı dosyada koşmaz. Başarısız olsa da program açılır (kapsam ↔ kilit farkı Mutabakat Testi'nde).
  if (openRepairs) {
    try {
      context.snapshotRepair = context.ledger.snapshots.repairOnOpen();
    } catch (error) {
      log.error?.("Donmuş defter açılış onarımı çalışmadı", error);
    }
  }
  // 2.5.0 D2 (ders 47): arşiv örneğinde kapı KURULMAZ — taban ölçümü bütün defteri tarar (100.000 satırda ~1,7 sn olay döngüsü) ama arşive hiçbir yazma ulaşmaz
  // (403 + salt okunur bağlantı), kapının denetleyeceği işlem yoktur. Mutabakat Testi (okuma) arşivde de kendi taramasını yapar.
  if (!archiveGate) context.integrity.start();
  // 2.5.0 Ç3: bekleyen koşu (göç 47'nin 2.4.9 koşusu, yarım kalmış dondurma, onarım) açılışı beklemeden iş parçacığında donar; kapanışta durur (app.close).
  // Açılış sonradan düşerse (openFault / hata) geri alınır: kapalı bağlantıya çarpan iş olmaz (createapp-acilis-geri-alma-249).
  const snapshotStart = !openRepairs ? null : setImmediate(() => context.ledger.snapshots.runPending().catch(error => log.error?.("Donmuş defter dondurulamadı", error)));
  undo.push(() => {
    clearImmediate(snapshotStart);
    return context.ledger.snapshots.close();
  });
  // Tam tarama (§3.11 "Kapı ölçeği" 1): 15 dakikada bir arka planda salt okuma; yeni sapma integrity_log + zil.
  context.integrity.scanMinutes = INTEGRITY_SCAN_MINUTES;
  // Gözden geçirme B7: tarama ayrı iş parçacığında (salt okunur bağlantı); veri, gün ve kilit değişmediyse atlanır.
  context.integrity.scanTimer = overrides.integrityScan === false ? null : setInterval(() => {
    // İş P1: tarama sapma bulursa integrity_log'a yazar — kilitli dosyada o tur atlanır.
    if (!canWriteInBackground()) return;
    context.integrity.scanInBackground().catch(error => log.error?.("Mutabakat taraması çalışmadı", error));
  }, INTEGRITY_SCAN_MINUTES * 60_000);
  context.integrity.scanTimer?.unref?.();
  undo.push(() => clearInterval(context.integrity.scanTimer));
  openFault("after-integrity");
  // POS valör kuyruğu (2.2.0, plan §4.4/2): (a) açılışta bir tur — ilk şirkette dinlemeye başladıktan sonra (listen), şirket örneğinde açılınca;
  // (b) 15 dakikada bir (unref; kapanışta durur); (f) "Şimdi Aktar" ve (g) dönem kilidi öncesi uçlarda; (d) ortak katmanda günde bir: bu süreçte
  // açılmamış şirketin veri dosyasında vadesi gelmiş POS kalemi varsa şirket açılır (açılış kendi kuyruğunu çalıştırır). Gün dönümü (c) 15
  // dakikalık turla karşılanır (karar). Kuyruk açılışı beklemez (setImmediate).
  const posQueue = createPosQueue({ pos: () => context.bankAccounts?.pos, log, canWrite: canWriteInBackground });
  context.posQueue = posQueue;
  undo.push(() => posQueue.stop()); // stopped bayrağı aşağıdaki setImmediate(start)'ı da etkisiz kılar
  if (hub && overrides.posQueue !== false) setImmediate(() => posQueue.start());
  // WhatsApp ile ekstre ve mesaj (v2.0.13): tek ya da toplu; alıcıları sunucu hazırlar, gönderimler cari kartına yazılır.
  // 2.4.8 W2: WhatsApp Business API gönderim kuyruğu bu şirketin; işçi ortak katmanda tek (whatsapp.scheduler). Açılışta yarım kalan işler defterden çözülür.
  context.whatsapp = registerWhatsappRoutes(router, { ...context, whatsapp, accounts: () => context.accounts, mobileSyncOf: () => context.mobileSync });
  // BS-7: yeni şemalı şirketin WhatsApp kuyruğu toparlanmaz ve işçiye kaydedilmez (süren iş defterde bekler; program güncellenince sürer).
  // 2.5.0 D2: arşiv örneğinin kuyruğu da (canlı şirketin kuyruğu işçide kayıtlı kalır); bakım kipinde açılan şirket kaydolur ama işçi kip bitene dek yürütmez (writeLock).
  if (context.whatsapp.queue && !writeGate) {
    if (!inMaintenance()) {
      try {
        const recovered = context.whatsapp.queue.recover();
        if (Object.values(recovered).some(Boolean)) log.info?.(`WhatsApp gönderim kuyruğu açılışta toparlandı: ${JSON.stringify(recovered)}`);
      } catch (error) {
        log.error?.("WhatsApp gönderim kuyruğu açılışta toparlanamadı", error);
      }
    }
    whatsapp.registry.set(companyId, context.whatsapp.connection.summary());
    whatsapp.scheduler.register(companyId, context.whatsapp.queue);
    undo.push(() => whatsapp.scheduler.unregister(companyId)); // yalnız bu örnek kaydettiyse (kayıttan hemen sonra)
  }
  openFault("after-register");
  // ANLIK DURUM (v2.0.7): Kasa, Cari, Stok ve Çek/Senet'in kendi hesaplarını okur (tek kaynak); raporlar.
  // Vade takip ve nakit akışı (v2.0.9) tablolardaki ödeme günlerini de okur (tüm veri oturumları; routes/reports.mjs).
  context.overview = registerOverviewRoutes(router, { ...context, cash: () => context.cash, accounts: () => context.accounts, plans: () => context.plans, stock: () => context.stock, cheques: () => context.cheques, invoices: () => context.invoices, tables: () => context.tableReports, doubtful: () => context.doubtful });
  // Rapor merkezi (v2.0.7): programdaki her bilginin hazır raporu; ekranda ön izleme, PDF ve Excel.
  // 11.10.2026 hız düzeltmesi (§3.11 madde 5): büyük banka raporları ayrı iş parçacığında, bu şirketin veri dosyasının salt okunur anlık
  // görüntüsünden (lib/report-runner.mjs; aynı kod, aynı çıktı). Bellek içi veri tabanında (dosyası yok) ve kapalıyken yerinde hazırlanır.
  const reportRunner = config.reportWorker && config.dbPath && config.dbPath !== ":memory:" ? createReportRunner(config.reportWorkerEntry ? { entry: config.reportWorkerEntry } : {}) : null;
  context.reportRunner = reportRunner;
  undo.push(() => reportRunner?.close());
  // sharedStore (2.4.7, müşteri isteği 6a): kişi başına rapor tercihleri ortak katmanda (kullanıcılar orada; 002'de de aynı kişi aynı tercihi görür).
  context.reportCenter = registerReportCenter(router, { ...context, sharedStore: hub ? hub.store : store, tax: () => context.tax, cash: () => context.cash, accounts: () => context.accounts, plans: () => context.plans, stock: () => context.stock, cheques: () => context.cheques, invoices: () => context.invoices, overview: () => context.overview, ledger: () => context.ledger, integrity: () => context.integrity, doubtful: () => context.doubtful, offload: reportRunner ? job => reportRunner.run({ ...job, dbPath: config.dbPath, fx: config.fxEnabled === true, later: config.bankLater === true }) : null });
  registerDueRoutes(router, { ...context, calendar: () => context.tableReports?.calendar });
  const documents = registerDocumentRoutes(router, context);
  undo.push(() => documents.stop());
  registerTrashRoutes(router, { ...context, documents, invoices: context.invoices, bankModule: () => context.bankAccounts?.module, doubtful: () => context.doubtful });
  registerFreeRoutes(router, { ...context, readGoogleSheet });
  registerChatRoutes(router, context);
  registerDatasetRoutes(router, context);
  registerInsightRoutes(router, context);
  context.tableReports = registerReportRoutes(router, context);
  // Sektöre uygun taslak Excel (v2.0.9): açılış ekranından indirilir.
  registerTemplateRoutes(router, context);
  // Personel Özlük (2.4.4): Personel Raporu → Çalışanlar / Ayrılanlar; şirket kapsamlı (her şirketin kendi veri dosyası), para dışı.
  registerStaffRoutes(router, context);
  // Maliyet Hesap Kartı (2.4.6): yalnız sektörü Duşakabin Üretimi olan şirkette; şirket kapsamlı, para dışı, hiçbir modüle bağlı değil.
  registerMaliyetRoutes(router, context);
  registerLicenseRoutes(router, context);
  // Başlarken (2.4.4, KÖ3): yöneticinin ilk adımlar listesi; şirket kapsamlı, yalnız okur (taban bir kez yazılır).
  registerGettingStartedRoutes(router, context);
  registerTrpcRoutes(router, context);

  const redirect = (res, location) => {
    res.writeHead(302, { ...SECURITY_HEADERS, location, "cache-control": "no-store", "content-length": 0 });
    res.end();
  };
  // BS-7: yeni şemalı şirkette yazma istekleri reddedilir. Açık kalanlar: giriş / çıkış / parola (ortak katman oturumu), lisans, Güncelleme (programı
  // güncellemek çözümdür), Yedekler (yedek almak okumadır; eski yedeğe geri yüklemek kullanıcının bilinçli çıkış yoludur) ve şirket seçimi (001 yeni şemalıyken
  // kullanıcı 002'ye geçebilsin). Durum kodu 409: istek geçerli ama şirketin verisi bu programın sürümüyle çakışıyor.
  const SCHEMA_GATE_ALLOWED = [/^\/api\/auth\//, /^\/api\/license(\/|$)/, /^\/api\/admin\/update(\/|$)/, /^\/api\/admin\/backups(\/|$)/, /^\/api\/companies\/select$/];
  function assertSchemaWritable(pathname) {
    if (!schemaGate || SCHEMA_GATE_ALLOWED.some(pattern => pattern.test(pathname))) return;
    throw new HttpError(409, schemaGate.message, { code: schemaGate.code, schemaGate });
  }
  // 2.5.0 D2 (DEVIR-PLANI §2.2): arşiv örneğine giden HER yazma isteği 403 archive-read-only (istisna yok; ortak katman yolları arşive hiç gelmez — dispatchApp).
  function assertArchiveWritable() {
    if (archiveGate) throw new HttpError(403, archiveGate.message, { code: ARCHIVE_READ_ONLY_CODE, archive: archiveGate });
  }
  // 2.5.0 D2 (G1.1): bakım kipi. Şirket örneğinde (002+) bütün yazma istekleri; 001'de ortak katman yolları DIŞINDAKİ bütün yazma istekleri 503. Herhangi bir şirket
  // bakımdayken ortak katmanın dosya / kayıt defteri / güncelleme işleri de 503 (şirket ekle / sil / ad / Ayır / sıfırla, yedek al / geri yükle, güncelleme kur, devir).
  // Açık kalanlar: giriş / çıkış / parola (ortak katman oturumu — takasta canlıdan aktarılır), lisans, şirket seçimi, kullanıcı / rol / kurtarma / mobil yönetimi.
  const MAINTENANCE_HUB_BLOCKED = /^\/api\/(?:companies(?!\/select$)(?:\/|$)|admin\/(?:backups|update|devir)(?:\/|$))/;
  function assertNotInMaintenance(pathname) {
    const registry = maintenanceOf();
    if (!registry || archive) return;
    let entry = null;
    if (hub) entry = registry.get(companyId);
    else if (HUB_ONLY.test(pathname)) entry = MAINTENANCE_HUB_BLOCKED.test(pathname) ? registry.list()[0] || null : null;
    else entry = registry.get(companyId);
    if (entry) throw new HttpError(503, maintenanceMessage(entry), { code: MAINTENANCE_CODE, maintenance: entry, retryAfter: 30 });
  }
  async function handle(req, res) {
    const url = new URL(req.url || "/", "http://localhost");
    const pathname = url.pathname;
    try {
      if (pathname.startsWith("/api/")) {
        if (!["GET", "HEAD"].includes(req.method)) {
          assertSameOrigin(req, config.trustProxy);
          license.assertWritable(req.method, pathname);
          assertArchiveWritable();
          assertSchemaWritable(pathname);
          assertNotInMaintenance(pathname);
        }
        const matched = router.match(req.method, pathname);
        if (!matched) throw new HttpError(404, "Endpoint bulunamadı.");
        if (matched.methodNotAllowed) throw new HttpError(405, "Bu yöntem desteklenmiyor.");
        await matched.handler({ req, res, url, params: matched.params });
        return;
      }
      if (req.method !== "GET" && req.method !== "HEAD") throw new HttpError(405, "Bu yöntem desteklenmiyor.");
      // Mobil görünüm (2.4.7 M1): /mobil → /mobil/ (sayfanın göreli adresleri); telefon tarayıcısı ana adreste mobil görünüme gider
      // (?masaustu=1 ile masaüstü). Mobil dosyalar client/mobil/ altında, olağan statik dosya yoluyla.
      if (pathname === "/mobil") return redirect(res, "/mobil/");
      if ((pathname === "/" || pathname === "/index.html") && !url.searchParams.has("masaustu") && isPhone(req.headers["user-agent"])) return redirect(res, "/mobil/");
      if (pathname === "/mobil/" && serveStatic(req, res, "/mobil/index.html")) return;
      if (serveStatic(req, res, pathname)) return;
      if (String(req.headers.accept || "").includes("text/html")) return notFoundPage(res);
      send(res, 404, { ok: false, error: "Sayfa bulunamadı." });
    } catch (error) {
      if (error instanceof HttpError) {
        const headers = error.extra?.retryAfter ? { "retry-after": String(error.extra.retryAfter) } : {};
        if (res.headersSent) return res.end();
        return send(res, error.status, { ok: false, error: error.message, ...error.extra }, headers);
      }
      // 2.5.0 D2 tur 2 (dar kontrol DÜŞÜK-1): 001 bakımdayken veri tabanı koruması (geçici tetikleyici, DESTEKOFIS_BAKIM) yazımı düşürdüyse istek 503 maintenance alır —
      // istek kapısının görmediği her yazıcı (ör. ortak katmandaki "görevlerini devrederek kullanıcı sil" şirketin görev tablosuna yazar) doğru ileti verir; veri değişmedi.
      if (isMaintenanceAbort(error)) {
        const entry = maintenanceOf()?.get(companyId) || null;
        if (res.headersSent) return res.end();
        return send(res, 503, { ok: false, error: maintenanceMessage(entry), code: MAINTENANCE_CODE, maintenance: entry }, { "retry-after": "30" });
      }
      log.error(`API hatası ${req.method} ${pathname}`, error);
      if (res.headersSent) return res.end();
      fail(res, 500, "Sunucu işlemi tamamlayamadı.");
    }
  }

  // Her istek, isteği yapan kullanıcının seçtiği veri oturumunda çalışır (v2.0.1; kullanıcı gerektiğinde bir kez okunur).
  // 2.2.0 İz 1.2: istemci her isteğe penceresinin sayfasını ekler (?hofPage=; ?hofCompany= gibi); şirketin sayfasıysa istek o sayfada
  // çalışır (lib/dataset.mjs activeKey). Aynı kullanıcının öbür penceresinde yeni sayfa açılması ya da seçilmesi bu pencereyi değiştirmez.
  const pageOf = req => {
    try {
      return String(new URL(req.url || "/", "http://x").searchParams.get("hofPage") || "").slice(0, 200);
    } catch {
      return "";
    }
  };
  const scoped = (req, res) => {
    let resolved;
    return runScoped({ user: () => (resolved === undefined ? (resolved = auth.currentUser(req) || null) : resolved), page: pageOf(req) }, () => handle(req, res));
  };
  // ---------- Çoklu şirket dağıtımı (v2.0.17) ----------
  // Ortak katman yolları hub'da kalır; öbür her istek kullanıcının SEÇİLİ şirketinin örneğine gider (her şirket ayrı
  // veri tabanı ve servis kümesi). Şirket değişince istemci sayfayı yeniler; açık pencereler, olay akışı ve önbellek
  // o şirketin örneğinden gelir.
  // v2.0.20: Yedekler (admin/backups) de ortak katmanda: bütün şirketlerin yedeği tek yerden alınır, listelenir, indirilir.
  // 2.4.7 M2: admin/mobile (Mobil Cihazlar) da ortak katmanda: cihazlar program başına.
  // 2.5.0 D2: admin/devir (arşiv kaydı, devir yedekleri) ve admin/maintenance (bakım kipi durumu) da ortak katmanda.
  const HUB_ONLY = /^\/api\/(auth|public|license|companies|health|admin\/(users|roles|recovery|update|backups|mobile|devir|maintenance))(\/|$)/;
  // Şirket ve arşiv örneklerinin ortak katmandan aldıkları (çocuk createApp'in hub'ı).
  const childHub = () => ({ store, auth, access, recovery, license, supervisorLink, companies, appFor, withCompanyDb, busyCompanies, backups, requestRestart, closeCompany, events, closeLive, usageLedger, mobileRemote: context.mobileRemote, mobileSync: context.mobileSync, whatsapp, maintenance, openArchive, closeArchives });

  // ---------- 2.5.0 D2: arşivin salt okunur açılması (docs/devir/D2-ALTYAPI-TASARIM.md §3; DEVIR-PLANI §2.1–§2.3) ----------
  // İstek ?hofArchive=<yıl> taşıyorsa (şirketi ?hofCompany= ya da seçili şirket) arşiv örneğine gider. Arşiv örneği şirketin kimliğini taşır (companyId aynı;
  // ayrı anahtarla tutulur), arşiv dosyasını salt okunur bağlantıyla açar, açılmadan önce bütünlüğü ve göçü lib/devir/archive-open.mjs'de görür.
  // Ortak katmanın arka plan işleri (otomatik yedek, POS valörü, WhatsApp, kullanım defteri) arşivleri görmez: hepsi companies.list() üzerinden döner.
  const archiveChildren = new Map();
  const archiveOpening = new Map();
  const archiveVerifyCache = new Map();
  // 2.5.0 D2 tur 2 (dar kontrol ORTA-2; G1.1): bakımdaki şirketin arşivi açılmaz, açık arşiv örneğine de istek gitmez (503 maintenance). Devir arşive dokunur (Devri Yenile
  // yazar, Devri Geri Al arsiv/silinen'e taşır); kip açıkken arşiv dosyası göç etmemeli, kayıt yazılmamalı, closeCompany'nin kapattığı örnek yeniden açılmamalı (Windows'ta açık
  // tutamak taşımayı düşürür — ders 48). Açılış sürerken kip açılırsa her beklemeden sonra (özet, göç kopyası) aynı denetim (prepareArchive guard): iş durur, dosya / kayıt değişmez.
  const archiveMaintenanceRefusal = (company, year) => {
    const entry = maintenance?.get(company.id) || null;
    return entry ? new HttpError(503, archiveMaintenanceMessage(entry, { companyLabel: `${company.code} · ${company.name}`, year }), { code: MAINTENANCE_CODE, maintenance: entry, retryAfter: 30 }) : null;
  };
  function openArchive(company, year) {
    if (hub) return hub.openArchive(company, year);
    const key = archiveKey(company.id, year);
    if (busyCompanies.has(company.id)) return Promise.reject(new HttpError(503, busyCompanies.get(company.id), { retryAfter: 5 }));
    if (busyCompanies.has(key)) return Promise.reject(new HttpError(503, busyCompanies.get(key), { retryAfter: 5 }));
    const refusal = archiveMaintenanceRefusal(company, year);
    if (refusal) return Promise.reject(refusal);
    if (archiveChildren.has(key)) return Promise.resolve(archiveChildren.get(key));
    if (archiveOpening.has(key)) return archiveOpening.get(key);
    const guard = () => {
      const refused = archiveMaintenanceRefusal(company, year);
      if (refused) throw refused;
    };
    // YALNIZ TEST (test/fixtures/devir-d2-arsiv-goc-isci.mjs; __testOpenFault emsali): arşiv göçünün kesme noktaları. Programdan verilir, ayardan okunmaz.
    const step = overrides.__testArchiveStep ? name => overrides.__testArchiveStep(name, { companyId: company.id, year: String(year) }) : null;
    const opening = (async () => {
      const entry = companies.archiveOf(company.id, year);
      if (!entry) throw new HttpError(404, `“${company.code} · ${company.name}” şirketinin ${year} arşivi bulunamadı.`, { code: "archive-not-found" });
      const prepared = await prepareArchive({ company, entry, registry: companies, log, now: config.now, cache: archiveVerifyCache, key, guard, step });
      const child = createApp({
        ...overrides,
        dataDir: companies.dirsOf(company).dataDir,
        networkFile: config.networkFile,
        backupDir: config.backupDir,
        log,
        companyId: company.id,
        archive: { year: entry.year, cutoff: entry.cutoff || "", file: prepared.file, warning: prepared.warning, state: prepared.state },
        supervisorLink: undefined,
        startLicenseTimers: false,
        scheduleBackups: false,
        now: config.now,
        integrityScan: false,
        chatArchive: false,
        alertScheduler: false,
        posQueue: false,
        hub: childHub(),
      });
      archiveChildren.set(key, child);
      log.info(`Arşiv açıldı (salt okunur): ${company.code} · ${company.name} ${entry.year}${prepared.migrated ? " — programın sürümüne taşındı" : ""}`);
      return child;
    })().finally(() => archiveOpening.delete(key));
    archiveOpening.set(key, opening);
    return opening;
  }
  // Şirketin açık arşiv örnekleri kapanır (şirket geri yükleniyor / siliniyor / Ayır; D4: arşiv değiştirilmeden önce). year verilirse yalnız o yıl.
  async function closeArchives(companyId, year = null) {
    if (hub) return hub.closeArchives(companyId, year);
    let closedCount = 0;
    for (const [key, child] of [...archiveChildren]) {
      if (key !== archiveKey(companyId, year) && !(year === null && key.startsWith(`${companyId}@arsiv-`))) continue;
      archiveChildren.delete(key);
      await child.close({ reason: "company" });
      closedCount += 1;
    }
    return closedCount;
  }
  // Yönetim ekranı ve D4 için: şirketin arşiv kayıtları + dosya durumu (özet hesaplanmaz; olay döngüsü tutulmaz — ders 47).
  function archiveView(company) {
    const dataDir = companies.dirsOf(company).dataDir;
    return companies.archivesOf(company.id).map(entry => {
      const status = archiveStatus({ file: archiveFileOf(dataDir, entry.year), entry, cache: archiveVerifyCache, key: archiveKey(company.id, entry.year) });
      return { ...entry, companyId: company.id, companyLabel: `${company.code} · ${company.name}`, open: archiveChildren.has(archiveKey(company.id, entry.year)), status: status.state, statusLabel: status.label, fileSize: status.size ?? null };
    });
  }
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
        // İş V1 (dar kontrol 16) + X2 (dar kontrol 17): sürüp giden yokluk — kancanın "kalıcı açılamama" ayrımı bu alana bakar (geri yükleme / Ayır sırasında
        // busyCompanies önce yanıt verir). İşaret `code`'a KONMAZ: ekran iletisi (dispatch) code'u gösterir, Türkçe neden + dosya yolu kalsın.
        if (!fresh) throw Object.assign(new Error(`veri dosyası bulunamadı: ${file}`), { dataMissing: true });
      }
      mkdirSync(dirs.dataDir, { recursive: true });
      child = createApp({
        ...overrides,
        dataDir: dirs.dataDir,
        // Vekil sunucu ayarı makine genelidir: bütün şirketler ortak katmanın dosyasını okur (veri klasörü şirkete göre değişse de).
        networkFile: config.networkFile,
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
        hub: childHub(),
      });
      // 2.5.0 D2: bakım kipinde açılan örneğe kullanıcı aynası yazılmadı → kip bitince ilk istekte aynalanır (damga boş).
      child.usersStamp = maintenance?.has(company.id) ? "" : usersFingerprint(store);
      children.set(company.id, child);
      if (!store.setting(openedKey, "")) store.setSetting(openedKey, "1");
      log.info(`Şirket açıldı: ${company.code} · ${company.name}`);
    } else if (!child.schemaGate && !maintenance?.has(company.id)) {
      const stamp = usersFingerprint(store);
      if (child.usersStamp !== stamp) {
        mirrorUsers(store, child.store);
        child.usersStamp = stamp;
      }
    }
    return child;
  }
  // Mobil görünüm (2.4.7 M1; lib/mobile.mjs): /api/mobil/… isteği beyaz listeden programın kendi ucuna çevrilir ve SONRA olağan yoldan
  // (şirket seçimi, oturum, yetki, istek kaynağı, lisans) geçer; yetki burada tekrar edilmez. Oturum özeti ve rapor kataloğu mobil biçime çevrilir.
  const dispatchMobile = async (req, res) => {
    // 2.4.7 M5 (lib/mobile-write.mjs): mobil yazma beyaz listesi → programın mevcut tahsilat / ödeme / taksit / stok girişi ucu (uzak kapı ÖNCE geçti).
    if (matchMobileWrite(req.method, req.url)) return dispatchMobileWrite(req, res, dispatchApp);
    let resolved;
    try {
      const url = new URL(req.url || "/", "http://x");
      resolved = resolveMobile(req.method, url.pathname, url.searchParams);
    } catch (error) {
      if (error instanceof HttpError) return send(res, error.status, { ok: false, error: error.message, ...error.extra });
      throw error;
    }
    // 2.4.7 M2: telefonun istediği şirket (company=) her mobil uçta aynı kuralla denetlenir — ortak katman uçlarında da (oturum özeti): olmayan şirket 409,
    // görme yetkisi olmayan şirket 403 (companies.canAccess: yönetici hepsi, işaretsiz kullanıcı yalnız 001). Oturumsuz istek hedef uçta 401 alır.
    const wanted = new URL(req.url || "/", "http://x").searchParams.get("company");
    if (wanted) {
      const target = companies.get(wanted);
      if (!target) return send(res, 409, { ok: false, error: "Bu pencerenin şirketi artık yok (silinmiş olabilir); sayfayı yenileyin.", code: "company-missing" });
      let viewer = null;
      try {
        viewer = auth.currentUser(req) || null;
      } catch {
        viewer = null;
      }
      if (viewer && !companies.canAccess(viewer, target.id)) return send(res, 403, { ok: false, error: "Bu şirketi görme yetkiniz yok; yönetici yetki verebilir.", code: "company-forbidden" });
    }
    req.url = resolved.url;
    if (!resolved.transform) return dispatchApp(req, res);
    const captured = captureResponse();
    await dispatchApp(req, captured.res);
    const raw = captured.body().toString("utf8");
    let payload = null;
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
    const passHeaders = Object.fromEntries(Object.entries(captured.headers).filter(([name]) => !["content-length", "content-type", "content-encoding"].includes(name)));
    if (!payload) return send(res, captured.res.statusCode === 200 ? 502 : captured.res.statusCode, { ok: false, error: "Sunucu yanıtı okunamadı." }, passHeaders);
    if (captured.res.statusCode !== 200 || payload.ok !== true) return send(res, captured.res.statusCode, payload, passHeaders);
    return send(res, 200, { ok: true, data: transformMobile(resolved.transform, payload.data) }, passHeaders);
  };
  const dispatch = (req, res) => {
    if (!hub && String(req.url || "").startsWith(MOBILE_PREFIX)) return dispatchMobile(req, res);
    return dispatchApp(req, res);
  };
  // 2.4.7 M3 (lib/mobile-sync.mjs; docs/mobil/M3-TASARIM.md): şifreli özet üreticisi + kapıcıya yükleyici (ortak katmanda tek örnek; kapıcı adresi yoksa dış istek yok).
  context.mobileSync = hub ? hub.mobileSync : mobileSyncFromConfig({ store, license, mobileRemote: context.mobileRemote, dispatch, config, log, canWrite: canWriteInBackground });
  // 2.4.8 L1 kâhin F1: lisans durumu değişince kapıcıya hemen bildirilir (engelin başlangıcı kapıcıda o an; lib/mobile-sync.mjs lisansDegisti).
  if (!hub) events.tap(event => event === "license.changed" && context.mobileSync?.lisansDegisti?.());
  const dispatchApp = (req, res) => {
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
    // 2.5.0 D2: ?hofArchive=<yıl> → şirketin o yılın arşivi (salt okunur örnek). Oturumsuz istek arşivi açtırmaz (göç / bütünlük denetimi kullanıcı işidir).
    let archiveYear = "";
    try {
      archiveYear = new URL(req.url || "/", "http://x").searchParams.get("hofArchive") || "";
    } catch {
      archiveYear = "";
    }
    if (archiveYear) {
      if (!validYear(archiveYear)) {
        send(res, 400, { ok: false, error: "Arşiv yılı dört haneli olmalı (ör. 2026).", code: "archive-year" });
        return Promise.resolve();
      }
      if (!user) {
        send(res, 401, { ok: false, error: "Oturum açmanız gerekiyor." });
        return Promise.resolve();
      }
      if (!selected) {
        send(res, 409, { ok: false, error: "Bu pencerenin şirketi artık yok (silinmiş olabilir); sayfayı yenileyin.", code: "company-missing" });
        return Promise.resolve();
      }
      return openArchive(selected, archiveYear).then(
        child => child.handleScoped(req, res),
        error => {
          if (!(error instanceof HttpError)) log.error(`Arşiv açılamadı (${selected.code} · ${selected.name} ${archiveYear})`, error);
          const known = error instanceof HttpError;
          send(res, known ? error.status : 503, { ok: false, error: known ? error.message : `${archiveYear} arşivi açılamadı (${error.code || error.message}).`, ...(known ? error.extra : { code: "archive-unavailable" }) }, known && error.extra?.retryAfter ? { "retry-after": String(error.extra.retryAfter) } : {});
        },
      );
    }
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
    // 2.5.0 D2: şirketin açık arşiv örnekleri de kapanır (şirket klasörü silinir / taşınır / geri yüklenir; arşiv dosyası tutulmasın — Windows).
    const archivesClosed = await closeArchives(id);
    const child = children.get(id);
    if (!child) return archivesClosed > 0;
    children.delete(id);
    // Yalnız bu şirketin örneği kapanıyor (geri yükleme, silme, Ayır): sürmekte olan rapor "Sunucu kapanıyor" değil "şirket verisi
    // değiştiriliyor" der (lib/report-runner.mjs H1).
    await child.close({ reason: "company" });
    return true;
  }
  const server = createServer((req, res) => {
    context.mobileSync?.izle(req, res); // 2.4.7 M3: başarılı yazma → özet tetiği
    dispatch(req, res).catch(error => {
      log.error("Beklenmeyen hata", error);
      if (!res.headersSent) send(res, 500, { ok: false, error: "Sunucu işlemi tamamlayamadı." }, SECURITY_HEADERS);
    });
  });
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 70_000;
  server.requestTimeout = 5 * 60_000;
  // 2.4.7 M2: uzaktan erişim dinleyicisi (yalnız ortak katmanda; app.listenRemote ile açılır — M4'te tünel yalnız buraya bağlanır). Gelen her istek UZAKTIR:
  // cihaz → lisans → yol → uzak oturum kapısından (lib/mobile-remote.mjs) sonra olağan dağıtıcıya gider.
  // 2.4.8 W9: WhatsApp durum bildirimi (kapıcının cihazsız geçirdiği /wa/kanca/<gizli yol>; lib/whatsapp/hook.mjs) mobil uzak oturum kapısından ÖNCE işlenir.
  const whatsappHook = hub
    ? null
    : createWhatsappHook({ hooks: whatsapp.ledger, companyOf: id => companies.get(id), companies: () => companies.list(), appFor: company => appFor(company), verifyMark: req => context.mobileSync.kancaIsareti(req), modeOf: (id, wabaId) => whatsapp.modeOf(id, wabaId), appWebhook: whatsapp.appWebhook, log, now: () => new Date(config.now()) });
  const remoteServer = hub ? null : createServer((req, res) => {
    if (isHookRequest(req)) return void whatsappHook.handle(req, res);
    context.mobileSync.izle(req, res); // 2.4.7 M3
    context.mobileRemote.handle(req, res, dispatch).catch(error => {
      log.error("Beklenmeyen uzak istek hatası", error);
      if (!res.headersSent) send(res, 500, { ok: false, error: "Sunucu işlemi tamamlayamadı." }, SECURITY_HEADERS);
    });
  });
  if (remoteServer) {
    remoteServer.keepAliveTimeout = 65_000;
    remoteServer.headersTimeout = 70_000;
    remoteServer.requestTimeout = 5 * 60_000;
  }

  // POS (2.2.0, plan §4.4/2 d): bu süreçte açılmamış şirketlerde vadesi gelmiş POS kalemi var mı (veri dosyası kısa süreliğine salt okunur
  // açılır, yedek zamanlayıcısının kalıbı); varsa şirket açılır — şirket örneği açılınca kendi kuyruğunu çalıştırır.
  let posHubTimer = null;
  function posDueCompanies() {
    if (hub || closed) return;
    const day = context.period?.today?.() || "";
    for (const company of companies.list()) {
      if (!company || company.id === ROOT_COMPANY_ID || children.has(company.id) || company.deletedAt || company.deleted_at) continue;
      if (maintenance?.has(company.id)) continue; // 2.5.0 D2: bakımdaki şirket POS valörü için açılmaz (kip bitince sonraki turda)
      let due = null;
      try {
        due = withCompanyDb(company, temp => {
          try {
            return temp.prepare("SELECT 1 AS found FROM pos_items WHERE status = 'pending' AND value_date <= ? LIMIT 1").get(day) || null;
          } catch {
            return null;
          }
        });
      } catch (error) {
        log.warn?.(`POS valör denetimi: ${company.code} okunamadı (${error.message})`);
      }
      if (!due) continue;
      try {
        appFor(company);
        log.info?.(`POS valörü gelmiş kalem için şirket açıldı: ${company.code} · ${company.name}`);
      } catch (error) {
        log.warn?.(`POS valör denetimi: ${company.code} açılamadı (${error.message})`);
      }
    }
  }

  // 2.4.8 W2/W9: bütün şirketlerin WhatsApp bağlantı özeti (tünel kuralı, durum bildiriminin şirketi) — açık olmayanın dosyası kısa süreli salt okunur.
  function scanWhatsappCompanies() {
    if (hub) return;
    whatsapp.registry.scan(companies.list().filter(company => company && company.id !== companyId && !children.has(company.id)), company =>
      withCompanyDb(company, temp => {
        try {
          return temp.prepare("SELECT value FROM settings WHERE key = 'whatsapp.meta'").get()?.value ?? null;
        } catch {
          return null;
        }
      }) ?? null,
    );
  }
  if (!hub) scanWhatsappCompanies();
  function openWhatsappCompanies() {
    if (hub || closed) return;
    for (const id of whatsapp.ledger.liveCompanies()) {
      if (id === companyId || children.has(id) || maintenance?.has(id)) continue;
      const company = companies.get(id);
      if (!company) continue;
      try {
        appFor(company);
        log.info?.(`Süren WhatsApp gönderimi için şirket açıldı: ${company.code} · ${company.name}`);
      } catch (error) {
        log.warn?.(`WhatsApp gönderimi için ${company.code} açılamadı (${error.message})`);
      }
    }
  }

  // Otomatik yedek (v2.0.20): ortak katmanda tek zamanlayıcı BÜTÜN şirketleri yedekler — bu açılışta hiç açılmamış şirket
  // de (veri tabanı kısa süreliğine salt okunur açılır); her şirket kendi klasörüne.
  const stopBackups = config.scheduleBackups && !hub
    ? startBackupScheduler({ targets: () => backups.scheduleTargets(), intervalHours: config.backupIntervalHours, keep: config.backupKeep, startDelayMs: config.backupOnStartDelayMs, log })
    : () => {};
  undo.push(() => stopBackups());
  if (overrides.startLicenseTimers !== false && !hub) license.start();
  // Gün dönümünde tüm ekranlara "alerts.refresh" (olay tabanlı uyarı akışı, v2.0.2).
  const alertScheduler = createAlertScheduler({ events, log, clock: config.now });
  undo.push(() => alertScheduler.stop());
  if (overrides.alertScheduler !== false) alertScheduler.start();
  auth.purgeExpiredSessions();
  const sessionTimer = setInterval(() => {
    // İş P1: kilitli dosyada oturum temizliği o tur atlanır (saatte bir yeniden).
    if (!canWriteInBackground()) return;
    auth.purgeExpiredSessions();
    if (!hub) {
      try {
        context.mobileRemote.purge();
      } catch (error) {
        log.warn?.(`Uzak oturum temizliği yapılamadı: ${error.message}`);
      }
    }
  }, 3_600_000);
  sessionTimer.unref();
  undo.push(() => clearInterval(sessionTimer));
  // Sohbet arşivi: açılıştan kısa süre sonra ve 6 saatte bir (v2.0.2).
  let archiveRetried = false;
  let archiveRetry = null; // İş R1: yeniden deneme zamanlayıcısı tutulur, close() siler
  const archiveChat = () => {
    archiveRetry = null;
    if (closed) return; // İş R1: kapanmış örnekte arşiv çalışmaz
    // İş P1: kilitli dosyada arşiv o tur atlanır (6 saatte bir yeniden; açılış turu kilitteyse 30 sn sonra bir kez daha denenir).
    if (!canWriteInBackground()) {
      if (!archiveRetried) {
        archiveRetried = true;
        archiveRetry = setTimeout(archiveChat, writeLock.backoffMs);
        archiveRetry.unref?.();
      }
      return;
    }
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
  undo.push(() => {
    clearTimeout(archiveStart);
    clearInterval(archiveTimer);
    clearTimeout(archiveRetry);
  });

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
  // 2.4.8 W2: WhatsApp Business API gönderimleri (wa_batches, wa_jobs) mesaj geçmişi gibi hareketle silinir; süren toplu gönderim makine defterinde de durdurulur
  // (sıfırlanan şirkette eski iş dirilmez; 24 saat sayacı ve aylık sayım defterde kalır).
  const MOVEMENT_TABLES = ["cash_entries", "payments", "account_entries", "stock_moves", "invoice_offsets", "invoice_repeats", "invoice_lines", "invoices", "einvoice_inbox", "plan_entries", "plan_items", "plan_imports", "plans", "cheque_events", "cheques", "integrity_log", "message_sends", "wa_job_pdfs", "wa_jobs", "wa_batches", "trash", "audit_events",
    "fin_events", "bank_lines", "pos_sales", "pos_items", "cheque_collections", "bank_statements", "bank_statement_lines", "bank_matches", "bank_plans", "bank_jobs", "request_keys",
    // 2.5.0 Ç3: "ledger_snapshots" (2.1.0'dan beri bu listedeydi) çıkarıldı — donmuş defter silme tetikleyicisi bu döngüyü düşürürdü; clearSnapshots siler (aşağıda).
    // 2.3.0 İz 1 (plan §3.11b/4 "Şirket Verisini Sıfırla listeleri"): şüpheli alacak kayıtları ve karşılıkları hareketle silinir.
    "doubtful_receivables", "doubtful_provisions"];
  const CARD_TABLES = ["accounts", "stock_items", "plan_groups", "dataset_rows", "dataset_imports", "records", "overrides", "deleted_records", "notes", "phones", "liens", "tasks", "case_notes", "case_documents", "source_snapshots", "free_cells", "free_rows", "free_history", "free_sheets", "messages",
    "bank_accounts", "pos_terminals", "pos_rates",
    // 2.4.4 Personel Özlük: çalışan kartları kart verisidir — "Tümünü Sıfırla" siler, "Tüm Hareketleri Sil" dokunmaz.
    "staff_members",
    // 2.4.6 Maliyet Hesap Kartı: kart verisi — "Tümünü Sıfırla" siler (sektör hâlâ Duşakabin Üretimi ise sonraki açılışta boş şablon yeniden kurulur),
    // "Tüm Hareketleri Sil" dokunmaz.
    "maliyet_sekmeler", "maliyet_kartlar", "maliyet_satirlar", "maliyet_adimlar", "maliyet_hucreler", "maliyet_basliklar"];
  // v2.0.21 (rastgele sıra testi bulgusu): 001'in veri tabanı aynı zamanda ortak katmandır; kullanıcıların şirket seçimi ve
  // ŞİRKET YETKİLERİ (company.*) ile parola kurtarma anahtarı (auth.*) "Tümünü Sıfırla"da silinmez (geri yüklemedeki ortak
  // katman listesiyle aynı: company-backups.mjs COMMON_SETTINGS).
  const KEEP_SETTINGS = ["office.", "meta.", "sectors.", "client.", "invoice", "einvoice", "edoc", "whatsapp", "backup", "cloud", "drive", "license.", "update", "company.", "auth.", "bank.settings",
    // 2.5.0 Ç4: Defter Türü (accounting.bookType) şirketin defter düzeni ayarıdır, hareket değil — korunur. "ledger." BİLEREK yok: dönem kilidi sıfırlamada kalkar.
    "accounting.",
    // 2.5.0 D2: devir işaretleri (devir.years: bu dosyanın hangi yıllarının arşive ayrıldığı) — arşivler sıfırlamadan sonra da kayıtlı; işaret silinirse
    // "Yedekten Geri Yükle" denetimi ve diskten tanıma (lib/devir/archives.mjs) çalışma dosyasını devirsiz sanardı.
    "devir."];
  function resetData(user, { mode = "movements", resetNumbers = true } = {}) {
    if (archiveGate) throw new HttpError(403, archiveGate.message, { code: ARCHIVE_READ_ONLY_CODE, archive: archiveGate });
    if (schemaGate) throw new HttpError(409, schemaGate.message, { code: schemaGate.code, schemaGate });
    if (inMaintenance()) throw new HttpError(503, maintenanceMessage(maintenanceOf().get(companyId)), { code: MAINTENANCE_CODE, retryAfter: 30 });
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
    context.ledger?.snapshots?.cancel?.();
    store.raw("company.reset", () => store.tx(() => {
      const tables = mode === "all" ? [...MOVEMENT_TABLES, ...CARD_TABLES] : MOVEMENT_TABLES;
      for (const table of tables) {
        if (!has(table)) continue;
        counts[table] = store.get(`SELECT COUNT(*) AS n FROM ${table}`).n;
        store.run(`DELETE FROM ${table}`);
      }
      // 2.5.0 Ç2 (plan §9 madde 5): saklanan fiş defteri iki kipte de silinir — tetikleyiciler (değiştirilemez / silinemez) aynı işlemde kaldırılıp yeniden kurulur
      // (lib/ledger-vouchers.mjs clearVouchers). Fiş numarası o yılın en büyük sırasından sürdüğü için sıfırlamadan sonra 1'den başlar.
      Object.assign(counts, clearVouchers(store));
      // 2.5.0 Ç3: donmuş defter (satırlar + koşular) iki kipte de silinir; tetikleyiciler aynı işlemde kaldırılıp yeniden kurulur (lib/ledger-snapshots.mjs clearSnapshots).
      // Kilit zaten sıfırlamada kalkar (aşağıda); süren dondurma işi işlemden önce durduruldu.
      Object.assign(counts, clearSnapshots(store));
      // Hesap kartları kalırken açılışları silindi: "Bakiye Doğrulandı" kalkar, kartta "Açılış Bakiyesi Gir" açılır (§5.6).
      if (mode !== "all" && has("bank_accounts")) store.run("UPDATE bank_accounts SET balance_confirmed = 0 WHERE balance_confirmed <> 0");
      if (resetNumbers) store.run("DELETE FROM settings WHERE key = 'plans.receiptSeq'");
      // 2.4.2 (gözden geçirme): faturalar silinince test serisinin (TEF/TEA/TES) başlangıcı da silinir — kalsaydı sıradaki numara EDM'nin ortak test
      // hesabına zaten gönderilmiş numaraya döner (11048); yeni rastgele başlangıç alınır. Firmanın kendi serisinin "Sıradaki No"su korunur.
      if (has("invoices")) {
        // 2.4.4: seriden ayrılmış (bırakılıp e-Belge olarak gönderilmiş) kâğıt numaralarının kaydı faturalardan türer; faturalar silinince MAX(seq) gibi o da
        // silinir (routes/invoices.mjs FLOOR_KEY).
        store.run("DELETE FROM settings WHERE key = 'invoice.numberFloor'");
        let invoice = null;
        try {
          invoice = JSON.parse(store.setting("invoice.settings", "") || "null");
        } catch {
          invoice = null;
        }
        if (invoice?.start && typeof invoice.start === "object") {
          const kept = Object.fromEntries(Object.entries(invoice.start).filter(([key]) => !/^TE[FAS]\d{4}$/.test(key)));
          if (Object.keys(kept).length !== Object.keys(invoice.start).length) store.setSetting("invoice.settings", JSON.stringify({ ...invoice, start: kept }));
        }
      }
      if (unlocked) {
        store.run("DELETE FROM settings WHERE key = ?", LOCK_KEY);
        audit(user, "ledger.period.unlocked", "period", { previous: unlocked, lockedUntil: "", reason: "company.reset", mode });
      }
      if (mode === "all") {
        for (const row of store.all("SELECT key FROM settings")) {
          if (!KEEP_SETTINGS.some(prefix => row.key.startsWith(prefix))) store.run("DELETE FROM settings WHERE key = ?", row.key);
        }
      }
      // Eski satır işareti yenilenir: silinen para tablolarında rowid baştan başlar (v2.1.0; lib/bank/repair.mjs).
      if (has("fin_events")) markLegacyRows(store, { now: config.now });
      audit(user, "company.reset", companyId, { mode, resetNumbers, backup: backup?.name || "", counts, unlocked });
    }));
    try {
      whatsapp.ledger.stopCompany(companyId, "reset", new Date(config.now()).toISOString());
    } catch (error) {
      log.warn?.(`WhatsApp gönderimleri sıfırlamada durdurulamadı (${error.message}).`);
    }
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
    schemaGate,
    // 2.5.0 D2: arşiv örneğinin kapısı (null: canlı şirket), bakım kipi (ortak katman), arşiv açma / kapama ve örneğin bağlantı koruması.
    archive: archiveGate,
    maintenance: maintenanceOf(),
    openArchive: (company, year) => openArchive(company, year),
    closeArchives: (id, year) => closeArchives(id, year),
    archiveView: company => archiveView(company),
    openArchiveIds: () => (hub ? [] : [...archiveChildren.keys()]),
    setMaintenanceGuard,
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
    runDueBackups: () => (hub ? [] : runDueBackups({ targets: () => backups.scheduleTargets(), intervalHours: config.backupIntervalHours, log })),
    stagedRestore,
    openCompanyIds: () => (hub ? [] : [...children.keys()]),
    // Açık şirket örneği (açmaz; testler ve araçlar için — 2.5.0 BS-7 kapı testleri arka plan denetimini okur).
    openCompany: id => (hub ? null : children.get(id) || null),
    // Servis yöneticisi altında server.mjs bağlar: 001 geri yüklemesi için uygulama kendini düzgün kapatır, servis
    // yöneticisi yeniden açar (açılışta geri yükleme uygulanır).
    onRestartRequest(handler) {
      restartHandler = typeof handler === "function" ? handler : null;
    },
    onInfoChange(listener) {
      infoListeners.add(listener);
      return () => infoListeners.delete(listener);
    },
    mobileRemote: context.mobileRemote,
    mobileSync: context.mobileSync, // 2.4.7 M3
    whatsapp, // 2.4.8 W2: defter, işçi, bağlantı kaydı (testler ve araçlar)
    // Uzaktan erişim dinleyicisi (2.4.7 M2): yalnız yerel döngü adresinde (tünel istemcisi aynı bilgisayardan bağlanır); ofis ağına açılmaz.
    listenRemote(port = 0, host = "127.0.0.1") {
      if (!remoteServer) return Promise.reject(new Error("Uzaktan erişim dinleyicisi yalnız ortak katmanda açılır."));
      if (!["127.0.0.1", "::1"].includes(host)) return Promise.reject(new Error("Uzaktan erişim dinleyicisi yalnız 127.0.0.1 / ::1 adresinde açılır."));
      return new Promise((resolve, reject) => {
        remoteServer.once("error", reject);
        remoteServer.listen(port, host, () => {
          remoteServer.off("error", reject);
          resolve(remoteServer.address());
        });
      });
    },
    listen(port = config.port, host = config.host) {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          server.off("error", reject);
          if (!hub) context.mobileSync.start(); // 2.4.7 M3: özet zamanlayıcısı + kapıcıya açılış kaydı
          // 2.4.8 W2: WhatsApp işçisi; süren toplu gönderimi olan (defterde canlı) şirketler açılır — kendi kuyruklarını işçiye kaydederler.
          if (!hub) {
            whatsapp.scheduler.start();
            setImmediate(openWhatsappCompanies);
          }
          if (!hub && overrides.posQueue !== false) {
            posQueue.start();
            setImmediate(posDueCompanies);
            posHubTimer ||= setInterval(posDueCompanies, 24 * 3_600_000);
            posHubTimer.unref?.();
          }
          resolve(server.address());
        });
      });
    },
    async close({ reason = "shutdown" } = {}) {
      if (closed) return;
      closed = true;
      if (!hub) await context.mobileSync.flush().catch(error => log.warn?.(`Mobil özet kapanışta yüklenemedi: ${error?.message || error}`)); // 2.4.7 M3: son hâl
      await context.tunnel?.stop();
      // 2.4.8 W2: bu şirketin kuyruğu işçiden çıkar; ortak katman işçiyi (süren isteğin bitmesini bekleyerek) ve defteri kapatır.
      // 2.5.0 D2: arşiv örneği kaydolmadı; aynı şirket kimliğini taşıdığı için canlı şirketin kuyruğunu işçiden ÇIKARMAZ.
      if (!archiveGate) whatsapp.scheduler.unregister(companyId);
      maintenance?.stop?.();
      if (!hub) await whatsapp.scheduler.stop();
      posQueue.stop();
      clearInterval(posHubTimer);
      stopBackups();
      clearInterval(sessionTimer);
      clearInterval(context.integrity?.scanTimer);
      clearTimeout(archiveStart);
      clearInterval(archiveTimer);
      clearTimeout(archiveRetry);
      alertScheduler.stop();
      // Oturum sınırlayıcı ve lisans ortak katmanın: şirket örneği kapanırken (geri yükleme, silme) durdurulmaz
      // (v2.0.17'de şirket silinince ilk şirketin lisans denetimi de duruyordu).
      if (!hub) auth.limiter.stop();
      dataset.stop();
      documents.stop();
      if (!hub) license.stop();
      unbridgeHubEvents?.();
      events.stop();
      await new Promise(resolve => {
        server.close(() => resolve());
        server.closeAllConnections?.();
      });
      if (remoteServer?.listening) {
        await new Promise(resolve => {
          remoteServer.close(() => resolve());
          remoteServer.closeAllConnections?.();
        });
      }
      await analysisRunner.close();
      await reportRunner?.close({ reason });
      // 2.5.0 Ç3: süren dondurma işi durur, iş parçacığı sonlanır (dosya tutamağı bırakılır; Windows'ta geri yükleme / silme dosya takası).
      await context.ledger?.snapshots?.close?.();
      for (const child of children.values()) await child.close();
      for (const child of archiveChildren.values()) await child.close();
      archiveChildren.clear();
      if (!hub) usageLedger.close();
      if (!hub) whatsapp.ledger.close();
      db.close();
    },
  };
  // 2.4.7 M4: canlı bağlantı (tünel) — yalnız ortak katmanda; M3 kapıcı adresi (config.mobileKapiUrl) varken ya da testte `tunnel` seçeneğiyle; lib/tunnel/attach.mjs.
  // 2.4.8 W9 (plan §6 W9, S1 A): tünel WhatsApp bağlıyken de açık (durum bildirimi kapıcıdan tünel üzerinden gelir) — "Ne zaman açık" kuralının genişlemesi.
  context.tunnel = hub ? null : attachTunnel({ option: overrides.tunnel, config, store, license, mobileRemote: context.mobileRemote, mobileSync: () => context.mobileSync, extraDemand: () => whatsapp.registry.anyConfigured(), listenRemote: () => (remoteServer.listening ? Promise.resolve(remoteServer.address()) : app.listenRemote(0, "127.0.0.1")), forbiddenPorts: () => [config.port, config.publicPort, server.address()?.port].filter(Number.isInteger), log });
  undo.push(() => context.tunnel?.stop());
  openFault("after-app");
  return app;
}
