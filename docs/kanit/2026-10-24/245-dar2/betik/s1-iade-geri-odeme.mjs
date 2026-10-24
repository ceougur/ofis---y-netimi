// 2.4.5 ikinci dar kontrol — S1: faturasız stok Satış İadesi (açık hesap) + sonra cari kartından "Ödeme" ile iade bedelinin geri ödenmesi.
// KS7 (a) iadeyi bağsız ÖDEME saydı; geri ödeme (cari "Ödeme", çıkış) ise borç tarafında ödeme kalır → iade alacağı en eski açık borcu kapatır,
// geri ödeme onu yeniden AÇMAZ (v2.1.0 R1'in "iade alacağı en eski açık satışı FIFO ile kapatıp geri ödeme onu yeniden açmıyordu" sınıfı).
// Karşılaştırma: aynı akış fatura iadesiyle (B: cari "Ödeme" ile geri ödeme; C: iade belgesinin kendi geri ödemesi).
// Kullanım: ROOT=<kod kökü> node s1-iade-geri-odeme.mjs  → JSON
import { start, must, day } from "./h.mjs";

const out = {};
{
  async function scenario(name, mode) {
    const { server, api } = await start();
    try {
    const goods = await must("ürün", api.post("/api/workspace/stock", { kind: "goods", code: "URN-1", name: "Ürün", unit: "Adet", salePrice: "100", openingQty: "100" }));
    const acc = await must("cari", api.post("/api/workspace/accounts", { name, type: "customer", registeredOn: day(-400), phone: `0500111${String(Math.floor(Math.random() * 1e4)).padStart(4, "0")}` }));
    const a = await must("fatura A", api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: acc.id, issueDate: day(-60), lines: [{ itemId: goods.id, qty: 10, unitPrice: "100", vatRate: 0 }], payment: { rest: "open", dueDate: day(-50) } }));
    await must("tahsilat", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "1000", date: day(-55), method: "cash" }));
    const b = await must("fatura B", api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: acc.id, issueDate: day(-30), lines: [{ itemId: goods.id, qty: 5, unitPrice: "100", vatRate: 0 }], payment: { rest: "open", dueDate: day(-20) } }));
    await must("borç", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: "300", date: day(-25), dueDate: day(-10), method: "cash" }));
    let ret = null;
    if (mode === "stok") {
      await must("stok iade", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", reason: "return", qty: "3", unitPrice: "100", pay: "account", accountId: acc.id, date: day(-5) }));
    } else {
      const full = await must("A oku", api.get(`/api/workspace/invoices/${a.id}`));
      ret = await must("iade faturası", api.post("/api/workspace/invoices", { kind: "sale_return", accountId: acc.id, originalId: a.id, issueDate: day(-5), issueTime: "11:00", currency: "TRY", rate: 1, lines: [{ originLineId: full.lines[0].id, qty: 3 }], payment: { cash: mode === "fatura-kendi" ? [{ amount: "300", method: "cash", date: day(-4) }] : [], cheques: [], endorse: [], rest: "open" }, force: true, cashForce: true }));
    }
    if (mode !== "fatura-kendi") await must("geri ödeme", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "out", amount: "300", date: day(-4), method: "cash", cashForce: true }));
    const card = await must("kart", api.get(`/api/workspace/accounts/${acc.id}`));
    const debt = card.entries.find(e => e.kind === "debt" && !e.source);
    const da = await must("A", api.get(`/api/workspace/invoices/${a.id}`));
    const db = await must("B", api.get(`/api/workspace/invoices/${b.id}`));
    const dr = ret ? await must("R", api.get(`/api/workspace/invoices/${ret.id}`)) : null;
    const dues = await must("dues", api.get("/api/workspace/dues"));
    const mine = dues.items.filter(i => i.person === name).map(i => `${i.source}:${i.label}:${i.amount}`);
    const openSum = Math.round(((da.open || 0) + (db.open || 0) + (debt.remaining || 0)) * 100) / 100;
    out[name] = { mode, bakiye: card.totals.balance, A: `${da.open} ${da.payState}`, B: `${db.open} ${db.payState}`, iade: dr ? `${dr.open} ${dr.payState}` : "-", borcKalan: debt.remaining, acikToplam: openSum, takvim: mine, esit: Math.abs(openSum - card.totals.balance) < 0.005 };
    } finally {
      await server.close();
    }
  }
  await scenario("Stok İadesi + Cari Ödeme", "stok");
  await scenario("Fatura İadesi + Cari Ödeme", "fatura-cari");
  await scenario("Fatura İadesi + Kendi Geri Ödemesi", "fatura-kendi");
}
console.log(JSON.stringify(out, null, 1));
process.exitCode = Object.values(out).some(v => !v.esit) ? 1 : 0;
