// Yargıç sondası 3: Kurulum Sihirbazı Geri Al — K7 (Engelle) ve pasif hesap kuralı delinir mi?
import { bootBank, BANK, TODAY } from "../../../../test/banka-210-hesap-ortak.mjs";
import { integrityOf } from "../../../../test/banka-210-ortak.mjs";
const log = (...a) => console.log(...a);
async function scenario(label, { passive = false, withdraw = true } = {}) {
  const ctx = await bootBank();
  const { api } = ctx;
  try {
    const c = (await api.post("/api/workspace/accounts", { name: "Müşteri M", type: "customer", registeredOn: "2026-10-01" })).data;
    // Banka hesabı yokken (eski sürüm gibi) havale tahsilatı: hesapsız.
    const t = await api.post(`/api/workspace/accounts/${c.id}/entries`, { kind: "in", method: "bank", date: "2026-10-05", amount: "1.000" });
    log(label, "hesapsız havale tahsilatı", t.status);
    const a = (await api.post(`${BANK}/accounts`, { bankName: "Ziraat", name: "Vadesiz", kind: "demand", currency: "TRY", negativePolicy: "block", opening: { date: "2026-10-01", amount: "0", confirmed: true } })).data;
    const run = await api.post(`${BANK}/setup`, { accountId: a.id, carryClose: true, assign: "all" });
    log(label, "sihirbaz", run.status, run.code || "", "bağlanan", run.data?.assigned);
    log(label, "hesap bakiyesi (kuruş)", (await api.get(`${BANK}/accounts/${a.id}`)).data?.balanceMinor);
    if (withdraw) {
      const sup = (await api.post("/api/workspace/accounts", { name: "Tedarikçi T", type: "supplier", registeredOn: "2026-10-01" })).data;
      const p = await api.post(`/api/workspace/accounts/${sup.id}/entries`, { kind: "out", method: "bank", bankAccountId: a.id, date: TODAY, amount: "1.000" });
      log(label, "1.000 havale ödeme", p.status, p.code || "");
      const p2 = await api.post(`/api/workspace/accounts/${sup.id}/entries`, { kind: "out", method: "bank", bankAccountId: a.id, date: TODAY, amount: "0,01", similarOk: true });
      log(label, "kontrol: 0,01 daha (Engelle beklenir)", p2.status, p2.code || "");
    }
    if (passive) {
      const s = await api.post(`${BANK}/accounts/${a.id}/status`, { status: "passive" });
      log(label, "pasife al", s.status, s.code || "", (s.error || "").slice(0, 120));
    }
    const undo = await api.post(`${BANK}/setup/${run.data.id}/undo`, {});
    log(label, "Geri Al", undo.status, undo.code || "", (undo.error || "").slice(0, 200));
    const acc = (await api.get(`${BANK}/accounts/${a.id}`)).data;
    log(label, "Geri Al sonrası hesap bakiyesi (kuruş)", acc?.balanceMinor, "durum", acc?.status, "politika", acc?.negativePolicy);
    const integ = await integrityOf(api);
    log(label, "mutabakat", integ.ok);
  } finally {
    await ctx.server.close();
  }
}
await scenario("[K7]", { withdraw: true });
await scenario("[PASIF]", { withdraw: false, passive: true });
