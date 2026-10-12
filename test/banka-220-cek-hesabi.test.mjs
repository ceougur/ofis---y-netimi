// 2.2.0 İz 2.5 + 2.6 — verilen çekte "Banka / Şube" metni yerine Çek Hesabı (Çek Kullan işaretli hesap), verilen senette ödeme hesabı önerisi
// (Senet Kullan işaretli). docs/2.2.0-IS-LISTESI.md; CLAUDE.md 12.10.2026 istek: "çek işlemlerinde yalnız Çek Kullan işaretli bankalar gelir";
// "çek ödendiğinde para o hesaptan çıkar"; "alınan (müşteri) çekinde Banka / Şube serbest metin KALIR; eski çeklerin metni korunur".
//
// Kök neden (2.1.0, koddan): routes/cheques.mjs coreInput — "bank" serbest metin; çekin banka hesabı bağı yok (cheques.bank_account_id kolonu
// yok); verilen çek ödenirken hesap ayrıca seçiliyor (çok hesapta 400 bank-account-required).
//
// NASIL BOZARIM (önce yazıldı; adlarında [Cn]):
//   C1  Çek Kullan işaretli hesap yokken verilen çek bugünkü gibi metinle, hesapsız (200).
//   C2  Tek Çek Kullan hesabı: hesap gönderilmeden → kendiliğinden o hesap; "Banka / Şube" hesabın adı.
//   C3  İki Çek Kullan hesabı: hesapsız → 400 bank-account-required (alan bankAccountId), yazılmaz; seçilenle → o hesap.
//   C4  Yanlış hesap: Çek Kullan işaretsiz → 400; pasif → 400; vadeli → 400; kart → 400; olmayan → 404.
//   C5  Alınan çekte hesap verilirse 400 bank-account-invalid; alınan çekin metni aynen.
//   C6  Senet: Senet Kullan hesabı isteğe bağlı (verilmezse boş, 400 YOK); Senet Kullan'sız hesap senede → 400.
//   C7  Eski (hesapsız, metinli) verilen çek: vade düzeltmesinde metin ve hesapsızlık korunur.
//   C8  Ödeme: verilen çek hesap gönderilmeden ödenince para ÇEKİN HESABINDAN çıkar (çok hesapta 400 değil); başka hesap seçilirse o hesaptan.
//   C9  Senet ödemesi: önerilen hesap gönderilmezse o hesaptan.
//   C10 Ödenmemiş verilen çekin hesabı silinmez (409 bank-account-has-cheques).
//   C11 Alış faturasında verilen çek: çok hesapta hesapsız → 400 (fatura yazılmaz); seçilen hesapla çek o hesapta; satış faturasında hesap → 400.
//   C12 Düzeltmede çek → senet: Senet Kullan'sız hesabın bağı düşer.
//   C13 Excel'den yüklemede kural uygulanmaz (çok hesapta da metinli, hesapsız alınır).
// Her bölüm sonunda Mutabakat Testi tutarlı.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOk } from "./banka-210-ortak.mjs";
import { BANK, TODAY, bootBank, expectStatus, must, openAccount } from "./banka-210-hesap-ortak.mjs";

const CHEQUES = "/api/workspace/cheques";
const opening = (amount = "100.000") => ({ date: "2026-10-01", amount, confirmed: true });
const giveCheque = (api, party, extra = {}) => api.post(CHEQUES, { direction: "out", instrument: "cheque", amount: "1.000", issueDate: TODAY, dueDate: "2026-11-15", accountId: party.id, ...extra });
const row = (store, id) => store.get("SELECT bank, bank_account_id AS bankAccountId, instrument FROM cheques WHERE id = ?", id);
const balance = async (api, account) => (await must("hesap", api.get(`${BANK}/accounts/${account.id}`))).balanceMinor;

describe("2.2.0 İz 2.5–2.6: verilen çekin Çek Hesabı, senedin ödeme hesabı önerisi", () => {
  let ctx;
  before(async () => {
    ctx = await bootBank();
    ctx.party = await must("tedarikçi", ctx.api.post("/api/workspace/accounts", { name: "Tedarikçi Ç", type: "supplier", registeredOn: "2026-09-01" }));
    ctx.customer = await must("müşteri", ctx.api.post("/api/workspace/accounts", { name: "Müşteri Ç", type: "customer", registeredOn: "2026-09-01" }));
  });
  after(async () => {
    await ctx?.server.close();
  });

  it("[C1][C7] Çek Kullan hesabı yokken metinle, hesapsız; eski çekin metni vade düzeltmesinde korunur", async () => {
    ctx.plain = await openAccount(ctx.api, { bankName: "Akbank", name: "Ticari", kind: "commercial", opening: opening() });
    const old = await must("eski çek", giveCheque(ctx.api, ctx.party, { bank: "Ziraat Bankası Meram", serialNo: "ESKI-1" }));
    assert.equal(old.bankAccountId, "");
    assert.equal(old.bank, "Ziraat Bankası Meram");
    ctx.old = old;
    const ziraat = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Ana TL", kind: "demand", useCheque: true, opening: opening() });
    ctx.ziraat = ziraat;
    const edited = await must("vade düzelt", ctx.api.put(`${CHEQUES}/${old.id}`, { dueDate: "2026-11-30", updatedAt: old.updatedAt }));
    assert.deepEqual({ ...row(ctx.store, old.id) }, { bank: "Ziraat Bankası Meram", bankAccountId: "", instrument: "cheque" }, "eski çekin metni ve hesapsızlığı korundu");
    assert.equal(edited.dueDate, "2026-11-30");
  });

  it("[C2] tek Çek Kullan hesabı: kendiliğinden o hesap, Banka / Şube hesabın adı", async () => {
    const cheque = await must("verilen çek", giveCheque(ctx.api, ctx.party, { serialNo: "TEK-1", bank: "elle yazılan" }));
    assert.equal(cheque.bankAccountId, ctx.ziraat.id);
    assert.equal(cheque.bankAccountLabel, "Ziraat Bankası · Ana TL");
    assert.equal(row(ctx.store, cheque.id).bank, "Ziraat Bankası · Ana TL");
    ctx.single = cheque;
  });

  it("[C3][C4] iki Çek Kullan hesabı: hesapsız 400 (yazılmaz), seçilen hesap; yanlış hesaplar 400/404", async () => {
    ctx.garanti = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "Çek Hesabı", kind: "demand", useCheque: true, opening: opening("50.000") });
    const before = ctx.store.get("SELECT COUNT(*) AS n FROM cheques").n;
    expectStatus(await giveCheque(ctx.api, ctx.party, { serialNo: "COK-1" }), 400, "bank-account-required", "iki hesapta hesapsız");
    const picked = await must("Garanti'den", giveCheque(ctx.api, ctx.party, { serialNo: "COK-2", bankAccountId: ctx.garanti.id }));
    assert.equal(picked.bankAccountId, ctx.garanti.id);
    expectStatus(await giveCheque(ctx.api, ctx.party, { serialNo: "Y-1", bankAccountId: ctx.plain.id }), 400, "bank-account-invalid", "Çek Kullan işaretsiz");
    const time = await openAccount(ctx.api, { bankName: "Garanti BBVA", name: "Vadeli", kind: "time", opening: opening("1.000") });
    expectStatus(await giveCheque(ctx.api, ctx.party, { serialNo: "Y-2", bankAccountId: time.id }), 400, "bank-account-invalid", "vadeli");
    const card = await openAccount(ctx.api, { kind: "card", parentId: ctx.ziraat.id, name: "Kart", opening: { date: "2026-10-01", amount: "0", confirmed: false } });
    expectStatus(await giveCheque(ctx.api, ctx.party, { serialNo: "Y-3", bankAccountId: card.id }), 400, "bank-account-invalid", "kart");
    expectStatus(await giveCheque(ctx.api, ctx.party, { serialNo: "Y-4", bankAccountId: "bacc-yok" }), 404, "bank-account-missing", "olmayan");
    const passive = await openAccount(ctx.api, { bankName: "Halkbank", name: "Pasif", kind: "demand", useCheque: true, opening: opening("1.000") });
    await must("pasif", ctx.api.post(`${BANK}/accounts/${passive.id}/status`, { status: "passive" }));
    expectStatus(await giveCheque(ctx.api, ctx.party, { serialNo: "Y-5", bankAccountId: passive.id }), 400, "bank-account-invalid", "pasif");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM cheques").n, before + 1, "yalnız seçilen hesaplı çek yazıldı");
    ctx.picked = picked;
  });

  it("[C5] alınan çekte hesap 400; metin aynen", async () => {
    expectStatus(await ctx.api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "500", issueDate: TODAY, dueDate: "2026-11-20", accountId: ctx.customer.id, bank: "Müşterinin Bankası", bankAccountId: ctx.ziraat.id }), 400, "bank-account-invalid", "alınan çekte hesap");
    const received = await must("alınan çek", ctx.api.post(CHEQUES, { direction: "in", instrument: "cheque", amount: "500", issueDate: TODAY, dueDate: "2026-11-20", accountId: ctx.customer.id, bank: "Müşterinin Bankası Şubesi" }));
    assert.deepEqual([received.bank, received.bankAccountId], ["Müşterinin Bankası Şubesi", ""]);
  });

  it("[C6][C12] senet: öneri isteğe bağlı; Senet Kullan'sız hesap 400; çek → senet düzeltmesinde bağ düşer", async () => {
    const plainNote = await must("senet (önerisiz)", ctx.api.post(CHEQUES, { direction: "out", instrument: "note", amount: "700", issueDate: TODAY, dueDate: "2026-12-01", accountId: ctx.party.id }));
    assert.equal(plainNote.bankAccountId, "", "senette hesap zorunlu değil, kendiliğinden seçilmez");
    expectStatus(await ctx.api.post(CHEQUES, { direction: "out", instrument: "note", amount: "700", issueDate: TODAY, dueDate: "2026-12-01", accountId: ctx.party.id, bankAccountId: ctx.ziraat.id }), 400, "bank-account-invalid", "Senet Kullan'sız hesap");
    await must("Senet Kullan", ctx.api.put(`${BANK}/accounts/${ctx.garanti.id}`, { useNote: true }));
    const note = await must("senet (önerili)", ctx.api.post(CHEQUES, { direction: "out", instrument: "note", amount: "800", issueDate: TODAY, dueDate: "2026-12-05", accountId: ctx.party.id, bankAccountId: ctx.garanti.id, bank: "" }));
    assert.equal(note.bankAccountId, ctx.garanti.id);
    ctx.note = note;
    // Çek (Ziraat: yalnız Çek Kullan) → senet: bağ düşer.
    const toNote = await must("çek → senet", ctx.api.put(`${CHEQUES}/${ctx.single.id}`, { instrument: "note", updatedAt: ctx.single.updatedAt }));
    assert.equal(toNote.bankAccountId, "", "Senet Kullan'sız hesabın bağı düştü");
    const back = await must("senet → çek", ctx.api.put(`${CHEQUES}/${ctx.single.id}`, { instrument: "cheque", bankAccountId: ctx.ziraat.id, updatedAt: toNote.updatedAt }));
    assert.equal(back.bankAccountId, ctx.ziraat.id);
    ctx.single = back;
  });

  it("[C8][C9][C10] ödeme çekin hesabından (çok hesapta da); başka hesap seçilirse o; senet önerilen hesaptan; ödenmemiş çekli hesap silinmez", async () => {
    expectStatus(await ctx.api.del(`${BANK}/accounts/${ctx.garanti.id}`), 409, "bank-account-has-cheques", "Garanti: ödenmemiş verilen çek var");
    const zBefore = await balance(ctx.api, ctx.ziraat);
    const gBefore = await balance(ctx.api, ctx.garanti);
    const paid = await must("çek ödendi", ctx.api.post(`${CHEQUES}/${ctx.single.id}/actions`, { action: "pay", method: "bank", date: TODAY, status: "pending" }));
    assert.equal(paid.status, "paid");
    assert.equal(await balance(ctx.api, ctx.ziraat), zBefore - 100_000, "1.000 TL Ziraat'ten (çekin hesabından) çıktı");
    assert.equal(await balance(ctx.api, ctx.garanti), gBefore, "Garanti değişmedi");
    const ev = ctx.store.get("SELECT fin_ref AS finRef FROM cheque_events WHERE cheque_id = ? AND kind = 'pay'", ctx.single.id);
    assert.equal(ev.finRef, ctx.ziraat.id);
    // Garanti'nin çeki Ziraat'ten ödenir (kullanıcı başka hesap seçti).
    await must("başka hesaptan", ctx.api.post(`${CHEQUES}/${ctx.picked.id}/actions`, { action: "pay", method: "bank", bankAccountId: ctx.ziraat.id, date: TODAY, status: "pending" }));
    assert.equal(ctx.store.get("SELECT fin_ref AS f FROM cheque_events WHERE cheque_id = ? AND kind = 'pay'", ctx.picked.id).f, ctx.ziraat.id);
    // Senet önerilen hesaptan (Garanti).
    await must("senet ödendi", ctx.api.post(`${CHEQUES}/${ctx.note.id}/actions`, { action: "pay", method: "bank", date: TODAY, status: "pending" }));
    assert.equal(ctx.store.get("SELECT fin_ref AS f FROM cheque_events WHERE cheque_id = ? AND kind = 'pay'", ctx.note.id).f, ctx.garanti.id);
    assert.equal(await balance(ctx.api, ctx.garanti), gBefore - 80_000, "senet 800 TL Garanti'den");
    // C10: ödenmemiş çek olan hesap (hareketsiz) silinmez.
    const fresh = await openAccount(ctx.api, { bankName: "QNB", name: "Yeni Çek Hesabı", kind: "demand", useCheque: true, opening: opening("0") });
    await must("QNB'den çek", giveCheque(ctx.api, ctx.party, { serialNo: "QNB-1", bankAccountId: fresh.id }));
    expectStatus(await ctx.api.del(`${BANK}/accounts/${fresh.id}`), 409, "bank-account-has-cheques", "ödenmemiş çekli hesap");
    await integrityOk(ctx.api, "ödemelerden sonra");
  });

  it("[C11] alış faturasında verilen çek: çok hesapta hesapsız 400 (fatura yazılmaz), seçilenle o hesap; satış faturasında hesap 400", async () => {
    const invoices = ctx.store.get("SELECT COUNT(*) AS n FROM invoices").n;
    let seq = 0;
    const doc = extra => ({ kind: "purchase", accountId: ctx.party.id, number: `AL-CEK-${(seq += 1)}`, issueDate: TODAY, pricesIncludeVat: false, lines: [{ name: "Bakım", qty: 1, unitPrice: 1000, discountRate: 0, vatRate: 0, expenseCode: "repair" }], payment: { cash: [], cheques: [{ instrument: "cheque", amount: "1.000", dueDate: "2026-11-30", serialNo: `F-${seq}`, ...extra }], endorse: [], rest: "open" }, force: true });
    const missing = await ctx.api.post("/api/workspace/invoices", doc({}));
    expectStatus(missing, 400, "bank-account-required", "faturada hesapsız çek");
    assert.equal(ctx.store.get("SELECT COUNT(*) AS n FROM invoices").n, invoices, "fatura yazılmadı");
    const saved = await must("fatura (Garanti çeki)", ctx.api.post("/api/workspace/invoices", doc({ bankAccountId: ctx.garanti.id })));
    const cheque = ctx.store.get("SELECT bank, bank_account_id AS b FROM cheques WHERE invoice_id = ?", saved.id);
    assert.equal(cheque.b, ctx.garanti.id);
    assert.equal(cheque.bank, "Garanti BBVA · Çek Hesabı");
    const sale = await ctx.api.post("/api/workspace/invoices", { kind: "sale", accountId: ctx.customer.id, number: "ST-CEK-1", issueDate: TODAY, pricesIncludeVat: false, lines: [{ name: "Hizmet", qty: 1, unitPrice: 500, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [{ instrument: "cheque", amount: "500", dueDate: "2026-11-30", bankAccountId: ctx.garanti.id }], endorse: [], rest: "open" }, force: true });
    expectStatus(sale, 400, "bank-account-invalid", "satış faturasında hesap");
    await integrityOk(ctx.api, "fatura");
  });

  it("[C13] Excel'den yüklemede kural uygulanmaz: çok hesapta da verilen çek metinli, hesapsız alınır", async () => {
    const matrix = [["Vade", "Tutar", "Lehtar", "Banka"], ["31.12.2026", "250", "Toplu Lehtar", "Yapı Kredi Konak"]];
    const result = await must("toplu", ctx.api.post(`${CHEQUES}/import`, { matrix, headerAt: 0, direction: "out", roles: { 0: "due", 1: "amount", 2: "drawer", 3: "bank" } }));
    assert.equal(result.created, 1);
    const imported = ctx.store.get("SELECT bank, bank_account_id AS b FROM cheques WHERE bank = 'Yapı Kredi Konak'");
    assert.deepEqual({ ...imported }, { bank: "Yapı Kredi Konak", b: "" });
    await integrityOk(ctx.api, "son");
  });
});
