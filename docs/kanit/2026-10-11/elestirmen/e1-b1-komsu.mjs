// Eleştirmen e1: B1'in komşu yolları — banka hesabı açılmadan önce (eski sürüm gibi) girilmiş hesapsız havale satırları; sonra tek hesap 01.10 açılışla.
// Her modülde: düzelt (tutar), sil, iptal/geri al. Yargıç yalnız cari satırını denedi.
import { BANK, bootBank } from "../../../../test/banka-210-hesap-ortak.mjs";
import { integrityOf } from "../../../../test/banka-210-ortak.mjs";
const log = (...a) => console.log(...a);
const r = res => `${res.status} ${res.code || ""} ${String(res.error || "").slice(0, 110)}`;
const D = "2026-09-15";
const INV = "/api/workspace/invoices";
const ctx = await bootBank();
const { api, store } = ctx;
try {
  const cus = (await api.post("/api/workspace/accounts", { name: "Müşteri", type: "customer", registeredOn: "2026-09-01" })).data;
  const sup = (await api.post("/api/workspace/accounts", { name: "Tedarikçi", type: "supplier", registeredOn: "2026-09-01" })).data;
  const inv = (body) => ({ kind: "sale", accountId: cus.id, issueDate: D, pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: 3000, discountRate: 0, vatRate: 0 }], payment: { cash: [{ amount: "3.000", method: "bank" }], cheques: [], endorse: [], rest: "open" }, force: true, ...body });
  // Hesap yokken (2.0.26 gibi) girilen hesapsız eski havale satırları:
  const cariIn = (await api.post(`/api/workspace/accounts/${cus.id}/entries`, { kind: "in", method: "bank", date: D, amount: "1.000" })).data;
  const sale = (await api.post(INV, inv({}))).data;
  const sale2 = (await api.post(INV, inv({}))).data;
  const sale3 = (await api.post(INV, inv({}))).data;
  const plan = (await api.post("/api/workspace/plans", { accountId: cus.id, name: "Müşteri", total: "6.000", mode: "auto", count: 3, firstDue: "2026-09-10", registeredOn: "2026-09-01" })).data;
  const planIn = (await api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "500", method: "bank", date: D }));
  const item = (await api.post("/api/workspace/stock", { name: "Ürün", unit: "Adet", openingQty: "10", unitPrice: "100" })).data;
  const sold = (await api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "1", unitPrice: "150", pay: "cash", method: "bank", date: D }));
  const trf = (await api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "200", date: D, cashForce: true }));
  const cheque = (await api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "700", issueDate: "2026-09-01", dueDate: D, drawer: "K", serialNo: "C1" })).data;
  const coll = await api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "collect", date: D, method: "bank" });
  log("hazırlık:", "plan tahsilat", planIn.status, "stok satış", sold.status, sold.code || "", "transfer", trf.status, trf.code || "", "çek tahsil", coll.status, coll.code || "");
  log("hesapsız havale satırı (account_entries+cash_entries+stock)", store.get("SELECT COUNT(*) n FROM account_entries WHERE method='bank' AND fin_ref=''").n, store.get("SELECT COUNT(*) n FROM cash_entries WHERE method='bank' AND fin_ref=''").n, store.get("SELECT COUNT(*) n FROM stock_moves WHERE method='bank' AND fin_ref=''").n);
  // Tek banka hesabı 01.10 açılış (sihirbaz çalıştırılmadı).
  const A = (await api.post(`${BANK}/accounts`, { bankName: "Ziraat", name: "A", kind: "demand", opening: { date: "2026-10-01", amount: "5.000", confirmed: true } })).data;
  log("hesap", A?.id ? "açıldı" : "AÇILAMADI");
  log("--- cari");
  log("cari havale tutar 1000→1100", r(await api.put(`/api/workspace/accounts/${cus.id}/entries/${cariIn.entryId}`, { kind: "in", method: "bank", date: D, amount: "1.100" })));
  log("cari havale tarih 15.09→16.09", r(await api.put(`/api/workspace/accounts/${cus.id}/entries/${cariIn.entryId}`, { kind: "in", method: "bank", date: "2026-09-16", amount: "1.000" })));
  log("cari havale yol → nakit", r(await api.put(`/api/workspace/accounts/${cus.id}/entries/${cariIn.entryId}`, { kind: "in", method: "cash", date: D, amount: "1.000" })));
  log("yeni eski tarihli havale 15.09", r(await api.post(`/api/workspace/accounts/${cus.id}/entries`, { kind: "in", method: "bank", date: D, amount: "50" })));
  log("--- fatura (15.09 peşin havale 3.000)");
  const num = id => store.get("SELECT number FROM invoices WHERE id = ?", id).number;
  log("Düzenle yalnız not", r(await api.post(`${INV}/${sale.id}/edit`, inv({ number: num(sale.id), note: "not" }))));
  log("Düzenle kalem fiyatı (peşin aynı)", r(await api.post(`${INV}/${sale.id}/edit`, inv({ number: num(sale.id), lines: [{ name: "Hizmet", qty: 1, unitPrice: 3500, discountRate: 0, vatRate: 0 }] }))));
  log("İptal", r(await api.post(`${INV}/${sale2.id}/cancel`, { reason: "hata" })));
  log("Sil", r(await api.del(`${INV}/${sale3.id}`)));
  log("--- taksit tahsilatı (15.09 havale 500)");
  const pe = planIn.data?.entryId;
  log("tutar 500→600", r(await api.put(`/api/workspace/plans/${plan.id}/entries/${pe}`, { amount: "600", method: "bank", date: D })));
  log("sil", r(await api.del(`/api/workspace/plans/${plan.id}/entries/${pe}`)));
  log("--- stok peşin havale satış 15.09");
  const mv = sold.data?.moveId;
  log("tutar 150→160", r(await api.put(`/api/workspace/stock/${item.id}/moves/${mv}`, { kind: "out", qty: "1", unitPrice: "160", pay: "cash", method: "bank", date: D })));
  log("sil", r(await api.del(`/api/workspace/stock/${item.id}/moves/${mv}`)));
  log("--- Kasa→Banka transfer 15.09");
  log("tutar 200→250", r(await api.put(`/api/workspace/cash/${trf.data?.id}`, { kind: "out", amount: "250", date: D, description: "Kasadan Bankaya", cashForce: true })));
  log("sil", r(await api.del(`/api/workspace/cash/${trf.data?.id}`)));
  log("--- çek tahsili (15.09 havale) geri al", r(await api.post(`/api/workspace/cheques/${cheque.id}/undo`, {})));
  const integ = await integrityOf(api);
  log("mutabakat", integ.ok);
  const sum = (await api.get(`${BANK}/summary`)).data;
  log("Gerçek Banka", sum.realBank?.minor, "Hesabı Atanmamış", sum.unassigned?.totalMinor);
} finally {
  await ctx.server.close();
}
