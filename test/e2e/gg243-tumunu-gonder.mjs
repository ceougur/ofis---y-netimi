// Dar kontrol turu 2.4.3 (Y1, YÜKSEK; betik r11): "Tümünü Gönder" tek istekte 200 belgeyi gönderiyordu; gerçek EDM ~320/dk → ~37 sn+. Tarayıcı isteği
// 30 sn'de kesip "Sunucu zamanında yanıt vermedi" diyordu (kırmızı hata), sunucu arkada göndermeyi sürdürüyordu. Artık sunucu bir istekte en çok 20
// belge ya da ~10 sn işler, kalan sayısını döner; ekran kalan bitene dek yineler, düğmede "Gönderiliyor: X / Y" gösterir ve ikinci tur açtırmaz.
// İstemci zaman aşımına düşerse hata değil "sunucuda sürüyor olabilir, liste yenilendi" der.
// Sahte EDM (ağa çıkmaz): her gönderim 900 ms (40 belge ≈ 36 sn — eski kodda tek istek 30 sn'yi aşar). GERÇEK tarayıcıda, ekrandan.
//   A. 40 bekleyen → Tümünü Gönder: düğme ilerlemeyi gösterir ve basılamaz; aynı anda en çok bir istek; bitişte "40 belge gönderildi."; her belge EDM'ye
//      bir kez, numara sırası = tarih sırası; "zamanında yanıt vermedi" bildirimi YOK.
//   B. İstemci zaman aşımı (ekran testi için 3 sn): bildirim "sunucuda sürüyor olabilir … Liste yenilendi", kırmızı hata yok; sunucu arkada sürdürür.
// Eski kodda (d64ebf8) A kırmızıdır; DEPO=<eski kopya> ile koşulur. Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
const { OUR_VKN, startMockEdm } = await import(pathToFileURL(path.join(ROOT, "test", "einvoice-mock.mjs")).href);
const { resetEdmCaches } = await import(pathToFileURL(path.join(ROOT, "server", "lib", "einvoice", "edm.mjs")).href);

const PASS = "Prova-Admin-2026!";
const NOW = "2026-06-17T09:00:00+03:00";
const SEND_MS = 900;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
resetEdmCaches();
const edm = await startMockEdm();
const fetchImpl = async (input, init) => {
  const url = String(typeof input === "string" || input instanceof URL ? input : input.url);
  if (!url.startsWith("http://127.0.0.1")) throw new Error(`ağa çıkılmaz (test): ${url}`);
  if (/SendInvoiceRequest/.test(String(init?.body || ""))) await sleep(SEND_MS);
  return globalThis.fetch(input, init);
};
const root = mkdtempSync(path.join(tmpdir(), "destekofis-gg243-tumunu-gonder-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, fetchImpl, edocEnabled: true, testSeriesStart: () => 1, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f45" }, startLicenseTimers: false });
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
await must("firma", api.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" }, efatura: true, earsiv: true }));
await must("entegratör", api.put("/api/workspace/invoices/settings", { integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
const today = (await must("bugün", api.get("/api/workspace/ledger/lock"))).today;
const day = offset => {
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + offset)).toISOString().slice(0, 10);
};
// Perakende alıcı (mükellef sorgusu yapılmaz): süre yalnız gönderimden.
const buyers = [];
for (let i = 0; i < 3; i += 1) buyers.push((await must("cari", api.post("/api/workspace/accounts", { name: `Perakende ${i + 1}`, type: "customer", partyKind: "person", firstName: "Perakende", familyName: `${i + 1}`, taxNo: "11111111111", address: "Kordon 1", district: "Konak", city: "İzmir" }))).id);
const docs = [];
for (let i = 0; i < 40; i += 1) docs.push(await must("bekleyen", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: buyers[i % 3], issueDate: day(-10 + Math.floor(i / 5)), lines: [{ name: "Hizmet", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" })));
const row = id => app.store.get("SELECT number, issue_date AS issueDate, e_status AS eStatus, ettn FROM invoices WHERE id = ?", id);
const sends = () => edm.state.calls.filter(call => call.op === "SendInvoice").length;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
// Aynı anda uçuştaki send-pending istekleri (ikinci tur açılmamalı).
let inFlight = 0;
let maxInFlight = 0;
let requests = 0;
page.on("request", request => {
  if (!request.url().includes("/api/workspace/invoices/send-pending")) return;
  requests += 1;
  inFlight += 1;
  maxInFlight = Math.max(maxInFlight, inFlight);
});
const done = request => {
  if (request.url().includes("/api/workspace/invoices/send-pending")) inFlight -= 1;
};
page.on("requestfinished", done);
page.on("requestfailed", done);
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const modal = ".hof-modal-backdrop.is-visible";
const pageInv = `${modal} .hof-invoices-modal`;
const dialog = ".hof-modal-backdrop.is-visible:last-of-type";
const toasts = () => page.$$eval(".hof-toast", nodes => nodes.map(node => `${node.className}|${node.querySelector(".hof-toast-text")?.textContent || ""}`)).catch(() => []);
const button = `${pageInv} [data-act="send-pending"]`;

try {
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => window.HOF?.invoices?.open);

  console.log("A) 40 bekleyen, her gönderim 900 ms — Tümünü Gönder ekrandan");
  await page.evaluate(() => window.HOF.invoices.open({ tab: "pending" }));
  await page.waitForSelector(button);
  ok(/Tümünü Gönder \(40\)/.test(await page.textContent(button)), `düğme 40 belge (${await page.textContent(button)})`);
  await page.click(button);
  await page.waitForSelector(`${dialog} [data-answer="yes"]`);
  await page.click(`${dialog} [data-answer="yes"]`);
  const seen = new Set();
  let disabledSeen = false;
  let secondClick = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) {
    const state = await page.$eval(button, node => ({ text: node.textContent.trim(), disabled: node.disabled })).catch(() => null);
    if (state && /^Gönderiliyor: /.test(state.text)) {
      seen.add(state.text);
      if (state.disabled) disabledSeen = true;
      if (!secondClick && seen.size >= 2) {
        // Gönderim sürerken düğmeye yeniden basılır (devre dışı; zorla tıklama da ikinci tur açmamalı).
        secondClick = true;
        await page.click(button, { force: true }).catch(() => null);
        await page.evaluate(() => document.querySelector('.hof-invoices-modal [data-act="send-pending"]')?.click()).catch(() => null);
      }
    }
    const list = await toasts();
    if (list.some(item => /belge gönderildi/.test(item)) || list.some(item => /zamanında yanıt vermedi/.test(item))) break;
    await sleep(250);
  }
  const took = Math.round((Date.now() - t0) / 1000);
  const all = await toasts();
  console.log(`  (süre ${took} sn; görülen ilerleme: ${[...seen].join(" · ")})`);
  ok(!all.some(item => /zamanında yanıt vermedi/.test(item)), `"Sunucu zamanında yanıt vermedi" bildirimi yok (${all.join(" ‖ ").slice(0, 300)})`);
  ok(all.some(item => /hof-toast-success[^|]*\|40 belge gönderildi\.$/.test(item)), `bitiş bildirimi "40 belge gönderildi." (${all.join(" ‖ ").slice(0, 300)})`);
  ok([...seen].some(text => /^Gönderiliyor: \d+ \/ 40$/.test(text)), "düğmede ilerleme göründü (Gönderiliyor: X / 40)");
  ok(seen.size >= 2, `ilerleme birden çok adımda arttı (${seen.size} farklı)`);
  ok(disabledSeen, "gönderim sürerken düğme basılamaz");
  ok(maxInFlight === 1, `aynı anda en çok bir istek (görülen ${maxInFlight}; toplam ${requests} istek)`);
  ok(requests >= 3, `istek parçalara bölündü (${requests} istek)`);
  ok(sends() === 40, `EDM'ye 40 gönderim (${sends()})`);
  const rows = docs.map(doc => row(doc.id));
  ok(rows.every(item => item.eStatus !== "waiting" && /^TEA/.test(item.number)), "hepsi numaralı ve gönderilmiş");
  const sorted = [...rows].sort((x, y) => Number(x.number.slice(7)) - Number(y.number.slice(7)));
  ok(sorted.every((item, index) => index === 0 || item.issueDate >= sorted[index - 1].issueDate), "numara sırası = tarih sırası");
  ok(rows.every(item => edm.state.calls.filter(call => call.op === "SendInvoice" && call.raw.includes(item.ettn)).length === 1), "her belge EDM'ye bir kez");
  await page.waitForFunction(sel => !document.querySelector(sel), button, { timeout: 10000 }).catch(() => null);

  console.log("B) istemci zaman aşımı (3 sn) — hata değil, 'sunucuda sürüyor olabilir'");
  for (let i = 0; i < 12; i += 1) docs.push(await must("bekleyen", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: buyers[i % 3], issueDate: day(0), lines: [{ name: "Hizmet", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" })));
  await page.evaluate(() => window.HOF.invoices.open({ tab: "pending" }));
  await page.waitForFunction(sel => /Tümünü Gönder \(12\)/.test(document.querySelector(sel)?.textContent || ""), button, { timeout: 15000 });
  await page.evaluate(() => {
    window.HOF.invoices.sendPendingTimeoutMs = 3000;
  });
  const before = sends();
  await page.click(button);
  await page.waitForSelector(`${dialog} [data-answer="yes"]`);
  await page.click(`${dialog} [data-answer="yes"]`);
  const info = await page.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].map(node => `${node.className}|${node.querySelector(".hof-toast-text")?.textContent || ""}`).find(text => /sunucuda sürüyor olabilir/.test(text)) || null, null, { timeout: 15000 }).then(handle => handle.jsonValue()).catch(() => "");
  ok(/hof-toast-info/.test(info) && /gönderim sunucuda sürüyor olabilir\. Liste yenilendi; bir süre sonra Gönderilecekler'e bakın, kalan belge olursa Tümünü Gönder'e yeniden basın\.$/.test(info), `bilgi bildirimi (${info})`);
  ok(!(await toasts()).some(item => /hof-toast-error/.test(item)), `kırmızı hata bildirimi yok (${(await toasts()).join(" ‖ ").slice(0, 300)})`);
  await sleep(1500);
  const label = await page.textContent(button).catch(() => "");
  ok(!/Gönderiliyor/.test(label), `düğme yeniden basılabilir (${label})`);
  await sleep(9000);
  ok(sends() > before, `sunucu arkada sürdürdü (${sends() - before} gönderim)`);
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
  const shot = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "gg243-tumunu-gonder-hata.png");
  await page.screenshot({ path: shot, fullPage: true }).then(() => console.log(`  ekran görüntüsü: ${shot}`), () => null);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} gg243-tumunu-gonder: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  await edm.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
