// Fatura 2.0.17 — müşteri bildirimleri (CLAUDE.md "2.0.17 müşteri istekleri").
// Madde 5: "hayalet kısmi ödeme" — kapama yöne göre; Kapatılacak Fatura; Mahsup Et; Bu Faturayı Kapatanlar.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { classifyLine, settleInvoices } from "../server/lib/invoice-settle.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async url => unwrap(await client.del(url)),
});
const pad = value => String(value).padStart(2, "0");
const iso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const shift = days => iso(new Date(Date.now() + days * 86_400_000));
// Geçmiş tarihli faturada vade de geçmiştir: "Açık" ya da "Vadesi Geçti" — ikisi de ödenmemiş demektir; sayılar asıl kanıt.
const unpaid = state => (["open", "overdue"].includes(state) ? "open" : state);

describe("Kapama motoru: ödeme yöne göre sayılır (saf fonksiyon)", () => {
  const line = (id, extra) => ({ id, origin: "account", kind: "debt", date: "2026-09-01", at: id, debit: 0, credit: 0, label: "", ...extra });
  test("alış faturasını satış faturası, Borç Yaz ve stoktan satış kapatmaz; ödeme, verilen çek, alıştan iade kapatır", () => {
    assert.deepEqual(classifyLine(line("a", { origin: "invoice", kind: "debt", debit: 400 }), { invoiceKind: "sale" }), { recvDue: true, recvPay: false, payDue: false, payPay: false });
    assert.deepEqual(classifyLine(line("b", { kind: "debt", debit: 400 })), { recvDue: true, recvPay: false, payDue: false, payPay: false });
    assert.deepEqual(classifyLine(line("c", { origin: "stock", kind: "debt", debit: 400 })), { recvDue: true, recvPay: false, payDue: false, payPay: false });
    assert.deepEqual(classifyLine(line("d", { kind: "out", debit: 400 })), { recvDue: false, recvPay: false, payDue: false, payPay: true });
    assert.deepEqual(classifyLine(line("e", { origin: "cheque", kind: "debt", debit: 400 }), { chequeEvent: "issue" }), { recvDue: false, recvPay: false, payDue: false, payPay: true });
    assert.deepEqual(classifyLine(line("f", { origin: "invoice", kind: "debt", debit: 400 }), { invoiceKind: "purchase_return" }), { recvDue: false, recvPay: false, payDue: false, payPay: true });
    // Karşılıksız dönen çek: alacak tarafında yükümlülük yeniden açılır (ödeme değil).
    assert.deepEqual(classifyLine(line("g", { origin: "cheque", kind: "debt", debit: 400 }), { chequeEvent: "bounce" }), { recvDue: true, recvPay: false, payDue: false, payPay: false });
  });
  test("satış faturasını alış faturası ve Alacak Yaz kapatmaz; tahsilat, alınan çek, satıştan iade, taksit tahsilatı kapatır", () => {
    assert.deepEqual(classifyLine(line("a", { origin: "invoice", kind: "credit", credit: 6000 }), { invoiceKind: "purchase" }), { recvDue: false, recvPay: false, payDue: true, payPay: false });
    assert.deepEqual(classifyLine(line("b", { kind: "credit", credit: 100 })), { recvDue: false, recvPay: false, payDue: true, payPay: false });
    assert.deepEqual(classifyLine(line("c", { kind: "in", credit: 100 })), { recvDue: false, recvPay: true, payDue: false, payPay: false });
    assert.deepEqual(classifyLine(line("d", { origin: "cheque", kind: "credit", credit: 100 }), { chequeEvent: "receive" }), { recvDue: false, recvPay: true, payDue: false, payPay: false });
    assert.deepEqual(classifyLine(line("e", { origin: "invoice", kind: "credit", credit: 100 }), { invoiceKind: "sale_return" }), { recvDue: false, recvPay: true, payDue: false, payPay: false });
    assert.deepEqual(classifyLine(line("f", { origin: "plan", kind: "plan-in", credit: 100 })), { recvDue: false, recvPay: true, payDue: false, payPay: false });
  });
  test("müşterinin ekranı: aynı cariye satış 400 + alış 6.000 → alış Açık 6.000 (eski FIFO 'Kısmen Ödendi · 400' derdi)", () => {
    const lines = [
      line("s", { origin: "invoice", kind: "debt", sourceId: "SAT", debit: 400, date: "2026-09-10" }),
      line("p", { origin: "invoice", kind: "credit", sourceId: "ALS", credit: 6000, date: "2026-09-12" }),
    ];
    const invoices = [
      { id: "SAT", kind: "sale", status: "issued", payable: 400 },
      { id: "ALS", kind: "purchase", status: "issued", payable: 6000 },
    ];
    const states = settleInvoices({ lines, invoices, today: "2026-10-02" });
    assert.deepEqual([states.get("ALS").state, states.get("ALS").paid, states.get("ALS").open], ["open", 0, 6000]);
    assert.deepEqual([states.get("SAT").state, states.get("SAT").paid], ["open", 0]);
    assert.deepEqual(states.get("ALS").closers, []);
  });
  test("Mahsup Et: satış 400 ↔ alış 6.000 → satış Ödendi, alış Kısmen (5.600 açık); her ikisinde kapatan 'Mahsup'", () => {
    const lines = [
      line("s", { origin: "invoice", kind: "debt", sourceId: "SAT", debit: 400, date: "2026-09-10" }),
      line("p", { origin: "invoice", kind: "credit", sourceId: "ALS", credit: 6000, date: "2026-09-12" }),
    ];
    const invoices = [
      { id: "SAT", kind: "sale", status: "issued", payable: 400 },
      { id: "ALS", kind: "purchase", status: "issued", payable: 6000 },
    ];
    const offsets = [{ id: "o1", invoiceId: "ALS", counterType: "invoice", counterId: "SAT", amount: 400, date: "2026-09-15", label: "Mahsup · Satış" }];
    const states = settleInvoices({ lines, invoices, offsets, today: "2026-10-02" });
    assert.deepEqual([states.get("SAT").state, states.get("SAT").open], ["paid", 0]);
    assert.deepEqual([states.get("ALS").state, states.get("ALS").paid, states.get("ALS").open], ["partial", 400, 5600]);
    assert.deepEqual(states.get("ALS").closers.map(item => [item.mode, item.amount]), [["offset", 400]]);
    assert.deepEqual(states.get("SAT").closers.map(item => [item.mode, item.amount]), [["offset", 400]]);
  });
  test("bağlı ödeme kendi faturasına, artanı en eskiye (otomatik); kapatanlar listesi kuruşu kuruşuna", () => {
    const lines = [
      line("f1", { origin: "invoice", kind: "credit", sourceId: "A1", credit: 1000, date: "2026-09-01" }),
      line("f2", { origin: "invoice", kind: "credit", sourceId: "A2", credit: 2000, date: "2026-09-05" }),
      line("o1", { kind: "out", debit: 2500, date: "2026-09-20", label: "Ödeme", method: "bank" }),
    ];
    const invoices = [
      { id: "A1", kind: "purchase", status: "issued", payable: 1000 },
      { id: "A2", kind: "purchase", status: "issued", payable: 2000 },
    ];
    const states = settleInvoices({ lines, invoices, links: new Map([["o1", "A2"]]), today: "2026-10-02" });
    assert.deepEqual([states.get("A2").state, states.get("A2").closers.map(item => [item.mode, item.amount])], ["paid", [["linked", 2000]]]);
    assert.deepEqual([states.get("A1").state, states.get("A1").paid, states.get("A1").closers.map(item => [item.mode, item.amount])], ["partial", 500, [["auto", 500]]]);
    const sum = [...states.values()].reduce((total, item) => total + item.closers.reduce((inner, closer) => inner + closer.amount, 0), 0);
    assert.equal(sum, 2500);
  });
});

describe("Hem müşteri hem tedarikçi cari: hayalet kısmi ödeme yok (API)", () => {
  let server;
  let api;
  const ids = {};
  before(async () => {
    server = await startTestServer();
    api = apiOf(await loginAdmin(server));
    ids.party = (await api.post("/api/workspace/accounts", { name: "Mehmet Eren Demir", type: "customer" })).data.id;
    const item = await api.post("/api/workspace/stock", { name: "Kalem", code: "KLM-1", unit: "Adet", salePrice: 100 });
    ids.item = item.data.id;
    // Nakit kasada para olsun (eksi bakiye denetimi ödemeyi sormasın); stok eksiye düşer (müşteri kararı: izinle).
    const opening = await api.post("/api/workspace/cash", { kind: "in", amount: 10000, date: shift(-10), description: "Açılış" });
    assert.equal(opening.status, 200, JSON.stringify(opening.data));
  });
  after(async () => server.close());
  const inv = async id => (await api.get(`/api/workspace/invoices/${id}`)).data;
  const balance = async id => (await api.get(`/api/workspace/accounts/${id}`)).data.totals.balance;
  const cashBalance = async () => (await api.get("/api/workspace/cash")).data.totals.balance;

  test("satış 400 + alış 6.000 aynı cariye → alış 'Açık' 6.000, satış 'Açık' 400; cari bakiyesi net (−5.600)", async () => {
    const sale = await api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: ids.party, issueDate: shift(-6), lines: [{ itemId: ids.item, qty: 4, unitPrice: 100, vatRate: 0 }], payment: { rest: "open" }, force: true });
    assert.equal(sale.status, 200, JSON.stringify(sale.data));
    ids.sale = sale.data.id;
    const purchase = await api.post("/api/workspace/invoices", { scenario: "goods_purchase", accountId: ids.party, number: "ALS-89", issueDate: shift(-5), lines: [{ itemId: ids.item, qty: 60, unitPrice: 100, vatRate: 0 }], payment: {} });
    assert.equal(purchase.status, 200, JSON.stringify(purchase.data));
    ids.purchase = purchase.data.id;
    const p = await inv(ids.purchase);
    assert.deepEqual([unpaid(p.payState), p.paid, p.open], ["open", 0, 6000]);
    const s = await inv(ids.sale);
    assert.deepEqual([unpaid(s.payState), s.paid, s.open], ["open", 0, 400]);
    assert.equal(await balance(ids.party), -5600);
  });
  test("Kopyala → kaydet: kopya 'Açık' kalır (ödeme taşımaz, FIFO artığı düşmez)", async () => {
    const copy = await api.post("/api/workspace/invoices", { scenario: "goods_purchase", accountId: ids.party, number: "ALS-90", issueDate: shift(-4), lines: [{ itemId: ids.item, qty: 60, unitPrice: 100, vatRate: 0 }], payment: {} });
    assert.equal(copy.status, 200, JSON.stringify(copy.data));
    ids.copy = copy.data.id;
    const c = await inv(ids.copy);
    assert.deepEqual([unpaid(c.payState), c.paid, c.open], ["open", 0, 6000]);
    assert.equal(unpaid((await inv(ids.purchase)).payState), "open");
  });
  test("bağsız ödeme 400 → otomatik en eski alış faturasına (ALS-89 'Kısmen Ödendi · 400'; kapatan 'Otomatik')", async () => {
    const paid = await api.post(`/api/workspace/accounts/${ids.party}/entries`, { kind: "out", amount: 400, date: shift(-3), method: "cash", note: "başka iş" });
    assert.equal(paid.status, 200, JSON.stringify(paid.data));
    ids.freePay = paid.data.entryId;
    const p = await inv(ids.purchase);
    assert.deepEqual([p.paid, p.open], [400, 5600]);
    assert.deepEqual(p.closers.map(item => [item.mode, item.modeLabel, item.amount, item.methodLabel]), [["auto", "Otomatik (en eski)", 400, "Nakit"]]);
    assert.equal((await inv(ids.copy)).paid, 0);
    assert.equal((await inv(ids.sale)).paid, 0);
  });
  test("Kapatılacak Fatura seçilen ödeme → o faturaya bağlı ('Bağlı'), en eski değil; yanlış yön 409; başka carinin faturası 404", async () => {
    const linked = await api.post(`/api/workspace/accounts/${ids.party}/entries`, { kind: "out", amount: 1000, date: shift(-2), method: "bank", invoiceId: ids.copy });
    assert.equal(linked.status, 200, JSON.stringify(linked.data));
    const c = await inv(ids.copy);
    assert.deepEqual([c.paid, c.closers.map(item => [item.mode, item.amount])], [1000, [["linked", 1000]]]);
    assert.deepEqual([(await inv(ids.purchase)).paid], [400]);
    const wrong = await api.post(`/api/workspace/accounts/${ids.party}/entries`, { kind: "in", amount: 10, date: shift(-2), invoiceId: ids.copy });
    assert.equal(wrong.status, 409);
    const other = (await api.post("/api/workspace/accounts", { name: "Başka Cari", type: "customer" })).data.id;
    const foreign = await api.post(`/api/workspace/accounts/${other}/entries`, { kind: "out", amount: 10, date: shift(-2), invoiceId: ids.copy });
    assert.equal(foreign.status, 404);
    // Cari defterinde bağ görünür.
    const ledger = (await api.get(`/api/workspace/accounts/${ids.party}`)).data.ledger;
    assert.ok(ledger.some(line => line.invoiceId === ids.copy && line.kind === "out"));
  });
  test("Mahsup Et: alış ALS-89 ↔ satış 400 → satış Ödendi, alış 800 ödenmiş; sınırlar 409; kaldırınca eski hâl; bakiye/Kasa değişmez", async () => {
    const before = { balance: await balance(ids.party), cash: await cashBalance() };
    const candidates = (await api.get(`/api/workspace/invoices/${ids.purchase}/offsets`)).data;
    assert.deepEqual(candidates.invoices.map(item => [item.id, item.open]), [[ids.sale, 400]]);
    const over = await api.post(`/api/workspace/invoices/${ids.purchase}/offsets`, { counterType: "invoice", counterId: ids.sale, amount: 500, date: shift(0) });
    assert.equal(over.status, 409);
    const early = await api.post(`/api/workspace/invoices/${ids.purchase}/offsets`, { counterType: "invoice", counterId: ids.sale, amount: 400, date: shift(-30) });
    assert.equal(early.status, 409);
    const ok = await api.post(`/api/workspace/invoices/${ids.purchase}/offsets`, { counterType: "invoice", counterId: ids.sale, amount: 400, date: shift(0), note: "karşılıklı" });
    assert.equal(ok.status, 200, JSON.stringify(ok.data));
    assert.deepEqual([ok.data.paid, ok.data.open], [800, 5200]);
    assert.deepEqual(ok.data.closers.map(item => [item.mode, item.amount]).sort(), [["auto", 400], ["offset", 400]]);
    const s = await inv(ids.sale);
    assert.deepEqual([s.payState, s.closers.map(item => [item.mode, item.amount])], ["paid", [["offset", 400]]]);
    assert.equal(await balance(ids.party), before.balance);
    assert.equal(await cashBalance(), before.cash);
    // İkinci mahsup: satışın açığı kalmadı.
    const again = await api.post(`/api/workspace/invoices/${ids.purchase}/offsets`, { counterType: "invoice", counterId: ids.sale, amount: 1, date: shift(0) });
    assert.equal(again.status, 409);
    const removed = await api.del(`/api/workspace/invoices/${ids.purchase}/offsets/${ok.data.offsetId}`);
    assert.equal(removed.status, 200);
    assert.deepEqual([removed.data.paid, (await inv(ids.sale)).paid], [400, 0]);
    // Yeniden mahsup (sonraki testler için kalsın).
    const redo = await api.post(`/api/workspace/invoices/${ids.purchase}/offsets`, { counterType: "invoice", counterId: ids.sale, amount: 400, date: shift(0) });
    assert.equal(redo.status, 200);
    ids.offset = redo.data.offsetId;
  });
  test("Alacak Yaz satırı mahsupta karşı belge olabilir (kalanı aşamaz); Borç Yaz satırı alış faturasını kendiliğinden kapatmaz", async () => {
    const debt = await api.post(`/api/workspace/accounts/${ids.party}/entries`, { kind: "debt", amount: 300, date: shift(-1), note: "elle borç" });
    assert.equal(debt.status, 200);
    assert.equal((await inv(ids.purchase)).paid, 800);
    const candidates = (await api.get(`/api/workspace/invoices/${ids.purchase}/offsets`)).data;
    assert.deepEqual(candidates.entries.map(item => [item.id, item.left]), [[debt.data.entryId, 300]]);
    const offset = await api.post(`/api/workspace/invoices/${ids.purchase}/offsets`, { counterType: "entry", counterId: debt.data.entryId, amount: 300, date: shift(0) });
    assert.equal(offset.status, 200, JSON.stringify(offset.data));
    assert.equal(offset.data.paid, 1100);
    const more = await api.post(`/api/workspace/invoices/${ids.purchase}/offsets`, { counterType: "entry", counterId: debt.data.entryId, amount: 1, date: shift(0) });
    assert.equal(more.status, 409);
  });
  test("iptal: satış iptal edilince mahsup düşer, alış yeniden hesaplanır; bağlı ödemenin bağı iptalde kalkar (otomatiğe döner)", async () => {
    const cancel = await api.post(`/api/workspace/invoices/${ids.sale}/cancel`, { reason: "test" });
    assert.equal(cancel.status, 200, JSON.stringify(cancel.data));
    const p = await inv(ids.purchase);
    assert.equal(p.paid, 700, "mahsup 400 düştü; otomatik 400 + Borç Yaz mahsubu 300 kaldı");
    assert.ok(!p.closers.some(item => item.id.startsWith("offset:") && item.note === ids.sale));
    const cancelCopy = await api.post(`/api/workspace/invoices/${ids.copy}/cancel`, { reason: "test" });
    assert.equal(cancelCopy.status, 200);
    // Kopyaya bağlı 1.000 ödeme artık bağsız → en eski açık alış faturasına (ALS-89) otomatik düşer.
    const after = await inv(ids.purchase);
    assert.equal(after.paid, 1700);
    assert.ok(after.closers.some(item => item.mode === "auto" && item.amount === 1000));
  });
  test("mutabakat: fatura ödenen toplamı = kapatanların toplamı; bütünlük denetimi temiz", async () => {
    for (const id of [ids.purchase]) {
      const doc = await inv(id);
      assert.equal(Math.round(doc.closers.reduce((sum, item) => sum + item.amount, 0) * 100) / 100, doc.paid);
    }
    const health = await api.get("/api/admin/integrity");
    if (health.status === 200) {
      const offsetCheck = (health.data.checks || []).find(item => item.code === "invoice:offset");
      assert.ok(!offsetCheck || offsetCheck.ok, JSON.stringify(offsetCheck));
    }
  });
});

describe("Madde 10: iade faturası düzenlenir; sınırlar; POS İadesi; pasif düğme nedeni", () => {
  let server;
  let api;
  const ids = {};
  before(async () => {
    server = await startTestServer();
    api = apiOf(await loginAdmin(server));
    ids.customer = (await api.post("/api/workspace/accounts", { name: "İade Müşterisi", type: "customer" })).data.id;
    ids.item = (await api.post("/api/workspace/stock", { name: "Defter", code: "DFT-1", unit: "Adet", salePrice: 100 })).data.id;
    await api.post("/api/workspace/cash", { kind: "in", amount: 5000, date: shift(-10), description: "Açılış" });
    const sale = await api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: ids.customer, issueDate: shift(-5), lines: [{ itemId: ids.item, qty: 10, unitPrice: 100, vatRate: 0 }], payment: { cash: [{ amount: 1000, method: "card" }], rest: "open" }, force: true });
    assert.equal(sale.status, 200, JSON.stringify(sale.data));
    ids.sale = sale.data.id;
    ids.line = sale.data.lines[0].id;
    const ret = await api.post("/api/workspace/invoices", { kind: "sale_return", originalId: ids.sale, issueDate: shift(-2), lines: [{ originLineId: ids.line, qty: 3 }], payment: { cash: [{ amount: 300, method: "card" }], rest: "open" } });
    assert.equal(ret.status, 200, JSON.stringify(ret.data));
    ids.ret = ret.data.id;
  });
  after(async () => server.close());
  const inv = async (id, q = "") => (await api.get(`/api/workspace/invoices/${id}${q}`)).data;
  const stockQty = async () => Number((await api.get(`/api/workspace/stock/${ids.item}`)).data.qty);
  const balance = async () => (await api.get(`/api/workspace/accounts/${ids.customer}`)).data.totals.balance;

  test("iade kartı: Düzenle açık (canModify), karta iade 'POS İadesi'; asıl faturanın kalanı iade hariç 7, düzenleme için 10", async () => {
    const doc = await inv(ids.ret);
    assert.equal(doc.canModify, true, doc.modifyBlock);
    assert.equal(doc.modifyBlock, "");
    assert.deepEqual(doc.payments.map(item => [item.kind, item.methodLabel]), [["out", "POS İadesi"]]);
    const original = await inv(ids.sale);
    assert.equal(original.returnable[0].left, 7);
    assert.equal((await inv(ids.sale, `?excludeReturn=${ids.ret}`)).returnable[0].left, 10);
    assert.equal(original.canModify, false);
    assert.match(original.modifyBlock, /iade/);
  });
  test("iade düzenle: miktar 3 → 5, aynı numara; stok/cari/Kasa yeni hâle göre; asıl faturanın kalanı 5", async () => {
    const before = { stock: await stockQty(), balance: await balance() };
    const edited = await api.post(`/api/workspace/invoices/${ids.ret}/edit`, { originalId: ids.sale, issueDate: shift(-2), lines: [{ originLineId: ids.line, qty: 5 }], payment: { cash: [{ amount: 300, method: "card" }], rest: "open" } });
    assert.equal(edited.status, 200, JSON.stringify(edited.data));
    assert.equal(edited.data.id, ids.ret);
    assert.equal(edited.data.lines[0].qty, 5);
    assert.equal(edited.data.tryPayable, 500);
    assert.equal(await stockQty(), before.stock + 2, "iade 3'ten 5'e: stoğa 2 daha girer");
    assert.equal(await balance(), before.balance - 200, "müşterinin borcu 200 daha düşer");
    assert.equal((await inv(ids.sale)).returnable[0].left, 5);
  });
  test("sınırlar: kalanı aşan miktar 400 (6 iade edilebilir değil: 10 − 0 diğer iade → en çok 10, 11 → 400); asıl faturadan önceki tarih 400; asıl fatura/cari değiştirilemez 400", async () => {
    const over = await api.post(`/api/workspace/invoices/${ids.ret}/edit`, { originalId: ids.sale, issueDate: shift(-2), lines: [{ originLineId: ids.line, qty: 11 }], payment: {} });
    assert.equal(over.status, 400, JSON.stringify(over.data));
    const early = await api.post(`/api/workspace/invoices/${ids.ret}/edit`, { originalId: ids.sale, issueDate: shift(-9), lines: [{ originLineId: ids.line, qty: 2 }], payment: {} });
    assert.equal(early.status, 400);
    assert.match(JSON.stringify(early.data), /asıl faturanın tarihinden/);
    const other = await api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: ids.customer, issueDate: shift(-4), lines: [{ itemId: ids.item, qty: 1, unitPrice: 100, vatRate: 0 }], payment: { rest: "open" }, force: true });
    const swap = await api.post(`/api/workspace/invoices/${ids.ret}/edit`, { originalId: other.data.id, issueDate: shift(-2), lines: [{ originLineId: other.data.lines[0].id, qty: 1 }], payment: {} });
    assert.equal(swap.status, 400);
    assert.match(JSON.stringify(swap.data), /asıl faturası düzenlemede değişmez/);
  });
  test("pasif düğme nedeni: asıl faturada Düzenle/İptal kapalı nedeni metin olarak gelir; tamamı iade edilince İade nedeni", async () => {
    const original = await inv(ids.sale);
    assert.match(original.cancelBlock, /iade faturası var/);
    assert.equal(original.returnBlock, "");
    const full = await api.post(`/api/workspace/invoices/${ids.ret}/edit`, { originalId: ids.sale, issueDate: shift(-2), lines: [{ originLineId: ids.line, qty: 10 }], payment: {} });
    assert.equal(full.status, 200, JSON.stringify(full.data));
    const done = await inv(ids.sale);
    assert.equal(done.canReturn, false);
    assert.match(done.returnBlock, /tamamı iade edildi/);
  });
});
