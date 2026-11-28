// dk-m1k5 ortak yardımcılar: ROOT ortam değişkeniyle seçilen kodun (yeni / eski) test sunucusu; sayılar yanıt gövdesinden.
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.env.ROOT;
if (!ROOT) throw new Error("ROOT yok");
const { boot } = await import(pathToFileURL(path.join(ROOT, "test/banka-210-ortak.mjs")).href);

export const RC = "/api/workspace/report-center";
export const INV = "/api/workspace/invoices";
export const TAX = "/api/workspace/tax";
export const LABELS = ["Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme Devreden KDV"];
export const minor = text => {
  const raw = String(text ?? "").trim();
  if (!/TL$/.test(raw)) return null;
  const sign = /^[-−]/.test(raw) ? -1 : 1;
  return sign * Number(raw.replace(/[^\d,]/g, "").replace(",", ""));
};
export const monthEnd = month => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
};
const amp = (url, q) => (q ? `${url}${url.includes("?") ? "&" : "?"}${q}` : url);

export async function program(now, prefix, { second = false } = {}) {
  const ctx = await boot({ now, maxCompanies: 2 });
  const api = ctx.api;
  let q2 = "";
  if (second) {
    const r = await api.post("/api/companies", { name: `${prefix} İkinci`, select: false });
    if (r.status !== 200) throw new Error(`002: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
    q2 = `hofCompany=${encodeURIComponent((r.data.company || r.data).id)}`;
  }
  const qOf = tag => (tag === "002" ? q2 : "");
  const must = async (label, p) => {
    const r = await p;
    if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 400)}`);
    return r.data;
  };
  const ids = {};
  for (const tag of second ? ["001", "002"] : ["001"]) {
    ids[`M${tag}`] = (await must("müşteri", api.post(amp("/api/workspace/accounts", qOf(tag)), { name: `${prefix} Müşteri ${tag}`, type: "customer", registeredOn: "2025-01-01" }))).id;
    ids[`T${tag}`] = (await must("tedarikçi", api.post(amp("/api/workspace/accounts", qOf(tag)), { name: `${prefix} Tedarikçi ${tag}`, type: "supplier", registeredOn: "2025-01-01" }))).id;
  }
  let n = 0;
  const h = {
    ctx,
    api,
    buy: async (date, net, tag = "001") => (await must(`alış ${date}`, api.post(amp(INV, qOf(tag)), { kind: "purchase", scenario: "expense_purchase", accountId: ids[`T${tag}`], issueDate: date, number: `${prefix}-${tag}-A${(n += 1)}`, lines: [{ name: "Kırtasiye", qty: 1, unitPrice: net, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }))).id,
    sell: async (date, net, tag = "001") => (await must(`satış ${date}`, api.post(amp(INV, qOf(tag)), { scenario: "service_sale", accountId: ids[`M${tag}`], issueDate: date, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: net, vatRate: 20 }], payment: { rest: "open" } }))).id,
    cancel: async (id, tag = "001") => must("İptal Et", api.post(amp(`${INV}/${id}/cancel`, qOf(tag)), { reason: "Hatalı fatura", force: true })),
    offset: async (month, tag = "001") => {
      const r = await api.post(amp(`${TAX}/vat-offset`, qOf(tag)), { month });
      return r.status === 200 ? [r.data.offset.carryInMinor, r.data.offset.payableMinor, r.data.offset.carryOutMinor] : `RED ${r.status} ${r.data?.error || JSON.stringify(r.data).slice(0, 120)}`;
    },
    offsets: async (tag = "001") => (await must("liste", api.get(amp(`${TAX}/vat-offset`, qOf(tag))))).offsets,
    reverseLatest: async (tag = "001") => {
      const list = (await must("liste", api.get(amp(`${TAX}/vat-offset`, qOf(tag))))).offsets.filter(o => o.status === "active").sort((a, b) => (a.month < b.month ? 1 : -1));
      if (!list.length) return null;
      await must("geri al", api.post(amp(`${TAX}/vat-offset/${list[0].id}/reverse`, qOf(tag)), {}));
      return list[0].month;
    },
    reverse: async (month, tag = "001") => {
      const list = (await must("liste", api.get(amp(`${TAX}/vat-offset`, qOf(tag))))).offsets;
      const row = list.find(o => o.month === month && o.status === "active");
      const r = await api.post(amp(`${TAX}/vat-offset/${row.id}/reverse`, qOf(tag)), {});
      return r.status === 200 ? "geri alındı" : `RED ${r.status} ${r.data?.error}`;
    },
    preview: async (month, tag = "001") => {
      const p = (await must("ön izleme", api.get(amp(`${TAX}/vat-offset?month=${month}`, qOf(tag))))).preview;
      return [p.carryInMinor, p.payableMinor, p.carryOutMinor];
    },
    report: async (query, tag = "001") => {
      const qs = typeof query === "string" ? query : new URLSearchParams(query).toString();
      const r = await api.get(amp(`${RC}/kdv-ozeti?${qs}`, qOf(tag)));
      if (r.status !== 200) throw new Error(`rapor ${qs}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
      const s = Object.fromEntries(r.data.summary);
      return { three: LABELS.map(k => minor(s[k])), h391: minor(s["Hesaplanan KDV (391) (İadeler Düşülmüş)"]), h191: minor(s["İndirilecek KDV (191) (İadeler Düşülmüş)"]), summary: s, data: r.data };
    },
    close: () => ctx.server.close(),
  };
  return h;
}
