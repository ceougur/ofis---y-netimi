// S229 = A + S230 = A — PARA DEĞİŞMEZİ betiği (test değildir: adı ".test.mjs" ile bitmez). Aynı istek dizisini bu dosyanın bulunduğu kodda (../server) koşar,
// veri tabanının para tablolarını (cari satırları, kartlar, taksitler, kart tahsilatları, mahsuplar, Kasa, defter maddeleri) ve birleşik listeleri (Alacak Yaşlandırma,
// nakit akışı, Vade Takip, zil, cari kartı toplamları, mizan) kimlikleri sıra numarasına çevirerek JSON'a yazar. Eski ve yeni kodda koşulur, iki çıktı BİREBİR
// karşılaştırılır (ders 3, 12; kabul F). Gösterim alanları (Açık Faturalar, fatura kartı, Faturalar listesi, Anlık Durum'un fatura özeti) KASITLA dışarıda — onlar
// S229 / S230 ile değişir; formun ÖNERDİĞİ tutar değil, gönderilen istek aynıdır (sınır ve kapama değişmez).
// Kullanım: TZ=… HUKUK_LICENSE_URL=http://127.0.0.1:9 node test/s229-para-degismezi.mjs <çıktı.json>
import { writeFileSync } from "node:fs";
import { bootBank } from "./banka-210-hesap-ortak.mjs";
import { must } from "./banka-210-ortak.mjs";

const W = "/api/workspace";
const out = process.argv[2];
const ctx = await bootBank();
const api = ctx.api;
const steps = [];
const log = (label, res) => steps.push([label, res.status, res.status === 200 ? "" : String(res.data?.error || res.error || "").slice(0, 200)]);
const call = async (label, promise) => {
  const res = await promise;
  log(label, res);
  return res.data;
};
let n = 0;
const acc = async name => (await must("cari", api.post(`${W}/accounts`, { name: `${name} ${(n += 1)}`, type: "customer", registeredOn: "2026-08-01" }))).id;
const sale = async (accountId, gross, dueDate) => (await must("satış", api.post(`${W}/invoices`, { scenario: "service_sale", accountId, issueDate: "2026-09-02", lines: [{ name: "Hizmet", qty: 1, unitPrice: gross / 1.2, vatRate: 20 }], payment: { rest: "open", dueDate } }))).id;
const purchase = async (accountId, gross) => (await must("alış", api.post(`${W}/invoices`, { scenario: "expense_purchase", accountId, number: `ALS${(n += 1)}`, issueDate: "2026-09-02", lines: [{ name: "Gider", qty: 1, unitPrice: gross / 1.2, vatRate: 20, expenseCode: "other" }], payment: { rest: "open", dueDate: "2026-09-02" } }))).id;
const entry = (accountId, kind, amount, date, extra = {}) => call(`${kind} ${amount}`, api.post(`${W}/accounts/${accountId}/entries`, { kind, amount: String(amount), date, note: `${kind} ${amount}`, ...extra }));
const card = async (accountId, total, count) => (await must("kart", api.post(`${W}/plans`, { accountId, name: `Kart ${(n += 1)}`, total: String(total), registeredOn: "2026-09-25", mode: "auto", count, firstDue: "2026-11-01", coversBalance: true }))).id;

// 1) S229 örneği + faturaya bağlı tahsilat (gösterilen 20.000'den FAZLA: 25.000 → fazlası en eski açık borca) + kart tahsilatı.
const A = await acc("PD K1");
const f1 = await sale(A, 50000, "2026-09-20");
await entry(A, "debt", 30000, "2026-09-05", { dueDate: "2026-11-15" });
const p1 = await card(A, 60000, 2);
await entry(A, "in", 25000, "2026-10-01", { method: "cash", invoiceId: f1 });
await call("kart tahsilatı", api.post(`${W}/plans/${p1}/entries`, { kind: "in", amount: "10000", date: "2026-10-02", method: "cash" }));
// 2) Tam kapsanan fatura + faturaya bağlı tahsilat (gösterilen 0; istek yine kabul — sınır değişmez).
const B = await acc("PD K2");
const f2 = await sale(B, 50000, "2026-09-20");
await card(B, 50000, 2);
await entry(B, "in", 5000, "2026-10-01", { method: "cash", invoiceId: f2 });
// 3) Mahsup: kısmen kapsanan satış faturası (kendi açığı 50.000, kart 10.000 → gösterilen 40.000) alış faturasıyla 45.000 — gösterilenden FAZLA, sınırın içinde;
//    sonra kalan kendi açığı 5.000'i aşan 10.000 (red). Sınır iki kodda aynı olmalı.
const C = await acc("PD K3");
const f3 = await sale(C, 50000, "2026-09-20");
await sale(C, 20000, "2026-10-30");
const buy = await purchase(C, 60000);
await card(C, 10000, 1);
await call("mahsup 45.000", api.post(`${W}/invoices/${f3}/offsets`, { counterType: "invoice", counterId: buy, amount: "45000", date: "2026-10-03" }));
await call("mahsup aşan 10.000 (red)", api.post(`${W}/invoices/${f3}/offsets`, { counterType: "invoice", counterId: buy, amount: "10000", date: "2026-10-03" }));
// 4) İki kart + elle borç + Alacak Yaz + şüpheli + Kartı Kapat 'Borçta Kalsın' + kart silme.
const D = await acc("PD K4");
await sale(D, 30000, "2026-09-10");
await sale(D, 40000, "2026-09-30");
await entry(D, "debt", 20000, "2026-09-03");
await entry(D, "credit", 5000, "2026-09-04");
const p4 = await card(D, 40000, 2);
const p5 = await card(D, 5000, 1);
await call("şüpheliye al", api.post(`${W}/accounts/${D}/doubtful`, { amount: "10000", date: "2026-10-01", reason: "lawsuit" }));
const left = (await must("kart", api.get(`${W}/plans/${p4}`))).totals.remaining;
await call("Kartı Kapat", api.put(`${W}/plans/${p4}`, { status: "closed", closeRemaining: left }));
await call("kart sil", api.del(`${W}/plans/${p5}`));
// 5) Fatura iptali (S210 = A).
const E = await acc("PD K5");
const f6 = await sale(E, 50000, "2026-09-20");
await entry(E, "debt", 30000, "2026-09-05");
await card(E, 60000, 2);
await call("iptal", api.post(`${W}/invoices/${f6}/cancel`, { reason: "Hatalı fatura", payments: "drop", refund: "none" }));

const ids = new Map();
const norm = value => {
  if (typeof value !== "string") return value;
  return value.replace(/\bev-[0-9a-z]+-[0-9a-f]{8}(?:-[0-9a-f]{4})+\b|\b[a-z]{2,12}_[A-Za-z0-9_-]{8,}\b|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, match => {
    if (!ids.has(match)) ids.set(match, `#${ids.size + 1}`);
    return ids.get(match);
  });
};
const deep = value => (Array.isArray(value) ? value.map(deep) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deep(v)])) : norm(value));
const DROP = /^(created_at|updated_at|deleted_at|createdAt|updatedAt|at|tookMs|took_ms|elapsed|generatedAt|version)$/;
const table = name => {
  try {
    return ctx.store.all(`SELECT * FROM ${name} ORDER BY rowid`).map(row => deep(Object.fromEntries(Object.entries(row).filter(([k]) => !DROP.test(k)))));
  } catch (error) {
    return `okunamadı: ${error.message}`;
  }
};
const strip = value => (Array.isArray(value) ? value.map(strip) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([k]) => !DROP.test(k)).map(([k, v]) => [k, strip(v)])) : value);
const get = async url => {
  const res = await api.get(url);
  return { status: res.status, data: deep(strip(res.data)) };
};
const accounts = {};
for (const id of [A, B, C, D, E]) accounts[norm(id)] = (await get(`${W}/accounts/${id}`)).data?.totals;
const tables = {};
for (const name of ["account_entries", "plans", "plan_items", "plan_entries", "invoice_offsets", "doubtful_receivables", "cash_entries", "fin_events", "ledger_vouchers", "ledger_voucher_lines"]) tables[name] = table(name);
const report = async id => {
  const r = await get(`${W}/report-center/${id}`);
  return r.status === 200 ? { headers: r.data.headers, rows: r.data.rows, footers: r.data.footers, summary: r.data.summary } : r;
};
const dump = {
  steps,
  accounts,
  tables,
  ledger: (await get(`${W}/ledger`)).data?.trial,
  integrity: (await get(`${W}/ledger/integrity`)).data?.ok,
  yaslandirma: await report("alacak-yaslandirma"),
  geciken: await report("geciken-taksitler"),
  taksitKartlari: await report("taksit-kartlari"),
  nakitAkisi: (await get(`${W}/overview/nakit-akisi`)).data,
  vadeTakip: (await get(`${W}/overview/vade-takip`)).data,
  zil: (await get(`${W}/dues`)).data,
  plans: await Promise.all([p1].map(async id => (await get(`${W}/plans/${id}`)).data)),
};
// Anlık Durum: fatura özeti DIŞINDAKİ bloklar (kasa, alacak / borç, stok, çek) değişmez.
const overview = (await get(`${W}/overview`)).data;
if (overview) delete overview.invoices;
dump.overview = overview;
writeFileSync(out, `${JSON.stringify(dump, null, 1)}\n`);
await ctx.server.close();
console.log(`yazıldı ${out}: adım ${steps.length}, ${steps.filter(([, s]) => s !== 200).length} red`);
