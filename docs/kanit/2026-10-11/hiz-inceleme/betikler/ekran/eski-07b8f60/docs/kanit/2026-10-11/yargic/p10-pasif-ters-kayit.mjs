// Yargıç sondası 10: pasif hesabın bakiyesini banka fişinin Ters Kaydet / Düzelt'i, Planlı İşlem ve Açılışı Düzelt değiştirebiliyor mu?
// Karşılaştırma: modül satırında (cari) aynı işlem 400 bank-account-passive (Yargıç Y1, module-ref.mjs bankPassiveError).
import { BANK, bootBank, TODAY } from "../../../../test/banka-210-hesap-ortak.mjs";
const log = (...a) => console.log(...a);
const ctx = await bootBank();
const { api } = ctx;
try {
  const open = (name, amount) => api.post(`${BANK}/accounts`, { bankName: "Ziraat", name, kind: "demand", opening: { date: "2026-10-01", amount, confirmed: true } }).then(r => r.data);
  const A = await open("A", "5.000");
  const B = await open("B", "5.000");
  const bal = async acc => (await api.get(`${BANK}/accounts/${acc.id}`)).data.balanceMinor;
  const cus = (await api.post("/api/workspace/accounts", { name: "Müşteri", type: "customer", registeredOn: "2026-10-01" })).data;
  const entry = (await api.post(`/api/workspace/accounts/${cus.id}/entries`, { kind: "in", method: "bank", bankAccountId: B.id, date: TODAY, amount: "100" })).data;
  const fee = (await api.post(`${BANK}/vouchers`, { type: "fee", accountId: B.id, amount: "50", tax: "bsmv_incl", date: TODAY })).data;
  const tr = (await api.post(`${BANK}/transfers`, { type: "transfer", accountId: A.id, toAccountId: B.id, amount: "1.000", date: TODAY })).data;
  log("B (pasif öncesi)", await bal(B));
  log("B pasife al", (await api.post(`${BANK}/accounts/${B.id}/status`, { status: "passive" })).status);
  const del = await api.del(`/api/workspace/accounts/${cus.id}/entries/${entry.entryId}`);
  log("KARŞILAŞTIRMA cari havale sil (pasif B)", del.status, del.code || "");
  const r1 = await api.post(`${BANK}/events/${fee.id}/reverse`, {});
  log("masraf fişini Ters Kaydet (pasif B)", r1.status, r1.code || "", "B =", await bal(B));
  const r2 = await api.post(`${BANK}/events/${tr.id}/reverse`, {});
  log("A→B transferini Ters Kaydet (pasif B alıcı)", r2.status, r2.code || "", "B =", await bal(B));
  const op = await api.post(`${BANK}/accounts/${B.id}/opening`, { date: "2026-10-01", amount: "7.000", confirmed: true });
  log("pasif B Açılışı Düzelt 5.000→7.000", op.status, op.code || "", "B =", await bal(B));
} finally {
  await ctx.server.close();
}
