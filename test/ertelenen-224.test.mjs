// 2.0.24 — 2.0.23'te denenmeyen alanlar: fatura iade/iptal/düzenleme/silme (her ödeme yoluyla), çek/senet işlemleri,
// Kasa ↔ Banka, dönem kilidi, yetkisiz kullanıcı ve şirket ayrımı. Her alan için iki tür test:
//   (1) çalışıyor mu — doğru kullanımda sonuç sayılarla (cari bakiye, Kasa/banka, stok, fatura açığı, kart kalanı, çek durumu);
//   (2) nasıl bozarım — yanlış sıra, çift gönderim, sıfır/eksi/devasa/kuruş artığı tutar, iki kez iptal, sil → geri yükle →
//       düzenle, kilitli dönem, yetkisiz kullanıcı, ?hofCompany= ile başka şirket.
// Her testten sonra değişmezler: mutabakat testi (GET /api/workspace/ledger/integrity) ok; yaşlandırma = bakiye (müşteride).
// "HATA:" ile başlayan testler programın gerçek hatasını gösterir (kırmızı kalır; düzeltilince yeşile döner).
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const money = text => Number(String(text).replace(/[^\d,-]/g, "").replace(",", ".")) || 0;
const r2 = value => Math.round(value * 100) / 100;

describe("2.0.24 ertelenen alanlar", () => {
  let server;
  let client;
  let api;
  let svc;
  let goods;
  let n = 0;
  let day = 0;
  // Bütün dosyada tarih artar (fatura serisi kronolojisi). 2025-01-02'den başlar; bugünden (2026-10) önce kalır.
  const d = () => { const t = new Date(Date.UTC(2025, 0, 2 + day++)); return t.toISOString().slice(0, 10); };
  const wrap = c => ({
    get: async url => unwrap(await c.get(url)),
    post: async (url, body) => unwrap(await c.post(url, body)),
    put: async (url, body) => unwrap(await c.put(url, body)),
    del: async url => unwrap(await c.del(url)),
  });
  before(async () => {
    server = await startTestServer();
    client = await loginAdmin(server);
    api = wrap(client);
    svc = (await api.post("/api/workspace/stock", { kind: "service", code: "HZM", name: "Hizmet", unit: "Adet", salePrice: "1000" })).data;
    goods = (await api.post("/api/workspace/stock", { kind: "product", code: "URN", name: "Ürün", unit: "Adet", salePrice: "100" })).data;
    assert.ok(svc?.id && goods?.id, "stok kartları açılmalı");
  });
  after(async () => server.close());

  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
    return res.data;
  };
  const refused = async (label, promise, statuses = [400, 403, 409]) => {
    const res = await promise;
    assert.ok(statuses.includes(res.status), `${label}: reddedilmeliydi, ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res;
  };
  const account = async (label, type = "customer") => must("cari", api.post("/api/workspace/accounts", { name: `Ert ${label} ${(n += 1)}`, type, registeredOn: "2025-01-01", phone: `0500 000 25 ${String(n).padStart(2, "0")}` }));
  const invoice = async id => must("fatura oku", api.get(`/api/workspace/invoices/${id}`));
  const balance = async acc => (await must("cari liste", api.get(`/api/workspace/accounts?status=all&limit=50&q=${encodeURIComponent(acc.name)}`))).accounts.find(a => a.id === acc.id).balance;
  const aging = async acc => money((await must("yaşlandırma", api.get("/api/workspace/report-center/alacak-yaslandirma"))).rows.find(r => r[0] === acc.name)?.at(-1) || "0");
  const cash = async (method = "cash") => (await must("kasa", api.get(`/api/workspace/cash?method=${method}`))).totals.balance;
  const byMethod = async () => (await must("kasa", api.get("/api/workspace/cash?method=all"))).byMethod;
  const stockQty = async item => {
    const row = (await must("stok", api.get(`/api/workspace/stock?q=${encodeURIComponent(item.code)}`))).items.find(i => i.id === item.id);
    return row.qty;
  };
  const card = async id => (await must("kart", api.get(`/api/workspace/plans/${id}`))).totals;
  const cheque = async id => must("çek", api.get(`/api/workspace/cheques/${id}`));
  const integrity = async label => {
    const result = await must("mutabakat", api.get("/api/workspace/ledger/integrity"));
    assert.equal(result.ok, true, `${label}: mutabakat bozuk ${JSON.stringify(result.failures).slice(0, 600)}`);
  };
  const snapshot = async (acc, item = goods) => ({ bal: await balance(acc), cash: await cash(), methods: await byMethod(), qty: await stockQty(item) });
  const sale = (acc, date, payment, { qty = 1, price = 1000, item = svc, scenario = "service_sale" } = {}) =>
    api.post("/api/workspace/invoices", { scenario, accountId: acc.id, issueDate: date, lines: [{ itemId: item.id, qty, unitPrice: price, vatRate: 0 }], payment });
  const goodsSale = (acc, date, payment, qty = 2) => sale(acc, date, payment, { qty, price: 100, item: goods, scenario: "goods_sale" });
  let purchaseNo = 0;
  const purchase = (acc, date, payment, qty = 10, price = 50) =>
    api.post("/api/workspace/invoices", { scenario: "goods_purchase", accountId: acc.id, issueDate: date, number: `ALS-${(purchaseNo += 1)}`, lines: [{ itemId: goods.id, qty, unitPrice: price, vatRate: 0 }], payment });

  // ======================= A. FATURA =======================
  describe("A. Fatura iade / iptal / düzenleme / silme", () => {
    before(async () => {
      const sup = await account("Stok Tedarik", "supplier");
      await must("stok alışı", purchase(sup, d(), { rest: "open", dueDate: "2025-12-31" }, 1000, 50));
    });

    test("çalışıyor mu: nakit/POS/havale peşin satış iptali her etkiyi geri alır", async () => {
      for (const method of ["cash", "card", "bank"]) {
        const acc = await account(`İptal ${method}`);
        const before0 = await snapshot(acc);
        const doc = await must("satış", goodsSale(acc, d(), { cash: [{ amount: 200, method }], rest: "open" }, 2));
        const mid = await snapshot(acc);
        assert.equal(mid.qty, before0.qty - 2, `${method}: stok düşmeli`);
        assert.equal(mid.bal, 0, `${method}: tamamen ödendi, bakiye 0`);
        assert.equal(r2(mid.methods[method] - before0.methods[method]), 200, `${method}: ilgili yol +200`);
        assert.equal((await invoice(doc.id)).open, 0);
        await must("iptal", api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "test" }));
        const end = await snapshot(acc);
        assert.deepEqual(end, before0, `${method}: iptal sonrası her şey ilk hâline`);
        await integrity(`iptal ${method}`);
      }
    });

    test("çalışıyor mu: çekli satış iptali çeki portföyden kaldırır, taksitli satış iptali kartı kaldırır", async () => {
      const acc = await account("Çekli İptal");
      const doc = await must("çekli satış", sale(acc, d(), { cheques: [{ instrument: "cheque", amount: 400, dueDate: "2025-12-01", serialNo: `CK-A-${n}`, bank: "Ziraat" }], rest: "installments", installments: { count: 2, firstDue: "2025-11-01", everyMonths: 1 } }));
      const full = await invoice(doc.id);
      assert.equal(full.cheques.length, 1);
      assert.ok(full.planId, "taksit kartı açılmalı");
      assert.equal((await card(full.planId)).remaining, 600);
      assert.equal(await balance(acc), 600);
      await must("iptal", api.post(`/api/workspace/invoices/${doc.id}/cancel`, {}));
      assert.equal(await balance(acc), 0);
      const list = await must("çekler", api.get("/api/workspace/cheques?status=all"));
      assert.equal((list.cheques || list.items || []).filter(c => c.id === full.cheques[0].id && c.status === "portfolio").length, 0, "çek portföyde kalmamalı");
      const plan = await api.get(`/api/workspace/plans/${full.planId}`);
      assert.ok(plan.status === 404 || plan.data?.totals?.remaining === 0 || plan.data?.deletedAt, `kart kalkmalı: ${plan.status} ${JSON.stringify(plan.data).slice(0, 200)}`);
      await integrity("çekli iptal");
      assert.equal(await aging(acc), 0);
    });

    test("çalışıyor mu: satıştan iade (nakit) stok, cari, Kasa; iade iptali geri alır", async () => {
      const acc = await account("İade Nakit");
      const s0 = await snapshot(acc);
      const doc = await invoice((await must("satış", goodsSale(acc, d(), { rest: "open", dueDate: "2025-12-31" }, 5))).id);
      const ret = await must("iade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: doc.id, issueDate: d(), lines: [{ originLineId: doc.lines[0].id, qty: 2 }], payment: {} }));
      const s1 = await snapshot(acc);
      assert.deepEqual([s1.qty, s1.bal, (await invoice(doc.id)).open], [s0.qty - 3, 300, 300]);
      await must("iade iptal", api.post(`/api/workspace/invoices/${ret.id}/cancel`, {}));
      const s2 = await snapshot(acc);
      assert.deepEqual([s2.qty, s2.bal, (await invoice(doc.id)).open], [s0.qty - 5, 500, 500]);
      await integrity("iade");
      assert.equal(await aging(acc), 500);
    });

    test("çalışıyor mu: alıştan iade stoktan düşer, tedarikçi borcu azalır", async () => {
      const sup = await account("Alış İade", "supplier");
      const q0 = await stockQty(goods);
      const p = await invoice((await must("alış", purchase(sup, d(), { rest: "open", dueDate: "2025-12-31" }, 10, 50))).id);
      assert.equal(await balance(sup), -500);
      await must("alıştan iade", api.post("/api/workspace/invoices", { kind: "purchase_return", originalId: p.id, issueDate: d(), number: `ALI-${n}`, lines: [{ originLineId: p.lines[0].id, qty: 4 }], payment: {} }));
      assert.deepEqual([await stockQty(goods), await balance(sup), (await invoice(p.id)).open], [q0 + 6, -300, 300]);
      await integrity("alıştan iade");
    });

    test("çalışıyor mu: düzenleme nakitten havaleye ve tutar değişimi; Kasa ve banka doğru", async () => {
      const acc = await account("Düzenle");
      const m0 = await byMethod();
      const doc = await invoice((await must("satış", sale(acc, d(), { cash: [{ amount: 1000, method: "cash" }], rest: "open" }))).id);
      await must("düzenle", api.post(`/api/workspace/invoices/${doc.id}/edit`, { scenario: "service_sale", accountId: acc.id, issueDate: doc.issueDate, lines: [{ itemId: svc.id, qty: 2, unitPrice: 1000, vatRate: 0 }], payment: { cash: [{ amount: 500, method: "bank" }], rest: "open", dueDate: doc.issueDate } }));
      const m1 = await byMethod();
      assert.deepEqual([r2(m1.cash - m0.cash), r2(m1.bank - m0.bank), await balance(acc), (await invoice(doc.id)).open], [0, 500, 1500, 1500]);
      await integrity("düzenle");
      assert.equal(await aging(acc), 1500);
    });

    test("çalışıyor mu: kaydedilmiş fatura silinince etkiler geri alınır; Silinenler'den etkisiz (iptal) döner", async () => {
      const acc = await account("Sil");
      const s0 = await snapshot(acc);
      const doc = await must("satış", goodsSale(acc, d(), { cash: [{ amount: 100, method: "cash" }], rest: "open", dueDate: "2025-12-31" }, 3));
      await must("sil", api.del(`/api/workspace/invoices/${doc.id}`));
      assert.deepEqual(await snapshot(acc), s0, "silme her şeyi geri almalı");
      const trash = await must("silinenler", api.get("/api/admin/trash"));
      const item = trash.find(t => t.kind === "invoice" && t.title.includes(doc.number || "")) || trash.find(t => t.kind === "invoice");
      assert.ok(item, "Silinenler'de olmalı");
      await must("geri yükle", api.post("/api/admin/trash/restore", { id: item.id }));
      const back = await invoice(doc.id);
      assert.equal(back.status, "cancelled");
      assert.deepEqual(await snapshot(acc), s0, "geri yüklenen belge etkisiz");
      await integrity("sil/geri yükle");
    });

    test("çalışıyor mu: toplu silme iade önce, sonra asıl; hepsi geri alınır", async () => {
      const acc = await account("Toplu Sil");
      const s0 = await snapshot(acc);
      const doc = await invoice((await must("satış", goodsSale(acc, d(), { rest: "open", dueDate: "2025-12-31" }, 4))).id);
      const ret = await must("iade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: doc.id, issueDate: d(), lines: [{ originLineId: doc.lines[0].id, qty: 1 }], payment: {} }));
      const result = await must("toplu sil", api.post("/api/workspace/invoices/bulk-delete", { ids: [doc.id, ret.id] }));
      assert.deepEqual([result.deleted, result.failed], [2, 0], JSON.stringify(result));
      assert.deepEqual(await snapshot(acc), s0);
      await integrity("toplu sil");
    });

    test("nasıl bozarım: iki kez iptal → ikincisi reddedilir, etkiler bir kez geri alınır", async () => {
      const acc = await account("Çift İptal");
      const s0 = await snapshot(acc);
      const doc = await must("satış", goodsSale(acc, d(), { cash: [{ amount: 200, method: "cash" }], rest: "open" }, 2));
      const [a, b] = await Promise.all([api.post(`/api/workspace/invoices/${doc.id}/cancel`, {}), api.post(`/api/workspace/invoices/${doc.id}/cancel`, {})]);
      assert.deepEqual([a.status, b.status].sort(), [200, 409], `aynı anda iki iptal: ${a.status}/${b.status}`);
      await refused("üçüncü iptal", api.post(`/api/workspace/invoices/${doc.id}/cancel`, {}));
      assert.deepEqual(await snapshot(acc), s0);
      await integrity("çift iptal");
    });

    test("nasıl bozarım: aynı anda iki kez sil", async () => {
      const acc = await account("Çift Sil");
      const s0 = await snapshot(acc);
      const doc = await must("satış", goodsSale(acc, d(), { cash: [{ amount: 200, method: "card" }], rest: "open" }, 2));
      const [a, b] = await Promise.all([api.del(`/api/workspace/invoices/${doc.id}`), api.del(`/api/workspace/invoices/${doc.id}`)]);
      assert.equal([a.status, b.status].filter(s => s === 200).length, 1, `${a.status}/${b.status}`);
      assert.deepEqual(await snapshot(acc), s0);
      const trash = await must("silinenler", api.get("/api/admin/trash"));
      assert.equal(trash.filter(t => t.kind === "invoice" && t.id && JSON.stringify(t).includes(doc.number)).length, 1, "Silinenler'de tek kayıt");
      await integrity("çift sil");
    });

    test("nasıl bozarım: aynı anda iki iade (her biri kalanın tamamı) → yalnız biri geçer", async () => {
      const acc = await account("Çift İade");
      const doc = await invoice((await must("satış", goodsSale(acc, d(), { rest: "open", dueDate: "2025-12-31" }, 3))).id);
      const body = { kind: "sale_return", originalId: doc.id, issueDate: d(), lines: [{ originLineId: doc.lines[0].id, qty: 3 }], payment: {} };
      const [a, b] = await Promise.all([api.post("/api/workspace/invoices", body), api.post("/api/workspace/invoices", body)]);
      assert.equal([a.status, b.status].filter(s => s === 200).length, 1, `${a.status}/${b.status}`);
      assert.equal(await balance(acc), 0);
      await integrity("çift iade");
    });

    test("nasıl bozarım: iade miktarı sıfır/eksi/fazla/kuruş artığı tutar reddedilir", async () => {
      const acc = await account("Bozuk İade");
      const doc = await invoice((await must("satış", goodsSale(acc, d(), { rest: "open", dueDate: "2025-12-31" }, 2))).id);
      const date = d();
      for (const qty of [0, -1, 3, 1e12]) await refused(`iade ${qty}`, api.post("/api/workspace/invoices", { kind: "sale_return", originalId: doc.id, issueDate: date, lines: [{ originLineId: doc.lines[0].id, qty }], payment: {} }));
      await refused("asıl faturadan önce iade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: doc.id, issueDate: "2025-01-01", lines: [{ originLineId: doc.lines[0].id, qty: 1 }], payment: {} }));
      for (const amount of [-100, 1e15]) await refused(`peşin ${amount}`, sale(acc, date, { cash: [{ amount, method: "cash" }], rest: "open" }), [400]);
      await refused("ödeme > fatura", sale(acc, date, { cash: [{ amount: 1000.01, method: "cash" }], rest: "open" }), [400]);
      await refused("tanımsız yol", sale(acc, date, { cash: [{ amount: 100, method: "bitcoin" }], rest: "open" }), [400]);
      assert.equal(await balance(acc), 200);
      // Kuruş artığı: 100,005 peşin → 2 haneye yuvarlanır; Kasa ve cari aynı yuvarlanmış tutarı görür.
      const c0 = await cash();
      const odd = await invoice((await must("kuruş artığı", sale(acc, date, { cash: [{ amount: 100.005, method: "cash" }], rest: "open", dueDate: date }))).id);
      const delta = r2((await cash()) - c0);
      assert.equal(delta, r2(delta), "Kasa 2 hane");
      assert.equal(r2(odd.open + delta), 1000, `açık ${odd.open} + peşin ${delta} = 1000`);
      assert.equal(await balance(acc), r2(200 + odd.open));
      await integrity("bozuk iade");
    });

    test("nasıl bozarım: iadesi olan faturayı iptal/sil/düzenle → reddedilir (önce iade)", async () => {
      const acc = await account("İadeli Asıl");
      const doc = await invoice((await must("satış", goodsSale(acc, d(), { rest: "open", dueDate: "2025-12-31" }, 2))).id);
      await must("iade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: doc.id, issueDate: d(), lines: [{ originLineId: doc.lines[0].id, qty: 1 }], payment: {} }));
      await refused("asıl iptal", api.post(`/api/workspace/invoices/${doc.id}/cancel`, {}));
      await refused("asıl sil", api.del(`/api/workspace/invoices/${doc.id}`));
      await refused("asıl düzenle (iade altına miktar)", api.post(`/api/workspace/invoices/${doc.id}/edit`, { scenario: "goods_sale", accountId: acc.id, issueDate: doc.issueDate, lines: [{ itemId: goods.id, qty: 0.5, unitPrice: 100, vatRate: 0 }], payment: { rest: "open", dueDate: doc.issueDate } }));
      assert.equal(await balance(acc), 100);
      await integrity("iadeli asıl");
    });

    test("nasıl bozarım: tahsilatı alınmış taksitli faturayı iptal → reddedilir, kart ve bakiye değişmez", async () => {
      const acc = await account("Tahsilli Taksit");
      const doc = await invoice((await must("satış", sale(acc, d(), { rest: "installments", installments: { count: 2, firstDue: "2025-11-01", everyMonths: 1 } }, { qty: 2 }))).id);
      await must("taksit tahsilatı", api.post(`/api/workspace/plans/${doc.planId}/entries`, { kind: "in", amount: 500, date: d(), method: "cash" }));
      const c0 = await cash();
      await refused("iptal", api.post(`/api/workspace/invoices/${doc.id}/cancel`, {}));
      await refused("sil", api.del(`/api/workspace/invoices/${doc.id}`));
      assert.deepEqual([await balance(acc), (await card(doc.planId)).remaining, await cash()], [1500, 1500, c0]);
      await integrity("tahsilli taksit");
      assert.equal(await aging(acc), 1500);
    });

    test("nasıl bozarım: çeki tahsil edilmiş faturayı iptal → reddedilir", async () => {
      const acc = await account("Tahsilli Çek");
      const doc = await invoice((await must("satış", sale(acc, d(), { cheques: [{ instrument: "cheque", amount: 1000, dueDate: "2025-12-01", serialNo: `CK-T-${n}`, bank: "Vakıf" }], rest: "open" }))).id);
      await must("tahsil", api.post(`/api/workspace/cheques/${doc.cheques[0].id}/actions`, { action: "collect", date: d(), method: "bank" }));
      const m0 = await byMethod();
      await refused("iptal", api.post(`/api/workspace/invoices/${doc.id}/cancel`, {}));
      assert.deepEqual([await balance(acc), (await byMethod()).bank], [0, m0.bank]);
      assert.equal((await cheque(doc.cheques[0].id)).status, "collected");
      await integrity("tahsilli çek");
    });

    test("nasıl bozarım: sil → geri yükle → geri yüklenen (iptal) belgeyi düzenle/iptal/iade → reddedilir", async () => {
      const acc = await account("Geri Yükle Düzenle");
      const s0 = await snapshot(acc);
      const doc = await invoice((await must("satış", goodsSale(acc, d(), { cash: [{ amount: 100, method: "cash" }], rest: "open", dueDate: "2025-12-31" }, 2))).id);
      await must("sil", api.del(`/api/workspace/invoices/${doc.id}`));
      const item = (await must("silinenler", api.get("/api/admin/trash"))).find(t => t.kind === "invoice" && JSON.stringify(t).includes(doc.number));
      await must("geri yükle", api.post("/api/admin/trash/restore", { id: item.id }));
      await refused("ikinci geri yükleme", api.post("/api/admin/trash/restore", { id: item.id }), [404, 409]);
      await refused("iptal edilmişi düzenle", api.post(`/api/workspace/invoices/${doc.id}/edit`, { scenario: "goods_sale", accountId: acc.id, issueDate: doc.issueDate, lines: [{ itemId: goods.id, qty: 5, unitPrice: 100, vatRate: 0 }], payment: { rest: "open", dueDate: doc.issueDate } }));
      await refused("iptal edilmişi iptal", api.post(`/api/workspace/invoices/${doc.id}/cancel`, {}));
      await refused("iptal edilmişe iade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: doc.id, issueDate: d(), lines: [{ originLineId: doc.lines[0].id, qty: 1 }], payment: {} }));
      assert.deepEqual(await snapshot(acc), s0);
      await integrity("geri yükle düzenle");
    });

    test("nasıl bozarım: aynı istek kimliğiyle aynı anda iki fatura → tek belge", async () => {
      const acc = await account("İstek Kimliği");
      const body = { scenario: "service_sale", accountId: acc.id, issueDate: d(), lines: [{ itemId: svc.id, qty: 1, unitPrice: 1000, vatRate: 0 }], payment: { cash: [{ amount: 1000, method: "cash" }], rest: "open" }, requestId: `req-${n}-abcdef123456` };
      const c0 = await cash();
      const [a, b] = await Promise.all([api.post("/api/workspace/invoices", body), api.post("/api/workspace/invoices", body)]);
      assert.deepEqual([a.status, b.status], [200, 200]);
      assert.equal(a.data.id, b.data.id, "aynı belge");
      assert.equal(r2((await cash()) - c0), 1000, "Kasa bir kez");
      await integrity("istek kimliği");
    });
  });

  // ======================= B. ÇEK / SENET =======================
  describe("B. Çek/Senet", () => {
    const receive = async (acc, amount, extra = {}) => must("çek al", api.post("/api/workspace/cheques", { instrument: "cheque", direction: "in", accountId: acc.id, drawer: acc.name, amount, issueDate: d(), dueDate: "2025-12-31", serialNo: `CK-B-${(n += 1)}`, bank: "Ziraat", ...extra }));

    test("çalışıyor mu: portföy girişi cariyi alacaklandırır; tahsil bankaya girer; geri al geri çıkarır", async () => {
      const acc = await account("Çek Tahsil");
      await must("borç", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: 3000, date: d(), note: "açılış" }));
      const m0 = await byMethod();
      const ch = await receive(acc, 1000);
      assert.equal(ch.status, "portfolio");
      assert.equal(await balance(acc), 2000);
      await must("tahsil", api.post(`/api/workspace/cheques/${ch.id}/actions`, { action: "collect", date: d(), method: "bank" }));
      assert.deepEqual([(await cheque(ch.id)).status, r2((await byMethod()).bank - m0.bank), r2((await byMethod()).cash - m0.cash), await balance(acc)], ["collected", 1000, 0, 2000]);
      await must("geri al", api.post(`/api/workspace/cheques/${ch.id}/undo`, {}));
      assert.deepEqual([(await cheque(ch.id)).status, r2((await byMethod()).bank - m0.bank)], ["portfolio", 0]);
      await must("sil", api.del(`/api/workspace/cheques/${ch.id}`));
      assert.equal(await balance(acc), 3000);
      await integrity("çek tahsil");
    });

    test("çalışıyor mu: müşteri türündeki cariye ciro edilir; karşılıksız ciroyu geri döndürür", async () => {
      const from = await account("Çek Veren");
      const to = await account("Ciro Alan Müşteri");
      const ch = await receive(from, 700);
      assert.equal(await balance(from), -700);
      await must("ciro", api.post(`/api/workspace/cheques/${ch.id}/actions`, { action: "endorse", date: d(), accountId: to.id }));
      assert.deepEqual([(await cheque(ch.id)).status, await balance(from), await balance(to)], ["endorsed", -700, 700]);
      await must("karşılıksız", api.post(`/api/workspace/cheques/${ch.id}/actions`, { action: "bounce", date: d() }));
      assert.equal((await cheque(ch.id)).status, "bounced");
      assert.deepEqual([await balance(from), await balance(to)], [0, 0], "karşılıksız: veren yeniden borçlu değil mi? (0 = çek etkisi geri alındı)");
      await integrity("ciro karşılıksız");
    });

    test("nasıl bozarım: aynı anda iki tahsil → yalnız biri; Kasa/banka bir kez", async () => {
      const acc = await account("Çift Tahsil");
      const ch = await receive(acc, 500);
      const m0 = await byMethod();
      const body = { action: "collect", date: d(), method: "cash" };
      const [a, b] = await Promise.all([api.post(`/api/workspace/cheques/${ch.id}/actions`, body), api.post(`/api/workspace/cheques/${ch.id}/actions`, body)]);
      assert.equal([a.status, b.status].filter(s => s === 200).length, 1, `${a.status}/${b.status}`);
      assert.equal(r2((await byMethod()).cash - m0.cash), 500);
      await integrity("çift tahsil");
    });

    test("nasıl bozarım: tahsil edilmişi ciro, kendisine ciro, olmayan cariye ciro, alıştan önce tahsil, sil → reddedilir", async () => {
      const acc = await account("Bozuk Çek");
      const other = await account("Bozuk Çek Diğer");
      const ch = await receive(acc, 300);
      await refused("kendisine ciro", api.post(`/api/workspace/cheques/${ch.id}/actions`, { action: "endorse", date: d(), accountId: acc.id }), [400]);
      await refused("olmayan cari", api.post(`/api/workspace/cheques/${ch.id}/actions`, { action: "endorse", date: d(), accountId: "acc_yok" }), [400]);
      await refused("alıştan önce", api.post(`/api/workspace/cheques/${ch.id}/actions`, { action: "collect", date: "2025-01-01" }), [400]);
      await refused("bilinmeyen işlem", api.post(`/api/workspace/cheques/${ch.id}/actions`, { action: "steal", date: d() }), [400, 409]);
      await must("tahsil", api.post(`/api/workspace/cheques/${ch.id}/actions`, { action: "collect", date: d(), method: "cash" }));
      await refused("tahsilliyi ciro", api.post(`/api/workspace/cheques/${ch.id}/actions`, { action: "endorse", date: d(), accountId: other.id }), [409]);
      await refused("tahsilliyi sil", api.del(`/api/workspace/cheques/${ch.id}`), [409]);
      for (const amount of [0, -5, 1e15]) await refused(`çek tutarı ${amount}`, api.post("/api/workspace/cheques", { instrument: "cheque", direction: "in", accountId: acc.id, amount, issueDate: d(), dueDate: "2025-12-31", serialNo: `X${amount}`, bank: "Z" }), [400]);
      assert.deepEqual([await balance(acc), await balance(other)], [-300, 0]);
      await integrity("bozuk çek");
    });

    test("çek/senet işlemi ileri tarihle (2099) reddedilir; Kasa'ya ileri tarihli hareket yazılmaz (2.0.23'te yazılıyordu)", async () => {
      const acc = await account("Çek İleri");
      const ch = await receive(acc, 120);
      const c0 = await cash();
      const r = await api.post(`/api/workspace/cheques/${ch.id}/actions`, { action: "collect", date: "2099-01-01", method: "cash" });
      const after0 = (await must("kasa tümü", api.get("/api/workspace/cash?method=all&to=2099-12-31"))).entries.filter(e => e.date > "2026-12-31");
      if (r.status === 200) await api.post(`/api/workspace/cheques/${ch.id}/undo`, {});
      assert.equal(r.status, 400, `ileri tarihli tahsil reddedilmeliydi: ${r.status}; ileri tarihli Kasa satırı ${after0.length}`);
      assert.equal(await cash(), c0);
    });

    test("nasıl bozarım: sil → Silinenler'den geri yükle → cari etkisi bir kez döner; aynı seri yeniden girildiyse geri yükleme reddedilir", async () => {
      const acc = await account("Çek Geri Yükle");
      const ch = await receive(acc, 250, { serialNo: `CK-GY-${n}` });
      await must("sil", api.del(`/api/workspace/cheques/${ch.id}`));
      assert.equal(await balance(acc), 0);
      await must("geri yükle", api.post("/api/admin/trash/restore", { id: `cheque:${ch.id}` }));
      assert.equal(await balance(acc), -250);
      await refused("ikinci geri yükleme", api.post("/api/admin/trash/restore", { id: `cheque:${ch.id}` }), [404, 409]);
      assert.equal(await balance(acc), -250);
      await must("tekrar sil", api.del(`/api/workspace/cheques/${ch.id}`));
      await must("aynı seri yeniden", api.post("/api/workspace/cheques", { instrument: "cheque", direction: "in", accountId: acc.id, amount: 250, issueDate: d(), dueDate: "2025-12-31", serialNo: ch.serialNo, bank: "Ziraat" }));
      await refused("çakışan geri yükleme", api.post("/api/admin/trash/restore", { id: `cheque:${ch.id}` }), [409]);
      assert.equal(await balance(acc), -250);
      await integrity("çek geri yükle");
    });
  });

  // ======================= C. KASA ↔ BANKA =======================
  describe("C. Kasa ↔ Banka", () => {
    test("çalışıyor mu: Kasadan bankaya yatır ve bankadan kasaya aktar; Kasa yalnız nakit, banka raporunda karşı hareket", async () => {
      await must("nakit giriş", api.post("/api/workspace/cash", { kind: "in", amount: 5000, date: d(), description: "Sermaye" }));
      const m0 = await byMethod();
      const date = d();
      const t1 = await must("yatır", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: 1200.5, date }));
      const t2 = await must("aktar", api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: 200.25, date }));
      const m1 = await byMethod();
      assert.deepEqual([r2(m1.cash - m0.cash), r2(m1.bank - m0.bank)], [-1000.25, 1000.25]);
      const kasa = await must("kasa", api.get("/api/workspace/cash"));
      assert.ok(kasa.entries.every(e => e.method === "cash"), "Kasa'da yalnız nakit");
      const rep = await must("banka raporu", api.get(`/api/workspace/report-center/banka-pos-hareketleri?from=${date}&to=${date}&payMethod=bank`));
      const rows = rep.rows.filter(r => r[2] === "Kasa ↔ Banka");
      assert.deepEqual(rows.map(r => [money(r[4]), money(r[5])]).sort(), [[0, 200.25], [1200.5, 0]].sort());
      // Bir tarafı silmek iki tarafı da siler; geri yüklemek iki tarafı da getirir.
      await must("transfer sil", api.del(`/api/workspace/cash/${t1.id}`));
      assert.equal(r2((await byMethod()).bank - m0.bank), -200.25);
      const item = (await must("silinenler", api.get("/api/admin/trash"))).find(t => t.kind === "cash" && t.id && JSON.stringify(t).includes("Kasadan Bankaya"));
      await must("geri yükle", api.post("/api/admin/trash/restore", { id: item.id }));
      const m2 = await byMethod();
      assert.deepEqual([r2(m2.cash - m0.cash), r2(m2.bank - m0.bank)], [-1000.25, 1000.25]);
      assert.ok(t2.id);
      await integrity("transfer");
    });

    test("nasıl bozarım: Kasa formuna banka/kart yolu, sıfır/eksi/kuruş artığı/devasa tutar, yanlış yön → 400", async () => {
      const c0 = await cash();
      for (const method of ["bank", "card", "xyz"]) await refused(`yol ${method}`, api.post("/api/workspace/cash", { kind: "in", amount: 10, date: d(), description: "x", method }), [400]);
      for (const amount of [0, -1, 1e13, "abc"]) await refused(`tutar ${amount}`, api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount, date: d() }), [400]);
      await refused("yön", api.post("/api/workspace/cash/transfer", { direction: "sideways", amount: 10, date: d() }), [400]);
      await refused("ileri tarih", api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: 10, date: "2099-01-01" }), [400]);
      const r = await api.post("/api/workspace/cash", { kind: "in", amount: "10.005", date: d(), description: "kuruş" });
      if (r.status === 200) {
        const e = (await must("kasa", api.get("/api/workspace/cash"))).entries.find(x => x.id === r.data.id);
        assert.equal(e.amount, r2(e.amount), "kuruş artığı yuvarlanmalı");
        await must("temizle", api.del(`/api/workspace/cash/${r.data.id}`));
      }
      assert.equal(await cash(), c0);
      await integrity("kasa bozma");
    });

    test("nasıl bozarım: eksi nakit politikası Engelle iken bankaya yatırma / aynı anda iki yatırma eksiye düşüremez", async () => {
      await must("politika", api.put("/api/admin/negative-policy", { cash: "block" }));
      try {
        const c0 = await cash();
        await refused("bakiyeden fazla yatırma", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: c0 + 1, date: d() }), [409]);
        const date = d();
        const amount = r2(c0 * 0.6);
        const [a, b] = await Promise.all([api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount, date }), api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount, date })]);
        assert.equal([a.status, b.status].filter(s => s === 200).length, 1, `${a.status}/${b.status}`);
        assert.ok((await cash()) >= 0, "Kasa eksiye düşmemeli");
        await refused("cashForce ile engel aşılmaz", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: (await cash()) + 1, date: d(), cashForce: true }), [409]);
        assert.ok((await cash()) >= 0);
      } finally {
        await must("politika geri", api.put("/api/admin/negative-policy", { cash: "warn" }));
      }
      await integrity("eksi politika");
    });

    test("çalışıyor mu: Uyar politikasında eksiye düşüren yatırma önce sorulur (409), onayla geçer", async () => {
      const c0 = await cash();
      const date = d();
      const first = await refused("uyarı", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: c0 + 100, date }), [409]);
      assert.ok(JSON.stringify(first.data).length > 0);
      await must("onaylı", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: c0 + 100, date, cashForce: true }));
      assert.equal(await cash(), -100);
      await must("geri getir", api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: 1000, date }));
      await integrity("uyar");
    });
  });

  // ======================= E. YETKİSİZ KULLANICI / ŞİRKET =======================
  describe("E. Yetkisiz kullanıcı ve şirket ayrımı", () => {
    let staff;
    let target;
    let doc;
    let ch;
    let plan;
    let entryCash;
    before(async () => {
      const created = await api.post("/api/admin/users", { username: "kisitli224", name: "Kısıtlı Personel", role: "personel", password: "Kisitli-2026!", mustChangePassword: false, grants: { add: [], remove: [] } });
      assert.equal(created.status, 200, JSON.stringify(created.data));
      const c = server.client();
      assert.equal((await c.login("kisitli224", "Kisitli-2026!")).status, 200);
      staff = wrap(c);
      target = await account("Yetki Hedef");
      doc = await invoice((await must("satış", sale(target, d(), { rest: "installments", installments: { count: 2, firstDue: "2025-11-01", everyMonths: 1 } }, { qty: 2 }))).id);
      ch = await must("çek", api.post("/api/workspace/cheques", { instrument: "cheque", direction: "in", accountId: target.id, amount: 100, issueDate: d(), dueDate: "2025-12-31", serialNo: `CK-E-${n}`, bank: "Z" }));
      plan = doc.planId;
      entryCash = await must("kasa", api.post("/api/workspace/cash", { kind: "in", amount: 50, date: d(), description: "yetki" }));
    });

    test("çalışıyor mu: personel yetkisiz modülleri okuyamaz", async () => {
      for (const url of ["/api/workspace/invoices", `/api/workspace/invoices/${doc.id}`, "/api/workspace/cash", "/api/workspace/cheques", "/api/admin/trash", "/api/workspace/ledger/integrity"]) {
        const r = await staff.get(url);
        assert.equal(r.status, 403, `${url}: ${r.status}`);
      }
    });

    test("nasıl bozarım: personel her yazma ucunda 403; veri değişmez", async () => {
      const s0 = { bal: await balance(target), cash: await cash(), card: (await card(plan)).remaining, ch: (await cheque(ch.id)).status, inv: (await invoice(doc.id)).status };
      const date = d();
      const attempts = [
        ["fatura", () => staff.post("/api/workspace/invoices", { scenario: "service_sale", accountId: target.id, issueDate: date, lines: [{ itemId: svc.id, qty: 1, unitPrice: 1, vatRate: 0 }], payment: {} })],
        ["iptal", () => staff.post(`/api/workspace/invoices/${doc.id}/cancel`, {})],
        ["düzenle", () => staff.post(`/api/workspace/invoices/${doc.id}/edit`, { scenario: "service_sale", accountId: target.id, issueDate: doc.issueDate, lines: [{ itemId: svc.id, qty: 1, unitPrice: 1, vatRate: 0 }], payment: {} })],
        ["sil", () => staff.del(`/api/workspace/invoices/${doc.id}`)],
        ["toplu sil", () => staff.post("/api/workspace/invoices/bulk-delete", { ids: [doc.id] })],
        ["toplu iptal", () => staff.post("/api/workspace/invoices/bulk-cancel", { ids: [doc.id] })],
        ["kasa giriş", () => staff.post("/api/workspace/cash", { kind: "out", amount: 10, date, description: "x" })],
        ["kasa düzelt", () => staff.put(`/api/workspace/cash/${entryCash.id}`, { kind: "in", amount: 1, date, description: "x" })],
        ["kasa sil", () => staff.del(`/api/workspace/cash/${entryCash.id}`)],
        ["transfer", () => staff.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: 10, date })],
        ["çek gir", () => staff.post("/api/workspace/cheques", { instrument: "cheque", direction: "in", accountId: target.id, amount: 1, issueDate: date, dueDate: "2025-12-31", serialNo: "Y1", bank: "Z" })],
        ["çek tahsil", () => staff.post(`/api/workspace/cheques/${ch.id}/actions`, { action: "collect", date })],
        ["çek sil", () => staff.del(`/api/workspace/cheques/${ch.id}`)],
        ["kart sil", () => staff.del(`/api/workspace/plans/${plan}`)],
        ["dönem kilidi", () => staff.put("/api/admin/period-lock", { lockedUntil: date })],
        ["politika", () => staff.put("/api/admin/negative-policy", { cash: "off" })],
        ["geri yükle", () => staff.post("/api/admin/trash/restore", { id: `cheque:${ch.id}` })],
      ];
      for (const [label, call] of attempts) {
        const r = await call();
        assert.equal(r.status, 403, `${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
      }
      const s1 = { bal: await balance(target), cash: await cash(), card: (await card(plan)).remaining, ch: (await cheque(ch.id)).status, inv: (await invoice(doc.id)).status };
      assert.deepEqual(s1, s0);
    });

    test("nasıl bozarım: personel ?hofCompany= ile yetkisiz şirkete okuyamaz/yazamaz", async () => {
      const second = await must("şirket", api.post("/api/companies", { name: "Gizli Şirket 224", select: false }));
      const id = second.id || second.company?.id;
      assert.ok(id, JSON.stringify(second));
      await must("002 cari", api.post(`/api/workspace/accounts?hofCompany=${id}`, { name: "Gizli Cari", type: "customer" }));
      for (const [method, url, body] of [["get", `/api/workspace/accounts?hofCompany=${id}`], ["get", `/api/workspace/plans?hofCompany=${id}`], ["post", `/api/workspace/accounts?hofCompany=${id}`, { name: "Sızma", type: "customer" }]]) {
        const r = await staff[method](url, body);
        assert.equal(r.status, 403, `${method} ${url}: ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
      }
      const seen = await must("002 cariler", api.get(`/api/workspace/accounts?hofCompany=${id}&status=all`));
      assert.deepEqual(seen.accounts.map(a => a.name), ["Gizli Cari"]);
      const own = await must("001 cariler", api.get("/api/workspace/accounts?status=all&limit=500&q=Gizli"));
      assert.equal(own.accounts.length, 0, "001'de 002'nin carisi görünmez");
    });
  });

  // ======================= D. DÖNEM KİLİDİ (en sonda; kilit bütün eski tarihleri kapatır) =======================
  describe("D. Dönem kilidi", () => {
    let acc;
    let old;
    let oldGoods;
    let oldCh;
    let oldCash;
    let oldCollected;
    let oldPlan;
    let trashCash;
    let lockDate;
    before(async () => {
      acc = await account("Kilit");
      old = await invoice((await must("eski satış", sale(acc, d(), { cash: [{ amount: 300, method: "cash" }], rest: "installments", installments: { count: 2, firstDue: "2025-11-01", everyMonths: 1 } }))).id);
      oldGoods = await invoice((await must("eski mal satışı", goodsSale(acc, d(), { rest: "open", dueDate: "2025-12-31" }, 2))).id);
      oldCh = await must("eski çek", api.post("/api/workspace/cheques", { instrument: "cheque", direction: "in", accountId: acc.id, amount: 100, issueDate: d(), dueDate: "2025-12-31", serialNo: `CK-D-${n}`, bank: "Z" }));
      oldCash = await must("eski kasa", api.post("/api/workspace/cash", { kind: "in", amount: 77, date: d(), description: "eski" }));
      const del = await must("kasa (silinecek)", api.post("/api/workspace/cash", { kind: "in", amount: 33, date: d(), description: "silinecek-kilit" }));
      await must("kasa sil", api.del(`/api/workspace/cash/${del.id}`));
      trashCash = (await must("silinenler", api.get("/api/admin/trash"))).find(t => t.kind === "cash" && t.title === "silinecek-kilit");
      oldPlan = old.planId;
      // Açık dönemde tahsil edilmiş çek; dönem kilitlenince bu işlem geri alınamamalı.
      oldCollected = await must("tahsil edilecek çek", api.post("/api/workspace/cheques", { instrument: "cheque", direction: "in", accountId: acc.id, amount: 40, issueDate: d(), dueDate: "2025-12-31", serialNo: `CK-DU-${n}`, bank: "Z" }));
      await must("açık dönemde tahsil", api.post(`/api/workspace/cheques/${oldCollected.id}/actions`, { action: "collect", date: d(), method: "cash" }));
      lockDate = d();
      await must("kilitle", api.put("/api/admin/period-lock", { lockedUntil: lockDate }));
    });
    after(async () => { await api.put("/api/admin/period-lock", { lockedUntil: "" }); });

    const state = async () => ({ bal: await balance(acc), methods: await byMethod(), qty: await stockQty(goods), card: (await card(oldPlan)).remaining, ch: (await cheque(oldCh.id)).status, inv: (await invoice(old.id)).status, inv2: (await invoice(oldGoods.id)).status });

    test("çalışıyor mu: kilit sonrası yeni tarihli işlem yazılır", async () => {
      assert.equal((await must("kilit", api.get("/api/workspace/ledger/lock"))).lockedUntil, lockDate);
      const later = d();
      await must("yeni kasa", api.post("/api/workspace/cash", { kind: "in", amount: 1, date: later, description: "yeni" }));
      await must("yeni fatura", sale(acc, later, { rest: "open", dueDate: later }));
      assert.equal(await balance(acc), 1000 + 700 + 200 - 100 - 40); // − 40: kilitten önce alınıp tahsil edilen çek
      await integrity("kilit sonrası");
    });

    test("nasıl bozarım: kilitli döneme her yazma 409 ve veri değişmez", async () => {
      const s0 = await state();
      const locked = lockDate;
      const attempts = [
        ["fatura", () => sale(acc, locked, { rest: "open", dueDate: locked })],
        ["iptal", () => api.post(`/api/workspace/invoices/${old.id}/cancel`, {})],
        ["düzenle", () => api.post(`/api/workspace/invoices/${old.id}/edit`, { scenario: "service_sale", accountId: acc.id, issueDate: old.issueDate, lines: [{ itemId: svc.id, qty: 1, unitPrice: 5, vatRate: 0 }], payment: { rest: "open", dueDate: old.issueDate } })],
        ["sil", () => api.del(`/api/workspace/invoices/${old.id}`)],
        ["iade (kilitli tarih)", () => api.post("/api/workspace/invoices", { kind: "sale_return", originalId: oldGoods.id, issueDate: locked, lines: [{ originLineId: oldGoods.lines[0].id, qty: 1 }], payment: {} })],
        ["kasa", () => api.post("/api/workspace/cash", { kind: "in", amount: 5, date: locked, description: "x" })],
        ["kasa düzelt", () => api.put(`/api/workspace/cash/${oldCash.id}`, { kind: "in", amount: 1, date: oldCash.date || locked, description: "x" })],
        ["kasa sil", () => api.del(`/api/workspace/cash/${oldCash.id}`)],
        ["transfer", () => api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: 1, date: locked })],
        ["taksit tahsilatı", () => api.post(`/api/workspace/plans/${oldPlan}/entries`, { kind: "in", amount: 10, date: locked, method: "cash" })],
        ["cari hareket", () => api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: 5, date: locked, note: "x" })],
      ];
      const wrong = [];
      for (const [label, call] of attempts) {
        const r = await call();
        if (![400, 409].includes(r.status)) wrong.push(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 150)}`);
      }
      assert.deepEqual(wrong, [], "kilitli dönemde kabul edilenler");
      assert.deepEqual(await state(), s0);
      await integrity("kilitli yazma");
    });

    test("nasıl bozarım: kilitli dönemdeki silinmiş Kasa hareketi Silinenler'den geri yüklenemez (409, Kasa değişmez)", async () => {
      assert.ok(trashCash, "silinen kasa hareketi Silinenler'de olmalı");
      const c0 = await cash();
      const r = await api.post("/api/admin/trash/restore", { id: trashCash.id });
      assert.equal(r.status, 409, `kilitli döneme geri yükleme reddedilmeliydi: ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
      assert.equal(await cash(), c0, "Kasa değişmemeli");
      await integrity("kilitli geri yükleme");
    });

    test("nasıl bozarım: kilitli dönemdeki çek tahsili geri alınamaz (409; Kasa ve çek durumu değişmez — 2.0.23'te geri alınıyordu)", async () => {
      const s0 = await state();
      const c0 = await cash();
      const r = await api.post(`/api/workspace/cheques/${oldCollected.id}/undo`, {});
      assert.equal(r.status, 409, `kilitli dönemdeki işlem geri alınmamalıydı: ${r.status} ${JSON.stringify(r.data).slice(0, 200)}`);
      assert.equal(r.data?.code, "period-locked");
      assert.equal((await must("çek", api.get(`/api/workspace/cheques/${oldCollected.id}`))).status, "collected");
      assert.equal(await cash(), c0, "Kasa değişmemeli");
      assert.deepEqual(await state(), s0);
      await integrity("kilitli geri alma");
    });

    test("çek/senet işlemleri dönem kilidine bağlı — kilitli tarihe giriş, tahsil, kilitli dönemdeki evrakı silme (2.0.23'te tahsil geçiyordu)", async () => {
      const s0 = await state();
      const wrong = [];
      const attempts = [
        ["kilitli tarihli çek girişi", () => api.post("/api/workspace/cheques", { instrument: "cheque", direction: "in", accountId: acc.id, amount: 55, issueDate: lockDate, dueDate: "2025-12-31", serialNo: `CK-DL-${n}`, bank: "Z" })],
        ["kilitli tarihte tahsil (nakit)", () => api.post(`/api/workspace/cheques/${oldCh.id}/actions`, { action: "collect", date: lockDate, method: "cash" })],
      ];
      for (const [label, call] of attempts) {
        const r = await call();
        if (![400, 409].includes(r.status)) wrong.push(`${label}: ${r.status}`);
        if (r.status === 200 && label.includes("tahsil")) await api.post(`/api/workspace/cheques/${oldCh.id}/undo`, {}).then(u => wrong.push(`  geri al (kilitli dönem): ${u.status}`));
        else if (r.status === 200 && r.data?.id) await api.del(`/api/workspace/cheques/${r.data.id}`).then(u => wrong.push(`  sil (kilitli dönem): ${u.status}`));
      }
      const del = await api.del(`/api/workspace/cheques/${oldCh.id}`);
      if (del.status === 200) {
        wrong.push("kilitli dönemdeki çeki silme: 200");
        await api.post("/api/admin/trash/restore", { id: `cheque:${oldCh.id}` });
      }
      assert.deepEqual(wrong, [], "kilitli dönemde kabul edilen çek işlemleri");
      assert.deepEqual(await state(), s0);
    });

    test("nasıl bozarım: kilidi gelecek tarihe/bozuk tarihe koymak 400", async () => {
      await refused("gelecek", api.put("/api/admin/period-lock", { lockedUntil: "2099-01-01" }), [400]);
      await refused("bozuk", api.put("/api/admin/period-lock", { lockedUntil: "31.12.2025" }), [400]);
      assert.equal((await must("kilit", api.get("/api/workspace/ledger/lock"))).lockedUntil, lockDate);
    });
  });
});
