// 2.5.1 D3 TUR 5 — K kuyruğunda payı SIFIRA inmiş belgeye ≤K BAĞLI tahsilat (tur 4 raporu DOĞRULANMADI-3). S-T2-1 = B (KULLANICI 27.11.2026 14:18 UTC, AYNEN: "önerilerini uygula açık
// sorulara"): K sonrası Mahsup Et'in ≤K belgesi K kuyruğunda o mahsuba AYRILIR — DEVİRLİ = DEVİRSİZ. Ayırım belgeyi K kuyruğunda 0'a indirince aynı belgeye ≤K tarihli BAĞLI tahsilatın hedefi
// kuyrukta kalmaz; devirsiz programda da belge 0. adımda (Mahsup Et — tarihten bağımsız) kapandığı için bağın fazlası aynı kuralla (karar (2) = A: hedefi kapanmışsa bağın kapatamadığı kısmı
// bağsız gibi) dağılır. Bu test planın da AYNI sonucu verdiğini sınar. Veri programın KENDİ API'sinden; beklenen sayılar ELLE. D3 HİÇBİR ŞEY YAZMAZ. K = 31.12.2026.
// Sıra (kilitsiz dönemde; Dönem Kilidi K en sonda — S24 = A): ≤K satışlar → Ocak alışları → Ocak Mahsup Et'leri → GERİYE TARİHLİ (Aralık) bağlı tahsilatlar → kilit K.
//   Z1 (pay 0'a iner): Aralık satış 400 (vade 20.12); Ocak alış 400 (10.01); 12.01 Mahsup Et alış ↔ satış 400; 15.12 tahsilat 100 satışa BAĞLI. Devirsiz: satış mahsupla kapalı, bağın 100'ü
//        bağsız → açık borç yok → avans 100; bakiye −100; gecikmiş 0. Plan: satışın 400'ü ayrılır (açık kalem 400, vade 20.12); K bakiyesi 300; net −100 (avans net satırda — EK-1 M2 A).
//   Z2 (pay 0'a inmez): Aralık satış 400 (vade 20.12); Ocak alış 250; Mahsup Et 250; 15.12 tahsilat 200 satışa BAĞLI. Devirsiz: satış 250 mahsup + 150 bağ ile kapalı, bağın 50'si bağsız →
//        avans 50; bakiye −50. Plan: 250 ayrılır (açık kalem 250), K'de bağ kalan 150'yi kapatır, 50 avans; K bakiyesi 200; net −50.
//   Z3 (pay 0 + başka açık borç): Z1'in aynısı + Kasım satış 300 (vade 30.11): bağın kapatamadığı 100 bağsız → Kasım satışını 200'e indirir. Devirsiz: Kasım 200 açık (gecikmiş 200).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";

const planModule = await import("../server/lib/devir/plan.mjs").catch(() => null);
const fixture = await import("./fixtures/devir-d3-esdeger.mjs");
const K = "2026-12-31";
const pay = { cash: [], cheques: [], endorse: [], rest: "open" };
const line = price => [{ name: "Hizmet", qty: 1, unitPrice: price, discountRate: 0, vatRate: 0 }];

async function waitPreview(api, body) {
  const started = await must("ön izleme", api.post("/api/admin/devir/preview", body));
  for (let i = 0; i < 600; i += 1) {
    const job = await must("ön izleme durumu", api.get(`/api/admin/devir/preview/${started.id}`));
    if (job.state !== "running") return job;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("ön izleme bitmedi");
}

describe("D3 tur 5 — K kuyruğunda payı sıfıra inmiş belgeye ≤K bağlı tahsilat (devirli = devirsiz)", () => {
  let ctx;
  let api;
  let job;
  const ids = {};
  const sale = async (label, account, issueDate, price, dueDate) => (await must(label, api.post("/api/workspace/invoices", { kind: "sale", accountId: account, issueDate, lines: line(price), payment: { ...pay, dueDate }, force: true }))).id;
  const purchase = async (label, account, number, issueDate, price) => (await must(label, api.post("/api/workspace/invoices", { kind: "purchase", accountId: account, number, issueDate, lines: line(price), payment: pay, force: true }))).id;
  before(async () => {
    ctx = await boot({ now: { time: "2027-01-20T10:00:00+03:00", fixed: true } });
    api = ctx.api;
    for (const key of ["z1", "z2", "z3"]) ids[key] = (await must(key, api.post("/api/workspace/accounts", { name: `Sıfır Pay ${key.toUpperCase()}`, type: "other" }))).id;
    ids.z3k = await sale("Z3 Kasım", ids.z3, "2026-11-02", 300, "2026-11-30");
    ids.z1s = await sale("Z1 satış", ids.z1, "2026-12-02", 400, "2026-12-20");
    ids.z2s = await sale("Z2 satış", ids.z2, "2026-12-02", 400, "2026-12-20");
    ids.z3s = await sale("Z3 satış", ids.z3, "2026-12-02", 400, "2026-12-20");
    ids.z1a = await purchase("Z1 Ocak alış", ids.z1, "AL-Z1", "2027-01-10", 400);
    ids.z2a = await purchase("Z2 Ocak alış", ids.z2, "AL-Z2", "2027-01-10", 250);
    ids.z3a = await purchase("Z3 Ocak alış", ids.z3, "AL-Z3", "2027-01-10", 400);
    for (const [key, amount] of [["z1", 400], ["z2", 250], ["z3", 400]]) await must(`${key} mahsup`, api.post(`/api/workspace/invoices/${ids[`${key}a`]}/offsets`, { counterType: "invoice", counterId: ids[`${key}s`], amount: String(amount), date: "2027-01-12" }));
    // Geriye tarihli (Aralık) BAĞLI tahsilatlar — mahsuptan SONRA girildi (kilitsiz dönem).
    for (const [key, amount] of [["z1", 100], ["z2", 200], ["z3", 100]]) ids[`${key}t`] = (await must(`${key} bağlı tahsilat`, api.post(`/api/workspace/accounts/${ids[key]}/entries`, { kind: "in", amount: String(amount), date: "2026-12-15", note: "Bağlı", invoiceId: ids[`${key}s`] }))).entryId;
    ctx.server.clock.set("2027-01-20T11:00:00+03:00");
    await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: K }));
    await ctx.app.ledger.snapshots.runPending();
    job = planModule ? await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" }) : null;
  });
  after(() => ctx?.server.close());

  const rowOf = key => job.result.plan.newYear.cariler.find(row => row.cari === ids[key]);
  const openOf = key => rowOf(key).satirlar.filter(row => row.tur === "acik-kalem").map(row => [Object.entries(ids).find(([, v]) => v === row.belge.faturaId)?.[0], row.yon, row.tutarMinor, row.vade]);

  it("veri tabanı (ders 3): bağlı tahsilatlar ≤K tarihli ve satışa bağlı; mahsuplar yerinde", () => {
    for (const key of ["z1", "z2", "z3"]) {
      const row = ctx.store.get("SELECT date, invoice_id AS inv FROM account_entries WHERE id = ?", ids[`${key}t`]);
      assert.deepEqual([row.date, row.inv], ["2026-12-15", ids[`${key}s`]], key);
      assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM invoice_offsets WHERE account_id = ?", ids[key]).n, 1);
    }
  });

  it("plan (elle): ayrılan pay açık kalemde; bağın kapatamadığı kısım bağsız (avans net satırda ya da başka borcu kapatır); K bakiyesi değişmez", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    assert.equal(job.state, "done", JSON.stringify(job.error));
    assert.deepEqual(openOf("z1"), [["z1s", "debt", 40000, "2026-12-20"]]);
    assert.deepEqual(openOf("z2"), [["z2s", "debt", 25000, "2026-12-20"]]);
    assert.deepEqual(openOf("z3"), [["z3k", "debt", 20000, "2026-11-30"], ["z3s", "debt", 40000, "2026-12-20"]]);
    assert.deepEqual(["z1", "z2", "z3"].map(key => [rowOf(key).kBakiyeMinor, rowOf(key).netMinor]), [[30000, -10000], [20000, -5000], [60000, 0]]);
    assert.deepEqual(job.result.plan.newYear.mahsupAyirmalari.map(row => [Object.entries(ids).find(([, v]) => v === row.cari)?.[0], row.tur, row.tutarMinor]).sort(), [["z1", "yeni-yila-ayrildi", 40000], ["z2", "yeni-yila-ayrildi", 25000], ["z3", "yeni-yila-ayrildi", 40000]]);
    assert.deepEqual(job.result.plan.sorunlar, []);
  });

  it("DEVİRSİZ EŞDEĞER: gecikmiş, açık kalemler, en eski vade her gün AYNI; Z1 / Z2 gecikmiş 0, Z3 200", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const eq = fixture.createEquivalence(ctx.store);
    const days = ["2027-01-01", "2027-01-11", "2027-01-13", "2027-02-01", "2027-03-01"];
    for (const key of ["z1", "z2", "z3"]) {
      for (const out of eq.compare(ids[key], rowOf(key), K, days, { redirect: true })) {
        assert.equal(out.devirli, out.devirsiz, `${key} ${out.day} gecikmiş`);
        assert.deepEqual(out.kalemDevirli, out.kalemDevirsiz, `${key} ${out.day} açık kalemler`);
        assert.equal(out.sinceDevirli, out.sinceDevirsiz, `${key} ${out.day} en eski vade`);
      }
    }
    const at = key => eq.compare(ids[key], rowOf(key), K, ["2027-01-13"], { redirect: true })[0];
    assert.deepEqual([at("z1").devirsiz, at("z2").devirsiz, at("z3").devirsiz], [0, 0, 20000]);
    const closers = eq.devirsiz(ids.z1, "2027-01-13").invoices.get(ids.z1s).closers.map(closer => [closer.mode, Math.round(closer.amount * 100)]);
    assert.deepEqual(closers, [["offset", 40000]], "devirsizde Z1 yalnız mahsupla kapalı (bağın payı 0)");
  });
});
