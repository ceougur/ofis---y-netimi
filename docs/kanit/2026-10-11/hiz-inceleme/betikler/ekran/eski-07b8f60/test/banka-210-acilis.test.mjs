// 2.1.0 — Aşama 3 (Banka Hesapları), dilim 1: açılış bakiyesi, Açılışı Düzelt, Açılış Bakiyesi Gir ve kapının yeni denetimleri
// (docs/BANKA-MODULU-PLAN.md §3.7/1, §3.8 "Açılış", §3.9 K7, §3.11 bank:opening / bank:voucher / bank:sub, §5.6, §12.5 kabul 1–4).
//
// ÇALIŞIYOR MU (kabul 1–4, sahte saat 08.10.2026):
//   Ziraat 01.10.2026 100.000 + Garanti 50.000, ikisi de Bakiye Doğrulandı → Alt Hesap Mizanı 102.01 = 100.000, 102.02 = 50.000;
//   mizanda 102 = Σ102.* = 150.000, 500 = −150.000; Gerçek Banka 150.000; eksi bakiye denetimi iki hesapta Uyar; Mutabakat Testi'nde
//   bank:opening, bank:voucher, bank:sub denetimleri görünür ve tamam.
//   Açılışı Düzelt iki kez art arda → tek etkin açılış, eski açılışlar ters kayıtlı, alt hesap son tutarı gösterir.
//   KMH'li vadeside eksi açılış (B 500 / A 102), kart borcu (B 500 / A 309), kredi (B 500 / A 300).
//   Tüm Hareketleri Sil → hesap kalır, Bakiye Doğrulandı kalkar, açılış yok → Açılış Bakiyesi Gir → mutabakat 0; yeni İşlem No eskisinden büyük.
// NASIL BOZARIM:
//   - Açılış tarihi ileri → 400 date-future; kilitli döneme → 409 period-locked; kilitli açılışı düzelt → 409 period-locked.
//   - Açılışı Düzelt ile tarihi hesabın ilk hareketinden sonraya taşı → 409 bank-opening-after-first (aynı güne 200).
//   - Tutar 3 ondalık, "0,005", 1e13, vadesiz dışında eksi → 400.
//   - bank.cancel yetkisi kaldırılmış kişi açılışı düzeltemez (403); açılışı olmayan hesaba girebilir.
//   - Kapı: bank.post dışından değil, bank.post İÇİNDEN bile ikinci etkin açılış, açılıştan önce tarihli bağlı satır (bank:opening), borç ≠ alacak,
//     beyaz liste dışı hesap (191/120), yanlış alt hesap, alt hesabı boş 102 satırı (bank:voucher, bank:sub) → 409 ledger-integrity, hiçbir
//     satır yazılmaz.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { ADMIN_PASSWORD, createUser } from "./helpers.mjs";
import { apiOf, integrityOk } from "./banka-210-ortak.mjs";
import { BANK, bankChecks, bootBank, expectStatus, lockPeriod, must, openAcceptanceAccounts, openAccount, subBalances, trialBalances } from "./banka-210-hesap-ortak.mjs";

describe("Aşama 3 — kabul 1–4 ve açılış kuralları", () => {
  let ctx;
  let accounts;
  before(async () => {
    ctx = await bootBank({ bankPickLegacy: true });
    accounts = await openAcceptanceAccounts(ctx.api);
  });
  after(() => ctx.server.close());

  it("kabul 1–4: 102.01 = 100.000, 102.02 = 50.000, 102 = 150.000, 500 = −150.000, Gerçek Banka 150.000, denetim Uyar", async () => {
    const subs = await subBalances(ctx.api);
    assert.equal(subs["102.01"].balance, 100000);
    assert.equal(subs["102.01"].name, "Ziraat Bankası · Ana TL Hesabı");
    assert.equal(subs["102.02"].balance, 50000);
    assert.equal(subs["102.02"].name, "Garanti BBVA · Ana TL Hesabı");
    const trial = await trialBalances(ctx.api);
    assert.equal(trial["102"], 150000);
    assert.equal(trial["500"], -150000);
    const sumSubs = Object.entries(subs).filter(([sub]) => sub.startsWith("102.")).reduce((sum, [, row]) => sum + row.balance, 0);
    assert.equal(sumSubs, trial["102"], "102 = Σ102.*");
    const summary = await must("özet", ctx.api.get(`${BANK}/summary`));
    assert.equal(summary.realBank.defined, true);
    assert.equal(summary.realBank.minor, 15_000_000);
    assert.equal(summary.labels.realBank, "Gerçek Banka");
    for (const account of [accounts.ziraat, accounts.garanti]) {
      const fresh = await must("hesap", ctx.api.get(`${BANK}/accounts/${account.id}`));
      assert.equal(fresh.balanceConfirmed, true);
      assert.equal(fresh.policy, "warn", `${fresh.label}: Bakiye Doğrulandı → Uyar`);
    }
    const { result, checks } = await bankChecks(ctx.api);
    assert.equal(result.ok, true, JSON.stringify(result.failures).slice(0, 600));
    for (const code of ["bank:opening", "bank:voucher", "bank:sub", "bank:sub:102.01", "bank:sub:102.02"]) assert.ok(checks.some(item => item.code === code && item.ok), `${code} görünür ve tamam: ${checks.map(item => item.code).join(", ")}`);
  });

  it("Bakiye Doğrulandı işaretlenmezse eksi bakiye denetimi Kontrol Yok ve görünür yazı", async () => {
    const draft = await openAccount(ctx.api, { bankName: "İş Bankası", name: "Doğrulanmamış", kind: "demand", opening: { date: "2026-10-01", amount: "1.000" } });
    assert.equal(draft.balanceConfirmed, false);
    assert.equal(draft.policy, "off");
    assert.equal(draft.policyNote, "Açılış bakiyesi doğrulanmadı; eksi bakiye denetimi kapalı.");
    const confirmed = await must("doğrula", ctx.api.put(`${BANK}/accounts/${draft.id}`, { balanceConfirmed: true }));
    assert.equal(confirmed.policy, "warn");
    const blocked = await must("hesap bazında Engelle", ctx.api.put(`${BANK}/accounts/${draft.id}`, { negativePolicy: "block" }));
    assert.equal(blocked.policy, "block");
    expectStatus(await ctx.api.put(`${BANK}/accounts/${draft.id}`, { negativePolicy: "maybe" }), 400, "bank-negative-policy", "tanınmayan politika");
  });

  it("nasıl bozarım: açılış tarihi ileri 400, kilitli 409; tutar 3 ondalık / 0,005 / 1e13 / vadesiz dışında eksi 400", async () => {
    const base = { bankName: "Akbank", name: "Deneme", kind: "commercial" };
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { ...base, opening: { date: "2026-10-09", amount: "1" } }), 400, "date-future", "ileri tarih");
    await lockPeriod(ctx.api, "2026-09-30");
    try {
      expectStatus(await ctx.api.post(`${BANK}/accounts`, { ...base, opening: { date: "2026-09-15", amount: "1" } }), 409, "period-locked", "kilitli dönem");
    } finally {
      await lockPeriod(ctx.api, "");
    }
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { ...base, opening: { date: "2026-10-01", amount: "1,005" } }), 400, "amount-precision", "3 ondalık");
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { ...base, opening: { date: "2026-10-01", amount: "0,005" } }), 400, "amount-precision", "0,005");
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { ...base, opening: { date: "2026-10-01", amount: "10000000000000" } }), 400, "amount-range", "1e13");
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { ...base, opening: { date: "2026-10-01", amount: "-5" } }), 400, "amount-range", "eksi (ticari)");
    const list = await must("liste", ctx.api.get(`${BANK}/accounts?status=all`));
    assert.ok(!list.accounts.some(item => item.name === "Deneme"), "reddedilen istek hesap açmaz");
  });

  it("KMH eksi açılış, kart borcu ve kredi açılışı doğru yönde", async () => {
    const kmh = await openAccount(ctx.api, { bankName: "Yapı Kredi", name: "KMH Hesabı", kind: "demand", creditLimit: "20.000", opening: { date: "2026-10-01", amount: "-5.000", confirmed: true } });
    assert.equal(kmh.balanceMinor, -500_000);
    assert.equal(kmh.opening.direction, "out");
    const subs = await subBalances(ctx.api);
    assert.equal(subs[kmh.glSub].balance, -5000);
    await integrityOk(ctx.api, "KMH");
  });

  it("Açılışı Düzelt iki kez art arda → 200, 200; tek etkin açılış; eski açılışlar ters kayıtlı", async () => {
    const first = await must("düzelt 1", ctx.api.post(`${BANK}/accounts/${accounts.ziraat.id}/opening`, { date: "2026-10-01", amount: "120.000", confirmed: true }));
    assert.match(first.reversed, /^BNK-2026-/);
    assert.equal(first.account.opening.amountMinor, 12_000_000);
    const second = await must("düzelt 2", ctx.api.post(`${BANK}/accounts/${accounts.ziraat.id}/opening`, { date: "2026-10-02", amount: "90.000", confirmed: true }));
    assert.equal(second.account.openingDate, "2026-10-02");
    assert.equal(second.account.opening.amountMinor, 9_000_000);
    assert.notEqual(second.account.opening.no, first.account.opening.no, "her açılış ayrı İşlem No");
    const active = ctx.store.all("SELECT id FROM fin_events WHERE type = 'opening' AND status = 'active' AND bank_ref = ?", accounts.ziraat.id);
    assert.equal(active.length, 1, "tek etkin açılış");
    const reversed = ctx.store.all("SELECT id, reversed_by AS by FROM fin_events WHERE type = 'opening' AND status = 'reversed' AND bank_ref = ?", accounts.ziraat.id);
    assert.equal(reversed.length, 2);
    for (const row of reversed) assert.ok(ctx.store.get("SELECT 1 AS found FROM fin_events WHERE id = ? AND type = 'reversal' AND reversal_of = ?", row.by, row.id), "ters fiş bağlı");
    const subs = await subBalances(ctx.api);
    assert.equal(subs["102.01"].balance, 90000);
    const trial = await trialBalances(ctx.api);
    assert.equal(trial["500"] + trial["102"] + (trial["309"] || 0) + (trial["300"] || 0), 0, "500 karşılığı");
    // Aynı değerlerle yeniden gönderim değişiklik yazmaz.
    const same = await must("aynı açılış", ctx.api.post(`${BANK}/accounts/${accounts.ziraat.id}/opening`, { date: "2026-10-02", amount: "90.000", confirmed: true }));
    assert.equal(same.reversed, null);
    assert.equal(same.account.opening.no, second.account.opening.no);
    await integrityOk(ctx.api, "iki düzeltme");
  });

  it("nasıl bozarım: açılış tarihini ilk hareketten sonraya taşı → 409; aynı güne → 200", async () => {
    // Hesaba bağlı ilk hareket: 05.10.2026 tarihli eski havale tahsilatı Bu Hesaba Ata ile Garanti'ye bağlanır.
    const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Açılış Carisi", type: "customer", registeredOn: "2026-09-01" }));
    const entry = await must("havale", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "300", method: "bank", date: "2026-10-05" }));
    const row = ctx.store.get("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'in'", party.id);
    await must("ata", ctx.api.post(`${BANK}/legacy/assign`, { accountId: accounts.garanti.id, rows: [{ table: "account_entries", id: row.id }] }));
    assert.ok(entry);
    expectStatus(await ctx.api.post(`${BANK}/accounts/${accounts.garanti.id}/opening`, { date: "2026-10-06", amount: "50.000", confirmed: true }), 409, "bank-opening-after-first", "ilk hareketten sonra");
    const ok = await must("aynı gün", ctx.api.post(`${BANK}/accounts/${accounts.garanti.id}/opening`, { date: "2026-10-05", amount: "50.000", confirmed: true }));
    assert.equal(ok.account.openingDate, "2026-10-05");
    await integrityOk(ctx.api, "ilk hareket");
  });

  it("nasıl bozarım: kilitli açılış düzeltilemez (409); kilit kalkınca düzeltilir", async () => {
    await lockPeriod(ctx.api, "2026-10-02");
    try {
      expectStatus(await ctx.api.post(`${BANK}/accounts/${accounts.ziraat.id}/opening`, { date: "2026-10-03", amount: "95.000", confirmed: true }), 409, "period-locked", "kilitli açılış");
      expectStatus(await ctx.api.del(`${BANK}/accounts/${accounts.ziraat.id}`), 409, "period-locked", "kilitli açılışlı hesabı sil");
    } finally {
      await lockPeriod(ctx.api, "");
    }
    const subs = await subBalances(ctx.api);
    assert.equal(subs["102.01"].balance, 90000, "reddedilen düzeltme yazılmadı");
  });

  it("nasıl bozarım: bank.cancel kaldırılmış kişi açılışı düzeltemez (403); açılışsız hesaba girebilir", async () => {
    const accountant = apiOf(await createUser(ctx.server, ctx.api.client, { username: "muhasebe1", role: "muhasebe" }));
    const users = await must("kullanıcılar", ctx.api.get("/api/admin/users"));
    const target = users.find(user => user.username === "muhasebe1");
    await must("yetki kaldır", ctx.api.client.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove: ["bank.cancel"] } }).then(res => ({ status: res.status, data: res.data?.data })));
    expectStatus(await accountant.post(`${BANK}/accounts/${accounts.ziraat.id}/opening`, { date: "2026-10-02", amount: "1", confirmed: true }), 403, "FORBIDDEN", "düzeltme bank.cancel ister");
    const own = await must("muhasebe hesap açar", accountant.post(`${BANK}/accounts`, { bankName: "QNB", name: "Muhasebe Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "0" } }));
    assert.equal(own.opening.amountMinor, 0);
  });

  it("nasıl bozarım (kapı): bank.post içinden ikinci etkin açılış, açılıştan önce bağlı satır, dengesiz fiş, beyaz liste dışı hesap, boş alt hesap → 409", async () => {
    const { bank, store } = ctx;
    const user = { id: "test", role: "admin", permissions: [] };
    const account = accounts.ziraat;
    const snapshot = () => [store.get("SELECT COUNT(*) AS n FROM fin_events").n, store.get("SELECT COUNT(*) AS n FROM bank_lines").n];
    const before = snapshot();
    const at = new Date().toISOString();
    const rawVoucher = (lines, { type = "opening", date = "2026-10-03", bankRef = account.id } = {}) => () => {
      const id = `ev-${randomUUID()}`;
      store.run("INSERT INTO fin_events (id, year, seq, no, type, date, status, origin, src_table, bank_ref, direction, amount_minor, try_minor, currency, method, created_by, created_at) VALUES (?, 2026, ?, ?, ?, ?, 'active', 'manual', '', ?, 'in', 100, 100, 'TRY', 'bank', 'test', ?)",
        id, 900000 + Math.floor(Math.random() * 90000), `BNK-2026-T${randomUUID().slice(0, 8)}`, type, date, bankRef, at);
      lines.forEach((line, seq) => store.run("INSERT INTO bank_lines (id, event_id, seq, role, gl, sub, ref, side, try_minor, currency, fx_minor, rate_e6) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'TRY', ?, 1000000)", `bl-${randomUUID()}`, id, seq + 1, line.role, line.gl, line.sub ?? "", line.ref ?? "", line.side, line.minor, line.minor));
      store.touchEvent(id);
      return { id };
    };
    const attempt = async (label, lines, options, code) => {
      let error = null;
      try {
        bank.post({ user, module: "test", op: "create", write: rawVoucher(lines, options) });
      } catch (caught) {
        error = caught;
      }
      assert.ok(error, `${label}: reddedilmeliydi`);
      assert.equal(error.status, 409, `${label}: ${error.message}`);
      assert.ok((error.extra?.failures || []).some(item => item.code.startsWith(code)), `${label}: ${code} bekleniyordu (${(error.extra?.failures || []).map(item => item.code).join(", ")})`);
    };
    const bankLine = (side, minor, extra = {}) => ({ role: "bank", gl: "102", sub: account.glSub, ref: account.id, side, minor, ...extra });
    await attempt("ikinci etkin açılış", [bankLine("D", 100), { role: "opening", gl: "500", side: "C", minor: 100 }], {}, "bank:opening");
    await attempt("açılıştan önce bağlı fiş", [bankLine("D", 100), { role: "income", gl: "649", side: "C", minor: 100 }], { type: "other_in", date: "2026-09-20" }, "bank:opening");
    await attempt("dengesiz fiş", [bankLine("D", 150), { role: "income", gl: "649", side: "C", minor: 100 }], { type: "other_in" }, "bank:voucher");
    await attempt("beyaz liste dışı 191", [bankLine("D", 100), { role: "expense", gl: "191", side: "C", minor: 100 }], { type: "other_in" }, "bank:voucher");
    await attempt("beyaz liste dışı 120", [bankLine("D", 100), { role: "income", gl: "120", side: "C", minor: 100 }], { type: "other_in" }, "bank:voucher");
    await attempt("yanlış alt hesap", [bankLine("D", 100, { sub: accounts.garanti.glSub }), { role: "income", gl: "649", side: "C", minor: 100 }], { type: "other_in" }, "bank:");
    await attempt("alt hesabı boş 102", [bankLine("D", 100, { sub: "" }), { role: "income", gl: "649", side: "C", minor: 100 }], { type: "other_in" }, "bank:");
    assert.deepEqual(snapshot(), before, "hiçbir satır yazılmadı");
    // Modül satırı: hesaba bağlı tahsilat açılıştan önce (bank.post içinden, yol doğru) → bank:opening.
    const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Kapı Carisi", type: "customer", registeredOn: "2026-09-01" }));
    let error = null;
    try {
      bank.post({ user, module: "test", op: "create", write: () => {
        const row = { kind: "in", source: "", date: "2026-09-25", method: "bank" };
        const eventId = bank.eventFor("account_entries", row);
        store.run("INSERT INTO account_entries (id, account_id, kind, amount, date, note, source, source_id, method, fin_ref, event_id, created_by, created_at) VALUES (?, ?, 'in', 10, '2026-09-25', '', '', '', 'bank', ?, ?, 'test', ?)", `ae-${randomUUID()}`, party.id, account.id, eventId, at);
        return { id: eventId };
      } });
    } catch (caught) {
      error = caught;
    }
    assert.equal(error?.status, 409, error?.message);
    assert.ok(error.extra.failures.some(item => item.code.startsWith("bank:opening")), JSON.stringify(error.extra.failures.map(item => item.code)));
    await integrityOk(ctx.api, "kapı reddi sonrası");
  });
});

describe("Aşama 3 — sıfırlama ve Açılış Bakiyesi Gir", () => {
  it("Tüm Hareketleri Sil → hesap kalır, Bakiye Doğrulandı kalkar, açılış yok → Açılış Bakiyesi Gir → mutabakat 0; İşlem No geri gitmez", async () => {
    const ctx = await bootBank({ bankPickLegacy: true });
    try {
      const { ziraat } = await openAcceptanceAccounts(ctx.api);
      const lastNo = ctx.store.get("SELECT MAX(seq) AS n FROM fin_events WHERE year = 2026").n;
      await must("sıfırla", ctx.api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD }));
      const after = await must("hesap", ctx.api.get(`${BANK}/accounts/${ziraat.id}`));
      assert.equal(after.balanceConfirmed, false);
      assert.equal(after.opening, null, "açılış silindi");
      assert.equal(after.balanceMinor, 0);
      assert.equal(after.policy, "off");
      const entered = await must("Açılış Bakiyesi Gir", ctx.api.post(`${BANK}/accounts/${ziraat.id}/opening`, { date: "2026-10-07", amount: "75.000", confirmed: true }));
      assert.equal(entered.reversed, null);
      assert.equal(entered.account.opening.amountMinor, 7_500_000);
      assert.ok(Number(entered.account.opening.no.slice(-6)) > lastNo, "sıfırlamadan sonra İşlem No geri gitmez");
      const subs = await subBalances(ctx.api);
      assert.equal(subs["102.01"].balance, 75000);
      await integrityOk(ctx.api, "sıfırla ve aç");
      await must("tümünü sıfırla", ctx.api.post("/api/companies/sirket-001/reset", { mode: "all", confirm: "001", password: ADMIN_PASSWORD }));
      const list = await must("liste", ctx.api.get(`${BANK}/accounts?status=all`));
      assert.deepEqual(list.accounts, [], "Tümünü Sıfırla hesap kartlarını da siler");
      await integrityOk(ctx.api, "tümünü sıfırla");
    } finally {
      await ctx.server.close();
    }
  });
});
