// Mali müşavir testi (2.0.17; kullanıcı isteği 02.10.2026): gerçek bir şirketin bir ayı — fatura modülünün HER
// varyasyonu (8 senaryo; KDV %1/%10/%20; KDV dahil/hariç; satır ve belge iskontosu; tevkifat; stopaj; nakit/havale/POS/
// alınan çek/verilen çek/ciro/taksit/açık/karma ödeme; taslak → kaydet; düzenle; iptal; sil; kopya; toplu; mahsup;
// bağlı ödeme; tekrar; PDF/Excel/UBL) ve her adımın Kasa, banka/POS, cari, stok, taksit, çek/senet, KDV, hesap mizanı,
// ANLIK DURUM, rapor merkezi ve birleşik şirket raporuna etkisi — BEKLENEN tutarlar elle (bağımsız muhasebe modeli)
// hesaplanır, programın verdiği GERÇEK tutarla karşılaştırılır. Çıktı: docs/2.0.17-MALI-MUSAVIR-TESTI.md
// Çalıştırma: node --disable-warning=ExperimentalWarning test/mali-musavir-217.mjs
import { writeFileSync } from "node:fs";
import { ADMIN_PASSWORD, loginAdmin, startTestServer } from "./helpers.mjs";

const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const server = await startTestServer();
const client = await loginAdmin(server);
const api = {
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async (url, body) => unwrap(await client.raw("DELETE", url, { body: body ? JSON.stringify(body) : undefined, headers: body ? { "content-type": "application/json" } : {} })),
  raw: (url) => client.raw("GET", url),
};
const pad = v => String(v).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shift = days => iso(new Date(Date.now() + days * 86_400_000));
const TODAY = iso(new Date());
const MONTH_START = `${TODAY.slice(0, 7)}-01`;
const tl = n => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(Number(n) || 0);
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.006;

// ---------- Sonuç toplayıcı ----------
const rows = []; // { step, label, expected, actual, ok }
let step = "";
const section = title => { step = title; console.log(`\n■ ${title}`); };
function check(label, expected, actual, fmt = tl) {
  const ok = typeof expected === "number" ? near(expected, actual) : expected === actual;
  rows.push({ step, label, expected: typeof expected === "number" ? fmt(expected) : String(expected), actual: typeof actual === "number" ? fmt(actual) : String(actual), ok });
  console.log(`${ok ? "✓" : "✗"} ${label}: beklenen ${typeof expected === "number" ? fmt(expected) : expected} · gerçek ${typeof actual === "number" ? fmt(actual) : actual}`);
  return ok;
}
const must = (res, what) => { if (res.status >= 300) throw new Error(`${what}: HTTP ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`); return res.data; };
const qty = n => `${n}`;

// ---------- Okuma yardımcıları ----------
const overview = async () => (await api.get("/api/workspace/overview")).data;
const cashReport = async () => (await api.get("/api/workspace/cash?period=all")).data;
const account = async id => (await api.get(`/api/workspace/accounts/${id}`)).data;
const balance = async id => (await account(id)).totals.balance; // + borçlu (bize borçlu), − alacaklı (biz borçluyuz)
const stock = async id => (await api.get(`/api/workspace/stock/${id}`)).data;
const invoice = async id => (await api.get(`/api/workspace/invoices/${id}`)).data;
const report = async (id, q = "preset=thisMonth") => (await api.get(`/api/workspace/report-center/${id}?${q}`)).data;
const summaryOf = (rep, key) => { const row = (rep.summary || []).find(([k]) => k === key); return row ? money(row[1]) : null; };
const money = text => { const t = String(text ?? "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."); return Number(t) || 0; };
const bank = async () => (await overview()).cash.bank.balance;

// ---------- BAĞIMSIZ MODEL (mali müşavirin defteri) ----------
const M = { cash: 0, bank: 0, stock: {}, cost: {}, cari: {}, kdvOut: 0, kdvIn: 0, saleNet: 0, purchaseNet: 0 };
const R = (n) => Math.round(n * 100) / 100;

try {
  section("Kuruluş: 001 Demir Yapı Malzemeleri — Kasa açılışı, stok kartları, cariler");
  must(await api.post("/api/workspace/cash", { kind: "in", amount: 100000, date: TODAY, method: "cash", description: "Sermaye — Kasa açılışı" }), "Kasa açılışı");
  M.cash = 100000;
  const cimento = must(await api.post("/api/workspace/stock", { name: "Çimento 50 Kg", code: "CIM-50", unit: "Torba", unitPrice: 100, salePrice: 150 }), "stok çimento");
  const demir = must(await api.post("/api/workspace/stock", { name: "İnşaat Demiri 12 mm", code: "DMR-12", unit: "Kg", unitPrice: 25, salePrice: 30 }), "stok demir");
  const nakliye = must(await api.post("/api/workspace/stock", { name: "Nakliye Hizmeti", code: "HZM-NAK", unit: "Sefer", kind: "service", salePrice: 5000 }), "hizmet kalemi");
  M.stock = { [cimento.id]: 0, [demir.id]: 0 }; M.cost = { [cimento.id]: 100, [demir.id]: 25 };
  const akcansa = must(await api.post("/api/workspace/accounts", { name: "Akçansa Bayi Ltd.", type: "supplier" }), "cari Akçansa");
  const yilmaz = must(await api.post("/api/workspace/accounts", { name: "Yılmaz İnşaat A.Ş.", type: "customer" }), "cari Yılmaz");
  const kaya = must(await api.post("/api/workspace/accounts", { name: "Kaya Yapı", type: "customer" }), "cari Kaya");
  const mehmet = must(await api.post("/api/workspace/accounts", { name: "Mehmet Usta", type: "customer" }), "cari Mehmet");
  const beta = must(await api.post("/api/workspace/accounts", { name: "Beta Mühendislik A.Ş.", type: "customer" }), "cari Beta");
  for (const a of [akcansa, yilmaz, kaya, mehmet, beta]) M.cari[a.id] = 0;
  const C = { akcansa: akcansa.id, yilmaz: yilmaz.id, kaya: kaya.id, mehmet: mehmet.id, beta: beta.id };
  const stockValue = () => R(Object.entries(M.stock).reduce((t, [id, q]) => t + q * M.cost[id], 0));
  check("Kasa açılış (nakit)", M.cash, (await cashReport()).totals.balance);

  // A) Stoğa mal alışı — KDV %20, kısmen peşin NAKİT, kalan açık
  section("A. Stoğa Mal Alışı (Akçansa): 1.000 torba × 100 + KDV %20 = 120.000; 20.000 nakit peşin, kalan açık");
  const A = must(await api.post("/api/workspace/invoices", { scenario: "goods_purchase", accountId: C.akcansa, number: "AKC-2026-0101", issueDate: TODAY, lines: [{ itemId: cimento.id, qty: 1000, unitPrice: 100, vatRate: 20 }], payment: { cash: [{ amount: 20000, method: "cash" }], rest: "open" } }), "A alış");
  M.cash -= 20000; M.cari[C.akcansa] -= 100000; M.stock[cimento.id] += 1000; M.kdvIn += 20000; M.purchaseNet += 100000;
  check("A fatura toplamı (ödenecek)", 120000, A.tryPayable);
  check("A ödenen (nakit)", 20000, A.paid); check("A açık", 100000, A.open);
  check("Kasa nakit", M.cash, (await cashReport()).totals.balance);
  check("Akçansa bakiyesi (alacaklı → −)", M.cari[C.akcansa], await balance(C.akcansa));
  check("Çimento stok (Torba)", 1000, (await stock(cimento.id)).qty, qty);

  // B) Stoğa mal alışı 2 — belge iskontosu %10, ödeme VERİLEN ÇEK 24.000 + açık
  section("B. Stoğa Mal Alışı (Akçansa): 2.000 kg demir × 25 = 50.000, belge iskontosu %10 → 45.000 + KDV 9.000 = 54.000; 24.000 verilen çek, kalan açık");
  const B = must(await api.post("/api/workspace/invoices", { scenario: "goods_purchase", accountId: C.akcansa, number: "AKC-2026-0102", issueDate: TODAY, discountRate: 10, lines: [{ itemId: demir.id, qty: 2000, unitPrice: 25, vatRate: 20 }], payment: { cheques: [{ instrument: "cheque", amount: 24000, dueDate: shift(30), serialNo: "VRL-001", bank: "İş Bankası" }], rest: "open" } }), "B alış");
  M.cari[C.akcansa] -= 30000; M.stock[demir.id] += 2000; M.kdvIn += 9000; M.purchaseNet += 45000;
  M.cost[demir.id] = 22.5; // mali müşavir kuralı: alış maliyeti iskonto SONRASI net birim fiyat (50.000 × 0,9 / 2.000 = 22,50)
  check("Demir birim maliyeti iskonto sonrası 22,50", 22.5, (await stock(demir.id)).unitPrice);
  check("B matrah (iskonto sonrası)", 45000, B.tryNet); check("B KDV", 9000, B.tryVat); check("B ödenecek", 54000, B.tryPayable);
  check("B ödenen (verilen çek)", 24000, B.paid); check("B açık", 30000, B.open);
  check("Akçansa bakiyesi", M.cari[C.akcansa], await balance(C.akcansa));
  check("Verilen çek borcu (ANLIK DURUM ödemeler · çek)", 24000, (await overview()).payable.cheques);
  check("Demir stok (Kg)", 2000, (await stock(demir.id)).qty, qty);

  // C) Stoktan satış — POS 14.000 + açık
  section("C. Stoktan Satış (Yılmaz): 300 torba × 150 = 45.000 + KDV 9.000 = 54.000; 14.000 POS, kalan açık");
  const Cinv = must(await api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: C.yilmaz, issueDate: TODAY, lines: [{ itemId: cimento.id, qty: 300, unitPrice: 150, vatRate: 20 }], payment: { cash: [{ amount: 14000, method: "card" }], rest: "open" } }), "C satış");
  M.bank += 14000; M.cari[C.yilmaz] += 40000; M.stock[cimento.id] -= 300; M.kdvOut += 9000; M.saleNet += 45000;
  check("C ödenen (POS)", 14000, Cinv.paid); check("C açık", 40000, Cinv.open);
  check("Kasa nakit DEĞİŞMEDİ (POS Kasa'ya girmez)", M.cash, (await cashReport()).totals.balance);
  check("Banka/POS bakiyesi", M.bank, await bank());
  check("Yılmaz bakiyesi (borçlu → +)", M.cari[C.yilmaz], await balance(C.yilmaz));
  check("Çimento stok", 700, (await stock(cimento.id)).qty, qty);

  // D) Stoktan satış — iki kalem, satır iskontosu, TAKSİTLİ (3 taksit)
  section("D. Stoktan Satış (Kaya): 200 torba × 150 + 100 kg demir × 30 (satır iskontosu %10) = 32.700 + KDV 6.540 = 39.240; 3 taksit");
  const D = must(await api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: C.kaya, issueDate: TODAY, lines: [{ itemId: cimento.id, qty: 200, unitPrice: 150, vatRate: 20 }, { itemId: demir.id, qty: 100, unitPrice: 30, vatRate: 20, discountRate: 10 }], payment: { rest: "installments", installments: { count: 3, firstDue: shift(30), everyMonths: 1 } } }), "D satış");
  M.cari[C.kaya] += 39240; M.stock[cimento.id] -= 200; M.stock[demir.id] -= 100; M.kdvOut += 6540; M.saleNet += 32700;
  check("D matrah", 32700, D.tryNet); check("D ödenecek", 39240, D.tryPayable);
  check("Kaya bakiyesi (taksitli satış çift borç YAZMAZ)", M.cari[C.kaya], await balance(C.kaya));
  const planD = (await api.get(`/api/workspace/plans?q=Kaya`)).data.plans?.find(p => p.accountId === C.kaya) || (await api.get(`/api/workspace/plans`)).data.plans?.[0];
  if (!planD) throw new Error("D taksit kartı bulunamadı");
  const planDetail = (await api.get(`/api/workspace/plans/${planD.id}`)).data;
  check("Taksit kartı toplamı", 39240, planDetail.totals?.total ?? planDetail.total);
  check("Taksit sayısı", 3, planDetail.items.length, qty);
  check("1. taksit tutarı", 13080, planDetail.items[0].amount);

  // E) Taksit tahsilatı nakit → satış faturası kısmen ödendi
  section("E. Kaya 1. taksiti nakit öder (13.080)");
  must(await api.post(`/api/workspace/plans/${planD.id}/entries`, { kind: "in", amount: 13080, date: TODAY, method: "cash", itemId: planDetail.items[0].id }), "taksit tahsilatı");
  M.cash += 13080; M.cari[C.kaya] -= 13080;
  check("Kasa nakit", M.cash, (await cashReport()).totals.balance);
  check("Kaya bakiyesi", M.cari[C.kaya], await balance(C.kaya));
  const D2 = await invoice(D.id);
  check("D fatura ödenen (taksit tahsilatı kapattı)", 13080, D2.paid); check("D fatura durumu (taksitli)", "installment", D2.payState);

  // F) Yılmaz'dan çek alınır (portföy)
  section("F. Yılmaz'dan 20.000 çek alınır (vade +45)");
  const cek = must(await api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", accountId: C.yilmaz, drawer: "Yılmaz İnşaat A.Ş.", amount: 20000, issueDate: TODAY, dueDate: shift(45), serialNo: "ALN-7781", bank: "Garanti" }), "çek alındı");
  M.cari[C.yilmaz] -= 20000;
  check("Yılmaz bakiyesi (çek alacağı düşer)", M.cari[C.yilmaz], await balance(C.yilmaz));
  check("Portföydeki çek (ANLIK DURUM alacaklar · çek)", 20000, (await overview()).receivable.cheques);
  const C2 = await invoice(Cinv.id);
  check("C fatura ödenen (POS 14.000 + alınan çek 20.000)", 34000, C2.paid);

  // G) Çek Akçansa'ya ciro edilir
  section("G. Çek Akçansa'ya ciro edilir");
  must(await api.post(`/api/workspace/cheques/${cek.id}/actions`, { action: "endorse", accountId: C.akcansa, date: TODAY }), "ciro");
  M.cari[C.akcansa] += 20000;
  check("Akçansa bakiyesi (ciro borcumuzu düşürdü)", M.cari[C.akcansa], await balance(C.akcansa));
  check("Portföy çeki kalmadı", 0, (await overview()).receivable.cheques);
  check("Çek durumu", "endorsed", (await api.get(`/api/workspace/cheques/${cek.id}`)).data.status);
  check("A fatura ödenen (nakit 20.000 + ciro 20.000)", 40000, (await invoice(A.id)).paid);

  // H) Akçansa'ya havale — A faturasına BAĞLI
  section("H. Akçansa'ya 30.000 havale (A faturasına bağlı ödeme)");
  must(await api.post(`/api/workspace/accounts/${C.akcansa}/entries`, { kind: "out", amount: 30000, date: TODAY, method: "bank", invoiceId: A.id, note: "A faturası ödemesi" }), "havale");
  M.bank -= 30000; M.cari[C.akcansa] += 30000;
  check("Banka/POS bakiyesi", M.bank, await bank());
  check("Kasa nakit değişmedi", M.cash, (await cashReport()).totals.balance);
  check("Akçansa bakiyesi", M.cari[C.akcansa], await balance(C.akcansa));
  const A3 = await invoice(A.id);
  check("A ödenen (20.000 + 20.000 + 30.000)", 70000, A3.paid); check("A açık", 50000, A3.open);
  check("A kapatanlar listesinde 'Bağlı' ödeme var", true, A3.closers.some(c => c.mode === "linked" && near(c.amount, 30000)), String);

  // I) Satıştan iade — 50 torba, para iadesi yok (açık hesaba)
  section("I. Satıştan İade (Yılmaz): C faturasından 50 torba → 7.500 + KDV 1.500 = 9.000, cariye alacak");
  const I = must(await api.post("/api/workspace/invoices", { kind: "sale_return", originalId: Cinv.id, issueDate: TODAY, lines: [{ originLineId: Cinv.lines[0].id, qty: 50 }], payment: {} }), "iade");
  M.cari[C.yilmaz] -= 9000; M.stock[cimento.id] += 50; M.kdvOut -= 1500; M.saleNet -= 7500;
  check("İade ödenecek", 9000, I.tryPayable);
  check("Yılmaz bakiyesi", M.cari[C.yilmaz], await balance(C.yilmaz));
  check("Çimento stok (iade geri girdi)", M.stock[cimento.id], (await stock(cimento.id)).qty, qty);
  check("C fatura ödenen (POS + çek + iade = 43.000)", 43000, (await invoice(Cinv.id)).paid);

  // J) Hizmet satışı + K) gider alışı aynı cariye → hayalet kısmi ödeme YOK; L) Mahsup
  section("J/K. Mehmet Usta: hizmet satışı 5.000 + KDV = 6.000 (açık) ve gider alışı 2.000 + KDV = 2.400 (açık) — karşılıklı");
  const J = must(await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: C.mehmet, issueDate: TODAY, lines: [{ itemId: nakliye.id, qty: 1, unitPrice: 5000, vatRate: 20 }], payment: { rest: "open" } }), "J hizmet satışı");
  const K = must(await api.post("/api/workspace/invoices", { scenario: "expense_purchase", accountId: C.mehmet, number: "MU-55", issueDate: TODAY, lines: [{ name: "Usta işçiliği", qty: 1, unitPrice: 2000, vatRate: 20, expenseCode: "other" }], payment: { rest: "open" } }), "K gider alışı");
  M.cari[C.mehmet] += 6000 - 2400; M.kdvOut += 1000; M.kdvIn += 400; M.saleNet += 5000; M.purchaseNet += 2000;
  check("Mehmet bakiyesi (6.000 − 2.400)", M.cari[C.mehmet], await balance(C.mehmet));
  check("J satış faturası AÇIK 6.000 (hayalet kısmi ödeme yok)", 6000, (await invoice(J.id)).open);
  check("K alış faturası AÇIK 2.400", 2400, (await invoice(K.id)).open);
  section("L. Mahsup Et: J ↔ K 2.400");
  must(await api.post(`/api/workspace/invoices/${J.id}/offsets`, { counterType: "invoice", counterId: K.id, amount: 2400, date: TODAY }), "mahsup");
  check("J ödenen (mahsup)", 2400, (await invoice(J.id)).paid); check("J açık", 3600, (await invoice(J.id)).open);
  check("K durumu Ödendi", "paid", (await invoice(K.id)).payState);
  check("Mehmet bakiyesi değişmedi (mahsup bakiye değiştirmez)", M.cari[C.mehmet], await balance(C.mehmet));

  // M) SMM — stopaj %20, havale tahsilat
  section("M. Serbest Meslek Makbuzu (Beta): brüt 10.000, stopaj %20, KDV %20 → ödenecek 10.000; havaleyle tahsil");
  const Minv = must(await api.post("/api/workspace/invoices", { scenario: "smm", accountId: C.beta, issueDate: TODAY, stoppageRate: 20, lines: [{ name: "Mühendislik Danışmanlığı", qty: 1, unitPrice: 10000, vatRate: 20 }], payment: { cash: [{ amount: 10000, method: "bank" }], rest: "open" } }), "SMM");
  M.bank += 10000; M.kdvOut += 2000; M.saleNet += 10000;
  check("SMM stopaj", 2000, Minv.stoppageTotal); check("SMM KDV", 2000, Minv.tryVat); check("SMM ödenecek", 10000, Minv.tryPayable);
  check("SMM durumu Ödendi", "paid", Minv.payState);
  check("Beta bakiyesi 0", 0, await balance(C.beta));
  check("Banka bakiyesi", M.bank, await bank());

  // N) Hizmet satışı tevkifatlı (9/10) — açık
  section("N. Hizmet Satışı tevkifatlı (Yılmaz): 10.000, KDV 2.000, tevkifat 9/10 = 1.800 → ödenecek 10.200, açık");
  const N = must(await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: C.yilmaz, issueDate: TODAY, lines: [{ name: "Etüt ve Proje Hizmeti", qty: 1, unitPrice: 10000, vatRate: 20, withholdingCode: "602" }], payment: { rest: "open" } }), "N tevkifatlı");
  M.cari[C.yilmaz] += 10200; M.kdvOut += 200; M.saleNet += 10000;
  check("N tevkifat", 1800, N.withheldTotal); check("N ödenecek", 10200, N.tryPayable);
  check("Yılmaz bakiyesi", M.cari[C.yilmaz], await balance(C.yilmaz));

  // O) Fiyat farkı faturası
  section("O. Fiyat Farkı Faturası (Kaya): 1.000 + KDV 200 = 1.200, açık");
  const O = must(await api.post("/api/workspace/invoices", { scenario: "price_difference", accountId: C.kaya, issueDate: TODAY, lines: [{ name: "Kur farkı", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open" } }), "O fiyat farkı");
  M.cari[C.kaya] += 1200; M.kdvOut += 200; M.saleNet += 1000;
  check("Kaya bakiyesi", M.cari[C.kaya], await balance(C.kaya));

  // P) Alıştan iade — 100 torba
  section("P. Alıştan İade (Akçansa): A faturasından 100 torba → 10.000 + KDV 2.000 = 12.000");
  const P = must(await api.post("/api/workspace/invoices", { kind: "purchase_return", originalId: A.id, issueDate: TODAY, lines: [{ originLineId: A.lines[0].id, qty: 100 }], payment: {} }), "alıştan iade");
  M.cari[C.akcansa] += 12000; M.stock[cimento.id] -= 100; M.kdvIn -= 2000; M.purchaseNet -= 10000;
  check("Akçansa bakiyesi", M.cari[C.akcansa], await balance(C.akcansa));
  check("Çimento stok", M.stock[cimento.id], (await stock(cimento.id)).qty, qty);
  check("A ödenen (+ iade 12.000 = 82.000)", 82000, (await invoice(A.id)).paid);

  // Q) KDV DAHİL fiyatla satış, nakit tahsilat
  section("Q. Stoktan Satış KDV DAHİL (Yılmaz): 10 kg demir × 36 (KDV dahil %20) → matrah 300, KDV 60, 360 nakit");
  const Q = must(await api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: C.yilmaz, issueDate: TODAY, pricesIncludeVat: true, lines: [{ itemId: demir.id, qty: 10, unitPrice: 36, vatRate: 20 }], payment: { cash: [{ amount: 360, method: "cash" }], rest: "open" } }), "Q KDV dahil");
  M.cash += 360; M.stock[demir.id] -= 10; M.kdvOut += 60; M.saleNet += 300;
  check("Q matrah", 300, Q.tryNet); check("Q KDV", 60, Q.tryVat); check("Q ödenecek", 360, Q.tryPayable); check("Q Ödendi", "paid", Q.payState);
  check("Kasa nakit", M.cash, (await cashReport()).totals.balance);
  check("Yılmaz bakiyesi değişmedi", M.cari[C.yilmaz], await balance(C.yilmaz));

  // R) KDV %10 ve %1 kalemler
  section("R. Hizmet Satışı (Kaya): 1.000 @ KDV %10 + 500 @ KDV %1 → KDV 105, ödenecek 1.605, açık");
  const Rinv = must(await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: C.kaya, issueDate: TODAY, lines: [{ name: "Bakım", qty: 1, unitPrice: 1000, vatRate: 10 }, { name: "Temel gıda yardımı", qty: 1, unitPrice: 500, vatRate: 1 }], payment: { rest: "open" } }), "R");
  M.cari[C.kaya] += 1605; M.kdvOut += 105; M.saleNet += 1500;
  check("R KDV", 105, Rinv.tryVat); check("Kaya bakiyesi", M.cari[C.kaya], await balance(C.kaya));

  // S) Taslak → kaydet → düzenle → iptal → sil
  section("S. Taslak → Kaydet → Düzenle (10→5) → İptal → Sil (Kaya, çimento)");
  const S0 = must(await api.post("/api/workspace/invoices", { status: "draft", scenario: "goods_sale", accountId: C.kaya, issueDate: TODAY, lines: [{ itemId: cimento.id, qty: 10, unitPrice: 150, vatRate: 20 }], payment: { rest: "open" } }), "taslak");
  check("Taslak stok düşürmez", M.stock[cimento.id], (await stock(cimento.id)).qty, qty);
  check("Taslak cariye yazmaz", M.cari[C.kaya], await balance(C.kaya));
  const S1 = must(await api.post(`/api/workspace/invoices/${S0.id}/issue`, {}), "taslağı kaydet");
  check("Kaydedince stok 10 düştü", M.stock[cimento.id] - 10, (await stock(cimento.id)).qty, qty);
  check("Kaydedince cari +1.800", M.cari[C.kaya] + 1800, await balance(C.kaya));
  must(await api.post(`/api/workspace/invoices/${S0.id}/edit`, { scenario: "goods_sale", accountId: C.kaya, issueDate: TODAY, lines: [{ itemId: cimento.id, qty: 5, unitPrice: 150, vatRate: 20 }], payment: { rest: "open" } }), "düzenle");
  check("Düzenle: stok 5 düştü (eski 10 geri geldi)", M.stock[cimento.id] - 5, (await stock(cimento.id)).qty, qty);
  check("Düzenle: cari +900", M.cari[C.kaya] + 900, await balance(C.kaya));
  check("Düzenle: numara aynı", S1.number, (await invoice(S0.id)).number, String);
  must(await api.post(`/api/workspace/invoices/${S0.id}/cancel`, { reason: "yanlış kesildi" }), "iptal");
  check("İptal: stok eski hâline", M.stock[cimento.id], (await stock(cimento.id)).qty, qty);
  check("İptal: cari eski hâline", M.cari[C.kaya], await balance(C.kaya));
  must(await api.del(`/api/workspace/invoices/${S0.id}?reason=test`), "sil");
  check("Sil: belge 404", 404, (await api.get(`/api/workspace/invoices/${S0.id}`)).status, qty);
  const trash = (await api.get("/api/admin/trash")).data;
  check("Sil: Silinenler'de fatura", true, (trash.items || trash).some?.(i => i.kind === "invoice") ?? false, String);

  // T) Kopya → kaydet → "Açık" (hayalet yok) → sil
  section("T. C faturasının kopyası (1 torba, açık) → 'Açık' kalır → sil");
  const T = must(await api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: C.yilmaz, issueDate: TODAY, lines: [{ itemId: cimento.id, qty: 1, unitPrice: 150, vatRate: 20 }], payment: { rest: "open" } }), "kopya");
  check("Kopya durumu Açık (ödenen 0)", 0, T.paid);
  must(await api.del(`/api/workspace/invoices/${T.id}?reason=kopya`), "kopya sil");
  check("Kopya silinince stok aynı", M.stock[cimento.id], (await stock(cimento.id)).qty, qty);
  check("Kopya silinince Yılmaz aynı", M.cari[C.yilmaz], await balance(C.yilmaz));

  // U) Toplu: 2 taslak → toplu kaydet → toplu iptal → toplu sil
  section("U. Toplu: 2 taslak → Seçilenleri Kaydet → İptal Et → Sil");
  const U1 = must(await api.post("/api/workspace/invoices", { status: "draft", scenario: "goods_sale", accountId: C.kaya, issueDate: TODAY, lines: [{ itemId: demir.id, qty: 20, unitPrice: 30, vatRate: 20 }], payment: { rest: "open" } }), "u1");
  const U2 = must(await api.post("/api/workspace/invoices", { status: "draft", scenario: "goods_sale", accountId: C.kaya, issueDate: TODAY, lines: [{ itemId: demir.id, qty: 30, unitPrice: 30, vatRate: 20 }], payment: { rest: "open" } }), "u2");
  const bi = must(await api.post("/api/workspace/invoices/bulk-issue", { ids: [U1.id, U2.id] }), "toplu kaydet");
  check("Toplu kaydet: 2 başarılı", 2, (bi.results || bi.items || []).filter(r => r.ok).length, qty);
  check("Toplu kaydet: demir 50 düştü", M.stock[demir.id] - 50, (await stock(demir.id)).qty, qty);
  must(await api.post("/api/workspace/invoices/bulk-cancel", { ids: [U1.id, U2.id], reason: "test" }), "toplu iptal");
  check("Toplu iptal: demir geri", M.stock[demir.id], (await stock(demir.id)).qty, qty);
  const bd = must(await api.post("/api/workspace/invoices/bulk-delete", { ids: [U1.id, U2.id], reason: "test" }), "toplu sil");
  check("Toplu sil: 2 silindi", 2, (bd.results || bd.items || []).filter(r => r.ok).length, qty);
  check("Kaya bakiyesi aynı", M.cari[C.kaya], await balance(C.kaya));

  // V) Tekrar (abonelik) ayarı
  section("V. J hizmet faturası aylık tekrara bağlanır, sonra durdurulur");
  const rep = await api.post(`/api/workspace/invoices/${J.id}/repeat`, { everyMonths: 1, nextDate: shift(30) });
  check("Tekrar ayarı 200", 200, rep.status, qty);
  check("Tekrar durdurma 200", 200, (await api.post(`/api/workspace/invoices/${J.id}/repeat-stop`, {})).status, qty);

  // W) PDF / Excel / UBL
  section("W. Belge çıktıları: fatura PDF, liste Excel, toplu PDF, UBL (e-Belge kapalı)");
  const pdf = await api.raw(`/api/workspace/invoices/${A.id}/fatura.pdf`);
  check("Fatura PDF", "%PDF", pdf.buffer.subarray(0, 4).toString(), String);
  check("Liste Excel 200", 200, (await api.raw(`/api/workspace/invoices/export.xlsx?tab=all`)).status, qty);
  check("Toplu PDF 200", 200, (await api.raw(`/api/workspace/invoices/toplu.pdf?ids=${A.id},${Cinv.id}`)).status, qty);
  const ubl = await api.raw(`/api/workspace/invoices/${A.id}/ubl.xml`);
  check("UBL XML (kapalıyken 200 ya da 403/404)", true, [200, 403, 404, 409].includes(ubl.status), String);

  // X) Verilen çek bankadan ödenir
  section("X. B faturasının verilen çeki (24.000) bankadan ödenir");
  const outCheque = (await api.get("/api/workspace/cheques?direction=out")).data.cheques?.find(c => c.status === "pending") || (await api.get("/api/workspace/cheques")).data.cheques?.find(c => c.direction === "out");
  must(await api.post(`/api/workspace/cheques/${outCheque.id}/actions`, { action: "pay", method: "bank", date: TODAY }), "çek ödeme");
  M.bank -= 24000;
  check("Banka bakiyesi", M.bank, await bank());
  check("Verilen çek borcu 0", 0, (await overview()).payable.cheques);
  check("Akçansa bakiyesi değişmedi (çek verilirken düşmüştü)", M.cari[C.akcansa], await balance(C.akcansa));

  // Y) Kasadan bankaya yatır
  section("Y. Kasadan bankaya 10.000 yatırılır (transfer)");
  must(await api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: 10000, date: TODAY }), "transfer");
  M.cash -= 10000; M.bank += 10000;
  check("Kasa nakit", M.cash, (await cashReport()).totals.balance); check("Banka", M.bank, await bank());

  // Z) Stok fire
  section("Z. Stok sayım farkı: 5 torba çimento çıkış (para hareketi yok)");
  must(await api.post(`/api/workspace/stock/${cimento.id}/moves`, { kind: "out", qty: 5, pay: "none", note: "Sayım farkı" }), "fire");
  M.stock[cimento.id] -= 5;
  check("Çimento stok", M.stock[cimento.id], (await stock(cimento.id)).qty, qty);

  // AA) Dönem kilidi
  section("AA. Dönem kilidi: düne kadar kilitle → dünkü tarihe Kasa hareketi reddedilir → kilit kaldır");
  must(await api.put("/api/admin/period-lock", { lockedUntil: shift(-1) }), "kilit");
  check("Kilitli tarihe hareket 409", 409, (await api.post("/api/workspace/cash", { kind: "in", amount: 1, date: shift(-1), method: "cash" })).status, qty);
  must(await api.put("/api/admin/period-lock", { lockedUntil: "" }), "kilit kaldır");

  // ---------- RAPORLAR ----------
  section("Raporlar: ANLIK DURUM, Kasa, banka/POS, cari mizan, stok, KDV özeti, hesap mizanı, açık faturalar, çek, taksit");
  const ov = await overview();
  check("ANLIK DURUM Nakit Kasa", M.cash, ov.cash.balance);
  check("ANLIK DURUM Banka/POS", M.bank, ov.cash.bank.balance);
  const debtors = Object.values(M.cari).filter(v => v > 0).reduce((a, b) => a + b, 0);
  const creditors = -Object.values(M.cari).filter(v => v < 0).reduce((a, b) => a + b, 0);
  check("ANLIK DURUM Toplam Alacak (cari borçlular, portföy çeki yok)", R(debtors), ov.receivable.total);
  check("ANLIK DURUM Toplam Borç (Akçansa)", R(creditors), ov.payable.total);
  check("ANLIK DURUM Stok Değeri (miktar × maliyet)", stockValue(), ov.stock.value);
  check("ANLIK DURUM bu ay satış (KDV hariç, iade düşülmüş, SMM dahil)", R(M.saleNet), ov.invoices.month.sale);
  check("ANLIK DURUM bu ay alış (KDV hariç, iade düşülmüş)", R(M.purchaseNet), ov.invoices.month.purchase);
  check("ANLIK DURUM ay KDV (391 − 191)", R(M.kdvOut - M.kdvIn), ov.invoices.month.vat);
  // Taksitli fatura (D) açık fatura sayılmaz: alacağı taksit kartında izlenir (ANLIK DURUM kuralı).
  const openSaleExpected = R((40000 - 20000 - 9000) /*C*/ + 3600 /*J*/ + 10200 /*N*/ + 1200 /*O*/ + 1605 /*R*/);
  check("Açık satış faturaları toplamı (taksitli D hariç)", openSaleExpected, ov.invoices.openSale);
  check("Açık alış faturaları toplamı (A 38.000 + B 30.000)", 68000, ov.invoices.openPurchase);
  const kasaRep = await report("kasa-hareketleri", "preset=thisMonth");
  check("Kasa Hareketleri raporu dönem sonu bakiye", M.cash, summaryOf(kasaRep, "Dönem Sonu Kasa"));
  const bankaRep = await report("banka-pos-hareketleri", "preset=thisMonth");
  check("Banka ve POS Hareketleri raporu bakiye", M.bank, summaryOf(bankaRep, "Dönem Sonu"));
  const mizan = (await api.get("/api/workspace/overview/mizan?preset=thisMonth")).data;
  check("Cari mizanı borçlular toplamı", R(debtors), mizan.totals.closingDebtor);
  check("Cari mizanı alacaklılar toplamı", R(creditors), mizan.totals.closingCreditor);
  const stokRep = await report("stok-durumu", "");
  check("Stok Durumu raporu toplam değer", stockValue(), summaryOf(stokRep, "Toplam Değer") ?? summaryOf(stokRep, "Stok Değeri"));
  const kdv = await report("kdv-ozeti", "preset=thisMonth");
  check("KDV Özeti hesaplanan (391)", R(M.kdvOut), summaryOf(kdv, "Hesaplanan KDV (391)"));
  check("KDV Özeti indirilecek (191)", R(M.kdvIn), summaryOf(kdv, "İndirilecek KDV (191)"));
  check("KDV Özeti sonuç (devreden)", R(Math.abs(M.kdvOut - M.kdvIn)), summaryOf(kdv, M.kdvOut - M.kdvIn >= 0 ? "Ödenecek KDV" : "Devreden KDV"));
  const ledger = (await api.get(`/api/workspace/ledger?from=${MONTH_START}&to=${TODAY}`)).data;
  check("Hesap mizanı Borç = Alacak", true, ledger.trial.balanced, String);
  check("Ana Defter ↔ alt defterler mutabakatı", true, ledger.reconciliation.ok, String);
  const acct = code => ledger.trial.accounts.find(a => a.code === code)?.balance ?? null;
  check("100 Kasa bakiyesi (defter)", M.cash, acct("100"));
  check("102 Banka + 108 POS (defter)", M.bank, R((acct("102") ?? 0) + (acct("108") ?? 0)));
  const integ = (await api.get("/api/workspace/ledger/integrity")).data;
  check("Mutabakat testi (tüm denetimler) temiz", true, integ.ok ?? integ.summary?.ok ?? (integ.problems?.length === 0), String);
  const acik = await report("acik-faturalar", "");
  check("Açık Faturalar raporu satır sayısı (5 satış + 2 alış; taksitli hariç)", 7, acik.total ?? acik.rows.length, qty);
  const cekRep = await report("cek-portfoy", "status=open");
  check("Çek Portföyü raporu açık evrak 0", 0, cekRep.total ?? cekRep.rows.length, qty);
  check("Çek raporu özeti: Portföyde (alınan) 0", 0, summaryOf(cekRep, "Portföyde (alınan)"));
  const taksit = await report("taksit-kartlari", "");
  check("Taksit Kartları raporu 1 kart", 1, taksit.total ?? taksit.rows.length, qty);
  const ekstre = await report("cari-ekstre", `preset=thisMonth&account=${C.yilmaz}`);
  check("Yılmaz Cari Ekstre dönem sonu bakiye", M.cari[C.yilmaz], summaryOf(ekstre, "Dönem Sonu"));
  for (const id of ["fatura-satis", "fatura-alis", "fatura-iade", "hesap-mizani", "yevmiye", "defter-mutabakati", "mizan", "alacak-yaslandirma", "urun-satis-karlilik", "stopaj-tevkifat", "ba-bs", "stok-hareketleri", "cek-hareketleri", "kasa-gunluk"]) {
    const r = await api.get(`/api/workspace/report-center/${id}?preset=thisMonth`);
    const p = await api.raw(`/api/workspace/report-center/${id}/pdf?preset=thisMonth`);
    check(`Rapor ${id}: JSON + PDF`, true, r.status === 200 && p.status === 200 && p.buffer.subarray(0, 4).toString() === "%PDF", String);
  }

  // ---------- Çoklu şirket ----------
  section("Çoklu şirket: 002 açılır, orada 5.000 nakit; birleşik rapor; 001 etkilenmez; 002 sıfırlanır");
  const co = must(await api.post("/api/companies", { name: "Demir Nakliyat Ltd.", select: true }), "002");
  must(await api.post("/api/workspace/cash", { kind: "in", amount: 5000, date: TODAY, method: "cash", description: "Sermaye" }), "002 kasa");
  check("002 Kasa", 5000, (await cashReport()).totals.balance);
  check("002 cari sayısı 0", 0, (await api.get("/api/workspace/accounts")).data.accounts.length, qty);
  const combined = (await api.get("/api/companies/report")).data;
  const byCode = Object.fromEntries(combined.rows.map(r => [r.code, r]));
  check("Birleşik rapor 001 Nakit Kasa", M.cash, byCode["001"].cash);
  check("Birleşik rapor 002 Nakit Kasa", 5000, byCode["002"].cash);
  check("Birleşik rapor TOPLAM Nakit Kasa", R(M.cash + 5000), combined.totals[1]);
  check("Birleşik rapor 001 cari alacak", R(debtors), byCode["001"].receivable);
  must(await api.post(`/api/companies/${co.company.id}/reset`, { mode: "all", confirm: co.company.code, password: ADMIN_PASSWORD }), "002 sıfırla");
  check("002 sıfırlandı: Kasa 0", 0, (await cashReport()).totals.balance);
  must(await api.post("/api/companies/select", { id: "sirket-001" }), "001'e dön");
  check("001 Kasa aynı", M.cash, (await cashReport()).totals.balance);
  check("001 Akçansa aynı", M.cari[C.akcansa], await balance(C.akcansa));
} catch (error) {
  console.error("\nHATA:", error.message);
  rows.push({ step, label: `HATA: ${error.message}`, expected: "-", actual: "-", ok: false });
}

// ---------- Rapor ----------
const passed = rows.filter(r => r.ok).length;
const md = [`# 2.0.17 — Mali Müşavir Testi (gerçek şirket işlemleri, bağımsız modelle karşılaştırma)`, "",
  `Tarih: ${TODAY} · Sonuç: **${passed} / ${rows.length} denetim geçti**. Betik: \`node test/mali-musavir-217.mjs\` (her koşuda yeniden üretilir).`, "",
  "Beklenen tutarlar programdan değil, mali müşavirin kendi defterinden (betik içindeki bağımsız model: Kasa, banka, cari, stok, KDV) gelir; her adımdan sonra programın verdiği gerçek tutarla karşılaştırılır.", "",
  "| Adım | Denetim | Beklenen | Gerçek | Sonuç |", "|---|---|---|---|---|",
  ...rows.map(r => `| ${r.step.split(":")[0].slice(0, 40)} | ${r.label} | ${r.expected} | ${r.actual} | ${r.ok ? "✅" : "❌"} |`), ""].join("\n");
writeFileSync(new URL("../docs/2.0.17-MALI-MUSAVIR-TESTI.md", import.meta.url), md);
console.log(`\n${passed} / ${rows.length} denetim geçti.`);
await server.close();
process.exit(passed === rows.length ? 0 : 1);
