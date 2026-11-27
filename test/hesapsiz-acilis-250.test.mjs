// 2.5.0 Ç7a tur 2 — K-14 / K-15 (kural kitabı 3-K: "Hesapsız (Açılıştan Önce) hareket / Devir Kapanışı / Bankaya Geçmiş Say | hareketin tarihi | banka tarafı yerine G | CH
// (tahsilatta); ödemede ters yön" · "Kart Borcuna Aktar (eski kart hareketi) … Açılıştan önceyse 309 yerine G"; KULLANICI KARARI S179 = A, 14.11.2026: "açılıştan önceki hesapsız
// hareket: ilgili yolun en geç açılış tarihi ya da Devir Kapanışı gününden önceyse 519, değilse Hesabı Atanmamış; kovanın ekran bakiyesi aynı satırları düşer").
// docs/erp/C7A-BANKA-TASARIM.md §13.2. Beklenenler testin KENDİ elle hesabı (kitap satırı + karar metni), programın çıktısından değil.
//
// ÇALIŞIYOR MU (sahte saat 08.10.2026; banka hesabı yokken girilmiş cari hareketleri, sonra Ziraat açılışı D = 01.10.2026, 100.000):
//   20.09 havale tahsilat 5.000 · 25.09 havale ödeme 1.000 · 22.09 POS tahsilat 3.000 · 01.10 havale tahsilat 700 · 03.10 havale tahsilat 2.000.
//   1. Havale yolu: 20.09 ve 25.09 açılıştan önce → B 519 5.000 / A 120 · B 120 / A 519 1.000 (102.00'a satır yok); 01.10 (açılış günü — '<', eşit değil) ve 03.10 → 102.00.
//      Mizan: 102 = 100.000 + 2.700 = 102.700; 102.00 = 2.700; 519 = −100.000 + 5.000 − 1.000 = −96.000. POS (giriş) yalnız Devir Kapanışı'yla → 108.00 = 3.000.
//      Kova (Hesabı Atanmamış, Banka Genel Bakış özeti): 102.00 2.700, 108.00 3.000. 519 dökümü "Hesapsız Hareketler (Açılıştan Önce)" 4.000. Mutabakat Testi temiz.
//   2. EN GEÇ açılış: ikinci hesap Garanti açılış 15.10 → 01.10 ve 03.10 da açılıştan önce: 102.00 = 0, 519 = −96.000 − 50.000 + 2.700 = −143.300; kova 0. Garanti pasife →
//      sınır DEĞİŞMEZ (durum fark etmez). Garanti silinir (açılışı ters kaydedilir) → sınır yine 01.10: 102.00 = 2.700.
//   3. Devir Kapanışı (Kurulum Sihirbazı, Ziraat, D = 01.10): D'den önceki POS 3.000 de açılışta → 108.00 = 0; Devir Kapanışı maddesi yevmiyede YOK (B 519 / A 519 netlenir);
//      519 = −96.000 + 3.000 = −93.000 (bağlanan 01.10 + 03.10 Ziraat'e: 102.01 = 102.700). Geri Al → 1'deki hâl birebir.
//   4. K-15: kart hesabı yokken 15.09 kartla ödeme 400 (kurumsal), sonra Şirket Kartı açılış 01.10 borç 1.000 → A 519 400 (108.00 yok); kova 108.00 POS'la aynı (yalnız giriş);
//      Kart Borcuna Aktar havuzu 0 (409 bank-legacy-exceeds). 10.10'dan sonra kartla ödeme kart hesabına (A 309.01).
// NASIL BOZARIM: '<' ↔ '≤' (açılış günü satırı 519'a düşer — 1 kırılır); en geç yerine en erken açılış (2 kırılır); pasif hesabı saymamak (2 kırılır); Devir Kapanışı'nı netlememek
//   (3: yevmiyede madde / 519 iki katı); kovayı düşürmemek (1: kova 6.700); kart ödemesinin yönünü POS sınırına bağlamak (4: 108.00 eksi). Reddedilen istek başarı sayılmaz (ders 3).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOk } from "./banka-210-ortak.mjs";
import { BANK, bootBank, expectStatus, must, openAccount, subBalances, trialBalances } from "./banka-210-hesap-ortak.mjs";

const entries = ctx => ctx.server.app.ledger.build();
const entryOfRow = (ctx, id) => entries(ctx).filter(entry => entry.id === `account:${id}`);
const lineSet = entry => entry.lines.map(line => `${line.account}${line.sub ? `/${line.sub}` : ""}:${line.debit}:${line.credit}`).sort();
const balances = async ctx => ({ trial: await trialBalances(ctx.api), subs: Object.fromEntries(Object.entries(await subBalances(ctx.api)).map(([sub, row]) => [sub, row.balance])) });
const kova = async ctx => (await must("eski", ctx.api.get(`${BANK}/legacy`))).totals;
const matchParts = async ctx => {
  const state = await must("açılış eşleştirme", ctx.api.get(`/api/admin/ledger/opening-match?date=2026-10-08`));
  return Object.fromEntries((state.parts || []).map(part => [part.kind, { label: part.label, minor: part.minor }]));
};

describe("Ç7a K-14 / K-15 — açılıştan önceki hesapsız hareketin karşılığı 519 (S179 = A)", () => {
  let ctx;
  let party;
  let ziraat;
  const row = {};
  const add = async (label, body) => {
    await must(label, ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, body));
    return ctx.store.get("SELECT id FROM account_entries WHERE account_id = ? ORDER BY rowid DESC LIMIT 1", party.id).id;
  };
  before(async () => {
    ctx = await bootBank();
    party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    row.in = await add("20.09 havale", { kind: "in", amount: "5.000", method: "bank", date: "2026-09-20" });
    row.out = await add("25.09 ödeme", { kind: "out", amount: "1.000", method: "bank", date: "2026-09-25" });
    row.pos = await add("22.09 POS", { kind: "in", amount: "3.000", method: "card", date: "2026-09-22" });
    row.day = await add("01.10 havale", { kind: "in", amount: "700", method: "bank", date: "2026-10-01" });
    row.after = await add("03.10 havale", { kind: "in", amount: "2.000", method: "bank", date: "2026-10-03" });
    ziraat = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
  });
  after(() => ctx.server.close());

  it("1. açılıştan önceki havale 519'da, açılış günü ve sonrası 102.00'da; POS yalnız Devir Kapanışı'yla; kova ve 519 dökümü aynı satırları düşer", async () => {
    assert.deepEqual(lineSet(entryOfRow(ctx, row.in)[0]), ["120:0:500000", "519:500000:0"], "20.09 tahsilat B 519 / A 120");
    assert.deepEqual(lineSet(entryOfRow(ctx, row.out)[0]), ["120:100000:0", "519:0:100000"], "25.09 ödeme B 120 / A 519");
    assert.deepEqual(lineSet(entryOfRow(ctx, row.day)[0]), ["102/102.00:70000:0", "120:0:70000"], "açılış günü (01.10) açılıştan SONRA: 102.00");
    assert.deepEqual(lineSet(entryOfRow(ctx, row.after)[0]), ["102/102.00:200000:0", "120:0:200000"]);
    assert.deepEqual(lineSet(entryOfRow(ctx, row.pos)[0]), ["108/108.00:300000:0", "120:0:300000"], "POS tahsilatı (giriş) Devir Kapanışı'na kadar 108.00");
    const { trial, subs } = await balances(ctx);
    assert.equal(trial["102"], 102700);
    assert.equal(subs["102.00"], 2700);
    assert.equal(subs["102.01"], 100000);
    assert.equal(trial["108"], 3000);
    assert.equal(subs["108.00"], 3000);
    assert.equal(trial["519"], -96000);
    assert.deepEqual(await kova(ctx), { bankMinor: 270_000, cardMinor: 300_000 });
    const summary = await must("özet", ctx.api.get(`${BANK}/summary`));
    assert.equal(summary.unassigned.bankMinor, 270_000);
    assert.equal(summary.unassigned.cardMinor, 300_000);
    const parts = await matchParts(ctx);
    assert.deepEqual(parts.unassigned, { label: "Hesapsız Hareketler (Açılıştan Önce)", minor: 400_000 });
    assert.equal(parts.bank.minor, -10_000_000);
    await integrityOk(ctx.api, "açılıştan önceki hesapsız havale");
  });

  it("2. sınır yolun EN GEÇ açılışı; hesabın pasifliği sınırı değiştirmez; silinen hesabın açılışı sayılmaz", async () => {
    const garanti = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "Ticari", kind: "commercial", opening: { date: "2026-10-05", amount: "50.000", confirmed: true } });
    let { trial, subs } = await balances(ctx);
    assert.equal(subs["102.00"] || 0, 0, "01.10 ve 03.10 Garanti'nin açılışından (05.10) önce");
    assert.equal(trial["519"], -96000 - 50000 + 2700);
    assert.deepEqual(await kova(ctx), { bankMinor: 0, cardMinor: 300_000 });
    await integrityOk(ctx.api, "iki hesap");
    await must("pasif", ctx.api.post(`${BANK}/accounts/${garanti.id}/status`, { status: "passive" }));
    ({ subs } = await balances(ctx));
    assert.equal(subs["102.00"] || 0, 0, "pasif hesabın açılışı sınırda kalır");
    await integrityOk(ctx.api, "pasif hesap");
    await must("etkin", ctx.api.post(`${BANK}/accounts/${garanti.id}/status`, { status: "active" }));
    await must("sil", ctx.api.del(`${BANK}/accounts/${garanti.id}`));
    ({ trial, subs } = await balances(ctx));
    assert.equal(subs["102.00"], 2700, "silinen hesabın açılışı ters kaydedildi; sınır yine 01.10");
    assert.equal(trial["519"], -96000);
    await integrityOk(ctx.api, "silinen hesap");
  });

  it("3. Devir Kapanışı: D'den önceki POS da 519'a; kapanış maddesi yevmiyede yok; Geri Al birebir", async () => {
    const before = await balances(ctx);
    const run = await must("sihirbaz", ctx.api.post(`${BANK}/setup`, { accountId: ziraat.id, carryClose: true, assign: "all" }));
    // Geri Al her durumda: eski kodda bu test kırmızıyken sonraki testler Devir Kapanışı'nın kilidine takılmasın, kendi nedenleriyle kırmızı olsunlar (ders 38).
    let undone = false;
    try {
    const carry = ctx.store.get("SELECT id FROM fin_events WHERE type = 'carry_close' AND status = 'active'");
    assert.ok(carry, "Devir Kapanışı yazıldı");
    assert.equal(entries(ctx).filter(entry => entry.id === `bank:${carry.id}`).length, 0, "B 519 / A 519 netlenir, madde yazılmaz");
    assert.deepEqual(lineSet(entryOfRow(ctx, row.pos)[0]), ["120:0:300000", "519:300000:0"], "Devir Kapanışı'ndan önceki POS 519");
    const { trial, subs } = await balances(ctx);
    assert.equal(subs["108.00"] || 0, 0);
    assert.equal(subs["102.00"] || 0, 0);
    assert.equal(subs["102.01"], 102700, "01.10 ve 03.10 Ziraat'e bağlandı");
    assert.equal(trial["519"], -93000);
    assert.deepEqual(await kova(ctx), { bankMinor: 0, cardMinor: 0 });
    await integrityOk(ctx.api, "Devir Kapanışı");
    await must("geri al", ctx.api.post(`${BANK}/setup/${run.id}/undo`, {}));
    undone = true;
    } finally {
      if (!undone) await ctx.api.post(`${BANK}/setup/${run.id}/undo`, {});
    }
    assert.deepEqual(await balances(ctx), before, "Geri Al birebir eski hâl");
    await integrityOk(ctx.api, "Geri Al");
  });

  it("4. K-15: kart hesabından önceki kurumsal kart ödemesi 519'da; Kart Borcuna Aktar havuzu boş; sonraki ödeme kart hesabına", async () => {
    const pay = await add("15.09 kartla ödeme", { kind: "out", amount: "400", method: "card", date: "2026-09-15" });
    assert.deepEqual(lineSet(entryOfRow(ctx, pay)[0]), ["108/108.00:0:40000", "120:40000:0"], "kart hesabı yokken 108.00 (bugünkü gibi)");
    const card = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Şirket Kartı", kind: "card", opening: { date: "2026-10-01", amount: "1.000", confirmed: true } });
    assert.deepEqual(lineSet(entryOfRow(ctx, pay)[0]), ["120:40000:0", "519:0:40000"], "açılıştan önceki kart ödemesi A 519");
    const { trial, subs } = await balances(ctx);
    assert.equal(subs["108.00"], 3000, "108.00'da yalnız POS tahsilatı");
    assert.equal(subs["309.01"], -1000);
    assert.equal(trial["519"], -96000 + 1000 - 400);
    assert.deepEqual(await kova(ctx), { bankMinor: 270_000, cardMinor: 300_000 });
    // Tek aday düzeltme turu (dar kontrol t3c7a DÜŞÜK — N8): Hesabı Atanmamış listesinin rozeti kart yolunda YÖNE bakar — kart ÇIKIŞI (kurumsal kartla ödeme) kart hesabının açılışından
    // önceyse "Açılışta Sayıldı"; aynı yolun GİRİŞİ (POS tahsilatı) yalnız Devir Kapanışı'yla sayılır (K-14 / K-15).
    const listed = Object.fromEntries((await must("eski liste", ctx.api.get(`${BANK}/legacy`))).rows.map(item => [item.date, item.counted]));
    assert.equal(listed["2026-09-15"], true, "15.09 kart çıkışı: rozet var");
    assert.equal(listed["2026-09-22"], false, "22.09 POS girişi: rozet yok (Devir Kapanışı yok)");
    expectStatus(await ctx.api.post(`${BANK}/legacy/reclass`, { mode: "card", accountId: card.id, amount: "400" }), 409, "bank-legacy-exceeds", "açılışta sayılmış ödeme aktarılmaz");
    await integrityOk(ctx.api, "K-15");
    // Kartın limiti tanımlı değil: K7 eksi bakiye sorusu BEKLENEN (409 cash-negative) → "Yine de Kaydet" (cashForce; ders 34: soru nedeniyle yanıtlanır).
    const ask = await ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", amount: "250", method: "card", date: "2026-10-06", bankAccountId: card.id });
    expectStatus(ask, 409, "cash-negative", "kart limiti sorusu");
    const later = await add("06.10 kartla ödeme", { kind: "out", amount: "250", method: "card", date: "2026-10-06", bankAccountId: card.id, cashForce: true });
    assert.deepEqual(lineSet(entryOfRow(ctx, later)[0]), ["120:25000:0", "309/309.01:0:25000"]);
    await integrityOk(ctx.api, "açılıştan sonraki kart ödemesi");
  });

  it("5. kapı: hesap varken 'Hesapsız (Açılıştan Önce)' ile girilen satır yazılır (süzgeçli kapı 409 vermez), 519'a düşer; silinince geri gelir", async () => {
    const before = await balances(ctx);
    const id = await add("hesapsız 10.09", { kind: "in", amount: "1.234,56", method: "bank", date: "2026-09-10", bankAccountId: "none" });
    assert.deepEqual(lineSet(entryOfRow(ctx, id)[0]), ["120:0:123456", "519:123456:0"]);
    const now = await balances(ctx);
    assert.equal(now.trial["519"], before.trial["519"] + 1234.56);
    assert.equal(now.trial["102"], before.trial["102"], "102 değişmez");
    await integrityOk(ctx.api, "hesapsız yeni satır");
    await must("sil", ctx.api.del(`/api/workspace/accounts/${party.id}/entries/${id}`));
    assert.deepEqual(await balances(ctx), before);
    await integrityOk(ctx.api, "hesapsız satır silindi");
  });
});
