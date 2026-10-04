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
    const a = op.type === "expense" ? acc.get(`Gider: ${op.category}`) : acc.get(op.code);
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
      const product = item.get(op.product);
      await page.keyboard.type(product.name);
      await page.waitForSelector(`${inv} [data-hits="0"] li[data-item="${product.id}"]`, { timeout: 10000 });
      await page.click(`${inv} [data-hits="0"] li[data-item="${product.id}"]`);
      await page.fill(`${inv} [data-l="0"][data-f="qty"]`, trNum(op.qty));
      await page.fill(`${inv} [data-l="0"][data-f="unitPrice"]`, trNum(op.price));
      await page.selectOption(`${inv} [data-l="0"][data-f="vatRate"]`, String(op.vatRate));
    }
    if (op.type === "sale") await page.fill(`${inv} [data-f="note"]`, op.no).catch(() => null);
    await page.waitForTimeout(900);
    const amount = op.type === "expense" ? op.gross : op.payable;
    if (op.type === "expense" || op.mode === "paid") {
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
  return async op => {
    if (["sale", "purchase", "expense"].includes(op.type)) return invoice(op);
    if (op.type === "installment") return installment(op);
    if (op.instrument) return cheque(op);
    return entry(op);
  };
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
  log(`Hafta ${FROM} – ${TO}: ${week.length} işlem; başlangıç verisi ${base.length} işlem (${base.map(op => op.no).join(", ")})`);
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
    for (const op of base) {
      const res = await apiOp(c, op, ctx[id]);
      if (res.status !== 200) log(`  ✗ başlangıç ${label} ${op.no}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
    }
    log(`  ${label}: ${accounts.length} cari, ${(stock.items || []).length} ürün, başlangıç işlemleri girildi`);
  }
  const before = [await snapshot(ctx[C1].client), await snapshot(ctx[C2].client)];
  const startDiff = diff(before[0], before[1]);
  log(`Başlangıçta iki şirket ${startDiff.length ? `FARKLI (${startDiff.length})` : "aynı"}${startDiff.length ? `: ${startDiff.slice(0, 10).join(" | ")}` : ""}`);
  result.baslangicFarki = startDiff;

  // 001: API.
  const t0 = Date.now();
  for (const op of week) {
    const res = await apiOp(ctx[C1].client, op, ctx[C1]);
    result.api.push({ no: op.no, type: op.type, ok: res.status === 200, status: res.status, error: res.status === 200 ? "" : res.data?.error || "" });
    if (res.status !== 200) log(`  ✗ API ${op.no} ${op.type}: ${res.status} ${res.data?.error || JSON.stringify(res.data).slice(0, 200)}`);
  }
  log(`API: ${result.api.filter(r => r.ok).length}/${week.length} işlem (${((Date.now() - t0) / 1000).toFixed(1)} sn)`);

  // 002: ekrandan.
  await pickCompany(page, C2);
  const screenOp = screenAgent(page, C2, ctx[C2]);
  const t1 = Date.now();
  for (const op of week) {
    const started = Date.now();
    try {
      const note = await screenOp(op);
      result.ekran.push({ no: op.no, type: op.type, ok: true, sn: (Date.now() - started) / 1000, note });
      log(`  ✓ ekran ${op.no} ${op.date} ${op.type} ${op.mode || op.method || op.instrument || ""} · ${((Date.now() - started) / 1000).toFixed(1)} sn · ${String(note).slice(0, 90)}`);
    } catch (error) {
      await shot(page, `${op.no}-HATA`);
      const t = (await toasts(page)).join(" | ");
      result.ekran.push({ no: op.no, type: op.type, ok: false, error: error.message.split("\n")[0], toasts: t });
      log(`  ✗ ekran ${op.no} ${op.type}: ${error.message.split("\n")[0]} · bildirimler: ${t}`);
      await closeAll(page);
    }
  }
  log(`Ekran: ${result.ekran.filter(r => r.ok).length}/${week.length} işlem (${((Date.now() - t1) / 60000).toFixed(1)} dk)`);
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
} catch (error) {
  log("DURDU:", error.stack);
  process.exitCode = 1;
} finally {
  fs.writeFileSync(path.join(OUT, "ekran-hafta-sonuc.json"), JSON.stringify(result, null, 1));
  await browser.close();
  await app.close();
}
