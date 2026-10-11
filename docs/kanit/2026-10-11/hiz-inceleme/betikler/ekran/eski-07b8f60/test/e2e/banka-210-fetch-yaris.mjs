// senaryo-banka-210 son adımının ("tarayıcı hataları") ara sıra kırmızısının yeniden üretimi (yerel koşu 10.10.2026, f5a95c2, mutabakat
// koşusuyla aynı anda: 385/386 — "console [API Query Error] TRPCClientError: Failed to fetch", app-185ffb28c4.js).
// Varsayım: ana sayfa (index) açılınca tablo görünümü sorgusu /api/trpc/sheets.getRows gider; yük altında yanıt gecikir; test sayfa hazır olunca
// (#hof-sidecard + 800 ms) başka sayfaya geçer (adım 48: admin.html#companies; adım 25/48: yeniden "/") — yarıda kalan istek tarayıcıca kesilir,
// uygulamanın sorgu önbelleği bunu console.error("[API Query Error]") ile yazar ve testin hata toplayıcısı (senaryo-banka-210 satır 138) yakalar.
// Kipler: eski — testin bugünkü süzgeci (yalnız 40x / auth/me / "Failed to load resource" hariç)
//         yeni — senaryo-banka-210'un yeni süzgeci (tarayici-kesme.mjs): "Failed to fetch" yalnız aynı sayfada ±3 sn içinde tarayıcının
//                gezinme/kapanma kesmesiyle (requestfailed "net::ERR_ABORTED"; tRPC hatası için tRPC isteği) eşleşirse sayılmaz
// --gecikme ms: /api/trpc/sheets.getRows yanıtı bu kadar bekletilir (0 = yavaşlatma yok; ön koşul oluşmaz).
// --sunucu-hatasi: istek bekletilmez, sunucu düşmüş gibi reddedilir (connectionrefused) — süzgecin DİŞİ: bu hata SAYILMALI (beklenen 1).
// Denetim: ön koşul (geçişte istek yarıda) GERÇEKTEN oluştu mu (istek kaydı) + toplayıcının saydığı hata sayısı.
// Çalıştırma: node --disable-warning=ExperimentalWarning test/e2e/banka-210-fetch-yaris.mjs --kip eski --gecikme 3000 --deneme 3
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { installPageClock } from "../helpers.mjs";
import { fetchCutWatch } from "./tarayici-kesme.mjs";

const { values: opts } = parseArgs({ options: { kip: { type: "string", default: "eski" }, deneme: { type: "string", default: "3" }, gecikme: { type: "string", default: "3000" }, "sunucu-hatasi": { type: "boolean", default: false } } });
const MODE = opts.kip;
const TRIALS = Number(opts.deneme);
const REFUSE = opts["sunucu-hatasi"];
const DELAY = REFUSE ? 0 : Number(opts.gecikme);
if (!["eski", "yeni"].includes(MODE)) throw new Error(`bilinmeyen kip: ${MODE}`);
const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const modal = ".hof-modal-backdrop.is-visible";
const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "rehber.xlsx");

const browser = await chromium.launch();
let passed = 0;
let failed = 0;

async function trial(no) {
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-fetch-yaris-"));
  const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f40" } });
  const { port } = await app.listen(0, "127.0.0.1");
  const BASE = `http://127.0.0.1:${port}`;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  const errors = [];
  const pending = new Set();
  let cutInFlight = 0;
  try {
    await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
    const page = await context.newPage();
    const watch = fetchCutWatch(page);
    page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
    page.on("console", message => {
      const text = `${message.text()} ${message.location().url}`;
      if (message.type() !== "error" || /status of 40[0139]|api\/auth\/me|Failed to load resource/.test(text)) return;
      if (MODE === "yeni" && watch.defer(`console ${message.text()}`)) return;
      errors.push(`console ${message.text()}`);
    });
    page.on("request", request => { if (request.url().includes("/api/trpc/sheets.getRows")) pending.add(request); });
    page.on("requestfinished", request => pending.delete(request));
    page.on("requestfailed", request => pending.delete(request));
    const leave = async action => {
      cutInFlight += pending.size;
      await action();
    };
    await installPageClock(page, app.config.now);
    await page.goto(`${BASE}/`);
    await page.fill("#hof-auth input[name=username]", "admin");
    await page.fill("#hof-auth input[name=password]", PASS);
    await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
    await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
    await page.waitForTimeout(700);
    await page.waitForSelector("#hof-start .hof-drop input[type=file]", { state: "attached", timeout: 30000 });
    await (await page.$("#hof-start .hof-drop input[type=file]")).setInputFiles(FIXTURE);
    await page.waitForSelector(`${modal} .hof-mapping`, { timeout: 30000 });
    await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click(`${modal} [data-mode="replace"]`)]);
    await page.evaluate(() => sessionStorage.removeItem("hof-analyze"));
    await page.waitForTimeout(1500);
    const before = errors.length;
    if (DELAY) await page.route("**/api/trpc/sheets.getRows*", route => { setTimeout(() => route.continue().catch(() => null), DELAY); });
    if (REFUSE) await page.route("**/api/trpc/sheets.getRows*", route => route.abort("connectionrefused").catch(() => null));
    // Adım 48'in sırası: "/" yüklenir, hazır olunca (#hof-sidecard + 800 ms) Yönetim → Şirketler'e geçilir.
    await leave(() => page.goto(`${BASE}/`, { waitUntil: "load" }));
    await page.waitForSelector("#hof-sidecard", { timeout: 30000 });
    await page.waitForTimeout(800);
    await leave(() => page.goto(`${BASE}/admin.html#companies`, { waitUntil: "load" }));
    await page.waitForSelector("#adm-company-report", { timeout: 20000 });
    await page.waitForTimeout(1500);
    if (DELAY || REFUSE) await page.unroute("**/api/trpc/sheets.getRows*");
    // yeni kip: kesmeyle eşleşmeyen "Failed to fetch" hatası sayılır.
    errors.push(...watch.unexplained());
    const counted = errors.slice(before);
    const cuts = watch.cuts().map(cut => `${cut.error} ${cut.url.replace(BASE, "").split("?")[0]}`);
    const good = REFUSE ? counted.some(item => /Failed to fetch/.test(item)) : counted.length === 0;
    if (good) passed += 1;
    else failed += 1;
    console.log(`${good ? "✓" : "✗"} deneme ${no} (${MODE}, sheets.getRows ${REFUSE ? "sunucu reddi (hata SAYILMALI)" : `+${DELAY} ms`}): geçişte yarıda kalan istek ${cutInFlight} (ön koşul ${cutInFlight ? "OLUŞTU" : "oluşmadı"}); tarayıcının kestiği istekler [${cuts.join(", ")}]; toplayıcının saydığı hata ${counted.length}${counted.length ? `: ${counted.map(item => item.split("\n")[0]).join(" | ")}` : ""}`);
  } catch (error) {
    failed += 1;
    console.log(`✗ deneme ${no}: beklenmeyen hata ${error.message.split("\n")[0]}`);
  } finally {
    await context.close().catch(() => null);
    await app.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
}

try {
  for (let no = 1; no <= TRIALS; no += 1) await trial(no);
} finally {
  await browser.close();
}
console.log(`\n${failed ? "BAŞARISIZ" : "TAMAM"}: ${passed} denetim geçti, ${failed} başarısız.`);
process.exitCode = failed ? 1 : 0;
