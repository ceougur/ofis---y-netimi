// 2.5.1 D3 TUR 5 — muhasebe kâhini devir bakımı 2'nin iki okumasının programdaki karşılığı (BAŞ MİMAR KARARI 27.11; kullanıcıya gösterildi):
// (a) "K sonrası mahsup KENDİ GÜNÜNDEN itibaren etkili — kararın örneğinde (Aralık satışı 400 + alış 150; 17.01'de Ocak satışı Aralık alışıyla 150 mahsup) 01.01–16.01 tarihli görünümde gecikmiş
//     250, 17.01 ve sonrasında 400 — DEVİRSİZ program da bu tarihlerde aynı sayıyı veriyorsa plan da öyle vermeli (devirli = devirsiz, TARİH TARİH); devirsiz programın bu tarihlerde farklı sayı
//     verdiğini görürsen KODLAMA, raporda 'KULLANICIYA SORULMALI' (ders 43)."
// (b) "Bakiyesi 0 caride S-T2-1 ayırmasıyla iki yönlü açık kalem oluşursa (örnek: Kasım satışı 400, Aralık'ta 400 tahsilat; Ocak alışı 150 ile Kasım satışı mahsup → K'de satış 150 borç kalemi +
//     150 avans, bakiye 0) iki kalem devir satırı olmadan yeni yıla taşınır (kullanıcı 27.11 15:21 yanıtı: net bakiyesi 0 carinin açık kalemleri taşınır)."
// Veri programın KENDİ API'sinden; beklenen sayılar ELLE. D3 HİÇBİR ŞEY YAZMAZ. K = 31.12.2026.
// (a) GERÇEK ZAMAN ÇİZGİSİ: sahte saat her gün o güne ilerler, kayıt o gün girilir (programda İLERİ TARİHLİ hareket girilemez — date-future; gecikmiş her zaman "bugün"e göre). Her gün:
//     devirsiz program (API'nin cari kartı: Gecikmiş Borç) = o gün hazırlanan ön izlemenin devirli eşdeğeri = elle: 01.01 250 · 16.01 250 · 17.01 400 · 29.01 400 · 01.02 550.
//     GERİYE DÖNÜK GÖRÜNÜM (bütün veri girildikten sonra geçmiş bir günün gecikmişi — programın EKRANINDA yok; yalnız tek borç sırasının görünüm günü parametresi): Mahsup Et tarihten bağımsız
//     0. adımda (karar (2) = A) → devirsiz = devirli = 400 · 400 · 400 · 400 · 550 (kâhinin "250" okuması bu görünümde ayrışır — raporda).
// (b) Program Mahsup Et'e ancak satışın açık tutarı kadar izin verir: doğal sırada (Aralık tahsilatı önce) Ocak'ta Kasım satışı kapalıdır → 409. Örnek ancak GERİYE TARİHLİ girişle (önce Ocak
//     alışı + mahsup, sonra Aralık tahsilatı, kilitsiz dönemde) oluşur; plan: Kasım satışının 150'si ayrılır (açık kalem 150, vade 30.11), Aralık tahsilatının kalan 150'si AVANS — EK-1 M2 A gereği
//     net satırda (Sadece Bakiyeyi Aktar: "Devir Bakiyesi" alacak 150; Borç ve Alacakları Aktar: Borç Toplamı 250 + Alacak Toplamı 400). Bakiye 0; satırlar yazılır (M12 "bakiye 0 → satır yok"
//     açık kalem varken uygulanmaz); devirli = devirsiz.
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
const DAYS = ["2027-01-01", "2027-01-16", "2027-01-17", "2027-01-29", "2027-02-01"];

describe("D3 tur 5 — kâhin okuması (a): K sonrası mahsup kendi gününden itibaren — tarih tarih devirli = devirsiz", () => {
  let ctx;
  let api;
  const ids = {};
  const seen = {};
  before(async () => {
    ctx = await boot({ now: { time: "2026-12-02T10:00:00+03:00", fixed: true } });
    api = ctx.api;
    ids.t1 = (await must("cari", api.post("/api/workspace/accounts", { name: "Tarih Tarih", type: "other" }))).id;
    ids.s = (await must("Aralık satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: ids.t1, issueDate: "2026-12-02", lines: line(400), payment: { ...pay, dueDate: "2026-12-20" }, force: true }))).id;
    ctx.server.clock.set("2026-12-03T10:00:00+03:00");
    ids.a = (await must("Aralık alış", api.post("/api/workspace/invoices", { kind: "purchase", accountId: ids.t1, number: "AL-T1", issueDate: "2026-12-03", lines: line(150), payment: pay, force: true }))).id;
    ctx.server.clock.set("2027-01-01T03:30:00+03:00");
    await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: K }));
    await ctx.app.ledger.snapshots.runPending();
    for (const day of DAYS) {
      ctx.server.clock.set(`${day}T12:00:00+03:00`);
      if (day === "2027-01-16") ids.j = (await must("Ocak satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: ids.t1, issueDate: "2027-01-16", lines: line(300), payment: { ...pay, dueDate: "2027-01-30" }, force: true }))).id;
      if (day === "2027-01-17") await must("Mahsup Et (17.01)", api.post(`/api/workspace/invoices/${ids.j}/offsets`, { counterType: "invoice", counterId: ids.a, amount: "150", date: "2027-01-17" }));
      const api0 = (await must("cari kartı", api.get(`/api/workspace/accounts/${ids.t1}`))).totals;
      const job = planModule ? await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" }) : null;
      const row = job?.result?.plan?.newYear?.cariler?.find(item => item.cari === ids.t1);
      const out = row ? fixture.createEquivalence(ctx.store).compare(ids.t1, row, K, [day], { redirect: true })[0] : null;
      seen[day] = { program: Math.round(api0.overdueDebt * 100), bakiye: Math.round(api0.balance * 100), out, row, ayirim: job?.result?.plan?.newYear?.mahsupAyirmalari || null };
    }
  });
  after(() => ctx?.server.close());

  it("devirsiz PROGRAM (cari kartının Gecikmiş Borç'u, o günün verisiyle) — elle: 250 · 250 · 400 · 400 · 550 (kâhinin (a) okumasıyla aynı)", () => {
    assert.deepEqual(DAYS.map(day => seen[day].program), [25000, 25000, 40000, 40000, 55000]);
    assert.deepEqual(DAYS.map(day => seen[day].bakiye), [25000, 55000, 55000, 55000, 55000]);
  });

  it("o gün hazırlanan ön izlemenin DEVİRLİ eşdeğeri = devirsiz program, TARİH TARİH; mahsuptan önce ayırım YOK (alış satışı netler), mahsuptan sonra alış 150 ayrılır", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    for (const day of DAYS) {
      assert.equal(seen[day].out.devirli, seen[day].program, `${day} devirli = devirsiz program`);
      assert.equal(seen[day].out.devirsiz, seen[day].program, `${day} kuyruk = cari kartı`);
    }
    const open = day => seen[day].row.satirlar.filter(item => item.tur === "acik-kalem").map(item => [item.yon, item.tutarMinor, item.vade]);
    assert.deepEqual(open("2027-01-01"), [["debt", 25000, "2026-12-20"]]);
    assert.deepEqual(open("2027-01-16"), [["debt", 25000, "2026-12-20"]]);
    assert.deepEqual(open("2027-01-17"), [["credit", 15000, "2026-12-03"], ["debt", 40000, "2026-12-20"]]);
    assert.deepEqual(DAYS.map(day => seen[day].ayirim.map(item => [item.tur, item.tutarMinor])), [[], [], [["yeni-yila-ayrildi", 15000]], [["yeni-yila-ayrildi", 15000]], [["yeni-yila-ayrildi", 15000]]]);
    assert.ok(DAYS.every(day => seen[day].row.kBakiyeMinor === 25000), "K bakiyesi her gün 250");
  });

  it("GERİYE DÖNÜK görünüm (bütün veriyle, geçmiş günün gecikmişi): Mahsup Et tarihten bağımsız 0. adım → devirsiz = devirli = 400 · 400 · 400 · 400 · 550; programda ileri tarihli Mahsup Et girilemez", async () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const eq = fixture.createEquivalence(ctx.store);
    const outs = eq.compare(ids.t1, seen["2027-02-01"].row, K, DAYS, { redirect: true });
    assert.deepEqual(outs.map(out => [out.devirsiz, out.devirli]), [[40000, 40000], [40000, 40000], [40000, 40000], [40000, 40000], [55000, 55000]]);
    const future = await api.post(`/api/workspace/invoices/${ids.j}/offsets`, { counterType: "invoice", counterId: ids.a, amount: "1", date: "2027-02-02" });
    assert.deepEqual([future.status, future.code], [400, "date-future"], JSON.stringify(future.data));
  });
});

describe("D3 tur 5 — kâhin okuması (b): bakiyesi 0 caride S-T2-1 ayırmasıyla iki yönlü kalem", () => {
  let ctx;
  let api;
  let job;
  let other;
  const ids = {};
  let refused;
  before(async () => {
    ctx = await boot({ now: { time: "2027-01-20T10:00:00+03:00", fixed: true } });
    api = ctx.api;
    ids.z = (await must("cari", api.post("/api/workspace/accounts", { name: "Sıfır Bakiye", type: "other" }))).id;
    ids.n = (await must("cari (doğal sıra)", api.post("/api/workspace/accounts", { name: "Doğal Sıra", type: "other" }))).id;
    ids.zs = (await must("Kasım satış", api.post("/api/workspace/invoices", { kind: "sale", accountId: ids.z, issueDate: "2026-11-02", lines: line(400), payment: { ...pay, dueDate: "2026-11-30" }, force: true }))).id;
    ids.ns = (await must("Kasım satış (doğal)", api.post("/api/workspace/invoices", { kind: "sale", accountId: ids.n, issueDate: "2026-11-02", lines: line(400), payment: { ...pay, dueDate: "2026-11-30" }, force: true }))).id;
    // Doğal sıra: önce Aralık tahsilatı (Kasım satışını kapatır), sonra Ocak alışı + Mahsup Et → program reddeder (satışın açık tutarı 0).
    await must("Aralık tahsilat (doğal)", api.post(`/api/workspace/accounts/${ids.n}/entries`, { kind: "in", amount: "400", date: "2026-12-10", note: "Tahsilat" }));
    ids.na = (await must("Ocak alış (doğal)", api.post("/api/workspace/invoices", { kind: "purchase", accountId: ids.n, number: "AL-N", issueDate: "2027-01-10", lines: line(150), payment: pay, force: true }))).id;
    refused = await api.post(`/api/workspace/invoices/${ids.na}/offsets`, { counterType: "invoice", counterId: ids.ns, amount: "150", date: "2027-01-12" });
    // Geriye tarihli sıra (kilitsiz): Ocak alışı + Mahsup Et ÖNCE, Aralık tahsilatı SONRA.
    ids.za = (await must("Ocak alış", api.post("/api/workspace/invoices", { kind: "purchase", accountId: ids.z, number: "AL-Z", issueDate: "2027-01-10", lines: line(150), payment: pay, force: true }))).id;
    await must("Mahsup Et", api.post(`/api/workspace/invoices/${ids.za}/offsets`, { counterType: "invoice", counterId: ids.zs, amount: "150", date: "2027-01-12" }));
    await must("Aralık tahsilat (geriye tarihli)", api.post(`/api/workspace/accounts/${ids.z}/entries`, { kind: "in", amount: "400", date: "2026-12-10", note: "Tahsilat" }));
    ctx.server.clock.set("2027-01-20T11:00:00+03:00");
    await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: K }));
    await ctx.app.ledger.snapshots.runPending();
    job = planModule ? await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" }) : null;
    other = planModule ? await waitPreview(api, { company: "sirket-001", cutoff: K, option: "sadece-bakiye" }) : null;
  });
  after(() => ctx?.server.close());

  it("doğal sırada program Mahsup Et'i REDDEDER (409, satışın açık tutarı 0,00 TL) — örnek yalnız geriye tarihli girişle oluşur", () => {
    assert.equal(refused.status, 409, JSON.stringify(refused.data));
    assert.match(String(refused.error || refused.data?.error || ""), /açık tutarını \(0,00 TL\) aşamaz|karşı yöndeki faturası olmalı/);
  });

  it("plan (elle): K bakiyesi 0; Kasım satışının 150'si ayrılır (açık kalem 150, vade 30.11); avans 150 net satırda (EK-1 M2 A); iki seçenekte satırlar", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    assert.equal(job.state, "done", JSON.stringify(job.error));
    const row = j => j.result.plan.newYear.cariler.find(item => item.cari === ids.z);
    assert.equal(row(job).kBakiyeMinor, 0);
    const lines = j => row(j).satirlar.map(item => [item.tur, item.yon, item.tutarMinor, item.vade || ""]);
    assert.deepEqual(lines(job), [["borc-toplami", "debt", 25000, ""], ["alacak-toplami", "credit", 40000, ""], ["acik-kalem", "debt", 15000, "2026-11-30"]]);
    assert.deepEqual(lines(other), [["devir-bakiyesi", "credit", 15000, ""], ["acik-kalem", "debt", 15000, "2026-11-30"]]);
    assert.deepEqual([row(job).netMinor, row(other).netMinor], [-15000, -15000]);
    assert.deepEqual(job.result.plan.newYear.mahsupAyirmalari.map(item => [item.tur, item.tutarMinor]), [["yeni-yila-ayrildi", 15000]]);
    assert.equal(row(job).satirlar.reduce((sum, item) => sum + (item.yon === "debt" ? item.tutarMinor : -item.tutarMinor), 0), 0, "satırların toplamı = K bakiyesi 0");
  });

  it("devirli = devirsiz (iki seçenek, her gün): gecikmiş 0, açık kalem yok; cari kartı bakiyesi −150 (avans)", async () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const eq = fixture.createEquivalence(ctx.store);
    for (const j of [job, other]) {
      const row = j.result.plan.newYear.cariler.find(item => item.cari === ids.z);
      for (const out of eq.compare(ids.z, row, K, ["2027-01-01", "2027-01-11", "2027-01-13", "2027-02-01"], { redirect: true })) {
        assert.equal(out.devirli, out.devirsiz, `${out.day} gecikmiş`);
        assert.deepEqual(out.kalemDevirli, out.kalemDevirsiz, `${out.day} açık kalemler`);
        assert.equal(out.devirsiz, 0);
      }
    }
    const card = await must("cari kartı", api.get(`/api/workspace/accounts/${ids.z}`));
    assert.equal(Math.round(card.totals.balance * 100), -15000);
  });
});
