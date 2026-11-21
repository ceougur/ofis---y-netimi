// İzleyen küçük tur yoklaması: ROOT=<kod kökü> [ONLY=ad,ad]
const ROOT = process.env.ROOT;
const { must } = await import(`${ROOT}/test/banka-210-ortak.mjs`);
const { bootBank } = await import(`${ROOT}/test/banka-210-hesap-ortak.mjs`);
const W = "/api/workspace";
const only = (process.env.ONLY || "").split(",").filter(Boolean);
const out = [];
async function scenario(name, start, fn, days) {
  if (only.length && !only.includes(name)) return;
  const ctx = await bootBank({ now: { time: `${start}T12:00:00+03:00`, fixed: true } });
  const api = ctx.api;
  let minute = 0;
  let day = start;
  const at = d => { day = d; minute = 0; ctx.server.clock.set(`${d}T12:00:00+03:00`); };
  const tick = () => ctx.server.clock.set(`${day}T12:${String((minute += 1)).padStart(2, "0")}:00+03:00`);
  const h = {
    api, ctx, tick, at,
    acc: async (n = "PK Müşteri") => (await must("cari", api.post(`${W}/accounts`, { name: n, type: "customer", registeredOn: "2026-08-01" }))).id,
    goods: async (accountId, date, qty, payment = { rest: "account" }) => (tick(), (await must("satış", api.post(`${W}/invoices`, { scenario: "goods_sale", accountId, issueDate: date, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment }))).id),
    debt: async (accountId, date, amount) => (tick(), (await must("borç", api.post(`${W}/accounts/${accountId}/entries`, { kind: "debt", amount: String(amount), date, note: "elle" }))).id),
    cover: async (accountId, total, firstDue, registeredOn) => (tick(), (await must("kart", api.post(`${W}/plans`, { accountId, name: `M ${minute}`, total: String(total), registeredOn, mode: "auto", count: 3, firstDue, coversBalance: true }))).id),
    pay: (planId, amount, date = day) => (tick(), must("tahsilat", api.post(`${W}/plans/${planId}/entries`, { kind: "in", amount: String(amount), date, method: "cash" }))),
    close: async id => { tick(); const v = await must("kart", api.get(`${W}/plans/${id}`)); const r = await api.put(`${W}/plans/${id}`, { status: "closed", closeRemaining: v.totals.remaining }); if (r.status !== 200) throw new Error("kapat " + r.status + JSON.stringify(r.body)); },
    giveBack: async (invoiceId, accountId, qty, date = day, payment = { cash: [] }) => { tick(); const line = (await must("fatura", api.get(`${W}/invoices/${invoiceId}`))).lines[0].id; return (await must("iade", api.post(`${W}/invoices`, { kind: "sale_return", accountId, originalId: invoiceId, issueDate: date, lines: [{ originLineId: line, qty }], payment, force: true }))).id; },
    cancel: id => (tick(), must("iptal", api.post(`${W}/invoices/${id}/cancel`, { reason: "x" }))),
    edit: async (id, qty, payment = { rest: "account" }) => { tick(); const d = await must("fatura", api.get(`${W}/invoices/${id}`)); const r = await api.post(`${W}/invoices/${id}/edit`, { scenario: d.scenario, accountId: d.accountId, issueDate: d.issueDate, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment, force: true }); return `${r.status}${r.status !== 200 ? ":" + (r.body?.code || r.body?.error) : ""}`; },
  };
  const state = await fn(h);
  const snap = async label => {
    const a = await must("cari", api.get(`${W}/accounts/${state.A}`));
    const mt = (await must("mt", api.get(`${W}/ledger/integrity`))).ok;
    const cards = [];
    for (const id of state.plans) {
      const v = await must("kart", api.get(`${W}/plans/${id}`));
      cards.push(`${v.status}:${v.total}/T${v.totals.paid}/K${v.totals.remaining}[${v.items.map(i => `${i.dueDate.slice(5)}:${i.amount}/${i.remaining}`).join(" ")}]`);
    }
    const invs = (await must("faturalar", api.get(`${W}/invoices?tab=all`))).invoices.filter(x => x.accountId === state.A).map(x => `${x.number.slice(-2)}:${x.kind}:${x.status}:${x.payState}:${x.open}/${x.ownOpen ?? "-"}/${x.inPlan ?? "-"}`);
    return `${label} bakiye ${a.totals.balance} gecikmiş ${a.totals.overdueDebt} MT ${mt ? "ok" : "FAIL"} | kartlar ${cards.join(" , ")} | [${invs.join(" ")}]${state.note ? " | " + state.note : ""}`;
  };
  const lines = [];
  for (const d of days) { at(d); lines.push(await snap(d.slice(5))); }
  out.push(`${name}\n  ${lines.join("\n  ")}`);
  ctx.server.close();
}
const own3 = { rest: "installments", installments: { count: 3, firstDue: "2026-10-05" } };
const ownPlan = async (h, f) => (await must("f", h.api.get(`${W}/invoices/${f}`))).planId;
// d55 B1: kart 900 (05.10/05.11/05.12), tahsilat 300, 10.11 iade 300, 20.11 iptal
for (const kapali of [false, true]) await scenario(`B1${kapali ? "k" : ""}`, "2026-09-02", async h => { const A = await h.acc(); const f = await h.goods(A, "2026-09-01", 3); const k = await h.cover(A, 900, "2026-10-05", "2026-09-02"); h.at("2026-09-03"); await h.pay(k, 300); if (kapali) { h.at("2026-09-04"); await h.close(k); } h.at("2026-11-10"); const r = await h.giveBack(f, A, 1); h.at("2026-11-20"); await h.cancel(r); return { A, plans: [k] }; }, ["2026-11-20", "2026-11-21"]);
// d55 B2: kart 900, tahsilat 600, iade 600
for (const kapali of [false, true]) await scenario(`B2${kapali ? "k" : ""}`, "2026-09-02", async h => { const A = await h.acc(); const f = await h.goods(A, "2026-09-01", 3); const k = await h.cover(A, 900, "2026-10-05", "2026-09-02"); h.at("2026-09-03"); await h.pay(k, 600); if (kapali) { h.at("2026-09-04"); await h.close(k); } h.at("2026-11-10"); await h.giveBack(f, A, 2); return { A, plans: [k] }; }, ["2026-11-20"]);
// kendi kartı
for (const kapali of [false, true]) await scenario(`OWN2${kapali ? "k" : ""}`, "2026-09-01", async h => { const A = await h.acc(); const f = await h.goods(A, "2026-09-01", 3, own3); const k = await ownPlan(h, f); h.at("2026-09-03"); await h.pay(k, 600); if (kapali) { h.at("2026-09-04"); await h.close(k); } h.at("2026-11-10"); await h.giveBack(f, A, 2); return { A, plans: [k] }; }, ["2026-11-20"]);
for (const kapali of [false, true]) await scenario(`OWN1${kapali ? "k" : ""}`, "2026-09-01", async h => { const A = await h.acc(); const f = await h.goods(A, "2026-09-01", 3, own3); const k = await ownPlan(h, f); h.at("2026-09-03"); await h.pay(k, 300); if (kapali) { h.at("2026-09-04"); await h.close(k); } h.at("2026-11-10"); const r = await h.giveBack(f, A, 1); h.at("2026-11-20"); await h.cancel(r); return { A, plans: [k] }; }, ["2026-11-20", "2026-11-21"]);
// BULGU-1
await scenario("T8acik", "2026-10-08", async h => { const A = await h.acc(); const g = await h.goods(A, "2026-10-05", 3); const q = await h.cover(A, 900, "2026-10-10", "2026-10-05"); await h.goods(A, "2026-10-06", 1); const r = await h.cover(A, 300, "2026-10-20", "2026-10-06"); await h.giveBack(g, A, 1); return { A, plans: [q, r] }; }, ["2026-10-08", "2026-10-09"]);
await scenario("T8sonra", "2026-10-08", async h => { const A = await h.acc(); const g = await h.goods(A, "2026-10-05", 3); const q = await h.cover(A, 900, "2026-10-10", "2026-10-05"); await h.goods(A, "2026-10-06", 1); const r = await h.cover(A, 300, "2026-10-20", "2026-10-06"); await h.close(q); await h.giveBack(g, A, 1); return { A, plans: [q, r] }; }, ["2026-10-08", "2026-10-09"]);
// S239: fatura 900, kart 600 (kısmen), iade 300
await scenario("S239", "2026-09-02", async h => { const A = await h.acc(); const f = await h.goods(A, "2026-09-01", 3); const k = await h.cover(A, 600, "2026-10-05", "2026-09-02"); h.at("2026-09-10"); await h.giveBack(f, A, 1); return { A, plans: [k] }; }, ["2026-09-10", "2026-10-06"]);
// S240: elle borç 300 + fatura 900 → kart 1200, tahsilat 300, iade 300 (fatura)
await scenario("S240", "2026-09-02", async h => { const A = await h.acc(); await h.debt(A, "2026-08-20", 300); const f = await h.goods(A, "2026-09-01", 3); const k = await h.cover(A, 1200, "2026-10-05", "2026-09-02"); h.at("2026-09-03"); await h.pay(k, 300); h.at("2026-09-10"); await h.giveBack(f, A, 1); return { A, plans: [k] }; }, ["2026-09-10"]);
// Düzenle 900 → 300 (açık / kapalı kart), tahsilatlı (SK-42 a), 300 → 900 (SK-42 b)
for (const kapali of [false, true]) await scenario(`D1${kapali ? "k" : ""}`, "2026-09-02", async h => { const A = await h.acc(); const f = await h.goods(A, "2026-09-01", 3); const k = await h.cover(A, 900, "2026-10-05", "2026-09-02"); if (kapali) { h.at("2026-09-04"); await h.close(k); } h.at("2026-09-10"); const s = await h.edit(f, 1); return { A, plans: [k], note: `edit ${s}` }; }, ["2026-09-10", "2026-11-06"]);
await scenario("D2a", "2026-09-02", async h => { const A = await h.acc(); const f = await h.goods(A, "2026-09-01", 3); const k = await h.cover(A, 900, "2026-10-05", "2026-09-02"); h.at("2026-09-03"); await h.pay(k, 600); h.at("2026-09-10"); const s = await h.edit(f, 1); return { A, plans: [k], note: `edit ${s}` }; }, ["2026-09-10"]);
await scenario("D2b", "2026-09-02", async h => { const A = await h.acc(); const f = await h.goods(A, "2026-09-01", 1); const k = await h.cover(A, 300, "2026-10-05", "2026-09-02"); h.at("2026-09-10"); const s = await h.edit(f, 3); return { A, plans: [k], note: `edit ${s}` }; }, ["2026-09-10", "2026-10-06"]);
console.log(out.join("\n"));
