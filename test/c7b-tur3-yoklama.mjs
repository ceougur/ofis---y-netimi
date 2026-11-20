// Ç7b tur 3 — bugünkü davranışın yeniden üretimi (ders 6). Test değildir; `node test/c7b-tur3-yoklama.mjs` çıktısı tasarım ekine (docs/erp/C7B-FATURA-TASARIM.md §16) yazılır.
import { must } from "./banka-210-ortak.mjs";
import { bootBank } from "./banka-210-hesap-ortak.mjs";

const ctx = await bootBank();
const { api, store } = ctx;
const W = "/api/workspace";
const out = {};
const acc = async name => (await must("cari", api.post(`${W}/accounts`, { name, type: "customer", registeredOn: "2026-08-01" }))).id;
const view = async (id, extra = {}) => {
  const t = (await must("cari kartı", api.get(`${W}/accounts/${id}`))).totals || {};
  return { bakiye: t.balance, gecikmis: t.overdueDebt, kartKalan: t.planRemaining, ...extra };
};
const trial = async () => Object.fromEntries((await must("mizan", api.get(`${W}/ledger`))).trial.accounts.map(r => [r.code, r.balance]));
const items = async id => (await must("kart", api.get(`${W}/plans/${id}`))).items.map(i => `${i.dueDate}:${i.amount}/${i.remaining}`);
const sale = async (accountId, date, gross, payment) => (await must("satış", api.post(`${W}/invoices`, { scenario: "service_sale", accountId, issueDate: date, lines: [{ name: "Hizmet", qty: 1, unitPrice: gross / 1.2, vatRate: 20 }], payment }))).id;
const pay = async (planId, amount, date) => must("taksit tahsilatı", api.post(`${W}/plans/${planId}/entries`, { kind: "in", amount: String(amount), date, method: "cash" }));
const invoice = async id => must("fatura", api.get(`${W}/invoices/${id}`));
const planOf = id => store.get("SELECT plan_id AS p FROM invoices WHERE id = ?", id).p;
try {
  // A — Kartı Kapat (kalan varken): Yeni Borç kartı 900 (3 × 300; 05.10 / 05.11 / 05.12), 05.10 tahsilat 300, 08.10 Kartı Kapat; sonra 12.10.
  const A = await acc("Kapat Müşterisi");
  const pA = (await must("kart", api.post(`${W}/plans`, { accountId: A, name: "Kart A", total: "900", registeredOn: "2026-09-20", mode: "auto", count: 3, firstDue: "2026-10-05" }))).id;
  await pay(pA, 300, "2026-10-05");
  out.A_once = await view(A);
  const m0 = await trial();
  const closed = await api.put(`${W}/plans/${pA}`, { status: "closed", closeRemaining: 600 });
  out.A_kapat = closed.status;
  out.A_sonra = await view(A);
  const m1 = await trial();
  out.A_mizan = { 120: [m0["120"], m1["120"]], 689: [m0["689"] || 0, m1["689"] || 0] };
  ctx.server.clock.set("2026-10-12T12:00:00+03:00");
  out.A_12_10 = await view(A);
  ctx.server.clock.set("2026-10-08T12:00:00+03:00");
  // B — S15: taksitli fatura 900 (3 × 300), kendi kartına 05.10 tahsilat 300, İptal Et.
  const B = await acc("Iptal Müşterisi");
  const fB = await sale(B, "2026-10-01", 900, { rest: "installments", installments: { count: 3, firstDue: "2026-10-05" } });
  const pB = planOf(fB);
  await pay(pB, 300, "2026-10-05");
  out.B_once = await view(B);
  const cB = await api.post(`${W}/invoices/${fB}/cancel`, { reason: "deneme" });
  out.B_iptal = { status: cB.status, code: cB.data?.code, error: cB.data?.error };
  out.B_sonra = await view(B, { kart: store.get("SELECT status, total, deleted_at AS d FROM plans WHERE id = ?", pB) });
  // C — S206: fatura 900 açık, Mevcut Borç kartı 900 (3 × 300), kart tahsilatı 300, fatura İptal Et, sonra 500'lük fatura.
  const C = await acc("Mevcut Müşterisi");
  const fC = await sale(C, "2026-10-01", 900, { rest: "open" });
  const pC = (await must("kart", api.post(`${W}/plans`, { accountId: C, name: "Kart C", total: "900", registeredOn: "2026-10-02", mode: "auto", count: 3, firstDue: "2026-10-05", coversBalance: true }))).id;
  await pay(pC, 300, "2026-10-05");
  const cC = await api.post(`${W}/invoices/${fC}/cancel`, { reason: "deneme" });
  out.C_iptal = { status: cC.status, code: cC.data?.code };
  out.C_sonra = await view(C, { kart: store.get("SELECT status, total FROM plans WHERE id = ?", pC), kartKalemleri: await items(pC) });
  const fC2 = await sale(C, "2026-10-06", 500, { rest: "open" });
  const i500 = await invoice(fC2);
  out.C_500 = await view(C, { fatura500: { open: i500.open, settle: i500.settlement?.open, keys: Object.keys(i500).join(",") } });
  // D — küçülme: taksitli fatura 900 (3 × 300; 05.10 / 05.11 / 05.12), 05.10 tahsilat 300, iade 300 (kalemin 1/3'ü).
  const D = await acc("Iade Müşterisi");
  const fD = (await must("satış", api.post(`${W}/invoices`, { scenario: "goods_sale", accountId: D, issueDate: "2026-10-06", lines: [{ name: "Mal", qty: 3, unitPrice: 250, vatRate: 20 }], payment: { rest: "installments", installments: { count: 3, firstDue: "2026-10-06" } } }))).id;
  const pD = planOf(fD);
  await pay(pD, 300, "2026-10-06");
  out.D_once = await items(pD);
  const line = (await invoice(fD)).lines[0].id;
  const rD = await api.post(`${W}/invoices`, { kind: "sale_return", accountId: D, originalId: fD, issueDate: "2026-10-07", lines: [{ originLineId: line, qty: 1 }], payment: { cash: [] }, force: true });
  out.D_iade = `${rD.status} ${rD.data?.error || ""}`;
  out.D_sonra = await items(pD);
  out.D_cari = await view(D);
  out.mutabakat = (await must("mutabakat", api.get(`${W}/ledger/integrity`))).ok;
} finally {
  ctx.server.close();
}
console.log(JSON.stringify(out, null, 1));
