// CI koşu 460'ın (senaryo-banka-210 adım 9b, "Bankaya Geçmiş Say" formu 30 sn açılmadı) yeniden üretimi ve düzeltmenin kanıtı.
// Adım 9b'nin son kısmı aynen: Eski Hareketler'de Bankaya Geçmiş Say → (yalnız açılıştan önceki POS var) "yok" bildirimi; sonra başka
// yerden açılıştan sonra 1.500 POS girilir; Hesaplar → Eski Hareketler → Bankaya Geçmiş Say. Beklenen: form 1.500,00 ile açılır.
// Kipler (her deneme ayrı sunucu ve ayrı tarayıcı bağlamıyla):
//   normal   — yavaşlatma yok
//   cpu      — tarayıcıda CDP Emulation.setCPUThrottlingRate (--cpu, varsayılan 6)
//   gecikme  — GET /api/workspace/bank/legacy yanıtı tarayıcıda --gecikme ms bekletilir (yavaş sunucu/ağ; varsayılan 1500)
// Her denemede: Eski Hareketler'e tıklama, Bankaya Geçmiş Say tıklaması ve /bank/legacy yanıtlarının zamanı yazılır (hangi istek
// beklenmedi?). Özet satırı "N denetim geçti, M başarısız" (tools/kanit.mjs okur); başarısız varsa çıkış 1.
// Çalıştırma: node --disable-warning=ExperimentalWarning test/e2e/banka-210-yaris.mjs --kip gecikme --deneme 10
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient, installPageClock } from "../helpers.mjs";

const { values: opts } = parseArgs({ options: { kip: { type: "string", default: "normal" }, deneme: { type: "string", default: "10" }, cpu: { type: "string", default: "6" }, gecikme: { type: "string", default: "1500" }, bekle: { type: "string", default: "8000" } } });
const MODE = opts.kip;
const TRIALS = Number(opts.deneme);
const RATE = Number(opts.cpu);
const DELAY = Number(opts.gecikme);
const WAIT = Number(opts.bekle);
if (!["normal", "cpu", "gecikme"].includes(MODE)) throw new Error(`bilinmeyen kip: ${MODE}`);

const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const bankWin = ".hof-bank-modal";
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);

const browser = await chromium.launch();
let passed = 0;
let failed = 0;

async function trial(no) {
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-banka-yaris-"));
  const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f40" } });
  const { port } = await app.listen(0, "127.0.0.1");
  const BASE = `http://127.0.0.1:${port}`;
  const api = createClient(BASE);
  const must = async (label, promise) => {
    const res = await promise;
    if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
    return unwrap(res);
  };
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  const t0 = Date.now();
  const log = [];
  const mark = what => log.push(`${String(Date.now() - t0).padStart(6)} ms ${what}`);
  try {
    await api.login("admin", PASS);
    const party = await must("cari", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    await must("22.09 POS", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "3.000", method: "card", date: "2026-09-22" }));
    await must("sihirbazı kapat", api.post("/api/workspace/bank/setup/dismiss", {}));
    await must("hesap", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));

    await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
    const page = await context.newPage();
    await installPageClock(page, app.config.now);
    page.on("response", response => {
      const url = new URL(response.url());
      if (url.pathname.startsWith("/api/workspace/bank/")) mark(`yanıt ${response.request().method()} ${url.pathname.replace("/api/workspace/bank", "")} ${response.status()}`);
    });
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.pathname === "/api/workspace/bank/legacy") mark(`istek GET /legacy`);
    });
    await page.goto(`${BASE}/`);
    await page.fill("#hof-auth input[name=username]", "admin");
    await page.fill("#hof-auth input[name=password]", PASS);
    await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
    await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
    await page.waitForTimeout(700);
    if (MODE === "cpu") {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE });
    }
    await page.click('#hof-sidecard [data-action="bank"]');
    await page.waitForSelector(`${bankWin} [data-bank] .hof-bank-tabs`, { timeout: 30000 });
    await page.waitForTimeout(500);
    // İlk ziyaret: Eski Hareketler → Bankaya Geçmiş Say → "yok" (yalnız açılıştan önceki POS).
    await page.click(`${bankWin} .hof-bank-tabs [data-tab="accounts"]`);
    await page.waitForTimeout(700);
    await page.click(`${bankWin} [data-act="legacy"]`);
    await page.waitForSelector(`${bankWin} [data-act="reclass-bank"]`, { timeout: 30000 });
    // İlk ziyaretin verisi gelsin (görünüm "Hesabı Atanmamış" tablosunu çizdi).
    await page.waitForSelector(`${bankWin} .hof-bank-legacy tbody tr`, { timeout: 30000 });
    await page.waitForTimeout(500);
    await page.click(`${bankWin} [data-act="reclass-bank"]`);
    await page.waitForTimeout(500);
    const firstToast = await page.$eval("#hof-toasts .hof-toast:last-child", node => node.textContent.trim()).catch(() => "");
    if (!firstToast.includes("açılışından sonra bankaya geçmemiş POS tahsilatı yok")) throw new Error(`ilk tıklamada beklenen bildirim yok: ${firstToast}`);
    // Başka yerden (API) açılıştan sonraki POS.
    await must("05.10 POS", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "1.500", method: "card", date: "2026-10-05" }));
    if (MODE === "gecikme") {
      await page.route("**/api/workspace/bank/legacy*", route => {
        if (route.request().method() !== "GET") return route.continue();
        setTimeout(() => route.continue().catch(() => {}), DELAY);
      });
    }
    // Adım 9b'deki sıra (test/e2e/senaryo-banka-210.mjs): Hesaplar → Eski Hareketler → düğmeyi bekle → tıkla.
    await page.click(`${bankWin} .hof-bank-tabs [data-tab="accounts"]`);
    await page.waitForTimeout(700);
    mark("tık Eski Hareketler");
    await page.click(`${bankWin} [data-act="legacy"]`);
    await page.waitForSelector(`${bankWin} [data-act="reclass-bank"]`, { timeout: 8000 });
    const NONE = "bankaya geçmemiş POS tahsilatı yok";
    const toastsBefore = await page.$$eval("#hof-toasts .hof-toast", (nodes, text) => nodes.filter(node => node.textContent.includes(text)).length, NONE);
    mark("tık Bankaya Geçmiş Say");
    await page.click(`${bankWin} [data-act="reclass-bank"]`);
    // Form ya da yeni "yok" bildirimi — hangisi önce gelirse (bildirim kendiliğinden kaybolmadan okunur).
    const outcome = await page
      .waitForFunction(
        ([form, text, before]) => (document.querySelector(form) ? "form" : [...document.querySelectorAll("#hof-toasts .hof-toast")].filter(node => node.textContent.includes(text)).length > before ? "toast" : null),
        [`${top} form [name="amount"]`, NONE, toastsBefore],
        { timeout: WAIT },
      )
      .then(handle => handle.jsonValue())
      .catch(() => "none");
    const opened = outcome === "form";
    mark(opened ? "form açıldı" : outcome === "toast" ? "form yerine yeni bildirim: POS tahsilatı yok" : `${WAIT} ms içinde ne form ne bildirim`);
    const amount = opened ? await page.$eval(`${top} form [name="amount"]`, node => node.value) : "";
    const toast = outcome === "toast" ? await page.$$eval("#hof-toasts .hof-toast", nodes => nodes.at(-1)?.textContent.trim() || "") : "";
    const good = opened && amount === "1.500,00";
    if (good) passed += 1;
    else failed += 1;
    console.log(`${good ? "✓" : "✗"} deneme ${no} (${MODE}${MODE === "cpu" ? ` ×${RATE}` : MODE === "gecikme" ? ` ${DELAY} ms` : ""}): ${good ? `form açıldı, tutar ${amount}` : opened ? `form açıldı ama tutar ${amount}` : `form açılmadı; son bildirim: ${toast.slice(0, 90)}`}`);
    for (const line of log.slice(log.findIndex(item => item.includes("tık Eski Hareketler")))) console.log(`    ${line}`);
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
