// Bağımsız doğrulayıcı: bulgu 2 — eşdeğerlik testinin eski yolu hangi raporda YENİ moneyLines'ı çağırıyor?
const R = "/home/user/ofis---y-netimi";
const { bootBank, openAccount, must } = await import(`${R}/test/banka-210-hesap-ortak.mjs`);
const { registerCashRoutes } = await import(`${R}/server/routes/cash.mjs`);
const { createMoneyLines: createOld } = await import(`${R}/test/fixtures/hiz-210-eski/money-lines.mjs`);
const { registerReportCenter: registerOld } = await import(`${R}/test/fixtures/hiz-210-eski/report-center.mjs`);
const noRouter = () => new Proxy({}, { get: () => () => {} });
const ctx = await bootBank({ gateVerify: false });
const out = {};
try {
  const api = ctx.api;
  const abc = await must("cari", api.post("/api/workspace/accounts", { name: "A Ltd.", type: "customer", registeredOn: "2026-09-01" }));
  const Z = await openAccount(api, { bankName: "Z", name: "Z", kind: "demand", opening: { date: "2026-10-01", amount: "1.000", confirmed: true } });
  await must("tahsilat", api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", amount: "500", method: "bank", bankAccountId: Z.id, date: "2026-10-02" }));
  await must("masraf", api.post(`/api/workspace/bank/vouchers`, { type: "fee", accountId: Z.id, amount: "10", feeType: "eft", tax: "bsmv_excl", date: "2026-10-03" }));
  const app = ctx.app; const c = app.context;
  const user = app.store.get("SELECT u.id, u.username, u.display_name, u.role, u.role_key, u.active, u.deleted_at, u.must_change_password, u.grants_json FROM users u WHERE u.username = 'admin'");
  c.access.attach(user); user.roleKey = c.access.roleKeyOf(user);
  const money = createOld(c.store);
  const cash = registerCashRoutes(noRouter(), { ...c, money });
  const center = registerOld(noRouter(), { ...c, money, cash: () => cash, accounts: () => c.accounts, plans: () => c.plans, stock: () => c.stock, cheques: () => c.cheques, invoices: () => c.invoices, overview: () => c.overview, ledger: () => c.ledger, integrity: () => c.integrity });
  // YENİ moneyLines'ın (app.context.money) yöntemlerini say.
  const calls = {};
  out.frozen = Object.isFrozen(c.money);
  for (const k of Object.keys(c.money)) if (typeof c.money[k] === "function") { const f = c.money[k]; c.money[k] = (...a) => { calls[k] = (calls[k] || 0) + 1; return f(...a); }; }
  out.bankAccountsHasSubTrial = typeof (typeof c.bankAccounts === "function" ? c.bankAccounts() : c.bankAccounts)?.subTrialData;
  for (const id of ["alt-hesap-mizani", "banka-masraf", "banka-bakiye", "banka-hareket"]) {
    for (const k of Object.keys(calls)) delete calls[k];
    let err = null;
    try { await center.run(user, id, new URLSearchParams({ preset: "all" })); } catch (e) { err = String(e.message).slice(0, 100); }
    out[id] = { yeniMoneyCagrilari: { ...calls }, err };
  }
} catch (e) { out.err = String(e.stack).slice(0, 800); }
finally { await ctx.server.close(); }
console.log(JSON.stringify(out, null, 1));
process.exit(0);
