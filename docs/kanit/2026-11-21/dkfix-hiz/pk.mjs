// S234 önce / sonra: T1–T8 senaryolarında bakiye, gecikmiş (08.10 / 09.10), Mizan 120, Mutabakat Testi, kart tutarı ve Kalan (pencere). ROOT=<kod kökü>
const ROOT = process.env.ROOT;
const { must } = await import(`${ROOT}/test/banka-210-ortak.mjs`);
const { bootBank } = await import(`${ROOT}/test/banka-210-hesap-ortak.mjs`);
const W = "/api/workspace";
const out = [];
async function scenario(name, fn) {
  const ctx = await bootBank({ now: { time: "2026-10-08T12:00:00+03:00", fixed: true } });
  const api = ctx.api;
  let minute = 0;
  const tick = () => ctx.server.clock.set(`2026-10-08T12:${String((minute += 1)).padStart(2, "0")}:00+03:00`);
  const h = {
    api, ctx, tick,
    acc: async () => (await must("cari", api.post(`${W}/accounts`, { name: "PK Müşteri", type: "customer", registeredOn: "2026-08-01" }))).id,
    goods: async (accountId, date, qty, payment) => (tick(), (await must("satış", api.post(`${W}/invoices`, { scenario: "goods_sale", accountId, issueDate: date, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment }))).id),
    cover: async (accountId, total, firstDue, registeredOn = "2026-10-07") => (tick(), (await must("kart", api.post(`${W}/plans`, { accountId, name: `M ${minute}`, total: String(total), registeredOn, mode: "auto", count: 3, firstDue, coversBalance: true }))).id),
    pay: (planId, amount) => (tick(), must("tahsilat", api.post(`${W}/plans/${planId}/entries`, { kind: "in", amount: String(amount), date: "2026-10-08", method: "cash" }))),
    close: async id => { tick(); const v = await must("kart", api.get(`${W}/plans/${id}`)); const r = await api.put(`${W}/plans/${id}`, { status: "closed", closeRemaining: v.totals.remaining }); if (r.status !== 200) throw new Error("kapat " + r.status); },
    giveBack: async (invoiceId, accountId, qty, payment = { cash: [] }) => { tick(); const line = (await must("fatura", api.get(`${W}/invoices/${invoiceId}`))).lines[0].id; return (await must("iade", api.post(`${W}/invoices`, { kind: "sale_return", accountId, originalId: invoiceId, issueDate: "2026-10-08", lines: [{ originLineId: line, qty }], payment, force: true }))).id; },
    cancel: id => (tick(), must("iptal", api.post(`${W}/invoices/${id}/cancel`, { reason: "x" }))),
  };
  const state = await fn(h);
  const snap = async label => {
    const a = await must("cari", api.get(`${W}/accounts/${state.A}`));
    const trial = Object.fromEntries((await must("mizan", api.get(`${W}/ledger`))).trial.accounts.map(r => [r.code, r.balance]));
    const mt = (await must("mt", api.get(`${W}/ledger/integrity`))).ok;
    const cards = [];
    for (const id of state.plans) {
      const v = await must("kart", api.get(`${W}/plans/${id}`));
      cards.push(`${v.status}:${v.total}/K${v.totals.remaining}`);
    }
    return `${label} bakiye ${a.totals.balance} gecikmiş ${a.totals.overdueDebt} 120 ${trial["120"] ?? 0} MT ${mt ? "ok" : "FAIL"} kartlar ${cards.join(",")}`;
  };
  const first = await snap("08.10");
  ctx.server.clock.set("2026-10-09T12:00:00+03:00");
  const second = await snap("09.10");
  out.push(`${name} | ${first} | ${second}`);
  ctx.server.close();
}
await scenario("T1", async h => { const A = await h.acc(); const g = await h.goods(A, "2026-10-07", 3, { rest: "account" }); const q = await h.cover(A, 900, "2026-10-10"); await h.pay(q, 300); await h.close(q); await h.giveBack(g, A, 1); return { A, plans: [q] }; });
await scenario("T2", async h => { const A = await h.acc(); const g = await h.goods(A, "2026-10-01", 3, { rest: "account" }); const q = await h.cover(A, 900, "2026-10-05", "2026-10-02"); await h.close(q); await h.giveBack(g, A, 1); return { A, plans: [q] }; });
await scenario("T3", async h => { const A = await h.acc(); const g = await h.goods(A, "2026-10-07", 3, { rest: "account" }); const q = await h.cover(A, 900, "2026-10-10"); await h.pay(q, 300); await h.close(q); await h.giveBack(g, A, 3); return { A, plans: [q] }; });
await scenario("T3b", async h => { const A = await h.acc(); const g = await h.goods(A, "2026-10-07", 3, { rest: "account" }); const q = await h.cover(A, 900, "2026-10-10"); await h.pay(q, 300); await h.close(q); await h.giveBack(g, A, 1, { cash: [{ amount: 300, method: "cash" }] }); return { A, plans: [q] }; });
await scenario("T4", async h => { const A = await h.acc(); const g = await h.goods(A, "2026-10-07", 3, { rest: "account" }); const q = await h.cover(A, 900, "2026-10-10"); await h.pay(q, 300); await h.close(q); const r = await h.giveBack(g, A, 1); await h.cancel(r); return { A, plans: [q] }; });
await scenario("T6", async h => { const A = await h.acc(); const g = await h.goods(A, "2026-10-06", 3, { rest: "account" }); const q = await h.cover(A, 900, "2026-10-10", "2026-10-06"); await h.close(q); await h.goods(A, "2026-10-07", 2, { rest: "account" }); const r = await h.cover(A, 600, "2026-10-20", "2026-10-07"); await h.cancel(g); return { A, plans: [q, r] }; });
await scenario("T7", async h => { const A = await h.acc(); const g = await h.goods(A, "2026-10-06", 3, { rest: "installments", installments: { count: 3, firstDue: "2026-10-06" } }); const q = h.ctx.store.get("SELECT plan_id AS id FROM invoices WHERE id = ?", g).id; await h.pay(q, 300); await h.close(q); const r = await h.giveBack(g, A, 1); return { A, plans: [q], r, g }; });
await scenario("T7b", async h => { const A = await h.acc(); const g = await h.goods(A, "2026-10-06", 3, { rest: "installments", installments: { count: 3, firstDue: "2026-10-06" } }); const q = h.ctx.store.get("SELECT plan_id AS id FROM invoices WHERE id = ?", g).id; await h.pay(q, 300); await h.close(q); const r = await h.giveBack(g, A, 1); await h.cancel(r); return { A, plans: [q] }; });
await scenario("T8", async h => { const A = await h.acc(); const g = await h.goods(A, "2026-10-05", 3, { rest: "account" }); const q = await h.cover(A, 900, "2026-10-10", "2026-10-05"); await h.close(q); await h.goods(A, "2026-10-06", 1, { rest: "account" }); const r = await h.cover(A, 300, "2026-10-20", "2026-10-06"); await h.giveBack(g, A, 1); return { A, plans: [q, r] }; });
console.log(out.join("\n"));
