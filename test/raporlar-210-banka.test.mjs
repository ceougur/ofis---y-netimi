// 2.1.0 — Mevcut Rapor Merkezi raporları BANKALI (hesaba bağlı) veriyle: her rapor × her süzgeç seçeneği × (ekran JSON, PDF, Excel), BAĞIMSIZ
// beklenenle (plan §12.3 Aşama 14 "Nasıl Bozarım: her süzgeç × ekran/PDF/Excel (raporlar-224 kalıbı)"; eşleme R bölümü: "27 rapor hiç").
//
// Veri gerçek API'den, gerçek iş akışıyla: iki banka hesabı (Ziraat 100.000 · Garanti 50.000, açılış + Bakiye Doğrulandı) ve HER modülde
// hesaba bağlı havale/EFT — cari tahsilat ve ödeme, fatura peşini (satış, alış, SMM stopajlı), satıştan iade (bankaya geri ödeme), taksit
// tahsilatı, kayıt (detay kartı) tahsilatı, stok peşin satış ve alış, çek bankaya tahsil, verilen çek ödemesi, Kasadan Bankaya ve Bankadan
// Kasaya, bankalar arası transfer, Banka Fişi KDV'li masraf (gider faturası) — ve nakit, POS, çek/senet, taksit karışık.
// Beklenen sayılar programdan BAĞIMSIZ tutulan defterden (E) düz toplamlarla hesaplanır; rapor yanıtının gövdesi okunmadan hiçbir denetim geçmez.
// Tarihler bugüne göre (CLAUDE.md: senaryolar tarihe bağlı yazılmaz). Raporlar: raporlar-224'ün 43 raporundan para içerenler (notlar, görevler,
// belgeler, tablo verisi ve işlem geçmişi hariç); ek olarak Kasa Dökümü PDF, Nakit Akış, Vade Takip, zil/takvim (dues).
// Nasıl bozarım: boş dönem, tek kayıt (ayrı şirket), geçmiş/ileri tarih, ileri tarihli hareket denemesi (400; rapor değişmez), yetkisiz kullanıcı
// (ekran/PDF/Excel 403, dosya sızmaz), ?hofCompany= (yetkisiz şirket 403; şirketler birbirine sızmaz), geçersiz tarih/aralık 400.
// "Banka ve POS Hareketleri" (Aşama 14, plan §3.4 / K10 ile kesinleşti): şirketin kendi hesapları arasındaki para — Kasa ↔ Banka'nın banka
// bacağı ve bankalar arası transferin iki bacağı — satır olarak görünür, bakiyeye girer, ama Dönem Giriş/Çıkış'a SAYILMAZ; özetteki
// "Transfer Giriş / Çıkış" satırlarındadır (yalnız dönemde iç hareket varsa). Defterde bu satırlar `internal`.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";
import { pdfText, xlsxSheets } from "./banka-210-ortak.mjs";

const xlsxRows = buffer => Object.values(xlsxSheets(buffer))[0] || [];
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });
const r2 = value => Math.round((value + Number.EPSILON) * 100) / 100;
const sum = (list, pick = x => x) => r2(list.reduce((total, item) => total + pick(item), 0));
const moneyOf = cell => {
  const match = /^(-|−)?((?:\d{1,3}(?:\.\d{3})*|\d+)),(\d{2}) TL$/.exec(String(cell ?? "").trim());
  return match ? Number(`${match[1] ? "-" : ""}${match[2].replace(/\./g, "")}.${match[3]}`) : null;
};
const numberOf = cell => {
  const raw = String(cell ?? "").trim();
  return /^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/.test(raw) ? Number(raw.replace(/\./g, "").replace(",", ".")) : null;
};
const pad = value => String(value).padStart(2, "0");
const iso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const TODAY = iso(new Date());
const dayShift = (base, days) => {
  const [y, m, d] = base.split("-").map(Number);
  return iso(new Date(y, m - 1, d + days));
};
const ago = days => dayShift(TODAY, -days);
const ahead = days => dayShift(TODAY, days);
const addMonths = (day, months) => {
  const [y, m, d] = day.split("-").map(Number);
  const last = new Date(y, m - 1 + months + 1, 0).getDate();
  return iso(new Date(y, m - 1 + months, Math.min(d, last)));
};
function presetOf(name) {
  const [y, m] = TODAY.split("-").map(Number);
  const monthEnd = (year, month) => iso(new Date(year, month, 0));
  switch (name) {
    case "all": return { from: `${y - 50}-01-01`, to: TODAY };
    case "thisMonth": return { from: `${y}-${pad(m)}-01`, to: monthEnd(y, m) };
    case "lastMonth": return m === 1 ? { from: `${y - 1}-12-01`, to: `${y - 1}-12-31` } : { from: `${y}-${pad(m - 1)}-01`, to: monthEnd(y, m - 1) };
    case "thisYear": return { from: `${y}-01-01`, to: `${y}-12-31` };
    case "last30": return { from: ago(30), to: TODAY };
    case "next30": return { from: TODAY, to: ahead(30) };
    case "next90": return { from: TODAY, to: ahead(90) };
    default: return null;
  }
}
const RANGES = [
  { label: "varsayılan", q: {} },
  ...["all", "thisYear", "thisMonth", "lastMonth", "last30", "next30", "next90"].map(preset => ({ label: preset, q: { preset }, range: presetOf(preset) })),
  { label: "orta (240–100 gün önce)", q: { from: ago(240), to: ago(100) }, range: { from: ago(240), to: ago(100) } },
  { label: "boş dönem (2001 Ocak)", q: { from: "2001-01-01", to: "2001-01-31" }, range: { from: "2001-01-01", to: "2001-01-31" }, empty: true },
  { label: "yalnız ileri tarih", q: { from: ahead(1), to: ahead(120) }, range: { from: ahead(1), to: ahead(120) } },
];
const within = (day, range) => !range || ((!range.from || day >= range.from) && (!range.to || day <= range.to));
const before_ = (day, range) => Boolean(range?.from) && day < range.from;
const NO_SUM = new Set(["Bakiye", "Gün Sonu Kasa", "Ay Başı Kasa", "Ay Sonu Kasa", "Birim Fiyat", "KDV %", "Stopaj %", "Kritik Seviye"]);

// Banka bağlı veriyle denenen raporlar (raporlar-224'ün para içeren 38 raporu).
const REPORT_IDS = ["kasa-hareketleri", "kasa-gunluk", "kasa-kaynak", "kasa-aylik", "hesap-mizani", "yevmiye", "defter-mutabakati", "mutabakat-gunlugu", "banka-pos-hareketleri", "mizan", "cari-listesi", "cari-ekstre", "cari-hareketleri", "cari-tahsilat", "alacak-yaslandirma", "fatura-satis", "fatura-alis", "fatura-iade", "kdv-ozeti", "ba-bs", "urun-satis-karlilik", "cari-satis-alis", "gider-raporu", "stopaj-tevkifat", "acik-faturalar", "taksit-kartlari", "taksit-vadeleri", "geciken-taksitler", "taksit-performans", "taksit-tahsilatlari", "cek-portfoy", "cek-hareketleri", "cek-vade-dagilimi", "stok-durumu", "stok-hareketleri", "stok-ozet", "stok-kategori", "kayit-tahsilatlari"];

describe("2.1.0 Rapor Merkezi BANKALI veriyle: bütün para raporları × bütün süzgeçler × ekran/PDF/Excel, bağımsız beklenenle", () => {
  let server;
  let admin;
  let api;
  let catalog;
  let bank;
  const ids = {};
  // ---------- BAĞIMSIZ DEFTER ----------
  const E = {
    cash: [], // { d, amt } nakit Kasa
    bank: [], // { d, amt, acc: 'Z'|'G', adjust?, transfer?, internal? } havale/EFT (adjust = hesap açılışı; transfer = bankalar arası bacak;
    // internal = iç hareket: bankalar arası bacak ve Kasa ↔ Banka'nın banka bacağı)
    card: [], // POS
    cari: [], // { d, acc, debit, credit, tag }
    inv: [], // { d, kind, acc, net, vat, pay, stoppage, cancelled, expense }
    stock: [], // { d, code, qty }
    cheques: [], // { dir, serial, amount, received, due, status, acc, events: [dates] }
    planIn: [], // { d, amt, acc }
    plans: [], // { acc, total, paid, items: [{ due, amount }] }
    payments: [], // { d, amt } kayıt tahsilatları
  };
  const accName = {};
  const accType = {};
  const vatOf = lines => r2(lines.reduce((t, l) => t + r2((l.qty * l.unitPrice * l.vatRate) / 100), 0));
  const netOf = lines => r2(lines.reduce((t, l) => t + l.qty * l.unitPrice, 0));
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 400)}`);
    return res.data;
  };

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    api = {
      get: async url => unwrap(await admin.get(url)),
      post: async (url, body) => unwrap(await admin.post(url, body)),
      put: async (url, body) => unwrap(await admin.put(url, body)),
    };
    // 1) 340 gün önce: iki banka hesabı (açılış + Bakiye Doğrulandı).
    const open = (bankName, amount) => must(bankName, api.post("/api/workspace/bank/accounts", { bankName, name: "Ana TL Hesabı", kind: "demand", currency: "TRY", opening: { date: ago(340), amount, confirmed: true } }));
    bank = { Z: await open("Ziraat Bankası", "100.000"), G: await open("Garanti BBVA", "50.000") };
    E.bank.push({ d: ago(340), amt: 100000, acc: "Z", adjust: true }, { d: ago(340), amt: 50000, acc: "G", adjust: true });
    const item = async (code, name, kind, price) => (ids[code] = (await must(code, api.post("/api/workspace/stock", { kind, code, name, unit: "Adet", salePrice: String(price) }))).id);
    await item("KLM", "Kalem", "goods", 100);
    await item("DFT", "Defter", "goods", 40);
    await item("HZM", "Danışmanlık", "service", 1000);
    const account = async (key, name, type, phone) => {
      ids[key] = (await must(name, api.post("/api/workspace/accounts", { name, type, registeredOn: ago(400), phone }))).id;
      accName[key] = name;
      accType[key] = type;
    };
    await account("A", "Ayşe Yılmaz", "customer", "0500 000 00 01");
    await account("B", "Bora Ticaret", "customer", "0500 000 00 02");
    await account("C", "Cem Kaya", "customer", "0500 000 00 03");
    await account("S", "Tedarik AŞ", "supplier", "0500 000 00 04");
    await account("D", "Deniz Danışmanlık", "customer", "0500 000 00 05");
    await account("X", "Ziraat Bankası A.Ş.", "supplier", "0500 000 00 06");
    const BK = key => bank[key].id;

    const invoice = async (label, { d, scenario, kind, acc, lines, payment = {}, number, codes, original, stoppageRate }) => {
      const body = { issueDate: d, lines: lines.map(l => (l.originLineId ? { originLineId: l.originLineId, qty: l.qty } : l.itemId || l.expenseCode ? { itemId: l.itemId, name: l.name, expenseCode: l.expenseCode, qty: l.qty, unitPrice: l.unitPrice, vatRate: l.vatRate } : l)), payment: { ...payment, cash: (payment.cash || []).map(({ acc: bankKey, ...c }) => (bankKey ? { ...c, bankAccountId: BK(bankKey) } : c)) } };
      if (scenario) body.scenario = scenario;
      if (kind) body.kind = kind;
      if (original) body.originalId = original;
      if (acc && !original) body.accountId = ids[acc];
      if (number) body.number = number;
      if (stoppageRate) body.stoppageRate = stoppageRate;
      const doc = await must(label, api.post("/api/workspace/invoices", body));
      const k = kind || (scenario === "smm" ? "smm" : scenario.endsWith("purchase") ? "purchase" : "sale");
      const net = netOf(lines);
      const vat = vatOf(lines);
      const stoppage = r2((net * (stoppageRate || 0)) / 100);
      const pay = r2(net + vat - stoppage);
      E.inv.push({ d, kind: k, acc, net, vat, pay, stoppage, id: doc.id, cancelled: false, expense: scenario === "expense_purchase" });
      const sale = k === "sale" || k === "smm";
      E.cari.push(sale ? { d, acc, debit: pay, credit: 0, tag: "invoice" } : { d, acc, debit: 0, credit: pay, tag: k === "sale_return" ? "return" : "invoice" });
      (codes || []).forEach(([code, qty]) => E.stock.push({ d, code, qty }));
      for (const c of payment.cash || []) {
        // Satış/SMM: tahsilat (giriş); alış: ödeme (çıkış); satıştan iade: müşteriye geri ödeme (çıkış).
        const inflow = sale;
        const signed = inflow ? c.amount : -c.amount;
        if (c.method === "cash") E.cash.push({ d, amt: signed });
        else if (c.method === "bank") E.bank.push({ d, amt: signed, acc: c.acc });
        else E.card.push({ d, amt: signed });
        E.cari.push(inflow ? { d, acc, debit: 0, credit: c.amount, tag: "collect" } : { d, acc, debit: c.amount, credit: 0, tag: "pay" });
      }
      for (const c of payment.cheques || []) {
        E.cheques.push({ dir: sale ? "in" : "out", serial: c.serialNo, amount: c.amount, received: d, due: c.dueDate, status: sale ? "portfolio" : "pending", acc, events: [d] });
        E.cari.push(sale ? { d, acc, debit: 0, credit: c.amount, tag: "cheque" } : { d, acc, debit: c.amount, credit: 0, tag: "cheque" });
      }
      return doc;
    };

    // 2) 320: Kasa'ya elle açılış nakdi.
    await must("açılış nakdi", api.post("/api/workspace/cash", { kind: "in", amount: "1000", date: ago(320), description: "Açılış nakdi", method: "cash" }));
    E.cash.push({ d: ago(320), amt: 1000 });
    // 3) 310: Cem'e açık hizmet satışı (%20) — 120 açık.
    await invoice("S0", { d: ago(310), scenario: "service_sale", acc: "C", lines: [{ itemId: ids.HZM, qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open", dueDate: ago(280) } });
    // 4) 290: tedarikçiden mal alışı (%20 + %10), 2.000 havale peşin ZİRAAT, kalanı açık.
    await invoice("TA-1", { d: ago(290), scenario: "goods_purchase", acc: "S", number: "TA-1", lines: [{ itemId: ids.KLM, qty: 100, unitPrice: 50, vatRate: 20 }, { itemId: ids.DFT, qty: 50, unitPrice: 20, vatRate: 10 }], codes: [["KLM", 100], ["DFT", 50]], payment: { cash: [{ amount: 2000, method: "bank", acc: "Z" }], rest: "open", dueDate: ago(260) } });
    // 5) 260: Ayşe'ye stok + hizmet satışı, 800 nakit peşin.
    ids.s2 = (await invoice("S2", { d: ago(260), scenario: "goods_sale", acc: "A", lines: [{ itemId: ids.KLM, qty: 10, unitPrice: 100, vatRate: 20 }, { itemId: ids.HZM, qty: 1, unitPrice: 500, vatRate: 20 }], codes: [["KLM", -10]], payment: { cash: [{ amount: 800, method: "cash" }], rest: "open", dueDate: ago(230) } })).id;
    // 6) 230: Bora'ya satış (%10 + %1): 900 POS, 1.000 çek, kalan 1.000 iki taksit.
    const s3 = await invoice("S3", { d: ago(230), scenario: "goods_sale", acc: "B", lines: [{ itemId: ids.DFT, qty: 20, unitPrice: 40, vatRate: 10 }, { itemId: ids.HZM, qty: 2, unitPrice: 1000, vatRate: 1 }], codes: [["DFT", -20]], payment: { cash: [{ amount: 900, method: "card" }], cheques: [{ instrument: "cheque", amount: 1000, dueDate: ago(100), serialNo: "CK-1", bank: "Ziraat" }], rest: "installments", installments: { count: 2, firstDue: ago(200) } } });
    E.plans.push({ acc: "B", total: 1000, items: [{ due: ago(200), amount: 500 }, { due: addMonths(ago(200), 1), amount: 500 }] });
    // 7) 200: Cem'e hizmet satışı, tamamı ileri vadeli senetle.
    await invoice("S4", { d: ago(200), scenario: "service_sale", acc: "C", lines: [{ itemId: ids.HZM, qty: 1, unitPrice: 3000, vatRate: 20 }], payment: { cheques: [{ instrument: "note", amount: 3600, dueDate: ahead(80), serialNo: "SN-1" }] } });
    // 8) 190: Ayşe'ye satış, sonra İPTAL (hiçbir rapora girmemeli).
    const s5 = await invoice("S5 (iptal)", { d: ago(190), scenario: "goods_sale", acc: "A", lines: [{ itemId: ids.KLM, qty: 5, unitPrice: 100, vatRate: 20 }], codes: [["KLM", -5]], payment: { rest: "open", dueDate: ago(160) } });
    await must("iptal", api.post(`/api/workspace/invoices/${s5.id}/cancel`, { reason: "yanlış fatura" }));
    E.inv.find(row => row.id === s5.id).cancelled = true;
    E.cari.splice(E.cari.findIndex(row => row.d === ago(190) && row.acc === "A"), 1);
    E.stock.splice(E.stock.findIndex(row => row.d === ago(190)), 1);
    // 9) 170: Ayşe 2 Kalem iade eder (cariden mahsup).
    const s2d = await must("s2", api.get(`/api/workspace/invoices/${ids.s2}`));
    await invoice("İade", { d: ago(170), kind: "sale_return", acc: "A", original: ids.s2, lines: [{ originLineId: s2d.lines[0].id, qty: 2, unitPrice: 100, vatRate: 20 }], codes: [["KLM", 2]] });
    // 10) 160: Ayşe'den cari kartından 500 havale GARANTİ.
    await must("cari tahsilat", api.post(`/api/workspace/accounts/${ids.A}/entries`, { kind: "in", amount: "500", date: ago(160), method: "bank", bankAccountId: BK("G") }));
    E.bank.push({ d: ago(160), amt: 500, acc: "G" });
    E.cari.push({ d: ago(160), acc: "A", debit: 0, credit: 500, tag: "collect" });
    // 11) 150: Bora'nın taksitinden 500 havale ZİRAAT.
    const s3d = await must("s3", api.get(`/api/workspace/invoices/${s3.id}`));
    await must("taksit tahsilatı", api.post(`/api/workspace/plans/${s3d.planId}/entries`, { kind: "in", amount: "500", date: ago(150), method: "bank", bankAccountId: BK("Z") }));
    E.bank.push({ d: ago(150), amt: 500, acc: "Z" });
    E.cari.push({ d: ago(150), acc: "B", debit: 0, credit: 500, tag: "plan" });
    E.planIn.push({ d: ago(150), amt: 500, acc: "B" });
    // 12) 100: çek bankaya tahsil GARANTİ.
    const ck = (await must("çekler", api.get("/api/workspace/cheques"))).cheques.find(row => row.serialNo === "CK-1");
    await must("çek tahsil", api.post(`/api/workspace/cheques/${ck.id}/actions`, { action: "collect", date: ago(100), method: "bank", bankAccountId: BK("G") }));
    E.bank.push({ d: ago(100), amt: 1000, acc: "G" });
    Object.assign(E.cheques.find(row => row.serial === "CK-1"), { status: "collected" });
    E.cheques.find(row => row.serial === "CK-1").events.push(ago(100));
    // 13) 90: Kasadan Bankaya 300 (ZİRAAT); 85: Bankadan Kasaya 200 (GARANTİ).
    await must("kasadan bankaya", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "300", date: ago(90), description: "Bankaya yatırma", bankAccountId: BK("Z") }));
    E.cash.push({ d: ago(90), amt: -300 });
    E.bank.push({ d: ago(90), amt: 300, acc: "Z", internal: true });
    await must("bankadan kasaya", api.post("/api/workspace/cash/transfer", { direction: "to-cash", amount: "200", date: ago(85), description: "Bankadan çekim", bankAccountId: BK("G") }));
    E.cash.push({ d: ago(85), amt: 200 });
    E.bank.push({ d: ago(85), amt: -200, acc: "G", internal: true });
    // 14) 80: Bankalar arası transfer Ziraat → Garanti 5.000 (ücret yok).
    await must("transfer", api.post("/api/workspace/bank/transfers", { accountId: BK("Z"), toAccountId: BK("G"), amount: "5.000", date: ago(80), channel: "virman", description: "Garanti'ye aktarım" }));
    E.bank.push({ d: ago(80), amt: -5000, acc: "Z", transfer: true, internal: true }, { d: ago(80), amt: 5000, acc: "G", transfer: true, internal: true });
    // 15) 70: Ayşe'nin mevcut borcunun 150'si 3 taksitli karta; 60 gün önce 100 nakit.
    const firstDue = ago(40);
    const cover = await must("mevcut borç kartı", api.post("/api/workspace/plans", { name: accName.A, registeredOn: ago(70), total: "150", accountId: ids.A, mode: "auto", count: "3", firstDue, coversBalance: true }));
    E.plans.push({ acc: "A", total: 150, items: [0, 1, 2].map(i => ({ due: addMonths(firstDue, i), amount: 50 })) });
    await must("kart tahsilatı", api.post(`/api/workspace/plans/${cover.id}/entries`, { kind: "in", amount: "100", date: ago(60), method: "cash" }));
    E.cash.push({ d: ago(60), amt: 100 });
    E.cari.push({ d: ago(60), acc: "A", debit: 0, credit: 100, tag: "plan" });
    E.planIn.push({ d: ago(60), amt: 100, acc: "A" });
    // 16) 65: kayıt (detay kartı) tahsilatı 700 havale GARANTİ; 62: 300 nakit.
    await must("kayıt tahsilatı havale", api.post("/api/workspace/cases/DOSYA-1/payments", { amount: "700", date: ago(65), method: "bank", bankAccountId: BK("G"), caseTitle: "Dosya 1" }));
    E.bank.push({ d: ago(65), amt: 700, acc: "G" });
    E.payments.push({ d: ago(65), amt: 700 });
    await must("kayıt tahsilatı nakit", api.post("/api/workspace/cases/DOSYA-2/payments", { amount: "300", date: ago(62), method: "cash", caseTitle: "Dosya 2" }));
    E.cash.push({ d: ago(62), amt: 300 });
    E.payments.push({ d: ago(62), amt: 300 });
    // 17) 55: stok peşin satış 5 Kalem × 120 havale ZİRAAT; 52: stok peşin alım 10 Defter × 15 havale GARANTİ.
    await must("stok satışı", api.post(`/api/workspace/stock/${ids.KLM}/moves`, { kind: "out", qty: "5", unitPrice: "120", pay: "cash", method: "bank", bankAccountId: BK("Z"), date: ago(55) }));
    E.stock.push({ d: ago(55), code: "KLM", qty: -5 });
    E.bank.push({ d: ago(55), amt: 600, acc: "Z" });
    await must("stok alımı", api.post(`/api/workspace/stock/${ids.DFT}/moves`, { kind: "in", qty: "10", unitPrice: "15", pay: "cash", method: "bank", bankAccountId: BK("G"), date: ago(52) }));
    E.stock.push({ d: ago(52), code: "DFT", qty: 10 });
    E.bank.push({ d: ago(52), amt: -150, acc: "G" });
    // 18) 50: kira gideri faturası (%20), havale peşin ZİRAAT.
    await invoice("TA-2", { d: ago(50), scenario: "expense_purchase", acc: "S", number: "TA-2", lines: [{ name: "Ofis Kirası", expenseCode: "rent", qty: 1, unitPrice: 2000, vatRate: 20 }], payment: { cash: [{ amount: 2400, method: "bank", acc: "Z" }] } });
    // 19) 45: Banka Fişi — KDV'li masraf 120 (KDV Dahil %20, faturalı) ZİRAAT: gider faturası 100 + KDV 20, cari X (alacak 120, ödeme 120).
    await must("KDV'li masraf", api.post("/api/workspace/bank/vouchers", { type: "fee", accountId: BK("Z"), date: ago(45), amount: "120", feeType: "eft", tax: "vat_incl", taxRate: "20", partyId: ids.X, invoiceNo: "ZB-2026-0001", description: "EFT ücreti faturası" }));
    E.bank.push({ d: ago(45), amt: -120, acc: "Z" });
    E.inv.push({ d: ago(45), kind: "purchase", acc: "X", net: 100, vat: 20, pay: 120, stoppage: 0, cancelled: false, expense: true, fee: true });
    E.cari.push({ d: ago(45), acc: "X", debit: 0, credit: 120, tag: "invoice" }, { d: ago(45), acc: "X", debit: 120, credit: 0, tag: "pay" });
    // 20) 40: Kasa'dan elle kırtasiye gideri.
    await must("kırtasiye", api.post("/api/workspace/cash", { kind: "out", amount: "50", date: ago(40), description: "Kırtasiye", method: "cash" }));
    E.cash.push({ d: ago(40), amt: -50 });
    // 21) 35: SMM (stopaj %20) Deniz: brüt 1.000, KDV 200, stopaj 200 → ödenecek 1.000, havale ZİRAAT peşin.
    await invoice("SMM", { d: ago(35), scenario: "smm", acc: "D", stoppageRate: 20, lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { cash: [{ amount: 1000, method: "bank", acc: "Z" }], rest: "open" } });
    // 22) 30: Cem'e hizmet satışı 1.200 peşin havale GARANTİ; 25: tamamı iade, 1.200 GARANTİ'den geri ödeme.
    const s6 = await invoice("S6", { d: ago(30), scenario: "service_sale", acc: "C", lines: [{ itemId: ids.HZM, qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { cash: [{ amount: 1200, method: "bank", acc: "G" }], rest: "open" } });
    const s6d = await must("s6", api.get(`/api/workspace/invoices/${s6.id}`));
    await must("iade", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: s6.id, issueDate: ago(25), lines: [{ originLineId: s6d.lines[0].id, qty: 1 }], payment: { cash: [{ amount: 1200, method: "bank", bankAccountId: BK("G") }], rest: "open" } }));
    E.inv.push({ d: ago(25), kind: "sale_return", acc: "C", net: 1000, vat: 200, pay: 1200, stoppage: 0, cancelled: false });
    E.cari.push({ d: ago(25), acc: "C", debit: 0, credit: 1200, tag: "return" }, { d: ago(25), acc: "C", debit: 1200, credit: 0, tag: "pay" });
    E.bank.push({ d: ago(25), amt: -1200, acc: "G" });
    // 23) 20: mal alışı, ileri vadeli VERİLEN çekle (VC-1).
    await invoice("TA-3", { d: ago(20), scenario: "goods_purchase", acc: "S", number: "TA-3", lines: [{ itemId: ids.KLM, qty: 10, unitPrice: 50, vatRate: 20 }], codes: [["KLM", 10]], payment: { cheques: [{ instrument: "cheque", amount: 600, dueDate: ahead(70), serialNo: "VC-1", bank: "Halk" }] } });
    // 24) 15: tedarikçiye verilen çek VC-2 400 (vade 5 gün önce); 5: çek ödemesi havale ZİRAAT.
    const vc2 = await must("verilen çek", api.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", amount: "400", issueDate: ago(15), dueDate: ago(5), accountId: ids.S, serialNo: "VC-2" }));
    E.cheques.push({ dir: "out", serial: "VC-2", amount: 400, received: ago(15), due: ago(5), status: "pending", acc: "S", events: [ago(15)] });
    E.cari.push({ d: ago(15), acc: "S", debit: 400, credit: 0, tag: "cheque" });
    await must("çek ödemesi", api.post(`/api/workspace/cheques/${vc2.id}/actions`, { action: "pay", date: ago(5), method: "bank", bankAccountId: BK("Z") }));
    E.bank.push({ d: ago(5), amt: -400, acc: "Z" });
    Object.assign(E.cheques.find(row => row.serial === "VC-2"), { status: "paid" });
    E.cheques.find(row => row.serial === "VC-2").events.push(ago(5));
    // Ödenen taksitler (FIFO).
    for (const plan of E.plans) {
      let left = sum(E.planIn.filter(p => p.acc === plan.acc), p => p.amt);
      plan.paid = left;
      for (const it of plan.items) {
        it.paid = Math.min(it.amount, left);
        left = r2(left - it.paid);
        it.remaining = r2(it.amount - it.paid);
      }
    }
    catalog = (await must("katalog", api.get("/api/workspace/report-center"))).reports;
  });
  after(async () => server?.close());

  // ---------- Bağımsız beklenen hesaplar ----------
  const balanceOf = (acc, range) => sum(E.cari.filter(r => r.acc === acc && (!range?.to || r.d <= range.to)), r => r.debit - r.credit);
  const allBalance = acc => balanceOf(acc, null);
  const live = () => E.inv.filter(r => !r.cancelled);
  const KEYS = ["A", "B", "C", "S", "D", "X"];
  const movement = (list, range) => ({
    opening: sum(list.filter(r => before_(r.d, range)), r => r.amt),
    in: sum(list.filter(r => within(r.d, range) && r.amt > 0 && !r.adjust), r => r.amt),
    out: sum(list.filter(r => within(r.d, range) && r.amt < 0 && !r.adjust), r => -r.amt),
    adjust: sum(list.filter(r => within(r.d, range) && r.adjust), r => r.amt),
  });
  const get = async (id, q = {}, format = "") => {
    const qs = new URLSearchParams(q).toString();
    const url = `/api/workspace/report-center/${id}${format ? `/${format}` : ""}${qs ? `?${qs}` : ""}`;
    return format ? admin.raw("GET", url) : unwrap(await admin.get(url));
  };
  const col = (data, header) => data.headers.indexOf(header);
  const summaryOf = (data, label) => {
    const hit = data.summary.find(([name]) => name === label);
    assert.ok(hit, `${data.id}: özette "${label}" yok: ${JSON.stringify(data.summary)}`);
    return moneyOf(hit[1]) ?? numberOf(hit[1]) ?? hit[1];
  };
  const isDevir = row => row.some(cell => cell === "Devir");

  function checkFooter(data, tag) {
    const rows = data.rows;
    if (data.total > rows.length) {
      assert.equal(rows.length, 200, `${tag}: ön izleme 200 satır`);
      return 0;
    }
    assert.equal(rows.length, data.total, `${tag}: bütün satırlar ön izlemede`);
    for (const row of rows) assert.equal(row.length, data.headers.length, `${tag}: satır kolon sayısı başlıkla aynı`);
    if (!data.footer) return 0;
    assert.equal(data.footer.length, data.headers.length, `${tag}: TOPLAM kolon sayısı`);
    assert.ok(data.footer.includes("TOPLAM"), `${tag}: TOPLAM etiketi`);
    let checked = 0;
    data.headers.forEach((header, index) => {
      const type = data.types[index];
      if (type !== "money" && type !== "number") return;
      const cell = data.footer[index];
      if (header === "Bakiye" && data.headers.includes("Durum") && cell) {
        const durum = col(data, "Durum");
        const net = sum(rows, row => (moneyOf(row[index]) || 0) * (row[durum] === "Alacaklı" ? -1 : 1));
        assert.equal(moneyOf(cell), Math.abs(net), `${tag}: TOPLAM Bakiye = net bakiye`);
        checked += 1;
        return;
      }
      if (NO_SUM.has(header)) {
        assert.equal(cell, "", `${tag}: "${header}" toplanmaz`);
        return;
      }
      const values = rows.map(row => (type === "money" ? moneyOf(row[index]) : numberOf(row[index]))).filter(v => v !== null);
      if (!values.length) return;
      const expected = sum(values);
      const actual = type === "money" ? moneyOf(cell) : numberOf(cell);
      if (actual === null && type === "number" && data.headers.includes("Birim") && new Set(rows.map(r => r[col(data, "Birim")]).filter(Boolean)).size > 1) return;
      assert.equal(actual, expected, `${tag}: TOPLAM "${header}" ${cell} ≠ satır toplamı ${expected}`);
      checked += 1;
    });
    return checked;
  }
  async function checkExports(id, q, data, tag) {
    const pdf = await get(id, q, "pdf");
    assert.equal(pdf.status, 200, `${tag} PDF: ${pdf.status}`);
    assert.equal(pdf.buffer.subarray(0, 5).toString("latin1"), "%PDF-", `${tag}: PDF imzası`);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    assert.ok(text.includes(data.title), `${tag} PDF: başlık`);
    for (const row of data.rows) for (const cell of row) if (moneyOf(cell) !== null) assert.ok(text.includes(String(cell).trim()), `${tag} PDF: "${cell}" yok`);
    if (data.footer) for (const cell of data.footer) if (moneyOf(cell) !== null) assert.ok(text.includes(cell), `${tag} PDF: TOPLAM "${cell}" yok`);
    const xlsx = await get(id, q, "xlsx");
    assert.equal(xlsx.status, 200, `${tag} Excel: ${xlsx.status}`);
    const sheet = xlsxRows(xlsx.buffer);
    if (data.total > data.rows.length || !data.headers.length) return;
    assert.equal(sheet.length, 1 + data.rows.length + (data.footer ? 1 : 0), `${tag} Excel: satır sayısı`);
    const cellValue = cell => moneyOf(cell) ?? numberOf(cell);
    const same = (excel, screen, where) => {
      const expected = cellValue(screen);
      if (expected === null) return;
      const actual = typeof excel === "number" ? excel : cellValue(excel);
      assert.equal(actual, expected, `${tag} Excel ${where}: ${excel} ≠ ekrandaki ${screen}`);
    };
    data.rows.forEach((row, r) => row.forEach((cell, c) => same(sheet[r + 1]?.[c], cell, `satır ${r + 1} "${data.headers[c]}"`)));
    if (data.footer) data.footer.forEach((cell, c) => same(sheet.at(-1)?.[c], cell, `TOPLAM "${data.headers[c]}"`));
  }

  const OPTIONS = {
    type: ["", "customer", "supplier", "other"],
    side: ["", "debtor", "creditor", "nonzero", "zero", "overdue"],
    payMethod: ["noncash", "bank", "card"],
    direction: ["", "in", "out"],
    status: ["", "open", "overdue", "soon", "collected", "endorsed", "paid", "bounced", "portfolio", "pending"],
    state: ["", "low", "out", "negative", "product", "service"],
    category: ["", "Yok Böyle Kategori"],
    planStatus: ["active", "closed", "all"],
  };
  const combos = report => {
    let list = [{ q: {}, range: null, label: "" }];
    for (const param of report.params) {
      const next = [];
      for (const base of list) {
        if (param === "range") {
          for (const r of RANGES) next.push({ ...base, q: { ...base.q, ...r.q }, range: r.range ?? null, rangeLabel: r.label, empty: r.empty, label: `${base.label} dönem=${r.label}` });
        } else if (param === "account") {
          for (const key of report.accountRequired ? KEYS : ["", ...KEYS]) next.push({ ...base, q: key ? { ...base.q, account: ids[key] } : base.q, account: key, label: `${base.label} cari=${key || "tümü"}` });
        } else {
          for (const value of OPTIONS[param] || [""]) next.push({ ...base, q: value ? { ...base.q, [param]: value } : base.q, [param]: value, label: `${base.label} ${param}=${value || "—"}` });
        }
      }
      list = next;
    }
    return list;
  };
  const effective = (report, combo) => (combo.rangeLabel && combo.rangeLabel !== "varsayılan" ? combo.range : report.preset ? presetOf(report.preset) : null);

  const SPECIFIC = {
    "kasa-hareketleri"(data, c, range) {
      const m = movement(E.cash, range);
      assert.equal(summaryOf(data, "Devir"), m.opening, "Kasa devri");
      assert.equal(summaryOf(data, "Dönem Giriş"), m.in, "Kasa dönem girişi");
      assert.equal(summaryOf(data, "Dönem Çıkış"), m.out, "Kasa dönem çıkışı");
      assert.equal(summaryOf(data, "Güncel Kasa (tüm hareketler)"), sum(E.cash, r => r.amt), "Güncel Kasa (bankalı hareketler Kasa'ya girmez)");
      assert.equal(data.rows.filter(row => !isDevir(row)).length, E.cash.filter(r => within(r.d, range)).length, "Kasa satır sayısı (yalnız nakit)");
    },
    "kasa-gunluk"(data, c, range) {
      const m = movement(E.cash, range);
      assert.equal(summaryOf(data, "Dönem Giriş"), m.in);
      assert.equal(summaryOf(data, "Dönem Çıkış"), m.out);
      assert.equal(data.rows.length, new Set(E.cash.filter(r => within(r.d, range)).map(r => r.d)).size, "gün sayısı");
    },
    "kasa-kaynak"(data, c, range) {
      const m = movement(E.cash, range);
      assert.equal(summaryOf(data, "Toplam Giriş"), m.in);
      assert.equal(summaryOf(data, "Toplam Çıkış"), m.out);
      assert.equal(sum(data.rows, row => numberOf(row[col(data, "Hareket")])), E.cash.filter(r => within(r.d, range)).length, "kaynakların hareket sayısı toplamı = nakit hareket sayısı");
    },
    "kasa-aylik"(data, c, range) {
      const m = movement(E.cash, range);
      assert.equal(summaryOf(data, "Devir"), m.opening);
      assert.equal(summaryOf(data, "Toplam Giriş"), m.in);
      assert.equal(summaryOf(data, "Toplam Çıkış"), m.out);
      assert.equal(summaryOf(data, "Dönem Sonu Kasa"), r2(m.opening + m.in - m.out));
    },
    "banka-pos-hareketleri"(data, c, range) {
      const bankList = E.bank;
      const list = c.payMethod === "bank" ? bankList : c.payMethod === "card" ? E.card : [...bankList, ...E.card];
      const m = movement(list, range);
      assert.equal(summaryOf(data, "Devir"), m.opening, "banka devri (açılışlar dahil)");
      // İç hareket (Kasa ↔ Banka banka bacağı, bankalar arası transfer bacakları; ücretsiz): Dönem Giriş/Çıkış'a girmez, Transfer satırında.
      const legs = list.filter(r => r.internal && within(r.d, range));
      const legIn = sum(legs.filter(r => r.amt > 0), r => r.amt);
      const legOut = sum(legs.filter(r => r.amt < 0), r => -r.amt);
      assert.equal(summaryOf(data, "Dönem Giriş"), r2(m.in - legIn), "Dönem Giriş (iç hareket hariç)");
      assert.equal(summaryOf(data, "Dönem Çıkış"), r2(m.out - legOut), "Dönem Çıkış (iç hareket hariç)");
      assert.equal(summaryOf(data, "Dönem Net"), r2(m.in - legIn - (m.out - legOut)), "Dönem Net = Dönem Giriş − Dönem Çıkış");
      assert.equal(data.summary.some(([name]) => name === "Transfer Giriş"), legs.length > 0, "Transfer satırı yalnız dönemde iç hareket varsa");
      if (legs.length) {
        assert.equal(summaryOf(data, "Transfer Giriş"), legIn, "Transfer Giriş");
        assert.equal(summaryOf(data, "Transfer Çıkış"), legOut, "Transfer Çıkış");
      }
      if (m.adjust || data.summary.some(([name]) => name === "Açılış ve Devir Düzeltmeleri")) assert.equal(summaryOf(data, "Açılış ve Devir Düzeltmeleri"), m.adjust, "açılışlar giriş sayılmaz, ayrı satırda");
      assert.equal(summaryOf(data, "Dönem Sonu"), r2(m.opening + m.in - m.out + m.adjust), "Dönem Sonu");
      assert.equal(summaryOf(data, "Banka (tüm hareketler)"), sum(E.bank, r => r.amt), "Banka (tüm) = açılışlar + bütün bağlı hareketler = Gerçek Banka");
      assert.equal(summaryOf(data, "POS / Kredi Kartı (tüm hareketler)"), sum(E.card, r => r.amt));
      const yol = col(data, "Yol");
      const allowed = c.payMethod === "bank" ? ["Havale / EFT"] : c.payMethod === "card" ? ["POS", "Kredi Kartı"] : ["Havale / EFT", "POS", "Kredi Kartı"];
      const body = data.rows.filter(row => !isDevir(row));
      for (const row of body) assert.ok(allowed.includes(row[yol]) || row[yol] === "", `Yol süzgeci ${c.payMethod}: satır ${row[yol]}`);
      // İç hareket de satır olarak görünür (tutarı açıklamada, bakiyede).
      assert.equal(body.length, list.filter(r => within(r.d, range)).length, "banka satır sayısı (iç hareket satırları dahil)");
    },
    "hesap-mizani"(data, c, range) {
      assert.equal(summaryOf(data, "Fark"), 0, "Borç = Alacak");
      // (|| 0: −0 ile 0 katı eşitlikte ayrı sayılır.)
      const signed = code => {
        const row = data.rows.find(r => r[0] === code);
        return (row ? moneyOf(row[col(data, "Bakiye")]) * (row[col(data, "Yön")] === "Alacak" ? -1 : 1) : 0) || 0;
      };
      const toEnd = list => sum(list.filter(r => !range?.to || r.d <= range.to), r => r.amt) || 0;
      assert.equal(signed("100"), toEnd(E.cash), "100 Kasa");
      assert.equal(signed("102"), toEnd(E.bank), "102 Bankalar = açılışlar + bağlı hareketler (transfer net 0)");
      // 120 + 320 (cari) toplamı = carilerin net bakiyesi; 500 = −açılışlar.
      const openings = sum(E.bank.filter(r => r.adjust && (!range?.to || r.d <= range.to)), r => r.amt);
      assert.equal(signed("500"), r2(0 - openings) || 0, "500 Açılış = banka açılışları");
    },
    yevmiye(data, c, range) {
      const b = col(data, "Borç");
      const a = col(data, "Alacak");
      assert.equal(sum(data.rows, row => moneyOf(row[b]) || 0), sum(data.rows, row => moneyOf(row[a]) || 0), "yevmiye borç = alacak");
      // Hesap hesap: dönem içi 100 ve 102 hareketleri bağımsız defterle.
      const net = code => sum(data.rows.filter(row => String(row[col(data, "Hesap")]).split(/[ .]/)[0] === code), row => (moneyOf(row[b]) || 0) - (moneyOf(row[a]) || 0));
      const inRange = list => sum(list.filter(r => within(r.d, range)), r => r.amt);
      assert.equal(net("100"), inRange(E.cash), "Yevmiye 100 net");
      assert.equal(net("102"), inRange(E.bank), "Yevmiye 102 net (açılışlar dahil)");
    },
    "defter-mutabakati"(data) {
      assert.ok(data.rows.length > 5);
      for (const row of data.rows) assert.equal(row.at(-1), "Tutarlı", `mutabakat ${row[0]} ${row[1]}`);
      const bankRow = data.rows.find(row => row[0] === "102" || /^102/.test(row[0]));
      if (bankRow) assert.equal(moneyOf(bankRow[col(data, "Ana Defter")]), sum(E.bank, r => r.amt), "102 ana defter = bağımsız banka toplamı");
      const kasa = data.rows.find(row => row[0] === "100");
      if (kasa) assert.equal(moneyOf(kasa[col(data, "Ana Defter")]), sum(E.cash, r => r.amt), "100 ana defter = bağımsız Kasa");
    },
    "mutabakat-gunlugu"(data) {
      // Bütün işlemler kapıdan geçti: geri alınan (yazılmayan) işlem yok.
      assert.equal(summaryOf(data, "Geri Alınan"), 0, "geri alınan işlem yok");
      for (const row of data.rows) assert.notEqual(row[1], "Geri Alındı", `günlükte geri alınan: ${row.join(" | ")}`);
    },
    mizan(data, c, range) {
      const keys = KEYS.filter(k => !c.type || accType[k] === c.type);
      const name = col(data, "Cari");
      for (const key of keys) {
        const row = data.rows.find(r => r[name] === accName[key]);
        const closing = balanceOf(key, range);
        const sideOk = !c.side || (c.side === "debtor" ? closing > 0 : c.side === "creditor" ? closing < 0 : c.side === "zero" ? closing === 0 : c.side === "nonzero" ? closing !== 0 : true);
        if (!sideOk) {
          assert.equal(row, undefined, `mizan side=${c.side}: ${accName[key]} listelenmemeli`);
          continue;
        }
        if (!row) continue;
        const list = E.cari.filter(r => r.acc === key);
        assert.equal(moneyOf(row[col(data, "Devir")]), sum(list.filter(r => before_(r.d, range)), r => r.debit - r.credit), `mizan devir ${key}`);
        assert.equal(moneyOf(row[col(data, "Borç")]), sum(list.filter(r => within(r.d, range)), r => r.debit), `mizan borç ${key}`);
        assert.equal(moneyOf(row[col(data, "Alacak")]), sum(list.filter(r => within(r.d, range)), r => r.credit), `mizan alacak ${key}`);
        assert.equal(moneyOf(row[col(data, "Bakiye")]), Math.abs(closing), `mizan bakiye ${key}`);
      }
      for (const row of data.rows) assert.ok(keys.map(k => accName[k]).includes(row[name]), `mizan type=${c.type}: ${row[name]}`);
    },
    "cari-listesi"(data, c) {
      const overdueOf = key => sum(E.plans.filter(p => p.acc === key).flatMap(p => p.items).filter(it => it.due < TODAY), it => it.remaining);
      const keys = KEYS.filter(k => !c.type || accType[k] === c.type).filter(k => {
        const b = allBalance(k);
        return !c.side || (c.side === "debtor" ? b > 0 : c.side === "creditor" ? b < 0 : c.side === "zero" ? b === 0 : c.side === "nonzero" ? b !== 0 : overdueOf(k) > 0);
      });
      const name = col(data, "Cari");
      assert.deepEqual(data.rows.map(r => r[name]).sort(), keys.map(k => accName[k]).sort(), `cari listesi type=${c.type} side=${c.side}`);
      for (const key of keys) {
        const row = data.rows.find(r => r[name] === accName[key]);
        const list = E.cari.filter(r => r.acc === key);
        assert.equal(moneyOf(row[col(data, "Borç")]), sum(list, r => r.debit), `borç ${key}`);
        assert.equal(moneyOf(row[col(data, "Alacak")]), sum(list, r => r.credit), `alacak ${key}`);
        assert.equal(moneyOf(row[col(data, "Bakiye")]), Math.abs(allBalance(key)), `bakiye ${key}`);
        assert.equal(moneyOf(row[col(data, "Geciken")]) || 0, overdueOf(key), `geciken ${key}`);
      }
    },
    "cari-ekstre"(data, c, range) {
      const list = E.cari.filter(r => r.acc === c.account);
      assert.equal(summaryOf(data, "Devir"), sum(list.filter(r => before_(r.d, range)), r => r.debit - r.credit), "ekstre devir");
      assert.equal(summaryOf(data, "Dönem Borç"), sum(list.filter(r => within(r.d, range)), r => r.debit), "ekstre borç");
      assert.equal(summaryOf(data, "Dönem Alacak"), sum(list.filter(r => within(r.d, range)), r => r.credit), "ekstre alacak");
    },
    "cari-hareketleri"(data, c, range) {
      const list = E.cari.filter(r => within(r.d, range) && (!c.type || accType[r.acc] === c.type));
      assert.equal(summaryOf(data, "Toplam Borç"), sum(list, r => r.debit));
      assert.equal(summaryOf(data, "Toplam Alacak"), sum(list, r => r.credit));
    },
    "cari-tahsilat"(data, c, range) {
      const list = E.cari.filter(r => within(r.d, range) && ["collect", "plan", "cheque"].includes(r.tag) && r.credit > 0 && (!c.type || accType[r.acc] === c.type));
      assert.equal(summaryOf(data, "Toplam"), sum(list, r => r.credit), "tahsilat toplamı (havale/EFT dahil)");
      assert.equal(summaryOf(data, "Nakit / Havale"), sum(list.filter(r => r.tag === "collect"), r => r.credit), "nakit/havale");
      assert.equal(summaryOf(data, "Taksit Tahsilatı"), sum(list.filter(r => r.tag === "plan"), r => r.credit));
      assert.equal(summaryOf(data, "Çek / Senet (alınan)"), sum(list.filter(r => r.tag === "cheque"), r => r.credit));
    },
    "alacak-yaslandirma"(data) {
      const receivable = sum(KEYS.filter(k => accType[k] === "customer"), k => Math.max(0, allBalance(k)));
      const portfolio = sum(E.cheques.filter(ch => ch.dir === "in" && ch.status === "portfolio"), ch => ch.amount);
      assert.equal(moneyOf(data.footer[col(data, "Toplam")]), r2(receivable + portfolio), "yaşlandırma toplamı = müşteri bakiyeleri + portföy");
      assert.equal(r2(moneyOf(data.footer[col(data, "Toplam Gecikmiş")]) + moneyOf(data.footer[col(data, "Vadesi Gelmemiş")])), moneyOf(data.footer[col(data, "Toplam")]));
    },
    "fatura-satis"(data, c, range) {
      invoiceCheck(data, c, range, ["sale", "smm"], "Satış Faturası");
    },
    "fatura-alis"(data, c, range) {
      invoiceCheck(data, c, range, ["purchase"], "Alış Faturası");
    },
    "fatura-iade"(data, c, range) {
      invoiceCheck(data, c, range, ["sale_return"], "İade Faturası");
    },
    "kdv-ozeti"(data, c, range) {
      const list = live().filter(r => within(r.d, range));
      assert.equal(summaryOf(data, "Hesaplanan KDV (391)"), r2(sum(list.filter(r => ["sale", "smm"].includes(r.kind)), r => r.vat) - sum(list.filter(r => r.kind === "sale_return"), r => r.vat)));
      assert.equal(summaryOf(data, "İndirilecek KDV (191)"), sum(list.filter(r => r.kind === "purchase"), r => r.vat), "191 (KDV'li banka masrafı dahil)");
    },
    "ba-bs"(data, c, range) {
      // Bağımsız: ay × form × cari, KDV hariç toplam ≥ 5.000.
      const groups = new Map();
      for (const r of live().filter(row => within(row.d, range))) {
        const form = ["sale", "smm"].includes(r.kind) ? "Bs" : "Ba";
        const key = `${r.d.slice(0, 7)}|${form}|${r.acc}`;
        groups.set(key, r2((groups.get(key) || 0) + r.net));
      }
      const expected = [...groups.entries()].filter(([, net]) => net >= 5000);
      assert.equal(data.rows.length, expected.length, `Ba-Bs satır sayısı (${c.rangeLabel})`);
      assert.equal(summaryOf(data, "Form Ba Satırı"), expected.filter(([key]) => key.split("|")[1] === "Ba").length);
      assert.equal(summaryOf(data, "Form Bs Satırı"), expected.filter(([key]) => key.split("|")[1] === "Bs").length);
      for (const [key, net] of expected) {
        const [, form, acc] = key.split("|");
        const row = data.rows.find(r => r[col(data, "Form")] === form && r[col(data, "Cari")] === accName[acc]);
        assert.ok(row, `Ba-Bs ${form} ${accName[acc]}`);
        assert.equal(moneyOf(row[col(data, "Tutar (KDV Hariç)")]), net, `Ba-Bs ${form} ${accName[acc]} tutar`);
      }
    },
    "urun-satis-karlilik"(data, c, range) {
      const list = live().filter(r => within(r.d, range));
      // Kalem bazlı rapor: stok hareketinden (fatura dışı) satış girmez; SMM hizmet satırıdır.
      assert.equal(summaryOf(data, "Net Satış"), r2(sum(list.filter(r => ["sale", "smm"].includes(r.kind)), r => r.net) - sum(list.filter(r => r.kind === "sale_return"), r => r.net)));
    },
    "cari-satis-alis"(data, c, range) {
      const list = live().filter(r => within(r.d, range));
      assert.equal(summaryOf(data, "Net Satış"), r2(sum(list.filter(r => ["sale", "smm"].includes(r.kind)), r => r.net) - sum(list.filter(r => r.kind === "sale_return"), r => r.net)));
      assert.equal(summaryOf(data, "Net Alış"), sum(list.filter(r => r.kind === "purchase"), r => r.net), "net alış (KDV'li banka masrafı faturası dahil)");
    },
    "gider-raporu"(data, c, range) {
      const expected = sum(live().filter(r => r.expense && within(r.d, range)), r => r.net);
      assert.equal(summaryOf(data, "Toplam Gider"), expected, "kira 2.000 + KDV'li banka masrafı 100");
      if (within(ago(45), range)) assert.ok(data.rows.some(row => String(row[col(data, "Hesap")]).startsWith("770") && moneyOf(row[col(data, "KDV")]) === 20 && moneyOf(row[col(data, "Tutar (KDV Hariç)")]) === 100), `banka masrafı 770 satırı, 100 + KDV 20: ${JSON.stringify(data.rows)}`);
    },
    "stopaj-tevkifat"(data, c, range) {
      const list = live().filter(r => r.stoppage > 0 && within(r.d, range));
      assert.equal(data.rows.length, list.length, "stopajlı belge sayısı");
      assert.equal(summaryOf(data, "Bizden Kesilen Stopaj"), sum(list.filter(r => ["sale", "smm"].includes(r.kind)), r => r.stoppage), "SMM stopajı 200");
      assert.equal(summaryOf(data, "Bizim Ödeyeceğimiz Stopaj"), 0);
    },
    "acik-faturalar"(data, c) {
      const filter = key => !c.account || c.account === key;
      // Taksitli fatura (Bora) taksit kartında izlenir; peşin ödenmiş ve iade edilmiş faturalar açık değildir.
      assert.equal(summaryOf(data, "Açık Alacak"), sum(["A", "C", "D"].filter(filter), k => Math.max(0, allBalance(k))), "açık alacak");
      assert.equal(summaryOf(data, "Açık Borç"), sum(["S", "X"].filter(filter), k => Math.max(0, -allBalance(k))), "açık borç");
      for (const row of data.rows) if (c.account) assert.equal(row[col(data, "Cari")], accName[c.account], "cari süzgeci");
    },
    "taksit-kartlari"(data, c) {
      const list = c.planStatus === "closed" ? [] : E.plans;
      assert.equal(data.rows.length, list.length, `kart sayısı planStatus=${c.planStatus}`);
      assert.equal(summaryOf(data, "Toplam"), sum(list, p => p.total));
      assert.equal(summaryOf(data, "Ödenen"), sum(list, p => p.paid), "ödenen (havale tahsilatı dahil)");
      assert.equal(summaryOf(data, "Kalan"), r2(sum(list, p => p.total) - sum(list, p => p.paid)));
    },
    "taksit-vadeleri"(data, c, range) {
      const items = E.plans.flatMap(p => p.items).filter(it => within(it.due, c.q.preset === "all" ? null : range));
      assert.equal(data.rows.length, items.length, `vade dönemi ${c.rangeLabel}: taksit sayısı`);
      assert.equal(summaryOf(data, "Tutar"), sum(items, it => it.amount));
      assert.equal(summaryOf(data, "Kalan"), sum(items, it => it.remaining));
    },
    "geciken-taksitler"(data) {
      const items = E.plans.flatMap(p => p.items).filter(it => it.due < TODAY && it.remaining > 0);
      assert.equal(summaryOf(data, "Kalan"), sum(items, it => it.remaining));
    },
    "taksit-tahsilatlari"(data, c, range) {
      assert.equal(summaryOf(data, "Toplam Tahsil Edilen"), sum(E.planIn.filter(p => within(p.d, range)), p => p.amt), "taksit tahsilatı (havale dahil)");
    },
    "taksit-performans"(data, c, range) {
      const items = E.plans.flatMap(p => p.items).filter(it => within(it.due, range));
      assert.equal(summaryOf(data, "Vadesi Gelen"), sum(items, it => it.amount));
      assert.equal(summaryOf(data, "Ödenen"), sum(items, it => it.paid));
    },
    "cek-portfoy"(data, c, range) {
      const dueRange = c.rangeLabel && c.rangeLabel !== "varsayılan" ? (c.q.preset === "all" ? null : range) : null;
      const open = ch => ["portfolio", "pending"].includes(ch.status);
      const statusOk = ch => {
        if (!c.status) return true;
        if (c.status === "open") return open(ch);
        if (c.status === "overdue") return open(ch) && ch.due < TODAY;
        if (c.status === "soon") return open(ch) && ch.due >= TODAY && ch.due <= ahead(7);
        return ch.status === c.status;
      };
      const list = E.cheques.filter(ch => (!c.direction || ch.dir === c.direction) && statusOk(ch) && within(ch.due, dueRange));
      assert.deepEqual(data.rows.map(r => r[3]).sort(), list.map(ch => ch.serial).sort(), `portföy ${c.label}`);
      assert.equal(summaryOf(data, "Portföyde (alınan)"), sum(E.cheques.filter(ch => ch.dir === "in" && ch.status === "portfolio"), ch => ch.amount));
      assert.equal(summaryOf(data, "Ödenecek (verilen)"), sum(E.cheques.filter(ch => ch.dir === "out" && ch.status === "pending"), ch => ch.amount), "VC-2 ödendi (havale): ödenecek değil");
    },
    "cek-hareketleri"(data, c, range) {
      const events = E.cheques.flatMap(ch => ch.events);
      assert.equal(data.rows.length, events.filter(d => within(d, range)).length, "çek işlem sayısı (bankaya tahsil ve havale ödemesi dahil)");
    },
    "cek-vade-dagilimi"(data) {
      assert.equal(summaryOf(data, "Tahsil Edilecek"), sum(E.cheques.filter(ch => ch.dir === "in" && ch.status === "portfolio"), ch => ch.amount));
      assert.equal(summaryOf(data, "Ödenecek"), sum(E.cheques.filter(ch => ch.dir === "out" && ch.status === "pending"), ch => ch.amount));
    },
    "stok-durumu"(data, c) {
      const qty = code => sum(E.stock.filter(s => s.code === code), s => s.qty);
      const expected = { KLM: qty("KLM"), DFT: qty("DFT") };
      const all = [["KLM", "Ürün"], ["DFT", "Ürün"], ["HZM", "Hizmet"]];
      const keep = ([, kind]) => (c.category ? false : !c.state || (c.state === "product" ? kind === "Ürün" : c.state === "service" ? kind === "Hizmet" : false));
      assert.deepEqual(data.rows.map(r => r[0]).sort(), all.filter(keep).map(x => x[0]).sort(), `stok süzgeci state=${c.state}`);
      for (const row of data.rows) if (expected[row[0]] !== undefined) assert.equal(numberOf(row[col(data, "Mevcut")]), expected[row[0]], `stok ${row[0]} (havale peşinli stok hareketleri dahil)`);
    },
    "stok-hareketleri"(data, c, range) {
      assert.equal(data.rows.length, E.stock.filter(s => within(s.d, range)).length, "stok hareket sayısı");
    },
    "stok-ozet"(data, c, range) {
      if (c.category) return assert.equal(data.rows.length, 0, "olmayan kategori boş");
      for (const code of ["KLM", "DFT"]) {
        const row = data.rows.find(r => r[0] === code);
        const list = E.stock.filter(s => s.code === code);
        const inn = sum(list.filter(s => within(s.d, range) && s.qty > 0), s => s.qty);
        const out = sum(list.filter(s => within(s.d, range) && s.qty < 0), s => -s.qty);
        const opening = sum(list.filter(s => before_(s.d, range)), s => s.qty);
        if (!row) {
          assert.equal(inn + out + Math.abs(opening), 0, `stok özet ${code} satırı yok`);
          continue;
        }
        assert.equal(numberOf(row[col(data, "Dönem Başı")]), opening, `dönem başı ${code}`);
        assert.equal(numberOf(row[col(data, "Giriş")]), inn, `giriş ${code}`);
        assert.equal(numberOf(row[col(data, "Çıkış")]), out, `çıkış ${code}`);
      }
    },
    "stok-kategori"(data) {
      // Tek kategori ("Kategorisiz"): kalem 3; değer stok listesinin toplamı.
      assert.equal(data.rows.length, 1);
      assert.equal(data.rows[0][0], "Kategorisiz");
      assert.equal(numberOf(data.rows[0][col(data, "Kalem")]), 3);
      assert.equal(summaryOf(data, "Kalem"), 3);
    },
    "kayit-tahsilatlari"(data, c, range) {
      const list = E.payments.filter(p => within(p.d, range));
      assert.equal(summaryOf(data, "Tahsilat"), list.length, "kayıt tahsilatı sayısı (havale ve nakit)");
      assert.equal(summaryOf(data, "Toplam"), sum(list, p => p.amt), "kayıt tahsilatı toplamı");
    },
  };
  function invoiceCheck(data, c, range, kinds, label) {
    const list = live().filter(r => kinds.includes(r.kind) && within(r.d, range) && (!c.account || r.acc === c.account));
    assert.equal(summaryOf(data, label), list.length, `${label} sayısı`);
    assert.equal(summaryOf(data, "Matrah"), sum(list, r => r.net), "matrah");
    assert.equal(summaryOf(data, "KDV"), sum(list, r => r.vat), "KDV");
    assert.equal(summaryOf(data, "Ödenecek"), sum(list, r => r.pay), "ödenecek");
    for (const row of data.rows) if (c.account) assert.equal(row[col(data, "Cari")], accName[c.account], "cari süzgeci");
    assert.ok(!data.rows.some(row => row[col(data, "Durum")] === "İptal Edildi"), "iptal edilen fatura raporda");
  }

  test("katalog: denenen her rapor katalogda ve süzgeç seçenekleri tanımlı (yeni banka raporları ayrı testte)", () => {
    for (const id of REPORT_IDS) {
      const report = catalog.find(r => r.id === id);
      assert.ok(report, `${id} katalogda yok`);
      for (const param of report.params) assert.ok(param === "range" || param === "account" || OPTIONS[param], `${id}: "${param}" seçenekleri testte yok`);
    }
  });

  const stats = { reports: 0, combos: 0, requests: 0, footerColumns: 0 };
  for (const id of REPORT_IDS) {
    test(`${id}: bütün süzgeçler × ekran/PDF/Excel, TOPLAM = satırlar, bağımsız beklenenle (bankalı veri)`, async () => {
      const report = catalog.find(r => r.id === id);
      assert.ok(report, `${id} katalogda yok`);
      stats.reports += 1;
      for (const combo of combos(report)) {
        const tag = `${id}${combo.label}`;
        const res = await get(id, combo.q);
        stats.requests += 1;
        assert.equal(res.status, 200, `${tag}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
        const data = res.data;
        stats.footerColumns += checkFooter(data, tag);
        const range = effective(report, combo);
        if (combo.empty) {
          for (const row of data.rows.filter(row => !isDevir(row) && row.some(cell => (moneyOf(cell) ?? 0) !== 0))) assert.fail(`${tag}: boş dönemde satır: ${JSON.stringify(row)}`);
        }
        if (SPECIFIC[id]) {
          try {
            SPECIFIC[id](data, { ...combo, account: combo.account || "" }, range);
          } catch (error) {
            error.message = `${tag}: ${error.message}`;
            throw error;
          }
        }
        await checkExports(id, combo.q, data, tag);
        stats.requests += 2;
        stats.combos += 1;
      }
      if (report.params.includes("range")) {
        assert.equal((await get(id, { ...(report.accountRequired ? { account: ids.A } : {}), from: "2026-02-30" })).status, 400, `${id}: geçersiz tarih`);
        assert.equal((await get(id, { ...(report.accountRequired ? { account: ids.A } : {}), from: ago(10), to: ago(20) })).status, 400, `${id}: başlangıç > bitiş`);
      }
      if (report.accountRequired) assert.equal((await get(id, {})).status, 400, `${id}: cari seçilmeden 400`);
    });
  }

  test("anahtar toplamlar bağımsız defterle (tüm zamanlar): Kasa, Gerçek Banka (hesap hesap), KDV, cari bakiyeleri, stok", async () => {
    const all = { preset: "all" };
    const kasa = await must("kasa", get("kasa-hareketleri", all));
    assert.equal(summaryOf(kasa, "Güncel Kasa (tüm hareketler)"), sum(E.cash, r => r.amt));
    assert.equal(sum(E.cash, r => r.amt), 2050, "Kasa: 1.000 + 800 − 300 + 200 + 100 + 300 − 50");
    const bankTotal = sum(E.bank, r => r.amt);
    const bankRep = await must("banka", get("banka-pos-hareketleri", all));
    assert.equal(summaryOf(bankRep, "Banka (tüm hareketler)"), bankTotal);
    // Hesap hesap (Banka penceresi ve Alt Hesap Mizanı) = bağımsız defter.
    for (const key of ["Z", "G"]) {
      const want = sum(E.bank.filter(r => r.acc === key), r => r.amt);
      const view = await must("hesap", api.get(`/api/workspace/bank/accounts/${bank[key].id}`));
      assert.equal(view.balanceMinor / 100, want, `${key} hesap kartı`);
      const subs = await must("alt hesap", api.get("/api/workspace/bank/sub-trial"));
      assert.equal(subs.rows.find(row => row.sub === bank[key].glSub)?.balance, want, `${key} Alt Hesap Mizanı`);
    }
    assert.equal(sum(E.bank.filter(r => r.acc === "Z"), r => r.amt), 100000 - 2000 + 500 + 300 - 5000 + 600 - 2400 - 120 + 1000 - 400, "Ziraat");
    assert.equal(sum(E.bank.filter(r => r.acc === "G"), r => r.amt), 50000 + 500 + 1000 - 200 + 5000 + 700 - 150 + 1200 - 1200, "Garanti");
    const summary = await must("banka özeti", api.get("/api/workspace/bank/summary"));
    assert.equal(summary.realBank.minor / 100, bankTotal, "Gerçek Banka = iki hesap toplamı");
    const kdv = await must("kdv", get("kdv-ozeti", all));
    assert.deepEqual([summaryOf(kdv, "Hesaplanan KDV (391)"), summaryOf(kdv, "İndirilecek KDV (191)")], [980 + 200, 1600 + 20], "391: 1.020 − 40 + SMM 200 + S6 200 − iade 200; 191: 1.100 + 400 + 100 + masraf 20");
    const list = await must("cari", get("cari-listesi"));
    const bal = name => list.rows.find(r => r[col(list, "Cari")] === name);
    assert.deepEqual([bal("Ayşe Yılmaz")[col(list, "Bakiye")], bal("Bora Ticaret")[col(list, "Bakiye")], bal("Cem Kaya")[col(list, "Bakiye")], bal("Tedarik AŞ")[col(list, "Bakiye")], bal("Deniz Danışmanlık")[col(list, "Bakiye")], bal("Ziraat Bankası A.Ş.")[col(list, "Bakiye")]], ["160,00 TL", "500,00 TL", "120,00 TL", "4.700,00 TL", "0,00 TL", "0,00 TL"]);
    const stock = await must("stok", get("stok-durumu"));
    assert.deepEqual(stock.rows.filter(r => r[0] !== "HZM").map(r => [r[0], r[col(stock, "Mevcut")]]).sort(), [["DFT", "40"], ["KLM", "97"]], "KLM 100 − 10 + 2 − 5 + 10; DFT 50 − 20 + 10");
  });

  test("Kasa Dökümü PDF: yalnız nakit satırları ve Güncel Kasa; banka bağlı hareketler (havale, Kasa ↔ Banka banka bacağı) girmez", async () => {
    const pdf = await admin.raw("GET", `/api/workspace/cash.pdf?from=${ago(400)}&to=${TODAY}`);
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    // Tutar sınırlarıyla aranır ("400,00", "2.400,00"ün içinde de geçer).
    const has = amount => new RegExp(`(^|[^0-9.,])${amount.replace(/\./g, "\\.")}([^0-9]|$)`).test(text);
    assert.ok(has("2.050,00"), "Kasa bakiyesi 2.050,00");
    // Bankalı hareketlerin kendine özgü tutarları (Kasa'nın hiçbir satırında ya da toplamında yok).
    for (const amount of ["5.000,00", "1.200,00", "700,00", "600,00", "150,00", "120,00", "400,00"]) assert.ok(!has(amount), `banka hareketi ${amount} Kasa Dökümü'nde olmamalı`);
    for (const amount of ["1.000,00", "800,00", "300,00", "200,00", "100,00", "50,00"]) assert.ok(has(amount), `nakit satırı ${amount} Kasa Dökümü'nde`);
  });

  // Plan §8.4 / §8.9 / K10 / karar 32 (§3.4 tablosu "ANLIK DURUM, Genel Bakış, Nakit Akış başlangıcı | özet (K10) | yeni ayrım"): başlangıç =
  // Nakit + Gerçek Banka; Hesabı Atanmamış Eski Hareketler (102.00 + 108.00; burada hesaba bağlanmamış POS 900) ayrı satır, başlangıca girmez.
  // 2.1.0 temel sürüm öncesi kod POS 900'ü de katıyordu (152.280 ↔ 151.380). Komşular (ders 10): ANLIK DURUM Kasa + Gerçek Banka kutuları,
  // Birleşik Rapor ve Banka penceresinin Genel Bakış'ı aynı sayıyı verir; PDF ve Excel'in "Bugünkü Nakit ve Banka" satırı ekranla aynı.
  test("Nakit Akış: başlangıç = Nakit + Gerçek Banka (K10: Hesabı Atanmamış POS 900 hariç)", async () => {
    const flow = await must("nakit akış", api.get("/api/workspace/overview/nakit-akisi?preset=next90&table=0"));
    const cashBal = sum(E.cash, r => r.amt);
    const realBank = sum(E.bank, r => r.amt);
    const unassigned = sum(E.card, r => r.amt);
    assert.equal(unassigned, 900, "bağımsız defter: hesaba bağlanmamış POS 900");
    assert.equal(flow.cashToday, r2(cashBal + realBank), "başlangıç = Kasa 2.050 + Gerçek Banka (POS 900 Hesabı Atanmamış)");
    assert.deepEqual([flow.start?.cash, flow.start?.realBank, flow.start?.unassigned], [cashBal, realBank, unassigned], "başlangıcın kırılımı: Nakit · Gerçek Banka · Hesabı Atanmamış (ayrı, toplama girmez)");
    // Komşular aynı sayıyı verir (tek kaynak; ikinci formül yok).
    const overview = await must("ANLIK DURUM", api.get("/api/workspace/overview"));
    assert.equal(r2(overview.cash.balance + overview.cash.bank.balance), flow.cashToday, "ANLIK DURUM Nakit Kasa + Gerçek Banka = Nakit Akış başlangıcı");
    assert.equal(overview.cash.bank.unassigned.total, unassigned, "ANLIK DURUM Hesabı Atanmamış = 900");
    const bankSummary = await must("banka özeti", api.get("/api/workspace/bank/summary"));
    assert.equal(bankSummary.realBank.minor / 100, realBank, "Banka penceresi Gerçek Banka");
    const combined = await must("birleşik", api.get("/api/companies/report"));
    const row = combined.rows[0];
    assert.equal(r2(row.cash + row.realBank), flow.cashToday, "Birleşik Rapor Nakit Kasa + Gerçek Banka = Nakit Akış başlangıcı");
    assert.equal(row.bankUnassigned, unassigned, "Birleşik Rapor Hesabı Atanmamış = 900");
    const bankRep = await must("banka", get("banka-pos-hareketleri", { preset: "all" }));
    assert.equal(summaryOf(bankRep, "Banka (tüm hareketler)"), realBank, "Banka ve POS Hareketleri: Banka = Gerçek Banka");
    // PDF ve Excel ekranla aynı başlangıcı yazar; etiket plan §8.9: "Bugünkü Nakit ve Banka"; Hesabı Atanmamış ayrı satır.
    const money = value => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    const pdf = await admin.raw("GET", "/api/workspace/overview/nakit-akisi.pdf?preset=next90&table=0");
    assert.equal(pdf.status, 200);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    assert.match(text, new RegExp(`Bugünkü Nakit ve Banka ${money(flow.cashToday).replace(/\./g, "\\.")}`), "PDF: Bugünkü Nakit ve Banka = ekran");
    assert.match(text, new RegExp(`Hesabı Atanmamış Eski Hareketler ${money(unassigned).replace(/\./g, "\\.")}`), "PDF: Hesabı Atanmamış ayrı satır");
    assert.ok(!/Bugünkü Kasa /.test(text), "PDF: eski 'Bugünkü Kasa' etiketi yok");
    const xlsx = await admin.raw("GET", "/api/workspace/overview/nakit-akisi.xlsx?preset=next90&table=0");
    assert.equal(xlsx.status, 200);
    const sheets = xlsxSheets(xlsx.buffer);
    const amountOf = cell => (typeof cell === "number" ? cell : (moneyOf(cell) ?? numberOf(cell)));
    const ozet = Object.fromEntries((sheets["Özet"] || []).map(cells => [cells[0], cells[1]]));
    assert.equal(amountOf(ozet["Bugünkü Nakit ve Banka"]), flow.cashToday, `Excel Özet: Bugünkü Nakit ve Banka = ekran (${JSON.stringify(ozet)})`);
    assert.equal(amountOf(ozet["Hesabı Atanmamış Eski Hareketler"]), unassigned, "Excel Özet: Hesabı Atanmamış ayrı satır");
    const start = (sheets["Nakit Akışı"] || []).find(cells => cells[1] === "Başlangıç") || [];
    assert.equal(amountOf(start[6]), flow.opening, `Excel Nakit Akışı: Başlangıç satırı = ekranın başlangıcı (${JSON.stringify(start)})`);
  });

  test("Nakit Akış (90 gün): beklenen giriş/çıkış bağımsız (taksit, portföydeki senet, verilen çek); başlangıç Kasa + Gerçek Banka (K10)", async () => {
    const flow = await must("nakit akış", api.get("/api/workspace/overview/nakit-akisi?preset=next90&table=0"));
    const base = r2(sum(E.cash, r => r.amt) + sum(E.bank, r => r.amt));
    assert.equal(flow.cashToday, base, `başlangıç ${flow.cashToday}: Kasa + Gerçek Banka (K10; Hesabı Atanmamış POS girmez)`);
    // 90 gün içinde: Ayşe'nin kartındaki 3. taksit (kalan 50, vade ~20 gün sonra), SN-1 senet 3.600 (80 gün sonra) giriş; VC-1 600 (70 gün sonra) çıkış.
    const inItems = E.plans.flatMap(p => p.items).filter(it => it.remaining > 0 && it.due >= TODAY && it.due <= ahead(90));
    const expectedIn = r2(sum(inItems, it => it.remaining) + sum(E.cheques.filter(ch => ch.dir === "in" && ch.status === "portfolio" && ch.due >= TODAY && ch.due <= ahead(90)), ch => ch.amount));
    const expectedOut = sum(E.cheques.filter(ch => ch.dir === "out" && ch.status === "pending" && ch.due >= TODAY && ch.due <= ahead(90)), ch => ch.amount);
    assert.equal(flow.totals.in, expectedIn, `beklenen giriş ${flow.totals.in}`);
    assert.equal(flow.totals.out, expectedOut, `beklenen çıkış ${flow.totals.out}`);
    assert.equal(flow.closing, r2(flow.opening + expectedIn - expectedOut), "dönem sonu tahmini");
  });

  test("Vade Takip (tüm açık kalemler) ve zil/takvim: tahsil edilecek / ödenecek bağımsız; banka bağlı ödenmiş evrak ve faturalar listede yok", async () => {
    const vade = await must("vade takip", api.get("/api/workspace/overview/vade-takip?preset=open"));
    const receivable = sum(KEYS.filter(k => accType[k] === "customer"), k => Math.max(0, allBalance(k)));
    const portfolio = sum(E.cheques.filter(ch => ch.dir === "in" && ch.status === "portfolio"), ch => ch.amount);
    assert.equal(vade.totals.in.total.amount, r2(receivable + portfolio), "tahsil edilecek = müşteri açıkları + portföy");
    const payable = sum(["S", "X"], k => Math.max(0, -allBalance(k)));
    const pending = sum(E.cheques.filter(ch => ch.dir === "out" && ch.status === "pending"), ch => ch.amount);
    assert.equal(vade.totals.out.total.amount, r2(payable + pending), "ödenecek = tedarikçi açıkları + verilen bekleyen çek (VC-2 havaleyle ödendi)");
    assert.ok(!vade.rows.some(row => /VC-2|CK-1/.test(`${row.label} ${row.detail}`)), "ödenmiş/tahsil edilmiş evrak listede yok");
    const dues = await must("zil", api.get("/api/workspace/dues"));
    const inSoon = dues.items.filter(item => item.direction !== "out" && ["plan", "invoice", "cheque"].includes(item.source));
    const outSoon = dues.items.filter(item => item.direction === "out");
    // Bağımsız: vadesi geçmiş ya da 7 gün içinde, kalanı olan: Bora 2. taksit 500, Cem S0 120, Ayşe S2 açığı 110 (kart kalanı 50 ~20 gün sonra: yok);
    // ödenecek: TA-1 açığı 4.700 (5.100 − VC-2 400 mahsup) — VC-1 70 gün sonra: yok.
    const amountOf = item => Number(item.amount ?? item.remaining ?? 0);
    assert.equal(r2(inSoon.reduce((t, item) => t + amountOf(item), 0)), 730, `zil tahsil: ${JSON.stringify(inSoon.map(item => [item.source, item.label, amountOf(item)]))}`);
    assert.equal(r2(outSoon.reduce((t, item) => t + amountOf(item), 0)), 4700, `zil ödeme: ${JSON.stringify(outSoon.map(item => [item.source, item.label, amountOf(item)]))}`);
  });

  test("ileri tarihli banka hareketi denemesi 400; raporlar değişmez (ileri tarih aralığında hareket raporları boş)", async () => {
    const before = await must("banka", get("banka-pos-hareketleri", { preset: "all" }));
    const res = await api.post(`/api/workspace/accounts/${ids.A}/entries`, { kind: "in", amount: "999", date: ahead(5), method: "bank", bankAccountId: bank.Z.id });
    assert.equal(res.status, 400, `ileri tarih: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
    const transfer = await api.post("/api/workspace/bank/transfers", { accountId: bank.Z.id, toAccountId: bank.G.id, amount: "1", date: ahead(5) });
    assert.equal(transfer.status, 400, "ileri tarihli transfer 400");
    const afterAll = await must("banka", get("banka-pos-hareketleri", { preset: "all" }));
    assert.deepEqual(afterAll.summary, before.summary, "rapor değişmedi");
    for (const id of ["kasa-hareketleri", "banka-pos-hareketleri", "cari-hareketleri", "kayit-tahsilatlari", "taksit-tahsilatlari"]) {
      const data = await must(id, get(id, { from: ahead(1), to: ahead(120) }));
      assert.equal(data.rows.filter(row => !isDevir(row)).length, 0, `${id}: ileri tarih aralığında hareket yok`);
    }
  });

  test("tek kayıt + şirket ayrımı: 002'de tek havale tahsilatı → 002 raporlarında tek satır; 001'in raporları değişmez; ?hofCompany= yetkisiz 403", async () => {
    const before001 = await must("001 banka", get("banka-pos-hareketleri", { preset: "all" }));
    const second = unwrap(await admin.post("/api/companies", { name: "Tek Kayıt Şirketi", select: false }));
    assert.equal(second.status, 200, JSON.stringify(second.data));
    const companyId = second.data.id || second.data.company?.id;
    const q = `hofCompany=${encodeURIComponent(companyId)}`;
    const in2 = async (method, url, body) => unwrap(method === "get" ? await admin.get(`${url}${url.includes("?") ? "&" : "?"}${q}`) : await admin.post(`${url}?${q}`, body));
    const acc2 = (await in2("post", "/api/workspace/bank/accounts", { bankName: "Akbank", name: "Tek Hesap", kind: "demand", opening: { date: ago(10), amount: "1.000", confirmed: true } })).data;
    const party2 = (await in2("post", "/api/workspace/accounts", { name: "Tek Müşteri", type: "customer", registeredOn: ago(20) })).data;
    const paid = await in2("post", `/api/workspace/accounts/${party2.id}/entries`, { kind: "in", amount: "250", date: ago(3), method: "bank", bankAccountId: acc2.id });
    assert.equal(paid.status, 200, JSON.stringify(paid.data));
    const report = async id => (await in2("get", `/api/workspace/report-center/${id}?preset=all`)).data;
    const bank2 = await report("banka-pos-hareketleri");
    assert.equal(bank2.rows.filter(row => !isDevir(row) && moneyOf(row[col(bank2, "Giriş")]) === 250).length, 1, "002: tek tahsilat satırı");
    assert.equal(summaryOf(bank2, "Banka (tüm hareketler)"), 1250, "002: açılış 1.000 + 250");
    const tahsilat2 = await report("cari-tahsilat");
    assert.deepEqual([tahsilat2.rows.length, summaryOf(tahsilat2, "Toplam")], [1, 250], "002: Cari Bazında Tahsilat tek satır");
    const cari2 = await report("cari-listesi");
    assert.deepEqual(cari2.rows.map(row => row[col(cari2, "Cari")]), ["Tek Müşteri"], "002: 001'in carileri görünmez");
    const after001 = await must("001 banka", get("banka-pos-hareketleri", { preset: "all" }));
    assert.deepEqual(after001.summary, before001.summary, "001'in banka raporu değişmedi");
    // 001'e kısıtlı kullanıcı 002'nin raporunu ?hofCompany= ile isteyemez.
    const staff = await createUser(server, admin, { username: "rapor-001", role: "muhasebe" });
    const users = unwrap(await admin.get("/api/admin/users")).data;
    const staffId = users.find(user => user.username === "rapor-001").id;
    assert.equal((await admin.put(`/api/companies/access/${staffId}`, { companies: ["sirket-001"] })).status, 200);
    for (const suffix of ["", "/pdf", "/xlsx"]) {
      const denied = await staff.raw("GET", `/api/workspace/report-center/banka-pos-hareketleri${suffix}?preset=all&${q}`);
      assert.equal(denied.status, 403, `001'e kısıtlı kullanıcı 002 raporu${suffix}: ${denied.status}`);
      assert.ok(!denied.buffer.toString("latin1").startsWith("%PDF") && denied.buffer.subarray(0, 2).toString("latin1") !== "PK", "dosya sızmadı");
    }
  });

  test("yetki: rapor yetkisi olmayan personel bütün bankalı raporlarda 403 (ekran, PDF, Excel); dosya sızmaz", async () => {
    const personel = await createUser(server, admin, { username: "rapor-yok-210", role: "personel" });
    let checked = 0;
    for (const id of REPORT_IDS) {
      const q = id === "cari-ekstre" ? `?account=${ids.A}` : "";
      for (const suffix of ["", "/pdf", "/xlsx"]) {
        const denied = await personel.raw("GET", `/api/workspace/report-center/${id}${suffix}${q}`);
        assert.equal(denied.status, 403, `personel ${id}${suffix}: ${denied.status}`);
        assert.ok(!denied.buffer.toString("latin1").startsWith("%PDF") && denied.buffer.subarray(0, 2).toString("latin1") !== "PK", `${id}${suffix}: dosya sızdı`);
        checked += 1;
      }
    }
    for (const url of ["/api/workspace/overview/nakit-akisi", "/api/workspace/bank/summary"]) assert.equal((await personel.get(url)).status, 403, `personel ${url}`);
    assert.equal(checked, REPORT_IDS.length * 3);
  });

  test("Mutabakat Testi tutarlı; özet sayılar", async () => {
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    assert.equal(integrity.ok, true, JSON.stringify(integrity.failures).slice(0, 600));
    console.log(`[raporlar-210-banka] rapor ${stats.reports}, birleşim ${stats.combos}, istek ${stats.requests}, denetlenen TOPLAM kolonu ${stats.footerColumns}`);
    assert.ok(stats.combos > 500);
  });
});
