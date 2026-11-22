// Yoklama yardımcısı (izt2): ROOT=<kod>
const ROOT = process.env.ROOT;
const { must } = await import(`${ROOT}/test/banka-210-ortak.mjs`);
const { bootBank } = await import(`${ROOT}/test/banka-210-hesap-ortak.mjs`);
export const W = "/api/workspace";
export async function world(start, fn) {
  const ctx = await bootBank({ now: { time: `${start}T12:00:00+03:00`, fixed: true } });
  const api = ctx.api;
  let minute = 0;
  let day = start;
  const at = d => { day = d; minute = 0; ctx.server.clock.set(`${d}T12:00:00+03:00`); };
  const tick = () => ctx.server.clock.set(`${day}T12:${String((minute += 1)).padStart(2, "0")}:00+03:00`);
  const h = {
    api, ctx, at, must, tick,
    acc: async (name = "İzt2") => (await must("cari", api.post(`${W}/accounts`, { name, type: "customer", registeredOn: "2026-08-01" }))).id,
    goods: async (accountId, date, qty, payment = { rest: "account" }) => (tick(), (await must("satış", api.post(`${W}/invoices`, { scenario: "goods_sale", accountId, issueDate: date, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment }))).id),
    debt: async (accountId, date, amount) => (tick(), (await must("borç", api.post(`${W}/accounts/${accountId}/entries`, { kind: "debt", amount: String(amount), date, note: "elle" }))).id),
    cover: async (accountId, total, firstDue, registeredOn, count = 3) => (tick(), (await must("kart", api.post(`${W}/plans`, { accountId, name: `M ${minute}`, total: String(total), registeredOn, mode: "auto", count, firstDue, coversBalance: true }))).id),
    pay: (planId, amount) => (tick(), must("tahsilat", api.post(`${W}/plans/${planId}/entries`, { kind: "in", amount: String(amount), date: day, method: "cash" }))),
    close: async id => { tick(); const v = await must("kart", api.get(`${W}/plans/${id}`)); const r = await api.put(`${W}/plans/${id}`, { status: "closed", closeRemaining: v.totals.remaining }); if (r.status !== 200) throw new Error(`Kartı Kapat ${r.status}`); },
    giveBack: async (invoiceId, accountId, qty) => { tick(); const line = (await must("fatura", api.get(`${W}/invoices/${invoiceId}`))).lines[0].id; return (await must("iade", api.post(`${W}/invoices`, { kind: "sale_return", accountId, originalId: invoiceId, issueDate: day, lines: [{ originLineId: line, qty }], payment: { cash: [] }, force: true }))).id; },
    editReturn: async (returnId, qty) => { tick(); const d = await must("iade", api.get(`${W}/invoices/${returnId}`)); const r = await api.post(`${W}/invoices/${returnId}/edit`, { kind: "sale_return", accountId: d.accountId, originalId: d.originalId, issueDate: d.issueDate, lines: [{ originLineId: d.lines[0].originLineId, qty }], payment: { cash: [] }, force: true }); return { status: r.status, body: r.status === 200 ? null : r.body }; },
    cancel: id => (tick(), must("iptal", api.post(`${W}/invoices/${id}/cancel`, { reason: "x" }))),
    edit: async (id, qty, payment = { rest: "account" }) => { tick(); const d = await must("fatura", api.get(`${W}/invoices/${id}`)); const r = await api.post(`${W}/invoices/${id}/edit`, { scenario: d.scenario, accountId: d.accountId, issueDate: d.issueDate, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment, force: true }); return { status: r.status, body: r.status === 200 ? null : r.body }; },
    card: async id => { const v = await must("kart", api.get(`${W}/plans/${id}`)); return { status: v.status, total: v.total, paid: v.totals.paid, left: v.totals.remaining, items: v.items.map(i => `${i.dueDate}:${i.amount}${i.remaining !== undefined ? `/k${i.remaining}` : ""}`) }; },
    rows: planId => ctx.store.all("SELECT id, seq, due_date AS dueDate, amount FROM plan_items WHERE plan_id = ? ORDER BY due_date, seq", planId),
    own: planId => { const p = ctx.store.get("SELECT total FROM plans WHERE id = ?", planId); const paid = ctx.store.get("SELECT COALESCE(SUM(CASE WHEN kind='in' THEN amount ELSE -amount END),0) AS n FROM plan_entries WHERE plan_id = ?", planId).n; return { total: p.total, paid, left: Math.round((p.total - paid) * 100) / 100 }; },
    account: async A => { const t = (await must("cari", api.get(`${W}/accounts/${A}`))).totals; return { balance: t.balance, overdue: t.overdueDebt }; },
    ok: async () => (await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`))).ok,
    invoice: async id => { const x = (await must("faturalar", api.get(`${W}/invoices?tab=all`))).invoices.find(r => r.id === id); return x ? { open: x.open, state: x.payState, inPlan: x.inPlan ?? 0 } : null; },
    settle: id => { const row = ctx.store.get("SELECT id, account_id AS accountId, try_payable AS tryPayable, plan_id AS planId, payment_json AS paymentJson, kind, status FROM invoices WHERE id = ?", id); const s = ctx.app.context.invoices.cardLedgerState(row); return { open: s.open, coveredBy: s.coveredBy }; },
  };
  try { return await fn(h); } finally { ctx.server.close(); }
}
