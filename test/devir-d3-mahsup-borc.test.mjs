// 2.5.1 D3 TUR 5 — S-T2-1 = B'nin BORÇ YAZ karşısı (tur 4 raporu DOĞRULANMADI-1: tur 4 yalnız Alacak Yaz karşısını denedi). KULLANICI 27.11.2026 14:18 UTC (AYNEN: "önerilerini uygula
// açık sorulara") — S-T2-1 = B: "devirde, yeni yılda (K'den sonra) yapılan 'Mahsup Et'in karşı belgesi eski yıldaki (K ve öncesi) bir belgeyse devir planı o eski belgeyi K kuyruğunda o
// mahsuba AYIRIR — DEVİRLİ = DEVİRSİZ"; satış yönü, kısmi mahsup ve mahsubun sonradan silinmesi aynı kural. Alış faturasının Mahsup Et'i karşı belge olarak kapanmamış BORÇ YAZ satırını
// (müşterinin borcu) alır (routes/invoices.mjs offsetCandidates: alışta entryKind 'debt').
// Veri programın KENDİ API'sinden; beklenen sayılar ELLE (aşağıda). D3 HİÇBİR ŞEY YAZMAZ. K = 31.12.2026. Saat: ≤K veri 05.01.2027 10:00 → Dönem Kilidi K (11:00) → K sonrası veri
// 10.02.2027 12:00 (S24 = A).
//   B1 (b-1, b-7): Aralık Borç Yaz 300 (05.12, Vade Tarihi 25.12); Ocak alış 200 (10.01); 12.01 Mahsup Et alış ↔ Borç Yaz 200. Devirsiz: Borç Yaz 100 açık (vade 25.12; 01.01'den gecikmiş
//        100), alış kapalı. Devirli (B): K'de Borç Yaz'ın 200'ü ayrılır → açık kalem Borç Yaz 300 (vade 25.12; 100 K kuyruğundan + 200 ayrılan); yeni yılda mahsup devir kalemine → 100.
//   B2 (b-2, sıra): kilitten ÖNCE önce Ocak alış 150 (02.01), sonra GERİYE TARİHLİ Borç Yaz 150 (10.12), sonra Mahsup Et (03.01) 150. K: Borç Yaz 150 ayrılır (açık kalem 150, vade 10.12).
//        Devirsiz: ikisi kapalı, gecikmiş 0.
//   B3 (b-3, kısmi): Borç Yaz 300 (05.12, vadesiz); Ocak alış 500 (10.01); 12.01 Mahsup Et 120. K: Borç Yaz 300 açık kalem (180 + 120 ayrılan). Devirsiz: Borç Yaz 180'i alışın kalan 380'i
//        net görünümde netler (karar (5)) → bütün veri girildikten sonraki HER görünüm gününde gecikmiş 0 (kuyruk görünüm gününden bağımsız bütün satırlarla kurulur; ilk koşudaki "09.01 = 180"
//        beklentisi YANLIŞTI — gün dilimli sanılmıştı; devirli = devirsiz o koşuda da tuttu).
//   B4 (b-4, iki belge ≤K): Aralık satış S1 300 (vade 10.12), Borç Yaz 300 (05.12, Vade Tarihi 20.12), Aralık alış 200 (03.12); 15.01 Mahsup Et alış ↔ Borç Yaz 200. Devirsiz: S1 300,
//        Borç Yaz 100. Mahsupsuz K (tur 2 hâli): alış S1'i (vadesi önce) netlerdi → S1 100, Borç Yaz 300. B: mahsup K'de uygulanmış sayılır ("k-de-kapandi") → S1 300, Borç Yaz 100.
//   B5 (b-5, ana belge ≤K alış, karşı K sonrası Borç Yaz): Aralık alış 250 (03.12); Ocak Borç Yaz 100 (10.01); 12.01 Mahsup Et alış ↔ Borç Yaz 100. K: alış 250 açık ALACAK kalemi (100
//        ayrılmış); devirsiz: alış 150, Borç Yaz 0.
//   B6 (b-6, silinen): Aralık satış 400 (vade 20.12) + Borç Yaz 150 (05.12); Ocak alış 150 (16.01); 17.01 Mahsup Et alış ↔ Borç Yaz 150, sonra kaldırıldı → ayırım YOK; K: satış 400 + Borç Yaz 150.
//   B8 (b-8, K günü): B4'ün aynısı, mahsup 31.12 (≤K, olağan 0. adım) → ayırım YOK; K: S1 300, Borç Yaz 100.
//   002 şirketinde B1'in aynısı → 001'in planına girmez.
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

describe("D3 tur 5 — S-T2-1 = B: Borç Yaz karşısıyla K sonrası Mahsup Et (devirli = devirsiz)", () => {
  let ctx;
  let api;
  let job;
  let job002;
  let second;
  const ids = {};
  const q2 = () => `?hofCompany=${encodeURIComponent(second.id)}`;
  const sale = async (label, account, issueDate, price, dueDate, q = "") => must(label, api.post(`/api/workspace/invoices${q}`, { kind: "sale", accountId: account, issueDate, lines: line(price), payment: dueDate ? { ...pay, dueDate } : pay, force: true }));
  const purchase = async (label, account, number, issueDate, price, q = "") => must(label, api.post(`/api/workspace/invoices${q}`, { kind: "purchase", accountId: account, number, issueDate, lines: line(price), payment: pay, force: true }));
  const debt = async (label, account, amount, date, dueDate = "", q = "") => (await must(label, api.post(`/api/workspace/accounts/${account}/entries${q}`, { kind: "debt", amount: String(amount), date, note: "Borç", ...(dueDate ? { dueDate } : {}) }))).entryId;
  const offset = (label, invoiceId, counterId, amount, date, q = "") => must(label, api.post(`/api/workspace/invoices/${invoiceId}/offsets${q}`, { counterType: "entry", counterId, amount: String(amount), date }));
  before(async () => {
    ctx = await boot({ now: { time: "2027-01-05T10:00:00+03:00", fixed: true } });
    api = ctx.api;
    for (const key of ["b1", "b2", "b3", "b4", "b5", "b6", "b8"]) ids[key] = (await must(key, api.post("/api/workspace/accounts", { name: `Borç Yaz Mahsup ${key.toUpperCase()}`, type: "other" }))).id;
    // ---- ≤K ----
    ids.b1e = await debt("B1 Borç Yaz", ids.b1, 300, "2026-12-05", "2026-12-25");
    ids.b3e = await debt("B3 Borç Yaz", ids.b3, 300, "2026-12-05");
    ids.b4s1 = (await sale("B4 S1", ids.b4, "2026-12-02", 300, "2026-12-10")).id;
    ids.b4e = await debt("B4 Borç Yaz", ids.b4, 300, "2026-12-05", "2026-12-20");
    ids.b4a = (await purchase("B4 alış", ids.b4, "AL-B4", "2026-12-03", 200)).id;
    ids.b5a = (await purchase("B5 alış", ids.b5, "AL-B5", "2026-12-03", 250)).id;
    ids.b6s = (await sale("B6 satış", ids.b6, "2026-12-02", 400, "2026-12-20")).id;
    ids.b6e = await debt("B6 Borç Yaz", ids.b6, 150, "2026-12-05");
    ids.b8s1 = (await sale("B8 S1", ids.b8, "2026-12-02", 300, "2026-12-10")).id;
    ids.b8e = await debt("B8 Borç Yaz", ids.b8, 300, "2026-12-05", "2026-12-20");
    ids.b8a = (await purchase("B8 alış", ids.b8, "AL-B8", "2026-12-03", 200)).id;
    await offset("B8 mahsup K günü", ids.b8a, ids.b8e, 200, "2026-12-31");
    // B2 (sıra değişir; kilitsiz): önce K sonrası alış, sonra geriye tarihli ≤K Borç Yaz, sonra mahsup.
    ids.b2a = (await purchase("B2 Ocak alış (önce)", ids.b2, "AL-B2", "2027-01-02", 150)).id;
    ids.b2e = await debt("B2 Borç Yaz (sonra, geriye tarihli)", ids.b2, 150, "2026-12-10");
    await offset("B2 mahsup", ids.b2a, ids.b2e, 150, "2027-01-03");
    // 002: B1'in aynısı
    const made = await must("002", api.post("/api/companies", { name: "İkinci Şirket", select: false }));
    second = made.company || made;
    ids.x1 = (await must("002 cari", api.post(`/api/workspace/accounts${q2()}`, { name: "Öbür Şirket Borç Yaz", type: "other" }))).id;
    ids.x1e = await debt("002 Borç Yaz", ids.x1, 300, "2026-12-05", "2026-12-25", q2());
    // ---- Dönem Kilidi K (S24 = A) ----
    ctx.server.clock.set("2027-01-05T11:00:00+03:00");
    await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: K }));
    await ctx.app.ledger.snapshots.runPending();
    ctx.server.clock.set("2027-02-10T12:00:00+03:00");
    // ---- >K ----
    ids.b1a = (await purchase("B1 Ocak alış", ids.b1, "AL-B1", "2027-01-10", 200)).id;
    await offset("B1 mahsup", ids.b1a, ids.b1e, 200, "2027-01-12");
    ids.b3a = (await purchase("B3 Ocak alış", ids.b3, "AL-B3", "2027-01-10", 500)).id;
    await offset("B3 mahsup (kısmi)", ids.b3a, ids.b3e, 120, "2027-01-12");
    await offset("B4 mahsup (iki belge ≤K)", ids.b4a, ids.b4e, 200, "2027-01-15");
    ids.b5e = await debt("B5 Ocak Borç Yaz", ids.b5, 100, "2027-01-10");
    await offset("B5 mahsup (ana belge ≤K alış)", ids.b5a, ids.b5e, 100, "2027-01-12");
    ids.b6a = (await purchase("B6 Ocak alış", ids.b6, "AL-B6", "2027-01-16", 150)).id;
    await offset("B6 mahsup (silinecek)", ids.b6a, ids.b6e, 150, "2027-01-17");
    const offsets = await must("B6 mahsuplar", api.get(`/api/workspace/invoices/${ids.b6a}/offsets`));
    await must("B6 mahsup kaldır", api.del(`/api/workspace/invoices/${ids.b6a}/offsets/${offsets.offsets[0].id}`));
    ids.x1a = (await purchase("002 Ocak alış", ids.x1, "AL-X1", "2027-01-10", 200, q2())).id;
    await offset("002 mahsup", ids.x1a, ids.x1e, 200, "2027-01-12", q2());
    job = planModule ? await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" }) : null;
    job002 = planModule ? await waitPreview(api, { company: second.id, cutoff: K, option: "borc-alacak" }) : null;
  });
  after(() => ctx?.server.close());

  const nameOf = id => Object.entries(ids).find(([, value]) => value === id)?.[0] || id;
  const rowOf = (key, j = job) => j.result.plan.newYear.cariler.find(row => row.cari === ids[key]);
  const openOf = key => rowOf(key).satirlar.filter(row => row.tur === "acik-kalem").map(row => [row.kalemSinifi === "fatura" ? nameOf(row.belge.faturaId) : `${row.kalemSinifi}:${nameOf(row.belge.satirId)}`, row.yon, row.tutarMinor, row.vade]);
  const KEYS = ["b1", "b2", "b3", "b4", "b5", "b6", "b8"];

  it("veri tabanı (ders 3): mahsuplar yerinde (B6'nınki silindi), Borç Yaz satırları ve Vade Tarihleri; 002'nin mahsubu 002'nin dosyasında", () => {
    const count = id => ctx.store.get("SELECT COUNT(*) AS n FROM invoice_offsets WHERE account_id = ? AND counter_type = 'entry'", id).n;
    assert.deepEqual(KEYS.map(key => count(ids[key])), [1, 1, 1, 1, 1, 0, 1]);
    assert.equal(ctx.store.get("SELECT due_date AS d FROM account_entries WHERE id = ?", ids.b1e).d, "2026-12-25");
    assert.equal(ctx.store.get("SELECT kind FROM account_entries WHERE id = ?", ids.b2e).kind, "debt");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM invoice_offsets WHERE account_id = ?", ids.x1).n, 0, "002'nin mahsubu 001'in dosyasında değil");
  });

  it("açık kalemler (elle): Borç Yaz'ın ayrılan payı Borç Yaz'ın açık kaleminde (Vade Tarihi korunur); ana belgesi ≤K alışta alışın kaleminde; K bakiyesi değişmez", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    assert.equal(job.state, "done", JSON.stringify(job.error));
    assert.deepEqual(openOf("b1"), [["elle:b1e", "debt", 30000, "2026-12-25"]]);
    assert.deepEqual(openOf("b2"), [["elle:b2e", "debt", 15000, "2026-12-10"]]);
    assert.deepEqual(openOf("b3"), [["elle:b3e", "debt", 30000, "2026-12-05"]]);
    assert.deepEqual(openOf("b4"), [["b4s1", "debt", 30000, "2026-12-10"], ["elle:b4e", "debt", 10000, "2026-12-20"]]);
    assert.deepEqual(openOf("b5"), [["b5a", "credit", 25000, "2026-12-03"]]);
    assert.deepEqual(openOf("b6"), [["elle:b6e", "debt", 15000, "2026-12-05"], ["b6s", "debt", 40000, "2026-12-20"]]);
    assert.deepEqual(openOf("b8"), [["b8s1", "debt", 30000, "2026-12-10"], ["elle:b8e", "debt", 10000, "2026-12-20"]]);
    assert.deepEqual(KEYS.map(key => rowOf(key).kBakiyeMinor), [30000, 15000, 30000, 40000, -25000, 55000, 40000]);
    assert.deepEqual(job.result.plan.sorunlar, []);
    assert.deepEqual(job.result.onDenetim.durdurur.map(row => row.kod), []);
  });

  it("ayırım listesi (elle): Borç Yaz karşısı yeni yıla ayrıldı / iki belge ≤K K'de kapandı; silinen ve K günü mahsubu YOK", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const got = job.result.plan.newYear.mahsupAyirmalari.map(row => [nameOf(row.cari), row.tur, row.tutarMinor, row.belgeler.map(key => nameOf(key.replace(/^(inv|line):/, ""))).sort().join("+"), nameOf(row.karsi.replace(/^(inv|line):/, ""))]).sort();
    assert.deepEqual(got, [
      ["b1", "yeni-yila-ayrildi", 20000, "b1e", "b1a"],
      ["b2", "yeni-yila-ayrildi", 15000, "b2e", "b2a"],
      ["b3", "yeni-yila-ayrildi", 12000, "b3e", "b3a"],
      ["b4", "k-de-kapandi", 20000, "b4a+b4e", ""],
      ["b5", "yeni-yila-ayrildi", 10000, "b5a", "b5e"],
    ].sort());
  });

  it("bağ listesi (elle): mahsubun ≤K Borç Yaz karşısı satırın DEVİR KALEMİNE (line:); ana belgesi ≤K alış faturanın kalemine; iki belgesi ≤K mahsup işaretli", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const offsets = job.result.plan.newYear.baglar.filter(row => row.tablo === "invoice_offsets").map(row => [row.alan, nameOf(row.eskiHedef), row.tur, row.yeniHedef ? nameOf(row.yeniHedef.replace(/^devir-2026-kalem-(inv|line):/, "")) : "", row.mahsup || ""]).sort();
    assert.deepEqual(offsets, [
      ["counter_id", "b1e", "acik-kalem", "b1e", "yeni-yila-ayrildi"],
      ["counter_id", "b2e", "acik-kalem", "b2e", "yeni-yila-ayrildi"],
      ["counter_id", "b3e", "acik-kalem", "b3e", "yeni-yila-ayrildi"],
      ["counter_id", "b4e", "acik-kalem", "b4e", "k-de-kapandi"],
      ["invoice_id", "b4a", "arsiv-basvurusu", "", "k-de-kapandi"],
      ["invoice_id", "b5a", "acik-kalem", "b5a", "yeni-yila-ayrildi"],
    ].sort());
  });

  it("DEVİRSİZ EŞDEĞER (aynı kilitle): gecikmiş, borç tarafı açık kalemler, en eski vade — her senaryo, her gün; B1 01.01 = 100, B3 her gün 0", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const eq = fixture.createEquivalence(ctx.store);
    const days = ["2027-01-01", "2027-01-02", "2027-01-09", "2027-01-10", "2027-01-11", "2027-01-13", "2027-01-16", "2027-01-20", "2027-02-01", "2027-03-01"];
    for (const key of KEYS) {
      for (const out of eq.compare(ids[key], rowOf(key), K, days, { redirect: true })) {
        assert.equal(out.devirli, out.devirsiz, `${key} ${out.day} gecikmiş`);
        assert.deepEqual(out.kalemDevirli, out.kalemDevirsiz, `${key} ${out.day} açık kalemler`);
        assert.equal(out.sinceDevirli, out.sinceDevirsiz, `${key} ${out.day} en eski vade`);
      }
    }
    const at = (key, day) => eq.compare(ids[key], rowOf(key), K, [day], { redirect: true })[0];
    assert.deepEqual([at("b1", "2027-01-01").devirli, at("b3", "2027-01-09").devirli, at("b3", "2027-01-10").devirli, at("b4", "2027-01-01").devirli, at("b2", "2027-01-01").devirli], [10000, 0, 0, 40000, 0]);
    assert.deepEqual(at("b4", "2027-01-01").kalemDevirli, ["2026-12-10|30000", "2026-12-20|10000"]);
  });

  it("002: kendi Borç Yaz mahsubu kendi planında ayrılır; 001'in planı 002'nin carisini içermez", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    assert.equal(job002.state, "done", JSON.stringify(job002.error));
    assert.equal(job.result.plan.newYear.cariler.some(row => row.cari === ids.x1), false);
    const x1 = job002.result.plan.newYear.cariler.find(row => row.cari === ids.x1);
    assert.deepEqual(x1.satirlar.filter(row => row.tur === "acik-kalem").map(row => [row.yon, row.tutarMinor, row.vade]), [["debt", 30000, "2026-12-25"]]);
    assert.deepEqual(job002.result.plan.newYear.mahsupAyirmalari.map(row => [row.tur, row.tutarMinor]), [["yeni-yila-ayrildi", 20000]]);
  });

  it("iki seçenek eşdeğer (Sadece Bakiyeyi Aktar): açık kalemler ve ayırım AYNI", async () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const other = await waitPreview(api, { company: "sirket-001", cutoff: K, option: "sadece-bakiye" });
    const open = j => j.result.plan.newYear.cariler.map(row => [row.cari, row.satirlar.filter(item => item.tur === "acik-kalem").map(item => [item.kimlik, item.tutarMinor, item.vade])]);
    assert.deepEqual(open(other), open(job));
    assert.deepEqual(other.result.plan.newYear.mahsupAyirmalari, job.result.plan.newYear.mahsupAyirmalari);
  });
});
