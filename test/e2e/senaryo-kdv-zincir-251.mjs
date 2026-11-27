// 2.5.1 M1 tur 2 EKRANDAN — S-M1-1 = B (kullanıcıya soruldu 27.11.2026; öneri B uygulanıyor): Raporlar → Tüm Raporlar → KDV Özeti'nde devreden KDV ZİNCİRLİ — mahsup fişi
// kesilmemiş ay sırayla mahsup edilmiş gibi; "Mahsup Edilmemiş Ay" notu zincirli hesabı söyler; KDV Mahsup Fişi ön izlemesi DEĞİŞMEDİ (defterdeki 190 — ayrışma notta); önceki
// ay atlanıp kesilen fişte "Zincirle Uyuşmayan Mahsup Fişi" notu (iki sayı). Gerçek tıklama + klavye (ders 12); sahte saat (sunucu ve sayfa, 15.04.2026 — ders 13); lisans servisi
// yok (ders 30); pencere seçicisi en üstteki görünür pencere (ders 39). Veri programın API'sinden; Mart mahsubu ekrandan.
//   KÂHİN (elle; karar metninden): Ocak alış 10.000 + KDV 2.000 → Ocak mahsubu (devreden 2.000) · Şubat satış 2.000 + KDV 400 MAHSUPSUZ · Mart satış 5.000 + KDV 1.000.
//   A) Elle aralık 01.03.2026 – 31.03.2026: Önceki 1.600 · Ödenecek 0 · Sonraki 600 (özet ve tablo altı; A'da 2.000 / 0 / 1.000); "Mahsup Edilmemiş Ay: Şubat 2026 (devreden ve
//      ödenecek KDV bu aylar sırayla mahsup edilmiş gibi hesaplandı; …)".
//   B) KDV Mahsup Fişi Oluştur → Mart: ön izleme DEĞİŞMEDİ — "kullanılan devreden 2.000", "Sonraki Aya Devreden KDV (190): 1.000", "Şubat 2026 mahsup edilmedi" uyarısı;
//      onay → fiş yazılır (veri tabanı 2.000 / 1.000 / 0); rapor yine 1.600 / 0 / 600 + "Zincirle Uyuşmayan Mahsup Fişi: Mart 2026 fişi 2.000,00 TL devredenle kesilmiş, sırayla
//      mahsupta 1.600,00 TL olmalıydı (…)".
//   C) Bu Yıl: Önceki 0 · Ödenecek 0 · Sonraki 600; ay satırları Ocak 2.000 → Şubat 2.000 / 1.600 → Mart 1.600 / 600.
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
const NOW = "2026-04-15T10:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-kdv-zincir-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f52" } });
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
await must("Şubat satış", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: M, issueDate: "2026-02-10", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 2000, vatRate: 20 }], payment: { rest: "open" } }));
await must("Mart satış", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: M, issueDate: "2026-03-10", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 5000, vatRate: 20 }], payment: { rest: "open" } }));

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
const shot = name => page.screenshot({ path: path.join(process.env.EKRAN_DIR || root, `${name}.png`), fullPage: true }).catch(() => null);
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
async function range(from, to) {
  await page.fill(`${MODAL} [data-rc-main] [data-param="from"]`, from);
  await page.fill(`${MODAL} [data-rc-main] [data-param="to"]`, to);
  await page.focus(`${MODAL} [data-rc-main] [data-rc-run]`);
  await page.keyboard.press("Enter");
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

  console.log("A) Raporlar → Tüm Raporlar → KDV Özeti → 01.03.2026 – 31.03.2026 (Şubat mahsupsuz)");
  await page.click('#hof-sidecard [data-action="analytics"]');
  await page.waitForSelector(`${MODAL} .hof-rep-tab[data-tab="all"]`);
  await page.click(`${MODAL} .hof-rep-tab[data-tab="all"]`);
  await page.waitForSelector(`${MODAL} [data-rc-list] [data-report="kdv-ozeti"]`);
  await page.click(`${MODAL} [data-rc-list] [data-report="kdv-ozeti"]`);
  await ready();
  await range("2026-03-01", "2026-03-31");
  let summary = await summaryOf();
  let t = await table();
  let r = results(summary, t.foot);
  ok(JSON.stringify(r.summary) === JSON.stringify(["1600,00", "0,00", "600,00"]), `Mart özet kartları 1.600 / 0 / 600 — zincir (${JSON.stringify(summary)})`);
  ok(JSON.stringify(r.foot) === JSON.stringify(r.summary), `tablo altı = özet (${JSON.stringify(t.foot)})`);
  ok(/^Şubat 2026 \(devreden ve ödenecek KDV bu aylar sırayla mahsup edilmiş gibi hesaplandı; KDV Mahsup Fişi ön izlemesi defterdeki devredeni gösterir, ayları sırayla mahsup edin\)$/.test(summary["Mahsup Edilmemiş Ay"] || ""), `not: ${summary["Mahsup Edilmemiş Ay"]}`);
  ok(!("Zincirle Uyuşmayan Mahsup Fişi" in summary), "Mart fişi yok: uyuşmazlık notu yok");
  await shot("m1t2-kdv-ozeti-mart-zincir");

  console.log("B) KDV Mahsup Fişi Oluştur → Mart: ön izleme DEĞİŞMEDİ (defterdeki 2.000); onay → kopuk zincir notu");
  await page.click(`${MODAL} [data-rc-action="vat-offset"]`);
  await page.waitForSelector(`${top} [data-vat-month]`);
  await page.selectOption(`${top} [data-vat-month]`, "2026-03");
  await page.waitForFunction(() => /Mart 2026 · fiş tarihi/.test(document.querySelector("[data-vat-root]")?.innerText || ""), null, { timeout: 10000 });
  const vatText = (await page.textContent(`${top} [data-vat-root]`)).replace(/\s+/g, " ").trim();
  const meta = (await page.textContent(`${top} [data-vat-root] .hof-edit-meta`)).replace(/\s+/g, " ").trim();
  ok(/Sonraki Aya Devreden KDV \(190\):/.test(meta) && /1\.000,00/.test(meta) && /kullanılan devreden ₺?2\.000,00/.test(meta), `ön izleme defterden (2.000 → 1.000): ${meta}`);
  ok(/Şubat 2026 mahsup edilmedi/.test(vatText), "ön izlemede 'Şubat 2026 mahsup edilmedi' uyarısı");
  await shot("m1t2-kdv-mahsup-mart-onizleme");
  await page.click(`${top} [data-vat-create]`);
  await page.waitForSelector(`${top} [data-answer="yes"]`);
  console.log('    [soru] "KDV Mahsup Fişi" → Evet (senaryo Şubat atlanmış Mart mahsubunu bilerek yazar)');
  await page.click(`${top} [data-answer="yes"]`);
  await page.waitForFunction(() => /Geri Al/.test(document.querySelector("[data-vat-root]")?.innerText || ""), null, { timeout: 10000 });
  const row = app.store.get("SELECT carry_in_minor AS cin, carry_out_minor AS cout, payable_minor AS pay FROM vat_offsets WHERE month = '2026-03' AND status = 'active'");
  ok(row && row.cin === 200000 && row.cout === 100000 && row.pay === 0, `veri tabanı: Mart fişi ${JSON.stringify(row)} (2.000 / 1.000 / 0 — fiş DEĞİŞMEDİ)`);
  for (let index = 0; index < 3 && (await page.$(`${top} [data-vat-root]`)); index += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  await ready();
  summary = await summaryOf();
  t = await table();
  r = results(summary, t.foot);
  ok(JSON.stringify(r.summary) === JSON.stringify(["1600,00", "0,00", "600,00"]) && JSON.stringify(r.foot) === JSON.stringify(r.summary), `mahsuptan sonra rapor yine zincir 1.600 / 0 / 600 (${JSON.stringify(r)})`);
  // Ekran para tutarlarını "₺2.000,00" diye yazar (sunucu "2.000,00 TL"; istemcinin genel para gösterimi) — karşılaştırma tutar biçiminden bağımsız.
  const mismatchNote = String(summary["Zincirle Uyuşmayan Mahsup Fişi"] || "").replace(/₺([\d.,]+)/g, "$1 TL");
  ok(mismatchNote === "Mart 2026 fişi 2.000,00 TL devredenle kesilmiş, sırayla mahsupta 1.600,00 TL olmalıydı (raporda sırayla mahsup sayıları; bu ayın ve sonraki mahsupları geri alıp ayları sırayla mahsup edin)", `kopuk zincir notu: ${summary["Zincirle Uyuşmayan Mahsup Fişi"]}`);
  await shot("m1t2-kdv-ozeti-mart-kopuk");

  console.log("C) Bu Yıl (2026): ay satırları zincirle");
  await page.click(`${MODAL} [data-rc-main] .hof-rc-range [data-preset="thisYear"]`);
  await page.waitForTimeout(400);
  await ready();
  summary = await summaryOf();
  t = await table();
  r = results(summary, t.foot);
  ok(JSON.stringify(r.summary) === JSON.stringify(["0,00", "0,00", "600,00"]) && JSON.stringify(r.foot) === JSON.stringify(r.summary), `Bu Yıl: 0 / 0 / 600 (${JSON.stringify(r)})`);
  const monthLines = t.body.filter(item => RESULTS.includes(item[1])).map(item => [item[0], item[1], digits(item[5])]);
  ok(
    JSON.stringify(monthLines) ===
      JSON.stringify([
        ["Ocak 2026", "Sonraki Döneme Devreden KDV", "2000,00"],
        ["Şubat 2026", "Önceki Dönemden Devreden KDV", "2000,00"],
        ["Şubat 2026", "Sonraki Döneme Devreden KDV", "1600,00"],
        ["Mart 2026", "Önceki Dönemden Devreden KDV", "1600,00"],
        ["Mart 2026", "Sonraki Döneme Devreden KDV", "600,00"],
      ]),
    `ay satırları (${JSON.stringify(monthLines)})`,
  );
  await shot("m1t2-kdv-ozeti-bu-yil");
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
  await page.screenshot({ path: path.join(process.env.EKRAN_DIR || root, "m1t2-kdv-zincir-hata.png"), fullPage: true }).catch(() => null);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-kdv-zincir-251: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  if (!process.env.EKRAN_DIR) rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
