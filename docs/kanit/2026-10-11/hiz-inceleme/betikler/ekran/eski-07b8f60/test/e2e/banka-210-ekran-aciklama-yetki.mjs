// İkinci küçük düzeltmeler (10.10.2026) — EKRANDAN: m2 Vade Takip fatura kaynak adı, m4 eskimiş açıklamalar, m7 banka yetkisiz kişinin Vade Takip'i.
//   m2 Vade Takip'te vadeli fatura satırı ham "invoice" yazıyordu; süzgeç seçeneği adsızdı. Beklenen: "Fatura (vadeli)" (PDF/Excel ile aynı).
//   m4 Fatura → "+ Tahsilat Ekle" formu yol Havale/EFT iken de "Kayıt cariye ve Kasa'ya yazılır" diyordu; Bankadan Kasaya Aktar açıklaması
//      "Raporlar → Banka ve POS Hareketleri" diyordu (banka modülünden önceki yer); Çek / Senet penceresi alt başlığı yalnız Kasa diyordu
//      (tahsil/ödeme varsayılan yolu Banka). Beklenen: yola göre metin (cari formuyla aynı); kılavuzdaki adlar.
//   m7 Yalnız Kasa ve rapor yetkili (banka yetkisiz) kişi Vade Takip'te hesapsız eski banka satırını ("Hesabı Atanmamış (ileri tarihli)") görüyordu.
// TEST VERİSİ: eski banka satırı GERÇEK v2.0.23 kodu (git etiketi) API'sinden; tarihler göreli, güncel kodda sahte saat. Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion, tagsAvailable } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD, installPageClock } from "../helpers.mjs";

const OLD = "v2.0.23";
const PASS = "Kasa-Rapor-2026!";
if (!tagsAvailable([OLD])) {
  console.log(`✗ ${OLD} etiketi yok (git fetch --tags); test koşulamadı`);
  console.log("\n✗ banka-210-ekran-aciklama-yetki: 0 geçti, 1 kaldı");
  process.exit(1);
}
const pad = n => String(n).padStart(2, "0");
const base = new Date();
const day = offset => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, 12, 0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const D0 = day(0);
const root = mkdtempSync(path.join(tmpdir(), "ekran-aciklama-"));
const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data && typeof res.data === "object" && "ok" in res.data ? unwrap(res) : res.data;
};

// v2.0.23: nakit ve bankaya ileri tarihle tahsil edilen iki çek (bugünkü kod ileri tarihli banka satırı yazmaz).
const old = await bootVersion(OLD, dirs);
let partyId = "";
try {
  const api = await old.login();
  const customer = await must("v2.0.23 müşteri", api.post("/api/workspace/accounts", { name: "Vade Müşterisi", type: "customer" }));
  partyId = customer.id;
  const cashIn = await must("v2.0.23 çek (nakit)", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: 300, issueDate: day(-3), dueDate: day(4), serialNo: "EA-1", accountId: customer.id }));
  await must("v2.0.23 çek NAKİT tahsil", api.post(`/api/workspace/cheques/${cashIn.id}/actions`, { action: "collect", date: day(4), method: "cash", status: "portfolio" }));
  const bankIn = await must("v2.0.23 çek (banka)", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: 1000, issueDate: day(-3), dueDate: day(6), serialNo: "EA-2", accountId: customer.id }));
  await must("v2.0.23 çek BANKAYA tahsil", api.post(`/api/workspace/cheques/${bankIn.id}/actions`, { action: "collect", date: day(6), method: "bank", status: "portfolio" }));
} finally {
  await old.close();
}
const server = await bootVersion(CURRENT, { ...dirs, now: { time: `${D0}T12:00:00+03:00` }, moneyStrict: false, gateVerify: false, logLevel: "warn" });
const admin = await server.login();
await must("kurulum geç", admin.post("/api/workspace/bank/setup/dismiss", {}));
await must("Ziraat", admin.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: day(-5), amount: "10.000", confirmed: true } }));
await must("Garanti", admin.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "İkinci TL Hesabı", kind: "demand", opening: { date: day(-5), amount: "5.000", confirmed: true } }));
const role = await must("özel rol", admin.post("/api/admin/roles", { name: "Kasa ve Rapor", permissions: ["accounts.view", "cash.view", "reports.view", "invoices.view"] }));
await must("kasarapor", admin.post("/api/admin/users", { username: "kasarapor", name: "Kasa Rapor", role: role.id, password: PASS, mustChangePassword: false }));
const service = await must("hizmet", admin.post("/api/workspace/stock", { kind: "service", code: "EA-HZM", name: "Danışmanlık", unit: "Adet", salePrice: "2000" }));
const sale = await must("vadeli satış", admin.post("/api/workspace/invoices", { scenario: "service_sale", accountId: partyId, issueDate: D0, lines: [{ itemId: service.id, qty: 1, unitPrice: 2000, vatRate: 0 }], payment: { cash: [], rest: "open", dueDate: day(5) } }));

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const browser = await chromium.launch();
const errors = [];
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
async function login(username, password) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => errors.push(`${username}: ${error.message}`));
  await installPageClock(page, server.app.config.now);
  await page.goto(`${server.base}/`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  return page;
}
const textOf = (page, selector) => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const closeAll = async page => {
  for (let index = 0; index < 8 && (await page.$(modal)); index += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }
};
const openVade = async page => {
  await page.click('.hof-side-item[data-action="analytics"]');
  await page.waitForSelector(`${modal} .hof-rep .hof-rep-tabs`, { timeout: 10000 });
  await page.click(`${modal} .hof-rep [data-tab="vade"]`);
  await page.waitForSelector(`${modal} .hof-rep-vade tbody tr`, { timeout: 15000 });
  await page.waitForTimeout(500);
};
const vadeRows = page => page.$$eval(`${modal} .hof-rep-vade tbody tr[data-due-row]`, nodes => nodes.map(node => node.innerText.replace(/\s+/g, " ").trim()));

try {
  const page = await login("admin", ADMIN_PASSWORD);
  console.log("\n■ m2 Vade Takip: vadeli fatura satırı ve süzgeç seçeneğinin adı");
  await openVade(page);
  const chips = await page.$$eval(`${modal} .hof-rep-sources [data-source]`, nodes => nodes.map(node => `${node.dataset.source}=${node.closest("label").innerText.trim()}`));
  const invoiceChip = chips.find(item => item.startsWith("invoice="));
  ok(invoiceChip === "invoice=Fatura (vadeli)", `süzgeç seçeneği: ${invoiceChip ?? "yok"} (tümü: ${chips.join(", ")})`);
  const sources = await page.$$eval(`${modal} .hof-rep-vade tbody tr[data-due-row] .hof-rep-src`, nodes => nodes.map(node => node.textContent.trim()));
  ok(sources.includes("Fatura (vadeli)") && !sources.includes("invoice"), `satırların kaynak adı: ${sources.join(", ")}`);
  ok(sources.includes("Hesabı Atanmamış (ileri tarihli)"), "yönetici hesapsız eski banka satırını görür (aşırı düzeltme yok)");
  await page.screenshot({ path: path.join(process.env.EKRAN_DIR || root, "m2-vade-takip-yonetici.png") }).catch(() => null);
  await closeAll(page);

  console.log("\n■ m4 Fatura → + Tahsilat Ekle: açıklama yola göre");
  await page.evaluate(id => window.HOF.invoices.openDoc(id), sale.id);
  await page.waitForSelector(`${modal} [data-act="pay"]`, { timeout: 10000 });
  await page.click(`${modal} [data-act="pay"]`);
  await page.waitForSelector(`${top} .hof-form select[name="method"]`, { timeout: 8000 });
  await page.waitForTimeout(600);
  const intro = () => textOf(page, `${top} .hof-modal-text`);
  await page.selectOption(`${top} select[name="method"]`, "cash");
  await page.waitForTimeout(200);
  const cash = await intro();
  // Açık tutar 700: v2.0.23'te cariden alınan iki çek (1.300) faturayı kısmen kapatır (en eski açık borç).
  ok(/Kasa'ya/.test(cash) && /Açık tutar ₺?700,00/.test(cash) && /Cariden para alındı/.test(cash), `Nakit: “${cash}”`);
  await page.selectOption(`${top} select[name="method"]`, "bank");
  await page.waitForTimeout(300);
  const bank = await intro();
  ok(/seçilen banka hesabına girer/.test(bank) && !/Kasa'ya/.test(bank) && /bu faturaya bağlı kapatılır/i.test(bank), `Havale / EFT: “${bank}”`);
  await closeAll(page);

  console.log("\n■ m4 Kasa → Bankadan Kasaya Aktar: açıklama");
  await page.click('.hof-side-item[data-action="cash"]');
  await page.waitForSelector(`${modal} [data-transfer="to-cash"]`, { timeout: 10000 });
  await page.click(`${modal} [data-transfer="to-cash"]`);
  await page.waitForSelector(`${top} .hof-form input[name="amount"]`, { timeout: 8000 });
  await page.waitForTimeout(600);
  const transfer = await intro();
  ok(!/Raporlar → Banka ve POS Hareketleri/.test(transfer) && /seçilen banka hesabından/.test(transfer) && /Banka → Hareketler/.test(transfer), `Bankadan Kasaya Aktar: “${transfer}”`);
  await closeAll(page);

  console.log("\n■ m4 Çek / Senet penceresi alt başlığı");
  await page.click('.hof-side-item[data-action="cheques"]');
  await page.waitForSelector(`${modal} .hof-cheques-modal .hof-plan-title small, .hof-cheques-modal .hof-plan-title small`, { timeout: 10000 });
  const chequeSub = await textOf(page, ".hof-cheques-modal .hof-plan-title small");
  ok(/banka/i.test(chequeSub), `alt başlık bankayı da söyler: “${chequeSub}”`);
  await closeAll(page);

  console.log("\n■ m7 banka yetkisiz (Kasa + rapor) kişinin Vade Takip'i");
  const kasa = await login("kasarapor", PASS);
  const perms = await kasa.evaluate(() => ({ bank: window.HOF.can("bank.view"), cash: window.HOF.can("cash.view") }));
  ok(!perms.bank && perms.cash, `ön koşul: bank.view ${perms.bank}, cash.view ${perms.cash}`);
  await openVade(kasa);
  const rows = await vadeRows(kasa);
  ok(!rows.some(row => /Hesabı Atanmamış/.test(row)), `hesapsız eski banka satırı yok (${rows.length} satır: ${rows.join(" | ")})`);
  ok(rows.some(row => /Kasa/.test(row) && /300,00/.test(row)), "Kasa'nın ileri tarihli nakit satırı görünür");
  await kasa.screenshot({ path: path.join(process.env.EKRAN_DIR || root, "m7-vade-takip-kasa-yetkili.png") }).catch(() => null);
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} banka-210-ekran-aciklama-yetki: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await server.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
