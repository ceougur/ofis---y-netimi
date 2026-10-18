// Senaryo 2.4.3 — Defter ve rapor düzeltmeleri (uzman mali müşavir MM3, MM5, MM9; kullanıcı kararları 18.10.2026). Gerçek kullanıcı gibi ekrandan;
// veri programın kendi API'siyle girilir, her kayıttan sonra sunucudan (Ana Defter mizanı) okunur.
//  MM3a Banka → Hareketler → "+ Vergi Ödemesi": Muhtasar ve Stopaj 2.000 + gecikme 50 → 360 ve 689; KDV 5.000 (360'ı aşan) → "Ödenecek Vergiyi Aşıyor"
//       sorusu, Vazgeç → yazılmaz. Kasa → "Vergi Ödemesi": KDV 800 nakit → Kasa eksi sorusu → Yine de Kaydet → 360 ve 100.
//  MM3b Raporlar → KDV Özeti → "KDV Mahsup Fişi Oluştur": Eylül ön izleme (B 391 2.000 / A 191 1.200 / A 360 800), onay → Eylül 391 = 191 = 0; liste ve
//       "Geri Al"; KDV Özeti özetinde "KDV Mahsup Fişi: Eylül 2026".
//  Yetki: Uzman (avukat; Kasa ve Banka yetkili, vergi yetkisi yok) Vergi Ödemesi düğmelerini görmez; Muhasebe görür.
//  MM5 Alacak Yaşlandırma'da Faturasız Alacak kolonu; MM9 Cari Listesi özet kartları.
// Kırmızı kanıt: DEPO=<eski kopya> ile aynı senaryo eski kodda koşulur (ürün DEPO'dan yüklenir).
// Çalıştırma: npm run test:senaryo-defter-243 (ekran görüntüleri test/e2e/artifacts/senaryo-defter-243/).
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(HERE, "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(HERE, "..", "helpers.mjs")).href);

const OUT = path.join(HERE, "artifacts", "senaryo-defter-243");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Defter-243-Admin!";
const NOW = "2026-10-20T12:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-defter-243-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f44" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const BANK = "/api/workspace/bank";
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
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:last-of-type`;
const WIN = ".hof-bank-modal";
let page = null;
let shotNo = 0;
const shot = async (name, target = page) => {
  shotNo += 1;
  await target.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) });
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
    await shot("hata").catch(() => null);
  }
};
const closeAll = async (target = page) => {
  for (let index = 0; index < 8 && (await target.$(MODAL)); index += 1) {
    await target.keyboard.press("Escape");
    await target.waitForTimeout(250);
    const leave = await target.$(`${TOP} [data-answer="yes"]`);
    if (leave && /Kaydetmeden|Çık/.test((await leave.innerText().catch(() => "")) || "")) await leave.click().catch(() => null);
  }
};
const trial = async () => Object.fromEntries((await must("mizan", api.get("/api/workspace/ledger"))).trial.accounts.map(row => [row.code, row.balance]));
const trialTo = async to => Object.fromEntries((await must("mizan", api.get(`/api/workspace/ledger?to=${to}`))).trial.accounts.map(row => [row.code, row.balance]));
const integrityOk = async () => (await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"))).ok === true;

// ---------- Veri (API; programın kendi uçları) ----------
await api.login("admin", PASS);
await must("sihirbazı kapat", api.post(`${BANK}/setup/dismiss`, {}));
const ziraat = await must("Ziraat", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-09-01", amount: "100.000", confirmed: true } }));
const acc = async (name, type) => (await must(name, api.post("/api/workspace/accounts", { name, type }))).id;
const M1 = await acc("Müşteri Bir", "customer");
const T1 = await acc("Kırtasiyeci", "supplier");
const T3 = await acc("Temizlik Ltd.", "supplier");
const T4 = await acc("Kiraya Veren", "supplier");
const OLD = await acc("Eski Müşteri", "customer");
const inv = (label, body) => must(label, api.post("/api/workspace/invoices", body));
await inv("kira", { kind: "purchase", scenario: "expense_purchase", accountId: T4, issueDate: "2026-09-01", number: "KIRA-09", profile: "KAGIT", stoppageRate: 20, lines: [{ name: "Eylül Kirası", qty: 1, unitPrice: 10000, vatRate: 0, exemptionCode: "351", expenseCode: "rent" }], payment: { rest: "open" } });
await inv("temizlik", { kind: "purchase", scenario: "expense_purchase", accountId: T3, issueDate: "2026-09-04", number: "PRL-33", profile: "KAGIT", lines: [{ name: "Temizlik Hizmeti", qty: 1, unitPrice: 2000, vatRate: 20, withholdingCode: "612", expenseCode: "cleaning" }], payment: { rest: "open" } });
await inv("satış", { scenario: "service_sale", accountId: M1, issueDate: "2026-09-05", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 10000, vatRate: 20 }], payment: { rest: "open" } });
await inv("alış", { kind: "purchase", scenario: "expense_purchase", accountId: T1, issueDate: "2026-09-06", number: "AL-1", lines: [{ name: "Kırtasiye", qty: 1, unitPrice: 4000, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } });
await must("devir", api.post(`/api/workspace/accounts/${OLD}/entries`, { kind: "debt", amount: "5.000", date: "2026-01-02", note: "Açılış bakiyesi (2025 devri)" }));
await must("uzman", api.post("/api/admin/users", { username: "uzman243", name: "Uzman Kullanıcı", role: "avukat", password: "Uzman-243-Parola!", mustChangePassword: false }));

const openReports = async (id, target = page) => {
  await closeAll(target);
  await target.click('#hof-sidecard [data-action="analytics"]');
  await target.waitForSelector(`${MODAL} .hof-rep-tab[data-tab="all"]`, { timeout: 15000 });
  await target.click(`${MODAL} .hof-rep-tab[data-tab="all"]`);
  await target.waitForSelector(`${MODAL} [data-rc-list] [data-report="${id}"]`, { timeout: 15000 });
  await target.click(`${MODAL} [data-rc-list] [data-report="${id}"]`);
  await target.waitForFunction(sel => {
    const main = document.querySelector(`${sel} [data-rc-main]`);
    return main && main.getAttribute("aria-busy") !== "true" && main.querySelector(".hof-rc-table, .hof-rc-summary, .hof-empty") && !/Rapor hazırlanıyor/.test(main.innerText);
  }, MODAL, { timeout: 15000 });
};
const summaryOf = (target = page) => target.evaluate(sel => Object.fromEntries([...document.querySelectorAll(`${sel} [data-rc-main] .hof-rc-summary span`)].map(span => [span.querySelector("small").textContent.trim(), span.querySelector("b").textContent.trim()])), MODAL);
const fill = async (name, value) => {
  const field = await page.$(`${TOP} form [name="${name}"]`);
  if ((await field.evaluate(node => node.tagName)) === "SELECT") await field.selectOption(value);
  else {
    await field.click({ clickCount: 3 });
    await field.type(value, { delay: 25 });
  }
};
const login = async (target, username = "admin", password = PASS) => {
  target.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  await installPageClock(target, app.config.now);
  await target.goto(`${BASE}/`);
  await target.fill("#hof-auth input[name=username]", username);
  await target.fill("#hof-auth input[name=password]", password);
  await Promise.all([target.waitForEvent("load"), target.click('#hof-auth button[type="submit"]')]);
  await target.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await target.waitForTimeout(600);
};

try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  page = await context.newPage();
  await login(page);

  await step("MM3b KDV Özeti → KDV Mahsup Fişi Oluştur (Eylül): ön izleme, onay, liste", async () => {
    await openReports("kdv-ozeti");
    const button = await page.$(`${MODAL} [data-rc-action="vat-offset"]`);
    ok(Boolean(button) && (await button.innerText()).trim() === "KDV Mahsup Fişi Oluştur", "düğme: KDV Mahsup Fişi Oluştur");
    await button.click();
    await page.waitForSelector(`${TOP} [data-vat-month]`, { timeout: 10000 });
    await page.selectOption(`${TOP} [data-vat-month]`, "2026-09");
    await page.waitForFunction(() => /Eylül 2026 · fiş tarihi/.test(document.querySelector("[data-vat-root]")?.innerText || ""), null, { timeout: 10000 });
    const lines = await page.$$eval(`${TOP} [data-vat-root] table:first-of-type tbody tr`, rows => rows.map(row => [...row.querySelectorAll("td")].map(td => td.textContent.trim())));
    ok(JSON.stringify(lines.map(row => [row[0], row[2], row[3]])) === JSON.stringify([["391", "₺2.000,00", ""], ["191", "", "₺1.200,00"], ["360", "", "₺800,00"]]), `ön izleme satırları ${JSON.stringify(lines)}`);
    await shot("mm3-kdv-mahsup-onizleme");
    await page.click(`${TOP} [data-vat-create]`);
    await page.waitForSelector(`${TOP} [data-answer="yes"]`, { timeout: 5000 });
    await page.click(`${TOP} [data-answer="yes"]`);
    // Onay penceresi kapanırken (160 ms) üstteki pencere değişir; mahsup penceresi tekildir (data-vat-root).
    await page.waitForFunction(() => /Geri Al/.test(document.querySelector("[data-vat-root]")?.innerText || ""), null, { timeout: 10000 });
    const sep = await trialTo("2026-09-30");
    ok((sep["391"] ?? 0) === 0 && (sep["191"] ?? 0) === 0 && sep["360"] === -3160, `Eylül sonu 391 ${sep["391"] ?? 0}, 191 ${sep["191"] ?? 0}, 360 ${sep["360"]} (kâhin −3.160)`);
    await shot("mm3-kdv-mahsup-liste");
    await closeAll();
    await openReports("kdv-ozeti");
    const summary = await summaryOf();
    ok(/Eylül 2026/.test(summary["KDV Mahsup Fişi"] || ""), `KDV Özeti özeti: KDV Mahsup Fişi = ${summary["KDV Mahsup Fişi"]}`);
    ok(await integrityOk(), "Mutabakat Testi temiz");
  });

  await step("MM3a Banka → Hareketler → + Vergi Ödemesi: Muhtasar ve Stopaj 2.000 + gecikme 50; 360'ı aşan KDV 5.000 sorulur, Vazgeç → yazılmaz", async () => {
    await closeAll();
    await page.click('#hof-sidecard [data-action="bank"]');
    await page.waitForSelector(`${WIN} [data-bank] .hof-bank-tabs`, { timeout: 15000 });
    await page.click(`${WIN} [data-tab="movements"]`);
    await page.waitForSelector(`${WIN} [data-act="v-tax"]`, { timeout: 10000 });
    await page.click(`${WIN} [data-act="v-tax"]`);
    await page.waitForSelector(`${TOP} form [name="amount"]`, { timeout: 10000 });
    await fill("taxType", "muhtasar");
    await fill("amount", "2.000");
    await fill("lateAmount", "50");
    await fill("description", "Eylül muhtasar");
    await shot("mm3-vergi-odemesi-banka");
    await page.click(`${TOP} form button[type="submit"]`);
    await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop.is-visible form [name=lateAmount]"), null, { timeout: 10000 });
    let tb = await trial();
    ok(tb["360"] === -1160 && tb["689"] === 50 && tb["102"] === 97950, `360 ${tb["360"]} (−3.160 + 2.000), 689 ${tb["689"]}, 102 ${tb["102"]}`);
    await page.click(`${WIN} [data-act="v-tax"]`);
    await page.waitForSelector(`${TOP} form [name="amount"]`, { timeout: 10000 });
    await fill("taxType", "kdv");
    await fill("amount", "5.000");
    await page.click(`${TOP} form button[type="submit"]`);
    await page.waitForSelector(`${TOP} [data-answer="no"]`, { timeout: 10000 });
    const question = await page.$eval(TOP, node => node.innerText.replace(/\s+/g, " "));
    ok(/Ödenecek Vergiyi Aşıyor/.test(question) && /Yine de kaydedilsin mi\?/.test(question), `soru: ${question.slice(0, 160)}`);
    await shot("mm3-vergi-asim-sorusu");
    await page.click(`${TOP} [data-answer="no"]`);
    await page.waitForTimeout(400);
    tb = await trial();
    ok(tb["360"] === -1160, "Vazgeç: yazılmadı");
    await closeAll();
    ok(await integrityOk(), "Mutabakat Testi temiz");
  });

  await step("MM3a Kasa → Vergi Ödemesi: KDV 800 nakit; Kasa eksi sorusu → Yine de Kaydet; 360 ve 100", async () => {
    await closeAll();
    await page.click('#hof-sidecard [data-action="cash"]');
    await page.waitForSelector(`${MODAL} [data-tax]`, { timeout: 15000 });
    await shot("mm3-kasa-dugme");
    await page.click(`${MODAL} [data-tax]`);
    await page.waitForSelector(`${TOP} form [name="amount"]`, { timeout: 10000 });
    await fill("taxType", "kdv");
    await fill("amount", "800");
    await page.click(`${TOP} form button[type="submit"]`);
    await page.waitForSelector(`${TOP} [data-answer="yes"]`, { timeout: 10000 });
    const question = await page.$eval(TOP, node => node.innerText.replace(/\s+/g, " "));
    ok(/Kasa Eksiye Düşecek/.test(question), `Kasa sorusu: ${question.slice(0, 120)}`);
    await page.click(`${TOP} [data-answer="yes"]`);
    await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop.is-visible form [name=lateAmount]"), null, { timeout: 10000 });
    const tb = await trial();
    ok(tb["360"] === -360 && tb["100"] === -800, `360 ${tb["360"]} (yalnız tevkifat kaldı), 100 ${tb["100"]}`);
    await page.waitForTimeout(600);
    await shot("mm3-kasa-satiri");
    ok(await integrityOk(), "Mutabakat Testi temiz");
  });

  await step("MM5 Alacak Yaşlandırma: Faturasız Alacak kolonu (Eski Müşteri 5.000 → 90+); MM9 Cari Listesi kartları", async () => {
    await openReports("alacak-yaslandirma");
    const heads = await page.$$eval(`${MODAL} [data-rc-main] thead th`, cells => cells.map(cell => cell.textContent.trim()));
    ok(heads.includes("Faturasız Alacak (dilimlere dahil)"), "Faturasız Alacak kolonu");
    const row = await page.$$eval(`${MODAL} [data-rc-main] tbody tr`, rows => rows.map(tr => [...tr.querySelectorAll("td")].map(td => td.textContent.trim())).find(cells => cells[0] === "Eski Müşteri"));
    ok(row && row[6] === "₺5.000,00", `Eski Müşteri 90+ = ${row?.[6]}`);
    await shot("mm5-yaslandirma");
    await openReports("cari-listesi");
    const cards = await summaryOf();
    ok("Müşteri Alacakları (Borçlu Cariler)" in cards && "Tedarikçi Borçları (Alacaklı Cariler)" in cards && "Net Bakiye (Müşteri Alacakları − Tedarikçi Borçları)" in cards && !("Toplam Borç (Anlaşılan)" in cards), `kartlar: ${Object.keys(cards).join(" | ")}`);
    await shot("mm9-cari-listesi");
  });

  await step("yetki: Uzman (Kasa ve Banka yetkili, vergi yetkisi yok) Vergi Ödemesi ve KDV Mahsup düğmesini görmez", async () => {
    const other = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "tr-TR" });
    const second = await other.newPage();
    await login(second, "uzman243", "Uzman-243-Parola!");
    await second.click('#hof-sidecard [data-action="cash"]');
    await second.waitForSelector(`${MODAL} [data-add="out"]`, { timeout: 15000 });
    ok(!(await second.$(`${MODAL} [data-tax]`)), "Kasa'da Vergi Ödemesi yok");
    await closeAll(second);
    await second.click('#hof-sidecard [data-action="bank"]');
    await second.waitForSelector(`${WIN} [data-bank] .hof-bank-tabs`, { timeout: 15000 });
    await second.click(`${WIN} [data-tab="movements"]`);
    await second.waitForSelector(`${WIN} [data-act="v-fee"]`, { timeout: 10000 });
    ok(!(await second.$(`${WIN} [data-act="v-tax"]`)), "Banka Hareketler'de + Vergi Ödemesi yok");
    await other.close();
  });
} catch (error) {
  failed += 1;
  console.log(`✗ kurulum hatası: ${error.stack || error.message}`);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-defter-243: ${passed} geçti, ${failed} kaldı · depo ${ROOT} · ekran görüntüleri ${OUT}`);
  await browser.close();
  await app.close();
  fs.rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
