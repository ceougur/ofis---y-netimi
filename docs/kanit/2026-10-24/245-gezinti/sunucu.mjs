// 2.4.5 kullanıcı gözüyle gezinti (madde 9): programı ÜRÜN varsayılanıyla (server/server.mjs bayrakları; legacyCasePayments / legacyTableTransfer KAPALI)
// ve SAHTE AKAN SAATLE (config.now, 21.10.2026 10:00 TR'den akar; tarayıcı saati de aynı) açar, sahte EDM'yi ve CDP'li tek Chromium'u (1366×768) başlatır.
// Örnek: docs/kanit/2026-10-22/244-gezinti/sunucu.mjs. Kullanım: flock <kilit> node sunucu.mjs <depo> <veri-klasörü>
// Dış ağa çıkılmaz (fetch yalnız 127.0.0.1); lisans servisi ölü adres (ders 30).
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [repo, root] = process.argv.slice(2).map(p => path.resolve(p));
if (!repo || !root) throw new Error("kullanım: node sunucu.mjs <depo> <veri-klasörü>");
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
mkdirSync(root, { recursive: true });
const imp = rel => import(pathToFileURL(path.join(repo, rel)).href);
const { createApp } = await imp("server/app.mjs");
const { createClock } = await imp("server/lib/clock.mjs");
const { startMockEdm } = await imp("test/einvoice-mock.mjs");
const { chromium } = await import(pathToFileURL(path.join(repo, "node_modules", "playwright", "index.mjs")).href);

const TODAY = process.env.GEZINTI_GUN || "2026-10-21";
const clock = createClock({ time: `${TODAY}T10:00:00+03:00` });
const PASS = "Gezinti-Yonetici-2026!";
const edm = await startMockEdm();
const fetchImpl = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (gezinti): ${url}`);
  return globalThis.fetch(input, init);
};
const app = createApp({
  dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, fetchImpl, now: clock,
  edocEnabled: true, edocLive: true, esmmEnabled: true,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
  license: { enforce: false, machineId: "b1c2d3e4f5a60718293a4b5c6d7e8f91" }, startLicenseTimers: false,
});
const { port } = await app.listen(5245, "127.0.0.1");
const context = await chromium.launchPersistentContext(path.join(root, "profil"), { headless: true, args: ["--remote-debugging-port=9345", "--lang=tr-TR"], viewport: { width: 1366, height: 768 }, locale: "tr-TR", timezoneId: "Europe/Istanbul", acceptDownloads: true, downloadsPath: path.join(root, "indirilen") });
await context.clock.install({ time: clock.ms() });
const page = context.pages()[0] || await context.newPage();
await page.goto(`http://127.0.0.1:${port}/`);
const state = { pid: process.pid, base: `http://127.0.0.1:${port}`, cdp: "http://127.0.0.1:9345", edm: edm.url, adminPass: PASS, today: TODAY, root, legacyCasePayments: app.config.legacyCasePayments, legacyTableTransfer: app.config.legacyTableTransfer, dbPath: app.config.dbPath };
writeFileSync(path.join(root, "durum.json"), JSON.stringify(state, null, 2));
console.log(JSON.stringify(state));
const stop = async () => { await context.close().catch(() => null); await app.close().catch(() => null); await edm.close?.().catch?.(() => null); process.exit(0); };
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
setInterval(() => null, 1 << 30);
