// Kullanıcı gözüyle gezinti (2.4.4 madde 30c): programı ÜRETİM bayraklarıyla (server/server.mjs: edocEnabled, edocLive, esmmEnabled) açar,
// sahte EDM'yi (test/einvoice-mock.mjs; e-Fatura + e-SMM) ve CDP'li tek bir Chromium'u başlatır; adim.mjs her adımda bu tarayıcıya bağlanır.
// Kullanım: node sunucu.mjs <depo> <veri-klasörü>   (durum <veri-klasörü>/durum.json; durdurmak için kendi pid'i)
// Dış ağa çıkılmaz (fetch yalnız 127.0.0.1); lisans servisi ölü adres (ders 30); gerçek EDM kimliği KULLANILMAZ.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [repo, root] = process.argv.slice(2).map(p => path.resolve(p));
if (!repo || !root) throw new Error("kullanım: node sunucu.mjs <depo> <veri-klasörü>");
process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
mkdirSync(root, { recursive: true });
const imp = rel => import(pathToFileURL(path.join(repo, rel)).href);
const { createApp } = await imp("server/app.mjs");
const { startMockEdm } = await imp("test/einvoice-mock.mjs");
const { chromium } = await import(pathToFileURL(path.join(repo, "node_modules", "playwright", "index.mjs")).href);

const PASS = "Gezinti-Yonetici-2026!";
const edm = await startMockEdm();
const fetchImpl = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (gezinti): ${url}`);
  return globalThis.fetch(input, init);
};
const app = createApp({
  dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, fetchImpl,
  edocEnabled: true, edocLive: true, esmmEnabled: true,
  env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_LICENSE_URL: "http://127.0.0.1:9" },
  license: { enforce: false, machineId: "b1c2d3e4f5a60718293a4b5c6d7e8f90" }, startLicenseTimers: false,
});
const { port } = await app.listen(5199, "127.0.0.1");
// Kalıcı bağlam = tarayıcının varsayılan bağlamı: adim.mjs CDP ile bağlanınca aynı sekmeyi (çerez, oturum) görür.
const context = await chromium.launchPersistentContext(path.join(root, "profil"), { headless: true, args: ["--remote-debugging-port=9339", "--lang=tr-TR"], viewport: { width: 1440, height: 900 }, locale: "tr-TR", timezoneId: "Europe/Istanbul", acceptDownloads: true });
const page = context.pages()[0] || await context.newPage();
await page.goto(`http://127.0.0.1:${port}/`);
const state = { pid: process.pid, base: `http://127.0.0.1:${port}`, cdp: "http://127.0.0.1:9339", edm: edm.url, adminPass: PASS, edmUser: "edmkullanici", edmPass: "Gizli-Parola-1", root };
writeFileSync(path.join(root, "durum.json"), JSON.stringify(state, null, 2));
console.log(JSON.stringify(state));
const stop = async () => { await context.close().catch(() => null); await app.close().catch(() => null); await edm.close?.().catch?.(() => null); process.exit(0); };
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
setInterval(() => null, 1 << 30);
