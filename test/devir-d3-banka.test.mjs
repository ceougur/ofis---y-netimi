// 2.5.1 D3 TUR 2 — ALT HESAPLI ÖBÜR HESAPLAR: banka (102.NN), POS alacağı (108.NN), kredi kartı (309.NN), banka kredisi (300.NN) — tasarım §3.7 / §3.8 "Banka / POS", tur 1 nasıl
// bozulur 5 / 35 (tur 1'de yalnız 102.01 elle). Veri programın KENDİ API'sinden, beklenen sayılar ELLE. Değişmez: her alt hesapta arşiv kapanışı = yeni yıl açılışı (modül farkı YOK).
// K = 31.12.2026, bugün 10.02.2027. Hesaplar 01.01.2026 açılışlı, açılış tutarı 0.
//   Z (Vadesiz): 10.11 M'den havale 3.000 · 20.11 T'ye EFT 1.500 · 01.12 G'ye virman 1.000 · 01.12 POS tahsilatı 400 (%2,5 komisyon 10,00; valör 2 iş günü → 03.12, net 390 Z'ye)
//                · 20.12 kredi kartı borcu ödemesi 500 (Z → C) · 05.01.2027 M'den havale 600 (K'den sonra).
//                ELLE K: 3.000 − 1.500 − 1.000 + 390 − 500 = 390,00.
//   G (Vadesiz): 01.12 virman +1.000 · 10.12 kredi kullanımı +10.000 (L) → 11.000,00.
//   P (POS, Z'ye bağlı): 30.12 POS tahsilatı 800 (valör 2 iş günü → K'den SONRA; komisyon %2,5 = 20,00 tahsilat günü gider — 01.12'deki gibi) → 108 bekleyen 780,00.
//   (Tasarım §3.3 POS sayısını "brüt" diye tanımlar; planın sayısı defterin 108 bakiyesi = net — raporda SONRAKİ SÜRÜME.)
//   C (Kredi Kartı): 05.12 T'ye kartla ödeme 700 · 20.12 karttan ödeme 500 → −200,00 (309 alacak bakiyeli).
//   L (Kredi): 10.12 kullanım 10.000 → −10.000,00 (300).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";

const planModule = await import("../server/lib/devir/plan.mjs").catch(() => null);
const K = "2026-12-31";
const pay = { cash: [], cheques: [], endorse: [], rest: "open" };

async function waitPreview(api, body) {
  const started = await must("ön izleme", api.post("/api/admin/devir/preview", body));
  for (let i = 0; i < 600; i += 1) {
    const job = await must("ön izleme durumu", api.get(`/api/admin/devir/preview/${started.id}`));
    if (job.state !== "running") return job;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("ön izleme bitmedi");
}

describe("D3 tur 2 — banka, POS, kredi kartı, kredi alt hesapları: K bakiyesi = açılış", () => {
  let ctx;
  let api;
  let job;
  const ids = {};
  before(async () => {
    ctx = await boot({ now: { time: "2027-02-10T12:00:00+03:00", fixed: true } });
    api = ctx.api;
    const opening = { date: "2026-01-01", amount: "0", confirmed: true };
    ids.z = (await must("Z", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ziraat Vadesiz", kind: "demand", currency: "TRY", usePos: true, opening }))).id;
    ids.g = (await must("G", api.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Garanti Vadesiz", kind: "demand", currency: "TRY", opening }))).id;
    ids.c = (await must("C", api.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Şirket Kartı", kind: "card", creditLimit: "50.000", opening }))).id;
    ids.l = (await must("L", api.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Ticari Kredi", kind: "loan", currency: "TRY", opening }))).id;
    ids.p = (await must("P", api.post("/api/workspace/bank/pos", { name: "Mağaza POS", bankAccountId: ids.z, kind: "physical", providerKind: "bank", tax: "bsmv_incl", valorRule: "business", valorDays: 2, installmentPayout: "monthly", provisionDays: 0, refundCommission: "none", validFrom: "2026-01-01", rates: [{ installments: 1, rate: "2,5" }] })));
    ids.p = ctx.store.get("SELECT id FROM pos_terminals WHERE name = 'Mağaza POS'").id;
    ids.m = (await must("M", api.post("/api/workspace/accounts", { name: "Banka Müşterisi", type: "customer" }))).id;
    ids.t = (await must("T", api.post("/api/workspace/accounts", { name: "Banka Tedarikçisi", type: "supplier" }))).id;
    const line = price => [{ name: "Hizmet", qty: 1, unitPrice: price, discountRate: 0, vatRate: 0 }];
    await must("M satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: ids.m, issueDate: "2026-11-01", lines: line(6000), payment: pay, force: true }));
    await must("T alış", api.post("/api/workspace/invoices", { kind: "purchase", accountId: ids.t, number: "AL-T1", issueDate: "2026-11-05", lines: line(3000), payment: pay, force: true }));
    const entry = (label, account, body) => must(label, api.post(`/api/workspace/accounts/${account}/entries`, body));
    await entry("havale", ids.m, { kind: "in", amount: "3000", date: "2026-11-10", note: "Havale", method: "bank", bankAccountId: ids.z });
    await entry("EFT", ids.t, { kind: "out", amount: "1500", date: "2026-11-20", note: "EFT", method: "bank", bankAccountId: ids.z });
    await must("virman", api.post("/api/workspace/bank/transfers", { accountId: ids.z, toAccountId: ids.g, amount: "1000", date: "2026-12-01", channel: "virman", description: "Virman" }));
    await entry("POS 1", ids.m, { kind: "in", amount: "400", date: "2026-12-01", note: "POS", method: "card", posId: ids.p, posInstallments: 1 });
    await entry("kartla ödeme", ids.t, { kind: "out", amount: "700", date: "2026-12-05", note: "Kart", method: "card", bankAccountId: ids.c });
    await must("kredi", api.post("/api/workspace/bank/vouchers", { type: "loan_draw", accountId: ids.g, loanAccountId: ids.l, amount: "10000", date: "2026-12-10" }));
    await must("kart ödemesi", api.post("/api/workspace/bank/vouchers", { type: "card_payment", accountId: ids.z, cardAccountId: ids.c, amount: "500", date: "2026-12-20" }));
    await entry("POS 2", ids.m, { kind: "in", amount: "800", date: "2026-12-30", note: "POS", method: "card", posId: ids.p, posInstallments: 1 });
    await entry("havale K+", ids.m, { kind: "in", amount: "600", date: "2027-01-05", note: "Havale", method: "bank", bankAccountId: ids.z });
    job = planModule ? await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" }) : null;
  });
  after(() => ctx?.server.close());

  const subOf = (key, table = "bank_accounts") => ctx.store.get(`SELECT gl_sub AS sub FROM ${table} WHERE id = ?`, ids[key]).sub;

  it("her alt hesap K bakiyesiyle (elle): Z 390,00 · G 11.000,00 · POS 780,00 (bekleyen; komisyon tahsilat günü gider) · kart −200,00 · kredi −10.000,00; sahibi (banka hesabı / POS) belli", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    assert.equal(job.state, "done", JSON.stringify(job.error));
    const got = job.result.plan.newYear.banka.map(row => [row.hesap, row.alt, row.minor, row.bankaHesabi, row.posTerminali ?? "(alan yok)", row.tur, row.atanmamis, row.ad]);
    const want = [
      ["102", subOf("z"), 39000, ids.z, "", "demand", false, "Ziraat Vadesiz"],
      ["102", subOf("g"), 1100000, ids.g, "", "demand", false, "Garanti Vadesiz"],
      ["108", subOf("p", "pos_terminals"), 78000, "", ids.p, "pos", false, "Mağaza POS"],
      ["300", subOf("l"), -1000000, ids.l, "", "loan", false, "Ticari Kredi"],
      ["309", subOf("c"), -20000, ids.c, "", "card", false, "Şirket Kartı"],
    ];
    assert.deepEqual(got.sort(), want.sort());
  });

  it("kapanış = açılış: her alt hesapta arşiv K bakiyesi = yeni yıl açılışı; K sonrası havale K'ye girmez; modül farkı YOK; sayılar (2 hesap, 11.390,00, kart −200,00, kredi −10.000,00, POS 780,00)", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const cells = job.result.plan.archive.kapanisBakiyeleri.filter(row => ["102", "108", "300", "309"].includes(row.hesap)).map(row => [row.hesap, row.alt, row.minor]).sort();
    assert.deepEqual(cells, job.result.plan.newYear.banka.map(row => [row.hesap, row.alt, row.minor]).sort());
    assert.deepEqual(job.result.plan.sorunlar, []);
    assert.deepEqual(job.result.plan.degismezler.filter(row => !row.ok), []);
    assert.deepEqual(job.result.plan.sayilar.banka, { hesap: 2, minor: 1139000, kart: -20000, kredi: -1000000, posBekleyenMinor: 78000 });
  });
});
