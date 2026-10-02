// Fatura 2.0.16 — müşteri bildirimleri (CLAUDE.md "2.0.16 müşteri hataları").
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { computeInvoice, exclusiveParts } from "../server/lib/invoice-math.mjs";
import { buildUbl } from "../server/lib/einvoice/ubl-tr.mjs";
import { inflateSync } from "node:zlib";
import { loginAdmin, startTestServer } from "./helpers.mjs";

// PDF'teki görünen metin (fatura-215 ile aynı yöntem): ToUnicode eşlemesiyle sayfa akışlarındaki glifler çözülür.
function pdfText(buffer) {
  const text = buffer.toString("latin1");
  const objects = new Map([...text.matchAll(/(\d+) 0 obj\n?([\s\S]*?)\nendobj/g)].map(match => [Number(match[1]), match[2]]));
  const stream = body => {
    const match = /stream\n([\s\S]*?)\nendstream/.exec(body || "");
    if (!match) return "";
    try {
      return /FlateDecode/.test(body) ? inflateSync(Buffer.from(match[1], "latin1")).toString("latin1") : match[1];
    } catch {
      return "";
    }
  };
  const fonts = new Map();
  for (const body of objects.values()) {
    for (const [, name, id] of (/\/Font << ([^>]*) >>/.exec(body)?.[1] || "").matchAll(/\/(\w+) (\d+) 0 R/g)) {
      if (fonts.has(name)) continue;
      const cmap = new Map();
      const unicode = /\/ToUnicode (\d+) 0 R/.exec(objects.get(Number(id)) || "");
      for (const [, gid, hex] of stream(objects.get(Number(unicode?.[1]))).matchAll(/<([0-9A-F]{4})> <([0-9A-F]+)>/g)) cmap.set(gid, String.fromCodePoint(...hex.match(/.{4}/g).map(part => parseInt(part, 16))));
      fonts.set(name, cmap);
    }
  }
  const out = [];
  for (const body of objects.values()) {
    if (!/\/Length/.test(body) || /ToUnicode|FontFile|beginbfchar|DCTDecode/.test(body)) continue;
    for (const [, font, glyphs] of stream(body).matchAll(/\/(\w+) [\d.]+ Tf [^<]*<([0-9A-F]*)> Tj/g)) out.push((glyphs.match(/.{4}/g) || []).map(gid => fonts.get(font)?.get(gid) ?? "?").join(""));
  }
  return out.join("\n");
}

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  raw: (...args) => client.raw(...args),
});
const pad = value => String(value).padStart(2, "0");
const iso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const shift = days => iso(new Date(Date.now() + days * 86_400_000));

describe("KDV dahil fiyatta iskonto gösterimi (müşteri, 02.10.2026)", () => {
  test("2.000 TL KDV dahil, %10 iskonto: Ara Toplam 1.666,67 − İskonto 166,67 = Matrah 1.500,00; KDV 300,00", () => {
    const { totals } = computeInvoice([{ qty: 1, unitPrice: 2000, discountRate: 10, vatRate: 20 }], { pricesIncludeVat: true });
    assert.deepEqual([totals.baseNet, totals.discountNet, totals.net, totals.vat, totals.gross], [166667, 16667, 150000, 30000, 180000]);
  });
  test("%20 iskonto: 1.666,67 − 333,34 = 1.333,33; KDV 266,67; toplam 1.600,00", () => {
    const { totals } = computeInvoice([{ qty: 1, unitPrice: 2000, discountRate: 20, vatRate: 20 }], { pricesIncludeVat: true });
    assert.deepEqual([totals.baseNet, totals.discountNet, totals.net, totals.vat, totals.gross], [166667, 33334, 133333, 26667, 160000]);
  });
  test("satırlar her durumda kuruşu kuruşuna toplar (Ara Toplam − İskonto = Matrah); KDV hariçte değişiklik yok", () => {
    for (const include of [true, false]) {
      for (let seed = 1; seed < 200; seed += 1) {
        const lines = [1, 2, 3].map(i => ({ qty: ((seed * i) % 7) + 1, unitPrice: ((seed * 37 * i) % 5000) / 100 + 0.01, discountRate: (seed * i) % 35, vatRate: [0, 1, 10, 20][(seed + i) % 4] }));
        const { totals } = computeInvoice(lines, { pricesIncludeVat: include, discountRate: seed % 9 });
        assert.equal(totals.baseNet - totals.discountNet, totals.net, `seed ${seed}`);
        if (!include) assert.deepEqual([totals.baseNet, totals.discountNet], [totals.base, totals.discount]);
      }
    }
  });
  test("kayıtlı faturadan (TL ondalığı) aynı ayrım; UBL iskontosu da KDV hariç", () => {
    const parts = exclusiveParts({ base: 2000, net: 1500, vatRate: 20 }, true, 100);
    assert.deepEqual(parts, { baseNet: 1666.67, discountNet: 166.67 });
    const xml = buildUbl({ number: "X", issueDate: "2026-10-02", currency: "TRY", pricesIncludeVat: true, kind: "sale", party: {}, seller: {}, payableTotal: 1800, lines: [{ name: "Ürün", qty: 1, unit: "Adet", unitPrice: 2000, discountRate: 10, base: 2000, discount: 200, net: 1500, vatRate: 20, vat: 300, gross: 1800 }] });
    assert.match(xml, /<cbc:Amount currencyID="TRY">166\.67<\/cbc:Amount>/);
    assert.match(xml, /<cbc:PriceAmount currencyID="TRY">1666\.67<\/cbc:PriceAmount>/);
  });
});

describe("Kaydedilmiş faturayı düzenleme, yeni stok kartı, Stok Kodu (müşteri, 02.10.2026)", () => {
  let server;
  let api;
  const ids = {};
  before(async () => {
    server = await startTestServer();
    api = apiOf(await loginAdmin(server));
    ids.customer = (await api.post("/api/workspace/accounts", { name: "Meram Kırtasiye Ltd.", type: "customer" })).data.id;
    ids.other = (await api.post("/api/workspace/accounts", { name: "Karatay Büro", type: "customer" })).data.id;
    ids.supplier = (await api.post("/api/workspace/accounts", { name: "Selçuklu Kağıt A.Ş.", type: "supplier" })).data.id;
    const item = await api.post("/api/workspace/stock", { name: "Fotokopi Kağıdı A4", code: "FK-A4", unit: "Paket", salePrice: 150 });
    assert.equal(item.status, 200, JSON.stringify(item.data));
    ids.item = item.data.id;
    const purchase = await api.post("/api/workspace/invoices", { scenario: "goods_purchase", accountId: ids.supplier, number: "SKA-1", issueDate: shift(-5), lines: [{ itemId: ids.item, qty: 100, unitPrice: 90, vatRate: 20 }], payment: {} });
    assert.equal(purchase.status, 200, JSON.stringify(purchase.data));
    ids.purchase = purchase.data.id;
  });
  after(async () => server.close());
  const balance = async id => (await api.get(`/api/workspace/accounts/${id}`)).data.totals.balance;
  const stockQty = async id => Number((await api.get(`/api/workspace/stock/${id}`)).data.qty);
  const cashBalance = async () => (await api.get("/api/workspace/cash")).data.totals.balance;

  test("Stok Kodu tekil: aynı kod ikinci ürüne verilmez (açarken ve düzeltirken)", async () => {
    const twin = await api.post("/api/workspace/stock", { name: "Fotokopi Kağıdı A3", code: "fk-a4", unit: "Paket" });
    assert.equal(twin.status, 409);
    assert.equal(twin.data.code || twin.data.error?.code, twin.data.code || twin.data.error?.code);
    assert.match(JSON.stringify(twin.data), /Stok Kodu/);
    const a3 = await api.post("/api/workspace/stock", { name: "Fotokopi Kağıdı A3", code: "FK-A3", unit: "Paket" });
    assert.equal(a3.status, 200);
    const clash = await api.put(`/api/workspace/stock/${a3.data.id}`, { code: "FK-A4" });
    assert.equal(clash.status, 409);
  });

  test("Faturada kodla arama: tam eşleşen Stok Kodu en üstte ve exact işaretli", async () => {
    const hits = (await api.get("/api/workspace/invoices/items?q=fk-a4")).data.items;
    assert.equal(hits[0].id, ids.item);
    assert.equal(hits[0].exact, true);
    const partial = (await api.get("/api/workspace/invoices/items?q=FK")).data.items;
    assert.ok(partial.length >= 2 && partial.every(hit => !hit.exact));
  });

  test("Stoğa Mal Alışı: '+ Yeni Stok Kartı' kalemi kartı faturayla aynı işlemde açar, stoğa girer, maliyet alış fiyatı", async () => {
    const saved = await api.post("/api/workspace/invoices", { scenario: "goods_purchase", accountId: ids.supplier, number: "SKA-2", issueDate: shift(-4), lines: [{ name: "Zımba Teli 24/6", code: "ZT-246", unit: "Kutu", newItem: true, newSalePrice: "35", qty: 40, unitPrice: 20, vatRate: 20 }], payment: {} });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const line = saved.data.lines[0];
    assert.ok(line.itemId, "kalem stok kartına bağlı");
    assert.equal(line.goods, true);
    const card = (await api.get(`/api/workspace/stock/${line.itemId}`)).data;
    assert.equal(card.name, "Zımba Teli 24/6");
    assert.equal(card.code, "ZT-246");
    assert.equal(card.unit, "Kutu");
    assert.equal(Number(card.qty), 40);
    assert.equal(Number(card.salePrice), 35);
    assert.equal(Number(card.unitPrice), 20);
    // Kod başka üründe ise kayıt (kart dahil) hiç yazılmaz.
    const clash = await api.post("/api/workspace/invoices", { scenario: "goods_purchase", accountId: ids.supplier, number: "SKA-3", issueDate: shift(-4), lines: [{ name: "Ataç", code: "FK-A4", unit: "Kutu", newItem: true, qty: 1, unitPrice: 5, vatRate: 20 }], payment: {} });
    assert.equal(clash.status, 409);
    assert.equal((await api.get("/api/workspace/invoices/items?q=Ataç")).data.items.length, 0, "yarım kart kalmadı");
  });

  test("Düzenleme: aynı numara; stok, cari ve Kasa eskiyi bırakıp yeniye göre; işlem geçmişi", async () => {
    const stock0 = await stockQty(ids.item);
    const cash0 = await cashBalance();
    const sale = await api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: ids.customer, issueDate: shift(-2), lines: [{ itemId: ids.item, qty: 10, unitPrice: 150, vatRate: 20 }], payment: { cash: [{ amount: 600, method: "cash" }], rest: "open" } });
    assert.equal(sale.status, 200, JSON.stringify(sale.data));
    assert.equal(sale.data.canModify, true, sale.data.modifyBlock);
    assert.equal(await stockQty(ids.item), stock0 - 10);
    assert.equal(await balance(ids.customer), 1800 - 600);
    assert.equal(await cashBalance(), cash0 + 600);
    const edited = await api.post(`/api/workspace/invoices/${sale.data.id}/edit`, { accountId: ids.customer, issueDate: shift(-2), lines: [{ itemId: ids.item, qty: 4, unitPrice: 150, vatRate: 10 }, { name: "Kargo", qty: 1, unitPrice: 50, vatRate: 20 }], payment: { cash: [{ amount: 300, method: "cash" }], rest: "open" } });
    assert.equal(edited.status, 200, JSON.stringify(edited.data));
    assert.equal(edited.data.id, sale.data.id);
    assert.equal(edited.data.number, sale.data.number, "numara aynı");
    assert.equal(edited.data.status, "issued");
    assert.equal(edited.data.payableTotal, 4 * 150 * 1.1 + 60);
    assert.equal(await stockQty(ids.item), stock0 - 4, "stok yeni miktara göre");
    assert.equal(await balance(ids.customer), 720 - 300, "cari yeni tutara göre");
    assert.equal(await cashBalance(), cash0 + 300, "Kasa yeni peşin tutara göre");
    // Cari başka cariye alınabilir: eski cari sıfırlanır.
    const moved = await api.post(`/api/workspace/invoices/${sale.data.id}/edit`, { accountId: ids.other, issueDate: shift(-2), lines: [{ itemId: ids.item, qty: 4, unitPrice: 150, vatRate: 10 }], payment: { rest: "open" } });
    assert.equal(moved.status, 200, JSON.stringify(moved.data));
    assert.equal(await balance(ids.customer), 0);
    assert.equal(await balance(ids.other), 660);
    assert.equal(await cashBalance(), cash0, "peşin tahsilat kaldırıldı");
  });

  test("Düzenleme taksitli faturada kartı yeniler; tahsilat varsa ve iadesi varsa engellenir", async () => {
    const sale = await api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: ids.customer, issueDate: shift(-1), lines: [{ itemId: ids.item, qty: 2, unitPrice: 150, vatRate: 20 }], payment: { rest: "installments", installments: { count: 3, firstDue: shift(30), everyMonths: 1 } } });
    assert.equal(sale.status, 200, JSON.stringify(sale.data));
    const firstPlan = sale.data.plan?.id;
    assert.ok(firstPlan);
    const edited = await api.post(`/api/workspace/invoices/${sale.data.id}/edit`, { accountId: ids.customer, issueDate: shift(-1), lines: [{ itemId: ids.item, qty: 3, unitPrice: 150, vatRate: 20 }], payment: { rest: "installments", installments: { count: 2, firstDue: shift(30), everyMonths: 1 } } });
    assert.equal(edited.status, 200, JSON.stringify(edited.data));
    assert.ok(edited.data.plan && edited.data.plan.id !== firstPlan, "taksit kartı yenilendi");
    assert.equal(edited.data.plan.total, 540);
    // İade varken düzenlenmez.
    const ret = await api.post("/api/workspace/invoices", { kind: "sale_return", originalId: sale.data.id, issueDate: shift(0), lines: [{ originLineId: edited.data.lines[0].id, qty: 1 }], payment: {} });
    assert.equal(ret.status, 200, JSON.stringify(ret.data));
    const card = (await api.get(`/api/workspace/invoices/${sale.data.id}`)).data;
    assert.equal(card.canModify, false);
    assert.match(card.modifyBlock, /iade/);
    const blocked = await api.post(`/api/workspace/invoices/${sale.data.id}/edit`, { accountId: ids.customer, issueDate: shift(-1), lines: [{ itemId: ids.item, qty: 1, unitPrice: 150, vatRate: 20 }], payment: {} });
    assert.equal(blocked.status, 409);
    // v2.0.17: iade belgesi de düzenlenir (boş gövde: kalem yok → 400); 409 değil. Ayrıntısı test/fatura-217.test.mjs.
    assert.equal((await api.post(`/api/workspace/invoices/${ret.data.id}/edit`, {})).status, 400);
  });

  test("Düzenleme stok eksiye düşürecekse sorar (stock-negative), izin verilince yapar; tarih sırası korunur", async () => {
    const stock0 = await stockQty(ids.item);
    const sale = await api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: ids.customer, issueDate: shift(0), lines: [{ itemId: ids.item, qty: 1, unitPrice: 150, vatRate: 20 }], payment: { rest: "open" } });
    assert.equal(sale.status, 200, JSON.stringify(sale.data));
    const body = { accountId: ids.customer, issueDate: shift(0), lines: [{ itemId: ids.item, qty: stock0 + 5, unitPrice: 150, vatRate: 20 }], payment: { rest: "open" } };
    const ask = await api.post(`/api/workspace/invoices/${sale.data.id}/edit`, body);
    assert.equal(ask.status, 409);
    assert.match(JSON.stringify(ask.data), /stock-negative/);
    assert.equal(await stockQty(ids.item), stock0 - 1, "reddedilen düzenleme hiçbir şey yazmadı");
    const forced = await api.post(`/api/workspace/invoices/${sale.data.id}/edit`, { ...body, force: true });
    assert.equal(forced.status, 200, JSON.stringify(forced.data));
    assert.equal(await stockQty(ids.item), -5);
    // Serinin önceki belgesinden eski tarihe alınamaz.
    const older = await api.post(`/api/workspace/invoices/${sale.data.id}/edit`, { ...body, force: true, issueDate: shift(-10) });
    assert.equal(older.status, 400);
    assert.match(JSON.stringify(older.data), /chronology/);
    // geri al: stok yine pozitife
    assert.equal((await api.post(`/api/workspace/invoices/${sale.data.id}/edit`, { ...body, lines: [{ itemId: ids.item, qty: 1, unitPrice: 150, vatRate: 20 }] })).status, 200);
    assert.equal(await stockQty(ids.item), stock0 - 1);
  });

  test("Düzenleme çekli faturada: aynı çek (aynı seri no) yeniden yazılır; portföyde tek evrak; ciro edilmiş çek varken düzenleme durur", async () => {
    const sale = await api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: ids.other, issueDate: shift(0), lines: [{ itemId: ids.item, qty: 1, unitPrice: 150, vatRate: 20 }], payment: { cheques: [{ instrument: "cheque", amount: 100, dueDate: shift(30), serialNo: "CK-2016-1", bank: "Ziraat" }], rest: "open" } });
    assert.equal(sale.status, 200, JSON.stringify(sale.data));
    const edited = await api.post(`/api/workspace/invoices/${sale.data.id}/edit`, { accountId: ids.other, issueDate: shift(0), lines: [{ itemId: ids.item, qty: 2, unitPrice: 150, vatRate: 20 }], payment: { cheques: [{ instrument: "cheque", amount: 120, dueDate: shift(30), serialNo: "CK-2016-1", bank: "Ziraat" }], rest: "open" } });
    assert.equal(edited.status, 200, JSON.stringify(edited.data));
    assert.equal(edited.data.cheques.length, 1);
    assert.equal(edited.data.cheques[0].amount, 120);
    const list = (await api.get("/api/workspace/cheques")).data;
    const rows = (list.cheques || list.items || []).filter(row => row.serialNo === "CK-2016-1");
    assert.equal(rows.length, 1, "portföyde tek evrak");
    // Çek tahsil edildi (para el değiştirdi): fatura düzenlenmez, hiçbir şey yazılmaz.
    const collected = await api.post(`/api/workspace/cheques/${edited.data.cheques[0].id}/actions`, { action: "collect", date: shift(0), method: "bank" });
    assert.equal(collected.status, 200, JSON.stringify(collected.data));
    const balance0 = await balance(ids.other);
    const blocked = await api.post(`/api/workspace/invoices/${sale.data.id}/edit`, { accountId: ids.other, issueDate: shift(0), lines: [{ itemId: ids.item, qty: 3, unitPrice: 150, vatRate: 20 }], payment: { rest: "open" } });
    assert.equal(blocked.status, 409);
    assert.match(JSON.stringify(blocked.data), /cheque-moved/);
    assert.equal(await balance(ids.other), balance0, "reddedilen düzenleme cariye dokunmadı");
  });

  test("Fatura PDF'inde ayrı Stok Kodu kolonu, POS ödeme satırı ve Toplamlar düzeni (metin düzeyinde)", async () => {
    const sale = await api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId: ids.customer, issueDate: shift(0), pricesIncludeVat: true, lines: [{ itemId: ids.item, qty: 1, unitPrice: 2000, discountRate: 10, vatRate: 20 }], payment: { cash: [{ amount: 300, method: "card" }], rest: "open" } });
    assert.equal(sale.status, 200, JSON.stringify(sale.data));
    const response = await api.raw("GET", `/api/workspace/invoices/${sale.data.id}/fatura.pdf`);
    assert.equal(response.status, 200);
    const text = pdfText(response.buffer);
    assert.match(text, /Stok Kodu/, "kolon başlığı");
    assert.match(text, /FK-A4/, "kalemde kod");
    assert.match(text, /POS 300,00/, "tahsilat yolu POS");
    assert.match(text, /Mal \/ Hizmet Toplamı[\s\S]*1\.666,67/, "Toplam KDV hariç");
    assert.match(text, /Toplam İskonto[\s\S]*166,67/, "İskonto KDV hariç");
    assert.match(text, /Matrah \(KDV Hariç\)[\s\S]*1\.500,00/, "Ara Toplam");
    const purchase = await api.raw("GET", `/api/workspace/invoices/${ids.purchase}/fatura.pdf`);
    assert.equal(purchase.status, 200);
    assert.match(pdfText(purchase.buffer), /Stok Kodu[\s\S]*FK-A4/, "alış PDF'inde de Stok Kodu kolonu");
  });
});
