// 2.1.0 — Aşama 2, Dilim 3: merkezi para yazımı bank.post ve K6 denetimi (docs/BANKA-MODULU-PLAN.md §3.3, K6, K11, §12.3).
//
// ÇALIŞIYOR MU: bütün mevcut para yazıcıları (Kasa elle giriş ve Kasa↔Banka transferi, kayıt tahsilatı, cari tahsilat/ödeme, fatura
// peşini, taksit tahsilatı, stok peşin, çek tahsil/ödeme) satırına İşlem No'lu işlem başlığı (event_id) yazar; fin_events'te başlık +
// salt okuma kopyası (kaynak tablo/satır, yön, kuruş, yol, cari, tarih) durur, fin_ref '' (Hesabı Atanmamış). Düzeltmede aynı olay
// yenilenir (numara değişmez), silmede olay "cancelled" olur ve kopyası kalır, Silinenler'den geri yüklemede aynı olay "active"e döner;
// Taksite Aktar ve geri alması olayı taşır (kaynak tablo değişir, olay ve yol aynı). Para olmayan satır (Borç Yaz/Alacak Yaz, cari
// açılışı, fatura borcu, taksit açılışı, çekli taksit satırı, stok açık hesap, çek alındı/verildi/ciro/karşılıksız) olay almaz.
// Kullanıcının gördüğü hiçbir şey değişmez: yanıt gövdeleri aynı, Mutabakat Testi'nin denetim listesi aynı.
//
// NASIL BOZARIM (K6, §3.3/a-b-c ve §12.3 Aşama 2):
//   1. Test yolu bank.post dışından para satırı ekler (geçerli tarih/tutar/yol) → money:event: test kipinde ROLLBACK (satır yazılmaz).
//   2. Para olmayan satırlar (Borç Yaz, cari açılışı, taksit açılışı, çekli taksit satırı, stok açık hesap) bank.post dışından → yanlış
//      alarm YOK (API'den ve doğrudan).
//   3. İzinli listedeki para dışı yazıcı "para satırı" yazar (cari kind 'in' source '', taksit opening 0, stok pay 'cash') →
//      assertNonMoney test kipinde hata; üretimde iş durmaz, günlüğe yazılır.
//   4. store.raw dışından para tablosuna UPDATE / DELETE → test kipinde hata (değişiklik geri alınır); store.raw içinde ve yalnız
//      açıklama/bağ kolonuna UPDATE serbest.
//   5. Üretim kipinde (test kipi kapalı) aynı ihlaller işi durdurmaz; meta.bank.integrity günlüğüne düşer.
//   6. Aynı istek kimliği iki kez → tek satır (ikincisi "replayed"); aynı kimlik farklı gövde → 409.
//   7. Eşzamanlı 12 istek → 12 olay, numaralar tekil ve boşluksuz.
//   8. Yarıda kesilme (yazımdan sonra hata): olay, satır, istek kaydı, işlem geçmişi ve İşlem No sayacı ya birlikte ya hiç.
//   9. Sözleşme: prev'siz düzeltme/silme/taşıma, bilinmeyen işlem türü, bank.post dışında para satırı için olay istemek → hata.
//  10. Eski sürümden kalan olaysız para satırı düzeltilince olay alır (K11: yeni kod her para satırına event_id yazar).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const pad = n => String(n).padStart(2, "0");
const localDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const TODAY = localDay(0);
const YEAR = Number(TODAY.slice(0, 4));
const unwrap = r => ({ status: r.status, data: r.data && typeof r.data === "object" && r.data.ok === true ? r.data.data : r.data, code: r.data?.code, error: r.data?.error });
async function boot(options = {}) {
  const server = await startTestServer(options);
  const client = await loginAdmin(server);
  const api = {
    get: async url => unwrap(await client.get(url)),
    post: async (url, body) => unwrap(await client.post(url, body)),
    put: async (url, body) => unwrap(await client.put(url, body)),
    del: async url => unwrap(await client.del(url)),
  };
  return { server, api, store: server.app.store, db: server.app.db, bank: server.app.context.bank };
}
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 500)}`);
  return res.data;
};
const trashIdOf = (store, ref) => {
  const row = store.get("SELECT id FROM trash WHERE ref = ? AND restored_at IS NULL ORDER BY deleted_at DESC LIMIT 1", ref);
  assert.ok(row, `Silinenler'de ${ref} bulunmalı`);
  return row.id;
};
const restoreTrash = (api, store, ref) => api.post("/api/admin/trash/restore", { id: `trash:${trashIdOf(store, ref)}` });
const integrityOk = async (api, label) => {
  const result = await must("mutabakat", api.get("/api/workspace/ledger/integrity"));
  assert.equal(result.ok, true, `${label}: mutabakat bozuk ${JSON.stringify(result.failures).slice(0, 600)}`);
  return result;
};
// Satırın olayı ve olayın kopyası.
const eventOfRow = (store, table, id) => {
  const row = store.get(`SELECT event_id AS eventId, fin_ref AS finRef FROM ${table} WHERE id = ?`, id);
  assert.ok(row, `${table}/${id} satırı yok`);
  return { ...row, event: row.eventId ? store.get("SELECT * FROM fin_events WHERE id = ?", row.eventId) : null };
};
const eventCount = store => store.get("SELECT COUNT(*) AS n FROM fin_events").n;
const guardFailure = (code, sqlTable) => error => error?.extra?.code === "money-guard" && (error.extra.violations || []).some(item => item.code === code && (!sqlTable || item.table === sqlTable));

function assertCopy(event, expected, label) {
  assert.ok(event, `${label}: olay yok`);
  assert.match(event.no, new RegExp(`^BNK-${YEAR}-\\d{6}$`), `${label}: İşlem No biçimi`);
  for (const [key, value] of Object.entries(expected)) assert.equal(event[key], value, `${label}: ${key}`);
  assert.equal(event.bank_ref, "", `${label}: Hesabı Atanmamış (fin_ref '')`);
}

// ============================================================ Çalışıyor mu ============================================================
describe("bank.post — bütün para yazıcıları işlem başlığı yazar (çalışıyor mu)", () => {
  let ctx;
  let account;
  let service;
  let goods;
  before(async () => {
    ctx = await boot();
    account = await must("cari", ctx.api.post("/api/workspace/accounts", { name: "Olay Müşterisi", type: "customer", registeredOn: TODAY, phone: "0500 210 00 01" }));
    service = await must("hizmet", ctx.api.post("/api/workspace/stock", { kind: "service", code: "HZM", name: "Danışmanlık", unit: "Adet", salePrice: "1000" }));
    goods = await must("ürün", ctx.api.post("/api/workspace/stock", { name: "Kalem", code: "KLM", unit: "Adet", unitPrice: 10, salePrice: 20 }));
  });
  after(() => ctx.server.close());

  it("Kasa elle giriş: cash_in / cash_out; yanıt gövdesi aynı ({ id }); düzelt = aynı olay; sil → cancelled; geri yükle → aynı olay active", async () => {
    const { api, store } = ctx;
    const created = await api.post("/api/workspace/cash", { kind: "in", amount: "1.250,50", date: TODAY, description: "Danışmanlık ücreti" });
    assert.equal(created.status, 200);
    assert.deepEqual(Object.keys(created.data), ["id"], "yanıt gövdesi değişmez");
    const first = eventOfRow(store, "cash_entries", created.data.id);
    assertCopy(first.event, { type: "cash_in", status: "active", src_table: "cash_entries", src_id: created.data.id, direction: "in", amount_minor: 125050, try_minor: 125050, currency: "TRY", method: "cash", date: TODAY }, "Kasa girişi");
    const out = await must("Kasa çıkışı", api.post("/api/workspace/cash", { kind: "out", amount: "200", date: TODAY, description: "Kırtasiye" }));
    assertCopy(eventOfRow(store, "cash_entries", out.id).event, { type: "cash_out", direction: "out", amount_minor: 20000 }, "Kasa çıkışı");

    const before = eventCount(store);
    await must("düzelt", api.put(`/api/workspace/cash/${created.data.id}`, { kind: "in", amount: "1.300", date: TODAY, description: "Danışmanlık ücreti (düzeltildi)" }));
    const edited = eventOfRow(store, "cash_entries", created.data.id);
    assert.equal(edited.eventId, first.eventId, "düzeltmede aynı olay");
    assert.equal(edited.event.no, first.event.no, "İşlem No değişmez");
    assert.equal(edited.event.amount_minor, 130000, "kopya yeni tutarı taşır");
    assert.equal(eventCount(store), before, "düzeltme yeni olay açmaz");

    await must("sil", api.del(`/api/workspace/cash/${created.data.id}?cashForce=1`));
    const cancelled = store.get("SELECT * FROM fin_events WHERE id = ?", first.eventId);
    assert.equal(cancelled.status, "cancelled", "silinen satırın olayı iptal");
    assert.equal(cancelled.amount_minor, 130000, "kopyası kalır (İşlem Kartı tutarı gösterir)");
    await must("geri yükle", restoreTrash(api, store, created.data.id));
    const restored = eventOfRow(store, "cash_entries", created.data.id);
    assert.equal(restored.eventId, first.eventId, "geri yüklenen satır aynı olayı taşır");
    assert.equal(restored.event.status, "active", "olay yeniden etkin");
    await integrityOk(api, "Kasa elle giriş");
  });

  it("Kasa ↔ Banka transferi: iki bacak tek olay (cash_transfer, kopya banka bacağından); sil → iptal; geri yükle → ikisi aynı olayda", async () => {
    const { api, store } = ctx;
    const transfer = await must("transfer", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "500", date: TODAY }));
    assert.deepEqual(Object.keys(transfer).sort(), ["amount", "bankId", "date", "direction", "id", "transferId"], "yanıt gövdesi değişmez");
    const cashLeg = eventOfRow(store, "cash_entries", transfer.id);
    const bankLeg = eventOfRow(store, "cash_entries", transfer.bankId);
    assert.ok(cashLeg.eventId, "nakit bacağında olay");
    assert.equal(bankLeg.eventId, cashLeg.eventId, "iki bacak aynı olayda");
    assertCopy(bankLeg.event, { type: "cash_transfer", src_id: transfer.bankId, direction: "in", method: "bank", amount_minor: 50000 }, "transfer");
    await must("transfer düzelt", api.put(`/api/workspace/cash/${transfer.id}`, { kind: "out", amount: "450", date: TODAY, description: "Yatırma" }));
    assert.equal(eventOfRow(store, "cash_entries", transfer.bankId).event.amount_minor, 45000, "ikiz de güncellendi");
    await must("transfer sil", api.del(`/api/workspace/cash/${transfer.id}`));
    assert.equal(store.get("SELECT status FROM fin_events WHERE id = ?", cashLeg.eventId).status, "cancelled");
    await must("transfer geri yükle", restoreTrash(api, store, transfer.id));
    assert.equal(eventOfRow(store, "cash_entries", transfer.id).eventId, cashLeg.eventId);
    assert.equal(eventOfRow(store, "cash_entries", transfer.bankId).eventId, cashLeg.eventId);
    assert.equal(store.get("SELECT status FROM fin_events WHERE id = ?", cashLeg.eventId).status, "active");
    await integrityOk(api, "transfer");
  });

  it("kayıt tahsilatı: record_in, yol korunur; düzelt / sil / geri yükle aynı olay", async () => {
    const { api, store } = ctx;
    const created = await api.post("/api/workspace/cases/OLAY-1/payments", { amount: "800", date: TODAY, method: "bank", caseTitle: "Olay Dosyası" });
    assert.equal(created.status, 200);
    assert.deepEqual(Object.keys(created.data), ["id"], "yanıt gövdesi değişmez");
    const first = eventOfRow(store, "payments", created.data.id);
    assertCopy(first.event, { type: "record_in", src_table: "payments", direction: "in", method: "bank", amount_minor: 80000 }, "kayıt tahsilatı");
    await must("düzelt", api.put(`/api/workspace/payments/${created.data.id}`, { amount: "750", date: TODAY, note: "", method: "card" }));
    const edited = eventOfRow(store, "payments", created.data.id);
    assert.equal(edited.eventId, first.eventId);
    assert.equal(edited.event.method, "card", "kopyada yeni yol");
    await must("sil", api.del(`/api/workspace/payments/${created.data.id}`));
    assert.equal(store.get("SELECT status FROM fin_events WHERE id = ?", first.eventId).status, "cancelled");
    await must("geri yükle", restoreTrash(api, store, created.data.id));
    const restored = eventOfRow(store, "payments", created.data.id);
    assert.equal(restored.eventId, first.eventId);
    assert.equal(restored.event.status, "active");
    await integrityOk(api, "kayıt tahsilatı");
  });

  it("cari: tahsilat party_in, ödeme party_out (cari = kopyada); Borç Yaz / Alacak Yaz / açılış olay almaz", async () => {
    const { api, store } = ctx;
    const before = eventCount(store);
    const opened = await must("açılışlı cari", api.post("/api/workspace/accounts", { name: "Açılışlı Cari", type: "customer", registeredOn: TODAY, openingBalance: "1.000" }));
    const debt = await must("Borç Yaz", api.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "debt", amount: "3.000", date: TODAY, note: "Hizmet bedeli" }));
    const credit = await must("Alacak Yaz", api.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "credit", amount: "100", date: TODAY, note: "İskonto" }));
    assert.equal(eventCount(store), before, "para olmayan satır olay açmaz");
    assert.equal(eventOfRow(store, "account_entries", debt.entryId).eventId, "");
    assert.equal(eventOfRow(store, "account_entries", credit.entryId).eventId, "");
    assert.equal(store.get("SELECT event_id AS e FROM account_entries WHERE account_id = ?", opened.id).e, "", "açılış satırı olaysız");

    const collected = await must("tahsilat", api.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "in", amount: "1.500", date: TODAY, method: "bank" }));
    assertCopy(eventOfRow(store, "account_entries", collected.entryId).event, { type: "party_in", src_table: "account_entries", direction: "in", method: "bank", party_id: account.id, amount_minor: 150000 }, "cari tahsilat");
    const paid = await must("ödeme", api.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "out", amount: "50", date: TODAY, method: "cash" }));
    assertCopy(eventOfRow(store, "account_entries", paid.entryId).event, { type: "party_out", direction: "out", method: "cash", party_id: account.id }, "cari ödeme");
    // Borç Yaz satırının yönü düzeltilir (debt → credit): yine olaysız.
    await must("Borç Yaz düzelt", api.put(`/api/workspace/accounts/${account.id}/entries/${debt.entryId}`, { kind: "credit", amount: "3.000", date: TODAY, note: "Hizmet bedeli" }));
    assert.equal(eventOfRow(store, "account_entries", debt.entryId).eventId, "");
    const event = eventOfRow(store, "account_entries", collected.entryId).eventId;
    await must("tahsilat sil", api.del(`/api/workspace/accounts/${account.id}/entries/${collected.entryId}`));
    assert.equal(store.get("SELECT status FROM fin_events WHERE id = ?", event).status, "cancelled");
    await must("tahsilat geri yükle", restoreTrash(api, store, collected.entryId));
    assert.equal(eventOfRow(store, "account_entries", collected.entryId).eventId, event);
    assert.equal(store.get("SELECT status FROM fin_events WHERE id = ?", event).status, "active");
    await integrityOk(api, "cari");
  });

  it("fatura peşini: invoice_cash (fatura bağı kopyada); fatura borcu olaysız; iptal → peşin olayı cancelled; düzenle → eski iptal, yeni etkin", async () => {
    const { api, store } = ctx;
    const doc = await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: account.id, issueDate: TODAY, lines: [{ itemId: service.id, qty: 1, unitPrice: 1000, vatRate: 0 }], payment: { cash: [{ amount: 400, method: "card" }], rest: "open", dueDate: TODAY } }));
    const rows = store.all("SELECT id, kind, event_id AS eventId FROM account_entries WHERE source = 'invoice' AND source_id = ? ORDER BY kind", doc.id);
    const debt = rows.find(row => row.kind === "debt");
    const cash = rows.find(row => row.kind === "in");
    assert.equal(debt.eventId, "", "fatura borcu para satırı değil");
    assertCopy(eventOfRow(store, "account_entries", cash.id).event, { type: "invoice_cash", direction: "in", method: "card", amount_minor: 40000, invoice_id: doc.id, party_id: account.id }, "fatura peşini");
    await must("düzenle", api.post(`/api/workspace/invoices/${doc.id}/edit`, { scenario: "service_sale", accountId: account.id, issueDate: TODAY, lines: [{ itemId: service.id, qty: 1, unitPrice: 1000, vatRate: 0 }], payment: { cash: [{ amount: 300, method: "bank" }], rest: "open", dueDate: TODAY } }));
    assert.equal(store.get("SELECT status FROM fin_events WHERE id = ?", cash.eventId).status, "cancelled", "eski peşinin olayı iptal");
    const fresh = store.get("SELECT id, event_id AS eventId FROM account_entries WHERE source = 'invoice' AND source_id = ? AND kind = 'in'", doc.id);
    assertCopy(eventOfRow(store, "account_entries", fresh.id).event, { type: "invoice_cash", status: "active", amount_minor: 30000, method: "bank" }, "düzenlenen peşin");
    await must("iptal", api.post(`/api/workspace/invoices/${doc.id}/cancel`, { reason: "Deneme" }));
    assert.equal(store.get("SELECT status FROM fin_events WHERE id = ?", fresh.eventId).status, "cancelled");
    await integrityOk(api, "fatura");
  });

  it("taksit: tahsilat plan_in (kart ve cari kopyada); Excel açılışı (opening=1) ve çekli taksit satırı olaysız", async () => {
    const { api, store } = ctx;
    const plan = await must("kart", api.post("/api/workspace/plans", { name: "Olay Taksit", total: "3.000", mode: "auto", count: 3, firstDue: TODAY, registeredOn: TODAY, accountId: account.id }));
    const entry = await must("taksit tahsilatı", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "1.000", date: TODAY, method: "cash" }));
    assertCopy(eventOfRow(store, "plan_entries", entry.entryId).event, { type: "plan_in", src_table: "plan_entries", direction: "in", plan_id: plan.id, party_id: account.id, amount_minor: 100000 }, "taksit tahsilatı");
    await must("düzelt", api.put(`/api/workspace/plans/${plan.id}/entries/${entry.entryId}`, { amount: "900", date: TODAY, method: "bank" }));
    assert.equal(eventOfRow(store, "plan_entries", entry.entryId).event.amount_minor, 90000);
    await must("sil", api.del(`/api/workspace/plans/${plan.id}/entries/${entry.entryId}`));
    const eventId = store.get("SELECT id FROM fin_events WHERE src_id = ?", entry.entryId)?.id || "";
    assert.equal(store.get("SELECT status FROM fin_events WHERE id = ?", eventId).status, "cancelled");
    await must("geri yükle", restoreTrash(api, store, entry.entryId));
    assert.equal(eventOfRow(store, "plan_entries", entry.entryId).eventId, eventId);

    const before = eventCount(store);
    const matrix = [["Ad Soyad", "Toplam Tutar", "Taksit Sayısı", "İlk Vade", "Ödenen"], ["Açılışlı Kişi", "3.000", "3", TODAY.split("-").reverse().join("."), "1.000"]];
    const preview = await must("Excel ön izleme", api.post("/api/workspace/plans/import/preview", { matrix }));
    const imported = await must("Excel taksit", api.post("/api/workspace/plans/import", { matrix, headerAt: preview.headerAt, roles: preview.roles, fileName: "acilis.xlsx" }));
    assert.equal(imported.created, 1, JSON.stringify(imported));
    assert.ok(store.get("SELECT COUNT(*) AS n FROM plan_entries WHERE opening = 1").n >= 1, "açılış satırı yazıldı");
    assert.equal(store.get("SELECT COUNT(*) AS n FROM plan_entries WHERE opening = 1 AND event_id <> ''").n, 0, "açılış olaysız");

    const cheque = await must("çekli taksit", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "500", issueDate: TODAY, dueDate: localDay(30), accountId: account.id, planId: plan.id, serialNo: "T-210" }));
    assert.equal(store.get("SELECT COUNT(*) AS n FROM plan_entries WHERE cheque_id = ? AND event_id = ''", cheque.id).n, 1, "çekli taksit satırı olaysız");
    assert.equal(eventCount(store), before, "açılış ve çekli satır olay açmaz");
    await integrityOk(api, "taksit");
  });

  it("stok: peşin satış stock_cash (yön Kasa'ya göre); açık hesap olaysız; peşin → açık hesap → peşin geçişinde olay iptal / yeni", async () => {
    const { api, store } = ctx;
    await must("stok girişi", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "in", qty: "100", pay: "none" }));
    const sold = await must("peşin satış", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", qty: "3", unitPrice: "20", pay: "cash", method: "cash", date: TODAY }));
    const first = eventOfRow(store, "stock_moves", sold.moveId);
    assertCopy(first.event, { type: "stock_cash", src_table: "stock_moves", direction: "in", amount_minor: 6000, method: "cash" }, "stok peşin satış");
    const onAccount = await must("açık hesap", api.post(`/api/workspace/stock/${goods.id}/moves`, { kind: "out", qty: "2", unitPrice: "20", pay: "account", accountId: account.id, date: TODAY }));
    assert.equal(eventOfRow(store, "stock_moves", onAccount.moveId).eventId, "", "açık hesap stok hareketi olaysız");
    assert.equal(store.get("SELECT event_id AS e FROM account_entries WHERE source = 'stock' AND source_id = ?", onAccount.moveId).e, "", "stoktan gelen cari borcu olaysız");
    await must("peşin → açık hesap", api.put(`/api/workspace/stock/${goods.id}/moves/${sold.moveId}`, { qty: "3", unitPrice: "20", pay: "account", accountId: account.id, date: TODAY }));
    assert.equal(eventOfRow(store, "stock_moves", sold.moveId).eventId, "", "para satırı olmaktan çıktı");
    assert.equal(store.get("SELECT status FROM fin_events WHERE id = ?", first.eventId).status, "cancelled");
    await must("açık hesap → peşin", api.put(`/api/workspace/stock/${goods.id}/moves/${sold.moveId}`, { qty: "3", unitPrice: "20", pay: "cash", method: "bank", date: TODAY }));
    const again = eventOfRow(store, "stock_moves", sold.moveId);
    assert.ok(again.eventId && again.eventId !== first.eventId, "yeniden para satırı: yeni olay");
    assert.equal(again.event.method, "bank");
    await integrityOk(api, "stok");
  });

  it("çek: alındı / ciro / karşılıksız olaysız; tahsil cheque_collect, ödeme cheque_pay; geri al → cancelled", async () => {
    const { api, store } = ctx;
    const before = eventCount(store);
    const received = await must("çek alındı", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "700", issueDate: TODAY, dueDate: localDay(20), accountId: account.id, serialNo: "C-210-1" }));
    assert.equal(eventCount(store), before, "alındı olayı para değil");
    await must("tahsil", api.post(`/api/workspace/cheques/${received.id}/actions`, { action: "collect", date: TODAY, method: "bank", status: "portfolio" }));
    const collect = store.get("SELECT id, event_id AS eventId FROM cheque_events WHERE cheque_id = ? AND kind = 'collect'", received.id);
    assertCopy(eventOfRow(store, "cheque_events", collect.id).event, { type: "cheque_collect", src_table: "cheque_events", direction: "in", method: "bank", cheque_id: received.id, party_id: account.id, amount_minor: 70000 }, "çek tahsili");
    await must("geri al", api.post(`/api/workspace/cheques/${received.id}/undo`, {}));
    assert.equal(store.get("SELECT status FROM fin_events WHERE id = ?", collect.eventId).status, "cancelled");

    const supplier = await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Olay Tedarikçisi", type: "supplier", registeredOn: TODAY }));
    const given = await must("çek verildi", api.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: "300", issueDate: TODAY, dueDate: localDay(10), accountId: supplier.id, serialNo: "C-210-2" }));
    await must("Kasa'ya para", api.post("/api/workspace/cash", { kind: "in", amount: "5000", date: TODAY, description: "Sermaye" }));
    await must("öde", api.post(`/api/workspace/cheques/${given.id}/actions`, { action: "pay", date: TODAY, method: "cash", status: given.status }));
    const pay = store.get("SELECT id FROM cheque_events WHERE cheque_id = ? AND kind = 'pay'", given.id);
    assertCopy(eventOfRow(store, "cheque_events", pay.id).event, { type: "cheque_pay", direction: "out", method: "cash", party_id: supplier.id }, "çek ödemesi");
    const third = await must("ikinci çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "250", issueDate: TODAY, dueDate: localDay(15), accountId: account.id, serialNo: "C-210-3" }));
    const count = eventCount(store);
    await must("ciro", api.post(`/api/workspace/cheques/${third.id}/actions`, { action: "endorse", date: TODAY, accountId: supplier.id, status: "portfolio" }));
    assert.equal(eventCount(store), count, "ciro para değil");
    await integrityOk(api, "çek");
  });

  it("eski sürümden kalan olaysız para satırı düzeltilince olay alır (K11)", async () => {
    const { api, store, db } = ctx;
    db.prepare("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('cash-eski-210', 'in', 75, ?, 'Eski sürüm', 'cash', 'eski', ?)").run(TODAY, new Date().toISOString());
    assert.equal(eventOfRow(store, "cash_entries", "cash-eski-210").eventId, "");
    await must("eski satırı düzelt", api.put("/api/workspace/cash/cash-eski-210", { kind: "in", amount: "80", date: TODAY, description: "Eski sürüm (düzeltildi)" }));
    const fixed = eventOfRow(store, "cash_entries", "cash-eski-210");
    assertCopy(fixed.event, { type: "cash_in", amount_minor: 8000, src_id: "cash-eski-210" }, "eski satır");
  });

  it("İşlem No'lar tekil ve boşluksuz; Mutabakat Testi'nin denetim listesi değişmedi (işlem başlığı tarih denetimi görünmez)", async () => {
    const { api, store } = ctx;
    const seqs = store.all("SELECT seq FROM fin_events WHERE year = ? ORDER BY seq", YEAR).map(row => row.seq);
    assert.ok(seqs.length >= 15, `olay sayısı ${seqs.length}`);
    assert.deepEqual(seqs, seqs.map((_, index) => index + 1), "1'den başlayıp boşluksuz");
    assert.equal(store.get("SELECT COUNT(DISTINCT no) AS n FROM fin_events").n, seqs.length);
    const result = await integrityOk(api, "son");
    const codes = result.checks.map(item => item.code);
    assert.ok(!codes.some(code => code.endsWith(":fin_events")), `işlem başlığı tarih denetimi Mutabakat Testi'nde görünmemeli: ${codes.filter(code => code.includes("fin_events"))}`);
    const fresh = await boot();
    try {
      const empty = await integrityOk(fresh.api, "boş şirket");
      assert.equal(result.checks.length, empty.checks.length, "denetim sayısı ('N denetim tamam') para yazımından sonra aynı");
    } finally {
      await fresh.server.close();
    }
  });
});

describe("bank.post — Taksite Aktar (op 'move') olayı taşır, geri alma geri getirir", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(() => ctx.server.close());

  it("kayıt tahsilatı karta taşınır: aynı olay, kaynak tablo plan_entries, yol aynı; geri al → payments, aynı olay", async () => {
    const { api, store, server } = ctx;
    const NAMES = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    const now = new Date();
    const header = offset => {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      return `${NAMES[d.getMonth()]} ${d.getFullYear()} taksiti`;
    };
    const matrix = [["Ad Soyad", "Telefon", header(-1), header(0), header(1), "Toplam"], ["Taşınan Kişi", "0532 210 00 09", "1.000", "1.000", "1.000", "3.000"]];
    const staged = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "aktar.xlsx", sheets: [{ name: "Liste", matrix }] }));
    await must("tablo yükle", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    const client = await loginAdmin(server);
    const list = (await client.get(`/api/trpc/sheets.getRows?input=${encodeURIComponent(JSON.stringify({ json: {} }))}`)).data.result.data.json.rows;
    const key = list.find(row => row["Ad Soyad"] === "Taşınan Kişi").__hofKey;
    const paid = await must("kayıt tahsilatı", api.post(`/api/workspace/cases/${encodeURIComponent(key)}/payments`, { amount: "1.000", date: TODAY, method: "bank", caseTitle: "Taşınan Kişi" }));
    const original = eventOfRow(store, "payments", paid.id);
    assert.ok(original.eventId);
    const preview = await must("ön izleme", api.get("/api/workspace/plans/from-table"));
    const result = await must("aktar", api.post("/api/workspace/plans/from-table", { keys: preview.records.filter(item => item.selected).map(item => item.key), fingerprint: preview.fingerprint }));
    assert.equal(result.paymentsMoved, 1);
    const moved = store.get("SELECT id, event_id AS eventId, method FROM plan_entries WHERE event_id = ?", original.eventId);
    assert.ok(moved, "taşınan satır aynı olayı taşır");
    assert.equal(moved.method, "bank", "yol aynı");
    const event = store.get("SELECT * FROM fin_events WHERE id = ?", original.eventId);
    assert.equal(event.src_table, "plan_entries", "kopyada kaynak tablo güncellendi");
    assert.equal(event.status, "active");
    assert.equal(event.no, original.event.no, "İşlem No aynı");
    assert.equal(store.get("SELECT COUNT(*) AS n FROM payments WHERE id = ?", paid.id).n, 0);
    await must("geri al", api.post(`/api/workspace/plans/imports/${result.importId}/undo`, {}));
    const back = eventOfRow(store, "payments", paid.id);
    assert.equal(back.eventId, original.eventId, "geri dönen kayıt tahsilatı aynı olayda");
    assert.equal(back.event.src_table, "payments");
    assert.equal(back.event.status, "active");
    await integrityOk(api, "Taksite Aktar");
  });
});

// ============================================================ Nasıl bozarım ============================================================
describe("K6 — test kipinde ihlal işlemi geri alır (nasıl bozarım)", () => {
  let ctx;
  before(async () => {
    ctx = await boot();
  });
  after(() => ctx.server.close());

  it("1. bank.post dışından para satırı (geçerli Kasa girişi) → money:event, ROLLBACK", () => {
    const { store } = ctx;
    assert.throws(
      () => store.tx(() => store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('kacak-1', 'in', 100, ?, 'Kaçak', 'cash', 'x', ?)", TODAY, new Date().toISOString())),
      guardFailure("money-event", "cash_entries"),
    );
    assert.equal(store.get("SELECT COUNT(*) AS n FROM cash_entries WHERE id = 'kacak-1'").n, 0, "satır yazılmadı");
    for (const [table, sql, args] of [
      ["payments", "INSERT INTO payments (id, case_key, amount, date, note, method, created_by, created_at) VALUES ('kacak-2', 'K', 10, ?, '', 'bank', 'x', ?)", [TODAY]],
      ["account_entries", "INSERT INTO account_entries (id, account_id, kind, amount, date, note, source, source_id, method, created_by, created_at) VALUES ('kacak-3', 'a', 'out', 10, ?, '', '', '', 'cash', 'x', ?)", [TODAY]],
      ["account_entries", "INSERT INTO account_entries (id, account_id, kind, amount, date, note, source, source_id, method, created_by, created_at) VALUES ('kacak-4', 'a', 'in', 10, ?, '', 'invoice', 'f', 'card', 'x', ?)", [TODAY]],
      ["plan_entries", "INSERT INTO plan_entries (id, plan_id, kind, amount, date, method, created_by, created_at) VALUES ('kacak-5', 'p', 'in', 10, ?, 'cash', 'x', ?)", [TODAY]],
      ["stock_moves", "INSERT INTO stock_moves (id, item_id, kind, qty, unit_price, amount, date, pay, method, created_by, created_at) VALUES ('kacak-6', 'i', 'out', 1, 10, 10, ?, 'cash', 'cash', 'x', ?)", [TODAY]],
      ["cheque_events", "INSERT INTO cheque_events (id, cheque_id, kind, date, amount, to_status, method, created_by, created_at) VALUES ('kacak-7', 'c', 'collect', ?, 10, 'collected', 'bank', 'x', ?)", [TODAY]],
    ]) {
      // Kapı (mutabakat) bazı denemeleri kendi nedeniyle de geri alabilir; her durumda satır yazılmamalı ve ihlal ya da sapma görülmeli.
      assert.throws(() => store.tx(() => store.run(sql, ...args, new Date().toISOString())), error => guardFailure("money-event", table)(error) || error?.extra?.code === "ledger-integrity", table);
      assert.equal(store.get(`SELECT COUNT(*) AS n FROM ${table} WHERE id LIKE 'kacak-%'`).n, 0, `${table}: satır yazılmadı`);
    }
    // Kapıya takılmayan (dengeli) tek kaçak: payments + aynı tutarda karşı kayıt yok; yine de money:event tek başına yakalar.
    assert.throws(() => store.tx(() => store.run("INSERT INTO payments (id, case_key, amount, date, note, method, created_by, created_at) VALUES ('kacak-8', 'K', 10, ?, '', 'cash', 'x', ?)", TODAY, new Date().toISOString())), guardFailure("money-event", "payments"));
  });

  it("2. para olmayan satır bank.post dışından yazılır → yanlış alarm yok (Borç Yaz, açılış, çekli taksit, stok açık hesap)", async () => {
    const { store, api } = ctx;
    const stamp = new Date().toISOString();
    const acc = await must("cari", api.post("/api/workspace/accounts", { name: "K6 Cari", type: "customer", registeredOn: TODAY }));
    store.tx(() => store.run("INSERT INTO account_entries (id, account_id, kind, amount, date, note, source, source_id, created_by, created_at) VALUES ('ok-1', ?, 'debt', 10, ?, 'Borç Yaz', '', '', 'x', ?)", acc.id, TODAY, stamp));
    store.tx(() => store.run("INSERT INTO account_entries (id, account_id, kind, amount, date, note, source, source_id, created_by, created_at) VALUES ('ok-2', ?, 'credit', 10, ?, 'Açılış bakiyesi', '', '', 'x', ?)", acc.id, TODAY, stamp));
    assert.equal(store.get("SELECT COUNT(*) AS n FROM account_entries WHERE id IN ('ok-1', 'ok-2')").n, 2);
    assert.equal(ctx.bank.isMoney("plan_entries", { opening: 1, cheque_id: "" }), false, "taksit açılışı para değil");
    assert.equal(ctx.bank.isMoney("plan_entries", { opening: 0, cheque_id: "cek-1" }), false, "çekli taksit satırı para değil");
    assert.equal(ctx.bank.isMoney("stock_moves", { pay: "account", amount: 10 }), false, "stok açık hesap para değil");
    assert.equal(ctx.bank.isMoney("stock_moves", { pay: "cash", amount: 0 }), false, "tutarsız stok para değil");
    assert.equal(ctx.bank.isMoney("cheque_events", { kind: "endorse" }), false, "ciro para değil");
    assert.equal(ctx.bank.isMoney("account_entries", { kind: "in", source: "cheque" }), false, "çekten gelen cari satırı para değil");
    assert.equal(ctx.bank.isMoney("account_entries", { kind: "in", source: "" }), true);
    assert.equal(ctx.bank.isMoney("stock_moves", { pay: "cash", amount: 5 }), true);
  });

  it("3. izinli listedeki para dışı yazıcı para satırı yazar → assertNonMoney test kipinde hata", () => {
    const { bank } = ctx;
    assert.throws(() => bank.assertNonMoney("account_entries", { kind: "in", source: "" }), guardFailure("money-nonmoney", "account_entries"));
    assert.throws(() => bank.assertNonMoney("plan_entries", { opening: 0, cheque_id: "" }), guardFailure("money-nonmoney", "plan_entries"));
    assert.throws(() => bank.assertNonMoney("stock_moves", { pay: "cash", amount: 12 }), guardFailure("money-nonmoney", "stock_moves"));
    assert.throws(() => bank.assertNonMoney("cheque_events", { kind: "collect" }), guardFailure("money-nonmoney", "cheque_events"));
    assert.equal(bank.assertNonMoney("account_entries", { kind: "debt", source: "" }), true);
    assert.equal(bank.assertNonMoney("plan_entries", { opening: 1, cheque_id: "" }), true);
  });

  it("4. store.raw dışından para tablosuna UPDATE / DELETE → test kipinde hata, değişiklik geri alınır; raw ve yalnız açıklama serbest", async () => {
    const { api, store } = ctx;
    const created = await must("Kasa", api.post("/api/workspace/cash", { kind: "in", amount: "300", date: TODAY, description: "Ham deneme" }));
    assert.throws(() => store.run("UPDATE cash_entries SET amount = 5 WHERE id = ?", created.id), guardFailure("money-raw", "cash_entries"));
    assert.equal(store.get("SELECT amount FROM cash_entries WHERE id = ?", created.id).amount, 300, "tutar geri alındı");
    assert.throws(() => store.tx(() => store.run("DELETE FROM cash_entries WHERE id = ?", created.id)), guardFailure("money-raw", "cash_entries"));
    assert.equal(store.get("SELECT COUNT(*) AS n FROM cash_entries WHERE id = ?", created.id).n, 1, "silme geri alındı");
    assert.throws(() => store.tx(() => store.run("UPDATE fin_events SET amount_minor = 1 WHERE id = (SELECT event_id FROM cash_entries WHERE id = ?)", created.id)), guardFailure("money-raw", "fin_events"));
    // Yalnız açıklama (para alanı değil) serbest.
    store.run("UPDATE cash_entries SET description = ? WHERE id = ?", "Ham deneme (not)", created.id);
    assert.equal(store.get("SELECT description FROM cash_entries WHERE id = ?", created.id).description, "Ham deneme (not)");
    // Ham kapsam (göç, sıfırlama, onarım) gerekçeyle serbest; kapı kendi denetimini yine yapar.
    store.raw("test: onarım", () => store.tx(() => store.run("UPDATE cash_entries SET description = ?, amount = 300 WHERE id = ?", "Onarım", created.id)));
    assert.throws(() => store.raw("", () => 0), TypeError, "gerekçesiz ham kapsam yok");
  });

  it("6. aynı istek kimliği iki kez → tek satır (ikincisi replayed); aynı kimlik farklı gövde → 409", () => {
    const { bank, store } = ctx;
    const user = { id: "u-istek", role: "admin", display_name: "İstek" };
    const write = body => () => {
      const id = `cash-istek-${Math.random().toString(36).slice(2)}`;
      store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, event_id, created_by, created_at) VALUES (?, 'in', ?, ?, 'İstek', 'cash', ?, ?, ?)", id, body.amount, TODAY, bank.eventFor("cash_entries", { kind: "in", date: TODAY }), user.id, new Date().toISOString());
      return { id };
    };
    const body = { amount: 42 };
    const first = bank.post({ user, scope: "cash.create", requestId: "istek-210-aaaaaaaaaaaa", module: "cash", op: "create", body, write: write(body) });
    const second = bank.post({ user, scope: "cash.create", requestId: "istek-210-aaaaaaaaaaaa", module: "cash", op: "create", body, write: write(body) });
    assert.equal(second.replayed, true, "ikinci gönderim yeniden yazmaz");
    assert.equal(second.refId, first.id);
    assert.equal(store.get("SELECT COUNT(*) AS n FROM cash_entries WHERE description = 'İstek'").n, 1, "tek satır");
    assert.throws(() => bank.post({ user, scope: "cash.create", requestId: "istek-210-aaaaaaaaaaaa", module: "cash", op: "create", body: { amount: 43 }, write: write({ amount: 43 }) }), error => error.status === 409 && error.extra?.code === "request-id-reused");
    assert.throws(() => bank.post({ user, scope: "cash.create", requestId: "kısa", module: "cash", op: "create", body, write: write(body) }), error => error.status === 400);
  });

  it("7. eşzamanlı 12 Kasa girişi → 12 olay, numaralar tekil ve boşluksuz", async () => {
    const { api, store } = ctx;
    const before = store.get("SELECT COALESCE(MAX(seq), 0) AS n FROM fin_events WHERE year = ?", YEAR).n;
    const results = await Promise.all(Array.from({ length: 12 }, (_, index) => api.post("/api/workspace/cash", { kind: "in", amount: String(10 + index), date: TODAY, description: `Eşzamanlı ${index}` })));
    assert.ok(results.every(result => result.status === 200), JSON.stringify(results.map(result => result.status)));
    const seqs = store.all("SELECT seq FROM fin_events WHERE year = ? AND seq > ? ORDER BY seq", YEAR, before).map(row => row.seq);
    assert.deepEqual(seqs, Array.from({ length: 12 }, (_, index) => before + index + 1));
    assert.equal(store.get("SELECT COUNT(DISTINCT event_id) AS n FROM cash_entries WHERE description LIKE 'Eşzamanlı %'").n, 12);
  });

  it("8. yarıda kesilme: yazımdan sonra hata → olay, satır, istek kaydı, işlem geçmişi ve İşlem No sayacı yazılmaz", () => {
    const { bank, store } = ctx;
    const user = { id: "u-kesinti", role: "admin", display_name: "Kesinti" };
    const counter = () => store.get("SELECT value FROM settings WHERE key = ?", `meta.bank.seq.${YEAR}`)?.value || "";
    const snapshot = () => ({ events: eventCount(store), rows: store.get("SELECT COUNT(*) AS n FROM cash_entries").n, keys: store.get("SELECT COUNT(*) AS n FROM request_keys").n, audit: store.get("SELECT COUNT(*) AS n FROM audit_events").n, counter: counter() });
    const before = snapshot();
    assert.throws(
      () =>
        bank.post({
          user,
          scope: "cash.create",
          requestId: "kesinti-210-bbbbbbbbbbbb",
          module: "cash",
          op: "create",
          body: { amount: 9 },
          audit: { type: "cash.entry.created", entityId: "kesinti", payload: { amount: 9 } },
          write: () => {
            store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, event_id, created_by, created_at) VALUES ('cash-kesinti', 'in', 9, ?, 'Kesinti', 'cash', ?, 'u', ?)", TODAY, bank.eventFor("cash_entries", { kind: "in", date: TODAY }), new Date().toISOString());
            throw new Error("elektrik kesildi");
          },
        }),
      /elektrik kesildi/,
    );
    assert.deepEqual(snapshot(), before, "hiçbiri yazılmadı");
    // Denetim kaydı ve istek kaydı yazımdan SONRA atılırsa da hepsi geri alınır.
    assert.throws(
      () =>
        bank.post({
          user,
          scope: "cash.create",
          requestId: "kesinti-210-cccccccccccc",
          module: "cash",
          op: "create",
          body: { amount: 9 },
          write: () => {
            store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, event_id, created_by, created_at) VALUES ('cash-kesinti-2', 'in', 9, ?, 'Kesinti', 'cash', ?, 'u', ?)", TODAY, bank.eventFor("cash_entries", { kind: "in", date: TODAY }), new Date().toISOString());
            return { id: "cash-kesinti-2" };
          },
          guard: () => {
            throw new Error("eksi bakiye");
          },
        }),
      /eksi bakiye/,
    );
    assert.deepEqual(snapshot(), before, "son denetim reddedince de hiçbiri yazılmadı");
  });

  it("9. sözleşme: prev'siz düzeltme/silme/taşıma/geri yükleme/atama, bilinmeyen tür, bank.post dışında olay → hata", () => {
    const { bank } = ctx;
    const user = { id: "u", role: "admin" };
    for (const op of ["update", "delete", "move", "restore", "assign"]) assert.throws(() => bank.post({ user, module: "cash", op, write: () => 0 }), TypeError, `${op}: prev zorunlu`);
    assert.throws(() => bank.post({ user, module: "cash", op: "sil", prev: {}, write: () => 0 }), TypeError, "bilinmeyen tür");
    assert.throws(() => bank.post({ user, module: "cash", op: "create" }), TypeError, "write zorunlu");
    assert.throws(() => bank.eventFor("cash_entries", { kind: "in", date: TODAY }), guardFailure("money-event", "cash_entries"), "bank.post dışında para satırına olay verilmez");
    assert.equal(bank.eventFor("account_entries", { kind: "debt", source: "", date: TODAY }), "", "para olmayan satıra olay gerekmez");
  });
});

describe("K6 — üretim kipinde ihlal işi durdurmaz, günlüğe düşer (nasıl bozarım 5)", () => {
  let ctx;
  before(async () => {
    ctx = await boot({ moneyStrict: false });
  });
  after(() => ctx.server.close());
  const journal = store => JSON.parse(store.get("SELECT value FROM settings WHERE key = 'meta.bank.integrity'")?.value || "[]");

  it("para olmayan API işlemleri günlüğe hiçbir şey yazmaz (Borç Yaz, Alacak Yaz, açılış, taksit kartı, stok açık hesap)", async () => {
    const { api, store } = ctx;
    const acc = await must("cari", api.post("/api/workspace/accounts", { name: "Üretim Cari", type: "customer", registeredOn: TODAY, openingBalance: "500" }));
    await must("Borç Yaz", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "debt", amount: "100", date: TODAY }));
    await must("Alacak Yaz", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "credit", amount: "40", date: TODAY }));
    await must("taksit kartı", api.post("/api/workspace/plans", { name: "Üretim Kartı", total: "600", mode: "auto", count: 2, firstDue: TODAY, registeredOn: TODAY, accountId: acc.id }));
    const item = await must("ürün", api.post("/api/workspace/stock", { name: "Defter", code: "DFT", unit: "Adet", unitPrice: 5, salePrice: 9 }));
    await must("stok girişi", api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "in", qty: "10", pay: "none" }));
    await must("açık hesap satış", api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "2", unitPrice: "9", pay: "account", accountId: acc.id, date: TODAY }));
    await must("tahsilat", api.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "60", date: TODAY, method: "cash" }));
    assert.deepEqual(journal(store), [], "yanlış alarm yok");
  });

  it("kaçak para satırı ve ham UPDATE: iş durmaz, meta.bank.integrity günlüğüne düşer", () => {
    const { store } = ctx;
    store.tx(() => store.run("INSERT INTO cash_entries (id, kind, amount, date, description, method, created_by, created_at) VALUES ('uretim-kacak', 'in', 15, ?, 'Kaçak', 'cash', 'x', ?)", TODAY, new Date().toISOString()));
    assert.equal(store.get("SELECT COUNT(*) AS n FROM cash_entries WHERE id = 'uretim-kacak'").n, 1, "üretimde iş durmaz");
    store.run("UPDATE cash_entries SET amount = 16 WHERE id = 'uretim-kacak'");
    const codes = journal(store).map(item => `${item.code}:${item.table}`);
    assert.ok(codes.includes("money-event:cash_entries"), codes.join(", "));
    assert.ok(codes.includes("money-raw:cash_entries"), codes.join(", "));
    assert.equal(ctx.bank.assertNonMoney("account_entries", { kind: "in", source: "" }), false, "üretimde assertNonMoney hata atmaz, false döner");
    assert.ok(journal(store).some(item => item.code === "money-nonmoney"));
  });
});
