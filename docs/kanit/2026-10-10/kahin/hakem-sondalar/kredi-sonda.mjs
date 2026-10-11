// Hakem sondası: Kredi Geri Ödemesi anapara aşımı ve komşuları (yalnız okuma/deneme; kod değiştirmez).
import { BANK, bootBank, openAccount, subBalances, trialBalances } from "/home/user/ofis---y-netimi/test/banka-210-hesap-ortak.mjs";
const v = (api, body) => api.post(`${BANK}/transfers`, body);
const show = (label, r) => console.log(label, r.status, r.code || "", (r.error || "").slice(0, 220));
const cnt = st => ({ events: st.get("SELECT COUNT(*) n FROM fin_events").n, lines: st.get("SELECT COUNT(*) n FROM bank_lines").n });
async function sub(api, acc) { const s = await subBalances(api); return s[acc.glSub]?.balance ?? 0; }
async function trial(api) { const t = await trialBalances(api); return { "102": t["102"] ?? 0, "300": t["300"] ?? 0, "780": t["780"] ?? 0, "500": t["500"] ?? 0 }; }
async function run(name, fn) {
  const ctx = await bootBank();
  try { console.log(`\n=== ${name}`); await fn(ctx); } finally { await ctx.server.close(); }
}
await run("P1 mini: kullanım 1.000, geri ödeme anapara 1.500 + faiz 10", async ({ api, store }) => {
  const z = await openAccount(api, { bankName: "Ziraat Bankası", name: "Ana", kind: "demand", opening: { date: "2026-10-01", amount: "50.000", confirmed: true } });
  const k = await openAccount(api, { bankName: "Akbank", name: "Kredi", kind: "loan", opening: { date: "2026-10-01", amount: "0" } });
  show("kullanım", await v(api, { type: "loan_draw", accountId: z.id, loanAccountId: k.id, amount: "1.000", date: "2026-10-05" }));
  const c0 = cnt(store);
  show("ödeme 1.500+10", await v(api, { type: "loan_repay", accountId: z.id, loanAccountId: k.id, amount: "1.500", interestAmount: "10", date: "2026-10-06" }));
  console.log("  sayaç önce/sonra", c0, cnt(store), "kredi", await sub(api, k), "ziraat", await sub(api, z), await trial(api));
  show("ödeme 1.000+10 (tam)", await v(api, { type: "loan_repay", accountId: z.id, loanAccountId: k.id, amount: "1.000", interestAmount: "10", date: "2026-10-06" }));
  console.log("  kredi", await sub(api, k), "ziraat", await sub(api, z), await trial(api));
  const draw = store.get("SELECT id, no FROM fin_events WHERE type='loan_draw'");
  show("komşu: ödenmiş kredinin KULLANIMINI Ters Kaydet", await api.post(`${BANK}/events/${draw.id}/reverse`, {}));
  console.log("  kredi", await sub(api, k), await trial(api));
});
await run("P2 en küçük: hiç kullanılmamış (0) kredi, anapara 9.637,68 + faiz 434,61", async ({ api, store }) => {
  const z = await openAccount(api, { bankName: "Garanti BBVA", name: "B3", kind: "demand", creditLimit: "33.601", opening: { date: "2025-02-13", amount: "-16.800,50" } });
  const k = await openAccount(api, { bankName: "Akbank", name: "B7", kind: "loan", opening: { date: "2025-09-17", amount: "0" } });
  const c0 = cnt(store);
  show("ödeme", await v(api, { type: "loan_repay", accountId: z.id, loanAccountId: k.id, amount: "9.637,68", interestAmount: "434,61", date: "2026-10-08" }));
  console.log("  sayaç önce/sonra", c0, cnt(store), "kredi", await sub(api, k), "B3", await sub(api, z));
  show("yalnız faiz (anapara 0)", await v(api, { type: "loan_repay", accountId: z.id, loanAccountId: k.id, amount: "0", interestAmount: "434,61", date: "2026-10-08" }));
});
await run("P3 açılışta borçlu kredi 5.000: 6.000 → ?, 5.000 → ?", async ({ api }) => {
  const z = await openAccount(api, { bankName: "Ziraat Bankası", name: "Ana", kind: "demand", opening: { date: "2026-10-01", amount: "50.000", confirmed: true } });
  const k = await openAccount(api, { bankName: "Akbank", name: "Kredi", kind: "loan", opening: { date: "2026-10-01", amount: "5.000" } });
  console.log("  açılış sonrası kredi", await sub(api, k));
  show("6.000", await v(api, { type: "loan_repay", accountId: z.id, loanAccountId: k.id, amount: "6.000", date: "2026-10-05" }));
  show("5.000", await v(api, { type: "loan_repay", accountId: z.id, loanAccountId: k.id, amount: "5.000", date: "2026-10-05" }));
  console.log("  kredi", await sub(api, k));
});
await run("P4 komşu: geri ödeme kullanımdan ÖNCEKİ tarihle (kullanım 20.10? değil: 07.10, ödeme 03.10)", async ({ api }) => {
  const z = await openAccount(api, { bankName: "Ziraat Bankası", name: "Ana", kind: "demand", opening: { date: "2026-10-01", amount: "50.000", confirmed: true } });
  const k = await openAccount(api, { bankName: "Akbank", name: "Kredi", kind: "loan", opening: { date: "2026-10-01", amount: "0" } });
  show("kullanım 07.10", await v(api, { type: "loan_draw", accountId: z.id, loanAccountId: k.id, amount: "1.000", date: "2026-10-07" }));
  show("ödeme 03.10 (kullanımdan önce)", await v(api, { type: "loan_repay", accountId: z.id, loanAccountId: k.id, amount: "1.000", date: "2026-10-03" }));
  console.log("  kredi bugün", await sub(api, k), "· 05.10 itibarıyla mizan 300:", (await trialBalances(api, "?to=2026-10-05"))["300"] ?? 0);
});
