// K4 (2.3.0 kontrol turu 2, docs/2.3.0-KANIT.md): şüpheli alacağı açık carinin "Kapatılacak Fatura" bağlı tahsilatı "Normal Cariye İşlendi"dir
// (lib/doubtful-gl doubtfulSkipOf). Fatura iptal edilince bağ kalkar ve tahsilat şüpheliden düşmeye başlar. Para kuralı DEĞİŞMEZ (kâhin ve
// kapı aynı); eksik olan kullanıcıya söylemekti: iptal penceresinde önceden (detay cancelNotice), iptalden sonra (notices; toplu iptalde de) ve
// işlem kaydında (invoice.cancelled → doubtfulRelinked). Eski kodda (bcc542a) kırmızı: docs/kanit/2026-10-16/k4-iptal-eski.
// Sahte saat 08.10.2026 (banka-210-hesap-ortak).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOk, must } from "./banka-210-ortak.mjs";
import { bootBank } from "./banka-210-hesap-ortak.mjs";
import { ACC, customer, debt, listOf, take } from "./banka-230-supheli-ortak.mjs";

const INV = "/api/workspace/invoices";
const collectAt = (api, accountId, amount, date, extra = {}) => api.post(`${ACC}/${accountId}/entries`, { kind: "in", method: "cash", note: "Tahsilat", amount: String(amount), date, ...extra });
const sale = (api, accountId, total, date) =>
  must(`satış ${total}`, api.post(INV, { kind: "sale", accountId, issueDate: date, issueTime: "10:00", currency: "TRY", rate: 1, pricesIncludeVat: false, lines: [{ name: "Hizmet", qty: 1, unitPrice: total, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [], rest: "open", dueDate: date }, force: true, cashForce: true }));
const remainingOf = async (api, accountId, recordId) => (await listOf(api, accountId)).records.find(row => row.id === recordId).remainingMinor;
const entryOf = async (api, accountId, entryId) => (await must("cari kartı", api.get(`${ACC}/${accountId}`))).entries.find(row => row.id === entryId);

describe("K4 — şüpheli carinin faturaya bağlı tahsilatı: fatura iptalinde önceden ve sonradan söylenir, işlem kaydına yazılır", () => {
  let ctx;
  let api;
  let acc;
  let record;
  before(async () => {
    ctx = await bootBank();
    api = ctx.api;
    acc = await customer(api, "K4 Müşteri");
    await debt(api, acc.id, 1500, "2026-09-10");
    record = (await must("al", take(api, acc.id, { amount: 1000, date: "2026-10-01", reason: "lawsuit", note: "Dava" }))).record;
  });
  after(() => ctx?.server.close());

  it("iptal penceresi: bağlı 400 TL tahsilat şüpheliden düşmeye başlayacağı önceden yazılır; bağsız faturada yazı yok", async () => {
    const doc = await sale(api, acc.id, 400, "2026-10-05");
    const linked = await must("bağlı tahsilat", collectAt(api, acc.id, 400, "2026-10-06", { invoiceId: doc.id }));
    assert.equal((await entryOf(api, acc.id, linked.entryId)).doubtfulNormal, true, "bağlı tahsilat normal cariye işli");
    assert.equal(await remainingOf(api, acc.id, record.id), 100000, "kalan 1.000 (bağlı tahsilat şüpheliden düşmedi)");
    const detail = await must("detay", api.get(`${INV}/${doc.id}`));
    assert.match(detail.cancelNotice, /400,00 TL/);
    assert.match(detail.cancelNotice, /şüpheli alacaktan düşer/);
    assert.match(detail.cancelNotice, /Normal Cari Hesaba İşle/);
    const plain = await sale(api, acc.id, 50, "2026-10-05");
    assert.equal((await must("bağsız detay", api.get(`${INV}/${plain.id}`))).cancelNotice, "", "bağlı tahsilatı olmayan faturada uyarı yok");
    ctx.k4 = { doc, linked };
  });

  it("iptal: yanıtta bildirim, kalan 600'e iner (para kuralı 2.3.0 ile aynı), işlem kaydında hangi tahsilat olduğu yazar; kapı yeşil", async () => {
    const { doc, linked } = ctx.k4;
    const cancelled = await must("iptal", api.post(`${INV}/${doc.id}/cancel`, { reason: "Müşteri vazgeçti" }));
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.notices.length, 1, JSON.stringify(cancelled.notices));
    assert.match(cancelled.notices[0], /400,00 TL tahsilat artık şüpheli alacaktan düşüyor/);
    assert.equal(await remainingOf(api, acc.id, record.id), 60000, "kalan 1.000 − 400");
    assert.equal(Boolean((await entryOf(api, acc.id, linked.entryId)).doubtfulNormal), false, "artık normal cariye işli değil");
    const audit = await must("işlem kaydı", api.get("/api/admin/audit?type=invoice.cancelled"));
    const row = audit.find(item => item.entityId === doc.id || item.entity_id === doc.id || JSON.stringify(item).includes(doc.id));
    assert.ok(row, "invoice.cancelled kaydı");
    assert.match(JSON.stringify(row), new RegExp(linked.entryId), "işlem kaydında tahsilatın kimliği");
    await integrityOk(api, "K4 iptal");
  });

  it("toplu iptal: bildirim belge numarasıyla sonuçta döner; bağsız belgede bildirim yok", async () => {
    const doc = await sale(api, acc.id, 100, "2026-10-07");
    await must("bağlı tahsilat 100", collectAt(api, acc.id, 100, "2026-10-07", { invoiceId: doc.id }));
    const plain = await sale(api, acc.id, 30, "2026-10-07");
    const bulk = await must("toplu iptal", api.post(`${INV}/bulk-cancel`, { ids: [doc.id, plain.id], reason: "Toplu" }));
    const byId = Object.fromEntries(bulk.results.map(item => [item.id, item]));
    assert.equal(byId[doc.id].ok, true);
    assert.match(byId[doc.id].notices?.[0] || "", /100,00 TL tahsilat artık şüpheli alacaktan düşüyor/);
    assert.equal(byId[plain.id].ok, true);
    assert.equal(byId[plain.id].notices, undefined);
    await integrityOk(api, "K4 toplu iptal");
  });
});
