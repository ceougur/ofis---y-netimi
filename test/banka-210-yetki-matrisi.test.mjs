// 2.1.0 Aşama 15 — Yetki matrisi: BÜTÜN banka uçları ve bankaya bağlı modül uçları × roller (plan §7 "Yetki" sütunu, §9.1, §9.2,
// §12.3 Aşama 15 "Bütün uçların yetki matrisi testi"; kabul 36'nın bileşenleri).
//
// Roller: yönetici, avukat, muhasebe, personel, özel rol ("Banka Operatörü": banka hareketi girer ama silemez/transfer yapamaz/hesap
// tanımlayamaz), yetkisi kaldırılmış (muhasebe; kişiden bütün banka yetkileri kaldırılmış).
// Beklenen BAĞIMSIZ: her ucun gerektirdiği yetki planın §7 tablosundan ve §9.2 kurallarından (bankaya giriş = modülün tahsilat yetkisi;
// bankadan çıkış = modül yönetimi + bank.move; Kasa ↔ Banka = cash.manage + bank.transfer; banka bağlı satırı silme bank.cancel, parasını
// değiştirme bank.move; yalnız açıklama modül yetkisi) bu dosyada yazıldı. Rollerin yetkileri: banka anahtarları planın §9.1 tablosundan,
// modül anahtarları yerleşik rol tanımından (permissionsFor; katalog ayrı testte: banka-210-yetki-katalog).
// Her hücrede: izinli → beklenen kod (çoğunda 200; gövdesi bilinçli geçersiz olanlarda 400/404 — "403 değil"); izinsiz → 403 VE veri
// tabanında hiçbir para/banka tablosu değişmez (içerik özeti önce = sonra).
// Kapsam denetimi: server/routes/bank.mjs'teki her uç matriste (yeni uç eklenirse test kırılır — matrise eklensin).
//
// Ayrıca (Aşama 15 Nasıl Bozarım; plan §12.4 Yetki):
//   Y1  Personel kendi girdiği havale tahsilatını sil / nakde çevir / başka hesaba taşı → 403 (cari, kayıt, taksit); açıklama → 200
//   Y2  Salt okunur lisans (LICENSE_READ_ONLY): bütün modül havale uçları (cari, kayıt, taksit, stok, çek, fatura, Kasa ↔ Banka, transfer)
//       → 403; okuma uçları 200
//   Y3  İki ayrı kullanıcı oturumu, iki ayrı bağlantı, aynı Engelle hesabından farklı carilere aynı anda ödeme → biri 200, öbürü 409
//   Y4  Ödeme yönünde aynı istek kimliği iki kez → tek satır (cari, fatura alış peşini, çek ödemesi)
//   Y5  Kredi / vadeli / kart hesabından cari ödemesi → 400 bank-account-invalid (kalıcı test; eşleme S3)
//   Y6  ?hofCompany=: yetkisiz şirket 403; başka şirketin hesap kimliği 404; öbür şirkette hiçbir şey değişmez
//   Y7  previous alanı olmayan audit: statik tarama (bank.post'a op != create ile giden her çağrı prev taşır; banka rotalarındaki her
//       düzeltme/silme audit'i previous yazar)
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import http from "node:http";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { permissionsFor } from "../server/lib/permissions.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";
import { apiOf, integrityOk } from "./banka-210-ortak.mjs";
import { BANK, NOW, TODAY, bootBank, expectStatus, must, openAcceptanceAccounts, openAccount } from "./banka-210-hesap-ortak.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BANK_KEYS = ["bank.view", "bank.reports", "bank.accounts", "bank.move", "bank.cancel", "bank.transfer", "bank.pos", "bank.commission", "bank.statement", "bank.reconcile", "bank.settings"];
// Plan §9.1 "Varsayılan roller" sütunu.
const PLAN_BANK = {
  admin: BANK_KEYS,
  muhasebe: BANK_KEYS,
  avukat: ["bank.view", "bank.reports", "bank.move", "bank.cancel", "bank.transfer", "bank.statement", "bank.reconcile"],
  personel: [],
};
const OPERATOR = ["accounts.view", "accounts.collect", "accounts.manage", "payments.create", "plans.view", "plans.collect", "cash.view", "cash.manage", "invoices.view", "invoices.manage", "stock.view", "stock.move", "stock.sell", "cheques.view", "cheques.manage", "bank.view", "bank.move"];
const ROLES = ["yonetici", "avukat", "muhasebe", "personel", "ozel", "kaldirilmis"];
const CHOICE = ["bank.view", "accounts.collect", "plans.collect", "payments.create", "invoices.manage", "stock.sell", "stock.manage", "cheques.manage", "cash.manage"];

/** Para ve banka tablolarının içerik özeti: izinsiz istekten sonra aynı kalmalı. */
const TABLES = ["fin_events", "bank_lines", "bank_accounts", "bank_plans", "account_entries", "payments", "plans", "plan_entries", "stock_moves", "cheques", "cheque_events", "invoices", "cash_entries"];
function fingerprint(store) {
  const hash = createHash("sha256");
  for (const table of TABLES) hash.update(JSON.stringify(store.all(`SELECT * FROM ${table} ORDER BY rowid`)));
  hash.update(JSON.stringify(store.all("SELECT key, value FROM settings WHERE key LIKE 'bank.%' AND key <> 'bank.granted' ORDER BY key")));
  return hash.digest("hex");
}

function rawRequest(base, cookie, method, url, body) {
  const target = new URL(base + url);
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: target.hostname, port: target.port, path: target.pathname + target.search, method, agent: false, headers: { cookie, "content-type": "application/json", "content-length": Buffer.byteLength(payload), connection: "close" } }, res => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", chunk => (text += chunk));
      res.on("end", () => {
        let data = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
        resolve({ status: res.statusCode, code: data?.code || "", received: process.hrtime.bigint() });
      });
    });
    req.on("error", reject);
    req.end(payload);
  });
}

describe("Aşama 15 — yetki matrisi: banka uçları ve bankaya bağlı modül uçları × 6 rol", () => {
  let ctx;
  let acc;
  let loan;
  let card;
  let customer;
  let supplier;
  let item;
  const users = {};
  const perms = {};
  const stats = { cells: 0, allowed: 0, denied: 0 };
  before(async () => {
    ctx = await bootBank();
    acc = await openAcceptanceAccounts(ctx.api);
    loan = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "Ticari Kredi", kind: "loan", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    card = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Şirket Kartı", kind: "card", creditLimit: "50.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    customer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "Müşteri M", type: "customer", registeredOn: "2026-09-01" }));
    supplier = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "Tedarikçi T", type: "supplier", registeredOn: "2026-09-01" }));
    item = await must("ürün", ctx.api.post("/api/workspace/stock", { name: "Ürün Y", unit: "Adet", openingQty: "100000", unitPrice: "1" }));
    await must("Kasa nakit", ctx.api.post("/api/workspace/cash", { kind: "in", amount: "1.000.000", date: TODAY, description: "Açılış nakdi", method: "cash" }));
    users.yonetici = ctx.api;
    users.avukat = apiOf(await createUser(ctx.server, ctx.api.client, { username: "avukat1", role: "avukat" }));
    users.muhasebe = apiOf(await createUser(ctx.server, ctx.api.client, { username: "muhasebe1", role: "muhasebe" }));
    users.personel = apiOf(await createUser(ctx.server, ctx.api.client, { username: "personel1", role: "personel" }));
    const role = await must("özel rol", ctx.api.post("/api/admin/roles", { name: "Banka Operatörü", permissions: OPERATOR }));
    users.ozel = apiOf(await createUser(ctx.server, ctx.api.client, { username: "operator1", role: role.id }));
    users.kaldirilmis = apiOf(await createUser(ctx.server, ctx.api.client, { username: "muhasebe2", role: "muhasebe" }));
    const list = await must("kullanıcılar", ctx.api.get("/api/admin/users"));
    const target = list.find(user => user.username === "muhasebe2");
    assert.equal((await ctx.api.client.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove: BANK_KEYS } })).status, 200);
    const builtin = role => [...permissionsFor(role).filter(key => !key.startsWith("bank.")), ...PLAN_BANK[role]];
    perms.yonetici = new Set(builtin("admin"));
    perms.avukat = new Set(builtin("avukat"));
    perms.muhasebe = new Set(builtin("muhasebe"));
    perms.personel = new Set(builtin("personel"));
    perms.ozel = new Set(OPERATOR);
    perms.kaldirilmis = new Set(builtin("muhasebe").filter(key => !key.startsWith("bank.")));
    // Rolün sunucudaki etkin yetkileri bu bağımsız tabloyla aynı mı (banka anahtarlarında)? Değilse matrisin beklentisi geçersiz olur.
    for (const name of ROLES) {
      const me = await must(`${name} ben`, users[name].get("/api/auth/me"));
      assert.deepEqual(me.permissions.filter(key => key.startsWith("bank.")).sort(), [...perms[name]].filter(key => key.startsWith("bank.")).sort(), `${name}: etkin banka yetkileri plan §9.1 ile aynı`);
    }
  });
  after(() => ctx?.server.close());

  const has = (role, ...keys) => keys.every(key => perms[role].has(key));
  const any = (role, keys) => keys.some(key => perms[role].has(key));
  const idx = role => ROLES.indexOf(role) + 1;
  const amt = (base, role) => String(base + idx(role));
  // Hazırlıklar yönetici ile (her rol için ayrı hedef: yazan uçlar birbirini etkilemesin).
  const fee = async (account = acc.ziraat) => (await must("fiş", ctx.api.post(`${BANK}/vouchers`, { type: "fee", accountId: account.id, amount: "3", feeType: "eft", tax: "none", similarOk: true }))).id;
  const freshAccount = async (role, opening = true) => openAccount(ctx.api, { bankName: "Akbank", name: `Deneme ${role} ${Math.random().toString(36).slice(2, 7)}`, kind: "demand", ...(opening ? { opening: { date: "2026-10-01", amount: "10", confirmed: true } } : {}) });

  // ---------- Banka uçları (server/routes/bank.mjs): yöntem, yol şablonu, gereken yetki (plan §7), istek ----------
  const BANK_CASES = [
    { route: "GET /summary", need: r => has(r, "bank.view"), run: api => api.get(`${BANK}/summary`) },
    { route: "GET /badge", need: r => has(r, "bank.view"), run: api => api.get(`${BANK}/badge`) },
    { route: "GET /choices", need: r => any(r, CHOICE), run: api => api.get(`${BANK}/choices`) },
    { route: "GET /settings", need: r => has(r, "bank.view"), run: api => api.get(`${BANK}/settings`) },
    { route: "PUT /settings", need: r => has(r, "bank.settings"), prep: async () => (await must("ayar", ctx.api.get(`${BANK}/settings`))).values, run: (api, values) => api.put(`${BANK}/settings`, { values }) },
    { route: "POST /settings/reset", need: r => has(r, "bank.settings"), run: api => api.post(`${BANK}/settings/reset`, {}) },
    { route: "GET /legacy", need: r => has(r, "bank.view"), run: api => api.get(`${BANK}/legacy`) },
    // Gövdesi bilinçli boş (atanacak satır yok): izinli rolde 400, izinsizde 403 — yetki gövdeden önce denetlenir.
    { route: "POST /legacy/assign", need: r => has(r, "bank.accounts"), ok: [400], run: api => api.post(`${BANK}/legacy/assign`, { accountId: acc.ziraat.id, rows: [] }) },
    { route: "POST /legacy/reclass", need: r => has(r, "bank.accounts"), ok: [400], run: api => api.post(`${BANK}/legacy/reclass`, { rows: [] }) },
    { route: "GET /setup", need: r => has(r, "bank.view"), run: api => api.get(`${BANK}/setup`) },
    { route: "POST /setup", need: r => has(r, "bank.accounts"), run: api => api.post(`${BANK}/setup?dryRun=1`, { accountId: acc.ziraat.id, carryClose: true, assign: "all" }) },
    { route: "POST /setup/dismiss", need: r => has(r, "bank.view"), run: api => api.post(`${BANK}/setup/dismiss`, {}) },
    { route: "POST /setup/:id/undo", need: r => has(r, "bank.accounts"), ok: [404], run: api => api.post(`${BANK}/setup/kurulum-yok/undo`, {}) },
    { route: "GET /sub-trial", need: r => has(r, "bank.reports"), run: api => api.get(`${BANK}/sub-trial`) },
    { route: "GET /accounts", need: r => has(r, "bank.view"), run: api => api.get(`${BANK}/accounts`) },
    { route: "POST /accounts", need: r => has(r, "bank.accounts"), run: (api, _, role) => api.post(`${BANK}/accounts`, { bankName: "İş Bankası", name: `Yeni ${role}`, kind: "demand", opening: { date: "2026-10-01", amount: "0", confirmed: true } }) },
    { route: "GET /accounts/:id", need: r => has(r, "bank.view"), run: api => api.get(`${BANK}/accounts/${acc.ziraat.id}`) },
    { route: "PUT /accounts/:id", need: r => has(r, "bank.accounts"), prep: role => freshAccount(role), run: (api, a, role) => api.put(`${BANK}/accounts/${a.id}`, { name: `Adı Değişti ${role}` }) },
    { route: "POST /accounts/:id/status", need: r => has(r, "bank.accounts"), prep: role => freshAccount(role), run: (api, a) => api.post(`${BANK}/accounts/${a.id}/status`, { status: "passive" }) },
    // Açılışsız hesaba "Açılış Bakiyesi Gir": bank.accounts; açılışı olan hesapta "Açılışı Düzelt": + bank.cancel (plan §7).
    { route: "POST /accounts/:id/opening", need: r => has(r, "bank.accounts"), prep: role => freshAccount(role, false), run: (api, a) => api.post(`${BANK}/accounts/${a.id}/opening`, { date: "2026-10-01", amount: "5", confirmed: true }) },
    { route: "POST /accounts/:id/opening", label: "açılışı düzelt", need: r => has(r, "bank.accounts", "bank.cancel"), prep: role => freshAccount(role), run: (api, a) => api.post(`${BANK}/accounts/${a.id}/opening`, { date: "2026-10-01", amount: "15", confirmed: true }) },
    { route: "DELETE /accounts/:id", need: r => has(r, "bank.accounts"), prep: role => freshAccount(role, false), run: (api, a) => api.del(`${BANK}/accounts/${a.id}`) },
    { route: "DELETE /accounts/:id", label: "açılışlı hesap", need: r => has(r, "bank.accounts", "bank.cancel"), prep: role => freshAccount(role), run: (api, a) => api.del(`${BANK}/accounts/${a.id}`) },
    { route: "GET /voucher-meta", need: r => has(r, "bank.view"), run: api => api.get(`${BANK}/voucher-meta`) },
    { route: "POST /vouchers", need: r => has(r, "bank.move"), run: (api, _, role) => api.post(`${BANK}/vouchers`, { type: "fee", accountId: acc.ziraat.id, amount: amt(10, role), feeType: "eft", tax: "none", similarOk: true }) },
    { route: "POST /vouchers", label: "KDV'li masraf", need: r => has(r, "bank.move", "invoices.manage"), run: (api, _, role) => api.post(`${BANK}/vouchers`, { type: "fee", accountId: acc.ziraat.id, amount: amt(120, role), feeType: "eft", tax: "vat_incl", taxRate: "20", partyId: supplier.id, invoiceNo: `ZB-${role}`, similarOk: true }) },
    { route: "POST /vouchers", label: "kredi kullanımı", need: r => has(r, "bank.move", "bank.transfer"), run: (api, _, role) => api.post(`${BANK}/vouchers`, { type: "loan_draw", accountId: acc.garanti.id, loanAccountId: loan.id, amount: amt(1000, role), similarOk: true }) },
    { route: "POST /transfers", need: r => has(r, "bank.transfer"), run: (api, _, role) => api.post(`${BANK}/transfers`, { accountId: acc.ziraat.id, toAccountId: acc.garanti.id, amount: amt(200, role), date: TODAY, similarOk: true }) },
    { route: "GET /movements", need: r => has(r, "bank.view"), run: api => api.get(`${BANK}/movements`) },
    { route: "GET /events/:ref", need: r => has(r, "bank.view"), prep: () => fee(), run: (api, id) => api.get(`${BANK}/events/${id}`) },
    { route: "POST /events/:ref/reverse", need: r => has(r, "bank.cancel"), prep: () => fee(), run: (api, id) => api.post(`${BANK}/events/${id}/reverse`, { reason: "matris" }) },
    { route: "POST /events/:ref/reverse", label: "transfer", need: r => has(r, "bank.cancel", "bank.transfer"), prep: async () => (await must("transfer", ctx.api.post(`${BANK}/transfers`, { accountId: acc.ziraat.id, toAccountId: acc.garanti.id, amount: "7", date: TODAY, similarOk: true }))).id, run: (api, id) => api.post(`${BANK}/events/${id}/reverse`, { reason: "matris" }) },
    { route: "POST /events/:ref/correct", need: r => has(r, "bank.cancel", "bank.move"), prep: () => fee(), run: (api, id) => api.post(`${BANK}/events/${id}/correct`, { amount: "4" }) },
    { route: "PUT /events/:ref/info", need: r => has(r, "bank.move"), prep: () => fee(), run: (api, id) => api.put(`${BANK}/events/${id}/info`, { description: "matris açıklama" }) },
    { route: "GET /plans", need: r => has(r, "bank.view"), run: api => api.get(`${BANK}/plans`) },
    { route: "POST /plans", need: r => has(r, "bank.move"), run: (api, _, role) => api.post(`${BANK}/plans`, { kind: "other_out", accountId: acc.ziraat.id, amount: amt(50, role), plannedDate: "2026-10-20", description: "Kira" }) },
    { route: "POST /plans", label: "planlı transfer", need: r => has(r, "bank.move", "bank.transfer"), run: (api, _, role) => api.post(`${BANK}/plans`, { kind: "transfer", accountId: acc.ziraat.id, toAccountId: acc.garanti.id, amount: amt(60, role), plannedDate: "2026-10-20" }) },
    { route: "POST /plans/:id/execute", need: r => has(r, "bank.move"), prep: async role => (await must("plan", ctx.api.post(`${BANK}/plans`, { kind: "other_out", accountId: acc.ziraat.id, amount: amt(70, role), plannedDate: TODAY, description: "Gerçekleştir" }))).id, run: (api, id) => api.post(`${BANK}/plans/${id}/execute`, { expectedDate: TODAY, similarOk: true }) },
    { route: "POST /plans/:id/execute", label: "planlı transfer", need: r => has(r, "bank.move", "bank.transfer"), prep: async role => (await must("plan", ctx.api.post(`${BANK}/plans`, { kind: "transfer", accountId: acc.ziraat.id, toAccountId: acc.garanti.id, amount: amt(80, role), plannedDate: TODAY }))).id, run: (api, id) => api.post(`${BANK}/plans/${id}/execute`, { expectedDate: TODAY, similarOk: true }) },
    { route: "POST /plans/:id/skip", need: r => has(r, "bank.move"), prep: async role => (await must("plan", ctx.api.post(`${BANK}/plans`, { kind: "other_out", accountId: acc.ziraat.id, amount: amt(90, role), plannedDate: TODAY, repeat: "monthly", description: "Atla" }))).id, run: (api, id) => api.post(`${BANK}/plans/${id}/skip`, { expectedDate: TODAY }) },
    { route: "DELETE /plans/:id", need: r => has(r, "bank.move"), prep: async role => (await must("plan", ctx.api.post(`${BANK}/plans`, { kind: "other_out", accountId: acc.ziraat.id, amount: amt(95, role), plannedDate: "2026-10-30", description: "Sil" }))).id, run: (api, id) => api.del(`${BANK}/plans/${id}`) },
    { route: "GET /reports/fees", need: r => has(r, "bank.reports"), run: api => api.get(`${BANK}/reports/fees`) },
  ];

  // ---------- Bankaya bağlı modül uçları (plan §9.2/2–3) ----------
  const planFor = async role => must("kart", ctx.api.post("/api/workspace/plans", { accountId: customer.id, name: `${customer.name} ${role}`, total: "1.000.000", mode: "auto", count: 2, firstDue: "2026-11-15" }));
  const MODULE_CASES = [
    { route: "cari tahsilat havale", need: r => has(r, "accounts.view", "accounts.collect"), run: (api, _, role) => api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: amt(100, role), method: "bank", bankAccountId: acc.ziraat.id, date: TODAY, similarOk: true }) },
    { route: "cari ödeme havale", need: r => has(r, "accounts.view", "accounts.manage", "bank.move"), run: (api, _, role) => api.post(`/api/workspace/accounts/${supplier.id}/entries`, { kind: "out", amount: amt(110, role), method: "bank", bankAccountId: acc.ziraat.id, date: TODAY, similarOk: true }) },
    { route: "cari ödeme nakit", need: r => has(r, "accounts.view", "accounts.manage"), run: (api, _, role) => api.post(`/api/workspace/accounts/${supplier.id}/entries`, { kind: "out", amount: amt(115, role), method: "cash", date: TODAY, cashForce: true }) },
    { route: "kayıt tahsilatı havale", need: r => has(r, "payments.create"), run: (api, _, role) => api.post(`/api/workspace/cases/MATRIS-${role}/payments`, { amount: amt(120, role), date: TODAY, method: "bank", bankAccountId: acc.garanti.id, caseTitle: `Matris ${role}`, similarOk: true }) },
    { route: "taksit tahsilatı havale", need: r => has(r, "plans.collect"), prep: role => planFor(role), run: (api, plan, role) => api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: amt(130, role), method: "bank", bankAccountId: acc.ziraat.id, date: TODAY, similarOk: true }) },
    { route: "taksit iadesi havale", need: r => has(r, "plans.collect", "plans.manage", "bank.move"), prep: async role => {
      const plan = await planFor(`iade-${role}`);
      await must("iade edilecek tahsilat", ctx.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "1.000", method: "cash", date: TODAY }));
      return plan;
    }, run: (api, plan, role) => api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "out", amount: amt(135, role), method: "bank", bankAccountId: acc.ziraat.id, date: TODAY, similarOk: true }) },
    { route: "stok satışı peşin havale", need: r => has(r, "stock.move") && any(r, ["stock.sell", "stock.manage"]), run: (api, _, role) => api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "1", unitPrice: amt(140, role), pay: "cash", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY, similarOk: true }) },
    { route: "stok alımı peşin havale", need: r => has(r, "stock.move", "stock.manage", "bank.move"), run: (api, _, role) => api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: "1", unitPrice: amt(150, role), pay: "cash", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY, similarOk: true }) },
    { route: "çek bankaya tahsil", need: r => has(r, "cheques.manage"), prep: async role => must("çek", ctx.api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: amt(160, role), issueDate: TODAY, dueDate: "2026-12-31", drawer: "Keşideci", serialNo: `M-IN-${role}` })), run: (api, cheque) => api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "collect", date: TODAY, method: "bank", bankAccountId: acc.garanti.id, similarOk: true }) },
    { route: "verilen çek ödemesi havale", need: r => has(r, "cheques.manage", "bank.move"), prep: async role => must("verilen çek", ctx.api.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: amt(170, role), issueDate: TODAY, dueDate: "2026-12-31", accountId: supplier.id, serialNo: `M-OUT-${role}` })), run: (api, cheque) => api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "pay", date: TODAY, method: "bank", bankAccountId: acc.ziraat.id, similarOk: true }) },
    { route: "satış faturası peşin havale", need: r => has(r, "invoices.manage"), run: (api, _, role) => api.post("/api/workspace/invoices", { kind: "sale", accountId: customer.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: Number(amt(180, role)), discountRate: 0, vatRate: 0 }], payment: { cash: [{ amount: amt(180, role), method: "bank", bankAccountId: acc.ziraat.id }], cheques: [], endorse: [], rest: "open" }, force: true }) },
    { route: "alış faturası peşin havale", need: r => has(r, "invoices.manage", "bank.move"), run: (api, _, role) => api.post("/api/workspace/invoices", { kind: "purchase", accountId: supplier.id, number: `AL-M-${role}`, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Malzeme", qty: 1, unitPrice: Number(amt(190, role)), discountRate: 0, vatRate: 0 }], payment: { cash: [{ amount: amt(190, role), method: "bank", bankAccountId: acc.ziraat.id }], cheques: [], endorse: [], rest: "open" }, force: true }) },
    { route: "Kasadan Bankaya", need: r => has(r, "cash.manage", "bank.transfer"), run: (api, _, role) => api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: amt(200, role), date: TODAY, bankAccountId: acc.garanti.id, similarOk: true }) },
    { route: "Bankadan Kasaya", need: r => has(r, "cash.manage", "bank.transfer"), run: (api, _, role) => api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: amt(210, role), date: TODAY, bankAccountId: acc.ziraat.id, similarOk: true }) },
  ];

  async function cell(kase, role) {
    const prepared = kase.prep ? await kase.prep(role) : undefined;
    const before = fingerprint(ctx.store);
    const res = await kase.run(users[role], prepared, role);
    const allowed = kase.need(role);
    const tag = `${kase.route}${kase.label ? ` (${kase.label})` : ""} × ${role}`;
    stats.cells += 1;
    if (allowed) {
      stats.allowed += 1;
      const okList = kase.ok || [200];
      assert.ok(okList.includes(res.status), `${tag}: izinli, beklenen ${okList.join("/")} — gelen ${res.status} ${res.code || ""} ${res.error || JSON.stringify(res.data).slice(0, 200)}`);
    } else {
      stats.denied += 1;
      assert.equal(res.status, 403, `${tag}: izinsiz, beklenen 403 — gelen ${res.status} ${res.code || ""} ${res.error || ""}`);
      assert.equal(fingerprint(ctx.store), before, `${tag}: izinsiz istek veriyi değiştirdi`);
    }
  }

  it("kapsam: server/routes/bank.mjs'teki her uç matriste (yeni uç → matrise eklenmeli)", () => {
    const source = readFileSync(path.join(ROOT, "server/routes/bank.mjs"), "utf8");
    const routes = [...source.matchAll(/router\.(get|post|put|delete|patch)\(`\$\{BASE\}([^`]*)`/g)].map(([, method, route]) => `${method.toUpperCase()} ${route}`);
    assert.ok(routes.length >= 35, `banka uçları okunamadı (${routes.length})`);
    const covered = new Set(BANK_CASES.map(kase => kase.route));
    const missing = routes.filter(route => !covered.has(route));
    assert.deepEqual(missing, [], `matriste olmayan banka uçları: ${missing.join(", ")}`);
  });

  for (const role of ROLES) {
    it(`banka uçları × ${role}`, async () => {
      for (const kase of BANK_CASES) await cell(kase, role);
    });
    it(`bankaya bağlı modül uçları × ${role}`, async () => {
      for (const kase of MODULE_CASES) await cell(kase, role);
    });
  }

  it("Y1: kendi girdiği havale tahsilatı (cari, kayıt, taksit): sil → bank.cancel; nakde çevir / başka hesaba taşı → bank.move; açıklama herkese açık", async () => {
    let checked = 0;
    for (const role of ROLES) {
      const api = users[role];
      // Kendi tahsilatları (bankaya giriş: modülün tahsilat yetkisi yeter; altısının da var).
      const plan = await planFor(`own-${role}`);
      const rows = {
        cari: async () => {
          const res = await must(`${role} cari`, api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: amt(300, role), method: "bank", bankAccountId: acc.ziraat.id, date: TODAY, similarOk: true }));
          const url = `/api/workspace/accounts/${customer.id}/entries/${res.entryId}`;
          return { del: () => api.del(url), put: body => api.put(url, { kind: "in", amount: amt(300, role), date: TODAY, ...body }) };
        },
        kayit: async () => {
          const res = await must(`${role} kayıt`, api.post(`/api/workspace/cases/OWN-${role}/payments`, { amount: amt(310, role), date: TODAY, method: "bank", bankAccountId: acc.ziraat.id, caseTitle: "Kendi", similarOk: true }));
          const url = `/api/workspace/payments/${res.id}`;
          return { del: () => api.del(url), put: body => api.put(url, { amount: amt(310, role), date: TODAY, ...body }) };
        },
        taksit: async () => {
          const res = await must(`${role} taksit`, api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: amt(320, role), method: "bank", bankAccountId: acc.ziraat.id, date: TODAY, similarOk: true }));
          const url = `/api/workspace/plans/${plan.id}/entries/${res.entryId}`;
          return { del: () => api.del(url), put: body => api.put(url, { amount: amt(320, role), date: TODAY, ...body }) };
        },
      };
      for (const [name, make] of Object.entries(rows)) {
        const row = await make();
        const tag = `${name} × ${role}`;
        const check = async (label, res, need) => {
          checked += 1;
          if (need) assert.equal(res.status, 200, `${tag} ${label}: izinli ${res.status} ${res.code || ""} ${res.error || ""}`);
          else expectStatus(res, 403, "bank-permission", `${tag} ${label}`);
        };
        await check("açıklama", await row.put({ method: "bank", bankAccountId: acc.ziraat.id, note: "yalnız açıklama" }), true);
        const before = fingerprint(ctx.store);
        const toCash = await row.put({ method: "cash", cashForce: true });
        await check("nakde çevir", toCash, has(role, "bank.move"));
        if (toCash.status !== 200) assert.equal(fingerprint(ctx.store), before, `${tag}: reddedilen nakde çevirme veriyi değiştirdi`);
        else await row.put({ method: "bank", bankAccountId: acc.ziraat.id, similarOk: true });
        const moved = await row.put({ method: "bank", bankAccountId: acc.garanti.id });
        await check("Garanti'ye taşı", moved, has(role, "bank.move"));
        const removed = await row.del();
        await check("sil", removed, has(role, "bank.cancel"));
      }
    }
    assert.equal(checked, ROLES.length * 3 * 4);
    await integrityOk(ctx.api, "Y1");
  });

  it("özet: matris hücre sayısı; Mutabakat Testi tutarlı", async () => {
    console.log(`[yetki-matrisi] hücre ${stats.cells} (izinli ${stats.allowed}, izinsiz ${stats.denied}) — ${BANK_CASES.length} banka ucu durumu + ${MODULE_CASES.length} modül ucu × ${ROLES.length} rol`);
    assert.equal(stats.cells, (BANK_CASES.length + MODULE_CASES.length) * ROLES.length);
    await integrityOk(ctx.api, "matris sonu");
  });
});

describe("Aşama 15 — Y3–Y6: eşzamanlılık (iki kullanıcı), ödeme yönünde istek kimliği, kredi/kart hesabından ödeme, şirket ayrımı", () => {
  let ctx;
  let acc;
  before(async () => {
    ctx = await bootBank();
    acc = await openAcceptanceAccounts(ctx.api);
  });
  after(() => ctx?.server.close());

  it("Y3: iki ayrı muhasebe kullanıcısı (iki oturum, iki bağlantı) aynı anda Engelle'deki Garanti'den XYZ ve KLM'ye 40.000 → biri 200, öbürü 409 bank-blocked", async () => {
    const xyz = await must("XYZ", ctx.api.post("/api/workspace/accounts", { name: "XYZ Ltd.", type: "supplier", registeredOn: "2026-09-01" }));
    const klm = await must("KLM", ctx.api.post("/api/workspace/accounts", { name: "KLM Ltd.", type: "supplier", registeredOn: "2026-09-01" }));
    // Garanti 50.000 → 70.000 (Ziraat'ten), Engelle.
    await must("transfer", ctx.api.post(`${BANK}/transfers`, { accountId: acc.ziraat.id, toAccountId: acc.garanti.id, amount: "20.000", date: TODAY }));
    await must("Engelle", ctx.api.put(`${BANK}/accounts/${acc.garanti.id}`, { negativePolicy: "block" }));
    const one = await createUser(ctx.server, ctx.api.client, { username: "muh-a", role: "muhasebe" });
    const two = await createUser(ctx.server, ctx.api.client, { username: "muh-b", role: "muhasebe" });
    assert.notEqual(one.cookie, two.cookie, "iki ayrı oturum");
    const sent = [];
    const results = await Promise.all(
      [[one, xyz], [two, klm]].map(([client, party]) => {
        const call = rawRequest(ctx.server.base, client.cookie, "POST", `/api/workspace/accounts/${party.id}/entries`, { kind: "out", amount: "40.000", method: "bank", bankAccountId: acc.garanti.id, date: TODAY });
        sent.push(process.hrtime.bigint());
        return call;
      }),
    );
    const firstReply = results.map(res => res.received).sort((a, b) => (a < b ? -1 : 1))[0];
    assert.ok(sent.every(at => at < firstReply), "iki istek de ilk yanıttan önce gönderildi");
    assert.deepEqual(results.map(res => res.status).sort(), [200, 409], JSON.stringify(results.map(res => [res.status, res.code])));
    assert.equal(results.find(res => res.status === 409).code, "bank-blocked");
    const garanti = await must("Garanti", ctx.api.get(`${BANK}/accounts/${acc.garanti.id}`));
    assert.equal(garanti.balanceMinor, 3_000_000, "Garanti 70.000 − 40.000 = 30.000; eksiye düşmedi");
    const paid = ctx.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id IN (?, ?) AND kind = 'out'", xyz.id, klm.id).n;
    assert.equal(paid, 1, "yalnız bir ödeme yazıldı");
    await must("Uyar", ctx.api.put(`${BANK}/accounts/${acc.garanti.id}`, { negativePolicy: "warn" }));
    await integrityOk(ctx.api, "Y3");
  });

  it("Y4: ödeme yönünde aynı istek kimliği iki kez → tek satır, ikinci yanıt replayed (cari ödeme, alış faturası peşini, çek ödemesi)", async () => {
    const supplier = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "Ödeme Ltd.", type: "supplier", registeredOn: "2026-09-01" }));
    const send = (url, body, id) => ctx.api.client.post(url, body, { "x-hof-request": id }).then(r => ({ status: r.status, data: r.data?.data ?? r.data }));
    const balance = async () => (await must("Ziraat", ctx.api.get(`${BANK}/accounts/${acc.ziraat.id}`))).balanceMinor;
    const start = await balance();
    // Cari ödeme.
    const body = { kind: "out", amount: "1.234", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY };
    const a = await send(`/api/workspace/accounts/${supplier.id}/entries`, body, "y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y1");
    const b = await send(`/api/workspace/accounts/${supplier.id}/entries`, body, "y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y1");
    assert.deepEqual([a.status, b.status, b.data.replayed], [200, 200, true]);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ? AND kind = 'out' AND source = ''", supplier.id).n, 1);
    // Alış faturası peşini.
    const invoice = { kind: "purchase", accountId: supplier.id, number: "AL-Y4", issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Malzeme", qty: 1, unitPrice: 2000, discountRate: 0, vatRate: 0 }], payment: { cash: [{ amount: "2.000", method: "bank", bankAccountId: acc.ziraat.id }], cheques: [], endorse: [], rest: "open" }, force: true };
    const c = await send("/api/workspace/invoices", invoice, "y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y2");
    const d = await send("/api/workspace/invoices", invoice, "y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y2");
    assert.deepEqual([c.status, d.status], [200, 200], JSON.stringify([c, d]).slice(0, 400));
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM invoices WHERE number = 'AL-Y4'").n, 1, "tek fatura");
    // Verilen çek ödemesi.
    const cheque = await must("çek", ctx.api.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: "500", issueDate: TODAY, dueDate: "2026-12-31", accountId: supplier.id, serialNo: "Y4" }));
    const e = await send(`/api/workspace/cheques/${cheque.id}/actions`, { action: "pay", date: TODAY, method: "bank", bankAccountId: acc.ziraat.id }, "y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y3");
    const f = await send(`/api/workspace/cheques/${cheque.id}/actions`, { action: "pay", date: TODAY, method: "bank", bankAccountId: acc.ziraat.id }, "y4y4y4y4y4y4y4y4y4y4y4y4y4y4y4y3");
    assert.deepEqual([e.status, f.status, f.data.replayed], [200, 200, true]);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM cheque_events WHERE cheque_id = ? AND kind = 'pay'", cheque.id).n, 1, "tek ödeme");
    assert.equal(await balance(), start - 123_400 - 200_000 - 50_000, "Ziraat yalnız birer kez azaldı");
    await integrityOk(ctx.api, "Y4");
  });

  it("Y5: kredi, vadeli ve kurumsal kart hesabından cari ödemesi → 400 bank-account-invalid; hiçbir şey yazılmaz", async () => {
    const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Kredi Deneme", type: "supplier", registeredOn: "2026-09-01" }));
    const loan = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "Ticari Kredi", kind: "loan", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    const time = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Vadeli", kind: "time", opening: { date: "2026-10-01", amount: "10.000", confirmed: true } });
    const card = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Kart", kind: "card", creditLimit: "50.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    // Not: POS/kart yolu (method "card") 2.1.0'da hesaba bağlanmaz (POS 2.2.0'a ertelendi; satır Hesabı Atanmamış kalır) — burada havale yolu.
    for (const [label, account, method] of [["kredi", loan, "bank"], ["vadeli", time, "bank"], ["kart (havale yolu)", card, "bank"]]) {
      const before = fingerprint(ctx.store);
      const res = await ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", amount: "100", method, bankAccountId: account.id, date: TODAY });
      expectStatus(res, 400, "bank-account-invalid", `${label} hesabından cari ödemesi`);
      assert.equal(fingerprint(ctx.store), before, `${label}: hiçbir şey yazılmadı`);
    }
  });

  it("Y6: ?hofCompany= — yetkisiz şirket 403; başka şirketin hesabı 404; 002'deki işlem 001'i değiştirmez", async () => {
    const second = await must("002", ctx.api.post("/api/companies", { name: "İkinci Şirket", select: false }));
    const id = second.id || second.company?.id;
    const q = `?hofCompany=${encodeURIComponent(id)}`;
    const staff = await createUser(ctx.server, ctx.api.client, { username: "muh-001", role: "muhasebe" });
    const list = await must("kullanıcılar", ctx.api.get("/api/admin/users"));
    const staffId = list.find(user => user.username === "muh-001").id;
    assert.equal((await ctx.api.client.put(`/api/companies/access/${staffId}`, { companies: ["sirket-001"] })).status, 200);
    const staffApi = apiOf(staff);
    for (const [method, url, body] of [["get", `${BANK}/accounts${q}`], ["get", `${BANK}/summary${q}`], ["post", `${BANK}/transfers${q}`, { accountId: acc.ziraat.id, toAccountId: acc.garanti.id, amount: "1", date: TODAY }], ["post", `${BANK}/accounts${q}`, { bankName: "X", name: "Y", kind: "demand" }]]) {
      expectStatus(await staffApi[method](url, body), 403, null, `001'e kısıtlı kullanıcı ${method} ${url}`);
    }
    const before = fingerprint(ctx.store);
    // Yönetici 002'de 001'in hesap kimlikleriyle → 404; 002'de kendi hesabı açılır.
    expectStatus(await ctx.api.get(`${BANK}/accounts/${acc.ziraat.id}${q}`), 404, null, "002'de 001'in hesabı");
    expectStatus(await ctx.api.post(`${BANK}/transfers${q}`, { accountId: acc.ziraat.id, toAccountId: acc.garanti.id, amount: "1", date: TODAY }), 404, null, "002'de 001'in hesaplarıyla transfer");
    const party = await must("002 cari", ctx.api.post(`/api/workspace/accounts${q}`, { name: "002 Müşteri", type: "customer", registeredOn: "2026-09-01" }));
    expectStatus(await ctx.api.post(`/api/workspace/accounts/${party.id}/entries${q}`, { kind: "in", amount: "100", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }), 404, "bank-account-missing", "002'de 001'in hesabına tahsilat");
    await must("002 hesap", ctx.api.post(`${BANK}/accounts${q}`, { bankName: "Ziraat Bankası", name: "Ana", kind: "demand", opening: { date: "2026-10-01", amount: "5", confirmed: true } }));
    assert.equal(fingerprint(ctx.store), before, "001'in veri tabanı değişmedi");
  });
});

describe("Aşama 15 — Y2: salt okunur lisansta bankaya bağlı modül havale uçları 403 LICENSE_READ_ONLY", () => {
  it("veri girilmiş şirket salt okunur açılır: cari/kayıt/taksit/stok/çek/fatura/Kasa ↔ Banka/transfer yazımı 403; okuma 200; hiçbir şey değişmez", async () => {
    const dataDir = mkdtempSync(path.join(tmpdir(), "destekofis-saltokunur-"));
    let ids;
    try {
      // 1) Lisanslı (lisans denetimi kapalı) açılış: hesaplar, cari, kart, ürün, çek.
      const first = await startTestServer({ dataDir, now: NOW });
      try {
        const api = apiOf(await loginAdmin(first));
        const acc = await openAcceptanceAccounts(api);
        const party = await must("cari", api.post("/api/workspace/accounts", { name: "ABC", type: "customer", registeredOn: "2026-09-01" }));
        const plan = await must("kart", api.post("/api/workspace/plans", { accountId: party.id, name: "ABC", total: "9.000", mode: "auto", count: 3, firstDue: "2026-11-15" }));
        const item = await must("ürün", api.post("/api/workspace/stock", { name: "Ürün", unit: "Adet", openingQty: "10", unitPrice: "1" }));
        const cheque = await must("çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "400", issueDate: TODAY, dueDate: "2026-12-31", drawer: "K", serialNo: "RO-1" }));
        const entry = await must("havale tahsilatı", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "100", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }));
        ids = { acc, party, plan, item, cheque, entry };
      } finally {
        await first.app.close();
      }
      // 2) Aynı veriyle lisans denetimi açık, lisans sunucusuna ulaşılamıyor → salt okunur.
      const server = await startTestServer({ dataDir, now: NOW, license: { enforce: true, machineId: "0123456789abcdef0123456789abcdef", services: ["https://lisans.test/api/lisans"], fetchImpl: async () => { throw new TypeError("fetch failed"); }, firstCheckDelayMs: 3_600_000 } });
      try {
        const api = apiOf(await loginAdmin(server));
        const { acc, party, plan, item, cheque, entry } = ids;
        const before = fingerprint(server.app.store);
        const writes = [
          ["cari tahsilat havale", "post", `/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "50", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }],
          ["cari havale satırını sil", "del", `/api/workspace/accounts/${party.id}/entries/${entry.entryId}`],
          ["kayıt tahsilatı havale", "post", "/api/workspace/cases/RO/payments", { amount: "50", date: TODAY, method: "bank", bankAccountId: acc.ziraat.id, caseTitle: "RO" }],
          ["taksit tahsilatı havale", "post", `/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "50", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }],
          ["stok satışı peşin havale", "post", `/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "1", unitPrice: "50", pay: "cash", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }],
          ["çek bankaya tahsil", "post", `/api/workspace/cheques/${cheque.id}/actions`, { action: "collect", date: TODAY, method: "bank", bankAccountId: acc.garanti.id }],
          ["satış faturası peşin havale", "post", "/api/workspace/invoices", { kind: "sale", accountId: party.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "H", qty: 1, unitPrice: 50, discountRate: 0, vatRate: 0 }], payment: { cash: [{ amount: "50", method: "bank", bankAccountId: acc.ziraat.id }], cheques: [], endorse: [], rest: "open" }, force: true }],
          ["Kasadan Bankaya", "post", "/api/workspace/cash/transfer", { direction: "to-bank", amount: "10", date: TODAY, bankAccountId: acc.garanti.id }],
          ["bankalar arası transfer", "post", `${BANK}/transfers`, { accountId: acc.ziraat.id, toAccountId: acc.garanti.id, amount: "10", date: TODAY }],
          ["banka fişi", "post", `${BANK}/vouchers`, { type: "fee", accountId: acc.ziraat.id, amount: "5", feeType: "eft", tax: "none" }],
        ];
        for (const [label, method, url, body] of writes) expectStatus(await api[method](url, body), 403, "LICENSE_READ_ONLY", `salt okunur: ${label}`);
        assert.equal(fingerprint(server.app.store), before, "salt okunurda hiçbir para/banka satırı değişmedi");
        for (const url of [`${BANK}/summary`, `${BANK}/accounts`, `${BANK}/movements`, `${BANK}/choices`, `/api/workspace/accounts/${party.id}`]) assert.equal((await api.get(url)).status, 200, `salt okunur okuma ${url}`);
      } finally {
        await server.app.close();
      }
    } finally {
      rmSync(dataDir, { recursive: true, force: true });
    }
  });
});

describe("Aşama 15 — Y7: previous alanı olmayan audit (statik tarama)", () => {
  const files = dir => readdirSync(path.join(ROOT, dir)).filter(name => name.endsWith(".mjs")).map(name => path.join(dir, name));
  const sources = [...files("server/routes"), ...files("server/lib"), ...files("server/lib/bank")].map(file => ({ file, text: readFileSync(path.join(ROOT, file), "utf8") }));

  it("bank.post'a op 'update' | 'delete' | 'move' | 'restore' | 'assign' ile giden her çağrı prev taşır (bank.post prev'siz çağrıyı zaten reddeder; burada kaynakta)", () => {
    let calls = 0;
    const missing = [];
    for (const { file, text } of sources) {
      for (const match of text.matchAll(/bank\.post\(\{/g)) {
        // Çağrının nesnesi: açılış parantezinden eşleşen kapanışa.
        let depth = 0;
        let end = match.index + "bank.post(".length;
        for (; end < text.length; end += 1) {
          if (text[end] === "{") depth += 1;
          else if (text[end] === "}") {
            depth -= 1;
            if (depth === 0) break;
          }
        }
        const call = text.slice(match.index, end + 1);
        const op = /\bop:\s*"([a-z]+)"/.exec(call)?.[1] || (/\bop,|\bop:\s*[a-zA-Z(]/.test(call) ? "dinamik" : "");
        calls += 1;
        if (op === "create") continue;
        if (!/\bprev(\s*:|,|\s*\})/.test(call)) missing.push(`${file}: op ${op || "?"} ${call.slice(0, 120).replace(/\s+/g, " ")}`);
      }
    }
    assert.ok(calls >= 30, `bank.post çağrısı bulunamadı (${calls})`);
    assert.deepEqual(missing, [], `prev'siz bank.post çağrıları:\n${missing.join("\n")}`);
  });

  it("banka rotalarındaki düzeltme/silme/ters kayıt audit kayıtları previous yazar (kaynak: lib/bank/*.mjs)", () => {
    const missing = [];
    let checked = 0;
    for (const { file, text } of sources.filter(item => item.file.includes(`lib${path.sep}bank`) || item.file.endsWith("routes/bank.mjs"))) {
      for (const match of text.matchAll(/audit\??\.?\(?\s*\(?user[^,]*,\s*"(bank\.[a-z.]+)"([\s\S]{0,400}?)\);/g)) {
        const [, type, rest] = match;
        if (!/(updated|deleted|removed|reversed|corrected|status|opening\.corrected|assigned|reclass|undone|cancelled|skipped|moved|restored)/.test(type)) continue;
        checked += 1;
        if (!/previous/.test(rest)) missing.push(`${file}: ${type}`);
      }
    }
    console.log(`[yetki-matrisi] previous denetlenen banka audit türü: ${checked}`);
    assert.deepEqual(missing, [], `previous'sız banka audit kayıtları: ${missing.join(", ")}`);
  });
});
