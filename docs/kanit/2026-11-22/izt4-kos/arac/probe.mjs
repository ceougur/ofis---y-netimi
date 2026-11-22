// Dar kontrol (TEK): kart kapsamı / küçülme-büyüme / gösterilen açık senaryoları. ROOT=<kod> SC=<adlar,virgüllü> node senaryo.mjs
const ROOT = process.env.ROOT;
const { must } = await import(`${ROOT}/test/banka-210-ortak.mjs`);
const { bootBank } = await import(`${ROOT}/test/banka-210-hesap-ortak.mjs`);
const W = "/api/workspace";
const r2 = v => Math.round(Number(v) * 100) / 100;
async function world(start, fn) {
  const ctx = await bootBank({ now: { time: `${start}T12:00:00+03:00`, fixed: true } });
  const api = ctx.api;
  let minute = 0;
  let day = start;
  const at = d => { day = d; minute = 0; ctx.server.clock.set(`${d}T12:00:00+03:00`); };
  const tick = () => ctx.server.clock.set(`${day}T12:${String((minute += 1)).padStart(2, "0")}:00+03:00`);
  const h = {
    api, ctx, at,
    acc: async (name = "Dk Müşteri") => (await must("cari", api.post(`${W}/accounts`, { name, type: "customer", registeredOn: "2026-08-01" }))).id,
    goods: async (accountId, date, qty, payment = { rest: "account" }) => (tick(), (await must("satış", api.post(`${W}/invoices`, { scenario: "goods_sale", accountId, issueDate: date, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment }))).id),
    debt: async (accountId, date, amount, extra = {}) => (tick(), (await must("borç", api.post(`${W}/accounts/${accountId}/entries`, { kind: "debt", amount: String(amount), date, note: "elle", ...extra }))).id),
    cover: async (accountId, total, firstDue, registeredOn, count = 3) => (tick(), (await must("kart", api.post(`${W}/plans`, { accountId, name: `M ${day} ${minute}`, total: String(total), registeredOn, mode: "auto", count, firstDue, coversBalance: true }))).id),
    pay: (planId, amount) => (tick(), must("tahsilat", api.post(`${W}/plans/${planId}/entries`, { kind: "in", amount: String(amount), date: day, method: "cash" }))),
    payInvoice: (A, invoiceId, amount) => (tick(), api.post(`${W}/accounts/${A}/entries`, { kind: "in", amount: String(amount), date: day, method: "cash", invoiceId, note: "fatura tahsilatı" })),
    close: async id => {
      tick();
      const v = await must("kart", api.get(`${W}/plans/${id}`));
      const r = await api.put(`${W}/plans/${id}`, { status: "closed", closeRemaining: v.totals.remaining });
      if (r.status !== 200) throw new Error(`Kartı Kapat ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
    },
    giveBack: async (invoiceId, accountId, qty) => {
      tick();
      const line = (await must("fatura", api.get(`${W}/invoices/${invoiceId}`))).lines[0].id;
      return (await must("iade", api.post(`${W}/invoices`, { kind: "sale_return", accountId, originalId: invoiceId, issueDate: day, lines: [{ originLineId: line, qty }], payment: { cash: [] }, force: true }))).id;
    },
    cancel: async (id, extra = {}) => { tick(); const r = await api.post(`${W}/invoices/${id}/cancel`, { reason: "x", ...extra }); return `${r.status}${r.status !== 200 ? ` ${JSON.stringify(r.data).slice(0, 160)}` : ""}`; },
    edit: async (id, qty, payment = { rest: "account" }) => {
      tick();
      const d = await must("fatura", api.get(`${W}/invoices/${id}`));
      const r = await api.post(`${W}/invoices/${id}/edit`, { scenario: d.scenario, accountId: d.accountId, issueDate: d.issueDate, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment, force: true });
      return `${r.status}${r.status !== 200 ? ` ${JSON.stringify(r.data).slice(0, 160)}` : ""}`;
    },
    snap: async (label, A, plans, invoices) => {
      const acc = await must("cari", api.get(`${W}/accounts/${A}`));
      const t = acc.totals || {};
      const out = [`  [${day}] ${label}: bakiye ${t.balance} gecikmiş ${t.overdueDebt ?? "?"} (taksit ${t.overdueInstallments ?? t.overdue})`];
      const list = (await must("Taksitler", api.get(`${W}/plans?status=all`))).plans;
      for (const [name, id] of Object.entries(plans)) {
        if (!id) continue;
        const v = await api.get(`${W}/plans/${id}`);
        const w = v.status === 200 ? `${v.data.status} ${v.data.total} T${v.data.totals.paid}/K${v.data.totals.remaining}/G${v.data.totals.overdue ?? "?"}` : `GET ${v.status}`;
        const s = (acc.plans || []).find(x => x.id === id);
        const l = list.find(x => x.id === id);
        const total = Number(ctx.store.get("SELECT total FROM plans WHERE id = ?", id)?.total);
        const paid = Number(ctx.store.get("SELECT COALESCE(SUM(CASE WHEN kind = 'in' THEN amount ELSE -amount END), 0) AS n FROM plan_entries WHERE plan_id = ?", id).n);
        const rows = ctx.store.all("SELECT due_date AS d, amount AS a FROM plan_items WHERE plan_id = ? ORDER BY due_date, seq", id).map(x => `${x.d.slice(5)}:${x.a}`).join(" ");
        out.push(`    kart ${name}: pencere[${w}] cari[${s ? `T${s.totals.paid}/K${s.totals.remaining}` : "-"}] liste[${l ? `T${l.totals.paid}/K${l.totals.remaining}` : "-"}] kendi[${total}/${paid}/${r2(total - paid)}] taksit[${rows}]`);
      }
      const inv = (await must("faturalar", api.get(`${W}/invoices?tab=all`))).invoices;
      for (const [name, id] of Object.entries(invoices)) {
        if (!id) continue;
        const l = inv.find(x => x.id === id);
        const d = await must("fatura", api.get(`${W}/invoices/${id}`));
        const row = ctx.store.get("SELECT id, account_id AS accountId, try_payable AS tryPayable, plan_id AS planId, payment_json AS paymentJson, kind, status FROM invoices WHERE id = ?", id);
        let cov = "";
        try { cov = JSON.stringify(ctx.app.context.invoices.cardLedgerState(row).coveredBy || {}).replace(/"[^"]*"(?=:)/g, k => (Object.entries(plans).find(([, v]) => `"${v}"` === k)?.[0] || "?")); } catch (e) { cov = `hata ${e.message}`; }
        out.push(`    fatura ${name}: ${d.status} ${d.tryPayable} liste[${l?.payState}/${l?.open}] kart[${d.payState}/açık ${d.open}/kendi ${d.ownOpen ?? "-"}/inPlan ${d.inPlan ?? "-"}] kapsam${cov}`);
      }
      const ok = (await must("Mutabakat", api.get(`${W}/ledger/integrity`))).ok;
      out.push(`    Mutabakat ${ok ? "ok" : "BOZUK"}`);
      console.log(out.join("\n"));
    },
  };
  try { return await fn(h); } finally { ctx.server.close(); }
}

const SC = (process.env.SC || "").split(",").filter(Boolean);
const want = n => !SC.length || SC.includes(n);
if (want("P4b")) {
  console.log("P4b bağlı 600 → iade 300 → iade iptali");
  await world("2026-09-01", async h => {
    const A = await h.acc();
    const f = await h.goods(A, "2026-09-01", 3);
    h.at("2026-09-02");
    const K = await h.cover(A, 600, "2026-10-05", "2026-09-02");
    h.at("2026-10-20");
    const r0 = await h.payInvoice(A, f, 600);
    console.log(`  bağlı 600: ${r0.status}`);
    await h.snap("bağlı 600", A, { K }, { F: f });
    h.at("2026-10-21");
    const r = await h.giveBack(f, A, 1);
    await h.snap("iade 300", A, { K }, { F: f, R: r });
    const cuts = h.ctx.store.get("SELECT payment_json AS j FROM invoices WHERE id = ?", r).j;
    console.log(`  iade payment_json: ${cuts}`);
    h.at("2026-10-22");
    console.log(`  iade iptal: ${await h.cancel(r)}`);
    await h.snap("iade iptali", A, { K }, { F: f, R: r });
  });
}
if (want("P4a")) {
  console.log("P4a iade 300 → bağlı 600");
  await world("2026-09-01", async h => {
    const A = await h.acc();
    const f = await h.goods(A, "2026-09-01", 3);
    h.at("2026-09-02");
    const K = await h.cover(A, 600, "2026-10-05", "2026-09-02");
    h.at("2026-10-20");
    const r = await h.giveBack(f, A, 1);
    await h.snap("iade 300", A, { K }, { F: f, R: r });
    h.at("2026-10-21");
    const r0 = await h.payInvoice(A, f, 600);
    console.log(`  bağlı 600: ${r0.status}`);
    await h.snap("bağlı 600", A, { K }, { F: f, R: r });
    const d = await must("fatura", h.api.get(`${W}/invoices/${f}`));
    console.log(`  F kapatanlar: ${JSON.stringify((d.closers || []).map(c => [c.label, c.amount, c.mode || c.modeLabel]))}`);
    const rd = await must("iade", h.api.get(`${W}/invoices/${r}`));
    console.log(`  R kapatanlar: ${JSON.stringify((rd.closers || []).map(c => [c.label, c.amount, c.mode || c.modeLabel]))}`);
  });
}
if (want("P1")) for (const amount of [600, 900, 1200]) {
  console.log(`P1 bağlı ${amount}`);
  await world("2026-09-01", async h => {
    const A = await h.acc();
    const f = await h.goods(A, "2026-09-01", 3);
    h.at("2026-09-02");
    const K = await h.cover(A, 600, "2026-10-05", "2026-09-02");
    h.at("2026-10-20");
    const r0 = await h.payInvoice(A, f, amount);
    await h.snap(`bağlı ${amount}`, A, { K }, { F: f });
    const row = h.ctx.store.get("SELECT id, account_id AS accountId, try_payable AS tryPayable, plan_id AS planId, payment_json AS paymentJson, kind, status FROM invoices WHERE id = ?", f);
    const st = h.ctx.app.context.invoices.cardLedgerState(row);
    console.log(`  defter: open ${st.open} excess ${st.excess} covered ${st.covered} ${JSON.stringify(st.coveredBy)}`);
  });
}
if (want("P4bf")) {
  console.log("P4bf bağsız 600 → iade 300");
  await world("2026-09-01", async h => {
    const A = await h.acc();
    const f = await h.goods(A, "2026-09-01", 3);
    h.at("2026-09-02");
    const K = await h.cover(A, 600, "2026-10-05", "2026-09-02");
    h.at("2026-10-20");
    await h.api.post(`${W}/accounts/${A}/entries`, { kind: "in", amount: "600", date: "2026-10-20", method: "cash", note: "bağsız" });
    await h.snap("bağsız 600", A, { K }, { F: f });
    h.at("2026-10-21");
    const r = await h.giveBack(f, A, 1);
    await h.snap("iade 300", A, { K }, { F: f, R: r });
  });
}
if (want("P9")) for (const amount of [300, 600, 900]) {
  console.log(`P9 Mahsup Et ${amount} (F ↔ Alacak Yaz 900)`);
  await world("2026-09-01", async h => {
    const A = await h.acc();
    const f = await h.goods(A, "2026-09-01", 3);
    h.at("2026-09-02");
    const K = await h.cover(A, 600, "2026-10-05", "2026-09-02");
    h.at("2026-10-20");
    const credit = (await must("alacak", h.api.post(`${W}/accounts/${A}/entries`, { kind: "credit", amount: "900", date: "2026-10-20", note: "alacak yaz" }))).entryId;
    await h.snap("Alacak Yaz 900", A, { K }, { F: f });
    const off = await must("mahsup adayları", h.api.get(`${W}/invoices/${f}/offsets`));
    console.log(`  Mahsup Et: sınır open ${off.open} öneri suggest ${off.suggest ?? "-"}`);
    const r = await h.api.post(`${W}/invoices/${f}/offsets`, { counterType: "entry", counterId: credit, amount: String(amount), date: "2026-10-20", note: "" });
    console.log(`  mahsup ${amount}: ${r.status}${r.status !== 200 ? ` ${JSON.stringify(r.data).slice(0, 160)}` : ""}`);
    await h.snap(`Mahsup ${amount}`, A, { K }, { F: f });
  });
}
if (want("P10")) for (const act of ["iptal", "duzenle600", "duzenle300", "bagsiz-iptal", "bagsiz-duzenle600"]) {
  console.log(`P10 ${act.startsWith("bagsiz") ? "bağsız" : "bağlı"} 600 → ${act}`);
  await world("2026-09-01", async h => {
    const A = await h.acc();
    const f = await h.goods(A, "2026-09-01", 3);
    h.at("2026-09-02");
    const K = await h.cover(A, 600, "2026-10-05", "2026-09-02");
    h.at("2026-10-20");
    if (act.startsWith("bagsiz")) await h.api.post(`${W}/accounts/${A}/entries`, { kind: "in", amount: "600", date: "2026-10-20", method: "cash", note: "bağsız" });
    else await h.payInvoice(A, f, 600);
    await h.snap("ödeme 600", A, { K }, { F: f });
    h.at("2026-10-21");
    if (act.endsWith("iptal")) console.log(`  iptal: ${await h.cancel(f)}`);
    else console.log(`  Düzenle: ${await h.edit(f, act.endsWith("300") ? 1 : 2)}`);
    await h.snap(act, A, { K }, { F: f });
  });
}
if (want("P7")) {
  await world("2026-09-01", async h => {
    const A = await h.acc("P7 Rapor");
    const f = await h.goods(A, "2026-09-01", 3);
    h.at("2026-09-02");
    await h.cover(A, 600, "2026-10-05", "2026-09-02");
    h.at("2026-10-20");
    await h.payInvoice(A, f, 600);
    const vade = await must("vade", h.api.get(`${W}/overview/vade-takip?from=2026-01-01&to=2027-06-30`));
    console.log("vade keys", Object.keys(vade), JSON.stringify(vade.rows?.slice(0, 3)).slice(0, 600));
    const dues = await must("dues", h.api.get(`${W}/dues`));
    console.log("dues", JSON.stringify(dues.items?.slice(0, 3)).slice(0, 400));
    const aging = await must("aging", h.api.get(`${W}/report-center/alacak-yaslandirma`));
    console.log("aging", JSON.stringify(aging.headers), JSON.stringify(aging.rows?.slice(0, 2)).slice(0, 400));
    const flow = await must("flow", h.api.get(`${W}/overview/nakit-akisi?from=2026-10-20&to=2027-06-30`));
    console.log("flow keys", Object.keys(flow), JSON.stringify(flow.rows?.slice(0, 3) || flow).slice(0, 900));
  });
}
