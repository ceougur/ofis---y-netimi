// 2.3.0 ürün sahibi kararları (15.10.2026; CLAUDE.md "KARAR … bitiş turu"; plan docs/BANKA-MODULU-PLAN.md §3.11b/2–3, §3.11b/5).
// Eski kodda (469d547) kırmızı: docs/kanit/2026-10-15/karar-*-kirmizi. Sahte saat 08.10.2026 (banka-210-hesap-ortak).
//  Karar 2 — tahsilatta seçim, varsayılan "Şüpheli Alacaktan Düş":
//   (a) serbest cari tahsilatı varsayılan şüpheliden düşer; `doubtfulSkip:true` → satır 120'de kalır (kayıt kalanı değişmez); düzeltmede ve
//       Silinenler'den geri yüklemede korunur; kartta `doubtfulSkip` / `doubtfulNormal` işareti.
//   (b) fatura peşini (source 'invoice') ve "Kapatılacak Fatura" bağlı tahsilat (invoice_id dolu) KENDİLİĞİNDEN normal (yeni satışın parası).
//   (c) taksit tahsilatı: kart şüpheli kaydından SONRA açıldıysa normal; önce (ya da aynı gün) açıldıysa şüpheliden düşer.
//   Kapı: iki yükleyici (yevmiye ↔ SQL) aynı kuralı taşır — Mutabakat Testi her adımdan sonra yeşil; 128 = Σ kalan.
//  Karar 3 — Alacak Yaşlandırma: "Vade Gecikme (Gün)" kolonu (carinin en eski açık kaleminin gecikmesi; gecikmiş kalem yoksa boş; TOPLAM'da
//   toplanmaz) ve "Şüpheli Alacak (dilimlere dahil)" başlığı; ekran / PDF / Excel aynı.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOk, must, pdfText, xlsxSheets } from "./banka-210-ortak.mjs";
import { bootBank, trialBalances } from "./banka-210-hesap-ortak.mjs";
import { ACC, customer, debt, listOf, take } from "./banka-230-supheli-ortak.mjs";

const RC = "/api/workspace/report-center";
const PLAN = "/api/workspace/plans";
const collectAt = (api, accountId, amount, date, extra = {}) => api.post(`${ACC}/${accountId}/entries`, { kind: "in", method: "cash", note: "Tahsilat", amount: String(amount), date, ...extra });
const card = (api, accountId) => must("cari kartı", api.get(`${ACC}/${accountId}`));
const remainingOf = async (api, accountId, recordId) => (await listOf(api, accountId)).records.find(row => row.id === recordId).remainingMinor;
const entryOf = async (api, accountId, entryId) => (await card(api, accountId)).entries.find(row => row.id === entryId);
const lineOf = async (api, accountId, entryId) => (await card(api, accountId)).ledger.find(row => row.id === entryId);
const sale = (api, accountId, total, date, { cash = [], rest = "open" } = {}) =>
  must(`satış ${total}`, api.post("/api/workspace/invoices", { kind: "sale", accountId, issueDate: date, issueTime: "10:00", currency: "TRY", rate: 1, pricesIncludeVat: false, lines: [{ name: "Hizmet", qty: 1, unitPrice: total, discountRate: 0, vatRate: 0 }], payment: { cash, cheques: [], endorse: [], rest, ...(rest === "open" ? { dueDate: date } : {}) }, force: true, cashForce: true }));
const newPlan = (api, party, total, registeredOn, firstDue, count = 1) => must(`kart ${total}`, api.post(PLAN, { accountId: party.id, name: `${party.name} Kart ${registeredOn}`, total: String(total), mode: "auto", count, firstDue, registeredOn }));
const planCollect = (api, planId, amount, date) => must(`taksit ${amount}`, api.post(`${PLAN}/${planId}/entries`, { kind: "in", amount: String(amount), method: "cash", date }));
const trashOf = async (api, ref) => (await must("Silinenler", api.get("/api/admin/trash"))).find(row => row.kind === "account-entry" && row.ref === ref);
const colOf = (report, name) => {
  const index = report.headers.indexOf(name);
  assert.ok(index >= 0, `kolon "${name}" (başlıklar: ${report.headers.join(" | ")})`);
  return index;
};

describe("Karar 2 — tahsilatta seçim: varsayılan Şüpheli Alacaktan Düş, 'Normal Cari Hesaba İşle' (doubtfulSkip), fatura ve taksit kuralları", () => {
  let ctx;
  let api;
  let acc;
  let record;
  let skipped;
  before(async () => {
    ctx = await bootBank();
    api = ctx.api;
    acc = await customer(api, "Karar Müşteri");
    await debt(api, acc.id, 1500, "2026-09-10");
    record = (await must("al", take(api, acc.id, { amount: 1000, date: "2026-10-01", reason: "lawsuit", note: "Dava" }))).record;
  });
  after(() => ctx?.server.close());

  it("(a) varsayılan: 03.10 tahsilat 300 şüpheliden düşer → kalan 700; kartta satır 'normal' işaretli değil", async () => {
    const res = await must("tahsilat 300", collectAt(api, acc.id, 300, "2026-10-03"));
    assert.equal(await remainingOf(api, acc.id, record.id), 70000, "kalan 700");
    const entry = await entryOf(api, acc.id, res.entryId);
    assert.equal(Boolean(entry.doubtfulSkip), false, "işaret yok");
    assert.equal(Boolean(entry.doubtfulNormal), false, "normal cariye işlenmedi");
    assert.equal((await card(api, acc.id)).totals.balance, 1200, "cari bakiyesi 1.500 − 300");
    await integrityOk(api, "varsayılan tahsilat");
  });

  it("(a) doubtfulSkip:true: 04.10 tahsilat 200 normal cari hesaba (120'den) → kayıt kalanı 700 kalır; kartta doubtfulSkip + doubtfulNormal; bakiye 1.000", async () => {
    const res = await must("tahsilat 200 normal", collectAt(api, acc.id, 200, "2026-10-04", { doubtfulSkip: true }));
    skipped = res.entryId;
    assert.equal(await remainingOf(api, acc.id, record.id), 70000, "kalan 700 (şüpheliden düşmedi)");
    const entry = await entryOf(api, acc.id, skipped);
    assert.equal(entry.doubtfulSkip, true, "doubtfulSkip saklandı");
    assert.equal(entry.doubtfulNormal, true, "normal cariye işlendi");
    const line = await lineOf(api, acc.id, skipped);
    assert.equal(line.doubtfulNormal, true, "defter satırında 'normal cariye işlendi'");
    assert.equal((await card(api, acc.id)).totals.balance, 1000, "cari bakiyesi 1.200 − 200 (120 + 128 = kart)");
    const gl = await trialBalances(api);
    assert.equal(gl["128"], 700, "Ana Defter 128 = kalan 700");
    await integrityOk(api, "normal cariye tahsilat");
  });

  it("(a) düzeltmede korunur: açıklama düzeltmesi işareti bozmaz; doubtfulSkip:false → şüpheliden düşer (kalan 500); true → yine 700", async () => {
    await must("açıklama düzelt", api.put(`${ACC}/${acc.id}/entries/${skipped}`, { note: "Tahsilat (düzeltildi)" }));
    assert.equal((await entryOf(api, acc.id, skipped)).doubtfulSkip, true, "işaret korunur");
    assert.equal(await remainingOf(api, acc.id, record.id), 70000, "kalan 700");
    await must("işareti kaldır", api.put(`${ACC}/${acc.id}/entries/${skipped}`, { doubtfulSkip: false }));
    assert.equal((await entryOf(api, acc.id, skipped)).doubtfulSkip, false, "işaret kalktı");
    assert.equal(await remainingOf(api, acc.id, record.id), 50000, "kalan 500: 200 şüpheliden düştü");
    await must("işareti koy", api.put(`${ACC}/${acc.id}/entries/${skipped}`, { doubtfulSkip: true }));
    assert.equal(await remainingOf(api, acc.id, record.id), 70000, "kalan 700");
    await integrityOk(api, "düzeltme");
  });

  it("(a) sil + Silinenler'den geri yükle: işaret korunur (kalan 700 kalır, satır yine normal)", async () => {
    await must("sil", api.del(`${ACC}/${acc.id}/entries/${skipped}`));
    assert.equal(await remainingOf(api, acc.id, record.id), 70000, "silinince kalan değişmez (zaten 120'deydi)");
    assert.equal((await card(api, acc.id)).totals.balance, 1200, "bakiye 1.200");
    const item = await trashOf(api, skipped);
    assert.ok(item, "Silinenler'de");
    await must("geri yükle", api.post("/api/admin/trash/restore", { id: item.id }));
    const entry = await entryOf(api, acc.id, skipped);
    assert.ok(entry, "satır geri geldi");
    assert.equal(entry.doubtfulSkip, true, "işaret geri yüklemede korunur");
    assert.equal(await remainingOf(api, acc.id, record.id), 70000, "kalan 700");
    assert.equal((await card(api, acc.id)).totals.balance, 1000, "bakiye 1.000");
    await integrityOk(api, "geri yükleme");
  });

  it("(b) satış faturasının peşini (05.10, 400 nakit) KENDİLİĞİNDEN normal: kalan 700, bakiye 1.000; kartta peşin satırı doubtfulNormal", async () => {
    const doc = await sale(api, acc.id, 400, "2026-10-05", { cash: [{ amount: 400, method: "cash" }] });
    assert.equal(await remainingOf(api, acc.id, record.id), 70000, "kalan 700 (peşin şüpheliden düşmedi)");
    assert.equal((await card(api, acc.id)).totals.balance, 1000, "bakiye 1.000 + 400 − 400");
    const pesin = (await card(api, acc.id)).entries.find(row => row.source === "invoice" && row.sourceId === doc.id && row.kind === "in");
    assert.ok(pesin, "peşin satırı");
    assert.equal(pesin.doubtfulNormal, true, "peşin: normal cariye işlendi");
    await integrityOk(api, "fatura peşini");
  });

  it("(b) 'Kapatılacak Fatura' bağlı tahsilat (06.10, 500) KENDİLİĞİNDEN normal: kalan 700; bağsız 100 ise şüpheliden düşer → 600", async () => {
    const doc = await sale(api, acc.id, 500, "2026-10-06");
    const res = await must("bağlı tahsilat", collectAt(api, acc.id, 500, "2026-10-06", { invoiceId: doc.id }));
    assert.equal(await remainingOf(api, acc.id, record.id), 70000, "kalan 700 (bağlı tahsilat şüpheliden düşmedi)");
    assert.equal((await entryOf(api, acc.id, res.entryId)).doubtfulNormal, true, "bağlı satır: normal cariye işlendi");
    assert.equal((await card(api, acc.id)).totals.balance, 1000, "bakiye 1.000 + 500 − 500");
    await must("bağsız 100", collectAt(api, acc.id, 100, "2026-10-06"));
    assert.equal(await remainingOf(api, acc.id, record.id), 60000, "bağsız tahsilat şüpheliden: kalan 600");
    await integrityOk(api, "bağlı tahsilat");
  });

  it("(c) kart şüpheli kaydından SONRA açıldıysa (07.10) taksit tahsilatı 100 normal: kalan 600; ÖNCE açılmış kartın (15.09) taksiti şüpheliden düşer", async () => {
    const later = await newPlan(api, acc, 300, "2026-10-07", "2026-10-20");
    await planCollect(api, later.id, 100, "2026-10-07");
    assert.equal(await remainingOf(api, acc.id, record.id), 60000, "sonra açılan kartın taksiti şüpheliden düşmez");
    await integrityOk(api, "sonraki kart");

    const acc2 = await customer(api, "Eski Kartlı Müşteri");
    await debt(api, acc2.id, 1000, "2026-09-10");
    const earlier = await newPlan(api, acc2, 600, "2026-09-15", "2026-09-30", 2);
    const record2 = (await must("al 2", take(api, acc2.id, { amount: 800, date: "2026-10-01", reason: "enforcement" }))).record;
    await planCollect(api, earlier.id, 200, "2026-10-05");
    assert.equal(await remainingOf(api, acc2.id, record2.id), 60000, "önce açılan kartın taksiti şüpheliden: 800 − 200");
    const gl = await trialBalances(api);
    assert.equal(gl["128"], 1200, "Ana Defter 128 = 600 + 600");
    await integrityOk(api, "önceki kart");
  });

  it("normal cariye tahsilat carinin şüpheli dışı borç bakiyesini aşamaz: 409 doubtful-normal-exceeds, hiçbir şey yazılmaz (kapı 'ledger-integrity' yerine açık metin)", async () => {
    const acc3 = await customer(api, "Oda Müşteri");
    await debt(api, acc3.id, 1000, "2026-09-10");
    const rec = (await must("al", take(api, acc3.id, { amount: 800, date: "2026-10-01", reason: "other" }))).record;
    // 120 = 1.000 − 800 = 200; normal 300 → aşar.
    const res = await collectAt(api, acc3.id, 300, "2026-10-05", { doubtfulSkip: true });
    assert.equal(res.status, 409, `409 beklenir — gelen ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    assert.equal(res.code, "doubtful-normal-exceeds");
    assert.match(String(res.data.error), /200,00/);
    assert.equal((await card(api, acc3.id)).entries.filter(row => row.kind === "in").length, 0, "yazılmadı");
    assert.equal(await remainingOf(api, acc3.id, rec.id), 80000);
    const ok = await must("200 normal", collectAt(api, acc3.id, 200, "2026-10-05", { doubtfulSkip: true }));
    assert.equal(await remainingOf(api, acc3.id, rec.id), 80000, "tam sınır: 200 normal, kalan 800");
    // Düzeltmede yalnız eklenen fark sayılır: 200 → 250 aşar (oda 0), 200 → 150 olur.
    const up = await api.put(`${ACC}/${acc3.id}/entries/${ok.entryId}`, { amount: "250" });
    assert.equal(up.code, "doubtful-normal-exceeds", `düzeltmede aşım 409 — gelen ${up.status}`);
    await must("150", api.put(`${ACC}/${acc3.id}/entries/${ok.entryId}`, { amount: "150" }));
    await integrityOk(api, "oda sınırı");
  });

  it("doubtfulSkip yalnız tahsilatta: borç/alacak satırında ve ödemede 400", async () => {
    const res = await api.post(`${ACC}/${acc.id}/entries`, { kind: "debt", amount: "10", date: "2026-10-07", note: "x", doubtfulSkip: true });
    assert.equal(res.status, 400, `borç satırında doubtfulSkip 400 — gelen ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
    assert.equal(res.code, "doubtful-skip-kind");
  });
});

describe("Karar 3 — Alacak Yaşlandırma: 'Vade Gecikme (Gün)' ve 'Şüpheli Alacak (dilimlere dahil)' (ekran / PDF / Excel)", () => {
  let ctx;
  let api;
  before(async () => {
    ctx = await bootBank();
    api = ctx.api;
    // Geciken: 01.09 kartı 1.000 / 2 taksit, vadeler 20.09 (18 gün gecikmiş) ve 20.10 (gelmemiş).
    const late = await customer(api, "Geciken Müşteri");
    await newPlan(api, late, 1000, "2026-09-01", "2026-09-20", 2);
    // Yalnız şüphelisi olan cari: gecikmiş vade kalemi yok → Vade Gecikme boş.
    const doubtfulOnly = await customer(api, "Yalnız Şüpheli");
    await debt(api, doubtfulOnly.id, 2000, "2026-09-10");
    await must("al", take(api, doubtfulOnly.id, { amount: 2000, date: "2026-10-01", reason: "lawsuit" }));
  });
  after(() => ctx?.server.close());

  it("kolonlar: Vade Gecikme (Gün) = 18 (Geciken), boş (Yalnız Şüpheli); Şüpheli Alacak (dilimlere dahil) 2.000; TOPLAM'da gecikme toplanmaz", async () => {
    const report = await must("yaşlandırma", api.get(`${RC}/alacak-yaslandirma`));
    const gap = colOf(report, "Vade Gecikme (Gün)");
    const sup = colOf(report, "Şüpheli Alacak (dilimlere dahil)");
    assert.ok(!report.headers.includes("Şüpheli Alacak"), "eski başlık kalktı");
    const late = report.rows.find(cells => cells[0] === "Geciken Müşteri");
    const only = report.rows.find(cells => cells[0] === "Yalnız Şüpheli");
    assert.ok(late && only, "iki satır");
    assert.equal(String(late[gap]), "18", "en eski açık kalem 20.09 → 18 gün");
    assert.equal(late[colOf(report, "1–30 Gün")], "500,00 TL");
    assert.equal(late[colOf(report, "Vadesi Gelmemiş")], "500,00 TL");
    assert.equal(String(only[gap]), "", "gecikmiş kalem yoksa boş");
    assert.equal(only[sup], "2.000,00 TL");
    assert.equal(only[colOf(report, "Toplam")], "0,00 TL", "şüpheli Toplam'a ikinci kez girmez");
    assert.equal(String(report.footer[gap] ?? ""), "", "TOPLAM satırında gecikme günü toplanmaz");
    assert.equal(report.footer[sup], "2.000,00 TL");
    assert.match(report.subtitle, /dilimlere dahil/, "alt başlık kuralı söyler");
  });

  it("PDF ve Excel aynı başlıklar ve değerler", async () => {
    const report = await must("yaşlandırma", api.get(`${RC}/alacak-yaslandirma`));
    const pdf = await api.raw("GET", `${RC}/alacak-yaslandirma/pdf`);
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    for (const head of ["Vade Gecikme (Gün)", "Şüpheli Alacak (dilimlere dahil)"]) assert.ok(text.includes(head), `PDF başlık "${head}"`);
    assert.ok(/Geciken Müşteri\s*18\b/.test(text), `PDF'te Geciken Müşteri 18 (${text.slice(0, 600)})`);
    const xlsx = await api.raw("GET", `${RC}/alacak-yaslandirma/xlsx`);
    assert.equal(xlsx.status, 200);
    const sheet = Object.values(xlsxSheets(xlsx.buffer))[0];
    const header = sheet.find(cells => cells.includes("Vade Gecikme (Gün)"));
    assert.ok(header, "Excel başlık satırı");
    assert.deepEqual(header.map(String), report.headers, "Excel başlıkları = rapor başlıkları");
    const late = sheet.find(cells => String(cells[0]) === "Geciken Müşteri");
    assert.equal(Number(late[header.indexOf("Vade Gecikme (Gün)")]), 18, "Excel gecikme günü sayı");
    const only = sheet.find(cells => String(cells[0]) === "Yalnız Şüpheli");
    assert.equal(Number(only[header.indexOf("Şüpheli Alacak (dilimlere dahil)")]), 2000);
  });
});
