// 2.4.5 G8 (ölçüm bulgusu, docs/kanit/2026-10-24/245-goc/NOT.md: takvim soğuk 928 → 1.354 ms): fatura durumları (allPaymentStates) ve carinin vadeli elle
// satırlarının Kalan'ı (allEntryStates) TEK geçişte üretilir (routes/invoices.mjs allSettled). DAVRANIŞ DEĞİŞMEZ — bu test:
//   1. Tek geçiş: önbellek bayatken (yazımdan sonra) iki harita için carilerin defteri BİR KEZ kurulur (allLedgers; eski kodda iki kez — kırmızı kanıt).
//   2. Toplu yol = cari başına yol (bağımsız ikinci hesap: accounts.detail defteri + accountSettleInput): her fatura durumu ve her vadeli carinin her satırı.
//   3. Kapsam: elle satır haritası yalnız vadeli satırı olan carileri taşır (faturası olmayan vadeli cari DAHİL; vadesiz carinin satırı YOK).
//   4. Bayatlık: yazımdan sonra yeni değer; işlem içinde okunan sonuç önbelleğe yazılmaz (geri alınan işlemin değeri sonra görünmez).
// "Nasıl bozulur?": iki harita farklı kümeden okunur (faturasız vadeli cari düşer), vadesiz carinin satırları sızar, alanlar karışır (pay ↔ entries),
// önbellek işlem içinde yazılır, yazımdan sonra eski değer döner, D1 olayları (değersiz yazma, stok iadesi) toplu yolda farklı kapanır.
// Eski kodla bayt bayt aynılık (rastgele tohumlu veri, ≥ 5 tohum): tools/kapama-tek-gecis-esdegerlik.mjs (kanıt docs/kanit/2026-10-24/245-g8-tek-gecis).
// Sahte DURAĞAN saat (ders 13).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const NOW = "2026-10-20T12:00:00+03:00";
const TODAY = "2026-10-20";
const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
});
const AUDITOR = { id: "kapama-tek-gecis", role: "admin", permissions: [] };
const plain = value => JSON.parse(JSON.stringify(value));

describe("G8 tek geçiş: fatura durumları ve vadeli elle satırların Kalan'ı aynı kapama geçişinden; sonuç cari başına yolla aynı", () => {
  let server;
  let api;
  let service;
  let goods;
  let n = 0;
  const made = {};
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  const party = async (label, type = "customer") => must(`cari ${label}`, api.post("/api/workspace/accounts", { name: `G8 ${label}`, type, registeredOn: day(-400), phone: `0500 888 00 ${String((n += 1)).padStart(2, "0")}` }));
  const entry = (acc, body) => must("cari satırı", api.post(`/api/workspace/accounts/${acc.id}/entries`, body));
  const sale = (acc, date, amount) => must("satış", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ itemId: service.id, qty: 1, unitPrice: amount, vatRate: 0 }], payment: { rest: "open", dueDate: date } }));
  const purchase = (acc, date, amount) => must("alış", api.post("/api/workspace/invoices", { scenario: "expense_purchase", accountId: acc.id, number: `G8-AL-${(n += 1)}`, issueDate: date, lines: [{ name: "Danışmanlık", expenseCode: "advisory", qty: 1, unitPrice: amount, vatRate: 0 }], payment: { rest: "open", dueDate: date } }));
  const inv = () => server.app.context.invoices;
  const allRows = () => server.app.store.all("SELECT id, account_id AS accountId, try_payable AS tryPayable FROM invoices ORDER BY id");
  const datedAccounts = () => server.app.store.all("SELECT DISTINCT e.account_id AS id FROM account_entries e JOIN accounts a ON a.id = e.account_id AND a.deleted_at IS NULL WHERE e.source = '' AND e.kind IN ('debt', 'credit') AND (e.due_date <> '' OR e.expected_date <> '') ORDER BY e.account_id").map(row => row.id);
  // Toplu yol (BATCH_ACCOUNTS = 8 cariden çok fatura → allPaymentStates) ve elle satırlar (allEntryStates).
  const batch = () => ({ pay: new Map([...inv().paymentStates(allRows())].map(([id, state]) => [id, plain(state)])), entries: new Map([...inv().allEntryStates()].map(([id, state]) => [id, plain(state)])) });
  // Cari başına yol: her fatura tek başına (paymentStates([row]) → accountSettleInput + carinin kendi defteri), her vadeli cari entryStates ile.
  const perAccount = () => {
    const pay = new Map(allRows().map(row => [row.id, plain(inv().paymentStates([row]).get(row.id))]));
    const entries = new Map();
    for (const id of datedAccounts()) for (const [entryId, state] of inv().entryStates(id, server.app.context.accounts.detail(id, AUDITOR, { withRemaining: false }).ledger)) entries.set(entryId, plain(state));
    return { pay, entries };
  };
  const sorted = map => [...map].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  // allLedgers çağrı sayacı (invoices modülü her hesapta accounts().allLedgers'ı çağırır).
  let ledgerCalls = 0;
  const write = () => server.app.store.run("UPDATE accounts SET updated_at = updated_at WHERE id = ?", made.dOnly.id);

  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    api = apiOf(await loginAdmin(server));
    await api.post("/api/workspace/bank/setup/dismiss", {});
    service = (await api.post("/api/workspace/stock", { kind: "service", code: "HZM-G8", name: "Hizmet", unit: "Adet", salePrice: "1000" })).data;
    goods = (await api.post("/api/workspace/stock", { kind: "goods", code: "URN-G8", name: "Ürün", unit: "Adet", salePrice: "100", openingQty: "500" })).data;
    // 10 müşteri faturalı (toplu yol: 8'den çok cari); bazılarında vadeli elle borç, kısmi tahsilat, D1 olayları.
    const customers = [];
    for (let i = 0; i < 10; i++) {
      const acc = await party(`Müşteri ${i + 1}`);
      customers.push(acc);
      await sale(acc, day(-90 + i), 1000 + i * 100);
    }
    made.mixed = customers[0];
    await entry(made.mixed, { kind: "debt", amount: 800, date: day(-120), dueDate: day(-100) });
    await entry(made.mixed, { kind: "debt", amount: 300, date: day(-10), dueDate: day(5), expectedDate: day(3) });
    await entry(made.mixed, { kind: "in", method: "cash", amount: 500, date: day(-5) });
    // D1: değersiz yazma (şüpheliye al → değersiz yaz) vadeli borcu ve faturayı en eskiden kapatır.
    made.writeOff = customers[1];
    await entry(made.writeOff, { kind: "debt", amount: 400, date: day(-200), dueDate: day(-150) });
    const doubtful = await must("şüpheliye al", api.post(`/api/workspace/accounts/${made.writeOff.id}/doubtful`, { amount: 1500, date: day(-30), reason: "lawsuit", note: "dava" }));
    await must("değersiz yaz", api.post(`/api/workspace/accounts/${made.writeOff.id}/doubtful/${doubtful.id || doubtful.record?.id}/write-off`, { amount: 900, date: day(-20), note: "kayıp" }));
    // D1: faturasız stok satış iadesi (açık hesap) bağsız ödeme.
    made.stockReturn = customers[2];
    await entry(made.stockReturn, { kind: "debt", amount: 250, date: day(-300), dueDate: day(-280) });
    await must("stok iadesi", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", reason: "return", qty: "4", unitPrice: "100", pay: "account", accountId: made.stockReturn.id, date: day(-2) }));
    // Faturalı ama VADESİZ elle borç: elle satır haritasında yer almaz.
    made.plain = customers[4];
    made.undated = customers[3];
    await entry(made.undated, { kind: "debt", amount: 600, date: day(-40) });
    // Faturası OLMAYAN vadeli cari (iki harita farklı kümeden okunursa düşer).
    made.dOnly = await party("Yalnız Vadeli");
    await entry(made.dOnly, { kind: "debt", amount: 700, date: day(-60), dueDate: day(-30) });
    await entry(made.dOnly, { kind: "in", method: "cash", amount: 200, date: day(-1) });
    // Tedarikçi: alış faturası + vadeli elle Alacak (borç tarafı).
    made.supplier = await party("Tedarikçi", "supplier");
    await purchase(made.supplier, day(-50), 2000);
    await entry(made.supplier, { kind: "credit", amount: 350, date: day(-70), dueDate: day(-40) });
    const accounts = server.app.context.accounts;
    const original = accounts.allLedgers;
    accounts.allLedgers = (...args) => {
      ledgerCalls += 1;
      return original(...args);
    };
  });
  after(async () => server?.close());

  it("tek geçiş: yazımdan sonra iki harita için carilerin defteri BİR KEZ kurulur; ikinci çağrılar önbellekten", () => {
    write();
    const start = ledgerCalls;
    inv().allEntryStates();
    inv().paymentStates(allRows());
    assert.equal(ledgerCalls - start, 1, `elle satırlar + fatura durumları için allLedgers ${ledgerCalls - start} kez (1 beklenir)`);
    write();
    const again = ledgerCalls;
    inv().paymentStates(allRows());
    inv().allEntryStates();
    inv().allEntryStates();
    assert.equal(ledgerCalls - again, 1, `ters sırada allLedgers ${ledgerCalls - again} kez (1 beklenir)`);
  });

  it("toplu yol = cari başına yol: her fatura durumu ve her vadeli carinin her satırı (D1 olayları dahil)", () => {
    write();
    const rows = allRows();
    assert.ok(new Set(rows.map(row => row.accountId)).size > 8, "toplu yol (8'den çok cari) sınanıyor");
    const one = batch();
    const two = perAccount();
    assert.equal(one.pay.size, rows.length, "her faturanın durumu var");
    assert.deepEqual(sorted(one.pay), sorted(two.pay), "fatura durumları: toplu = cari başına");
    assert.deepEqual(sorted(one.entries), sorted(two.entries), "elle satırların Kalan'ı: toplu = cari başına");
    // Bağımsız sayılar (karar metninden; yalnız birkaç nokta): D1 değersiz 900 → 400'lük vadeli borç kapandı, fatura (1.100) 600 açık.
    const card = id => server.app.context.accounts.detail(id, AUDITOR, { withRemaining: false }).ledger.filter(line => line.origin === "account" && line.kind === "debt");
    const [writeOffDebt] = card(made.writeOff.id);
    assert.equal(one.entries.get(writeOffDebt.id).remaining, 0, "değersiz yazma vadeli borcu kapattı");
    const writeOffInvoice = rows.find(row => row.accountId === made.writeOff.id);
    assert.equal(one.pay.get(writeOffInvoice.id).open, 600, "değersiz yazmanın kalanı faturadan düştü (1.100 − 500)");
    const [returnDebt] = card(made.stockReturn.id);
    assert.equal(one.entries.get(returnDebt.id).remaining, 0, "stok iadesi (400) vadeli borcu (250) kapattı");
    assert.equal(one.pay.get(rows.find(row => row.accountId === made.stockReturn.id).id).open, 1050, "stok iadesinin kalanı (150) faturadan düştü");
    const [dOnlyDebt] = card(made.dOnly.id);
    assert.equal(one.entries.get(dOnlyDebt.id).remaining, 500, "faturasız vadeli cari: 700 − 200");
  });

  it("kapsam: elle satır haritası yalnız vadeli satırı olan carilerin satırlarını taşır (faturasız vadeli cari dahil, vadesiz cari yok)", () => {
    write();
    const entries = inv().allEntryStates();
    const owners = new Set(server.app.store.all("SELECT id, account_id AS accountId FROM account_entries").filter(row => entries.has(row.id)).map(row => row.accountId));
    assert.deepEqual([...owners].sort(), datedAccounts(), "harita carileri = vadeli satırı olan cariler");
    assert.ok(owners.has(made.dOnly.id) && owners.has(made.supplier.id), "faturasız vadeli müşteri ve tedarikçi haritada");
    assert.ok(!owners.has(made.undated.id), "vadesiz elle borcu olan faturalı cari haritada YOK");
  });

  it("bayatlık: yazımdan sonra yeni değer; işlem içinde hesaplanan sonuç önbelleğe yazılmaz (geri alınınca eski değer)", async () => {
    const [dOnlyDebt] = server.app.context.accounts.detail(made.dOnly.id, AUDITOR, { withRemaining: false }).ledger.filter(line => line.origin === "account" && line.kind === "debt");
    assert.equal(inv().allEntryStates().get(dOnlyDebt.id).remaining, 500);
    // İşlem içinde (geri alınacak) tahsilat tutarı değişir: içeride yeni değer görünür, dışarıda önbellekten içerideki değer DÖNMEZ.
    const payment = server.app.store.get("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'in'", made.dOnly.id);
    assert.throws(() =>
      server.app.store.tx(() => {
        server.app.store.run("UPDATE account_entries SET amount = 650 WHERE id = ?", payment.id);
        assert.equal(inv().allEntryStates().get(dOnlyDebt.id).remaining, 50, "işlem içinde yeni değer");
        throw new Error("geri al");
      }),
    /geri al/);
    assert.equal(inv().allEntryStates().get(dOnlyDebt.id).remaining, 500, "geri alınan işlemin değeri önbellekten dönmez");
    await entry(made.dOnly, { kind: "in", method: "cash", amount: 100, date: TODAY });
    assert.equal(inv().allEntryStates().get(dOnlyDebt.id).remaining, 400, "tahsilattan sonra yeni değer");
    const sale1 = allRows().find(row => row.accountId === made.plain.id);
    const before_ = inv().paymentStates(allRows()).get(sale1.id).open;
    await entry(made.plain, { kind: "in", method: "cash", amount: 50, date: TODAY });
    assert.equal(inv().paymentStates(allRows()).get(sale1.id).open, before_ - 50, "fatura durumu da aynı yazımla yenilendi");
  });
});
