// 2.4.5 dar kontrol D1 (ORTA, para çekirdeği) — BAŞ MİMAR KARARI KS7 (docs/2.4.5-IS-LISTESI.md "DAR KONTROL"; dayanak S1 "bağsız ödemeler (… iade) en
// eskiden dağıtılır" + BANKA-MODULU-PLAN §3.11b/3 "değersiz yazılınca cari bakiyesi o tutar kadar kapanır"):
//   (a) faturasız stok Satış İadesi (müşteride alacak satırı) = bağsız ÖDEME; simetriği faturasız stok Alış İadesi (tedarikçide borç satırı) = bağsız ödeme;
//   (b) Değersiz Alacak Yaz satırı = bağsız kapatıcı (en eskiden); şüpheliye alma (128'e aktarım) cari satırı yazmaz — kapatıcı DEĞİL, alacak sürer;
//   (c) elle Alacak / Borç yükümlülük KALIR (KS2); stoktan veresiye satış ve açık hesaba alım yükümlülüktür;
//   (d) faturalara da uygulanır (tek kuyruk): değersiz yazılmış / stoktan iade alınmış carinin faturası artık "Açık / gecikmiş" görünmez.
//   Kasa, yevmiye ve bakiye DEĞİŞMEZ.
// Yeniden üretme kaynağı: dar kontrol betikleri (docs/kanit/2026-10-24/245-dar/p1-degersiz.mjs, p1b-stok-iade.mjs, p1c-fatura-stok-iade.mjs) — teste çevrildi.
// "Nasıl bozulur?": değersiz yazma vadeli borcu ve faturayı kapatmıyor (eski); şüpheliye alma tek başına kapatır (yanlış); kısmi değersiz en eskiden değil;
// değersiz satırı silinince borç geri açılmıyor; stok iadesi kapatmıyor (eski); stok iadesi silinince geri açılmıyor; stok satışı ödeme sayılıyor (yanlış);
// elle Alacak kapatıcı oluyor (KS2 ihlali); bakiye / Kasa / mizan değişiyor; takvim, zil, Vade Takip, Açık Faturalar ve Yaşlandırma birbirinden ayrışıyor.
// Sahte DURAĞAN saat (ders 13).
import assert from "node:assert/strict";
import { after, before, describe, it, test } from "node:test";
import { classifyLine } from "../server/lib/invoice-settle.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const NOW = "2026-10-20T12:00:00+03:00";
const TODAY = "2026-10-20";
const day = offset => {
  const at = new Date(`${TODAY}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + offset);
  return at.toISOString().slice(0, 10);
};
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const apiOf = client => ({
  get: async url => unwrap(await client.get(url)),
  post: async (url, body) => unwrap(await client.post(url, body)),
  put: async (url, body) => unwrap(await client.put(url, body)),
  del: async url => unwrap(await client.del(url)),
});
const ROLE = { recvDue: false, recvPay: false, payDue: false, payPay: false };

describe("KS7 classifyLine (saf): faturasız stok iadesi ve Değersiz Alacak bağsız ödemedir; satış, alım, elle borç / alacak yükümlülüktür", () => {
  const line = (extra) => ({ id: "x", origin: "account", kind: "debt", date: "2026-09-01", at: "", debit: 0, credit: 0, ...extra });
  test("(a) stoktan satıştan iade (alacak) alacak tarafında ödeme; alıştan iade (borç) borç tarafında ödeme", () => {
    assert.deepEqual(classifyLine(line({ origin: "stock", kind: "credit", credit: 100, stockReason: "return" })), { ...ROLE, recvPay: true });
    assert.deepEqual(classifyLine(line({ origin: "stock", kind: "debt", debit: 100, stockReason: "preturn" })), { ...ROLE, payPay: true });
  });
  test("(c) stoktan veresiye satış ve açık hesaba alım yükümlülük KALIR (nedeni boş)", () => {
    assert.deepEqual(classifyLine(line({ origin: "stock", kind: "debt", debit: 100, stockReason: "" })), { ...ROLE, recvDue: true });
    assert.deepEqual(classifyLine(line({ origin: "stock", kind: "credit", credit: 100 })), { ...ROLE, payDue: true });
  });
  test("(b) Değersiz Alacak satırı alacak tarafında ödeme; (c) elle Borç / Alacak yükümlülük (KS2)", () => {
    assert.deepEqual(classifyLine(line({ origin: "doubtful", kind: "credit", credit: 100 })), { ...ROLE, recvPay: true });
    assert.deepEqual(classifyLine(line({ kind: "credit", credit: 100 })), { ...ROLE, payDue: true });
    assert.deepEqual(classifyLine(line({ kind: "debt", debit: 100 })), { ...ROLE, recvDue: true });
  });
});

describe("KS7 API: Değersiz Alacak ve faturasız stok iadesi carinin en eski açık borcunu (vadeli elle borç, fatura) kapatır", () => {
  let server;
  let api;
  let service;
  let goods;
  let n = 0;
  before(async () => {
    server = await startTestServer({ now: { time: NOW, fixed: true }, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    api = apiOf(await loginAdmin(server));
    await api.post("/api/workspace/bank/setup/dismiss", {});
    service = (await api.post("/api/workspace/stock", { kind: "service", code: "HZM-KS7", name: "Hizmet", unit: "Adet", salePrice: "1000" })).data;
    goods = (await api.post("/api/workspace/stock", { kind: "goods", code: "URN-KS7", name: "Ürün", unit: "Adet", salePrice: "100", openingQty: "500" })).data;
  });
  after(async () => server?.close());

  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  const customer = async label => must(`cari ${label}`, api.post("/api/workspace/accounts", { name: `KS7 ${label}`, type: "customer", registeredOn: day(-400), phone: `0500 777 00 ${String((n += 1)).padStart(2, "0")}` }));
  const debt = async (acc, amount, date, dueDate) => {
    const before_ = new Set((await must("kart", api.get(`/api/workspace/accounts/${acc.id}`))).entries.map(row => row.id));
    const card = await must("borç", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount, date, dueDate }));
    return card.entries.find(row => !before_.has(row.id));
  };
  const sale = async (acc, date, amount) => {
    const doc = await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ itemId: service.id, qty: 1, unitPrice: amount, vatRate: 0 }], payment: { rest: "open", dueDate: date } }));
    return doc.id;
  };
  const card = acc => must("kart", api.get(`/api/workspace/accounts/${acc.id}`));
  const left = async (acc, id) => (await card(acc)).entries.find(row => row.id === id).remaining;
  const invoice = async id => {
    const doc = await must("fatura oku", api.get(`/api/workspace/invoices/${id}`));
    return [doc.payState, doc.open];
  };
  const duesOf = async acc => (await must("takvim", api.get("/api/workspace/dues"))).items.filter(row => row.accountId === acc.id || row.person === acc.name).map(row => [row.source, row.amount]).sort();
  const vadeOf = async acc => (await must("vade takip", api.get(`/api/workspace/overview/vade-takip?from=${day(-500)}&to=${day(30)}`))).rows.filter(row => row.party === acc.name).map(row => [row.source, row.amount]).sort();
  const takeDoubtful = async (acc, amount, date) => {
    const taken = await must("şüpheliye al", api.post(`/api/workspace/accounts/${acc.id}/doubtful`, { amount, date, reason: "lawsuit", note: "dava" }));
    return taken.id || taken.record?.id;
  };
  const writeOff = (acc, did, amount, date) => must("değersiz yaz", api.post(`/api/workspace/accounts/${acc.id}/doubtful/${did}/write-off`, { amount, date, note: "kesin kayıp" }));
  const stockMove = async (acc, body) => {
    await must("stok hareketi", api.post(`/api/workspace/stock/${goods.id}/moves`, { pay: "account", accountId: acc.id, unitPrice: "100", ...body }));
    return server.app.store.get("SELECT id FROM stock_moves WHERE account_id = ? ORDER BY rowid DESC LIMIT 1", acc.id).id;
  };
  const facts = async () => {
    const ledger = await must("defter", api.get("/api/workspace/ledger"));
    const cash = await must("kasa", api.get("/api/workspace/cash"));
    return JSON.stringify({ trial: ledger.trial, cash: cash.totals });
  };

  it("(b) şüpheliye alma KAPATMAZ (alacak sürer); Değersiz Alacak Yaz en eskiden kapatır — vadeli borç ve fatura; takvim / Vade Takip boşalır, bakiye 0", async () => {
    const acc = await customer("Değersiz");
    const d = await debt(acc, "1000", day(-60), day(-30));
    const inv = await sale(acc, day(-50), "500");
    const did = await takeDoubtful(acc, "1500", day(-20));
    assert.equal(await left(acc, d.id), 1000, "şüpheliye alma: borç kaydı açık kalır");
    assert.deepEqual(await invoice(inv), ["overdue", 500], "şüpheliye alma: fatura açık kalır");
    assert.deepEqual(await duesOf(acc), [["account", 1000], ["invoice", 500]], "şüpheliye alma: takvimde iki kalem sürer");
    const before_ = await facts();
    await writeOff(acc, did, "1500", day(-10));
    assert.equal((await card(acc)).totals.balance, 0, "değersiz: bakiye 0");
    assert.equal(await left(acc, d.id), 0, "değersiz: vadeli borç kapandı");
    assert.deepEqual(await invoice(inv), ["paid", 0], "(d) değersiz: fatura kapandı (Açık / gecikmiş görünmez)");
    assert.deepEqual(await duesOf(acc), [], "takvim / zil: kalem yok");
    assert.deepEqual(await vadeOf(acc), [], "Vade Takip: satır yok");
    const report = await must("açık faturalar", api.get(`/api/workspace/report-center/acik-faturalar?account=${acc.id}`));
    assert.equal(report.rows.length, 0, "Açık Faturalar'da satır yok");
    const aging = await must("yaşlandırma", api.get("/api/workspace/report-center/alacak-yaslandirma"));
    assert.equal(aging.rows.some(row => row[0] === acc.name), false, "Alacak Yaşlandırma'da cari yok (bakiye 0)");
    const after_ = await facts();
    const delta = (a, b) => JSON.stringify(JSON.parse(a).trial.accounts.filter(x => x.code === "100")) === JSON.stringify(JSON.parse(b).trial.accounts.filter(x => x.code === "100"));
    assert.ok(delta(before_, after_), "Kasa (100) değersiz yazmayla değişmez");
  });

  it("(b) kısmi değersiz en eskiden kapatır; değersiz satırı silinince borç ve fatura yeniden açılır", async () => {
    const acc = await customer("Kısmi");
    const d = await debt(acc, "1000", day(-60), day(-30));
    const inv = await sale(acc, day(-50), "500");
    const did = await takeDoubtful(acc, "1500", day(-20));
    const card1 = await writeOff(acc, did, "600", day(-10));
    assert.equal(await left(acc, d.id), 400, "en eski (elle borç) 600 kapandı");
    assert.deepEqual(await invoice(inv), ["overdue", 500], "fatura (daha yeni) açık");
    assert.deepEqual(await duesOf(acc), [["account", 400], ["invoice", 500]]);
    const entry = server.app.store.get("SELECT id FROM account_entries WHERE account_id = ? AND source = 'doubtful'", acc.id);
    assert.ok(entry && card1, "Değersiz Alacak satırı yazıldı");
    await must("değersiz satırını sil", api.del(`/api/workspace/accounts/${acc.id}/doubtful/${did}/write-offs/${entry.id}`));
    assert.equal(await left(acc, d.id), 1000, "silinince borç yeniden açık");
    assert.deepEqual(await duesOf(acc), [["account", 1000], ["invoice", 500]]);
  });

  it("(a) faturasız stok Satış İadesi (açık hesap) en eskiden kapatır: vadeli borç ve fatura; iade silinince yeniden açılır; bakiye ve Kasa değişmez", async () => {
    const acc = await customer("Stok İade");
    const d = await debt(acc, "1000", day(-60), day(-30));
    const inv = await sale(acc, day(-50), "500");
    const before_ = await facts();
    const ret = await stockMove(acc, { kind: "in", reason: "return", qty: "12", date: day(-5) });
    assert.equal((await card(acc)).totals.balance, 300, "bakiye 1.000 + 500 − 1.200");
    assert.equal(await left(acc, d.id), 0, "en eski borç kapandı");
    assert.deepEqual(await invoice(inv), ["overdue", 300], "(d) fatura 200'ü kapandı, 300 açık");
    assert.deepEqual(await duesOf(acc), [["invoice", 300]], "takvimde yalnız faturanın kalanı");
    assert.deepEqual(await vadeOf(acc), [["invoice", 300]], "Vade Takip takvimle aynı");
    const after_ = await facts();
    const cash = text => JSON.parse(text).cash;
    assert.deepEqual(cash(after_), cash(before_), "açık hesaba iade Kasa'yı değiştirmez");
    await must("iadeyi sil", api.del(`/api/workspace/stock/${goods.id}/moves/${ret}`));
    assert.equal(await left(acc, d.id), 1000, "iade silinince borç yeniden açık");
    assert.deepEqual(await invoice(inv), ["overdue", 500]);
  });

  it("(c) stoktan veresiye satış ödeme DEĞİLDİR (yükümlülük); elle Alacak müşterinin borcunu kapatmaz (KS2)", async () => {
    const acc = await customer("Stok Satış");
    const inv = await sale(acc, day(-50), "500");
    await stockMove(acc, { kind: "out", qty: "3", date: day(-40) });
    assert.deepEqual(await invoice(inv), ["overdue", 500], "stok satışı faturayı kapatmaz");
    await must("elle alacak", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "credit", amount: "500", date: day(-30) }));
    assert.deepEqual(await invoice(inv), ["overdue", 500], "elle Alacak faturayı kapatmaz (KS2)");
    await must("tahsilat", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "600", date: day(-20), method: "cash" }));
    assert.deepEqual(await invoice(inv), ["paid", 0], "tahsilat en eskiden: fatura 500");
    assert.equal((await card(acc)).totals.balance, -300, "bakiye 500 + 300 − 500 − 600");
  });

  it("(a) tedarikçide açık hesaba alım yükümlülüktür: alış faturasını kapatmaz, ödeme kapatır", async () => {
    const supplier = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "KS7 Tedarikçi", type: "supplier", registeredOn: day(-400) }));
    const bill = await must("alış", api.post("/api/workspace/invoices", { kind: "purchase", accountId: supplier.id, number: "KS7-A1", issueDate: day(-50), pricesIncludeVat: false, lines: [{ name: "Malzeme", qty: 1, unitPrice: 400, vatRate: 0 }], payment: { rest: "open", dueDate: day(-50) } }));
    await stockMove(supplier, { kind: "in", qty: "2", date: day(-40) });
    assert.deepEqual(await invoice(bill.id), ["overdue", 400], "stok alımı alış faturasını kapatmaz");
    await must("ödeme", api.post(`/api/workspace/accounts/${supplier.id}/entries`, { kind: "out", amount: "400", date: day(-10), method: "cash", cashForce: true }));
    assert.deepEqual(await invoice(bill.id), ["paid", 0]);
  });
});
