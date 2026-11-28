// M1 küçük tur 5 — YAN ETKİ ÖLÇÜMÜ (iş 3): kararın örneği (S-DKM1K-1), sonra Nisan ön izlemesiyle mahsup; rapor, notların TAM metni, fişler, ön izleme, defter (360 / 190);
// sonra onarım (Nisan, Mart, Şubat geri al + sırayla yeniden mahsup). Kullanım: ROOT=<kod kökü> HUKUK_LICENSE_URL=http://127.0.0.1:9 node yan-etki.mjs
const ROOT = process.env.ROOT;
if (!ROOT) throw new Error("ROOT yok");
const { boot, must } = await import(`${ROOT}/test/banka-210-ortak.mjs`);
const { trialBalances } = await import(`${ROOT}/test/banka-210-hesap-ortak.mjs`);
const RC = "/api/workspace/report-center";
const INV = "/api/workspace/invoices";
const TAX = "/api/workspace/tax";
const LABELS = ["Önceki Dönemden Devreden KDV", "Ödenecek KDV", "Sonraki Döneme Devreden KDV"];
const ctx = await boot({ now: "2026-05-15T12:00:00+03:00", maxCompanies: 2 });
const api = ctx.api;
try {
  const M = (await must("müşteri", api.post("/api/workspace/accounts", { name: "YE Müşteri", type: "customer", registeredOn: "2025-01-01" }))).id;
  const T = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: "YE Tedarikçi", type: "supplier", registeredOn: "2025-01-01" }))).id;
  let n = 0;
  const buy = async (date, net) => (await must(`alış ${date}`, api.post(INV, { kind: "purchase", scenario: "expense_purchase", accountId: T, issueDate: date, number: `YE-A${(n += 1)}`, lines: [{ name: "Kırtasiye", qty: 1, unitPrice: net, vatRate: 20, expenseCode: "office" }], payment: { rest: "open" } }))).id;
  const sell = async (date, net) => must(`satış ${date}`, api.post(INV, { scenario: "service_sale", accountId: M, issueDate: date, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: net, vatRate: 20 }], payment: { rest: "open" } }));
  const offset = async month => {
    const o = (await must(`mahsup ${month}`, api.post(`${TAX}/vat-offset`, { month }))).offset;
    return [o.carryInMinor, o.payableMinor, o.carryOutMinor];
  };
  const reverse = async month => {
    const row = (await must("liste", api.get(`${TAX}/vat-offset`))).offsets.find(item => item.month === month && item.status === "active");
    return must(`geri al ${month}`, api.post(`${TAX}/vat-offset/${row.id}/reverse`, {}));
  };
  const preview = async month => {
    const p = (await must(`ön izleme ${month}`, api.get(`${TAX}/vat-offset?month=${month}`))).preview;
    return JSON.stringify({ önceki: p.carryInMinor, ödenecek: p.payableMinor, sonraki: p.carryOutMinor, uyarılar: p.warnings });
  };
  const report = async (label, from, to) => {
    const data = await must(label, api.get(`${RC}/kdv-ozeti?from=${from}&to=${to}`));
    const s = Object.fromEntries(data.summary);
    console.log(`${label}: ${LABELS.map(name => `${name} ${s[name]}`).join(" · ")} · 391 ${s["Hesaplanan KDV (391) (İadeler Düşülmüş)"]} · 191 ${s["İndirilecek KDV (191) (İadeler Düşülmüş)"]}`);
    for (const [name, value] of data.summary) if (!/TL$/.test(String(value).trim())) console.log(`   not [${name}] ${value}`);
  };
  const ledger = async label => {
    const tb = await trialBalances(api, "?to=2026-04-30");
    console.log(`${label}: defter 360 ${tb["360"] ?? 0} · 190 ${tb["190"] ?? 0}`);
  };
  const fisler = async label => console.log(`${label}: fişler ${JSON.stringify((await must("liste", api.get(`${TAX}/vat-offset`))).offsets.filter(item => item.status === "active").map(item => [item.month, item.carryInMinor, item.payableMinor, item.carryOutMinor, item.stale]))}`);
  await buy("2026-01-10", 5000);
  console.log("Ocak fişi", await offset("2026-01"));
  await sell("2026-02-10", 10000);
  await buy("2026-02-11", 2500);
  console.log("Şubat fişi", await offset("2026-02"));
  await sell("2026-03-10", 5000);
  const marBuy = await buy("2026-03-11", 1000);
  await buy("2026-03-12", 500);
  console.log("Mart fişi", await offset("2026-03"));
  await sell("2026-04-10", 2500);
  await buy("2026-02-20", 1500);
  await must("İptal Et", api.post(`${INV}/${marBuy}/cancel`, { reason: "Hatalı fatura", force: true }));
  console.log("== 1. Fişlerden sonra (Nisan fişsiz)");
  await fisler("1");
  console.log("Nisan ön izlemesi", await preview("2026-04"));
  await report("Nisan", "2026-04-01", "2026-04-30");
  await report("Ocak–Nisan", "2026-01-01", "2026-04-30");
  await ledger("1");
  console.log("== 2. Nisan ön izlemeyle mahsup edildi");
  console.log("Nisan fişi", await offset("2026-04"));
  await fisler("2");
  await report("Nisan", "2026-04-01", "2026-04-30");
  await report("Ocak–Nisan", "2026-01-01", "2026-04-30");
  await ledger("2");
  console.log("== 3. Onarım: Nisan, Mart, Şubat geri al; sırayla yeniden mahsup");
  for (const month of ["2026-04", "2026-03", "2026-02"]) await reverse(month);
  for (const month of ["2026-02", "2026-03", "2026-04"]) console.log(`${month} fişi`, await offset(month));
  await fisler("3");
  await report("Nisan", "2026-04-01", "2026-04-30");
  await report("Ocak–Nisan", "2026-01-01", "2026-04-30");
  await ledger("3");
} finally {
  await ctx.server.close();
}
