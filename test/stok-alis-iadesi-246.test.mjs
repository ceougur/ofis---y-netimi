// 2.4.6 madde 10 — stok formunda faturasız Alış İadesi ("Tedarikçiye İade"; stock_moves.reason 'preturn'). 2.4.5 KS7 (a) kuralı (lib/invoice-settle.mjs classifyLine:
// faturasız stok Alış İadesi tedarikçide borç satırıdır = bağsız ÖDEME, en eski açık alış faturasını kapatır) bugüne kadar yalnız birim testteydi; formda yol yoktu
// (BİLİNEN SINIR, docs/2.4.5-IS-LISTESI.md D1 DÜZELTMESİ + KS7.1). KS7.1 simetrisi: tedarikçiye NEDENSİZ stok çıkışı (reason '', "Stok satışı") yükümlülük KALIR.
// Kural kaynağı (önceden yazılmış): KS7 (a) metni + invoice-settle.mjs 2.0.17 başlığı ("borç tarafında … alıştan iade ödemedir") + yevmiye düzeni (general-ledger.mjs:
// alıştan iade faturası B 320 / A 153 matrah). Beklenen sayılar bu metinden elle (ders 5).
//   Açık hesap: tedarikçide Borç satırı "Alış iadesi: …" (borcumuz azalır), en eski açık alış faturası kapanır; stok azalır; yevmiye B 320 / A 153; 600'e yazılmaz;
//   Kasa değişmez. Nakit / Havale: Kasa / banka girişi, yevmiye B 100 (102) / A 153. Kart yolu yok (400). Taksitlendirilmez. Yönetim yetkisi (Satış Yapma yetmez).
//   Düzelt / Sil / Silinenler'den geri yükle nedeni ('preturn') korur. İadenin tedarikçiden geri ödenmesi (Tahsilat → Geri Ödenen İade) madde 9 bağıyla.
// "Nasıl bozulur?": neden yok sayılır (satış olur: 600, yükümlülük); stoğa giriş olur; Kasa'dan çıkış olur; geri yüklemede neden düşer; satış yetkisiyle para yazılır;
// kart yolu POS satışı açar; taksit kartı açılır.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

const NOW = "2026-10-20T12:00:00+03:00";
const TODAY = "2026-10-20";
const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  client,
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async url => unwrap(await client.del(url)),
});

describe("Madde 10 API: Tedarikçiye İade (faturasız Alış İadesi, 'preturn')", () => {
  let server;
  let admin;
  let api;
  let goods;
  let n = 0;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true }, legacyCasePayments: false, legacyTableTransfer: false, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    admin = await loginAdmin(server);
    api = apiOf(admin);
    await api.post("/api/workspace/bank/setup/dismiss", {});
    goods = (await api.post("/api/workspace/stock", { kind: "goods", code: "URN-PR", name: "Ürün Alış İadesi", unit: "Adet", salePrice: "150", unitPrice: "100", openingQty: "100" })).data;
  });
  after(async () => server?.close());

  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
    return res.data;
  };
  const store = () => server.app.store;
  const supplierOf = async label => must("tedarikçi", api.post("/api/workspace/accounts", { name: `PR ${label}`, type: "supplier", registeredOn: day(-400), phone: `0500 247 00 ${String((n += 1)).padStart(2, "0")}` }));
  const bill = async (acc, number, date, qty) => must("alış", api.post("/api/workspace/invoices", { kind: "purchase", accountId: acc.id, number, issueDate: date, pricesIncludeVat: false, lines: [{ name: "Malzeme", qty, unitPrice: 100, vatRate: 0 }], payment: { rest: "open", dueDate: date } }));
  const invoice = async id => {
    const doc = await must("fatura oku", api.get(`/api/workspace/invoices/${id}`));
    return [doc.payState, doc.open];
  };
  const qty = async () => (await must("ürün", api.get(`/api/workspace/stock/${goods.id}`))).qty;
  const lastMove = () => store().get("SELECT id, kind, reason, pay, amount, account_id AS accountId FROM stock_moves WHERE item_id = ? ORDER BY rowid DESC LIMIT 1", goods.id);
  // Mizan hesapları (borç / alacak hareketi) — hareketin yevmiyeye nereye yazıldığı farkla okunur.
  const trial = async () => {
    const ledger = await must("defter", api.get("/api/workspace/ledger"));
    assert.equal(ledger.reconciliation.ok, true, `Ana Defter alt defterlerle uyuşuyor: ${JSON.stringify(ledger.reconciliation.checks.filter(check => !check.ok))}`);
    return Object.fromEntries(ledger.trial.accounts.map(row => [row.code, [row.debit, row.credit]]));
  };
  const delta = (a, b) => {
    const out = {};
    for (const code of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const [d0, c0] = a[code] || [0, 0];
      const [d1, c1] = b[code] || [0, 0];
      const dd = Math.round((d1 - d0) * 100) / 100;
      const dc = Math.round((c1 - c0) * 100) / 100;
      if (dd || dc) out[code] = [dd, dc];
    }
    return out;
  };
  const cashTotals = async () => JSON.stringify((await must("kasa", api.get("/api/workspace/cash"))).totals);

  it("Açık Hesap: tedarikçide Borç 'Alış iadesi'; en eski açık alış faturası kapanır; stok azalır; yevmiye B 320 / A 153 (600 yok); Kasa değişmez", async () => {
    const acc = await supplierOf("Açık");
    const p1 = await bill(acc, "PR-A1", day(-50), 3);
    const p2 = await bill(acc, "PR-A2", day(-30), 4);
    const q0 = await qty();
    const cash0 = await cashTotals();
    const t0 = await trial();
    const card = await must("tedarikçiye iade", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", reason: "preturn", qty: "2", unitPrice: "100", pay: "account", accountId: acc.id, date: day(-5), note: "kusurlu" }));
    assert.deepEqual(await invoice(p1.id), ["overdue", 100], "bağsız ödeme (KS7 a): en eski açık alış P1 300 → 200 kapandı, 100 açık");
    assert.deepEqual(await invoice(p2.id), ["overdue", 400], "P2 dokunulmadı");
    assert.deepEqual(delta(t0, await trial()), { 153: [0, 200], 320: [200, 0] }, "yevmiye B 320 / A 153 (satış 600'e yazılmaz)");
    const move = lastMove();
    assert.deepEqual([move.kind, move.reason, move.pay, move.amount], ["out", "preturn", "account", 200], "hareket nedeni 'preturn' (önceden '' — satış sayılırdı)");
    assert.equal(card.qty, q0 - 2, "stok 2 azaldı");
    const entry = store().get("SELECT kind, amount, note FROM account_entries WHERE source = 'stock' AND source_id = ?", move.id);
    assert.deepEqual([entry.kind, entry.amount], ["debt", 200], "tedarikçide Borç satırı (borcumuz azalır)");
    assert.match(entry.note, /^Alış iadesi: Ürün Alış İadesi 2 Adet/);
    assert.equal((await must("cari", api.get(`/api/workspace/accounts/${acc.id}`))).totals.balance, -500, "borcumuz 300 + 400 − 200");
    assert.equal(await cashTotals(), cash0, "açık hesaba iade Kasa'yı değiştirmez");
    assert.ok(card.moves.some(row => row.id === move.id && row.reason === "preturn"), "ürün kartının hareketlerinde neden görünür");
  });

  it("KS7.1 aynen: tedarikçiye NEDENSİZ açık hesap çıkışı yükümlülüktür (alış faturasını kapatmaz; yevmiye 600)", async () => {
    const acc = await supplierOf("Nedensiz");
    const p = await bill(acc, "PR-N1", day(-40), 3);
    const t0 = await trial();
    await must("nedensiz çıkış", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", qty: "1", unitPrice: "100", pay: "account", accountId: acc.id, date: day(-4) }));
    assert.equal(lastMove().reason, "", "neden yok");
    assert.deepEqual(await invoice(p.id), ["overdue", 300], "yükümlülük: alış faturası açık kalır");
    assert.deepEqual(delta(t0, await trial()), { 320: [100, 0], 600: [0, 100] }, "veresiye satış maddesi (değişmedi)");
  });

  it("Nakit / Havale: para tedarikçiden geri alınır — Kasa / banka girişi, yevmiye B 100 (102) / A 153; kart yolu 400 (hiçbir şey yazılmaz)", async () => {
    const t0 = await trial();
    const kasa0 = JSON.parse(await cashTotals());
    await must("nakit iade", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", reason: "preturn", qty: "1", unitPrice: "100", pay: "cash", method: "cash", date: day(-3) }));
    const cashMove = lastMove();
    assert.deepEqual([cashMove.reason, cashMove.pay], ["preturn", "cash"]);
    assert.deepEqual(delta(t0, await trial()), { 100: [100, 0], 153: [0, 100] }, "B 100 / A 153 (peşin satış 600 değil)");
    const kasa1 = JSON.parse(await cashTotals());
    assert.equal(JSON.stringify(kasa1) !== JSON.stringify(kasa0), true, "Kasa'ya giriş");
    const t1 = await trial();
    await must("havale iade", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", reason: "preturn", qty: "1", unitPrice: "100", pay: "cash", method: "bank", date: day(-3) }));
    const bankDelta = delta(t1, await trial());
    assert.deepEqual(bankDelta[153], [0, 100], "havalede de A 153");
    assert.deepEqual(bankDelta[102], [100, 0], "B 102 (banka)");
    assert.equal(bankDelta[600], undefined);
    const count = store().get("SELECT COUNT(*) AS n FROM stock_moves").n;
    const card = await api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", reason: "preturn", qty: "1", unitPrice: "100", pay: "cash", method: "card", date: day(-3) });
    assert.equal(card.status, 400, `kart yolu: ${card.status} ${JSON.stringify(card.data).slice(0, 200)}`);
    assert.equal(card.data.code, "preturn-card");
    assert.equal(store().get("SELECT COUNT(*) AS n FROM stock_moves").n, count, "reddedilen istek hareket yazmadı (ders 3)");
  });

  it("taksitlendirilmez; Satış Yapma yetkisi para yazdıramaz (yalnız miktar); satış yine yazdırır", async () => {
    const acc = await supplierOf("Yetki");
    await must("taksitli istek", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", reason: "preturn", qty: "1", unitPrice: "100", pay: "account", accountId: acc.id, date: day(-2), installments: { count: 3, firstDue: day(5), everyMonths: 1 } }));
    assert.equal(store().get("SELECT COUNT(*) AS n FROM plans WHERE account_id = ?", acc.id).n, 0, "tedarikçiye iade taksit kartı açmaz");
    const staff = apiOf(await createUser(server, admin, { username: "satisci", role: "personel" }));
    const users = await must("kullanıcılar", api.get("/api/admin/users"));
    const target = (users.users || users).find(user => user.username === "satisci");
    await must("Satış Yapma ver", api.client.patch(`/api/admin/users/${target.id}`, { grants: { add: ["stock.sell"], remove: [] } }).then(res => ({ status: res.status, data: res.data?.data })));
    const refusedMove = await staff.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", reason: "preturn", qty: "1", unitPrice: "100", pay: "account", accountId: acc.id, date: day(-2) });
    assert.equal(refusedMove.status, 403, `tedarikçiye iade (para) yönetim yetkisi: ${refusedMove.status}`);
    await must("yalnız miktar", staff.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", reason: "preturn", qty: "1", pay: "none", date: day(-2) }));
    assert.deepEqual([lastMove().reason, lastMove().pay], ["preturn", "none"]);
    const customer = await must("müşteri", api.post("/api/workspace/accounts", { name: "PR Müşteri", type: "customer", registeredOn: day(-400) }));
    await must("satış (Satış Yapma yeter)", staff.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", qty: "1", unitPrice: "150", pay: "account", accountId: customer.id, date: day(-2) }));
  });

  it("Düzelt nedeni korur; Sil → Silinenler'den geri yükle 'preturn' olarak döner (alış faturası yeniden kapanır)", async () => {
    const acc = await supplierOf("Geri Yükle");
    const p = await bill(acc, "PR-G1", day(-20), 5);
    await must("iade", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", reason: "preturn", qty: "2", unitPrice: "100", pay: "account", accountId: acc.id, date: day(-1) }));
    const move = lastMove();
    await must("düzelt (miktar 3)", api.put(`/api/workspace/stock/${goods.id}/moves/${move.id}`, { qty: "3" }));
    assert.equal(store().get("SELECT reason FROM stock_moves WHERE id = ?", move.id).reason, "preturn", "düzeltme nedeni korur");
    assert.deepEqual(await invoice(p.id), ["overdue", 200], "500 − 300");
    await must("sil", api.del(`/api/workspace/stock/${goods.id}/moves/${move.id}`));
    assert.deepEqual(await invoice(p.id), ["overdue", 500]);
    const item = store().get("SELECT id FROM trash WHERE ref = ? ORDER BY rowid DESC LIMIT 1", move.id);
    await must("geri yükle", api.post("/api/admin/trash/restore", { id: `trash:${item.id}` }));
    assert.equal(store().get("SELECT reason FROM stock_moves WHERE id = ?", move.id)?.reason, "preturn", "geri yüklemede neden korunur (önceden '' olurdu)");
    assert.deepEqual(await invoice(p.id), ["overdue", 200], "geri yüklenen iade yine alış faturasını kapatır");
    const entry = store().get("SELECT kind, note FROM account_entries WHERE source = 'stock' AND source_id = ?", move.id);
    assert.equal(entry.kind, "debt");
    assert.match(entry.note, /^Alış iadesi:/);
  });

  it("madde 9 ile: tedarikçi iade bedelini geri öderse (Tahsilat → Geri Ödenen İade: bu iade) alış faturası yeniden açılır; bakiye tutarlı", async () => {
    const acc = await supplierOf("Geri Ödeme");
    const p = await bill(acc, "PR-R1", day(-15), 5);
    await must("açık hesap iade", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", reason: "preturn", qty: "2", unitPrice: "100", pay: "account", accountId: acc.id, date: day(-1) }));
    const move = lastMove();
    assert.deepEqual(await invoice(p.id), ["overdue", 300]);
    const card = await must("cari", api.get(`/api/workspace/accounts/${acc.id}`));
    assert.deepEqual(card.refundables.map(item => [item.id, item.refundKind, item.left]), [[move.id, "in", 200]], "Tahsilat formunda seçenek: bu iade, kalan 200");
    await must("tedarikçinin geri ödemesi", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "200", date: day(0), method: "cash", refundOf: move.id }));
    assert.deepEqual(await invoice(p.id), ["overdue", 500], "iade geri ödendi: alış faturası 500 açık (borcumuz)");
    assert.equal((await must("cari", api.get(`/api/workspace/accounts/${acc.id}`))).totals.balance, -500);
  });
});
