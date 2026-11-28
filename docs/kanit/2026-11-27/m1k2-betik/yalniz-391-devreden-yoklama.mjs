// Yoklama (KULLANICIYA SORULMALI adayı): S-M1-3 = C (yalnız 391 değişti — "güncel değil", sayılar bugünkü kayıtlardan) DEVREDEN yönde: zincir sonraki aya fişin ESKİ devredenini
// taşır (bu turda DEĞİŞMEDİ). Gerçek program (API), sahte saat. Kullanım: node yalniz-391-devreden-yoklama.mjs <kod kökü>
//   Mart alış KDV 1.000, satış KDV 200 → Mart fişi devreden 800; sonra Mart satış KDV +100 (yalnız 391); Nisan satış KDV 1.000 → Nisan fişi (defterin 800'üyle) 200.
//   391 − 191 (Mart–Nisan) = 1.300 − 1.000 = 300.
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const [root] = process.argv.slice(2);
const imp = rel => import(pathToFileURL(path.join(root, rel)).href);
const { boot, must } = await imp("test/banka-210-ortak.mjs");
const RC = "/api/workspace/report-center";
const INV = "/api/workspace/invoices";
const TAX = "/api/workspace/tax";
const minor = text => (/TL$/.test(String(text ?? "").trim()) ? Number(String(text).replace(/[^\d,]/g, "").replace(",", "")) : null);
const ctx = await boot({ now: "2026-05-05T12:00:00+03:00" });
const api = ctx.api;
const M = (await must("müşteri", api.post("/api/workspace/accounts", { name: "Yoklama Müşteri", type: "customer", registeredOn: "2025-01-01" }))).id;
const T = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Yoklama Tedarikçi", type: "supplier", registeredOn: "2025-01-01" }))).id;
const sell = (date, net) => must(`satış ${date}`, api.post(INV, { scenario: "service_sale", accountId: M, issueDate: date, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: net, vatRate: 20 }], payment: { rest: "open" } }));
const report = async (from, to) => {
  const d = await must("rapor", api.get(`${RC}/kdv-ozeti?from=${from}&to=${to}`));
  const s = Object.fromEntries(d.summary);
  return { three: ["Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme Devreden KDV"].map(l => minor(s[l])), h391: minor(s["Hesaplanan KDV (391) (İadeler Düşülmüş)"]), h191: minor(s["İndirilecek KDV (191) (İadeler Düşülmüş)"]), notes: d.summary.filter(([, v]) => minor(v) === null) };
};
await must("alış", api.post(INV, { kind: "purchase", scenario: "expense_purchase", accountId: T, issueDate: "2026-03-05", number: "YK-1", lines: [{ name: "Kırtasiye", qty: 1, unitPrice: 5000, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }));
await sell("2026-03-10", 1000);
const mar = (await must("Mart mahsubu", api.post(`${TAX}/vat-offset`, { month: "2026-03" }))).offset;
console.log("Mart fişi (önceki / ödenecek / sonraki)", [mar.carryInMinor, mar.payableMinor, mar.carryOutMinor]);
await sell("2026-03-20", 500); // yalnız 391 +100
await sell("2026-04-10", 5000);
const apr = (await must("Nisan mahsubu", api.post(`${TAX}/vat-offset`, { month: "2026-04" }))).offset;
console.log("Nisan fişi", [apr.carryInMinor, apr.payableMinor, apr.carryOutMinor]);
console.log("Mart raporu", JSON.stringify(await report("2026-03-01", "2026-03-31")));
console.log("Nisan raporu", JSON.stringify(await report("2026-04-01", "2026-04-30")));
console.log("Mart–Nisan raporu", JSON.stringify(await report("2026-03-01", "2026-04-30")));
ctx.server.close();
