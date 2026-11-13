// 2.5.0 BİRLEŞİK TUR 8 — İş 3: 'iade tahsilat değildir' (S151 = B, S158 = A) — YALNIZ GÖSTERİM.
// KARARLAR (iş listesi D, AYNEN):
//   S151 = B (13.11 06:12): "taksit kartının 'Tahsil Edilen'i (ve taksit satırının 'Ödenen'i) FATURASIZ stok iadesini SAYMAZ: iade tahsilat değildir; örnekte (Borç 500 +
//   satış kartı 1.000 + faturasız iade 300) 'Tahsil Edilen 0', 'Kalan' yine 700, bakiye 1.200; iade ayrı gösterilir (iade faturasıyla yapılan iadede bugünkü davranış — kart küçülür,
//   Tahsil Edilen 0 — aynen)."
//   S158 = A (13.11 08:35): "'iade tahsilat değildir' (S151 = B) HER kartta geçerlidir: satış kartı olmayan kartta da faturasız stok iadesi ve Değersiz yazma kartın 'Tahsil
//   Edilen'ine / taksit satırının 'Ödenen'ine SAYILMAZ (örnek: Borç 900 → kart 900 → iade 300: 'Tahsil Edilen 0', 'Kalan 600')."
//   S154 = B (13.11 07:31): "'Fazlasını Avans Yaz' ile kapanan kartta 'Tahsil Edilen' göstergesi bugünkü gibi kalır … 'Tahsil Edilen 1.300 · Kalan 0', fazla 100".
// Gösterim: Tahsil Edilen + Kalan + İade / Değersiz ile Kapanan (totals.returned) = Toplam (fazla tahsilat hariç). Kalan, bakiye, gecikmiş, takvim DEĞİŞMEZ (önce → sonra birebir —
// kanıt docs/kanit/<gün>/b8-iade3-*); burada karar metinlerinin sayıları ELLE (ders 5, 40).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const TODAY = "2026-10-20";
const NOW = `${TODAY}T12:00:00+03:00`;
const day = offset => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const r2 = value => Math.round(value * 100) / 100;
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const steppingClock = (start = NOW, step = 7) => {
  let at = Date.parse(start);
  return () => (at += step);
};

describe("Birleşik tur 8 — İş 3: faturasız iade ve Değersiz yazma kartın Tahsil Edilen'ine / satırın Ödenen'ine sayılmaz (S151 = B, S158 = A); yalnız gösterim", () => {
  let h;
  before(async () => {
    const server = await startTestServer({ now: steppingClock(), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const client = await loginAdmin(server);
    const api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)), put: async (url, body) => unwrap(await client.put(url, body)), del: async url => unwrap(await client.del(url)) };
    await api.post("/api/workspace/bank/setup/dismiss", {});
    const must = async (label, promise) => {
      const res = await promise;
      assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      return res.data;
    };
    let n = 0;
    h = { server, api, must, store: server.app.store };
    h.goods = await must("mal", api.post("/api/workspace/stock", { kind: "goods", code: "MAL-TUR8-IADE", name: "Tur8 Malı", unit: "Adet", openingQty: "100000", salePrice: "100" }));
    h.service = await must("hizmet", api.post("/api/workspace/stock", { kind: "service", code: "HZM-TUR8-IADE", name: "Tur8 Hizmeti", unit: "Adet", salePrice: "500" }));
    h.account = label => must(`cari ${label}`, api.post("/api/workspace/accounts", { name: `Tur8 İade ${label}`, type: "customer", registeredOn: day(-400), phone: `0500 289 ${String(10 + Math.floor((n += 1) / 100)).padStart(2, "0")} ${String(n % 100).padStart(2, "0")}` }));
    h.entry = (acc, body) => must(`hareket ${body.kind}`, api.post(`/api/workspace/accounts/${acc.id}/entries`, { method: "cash", cashForce: true, similarOk: true, ...body }));
    h.stockSale = async acc => {
      await must("stok satışı", api.post(`/api/workspace/stock/${h.goods.id}/moves`, { kind: "out", qty: "1", unitPrice: "1000", pay: "account", accountId: acc.id, date: day(-45), installments: { count: 2, firstDue: day(-20), everyMonths: 1 } }));
      return (await must("cari", api.get(`/api/workspace/accounts/${acc.id}`))).plans[0].id;
    };
    h.coverCard = async acc => {
      await h.entry(acc, { kind: "debt", amount: "900", date: day(-70) });
      return (await must("kart", api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-65), total: "900", accountId: acc.id, mode: "auto", count: "3", firstDue: day(-40), everyMonths: "1", coversBalance: true }))).id;
    };
    h.ownCard = async acc => (await must("kart", api.post("/api/workspace/plans", { name: acc.name, registeredOn: day(-65), total: "900", accountId: acc.id, mode: "auto", count: "3", firstDue: day(-40), everyMonths: "1" }))).id;
    h.invoiceCard = async acc => {
      const inv = await must("taksitli fatura", api.post("/api/workspace/invoices", { kind: "sale", accountId: acc.id, issueDate: day(-60), lines: [{ itemId: h.service.id, name: "", qty: 2, unitPrice: "500", discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [], rest: "installments", installments: { count: 2, firstDue: day(-30), everyMonths: 1 } }, force: true, cashForce: true }));
      return (await must("fatura", api.get(`/api/workspace/invoices/${inv.id}`))).planId;
    };
    h.laterDebt = acc => h.entry(acc, { kind: "debt", amount: "500", date: day(-1), dueDate: day(30) });
    h.stockReturn = (acc, amount, date = day(-5)) => must("faturasız stok iadesi", api.post(`/api/workspace/stock/${h.goods.id}/moves`, { kind: "in", qty: "1", unitPrice: String(amount), pay: "account", accountId: acc.id, date, reason: "return" }));
    h.writeOff = async (acc, amount, date = day(-5)) => {
      const taken = await must("şüpheliye al", api.post(`/api/workspace/accounts/${acc.id}/doubtful`, { amount: String(amount), date, reason: "lawsuit", note: "dava" }));
      await must("değersiz yaz", api.post(`/api/workspace/accounts/${acc.id}/doubtful/${taken.id || taken.record?.id}/write-off`, { amount: String(amount), date, note: "kesin kayıp" }));
    };
    h.view = async (planId, acc) => {
      const p = await must("kart", api.get(`/api/workspace/plans/${planId}`));
      const card = await must("cari", api.get(`/api/workspace/accounts/${acc.id}`));
      const row = card.plans.find(item => item.id === planId);
      const list = (await must("Taksitler", api.get("/api/workspace/plans?status=all"))).plans.find(item => item.id === planId);
      return { p, card, row, list };
    };
  });
  after(async () => h?.server.close());

  const equality = t => assert.equal(r2(t.paid + t.remaining + t.returned), r2(t.total), `Tahsil Edilen ${t.paid} + Kalan ${t.remaining} + İade / Değersiz ${t.returned} = Toplam ${t.total}`);

  it("KARAR ÖRNEĞİ S151 — Borç 500 + satış kartı 1.000 (2 × 500) + faturasız iade 300: Tahsil Edilen 0, Kalan 700, iade ayrı (300), bakiye 1.200; liste ve cari kartı aynı", async () => {
    const acc = await h.account("S151 Örnek");
    await h.entry(acc, { kind: "debt", amount: "500", date: day(-50), dueDate: day(30) });
    const planId = await h.stockSale(acc);
    await h.stockReturn(acc, 300, day(-40));
    const { p, card, row, list } = await h.view(planId, acc);
    assert.deepEqual([p.totals.total, p.totals.paid, p.totals.remaining, p.totals.returned, card.totals.balance], [1000, 0, 700, 300, 1200]);
    assert.deepEqual(p.items.map(item => [item.paid, item.returned]), [[0, 300], [0, 0]], "satırın Ödenen'i iadeyi saymaz; iade satırda ayrı");
    equality(p.totals);
    assert.deepEqual([row.totals.paid, row.totals.remaining, row.totals.returned, list.totals.paid, list.totals.remaining], [0, 700, 300, 0, 700], "cari kartı satırı ve Taksitler listesi aynı");
  });

  it("KARAR ÖRNEĞİ S158 — Borç 900 → Mevcut Borç kartı 900 → faturasız iade 300: Tahsil Edilen 0, Kalan 600", async () => {
    const acc = await h.account("S158 Örnek");
    const planId = await h.coverCard(acc);
    await h.stockReturn(acc, 300, day(-30));
    const { p, card } = await h.view(planId, acc);
    assert.deepEqual([p.totals.paid, p.totals.remaining, card.totals.balance], [0, 600, 600]);
    assert.ok(p.items.every(item => item.paid === 0), "satırların Ödenen'i 0");
    equality(p.totals);
  });

  // Sınıf listesi (S158 "HER kart"): kart türü × (faturasız iade / Değersiz yazma). Ek borç (500, vade 30 gün sonra) kartı bakiyeye göre kırpılmaktan korur; 300 en eski vadeli
  // açık taksiti kapatır (S50 / 2.4.5 KS7 (a), (b)) — kapanan kısım 'İade / Değersiz ile Kapanan', Tahsil Edilen 0, Kalan = Toplam − 300.
  const KINDS = [
    ["satış kartı (stoktan taksitli satış 1.000)", "stockSale", 1000, [[0, 300], [0, 0]]],
    ["Mevcut Borç kartı (Borç 900 → kart 900)", "coverCard", 900, [[0, 300], [0, 0], [0, 0]]],
    ["elle açılan ayrı kart (900)", "ownCard", 900, [[0, 300], [0, 0], [0, 0]]],
    ["taksitli fatura kartı (2 × 500)", "invoiceCard", 1000, [[0, 300], [0, 0]]],
  ];
  for (const [label, make, total, rows] of KINDS) {
    for (const [closer, run] of [["faturasız stok iadesi 300", acc => h.stockReturn(acc, 300)], ["Değersiz Alacak Yaz 300", acc => h.writeOff(acc, 300)]]) {
      it(`${label} × ${closer}: Tahsil Edilen 0, İade / Değersiz ile Kapanan 300, Kalan ${total - 300}; satırların Ödenen'i 0`, async () => {
        const acc = await h.account(`${make} ${closer.slice(0, 8)}`);
        const planId = await h[make](acc);
        await h.laterDebt(acc);
        await run(acc);
        const { p, row } = await h.view(planId, acc);
        assert.deepEqual([p.totals.total, p.totals.paid, p.totals.returned, p.totals.remaining], [total, 0, 300, total - 300]);
        assert.deepEqual(p.items.map(item => [item.paid, item.returned]), rows);
        assert.deepEqual([row.totals.paid, row.totals.returned, row.totals.remaining], [0, 300, total - 300], "cari kartı satırı aynı");
        equality(p.totals);
      });
    }
  }

  it("komşu — iade + bağsız tahsilat birlikte: satış kartı 1.000, iade 300 (1. taksit), bağsız 400 ⇒ Tahsil Edilen 400 (yalnız para), İade 300, Kalan 300", async () => {
    const acc = await h.account("İade ve Bağsız");
    const planId = await h.stockSale(acc);
    await h.laterDebt(acc);
    await h.stockReturn(acc, 300, day(-12));
    await h.entry(acc, { kind: "in", amount: "400", date: day(-6) });
    const { p } = await h.view(planId, acc);
    assert.deepEqual([p.totals.paid, p.totals.returned, p.totals.remaining], [400, 300, 300]);
    assert.deepEqual(p.items.map(item => [item.paid, item.returned, item.remaining]), [[200, 300, 0], [200, 0, 300]]);
    equality(p.totals);
  });

  it("komşu — KISMİ iade 120: Tahsil Edilen 0, İade 120, Kalan 880; satır 380 açık", async () => {
    const acc = await h.account("Kısmi İade");
    const planId = await h.stockSale(acc);
    await h.laterDebt(acc);
    await h.stockReturn(acc, 120);
    const { p } = await h.view(planId, acc);
    assert.deepEqual([p.totals.paid, p.totals.returned, p.totals.remaining, p.items[0].remaining], [0, 120, 880, 380]);
    equality(p.totals);
  });

  it("komşu — iadenin SİLİNMESİ: iade 300 → stok hareketi silinir ⇒ İade 0, Tahsil Edilen 0, Kalan 1.000", async () => {
    const acc = await h.account("İade Silme");
    const planId = await h.stockSale(acc);
    await h.laterDebt(acc);
    await h.stockReturn(acc, 300);
    assert.equal((await h.view(planId, acc)).p.totals.returned, 300, "ön koşul: iade satırda");
    const move = h.store.get("SELECT id FROM stock_moves WHERE account_id = ? AND reason = 'return' ORDER BY rowid DESC LIMIT 1", acc.id);
    await h.must("iadeyi sil", h.api.del(`/api/workspace/stock/${h.goods.id}/moves/${move.id}`));
    const { p } = await h.view(planId, acc);
    assert.deepEqual([p.totals.paid, p.totals.returned, p.totals.remaining], [0, 0, 1000]);
  });

  it("S154 = B DOKUNULMADI — kart 1.200 / 3, karttan 500 + 800 'Fazlasını Avans Yaz' ⇒ Tahsil Edilen 1.300 · Kalan 0, İade 0", async () => {
    const acc = await h.account("S154");
    const planId = await h.ownCard(acc);
    await h.must("tutar 1.200", h.api.put(`/api/workspace/plans/${planId}`, { name: acc.name, registeredOn: day(-65), total: "1200" }));
    await h.must("dağıt", h.api.post(`/api/workspace/plans/${planId}/distribute`, { count: "3", firstDue: day(-40), everyMonths: "1" }));
    await h.must("karttan 500", h.api.post(`/api/workspace/plans/${planId}/entries`, { kind: "in", amount: "500", date: day(-30), method: "cash", cashForce: true, similarOk: true }));
    await h.must("karttan 800 avanslı", h.api.post(`/api/workspace/plans/${planId}/entries`, { kind: "in", amount: "800", date: day(-20), method: "cash", cashForce: true, similarOk: true, overpay: true }));
    const { p, card } = await h.view(planId, acc);
    assert.deepEqual([p.totals.paid, p.totals.remaining, p.totals.returned, card.totals.balance], [1300, 0, 0, -100]);
  });
});
