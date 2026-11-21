// Kapama defteri ↔ kuyruk kapsam seçimi ayrışması: carinin açık borcu kart tutarından fazlayken (S120) kart hangi faturayı içine alıyor? ROOT=<kod>
const ROOT = process.env.ROOT;
const { must } = await import(`${ROOT}/test/banka-210-ortak.mjs`);
const { bootBank } = await import(`${ROOT}/test/banka-210-hesap-ortak.mjs`);
const W = "/api/workspace";
for (const cancelWhich of ["A", "B"]) {
  const ctx = await bootBank({ now: { time: "2026-09-03T12:00:00+03:00", fixed: true } });
  const api = ctx.api;
  let m = 0;
  const tick = () => ctx.server.clock.set(`2026-09-03T12:${String((m += 1)).padStart(2, "0")}:00+03:00`);
  const acc = (await must("cari", api.post(`${W}/accounts`, { name: "Ayr", type: "customer", registeredOn: "2026-08-01" }))).id;
  const sale = async (date, qty) => (tick(), (await must("s", api.post(`${W}/invoices`, { scenario: "goods_sale", accountId: acc, issueDate: date, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment: { rest: "account" } }))).id);
  const A = await sale("2026-09-01", 2);
  const B = await sale("2026-09-02", 2);
  tick();
  const k = (await must("k", api.post(`${W}/plans`, { accountId: acc, name: "K", total: "600", registeredOn: "2026-09-03", mode: "auto", count: 2, firstDue: "2026-10-05", coversBalance: true }))).id;
  const list = (await must("l", api.get(`${W}/invoices?tab=all`))).invoices.filter(x => x.accountId === acc);
  const row = id => ctx.store.get("SELECT id, account_id AS accountId, try_payable AS tryPayable, plan_id AS planId, payment_json AS paymentJson, kind FROM invoices WHERE id = ?", id);
  const settle = id => JSON.stringify(ctx.app.context.invoices.cardLedgerState(row(id)).coveredBy || {});
  const show = id => { const x = list.find(r => r.id === id); return `${x.payState} inPlan ${x.inPlan ?? 0}`; };
  const out = [`kuyruk: A ${show(A)} · B ${show(B)}`, `kapama defteri coveredBy: A ${settle(A)} · B ${settle(B)}`];
  tick();
  await must("iptal", api.post(`${W}/invoices/${cancelWhich === "A" ? A : B}/cancel`, { reason: "x" }));
  const v = await must("kart", api.get(`${W}/plans/${k}`));
  const t = (await must("c", api.get(`${W}/accounts/${acc}`))).totals;
  out.push(`${cancelWhich} İptal Et → kart ${v.status} ${v.total}/K${v.totals.remaining}; bakiye ${t.balance}`);
  console.log(out.join(" | "));
  ctx.server.close();
}
