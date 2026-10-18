// 2.4.3 H6 (fatura modülü yükte hız testi, docs/kanit/2026-10-17/hiz-fatura): yükte düzen kayması (CLS) pencere başına 0,6–2,5'ten 3,5–5,8'e çıkıyordu.
// Kaynak ölçüldü (docs/kanit/2026-10-18/hiz243-fatura): kayan düğüm Fatura penceresinin KENDİSİ (section.hof-modal). Pencere ekranın ortasına
// yerleşir; liste, senaryo seçimi, form ve kart arasında geçerken yüksekliği (ve formda genişliği) değişir, pencere yeniden ortalanır ve bütün
// içerik yer değiştirir. Yanıt tıklamadan 0,5 sn sonra gelirse (yükte hep) tarayıcı bunu kullanıcının beklemediği kayma sayar.
// Ders 20: yanıtlar zorla geciktirilir (Playwright route, 1 sn); her geçişte pencerenin sol üst köşesi ve tıklamadan bağımsız düzen kayması ölçülür.
// Beklenen: Fatura penceresi bütün görünümlerde aynı yer ve boyutta (köşe ±1 px), pencerenin kendisinden kaynaklanan kayma yok.
// Eski kodda (4d546e9) kırmızı: DEPO=<eski kopya> ile sunucu ve istemci o kopyadan yüklenir.
// Çıkış: "N geçti, M kaldı" (kanıt aracının senaryo biçimi).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);

const PASS = "DuzenKaymasi243-Admin!";
const NOW = "2026-10-08T12:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-duzen-kaymasi-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f73" }, startLicenseTimers: false, gateVerify: false });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
await api.login("admin", PASS);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
const customer = await must("cari", api.post("/api/workspace/accounts", { name: "Kayma Müşterisi", type: "customer", registeredOn: "2026-01-01" }));
// Birkaç satırlık liste (pencere içeriği kısa: ekran yüksekliğine ulaşmaz) ve tek kalemli kart.
let lastId = "";
for (let i = 0; i < 6; i += 1) lastId = (await must("satış", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: customer.id, issueDate: `2026-10-0${1 + i}`, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 100 + i, vatRate: 20 }], payment: { rest: "open" }, force: true }))).id;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
await context.addInitScript(() => {
  window.__shifts = [];
  new PerformanceObserver(list => list.getEntries().forEach(entry => {
    if (entry.hadRecentInput) return;
    const node = entry.sources?.[0]?.node;
    window.__shifts.push({ value: entry.value, node: node?.matches?.("section.hof-modal") ? "pencere" : node?.className || node?.nodeName || "?" });
  })).observe({ type: "layout-shift", buffered: true });
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" })));
});
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await installPageClock(page, app.config.now);
await page.goto(`${BASE}/`);
await page.fill("#hof-auth input[name=username]", "admin");
await page.fill("#hof-auth input[name=password]", PASS);
await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
// Yükteki gibi: fatura uçlarının yanıtı 1 sn gecikir (tıklamadan sonra 0,5 sn'yi aşar).
await context.route(/\/api\/workspace\/invoices/, async route => {
  const response = await route.fetch();
  await new Promise(resolve => setTimeout(resolve, 1000));
  await route.fulfill({ response });
});
const inv = ".hof-modal-backdrop.is-visible .hof-invoices-modal";

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
// GORUNTU=<klasör> verilirse her görünümün ekran görüntüsü (kullanıcı gözüyle denetim için).
const box = async label => {
  if (process.env.GORUNTU) await page.screenshot({ path: path.join(process.env.GORUNTU, `fatura-243-${label.replace(/[^a-z]+/gi, "-")}.png`) });
  return page.$eval(inv, node => { const r = node.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; });
};
const windowShift = () => page.evaluate(() => window.__shifts.filter(item => item.node === "pencere").reduce((sum, item) => sum + item.value, 0));

try {
  await page.click("#hof-sidecard [data-action=invoices]");
  await page.waitForSelector(`${inv} tr[data-inv]`);
  await page.waitForTimeout(600);
  const views = [];
  views.push(["liste", await box("liste")]);
  await page.click(`${inv} [data-act="new"]`);
  await page.waitForSelector(`${inv} [data-scenario="goods_sale"]`);
  await page.waitForTimeout(600);
  views.push(["senaryo seçimi", await box("senaryo")]);
  await page.click(`${inv} [data-scenario="goods_sale"]`);
  await page.waitForSelector(`${inv} [data-l="0"][data-f="name"]`);
  await page.waitForTimeout(1500);
  views.push(["form", await box("form")]);
  // Formdan çık (soru gelirse evet), Fatura penceresini menüden yeniden aç.
  for (let i = 0; i < 4 && (await page.$(".hof-modal-backdrop.is-visible")); i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const yes = await page.$('.hof-modal-backdrop.is-visible [data-answer="yes"]');
    if (yes) await yes.click();
    await page.waitForTimeout(300);
  }
  await page.click("#hof-sidecard [data-action=invoices]");
  await page.waitForSelector(`${inv} tr[data-inv]`);
  await page.waitForTimeout(600);
  views.push(["liste (dönüş)", await box("liste-donus")]);
  await page.evaluate(id => window.HOF.invoices.openDoc(id), lastId);
  await page.waitForSelector(`${inv} .hof-inv-pills`);
  await page.waitForTimeout(1500);
  views.push(["kart", await box("kart")]);
  const [first] = views;
  for (const [name, rect] of views) ok(Math.abs(rect.x - first[1].x) <= 1 && Math.abs(rect.y - first[1].y) <= 1 && Math.abs(rect.w - first[1].w) <= 1 && Math.abs(rect.h - first[1].h) <= 1, `${name}: pencere yerinde (${rect.x},${rect.y} ${rect.w}×${rect.h}; listede ${first[1].x},${first[1].y} ${first[1].w}×${first[1].h})`);
  const shift = await windowShift();
  ok(shift < 0.01, `pencerenin kendisinden kaynaklanan düzen kayması yok (${shift.toFixed(3)})`);
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} fatura-243-duzen-kaymasi: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
