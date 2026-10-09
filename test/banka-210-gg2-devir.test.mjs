// 2.1.0 — Aşama 3–4 bağımsız gözden geçirme (GG2): Devir Kapanışı ve eski hareketlerin aktarımı (docs/BANKA-MODULU-PLAN.md §10.3, §3.11).
//
// Bulgu (yüksek, doğrulandı): Devir Kapanışı yalnız AYNI GÜNDEKİ kapanış zincirini görüyordu. Açılış tarihi farklı ikinci hesabın sihirbazı,
// birinci hesabın Devir Kapanışı'nın kapattığı eski bakiyeyi ikinci kez kapatıyor; kapanmış eski satır başka hesaba atanabiliyor; kurulumlu hesap
// silinip yeniden açılabiliyor ya da açılış tarihi geri alınabiliyordu → 102.00 eksi, Gerçek Banka ≠ mizan 102, Mutabakat Testi "tamam".
// Kural (düzeltme): Devir Kapanışı şirket bazında bir SINIRDIR. Etkin en geç Devir Kapanışı günü C'den önceki eski hareketler kapanmıştır:
//   - daha erken açılışlı hesabın sihirbazı yeniden kapatmaz (Devir Kapanışı 0) ve C'den önceki satırı bağlamaz;
//   - C'den önceki eski satır "Bu Hesaba Ata" ile bağlanmaz (409 bank-carry-closed; listede atanamaz ve nedeni);
//   - kurulum kaydı olan hesap silinmez, açılış tarihi değişmez (409; önce Kurulum Geçmişi → Geri Al);
//   - kurulumlar sondan başa geri alınır (sonraki kurulumda Devir Kapanışı varsa önceki geri alınmaz);
//   - kapı (bank:carry): etkin Devir Kapanışları yazım sırasıyla tarihçe geriye gitmez.
// Bulgu (orta, doğrulandı): Bankaya Geçmiş Say / Kart Borcuna Aktar açılıştan ÖNCEKİ 108.00 hareketlerini de aktarıyor, POS tahsilatı ile kartla
// ödemeyi netliyordu. Kural: aktarılabilir tutar hedef hesabın açılışından (ve son Devir Kapanışı'ndan) sonraki satırlardan; tahsilat ('in')
// Bankaya Geçmiş Say'ın, kartla ödeme ('out') Kart Borcuna Aktar'ın havuzu.
// Her senaryoda bağımsız beklenen: her eski satır ya bir kez kapanır ya bir kez bağlanır → 102.00 = 0 ve Gerçek Banka = mizan 102.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOk } from "./banka-210-ortak.mjs";
import { BANK, bootBank, expectStatus, must, openAccount, subBalances, trialBalances } from "./banka-210-hesap-ortak.mjs";

const entry = (api, party, date, amount, { kind = "in", method = "bank" } = {}) => must(`${date} ${kind} ${amount}`, api.post(`/api/workspace/accounts/${party.id}/entries`, { kind, amount, method, date }));
async function state(api) {
  const subs = await subBalances(api);
  const trial = await trialBalances(api);
  const summary = await must("özet", api.get(`${BANK}/summary`));
  const sub = code => Math.round((subs[code]?.balance || 0) * 100);
  return { u: sub("102.00"), c: sub("108.00"), s1: sub("102.01"), s2: sub("102.02"), of: account => sub(account.glSub), gl102: Math.round((trial["102"] || 0) * 100), gl108: Math.round((trial["108"] || 0) * 100), real: summary.realBank.minor, summary };
}
async function invariant(api, label) {
  const now = await state(api);
  assert.equal(now.u, 0, `${label}: 102.00 sıfır olmalı (${now.u / 100})`);
  assert.equal(now.real, now.gl102, `${label}: Gerçek Banka (${now.real / 100}) = mizan 102 (${now.gl102 / 100})`);
  await integrityOk(api, label);
  return now;
}

describe("GG2 — iki hesap, farklı açılış günü (A 01.10 önce, B 15.09 sonra)", () => {
  let ctx;
  let a;
  let b;
  before(async () => {
    ctx = await bootBank();
    const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-08-01" }));
    await entry(ctx.api, party, "2026-09-10", "5.000");
    await entry(ctx.api, party, "2026-09-20", "3.000");
    a = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "A Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
  });
  after(() => ctx.server.close());

  it("A'nın sihirbazı 01.10'dan önceki 8.000'i kapatır", async () => {
    const run = await must("sihirbaz A", ctx.api.post(`${BANK}/setup`, { accountId: a.id, carryClose: true, assign: "all" }));
    assert.equal(run.carry.bankMinor, 800_000);
    await invariant(ctx.api, "A sonrası");
  });

  it("kapanmış satır listede atanamaz; başka hesaba Bu Hesaba Ata → 409 bank-carry-closed", async () => {
    b = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "B Hesabı", kind: "demand", opening: { date: "2026-09-15", amount: "50.000", confirmed: true } });
    const legacy = await must("eski", ctx.api.get(`${BANK}/legacy`));
    const row = legacy.rows.find(item => item.date === "2026-09-20");
    assert.ok(row, "20.09 satırı listede (bağsız)");
    assert.equal(row.assignable, false, "Devir Kapanışı'na girmiş satır atanamaz");
    assert.match(row.reason || "", /Devir Kapanışı/);
    const res = await ctx.api.post(`${BANK}/legacy/assign`, { accountId: b.id, rows: [{ table: row.table, id: row.id }] });
    expectStatus(res, 409, "bank-carry-closed", "kapanmış satırı ata");
    await invariant(ctx.api, "ata denemesinden sonra");
  });

  it("B'nin (daha erken açılışlı) sihirbazı ikinci kez kapatmaz: önizleme 0, çalıştırma boş", async () => {
    const preview = await must("B önizleme", ctx.api.post(`${BANK}/setup?dryRun=1`, { accountId: b.id, carryClose: true, assign: "all" }));
    assert.equal(preview.carry.bankMinor, 0, "Devir Kapanışı yeniden yazılmaz");
    assert.equal(preview.assign.count, 0, "01.10'dan önceki satır bağlanmaz");
    assert.equal(preview.closedThrough, "2026-10-01");
    assert.equal(preview.after.unassignedBankMinor, 0);
    const run = await ctx.api.post(`${BANK}/setup`, { accountId: b.id, carryClose: true, assign: "all" });
    expectStatus(run, 409, "bank-setup-empty", "B sihirbazı");
    const now = await invariant(ctx.api, "B sonrası");
    assert.equal(now.of(a), 10_000_000);
    assert.equal(now.of(b), 5_000_000);
    assert.equal(now.real, 15_000_000);
  });
});

describe("GG2 — iki hesap, ters sıra (B 15.09 önce, A 01.10 sonra); kurulumlar sondan başa geri alınır", () => {
  let ctx;
  let a;
  let b;
  let party;
  let jobB;
  let jobA;
  before(async () => {
    ctx = await bootBank();
    party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-08-01" }));
    await entry(ctx.api, party, "2026-09-10", "5.000");
    await entry(ctx.api, party, "2026-09-20", "3.000");
    b = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "B Hesabı", kind: "demand", opening: { date: "2026-09-15", amount: "50.000", confirmed: true } });
    a = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "A Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
  });
  after(() => ctx.server.close());

  it("B'nin sihirbazı 10.09'u kapatır, 20.09'u B'ye bağlar; A'nın sihirbazında kapatılacak bir şey kalmaz", async () => {
    jobB = await must("sihirbaz B", ctx.api.post(`${BANK}/setup`, { accountId: b.id, carryClose: true, assign: "all" }));
    assert.equal(jobB.carry.bankMinor, 500_000);
    assert.equal(jobB.assigned, 1);
    const preview = await must("A önizleme", ctx.api.post(`${BANK}/setup?dryRun=1`, { accountId: a.id, carryClose: true, assign: "all" }));
    assert.equal(preview.carry.bankMinor, 0);
    const now = await invariant(ctx.api, "B sonrası");
    assert.equal(now.of(b), 5_300_000);
    assert.equal(now.of(a), 10_000_000);
  });

  it("A'ya sonradan bağlanan satır ikinci kurulum; önce B geri alınamaz (409 bank-setup-order), sondan başa geri alınır", async () => {
    await entry(ctx.api, party, "2026-10-05", "1.000");
    jobA = await must("sihirbaz A", ctx.api.post(`${BANK}/setup`, { accountId: a.id, carryClose: true, assign: "all" }));
    assert.equal(jobA.carry.bankMinor, 0);
    assert.equal(jobA.assigned, 1);
    // A'nın kurulumu Devir Kapanışı yazmadı: B'nin geri alınması A'nın kapanışını bozmaz → izinli. Sırayı zorlayan durum: sonraki kurulumda
    // Devir Kapanışı. A'nın açılışını 20.10'a taşıyamayız (bağlı satır var); C hesabı 06.10 açılışlı, 05.10 satırını kapatır.
    await must("A geri al", ctx.api.post(`${BANK}/setup/${jobA.id}/undo`, {}));
    const c = await openAccount(ctx.api, { bankName: "İş Bankası", name: "C Hesabı", kind: "demand", opening: { date: "2026-10-06", amount: "10.000", confirmed: true } });
    const jobC = await must("sihirbaz C", ctx.api.post(`${BANK}/setup`, { accountId: c.id, carryClose: true, assign: "all" }));
    assert.equal(jobC.carry.bankMinor, 100_000, "06.10'dan önce kalan bağsız 1.000 kapanır (10.09 ve 20.09 zaten B'de)");
    await invariant(ctx.api, "C sonrası");
    const early = await ctx.api.post(`${BANK}/setup/${jobB.id}/undo`, {});
    expectStatus(early, 409, "bank-setup-order", "önceki kurulumu sonrakinden önce geri al");
    await must("C geri al", ctx.api.post(`${BANK}/setup/${jobC.id}/undo`, {}));
    await must("B geri al", ctx.api.post(`${BANK}/setup/${jobB.id}/undo`, {}));
    const back = await state(ctx.api);
    assert.equal(back.u, 900_000, "başlangıçtaki 102.00 (5.000 + 3.000 + 1.000)");
    await integrityOk(ctx.api, "geri alındıktan sonra");
  });
});

describe("GG2 — kurulumlu hesapta Açılışı Düzelt (tarih) ve Sil → aynı adla yeniden aç", () => {
  let ctx;
  let a;
  let job;
  before(async () => {
    ctx = await bootBank();
    const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-08-01" }));
    await entry(ctx.api, party, "2026-09-10", "5.000");
    await entry(ctx.api, party, "2026-09-20", "3.000");
    a = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "A Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
    job = await must("sihirbaz", ctx.api.post(`${BANK}/setup`, { accountId: a.id, carryClose: true, assign: "all" }));
  });
  after(() => ctx.server.close());

  it("Açılışı Düzelt tarihi değiştiremez (409 bank-opening-setup); aynı gün tutar değişebilir", async () => {
    const moved = await ctx.api.post(`${BANK}/accounts/${a.id}/opening`, { date: "2026-09-15", amount: "95.000", confirmed: true });
    expectStatus(moved, 409, "bank-opening-setup", "tarihi geri al");
    await must("aynı gün tutar", ctx.api.post(`${BANK}/accounts/${a.id}/opening`, { date: "2026-10-01", amount: "101.000", confirmed: true }));
    const now = await invariant(ctx.api, "tutar düzeltmesinden sonra");
    assert.equal(now.of(a), 10_100_000);
  });

  it("kurulumlu hesap silinmez (409 bank-account-has-setup); Geri Al → sil → aynı adla daha erken aç → sihirbaz: tek kez kapanır", async () => {
    const del = await ctx.api.del(`${BANK}/accounts/${a.id}`);
    expectStatus(del, 409, "bank-account-has-setup", "kurulumlu hesabı sil");
    await must("geri al", ctx.api.post(`${BANK}/setup/${job.id}/undo`, {}));
    await must("sil", ctx.api.del(`${BANK}/accounts/${a.id}`));
    const again = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "A Hesabı", kind: "demand", opening: { date: "2026-09-15", amount: "95.000", confirmed: true } });
    const run = await must("yeniden sihirbaz", ctx.api.post(`${BANK}/setup`, { accountId: again.id, carryClose: true, assign: "all" }));
    assert.equal(run.carry.bankMinor, 500_000);
    assert.equal(run.assigned, 1);
    const now = await invariant(ctx.api, "yeniden açılıştan sonra");
    assert.equal(now.real, 9_800_000);
  });
});

describe("GG2 — kapı: etkin Devir Kapanışları tarihçe geriye gitmez (bank:carry)", () => {
  let ctx;
  let a;
  const user = { id: "test", role: "admin", permissions: [] };
  before(async () => {
    ctx = await bootBank();
    const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-08-01" }));
    await entry(ctx.api, party, "2026-09-10", "5.000");
    a = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "A Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
    await must("sihirbaz", ctx.api.post(`${BANK}/setup`, { accountId: a.id, carryClose: true, assign: "all" }));
  });
  after(() => ctx.server.close());

  it("01.10 kapanışından sonra 15.09 tarihli Devir Kapanışı yazmak (bank.post içinden) → 409, hiçbir şey yazılmaz", () => {
    const before = ctx.store.get("SELECT COUNT(*) AS n FROM fin_events").n;
    let error = null;
    try {
      ctx.bank.post({
        user, module: "test", op: "create",
        write: () => ctx.bank.voucher({ type: "carry_close", date: "2026-09-15", origin: "wizard", description: "Devir Kapanışı (bozma)" }, [
          { role: "bank", gl: "102", sub: "102.00", ref: "", side: "C", tryMinor: 100, currency: "TRY", fxMinor: 100 },
          { role: "closing", gl: "500", side: "D", tryMinor: 100, currency: "TRY", fxMinor: 100 },
        ]),
      });
    } catch (caught) {
      error = caught;
    }
    assert.ok(error, "reddedilmeliydi");
    assert.equal(error.status, 409, `${error.status} ${error.message}`);
    assert.ok((error.extra?.failures || []).some(item => item.code.startsWith("bank:carry")), `bank:carry bekleniyordu: ${(error.extra?.failures || []).map(item => item.code).join(", ")}`);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM fin_events").n, before);
  });
});

describe("GG2 — Bankaya Geçmiş Say / Kart Borcuna Aktar: yalnız açılıştan sonraki, yönüne göre ayrı havuz", () => {
  let ctx;
  let ziraat;
  let card;
  let party;
  before(async () => {
    ctx = await bootBank();
    party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-08-01" }));
    await entry(ctx.api, party, "2026-09-22", "3.000", { method: "card" });
    await entry(ctx.api, party, "2026-09-23", "1.000", { kind: "out", method: "card" });
    ziraat = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
    card = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Şirket Kartı", kind: "card", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
  });
  after(() => ctx.server.close());

  it("açılıştan önceki POS bakiyesi bankaya geçmiş sayılmaz (409 bank-legacy-exceeds); Devir Kapanışı'nın konusudur", async () => {
    const res = await ctx.api.post(`${BANK}/legacy/reclass`, { mode: "bank", accountId: ziraat.id, amount: "2.000" });
    expectStatus(res, 409, "bank-legacy-exceeds", "açılış öncesi POS");
    const card1 = await ctx.api.post(`${BANK}/legacy/reclass`, { mode: "card", accountId: card.id, amount: "1.000" });
    expectStatus(card1, 409, "bank-legacy-exceeds", "açılış öncesi kart ödemesi");
    // Ekranın formu dolduracağı tutar sunucunun aktaracağıyla aynı (önceden 108.00'ın bütün bakiyesi öneriliyordu).
    const legacy = await must("eski", ctx.api.get(`${BANK}/legacy`));
    assert.deepEqual(legacy.reclassable[ziraat.id], { mode: "bank", minor: 0 });
    assert.deepEqual(legacy.reclassable[card.id], { mode: "card", minor: 0 });
  });

  it("açılıştan sonra POS 3.000 + kartla ödeme 1.000: bankaya 3.000 ve karta 1.000 ayrı ayrı aktarılır, fazlası 409", async () => {
    await entry(ctx.api, party, "2026-10-05", "3.000", { method: "card" });
    await entry(ctx.api, party, "2026-10-06", "1.000", { kind: "out", method: "card" });
    const offered = (await must("eski", ctx.api.get(`${BANK}/legacy`))).reclassable;
    assert.deepEqual([offered[ziraat.id], offered[card.id]], [{ mode: "bank", minor: 300_000 }, { mode: "card", minor: 100_000 }], "ekranın önerdiği tutarlar");
    const over = await ctx.api.post(`${BANK}/legacy/reclass`, { mode: "bank", accountId: ziraat.id, amount: "3.000,01" });
    expectStatus(over, 409, "bank-legacy-exceeds", "POS havuzundan fazla");
    await must("bankaya geçmiş say", ctx.api.post(`${BANK}/legacy/reclass`, { mode: "bank", accountId: ziraat.id, amount: "3.000" }));
    await must("kart borcuna aktar", ctx.api.post(`${BANK}/legacy/reclass`, { mode: "card", accountId: card.id, amount: "1.000" }));
    const again = await ctx.api.post(`${BANK}/legacy/reclass`, { mode: "bank", accountId: ziraat.id, amount: "0,01" });
    expectStatus(again, 409, "bank-legacy-exceeds", "ikinci kez aynı havuz");
    const subs = await subBalances(ctx.api);
    assert.equal(subs["102.01"].balance, 103000);
    assert.equal(subs["309.01"].balance, -1000);
    assert.equal(subs["108.00"].balance, 2000, "açılış öncesi net 2.000 Devir Kapanışı'nı bekler");
    await must("sihirbaz", ctx.api.post(`${BANK}/setup`, { accountId: ziraat.id, carryClose: true, assign: "all" }));
    const after = await subBalances(ctx.api);
    assert.equal(after["108.00"]?.balance || 0, 0);
    await integrityOk(ctx.api, "aktarımlardan sonra");
  });
});
