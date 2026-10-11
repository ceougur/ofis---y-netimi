// Hakem sondası (IADE-KAPAMA): verilen kökteki programı (test/helpers.mjs startTestServer) açar, iade/kapama durumlarını programın
// gerçek HTTP uçlarıyla kurar, fatura kartını, cari bakiyesini ve Açık Faturalar / Alacak Yaşlandırma raporlarını okur.
//   node sonda.mjs <program-kökü>
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(process.argv[2]);
const { startTestServer, loginAdmin } = await import(pathToFileURL(path.join(root, "test", "helpers.mjs")).href);

const day = "2026-10-05";
const out = { root, durumlar: {} };

async function ok(res, what) {
  if (res.status !== 200) throw new Error(`${what}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data && typeof res.data === "object" && "data" in res.data ? res.data.data : res.data;
}

async function scenario(name, fn) {
  const server = await startTestServer();
  try {
    const admin = await loginAdmin(server);
    await admin.put("/api/admin/negative-policy", { cash: "off" });
    const api = {
      async product(qtyIn) {
        const p = await ok(await admin.post("/api/workspace/stock", { name: `Ürün ${Math.random().toString(36).slice(2, 6)}`, unit: "Adet", kind: "product" }), "stok kartı");
        if (qtyIn) await ok(await admin.post(`/api/workspace/stock/${p.id}/moves`, { kind: "in", qty: qtyIn, pay: "none", date: day, note: "Parasız giriş" }), "stok girişi");
        return p.id;
      },
      async account(type) {
        return (await ok(await admin.post("/api/workspace/accounts", { name: `Cari ${type} ${Math.random().toString(36).slice(2, 6)}`, type }), "cari")).id;
      },
      async invoice(kind, accountId, lines, cash = [], extra = {}) {
        const body = { kind, accountId, issueDate: day, pricesIncludeVat: false, lines, ...(kind === "purchase" ? { number: `A${Math.random().toString(36).slice(2, 8)}` } : {}), payment: { cash: cash.map((c, i) => ({ ...c, lineKey: `p${i + 1}` })), rest: "open" }, negativeOk: true, cashForce: true, ...extra };
        return (await ok(await admin.post("/api/workspace/invoices", body), `fatura ${kind}`)).id;
      },
      async ret(originalId, qty, refund) {
        const orig = await ok(await admin.get(`/api/workspace/invoices/${originalId}`), "asıl fatura");
        const kind = orig.kind === "sale" ? "sale_return" : "purchase_return";
        const body = { kind, originalId, issueDate: day, lines: [{ originLineId: orig.lines[0].id, qty }], payment: { cash: refund ? [{ amount: refund, method: "cash", lineKey: "g1" }] : [] }, negativeOk: true, cashForce: true };
        return (await ok(await admin.post("/api/workspace/invoices", body), "iade")).id;
      },
      async pay(accountId, kind, amount, invoiceId) {
        return ok(await admin.post(`/api/workspace/accounts/${accountId}/entries`, { kind, amount, date: day, method: "cash", ...(invoiceId ? { invoiceId } : {}), negativeOk: true, cashForce: true }), "cari tahsilat/ödeme");
      },
      async card(id) {
        const d = await ok(await admin.get(`/api/workspace/invoices/${id}`), "fatura kartı");
        return { no: d.number, tur: d.kind, toplam: d.payableTotal, odenen: d.paid, acik: d.open, durum: d.payLabel || d.stateLabel || d.payState || d.state, kapatanlar: (d.closers || []).map(c => `${c.label || c.id}:${c.amount}:${c.mode}`) };
      },
      async balance(accountId) {
        const d = await ok(await admin.get(`/api/workspace/accounts/${accountId}`), "cari");
        const a = d.account || d;
        return a.balance ?? d.balance ?? d.totals?.balance;
      },
      async report(id) {
        const d = await ok(await admin.get(`/api/workspace/report-center/${id}`), `rapor ${id}`);
        return { ozet: d.summary, satirlar: d.rows };
      },
    };
    out.durumlar[name] = await fn(api);
  } catch (error) {
    out.durumlar[name] = { hata: String(error.message || error) };
  } finally {
    await server.close();
  }
}

const L = (itemId, qty, unitPrice, extra = {}) => [{ itemId, qty, unitPrice, vatRate: 20, ...extra }];

// E: en küçük senaryo (rastgele-1-500 adım 121) — alış 23,93, 9,84 nakit peşin; tam iade açık.
await scenario("E-en-kucuk-alis-iade-acik-asil-kapali", async api => {
  const u = await api.product(0);
  const t = await api.account("supplier");
  const f = await api.invoice("purchase", t, L(u, 1, 20.99, { discountRate: 5 }), [{ amount: 9.84, method: "cash" }]);
  const r = await api.ret(f, 1, 0);
  return { F6: await api.card(f), R1: await api.card(r), cariBakiye: await api.balance(t), acikFaturalar: (await api.report("acik-faturalar")).ozet };
});

// I-alış: alış 1.200 açık; alıştan iade 240, tedarikçi nakit geri öder.
await scenario("I-alis-iade-nakit-asil-acik", async api => {
  const u = await api.product(10);
  const t = await api.account("supplier");
  const f = await api.invoice("purchase", t, L(u, 10, 100));
  const r = await api.ret(f, 2, 240);
  return { F1: await api.card(f), R1: await api.card(r), cariBakiye: await api.balance(t), acikFaturalar: (await api.report("acik-faturalar")).ozet };
});

// I-satış: satış 600 açık; satıştan iade 240, müşteriye nakit geri ödenir. Sonra müşteri F1'e bağlı 360 öder.
await scenario("I-satis-iade-nakit-asil-acik", async api => {
  const u = await api.product(10);
  const m = await api.account("customer");
  const f = await api.invoice("sale", m, L(u, 5, 100));
  const r = await api.ret(f, 2, 240);
  const once = { F1: await api.card(f), R1: await api.card(r), cariBakiye: await api.balance(m), acikFaturalar: (await api.report("acik-faturalar")).ozet, alacakYaslandirma: (await api.report("alacak-yaslandirma")).ozet };
  await api.pay(m, "in", 360, f);
  const sonra = { F1: await api.card(f), cariBakiye: await api.balance(m), acikFaturalar: (await api.report("acik-faturalar")).ozet, alacakYaslandirma: (await api.report("alacak-yaslandirma")).ozet };
  return { once, "360 F1'e bağlı tahsilattan sonra": sonra };
});

// I'-satış (gerçekçi): satış 600, 300 nakit peşin, 300 açık; 2 adet (240) iade, müşteriye nakit geri.
await scenario("Iprim-satis-kismi-pesin-iade-nakit", async api => {
  const u = await api.product(10);
  const m = await api.account("customer");
  const f = await api.invoice("sale", m, L(u, 5, 100), [{ amount: 300, method: "cash" }]);
  const r = await api.ret(f, 2, 240);
  return { F1: await api.card(f), R1: await api.card(r), cariBakiye: await api.balance(m), acikFaturalar: (await api.report("acik-faturalar")).ozet, alacakYaslandirma: (await api.report("alacak-yaslandirma")).ozet };
});

// II-satış: satış 600 tamamı peşin; 240 iade geri ödenmez. Sonra aynı müşteriye 600 açık satış F2.
await scenario("II-satis-iade-acik-asil-odenmis", async api => {
  const u = await api.product(10);
  const m = await api.account("customer");
  const f = await api.invoice("sale", m, L(u, 5, 100), [{ amount: 600, method: "cash" }]);
  const r = await api.ret(f, 2, 0);
  const once = { F1: await api.card(f), R1: await api.card(r), cariBakiye: await api.balance(m), acikFaturalar: (await api.report("acik-faturalar")).ozet };
  const f2 = await api.invoice("sale", m, L(u, 5, 100));
  const sonra = { F2: await api.card(f2), R1: await api.card(r), cariBakiye: await api.balance(m), acikFaturalar: (await api.report("acik-faturalar")).ozet };
  return { once, "F2 600 açık satıştan sonra": sonra };
});

// II-alış: alış 1.200 tamamı peşin; 240 iade geri alınmaz.
await scenario("II-alis-iade-acik-asil-odenmis", async api => {
  const u = await api.product(10);
  const t = await api.account("supplier");
  const f = await api.invoice("purchase", t, L(u, 10, 100), [{ amount: 1200, method: "cash" }]);
  const r = await api.ret(f, 2, 0);
  return { F1: await api.card(f), R1: await api.card(r), cariBakiye: await api.balance(t), acikFaturalar: (await api.report("acik-faturalar")).ozet };
});

console.log(JSON.stringify(out, null, 2));
