// 2.0.22 madde 1/2 (yük ölçümü): fatura listesi ve sol menü rozeti ödeme durumunu çok carili istekte TOPLU hesaplar ve
// sonucu veri değişene kadar saklar (routes/invoices.mjs allPaymentStates). Fatura kartı cari başına yoldan hesaplanır.
// Bu test iki yolun HER faturada aynı sonucu verdiğini (durum, ödenen, açık, kapatanlar) ve saklanan sonucun ilk yazmada
// yenilendiğini denetler. İşlemler tohumlu rastgele sırayla: satış/alış (açık, peşin, taksitli, çekli), iade, iptal,
// bağlı/bağsız tahsilat-ödeme, Borç/Alacak Yaz, mahsup, taksit tahsilatı, çek tahsil/ciro/karşılıksız.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const pad = value => String(value).padStart(2, "0");
const iso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const shift = days => iso(new Date(Date.now() + days * 86_400_000));
const rng = seed => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

describe("fatura ödeme durumu: toplu yol (liste, rozet) = fatura kartı yolu", () => {
  let server;
  let api;
  const done = {};
  const ok = (label, response) => {
    if (response.status === 200) done[label] = (done[label] || 0) + 1;
    return response.status === 200 ? response.data : null;
  };
  before(async () => {
    server = await startTestServer();
    const client = await loginAdmin(server);
    api = {
      get: async url => unwrap(await client.get(url)),
      post: async (url, body) => unwrap(await client.post(url, body)),
      del: async url => unwrap(await client.del(url)),
    };
  });
  after(async () => server.close());

  const compare = async label => {
    const list = (await api.get("/api/workspace/invoices?tab=all&limit=5000")).data;
    const issued = list.invoices.filter(item => item.status === "issued");
    const accounts = new Set(issued.map(item => item.accountId));
    assert.ok(accounts.size > 8, `${label}: toplu yol denensin (fatura kesilen cari sayısı ${accounts.size} > 8)`);
    const key = item => JSON.stringify([item.payState, item.paid, item.open, (item.closers || []).map(c => [c.mode, c.amount, c.date, c.method || ""])]);
    const diffs = [];
    for (const item of issued) {
      const card = (await api.get(`/api/workspace/invoices/${item.id}`)).data;
      if (key(item) !== key(card)) diffs.push({ no: item.displayNo, kind: item.kind, liste: key(item), kart: key(card) });
    }
    assert.deepEqual(diffs, [], `${label}: ${diffs.length}/${issued.length} faturada liste ≠ kart`);
    return issued;
  };

  test("tohumlu rastgele 260 işlem: her faturada liste = kart; her ara denetimde de", async () => {
    const random = rng(2022);
    const pick = list => list[Math.floor(random() * list.length)];
    const money = (min, max) => Math.round((min + random() * (max - min)) * 100) / 100;
    assert.equal((await api.post("/api/workspace/cash", { kind: "in", amount: 5_000_000, date: shift(-90), description: "Açılış" })).status, 200);
    const customers = [];
    const suppliers = [];
    const both = [];
    for (let i = 0; i < 7; i += 1) customers.push((await api.post("/api/workspace/accounts", { name: `Müşteri ${i + 1}`, type: "customer", registeredOn: shift(-90) })).data.id);
    for (let i = 0; i < 4; i += 1) suppliers.push((await api.post("/api/workspace/accounts", { name: `Tedarikçi ${i + 1}`, type: "supplier", registeredOn: shift(-90) })).data.id);
    for (let i = 0; i < 3; i += 1) both.push((await api.post("/api/workspace/accounts", { name: `Hem Alıcı Hem Satıcı ${i + 1}`, type: "customer", registeredOn: shift(-90) })).data.id);
    const items = [];
    for (let i = 0; i < 3; i += 1) items.push((await api.post("/api/workspace/stock", { name: `Ürün ${i + 1}`, code: `DRM-${i + 1}`, unit: "Adet", unitPrice: 50, salePrice: 100 })).data.id);
    const sales = [];
    const purchases = [];
    const inCheques = [];
    const plans = [];
    let serial = 0;
    let purchaseNo = 0;
    const STEPS = 260;
    for (let step = 0; step < STEPS; step += 1) {
      // Tarihler ileri akar (VUK 231 sırası): her iki adımda bir gün.
      const day = shift(-85 + Math.floor(step / 3));
      const op = random();
      const lines = () => Array.from({ length: 1 + Math.floor(random() * 2) }, () => ({ itemId: pick(items), qty: 1 + Math.floor(random() * 4), unitPrice: money(20, 900), vatRate: pick([0, 10, 20]) }));
      if (op < 0.22) {
        const accountId = pick([...customers, ...both]);
        const variant = random();
        const payment = variant < 0.3 ? { rest: "open", dueDate: shift(-85 + Math.floor(step / 3) + Math.floor(random() * 40)) }
          : variant < 0.55 ? { cash: [{ amount: money(10, 300), method: pick(["cash", "bank", "card"]) }], rest: "open" }
            : variant < 0.8 ? { rest: "installments", installments: { count: 2 + Math.floor(random() * 3), firstDue: shift(-85 + Math.floor(step / 3) + 10), everyMonths: 1 } }
              : { cheques: [{ instrument: pick(["cheque", "note"]), amount: money(50, 400), dueDate: shift(Math.floor(random() * 60) - 20), serialNo: `G-${(serial += 1)}`, bank: "Ziraat" }], rest: "open" };
        const created = ok("satış", await api.post("/api/workspace/invoices", { scenario: "goods_sale", accountId, issueDate: day, lines: lines(), payment, force: true }));
        if (created) {
          sales.push({ id: created.id, accountId });
          const card = (await api.get(`/api/workspace/invoices/${created.id}`)).data;
          if (card.plan?.id) plans.push(card.plan.id);
        }
      } else if (op < 0.36) {
        const accountId = pick([...suppliers, ...both]);
        const variant = random();
        const payment = variant < 0.4 ? {} : variant < 0.75 ? { cash: [{ amount: money(10, 300), method: pick(["cash", "bank"]) }], rest: "open" }
          : { cheques: [{ instrument: "cheque", amount: money(50, 300), dueDate: shift(Math.floor(random() * 40)), serialNo: `V-${(serial += 1)}`, bank: "Halkbank" }], rest: "open" };
        const created = ok("alış", await api.post("/api/workspace/invoices", { scenario: "goods_purchase", accountId, number: `ALS-${(purchaseNo += 1)}`, issueDate: day, lines: lines(), payment, force: true, cashForce: true }));
        if (created) purchases.push({ id: created.id, accountId });
      } else if (op < 0.52) {
        // Cari kartından tahsilat/ödeme: yarısı "Kapatılacak Fatura" seçili (bağlı), yarısı otomatik (en eski).
        const sale = random() < 0.65;
        const pool = sale ? sales : purchases;
        if (!pool.length) continue;
        const target = pick(pool);
        const body = { kind: sale ? "in" : "out", amount: money(5, 500), date: day, method: pick(["cash", "bank", "card"]), cashForce: true };
        if (random() < 0.5) body.invoiceId = target.id;
        ok(body.invoiceId ? "bağlı ödeme" : "bağsız ödeme", await api.post(`/api/workspace/accounts/${target.accountId}/entries`, body));
      } else if (op < 0.58) {
        const accountId = pick([...customers, ...suppliers, ...both]);
        ok("borç/alacak yaz", await api.post(`/api/workspace/accounts/${accountId}/entries`, { kind: pick(["debt", "credit"]), amount: money(10, 400), date: day, note: "elle" }));
      } else if (op < 0.66) {
        // Mahsup: aynı carinin karşı yöndeki açık belgesiyle.
        const accountId = pick(both);
        const purchase = purchases.filter(item => item.accountId === accountId);
        if (!purchase.length) continue;
        const target = pick(purchase);
        const candidates = (await api.get(`/api/workspace/invoices/${target.id}/offsets`)).data;
        const counter = candidates?.invoices?.[0] ? { counterType: "invoice", counterId: candidates.invoices[0].id, left: candidates.invoices[0].open } : candidates?.entries?.[0] ? { counterType: "entry", counterId: candidates.entries[0].id, left: candidates.entries[0].left } : null;
        if (!counter || !(candidates.open > 0.01)) continue;
        const amount = Math.max(0.01, Math.round(Math.min(candidates.open, counter.left) * random() * 100) / 100);
        ok("mahsup", await api.post(`/api/workspace/invoices/${target.id}/offsets`, { counterType: counter.counterType, counterId: counter.counterId, amount, date: day }));
      } else if (op < 0.74) {
        if (!plans.length) continue;
        ok("taksit tahsilatı", await api.post(`/api/workspace/plans/${pick(plans)}/entries`, { kind: "in", amount: money(10, 300), date: day, method: pick(["cash", "bank"]) }));
      } else if (op < 0.82) {
        // Alınan çek/senet: tahsil, ciro (tedarikçiye) ya da karşılıksız.
        const list = (await api.get("/api/workspace/cheques?status=open&limit=500")).data;
        const open = (list?.cheques || list?.items || []).filter(item => item.direction === "in" && item.status === "portfolio");
        if (!open.length) continue;
        const cheque = pick(open);
        const action = pick(["collect", "endorse", "bounce", "bounce"]);
        ok(`çek ${action}`, await api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action, date: day > cheque.issueDate ? day : cheque.issueDate, status: cheque.status, accountId: action === "endorse" ? pick(suppliers) : "", method: "bank", cashForce: true }));
        inCheques.push(cheque.id);
      } else if (op < 0.9) {
        // Satıştan iade (kalemin bir kısmı), bazen geri ödemeli.
        if (!sales.length) continue;
        const target = pick(sales);
        const card = (await api.get(`/api/workspace/invoices/${target.id}`)).data;
        if (card?.status !== "issued" || !card.lines?.length) continue;
        const line = pick(card.lines);
        const payment = random() < 0.4 ? { cash: [{ amount: money(1, 50), method: "cash" }], rest: "open" } : { rest: "open" };
        ok("iade", await api.post("/api/workspace/invoices", { kind: "sale_return", originalId: target.id, issueDate: day > card.issueDate ? day : card.issueDate, lines: [{ originLineId: line.id, qty: 1 }], payment, force: true, cashForce: true }));
      } else if (op < 0.94) {
        const pool = random() < 0.6 ? sales : purchases;
        if (!pool.length) continue;
        const target = pool.splice(Math.floor(random() * pool.length), 1)[0];
        ok("iptal", await api.post(`/api/workspace/invoices/${target.id}/cancel`, { reason: "deneme", force: true, stockForce: true, cashForce: true }));
      } else {
        // Mahsubu geri al (varsa).
        const accountId = pick(both);
        const purchase = purchases.filter(item => item.accountId === accountId);
        if (!purchase.length) continue;
        const target = pick(purchase);
        const offsets = (await api.get(`/api/workspace/invoices/${target.id}/offsets`)).data?.offsets || [];
        const mine = offsets.filter(item => item.invoiceId === target.id);
        if (mine.length) ok("mahsup geri al", await api.del(`/api/workspace/invoices/${target.id}/offsets/${pick(mine).id}`));
      }
      if (step === 90 || step === 180) await compare(`adım ${step}`);
    }
    const issued = await compare("son");
    // Çeşitlilik: her tür gerçekten denendi (reddedilen istek sayılmaz).
    for (const [label, min] of Object.entries({ satış: 25, alış: 15, "bağlı ödeme": 5, "bağsız ödeme": 5, "borç/alacak yaz": 5, mahsup: 2, "taksit tahsilatı": 5, iade: 4, iptal: 3 })) {
      assert.ok((done[label] || 0) >= min, `${label}: en az ${min} başarılı işlem (yapılan ${done[label] || 0}; hepsi: ${JSON.stringify(done)})`);
    }
    assert.ok((done["çek bounce"] || 0) + (done["çek endorse"] || 0) + (done["çek collect"] || 0) >= 3, `çek işlemleri: ${JSON.stringify(done)}`);
    const states = new Set(issued.map(item => item.payState));
    for (const state of ["paid", "open", "installment"]) assert.ok(states.has(state), `durum çeşitliliği: ${state} (${[...states].join(", ")})`);
    assert.ok(issued.some(item => item.paid > 0 && item.open > 0), "kısmen ödenmiş fatura var (vadesi geçmiş olabilir)");
    assert.ok(issued.some(item => item.closers?.some(c => c.mode === "auto")) && issued.some(item => item.closers?.some(c => c.mode === "linked")), "otomatik ve bağlı kapama ikisi de var");
  });

  test("saklanan sonuç ilk yazmada yenilenir: tahsilat girilince liste ve rozet hemen değişir", async () => {
    const list = async () => (await api.get("/api/workspace/invoices?tab=sale&limit=5000")).data.invoices;
    const before = await list();
    const target = before.find(item => item.status === "issued" && item.open > 1 && item.kind === "sale" && !["installment"].includes(item.payState));
    assert.ok(target, "açık satış faturası var");
    const again = await list();
    assert.deepEqual(again.map(item => [item.id, item.paid, item.open]), before.map(item => [item.id, item.paid, item.open]), "veri değişmeden aynı sonuç");
    const paid = await api.post(`/api/workspace/accounts/${target.accountId}/entries`, { kind: "in", amount: 1, date: shift(0), method: "cash", invoiceId: target.id });
    assert.equal(paid.status, 200, JSON.stringify(paid.data).slice(0, 200));
    const now = (await list()).find(item => item.id === target.id);
    assert.equal(Math.round(now.paid * 100), Math.round((target.paid + 1) * 100), "liste yeni tahsilatı hemen gösterir");
    assert.equal(Math.round(now.open * 100), Math.round((target.open - 1) * 100));
    const card = (await api.get(`/api/workspace/invoices/${target.id}`)).data;
    assert.deepEqual([card.paid, card.open], [now.paid, now.open], "kart ile liste aynı");
    // Silinen tahsilat da hemen yansır.
    assert.equal((await api.del(`/api/workspace/accounts/${target.accountId}/entries/${paid.data.entryId}`)).status, 200);
    const back = (await list()).find(item => item.id === target.id);
    assert.deepEqual([back.paid, back.open], [target.paid, target.open], "silinen tahsilat listeden düştü");
  });
});
