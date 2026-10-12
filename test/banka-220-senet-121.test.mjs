// 2.2.0 İz 4.2 — Senetler Tekdüzen hesaplarına (docs/BANKA-MODULU-PLAN.md §3.11a; kullanıcı 12.10.2026: "muhasebe mantığı gereği ise onu da
// uygula"). Alınan senet 121 Alacak Senetleri (121.01 Portföydeki Senetler · 121.02 Tahsile Verilen Senetler), verilen senet 321 Borç Senetleri;
// alınan çek 101 (101.01 Portföydeki Çekler · 101.02 Tahsile Verilen Çekler), verilen çek 103 kalır. Ana Defter türetilir: veri göçü yok, tutar
// değişmez, yalnız hesap. Hiçbir Banka Fişi rolünde 121/321 seçilemez (§3.11 rol listesi).
//
// KÂHİN (programın Ana Defter kodundan bağımsız): (1) planın yevmiyesi — §3.11a tablosu ile §3.7 #9/#21 ve §3.14 satırları (101 → 121, 103 → 321
// okunarak) ve senaryonun elle yazılmış kuruşları; (2) ham çek tablosundan SQL toplamı (evrak türü + yön + durum; Ana Defter'i kullanmaz);
// (3) eşdeğerlikte GERÇEK eski kod (v2.1.0 etiketi; yerelde SENET_ESKI_SURUM=<commit> ile başka sürüm, ör. Bankaya Tahsile Ver'li 12b82c2) aynı
// veride: yeni 101 + 121 = eski 101, yeni 103 + 321 = eski 103, öbür her hesap ve mizan toplamı aynı.
//
// ÇALIŞIYOR MU (sayılarla): senet al/ver, çek al/ver; Tahsile Ver (B 121.02 / A 121.01), Bankadan Geri Al (B 121.01 / A 121.02), Tahsil Edildi
//   (B 102.x / A 121.02), tahsili Geri Al, karşılıksız (tahsildeyken; B 120 / A 121.02), verilen senet ödemesi (B 321 / A 102.x), ciro (B 320 /
//   A 121), carisiz senet (B 121 / A 602; karşılıksızı B 770 / A 121), taksite sayılan senet (B 121 / A 120), faturadan gelen alınan ve verilen
//   senet + fatura iptali, sil → geri yükle; Alt Hesap Mizanı, Hesap Planı Mizanı adları, Defter Mutabakatı (gl:121, gl:321), İşlem Kartı,
//   Tahsildeki Çek ve Senetler raporu (101.02 + 121.02).
// NASIL BOZARIM: senet ↔ çek türü düzenlenince hesap geçişi (açık dönemde geçer; tahsildeyken, işlem görmüşken, faturadan gelmişken ve kilitli
//   dönemde 409, hiçbir şey yazılmaz); ham SQL ile kilitli dönemde tür değiştirilince kilit izi yakalar (period-lock); Şirket Verisini Sıfırla;
//   ?hofCompany= (başka şirketin senedi bu şirketin 121'ine girmez); yetkisiz personel 403; Banka Fişi rolünde 121/321 400; eski sürüm verisi
//   (gerçek v2.1.0 kodu, kilitli dönemiyle) yeni kuralla açılınca sahte fark, geri alınan işlem ya da kilit izi farkı yok; gerçek 2.0.26 fikstürü.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { pathToFileURL } from "node:url";
import { lockDigestOf } from "../server/lib/integrity.mjs";
import { FORBIDDEN_GL, assertLines } from "../server/lib/bank/voucher.mjs";
import { ADMIN_PASSWORD, createUser } from "./helpers.mjs";
import { apiOf, integrityOf, integrityOk, rawRun } from "./banka-210-ortak.mjs";
import { BANK, NOW, TODAY, ZIRAAT_IBAN, bootBank, expectStatus, lockPeriod, must, openAccount } from "./banka-210-hesap-ortak.mjs";
import { fixtureExists, readFixture, unpackFixture } from "./guvenilirlik/fikstur.mjs";
import { CURRENT, bootVersion, checkoutTag, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const CHEQUES = "/api/workspace/cheques";
const act = (api, id, body) => api.post(`${CHEQUES}/${id}/actions`, body);
const kurus = value => Math.round(Number(value || 0) * 100);
/** Rapor özetindeki "1.400,00 TL" → kuruş. */
const kurusText = text => {
  const match = /^(-|−)?([\d.]+),(\d{2}) TL$/.exec(String(text ?? "").trim());
  assert.ok(match, `tutar metni okunamadı: ${text}`);
  return (Number(match[2].replace(/\./g, "")) * 100 + Number(match[3])) * (match[1] ? -1 : 1);
};
const count = (store, table, where = "1") => Number(store.get(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).n);
const TABLES = ["cheques", "cheque_events", "cheque_collections", "fin_events", "account_entries", "plan_entries", "cash_entries", "audit_events"];
const snapshot = store => Object.fromEntries(TABLES.map(table => [table, count(store, table)]));

/** Hesap planı mizanı (kuruş): kod → { debit, credit, balance } ve toplamlar. */
async function trialOf(api, query = "") {
  const data = await must("Ana Defter", api.get(`/api/workspace/ledger${query}`));
  const accounts = Object.fromEntries(data.trial.accounts.map(row => [row.code, { debit: kurus(row.debit), credit: kurus(row.credit), balance: kurus(row.balance), name: row.name }]));
  return { data, accounts, gl: code => accounts[code]?.balance || 0, totals: { debit: kurus(data.trial.totals.debit), credit: kurus(data.trial.totals.credit) } };
}
/** Alt Hesap Mizanı (kuruş): alt hesap → bakiye; ana hesaplar. */
async function subsOf(api) {
  const data = await must("Alt Hesap Mizanı", api.get(`${BANK}/sub-trial`));
  return { balance: Object.fromEntries(data.rows.map(row => [row.sub, kurus(row.balance)])), names: Object.fromEntries(data.rows.map(row => [row.sub, row.name])), rows: data.rows, mains: data.mains };
}
/** Evrak hesaplarının durumu (kuruş): ana hesaplar (mizan) + alt hesaplar (Alt Hesap Mizanı). */
async function documents(api) {
  const { gl } = await trialOf(api);
  const { balance } = await subsOf(api);
  return { 101: gl("101"), 121: gl("121"), 103: gl("103"), 321: gl("321"), "101.01": balance["101.01"] || 0, "101.02": balance["101.02"] || 0, "121.01": balance["121.01"] || 0, "121.02": balance["121.02"] || 0 };
}
/**
 * KÂHİN 2 — ham çek tablosundan (Ana Defter'in kodunu kullanmaz): silinmemiş, portföydeki alınan evrak türüne göre (tahsil kaydı bekleyen = 0x.02,
 * kalanı 0x.01) ve ödenecek verilen evrak (eksi).
 */
function oracle(store) {
  const sum = sql => Number(store.get(`SELECT COALESCE(SUM(CAST(ROUND(c.amount * 100) AS INTEGER)), 0) AS n FROM cheques c WHERE c.deleted_at IS NULL AND ${sql}`).n) || 0;
  const pending = "EXISTS (SELECT 1 FROM cheque_collections k WHERE k.cheque_id = c.id AND k.status = 'pending')";
  const has = Boolean(store.get("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'cheque_collections'"));
  const atBank = instrument => (has ? sum(`c.instrument = '${instrument}' AND c.direction = 'in' AND c.status = 'portfolio' AND ${pending}`) : 0);
  const held = instrument => sum(`c.instrument = '${instrument}' AND c.direction = 'in' AND c.status = 'portfolio'`);
  const owed = instrument => -sum(`c.instrument = '${instrument}' AND c.direction = 'out' AND c.status = 'pending'`) || 0; // −0 değil 0
  return {
    101: held("cheque"), 121: held("note"),
    103: owed("cheque"), 321: owed("note"),
    "101.01": held("cheque") - atBank("cheque"), "101.02": atBank("cheque"), "121.01": held("note") - atBank("note"), "121.02": atBank("note"),
  };
}
/** Yevmiye maddesinin satırları: [alt hesap ya da hesap, borç, alacak] (Ana Defter'in kendi kuralıyla; app.ledger.build). */
const linesOf = (ctx, id) => ctx.app.ledger.build().find(entry => entry.id === id)?.lines.map(line => [line.sub || line.account, line.debit, line.credit]) || null;
const entryOf = (store, chequeId, kind) => store.get("SELECT id FROM account_entries WHERE source = 'cheque' AND source_id = ? AND kind = ? ORDER BY rowid DESC LIMIT 1", chequeId, kind)?.id;
const receive = (api, body) => must(`evrak al ${body.serialNo || ""}`, api.post(CHEQUES, { direction: "in", instrument: "note", amount: "1.000", issueDate: "2026-10-05", dueDate: "2026-11-30", ...body }));
const give = (api, body) => must(`evrak ver ${body.serialNo || ""}`, api.post(CHEQUES, { direction: "out", instrument: "note", amount: "900", issueDate: "2026-10-05", dueDate: "2026-12-15", ...body }));
const minorOf = async (api, account) => Number((await must("hesap", api.get(`${BANK}/accounts/${account.id}`))).balanceMinor);
// Hesap kartında Çek Kullan / Senet Kullan (İz 2): Bankaya Tahsile Ver'in hesap uygunluğu evrak türüne bağlanınca da bu hesap seçilebilir.
const openZiraat = api => openAccount(api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: ZIRAAT_IBAN, useCheque: true, useNote: true, opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
const formBody = (card, change) => ({ instrument: card.instrument, amount: String(card.amount).replace(".", ","), dueDate: card.dueDate, issueDate: card.issueDate, serialNo: card.serialNo, bank: card.bank, drawer: card.drawer, note: card.note, accountId: card.accountId || "", direction: card.direction, updatedAt: card.updatedAt, ...change });

async function setup() {
  const ctx = await bootBank();
  const ziraat = await openZiraat(ctx.api);
  const buyer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
  const seller = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "XYZ Tedarik", type: "supplier", registeredOn: "2026-09-01" }));
  return { ctx, ziraat, buyer, seller };
}
/** Mizan dengede, Mutabakat Testi temiz, evrak hesapları = kâhin (ham tablo). */
async function consistent(ctx, label) {
  const trial = await trialOf(ctx.api);
  assert.equal(trial.data.trial.balanced, true, `${label}: mizan dengesiz`);
  assert.equal(trial.totals.debit, trial.totals.credit, `${label}: borç toplamı = alacak toplamı`);
  const result = await integrityOk(ctx.api, label);
  assert.deepEqual(await documents(ctx.api), oracle(ctx.store), `${label}: evrak hesapları ≠ ham çek tablosu`);
  return result;
}

describe("Senet 121 / 321 — çalışıyor mu (sayılarla, planın yevmiyesiyle)", () => {
  let ctx;
  let ziraat;
  let buyer;
  let seller;
  const ids = {};
  before(async () => {
    ({ ctx, ziraat, buyer, seller } = await setup());
  });
  after(() => ctx.server.close());

  it("alınan senet 121.01 (B 121 / A 120), alınan çek 101.01; verilen senet 321 (B 320 / A 321), verilen çek 103; Defter Mutabakatı gl:121 / gl:321", async () => {
    ids.n1 = (await receive(ctx.api, { serialNo: "SN-1", accountId: buyer.id })).id;
    assert.deepEqual(await documents(ctx.api), { 101: 0, 121: 100000, 103: 0, 321: 0, "101.01": 0, "101.02": 0, "121.01": 100000, "121.02": 0 }, "senet 1.000 → 121");
    assert.deepEqual(linesOf(ctx, `account:${entryOf(ctx.store, ids.n1, "credit")}`), [["121.01", 100000, 0], ["120", 0, 100000]], "alış maddesi B 121.01 / A 120");
    ids.c1 = (await receive(ctx.api, { instrument: "cheque", serialNo: "CK-1", accountId: buyer.id, amount: "400" })).id;
    ids.v1 = (await give(ctx.api, { serialNo: "VS-1", accountId: seller.id })).id;
    assert.deepEqual(linesOf(ctx, `account:${entryOf(ctx.store, ids.v1, "debt")}`), [["320", 90000, 0], ["321", 0, 90000]], "veriliş maddesi B 320 / A 321");
    ids.v2 = (await give(ctx.api, { instrument: "cheque", serialNo: "VC-1", accountId: seller.id, amount: "350" })).id;
    assert.deepEqual(await documents(ctx.api), { 101: 40000, 121: 100000, 103: -35000, 321: -90000, "101.01": 40000, "101.02": 0, "121.01": 100000, "121.02": 0 });
    await consistent(ctx, "al / ver");
    const { data } = await trialOf(ctx.api);
    const check = code => data.reconciliation.checks.find(item => item.code === code);
    assert.deepEqual([check("121")?.ledger, check("121")?.subledger, check("121")?.ok], [1000, 1000, true], "Defter Mutabakatı 121");
    assert.deepEqual([check("321")?.ledger, check("321")?.subledger, check("321")?.ok], [-900, -900, true], "Defter Mutabakatı 321");
    assert.deepEqual([check("101")?.ledger, check("103")?.ledger], [400, -350], "çek 101 / 103'te kalır");
  });

  it("Hesap Planı Mizanı ve Alt Hesap Mizanı: Tekdüzen adları (101 Alınan Çekler, 103 Verilen Çekler ve Ödeme Emirleri (−), 121, 321; 121.01/121.02)", async () => {
    const report = await must("Hesap Planı Mizanı", ctx.api.get("/api/workspace/report-center/hesap-mizani?from=2026-01-01&to=2026-12-31"));
    const names = Object.fromEntries(report.rows.map(row => [String(row[0]), row[1]]));
    assert.deepEqual([names["101"], names["103"], names["121"], names["321"]], ["Alınan Çekler", "Verilen Çekler ve Ödeme Emirleri (−)", "Alacak Senetleri", "Borç Senetleri"]);
    await must("tahsile ver", act(ctx.api, ids.n1, { action: "bank-deposit", date: TODAY, bankAccountId: ziraat.id }));
    const subs = await subsOf(ctx.api);
    assert.deepEqual([subs.names["121.01"], subs.names["121.02"], subs.names["101.01"]], ["Portföydeki Senetler", "Tahsile Verilen Senetler", "Portföydeki Çekler"]);
    const main = Object.fromEntries(subs.mains.map(item => [item.account, item]));
    assert.deepEqual([kurus(main["121"]?.balance), kurus(main["121"]?.subTotal), main["121"]?.ok], [100000, 100000, true], "Alt Hesap Mizanı'nda 121 = Σ 121.*");
    assert.deepEqual([kurus(main["101"]?.balance), main["101"]?.ok], [40000, true], "101 = Σ 101.* (yalnız çek)");
    await must("geri al", act(ctx.api, ids.n1, { action: "bank-withdraw", date: TODAY }));
  });

  it("Tahsile Ver B 121.02 / A 121.01; Bankadan Geri Al B 121.01 / A 121.02; 101.0x değişmez; İşlem Kartı adlarıyla; Tahsildeki Çek ve Senetler = 101.02 + 121.02", async () => {
    const data = await must("tahsile ver", act(ctx.api, ids.n1, { action: "bank-deposit", date: TODAY, bankAccountId: ziraat.id }));
    assert.equal(data.deposited, true);
    assert.deepEqual(await documents(ctx.api), { 101: 40000, 121: 100000, 103: -35000, 321: -90000, "101.01": 40000, "101.02": 0, "121.01": 0, "121.02": 100000 });
    const record = ctx.store.get("SELECT id, event_id AS eventId FROM cheque_collections WHERE cheque_id = ? AND status = 'pending'", ids.n1);
    assert.deepEqual(linesOf(ctx, `cheque-deposit:${record.id}`), [["121.02", 100000, 0], ["121.01", 0, 100000]], "verilme B 121.02 / A 121.01");
    const no = ctx.store.get("SELECT no FROM fin_events WHERE id = ?", record.eventId).no;
    const card = await must("İşlem Kartı", ctx.api.get(`${BANK}/events/${no}`));
    assert.deepEqual(card.lines.map(line => [line.gl, line.sub, line.side, line.tryMinor, line.subName]), [["121", "121.02", "D", 100000, "Tahsile Verilen Senetler"], ["121", "121.01", "C", 100000, "Portföydeki Senetler"]]);
    ids.c1deposit = await must("çeki tahsile ver", act(ctx.api, ids.c1, { action: "bank-deposit", date: TODAY, bankAccountId: ziraat.id }));
    const held = await must("Tahsildeki Çek ve Senetler", ctx.api.get("/api/workspace/report-center/tahsildeki-cekler"));
    const summary = Object.fromEntries(held.summary);
    assert.deepEqual([summary["Toplam (101.02 + 121.02)"], summary["Çekler (101.02)"], summary["Senetler (121.02)"]].map(kurusText), [140000, 40000, 100000], JSON.stringify(held.summary));
    await consistent(ctx, "tahsile ver");
    await must("çeki geri al", act(ctx.api, ids.c1, { action: "bank-withdraw", date: TODAY }));
    await must("senedi geri al", act(ctx.api, ids.n1, { action: "bank-withdraw", date: TODAY }));
    assert.deepEqual(linesOf(ctx, `cheque-withdraw:${record.id}`), [["121.01", 100000, 0], ["121.02", 0, 100000]], "geri alma B 121.01 / A 121.02");
    assert.deepEqual(await documents(ctx.api), { 101: 40000, 121: 100000, 103: -35000, 321: -90000, "101.01": 40000, "101.02": 0, "121.01": 100000, "121.02": 0 });
    await consistent(ctx, "geri al");
  });

  it("tahsildeki senet Tahsil Edildi: B 102.01 / A 121.02, Ziraat +1.000; Geri Al → yeniden 121.02; karşılıksız: B 120 / A 121.02, cari yeniden borçlu", async () => {
    await must("tahsile ver", act(ctx.api, ids.n1, { action: "bank-deposit", date: TODAY, bankAccountId: ziraat.id }));
    const bankBefore = await minorOf(ctx.api, ziraat);
    await must("tahsil", act(ctx.api, ids.n1, { action: "collect", date: TODAY }));
    assert.equal(await minorOf(ctx.api, ziraat), bankBefore + 100000, "Ziraat +1.000");
    const collect = ctx.store.get("SELECT id FROM cheque_events WHERE cheque_id = ? AND kind = 'collect'", ids.n1).id;
    assert.deepEqual(linesOf(ctx, `cheque:${collect}`), [[ziraat.glSub, 100000, 0], ["121.02", 0, 100000]], "tahsil B 102.x / A 121.02");
    assert.deepEqual(await documents(ctx.api), { 101: 40000, 121: 0, 103: -35000, 321: -90000, "101.01": 40000, "101.02": 0, "121.01": 0, "121.02": 0 });
    await consistent(ctx, "tahsil");
    await must("tahsili geri al", ctx.api.post(`${CHEQUES}/${ids.n1}/undo`, {}));
    assert.deepEqual(await documents(ctx.api), { 101: 40000, 121: 100000, 103: -35000, 321: -90000, "101.01": 40000, "101.02": 0, "121.01": 0, "121.02": 100000 });
    const partyBefore = kurus((await must("cari", ctx.api.get(`/api/workspace/accounts/${buyer.id}`))).totals.balance);
    await must("karşılıksız", act(ctx.api, ids.n1, { action: "bounce", date: TODAY }));
    assert.deepEqual(linesOf(ctx, `account:${entryOf(ctx.store, ids.n1, "debt")}`), [["120", 100000, 0], ["121.02", 0, 100000]], "karşılıksız B 120 / A 121.02");
    assert.equal(kurus((await must("cari", ctx.api.get(`/api/workspace/accounts/${buyer.id}`))).totals.balance), partyBefore + 100000, "cari yeniden borçlu");
    assert.deepEqual(await documents(ctx.api), { 101: 40000, 121: 0, 103: -35000, 321: -90000, "101.01": 40000, "101.02": 0, "121.01": 0, "121.02": 0 });
    await consistent(ctx, "karşılıksız");
  });

  it("verilen senet ödemesi B 321 / A 102.01 (Ziraat −900); verilen çek ödemesi B 103 / A 102.01; 321 = 0, 103 = 0", async () => {
    const bankBefore = await minorOf(ctx.api, ziraat);
    await must("senet öde", act(ctx.api, ids.v1, { action: "pay", date: TODAY, method: "bank", bankAccountId: ziraat.id }));
    const pay = ctx.store.get("SELECT id FROM cheque_events WHERE cheque_id = ? AND kind = 'pay'", ids.v1).id;
    assert.deepEqual(linesOf(ctx, `cheque:${pay}`), [["321", 90000, 0], [ziraat.glSub, 0, 90000]], "ödeme B 321 / A 102.x");
    await must("çek öde", act(ctx.api, ids.v2, { action: "pay", date: TODAY, method: "bank", bankAccountId: ziraat.id }));
    const payCheque = ctx.store.get("SELECT id FROM cheque_events WHERE cheque_id = ? AND kind = 'pay'", ids.v2).id;
    assert.deepEqual(linesOf(ctx, `cheque:${payCheque}`), [["103", 35000, 0], [ziraat.glSub, 0, 35000]], "çek ödemesi B 103 / A 102.x");
    assert.equal(await minorOf(ctx.api, ziraat), bankBefore - 125000);
    const trial = await trialOf(ctx.api);
    assert.deepEqual([trial.accounts["321"].debit, trial.accounts["321"].credit, trial.gl("321"), trial.gl("103")], [90000, 90000, 0, 0]);
    await consistent(ctx, "ödeme");
  });
});

describe("Senet 121 / 321 — ciro, carisiz, taksit, fatura, iptal, sil → geri yükle", () => {
  let ctx;
  let buyer;
  let seller;
  before(async () => {
    ({ ctx, buyer, seller } = await setup());
  });
  after(() => ctx.server.close());

  it("ciro: B 320 / A 121.01; carisiz senet B 121.01 / A 602 ve karşılıksızı B 770 / A 121.01; taksite sayılan senet B 121.01 / A 120", async () => {
    const n = await receive(ctx.api, { serialNo: "CR-1", accountId: buyer.id, amount: "700" });
    await must("ciro", act(ctx.api, n.id, { action: "endorse", date: TODAY, accountId: seller.id }));
    assert.deepEqual(linesOf(ctx, `account:${ctx.store.get("SELECT id FROM account_entries WHERE source = 'cheque' AND source_id = ? AND account_id = ?", n.id, seller.id).id}`), [["320", 70000, 0], ["121.01", 0, 70000]], "ciro B 320 / A 121");
    const free = await receive(ctx.api, { serialNo: "CS-1", drawer: "Carisiz Kişi", amount: "200" });
    assert.deepEqual(linesOf(ctx, `account:free-in:${free.id}`), [["121.01", 20000, 0], ["602", 0, 20000]], "carisiz senet B 121 / A 602");
    await must("carisiz karşılıksız", act(ctx.api, free.id, { action: "bounce", date: TODAY }));
    assert.deepEqual(linesOf(ctx, `account:free-bounce:${free.id}`), [["770", 20000, 0], ["121.01", 0, 20000]], "carisiz karşılıksız B 770 / A 121");
    const plan = await must("taksit kartı", ctx.api.post("/api/workspace/plans", { name: "ABC Taksit", accountId: buyer.id, total: "900", mode: "auto", count: 1, firstDue: "2026-11-08", registeredOn: "2026-10-01" }));
    const planned = await receive(ctx.api, { serialNo: "TK-1", accountId: buyer.id, planId: plan.id, amount: "900" });
    const entry = ctx.store.get("SELECT id FROM plan_entries WHERE cheque_id = ?", planned.id).id;
    assert.deepEqual(linesOf(ctx, `plan-entry:${entry}`), [["121.01", 90000, 0], ["120", 0, 90000]], "taksit B 121 / A 120");
    assert.deepEqual(await documents(ctx.api), { 101: 0, 121: 90000, 103: 0, 321: 0, "101.01": 0, "101.02": 0, "121.01": 90000, "121.02": 0 });
    await consistent(ctx, "ciro / carisiz / taksit");
  });

  it("faturadan gelen alınan senet 121 (+2.000) ve verilen senet 321 (−450); fatura iptal edilince evrakla birlikte geri", async () => {
    const before_ = await documents(ctx.api);
    const sale = await must("satış", ctx.api.post("/api/workspace/invoices", { kind: "sale", accountId: buyer.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: 2000, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [{ instrument: "note", amount: "2.000", dueDate: "2026-11-20", serialNo: "FS-1", bank: "" }], endorse: [], rest: "open" }, force: true }));
    const purchase = await must("alış", ctx.api.post("/api/workspace/invoices", { kind: "purchase", accountId: seller.id, issueDate: TODAY, number: "AF-1", pricesIncludeVat: true, lines: [{ name: "Malzeme", qty: 1, unitPrice: 450, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [{ instrument: "note", amount: "450", dueDate: "2026-12-20", serialNo: "FV-1", bank: "" }], endorse: [], rest: "open" }, force: true }));
    const now = await documents(ctx.api);
    assert.deepEqual([now["121"] - before_["121"], now["121.01"] - before_["121.01"], now["321"] - before_["321"], now["101"] - before_["101"], now["103"] - before_["103"]], [200000, 200000, -45000, 0, 0]);
    await consistent(ctx, "faturalı senet");
    // Faturadan gelen evrakın türü faturadan değişir (kartta 409 invoice-linked; hiçbir şey yazılmaz).
    const card = await must("kart", ctx.api.get(`${CHEQUES}/${ctx.store.get("SELECT id FROM cheques WHERE invoice_id = ?", sale.id).id}`));
    const counts = snapshot(ctx.store);
    expectStatus(await ctx.api.put(`${CHEQUES}/${card.id}`, formBody(card, { instrument: "cheque" })), 409, "invoice-linked", "faturalı senedin türü");
    assert.deepEqual(snapshot(ctx.store), counts);
    await must("satış iptal", ctx.api.post(`/api/workspace/invoices/${sale.id}/cancel`, { reason: "Senet testi" }));
    await must("alış iptal", ctx.api.post(`/api/workspace/invoices/${purchase.id}/cancel`, { reason: "Senet testi" }));
    assert.deepEqual(await documents(ctx.api), before_, "iptal: 121 / 321 eski hâline döner");
    await consistent(ctx, "fatura iptali");
  });

  it("sil → geri yükle: 121 −300 / +300", async () => {
    const before_ = await documents(ctx.api);
    const n = await receive(ctx.api, { serialNo: "SL-1", accountId: buyer.id, amount: "300" });
    await must("sil", ctx.api.del(`${CHEQUES}/${n.id}`));
    assert.deepEqual(await documents(ctx.api), before_, "silinen senet 121'de yok");
    await must("geri yükle", ctx.api.post("/api/admin/trash/restore", { id: `cheque:${n.id}` }));
    assert.equal((await documents(ctx.api))["121"], before_["121"] + 30000);
    await consistent(ctx, "geri yükle");
  });
});

describe("Senet 121 / 321 — nasıl bozarım: tür düzenleme, kilitli dönem, kilit izi", () => {
  let ctx;
  let ziraat;
  let buyer;
  const ids = {};
  before(async () => {
    ({ ctx, ziraat, buyer } = await setup());
  });
  after(() => ctx.server.close());

  it("açık dönemde senet → çek: 121 −500, 101 +500 (aynı tutar); geri senet; tahsildeyken 409 cheque-deposited; işlem görmüşken 409", async () => {
    const n = await receive(ctx.api, { serialNo: "TR-1", accountId: buyer.id, amount: "500", issueDate: "2026-10-02" });
    ids.n = n.id;
    let card = await must("kart", ctx.api.get(`${CHEQUES}/${n.id}`));
    await must("çeke çevir", ctx.api.put(`${CHEQUES}/${n.id}`, formBody(card, { instrument: "cheque" })));
    assert.deepEqual(await documents(ctx.api), { 101: 50000, 121: 0, 103: 0, 321: 0, "101.01": 50000, "101.02": 0, "121.01": 0, "121.02": 0 });
    await consistent(ctx, "çeke çevrildi");
    card = await must("kart", ctx.api.get(`${CHEQUES}/${n.id}`));
    await must("senede çevir", ctx.api.put(`${CHEQUES}/${n.id}`, formBody(card, { instrument: "note" })));
    assert.deepEqual(await documents(ctx.api), { 101: 0, 121: 50000, 103: 0, 321: 0, "101.01": 0, "101.02": 0, "121.01": 50000, "121.02": 0 });
    await must("tahsile ver", act(ctx.api, n.id, { action: "bank-deposit", date: TODAY, bankAccountId: ziraat.id }));
    card = await must("kart", ctx.api.get(`${CHEQUES}/${n.id}`));
    let counts = snapshot(ctx.store);
    expectStatus(await ctx.api.put(`${CHEQUES}/${n.id}`, formBody(card, { instrument: "cheque" })), 409, "cheque-deposited", "tahsildeki senedin türü");
    assert.deepEqual(snapshot(ctx.store), counts, "hiçbir şey yazılmadı");
    assert.equal((await documents(ctx.api))["121.02"], 50000);
    await must("geri al", act(ctx.api, n.id, { action: "bank-withdraw", date: TODAY }));
    const done = await receive(ctx.api, { serialNo: "TR-2", accountId: buyer.id, amount: "150", issueDate: "2026-10-02" });
    await must("tahsil", act(ctx.api, done.id, { action: "collect", date: TODAY, method: "cash" }));
    card = await must("kart", ctx.api.get(`${CHEQUES}/${done.id}`));
    counts = snapshot(ctx.store);
    const res = await ctx.api.put(`${CHEQUES}/${done.id}`, formBody(card, { instrument: "cheque" }));
    assert.equal(res.status, 409, `tahsil edilmiş senedin türü: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
    assert.deepEqual(snapshot(ctx.store), counts);
    await consistent(ctx, "tür düzenleme");
  });

  it("kilitli dönemde (alış 02.10, kilit 05.10) tür değişikliği 409 period-locked, 121 aynı; ham SQL ile değiştirilirse kilit izi değişir ve Mutabakat Testi 'Kapanmış dönem' der", async () => {
    await lockPeriod(ctx.api, "2026-10-05");
    const before_ = await documents(ctx.api);
    const card = await must("kart", ctx.api.get(`${CHEQUES}/${ids.n}`));
    const counts = snapshot(ctx.store);
    expectStatus(await ctx.api.put(`${CHEQUES}/${ids.n}`, formBody(card, { instrument: "cheque" })), 409, "period-locked", "kilitli dönemde tür");
    assert.deepEqual(snapshot(ctx.store), counts);
    assert.deepEqual(await documents(ctx.api), before_);
    await integrityOk(ctx.api, "kilit sonrası");
    // Kilitli dönemdeki satırın türü Ana Defter'in hesabını (121 ↔ 101) belirler: kilit izinde olmalı (store dışı / eski sürüm / elle değişiklik).
    const digest = lockDigestOf(ctx.store, "2026-10-05");
    rawRun(ctx.db, "UPDATE cheques SET instrument = 'cheque' WHERE id = ?", ids.n);
    assert.notEqual(lockDigestOf(ctx.store, "2026-10-05"), digest, "kilit izi evrak türünü kapsar");
    const result = await integrityOf(ctx.api);
    assert.ok(result.failures.some(item => item.code === "period-lock"), `Mutabakat Testi kapanmış dönemdeki tür değişikliğini görmeli: ${JSON.stringify(result.failures).slice(0, 400)}`);
    rawRun(ctx.db, "UPDATE cheques SET instrument = 'note' WHERE id = ?", ids.n);
    assert.equal(lockDigestOf(ctx.store, "2026-10-05"), digest, "geri alınınca iz aynı");
  });
});

describe("Senet 121 / 321 — şirket ayrımı, yetki, Şirket Verisini Sıfırla, Banka Fişi rolleri", () => {
  let ctx;
  let buyer;
  let seller;
  before(async () => {
    ({ ctx, buyer, seller } = await setup());
  });
  after(() => ctx.server.close());

  it("yetkisiz personel senet giremez (403, hiçbir şey yazılmaz); ?hofCompany=: 002'nin senedi 001'in 121'ine girmez", async () => {
    await receive(ctx.api, { serialNo: "Y-1", accountId: buyer.id, amount: "100" });
    const staff = apiOf(await createUser(ctx.server, ctx.api.client, { username: "personel1", role: "personel" }));
    const counts = snapshot(ctx.store);
    const refused = await staff.post(CHEQUES, { direction: "in", instrument: "note", amount: "50", issueDate: "2026-10-05", dueDate: "2026-11-30", accountId: buyer.id, serialNo: "Y-X" });
    assert.equal(refused.status, 403, `personel: ${refused.status}`);
    assert.deepEqual({ ...snapshot(ctx.store), audit_events: 0 }, { ...counts, audit_events: 0 });
    const second = await must("002", ctx.api.post("/api/companies", { name: "İkinci Şirket", select: false }));
    const q = `?hofCompany=${encodeURIComponent(second.id || second.company?.id)}`;
    const party = await must("002 cari", ctx.api.post(`/api/workspace/accounts${q}`, { name: "002 Müşteri", type: "customer", registeredOn: "2026-09-01" }));
    await must("002 senet", ctx.api.post(`${CHEQUES}${q}`, { direction: "in", instrument: "note", amount: "777", issueDate: "2026-10-05", dueDate: "2026-11-05", accountId: party.id, serialNo: "Y-002" }));
    await must("002 verilen senet", ctx.api.post(`${CHEQUES}${q}`, { direction: "out", instrument: "note", amount: "333", issueDate: "2026-10-05", dueDate: "2026-11-05", serialNo: "Y-002V", drawer: "Lehtar" }));
    assert.equal((await documents(ctx.api))["121"], 10000, "001'de yalnız kendi senedi");
    const other = await trialOf(ctx.api, q);
    assert.deepEqual([other.gl("121"), other.gl("321")], [77700, -33300], "002'nin 121 / 321'i kendi defterinde");
    await consistent(ctx, "şirket ayrımı");
  });

  it("Şirket Verisini Sıfırla: 101 / 121 / 103 / 321 sıfır, Mutabakat Testi temiz; sonra yeni senet yine 121'e", async () => {
    await give(ctx.api, { serialNo: "S-V", accountId: seller.id, amount: "250" });
    await must("sıfırla", ctx.api.post("/api/companies/sirket-001/reset", { mode: "movements", confirm: "001", password: ADMIN_PASSWORD }));
    assert.deepEqual(await documents(ctx.api), { 101: 0, 121: 0, 103: 0, 321: 0, "101.01": 0, "101.02": 0, "121.01": 0, "121.02": 0 });
    await integrityOk(ctx.api, "sıfırlama");
    const fresh = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Yeni Müşteri", type: "customer", registeredOn: "2026-09-01" }));
    await receive(ctx.api, { serialNo: "S-2", accountId: fresh.id, amount: "120" });
    assert.equal((await documents(ctx.api))["121"], 12000);
    await consistent(ctx, "sıfırlama sonrası");
  });

  it("Banka Fişi: hiçbir rolde 121 / 321 seçilemez (§3.11 rol listesi; 400 bank-gl-forbidden); Hesap Eşlemeleri'nde 400", async () => {
    assert.ok(FORBIDDEN_GL.has("121") && FORBIDDEN_GL.has("321"), "yasak listede 121 ve 321");
    for (const [role, gl] of [["expense", "121"], ["income", "321"], ["tax", "321"], ["opening", "121"]]) {
      assert.throws(() => assertLines([{ role, gl, side: "D", tryMinor: 100 }, { role: "bank", gl: "102", side: "C", tryMinor: 100 }]), error => error.status === 400 && error.extra?.code === "bank-gl-forbidden", `${role} → ${gl}`);
    }
    for (const key of ["otherExpense", "otherIncome", "fee"]) {
      const res = await ctx.api.put(`${BANK}/settings`, { values: { gl: { [key]: "121" } } });
      assert.equal(res.status, 400, `${key} = 121: ${res.status}`);
    }
  });
});

// ---------- (a) EŞDEĞERLİK: gerçek eski kodla üretilen veri yeni kuralla ----------
// Eski sürüm (101 = alınan çek + senet, 103 = verilen çek + senet) kendi API'siyle veriyi yazar ve kendi mizanını gösterir; aynı dosya bu dalla
// açılınca: öbür her hesap ve mizan toplamı kuruşu kuruşuna aynı, 101 + 121 = eski 101, 103 + 321 = eski 103; 121 / 321 ham tablodan beklenene eşit;
// eski sürümün dönem kilidi yeni kuralla sahte fark doğurmaz (geri alınan işlem yok, Mutabakat Testi'nde period-lock yok, kilit izi eski sürümün
// izine eşit — kilit izinin 2.2.0'da eklenen evrak türü girdisi sürüme bağlıdır: lockDigestOf(store, kilit, { version: "2.1.0" })).
const OLD = process.env.SENET_ESKI_SURUM || "v2.1.0";
describe(`Senet 121 / 321 — eşdeğerlik: gerçek eski kod (${OLD}) ile aynı veri`, { skip: !tagsAvailable([OLD]) && `${OLD} etiketi yok (git fetch --tags)` }, () => {
  it("eski sürümün verisi yeni kuralla: 101 + 121 = eski 101, 103 + 321 = eski 103, öbür hesaplar ve toplam aynı; kilitli dönem sahte fark vermez", { timeout: 300_000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), "senet-121-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    let old = null;
    let current = null;
    try {
      old = await bootVersion(OLD, { ...dirs, now: NOW });
      const api = await old.login();
      const ok = async (label, promise) => {
        const res = await promise;
        assert.equal(res.status, 200, `${OLD} ${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
        return res.data;
      };
      const buyer = await ok("müşteri", api.post("/api/workspace/accounts", { name: "Eski Müşteri", type: "customer", registeredOn: "2026-09-01" }));
      const seller = await ok("tedarikçi", api.post("/api/workspace/accounts", { name: "Eski Tedarikçi", type: "supplier", registeredOn: "2026-09-01" }));
      const bank = await ok("banka", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: ZIRAAT_IBAN, opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
      const doc = (body, label) => ok(label, api.post(CHEQUES, { dueDate: "2026-12-01", ...body }));
      const action = (id, body, label) => ok(label, api.post(`${CHEQUES}/${id}/actions`, body));
      await doc({ direction: "in", instrument: "note", amount: "1.000", issueDate: "2026-10-02", accountId: buyer.id, serialNo: "E-N1" }, "portföy senet");
      const n2 = await doc({ direction: "in", instrument: "note", amount: "500", issueDate: "2026-10-02", accountId: buyer.id, serialNo: "E-N2" }, "tahsil senet");
      await action(n2.id, { action: "collect", date: "2026-10-07", method: "bank", bankAccountId: bank.id }, "senet tahsil");
      const n3 = await doc({ direction: "in", instrument: "note", amount: "700", issueDate: "2026-10-03", accountId: buyer.id, serialNo: "E-N3" }, "ciro senet");
      await action(n3.id, { action: "endorse", date: "2026-10-07", accountId: seller.id }, "ciro");
      const n4 = await doc({ direction: "in", instrument: "note", amount: "250", issueDate: "2026-10-03", accountId: buyer.id, serialNo: "E-N4" }, "karşılıksız senet");
      await action(n4.id, { action: "bounce", date: "2026-10-07" }, "karşılıksız");
      await doc({ direction: "in", instrument: "note", amount: "200", issueDate: "2026-10-04", drawer: "Carisiz Kişi", serialNo: "E-N5" }, "carisiz senet");
      const n6 = await doc({ direction: "in", instrument: "note", amount: "300", issueDate: "2026-10-04", accountId: buyer.id, serialNo: "E-N6" }, "silinecek senet");
      await ok("sil", api.del(`${CHEQUES}/${n6.id}`));
      const plan = await ok("taksit kartı", api.post("/api/workspace/plans", { name: "Eski Taksit", accountId: buyer.id, total: "900", mode: "auto", count: 1, firstDue: "2026-11-08", registeredOn: "2026-10-01" }));
      await doc({ direction: "in", instrument: "note", amount: "900", issueDate: "2026-10-04", accountId: buyer.id, planId: plan.id, serialNo: "E-N7" }, "taksit senedi");
      await doc({ direction: "out", instrument: "note", amount: "900", issueDate: "2026-10-02", accountId: seller.id, serialNo: "E-V1" }, "verilen senet");
      const v2 = await doc({ direction: "out", instrument: "note", amount: "600", issueDate: "2026-10-02", accountId: seller.id, serialNo: "E-V2" }, "ödenecek senet");
      await action(v2.id, { action: "pay", date: "2026-10-07", method: "bank", bankAccountId: bank.id }, "senet öde");
      await doc({ direction: "in", instrument: "cheque", amount: "400", issueDate: "2026-10-02", accountId: buyer.id, serialNo: "E-C1" }, "portföy çek");
      const c2 = await doc({ direction: "in", instrument: "cheque", amount: "350", issueDate: "2026-10-02", accountId: buyer.id, serialNo: "E-C2" }, "tahsil çek");
      await action(c2.id, { action: "collect", date: "2026-10-07", method: "cash" }, "çek tahsil");
      await doc({ direction: "out", instrument: "cheque", amount: "300", issueDate: "2026-10-03", accountId: seller.id, serialNo: "E-VC" }, "verilen çek");
      await ok("satış (senetli)", api.post("/api/workspace/invoices", { kind: "sale", accountId: buyer.id, issueDate: "2026-10-08", pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: 2000, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [{ instrument: "note", amount: "2.000", dueDate: "2026-11-20", serialNo: "E-FS", bank: "" }], endorse: [], rest: "open" }, force: true }));
      await ok("alış (senetli)", api.post("/api/workspace/invoices", { kind: "purchase", accountId: seller.id, number: "E-AF", issueDate: "2026-10-08", pricesIncludeVat: true, lines: [{ name: "Malzeme", qty: 1, unitPrice: 450, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [{ instrument: "note", amount: "450", dueDate: "2026-12-20", serialNo: "E-FV", bank: "" }], endorse: [], rest: "open" }, force: true }));
      // Bankaya Tahsile Ver'i bilen eski kod (SENET_ESKI_SURUM=12b82c2 gibi): tahsildeki ve tahsil edilmiş senet de. v2.1.0'da bu eylem yok
      // (DENENMEYEN değil: senaryo 2.1.0'ın gerçekten yapabildikleriyle sınırlıdır; 121.02 bu sürümün kendi testlerinde).
      const deposits = OLD !== "v2.1.0";
      if (deposits) {
        const n8 = await doc({ direction: "in", instrument: "note", amount: "800", issueDate: "2026-10-03", accountId: buyer.id, serialNo: "E-N8" }, "tahsildeki senet");
        await action(n8.id, { action: "bank-deposit", date: "2026-10-07", bankAccountId: bank.id }, "senedi tahsile ver");
        const n9 = await doc({ direction: "in", instrument: "note", amount: "650", issueDate: "2026-10-03", accountId: buyer.id, serialNo: "E-N9" }, "tahsil edilen senet");
        await action(n9.id, { action: "bank-deposit", date: "2026-10-06", bankAccountId: bank.id }, "tahsile ver 2");
        await action(n9.id, { action: "collect", date: "2026-10-07" }, "tahsildekini tahsil");
      }
      await ok("dönem kilidi", api.put("/api/admin/period-lock", { lockedUntil: "2026-10-05" }));
      const oldLedger = await ok("eski Ana Defter", api.get("/api/workspace/ledger"));
      assert.equal(oldLedger.reconciliation.ok, true, `${OLD} kendi mutabakatı temiz: ${JSON.stringify(oldLedger.reconciliation.checks.filter(item => !item.ok))}`);
      assert.ok(!oldLedger.trial.accounts.some(row => row.code === "121" || row.code === "321"), `${OLD} 121/321 kullanmaz`);
      const oldTrial = Object.fromEntries(oldLedger.trial.accounts.map(row => [row.code, [kurus(row.debit), kurus(row.credit), kurus(row.balance)]]));
      const oldTotals = [kurus(oldLedger.trial.totals.debit), kurus(oldLedger.trial.totals.credit)];
      const oldIntegrity = await import(pathToFileURL(path.join(checkoutTag(OLD).dir, "server", "lib", "integrity.mjs")).href);
      const oldDigest = oldIntegrity.lockDigestOf(old.app.store, "2026-10-05");
      const oldDigestAll = oldIntegrity.lockDigestOf(old.app.store, "9999-12-31");
      await old.close();
      old = null;

      current = await bootVersion(CURRENT, { ...dirs, now: NOW });
      const store = current.app.store;
      const next = await current.login();
      const ledger = await ok("yeni Ana Defter", next.get("/api/workspace/ledger"));
      const newTrial = Object.fromEntries(ledger.trial.accounts.map(row => [row.code, [kurus(row.debit), kurus(row.credit), kurus(row.balance)]]));
      const add = (a = [0, 0, 0], b = [0, 0, 0]) => a.map((value, index) => value + b[index]);
      assert.deepEqual(add(newTrial["101"], newTrial["121"]), oldTrial["101"], "101 + 121 = eski 101 (borç, alacak, bakiye)");
      assert.deepEqual(add(newTrial["103"], newTrial["321"]), oldTrial["103"], "103 + 321 = eski 103 (borç, alacak, bakiye)");
      const others = trial => Object.fromEntries(Object.entries(trial).filter(([code]) => !["101", "103", "121", "321"].includes(code)));
      assert.deepEqual(others(newTrial), others(oldTrial), "öbür her hesap aynı");
      assert.deepEqual([kurus(ledger.trial.totals.debit), kurus(ledger.trial.totals.credit)], oldTotals, "mizan toplamı aynı");
      assert.equal(ledger.trial.balanced, true);
      // Kâhin 2 (ham tablo): senetler 121 / 321'de, çekler 101 / 103'te.
      const want = oracle(store);
      assert.deepEqual([newTrial["121"]?.[2] ?? 0, newTrial["321"]?.[2] ?? 0, newTrial["101"]?.[2] ?? 0, newTrial["103"]?.[2] ?? 0], [want["121"], want["321"], want["101"], want["103"]], "ham tablo");
      assert.deepEqual([want["121"], want["321"], want["101"], want["103"]], [deposits ? 100000 + 20000 + 90000 + 200000 + 80000 : 100000 + 20000 + 90000 + 200000, -(90000 + 45000), 40000, -30000], "senaryonun elle yazılmış sayıları");
      // Kilitli dönem: sahte fark yok.
      const integrity = await ok("Mutabakat Testi", next.get("/api/workspace/ledger/integrity"));
      assert.equal(integrity.ok, true, `yeni kuralla Mutabakat Testi temiz: ${JSON.stringify(integrity.failures).slice(0, 600)}`);
      assert.equal(count(store, "integrity_log", "action = 'rolled-back'"), 0, "açılışta geri alınan işlem yok");
      assert.equal(lockDigestOf(store, "2026-10-05", { version: "2.1.0" }), oldDigest, "kilit izi (kilit tarihi) eski sürümün iziyle aynı");
      assert.equal(lockDigestOf(store, "9999-12-31", { version: "2.1.0" }), oldDigestAll, "kilit izi (bütün tarihler) eski sürümün iziyle aynı");
      await ok("açık dönemde yeni senet", next.post(CHEQUES, { direction: "in", instrument: "note", amount: "55", issueDate: "2026-10-08", dueDate: "2026-12-01", accountId: buyer.id, serialNo: "Y-N" }));
      await ok("açık dönemde tahsilat", next.post(`/api/workspace/accounts/${buyer.id}/entries`, { kind: "in", amount: "10", method: "cash", date: "2026-10-08" }));
      assert.equal((await ok("son", next.get("/api/workspace/ledger/integrity"))).ok, true);
    } finally {
      await old?.close();
      await current?.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
});

// ---------- (a) EŞDEĞERLİK: gerçek 2.0.26 fikstürü (verilen senedi olan tek fikstür) ----------
describe("Senet 121 / 321 — eşdeğerlik: surum-2.0.26-turler (gerçek 2.0.26 koduyla üretilmiş; verilen ve ödenmiş senet)", () => {
  it("2.0.26'nın kendi ölçüsüyle: 103 + 321 = eski 103, öbür hesaplar ve toplam aynı; 321 borç = alacak = 300", { timeout: 300_000 }, async () => {
    assert.ok(fixtureExists("surum-2.0.26-turler"), "fikstür yok");
    const before_ = readFixture("surum-2.0.26-turler").oncesi;
    const fixture = unpackFixture("surum-2.0.26-turler");
    try {
      const server = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, maxCompanies: 10, now: `${before_.today}T12:00:00+03:00` });
      try {
        const api = await server.login();
        let notes = 0;
        for (const [id, expected] of Object.entries(before_.companies)) {
          assert.equal((await api.post("/api/companies/select", { id })).status, 200);
          const ledger = unwrapLedger(await api.get("/api/workspace/ledger"));
          const parse = rows => Object.fromEntries(rows.map(row => row.split("|")).map(([code, ...values]) => [code, values.map(Number)]));
          const was = parse(expected.trial);
          const now = Object.fromEntries(ledger.trial.accounts.map(row => [row.code, [kurus(row.debit), kurus(row.credit), kurus(row.balance)]]));
          const add = (a = [0, 0, 0], b = [0, 0, 0]) => a.map((value, index) => value + b[index]);
          const label = `${expected.code}`;
          if (was["103"] || now["321"]) assert.deepEqual(add(now["103"], now["321"]), was["103"], `${label}: 103 + 321 = eski 103`);
          if (was["101"] || now["121"]) assert.deepEqual(add(now["101"], now["121"]), was["101"], `${label}: 101 + 121 = eski 101`);
          const others = trial => Object.fromEntries(Object.entries(trial).filter(([code]) => !["101", "103", "121", "321"].includes(code)));
          assert.deepEqual(others(now), others(was), `${label}: öbür hesaplar`);
          assert.deepEqual([kurus(ledger.trial.totals.debit), kurus(ledger.trial.totals.credit), kurus(ledger.trial.totals.difference)], expected.trialTotals, `${label}: toplam`);
          if (now["321"]) {
            notes += 1;
            assert.deepEqual(now["321"], [30000, 30000, 0], `${label}: verilen ve ödenmiş senet 321'de`);
          }
        }
        assert.ok(notes >= 1, "fikstürde verilen senet var (001 ve 002)");
      } finally {
        await server.close();
      }
    } finally {
      fixture.cleanup();
    }
  });
});
const unwrapLedger = response => {
  assert.equal(response.status, 200, JSON.stringify(response.data).slice(0, 300));
  return response.data;
};
