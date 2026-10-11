// 2.1.0 — Aşama 3–4 bağımsız gözden geçirme (GG2): varlık ve yükümlülük göstergeleri, Banka ve POS Hareketleri raporu.
//
// Bulgu (yüksek, doğrulandı): kurumsal kart borcu (309) ve banka kredisi (300) varlık göstergelerine karışıyordu — ANLIK DURUM "Banka / POS",
// Nakit Akış başlangıcı ("Bugünkü Kasa"), Banka ve POS Hareketleri raporu (POS altında kart borcu), Kasa'nın yol bakiyeleri (byMethod) ve Birleşik
// Rapor yanlıştı (kart açılış borcu 5.000 → Banka / POS 95.000; kredi kullanımı 30.000 → nakit akış 95.000).
// Kural: varlık = nakit (100) + banka (102) + POS/Hesabı Atanmamış POS (108); kart (309) ve kredi (300) borçtur, ayrı alanda (debt).
// Bulgu (orta, doğrulandı): rapor Banka Fişi satırlarını (açılış, Devir Kapanışı, ters kayıtlar) dönem giriş/çıkışına katıyor, kaynağı ham
// "bankLine" yazıyor, açıklamasız fişte Açıklama boş kalıyordu. Kural: açılış, Devir Kapanışı ve eski bakiye aktarımı (ve bunların ters kaydı)
// para hareketi değildir — "Açılış ve Devir Düzeltmeleri" satırında; Kaynak "Banka Fişi"; açıklama yoksa işlem türü ve İşlem No.
// Bağımsız beklenen: her adımda testin kendi hesabı (açılış, fiş tutarları) programın beş göstergesiyle karşılaştırılır.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOk } from "./banka-210-ortak.mjs";
import { BANK, bootBank, must, openAccount } from "./banka-210-hesap-ortak.mjs";

const TL = minor => Math.round(minor) / 100;
const report = (api, query = "") => must(`rapor ${query}`, api.get(`/api/workspace/report-center/banka-pos-hareketleri?preset=thisYear${query}`));
const summaryOf = data => Object.fromEntries(data.summary.map(([key, value]) => [key, value]));
const money = text => Number(String(text).replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".")) || 0;

async function indicators(api) {
  const overview = await must("ANLIK DURUM", api.get("/api/workspace/overview"));
  const flow = await must("nakit akış", api.get("/api/workspace/overview/nakit-akisi?preset=thisMonth&table=0"));
  const cash = await must("Kasa (hepsi)", api.get("/api/workspace/cash?method=all"));
  const combined = await must("birleşik", api.get("/api/companies/report"));
  const all = summaryOf(await report(api));
  const pos = summaryOf(await report(api, "&payMethod=card"));
  // Aşama 14 (K10, bilerek güncellendi): ANLIK DURUM kutusu ve Birleşik Rapor "Gerçek Banka" (realBank); Banka ve POS Hareketleri'nde iç hareket
  // (kredi kullanımı, kart borcu ödemesi) Dönem Giriş/Çıkış'a değil Transfer Giriş/Çıkış'a yazılır (§3.4).
  return { bankBox: overview.cash.bank.balance, bankToday: overview.cash.bank.today, flowStart: flow.cashToday, byMethod: cash.byMethod, combined: combined.rows[0].realBank, combinedDebt: combined.rows[0].bankDebt, reportEnd: money(all["Dönem Sonu"]), reportIn: money(all["Dönem Giriş"]), reportOut: money(all["Dönem Çıkış"]), reportTrIn: money(all["Transfer Giriş"]), reportTrOut: money(all["Transfer Çıkış"]), posIn: money(pos["Dönem Giriş"]), posOut: money(pos["Dönem Çıkış"]), posEnd: money(pos["Dönem Sonu"]) };
}

describe("GG2 — kart borcu ve kredi varlık göstergelerine karışmaz", () => {
  let ctx;
  let ziraat;
  let card;
  let loan;
  before(async () => {
    ctx = await bootBank();
    ziraat = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
  });
  after(() => ctx.server.close());

  it("yalnız Ziraat 100.000: beş gösterge 100.000", async () => {
    const now = await indicators(ctx.api);
    assert.equal(now.bankBox, 100000);
    assert.equal(now.flowStart, 100000);
    assert.equal(now.byMethod.bank, 100000);
    assert.equal(now.byMethod.card, 0);
    assert.equal(now.combined, 100000);
    assert.equal(now.reportEnd, 100000);
  });

  it("kurumsal kart açılış borcu 5.000: göstergeler değişmez; POS görünümünde kart borcu yok", async () => {
    card = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Şirket Kartı", kind: "card", creditLimit: "50.000", opening: { date: "2026-10-01", amount: "5.000", confirmed: true } });
    const now = await indicators(ctx.api);
    assert.equal(now.bankBox, 100000, "ANLIK DURUM Banka / POS");
    assert.equal(now.flowStart, 100000, "nakit akış başlangıcı");
    assert.equal(now.byMethod.card, 0, "Kasa byMethod.card (POS)");
    assert.equal(now.combined, 100000, "Birleşik Rapor");
    assert.equal(now.posOut, 0, "POS görünümü: kart borcu çıkış değil");
    assert.equal(now.posEnd, 0);
    const summary = await must("özet", ctx.api.get(`${BANK}/summary`));
    assert.equal(summary.debt.cardMinor, 500_000);
  });

  it("kredi kullanımı 30.000 ve kart borcu ödemesi 2.000: varlık 128.000, borç 33.000", async () => {
    loan = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "Ticari Kredi", kind: "loan", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    await must("kredi kullanımı", ctx.api.post(`${BANK}/vouchers`, { type: "loan_draw", accountId: ziraat.id, loanAccountId: loan.id, amount: "30.000", date: "2026-10-05" }));
    await must("kart ödemesi", ctx.api.post(`${BANK}/vouchers`, { type: "card_payment", accountId: ziraat.id, cardAccountId: card.id, amount: "2.000", date: "2026-10-06" }));
    // Bağımsız beklenen: 102.01 = 100.000 + 30.000 − 2.000; 309 = 5.000 − 2.000; 300 = 30.000.
    const expectedAssets = 100000 + 30000 - 2000;
    const now = await indicators(ctx.api);
    assert.equal(now.bankBox, expectedAssets, "ANLIK DURUM Banka / POS");
    assert.equal(now.flowStart, expectedAssets, "nakit akış başlangıcı (Nakit + Gerçek Banka)");
    assert.equal(now.byMethod.bank, expectedAssets);
    assert.equal(now.byMethod.card, 0);
    assert.equal(now.combined, expectedAssets);
    assert.equal(now.reportEnd, expectedAssets, "rapor Dönem Sonu (hepsi)");
    // Aşama 14 (§3.4): kredi kullanımı ve kart borcu ödemesi iç harekettir — Dönem Giriş/Çıkış 0, Transfer Giriş 30.000 / Çıkış 2.000.
    assert.equal(now.reportIn, 0, "rapor Dönem Giriş: açılış giriş değil; kredi bacağı iç hareket (Transfer Giriş)");
    assert.equal(now.reportOut, 0, "rapor Dönem Çıkış: kart ödemesinin banka bacağı iç hareket (Transfer Çıkış)");
    assert.equal(now.reportTrIn, 30000, "rapor Transfer Giriş: kredi kullanımı");
    assert.equal(now.reportTrOut, 2000, "rapor Transfer Çıkış: kart borcu ödemesi");
    assert.equal(now.combinedDebt, 33000, "Birleşik Rapor Kart ve Kredi Borcu (kart 3.000 + kredi 30.000)");
    assert.equal(now.posIn, 0, "POS görünümünde kart ödemesi yok");
    assert.equal(now.posEnd, 0);
    const summary = await must("özet", ctx.api.get(`${BANK}/summary`));
    assert.equal(summary.realBank.minor, expectedAssets * 100);
    assert.equal(summary.debt.cardMinor, 300_000);
    assert.equal(summary.debt.loanMinor, 3_000_000);
    await integrityOk(ctx.api, "göstergeler");
  });
});

describe("GG2 — Banka ve POS Hareketleri: açılış ve Devir Kapanışı para hareketi değildir; kaynak ve açıklama", () => {
  let ctx;
  before(async () => {
    ctx = await bootBank();
    const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-08-01" }));
    await must("eski havale", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "5.000", method: "bank", date: "2026-09-20" }));
  });
  after(() => ctx.server.close());

  it("sihirbaz → Geri Al → açılış 0 → hesap sil döngüsünden sonra dönem giriş/çıkış değişmez (5.000 / 0)", async () => {
    const base = summaryOf(await report(ctx.api));
    assert.equal(money(base["Dönem Giriş"]), 5000);
    const account = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "A Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
    const opened = summaryOf(await report(ctx.api));
    assert.equal(money(opened["Dönem Giriş"]), 5000, "açılış bakiyesi dönem girişi değildir");
    assert.equal(money(opened["Dönem Sonu"]), 105000, "açılışla bakiye 105.000");
    assert.equal(money(opened["Açılış ve Devir Düzeltmeleri"]), 100000);
    const job = await must("sihirbaz", ctx.api.post(`${BANK}/setup`, { accountId: account.id, carryClose: true, assign: "all" }));
    await must("geri al", ctx.api.post(`${BANK}/setup/${job.id}/undo`, {}));
    await must("açılış 0", ctx.api.post(`${BANK}/accounts/${account.id}/opening`, { date: "2026-10-01", amount: "0", confirmed: true }));
    await must("sil", ctx.api.del(`${BANK}/accounts/${account.id}`));
    const after = summaryOf(await report(ctx.api));
    assert.equal(money(after["Dönem Giriş"]), 5000);
    assert.equal(money(after["Dönem Çıkış"]), 0);
    assert.equal(money(after["Dönem Sonu"]), 5000);
    assert.equal(money(after["Açılış ve Devir Düzeltmeleri"]), 0);
  });

  it("Banka Fişi satırında Kaynak 'Banka Fişi', açıklamasız fişte işlem türü ve İşlem No", async () => {
    const account = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "B Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "10.000", confirmed: true } });
    const fee = await must("masraf", ctx.api.post(`${BANK}/vouchers`, { type: "fee", accountId: account.id, amount: "10,50", feeType: "eft", tax: "bsmv_incl", date: "2026-10-05" }));
    const data = await report(ctx.api);
    const row = data.rows.find(item => String(item[3]).includes(fee.no));
    assert.ok(row, `masraf satırı (${fee.no}) açıklamada İşlem No ile`);
    assert.equal(row[2], "Banka Fişi");
    assert.match(row[3], /Banka Masrafı/);
    assert.ok(!data.rows.some(item => item[2] === "bankLine"), "ham kaynak adı yok");
  });
});
