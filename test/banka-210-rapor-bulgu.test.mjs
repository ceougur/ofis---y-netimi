// 2.1.0 — Plan testlerinin eksiklerini tamamlarken (raporlar-210-banka, bankalı veriyle bütün raporlar) bulunan iki rapor hatası; önce
// kırmızı test, sonra en küçük düzeltme (docs/2.1.0-KANIT.md "Plan Testleri — Eksiklerin Tamamlanması").
//
// R1 (Orta–Yüksek; v2.0.23 ve v2.0.26'da da VAR — gerçek etiket koduyla ölçüldü): satıştan iadenin GERİ ÖDEMESİ (müşteriye nakit/havale) fatura
//    kapamada yanlış tarafta sayılıyordu (lib/invoice-settle.mjs classifyLine: kaynağı fatura olan "out" satırı → borç tarafında ÖDEME). Sonuç:
//    (a) iade alacağı en eski AÇIK satış faturasını FIFO ile "Ödendi" yapıyor, geri ödeme bunu geri açmıyor → müşteri borçlu (bakiye 120) ama
//        Açık Faturalar, Alacak Yaşlandırma, Vade Takip ve zil/takvimde alacak yok;
//    (b) aynı cariye açık ALIŞ faturası varsa müşteriye yapılan geri ödeme onu "Ödendi" gösteriyordu (hayalet ödeme, 2.0.17 m5'in akrabası).
//    Simetrik: alıştan iadenin tedarikçiden geri alınan parası satış faturasını kapatıyordu.
//    Değişmez (plan §3.4, 2.0.23 Bulgu 2): açık fatura + kart kalanı = cari bakiye.
// R2 (Orta; 2.0.15'ten beri): Gider Raporu (Türüne Göre) aynı aydaki bütün gider türlerini tek satırda birleştiriyordu: SQL'deki
//    "GROUP BY month, code" takma ad yerine invoice_lines.code (ürün kodu, giderde boş) kolonunu alıyor; satır adı rastgele bir türün adı
//    ("Kira 2.100" ya da "Diğer Giderler"). KDV'li banka masrafının türü ("Banka Masrafları") raporun ad listesinde de yoktu. Toplam doğruydu.
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { apiOf } from "./banka-210-ortak.mjs";

const pad = n => String(n).padStart(2, "0");
const dayOf = offset => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const moneyOf = cell => {
  const match = /^(-|−)?((?:\d{1,3}(?:\.\d{3})*|\d+)),(\d{2}) TL$/.exec(String(cell ?? "").trim());
  return match ? Number(`${match[1] ? "-" : ""}${match[2].replace(/\./g, "")}.${match[3]}`) : null;
};
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};

describe("R1 — iade geri ödemesi fatura kapamada (açık fatura + kart kalanı = cari bakiye)", () => {
  let server;
  let api;
  let bank;
  // Her senaryo kendi boş sunucusunda (fatura seri/tarih sırası senaryolar arasında karışmasın).
  beforeEach(async () => {
    server = await startTestServer();
    api = apiOf(await loginAdmin(server));
    bank = await must("hesap", api.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", opening: { date: dayOf(-90), amount: "50.000", confirmed: true } }));
  });
  afterEach(() => server?.close());
  const summary = (data, label) => moneyOf(data.summary.find(([name]) => name === label)?.[1]);
  const invoiceState = async id => {
    const doc = await must("fatura", api.get(`/api/workspace/invoices/${id}`));
    return [doc.payState, doc.open];
  };
  // Müşteriye açık satış (120) + peşin ödenmiş ikinci satış (1.200) → ikincinin tamamı iade, parası geri ödenir.
  async function scenario(name, refund) {
    const party = await must("cari", api.post("/api/workspace/accounts", { name, type: "customer", registeredOn: dayOf(-100) }));
    const open = await must("açık satış", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: party.id, issueDate: dayOf(-50), lines: [{ name: "Hizmet", qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open", dueDate: dayOf(-40) } }));
    const pay = refund === "bank" ? { method: "bank", bankAccountId: bank.id } : { method: "cash" };
    const paid = await must("peşin satış", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: party.id, issueDate: dayOf(-30), lines: [{ name: "Hizmet", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { cash: [{ amount: 1200, ...pay }], rest: "open" } }));
    const detail = await must("fatura", api.get(`/api/workspace/invoices/${paid.id}`));
    await must("iade + geri ödeme", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: paid.id, issueDate: dayOf(-25), lines: [{ originLineId: detail.lines[0].id, qty: 1 }], payment: { cash: [{ amount: refund === "partial" ? 500 : 1200, ...pay }], rest: "open" }, cashForce: true }));
    return { party, open, paid };
  }

  it("R1a: geri ödeme NAKİT → açık satış 120 Açık kalır (Vadesi Geçti); Açık Faturalar ve Yaşlandırma 120 = cari bakiye", async () => {
    const { party, open } = await scenario("Cem Nakit", "cash");
    const card = await must("cari", api.get(`/api/workspace/accounts/${party.id}`));
    assert.equal(card.totals.balance, 120, "cari bakiye 120 (bağımsız: 120 + 1.200 − 1.200 − 1.200 + 1.200)");
    assert.deepEqual(await invoiceState(open.id), ["overdue", 120], "ödenmemiş fatura açık kalır");
    const report = await must("açık faturalar", api.get(`/api/workspace/report-center/acik-faturalar?account=${party.id}`));
    assert.equal(summary(report, "Açık Alacak"), 120, "Açık Faturalar = bakiye");
  });

  it("R1b: geri ödeme HAVALE (Garanti, hesaba bağlı) → aynı sonuç; Garanti 50.000 + 1.200 − 1.200", async () => {
    const { party, open } = await scenario("Cem Havale", "bank");
    assert.deepEqual(await invoiceState(open.id), ["overdue", 120]);
    const aging = await must("yaşlandırma", api.get("/api/workspace/report-center/alacak-yaslandirma"));
    const row = aging.rows.find(cells => cells[0] === "Cem Havale");
    assert.ok(row, "yaşlandırmada Cem Havale");
    assert.equal(moneyOf(row.at(-1)), 120, "yaşlandırma toplamı 120");
    assert.equal((await must("Garanti", api.get(`/api/workspace/bank/accounts/${bank.id}`))).balanceMinor, 5_000_000);
    assert.equal((await must("cari", api.get(`/api/workspace/accounts/${party.id}`))).totals.balance, 120);
  });

  it("R1c: KISMİ geri ödeme (500 / 1.200) → iade alacağından artan 700 açık satışı kapatır (FIFO), 580 müşterinin alacağı; açık 0", async () => {
    const { party, open } = await scenario("Cem Kısmi", "partial");
    assert.deepEqual(await invoiceState(open.id), ["paid", 0]);
    assert.equal((await must("cari", api.get(`/api/workspace/accounts/${party.id}`))).totals.balance, -580);
  });

  it("R1d: aynı cariye açık ALIŞ faturası (500) varken müşteriye iade geri ödemesi alış faturasını ÖDEMEZ (hayalet ödeme yok)", async () => {
    const party = await must("cari", api.post("/api/workspace/accounts", { name: "Hem Müşteri Hem Tedarikçi", type: "customer", registeredOn: dayOf(-100) }));
    const purchase = await must("alış", api.post("/api/workspace/invoices", { scenario: "expense_purchase", accountId: party.id, number: "AL-R1D", issueDate: dayOf(-60), lines: [{ name: "Danışmanlık", expenseCode: "advisory", qty: 1, unitPrice: 500, vatRate: 0 }], payment: { rest: "open", dueDate: dayOf(-30) } }));
    const sale = await must("peşin satış", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: party.id, issueDate: dayOf(-20), lines: [{ name: "Hizmet", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { cash: [{ amount: 1200, method: "cash" }], rest: "open" } }));
    const detail = await must("fatura", api.get(`/api/workspace/invoices/${sale.id}`));
    await must("iade + geri ödeme", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: sale.id, issueDate: dayOf(-10), lines: [{ originLineId: detail.lines[0].id, qty: 1 }], payment: { cash: [{ amount: 1200, method: "cash" }], rest: "open" }, cashForce: true }));
    assert.deepEqual(await invoiceState(purchase.id), ["overdue", 500], "alış faturası açık 500 (müşteriye iade ödemesi tedarikçiye ödeme değildir)");
    assert.equal((await must("cari", api.get(`/api/workspace/accounts/${party.id}`))).totals.balance, -500, "cari: bize 500 alacaklı");
  });

  it("R1e: simetrik — alıştan iadenin tedarikçiden GERİ ALINAN parası aynı cariye kesilmiş açık SATIŞ faturasını kapatmaz", async () => {
    const party = await must("cari", api.post("/api/workspace/accounts", { name: "Tedarikçi ve Müşteri", type: "supplier", registeredOn: dayOf(-100) }));
    const sale = await must("açık satış", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: party.id, issueDate: dayOf(-60), lines: [{ name: "Hizmet", qty: 1, unitPrice: 300, vatRate: 0 }], payment: { rest: "open", dueDate: dayOf(-30) } }));
    const item = await must("ürün", api.post("/api/workspace/stock", { kind: "goods", code: "R1E", name: "Ürün R1E", unit: "Adet" }));
    const purchase = await must("peşin alış", api.post("/api/workspace/invoices", { scenario: "goods_purchase", accountId: party.id, number: "AL-R1E", issueDate: dayOf(-20), lines: [{ itemId: item.id, qty: 10, unitPrice: 100, vatRate: 0 }], payment: { cash: [{ amount: 1000, method: "bank", bankAccountId: bank.id }], rest: "open" } }));
    const detail = await must("alış", api.get(`/api/workspace/invoices/${purchase.id}`));
    await must("alıştan iade + para geri", api.post("/api/workspace/invoices", { kind: "purchase_return", originalId: purchase.id, issueDate: dayOf(-10), lines: [{ originLineId: detail.lines[0].id, qty: 10 }], payment: { cash: [{ amount: 1000, method: "bank", bankAccountId: bank.id }], rest: "open" } }));
    assert.deepEqual(await invoiceState(sale.id), ["overdue", 300], "satış faturası açık 300 (tedarikçiden geri alınan para müşteri tahsilatı değildir)");
    assert.equal((await must("cari", api.get(`/api/workspace/accounts/${party.id}`))).totals.balance, 300, "cari: bize 300 borçlu");
  });
});

describe("R2 — Gider Raporu (Türüne Göre): her gider türü ayrı satır; KDV'li banka masrafı \"Banka Masrafları\"", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer();
    api = apiOf(await loginAdmin(server));
  });
  after(() => server?.close());

  it("aynı ayda Kira 2.000, Elektrik 300 ve KDV'li banka masrafı 100 → üç satır, doğru adlar ve tutarlar; toplam 2.400", async () => {
    const day = dayOf(-1);
    const supplier = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Gider Tedarikçisi", type: "supplier", registeredOn: dayOf(-30) }));
    const bankParty = await must("banka cari", api.post("/api/workspace/accounts", { name: "Ziraat Bankası A.Ş.", type: "supplier", registeredOn: dayOf(-30) }));
    const bank = await must("hesap", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: dayOf(-20), amount: "10.000", confirmed: true } }));
    await must("kira", api.post("/api/workspace/invoices", { scenario: "expense_purchase", accountId: supplier.id, number: "G-1", issueDate: day, lines: [{ name: "Ofis Kirası", expenseCode: "rent", qty: 1, unitPrice: 2000, vatRate: 20 }], payment: { rest: "open" } }));
    await must("elektrik", api.post("/api/workspace/invoices", { scenario: "expense_purchase", accountId: supplier.id, number: "G-2", issueDate: day, lines: [{ name: "Elektrik", expenseCode: "utilities", qty: 1, unitPrice: 300, vatRate: 20 }], payment: { rest: "open" } }));
    await must("banka masrafı", api.post("/api/workspace/bank/vouchers", { type: "fee", accountId: bank.id, date: day, amount: "120", feeType: "eft", tax: "vat_incl", taxRate: "20", partyId: bankParty.id, invoiceNo: "ZB-G-1" }));
    const report = await must("gider raporu", api.get(`/api/workspace/report-center/gider-raporu?from=${day}&to=${day}`));
    const rows = Object.fromEntries(report.rows.map(row => [row[1], { account: row[2], count: row[3], net: moneyOf(row[4]), vat: moneyOf(row[5]) }]));
    assert.deepEqual(rows, {
      Kira: { account: "770", count: "1", net: 2000, vat: 400 },
      "Elektrik, Su ve Doğalgaz": { account: "770", count: "1", net: 300, vat: 60 },
      "Banka Masrafları": { account: "770", count: "1", net: 100, vat: 20 },
    }, JSON.stringify(report.rows));
    assert.equal(moneyOf(report.summary.find(([name]) => name === "Toplam Gider")[1]), 2400);
  });
});
