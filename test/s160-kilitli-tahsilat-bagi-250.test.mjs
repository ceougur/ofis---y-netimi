// 2.5.0 Ç5-A tur 2 — İş 5: S160 = A (kullanıcı 13.11.2026 10:40, AYNEN "a"; teyit "önerilerini yap s159 ve s160 de"): kilitli dönemdeki bir tahsilatın fatura bağını
// DÜŞÜRECEK işlem (fatura iptali / silinmesi) REDDEDİLİR (409); ileti kilitli tahsilatın tarihini söyler ve "yönetici dönem kilidini açmalı" der. Kural carinin şüpheli
// durumuna BAĞLANMAZ (docs/erp/C5-ACILIS-TASARIM.md §17.3).
// Önceden (c5a2-taban 7e8d3228): iptal 200, bağ düşüyor, şüpheli caride kilitli dönemin canlı türetmesi değişiyordu (09.10 tahsilatı A 120 → A 128) — sessiz.
// Nasıl bozulur (§17.3): şüpheli VAR / YOK; silme yolu (iptali çağırır); kilit tam tahsilat günü; kilit dışı tahsilat bağlı (serbest); kilit kaldır → iptal → yeniden kilitle;
// Kapatılacak Fatura ile bağlanmış kilitli alınan evrak. Sahte saat (ders 13); lisans servisi yok (ders 30); iki TZ'de koşulur.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { loginAdmin, startTestServer } from "./helpers.mjs";

process.env.HUKUK_LICENSE_URL ||= "http://127.0.0.1:9";
const NOW = { time: "2026-10-20T12:00:00+03:00", fixed: true };
const LOCK = "2026-10-10";

let server;
let api;
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data && typeof res.data === "object" && "ok" in res.data ? res.data.data : res.data;
};
/** Kilitli dönemin canlı türetmesi (tarihi ≤ kilit madde satırlarının çoklu kümesi). */
const lockedLines = () => {
  const out = [];
  for (const entry of server.app.ledger.build()) if (String(entry.date) <= LOCK) for (const line of entry.lines || []) out.push(`${entry.date}|${line.account}|${line.party ? "cari" : ""}|${line.debit || 0}|${line.credit || 0}`);
  return out.sort().join("\n");
};
const setLock = value => must(`kilit ${value || "yok"}`, api.put("/api/admin/period-lock", { lockedUntil: value }));
const bondOf = id => server.app.store.get("SELECT invoice_id AS inv FROM account_entries WHERE id = ?", id)?.inv || "";
const statusOf = id => server.app.store.get("SELECT status FROM invoices WHERE id = ?", id)?.status;

/** Cari (isteğe bağlı açık şüpheli) + açık dönemde fatura + verilen tarihte faturaya bağlı tahsilat. */
async function setup(name, { doubtful = false, paidOn = "2026-10-09", issueDate = "2026-10-15" } = {}) {
  const account = await must(`${name} cari`, api.post("/api/workspace/accounts", { name, type: "customer" }));
  await must(`${name} borç`, api.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "debt", amount: "1000", date: "2026-08-20", note: "Hizmet" }));
  if (doubtful) await must(`${name} şüpheli`, api.post(`/api/workspace/accounts/${account.id}/doubtful`, { amount: 600, date: "2026-09-20", reason: "lawsuit", note: "S160" }));
  const invoice = await must(`${name} fatura`, api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: account.id, issueDate, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 300, vatRate: 0 }], payment: { rest: "open" } }));
  await must(`${name} bağlı tahsilat`, api.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "in", amount: "100", date: paidOn, method: "cash", cashForce: true, similarOk: true, invoiceId: invoice.id }));
  const entry = server.app.store.get("SELECT id, invoice_id AS inv FROM account_entries WHERE account_id = ? AND kind = 'in'", account.id);
  assert.equal(entry.inv, invoice.id, `${name}: ön koşul — tahsilat faturaya bağlı`);
  return { account, invoice, entryId: entry.id };
}
const assertBondReject = (res, label, date) => {
  const text = JSON.stringify(res.data);
  assert.equal(res.status, 409, `${label}: 409 beklenir — ${res.status} ${text.slice(0, 300)}`);
  assert.match(text, /period-locked-bond/, `${label}: kod`);
  assert.match(text, new RegExp(date.split("-").reverse().join("\\.")), `${label}: ileti kilitli tahsilatın tarihini söyler`);
  assert.match(text, /yönetici dönem kilidini açmalı/, `${label}: ileti ne yapılacağını söyler`);
};

describe("S160 = A — kilitli dönemdeki tahsilatın fatura bağını düşüren iptal / silme 409; kilitli defter değişmez", () => {
  let A;
  let B;
  let C;
  let D;
  let E;
  let F;
  before(async () => {
    server = await startTestServer({ now: NOW });
    api = await loginAdmin(server);
    A = await setup("S160 Şüpheli Var", { doubtful: true });
    B = await setup("S160 Şüpheli Yok");
    C = await setup("S160 Silme", { doubtful: true });
    D = await setup("S160 Kilit Günü", { doubtful: true, paidOn: LOCK });
    E = await setup("S160 Kilit Dışı", { doubtful: true, paidOn: "2026-10-12" });
    // Kapatılacak Fatura ile bağlanan alınan evrak (UX18: çek / senet tahsilatı faturayı kapatır) — kilitli tarihte.
    const account = await must("evrak cari", api.post("/api/workspace/accounts", { name: "S160 Evrak", type: "customer" }));
    await must("evrak borç", api.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "debt", amount: "1000", date: "2026-08-20", note: "Hizmet" }));
    const invoice = await must("evrak fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: account.id, issueDate: "2026-10-15", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 300, vatRate: 0 }], payment: { rest: "open" } }));
    await must("evrak (Kapatılacak Fatura)", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", bank: "Akbank", drawer: "X", serialNo: "S160-1", amount: "100", accountId: account.id, issueDate: "2026-10-08", dueDate: "2026-12-01", invoiceId: invoice.id }));
    const event = server.app.store.get("SELECT ev.id, ev.invoice_id AS inv FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id WHERE c.serial_no = 'S160-1' AND ev.kind = 'receive'");
    assert.equal(event?.inv, invoice.id, "ön koşul: alınan evrak faturaya bağlı");
    F = { invoice, eventId: event.id };
    await setLock(LOCK);
  });
  after(() => server?.close());

  for (const [label, pick, date] of [["şüpheli VAR", () => A, "2026-10-09"], ["şüpheli YOK (kural şüpheliye bağlanmaz)", () => B, "2026-10-09"], ["tahsilat tam kilit günü", () => D, LOCK]]) {
    it(`iptal 409 — ${label}; bağ, fatura ve kilitli defter aynı`, async () => {
      const x = pick();
      const before = lockedLines();
      assertBondReject(await api.post(`/api/workspace/invoices/${x.invoice.id}/cancel`, { reason: "deneme" }), label, date);
      assert.equal(bondOf(x.entryId), x.invoice.id, "bağ kaldı");
      assert.equal(statusOf(x.invoice.id), "issued", "fatura iptal edilmedi");
      assert.equal(lockedLines(), before, "kilitli dönemin canlı türetmesi değişmedi");
    });
  }

  it("silme (iptali çağırır) 409 — fatura silinmedi, bağ ve kilitli defter aynı", async () => {
    const before = lockedLines();
    assertBondReject(await api.del(`/api/workspace/invoices/${C.invoice.id}?reason=deneme`), "silme", "2026-10-09");
    assert.equal(statusOf(C.invoice.id), "issued");
    assert.equal(bondOf(C.entryId), C.invoice.id);
    assert.equal(lockedLines(), before);
  });

  it("Kapatılacak Fatura ile bağlanmış KİLİTLİ alınan evrak: iptal 409 (evrakın bağı kalır)", async () => {
    assertBondReject(await api.post(`/api/workspace/invoices/${F.invoice.id}/cancel`, { reason: "deneme" }), "evrak", "2026-10-08");
    assert.equal(server.app.store.get("SELECT invoice_id AS inv FROM cheque_events WHERE id = ?", F.eventId).inv, F.invoice.id);
    assert.equal(statusOf(F.invoice.id), "issued");
  });

  it("kilit DIŞINDAKİ tahsilat bağlıysa iptal serbest (200)", async () => {
    await must("iptal", api.post(`/api/workspace/invoices/${E.invoice.id}/cancel`, { reason: "deneme" }));
    assert.equal(statusOf(E.invoice.id), "cancelled");
    assert.equal(bondOf(E.entryId), "", "bağ düştü (kilit dışı)");
  });

  it("kilit kaldırılınca iptal serbest; yeniden kilitleme çalışır (yönetici yolu)", async () => {
    await setLock("");
    await must("iptal (kilitsiz)", api.post(`/api/workspace/invoices/${A.invoice.id}/cancel`, { reason: "yönetici kilidi açtı" }));
    assert.equal(statusOf(A.invoice.id), "cancelled");
    assert.equal(bondOf(A.entryId), "");
    await setLock(LOCK);
    // Kilit yeniden konunca öbür kilitli bağlar yine korunur.
    assertBondReject(await api.post(`/api/workspace/invoices/${B.invoice.id}/cancel`, { reason: "deneme" }), "yeniden kilitten sonra", "2026-10-09");
  });
});

// Tur 2e DÜŞÜK-2 (dar kontrol c5a2 N12): SİLİNMİŞ alınan evrakın Kapatılacak Fatura bağı kilitli tarihte olsa da S160 reddine GİRMEZ (evrak Silinenler'de; tahsilat değil). Programın
// kendi yolu: evrak faturaya bağlanır → evrak silinir (olayın bağı kalır) → kilit → iptal 200. Silinmemiş evrakta aynı yol 409 (yukarıdaki vaka).
describe("S160 = A — silinmiş evrakın kilitli bağı iptali engellemez", () => {
  let server2;
  let api2;
  before(async () => {
    server2 = await startTestServer({ now: NOW });
    api2 = await loginAdmin(server2);
  });
  after(() => server2?.close());

  it("silinmiş evrak (Kapatılacak Fatura, kilitli tarih) → iptal 200, fatura iptal edildi", async () => {
    const take = async (label, promise) => {
      const res = await promise;
      assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      return res.data && typeof res.data === "object" && "ok" in res.data ? res.data.data : res.data;
    };
    const account = await take("cari", api2.post("/api/workspace/accounts", { name: "S160 Silinmiş Evrak", type: "customer" }));
    await take("borç", api2.post(`/api/workspace/accounts/${account.id}/entries`, { kind: "debt", amount: "1000", date: "2026-08-20", note: "Hizmet" }));
    const invoice = await take("fatura", api2.post("/api/workspace/invoices", { scenario: "service_sale", accountId: account.id, issueDate: "2026-10-15", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 300, vatRate: 0 }], payment: { rest: "open" } }));
    await take("evrak (Kapatılacak Fatura)", api2.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", bank: "Akbank", drawer: "X", serialNo: "S160-SIL", amount: "100", accountId: account.id, issueDate: "2026-10-08", dueDate: "2026-12-01", invoiceId: invoice.id }));
    const cheque = server2.app.store.get("SELECT id FROM cheques WHERE serial_no = 'S160-SIL'");
    await take("evrak sil", api2.del(`/api/workspace/cheques/${cheque.id}`));
    const event = server2.app.store.get("SELECT c.deleted_at AS gone, ev.invoice_id AS inv, ev.date FROM cheque_events ev JOIN cheques c ON c.id = ev.cheque_id WHERE c.id = ? AND ev.kind = 'receive'", cheque.id);
    assert.ok(event?.gone && event.inv === invoice.id && event.date <= LOCK, `ön koşul: silinmiş evrakın olayı kilitli tarihte faturaya bağlı: ${JSON.stringify(event)}`);
    await take("kilit", api2.put("/api/admin/period-lock", { lockedUntil: LOCK }));
    const res = await api2.post(`/api/workspace/invoices/${invoice.id}/cancel`, {});
    assert.equal(res.status, 200, `silinmiş evrak S160 reddine girmez: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    assert.equal(server2.app.store.get("SELECT status FROM invoices WHERE id = ?", invoice.id).status, "cancelled");
  });
});
