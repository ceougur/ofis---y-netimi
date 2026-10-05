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
});
