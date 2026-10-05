// 2.0.24 — iade faturası asıl faturayı taksitlendiren kartı küçültür (2.0.23 bilinen sınırı; gözden geçirme #8 ve 2. tur #5).
// Kural: iade, asıl faturanın açığını düşürür; o açığı taksitlendiren kart (faturanın kendi kartı ya da faturayı kapsayan
// "Carinin Mevcut Borcu" kartı) aynı kadar küçülür. Başka kart küçülmez; caride başka açık borç olması sonucu değiştirmez.
// Değişmez: fatura açığı = kendi kartının kalanı; yaşlandırma toplamı = cari bakiye. İade iptali kartı geri büyütür.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const money = text => Number(String(text).replace(/[^\d,-]/g, "").replace(",", ".")) || 0;

describe("2.0.24 iade → doğru taksit kartı", () => {
  let server;
  let api;
  let item;
  let n = 0;
  let day = 0;
  // Seri numarası ve tarih sırası (FIS kronolojisi) bütün testlerde artar.
  const d = () => { const t = new Date(Date.UTC(2025, 1, 1 + day++)); return t.toISOString().slice(0, 10); };
  before(async () => {
    server = await startTestServer();
    const client = await loginAdmin(server);
    api = {
      get: async url => unwrap(await client.get(url)),
      post: async (url, body) => unwrap(await client.post(url, body)),
      put: async (url, body) => unwrap(await client.put(url, body)),
      del: async url => unwrap(await client.del(url)),
    };
    item = (await api.post("/api/workspace/stock", { kind: "service", code: "HZM", name: "Hizmet", unit: "Adet", salePrice: "1000" })).data;
  });
  after(async () => server.close());

  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  const customer = async label => must("cari", api.post("/api/workspace/accounts", { name: `İade ${label}`, type: "customer", registeredOn: "2025-01-01", phone: `0500 000 24 ${String((n += 1)).padStart(2, "0")}` }));
  const sale = async (acc, date, qty, installments = false) => {
    const doc = await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ itemId: item.id, qty, unitPrice: 1000, vatRate: 0 }], payment: installments ? { rest: "installments", installments: { count: 3, firstDue: "2025-06-01", everyMonths: 1 } } : { rest: "open", dueDate: date } }));
    return must("fatura oku", api.get(`/api/workspace/invoices/${doc.id}`));
  };
  const giveBack = async (inv, date, qty) => must("iade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: inv.id, issueDate: date, lines: [{ originLineId: inv.lines[0].id, qty }], payment: {} }));
  const cover = async (acc, date, total) => must("kart", api.post("/api/workspace/plans", { name: `${acc.name} ${date}`, registeredOn: date, total: String(total), accountId: acc.id, mode: "auto", count: "2", firstDue: "2025-06-01", coversBalance: true }));
  const card = async id => (await must("kart", api.get(`/api/workspace/plans/${id}`))).totals;
  const invoice = async id => must("fatura", api.get(`/api/workspace/invoices/${id}`));
  const balance = async acc => (await must("cari", api.get(`/api/workspace/accounts?status=all&limit=50&q=${encodeURIComponent(acc.name)}`))).accounts.find(a => a.id === acc.id).balance;
  const aging = async acc => money((await must("yaşlandırma", api.get("/api/workspace/report-center/alacak-yaslandirma"))).rows.find(r => r[0] === acc.name)?.at(-1) || "0");

  test("taksitli fatura + caride başka açık borç: iade faturanın kendi kartını küçültür", async () => {
    const acc = await customer("Başka Borç");
    const own = await sale(acc, d(), 3, true);
    const other = await sale(acc, d(), 2);
    await giveBack(own, d(), 1);
    const [o, k, x] = [await invoice(own.id), await card(own.planId), await invoice(other.id)];
    assert.deepEqual([o.open, k.total, k.remaining, x.open, await balance(acc)], [2000, 2000, 2000, 2000, 4000]);
    assert.equal(await aging(acc), 4000, "yaşlandırma = bakiye");
  });

  test("iki taksitli fatura: iade yalnız asıl faturanın kartını küçültür (daha yeni kart değil)", async () => {
    const acc = await customer("İki Kart");
    const a = await sale(acc, d(), 3, true);
    const b = await sale(acc, d(), 3, true);
    await giveBack(a, d(), 1);
    assert.deepEqual([(await card(a.planId)).remaining, (await card(b.planId)).remaining, (await invoice(a.id)).open, (await invoice(b.id)).open], [2000, 3000, 2000, 3000]);
    assert.equal(await aging(acc), 5000);
  });

  test("iki Mevcut Borç kartı: iade, faturayı kapsayan kartı küçültür (2. tur #5)", async () => {
    const acc = await customer("Mevcut Borç");
    const a = await sale(acc, d(), 2);
    const k1 = await cover(acc, d(), 2000);
    await sale(acc, d(), 1);
    const k2 = await cover(acc, d(), 1000);
    await must("iade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: a.id, issueDate: d(), lines: [{ originLineId: a.lines[0].id, qty: 0.5 }], payment: {} }));
    assert.deepEqual([(await card(k1.id)).remaining, (await card(k2.id)).remaining, await balance(acc)], [1500, 1000, 2500]);
    assert.equal(await aging(acc), 2500, "yaşlandırma = bakiye (2.0.23'te 3.000)");
  });

  test("kısmen tahsil edilmiş kart: iade kalanı düşürür; kalanı aşan iade avans olur, kart sıfırlanır", async () => {
    const acc = await customer("Kısmi");
    const own = await sale(acc, d(), 3, true);
    await must("taksit tahsilatı", api.post(`/api/workspace/plans/${own.planId}/entries`, { kind: "in", amount: 2500, date: d(), method: "cash" }));
    await giveBack(own, d(), 1);
    const k = await card(own.planId);
    assert.deepEqual([(await invoice(own.id)).open, k.remaining, await balance(acc)], [0, 0, -500]);
  });

  test("iade iptali kartı geri büyütür (iade ile iptal birbirini götürür)", async () => {
    const acc = await customer("İptal");
    const own = await sale(acc, d(), 3, true);
    const other = await sale(acc, d(), 2);
    const ret = await giveBack(own, d(), 1);
    await must("iade iptali", api.post(`/api/workspace/invoices/${ret.id}/cancel`, {}));
    assert.deepEqual([(await invoice(own.id)).open, (await card(own.planId)).remaining, (await invoice(other.id)).open, await balance(acc)], [3000, 3000, 2000, 5000]);
  });
  test("iade düzenlenince kart yeni iadeye göre: 1 → 2 → 1 adet", async () => {
    const acc = await customer("Düzenle");
    const own = await sale(acc, d(), 3, true);
    const other = await sale(acc, d(), 2);
    const ret = await giveBack(own, d(), 1);
    const date = (await invoice(ret.id)).issueDate;
    for (const [qty, left] of [[2, 1000], [1, 2000]]) {
      await must("iade düzenle", api.post(`/api/workspace/invoices/${ret.id}/edit`, { originalId: own.id, issueDate: date, lines: [{ originLineId: own.lines[0].id, qty }], payment: {} }));
      assert.deepEqual([(await invoice(own.id)).open, (await card(own.planId)).remaining, (await invoice(other.id)).open], [left, left, 2000], `${qty} adet`);
    }
    assert.equal(await aging(acc), 4000);
  });

  test("Mevcut Borç kartında iade iptali kartı geri büyütür", async () => {
    const acc = await customer("Kapsam İptal");
    const a = await sale(acc, d(), 2);
    const k = await cover(acc, d(), 2000);
    const ret = await giveBack(a, d(), 1);
    assert.equal((await card(k.id)).remaining, 1000);
    await must("iade iptali", api.post(`/api/workspace/invoices/${ret.id}/cancel`, {}));
    assert.deepEqual([(await card(k.id)).remaining, await balance(acc), await aging(acc)], [2000, 2000, 2000]);
  });
  test("iade avansa taşmışken kart tahsilatı silinince/düzeltilince kartın kalanı faturanın açığına eşit kalır (mutabakat bulgusu)", async () => {
    const acc = await customer("Tahsilat Sil");
    const own = await sale(acc, d(), 3, true);
    const pay = await must("taksit tahsilatı", api.post(`/api/workspace/plans/${own.planId}/entries`, { kind: "in", amount: 2500, date: d(), method: "cash" }));
    await giveBack(own, d(), 1); // açık 500'dü: 500 faturayı kapatır, 500 avans; kart 0
    assert.deepEqual([(await invoice(own.id)).open, (await card(own.planId)).remaining], [0, 0]);
    await must("tahsilatı düzelt", api.put(`/api/workspace/plans/${own.planId}/entries/${pay.entryId}`, { amount: 1500 }));
    assert.deepEqual([(await invoice(own.id)).open, (await card(own.planId)).remaining, await balance(acc)], [500, 500, 500], "düzeltme sonrası");
    await must("tahsilatı sil", api.del(`/api/workspace/plans/${own.planId}/entries/${pay.entryId}`));
    assert.deepEqual([(await invoice(own.id)).open, (await card(own.planId)).remaining, await balance(acc)], [2000, 2000, 2000], "silme sonrası");
    assert.equal(await aging(acc), 2000);
    const planName = (await must("kart", api.get(`/api/workspace/plans/${own.planId}`))).name;
    const trashed = (await must("silinenler", api.get("/api/admin/trash"))).find(t => t.kind === "plan-entry" && t.title === planName);
    assert.ok(trashed, "silinen tahsilat Silinenler'de olmalı");
    await must("geri yükle", api.post("/api/admin/trash/restore", { id: trashed.id }));
    assert.deepEqual([(await invoice(own.id)).open, (await card(own.planId)).remaining, await balance(acc)], [500, 500, 500], "geri yükleme sonrası");
  });
  // ---------- Bağımsız gözden geçirme (2.0.24) bulguları ----------
  const giveBackPaid = async (inv, date, qty, amount, method = "cash") => must("paralı iade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: inv.id, issueDate: date, lines: [{ originLineId: inv.lines[0].id, qty }], payment: { cash: [{ amount, method }], rest: "open" } }));

  test("G1: parası geri verilen iade kartı küçültmez (müşteri borcu değişmedi)", async () => {
    const acc = await customer("Nakit İade");
    const own = await sale(acc, d(), 3, true);
    await giveBackPaid(own, d(), 1, 1000);
    assert.deepEqual([(await card(own.planId)).remaining, await balance(acc), await aging(acc)], [3000, 3000, 3000]);
  });

  test("G1: karttan tahsilattan sonra paralı iade — kart borç kadar kalır", async () => {
    const acc = await customer("Tahsil Sonra İade");
    const own = await sale(acc, d(), 3, true);
    await must("taksit tahsilatı", api.post(`/api/workspace/plans/${own.planId}/entries`, { kind: "in", amount: 1000, date: d(), method: "cash" }));
    await giveBackPaid(own, d(), 1, 1000, "bank");
    assert.deepEqual([(await card(own.planId)).remaining, await balance(acc), await aging(acc)], [2000, 2000, 2000]);
  });

  test("G1: Mevcut Borç kartının kapsadığı faturadan paralı iade kartı küçültmez", async () => {
    const acc = await customer("Kapsam Nakit İade");
    const a = await sale(acc, d(), 2);
    const k = await cover(acc, d(), 2000);
    await giveBackPaid(a, d(), 1, 1000);
    assert.deepEqual([(await card(k.id)).remaining, await balance(acc), await aging(acc)], [2000, 2000, 2000]);
  });

  test("G2: kartın kapsadığı YENİ faturadan iade — yaşlandırma = bakiye (aynı borç iki kez sayılmaz)", async () => {
    const acc = await customer("Yeni Fatura İade");
    await sale(acc, d(), 2);
    const b = await sale(acc, d(), 1);
    const k = await cover(acc, d(), 2000);
    await must("iade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: b.id, issueDate: d(), lines: [{ originLineId: b.lines[0].id, qty: 0.5 }], payment: {} }));
    assert.deepEqual([(await card(k.id)).remaining, await balance(acc), await aging(acc)], [1500, 2500, 2500]);
    await must("iade 2", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: b.id, issueDate: d(), lines: [{ originLineId: b.lines[0].id, qty: 0.5 }], payment: {} }));
    assert.deepEqual([(await card(k.id)).remaining, await balance(acc), await aging(acc)], [1000, 2000, 2000]);
  });

  test("G3: faturanın açığını aşan iade (avans) başka faturayı kapsayan kartı da küçültür — 2.0.23'teki gibi", async () => {
    const acc = await customer("Avans Kapsam");
    const a = await sale(acc, d(), 2);
    assert.equal((await api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: 1500, date: d(), method: "cash", invoiceId: a.id })).status, 200);
    await sale(acc, d(), 1);
    const k = await cover(acc, d(), 1000);
    const ret = await must("iade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: a.id, issueDate: d(), lines: [{ originLineId: a.lines[0].id, qty: 1 }], payment: {} }));
    assert.deepEqual([(await card(k.id)).remaining, await balance(acc), await aging(acc)], [500, 500, 500]);
    await must("iade iptali", api.post(`/api/workspace/invoices/${ret.id}/cancel`, {}));
    assert.deepEqual([(await card(k.id)).remaining, await balance(acc), await aging(acc)], [1000, 1500, 1500], "iptal kartı geri büyütür");
  });

  test("G4: karta sayılan çek karşılıksız / silinir / tutarı düzeltilir → kart = fatura açığı", async () => {
    const acc = await customer("Çek Kart");
    const own = await sale(acc, d(), 3, true);
    const ch = await must("çek", api.post("/api/workspace/cheques", { instrument: "cheque", direction: "in", accountId: acc.id, planId: own.planId, amount: 2500, issueDate: d(), dueDate: "2026-12-31", serialNo: `G4-${n}`, bank: "Z" }));
    await giveBack(own, d(), 1);
    assert.deepEqual([(await invoice(own.id)).open, (await card(own.planId)).remaining], [0, 0], "iade sonrası");
    await must("çek tutarı", api.put(`/api/workspace/cheques/${ch.id}`, { amount: 1500 }));
    assert.deepEqual([(await invoice(own.id)).open, (await card(own.planId)).remaining, await balance(acc)], [500, 500, 500], "çek düzeltme sonrası");
    await must("karşılıksız", api.post(`/api/workspace/cheques/${ch.id}/actions`, { action: "bounce", date: d() }));
    assert.deepEqual([(await invoice(own.id)).open, (await card(own.planId)).remaining, await balance(acc)], [2000, 2000, 2000], "karşılıksız sonrası");
  });
});
