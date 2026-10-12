// 2.2.0 İz 2.2 + 2.3 — banka hesabının kullanım işaretleri (Kredi Kartı / Çek / Senet / POS Kullan) ve kurumsal kartın bankanın İÇİNDEN
// tanımlanması (docs/2.2.0-IS-LISTESI.md; CLAUDE.md 12.10.2026 müşteri isteği "kredi kartlarını bankaya bağlamak gerekiyor; Yapı Kredi'yi
// iki kere mi kaydedeceğiz?"; plan §3.5 kart 309.NN, §9.2/10 kart numarası saklanmaz yalnız son 4 hane).
//
// Kök neden (2.1.0, koddan): her kurumsal kart ayrı bank_accounts satırı; banka adı serbest metin; vadesiz hesapla BAĞ YOK (parent_id kolonu
// yok); Hesaplar listesinde kart bankasının altında görünmüyor; hesapta işaret yok.
//
// NASIL BOZARIM (önce yazıldı; testler buradan, adlarında [Nn]):
//   N1  Eski veri: göç 21 öncesi açılmış hesap/kart/çek → işaretler 0, kart bağsız (kendiliğinden BAĞLANMAZ), çek metni aynı, satır sayıları
//       aynı; göç iki kez koşsa da aynı (yalnız ekleyici).
//   N2  İşaret yanlış türde: Vadeli / Kredi / Kart hesapta Kredi Kartı-Çek-Senet-POS Kullan → 400 bank-flag-kind, yazılmaz.
//   N3  Kart bankanın içinden: parentId → kart açılır, banka adı bankadan, bankanın "Kredi Kartı Kullan"ı kendiliğinden açılır; bir bankada
//       iki kart, başka bankada üçüncü; Hesaplar listesinde kart bankasının HEMEN ALTINDA (depth 1), bağsız eski kart yerinde (depth 0).
//   N4  Bağlı banka bozuk: yok → 404; pasif → 400; Vadeli/Kredi/Kart → 400; kart olmayan türe parentId → 400; kart kendisine bağlanamaz.
//   N5  Son 4 hane: "12345", "12a4" → 400; Vadesiz hesapta son 4 hane → 400; boş serbest.
//   N6  Kartlı bankada "Kredi Kartı Kullan" kapat → 409 bank-flag-in-use; kartlı banka sil → 409 bank-account-has-cards; hareketsiz kartlı
//       bankayı Vadeli'ye çevir → 409; kart başka bankaya taşınınca hepsi serbest.
//   N7  Banka adı değişir → altındaki kartların banka adı da değişir; bağlı kartın banka adını tek başına değiştirmek → 400.
//   N8  Eski (bağsız) kart: aynı bankanın hesabı ÖNERİLİR (parentSuggestions), kendiliğinden bağlanmaz; "Bağla" (PUT parentId) bağlar.
//   N9  API'nin eski yolu (bankasız kind card) 200 kalır (geriye uyumlu; karar).
//   N10 Yetki: Banka Hesabı Tanımlama (bank.accounts) yetkisi olmayan avukat kart ekleyemez, işaret değiştiremez (403).
//   N11 Para etkisi yok: kart bankaya bağlanınca/taşınınca Gerçek Banka, kart borcu, mizan ve Mutabakat Testi aynı.
//   N12 İşaretli hareketsiz hesap Vadeli'ye çevrilince işaretler kalkar (Vadeli hesapta işaret olmaz).
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { apiOf, integrityOk } from "./banka-210-ortak.mjs";
import { BANK, bootBank, expectStatus, must, openAccount, trialBalances } from "./banka-210-hesap-ortak.mjs";
import { LATEST_VERSION, MIGRATIONS } from "../server/lib/migrations.mjs";

const opening = (amount = "0", confirmed = true) => ({ date: "2026-10-01", amount, confirmed });
const accountsList = async api => (await must("hesaplar", api.get(`${BANK}/accounts?status=all`))).accounts;
const detail = (api, id) => must("hesap", api.get(`${BANK}/accounts/${id}`));

describe("2.2.0 İz 2.2–2.3: hesap işaretleri ve kartın bağlı bankası", () => {
  let ctx;
  before(async () => {
    ctx = await bootBank();
  });
  after(async () => {
    await ctx?.server.close();
  });

  it("[N1] göç 21 yalnız ekleyici: eski hesap/kart/çek değişmez, işaretler kapalı, kart bağsız; iki kez koşsa da aynı", () => {
    assert.ok(LATEST_VERSION >= 21, `son göç ${LATEST_VERSION}`);
    const v21 = MIGRATIONS.find(item => item.version === 21);
    assert.ok(v21, "göç 21 tanımlı");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "destekofis-goc21-"));
    const db = new DatabaseSync(path.join(dir, "v20.sqlite"));
    try {
      // v20 düzeni (2.1.0'ın tablosu) + 2.1.0'ın yazdığı gibi satırlar.
      db.exec(`CREATE TABLE bank_accounts (id TEXT PRIMARY KEY, code TEXT NOT NULL, gl TEXT NOT NULL, gl_sub TEXT NOT NULL, kind TEXT NOT NULL, bank_name TEXT NOT NULL, name TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'TRY', opening_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active', position INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL, created_at TEXT NOT NULL, deleted_at TEXT) STRICT;
        CREATE TABLE cheques (id TEXT PRIMARY KEY, direction TEXT NOT NULL, instrument TEXT NOT NULL, bank TEXT NOT NULL DEFAULT '', amount REAL NOT NULL, status TEXT NOT NULL, deleted_at TEXT);
        INSERT INTO bank_accounts (id, code, gl, gl_sub, kind, bank_name, name, opening_date, created_by, created_at) VALUES ('b1', 'YAP-TL', '102', '102.01', 'demand', 'Yapı Kredi', 'TL', '2026-10-01', 't', 'x'), ('k1', 'YAP-KART', '309', '309.01', 'card', 'Yapı Kredi', 'World', '2026-10-01', 't', 'x');
        INSERT INTO cheques (id, direction, instrument, bank, amount, status) VALUES ('c1', 'out', 'cheque', 'Ziraat Bankası Meram', 1500, 'pending');`);
      const store = { exec: sql => db.exec(sql), get: (sql, ...args) => db.prepare(sql).get(...args), all: (sql, ...args) => db.prepare(sql).all(...args), run: (sql, ...args) => db.prepare(sql).run(...args), raw: (_, fn) => fn() };
      v21.up(store);
      v21.up(store);
      const rows = db.prepare("SELECT id, bank_name AS bankName, name, parent_id AS parentId, card_last4 AS last4, use_card AS a, use_cheque AS b, use_note AS c, use_pos AS d FROM bank_accounts ORDER BY id").all();
      assert.deepEqual(rows.map(row => ({ ...row })), [
        { id: "b1", bankName: "Yapı Kredi", name: "TL", parentId: "", last4: "", a: 0, b: 0, c: 0, d: 0 },
        { id: "k1", bankName: "Yapı Kredi", name: "World", parentId: "", last4: "", a: 0, b: 0, c: 0, d: 0 },
      ]);
      const cheque = db.prepare("SELECT bank, bank_account_id AS account FROM cheques WHERE id = 'c1'").get();
      assert.deepEqual({ ...cheque }, { bank: "Ziraat Bankası Meram", account: "" }, "eski çekin metni korunur, hesabı boş");
    } finally {
      db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("[N2] işaret yalnız Vadesiz/Ticari/Diğer TL hesapta; Vadeli, Kredi ve kartta 400 bank-flag-kind", async () => {
    const yk = await openAccount(ctx.api, { bankName: "Yapı Kredi", name: "TL Hesabı", kind: "demand", useCard: true, useCheque: true, useNote: true, usePos: false, opening: opening("10.000") });
    assert.deepEqual([yk.useCard, yk.useCheque, yk.useNote, yk.usePos], [true, true, true, false]);
    ctx.yk = yk;
    for (const kind of ["time", "loan", "card"]) {
      for (const flag of ["useCard", "useCheque", "useNote", "usePos"]) {
        const res = await ctx.api.post(`${BANK}/accounts`, { bankName: "Garanti BBVA", name: `Yanlış ${kind} ${flag}`, kind, [flag]: true, opening: opening() });
        expectStatus(res, 400, "bank-flag-kind", `${kind} + ${flag}`);
      }
    }
    assert.equal((await accountsList(ctx.api)).filter(account => account.name.startsWith("Yanlış")).length, 0, "hiçbiri yazılmadı");
    const time = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "Vadeli", kind: "time", opening: opening() });
    expectStatus(await ctx.api.put(`${BANK}/accounts/${time.id}`, { useCheque: true }), 400, "bank-flag-kind", "vadeliye işaret (düzelt)");
  });

  it("[N3] kart bankanın içinden: banka adı bankadan, Kredi Kartı Kullan kendiliğinden, iki kart + başka banka; listede bankanın altında", async () => {
    const plain = await openAccount(ctx.api, { bankName: "Akbank", name: "Ticari Hesap", kind: "commercial", opening: opening("5.000") });
    assert.equal(plain.useCard, false);
    const world = await openAccount(ctx.api, { kind: "card", parentId: ctx.yk.id, name: "World", cardLast4: "1234", creditLimit: "50.000", statementDay: 5, dueDay: 15, opening: opening("0", true) });
    assert.equal(world.bankName, "Yapı Kredi", "kartın banka adı bankadan");
    assert.equal(world.parentId, ctx.yk.id);
    assert.equal(world.cardLast4, "1234");
    assert.equal(world.label, "Yapı Kredi · World");
    assert.equal(world.creditLimitMinor, 5_000_000);
    const play = await openAccount(ctx.api, { kind: "card", parentId: ctx.yk.id, name: "Play", cardLast4: "9876", opening: opening() });
    const axess = await openAccount(ctx.api, { kind: "card", parentId: plain.id, name: "Axess", opening: opening() });
    assert.equal((await detail(ctx.api, plain.id)).useCard, true, "Akbank'ın Kredi Kartı Kullan işareti kart eklenince açıldı");
    const ykView = await detail(ctx.api, ctx.yk.id);
    assert.deepEqual(ykView.cards.map(card => card.name), ["World", "Play"], "Yapı Kredi'nin kartları");
    assert.equal(ykView.cards[0].cardLast4, "1234");
    const list = await accountsList(ctx.api);
    const at = id => list.findIndex(account => account.id === id);
    assert.ok(at(world.id) === at(ctx.yk.id) + 1 && at(play.id) === at(ctx.yk.id) + 2, `kartlar Yapı Kredi'nin hemen altında: ${list.map(item => item.label).join(" | ")}`);
    assert.equal(at(axess.id), at(plain.id) + 1, "Axess Akbank'ın altında");
    assert.deepEqual([list[at(world.id)].depth, list[at(ctx.yk.id)].depth], [1, 0]);
    const legacy = await openAccount(ctx.api, { bankName: "Yapı Kredi Bankası", name: "Eski Kart", kind: "card", opening: opening() });
    const after = await accountsList(ctx.api);
    assert.equal(after.find(account => account.id === legacy.id).depth, 0, "[N9] bankasız (eski yol) kart açıldı, girintisiz");
    assert.equal(after.find(account => account.id === legacy.id).parentId, "");
    Object.assign(ctx, { world, play, axess, akbank: plain, legacy });
    // Seçici: kart hesapları bağlı bankası ve son 4 hanesiyle.
    const choices = await must("seçici", ctx.api.get(`${BANK}/choices`));
    const worldChoice = choices.accounts.find(account => account.id === world.id);
    assert.equal(worldChoice.parentId, ctx.yk.id);
    assert.equal(worldChoice.cardLast4, "1234");
    assert.ok(choices.forms.card.ids.includes(world.id) && choices.forms.card.ids.includes(legacy.id));
    assert.deepEqual(choices.forms.cheque.ids, [ctx.yk.id], "Çek Hesabı yalnız Çek Kullan işaretli");
    assert.deepEqual(choices.forms.note.ids, [ctx.yk.id], "senet önerisi yalnız Senet Kullan işaretli");
  });

  it("[N4] bağlı banka bozuk: yok 404, pasif / vadeli / kredi / kart 400, kart dışı türe parentId 400, kart kendisine 400", async () => {
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { kind: "card", parentId: "bacc-yok", name: "X", opening: opening() }), 404, "bank-account-missing", "olmayan banka");
    const passive = await openAccount(ctx.api, { bankName: "Halkbank", name: "Pasif", kind: "demand", opening: opening() });
    await must("pasife al", ctx.api.post(`${BANK}/accounts/${passive.id}/status`, { status: "passive" }));
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { kind: "card", parentId: passive.id, name: "X", opening: opening() }), 400, "bank-parent-invalid", "pasif banka");
    const loan = await openAccount(ctx.api, { bankName: "Halkbank", name: "Kredi", kind: "loan", opening: opening() });
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { kind: "card", parentId: loan.id, name: "X", opening: opening() }), 400, "bank-parent-invalid", "kredi hesabı banka olamaz");
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { kind: "card", parentId: ctx.world.id, name: "X", opening: opening() }), 400, "bank-parent-invalid", "kart banka olamaz");
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { kind: "demand", bankName: "X", parentId: ctx.yk.id, name: "X", opening: opening() }), 400, "bank-parent-kind", "vadesize parentId");
    expectStatus(await ctx.api.put(`${BANK}/accounts/${ctx.akbank.id}`, { parentId: ctx.yk.id }), 400, "bank-parent-kind", "vadesiz bankaya parentId");
    expectStatus(await ctx.api.put(`${BANK}/accounts/${ctx.world.id}`, { parentId: ctx.world.id }), 400, "bank-parent-invalid", "kart kendisine");
    assert.equal((await accountsList(ctx.api)).filter(account => account.name === "X").length, 0, "hiçbiri yazılmadı");
  });

  it("[N5] son 4 hane: 5 hane, harf, vadesizde 400; boş serbest", async () => {
    for (const bad of ["12345", "12a4", "123"]) expectStatus(await ctx.api.post(`${BANK}/accounts`, { kind: "card", parentId: ctx.yk.id, name: `Son4 ${bad}`, cardLast4: bad, opening: opening() }), 400, "bank-card-last4", `son 4 "${bad}"`);
    expectStatus(await ctx.api.post(`${BANK}/accounts`, { kind: "demand", bankName: "Ziraat", name: "Son4 vadesiz", cardLast4: "1234", opening: opening() }), 400, "bank-card-last4", "vadesizde son 4");
    expectStatus(await ctx.api.put(`${BANK}/accounts/${ctx.world.id}`, { cardLast4: "12 345" }), 400, "bank-card-last4", "düzeltmede 5 hane");
    const changed = await must("son 4 düzelt", ctx.api.put(`${BANK}/accounts/${ctx.world.id}`, { cardLast4: "4321" }));
    assert.equal(changed.cardLast4, "4321");
  });

  it("[N6][N12] kartlı bankada işaret kapatma / silme / Vadeli'ye çevirme 409; kart taşınınca serbest", async () => {
    expectStatus(await ctx.api.put(`${BANK}/accounts/${ctx.akbank.id}`, { useCard: false }), 409, "bank-flag-in-use", "kartlı bankada Kredi Kartı Kullan kapat");
    expectStatus(await ctx.api.del(`${BANK}/accounts/${ctx.akbank.id}`), 409, "bank-account-has-cards", "kartlı Akbank'ı sil");
    const empty = await openAccount(ctx.api, { bankName: "QNB", name: "Boş Hesap", kind: "demand", useCheque: true, opening: opening() });
    const qnbCard = await openAccount(ctx.api, { kind: "card", parentId: empty.id, name: "QNB Kart", opening: opening() });
    expectStatus(await ctx.api.del(`${BANK}/accounts/${empty.id}`), 409, "bank-account-has-cards", "kartlı bankayı sil");
    expectStatus(await ctx.api.put(`${BANK}/accounts/${empty.id}`, { kind: "time" }), 409, "bank-account-has-cards", "kartlı bankayı Vadeli'ye çevir");
    const moved = await must("kartı taşı", ctx.api.put(`${BANK}/accounts/${qnbCard.id}`, { parentId: ctx.akbank.id }));
    assert.equal(moved.parentId, ctx.akbank.id);
    assert.equal(moved.bankName, "Akbank", "taşınan kartın banka adı yeni bankadan");
    const flagsOff = await must("işareti kapat", ctx.api.put(`${BANK}/accounts/${empty.id}`, { useCard: false }));
    assert.equal(flagsOff.useCard, false);
    const time = await must("Vadeli'ye çevir", ctx.api.put(`${BANK}/accounts/${empty.id}`, { kind: "time" }));
    assert.equal(time.kind, "time");
    assert.deepEqual([time.useCard, time.useCheque, time.useNote, time.usePos], [false, false, false, false], "[N12] Vadeli'de işaret kalmadı");
    await must("sil", ctx.api.del(`${BANK}/accounts/${empty.id}`));
    ctx.qnbCard = moved;
  });

  it("[N7] banka adı değişince kartlarının adı da değişir; bağlı kartın banka adını tek başına değiştirmek 400", async () => {
    const renamed = await must("banka adı", ctx.api.put(`${BANK}/accounts/${ctx.yk.id}`, { bankName: "Yapı Kredi Bankası" }));
    assert.equal(renamed.bankName, "Yapı Kredi Bankası");
    for (const id of [ctx.world.id, ctx.play.id]) assert.equal((await detail(ctx.api, id)).bankName, "Yapı Kredi Bankası", "kartın banka adı da değişti");
    expectStatus(await ctx.api.put(`${BANK}/accounts/${ctx.world.id}`, { bankName: "Garanti BBVA" }), 400, "bank-card-bank-name", "bağlı kartın banka adı");
    await must("geri adlandır", ctx.api.put(`${BANK}/accounts/${ctx.yk.id}`, { bankName: "Yapı Kredi" }));
  });

  it("[N8][N11] eski kart: aynı bankanın hesabı önerilir, kendiliğinden bağlanmaz; Bağla → bağlanır; para tarafı değişmez", async () => {
    const legacy = await detail(ctx.api, ctx.legacy.id);
    assert.equal(legacy.parentId, "", "kendiliğinden bağlanmadı");
    assert.deepEqual(legacy.parentSuggestions.map(item => item.id), [ctx.yk.id], `öneri: ${JSON.stringify(legacy.parentSuggestions)}`);
    // Kart borcu: 2.000 TL kartla ödeme (Mutabakat ve mizan bağdan önce ve sonra aynı).
    const party = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Tedarikçi Ltd.", type: "supplier" }));
    await must("kartla ödeme", ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "out", method: "card", amount: "2.000", date: "2026-10-08", bankAccountId: ctx.legacy.id, negativeOk: true }));
    const summaryBefore = await must("özet", ctx.api.get(`${BANK}/summary`));
    const trialBefore = await trialBalances(ctx.api);
    const linked = await must("bağla", ctx.api.put(`${BANK}/accounts/${ctx.legacy.id}`, { parentId: ctx.yk.id }));
    assert.equal(linked.parentId, ctx.yk.id);
    assert.equal(linked.bankName, "Yapı Kredi", "bağlanan kartın banka adı bankanınki oldu");
    assert.deepEqual(linked.parentSuggestions, [], "bağlı kartta öneri yok");
    const summaryAfter = await must("özet", ctx.api.get(`${BANK}/summary`));
    assert.equal(summaryAfter.realBank.minor, summaryBefore.realBank.minor, "Gerçek Banka değişmedi");
    assert.equal(summaryAfter.debt.cardMinor, summaryBefore.debt.cardMinor, "kart borcu değişmedi");
    assert.equal(summaryAfter.debt.cardMinor, 200_000, "kart borcu 2.000");
    assert.deepEqual(await trialBalances(ctx.api), trialBefore, "mizan değişmedi");
    await integrityOk(ctx.api, "bağdan sonra");
    const audit = ctx.store.all("SELECT payload_json AS p FROM audit_events WHERE entity_id = ? AND type = 'bank.account.updated' ORDER BY rowid DESC LIMIT 1", ctx.legacy.id)[0];
    assert.match(audit?.p || "", /"previous":\{[^}]*"parent_id":""/, "denetim kaydında önceki bağ");
  });

  it("[N10] Banka Hesabı Tanımlama yetkisi olmayan kart ekleyemez, işaret değiştiremez", async () => {
    const lawyer = apiOf(await createUser(ctx.server, ctx.api.client, { username: "avukat220", role: "avukat" }));
    expectStatus(await lawyer.post(`${BANK}/accounts`, { kind: "card", parentId: ctx.yk.id, name: "Yetkisiz", opening: opening() }), 403, "", "avukat kart ekler");
    expectStatus(await lawyer.put(`${BANK}/accounts/${ctx.yk.id}`, { useCheque: false }), 403, "", "avukat işaret değiştirir");
    const choices = await must("avukat seçici", lawyer.get(`${BANK}/choices`));
    assert.equal(choices.canDefine, false, "Tanımla yetkisi yok");
    assert.equal((await must("yönetici seçici", ctx.api.get(`${BANK}/choices`))).canDefine, true);
    await integrityOk(ctx.api, "son");
  });
});
