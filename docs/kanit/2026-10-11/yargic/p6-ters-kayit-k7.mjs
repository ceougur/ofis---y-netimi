// Yargıç sondası 6: K7 (Engelle) — gelen paranın Ters Kaydet / Düzelt'i, cari tahsilatın silinmesi/düzeltilmesi, Kasa'ya aktarımın silinmesi.
import { BANK, bootBank, TODAY } from "../../../../test/banka-210-hesap-ortak.mjs";
const log = (...a) => console.log(...a);
const ctx = await bootBank();
const { api, store } = ctx;
try {
  const open = (name, amount) => api.post(`${BANK}/accounts`, { bankName: "Ziraat", name, kind: "demand", negativePolicy: "block", opening: { date: "2026-10-01", amount, confirmed: true } }).then(r => r.data);
  const A = await open("A", "0");
  const B = await open("B", "5.000");
  const sup = (await api.post("/api/workspace/accounts", { name: "Tedarikçi", type: "supplier", registeredOn: "2026-10-01" })).data;
  const cus = (await api.post("/api/workspace/accounts", { name: "Müşteri", type: "customer", registeredOn: "2026-10-01" })).data;
  const tr = await api.post(`${BANK}/transfers`, { type: "transfer", accountId: B.id, toAccountId: A.id, amount: "1.000", date: TODAY });
  log("B→A 1.000", tr.status);
  const inc = await api.post(`/api/workspace/accounts/${cus.id}/entries`, { kind: "in", method: "bank", bankAccountId: A.id, date: TODAY, amount: "500" });
  log("müşteriden A'ya 500", inc.status);
  const pay = await api.post(`/api/workspace/accounts/${sup.id}/entries`, { kind: "out", method: "bank", bankAccountId: A.id, date: TODAY, amount: "1.500" });
  log("A'dan 1.500 ödeme", pay.status, pay.code || "", "A =", (await api.get(`${BANK}/accounts/${A.id}`)).data.balanceMinor);
  const rv = await api.post(`${BANK}/events/${tr.data.id}/reverse`, {});
  log("transfer Ters Kaydet (A 0 → −1.000 olurdu)", rv.status, rv.code || "");
  const cr = await api.post(`${BANK}/events/${tr.data.id}/correct`, { amount: "100" });
  log("transfer Düzelt 1.000→100", cr.status, cr.code || "");
  const del = await api.del(`/api/workspace/accounts/${cus.id}/entries/${inc.data.entryId}`);
  log("müşteri tahsilatını sil (A −500 olurdu)", del.status, del.code || "");
  const up = await api.put(`/api/workspace/accounts/${cus.id}/entries/${inc.data.entryId}`, { kind: "in", method: "bank", date: TODAY, amount: "100" });
  log("müşteri tahsilatını 100'e düzelt", up.status, up.code || "");
  const mv = await api.put(`/api/workspace/accounts/${cus.id}/entries/${inc.data.entryId}`, { kind: "in", method: "bank", bankAccountId: B.id, date: TODAY, amount: "500" });
  log("müşteri tahsilatını B'ye taşı", mv.status, mv.code || "");
  const cash = await api.put(`/api/workspace/accounts/${cus.id}/entries/${inc.data.entryId}`, { kind: "in", method: "cash", date: TODAY, amount: "500" });
  log("müşteri tahsilatını nakde çevir", cash.status, cash.code || "");
  log("A son bakiye", (await api.get(`${BANK}/accounts/${A.id}`)).data.balanceMinor);
  // Kasa ↔ Banka: kasadan A'ya 300 yatır, A'dan 300 öde, yatırmayı sil.
  await api.post(`/api/workspace/accounts/${cus.id}/entries`, { kind: "in", method: "cash", date: TODAY, amount: "300" });
  const dep = await api.post("/api/workspace/cash/transfer", { direction: "to-bank", bankAccountId: A.id, amount: "300", date: TODAY });
  log("Kasadan A'ya 300", dep.status, dep.code || "");
  const pay2 = await api.post(`/api/workspace/accounts/${sup.id}/entries`, { kind: "out", method: "bank", bankAccountId: A.id, date: TODAY, amount: "300", similarOk: true });
  log("A'dan 300 ödeme", pay2.status, pay2.code || "", "A =", (await api.get(`${BANK}/accounts/${A.id}`)).data.balanceMinor);
  const cashRow = store.get("SELECT id FROM cash_entries WHERE fin_ref = '' AND transfer_id <> '' ORDER BY created_at DESC LIMIT 1");
  const delDep = await api.del(`/api/workspace/cash/${cashRow.id}`);
  log("Kasadan bankaya yatırmayı sil (A −300 olurdu)", delDep.status, delDep.code || "");
  const upDep = await api.put(`/api/workspace/cash/${cashRow.id}`, { amount: "100" });
  log("Kasadan bankaya yatırmayı 100'e düzelt", upDep.status, upDep.code || "", (upDep.error || "").slice(0, 120));
  log("A son bakiye", (await api.get(`${BANK}/accounts/${A.id}`)).data.balanceMinor);
} finally {
  await ctx.server.close();
}
