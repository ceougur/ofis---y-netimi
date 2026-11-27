// 2.5.1 D3 TUR 4 — ÇEK / SENET YÖN × DURUM SINIF TESTİ (uzman görüşü (5) → BAŞ MİMAR KARARI 27.11, kullanıcıya gösterildi): ALINAN ve VERİLEN evrakın her durumu (portföy, bankada
// tahsilde, ciro, karşılıksız, tahsil edildi / ödendi) çek ve senet için ayrı ayrı — planın açılışı doğru YÖNDE ve DURUMDA (hesap / alt hesap, işaret), kapanmış evrak listede yok, modül farkı yok,
// karşılıksızın carisi devirli = devirsiz. Programdaki durumlar (lib/cheques.mjs STATUSES): alınan portfolio / endorsed / collected / bounced (portföyden ya da cirodan), bankada tahsil
// (lib/bank/collections.mjs); verilen pending / paid ("teminat" durumu programda YOK). Veri programın KENDİ API'sinden, beklenen ELLE. K = 31.12.2026, bugün 10.02.2027.
//   Sınıf (tutar)                         çek → hesap / alt / işaret          senet → hesap / alt / işaret
//   alınan portföyde (100 / 200)            101 / 101.01 / +                    121 / 121.01 / +
//   alınan bankada tahsilde (110 / 210)     101 / 101.02 / +                    121 / 121.02 / +
//   alınan ciro edildi (120 / 220)          iz (hesap yok), durum Ciro          iz, durum Ciro
//   alınan karşılıksız — portföyden (130 / 230)  iz, durum Karşılıksız; carinin faturası yeniden açık
//   alınan karşılıksız — cirodan (140)      iz, durum Karşılıksız (yalnız çek)
//   alınan tahsil edildi (150 / 250)        listede YOK                          listede YOK
//   verilen ödenmedi (160 / 260)            103 / — / −                          321 / — / −
//   verilen ödendi (170 / 270)              listede YOK                          listede YOK
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { boot, must } from "./banka-210-ortak.mjs";

const planModule = await import("../server/lib/devir/plan.mjs").catch(() => null);
const fixture = await import("./fixtures/devir-d3-esdeger.mjs");
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

describe("D3 tur 4 — çek / senet yön × durum: planın açılışı doğru yönde ve durumda", () => {
  let ctx;
  let api;
  let job;
  const ids = {};
  let serial = 0;
  const receive = async (name, account, amount, instrument) => {
    ids[name] = (await must(name, api.post("/api/workspace/cheques", { direction: "in", instrument, accountId: account, amount: String(amount), issueDate: "2026-11-10", dueDate: "2027-02-15", serialNo: `SNF-${(serial += 1)}`, bank: "Ziraat" }))).id;
  };
  const give = async (name, amount, instrument) => {
    ids[name] = (await must(name, api.post("/api/workspace/cheques", { direction: "out", instrument, accountId: ids.y, amount: String(amount), issueDate: "2026-11-11", dueDate: "2027-02-20", serialNo: `VSN-${(serial += 1)}`, bank: "Ziraat" }))).id;
  };
  const act = (label, name, body) => must(label, api.post(`/api/workspace/cheques/${ids[name]}/actions`, { method: "cash", cashForce: true, ...body }));
  before(async () => {
    ctx = await boot({ now: { time: "2027-02-10T12:00:00+03:00", fixed: true } });
    api = ctx.api;
    ids.x = (await must("X", api.post("/api/workspace/accounts", { name: "Evrak Müşterisi", type: "customer" }))).id;
    ids.y = (await must("Y", api.post("/api/workspace/accounts", { name: "Evrak Tedarikçisi", type: "supplier" }))).id;
    for (const key of ["b1", "b2", "b3"]) ids[key] = (await must(key, api.post("/api/workspace/accounts", { name: `Karşılıksız ${key.toUpperCase()}`, type: "customer" }))).id;
    ids.bank = (await must("banka", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Tahsil Hesabı", kind: "demand", currency: "TRY", useCheque: true, useNote: true, opening: { date: "2026-01-01", amount: "0", confirmed: true } }))).id;
    // Karşılıksız carilerinin faturası (evrak faturayı kapatır, karşılıksız yeniden açar — UX18).
    for (const [key, amount] of [["b1", 130], ["b2", 230], ["b3", 140]]) {
      ids[`f${key}`] = (await must(`${key} fatura`, api.post("/api/workspace/invoices", { kind: "sale", accountId: ids[key], issueDate: "2026-11-01", lines: [{ name: "Hizmet", qty: 1, unitPrice: amount, discountRate: 0, vatRate: 0 }], payment: { ...pay, dueDate: "2026-11-20" }, force: true }))).id;
    }
    for (const [suffix, instrument, base] of [["c", "cheque", 0], ["s", "note", 100]]) {
      await receive(`portfoy-${suffix}`, ids.x, 100 + base, instrument);
      await receive(`tahsilde-${suffix}`, ids.x, 110 + base, instrument);
      await receive(`ciro-${suffix}`, ids.x, 120 + base, instrument);
      await receive(`tahsil-${suffix}`, ids.x, 150 + base, instrument);
      await give(`odenmedi-${suffix}`, 160 + base, instrument);
      await give(`odendi-${suffix}`, 170 + base, instrument);
    }
    await receive("karsiliksiz-c", ids.b1, 130, "cheque");
    await receive("karsiliksiz-s", ids.b2, 230, "note");
    await receive("cirodan-karsiliksiz-c", ids.b3, 140, "cheque");
    for (const suffix of ["c", "s"]) {
      await act(`tahsile ${suffix}`, `tahsilde-${suffix}`, { action: "bank-deposit", date: "2026-12-05", bankAccountId: ids.bank });
      await act(`ciro ${suffix}`, `ciro-${suffix}`, { action: "endorse", date: "2026-12-06", accountId: ids.y });
      await act(`tahsil ${suffix}`, `tahsil-${suffix}`, { action: "collect", date: "2026-12-07" });
      await act(`ödendi ${suffix}`, `odendi-${suffix}`, { action: "pay", date: "2026-12-08" });
    }
    await act("karşılıksız çek", "karsiliksiz-c", { action: "bounce", date: "2026-12-09" });
    await act("karşılıksız senet", "karsiliksiz-s", { action: "bounce", date: "2026-12-09" });
    await act("cirodan karşılıksız: ciro", "cirodan-karsiliksiz-c", { action: "endorse", date: "2026-12-06", accountId: ids.y });
    await act("cirodan karşılıksız", "cirodan-karsiliksiz-c", { action: "bounce", date: "2026-12-10" });
    job = planModule ? await waitPreview(api, { company: "sirket-001", cutoff: K, option: "borc-alacak" }) : null;
  });
  after(() => ctx?.server.close());

  const nameOf = id => Object.entries(ids).find(([, value]) => value === id)?.[0] || id;

  it("veri tabanı (ders 3): evrakların bugünkü durumu", () => {
    const status = name => ctx.store.get("SELECT status FROM cheques WHERE id = ?", ids[name]).status;
    assert.deepEqual(
      ["portfoy-c", "tahsilde-c", "ciro-c", "tahsil-c", "odenmedi-c", "odendi-c", "karsiliksiz-c", "cirodan-karsiliksiz-c", "portfoy-s", "tahsilde-s", "ciro-s", "tahsil-s", "odenmedi-s", "odendi-s", "karsiliksiz-s"].map(status),
      ["portfolio", "portfolio", "endorsed", "collected", "pending", "paid", "bounced", "bounced", "portfolio", "portfolio", "endorsed", "collected", "pending", "paid", "bounced"],
    );
  });

  it("her sınıf doğru hesapta / alt hesapta / yönde; tahsil edilmiş ve ödenmiş evrak listede YOK (elle)", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    assert.equal(job.state, "done", JSON.stringify(job.error));
    const got = job.result.plan.newYear.evraklar.map(row => [nameOf(row.evrak), row.yon, row.tur, row.durum, row.hesap, row.alt, row.minor]).sort();
    assert.deepEqual(got, [
      ["ciro-c", "in", "cek", "endorsed", "", "", 12000],
      ["ciro-s", "in", "senet", "endorsed", "", "", 22000],
      ["cirodan-karsiliksiz-c", "in", "cek", "bounced", "", "", 14000],
      ["karsiliksiz-c", "in", "cek", "bounced", "", "", 13000],
      ["karsiliksiz-s", "in", "senet", "bounced", "", "", 23000],
      ["odenmedi-c", "out", "cek", "pending", "103", "", 16000],
      ["odenmedi-s", "out", "senet", "pending", "321", "", 26000],
      ["portfoy-c", "in", "cek", "portfolio", "101", "101.01", 10000],
      ["portfoy-s", "in", "senet", "portfolio", "121", "121.01", 20000],
      ["tahsilde-c", "in", "cek", "bank", "101", "101.02", 11000],
      ["tahsilde-s", "in", "senet", "bank", "121", "121.02", 21000],
    ].sort());
  });

  it("kapanış = açılış: evrak hesaplarının arşiv K bakiyesi = planın açılışı (işaretli; alınan +, verilen −); modül farkı / sorun YOK", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const cells = Object.fromEntries(job.result.plan.archive.kapanisBakiyeleri.filter(row => ["101", "103", "121", "321"].includes(row.hesap)).map(row => [`${row.hesap}|${row.alt}`, row.minor]));
    assert.deepEqual(cells, { "101|101.01": 10000, "101|101.02": 11000, "103|": -16000, "121|121.01": 20000, "121|121.02": 21000, "321|": -26000 });
    const opened = {};
    for (const row of job.result.plan.newYear.evraklar) if (row.hesap) opened[`${row.hesap}|${row.alt}`] = (opened[`${row.hesap}|${row.alt}`] || 0) + (row.yon === "in" ? row.minor : -row.minor);
    assert.deepEqual(opened, cells);
    assert.deepEqual(job.result.plan.sorunlar, []);
    assert.deepEqual(job.result.plan.degismezler.filter(row => !row.ok), []);
    assert.deepEqual(job.result.plan.sayilar.evrak, { portfolio: { adet: 2, minor: 30000 }, bank: { adet: 2, minor: 32000 }, endorsed: { adet: 2, minor: 34000 }, bounced: { adet: 3, minor: 50000 }, pending: { adet: 2, minor: 42000 } });
  });

  it("karşılıksızın carisi: faturası yeniden açık (kendi vadesiyle); devirli = devirsiz (portföyden, senet, cirodan)", () => {
    assert.ok(planModule, "D3 devir planı modülü yok (eski kod)");
    const eq = fixture.createEquivalence(ctx.store);
    for (const [key, amount] of [["b1", 13000], ["b2", 23000], ["b3", 14000]]) {
      const row = job.result.plan.newYear.cariler.find(item => item.cari === ids[key]);
      assert.equal(row.kBakiyeMinor, amount, `${key} K bakiyesi`);
      assert.deepEqual(row.satirlar.filter(line => line.tur === "acik-kalem").map(line => [line.tutarMinor, line.vade]), [[amount, "2026-11-20"]], `${key} açık kalem`);
      for (const out of eq.compare(ids[key], row, K, ["2027-01-01", "2027-02-01"], { redirect: true })) {
        assert.equal(out.devirli, out.devirsiz, `${key} ${out.day} gecikmiş`);
        assert.deepEqual(out.kalemDevirli, out.kalemDevirsiz, `${key} ${out.day} açık kalemler`);
      }
    }
  });
});
