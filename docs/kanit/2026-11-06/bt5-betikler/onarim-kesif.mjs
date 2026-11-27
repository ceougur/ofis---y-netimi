// BT5 madde 2 keşif: güncel kodla iade + geri ödeme verisi kurulur, kart elle "eski kuralın" tutarına büyütülür; repairOwnCards / repairScreen / paymentStates gözlenir.
// node onarim-kesif.mjs <kök>
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = process.argv[2];
const { boot, must, rawRun } = await import(pathToFileURL(path.join(root, "test/banka-210-ortak.mjs")).href);
const T = "2026-10-08";
const ctx = await boot({ now: { time: `${T}T12:00:00+03:00`, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = ctx.api;
await must("kurulum", api.post("/api/workspace/bank/setup/dismiss", {}));
const customer = name => must(`cari ${name}`, api.post("/api/workspace/accounts", { name, type: "customer", registeredOn: "2026-07-01" }));
const sale = async (acc, { qty = 10, price = 100, cash = 500, firstDue = "2026-11-01" } = {}) => {
  const doc = await must("satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: acc.id, issueDate: "2026-08-09", currency: "TRY", rate: 1, pricesIncludeVat: false, lines: [{ name: "Hizmet", qty, unitPrice: price, vatRate: 0 }], payment: { cash: cash ? [{ amount: cash, method: "cash" }] : [], cheques: [], endorse: [], rest: "installments", installments: { count: 1, firstDue, everyMonths: 1 } }, force: true }));
  return { id: doc.id, planId: doc.plan?.id || doc.planId, lineId: doc.lines[0].id };
};
const giveBack = (acc, inv, qty, refund = 0) => must("iade", api.post("/api/workspace/invoices", { kind: "sale_return", accountId: acc.id, originalId: inv.id, issueDate: T, lines: [{ originLineId: inv.lineId, qty }], payment: { cash: refund ? [{ amount: refund, method: "cash" }] : [], cheques: [], endorse: [], rest: "open" }, force: true }));
const left = planId => ctx.app.context.plans.leftOf(planId);
const grow = (planId, amount) => {
  rawRun(ctx.db, "UPDATE plan_items SET amount = ? WHERE plan_id = ?", amount, planId);
  rawRun(ctx.db, "UPDATE plans SET total = ? WHERE id = ?", amount, planId);
};
const state = inv => {
  const s = ctx.app.context.invoices.paymentStates([{ id: inv.id, accountId: inv.accountId }]).get(inv.id);
  return { open: s?.open, excess: s?.excess, paid: s?.paid };
};
const X = await customer("Keşif X");
const x = await sale(X);
x.accountId = X.id;
console.log("X satış sonrası kart kalanı", left(x.planId), "durum", JSON.stringify(state(x)));
const ret = await giveBack(X, x, 10, 500);
console.log("X tam iade + 500 geri: kart kalanı", left(x.planId), "durum", JSON.stringify(state(x)), "iade", ret.id);
grow(x.planId, 500);
console.log("X kart elle 500: kalan", left(x.planId), "durum", JSON.stringify(state(x)));
const lines = ctx.app.context.accounts.allLedgers({ ids: [X.id] }).lines.get(X.id);
console.log("X defter satırları:", JSON.stringify(lines.map(l => ({ id: l.id, kind: l.kind, origin: l.origin, src: l.sourceId || "", d: l.debit, c: l.credit }))));
const screen = ctx.app.context.invoices.repairScreen([x.id]);
console.log("repairScreen X:", JSON.stringify(screen.get(x.id) && { open: screen.get(x.id).open, excess: screen.get(x.id).excess }));
// bayat: iadenin satırları olmadan
const all = ctx.app.context.accounts.allLedgers;
ctx.app.context.accounts.allLedgers = options => {
  const out = all(options);
  out.lines.set(X.id, (out.lines.get(X.id) || []).filter(l => l.sourceId !== ret.id));
  return out;
};
const stale = ctx.app.context.invoices.repairScreen([x.id]);
console.log("repairScreen X (iade satırları çıkarılmış):", JSON.stringify(stale.get(x.id) && { open: stale.get(x.id).open, excess: stale.get(x.id).excess }));
ctx.app.context.accounts.allLedgers = all;
const result = ctx.app.context.invoices.repairOwnCards({});
console.log("onarım:", JSON.stringify(result), "X kalan", left(x.planId));
// Kısmi iade: 8 adet + 500 geri, sonra 2 adet geri ödemesiz
const Y = await customer("Keşif Y");
const y = await sale(Y);
y.accountId = Y.id;
const r1 = await giveBack(Y, y, 8, 500);
console.log("Y 8 iade + 500: kalan", left(y.planId), JSON.stringify(state(y)));
const r2 = await giveBack(Y, y, 2, 0);
console.log("Y +2 iade: kalan", left(y.planId), JSON.stringify(state(y)), r1.id, r2.id);
grow(y.planId, 500);
ctx.app.context.accounts.allLedgers = options => {
  const out = all(options);
  out.lines.set(Y.id, (out.lines.get(Y.id) || []).filter(l => l.sourceId !== r2.id));
  return out;
};
const staleY = ctx.app.context.invoices.repairScreen([y.id]);
console.log("repairScreen Y (2. iade çıkarılmış):", JSON.stringify(staleY.get(y.id) && { open: staleY.get(y.id).open, excess: staleY.get(y.id).excess }), "tam:", JSON.stringify(state(y)));
ctx.app.context.accounts.allLedgers = all;
await ctx.server.close();
