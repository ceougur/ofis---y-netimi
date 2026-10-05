// Ekrandan bir hafta (kullanıcı kararı 04.10.2026: "gerçek muhasebeci gibi değil de koddan mı yapıyorsun?" → önerim: bir
// hafta, tek karşılaştırma). Excel'deki 20–26 Ocak 2025 haftası (51 işlem; 30 işlem türünün 25'i) iki şirkete girilir:
//   001 · API Şirketi    — işlemler programın API'sinden (Excel denetimindeki yükleyiciyle aynı istekler);
//   002 · Ekran Şirketi  — AYNI işlemler tarayıcıdan, kullanıcı gibi: fatura formu, cari kartı, Çek/Senet penceresi.
// İki şirketin başlangıcı aynıdır: cari ve stok listesi Excel'den (ekrandan) yüklenir, personel ve gider carileri açılır,
// haftadaki taksit tahsilatlarının bağlı olduğu önceki taksitli satışlar girilir. Sonunda iki şirket sayı sayı karşılaştırılır:
// her carinin bakiyesi, her ürünün stoğu, Kasa ve banka/POS, faturalar, çek/senet, taksit kartları, mutabakat.
// Kod değiştirilmez; fark çıkarsa raporlanır. Kullanım: SP=<çalışma klasörü> node ekran-hafta.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright";
import { HERE, PASS, staff, startServer } from "./ortak.mjs";

const SP = process.env.SP || path.join(HERE, "calisma");
const ROOT = path.join(SP, "ekran-hafta");
const OUT = path.join(HERE, "cikti");
const SHOTS = path.join(OUT, "ekran-hafta");
const FROM = "2025-01-20";
const TO = "2025-01-26";
const DATA = JSON.parse(fs.readFileSync(path.join(HERE, "veri/islemler.json"), "utf8"));
const EXCEL = path.join(HERE, "veri/Sirket_Is_Listesi_Stoklu.xlsx");
const EXTRAS = JSON.parse(fs.readFileSync(path.join(HERE, "veri/hafta-ekler.json"), "utf8")).ops.map(op => ({ ...op, extra: true }));
const SKIP_WEEK = process.env.ATLA_HAFTA === "1"; // yalnız ek işlemleri denemek için (karşılaştırma yine yapılır)
let ctxFor = {};
// Her iş kendi gününde girilir (muhasebeci gibi): ek işlemler haftanın işleriyle tarihe göre birleşir; aynı gün önce
// Excel'deki işler. Fatura numarası ile tarih sırası bu yüzden bozulmaz (program eski tarihli belgeyi reddeder).
const DAYS_OF = week => [...(SKIP_WEEK ? [] : week), ...EXTRAS].sort((a, b) => a.date.localeCompare(b.date));
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const logFile = path.join(OUT, "ekran-hafta-kayit.txt");
fs.writeFileSync(logFile, "");
const log = (...parts) => {
  const line = parts.join(" ");
  console.log(line);
  fs.appendFileSync(logFile, `${line}\n`);
};
const trNum = n => String(n).replace(".", ",");
const order = (a, b) => (a.date + a.no).localeCompare(b.date + b.no);

const week = DATA.ops.filter(op => op.type !== "cari" && op.date >= FROM && op.date <= TO).sort(order);
// Haftadaki taksit tahsilatlarının satışları ve o satışların hafta öncesindeki tahsilatları başlangıç verisidir.
const parentNos = new Set(week.filter(op => op.type === "installment").map(op => op.sale));
const base = DATA.ops.filter(op => (parentNos.has(op.no) || (op.type === "installment" && parentNos.has(op.sale) && op.date < FROM))).sort(order);

const app = startServer(ROOT, { fresh: true });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const inv = `${modal} .hof-invoices-modal`;
let shotNo = 0;
const shot = async (page, name) => {
  shotNo += 1;
  await page.screenshot({ path: path.join(SHOTS, `${String(shotNo).padStart(3, "0")}-${name}.png`) }).catch(() => null);
};
const toasts = page => page.$$eval(".hof-toast", nodes => nodes.map(node => node.textContent.replace(/×$/, "").trim())).catch(() => []);
async function closeAll(page) {
  for (let i = 0; i < 8 && (await page.$(modal)); i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
}
async function newPage() {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" })).newPage();
  page.errorsSeen = [];
  page.on("pageerror", error => page.errorsSeen.push(error.message));
  return page;
}
async function login(page) {
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-company", { timeout: 20000 });
}
async function pickCompany(page, id) {
  await page.click("#hof-company [data-toggle]");
  await page.waitForSelector(`#hof-company [data-pick="${id}"]`);
  await Promise.all([page.waitForEvent("load", { timeout: 15000 }).catch(() => null), page.click(`#hof-company [data-pick="${id}"]`)]);
  await page.waitForSelector("#hof-company", { timeout: 20000 });
}
async function importSheet(page, action, sheet) {
  await closeAll(page);
  await page.click(`#hof-sidecard [data-action="${action}"]`);
  await page.waitForSelector(`${top} [data-act="import"]`, { timeout: 15000 });
  await page.click(`${top} [data-act="import"]`);
  await page.waitForSelector(`${top} [data-src="excel"]`);
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click(`${top} [data-src="excel"]`)]);
  await chooser.setFiles(EXCEL);
  await page.waitForSelector(`${top} select[name=sheet]`, { timeout: 20000 });
  await page.selectOption(`${top} select[name=sheet]`, sheet);
  await page.click(`${top} button[type=submit]`);
  await page.waitForSelector(`${top} .hof-import-form`, { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.click(`${top} .hof-import-form button[type="submit"]`);
  await page.waitForFunction(() => document.querySelector(".hof-toast"), null, { timeout: 60000 }).catch(() => null);
  await page.waitForTimeout(1500);
  const result = (await toasts(page)).join(" | ");
  await closeAll(page);
  return result;
}

// ---------- API ile giriş (Excel denetimindeki yükleyiciyle aynı istekler) ----------
async function call(client, method, url, body) {
  let res = await client[method](url, body);
  if (res.status === 409 && ["cash-negative", "stock-negative"].includes(res.data?.code)) res = await client[method](url, { ...body, force: true, cashForce: true });
  if (res.status === 409 && ["cash-negative", "stock-negative"].includes(res.data?.code)) res = await client[method](url, { ...body, force: true, cashForce: true });
  return res;
}
function invoiceBody(op, acc, item) {
  if (op.type === "expense") {
    return { scenario: "expense_purchase", accountId: acc.get(`Gider: ${op.category}`).id, number: op.no, issueDate: op.date, pricesIncludeVat: true, lines: [{ name: op.itemName, qty: 1, unitPrice: Number(op.gross), vatRate: op.vatRate, expenseCode: op.expenseCode }], payment: { cash: [{ amount: Number(op.gross), method: op.method }], rest: "open" } };
  }
  const sale = op.type === "sale";
  const body = { scenario: sale ? "goods_sale" : "goods_purchase", accountId: acc.get(op.code).id, issueDate: op.date, lines: [{ itemId: item.get(op.product).id, qty: op.qty, unitPrice: op.price, vatRate: op.vatRate }], note: op.no };
  if (!sale) body.number = op.no;
  const payable = Number(op.payable);
  if (op.mode === "paid") body.payment = { cash: [{ amount: payable, method: op.method }], rest: "open" };
  else if (op.mode === "cheque") body.payment = { cheques: [{ instrument: op.instrument, amount: payable, dueDate: op.due, serialNo: op.no, bank: "Excel" }], rest: "open" };
  else if (op.mode === "installments") body.payment = { rest: "installments", installments: { count: op.count, firstDue: op.firstDue, everyMonths: 1 } };
  else body.payment = { rest: "open", dueDate: op.due };
  return body;
}
async function apiOp(c, op, ctx) {
  const { acc, item, plans } = ctx;
  if (["sale", "purchase", "expense"].includes(op.type)) {
    const res = await call(c, "post", "/api/workspace/invoices", invoiceBody(op, acc, item));
    if (res.status === 200 && op.mode === "installments") {
      const doc = (await c.get(`/api/workspace/invoices/${res.data.id}`)).data;
      plans[op.no] = doc.planId || doc.plan?.id;
    }
    return res;
  }
  const a = acc.get(op.code);
  if (op.type === "salary") {
    const r = await call(c, "post", `/api/workspace/accounts/${a.id}/entries`, { kind: "credit", amount: Number(op.amount), date: op.date, note: `${op.no} ${op.note} (tahakkuk)` });
    if (r.status !== 200) return r;
    return call(c, "post", `/api/workspace/accounts/${a.id}/entries`, { kind: "out", amount: Number(op.amount), date: op.date, method: op.method, note: `${op.no} maaş ödemesi` });
  }
  if (op.type === "installment") {
    const plan = (await c.get(`/api/workspace/plans/${plans[op.sale]}`)).data;
    const itemId = plan.items[op.seq - 1].id;
    if (op.instrument) return call(c, "post", "/api/workspace/cheques", { direction: "in", instrument: op.instrument, accountId: a.id, planId: plan.id, itemId, amount: Number(op.amount), issueDate: op.date, dueDate: op.due, serialNo: op.no, bank: "Excel" });
    return call(c, "post", `/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: Number(op.amount), date: op.date, method: op.method, itemId, note: op.no });
  }
  if (op.instrument) return call(c, "post", "/api/workspace/cheques", { direction: op.type === "collect" ? "in" : "out", instrument: op.instrument, accountId: a.id, amount: Number(op.amount), issueDate: op.date, dueDate: op.due, serialNo: op.no, bank: "Excel" });
  return call(c, "post", `/api/workspace/accounts/${a.id}/entries`, { kind: op.type === "collect" ? "in" : "out", amount: Number(op.amount), date: op.date, method: op.method, note: op.no });
}

// Ek işlemler API ile (001): ekrandaki formların gönderdiği isteklerin aynısı.
async function apiExtra(c, op, ctx) {
  const { acc, item, plans } = ctx;
  const ok = res => (res.status === 200 ? res : res);
  if (op.type === "newCari") {
    const res = await c.post("/api/workspace/accounts", { name: op.name, type: op.kind, refNo: op.ref, registeredOn: op.date, phone: op.phone, note: op.note || "" });
    await ctx.refresh();
    return res;
  }
  if (op.type === "dupCari") return { status: 200, data: "ekranda denenir (API'de yok)" };
  if (op.type === "newItem") {
    const body = { kind: op.kind, code: op.code, name: op.name, unit: op.unit, unitPrice: op.buy, salePrice: op.sell };
    if (op.kind === "product") Object.assign(body, { openingQty: String(op.openingQty), openingPay: op.openingCash ? "cash" : "none", openingDate: op.date });
    const res = await call(c, "post", "/api/workspace/stock", body);
    await ctx.refresh();
    return res;
  }
  if (op.type === "stockIn" || op.type === "stockOut") return call(c, "post", `/api/workspace/stock/${item.get(op.code).id}/moves`, { kind: op.type === "stockIn" ? "in" : "out", qty: String(op.qty), unitPrice: op.price, ...(op.method === "none" ? { pay: "none" } : { pay: "cash", method: op.method }), date: op.date, note: op.note });
  if (op.type === "rent") return call(c, "post", "/api/workspace/invoices", { scenario: "expense_purchase", accountId: acc.get(op.ref).id, number: op.number, issueDate: op.date, pricesIncludeVat: true, lines: [{ name: op.itemName, qty: 1, unitPrice: Number(op.gross), vatRate: op.vatRate, expenseCode: op.expenseCode }], payment: { rest: "open", dueDate: op.due } });
  if (op.type === "sale") return call(c, "post", "/api/workspace/invoices", { scenario: "goods_sale", accountId: acc.get(op.ref).id, issueDate: op.date, note: op.no, lines: op.lines.map(ln => ({ itemId: item.get(ln.code).id, qty: ln.qty, unitPrice: Number(ln.price), vatRate: ln.vatRate })), payment: { rest: "open", dueDate: op.due } });
  if (op.type === "payEntry" || op.type === "collectEntry") return call(c, "post", `/api/workspace/accounts/${acc.get(op.ref).id}/entries`, { kind: op.type === "payEntry" ? "out" : "in", amount: Number(op.amount), date: op.date, method: op.method, note: op.note });
  if (op.type === "salary") {
    const a = acc.get(op.ref);
    const r = await call(c, "post", `/api/workspace/accounts/${a.id}/entries`, { kind: "credit", amount: Number(op.amount), date: op.date, note: `${op.no} ${op.note.replace(/^EK-\d+ /, "")} (tahakkuk)` });
    if (r.status !== 200) return r;
    return call(c, "post", `/api/workspace/accounts/${a.id}/entries`, { kind: "out", amount: Number(op.amount), date: op.date, method: op.method, note: `${op.no} maaş ödemesi` });
  }
  if (op.type === "plan") {
    const a = acc.get(op.ref);
    const res = await c.post("/api/workspace/plans", { name: a.name, registeredOn: op.date, phone: a.phone || "", total: op.total, accountId: a.id, mode: "auto", count: String(op.count), firstDue: op.firstDue });
    plans[op.no] = res.data?.id;
    return ok(res);
  }
  if (op.type === "planCollect") return call(c, "post", `/api/workspace/plans/${plans["EK-13"]}/entries`, { kind: "in", amount: Number(op.amount), date: op.date, method: op.method, note: op.note });
  throw new Error(`bilinmeyen ek işlem ${op.type}`);
}

// ---------- Ekrandan giriş (kullanıcı gibi) ----------
function screenAgent(page, companyId, ctx) {
  const { acc, item, plans } = ctx;
  const api = url => page.evaluate(async u => (await (await fetch(u)).json()).data, `${url}${url.includes("?") ? "&" : "?"}hofCompany=${companyId}`);
  const answerQuestions = async done => {
    for (let i = 0; i < 4; i += 1) {
      const yes = await page.waitForSelector(`${modal} [data-answer="yes"]`, { timeout: 4000 }).catch(() => null);
      if (!yes) break;
      await page.click(`${modal} [data-answer="yes"]`);
      await page.waitForTimeout(500);
      if (done && (await page.$(done))) break;
    }
  };
  const pickAccount = async (scope, a) => {
    await page.fill(`${scope} [data-acc-query]`, a.name);
    await page.waitForSelector(`${scope} li[data-id="${a.id}"]`, { timeout: 10000 });
    await (await page.$(`${scope} li[data-id="${a.id}"]`)).dispatchEvent("mousedown");
  };
  // Satış, alış ve gider faturası: Faturalar → Yeni → senaryo → form → Kaydet.
  const invoice = async op => {
    const scenario = op.type === "sale" ? "goods_sale" : op.type === "purchase" ? "goods_purchase" : "expense_purchase";
    await closeAll(page);
    await page.click("#hof-sidecard [data-action=invoices]");
    await page.waitForSelector(`${inv} [data-act="new"]`);
    await page.click(`${inv} [data-act="new"]`);
    await page.click(`${inv} [data-scenario="${scenario}"]`);
    await page.waitForSelector(`${inv} [data-lines]`);
    await page.fill(`${inv} [data-f="issueDate"]`, op.date);
    await page.dispatchEvent(`${inv} [data-f="issueDate"]`, "change");
    if (op.type !== "sale") await page.fill(`${inv} [data-f="number"]`, op.no);
    const a = op.accountRef ? acc.get(op.accountRef) : op.type === "expense" ? acc.get(`Gider: ${op.category}`) : acc.get(op.code);
    await pickAccount(inv, a);
    await page.click(`${inv} [data-l="0"][data-f="name"]`);
    if (op.type === "expense") {
      if (!(await page.isChecked(`${inv} [data-f="pricesIncludeVat"]`))) await page.click(`${inv} [data-f="pricesIncludeVat"]`);
      await page.waitForTimeout(800);
      await page.click(`${inv} [data-l="0"][data-f="name"]`);
      await page.keyboard.type(op.itemName, { delay: 40 });
      await page.keyboard.press("Tab");
      await page.waitForTimeout(600);
      await page.click(`${inv} [data-l="0"][data-f="qty"]`);
      await page.fill(`${inv} [data-l="0"][data-f="qty"]`, "1");
      await page.fill(`${inv} [data-l="0"][data-f="unitPrice"]`, trNum(op.gross));
      await page.selectOption(`${inv} [data-l="0"][data-f="vatRate"]`, String(op.vatRate));
      await page.selectOption(`${inv} [data-l="0"][data-f="expenseCode"]`, op.expenseCode);
    } else {
      // Çok kalemli fatura (ek işlemler): ikinci kalem "+ Kalem Ekle" ile.
      const lines = op.lines || [{ code: op.product, qty: op.qty, price: op.price, vatRate: op.vatRate }];
      for (const [l, ln] of lines.entries()) {
        const product = item.get(ln.code);
        if (l > 0) {
          if (!(await page.$(`${inv} [data-l="${l}"][data-f="name"]`))) await page.click(`${inv} [data-act="add-line"]`);
          await page.click(`${inv} [data-l="${l}"][data-f="name"]`);
        }
        await page.keyboard.type(product.name);
        await page.waitForSelector(`${inv} [data-hits="${l}"] li[data-item="${product.id}"]`, { timeout: 10000 });
        await page.click(`${inv} [data-hits="${l}"] li[data-item="${product.id}"]`);
        await page.fill(`${inv} [data-l="${l}"][data-f="qty"]`, trNum(ln.qty));
        await page.fill(`${inv} [data-l="${l}"][data-f="unitPrice"]`, trNum(ln.price));
        await page.selectOption(`${inv} [data-l="${l}"][data-f="vatRate"]`, String(ln.vatRate));
      }
    }
    if (op.type === "sale") await page.fill(`${inv} [data-f="note"]`, op.no).catch(() => null);
    await page.waitForTimeout(900);
    const amount = op.type === "expense" ? op.gross : op.payable;
    if ((op.type === "expense" && !op.open) || op.mode === "paid") {
      await page.click(`${inv} [data-act="pay-add-cash"]`);
      await page.selectOption(`${inv} [data-pay="cash"][data-f="method"]`, op.method);
      await page.fill(`${inv} [data-pay="cash"][data-i="0"][data-f="amount"]`, trNum(amount));
      await page.waitForTimeout(900);
    } else if (op.mode === "cheque") {
      await page.click(`${inv} [data-act="pay-add-cheque"]`);
      const f = name => `${inv} [data-pay="cheques"][data-i="0"][data-f="${name}"]`;
      await page.selectOption(f("instrument"), op.instrument);
      await page.waitForTimeout(500);
      // Dikkatli kullanıcı: her alanı yazar, biraz bekler, silindiyse yeniden yazar (bilinen ekran hatası: tutar tamamı
      // karşılayınca ödeme alanları ~0,6 sn içinde yeniden çizilir; bu sürede yazılan vade/banka kaybolur).
      for (const [name, value] of [["amount", trNum(amount)], ["dueDate", op.due], ["serialNo", op.no], ["bank", "Excel"]]) {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          await page.fill(f(name), value);
          await page.waitForTimeout(900);
          if ((await page.inputValue(f(name))) === value) break;
          result.ekranHatasi.push(`${op.no}: ${name} alanı yazıldıktan sonra silindi (deneme ${attempt + 1})`);
        }
      }
    } else if (op.mode === "installments") {
      await page.click(`${inv} [data-rest="installments"]`);
      await page.waitForSelector(`${inv} [data-payf="installments.count"]`);
      await page.fill(`${inv} [data-payf="installments.count"]`, String(op.count));
      await page.waitForTimeout(600);
      await page.fill(`${inv} [data-payf="installments.firstDue"]`, op.firstDue);
    } else {
      await page.click(`${inv} [data-rest="open"]`).catch(() => null);
      await page.fill(`${inv} [data-payf="dueDate"]`, op.due);
    }
    await page.waitForTimeout(900);
    await shot(page, `${op.no}-${op.type}-${op.mode || op.method}-form`);
    await page.click(`${inv} [data-act="issue"]`);
    await answerQuestions(`${inv} .hof-inv-pills`);
    await page.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 15000 });
    const title = (await page.textContent(`${inv} .hof-plan-title h3`)).replace(/\s+/g, " ").trim();
    if (op.mode === "installments") {
      const list = await api(`/api/workspace/invoices?tab=sale&account=${a.id}`);
      const doc = (list?.invoices || []).find(d => (d.note || "").includes(op.no)) || (list?.invoices || [])[0];
      const detail = doc ? await api(`/api/workspace/invoices/${doc.id}`) : null;
      plans[op.no] = detail?.planId || detail?.plan?.id;
    }
    await closeAll(page);
    return title;
  };
  const openAccount = async a => {
    await closeAll(page);
    await page.click("#hof-sidecard [data-action=accounts]");
    await page.waitForSelector(`${top} input[data-filter="q"]`);
    await page.fill(`${top} input[data-filter="q"]`, a.refNo);
    await page.waitForSelector(`${top} tr[data-account="${a.id}"]`, { timeout: 10000 });
    await page.click(`${top} tr[data-account="${a.id}"]`);
    await page.waitForSelector(`${top} [data-entry="out"]`);
  };
  const fillEntry = async ({ amount, date, method, note }, label) => {
    await page.waitForSelector(`${top} form input[name=amount]`);
    await page.fill(`${top} form input[name=amount]`, trNum(amount));
    if (method && (await page.$(`${top} form select[name=method]`))) await page.selectOption(`${top} form select[name=method]`, method);
    await page.fill(`${top} form input[name=date]`, date);
    if (await page.$(`${top} form [name=note]`)) await page.fill(`${top} form [name=note]`, note);
    await shot(page, label);
    await page.click(`${top} form button[type=submit]`);
    await answerQuestions();
    await page.waitForFunction(sel => !document.querySelector(sel), `${top} form input[name=amount]`, { timeout: 15000 });
    await page.waitForTimeout(500);
    return (await toasts(page)).at(-1) || "form kapandı";
  };
  // Cari kartı: + Tahsilat / − Ödeme (nakit, havale, POS) ve maaş (Alacak Yaz + − Ödeme).
  const entry = async op => {
    const a = acc.get(op.code);
    await openAccount(a);
    if (op.type === "salary") {
      await page.click(`${top} [data-entry="credit"]`);
      await fillEntry({ amount: op.amount, date: op.date, note: `${op.no} ${op.note} (tahakkuk)` }, `${op.no}-maas-tahakkuk`);
      await page.waitForTimeout(400);
      await page.click(`${top} [data-entry="out"]`);
      const toast = await fillEntry({ amount: op.amount, date: op.date, method: op.method, note: `${op.no} maaş ödemesi` }, `${op.no}-maas-odeme`);
      await closeAll(page);
      return toast;
    }
    await page.click(`${top} [data-entry="${op.type === "collect" ? "in" : "out"}"]`);
    if (op.type === "collect" && (await page.waitForSelector(`${top} [data-plain]`, { timeout: 1500 }).catch(() => null))) await page.click(`${top} [data-plain]`);
    const toast = await fillEntry({ amount: op.amount, date: op.date, method: op.method, note: op.no }, `${op.no}-${op.type}-${op.method}`);
    await closeAll(page);
    return toast;
  };
  // Alınan / verilen çek-senet: Çek/Senet → + Çek / Senet Al | Ver.
  const cheque = async op => {
    const a = acc.get(op.code);
    await closeAll(page);
    await page.click("#hof-sidecard [data-action=cheques]");
    const act = op.type === "collect" ? "new-in" : "new-out";
    await page.waitForSelector(`${top} [data-act="${act}"]`, { timeout: 15000 });
    await page.click(`${top} [data-act="${act}"]`);
    await page.waitForSelector(`${top} form select[name=instrument]`);
    await page.selectOption(`${top} form select[name=instrument]`, op.instrument);
    await page.fill(`${top} form input[name=amount]`, trNum(op.amount));
    await page.fill(`${top} form input[name=dueDate]`, op.due);
    await page.fill(`${top} form input[name=issueDate]`, op.date);
    await page.fill(`${top} form input[name=serialNo]`, op.no);
    await page.fill(`${top} form input[name=bank]`, "Excel");
    await pickAccount(`${top} form`, a);
    await page.waitForTimeout(700);
    await shot(page, `${op.no}-${op.type}-${op.instrument}`);
    await page.click(`${top} form button[type=submit]`);
    await answerQuestions();
    await page.waitForFunction(sel => !document.querySelector(sel), `${top} form select[name=instrument]`, { timeout: 15000 });
    await page.waitForTimeout(500);
    const toast = (await toasts(page)).at(-1) || "form kapandı";
    await closeAll(page);
    return toast;
  };
  // Taksit tahsilatı: cari kartı → + Tahsilat → taksit kartını seç → tutar.
  const installment = async op => {
    const a = acc.get(op.code);
    const planId = plans[op.sale];
    await openAccount(a);
    await page.click(`${top} [data-entry="in"]`);
    await page.waitForSelector(`${top} [data-plan="${planId}"]`, { timeout: 8000 });
    await page.click(`${top} [data-plan="${planId}"]`);
    const toast = await fillEntry({ amount: op.amount, date: op.date, method: op.method, note: op.no }, `${op.no}-taksit-${op.method}`);
    await closeAll(page);
    return toast;
  };
  // ---------- Ek işlemler (Excel'de olmayan günlük işler; veri/hafta-ekler.json) ----------
  const field = name => `${top} form [name="${name}"]`;
  const submitAndWait = async (gone, label) => {
    await shot(page, label);
    await page.click(`${top} form button[type=submit]`);
    await answerQuestions();
    await page.waitForFunction(sel => !document.querySelector(sel), gone, { timeout: 15000 });
    await page.waitForTimeout(500);
    return (await toasts(page)).at(-1) || "form kapandı";
  };
  const openWindow = async (action, ready) => {
    await closeAll(page);
    await page.click(`#hof-sidecard [data-action="${action}"]`);
    await page.waitForSelector(`${top} ${ready}`, { timeout: 15000 });
  };
  // + Yeni Cari: ad harf harf yazılır (aynı ad uyarısı yazarken gelir), tür, cari no, kayıt tarihi, telefon, not.
  const newCari = async op => {
    await openWindow("accounts", '[data-act="new"]');
    await page.click(`${top} [data-act="new"]`);
    await page.waitForSelector(field("name"));
    await page.click(field("name"));
    await page.keyboard.type(op.name, { delay: 30 });
    await page.selectOption(field("type"), op.kind);
    await page.fill(field("refNo"), op.ref);
    await page.fill(field("registeredOn"), op.date);
    await page.fill(field("phone"), op.phone);
    if (op.note) await page.fill(field("note"), op.note);
    const toast = await submitAndWait(`${top} form input[name="refNo"]`, `${op.no}-yeni-cari`);
    await closeAll(page);
    await ctx.refresh();
    return toast;
  };
  // Aynı adla ikinci cari denemesi: yazarken uyarı, kaydederken "Bu Kişi Zaten Kayıtlı" sorusu → "Mevcut Cariyi Aç".
  const dupCari = async op => {
    await openWindow("accounts", '[data-act="new"]');
    await page.click(`${top} [data-act="new"]`);
    await page.waitForSelector(field("name"));
    await page.click(field("name"));
    await page.keyboard.type(op.name, { delay: 40 });
    await page.waitForTimeout(1200);
    const hint = await page.$eval(`${top} .hof-dup-hint`, node => (node.hidden ? "" : node.innerText.replace(/\s+/g, " ").trim())).catch(() => "");
    await shot(page, `${op.no}-ayni-ad-uyarisi`);
    await page.click(`${top} form button[type=submit]`);
    const ask = await page.waitForSelector(`${modal} [data-answer="no"]`, { timeout: 6000 }).catch(() => null);
    const question = ask ? await page.$$eval(`${modal} .hof-modal-text`, nodes => nodes.map(node => node.innerText).join(" ").replace(/\s+/g, " ").trim()) : "";
    if (ask) {
      await shot(page, `${op.no}-ayni-ad-sorusu`);
      await page.click(`${modal} [data-answer="no"]`);
      await page.waitForTimeout(1200);
    }
    const opened = await page.$eval(`${top} .hof-plan-title h3`, node => node.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
    await closeAll(page);
    result.ayniAd = { yazarkenUyari: hint, kaydederkenSoru: question, acilanKart: opened };
    if (!hint || !question) throw new Error(`aynı ad uyarısı eksik (yazarken: "${hint}", soru: "${question}")`);
    return `uyarı var; "Mevcut Cariyi Aç" → ${opened}`;
  };
  // + Yeni Ürün: Stok Kodu, ad, birim, alış/satış fiyatı; üründe ilk miktar ve "Kasa'ya yansıt".
  const newItem = async op => {
    await openWindow("stock", '[data-act="new"]');
    await page.click(`${top} [data-act="new"]`);
    await page.waitForSelector(field("name"));
    await page.selectOption(field("kind"), op.kind);
    await page.fill(field("code"), op.code);
    await page.fill(field("name"), op.name);
    await page.selectOption(field("unit"), op.unit);
    if (op.buy) await page.fill(field("unitPrice"), trNum(op.buy));
    await page.fill(field("salePrice"), trNum(op.sell));
    if (op.kind === "product") {
      await page.fill(field("openingQty"), String(op.openingQty));
      if (op.openingCash) {
        await page.check(field("openingCash"));
        await page.fill(field("openingDate"), op.date);
      }
    }
    const toast = await submitAndWait(`${top} form input[name="code"]`, `${op.no}-yeni-urun`);
    await closeAll(page);
    await ctx.refresh();
    return toast;
  };
  const openItem = async code => {
    const it = item.get(code);
    await openWindow("stock", 'input[data-filter="q"]');
    await page.fill(`${top} input[data-filter="q"]`, code);
    await page.waitForSelector(`${top} tr[data-item="${it.id}"]`, { timeout: 10000 });
    await page.click(`${top} tr[data-item="${it.id}"]`);
    await page.waitForSelector(`${top} [data-move="in"]`);
  };
  // Stok kartı → + Giriş / − Çıkış: miktar, fiyat, ödeme/tahsilat yolu (ya da Yalnız Miktar), tarih, açıklama.
  const stockMove = async op => {
    await openItem(op.code);
    await page.click(`${top} [data-move="${op.type === "stockIn" ? "in" : "out"}"]`);
    await page.waitForSelector(field("qty"));
    await page.fill(field("qty"), String(op.qty));
    await page.fill(field("unitPrice"), op.price ? trNum(op.price) : "");
    await page.selectOption(field("pay"), op.method);
    await page.fill(field("date"), op.date);
    await page.fill(field("note"), op.note);
    const toast = await submitAndWait(`${top} form input[name="qty"]`, `${op.no}-${op.type}`);
    await closeAll(page);
    return toast;
  };
  // Taksit penceresi → + Yeni Kart: cari seçilir, "Yeni Borç", toplam, eşit taksit (sayı + ilk vade).
  const plan = async op => {
    const a = acc.get(op.ref);
    await openWindow("plans", '[data-act="new"]');
    await page.click(`${top} [data-act="new"]`);
    await page.waitForSelector(field("total"));
    await pickAccount(`${top} form`, a);
    await page.waitForTimeout(800);
    await page.fill(field("registeredOn"), op.date);
    await page.selectOption(field("source"), "new");
    await page.waitForTimeout(300);
    await page.fill(field("total"), trNum(op.total));
    await page.selectOption(field("items"), "auto");
    await page.fill(field("count"), String(op.count));
    await page.fill(field("firstDue"), op.firstDue);
    const toast = await submitAndWait(`${top} form input[name="total"]`, `${op.no}-taksit-karti`);
    await closeAll(page);
    const list = await api(`/api/workspace/plans?status=all&limit=500&q=${encodeURIComponent(a.name)}`);
    plans[op.no] = (list?.plans || []).find(p => p.accountId === a.id)?.id;
    if (!plans[op.no]) throw new Error("taksit kartı listede bulunamadı");
    return toast;
  };
  // Taksit kartı → + Tahsilat: tutar, tarih, yol, "En Eski Açık Taksite".
  const planCollect = async op => {
    const a = acc.get(op.ref);
    const id = plans["EK-13"];
    await openWindow("plans", 'input[data-filter="q"]');
    await page.fill(`${top} input[data-filter="q"]`, a.name.slice(0, 10));
    await page.waitForSelector(`${top} tr[data-plan="${id}"]`, { timeout: 10000 });
    await page.click(`${top} tr[data-plan="${id}"]`);
    await page.waitForSelector(`${top} [data-act="pay"]`);
    await page.click(`${top} [data-act="pay"]`);
    await page.waitForSelector(field("amount"));
    await page.fill(field("amount"), trNum(op.amount));
    await page.fill(field("date"), op.date);
    await page.selectOption(field("method"), op.method);
    await page.fill(field("note"), op.note);
    const toast = await submitAndWait(`${top} form input[name="amount"]`, `${op.no}-taksit-tahsilati`);
    await closeAll(page);
    return toast;
  };
  const extra = async op => {
    if (op.type === "newCari") return newCari(op);
    if (op.type === "dupCari") return dupCari(op);
    if (op.type === "newItem") return newItem(op);
    if (op.type === "stockIn" || op.type === "stockOut") return stockMove(op);
    if (op.type === "plan") return plan(op);
    if (op.type === "planCollect") return planCollect(op);
    if (op.type === "rent") return invoice({ type: "expense", open: true, no: op.number, date: op.date, accountRef: op.ref, itemName: op.itemName, gross: op.gross, vatRate: op.vatRate, expenseCode: op.expenseCode, due: op.due });
    if (op.type === "sale") return invoice({ type: "sale", mode: "open", no: op.no, date: op.date, accountRef: op.ref, lines: op.lines, due: op.due });
    if (op.type === "payEntry" || op.type === "collectEntry") return entry({ type: op.type === "payEntry" ? "pay" : "collect", code: op.ref, amount: op.amount, date: op.date, method: op.method, no: op.note });
    if (op.type === "salary") return entry({ type: "salary", code: op.ref, amount: op.amount, date: op.date, method: op.method, no: op.no, note: op.note.replace(/^EK-\d+ /, "") });
    throw new Error(`bilinmeyen ek işlem ${op.type}`);
  };
  return async op => {
    if (op.extra) return extra(op);
    if (["sale", "purchase", "expense"].includes(op.type)) return invoice(op);
    if (op.type === "installment") return installment(op);
    if (op.instrument) return cheque(op);
    return entry(op);
  };
}

// ---------- Raporlar ekrandan (Rapor Merkezi) + PDF ve Excel ----------
// Her rapor Raporlar → Tüm Raporlar'dan açılır, haftanın tarihleri yazılıp "Ön İzle"ye basılır; özet kutuları ve TOPLAM
// satırı ekrandan okunur. PDF ve Excel bağlantısı kullanıcının "bağlantıyı farklı kaydet"i gibi (sağ tık) alınır: bağlantı
// pencerenin şirketini taşımalı (?hofCompany=); dosyalardaki sayılar ekrandakilerle aynı olmalı.
const REPORTS = [
  { key: "kasa", id: "kasa-hareketleri", range: true, expect: e => ({ Devir: e.kasa.cash.devir, "Dönem Giriş": e.kasa.cash.giris, "Dönem Çıkış": e.kasa.cash.cikis }) },
  // Banka ve POS birlikte (varsayılan "Yol: Banka ve POS (Tümü)"); banka ile POS'un ayrı toplamı tablonun Yol kolonundan.
  { key: "bankaPos", id: "banka-pos-hareketleri", range: true, table: true, expect: e => ({ Devir: (Number(e.kasa.bank.devir) + Number(e.kasa.card.devir)).toFixed(2), "Dönem Giriş": (Number(e.kasa.bank.giris) + Number(e.kasa.card.giris)).toFixed(2), "Dönem Çıkış": (Number(e.kasa.bank.cikis) + Number(e.kasa.card.cikis)).toFixed(2), "Banka (tüm hareketler)": e.kasa.bank.bakiye, "POS / Kredi Kartı (tüm hareketler)": e.kasa.card.bakiye }) },
  // "Yol" kutusundan Banka / POS seçimi (Bulgu 4: sunucu payMethod'u yok sayıyor; düzelene kadar bu iki satır ✗ verir).
  { key: "banka", id: "banka-pos-hareketleri", range: true, selects: { payMethod: "bank" }, bulgu: "Bulgu 4", expect: e => ({ "Dönem Giriş": e.kasa.bank.giris, "Dönem Çıkış": e.kasa.bank.cikis }) },
  { key: "pos", id: "banka-pos-hareketleri", range: true, selects: { payMethod: "card" }, bulgu: "Bulgu 4", expect: e => ({ "Dönem Giriş": e.kasa.card.giris, "Dönem Çıkış": e.kasa.card.cikis }) },
  { key: "satis", id: "fatura-satis", range: true, bulgu: "Bulgu 2 (Kalan)", expect: e => ({ "Satış Faturası": e.fatura_sale.adet, Matrah: e.fatura_sale.matrah, KDV: e.fatura_sale.kdv, Ödenecek: e.fatura_sale.odenecek, Kalan: e.fatura_sale.kalan }) },
  { key: "alis", id: "fatura-alis", range: true, expect: e => ({ "Alış Faturası": e.fatura_purchase.adet, Matrah: e.fatura_purchase.matrah, KDV: e.fatura_purchase.kdv, Ödenecek: e.fatura_purchase.odenecek, Kalan: e.fatura_purchase.kalan }) },
  { key: "kdv", id: "kdv-ozeti", range: true, expect: e => ({ "Hesaplanan KDV (391)": e.kdv.hesaplanan, "İndirilecek KDV (191)": e.kdv.indirilecek, [Number(e.kdv.sonuc) >= 0 ? "Ödenecek KDV" : "Devreden KDV"]: String(Math.abs(Number(e.kdv.sonuc)).toFixed(2)) }) },
  { key: "gider", id: "gider-raporu", range: true, expect: e => ({ "Toplam Gider": e.gider.toplam }) },
  { key: "mizan", id: "mizan", range: true, expect: e => ({ "Dönem Borç": e.mizan.donem_borc, "Dönem Alacak": e.mizan.donem_alacak, "Borçlular Toplamı": e.mizan.borclular, "Alacaklılar Toplamı": e.mizan.alacaklilar }) },
  { key: "cariler", id: "cari-listesi", expect: e => ({ "Toplam Borç (Anlaşılan)": e.cari_listesi.toplam_borc, "Toplam Alacak (Ödenen)": e.cari_listesi.toplam_alacak, Borçlular: e.cari_listesi.borclular, Alacaklılar: e.cari_listesi.alacaklilar }) },
  { key: "acik", id: "acik-faturalar", bulgu: "Bulgu 2 (Açık Alacak)", expect: e => ({ "Açık Alacak": e.acik_faturalar.alacak, "Açık Borç": e.acik_faturalar.borc }) },
  { key: "taksit", id: "taksit-kartlari", selects: { planStatus: "all" }, expect: e => ({ Kart: e.taksit.kart, Toplam: e.taksit.toplam, Ödenen: e.taksit.odenen, Kalan: e.taksit.kalan }) },
  { key: "cek", id: "cek-portfoy", expect: e => ({ "Portföyde (alınan)": e.cek.alinan, "Ödenecek (verilen)": e.cek.verilen }) },
  { key: "stok", id: "stok-durumu", table: true, expect: () => ({}) },
  // Not: dönem düğmesi (Tüm Zamanlar / Bu Yıl) seçili cariyi siliyor (bulgu, rapor-ekstre-secim.mjs); ekstre tarih yazılıp
  // "Ön İzle" ile alınır (seçim bu yolda korunuyor). Yeni cari yalnız bu haftada çalıştı: devir 0.
  { key: "ekstre", id: "cari-ekstre", account: "YNI-001", range: true, expect: e => ({ "Dönem Borç": e["ekstre_YNI-001"].borc, "Dönem Alacak": e["ekstre_YNI-001"].alacak, "Dönem Sonu": e["ekstre_YNI-001"].bakiye }) },
  { key: "hesapMizani", id: "hesap-mizani", range: true, expect: () => ({ Fark: "0.00" }) },
];
const MONEY_RE = /([−-])?\s*₺?\s*(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})/;
function numberOf(text) {
  const raw = String(text ?? "").trim();
  const m = MONEY_RE.exec(raw);
  if (m) return Number(`${m[1] ? "-" : ""}${m[2].replace(/\./g, "")}.${m[3]}`);
  const n = /^-?\d+$/.exec(raw.replace(/\./g, "").split(/\s/)[0]);
  return n ? Number(n[0]) : null;
}
const moneyKey = value => Math.abs(Number(value)).toFixed(2);
async function fileOf(page, selector, companyId, dir, name) {
  // Sağ tık ("bağlantıyı farklı kaydet"): bağlantı pencerenin şirketine yeniden yazılır; sonra dosya o adresten alınır.
  await page.click(selector, { button: "right" });
  const href = await page.getAttribute(selector, "href");
  const got = await page.evaluate(async url => {
    const response = await window.fetch(url);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let text = "";
    for (let i = 0; i < bytes.length; i += 1) text += String.fromCharCode(bytes[i]);
    return { status: response.status, b64: btoa(text) };
  }, href);
  const file = path.join(dir, name);
  fs.writeFileSync(file, Buffer.from(got.b64, "base64"));
  return { href, status: got.status, file, sirketli: href.includes(`hofCompany=${companyId}`) };
}
function pdfNumbers(file) {
  const text = execFileSync("pdftotext", ["-layout", file, "-"], { encoding: "utf8" });
  return { text, money: new Set([...text.matchAll(/(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})/g)].map(m => `${m[1].replace(/\./g, "")}.${m[2]}`)) };
}
function xlsxNumbers(file) {
  const out = execFileSync("python3", ["-c", "import openpyxl,json,sys\nwb=openpyxl.load_workbook(sys.argv[1],data_only=True)\nprint(json.dumps([c for ws in wb for r in ws.iter_rows(values_only=True) for c in r if c is not None],ensure_ascii=False,default=str))", file], { encoding: "utf8" });
  const cells = JSON.parse(out);
  const money = new Set();
  for (const cell of cells) {
    if (typeof cell === "number") money.add(Math.abs(cell).toFixed(2));
    else {
      const n = numberOf(cell);
      if (n !== null) money.add(Math.abs(n).toFixed(2));
    }
  }
  return { cells, money };
}
async function readReports(page, companyId, label) {
  const dir = path.join(SHOTS, `raporlar-${label}`);
  fs.mkdirSync(dir, { recursive: true });
  const main = `${modal} [data-rc-main]`;
  await closeAll(page);
  await page.click("#hof-sidecard [data-action=analytics]");
  await page.waitForSelector(`${modal} .hof-rep-tab[data-tab="all"]`, { timeout: 15000 });
  await page.click(`${modal} .hof-rep-tab[data-tab="all"]`);
  await page.waitForSelector(`${modal} [data-rc-list] [data-report]`, { timeout: 15000 });
  const fresh = async action => {
    await page.evaluate(sel => document.querySelector(sel)?.setAttribute("data-eski", "1"), `${main} .hof-rc-summary`);
    await action();
    await page.waitForFunction(sel => {
      const box = document.querySelector(sel);
      return box && !box.hasAttribute("data-eski");
    }, `${main} .hof-rc-summary`, { timeout: 20000 });
    await page.waitForTimeout(300);
  };
  const out = {};
  for (const spec of REPORTS) {
    const one = { id: spec.id };
    try {
      await fresh(() => page.click(`${modal} [data-rc-list] [data-report="${spec.id}"]`).then(async () => {
        if (spec.account) {
          const a = ctxFor[companyId].acc.get(spec.account);
          await page.fill(`${main} [data-account-slot] [data-acc-query]`, a.name);
          await page.waitForSelector(`${main} [data-account-slot] li[data-id="${a.id}"]`, { timeout: 10000 });
          await (await page.$(`${main} [data-account-slot] li[data-id="${a.id}"]`)).dispatchEvent("mousedown");
        }
      }));
      if (spec.range) {
        await page.fill(`${main} [data-param="from"]`, FROM);
        await page.fill(`${main} [data-param="to"]`, TO);
        await fresh(() => page.click(`${main} [data-rc-run]`));
      }
      if (spec.preset) await fresh(() => page.click(`${main} [data-preset="${spec.preset}"]`));
      for (const [name, value] of Object.entries(spec.selects || {})) await fresh(() => page.selectOption(`${main} [data-param="${name}"]`, value));
      one.kapsam = await page.$eval(`${main} .hof-rc-scope`, node => node.innerText).catch(() => "");
      one.ozet = Object.fromEntries(await page.$$eval(`${main} .hof-rc-summary span`, spans => spans.map(span => [span.querySelector("small").innerText.trim(), span.querySelector("b").innerText.trim()])));
      one.toplam = await page.$$eval(`${main} tfoot td`, cells => cells.map(cell => cell.innerText.trim())).catch(() => []);
      if (spec.table) {
        // Başlıklar textContent'ten (ekranda CSS ile BÜYÜK harf gösteriliyor; innerText onu döndürür).
        const headers = await page.$$eval(`${main} thead th`, cells => cells.map(cell => cell.textContent.trim()));
        const rows = await page.$$eval(`${main} tbody tr`, rows => rows.map(row => [...row.cells].map(cell => cell.innerText.trim())));
        one.satirlar = rows.map(row => Object.fromEntries(headers.map((h, i) => [h, row[i]])));
      }
      await page.screenshot({ path: path.join(dir, `${spec.key}.png`) });
      const pdf = await fileOf(page, `${main} .hof-rep-out.is-pdf`, companyId, dir, `${spec.key}.pdf`);
      const xlsx = await fileOf(page, `${main} .hof-rep-out.is-xlsx`, companyId, dir, `${spec.key}.xlsx`);
      const inPdf = pdf.status === 200 ? pdfNumbers(pdf.file) : { money: new Set() };
      const inXlsx = xlsx.status === 200 ? xlsxNumbers(xlsx.file) : { money: new Set() };
      const shown = [...Object.values(one.ozet), ...one.toplam].filter(t => /\d,\d{2}\b/.test(t)).map(numberOf).map(moneyKey);
      one.dosya = {
        pdf: { status: pdf.status, sirketli: pdf.sirketli, eksik: shown.filter(v => !inPdf.money.has(v)) },
        excel: { status: xlsx.status, sirketli: xlsx.sirketli, eksik: shown.filter(v => !inXlsx.money.has(v)) },
      };
    } catch (error) {
      one.hata = error.message.split("\n")[0];
      await page.screenshot({ path: path.join(dir, `${spec.key}-HATA.png`) }).catch(() => null);
    }
    out[spec.key] = one;
  }
  await closeAll(page);
  // ANLIK DURUM (ana ekran kartları; kutuların üstüne gelince çıkan tam tutarlar). Sayfa yenilenir: kart güncel okunur.
  await page.reload();
  await page.waitForSelector("#hof-pulse [title]", { timeout: 20000 }).catch(() => null);
  await page.waitForTimeout(1500);
  const titles = await page.$$eval("#hof-pulse [title]", nodes => nodes.map(node => node.getAttribute("title"))).catch(() => []);
  const pick = (start, index = 0) => {
    const t = titles.find(x => x.startsWith(start));
    if (!t) return null;
    const all = [...t.matchAll(/([−-])?\s*₺?\s*(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})/g)];
    const m = all[index];
    return m ? Number(`${m[1] ? "-" : ""}${m[2].replace(/\./g, "")}.${m[3]}`) : null;
  };
  out.anlik = { ozet: { "Nakit Kasa": pick("Bugüne kadarki nakit kasa"), "Banka / POS": pick("Havale/EFT ve POS"), "Alacak Cari": pick("Carilerin bize borcu", 0), "Alacak Çek": pick("Carilerin bize borcu", 1), "Borç Cari": pick("Tedarikçilere borcumuz", 0), "Borç Çek": pick("Tedarikçilere borcumuz", 1) } };
  await page.screenshot({ path: path.join(dir, "anlik-durum.png") });
  return out;
}
function checkReports(read, expected, label) {
  const lines = [];
  const bad = [];
  const rows = [];
  for (const spec of REPORTS) {
    const one = read[spec.key];
    if (one.hata) {
      bad.push(`${label} ${spec.key}: açılamadı (${one.hata})`);
      continue;
    }
    for (const [name, want] of Object.entries(spec.expect(expected))) {
      const got = numberOf(one.ozet[name]);
      // İşaretiyle karşılaştırılır (gözden geçirme notu: önceden mutlak değerdi). Program yönü ayrı yazdığı yerlerde
      // (Bakiye + Durum, Devreden KDV) tutarı artı gösterir; beklenen de öyle verilir.
      const ok = got !== null && Number.isFinite(got) && Math.abs(got - Number(want)) < 0.005;
      lines.push(`${ok ? "✓" : "✗"} ${label} ${spec.id} · ${name}: ekran ${one.ozet[name] ?? "—"} · beklenen ${want}${!ok && spec.bulgu ? ` (${spec.bulgu})` : ""}`);
      rows.push({ rapor: spec.key, kalem: name, beklenen: Number(want), ekran: got, ok, bulgu: spec.bulgu || "" });
      if (!ok) bad.push(`${label} ${spec.id} · ${name}: ekran ${one.ozet[name] ?? "YOK"} · beklenen ${want}${spec.bulgu ? ` (${spec.bulgu})` : ""}`);
    }
    if (spec.key === "ekstre" && !/Borçlu/.test(one.ozet["Dönem Sonu"] || "")) bad.push(`${label} cari-ekstre · Dönem Sonu yönü: ${one.ozet["Dönem Sonu"]}`);
    if (spec.key === "bankaPos") {
      // Yol kolonundan: "Havale / EFT" banka, öbürleri (POS, Kredi Kartı) kart.
      const sums = { bank: { in: 0, out: 0 }, card: { in: 0, out: 0 } };
      for (const r of one.satirlar.slice(1)) {
        const way = /Havale/i.test(r.Yol || "") ? "bank" : "card";
        sums[way].in += numberOf(r["Giriş"]) || 0;
        sums[way].out += numberOf(r["Çıkış"]) || 0;
      }
      for (const [way, name] of [["bank", "Banka"], ["card", "POS / Kredi Kartı"]]) {
        for (const [dir, key] of [["in", "giris"], ["out", "cikis"]]) {
          const want = Number(expected.kasa[way][key]);
          const got = Math.round(sums[way][dir] * 100) / 100;
          const ok = Math.abs(got - want) < 0.005;
          lines.push(`${ok ? "✓" : "✗"} ${label} banka-pos-hareketleri (Yol kolonundan) · ${name} ${dir === "in" ? "Giriş" : "Çıkış"}: ekran ${got} · beklenen ${want}`);
          rows.push({ rapor: "bankaPosYol", kalem: `${name} ${dir === "in" ? "Giriş" : "Çıkış"}`, beklenen: want, ekran: got, ok, bulgu: "" });
          if (!ok) bad.push(`${label} banka-pos (Yol) · ${name} ${dir}: ekran ${got} · beklenen ${want}`);
        }
      }
    }
    if (spec.key === "stok") {
      let wrong = 0;
      for (const [code, qty] of Object.entries(expected.stok)) {
        const row = one.satirlar.find(r => r["Stok Kodu"] === code);
        const got = row ? Number(String(row.Mevcut).replace(/\./g, "").replace(",", ".").replace("−", "-")) : null;
        if (got === null || !Number.isFinite(got) || Math.abs(got - Number(qty)) > 0.0005) {
          wrong += 1;
          bad.push(`${label} stok-durumu · ${code}: ekran ${row?.Mevcut ?? "YOK"} · beklenen ${qty}`);
        }
      }
      lines.push(`${wrong ? "✗" : "✓"} ${label} stok-durumu · ${Object.keys(expected.stok).length} kalemin Mevcut'u (${wrong} farklı)`);
      rows.push({ rapor: "stok", kalem: `${Object.keys(expected.stok).length} kalemin Mevcut miktarı`, beklenen: Object.keys(expected.stok).length, ekran: Object.keys(expected.stok).length - wrong, ok: !wrong, bulgu: "" });
    }
    for (const kind of ["pdf", "excel"]) {
      const f = one.dosya?.[kind];
      if (!f) continue;
      const ok = f.status === 200 && f.sirketli && !f.eksik.length;
      rows.push({ rapor: spec.key, kalem: kind === "pdf" ? "PDF" : "Excel", beklenen: null, ekran: null, ok, bulgu: "", dosya: true });
      lines.push(`${ok ? "✓" : "✗"} ${label} ${spec.key} ${kind.toUpperCase()}: ${f.status}${f.sirketli ? "" : " · ŞİRKETSİZ BAĞLANTI"}${f.eksik.length ? ` · ekrandaki ${f.eksik.join(", ")} dosyada yok` : " · ekrandaki sayılar dosyada"}`);
      if (!ok) bad.push(`${label} ${spec.key} ${kind}: ${f.status} şirketli=${f.sirketli} eksik=${f.eksik.join(",")}`);
    }
  }
  const anlik = { "Nakit Kasa": expected.anlik.nakit_kasa, "Banka / POS": expected.anlik.banka_pos, "Alacak Cari": expected.anlik.alacak_cari, "Alacak Çek": expected.anlik.alacak_cek, "Borç Cari": expected.anlik.borc_cari, "Borç Çek": expected.anlik.borc_cek };
  for (const [name, want] of Object.entries(anlik)) {
    const got = read.anlik.ozet[name];
    const ok = got !== null && Number.isFinite(got) && Math.abs(got - Number(want)) < 0.005;
    lines.push(`${ok ? "✓" : "✗"} ${label} ANLIK DURUM · ${name}: ekran ${got ?? "—"} · beklenen ${want}`);
    rows.push({ rapor: "anlik", kalem: name, beklenen: Number(want), ekran: got, ok, bulgu: "" });
    if (!ok) bad.push(`${label} ANLIK DURUM · ${name}: ekran ${got} · beklenen ${want}`);
  }
  return { lines, bad, rows };
}

// ---------- Karşılaştırma ----------
async function snapshot(c) {
  const accounts = (await c.get("/api/workspace/accounts?status=all&limit=5000")).data.accounts;
  const stock = (await c.get("/api/workspace/stock?limit=500")).data;
  const invoices = (await c.get("/api/workspace/invoices?tab=all&limit=5000")).data.invoices.filter(d => d.status === "issued");
  const cheques = (await c.get("/api/workspace/cheques?status=all&limit=5000")).data.cheques;
  const plans = (await c.get("/api/workspace/plans?status=all&limit=5000")).data.plans;
  const cash = {};
  for (const method of ["cash", "bank", "card"]) {
    const r = (await c.get(`/api/workspace/cash?method=${method}`)).data;
    cash[method] = r?.totals || r?.summary || r;
  }
  const integrity = (await c.get("/api/workspace/ledger/integrity")).data;
  const sum = list => Math.round(list.reduce((s, x) => s + Number(x || 0), 0) * 100) / 100;
  const byKind = {};
  for (const d of invoices) {
    const k = d.kind;
    byKind[k] ||= { adet: 0, toplam: 0, odenen: 0, acik: 0 };
    byKind[k].adet += 1;
    byKind[k].toplam = Math.round((byKind[k].toplam + Number(d.tryPayable)) * 100) / 100;
    byKind[k].odenen = Math.round((byKind[k].odenen + Number(d.paid || 0)) * 100) / 100;
    byKind[k].acik = Math.round((byKind[k].acik + Number(d.open || 0)) * 100) / 100;
  }
  return {
    cari: Object.fromEntries(accounts.map(a => [a.refNo, { ad: a.name, borc: a.debit, alacak: a.credit, bakiye: a.balance }])),
    stok: Object.fromEntries((stock.items || []).map(s => [s.code, s.qty])),
    stokDegeri: stock.totals?.value,
    fatura: byKind,
    cek: { adet: cheques.length, toplam: sum(cheques.map(x => x.amount)), durum: cheques.reduce((m, x) => ((m[`${x.direction}:${x.status}`] = (m[`${x.direction}:${x.status}`] || 0) + 1), m), {}) },
    taksit: { kart: plans.length, toplam: sum(plans.map(p => p.totals.total)), odenen: sum(plans.map(p => p.totals.paid)), kalan: sum(plans.map(p => p.totals.remaining)) },
    kasa: cash,
    mutabakat: { ok: integrity?.ok, gecen: integrity?.checks?.filter(x => x.ok).length, toplam: integrity?.checks?.length },
    ekFatura: Object.fromEntries(invoices.filter(d => d.note === "EK-12" || d.number === "KR-2025-01" || d.displayNo === "KR-2025-01").map(d => [d.note === "EK-12" ? "EK-12" : "EK-07", { odenecek: d.tryPayable, odenen: d.paid, acik: d.open, durum: d.payState || d.payStatus || "" }])),
  };
}
function diff(a, b, at = "") {
  if (typeof a === "number" || typeof b === "number") return Math.abs(Number(a) - Number(b)) < 0.005 ? [] : [`${at}: API ${a} · Ekran ${b}`];
  if (a && b && typeof a === "object" && typeof b === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].flatMap(k => diff(a[k], b[k], at ? `${at}.${k}` : k));
  }
  return JSON.stringify(a) === JSON.stringify(b) ? [] : [`${at}: API ${JSON.stringify(a)} · Ekran ${JSON.stringify(b)}`];
}

const result = { hafta: `${FROM} – ${TO}`, islem: week.length, turler: {}, ekran: [], api: [], farklar: [], sayfaHatalari: [], ekranHatasi: [] };
try {
  const admin = staff(BASE);
  if ((await admin.login("admin", PASS)).status !== 200) throw new Error("yönetici girişi");
  await admin.put("/api/companies/sirket-001", { name: "API Şirketi" });
  const made = await admin.post("/api/companies", { name: "Ekran Şirketi" });
  const C1 = "sirket-001";
  const C2 = made.data.company.id;
  const DAYS = DAYS_OF(week);
  log(`Hafta ${FROM} – ${TO}: ${week.length} işlem + ${EXTRAS.length} ek işlem (tarih sırasında); başlangıç verisi ${base.length} işlem (${base.map(op => op.no).join(", ")})`);
  for (const op of week) result.turler[`${op.type}:${op.mode || ""}:${op.method || op.instrument || ""}`] = (result.turler[`${op.type}:${op.mode || ""}:${op.method || op.instrument || ""}`] || 0) + 1;

  // Başlangıç: iki şirkete aynı yol (cari ve stok listesi ekrandan Excel'le; personel/gider carileri ve önceki taksitli satışlar API'den).
  const page = await newPage();
  await login(page);
  const ctx = {};
  for (const [label, id] of [["API Şirketi", C1], ["Ekran Şirketi", C2]]) {
    await pickCompany(page, id);
    log(`■ ${label}: cari listesi → ${await importSheet(page, "accounts", "Cari Listesi")}`);
    log(`■ ${label}: ürün listesi → ${await importSheet(page, "stock", "Ürün Listesi")}`);
    const c = admin.withCompany(id);
    for (const [ref, name] of DATA.personnel) await c.post("/api/workspace/accounts", { name, refNo: ref, type: "other", note: "Personel (maaş ödemeleri)" });
    for (const [i, name] of DATA.categories.entries()) await c.post("/api/workspace/accounts", { name: `Gider: ${name}`, refNo: `GDR-${String(i + 1).padStart(2, "0")}`, type: "supplier", note: "Gider ödemeleri (Excel'de cari yok)" });
    const accounts = (await c.get("/api/workspace/accounts?status=all&limit=5000")).data.accounts;
    const acc = new Map(accounts.map(a => [a.refNo, a]));
    for (const a of accounts) if (a.name.startsWith("Gider: ")) acc.set(a.name, a);
    const stock = (await c.get("/api/workspace/stock?limit=500")).data;
    const item = new Map((stock.items || []).map(s => [s.code, s]));
    ctx[id] = { acc, item, plans: {}, client: c };
    ctx[id].refresh = async () => {
      const list = (await c.get("/api/workspace/accounts?status=all&limit=5000")).data.accounts;
      for (const a of list) acc.set(a.refNo, a);
      for (const a of list) if (a.name.startsWith("Gider: ")) acc.set(a.name, a);
      for (const st of (await c.get("/api/workspace/stock?limit=500")).data.items || []) item.set(st.code, st);
    };
    for (const op of base) {
      const res = await apiOp(c, op, ctx[id]);
      if (res.status !== 200) log(`  ✗ başlangıç ${label} ${op.no}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
    }
    log(`  ${label}: ${accounts.length} cari, ${(stock.items || []).length} ürün, başlangıç işlemleri girildi`);
  }
  ctxFor = ctx;
  const before = [await snapshot(ctx[C1].client), await snapshot(ctx[C2].client)];
  const startDiff = diff(before[0], before[1]);
  log(`Başlangıçta iki şirket ${startDiff.length ? `FARKLI (${startDiff.length})` : "aynı"}${startDiff.length ? `: ${startDiff.slice(0, 10).join(" | ")}` : ""}`);
  result.baslangicFarki = startDiff;

  // 001: API.
  const t0 = Date.now();
  for (const op of DAYS) {
    const res = op.extra ? await apiExtra(ctx[C1].client, op, ctx[C1]) : await apiOp(ctx[C1].client, op, ctx[C1]);
    result.api.push({ no: op.no, type: op.type, ok: res.status === 200, status: res.status, error: res.status === 200 ? "" : res.data?.error || "" });
    if (res.status !== 200) log(`  ✗ API ${op.no} ${op.type}: ${res.status} ${res.data?.error || JSON.stringify(res.data).slice(0, 200)}`);
  }
  log(`API: ${result.api.filter(r => r.ok).length}/${result.api.length} işlem (${((Date.now() - t0) / 1000).toFixed(1)} sn)`);

  // 002: ekrandan.
  await pickCompany(page, C2);
  const screenOp = screenAgent(page, C2, ctx[C2]);
  const t1 = Date.now();
  for (const op of DAYS) {
    const started = Date.now();
    try {
      const note = await screenOp(op);
      result.ekran.push({ no: op.no, type: op.type, ok: true, sn: (Date.now() - started) / 1000, note });
      log(`  ✓ ekran ${op.no} ${op.date} ${op.type} ${op.mode || op.method || op.instrument || op.name || op.code || ""} · ${((Date.now() - started) / 1000).toFixed(1)} sn · ${String(note).slice(0, 90)}`);
    } catch (error) {
      await shot(page, `${op.no}-HATA`);
      const t = (await toasts(page)).join(" | ");
      result.ekran.push({ no: op.no, type: op.type, ok: false, error: error.message.split("\n")[0], toasts: t });
      log(`  ✗ ekran ${op.no} ${op.type}: ${error.message.split("\n")[0]} · bildirimler: ${t}`);
      await closeAll(page);
    }
  }
  log(`Ekran: ${result.ekran.filter(r => r.ok).length}/${result.ekran.length} işlem (${((Date.now() - t1) / 60000).toFixed(1)} dk)`);
  result.sayfaHatalari = page.errorsSeen;

  const after = [await snapshot(ctx[C1].client), await snapshot(ctx[C2].client)];
  result.sonuc = { api: after[0], ekran: after[1] };
  result.farklar = diff(after[0], after[1]);
  log(`\nKARŞILAŞTIRMA: ${result.farklar.length ? `${result.farklar.length} FARK` : "FARK YOK"}`);
  for (const line of result.farklar.slice(0, 60)) log(`  ${line}`);
  log(`Mutabakat: API ${JSON.stringify(after[0].mutabakat)} · Ekran ${JSON.stringify(after[1].mutabakat)}`);
  log(`Faturalar: API ${JSON.stringify(after[0].fatura)}`);
  log(`Çek/Senet: API ${JSON.stringify(after[0].cek)} · Taksit: ${JSON.stringify(after[0].taksit)}`);
  log(`Sayfa hataları: ${page.errorsSeen.length ? page.errorsSeen.join(" ; ") : "yok"}`);
  log(`Ekranda silinen alan (bilinen hata): ${result.ekranHatasi.length} kez${result.ekranHatasi.length ? ` · ${result.ekranHatasi.slice(0, 12).join(" | ")}` : ""}`);
  log(`Aynı adla cari denemesi: ${JSON.stringify(result.ayniAd || null)}`);
  log(`Ek faturalar (API): ${JSON.stringify(after[0].ekFatura)} · (Ekran): ${JSON.stringify(after[1].ekFatura)}`);

  // Bağımsız beklenen hesap (programın kodu kullanılmaz) ve raporlar ekrandan — iki şirkette de.
  const beklenenFile = path.join(OUT, "beklenen-hafta.json");
  execFileSync("python3", [path.join(HERE, "model-hafta.py"), path.join(HERE, "veri/islemler.json"), path.join(HERE, "veri/hafta-ekler.json"), FROM, TO, beklenenFile], { encoding: "utf8" });
  const expected = JSON.parse(fs.readFileSync(beklenenFile, "utf8"));
  result.raporlar = {};
  result.raporFarklari = [];
  for (const [label, id] of [["Ekran", C2], ["API", C1]]) {
    await pickCompany(page, id);
    const read = await readReports(page, id, label === "Ekran" ? "ekran" : "api");
    const { lines, bad, rows } = checkReports(read, expected, label);
    result.raporlar[label] = read;
    result.kontrol ||= {};
    result.kontrol[label] = rows;
    result.raporFarklari.push(...bad);
    log(`\nRAPORLAR (${label} şirketi) ↔ BAĞIMSIZ BEKLENEN:`);
    for (const line of lines) log(`  ${line}`);
  }
  // İki şirketin rapor özetleri birbirinin aynısı mı?
  const same = REPORTS.flatMap(spec => diff(result.raporlar.API[spec.key]?.ozet || {}, result.raporlar.Ekran[spec.key]?.ozet || {}, spec.key));
  result.raporSirketFarki = same;
  log(`\nRapor özetleri API şirketi ↔ Ekran şirketi: ${same.length ? `${same.length} FARK: ${same.slice(0, 20).join(" | ")}` : "aynı"}`);
  const known = result.raporFarklari.filter(line => /\(Bulgu \d/.test(line));
  const unknown = result.raporFarklari.filter(line => !/\(Bulgu \d/.test(line));
  log(`Rapor ↔ beklenen: ${result.raporFarklari.length ? `${result.raporFarklari.length} FARK (${known.length} bilinen bulgudan, ${unknown.length} açıklanmamış)` : "FARK YOK"}`);
  for (const line of unknown) log(`  ✗ AÇIKLANMAMIŞ ${line}`);
  for (const line of known) log(`  ✗ ${line}`);
  log(`Sayfa hataları (raporlar dahil): ${page.errorsSeen.length ? page.errorsSeen.join(" ; ") : "yok"}`);
} catch (error) {
  log("DURDU:", error.stack);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(OUT, "ekran-hafta-sonuc.json"), JSON.stringify(result, null, 1));
  await browser.close();
  await app.close();
}
