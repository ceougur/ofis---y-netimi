// 2.2.0 — Bankaya Tahsile Ver hesap uygunluğu işarete bağlı (docs/2.2.0-IS-LISTESI.md İz 2.6 ve İz 4.1; plan §3.14). Kullanıcı (12.10.2026):
// "Senet Kullan işaretli hesaplar … Bankaya Tahsile Ver seçiminde"; banka hesabı kartında "Çek Kullan" / "Senet Kullan" işaretleri.
//
// Beklenen (bağımsız, talimattan; programın kodundan türetilmez):
//   - alınan ÇEK yalnız "Çek Kullan" işaretli hesaba, alınan SENET yalnız "Senet Kullan" işaretli hesaba tahsile verilir (öbür koşullar: etkin,
//     TL, Vadesiz/Ticari/Diğer — değişmez);
//   - işaretsiz hesaba yeni tahsile verme 400 bank-account-flag (POS'taki pos-account-flag düzeninde: "<hesap> hesabında “Çek Kullan” işaretli
//     değil; …"); hiçbir şey yazılmaz (tablo sayıları aynı);
//   - kartın seçicisi (depositAccounts) ve sunucunun kendiliğinden seçimi aynı kuraldan: tek uygun hesapta hesapsız istek o hesaba yazılır, uygun
//     hesap yoksa 400 bank-account-required (metin işareti söyler), çokta seçim zorunlu;
//   - daha önce tahsile verilmiş evrak, hesabın işareti sonradan kalksa da tahsil edilir, Bankadan Geri Al'ınır, karşılıksız yapılır ve
//     karşılıksızı Geri Al'ınır (yeniden Bankada Tahsilde); yalnız YENİ tahsile verme engellenir.
// Kırmızı kanıt: 12b82c2 (işaretsiz kural) bu dosyada işaret testlerinde KIRMIZI (bkz. rapor).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOk } from "./banka-210-ortak.mjs";
import { BANK, TODAY, bootBank, expectStatus, must, openAccount } from "./banka-210-hesap-ortak.mjs";

const CHEQUES = "/api/workspace/cheques";
const act = (api, id, body) => api.post(`${CHEQUES}/${id}/actions`, body);
const count = (store, table, where = "1") => Number(store.get(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`).n);
const TABLES = ["cheques", "cheque_events", "cheque_collections", "fin_events", "bank_lines", "account_entries", "audit_events"];
const snapshot = store => Object.fromEntries(TABLES.map(table => [table, count(store, table)]));
const minorOf = async (api, id) => Number((await must("hesap", api.get(`${BANK}/accounts/${id}`))).balanceMinor);
const OPENING = { date: "2026-10-01", amount: "10.000", confirmed: true };
const receive = (api, body) => must(`al ${body.serialNo}`, api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "1.000", issueDate: "2026-10-05", dueDate: "2026-10-31", ...body }));

async function setup() {
  const ctx = await bootBank();
  const buyer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
  // Üç hesap: Çek Kullan (Ziraat), Senet Kullan (Garanti), işaretsiz (Akbank). Hepsi etkin TL Vadesiz.
  const chq = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Çek Tahsil", kind: "demand", currency: "TRY", useCheque: true, opening: OPENING });
  const note = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "Senet Tahsil", kind: "demand", currency: "TRY", useNote: true, opening: OPENING });
  const plain = await openAccount(ctx.api, { bankName: "Akbank", name: "İşaretsiz", kind: "demand", currency: "TRY", opening: OPENING });
  return { ctx, buyer, acc: { chq, note, plain } };
}

describe("Bankaya Tahsile Ver — hesap işaretleri (Çek Kullan / Senet Kullan)", () => {
  let ctx;
  let buyer;
  let acc;
  before(async () => {
    ({ ctx, buyer, acc } = await setup());
  });
  after(() => ctx.server.close());

  it("çek yalnız Çek Kullan işaretli hesaba: işaretsiz ve Senet Kullan hesabına 400 bank-account-flag, hiçbir şey yazılmaz; metin işareti ve hesabı söyler", async () => {
    const cheque = await receive(ctx.api, { serialNo: "IS-1", accountId: buyer.id });
    const before_ = snapshot(ctx.store);
    for (const [account, label] of [[acc.plain, "işaretsiz"], [acc.note, "yalnız Senet Kullan"]]) {
      const res = await act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: account.id });
      expectStatus(res, 400, "bank-account-flag", `çek → ${label}`);
      assert.match(res.error || "", /hesabında “Çek Kullan” işaretli değil/, `metin: ${res.error}`);
      assert.match(res.error || "", new RegExp(account.bankName), "hesabın adı metinde");
      assert.equal(res.data?.field, "bankAccountId", "alan bankAccountId");
    }
    assert.deepEqual(snapshot(ctx.store), before_, "ret: hiçbir tablo değişmedi");
    const done = await must("çek → Çek Kullan", act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.chq.id }));
    assert.equal(done.deposited, true);
    assert.equal(done.collection?.bankAccountId, acc.chq.id);
  });

  it("senet yalnız Senet Kullan işaretli hesaba: işaretsiz ve Çek Kullan hesabına 400 bank-account-flag (“Senet Kullan” metni)", async () => {
    const note = await receive(ctx.api, { serialNo: "IS-2", instrument: "note", accountId: buyer.id, amount: "700" });
    const before_ = snapshot(ctx.store);
    for (const [account, label] of [[acc.plain, "işaretsiz"], [acc.chq, "yalnız Çek Kullan"]]) {
      const res = await act(ctx.api, note.id, { action: "bank-deposit", date: TODAY, bankAccountId: account.id });
      expectStatus(res, 400, "bank-account-flag", `senet → ${label}`);
      assert.match(res.error || "", /hesabında “Senet Kullan” işaretli değil/, `metin: ${res.error}`);
    }
    assert.deepEqual(snapshot(ctx.store), before_, "ret: hiçbir tablo değişmedi");
    const done = await must("senet → Senet Kullan", act(ctx.api, note.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.note.id }));
    assert.equal(done.collection?.bankAccountId, acc.note.id);
  });

  it("seçici (kartın depositAccounts) ve kendiliğinden seçim aynı kuraldan: çekte yalnız Çek Kullan, senette yalnız Senet Kullan; tek uygunda hesapsız istek o hesaba", async () => {
    const cheque = await receive(ctx.api, { serialNo: "IS-3", accountId: buyer.id });
    const note = await receive(ctx.api, { serialNo: "IS-4", instrument: "note", accountId: buyer.id, amount: "300" });
    const chequeCard = await must("çek kartı", ctx.api.get(`${CHEQUES}/${cheque.id}`));
    const noteCard = await must("senet kartı", ctx.api.get(`${CHEQUES}/${note.id}`));
    assert.deepEqual(chequeCard.depositAccounts.map(item => item.id), [acc.chq.id], "çek seçicisi: yalnız Çek Kullan");
    assert.deepEqual(noteCard.depositAccounts.map(item => item.id), [acc.note.id], "senet seçicisi: yalnız Senet Kullan");
    const auto = await must("çek, hesapsız (tek uygun)", act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY }));
    assert.equal(auto.collection?.bankAccountId, acc.chq.id, "tek Çek Kullan hesabı kendiliğinden");
    const autoNote = await must("senet, hesapsız (tek uygun)", act(ctx.api, note.id, { action: "bank-deposit", date: TODAY }));
    assert.equal(autoNote.collection?.bankAccountId, acc.note.id, "tek Senet Kullan hesabı kendiliğinden");
  });

  it("çok uygun hesapta seçim zorunlu (400 bank-account-required); hiç uygun hesap yoksa 400 bank-account-required ve metin işareti söyler", async () => {
    const second = await openAccount(ctx.api, { bankName: "Halkbank", name: "İkinci Çek", kind: "commercial", currency: "TRY", useCheque: true, opening: OPENING });
    const cheque = await receive(ctx.api, { serialNo: "IS-5", accountId: buyer.id });
    const card = await must("kart", ctx.api.get(`${CHEQUES}/${cheque.id}`));
    assert.deepEqual(card.depositAccounts.map(item => item.id).sort(), [acc.chq.id, second.id].sort(), "iki Çek Kullan hesabı");
    expectStatus(await act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY }), 400, "bank-account-required", "iki uygun, seçim yok");
    await must("ikinci Çek Kullan hesabına", act(ctx.api, cheque.id, { action: "bank-deposit", date: TODAY, bankAccountId: second.id }));
    // İşaretler kaldırılınca senet için uygun hesap kalmaz.
    await must("Senet Kullan kaldır", ctx.api.put(`${BANK}/accounts/${acc.note.id}`, { useNote: false }));
    const note = await receive(ctx.api, { serialNo: "IS-6", instrument: "note", accountId: buyer.id, amount: "250" });
    assert.deepEqual((await must("senet kartı", ctx.api.get(`${CHEQUES}/${note.id}`))).depositAccounts, [], "senet seçicisi boş");
    const res = await act(ctx.api, note.id, { action: "bank-deposit", date: TODAY });
    expectStatus(res, 400, "bank-account-required", "uygun hesap yok");
    assert.match(res.error || "", /“Senet Kullan” işaretli/, `metin işareti söyler: ${res.error}`);
    await must("Senet Kullan geri", ctx.api.put(`${BANK}/accounts/${acc.note.id}`, { useNote: true }));
  });

  it("işaret sonradan kalksa da tahsildeki evrak: Tahsil Edildi (banka +tutar), Bankadan Geri Al, Karşılıksız ve karşılıksızın Geri Al'ı çalışır; yeni tahsile verme 400", async () => {
    const a = await receive(ctx.api, { serialNo: "IS-7", accountId: buyer.id, amount: "1.500" });
    const b = await receive(ctx.api, { serialNo: "IS-8", accountId: buyer.id, amount: "900" });
    const c = await receive(ctx.api, { serialNo: "IS-9", accountId: buyer.id, amount: "400" });
    for (const item of [a, b, c]) await must(`tahsile ${item.serialNo}`, act(ctx.api, item.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.chq.id }));
    await must("Çek Kullan kaldır", ctx.api.put(`${BANK}/accounts/${acc.chq.id}`, { useCheque: false }));
    assert.equal((await must("hesap", ctx.api.get(`${BANK}/accounts/${acc.chq.id}`))).useCheque, false, "işaret kalktı");
    // Tahsil Edildi: para kaydın hesabına girer.
    const balance = await minorOf(ctx.api, acc.chq.id);
    const collected = await must("tahsil (işaretsiz hesapta tahsildeki)", act(ctx.api, a.id, { action: "collect", date: TODAY }));
    assert.equal(collected.status, "collected");
    assert.equal(await minorOf(ctx.api, acc.chq.id), balance + 150_000, "banka +1.500");
    // Bankadan Geri Al.
    const withdrawn = await must("geri al", act(ctx.api, b.id, { action: "bank-withdraw", date: TODAY }));
    assert.equal(withdrawn.deposited, false);
    // Yeni tahsile verme: işaretsiz hesaba 400 bank-account-flag (yalnız YENİ engellenir).
    const before_ = snapshot(ctx.store);
    expectStatus(await act(ctx.api, b.id, { action: "bank-deposit", date: TODAY, bankAccountId: acc.chq.id }), 400, "bank-account-flag", "yeniden tahsile verme");
    assert.deepEqual(snapshot(ctx.store), before_, "ret: hiçbir tablo değişmedi");
    // Karşılıksız → kayıt returned; karşılıksızın Geri Al'ı kaydı yeniden Bankada Tahsilde yapar (yeni tahsile verme değildir).
    const bounced = await must("karşılıksız", act(ctx.api, c.id, { action: "bounce", date: TODAY, note: "bankadan döndü" }));
    assert.equal(bounced.status, "bounced");
    assert.equal(count(ctx.store, "cheque_collections", `cheque_id = '${c.id}' AND status = 'returned'`), 1);
    const reopened = await must("karşılıksızı geri al", ctx.api.post(`${CHEQUES}/${c.id}/undo`, {}));
    assert.equal(reopened.deposited, true, "yeniden Bankada Tahsilde");
    assert.equal(reopened.collection?.bankAccountId, acc.chq.id);
    await integrityOk(ctx.api, "işaret kalktıktan sonra");
  });
});
