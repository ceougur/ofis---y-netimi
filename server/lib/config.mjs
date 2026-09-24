// DestekOfis — merkezi sunucu yapılandırması.
// Tüm ayarlar ortam değişkenlerinden okunur; testler için overrides verilebilir.
import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

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
  return Object.freeze({
    root: ROOT,
    productName: PRODUCT_NAME,
    version: VERSION,
    dataDir,
    backupDir,
    publicDir: path.resolve(overrides.publicDir ?? path.join(ROOT, "client")),
    dbPath: path.join(dataDir, "hukuk-ofisi.sqlite"),
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
    fetchImpl: overrides.fetchImpl || ((...args) => globalThis.fetch(...args)),
    scheduleBackups: overrides.scheduleBackups ?? true,
  });
}
