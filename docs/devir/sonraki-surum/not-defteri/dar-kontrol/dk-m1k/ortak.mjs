// Dar kontrol KDV küçük tur 1–4 — ortak düzenek. ROOT=<kod kopyası> ile yeni / eski kodda aynı betik.
import assert from "node:assert/strict";
const ROOT = process.env.ROOT;
if (!ROOT) throw new Error("ROOT yok");
const { boot, must } = await import(`${ROOT}/test/banka-210-ortak.mjs`);
const RC = "/api/workspace/report-center";
const INV = "/api/workspace/invoices";
const TAX = "/api/workspace/tax";
export const RESULT_LABELS = ["Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme Devreden KDV"];
const DOC_KINDS = ["Satış", "Serbest Meslek Makbuzu", "Satıştan İade", "Alış", "Alıştan İade"];
export const minor = text => {
  const raw = String(text ?? "").trim();
  if (!/TL$/.test(raw)) return null;
  const sign = /^[-−]/.test(raw) ? -1 : 1;
  return sign * Number(raw.replace(/[^\d,]/g, "").replace(",", ""));
};
const qs = query => new URLSearchParams(query).toString();
export const monthRange = month => {
  const [year, m] = month.split("-").map(Number);
  return { from: `${month}-01`, to: new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10) };
};
const amp = (url, q) => (q ? `${url}${url.includes("?") ? "&" : "?"}${q}` : url);
export async function program(now, prefix) {
  const ctx = await boot({ now, maxCompanies: 2 });
  const api = ctx.api;
  const ids = {};
  ids.M = (await must("müşteri", api.post("/api/workspace/accounts", { name: `${prefix} Müşteri`, type: "customer", registeredOn: "2025-01-01" }))).id;
  ids.T = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: `${prefix} Tedarikçi`, type: "supplier", registeredOn: "2025-01-01" }))).id;
  let n = 0;
  const h = {
    ctx, api,
    buy: async (date, net, extra = {}) => (await must(`alış ${date}`, api.post(INV, { kind: "purchase", scenario: "expense_purchase", accountId: ids.T, issueDate: date, number: `${prefix}-A${(n += 1)}`, lines: [{ name: "Kırtasiye", qty: 1, unitPrice: net, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" }, ...extra }))).id,
    sell: async (date, net) => (await must(`satış ${date}`, api.post(INV, { scenario: "service_sale", accountId: ids.M, issueDate: date, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: net, vatRate: 20 }], payment: { rest: "open" } }))).id,
    cancel: async id => must(`İptal Et`, api.post(`${INV}/${id}/cancel`, { reason: "Hatalı fatura", force: true })),
    offset: async month => {
      const r = await api.post(`${TAX}/vat-offset`, { month });
      if (r.status !== 200) return { status: r.status, error: JSON.stringify(r.data).slice(0, 300) };
      const o = r.data.offset;
      return [o.carryInMinor, o.payableMinor, o.carryOutMinor];
    },
    reverse: async month => {
      const list = (await must("mahsup listesi", api.get(`${TAX}/vat-offset`))).offsets;
      const row = list.find(item => item.month === month && item.status === "active");
      assert.ok(row, `${month} etkin fiş`);
      return must(`geri al ${month}`, api.post(`${TAX}/vat-offset/${row.id}/reverse`, {}));
    },
    offsets: async () => (await must("mahsup listesi", api.get(`${TAX}/vat-offset`))).offsets.filter(item => item.status === "active").map(item => [item.month, item.carryInMinor, item.payableMinor, item.carryOutMinor, item.stale]),
    preview: async month => {
      const p = (await must(`ön izleme ${month}`, api.get(`${TAX}/vat-offset?month=${month}`))).preview;
      return [p.carryInMinor, p.payableMinor, p.carryOutMinor];
    },
    report: async query => {
      const res = await api.get(`${RC}/kdv-ozeti?${qs(query)}`);
      assert.equal(res.status, 200, `${qs(query)}: ${res.status}`);
      const data = res.data;
      const summary = Object.fromEntries(data.summary);
      const g = data.headers.indexOf("Belge Türü");
      const k = data.headers.indexOf("KDV");
      const three = RESULT_LABELS.map(name => minor(summary[name]));
      const lines = data.rows.filter(row => !DOC_KINDS.includes(row[g])).map(row => `${row[0]}:${row[g]}=${minor(row[k])}`);
      const notes = Object.fromEntries(data.summary.filter(([, v]) => minor(v) === null));
      return { data, summary, three, lines, notes, h391: minor(summary["Hesaplanan KDV (391) (İadeler Düşülmüş)"]), h191: minor(summary["İndirilecek KDV (191) (İadeler Düşülmüş)"]) };
    },
  };
  return h;
}
export const show = (label, r) => {
  const bal = r.three[1] - r.three[2] + r.three[0];
  console.log(`${label}: Önceki/Ödenecek/Sonraki = ${r.three.join(" / ")} · 391 ${r.h391} − 191 ${r.h191} = ${r.h391 - r.h191} · Ödenecek−Sonraki+Önceki = ${bal} ${bal === r.h391 - r.h191 ? "EŞİT" : `SAPMA ${bal - (r.h391 - r.h191)}`}`);
  for (const l of r.lines) console.log(`   satır ${l}`);
  for (const [k, v] of Object.entries(r.notes)) console.log(`   not [${k}] ${v}`);
};
