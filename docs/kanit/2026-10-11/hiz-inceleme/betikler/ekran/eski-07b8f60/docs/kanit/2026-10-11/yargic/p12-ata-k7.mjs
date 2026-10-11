// Yargıç sondası 12: "Bu Hesaba Ata" ve Kurulum Sihirbazı hesapsız eski ÖDEME satırını Engelle'deki hesaba bağlarken K7'ye bakıyor mu?
import { BANK, bootBank } from "../../../../test/banka-210-hesap-ortak.mjs";
const log = (...a) => console.log(...a);
for (const how of ["ata", "sihirbaz"]) {
  const ctx = await bootBank();
  const { api } = ctx;
  try {
    const sup = (await api.post("/api/workspace/accounts", { name: "Tedarikçi", type: "supplier", registeredOn: "2026-10-01" })).data;
    const p = (await api.post(`/api/workspace/accounts/${sup.id}/entries`, { kind: "out", method: "bank", date: "2026-10-05", amount: "2.000" })).data;
    const A = (await api.post(`${BANK}/accounts`, { bankName: "Ziraat", name: "A", kind: "demand", negativePolicy: "block", opening: { date: "2026-10-01", amount: "500", confirmed: true } })).data;
    const res = how === "ata" ? await api.post(`${BANK}/legacy/assign`, { accountId: A.id, rows: [{ table: "account_entries", id: p.entryId }] }) : await api.post(`${BANK}/setup`, { accountId: A.id, carryClose: true, assign: "all" });
    log(how, res.status, res.code || "", "A =", (await api.get(`${BANK}/accounts/${A.id}`)).data.balanceMinor, "politika block, açılış 500");
  } finally {
    await ctx.server.close();
  }
}
