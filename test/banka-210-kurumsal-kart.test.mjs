// 2.1.0 K2 — Kurumsal kredi kartıyla ödeme kart hesabına (309.NN) bağlanır (bağımsız kâhin + hakem: KART-HESABI-BAGLANMIYOR, YÜKSEK,
// teslime engel). Plan: §3.5 (tablo "Kurumsal Kredi Kartı | card | 309 / 309.NN | Ödemede ve kurumsal karta gelen iadede"; kurallar 1–4),
// §3.7 #3 (cari ödeme kurumsal kart: B 320 / A 309.01), #5 (alış faturası kurumsal kartla), #16 (Kart Borcu Ödemesi B 309.01 / A 102.01),
// §3.9 (K7: "KMH ve kurumsal kart limitine kadar serbest"), §3.10/2 (Benzer İşlem kurumsal kart satırını da kapsar), §3.11 (moneyAccount: card
// + kurumsal kart → 309.NN; bağsız → 108.00), §4.6 (alan belge türüne göre: ödeme/alış → Kurumsal Kart; alıştan iade → kurumsal karta iade,
// 309 düşer; satış/tahsilat → POS, 2.2.0), §8.4 (Kart ve Kredi Borcu = Σ 309 + Σ 300), §8.9, §9.2/3–4 (bankadan çıkış ve bağlı satırın parası
// bank.move), §12.4 "Bağ" (yanlış türde hesap bağlama reddedilir).
//
// Kök neden (HEAD, koddan): server/lib/bank/module-ref.mjs pickRef `if (String(method || "") !== "bank") return "";` — kart yolunda
// bankAccountId hiç okunmuyor, denetlenmiyor; satır 108.00 "Hesabı Atanmamış"a düşüyor.
//
// NASIL BOZARIM (önce yazıldı; testler buradan; her maddenin testi adında [Kn]):
//   K1  Hiç kurumsal kart yok: kartla ödeme eski davranış (108.00, fin_ref ''), 200; bank.move istenmez (plan §3.5/1).
//   K2  Hiç kurumsal kart yokken kart yolunda vadesiz hesap verilir (hakem tohum 1 adım 272) → 400 bank-account-invalid, yazılmaz.
//   K3  Tek kurumsal kart: hesapsız kart ödemesi kendiliğinden o karta (§3.5/3) → 309.01; 108.00 değişmez.
//   K4  İki kurumsal kart: hesapsız → 400 bank-account-required (alan bankAccountId); seçilen karta yazılır.
//   K5  Kart yolunda yanlış tür: vadeli, kredi → 400 bank-account-invalid; bilinmeyen kimlik → 404; havale yolunda kart hesabı → 400.
//   K6  Pasif kart verilirse 400; tek etkin kart kalınca hesapsız ödeme ona gider; pasif kartta silme ve geri yükleme 400 bank-account-passive.
//   K7  Kart limiti (Bakiye Doğrulandı, Uyar): tam sınır 200; 1 kuruş aşan 409; "Yine de Kaydet" 200; Engelle'de onayla da 409.
//   K8  Aynı anda iki ödeme limitte: biri 200, öbürü 409 (BEGIN IMMEDIATE; ikisi birden geçip limiti delmez).
//   K9  Düzelt: tutar artışı limiti aşar → 409; hesap taşıma KK → KK2 (K7 KK2'de); yol değişimi kart ↔ havale ↔ nakit.
//   K10 Kart tanımlanmadan girilmiş bağsız kart satırı: yalnız açıklama → bağsız kalır; tutar değişirse kart seçimi istenir (§3.5/4).
//   K11 Sil → geri yükle: bağ korunur (KK), limit (K7) yeniden denetlenir; pasif kartta 400.
//   K12 Eşleşmiş satır: düzelt/sil 409 bank-reconciled.
//   K13 Kart Borcu Ödemesi sonrası kart 0 (ters bakiye yok); Ters Kaydet kart borcunu geri getirir (K7 kartta sorulur).
//   K14 Eski veride Hesabı Atanmamış kart satırı → "Kart Borcuna Aktar" çalışır; yeni bağlı satırlar havuza girmez.
//   K15 POS tahsilatı ve POS iadesi DEĞİŞMEZ (cari tahsilat, satış peşini, satıştan iade, stok satış/müşteri iadesi, taksit, kayıt tahsilatı):
//       108.00, fin_ref ''; POS yolunda hesap kimliği verilirse 400 bank-account-invalid (bağ yok, yanlış türde bağ reddedilir).
//   K16 Yetki: bank.move'suz muhasebe kart tanımlıyken kartla ödeme → 403 bank-permission; kart yokken bugünkü gibi 200.
//   K17 Alış faturası: iki kartta seçimsiz 400 (alan satırın hesabı), Düzenle'de KK → KK2, alıştan iade kurumsal karta (309 düşer), iptal.
//   K18 Stok peşin alım kartla → kurumsal kart.
//   K19 Benzer İşlem (aynı gün, aynı kart, aynı cari, aynı tutar) → 409 bank-similar; similarOk geçer. İstek kimliği → tek satır.
//   K20 Kartın açılışından önceki tarih → 409 bank-before-opening.
//   K21 Raporlar: Kart ve Kredi Borcu (Banka Genel Bakış, ANLIK DURUM, Banka Bakiye Raporu), Alt Hesap Mizanı 309.01, Hesap Planı Mizanı 309;
//       Banka ve POS Hareketleri'nde kart ödemesi POS gibi görünmez; Hesabı Atanmamış 0.
// Her bölümün sonunda Mutabakat Testi (Ana Defter kapısı) tutarlı.
//
// Bağımsız beklenen: hakemin elle hesabı (docs/kanit/2026-10-10/kahin/hakem-hukumleri.json → KART-HESABI-BAGLANMIYOR "correct"; A ve B
// modelleriyle kuruşu kuruşuna aynı) ve testin kendi toplamları (her adımda elle; programdan okunmaz).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { apiOf, integrityOk, unwrap } from "./banka-210-ortak.mjs";
import { BANK, NOW, TODAY, bootBank, expectStatus, must, openAccount, subBalances, trialBalances } from "./banka-210-hesap-ortak.mjs";

const INV = "/api/workspace/invoices";
const entries = id => `/api/workspace/accounts/${id}/entries`;
// K5 (başka iz) bankanın eksi bakiye ret kodunu plan §7'deki adlara (cash-negative / cash-blocked) çevirebilir: iki ad da kabul; geçiş bayrağı
// ikisi birden gönderilir (negativeOk ve cashForce).
const NEGATIVE = ["bank-negative", "cash-negative"];
const BLOCKED = ["bank-blocked", "cash-blocked"];
const FORCE = { negativeOk: true, cashForce: true };
const FORCE_QUERY = "negativeOk=1&cashForce=1";
function expectNegative(res, codes, label, accountId = "") {
  assert.equal(res.status, 409, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  assert.ok(codes.includes(res.code), `${label}: kod ${res.code} (${res.error || ""})`);
  if (accountId) assert.equal(res.data?.accountId, accountId, `${label}: hesap ${res.data?.accountId}`);
}
const balanceOf = async (api, account) => (await must(`hesap ${account.label}`, api.get(`${BANK}/accounts/${account.id}`))).balanceMinor;
const entryRow = (store, id) => store.get("SELECT kind, amount, method, fin_ref AS finRef, event_id AS eventId FROM account_entries WHERE id = ?", id);
const entryCount = (store, accountId) => store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", accountId).n;
const pay = (api, party, body) => api.post(entries(party.id), { kind: "out", method: "card", date: TODAY, ...body });
const openCard = (api, name, { limit = "0", confirmed = false, date = "2026-10-01", bankName = "Garanti BBVA" } = {}) =>
  openAccount(api, { bankName, name, kind: "card", creditLimit: limit, opening: { date, amount: "0", confirmed } });
const openDemand = (api, name, amount, { confirmed = true, bankName = "Akbank" } = {}) =>
  openAccount(api, { bankName, name, kind: "demand", currency: "TRY", opening: { date: "2026-10-01", amount, confirmed } });
const setStatus = (api, account, status) => must(`durum ${status}`, api.post(`${BANK}/accounts/${account.id}/status`, { status }));
const setPolicy = (api, account, policy) => must(`politika ${policy}`, api.put(`${BANK}/accounts/${account.id}`, { negativePolicy: policy }));
async function noBankMoveAccountant(ctx, username) {
  const api = apiOf(await createUser(ctx.server, ctx.api.client, { username, role: "muhasebe" }));
  const users = await must("kullanıcılar", ctx.api.get("/api/admin/users"));
  const target = users.find(user => user.username === username);
  assert.equal((await ctx.api.client.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove: ["bank.move"] } })).status, 200);
  return api;
}
async function restoreLast(api, kind, ref, extra = {}) {
  const trash = await must("Silinenler", api.get("/api/admin/trash"));
  const list = trash.items || trash.rows || trash;
  const item = list.find(entry => entry.kind === kind && entry.ref === ref && !entry.restoredAt);
  assert.ok(item, `Silinenler'de ${kind} ${ref}`);
  return api.post("/api/admin/trash/restore", { id: item.id, ...extra });
}
const reportOf = (api, id, query) => must(`rapor ${id}`, api.get(`/api/workspace/report-center/${id}?${new URLSearchParams(query)}`));
const summaryValue = (rep, label) => rep.summary.find(([key]) => key === label)?.[1];

describe("K2 · hakemin en küçük senaryosu (birebir sayılar; kâhin A = B)", () => {
  let ctx;
  let c25;
  let b1;
  let kk;
  let f1;
  before(async () => {
    ctx = await bootBank();
    c25 = await must("C25", ctx.api.post("/api/workspace/accounts", { name: "Bereket Lojistik Ltd. C25", type: "supplier", registeredOn: "2026-10-01" }));
    b1 = await openDemand(ctx.api, "Ana TL Hesabı B1", "86.386,39");
  });
  after(() => ctx.server.close());

  it("[K2] adım 272: kurumsal kart yokken kart yolunda vadesiz B1 → 400 bank-account-invalid; hiçbir satır yazılmaz", async () => {
    const res = await pay(ctx.api, c25, { amount: "579", bankAccountId: b1.id });
    expectStatus(res, 400, "bank-account-invalid", "kart yolunda vadesiz hesap");
    assert.equal(entryCount(ctx.store, c25.id), 0, "satır yazılmadı");
  });

  it("[K3][K17] k1–k4: kart açılır; 100 (KK verilerek), alış faturası 240 peşin kartla (KK), 50 hesapsız (tek kart) → hepsi KK'ya bağlı", async () => {
    kk = await openCard(ctx.api, "Kurumsal Kart KK", { limit: "20.000" });
    const k2 = await must("k2", pay(ctx.api, c25, { amount: "100", bankAccountId: kk.id }));
    assert.deepEqual([entryRow(ctx.store, k2.entryId).method, entryRow(ctx.store, k2.entryId).finRef], ["card", kk.id], "k2 KK'ya bağlı");
    f1 = await must("k3 alış faturası", ctx.api.post(INV, { kind: "purchase", accountId: c25.id, number: "F1", issueDate: TODAY, pricesIncludeVat: false, lines: [{ name: "Bakım", qty: 1, unitPrice: 200, discountRate: 0, vatRate: 20, expenseCode: "repair" }], payment: { cash: [{ amount: "240", method: "card", bankAccountId: kk.id, lineKey: "p1" }], cheques: [], endorse: [], rest: "open" }, force: true }));
    const cashRow = ctx.store.get("SELECT kind, amount, method, fin_ref AS finRef FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'out'", f1.id);
    assert.deepEqual([cashRow.method, cashRow.amount, cashRow.finRef], ["card", 240, kk.id], "faturanın peşin satırı KK'ya bağlı");
    const k4 = await must("k4", pay(ctx.api, c25, { amount: "50" }));
    assert.equal(entryRow(ctx.store, k4.entryId).finRef, kk.id, "k4 tek kart: kendiliğinden KK");
  });

  it("[K21] sayılar (elle): 309.01 alacak 390 · KK −390 · 108.00 = 0 · 320 +150 · 191 = 40 · 770 = 200 · Kart ve Kredi Borcu 390 · Hesabı Atanmamış 0", async () => {
    assert.equal(await balanceOf(ctx.api, kk), -39_000, "KK hesap kartı −390,00");
    assert.equal(await balanceOf(ctx.api, b1), 8_638_639, "B1 değişmez");
    const subs = await subBalances(ctx.api);
    assert.equal(subs[kk.glSub]?.balance, -390, `Alt Hesap Mizanı ${kk.glSub}`);
    assert.equal(subs[kk.glSub]?.credit, 390, "309.01 alacak 390");
    assert.equal(subs["108.00"]?.balance || 0, 0, "108.00 sıfır");
    const trial = await trialBalances(ctx.api);
    assert.equal(trial["309"], -390, "309");
    assert.equal(trial["108"] || 0, 0, "108");
    assert.equal(trial["320"], 150, "320 net borç 150 (tedarikçiye avans)");
    assert.equal(trial["191"], 40, "191 KDV 40");
    assert.equal(trial["770"], 200, "770 gider 200");
    assert.equal(trial["102"], 86386.39, "102");
    const summary = await must("Banka Genel Bakış", ctx.api.get(`${BANK}/summary`));
    assert.equal(summary.debt.cardMinor, 39_000, "Kart ve Kredi Borcu 390");
    assert.equal(summary.unassigned.totalMinor, 0, "Hesabı Atanmamış 0");
    assert.equal(summary.realBank.minor, 8_638_639, "Gerçek Banka");
    const overview = await must("ANLIK DURUM", ctx.api.get("/api/workspace/overview"));
    assert.equal(overview.cash.bank.debt.card, 390, "ANLIK DURUM Kart ve Kredi Borcu");
    assert.equal(overview.cash.bank.unassigned.total, 0, "ANLIK DURUM Hesabı Atanmamış");
    const party = await must("C25", ctx.api.get(`/api/workspace/accounts/${c25.id}`));
    assert.equal(party.totals.balance, 150, "C25 +150");
    const doc = await must("F1", ctx.api.get(`${INV}/${f1.id}`));
    assert.equal(doc.open, 0, "F1 açığı 0");
    await integrityOk(ctx.api, "en küçük senaryo");
  });

  it("[K21] raporlar: Banka Bakiye (Kart ve Kredi Borcu) KK satırı Çıkış 390 / Dönem Sonu −390; Banka ve POS Hareketleri'nde kart ödemesi yok; mizan raporları 309", async () => {
    const range = { from: "2026-10-01", to: TODAY };
    const bakiye = await reportOf(ctx.api, "banka-bakiye", { ...range, bankGroup: "debt" });
    const row = bakiye.rows.find(cells => cells[3] === kk.glSub);
    assert.ok(row, "Banka Bakiye'de KK satırı");
    assert.equal(row[bakiye.headers.indexOf("Çıkış")], "390,00 TL", "KK Çıkış");
    assert.equal(row[bakiye.headers.indexOf("Dönem Sonu")], "-390,00 TL", "KK Dönem Sonu");
    assert.equal(summaryValue(bakiye, "Kart ve Kredi Borcu"), "390,00 TL", "Kart ve Kredi Borcu");
    const pos = await reportOf(ctx.api, "banka-pos-hareketleri", { ...range, payMethod: "card" });
    assert.equal(pos.total, 1, "POS / Kredi Kartı görünümünde yalnız devir satırı (kart ödemesi POS değildir)");
    assert.equal(summaryValue(pos, "POS / Kredi Kartı (tüm hareketler)"), "0,00 TL");
    const sub = await reportOf(ctx.api, "alt-hesap-mizani", range);
    const subRow = sub.rows.find(cells => cells[0] === kk.glSub);
    assert.ok(subRow, "Alt Hesap Mizanı raporunda 309.01");
    assert.deepEqual([subRow[6], subRow[7]], ["390,00 TL", "Alacak"], "309.01 390 Alacak");
    assert.ok(!sub.rows.some(cells => cells[0] === "108.00"), "108.00 satırı yok");
    const mizan = await reportOf(ctx.api, "hesap-mizani", range);
    const m309 = mizan.rows.find(cells => cells[0] === "309");
    assert.deepEqual([m309?.[5], m309?.[6]], ["390,00 TL", "Alacak"], "Hesap Planı Mizanı 309");
    assert.ok(!mizan.rows.some(cells => cells[0] === "108"), "Hesap Planı Mizanı'nda 108 yok");
  });
});

describe("K2 · hakemin tanı senaryosu: Kart Borcu Ödemesi, kart limiti, iki kart", () => {
  let ctx;
  let c25;
  let b1;
  let kk;
  let kk2;
  let repayment;
  before(async () => {
    ctx = await bootBank();
    c25 = await must("C25", ctx.api.post("/api/workspace/accounts", { name: "Bereket Lojistik Ltd. C25", type: "supplier", registeredOn: "2026-10-01" }));
    b1 = await openDemand(ctx.api, "Ana TL Hesabı B1", "86.386,39");
    kk = await openCard(ctx.api, "Kurumsal Kart KK", { limit: "20.000", confirmed: true });
  });
  after(() => ctx.server.close());

  it("[K13] 100 kartla ödeme → KK −100; Kart Borcu Ödemesi (B1 → KK) 100 → KK 0 (ters bakiye yok), B1 86.286,39, 309.01 0", async () => {
    await must("k2", pay(ctx.api, c25, { amount: "100", bankAccountId: kk.id }));
    assert.equal(await balanceOf(ctx.api, kk), -10_000);
    repayment = await must("Kart Borcu Ödemesi", ctx.api.post(`${BANK}/vouchers`, { type: "card_payment", accountId: b1.id, cardAccountId: kk.id, amount: "100", date: TODAY }));
    assert.equal(await balanceOf(ctx.api, kk), 0, "KK 0");
    assert.equal(await balanceOf(ctx.api, b1), 8_628_639, "B1 86.286,39");
    const subs = await subBalances(ctx.api);
    assert.equal(subs[kk.glSub]?.balance || 0, 0, "309.01 sıfır");
    assert.equal(subs["108.00"]?.balance || 0, 0, "108.00 sıfır");
    await integrityOk(ctx.api, "kart borcu ödendi");
  });

  it("[K7] limit 20.000: 25.000 → 409 (kart limiti); tam 20.000 → 200; 0,01 fazlası 409; Yine de Kaydet 200; Engelle'de onayla da 409", async () => {
    const before = entryCount(ctx.store, c25.id);
    expectNegative(await pay(ctx.api, c25, { amount: "25.000", bankAccountId: kk.id }), NEGATIVE, "limit aşan 25.000", kk.id);
    assert.equal(entryCount(ctx.store, c25.id), before, "yazılmadı");
    await must("tam sınır 20.000", pay(ctx.api, c25, { amount: "20.000", bankAccountId: kk.id, similarOk: true }));
    assert.equal(await balanceOf(ctx.api, kk), -2_000_000, "KK −20.000 (limitle 0)");
    expectNegative(await pay(ctx.api, c25, { amount: "0,01", bankAccountId: kk.id }), NEGATIVE, "1 kuruş aşan", kk.id);
    await must("Yine de Kaydet", pay(ctx.api, c25, { amount: "0,01", bankAccountId: kk.id, ...FORCE }));
    assert.equal(await balanceOf(ctx.api, kk), -2_000_001);
    await setPolicy(ctx.api, kk, "block");
    expectNegative(await pay(ctx.api, c25, { amount: "1", bankAccountId: kk.id, ...FORCE }), BLOCKED, "Engelle", kk.id);
    await setPolicy(ctx.api, kk, "warn");
    assert.equal(await balanceOf(ctx.api, kk), -2_000_001, "Engelle'de yazılmadı");
  });

  it("[K13][K7] Kart Borcu Ödemesi Ters Kaydet: kart borcu geri gelir; limit aşılıyorsa kartta sorulur (Yine de Kaydet ile)", async () => {
    expectNegative(await ctx.api.post(`${BANK}/events/${encodeURIComponent(repayment.id)}/reverse`, { reason: "Hatalı" }), NEGATIVE, "ters kayıt limiti aşar", kk.id);
    await must("ters kayıt", ctx.api.post(`${BANK}/events/${encodeURIComponent(repayment.id)}/reverse`, { reason: "Hatalı", ...FORCE }));
    assert.equal(await balanceOf(ctx.api, kk), -2_010_001, "KK −20.100,01");
    assert.equal(await balanceOf(ctx.api, b1), 8_638_639, "B1 geri 86.386,39");
    await integrityOk(ctx.api, "ters kayıt");
  });

  it("[K4] ikinci kurumsal kart (KK2): hesapsız kart ödemesi → 400 bank-account-required (alan bankAccountId); KK2 verilince KK2'ye", async () => {
    kk2 = await openCard(ctx.api, "Kurumsal Kart KK2", { limit: "5.000", bankName: "Yapı Kredi" });
    const before = entryCount(ctx.store, c25.id);
    const res = await pay(ctx.api, c25, { amount: "10" });
    expectStatus(res, 400, "bank-account-required", "iki kartta seçimsiz");
    assert.equal(res.data?.field, "bankAccountId");
    assert.equal(entryCount(ctx.store, c25.id), before, "yazılmadı");
    const done = await must("KK2", pay(ctx.api, c25, { amount: "10", bankAccountId: kk2.id }));
    assert.equal(entryRow(ctx.store, done.entryId).finRef, kk2.id);
    assert.equal(await balanceOf(ctx.api, kk2), -1_000);
    const summary = await must("Banka Genel Bakış", ctx.api.get(`${BANK}/summary`));
    assert.equal(summary.debt.cardMinor, 2_011_001, "Kart ve Kredi Borcu 20.100,01 + 10");
    assert.equal(summary.unassigned.totalMinor, 0);
    await integrityOk(ctx.api, "iki kart");
  });
});

describe("K2 · kart yokken, yanlış tür, pasif kart, POS yolu ve yetki", () => {
  let ctx;
  let party;
  let customer;
  let b1;
  let kk;
  let kk2;
  let clerk;
  before(async () => {
    ctx = await bootBank();
    party = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "XYZ Tedarik", type: "supplier", registeredOn: "2026-10-01" }));
    customer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
    b1 = await openDemand(ctx.api, "Ana TL Hesabı", "10.000");
    clerk = await noBankMoveAccountant(ctx, "muhasebe-kart");
  });
  after(() => ctx.server.close());

  it("[K1][K16] kart yokken: hesapsız kartla ödeme 108.00'a (fin_ref ''); bank.move'suz muhasebe de öder (bugünkü gibi)", async () => {
    const done = await must("kart yok", pay(ctx.api, party, { amount: "75" }));
    assert.equal(entryRow(ctx.store, done.entryId).finRef, "");
    await must("bank.move'suz, kart yok", pay(clerk, party, { amount: "25" }));
    const subs = await subBalances(ctx.api);
    assert.equal(subs["108.00"]?.balance, -100, "108.00 −100 (hesabı atanmamış kart ödemeleri)");
  });

  it("[K5] kart yolunda vadeli ya da kredi hesabı → 400 bank-account-invalid; bilinmeyen kimlik → 404; havale yolunda kart hesabı → 400", async () => {
    const time = await openAccount(ctx.api, { bankName: "Akbank", name: "Vadeli", kind: "time", currency: "TRY", opening: { date: "2026-10-01", amount: "0" } });
    const loan = await openAccount(ctx.api, { bankName: "Akbank", name: "Kredi", kind: "loan", opening: { date: "2026-10-01", amount: "0" } });
    kk = await openCard(ctx.api, "Kurumsal Kart KK");
    const before = entryCount(ctx.store, party.id);
    expectStatus(await pay(ctx.api, party, { amount: "10", bankAccountId: time.id }), 400, "bank-account-invalid", "kart yolunda vadeli");
    expectStatus(await pay(ctx.api, party, { amount: "10", bankAccountId: loan.id }), 400, "bank-account-invalid", "kart yolunda kredi");
    expectStatus(await pay(ctx.api, party, { amount: "10", bankAccountId: b1.id }), 400, "bank-account-invalid", "kart yolunda vadesiz (kart varken)");
    expectStatus(await pay(ctx.api, party, { amount: "10", bankAccountId: "bacc-yok" }), 404, "bank-account-missing", "bilinmeyen kimlik");
    expectStatus(await pay(ctx.api, party, { amount: "10", method: "bank", bankAccountId: kk.id }), 400, "bank-account-invalid", "havale yolunda kart hesabı");
    assert.equal(entryCount(ctx.store, party.id), before, "hiçbiri yazılmadı");
  });

  it("[K6] pasif kart verilirse 400; tek etkin kart kalınca hesapsız ödeme ona gider", async () => {
    kk2 = await openCard(ctx.api, "Kurumsal Kart KK2", { bankName: "Yapı Kredi" });
    await setStatus(ctx.api, kk2, "passive");
    expectStatus(await pay(ctx.api, party, { amount: "10", bankAccountId: kk2.id }), 400, "bank-account-invalid", "pasif kart");
    const done = await must("tek etkin kart", pay(ctx.api, party, { amount: "30" }));
    assert.equal(entryRow(ctx.store, done.entryId).finRef, kk.id, "etkin tek kart KK");
    assert.equal(await balanceOf(ctx.api, kk), -3_000);
    await setStatus(ctx.api, kk2, "active");
  });

  it("[K15] POS tahsilatı değişmez: kart tanımlıyken cari tahsilat (POS) 108.00'a; POS yolunda hesap kimliği → 400 bank-account-invalid", async () => {
    const before = (await subBalances(ctx.api))["108.00"]?.balance || 0;
    const done = await must("POS tahsilatı", ctx.api.post(entries(customer.id), { kind: "in", amount: "200", method: "card", date: TODAY }));
    assert.equal(entryRow(ctx.store, done.entryId).finRef, "", "POS tahsilatı bağsız (2.2.0)");
    assert.equal((await subBalances(ctx.api))["108.00"]?.balance || 0, before + 200, "108.00 +200");
    expectStatus(await ctx.api.post(entries(customer.id), { kind: "in", amount: "5", method: "card", date: TODAY, bankAccountId: kk.id }), 400, "bank-account-invalid", "POS tahsilatında kurumsal kart");
  });

  it("[K16] bank.move'suz muhasebe: kart tanımlıyken kartla ödeme 403 bank-permission; satır yazılmaz", async () => {
    const before = entryCount(ctx.store, party.id);
    expectStatus(await pay(clerk, party, { amount: "15", bankAccountId: kk.id }), 403, "bank-permission", "kartla ödeme bank.move'suz");
    // Tek etkin kartta seçimsiz ödeme de karta gider: aynı yetki.
    await setStatus(ctx.api, kk2, "passive");
    expectStatus(await pay(clerk, party, { amount: "15" }), 403, "bank-permission", "kartla ödeme bank.move'suz (tek kart, seçimsiz)");
    await setStatus(ctx.api, kk2, "active");
    assert.equal(entryCount(ctx.store, party.id), before);
    // Alış faturası peşini ve stok alımı kurumsal kartla da bankadan çıkış sayılır (plan §3.7 #5, #8: + bank.move).
    const invoices = ctx.store.get("SELECT COUNT(*) AS n FROM invoices").n;
    expectStatus(await clerk.post(INV, { kind: "purchase", accountId: party.id, number: "AL-YETKI-1", issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: 100, discountRate: 0, vatRate: 0 }], payment: { cash: [{ amount: "100", method: "card", bankAccountId: kk.id, lineKey: "y1" }], cheques: [], endorse: [], rest: "open" }, force: true }), 403, "bank-permission", "alış faturası kartla bank.move'suz");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM invoices").n, invoices, "fatura yazılmadı");
    const item = await must("ürün", ctx.api.post("/api/workspace/stock", { name: "Ürün Y", unit: "Adet", openingQty: "1", unitPrice: "10" }));
    expectStatus(await clerk.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: "1", unitPrice: "10", pay: "cash", method: "card", bankAccountId: kk.id, date: TODAY }), 403, "bank-permission", "stok alımı kartla bank.move'suz");
    await integrityOk(ctx.api, "yanlış bağlar");
  });
});

describe("K2 · düzelt, sil → geri yükle, pasif kart, eşleşmiş satır, eski bağsız satır", () => {
  let ctx;
  let party;
  let b1;
  let kk;
  let kk2;
  let legacy;
  let p;
  before(async () => {
    ctx = await bootBank();
    party = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "XYZ Tedarik", type: "supplier", registeredOn: "2026-10-01" }));
    b1 = await openDemand(ctx.api, "Ana TL Hesabı", "50.000");
    legacy = await must("kart tanımlanmadan", pay(ctx.api, party, { amount: "300" }));
    kk = await openCard(ctx.api, "Kurumsal Kart KK", { limit: "10.000", confirmed: true });
    kk2 = await openCard(ctx.api, "Kurumsal Kart KK2", { limit: "5.000", confirmed: true, bankName: "Yapı Kredi" });
  });
  after(() => ctx.server.close());
  const put = (id, body) => ctx.api.put(`${entries(party.id)}/${id}`, { kind: "out", method: "card", date: TODAY, ...body });

  it("[K10] kart tanımlanmadan girilmiş bağsız satır: yalnız açıklama → bağsız; tutar değişirse iki kartta 400, KK seçilince bağlanır", async () => {
    await must("açıklama", put(legacy.entryId, { amount: "300", note: "Eski kart ödemesi" }));
    assert.equal(entryRow(ctx.store, legacy.entryId).finRef, "", "bağsız kaldı");
    expectStatus(await put(legacy.entryId, { amount: "310" }), 400, "bank-account-required", "tutar değişti, iki kart");
    await must("KK'ya bağlandı", put(legacy.entryId, { amount: "310", bankAccountId: kk.id }));
    assert.equal(entryRow(ctx.store, legacy.entryId).finRef, kk.id);
    assert.equal(await balanceOf(ctx.api, kk), -31_000, "KK −310");
    assert.equal((await subBalances(ctx.api))["108.00"]?.balance || 0, 0, "108.00 boşaldı");
  });

  it("[K9][K7] tutar artışı limiti aşarsa 409 (Yine de Kaydet geçer); KK → KK2 taşıma KK2'nin limitinde sorulur", async () => {
    p = await must("1.000", pay(ctx.api, party, { amount: "1.000", bankAccountId: kk.id }));
    await must("9.000'e", put(p.entryId, { amount: "9.000", bankAccountId: kk.id }));
    assert.equal(await balanceOf(ctx.api, kk), -931_000, "KK −9.310");
    expectNegative(await put(p.entryId, { amount: "9.800", bankAccountId: kk.id }), NEGATIVE, "9.800 limit aşar", kk.id);
    assert.equal(entryRow(ctx.store, p.entryId).amount, 9000, "yazılmadı");
    await must("Yine de Kaydet", put(p.entryId, { amount: "9.800", bankAccountId: kk.id, ...FORCE }));
    assert.equal(await balanceOf(ctx.api, kk), -1_011_000);
    expectNegative(await put(p.entryId, { amount: "9.800", bankAccountId: kk2.id }), NEGATIVE, "KK2'ye taşıma limit aşar", kk2.id);
    await must("KK2'ye taşındı", put(p.entryId, { amount: "9.800", bankAccountId: kk2.id, ...FORCE }));
    assert.deepEqual([await balanceOf(ctx.api, kk), await balanceOf(ctx.api, kk2)], [-31_000, -980_000]);
    await must("tutar 4.000", put(p.entryId, { amount: "4.000", bankAccountId: kk2.id }));
    assert.equal(await balanceOf(ctx.api, kk2), -400_000);
    await integrityOk(ctx.api, "düzelt");
  });

  it("[K9] yol değişimi: kart → havale (B1) → kart (KK) → nakit; her adımda kart, banka ve Kasa", async () => {
    await must("havaleye", put(p.entryId, { method: "bank", amount: "4.000", bankAccountId: b1.id }));
    assert.deepEqual([entryRow(ctx.store, p.entryId).method, entryRow(ctx.store, p.entryId).finRef], ["bank", b1.id]);
    assert.deepEqual([await balanceOf(ctx.api, kk2), await balanceOf(ctx.api, b1)], [0, 4_600_000], "KK2 0, B1 46.000");
    expectStatus(await put(p.entryId, { amount: "4.000" }), 400, "bank-account-required", "karta dönüş seçimsiz (iki kart)");
    await must("karta (KK)", put(p.entryId, { amount: "4.000", bankAccountId: kk.id }));
    assert.deepEqual([await balanceOf(ctx.api, kk), await balanceOf(ctx.api, b1)], [-431_000, 5_000_000]);
    await must("nakde", put(p.entryId, { method: "cash", amount: "4.000", ...FORCE }));
    assert.deepEqual([entryRow(ctx.store, p.entryId).method, entryRow(ctx.store, p.entryId).finRef], ["cash", ""]);
    assert.equal(await balanceOf(ctx.api, kk), -31_000);
    await must("yeniden karta", put(p.entryId, { amount: "4.000", bankAccountId: kk.id }));
    assert.equal(await balanceOf(ctx.api, kk), -431_000);
    await integrityOk(ctx.api, "yol değişimi");
  });

  it("[K11][K6] sil → geri yükle: bağ korunur; pasif kartta silme ve geri yükleme 400; limit aşılıyorsa geri yüklemede sorulur", async () => {
    await setStatus(ctx.api, kk, "passive");
    expectStatus(await ctx.api.del(`${entries(party.id)}/${p.entryId}`), 400, "bank-account-passive", "pasif kartta silme");
    await setStatus(ctx.api, kk, "active");
    await must("sil", ctx.api.del(`${entries(party.id)}/${p.entryId}`));
    assert.equal(await balanceOf(ctx.api, kk), -31_000);
    await setStatus(ctx.api, kk, "passive");
    expectStatus(await restoreLast(ctx.api, "account-entry", p.entryId), 400, "bank-account-passive", "pasif karta geri yükleme");
    await setStatus(ctx.api, kk, "active");
    // Limit: KK'yı 9.000 daha kullan; geri yüklenen 4.000 limiti aşar (−310 − 9.000 − 4.000 + 10.000 < 0).
    await must("9.000", pay(ctx.api, party, { amount: "9.000", bankAccountId: kk.id }));
    expectNegative(await restoreLast(ctx.api, "account-entry", p.entryId), NEGATIVE, "geri yükleme limit aşar", kk.id);
    await must("Yine de Geri Yükle", restoreLast(ctx.api, "account-entry", p.entryId, FORCE));
    assert.equal(entryRow(ctx.store, p.entryId).finRef, kk.id, "geri yüklenen satır KK'ya bağlı");
    assert.equal(await balanceOf(ctx.api, kk), -1_331_000, "KK −13.310");
    await integrityOk(ctx.api, "geri yükleme");
  });

  it("[K12] ekstreyle eşleşmiş kart ödemesi: düzelt ve sil 409 bank-reconciled", async () => {
    const row = entryRow(ctx.store, p.entryId);
    ctx.db.prepare("INSERT INTO bank_matches (id, line_id, bank_account_id, event_id, amount_minor, digest, kind, created_by, created_at) VALUES ('m-kart', 'l-kart', ?, ?, 400000, 'x', 'manual', 'admin', ?)").run(kk.id, row.eventId, NOW);
    expectStatus(await put(p.entryId, { amount: "3.000", bankAccountId: kk.id }), 409, "bank-reconciled", "eşleşmiş düzelt");
    expectStatus(await ctx.api.del(`${entries(party.id)}/${p.entryId}?${FORCE_QUERY}`), 409, "bank-reconciled", "eşleşmiş sil");
    ctx.db.prepare("UPDATE bank_matches SET undone_at = ?, undone_by = 'admin', undo_reason = 'test' WHERE id = 'm-kart'").run(NOW);
  });
});

describe("K2 · alış faturası, alıştan iade, stok alımı; POS yolları değişmez", () => {
  let ctx;
  let supplier;
  let customer;
  let kk;
  let kk2;
  let item;
  let purchase;
  let purchaseBody;
  before(async () => {
    ctx = await bootBank();
    supplier = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "XYZ Tedarik", type: "supplier", registeredOn: "2026-10-01" }));
    customer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
    await openDemand(ctx.api, "Ana TL Hesabı", "10.000");
    kk = await openCard(ctx.api, "Kurumsal Kart KK");
    kk2 = await openCard(ctx.api, "Kurumsal Kart KK2", { bankName: "Yapı Kredi" });
    item = await must("ürün", ctx.api.post("/api/workspace/stock", { name: "Ürün A", unit: "Adet", openingQty: "10", unitPrice: "100" }));
  });
  after(() => ctx.server.close());
  const cashRows = invoiceId => ctx.store.all("SELECT kind, amount, method, fin_ref AS finRef FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind IN ('in', 'out') ORDER BY rowid", invoiceId);

  it("[K17] alış faturası iki kartta kart seçilmeden → 400 bank-account-required (alan 1. peşin satırın hesabı); belge yazılmaz", async () => {
    const count = ctx.store.get("SELECT COUNT(*) AS n FROM invoices").n;
    purchaseBody = cash => ({ kind: "purchase", accountId: supplier.id, number: "AL-KART-1", issueDate: TODAY, pricesIncludeVat: false, lines: [{ itemId: item.id, name: "", qty: 5, unitPrice: 100, discountRate: 0, vatRate: 20 }], payment: { cash, cheques: [], endorse: [], rest: "open" }, force: true });
    const res = await ctx.api.post(INV, purchaseBody([{ amount: "600", method: "card", lineKey: "a1" }]));
    expectStatus(res, 400, "bank-account-required", "iki kartta seçimsiz peşin");
    assert.equal(res.data?.field, "payment.cash.0.bankAccountId");
    assert.match(res.error, /Kurumsal kart seçilmedi: 1\. peşin satır/);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM invoices").n, count);
  });

  it("[K17] alış faturası 600 peşin kartla (KK) → KK −600; Düzenle'de KK2'ye taşınır (olay yenilenir, numara aynı)", async () => {
    purchase = await must("alış", ctx.api.post(INV, purchaseBody([{ amount: "600", method: "card", bankAccountId: kk.id, lineKey: "a1" }])));
    assert.deepEqual(cashRows(purchase.id).map(row => [row.kind, row.amount, row.method, row.finRef]), [["out", 600, "card", kk.id]]);
    assert.equal(await balanceOf(ctx.api, kk), -60_000);
    await must("Düzenle KK2", ctx.api.post(`${INV}/${purchase.id}/edit`, purchaseBody([{ amount: "600", method: "card", bankAccountId: kk2.id, lineKey: "a1" }])));
    assert.deepEqual(cashRows(purchase.id).map(row => row.finRef), [kk2.id]);
    assert.deepEqual([await balanceOf(ctx.api, kk), await balanceOf(ctx.api, kk2)], [0, -60_000]);
    await integrityOk(ctx.api, "alış Düzenle");
  });

  it("[K17] alıştan iade kurumsal karta (2 adet, 240): seçimsiz 400; KK2'ye → KK2 −360 (309 düşer); iade iptali ve alış iptali kartı sıfırlar", async () => {
    const detail = await must("alış kartı", ctx.api.get(`${INV}/${purchase.id}`));
    const ret = cash => ({ kind: "purchase_return", originalId: purchase.id, issueDate: TODAY, lines: [{ originLineId: detail.lines[0].id, qty: 2 }], payment: { cash, cheques: [], endorse: [], rest: "open" }, force: true });
    expectStatus(await ctx.api.post(INV, ret([{ amount: "240", method: "card", lineKey: "r1" }])), 400, "bank-account-required", "iade seçimsiz (iki kart)");
    const back = await must("alıştan iade", ctx.api.post(INV, ret([{ amount: "240", method: "card", bankAccountId: kk2.id, lineKey: "r1" }])));
    assert.deepEqual(cashRows(back.id).map(row => [row.kind, row.amount, row.method, row.finRef]), [["in", 240, "card", kk2.id]]);
    assert.equal(await balanceOf(ctx.api, kk2), -36_000, "KK2 −600 + 240");
    const subs = await subBalances(ctx.api);
    assert.equal(subs[kk2.glSub]?.balance, -360);
    assert.equal(subs["108.00"]?.balance || 0, 0);
    await integrityOk(ctx.api, "alıştan iade");
    await must("iade iptali", ctx.api.post(`${INV}/${back.id}/cancel`, { reason: "Test" }));
    assert.equal(await balanceOf(ctx.api, kk2), -60_000);
    await must("alış iptali", ctx.api.post(`${INV}/${purchase.id}/cancel`, { reason: "Test" }));
    assert.equal(await balanceOf(ctx.api, kk2), 0);
    await integrityOk(ctx.api, "iptaller");
  });

  it("[K18] stok peşin alımı kartla (KK) → KK −100; müşteri iadesi kartla POS iadesi (bağsız; hesap verilirse 400)", async () => {
    const buy = await must("stok alımı", ctx.api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: "1", unitPrice: "100", pay: "cash", method: "card", bankAccountId: kk.id, date: TODAY }));
    assert.equal(ctx.store.get("SELECT fin_ref AS finRef FROM stock_moves WHERE id = ?", buy.moveId).finRef, kk.id);
    assert.equal(await balanceOf(ctx.api, kk), -10_000);
    const ret = await must("müşteri iadesi POS'tan", ctx.api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", reason: "return", qty: "1", unitPrice: "50", pay: "cash", method: "card", date: TODAY }));
    assert.equal(ctx.store.get("SELECT fin_ref AS finRef FROM stock_moves WHERE id = ?", ret.moveId).finRef, "", "POS iadesi bağsız");
    expectStatus(await ctx.api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", reason: "return", qty: "1", unitPrice: "50", pay: "cash", method: "card", bankAccountId: kk.id, date: TODAY }), 400, "bank-account-invalid", "POS iadesinde kurumsal kart");
  });

  it("[K15] POS yolları değişmez: satış peşini, satıştan iade, stok satışı, taksit ve kayıt tahsilatı kartla → hepsi bağsız (108.00)", async () => {
    const sale = await must("satış", ctx.api.post(INV, { kind: "sale", accountId: customer.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: 1000, discountRate: 0, vatRate: 0 }], payment: { cash: [{ amount: "1.000", method: "card", lineKey: "s1" }], cheques: [], endorse: [], rest: "open" }, force: true }));
    assert.deepEqual(cashRows(sale.id).map(row => row.finRef), [""]);
    const saleDetail = await must("satış kartı", ctx.api.get(`${INV}/${sale.id}`));
    const back = await must("satıştan iade", ctx.api.post(INV, { kind: "sale_return", originalId: sale.id, issueDate: TODAY, lines: [{ originLineId: saleDetail.lines[0].id, qty: 1 }], payment: { cash: [{ amount: "1.000", method: "card", lineKey: "g1" }], cheques: [], endorse: [], rest: "open" }, force: true }));
    assert.deepEqual(cashRows(back.id).map(row => [row.kind, row.finRef]), [["out", ""]], "POS iadesi bağsız");
    const sold = await must("stok satışı", ctx.api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "1", unitPrice: "150", pay: "cash", method: "card", date: TODAY }));
    assert.equal(ctx.store.get("SELECT fin_ref AS finRef FROM stock_moves WHERE id = ?", sold.moveId).finRef, "");
    const plan = await must("taksit kartı", ctx.api.post("/api/workspace/plans", { accountId: customer.id, name: "ABC", total: "300", mode: "auto", count: 1, firstDue: TODAY }));
    const planIn = await must("taksit tahsilatı", ctx.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "300", method: "card", date: TODAY }));
    assert.equal(ctx.store.get("SELECT fin_ref AS finRef FROM plan_entries WHERE id = ?", planIn.entryId).finRef, "");
    expectStatus(await ctx.api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "1", method: "card", date: TODAY, bankAccountId: kk.id }), 400, "bank-account-invalid", "POS taksit tahsilatında kurumsal kart");
    const recordPay = await must("kayıt tahsilatı", ctx.api.post("/api/workspace/cases/KART-1/payments", { amount: "75", date: TODAY, method: "card", caseTitle: "Kart Dosyası" }));
    assert.equal(ctx.store.get("SELECT fin_ref AS finRef FROM payments WHERE id = ?", recordPay.id).finRef, "");
    // 108.00 (elle): satış +1.000, satıştan iade −1.000, stok müşteri iadesi −50, stok satışı +150, taksit +300, kayıt +75 = +475.
    assert.equal((await subBalances(ctx.api))["108.00"]?.balance, 475, "108.00 = POS hareketleri");
    assert.equal(await balanceOf(ctx.api, kk), -10_000, "KK yalnız stok alımı");
    await integrityOk(ctx.api, "POS yolları");
  });
});

describe("K2 · Benzer İşlem, istek kimliği, eşzamanlı limit, açılış öncesi tarih, Kart Borcuna Aktar", () => {
  let ctx;
  let party;
  let other;
  let kk;
  before(async () => {
    ctx = await bootBank();
    party = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "XYZ Tedarik", type: "supplier", registeredOn: "2026-10-01" }));
    other = await must("tedarikçi 2", ctx.api.post("/api/workspace/accounts", { name: "QWE Tedarik", type: "supplier", registeredOn: "2026-10-01" }));
    // Kart tanımlanmadan (eski sürüm gibi) 06.10 tarihli kartla ödeme: Hesabı Atanmamış (108.00).
    await must("eski kart ödemesi", pay(ctx.api, party, { amount: "400", date: "2026-10-06" }));
    kk = await openCard(ctx.api, "Kurumsal Kart KK", { limit: "1.000", confirmed: true, date: "2026-10-05" });
  });
  after(() => ctx.server.close());

  it("[K14] Kart Borcuna Aktar eski satırı taşır (108.00 0, KK −400); yeni bağlı kart ödemesi havuza girmez (409 bank-legacy-exceeds)", async () => {
    await must("Kart Borcuna Aktar", ctx.api.post(`${BANK}/legacy/reclass`, { mode: "card", accountId: kk.id, amount: "400", date: TODAY }));
    assert.equal((await subBalances(ctx.api))["108.00"]?.balance || 0, 0);
    assert.equal(await balanceOf(ctx.api, kk), -40_000);
    await must("bağlı ödeme", pay(ctx.api, party, { amount: "100" }));
    assert.equal(await balanceOf(ctx.api, kk), -50_000, "tek kart: kendiliğinden KK");
    expectStatus(await ctx.api.post(`${BANK}/legacy/reclass`, { mode: "card", accountId: kk.id, amount: "1", date: TODAY }), 409, "bank-legacy-exceeds", "bağlı satır havuzda değil");
  });

  it("[K19] Benzer İşlem: aynı gün, aynı kart, aynı cari, aynı tutar → 409 bank-similar; Yine de Kaydet geçer; istek kimliği tek satır", async () => {
    const before = entryCount(ctx.store, party.id);
    expectStatus(await pay(ctx.api, party, { amount: "100" }), 409, "bank-similar", "benzer kart ödemesi");
    assert.equal(entryCount(ctx.store, party.id), before);
    await must("Yine de Kaydet", pay(ctx.api, party, { amount: "100", similarOk: true }));
    const body = { kind: "out", method: "card", amount: "50", date: TODAY, similarOk: true };
    const first = unwrap(await ctx.api.client.post(entries(party.id), body, { "x-hof-request": "kart-istek-0000000001" }));
    const second = unwrap(await ctx.api.client.post(entries(party.id), body, { "x-hof-request": "kart-istek-0000000001" }));
    assert.equal(first.status, 200, JSON.stringify(first.data).slice(0, 300));
    assert.equal(second.status, 200, JSON.stringify(second.data).slice(0, 300));
    assert.equal(second.data.replayed, true, "ikinci gönderim yazılmadı");
    assert.equal(entryCount(ctx.store, party.id), before + 2);
    assert.equal(await balanceOf(ctx.api, kk), -65_000, "KK −400 −100 −100 −50");
  });

  it("[K20] kartın açılışından (05.10) önceki tarih → 409 bank-before-opening", async () => {
    expectStatus(await pay(ctx.api, party, { amount: "10", date: "2026-10-04" }), 409, "bank-before-opening", "açılış öncesi");
  });

  it("[K8] aynı anda iki 300'lük ödeme (kalan limit 350): biri 200, öbürü 409; kart limiti delinmez", async () => {
    const results = await Promise.all([pay(ctx.api, party, { amount: "300", similarOk: true }), pay(ctx.api, other, { amount: "300", similarOk: true })]);
    const statuses = results.map(res => res.status).sort();
    assert.deepEqual(statuses, [200, 409], `durumlar ${statuses}`);
    assert.ok(NEGATIVE.includes(results.find(res => res.status === 409).code));
    assert.equal(await balanceOf(ctx.api, kk), -95_000, "KK −950 (limit 1.000 içinde)");
    await integrityOk(ctx.api, "eşzamanlı");
  });
});
