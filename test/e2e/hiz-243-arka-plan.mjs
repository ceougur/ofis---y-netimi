// 2.4.3 H2 (fatura modülü yükte hız testi, docs/kanit/2026-10-17/hiz-fatura): her kayıt bütün açık pencerelere yenileme yayıyor; açık her pencere
// tahsilat takvimini (10.000 faturalı veride 2,8 MB) her değişiklikte baştan alıyordu. Artık ekran elindeki takvimin sürümünü gönderir
// (?since=); içerik değişmediyse sunucu yalnız "değişmedi" der. Bu senaryo GERÇEK tarayıcıda ve başka oturumun (ayrı API istemcisi) kayıtlarıyla:
//  1. takvimi DEĞİŞTİRMEYEN kayıt (peşin ödenmiş satış) → ekran yeniler ama sürümle ister, yanıt küçük ("değişmedi"); şerit yerinde kalır
//     (yeniden çizilmez: yanıp sönme yok);
//  2. takvimi DEĞİŞTİREN kayıt (vadesi yarın açık satış) → yeni kalem şeritte belirir (güncellik bugünkü kadar çabuk: en çok 15 sn);
//  3. tahsilatla kapanan kalem şeritten düşer;
//  4. kritik stok rozeti başka oturumun satışıyla dolar, kritik seviye düşürülünce boşalır (sunucudaki rozet önbelleği güncelliği bozmaz).
// Eski kodda (4d546e9) adım 1 kırmızıdır (istek sürümsüz, yanıt tam takvim).
// Çıkış: "N geçti, M kaldı" (kanıt aracının senaryo biçimi).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient, installPageClock } from "../helpers.mjs";

const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const TOMORROW = "2026-10-09";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-hiz243-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f43" }, startLicenseTimers: false });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE); // başka oturum
await api.login("admin", PASS);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
const customer = await must("cari", api.post("/api/workspace/accounts", { name: "Takvim Ticaret", type: "customer", registeredOn: "2026-09-01" }));
const created = await must("ürün", api.post("/api/workspace/stock", { name: "Rozet Ürünü", code: "RZT-243", unit: "Adet", unitPrice: 10, salePrice: 20, minQty: 5, openingQty: 20, openingPay: "none" }));
const itemId = created.id || created.item?.id;
const sale = (qty, payment) => must("satış", api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: customer.id, issueDate: TODAY, lines: [{ itemId, qty, unitPrice: 20, vatRate: 20 }], payment, force: true }));
// Takvimde baştan bir kalem: vadesi 3 gün sonra açık satış.
await sale(1, { rest: "open", dueDate: "2026-10-11" });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
// Ekranın takvim istekleri: adres (sürüm var mı) ve yanıtın kendisi (değişmedi mi, kaç bayt).
const duesCalls = [];
page.on("response", async response => {
  const url = new URL(response.url());
  if (url.pathname !== "/api/workspace/dues") return;
  const body = await response.text().catch(() => "");
  let parsed = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = null;
  }
  duesCalls.push({ since: url.searchParams.get("since") || "", bytes: body.length, unchanged: parsed?.data?.unchanged === true, version: parsed?.data?.version || "", items: parsed?.data?.items?.length ?? null });
});
await installPageClock(page, app.config.now);
await page.goto(`${BASE}/`);
await page.fill("#hof-auth input[name=username]", "admin");
await page.fill("#hof-auth input[name=password]", PASS);
await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
await page.waitForSelector("#hof-sidecard", { timeout: 60000 });

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const pills = () => page.$$eval(".hof-payment-promises .hof-payment-pill:not([aria-hidden])", nodes => nodes.map(node => node.title)).catch(() => []);
const waitFor = async (check, ms = 15000) => {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await check()) return Date.now() - start;
    await page.waitForTimeout(150);
  }
  return null;
};
const badge = () => page.$eval('[data-badge="stock"]', node => node.textContent.trim()).catch(() => "?");

try {
  console.log("1) ilk açılış: takvim tamamı gelir, şeritte açık faturanın kalemi");
  await page.waitForSelector(".hof-payment-promises .hof-payment-pill", { timeout: 20000 });
  ok((await pills()).length === 1, `şeritte 1 kalem (${(await pills()).length})`);
  const first = duesCalls.find(call => call.items !== null);
  ok(first && first.version, `ilk yanıt tam ve sürümlü (${first ? `${first.bytes} bayt, sürüm ${first.version || "yok"}` : "yanıt yok"})`);
  await page.evaluate(() => document.querySelector(".hof-payment-promises")?.setAttribute("data-hiz243", "ilk"));

  console.log("2) başka oturum takvimi DEĞİŞTİRMEYEN kayıt (peşin ödenmiş satış)");
  const before = duesCalls.length;
  await sale(1, { cash: [{ amount: 24, method: "cash" }], rest: "open" });
  const took = await waitFor(async () => duesCalls.length > before);
  ok(took !== null, `ekran takvimi yeniledi (${took} ms)`);
  const call = duesCalls[before];
  ok(Boolean(call?.since), `istek elindeki sürümle gitti (since=${call?.since || "yok"})`);
  ok(call?.unchanged === true && call.bytes < 300, `yanıt "değişmedi" ve küçük (${call ? `${call.bytes} bayt, değişmedi=${call.unchanged}` : "yok"})`);
  await page.waitForTimeout(800);
  const marker = await page.evaluate(() => document.querySelector(".hof-payment-promises")?.getAttribute("data-hiz243") || "");
  ok(marker === "ilk" && (await pills()).length === 1, `şerit yerinde, yeniden çizilmedi (işaret ${marker || "kayboldu"}, ${(await pills()).length} kalem)`);

  console.log("3) başka oturum takvimi DEĞİŞTİREN kayıt (vadesi yarın açık satış)");
  const open = await sale(2, { rest: "open", dueDate: TOMORROW });
  const shown = await waitFor(async () => (await pills()).length === 2);
  ok(shown !== null, `yeni kalem şeritte belirdi (${shown} ms; ${(await pills()).length} kalem)`);
  const fresh = duesCalls.at(-1);
  ok(fresh && !fresh.unchanged && fresh.items !== null, `yanıt tam takvim (${fresh ? `${fresh.bytes} bayt` : "yok"})`);

  console.log("4) tahsilatla kapanan kalem şeritten düşer");
  await must("tahsilat", api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: 48, date: TODAY, method: "cash", invoiceId: open.id }));
  const gone = await waitFor(async () => (await pills()).length === 1);
  ok(gone !== null, `kapanan kalem düştü (${gone} ms; ${(await pills()).length} kalem)`);

  console.log("5) kritik stok rozeti (sunucu önbelleği güncelliği bozmaz)");
  ok((await badge()) === "", `başta rozet boş ("${await badge()}")`);
  // 20 − 1 − 1 − 2 = 16; 12 satılınca 4 ≤ 5 → kritik.
  await sale(12, { cash: [{ amount: 288, method: "cash" }], rest: "open" });
  const lit = await waitFor(async () => (await badge()) === "1");
  ok(lit !== null, `rozet 1 oldu (${lit} ms; "${await badge()}")`);
  const card = await must("ürün kartı", api.get(`/api/workspace/stock/${itemId}`));
  await must("kritik seviye", api.put(`/api/workspace/stock/${itemId}`, { name: card.name, code: card.code, unit: card.unit, unitPrice: card.unitPrice, salePrice: card.salePrice, minQty: 1, kind: card.kind }));
  // Ürün kartı yazımı stok olayını yayımlar; rozet yenilenir (yeni stok hareketi olmadan: önbellek yazmayla geçersizleşmeli).
  const dark = await waitFor(async () => (await badge()) === "");
  ok(dark !== null, `kritik seviye 1 olunca rozet boşaldı (${dark} ms; "${await badge()}")`);
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`takvim istekleri: ${duesCalls.length} (sürümlü ${duesCalls.filter(call => call.since).length}, değişmedi ${duesCalls.filter(call => call.unchanged).length}, toplam ${duesCalls.reduce((sum, call) => sum + call.bytes, 0)} bayt)`);
  console.log(`\n${failed ? "✗" : "✓"} hiz-243-arka-plan: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
