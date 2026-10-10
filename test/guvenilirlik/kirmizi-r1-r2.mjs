// 2.1.0 kırmızı kanıt (docs/2.1.0-KANIT.md "Plan Testleri — Eksiklerin Tamamlanması"): R1 (iadenin geri ödemesi fatura kapamada başka açık
// satışı "Ödendi" gösterir, aynı carinin alış faturasını öder) ve R2 (Gider Raporu türleri tek satırda) eski sürümün GERÇEK koduyla (git etiketi;
// surumler.mjs bootVersion), yalnız o sürümün API'siyle yeniden üretilir. Kalıcı test: test/banka-210-rapor-bulgu.test.mjs.
// Kullanım: node test/guvenilirlik/kirmizi-r1-r2.mjs v2.0.26   (etiket verilmezse v2.0.26)
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { bootVersion } from "./surumler.mjs";
const TAG = process.argv[2] || "v2.0.26";
const pad = n => String(n).padStart(2, "0");
const day = off => { const d = new Date(); d.setDate(d.getDate() + off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const root = mkdtempSync(path.join(tmpdir(), "r1r2-eski-"));
const server = await bootVersion(TAG, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") });
const api = await server.login();
const must = async (l, p) => { const r = await p; if (r.status !== 200) throw new Error(`${l}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`); return r.data?.ok !== undefined && r.data?.data ? r.data.data : r.data; };
const state = async id => { const d = await must("fatura", api.get(`/api/workspace/invoices/${id}`)); return `${d.payState}/${d.open}`; };
// R1a: açık satış 120 + peşin satış 1.200 → tamamı iade, 1.200 nakit geri ödendi.
const cem = await must("cari", api.post("/api/workspace/accounts", { name: "Cem", type: "customer", registeredOn: day(-100) }));
const s0 = await must("S0", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: cem.id, issueDate: day(-50), lines: [{ name: "H", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open", dueDate: day(-40) } }));
const s6 = await must("S6", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: cem.id, issueDate: day(-30), lines: [{ name: "H", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { cash: [{ amount: 1200, method: "cash" }], rest: "open" } }));
const d6 = await must("s6", api.get(`/api/workspace/invoices/${s6.id}`));
await must("iade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: s6.id, issueDate: day(-25), lines: [{ originLineId: d6.lines[0].id, qty: 1 }], payment: { cash: [{ amount: 1200, method: "cash" }], rest: "open" }, cashForce: true }));
const acc = await must("cari kartı", api.get(`/api/workspace/accounts/${cem.id}`));
const open = await must("açık", api.get(`/api/workspace/report-center/acik-faturalar?account=${cem.id}`));
console.log(`${TAG} R1a: cari bakiye ${acc.totals.balance} (beklenen 120) · açık satış ${await state(s0.id)} (beklenen overdue/120) · Açık Faturalar ${JSON.stringify(open.summary)}`);
// R1d: aynı cariye açık alış 500 + peşin satış 1.200 → iade + 1.200 nakit geri.
const hm = await must("cari", api.post("/api/workspace/accounts", { name: "Hem Müşteri Hem Tedarikçi", type: "customer", registeredOn: day(-100) }));
const pur = await must("alış", api.post("/api/workspace/invoices", { scenario: "expense_purchase", accountId: hm.id, number: "AL-R1D", issueDate: day(-60), lines: [{ name: "Danışmanlık", expenseCode: "advisory", qty: 1, unitPrice: 500, vatRate: 0 }], payment: { rest: "open", dueDate: day(-30) } }));
const sale = await must("peşin satış", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: hm.id, issueDate: day(-20), lines: [{ name: "H", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { cash: [{ amount: 1200, method: "cash" }], rest: "open" } }));
const ds = await must("fatura", api.get(`/api/workspace/invoices/${sale.id}`));
await must("iade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: sale.id, issueDate: day(-10), lines: [{ originLineId: ds.lines[0].id, qty: 1 }], payment: { cash: [{ amount: 1200, method: "cash" }], rest: "open" }, cashForce: true }));
console.log(`${TAG} R1d: alış faturası ${await state(pur.id)} (beklenen overdue/500; müşteriye iade ödemesi tedarikçiye ödeme değildir)`);
// R2: aynı ayda Kira 2.000 + Elektrik 300 → iki satır.
const sup = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Gider Tedarikçisi", type: "supplier", registeredOn: day(-30) }));
await must("kira", api.post("/api/workspace/invoices", { scenario: "expense_purchase", accountId: sup.id, number: "G-1", issueDate: day(-1), lines: [{ name: "Ofis Kirası", expenseCode: "rent", qty: 1, unitPrice: 2000, vatRate: 20 }], payment: { rest: "open" } }));
await must("elektrik", api.post("/api/workspace/invoices", { scenario: "expense_purchase", accountId: sup.id, number: "G-2", issueDate: day(-1), lines: [{ name: "Elektrik", expenseCode: "utilities", qty: 1, unitPrice: 300, vatRate: 20 }], payment: { rest: "open" } }));
const rep = await must("gider", api.get(`/api/workspace/report-center/gider-raporu?from=${day(-1)}&to=${day(-1)}`));
console.log(`${TAG} R2: Gider Raporu satırları ${JSON.stringify(rep.rows)} (beklenen 2 satır: Kira 2.000 · Elektrik 300)`);
await server.close();
rmSync(root, { recursive: true, force: true });
