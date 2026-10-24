// 2.4.5 madde 6d (müşteri isteği M2) — Ayrıntılı Cari Ekstre EKRANDAN: cari kartı → "Ayrıntılı Ekstre" → Raporlar → Cari Ekstre bu cariyle ve
// "Fatura Kalemlerini Göster" işaretli açılır; ekrandaki tablo: fatura satırının altında girintili kalemler, Belge No, Yol, Dönem Toplamı + Genel Toplam;
// kalem toplamı = fatura satırının borcu; ekrandaki PDF ve Excel bağlantılarından inen dosyalar ekranla aynı satır sayısı ve aynı Genel Toplam.
// İşaret kaldırılınca bugünkü ekstre (6 kolon). Finans Raporları yetkisi olmayan kullanıcıda kartta düğme yok.
// Eski kodda kırmızıdır (düğme yok): DEPO=<eski kopya> ile koşulur. SHOTS=<klasör> ekran görüntüleri. Çıkış: "N geçti, M kaldı".
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { escClose } from "./esc-kapat.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(HERE, "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
// Dosya okuyucu her zaman bu çalışma ağacından (eski kopyada yoktur; okuyucu ürün kodu değildir).
const { pdfText, xlsxRows } = await import(pathToFileURL(path.join(HERE, "..", "fixtures", "rapor-dosya-oku.mjs")).href);
const SHOTS = process.env.SHOTS ? path.resolve(process.env.SHOTS) : path.join(HERE, "artifacts", "senaryo-ekstre-ayrinti-245");
mkdirSync(SHOTS, { recursive: true });

const PASS = "Prova-Admin-2026!";
const NOW = "2026-11-27T12:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-ekstre-ayrinti-245-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f47" }, startLicenseTimers: false });
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
const deniz = await must("cari", api.post("/api/workspace/accounts", { name: "Deniz Yapı Ltd.", type: "customer", registeredOn: "2026-01-01" }));
await must("açılış", api.post(`/api/workspace/accounts/${deniz.id}/entries`, { kind: "debt", amount: "500", date: "2026-01-02", note: "Açılış bakiyesi" }));
await must("fatura 1", api.post("/api/workspace/invoices", { kind: "sale", scenario: "service_sale", accountId: deniz.id, issueDate: "2026-11-10", discountRate: 10, lines: [{ name: "Montaj Hizmeti", qty: 3, unitPrice: 1250.5, discountRate: 5, vatRate: 20, unit: "Saat" }, { name: "Keşif", qty: 1, unitPrice: 999.99, vatRate: 10 }], payment: { rest: "open" } }));
await must("fatura 2", api.post("/api/workspace/invoices", { kind: "sale", scenario: "service_sale", accountId: deniz.id, issueDate: "2026-11-15", pricesIncludeVat: true, lines: [{ name: "Bakım Paketi", qty: 2, unitPrice: 1000, vatRate: 20 }], payment: { cash: [{ amount: 500, method: "cash" }], rest: "open" } }));
await must("tahsilat", api.post(`/api/workspace/accounts/${deniz.id}/entries`, { kind: "in", amount: "1000", method: "cash", date: "2026-11-20", note: "Elden" }));
const kaya = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Kaya Tedarik", type: "supplier", registeredOn: "2026-01-01" }));
await must("personel", api.post("/api/admin/users", { username: "personel6d", name: "Personel Altı", role: "personel", password: "Personel-2026!", mustChangePassword: false }));

const browser = await chromium.launch();
const errors = [];
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`;
const kurus = text => {
  const match = /^(-?)([\d.]+),(\d{2})/.exec(String(text ?? "").replace(/−/g, "-").replace("₺", "").trim());
  return match ? Number(`${match[2].replace(/\./g, "")}${match[3]}`) * (match[1] ? -1 : 1) : null;
};

async function login(context, username, password) {
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => errors.push(error.message));
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => window.HOF?.accounts?.open && window.HOF?.reportCenter?.open);
  return page;
}
const style = { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" };

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(css => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), css))), style);
  const page = await login(context, "admin", PASS);

  console.log("1) Cari kartı → Ayrıntılı Ekstre");
  await page.evaluate(id => window.HOF.accounts.open(id), deniz.id);
  await page.waitForSelector(`${TOP} [data-act="detailStatement"]`, { state: "visible" }).catch(() => null);
  const button = await page.$(`${TOP} [data-act="detailStatement"]`);
  ok(button && (await button.innerText()).trim() === "Ayrıntılı Ekstre", "cari kartında \"Ayrıntılı Ekstre\" düğmesi");
  if (!button) throw new Error("düğme yok — sonraki adımlar koşulamaz");
  await button.click();
  await page.waitForSelector(`${TOP} [data-rc-main][aria-busy="false"] .hof-rc-table tbody tr`, { timeout: 20000 });
  const main = `${TOP} [data-rc-main]`;
  const view = await page.evaluate(sel => {
    const node = document.querySelector(sel);
    const heads = [...node.querySelectorAll(".hof-rc-table thead th")].map(th => th.textContent.trim());
    const rows = [...node.querySelectorAll(".hof-rc-table tbody tr")].map(tr => ({ cls: tr.className, cells: [...tr.children].map(td => td.textContent.trim()) }));
    const totals = [...node.querySelectorAll(".hof-rc-table tfoot tr")].map(tr => [...tr.children].map(td => td.textContent.trim()));
    const check = node.querySelector('input[type="checkbox"][data-param="items"]');
    const picker = node.querySelector("[data-account-slot] input")?.value || node.querySelector("[data-account-slot]")?.textContent || "";
    const pdf = node.querySelector(".hof-rep-out.is-pdf")?.getAttribute("href") || "";
    const xlsx = node.querySelector(".hof-rep-out.is-xlsx")?.getAttribute("href") || "";
    return { title: node.querySelector(".hof-rc-head h3")?.textContent.trim(), heads, rows, totals, checked: check?.checked === true, checkLabel: check?.closest("label")?.textContent.trim() || "", picker, pdf, xlsx };
  }, main);
  await page.screenshot({ path: path.join(SHOTS, "01-ayrintili-ekstre.png"), fullPage: false });
  ok(view.title === "Ayrıntılı Cari Ekstre · Deniz Yapı Ltd.", `başlık: ${view.title}`);
  ok(view.checked && view.checkLabel === "Fatura Kalemlerini Göster", `seçenek işaretli (${view.checkLabel})`);
  ok(/Deniz Yapı/.test(view.picker), `cari seçili (${view.picker.slice(0, 60)})`);
  const at = name => view.heads.indexOf(name);
  ok(["Belge No", "Yol", "Açıklama / Ürün - Hizmet", "Miktar", "Birim", "Birim Fiyat", "İsk. %", "KDV'siz Tutar", "KDV %", "Toplam", "Borç", "Alacak", "Bakiye"].every(name => at(name) >= 0), `kolonlar: ${view.heads.join(" | ")}`);
  const items = view.rows.filter(row => row.cls.includes("is-item"));
  ok(items.some(row => row.cells[at("Açıklama / Ürün - Hizmet")] === "› Montaj Hizmeti" && row.cells[at("Birim")] === "Saat" && row.cells[at("İsk. %")] === "%5"), "kalem satırı girintili (› Montaj Hizmeti, Saat, %5)");
  ok(items.some(row => /^› Genel İskonto %10/.test(row.cells[at("Açıklama / Ürün - Hizmet")])), "genel iskonto satırı");
  const indent = await page.$eval(`${main} .hof-rc-table tbody tr.is-item td:nth-child(5)`, td => parseFloat(getComputedStyle(td).paddingLeft));
  ok(indent >= 18, `kalem satırı ekranda girintili (padding-left ${indent}px)`);
  // Kalem toplamı = fatura satırının borcu (ekrandaki sayılarla).
  let invoiceChecks = 0;
  view.rows.forEach((row, index) => {
    if (!row.cls.includes("is-invoice")) return;
    let sum = 0;
    for (let next = index + 1; next < view.rows.length && view.rows[next].cls.includes("is-item"); next += 1) sum += kurus(view.rows[next].cells[at("Toplam")]) || 0;
    invoiceChecks += 1;
    ok(sum === kurus(row.cells[at("Borç")]), `${row.cells[at("Belge No")]}: kalem toplamı ${sum} = borç ${kurus(row.cells[at("Borç")])}`);
  });
  ok(invoiceChecks === 2, `iki fatura satırı (${invoiceChecks})`);
  ok(view.rows.some(row => row.cells[at("Yol")] === "Nakit" && /^Makbuz \d+$/.test(row.cells[at("Belge No")])), "tahsilat: Yol Nakit + Belge No makbuz");
  const label = at("Açıklama / Ürün - Hizmet");
  const grand = view.totals.find(row => row[label] === "GENEL TOPLAM");
  ok(view.totals.some(row => row[label] === "DÖNEM TOPLAMI") && grand, `TOPLAM satırları: ${view.totals.map(row => row[label]).join(", ")}`);

  console.log("2) Ekrandaki PDF ve Excel bağlantıları: aynı satırlar, aynı Genel Toplam");
  const xlsx = await api.raw("GET", view.xlsx);
  const sheet = xlsxRows(xlsx.buffer);
  const headerAt = sheet.findIndex(row => row[0] === "Tarih" && row.includes("Açıklama / Ürün - Hizmet"));
  const body = sheet.slice(headerAt + 1);
  ok(xlsx.status === 200 && body.length === view.rows.length + view.totals.length, `Excel satırı ${body.length} = ekran ${view.rows.length} + TOPLAM ${view.totals.length}`);
  const xGrand = body.find(row => row[label] === "GENEL TOPLAM");
  ok(xGrand && Math.round(xGrand[at("Borç")] * 100) === kurus(grand[at("Borç")]) && Math.round(xGrand[at("Alacak")] * 100) === kurus(grand[at("Alacak")]), `Excel Genel Toplam borç/alacak = ekran (${xGrand?.[at("Borç")]} / ${xGrand?.[at("Alacak")]})`);
  const pdf = await api.raw("GET", view.pdf);
  const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
  const tl = value => `${(value / 100).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
  ok(pdf.status === 200 && text.includes("Ayrıntılı Cari Ekstre") && text.includes("› Montaj Hizmeti") && text.includes("GENEL TOPLAM") && text.includes(tl(kurus(grand[at("Borç")]))), "PDF: başlık, kalem, Genel Toplam tutarı");
  const shot = await api.raw("GET", view.pdf.replace(/\?/, "?download=1&"));
  if (shot.status === 200) {
    const { writeFileSync } = await import("node:fs");
    writeFileSync(path.join(SHOTS, "ayrintili-ekstre.pdf"), shot.buffer);
  }

  console.log("3) İşaret kaldırılınca bugünkü ekstre");
  await page.click(`${main} input[type="checkbox"][data-param="items"]`);
  await page.waitForFunction(sel => document.querySelector(sel)?.getAttribute("aria-busy") === "false" && document.querySelectorAll(`${sel} .hof-rc-table thead th`).length === 6, main, { timeout: 15000 }).catch(() => null);
  const plain = await page.$$eval(`${main} .hof-rc-table thead th`, ths => ths.map(th => th.textContent.trim()));
  ok(plain.join("|") === "Tarih|İşlem|Açıklama|Borç|Alacak|Bakiye", `kolonlar: ${plain.join(" | ")}`);
  ok((await page.$$(`${main} .hof-rc-table tbody tr.is-item`)).length === 0, "kalem satırı yok");
  await page.screenshot({ path: path.join(SHOTS, "02-secenek-kapali.png") });
  for (let index = 0; index < 6 && (await page.$(MODAL)); index += 1) await escClose(page, { step: "kapat" });

  console.log("3b) Raporlar → Cari Ekstre → carinin ekstresi → Ayrıntılı Ekstre (K6d.1)");
  await page.evaluate(() => window.HOF.overview.openReports("mizan"));
  await page.waitForSelector(`${TOP} [data-account-row="${deniz.id}"]`, { state: "visible", timeout: 20000 });
  await page.click(`${TOP} [data-account-row="${deniz.id}"]`);
  await page.waitForSelector(`${TOP} .hof-rep-crumb [data-open-account]`, { state: "visible", timeout: 20000 });
  const link = await page.$(`${TOP} .hof-rep-crumb [data-detail-statement]`);
  ok(link && (await link.innerText()).trim() === "Ayrıntılı Ekstre", "Cari Ekstre sekmesinde \"Ayrıntılı Ekstre\" düğmesi");
  if (!link) throw new Error("Cari Ekstre sekmesinde Ayrıntılı Ekstre yok — sonraki adımlar koşulamaz");
  await link.click();
  await page.waitForSelector(`${TOP} [data-rc-main][aria-busy="false"] .hof-rc-table tbody tr.is-item`, { timeout: 20000 });
  const fromTab = await page.evaluate(sel => {
    const node = document.querySelector(sel);
    const check = node.querySelector('input[type="checkbox"][data-param="items"]');
    return { title: node.querySelector(".hof-rc-head h3")?.textContent.trim(), checked: check?.checked === true, picker: node.querySelector("[data-account-slot] input")?.value || node.querySelector("[data-account-slot]")?.textContent || "" };
  }, main);
  ok(fromTab.title === "Ayrıntılı Cari Ekstre · Deniz Yapı Ltd." && fromTab.checked && /Deniz Yapı/.test(fromTab.picker), `Rapor Merkezi o cari + Fatura Kalemlerini Göster işaretli (${fromTab.title}; işaret ${fromTab.checked})`);
  await page.screenshot({ path: path.join(SHOTS, "03-cari-ekstre-sekmesinden.png") });
  for (let index = 0; index < 6 && (await page.$(MODAL)); index += 1) await escClose(page, { step: "kapat" });

  console.log("3c) Tahsilat / ödeme formunda bilgi notu; Kapatılacak Fatura seçilince gizli (kullanıcı kararı \"sadece bilgi notu\")");
  const entryCount = () => app.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", deniz.id).n;
  const entriesBefore = entryCount();
  const page2 = page;
  const fifoOf = () => page2.$eval(`${TOP} [data-fifo-note]`, node => (node.hidden ? "" : node.textContent.trim())).catch(() => null);
  await page2.evaluate(id => window.HOF.accounts.open(id), deniz.id);
  await page2.waitForSelector(`${TOP} [data-entry="in"]`, { state: "visible" });
  await page2.click(`${TOP} [data-entry="in"]`);
  await page2.waitForSelector(`${TOP} select[name="invoiceId"]`, { state: "visible" });
  await page2.waitForTimeout(150);
  ok((await fifoOf()) === "Bu tahsilat carinin en eski açık borcundan başlayarak kapatır.", `Otomatik iken not: “${await fifoOf()}”`);
  const invoiceValue = await page2.$eval(`${TOP} select[name="invoiceId"]`, node => [...node.options].find(option => option.value)?.value || "");
  await page2.selectOption(`${TOP} select[name="invoiceId"]`, invoiceValue);
  ok(invoiceValue && (await fifoOf()) === "", "Kapatılacak Fatura seçilince not gizli");
  await page2.screenshot({ path: path.join(SHOTS, "04-tahsilat-fatura-secili.png") });
  await page2.selectOption(`${TOP} select[name="invoiceId"]`, "");
  ok((await fifoOf()) === "Bu tahsilat carinin en eski açık borcundan başlayarak kapatır.", "Otomatik'e dönünce not yeniden görünür");
  await escClose(page2, { step: "tahsilat formu" });
  await page2.waitForSelector(`${TOP} [data-entry="out"]`, { state: "visible" });
  await page2.click(`${TOP} [data-entry="out"]`);
  await page2.waitForSelector(`${TOP} input[name="amount"]`, { state: "visible" });
  await page2.waitForTimeout(150);
  // DB2: sunucu müşteriye Ödeme'yi müşterinin borcunu kapatma saymaz (invoice-settle classifyLine) → müşteride Ödeme formunda not YOK.
  ok((await fifoOf()) === null, `müşteriye ödeme formunda not yok: “${await fifoOf()}”`);
  for (let index = 0; index < 6 && (await page2.$(MODAL)); index += 1) await escClose(page2, { step: "kapat" });
  ok(entryCount() === entriesBefore, `formlar kaydetmeden kapandı (cari hareketi ${entryCount()} = ${entriesBefore})`);
  // DB2: tedarikçide tersi — Ödeme'de not VAR, Tahsilat'ta YOK.
  const kayaCount = () => app.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", kaya.id).n;
  const kayaBefore = kayaCount();
  await page2.evaluate(id => window.HOF.accounts.open(id), kaya.id);
  await page2.waitForSelector(`${TOP} [data-entry="out"]`, { state: "visible" });
  await page2.click(`${TOP} [data-entry="out"]`);
  await page2.waitForSelector(`${TOP} input[name="amount"]`, { state: "visible" });
  await page2.waitForTimeout(150);
  ok((await fifoOf()) === "Bu ödeme carinin en eski açık borcundan başlayarak kapatır.", `tedarikçiye ödeme formunda not: “${await fifoOf()}”`);
  await escClose(page2, { step: "tedarikçi ödeme formu" });
  await page2.waitForSelector(`${TOP} [data-entry="in"]`, { state: "visible" });
  await page2.click(`${TOP} [data-entry="in"]`);
  await page2.waitForSelector(`${TOP} input[name="amount"]`, { state: "visible" });
  await page2.waitForTimeout(150);
  ok((await fifoOf()) === null, `tedarikçiden tahsilat formunda not yok: “${await fifoOf()}”`);
  for (let index = 0; index < 6 && (await page2.$(MODAL)); index += 1) await escClose(page2, { step: "kapat" });
  ok(kayaCount() === kayaBefore, `tedarikçi formları kaydetmeden kapandı (${kayaCount()} = ${kayaBefore})`);
  await page.close();

  console.log("4) Finans Raporları yetkisi olmayan: kartta düğme yok");
  const staffContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
  await staffContext.addInitScript(css => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), css))), style);
  const staff = await login(staffContext, "personel6d", "Personel-2026!");
  const canView = await staff.evaluate(() => window.HOF.can("accounts.view"));
  if (canView) {
    await staff.evaluate(id => window.HOF.accounts.open(id), deniz.id);
    await staff.waitForSelector(`${TOP} .hof-plan-actions`, { state: "visible" });
    ok((await staff.$(`${TOP} [data-act="detailStatement"]`)) === null, "personelin cari kartında Ayrıntılı Ekstre yok");
  } else ok(true, "personel cariyi göremiyor (düğme de yok)");
  await staffContext.close();
} catch (error) {
  failed += 1;
  console.log(`  ✗ HATA: ${error.message}`);
} finally {
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 3).join(" / ")}` : ""}`);
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exitCode = failed ? 1 : 0;
