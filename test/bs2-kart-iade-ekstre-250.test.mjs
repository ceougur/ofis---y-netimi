// 2.5.0 BS-2 (a) (2.4.9 birleşik son dar kontrol DÜŞÜK-2 — eksik test; docs/2.4.9-IS-LISTESI.md satır 200, docs/2.5.0-IS-LISTESI.md A tablosu BS-2):
// Ayrıntılı Cari Ekstre'nin FATURA KÖKENLİ satır dalı (server/routes/report-center.mjs — `line.origin === "invoice"` → wayOf) testsizdi: 2.4.9 mutasyonu UM4c
// (fatura dalında cardRefund işaretini yok sayan methodLabel) yakalanmadı; ui-tur-a-249 yalnız cari kartından girilen (origin "account") iadeyi deniyordu.
// Senaryo (programın kendi yolu, API): alış faturası kartla ödenir (600) → ALIŞTAN İADE faturası, iade firmanın KREDİ KARTINA (240; fatura ödeme alanında
// kart yolu + kart hesabı). İade satırı faturadan gelir (account_entries.source = 'invoice'), giriş + kart yolu + bağı Kredi Kartı hesabı → yol adı
// "Kredi Kartına İade" (POS değil). Ekran, Excel ve PDF aynı. Kâhin (elle): alış 600 (Alacak), ödeme 600 (Borç), iade faturası 240 (Borç), karta iade 240 (Alacak)
// → bakiye 0. Lisans servisi ölü adres (ders 30); sahte saat (ders 13).
// Eski kodda (e74eb6e7) yeşildir (davranış doğru, test eksikti); dişi mutasyonla gösterilir (test/bs2-kart-iade-250-mutasyon.mjs, ders 7/38).
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { pdfText, xlsxRows } from "./fixtures/rapor-dosya-oku.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const INV = "/api/workspace/invoices";
const BANK = "/api/workspace/bank";
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });

describe("2.5.0 BS-2 (a): Ayrıntılı Cari Ekstre — fatura kökenli Kredi Kartına İade satırının yolu (alıştan iade → karta iade); ekran = Excel = PDF", () => {
  let server;
  let admin;
  const id = {};
  const ok200 = async (label, promise) => {
    const res = unwrap(await promise);
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  const range = "from=2026-10-01&to=2026-10-31";

  before(async () => {
    server = await startTestServer({ now: NOW, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    admin = await loginAdmin(server);
    await ok200("kurulum", admin.post(`${BANK}/setup/dismiss`, {}));
    const ziraat = await ok200("Ziraat", admin.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", useCard: true, opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
    id.card = (await ok200("kart", admin.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "World", kind: "card", parentId: ziraat.id, creditLimit: "50.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } }))).id;
    id.item = (await ok200("ürün", admin.post("/api/workspace/stock", { name: "Kalem", unit: "Adet", unitPrice: 100, openingQty: "0" }))).id;
    id.sup = (await ok200("tedarikçi", admin.post("/api/workspace/accounts", { name: "Toptancı A.Ş.", type: "supplier", registeredOn: "2026-10-01" }))).id;
    const purchase = await ok200("alış", admin.post(INV, { kind: "purchase", accountId: id.sup, number: "AL-BS2-1", issueDate: "2026-10-05", pricesIncludeVat: false, lines: [{ itemId: id.item, name: "", qty: 5, unitPrice: 100, discountRate: 0, vatRate: 20 }], payment: { cash: [{ amount: "600", method: "card", bankAccountId: id.card, lineKey: "a1" }], cheques: [], endorse: [], rest: "open" }, force: true }));
    const detail = await ok200("alış kartı", admin.get(`${INV}/${purchase.id}`));
    id.ret = (await ok200("alıştan iade (karta)", admin.post(INV, { kind: "purchase_return", originalId: purchase.id, issueDate: TODAY, lines: [{ originLineId: detail.lines[0].id, qty: 2 }], payment: { cash: [{ amount: "240", method: "card", bankAccountId: id.card, lineKey: "r1" }], cheques: [], endorse: [], rest: "open" }, force: true }))).id;
  });
  after(async () => server?.close());

  test("ön koşul: iade satırı faturadan gelir (source invoice), giriş + kart yolu + kart hesabı; cari kartında cardRefund; bakiye 0", async () => {
    const rows = server.app.store.all("SELECT kind, amount, method, fin_ref AS finRef, source FROM account_entries WHERE account_id = ? AND kind IN ('in', 'out') ORDER BY date, rowid", id.sup);
    assert.deepEqual(rows.map(row => [row.kind, Number(row.amount), row.method, row.finRef, row.source]), [["out", 600, "card", id.card, "invoice"], ["in", 240, "card", id.card, "invoice"]]);
    const card = await ok200("cari kartı", admin.get(`/api/workspace/accounts/${id.sup}`));
    const refund = card.entries.find(entry => entry.kind === "in" && entry.source === "invoice");
    assert.equal(refund?.cardRefund, true, "cari kartındaki fatura kökenli iade satırında cardRefund");
    assert.equal(card.totals.balance, 0, "bakiye 0 (600 − 600 − 240 + 240)");
  });

  test("Ayrıntılı Cari Ekstre: fatura kökenli iade satırının Yol'u \"Kredi Kartına İade\", ödeme \"Kredi Kartı\", \"POS\" yok; ekran = Excel = PDF", async () => {
    const query = `account=${id.sup}&${range}&items=1`;
    const screen = await ok200("ayrıntılı", admin.get(`/api/workspace/report-center/cari-ekstre?${query}`));
    const h = screen.headers;
    const [iDate, iWay, iDebit, iCredit, iDoc] = ["Tarih", "Yol", "Borç", "Alacak", "Belge No"].map(name => h.indexOf(name));
    assert.ok(iWay >= 0 && iDoc >= 0, `kolonlar: ${h.join(" | ")}`);
    // Yolu dolu satırlar (para satırları): [tarih, yol, borç, alacak].
    const cash = screen.rows.filter(row => row[iWay]).map(row => [row[iDate], row[iWay], row[iDebit], row[iCredit]]);
    assert.deepEqual(cash, [["05.10.2026", "Kredi Kartı", "600,00 TL", ""], ["08.10.2026", "Kredi Kartına İade", "", "240,00 TL"]], `ekran para satırları: ${JSON.stringify(cash)}`);
    const iadeDoc = screen.rows.find(row => row[iWay] === "Kredi Kartına İade")?.[iDoc];
    const retNo = (await ok200("iade faturası", admin.get(`${INV}/${id.ret}`))).number;
    assert.equal(iadeDoc, retNo, "iade satırının belgesi alıştan iade faturası (fatura kökenli dal)");
    assert.ok(!screen.rows.some(row => row[iWay] === "POS"), "ekranda POS yolu yok");
    assert.equal(screen.footers.at(-1)[h.indexOf("Bakiye")], "0,00 TL", "Genel Toplam bakiyesi 0");

    const xlsx = await admin.raw("GET", `/api/workspace/report-center/cari-ekstre/xlsx?${query}`);
    assert.equal(xlsx.status, 200);
    const sheet = xlsxRows(xlsx.buffer);
    const headerAt = sheet.findIndex(row => row[0] === "Tarih" && row.includes("Yol"));
    assert.ok(headerAt >= 0, "Excel başlık satırı");
    const sheetWays = sheet.slice(headerAt + 1).map(row => row[iWay]).filter(Boolean);
    assert.deepEqual(sheetWays, ["Kredi Kartı", "Kredi Kartına İade"], `Excel Yol: ${JSON.stringify(sheetWays)}`);

    const pdf = await admin.raw("GET", `/api/workspace/report-center/cari-ekstre/pdf?${query}`);
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    assert.ok(text.includes("Kredi Kartına İade"), "PDF'te \"Kredi Kartına İade\"");
    assert.ok(!/\bPOS\b/.test(text), "PDF'te POS yok");
  });
});
