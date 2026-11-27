// KULLANICIYA SORULMALI (karma ay) yoklaması: mahsup fişi kesilmiş ayda İKİ değişiklik birlikte — İndirilecek KDV AZALDI (S-DKM1-1'in konusu) VE 391 değişti (programın
// "Güncel Değil"i; S-M1-3 = C'nin konusu). Gerçek program (API), sahte saat. Kullanım: node karma-yoklama.mjs <kod kökü>
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
const ctx = await boot({ now: "2026-04-05T12:00:00+03:00" });
const api = ctx.api;
const M = (await must("müşteri", api.post("/api/workspace/accounts", { name: "Karma Müşteri", type: "customer", registeredOn: "2025-01-01" }))).id;
const T = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Karma Tedarikçi", type: "supplier", registeredOn: "2025-01-01" }))).id;
const sell = (date, net) => must(`satış ${date}`, api.post(INV, { scenario: "service_sale", accountId: M, issueDate: date, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: net, vatRate: 20 }], payment: { rest: "open" } }));
const report = async (from, to) => {
  const d = await must("rapor", api.get(`${RC}/kdv-ozeti?from=${from}&to=${to}`));
  const s = Object.fromEntries(d.summary);
  return { three: ["Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme Devreden KDV"].map(l => minor(s[l])), h391: minor(s["Hesaplanan KDV (391) (İadeler Düşülmüş)"]), h191: minor(s["İndirilecek KDV (191) (İadeler Düşülmüş)"]), notes: d.summary.filter(([l]) => minor(l) === null && minor(s[l]) === null) };
};
await sell("2026-01-05", 5000); // 391 1.000
const buy = (await must("alış", api.post(INV, { kind: "purchase", scenario: "expense_purchase", accountId: T, issueDate: "2026-01-10", number: "KR-1", lines: [{ name: "Kırtasiye", qty: 1, unitPrice: 2500, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }))).id; // 191 500
const jan = (await must("Ocak mahsubu", api.post(`${TAX}/vat-offset`, { month: "2026-01" }))).offset;
console.log("Ocak fişi (önceki / ödenecek / sonraki)", [jan.carryInMinor, jan.payableMinor, jan.carryOutMinor]);
await must("Ocak alışı İptal Et", api.post(`${INV}/${buy}/cancel`, { reason: "Hatalı fatura", force: true })); // 191 −500 (azaltan)
await sell("2026-01-20", 500); // 391 +100 (artıran → Güncel Değil)
await sell("2026-02-10", 1000); // 391 200
const feb = (await must("Şubat mahsubu", api.post(`${TAX}/vat-offset`, { month: "2026-02" }))).offset;
console.log("Şubat fişi", [feb.carryInMinor, feb.payableMinor, feb.carryOutMinor]);
const list = (await must("liste", api.get(`${TAX}/vat-offset`))).offsets.filter(o => o.status === "active").map(o => [o.month, o.payableMinor, o.stale]);
console.log("fişler (ay, ödenecek, güncel değil)", JSON.stringify(list));
console.log("Ocak raporu", JSON.stringify(await report("2026-01-01", "2026-01-31")));
console.log("Şubat raporu", JSON.stringify(await report("2026-02-01", "2026-02-28")));
console.log("Ocak–Şubat raporu", JSON.stringify(await report("2026-01-01", "2026-02-28")));
ctx.server.close();
