// 2.4.9 UI TUR A (UI/UX gezintisi, docs/2.4.9-IS-LISTESI.md "UI/UX GEZİNTİSİ") — sunucu ve ortak yardımcı hücreleri:
//   ORTA-1  "Kredi Kartına İade" satırı (giriş + kart yolu + bağı bir Kredi Kartı hesabı; sunucunun cardRefund işareti) yol adında "POS" değil
//           "Kredi Kartına İade". Ortak yardımcı lib/pay-method.mjs methodLabel (istemcide HOF.methodLabel aynı kural). KOMŞU yollar (ders 10):
//             • Ayrıntılı Cari Ekstre (Rapor Merkezi cari-ekstre items=1) — Yol kolonu: ekran = Excel = PDF.
//             • Kayıt kartının İşlem Geçmişi (cases/:key/activity; kayda bağlı carinin tahsilat / ödemesi) — satırda cardRefund işareti (ekran
//               "cari tahsilatı (Kredi Kartına İade)" yazar; e2e senaryo-pos-kart-249 cari kartı satırını ekranda okur).
//             • Yol yazmayan çıktılar (düz Cari Ekstre, Tüm Cari Hareketleri, cari ekstre PDF'i — WhatsApp ekstresi aynı üretici): satır "Tahsilat",
//               "POS" yazmaz (bugünkü gibi; değişmez).
//           Sayılar değişmez: bakiye, Dönem Toplamı / Genel Toplam ayrıntılı ve düz ekstrede aynı.
//   D9      silme engeli iletisi doğal cümle: "Bu carinin 2 cari hareketi var." / "Bu carinin 1 cari hareketi ve 1 taksit kartı var." (önceden
//           "Bu carinin hareketi var: 2 cari hareketi." — "hareket" iki kez).
// Beklenen sayılar programdan bağımsız: aşağıda girilen tutarların elle toplamı. Lisans servisi ölü adres (ders 30).
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { pdfText, xlsxRows } from "./fixtures/rapor-dosya-oku.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";
import { methodLabel } from "../server/lib/pay-method.mjs";
import { movementBlockText } from "../server/lib/account-movements.mjs";

const NOW = "2026-10-08T12:00:00+03:00";
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });

describe("2.4.9 UI tur A: ortak yardımcılar", () => {
  test("ORTA-1 methodLabel: cardRefund yalnız giriş + kart yolunda \"Kredi Kartına İade\"; öbür her durum eskisi gibi", () => {
    assert.equal(methodLabel("card", "in", { cardRefund: true }), "Kredi Kartına İade");
    assert.equal(methodLabel("card", "in"), "POS");
    assert.equal(methodLabel("card", "in", { cardRefund: false }), "POS");
    assert.equal(methodLabel("card", "out", { cardRefund: true }), "Kredi Kartı", "ödeme yönünde işaret yok sayılır");
    assert.equal(methodLabel("card", "", { cardRefund: true }), "POS / Kredi Kartı", "yönsüz yer değişmez");
    assert.equal(methodLabel("bank", "in", { cardRefund: true }), "Havale / EFT");
    assert.equal(methodLabel("cash", "in", { cardRefund: true }), "Nakit");
    assert.equal(methodLabel("card", "out"), "Kredi Kartı");
  });

  test("D9 movementBlockText: tek tür, iki tür, üç tür, boş, pasif cari", () => {
    const tail = "Hareketi olan cari silinmez; kullanmayacaksanız Pasife Al ile pasife alın (hareketleri ve bakiyesi korunur, cari listede Pasif altında durur).";
    assert.equal(movementBlockText({ entries: 2 }), `Bu carinin 2 cari hareketi var. ${tail}`);
    assert.equal(movementBlockText({ entries: 1, plans: 1 }), `Bu carinin 1 cari hareketi ve 1 taksit kartı var. ${tail}`);
    assert.equal(movementBlockText({ entries: 3, invoices: 1, plans: 1 }), `Bu carinin 3 cari hareketi, 1 fatura / makbuz (taslak ve iptal dahil) ve 1 taksit kartı var. ${tail}`);
    assert.equal(movementBlockText({}), `Bu carinin hareketi var. ${tail}`);
    assert.equal(movementBlockText({ cheques: 2 }, { passive: true }), "Bu carinin 2 çek / senet var. Hareketi olan cari silinmez; cari zaten pasif (hareketleri ve bakiyesi korunur).");
    for (const text of [movementBlockText({ entries: 2 }), movementBlockText({ entries: 1, plans: 1 })]) assert.ok(!/hareketi var: /.test(text), `eski kalıp yok: ${text}`);
  });
});

describe("2.4.9 UI tur A: Kredi Kartına İade satırının yol adı (komşu yollar) ve silme engeli iletisi (API)", () => {
  let server;
  let admin;
  const api = {
    get: async url => unwrap(await admin.get(url)),
    post: async (url, body) => unwrap(await admin.post(url, body)),
    put: async (url, body) => unwrap(await admin.put(url, body)),
  };
  const ok200 = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  const BANK = "/api/workspace/bank";
  const id = {};
  const range = "from=2026-10-01&to=2026-10-31";

  before(async () => {
    server = await startTestServer({ now: NOW, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
    admin = await loginAdmin(server);
    await ok200("kurulum", api.post(`${BANK}/setup/dismiss`, {}));
    const ziraat = await ok200("Ziraat", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", usePos: true, useCard: true, opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
    id.pos = (await ok200("POS", api.post(`${BANK}/pos`, { name: "Ziraat Fiziki POS", bankAccountId: ziraat.id, kind: "physical", providerKind: "bank", tax: "bsmv_incl", valorRule: "business", valorDays: 2, installmentPayout: "monthly", provisionDays: 0, refundCommission: "none", merchantNo: "123456789", terminalNo: "T001", validFrom: "2026-10-01", rates: [{ installments: 1, rate: "2,5" }] }))).pos.id;
    id.card = (await ok200("kart", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "World", kind: "card", parentId: ziraat.id, creditLimit: "50.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } }))).id;
    // Kayda bağlı tedarikçi (kayıt kartının İşlem Geçmişi komşu yolu).
    await ok200("kayıt", api.post("/api/workspace/records", { values: { "DOSYA NO": "2026/249", BORÇLU: "Toptancı A.Ş.", TUTAR: "1000,00" }, caseKey: "2026/249" }));
    id.sup = (await ok200("tedarikçi", api.post("/api/workspace/accounts", { name: "Toptancı A.Ş.", type: "supplier", registeredOn: "2026-10-01", caseKey: "2026/249", caseTitle: "2026/249 · Toptancı A.Ş." }))).id;
    // Elle toplam (kâhin): Alacak 1.000 (mal alındı) → Ödeme kartla 300 → Kredi Kartına İade 100 → POS tahsilatı 50.
    // Bakiye = Borç (300) − Alacak (1.000 + 100 + 50) = −850 (alacaklı 850).
    await ok200("alacak", api.post(`/api/workspace/accounts/${id.sup}/entries`, { kind: "credit", amount: "1000", date: "2026-10-02", note: "Mal alımı" }));
    id.pay = (await ok200("kartla ödeme", api.post(`/api/workspace/accounts/${id.sup}/entries`, { kind: "out", method: "card", amount: "300", date: "2026-10-03", note: "Kartla ödeme" }))).entryId;
    id.refund = (await ok200("kredi kartına iade", api.post(`/api/workspace/accounts/${id.sup}/entries`, { kind: "in", method: "card", amount: "100", date: "2026-10-04", cardRefund: true, note: "Karta iade" }))).entryId;
    id.posIn = (await ok200("POS tahsilatı", api.post(`/api/workspace/accounts/${id.sup}/entries`, { kind: "in", method: "card", amount: "50", date: "2026-10-05", posId: id.pos, note: "Kartla tahsil" }))).entryId;
  });
  after(async () => server?.close());

  test("ön koşul: satırlar doğru hesaplarda (iade kartta, POS tahsilatı POS'ta); cari kartı işareti; bakiye −850", async () => {
    const rows = server.app.store.all("SELECT id, kind, method, amount, fin_ref AS finRef FROM account_entries WHERE account_id = ? ORDER BY date", id.sup);
    const byId = new Map(rows.map(row => [row.id, row]));
    assert.equal(byId.get(id.pay).finRef, id.card);
    assert.equal(byId.get(id.refund).finRef, id.card, "iade kart hesabında");
    assert.equal(byId.get(id.posIn).finRef, id.pos, "POS tahsilatı POS'ta");
    const detail = await ok200("kart", api.get(`/api/workspace/accounts/${id.sup}`));
    const flags = Object.fromEntries(detail.entries.map(entry => [entry.id, entry.cardRefund === true]));
    assert.deepEqual([flags[id.refund], flags[id.posIn], flags[id.pay]], [true, false, false]);
    assert.equal(detail.totals.balance, -850);
  });

  test("ORTA-1 Ayrıntılı Cari Ekstre: Yol \"Kredi Kartına İade\" (iade), \"POS\" (POS tahsilatı), \"Kredi Kartı\" (ödeme); ekran = Excel = PDF; toplamlar düz ekstreyle aynı", async () => {
    const query = `account=${id.sup}&${range}&items=1`;
    const screen = await ok200("ayrıntılı", api.get(`/api/workspace/report-center/cari-ekstre?${query}`));
    const plain = await ok200("düz", api.get(`/api/workspace/report-center/cari-ekstre?account=${id.sup}&${range}`));
    const h = screen.headers;
    const [iDate, iWay, iNote, iDebit, iCredit] = ["Tarih", "Yol", "Açıklama / Ürün - Hizmet", "Borç", "Alacak"].map(name => h.indexOf(name));
    const ways = Object.fromEntries(screen.rows.filter(row => row[iNote]).map(row => [String(row[iNote]).split(" · ")[0], row[iWay]]));
    assert.deepEqual({ iade: ways["Karta iade"], pos: ways["Kartla tahsil"], odeme: ways["Kartla ödeme"] }, { iade: "Kredi Kartına İade", pos: "POS", odeme: "Kredi Kartı" }, `Yol kolonu: ${JSON.stringify(ways)}`);
    const refundRow = screen.rows.find(row => String(row[iNote]).split(" · ")[0] === "Karta iade");
    assert.equal(refundRow[iDate], "04.10.2026");
    assert.equal(refundRow[iCredit], "100,00 TL", "tutar değişmez (Alacak 100)");
    assert.equal(refundRow[iDebit], "");
    // Sayılar değişmez: ayrıntılı ekstrenin Genel Toplam bakiyesi = düz ekstrenin dönem sonu = −850 (850 A).
    assert.equal(screen.footers[1][h.indexOf("Bakiye")], "850,00 TL A");
    assert.equal(plain.rows.at(-1)[plain.headers.indexOf("Bakiye")], "850,00 TL A");
    const xlsx = await admin.raw("GET", `/api/workspace/report-center/cari-ekstre/xlsx?${query}`);
    assert.equal(xlsx.status, 200);
    const sheet = xlsxRows(xlsx.buffer);
    const headerAt = sheet.findIndex(row => row[0] === "Tarih" && row.includes("Yol"));
    assert.ok(headerAt >= 0, "Excel başlık satırı");
    const sheetWays = Object.fromEntries(sheet.slice(headerAt + 1).filter(row => row[iNote]).map(row => [String(row[iNote]).split(" · ")[0], row[iWay]]));
    assert.deepEqual({ iade: sheetWays["Karta iade"], pos: sheetWays["Kartla tahsil"], odeme: sheetWays["Kartla ödeme"] }, { iade: "Kredi Kartına İade", pos: "POS", odeme: "Kredi Kartı" }, `Excel Yol: ${JSON.stringify(sheetWays)}`);
    const pdf = await admin.raw("GET", `/api/workspace/report-center/cari-ekstre/pdf?${query}`);
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    assert.ok(text.includes("Kredi Kartına İade"), "PDF'te \"Kredi Kartına İade\"");
    assert.ok(text.includes("850,00 TL A"), "PDF'te Genel Toplam bakiyesi");
  });

  test("ORTA-1 yol yazmayan çıktılar değişmez: düz Cari Ekstre ve Tüm Cari Hareketleri İşlem \"Tahsilat\" (POS yok); cari ekstre PDF'inde \"POS\" yok", async () => {
    const plain = await ok200("düz", api.get(`/api/workspace/report-center/cari-ekstre?account=${id.sup}&${range}`));
    const iOp = plain.headers.indexOf("İşlem");
    const iNote = plain.headers.indexOf("Açıklama");
    // Açıklama kolonu "<not> · Makbuz <no>" yazar (tahsilat makbuzu).
    assert.equal(plain.rows.find(row => String(row[iNote]).startsWith("Karta iade"))?.[iOp], "Tahsilat");
    assert.ok(!plain.headers.includes("Yol"), "düz ekstrede Yol kolonu yok");
    const all = await ok200("tüm hareketler", api.get(`/api/workspace/report-center/cari-hareketleri?${range}`));
    const allRow = all.rows.find(row => String(row[all.headers.indexOf("Açıklama")]).startsWith("Karta iade"));
    assert.equal(allRow?.[all.headers.indexOf("İşlem")], "Tahsilat");
    assert.ok(!all.rows.some(row => row.join(" ").includes("POS")), "Tüm Cari Hareketleri'nde \"POS\" yazmaz");
    const pdf = await admin.raw("GET", `/api/workspace/accounts/${id.sup}/ekstre.pdf`);
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    assert.ok(text.includes("Karta iade") && !/\bPOS\b/.test(text), "cari ekstre PDF'i yol yazmaz (\"POS\" yok)");
  });

  test("ORTA-1 kayıt kartı İşlem Geçmişi: kayda bağlı carinin Kredi Kartına İade satırı cardRefund işaretli, POS tahsilatı ve ödeme işaretsiz; Toplam Tahsilat aynı", async () => {
    const data = await ok200("geçmiş", api.get(`/api/workspace/cases/${encodeURIComponent("2026/249")}/activity`));
    const items = data.items.filter(item => item.type === "account-entry");
    const flags = Object.fromEntries(items.map(item => [item.id, item.cardRefund === true]));
    assert.deepEqual([flags[id.refund], flags[id.posIn], flags[id.pay]], [true, false, false], `işaretler: ${JSON.stringify(flags)}`);
    assert.ok(!items.some(item => "finRef" in item), "hesap kimliği yanıta eklenmez");
    // Kâhin (elle): 100 + 50 − 300 = −150 (bugünkü kural: carinin tahsilatı − ödemesi; değişmez).
    assert.equal(data.accountPaid, -150);
  });

  test("D9 silme engeli: \"Bu carinin 2 cari hareketi var.\" / \"Bu carinin 1 cari hareketi ve 1 taksit kartı var.\"", async () => {
    const one = await ok200("cari 1", api.post("/api/workspace/accounts", { name: "Hareketli Bir", type: "customer" }));
    await ok200("borç", api.post(`/api/workspace/accounts/${one.id}/entries`, { kind: "debt", amount: "200", date: "2026-10-06" }));
    await ok200("tahsilat", api.post(`/api/workspace/accounts/${one.id}/entries`, { kind: "in", method: "cash", amount: "50", date: "2026-10-07" }));
    const blockOne = (await ok200("kart 1", api.get(`/api/workspace/accounts/${one.id}`))).deleteBlock;
    assert.match(blockOne, /^Bu carinin 2 cari hareketi var\. Hareketi olan cari silinmez; kullanmayacaksanız Pasife Al ile pasife alın/);
    const del = await admin.del(`/api/workspace/accounts/${one.id}`);
    assert.equal(del.status, 409);
    assert.match(del.data.error, /^Bu carinin 2 cari hareketi var\./, "silme ucu aynı ileti");
    const two = await ok200("cari 2", api.post("/api/workspace/accounts", { name: "Taksitli İki", type: "customer" }));
    await ok200("tahsilat", api.post(`/api/workspace/accounts/${two.id}/entries`, { kind: "in", method: "cash", amount: "10", date: "2026-10-07" }));
    await ok200("taksit kartı", api.post("/api/workspace/plans", { accountId: two.id, name: "Taksitli İki", total: "600", mode: "auto", count: 2, firstDue: "2026-10-20", registeredOn: "2026-10-01" }));
    const blockTwo = (await ok200("kart 2", api.get(`/api/workspace/accounts/${two.id}`))).deleteBlock;
    assert.match(blockTwo, /^Bu carinin 1 cari hareketi ve 1 taksit kartı var\. /);
  });
});
