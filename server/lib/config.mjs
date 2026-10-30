// DestekOfis — merkezi sunucu yapılandırması.
// Tüm ayarlar ortam değişkenlerinden okunur; testler için overrides verilebilir.
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClock } from "./clock.mjs";
import { resolveDbPath } from "./db-path.mjs";
import { DEFAULT_LICENSE_SERVICES } from "./license.mjs";

// 2.4.7 M3: kapıcı (program uçları) ve ofisin telefon adresi ({ofis} = ofis kimliği; Cloudflare evrensel sertifikası *.destekofis.net'i kapsar).
export const DEFAULT_KAPI_URL = "https://kapi.destekofis.net";
export const DEFAULT_OFFICE_URL = "https://{ofis}.destekofis.net";
import { cachedResolver, createProxyFetch, describeNetwork } from "./net-proxy.mjs";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const DEFAULT_ADMIN_PASSWORD = "Ofis2026!";
export const PRODUCT_NAME = "DestekOfis";

const pkg = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
export const VERSION = pkg.version;

const number = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export function loadConfig(overrides = {}) {
  const env = { ...process.env, ...(overrides.env || {}) };
  const dataDir = path.resolve(overrides.dataDir ?? env.HUKUK_DATA_DIR ?? path.join(ROOT, "data"));
  const backupDir = path.resolve(overrides.backupDir ?? env.HUKUK_BACKUP_DIR ?? path.join(ROOT, "backups"));
  // Ağ (vekil sunucu) ayarı dosyası: servis yöneticisi altında kurulumun config klasöründe (güncelleyiciyle ortak), yoksa veri klasöründe.
  const networkFile = path.resolve(overrides.networkFile ?? env.HUKUK_NETWORK_FILE ?? path.join(dataDir, "ag-ayari.json"));
  return Object.freeze({
    root: ROOT,
    productName: PRODUCT_NAME,
    version: VERSION,
    dataDir,
    backupDir,
    publicDir: path.resolve(overrides.publicDir ?? path.join(ROOT, "client")),
    dbPath: resolveDbPath(dataDir),
    port: number(overrides.port ?? env.PORT, 5123),
    // Servis yöneticisi altında uygulama iç bir portta çalışır; kullanıcıların bağlandığı port budur.
    publicPort: number(overrides.publicPort ?? env.HUKUK_PUBLIC_PORT, number(overrides.port ?? env.PORT, 5123)),
    host: overrides.host ?? env.HOST ?? "0.0.0.0",
    adminUsername: env.HUKUK_ADMIN_USERNAME || "admin",
    adminPassword: env.HUKUK_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD,
    sessionDays: number(env.HUKUK_SESSION_DAYS, 7),
    backupIntervalHours: number(env.HUKUK_BACKUP_INTERVAL_HOURS, 6),
    backupKeep: Math.max(3, number(env.HUKUK_BACKUP_KEEP, 30)),
    backupOnStartDelayMs: number(overrides.backupOnStartDelayMs ?? env.HUKUK_BACKUP_START_DELAY_MS, 60_000),
    trustProxy: (overrides.trustProxy ?? env.HUKUK_TRUST_PROXY) === "1" || overrides.trustProxy === true,
    // Servis yöneticisi (supervisor.mjs) altında mı çalışıyor? Güncelleme işlemleri IPC ile ona iletilir.
    supervised: (overrides.supervised ?? env.HUKUK_SUPERVISED) === "1" || overrides.supervised === true,
    logLevel: overrides.logLevel ?? env.HUKUK_LOG_LEVEL ?? "info",
    sheetsCacheMs: number(env.HUKUK_SHEETS_CACHE_MS, 45_000),
    // Canlı olay kanalında boşta bağlantıyı canlı tutan ve kapanmış oturumları düşüren tur aralığı.
    eventsPingMs: number(overrides.eventsPingMs ?? env.HUKUK_EVENTS_PING_MS, 25_000),
    // Canlı bağlantı ömrü: süre dolunca akış kapanır, tarayıcı kaldığı yerden devam eder (bkz. events.mjs).
    eventsMaxAgeMs: number(overrides.eventsMaxAgeMs ?? env.HUKUK_EVENTS_MAX_AGE_MS, 5 * 60_000),
    // Bağlı Google Sheets'in zamanlanmış eşitlemesi (sıklık yönetim ayarlarından; denetim dakikada bir).
    datasetAutoSync: (overrides.datasetAutoSync ?? env.HUKUK_DATASET_AUTOSYNC ?? "1") !== "0" && overrides.datasetAutoSync !== false,
    datasetTickMs: number(overrides.datasetTickMs ?? env.HUKUK_DATASET_TICK_MS, 60_000),
    // Lisans servisi adresleri (virgülle birden çok). Yanıtlar imzalı olduğundan adres değişikliği güveni zayıflatmaz.
    licenseServices: (overrides.licenseServices ?? env.HUKUK_LICENSE_URL ?? DEFAULT_LICENSE_SERVICES.join(",")).toString(),
    networkFile,
    // Ekranda gösterilecek etkin vekil ayarı (fetchImpl ile aynı ortam değişkenleri; kimlik bilgisi yok).
    describeNetwork: () => describeNetwork({ file: networkFile, env }),
    // Yönetim → Ağ Bağlantısı → Bağlantıyı Dene adresi (güncelleme sunucusu); testler yerel sahte sunucu verir.
    networkTestUrl: overrides.networkTestUrl || "https://api.github.com/",
    // Dışarı çıkan bütün istekler (lisans, E-Tablolar, e-Belge entegratörü) vekil sunucu ayarına uyar (lib/net-proxy.mjs; 16.10.2026).
    // outboundTls yalnız testlerden (kendinden imzalı sahte sunucu sertifikası); ortam değişkeniyle verilmez, üretimde sistem sertifikaları.
    fetchImpl: overrides.fetchImpl || createProxyFetch({ resolve: cachedResolver({ file: networkFile, env }), tlsOptions: overrides.outboundTls || {} }),
    // e-Belge (e-Fatura / e-Arşiv / entegratör) bağlantısı — program sahibinin kararıyla KAPALI (01.10.2026: "sana entegre
    // et diyene kadar"). Kapalıyken fatura modülü tam çalışır; belge resmî hükmü olmayan müşteri fişi olarak basılır,
    // e-Belge seçenekleri ekranda görünmez. Testler ve üretim girişi (server/server.mjs, 16.10.2026'dan beri açık) overrides ile açar;
    // ortam değişkeniyle açılmaz.
    edocEnabled: overrides.edocEnabled === true,
    // Entegratörde CANLI ortam (kullanıcı kararı 16.10.2026): "entegre et" kararına dek kapalı; açıkken bile yalnız bu bayrakla seçilir.
    // Ortam değişkeniyle açılmaz (yanlışlıkla canlıya belge gitmesin); testler ve kabul sonrası kurulum ayarı verir.
    edocLive: overrides.edocLive === true,
    // Dar kontrol 2.4.3 (Y1): "Tümünü Gönder" bir istekte en çok 20 belgeyi ya da bu süre bütçesini (ms) işler, kalan sayısını döner; istemci
    // kalan bitene dek yineler (tarayıcının istek zaman aşımına düşmez). Testler kısa verir; ortam değişkeniyle verilmez.
    // İptal öncesi "işleniyor" durumunun yeniden sorulma aralıkları (ms; 2.4.3 H7). Yalnız testler verir (üretimde 1 sn + 2 sn); dar kontrol 2.4.3
    // (ek 5): önceden bu alan yapılandırmaya hiç geçmiyordu, testlerin verdiği kısa aralık yok sayılıyordu.
    edocStatusPollMs: Array.isArray(overrides.edocStatusPollMs) ? overrides.edocStatusPollMs.map(Number).filter(value => Number.isFinite(value) && value >= 0) : undefined,
    edocSendBudgetMs: Number.isFinite(overrides.edocSendBudgetMs) && overrides.edocSendBudgetMs > 0 ? overrides.edocSendBudgetMs : 10_000,
    // e-SMM gönderimi (2.4.1, kullanıcı kararı 16.10.2026: "e-SMM gizli"): EDM'de e-SMM ayrı servis/yetki; kapalıyken işaret gizli, sunucu reddeder, eski
    // "esmm: true" kaydında makbuz kâğıt kalır (test/esmm-gizli-241.test.mjs). 2.4.4'te (iş listesi 24) üretim girişi (server/server.mjs) AÇAR; testler
    // vermedikçe kapalı. Ortam değişkeniyle açılmaz.
    esmmEnabled: overrides.esmmEnabled === true,
    // 2.4.5 madde 1–2 (ürün sahibi 23.10.2026: "Excel'den / Sheets'ten gelen verileri programın analizine bırakarak muhasebesel işleri riske atamayız"):
    // tablodaki kayıttan yeni kayıt tahsilatı (POST /cases/:key/payments) ve düzeltmesi (PUT /payments/:id) ile Tablodan Aktar (POST /plans/from-table)
    // programda KAPALI → 410. Kod sonraki sürümde silinir; o güne dek yalnız testler ve mutabakat/güvenilirlik üreticileri (test/helpers.mjs,
    // test/guvenilirlik/surumler.mjs) eski veriyi kendi API'sinden üretebilsin diye açar. Üretim girişi (server/server.mjs) VERMEZ; ortam değişkeniyle açılmaz.
    legacyCasePayments: overrides.legacyCasePayments === true,
    legacyTableTransfer: overrides.legacyTableTransfer === true,
    // Test serisi (TEF/TEA/TES) başlangıcı (2.4.2): üretimde boş → firmaya özgü rastgele büyük numara (EDM test hesabı ortak; 1'den başlayan numara
    // başka firmanınkiyle çakışır). Testler sabit başlangıç verir (test/helpers.mjs).
    testSeriesStart: typeof overrides.testSeriesStart === "function" ? overrides.testSeriesStart : null,
    // Döviz banka hesabı (v2.1.0 GG2): kur, değerleme ve döviz fişleriyle birlikte sonraki sürümde; o zamana kadar yalnız testler açar.
    fxEnabled: overrides.fxEnabled === true,
    // Bu sürümde olmayan banka özelliklerinin gizli ayarları (POS, Ekstre, Döviz, Elle Banka Fişi; lib/bank/settings.mjs NOT_YET): üretimde
    // değiştirilemez ve okunurken varsayılandır; yalnız testler (doğrulama kurallarını sınayan) açar. Ortam değişkeni yok.
    bankLater: overrides.bankLater === true,
    // Eski sürüm gibi hesapsız havale (v2.1.0 Aşama 5–6): yalnız testler açar. Aşama 2–4 testleri "eski sürümden gelen hesabı atanmamış
    // hareketi" banka hesabı tanımlıyken modül uçlarından yazar; açıkken cari/Kasa formunda hesap verilmezse satır hesapsız yazılır.
    bankPickLegacy: overrides.bankPickLegacy === true,
    // K1 öncesi fatura kapaması (v2.1.0): yalnız testler verir (test/guvenilirlik/kapama-k1-oncesi.mjs, dondurulmuş kopya). Altın test ve göç
    // zinciri aynı veride 2.0.26'nın gerçek koduyla birebir karşılaştırır; K1 iade kapanışını bilerek değiştirdiği için o karşılaştırmalar bu
    // kuralla koşar (göçün ve tek kaynağın etkisi ölçülür), K1'in etkisi ayrıca güncel kuralla denetlenir. Üretimde yok (ortam değişkeni yok).
    legacyClosing: typeof overrides.legacyClosing === "function" ? overrides.legacyClosing : null,
    // 2.4.5 madde 4 (uyarı kapısı): tablonun tutarlı kalemleri (ödeme günü, aidat, ödeme sözü) zile, Tahsilat Takvimi'ne, Vade Takip'e ve Nakit Akış
    // Projeksiyonu'na girmez. Açıkken 2.4.4 davranışı (tablo takvim motorunu bu uçlardan sınayan eski testler ve eski sürümle karşılaştıran altın testler).
    // Yalnız programdan (testler); üretimde ve ortam değişkeninde yok.
    legacyTableDues: overrides.legacyTableDues === true,
    scheduleBackups: overrides.scheduleBackups ?? true,
    // Sunucunun iş saati (v2.1.0; lib/clock.mjs): "bugün" ve iş kayıtlarının zaman damgaları tek kaynaktan. Üretimde gerçek
    // saat; sahte saat yalnız programdan (testler, kabul senaryoları) verilir — ortam değişkeni yok. Şirketler aynı saati paylaşır.
    now: createClock(overrides.now),
    // 2.4.7 M2: uzaktan erişimin güvenlik süreleri (karekod 5 dk, uzak oturum boşta 15 dk / en çok 12 saat, uzak giriş kilidi 15 dk; lib/mobile-remote.mjs)
    // bu saatle ölçülür. Altyapı saati: üretimde HER ZAMAN gerçek saat (iş saati sahte olsa da); yalnız programdan (kâhin sürücüsü, testler) verilir.
    remoteNow: createClock(overrides.remoteNow),
    // 2.4.7 M3 (docs/mobil/M3-TASARIM.md): şifreli özetin yüklendiği kapıcı (Cloudflare Worker) ve ofisin telefon adresi kalıbı. YALNIZ üretim girişi
    // (server/server.mjs mobileKapi: true) açar; lisans servisi ortam değişkeniyle değiştirilmişse (testler: HUKUK_LICENSE_URL ölü adres) kapıcı da
    // ancak HUKUK_KAPI_URL açıkça verilirse açılır (ders 30: test gerçek kapıcıya ulaşmaz). Programın içinden (testler) mobileKapiUrl ile.
    mobileKapiUrl: String(
      overrides.mobileKapiUrl ??
        (overrides.mobileKapi === true ? env.HUKUK_KAPI_URL ?? (overrides.licenseServices === undefined && env.HUKUK_LICENSE_URL === undefined ? DEFAULT_KAPI_URL : "") : ""),
    ).replace(/\/+$/, ""),
    mobileOfficeUrl: String(overrides.mobileOfficeUrl ?? env.HUKUK_KAPI_OFIS_URL ?? DEFAULT_OFFICE_URL),
    mobileKapiFetch: typeof overrides.mobileKapiFetch === "function" ? overrides.mobileKapiFetch : null,
    mobileSyncAuto: overrides.mobileSyncAuto !== false,
    // Para yazımı denetimi (K6; lib/bank/post.mjs) test kipi: ihlal hata verir ve işlemi geri alır. Üretimde (varsayılan) iş durmaz,
    // sunucu günlüğüne ve meta.bank.integrity'ye yazılır. Yalnız programdan (testler) açılır.
    moneyStrict: overrides.moneyStrict === true,
    // Mutabakat kapısının eşdeğerlik denetimi (v2.1.0, §3.11; lib/integrity-scope.mjs): testlerde tam kapı HER işlemde çalışır ve
    // dokunulan varlıklar yolu "temiz" deyip tam kapı reddederse işlem 500 "gate-equivalence" ile kırılır. Üretimde kapalı (yalnız
    // programdan açılır; ortam değişkeni yok).
    gateVerify: overrides.gateVerify === true,
    // Kapı süzgecinde "çok hareketli cari" eşiği (gözden geçirme B8): yevmiyeye giren satırı bundan çok olan carinin bakiyesi SQL
    // toplamıyla (ledger.partyTotals) denetlenir; az olanınki yevmiye maddeleri kurularak (2.0.26 yolu). Testler 0 vererek her cariyi
    // SQL toplamıyla denetletebilir (iki yolun eşdeğerliği).
    scopePartyRows: Number.isSafeInteger(overrides.scopePartyRows) && overrides.scopePartyRows >= 0 ? overrides.scopePartyRows : 2000,
    // Büyük banka raporları ayrı iş parçacığında (11.10.2026 hız düzeltmesi; lib/report-runner.mjs): üretimde açık. Testler yardımcısı
    // (test/helpers.mjs) hızı için kapatır; iş parçacığı yolunu sınayan testler açar. Çıktı iki yolda aynıdır (test/banka-210-hiz-esdegerlik).
    reportWorker: overrides.reportWorker !== false,
    // İş parçacığının dosyası: yalnız testler değiştirir (programdan; ortam değişkeni yok) — kapanış/zaman aşımı/hata yollarını gerçek
    // sunucuda zorla sınamak için (test/fixtures/rapor-is-parcacigi-sinama.mjs). Üretimde lib/report-worker.mjs.
    reportWorkerEntry: overrides.reportWorkerEntry instanceof URL ? overrides.reportWorkerEntry : null,
  });
}
