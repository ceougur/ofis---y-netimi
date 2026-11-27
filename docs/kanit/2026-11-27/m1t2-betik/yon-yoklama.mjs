// M1 tur 2 yoklaması (kanıt değil, soru için sayı): kopuk zincirde YÖN değişen fiş (karar (3) son cümlesi) ve S4 ayında ayın sonucu ↔ sonraki aya taşınan.
// Kullanım: node yon-yoklama.mjs <kod kökü>
import path from "node:path";
import { pathToFileURL } from "node:url";
const root = process.argv[2];
process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const { boot, must } = await import(pathToFileURL(path.join(root, "test", "banka-210-ortak.mjs")).href);
const ctx = await boot({ now: "2026-06-20T12:00:00+03:00" });
const api = ctx.api;
const T = (await must("t", api.post("/api/workspace/accounts", { name: "Y Tedarikçi", type: "supplier", registeredOn: "2026-01-01" }))).id;
const M = (await must("m", api.post("/api/workspace/accounts", { name: "Y Müşteri", type: "customer", registeredOn: "2026-01-01" }))).id;
const buy = (date, net) => must(`alış ${date}`, api.post("/api/workspace/invoices", { kind: "purchase", scenario: "expense_purchase", accountId: T, issueDate: date, number: `Y-${date}`, lines: [{ name: "Kırtasiye", qty: 1, unitPrice: net, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }));
const sell = (date, net) => must(`satış ${date}`, api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: M, issueDate: date, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: net, vatRate: 20 }], payment: { rest: "open" } }));
const offset = async month => (await must(`mahsup ${month}`, api.post("/api/workspace/tax/vat-offset", { month }))).offset;
const rep = async month => {
  const [y, m] = month.split("-").map(Number);
  const r = await must(`rapor ${month}`, api.get(`/api/workspace/report-center/kdv-ozeti?from=${month}-01&to=${new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)}`));
  return Object.fromEntries(r.summary);
};
const pv = async month => {
  const p = (await must("ön izleme", api.get(`/api/workspace/tax/vat-offset?month=${month}`))).preview;
  return [p.carryInMinor, p.payableMinor, p.carryOutMinor];
};
const three = s => ["Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme Devreden KDV"].map(k => s[k]).join(" / ");
await buy("2026-01-10", 10000);
await offset("2026-01");
await sell("2026-02-10", 9000); // KDV 1.800, Şubat MAHSUPSUZ
await sell("2026-03-10", 5000); // KDV 1.000
const fis = await offset("2026-03"); // defterdeki 2.000'le
console.log("YÖN: Mart fişi (önceki / ödenecek / sonraki):", [fis.carryInMinor, fis.payableMinor, fis.carryOutMinor].join(" / "));
const mar = await rep("2026-03");
console.log("YÖN: Mart rapor:", three(mar));
console.log("YÖN: Zincirle Uyuşmayan Mahsup Fişi:", mar["Zincirle Uyuşmayan Mahsup Fişi"]);
console.log("YÖN: Mahsup Edilmemiş Ay:", mar["Mahsup Edilmemiş Ay"]);
console.log("YÖN: Nisan rapor:", three(await rep("2026-04")), "· Nisan ön izleme:", (await pv("2026-04")).join(" / "));
const led = await must("mizan", api.get("/api/workspace/ledger?to=2026-03-31"));
console.log("YÖN: defter 190 / 360 (Mart sonu):", JSON.stringify(led.trial.accounts.filter(a => ["190", "360"].includes(a.code)).map(a => [a.code, a.balance])));
await ctx.server.close();
