// Yargıç sondası 8: hesap açılışından ÖNCE girilmiş (eski sürüm gibi hesapsız) havale / kartla ödeme satırının tutarı düzeltilebiliyor mu?
import { BANK, bootBank } from "../../../../test/banka-210-hesap-ortak.mjs";
import { integrityOf } from "../../../../test/banka-210-ortak.mjs";
const log = (...a) => console.log(...a);
const ctx = await bootBank();
const { api, store } = ctx;
try {
  const cus = (await api.post("/api/workspace/accounts", { name: "Müşteri", type: "customer", registeredOn: "2026-09-01" })).data;
  const sup = (await api.post("/api/workspace/accounts", { name: "Tedarikçi", type: "supplier", registeredOn: "2026-09-01" })).data;
  // Hesap yokken (2.0.26'daki gibi) 15.09 tarihli hesapsız havale tahsilatı ve kartla ödeme.
  const h = (await api.post(`/api/workspace/accounts/${cus.id}/entries`, { kind: "in", method: "bank", date: "2026-09-15", amount: "1.000" })).data;
  const k = (await api.post(`/api/workspace/accounts/${sup.id}/entries`, { kind: "out", method: "card", date: "2026-09-15", amount: "400" })).data;
  // Sonra banka hesabı ve kurumsal kart 01.10 açılışla tanımlanır (sihirbaz çalıştırılmadı ya da Devir Kapanışı yapılmadı).
  await api.post(`${BANK}/accounts`, { bankName: "Ziraat", name: "A", kind: "demand", opening: { date: "2026-10-01", amount: "5.000", confirmed: true } });
  await api.post(`${BANK}/accounts`, { bankName: "Garanti", name: "KK", kind: "card", creditLimit: "10.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
  const note = await api.put(`/api/workspace/accounts/${cus.id}/entries/${h.entryId}`, { kind: "in", method: "bank", date: "2026-09-15", amount: "1.000", note: "açıklama" });
  log("eski havale: yalnız açıklama", note.status, note.code || "");
  const amt = await api.put(`/api/workspace/accounts/${cus.id}/entries/${h.entryId}`, { kind: "in", method: "bank", date: "2026-09-15", amount: "1.100" });
  log("eski havale: tutar 1.000→1.100", amt.status, amt.code || "", (amt.error || "").slice(0, 220));
  const amtNo = await api.put(`/api/workspace/accounts/${cus.id}/entries/${h.entryId}`, { kind: "in", method: "bank", date: "2026-09-15", amount: "1.100", bankAccountId: "" });
  log("eski havale: tutar + boş hesap", amtNo.status, amtNo.code || "");
  const kAmt = await api.put(`/api/workspace/accounts/${sup.id}/entries/${k.entryId}`, { kind: "out", method: "card", date: "2026-09-15", amount: "450" });
  log("eski kartla ödeme: tutar 400→450", kAmt.status, kAmt.code || "", (kAmt.error || "").slice(0, 220));
  const del = await api.del(`/api/workspace/accounts/${cus.id}/entries/${h.entryId}`);
  log("eski havale: sil", del.status, del.code || "");
  log("satırlar", JSON.stringify(store.all("SELECT amount, method, fin_ref FROM account_entries WHERE kind IN ('in','out')")));
  log("mutabakat", (await integrityOf(api)).ok);
} finally {
  await ctx.server.close();
}
