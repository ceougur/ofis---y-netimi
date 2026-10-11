// Eleştirmen e2: B4 — Devir Kapanışı / Kart Borcuna Aktar yapılmış eski satır silinince: müşteri ne görür (ANLIK DURUM, Banka özeti) ve
// kendisi nasıl onarır (Geri Al, sihirbazı yeniden çalıştır, aynı satırı yeniden girmek)? Ayrıca: silme serbest ama tutar düzeltme 409 (B1) tutarsızlığı.
import { BANK, bootBank } from "../../../../test/banka-210-hesap-ortak.mjs";
import { integrityOf } from "../../../../test/banka-210-ortak.mjs";
const log = (...a) => console.log(...a);
const r = res => `${res.status} ${res.code || ""} ${String(res.error || "").slice(0, 140)}`;
const subs = async api => JSON.stringify(((await api.get(`${BANK}/sub-trial`)).data.rows || []).map(x => [x.sub, x.balance]));
const ov = async api => {
  const o = (await api.get("/api/workspace/overview")).data;
  return JSON.stringify(o?.bank ?? o?.banking ?? Object.keys(o || {})).slice(0, 300);
};
async function run(label, fn) {
  const ctx = await bootBank();
  try { await fn(ctx); } catch (e) { log(label, "HATA", e.stack); } finally { await ctx.server.close(); }
}
await run("[DEVIR]", async ({ api }) => {
  const cus = (await api.post("/api/workspace/accounts", { name: "Müşteri", type: "customer", registeredOn: "2026-09-01" })).data;
  const h = (await api.post(`/api/workspace/accounts/${cus.id}/entries`, { kind: "in", method: "bank", date: "2026-09-15", amount: "1.000" })).data;
  const A = (await api.post(`${BANK}/accounts`, { bankName: "Ziraat", name: "A", kind: "demand", opening: { date: "2026-10-01", amount: "5.000", confirmed: true } })).data;
  const s1 = await api.post(`${BANK}/setup`, { accountId: A.id, carryClose: true, assign: "all" });
  log("[DEVIR] sihirbaz", r(s1), JSON.stringify(s1.data?.carry));
  log("[DEVIR] devri kapanmış satırın TUTARINI düzelt", r(await api.put(`/api/workspace/accounts/${cus.id}/entries/${h.entryId}`, { kind: "in", method: "bank", date: "2026-09-15", amount: "1.100" })));
  log("[DEVIR] devri kapanmış satırı nakde çevir", r(await api.put(`/api/workspace/accounts/${cus.id}/entries/${h.entryId}`, { kind: "in", method: "cash", date: "2026-09-15", amount: "1.000" })));
  log("[DEVIR] alt mizan (nakde çevirme sonrası)", await subs(api));
  const sum = (await api.get(`${BANK}/summary`)).data;
  log("[DEVIR] Hesabı Atanmamış", sum.unassigned.totalMinor, "Gerçek Banka", sum.realBank.minor);
  log("[DEVIR] ANLIK DURUM banka kısmı", await ov(api));
  const s2 = await api.post(`${BANK}/setup`, { accountId: A.id, carryClose: true, assign: "all" });
  log("[DEVIR] onarım: sihirbazı yeniden çalıştır", r(s2), JSON.stringify(s2.data?.carry || {}));
  log("[DEVIR] alt mizan", await subs(api));
  const undo = await api.post(`${BANK}/setup/${s2.data?.id || s1.data.id}/undo`, {});
  log("[DEVIR] Geri Al (son kurulum)", r(undo));
  log("[DEVIR] mutabakat", (await integrityOf(api)).ok);
});
await run("[KART]", async ({ api }) => {
  const sup = (await api.post("/api/workspace/accounts", { name: "Tedarikçi", type: "supplier", registeredOn: "2026-10-01" })).data;
  const k = (await api.post(`/api/workspace/accounts/${sup.id}/entries`, { kind: "out", method: "card", date: "2026-10-05", amount: "500" })).data;
  const KK = (await api.post(`${BANK}/accounts`, { bankName: "Garanti", name: "KK", kind: "card", creditLimit: "10.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } })).data;
  const rc = await api.post(`${BANK}/legacy/reclass`, { mode: "card", accountId: KK.id, amount: "500", date: "2026-10-08" });
  log("[KART] Kart Borcuna Aktar", r(rc));
  log("[KART] aktarılmış eski satırın TUTARINI düzelt 500→450", r(await api.put(`/api/workspace/accounts/${sup.id}/entries/${k.entryId}`, { kind: "out", method: "card", date: "2026-10-05", amount: "450" })));
  log("[KART] alt mizan", await subs(api));
  const runs = (await api.get(`${BANK}/setup`)).data;
  log("[KART] kurulum geçmişi", JSON.stringify(runs).slice(0, 200));
  log("[KART] ANLIK DURUM banka kısmı", await ov(api));
  log("[KART] mutabakat", (await integrityOf(api)).ok);
});
