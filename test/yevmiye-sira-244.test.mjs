// 2.4.4 MM8 (mali müşavir 31b; kullanıcı adına 5 dk yetkisiyle 2.4.4'e alındı): Yevmiye Defteri'nde aynı günün maddeleri kimliğe (önek + rastgele UUID) göre
// sıralanıyordu (lib/general-ledger.mjs journal → out.sort tarih + id) — ders 31'e aykırı ("aynı tarihli kayıtlar kimlikle sıralanmaz"). 001 yevmiyesinde
// "Çek ciro edildi" maddesi "Çek alındı"dan ve tahsil edilen faturadan önce görünüyordu. Kural (ders 31): aynı tarihte olay sınıfı → yazım sırası (kaynak
// tablonun rowid'i, madde "seq"); sınıf sırası JOURNAL_CLASS (şüpheli al/karşılık §4.15 → belgeler → para/cari hareketleri Kasa kaynak sırasıyla →
// kart kapanışı → şüpheliden çıkar → KDV mahsup). Sıra yalnız gösterimdir: mizan, cari bakiyesi ve şüpheli ayırması değişmez.
//
// "Nasıl bozulur?" (önce yazıldı — not defteri e67/NASIL-BOZULUR.md):
//   Y1 aynı gün iki cari satırı kimliğe göre ters sırada          Y2 fatura ile tahsilatı aynı gün: tahsilat faturadan önce
//   Y3 UUID'ler ters üretilince sıra değişir (iki koşu farklı)     Y4 sınıf içi sıra toplamları (mizan, cari bakiye, şüpheli) değiştirmemeli
//   Y5 yazım sırası taşımayan eski çağıran bozulmamalı             Y6 KDV mahsup ters kaydı asıl fişten önce; şüpheli: al → karşılık → … → çıkar
// Birim testte anahtarlar TERS ÇEVRİLEREK iki koşu üretilir (ders 31 örneği); API testinde programın kendi yazdığı 8 satır yazım sırasıyla okunur.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { journal, partyBalances, trialBalance } from "../server/lib/general-ledger.mjs";
import { ADMIN_PASSWORD, startTestServer } from "./helpers.mjs";

const D = "2026-06-17";
// Aynı günün kaynak satırları; ids: kimlik eşlemesi (birinci koşu artan, ikinci koşu TERS) — yazım sırası (seq) iki koşuda aynı.
function rowsOf(ids) {
  return {
    invoices: [{ id: ids.invoice, seq: 7, kind: "sale", date: D, number: "FIS2026000000001", glJson: JSON.stringify([{ account: "600", net: 100000 }]), tryVat: 200, tryWithheld: 0, tryStoppage: 0, tryPayable: 1200, accountType: "customer", party: "cari-alici" }],
    accountEntries: [
      { id: ids.received, seq: 21, kind: "credit", amount: 1200, date: D, note: "Çek alındı", source: "cheque", chequeDirection: "in", chequeInstrument: "cheque", accountType: "customer", party: "cari-alici" },
      { id: ids.endorsed, seq: 22, kind: "debt", amount: 1200, date: D, note: "Çek ciro edildi", source: "cheque", chequeDirection: "in", chequeInstrument: "cheque", accountType: "supplier", party: "cari-satici" },
      { id: ids.paid, seq: 23, kind: "out", amount: 300, date: D, note: "Cari ödeme", method: "cash", accountType: "supplier", party: "cari-satici" },
    ],
    cashEntries: [
      { id: ids.cashB, seq: 5, kind: "out", amount: 50, date: D, description: "Kasa çıkış (sonra yazıldı)", method: "cash" },
      { id: ids.cashA, seq: 4, kind: "in", amount: 80, date: D, description: "Kasa giriş (önce yazıldı)", method: "cash" },
    ],
    vatOffsets: [{ id: ids.vat, seq: 1, month: "2026-06", date: D, outMinor: 20000, inMinor: 0, carryInMinor: 0, carryOutMinor: 0, payableMinor: 20000, status: "reversed" }],
  };
}
const FORWARD = { invoice: "invoice-a", received: "e-a", endorsed: "e-b", paid: "e-c", cashA: "c-a", cashB: "c-b", vat: "v-a" };
const REVERSED = { invoice: "invoice-z", received: "e-z", endorsed: "e-y", paid: "e-x", cashA: "c-z", cashB: "c-y", vat: "v-z" };
const texts = entries => entries.map(entry => entry.text);
// Kâhin (kuraldan, koddan değil): fatura (belge) → Kasa (yazım sırası: giriş 4, çıkış 5) → cari satırları (21, 22, 23) → KDV mahsup → ters kaydı.
const EXPECTED = ["FIS2026000000001", "Kasa giriş (önce yazıldı)", "Kasa çıkış (sonra yazıldı)", "Çek alındı", "Çek ciro edildi", "Cari ödeme", "KDV Mahsup Fişi · 2026-06", "KDV Mahsup Fişi · 2026-06 · Geri Alındı"];

describe("MM8 Yevmiye aynı gün sırası: olay sınıfı → yazım sırası (kimlikten bağımsız)", () => {
  test("Y1/Y2/Y3/Y6 birim: kimlikler ters çevrilse de sıra aynı ve kurala uygun (fatura önce, cari satırları yazım sırasıyla, ters kayıt asıl fişten sonra)", () => {
    const forward = journal(rowsOf(FORWARD));
    const reversed = journal(rowsOf(REVERSED));
    assert.deepEqual(texts(forward), EXPECTED, `artan kimlik: ${JSON.stringify(texts(forward))}`);
    assert.deepEqual(texts(reversed), EXPECTED, `ters kimlik: ${JSON.stringify(texts(reversed))}`);
  });

  test("Y4 birim: sınıf içi sıra toplamları değiştirmez — mizan ve cari bakiyeleri iki koşuda kuruşu kuruşuna aynı", () => {
    const forward = journal(rowsOf(FORWARD));
    const reversed = journal(rowsOf(REVERSED));
    assert.deepEqual(trialBalance(reversed), trialBalance(forward));
    assert.deepEqual([...partyBalances(reversed)].sort(), [...partyBalances(forward)].sort());
    // Sıra karıştırılmış girdi (kaynak dizilerinin sırası tersine) de aynı sonucu verir.
    const shuffled = rowsOf(FORWARD);
    for (const key of Object.keys(shuffled)) shuffled[key] = shuffled[key].slice().reverse();
    const again = journal(shuffled);
    assert.deepEqual(texts(again), EXPECTED);
    assert.deepEqual(trialBalance(again), trialBalance(forward));
  });

  test("Y5 birim: yazım sırası taşımayan eski çağıranın satırları da belirlenimci (sınıf, sonra kimlik)", () => {
    const rows = rowsOf(FORWARD);
    for (const list of Object.values(rows)) for (const row of list) delete row.seq;
    const entries = journal(rows);
    assert.deepEqual(texts(entries), ["FIS2026000000001", "Kasa giriş (önce yazıldı)", "Kasa çıkış (sonra yazıldı)", "Çek alındı", "Çek ciro edildi", "Cari ödeme", "KDV Mahsup Fişi · 2026-06", "KDV Mahsup Fişi · 2026-06 · Geri Alındı"]);
  });

  test("Y6 birim: şüpheli alacak — aynı gün al → karşılık → tahsilat → çıkar (§4.15); tahsilat kimliği ne olursa olsun", () => {
    const base = ids => ({
      accountEntries: [
        { id: ids.debt, seq: 1, kind: "debt", amount: 1000, date: "2026-06-10", note: "Borç", accountType: "customer", party: "cari-x" },
        { id: ids.collect, seq: 2, kind: "in", amount: 400, date: D, note: "Tahsilat", method: "cash", accountType: "customer", party: "cari-x" },
      ],
      doubtful: {
        records: [{ id: ids.record, seq: 1, party: "cari-x", control: "120", date: D, amountMinor: 100000, status: "released", closedDate: D, reasonLabel: "Dava", note: "" }],
        provisions: [{ id: ids.provision, recordId: ids.record, date: D, amountMinor: 30000, note: "Karşılık" }],
      },
    });
    const order = ids => journal(base(ids)).filter(entry => entry.date === D).map(entry => entry.source);
    const a = order({ debt: "e-1", collect: "e-2", record: "d-1", provision: "p-1" });
    const b = order({ debt: "e-9", collect: "a-0", record: "z-9", provision: "a-1" });
    assert.deepEqual(a, b, `kimlikten bağımsız: ${JSON.stringify(a)} / ${JSON.stringify(b)}`);
    assert.deepEqual(a.slice(0, 2), ["Şüpheli Alacağa Al", "Karşılık Ayır"], JSON.stringify(a));
    assert.ok(a.indexOf("Cari tahsilat") < a.indexOf("Şüpheliden Çıkar"), JSON.stringify(a));
  });
});

describe("MM8 Yevmiye Defteri raporu (program kendi yazdığı veriyle)", () => {
  let server;
  let api;
  before(async () => {
    server = await startTestServer({ now: `${D}T10:00:00`, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    const client = server.client();
    assert.equal((await client.login("admin", ADMIN_PASSWORD)).status, 200);
    const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
    api = { get: async url => unwrap(await client.get(url)), post: async (url, body) => unwrap(await client.post(url, body)) };
  });
  after(async () => {
    await server?.close();
  });

  test("Y1/Y3 API: aynı gün yazılan 8 cari satırı Yevmiye Defteri'nde yazım sırasıyla; aynı günün faturası onlardan önce", async () => {
    const account = await api.post("/api/workspace/accounts", { name: "Sıra Deneme Ltd.", type: "customer" });
    assert.equal(account.status, 200, JSON.stringify(account.data));
    const id = account.data.id;
    for (let i = 1; i <= 8; i += 1) {
      const res = await api.post(`/api/workspace/accounts/${id}/entries`, { kind: i % 2 ? "debt" : "credit", amount: `${100 * i}`, date: D, note: `Sıra satırı ${i}` });
      assert.equal(res.status, 200, JSON.stringify(res.data));
    }
    const invoice = await api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: id, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 500, vatRate: 20 }], payment: { rest: "open" }, issueDate: D });
    assert.equal(invoice.status, 200, JSON.stringify(invoice.data));
    const report = await api.get("/api/workspace/report-center/yevmiye?preset=all");
    assert.equal(report.status, 200, JSON.stringify(report.data).slice(0, 300));
    const rows = report.data.rows || report.data.preview?.rows || [];
    assert.ok(rows.length >= 18, `satır sayısı: ${rows.length}`);
    // Maddenin ilk satırı (açıklama sütunu 2): aynı açıklamalı ardışık satırlar tek madde.
    const order = rows.map(row => String(row[2])).filter((text, index, all) => index === 0 || text !== all[index - 1]);
    const lines = order.filter(text => text.startsWith("Sıra satırı"));
    assert.deepEqual(lines, Array.from({ length: 8 }, (_, i) => `Sıra satırı ${i + 1}`), `yazım sırası: ${JSON.stringify(lines)}`);
    assert.ok(order.indexOf(invoice.data.number) >= 0 && order.indexOf(invoice.data.number) < order.indexOf("Sıra satırı 1"), `fatura (belge) aynı günün cari satırlarından önce: ${JSON.stringify(order)}`);
  });
});
