// 2.1.0 — Aşama 3 (Banka Hesapları), dilim 1: hesap kartı, seçici (/choices), yetki ve boş şirket (docs/BANKA-MODULU-PLAN.md §3.5, §7,
// §9, §12.3 "Aşama 3"; kanıt docs/2.1.0-KANIT.md "Aşama 3").
//
// ÇALIŞIYOR MU:
//   - Ziraat Bankası · Ana TL Hesabı (Vadesiz, 01.10.2026, 100.000, Bakiye Doğrulandı) → alt hesap 102.01, kod önerilir (ZIR-TL), etiket
//     "Ziraat Bankası · Ana TL Hesabı", eksi bakiye denetimi Uyar; Garanti BBVA · Ana TL Hesabı (50.000) → 102.02; Gerçek Banka 150.000.
//   - Döviz hesabı (USD) açılışı elle kurla: 1.000 USD @ 34,50 → defterde 34.500 TL, döviz bakiyesi 1.000 USD.
//   - Kurumsal kart 309.01, kredi hesabı 300.01; hesap seçici (/choices) yalnız etkin hesapları, kategorisine göre ve bakiyesiz verir; tek
//     uygun hesapta "single".
// NASIL BOZARIM:
//   - Aynı IBAN (boşluklu, küçük harfli yazımla da) → 409 bank-iban-exists; mod 97 tutmayan / eksik haneli IBAN → 400 iban-invalid.
//   - Aynı bankada aynı adlı iki hesap → izinli (kodları farklı); aynı Hesap Kodu (harf büyüklüğü farkıyla) → 409 bank-code-exists.
//   - Döviz türü TL ile, kredi/kart döviz ile → 400 bank-currency; tanınmayan para birimi → 400 currency-unsupported; tanınmayan tür → 400.
//   - Döviz açılışı kur yazılmadan → 400 rate-invalid.
//   - Hareketli hesapta (açılışı olan) para birimi ya da türü değiştir → 409 bank-account-has-movements; hareketsizde 200; 102 ailesinden
//     kredi/karta → 409 bank-kind-family (alt hesap kodu değişmez).
//   - Sil → aynı ad, kod ve IBAN ile yeniden aç → 200, yeni alt hesap kodu (eskisi yeniden kullanılmaz), silinen hesabın açılışı ters kayıtla
//     kapanır (alt hesap bakiyesi 0; mizan dengeli). Pasif hesap seçicide görünmez.
//   - Personel → hesap listesi/açma 403, seçici 200 (bakiye yok); salt okunur lisans → 403 LICENSE_READ_ONLY ve banka yazma yetkileri ekrana
//     gönderilmez; başka şirketin hesap kimliği (?hofCompany=) → 404.
//   - Boş şirkette listeler, özet, seçici, eski hareketler ve alt hesap mizanı 200 ve boş; "Gerçek Banka" tanımsız.
// Her testin sonunda Mutabakat Testi tamam (kapı test kipinde: süzgeç + tam kapı eşdeğerliği).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOk } from "./banka-210-ortak.mjs";
import { createUser, startTestServer, loginAdmin } from "./helpers.mjs";
import { apiOf } from "./banka-210-ortak.mjs";
import { BANK, GARANTI_IBAN, ZIRAAT_IBAN, bootBank, expectStatus, must, openAcceptanceAccounts, openAccount, subBalances, trIban, trialBalances } from "./banka-210-hesap-ortak.mjs";

describe("Aşama 3 — banka hesap kartı", () => {
  let ctx;
  let accounts;
  before(async () => {
    ctx = await bootBank();
    accounts = await openAcceptanceAccounts(ctx.api);
  });
  after(() => ctx.server.close());

  it("çalışıyor mu: Ziraat 102.01 ve Garanti 102.02; kod önerilir, etiket banka · hesap, Bakiye Doğrulandı → Uyar", async () => {
    const { ziraat, garanti } = accounts;
    assert.equal(ziraat.glSub, "102.01");
    assert.equal(ziraat.gl, "102");
    assert.equal(ziraat.kind, "demand");
    assert.equal(ziraat.kindLabel, "Vadesiz");
    assert.equal(ziraat.code, "ZIR-TL");
    assert.equal(ziraat.label, "Ziraat Bankası · Ana TL Hesabı");
    assert.equal(ziraat.iban, ZIRAAT_IBAN);
    assert.equal(ziraat.openingDate, "2026-10-01");
    assert.equal(ziraat.balanceConfirmed, true);
    assert.equal(ziraat.policy, "warn");
    assert.equal(ziraat.policyNote, "");
    assert.equal(ziraat.opening.amountMinor, 10_000_000);
    assert.match(ziraat.opening.no, /^BNK-2026-\d{6}$/);
    assert.equal(ziraat.balanceMinor, 10_000_000);
    assert.equal(garanti.glSub, "102.02");
    assert.equal(garanti.code, "GAR-TL");
    assert.equal(garanti.balanceMinor, 5_000_000);
    const list = await must("liste", ctx.api.get(`${BANK}/accounts`));
    assert.deepEqual(list.accounts.map(item => item.code), ["ZIR-TL", "GAR-TL"]);
    assert.equal(list.totals.realBankMinor, 15_000_000);
    const one = await must("tek hesap", ctx.api.get(`${BANK}/accounts/${ziraat.id}`));
    assert.equal(one.label, ziraat.label);
    await integrityOk(ctx.api, "iki hesap");
  });

  it("nasıl bozarım: aynı IBAN 409 (boşluklu, küçük harfli yazım dahil); geçersiz IBAN 400", async () => {
    const spaced = ZIRAAT_IBAN.toLowerCase().replace(/(.{4})/g, "$1 ");
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "İkinci", kind: "demand", iban: spaced, opening: { date: "2026-10-01", amount: "0" } }), 409, "bank-iban-exists", "aynı IBAN");
    const broken = `${ZIRAAT_IBAN.slice(0, -1)}${(Number(ZIRAAT_IBAN.at(-1)) + 1) % 10}`;
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Bozuk", kind: "demand", iban: broken, opening: { date: "2026-10-01", amount: "0" } }), 400, "iban-invalid", "mod 97");
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Kısa", kind: "demand", iban: "TR12 0001 0000", opening: { date: "2026-10-01", amount: "0" } }), 400, "iban-invalid", "eksik hane");
    const list = await must("liste", ctx.api.get(`${BANK}/accounts`));
    assert.equal(list.accounts.length, 2, "reddedilen istek hesap açmaz");
  });

  it("aynı bankada aynı adlı iki hesap izinli; aynı kod (harf büyüklüğü farkıyla) 409; kod verilmezse tekil öneri", async () => {
    const twin = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "0" } });
    assert.equal(twin.code, "ZIR-TL-2");
    assert.equal(twin.glSub, "102.03");
    assert.equal(twin.label, "Ziraat Bankası · Ana TL Hesabı");
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Üçüncü", code: "zir-tl", kind: "demand", opening: { date: "2026-10-01", amount: "0" } }), 409, "bank-code-exists", "aynı kod");
    expectStatus(await ctx.api.put(`${BANK}/accounts/${twin.id}`, { code: "GAR-TL" }), 409, "bank-code-exists", "düzeltmede aynı kod");
    const renamed = await must("kod değiştir", ctx.api.put(`${BANK}/accounts/${twin.id}`, { code: "ZRT-YEDEK", name: "Yedek Hesap" }));
    assert.equal(renamed.code, "ZRT-YEDEK");
    assert.equal(renamed.glSub, "102.03", "alt hesap kodu değişmez");
    await integrityOk(ctx.api, "ikiz hesap");
  });

  it("tür ve para birimi: döviz hesabı elle kurla; geçersiz eşleşmeler 400", async () => {
    const usd = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "USD Hesabı", currency: "USD", kind: "demand", opening: { date: "2026-10-01", amount: "1.000", rate: "34,50", confirmed: true } });
    assert.equal(usd.kind, "fx", "TL dışı para biriminde tür Döviz olur");
    assert.equal(usd.currency, "USD");
    assert.equal(usd.code, "ZIR-USD");
    assert.equal(usd.balanceMinor, 3_450_000, "defterde TL karşılığı");
    assert.equal(usd.fxBalanceMinor, 100_000, "döviz bakiyesi (sent)");
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Kursuz", currency: "EUR", kind: "fx", opening: { date: "2026-10-01", amount: "500" } }), 400, "rate-invalid", "kur yok");
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "TL Döviz", currency: "TRY", kind: "fx", opening: { date: "2026-10-01", amount: "0" } }), 400, "bank-currency", "döviz türü TL");
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "USD Kart", currency: "USD", kind: "card", opening: { date: "2026-10-01", amount: "0" } }), 400, "bank-currency", "döviz kart");
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "JPY", currency: "JPY", kind: "demand", opening: { date: "2026-10-01", amount: "0" } }), 400, "currency-unsupported", "tanınmayan para birimi");
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Tür", kind: "bitcoin", opening: { date: "2026-10-01", amount: "0" } }), 400, "bank-kind", "tanınmayan tür");
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { bankName: "", name: "Adsız", kind: "demand", opening: { date: "2026-10-01", amount: "0" } }), 400, "bank-name-required", "banka adı yok");
    const card = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "Şirket Kartı", kind: "card", creditLimit: "50.000", opening: { date: "2026-10-01", amount: "2.000", confirmed: true } });
    assert.equal(card.gl, "309");
    assert.equal(card.glSub, "309.01");
    assert.equal(card.code, "GAR-KART");
    assert.equal(card.balanceMinor, -200_000, "kart borcu eksi bakiye");
    assert.equal(card.creditLimitMinor, 5_000_000);
    const loan = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "İşletme Kredisi", kind: "loan", opening: { date: "2026-10-01", amount: "10.000", confirmed: true } });
    assert.equal(loan.gl, "300");
    assert.equal(loan.glSub, "300.01");
    const trial = await trialBalances(ctx.api);
    assert.equal(trial["309"], -2000);
    assert.equal(trial["300"], -10000);
    await integrityOk(ctx.api, "döviz, kart ve kredi");
  });

  it("nasıl bozarım: hareketli hesapta para birimi/tür 409; hareketsizde değişir; 102 ailesinden karta 409", async () => {
    const empty = await openAccount(ctx.api, { bankName: "Halkbank", name: "Boş Hesap", kind: "demand", opening: { date: "2026-10-01", amount: "0" } });
    const asUsd = await must("hareketsiz para birimi", ctx.api.put(`${BANK}/accounts/${empty.id}`, { currency: "USD" }));
    assert.equal(asUsd.currency, "USD");
    assert.equal(asUsd.kind, "fx");
    const back = await must("geri TL", ctx.api.put(`${BANK}/accounts/${empty.id}`, { currency: "TRY", kind: "commercial" }));
    assert.equal(back.kind, "commercial");
    expectStatus(await ctx.api.put(`${BANK}/accounts/${empty.id}`, { kind: "card" }), 409, "bank-kind-family", "102'den karta");
    expectStatus(await ctx.api.put(`${BANK}/accounts/${accounts.ziraat.id}`, { currency: "USD" }), 409, "bank-account-has-movements", "hareketli para birimi");
    expectStatus(await ctx.api.put(`${BANK}/accounts/${accounts.ziraat.id}`, { kind: "commercial" }), 409, "bank-account-has-movements", "hareketli tür");
    const info = await must("bilgi düzeltme", ctx.api.put(`${BANK}/accounts/${accounts.ziraat.id}`, { branchName: "Kızılay Şubesi", description: "<b>maaş</b> hesabı" }));
    assert.equal(info.branchName, "Kızılay Şubesi");
    assert.equal(info.description, "<b>maaş</b> hesabı", "metin olduğu gibi saklanır (kaçış istemcide)");
    await integrityOk(ctx.api, "tür değişimi");
  });

  it("pasife alma: seçicide ve etkin listede görünmez; yeniden etkin olur", async () => {
    const before = await must("seçici", ctx.api.get(`${BANK}/choices`));
    assert.ok(before.accounts.some(item => item.id === accounts.garanti.id));
    await must("pasif", ctx.api.post(`${BANK}/accounts/${accounts.garanti.id}/status`, { status: "passive" }));
    const choices = await must("seçici pasif", ctx.api.get(`${BANK}/choices`));
    assert.ok(!choices.accounts.some(item => item.id === accounts.garanti.id), "pasif hesap seçicide yok");
    const active = await must("etkin liste", ctx.api.get(`${BANK}/accounts?status=active`));
    assert.ok(!active.accounts.some(item => item.id === accounts.garanti.id));
    const all = await must("tüm liste", ctx.api.get(`${BANK}/accounts?status=all`));
    assert.equal(all.accounts.find(item => item.id === accounts.garanti.id).status, "passive");
    expectStatus(await ctx.api.post(`${BANK}/accounts/${accounts.garanti.id}/status`, { status: "deleted" }), 400, "bank-status", "tanınmayan durum");
    await must("etkin", ctx.api.post(`${BANK}/accounts/${accounts.garanti.id}/status`, { status: "active" }));
    const after = await must("seçici etkin", ctx.api.get(`${BANK}/choices`));
    assert.ok(after.accounts.some(item => item.id === accounts.garanti.id));
  });

  it("seçici: kategoriler, tek hesapta single, bakiye dönmez", async () => {
    const choices = await must("seçici", ctx.api.get(`${BANK}/choices`));
    for (const item of choices.accounts) assert.ok(!("balanceMinor" in item) && !("balance" in item), `bakiye dönmemeli: ${JSON.stringify(item)}`);
    assert.ok(choices.forms.bank.ids.includes(accounts.ziraat.id));
    assert.ok(!choices.forms.bank.ids.some(id => choices.accounts.find(item => item.id === id)?.currency !== "TRY"), "havale seçicisinde yalnız TL hesap");
    assert.equal(choices.forms.bank.single, false);
    assert.equal(choices.forms.bank.required, true);
    assert.equal(choices.forms.card.ids.length, 1);
    assert.equal(choices.forms.card.single, true);
    assert.ok(choices.forms.bank.defaultId, "varsayılan tahsilat hesabı");
  });

  it("nasıl bozarım: sil → aynı ad, kod ve IBAN ile yeniden aç; alt hesap kodu yeniden kullanılmaz; açılış ters kayıtla kapanır", async () => {
    const iban = trIban(12, 99);
    const doomed = await openAccount(ctx.api, { bankName: "Vakıfbank", name: "Silinecek", code: "VKF-SIL", kind: "demand", iban, opening: { date: "2026-10-02", amount: "1.500", confirmed: true } });
    const removed = await must("sil", ctx.api.del(`${BANK}/accounts/${doomed.id}`));
    assert.equal(removed.deleted, true);
    assert.match(removed.reversed || "", /^BNK-2026-/, "açılış ters kaydedilir");
    expectStatus(await ctx.api.get(`${BANK}/accounts/${doomed.id}`), 404, null, "silinen hesap");
    expectStatus(await ctx.api.put(`${BANK}/accounts/${doomed.id}`, { name: "x" }), 404, null, "silinen hesap düzelt");
    const again = await openAccount(ctx.api, { bankName: "Vakıfbank", name: "Silinecek", code: "VKF-SIL", kind: "demand", iban, opening: { date: "2026-10-02", amount: "700", confirmed: true } });
    assert.notEqual(again.glSub, doomed.glSub, "alt hesap kodu yeniden kullanılmaz");
    const subs = await subBalances(ctx.api);
    assert.equal(subs[doomed.glSub].balance, 0, "silinen hesabın alt hesabı sıfır");
    assert.equal(subs[again.glSub].balance, 700);
    await integrityOk(ctx.api, "sil ve yeniden aç");
  });

  it("nasıl bozarım: başka şirketin hesap kimliği 404; şirketler ayrı", async () => {
    const second = await must("002", ctx.api.post("/api/companies", { name: "İkinci Şirket", select: false }));
    const id = second.id || second.company?.id;
    const q = `?hofCompany=${encodeURIComponent(id)}`;
    expectStatus(await ctx.api.get(`${BANK}/accounts/${accounts.ziraat.id}${q}`), 404, null, "002'de 001'in hesabı");
    expectStatus(await ctx.api.post(`${BANK}/accounts/${accounts.ziraat.id}/opening${q}`, { date: "2026-10-01", amount: "1" }), 404, null, "002'de 001'in hesabına açılış");
    const theirs = await must("002 hesap", ctx.api.post(`${BANK}/accounts${q}`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", iban: ZIRAAT_IBAN, opening: { date: "2026-10-01", amount: "5" } }));
    assert.equal(theirs.glSub, "102.01", "her şirketin alt hesapları kendi sırasıyla");
    const mine = await must("001 liste", ctx.api.get(`${BANK}/accounts`));
    assert.ok(!mine.accounts.some(item => item.id === theirs.id), "001'de 002'nin hesabı yok");
    // Boş şirket (002'de yeni hesaptan önce) dışında: 002'nin özetinde yalnız kendi hesabı.
    const summary = await must("002 özet", ctx.api.get(`${BANK}/summary${q}`));
    assert.equal(summary.realBank.minor, 500);
  });
});

describe("Aşama 3 — yetki, salt okunur lisans ve boş şirket", () => {
  it("personel: hesap listesi, açma, açılış, sihirbaz, ayarlar 403; seçici 200 ve bakiyesiz", async () => {
    const ctx = await bootBank();
    try {
      const { ziraat } = await openAcceptanceAccounts(ctx.api);
      const staff = apiOf(await createUser(ctx.server, ctx.api.client, { username: "personel1", role: "personel" }));
      for (const [method, url, body] of [
        ["get", `${BANK}/accounts`],
        ["get", `${BANK}/accounts/${ziraat.id}`],
        ["post", `${BANK}/accounts`, { bankName: "X", name: "Y", kind: "demand", opening: { date: "2026-10-01", amount: "0" } }],
        ["put", `${BANK}/accounts/${ziraat.id}`, { name: "Sızma" }],
        ["post", `${BANK}/accounts/${ziraat.id}/opening`, { date: "2026-10-01", amount: "1" }],
        ["post", `${BANK}/setup?dryRun=1`, { accountId: ziraat.id }],
        ["get", `${BANK}/legacy`],
        ["get", `${BANK}/summary`],
        ["get", `${BANK}/settings`],
        ["get", `${BANK}/sub-trial`],
      ]) {
        const res = await staff[method](url, body);
        assert.equal(res.status, 403, `${method} ${url}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
      }
      const choices = await must("personel seçici", staff.get(`${BANK}/choices`));
      assert.equal(choices.accounts.length, 2);
      for (const item of choices.accounts) assert.ok(!("balanceMinor" in item));
      const fresh = await must("hesap", ctx.api.get(`${BANK}/accounts/${ziraat.id}`));
      assert.equal(fresh.name, "Ana TL Hesabı", "personelin düzeltmesi yazılmadı");
    } finally {
      await ctx.server.close();
    }
  });

  it("salt okunur lisans: banka yazımı 403 LICENSE_READ_ONLY; banka yazma yetkileri ekrana gönderilmez (fatura yönetimi de)", async () => {
    const server = await startTestServer({ now: "2026-10-08T12:00:00+03:00", license: { enforce: true, machineId: "0123456789abcdef0123456789abcdef", services: ["https://lisans.test/api/lisans"], fetchImpl: async () => { throw new TypeError("fetch failed"); }, firstCheckDelayMs: 3_600_000 } });
    try {
      const api = apiOf(await loginAdmin(server));
      const me = await must("ben", api.get("/api/auth/me"));
      for (const key of ["bank.accounts", "bank.move", "bank.cancel", "bank.transfer", "bank.settings", "invoices.manage", "invoices.settings"]) assert.ok(!me.permissions.includes(key), `${key} salt okunurda gönderilmemeli`);
      assert.ok(me.permissions.includes("bank.view"), "görme yetkisi kalır");
      const res = await api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "1" } });
      expectStatus(res, 403, "LICENSE_READ_ONLY", "salt okunur");
      assert.equal((await must("liste", api.get(`${BANK}/accounts`))).accounts.length, 0);
    } finally {
      await server.close();
    }
  });

  it("boş şirket: listeler, özet, seçici, eski hareketler, alt hesap mizanı, ayarlar 200 ve boş; sihirbaz hesabı bulamaz", async () => {
    const ctx = await bootBank();
    try {
      const list = await must("liste", ctx.api.get(`${BANK}/accounts`));
      assert.deepEqual(list.accounts, []);
      assert.equal(list.totals.realBankMinor, 0);
      const summary = await must("özet", ctx.api.get(`${BANK}/summary`));
      assert.equal(summary.realBank.defined, false, "hesap yokken Gerçek Banka tanımsız (—)");
      assert.equal(summary.setup.needed, true);
      const choices = await must("seçici", ctx.api.get(`${BANK}/choices`));
      assert.deepEqual(choices.accounts, []);
      assert.equal(choices.forms.bank.required, false, "hesap yokken seçim zorunlu değil (eski davranış)");
      const legacy = await must("eski", ctx.api.get(`${BANK}/legacy`));
      assert.deepEqual(legacy.rows, []);
      assert.equal(legacy.totals.bankMinor, 0);
      const trial = await must("alt hesap mizanı", ctx.api.get(`${BANK}/sub-trial`));
      assert.deepEqual(trial.rows, []);
      await must("ayarlar", ctx.api.get(`${BANK}/settings`));
      const runs = await must("kurulumlar", ctx.api.get(`${BANK}/setup`));
      assert.deepEqual(runs.runs, []);
      expectStatus(await ctx.api.post(`${BANK}/setup?dryRun=1`, { accountId: "bacc-yok" }), 404, null, "hesap yok");
      expectStatus(await ctx.api.get(`${BANK}/accounts/bacc-yok`), 404, null, "hesap yok");
      await integrityOk(ctx.api, "boş şirket");
      const integrity = await must("Mutabakat Testi", ctx.api.get("/api/workspace/ledger/integrity"));
      assert.ok(!integrity.checks.some(item => item.code.startsWith("bank:opening") || item.code.startsWith("bank:voucher")), "banka kullanılmayan kurulumda yeni denetimler listede görünmez");
    } finally {
      await ctx.server.close();
    }
  });
});
