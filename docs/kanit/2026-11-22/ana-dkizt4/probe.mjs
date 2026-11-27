// Dar kontrol izt4 — senaryo sondası. ROOT=<kod kökü> node probe.mjs [senaryo adları...] → JSON satırları.
import path from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.env.ROOT;
const imp = p => import(pathToFileURL(path.join(ROOT, p)).href);
const { must } = await imp("test/banka-210-ortak.mjs");
const { bootBank } = await imp("test/banka-210-hesap-ortak.mjs");
const W = "/api/workspace";

async function world(start, fn) {
  const ctx = await bootBank({ now: { time: `${start}T12:00:00+03:00`, fixed: true } });
  try {
    return await fn(helpers(ctx.api, ctx.store, iso => ctx.server.clock.set(iso), () => ctx.app.context.invoices, start, ctx));
  } finally {
    ctx.server.close();
  }
}
function helpers(api, store, setClock, invoicesOf, start, ctx) {
  let minute = 0;
  let day = start;
  const at = d => { day = d; minute = 0; setClock(`${d}T12:00:00+03:00`); };
  const tick = () => setClock(`${day}T12:${String((minute += 1)).padStart(2, "0")}:00+03:00`);
  const h = {
    api, store, ctx, at, tick, get day() { return day; },
    acc: async (name, type = "customer") => (await must("cari", api.post(`${W}/accounts`, { name, type, registeredOn: "2026-08-01" }))).id,
    goods: async (accountId, date, qty, extra = {}) => (tick(), (await must("satış", api.post(`${W}/invoices`, { scenario: "goods_sale", accountId, issueDate: date, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment: { rest: "account" }, ...extra }))).id),
    buy: async (accountId, date, qty) => (tick(), (await must("alış", api.post(`${W}/invoices`, { scenario: "goods_purchase", accountId, number: `AL-${day}-${minute}`, issueDate: date, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment: { rest: "account" }, force: true }))).id),
    cover: async (accountId, total, firstDue, registeredOn, count = 3) => (tick(), (await must("kart", api.post(`${W}/plans`, { accountId, name: `K ${day} ${minute}`, total: String(total), registeredOn, mode: "auto", count, firstDue, coversBalance: true }))).id),
    coverRaw: async (accountId, total, firstDue, registeredOn, count = 3) => (tick(), api.post(`${W}/plans`, { accountId, name: `K ${day} ${minute}`, total: String(total), registeredOn, mode: "auto", count, firstDue, coversBalance: true })),
    linked: async (accountId, invoiceId, amount, date = day, kind = "in") => (tick(), (await must("bağlı", api.post(`${W}/accounts/${accountId}/entries`, { kind, amount: String(amount), date, method: "cash", invoiceId, note: "fatura tahsilatı" }))).entryId),
    linkedRaw: (accountId, invoiceId, amount, date = day, kind = "in") => (tick(), api.post(`${W}/accounts/${accountId}/entries`, { kind, amount: String(amount), date, method: "cash", invoiceId, note: "fatura tahsilatı" })),
    free: async (accountId, amount, date = day, kind = "in") => (tick(), (await must("bağsız", api.post(`${W}/accounts/${accountId}/entries`, { kind, amount: String(amount), date, method: "cash", note: "bağsız" }))).entryId),
    debt: async (accountId, amount, date = day, dueDate = "") => (tick(), (await must("borç yaz", api.post(`${W}/accounts/${accountId}/entries`, { kind: "debt", amount: String(amount), date, note: "elle", ...(dueDate ? { dueDate } : {}) }))).entryId),
    put: (accountId, entryId, body) => (tick(), api.put(`${W}/accounts/${accountId}/entries/${entryId}`, body)),
    del: (accountId, entryId) => (tick(), api.del(`${W}/accounts/${accountId}/entries/${entryId}`)),
    cardPay: async (planId, amount, date = day) => (tick(), must("kart tahsilatı", api.post(`${W}/plans/${planId}/entries`, { kind: "in", amount: String(amount), date, method: "cash" }))),
    giveBack: async (invoiceId, accountId, qty) => {
      tick();
      const line = (await must("fatura", api.get(`${W}/invoices/${invoiceId}`))).lines[0].id;
      return (await must("iade", api.post(`${W}/invoices`, { kind: "sale_return", accountId, originalId: invoiceId, issueDate: day, lines: [{ originLineId: line, qty }], payment: { cash: [] }, force: true }))).id;
    },
    cancel: id => (tick(), must("iptal", api.post(`${W}/invoices/${id}/cancel`, { reason: "x" }))),
    edit: async (id, qty) => {
      tick();
      const d = await must("fatura", api.get(`${W}/invoices/${id}`));
      return api.post(`${W}/invoices/${id}/edit`, { scenario: d.scenario, accountId: d.accountId, issueDate: d.issueDate, lines: [{ name: "Mal", qty, unitPrice: 250, vatRate: 20 }], payment: { rest: "account" }, force: true });
    },
    cheque: async (accountId, amount, invoiceId, serial, extra = {}) => (tick(), must("evrak", api.post(`${W}/cheques`, { instrument: "cheque", direction: "in", accountId, amount: String(amount), issueDate: day, dueDate: "2026-12-20", serialNo: serial, bank: "Ziraat", ...(invoiceId ? { invoiceId } : {}), ...extra }))),
    chequeAct: async (id, action, extra = {}) => {
      tick();
      const c = await must("evrak", api.get(`${W}/cheques/${id}`));
      return api.post(`${W}/cheques/${id}/actions`, { action, date: day, status: c.status ?? c.cheque?.status, ...extra });
    },
    views: async (accountId, planId) => {
      const v = await must("kart", api.get(`${W}/plans/${planId}`));
      const s = (await must("cari", api.get(`${W}/accounts/${accountId}`))).plans.find(x => x.id === planId);
      const l = (await must("Taksitler", api.get(`${W}/plans?status=all`))).plans.find(x => x.id === planId);
      return { w: [v.total, v.totals.paid, v.totals.remaining], s: s ? [s.totals.paid, s.totals.remaining] : null, l: l ? [l.totals.paid, l.totals.remaining] : null, items: v.items.map(i => `${i.dueDate.slice(5)}:${i.remaining}`), status: v.status };
    },
    totals: async accountId => (await must("cari", api.get(`${W}/accounts/${accountId}`))).totals,
    doc: id => must("fatura kartı", api.get(`${W}/invoices/${id}`)),
    ledger: id => {
      const row = store.get("SELECT id, account_id AS accountId, try_payable AS tryPayable, plan_id AS planId, payment_json AS paymentJson, kind, status FROM invoices WHERE id = ?", id);
      return invoicesOf().cardLedgerState(row);
    },
    ok: async () => (await must("Mutabakat Testi", api.get(`${W}/ledger/integrity`))).ok,
  };
  return h;
}

async function snap(h, A, { plans = [], invoices = [], name = "" } = {}) {
  const out = { plans: {}, inv: {} };
  for (const [label, id] of Object.entries(plans)) out.plans[label] = await h.views(A, id).catch(e => `HATA ${e.message}`.slice(0, 120));
  const t = await h.totals(A);
  out.t = { bal: t.balance, od: t.overdueDebt, odI: t.overdueInstallments, pR: t.planRemaining };
  for (const [label, id] of Object.entries(invoices)) {
    const d = await h.doc(id);
    let led = null;
    try { const l = h.ledger(id); led = { cov: l.coveredBy || {}, ex: l.excess, open: l.open }; } catch (e) { led = String(e.message).slice(0, 80); }
    out.inv[label] = { st: d.payState, open: d.open, led };
  }
  const vade = await must("Vade Takip", h.api.get(`${W}/overview/vade-takip?from=2025-01-01&to=2027-12-31`));
  const rows = vade.rows.filter(r => r.accountId === A);
  out.vade = rows.map(r => `${r.source}:${r.date.slice(5)}:${r.amount}`).sort();
  out.vadeSum = Math.round(rows.reduce((s, r) => s + Number(r.amount), 0) * 100) / 100;
  const flow = await must("Nakit Akışı", h.api.get(`${W}/overview/nakit-akisi?from=2025-01-01&to=2027-12-31`));
  const fr = flow.rows.filter(r => r.accountId === A);
  out.flowSum = Math.round(fr.reduce((s, r) => s + Number(r.amount) * (r.direction === "in" ? 1 : -1), 0) * 100) / 100;
  out.flowOd = (flow.overdue || []).filter(r => r.accountId === A).map(r => `${r.source}:${r.amount}`);
  if (name) {
    const af = await must("Açık Faturalar", h.api.get(`${W}/report-center/acik-faturalar`)).catch(() => null);
    if (af) out.acik = af.rows.filter(r => r.some(c => String(c).includes(name))).map(r => r.join("|"));
    const ag = await must("Alacak Yaşlandırma", h.api.get(`${W}/report-center/alacak-yaslandirma`)).catch(() => null);
    if (ag) { const i = ag.headers.indexOf("Toplam"); const line = ag.rows.find(r => r[0] === name); out.aging = line ? line[i] : null; }
  }
  out.ok = await h.ok();
  return out;
}

// Taban: F 900 (01.09), elle Mevcut Borç kartı 600 (02.09), gün 20.10.
async function base(h, name, { qty = 3, total = 600 } = {}) {
  const A = await h.acc(name);
  const f = await h.goods(A, "2026-09-01", qty);
  h.at("2026-09-02");
  const k = await h.cover(A, total, "2026-10-05", "2026-09-02");
  h.at("2026-10-20");
  return { A, f, k };
}

const S = {};
// PUT: bağlı 300 → tutar 600 (aynı fatura). Beklenen = bağlı 600: kart 300/300, bakiye 300.
S.put_amount = h => run(h, "PUT 300→600", async (n) => { const { A, f, k } = await base(h, n); const e = await h.linked(A, f, 300); h.at("2026-10-21"); const r = await h.put(A, e, { kind: "in", amount: "600", method: "cash", invoiceId: f, date: "2026-10-20" }); return { A, f, k, st: r.status }; });
S.fresh600 = h => run(h, "bağlı 600", async (n) => { const { A, f, k } = await base(h, n); await h.linked(A, f, 600); return { A, f, k }; });
// PUT: bağsız 600 → bağ F eklenir. Beklenen: bağlı 600 ile aynı.
S.put_addlink = h => run(h, "PUT bağ ekle", async (n) => { const { A, f, k } = await base(h, n); const e = await h.free(A, 600); h.at("2026-10-21"); const r = await h.put(A, e, { kind: "in", amount: "600", method: "cash", invoiceId: f, date: "2026-10-20" }); return { A, f, k, st: r.status }; });
// PUT: bağlı 900 → bağ kaldırılır (bağsız 900).
S.put_droplink = h => run(h, "PUT bağ kaldır", async (n) => { const { A, f, k } = await base(h, n); const e = await h.linked(A, f, 900); h.at("2026-10-21"); const r = await h.put(A, e, { kind: "in", amount: "900", method: "cash", invoiceId: "", date: "2026-10-20" }); return { A, f, k, st: r.status }; });
// PUT: bağlı 600 F → başka fatura F2'ye taşınır.
S.put_move = h => run(h, "PUT bağ F→F2", async (n) => { const { A, f, k } = await base(h, n); const f2 = await h.goods(A, "2026-10-20", 2); const e = await h.linked(A, f, 600); h.at("2026-10-21"); const r = await h.put(A, e, { kind: "in", amount: "600", method: "cash", invoiceId: f2, date: "2026-10-20" }); return { A, f, k, f2, st: r.status }; });
// Elle borç vadesi kartın ilk taksitinden ÖNCE (15.09), kart açıldıktan SONRA yazılmış: bağlı 600 → gösterilen 300 + fazlası 300 elle borca (vade 15.09 < 05.10).
S.debt_early = h => run(h, "elle borç erken vade", async (n) => { const { A, f, k } = await base(h, n); h.at("2026-09-15"); await h.debt(A, 500, "2026-09-15", "2026-09-15"); h.at("2026-10-20"); await h.linked(A, f, 600); return { A, f, k }; });
S.debt_early_free = h => run(h, "elle borç erken vade (bağsız)", async (n) => { const { A, f, k } = await base(h, n); h.at("2026-09-15"); await h.debt(A, 500, "2026-09-15", "2026-09-15"); h.at("2026-10-20"); await h.free(A, 600); return { A, f, k }; });
// Elle borç vadesi geç (20.11): fazlası kartın 05.10'una.
S.debt_late = h => run(h, "elle borç geç vade", async (n) => { const { A, f, k } = await base(h, n); h.at("2026-09-15"); await h.debt(A, 500, "2026-09-15", "2026-11-20"); h.at("2026-10-20"); await h.linked(A, f, 600); return { A, f, k }; });
S.debt_late_free = h => run(h, "elle borç geç vade (bağsız)", async (n) => { const { A, f, k } = await base(h, n); h.at("2026-09-15"); await h.debt(A, 500, "2026-09-15", "2026-11-20"); h.at("2026-10-20"); await h.free(A, 600); return { A, f, k }; });
// Başka fatura F2 (vade 20.09) karttan sonra: fazlası F2'ye.
S.f2_early = h => run(h, "F2 erken", async (n) => { const { A, f, k } = await base(h, n); h.at("2026-09-20"); const f2 = await h.goods(A, "2026-09-20", 2); h.at("2026-10-20"); await h.linked(A, f, 600); return { A, f, k, f2 }; });
S.f2_early_free = h => run(h, "F2 erken (bağsız)", async (n) => { const { A, f, k } = await base(h, n); h.at("2026-09-20"); const f2 = await h.goods(A, "2026-09-20", 2); h.at("2026-10-20"); await h.free(A, 600); return { A, f, k, f2 }; });
// Kart tahsilatı 200 sonra bağlı 600.
S.cardpay_then = h => run(h, "kart tahsilatı 200 → bağlı 600", async (n) => { const { A, f, k } = await base(h, n); await h.cardPay(k, 200); h.at("2026-10-21"); await h.linked(A, f, 600); return { A, f, k }; });
S.then_cardpay = h => run(h, "bağlı 600 → kart tahsilatı 300", async (n) => { const { A, f, k } = await base(h, n); await h.linked(A, f, 600); h.at("2026-10-21"); await h.cardPay(k, 300); return { A, f, k }; });
// Kartı Kapat bağlı 600'den sonra.
S.close_after = h => run(h, "bağlı 600 → Kartı Kapat", async (n) => { const { A, f, k } = await base(h, n); await h.linked(A, f, 600); h.at("2026-10-21"); const r = await h.api.put(`${W}/plans/${k}`, { status: "closed" }); return { A, f, k, st: r.status }; });
S.close_after_free = h => run(h, "bağsız 600 → Kartı Kapat", async (n) => { const { A, f, k } = await base(h, n); await h.free(A, 600); h.at("2026-10-21"); const r = await h.api.put(`${W}/plans/${k}`, { status: "closed" }); return { A, f, k, st: r.status }; });
// Kart silme bağlı 600'den sonra.
S.del_card = h => run(h, "bağlı 600 → kart sil", async (n) => { const { A, f, k } = await base(h, n); await h.linked(A, f, 600); h.at("2026-10-21"); const r = await h.api.del(`${W}/plans/${k}`); return { A, f, st: r.status, msg: String(r.error || "").slice(0, 100) }; });
// Üç parça bağlı 200 + 200 + 200 = 600.
S.split3 = h => run(h, "bağlı 3×200", async (n) => { const { A, f, k } = await base(h, n); await h.linked(A, f, 200); await h.linked(A, f, 200); await h.linked(A, f, 200); return { A, f, k }; });
// Geriye tarihli bağlı 600 (tarih 01.09 — kartın Kayıt Tarihi'nden önce, yazımı sonra) ↔ geriye tarihli bağsız 600.
S.back_linked = h => run(h, "geriye tarihli bağlı 600 (01.09)", async (n) => { const { A, f, k } = await base(h, n); await h.linked(A, f, 600, "2026-09-01"); return { A, f, k }; });
S.back_free = h => run(h, "geriye tarihli bağsız 600 (01.09)", async (n) => { const { A, f, k } = await base(h, n); await h.free(A, 600, "2026-09-01"); return { A, f, k }; });
S.back_linked900 = h => run(h, "geriye tarihli bağlı 900 (01.09)", async (n) => { const { A, f, k } = await base(h, n); await h.linked(A, f, 900, "2026-09-01"); return { A, f, k }; });
S.back_free900 = h => run(h, "geriye tarihli bağsız 900 (01.09)", async (n) => { const { A, f, k } = await base(h, n); await h.free(A, 900, "2026-09-01"); return { A, f, k }; });
// Bağlı ödeme tarih ileri (05.11, bugün 20.10).
S.fwd_linked = h => run(h, "ileri tarihli bağlı 600 (05.12)", async (n) => { const { A, f, k } = await base(h, n); await h.linked(A, f, 600, "2026-12-05"); return { A, f, k }; });
// İki kart, iki fatura: F1 600, F2 600 (aynı gün), kart 900.
S.two_inv = h => run(h, "F1+F2, kart 900, bağlı F2 600", async (n) => { const A = await h.acc(n); const f1 = await h.goods(A, "2026-09-01", 2); const f2 = await h.goods(A, "2026-09-01", 2); h.at("2026-09-02"); const k = await h.cover(A, 900, "2026-10-05", "2026-09-02"); h.at("2026-10-20"); await h.linked(A, f2, 600); return { A, f: f1, f2, k }; });
S.two_inv_b = h => run(h, "F1+F2, kart 900, bağlı F1 600", async (n) => { const A = await h.acc(n); const f1 = await h.goods(A, "2026-09-01", 2); const f2 = await h.goods(A, "2026-09-01", 2); h.at("2026-09-02"); const k = await h.cover(A, 900, "2026-10-05", "2026-09-02"); h.at("2026-10-20"); await h.linked(A, f1, 600); return { A, f: f1, f2, k }; });
// Çek akışı: bağlı çek 600 → Tahsile ver/collect → karşılıksız.
S.cheque_flow = async h => {
  const n = "çek akışı";
  const { A, f, k } = await base(h, n);
  const steps = {};
  const c = await h.cheque(A, 600, f, "DK-C1");
  const id = c.id || c.cheque?.id;
  steps.alindi = await snap(h, A, { plans: { k }, invoices: { f }, name: n });
  h.at("2026-10-25");
  const r1 = await h.chequeAct(id, "collect");
  steps.collect = { st: r1.status, err: r1.error, ...(await snap(h, A, { plans: { k }, invoices: { f }, name: n })) };
  return steps;
};
S.cheque_bounce = async h => {
  const n = "çek karşılıksız";
  const { A, f, k } = await base(h, n);
  const steps = {};
  const c = await h.cheque(A, 600, f, "DK-C2");
  const id = c.id || c.cheque?.id;
  h.at("2026-10-25");
  const r1 = await h.chequeAct(id, "bounce");
  steps.bounce = { st: r1.status, err: r1.error, ...(await snap(h, A, { plans: { k }, invoices: { f }, name: n })) };
  return steps;
};
S.cheque_endorse = async h => {
  const n = "çek ciro";
  const { A, f, k } = await base(h, n);
  const sup = await h.acc("Tedarikçi DK", "supplier");
  const steps = {};
  const c = await h.cheque(A, 600, f, "DK-C3");
  const id = c.id || c.cheque?.id;
  h.at("2026-10-25");
  const r1 = await h.chequeAct(id, "endorse", { accountId: sup });
  steps.endorse = { st: r1.status, err: r1.error, ...(await snap(h, A, { plans: { k }, invoices: { f }, name: n })) };
  const r2 = await h.chequeAct(id, "bounce");
  steps.bounce = { st: r2.status, err: r2.error, ...(await snap(h, A, { plans: { k }, invoices: { f }, name: n })) };
  return steps;
};
// Tedarikçi: alış faturası 900, Mevcut Borç kartı dener + bağlı ödeme 600.
S.supplier = async h => {
  const n = "tedarikçi";
  const A = await h.acc(n, "supplier");
  const f = await h.buy(A, "2026-09-01", 3);
  h.at("2026-09-02");
  const kr = await h.coverRaw(A, 600, "2026-10-05", "2026-09-02");
  h.at("2026-10-20");
  await h.linked(A, f, 600, "2026-10-20", "out");
  const k = kr.status === 200 ? (kr.data?.id) : null;
  return { kr: kr.status, kerr: String(kr.error || "").slice(0, 80), ...(await snap(h, A, { plans: k ? { k } : {}, invoices: { f }, name: n })) };
};
// Kilit: bağsız 300 (25.09) → kilit 30.09 → bağlı 600 (20.10).
S.lock_free_first = h => run(h, "kilit + önce bağsız 300", async (n) => { const { A, f, k } = await base(h, n); h.at("2026-09-25"); await h.free(A, 300, "2026-09-25"); h.at("2026-10-20"); await must("kilit", h.api.put("/api/admin/period-lock", { lockedUntil: "2026-09-30" })); await h.linked(A, f, 600); return { A, f, k }; });
S.nolock_free_first = h => run(h, "kilitsiz + önce bağsız 300", async (n) => { const { A, f, k } = await base(h, n); h.at("2026-09-25"); await h.free(A, 300, "2026-09-25"); h.at("2026-10-20"); await h.linked(A, f, 600); return { A, f, k }; });
// Kilit sonrası: bağlı 600 (20.10), sonra kilit 31.10, sonra ikinci bağlı 300 (05.11).
S.lock_after = h => run(h, "bağlı 600 → kilit 31.10 → bağlı 300", async (n) => { const { A, f, k } = await base(h, n); await h.linked(A, f, 600); h.at("2026-11-05"); await must("kilit", h.api.put("/api/admin/period-lock", { lockedUntil: "2026-10-31" })); await h.linked(A, f, 300); return { A, f, k }; });
// Bağlı ödeme silinip Silinenler'den geri: kart 600'lük faturanın tamamını almış (F 600) — gösterilen 0.
S.full_card_del_restore = h => run(h, "F600 tam kartta: bağlı 600 sil + geri", async (n) => { const { A, f, k } = await base(h, n, { qty: 2 }); const e = await h.linked(A, f, 600); h.at("2026-10-21"); await h.del(A, e); const row = (await must("Silinenler", h.api.get("/api/admin/trash"))).find(x => x.ref === e); await h.api.post("/api/admin/trash/restore", { id: row.id }); return { A, f, k }; });
// İade iptali sonrası tekrar iade, Düzenle bağlı ödemeden SONRA.
S.edit_after = h => run(h, "bağlı 600 → Düzenle 900→600", async (n) => { const { A, f, k } = await base(h, n); await h.linked(A, f, 600); h.at("2026-10-21"); const r = await h.edit(f, 2); return { A, f, k, st: r.status, err: String(r.error || "").slice(0, 100) }; });
S.edit_after_free = h => run(h, "bağsız 600 → Düzenle 900→600", async (n) => { const { A, f, k } = await base(h, n); await h.free(A, 600); h.at("2026-10-21"); const r = await h.edit(f, 2); return { A, f, k, st: r.status, err: String(r.error || "").slice(0, 100) }; });
S.cancel_inv_after = h => run(h, "bağlı 600 → fatura İptal", async (n) => { const { A, f, k } = await base(h, n); await h.linked(A, f, 600); h.at("2026-10-21"); const r = await h.api.post(`${W}/invoices/${f}/cancel`, { reason: "x" }); return { A, f, k, st: r.status, err: String(r.error || "").slice(0, 120) }; });
S.cancel_inv_after_free = h => run(h, "bağsız 600 → fatura İptal", async (n) => { const { A, f, k } = await base(h, n); await h.free(A, 600); h.at("2026-10-21"); const r = await h.api.post(`${W}/invoices/${f}/cancel`, { reason: "x" }); return { A, f, k, st: r.status, err: String(r.error || "").slice(0, 120) }; });
// İade 600 (bağlı 600'den sonra) — kartın kısmına kadar.
S.return600_after = h => run(h, "bağlı 600 → iade 600", async (n) => { const { A, f, k } = await base(h, n); await h.linked(A, f, 600); h.at("2026-10-21"); await h.giveBack(f, A, 2); return { A, f, k }; });
S.return600_after_free = h => run(h, "bağsız 600 → iade 600", async (n) => { const { A, f, k } = await base(h, n); await h.free(A, 600); h.at("2026-10-21"); await h.giveBack(f, A, 2); return { A, f, k }; });
// Bağlı 1200 → iade 300 (fazla + iade).
S.over_return = h => run(h, "bağlı 1200 → iade 300", async (n) => { const { A, f, k } = await base(h, n); await h.linked(A, f, 1200); h.at("2026-10-21"); await h.giveBack(f, A, 1); return { A, f, k }; });
S.over_return_free = h => run(h, "bağsız 1200 → iade 300", async (n) => { const { A, f, k } = await base(h, n); await h.free(A, 1200); h.at("2026-10-21"); await h.giveBack(f, A, 1); return { A, f, k }; });
// Bağlı 600 ödeme gecikmiş taksitlerle: bugün 20.12 (iki taksit gecikmiş).
S.late_day = h => run(h, "bugün 20.12, bağlı 600", async (n) => { const { A, f, k } = await base(h, n); h.at("2026-12-20"); await h.linked(A, f, 600); return { A, f, k }; });
// Peşinli fatura + kart (peşin karttan önce).
S.prepaid_inv = h => run(h, "peşin 300'lü F 900 + kart 600 + bağlı 300", async (n) => { const A = await h.acc(n); const f = await h.goods(A, "2026-09-01", 3, { payment: { cash: [{ amount: "300", method: "cash" }], rest: "account" } }); h.at("2026-09-02"); const k = await h.cover(A, 600, "2026-10-05", "2026-09-02"); h.at("2026-10-20"); await h.linked(A, f, 300); return { A, f, k }; });

async function run(h, name, fn) {
  const r = await fn(name);
  const plans = {}; if (r.k) plans.k = r.k; if (r.k2) plans.k2 = r.k2;
  const invoices = { f: r.f }; if (r.f2) invoices.f2 = r.f2;
  const extra = {}; for (const key of ["st", "err", "msg"]) if (r[key] !== undefined) extra[key] = r[key];
  return { ...extra, ...(await snap(h, r.A, { plans, invoices, name })) };
}

const { more } = await import(new URL("./probe2.mjs", import.meta.url).href);
more(S, { base, snap, run, must, W });
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(S);
for (const name of names) {
  try {
    const out = await world("2026-09-01", h => S[name](h));
    console.log(JSON.stringify({ name, out }));
  } catch (e) {
    console.log(JSON.stringify({ name, error: String(e.stack || e).slice(0, 600) }));
  }
}
process.exit(0);
