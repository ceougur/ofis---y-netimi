// Büyük birim fiyat / miktar (2.1.0 son aday, Uzun Doğrulama mutabakat tohum 4, işlem 4655 ve 4766): faturada 1.048.576 TL ve
// üstündeki ondalıklı birim fiyatın (ör. 1.234.567,89) ~%10'u "birim fiyat en çok dört ondalık basamak olabilir" diye reddediliyordu.
// Kök neden (server/lib/invoice-math.mjs computeLine, 2.0.15'ten beri; v2.0.26'da da var): denetim |fiyat × 10.000 − yuvarlanmış| > 1e-6
// mutlak toleransla yapılıyordu; 1.234.567,89 × 10.000 kayan noktada 12345678900,000002 olur (fark 1,9e-6) → geçerli fiyat reddedilir.
// Sunucu fiyatı zaten 4 ondalığa yuvarlayıp hesaba verdiği için program KENDİ yuvarladığı fiyatı reddediyordu. Miktar denetiminde
// (3 ondalık) aynı hata 16.777.216 (2^24) üstünde. Beklenen sayılar programdan değil, tamsayı (BigInt) ile elle hesaplanır.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { computeInvoice } from "../server/lib/invoice-math.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

// Bağımsız beklenen: "1234567,89" gibi metinden kuruş (BigInt); KDV yarım yukarı.
const centsOf = text => {
  const [int, frac = ""] = String(text).split(".");
  return BigInt(int) * 100n + BigInt((frac + "00").slice(0, 2));
};
const vatOf = (net, rate) => (2n * net * BigInt(rate) + 100n) / 200n;

// Eski denetimde reddedilen, 2 ya da 4 ondalıklı, kuruşu tam fiyatlar (ilk ikisi motorun ürettiği türden: Kasa bakiyesi + kuruş).
const PRICES = ["1234567.89", "1225763.39", "1619533.61", "1048576.1884"];
// Eski miktar denetiminde reddedilen 3 ondalıklı miktarlar (2^24 üstü).
const QTYS = ["16777220.538", "16777228.457"];

describe("Faturada büyük birim fiyat ve miktar (kayan nokta toleransı)", () => {
  test("çalışıyor mu: 1.048.576 TL üstü ondalıklı birim fiyat reddedilmez; matrah, KDV, toplam kuruşu kuruşuna", () => {
    for (const price of PRICES.filter(p => (p.split(".")[1] || "").length <= 2)) {
      const { totals } = computeInvoice([{ qty: 1, unitPrice: Number(price), vatRate: 20 }]);
      const net = centsOf(price);
      const vat = vatOf(net, 20);
      assert.deepEqual([totals.net, totals.vat, totals.gross], [Number(net), Number(vat), Number(net + vat)], price);
    }
    // 4 ondalıklı fiyat: 1 adet → kuruşa yarım yukarı (1.048.576,1884 → 1.048.576,19).
    const { totals } = computeInvoice([{ qty: 1, unitPrice: 1048576.1884, vatRate: 0 }]);
    assert.equal(totals.net, 104857619);
  });
  test("çalışıyor mu: 16.777.216 üstü 3 ondalıklı miktar reddedilmez", () => {
    for (const qty of QTYS) {
      const { totals } = computeInvoice([{ qty: Number(qty), unitPrice: 1, vatRate: 0 }]);
      const [int, frac] = qty.split(".");
      // miktar × 1 TL → kuruş, yarım yukarı (3. ondalık).
      const milli = BigInt(int) * 1000n + BigInt(frac);
      assert.equal(totals.net, Number((milli + 5n) / 10n), qty);
    }
  });
  test("nasıl bozarım: 5 ondalıklı fiyat ve 4 ondalıklı miktar hâlâ reddedilir (küçük ve büyük tutarda)", () => {
    for (const unitPrice of [1.23456, 1234567.12345, 0.00001, 1e-7]) {
      assert.throws(() => computeInvoice([{ qty: 1, unitPrice, vatRate: 20 }]), /birim fiyat en çok dört ondalık/, String(unitPrice));
    }
    for (const qty of [1.2345, 16777220.5385, 1e-7]) {
      assert.throws(() => computeInvoice([{ qty, unitPrice: 1, vatRate: 20 }]), /miktar en çok üç ondalık/, String(qty));
    }
    // Kayan nokta artığı basamak sayılmaz (eski toleransın küçük tutardaki davranışı korunur): 12,34 + artık, 0,1 + 0,2.
    assert.equal(computeInvoice([{ qty: 1, unitPrice: 12.340000000000002, vatRate: 0 }]).totals.net, 1234);
    assert.equal(computeInvoice([{ qty: 0.1 + 0.2, unitPrice: 10, vatRate: 0 }]).totals.net, 300);
    // Sınırda geçerli olanlar: 4 ondalık fiyat × 3 ondalık miktar (0,1000001 TL → 10 kuruş), büyük tam sayılar.
    assert.equal(computeInvoice([{ qty: 1000.001, unitPrice: 0.0001, vatRate: 0 }]).totals.net, 10);
    assert.equal(computeInvoice([{ qty: 1e6, unitPrice: 1e6, vatRate: 0 }]).totals.net, 1e14);
  });
});

describe("API: büyük birim fiyatlı fatura kaydedilir (ekrandaki gibi metin ve sayı)", () => {
  let server;
  let api;
  const ids = {};
  before(async () => {
    server = await startTestServer();
    api = await loginAdmin(server);
    ids.customer = (await api.post("/api/workspace/accounts", { name: "Büyük Tutar Otomotiv", type: "customer" })).data.data.id;
    ids.supplier = (await api.post("/api/workspace/accounts", { name: "Büyük Tutar Makine", type: "supplier" })).data.data.id;
  });
  after(async () => server?.close());

  test("satış (metin \"1.234.567,89\", ekran biçimi) ve alış (sayı 1225763.39): 200, ödenecek elle hesaplanan", async () => {
    const sale = await api.post("/api/workspace/invoices", { kind: "sale", accountId: ids.customer, lines: [{ name: "Araç", qty: "1", unitPrice: "1.234.567,89", vatRate: 20 }], payment: { rest: "open" } });
    assert.equal(sale.status, 200, JSON.stringify(sale.data));
    const net = centsOf("1234567.89");
    assert.equal(Math.round(sale.data.data.tryPayable * 100), Number(net + vatOf(net, 20)));
    // Motorun "fatura-acid/kasa" yolundaki gibi: alış, birim fiyat sayı (2 ondalık), açık.
    const purchase = await api.post("/api/workspace/invoices", { kind: "purchase", accountId: ids.supplier, number: "BT-1", lines: [{ name: "Makine", qty: 1, unitPrice: 1225763.39, vatRate: 20, expenseCode: "asset" }], payment: { rest: "open" } });
    assert.equal(purchase.status, 200, JSON.stringify(purchase.data));
    const pnet = centsOf("1225763.39");
    assert.equal(Math.round(purchase.data.data.tryPayable * 100), Number(pnet + vatOf(pnet, 20)));
    // Kayıtlı kalem fiyatı yazılan fiyat (yuvarlama yok).
    const card = await api.get(`/api/workspace/invoices/${purchase.data.data.id}`);
    assert.equal(card.status, 200);
    const line = (card.data.data.lines || card.data.data.invoice?.lines || [])[0];
    assert.equal(line?.unitPrice, 1225763.39, JSON.stringify(line));
  });
});
