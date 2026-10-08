// 2.1.0 — Aşama 2, Dilim 4: mutabakat kapısı altyapısı (docs/BANKA-MODULU-PLAN.md §3.11, §5.5, E1.16, K6/c).
//
// ÇALIŞIYOR MU:
//  - Olay bazlı denetimler: her COMMIT'te yalnız DOKUNULAN olaylar (touched.events) için bank:event (kopya = satır; etkin olayın
//    satırı var; iptal olayın satırı yok) ve money:report (satır toplamı = özet); tam tarama (açılış, Mutabakat Testi, 15 dakikada
//    bir arka planda, salt okuma) bütün veride bank:event, money:report, money:event (v20 sonrası olaysız para satırı), bank:sub.
//  - Varlık bazında kod: bank:sub:<alt hesap>, bank:event:<hesap>; taban sapması yalnız kendi varlığını kilitler (B3 imza kuralı).
//  - Görünürlük: banka kullanılmayan kurulumda Mutabakat Testi'nin denetim listesi ve "N denetim tamam" sayısı değişmez; banka
//    denetimleri hesap/Banka Fişi tanımlanınca ya da sapma bulununca görünür.
//  - Tam taramanın bulduğu yeni sapma geri alınamaz: integrity_log ("scan") ve zil olayı (integrity.alert); aynı sapma yinelenmez.
//  - Taksit kartının carisi değişince taksit tahsilatlarının olay kopyası (cari) yenilenir (yanlış alarm yok).
// NASIL BOZARIM:
//  1. Olay kopyasını ham SQL ile boz → tam tarama bank:event yakalar; o olaya dokunan işlem kopyayı yeniler (geçer); başka olaydaki
//     işlem engellenmez (eski sapma tabandadır).
//  2. fin_ref dolu ama olay yok; iptal edilmiş olayın etkin satırı var; satırı olmayan etkin olay → bank:event.
//  3. Üretim kipinde bank.post dışında ham UPDATE (K6 yalnız günlüğe yazar) satırın tutarını değiştirir → 15 dakikalık tam tarama
//     yakalar; tarama veriyi değiştirmez.
//  4. v20'den sonra olaysız para satırı yazılır (eski sürüm ya da ham yazım) → money:event (tam tarama); açılışta bulunanlar eski
//     (engellemez), yenisi taramada bulunur.
//  5. A hesabında taban sapması varken B hesabında işlem geçer; B'de yeni sapma bank:sub:<B> ile engellenir (A'nın kodu değil).
//  6. İleri tarihli eski Banka Fişi (A13) gün ilerleyince işlemleri engellemez; yeni ileri tarihli fiş engellenir.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, it } from "node:test";
import { boot, insertBankAccount, integrityOf, integrityOk, localDay, must, rawAll, rawGet, rawRun } from "./banka-210-ortak.mjs";

const TODAY = localDay(0);
const codesOf = result => result.checks.map(item => item.code);
const failuresOf = result => result.failures.map(item => item.code);
const bankCode = code => /^(bank:|money:event|money:report)/.test(code);
const seedBasic = async api => {
  const account = await must("cari", api.post("/api/workspace/accounts", { name: "Kapı Müşterisi", type: "customer", registeredOn: TODAY }));
  const cash = await must("Kasa girişi", api.post("/api/workspace/cash", { kind: "in", amount: "1.000", date: TODAY, description: "Giriş" }));
  const collected = await must("cari tahsilat", api.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "in", amount: "250", date: TODAY, method: "bank" }));
  return { account, cash, collected };
};
const eventOf = (db, table, id) => rawGet(db, `SELECT event_id AS e FROM ${table} WHERE id = ?`, id).e;

describe("kapı — olay bazlı denetimler ve tam tarama", () => {
  let ctx;
  let data;
  before(async () => {
    ctx = await boot();
    data = await seedBasic(ctx.api);
  });
  after(() => ctx.server.close());

  it("çalışıyor mu: bank.post sonrası kopyalar satırla aynı; gizli banka denetimleri tamam ve banka kullanılmadığı için görünmez", async () => {
    const result = ctx.app.integrity.run({ includeHidden: true });
    const hidden = result.checks.filter(item => bankCode(item.code));
    assert.ok(hidden.some(item => item.code === "bank:event"), `bank:event denetimi çalışmalı: ${codesOf(result).filter(bankCode)}`);
    for (const code of ["money:event", "money:report"]) assert.ok(hidden.some(item => item.code === code), `${code} çalışmalı`);
    assert.ok(hidden.every(item => item.ok), JSON.stringify(hidden.filter(item => !item.ok)));
    const visible = await integrityOk(ctx.api, "temel");
    assert.ok(!codesOf(visible).some(bankCode), `banka kullanılmayan kurulumda banka denetimleri görünmez: ${codesOf(visible).filter(bankCode)}`);
  });

  it("NASIL BOZARIM: kopyayı ham SQL ile boz → tam tarama bank:event; o olaya dokunan işlem kopyayı yeniler; başka olaydaki işlem geçer", async () => {
    const { api, db, app } = ctx;
    const eventId = eventOf(db, "cash_entries", data.cash.id);
    rawRun(db, "UPDATE fin_events SET amount_minor = amount_minor + 1 WHERE id = ?", eventId);
    const broken = await integrityOf(api);
    assert.ok(failuresOf(broken).includes("bank:event"), `bank:event yakalamalı: ${failuresOf(broken)}`);
    app.integrity.start(); // açılış: sapma taban olur
    await must("ilgisiz işlem geçer", api.post("/api/workspace/cash", { kind: "in", amount: "10", date: TODAY, description: "İlgisiz" }));
    await must("aynı olaya dokunan düzeltme geçer", api.put(`/api/workspace/cash/${data.cash.id}`, { kind: "in", amount: "1.000", date: TODAY, description: "Giriş (düzeltildi)" }));
    assert.equal(rawGet(db, "SELECT amount_minor AS m FROM fin_events WHERE id = ?", eventId).m, 100000, "kopya satırdan yenilendi");
    await integrityOk(api, "düzeltme sonrası");
  });

  it("NASIL BOZARIM: fin_ref dolu ama olay yok; iptal olayın etkin satırı; satırı olmayan etkin olay → bank:event", async () => {
    const { api, db, app } = ctx;
    const extra = await must("Kasa", api.post("/api/workspace/cash", { kind: "in", amount: "20", date: TODAY, description: "Ref" }));
    const eventId = eventOf(db, "cash_entries", extra.id);
    // 1) hesaba bağlı satırın olayını kopar (fin_ref dolu kalsın): satırın olayı yok, olayın da satırı yok.
    insertBankAccount(db, { id: "acc-k", code: "KAPI", glSub: "102.31" });
    const collectedEvent = eventOf(db, "account_entries", data.collected.entryId);
    rawRun(db, "UPDATE account_entries SET fin_ref = 'acc-k', event_id = '' WHERE id = ?", data.collected.entryId);
    let result = app.integrity.run({ includeHidden: true });
    assert.ok(result.failures.some(item => item.code.startsWith("bank:event") && item.sample?.some(line => line.includes(data.collected.entryId))), `fin_ref dolu, olay yok: ${JSON.stringify(result.failures)}`);
    assert.ok(result.failures.some(item => item.code.startsWith("bank:event") && item.sample?.some(line => line.includes(collectedEvent))), `satırsız etkin olay: ${JSON.stringify(result.failures)}`);
    rawRun(db, "UPDATE account_entries SET fin_ref = '', event_id = ? WHERE id = ?", collectedEvent, data.collected.entryId);
    // 2) etkin satırı olan olayı iptal göster
    rawRun(db, "UPDATE fin_events SET status = 'cancelled' WHERE id = ?", eventId);
    result = app.integrity.run({ includeHidden: true });
    assert.ok(result.failures.some(item => item.code.startsWith("bank:event") && item.sample?.some(line => line.includes(eventId))), `iptal olayın etkin satırı: ${JSON.stringify(result.failures)}`);
    rawRun(db, "UPDATE fin_events SET status = 'active' WHERE id = ?", eventId);
    // 3) etkin olayın satırını ham SQL ile sil
    rawRun(db, "DELETE FROM cash_entries WHERE id = ?", extra.id);
    result = app.integrity.run({ includeHidden: true });
    assert.ok(result.failures.some(item => item.code.startsWith("bank:event") && item.sample?.some(line => line.includes(eventId))), `satırı olmayan etkin olay: ${JSON.stringify(result.failures)}`);
    rawRun(db, "UPDATE fin_events SET status = 'cancelled' WHERE id = ?", eventId);
    rawRun(db, "DELETE FROM bank_accounts WHERE id = 'acc-k'");
    app.integrity.start();
    await integrityOk(api, "onarılmış durum");
  });

  it("money:event (tam tarama): v20 sonrası olaysız para satırı görünür; açılıştakiler eski (engellemez), yenisi taramada bulunur", async () => {
    const { api, db, app } = ctx;
    rawRun(db, "INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('cash-olaysiz-1', 'in', 5, ?, 'Ham', 'cash', 'eski', ?)", TODAY, new Date().toISOString());
    let result = await integrityOf(api);
    const item = result.checks.find(check => check.code === "money:event");
    assert.equal(item?.ok, false, `money:event görünür ve yakalar: ${JSON.stringify(item)}`);
    assert.equal(item.count, 1);
    app.integrity.start();
    result = app.integrity.run();
    const legacy = result.checks.find(check => check.code === "money:event");
    assert.equal(legacy.gateCount, 0, "açılışta bulunan eski satır kapıyı engellemez");
    assert.equal(legacy.severity, "warning");
    await must("işlem geçer", api.post("/api/workspace/cash", { kind: "in", amount: "1", date: TODAY, description: "Geçer" }));
    rawRun(db, "INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('cash-olaysiz-2', 'in', 6, ?, 'Ham', 'cash', 'eski', ?)", TODAY, new Date().toISOString());
    const scan = app.integrity.scan();
    assert.ok(scan.findings.some(finding => finding.code === "money:event"), `tarama yeni olaysız satırı bulur: ${JSON.stringify(scan.findings)}`);
    rawRun(db, "DELETE FROM cash_entries WHERE id IN ('cash-olaysiz-1', 'cash-olaysiz-2')");
    app.integrity.start();
  });
});

describe("kapı — 15 dakikalık tam tarama (üretim kipi)", () => {
  let ctx;
  let data;
  before(async () => {
    ctx = await boot({ moneyStrict: false });
    data = await seedBasic(ctx.api);
  });
  after(() => ctx.server.close());

  it("NASIL BOZARIM: bank.post dışında ham UPDATE → tarama bank:event bulur, integrity_log 'scan' + zil; ikinci taramada yinelenmez; veri değişmez", async () => {
    const { store, db, app } = ctx;
    const alerts = [];
    app.events.tap((name, payload) => {
      if (name === "integrity.alert") alerts.push(payload);
    });
    // K6 (c): üretim kipinde bu ham düzeltme yalnız günlüğe yazılır, iş durmaz; olay kopyası eskide kalır.
    store.run("UPDATE cash_entries SET amount = 1100 WHERE id = ?", data.cash.id);
    assert.equal(rawGet(db, "SELECT amount FROM cash_entries WHERE id = ?", data.cash.id).amount, 1100);
    const snapshot = () => JSON.stringify(["cash_entries", "account_entries", "fin_events", "payments"].map(table => rawAll(db, `SELECT * FROM ${table} ORDER BY rowid`)));
    const before = snapshot();
    const logBefore = rawGet(db, "SELECT COUNT(*) AS n FROM integrity_log WHERE action = 'scan'").n;
    const first = app.integrity.scan();
    assert.ok(first.findings.some(item => item.code.startsWith("bank:event")), `tarama yakalamalı: ${JSON.stringify(first.findings)}`);
    assert.equal(rawGet(db, "SELECT COUNT(*) AS n FROM integrity_log WHERE action = 'scan'").n, logBefore + 1, "integrity_log'a 'scan' kaydı");
    assert.equal(alerts.length, 1, "zil olayı (integrity.alert)");
    assert.ok(alerts[0].findings?.length >= 1);
    const second = app.integrity.scan();
    assert.equal(second.findings.length, 0, "aynı sapma ikinci taramada yinelenmez");
    assert.equal(rawGet(db, "SELECT COUNT(*) AS n FROM integrity_log WHERE action = 'scan'").n, logBefore + 1);
    assert.equal(snapshot(), before, "tarama salt okumadır");
    const report = await must("Mutabakat Günlüğü", ctx.api.get("/api/workspace/report-center/mutabakat-gunlugu"));
    assert.ok(report.rows.some(row => row[1] === "Taramada Bulunan Sapma"), JSON.stringify(report.rows.slice(0, 3)));
  });

  it("tarama zamanlayıcısı kurulur (15 dakika) ve kapanışta durur", async () => {
    const timer = ctx.app.integrity.scanTimer;
    assert.ok(timer, "tarama zamanlayıcısı yok");
    assert.equal(ctx.app.integrity.scanMinutes, 15);
  });
});

describe("kapı — varlık bazında kod, ileri tarihli Banka Fişi, taksit kartı carisi", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ now: `${TODAY}T10:00:00+03:00` });
  });
  after(() => ctx.server.close());

  const stockMoveSql = "INSERT INTO stock_moves (id, item_id, kind, qty, unit_price, amount, date, note, pay, method, fin_ref, event_id, created_by, created_at) VALUES (?, 'urun-yok', 'out', 1, ?, ?, ?, '', 'cash', 'bank', ?, ?, 'test', ?)";

  it("A hesabında taban sapması varken B'de işlem geçer; B'de yeni sapma bank:sub:<B> ile engellenir", async () => {
    const { db, app, bank, store } = ctx;
    insertBankAccount(db, { id: "acc-A", code: "A-TL", glSub: "102.01" });
    insertBankAccount(db, { id: "acc-B", code: "B-TL", glSub: "102.02" });
    // A: ürünü olmayan (silinmiş) stok satışı — yevmiye sayar, tek kaynak saymaz (eski sürümden kalmış bozuk veri gibi).
    rawRun(db, stockMoveSql, "sm-A", 100, 100, TODAY, "acc-A", "", new Date().toISOString());
    app.integrity.start();
    const legacy = app.integrity.run();
    assert.ok(failuresOf(legacy).includes("bank:sub:102.01"), `A'nın sapması kendi koduyla: ${failuresOf(legacy)}`);
    assert.ok(!failuresOf(legacy).includes("bank:sub:102.02"));
    const account = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "B Müşterisi", type: "customer", registeredOn: TODAY }));
    // B'ye hesaba bağlı tahsilat (yeni kodun yazacağı gibi bank.post içinde): geçer.
    bank.post({ user: { id: "test" }, module: "test", op: "create", write: () => {
      const row = { id: `ae-${randomUUID()}`, account_id: account.id, kind: "in", amount: 40, date: TODAY, method: "bank", source: "", fin_ref: "acc-B" };
      store.run("INSERT INTO account_entries (id, account_id, kind, amount, date, note, method, source, fin_ref, event_id, created_by, created_at) VALUES (?, ?, 'in', 40, ?, '', 'bank', '', 'acc-B', ?, 'test', ?)", row.id, account.id, TODAY, bank.eventFor("account_entries", row), new Date().toISOString());
    } });
    // B'de yeni sapma: engellenir; hata B'nin alt hesabını söyler.
    let error = null;
    try {
      bank.post({ user: { id: "test" }, module: "test", op: "create", write: () => {
        const row = { id: "sm-B", item_id: "urun-yok", kind: "out", pay: "cash", amount: 30, date: TODAY, method: "bank", fin_ref: "acc-B" };
        store.run(stockMoveSql, "sm-B", 30, 30, TODAY, "acc-B", bank.eventFor("stock_moves", row), new Date().toISOString());
      } });
    } catch (caught) {
      error = caught;
    }
    assert.ok(error, "B'deki yeni sapma geri alınmalı");
    const codes = (error.failures || []).map(item => item.code);
    assert.ok(codes.includes("bank:sub:102.02"), `B'nin kodu: ${codes}`);
    assert.ok(!codes.includes("bank:sub:102.01"), `A'nın taban sapması engelin nedeni değil: ${codes}`);
    assert.equal(rawGet(db, "SELECT COUNT(*) AS n FROM stock_moves WHERE id = 'sm-B'").n, 0);
    rawRun(db, "DELETE FROM stock_moves WHERE id = 'sm-A'");
    app.integrity.start();
  });

  it("A13 (fin_events): ileri tarihli eski Banka Fişi taban; gün ilerleyince işlem geçer; yeni ileri tarihli fiş engellenir", async () => {
    const { db, app, bank, store, server, api } = ctx;
    const { nextEventNo } = await import("../server/lib/bank/event-no.mjs");
    const tomorrow = localDay(1, new Date(`${TODAY}T12:00:00`));
    const at = new Date().toISOString();
    const year = Number(TODAY.slice(0, 4));
    rawRun(db, "INSERT INTO fin_events (id, year, seq, no, type, date, status, origin, src_table, method, direction, amount_minor, try_minor, bank_ref, created_by, created_at) VALUES ('ev-ileri', ?, 800001, ?, 'other_in', ?, 'active', 'manual', '', 'bank', 'in', 1000, 1000, 'acc-A', 'test', ?)", year, `BNK-${year}-800001`, tomorrow, at);
    rawRun(db, "INSERT INTO bank_lines (id, event_id, seq, role, gl, sub, ref, side, try_minor) VALUES ('bl-ileri-1', 'ev-ileri', 1, 'bank', '102', '102.01', 'acc-A', 'D', 1000), ('bl-ileri-2', 'ev-ileri', 2, 'income', '649', '', '', 'C', 1000)");
    app.integrity.start();
    const legacy = app.integrity.run().checks.find(item => item.code === "dates:future:fin_events");
    assert.equal(legacy?.gateCount, 0, `eski ileri tarihli fiş taban: ${JSON.stringify(legacy)}`);
    server.clock.advance({ days: 2 });
    await must("gün ilerledi, işlem geçer", api.post("/api/workspace/cash", { kind: "in", amount: "3", date: server.clock.today(), description: "Sonraki gün" }));
    let error = null;
    try {
      bank.post({ user: { id: "test" }, module: "test", op: "create", write: () => {
        const day = localDay(3, new Date(`${server.clock.today()}T12:00:00`));
        const number = nextEventNo(store, day, { now: server.clock });
        store.run("INSERT INTO fin_events (id, year, seq, no, type, date, status, origin, src_table, method, direction, amount_minor, try_minor, bank_ref, created_by, created_at) VALUES ('ev-ileri-2', ?, ?, ?, 'other_in', ?, 'active', 'manual', '', 'bank', 'in', 500, 500, 'acc-A', 'test', ?)", number.year, number.seq, number.no, day, at);
        store.run("INSERT INTO bank_lines (id, event_id, seq, role, gl, sub, ref, side, try_minor) VALUES ('bl-ileri-3', 'ev-ileri-2', 1, 'bank', '102', '102.01', 'acc-A', 'D', 500), ('bl-ileri-4', 'ev-ileri-2', 2, 'income', '649', '', '', 'C', 500)");
      } });
    } catch (caught) {
      error = caught;
    }
    assert.ok(error, "yeni ileri tarihli fiş engellenmeli");
    assert.ok((error.failures || []).some(item => item.code === "dates:future:fin_events"), JSON.stringify(error.failures || error.message));
  });

  it("taksit kartının carisi değişince taksit tahsilatlarının olay kopyası yenilenir (tam tarama yanlış alarm vermez)", async () => {
    const { api, db, app } = ctx;
    const day = ctx.server.clock.today();
    const first = await must("cari A", api.post("/api/workspace/accounts", { name: "Kart Carisi A", type: "customer", registeredOn: day }));
    const second = await must("cari B", api.post("/api/workspace/accounts", { name: "Kart Carisi B", type: "customer", registeredOn: day }));
    const plan = await must("kart", api.post("/api/workspace/plans", { name: "Cari Değişen Kart", total: "900", mode: "auto", count: 3, firstDue: day, registeredOn: day, accountId: first.id }));
    const entry = await must("tahsilat", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "300", date: day, method: "cash" }));
    const eventId = eventOf(db, "plan_entries", entry.entryId);
    assert.equal(rawGet(db, "SELECT party_id AS p FROM fin_events WHERE id = ?", eventId).p, first.id);
    await must("kartın carisi değişir", api.put(`/api/workspace/plans/${plan.id}`, { accountId: second.id }));
    assert.equal(rawGet(db, "SELECT party_id AS p FROM fin_events WHERE id = ?", eventId).p, second.id, "olay kopyasının carisi yenilenir");
    const result = app.integrity.run({ includeHidden: true });
    assert.ok(!result.failures.some(item => item.code.startsWith("bank:event")), JSON.stringify(result.failures));
  });
});

describe("kapı — görünürlük", () => {
  it("banka kullanılmayan kurulum: Mutabakat Testi denetim listesi banka denetimi içermez; hesap tanımlanınca görünür", async () => {
    const ctx = await boot();
    try {
      await seedBasic(ctx.api);
      const plain = await integrityOk(ctx.api, "banka yok");
      assert.ok(!codesOf(plain).some(bankCode), codesOf(plain).filter(bankCode).join(","));
      insertBankAccount(ctx.db, { id: "acc-g", code: "G-TL", glSub: "102.07" });
      ctx.app.integrity.start();
      const used = await integrityOk(ctx.api, "banka var");
      for (const code of ["bank:event", "money:event", "money:report"]) assert.ok(codesOf(used).includes(code), `${code} görünmeli: ${codesOf(used).filter(bankCode)}`);
      assert.ok(codesOf(used).some(code => code.startsWith("bank:sub:")), "alt hesap mutabakatı görünmeli");
    } finally {
      await ctx.server.close();
    }
  });
});
