// 2.0.13: süpermarket simülasyonunda bulunan mantık hataları ve kurumsal defter kuralları.
//   · mevcut borcu taksitlendiren kart ikinci kez borç yazmaz; aynı borç iki karta bölünemez; satış anında taksitlendirme
//   · tedarikçi açılış bakiyesi Alacaklı; borç ↔ alacak yönü düzeltilebilir
//   · müşteri iadesi (satış iadesi), satış fiyatı, ödeme yolu (Nakit / Havale-EFT / Kredi Kartı), Kasa eksiye düşmez
//   · Ana Defter: her işlem çift yönlü (borç = alacak), ana defter bakiyeleri alt defterlerle kuruşu kuruşuna tutar
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { journal, reconcile, trialBalance } from "../server/lib/general-ledger.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const data = response => response.data.data;
const ok = (response, label) => {
  assert.equal(response.status, 200, `${label}: ${JSON.stringify(response.data)}`);
  return response.data.data;
};

describe("2.0.13 defter ve mantık düzeltmeleri", () => {
  let server;
  let admin;
  let tulay;
  let kemal;
  let tedarik;
  let item;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    tulay = ok(await admin.post("/api/workspace/accounts", { name: "Tülay Arıkan", type: "customer", phone: "0537 454 65 76" }), "müşteri");
    kemal = ok(await admin.post("/api/workspace/accounts", { name: "Kemal Bakkal", type: "customer", phone: "0532 777 66 55" }), "toptan müşteri");
    tedarik = ok(await admin.post("/api/workspace/accounts", { name: "Anadolu Gıda", type: "supplier", openingBalance: "9.000" }), "tedarikçi");
    item = ok(await admin.post("/api/workspace/stock", { name: "Bebek Bezi", unit: "Paket", unitPrice: "300", salePrice: "400", openingQty: "50" }), "ürün");
    ok(await admin.post("/api/workspace/cash", { kind: "in", amount: "10.000", description: "Açılış kasası" }), "kasa açılışı");
  });
  after(async () => server?.close());

  it("tedarikçinin açılış bakiyesi Alacaklı yazılır; yön düzeltilebilir", async () => {
    const card = data(await admin.get(`/api/workspace/accounts/${tedarik.id}`));
    assert.equal(card.totals.balance, -9000, "tedarikçiye borcumuz (Alacaklı)");
    const opening = card.entries.find(entry => entry.note === "Açılış bakiyesi");
    assert.equal(opening.kind, "credit");
    const flipped = ok(await admin.put(`/api/workspace/accounts/${tedarik.id}/entries/${opening.id}`, { kind: "debt" }), "yön");
    assert.equal(flipped.totals.balance, 9000);
    ok(await admin.put(`/api/workspace/accounts/${tedarik.id}/entries/${opening.id}`, { kind: "credit" }), "yön geri");
    const forced = ok(await admin.post("/api/workspace/accounts", { name: "Borçlu Tedarikçi", type: "supplier", openingBalance: "500", openingSide: "debt" }), "elle yön");
    assert.equal(forced.totals.balance, 500);
  });

  it("veresiye satış + mevcut borcu taksitlendir: borç bir kez; aynı borç ikinci karta bölünemez", async () => {
    const sale = ok(await admin.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "3", unitPrice: "400", pay: "account", accountId: tulay.id }), "veresiye satış");
    assert.equal(sale.qty, 47);
    const plan = ok(await admin.post("/api/workspace/plans", { name: "Tülay Arıkan", accountId: tulay.id, total: "1.200", coversBalance: true, mode: "auto", count: 3, firstDue: "2026-10-01" }), "kart");
    assert.equal(plan.coversBalance, 1);
    let card = data(await admin.get(`/api/workspace/accounts/${tulay.id}`));
    assert.equal(card.totals.balance, 1200, "borç ikiye katlanmadı");
    assert.equal(card.totals.planRemaining, 1200);
    const again = await admin.post("/api/workspace/plans", { name: "Tülay Arıkan", accountId: tulay.id, total: "100", coversBalance: true });
    assert.equal(again.status, 400, "taksitlendirilmiş borç yeniden taksitlendirilemez");
    ok(await admin.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "400", method: "card" }), "taksit kartla");
    card = data(await admin.get(`/api/workspace/accounts/${tulay.id}`));
    assert.equal(card.totals.balance, 800);
    // Satış anında taksitlendirme: tek istek, tek borç, 2 taksit.
    const now = ok(await admin.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "2", unitPrice: "400", pay: "account", accountId: tulay.id, installments: { count: 2, firstDue: "2026-11-01" } }), "satışı taksitlendir");
    assert.equal(now.qty, 45);
    card = data(await admin.get(`/api/workspace/accounts/${tulay.id}`));
    assert.equal(card.totals.balance, 1600);
    assert.equal(card.plans.length, 2);
    // Toplu: borçlu carilerin mevcut borcu (Kemal) kendi kartına; Tülay'ın borcu zaten kartlı → atlanır.
    ok(await admin.post(`/api/workspace/accounts/${kemal.id}/entries`, { kind: "debt", amount: "2.500", note: "Toptan satış" }), "borç");
    const bulk = ok(await admin.post("/api/workspace/accounts/bulk-plan", { ids: [kemal.id, tulay.id], amountMode: "balance", count: 5, firstDue: "2026-10-15" }), "toplu");
    assert.equal(bulk.created, 1);
    assert.equal(bulk.total, 2500);
    assert.match(bulk.skipped[0].reason, /borcu yok/);
    assert.equal(data(await admin.get(`/api/workspace/accounts/${kemal.id}`)).totals.balance, 2500, "toplu kart da borcu ikiye katlamaz");
  });

  it("müşteri iadesi: satış iadesi olarak yazılır; maliyet fiyatı değişmez; Kasa'da 'Satış iadesi'", async () => {
    const back = ok(await admin.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: "1", unitPrice: "400", pay: "cash", reason: "return", note: "Yanlış beden" }), "iade");
    assert.equal(back.unitPrice, 300, "alış fiyatı iadeyle değişmez");
    assert.equal(back.moves.at(-1).reason, "return");
    const cash = data(await admin.get("/api/workspace/cash"));
    assert.ok(cash.entries.some(entry => /^Satış iadesi/.test(entry.description) && entry.kind === "out" && entry.amount === 400));
    const credit = ok(await admin.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: "1", unitPrice: "400", pay: "account", accountId: tulay.id, reason: "return" }), "veresiye iade");
    assert.equal(credit.qty, 47);
    const card = data(await admin.get(`/api/workspace/accounts/${tulay.id}`));
    assert.ok(card.ledger.some(line => /^Satış iadesi/.test(line.note) && line.credit === 400));
  });

  it("ödeme yolu: Nakit / Banka / Kart ayrı bakiye; nakit kasa eksiye düşmek istenirse sorulur", async () => {
    ok(await admin.post(`/api/workspace/accounts/${kemal.id}/entries`, { kind: "in", amount: "1.000", method: "bank" }), "havale");
    ok(await admin.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "1", unitPrice: "400", pay: "cash", method: "card" }), "kartla satış");
    const all = data(await admin.get("/api/workspace/cash"));
    assert.equal(all.byMethod.bank, 1000);
    assert.equal(all.byMethod.card, 800, "kart: taksit 400 + satış 400");
    const bankOnly = data(await admin.get("/api/workspace/cash?method=bank"));
    assert.ok(bankOnly.entries.every(entry => entry.method === "bank"));
    const cashNow = all.byMethod.cash;
    const blocked = await admin.post("/api/workspace/cash", { kind: "out", amount: String(cashNow + 1), description: "Kira" });
    assert.equal(blocked.status, 409);
    assert.equal(blocked.data.code, "cash-negative");
    // Bankadan kira: nakit kasayı etkilemez; banka bakiyesi yetmiyorsa bankanın kendi eksi denetimi sorar (Eksi Bakiye Denetimi).
    const bankShort = await admin.post("/api/workspace/cash", { kind: "out", amount: String(cashNow + 1), description: "Kira", method: "bank" });
    assert.equal(bankShort.data.code, "cash-negative");
    assert.equal(bankShort.data.method, "bank", "soran banka hesabı, nakit değil");
    ok(await admin.post("/api/workspace/cash", { kind: "out", amount: String(cashNow + 1), description: "Kira", method: "bank", cashForce: true }), "bankadan kira onayla (kredili hesap)");
    assert.equal(data(await admin.get("/api/workspace/cash")).byMethod.cash, cashNow, "nakit kasa değişmedi");
    ok(await admin.post("/api/workspace/cash", { kind: "out", amount: "50", description: "Çay", cashForce: true }), "onayla kaydedilir");
  });

  it("çek/senet: al, ciro, tahsil (banka), karşılıksız, ver, öde — ana defter dengede ve alt defterlerle tutarlı", async () => {
    const received = ok(await admin.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "700", dueDate: "2026-12-01", accountId: kemal.id, serialNo: "K-1" }), "çek al");
    const second = ok(await admin.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "300", dueDate: "2026-12-05", accountId: kemal.id, serialNo: "K-2" }), "çek al 2");
    const third = ok(await admin.post("/api/workspace/cheques", { direction: "in", instrument: "note", amount: "200", dueDate: "2026-12-06", drawer: "Carisiz Kişi", serialNo: "S-9" }), "carisiz senet");
    ok(await admin.post(`/api/workspace/cheques/${received.id}/actions`, { action: "endorse", accountId: tedarik.id }), "ciro");
    ok(await admin.post(`/api/workspace/cheques/${second.id}/actions`, { action: "collect" }), "tahsil (banka)");
    ok(await admin.post(`/api/workspace/cheques/${third.id}/actions`, { action: "bounce" }), "carisiz karşılıksız");
    const given = ok(await admin.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: "1.500", dueDate: "2026-12-10", accountId: tedarik.id, serialNo: "V-1" }), "çek ver");
    ok(await admin.post(`/api/workspace/cheques/${given.id}/actions`, { action: "pay", method: "bank", cashForce: true }), "öde (banka; bakiye yetmiyor, onaylı)");
    ok(await admin.post("/api/workspace/cheques", { direction: "out", instrument: "note", amount: "900", dueDate: "2027-01-10", accountId: tedarik.id, serialNo: "V-2" }), "senet ver (açık)");
    ok(await admin.post("/api/workspace/cases/satir:1/payments", { amount: "250", method: "bank", caseTitle: "Kayıt" }).catch(() => ({ status: 200, data: { data: {} } })), "kayıt tahsilatı");
    const ledger = data(await admin.get("/api/workspace/ledger"));
    assert.equal(ledger.trial.balanced, true, "borç toplamı = alacak toplamı");
    assert.equal(ledger.trial.totals.difference, 0);
    for (const check of ledger.reconciliation.checks) assert.ok(check.ok, `${check.code} ${check.name}: ana defter ${check.ledger} · alt defter ${check.subledger}`);
    assert.equal(ledger.reconciliation.ok, true);
    const byCode = Object.fromEntries(ledger.trial.accounts.map(row => [row.code, row.balance]));
    assert.equal(byCode["101"], 0, "portföyde açık alınan evrak yok (ciro, tahsil, karşılıksız)");
    assert.equal(byCode["103"], -900, "ödenecek senet 900");
    const report = await admin.get("/api/workspace/report-center/defter-mutabakati");
    assert.equal(report.status, 200);
  });

  it("yevmiye motoru: her madde dengeli; kuruş tamsayısı; mutabakat farkı raporlanır", () => {
    const entries = journal({ cashEntries: [{ id: "a", kind: "in", amount: 0.1, date: "2026-09-01", method: "cash" }, { id: "b", kind: "in", amount: 0.2, date: "2026-09-01", method: "cash" }], payments: [], accountEntries: [], plans: [], planEntries: [], stockMoves: [], chequeEvents: [] });
    const trial = trialBalance(entries);
    assert.equal(trial.accounts.find(row => row.code === "100").balance, 0.3, "0,1 + 0,2 = 0,3 (kayan nokta hatası yok)");
    assert.equal(trial.balanced, true);
    const result = reconcile(trial, { 100: 0.31 });
    assert.equal(result.ok, false);
    assert.equal(result.checks[0].difference, -0.01);
  });
});
