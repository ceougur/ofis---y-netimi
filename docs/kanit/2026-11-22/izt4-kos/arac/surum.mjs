// İzleyen tur 4 — v2.4.9 verisi (o sürümün GERÇEK koduyla, API'den) → eski (6a1d19d1) ve yeni kodda sınıf sınıf okuma (ders 53 (b)).
//   ROOT=<kod ağacı> MODE=uret DATA=<klasör> node surum.mjs   — v2.4.9 ile veriyi üretir (ROOT'un test/guvenilirlik/surumler.mjs'i etiketi git archive ile açar)
//   ROOT=<kod ağacı> MODE=oku  DATA=<klasör> node surum.mjs   — ROOT'un kendi koduyla (CURRENT) açar, carileri sınıf adıyla döker (JSON satırları)
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.env.ROOT;
const MODE = process.env.MODE;
const DATA = process.env.DATA;
const { bootVersion, CURRENT } = await import(pathToFileURL(path.join(ROOT, "test/guvenilirlik/surumler.mjs")).href);
const W = "/api/workspace";
const dirs = { dataDir: path.join(DATA, "data"), backupDir: path.join(DATA, "backups") };
const must = async (label, p) => {
  const r = await p;
  if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  return r.data;
};
const r2 = v => Math.round(Number(v) * 100) / 100;

if (MODE === "uret") {
  const server = await bootVersion("v2.4.9", { ...dirs, now: { time: "2026-09-01T12:00:00+03:00", fixed: true } });
  const api = await server.login();
  let minute = 0;
  let day = "2026-09-01";
  const at = d => { day = d; minute = 0; server.app.config.now.set(`${d}T12:00:00+03:00`); };
  const tick = () => server.app.config.now.set(`${day}T12:${String((minute += 1)).padStart(2, "0")}:00+03:00`);
  const acc = async name => (tick(), (await must("cari", api.post(`${W}/accounts`, { name, type: "customer", registeredOn: "2026-08-01" }))).id);
  const sale = async (A, date, qty, payment = { rest: "account" }) => (tick(), (await must("satış", api.post(`${W}/invoices`, { scenario: "goods_sale", accountId: A, issueDate: date, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment }))).id);
  const cover = async (A, total, firstDue, registeredOn) => (tick(), (await must("kart", api.post(`${W}/plans`, { accountId: A, name: `K ${A.slice(-4)} ${minute}`, total: String(total), registeredOn, mode: "auto", count: 3, firstDue, coversBalance: true }))).id);
  const pay = async (A, amount, invoiceId = "") => (tick(), must("tahsilat", api.post(`${W}/accounts/${A}/entries`, { kind: "in", amount: String(amount), date: day, method: "cash", note: "t", ...(invoiceId ? { invoiceId } : {}) })));
  const giveBack = async (A, f, qty) => {
    tick();
    const line = (await must("fatura", api.get(`${W}/invoices/${f}`))).lines[0].id;
    return must("iade", api.post(`${W}/invoices`, { kind: "sale_return", accountId: A, originalId: f, issueDate: day, lines: [{ originLineId: line, qty }], payment: { cash: [] }, force: true }));
  };
  const classes = [];
  // Her sınıf: kurulum 01.09 / 02.09, ödeme 20.10.
  const make = async (name, fn) => { at("2026-09-01"); const A = await acc(name); await fn(A); classes.push(name); };
  await make("C0 kartsız + bağlı 600", async A => { const f = await sale(A, "2026-09-01", 3); at("2026-10-20"); await pay(A, 600, f); });
  await make("C0b kartsız + bağlı 1200 (fazla)", async A => { const f = await sale(A, "2026-09-01", 3); at("2026-10-20"); await pay(A, 1200, f); });
  await make("C0c kartsız + bağsız 600", async A => { await sale(A, "2026-09-01", 3); at("2026-10-20"); await pay(A, 600); });
  await make("C0d taksitli fatura + kart tahsilatı 300", async A => {
    const f = (tick(), (await must("taksitli", api.post(`${W}/invoices`, { scenario: "goods_sale", accountId: A, issueDate: "2026-09-01", lines: [{ name: "Mal", qty: 3, unitPrice: 250, vatRate: 20 }], payment: { rest: "installments", installments: { count: 3, firstDue: "2026-10-05" } } }))));
    at("2026-10-20");
    tick();
    await must("kart tahsilatı", api.post(`${W}/plans/${f.planId}/entries`, { kind: "in", amount: "300", date: "2026-10-20", method: "cash" }));
  });
  for (const amount of [300, 600, 900, 1200]) await make(`C1 kart + bağlı ${amount}`, async A => { const f = await sale(A, "2026-09-01", 3); at("2026-09-02"); await cover(A, 600, "2026-10-05", "2026-09-02"); at("2026-10-20"); await pay(A, amount, f); });
  await make("C2 kart + bağsız 900", async A => { await sale(A, "2026-09-01", 3); at("2026-09-02"); await cover(A, 600, "2026-10-05", "2026-09-02"); at("2026-10-20"); await pay(A, 900); });
  await make("C3 bağlı 600 → kart 300", async A => { const f = await sale(A, "2026-09-01", 3); at("2026-09-02"); await pay(A, 600, f); await cover(A, 300, "2026-10-05", "2026-09-02"); });
  await make("C4 kart + iade 300 → bağlı 600", async A => { const f = await sale(A, "2026-09-01", 3); at("2026-09-02"); await cover(A, 600, "2026-10-05", "2026-09-02"); at("2026-10-19"); await giveBack(A, f, 1); at("2026-10-20"); await pay(A, 600, f); });
  await make("C5 kart + bağlı 600 → iade 300", async A => { const f = await sale(A, "2026-09-01", 3); at("2026-09-02"); await cover(A, 600, "2026-10-05", "2026-09-02"); at("2026-10-19"); await pay(A, 600, f); at("2026-10-20"); await giveBack(A, f, 1); });
  await make("C6 kart tamamı + bağlı 600", async A => { const f = await sale(A, "2026-09-01", 2); at("2026-09-02"); await cover(A, 600, "2026-10-05", "2026-09-02"); at("2026-10-20"); await pay(A, 600, f); });
  await make("C7 kart + çek F'ye bağlı 600", async A => {
    const f = await sale(A, "2026-09-01", 3); at("2026-09-02"); await cover(A, 600, "2026-10-05", "2026-09-02"); at("2026-10-20");
    tick();
    await must("çek", api.post(`${W}/cheques`, { instrument: "cheque", direction: "in", accountId: A, amount: "600", issueDate: "2026-10-20", dueDate: "2026-12-20", serialNo: `V249-${A.slice(-6)}`, bank: "Ziraat", invoiceId: f }));
  });
  await server.close();
  console.log(JSON.stringify({ uretildi: classes }));
} else {
  const server = await bootVersion(CURRENT, { ...dirs, now: { time: "2026-10-20T18:00:00+03:00", fixed: true } });
  const api = await server.login();
  const store = server.app.store;
  const rows = store.all("SELECT id, name FROM accounts WHERE deleted_at IS NULL ORDER BY name");
  const lists = (await must("Taksitler", api.get(`${W}/plans?status=all`))).plans;
  const out = [];
  for (const { id, name } of rows) {
    const d = await must("cari", api.get(`${W}/accounts/${id}`));
    const t = d.totals;
    const cards = [];
    for (const p of d.plans || []) {
      const v = await must("kart", api.get(`${W}/plans/${p.id}`));
      const l = lists.find(x => x.id === p.id);
      cards.push({ total: v.total, paid: v.totals.paid, left: v.totals.remaining, items: v.items.map(i => i.remaining), cari: [p.totals.paid, p.totals.remaining], liste: l ? [l.totals.paid, l.totals.remaining] : null });
    }
    const docs = [];
    for (const row of store.all("SELECT id, account_id AS accountId, try_payable AS tryPayable, plan_id AS planId, payment_json AS paymentJson, kind, status FROM invoices WHERE account_id = ? ORDER BY rowid", id)) {
      const doc = await must("fatura", api.get(`${W}/invoices/${row.id}`));
      const st = server.app.context.invoices.cardLedgerState(row);
      docs.push({ kind: row.kind, state: doc.payState, open: doc.open, own: doc.ownOpen ?? null, inPlan: doc.inPlan ?? null, defter: { open: r2(st.open), excess: r2(st.excess), covered: r2(st.covered || 0) } });
    }
    out.push({ name, balance: t.balance, overdueDebt: t.overdueDebt, overdueInstallments: t.overdueInstallments, planRemaining: t.planRemaining, cards, docs });
  }
  const ok = (await must("Mutabakat", api.get(`${W}/ledger/integrity`))).ok;
  await server.close();
  for (const row of out) console.log(JSON.stringify(row));
  console.log(JSON.stringify({ mutabakat: ok }));
}
