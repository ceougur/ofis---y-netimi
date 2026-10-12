// Bağımsız doğrulayıcı (tur 1) — Bankaya Tahsile Ver "nasıl bozarım" ek denemeleri. Uygulayıcının testinde OLMAYAN yollar.
// Kod değiştirmez; yalnız API'den dener, yanıt kodu + gövde + veri tabanı sayısı + Mutabakat Testi okur. Sahte saat 08.10.2026.
// Koşum: node --test docs/kanit/2026-10-12/tahsile-ver/dogrulayici/d1-bozma.test.mjs
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { subBalances as journalSubs } from "../../../../../server/lib/general-ledger.mjs";
import { createUser, startTestServer, loginAdmin } from "../../../../../test/helpers.mjs";
import { apiOf, integrityOf } from "../../../../../test/banka-210-ortak.mjs";
import { BANK, TODAY, bootBank, lockPeriod, must, openAcceptanceAccounts, openAccount, trialBalances } from "../../../../../test/banka-210-hesap-ortak.mjs";

const CHEQUES = "/api/workspace/cheques";
const act = (api, id, body) => api.post(`${CHEQUES}/${id}/actions`, body);
const count = (store, table, where = "1") => Number(store.get(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).n);
const TABLES = ["cheques", "cheque_events", "cheque_collections", "fin_events", "account_entries", "plan_entries", "cash_entries", "invoices"];
const snapshot = store => Object.fromEntries(TABLES.map(table => [table, count(store, table)]));
const receive = (api, body) => must(`çek al ${body.serialNo || ""}`, api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-05", dueDate: "2026-10-31", ...body }));
const log = (label, value) => console.log(`[d1] ${label}: ${JSON.stringify(value)}`);
const short = res => ({ status: res.status, code: res.code, error: res.error });
async function integrityState(api, label) {
  const result = await integrityOf(api);
  const bad = (result.checks || []).filter(item => item.ok === false).map(item => ({ code: item.code, sample: item.sample }));
  log(`mutabakat ${label}`, { ok: result.ok, bad });
  return result;
}
const chequeSubs = ctx => {
  const subs = journalSubs(ctx.app.ledger.build());
  return { "101.01": (subs.get("101.01") || 0) / 100, "101.02": (subs.get("101.02") || 0) / 100 };
};

async function setup(options = {}) {
  const ctx = await bootBank(options);
  const acc = await openAcceptanceAccounts(ctx.api);
  const buyer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
  const seller = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "XYZ Tedarik", type: "supplier", registeredOn: "2026-09-01" }));
  return { ctx, acc, buyer, seller };
}

describe("D1 — fatura yolları (düzenle / sil / toplu iptal / toplu sil) tahsildeki evrakta", () => {
  let ctx, acc, buyer;
  before(async () => ({ ctx, acc, buyer } = await setup()));
  after(() => ctx.server.close());

  it("satış faturasının çeki tahsildeyken: Düzenle, Sil, Toplu İptal, Toplu Sil reddedilir; hiçbir şey yazılmaz", async () => {
    const doc = await must("satış", ctx.api.post("/api/workspace/invoices", { kind: "sale", accountId: buyer.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: 2000, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [{ instrument: "cheque", amount: "2.000", dueDate: "2026-11-20", serialNo: "F-1", bank: "İş Bankası" }], endorse: [], rest: "open" }, force: true }));
    const chequeId = ctx.store.get("SELECT id FROM cheques WHERE invoice_id = ?", doc.id).id;
    await must("tahsile", act(ctx.api, chequeId, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id }));
    const before_ = snapshot(ctx.store);
    const edit = await ctx.api.post(`/api/workspace/invoices/${doc.id}/edit`, { kind: "sale", accountId: buyer.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: 2500, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [{ instrument: "cheque", amount: "2.000", dueDate: "2026-11-20", serialNo: "F-1", bank: "İş Bankası" }], endorse: [], rest: "open" }, force: true });
    log("fatura düzenle", short(edit));
    const del = await ctx.api.del(`/api/workspace/invoices/${doc.id}`);
    log("fatura sil", short(del));
    const bulkCancel = await ctx.api.post("/api/workspace/invoices/bulk-cancel", { ids: [doc.id], reason: "deneme" });
    log("toplu iptal", { status: bulkCancel.status, data: bulkCancel.data });
    const bulkDelete = await ctx.api.post("/api/workspace/invoices/bulk-delete", { ids: [doc.id] });
    log("toplu sil", { status: bulkDelete.status, data: bulkDelete.data });
    const after_ = snapshot(ctx.store);
    log("sayılar önce/sonra", { before_, after_ });
    assert.equal(ctx.store.get("SELECT status FROM invoices WHERE id = ?", doc.id).status, "issued");
    assert.equal(ctx.store.get("SELECT deleted_at AS d FROM cheques WHERE id = ?", chequeId).d, null, "çek silinmedi");
    assert.equal(count(ctx.store, "cheque_collections", `cheque_id = '${chequeId}' AND status = 'pending'`), 1);
    assert.equal(edit.status, 409);
    assert.equal(del.status, 409);
    assert.deepEqual({ ...after_, fin_events: 0 }, { ...before_, fin_events: 0 });
    const result = await integrityState(ctx.api, "fatura yolları");
    assert.equal(result.ok, true);
  });
});

describe("D2 — Banka İşlem Kartı uçları (Ters Kaydet / Düzelt / Açıklama) tahsil başlığında", () => {
  let ctx, acc, buyer;
  before(async () => ({ ctx, acc, buyer } = await setup()));
  after(() => ctx.server.close());

  it("cheque_deposit başlığı Banka'dan ters kaydedilemez/düzeltilemez; hiçbir şey yazılmaz", async () => {
    const cheque = await receive(ctx.api, { serialNo: "D2-1", accountId: buyer.id });
    const data = await must("tahsile", act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id }));
    const no = data.collection.eventNo;
    const before_ = snapshot(ctx.store);
    const card = await ctx.api.get(`${BANK}/events/${no}`);
    log("işlem kartı", { status: card.status, actions: card.data?.actions, block: card.data?.block });
    const reverse = await ctx.api.post(`${BANK}/events/${no}/reverse`, { reason: "deneme" });
    const correct = await ctx.api.post(`${BANK}/events/${no}/correct`, { amount: "500", date: TODAY });
    const info = await ctx.api.put(`${BANK}/events/${no}/info`, { description: "değişti" });
    log("ters kaydet / düzelt / açıklama", [short(reverse), short(correct), short(info)]);
    assert.ok(reverse.status >= 400 && correct.status >= 400 && info.status >= 400);
    assert.deepEqual(snapshot(ctx.store), before_);
    const movements = await must("hareketler", ctx.api.get(`${BANK}/movements?accountId=${acc.ziraat.id}`));
    const listed = (movements.rows || []).filter(row => row.no === no || row.eventNo === no);
    log("Banka Hareketleri'nde tahsil başlığı", { listed: listed.length, sample: listed[0] });
    assert.equal((await integrityState(ctx.api, "işlem kartı")).ok, true);
  });
});

describe("D3 — alış tarihi değişikliği geri alınmış tahsil kaydından SONRAYA alınır", () => {
  let ctx, acc, buyer;
  before(async () => ({ ctx, acc, buyer } = await setup()));
  after(() => ctx.server.close());

  it("05.10 alındı, 06.10 tahsile verildi, 07.10 geri alındı → alış tarihi 08.10'a çekilebiliyor mu? defter 06.10'da 101.01 eksi mi?", async () => {
    const cheque = await receive(ctx.api, { serialNo: "D3-1", accountId: buyer.id, issueDate: "2026-10-05" });
    await must("tahsile", act(ctx.api, cheque.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: acc.ziraat.id }));
    await must("geri al", act(ctx.api, cheque.id, { action: "bank-withdraw", date: "2026-10-07" }));
    const put = await ctx.api.put(`${CHEQUES}/${cheque.id}`, { issueDate: "2026-10-08" });
    log("alış tarihi 08.10", short(put));
    const amount = await ctx.api.put(`${CHEQUES}/${cheque.id}`, { amount: "1.500" });
    log("tutar 1.500 (geri alınmış kayıttan sonra)", short(amount));
    const subsAt = async to => {
      const data = await must("alt hesap", ctx.api.get(`${BANK}/sub-trial?to=${to}`));
      return Object.fromEntries(data.rows.filter(row => row.account === "101").map(row => [row.sub, row.balance]));
    };
    const at06 = await subsAt("2026-10-06");
    const at07 = await subsAt("2026-10-07");
    const trial06 = (await trialBalances(ctx.api, "?to=2026-10-06"))["101"];
    log("06.10 alt hesaplar / 101", { at06, trial06 });
    log("07.10 alt hesaplar", at07);
    log("bugün alt hesaplar (yevmiye)", chequeSubs(ctx));
    const result = await integrityState(ctx.api, "alış tarihi sonraya");
    assert.equal(result.ok, true);
    if (put.status === 200) assert.ok(!(at06["101.01"] < 0), `06.10'da 101.01 eksi: ${at06["101.01"]} (evrak alınmadan bankaya verilmiş görünür)`);
  });
});

describe("D4 — hesabın açılış tarihinden önce tahsile verme", () => {
  let ctx, acc, buyer;
  before(async () => ({ ctx, acc, buyer } = await setup()));
  after(() => ctx.server.close());

  it("Ziraat açılışı 01.10; 20.09'da alınan çek 25.09'da Ziraat'e tahsile veriliyor mu? 28.09'da tahsil?", async () => {
    const cheque = await receive(ctx.api, { serialNo: "D4-1", accountId: buyer.id, issueDate: "2026-09-20", dueDate: "2026-09-27" });
    const dep = await act(ctx.api, cheque.id, { action: "bank-deposit", date: "2026-09-25", bankAccountId: acc.ziraat.id });
    log("açılıştan önce tahsile ver", short(dep));
    if (dep.status === 200) {
      const col = await act(ctx.api, cheque.id, { action: "collect", date: "2026-09-28" });
      log("açılıştan önce tahsil", short(col));
      const col2 = await act(ctx.api, cheque.id, { action: "collect", date: "2026-10-02" });
      log("açılıştan sonra tahsil", short(col2));
    }
    const result = await integrityState(ctx.api, "açılıştan önce");
    assert.equal(result.ok, true);
    assert.notEqual(dep.status, 200, "hesabın açılışından önceki tarihe tahsile verme kabul edildi (havale/tahsil 409 bank-before-opening alırken)");
  });
});

describe("D5 — Alt Hesap Mizanı 101 ↔ Ana Defter 101 (çeşitli evrak: ciro, carisiz, faturalı, karşılıksız, silinmiş, senet; tarih süzgeci)", () => {
  let ctx, acc, buyer, seller;
  before(async () => ({ ctx, acc, buyer, seller } = await setup()));
  after(() => ctx.server.close());

  it("Σ 101.* (Alt Hesap Mizanı) = 101 (mizan) hem bugün hem tarih aralıklarında; mains 101 ok", async () => {
    const a = await receive(ctx.api, { serialNo: "D5-A", accountId: buyer.id, amount: "1.000", issueDate: "2026-10-02" });
    const b = await receive(ctx.api, { serialNo: "D5-B", accountId: buyer.id, amount: "700", issueDate: "2026-10-02" });
    const free = await receive(ctx.api, { serialNo: "D5-C", amount: "300", issueDate: "2026-10-03", drawer: "Carisiz Kişi" });
    const note = await receive(ctx.api, { serialNo: "D5-D", instrument: "note", accountId: buyer.id, amount: "450", issueDate: "2026-10-03" });
    const gone = await receive(ctx.api, { serialNo: "D5-E", accountId: buyer.id, amount: "222", issueDate: "2026-10-03" });
    const doc = await must("satış", ctx.api.post("/api/workspace/invoices", { kind: "sale", accountId: buyer.id, issueDate: "2026-10-04", pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: 900, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [{ instrument: "cheque", amount: "900", dueDate: "2026-11-20", serialNo: "D5-F" }], endorse: [], rest: "open" }, force: true }));
    const fromInvoice = ctx.store.get("SELECT id FROM cheques WHERE invoice_id = ?", doc.id).id;
    await must("A tahsile", act(ctx.api, a.id, { action: "bank-deposit", date: "2026-10-03", bankAccountId: acc.ziraat.id }));
    await must("A tahsil", act(ctx.api, a.id, { action: "collect", date: "2026-10-06" }));
    await must("B ciro", act(ctx.api, b.id, { action: "endorse", date: "2026-10-04", accountId: seller.id }));
    await must("C tahsile", act(ctx.api, free.id, { action: "bank-deposit", date: "2026-10-04", bankAccountId: acc.garanti.id }));
    await must("C karşılıksız", act(ctx.api, free.id, { action: "bounce", date: "2026-10-07" }));
    await must("D tahsile", act(ctx.api, note.id, { action: "bank-deposit", date: "2026-10-05", bankAccountId: acc.ziraat.id }));
    await must("E tahsile", act(ctx.api, gone.id, { action: "bank-deposit", date: "2026-10-04", bankAccountId: acc.ziraat.id }));
    await must("E geri al", act(ctx.api, gone.id, { action: "bank-withdraw", date: "2026-10-05" }));
    await must("E sil", ctx.api.del(`${CHEQUES}/${gone.id}`));
    await must("F tahsile", act(ctx.api, fromInvoice, { action: "bank-deposit", date: "2026-10-05", bankAccountId: acc.garanti.id }));
    const ranges = [["", ""], ["", "2026-10-04"], ["2026-10-04", "2026-10-06"], ["2026-10-05", ""], ["2026-10-07", "2026-10-08"]];
    const problems = [];
    for (const [from, to] of ranges) {
      const q = `?${from ? `from=${from}` : ""}${from && to ? "&" : ""}${to ? `to=${to}` : ""}`;
      const data = await must("alt hesap", ctx.api.get(`${BANK}/sub-trial${q}`));
      const rows = data.rows.filter(row => row.account === "101");
      const main = (data.mains || []).find(row => row.account === "101");
      // Mizan bakiyesi dönem sonu (to) itibarıyla; Alt Hesap Mizanı bakiyesi devir + dönem.
      const trial = (await trialBalances(ctx.api, to ? `?to=${to}` : ""))["101"] || 0;
      const sum = Math.round(rows.reduce((s, row) => s + row.balance, 0) * 100) / 100;
      log(`aralık ${from || "…"}–${to || "…"}`, { rows: rows.map(r => [r.sub, r.opening, r.debit, r.credit, r.balance]), main, trial101: trial, sum });
      if (Math.abs(sum - trial) > 0.001) problems.push(`${from}–${to}: Σ101.* ${sum} ≠ mizan 101 ${trial}`);
      if (main && main.ok === false) problems.push(`${from}–${to}: mains 101 ok=false`);
      if (rows.some(r => r.balance < 0)) problems.push(`${from}–${to}: eksi alt hesap ${JSON.stringify(rows)}`);
    }
    const subs = chequeSubs(ctx);
    log("yevmiye 101.*", subs);
    // Bağımsız beklenen (planın kuralı, programdan türetilmeden): portföyde B (ciro → çıktı), A tahsil (çıktı), C karşılıksız (çıktı),
    // E silindi; kalan alınan ve portföyde: D (450, tahsilde) + F (900, tahsilde) → 101.02 = 1.350, 101.01 = 0.
    assert.deepEqual(subs, { "101.01": 0, "101.02": 1350 });
    assert.deepEqual(problems, []);
    assert.equal((await integrityState(ctx.api, "çeşitli")).ok, true);
  });
});

describe("D6 — bozuk girdi (500 olmamalı, hiçbir şey yazılmamalı)", () => {
  let ctx, acc, buyer;
  before(async () => ({ ctx, acc, buyer } = await setup()));
  after(() => ctx.server.close());

  it("bankAccountId dizi/nesne/sayı/çok uzun; tarih sayı/dizi; not 301 ve 100.000 karakter; eylem yanlış; gövde dizi", async () => {
    const cheque = await receive(ctx.api, { serialNo: "D6-1", accountId: buyer.id });
    const before_ = snapshot(ctx.store);
    const bodies = [
      { action: "bank-deposit", date: TODAY, bankAccountId: [acc.ziraat.id] },
      { action: "bank-deposit", date: TODAY, bankAccountId: { id: acc.ziraat.id } },
      { action: "bank-deposit", date: TODAY, bankAccountId: 12345 },
      { action: "bank-deposit", date: TODAY, bankAccountId: "x".repeat(5000) },
      { action: "bank-deposit", date: 20261008, bankAccountId: acc.ziraat.id },
      { action: "bank-deposit", date: [TODAY], bankAccountId: acc.ziraat.id },
      { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id, note: "n".repeat(301) },
      { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id, note: "<img src=x onerror=alert(1)>".repeat(5000) },
      { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id, note: { a: 1 } },
      { action: "BANK-DEPOSIT", date: TODAY, bankAccountId: acc.ziraat.id },
      { action: "bank-deposit ", date: TODAY, bankAccountId: acc.ziraat.id },
      { action: "bank-withdraw", date: TODAY },
      { action: ["bank-deposit"], date: TODAY, bankAccountId: acc.ziraat.id },
      { action: "bank-deposit", date: "2026-10-08T00:00:00Z", bankAccountId: acc.ziraat.id },
      { action: "bank-deposit", date: "08.10.2026", bankAccountId: acc.ziraat.id },
    ];
    const results = [];
    for (const body of bodies) {
      const res = await act(ctx.api, cheque.id, body);
      results.push({ body: JSON.stringify(body).slice(0, 90), ...short(res) });
      if (res.status === 200) await must("geri al", act(ctx.api, cheque.id, { action: "bank-withdraw", date: TODAY }));
    }
    const arr = await ctx.api.client.raw("POST", `${CHEQUES}/${cheque.id}/actions`, { body: JSON.stringify([{ action: "bank-deposit" }]), headers: { "content-type": "application/json" } });
    results.push({ body: "dizi gövde", status: arr.status });
    for (const r of results) log("girdi", r);
    const fives = results.filter(r => r.status >= 500);
    const accepted = results.filter(r => r.status === 200);
    log("kabul edilen", accepted);
    assert.deepEqual(fives, [], "500 dönen girdi");
    const result = await integrityState(ctx.api, "bozuk girdi");
    assert.equal(result.ok, true);
    void before_;
  });
});

describe("D7 — salt okunur lisans ve yalnız çek yetkili kullanıcı", () => {
  it("salt okunur lisansta Bankaya Tahsile Ver 403 LICENSE_READ_ONLY", async () => {
    const server = await startTestServer({ now: "2026-10-08T12:00:00+03:00", license: { enforce: true, machineId: "0123456789abcdef0123456789abcdef", services: ["https://lisans.test/api/lisans"], fetchImpl: async () => { throw new TypeError("fetch failed"); }, firstCheckDelayMs: 3_600_000 } });
    try {
      const api = apiOf(await loginAdmin(server));
      const res = await act(api, "chq-yok", { action: "bank-deposit", date: TODAY, bankAccountId: "bacc-yok" });
      log("salt okunur", short(res));
      assert.equal(res.status, 403);
    } finally {
      await server.close();
    }
  });

  it("çek yetkili ama banka görme yetkisi olmayan kullanıcı: kartta hesap listesi görür mü, tahsile verebilir mi", async () => {
    const { ctx, acc, buyer } = await setup();
    try {
      const cheque = await receive(ctx.api, { serialNo: "D7-1", accountId: buyer.id });
      const clerk = apiOf(await createUser(ctx.server, ctx.api.client, { username: "cekci1", role: "personel" }));
      const users = await must("kullanıcılar", ctx.api.get("/api/admin/users"));
      const me = users.find(user => user.username === "cekci1");
      const grant = await ctx.api.client.raw("PATCH", `/api/admin/users/${me.id}`, { body: JSON.stringify({ grants: { add: ["cheques.manage"], remove: ["bank.view", "bank.reports", "bank.move"] } }), headers: { "content-type": "application/json" } });
      log("yetki ver", { status: grant.status, data: grant.data });
      const card = await clerk.get(`${CHEQUES}/${cheque.id}`);
      log("kart", { status: card.status, depositAccounts: card.data?.depositAccounts, bankActions: card.data?.bankActions });
      const bankList = await clerk.get(`${BANK}/accounts`);
      log("banka listesi (bank.view yok)", short(bankList));
      const dep = await act(clerk, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id });
      log("tahsile ver (bank.view yok)", short(dep));
    } finally {
      await ctx.server.close();
    }
  });
});

describe("D8 — aynı anda farklı eylemler", () => {
  let ctx, acc, buyer, seller;
  before(async () => ({ ctx, acc, buyer, seller } = await setup()));
  after(() => ctx.server.close());

  it("tahsile ver ∥ ciro; tahsil ∥ geri al; tahsile ver ∥ sil; iki tahsile ver aynı kimlikle", async () => {
    const results = {};
    const c1 = await receive(ctx.api, { serialNo: "D8-1", accountId: buyer.id });
    const [d1, e1] = await Promise.all([act(ctx.api, c1.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id }), act(ctx.api, c1.id, { action: "endorse", date: TODAY, accountId: seller.id })]);
    results.depositVsEndorse = [short(d1), short(e1)];
    const c2 = await receive(ctx.api, { serialNo: "D8-2", accountId: buyer.id });
    await must("tahsile", act(ctx.api, c2.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id }));
    const [col, wd] = await Promise.all([act(ctx.api, c2.id, { action: "collect", date: TODAY }), act(ctx.api, c2.id, { action: "bank-withdraw", date: TODAY })]);
    results.collectVsWithdraw = [short(col), short(wd)];
    const c3 = await receive(ctx.api, { serialNo: "D8-3", accountId: buyer.id });
    const [d3, del3] = await Promise.all([act(ctx.api, c3.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id }), ctx.api.del(`${CHEQUES}/${c3.id}`)]);
    results.depositVsDelete = [short(d3), short(del3)];
    const c4 = await receive(ctx.api, { serialNo: "D8-4", accountId: buyer.id });
    const body = { action: "bank-deposit", date: TODAY, bankAccountId: acc.garanti.id };
    const [r1, r2] = await Promise.all([ctx.api.client.post(`${CHEQUES}/${c4.id}/actions`, body, { "x-hof-request": "d8-ayni-istek-000001" }), ctx.api.client.post(`${CHEQUES}/${c4.id}/actions`, body, { "x-hof-request": "d8-ayni-istek-000001" })]);
    results.sameRequest = [r1.status, r2.status, r2.data?.data?.replayed ?? r2.data?.code];
    log("eşzamanlı", results);
    const pendingOrphans = ctx.store.all("SELECT k.id, c.status, c.deleted_at AS d FROM cheque_collections k JOIN cheques c ON c.id = k.cheque_id WHERE k.status = 'pending' AND (c.status <> 'portfolio' OR c.deleted_at IS NOT NULL)");
    log("portföyde olmayan bekleyen kayıt", pendingOrphans);
    assert.deepEqual(pendingOrphans, []);
    assert.equal(count(ctx.store, "fin_events", `type = 'cheque_deposit' AND cheque_id = '${c4.id}'`), 1);
    assert.equal((await integrityState(ctx.api, "eşzamanlı")).ok, true);
  });
});

describe("D9 — dönem kilidi ve hesap silme (geri alınmış kaydı olan hesap)", () => {
  let ctx, acc, buyer;
  before(async () => ({ ctx, acc, buyer } = await setup()));
  after(() => ctx.server.close());

  it("kilit 05.10: 04.10'a geri alma 409; 06.10'a geri alma 200; kilit izi (05.10'a kadar mizan) değişmez", async () => {
    const cheque = await receive(ctx.api, { serialNo: "D9-1", accountId: buyer.id, issueDate: "2026-10-02" });
    await must("tahsile", act(ctx.api, cheque.id, { action: "bank-deposit", date: "2026-10-03", bankAccountId: acc.ziraat.id }));
    await lockPeriod(ctx.api, "2026-10-05");
    const lockedTrial = await trialBalances(ctx.api, "?to=2026-10-05");
    const lockedSubs = await must("alt hesap", ctx.api.get(`${BANK}/sub-trial?to=2026-10-05`));
    const w1 = await act(ctx.api, cheque.id, { action: "bank-withdraw", date: "2026-10-04" });
    log("kilitli güne geri al", short(w1));
    assert.equal(w1.status, 409);
    await must("geri al 06.10", act(ctx.api, cheque.id, { action: "bank-withdraw", date: "2026-10-06" }));
    assert.deepEqual(await trialBalances(ctx.api, "?to=2026-10-05"), lockedTrial);
    assert.deepEqual((await must("alt hesap", ctx.api.get(`${BANK}/sub-trial?to=2026-10-05`))).rows, lockedSubs.rows);
    assert.equal((await integrityState(ctx.api, "kilit")).ok, true);
  });

  it("hareketsiz hesap: tahsile ver → geri al → hesabı sil → mutabakat, İşlem Kartı, kart geçmişi", async () => {
    const extra = await openAccount(ctx.api, { bankName: "Akbank", name: "Tahsil Hesabı", kind: "demand", currency: "TRY" });
    const cheque = await receive(ctx.api, { serialNo: "D9-2", accountId: buyer.id, issueDate: "2026-10-06" });
    await must("tahsile", act(ctx.api, cheque.id, { action: "bank-deposit", date: "2026-10-07", bankAccountId: extra.id }));
    const delPending = await ctx.api.del(`${BANK}/accounts/${extra.id}`);
    log("bekleyenli hesabı sil", short(delPending));
    await must("geri al", act(ctx.api, cheque.id, { action: "bank-withdraw", date: "2026-10-08" }));
    const del = await ctx.api.del(`${BANK}/accounts/${extra.id}`);
    log("geri alınmış kaydı olan hesabı sil", short(del));
    const card = await must("kart", ctx.api.get(`${CHEQUES}/${cheque.id}`));
    log("kart geçmişi", card.collections);
    assert.equal((await integrityState(ctx.api, "hesap silme")).ok, true);
    const again = await act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: extra.id });
    log("silinmiş hesaba tahsile ver", short(again));
    assert.ok(again.status === 404 || again.status === 400);
  });
});

describe("D10 — carisiz çek: tahsile ver → karşılıksız → geri al → tahsil", () => {
  let ctx, acc;
  before(async () => ({ ctx, acc } = await setup()));
  after(() => ctx.server.close());

  it("carisiz evrakta 101.* ve banka", async () => {
    const cheque = await receive(ctx.api, { serialNo: "D10-1", amount: "640", drawer: "Carisiz" });
    const bank0 = Number((await must("hesap", ctx.api.get(`${BANK}/accounts/${acc.ziraat.id}`))).balanceMinor);
    await must("tahsile", act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.ziraat.id }));
    await must("karşılıksız", act(ctx.api, cheque.id, { action: "bounce", date: TODAY }));
    log("karşılıksız sonrası", chequeSubs(ctx));
    assert.equal((await integrityState(ctx.api, "carisiz karşılıksız")).ok, true);
    await must("geri al", ctx.api.post(`${CHEQUES}/${cheque.id}/undo`, {}));
    const card = await must("kart", ctx.api.get(`${CHEQUES}/${cheque.id}`));
    log("geri al sonrası kart", { deposited: card.deposited, statusLabel: card.statusLabel, collections: card.collections });
    await must("tahsil", act(ctx.api, cheque.id, { action: "collect", date: TODAY }));
    const bank1 = Number((await must("hesap", ctx.api.get(`${BANK}/accounts/${acc.ziraat.id}`))).balanceMinor);
    log("banka farkı", (bank1 - bank0) / 100);
    assert.equal(bank1 - bank0, 64000);
    assert.deepEqual(chequeSubs(ctx), { "101.01": 0, "101.02": 0 });
    assert.equal((await integrityState(ctx.api, "carisiz")).ok, true);
  });
});
