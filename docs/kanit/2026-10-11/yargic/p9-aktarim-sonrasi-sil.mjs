// Yargıç sondası 9: Kart Borcuna Aktar / Devir Kapanışı yapılmış eski hesapsız satır sonradan silinir ya da tutarı değişirse ne olur?
import { BANK, bootBank } from "../../../../test/banka-210-hesap-ortak.mjs";
import { integrityOf } from "../../../../test/banka-210-ortak.mjs";
const log = (...a) => console.log(...a);
async function run(label, fn) {
  const ctx = await bootBank();
  try {
    await fn(ctx);
  } catch (error) {
    log(label, "HATA", error.message);
  } finally {
    await ctx.server.close();
  }
}
const subs = async api => JSON.stringify(((await api.get(`${BANK}/sub-trial`)).data.rows || []).map(r => [r.sub, r.balance]));
await run("[KART-AKTAR]", async ({ api }) => {
  const sup = (await api.post("/api/workspace/accounts", { name: "Tedarikçi", type: "supplier", registeredOn: "2026-10-01" })).data;
  // Kurumsal kart yokken kartla ödeme (eski sürümdeki gibi 108.00).
  const k = (await api.post(`/api/workspace/accounts/${sup.id}/entries`, { kind: "out", method: "card", date: "2026-10-05", amount: "500" })).data;
  const KK = (await api.post(`${BANK}/accounts`, { bankName: "Garanti", name: "KK", kind: "card", creditLimit: "10.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } })).data;
  const rc = await api.post(`${BANK}/legacy/reclass`, { mode: "card", accountId: KK.id, amount: "500", date: "2026-10-08" });
  log("[KART-AKTAR] Kart Borcuna Aktar 500", rc.status, rc.code || "", (rc.error || "").slice(0, 150));
  log("[KART-AKTAR] alt mizan", await subs(api));
  const del = await api.del(`/api/workspace/accounts/${sup.id}/entries/${k.entryId}`);
  log("[KART-AKTAR] aktarılmış eski kart ödemesini sil", del.status, del.code || "", (del.error || "").slice(0, 150));
  log("[KART-AKTAR] alt mizan", await subs(api));
  const sum = (await api.get(`${BANK}/summary`)).data;
  log("[KART-AKTAR] Kart borcu", sum.debt.cardMinor, "Hesabı Atanmamış", sum.unassigned.totalMinor, JSON.stringify(sum.unassigned).slice(0, 200));
  const sup2 = (await api.get(`/api/workspace/accounts/${sup.id}`)).data;
  log("[KART-AKTAR] tedarikçi bakiyesi", sup2.totals?.balance);
  const integ = await integrityOf(api);
  log("[KART-AKTAR] mutabakat", integ.ok, JSON.stringify(integ.failures || []).slice(0, 300));
});
await run("[DEVIR]", async ({ api }) => {
  const cus = (await api.post("/api/workspace/accounts", { name: "Müşteri", type: "customer", registeredOn: "2026-09-01" })).data;
  const h = (await api.post(`/api/workspace/accounts/${cus.id}/entries`, { kind: "in", method: "bank", date: "2026-09-15", amount: "1.000" })).data;
  const A = (await api.post(`${BANK}/accounts`, { bankName: "Ziraat", name: "A", kind: "demand", opening: { date: "2026-10-01", amount: "5.000", confirmed: true } })).data;
  const run1 = await api.post(`${BANK}/setup`, { accountId: A.id, carryClose: true, assign: "all" });
  log("[DEVIR] sihirbaz (Devir Kapanışı 1.000)", run1.status, run1.code || "", JSON.stringify(run1.data?.carry));
  log("[DEVIR] alt mizan", await subs(api));
  const del = await api.del(`/api/workspace/accounts/${cus.id}/entries/${h.entryId}`);
  log("[DEVIR] devri kapanmış eski havaleyi sil", del.status, del.code || "", (del.error || "").slice(0, 200));
  log("[DEVIR] alt mizan", await subs(api));
  const sum = (await api.get(`${BANK}/summary`)).data;
  log("[DEVIR] Gerçek Banka", sum.realBank.minor, "Hesabı Atanmamış", sum.unassigned.totalMinor);
  const integ = await integrityOf(api);
  log("[DEVIR] mutabakat", integ.ok, JSON.stringify(integ.failures || []).slice(0, 300));
});
