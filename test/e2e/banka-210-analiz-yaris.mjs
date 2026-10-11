// senaryo-banka-210 adım 41'in yarışının yeniden üretimi (yerel koşu 10.10.2026: 41–47 "modal-backdrop intercepts pointer events").
// Excel içe aktarıldıktan sonra sayfa yenilenir ve sessionStorage "hof-analyze" işaretiyle "Akıllı Analiz — Veriniz hazır" penceresini
// açar; işaret uygulama hazır olunca (HOF.whenReady, /api/auth/me'den sonra) okunup silinir. Test sayfa hazır olmadan yeniden yüklerse
// işaret kalır ve pencere İKİNCİ yüklemede açılıp ANLIK DURUM kutusunu örter.
// Kipler: eski  — adım 41'in eski sırası (içe aktar → yenilenme → hemen goto)
//         yeni  — adım 41'in yeni sırası (goto'dan önce sessionStorage.removeItem("hof-analyze"))
// --gecikme ms: yenilenen sayfanın /api/auth/me yanıtı bu kadar bekletilir (sayfanın hazır olmasının gecikmesi; 0 = yavaşlatma yok).
// Denetim: ikinci yüklemeden sonra 6 sn içinde "Veriniz hazır" penceresi AÇILMAMALI ve ANLIK DURUM'un Banka kutusu tıklanabilmeli.
// Çalıştırma: node --disable-warning=ExperimentalWarning test/e2e/banka-210-analiz-yaris.mjs --kip eski --gecikme 1500 --deneme 5
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { installPageClock } from "../helpers.mjs";

const { values: opts } = parseArgs({ options: { kip: { type: "string", default: "eski" }, deneme: { type: "string", default: "5" }, gecikme: { type: "string", default: "0" } } });
const MODE = opts.kip;
const TRIALS = Number(opts.deneme);
const DELAY = Number(opts.gecikme);
if (!["eski", "yeni"].includes(MODE)) throw new Error(`bilinmeyen kip: ${MODE}`);
const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const modal = ".hof-modal-backdrop.is-visible";
const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "rehber.xlsx");

const browser = await chromium.launch();
let passed = 0;
let failed = 0;

async function trial(no) {
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-analiz-yaris-"));
  const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f40" } });
  const { port } = await app.listen(0, "127.0.0.1");
  const BASE = `http://127.0.0.1:${port}`;
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  try {
    await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
    const page = await context.newPage();
    await installPageClock(page, app.config.now);
    await page.goto(`${BASE}/`);
    await page.fill("#hof-auth input[name=username]", "admin");
    await page.fill("#hof-auth input[name=password]", PASS);
    await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
    await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
    await page.waitForTimeout(700);
    // Adım 41'deki içe aktarma (aynı dosya, aynı düğme).
    await page.waitForSelector("#hof-start .hof-drop input[type=file]", { state: "attached", timeout: 30000 });
    await (await page.$("#hof-start .hof-drop input[type=file]")).setInputFiles(FIXTURE);
    await page.waitForSelector(`${modal} .hof-mapping`, { timeout: 30000 });
    if (DELAY) {
      await page.route("**/api/auth/me*", route => {
        setTimeout(() => route.continue().catch(() => null), DELAY);
      });
    }
    await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click(`${modal} [data-mode="replace"]`)]);
    const flag = await page.evaluate(() => sessionStorage.getItem("hof-analyze"));
    if (MODE === "yeni") await page.evaluate(() => sessionStorage.removeItem("hof-analyze"));
    if (DELAY) await page.unroute("**/api/auth/me*");
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForSelector("#hof-pulse", { timeout: 30000 });
    const analysis = await page
      .waitForFunction(() => [...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-modal-title")].some(node => node.textContent.includes("Veriniz hazır")), null, { timeout: 6000 })
      .then(() => true)
      .catch(() => false);
    const good = !analysis;
    if (good) passed += 1;
    else failed += 1;
    console.log(`${good ? "✓" : "✗"} deneme ${no} (${MODE}, /api/auth/me +${DELAY} ms): yenilenmeden hemen sonra işaret ${flag ? `"${flag}" duruyordu` : "okunmuştu"}; ikinci yüklemede "Veriniz hazır" ${analysis ? "AÇILDI (ANLIK DURUM'u örter)" : "açılmadı"}`);
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
