// Yargıç sondası 7: K7 Engelle — gelen paranın modül yollarından geri alınması (fatura iptal/sil/düzenle, toplu iptal/sil, stok hareketi sil,
// taksit tahsilatı sil, taksit kartı sil).
import { BANK, bootBank, TODAY } from "../../../../test/banka-210-hesap-ortak.mjs";
const log = (...a) => console.log(...a);
const ctx = await bootBank();
const { api } = ctx;
const INV = "/api/workspace/invoices";
try {
  const A = (await api.post(`${BANK}/accounts`, { bankName: "Ziraat", name: "A", kind: "demand", negativePolicy: "block", opening: { date: "2026-10-01", amount: "0", confirmed: true } })).data;
  const cus = (await api.post("/api/workspace/accounts", { name: "Müşteri", type: "customer", registeredOn: "2026-10-01" })).data;
  const sup = (await api.post("/api/workspace/accounts", { name: "Tedarikçi", type: "supplier", registeredOn: "2026-10-01" })).data;
  const bal = async () => (await api.get(`${BANK}/accounts/${A.id}`)).data.balanceMinor;
  const sale = await api.post(INV, { kind: "sale", accountId: cus.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: 1000, discountRate: 0, vatRate: 20 }], payment: { cash: [{ amount: "1.000", method: "bank", bankAccountId: A.id, lineKey: "p" }], cheques: [], endorse: [], rest: "open" }, force: true });
  log("satış faturası peşin havale 1.000", sale.status, sale.code || "");
  const item = (await api.post("/api/workspace/stock", { name: "Ürün", unit: "Adet", openingQty: "10", unitPrice: "100" })).data;
  const mv = await api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "1", unitPrice: "200", pay: "cash", method: "bank", bankAccountId: A.id, date: TODAY });
  log("stok peşin satış havale 200", mv.status, mv.code || "");
  const plan = (await api.post("/api/workspace/plans", { accountId: cus.id, name: cus.name, total: "900", mode: "auto", count: 3, firstDue: "2026-10-15" })).data;
  const pe = await api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "300", method: "bank", bankAccountId: A.id, date: TODAY });
  log("taksit tahsilatı havale 300", pe.status, pe.code || "");
  log("A =", await bal());
  const out = await api.post(`/api/workspace/accounts/${sup.id}/entries`, { kind: "out", method: "bank", bankAccountId: A.id, date: TODAY, amount: "1.500" });
  log("A'dan 1.500 ödeme", out.status, "A =", await bal());
  const r = [];
  r.push(["fatura iptal", await api.post(`${INV}/${sale.data.id}/cancel`, {})]);
  r.push(["fatura sil", await api.del(`${INV}/${sale.data.id}`)]);
  r.push(["fatura toplu iptal", await api.post(`${INV}/bulk-cancel`, { ids: [sale.data.id] })]);
  r.push(["fatura toplu sil", await api.post(`${INV}/bulk-delete`, { ids: [sale.data.id] })]);
  r.push(["fatura düzenle peşinsiz", await api.post(`${INV}/${sale.data.id}/edit`, { kind: "sale", accountId: cus.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: 1000, discountRate: 0, vatRate: 20 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true })]);
  r.push(["stok hareketi sil", await api.del(`/api/workspace/stock/${item.id}/moves/${mv.data.moveId}`)]);
  r.push(["taksit tahsilatı sil", await api.del(`/api/workspace/plans/${plan.id}/entries/${pe.data.entryId}`)]);
  r.push(["taksit kartı sil", await api.del(`/api/workspace/plans/${plan.id}`)]);
  for (const [label, res] of r) log(label, res.status, res.code || "", JSON.stringify(res.data?.results || res.data?.failed || "").slice(0, 200));
  log("A son =", await bal());
} finally {
  await ctx.server.close();
}
