// Yargıç sondası 1: kurumsal kart bağı uç durumları.
import { bootBank, BANK, TODAY, subBalances } from "../../../../test/banka-210-hesap-ortak.mjs";
import { integrityOf } from "../../../../test/banka-210-ortak.mjs";
const log = (...a) => console.log(...a);
const ctx = await bootBank();
const { api, store } = ctx;
try {
  const sup = (await api.post("/api/workspace/accounts", { name: "Tedarikci A", type: "supplier", registeredOn: "2026-10-01" })).data;
  const b1 = (await api.post(`${BANK}/accounts`, { bankName: "Akbank", name: "Vadesiz", kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount: "10.000", confirmed: true } })).data;
  const kk = (await api.post(`${BANK}/accounts`, { bankName: "Garanti", name: "KK", kind: "card", creditLimit: "5.000", opening: { date: "2026-10-01", amount: "0", confirmed: false } })).data;
  const p = await api.post(`/api/workspace/accounts/${sup.id}/entries`, { kind: "out", method: "card", date: TODAY, amount: "100" });
  log("kart ödeme", p.status, p.code, p.error);
  const entryId = p.data?.entryId;
  const cp = await api.post(`${BANK}/vouchers`, { type: "card_payment", accountId: b1.id, cardAccountId: kk.id, amount: "300", date: TODAY });
  log("kart borcu 300 (borç 100)", cp.status, cp.code, cp.error);
  log("KK bakiye", (await api.get(`${BANK}/accounts/${kk.id}`)).data?.balanceMinor);
  const ev = store.get("SELECT event_id FROM account_entries WHERE id = ?", entryId)?.event_id;
  const rv = await api.post(`${BANK}/events/${ev}/reverse`, {});
  log("modül olayına Ters Kaydet", rv.status, rv.code, (rv.error || "").slice(0, 150));
  const cr = await api.post(`${BANK}/events/${ev}/correct`, { amount: "50" });
  log("modül olayına Düzelt", cr.status, cr.code, (cr.error || "").slice(0, 150));
  const del = await api.del(`${BANK}/accounts/${kk.id}`);
  log("hareketli kart hesabı sil", del.status, del.code, (del.error || "").slice(0, 150));
  const up = await api.put(`/api/workspace/accounts/${sup.id}/entries/${entryId}`, { kind: "out", method: "bank", date: TODAY, amount: "100" });
  log("kart→havale", up.status, up.code, up.error, JSON.stringify(store.get("SELECT method, fin_ref FROM account_entries WHERE id = ?", entryId)));
  log("KK bakiye", (await api.get(`${BANK}/accounts/${kk.id}`)).data?.balanceMinor, "B1", (await api.get(`${BANK}/accounts/${b1.id}`)).data?.balanceMinor);
  const integ = await integrityOf(api);
  log("mutabakat", integ.ok, JSON.stringify(integ.failures || []).slice(0, 400));
  log("alt mizan", JSON.stringify(await subBalances(api)));
} finally {
  await ctx.server.close();
}
