// 2.1.0 Aşama 9 — Bankalar Arası Transfer (docs/BANKA-MODULU-PLAN.md §3.7 #11, §3.8 "Banka Fişi", §3.9 K7, §3.10, §3.11 bank:transfer,
// §7 POST /bank/transfers, §8.4 "Bugün Giriş / Bugün Çıkış / Transfer", §9.1 bank.transfer, §12.3 Aşama 6 ve 9, §12.5 kabul 13–16).
//
// Nasıl bozarım (önce yazıldı; testler buradan; plan Aşama 9 + §12.4'ün transfere değen maddeleri):
//   B1  Farklı para birimli hesaplar arasında transfer (TL → USD) → 400 bank-currency; metin "farklı para birimli hesaplar arasında transfer
//       yapılamaz"; ertelenen Döviz Al/Sat önerilmez (yarım özellik görünmez)
//   B2  Kaynak = hedef → 400
//   B3  İki AYRI oturumdan, iki AYRI bağlantıdan aynı anda iki transfer (Engelle'deki hesap; ikisi ayrı ayrı sığar, birlikte sığmaz) → biri 200,
//       öbürü 409 bank-blocked; hesap eksiye düşmez
//   B4  Ters Kaydet → iki hesap eski hâline; ikinci Ters Kaydet 409; ters kaydın ters kaydı 409; Düzelt (ters + yeni, tek işlem)
//   B5  Kredi / vadeli / kart hesabından cari ödemesi → 400; kredi ya da kart hesabına "Bankalar Arası Transfer" → 400 (kredi kullanımı ve kart
//       borcu kendi türleriyle)
//   B6  Tutar ve ücret: 3 ondalık, "0,005", eksi, sıfır, 1e13, metin → 400; ücret eksi / 3 ondalık → 400; ücrette KDV'li (faturalı) kip → 400
//   B7  Pasif gönderen ya da alıcı → 400; olmayan / silinmiş hesap → 404
//   B8  Başka şirketin hesabı (?hofCompany= ile) → 404; şirketler ayrı
//   B9  Kilitli döneme → 409 period-locked; ileri tarih → 400 date-future; alıcı hesabın açılışından önce → 409 bank-before-opening; valör
//       işlem tarihinden önce ya da 30 günden sonra → 400; tanınmayan kanal → 400
//   B10 Aynı istek kimliği iki kez → tek olay (replayed); aynı kimlik farklı gövde → 409; farklı kimlik aynı gün/hesaplar/tutar → 409
//       bank-similar → "Yine de Kaydet" 200; aynı tutar BAŞKA alıcıya → benzer değil
//   B11 Yetki: personel 403; "Transfer Yapma" kaldırılmış muhasebe 403; "Banka Hareketi Silme, İptal ve Ters Kayıt" kaldırılmış kişi Ters Kaydet
//       403
//   B12 Ekstreyle eşleşmiş transferi Ters Kaydet / Düzelt → 409 bank-reconciled
//   B13 Banka fişi silinmez (DELETE yolu yok); "sil → geri yükle" transferde Ters Kaydet + yeni transferdir
//   B14 K7 Uyar: gönderen eksiye düşerse 409 bank-negative → "Yine de Kaydet" (negativeOk) 200; Engelle: negativeOk ile de 409
//   B15 Planlı transfer: bakiye değişmez; Gerçekleştir → iki bacak; plan ilerler; aynı hesaplı plan 400
//   B16 Kapı bank:transfer: ham yazımla (bank.post dışı) tek B / tek A kuralı bozulan transfer Mutabakat Testi'nde görünür
//   B17 Bugün Çıkış transferi saymaz; Transfer satırı ayrı; transfer ücreti Çıkış'ta ve Banka Masraf Raporu'nda
import assert from "node:assert/strict";
import http from "node:http";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { apiOf, integrityOf, integrityOk, rawRun } from "./banka-210-ortak.mjs";
import { BANK, TODAY, bootBank, expectStatus, lockPeriod, must, openAcceptanceAccounts, openAccount, subBalances, trialBalances } from "./banka-210-hesap-ortak.mjs";

const TRANSFERS = `${BANK}/transfers`;
const balance = async (api, account) => (await must("hesap", api.get(`${BANK}/accounts/${account.id}`))).balanceMinor;
const summary = api => must("özet", api.get(`${BANK}/summary`));
const setPolicy = (api, account, policy) => must(`politika ${policy}`, api.put(`${BANK}/accounts/${account.id}`, { negativePolicy: policy }));
const transfer = (api, body, label = "transfer") => must(label, api.post(TRANSFERS, body));
const lineKeys = card => card.lines.map(line => `${line.role}|${line.gl}|${line.sub || ""}|${line.side}|${line.tryMinor}`).sort();
const counts = store => ({ events: store.get("SELECT COUNT(*) AS n FROM fin_events").n, lines: store.get("SELECT COUNT(*) AS n FROM bank_lines").n });

/** Kabul 1–14 (API'den; ekrandan sınanışı senaryo-banka-210 bölüm 3): Ziraat 110.000, Garanti 50.000, Kasa 10.000, ABC 0. */
async function acceptance() {
  const ctx = await bootBank();
  const acc = await openAcceptanceAccounts(ctx.api);
  const abc = await must("ABC", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  await must("fatura", ctx.api.post("/api/workspace/invoices", { kind: "sale", accountId: abc.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Ürün A", qty: 1, unitPrice: 20000, discountRate: 0, vatRate: 20 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }));
  await must("tahsilat", ctx.api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", amount: "20.000", method: "bank", bankAccountId: acc.ziraat.id, date: TODAY }));
  await must("bankadan kasaya", ctx.api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: "10.000", date: TODAY, bankAccountId: acc.ziraat.id }));
  return { ctx, acc, abc };
}

describe("Aşama 9 — çalışıyor mu: kabul 13–16 ve ücretli örnek (bağımsız beklenenle)", () => {
  let ctx;
  let acc;
  let free;
  before(async () => {
    ({ ctx, acc } = await acceptance());
  });
  after(() => ctx.server.close());

  it("kabul 13–14 (Banka tarafı): Bugün Giriş 20.000 (ABC), Bugün Çıkış 0 (transferi saymaz), Transfer Çıkış 10.000", async () => {
    assert.equal(await balance(ctx.api, acc.ziraat), 11_000_000);
    const s = await summary(ctx.api);
    assert.ok(s.flows, "özet Bugün/Bu Ay hareketlerini taşır");
    assert.deepEqual(s.flows.today, { inMinor: 2_000_000, outMinor: 0, transferInMinor: 0, transferOutMinor: 1_000_000 }, "Bugün: Giriş 20.000 · Çıkış 0 · Transfer Çıkış 10.000");
    // Bu Ay: açılışlar (01.10, Açılış ve Devir Düzeltmeleri) giriş sayılmaz.
    assert.equal(s.flows.month.inMinor, 2_000_000, "Bu Ay Giriş 20.000 (açılışlar hariç)");
    assert.equal(s.flows.month.transferOutMinor, 1_000_000);
  });

  it("kabul 15–16: Ziraat → Garanti 20.000, ücret 0 → Ziraat 90.000, Garanti 70.000, Gerçek Banka 160.000, Kasa + Banka 170.000; mizan bağımsız modelle", async () => {
    free = await transfer(ctx.api, { accountId: acc.ziraat.id, toAccountId: acc.garanti.id, amount: "20.000", date: TODAY, channel: "virman", description: "Garanti'ye aktarım" });
    assert.equal(free.type, "transfer");
    assert.equal(free.typeLabel, "Bankalar Arası Transfer");
    assert.equal(free.account.id, acc.ziraat.id, "gönderen");
    assert.equal(free.counterAccount.id, acc.garanti.id, "alıcı");
    assert.equal(free.transfer.amountMinor, 2_000_000);
    assert.equal(free.transfer.feeMinor, 0);
    assert.equal(free.channel, "Virman");
    // Plan §3.7 #11: B 102.02 20.000 / A 102.01 20.000.
    assert.deepEqual(lineKeys(free), [`bank|102|${acc.garanti.glSub}|D|2000000`, `bank|102|${acc.ziraat.glSub}|C|2000000`].sort());
    assert.equal(await balance(ctx.api, acc.ziraat), 9_000_000);
    assert.equal(await balance(ctx.api, acc.garanti), 7_000_000);
    const s = await summary(ctx.api);
    assert.equal(s.realBank.minor, 16_000_000, "Gerçek Banka 160.000");
    const cash = await must("Kasa", ctx.api.get("/api/workspace/cash"));
    assert.equal(Math.round(cash.byMethod.cash * 100) + s.realBank.minor, 17_000_000, "Kasa + Banka 170.000 (= 150.000 + 20.000)");
    // Bağımsız mizan (kabul 16 sonu; plan §12.5'in 2.1.0 karşılığı): 100 10.000 · 102.01 90.000 · 102.02 70.000 · 120 0 · 391 3.333,33 ·
    // 500 150.000 · 600 16.666,67.
    const trial = await trialBalances(ctx.api);
    const want = { 100: 10000, 102: 160000, 120: 0, 391: -3333.33, 500: -150000, 600: -16666.67 };
    for (const [code, value] of Object.entries(want)) assert.equal(Math.round((trial[code] || 0) * 100), Math.round(value * 100), `mizan ${code}: ${trial[code]} ≠ ${value}`);
    const subs = await subBalances(ctx.api);
    assert.equal(subs[acc.ziraat.glSub].balance, 90000);
    assert.equal(subs[acc.garanti.glSub].balance, 70000);
    // Bugün Çıkış transferi saymaz; Transfer: Giriş 20.000 (Garanti) · Çıkış 30.000 (Kasa 10.000 + Garanti'ye 20.000).
    assert.deepEqual(s.flows.today, { inMinor: 2_000_000, outMinor: 0, transferInMinor: 2_000_000, transferOutMinor: 3_000_000 });
    const result = await integrityOk(ctx.api, "kabul 16");
    const check = result.checks.find(item => item.code === "bank:transfer");
    assert.ok(check?.ok, `bank:transfer denetimi listede ve temiz: ${JSON.stringify(check)}`);
  });

  it("Hareketler'de iki bacak (Ziraat −20.000, Garanti +20.000); hesap süzgecinde yalnız kendi bacağı; tür süzgeci Bankalar Arası Transfer", async () => {
    const all = await must("hareketler", ctx.api.get(`${BANK}/movements?type=transfer`));
    const legs = all.rows.filter(row => row.eventId === free.id).map(row => [row.accountId, row.signedMinor]).sort();
    assert.deepEqual(legs, [[acc.garanti.id, 2_000_000], [acc.ziraat.id, -2_000_000]].sort());
    const z = await must("Ziraat", ctx.api.get(`${BANK}/movements?account=${acc.ziraat.id}`));
    assert.equal(z.rows.find(row => row.eventId === free.id)?.signedMinor, -2_000_000);
    const meta = await must("meta", ctx.api.get(`${BANK}/voucher-meta`));
    assert.ok(meta.groups.some(item => item.key === "transfer" && item.label === "Bankalar Arası Transfer"), "süzgeçte Bankalar Arası Transfer");
  });

  it("Ters Kaydet (ekranın yolu) → Ziraat 110.000, Garanti 50.000; ters kaydın Transfer satırı (iç hareket, Bugün Giriş/Çıkış değişmez)", async () => {
    const back = await must("ters kaydet", ctx.api.post(`${BANK}/events/${free.id}/reverse`, { reason: "yanlış hesap" }));
    assert.equal(back.original.status, "reversed");
    assert.equal(await balance(ctx.api, acc.ziraat), 11_000_000);
    assert.equal(await balance(ctx.api, acc.garanti), 5_000_000);
    const s = await summary(ctx.api);
    assert.equal(s.flows.today.inMinor, 2_000_000, "ters kayıt dış giriş sayılmaz");
    assert.equal(s.flows.today.outMinor, 0, "ters kayıt dış çıkış sayılmaz");
    await integrityOk(ctx.api, "ters kayıt");
  });

  it("ücretli örnek: 20.000 + EFT 5,00 + BSMV 0,25 (BSMV Hariç) → Ziraat 89.994,75; Garanti 70.000; 770 = 5,25; Çıkış 5,25; Banka Masraf Raporu'nda", async () => {
    const paid = await transfer(ctx.api, { accountId: acc.ziraat.id, toAccountId: acc.garanti.id, amount: "20.000", date: TODAY, channel: "eft", feeAmount: "5", feeTax: "bsmv_excl", feeType: "eft", similarOk: true });
    // Plan §3.7 #11: B 102.02 20.000 · B 770 5,25 (5,00 + BSMV 0,25) / A 102.01 20.005,25.
    assert.deepEqual(lineKeys(paid), [`bank|102|${acc.garanti.glSub}|D|2000000`, "expense|770||D|500", "tax|770||D|25", `bank|102|${acc.ziraat.glSub}|C|2000525`].sort());
    assert.equal(paid.transfer.amountMinor, 2_000_000);
    assert.equal(paid.transfer.feeMinor, 525);
    assert.equal(await balance(ctx.api, acc.ziraat), 8_999_475, "Ziraat 89.994,75");
    assert.equal(await balance(ctx.api, acc.garanti), 7_000_000);
    const trial = await trialBalances(ctx.api);
    assert.equal(Math.round(trial["770"] * 100), 525, "770 Banka Masrafları 5,25");
    const s = await summary(ctx.api);
    assert.equal(s.flows.today.outMinor, 525, "transfer ücreti dış çıkış");
    const fees = await must("masraf raporu", ctx.api.get(`${BANK}/reports/fees?from=${TODAY}&to=${TODAY}`));
    const row = fees.rows.find(item => item.eventId === paid.id);
    assert.ok(row, "transfer ücreti Banka Masraf Raporu'nda");
    assert.deepEqual([row.baseMinor, row.bsmvMinor, row.totalMinor, row.gl], [500, 25, 525, "770"]);
    assert.equal(s.flows.month.feeMinor, 525, "Bu Ay Banka Masrafları 5,25");
    // Aynı fiş BSMV Dahil 5,25 girilince aynı satırlar (vergi kipi yalnız vergi satırını değiştirir).
    const same = await transfer(ctx.api, { accountId: acc.garanti.id, toAccountId: acc.ziraat.id, amount: "1.000", date: TODAY, feeAmount: "5,25", feeTax: "bsmv_incl", feeType: "eft" });
    assert.deepEqual(lineKeys(same).filter(key => !key.startsWith("bank|")), ["expense|770||D|500", "tax|770||D|25"]);
    await integrityOk(ctx.api, "ücretli");
  });

  it("Düzelt: tutar 3.000 → 1.500 ve ücret kaldırılır (ters + yeni, tek işlemde); alıcı formdan korunur, kaynak = hedef 400", async () => {
    const t = await transfer(ctx.api, { accountId: acc.ziraat.id, toAccountId: acc.garanti.id, amount: "3.000", date: TODAY, feeAmount: "2", feeTax: "none", feeType: "havale", similarOk: true });
    const z0 = await balance(ctx.api, acc.ziraat);
    const g0 = await balance(ctx.api, acc.garanti);
    const fixed = await must("düzelt", ctx.api.post(`${BANK}/events/${t.id}/correct`, { amount: "1.500", feeAmount: "0" }));
    assert.equal(fixed.next.transfer.amountMinor, 150_000);
    assert.equal(fixed.next.transfer.feeMinor, 0);
    assert.equal(fixed.next.counterAccount.id, acc.garanti.id, "alıcı formdan korunur");
    assert.equal(await balance(ctx.api, acc.ziraat), z0 + 300_200 - 150_000);
    assert.equal(await balance(ctx.api, acc.garanti), g0 - 300_000 + 150_000);
    expectStatus(await ctx.api.post(`${BANK}/events/${t.id}/correct`, { amount: "1" }), 409, "bank-already-reversed", "ters kaydedilmişi düzelt");
    expectStatus(await ctx.api.post(`${BANK}/events/${fixed.next.id}/correct`, { toAccountId: acc.ziraat.id }), 400, "bank-account-invalid", "Düzelt'te kaynak = hedef");
    await integrityOk(ctx.api, "düzelt");
  });

  it("vadeli hesaba transfer ve vadeliden geri; valör ve kanal İşlem Kartı'nda", async () => {
    const time = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "Vadeli", kind: "time", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    const into = await transfer(ctx.api, { accountId: acc.garanti.id, toAccountId: time.id, amount: "10.000", date: TODAY, valueDate: "2026-10-09", channel: "fast" });
    assert.equal(into.valueDate, "2026-10-09");
    assert.equal(into.channel, "FAST");
    await transfer(ctx.api, { accountId: time.id, toAccountId: acc.garanti.id, amount: "4.000", date: TODAY });
    assert.equal(await balance(ctx.api, time), 600_000);
    await integrityOk(ctx.api, "vadeli");
  });
});

describe("Aşama 9 — nasıl bozarım", () => {
  let ctx;
  let acc;
  let staffRole;
  before(async () => {
    ctx = await bootBank({ fxEnabled: true });
    acc = await openAcceptanceAccounts(ctx.api);
    staffRole = apiOf(await createUser(ctx.server, ctx.api.client, { username: "personel9", role: "personel" }));
  });
  after(() => ctx.server.close());
  const post = body => ctx.api.post(TRANSFERS, body);
  const base = () => ({ accountId: acc.ziraat.id, toAccountId: acc.garanti.id, amount: "100", date: TODAY, similarOk: true });

  it("B1: TL → USD 400 bank-currency; metin farklı para birimini söyler, Döviz Al/Sat önermez; USD → USD de 400", async () => {
    const usd = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "Dolar", kind: "fx", currency: "USD", opening: { date: "2026-10-01", amount: "0" } });
    const usd2 = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Dolar", kind: "fx", currency: "USD", opening: { date: "2026-10-01", amount: "0" } });
    const before = counts(ctx.store);
    const r = await post({ ...base(), toAccountId: usd.id });
    expectStatus(r, 400, "bank-currency", "TL → USD");
    assert.match(r.error, /farklı para birimli hesaplar arasında transfer yapılamaz/i);
    assert.doesNotMatch(r.error, /döviz al|alım satım/i, "ertelenen özellik önerilmez");
    expectStatus(await post({ ...base(), accountId: usd.id }), 400, "bank-currency", "USD → TL");
    const both = await post({ ...base(), accountId: usd.id, toAccountId: usd2.id });
    expectStatus(both, 400, "bank-currency", "USD → USD");
    assert.doesNotMatch(both.error, /döviz al|alım satım/i);
    assert.deepEqual(counts(ctx.store), before, "reddedilen istek yazmaz");
  });

  it("B2: kaynak = hedef 400; alıcı seçilmedi 400", async () => {
    expectStatus(await post({ ...base(), toAccountId: acc.ziraat.id }), 400, "bank-account-invalid", "aynı hesap");
    expectStatus(await post({ ...base(), toAccountId: "" }), 400, "bank-account-required", "alıcı yok");
    expectStatus(await post({ ...base(), accountId: "" }), 400, "bank-account-required", "gönderen yok");
  });

  it("B5: kredi / vadeli / kart hesabından cari ödemesi 400; kredi ya da kart hesabına Bankalar Arası Transfer 400", async () => {
    const loan = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "Kredi", kind: "loan", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    const card = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Kart", kind: "card", creditLimit: "10.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    const time = await openAccount(ctx.api, { bankName: "İş Bankası", name: "Vadeli", kind: "time", opening: { date: "2026-10-01", amount: "1.000", confirmed: true } });
    const xyz = await must("XYZ", ctx.api.post("/api/workspace/accounts", { name: "XYZ Ltd.", type: "supplier", registeredOn: "2026-10-01" }));
    for (const [account, label] of [[loan, "kredi"], [time, "vadeli"], [card, "kart"]]) {
      expectStatus(await ctx.api.post(`/api/workspace/accounts/${xyz.id}/entries`, { kind: "out", amount: "100", method: "bank", bankAccountId: account.id, date: TODAY }), 400, "bank-account-invalid", `${label} hesabından cari ödemesi`);
    }
    expectStatus(await post({ ...base(), toAccountId: loan.id }), 400, "bank-account-invalid", "kredi hesabına transfer (Kredi Geri Ödemesi ile)");
    expectStatus(await post({ ...base(), accountId: loan.id }), 400, "bank-account-invalid", "kredi hesabından transfer (Kredi Kullanımı ile)");
    expectStatus(await post({ ...base(), toAccountId: card.id }), 400, "bank-account-invalid", "karta transfer (Kart Borcu Ödemesi ile)");
    // Kredi kullanımı Transfer uçundan (plan §7: POST /bank/transfers kredi kullanımı/geri ödemesini de alır).
    const draw = await transfer(ctx.api, { type: "loan_draw", accountId: acc.ziraat.id, loanAccountId: loan.id, amount: "1.000", date: TODAY }, "kredi kullanımı");
    assert.equal(draw.type, "loan_draw");
    expectStatus(await post({ type: "fee", accountId: acc.ziraat.id, amount: "5" }), 400, "bank-voucher-type", "transfer ucundan masraf");
  });

  it("B6: tutar ve ücret sınırları → 400; ücrette KDV'li kip 400; hiçbir satır yazılmaz", async () => {
    const before = counts(ctx.store);
    expectStatus(await post({ ...base(), amount: "1,005" }), 400, "amount-precision", "3 ondalık");
    expectStatus(await post({ ...base(), amount: "0,005" }), 400, "amount-precision", "0,005");
    expectStatus(await post({ ...base(), amount: "-10" }), 400, "amount-range", "eksi");
    expectStatus(await post({ ...base(), amount: "0" }), 400, "amount-range", "sıfır");
    expectStatus(await post({ ...base(), amount: "10000000000000" }), 400, "amount-range", "1e13");
    expectStatus(await post({ ...base(), amount: "on bin" }), 400, "amount-invalid", "metin");
    expectStatus(await post({ ...base(), feeAmount: "-1" }), 400, "amount-range", "eksi ücret");
    expectStatus(await post({ ...base(), feeAmount: "1,001" }), 400, "amount-precision", "ücret 3 ondalık");
    expectStatus(await post({ ...base(), feeAmount: "5", feeTax: "vat_incl" }), 400, "bank-tax", "ücrette KDV'li kip");
    expectStatus(await post({ ...base(), feeAmount: "5", feeType: "kahve" }), 400, "bank-fee-type", "tanınmayan ücret türü");
    expectStatus(await post({ ...base(), channel: "telgraf" }), 400, "bank-channel", "tanınmayan kanal");
    assert.deepEqual(counts(ctx.store), before);
  });

  it("B7: pasif gönderen/alıcı 400; olmayan hesap 404", async () => {
    const passive = await openAccount(ctx.api, { bankName: "Akbank", name: "Pasif", kind: "demand", opening: { date: "2026-10-01", amount: "1.000" } });
    await must("pasife al", ctx.api.post(`${BANK}/accounts/${passive.id}/status`, { status: "passive" }));
    expectStatus(await post({ ...base(), toAccountId: passive.id }), 400, "bank-account-invalid", "pasife");
    expectStatus(await post({ ...base(), accountId: passive.id }), 400, "bank-account-invalid", "pasiften");
    expectStatus(await post({ ...base(), toAccountId: "bacc-yok" }), 404, "bank-account-missing", "olmayan");
  });

  it("B8: başka şirketin hesabı (?hofCompany=) 404; 001'e yazılmaz", async () => {
    const second = await must("002", ctx.api.post("/api/companies", { name: "İkinci Şirket", select: false }));
    const q = `?hofCompany=${encodeURIComponent(second.id || second.company?.id)}`;
    const before = counts(ctx.store);
    expectStatus(await ctx.api.post(`${TRANSFERS}${q}`, base()), 404, "bank-account-missing", "002'den 001'in hesapları");
    assert.deepEqual(counts(ctx.store), before);
  });

  it("B9: kilitli dönem 409, ileri tarih 400, alıcının açılışından önce 409, valör 400, Benzer İşlem'de alıcı anahtarda", async () => {
    const late = await openAccount(ctx.api, { bankName: "QNB", name: "Yeni", kind: "demand", opening: { date: "2026-10-05", amount: "0", confirmed: true } });
    expectStatus(await post({ ...base(), date: "2026-10-09" }), 400, "date-future", "ileri tarih");
    expectStatus(await post({ ...base(), toAccountId: late.id, date: "2026-10-03" }), 409, "bank-before-opening", "alıcının açılışından önce");
    expectStatus(await post({ ...base(), valueDate: "2026-10-07" }), 400, "bank-value-date", "valör işlemden önce");
    expectStatus(await post({ ...base(), valueDate: "2026-11-30" }), 400, "bank-value-date", "valör 30 günden sonra");
    await lockPeriod(ctx.api, "2026-10-03");
    try {
      expectStatus(await post({ ...base(), date: "2026-10-02" }), 409, "period-locked", "kilitli");
    } finally {
      await lockPeriod(ctx.api, "");
    }
  });

  it("B10: aynı istek iki kez → tek olay; aynı kimlik farklı gövde 409; Benzer İşlem (alıcı anahtarda)", async () => {
    const body = { accountId: acc.ziraat.id, toAccountId: acc.garanti.id, amount: "777", date: TODAY };
    const first = await must("ilk", ctx.api.client.post(TRANSFERS, body, { "x-hof-request": "trf0123456789abcdef01" }).then(r => ({ status: r.status, data: r.data?.data ?? r.data })));
    const again = await ctx.api.client.post(TRANSFERS, body, { "x-hof-request": "trf0123456789abcdef01" });
    assert.equal(again.status, 200);
    assert.equal(again.data.data.replayed, true);
    assert.equal(again.data.data.id, first.id);
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM fin_events WHERE type = 'transfer' AND try_minor = 77700").n, 1, "tek olay");
    const reused = await ctx.api.client.post(TRANSFERS, { ...body, amount: "778" }, { "x-hof-request": "trf0123456789abcdef01" });
    assert.equal(reused.status, 409);
    const similar = await post(body);
    expectStatus(similar, 409, "bank-similar", "aynı gün aynı tutar aynı hesaplar");
    assert.match(similar.error, /BNK-/);
    await must("başka alıcıya aynı tutar benzer değil", post({ ...body, toAccountId: (await openAccount(ctx.api, { bankName: "Halkbank", name: "Üçüncü", kind: "demand", opening: { date: "2026-10-01", amount: "0", confirmed: true } })).id }));
    await must("Yine de Kaydet", post({ ...body, similarOk: true }));
    await integrityOk(ctx.api, "B10");
  });

  it("B11: personel 403; Transfer Yapma kaldırılan 403; Ters Kaydet bank.cancel ister", async () => {
    expectStatus(await staffRole.post(TRANSFERS, base()), 403, null, "personel");
    const clerk = apiOf(await createUser(ctx.server, ctx.api.client, { username: "muhasebe9", role: "muhasebe" }));
    const users = await must("kullanıcılar", ctx.api.get("/api/admin/users"));
    const target = users.find(user => user.username === "muhasebe9");
    const patch = remove => ctx.api.client.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove } }).then(res => assert.equal(res.status, 200, JSON.stringify(res.data).slice(0, 300)));
    const mine = await transfer(clerk, { ...base(), amount: "101" }, "muhasebe transfer");
    await patch(["bank.transfer"]);
    expectStatus(await clerk.post(TRANSFERS, { ...base(), amount: "102" }), 403, null, "bank.transfer yok");
    expectStatus(await clerk.post(`${BANK}/events/${mine.id}/reverse`, {}), 403, null, "transferin ters kaydı bank.transfer da ister");
    await patch(["bank.cancel"]);
    expectStatus(await clerk.post(`${BANK}/events/${mine.id}/reverse`, {}), 403, null, "bank.cancel yok");
    expectStatus(await staffRole.post(`${BANK}/events/${mine.id}/reverse`, {}), 403, null, "personel ters kaydedemez");
  });

  it("B12: ekstreyle eşleşmiş transfer Ters Kaydet / Düzelt 409 bank-reconciled; eşleşme kaldırılınca ters kaydedilir", async () => {
    const t = await transfer(ctx.api, { ...base(), amount: "123" });
    rawRun(ctx.db, "INSERT INTO bank_matches (id, line_id, bank_account_id, event_id, amount_minor, digest, kind, score, created_by, created_at) VALUES ('bm-t9', 'line-x', ?, ?, 12300, 'x', 'manual', 80, 'test', ?)", acc.ziraat.id, t.id, new Date().toISOString());
    expectStatus(await ctx.api.post(`${BANK}/events/${t.id}/reverse`, {}), 409, "bank-reconciled", "eşleşmiş ters kaydet");
    expectStatus(await ctx.api.post(`${BANK}/events/${t.id}/correct`, { amount: "1" }), 409, "bank-reconciled", "eşleşmiş düzelt");
    const card = await must("kart", ctx.api.get(`${BANK}/events/${t.id}`));
    assert.equal(card.actions.reverse.allowed, false);
    assert.match(card.actions.reverse.reason, /eşleşmiş/);
    rawRun(ctx.db, "UPDATE bank_matches SET undone_at = ?, undone_by = 'test' WHERE id = 'bm-t9'", new Date().toISOString());
    await must("eşleşme kalkınca ters kaydet", ctx.api.post(`${BANK}/events/${t.id}/reverse`, {}));
  });

  it("B13: banka fişi silinmez (DELETE yolu yok); ters kaydın ters kaydı ve ikinci Ters Kaydet 409", async () => {
    const t = await transfer(ctx.api, { ...base(), amount: "124" });
    const del = await ctx.api.del(`${BANK}/events/${t.id}`);
    assert.ok([404, 405].includes(del.status), `DELETE ${del.status}`);
    const back = await must("ters", ctx.api.post(`${BANK}/events/${t.id}/reverse`, {}));
    expectStatus(await ctx.api.post(`${BANK}/events/${t.id}/reverse`, {}), 409, "bank-already-reversed", "ikinci ters");
    expectStatus(await ctx.api.post(`${BANK}/events/${back.reversal.id}/reverse`, {}), 409, "bank-reversal-of-reversal", "tersin tersi");
    await integrityOk(ctx.api, "B13");
  });

  it("B14: K7 Uyar → 409 bank-negative → negativeOk 200; Engelle → negativeOk ile de 409 bank-blocked", async () => {
    const z = await balance(ctx.api, acc.ziraat);
    const over = String((z + 100_000) / 100).replace(".", ",");
    expectStatus(await post({ ...base(), amount: over }), 409, "bank-negative", "Uyar");
    await setPolicy(ctx.api, acc.garanti, "block");
    const g = await balance(ctx.api, acc.garanti);
    expectStatus(await post({ ...base(), accountId: acc.garanti.id, toAccountId: acc.ziraat.id, amount: String((g + 100) / 100).replace(".", ","), negativeOk: true }), 409, "bank-blocked", "Engelle");
    const moved = await transfer(ctx.api, { ...base(), amount: over, negativeOk: true }, "Yine de Kaydet");
    assert.equal(await balance(ctx.api, acc.ziraat), z - (z + 100_000), "Uyar'da onayla eksiye düşer");
    // Ters kaydı alıcıyı (Garanti, Engelle) eksiye düşürecekse 409 bank-blocked.
    await transfer(ctx.api, { accountId: acc.garanti.id, toAccountId: acc.ziraat.id, amount: String((await balance(ctx.api, acc.garanti)) / 100).replace(".", ","), date: TODAY, similarOk: true }, "Garanti'yi boşalt");
    expectStatus(await ctx.api.post(`${BANK}/events/${moved.id}/reverse`, { negativeOk: true }), 409, "bank-blocked", "ters kayıt Engelle'deki alıcıyı eksiye düşürür");
    await setPolicy(ctx.api, acc.garanti, "");
    await integrityOk(ctx.api, "B14");
  });

  it("B15: planlı transfer — bakiye değişmez; Gerçekleştir iki bacak yazar; aynı hesaplı plan 400", async () => {
    expectStatus(await ctx.api.post(`${BANK}/plans`, { kind: "transfer", accountId: acc.ziraat.id, toAccountId: acc.ziraat.id, amount: "50", plannedDate: TODAY }), 400, "bank-account-invalid", "aynı hesaplı plan");
    const z = await balance(ctx.api, acc.ziraat);
    const g = await balance(ctx.api, acc.garanti);
    const plan = await must("plan", ctx.api.post(`${BANK}/plans`, { kind: "transfer", accountId: acc.ziraat.id, toAccountId: acc.garanti.id, amount: "250", feeAmount: "1", feeTax: "none", feeType: "havale", channel: "havale", plannedDate: TODAY, repeat: "monthly", description: "Aylık aktarım" }));
    assert.equal(plan.typeLabel, "Bankalar Arası Transfer");
    assert.equal(plan.toAccountId, acc.garanti.id);
    assert.equal(await balance(ctx.api, acc.ziraat), z, "plan bakiyeyi değiştirmez");
    const run = await must("gerçekleştir", ctx.api.post(`${BANK}/plans/${plan.id}/execute`, { expectedDate: TODAY, negativeOk: true, similarOk: true }));
    assert.equal(run.event.type, "transfer");
    assert.equal(run.event.transfer.feeMinor, 100);
    assert.equal(run.event.channel, "Havale");
    assert.equal(run.plan.plannedDate, "2026-11-08", "aylık plan bir ay ilerler");
    assert.equal(await balance(ctx.api, acc.ziraat), z - 25_100);
    assert.equal(await balance(ctx.api, acc.garanti), g + 25_000);
    await integrityOk(ctx.api, "B15");
  });

  it("B3: iki AYRI oturum ve bağlantıdan aynı anda iki transfer (Engelle) → biri 200, öbürü 409 bank-blocked; hesap eksiye düşmez", async () => {
    const third = await openAccount(ctx.api, { bankName: "Denizbank", name: "Yarış", kind: "demand", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    // Garanti'yi 70.000'e getir (Ziraat'ten), Engelle.
    const g = await balance(ctx.api, acc.garanti);
    if (g !== 7_000_000) await transfer(ctx.api, g < 7_000_000 ? { accountId: acc.ziraat.id, toAccountId: acc.garanti.id, amount: String((7_000_000 - g) / 100).replace(".", ","), date: TODAY, similarOk: true, negativeOk: true } : { accountId: acc.garanti.id, toAccountId: acc.ziraat.id, amount: String((g - 7_000_000) / 100).replace(".", ","), date: TODAY, similarOk: true }, "Garanti 70.000");
    assert.equal(await balance(ctx.api, acc.garanti), 7_000_000);
    await setPolicy(ctx.api, acc.garanti, "block");
    const second = await createUser(ctx.server, ctx.api.client, { username: "ikinci9", role: "admin" });
    const cookies = [ctx.api.client.cookie, second.cookie];
    assert.ok(cookies[0] && cookies[1] && cookies[0] !== cookies[1], "iki ayrı oturum");
    const sent = [];
    const targets = [acc.ziraat.id, third.id];
    const results = await Promise.all(
      [0, 1].map(i => {
        const call = rawRequest(ctx.server.base, cookies[i], "POST", TRANSFERS, { accountId: acc.garanti.id, toAccountId: targets[i], amount: "40.000", date: TODAY, description: `yarış ${i}` });
        sent.push(process.hrtime.bigint());
        return call;
      }),
    );
    const firstReply = results.map(res => res.received).sort((a, b) => (a < b ? -1 : 1))[0];
    assert.ok(sent.every(at => at < firstReply), "iki istek de ilk yanıttan önce gönderildi");
    const statuses = results.map(res => res.status).sort();
    assert.deepEqual(statuses, [200, 409], JSON.stringify(results.map(res => [res.status, res.code])));
    assert.equal(results.find(res => res.status === 409).code, "bank-blocked");
    assert.equal(await balance(ctx.api, acc.garanti), 3_000_000, "Garanti 30.000; eksiye düşmedi");
    await setPolicy(ctx.api, acc.garanti, "");
    await integrityOk(ctx.api, "B3");
  });

  it("B17 (Aşama 6 #80–81): ekstreyle eşleşmiş Kasa ↔ Banka transferini sil / düzelt → 409 bank-reconciled; personel transferi silemez (403)", async () => {
    const t = await must("bankadan kasaya", ctx.api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: "333", date: TODAY, bankAccountId: acc.ziraat.id, similarOk: true }));
    const leg = ctx.store.get("SELECT event_id FROM cash_entries WHERE id = ?", t.bankId);
    rawRun(ctx.db, "INSERT INTO bank_matches (id, line_id, bank_account_id, event_id, amount_minor, digest, kind, score, created_by, created_at) VALUES ('bm-k9', 'line-k', ?, ?, 33300, 'x', 'manual', 80, 'test', ?)", acc.ziraat.id, leg.event_id, new Date().toISOString());
    expectStatus(await ctx.api.del(`/api/workspace/cash/${t.id}?cashForce=1`), 409, "bank-reconciled", "eşleşmiş Kasa transferini sil");
    expectStatus(await ctx.api.put(`/api/workspace/cash/${t.id}`, { kind: "in", amount: "300", date: TODAY, description: "x" }), 409, "bank-reconciled", "eşleşmiş Kasa transferini düzelt");
    expectStatus(await staffRole.del(`/api/workspace/cash/${t.id}`), 403, null, "personel Kasa transferini silemez");
    rawRun(ctx.db, "UPDATE bank_matches SET undone_at = ?, undone_by = 'test' WHERE id = 'bm-k9'", new Date().toISOString());
    await must("eşleşme kalkınca silinir", ctx.api.del(`/api/workspace/cash/${t.id}?cashForce=1`));
    await integrityOk(ctx.api, "B17");
  });

  it("B16: kapı bank:transfer — ham yazımla tek B / tek A kuralı bozulan transfer Mutabakat Testi'nde görünür", async () => {
    const t = await transfer(ctx.api, { ...base(), amount: "200" });
    const line = ctx.store.get("SELECT * FROM bank_lines WHERE event_id = ? AND side = 'C'", t.id);
    // Alacak satırını ikiye böl (denge ve hesap bağı aynı; yalnız "tek A para satırı" kuralı bozulur).
    rawRun(ctx.db, "UPDATE bank_lines SET try_minor = 10000, fx_minor = 10000 WHERE id = ?", line.id);
    rawRun(ctx.db, "INSERT INTO bank_lines (id, event_id, seq, role, gl, sub, ref, side, try_minor, currency, fx_minor, rate_e6, rate_source, memo) VALUES ('bl-ham-9', ?, 9, 'bank', '102', ?, ?, 'C', 10000, 'TRY', 10000, 1000000, '', '')", t.id, line.sub, line.ref);
    const result = await integrityOf(ctx.api);
    const failed = result.failures.filter(item => item.code.startsWith("bank:transfer"));
    assert.ok(failed.length, `bank:transfer sapmayı görür: ${JSON.stringify(result.failures).slice(0, 500)}`);
    rawRun(ctx.db, "DELETE FROM bank_lines WHERE id = 'bl-ham-9'");
    rawRun(ctx.db, "UPDATE bank_lines SET try_minor = 20000, fx_minor = 20000 WHERE id = ?", line.id);
    await integrityOk(ctx.api, "B16 onarıldı");
  });
});

/** İki ayrı TCP bağlantısıyla (agent: false) ham istek; yanıtın varış anı ölçülür (banka-210-yargic D1 ile aynı yöntem). */
function rawRequest(base, cookie, method, path, body) {
  const url = new URL(base + path);
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = http.request({ host: url.hostname, port: url.port, path: url.pathname, method, agent: false, headers: { cookie, "content-type": "application/json", "content-length": Buffer.byteLength(payload), connection: "close" } }, res => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", chunk => (text += chunk));
      res.on("end", () => {
        let data = {};
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
        resolve({ status: res.statusCode, code: data?.code || "", received: process.hrtime.bigint(), data });
      });
    });
    req.on("error", reject);
    req.end(payload);
  });
}
