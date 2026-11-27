// 2.5.1 D3 TUR 4 — S-T2-1 = B (KULLANICI 27.11.2026 14:18 UTC, AYNEN: "önerilerini uygula açık sorulara"): devirde, yeni yılda (K'den sonra) yapılan "Mahsup Et"in karşı belgesi eski
// yıldaki (K ve öncesi) bir belgeyse devir planı o eski belgeyi K kuyruğunda o mahsuba AYIRIR — DEVİRLİ = DEVİRSİZ. Satış yönü, kısmi mahsup, mahsubun silinmesi aynı kural.
// Veri programın KENDİ API'sinden; beklenen sayılar ELLE (aşağıda). D3 HİÇBİR ŞEY YAZMAZ. K = 31.12.2026. Saat: ≤K veri 05.01.2027 10:00 → Dönem Kilidi K (11:00) → K sonrası veri
// 10.02.2027 12:00 (S24 = A: devirsiz eşi aynı kilitle).
//   M1 (örnek AYNEN — tur 2 raporu §9): Aralık satış 400 (vade 20.12) + Aralık alış 150 (03.12); Ocak satış 300 (16.01, vade 30.01); 17.01 Mahsup Et Ocak satışı ↔ Aralık alışı 150.
//        Devirsiz: Aralık satışı 400 açık, Ocak satışı 150 açık; bakiye 550; 01.01–29.01 gecikmiş 400. Devirli (B): K'de alış 150 mahsuba AYRILIR → Aralık satışı 400 açık + alış 150 açık
//        alacak kalemi; K bakiyesi 250 (= 400 − 150); yeni yılda mahsup alışın devir kalemine → Ocak satışı 150.
//   M2 (satış yönü — ana belge ≤K satış): Aralık satış 500 (vade 15.12); Ocak alış 200 (10.01); 12.01 Mahsup Et Aralık satışı ↔ Ocak alışı 200. K: satış 500 açık (200 ayrılmış).
//        Devirsiz: satış 300, alış 0 (01.01 gecikmiş 500 → 13.01'den sonra 300).
//   M3 (kısmi): Aralık satış 400 (vade 20.12) + Aralık alış 200 (03.12); Ocak satış 300 (16.01, vade 30.01); 17.01 Mahsup Et Ocak satışı ↔ Aralık alışı 150. K: alışın 150'si ayrılır, 50'si
//        Aralık satışını netler → satış 350, alış 150 açık. Devirsiz: Aralık satışı 350, Ocak satışı 150.
//   M4 (mahsup silindi): M1'in aynısı, mahsup sonra kaldırıldı → hiçbir şey ayrılmaz: K'de alış satışı netler → satış 250 (tur 2'nin hesabı); devirsiz aynı (Ocak satışı 300).
//   M5 (aynı eski belgeye iki mahsup): Aralık satış 400 (vade 20.12) + Aralık alış 300 (03.12); Ocak satışları A 100 (16.01) ve B 50 (18.01); 17.01 / 19.01 iki Mahsup Et (100, 50) alışla.
//        K: alışın 150'si ayrılır, 150'si satışı netler → satış 250, alış 150 açık. Devirsiz: Aralık satışı 250, Ocak satışları 0.
//   M6 (iki belge ≤K, mahsup K'den sonra — sıra fark eder): Aralık satış S1 300 (vade 10.12), S2 300 (vade 20.12), Aralık alış 200 (03.12); 15.01 Mahsup Et S2 ↔ alış 200.
//        Devirsiz: S1 300, S2 100. Tur 2 planı (mahsup K'de yok): alış S1'i (vadesi önce) netler → S1 100, S2 300 — kalemler ayrışır. B: mahsup K'de uygulanmış sayılır → S1 300, S2 100.
//   M7 (karşı belge Alacak Yaz satırı): Aralık satış 400 (vade 20.12) + 05.12 Alacak Yaz 150; Ocak satış 300 (16.01, vade 30.01); 17.01 Mahsup Et Ocak satışı ↔ Alacak Yaz 150.
//        K: Alacak Yaz 150 ayrılır (açık alacak kalemi, vadesi satırın günü) → satış 400 açık. Devirsiz: Aralık satışı 400, Ocak satışı 150.
//   M9 (mahsup tarihi K): Aralık S1 300 (vade 10.12), S2 300 (vade 20.12), alış 200; 31.12 Mahsup Et S2 ↔ alış 200 → ≤K mahsup (olağan 0. adım; ayırım YOK): S1 300, S2 100.
//   M10 (K+1 günü): Aralık alış 100 (03.12); 01.01.2027 Ocak satış 100 (vade 01.01) + 01.01 Mahsup Et satış ↔ alış 100 → alış 100 ayrılır (açık alacak kalemi, K bakiyesi −100).
//   002 şirketinde M1'in aynısı → 001'in planına girmez (dosya ayrı).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";

const planModule = await import("../server/lib/devir/plan.mjs").catch(() => null);
const fixture = await import("./fixtures/devir-d3-esdeger.mjs");
const K = "2026-12-31";
const pay = { cash: [], cheques: [], endorse: [], rest: "open" };
const line = price => [{ name: "Hizmet", qty: 1, unitPrice: price, discountRate: 0, vatRate: 0 }];

async function waitPreview(api, body, q = "") {
  const started = await must("ön izleme", api.post(`/api/admin/devir/preview${q}`, body));
  for (let i = 0; i < 600; i += 1) {
    const job = await must("ön izleme durumu", api.get(`/api/admin/devir/preview/${started.id}`));
    if (job.state !== "running") return job;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error("ön izleme bitmedi");
}

describe("D3 tur 4 — S-T2-1 = B: K sonrası Mahsup Et'in ≤K belgesi K kuyruğunda o mahsuba ayrılır (devirli = devirsiz)", () => {
  let ctx;
  let api;
  let job;
  let job002;
  let second;
  const ids = {};
  const q2 = () => `?hofCompany=${encodeURIComponent(second.id)}`;
  const sale = async (label, account, issueDate, price, dueDate, q = "") => must(label, api.post(`/api/workspace/invoices${q}`, { kind: "sale", accountId: account, issueDate, lines: line(price), payment: dueDate ? { ...pay, dueDate } : pay, force: true }));
  const purchase = async (label, account, number, issueDate, price, q = "") => must(label, api.post(`/api/workspace/invoices${q}`, { kind: "purchase", accountId: account, number, issueDate, lines: line(price), payment: pay, force: true }));
  const offset = (label, invoiceId, counterType, counterId, amount, date, q = "") => must(label, api.post(`/api/workspace/invoices/${invoiceId}/offsets${q}`, { counterType, counterId, amount: String(amount), date }));
  before(async () => {
    ctx = await boot({ now: { time: "2027-01-05T10:00:00+03:00", fixed: true } });
    api = ctx.api;
    for (const key of ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m9", "m10"]) ids[key] = (await must(key, api.post("/api/workspace/accounts", { name: `Mahsup ${key.toUpperCase()}`, type: "other" }))).id;
    // ---- ≤K ----
    ids.m1s = (await sale("M1 satış", ids.m1, "2026-12-02", 400, "2026-12-20")).id;
    ids.m1a = (await purchase("M1 alış", ids.m1, "AL-M1", "2026-12-03", 150)).id;
    ids.m2s = (await sale("M2 satış", ids.m2, "2026-12-02", 500, "2026-12-15")).id;
    ids.m3s = (await sale("M3 satış", ids.m3, "2026-12-02", 400, "2026-12-20")).id;
    ids.m3a = (await purchase("M3 alış", ids.m3, "AL-M3", "2026-12-03", 200)).id;
    ids.m4s = (await sale("M4 satış", ids.m4, "2026-12-02", 400, "2026-12-20")).id;
    ids.m4a = (await purchase("M4 alış", ids.m4, "AL-M4", "2026-12-03", 150)).id;
    ids.m5s = (await sale("M5 satış", ids.m5, "2026-12-02", 400, "2026-12-20")).id;
    ids.m5a = (await purchase("M5 alış", ids.m5, "AL-M5", "2026-12-03", 300)).id;
    ids.m6s1 = (await sale("M6 S1", ids.m6, "2026-12-02", 300, "2026-12-10")).id;
    ids.m6s2 = (await sale("M6 S2", ids.m6, "2026-12-02", 300, "2026-12-20")).id;
    ids.m6a = (await purchase("M6 alış", ids.m6, "AL-M6", "2026-12-03", 200)).id;
    ids.m7s = (await sale("M7 satış", ids.m7, "2026-12-02", 400, "2026-12-20")).id;
    ids.m7e = (await must("M7 Alacak Yaz", api.post(`/api/workspace/accounts/${ids.m7}/entries`, { kind: "credit", amount: "150", date: "2026-12-05", note: "Alacak" }))).entryId;
    ids.m9s1 = (await sale("M9 S1", ids.m9, "2026-12-02", 300, "2026-12-10")).id;
    ids.m9s2 = (await sale("M9 S2", ids.m9, "2026-12-02", 300, "2026-12-20")).id;
    ids.m9a = (await purchase("M9 alış", ids.m9, "AL-M9", "2026-12-03", 200)).id;
    await offset("M9 mahsup K", ids.m9s2, "invoice", ids.m9a, 200, "2026-12-31");
    ids.m10a = (await purchase("M10 alış", ids.m10, "AL-M10", "2026-12-03", 100)).id;
    // 002: M1'in aynısı (öbür şirketin dosyası)
    const made = await must("002", api.post("/api/companies", { name: "İkinci Şirket", select: false }));
    second = made.company || made;
    ids.x1 = (await must("002 cari", api.post(`/api/workspace/accounts${q2()}`, { name: "Öbür Şirket Mahsup", type: "other" }))).id;
    ids.x1s = (await sale("002 satış", ids.x1, "2026-12-02", 400, "2026-12-20", q2())).id;
    ids.x1a = (await purchase("002 alış", ids.x1, "AL-X1", "2026-12-03", 150, q2())).id;
    // ---- Dönem Kilidi K (S24 = A) ----
    ctx.server.clock.set("2027-01-05T11:00:00+03:00");
    await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: K }));
    await ctx.app.ledger.snapshots.runPending();
    ctx.server.clock.set("2027-02-10T12:00:00+03:00");
    // ---- >K ----
    ids.m10s = (await sale("M10 satış", ids.m10, "2027-01-01", 100, "2027-01-01")).id;
    await offset("M10 mahsup K+1", ids.m10s, "invoice", ids.m10a, 100, "2027-01-01");
    ids.m2a = (await purchase("M2 alış", ids.m2, "AL-M2", "2027-01-10", 200)).id;
    await offset("M2 mahsup (satış yönü)", ids.m2s, "invoice", ids.m2a, 200, "2027-01-12");
    ids.m6off = await offset("M6 mahsup (iki belge ≤K)", ids.m6s2, "invoice", ids.m6a, 200, "2027-01-15");
    for (const key of ["m1", "m3", "m4", "m7"]) ids[`${key}j`] = (await sale(`${key} Ocak satış`, ids[key], "2027-01-16", 300, "2027-01-30")).id;
    ids.m5ja = (await sale("M5 Ocak A", ids.m5, "2027-01-16", 100, "2027-01-30")).id;
    ids.m5jb = (await sale("M5 Ocak B", ids.m5, "2027-01-18", 50, "2027-01-30")).id;
    await offset("M1 mahsup (örnek)", ids.m1j, "invoice", ids.m1a, 150, "2027-01-17");
    await offset("M3 mahsup (kısmi)", ids.m3j, "invoice", ids.m3a, 150, "2027-01-17");
    ids.m4off = await offset("M4 mahsup (silinecek)", ids.m4j, "invoice", ids.m4a, 150, "2027-01-17");
    await offset("M5 mahsup A", ids.m5ja, "invoice", ids.m5a, 100, "2027-01-17");
    await offset("M5 mahsup B", ids.m5jb, "invoice", ids.m5a, 50, "2027-01-19");
    await offset("M7 mahsup (Alacak Yaz)", ids.m7j, "entry", ids.m7e, 150, "2027-01-17");
    const offsets = await must("M4 mahsuplar", api.get(`/api/workspace/invoices/${ids.m4j}/offsets`));
    await must("M4 mahsup kaldır", api.del(`/api/workspace/invoices/${ids.m4j}/offsets/${offsets.offsets[0].id}`));
    ids.x1j = (await sale("002 Ocak satış", ids.x1, "2027-01-16", 300, "2027-01-30", q2())).id;
    await offset("002 mahsup", ids.x1j, "invoice", ids.x1a, 150, "2027-01-17", q2());
    job = planModule ? await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" }) : null;
    job002 = planModule ? await waitPreview(api, { company: second.id, cutoff: K, option: "borc-alacak" }) : null;
  });
  after(() => ctx?.server.close());

  const nameOf = id => Object.entries(ids).find(([, value]) => value === id)?.[0] || id;
  const rowOf = (key, j = job) => j.result.plan.newYear.cariler.find(row => row.cari === ids[key]);
  const openOf = key => rowOf(key).satirlar.filter(row => row.tur === "acik-kalem").map(row => [row.kalemSinifi === "fatura" ? nameOf(row.belge.faturaId) : `${row.kalemSinifi}:${nameOf(row.belge.satirId)}`, row.yon, row.tutarMinor, row.vade]);

  it("veri tabanı (ders 3): mahsuplar — M4'ün mahsubu silindi, öbürleri yerinde; 002'nin mahsubu 002'nin dosyasında", () => {
    const count = id => ctx.store.get("SELECT COUNT(*) AS n FROM invoice_offsets WHERE account_id = ?", id).n;
    assert.deepEqual(["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m9", "m10"].map(key => count(ids[key])), [1, 1, 1, 0, 2, 1, 1, 1, 1]);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM invoice_offsets WHERE account_id = ?", ids.x1).n, 0, "002'nin mahsubu 001'in dosyasında değil");
  });

  it("açık kalemler (elle): ayrılan pay ≤K belgenin açık kaleminde; K bakiyesi değişmez", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    assert.equal(job.state, "done", JSON.stringify(job.error));
    assert.deepEqual(openOf("m1"), [["m1a", "credit", 15000, "2026-12-03"], ["m1s", "debt", 40000, "2026-12-20"]]);
    assert.deepEqual(openOf("m2"), [["m2s", "debt", 50000, "2026-12-15"]]);
    assert.deepEqual(openOf("m3"), [["m3a", "credit", 15000, "2026-12-03"], ["m3s", "debt", 35000, "2026-12-20"]]);
    assert.deepEqual(openOf("m4"), [["m4s", "debt", 25000, "2026-12-20"]]);
    assert.deepEqual(openOf("m5"), [["m5a", "credit", 15000, "2026-12-03"], ["m5s", "debt", 25000, "2026-12-20"]]);
    assert.deepEqual(openOf("m6"), [["m6s1", "debt", 30000, "2026-12-10"], ["m6s2", "debt", 10000, "2026-12-20"]]);
    assert.deepEqual(openOf("m7"), [["elle:m7e", "credit", 15000, "2026-12-05"], ["m7s", "debt", 40000, "2026-12-20"]]);
    assert.deepEqual(openOf("m9"), [["m9s1", "debt", 30000, "2026-12-10"], ["m9s2", "debt", 10000, "2026-12-20"]]);
    assert.deepEqual(openOf("m10"), [["m10a", "credit", 10000, "2026-12-03"]]);
    assert.deepEqual(["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m9", "m10"].map(key => rowOf(key).kBakiyeMinor), [25000, 50000, 20000, 25000, 10000, 40000, 25000, 40000, -10000]);
    assert.deepEqual(job.result.plan.sorunlar, []);
    assert.deepEqual(job.result.onDenetim.durdurur.map(row => row.kod), []);
  });

  it("ayırım listesi (elle): yeni yıla ayrılan / K'de kapanan; tutar = devirsiz kuyruğun mahsuba verdiği pay; silinmiş mahsup ve ≤K mahsup YOK", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    assert.ok(Array.isArray(job.result.plan.newYear.mahsupAyirmalari), "planda mahsup ayırım listesi yok (S-T2-1 = B kodu yok)");
    const got = job.result.plan.newYear.mahsupAyirmalari.map(row => [nameOf(row.cari), row.tur, row.tutarMinor, row.belgeler.map(key => nameOf(key.replace(/^(inv|line):/, ""))).sort().join("+")]).sort();
    assert.deepEqual(got, [
      ["m1", "yeni-yila-ayrildi", 15000, "m1a"],
      ["m10", "yeni-yila-ayrildi", 10000, "m10a"],
      ["m2", "yeni-yila-ayrildi", 20000, "m2s"],
      ["m3", "yeni-yila-ayrildi", 15000, "m3a"],
      ["m5", "yeni-yila-ayrildi", 10000, "m5a"],
      ["m5", "yeni-yila-ayrildi", 5000, "m5a"],
      ["m6", "k-de-kapandi", 20000, "m6a+m6s2"],
      ["m7", "yeni-yila-ayrildi", 15000, "m7e"],
    ].sort());
  });

  it("bağ listesi (elle): ayrılan belgeye K sonrası mahsup → DEVİR KALEMİNE (Alacak Yaz satırı dahil); iki belgesi ≤K mahsup 'k-de-kapandi' işaretli", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const offsets = job.result.plan.newYear.baglar.filter(row => row.tablo === "invoice_offsets").map(row => [row.alan, nameOf(row.eskiHedef), row.tur, row.yeniHedef.replace(/^devir-2026-kalem-(inv|line):/, ""), row.mahsup || ""]).map(row => [row[0], row[1], row[2], row[3] ? nameOf(row[3]) : "", row[4]]).sort();
    assert.deepEqual(offsets, [
      ["counter_id", "m10a", "acik-kalem", "m10a", "yeni-yila-ayrildi"],
      ["counter_id", "m1a", "acik-kalem", "m1a", "yeni-yila-ayrildi"],
      ["counter_id", "m3a", "acik-kalem", "m3a", "yeni-yila-ayrildi"],
      ["counter_id", "m5a", "acik-kalem", "m5a", "yeni-yila-ayrildi"],
      ["counter_id", "m5a", "acik-kalem", "m5a", "yeni-yila-ayrildi"],
      ["counter_id", "m6a", "arsiv-basvurusu", "", "k-de-kapandi"],
      ["counter_id", "m7e", "acik-kalem", "m7e", "yeni-yila-ayrildi"],
      ["invoice_id", "m2s", "acik-kalem", "m2s", "yeni-yila-ayrildi"],
      ["invoice_id", "m6s2", "acik-kalem", "m6s2", "k-de-kapandi"],
    ].sort());
  });

  it("DEVİRSİZ EŞDEĞER (aynı kilitle): gecikmiş, açık kalemler, en eski vade — her senaryo, her gün; örnek AYNEN: M1 01.01 = 400, 01.02 = 550", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const eq = fixture.createEquivalence(ctx.store);
    const days = ["2027-01-01", "2027-01-02", "2027-01-11", "2027-01-13", "2027-01-16", "2027-01-18", "2027-01-20", "2027-01-29", "2027-02-01", "2027-03-01"];
    for (const key of ["m1", "m2", "m3", "m4", "m5", "m6", "m7", "m9", "m10"]) {
      for (const out of eq.compare(ids[key], rowOf(key), K, days, { redirect: true })) {
        assert.equal(out.devirli, out.devirsiz, `${key} ${out.day} gecikmiş`);
        assert.deepEqual(out.kalemDevirli, out.kalemDevirsiz, `${key} ${out.day} açık kalemler`);
        assert.equal(out.sinceDevirli, out.sinceDevirsiz, `${key} ${out.day} en eski vade`);
      }
    }
    const at = (key, day) => eq.compare(ids[key], rowOf(key), K, [day], { redirect: true })[0];
    assert.deepEqual([at("m1", "2027-01-01").devirli, at("m1", "2027-01-29").devirli, at("m1", "2027-02-01").devirli], [40000, 40000, 55000]);
    assert.deepEqual(at("m1", "2027-02-01").kalemDevirli, ["2026-12-20|40000", "2027-01-30|15000"]);
  });

  it("002: kendi mahsubu kendi planında ayrılır; 001'in planı 002'nin carisini içermez", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    assert.equal(job002.state, "done", JSON.stringify(job002.error));
    assert.equal(job.result.plan.newYear.cariler.some(row => row.cari === ids.x1), false);
    const x1 = job002.result.plan.newYear.cariler.find(row => row.cari === ids.x1);
    assert.deepEqual(x1.satirlar.filter(row => row.tur === "acik-kalem").map(row => [row.yon, row.tutarMinor]), [["credit", 15000], ["debt", 40000]]);
    assert.deepEqual(job002.result.plan.newYear.mahsupAyirmalari.map(row => [row.tur, row.tutarMinor]), [["yeni-yila-ayrildi", 15000]]);
  });

  it("iki seçenek eşdeğer (Sadece Bakiyeyi Aktar): açık kalemler ve ayırım AYNI", async () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const other = await waitPreview(api, { company: "sirket-001", cutoff: K, option: "sadece-bakiye" });
    const open = j => j.result.plan.newYear.cariler.map(row => [row.cari, row.satirlar.filter(line => line.tur === "acik-kalem").map(line => [line.kimlik, line.tutarMinor, line.vade])]);
    assert.deepEqual(open(other), open(job));
    assert.deepEqual(other.result.plan.newYear.mahsupAyirmalari, job.result.plan.newYear.mahsupAyirmalari);
  });
});
