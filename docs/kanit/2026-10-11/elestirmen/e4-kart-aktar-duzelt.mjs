// Eleştirmen e4 (YENİ): Kart Borcuna Aktar yapılmış eski hesapsız kartla ödemenin TUTARI düzeltilince satır kendiliğinden kurumsal karta
// bağlanır, ama aktarım fişi (B 108.00 / A 309) yerinde kalır → kart borcu iki kez. Ayrıca Bankaya Geçmiş Say komşusu (POS tahsilatı düzeltmesi).
import { BANK, bootBank } from "../../../../test/banka-210-hesap-ortak.mjs";
import { integrityOf } from "../../../../test/banka-210-ortak.mjs";
const log = (...a) => console.log(...a);
const r = res => `${res.status} ${res.code || ""} ${String(res.error || "").slice(0, 140)}`;
const subs = async api => JSON.stringify(((await api.get(`${BANK}/sub-trial`)).data.rows || []).map(x => [x.sub, x.balance]));
const sum = async api => { const s = (await api.get(`${BANK}/summary`)).data; return `Kart ve Kredi Borcu ${s.debt?.cardMinor / 100} · Hesabı Atanmamış ${s.unassigned?.totalMinor / 100} (kart ${s.unassigned?.cardMinor / 100})`; };
async function run(label, fn) {
  const ctx = await bootBank();
  try { await fn(ctx); } catch (e) { log(label, "HATA", e.stack); } finally { await ctx.server.close(); }
}
await run("[KART]", async ({ api, store }) => {
  const sup = (await api.post("/api/workspace/accounts", { name: "Tedarikçi", type: "supplier", registeredOn: "2026-10-01" })).data;
  // Kurumsal kart tanımlanmadan (2.0.26'daki gibi) 05.10 kartla ödeme 500 → 108.00 "Hesabı Atanmamış".
  const k = (await api.post(`/api/workspace/accounts/${sup.id}/entries`, { kind: "out", method: "card", date: "2026-10-05", amount: "500" })).data;
  const KK = (await api.post(`${BANK}/accounts`, { bankName: "Garanti", name: "KK", kind: "card", creditLimit: "1.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } })).data;
  await api.put(`${BANK}/accounts/${KK.id}`, { negativePolicy: "block" });
  log("[KART] Kart Borcuna Aktar 500", r(await api.post(`${BANK}/legacy/reclass`, { mode: "card", accountId: KK.id, amount: "500", date: "2026-10-08" })));
  log("[KART] önce:", await subs(api), await sum(api));
  // Kullanıcı yazım hatasını düzeltir: 500 değil 450.
  log("[KART] eski kartla ödemenin tutarı 500→450", r(await api.put(`/api/workspace/accounts/${sup.id}/entries/${k.entryId}`, { kind: "out", method: "card", date: "2026-10-05", amount: "450" })));
  log("[KART] sonra:", await subs(api), await sum(api));
  log("[KART] satır bağı", JSON.stringify(store.all("SELECT amount, method, fin_ref FROM account_entries WHERE id = ?", k.entryId)));
  // Gerçek kart borcu 450; limit 1.000 → 550 harcanabilir olmalı.
  log("[KART] kartla yeni ödeme 520 (gerçek borç 450 + 520 = 970 ≤ limit 1.000)", r(await api.post(`/api/workspace/accounts/${sup.id}/entries`, { kind: "out", method: "card", date: "2026-10-08", amount: "520" })));
  log("[KART] mutabakat", (await integrityOf(api)).ok);
});
await run("[POS]", async ({ api }) => {
  const cus = (await api.post("/api/workspace/accounts", { name: "Müşteri", type: "customer", registeredOn: "2026-10-01" })).data;
  const p = (await api.post(`/api/workspace/accounts/${cus.id}/entries`, { kind: "in", method: "card", date: "2026-10-05", amount: "800" })).data;
  const A = (await api.post(`${BANK}/accounts`, { bankName: "Ziraat", name: "A", kind: "demand", opening: { date: "2026-10-01", amount: "0", confirmed: true } })).data;
  log("[POS] Bankaya Geçmiş Say 800", r(await api.post(`${BANK}/legacy/reclass`, { mode: "bank", accountId: A.id, amount: "800", date: "2026-10-08" })));
  log("[POS] önce:", await subs(api), await sum(api));
  log("[POS] eski POS tahsilatı 800→750", r(await api.put(`/api/workspace/accounts/${cus.id}/entries/${p.entryId}`, { kind: "in", method: "card", date: "2026-10-05", amount: "750" })));
  log("[POS] sonra:", await subs(api), await sum(api));
  log("[POS] mutabakat", (await integrityOf(api)).ok);
});
