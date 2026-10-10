// Hakem: KDV dahil + iskontolu satış faturası, verilen kod kökünde (v2.0.26 ya da HEAD) programın GERÇEK HTTP API'siyle.
//   node canli.mjs <kod-kökü>
// Beklenen değer hesaplamaz; yalnız programın döndürdüğünü yazar.
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2]);
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);
const server = await startTestServer({ moneyStrict: false });
const admin = await loginAdmin(server);
const out = { kok: root, vakalar: [] };
const U = r => (r && r.data && r.data.ok !== undefined && "data" in r.data ? { status: r.status, data: r.data.data, err: r.data } : { status: r.status, data: r.data, err: r.data });
const today = new Date().toISOString().slice(0, 10);
const vakalar = [
  { ad: "F1 82,71 %15 %20", unitPrice: 82.71, discountRate: 15, vatRate: 20 },
  { ad: "F2 2000 %20 %20", unitPrice: 2000, discountRate: 20, vatRate: 20 },
  { ad: "F3 82,71 %15 %20 peşin 70,31", unitPrice: 82.71, discountRate: 15, vatRate: 20, pesin: "70,31" },
  { ad: "F4 82,71 %15 %20 peşin 70,30", unitPrice: 82.71, discountRate: 15, vatRate: 20, pesin: "70,30" },
  { ad: "F5 100 %10 %10", unitPrice: 100, discountRate: 10, vatRate: 10 },
];
let i = 0;
for (const v of vakalar) {
  i += 1;
  const acc = U(await admin.post("/api/workspace/accounts", { name: `Müşteri ${i}`, type: "customer" }));
  if (acc.status !== 200) throw new Error("cari: " + JSON.stringify(acc.data));
  const accountId = acc.data.account?.id ?? acc.data.id;
  const body = {
    kind: "sale", accountId, issueDate: today, pricesIncludeVat: true,
    lines: [{ name: "Bakım", qty: 1, unitPrice: v.unitPrice, vatRate: v.vatRate, discountRate: v.discountRate }],
    payment: { cash: v.pesin ? [{ amount: v.pesin, method: "cash" }] : [], rest: "open" },
  };
  const calc = U(await admin.post("/api/workspace/invoices/calc", body));
  const res = U(await admin.post("/api/workspace/invoices", body));
  const kayit = { ad: v.ad, calcDurum: calc.status, calcTotals: calc.data?.totals ? { base: calc.data.totals.base, discount: calc.data.totals.discount, net: calc.data.totals.net, vat: calc.data.totals.vat, payable: calc.data.totals.payable } : calc.err, kayitDurum: res.status, kayitKod: res.err?.code ?? null, kayitHata: res.err?.error ?? null };
  if (res.status === 200) {
    const card = U(await admin.get(`/api/workspace/invoices/${res.data.id}`));
    const inv = card.data?.invoice || card.data;
    kayit.kart = { netTotal: inv.netTotal, vatTotal: inv.vatTotal, payableTotal: inv.payableTotal, open: inv.open ?? inv.payment?.open ?? null };
  }
  const list = U(await admin.get(`/api/workspace/accounts/${accountId}`));
  const a = list.data?.account || list.data;
  kayit.cariBakiye = a?.balance ?? null; kayit.cariAnahtar = Object.keys(a || {}).filter(k => /bal|debt|borc/i.test(k));
  out.vakalar.push(kayit);
}
await server.close();
process.stdout.write(JSON.stringify(out, null, 2) + "\n");
