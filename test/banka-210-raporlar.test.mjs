// 2.1.0 Aşama 14 (daraltılmış) — Banka Raporları ve K10 (docs/BANKA-MODULU-PLAN.md K5, K10, §3.4, §8.4, §8.9, §8.10, §12.3 Aşama 14, §12.4).
//
// Rapor Merkezi'nin Banka grubu: Banka Bakiye Raporu, Banka Hareket Raporu, Banka Masraf Raporu (transfer ücreti dahil, 770), Alt Hesap Mizanı;
// ANLIK DURUM'un Banka kutusu (K10: Gerçek Banka; Kart ve Kredi Borcu ve Hesabı Atanmamış ayrı, varlık toplamına girmez); Banka ve POS Hareketleri'nde
// iç hareket (Kasa ↔ Banka, bankalar arası transfer, kredi, kart borcu) Dönem Giriş/Çıkış'ı şişirmez; Birleşik Rapor'un banka sütunları (ANLIK DURUM'la
// aynı adlar).
//
// Veri API'den, gerçek iş akışıyla girilir (iki banka hesabı + kurumsal kart + kredi; eski sürüm gibi hesapsız havale ve POS; cari tahsilat/ödeme,
// fatura peşini, taksit tahsilatı, stok peşini, çek tahsili havaleyle ve hesaba bağlı; Kasa ↔ Banka iki yön; bankalar arası transfer ücretli ve
// ücretsiz; masraf BSMV Dahil / Hariç ve KDV'li; faiz + stopaj; kart borcu; kredi kullanımı / geri ödemesi (faizli); iki ters kayıt). Beklenen
// sayılar programın kodu çağrılmadan testin kendi defterinden (E) düz toplamlarla hesaplanır; her rapor × her süzgeç seçeneği × her dönem için
// ekran JSON'u, PDF metni ve Excel hücreleri karşılaştırılır; TOPLAM = satırlar.
//
// NASIL BOZARIM (önce yazıldı; testler buradan):
//   R1  Süzgeç parametresi rapora ulaşmıyor (2.0.23 Bulgu 4: queryOf izin listesi) → her süzgeç seçeneği satırları gerçekten değiştirir (bankAccount,
//       bankMove, bankGroup, feeAccount); PDF ve Excel aynı süzgeçle aynı satırlar.
//   R2  Transferin iki bacağı Giriş/Çıkış'ı şişirir (Aşama 9 bilinen sınırı) → Giriş/Çıkış yalnız dış hareket; transfer ücreti ve kredi faizi Çıkış'ta,
//       Transfer'den düşülür (Banka penceresinin Bugün ve Bu Ay'ı ile aynı); Banka ve POS Hareketleri ve ANLIK DURUM'da da.
//   R3  Kart ve kredi borcu ya da hesabı atanmamış eski hareketler Gerçek Banka'ya karışır → ayrı grup/satır; Gerçek Banka TOPLAM'ı yalnız 102.
//   R4  Boş dönem, tek gün, geçmiş (yalnız eski hareketler), gelecek dönem (hareket yok, devir = bakiye), boş şirket (002).
//   R5  İleri tarihli hareket girilmeye çalışılır → 400; raporlar değişmez.
//   R6  Yetkisiz: personel 403 (katalog, ekran, PDF, Excel; dosya sızmaz); Banka Raporları yetkisi kaldırılan muhasebe 403; Finans Raporları olan
//       ama Banka Raporları olmayan rol Banka grubunu görmez; muhasebe yalnız Banka grubunu görür.
//   R7  ?hofCompany= ile başka şirketin hesabı → 404; 002'nin raporları 001'in verisini göstermez.
//   R8  Geçersiz süzgeç değeri (tanınmayan grup/hareket, olmayan hesap, bozuk tarih, ters aralık) → 400/404, sessizce "tümü" değil.
//   R9  Birleşik Rapor'un banka sütun adları ANLIK DURUM'dan farklı (yazım) ya da yetkisize dolu → K10 adları birebir; yetkisize boş.
//   R10 Açık ANLIK DURUM eski sayıyı gösterir (önbellek) → banka hareketinden sonra yeni sayı; fatura peşini de overview.changed yayımlar (C10).
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createUser } from "./helpers.mjs";
import { apiOf, integrityOk, pdfText, unwrap, xlsxSheets } from "./banka-210-ortak.mjs";
import { BANK, TODAY, bootBank, expectStatus, must, openAccount, trIban } from "./banka-210-hesap-ortak.mjs";

const RC = "/api/workspace/report-center";
const BANK_REPORTS = ["banka-bakiye", "banka-hareket", "banka-masraf", "alt-hesap-mizani"];
const K10 = { realBank: "Gerçek Banka", debt: "Kart ve Kredi Borcu", unassigned: "Hesabı Atanmamış Eski Hareketler" };
const NO_SUM = new Set(["Bakiye"]);

// ---------- Programdan bağımsız biçim yardımcıları ----------
const moneyOf = cell => {
  const match = /^(-|−)?((?:\d{1,3}(?:\.\d{3})*|\d+)),(\d{2}) TL$/.exec(String(cell ?? "").trim());
  return match ? Math.round(Number(`${match[2].replace(/\./g, "")}.${match[3]}`) * 100) * (match[1] ? -1 : 1) : null;
};
const tlText = minor => {
  const abs = Math.abs(minor);
  const lira = String(Math.trunc(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${minor < 0 ? "-" : ""}${lira},${String(abs % 100).padStart(2, "0")} TL`;
};
const sumBy = (list, pick) => list.reduce((total, item) => total + pick(item), 0);

// ---------- Bağımsız defter (E): her para satırı hesabıyla, tarihiyle ve payıyla ----------
// cls: ext (dış), tr (iç hareket; fee = satırın dış payı), adj (açılış). acc: Z, G (Gerçek Banka), K (kart 309), L (kredi 300), U102, U108.
const E = [];
const ext = (d, acc, signed, label) => E.push({ d, acc, signed, extIn: Math.max(signed, 0), extOut: Math.max(-signed, 0), trIn: 0, trOut: 0, adj: 0, label });
const tr = (d, acc, signed, fee = 0, label = "") => {
  const out = signed < 0;
  E.push({ d, acc, signed, extIn: out ? 0 : fee, extOut: out ? fee : 0, trIn: out ? 0 : signed - fee, trOut: out ? -signed - fee : 0, adj: 0, label });
};
const adj = (d, acc, signed, label) => E.push({ d, acc, signed, extIn: 0, extOut: 0, trIn: 0, trOut: 0, adj: signed, label });
// Banka Masraf Raporu'nun satırları (bağımsız): matrah, BSMV, KDV (kuruş).
const FEES = [];
const REAL = ["Z", "G"];
const DEBT = ["K", "L"];
const UNASSIGNED = ["U102", "U108"];

const RANGES = [
  { label: "varsayılan (Bu Yıl)", q: {}, from: "2026-01-01", to: "2026-12-31" },
  { label: "Tüm Zamanlar", q: { preset: "all" }, from: "", to: TODAY },
  { label: "Bu Ay", q: { preset: "thisMonth" }, from: "2026-10-01", to: "2026-10-31" },
  { label: "05.10–06.10", q: { from: "2026-10-05", to: "2026-10-06" }, from: "2026-10-05", to: "2026-10-06" },
  { label: "tek gün 03.10", q: { from: "2026-10-03", to: "2026-10-03" }, from: "2026-10-03", to: "2026-10-03" },
  { label: "geçmiş (Eylül: yalnız eski hareketler)", q: { from: "2026-09-01", to: "2026-09-30" }, from: "2026-09-01", to: "2026-09-30" },
  { label: "gelecek (hareket yok)", q: { from: "2026-10-09", to: "2026-12-31" }, from: "2026-10-09", to: "2026-12-31" },
  { label: "boş dönem (2020)", q: { from: "2020-01-01", to: "2020-12-31" }, from: "2020-01-01", to: "2020-12-31" },
];
const inRange = (d, r) => (!r.from || d >= r.from) && (!r.to || d <= r.to);
const beforeRange = (d, r) => Boolean(r.from) && d < r.from;
const upTo = (d, r) => !r.to || d <= r.to;
const qs = query => new URLSearchParams(Object.entries(query).filter(([, value]) => value !== "" && value !== undefined)).toString();

describe("2.1.0 Aşama 14 — Banka raporları ve K10 (bağımsız beklenenle, her süzgeç × ekran/PDF/Excel)", () => {
  let ctx;
  let api;
  let acc;
  let sub;
  let label;
  let companyName;
  const stats = { combos: 0, footer: 0, files: 0 };

  before(async () => {
    ctx = await bootBank();
    api = ctx.api;
    // Şirket başlığı (PDF): 001'in unvanı.
    const companies = await must("şirketler", api.get("/api/companies"));
    companyName = "Banka Rapor Ticaret A.Ş.";
    await must("unvan", api.put(`/api/companies/${companies.companies[0].id}`, { name: companyName }));
    const abc = await must("ABC", api.post("/api/workspace/accounts", { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    const xyz = await must("XYZ", api.post("/api/workspace/accounts", { name: "XYZ Tedarik", type: "supplier", registeredOn: "2026-09-01" }));
    const bankParty = await must("banka carisi", api.post("/api/workspace/accounts", { name: "Garanti BBVA A.Ş.", type: "supplier", registeredOn: "2026-09-01" }));
    // Eski sürüm gibi: banka hesabı tanımlanmadan girilmiş havale ve POS → Hesabı Atanmamış Eski Hareketler (102.00 / 108.00).
    await must("eski havale", api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", amount: "5.000", method: "bank", date: "2026-09-20" }));
    ext("2026-09-20", "U102", 500_000, "eski havale");
    await must("eski POS", api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", amount: "1.000", method: "card", date: "2026-09-21" }));
    ext("2026-09-21", "U108", 100_000, "eski POS");
    // Hesaplar (01.10.2026, Bakiye Doğrulandı): Ziraat 100.000, Garanti 50.000, kurumsal kart borcu 5.000, kredi 0.
    const ziraat = await openAccount(api, { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", iban: trIban(10, 1234567), opening: { date: "2026-10-01", amount: "100.000", confirmed: true } });
    adj("2026-10-01", "Z", 10_000_000, "açılış");
    const garanti = await openAccount(api, { bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", iban: trIban(62, 7654321), opening: { date: "2026-10-01", amount: "50.000", confirmed: true } });
    adj("2026-10-01", "G", 5_000_000, "açılış");
    const card = await openAccount(api, { bankName: "Ziraat Bankası", name: "Şirket Kartı", kind: "card", creditLimit: "50.000", opening: { date: "2026-10-01", amount: "5.000", confirmed: true } });
    adj("2026-10-01", "K", -500_000, "kart açılış borcu");
    const loan = await openAccount(api, { bankName: "Garanti BBVA", name: "Ticari Kredi", kind: "loan", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
    acc = { Z: ziraat, G: garanti, K: card, L: loan };
    sub = { Z: ziraat.glSub, G: garanti.glSub, K: card.glSub, L: loan.glSub, U102: "102.00", U108: "108.00" };
    label = { Z: "Ziraat Bankası · Ana TL Hesabı", G: "Garanti BBVA · Ana TL Hesabı", K: "Ziraat Bankası · Şirket Kartı", L: "Garanti BBVA · Ticari Kredi" };
    const Z = ziraat.id;
    const G = garanti.id;
    // 1–2. Cari tahsilat / ödeme (havale, hesaplı).
    await must("ABC tahsilat", api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", amount: "20.000", method: "bank", bankAccountId: Z, date: "2026-10-02" }));
    ext("2026-10-02", "Z", 2_000_000, "ABC tahsilat");
    await must("XYZ ödeme", api.post(`/api/workspace/accounts/${xyz.id}/entries`, { kind: "out", amount: "3.000", method: "bank", bankAccountId: G, date: "2026-10-02" }));
    ext("2026-10-02", "G", -300_000, "XYZ ödeme");
    // 3. Satış faturası peşini havale (Garanti).
    await must("fatura", api.post("/api/workspace/invoices", { kind: "sale", accountId: abc.id, issueDate: "2026-10-03", pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: 5000, discountRate: 0, vatRate: 0 }], payment: { cash: [{ amount: "5.000", method: "bank", bankAccountId: G, lineKey: "rap-1" }], cheques: [], endorse: [], rest: "open" }, force: true }));
    ext("2026-10-03", "G", 500_000, "fatura peşini");
    // 4. Taksit tahsilatı havale (Ziraat).
    const plan = await must("taksit kartı", api.post("/api/workspace/plans", { accountId: abc.id, name: "ABC Ltd.", total: "6.000", mode: "auto", count: 3, firstDue: "2026-10-15" }));
    await must("taksit tahsilatı", api.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "2.000", method: "bank", bankAccountId: Z, date: "2026-10-03" }));
    ext("2026-10-03", "Z", 200_000, "taksit tahsilatı");
    // 5. Stok peşin satış havale (Ziraat): 2 × 1.500.
    const item = await must("ürün", api.post("/api/workspace/stock", { name: "Ürün A", unit: "Adet", openingQty: "10", unitPrice: "1.000" }));
    await must("stok satışı", api.post(`/api/workspace/stock/${item.id}/moves`, { kind: "out", qty: "2", unitPrice: "1.500", pay: "cash", method: "bank", bankAccountId: Z, date: "2026-10-04" }));
    ext("2026-10-04", "Z", 300_000, "stok satışı");
    // 6. Alınan çekin tahsili havale (Garanti).
    const cheque = await must("çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "4.000", issueDate: "2026-10-04", dueDate: "2026-10-04", drawer: "Keşideci A", serialNo: "RC-1", accountId: abc.id }));
    await must("çek tahsili", api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "collect", date: "2026-10-04", method: "bank", bankAccountId: G }));
    ext("2026-10-04", "G", 400_000, "çek tahsili");
    // 7. Kasa ↔ Banka iki yön: Ziraat'ten Kasa'ya 10.000; Kasa'dan Garanti'ye 2.000 (iç hareket).
    await must("bankadan kasaya", api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: "10.000", date: "2026-10-05", bankAccountId: Z }));
    tr("2026-10-05", "Z", -1_000_000);
    await must("kasadan bankaya", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "2.000", date: "2026-10-05", bankAccountId: G }));
    tr("2026-10-05", "G", 200_000);
    // 8. Bankalar arası transfer ücretli: Ziraat → Garanti 20.000 + ücret 5,00 BSMV Hariç (EFT): gönderenden 20.005,25.
    await must("ücretli transfer", api.post(`${BANK}/transfers`, { accountId: Z, toAccountId: G, amount: "20.000", date: "2026-10-06", feeAmount: "5", feeTax: "bsmv_excl", feeType: "eft", channel: "eft" }));
    tr("2026-10-06", "Z", -2_000_525, 525);
    tr("2026-10-06", "G", 2_000_000);
    FEES.push({ d: "2026-10-06", acc: "Z", base: 500, bsmv: 25, vat: 0, kind: "transfer" });
    // 9. Bankalar arası transfer ücretsiz: Garanti → Ziraat 1.000 (sonra ters kaydedilir).
    const free = await must("ücretsiz transfer", api.post(`${BANK}/transfers`, { accountId: G, toAccountId: Z, amount: "1.000", date: "2026-10-06" }));
    tr("2026-10-06", "G", -100_000);
    tr("2026-10-06", "Z", 100_000);
    // 10–12. Masraf: BSMV Dahil 10,50 (Ziraat), BSMV Hariç 10 (Garanti; sonra ters kaydedilir), KDV Dahil 120 faturalı (Garanti).
    await must("masraf BSMV dahil", api.post(`${BANK}/vouchers`, { type: "fee", accountId: Z, amount: "10,50", feeType: "eft", tax: "bsmv_incl", date: "2026-10-07" }));
    ext("2026-10-07", "Z", -1_050, "masraf");
    FEES.push({ d: "2026-10-07", acc: "Z", base: 1_000, bsmv: 50, vat: 0, kind: "fee" });
    const feeG = await must("masraf BSMV hariç", api.post(`${BANK}/vouchers`, { type: "fee", accountId: G, amount: "10", feeType: "havale", tax: "bsmv_excl", date: "2026-10-07" }));
    ext("2026-10-07", "G", -1_050, "masraf");
    FEES.push({ d: "2026-10-07", acc: "G", base: 1_000, bsmv: 50, vat: 0, kind: "fee" });
    await must("KDV'li masraf", api.post(`${BANK}/vouchers`, { type: "fee", accountId: G, amount: "120", feeType: "eft", tax: "vat_incl", taxRate: "20", partyId: bankParty.id, invoiceNo: "GB-2026-0001", date: "2026-10-07" }));
    ext("2026-10-07", "G", -12_000, "KDV'li masraf");
    FEES.push({ d: "2026-10-07", acc: "G", base: 10_000, bsmv: 0, vat: 2_000, kind: "fee" });
    // 13. Faiz geliri 1.000, stopaj %15 → net 850 (Ziraat).
    await must("faiz", api.post(`${BANK}/vouchers`, { type: "interest_in", accountId: Z, amount: "1.000", stoppageRate: "15", date: "2026-10-07" }));
    ext("2026-10-07", "Z", 85_000, "faiz");
    // 14. Kart borcu ödemesi 2.000 (Ziraat → kart): iç hareket.
    await must("kart borcu", api.post(`${BANK}/vouchers`, { type: "card_payment", accountId: Z, cardAccountId: card.id, amount: "2.000", date: "2026-10-07" }));
    tr("2026-10-07", "Z", -200_000);
    tr("2026-10-07", "K", 200_000);
    // 15–16. Kredi kullanımı 10.000 ve geri ödemesi 1.000 + faiz 100 (Garanti; bugün).
    await must("kredi kullanımı", api.post(`${BANK}/vouchers`, { type: "loan_draw", accountId: G, loanAccountId: loan.id, amount: "10.000", date: TODAY }));
    tr(TODAY, "G", 1_000_000);
    tr(TODAY, "L", -1_000_000);
    await must("kredi geri ödemesi", api.post(`${BANK}/vouchers`, { type: "loan_repay", accountId: G, loanAccountId: loan.id, amount: "1.000", interestAmount: "100", date: TODAY }));
    tr(TODAY, "G", -110_000, 10_000);
    tr(TODAY, "L", 100_000);
    // 17. Garanti masrafının ters kaydı (kendi tarihinde, 07.10): dış giriş; Banka Masraf Raporu'nda eksi.
    await must("masraf ters kaydı", api.post(`${BANK}/events/${encodeURIComponent(feeG.id)}/reverse`, { reason: "Hatalı masraf" }));
    ext("2026-10-07", "G", 1_050, "masraf ters kaydı");
    FEES.push({ d: "2026-10-07", acc: "G", base: -1_000, bsmv: -50, vat: 0, kind: "reversal" });
    // 18. Ücretsiz transferin ters kaydı (06.10): iki bacak iç hareket.
    await must("transfer ters kaydı", api.post(`${BANK}/events/${encodeURIComponent(free.id)}/reverse`, { reason: "Yanlış hesap" }));
    tr("2026-10-06", "G", 100_000);
    tr("2026-10-06", "Z", -100_000);
    // 19. Bugün ABC'den 1.500 havale (Garanti).
    await must("bugünkü tahsilat", api.post(`/api/workspace/accounts/${abc.id}/entries`, { kind: "in", amount: "1.500", method: "bank", bankAccountId: G, date: TODAY }));
    ext(TODAY, "G", 150_000, "bugünkü tahsilat");
    await integrityOk(api, "veri girildi");
  });
  after(() => ctx?.server.close());

  // ---------- Bağımsız beklenen ----------
  const of = keys => E.filter(row => keys.includes(row.acc));
  const closing = (keys, r = { to: "" }) => sumBy(of(keys).filter(row => upTo(row.d, r)), row => row.signed);
  const flows = (keys, r) => {
    const list = of(keys).filter(row => inRange(row.d, r));
    return { opening: sumBy(of(keys).filter(row => beforeRange(row.d, r)), row => row.signed), in: sumBy(list, row => row.extIn), out: sumBy(list, row => row.extOut), trIn: sumBy(list, row => row.trIn), trOut: sumBy(list, row => row.trOut), adj: sumBy(list, row => row.adj), closing: closing(keys, r), count: list.length };
  };

  // ---------- Ortak denetimler: TOPLAM = satırlar; PDF ve Excel = ekran ----------
  const get = (id, query = {}, format = "") => (format ? api.raw("GET", `${RC}/${id}/${format}?${qs(query)}`) : api.get(`${RC}/${id}?${qs(query)}`));
  const col = (data, header) => data.headers.indexOf(header);
  const summaryOf = (data, key) => {
    const hit = data.summary.find(([name]) => name === key);
    assert.ok(hit, `${data.id}: özette "${key}" yok: ${JSON.stringify(data.summary)}`);
    return moneyOf(hit[1]) ?? hit[1];
  };
  function checkFooter(data, tag) {
    assert.equal(data.rows.length, data.total, `${tag}: küçük veride bütün satırlar ön izlemede`);
    for (const row of data.rows) assert.equal(row.length, data.headers.length, `${tag}: satır kolon sayısı`);
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
    const sheet = Object.values(sheets)[0];
    assert.deepEqual(sheet[0], data.headers, `${tag} Excel: başlık satırı`);
    assert.equal(sheet.length, 1 + data.rows.length + (data.footer ? 1 : 0), `${tag} Excel: satır sayısı`);
    const value = cell => moneyOf(cell);
    const same = (excel, screen, where) => {
      const expected = value(screen);
      if (expected === null) return;
      const actual = typeof excel === "number" ? Math.round(excel * 100) : value(excel);
      assert.equal(actual, expected, `${tag} Excel ${where}: ${excel} ≠ ${screen}`);
    };
    data.rows.forEach((row, r) => row.forEach((cell, c) => same(sheet[r + 1]?.[c], cell, `satır ${r + 1} "${data.headers[c]}"`)));
    if (data.footer) data.footer.forEach((cell, c) => same(sheet.at(-1)?.[c], cell, `TOPLAM "${data.headers[c]}"`));
    const ozet = Object.fromEntries((sheets["Özet"] || []).slice(1).map(([key, val]) => [key, val]));
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

  it("katalog: Banka grubu dört rapor; süzgeçleri ve hesap seçenekleri (bakiye dönmez)", async () => {
    const catalog = await must("katalog", api.get(RC));
    const bank = catalog.reports.filter(report => report.group === "Banka");
    assert.deepEqual(bank.map(report => report.id), BANK_REPORTS);
    assert.deepEqual(Object.fromEntries(bank.map(report => [report.id, report.params])), { "banka-bakiye": ["range", "bankGroup"], "banka-hareket": ["range", "bankAccount", "bankMove"], "banka-masraf": ["range", "feeAccount"], "alt-hesap-mizani": ["range"] });
    assert.deepEqual(bank.map(report => report.title), ["Banka Bakiye Raporu", "Banka Hareket Raporu", "Banka Masraf Raporu", "Alt Hesap Mizanı"]);
    assert.deepEqual(catalog.choices.bankAccount.map(([value]) => value), ["", acc.Z.id, acc.G.id, acc.K.id, acc.L.id, "unassigned"]);
    assert.deepEqual(catalog.choices.feeAccount.map(([value]) => value), ["", acc.Z.id, acc.G.id]);
    assert.ok(!/\d,\d{2}/.test(JSON.stringify(catalog.choices)), "seçeneklerde bakiye (tutar) yok");
  });

  it("Banka Bakiye Raporu: her grup × her dönem — Gerçek Banka, Kart ve Kredi Borcu, Hesabı Atanmamış ayrı; Giriş/Çıkış yalnız dış hareket", async () => {
    const GROUPS = { real: REAL, debt: DEBT, unassigned: UNASSIGNED, all: [...REAL, ...DEBT, ...UNASSIGNED] };
    const groupName = key => (REAL.includes(key) ? K10.realBank : DEBT.includes(key) ? K10.debt : K10.unassigned);
    for (const r of RANGES) {
      for (const group of Object.keys(GROUPS)) {
        const query = { ...r.q, ...(group === "real" ? {} : { bankGroup: group }) };
        const tag = `banka-bakiye ${group} ${r.label}`;
        const data = await screen("banka-bakiye", query, tag);
        // Hesap kartı her zaman satırdır; hesabı atanmamış satır yalnız o kova dönem sonuna kadar hareket görmüşse.
        const keys = GROUPS[group].filter(key => !UNASSIGNED.includes(key) || of([key]).some(row => upTo(row.d, r)));
        assert.equal(data.rows.length, keys.length, `${tag}: satır sayısı`);
        for (const key of keys) {
          const row = data.rows.find(cells => cells[col(data, "Alt Hesap")] === sub[key]);
          assert.ok(row, `${tag}: ${sub[key]} satırı yok`);
          assert.equal(row[col(data, "Grup")], groupName(key), `${tag}: ${sub[key]} grubu`);
          const f = flows([key], r);
          const got = header => moneyOf(row[col(data, header)]);
          assert.deepEqual([got("Dönem Başı"), got("Giriş"), got("Çıkış"), got("Transfer Giriş"), got("Transfer Çıkış"), got("Açılış ve Devir Düzeltmesi"), got("Dönem Sonu")], [f.opening, f.in, f.out, f.trIn, f.trOut, f.adj, f.closing], `${tag}: ${sub[key]} sayıları`);
          assert.equal(f.opening + f.in - f.out + f.trIn - f.trOut + f.adj, f.closing, `${tag}: model kendi içinde tutarlı`);
        }
        // TOPLAM yalnız tek grup gösterilirken (gruplar birbirine toplanmaz).
        assert.equal(Boolean(data.footer), group !== "all" && keys.length > 0, `${tag}: TOPLAM satırı`);
        // Özet (her grupta aynı): K10 adlarıyla dönem sonu.
        assert.equal(summaryOf(data, K10.realBank), closing(REAL, r), `${tag}: özet Gerçek Banka`);
        assert.equal(summaryOf(data, K10.debt), -closing(DEBT, r) || 0, `${tag}: özet Kart ve Kredi Borcu`);
        if (UNASSIGNED.some(key => of([key]).some(row => upTo(row.d, r)))) assert.equal(summaryOf(data, K10.unassigned), closing(UNASSIGNED, r), `${tag}: özet Hesabı Atanmamış`);
        if (group === "real" || group === "all") await checkFiles("banka-bakiye", query, data, tag);
      }
    }
    // Bu ay: Gerçek Banka TOPLAM'ında transferin iki bacağı Giriş/Çıkış'ı şişirmez (R2): Giriş = dış girişler.
    const month = await screen("banka-bakiye", { preset: "thisMonth" }, "bu ay");
    const f = flows(REAL, RANGES[2]);
    assert.equal(moneyOf(month.footer[col(month, "Giriş")]), f.in);
    assert.equal(moneyOf(month.footer[col(month, "Transfer Giriş")]), f.trIn);
    assert.equal(f.in, 2_000_000 + 500_000 + 200_000 + 300_000 + 400_000 + 85_000 + 1_050 + 150_000, "bağımsız: dış girişler (cari, fatura, taksit, stok, çek, faiz, masraf ters kaydı, bugünkü tahsilat)");
    assert.equal(f.out, 300_000 + 525 + 1_050 + 1_050 + 12_000 + 10_000, "bağımsız: dış çıkışlar (cari ödeme, transfer ücreti, iki masraf, KDV'li masraf, kredi faizi)");
  });

  it("Banka Hareket Raporu: her hesap × her hareket süzgeci × her dönem — satır satır, yürüyen bakiye, İşlem No", async () => {
    const CHOICES = [["", REAL], ...["Z", "G", "K", "L"].map(key => [key, [key]]), ["unassigned", UNASSIGNED]];
    const lastLabel = key => (UNASSIGNED.includes(key) ? `${K10.unassigned} · ${key === "U102" ? "Havale / EFT (102.00)" : "POS / Kart (108.00)"}` : label[key]);
    for (const r of RANGES) {
      for (const [choice, keys] of CHOICES) {
        for (const move of ["", "external", "internal"]) {
          const query = { ...r.q, ...(choice ? { bankAccount: acc[choice]?.id || choice } : {}), ...(move ? { bankMove: move } : {}) };
          const tag = `banka-hareket ${choice || "tümü"} ${move || "—"} ${r.label}`;
          const data = await screen("banka-hareket", query, tag);
          const devir = data.rows.filter(row => row[col(data, "İşlem Türü")] === "Devir");
          const body = data.rows.filter(row => row[col(data, "İşlem Türü")] !== "Devir");
          const seen = keys.filter(key => of([key]).some(row => upTo(row.d, r)));
          assert.equal(devir.length, ["Z", "G", "K", "L"].includes(choice) ? 1 : seen.length, `${tag}: devir satırı sayısı`);
          for (const key of seen) {
            const row = devir.find(cells => cells[col(data, "Hesap")] === lastLabel(key));
            assert.ok(row, `${tag}: ${key} devir satırı yok (${devir.map(cells => cells[2]).join(", ")})`);
            assert.equal(moneyOf(row[col(data, "Bakiye")]), flows([key], r).opening, `${tag}: ${key} devir`);
          }
          // Hesap hesap satırlar (tarih ve giriş sırasıyla), payları ve yürüyen bakiye bağımsız defterle.
          const pick = row => (move === "external" ? row.extIn || row.extOut : move === "internal" ? row.trIn || row.trOut : true);
          let count = 0;
          for (const key of keys) {
            let running = flows([key], r).opening;
            const wanted = [];
            for (const row of [...of([key])].map((row, index) => ({ row, index })).sort((a, b) => (a.row.d === b.row.d ? a.index - b.index : a.row.d < b.row.d ? -1 : 1)).map(item => item.row)) {
              if (!upTo(row.d, r) || beforeRange(row.d, r)) continue;
              running += row.signed;
              if (row.adj ? !move : pick(row)) wanted.push({ ...row, balance: running });
            }
            const got = body.filter(row => row[col(data, "Hesap")] === lastLabel(key));
            assert.equal(got.length, wanted.length, `${tag}: ${key} satır sayısı`);
            got.forEach((row, index) => {
              const w = wanted[index];
              const cell = header => moneyOf(row[col(data, header)]) ?? 0;
              assert.deepEqual([cell("Giriş"), cell("Çıkış"), cell("Transfer Giriş"), cell("Transfer Çıkış"), cell("Bakiye")], [w.extIn, w.extOut, w.trIn, w.trOut, w.balance], `${tag}: ${key} ${index + 1}. satır (${w.label || ""} ${w.d})`);
              assert.match(row[col(data, "İşlem No")], /^BNK-2026-\d{6}$/, `${tag}: İşlem No`);
              if (w.adj) assert.match(row[col(data, "Açıklama")], /Açılış ve Devir Düzeltmesi/, `${tag}: açılış açıklaması`);
            });
            count += got.length;
          }
          assert.equal(body.length, count, `${tag}: başka hesabın satırı yok`);
          const f = flows(keys, r);
          assert.deepEqual([summaryOf(data, "Devir"), summaryOf(data, "Giriş"), summaryOf(data, "Çıkış"), summaryOf(data, "Transfer Giriş"), summaryOf(data, "Transfer Çıkış"), summaryOf(data, "Dönem Sonu")], [f.opening, f.in, f.out, f.trIn, f.trOut, f.closing], `${tag}: özet`);
          if (["Z", "G", "K", "L"].includes(choice)) {
            const list = of(keys).filter(row => inRange(row.d, r));
            assert.equal(summaryOf(data, "Hesaba Giren (Tümü)"), sumBy(list.filter(row => row.signed > 0), row => row.signed), `${tag}: hesaba giren (ekstre gibi)`);
            assert.equal(summaryOf(data, "Hesaptan Çıkan (Tümü)"), sumBy(list.filter(row => row.signed < 0), row => -row.signed), `${tag}: hesaptan çıkan`);
          }
          if (r.label === "Bu Ay" || (r.label === "Tüm Zamanlar" && !move)) await checkFiles("banka-hareket", query, data, tag);
        }
      }
    }
  });

  it("Banka Masraf Raporu: transfer ücreti dahil, BSMV ve KDV ayrı kolonlarda; her hesap × her dönem; 770 ile tutar", async () => {
    for (const r of RANGES) {
      for (const choice of ["", "Z", "G"]) {
        const query = { ...r.q, ...(choice ? { feeAccount: acc[choice].id } : {}) };
        const tag = `banka-masraf ${choice || "tümü"} ${r.label}`;
        const data = await screen("banka-masraf", query, tag);
        const wanted = FEES.filter(fee => inRange(fee.d, r) && (!choice || fee.acc === choice));
        assert.equal(data.rows.length, wanted.length, `${tag}: satır sayısı`);
        const total = key => sumBy(wanted, fee => fee[key]);
        assert.deepEqual([summaryOf(data, "Matrah"), summaryOf(data, "BSMV"), summaryOf(data, "KDV"), summaryOf(data, "Toplam")], [total("base"), total("bsmv"), total("vat"), total("base") + total("bsmv") + total("vat")], `${tag}: özet`);
        for (const row of data.rows) {
          assert.equal(row[col(data, "Hesap Kodu")].slice(0, 3), "770", `${tag}: gider hesabı 770`);
          if (choice) assert.equal(row[col(data, "Banka Hesabı")], label[choice], `${tag}: hesap süzgeci`);
        }
        assert.equal(data.rows.filter(row => /Transfer Ücreti/.test(row[col(data, "Masraf Türü")])).length, wanted.filter(fee => fee.kind === "transfer").length, `${tag}: transfer ücreti satırı`);
        assert.equal(data.rows.filter(row => /Ters Kayıt/.test(row[col(data, "Masraf Türü")])).length, wanted.filter(fee => fee.kind === "reversal").length, `${tag}: ters kayıt satırı (eksi)`);
        if (data.rows.length) await checkFiles("banka-masraf", query, data, tag);
      }
    }
    // 770 = Σ matrah + BSMV (bütün dönem); KDV 191'de.
    const ledger = await must("mizan", api.get("/api/workspace/ledger"));
    const gl = code => Math.round((ledger.trial.accounts.find(row => row.code === code)?.balance || 0) * 100);
    assert.equal(gl("770"), sumBy(FEES, fee => fee.base + fee.bsmv), "770 = rapordaki matrah + BSMV");
    assert.equal(gl("191"), sumBy(FEES, fee => fee.vat), "191 = rapordaki KDV");
    const all = await screen("banka-masraf", { preset: "all" }, "770");
    assert.equal(summaryOf(all, "770 Genel Giderler ve Alış Faturaları") , sumBy(FEES, fee => fee.base + fee.bsmv + fee.vat), "özet hesap kodu satırı");
  });

  it("Alt Hesap Mizanı: her dönem; alt hesaplar = bağımsız defter; ana hesaplar = Hesap Planı Mizanı (102, 108, 300, 309)", async () => {
    const ALL = [...REAL, ...DEBT, ...UNASSIGNED];
    for (const r of RANGES) {
      const tag = `alt-hesap-mizani ${r.label}`;
      const data = await screen("alt-hesap-mizani", r.q, tag);
      const keys = ALL.filter(key => of([key]).some(row => upTo(row.d, r)));
      assert.deepEqual(data.rows.map(row => row[0]).sort(), keys.map(key => sub[key]).sort(), `${tag}: alt hesaplar`);
      for (const key of keys) {
        const row = data.rows.find(cells => cells[0] === sub[key]);
        const list = of([key]).filter(item => inRange(item.d, r));
        const opening = flows([key], r).opening;
        const debit = sumBy(list.filter(item => item.signed > 0), item => item.signed);
        const credit = sumBy(list.filter(item => item.signed < 0), item => -item.signed);
        const balance = opening + debit - credit;
        assert.deepEqual([moneyOf(row[col(data, "Devir")]), moneyOf(row[col(data, "Borç")]), moneyOf(row[col(data, "Alacak")]), moneyOf(row[col(data, "Bakiye")]), row[col(data, "Yön")]], [opening, debit, credit, Math.abs(balance), balance > 0 ? "Borç" : balance < 0 ? "Alacak" : ""], `${tag}: ${sub[key]}`);
      }
      assert.equal(summaryOf(data, "Alt Hesap Mutabakatı"), "Tutarlı", `${tag}: alt hesap mutabakatı`);
      if (r.label === "Tüm Zamanlar" || r.label === "Bu Ay") await checkFiles("alt-hesap-mizani", r.q, data, tag);
    }
    const ledger = await must("mizan", api.get("/api/workspace/ledger"));
    const gl = code => Math.round((ledger.trial.accounts.find(row => row.code === code)?.balance || 0) * 100);
    assert.equal(gl("102"), closing(["Z", "G", "U102"]), "102 = 102.01 + 102.02 + 102.00");
    assert.equal(gl("108"), closing(["U108"]), "108 = 108.00");
    assert.equal(gl("309"), closing(["K"]), "309 = kart");
    assert.equal(gl("300"), closing(["L"]), "300 = kredi");
  });

  it("R1/R8: her süzgeç parametresi rapora ulaşır (queryOf) ve geçersiz değer 400/404 (sessizce tümü değil)", async () => {
    const all = await screen("banka-hareket", { preset: "all" }, "tümü");
    const z = await screen("banka-hareket", { preset: "all", bankAccount: acc.Z.id }, "Z");
    assert.ok(z.rows.length < all.rows.length && z.rows.every(row => row[col(z, "Hesap")] === label.Z), "bankAccount süzer");
    const ext = await screen("banka-hareket", { preset: "all", bankMove: "external" }, "dış");
    const moving = data => data.rows.filter(row => row[col(data, "İşlem Türü")] !== "Devir");
    assert.ok(moving(ext).length < moving(all).length, "bankMove süzer");
    assert.ok(moving(ext).every(row => moneyOf(row[col(ext, "Giriş")]) || moneyOf(row[col(ext, "Çıkış")])), "Dış Hareketler'de her satırın dış payı var (ücretli transfer yalnız ücretiyle)");
    const inner = await screen("banka-hareket", { preset: "all", bankMove: "internal" }, "iç");
    assert.ok(moving(inner).length && moving(inner).every(row => moneyOf(row[col(inner, "Transfer Giriş")]) || moneyOf(row[col(inner, "Transfer Çıkış")])), "Transfer süzgecinde her satır iç hareket");
    const debt = await screen("banka-bakiye", { preset: "all", bankGroup: "debt" }, "borç");
    assert.deepEqual(debt.rows.map(row => row[col(debt, "Alt Hesap")]), [sub.K, sub.L], "bankGroup süzer");
    const g = await screen("banka-masraf", { preset: "all", feeAccount: acc.G.id }, "G");
    assert.ok(g.rows.length && g.rows.every(row => row[col(g, "Banka Hesabı")] === label.G), "feeAccount süzer");
    // PDF ve Excel aynı süzgeçle (alt başlık ve satırlar).
    const pdf = pdfText((await get("banka-hareket", { preset: "all", bankAccount: acc.Z.id, bankMove: "internal" }, "pdf")).buffer).replace(/\s+/g, " ");
    assert.ok(pdf.includes("Transfer (İç Hareketler)") && pdf.includes(`${label.Z} (${sub.Z})`) && !pdf.includes(label.G), "PDF süzgeçli");
    const sheet = Object.values(xlsxSheets((await get("banka-hareket", { preset: "all", bankAccount: acc.Z.id, bankMove: "internal" }, "xlsx")).buffer))[0];
    assert.ok(sheet.slice(1).every(row => row[2] === label.Z || row[0] === "TOPLAM"), "Excel süzgeçli");
    for (const [id, query, status] of [
      ["banka-bakiye", { bankGroup: "xyz" }, 400],
      ["banka-hareket", { bankMove: "xyz" }, 400],
      ["banka-hareket", { bankAccount: "bacc-yok" }, 404],
      ["banka-masraf", { feeAccount: "bacc-yok" }, 404],
      ["banka-hareket", { from: "2026-02-30" }, 400],
      ["alt-hesap-mizani", { from: "2026-10-08", to: "2026-10-01" }, 400],
      ["banka-masraf", { from: "2026-10-08", to: "2026-10-01" }, 400],
    ]) for (const format of ["", "pdf", "xlsx"]) assert.equal((await get(id, query, format)).status, status, `${id} ${JSON.stringify(query)} ${format}`);
  });

  it("R5: ileri tarihli hareket girilemez; raporlar değişmez", async () => {
    const beforeData = await screen("banka-hareket", { preset: "all" }, "önce");
    expectStatus(await api.post(`${BANK}/vouchers`, { type: "fee", accountId: acc.Z.id, amount: "10", feeType: "eft", tax: "none", date: "2026-10-09" }), 400, "date-future", "ileri tarihli masraf");
    expectStatus(await api.post(`${BANK}/transfers`, { accountId: acc.Z.id, toAccountId: acc.G.id, amount: "10", date: "2026-10-20" }), 400, "date-future", "ileri tarihli transfer");
    const party = (await must("cariler", api.get("/api/workspace/accounts?status=all"))).accounts.find(item => item.name === "ABC Ltd.");
    const late = await api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "10", method: "bank", bankAccountId: acc.Z.id, date: "2026-10-09" });
    assert.equal(late.status, 400, "ileri tarihli cari tahsilatı");
    const afterData = await screen("banka-hareket", { preset: "all" }, "sonra");
    assert.deepEqual(afterData.rows, beforeData.rows);
  });

  it("R2/K10: ANLIK DURUM Banka kutusu = Gerçek Banka; Kart ve Kredi Borcu ve Hesabı Atanmamış ayrı; Bugün Giriş/Çıkış dış, Transfer ayrı; Banka Genel Bakış ile aynı", async () => {
    const overview = await must("ANLIK DURUM", api.get("/api/workspace/overview"));
    const bank = overview.cash.bank;
    assert.deepEqual(bank.labels && { realBank: bank.labels.realBank, debt: bank.labels.debt, unassigned: bank.labels.unassigned }, K10, "K10 adları");
    assert.equal(bank.defined, true);
    assert.equal(Math.round(bank.balance * 100), closing(REAL), "Gerçek Banka = 102.01 + 102.02 (kart, kredi ve hesabı atanmamış hariç)");
    assert.equal(Math.round(bank.debt.total * 100), -closing(DEBT), "Kart ve Kredi Borcu = 3.000 + 9.000");
    assert.equal(-closing(DEBT), 1_200_000);
    assert.equal(Math.round(bank.unassigned.total * 100), closing(UNASSIGNED), "Hesabı Atanmamış 102.00 + 108.00");
    const today = flows(REAL, { from: TODAY, to: TODAY });
    assert.deepEqual([bank.today.in, bank.today.out, bank.transfer.in, bank.transfer.out].map(value => Math.round(value * 100)), [today.in, today.out, today.trIn, today.trOut], "bugün: dış giriş/çıkış, transfer ayrı");
    assert.deepEqual([today.in, today.out, today.trIn, today.trOut], [150_000, 10_000, 1_000_000, 100_000], "bağımsız: bugün 1.500 tahsilat, 100 kredi faizi; kredi 10.000 / geri ödeme 1.000 transfer");
    // Banka penceresinin Genel Bakış'ı aynı tanım (K10: bütün ekranlarda aynı).
    const summary = await must("Genel Bakış", api.get(`${BANK}/summary`));
    assert.equal(summary.realBank.minor, Math.round(bank.balance * 100));
    assert.equal(summary.debt.totalMinor, Math.round(bank.debt.total * 100));
    assert.equal(summary.unassigned.totalMinor, Math.round(bank.unassigned.total * 100));
    assert.deepEqual([summary.flows.today.inMinor, summary.flows.today.outMinor, summary.flows.today.transferInMinor, summary.flows.today.transferOutMinor], [today.in, today.out, today.trIn, today.trOut]);
    // Banka Bakiye Raporu (Tüm Zamanlar) ile aynı.
    const report = await screen("banka-bakiye", { preset: "all" }, "ANLIK DURUM ↔ rapor");
    assert.equal(summaryOf(report, K10.realBank), closing(REAL));
    // Kasa kutusu değişmez (§8.9): nakit 10.000 − 2.000.
    assert.equal(overview.cash.balance, 8000);
  });

  it("R2: Banka ve POS Hareketleri — Kasa ↔ Banka ve bankalar arası transfer Dönem Giriş/Çıkış'ı şişirmez; Transfer satırında; dönem sonu aynı", async () => {
    for (const r of RANGES) {
      for (const payMethod of ["noncash", "bank", "card"]) {
        const keys = payMethod === "card" ? ["U108"] : payMethod === "bank" ? ["Z", "G", "U102"] : ["Z", "G", "U102", "U108"];
        const tag = `banka-pos ${payMethod} ${r.label}`;
        const data = await screen("banka-pos-hareketleri", { ...r.q, payMethod }, tag);
        const f = flows(keys, r);
        assert.deepEqual([summaryOf(data, "Devir"), summaryOf(data, "Dönem Giriş"), summaryOf(data, "Dönem Çıkış"), summaryOf(data, "Dönem Sonu")], [f.opening, f.in, f.out, f.closing], `${tag}: özet`);
        if (f.trIn || f.trOut) assert.deepEqual([summaryOf(data, "Transfer Giriş"), summaryOf(data, "Transfer Çıkış")], [f.trIn, f.trOut], `${tag}: Transfer`);
        else assert.ok(!data.summary.some(([key]) => key.startsWith("Transfer")), `${tag}: iç hareket yokken Transfer satırı yok`);
        if (data.footer) assert.deepEqual([moneyOf(data.footer[col(data, "Giriş")]) ?? 0, moneyOf(data.footer[col(data, "Çıkış")]) ?? 0], [f.in, f.out], `${tag}: TOPLAM = dış giriş/çıkış`);
        assert.equal(data.rows.length - 1, of(keys).filter(row => inRange(row.d, r)).length, `${tag}: satır sayısı (devir hariç)`);
        if (r.label === "Bu Ay" && payMethod === "noncash") await checkFiles("banka-pos-hareketleri", { ...r.q, payMethod }, data, tag);
      }
    }
  });

  it("R9: Birleşik Rapor banka sütunları ANLIK DURUM'la aynı adlar ve aynı sayılar; PDF ve Excel aynı adlar; yetkisize boş", async () => {
    const overview = await must("ANLIK DURUM", api.get("/api/workspace/overview"));
    const report = await must("birleşik", api.get("/api/companies/report"));
    for (const name of [overview.cash.bank.labels.realBank, overview.cash.bank.labels.debt, overview.cash.bank.labels.unassigned]) assert.ok(report.headers.includes(name), `Birleşik Rapor sütunu "${name}"`);
    assert.ok(!report.headers.includes("Banka / POS"), "eski karışık sütun kalktı");
    const own = report.rows.find(row => row.code === "001");
    assert.deepEqual([own.realBank, own.bankDebt, own.bankUnassigned], [overview.cash.bank.balance, overview.cash.bank.debt.total, overview.cash.bank.unassigned.total]);
    const pdf = pdfText((await api.raw("GET", "/api/companies/report.pdf")).buffer).replace(/\s+/g, " ");
    for (const name of Object.values(K10)) assert.ok(pdf.includes(name), `PDF "${name}"`);
    assert.ok(pdf.includes(tlText(closing(REAL))), "PDF'te Gerçek Banka tutarı");
    const sheet = Object.values(xlsxSheets((await api.raw("GET", "/api/companies/report.xlsx")).buffer))[0];
    for (const name of Object.values(K10)) assert.ok(sheet[0].includes(name), `Excel "${name}"`);
    const personel = apiOf(await createUser(ctx.server, api.client, { username: "birlesik-personel", role: "personel" }));
    const hidden = await must("personel birleşik", personel.get("/api/companies/report"));
    const mine = hidden.rows.find(row => row.code === "001");
    assert.deepEqual([mine.realBank, mine.bankDebt, mine.bankUnassigned], [null, null, null], "yetkisize banka sütunları boş");
    const xlsx = Object.values(xlsxSheets((await personel.raw("GET", "/api/companies/report.xlsx")).buffer))[0];
    assert.equal(xlsx[1][xlsx[0].indexOf(K10.realBank)], "—", "Excel'de yetkisize —");
  });

  it("R10: açık ANLIK DURUM yeni sayıyı gösterir (önbellek); banka ve fatura yazımı overview.changed yayımlar", async () => {
    const seen = [];
    const stop = ctx.app.context.events.tap((event, data) => event === "overview.changed" && seen.push(data));
    try {
      const first = await must("önce", api.get("/api/workspace/overview"));
      await must("yeni transfer", api.post(`${BANK}/transfers`, { accountId: acc.Z.id, toAccountId: acc.G.id, amount: "333", date: TODAY, feeAmount: "1", feeTax: "none" }));
      tr(TODAY, "Z", -33_400, 100);
      tr(TODAY, "G", 33_300);
      FEES.push({ d: TODAY, acc: "Z", base: 100, bsmv: 0, vat: 0, kind: "transfer" });
      const second = await must("sonra", api.get("/api/workspace/overview"));
      assert.equal(Math.round((first.cash.bank.balance - second.cash.bank.balance) * 100), 100, "Gerçek Banka yalnız ücret kadar azalır");
      assert.equal(Math.round((second.cash.bank.today.out - first.cash.bank.today.out) * 100), 100, "Bugün Çıkış: yalnız ücret");
      assert.equal(Math.round((second.cash.bank.transfer.out - first.cash.bank.transfer.out) * 100), 33_300, "Transfer Çıkış");
      const party = (await must("cariler", api.get("/api/workspace/accounts?status=all"))).accounts.find(item => item.name === "ABC Ltd.");
      await must("peşinli fatura", api.post("/api/workspace/invoices", { kind: "sale", accountId: party.id, issueDate: TODAY, pricesIncludeVat: true, lines: [{ name: "Hizmet", qty: 1, unitPrice: 700, discountRate: 0, vatRate: 0 }], payment: { cash: [{ amount: "700", method: "bank", bankAccountId: acc.G.id, lineKey: "rap-2" }], cheques: [], endorse: [], rest: "open" }, force: true }));
      ext(TODAY, "G", 70_000, "bugünkü fatura peşini");
      const third = await must("faturadan sonra", api.get("/api/workspace/overview"));
      assert.equal(Math.round((third.cash.bank.balance - second.cash.bank.balance) * 100), 70_000);
      const deadline = Date.now() + 3000;
      while (!(seen.some(item => item.kinds?.includes("bank")) && seen.some(item => item.kinds?.includes("invoices"))) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
      assert.ok(seen.some(item => item.kinds?.includes("bank")), `banka yazımı overview.changed (${JSON.stringify(seen)})`);
      assert.ok(seen.some(item => item.kinds?.includes("invoices")), `fatura yazımı overview.changed (C10) (${JSON.stringify(seen)})`);
    } finally {
      stop();
    }
    await integrityOk(api, "canlı yenileme");
  });

  it("R6: yetki — personel 403 (dosya sızmaz); muhasebe yalnız Banka grubu; Banka Raporları kaldırılınca 403; Finans Raporları rolü Banka grubunu görmez", async () => {
    const personel = apiOf(await createUser(ctx.server, api.client, { username: "rapor-personel", role: "personel" }));
    assert.equal((await personel.get(RC)).status, 403, "personel katalog");
    for (const id of BANK_REPORTS) {
      for (const format of ["", "pdf", "xlsx"]) {
        const res = await personel.raw("GET", `${RC}/${id}${format ? `/${format}` : ""}?preset=all`);
        assert.equal(res.status, 403, `personel ${id} ${format}`);
        assert.ok(!res.buffer.toString("latin1").startsWith("%PDF") && res.buffer.subarray(0, 2).toString("latin1") !== "PK", `personel ${id} ${format}: dosya sızdı`);
      }
    }
    const accountant = apiOf(await createUser(ctx.server, api.client, { username: "rapor-muhasebe", role: "muhasebe" }));
    const catalog = await must("muhasebe katalog", accountant.get(RC));
    assert.deepEqual(catalog.reports.map(report => report.id), BANK_REPORTS, "muhasebe yalnız Banka grubu (Finans Raporları yok)");
    assert.equal((await accountant.get(`${RC}/banka-bakiye?preset=all`)).status, 200);
    assert.equal((await accountant.get(`${RC}/kasa-hareketleri`)).status, 403);
    const users = await must("kullanıcılar", api.get("/api/admin/users"));
    await must("yetki kaldır", api.client.patch(`/api/admin/users/${users.find(user => user.username === "rapor-muhasebe").id}`, { grants: { add: [], remove: ["bank.reports"] } }).then(unwrap));
    assert.equal((await accountant.get(RC)).status, 403, "Banka Raporları kaldırılınca katalog");
    for (const id of BANK_REPORTS) assert.equal((await accountant.raw("GET", `${RC}/${id}/xlsx?preset=all`)).status, 403, `muhasebe ${id}`);
    const role = await must("rol", api.post("/api/admin/roles", { name: "Finans Okuyucu", permissions: ["overview.view", "accounts.view"] }));
    const reader = apiOf(await createUser(ctx.server, api.client, { username: "rapor-finans", role: role.id }));
    const list = await must("finans katalog", reader.get(RC));
    assert.ok(!list.reports.some(report => report.group === "Banka"), "Finans Raporları rolü Banka grubunu görmez");
    assert.ok(!list.choices, "hesap seçenekleri dönmez");
    for (const id of BANK_REPORTS) assert.equal((await reader.get(`${RC}/${id}`)).status, 403, `finans ${id}`);
  });

  it("R4/R7: 002 boş — raporlar boş, ANLIK DURUM \"Banka Hesabı Tanımlanmadı\"; ?hofCompany= ile 001'in hesabı 404; 001'in verisi 002'de görünmez", async () => {
    const second = await must("002", api.post("/api/companies", { name: "Boş Şirket", select: false }));
    const id = second.id || second.company?.id;
    const q = `hofCompany=${encodeURIComponent(id)}`;
    for (const report of BANK_REPORTS) {
      const res = await api.get(`${RC}/${report}?preset=all&${q}`);
      assert.equal(res.status, 200, `002 ${report}`);
      assert.equal(res.data.rows.filter(row => !row.includes("Devir")).length, 0, `002 ${report} boş`);
    }
    const bakiye = await must("002 bakiye", api.get(`${RC}/banka-bakiye?preset=all&${q}`));
    assert.equal(bakiye.summary.find(([key]) => key === K10.realBank)[1], "Banka Hesabı Tanımlanmadı");
    expectStatus(await api.get(`${RC}/banka-hareket?preset=all&bankAccount=${acc.Z.id}&${q}`), 404, "bank-account-missing", "002'den 001'in hesabı");
    expectStatus(await api.get(`${RC}/banka-masraf?preset=all&feeAccount=${acc.Z.id}&${q}`), 404, "bank-account-missing", "002'den 001'in hesabı (masraf)");
    const overview = await must("002 ANLIK DURUM", api.get(`/api/workspace/overview?${q}`));
    assert.equal(overview.cash.bank.defined, false);
    assert.equal(overview.cash.bank.balance, 0);
    const catalog = await must("002 katalog", api.get(`${RC}?${q}`));
    assert.deepEqual(catalog.choices.bankAccount.map(([value]) => value), ["", "unassigned"], "002'de 001'in hesapları seçenek değil");
    // 001 değişmedi.
    const own = await must("001", api.get(`${RC}/banka-bakiye?preset=all`));
    assert.equal(summaryOf(own, K10.realBank), closing(REAL));
  });

  it("son: mutabakat tutarlı; denenen birleşim sayısı", async () => {
    await integrityOk(api, "son");
    console.log(`[banka-210-raporlar] ekran birleşimi ${stats.combos}, TOPLAM kolonu ${stats.footer}, PDF/Excel dosyası ${stats.files}`);
    assert.ok(stats.combos >= 230 && stats.files >= 100, JSON.stringify(stats));
  });
});
