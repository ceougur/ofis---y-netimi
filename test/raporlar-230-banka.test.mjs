// 2.3.0 İz 3.3 — plan §8.10 KALAN banka raporları (docs/2.3.0-RAPORLAR-KABUL.md; 2.1.0 eşleme 130, 293–301 "YOK — iş yapılmadı").
//
// Rapor Merkezi Banka grubu (bank.reports): Günlük Banka Raporu, Aylık Banka Raporu, Banka Bazında Bakiye, Para Birimi Bazında Bakiye, Bankalar Arası
// Transfer Raporu, Kasa ve Banka Transfer Raporu, Cari ve Banka Hareketleri, Fatura ve Banka Hareketleri (bağ türü), Taksit ve Banka Hareketleri,
// Banka Nakit Akış Raporu ("Planlanan Transfer" ayrı kolon); Banka ve POS Hareketleri'nde Yol "Kredi Kartı" / "Kredi" + Hesap süzgeci (eşleme 299);
// Nakit Akış / Vade Takip / Zil'de planlı banka işlemleri ve kart borcu son ödeme günü (eşleme 130, 301).
//
// Veri API'den, gerçek iş akışıyla girilir; beklenen sayılar programın kodu çağrılmadan testin kendi defterinden (E) düz toplamlarla hesaplanır
// (ders 5); her rapor × her süzgeç seçeneği × her dönem için ekran JSON'u, PDF metni ve Excel hücreleri karşılaştırılır; TOPLAM = satırlar (ders 11).
// Tarihe bağlı değil: sahte saat 08.10.2026 (ders 13).
//
// NASIL BOZARIM (docs/2.3.0-RAPORLAR-KABUL.md; testler buradan): 1 ay/yıl sınırı · 2 aynı gün iç + dış · 3 ters kayıt · 4 hesabı atanmamış · 5 iki şirket ·
// 7 üç ondalık · 8 PDF/Excel toplamı · 9 süzgeç ulaşmıyor · 10 yetki · 11 boş/tek/geçmiş/gelecek/ileri tarih · 12 gecikmiş planlı · 13 planlı transfer
// çift sayılmaz · 14 kart borcu çift sayılmaz.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { apiOf, integrityOk, pdfText, unwrap, xlsxSheets } from "./banka-210-ortak.mjs";
import { BANK, TODAY, bootBank, expectStatus, must, openAccount, trIban } from "./banka-210-hesap-ortak.mjs";

const RC = "/api/workspace/report-center";
const NEW_REPORTS = ["banka-gunluk", "banka-aylik", "banka-bazinda-bakiye", "para-birimi-bazinda-bakiye", "bankalar-arasi-transfer", "kasa-banka-transfer", "cari-banka-hareketleri", "fatura-banka-hareketleri", "taksit-banka-hareketleri", "banka-nakit-akis"];
const K10 = { realBank: "Gerçek Banka", debt: "Kart ve Kredi Borcu", unassigned: "Hesabı Atanmamış Eski Hareketler" };
const NO_SUM = new Set(["Bakiye", "Gün Sonu Bakiye", "Ay Başı Bakiye", "Ay Sonu Bakiye", "Beklenen Gerçek Banka"]);
const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

// ---------- Programdan bağımsız biçim yardımcıları ----------
const moneyOf = cell => {
  const match = /^(-|−)?((?:\d{1,3}(?:\.\d{3})*|\d+)),(\d{2}) TL$/.exec(String(cell ?? "").trim());
  return match ? Math.round(Number(`${match[2].replace(/\./g, "")}.${match[3]}`) * 100) * (match[1] ? -1 : 1) : null;
};
const sumBy = (list, pick) => list.reduce((total, item) => total + pick(item), 0);
const dayText = iso => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
const monthText = key => `${MONTHS[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`;
const qs = query => new URLSearchParams(Object.entries(query).filter(([, value]) => value !== "" && value !== undefined)).toString();

// ---------- Bağımsız defter (E): her para satırı hesabı, tarihi, payı, carisi, kaynağı ve fatura bağıyla ----------
// acc: Z, G (Gerçek Banka), K (kart 309), L (kredi 300), U102 (hesabı atanmamış havale). cls: ext (dış), tr (iç; fee = dış payı), adj (açılış).
// party: ABC / XYZ (cari satırları); src: cari | fatura | taksit | masraf | transfer | kasa | kart | acilis; link: Peşin | Kapatılacak Fatura |
// Otomatik (En Eski) (fatura raporu); planName: taksit kartı.
const E = [];
const push = row => E.push({ extIn: 0, extOut: 0, trIn: 0, trOut: 0, adj: 0, party: "", src: "", link: "", invoiceNo: "", planName: "", ...row });
const ext = (d, acc, signed, extra = {}) => push({ d, acc, signed, extIn: Math.max(signed, 0), extOut: Math.max(-signed, 0), ...extra });
const tr = (d, acc, signed, fee = 0, extra = {}) => {
  const out = signed < 0;
  push({ d, acc, signed, extIn: out ? 0 : fee, extOut: out ? fee : 0, trIn: out ? 0 : signed - fee, trOut: out ? -signed - fee : 0, ...extra });
};
const adj = (d, acc, signed) => push({ d, acc, signed, adj: signed, src: "acilis" });
const REAL = ["Z", "G"];
const DEBT = ["K", "L"];
const ALL_WAYS = [...REAL, ...DEBT, "U102"];
// Planlı banka işlemleri ve öbür beklenen akışlar (bağımsız): Banka Nakit Akış Raporu, Nakit Akış, Vade Takip, Zil.
const PLANNED = [];

const RANGES = [
  { label: "varsayılan (Bu Yıl)", q: {}, from: "2026-01-01", to: "2026-12-31" },
  { label: "Tüm Zamanlar", q: { preset: "all" }, from: "", to: TODAY },
  { label: "Bu Ay", q: { preset: "thisMonth" }, from: "2026-10-01", to: "2026-10-31" },
  { label: "05.10–06.10", q: { from: "2026-10-05", to: "2026-10-06" }, from: "2026-10-05", to: "2026-10-06" },
  { label: "tek gün 03.10", q: { from: "2026-10-03", to: "2026-10-03" }, from: "2026-10-03", to: "2026-10-03" },
  { label: "geçmiş (Eylül: yalnız eski hareket)", q: { from: "2026-09-01", to: "2026-09-30" }, from: "2026-09-01", to: "2026-09-30" },
  { label: "gelecek (hareket yok)", q: { from: "2026-10-09", to: "2026-12-31" }, from: "2026-10-09", to: "2026-12-31" },
  { label: "boş dönem (2020)", q: { from: "2020-01-01", to: "2020-12-31" }, from: "2020-01-01", to: "2020-12-31" },
];
const inRange = (d, r) => (!r.from || d >= r.from) && (!r.to || d <= r.to);
const beforeRange = (d, r) => Boolean(r.from) && d < r.from;
const upTo = (d, r) => !r.to || d <= r.to;

describe("2.3.0 İz 3.3 — §8.10 kalan banka raporları (bağımsız beklenenle, her süzgeç × ekran/PDF/Excel)", () => {
  let ctx;
  let api;
  let acc;
  let label;
  let party;
  let companyName;
  let invoiceNo;
  const stats = { combos: 0, footer: 0, files: 0 };

  before(async () => {
    ctx = await bootBank();
    api = ctx.api;
    const companies = await must("şirketler", api.get("/api/companies"));
    companyName = "Rapor Üç Ticaret A.Ş.";
    await must("unvan", api.put(`/api/companies/${companies.companies[0].id}`, { name: companyName }));
    const abc = await must("ABC", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    const xyz = await must("XYZ", api.post("/api/workspace/accounts", { name: "XYZ Tedarik", type: "supplier", registeredOn: "2026-09-01" }));
    party = { ABC: abc, XYZ: xyz };
    // Eski sürüm gibi: hesap tanımlanmadan girilmiş havale → Hesabı Atanmamış (102.00).
    await must("eski havale", api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", amount: "5.000", method: "bank", date: "2026-09-20" }));
    ext("2026-09-20", "U102", 500_000, { party: "ABC", src: "cari", link: "Otomatik (En Eski)" });
    // Hesaplar (01.10.2026): Ziraat 100.000, Garanti 50.000, Ziraat kartı borç 5.000 (son ödeme günü 20), Garanti kredisi 0.
    const ziraat = await openAccount(api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", iban: trIban(10, 1234567), opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
    adj("2026-10-01", "Z", 10_000_000);
    const garanti = await openAccount(api, { bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", iban: trIban(62, 7654321), useCheque: true, opening: { date: "2026-10-01", amount: "50.000", confirmed: true } });
    adj("2026-10-01", "G", 5_000_000);
    const card = await openAccount(api, { bankName: "Ziraat Bankası", name: "Şirket Kartı", kind: "card", creditLimit: "50.000", dueDay: 20, opening: { date: "2026-10-01", amount: "5.000", confirmed: true } });
    assert.equal(card.dueDay, 20, "kartın son ödeme günü kaydedildi");
    adj("2026-10-01", "K", -500_000);
    const loan = await openAccount(api, { bankName: "Garanti BBVA", name: "Ticari Kredi", kind: "loan", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    acc = { Z: ziraat, G: garanti, K: card, L: loan };
    label = { Z: "Ziraat Bankası · Ana TL Hesabı", G: "Garanti BBVA · Ana TL Hesabı", K: "Ziraat Bankası · Şirket Kartı", L: "Garanti BBVA · Ticari Kredi" };
    const Z = ziraat.id;
    const G = garanti.id;
    // XYZ'nin açık alış faturası (01.10, 10.000) → "Kapatılacak Fatura" bağı için.
    const purchase = await must("alış faturası", api.post("/api/workspace/invoices", { kind: "purchase", accountId: xyz.id, number: "AL-2026-7", issueDate: "2026-10-01", pricesIncludeVat: true, lines: [{ name: "Malzeme", qty: 1, unitPrice: 10000, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }));
    // 1. ABC tahsilatı 20.000 Ziraat (fatura seçilmeden → Otomatik (En Eski): ABC'nin kesilmiş faturası var).
    await must("ABC tahsilat", api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", amount: "20.000", method: "bank", bankAccountId: Z, date: "2026-10-02" }));
    ext("2026-10-02", "Z", 2_000_000, { party: "ABC", src: "cari", link: "Otomatik (En Eski)" });
    // 2. XYZ ödemesi 3.000 Garanti, Kapatılacak Fatura AL-2026-7.
    const paid = await must("XYZ ödeme", api.post(`/api/workspace/accounts/${xyz.id}/entries`, { kind: "out", amount: "3.000", method: "bank", bankAccountId: G, date: "2026-10-02", invoiceId: purchase.id }));
    assert.equal(paid.invoiceId || paid.entry?.invoiceId || purchase.id, purchase.id, "fatura bağı kaydedildi");
    ext("2026-10-02", "G", -300_000, { party: "XYZ", src: "cari", link: "Kapatılacak Fatura", invoiceNo: "AL-2026-7" });
    // 3. ABC satış faturası peşini 5.000 Garanti (Peşin).
    const sale = await must("satış faturası", api.post("/api/workspace/invoices", { kind: "sale", accountId: abc.id, number: "SF-2026-3", issueDate: "2026-10-03", pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: 5000, discountRate: 0, vatRate: 0 }], payment: { cash: [{ amount: "5.000", method: "bank", bankAccountId: G, lineKey: "r3-1" }], cheques: [], endorse: [], rest: "open" }, force: true }));
    invoiceNo = { purchase: purchase.number || "AL-2026-7", sale: sale.number || "SF-2026-3" };
    ext("2026-10-03", "G", 500_000, { party: "ABC", src: "fatura", link: "Peşin", invoiceNo: invoiceNo.sale });
    // 4. Taksit kartı (ABC 6.000 / 3, ilk vade 15.10) ve 2.000 havale tahsilatı Ziraat (03.10).
    const plan = await must("taksit kartı", api.post("/api/workspace/plans", { accountId: abc.id, name: "ABC Ltd.", total: "6.000", mode: "auto", count: 3, firstDue: "2026-10-15" }));
    await must("taksit tahsilatı", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "2.000", method: "bank", bankAccountId: Z, date: "2026-10-03" }));
    ext("2026-10-03", "Z", 200_000, { party: "ABC", src: "taksit", planName: "ABC Ltd." });
    // 5. Kasa ↔ Banka: Ziraat → Kasa 10.000; Kasa → Garanti 2.000 (05.10; iç hareket).
    await must("bankadan kasaya", api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: "10.000", date: "2026-10-05", bankAccountId: Z }));
    tr("2026-10-05", "Z", -1_000_000, 0, { src: "kasa" });
    await must("kasadan bankaya", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "2.000", date: "2026-10-05", bankAccountId: G }));
    tr("2026-10-05", "G", 200_000, 0, { src: "kasa" });
    // 6. Bankalar arası: Ziraat → Garanti 20.000 + ücret 5 BSMV Hariç (5,25; EFT); Garanti → Ziraat 1.000 ücretsiz, sonra ters kaydedilir (06.10).
    await must("ücretli transfer", api.post(`${BANK}/transfers`, { accountId: Z, toAccountId: G, amount: "20.000", date: "2026-10-06", feeAmount: "5", feeTax: "bsmv_excl", feeType: "eft", channel: "eft" }));
    tr("2026-10-06", "Z", -2_000_525, 525, { src: "transfer" });
    tr("2026-10-06", "G", 2_000_000, 0, { src: "transfer" });
    const free = await must("ücretsiz transfer", api.post(`${BANK}/transfers`, { accountId: G, toAccountId: Z, amount: "1.000", date: "2026-10-06" }));
    tr("2026-10-06", "G", -100_000, 0, { src: "transfer" });
    tr("2026-10-06", "Z", 100_000, 0, { src: "transfer" });
    await must("transfer ters kaydı", api.post(`${BANK}/events/${encodeURIComponent(free.id)}/reverse`, { reason: "Yanlış hesap" }));
    tr("2026-10-06", "G", 100_000, 0, { src: "transfer" });
    tr("2026-10-06", "Z", -100_000, 0, { src: "transfer" });
    // 7. Masraf 10,50 BSMV Dahil Ziraat; kart borcu ödemesi 2.000 Ziraat → kart (07.10).
    await must("masraf", api.post(`${BANK}/vouchers`, { type: "fee", accountId: Z, amount: "10,50", feeType: "eft", tax: "bsmv_incl", date: "2026-10-07" }));
    ext("2026-10-07", "Z", -1_050, { src: "masraf" });
    await must("kart borcu", api.post(`${BANK}/vouchers`, { type: "card_payment", accountId: Z, cardAccountId: card.id, amount: "2.000", date: "2026-10-07" }));
    tr("2026-10-07", "Z", -200_000, 0, { src: "kart" });
    tr("2026-10-07", "K", 200_000, 0, { src: "kart" });
    // 8. ABC'den alınan çek 4.000 (vade Salı 27.10) Garanti'ye tahsile verildi (07.10): para satırı yok; beklenen giriş 27.10 (iş günü).
    const cheque = await must("çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "4.000", issueDate: "2026-10-07", dueDate: "2026-10-27", drawer: "Keşideci A", serialNo: "RC-7", accountId: abc.id }));
    await must("tahsile ver", api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "bank-deposit", date: "2026-10-07", bankAccountId: G }));
    PLANNED.push({ date: "2026-10-27", source: "Tahsildeki Çek ve Senet", in: 400_000, out: 0, transfer: 0, account: label.G, bank: false });
    // 9. Bugün ABC'den 1.500 Garanti.
    await must("bugünkü tahsilat", api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", amount: "1.500", method: "bank", bankAccountId: G, date: TODAY }));
    ext(TODAY, "G", 150_000, { party: "ABC", src: "cari", link: "Otomatik (En Eski)" });
    // 10. Planlı banka işlemleri: gecikmiş diğer ödeme 100 (01.10, Ziraat); masraf 200 (15.10, Ziraat); transfer Ziraat → Garanti 5.000 (20.10);
    //     diğer gelir 1.000 (25.10, Garanti). Kart borcu son ödeme günü: kalan borç 3.000 → 20.10 (planlı Kart Borcu Ödemesi yok → kalem yazılır).
    await must("gecikmiş plan", api.post(`${BANK}/plans`, { kind: "other_out", accountId: Z, amount: "100", plannedDate: "2026-10-01", description: "Aidat" }));
    PLANNED.push({ date: "2026-10-01", source: "Planlı Banka İşlemi", in: 0, out: 10_000, transfer: 0, account: label.Z, bank: true, overdue: true });
    await must("planlı masraf", api.post(`${BANK}/plans`, { kind: "fee", accountId: Z, amount: "200", plannedDate: "2026-10-15", feeType: "eft", tax: "bsmv_incl", description: "Hesap işletim" }));
    PLANNED.push({ date: "2026-10-15", source: "Planlı Banka İşlemi", in: 0, out: 20_000, transfer: 0, account: label.Z, bank: true });
    await must("planlı transfer", api.post(`${BANK}/plans`, { kind: "transfer", accountId: Z, toAccountId: G, amount: "5.000", plannedDate: "2026-10-20", description: "Maaş havuzu" }));
    PLANNED.push({ date: "2026-10-20", source: "Planlanan Transfer", in: 0, out: 0, transfer: 500_000, account: `${label.Z} → ${label.G}`, bank: true, internal: true });
    await must("planlı gelir", api.post(`${BANK}/plans`, { kind: "other_in", accountId: G, amount: "1.000", plannedDate: "2026-10-25", description: "Kira" }));
    PLANNED.push({ date: "2026-10-25", source: "Planlı Banka İşlemi", in: 100_000, out: 0, transfer: 0, account: label.G, bank: true });
    PLANNED.push({ date: "2026-10-20", source: "Kart Borcu (Son Ödeme Günü)", in: 0, out: 300_000, transfer: 0, account: label.K, bank: false, cardDue: true });
    await integrityOk(api, "veri girildi");
  });
  after(() => ctx?.server.close());

  // ---------- Bağımsız beklenen ----------
  const of = keys => E.filter(row => keys.includes(row.acc));
  const closing = (keys, r = { to: "" }) => sumBy(of(keys).filter(row => upTo(row.d, r)), row => row.signed);
  const opening = (keys, r) => sumBy(of(keys).filter(row => beforeRange(row.d, r)), row => row.signed);
  const periodOf = (keys, r) => of(keys).filter(row => inRange(row.d, r));
  const bucket = list => ({ count: list.length, extIn: sumBy(list, row => row.extIn), extOut: sumBy(list, row => row.extOut), trIn: sumBy(list, row => row.trIn), trOut: sumBy(list, row => row.trOut), adj: sumBy(list, row => row.adj) });
  const netOf = b => b.extIn - b.extOut + b.trIn - b.trOut + b.adj;
  const realBankToday = () => closing(REAL);
  // Hesap seçenekleri: bankAccount (Günlük/Aylık/transfer raporları: "" = Gerçek Banka) ve anyAccount (hareket raporları: "" = bütün banka tarafı).
  const BANK_CHOICES = [["", REAL], ["Z", ["Z"]], ["G", ["G"]], ["K", ["K"]], ["L", ["L"]], ["unassigned", ["U102"]]];
  const ANY_CHOICES = [["", ALL_WAYS], ["Z", ["Z"]], ["G", ["G"]], ["K", ["K"]], ["L", ["L"]], ["unassigned", ["U102"]]];
  const choiceQuery = (param, choice) => (choice ? { [param]: acc[choice]?.id || choice } : {});
  const choiceTitle = (choice, all) => (choice === "unassigned" ? K10.unassigned : choice ? `${label[choice]} (${acc[choice].glSub})` : all);

  // ---------- Ortak denetimler: TOPLAM = satırlar; PDF ve Excel = ekran ----------
  const get = (id, query = {}, format = "") => (format ? api.raw("GET", `${RC}/${id}/${format}?${qs(query)}`) : api.get(`${RC}/${id}?${qs(query)}`));
  const col = (data, header) => {
    const index = data.headers.indexOf(header);
    assert.ok(index >= 0, `${data.id}: "${header}" kolonu yok (${data.headers.join(", ")})`);
    return index;
  };
  const cellOf = (data, row, header) => moneyOf(row[col(data, header)]) ?? 0;
  const summaryOf = (data, key) => {
    const hit = data.summary.find(([name]) => name === key);
    assert.ok(hit, `${data.id}: özette "${key}" yok: ${JSON.stringify(data.summary)}`);
    return moneyOf(hit[1]) ?? hit[1];
  };
  function checkFooter(data, tag) {
    assert.equal(data.rows.length, data.total, `${tag}: küçük veride bütün satırlar ön izlemede`);
    for (const row of data.rows) assert.equal(row.length, data.headers.length, `${tag}: satır kolon sayısı`);
    if (!data.rows.length) assert.ok(data.hint || data.empty || !data.footer, `${tag}: boş dönemde ipucu / TOPLAM yok`);
    if (!data.footer) return;
    assert.ok(data.footer.includes("TOPLAM"), `${tag}: TOPLAM etiketi`);
    data.headers.forEach((header, index) => {
      if (data.types[index] !== "money") return;
      const cell = data.footer[index];
      if (NO_SUM.has(header)) return assert.equal(cell, "", `${tag}: "${header}" toplanmaz`);
      const values = data.rows.map(row => moneyOf(row[index])).filter(value => value !== null);
      if (!values.length) return;
      assert.equal(moneyOf(cell), sumBy(values, value => value), `${tag}: TOPLAM "${header}" ${cell} ≠ satır toplamı`);
      stats.footer += 1;
    });
  }
  async function checkFiles(id, query, data, tag) {
    const pdf = await get(id, query, "pdf");
    assert.equal(pdf.status, 200, `${tag} PDF ${pdf.status}`);
    assert.equal(pdf.buffer.subarray(0, 5).toString("latin1"), "%PDF-", `${tag}: PDF imzası`);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    assert.ok(text.includes(data.title), `${tag} PDF: başlık`);
    assert.ok(text.includes(companyName), `${tag} PDF: şirket başlığı "${companyName}"`);
    for (const header of data.headers) assert.ok(text.includes(header), `${tag} PDF: kolon "${header}"`);
    for (const row of data.rows) for (const cell of row) if (moneyOf(cell) !== null) assert.ok(text.includes(String(cell).trim()), `${tag} PDF: "${cell}" yok`);
    if (data.footer) for (const cell of data.footer) if (moneyOf(cell) !== null) assert.ok(text.includes(cell), `${tag} PDF: TOPLAM "${cell}" yok`);
    for (const [key, value] of data.summary) assert.ok(text.includes(key) && text.includes(value), `${tag} PDF: özet "${key}: ${value}" yok`);
    const xlsx = await get(id, query, "xlsx");
    assert.equal(xlsx.status, 200, `${tag} Excel ${xlsx.status}`);
    const sheets = xlsxSheets(xlsx.buffer);
    const book = Object.values(sheets)[0];
    assert.match(String(book[0]?.[0]), /^\d{3} · /, `${tag} Excel: ilk satır şirket kodu ve unvanı`);
    const sheet = book.slice(Math.max(0, book.findIndex(row => row.length > 1)));
    assert.deepEqual(sheet[0], data.headers, `${tag} Excel: başlık satırı`);
    assert.equal(sheet.length, 1 + data.rows.length + (data.footer ? 1 : 0), `${tag} Excel: satır sayısı`);
    const same = (excel, screen, where) => {
      const expected = moneyOf(screen);
      if (expected === null) return;
      const actual = typeof excel === "number" ? Math.round(excel * 100) : moneyOf(excel);
      assert.equal(actual, expected, `${tag} Excel ${where}: ${excel} ≠ ${screen}`);
    };
    data.rows.forEach((row, r) => row.forEach((cell, c) => same(sheet[r + 1]?.[c], cell, `satır ${r + 1} "${data.headers[c]}"`)));
    if (data.footer) data.footer.forEach((cell, c) => same(sheet.at(-1)?.[c], cell, `TOPLAM "${data.headers[c]}"`));
    const ozet = Object.fromEntries((sheets["Özet"] || []).slice(1).filter(([key]) => key !== "Şirket").map(([key, val]) => [key, val]));
    for (const [key, val] of data.summary) {
      if (moneyOf(val) !== null) assert.equal(typeof ozet[key] === "number" ? Math.round(ozet[key] * 100) : moneyOf(ozet[key]), moneyOf(val), `${tag} Excel Özet "${key}"`);
    }
    stats.files += 2;
  }
  async function screen(id, query, tag) {
    const res = await get(id, query);
    assert.equal(res.status, 200, `${tag}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    stats.combos += 1;
    checkFooter(res.data, tag);
    return res.data;
  }

  it("katalog: Banka grubunda on yeni rapor, başlıkları ve süzgeçleri; anyAccount seçenekleri (bakiye dönmez)", async () => {
    const catalog = await must("katalog", api.get(RC));
    const bank = catalog.reports.filter(report => report.group === "Banka");
    for (const id of NEW_REPORTS) assert.ok(bank.some(report => report.id === id), `Banka grubunda ${id} yok (${bank.map(report => report.id).join(", ")})`);
    const byId = Object.fromEntries(bank.map(report => [report.id, report]));
    assert.deepEqual(NEW_REPORTS.map(id => byId[id].title), ["Günlük Banka Raporu", "Aylık Banka Raporu", "Banka Bazında Bakiye", "Para Birimi Bazında Bakiye", "Bankalar Arası Transfer Raporu", "Kasa ve Banka Transfer Raporu", "Cari ve Banka Hareketleri", "Fatura ve Banka Hareketleri", "Taksit ve Banka Hareketleri", "Banka Nakit Akış Raporu"]);
    assert.deepEqual(Object.fromEntries(NEW_REPORTS.map(id => [id, byId[id].params])), { "banka-gunluk": ["range", "bankAccount"], "banka-aylik": ["range", "bankAccount"], "banka-bazinda-bakiye": ["range"], "para-birimi-bazinda-bakiye": ["range"], "bankalar-arasi-transfer": ["range", "bankAccount"], "kasa-banka-transfer": ["range", "bankAccount"], "cari-banka-hareketleri": ["range", "anyAccount", "account"], "fatura-banka-hareketleri": ["range", "anyAccount"], "taksit-banka-hareketleri": ["range", "anyAccount"], "banka-nakit-akis": ["range"] });
    const pos = catalog.reports.find(report => report.id === "banka-pos-hareketleri");
    assert.deepEqual(pos.params, ["range", "payMethod", "anyAccount"], "Banka ve POS Hareketleri: Yol + Hesap süzgeci");
    assert.deepEqual(catalog.choices.anyAccount.map(([value]) => value), ["", acc.Z.id, acc.G.id, acc.K.id, acc.L.id, "unassigned"]);
    assert.equal(catalog.choices.anyAccount[0][1], "Tüm Hesaplar");
    assert.ok(!/\d,\d{2}/.test(JSON.stringify(catalog.choices)), "seçeneklerde bakiye (tutar) yok");
  });

  it("Günlük Banka Raporu: her hesap × her dönem — gün gün dış giriş/çıkış, transfer ayrı, Net = bakiye değişimi, Gün Sonu Bakiye yürür; devir dönem öncesi", async () => {
    for (const r of RANGES) {
      for (const [choice, keys] of BANK_CHOICES) {
        const query = { ...r.q, ...choiceQuery("bankAccount", choice) };
        const tag = `banka-gunluk ${choice || "Gerçek Banka"} ${r.label}`;
        const data = await screen("banka-gunluk", query, tag);
        const period = periodOf(keys, r);
        const days = [...new Set(period.map(row => row.d))].sort();
        assert.deepEqual(data.rows.map(row => row[0]), days.map(dayText), `${tag}: günler`);
        let balance = opening(keys, r);
        const totals = bucket(period);
        for (const day of days) {
          const row = data.rows[days.indexOf(day)];
          const b = bucket(period.filter(item => item.d === day));
          balance += netOf(b);
          assert.deepEqual([Number(row[col(data, "Hareket")]), cellOf(data, row, "Giriş"), cellOf(data, row, "Çıkış"), cellOf(data, row, "Transfer Giriş"), cellOf(data, row, "Transfer Çıkış"), cellOf(data, row, "Açılış ve Devir Düzeltmesi"), cellOf(data, row, "Net"), cellOf(data, row, "Gün Sonu Bakiye")], [b.count, b.extIn, b.extOut, b.trIn, b.trOut, b.adj, netOf(b), balance], `${tag}: ${dayText(day)} sayıları`);
        }
        assert.equal(summaryOf(data, "Devir"), opening(keys, r), `${tag}: Devir`);
        assert.equal(summaryOf(data, "Giriş"), totals.extIn, `${tag}: özet Giriş`);
        assert.equal(summaryOf(data, "Çıkış"), totals.extOut, `${tag}: özet Çıkış`);
        assert.equal(summaryOf(data, "Transfer Giriş"), totals.trIn, `${tag}: özet Transfer Giriş`);
        assert.equal(summaryOf(data, "Transfer Çıkış"), totals.trOut, `${tag}: özet Transfer Çıkış`);
        assert.equal(summaryOf(data, "Dönem Sonu"), balance, `${tag}: Dönem Sonu`);
        assert.equal(summaryOf(data, "Gün Sayısı"), String(days.length), `${tag}: Gün Sayısı`);
        assert.equal(summaryOf(data, "Hesap"), choiceTitle(choice, "Gerçek Banka (Tüm Hesaplar)"), `${tag}: Hesap`);
        if (data.footer) assert.equal(moneyOf(data.footer[col(data, "Net")]), balance - opening(keys, r), `${tag}: TOPLAM Net = dönem bakiye değişimi`);
        if (r.q.preset === undefined && r.from === "2026-01-01" && (choice === "" || choice === "Z")) await checkFiles("banka-gunluk", query, data, tag);
      }
    }
    // Bağımsız: 06.10 Gerçek Banka — ücret dış çıkış, ters kayıt dahil transfer iki yönde 1.000 + 1.000; 07.10 masraf ve kart borcu.
    const b06 = bucket(periodOf(REAL, { from: "2026-10-06", to: "2026-10-06" }));
    assert.deepEqual([b06.extIn, b06.extOut, b06.trIn, b06.trOut], [0, 525, 2_000_000 + 100_000 + 100_000, 2_000_000 + 100_000 + 100_000], "bağımsız 06.10");
    const b07 = bucket(periodOf(REAL, { from: "2026-10-07", to: "2026-10-07" }));
    assert.deepEqual([b07.extOut, b07.trOut], [1_050, 200_000], "bağımsız 07.10");
  });

  it("Aylık Banka Raporu: her hesap × her dönem — Ay Başı/Ay Sonu Bakiye, hareketsiz ay devirle; boş dönemde satır yok", async () => {
    const monthsBetween = (first, last) => {
      const out = [];
      let [y, m] = first.split("-").map(Number);
      while (`${y}-${String(m).padStart(2, "0")}` <= last) {
        out.push(`${y}-${String(m).padStart(2, "0")}`);
        m += 1;
        if (m > 12) {
          m = 1;
          y += 1;
        }
      }
      return out;
    };
    for (const r of RANGES) {
      for (const [choice, keys] of BANK_CHOICES) {
        const query = { ...r.q, ...choiceQuery("bankAccount", choice) };
        const tag = `banka-aylik ${choice || "Gerçek Banka"} ${r.label}`;
        const data = await screen("banka-aylik", query, tag);
        const period = periodOf(keys, r);
        const open = opening(keys, r);
        // Beklenen aylar: aralığın başından (Tüm Zamanlar: ilk hareketin ayından) bugünün ayına (aralık sonunu aşmaz); hareket ve devir yoksa hiç.
        const firstMove = period.map(row => row.d).sort()[0] || "";
        const first = r.from ? r.from.slice(0, 7) : firstMove.slice(0, 7) || TODAY.slice(0, 7);
        let last = TODAY.slice(0, 7);
        if (r.to && r.to.slice(0, 7) < last) last = r.to.slice(0, 7);
        const months = period.length || open ? (first <= last ? monthsBetween(first, last) : []) : [];
        assert.deepEqual(data.rows.map(row => row[0]), months.map(monthText), `${tag}: aylar`);
        let balance = open;
        for (const month of months) {
          const row = data.rows[months.indexOf(month)];
          const b = bucket(period.filter(item => item.d.slice(0, 7) === month));
          const start = balance;
          balance += netOf(b);
          assert.deepEqual([Number(row[col(data, "Hareket")]), cellOf(data, row, "Ay Başı Bakiye"), cellOf(data, row, "Giriş"), cellOf(data, row, "Çıkış"), cellOf(data, row, "Transfer Giriş"), cellOf(data, row, "Transfer Çıkış"), cellOf(data, row, "Açılış ve Devir Düzeltmesi"), cellOf(data, row, "Net"), cellOf(data, row, "Ay Sonu Bakiye")], [b.count, start, b.extIn, b.extOut, b.trIn, b.trOut, b.adj, netOf(b), balance], `${tag}: ${monthText(month)} sayıları`);
        }
        assert.equal(summaryOf(data, "Devir"), open, `${tag}: Devir`);
        assert.equal(summaryOf(data, "Dönem Sonu"), balance, `${tag}: Dönem Sonu`);
        assert.equal(summaryOf(data, "Ay Sayısı"), String(months.length), `${tag}: Ay Sayısı`);
        if (r.q.preset === undefined && r.from === "2026-01-01" && (choice === "" || choice === "K")) await checkFiles("banka-aylik", query, data, tag);
      }
    }
    // Ay sınırı (Nasıl Bozarım 1): Eylül'ün eski havalesi Hesabı Atanmamış'ta Eylül satırı, Ekim satırının Ay Başı Bakiyesi = Eylül Ay Sonu.
    const u = await screen("banka-aylik", { bankAccount: "unassigned" }, "aylık atanmamış");
    const eylul = u.rows.find(row => row[0] === "Eylül 2026");
    const ekim = u.rows.find(row => row[0] === "Ekim 2026");
    assert.ok(eylul && ekim, "Eylül ve Ekim satırları");
    assert.equal(cellOf(u, eylul, "Ay Sonu Bakiye"), 500_000);
    assert.equal(cellOf(u, ekim, "Ay Başı Bakiye"), 500_000, "Ekim Ay Başı = Eylül Ay Sonu");
    assert.equal(Number(ekim[col(u, "Hareket")]), 0, "Ekim'de hareketsiz, yine de satır");
  });

  it("Banka Bazında Bakiye ve Para Birimi Bazında Bakiye: her dönem — banka (hesapları birlikte) ve TL satırı; Gerçek Banka / Borç / Net; Hesabı Atanmamış özette", async () => {
    for (const r of RANGES) {
      const tag = `banka-bazinda ${r.label}`;
      const data = await screen("banka-bazinda-bakiye", r.q, tag);
      const banks = { "Garanti BBVA": { real: ["G"], debt: ["L"], count: 2 }, "Ziraat Bankası": { real: ["Z"], debt: ["K"], count: 2 } };
      assert.deepEqual(data.rows.map(row => row[0]), Object.keys(banks), `${tag}: banka satırları (hesap kartı her zaman satırdır)`);
      let real = 0;
      let debt = 0;
      for (const [name, spec] of Object.entries(banks)) {
        const row = data.rows.find(cells => cells[0] === name);
        const expectedReal = closing(spec.real, r);
        const expectedDebt = -closing(spec.debt, r) || 0;
        real += expectedReal;
        debt += expectedDebt;
        assert.deepEqual([Number(row[col(data, "Hesap")]), cellOf(data, row, K10.realBank), cellOf(data, row, K10.debt), cellOf(data, row, "Net")], [spec.count, expectedReal, expectedDebt, expectedReal - expectedDebt], `${tag}: ${name}`);
      }
      assert.equal(moneyOf(data.footer[col(data, K10.realBank)]), real, `${tag}: TOPLAM Gerçek Banka`);
      assert.equal(summaryOf(data, K10.realBank), real, `${tag}: özet Gerçek Banka`);
      assert.equal(summaryOf(data, K10.debt), debt, `${tag}: özet Kart ve Kredi Borcu`);
      assert.equal(summaryOf(data, "Net"), real - debt, `${tag}: özet Net`);
      const unassigned = closing(["U102"], r);
      const hit = data.summary.find(([key]) => key === K10.unassigned);
      if (unassigned) assert.equal(moneyOf(hit?.[1]), unassigned, `${tag}: Hesabı Atanmamış özette (satır değil)`);
      else assert.ok(!hit || moneyOf(hit[1]) === 0, `${tag}: Hesabı Atanmamış yok`);
      assert.ok(!data.rows.some(row => row[0].includes("Atanmamış")), `${tag}: Hesabı Atanmamış banka satırı değil`);
      // Para birimi: tek satır TL, aynı toplamlar; TOPLAM yazılır (tek para birimi, footerUniform).
      const cur = await screen("para-birimi-bazinda-bakiye", r.q, `para-birimi ${r.label}`);
      assert.deepEqual(cur.rows.map(row => row[0]), ["TL"], `para-birimi ${r.label}: satır`);
      assert.deepEqual([Number(cur.rows[0][col(cur, "Hesap")]), cellOf(cur, cur.rows[0], K10.realBank), cellOf(cur, cur.rows[0], K10.debt), cellOf(cur, cur.rows[0], "Net")], [4, real, debt, real - debt], `para-birimi ${r.label}: TL satırı`);
      assert.ok(cur.footer && moneyOf(cur.footer[col(cur, K10.realBank)]) === real, `para-birimi ${r.label}: TOPLAM (tek para birimi)`);
      assert.equal(summaryOf(cur, "Para Birimi"), "1");
      if (r.q.preset === undefined && r.from === "2026-01-01") {
        await checkFiles("banka-bazinda-bakiye", r.q, data, tag);
        await checkFiles("para-birimi-bazinda-bakiye", r.q, cur, `para-birimi ${r.label}`);
      }
    }
    // Bağımsız: bugün Ziraat 100.000 + 20.000 + 2.000 − 10.000 − 20.005,25 + 1.000 − 1.000 − 10,50 − 2.000 = 89.984,25; Garanti 50.000 − 3.000 + 5.000 + 2.000 + 20.000 − 1.000 + 1.000 + 1.500 = 75.500; kart borcu 3.000.
    assert.equal(closing(["Z"]), 8_998_425);
    assert.equal(closing(["G"]), 7_550_000);
    assert.equal(-closing(["K"]), 300_000);
  });

  it("Bankalar Arası Transfer Raporu: her hesap × her dönem — ücretli transfer, ters kaydedilen asıl + eksi Ters Kayıt; TOPLAM net; kanal ve durum", async () => {
    // Bağımsız: 06.10 Z→G 20.000 ücret 5,25 (Gerçekleşti, EFT); G→Z 1.000 (Ters Kaydedildi); Ters Kayıt −1.000.
    const EXPECTED = [
      { d: "2026-10-06", from: "Z", to: "G", amount: 2_000_000, fee: 525, channel: "EFT", state: "Gerçekleşti" },
      { d: "2026-10-06", from: "G", to: "Z", amount: 100_000, fee: 0, channel: "", state: "Ters Kaydedildi" },
      { d: "2026-10-06", from: "G", to: "Z", amount: -100_000, fee: 0, channel: "", state: /^Ters Kayıt · / },
    ];
    for (const r of RANGES) {
      for (const [choice, keys] of BANK_CHOICES) {
        const query = { ...r.q, ...choiceQuery("bankAccount", choice) };
        const tag = `bankalar-arasi ${choice || "Gerçek Banka"} ${r.label}`;
        const data = await screen("bankalar-arasi-transfer", query, tag);
        const expected = EXPECTED.filter(item => inRange(item.d, r) && (choice === "unassigned" ? false : choice ? item.from === choice || item.to === choice : true));
        assert.equal(data.rows.length, expected.length, `${tag}: satır sayısı (${data.rows.map(row => row.join(" | ")).join("\n")})`);
        expected.forEach((item, index) => {
          const row = data.rows[index];
          assert.equal(row[col(data, "Gönderen Hesap")], label[item.from], `${tag}: gönderen`);
          assert.equal(row[col(data, "Alıcı Hesap")], label[item.to], `${tag}: alıcı`);
          assert.deepEqual([cellOf(data, row, "Tutar"), cellOf(data, row, "Ücret"), cellOf(data, row, "Gönderenden Çıkan")], [item.amount, item.fee, item.amount + item.fee], `${tag}: tutarlar`);
          assert.equal(row[col(data, "Kanal")], item.channel, `${tag}: kanal`);
          if (item.state instanceof RegExp) assert.match(row[col(data, "Durum")], item.state, `${tag}: durum`);
          else assert.equal(row[col(data, "Durum")], item.state, `${tag}: durum`);
          assert.ok(row[col(data, "İşlem No")], `${tag}: İşlem No`);
        });
        assert.equal(summaryOf(data, "Tutar (Net)"), sumBy(expected, item => item.amount), `${tag}: Tutar (Net)`);
        assert.equal(summaryOf(data, "Ücret (Net)"), sumBy(expected, item => item.fee), `${tag}: Ücret (Net)`);
        assert.equal(summaryOf(data, "Transfer"), String(expected.filter(item => item.amount > 0).length), `${tag}: Transfer sayısı`);
        if (expected.length && data.footer) assert.equal(moneyOf(data.footer[col(data, "Tutar")]), sumBy(expected, item => item.amount), `${tag}: TOPLAM Tutar net`);
        if (r.q.preset === undefined && r.from === "2026-01-01" && choice === "") await checkFiles("bankalar-arasi-transfer", query, data, tag);
        assert.ok(keys, tag);
      }
    }
  });

  it("Kasa ve Banka Transfer Raporu: her hesap × her dönem — iki yön ayrı kolon, Net (Bankaya); hesabı atanmamış süzgeci boş", async () => {
    const EXPECTED = [
      { d: "2026-10-05", acc: "Z", toBank: false, amount: 1_000_000 },
      { d: "2026-10-05", acc: "G", toBank: true, amount: 200_000 },
    ];
    for (const r of RANGES) {
      for (const [choice] of BANK_CHOICES) {
        const query = { ...r.q, ...choiceQuery("bankAccount", choice) };
        const tag = `kasa-banka ${choice || "Gerçek Banka"} ${r.label}`;
        const data = await screen("kasa-banka-transfer", query, tag);
        const expected = EXPECTED.filter(item => inRange(item.d, r) && (choice === "unassigned" ? false : choice ? item.acc === choice : true));
        assert.equal(data.rows.length, expected.length, `${tag}: satır sayısı`);
        for (const item of expected) {
          const row = data.rows.find(cells => cells[col(data, "Banka Hesabı")] === `${label[item.acc]} (${acc[item.acc].glSub})`);
          assert.ok(row, `${tag}: ${item.acc} satırı yok`);
          assert.equal(row[col(data, "Yön")], item.toBank ? "Kasadan Bankaya Yatır" : "Bankadan Kasaya Aktar", `${tag}: yön`);
          assert.deepEqual([cellOf(data, row, "Kasadan Bankaya"), cellOf(data, row, "Bankadan Kasaya")], [item.toBank ? item.amount : 0, item.toBank ? 0 : item.amount], `${tag}: tutar`);
          assert.ok(row[col(data, "İşlem No")], `${tag}: İşlem No`);
          assert.ok(row[col(data, "Giren")], `${tag}: giren dolu`);
        }
        const toBank = sumBy(expected.filter(item => item.toBank), item => item.amount);
        const toCash = sumBy(expected.filter(item => !item.toBank), item => item.amount);
        assert.equal(summaryOf(data, "Kasadan Bankaya"), toBank, `${tag}: özet`);
        assert.equal(summaryOf(data, "Bankadan Kasaya"), toCash, `${tag}: özet`);
        assert.equal(summaryOf(data, "Net (Bankaya)"), toBank - toCash, `${tag}: Net`);
        if (r.q.preset === undefined && r.from === "2026-01-01" && choice === "") await checkFiles("kasa-banka-transfer", query, data, tag);
      }
    }
  });

  it("Cari ve Banka Hareketleri: her hesap × cari × dönem — yalnız carili satırlar (cari, fatura peşini, taksit, eski havale); masraf, transfer, kart borcu girmez", async () => {
    for (const r of RANGES) {
      for (const [choice, keys] of ANY_CHOICES) {
        for (const who of ["", "ABC", "XYZ"]) {
          const query = { ...r.q, ...choiceQuery("anyAccount", choice), ...(who ? { account: party[who].id } : {}) };
          const tag = `cari-banka ${choice || "tümü"} ${who || "tüm cariler"} ${r.label}`;
          const data = await screen("cari-banka-hareketleri", query, tag);
          const expected = periodOf(keys, r).filter(row => row.party && (!who || row.party === who));
          assert.equal(data.rows.length, expected.length, `${tag}: satır sayısı (${data.rows.map(row => row.join(" | ")).join("\n")})`);
          expected.forEach((item, index) => {
            const row = data.rows[index];
            assert.equal(row[0], dayText(item.d), `${tag}: tarih sırası`);
            assert.equal(row[col(data, "Cari")], party[item.party].name, `${tag}: cari`);
            assert.deepEqual([cellOf(data, row, "Giriş"), cellOf(data, row, "Çıkış")], [Math.max(item.signed, 0), Math.max(-item.signed, 0)], `${tag}: tutar`);
            assert.equal(row[col(data, "Yol")], "Havale / EFT", `${tag}: yol`);
            assert.equal(row[col(data, "Hesap")], item.acc === "U102" ? `${K10.unassigned} · Havale / EFT (102.00)` : `${label[item.acc]} (${acc[item.acc].glSub})`, `${tag}: hesap`);
            assert.equal(row[col(data, "Kaynak")], { cari: "Cari", fatura: "Fatura", taksit: "Taksit" }[item.src], `${tag}: kaynak`);
          });
          assert.equal(summaryOf(data, "Giriş"), sumBy(expected, item => item.extIn), `${tag}: özet Giriş`);
          assert.equal(summaryOf(data, "Çıkış"), sumBy(expected, item => item.extOut), `${tag}: özet Çıkış`);
          assert.equal(summaryOf(data, "Cari"), String(new Set(expected.map(item => item.party)).size), `${tag}: cari sayısı`);
          if (r.q.preset === undefined && r.from === "2026-01-01" && choice === "" && who === "") await checkFiles("cari-banka-hareketleri", query, data, tag);
        }
      }
    }
    expectStatus(await api.get(`${RC}/cari-banka-hareketleri?preset=all&account=yok-boyle-cari`), 404, "account-missing", "olmayan cari");
    // Bağımsız: carili dış satırlar 5 giriş (5.000 + 20.000 + 5.000 + 2.000 + 1.500) ve 1 çıkış (3.000).
    const all = E.filter(row => row.party);
    assert.equal(all.length, 6);
    assert.equal(sumBy(all, row => row.extIn), 3_350_000);
  });

  it("Fatura ve Banka Hareketleri: bağ türü Peşin / Kapatılacak Fatura / Otomatik (En Eski); fatura no; taksit ve masraf girmez; özet bağ türüne göre", async () => {
    const LINKS = ["Peşin", "Kapatılacak Fatura", "Otomatik (En Eski)", "Komisyon Kesintisi (Bağlı)"];
    for (const r of RANGES) {
      for (const [choice, keys] of ANY_CHOICES) {
        const query = { ...r.q, ...choiceQuery("anyAccount", choice) };
        const tag = `fatura-banka ${choice || "tümü"} ${r.label}`;
        const data = await screen("fatura-banka-hareketleri", query, tag);
        const expected = periodOf(keys, r).filter(row => row.link);
        assert.equal(data.rows.length, expected.length, `${tag}: satır sayısı (${data.rows.map(row => row.join(" | ")).join("\n")})`);
        expected.forEach((item, index) => {
          const row = data.rows[index];
          assert.equal(row[col(data, "Bağ Türü")], item.link, `${tag}: bağ türü (${row.join(" | ")})`);
          assert.equal(row[col(data, "Fatura No")], item.invoiceNo, `${tag}: fatura no`);
          assert.equal(row[col(data, "Cari")], party[item.party].name, `${tag}: cari`);
          assert.deepEqual([cellOf(data, row, "Giriş"), cellOf(data, row, "Çıkış")], [Math.max(item.signed, 0), Math.max(-item.signed, 0)], `${tag}: tutar`);
        });
        for (const link of LINKS) assert.equal(summaryOf(data, link), sumBy(expected.filter(item => item.link === link), item => item.signed), `${tag}: özet ${link}`);
        assert.equal(summaryOf(data, "Giriş"), sumBy(expected, item => item.extIn), `${tag}: Giriş`);
        assert.equal(summaryOf(data, "Çıkış"), sumBy(expected, item => item.extOut), `${tag}: Çıkış`);
        if (r.q.preset === undefined && r.from === "2026-01-01" && choice === "") await checkFiles("fatura-banka-hareketleri", query, data, tag);
      }
    }
    // Bağımsız: Peşin 5.000, Kapatılacak −3.000, Otomatik 5.000 + 20.000 + 1.500.
    assert.equal(sumBy(E.filter(row => row.link === "Otomatik (En Eski)"), row => row.signed), 2_650_000);
  });

  it("Taksit ve Banka Hareketleri: her hesap × her dönem — yalnız taksit kartı tahsilatı; kart adı ve cari", async () => {
    for (const r of RANGES) {
      for (const [choice, keys] of ANY_CHOICES) {
        const query = { ...r.q, ...choiceQuery("anyAccount", choice) };
        const tag = `taksit-banka ${choice || "tümü"} ${r.label}`;
        const data = await screen("taksit-banka-hareketleri", query, tag);
        const expected = periodOf(keys, r).filter(row => row.src === "taksit");
        assert.equal(data.rows.length, expected.length, `${tag}: satır sayısı`);
        for (const [index, item] of expected.entries()) {
          const row = data.rows[index];
          assert.equal(row[col(data, "Taksit Kartı")], item.planName, `${tag}: kart`);
          assert.equal(row[col(data, "Cari")], party[item.party].name, `${tag}: cari`);
          assert.equal(cellOf(data, row, "Giriş"), item.signed, `${tag}: tutar`);
        }
        assert.equal(summaryOf(data, "Giriş"), sumBy(expected, item => item.extIn), `${tag}: özet`);
        assert.equal(summaryOf(data, "Taksit Kartı"), String(new Set(expected.map(item => item.planName)).size), `${tag}: kart sayısı`);
        if (r.q.preset === undefined && r.from === "2026-01-01" && choice === "") await checkFiles("taksit-banka-hareketleri", query, data, tag);
      }
    }
  });

  it("Banka Nakit Akış Raporu: başlangıç Gerçek Banka (Hesabı Atanmamış girmez); planlı masraf/gelir, kart borcu son ödeme günü, tahsildeki çek; Planlanan Transfer ayrı kolon (bakiye değişmez); gecikmiş planlı girmez, özette", async () => {
    const start = realBankToday();
    const future = PLANNED.filter(item => !item.overdue).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.out ? 0 : a.transfer ? 1 : 2) - (b.out ? 0 : b.transfer ? 1 : 2)));
    const CASES = [
      { label: "Bütün beklenenler", q: { preset: "all" }, from: TODAY, to: "" },
      { label: "15.10–20.10", q: { from: "2026-10-15", to: "2026-10-20" }, from: "2026-10-15", to: "2026-10-20" },
      { label: "boş (Kasım)", q: { from: "2026-11-01", to: "2026-11-30" }, from: "2026-11-01", to: "2026-11-30" },
      { label: "bugünden 25.10'a", q: { from: TODAY, to: "2026-10-25" }, from: TODAY, to: "2026-10-25" },
    ];
    for (const c of CASES) {
      const data = await screen("banka-nakit-akis", c.q, `nakit-akis ${c.label}`);
      const carried = future.filter(item => item.date < c.from);
      const openingValue = start + sumBy(carried, item => item.in) - sumBy(carried, item => item.out);
      const expected = future.filter(item => item.date >= c.from && (!c.to || item.date <= c.to));
      assert.equal(data.rows[0][1], "Başlangıç", `${c.label}: ilk satır başlangıç`);
      assert.equal(cellOf(data, data.rows[0], "Beklenen Gerçek Banka"), openingValue, `${c.label}: başlangıç = Gerçek Banka + başlangıca kadar beklenenler`);
      const body = data.rows.slice(1);
      assert.equal(body.length, expected.length, `${c.label}: satır sayısı (${body.map(row => row.join(" | ")).join("\n")})`);
      let balance = openingValue;
      expected.forEach((item, index) => {
        const row = body[index];
        balance += item.in - item.out;
        assert.equal(row[0], dayText(item.date), `${c.label}: tarih`);
        assert.equal(row[col(data, "Kaynak")], item.source, `${c.label}: kaynak (${row.join(" | ")})`);
        assert.equal(row[col(data, "Hesap")], item.account, `${c.label}: hesap`);
        assert.deepEqual([cellOf(data, row, "Giriş"), cellOf(data, row, "Çıkış"), cellOf(data, row, "Planlanan Transfer"), cellOf(data, row, "Beklenen Gerçek Banka")], [item.in, item.out, item.transfer, balance], `${c.label}: ${item.source} sayıları`);
      });
      assert.equal(summaryOf(data, `Bugünkü ${K10.realBank}`), start, `${c.label}: Bugünkü Gerçek Banka`);
      assert.equal(summaryOf(data, K10.unassigned), 500_000, `${c.label}: Hesabı Atanmamış ayrı (başlangıca girmez)`);
      assert.equal(summaryOf(data, "Başlangıç"), openingValue);
      assert.equal(summaryOf(data, "Beklenen Giriş"), sumBy(expected, item => item.in));
      assert.equal(summaryOf(data, "Beklenen Çıkış"), sumBy(expected, item => item.out));
      assert.equal(summaryOf(data, "Planlanan Transferler"), sumBy(expected, item => item.transfer));
      assert.equal(summaryOf(data, `Dönem Sonu Tahmini ${K10.realBank}`), balance, `${c.label}: dönem sonu`);
      assert.match(String(summaryOf(data, "Tarihi Geçmiş Bekleyen Kalem")), /^1 · -100,00 TL$/, `${c.label}: gecikmiş planlı özette`);
      if (data.footer) {
        assert.equal(moneyOf(data.footer[col(data, "Planlanan Transfer")]), sumBy(expected, item => item.transfer), `${c.label}: TOPLAM Planlanan Transfer`);
        assert.equal(data.footer[col(data, "Beklenen Gerçek Banka")], "", `${c.label}: yürüyen bakiye toplanmaz`);
      }
      if (c.q.preset === "all") await checkFiles("banka-nakit-akis", c.q, data, c.label);
    }
    // Bağımsız: bütün beklenenler = başlangıç − 200 − 3.000 + 1.000 + 4.000; planlı transfer 5.000 bakiyeye girmez.
    const all = await screen("banka-nakit-akis", { preset: "all" }, "bağımsız");
    assert.equal(summaryOf(all, `Dönem Sonu Tahmini ${K10.realBank}`), start - 20_000 - 300_000 + 100_000 + 400_000);
    assert.equal(start, 8_998_425 + 7_550_000, "bağımsız başlangıç: Ziraat + Garanti");
  });

  it("Banka ve POS Hareketleri: Yol Kredi Kartı (309) ve Kredi (300) + Hesap süzgeci — her seçenek satırları değiştirir; eski üç seçim aynen; tanınmayan hesap 404", async () => {
    const r = RANGES[0];
    // Kredi Kartı: kartın satırları (açılış borcu düzeltme, kart borcu ödemesi transfer girişi); Dönem Sonu −3.000.
    const card = await screen("banka-pos-hareketleri", { payMethod: "ccard" }, "yol kredi kartı");
    const kRows = card.rows.filter(row => row[2] !== "Devir");
    assert.equal(kRows.length, 2, `kart satırları: ${card.rows.map(row => row.join(" | ")).join("\n")}`);
    assert.ok(kRows.every(row => row[col(card, "Yol")] === "Kredi Kartı"), "Yol kolonu Kredi Kartı (Kurumsal yok)");
    assert.equal(summaryOf(card, "Dönem Sonu"), closing(["K"], r), "Kredi Kartı dönem sonu = kart bakiyesi (borç eksi)");
    assert.equal(summaryOf(card, "Transfer Giriş"), 200_000, "kart borcu ödemesi Transfer Giriş");
    assert.equal(summaryOf(card, "Dönem Giriş"), 0, "kartta dış giriş yok");
    assert.equal(summaryOf(card, "Hesap"), "Tüm Hesaplar");
    await checkFiles("banka-pos-hareketleri", { payMethod: "ccard" }, card, "yol kredi kartı");
    // Kredi: kredi hesabı hareketsiz → yalnız Devir, Dönem Sonu 0.
    const loan = await screen("banka-pos-hareketleri", { payMethod: "loan" }, "yol kredi");
    assert.equal(loan.rows.filter(row => row[2] !== "Devir").length, 0, "kredi hareketi yok");
    assert.equal(summaryOf(loan, "Dönem Sonu"), 0);
    // Hesap süzgeci: Ziraat (havale + POS yolunda yalnız Ziraat satırları); Garanti; Hesabı Atanmamış; kart hesabı seçilince kart satırları.
    for (const [choice, keys] of [["Z", ["Z"]], ["G", ["G"]], ["unassigned", ["U102"]], ["K", ["K"]]]) {
      const data = await screen("banka-pos-hareketleri", { ...choiceQuery("anyAccount", choice) }, `hesap ${choice}`);
      const body = data.rows.filter(row => row[2] !== "Devir");
      const expected = periodOf(keys, r);
      assert.equal(body.length, expected.length, `hesap ${choice}: satır sayısı (${body.map(row => row.join(" | ")).join("\n")})`);
      const b = bucket(expected);
      assert.equal(summaryOf(data, "Dönem Giriş"), b.extIn, `hesap ${choice}: Dönem Giriş`);
      assert.equal(summaryOf(data, "Dönem Çıkış"), b.extOut, `hesap ${choice}: Dönem Çıkış`);
      assert.equal(summaryOf(data, "Dönem Sonu"), closing(keys, r), `hesap ${choice}: Dönem Sonu`);
      assert.equal(summaryOf(data, "Hesap"), choiceTitle(choice, "Tüm Hesaplar"), `hesap ${choice}: başlık`);
      if (b.trIn || b.trOut) {
        assert.equal(summaryOf(data, "Transfer Giriş"), b.trIn, `hesap ${choice}: Transfer Giriş`);
        assert.equal(summaryOf(data, "Transfer Çıkış"), b.trOut, `hesap ${choice}: Transfer Çıkış`);
      }
      if (data.footer) {
        assert.equal(moneyOf(data.footer[col(data, "Giriş")]), b.extIn, `hesap ${choice}: TOPLAM Giriş`);
        assert.equal(data.footer[col(data, "Bakiye")], "", `hesap ${choice}: Bakiye toplanmaz`);
      }
      if (choice === "Z") await checkFiles("banka-pos-hareketleri", choiceQuery("anyAccount", choice), data, "hesap Z");
    }
    // Hesap + Yol birlikte: Ziraat + Kredi Kartı → kart hesabı Ziraat değil, satır yok; kart + Kredi Kartı → kart satırları.
    const mixed = await screen("banka-pos-hareketleri", { payMethod: "ccard", anyAccount: acc.Z.id }, "Ziraat + Kredi Kartı");
    assert.equal(mixed.rows.filter(row => row[2] !== "Devir").length, 0);
    const kk = await screen("banka-pos-hareketleri", { payMethod: "ccard", anyAccount: acc.K.id }, "kart + Kredi Kartı");
    assert.equal(kk.rows.filter(row => row[2] !== "Devir").length, 2);
    // Eski üç seçim ve "Tüm Hesaplar": önceki yol (cash.report) — Dönem Giriş = bütün dış banka girişleri (eski havale dahil), Çıkış 15,75.
    const noncash = await screen("banka-pos-hareketleri", {}, "tümü");
    const allLines = periodOf([...REAL, "U102"], r);
    assert.equal(summaryOf(noncash, "Dönem Giriş"), sumBy(allLines, row => row.extIn), "Banka ve POS (Tümü): Dönem Giriş");
    assert.equal(summaryOf(noncash, "Dönem Çıkış"), sumBy(allLines, row => row.extOut), "Banka ve POS (Tümü): Dönem Çıkış");
    assert.equal(summaryOf(noncash, "Dönem Sonu"), closing([...REAL, "U102"], r), "Banka ve POS (Tümü): Dönem Sonu (kart ve kredi girmez)");
    const bank = await screen("banka-pos-hareketleri", { payMethod: "bank" }, "havale");
    assert.equal(summaryOf(bank, "Dönem Giriş"), sumBy(allLines, row => row.extIn));
    expectStatus(await api.get(`${RC}/banka-pos-hareketleri?anyAccount=yok-boyle-hesap`), 404, "bank-account-missing", "tanınmayan hesap");
    expectStatus(await api.get(`${RC}/banka-gunluk?bankAccount=yok-boyle-hesap`), 404, "bank-account-missing", "tanınmayan hesap (günlük)");
  });

  it("Nakit Akış, Vade Takip ve Zil: planlı banka işlemleri ve kart borcu son ödeme günü kalemleri; planlı transfer genel Nakit Akış'a girmez (toplam 0), Vade Takip'te tutarsız", async () => {
    const flow = await must("nakit akış", api.get("/api/workspace/overview/nakit-akisi?preset=next90&table=0"));
    const bankRows = flow.rows.filter(row => row.source === "bank");
    const expected = PLANNED.filter(item => !item.overdue && !item.internal && (item.bank || item.cardDue));
    assert.deepEqual(bankRows.map(row => [row.date, row.direction, Math.round(row.amount * 100)]).sort(), expected.map(item => [item.date, item.out ? "out" : "in", item.out || item.in]).sort(), `Nakit Akış planlı banka kalemleri: ${JSON.stringify(bankRows.map(row => [row.date, row.label, row.amount]))}`);
    assert.ok(!flow.rows.some(row => /Maaş havuzu|Planlı transfer/i.test(row.label)), "planlı transfer genel Nakit Akış'ta yok");
    assert.ok(flow.rows.some(row => row.source === "cheque" && row.flow === "deposit" && row.date === "2026-10-27" && row.amount === 4000), "tahsildeki çek 27.10");
    assert.equal(flow.overdue?.length ?? flow.overdueRows?.length ?? 0, flow.overdue?.length ?? 0);
    // Vade Takip: bank kaynağı listede ve izinli; planlı transfer yönsüz (tutar toplama girmez); gecikmiş planlı "overdue".
    const vade = await must("vade takip", api.get("/api/workspace/overview/vade-takip?preset=open&sources=bank"));
    assert.ok(vade.allowed.includes("bank") && vade.sources.includes("bank"), `kaynaklar: ${vade.allowed.join(",")}`);
    const items = vade.rows.map(row => [row.date, row.direction, row.amount === null ? null : Math.round(row.amount * 100), row.state]);
    assert.deepEqual(items.sort(), [["2026-10-01", "out", 10_000, "overdue"], ["2026-10-15", "out", 20_000, "upcoming"], ["2026-10-20", "", 500_000, "upcoming"], ["2026-10-25", "in", 100_000, "upcoming"]].sort(), `Vade Takip bank: ${JSON.stringify(vade.rows.map(row => [row.date, row.direction, row.amount, row.label]))}`);
    assert.equal(Math.round(vade.totals.out.total.amount * 100), 30_000, "ödenecek toplam: gecikmiş 100 + masraf 200 (transfer girmez)");
    assert.equal(Math.round(vade.totals.in.total.amount * 100), 100_000, "tahsil edilecek: 1.000 (transfer girmez)");
    const transfer = vade.rows.find(row => row.direction === "");
    assert.match(transfer.label, /5\.000,00 TL · Ziraat Bankası · Ana TL Hesabı → Garanti BBVA · Ana TL Hesabı/, "planlı transfer adında tutar ve iki hesap");
    const dues = await must("zil", api.get("/api/workspace/dues"));
    const bankDues = dues.items.filter(item => item.source === "bank").map(item => [item.dueDate, item.state, Math.round(item.amount * 100)]);
    assert.deepEqual(bankDues.sort(), [["2026-10-01", "overdue", 10_000], ["2026-10-15", "upcoming", 20_000]], `zil: ${JSON.stringify(bankDues)}`);
    // Yetki: personel zilde ve Vade Takip'te banka kalemi görmez.
    const personel = apiOf(await createUser(ctx.server, api.client, { username: "r230-personel", role: "personel" }));
    const personelDues = await must("personel zil", personel.get("/api/workspace/dues"));
    assert.ok(!personelDues.items.some(item => item.source === "bank"), "personel zilde planlı banka işlemi görmez");
    // Planlı işlem gerçekleşince zil ve Nakit Akış'tan düşer (önbellek anahtarı planları da izler).
    const plans = await must("planlar", api.get(`${BANK}/plans`));
    const overdue = (plans.plans || plans).find(item => item.description === "Aidat");
    await must("gerçekleştir", api.post(`${BANK}/plans/${overdue.id}/execute`, { date: TODAY }));
    ext(TODAY, "Z", -10_000, { src: "masraf" });
    const after = await must("zil", api.get("/api/workspace/dues"));
    assert.deepEqual(after.items.filter(item => item.source === "bank").map(item => item.dueDate), ["2026-10-15"], "gerçekleşen planlı zilden düştü");
    const report = await screen("banka-nakit-akis", { preset: "all" }, "gerçekleşen sonrası");
    assert.ok(!report.summary.some(([key]) => key === "Tarihi Geçmiş Bekleyen Kalem"), "gecikmiş kalem kalmadı");
    assert.equal(summaryOf(report, `Bugünkü ${K10.realBank}`), realBankToday(), "başlangıç 100 düştü");
    await integrityOk(api, "planlı gerçekleşti");
  });

  it("yetki: personel 403 (ekran, PDF, Excel; dosya sızmaz); muhasebe yeni raporları görür; Finans Raporları rolü görmez", async () => {
    const personel = apiOf(await createUser(ctx.server, api.client, { username: "r230-personel-2", role: "personel" }));
    for (const id of NEW_REPORTS) {
      for (const format of ["", "pdf", "xlsx"]) {
        const res = await personel.raw("GET", `${RC}/${id}${format ? `/${format}` : ""}?preset=all`);
        assert.equal(res.status, 403, `personel ${id} ${format}`);
        assert.ok(!res.buffer.toString("latin1").startsWith("%PDF") && res.buffer.subarray(0, 2).toString("latin1") !== "PK", `personel ${id} ${format}: dosya sızdı`);
      }
    }
    const accountant = apiOf(await createUser(ctx.server, api.client, { username: "r230-muhasebe", role: "muhasebe" }));
    const catalog = await must("muhasebe katalog", accountant.get(RC));
    for (const id of NEW_REPORTS) {
      assert.ok(catalog.reports.some(report => report.id === id), `muhasebe ${id} listede`);
      assert.equal((await accountant.get(`${RC}/${id}?preset=all`)).status, 200, `muhasebe ${id}`);
    }
    const role = await must("rol", api.post("/api/admin/roles", { name: "Finans Okuyucu 230", permissions: ["overview.view", "accounts.view"] }));
    const reader = apiOf(await createUser(ctx.server, api.client, { username: "r230-finans", role: role.id }));
    const list = await must("finans katalog", reader.get(RC));
    assert.ok(!list.reports.some(report => report.group === "Banka"), "Finans Raporları rolü Banka grubunu görmez");
    for (const id of NEW_REPORTS) assert.equal((await reader.get(`${RC}/${id}`)).status, 403, `finans ${id}`);
    // Finans Raporları olan: Banka ve POS Hareketleri'nde Hesap süzgeci kullanabilir (Kasa grubu), ama 001'in hesabı adıyla değil kimliğiyle.
    assert.equal((await reader.get(`${RC}/banka-pos-hareketleri?payMethod=ccard`)).status, 200, "finans: Banka ve POS Hareketleri Kredi Kartı yolu");
  });

  it("iki şirket: 002 boş — yeni raporlar boş (500 yok), Banka Nakit Akış 'Banka Hesabı Tanımlanmadı'; ?hofCompany= ile 001'in hesabı 404; ileri tarihli hareket 400", async () => {
    const second = await must("002", api.post("/api/companies", { name: "Boş Şirket", select: false }));
    const id = second.id || second.company?.id;
    const q = `hofCompany=${encodeURIComponent(id)}`;
    for (const report of NEW_REPORTS) {
      const res = await api.get(`${RC}/${report}?preset=all&${q}`);
      assert.equal(res.status, 200, `002 ${report}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
      assert.equal(res.data.rows.filter(row => !row.includes("Başlangıç")).length, 0, `002 ${report} boş (${JSON.stringify(res.data.rows)})`);
    }
    const flow = await must("002 nakit akış", api.get(`${RC}/banka-nakit-akis?preset=all&${q}`));
    assert.equal(summaryOf(flow, `Bugünkü ${K10.realBank}`), "Banka Hesabı Tanımlanmadı");
    for (const [report, param] of [["banka-gunluk", "bankAccount"], ["banka-aylik", "bankAccount"], ["bankalar-arasi-transfer", "bankAccount"], ["kasa-banka-transfer", "bankAccount"], ["cari-banka-hareketleri", "anyAccount"], ["fatura-banka-hareketleri", "anyAccount"], ["taksit-banka-hareketleri", "anyAccount"], ["banka-pos-hareketleri", "anyAccount"]]) {
      expectStatus(await api.get(`${RC}/${report}?preset=all&${param}=${acc.Z.id}&${q}`), 404, "bank-account-missing", `002'den 001'in hesabı (${report})`);
    }
    const catalog = await must("002 katalog", api.get(`${RC}?${q}`));
    assert.deepEqual(catalog.choices.anyAccount.map(([value]) => value), ["", "unassigned"], "002'de 001'in hesapları seçenek değil");
    // İleri tarihli banka hareketi 400; raporlar değişmez.
    const before = await screen("banka-gunluk", { preset: "all" }, "ileri tarih öncesi");
    expectStatus(await api.post(`/api/workspace/accounts/${party.ABC.id}/entries`, { kind: "in", amount: "999", method: "bank", bankAccountId: acc.Z.id, date: "2026-10-09" }), 400, "", "ileri tarihli havale");
    expectStatus(await api.post(`${BANK}/transfers`, { accountId: acc.Z.id, toAccountId: acc.G.id, amount: "1", date: "2026-10-09" }), 400, "", "ileri tarihli transfer");
    const afterAll = await screen("banka-gunluk", { preset: "all" }, "ileri tarih sonrası");
    assert.deepEqual(afterAll.rows, before.rows, "rapor değişmedi");
    // 001 değişmedi.
    assert.equal(summaryOf(await screen("banka-bazinda-bakiye", {}, "001"), K10.realBank), realBankToday());
    assert.ok(stats.combos > 300 && stats.footer > 100 && stats.files > 20, `denenen bileşim ${stats.combos}, TOPLAM denetimi ${stats.footer}, dosya ${stats.files}`);
  });
});
