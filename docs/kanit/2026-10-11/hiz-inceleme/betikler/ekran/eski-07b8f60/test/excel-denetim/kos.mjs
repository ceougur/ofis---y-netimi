// Excel denetimi (04.10.2026, kullanıcı isteği): iki şirket kurulur, yüklenen Excel'deki 4.220 iş HER İKİ şirkete girilir.
// Her şirkette aynı anda üç personel (satış, alış/gider, tahsilat/ödeme/maaş) ve bir arayüz personeli çalışır; arayüz
// personeli her ödeme biçiminden örnek satışları ve tahsilatları tarayıcıdan, gerçek kullanıcı gibi girer.
// Aşamalar: node kos.mjs kur | yukle   (SP ortam değişkeni: çalışma klasörü; LIMIT: deneme için işlem sınırı)
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { HERE, PASS, STAFF_PASS, staff, startServer } from "./ortak.mjs";

const SP = process.env.SP || path.join(HERE, "calisma");
const ROOT = path.join(SP, "canli");
const OUT = path.join(HERE, "cikti");
const SHOTS = path.join(OUT, "ekran");
const STAGE = process.argv[2] || "kur";
const DATE_TO = process.env.DATE_TO || "9999-12-31";
const DATA = JSON.parse(fs.readFileSync(path.join(HERE, "veri/islemler.json"), "utf8"));
const EXCEL = path.join(HERE, "veri/Sirket_Is_Listesi_Stoklu.xlsx");
const STATE = path.join(ROOT, "durum.json");
fs.mkdirSync(SHOTS, { recursive: true });

const logFile = path.join(OUT, `kayit-${STAGE}.txt`);
fs.writeFileSync(logFile, "");
const log = (...parts) => {
  const line = parts.join(" ");
  console.log(line);
  fs.appendFileSync(logFile, `${line}\n`);
};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const trNum = n => String(n).replace(".", ",");

const app = startServer(ROOT, { fresh: STAGE === "kur" });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const inv = `${modal} .hof-invoices-modal`;

async function newPage(name) {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR", acceptDownloads: true })).newPage();
  page.errorsSeen = [];
  page.on("pageerror", error => page.errorsSeen.push(`${name} pageerror: ${error.message}`));
  page.on("dialog", dialog => dialog.accept());
  return page;
}
let shotNo = 0;
async function shot(page, name) {
  shotNo += 1;
  await page.screenshot({ path: path.join(SHOTS, `${STAGE}-${String(shotNo).padStart(3, "0")}-${name}.png`) }).catch(() => null);
}
async function login(page, username, password) {
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-company", { timeout: 20000 });
  await page.click("#hof-license-banner [data-close], .hof-license-note [data-close]").catch(() => null);
}
async function pickCompany(page, id) {
  await page.click("#hof-company [data-toggle]");
  await page.waitForSelector(`#hof-company [data-pick="${id}"]`);
  await Promise.all([page.waitForEvent("load"), page.click(`#hof-company [data-pick="${id}"]`)]);
  await page.waitForSelector("#hof-company", { timeout: 20000 });
}
async function closeAll(page) {
  for (let i = 0; i < 8 && (await page.$(modal)); i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
  }
}
const toasts = page => page.$$eval(".hof-toast", nodes => nodes.map(node => node.textContent.replace(/×$/, "").trim())).catch(() => []);

// ---------- KUR ----------
async function kur() {
  const admin = staff(BASE);
  if ((await admin.login("admin", PASS)).status !== 200) throw new Error("yönetici girişi");
  const A = await newPage("yonetici");
  await login(A, "admin", PASS);
  await shot(A, "yonetici-ilk-giris");

  // 001: ilk şirket programın kendisinde; unvanı Yönetim'deki gibi değiştirilir.
  const renamed = await admin.put("/api/companies/sirket-001", { name: "Merkez Ticaret A.Ş." });
  log("001 unvan:", renamed.status, renamed.data?.company?.label || JSON.stringify(renamed.data).slice(0, 200));

  // 002: arayüzden, sol üstteki Şirket kutusu → + Yeni Şirket.
  await A.reload();
  await A.waitForSelector("#hof-company");
  await A.click("#hof-company [data-toggle]");
  await A.click("#hof-company [data-new]");
  await A.waitForSelector(`${top} input[name=name]`);
  const code = await A.inputValue(`${top} input[name=code]`);
  await A.fill(`${top} input[name=name]`, "Şube Ticaret Ltd. Şti.");
  await shot(A, "yeni-sirket-formu");
  await Promise.all([A.waitForEvent("load"), A.click(`${top} button[type=submit]`)]);
  await A.waitForSelector("#hof-company");
  await shot(A, "sirket-002-acildi");
  const companies = (await admin.get("/api/companies")).data.companies;
  log("şirketler:", companies.map(c => `${c.id}=${c.code} · ${c.name}`).join(" | "), "önerilen kod:", code);
  const C1 = companies.find(c => c.code === "001");
  const C2 = companies.find(c => c.code === "002");
  const state = { companies: { "001": C1.id, "002": C2.id }, users: {}, uploads: {} };

  for (const [codeKey, id] of Object.entries(state.companies)) {
    await pickCompany(A, id);
    log(`\n■ ${codeKey}: Cari → Excel / Sheets'ten Yükle → yüklenen dosya → Cari Listesi`);
    state.uploads[codeKey] = {};
    state.uploads[codeKey].accounts = await importSheet(A, "accounts", "Cari Listesi", `${codeKey}-cari`);
    log(`■ ${codeKey}: Stok → Excel / Sheets'ten Yükle → Ürün Listesi`);
    state.uploads[codeKey].stock = await importSheet(A, "stock", "Ürün Listesi", `${codeKey}-stok`);
    const c = admin.withCompany(id);
    // Excel'de cari listesinde olmayan karşı taraflar: personel (maaş) ve gider türleri. Yeni Cari ile açılır.
    for (const [ref, name] of DATA.personnel) {
      const r = await c.post("/api/workspace/accounts", { name, refNo: ref, type: "other", note: "Personel (maaş ödemeleri)" });
      if (r.status !== 200) log("personel cari hatası", ref, r.status, JSON.stringify(r.data).slice(0, 200));
    }
    for (const [i, name] of DATA.categories.entries()) {
      const r = await c.post("/api/workspace/accounts", { name: `Gider: ${name}`, refNo: `GDR-${String(i + 1).padStart(2, "0")}`, type: "supplier", note: "Gider ödemeleri (Excel'de cari yok)" });
      if (r.status !== 200) log("gider cari hatası", name, r.status, JSON.stringify(r.data).slice(0, 200));
    }
    const accounts = (await c.get("/api/workspace/accounts?status=all&limit=2000")).data;
    const stock = (await c.get("/api/workspace/stock?limit=500")).data;
    log(`${codeKey}: cari ${accounts.total ?? accounts.accounts.length}, stok kartı ${(stock.items || stock.rows || []).length}`);
  }

  // Personel: her şirkette 3 API personeli + 1 arayüz personeli (Muhasebe rolü, yalnız kendi şirketi); 1 "Personel" rolü
  // (dar yetkili) ve 1 iki şirketli muhasebe müdürü (saldırı ve denetim adımları için).
  const users = [];
  for (const codeKey of ["001", "002"]) for (const role of ["satis", "alis", "tahsilat", "arayuz"]) users.push({ username: `${role}${codeKey}`, name: `${role[0].toUpperCase()}${role.slice(1)} Personeli ${codeKey}`, role: "muhasebe", companies: [codeKey] });
  users.push({ username: "stajyer001", name: "Stajyer (Personel Rolü)", role: "personel", companies: ["001"] });
  users.push({ username: "mudur", name: "Muhasebe Müdürü", role: "muhasebe", companies: ["001", "002"] });
  for (const u of users) {
    const made = await admin.post("/api/admin/users", { username: u.username, name: u.name, role: u.role, password: STAFF_PASS, mustChangePassword: false });
    if (made.status !== 200) throw new Error(`kullanıcı ${u.username}: ${JSON.stringify(made.data)}`);
    const id = made.data.user?.id || made.data.id;
    const access = await admin.put(`/api/companies/access/${id}`, { companies: u.companies.map(k => state.companies[k]) });
    log("kullanıcı", u.username, u.role, "şirketler:", u.companies.join(","), "→", access.status);
    state.users[u.username] = { id, role: u.role, companies: u.companies };
  }
  fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
  log("\nKurulum bitti.");
}

async function importSheet(page, action, sheet, label) {
  await closeAll(page);
  await page.click(`#hof-sidecard [data-action="${action}"]`);
  await page.waitForSelector(`${top} [data-act="import"]`, { timeout: 15000 });
  await page.click(`${top} [data-act="import"]`);
  await page.waitForSelector(`${top} [data-src="excel"]`);
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.click(`${top} [data-src="excel"]`)]);
  await chooser.setFiles(EXCEL);
  await page.waitForSelector(`${top} select[name=sheet]`, { timeout: 20000 });
  await page.selectOption(`${top} select[name=sheet]`, sheet);
  await shot(page, `${label}-sayfa-secimi`);
  await page.click(`${top} button[type=submit]`);
  await page.waitForSelector(`${top} .hof-import-form`, { timeout: 20000 });
  await page.waitForTimeout(800);
  const roles = await page.$$eval(`${top} .hof-import-form select[name^="c"]`, nodes => nodes.map(node => `${node.closest("label,div")?.querySelector("b,strong,span")?.textContent?.trim() || node.name}→${node.value}`));
  const intro = await page.$eval(`${top} .hof-import-form`, node => node.innerText);
  const warnLine = (intro.match(/\d+ satır hazır[^\n]*/) || [""])[0];
  // Satır raporu (uyarılar): kapalı ayrıntıyı aç, metni kaydet.
  await page.$$eval(`${top} .hof-import-form details`, nodes => nodes.forEach(node => (node.open = true))).catch(() => null);
  const report = await page.$eval(`${top} .hof-import-form`, node => node.querySelector("details")?.innerText || "").catch(() => "");
  await shot(page, `${label}-esleme`);
  await page.click(`${top} .hof-import-form button[type="submit"]`);
  await page.waitForFunction(() => document.querySelector(".hof-toast"), null, { timeout: 60000 }).catch(() => null);
  await page.waitForTimeout(1500);
  const result = (await toasts(page)).join(" | ");
  await shot(page, `${label}-sonuc`);
  log(`  eşleme: ${roles.join(", ")}`);
  log(`  ${warnLine}`);
  if (report) log(`  satır raporu: ${report.replace(/\s+/g, " ").slice(0, 1500)}`);
  log(`  sonuç: ${result}`);
  await closeAll(page);
  return { roles, warnLine, report: report.slice(0, 4000), result };
}

// ---------- YÜKLE ----------
const metrics = { latency: {}, errors: [], warnings: {}, done: {}, ui: [] };
const recordLatency = (kind, ms) => ((metrics.latency[kind] ||= []).push(ms));

async function call(client, method, url, body, kind) {
  const started = performance.now();
  let res = await client[method](url, body);
  recordLatency(kind, performance.now() - started);
  // Program "eksi bakiye / eksi stok" uyarısı verir; ekrandaki kullanıcı "Yine de Kaydet" der (force).
  if (res.status === 409 && ["cash-negative", "stock-negative"].includes(res.data?.code)) {
    metrics.warnings[res.data.code] = (metrics.warnings[res.data.code] || 0) + 1;
    const again = { ...body, force: true, cashForce: true };
    const t = performance.now();
    res = await client[method](url, again);
    recordLatency(kind, performance.now() - t);
    if (res.status === 409 && ["cash-negative", "stock-negative"].includes(res.data?.code)) {
      metrics.warnings[`${res.data.code}-2`] = (metrics.warnings[`${res.data.code}-2`] || 0) + 1;
      res = await client[method](url, { ...again });
    }
  }
  return res;
}

import { DatabaseSync } from "node:sqlite";
function doneKeys(companyCode, state) {
  const dir = state.companyDirs?.[companyCode] ?? (companyCode === "001" ? "" : `sirketler/${companyCode}`);
  const db = new DatabaseSync(path.join(ROOT, "data", dir, "destekofis.sqlite"), { readOnly: true });
  try {
    const keys = new Set();
    for (const r of db.prepare("SELECT note, number, kind FROM invoices WHERE status = 'issued'").all()) { if (r.kind === "sale" && r.note) keys.add(r.note.trim()); if (r.kind === "purchase" && r.number) keys.add(r.number.trim()); }
    for (const r of db.prepare("SELECT note, kind FROM account_entries").all()) { const m = /^(ISL-\d+)/.exec(r.note || ""); if (m) keys.add(r.kind === "credit" ? `${m[1]}:tahakkuk` : r.kind === "out" && /maaş/.test(r.note) ? `${m[1]}:maas` : m[1]); }
    for (const r of db.prepare("SELECT serial_no AS s FROM cheques WHERE deleted_at IS NULL").all()) if (r.s) keys.add(r.s);
    for (const r of db.prepare("SELECT note FROM plan_entries").all()) { const m = /^(ISL-\d+)/.exec(r.note || ""); if (m) keys.add(m[1]); }
    return keys;
  } finally { db.close(); }
}
async function yukle() {
  const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
  const ops = DATA.ops.filter(op => op.type !== "cari" && op.date <= DATE_TO);
  // UI'ya ayrılan işlemler: satışta her ödeme biçiminin İLK örneği; tahsilatta nakit/havale/POS, bir taksit tahsilatı, bir ödeme.
  const sales = ops.filter(op => op.type === "sale").sort((a, b) => (a.date + a.no).localeCompare(b.date + b.no));
  const dupNames = new Set(Object.entries(DATA.cari.reduce((m, c) => ((m[c.name] = (m[c.name] || 0) + 1), m), {})).filter(([, n]) => n > 1).map(([n]) => n));
  const nameOf = code => DATA.cari.find(c => c.code === code)?.name || "";
  const uiKeys = new Set();
  const uiOps = new Set();
  for (const op of sales) {
    const key = op.mode === "paid" ? `paid-${op.method}` : op.mode === "cheque" ? `cheque-${op.instrument}` : op.mode;
    if (!uiKeys.has(key) && !dupNames.has(nameOf(op.code))) { uiKeys.add(key); uiOps.add(op.no); }
  }
  const rest = ops.filter(op => !["sale", "purchase", "expense"].includes(op.type)).sort((a, b) => (a.date + a.no).localeCompare(b.date + b.no));
  for (const want of ["collect:cash", "collect:bank", "collect:card", "pay:cash", "installment:cash"]) {
    const [type, method] = want.split(":");
    const op = rest.find(o => o.type === type && o.method === method && !dupNames.has(nameOf(o.code)));
    if (op) uiOps.add(op.no);
  }
  if (STAGE === "devam") uiOps.clear();
  log(`Arayüzden girilecek ${uiOps.size} işlem/şirket: ${[...uiOps].join(", ")}`);

  const runs = Object.entries(state.companies).map(([codeKey, id]) => runCompany(codeKey, id, ops, sales, rest, uiOps));
  const started = Date.now();
  await Promise.all(runs);
  metrics.seconds = (Date.now() - started) / 1000;
  const summary = {
    seconds: metrics.seconds,
    done: metrics.done,
    warnings: metrics.warnings,
    errors: metrics.errors,
    ui: metrics.ui,
    latency: Object.fromEntries(Object.entries(metrics.latency).map(([k, v]) => { const s = [...v].sort((a, b) => a - b); return [k, { n: s.length, ortalama: +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(1), p95: +s[Math.floor(s.length * 0.95)].toFixed(1), max: +s.at(-1).toFixed(1) }]; })),
  };
  fs.writeFileSync(path.join(OUT, `yukleme-ozeti${STAGE === "devam" ? "-devam" : ""}.json`), JSON.stringify(summary, null, 1));
  log(`\nYükleme bitti: ${metrics.seconds.toFixed(0)} sn; hatalar ${metrics.errors.length}; uyarılar ${JSON.stringify(metrics.warnings)}`);
  log(JSON.stringify(summary.done));
  log(JSON.stringify(summary.latency));
}

async function runCompany(codeKey, companyId, ops, sales, rest, uiOps) {
  const login2 = async username => {
    const s = staff(BASE, companyId);
    const r = await s.login(username, STAFF_PASS);
    if (r.status !== 200) throw new Error(`${username} girişi: ${JSON.stringify(r.data)}`);
    return s;
  };
  const [satis, alis, tahsilat] = await Promise.all([login2(`satis${codeKey}`), login2(`alis${codeKey}`), login2(`tahsilat${codeKey}`)]);
  const accounts = (await satis.get("/api/workspace/accounts?status=all&limit=5000")).data.accounts;
  const acc = new Map(accounts.map(a => [a.refNo, a]));
  for (const a of accounts) if (a.name.startsWith("Gider: ")) acc.set(a.name, a);
  const items = (await satis.get("/api/workspace/stock?limit=500")).data;
  const stockRows = items.items || items.rows || items.stock || [];
  const item = new Map(stockRows.map(s => [s.code, s]));
  const done = (metrics.done[codeKey] = {});
  const count = (type, how) => ((done[`${type}:${how}`] = (done[`${type}:${how}`] || 0) + 1));
  const fail = (op, res, who) => {
    metrics.errors.push({ company: codeKey, no: op.no, type: op.type, who, status: res.status, error: res.data?.error || JSON.stringify(res.data).slice(0, 300), code: res.data?.code || "" });
    log(`  ✗ ${codeKey} ${op.no} ${op.type} (${who}): ${res.status} ${res.data?.error || JSON.stringify(res.data).slice(0, 200)}`);
  };
  const planOf = {}; // satış İşlem No → { planId, items }
  const planWait = {};
  const planReady = no => (planWait[no] ||= (() => { let resolve; const p = new Promise(r => (resolve = r)); p.resolve = resolve; return p; })());

  const ui = STAGE === "devam" ? { sale: async () => null, entry: async () => false, installment: async () => false, close: async () => {} } : await uiAgent(codeKey, companyId, acc, item);
  const already = STAGE === "devam" ? doneKeys(codeKey, JSON.parse(fs.readFileSync(STATE, "utf8"))) : new Set();
  const isDone = op => op.type === "salary" ? already.has(`${op.no}:maas`) : already.has(op.no);
  if (STAGE === "devam") {
    const skipped = ops.filter(isDone).length;
    log(`  ${codeKey}: veri tabanında zaten olan ${skipped} işlem atlanacak; kalan ${ops.length - skipped}`);
    // Taksitli satışı yapılmış olanların taksit kartları (veri tabanından: invoices.plan_id → plan_items sırası).
    const dir = codeKey === "001" ? "" : `sirketler/${codeKey}`;
    const db = new DatabaseSync(path.join(ROOT, "data", dir, "destekofis.sqlite"), { readOnly: true });
    for (const row of db.prepare("SELECT note, plan_id AS planId FROM invoices WHERE kind = 'sale' AND status = 'issued' AND plan_id IS NOT NULL AND plan_id <> ''").all()) {
      const no = (row.note || "").trim();
      const items = db.prepare("SELECT id FROM plan_items WHERE plan_id = ? ORDER BY seq").all(row.planId).map(r => r.id);
      planOf[no] = { planId: row.planId, items };
      planReady(no).resolve(planOf[no]);
    }
    db.close();
  }

  const invoiceBody = op => {
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
  };
  const afterSale = async (op, invoice, client) => {
    if (op.mode !== "installments") return;
    const doc = invoice?.id ? (await client.get(`/api/workspace/invoices/${invoice.id}`)).data : null;
    const planId = doc?.planId || doc?.plan?.id;
    if (!planId) return log(`  ! ${codeKey} ${op.no}: taksit kartı bulunamadı`);
    const plan = (await client.get(`/api/workspace/plans/${planId}`)).data;
    planOf[op.no] = { planId, items: plan.items.map(i => i.id) };
    planReady(op.no).resolve(planOf[op.no]);
  };

  // Satış personeli: VUK 231 numara/tarih sırası → satışlar tarih sırasıyla; arayüze ayrılanları arayüz personeli girer.
  const satisJob = async () => {
    for (const op of sales) {
      if (isDone(op)) continue;
      if (uiOps.has(op.no)) {
        const r = await ui.sale(op);
        if (r) { count("sale", "arayüz"); await afterSale(op, r, satis); continue; }
      }
      const res = await call(satis, "post", "/api/workspace/invoices", invoiceBody(op), "satış faturası");
      if (res.status !== 200) { fail(op, res, "satis"); continue; }
      count("sale", op.mode);
      if (Math.abs(Number(res.data.tryPayable) - Number(op.payable)) > 0.005) metrics.errors.push({ company: codeKey, no: op.no, type: "tutar-farkı", program: res.data.tryPayable, model: op.payable });
      await afterSale(op, res.data, satis);
    }
  };
  const alisJob = async () => {
    const list = ops.filter(op => op.type === "purchase" || op.type === "expense").sort((a, b) => (a.date + a.no).localeCompare(b.date + b.no));
    for (const op of list) {
      if (isDone(op)) continue;
      const res = await call(alis, "post", "/api/workspace/invoices", invoiceBody(op), op.type === "purchase" ? "alış faturası" : "gider faturası");
      if (res.status !== 200) { fail(op, res, "alis"); continue; }
      count(op.type, op.mode || op.method);
      const want = Number(op.type === "expense" ? op.gross : op.payable);
      if (Math.abs(Number(res.data.tryPayable) - want) > 0.005) metrics.errors.push({ company: codeKey, no: op.no, type: "tutar-farkı", program: res.data.tryPayable, model: want });
    }
  };
  const tahsilatJob = async () => {
    for (const op of rest) {
      if (isDone(op)) continue;
      if (uiOps.has(op.no)) {
        const ok = op.type === "installment" ? await ui.installment(op, await planReady(op.sale)) : await ui.entry(op);
        if (ok) { count(op.type, "arayüz"); continue; }
      }
      let res;
      const a = acc.get(op.code);
      if (op.type === "salary") {
        res = already.has(`${op.no}:tahakkuk`) ? { status: 200 } : await call(tahsilat, "post", `/api/workspace/accounts/${a.id}/entries`, { kind: "credit", amount: Number(op.amount), date: op.date, note: `${op.no} ${op.note} (tahakkuk)` }, "maaş tahakkuku");
        if (res.status === 200) res = await call(tahsilat, "post", `/api/workspace/accounts/${a.id}/entries`, { kind: "out", amount: Number(op.amount), date: op.date, method: op.method, note: `${op.no} maaş ödemesi` }, "maaş ödemesi");
      } else if (op.type === "installment") {
        const plan = await planReady(op.sale);
        if (op.instrument) res = await call(tahsilat, "post", "/api/workspace/cheques", { direction: "in", instrument: op.instrument, accountId: a.id, planId: plan.planId, itemId: plan.items[op.seq - 1], amount: Number(op.amount), issueDate: op.date, dueDate: op.due, serialNo: op.no, bank: "Excel" }, "taksit tahsilatı (çek)");
        else res = await call(tahsilat, "post", `/api/workspace/plans/${plan.planId}/entries`, { kind: "in", amount: Number(op.amount), date: op.date, method: op.method, itemId: plan.items[op.seq - 1], note: op.no }, "taksit tahsilatı");
      } else if (op.instrument) {
        res = await call(tahsilat, "post", "/api/workspace/cheques", { direction: op.type === "collect" ? "in" : "out", instrument: op.instrument, accountId: a.id, amount: Number(op.amount), issueDate: op.date, dueDate: op.due, serialNo: op.no, bank: "Excel" }, op.type === "collect" ? "alınan çek/senet" : "verilen çek/senet");
      } else {
        res = await call(tahsilat, "post", `/api/workspace/accounts/${a.id}/entries`, { kind: op.type === "collect" ? "in" : "out", amount: Number(op.amount), date: op.date, method: op.method, note: op.no }, op.type === "collect" ? "cari tahsilat" : "cari ödeme");
      }
      if (res.status !== 200) { fail(op, res, "tahsilat"); continue; }
      count(op.type, op.instrument || op.method);
    }
  };
  // Taksit tahsilatı bekleyen satış hiç girilemezse kuyruk kilitlenmesin.
  const satisDone = satisJob().finally(() => { for (const p of Object.values(planWait)) p.resolve?.({ planId: "", items: [] }); });
  await Promise.all([satisDone, alisJob(), tahsilatJob()]);
  await ui.close();
}

// Arayüz personeli: tarayıcıda giriş yapar, kendi şirketini seçer, işlemleri ekrandan girer.
async function uiAgent(codeKey, companyId, acc, item) {
  const page = await newPage(`arayuz${codeKey}`);
  await login(page, `arayuz${codeKey}`, STAFF_PASS);
  const shown = await page.textContent("#hof-company strong").catch(() => "");
  if (!shown.includes(codeKey)) await pickCompany(page, companyId);
  log(`  arayüz personeli ${codeKey} giriş yaptı; ekrandaki şirket: ${(await page.textContent("#hof-company strong")).trim()}`);
  let queue = Promise.resolve();
  const serial = fn => (queue = queue.then(fn, fn));
  const record = (op, ok, note) => { metrics.ui.push({ company: codeKey, no: op.no, type: op.type, ok, note }); log(`  ${ok ? "✓" : "✗"} arayüz ${codeKey} ${op.no} ${op.type}: ${note}`); };
  const api = url => page.evaluate(async u => (await (await fetch(u)).json()).data, `${url}${url.includes("?") ? "&" : "?"}hofCompany=${companyId}`);

  const saleCount = async () => (await api("/api/workspace/invoices?tab=sale"))?.tabCounts?.sale ?? -1;
  const sale = op => serial(async () => {
    const countBefore = await saleCount();
    try {
      await closeAll(page);
      await page.click("#hof-sidecard [data-action=invoices]");
      await page.waitForSelector(`${inv} [data-act="new"]`);
      await page.click(`${inv} [data-act="new"]`);
      await page.click(`${inv} [data-scenario="goods_sale"]`);
      await page.waitForSelector(`${inv} [data-lines]`);
      await page.fill(`${inv} [data-f="issueDate"]`, op.date);
      await page.dispatchEvent(`${inv} [data-f="issueDate"]`, "change");
      const a = acc.get(op.code);
      await page.fill(`${inv} [data-acc-query]`, a.name);
      await page.waitForSelector(`${inv} .hof-acc-picker li[data-id]`);
      const picks = await page.$$(`${inv} .hof-acc-picker li[data-id="${a.id}"]`);
      await (picks[0] || (await page.$(`${inv} .hof-acc-picker li[data-id]`))).dispatchEvent("mousedown");
      const product = item.get(op.product);
      await page.click(`${inv} [data-l="0"][data-f="name"]`);
      await page.keyboard.type(product.name);
      await page.waitForSelector(`${inv} [data-hits="0"] li[data-item]`);
      await page.click(`${inv} [data-hits="0"] li[data-item]`);
      await page.fill(`${inv} [data-l="0"][data-f="qty"]`, trNum(op.qty));
      await page.fill(`${inv} [data-l="0"][data-f="unitPrice"]`, trNum(op.price));
      await page.selectOption(`${inv} [data-l="0"][data-f="vatRate"]`, String(op.vatRate));
      await page.fill(`${inv} [data-f="note"]`, op.no).catch(() => null);
      await page.waitForTimeout(900);
      if (op.mode === "paid") {
        await page.click(`${inv} [data-act="pay-add-cash"]`);
        await page.selectOption(`${inv} [data-pay="cash"][data-f="method"]`, op.method);
        await page.fill(`${inv} [data-pay="cash"][data-i="0"][data-f="amount"]`, trNum(op.payable));
      } else if (op.mode === "cheque") {
        await page.click(`${inv} [data-act="pay-add-cheque"]`);
        await page.selectOption(`${inv} [data-pay="cheques"][data-i="0"][data-f="instrument"]`, op.instrument);
        await page.fill(`${inv} [data-pay="cheques"][data-i="0"][data-f="amount"]`, trNum(op.payable));
        await page.fill(`${inv} [data-pay="cheques"][data-i="0"][data-f="dueDate"]`, op.due);
        await page.fill(`${inv} [data-pay="cheques"][data-i="0"][data-f="serialNo"]`, op.no);
        await page.fill(`${inv} [data-pay="cheques"][data-i="0"][data-f="bank"]`, "Excel");
      } else if (op.mode === "installments") {
        await page.click(`${inv} [data-rest="installments"]`);
        await page.waitForSelector(`${inv} [data-payf="installments.count"]`);
        await page.fill(`${inv} [data-payf="installments.count"]`, String(op.count));
        await page.fill(`${inv} [data-payf="installments.firstDue"]`, op.firstDue);
      } else {
        await page.click(`${inv} [data-rest="open"]`).catch(() => null);
        await page.fill(`${inv} [data-payf="dueDate"]`, op.due);
      }
      await page.waitForTimeout(900);
      const totals = (await page.textContent(`${inv} [data-totals]`)).replace(/\s+/g, " ");
      await shot(page, `${codeKey}-arayuz-satis-${op.mode}${op.method ? `-${op.method}` : op.instrument ? `-${op.instrument}` : ""}-formu`);
      await page.click(`${inv} [data-act="issue"]`);
      // Onay penceresi; eksi stok sorusu çıkarsa "Yine de Kaydet".
      for (let i = 0; i < 3; i += 1) {
        const yes = await page.waitForSelector(`${modal} [data-answer="yes"]`, { timeout: 6000 }).catch(() => null);
        if (!yes) break;
        const question = await page.$eval(`${modal}:has([data-answer="yes"])`, n => n.innerText.replace(/\s+/g, " ").slice(0, 200)).catch(() => "");
        if (/eksi/i.test(question)) metrics.warnings["arayüz-eksi-sorusu"] = (metrics.warnings["arayüz-eksi-sorusu"] || 0) + 1;
        await page.click(`${modal} [data-answer="yes"]`);
        await page.waitForTimeout(600);
        if (await page.$(`${inv} .hof-inv-pills`)) break;
      }
      await page.waitForSelector(`${inv} .hof-inv-pills`, { timeout: 15000 });
      const title = (await page.textContent(`${inv} .hof-plan-title h3`)).replace(/\s+/g, " ").trim();
      await shot(page, `${codeKey}-arayuz-satis-karti`);
      const number = (title.match(/[A-Z]{3}\d{13}/) || [""])[0];
      const list = await api(`/api/workspace/invoices?tab=sale&account=${a.id}`);
      const doc = (list?.invoices || []).find(d => d.number === number);
      const detail = doc ? await api(`/api/workspace/invoices/${doc.id}`) : { issued: true, number };
      const okSum = detail && Math.abs(Number(detail.tryPayable) - Number(op.payable)) < 0.005;
      record(op, Boolean(okSum), `${title} · formdaki toplamlar: ${totals.slice(0, 140)} · program ${detail?.tryPayable} / model ${op.payable}`);
      await closeAll(page);
      return detail;
    } catch (error) {
      await shot(page, `${codeKey}-arayuz-HATA-${op.no}`);
      const issued = (await saleCount()) > countBefore;
      record(op, false, `arayüz girişi tamamlanamadı (${issued ? "fatura KESİLDİ, API'den tekrar girilmez" : "fatura kesilmedi, API'den girilecek"}): ${error.message.split("\n")[0]} · bildirimler: ${(await toasts(page)).join(" | ")}`);
      await closeAll(page);
      return issued ? { issued: true } : null;
    }
  });

  const openAccount = async a => {
    await closeAll(page);
    await page.click("#hof-sidecard [data-action=accounts]");
    await page.waitForSelector(`${top} input[data-filter="q"]`);
    await page.fill(`${top} input[data-filter="q"]`, a.refNo);
    await page.waitForSelector(`${top} tr[data-account="${a.id}"]`, { timeout: 10000 });
    await page.click(`${top} tr[data-account="${a.id}"]`);
    await page.waitForSelector(`${top} [data-entry="in"]`);
  };
  const fillEntry = async (op, label) => {
    await page.waitForSelector(`${top} form input[name=amount]`);
    await page.fill(`${top} form input[name=amount]`, trNum(op.amount));
    if (await page.$(`${top} form select[name=method]`)) await page.selectOption(`${top} form select[name=method]`, op.method);
    await page.fill(`${top} form input[name=date]`, op.date);
    if (await page.$(`${top} form [name=note]`)) await page.fill(`${top} form [name=note]`, op.no);
    await shot(page, label);
    await page.click(`${top} form button[type=submit]`);
    const yes = await page.waitForSelector(`${modal} [data-answer="yes"]`, { timeout: 2500 }).catch(() => null);
    if (yes) { metrics.warnings["arayüz-eksi-sorusu"] = (metrics.warnings["arayüz-eksi-sorusu"] || 0) + 1; await page.click(`${modal} [data-answer="yes"]`); }
    await page.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(n => /kaydedildi|Tahsilat|Ödeme/.test(n.textContent)), null, { timeout: 10000 });
    return (await toasts(page)).at(-1) || "";
  };
  const entry = op => serial(async () => {
    try {
      const a = acc.get(op.code);
      const before = (await api(`/api/workspace/accounts/${a.id}`)).totals.balance;
      await openAccount(a);
      await page.click(`${top} [data-entry="${op.type === "collect" ? "in" : "out"}"]`);
      if (op.type === "collect" && (await page.waitForSelector(`${top} [data-plain]`, { timeout: 1500 }).catch(() => null))) await page.click(`${top} [data-plain]`);
      const toast = await fillEntry(op, `${codeKey}-arayuz-${op.type}-${op.method}`);
      const after = (await api(`/api/workspace/accounts/${a.id}`)).totals.balance;
      const want = before + (op.type === "collect" ? -1 : 1) * Number(op.amount);
      record(op, Math.abs(after - want) < 0.005, `${a.name}: bakiye ${before} → ${after} (beklenen ${want.toFixed(2)}) · ${toast}`);
      await closeAll(page);
      return Math.abs(after - want) < 0.005;
    } catch (error) {
      await shot(page, `${codeKey}-arayuz-HATA-${op.no}`);
      record(op, false, `arayüz girişi yapılamadı: ${error.message.split("\n")[0]}`);
      await closeAll(page);
      return false;
    }
  });
  const installment = (op, plan) => serial(async () => {
    try {
      const a = acc.get(op.code);
      const before = (await api(`/api/workspace/plans/${plan.planId}`)).totals;
      await openAccount(a);
      await page.click(`${top} [data-entry="in"]`);
      await page.waitForSelector(`${top} [data-plan="${plan.planId}"]`, { timeout: 5000 });
      await shot(page, `${codeKey}-arayuz-taksit-secimi`);
      await page.click(`${top} [data-plan="${plan.planId}"]`);
      const toast = await fillEntry(op, `${codeKey}-arayuz-taksit-tahsilati`);
      const after = (await api(`/api/workspace/plans/${plan.planId}`)).totals;
      const ok = Math.abs(after.paid - before.paid - Number(op.amount)) < 0.005;
      record(op, ok, `taksit kartı ödenen ${before.paid} → ${after.paid} (+${op.amount}) · ${toast}`);
      await closeAll(page);
      return ok;
    } catch (error) {
      await shot(page, `${codeKey}-arayuz-HATA-${op.no}`);
      record(op, false, `arayüz girişi yapılamadı: ${error.message.split("\n")[0]}`);
      await closeAll(page);
      return false;
    }
  });
  return { sale, entry, installment, close: async () => { await queue; if (page.errorsSeen.length) log(`  arayüz ${codeKey} sayfa hataları: ${page.errorsSeen.join(" ; ")}`); await page.context().close(); } };
}

try {
  if (STAGE === "kur") await kur();
  else if (STAGE === "yukle" || STAGE === "devam") await yukle();
  else throw new Error(`bilinmeyen aşama ${STAGE}`);
} catch (error) {
  log("DURDU:", error.stack);
  process.exitCode = 1;
} finally {
  await browser.close();
  await app.close();
}
