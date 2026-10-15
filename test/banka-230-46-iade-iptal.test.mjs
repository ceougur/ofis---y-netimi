// 2.3.0 İz 3.2 — plan §4.6'nın (İptal / İptal İadesi / Kayıt Hatası / POS İadesi; alan belge türüne göre; iade kuralları; düzeltme) koda karşı
// tek tek denetimi (docs/2.3.0-46-UYGUNLUK.md). Beklenen sayılar plan §4.6 tablolarından (kâhin; program kodundan türetilmez). Sahte saat
// 08.10.2026 (ders 13). "Nasıl Bozarım" listesi uygunluk belgesinin başında; bu dosyadaki A ve B bölümleri eski kodda (b24e0c2) KIRMIZI:
//   A  Toplu iptal / toplu silme `posOutcome` taşımıyordu (Kayıt Hatası seçilse de İptal İadesi yapılıyordu); liste ve kartta `posCash` yoktu.
//   B  Cari "ödeme iadesi" (tedarikçi parayı kredi kartımıza iade etti; plan §4.6 "ödeme iadesi (giriş) → Kurumsal Kart, POS oluşmaz, 309 düşer")
//      girilemiyordu: giriş + kart her zaman POS'tu; kart hesabı verilince 400 bank-account-invalid.
// C–G: §4.6'nın öbür kuralları (eski kodda da yeşil; eşleme tablosunda "YOK — iş yapılmadı" yazan satırların testi).
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { BANK, TODAY, balanceOf, bootBank, calendarOf, expectStatus, kurus, must, openAcceptanceAccounts, openPos, posCheck, posInvoice, salesOf, settle, subBalances, trialBalances, ziraatPos } from "./banka-220-pos-ortak.mjs";
import { openAccount } from "./banka-210-hesap-ortak.mjs";

const INV = "/api/workspace/invoices";
async function world(posExtra = {}, options = {}) {
  const ctx = await bootBank(options);
  const acc = await openAcceptanceAccounts(ctx.api);
  const abc = await must("ABC", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
  const item = await must("Ürün B", ctx.api.post("/api/workspace/stock", { kind: "goods", code: "B", name: "Ürün B", unit: "Adet", openingQty: "100" }));
  const pos = await openPos(ctx.api, ziraatPos(acc.ziraat.id, posExtra));
  return { ctx, api: ctx.api, acc, abc, item, pos };
}
const setClock = (w, iso) => w.ctx.server.clock.set(`${iso}T10:00:00+03:00`);
const collect = (api, accountId, body) => api.post(`/api/workspace/accounts/${accountId}/entries`, { kind: "in", method: "card", date: TODAY, ...body });
const saleOfInvoice = async (api, invoiceId) => (await salesOf(api, "?kind=sale&status=")).find(entry => entry.invoice?.id === invoiceId) || null;
const settlementVouchers = w => w.ctx.store.all("SELECT id, no, date, status, try_minor AS tryMinor, origin_key AS originKey FROM fin_events WHERE type = 'pos_settlement' ORDER BY rowid");
const matchVoucher = (w, voucher) =>
  w.ctx.db.prepare("INSERT INTO bank_matches (id, line_id, bank_account_id, event_id, amount_minor, digest, kind, created_by, created_at) VALUES (?, ?, ?, ?, ?, 'x', 'manual', 'admin', ?)").run(`m-${randomUUID()}`, `l-${randomUUID()}`, w.acc.ziraat.id, voucher.id, voucher.tryMinor, new Date().toISOString());
const posSalesOfEvent = (w, eventId) => w.ctx.store.all("SELECT id, kind, status, src FROM pos_sales WHERE event_id = ?", eventId);
const entryRow = (w, entryId) => w.ctx.store.get("SELECT id, kind, amount, method, fin_ref AS finRef, event_id AS eventId FROM account_entries WHERE id = ?", entryId);

describe("A — fatura İptal / Sil penceresinin POS İşlemi seçimi (Müşteriye İade Edildi / Kayıt Hatası) toplu yollarda ve liste bayrağı (plan §3.8 Fatura, §4.6)", () => {
  it("bankaya geçmiş ve eşleşmiş POS'lu faturalar: toplu iptal Kayıt Hatası → yalnız o belge 409 pos-settled; Müşteriye İade Edildi → İptal İadesi; toplu silme Kayıt Hatası → 409", async () => {
    const w = await world();
    try {
      const a = await must("fatura A", posInvoice(w.api, { accountId: w.abc.id, itemId: w.item.id, qty: 10, unitPrice: 1000, date: TODAY }));
      const b = await must("fatura B", posInvoice(w.api, { accountId: w.abc.id, itemId: w.item.id, qty: 2, unitPrice: 1000, date: TODAY, extra: { similarOk: true } }));
      const c = await must("fatura C", posInvoice(w.api, { accountId: w.abc.id, itemId: w.item.id, qty: 3, unitPrice: 1000, date: TODAY, extra: { similarOk: true } }));
      setClock(w, "2026-10-13");
      await settle(w.api);
      const [voucher] = settlementVouchers(w);
      assert.ok(voucher, "gün fişi yazıldı");
      matchVoucher(w, voucher);
      // Toplu iptal: B Kayıt Hatası (eşleşmiş gün fişi → 409 pos-settled), A Müşteriye İade Edildi (İptal İadesi, 200). Eski kod posOutcome'u yok sayıp
      // B'yi de İptal İadesi yapıyordu (toplu pencerede seçim de yoktu).
      const bulk = await must("toplu iptal", w.api.post(`${INV}/bulk-cancel`, { ids: [a.id, b.id], reason: "test", posOutcome: "entry-error" }));
      const by = Object.fromEntries(bulk.results.map(item => [item.id, item]));
      assert.equal(by[b.id].ok, false, `B Kayıt Hatası ile iptal edilemez: ${JSON.stringify(by[b.id])}`);
      assert.equal(by[b.id].code, "pos-settled");
      assert.match(by[b.id].message, /eşleştirilmiş/);
      assert.equal(by[a.id].ok, false, "A da Kayıt Hatası ile 409 (aynı gün fişi)");
      assert.equal(w.ctx.store.get("SELECT status FROM invoices WHERE id = ?", b.id).status, "issued", "B yerinde");
      assert.equal((await saleOfInvoice(w.api, b.id)).status, "active");
      const again = await must("toplu iptal (İade Edildi)", w.api.post(`${INV}/bulk-cancel`, { ids: [a.id], reason: "iade", posOutcome: "refunded" }));
      assert.equal(again.cancelled, 1, JSON.stringify(again.results));
      const saleA = await saleOfInvoice(w.api, a.id);
      assert.equal(saleA.status, "cancelled", "A: İptal İadesi Yapıldı");
      const refund = (await salesOf(w.api, "?kind=refund")).find(entry => entry.origin?.id === saleA.id);
      assert.deepEqual([refund.src, refund.items.map(entry => [entry.valueDate, entry.grossMinor])], ["cancel", [["2026-10-15", kurus(10000)]]], "iade kalemi iade valöründe");
      assert.equal(w.ctx.store.get("SELECT status FROM fin_events WHERE id = ?", voucher.id).status, "active", "eski gün fişi değişmedi");
      // Toplu silme: C Kayıt Hatası → 409 pos-settled; varsayılan (İade Edildi) → silinir (İptal İadesi).
      const saleC = await saleOfInvoice(w.api, c.id);
      const del = await must("toplu sil", w.api.post(`${INV}/bulk-delete`, { ids: [c.id], reason: "hata", posOutcome: "entry-error" }));
      assert.equal(del.results[0].ok, false, JSON.stringify(del.results[0]));
      assert.equal(del.results[0].code, "pos-settled");
      assert.equal(w.ctx.store.get("SELECT status FROM invoices WHERE id = ?", c.id).status, "issued");
      assert.equal(w.ctx.store.get("SELECT status FROM pos_sales WHERE id = ?", saleC.id).status, "active");
      const del2 = await must("toplu sil (İade Edildi)", w.api.post(`${INV}/bulk-delete`, { ids: [c.id], reason: "iade" }));
      assert.equal(del2.deleted, 1, JSON.stringify(del2.results));
      assert.equal(w.ctx.store.get("SELECT status FROM pos_sales WHERE id = ?", saleC.id).status, "cancelled", "C: İptal İadesi Yapıldı (belge Silinenler'de)");
      assert.equal(w.ctx.store.get("SELECT COUNT(*) AS n FROM pos_sales WHERE origin_id = ? AND src = 'cancel' AND status = 'active'", saleC.id).n, 1, "C'nin İptal İadesi kaydı");
      await posCheck(w.api, "toplu iptal/sil");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("liste ve kart: POS peşinli satış faturasında posCash true (pencere POS İşlemi seçimini yalnız bunlarda gösterir); nakit faturada ve alışta false", async () => {
    const w = await world();
    try {
      const posDoc = await must("POS'lu", posInvoice(w.api, { accountId: w.abc.id, itemId: w.item.id, qty: 1, unitPrice: 1000, date: TODAY }));
      const cashDoc = await must("nakit", w.api.post(INV, { kind: "sale", accountId: w.abc.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ itemId: w.item.id, name: "Ürün B", qty: 1, unitPrice: 500, discountRate: 0, vatRate: 20 }], payment: { cash: [{ amount: 500, method: "cash" }], cheques: [], endorse: [], rest: "open" }, force: true, cashForce: true }));
      const list = await must("liste", w.api.get(`${INV}?side=sale&status=issued`));
      const rowOf = id => list.invoices.find(row => row.id === id);
      assert.equal(rowOf(posDoc.id)?.posCash, true, `liste: POS'lu ${JSON.stringify(rowOf(posDoc.id)?.posCash)}`);
      assert.equal(rowOf(cashDoc.id)?.posCash, false, "liste: nakit");
      assert.equal((await must("kart", w.api.get(`${INV}/${posDoc.id}`))).posCash, true, "kart: POS'lu");
      assert.equal((await must("kart", w.api.get(`${INV}/${cashDoc.id}`))).posCash, false, "kart: nakit");
      // Valörden önce iptal (aynı gün, provizyon içinde) → void; iptal edilen belgede posCash false (etkin POS kaydı yok).
      await must("iptal", w.api.post(`${INV}/${posDoc.id}/cancel`, { reason: "vazgeçti" }));
      assert.equal((await must("kart", w.api.get(`${INV}/${posDoc.id}`))).posCash, false, "iptal edilen: etkin POS kaydı yok");
    } finally {
      await w.ctx.server.close();
    }
  });
});

describe("B — alan belge türüne göre: cari ÖDEME İADESİ kredi kartına (tedarikçi parayı kartımıza iade etti) → Kredi Kartı, POS oluşmaz, 309 düşer", () => {
  async function cardWorld() {
    const w = await world();
    w.kk = await openAccount(w.api, { bankName: "Ziraat Bankası", name: "Kurumsal Kart", kind: "card", parentId: w.acc.ziraat.id, creditLimit: "50.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    w.supplier = await must("tedarikçi", w.api.post("/api/workspace/accounts", { name: "Toptancı A.Ş.", type: "supplier", registeredOn: "2026-10-01" }));
    // Kartla 600 ödeme → 309.NN alacak 600 (kart borcu).
    const paid = await must("kartla ödeme", w.api.post(`/api/workspace/accounts/${w.supplier.id}/entries`, { kind: "out", method: "card", amount: "600", date: TODAY, bankAccountId: w.kk.id }));
    assert.equal(entryRow(w, paid.entryId).finRef, w.kk.id);
    assert.equal(await balanceOf(w.api, w.kk.id), -kurus(600), "kart borcu 600");
    return w;
  }

  it("giriş + kart + cardRefund → satır kart hesabına (fin_ref = kart), POS kaydı yok, kart borcu 600 → 360, 309.NN −360; tek kartta kart kendiliğinden; posId verilirse 400", async () => {
    const w = await cardWorld();
    try {
      const back = await must("ödeme iadesi karta", w.api.post(`/api/workspace/accounts/${w.supplier.id}/entries`, { kind: "in", method: "card", amount: "240", date: TODAY, cardRefund: true, bankAccountId: w.kk.id, note: "Fazla ödeme iadesi" }));
      const row = entryRow(w, back.entryId);
      assert.deepEqual([row.kind, row.method, row.finRef], ["in", "card", w.kk.id], "satır karta bağlı");
      assert.deepEqual(posSalesOfEvent(w, row.eventId), [], "POS satışı oluşmadı");
      assert.equal(await balanceOf(w.api, w.kk.id), -kurus(360), "kart borcu 360");
      const subs = await subBalances(w.api);
      assert.equal(subs[w.kk.glSub]?.balance, -360, "309.NN −360");
      assert.equal(kurus(subs["108.01"]?.balance || 0), 0, "108.01 değişmedi");
      // Tek kart: kart kimliği verilmeden de karta (K3 kuralı); kart borcu 360 → 260.
      const auto = await must("tek kart kendiliğinden", w.api.post(`/api/workspace/accounts/${w.supplier.id}/entries`, { kind: "in", method: "card", amount: "100", date: TODAY, cardRefund: true, similarOk: true }));
      assert.equal(entryRow(w, auto.entryId).finRef, w.kk.id);
      assert.equal(await balanceOf(w.api, w.kk.id), -kurus(260));
      // Kart iadesinde POS verilmez (ödeme tarafı).
      expectStatus(await w.api.post(`/api/workspace/accounts/${w.supplier.id}/entries`, { kind: "in", method: "card", amount: "10", date: TODAY, cardRefund: true, posId: w.pos.id }), 400, "pos-not-for-payment", "kart iadesinde POS");
      // Cari kartı: satır "Kredi Kartına İade" olarak işaretli (ekran düzeltme formunu kart seçicisiyle açar).
      const detail = await must("cari", w.api.get(`/api/workspace/accounts/${w.supplier.id}`));
      const shown = detail.entries.find(entry => entry.id === back.entryId);
      assert.equal(shown.cardRefund, true, "cari kartındaki satırda cardRefund");
      assert.equal(detail.entries.find(entry => entry.kind === "out").cardRefund, undefined, "ödeme satırında bayrak yok");
      await posCheck(w.api, "kart iadesi");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("cardRefund olmadan giriş + kart POS'tur (kart hesabı verilirse 400 bank-account-invalid; verilmezse POS satışı); düzeltmede kart bağı korunur (tutar 240 → 300)", async () => {
    const w = await cardWorld();
    try {
      expectStatus(await w.api.post(`/api/workspace/accounts/${w.supplier.id}/entries`, { kind: "in", method: "card", amount: "240", date: TODAY, bankAccountId: w.kk.id }), 400, "bank-account-invalid", "bayraksız giriş + kart hesabı");
      const posSale = await must("bayraksız giriş + kart = POS", w.api.post(`/api/workspace/accounts/${w.abc.id}/entries`, { kind: "in", method: "card", amount: "240", date: TODAY }));
      assert.equal(entryRow(w, posSale.entryId).finRef, w.pos.id, "POS'a bağlı");
      assert.equal(posSalesOfEvent(w, entryRow(w, posSale.entryId).eventId).length, 1, "POS satışı yazıldı");
      const back = await must("ödeme iadesi karta", w.api.post(`/api/workspace/accounts/${w.supplier.id}/entries`, { kind: "in", method: "card", amount: "240", date: TODAY, cardRefund: true, bankAccountId: w.kk.id }));
      // Düzeltme: gövdede cardRefund yok; satırın önceki bağı kart olduğundan kart yolu sürer (POS'a kaymaz), kart borcu 600 − 300 = 300.
      await must("düzelt", w.api.put(`/api/workspace/accounts/${w.supplier.id}/entries/${back.entryId}`, { kind: "in", method: "card", amount: "300", date: TODAY, bankAccountId: w.kk.id }));
      const row = entryRow(w, back.entryId);
      assert.deepEqual([row.amount, row.finRef], [300, w.kk.id]);
      assert.deepEqual(posSalesOfEvent(w, row.eventId), []);
      assert.equal(await balanceOf(w.api, w.kk.id), -kurus(300));
      await posCheck(w.api, "kart iadesi düzeltme");
    } finally {
      await w.ctx.server.close();
    }
  });
});

describe("C — alan belge türüne göre: ALIŞTAN İADE karta, POS tanımlıyken → Kredi Kartı (309 düşer), POS satışı oluşmaz (eşleme 93)", () => {
  it("alış 600 kartla → KK −600; alıştan iade 240 kartla → KK −360, pos_sales boş, 108.01 = 0; satıştan iade aynı POS'ta POS İadesi (karşılaştırma)", async () => {
    const w = await world();
    try {
      const kk = await openAccount(w.api, { bankName: "Ziraat Bankası", name: "Kurumsal Kart", kind: "card", parentId: w.acc.ziraat.id, creditLimit: "50.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
      const supplier = await must("tedarikçi", w.api.post("/api/workspace/accounts", { name: "Toptancı A.Ş.", type: "supplier", registeredOn: "2026-10-01" }));
      const purchase = await must("alış", w.api.post(INV, { kind: "purchase", accountId: supplier.id, number: "AL-KART-1", issueDate: TODAY, pricesIncludeVat: false, lines: [{ itemId: w.item.id, name: "", qty: 5, unitPrice: 100, discountRate: 0, vatRate: 20 }], payment: { cash: [{ amount: "600", method: "card", bankAccountId: kk.id, lineKey: "a1" }], cheques: [], endorse: [], rest: "open" }, force: true }));
      const detail = await must("alış kartı", w.api.get(`${INV}/${purchase.id}`));
      const back = await must("alıştan iade", w.api.post(INV, { kind: "purchase_return", originalId: purchase.id, issueDate: TODAY, lines: [{ originLineId: detail.lines[0].id, qty: 2 }], payment: { cash: [{ amount: "240", method: "card", bankAccountId: kk.id, lineKey: "r1" }], cheques: [], endorse: [], rest: "open" }, force: true }));
      const rows = w.ctx.store.all("SELECT kind, amount, method, fin_ref AS finRef, event_id AS eventId FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind IN ('in', 'out')", back.id);
      assert.deepEqual(rows.map(row => [row.kind, row.amount, row.method, row.finRef]), [["in", 240, "card", kk.id]]);
      assert.deepEqual(posSalesOfEvent(w, rows[0].eventId), [], "POS satışı oluşmadı");
      assert.equal(w.ctx.store.get("SELECT COUNT(*) AS n FROM pos_sales").n, 0, "hiç POS kaydı yok");
      assert.equal(await balanceOf(w.api, kk.id), -kurus(360), "KK −600 + 240");
      const subs = await subBalances(w.api);
      assert.equal(subs[kk.glSub]?.balance, -360, "309.NN −360");
      assert.equal(kurus(subs["108.01"]?.balance || 0), 0, "108.01 = 0");
      // Alıştan iadede POS verilirse 400 (ödeme tarafı); kart verilmeden tek kart kendiliğinden.
      expectStatus(await w.api.post(INV, { kind: "purchase_return", originalId: purchase.id, issueDate: TODAY, lines: [{ originLineId: detail.lines[0].id, qty: 1 }], payment: { cash: [{ amount: "120", method: "card", posId: w.pos.id, lineKey: "r2" }], cheques: [], endorse: [], rest: "open" }, force: true }), 400, "pos-not-for-payment", "alıştan iadede POS");
      // Karşılaştırma: satıştan iade kartla POS İadesidir (asıl satışın POS'u).
      const sale = await must("satış", posInvoice(w.api, { accountId: w.abc.id, itemId: w.item.id, qty: 2, unitPrice: 1000, date: TODAY }));
      const saleDetail = await must("satış kartı", w.api.get(`${INV}/${sale.id}`));
      const ret = await must("satıştan iade", w.api.post(INV, { kind: "sale_return", originalId: sale.id, issueDate: TODAY, lines: [{ originLineId: saleDetail.lines[0].id, qty: 1 }], payment: { cash: [{ amount: "1000", method: "card", lineKey: "s1" }], cheques: [], endorse: [], rest: "open" }, force: true }));
      const retRow = w.ctx.store.get("SELECT fin_ref AS finRef, event_id AS eventId FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'out'", ret.id);
      assert.equal(retRow.finRef, w.pos.id, "satıştan iade POS'a bağlı");
      assert.deepEqual(posSalesOfEvent(w, retRow.eventId).map(row => [row.kind, row.src]), [["refund", "module"]]);
      await posCheck(w.api, "alıştan iade");
    } finally {
      await w.ctx.server.close();
    }
  });
});

describe("D — Kayıt Hatası Silme (§4.6 tablo 3): valörden önce void; bankaya geçmişse bank.replan (eşleşmemiş, açık dönem) ya da 409 pos-settled", () => {
  it("iki satış aynı gün fişinde bankaya geçti → B'yi Kayıt Hatası ile iptal: gün fişi ters kaydedilir, A'nın kalemi yeni fişle (r2) yeniden geçer, banka A'nın neti kadar; B void, komisyon doğmaz", async () => {
    const w = await world();
    try {
      const a = await must("fatura A", posInvoice(w.api, { accountId: w.abc.id, itemId: w.item.id, qty: 10, unitPrice: 1000, date: TODAY }));
      const b = await must("fatura B", posInvoice(w.api, { accountId: w.abc.id, itemId: w.item.id, qty: 2, unitPrice: 1000, date: TODAY, extra: { similarOk: true } }));
      setClock(w, "2026-10-13");
      const bankBefore = await balanceOf(w.api, w.acc.ziraat.id);
      await settle(w.api);
      assert.equal((await balanceOf(w.api, w.acc.ziraat.id)) - bankBefore, kurus(12000 - 300), "12.000 brüt − 300 komisyon");
      await must("B Kayıt Hatası", w.api.post(`${INV}/${b.id}/cancel`, { reason: "yanlış girildi", posOutcome: "entry-error" }));
      const saleB = await saleOfInvoice(w.api, b.id);
      assert.equal(saleB.status, "void", "B void (İptal İadesi değil)");
      assert.equal((await salesOf(w.api, "?kind=refund")).length, 0, "iade kaydı yok");
      const vouchers = settlementVouchers(w);
      assert.deepEqual(vouchers.map(row => [row.status, row.originKey.split(":").pop()]), [["reversed", "r1"], ["active", "r2"]], "eski fiş ters, yeni fiş r2");
      assert.equal(w.ctx.store.get("SELECT COUNT(*) AS n FROM fin_events WHERE type = 'reversal' AND status = 'active'").n, 1, "ters fiş");
      assert.equal((await balanceOf(w.api, w.acc.ziraat.id)) - bankBefore, kurus(10000 - 250), "banka yalnız A'nın neti");
      const saleA = await saleOfInvoice(w.api, a.id);
      assert.deepEqual(saleA.items.map(entry => [entry.status, entry.valueDate]), [["settled", "2026-10-12"]], "A yeniden geçti");
      assert.equal(kurus((await subBalances(w.api))["108.01"]?.balance || 0), 0, "108.01 = 0");
      await posCheck(w.api, "Kayıt Hatası replan");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("gün fişi kapatılmış (kilitli) dönemdeyken Kayıt Hatası: faturanın kendi tarihi de kilitte → 409 (dönem kilidi); hiçbir şey değişmez; kilit kalkınca replan", async () => {
    const w = await world();
    try {
      const a = await must("fatura A", posInvoice(w.api, { accountId: w.abc.id, itemId: w.item.id, qty: 10, unitPrice: 1000, date: TODAY }));
      setClock(w, "2026-10-13");
      await settle(w.api);
      await must("kilit 12.10", w.api.put("/api/admin/period-lock", { lockedUntil: "2026-10-12", force: true }));
      const res = await w.api.post(`${INV}/${a.id}/cancel`, { reason: "hata", posOutcome: "entry-error" });
      assert.equal(res.status, 409, JSON.stringify(res.data).slice(0, 200));
      assert.equal((await saleOfInvoice(w.api, a.id)).status, "active");
      assert.equal(settlementVouchers(w)[0].status, "active");
      await must("kilidi kaldır", w.api.put("/api/admin/period-lock", { lockedUntil: "", force: true }));
      await must("Kayıt Hatası", w.api.post(`${INV}/${a.id}/cancel`, { reason: "hata", posOutcome: "entry-error" }));
      assert.equal((await saleOfInvoice(w.api, a.id)).status, "void");
      assert.equal(settlementVouchers(w)[0].status, "reversed");
      await posCheck(w.api, "kilit kalkınca replan");
    } finally {
      await w.ctx.server.close();
    }
  });
});

describe("E — düzeltme (§4.6): bekleyen satışta tutar değişimi tek etkin kayıt; yol/hesap değişiminde eski olay iptal, yeni olay", () => {
  it("cari POS tahsilatı 1.000 → 1.500: tek etkin satış 1.500 (kalemler yeniden), eski void, provizyon korunur; → nakit: satış void, 108.01 = 0; → yeniden POS: yeni satış", async () => {
    const w = await world();
    try {
      const first = await must("tahsilat", collect(w.api, w.abc.id, { amount: "1.000", authCode: "PRV1", cardLast4: "1234" }));
      const url = `/api/workspace/accounts/${w.abc.id}/entries/${first.entryId}`;
      await must("tutar 1.500", w.api.put(url, { kind: "in", method: "card", amount: "1.500", date: TODAY, authCode: "PRV1", cardLast4: "1234" }));
      let sales = await salesOf(w.api, "?kind=sale&status=");
      assert.deepEqual(sales.map(sale => [sale.status, sale.grossMinor]).sort(), [["active", kurus(1500)], ["void", kurus(1000)]]);
      const active = sales.find(sale => sale.status === "active");
      assert.deepEqual([active.authCode, active.cardLast4, active.items.length, active.items[0].netMinor], ["PRV1", "1234", 1, kurus(1500) - kurus(37.5)], "kalem yeniden: 1.500 − %2,5");
      assert.equal(kurus((await subBalances(w.api))["108.01"]?.balance || 0), kurus(1500), "108.01 = 1.500");
      await must("yol nakit", w.api.put(url, { kind: "in", method: "cash", amount: "1.500", date: TODAY, cashForce: true }));
      sales = await salesOf(w.api, "?kind=sale&status=");
      assert.ok(sales.every(sale => sale.status === "void"), "POS'tan nakde: satış void");
      assert.equal(kurus((await subBalances(w.api))["108.01"]?.balance || 0), 0, "108.01 = 0");
      await must("yeniden POS", w.api.put(url, { kind: "in", method: "card", amount: "1.500", date: TODAY, authCode: "PRV2" }));
      sales = await salesOf(w.api, "?kind=sale&status=");
      assert.deepEqual(sales.filter(sale => sale.status === "active").map(sale => [sale.status, sale.authCode]), [["active", "PRV2"]]);
      assert.equal(sales.filter(sale => sale.status === "void").length, 2, "iki eski kayıt void");
      await posCheck(w.api, "düzeltme");
    } finally {
      await w.ctx.server.close();
    }
  });
});

describe("F — iade kuralları (§4.6): Σ iade (İptal İadesi dahil) ≤ satış; 3 ondalık; iade silme ve geri yükleme (ders 10 komşuları)", () => {
  it("10.000 satış: iade 3.000 + 4.000 → İptal İadesi kalan 3.000 (Σ 10.000); iptal edilmiş satışa yeni iade → 404; iade tutarı 3 ondalık → 400", async () => {
    const w = await world();
    try {
      const inv = await must("fatura", posInvoice(w.api, { accountId: w.abc.id, itemId: w.item.id, qty: 10, unitPrice: 1000, date: TODAY }));
      const sale = await saleOfInvoice(w.api, inv.id);
      expectStatus(await w.api.post(`${BANK}/pos/sales/${sale.id}/refund`, { amount: "100,005", date: TODAY }), 400, undefined, "3 ondalık iade");
      await must("iade 3.000", w.api.post(`${BANK}/pos/sales/${sale.id}/refund`, { amount: "3.000", date: TODAY }));
      await must("iade 4.000", w.api.post(`${BANK}/pos/sales/${sale.id}/refund`, { amount: "4.000", date: TODAY }));
      expectStatus(await w.api.post(`${BANK}/pos/sales/${sale.id}/refund`, { amount: "3.000,01", date: TODAY }), 409, "pos-refund-exceeds", "Σ iade > satış");
      // Faturayı iptal (Müşteriye İade Edildi): modül iadeleri varken satışın iptali 409 (önce iadeler); iadeler silinince İptal İadesi kalanı değil tamamı.
      expectStatus(await w.api.post(`${INV}/${inv.id}/cancel`, { reason: "iade" }), 409, "pos-has-refunds", "iadesi olan satışın iptali");
      const refunds = await salesOf(w.api, "?kind=refund");
      assert.equal(refunds.reduce((sum, entry) => sum + entry.grossMinor, 0), kurus(7000));
      // İade satırlarını sil (void) → geri yükle: asıl satış etkinken iade geri gelir; Σ yine 7.000.
      const refundRows = w.ctx.store.all("SELECT e.id, e.amount FROM account_entries e JOIN pos_sales s ON s.event_id = e.event_id WHERE s.kind = 'refund' AND s.status = 'active' AND e.account_id = ? ORDER BY e.amount", w.abc.id);
      assert.deepEqual(refundRows.map(row => row.amount), [3000, 4000], "iade satırları");
      await must("iade sil", w.api.del(`/api/workspace/accounts/${w.abc.id}/entries/${refundRows[0].id}`));
      assert.equal((await salesOf(w.api, "?kind=refund&status=active")).length, 1, "bir iade void");
      setClock(w, "2026-10-09");
      const trash = await must("Silinenler", w.api.get("/api/admin/trash"));
      const list = trash.items || trash.rows || trash;
      const item = list.find(entry => entry.kind === "account-entry" && !entry.restoredAt);
      await must("geri yükle", w.api.post("/api/admin/trash/restore", { id: item.id }));
      assert.equal((await salesOf(w.api, "?kind=refund&status=active")).reduce((sum, entry) => sum + entry.grossMinor, 0), kurus(7000), "geri yüklenince Σ 7.000");
      // Σ denetimi geri yüklemede de: ikinci bir 3.000 iade sonra silinen 4.000 geri yüklenirse 409 pos-refund-exceeds.
      await must("iade sil (4.000)", w.api.del(`/api/workspace/accounts/${w.abc.id}/entries/${refundRows[1].id}`));
      await must("iade 6.000", w.api.post(`${BANK}/pos/sales/${sale.id}/refund`, { amount: "6.000", date: "2026-10-09" }));
      const trash2 = await must("Silinenler", w.api.get("/api/admin/trash"));
      const item2 = (trash2.items || trash2.rows || trash2).find(entry => entry.kind === "account-entry" && !entry.restoredAt);
      expectStatus(await w.api.post("/api/admin/trash/restore", { id: item2.id }), 409, "pos-refund-exceeds", "geri yüklenirse Σ > satış");
      await posCheck(w.api, "iade kuralları");
    } finally {
      await w.ctx.server.close();
    }
  });

  it("valörden sonra kısmi iade (İade Edilmez) → iade valöründe banka −3.000; sonra İptal İadesi kalan 7.000 (iadeler yalnız modülden silinmişse)", async () => {
    const w = await world();
    try {
      const inv = await must("fatura", posInvoice(w.api, { accountId: w.abc.id, itemId: w.item.id, qty: 10, unitPrice: 1000, date: TODAY }));
      setClock(w, "2026-10-13");
      await settle(w.api);
      const sale = await saleOfInvoice(w.api, inv.id);
      await must("iade 3.000", w.api.post(`${BANK}/pos/sales/${sale.id}/refund`, { amount: "3.000", date: "2026-10-13" }));
      const refund = (await salesOf(w.api, "?kind=refund"))[0];
      assert.deepEqual(refund.items.map(entry => [entry.valueDate, entry.grossMinor, entry.plannedNetMinor]), [["2026-10-15", kurus(3000), -kurus(3000)]], "iade kalemi iade valöründe, net −3.000");
      const cal = await calendarOf(w.api);
      assert.deepEqual(cal.rows.map(row => [row.valueDate, row.kind, row.netMinor]), [["2026-10-15", "pos", -kurus(3000)]], "takvimde çıkış (Komisyon Tahsili değil)");
      setClock(w, "2026-10-15");
      const before = await balanceOf(w.api, w.acc.ziraat.id);
      await settle(w.api);
      assert.equal(before - (await balanceOf(w.api, w.acc.ziraat.id)), kurus(3000), "banka −3.000");
      await posCheck(w.api, "valör sonrası iade");
    } finally {
      await w.ctx.server.close();
    }
  });
});

describe("G — bağ türü verisi (eşleme 290; Fatura ve Banka Hareketleri raporu bunu okur): Peşin · Kapatılacak Fatura · Otomatik (en eski) · Komisyon Kesintisi (Bağlı)", () => {
  it("peşin satır source=invoice+invoice_id; Kapatılacak Fatura seçilen tahsilat invoice_id dolu, kapatan 'Bağlı'; bağsız tahsilat 'Otomatik (en eski)'; komisyon kesintisi source=bank → komisyon faturasına bağlı", async () => {
    const ctx = await bootBank();
    try {
      const acc = await openAcceptanceAccounts(ctx.api);
      const provider = await must("sağlayıcı", ctx.api.post("/api/workspace/accounts", { name: "Örnek Ödeme Kuruluşu A.Ş.", type: "supplier", registeredOn: "2026-10-01" }));
      const abc = await must("ABC", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
      const item = await must("Ürün B", ctx.api.post("/api/workspace/stock", { kind: "goods", code: "B", name: "Ürün B", unit: "Adet", openingQty: "100" }));
      await openPos(ctx.api, ziraatPos(acc.ziraat.id, { name: "Ödeme Kuruluşu Sanal POS", kind: "virtual", providerKind: "payment_institution", tax: "vat_excl", providerAccountId: provider.id }));
      // Seri kronolojisi: eski tarihli açık faturalar önce (01.10, 02.10), peşin fatura sonra (08.10).
      const open1 = await must("açık fatura 1", ctx.api.post(INV, { kind: "sale", accountId: abc.id, issueDate: "2026-10-01", pricesIncludeVat: true, lines: [{ itemId: item.id, name: "Ürün B", qty: 1, unitPrice: 500, discountRate: 0, vatRate: 20 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }));
      const open2 = await must("açık fatura 2", ctx.api.post(INV, { kind: "sale", accountId: abc.id, issueDate: "2026-10-02", pricesIncludeVat: true, lines: [{ itemId: item.id, name: "Ürün B", qty: 1, unitPrice: 700, discountRate: 0, vatRate: 20 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }));
      // 1) Peşin: faturanın kendi satırı.
      const cashDoc = await must("peşin fatura", ctx.api.post(INV, { kind: "sale", accountId: abc.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ itemId: item.id, name: "Ürün B", qty: 1, unitPrice: 1000, discountRate: 0, vatRate: 20 }], payment: { cash: [{ amount: 1000, method: "bank", bankAccountId: acc.ziraat.id }], cheques: [], endorse: [], rest: "open" }, force: true }));
      // Peşin satırın bağı source/source_id'dir (invoice_id boş kalır; faturanın kendi parası "Kapatılacak Fatura" bağı değildir).
      const own = ctx.store.get("SELECT source, source_id AS sourceId, invoice_id AS invoiceId FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'in'", cashDoc.id);
      assert.deepEqual({ ...own }, { source: "invoice", sourceId: cashDoc.id, invoiceId: "" }, "Peşin: source=invoice, source_id = fatura, invoice_id boş");
      const cashDetail = await must("peşin fatura kartı", ctx.api.get(`${INV}/${cashDoc.id}`));
      assert.deepEqual([cashDetail.payState, cashDetail.closers.map(c => c.mode)], ["paid", ["linked"]], "peşin satır faturayı 'Bağlı' kapatır");
      // 2) Kapatılacak Fatura: açık fatura + cari tahsilatında invoiceId.
      const linked = await must("Kapatılacak Fatura tahsilatı", ctx.api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", method: "bank", amount: "700", date: TODAY, bankAccountId: acc.ziraat.id, invoiceId: open2.id }));
      assert.equal(ctx.store.get("SELECT invoice_id AS invoiceId FROM account_entries WHERE id = ?", linked.entryId).invoiceId, open2.id, "Kapatılacak Fatura: invoice_id dolu");
      const doc2 = await must("fatura 2", ctx.api.get(`${INV}/${open2.id}`));
      assert.deepEqual([doc2.payState, doc2.closers.map(c => c.mode)], ["paid", ["linked"]], "fatura 2 Bağlı ile kapandı (en eski 1 değil)");
      // 3) Otomatik (en eski): bağsız tahsilat en eski açık faturayı kapatır.
      const auto = await must("bağsız tahsilat", ctx.api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", method: "bank", amount: "500", date: TODAY, bankAccountId: acc.ziraat.id, similarOk: true }));
      assert.equal(ctx.store.get("SELECT invoice_id AS invoiceId FROM account_entries WHERE id = ?", auto.entryId).invoiceId, "", "Otomatik: invoice_id boş");
      const doc1 = await must("fatura 1", ctx.api.get(`${INV}/${open1.id}`));
      assert.deepEqual([doc1.payState, doc1.closers.map(c => [c.mode, c.modeLabel])], ["paid", [["auto", "Otomatik (en eski)"]]]);
      // 4) Komisyon Kesintisi (Bağlı): KDV kipi gün fişi kesinti satırı source=bank; aylık komisyon faturası kaydedilince invoice_id ona bağlanır.
      await must("POS'lu fatura", posInvoice(ctx.api, { accountId: abc.id, itemId: item.id, qty: 10, unitPrice: 1000, date: TODAY }));
      ctx.server.clock.set("2026-10-12T09:00:00+03:00");
      await settle(ctx.api);
      const fee = ctx.store.get("SELECT id, source, invoice_id AS invoiceId, kind, amount FROM account_entries WHERE source = 'bank' AND account_id = ?", provider.id);
      assert.deepEqual([fee.source, fee.invoiceId, fee.kind, fee.amount], ["bank", "", "out", 300], "kesinti satırı source=bank, henüz bağsız");
      const created = await must("Şimdi Oluştur", ctx.api.post(`${BANK}/pos/commission-invoices`, { month: "2026-10" }));
      const draftId = created.created[0].invoiceId;
      await must("taslağı kaydet", ctx.api.post(`${INV}/${draftId}/issue`, { number: "OK2026000000001", force: true }));
      assert.equal(ctx.store.get("SELECT invoice_id AS invoiceId FROM account_entries WHERE id = ?", fee.id).invoiceId, draftId, "Komisyon Kesintisi (Bağlı): invoice_id = komisyon faturası");
      const commission = await must("komisyon faturası", ctx.api.get(`${INV}/${draftId}`));
      assert.deepEqual([commission.payState, commission.closers.map(c => [c.mode, c.modeLabel, c.amount])], ["paid", [["linked", "Bağlı", 300]]]);
      await posCheck(ctx.api, "bağ türleri");
    } finally {
      await ctx.server.close();
    }
  });
});

describe("H — net eksiye düşerse, KDV kipi (§4.6 E1.06): Komisyon Tahsili kalemi valörde sağlayıcı carisine out/bank satırı → B 320 / A 102.x (653 değil)", () => {
  it("KDV Hariç POS (%2,5 + KDV = 300), 10.000 satış + aynı gün tam iade (İade Edilmez) → valörde (12.10) Ziraat −300, sağlayıcı carisine out/bank 300 (fin_ref = Ziraat), 320 borçlanır, 653 = 0", async () => {
    const ctx = await bootBank();
    try {
      const acc = await openAcceptanceAccounts(ctx.api);
      const provider = await must("sağlayıcı", ctx.api.post("/api/workspace/accounts", { name: "Örnek Ödeme Kuruluşu A.Ş.", type: "supplier", registeredOn: "2026-10-01" }));
      const abc = await must("ABC", ctx.api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-10-01" }));
      await openPos(ctx.api, ziraatPos(acc.ziraat.id, { name: "Ödeme Kuruluşu Sanal POS", kind: "virtual", providerKind: "payment_institution", tax: "vat_excl", providerAccountId: provider.id }));
      await must("satış", ctx.api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", method: "card", amount: "10.000", date: TODAY }));
      const sale = (await salesOf(ctx.api))[0];
      ctx.server.clock.set("2026-10-09T10:00:00+03:00");
      await must("tam iade", ctx.api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "out", method: "card", posRefund: true, amount: "10.000", date: "2026-10-09", posRefundOf: sale.id }));
      const cal = await calendarOf(ctx.api);
      assert.deepEqual(cal.rows.map(row => [row.valueDate, row.kind, row.netMinor]), [["2026-10-12", "fee", -kurus(300)]], "Komisyon Tahsili kalemi 300 (KDV Hariç)");
      ctx.server.clock.set("2026-10-12T10:00:00+03:00");
      await settle(ctx.api);
      assert.equal(await balanceOf(ctx.api, acc.ziraat.id), kurus(100000) - kurus(300), "Ziraat −300");
      const fee = ctx.store.all("SELECT kind, method, amount, fin_ref AS finRef, source FROM account_entries WHERE account_id = ? ORDER BY rowid", provider.id);
      assert.deepEqual(fee.map(row => ({ ...row })), [{ kind: "out", method: "bank", amount: 300, finRef: acc.ziraat.id, source: "bank" }], "sağlayıcı carisine Komisyon Tahsili satırı (out, bank, bağlı hesap)");
      const trial = await trialBalances(ctx.api);
      assert.equal(kurus(trial["653"] || 0), 0, "653 yok (KDV kipi)");
      assert.equal((await must("sağlayıcı", ctx.api.get(`/api/workspace/accounts/${provider.id}`))).totals.balance, 300, "320: sağlayıcı bize 300 borçlu (komisyon tahsilini biz ödedik, faturası gelecek)");
      await posCheck(ctx.api, "KDV kipi Komisyon Tahsili");
    } finally {
      await ctx.server.close();
    }
  });
});
