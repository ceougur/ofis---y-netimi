import { BANK, bootBank, openAccount, subBalances } from "/home/user/ofis---y-netimi/test/banka-210-hesap-ortak.mjs";
const v = (api, body) => api.post(`${BANK}/transfers`, body);
const show = (label, r) => console.log(label, r.status, r.code || "", (r.error || "").slice(0, 220));
async function sub(api, acc) { const s = await subBalances(api); return s[acc.glSub]?.balance ?? 0; }
async function run(name, fn) { const ctx = await bootBank(); try { console.log(`\n=== ${name}`); await fn(ctx); } finally { await ctx.server.close(); } }
await run("P5 Açılışı Düzelt: borç 5.000 açılış, 5.000 ödendi, açılış 3.000'e düzeltilir", async ({ api }) => {
  const z = await openAccount(api, { bankName: "Ziraat Bankası", name: "Ana", kind: "demand", opening: { date: "2026-10-01", amount: "50.000", confirmed: true } });
  const k = await openAccount(api, { bankName: "Akbank", name: "Kredi", kind: "loan", opening: { date: "2026-10-01", amount: "5.000" } });
  show("ödeme 5.000", await v(api, { type: "loan_repay", accountId: z.id, loanAccountId: k.id, amount: "5.000", date: "2026-10-05" }));
  show("açılış 3.000", await api.post(`${BANK}/accounts/${k.id}/opening`, { date: "2026-10-01", amount: "3.000" }));
  console.log("  kredi", await sub(api, k));
});
await run("P6 Düzelt: kullanım 1.000, ödeme 1.000; kullanımı 400'e Düzelt", async ({ api, store }) => {
  const z = await openAccount(api, { bankName: "Ziraat Bankası", name: "Ana", kind: "demand", opening: { date: "2026-10-01", amount: "50.000", confirmed: true } });
  const k = await openAccount(api, { bankName: "Akbank", name: "Kredi", kind: "loan", opening: { date: "2026-10-01", amount: "0" } });
  show("kullanım", await v(api, { type: "loan_draw", accountId: z.id, loanAccountId: k.id, amount: "1.000", date: "2026-10-05" }));
  show("ödeme", await v(api, { type: "loan_repay", accountId: z.id, loanAccountId: k.id, amount: "1.000", date: "2026-10-06" }));
  const draw = store.get("SELECT id FROM fin_events WHERE type='loan_draw'");
  show("kullanımı 400'e düzelt", await api.post(`${BANK}/events/${draw.id}/correct`, { amount: "400" }));
  console.log("  kredi", await sub(api, k));
});
