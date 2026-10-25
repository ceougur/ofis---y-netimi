// 2.4.4 madde 8 (UI11) — dışa aktarım düğmeleri tek görünüm (EKRANDAN). Bulgu: docs/kanit/2026-10-18/uiux-a-243/uzman-ui-BULGULAR.md (UI11):
// "Dışa aktarım düğmeleri her modülde başka ad ve renk: Liste - PDF / Cari Listesi - PDF / PDF / PDF İndir / Kasa Dökümü - PDF"; Fatura başlığı iki kez.
// KARAR (kullanıcı, 21.10.2026, CLAUDE.md Açık iş (1)): LİSTE/RAPOR düğmeleri tek ad "PDF" / "Excel" (ne indirdiği erişilebilir adda + ipucunda);
// KART/BELGE çıktıları (Cari Ekstre, Taksit Ekstresi, Stok Kartı, <Belge Türü>, Kasa Dökümü) adlı kalır; hepsi TEK görünüm; fatura listesinde çift başlık kalkar.
// Denetim (her pencere): dışa aktarım düğmeleri (PDF/Excel/Yazdır bağlantı ve düğmeleri) ortak sınıfta (.hof-rep-out is-pdf|is-xlsx|is-print), simgeli,
// ipucu (title) ve erişilebilir ad dolu, ad görünen yazıyı içerir; liste/rapor penceresinde yazı tam "PDF" / "Excel" / "Yazdır"; kartta "… - PDF";
// pencere içinde boyları eşit; bütün pencerelerde yazı tipi/köşe/renk aynı (tür başına). Davranış: bağlantı adresleri ve indirme öznitelikleri korunur.
// Eski kodda kırmızıdır: DEPO=<eski kopya> ile koşulur (SHOTS=<klasör> ekran görüntülerini yazar). Çıkış: "N geçti, M kaldı".
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { escClose } from "./esc-kapat.mjs";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);
const SHOTS = process.env.SHOTS ? path.resolve(process.env.SHOTS) : path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "uiux-ui11-244");
mkdirSync(SHOTS, { recursive: true });

const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-uiux-ui11-244-"));
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
await must("fatura ayarları", api.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: "1234567890", taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara" } }));
const zeynep = await must("cari", api.post("/api/workspace/accounts", { name: "Zeynep Kaya", type: "customer", phone: "05550000001" }));
await must("nakit tahsilat", api.post(`/api/workspace/accounts/${zeynep.id}/entries`, { kind: "in", amount: "250", date: "2026-10-05", note: "Elden", method: "cash" }));
const plan = await must("taksit kartı", api.post("/api/workspace/plans", { name: "Kira Kartı", total: "3.000", mode: "auto", count: 3, firstDue: "2026-10-20" }));
const item = await must("stok", api.post("/api/workspace/stock", { code: "STK-001", name: "Deneme Ürün", unit: "Adet", salePrice: "10" }));
await must("banka", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "1.000", confirmed: true } }));
await must("çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: 300, issueDate: "2026-10-05", dueDate: "2026-10-20", serialNo: "UI11-1", accountId: zeynep.id }));
const invoice = await must("fatura", api.post("/api/workspace/invoices", { kind: "sale", accountId: zeynep.id, issueDate: "2026-10-07", lines: [{ name: "Hizmet", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" } }));

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
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const TOP = ".hof-modal-backdrop.is-visible:last-of-type";

const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on("pageerror", error => errors.push(error.message));
await installPageClock(page, app.config.now);
await page.goto(`${BASE}/`);
await page.fill("#hof-auth input[name=username]", "admin");
await page.fill("#hof-auth input[name=password]", PASS);
await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
await page.waitForFunction(() => window.HOF?.accounts?.open && window.HOF?.invoices?.open && window.HOF?.reportCenter?.open && window.HOF?.bank?.open);

const closeAll = async () => {
  for (let index = 0; index < 6 && (await page.$(".hof-modal-backdrop.is-visible")); index += 1) {
    await escClose(page, { step: "pencereleri kapat" });
    await sleep(250);
  }
};
// Penceredeki dışa aktarım düğmeleri: PDF/Excel bağlantısı (adres .pdf / .xlsx / /pdf / /xlsx), data-pdf / data-print / data-export / data-xlsx taşıyan
// düğme ya da ortak sınıf. Tablo satırındaki makbuz bağlantıları, ana tablonun "Dışa Aktar" menüsü ve onay kutuları (input) sayılmaz.
const exportsIn = scope =>
  page.evaluate(sel => {
    const box = document.querySelector(sel);
    if (!box) return null;
    const hit = node => node.matches?.(".hof-rep-out, [data-pdf]:not(input), [data-print], [data-export]:not(.hof-export-item), [data-xlsx]") || (node.tagName === "A" && /(\.pdf|\/pdf|\.xlsx|\/xlsx)(\?|$)/.test(node.getAttribute("href") || ""));
    const nodes = [...box.querySelectorAll("a, button")].filter(node => hit(node) && node.getClientRects().length && !node.closest("table, .hof-export-menu"));
    return nodes.map(node => {
      const cs = getComputedStyle(node);
      const kind = ["is-pdf", "is-xlsx", "is-print"].find(name => node.classList.contains(name)) || "";
      return { text: node.textContent.replace(/\s+/g, " ").trim(), family: node.classList.contains("hof-rep-out"), kind, title: node.getAttribute("title") || "", aria: node.getAttribute("aria-label") || "", svg: Boolean(node.querySelector("svg")), h: Math.round(node.getBoundingClientRect().height), href: node.getAttribute("href"), download: node.hasAttribute("download"), target: node.getAttribute("target") || "", style: [cs.fontSize, cs.fontWeight, cs.fontFamily, cs.borderTopLeftRadius, cs.paddingLeft, cs.backgroundColor, cs.color].join("|") };
    });
  }, scope);
const styles = {};
const shot = async name => {
  const node = await page.$(`${TOP} .hof-modal`);
  if (node) await node.screenshot({ path: path.join(SHOTS, `${name}.png`) }).catch(() => {});
};
// mode "list": tek ad PDF/Excel/Yazdır; "card": PDF düğmesi adlı ("… - PDF").
const audit = async (name, scope, { mode = "list", expect = [] } = {}) => {
  const list = await exportsIn(scope);
  if (!ok(Array.isArray(list) && list.length >= expect.length, `${name}: ${list?.length ?? "pencere yok"} dışa aktarım düğmesi (${(list || []).map(item => item.text).join(" · ")})`)) return;
  for (const kind of expect) ok(list.some(item => item.kind === `is-${kind}`), `${name}: ${kind} düğmesi ortak ailede`);
  ok(list.every(item => item.family && item.kind), `${name}: hepsi ortak sınıfta (.hof-rep-out is-pdf|is-xlsx|is-print) ${JSON.stringify(list.filter(item => !item.family || !item.kind).map(item => item.text))}`);
  ok(list.every(item => item.svg), `${name}: hepsi simgeli`);
  ok(list.every(item => item.title.trim() && item.aria.trim() && item.aria.includes(item.text)), `${name}: ipucu ve erişilebilir ad dolu, ad görünen yazıyı içerir ${JSON.stringify(list.map(item => [item.text, item.aria, item.title]))}`);
  const names = { "is-pdf": "PDF", "is-xlsx": "Excel", "is-print": "Yazdır" };
  if (mode === "list") ok(list.every(item => item.text === names[item.kind]), `${name}: liste/rapor düğmeleri tek ad ${JSON.stringify(list.map(item => item.text))}`);
  else ok(list.filter(item => item.kind === "is-pdf").every(item => / - PDF$/.test(item.text)) && list.filter(item => item.kind === "is-print").every(item => item.text === "Yazdır"), `${name}: kart/belge çıktısı adlı kalır ${JSON.stringify(list.map(item => item.text))}`);
  ok(new Set(list.map(item => item.h)).size === 1, `${name}: pencere içinde aynı boy (${[...new Set(list.map(item => item.h))].join(", ")} px)`);
  for (const item of list) (styles[item.kind || "?"] ||= new Map()).set(item.style, `${name}: ${item.text}`);
  return list;
};

try {
  console.log("\n■ A. Liste pencereleri");
  await page.evaluate(() => window.HOF.plans.open());
  await page.waitForSelector(`${TOP} .hof-plans-filters [data-pdf="list"]`);
  const plansList = await audit("Taksitler listesi", TOP, { expect: ["pdf", "print"] });
  ok(plansList?.find(item => item.kind === "is-pdf")?.href?.includes("/api/workspace/plans/liste.pdf") && plansList.find(item => item.kind === "is-pdf").target === "_blank", "Taksitler: PDF bağlantısı aynı adres, yeni sekme");
  await shot("taksitler-listesi");
  await closeAll();

  await page.evaluate(() => window.HOF.accounts.open());
  await page.waitForSelector(`${TOP} .hof-acc-filters [data-pdf="list"]`);
  const accList = await audit("Cari listesi", TOP, { expect: ["pdf", "print", "xlsx"] });
  ok(accList?.find(item => item.kind === "is-xlsx")?.href?.includes("/api/workspace/accounts/") && accList.find(item => item.kind === "is-pdf").href.includes(".pdf"), "Cari: PDF ve Excel bağlantıları korunur");
  const accHeights = await page.evaluate(sel => {
    const select = document.querySelector(`${sel} .hof-acc-filters select`);
    return { select: Math.round(select.getBoundingClientRect().height), button: Math.round(document.querySelector(`${sel} [data-pdf="list"]`).getBoundingClientRect().height) };
  }, TOP);
  ok(accHeights.button === accHeights.select, `Cari: süzgeç satırında düğme seçiciyle aynı boy (${accHeights.button} / ${accHeights.select} px)`);
  await shot("cari-listesi");
  console.log("\n■ B. Kart pencereleri (adlı kalır)");
  await page.evaluate(id => window.HOF.accounts.open(id), zeynep.id);
  await page.waitForSelector(`${TOP} [data-pdf="card"]`);
  await audit("Cari kartı", TOP, { mode: "card", expect: ["pdf", "print"] });
  ok(/Cari Ekstre - PDF/.test(await page.textContent(`${TOP} [data-pdf="card"]`)), "Cari kartı: “Cari Ekstre - PDF”");
  await closeAll();

  await page.evaluate(() => window.HOF.stock.open());
  await page.waitForSelector(`${TOP} .hof-plans-filters [data-pdf="list"]`);
  await audit("Stok listesi", TOP, { expect: ["pdf", "print", "xlsx"] });
  await shot("stok-listesi");
  await page.evaluate(id => window.HOF.stock.open(id), item.id);
  await page.waitForSelector(`${TOP} [data-pdf="card"]`);
  await audit("Stok kartı", TOP, { mode: "card", expect: ["pdf", "print"] });
  await closeAll();

  await page.evaluate(id => window.HOF.plans.open(id), plan.id);
  await page.waitForSelector(`${TOP} [data-pdf="card"]`);
  await audit("Taksit kartı", TOP, { mode: "card", expect: ["pdf", "print"] });
  await closeAll();

  await page.evaluate(() => window.HOF.invoices.open({ tab: "all" }));
  await page.waitForSelector(`${TOP} .hof-plan-head .hof-rep-export a`);
  await page.waitForSelector(`${TOP} tr[data-inv]`);
  const invList = await audit("Fatura listesi", TOP, { expect: ["pdf", "xlsx"] });
  ok(invList?.find(item => item.kind === "is-pdf")?.href?.startsWith("/api/workspace/invoices/liste.pdf?") && invList.find(item => item.kind === "is-xlsx").download, "Fatura: PDF/Excel adresi ve indirme özniteliği korunur");
  const invTitles = await page.$$eval(`${TOP} h2, ${TOP} h3`, nodes => nodes.filter(node => node.getClientRects().length && node.textContent.trim() === "Fatura").length);
  ok(invTitles === 1, `Fatura başlığı bir kez (${invTitles})`);
  await shot("fatura-listesi");
  await page.click(`${TOP} tr[data-inv] input[type="checkbox"]`);
  await page.waitForSelector(`${TOP} .hof-acc-selbar.is-active`);
  const selbar = await exportsIn(`${TOP} .hof-acc-selbar`);
  ok(selbar?.length >= 2 && selbar.every(entry => entry.family && entry.kind && entry.svg && entry.title) && selbar.some(entry => entry.text === "Seçilenleri PDF") && selbar.some(entry => entry.text === "Seçilenleri Excel"), `Fatura seçim çubuğu: Seçilenleri PDF / Excel ortak ailede ${JSON.stringify(selbar?.map(entry => entry.text))}`);
  await page.click(`${TOP} tr[data-inv]`);
  await page.waitForSelector(`${TOP} [data-pdf="card"]`);
  await audit("Fatura kartı", TOP, { mode: "card", expect: ["pdf", "print"] });
  await closeAll();

  await page.evaluate(() => window.HOF.cheques.open());
  await page.waitForSelector(`${TOP} .hof-plan-head .hof-rep-export a`);
  await audit("Çek / Senet listesi", TOP, { expect: ["pdf", "xlsx"] });
  await shot("cek-senet-listesi");
  await closeAll();

  console.log("\n■ C. Kasa (belge çıktısı adlı kalır)");
  await page.evaluate(() => window.HOF.workspace.openCash());
  await page.waitForSelector(`${TOP} .hof-cash-add [data-pdf]`);
  await audit("Kasa", `${TOP} .hof-cash-add`, { mode: "card", expect: ["pdf"] });
  ok((await page.textContent(`${TOP} .hof-cash-add [data-pdf]`)).trim() === "Kasa Dökümü - PDF", "Kasa: “Kasa Dökümü - PDF”");
  const cashRow = await page.$$eval(`${TOP} .hof-cash-add > *`, nodes => nodes.map(node => Math.round(node.getBoundingClientRect().height)));
  ok(new Set(cashRow).size === 1, `Kasa: PDF düğmesi satırdaki düğmelerle aynı boy (${cashRow.join(", ")} px)`);
  await shot("kasa");
  await closeAll();

  console.log("\n■ D. Rapor pencereleri");
  for (const [tab, label] of [["mizan", "Cari Mizanı"], ["vade", "Vade Takip"], ["flow", "Nakit Akış"], ["cheques", "Çek / Senet Raporu"]]) {
    await page.evaluate(id => window.HOF.overview.openReports(id), tab);
    await page.waitForSelector(`${TOP} .hof-rep-export a`);
    await audit(`Raporlar → ${label}`, `${TOP} .hof-rep`, { expect: ["pdf", "xlsx"] });
    if (tab === "mizan") await shot("raporlar-cari-ekstre");
  }
  await page.evaluate(() => window.HOF.overview.openReports("all"));
  await page.waitForSelector(`${TOP} .hof-rc-head .hof-rep-out`);
  await sleep(500);
  const rc = await audit("Rapor Merkezi", `${TOP} .hof-rc-head`, { expect: ["pdf", "xlsx"] });
  ok(rc?.find(item => item.kind === "is-pdf")?.href?.includes("/api/workspace/report-center/"), "Rapor Merkezi: PDF adresi korunur");
  await shot("rapor-merkezi");
  await page.evaluate(() => window.HOF.overview.openReports("table"));
  await page.waitForSelector(`${TOP} .hof-report-toolbar [data-export="pdf"]`);
  await audit("Tablo Raporları", `${TOP} .hof-report-toolbar`, { expect: ["pdf", "xlsx", "print"] });
  await closeAll();

  await page.evaluate(() => window.HOF.bank.open({ tab: "movements" }));
  await page.waitForSelector(`${TOP} [data-mv-export] a`);
  const mv = await audit("Banka → Hareketler", `${TOP} [data-mv-export]`, { expect: ["pdf", "xlsx"] });
  ok(mv?.find(item => item.kind === "is-pdf")?.href?.includes("/movements.pdf") && mv.find(item => item.kind === "is-xlsx").href.includes("/movements.xlsx"), "Banka: hareket PDF/Excel adresleri korunur");
  await shot("banka-hareketler");
  await closeAll();

  console.log("\n■ E. Tek görünüm (bütün pencerelerde tür başına aynı yazı tipi, köşe, renk)");
  for (const [kind, map] of Object.entries(styles)) ok(map.size === 1, `${kind}: ${map.size} farklı görünüm ${map.size > 1 ? JSON.stringify([...map.entries()].slice(0, 4)) : ""}`);
  ok(!errors.length, `sayfa hatası yok ${JSON.stringify(errors.slice(0, 3))}`);
} catch (error) {
  failed += 1;
  console.log(`  ✗ BEKLENMEYEN: ${error.stack || error.message}`);
} finally {
  await browser.close().catch(() => {});
  await app.close?.().catch?.(() => {});
  rmSync(root, { recursive: true, force: true });
}
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
