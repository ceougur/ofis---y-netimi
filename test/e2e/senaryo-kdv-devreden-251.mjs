// 2.5.1 M1 EKRANDAN — S261 (mali müşavir ara kabulü ORTA-1): Raporlar → Tüm Raporlar → KDV Özeti'nde "Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme
// Devreden KDV" (özet kartları + tablo altı) KDV Mahsup Fişi ön izlemesiyle aynı. Gerçek tıklama + klavye (ders 12); sahte saat (sunucu ve sayfa, 15.03.2026 — ders 13); lisans
// servisi yok (ders 30). Pencere seçicisi en üstteki görünür pencere (ders 39). Veri programın API'sinden; mahsup fişi ekrandan.
//   KÂHİN (elle; S261 metni): Ocak alış 10.000 + KDV 2.000 → Ocak mahsubu (devreden 2.000); Şubat satış 6.000 + KDV 1.200 →
//   A) Geçen Ay (Şubat): Önceki Dönemden Devreden 2.000 · Ödenecek 0 · Sonraki Döneme Devreden 800 (özet ve tablo altı); eski "Net KDV" satırı yok.
//   B) KDV Mahsup Fişi Oluştur → Şubat: ön izleme "Sonraki Aya Devreden KDV (190): 800" · "kullanılan devreden 2.000"; onay → yazılır; rapor yine 2.000 / 0 / 800 ve
//      "KDV Mahsup Fişi: Ocak 2026, Şubat 2026" (Ocak mahsubunun tarihi 31.01 — aralık dışı: yalnız Şubat). Veri tabanında Şubat mahsubu carry_out 80000.
//   C) Elle aralık 01.01.2026 – 28.02.2026 (tarih alanı + Ön İzle): Önceki 0 · Ödenecek 0 · Sonraki 800; ay satırları: Ocak "Sonraki Döneme Devreden KDV 2.000",
//      Şubat "Önceki Dönemden Devreden KDV 2.000", "Sonraki Döneme Devreden KDV 800".
// Çıkış: "N geçti, M kaldı". Ekran görüntüleri EKRAN_DIR'e.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);

const PASS = "Prova-Admin-2026!";
const NOW = "2026-03-15T10:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-kdv-devreden-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f51" } });
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
const T = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Toptancı Kırtasiye", type: "supplier", registeredOn: "2026-01-01" }))).id;
const M = (await must("müşteri", api.post("/api/workspace/accounts", { name: "Ayşe Kaya", type: "customer", registeredOn: "2026-01-01" }))).id;
await must("Ocak alış", api.post("/api/workspace/invoices", { kind: "purchase", scenario: "expense_purchase", accountId: T, issueDate: "2026-01-10", number: "TK-1", lines: [{ name: "Kırtasiye", qty: 1, unitPrice: 10000, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }));
await must("Ocak mahsubu", api.post("/api/workspace/tax/vat-offset", { month: "2026-01" }));
await must("Şubat satış", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: M, issueDate: "2026-02-10", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 6000, vatRate: 20 }], payment: { rest: "open" } }));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "tr-TR" });
await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const MODAL = ".hof-modal-backdrop.is-visible";
const top = `${MODAL}:nth-last-child(1 of ${MODAL})`;
const shot = name => page.screenshot({ path: path.join(process.env.EKRAN_DIR || root, `${name}.png`) }).catch(() => null);
const digits = text => String(text || "").replace(/[^\d,]/g, "");
const RESULTS = ["Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme Devreden KDV"];
const ready = () =>
  page.waitForFunction(
    sel => {
      const main = document.querySelector(`${sel} [data-rc-main]`);
      return main && main.getAttribute("aria-busy") !== "true" && main.querySelector(".hof-rc-table, .hof-rc-summary, .hof-empty") && !/Rapor hazırlanıyor|Güncelleniyor…/.test(main.querySelector("[data-rc-busy]:not([hidden])")?.textContent || "") && !/Rapor hazırlanıyor/.test(main.innerText);
    },
    MODAL,
    { timeout: 15000 },
  );
const summaryOf = () => page.evaluate(sel => Object.fromEntries([...document.querySelectorAll(`${sel} [data-rc-main] .hof-rc-summary span`)].map(span => [span.querySelector("small").textContent.trim(), span.querySelector("b").textContent.trim()])), MODAL);
const cells = selector => page.$$eval(selector, rows => rows.map(row => [...row.querySelectorAll("td")].map(td => td.textContent.trim())));
const table = async () => ({ body: await cells(`${MODAL} [data-rc-main] .hof-rc-table tbody tr`), foot: await cells(`${MODAL} [data-rc-main] .hof-rc-table tfoot tr`) });
const results = (summary, foot) => ({
  summary: RESULTS.map(label => digits(summary[label])),
  foot: RESULTS.map(label => digits(foot.find(row => row[1] === label)?.[5])),
});
async function preset(id) {
  await page.click(`${MODAL} [data-rc-main] .hof-rc-range [data-preset="${id}"]`);
  await page.waitForTimeout(400);
  await ready();
}

try {
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });

  console.log("A) Raporlar → Tüm Raporlar → KDV Özeti → Geçen Ay (Şubat 2026)");
  await page.click('#hof-sidecard [data-action="analytics"]');
  await page.waitForSelector(`${MODAL} .hof-rep-tab[data-tab="all"]`);
  await page.click(`${MODAL} .hof-rep-tab[data-tab="all"]`);
  await page.waitForSelector(`${MODAL} [data-rc-list] [data-report="kdv-ozeti"]`);
  await page.click(`${MODAL} [data-rc-list] [data-report="kdv-ozeti"]`);
  await ready();
  await preset("lastMonth");
  let summary = await summaryOf();
  let t = await table();
  let r = results(summary, t.foot);
  ok(JSON.stringify(r.summary) === JSON.stringify(["2000,00", "0,00", "800,00"]), `özet kartları Önceki / Ödenecek / Sonraki = 2.000 / 0 / 800 (${JSON.stringify(summary)})`);
  ok(JSON.stringify(r.foot) === JSON.stringify(["2000,00", "0,00", "800,00"]), `tablo altı = özet (${JSON.stringify(t.foot)})`);
  ok(!t.foot.some(row => row.some(cell => /^Net KDV/.test(cell))), "eski 'Net KDV' satırı yok");
  ok(digits(summary["Hesaplanan KDV (391) (İadeler Düşülmüş)"]) === "1200,00" && "İndirilecek KDV (191) (İadeler Düşülmüş)" in summary, "391 / 191 adlarında '(İadeler Düşülmüş)'");
  ok(t.body.length === 1 && t.body[0][1] === "Satış" && digits(t.body[0][5]) === "1200,00", `tek ay: tabloda yalnız belge satırı (${JSON.stringify(t.body)})`);
  ok(!("Mahsup Edilmemiş Ay" in summary), "önceki ay (Ocak) mahsuplu: 'Mahsup Edilmemiş Ay' notu yok");
  await shot("m1-kdv-ozeti-subat");

  console.log("B) KDV Mahsup Fişi Oluştur → Şubat: ön izleme rapordaki sayılarla aynı; onay");
  await page.click(`${MODAL} [data-rc-action="vat-offset"]`);
  await page.waitForSelector(`${top} [data-vat-month]`);
  await page.selectOption(`${top} [data-vat-month]`, "2026-02");
  await page.waitForFunction(() => /Şubat 2026 · fiş tarihi/.test(document.querySelector("[data-vat-root]")?.innerText || ""), null, { timeout: 10000 });
  const meta = (await page.textContent(`${top} [data-vat-root] .hof-edit-meta`)).replace(/\s+/g, " ").trim();
  ok(/Sonraki Aya Devreden KDV \(190\):/.test(meta) && /800,00/.test(meta) && /kullanılan devreden ₺?2\.000,00/.test(meta), `ön izleme: ${meta}`);
  await shot("m1-kdv-mahsup-subat-onizleme");
  await page.click(`${top} [data-vat-create]`);
  await page.waitForSelector(`${top} [data-answer="yes"]`);
  console.log('    [soru] "KDV Mahsup Fişi" → Evet (senaryo Şubat mahsubunu yazar)');
  await page.click(`${top} [data-answer="yes"]`);
  await page.waitForFunction(() => /Geri Al/.test(document.querySelector("[data-vat-root]")?.innerText || ""), null, { timeout: 10000 });
  const row = app.store.get("SELECT carry_in_minor AS cin, carry_out_minor AS cout, payable_minor AS pay FROM vat_offsets WHERE month = '2026-02' AND status = 'active'");
  ok(row && row.cin === 200000 && row.cout === 80000 && row.pay === 0, `veri tabanı: Şubat mahsubu ${JSON.stringify(row)} (2.000 / 800 / 0)`);
  for (let index = 0; index < 3 && (await page.$(`${top} [data-vat-root]`)); index += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  await ready();
  summary = await summaryOf();
  t = await table();
  r = results(summary, t.foot);
  ok(JSON.stringify(r.summary) === JSON.stringify(["2000,00", "0,00", "800,00"]) && JSON.stringify(r.foot) === JSON.stringify(r.summary), `mahsuptan sonra rapor aynı (${JSON.stringify(r)})`);
  ok(/Şubat 2026/.test(summary["KDV Mahsup Fişi"] || ""), `özette KDV Mahsup Fişi: ${summary["KDV Mahsup Fişi"]}`);

  console.log("C) Elle aralık 01.01.2026 – 28.02.2026 (tarih alanları + Ön İzle)");
  await page.fill(`${MODAL} [data-rc-main] [data-param="from"]`, "2026-01-01");
  await page.fill(`${MODAL} [data-rc-main] [data-param="to"]`, "2026-02-28");
  await page.focus(`${MODAL} [data-rc-main] [data-rc-run]`);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  await ready();
  summary = await summaryOf();
  t = await table();
  r = results(summary, t.foot);
  ok(JSON.stringify(r.summary) === JSON.stringify(["0,00", "0,00", "800,00"]) && JSON.stringify(r.foot) === JSON.stringify(r.summary), `Ocak–Şubat: Önceki 0 / Ödenecek 0 / Sonraki 800 (${JSON.stringify(r)})`);
  const monthLines = t.body.filter(item => RESULTS.includes(item[1])).map(item => [item[0], item[1], digits(item[5])]);
  ok(
    JSON.stringify(monthLines) === JSON.stringify([["Ocak 2026", "Sonraki Döneme Devreden KDV", "2000,00"], ["Şubat 2026", "Önceki Dönemden Devreden KDV", "2000,00"], ["Şubat 2026", "Sonraki Döneme Devreden KDV", "800,00"]]),
    `ay satırları (${JSON.stringify(t.body)})`,
  );
  await shot("m1-kdv-ozeti-ocak-subat");
  await preset("thisYear");
  t = await table();
  summary = await summaryOf();
  ok(digits(summary["Sonraki Döneme Devreden KDV"]) === "800,00" && digits(summary["Ödenecek KDV"]) === "0,00", `Bu Yıl: Sonraki 800, Ödenecek 0 (${JSON.stringify(summary)})`);
  await shot("m1-kdv-ozeti-bu-yil");
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
  await page.screenshot({ path: path.join(process.env.EKRAN_DIR || root, "m1-kdv-devreden-hata.png"), fullPage: true }).catch(() => null);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-kdv-devreden-251: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  if (!process.env.EKRAN_DIR) rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
