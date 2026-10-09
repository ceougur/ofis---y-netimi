// 2.1.0 — Canlı Hata 2: peşinli + taksitli satış faturasında iade + peşinin geri ödenmesi taksit kartını yeniden büyütüyordu
// (2.0.24 G1 düzeltmesinin gerilemesi; v2.0.24/25/26'da var, v2.0.23'te yok).
//
// Kural (yaygın programlardaki iade/geri ödeme mahsubu): faturanın kendi kartının kalanı = max(0, imzalı açık + geri ödenen),
// imzalı açık = fatura − (peşin + kart tahsilatı + çek/senet + iadeler). Geri ödeme önce iadenin faturayı aşıp avansa dönen
// kısmından düşülür; yalnız ondan artan kısım müşteriyi yeniden borçlandırır ve kartta kalır (2.0.24 G1: peşinsiz kart).
//
// Nasıl bozarım (önce yazıldı; testler buradan):
//   C  malın tamamı iade + peşinin tamamı nakit geri → cari 0, Kasa 0; kart 0 olmalı (programda 500 kalıyordu, gecikiyordu)
//   B  önce açık iade (avans doğar) sonra paralı iade → kart 0 (400 bugün vadeli taksit açılıyordu)
//   A  kart fazla tahsil edilmiş + paralı iade → kart büyümez (300'lük yeni taksit açılıyordu)
//   D  peşinsiz kart + paralı kısmi iade → kart küçülmez (G1 korunur)
//   E  peşinli kart + paralı KISMİ iade → kart küçülmez (müşteri borcu değişmedi)
//   F  peşin çek/senetle alınmış; tam iade + nakit geri → kart 0
//   G  peşin banka hesabına havale; tam iade + aynı hesaptan havale geri → kart 0; hesap bakiyesi eski hâline döner
//   H  iki iade arka arkaya (ikisi de paralı / biri açık) → kart 0
//   I  iade iptal edilir / silinir → kart eski hâline (500) döner, iade yeniden kesilince yine 0
//   J  kartın bir kısmı tahsil edilmiş; tam iade + (peşin + tahsil edilen) geri → kart 0 (programda 300 kalıyordu)
// Her senaryoda: kart toplamı/kalanı, fatura açığı, cari bakiyesi; saat ilerletilince Geciken Taksitler, Alacak Yaşlandırma,
// ANLIK DURUM "Geciken Alacak", cari kartı Geciken, Cari Mizanı "Geciken Taksiti Olan", Vade Takip — hepsi kartın kalanıyla aynı.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { openAcceptanceAccounts } from "./banka-210-hesap-ortak.mjs";

const NOW = "2026-10-09T09:00:00Z";
const LATER = "2026-12-20T09:00:00Z";
const SALE_DAY = "2026-08-03";
const FIRST_DUE = "2026-11-02";
const RET_DAY = "2026-10-09";
const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && r.data.ok === true ? r.data.data : r.data, error: r.data?.error, code: r.data?.code });
const money = text => Number(String(text ?? "").replace(/[^\d,-]/g, "").replace(",", ".")) || 0;
const r2 = n => Math.round(n * 100) / 100;

async function fresh(now = NOW) {
  const server = await startTestServer({ now });
  const client = await loginAdmin(server);
  const api = {
    get: async url => unwrap(await client.get(url)),
    post: async (url, body) => unwrap(await client.post(url, body)),
    del: async url => unwrap(await client.del(url)),
  };
  return { server, api };
}
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
  return res.data;
};
let seq = 0;
const customer = (api, name) => must("cari", api.post("/api/workspace/accounts", { name: `${name} ${++seq}`, type: "customer", registeredOn: "2026-08-01" }));
// 10 × 100 = 1.000 (KDV'siz hizmet); peşin satırları + kalan taksitte.
async function sale(api, acc, { qty = 10, price = 100, cash = [], cheques = [], count = 1, date = SALE_DAY, firstDue = FIRST_DUE } = {}) {
  const doc = await must("satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: acc.id, issueDate: date, issueTime: "10:00", currency: "TRY", rate: 1, pricesIncludeVat: false, discountRate: 0, stoppageRate: 0, lines: [{ name: "Hizmet", qty, unitPrice: price, discountRate: 0, vatRate: 0 }], payment: { cash, cheques, endorse: [], rest: "installments", installments: { count, firstDue, everyMonths: 1 } }, force: true, cashForce: true }));
  return { id: doc.id, planId: doc.plan?.id || doc.planId, lineId: doc.lines[0].id };
}
const giveBack = (api, acc, inv, qty, refund = [], date = RET_DAY) => must("iade", api.post("/api/workspace/invoices", { kind: "sale_return", accountId: acc.id, originalId: inv.id, issueDate: date, issueTime: "11:00", currency: "TRY", rate: 1, lines: [{ originLineId: inv.lineId, qty }], payment: { cash: refund, cheques: [], endorse: [], rest: "open" }, force: true, cashForce: true }));
const nakit = amount => [{ amount, method: "cash" }];

// Kartın ve raporların bugünkü hâli (bu cari için).
async function state(api, acc, inv) {
  const plan = await must("kart", api.get(`/api/workspace/plans/${inv.planId}`));
  const invoice = await must("fatura", api.get(`/api/workspace/invoices/${inv.id}`));
  const account = await must("cari kartı", api.get(`/api/workspace/accounts/${acc.id}`));
  const late = await must("Geciken Taksitler", api.get("/api/workspace/report-center/geciken-taksitler"));
  const aging = await must("Alacak Yaşlandırma", api.get("/api/workspace/report-center/alacak-yaslandirma"));
  const overview = await must("ANLIK DURUM", api.get("/api/workspace/overview"));
  const mizan = await must("Cari Mizanı", api.get("/api/workspace/overview/mizan?preset=all&side=overdue"));
  const vade = await must("Vade Takip", api.get("/api/workspace/overview/vade-takip?from=2020-01-01&to=2030-12-31&sources=plan"));
  const lateRows = (late.rows || []).filter(row => JSON.stringify(row).includes(acc.name));
  return {
    card: { total: plan.totals.total, paid: plan.totals.paid, left: plan.totals.remaining },
    items: (plan.items || []).filter(item => Number(item.amount) > 0).map(item => `${item.dueDate}:${item.amount}`),
    open: invoice.open,
    balance: account.totals.balance,
    accountOverdue: account.totals.overdue || 0,
    late: r2(lateRows.reduce((sum, row) => sum + money(row.at(-2) ?? row.at(-1)), 0)),
    lateRows: lateRows.length,
    aging: money((aging.rows || []).find(row => row[0] === acc.name)?.at(-1)),
    overviewOverdue: overview.receivable.overdue,
    mizanOverdue: (mizan.rows || []).some(row => row.name === acc.name || row[1] === acc.name),
    vade: r2((vade.rows || []).filter(row => row.party === acc.name || row.accountName === acc.name).reduce((sum, row) => sum + (Number(row.amount) || 0), 0)),
  };
}
// Bugün: kart, fatura, cari, yaşlandırma, Vade Takip; saat kartın vadelerinden sonraya alınınca: gecikme göstergelerinin hepsi = kalan.
async function expectCard(ctx, acc, inv, { left, balance, open = 0, total, cheques = 0 }, label) {
  const now = await state(ctx.api, acc, inv);
  assert.equal(now.card.left, left, `${label}: kartın kalanı ${now.card.left} (beklenen ${left}) · taksitler [${now.items}]`);
  if (total !== undefined) assert.equal(now.card.total, total, `${label}: kartın toplamı`);
  assert.equal(now.open, open, `${label}: fatura açığı`);
  assert.equal(now.balance, balance, `${label}: cari bakiyesi`);
  assert.equal(now.aging, left + cheques, `${label}: Alacak Yaşlandırma = kartın kalanı (+ portföydeki çek)`);
  assert.equal(now.vade, left, `${label}: Vade Takip = kartın kalanı`);
  ctx.server.clock.set(LATER);
  try {
    const late = await state(ctx.api, acc, inv);
    assert.equal(late.accountOverdue, left, `${label}: cari kartı Geciken (sonra)`);
    assert.equal(late.overviewOverdue, left, `${label}: ANLIK DURUM Geciken Alacak (sonra)`);
    assert.equal(late.late, left, `${label}: Geciken Taksitler toplamı (sonra) · ${late.lateRows} satır`);
    assert.equal(late.mizanOverdue, left > 0, `${label}: Cari Mizanı "Geciken Taksiti Olan" (sonra)`);
    assert.equal(late.aging, left + cheques, `${label}: Alacak Yaşlandırma (sonra)`);
  } finally {
    ctx.server.clock.set(NOW);
  }
}
async function scenario(fn) {
  const ctx = await fresh();
  try {
    await fn(ctx);
  } finally {
    await ctx.server.close();
  }
}

describe("2.1.0 Canlı Hata 2 — iade + peşin geri ödemesi taksit kartını büyütmez", () => {
  test("C: 1.000 (500 peşin, 500 taksit) → malın tamamı iade, 500 nakit geri → kart 0, cari 0, Kasa 0, gecikme yok", () => scenario(async ctx => {
    const acc = await customer(ctx.api, "C Müşteri");
    const inv = await sale(ctx.api, acc, { cash: nakit(500) });
    await giveBack(ctx.api, acc, inv, 10, nakit(500));
    await expectCard(ctx, acc, inv, { left: 0, balance: 0 }, "C");
    const cash = await must("Kasa", ctx.api.get("/api/workspace/cash?method=all"));
    assert.equal(cash.byMethod?.cash ?? cash.totals?.balance, 0, "Kasa nakit 0");
  }));

  test("C2: aynı akış 2 taksitle (vadeler geçmiş) → kart 0", () => scenario(async ctx => {
    const acc = await customer(ctx.api, "C2 Müşteri");
    const inv = await sale(ctx.api, acc, { cash: nakit(500), count: 2, firstDue: "2026-09-01" });
    await giveBack(ctx.api, acc, inv, 10, nakit(500));
    await expectCard(ctx, acc, inv, { left: 0, balance: 0 }, "C2");
  }));

  test("B: 1.000 (500 peşin) → 600 açık iade (cari −100) → 400 iade + 400 nakit geri → kart 0, cari −100", () => scenario(async ctx => {
    const acc = await customer(ctx.api, "B Müşteri");
    const inv = await sale(ctx.api, acc, { cash: nakit(500) });
    await giveBack(ctx.api, acc, inv, 6);
    await expectCard(ctx, acc, inv, { left: 0, balance: -100 }, "B iade-1");
    await giveBack(ctx.api, acc, inv, 4, nakit(400));
    await expectCard(ctx, acc, inv, { left: 0, balance: -100 }, "B iade-2");
  }));

  test("A: 3.000 (2.000 peşin, 1.000 taksit) → 1 açık iade → karttan 1.500 (fazla) → 1 iade + 300 nakit geri → kart büyümez", () => scenario(async ctx => {
    const acc = await customer(ctx.api, "A Müşteri");
    const inv = await sale(ctx.api, acc, { qty: 3, price: 1000, cash: nakit(2000) });
    await giveBack(ctx.api, acc, inv, 1);
    await must("kart tahsilatı", ctx.api.post(`/api/workspace/plans/${inv.planId}/entries`, { kind: "in", amount: "1500", method: "cash", date: RET_DAY }));
    await giveBack(ctx.api, acc, inv, 1, nakit(300));
    await expectCard(ctx, acc, inv, { left: 0, balance: -2200, total: 0 }, "A");
  }));

  test("D (G1 korunur): peşinsiz 1.000 taksit → 400 iade + 400 nakit geri → kart 1.000 kalır", () => scenario(async ctx => {
    const acc = await customer(ctx.api, "D Müşteri");
    const inv = await sale(ctx.api, acc);
    await giveBack(ctx.api, acc, inv, 4, nakit(400));
    await expectCard(ctx, acc, inv, { left: 1000, balance: 1000, open: 600 }, "D");
  }));

  test("E (korunur): 1.000 (500 peşin) → 300 iade + 300 nakit geri → kart 500 kalır", () => scenario(async ctx => {
    const acc = await customer(ctx.api, "E Müşteri");
    const inv = await sale(ctx.api, acc, { cash: nakit(500) });
    await giveBack(ctx.api, acc, inv, 3, nakit(300));
    await expectCard(ctx, acc, inv, { left: 500, balance: 500, open: 200 }, "E");
  }));

  test("F: peşin çekle (500) alınmış; malın tamamı iade + 500 nakit geri → kart 0", () => scenario(async ctx => {
    const acc = await customer(ctx.api, "F Müşteri");
    const inv = await sale(ctx.api, acc, { cheques: [{ instrument: "cheque", amount: 500, dueDate: "2026-12-01", serialNo: "CK-210-F", bank: "Ziraat" }] });
    await giveBack(ctx.api, acc, inv, 10, nakit(500));
    // Alacak Yaşlandırma portföydeki çeki de alacak sayar (vadesi 01.12.2026): 500; kart 0.
    await expectCard(ctx, acc, inv, { left: 0, balance: 0, cheques: 500 }, "F");
  }));

  test("G: peşin banka hesabına havale; tam iade + aynı hesaptan havale geri → kart 0, hesap bakiyesi eski hâline döner", async () => {
    const ctx = await fresh();
    try {
      const { ziraat, garanti } = await openAcceptanceAccounts(ctx.api);
      const acc = await customer(ctx.api, "G Müşteri");
      const before = (await must("hesap", ctx.api.get(`/api/workspace/bank/accounts/${garanti.id}`))).balanceMinor;
      const inv = await sale(ctx.api, acc, { cash: [{ amount: 500, method: "bank", bankAccountId: garanti.id, lineKey: "g1" }], date: "2026-10-02", firstDue: "2026-10-05" });
      assert.equal((await must("hesap", ctx.api.get(`/api/workspace/bank/accounts/${garanti.id}`))).balanceMinor, before + 50000, "peşin hesaba girdi");
      await giveBack(ctx.api, acc, inv, 10, [{ amount: 500, method: "bank", bankAccountId: garanti.id, lineKey: "g2" }]);
      assert.equal((await must("hesap", ctx.api.get(`/api/workspace/bank/accounts/${garanti.id}`))).balanceMinor, before, "geri ödeme hesaptan çıktı");
      assert.ok(ziraat.id);
      await expectCard(ctx, acc, inv, { left: 0, balance: 0 }, "G");
    } finally {
      await ctx.server.close();
    }
  });

  test("H: iki iade arka arkaya (500 + 250 nakit geri, 500 + 250 nakit geri) → önce 250, sonra 0", () => scenario(async ctx => {
    const acc = await customer(ctx.api, "H Müşteri");
    const inv = await sale(ctx.api, acc, { cash: nakit(500) });
    await giveBack(ctx.api, acc, inv, 5, nakit(250));
    await expectCard(ctx, acc, inv, { left: 250, balance: 250 }, "H iade-1");
    await giveBack(ctx.api, acc, inv, 5, nakit(250));
    await expectCard(ctx, acc, inv, { left: 0, balance: 0 }, "H iade-2");
  }));

  test("H2: önce açık iade (500) sonra paralı iade (500 + 500 nakit geri) → kart 0", () => scenario(async ctx => {
    const acc = await customer(ctx.api, "H2 Müşteri");
    const inv = await sale(ctx.api, acc, { cash: nakit(500) });
    await giveBack(ctx.api, acc, inv, 5);
    await expectCard(ctx, acc, inv, { left: 0, balance: 0 }, "H2 iade-1");
    await giveBack(ctx.api, acc, inv, 5, nakit(500));
    await expectCard(ctx, acc, inv, { left: 0, balance: 0 }, "H2 iade-2");
  }));

  test("I: iade iptal edilince kart 500'e döner; yeniden kesilince 0; iade silinince yine 500", () => scenario(async ctx => {
    const acc = await customer(ctx.api, "I Müşteri");
    const inv = await sale(ctx.api, acc, { cash: nakit(500) });
    const ret = await giveBack(ctx.api, acc, inv, 10, nakit(500));
    await expectCard(ctx, acc, inv, { left: 0, balance: 0 }, "I iade");
    await must("iade iptali", ctx.api.post(`/api/workspace/invoices/${ret.id}/cancel`, {}));
    await expectCard(ctx, acc, inv, { left: 500, balance: 500, open: 500 }, "I iptal");
    const again = await giveBack(ctx.api, acc, inv, 10, nakit(500));
    await expectCard(ctx, acc, inv, { left: 0, balance: 0 }, "I yeniden");
    await must("iade sil", ctx.api.del(`/api/workspace/invoices/${again.id}`));
    await expectCard(ctx, acc, inv, { left: 500, balance: 500, open: 500 }, "I sil");
  }));

  test("J: kısmi tahsilatlı kart (400 peşin, 600 taksit, 300 tahsil) → tam iade + 700 nakit geri → kart 0", () => scenario(async ctx => {
    const acc = await customer(ctx.api, "J Müşteri");
    const inv = await sale(ctx.api, acc, { cash: nakit(400), count: 2 });
    await must("kart tahsilatı", ctx.api.post(`/api/workspace/plans/${inv.planId}/entries`, { kind: "in", amount: "300", method: "cash", date: RET_DAY }));
    await expectCard(ctx, acc, inv, { left: 300, balance: 300, open: 300 }, "J tahsilat");
    await giveBack(ctx.api, acc, inv, 10, nakit(700));
    await expectCard(ctx, acc, inv, { left: 0, balance: 0 }, "J iade");
  }));

  test("Mutabakat Testi her senaryodan sonra tutarlı (C + B + A aynı şirkette)", () => scenario(async ctx => {
    const c = await customer(ctx.api, "M C");
    const ci = await sale(ctx.api, c, { cash: nakit(500) });
    await giveBack(ctx.api, c, ci, 10, nakit(500));
    const b = await customer(ctx.api, "M B");
    const bi = await sale(ctx.api, b, { cash: nakit(500), date: "2026-08-04" });
    await giveBack(ctx.api, b, bi, 6);
    await giveBack(ctx.api, b, bi, 4, nakit(400));
    const integrity = await must("Mutabakat Testi", ctx.api.get("/api/workspace/ledger/integrity"));
    assert.equal(integrity.ok, true, JSON.stringify(integrity.failures).slice(0, 600));
    ctx.server.clock.set(LATER);
    const late = await must("Geciken Taksitler", ctx.api.get("/api/workspace/report-center/geciken-taksitler"));
    assert.equal((late.rows || []).filter(row => JSON.stringify(row).includes("M ")).length, 0);
  }));
});
