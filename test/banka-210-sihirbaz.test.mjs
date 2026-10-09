// 2.1.0 — Aşama 3 (Banka Hesapları), dilim 1: Hesabı Atanmamış Eski Hareketler (102.00 / 108.00), "Bu Hesaba Ata", Kurulum ve Aktarım
// Sihirbazı (Devir Kapanışı + eski hareketleri hesaba bağlama, geri alınabilir), Bankaya Geçmiş Say / Kart Borcuna Aktar ve Alt Hesap Mizanı
// (docs/BANKA-MODULU-PLAN.md §3.3 op 'assign', §3.11, §5.5 kilit izi money_refs, §8.3, §10.3, §10.4, §12.3 "Aşama 3").
//
// Kurgu (sahte saat 08.10.2026): Ziraat açılışı D = 01.10.2026, S = 100.000. Hesap tanımlanmadan önce girilmiş havale/POS hareketleri:
//   20.09 +5.000 havale tahsilat · 25.09 −1.000 havale ödeme · 22.09 +3.000 POS tahsilat · 03.10 +2.000 havale tahsilat.
//   Önce: 102.00 = 6.000, 102.01 = 100.000, 102 = 106.000, 108.00 = 3.000, 500 = −100.000.
// ÇALIŞIYOR MU:
//   - Önizleme (dryRun): Devir Kapanışı X = 4.000 (D'den önceki havale), Y = 3.000 (D'den önceki POS); bağlanacak 1 satır (03.10, 2.000).
//   - Çalıştır: 102.00 = 0, 108.00 = 0, 102.01 = 102.000, 102 = 102.000 (= S + D'den sonraki bağlanan), 500 = −93.000; bağlanan satırın
//     İşlem No'lu olayı hesabı gösterir; mutabakat tamam. Kurulum listesinde görünür.
//   - Geri Al: mizan, alt hesap mizanı ve olay kopyaları birebir eski hâl; Devir Kapanışı ters kayıtlı.
//   - Bankaya Geçmiş Say: 04.10 POS +1.500 → 108.00 1.500 → Ziraat'e 1.500 → 108.00 = 0, 102.01 +1.500; geri alınabilir.
//   - Alt Hesap Mizanı: hesapların adı karttan, 102.00 / 108.00 "Hesabı Atanmamış Eski Hareketler".
// NASIL BOZARIM:
//   - Kilitli dönemdeki satırı "Bu Hesaba Ata" → 409 period-locked; bank.post içinden doğrudan bağlansa bile kapı (kilit izi) → 409 period-lock.
//   - Açılış tarihinden önceki satırı ata → 409 bank-before-opening; POS satırını banka hesabına ata → 400 bank-legacy-way; döviz, kredi,
//     kart ya da vadeli hesaba ata → 400 bank-account-invalid; zaten bağlı satırı yeniden ata → 409 bank-already-assigned; satır yok → 404.
//   - Sihirbaz kilitli D ile → 409; Geri Al'dan önce dönem kilitlenirse → 409; ikinci kez Geri Al → 409; aynı istek kimliğiyle iki kez → tek
//     çalışma; aktarılacak bir şey yoksa → 409 bank-setup-empty.
//   - Bankaya Geçmiş Say 108.00 bakiyesinden fazla → 409 bank-legacy-exceeds; Kart Borcuna Aktar kart hesabı olmadan → 400.
//   - Hesaba bağlı hareketi olan hesap silinemez → 409 bank-account-has-movements → Pasife Al.
//   - Eski sürüm verisi (v2.0.26 zincir fikstürü; olaysız eski satırlar): sihirbaz → geri al → mizan ve alt hesap bakiyeleri birebir aynı.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOk } from "./banka-210-ortak.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";
import { unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { BANK, bootBank, expectStatus, lockPeriod, must, openAccount, subBalances, trialBalances } from "./banka-210-hesap-ortak.mjs";

const balancesOf = async api => {
  const trial = await trialBalances(api);
  const subs = await subBalances(api);
  return { trial, subs: Object.fromEntries(Object.entries(subs).map(([sub, row]) => [sub, row.balance])) };
};
const nonZero = object => Object.fromEntries(Object.entries(object).filter(([, value]) => Math.abs(value) > 0.004));

describe("Aşama 3 — Hesabı Atanmamış Eski Hareketler ve Kurulum Sihirbazı", () => {
  let ctx;
  let ziraat;
  let party;
  const rows = {};
  const entryOf = (date, kind) => ctx.store.get("SELECT id, event_id AS eventId FROM account_entries WHERE account_id = ? AND date = ? AND kind = ?", party.id, date, kind);
  before(async () => {
    ctx = await bootBank();
    const api = ctx.api;
    party = await must("cari", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    await must("20.09 havale", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "5.000", method: "bank", date: "2026-09-20" }));
    await must("25.09 ödeme", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", amount: "1.000", method: "bank", date: "2026-09-25" }));
    await must("22.09 POS", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "3.000", method: "card", date: "2026-09-22" }));
    await must("03.10 havale", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "2.000", method: "bank", date: "2026-10-03" }));
    rows.before = entryOf("2026-09-20", "in");
    rows.out = entryOf("2026-09-25", "out");
    rows.after = entryOf("2026-10-03", "in");
    rows.pos = ctx.store.get("SELECT id FROM account_entries WHERE account_id = ? AND method = 'card'", party.id);
    ziraat = await openAccount(api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
  });
  after(() => ctx.server.close());

  it("Hesabı Atanmamış liste ve özet: 102.00 = 6.000, 108.00 = 3.000; satırlar İşlem No'lu", async () => {
    const legacy = await must("eski", ctx.api.get(`${BANK}/legacy`));
    assert.equal(legacy.totals.bankMinor, 600_000);
    assert.equal(legacy.totals.cardMinor, 300_000);
    const ids = legacy.rows.map(row => row.id).sort();
    assert.deepEqual(ids, [rows.before.id, rows.out.id, rows.after.id, rows.pos.id].sort());
    const after = legacy.rows.find(row => row.id === rows.after.id);
    assert.equal(after.table, "account_entries");
    assert.equal(after.way, "bank");
    assert.equal(after.amountMinor, 200_000);
    assert.equal(after.kind, "in");
    assert.match(after.eventNo, /^BNK-2026-/);
    const summary = await must("özet", ctx.api.get(`${BANK}/summary`));
    assert.equal(summary.unassigned.bankMinor, 600_000);
    assert.equal(summary.unassigned.cardMinor, 300_000);
    assert.equal(summary.realBank.minor, 10_000_000, "Gerçek Banka eski hareketleri içermez");
    const subs = await subBalances(ctx.api);
    assert.equal(subs["102.00"].balance, 6000);
    assert.equal(subs["102.00"].name, "Hesabı Atanmamış Eski Hareketler");
    assert.equal(subs["108.00"].balance, 3000);
  });

  it("nasıl bozarım: Bu Hesaba Ata — açılıştan önce 409, POS satırı 400, uygun olmayan hesap 400, satır yok 404", async () => {
    expectStatus(await ctx.api.post(`${BANK}/legacy/assign`, { accountId: ziraat.id, rows: [{ table: "account_entries", id: rows.before.id }] }), 409, "bank-before-opening", "açılıştan önce");
    expectStatus(await ctx.api.post(`${BANK}/legacy/assign`, { accountId: ziraat.id, rows: [{ table: "account_entries", id: rows.pos.id }] }), 400, "bank-legacy-way", "POS satırı");
    const usd = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "USD", currency: "USD", kind: "fx", opening: { date: "2026-10-01", amount: "0" } });
    const time = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Vadeli", kind: "time", opening: { date: "2026-10-01", amount: "0" } });
    for (const account of [usd, time]) expectStatus(await ctx.api.post(`${BANK}/legacy/assign`, { accountId: account.id, rows: [{ table: "account_entries", id: rows.after.id }] }), 400, "bank-account-invalid", `${account.kindLabel} hesabı`);
    expectStatus(await ctx.api.post(`${BANK}/legacy/assign`, { accountId: ziraat.id, rows: [{ table: "account_entries", id: "aentry-yok" }] }), 404, null, "satır yok");
    expectStatus(await ctx.api.post(`${BANK}/legacy/assign`, { accountId: ziraat.id, rows: [{ table: "notes", id: rows.after.id }] }), 400, "bank-legacy-table", "tanınmayan tablo");
    expectStatus(await ctx.api.post(`${BANK}/legacy/assign`, { accountId: ziraat.id, rows: [] }), 400, null, "boş liste");
    for (const account of [usd, time]) await must("sil", ctx.api.del(`${BANK}/accounts/${account.id}`));
    await integrityOk(ctx.api, "reddedilen atamalar");
  });

  it("nasıl bozarım: kilitli dönemdeki satır — uçta 409 period-locked; bank.post içinden doğrudan bağlansa kapı (kilit izi) 409", async () => {
    // 20.09 satırı için geçici hesap: açılışı 15.09.
    const early = await openAccount(ctx.api, { bankName: "Halkbank", name: "Erken Hesap", kind: "demand", opening: { date: "2026-09-15", amount: "0" } });
    await lockPeriod(ctx.api, "2026-09-30");
    try {
      expectStatus(await ctx.api.post(`${BANK}/legacy/assign`, { accountId: early.id, rows: [{ table: "account_entries", id: rows.before.id }] }), 409, "period-locked", "kilitli satır");
      const row = ctx.store.get("SELECT * FROM account_entries WHERE id = ?", rows.before.id);
      let error = null;
      try {
        ctx.bank.post({ user: { id: "test", role: "admin", permissions: [] }, module: "bank", op: "assign", prev: row, write: () => {
          const eventId = ctx.bank.eventFor("account_entries", row);
          ctx.store.run("UPDATE account_entries SET fin_ref = ?, event_id = ? WHERE id = ?", early.id, eventId, row.id);
          return { id: row.id };
        } });
      } catch (caught) {
        error = caught;
      }
      assert.equal(error?.status, 409, error?.message);
      assert.ok(error.extra.failures.some(item => item.code === "period-lock"), JSON.stringify(error.extra.failures.map(item => item.code)));
      assert.equal(ctx.store.get("SELECT fin_ref AS ref FROM account_entries WHERE id = ?", rows.before.id).ref, "", "satır bağlanmadı");
    } finally {
      await lockPeriod(ctx.api, "");
    }
    await must("geçici hesabı sil", ctx.api.del(`${BANK}/accounts/${early.id}`));
    await integrityOk(ctx.api, "kilit izi");
  });

  it("sihirbaz: önizleme → çalıştır → geri al (birebir eski hâl); ikinci geri al 409", async () => {
    const before = await balancesOf(ctx.api);
    assert.equal(before.subs["102.00"], 6000);
    assert.equal(before.trial["102"], 106000);
    assert.equal(before.trial["500"], -100000);
    const eventBefore = ctx.store.get("SELECT * FROM fin_events WHERE id = ?", rows.after.eventId);
    const preview = await must("önizleme", ctx.api.post(`${BANK}/setup?dryRun=1`, { accountId: ziraat.id, carryClose: true, assign: "all" }));
    assert.equal(preview.date, "2026-10-01");
    assert.equal(preview.carry.bankMinor, 400_000);
    assert.equal(preview.carry.cardMinor, 300_000);
    assert.deepEqual(preview.assign.rows.map(row => row.id), [rows.after.id]);
    assert.equal(preview.assign.amountMinor, 200_000);
    assert.equal(preview.after.unassignedBankMinor, 0);
    assert.equal(preview.after.accountMinor, 10_200_000);
    assert.deepEqual(await balancesOf(ctx.api), before, "önizleme hiçbir şey yazmaz");

    const run = await must("çalıştır", ctx.api.post(`${BANK}/setup`, { accountId: ziraat.id, carryClose: true, assign: "all", requestId: "kurulum-istek-0001-abcdef" }));
    assert.match(run.no, /^BNK-2026-/);
    assert.equal(run.assigned, 1);
    const replay = await ctx.api.post(`${BANK}/setup`, { accountId: ziraat.id, carryClose: true, assign: "all", requestId: "kurulum-istek-0001-abcdef" });
    assert.equal(replay.status, 200);
    assert.equal(replay.data.replayed, true, "aynı istek ikinci kez çalışmaz");
    const mid = await balancesOf(ctx.api);
    assert.equal(mid.subs["102.00"] || 0, 0);
    assert.equal(mid.subs["108.00"] || 0, 0);
    assert.equal(mid.subs["102.01"], 102000);
    assert.equal(mid.trial["102"], 102000);
    assert.equal(mid.trial["108"] || 0, 0);
    assert.equal(mid.trial["500"], -93000);
    const event = ctx.store.get("SELECT bank_ref AS ref, status FROM fin_events WHERE id = ?", rows.after.eventId);
    assert.deepEqual({ ...event }, { ref: ziraat.id, status: "active" }, "bağlanan satırın olayı hesabı gösterir");
    assert.equal(ctx.store.get("SELECT fin_ref AS ref FROM account_entries WHERE id = ?", rows.after.id).ref, ziraat.id);
    const list = await must("kurulumlar", ctx.api.get(`${BANK}/setup`));
    assert.equal(list.runs.length, 1);
    assert.equal(list.runs[0].status, "active");
    await integrityOk(ctx.api, "sihirbaz sonrası");
    expectStatus(await ctx.api.post(`${BANK}/setup`, { accountId: ziraat.id, carryClose: true, assign: "all" }), 409, "bank-setup-empty", "aktarılacak bir şey yok");
    expectStatus(await ctx.api.del(`${BANK}/accounts/${ziraat.id}`), 409, "bank-account-has-movements", "bağlı hareketi olan hesap");

    const undone = await must("geri al", ctx.api.post(`${BANK}/setup/${run.id}/undo`, {}));
    assert.equal(undone.unassigned, 1);
    assert.equal(undone.skipped, 0);
    const back = await balancesOf(ctx.api);
    assert.deepEqual(nonZero(back.trial), nonZero(before.trial), "mizan eski hâl");
    assert.deepEqual(nonZero(back.subs), nonZero(before.subs), "alt hesap mizanı eski hâl");
    const eventAfter = ctx.store.get("SELECT * FROM fin_events WHERE id = ?", rows.after.eventId);
    for (const field of ["bank_ref", "amount_minor", "direction", "method", "date", "status", "type", "no"]) assert.equal(eventAfter[field], eventBefore[field], `olay kopyası ${field}`);
    assert.equal(ctx.store.get("SELECT status FROM fin_events WHERE id = ?", run.id).status, "cancelled");
    const carry = ctx.store.get("SELECT status, reversed_by AS by FROM fin_events WHERE type = 'carry_close'");
    assert.equal(carry.status, "reversed");
    expectStatus(await ctx.api.post(`${BANK}/setup/${run.id}/undo`, {}), 409, "bank-setup-undone", "ikinci geri al");
    await integrityOk(ctx.api, "geri al sonrası");
  });

  it("nasıl bozarım: kilitli D ile sihirbaz 409; Geri Al'dan önce kilit → 409", async () => {
    await lockPeriod(ctx.api, "2026-10-01");
    try {
      expectStatus(await ctx.api.post(`${BANK}/setup`, { accountId: ziraat.id, carryClose: true, assign: "all" }), 409, "period-locked", "kilitli D");
    } finally {
      await lockPeriod(ctx.api, "");
    }
    const run = await must("çalıştır", ctx.api.post(`${BANK}/setup`, { accountId: ziraat.id, carryClose: true, assign: "all" }));
    await lockPeriod(ctx.api, "2026-10-01");
    try {
      expectStatus(await ctx.api.post(`${BANK}/setup/${run.id}/undo`, {}), 409, "period-locked", "kilitli geri al");
    } finally {
      await lockPeriod(ctx.api, "");
    }
    await must("geri al", ctx.api.post(`${BANK}/setup/${run.id}/undo`, {}));
    await integrityOk(ctx.api, "kilit ve sihirbaz");
  });

  it("Bu Hesaba Ata tek satır; zaten bağlı satır 409", async () => {
    const assigned = await must("ata", ctx.api.post(`${BANK}/legacy/assign`, { accountId: ziraat.id, rows: [{ table: "account_entries", id: rows.after.id }] }));
    assert.equal(assigned.assigned, 1);
    expectStatus(await ctx.api.post(`${BANK}/legacy/assign`, { accountId: ziraat.id, rows: [{ table: "account_entries", id: rows.after.id }] }), 409, "bank-already-assigned", "zaten bağlı");
    const subs = await subBalances(ctx.api);
    assert.equal(subs["102.01"].balance, 102000);
    assert.equal(subs["102.00"].balance, 4000);
    await integrityOk(ctx.api, "tek atama");
  });

  it("Bankaya Geçmiş Say ve Kart Borcuna Aktar: tutar sınırı, kart hesabı, geri alınabilir", async () => {
    await must("04.10 POS", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "1.500", method: "card", date: "2026-10-04" }));
    const before = await balancesOf(ctx.api);
    assert.equal(before.subs["108.00"], 4500);
    expectStatus(await ctx.api.post(`${BANK}/legacy/reclass`, { mode: "bank", accountId: ziraat.id, amount: "4.600", date: "2026-10-05" }), 409, "bank-legacy-exceeds", "108.00'dan fazla");
    expectStatus(await ctx.api.post(`${BANK}/legacy/reclass`, { mode: "card", accountId: ziraat.id, amount: "100", date: "2026-10-05" }), 400, "bank-account-invalid", "kart hesabı değil");
    expectStatus(await ctx.api.post(`${BANK}/legacy/reclass`, { mode: "bank", accountId: ziraat.id, amount: "100", date: "2026-10-09" }), 400, "date-future", "ileri tarih");
    const done = await must("Bankaya Geçmiş Say", ctx.api.post(`${BANK}/legacy/reclass`, { mode: "bank", accountId: ziraat.id, amount: "1.500", date: "2026-10-05" }));
    const mid = await balancesOf(ctx.api);
    assert.equal(mid.subs["108.00"], 3000);
    assert.equal(mid.subs["102.01"], before.subs["102.01"] + 1500);
    assert.equal(mid.trial["102"] + mid.trial["108"], before.trial["102"] + before.trial["108"], "iç hareket: toplam değişmez");
    await integrityOk(ctx.api, "Bankaya Geçmiş Say");
    await must("geri al", ctx.api.post(`${BANK}/setup/${done.id}/undo`, {}));
    assert.deepEqual(nonZero((await balancesOf(ctx.api)).subs), nonZero(before.subs));
    await integrityOk(ctx.api, "Bankaya Geçmiş Say geri al");
  });
});

describe("Aşama 3 — sihirbaz eski sürüm verisinde (v2.0.26 zincir fikstürü)", () => {
  it("olaysız eski satırlar: sihirbaz → mutabakat tamam → geri al → mizan ve alt hesaplar birebir aynı", async () => {
    const fixture = unpackFixture("surum-2.0.26-zincir");
    let server = null;
    try {
      server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10 });
      const api = await server.login();
      const unwrap = res => ({ status: res.status, data: res.data, code: res.data?.code });
      const okData = async (label, promise) => {
        const res = unwrap(await promise);
        assert.equal(res.status, 200, `${label}: ${JSON.stringify(res.data).slice(0, 400)}`);
        return res.data;
      };
      const today = server.app.context.period.today();
      const lock = server.app.context.period.lockedUntil();
      const legacy = await okData("eski", api.get(`${BANK}/legacy`));
      assert.ok(legacy.rows.length > 0, "fikstürde hesabı atanmamış eski hareket var");
      assert.ok(legacy.rows.some(row => !row.eventNo), "fikstürde olaysız (v20 öncesi) satır var");
      const trialOf = async () => Object.fromEntries((await okData("mizan", api.get("/api/workspace/ledger"))).trial.accounts.map(row => [row.code, row.balance]));
      const subsOf = async () => Object.fromEntries((await okData("alt", api.get(`${BANK}/sub-trial`))).rows.map(row => [row.sub, row.balance]));
      const before = { trial: await trialOf(), subs: await subsOf() };
      // Fikstürün kendi uyarıları (ör. eski sürümden kalan ileri tarihli çek hareketi; tarihi gelince kalkar) taban sayılır: sihirbaz YENİ sapma
      // üretmemeli.
      const failuresOf = result => (result.failures || []).map(item => `${item.code}:${item.count}`).sort();
      const baseline = failuresOf(await okData("Mutabakat Testi (taban)", api.get("/api/workspace/ledger/integrity")));
      const account = await okData("hesap", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Eski Veri Hesabı", kind: "demand", opening: { date: today, amount: "10.000", confirmed: true } }));
      assert.ok(!lock || today > lock);
      const run = await okData("sihirbaz", api.post(`${BANK}/setup`, { accountId: account.id, carryClose: true, assign: "all" }));
      const mid = await subsOf();
      // D bugün ve açık dönemde: D'den öncekiler Devir Kapanışı'yla kapanır, D ve sonrası hesaba bağlanır → Hesabı Atanmamış kova boşalır.
      assert.equal(mid["102.00"] || 0, 0, "102.00 kapandı");
      assert.equal(mid["108.00"] || 0, 0, "108.00 kapandı");
      assert.equal(mid[account.glSub], 10000 + legacy.rows.filter(row => row.way === "bank" && row.date >= today).reduce((sum, row) => sum + (row.kind === "in" ? 1 : -1) * row.amountMinor, 0) / 100);
      const integrity = await okData("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
      assert.deepEqual(failuresOf(integrity), baseline, JSON.stringify(integrity.failures).slice(0, 800));
      await okData("geri al", api.post(`${BANK}/setup/${run.id}/undo`, {}));
      await okData("hesabı düzelt 0", api.post(`${BANK}/accounts/${account.id}/opening`, { date: today, amount: "0", confirmed: true }));
      const after = { trial: await trialOf(), subs: await subsOf() };
      assert.deepEqual(nonZero(after.trial), nonZero(before.trial), "mizan birebir");
      assert.deepEqual(nonZero(after.subs), nonZero(before.subs), "alt hesaplar birebir");
      const again = await okData("Mutabakat Testi 2", api.get("/api/workspace/ledger/integrity"));
      assert.deepEqual(failuresOf(again), baseline, JSON.stringify(again.failures).slice(0, 800));
    } finally {
      await server?.close().catch(() => {});
      fixture.cleanup();
    }
  });
});
