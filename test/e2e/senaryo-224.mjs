// Senaryo 2.0.24 — ertelenen alan düzeltmeleri, arayüzden (kullanıcı gibi tıklayarak; sayılar ekrandan okunur, API ile doğrulanır):
//  1. Taksitli satış (3 × 1.000, 3 taksit) + aynı cariye taksitsiz açık satış (2.000) → fatura kartından 1 adet Satıştan İade →
//     Taksitler'de faturanın kendi kartı Kalan 2.000; öbür fatura Açık 2.000; cari bakiye 4.000. İade iptal edilince kart 3.000.
//  5. İade avansa taşmış taksit kartında (tahsilat 2.500, iade 1.000) tahsilat silinir → kart Kalan = fatura Açık (2.000).
//  3. Raporlar → Cari Mizanı → Bakiye "Geciken Taksiti Olan" → yalnız geciken taksiti olan cari listelenir.
//  4. Raporlar → Ürün Satış Kârlılığı → özet "Brüt Kâr (Stoklu Ürünler)" = TOPLAM satırının Brüt Kâr'ı; hizmet satışı ayrı satır.
//  2. Çek/Senet: ileri tarihli Tahsil Et reddedilir (ekranda neden, Kasa aynı); dönem kilidinden önce tahsil edilmiş çekte
//     Geri Al reddedilir (durum aynı); kilit kaldırılınca Geri Al çalışır.
// Hareket tarihleri bugünden geriye, kronolojik artan (fatura serisi kuralı); hiçbiri ileri tarihli değil.
// Çalıştırma: npm run test:senaryo-224
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient } from "../helpers.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-224");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-224-"));
const pad = v => String(v).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const now = new Date();
const TODAY = iso(now);
const day = offset => iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset));
const FUTURE_DUE = day(30); // vade (hareket değil): ileri olabilir
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f24" } });
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
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const inv = `${modal} .hof-invoices-modal`;
const main = `${modal} [data-rc-main]`;
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
// "2.000,00 TL", "4.000,00 TL Borçlu" → 2000 / 4000. Ekrandan okunan para metni.
const moneyOf = text => {
  const m = String(text || "").replace(/\u2212/g, "-").match(/-?[\d.]+,\d{2}/);
  return m ? Number(m[0].replace(/\./g, "").replace(",", ".")) : NaN;
};
const tl = n => `${Number(n).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const closeAll = async () => {
  for (let i = 0; i < 8 && (await page.$(modal)); i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const yes = await page.$(`${modal} [data-answer="yes"]`);
    if (yes) await yes.click();
  }
};
// Onay sorusu (eksi stok, Kasa eksiye düşecek, …) varsa "Evet" ile geçilir.
const answerYes = async () => {
  const yes = await page.$(`${modal} [data-answer="yes"]`);
  if (yes) {
    await yes.click();
    return true;
  }
  return false;
};

// --- API okumaları (ekranla karşılaştırma için) ---
const invoiceApi = id => must("fatura oku", api.get(`/api/workspace/invoices/${id}`));
const cardApi = async id => (await must("kart oku", api.get(`/api/workspace/plans/${id}`))).totals;
const balanceApi = async acc => (await must("cari oku", api.get(`/api/workspace/accounts?status=all&limit=50&q=${encodeURIComponent(acc.name)}`))).accounts.find(a => a.id === acc.id)?.balance;
const cashApi = async () => (await must("kasa", api.get("/api/workspace/cash?method=cash"))).totals.balance;
const chequeApi = id => must("çek oku", api.get(`/api/workspace/cheques/${id}`));

// --- Ekran yardımcıları ---
const openInvoices = async () => {
  await closeAll();
  await page.click("#hof-sidecard [data-action=invoices]");
  await page.waitForSelector(`${inv} [data-act="new"]`, { timeout: 15000 });
};
const openInvoiceCard = async (id, tab = "") => {
  await openInvoices();
  if (tab) {
    const tabButton = await page.$(`${inv} [data-tab="${tab}"]`);
    if (tabButton) await tabButton.click();
  }
  await page.waitForSelector(`${inv} tr[data-inv="${id}"]`, { timeout: 15000 });
  await page.click(`${inv} tr[data-inv="${id}"]`);
  await page.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 15000 });
  await page.waitForTimeout(400);
};
const invoiceOpenOnScreen = async () => {
  const text = await page.$eval(`${inv} .hof-inv-pay .hof-inv-rest`, n => n.innerText).catch(() => "");
  return { text, open: /Açık:/.test(text) ? moneyOf(text.split("Açık:")[1]) : /Ödendi|Kapandı/.test(text) ? 0 : NaN };
};
const openPlans = async query => {
  await closeAll();
  await page.click("#hof-sidecard [data-action=plans]");
  await page.waitForSelector(`${top} input[data-filter="q"]`, { timeout: 15000 });
  // "Tümü" sekmesi: kalanı 0 olan (Biten) kart da listelensin.
  await page.click(`${top} .hof-tabs [data-status="all"]`);
  await page.waitForTimeout(400);
  await page.fill(`${top} input[data-filter="q"]`, query);
};
// Taksitler listesinde kartın satırı (Toplam, Ödenen, Kalan) ve kart açılınca KPI "Kalan".
const planOnScreen = async (planId, query) => {
  await openPlans(query);
  await page.waitForSelector(`${top} tr[data-plan="${planId}"]`, { timeout: 15000 });
  await page.waitForTimeout(500);
  const cells = await page.$$eval(`${top} tr[data-plan="${planId}"] td`, tds => tds.map(td => td.innerText.trim()));
  await page.click(`${top} tr[data-plan="${planId}"]`);
  await page.waitForSelector(`${top} .hof-plans-items, ${top} [data-act="edit"]`, { timeout: 15000 });
  await page.waitForTimeout(500);
  const kpis = await page.$$eval(`${top} .hof-plans-kpis > div`, divs => divs.map(d => ({ label: d.querySelector("span")?.innerText.trim() || "", value: d.querySelector("strong")?.innerText.trim() || "" })));
  const kalan = kpis.find(k => /^Kalan/.test(k.label));
  return { listRemaining: moneyOf(cells[4]), cardRemaining: moneyOf(kalan?.value), cells, kpis };
};
const accountBalanceOnScreen = async acc => {
  await closeAll();
  await page.click("#hof-sidecard [data-action=accounts]");
  await page.waitForSelector(`${top} input[data-filter="q"]`, { timeout: 15000 });
  await page.fill(`${top} input[data-filter="q"]`, acc.name);
  await page.waitForSelector(`${top} tr[data-account="${acc.id}"]`, { timeout: 15000 });
  await page.waitForTimeout(500);
  const text = await page.$eval(`${top} tr[data-account="${acc.id}"] .hof-acc-balance`, n => n.innerText.replace(/\s+/g, " ").trim());
  return { text, amount: moneyOf(text), side: /Borçlu/.test(text) ? "Borçlu" : /Alacaklı/.test(text) ? "Alacaklı" : "" };
};
const openCheques = async () => {
  await closeAll();
  await page.click("#hof-sidecard [data-action=cheques]");
  await page.waitForSelector(`${modal} [data-act="new-in"]`, { timeout: 15000 });
};
const openChequeCard = async id => {
  await openCheques();
  // "Tüm Durumlar": tahsil edilmiş evrak da listelensin (varsayılan süzgeç yalnız açık evrak).
  await page.selectOption(`${modal} select[data-filter="status"]`, "");
  await page.waitForSelector(`${modal} tr[data-cheque="${id}"]`, { timeout: 15000 });
  await page.click(`${modal} tr[data-cheque="${id}"]`);
  await page.waitForSelector(`${modal} .hof-chq-actions`, { timeout: 15000 });
  await page.waitForTimeout(300);
};
const chequeStatusOnScreen = () => page.$eval(`${modal} .hof-plan-title h3`, n => n.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
// Çek / Senet Al formu ekrandan: cari seçilir, tutar, vade, alış tarihi, no, banka yazılır, "Portföye Al".
const receiveCheque = async ({ acc, amount, issueDate, dueDate, serialNo }) => {
  await openCheques();
  await page.click(`${modal} [data-act="new-in"]`);
  await page.waitForSelector(`${top} form input[name="amount"]`);
  await page.click(`${top} form [data-acc-query]`);
  await page.keyboard.type(acc.name.slice(0, 8), { delay: 40 });
  await page.waitForSelector(`${top} li[data-id="${acc.id}"]`, { timeout: 10000 });
  await (await page.$(`${top} li[data-id="${acc.id}"]`)).dispatchEvent("mousedown");
  await page.fill(`${top} form input[name="amount"]`, amount);
  await page.fill(`${top} form input[name="dueDate"]`, dueDate);
  await page.fill(`${top} form input[name="issueDate"]`, issueDate);
  await page.fill(`${top} form input[name="serialNo"]`, serialNo);
  await page.fill(`${top} form input[name="bank"]`, "Ziraat Meram");
  await page.click(`${top} form button[type="submit"]`);
  let saved = null;
  for (let i = 0; i < 20 && !saved; i += 1) {
    await page.waitForTimeout(400);
    if (await answerYes()) continue;
    saved = (unwrap(await api.get("/api/workspace/cheques?status=all&limit=200")).cheques || []).find(c => c.serialNo === serialNo) || null;
  }
  await page.waitForSelector(`${modal} .hof-chq-actions`, { timeout: 10000 });
  return saved;
};
// Evrak kartında işlem formu (Tahsil Et): tarih ve hesap seçilir, kaydedilir; formdaki hata metni döner.
const chequeAction = async ({ action, date, method }) => {
  await page.click(`${modal} .hof-chq-actions [data-action="${action}"]`);
  await page.waitForSelector(`${top} form input[name="date"]`);
  await page.fill(`${top} form input[name="date"]`, date);
  if (method) await page.selectOption(`${top} form select[name="method"]`, method);
  await page.click(`${top} form button[type="submit"]`);
  let error = "";
  for (let i = 0; i < 16; i += 1) {
    await page.waitForTimeout(300);
    if (await answerYes()) continue;
    error = await page.$eval(`${top} form .hof-form-error`, n => n.textContent.trim()).catch(() => "");
    if (error) break;
    if (!(await page.$(`${top} form input[name="date"]`))) break; // form kapandı → kaydedildi
  }
  return error;
};
// Önceki bildirimler kapatılır (× düğmesi); sonraki okuma yalnız yeni işlemin bildirimini görür.
const closeToasts = async () => {
  for (const button of await page.$$(".hof-toast .hof-toast-close")) await button.click().catch(() => null);
  await page.waitForTimeout(150);
};
const lastToast = async pattern => {
  for (let i = 0; i < 20; i += 1) {
    const texts = await page.$$eval(".hof-toast .hof-toast-text", nodes => nodes.map(n => n.textContent.trim()));
    const hit = texts.find(t => pattern.test(t));
    if (hit) return hit;
    await page.waitForTimeout(250);
  }
  return (await page.$$eval(".hof-toast .hof-toast-text", nodes => nodes.map(n => n.textContent.trim()))).join(" | ");
};

try {
  await api.login("admin", PASS);
  // ---------- Kurulum (API; test edilen işlemler aşağıda ekrandan) ----------
  const supplier = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Toptan Tedarikçi", type: "supplier", registeredOn: "2025-01-01" }));
  const service = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "HZM", name: "Danışmanlık Hizmeti", unit: "Adet", salePrice: "1000" }));
  const goods = await must("ürün", api.post("/api/workspace/stock", { kind: "product", code: "VB-1", name: "Vida Bilezik", unit: "Adet", unitPrice: 100, salePrice: 150 }));
  const accOf = name => must(`cari ${name}`, api.post("/api/workspace/accounts", { name, type: "customer", registeredOn: "2025-01-01" }));
  const lateAcc = await accOf("Geciken Müşteri");
  const profitAcc = await accOf("Kârlılık Müşteri");
  const returnAcc = await accOf("İade Müşteri");
  const advanceAcc = await accOf("Avans Müşteri");
  const chequeAcc = await accOf("Çek Müşteri");
  const serviceSale = (acc, date, qty, payment) => must("satış", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ itemId: service.id, qty, unitPrice: 1000, vatRate: 0 }], payment }));
  const installments = firstDue => ({ rest: "installments", installments: { count: 3, firstDue, everyMonths: 1 } });

  await must("stok alışı", api.post("/api/workspace/invoices", { scenario: "goods_purchase", accountId: supplier.id, issueDate: day(-40), number: "TDR-1", lines: [{ itemId: goods.id, qty: 10, unitPrice: 100, vatRate: 0 }], payment: { rest: "open", dueDate: FUTURE_DUE } }));
  // Geciken: ilk taksit 30 gün önce vadeli, ödenmedi.
  await serviceSale(lateAcc, day(-35), 3, installments(day(-30)));
  // Stoklu ürün satışı: 2 × 150, maliyet 2 × 100 → brüt kâr 100.
  await must("ürün satışı", api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: profitAcc.id, issueDate: day(-30), lines: [{ itemId: goods.id, qty: 2, unitPrice: 150, vatRate: 0 }], payment: { rest: "open", dueDate: FUTURE_DUE } }));
  // Senaryo 1: taksitli 3 × 1.000 + taksitsiz açık 2.000 (aynı cari).
  const plannedDoc = await invoiceApi((await serviceSale(returnAcc, day(-20), 3, installments(FUTURE_DUE))).id);
  const openDoc = await invoiceApi((await serviceSale(returnAcc, day(-19), 2, { rest: "open", dueDate: FUTURE_DUE })).id);
  // Senaryo 5: taksitli 3 × 1.000, kart tahsilatı 2.500, 1 adet iade → iade açığı (500) aşar, 500 avans, kart 0.
  const advanceDoc = await invoiceApi((await serviceSale(advanceAcc, day(-18), 3, installments(FUTURE_DUE))).id);
  const advancePay = await must("taksit tahsilatı", api.post(`/api/workspace/plans/${advanceDoc.planId}/entries`, { kind: "in", amount: 2500, date: day(-17), method: "cash" }));
  await must("avans iadesi", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: advanceDoc.id, issueDate: day(-16), lines: [{ originLineId: advanceDoc.lines[0].id, qty: 1 }], payment: {} }));
  {
    const [o, k] = [await invoiceApi(advanceDoc.id), await cardApi(advanceDoc.planId)];
    ok(o.open === 0 && k.remaining === 0 && (await balanceApi(advanceAcc)) === -500, `kurulum: avans faturası açık ${o.open}, kart kalan ${k.remaining}, bakiye ${await balanceApi(advanceAcc)} (beklenen 0 / 0 / −500)`);
  }

  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard [data-action=invoices]", { timeout: 60000 });
  await page.waitForTimeout(1200);

  // ---------- 1. Taksitli faturadan iade ----------
  let returnId = "";
  await step("1a. Taksitli satış faturasının kartından 1 adet Satıştan İade (ekrandan)", async () => {
    await openInvoiceCard(plannedDoc.id);
    const disabled = await page.$eval(`${inv} [data-act="return"]`, n => n.disabled);
    ok(!disabled, "fatura kartında İade düğmesi açık");
    await page.click(`${inv} [data-act="return"]`);
    await page.waitForSelector(`${inv} [data-l="0"][data-f="qty"]`, { timeout: 15000 });
    const offered = await page.$eval(`${inv} [data-l="0"][data-f="qty"]`, n => n.value);
    ok(offered === "3", `iade formu kalan iade edilebilir miktarı önerir (${offered}; beklenen 3)`);
    await page.click(`${inv} [data-l="0"][data-f="qty"]`);
    await page.keyboard.press("Control+A");
    await page.keyboard.type("1", { delay: 40 });
    await page.keyboard.press("Tab");
    await page.waitForTimeout(1500);
    const restText = await page.$eval(`${inv} [data-pay-rest]`, n => n.innerText.trim()).catch(() => "");
    ok(/1\.000,00/.test(restText) && /bakiyesinden düşülür/.test(restText), `iade tutarı 1.000 carinin bakiyesinden düşülecek ("${restText}")`);
    await shot("1-iade-formu");
    await page.click(`${inv} [data-act="issue"]`);
    let ret = null;
    for (let i = 0; i < 24 && !ret; i += 1) {
      await page.waitForTimeout(500);
      if (await answerYes()) continue;
      const list = unwrap(await api.get("/api/workspace/invoices?tab=returns&limit=100")).invoices || [];
      ret = list.find(d => d.originalId === plannedDoc.id && d.status === "issued") || null;
      const error = await page.$eval(`${inv} [data-form-error]`, n => n.textContent.trim()).catch(() => "");
      if (error) {
        ok(false, `iade kaydedilemedi: ${error}`);
        break;
      }
    }
    await page.waitForTimeout(800);
    await shot("1-iade-kaydedildi");
    returnId = ret?.id || "";
    ok(Boolean(ret) && ret.tryPayable === 1000, `iade faturası kaydedildi: ${ret?.displayNo || ret?.number || "yok"} · ${ret?.tryPayable}`);
  });
  await step("1b. Taksitler: faturanın kendi kartı Kalan 2.000; öbür fatura Açık 2.000; cari bakiye 4.000 (ekrandan)", async () => {
    const card = await planOnScreen(plannedDoc.planId, returnAcc.name);
    await shot("1-taksit-karti-iade-sonrasi");
    ok(card.listRemaining === 2000, `Taksitler listesinde kartın Kalan'ı ${tl(card.listRemaining)} (beklenen 2.000,00)`);
    ok(card.cardRemaining === 2000, `kart açılınca Kalan ${tl(card.cardRemaining)} (beklenen 2.000,00)`);
    await openInvoiceCard(openDoc.id);
    const other = await invoiceOpenOnScreen();
    await shot("1-obur-fatura");
    ok(other.open === 2000, `taksitsiz fatura ekranda "${other.text}" (beklenen Açık 2.000,00)`);
    await openInvoiceCard(plannedDoc.id);
    const own = await invoiceOpenOnScreen();
    ok(own.open === 2000, `taksitli fatura ekranda "${own.text}" (beklenen Açık 2.000,00)`);
    const bal = await accountBalanceOnScreen(returnAcc);
    await shot("1-cari-bakiye");
    ok(bal.amount === 4000 && bal.side === "Borçlu", `Cari listesinde bakiye "${bal.text}" (beklenen 4.000,00 Borçlu)`);
    const [o, k, x, b] = [await invoiceApi(plannedDoc.id), await cardApi(plannedDoc.planId), await invoiceApi(openDoc.id), await balanceApi(returnAcc)];
    ok(o.open === 2000 && k.remaining === 2000 && x.open === 2000 && b === 4000, `API ile aynı: fatura açık ${o.open}, kart ${k.remaining}, öbür ${x.open}, bakiye ${b}`);
  });
  await step("1c. İade faturası ekrandan iptal edilir → kart Kalan 3.000, bakiye 5.000", async () => {
    if (!returnId) throw new Error("iade faturası yok (1a başarısız)");
    await openInvoiceCard(plannedDoc.id);
    await page.waitForSelector(`${inv} .hof-inv-pay [data-open-invoice="${returnId}"]`, { timeout: 10000 });
    await page.click(`${inv} .hof-inv-pay [data-open-invoice="${returnId}"]`);
    // İade kartı: "Asıl Fatura" pili asıl faturayı gösterir (asıl faturanın kartı değil).
    await page.waitForSelector(`${inv} .hof-inv-pills [data-open-invoice="${plannedDoc.id}"]`, { timeout: 10000 });
    await page.waitForSelector(`${inv} [data-act="cancel"]`, { timeout: 10000 });
    const disabled = await page.$eval(`${inv} [data-act="cancel"]`, n => n.disabled);
    ok(!disabled, "iade kartında İptal Et açık");
    await page.click(`${inv} [data-act="cancel"]`);
    await page.waitForSelector(`${top} form input[name="reason"]`);
    await page.fill(`${top} form input[name="reason"]`, "Senaryo: iade yanlış girildi");
    await page.click(`${top} form button[type="submit"]`);
    let cancelled = false;
    for (let i = 0; i < 20 && !cancelled; i += 1) {
      await page.waitForTimeout(400);
      if (await answerYes()) continue;
      cancelled = (await invoiceApi(returnId)).status === "cancelled";
    }
    await page.waitForTimeout(600);
    await shot("1-iade-iptal");
    const banner = await page.$eval(`${inv} .hof-inv-banner.is-cancelled`, n => n.innerText).catch(() => "");
    ok(cancelled && /iptal edildi/.test(banner), `iade iptal edildi; kartta "${banner.slice(0, 60)}…"`);
    const card = await planOnScreen(plannedDoc.planId, returnAcc.name);
    await shot("1-taksit-karti-iptal-sonrasi");
    ok(card.listRemaining === 3000 && card.cardRemaining === 3000, `kart Kalan liste ${tl(card.listRemaining)} · kart ${tl(card.cardRemaining)} (beklenen 3.000,00)`);
    const bal = await accountBalanceOnScreen(returnAcc);
    ok(bal.amount === 5000 && bal.side === "Borçlu", `cari bakiye "${bal.text}" (beklenen 5.000,00 Borçlu)`);
    const [o, x] = [await invoiceApi(plannedDoc.id), await invoiceApi(openDoc.id)];
    ok(o.open === 3000 && x.open === 2000, `API: taksitli fatura açık ${o.open} (3.000), öbür ${x.open} (2.000)`);
  });

  // ---------- 5. İade avansa taşmışken taksit tahsilatı silinir ----------
  await step("5. Avansa taşmış iadeden sonra taksit kartında tahsilat ekrandan silinir → kart Kalan = fatura Açık", async () => {
    const before = await planOnScreen(advanceDoc.planId, advanceAcc.name);
    ok(before.cardRemaining === 0, `silmeden önce kart Kalan ${tl(before.cardRemaining)} (beklenen 0,00)`);
    const row = `${top} tr[data-entry="${advancePay.entryId}"]`;
    await page.waitForSelector(row, { timeout: 10000 });
    const rowText = await page.$eval(row, n => n.innerText.replace(/\s+/g, " "));
    ok(/2\.500,00/.test(rowText), `silinecek satır tahsilat 2.500 ("${rowText.slice(0, 70)}")`);
    await shot("5-kart-silmeden-once");
    await closeToasts();
    await page.click(`${row} [data-delete-entry]`);
    await page.waitForSelector(`${modal} [data-answer="yes"]`);
    await page.click(`${modal} [data-answer="yes"]`);
    await page.waitForFunction(id => !document.querySelector(`tr[data-entry="${id}"]`), advancePay.entryId, { timeout: 10000 }).catch(() => null);
    const toast = await lastToast(/silindi|Silin|hata|olmaz|edilemez/i);
    ok(/Hareket silindi/.test(toast), `bildirim: "${toast}"`);
    await page.waitForTimeout(800);
    const kpis = await page.$$eval(`${top} .hof-plans-kpis > div`, divs => divs.map(d => ({ label: d.querySelector("span")?.innerText.trim() || "", value: d.querySelector("strong")?.innerText.trim() || "" })));
    const cardRemaining = moneyOf(kpis.find(k => /^Kalan/.test(k.label))?.value);
    await shot("5-kart-silindikten-sonra");
    await openInvoiceCard(advanceDoc.id);
    const docOpen = await invoiceOpenOnScreen();
    await shot("5-fatura-acik");
    ok(cardRemaining === docOpen.open, `kart Kalan ${tl(cardRemaining)} = fatura "${docOpen.text}"`);
    ok(cardRemaining === 2000, `ikisi de 2.000,00 (3.000 − 1.000 iade; tahsilat yok)`);
    const bal = await accountBalanceOnScreen(advanceAcc);
    ok(bal.amount === 2000 && bal.side === "Borçlu", `cari bakiye "${bal.text}" (beklenen 2.000,00 Borçlu)`);
    const [o, k] = [await invoiceApi(advanceDoc.id), await cardApi(advanceDoc.planId)];
    ok(o.open === 2000 && k.remaining === 2000, `API: fatura açık ${o.open}, kart kalan ${k.remaining}`);
  });

  // ---------- 3 ve 4. Raporlar ----------
  const openReport = async id => {
    await page.click(`${modal} [data-rc-list] [data-report="${id}"]`);
    await page.waitForSelector(`${main} .hof-rc-summary`, { timeout: 15000 });
    await page.waitForTimeout(600);
  };
  const summary = () => page.$$eval(`${main} .hof-rc-summary span`, spans => Object.fromEntries(spans.map(s => [s.querySelector("small").innerText.trim(), s.querySelector("b").innerText.trim()])));
  const tableRows = () => page.$$eval(`${main} .hof-rc-table tbody tr`, trs => trs.map(tr => [...tr.querySelectorAll("td")].map(td => td.textContent.trim())));
  const headers = () => page.$$eval(`${main} .hof-rc-table thead th`, ths => ths.map(th => th.textContent.trim()));
  const footer = () => page.$$eval(`${main} .hof-rc-table tfoot td`, tds => tds.map(td => td.textContent.trim()));
  const waitScope = async pattern => {
    for (let i = 0; i < 30; i += 1) {
      const scope = await page.$eval(`${main} .hof-rc-scope`, n => n.innerText).catch(() => "");
      if (pattern.test(scope)) return scope;
      await page.waitForTimeout(250);
    }
    return page.$eval(`${main} .hof-rc-scope`, n => n.innerText).catch(() => "");
  };
  await step("3. Cari Mizanı → Bakiye: Geciken Taksiti Olan → yalnız geciken taksiti olan cari", async () => {
    await closeAll();
    await page.click("#hof-sidecard [data-action=analytics]");
    await page.waitForSelector(`${modal} .hof-rep-tab[data-tab="all"]`, { timeout: 15000 });
    await page.click(`${modal} .hof-rep-tab[data-tab="all"]`);
    await page.waitForSelector(`${modal} [data-rc-list] [data-report]`, { timeout: 15000 });
    await openReport("mizan");
    await page.click(`${main} [data-preset="all"]`);
    await page.waitForTimeout(1200);
    const allRows = await tableRows();
    // Hareketi olan 5 cari (Çek Müşteri'nin henüz hareketi yok): tedarikçi, geciken, kârlılık, iade, avans.
    ok(allRows.length === 5, `süzgeçsiz mizanda ${allRows.length} cari (${allRows.map(r => r[1]).join(", ")})`);
    await page.selectOption(`${main} [data-param="side"]`, "overdue");
    const scope = await waitScope(/Geciken/);
    await page.waitForTimeout(500);
    const rows = await tableRows();
    const s = await summary();
    await shot("3-mizan-geciken");
    const names = rows.map(r => r[1]);
    ok(/Geciken/.test(scope), `rapor kapsamında süzgeç yazıyor ("${scope}")`);
    ok(names.length === 1 && names[0] === lateAcc.name, `yalnız geciken taksiti olan cari listelendi (${names.join(", ") || "boş"})`);
    ok(s["Cari Sayısı"] === "1", `özet Cari Sayısı ${s["Cari Sayısı"]} (beklenen 1)`);
    ok(moneyOf(rows[0]?.[6]) === 3000, `Geciken Müşteri bakiyesi ${rows[0]?.[6]} (beklenen 3.000,00)`);
    const apiData = await must("mizan geciken", api.get("/api/workspace/report-center/mizan?preset=all&side=overdue"));
    ok(apiData.rows.length === 1 && apiData.rows[0][1] === lateAcc.name, `API aynı (${apiData.rows.map(r => r[1]).join(", ")})`);
  });
  await step("4. Ürün Satış Kârlılığı → özet Brüt Kâr (Stoklu Ürünler) = TOPLAM Brüt Kâr; Hizmet Satışı (Maliyetsiz) ayrı", async () => {
    await openReport("urun-satis-karlilik");
    await page.click(`${main} [data-preset="all"]`);
    await page.waitForTimeout(1500);
    const s = await summary();
    const h = await headers();
    const f = await footer();
    const rows = await tableRows();
    await shot("4-karlilik");
    const col = name => h.indexOf(name);
    const footGross = moneyOf(f[col("Brüt Kâr")]);
    const footNet = moneyOf(f[col("Net Satış")]);
    const sumGross = moneyOf(s["Brüt Kâr (Stoklu Ürünler)"]);
    ok(/^TOPLAM$/i.test(f[0] || ""), `tablonun altında TOPLAM satırı (${f.join(" | ")})`);
    ok(sumGross === footGross, `özet Brüt Kâr (Stoklu Ürünler) ${s["Brüt Kâr (Stoklu Ürünler)"]} = TOPLAM Brüt Kâr ${f[col("Brüt Kâr")]}`);
    ok(sumGross === 100, `brüt kâr bağımsız hesapla aynı: 2 × (150 − 100) = 100 (${tl(sumGross)})`);
    // Hizmet: Geciken 3.000 + İade Müşteri 3.000 + 2.000 + Avans 3.000 − Avans iadesi 1.000 (iptal edilen iade sayılmaz) = 10.000.
    ok(moneyOf(s["Hizmet Satışı (Maliyetsiz)"]) === 10000, `özet Hizmet Satışı (Maliyetsiz) ${s["Hizmet Satışı (Maliyetsiz)"] || "yok"} (beklenen 10.000,00)`);
    ok(moneyOf(s["Net Satış"]) === footNet && footNet === 10300, `özet Net Satış ${s["Net Satış"]} = TOPLAM ${f[col("Net Satış")]} (beklenen 10.300,00)`);
    const serviceRow = rows.find(r => r[1] === service.name);
    ok(serviceRow && serviceRow[col("Brüt Kâr")] === "" && serviceRow[col("Maliyet")] === "", `hizmet satırında maliyet/kâr boş (${serviceRow?.join(" | ")})`);
  });

  // ---------- 2. Çek/Senet: ileri tarihli tahsil, dönem kilidi ----------
  await step("2a. Çek ekrandan alınır; ileri tarihli Tahsil Et reddedilir, neden ekranda, durum ve Kasa aynı", async () => {
    const cash0 = await cashApi();
    const ch = await receiveCheque({ acc: chequeAcc, amount: "1500", issueDate: TODAY, dueDate: day(45), serialNo: "CK-224-A" });
    ok(ch && ch.amount === 1500 && ch.status === "portfolio", `çek portföyde: ${ch?.serialNo} ${ch?.amount} ${ch?.status}`);
    const bal = await accountBalanceOnScreen(chequeAcc);
    ok(bal.amount === 1500 && bal.side === "Alacaklı", `çeki veren cari "${bal.text}" (beklenen 1.500,00 Alacaklı)`);
    await openChequeCard(ch.id);
    const error = await chequeAction({ action: "collect", date: day(5), method: "cash" });
    await shot("2-ileri-tarihli-tahsil");
    ok(/İleri tarihli/.test(error), `formda neden yazıyor: "${error}"`);
    await page.click(`${top} form [data-cancel]`).catch(() => null);
    await page.waitForTimeout(300);
    await openChequeCard(ch.id);
    const status = await chequeStatusOnScreen();
    ok(/Portföy/i.test(status), `kartta durum değişmedi ("${status}")`);
    const [c, cash1] = [await chequeApi(ch.id), await cashApi()];
    ok(c.status === "portfolio" && cash1 === cash0, `API: durum ${c.status}, Nakit Kasa ${tl(cash0)} → ${tl(cash1)}`);
  });
  await step("2b. Tahsil edilmiş çek, dönem kilitlenince Geri Al reddedilir; kilit kalkınca geri alınır", async () => {
    const ch = await receiveCheque({ acc: chequeAcc, amount: "800", issueDate: day(-12), dueDate: day(20), serialNo: "CK-224-B" });
    ok(ch && ch.status === "portfolio" && ch.issueDate === day(-12), `ikinci çek portföyde, alış ${ch?.issueDate}`);
    const cash0 = await cashApi();
    await openChequeCard(ch.id);
    const error = await chequeAction({ action: "collect", date: day(-10), method: "cash" });
    ok(!error, `geçmiş tarihli (${day(-10)}) tahsil kaydedildi${error ? `: ${error}` : ""}`);
    const cash1 = await cashApi();
    const collected = await chequeApi(ch.id);
    ok(collected.status === "collected" && cash1 === cash0 + 800, `tahsil edildi, Nakit Kasa +800 (${tl(cash0)} → ${tl(cash1)})`);
    // Yönetim → Sistem → Dönem Kilidi (tahsil tarihinden sonraki gün kilitlenir).
    const admin = await context.newPage();
    admin.on("pageerror", e => errors.push(`admin pageerror ${e.message}`));
    try {
      await admin.goto(`${BASE}/admin.html#system`, { waitUntil: "load" });
      await admin.click('.adm-tabs [data-tab="system"]');
      await admin.waitForFunction(() => /Kilitli dönem yok/.test(document.querySelector("#adm-period-status")?.textContent || ""), null, { timeout: 10000 });
      await admin.fill("#adm-period-date", day(-8));
      await admin.click("#adm-period-save");
      await admin.waitForFunction(() => /ve öncesi kilitli/.test(document.querySelector("#adm-period-status")?.textContent || ""), null, { timeout: 10000 });
      const lockText = await admin.textContent("#adm-period-status");
      await shot("2-donem-kilidi", admin);
      ok((await must("kilit", api.get("/api/workspace/ledger/lock"))).lockedUntil === day(-8), `kilitlendi: ${lockText}`);

      await openChequeCard(ch.id);
      const undoButton = await page.$(`${modal} .hof-chq-actions [data-act="undo"]`);
      ok(Boolean(undoButton), "kartta Geri Al düğmesi var");
      await closeToasts();
      await page.click(`${modal} .hof-chq-actions [data-act="undo"]`);
      await page.waitForSelector(`${modal} [data-answer="yes"]`);
      await page.click(`${modal} [data-answer="yes"]`);
      const toast = await lastToast(/kilitli|geri alındı/);
      await shot("2-kilitli-geri-al");
      ok(/kilitli/.test(toast) && !/geri alındı/.test(toast), `ekranda ret nedeni: "${toast}"`);
      // Ret nedeni kullanıcıya okunur görünmeli: bildirimin ortasındaki noktada en üstte bildirimin kendisi olmalı
      // (pencerenin bulanık arka planının altında kalmamalı).
      const onTop = await page.evaluate(() => {
        const node = [...document.querySelectorAll(".hof-toast-error")].at(-1);
        if (!node) return { found: false };
        const r = node.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { found: true, onTop: Boolean(hit && node.contains(hit)), cover: hit ? `${hit.tagName.toLowerCase()}.${[...hit.classList].join(".")}` : "" };
      });
      ok(onTop.found && onTop.onTop, `ret bildirimi pencerenin üstünde, okunur (${onTop.onTop ? "en üstte" : `üstünü örten: ${onTop.cover || "bildirim yok"}`})`);
      await openChequeCard(ch.id);
      const status = await chequeStatusOnScreen();
      ok(/Tahsil Edildi/i.test(status), `kartta durum aynı ("${status}")`);
      const [c, cash2] = [await chequeApi(ch.id), await cashApi()];
      ok(c.status === "collected" && cash2 === cash1, `API: durum ${c.status}, Nakit Kasa ${tl(cash2)} (değişmedi)`);
    } finally {
      // Kilit kaldırılır (Yönetim ekranından).
      await admin.bringToFront().catch(() => null);
      await admin.click("#adm-period-clear").catch(() => null);
      await admin.waitForSelector('.hof-modal-backdrop.is-visible [data-answer="yes"]', { timeout: 5000 }).then(() => admin.click('.hof-modal-backdrop.is-visible [data-answer="yes"]')).catch(() => null);
      await admin.waitForFunction(() => /Kilitli dönem yok/.test(document.querySelector("#adm-period-status")?.textContent || ""), null, { timeout: 10000 }).catch(() => null);
      const lock = (await must("kilit", api.get("/api/workspace/ledger/lock"))).lockedUntil;
      if (lock) await api.put("/api/admin/period-lock", { lockedUntil: "" });
      ok(!lock, `kilit ekrandan kaldırıldı (${await admin.textContent("#adm-period-status").catch(() => "?")})`);
      await admin.close();
      await page.bringToFront();
    }
    await openChequeCard(ch.id);
    await closeToasts();
    await page.click(`${modal} .hof-chq-actions [data-act="undo"]`);
    await page.waitForSelector(`${modal} [data-answer="yes"]`);
    await page.click(`${modal} [data-answer="yes"]`);
    const toast = await lastToast(/geri alındı|kilitli/);
    await page.waitForTimeout(600);
    await shot("2-kilit-kalkinca-geri-al");
    const [c, cash3] = [await chequeApi(ch.id), await cashApi()];
    ok(/geri alındı/.test(toast) && c.status === "portfolio" && cash3 === cash0, `kilit kalkınca geri alındı: "${toast}", durum ${c.status}, Nakit Kasa ${tl(cash3)} (tahsil öncesi ${tl(cash0)})`);
  });

  await step("Mutabakat", async () => {
    const result = await must("mutabakat", api.get("/api/workspace/ledger/integrity"));
    ok(result.ok, `ana defter ↔ Kasa/Cari/Stok/Taksit/Çek tutarlı${result.ok ? "" : `: ${JSON.stringify(result.failures).slice(0, 300)}`}`);
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
