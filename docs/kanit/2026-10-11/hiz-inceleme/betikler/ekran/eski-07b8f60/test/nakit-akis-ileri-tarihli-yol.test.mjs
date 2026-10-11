// 2.1.0 temel sürüm — Nakit Akış ve Vade Takip'te İLERİ TARİHLİ para satırının KAYNAĞI yoluna göre (küçük düzeltmeler, bulgu 1; 10.10.2026).
//
// Bulgu (başka ajanın raporu, burada yeniden üretildi): Nakit Akış projeksiyonu ileri tarihli para satırlarını Kasa'nın bütün yollarından okuyordu
// (cash.entries({ after })) ve HEPSİNİ "Kasa (ileri tarihli)" kaynağıyla yazıyordu. Eski sürümden kalan, hesaba atanmamış ileri tarihli havale
// (v2.0.23'e kadar çek/senet bankaya ileri tarihle tahsil edilebiliyordu) böylece "Kasa" adıyla görünüyordu; Nakit Kasa'da olmayan bir hareket.
//
// KARAR (plan §8.4, §8.9, K10, A13/karar 42):
//   - Projeksiyonun bakiyesi "Nakit ve Banka" = Nakit Kasa + Gerçek Banka (K10). İleri tarihli satır, tarihi gelince bu iki kalemden birine
//     girecekse projeksiyona girer; girmeyecekse girmez.
//   - Nakit (way cash) → "Kasa (ileri tarihli)": tarihi gelince Nakit Kasa'dadır.
//   - Hesabı atanmamış eski havale / POS (102.00 / 108.00, ref '') → AYRI kaynak "Hesabı Atanmamış (ileri tarihli)": hesabın AÇILIŞINDAN SONRA
//     gerçekleşecek bir banka hareketidir (açılıştan önceki eski hareketler açılış bakiyesinin içindedir ve Devir Kapanışı'yla kapanır; ileri
//     tarihli olan öyle değildir). Tarihi gelince "Bu Hesaba Ata" ile (liste "Tarihi Gelince Atanabilir" der) Gerçek Banka'ya girer; bu yüzden
//     kendi gününde beklenen hareket olarak kalır (T4 kararı korunur), ama "Kasa" adıyla değil. Başlangıca girmez (bugünkü Hesabı Atanmamış da girmez).
//   - Hesaba atanmış banka satırı (ref dolu): Gerçek Banka zaten bütün satırları toplar (refTotal; tarih sınırı yok) → projeksiyona ikinci kez
//     girmez. Kurumsal kart (309) ve kredi (300) satırı: borçtur, Nakit ve Banka değildir → girmez. (Bugünkü kod ileri tarihli banka satırı
//     yazmaz: 400 date-future; bu iki yol yalnız ham veriyle üretilir.)
//   - Değişmez (testin bağımsız defteriyle): D0'daki projeksiyonun dönem sonu = tarih geçip eski satırlar hesaba atandıktan sonra (D+11) aynı
//     formülle hesaplanan başlangıç ("Bugünkü Nakit ve Banka").
//   - Ekran (istemci kaynak adı), PDF ve Excel aynı adı yazar. Vade Takip aynı satırları aynı adla gösterir (komşu, ders 10).
//
// TEST VERİSİ: GERÇEK v2.0.23 kodu (git etiketi) API'sinden (CLAUDE.md test kuralı); tarihler göreli, güncel kodda sahte saat (ders 13).
// NASIL BOZARIM (önce yazıldı):
//   B1 ileri tarihli eski hesapsız havale (giriş ve çıkış) "Kasa" adıyla görünür mü? → ayrı ad, ekran/PDF/Excel aynı.
//   B2 nakit ve hesapsız havale aynı projeksiyonda: toplamlar ve dönem sonu bağımsız defterle aynı mı (satır kaybolmasın, iki kez sayılmasın)?
//   B3 tarih geçip satırlar hesaba atanınca başlangıç, D0'daki projeksiyonun dönem sonuna eşit mi (projeksiyon tutarlı mı)?
//   B4 Vade Takip (komşu): aynı satırlar aynı adla; "Kasa" süzgeciyle Kasa'nın kendi satırları.
//   B5 hesaba atanmış ileri tarihli banka satırı iki kez sayılır mı (Gerçek Banka + akış)? kurumsal kart satırı nakit/banka sayılır mı?
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { pdfText, rawRun, xlsxSheets } from "./banka-210-ortak.mjs";
import { bootBank, openAccount } from "./banka-210-hesap-ortak.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const OLD = "v2.0.23";
const BANK = "/api/workspace/bank";
const KASA = "Kasa (ileri tarihli)";
const LEGACY = "Hesabı Atanmamış (ileri tarihli)";
const pad = n => String(n).padStart(2, "0");
const base = new Date();
const day = offset => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, 12, 0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const D0 = day(0);
const dmy = iso => iso.split("-").reverse().join(".");
const must = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 500)}`);
  return res.data;
};

// Testin BAĞIMSIZ defteri (programdan okunmaz): v2.0.23'te girilen her para hareketi, yolu ve günü.
const LEDGER = {
  cash: [
    { date: day(-3), amount: 1000, why: "geçmiş nakit tahsilat" },
    { date: day(4), amount: 300, why: "alınan çek NAKİT tahsil (ileri)" },
    { date: day(7), amount: -200, why: "verilen çek NAKİT ödendi (ileri)" },
  ],
  legacy: [
    { date: day(-2), amount: 250, why: "geçmiş havale (hesapsız)" },
    { date: day(5), amount: -400, why: "verilen çek BANKADAN ödendi (ileri, hesapsız)" },
    { date: day(10), amount: 1000, why: "alınan çek BANKAYA tahsil (ileri, hesapsız)" },
  ],
  opening: 10_000, // güncel kodda açılan Ziraat hesabı (D−5)
};
const sum = (list, keep = () => true) => list.filter(keep).reduce((total, item) => total + item.amount, 0);

async function seed(dirs) {
  const old = await bootVersion(OLD, dirs);
  try {
    const api = await old.login();
    const customer = await must("v2.0.23 müşteri", api.post("/api/workspace/accounts", { name: "İleri Tarihli Müşteri", type: "customer" }));
    const supplier = await must("v2.0.23 tedarikçi", api.post("/api/workspace/accounts", { name: "İleri Tarihli Tedarikçi", type: "supplier" }));
    await must("v2.0.23 geçmiş nakit", api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: 1000, date: day(-3), method: "cash" }));
    await must("v2.0.23 geçmiş havale", api.post(`/api/workspace/accounts/${customer.id}/entries`, { kind: "in", amount: 250, date: day(-2), method: "bank" }));
    const cashIn = await must("v2.0.23 alınan çek (nakit)", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: 300, issueDate: day(-3), dueDate: day(4), serialNo: "YOL-1", accountId: customer.id }));
    await must("v2.0.23 çek NAKİT ileri tarihle tahsil", api.post(`/api/workspace/cheques/${cashIn.id}/actions`, { action: "collect", date: day(4), method: "cash", status: "portfolio" }));
    const cashOut = await must("v2.0.23 verilen çek (nakit)", api.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: 200, issueDate: day(-1), dueDate: day(7), serialNo: "YOL-2", accountId: supplier.id }));
    await must("v2.0.23 verilen çek NAKİT ileri tarihle ödendi", api.post(`/api/workspace/cheques/${cashOut.id}/actions`, { action: "pay", date: day(7), method: "cash", status: "pending" }));
    const bankOut = await must("v2.0.23 verilen çek (banka)", api.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: 400, issueDate: day(-1), dueDate: day(5), serialNo: "YOL-3", accountId: supplier.id }));
    await must("v2.0.23 verilen çek BANKADAN ileri tarihle ödendi", api.post(`/api/workspace/cheques/${bankOut.id}/actions`, { action: "pay", date: day(5), method: "bank", status: "pending" }));
    const bankIn = await must("v2.0.23 alınan çek (banka)", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: 1000, issueDate: day(-3), dueDate: day(10), serialNo: "YOL-4", accountId: customer.id }));
    await must("v2.0.23 çek BANKAYA ileri tarihle tahsil", api.post(`/api/workspace/cheques/${bankIn.id}/actions`, { action: "collect", date: day(10), method: "bank", status: "portfolio" }));
  } finally {
    await old.close();
  }
}

const skip = !tagsAvailable([OLD]) && `${OLD} etiketi bu depoda yok (git fetch --tags)`;

describe("Nakit Akış / Vade Takip: ileri tarihli satırın kaynağı yoluna göre (gerçek v2.0.23 verisi)", { skip }, () => {
  let root;
  let server;
  let api;
  let ziraat;
  let flow0;
  before(async () => {
    root = mkdtempSync(path.join(tmpdir(), "nakit-akis-yol-"));
    const dirs = { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups") };
    await seed(dirs);
    // Gerçek kurulum koşulu (ders 14): para yazımı ve kapı eşdeğerlik denetimi test kipinde değil.
    server = await bootVersion(CURRENT, { ...dirs, now: { time: D0 }, moneyStrict: false, gateVerify: false });
    api = await server.login();
    ziraat = await must("Ziraat hesabı", api.post(`${BANK}/accounts`, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: day(-5), amount: "10.000", confirmed: true } }));
    flow0 = await must("Nakit Akış D0", api.get("/api/workspace/overview/nakit-akisi?preset=next30&table=0"));
  });
  after(async () => {
    await server?.close().catch(() => {});
    if (root) rmSync(root, { recursive: true, force: true });
  });

  const future = list => list.filter(item => item.date > D0);
  const expectedRows = () =>
    [...future(LEDGER.cash).map(item => ({ ...item, source: KASA })), ...future(LEDGER.legacy).map(item => ({ ...item, source: LEGACY }))].sort((a, b) => a.date.localeCompare(b.date));
  const rowsOf = flow => flow.rows.map(row => `${row.date} ${row.direction === "in" ? "+" : "-"}${row.amount} ${row.source}`);

  it("B1+B2 API: nakit 'Kasa (ileri tarihli)', hesapsız eski havale 'Hesabı Atanmamış (ileri tarihli)'; her satır bir kez; toplamlar bağımsız defterle", () => {
    // Başlangıç (K10): Nakit Kasa (bugüne kadar) + Gerçek Banka; Hesabı Atanmamış (bugüne kadar 250) girmez.
    const nakit = sum(LEDGER.cash, item => item.date <= D0);
    assert.equal(flow0.cashToday, nakit + LEDGER.opening, `başlangıç ${flow0.cashToday} = Nakit ${nakit} + Gerçek Banka ${LEDGER.opening}`);
    assert.equal(flow0.start?.unassigned, sum(LEDGER.legacy, item => item.date <= D0), "Hesabı Atanmamış (bugüne kadar) ayrı");
    const sources = { [KASA]: "cash", [LEGACY]: "legacy" };
    const want = expectedRows().map(item => `${item.date} ${item.amount > 0 ? "+" : "-"}${Math.abs(item.amount)} ${sources[item.source]}`);
    assert.deepEqual(rowsOf(flow0), want, "akış satırları (tarih, yön, tutar, kaynak)");
    const inTotal = sum(expectedRows(), item => item.amount > 0);
    const outTotal = -sum(expectedRows(), item => item.amount < 0);
    assert.deepEqual([flow0.totals.in, flow0.totals.out], [inTotal, outTotal], "beklenen giriş / çıkış");
    assert.equal(flow0.closing, flow0.cashToday + inTotal - outTotal, "dönem sonu = başlangıç + giriş − çıkış");
    assert.equal(flow0.closing, 11_700, "dönem sonu 11.700 (1.000 + 10.000 + 300 − 400 − 200 + 1.000)");
  });

  it("B1 PDF ve Excel: Kaynak kolonu ekranla aynı ad (Kasa yalnız nakitte)", async () => {
    const pdf = await api.client.raw("GET", "/api/workspace/overview/nakit-akisi.pdf?preset=next30&table=0");
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    assert.equal((text.match(/Hesabı Atanmamış \(ileri tarihli\)/g) || []).length, 2, `PDF: hesapsız iki eski satır ayrı adla (${text.slice(0, 800)})`);
    assert.equal((text.match(/Kasa \(ileri tarihli\)/g) || []).length, 2, "PDF: yalnız iki nakit satırı Kasa");
    const xlsx = await api.client.raw("GET", "/api/workspace/overview/nakit-akisi.xlsx?preset=next30&table=0");
    assert.equal(xlsx.status, 200);
    const sheet = xlsxSheets(xlsx.buffer)["Nakit Akışı"] || [];
    // Vade hücresi Excel tarih seri numarası (1899-12-30 + gün).
    const dayOf = cell => (typeof cell === "number" ? dmy(new Date(Date.UTC(1899, 11, 30) + cell * 86_400_000).toISOString().slice(0, 10)) : String(cell));
    const byDate = Object.fromEntries(sheet.slice(1).filter(cells => cells[1] !== "Başlangıç").map(cells => [dayOf(cells[0]), cells[1]]));
    assert.deepEqual(byDate, Object.fromEntries(expectedRows().map(item => [dmy(item.date), item.source])), `Excel Kaynak kolonu: ${JSON.stringify(sheet.slice(0, 8))}`);
  });

  it("B1 ekran: istemcinin satır adı sunucuyla aynı ('Hesabı Atanmamış (ileri tarihli)'; Kasa kutusu süzgeci değişmez)", () => {
    const source = readFileSync(new URL("../client/assets/hof-overview.js", import.meta.url), "utf8");
    assert.ok(source.includes(`legacy: "${LEGACY}"`), "hof-overview.js satır adlarında legacy kaynağı yok");
  });

  it("B4 Vade Takip (komşu): aynı satırlar aynı adla; Kasa süzgeci Kasa'nın satırlarını ve hesapsız eski satırları ayrı adla verir", async () => {
    const vade = await must("Vade Takip", api.get("/api/workspace/overview/vade-takip?preset=next30&sources=cash"));
    const got = vade.rows.map(row => `${row.date} ${row.direction} ${row.amount} ${row.source}`).sort();
    const want = expectedRows().map(item => `${item.date} ${item.amount > 0 ? "in" : "out"} ${Math.abs(item.amount)} ${item.source === KASA ? "cash" : "legacy"}`).sort();
    assert.deepEqual(got, want, "Vade Takip satırları");
    const xlsx = await api.client.raw("GET", "/api/workspace/overview/vade-takip.xlsx?preset=next30&sources=cash");
    assert.equal(xlsx.status, 200);
    const sheet = xlsxSheets(xlsx.buffer)["Vade Takip"] || [];
    const head = sheet.findIndex(cells => cells.includes("Kaynak"));
    const at = sheet[head]?.indexOf("Kaynak");
    const names = sheet.slice(head + 1).map(cells => cells[at]).filter(Boolean).sort();
    assert.deepEqual(names, expectedRows().map(item => item.source).sort(), `Vade Takip Excel Kaynak: ${JSON.stringify(sheet.slice(0, 6))}`);
  });

  it("B3 tutarlılık: D+11'de eski satırlar hesaba atanınca başlangıç = D0 projeksiyonunun dönem sonu (11.700)", async () => {
    server.app.config.now.advance({ days: 11 });
    const rows = (await must("Hesabı Atanmamış", api.get(`${BANK}/legacy`))).rows.filter(row => row.date > D0);
    assert.equal(rows.length, 2, `tarihi geçen iki eski satır: ${JSON.stringify(rows)}`);
    await must("Bu Hesaba Ata", api.post(`${BANK}/legacy/assign`, { accountId: ziraat.id, rows: rows.map(row => ({ table: row.table, id: row.id })) }));
    const flow = await must("Nakit Akış D+11", api.get("/api/workspace/overview/nakit-akisi?preset=next30&table=0"));
    const nakit = sum(LEDGER.cash);
    const realBank = LEDGER.opening + sum(LEDGER.legacy, item => item.date > D0);
    assert.deepEqual([flow.start.cash, flow.start.realBank], [nakit, realBank], "Nakit Kasa 1.100 · Gerçek Banka 10.600 (bağımsız defter)");
    assert.equal(flow.cashToday, flow0.closing, `D+11 başlangıcı ${flow.cashToday} = D0 projeksiyonunun dönem sonu ${flow0.closing}`);
    assert.deepEqual(flow.rows, [], "ileri tarihli satır kalmadı");
  });
});

// B5: bugünkü kod ileri tarihli banka satırı yazmaz (400 date-future); eski sürüm de hesaba bağlı satır yazmazdı. Yol yalnız ham veriyle üretilir
// (elle düzenleme / ileride bir göç). Beklenen: hesaba atanmış satır Gerçek Banka'da (refTotal) zaten → akışta ikinci kez yok; kurumsal kart satırı
// borçtur → Nakit ve Banka projeksiyonuna girmez.
describe("Nakit Akış: hesaba atanmış ileri tarihli banka ve kurumsal kart satırı (ham veri)", () => {
  let ctx;
  const AHEAD = "2026-10-18"; // sahte saat 08.10.2026
  before(async () => {
    ctx = await bootBank();
    const ziraat = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "10.000", confirmed: true } });
    const card = await openAccount(ctx.api, { bankName: "Ziraat Bankası", name: "Şirket Kartı", kind: "card", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    await must("nakit giriş", ctx.api.post("/api/workspace/cash", { kind: "in", amount: "2.000", date: "2026-10-05", description: "Nakit" }));
    // Ham satırlar en sonda (kapı, sonradan gelen API yazımında bilinmeyen ileri tarihli satırı reddeder; K10 testiyle aynı sıra).
    const stamp = new Date().toISOString();
    rawRun(ctx.db, "INSERT INTO cash_entries (id, kind, amount, date, description, method, fin_ref, created_by, created_at) VALUES (?, 'out', 700, ?, 'Havale (Ziraat, ileri tarihli)', 'bank', ?, 'test', ?)", randomUUID(), AHEAD, ziraat.id, stamp);
    rawRun(ctx.db, "INSERT INTO cash_entries (id, kind, amount, date, description, method, fin_ref, created_by, created_at) VALUES (?, 'out', 500, ?, 'Kurumsal kart (ileri tarihli)', 'card', ?, 'test', ?)", randomUUID(), AHEAD, card.id, stamp);
  });
  after(() => ctx.server.close());

  it("B5 dönem sonu = Nakit 2.000 + Ziraat (10.000 − 700) = 11.300; havale bir kez, kart borcu hiç", async () => {
    const flow = await must("nakit akış", ctx.api.get("/api/workspace/overview/nakit-akisi?preset=next30&table=0"));
    assert.deepEqual(flow.rows.map(row => `${row.date} ${row.direction} ${row.amount} ${row.source}`), [], "akışta ileri tarihli banka/kart satırı yok (Gerçek Banka zaten içeriyor; kart borçtur)");
    assert.equal(flow.closing, 11_300, `dönem sonu ${flow.closing}: 2.000 + 10.000 − 700 (havale bir kez), kart 500 girmez`);
    const vade = await must("Vade Takip", ctx.api.get("/api/workspace/overview/vade-takip?preset=next30&sources=cash"));
    assert.deepEqual(vade.rows, [], "Vade Takip'te de yok");
  });
});

