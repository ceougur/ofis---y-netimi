// 2.3.0 İz 1 — Şüpheli Ticari Alacaklar (docs/BANKA-MODULU-PLAN.md §3.11b; kâhin: docs/2.3.0-SUPHELI-KABUL.md §2 — sayılar plandan,
// programdan değil). Sahte saat 08.10.2026. HTTP API ile; Ana Defter (/api/workspace/ledger), Mutabakat Testi (/ledger/integrity),
// cari kartı (totals.balance DEĞİŞMEZ), rapor verisi (/api/workspace/doubtful).
//
// ÇALIŞIYOR MU (kabul tablosu, adım 0–4): borç 10.000 → al 4.000 → karşılık 2.500 → tahsilat 3.000 → değersiz 1.000:
//   120 10.000/6.000/6.000/6.000/6.000 · 128 0/4.000/4.000/1.000/0 · 129 0/0/−2.500/−1.000/0 · 644 −1.500 (644 kuralı) · 654 2.500 · 659 0
//   cari bakiyesi 10.000/10.000/10.000/7.000/6.000 · Kasa 0/0/0/3.000/3.000; her adımda Mutabakat Testi tamam, cari bazında 120 + 128 = kart.
// Yan senaryolar: B (karşılıksız değersiz → 659), C (Şüpheliden Çıkar + 644), D (tahsilat şüpheliyi aşınca), E (iki kayıt, en eski önce),
// H (karşılıksız çek kısayolu), K3 (çekle ödeme ve Alacak Yaz da önce şüpheliden düşer), rapor verisi, cari kartı özeti, Yevmiye maddeleri.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { partyBalances } from "../server/lib/general-ledger.mjs";
import { integrityOk, must } from "./banka-210-ortak.mjs";
import { TODAY, bootBank, expectStatus, trialBalances } from "./banka-210-hesap-ortak.mjs";
import { ACC, balanceOf, collect, credit, customer, debt, listOf, provision, release, take, trial, writeOff } from "./banka-230-supheli-ortak.mjs";

const CHEQUES = "/api/workspace/cheques";
/** Cari bazında defter bakiyesi (kuruş): 120 + 128 satırları (lib/general-ledger partyBalances). */
const partyLedger = (ctx, accountId) => partyBalances(ctx.app.ledger.build()).get(accountId) || 0;
const journalIds = ctx => ctx.app.ledger.build().map(entry => entry.id);

describe("Şüpheli Ticari Alacaklar — kabul tablosu (plan §3.11b; sayılar docs/2.3.0-SUPHELI-KABUL.md §2)", () => {
  let ctx;
  let abc;
  let record;
  before(async () => {
    ctx = await bootBank();
    abc = await customer(ctx.api, "ABC Ltd.");
    await debt(ctx.api, abc.id, 10000, "2026-10-01");
  });
  after(() => ctx.server.close());

  it("adım 0: borç 10.000 → 120 = 10.000, 128 = 0, cari 10.000", async () => {
    const gl = await trial(ctx.api);
    assert.equal(gl(120), 10000);
    assert.equal(gl(128), 0);
    assert.equal(await balanceOf(ctx.api, abc.id), 10000);
  });

  it("adım 1: Şüpheli Alacağa Al 4.000 (05.10, Dava) → B 128 / A 120; 128 = 4.000, 120 = 6.000; cari bakiyesi 10.000 DEĞİŞMEZ", async () => {
    const data = await must("şüpheliye al", take(ctx.api, abc.id, { amount: 4000, date: "2026-10-05", reason: "lawsuit", note: "Dava açıldı" }));
    record = data.record;
    assert.ok(record?.id, "kayıt kimliği");
    assert.equal(record.status, "open");
    assert.equal(record.amountMinor, 400000);
    assert.equal(record.remainingMinor, 400000);
    assert.equal(record.reason, "lawsuit");
    assert.equal(record.reasonLabel, "Dava");
    assert.equal(record.date, "2026-10-05");
    assert.match(record.eventNo || "", /^BNK-2026-\d{6}$/, "İşlem No'lu başlık");
    assert.equal(data.summary.openMinor, 400000);
    const gl = await trial(ctx.api);
    assert.equal(gl(128), 4000);
    assert.equal(gl(120), 6000);
    assert.equal(await balanceOf(ctx.api, abc.id), 10000, "cari kartı bakiyesi değişmez");
    assert.equal(partyLedger(ctx, abc.id), 1000000, "cari bazında 120 + 128 = kart");
    const event = ctx.store.get("SELECT * FROM fin_events WHERE type = 'doubtful_take' AND src_id = ?", record.id);
    assert.ok(event, "fin_events doubtful_take");
    assert.deepEqual([event.status, event.src_table, Number(event.try_minor), event.party_id, event.date], ["active", "doubtful_receivables", 400000, abc.id, "2026-10-05"]);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM bank_lines WHERE event_id = ?", event.id).n, 0, "para satırı yok");
    assert.ok(journalIds(ctx).includes(`doubtful-take:${record.id}`), "Yevmiye maddesi doubtful-take");
    const result = await integrityOk(ctx.api, "adım 1");
    for (const code of ["gl:128", "gl:120", "party:accounts", "doubtful:records"]) assert.equal(result.checks.find(item => item.code === code)?.ok, true, `${code} görünür ve tamam`);
  });

  it("adım 2: Karşılık Ayır 2.500 (06.10) → B 654 / A 129; 129 = −2.500, 654 = 2.500; 128 ve cari aynı", async () => {
    const data = await must("karşılık", provision(ctx.api, abc.id, record.id, { amount: 2500, date: "2026-10-06", note: "VUK 323" }));
    assert.equal(data.record.provisionMinor, 250000);
    assert.equal(data.record.provisions.length, 1);
    assert.match(data.record.provisions[0].eventNo || "", /^BNK-2026-\d{6}$/);
    const gl = await trial(ctx.api);
    assert.equal(gl(129), -2500);
    assert.equal(gl(654), 2500);
    assert.equal(gl(128), 4000);
    assert.equal(gl(120), 6000);
    assert.equal(await balanceOf(ctx.api, abc.id), 10000);
    assert.equal((await trialBalances(ctx.api, "?from=2026-10-06&to=2026-10-06"))["654"], 2500, "dönem süzgeci: karşılık gideri 06.10'da");
    await integrityOk(ctx.api, "adım 2");
  });

  it("adım 3: tahsilat 3.000 nakit (07.10) → B 100 / A 128 (önce şüpheliden); 644 kuralı B 129 / A 644 1.500; 128 = 1.000, 129 = −1.000, cari 7.000", async () => {
    await collect(ctx.api, abc.id, 3000, "2026-10-07");
    const gl = await trial(ctx.api);
    assert.equal(gl(100), 3000, "Kasa");
    assert.equal(gl(128), 1000);
    assert.equal(gl(120), 6000, "120 değişmez: tahsilat şüpheliden düştü");
    assert.equal(gl(129), -1000, "karşılık kalan şüpheliye iner");
    assert.equal(gl(644), -1500, "Konusu Kalmayan Karşılıklar");
    assert.equal(gl(654), 2500);
    assert.equal(await balanceOf(ctx.api, abc.id), 7000);
    assert.equal(partyLedger(ctx, abc.id), 700000);
    const view = (await listOf(ctx.api, abc.id)).records.find(item => item.id === record.id);
    assert.equal(view.collectedMinor, 300000);
    assert.equal(view.remainingMinor, 100000);
    assert.equal(view.provisionMinor, 100000);
    assert.equal(view.provisionReleasedMinor, 150000);
    assert.ok(journalIds(ctx).some(id => id.startsWith(`doubtful-644:${record.id}:`)), "644 maddesi tahsilat gününde");
    await integrityOk(ctx.api, "adım 3");
  });

  it("adım 4: Değersiz Alacak Yaz 1.000 (08.10) → B 129 / A 128 (karşılıklı; 659'a 0); 128 = 0, 129 = 0, cari 6.000 (satır cari kartında)", async () => {
    const data = await must("değersiz", writeOff(ctx.api, abc.id, record.id, { amount: 1000, date: TODAY, note: "Kesinleşti" }));
    assert.equal(data.record.remainingMinor, 0);
    assert.equal(data.record.writtenOffMinor, 100000);
    assert.equal(data.record.provisionMinor, 0);
    assert.equal(data.record.writeOffs.length, 1);
    assert.equal(data.record.writeOffs[0].amountMinor, 100000);
    assert.equal(data.record.writeOffs[0].provisionMinor, 100000, "karşılıktan karşılanan");
    assert.equal(data.record.writeOffs[0].lossMinor, 0);
    const gl = await trial(ctx.api);
    assert.equal(gl(128), 0);
    assert.equal(gl(129), 0);
    assert.equal(gl(659), 0, "karşılıklı değersizde zarar yok");
    assert.equal(gl(120), 6000);
    assert.equal(gl(644), -1500);
    assert.equal(gl(654), 2500);
    assert.equal(gl(100), 3000);
    assert.equal(await balanceOf(ctx.api, abc.id), 6000, "cari bakiyesi o tutar kadar kapanır");
    assert.equal(partyLedger(ctx, abc.id), 600000);
    const card = await must("cari kartı", ctx.api.get(`${ACC}/${abc.id}`));
    const line = card.entries.find(item => item.source === "doubtful");
    assert.ok(line, "cari kartında Değersiz Alacak satırı");
    assert.deepEqual([line.kind, line.amount, line.date, line.editable], ["credit", 1000, TODAY, false]);
    assert.equal(card.ledger.find(item => item.id === line.id)?.label, "Değersiz Alacak");
    assert.equal(card.doubtful?.openMinor, 0, "kart özeti: açık şüpheli yok");
    assert.equal(card.doubtful?.writtenOffMinor, 100000);
    // Mizan dengesi (kabul §2): 100 + 120 + 128 + 129 + 644 + 654 + 602 = 0.
    const ledger = await must("mizan", ctx.api.get("/api/workspace/ledger"));
    assert.equal(ledger.trial.balanced, true);
    assert.equal(ledger.trial.totals.difference, 0);
    const result = await integrityOk(ctx.api, "adım 4");
    assert.equal(result.checks.find(item => item.code === "gl:128")?.ok, true);
    assert.equal(result.checks.find(item => item.code === "gl:129")?.ok, true);
    assert.equal(result.checks.find(item => item.code === "doubtful:records")?.ok, true);
  });

  it("kapanmış kayıt: değersiz/karşılık/çıkar 409 doubtful-closed; kayıt listede 'Değersiz Yazıldı'", async () => {
    expectStatus(await writeOff(ctx.api, abc.id, record.id, { amount: 1, date: TODAY }), 409, "doubtful-closed", "kapanmış kayda değersiz");
    expectStatus(await provision(ctx.api, abc.id, record.id, { amount: 1, date: TODAY }), 409, "doubtful-closed", "kapanmış kayda karşılık");
    expectStatus(await release(ctx.api, abc.id, record.id, { date: TODAY }), 409, "doubtful-closed", "kapanmış kaydı çıkar");
    const view = (await listOf(ctx.api, abc.id)).records.find(item => item.id === record.id);
    assert.equal(view.statusLabel, "Değersiz Yazıldı");
  });

  it("rapor verisi (GET /api/workspace/doubtful): cari, neden, tarih, tutar, karşılık, tahsil edilen, değersiz, kalan; toplamlar = satırlar; süzgeç", async () => {
    const report = await must("rapor", ctx.api.get("/api/workspace/doubtful?status=all"));
    const row = report.rows.find(item => item.id === record.id);
    assert.ok(row, "satır var");
    // karşılık: ayrılan 2.500 (provisionAddedMinor); çözülen 1.500 (644), değersizde kullanılan 1.000; bugünkü karşılık 0.
    assert.deepEqual(
      [row.accountName, row.reasonLabel, row.date, row.amountMinor, row.provisionAddedMinor, row.provisionReleasedMinor, row.provisionUsedMinor, row.provisionMinor, row.collectedMinor, row.writtenOffMinor, row.remainingMinor],
      ["ABC Ltd.", "Dava", "2026-10-05", 400000, 250000, 150000, 100000, 0, 300000, 100000, 0],
    );
    assert.equal(report.totals.amountMinor, report.rows.reduce((sum, item) => sum + item.amountMinor, 0));
    assert.equal(report.totals.remainingMinor, report.rows.reduce((sum, item) => sum + item.remainingMinor, 0));
    assert.equal(report.totals.collectedMinor, 300000);
    assert.equal((await must("rapor açık", ctx.api.get("/api/workspace/doubtful?status=open"))).rows.length, 0, "açık kayıt yok");
    assert.equal((await must("rapor dönem", ctx.api.get("/api/workspace/doubtful?from=2026-10-06&to=2026-10-08&status=all"))).rows.length, 0, "05.10 kaydı dönem dışında");
    assert.equal((await must("rapor dönem 2", ctx.api.get("/api/workspace/doubtful?from=2026-10-01&to=2026-10-05&status=all"))).rows.length, 1);
    expectStatus(await ctx.api.get("/api/workspace/doubtful?from=31.12.2026"), 400, undefined, "geçersiz tarih");
  });
});

describe("Şüpheli Ticari Alacaklar — yan senaryolar (kabul §2 B–E, H, K3)", () => {
  let ctx;
  before(async () => {
    ctx = await bootBank();
  });
  after(() => ctx.server.close());

  it("B — karşılıksız değersiz: borç 5.000 → al 5.000 → tahsilat 2.000 → değersiz 3.000: 659 = 3.000, 128 = 0, 129 = 0, cari 0", async () => {
    const xyz = await customer(ctx.api, "XYZ A.Ş.");
    await debt(ctx.api, xyz.id, 5000, "2026-10-01");
    const { record } = await must("al", take(ctx.api, xyz.id, { amount: 5000, date: "2026-10-02", reason: "enforcement" }));
    await collect(ctx.api, xyz.id, 2000, "2026-10-03", "bank");
    let gl = await trial(ctx.api);
    assert.equal(gl(128), 3000);
    const data = await must("değersiz", writeOff(ctx.api, xyz.id, record.id, { amount: 3000, date: "2026-10-04" }));
    assert.equal(data.record.writeOffs[0].lossMinor, 300000);
    assert.equal(data.record.writeOffs[0].provisionMinor, 0);
    gl = await trial(ctx.api);
    assert.equal(gl(659), 3000);
    assert.equal(gl(128), 0);
    assert.equal(gl(129), 0);
    assert.equal(await balanceOf(ctx.api, xyz.id), 0);
    assert.equal(partyLedger(ctx, xyz.id), 0);
    await integrityOk(ctx.api, "B");
  });

  it("C — Şüpheliden Çıkar: borç 8.000 → al 3.000 → karşılık 1.000 → tahsilat 500 → çıkar: B 120 / A 128 2.500, B 129 / A 644 1.000; 120 = 7.500", async () => {
    const klm = await customer(ctx.api, "KLM Ltd.");
    await debt(ctx.api, klm.id, 8000, "2026-10-01");
    const { record } = await must("al", take(ctx.api, klm.id, { amount: 3000, date: "2026-10-06", reason: "other", note: "Ulaşılamıyor" }));
    await must("karşılık", provision(ctx.api, klm.id, record.id, { amount: 1000, date: "2026-10-07" }));
    await collect(ctx.api, klm.id, 500, TODAY);
    let gl = await trial(ctx.api);
    assert.equal(gl(128), 2500);
    assert.equal(gl(129), -1000, "karşılık ≤ kalan: 644 yok");
    const before_ = gl(644);
    const data = await must("çıkar", release(ctx.api, klm.id, record.id, { date: TODAY, note: "Ödeme sözü" }));
    assert.equal(data.record.status, "released");
    assert.equal(data.record.statusLabel, "Şüpheliden Çıkarıldı");
    assert.equal(data.record.releasedMinor, 250000);
    assert.equal(data.record.remainingMinor, 0);
    assert.equal(data.record.provisionMinor, 0);
    assert.equal(data.record.closedDate, TODAY);
    assert.match(data.record.closeEventNo || "", /^BNK-2026-\d{6}$/);
    gl = await trial(ctx.api);
    assert.equal(gl(128), 0);
    assert.equal(gl(129), 0);
    assert.equal(gl(644) - before_, -1000, "konusu kalmayan karşılık 1.000");
    assert.equal(await balanceOf(ctx.api, klm.id), 7500);
    assert.equal(partyLedger(ctx, klm.id), 750000);
    assert.ok(journalIds(ctx).includes(`doubtful-release:${record.id}`));
    // Çıkarıldıktan sonra tahsilat A 120 (şüpheli kalmadı); kalan 0 olan kaydı çıkarmak 409.
    await collect(ctx.api, klm.id, 100, TODAY);
    assert.equal((await trial(ctx.api))(128), 0);
    expectStatus(await release(ctx.api, klm.id, record.id, { date: TODAY }), 409, "doubtful-closed", "ikinci çıkarma");
    await integrityOk(ctx.api, "C");
  });

  it("D — tahsilat şüpheliyi aşınca: al 4.000 → tahsilat 5.000: A 128 4.000 + A 120 1.000; 128 = 0, 120 = 5.000 (tek madde iki alacak satırı)", async () => {
    const d = await customer(ctx.api, "DEF Ltd.");
    await debt(ctx.api, d.id, 10000, "2026-10-01");
    await must("al", take(ctx.api, d.id, { amount: 4000, date: "2026-10-02", reason: "lawsuit" }));
    const { entryId } = await collect(ctx.api, d.id, 5000, "2026-10-03");
    const gl = await trial(ctx.api);
    assert.equal(gl(128), 0);
    assert.equal(await balanceOf(ctx.api, d.id), 5000);
    assert.equal(partyLedger(ctx, d.id), 500000);
    const entry = ctx.app.ledger.build().find(item => item.id === `account:${entryId}`);
    assert.ok(entry, "tahsilat maddesi");
    const credits = entry.lines.filter(line => line.credit > 0).map(line => [line.account, line.credit, line.party]).sort();
    assert.deepEqual(credits, [["120", 100000, d.id], ["128", 400000, d.id]]);
    assert.equal(entry.lines.reduce((sum, line) => sum + line.debit - line.credit, 0), 0, "madde dengede");
    await integrityOk(ctx.api, "D");
  });

  it("E — iki kayıt: al 2.000 (03.10) ve 3.000 (04.10) → tahsilat 2.500 (05.10): en eski önce (kalan 0 ve 2.500); 02.10 tarihli tahsilat şüpheliden düşmez", async () => {
    const e = await customer(ctx.api, "EFG Ltd.");
    await debt(ctx.api, e.id, 10000, "2026-10-01");
    // Kayıt tarihinden ÖNCE tarihli tahsilat (sıra değiştir): şüpheliye dokunmaz (K3 "kayıt tarihinden sonra").
    const first = await must("al 2", take(ctx.api, e.id, { amount: 2000, date: "2026-10-03", reason: "other" }));
    const second = await must("al 3", take(ctx.api, e.id, { amount: 3000, date: "2026-10-04", reason: "other" }));
    await collect(ctx.api, e.id, 1000, "2026-10-02");
    let records = (await listOf(ctx.api, e.id)).records;
    assert.deepEqual(records.map(item => item.remainingMinor), [200000, 300000], "02.10 tahsilatı şüpheliye girmez");
    await collect(ctx.api, e.id, 2500, "2026-10-05");
    records = (await listOf(ctx.api, e.id)).records;
    assert.equal(records.find(item => item.id === first.record.id).remainingMinor, 0);
    assert.equal(records.find(item => item.id === first.record.id).statusLabel, "Tahsil Edildi");
    assert.equal(records.find(item => item.id === second.record.id).remainingMinor, 250000);
    assert.equal((await trial(ctx.api))(128), 2500);
    assert.equal(await balanceOf(ctx.api, e.id), 6500);
    await integrityOk(ctx.api, "E");
  });

  it("H — karşılıksız çek kısayolu: borç 1.000 → çek 1.000 alındı → karşılıksız → al (chequeId): neden Karşılıksız Çek, tutar evraktan; 128 = 1.000, 120 = 0", async () => {
    const h = await customer(ctx.api, "HIJ Ltd.");
    const base = await trial(ctx.api);
    await debt(ctx.api, h.id, 1000, "2026-10-01");
    const cheque = await must("çek al", ctx.api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: 1000, issueDate: "2026-10-02", dueDate: "2026-10-05", serialNo: "SU-1", accountId: h.id, bank: "Akbank" }));
    assert.equal(await balanceOf(ctx.api, h.id), 0);
    expectStatus(await take(ctx.api, h.id, { chequeId: cheque.id, date: "2026-10-03" }), 409, "doubtful-cheque-not-bounced", "portföydeki evrakla kısayol");
    await must("karşılıksız", ctx.api.post(`${CHEQUES}/${cheque.id}/actions`, { action: "bounce", date: "2026-10-06" }));
    assert.equal(await balanceOf(ctx.api, h.id), 1000);
    const data = await must("al", take(ctx.api, h.id, { chequeId: cheque.id, date: "2026-10-06" }));
    assert.equal(data.record.reason, "cheque");
    assert.equal(data.record.reasonLabel, "Karşılıksız Çek");
    assert.equal(data.record.amountMinor, 100000);
    assert.equal(data.record.chequeId, cheque.id);
    assert.equal(data.record.chequeSerialNo, "SU-1");
    const gl = await trial(ctx.api);
    assert.equal(gl(128) - base(128), 1000);
    assert.equal(gl(101) - base(101), 0);
    assert.equal(await balanceOf(ctx.api, h.id), 1000);
    assert.equal(partyLedger(ctx, h.id), 100000);
    assert.equal((await listOf(ctx.api, h.id)).records[0].remainingMinor, 100000);
    await integrityOk(ctx.api, "H");
  });

  it("K3 — çekle ödeme ve Alacak Yaz da önce şüpheliden düşer (B 101 / A 128; B 770 / A 128): 120 eksiye düşmez", async () => {
    const k = await customer(ctx.api, "KLM Çek");
    const base = await trial(ctx.api);
    await debt(ctx.api, k.id, 3000, "2026-10-01");
    await must("al", take(ctx.api, k.id, { amount: 3000, date: "2026-10-02", reason: "lawsuit" }));
    await must("çek al", ctx.api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: 2000, issueDate: "2026-10-03", dueDate: "2026-10-30", serialNo: "SU-2", accountId: k.id, bank: "Akbank" }));
    await credit(ctx.api, k.id, 500, "2026-10-04");
    const gl = await trial(ctx.api);
    assert.equal(gl(128) - base(128), 500);
    assert.equal(gl(101) - base(101), 2000);
    assert.equal((await listOf(ctx.api, k.id)).records[0].collectedMinor, 250000, "çek 2.000 + Alacak Yaz 500 şüpheliden düştü");
    assert.equal(await balanceOf(ctx.api, k.id), 500);
    assert.equal(partyLedger(ctx, k.id), 50000);
    const party120 = ctx.app.ledger.build().flatMap(entry => entry.lines).filter(line => line.account === "120" && line.party === k.id).reduce((sum, line) => sum + line.debit - line.credit, 0);
    assert.equal(party120, 0, "carinin 120 bakiyesi eksiye düşmez (3.000 − 3.000 şüpheli)");
    await integrityOk(ctx.api, "K3");
  });
});
