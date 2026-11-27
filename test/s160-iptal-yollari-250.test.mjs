// 2.5.0 Ç5-A tur 2d — İş 2: S160 = A'nın iki ek testi (kullanıcı kararı 13.11.2026 10:40, AYNEN "a" — kilitli dönemdeki bir tahsilatın fatura bağını DÜŞÜRECEK işlem
// reddedilir, 409; ileti kilitli tahsilatın tarihini söyler). Baş mimar onayı: fatura iptalini çağıran HER yol aynı reddi alır (docs/erp/C5-ACILIS-TASARIM.md §17.3):
//   (a) Banka'dan Ters Kaydet (ve onu çağıran Düzelt) — KDV'li masrafın faturası (bank/vouchers.mjs reverseInside → invoices.cancel fromBank),
//   (b) e-Belge iptal akışı (e-Arşiv: önce programda dryRun, geçerse entegratör) — ret EDM'ye HİÇ gidilmeden (sahte servisin istek sayacı).
// Her yolda: kilitli tahsilat bağlıyken 409 + kilitli defter satır satır AYNI + bağ ve belge aynı; kilit DIŞINDAKİ tahsilat bağlıyken serbest; kilit kaldırılınca iptal,
// yeniden kilit çalışır. Ret yalnız TAHSİLAT yönünde: ödeme ve verilen evrak bağı kurala girmez (vaka).
// (a)'daki kilitli TAHSİLAT bağı programın arayüz yolundan KURULAMAZ (KDV'li masrafın faturası alış faturasıdır; Kapatılacak Fatura'da tahsilat alış faturasını kapatmaz — ön
// koşulda 409 okunur; POS komisyon faturasının — kilitli komisyon iadesine bağ yazan tek yol — banka olayı yok, Ters Kaydet yolu yok: tur 2d sondası). Bağ, kilit konmadan önce
// programın kendi bağlantısından (kapıdan geçerek) yazılır: yol savunma katmanıdır. Önceden (c5a2-taban 7e8d3228): iki yolda da 200, bağ düşüyor, şüpheli caride kilitli
// dönemin canlı türetmesi değişiyordu (kilitli tahsilat A 120 → A 128).
// Sahte saat (ders 13); lisans servisi yok (ders 30); iki TZ'de koşulur.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { resetEdmCaches } from "../server/lib/einvoice/edm.mjs";
import { startMockEdm } from "./einvoice-mock.mjs";
import { BANK, boot, bootBank, must, openAccount } from "./banka-210-hesap-ortak.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const LOCK = "2026-10-10";
const tr = iso => iso.split("-").reverse().join(".");

/** Kilitli dönemin canlı türetmesi (tarihi ≤ kilit madde satırlarının çoklu kümesi). */
const lockedLinesOf = app => {
  const out = [];
  for (const entry of app.ledger.build()) if (String(entry.date) <= LOCK) for (const line of entry.lines || []) out.push(`${entry.date}|${line.account}|${line.party || ""}|${line.debit || 0}|${line.credit || 0}`);
  return out.sort().join("\n");
};
/** Kilitli defterin iki okuması arasındaki fark (çoklu küme; "+" eklenen, "-" düşen madde satırı). */
const lockedDiff = (before, after) => {
  const count = new Map();
  for (const line of before.split("\n").filter(Boolean)) count.set(line, (count.get(line) || 0) - 1);
  for (const line of after.split("\n").filter(Boolean)) count.set(line, (count.get(line) || 0) + 1);
  return [...count].filter(([, n]) => n).map(([line, n]) => `${n > 0 ? "+" : "-"}${line}`).sort();
};
const assertBondReject = (res, label, date) => {
  const text = JSON.stringify(res.data);
  assert.equal(res.status, 409, `${label}: 409 beklenir — ${res.status} ${text.slice(0, 300)}`);
  assert.match(text, /period-locked-bond/, `${label}: kod`);
  assert.match(text, new RegExp(tr(date).replace(/\./g, "\\.")), `${label}: ileti kilitli tahsilatın tarihini söyler`);
  assert.match(text, /yönetici dönem kilidini açmalı/, `${label}: ileti ne yapılacağını söyler`);
};

describe("S160 = A — Banka'dan Ters Kaydet / Düzelt (KDV'li masrafın faturası): kilitli tahsilatın bağını düşüren iptal 409", () => {
  let ctx;
  let bank;
  const store = () => ctx.server.app.store;
  const lockedLines = () => lockedLinesOf(ctx.server.app);
  const setLock = value => must(`kilit ${value || "yok"}`, ctx.api.put("/api/admin/period-lock", { lockedUntil: value }));
  const fee = (partyId, invoiceNo) => must(`KDV'li masraf ${invoiceNo}`, ctx.api.post(`${BANK}/vouchers`, { type: "fee", accountId: bank.id, amount: "120", feeType: "eft", tax: "vat_incl", partyId, invoiceNo, date: "2026-10-15" }));
  const eventOf = id => store().get("SELECT status FROM fin_events WHERE id = ?", id)?.status;
  const invoiceOf = id => store().get("SELECT status FROM invoices WHERE id = ?", id)?.status;
  const bondOf = id => store().get("SELECT invoice_id AS inv FROM account_entries WHERE id = ?", id)?.inv ?? null;
  const cases = {};
  /** Cari (müşteri türü: şüpheliye alınabilir; KDV'li masrafın karşı carisi olabilir) + isteğe bağlı açık şüpheli + KDV'li masraf (açık dönem) + kilitli / kilit dışı tahsilat. */
  async function tahsilatCase(name, { paidOn, doubtful = true }) {
    const party = await must(`${name} cari`, ctx.api.post("/api/workspace/accounts", { name, type: "customer", registeredOn: "2026-08-01" }));
    await must(`${name} borç`, ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "debt", amount: "1000", date: "2026-08-20", note: "Hizmet" }));
    if (doubtful) await must(`${name} şüpheli`, ctx.api.post(`/api/workspace/accounts/${party.id}/doubtful`, { amount: 600, date: "2026-09-20", reason: "lawsuit", note: "S160 tur 2d" }));
    const voucher = await fee(party.id, `TK-${Object.keys(cases).length + 1}`);
    assert.ok(voucher.invoice?.id, `${name}: ön koşul — KDV'li masrafın faturası`);
    // Programın arayüz yolu tahsilatı alış faturasına bağlamaz (Kapatılacak Fatura yön kuralı).
    const refused = await ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "100", date: paidOn, method: "cash", cashForce: true, similarOk: true, invoiceId: voucher.invoice.id });
    assert.equal(refused.status, 409, `${name}: ön koşul — arayüz yolu tahsilatı alış faturasına bağlamaz: ${refused.status} ${JSON.stringify(refused.data).slice(0, 200)}`);
    await must(`${name} tahsilat`, ctx.api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "100", date: paidOn, method: "cash", cashForce: true, similarOk: true }));
    const entryId = store().get("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'in'", party.id).id;
    // Bağ (savunma katmanı): programın kendi bağlantısından, kapıdan geçerek, kilit konmadan önce.
    store().run("UPDATE account_entries SET invoice_id = ? WHERE id = ?", voucher.invoice.id, entryId);
    assert.equal(bondOf(entryId), voucher.invoice.id, `${name}: ön koşul — tahsilat faturaya bağlı`);
    return { party, voucher, entryId, paidOn };
  }

  before(async () => {
    ctx = await bootBank({ now: "2026-10-20T12:00:00+03:00" });
    bank = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Ana Hesap", kind: "demand", opening: { date: "2026-08-01", amount: "100.000", confirmed: true } });
    cases.kilitli = await tahsilatCase("S160 Banka Kilitli", { paidOn: "2026-10-05" });
    cases.duzelt = await tahsilatCase("S160 Banka Düzelt", { paidOn: "2026-10-06" });
    cases.kilitGunu = await tahsilatCase("S160 Banka Kilit Günü", { paidOn: LOCK });
    cases.kilitDisi = await tahsilatCase("S160 Banka Kilit Dışı", { paidOn: "2026-10-12" });
    // Ret yalnız tahsilat yönünde: kilitli ÖDEME ve kilitli VERİLEN EVRAK (senet) bağı (arayüz yolu kurar — Kapatılacak Fatura ödemede alış faturasını kapatır).
    const payee = await must("ödeme cari", ctx.api.post("/api/workspace/accounts", { name: "S160 Banka Ödeme", type: "supplier", registeredOn: "2026-08-01" }));
    const paid = await fee(payee.id, "TK-ODEME");
    await must("kilitli ödeme (bağlı)", ctx.api.post(`/api/workspace/accounts/${payee.id}/entries`, { kind: "out", amount: "50", date: "2026-10-05", method: "cash", cashForce: true, similarOk: true, invoiceId: paid.invoice.id }));
    const payment = store().get("SELECT id, invoice_id AS inv FROM account_entries WHERE account_id = ? AND kind = 'out'", payee.id);
    assert.equal(payment.inv, paid.invoice.id, "ön koşul: ödeme faturaya bağlı (arayüz yolu)");
    cases.odeme = { voucher: paid, entryId: payment.id };
    const drawee = await must("evrak cari", ctx.api.post("/api/workspace/accounts", { name: "S160 Banka Verilen Evrak", type: "supplier", registeredOn: "2026-08-01" }));
    const given = await fee(drawee.id, "TK-EVRAK");
    await must("kilitli verilen senet (bağlı)", ctx.api.post("/api/workspace/cheques", { direction: "out", instrument: "note", serialNo: "S160-V1", amount: "40", accountId: drawee.id, issueDate: "2026-10-05", dueDate: "2026-12-01", invoiceId: given.invoice.id }));
    const event = store().get("SELECT ev.id, ev.invoice_id AS inv FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id WHERE c.serial_no = 'S160-V1'");
    assert.equal(event?.inv, given.invoice.id, "ön koşul: verilen evrak faturaya bağlı (arayüz yolu)");
    cases.evrak = { voucher: given, eventId: event.id };
    await setLock(LOCK);
  });
  after(() => ctx?.server.close());

  for (const [label, key] of [["tahsilat kilitli dönemde (05.10)", "kilitli"], ["tahsilat tam kilit günü", "kilitGunu"]]) {
    it(`Ters Kaydet 409 — ${label}; banka olayı, fatura, bağ ve kilitli defter aynı`, async () => {
      const x = cases[key];
      const before = lockedLines();
      const res = await ctx.api.post(`${BANK}/events/${x.voucher.id}/reverse`, { reason: "deneme" });
      // Tek karşılaştırma: yanıt, banka olayı, fatura, bağ ve kilitli defter farkı birlikte (taban kırmızısı hepsini gösterir).
      assert.deepEqual(
        { yanit: res.status, olay: eventOf(x.voucher.id), fatura: invoiceOf(x.voucher.invoice.id), bagKaldi: bondOf(x.entryId) === x.voucher.invoice.id, kilitliDefterFarki: lockedDiff(before, lockedLines()) },
        { yanit: 409, olay: "active", fatura: "issued", bagKaldi: true, kilitliDefterFarki: [] },
        `${label}: ${JSON.stringify(res.data).slice(0, 300)}`,
      );
      assertBondReject(res, label, x.paidOn);
    });
  }

  it("Düzelt (Ters Kaydet'i çağırır) 409 — yeni işlem yazılmaz, banka olayı / fatura / bağ / kilitli defter aynı", async () => {
    const x = cases.duzelt;
    const before = lockedLines();
    const events = store().get("SELECT COUNT(*) AS n FROM fin_events").n;
    const res = await ctx.api.post(`${BANK}/events/${x.voucher.id}/correct`, { amount: "130" });
    assert.deepEqual(
      { yanit: res.status, yeniIslem: store().get("SELECT COUNT(*) AS n FROM fin_events").n - events, olay: eventOf(x.voucher.id), fatura: invoiceOf(x.voucher.invoice.id), bagKaldi: bondOf(x.entryId) === x.voucher.invoice.id, kilitliDefterFarki: lockedDiff(before, lockedLines()) },
      { yanit: 409, yeniIslem: 0, olay: "active", fatura: "issued", bagKaldi: true, kilitliDefterFarki: [] },
      `Düzelt: ${JSON.stringify(res.data).slice(0, 300)}`,
    );
    assertBondReject(res, "Düzelt", x.paidOn);
  });

  it("kilit DIŞINDAKİ tahsilat bağlıysa Ters Kaydet serbest (200): fatura iptal, bağ düşer, kilitli defter aynı", async () => {
    const x = cases.kilitDisi;
    const before = lockedLines();
    await must("Ters Kaydet", ctx.api.post(`${BANK}/events/${x.voucher.id}/reverse`, { reason: "deneme" }));
    assert.equal(invoiceOf(x.voucher.invoice.id), "cancelled");
    assert.equal(bondOf(x.entryId), "", "bağ düştü (kilit dışı)");
    assert.equal(lockedLines(), before);
  });

  it("ret yalnız TAHSİLAT yönünde: kilitli ÖDEME ve kilitli VERİLEN EVRAK bağlı faturada Ters Kaydet serbest (200); kilitli defter aynı", async () => {
    const before = lockedLines();
    await must("Ters Kaydet (kilitli ödeme bağlı)", ctx.api.post(`${BANK}/events/${cases.odeme.voucher.id}/reverse`, { reason: "deneme" }));
    assert.equal(invoiceOf(cases.odeme.voucher.invoice.id), "cancelled");
    await must("Ters Kaydet (kilitli verilen evrak bağlı)", ctx.api.post(`${BANK}/events/${cases.evrak.voucher.id}/reverse`, { reason: "deneme" }));
    assert.equal(invoiceOf(cases.evrak.voucher.invoice.id), "cancelled");
    assert.equal(lockedLines(), before, "ödeme / verilen evrak bağının düşmesi kilitli defteri değiştirmez");
  });

  it("kilit kaldırılınca Ters Kaydet serbest; yeniden kilitleme çalışır ve öbür kilitli bağ yine korunur", async () => {
    await setLock("");
    await must("Ters Kaydet (kilitsiz)", ctx.api.post(`${BANK}/events/${cases.kilitli.voucher.id}/reverse`, { reason: "yönetici kilidi açtı" }));
    assert.equal(invoiceOf(cases.kilitli.voucher.invoice.id), "cancelled");
    assert.equal(bondOf(cases.kilitli.entryId), "");
    await setLock(LOCK);
    assertBondReject(await ctx.api.post(`${BANK}/events/${cases.kilitGunu.voucher.id}/reverse`, { reason: "deneme" }), "yeniden kilitten sonra", LOCK);
  });
});

describe("S160 = A — e-Belge (e-Arşiv) iptal akışı: kilitli tahsilatın bağını düşüren iptal 409, EDM'ye hiç gidilmez", () => {
  let edm;
  let server;
  let api;
  const store = () => server.app.store;
  const lockedLines = () => lockedLinesOf(server.app);
  const setLock = value => must(`kilit ${value || "yok"}`, api.put("/api/admin/period-lock", { lockedUntil: value }));
  const calls = () => edm.state.calls.length;
  const cancels = () => edm.state.calls.filter(call => call.op === "CancelInvoice").length;
  const invoiceOf = id => ({ ...store().get("SELECT status, e_status AS e FROM invoices WHERE id = ?", id) });
  const bondOf = id => store().get("SELECT invoice_id AS inv FROM account_entries WHERE id = ?", id)?.inv ?? null;
  const cases = {};
  /** e-Arşiv alıcısı (TCKN) + isteğe bağlı açık şüpheli + 15.10'da kesilip gönderilen e-Arşiv fatura + faturaya bağlı tahsilat (verilen tarihte). */
  async function earsivCase(name, { paidOn, doubtful = true }) {
    const party = await must(`${name} cari`, api.post("/api/workspace/accounts", { name, type: "customer", taxNo: "10000000146", city: "İzmir", email: "ayse@example.com", registeredOn: "2026-08-01" }));
    await must(`${name} borç`, api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "debt", amount: "1000", date: "2026-08-20", note: "Hizmet" }));
    if (doubtful) await must(`${name} şüpheli`, api.post(`/api/workspace/accounts/${party.id}/doubtful`, { amount: 600, date: "2026-09-20", reason: "lawsuit", note: "S160 tur 2d" }));
    const invoice = await must(`${name} e-Arşiv`, api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: party.id, lines: [{ name: "Bakım", qty: 1, unitPrice: 300, vatRate: 20 }], payment: { rest: "open" }, eSend: "later" }));
    assert.equal(invoice.profile, "EARSIVFATURA", `${name}: ön koşul — e-Arşiv`);
    await must(`${name} gönder`, api.post(`/api/workspace/invoices/${invoice.id}/send`, {}));
    assert.equal(invoiceOf(invoice.id).e, "sent", `${name}: ön koşul — EDM'ye gönderildi`);
    await must(`${name} bağlı tahsilat`, api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "100", date: paidOn, method: "cash", cashForce: true, similarOk: true, invoiceId: invoice.id }));
    const entryId = store().get("SELECT id FROM account_entries WHERE account_id = ? AND kind = 'in'", party.id).id;
    assert.equal(bondOf(entryId), invoice.id, `${name}: ön koşul — tahsilat faturaya bağlı (arayüz yolu)`);
    return { party, invoice, entryId, paidOn };
  }

  before(async () => {
    resetEdmCaches();
    edm = await startMockEdm();
    ({ server, api } = await boot({ edocEnabled: true, edocStatusPollMs: [10, 10], now: { time: "2026-10-15T10:00:00+03:00", fixed: true } }));
    await must("e-Belge ayarları", api.put("/api/workspace/invoices/settings", {
      seller: { name: "Deneme Ofis Ltd.", taxNo: "1234567890", taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" },
      efatura: true,
      earsiv: true,
      integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" },
    }));
    cases.kilitli = await earsivCase("S160 e-Arşiv Kilitli", { paidOn: "2026-10-09" });
    cases.kilitGunu = await earsivCase("S160 e-Arşiv Kilit Günü", { paidOn: LOCK });
    cases.kilitDisi = await earsivCase("S160 e-Arşiv Kilit Dışı", { paidOn: "2026-10-12" });
    server.clock.set("2026-10-20T12:00:00+03:00");
    await setLock(LOCK);
  });
  after(async () => {
    await server?.close();
    await edm?.close();
  });

  for (const [label, key] of [["tahsilat kilitli dönemde (09.10)", "kilitli"], ["tahsilat tam kilit günü", "kilitGunu"]]) {
    it(`e-Arşiv iptali 409 — ${label}; EDM'ye HİÇ istek yok; belge, bağ ve kilitli defter aynı`, async () => {
      const x = cases[key];
      const before = lockedLines();
      const sent = calls();
      const res = await api.post(`/api/workspace/invoices/${x.invoice.id}/cancel`, { reason: "deneme" });
      // Tek karşılaştırma: yanıt, EDM'ye giden istekler, belge, bağ ve kilitli defter farkı birlikte (taban kırmızısı hepsini gösterir).
      assert.deepEqual(
        { yanit: res.status, edmIstekleri: edm.state.calls.slice(sent).map(call => call.op), belge: invoiceOf(x.invoice.id), bagKaldi: bondOf(x.entryId) === x.invoice.id, kilitliDefterFarki: lockedDiff(before, lockedLines()) },
        { yanit: 409, edmIstekleri: [], belge: { status: "issued", e: "sent" }, bagKaldi: true, kilitliDefterFarki: [] },
        `${label}: ${JSON.stringify(res.data).slice(0, 300)}`,
      );
      assertBondReject(res, label, x.paidOn);
    });
  }

  it("kilit DIŞINDAKİ tahsilat bağlıysa e-Arşiv iptali serbest (200): EDM'de iptal (CancelInvoice bir kez), bağ düşer", async () => {
    const x = cases.kilitDisi;
    const before = lockedLines();
    const sent = cancels();
    await must("e-Arşiv iptali", api.post(`/api/workspace/invoices/${x.invoice.id}/cancel`, { reason: "deneme" }));
    assert.equal(cancels() - sent, 1, "EDM'de iptal edildi");
    assert.deepEqual(invoiceOf(x.invoice.id), { status: "cancelled", e: "cancelled" });
    assert.equal(bondOf(x.entryId), "");
    assert.equal(lockedLines(), before);
  });

  it("kilit kaldırılınca e-Arşiv iptali serbest (EDM'de iptal); yeniden kilitleme çalışır ve öbür kilitli bağ yine korunur (EDM'ye gidilmeden)", async () => {
    await setLock("");
    const sent = cancels();
    await must("e-Arşiv iptali (kilitsiz)", api.post(`/api/workspace/invoices/${cases.kilitli.invoice.id}/cancel`, { reason: "yönetici kilidi açtı" }));
    assert.equal(cancels() - sent, 1, "EDM'de iptal edildi");
    assert.deepEqual(invoiceOf(cases.kilitli.invoice.id), { status: "cancelled", e: "cancelled" });
    assert.equal(bondOf(cases.kilitli.entryId), "");
    await setLock(LOCK);
    const before = calls();
    assertBondReject(await api.post(`/api/workspace/invoices/${cases.kilitGunu.invoice.id}/cancel`, { reason: "deneme" }), "yeniden kilitten sonra", LOCK);
    assert.equal(calls() - before, 0, "EDM'ye istek gitmedi");
  });
});
