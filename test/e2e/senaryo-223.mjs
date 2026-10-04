// Senaryo 2.0.23 — haftalık ekran testinin bulguları (04.10.2026, docs/EKRAN-HAFTA-TESTI-2026-10-04.md), arayüzden:
//  Bulgu 1: fatura formunda çek/senet satırı klavyeyle (Tab) ve fareyle doldurulur; değerler kalır, fatura evrakla kaydedilir.
//           Tutarı geçersiz evrakla kayıt durur (önceden evrak sessizce düşüyor, fatura "Açık" kaydediliyordu).
//  Bulgu 2: cari kartında "Kapatılacak Fatura" taksitli faturayı sunmaz (taksitli fatura kendi kartıyla kapanır).
//  Bulgu 3: Raporlar → Tüm Raporlar'da dönem düğmesi seçili cariyi silmez; tek tıkta tek rapor isteği gider.
//  Bulgu 4: Banka ve POS Hareketleri'nde "Yol" seçimi rapora uygulanır.
// Çalıştırma: npm run test:senaryo-223
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient } from "../helpers.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-223");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-223-"));
const pad = v => String(v).padStart(2, "0");
const now = new Date();
const TODAY = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const later = new Date(now.getFullYear(), now.getMonth() + 2, 15);
const DUE_TYPED = `${pad(later.getMonth() + 1)}${pad(later.getDate())}${later.getFullYear()}`; // tarih kutusu ay/gün/yıl
const DUE_ISO = `${later.getFullYear()}-${pad(later.getMonth() + 1)}-${pad(later.getDate())}`;
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f22" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "en-US" });
await context.addInitScript(() => {
  document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" })));
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(`pageerror ${error.message}`));

let passed = 0;
let failed = 0;
let shotNo = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const shot = async name => {
  shotNo += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) });
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
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const inv = `${modal} .hof-invoices-modal`;
const main = `${modal} [data-rc-main]`;
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
  return unwrap(res);
};
const closeAll = async () => {
  for (let i = 0; i < 6 && (await page.$(modal)); i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const yes = await page.$(`${modal} [data-answer="yes"]`);
    if (yes) await yes.click();
  }
};
const focusName = () => page.evaluate(() => document.activeElement?.dataset?.f || document.activeElement?.tagName || "");

try {
  await api.login("admin", PASS);
  const supplier = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Senaryo Tedarikçi", type: "supplier", registeredOn: "2025-01-01" }));
  await must("ürün", api.post("/api/workspace/stock", { name: "Fren Balata", code: "FB-1", unit: "Adet", unitPrice: 10, salePrice: 20 }));
  const service = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "HZM", name: "Hizmet", unit: "Adet", salePrice: "1000" }));
  const customer = await must("müşteri", api.post("/api/workspace/accounts", { name: "Kapama Müşteri", type: "customer", registeredOn: "2025-01-01" }));
  const other = await must("müşteri 2", api.post("/api/workspace/accounts", { name: "Başka Müşteri", type: "customer", registeredOn: "2025-01-01" }));
  const openInvoice = await must("açık fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: customer.id, issueDate: TODAY, lines: [{ itemId: service.id, qty: 1, unitPrice: 2000, vatRate: 0 }], payment: { rest: "open", dueDate: TODAY } }));
  const plannedInvoice = await must("taksitli fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: customer.id, issueDate: TODAY, lines: [{ itemId: service.id, qty: 1, unitPrice: 3000, vatRate: 0 }], payment: { rest: "installments", installments: { count: 3, firstDue: DUE_ISO, everyMonths: 1 } } }));
  await must("başka fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: other.id, issueDate: TODAY, lines: [{ itemId: service.id, qty: 1, unitPrice: 5000, vatRate: 0 }], payment: { rest: "open", dueDate: TODAY } }));
  await must("havale", api.post(`/api/workspace/accounts/${other.id}/entries`, { kind: "in", amount: 300, date: TODAY, method: "bank" }));
  await must("pos", api.post(`/api/workspace/accounts/${other.id}/entries`, { kind: "in", amount: 700, date: TODAY, method: "card" }));

  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard [data-action=invoices]", { timeout: 60000 });
  await page.waitForTimeout(1200);

  // ---------- Bulgu 1 ----------
  const newPurchase = async number => {
    await closeAll();
    await page.click("#hof-sidecard [data-action=invoices]");
    await page.waitForSelector(`${inv} [data-act="new"]`);
    await page.click(`${inv} [data-act="new"]`);
    await page.click(`${inv} [data-scenario="goods_purchase"]`);
    await page.waitForSelector(`${inv} [data-lines]`);
    await page.fill(`${inv} [data-f="number"]`, number);
    await page.fill(`${inv} [data-acc-query]`, supplier.name);
    await page.waitForSelector(`${inv} .hof-acc-picker li[data-id="${supplier.id}"]`);
    await (await page.$(`${inv} .hof-acc-picker li[data-id="${supplier.id}"]`)).dispatchEvent("mousedown");
    await page.click(`${inv} [data-l="0"][data-f="name"]`);
    await page.keyboard.type("Fren", { delay: 40 });
    await page.waitForSelector(`${inv} [data-hits="0"] li[data-item]`);
    await page.click(`${inv} [data-hits="0"] li[data-item]`);
    await page.click(`${inv} [data-l="0"][data-f="qty"]`);
    await page.keyboard.press("Control+A");
    await page.keyboard.type("2", { delay: 40 });
    await page.click(`${inv} [data-l="0"][data-f="unitPrice"]`);
    await page.keyboard.press("Control+A");
    await page.keyboard.type("100", { delay: 40 });
    await page.waitForTimeout(1200);
  };
  // Kaydet; sunucudan gelen onay sorusu (eksi stok, Kasa eksiye düşecek) "Yine de Kaydet" ile geçilir. Fatura listede
  // görünene ya da formda hata yazana kadar beklenir (en çok ~8 sn).
  const saveAndRead = async number => {
    await page.click(`${inv} [data-act="issue"]`);
    let saved = null;
    let error = "";
    for (let i = 0; i < 16 && !saved; i += 1) {
      await page.waitForTimeout(500);
      const yes = await page.$(`${modal} [data-answer="yes"]`);
      if (yes) {
        await yes.click();
        continue;
      }
      const list = unwrap(await api.get("/api/workspace/invoices?tab=all&limit=100")).invoices || [];
      saved = list.find(d => d.number === number) || null;
      error = await page.$eval(`${inv} [data-form-error]`, n => n.textContent.trim()).catch(() => "");
      if (error) break;
    }
    await shot(`bulgu1-${number}`);
    return { error, saved };
  };
  const purchase = async ({ number, amount, mode, typedAmount = amount }) => {
    await newPurchase(number);
    await page.click(`${inv} [data-act="pay-add-cheque"]`);
    const f = name => `${inv} [data-pay="cheques"][data-i="0"][data-f="${name}"]`;
    await page.selectOption(f("instrument"), "note");
    await page.click(f("amount"));
    await page.keyboard.type(typedAmount, { delay: 60 });
    const trail = [];
    for (const [name, text] of [["dueDate", DUE_TYPED], ["serialNo", `S-${number}`], ["bank", "Ziraat"]]) {
      if (mode === "klavye") {
        await page.keyboard.press("Tab");
        for (let i = 0; i < 3 && name !== "dueDate" && (await focusName()) === "dueDate"; i += 1) await page.keyboard.press("Tab");
      } else if (name === "dueDate") {
        const rect = await (await page.$(f(name))).boundingBox();
        await page.mouse.click(rect.x + 12, rect.y + rect.height / 2);
      } else await page.click(f(name));
      trail.push(await focusName());
      await page.keyboard.type(text, { delay: 60 });
    }
    await page.keyboard.press("Tab");
    await page.waitForTimeout(900);
    const values = await page.evaluate(sel => ["amount", "dueDate", "serialNo", "bank"].map(n => document.querySelector(`${sel} [data-pay="cheques"][data-i="0"][data-f="${n}"]`)?.value), inv);
    const { error, saved } = await saveAndRead(number);
    const notes = (unwrap(await api.get("/api/workspace/cheques?status=all&limit=200")).cheques || []).filter(c => c.serialNo === `S-${number}`);
    await closeAll();
    return { trail, values, error, saved, notes };
  };
  await step("Bulgu 1: alış faturasında senet satırı klavyeyle (Tab) — tam ödeme", async () => {
    const r = await purchase({ number: "K-1", amount: "240", mode: "klavye" });
    ok(r.trail.join(",") === "dueDate,serialNo,bank", `Tab ile Vade → No → Banka sırasıyla gidildi (${r.trail.join(" → ")})`);
    ok(r.values[0] === "240" && r.values[1] === DUE_ISO && r.values[2] === "S-K-1" && r.values[3] === "Ziraat", `alanlar yazıldığı gibi kaldı (${r.values.join(" · ")})`);
    ok(r.saved?.payStateLabel === "Ödendi" && r.saved?.paid === 240, `fatura "Ödendi", ödenen 240 (${r.saved?.payStateLabel} ${r.saved?.paid})`);
    ok(r.notes.length === 1 && r.notes[0].amount === 240, `senet portföyde: 1 adet, 240 (${r.notes.length})`);
  });
  await step("Bulgu 1: kısmi ödeme fareyle", async () => {
    const r = await purchase({ number: "K-2", amount: "100", mode: "fare" });
    ok(r.values[1] === DUE_ISO && r.values[3] === "Ziraat", `vade ve banka kaldı (${r.values.join(" · ")})`);
    ok(r.saved?.paid === 100 && r.saved?.open === 140, `fatura kısmen ödendi: ödenen 100, açık 140 (${r.saved?.paid} / ${r.saved?.open})`);
    ok(r.notes.length === 1, "senet portföyde");
  });
  await step("Bulgu 1: peşin tutar yazılıp fareyle doğrudan Kalan → Vade Tarihi'ne geçilir; tarih kalır", async () => {
    await newPurchase("K-4");
    await page.click(`${inv} [data-act="pay-add-cash"]`);
    await page.click(`${inv} [data-pay="cash"][data-i="0"][data-f="amount"]`);
    await page.keyboard.type("100", { delay: 60 });
    // Tutar kutusundan ayrılmadan doğrudan Kalan kutusundaki Vade Tarihi'nin ay bölümüne tıklanır.
    const due = `${inv} [data-payf="dueDate"]`;
    const rect = await (await page.$(due)).boundingBox();
    await page.mouse.click(rect.x + 12, rect.y + rect.height / 2);
    const focused = await page.evaluate(() => document.activeElement?.dataset?.payf || document.activeElement?.tagName || "");
    await page.keyboard.type(DUE_TYPED, { delay: 60 });
    await page.keyboard.press("Tab");
    await page.waitForTimeout(600);
    const value = await page.$eval(due, n => n.value).catch(() => "");
    const { error, saved } = await saveAndRead("K-4");
    await closeAll();
    ok(focused === "dueDate" && value === DUE_ISO, `Vade Tarihi'ne gidildi ve tarih kaldı (odak ${focused}, değer ${value || "boş"})`);
    ok(saved?.paid === 100 && saved?.open === 140 && saved?.dueDate === DUE_ISO, `fatura: ödenen 100, açık 140, vade ${saved?.dueDate || "yok"}${error ? ` · ${error}` : ""}`);
  });
  await step("Bulgu 1: tutarı geçersiz evrakla kayıt durur (sessizce evraksız kaydedilmez)", async () => {
    const r = await purchase({ number: "K-3", amount: "240", typedAmount: "Ziraat", mode: "klavye" });
    ok(/tutarı geçerli değil|tutarı yazılmadı/.test(r.error), `kayıt durdu, açık neden: "${r.error}"`);
    ok(!r.saved, "fatura kaydedilmedi");
  });

  // ---------- Bulgu 2 (arayüz) ----------
  await step("Bulgu 2: cari kartında Kapatılacak Fatura taksitli faturayı sunmaz", async () => {
    await closeAll();
    await page.click("#hof-sidecard [data-action=accounts]");
    await page.waitForSelector(`${top} input[data-filter="q"]`);
    await page.fill(`${top} input[data-filter="q"]`, "Kapama");
    await page.waitForSelector(`${top} tr[data-account="${customer.id}"]`, { timeout: 10000 });
    await page.click(`${top} tr[data-account="${customer.id}"]`);
    await page.waitForSelector(`${top} [data-entry="in"]`);
    await page.click(`${top} [data-entry="in"]`);
    if (await page.waitForSelector(`${top} [data-plain]`, { timeout: 2000 }).catch(() => null)) await page.click(`${top} [data-plain]`);
    await page.waitForSelector(`${top} form select[name="invoiceId"]`, { timeout: 8000 });
    const options = await page.$$eval(`${top} form select[name="invoiceId"] option`, nodes => nodes.map(n => n.value));
    await shot("bulgu2-kapatilacak-fatura");
    ok(options.includes(openInvoice.id), "açık (taksitsiz) fatura listede");
    ok(!options.includes(plannedInvoice.id), "taksitli fatura listede yok");
    await closeAll();
  });

  // ---------- Bulgu 3 ve 4 ----------
  const reportRequests = [];
  page.on("request", r => {
    const u = new URL(r.url());
    if (u.pathname.startsWith("/api/workspace/report-center") || u.pathname.startsWith("/api/workspace/cheques")) reportRequests.push(u.pathname);
  });
  const openReport = async id => {
    await page.click(`${modal} [data-rc-list] [data-report="${id}"]`);
    await page.waitForTimeout(800);
  };
  const pickAccount = async acc => {
    await page.click(`${main} [data-account-slot] [data-acc-query]`);
    await page.keyboard.type(acc.name.slice(0, 7), { delay: 50 });
    await page.waitForSelector(`${main} [data-account-slot] li[data-id="${acc.id}"]`);
    await page.click(`${main} [data-account-slot] li[data-id="${acc.id}"]`);
    await page.waitForSelector(`${main} .hof-rc-summary`, { timeout: 15000 });
    await page.waitForTimeout(600);
  };
  const summary = () => page.$$eval(`${main} .hof-rc-summary span`, spans => Object.fromEntries(spans.map(s => [s.querySelector("small").innerText.trim(), s.querySelector("b").innerText.trim()])));
  const picked = () => page.$eval(`${main} [data-account-slot] [data-acc-query]`, n => n.value).catch(() => "");
  await step("Bulgu 3: Cari Ekstre — cari seçilip 'Tüm Zamanlar'a basılınca seçim kalır, tek istek gider", async () => {
    await closeAll();
    await page.click("#hof-sidecard [data-action=analytics]");
    await page.waitForSelector(`${modal} .hof-rep-tab[data-tab="all"]`, { timeout: 15000 });
    await page.click(`${modal} .hof-rep-tab[data-tab="all"]`);
    await page.waitForSelector(`${modal} [data-rc-list] [data-report]`, { timeout: 15000 });
    await openReport("cari-ekstre");
    await pickAccount(customer);
    reportRequests.length = 0;
    await page.click(`${main} [data-preset="all"]`);
    await page.waitForTimeout(1500);
    const s = await summary();
    await shot("bulgu3-ekstre-tum-zamanlar");
    ok(await picked() === customer.name, `cari seçimi kaldı ("${await picked()}")`);
    ok(/Borçlu|Alacaklı|Kapalı/.test(s["Dönem Sonu"] || ""), `ekstre görünüyor (Dönem Sonu ${s["Dönem Sonu"]})`);
    ok(reportRequests.length === 1 && reportRequests[0].endsWith("/cari-ekstre"), `tek tıkta tek istek (${reportRequests.join(", ")})`);
  });
  await step("Bulgu 3: Satış Faturaları — cari süzgeci 'Bu Yıl'a basınca kalkmaz", async () => {
    await openReport("fatura-satis");
    await pickAccount(other);
    const before = await summary();
    await page.click(`${main} [data-preset="thisYear"]`);
    await page.waitForTimeout(1500);
    const after = await summary();
    ok(await picked() === other.name, `süzgeç kaldı ("${await picked()}")`);
    ok(before["Satış Faturası"] === "1" && after["Satış Faturası"] === "1", `yalnız bu carinin faturası (${before["Satış Faturası"]} → ${after["Satış Faturası"]})`);
  });
  await step("Bulgu 4: Banka ve POS — Yol = Banka ve Yol = POS rapora uygulanır", async () => {
    await openReport("banka-pos-hareketleri");
    await page.waitForSelector(`${main} [data-param="payMethod"]`);
    await page.selectOption(`${main} [data-param="payMethod"]`, "bank");
    await page.waitForTimeout(1500);
    const scopeBank = await page.$eval(`${main} .hof-rc-scope`, n => n.innerText).catch(() => "");
    const bank = await summary();
    await page.selectOption(`${main} [data-param="payMethod"]`, "card");
    await page.waitForTimeout(1500);
    const scopeCard = await page.$eval(`${main} .hof-rc-scope`, n => n.innerText).catch(() => "");
    const card = await summary();
    await shot("bulgu4-yol-pos");
    ok(/^Banka \(Havale \/ EFT\)/.test(scopeBank) && bank["Dönem Giriş"] === "300,00 TL", `Banka: ${scopeBank} · giriş ${bank["Dönem Giriş"]}`);
    ok(/^POS \/ Kredi Kartı/.test(scopeCard) && card["Dönem Giriş"] === "700,00 TL", `POS: ${scopeCard} · giriş ${card["Dönem Giriş"]}`);
  });
  ok(!errors.length, `sayfa hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`✗ senaryo durdu: ${error.stack || error.message}`);
} finally {
  await browser.close();
  await app.close();
}
console.log(`\n${failed ? "BAŞARISIZ" : "TAMAM"}: ${passed} denetim geçti, ${failed} başarısız.`);
process.exitCode = failed ? 1 : 0;
