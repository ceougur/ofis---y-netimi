// 2.0.24 — Rapor Merkezi denetimi: BÜTÜN raporlar × BÜTÜN süzgeç seçenekleri × (ekran JSON, PDF, Excel) + yetki.
// Veri API'den, gerçek iş akışıyla girilir (alış, satış, iade, iptal, peşin nakit/havale/POS, alınan çek ve senet, verilen
// çek, taksit, cari tahsilatı, "Carinin Mevcut Borcu" kartı, Kasa ↔ Banka, gider). Beklenen sayılar programdan BAĞIMSIZ
// tutulan defterden (E) düz toplamlarla hesaplanır; rapor yanıtının gövdesindeki sayılar okunmadan hiçbir denetim geçmez.
// Tarihler bugüne göre (gün önce) yazılır: test her gün aynı anlamla koşar (CLAUDE.md: senaryolar tarihe bağlı yazılmaz).
// Bir denetim programdaki gerçek hatayı yakalıyorsa adı "HATA:" ile başlar ve hata düzelene kadar kırmızı kalır.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { inflateSync } from "node:zlib";
import { readZip } from "../server/lib/zip.mjs";
import { createUser, loginAdmin, startTestServer } from "./helpers.mjs";

// ---------- PDF ve Excel okuyucular (bulgu-223 ile aynı yöntem) ----------
function pdfText(buffer) {
  const text = buffer.toString("latin1");
  const objects = new Map([...text.matchAll(/(\d+) 0 obj\n?([\s\S]*?)\nendobj/g)].map(match => [Number(match[1]), match[2]]));
  const stream = body => {
    const match = /stream\n([\s\S]*?)\nendstream/.exec(body || "");
    if (!match) return "";
    try {
      return /FlateDecode/.test(body) ? inflateSync(Buffer.from(match[1], "latin1")).toString("latin1") : match[1];
    } catch {
      return "";
    }
  };
  const fonts = new Map();
  for (const body of objects.values()) {
    for (const [, name, id] of (/\/Font << ([^>]*) >>/.exec(body)?.[1] || "").matchAll(/\/(\w+) (\d+) 0 R/g)) {
      if (fonts.has(name)) continue;
      const cmap = new Map();
      const unicode = /\/ToUnicode (\d+) 0 R/.exec(objects.get(Number(id)) || "");
      for (const [, gid, hex] of stream(objects.get(Number(unicode?.[1]))).matchAll(/<([0-9A-F]{4})> <([0-9A-F]+)>/g)) cmap.set(gid, String.fromCodePoint(...hex.match(/.{4}/g).map(part => parseInt(part, 16))));
      fonts.set(name, cmap);
    }
  }
  const out = [];
  for (const body of objects.values()) {
    if (!/\/Length/.test(body) || /ToUnicode|FontFile|beginbfchar|DCTDecode/.test(body)) continue;
    for (const [, font, glyphs] of stream(body).matchAll(/\/(\w+) [\d.]+ Tf [^<]*<([0-9A-F]*)> Tj/g)) out.push((glyphs.match(/.{4}/g) || []).map(gid => fonts.get(font)?.get(gid) ?? "?").join(""));
  }
  return out.join("\n");
}
const xmlText = value => value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
// İlk sayfanın satırları: her hücre metin (inlineStr / paylaşılan metin) ya da sayı (<v>).
function xlsxRows(buffer) {
  const entries = readZip(buffer);
  const file = name => entries.find(entry => entry.name === name)?.data.toString("utf8") || "";
  const shared = [...file("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map(match => xmlText([...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("")));
  const sheet = file("xl/worksheets/sheet1.xml");
  return [...sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map(row =>
    [...row[1].matchAll(/<c ([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)].reduce((cells, [, attrs, body = ""]) => {
      // Hücre konumu r="C5" → kolon 2 (boş hücreler dosyada atlanabilir).
      const letters = /r="([A-Z]+)\d+"/.exec(attrs)?.[1] || "";
      const index = letters ? [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1 : cells.length;
      const t = /<t[^>]*>([\s\S]*?)<\/t>/.exec(body);
      const v = /<v>([\s\S]*?)<\/v>/.exec(body);
      while (cells.length < index) cells.push("");
      cells[index] = t ? xmlText(t[1]) : !v ? "" : /t="s"/.test(attrs) ? shared[Number(v[1])] : Number(v[1]);
      return cells;
    }, []),
  );
}
const unwrap = response => ({ ...response, data: response.data && typeof response.data === "object" && "ok" in response.data ? (response.data.ok ? response.data.data : response.data) : response.data });

// ---------- Programdan bağımsız sayı ve tarih yardımcıları ----------
const r2 = value => Math.round((value + Number.EPSILON) * 100) / 100;
const sum = (list, pick = x => x) => r2(list.reduce((total, item) => total + pick(item), 0));
// "1.234,56 TL" / "-300,00 TL" / "−5,00 TL" → sayı; boş ya da para değilse null.
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
// Takvim ayı ekleme (ayın son günü taşarsa ayın son gününe).
const addMonths = (day, months) => {
  const [y, m, d] = day.split("-").map(Number);
  const last = new Date(y, m - 1 + months + 1, 0).getDate();
  return iso(new Date(y, m - 1 + months, Math.min(d, last)));
};
// Dönem düğmeleri — programın presetRange'ine bakılmadan, adlarının anlamıyla yazıldı.
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
// Denenen dönemler: dönem düğmeleri + elle aralık (orta dönem, BOŞ dönem, yalnız ileri tarih).
const RANGES = [
  { label: "varsayılan", q: {} },
  ...["all", "thisYear", "thisMonth", "lastMonth", "last30", "next30", "next90"].map(preset => ({ label: preset, q: { preset }, range: presetOf(preset) })),
  { label: "orta (240–100 gün önce)", q: { from: ago(240), to: ago(100) }, range: { from: ago(240), to: ago(100) } },
  { label: "boş dönem (2001 Ocak)", q: { from: "2001-01-01", to: "2001-01-31" }, range: { from: "2001-01-01", to: "2001-01-31" }, empty: true },
  { label: "yalnız ileri tarih", q: { from: ahead(1), to: ahead(120) }, range: { from: ahead(1), to: ahead(120) } },
];
const within = (day, range) => !range || ((!range.from || day >= range.from) && (!range.to || day <= range.to));
const before_ = (day, range) => Boolean(range?.from) && day < range.from;

// Toplanmayan kolonlar (yürüyen bakiye, birim fiyat, oran) — kolonun anlamından; rapor kendi toplamını yazıyorsa (net bakiye) ayrı denetlenir.
const NO_SUM = new Set(["Bakiye", "Gün Sonu Kasa", "Ay Başı Kasa", "Ay Sonu Kasa", "Birim Fiyat", "KDV %", "Stopaj %", "Kritik Seviye"]);

describe("2.0.24 Rapor Merkezi: bütün raporlar, bütün süzgeçler, ekran/PDF/Excel, yetki", () => {
  let server;
  let admin;
  let api;
  let catalog;
  const ids = {};
  // ---------- BAĞIMSIZ DEFTER ----------
  const E = {
    cash: [], // { d, amt (işaretli) } nakit Kasa
    bank: [], // havale/EFT
    card: [], // POS / kredi kartı
    cari: [], // { d, acc, debit, credit, tag }  tag: invoice | return | pay | collect | plan | cheque
    inv: [], // { d, kind, acc, net, vat, pay, cancelled }
    stock: [], // { d, code, qty (işaretli) }
    cheques: [], // { dir, instrument, serial, amount, received, due, status, acc }
    planIn: [], // { d, amt, acc }
    plans: [], // { acc, total, paid, items: [{ due, amount }] }
  };
  const accName = {};
  const accType = {};
  const vatOf = lines => r2(lines.reduce((t, l) => t + r2((l.qty * l.unitPrice * l.vatRate) / 100), 0));
  const netOf = lines => r2(lines.reduce((t, l) => t + l.qty * l.unitPrice, 0));

  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };

  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    api = {
      get: async url => unwrap(await admin.get(url)),
      post: async (url, body) => unwrap(await admin.post(url, body)),
    };
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

    const invoice = async (label, { d, scenario, kind, acc, lines, payment = {}, number, codes, original }) => {
      const body = { issueDate: d, lines: lines.map(l => (l.originLineId ? { originLineId: l.originLineId, qty: l.qty } : l.itemId || l.expenseCode ? { itemId: l.itemId, name: l.name, expenseCode: l.expenseCode, qty: l.qty, unitPrice: l.unitPrice, vatRate: l.vatRate } : l)), payment };
      if (scenario) body.scenario = scenario;
      if (kind) body.kind = kind;
      if (original) body.originalId = original;
      if (acc && !original) body.accountId = ids[acc];
      if (number) body.number = number;
      const doc = await must(label, api.post("/api/workspace/invoices", body));
      const k = kind || (scenario.endsWith("purchase") ? "purchase" : "sale");
      const net = netOf(lines);
      const vat = vatOf(lines);
      const pay = r2(net + vat);
      E.inv.push({ d, kind: k, acc, net, vat, pay, id: doc.id, cancelled: false });
      // Cari: satış borç, alış alacak, satıştan iade alacak.
      E.cari.push(k === "sale" ? { d, acc, debit: pay, credit: 0, tag: "invoice" } : { d, acc, debit: 0, credit: pay, tag: k === "sale_return" ? "return" : "invoice" });
      (codes || []).forEach(([code, qty]) => E.stock.push({ d, code, qty }));
      for (const c of payment.cash || []) {
        const signed = k === "sale" ? c.amount : -c.amount;
        E[c.method === "cash" ? "cash" : c.method === "bank" ? "bank" : "card"].push({ d, amt: signed });
        E.cari.push(k === "sale" ? { d, acc, debit: 0, credit: c.amount, tag: "collect", method: c.method } : { d, acc, debit: c.amount, credit: 0, tag: "pay" });
      }
      for (const c of payment.cheques || []) {
        E.cheques.push({ dir: k === "sale" ? "in" : "out", instrument: c.instrument, serial: c.serialNo, amount: c.amount, received: d, due: c.dueDate, status: k === "sale" ? "portfolio" : "pending", acc });
        E.cari.push(k === "sale" ? { d, acc, debit: 0, credit: c.amount, tag: "cheque" } : { d, acc, debit: c.amount, credit: 0, tag: "cheque" });
      }
      return doc;
    };

    // 1) 320 gün önce: Kasa'ya elle açılış nakdi.
    await must("açılış nakdi", api.post("/api/workspace/cash", { kind: "in", amount: "1000", date: ago(320), description: "Açılış nakdi", method: "cash" }));
    E.cash.push({ d: ago(320), amt: 1000 });
    // 2) 310: Cem'e açık hizmet satışı (%20) — 120 açık.
    await invoice("S0", { d: ago(310), scenario: "service_sale", acc: "C", lines: [{ itemId: ids.HZM, qty: 1, unitPrice: 100, vatRate: 20 }], payment: { rest: "open", dueDate: ago(280) } });
    // 3) 290: tedarikçiden mal alışı (%20 + %10), 2.000 havale peşin, kalanı açık.
    await invoice("TA-1", { d: ago(290), scenario: "goods_purchase", acc: "S", number: "TA-1", lines: [{ itemId: ids.KLM, qty: 100, unitPrice: 50, vatRate: 20 }, { itemId: ids.DFT, qty: 50, unitPrice: 20, vatRate: 10 }], codes: [["KLM", 100], ["DFT", 50]], payment: { cash: [{ amount: 2000, method: "bank" }], rest: "open", dueDate: ago(260) } });
    // 4) 260: Ayşe'ye stok + hizmet satışı, 800 nakit peşin.
    ids.s2 = (await invoice("S2", { d: ago(260), scenario: "goods_sale", acc: "A", lines: [{ itemId: ids.KLM, qty: 10, unitPrice: 100, vatRate: 20 }, { itemId: ids.HZM, qty: 1, unitPrice: 500, vatRate: 20 }], codes: [["KLM", -10]], payment: { cash: [{ amount: 800, method: "cash" }], rest: "open", dueDate: ago(230) } })).id;
    // 5) 230: Bora'ya satış (%10 + %1): 900 POS, 1.000 çek, kalan 1.000 iki taksit.
    const s3 = await invoice("S3", { d: ago(230), scenario: "goods_sale", acc: "B", lines: [{ itemId: ids.DFT, qty: 20, unitPrice: 40, vatRate: 10 }, { itemId: ids.HZM, qty: 2, unitPrice: 1000, vatRate: 1 }], codes: [["DFT", -20]], payment: { cash: [{ amount: 900, method: "card" }], cheques: [{ instrument: "cheque", amount: 1000, dueDate: ago(100), serialNo: "CK-1", bank: "Ziraat" }], rest: "installments", installments: { count: 2, firstDue: ago(200) } } });
    E.plans.push({ acc: "B", total: 1000, items: [{ due: ago(200), amount: 500 }, { due: addMonths(ago(200), 1), amount: 500 }] });
    // 6) 200: Cem'e hizmet satışı, tamamı ileri vadeli senetle.
    await invoice("S4", { d: ago(200), scenario: "service_sale", acc: "C", lines: [{ itemId: ids.HZM, qty: 1, unitPrice: 3000, vatRate: 20 }], payment: { cheques: [{ instrument: "note", amount: 3600, dueDate: ahead(80), serialNo: "SN-1" }] } });
    // 7) 190: Ayşe'ye satış, sonra İPTAL (hiçbir rapora girmemeli).
    const s5 = await invoice("S5 (iptal)", { d: ago(190), scenario: "goods_sale", acc: "A", lines: [{ itemId: ids.KLM, qty: 5, unitPrice: 100, vatRate: 20 }], codes: [["KLM", -5]], payment: { rest: "open", dueDate: ago(160) } });
    await must("iptal", api.post(`/api/workspace/invoices/${s5.id}/cancel`, { reason: "yanlış fatura" }));
    // İptal: faturanın bütün etkileri defterden çıkarılır.
    E.inv.find(row => row.id === s5.id).cancelled = true;
    E.cari.splice(E.cari.findIndex(row => row.d === ago(190) && row.acc === "A"), 1);
    E.stock.splice(E.stock.findIndex(row => row.d === ago(190)), 1);
    // 8) 170: Ayşe 2 Kalem iade eder (cariden mahsup).
    const s2d = await must("s2", api.get(`/api/workspace/invoices/${ids.s2}`));
    await invoice("İade", { d: ago(170), kind: "sale_return", acc: "A", original: ids.s2, lines: [{ originLineId: s2d.lines[0].id, qty: 2, unitPrice: 100, vatRate: 20 }], codes: [["KLM", 2]] });
    // 9) 160: Ayşe'den cari kartından 500 havale tahsilat.
    await must("cari tahsilat", api.post(`/api/workspace/accounts/${ids.A}/entries`, { kind: "in", amount: "500", date: ago(160), method: "bank" }));
    E.bank.push({ d: ago(160), amt: 500 });
    E.cari.push({ d: ago(160), acc: "A", debit: 0, credit: 500, tag: "collect", method: "bank" });
    // 10) 150: Bora'nın taksitinden 500 nakit.
    const s3d = await must("s3", api.get(`/api/workspace/invoices/${s3.id}`));
    await must("taksit tahsilatı", api.post(`/api/workspace/plans/${s3d.planId}/entries`, { kind: "in", amount: "500", date: ago(150), method: "cash" }));
    E.cash.push({ d: ago(150), amt: 500 });
    E.cari.push({ d: ago(150), acc: "B", debit: 0, credit: 500, tag: "plan" });
    E.planIn.push({ d: ago(150), amt: 500, acc: "B" });
    // 11) 100: çek bankaya tahsil.
    const ck = (await must("çekler", api.get("/api/workspace/cheques"))).cheques.find(row => row.serialNo === "CK-1");
    await must("çek tahsil", api.post(`/api/workspace/cheques/${ck.id}/actions`, { action: "collect", date: ago(100), method: "bank" }));
    E.bank.push({ d: ago(100), amt: 1000 });
    Object.assign(E.cheques.find(row => row.serial === "CK-1"), { status: "collected", collected: ago(100) });
    // 12) 90: Kasa'dan bankaya 300.
    await must("transfer", api.post("/api/workspace/cash/transfer", { direction: "to-bank", amount: "300", date: ago(90), description: "Bankaya yatırma" }));
    E.cash.push({ d: ago(90), amt: -300 });
    E.bank.push({ d: ago(90), amt: 300 });
    // 13) 70: Ayşe'nin mevcut borcunun 150'si 3 taksitli karta; 60 gün önce 100 nakit.
    const firstDue = ago(40);
    const cover = await must("mevcut borç kartı", api.post("/api/workspace/plans", { name: accName.A, registeredOn: ago(70), total: "150", accountId: ids.A, mode: "auto", count: "3", firstDue, coversBalance: true }));
    E.plans.push({ acc: "A", total: 150, items: [0, 1, 2].map(i => ({ due: addMonths(firstDue, i), amount: 50 })) });
    await must("kart tahsilatı", api.post(`/api/workspace/plans/${cover.id}/entries`, { kind: "in", amount: "100", date: ago(60), method: "cash" }));
    E.cash.push({ d: ago(60), amt: 100 });
    E.cari.push({ d: ago(60), acc: "A", debit: 0, credit: 100, tag: "plan" });
    E.planIn.push({ d: ago(60), amt: 100, acc: "A" });
    // 14) 50: kira gideri faturası (%20), havale peşin.
    await invoice("TA-2", { d: ago(50), scenario: "expense_purchase", acc: "S", number: "TA-2", lines: [{ name: "Ofis Kirası", expenseCode: "rent", qty: 1, unitPrice: 2000, vatRate: 20 }], payment: { cash: [{ amount: 2400, method: "bank" }] } });
    // 15) 40: Kasa'dan elle kırtasiye gideri.
    await must("kırtasiye", api.post("/api/workspace/cash", { kind: "out", amount: "50", date: ago(40), description: "Kırtasiye", method: "cash" }));
    E.cash.push({ d: ago(40), amt: -50 });
    // 16) 20: mal alışı, ileri vadeli VERİLEN çekle.
    await invoice("TA-3", { d: ago(20), scenario: "goods_purchase", acc: "S", number: "TA-3", lines: [{ itemId: ids.KLM, qty: 10, unitPrice: 50, vatRate: 20 }], codes: [["KLM", 10]], payment: { cheques: [{ instrument: "cheque", amount: 600, dueDate: ahead(70), serialNo: "VC-1", bank: "Halk" }] } });
    // Ödenen taksitler (FIFO): kartın ödenenleri sırayla ilk taksitlere.
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
  const movement = (list, range) => ({ opening: sum(list.filter(r => before_(r.d, range)), r => r.amt), in: sum(list.filter(r => within(r.d, range) && r.amt > 0), r => r.amt), out: sum(list.filter(r => within(r.d, range) && r.amt < 0), r => -r.amt) });

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

  // TOPLAM satırı: her toplanabilir kolonda satırların toplamı (bağımsız ayrıştırma). Bakiye/Durum (net bakiye) ayrıca.
  function checkFooter(data, tag) {
    const rows = data.rows;
    // İşlem geçmişi testin kendi isteklerini de kaydeder (binlerce satır): ön izleme ilk 200; TOPLAM bütün satırdandır.
    if (data.total > rows.length) {
      assert.equal(rows.length, 200, `${tag}: ön izleme 200 satır`);
      return 0;
    }
    assert.equal(rows.length, data.total, `${tag}: bu küçük veride bütün satırlar ön izlemede olmalı`);
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
        // Net bakiye: borçlular − alacaklılar, yönüyle.
        const durum = col(data, "Durum");
        const net = sum(rows, row => (moneyOf(row[index]) || 0) * (row[durum] === "Alacaklı" ? -1 : 1));
        assert.equal(moneyOf(cell), Math.abs(net), `${tag}: TOPLAM Bakiye = net bakiye`);
        assert.equal(data.footer[durum], net > 0.005 ? "Borçlu" : net < -0.005 ? "Alacaklı" : "Kapalı", `${tag}: TOPLAM Durum`);
        checked += 1;
        return;
      }
      if (NO_SUM.has(header)) {
        assert.equal(cell, "", `${tag}: "${header}" toplanmaz, TOPLAM boş olmalı`);
        return;
      }
      const values = rows.map(row => (type === "money" ? moneyOf(row[index]) : numberOf(row[index]))).filter(v => v !== null);
      if (!values.length) return;
      const expected = sum(values);
      const actual = type === "money" ? moneyOf(cell) : numberOf(cell);
      if (actual === null && type === "number" && data.headers.includes("Birim") && new Set(rows.map(r => r[col(data, "Birim")]).filter(Boolean)).size > 1) return; // farklı birimler toplanmaz
      assert.equal(actual, expected, `${tag}: TOPLAM "${header}" ${cell} ≠ satır toplamı ${expected}`);
      checked += 1;
    });
    return checked;
  }

  // PDF ve Excel: aynı satırlar ve aynı TOPLAM.
  async function checkExports(id, q, data, tag) {
    const pdf = await get(id, q, "pdf");
    assert.equal(pdf.status, 200, `${tag} PDF: ${pdf.status} ${pdf.buffer.toString("utf8").slice(0, 200)}`);
    assert.equal(pdf.buffer.subarray(0, 5).toString("latin1"), "%PDF-", `${tag}: PDF imzası`);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    assert.ok(text.includes(data.title), `${tag} PDF: başlık "${data.title}" yok`);
    for (const row of data.rows) {
      for (const cell of row) {
        const value = moneyOf(cell);
        if (value !== null) assert.ok(text.includes(String(cell).trim()), `${tag} PDF: satırdaki "${cell}" PDF'te yok`);
      }
    }
    if (data.footer) {
      assert.ok(text.includes("TOPLAM"), `${tag} PDF: TOPLAM satırı yok`);
      for (const cell of data.footer) if (moneyOf(cell) !== null) assert.ok(text.includes(cell), `${tag} PDF: TOPLAM hücresi "${cell}" yok`);
    }
    const xlsx = await get(id, q, "xlsx");
    assert.equal(xlsx.status, 200, `${tag} Excel: ${xlsx.status}`);
    const sheet = xlsxRows(xlsx.buffer);
    if (data.total > data.rows.length || !data.headers.length) return;
    assert.equal(sheet.length, 1 + data.rows.length + (data.footer ? 1 : 0), `${tag} Excel: satır sayısı (başlık + ${data.rows.length} + TOPLAM)`);
    const cellValue = cell => moneyOf(cell) ?? numberOf(cell);
    const same = (excel, screen, where) => {
      const expected = cellValue(screen);
      if (expected === null) return;
      const actual = typeof excel === "number" ? excel : cellValue(excel);
      assert.equal(actual, expected, `${tag} Excel ${where}: ${excel} ≠ ekrandaki ${screen}`);
    };
    data.rows.forEach((row, r) => row.forEach((cell, c) => same(sheet[r + 1]?.[c], cell, `satır ${r + 1} kolon "${data.headers[c]}"`)));
    if (data.footer) data.footer.forEach((cell, c) => same(sheet.at(-1)?.[c], cell, `TOPLAM kolon "${data.headers[c]}"`));
  }

  // ---------- Süzgeç seçenekleri (istemcideki listeyle aynı: client/assets/hof-report-center.js) ----------
  const OPTIONS = {
    type: ["", "customer", "supplier", "other"],
    side: ["", "debtor", "creditor", "nonzero", "zero", "overdue"],
    payMethod: ["noncash", "bank", "card"],
    direction: ["", "in", "out"],
    status: ["", "open", "overdue", "soon", "collected", "endorsed", "paid", "bounced", "portfolio", "pending"],
    state: ["", "low", "out", "negative", "product", "service"],
    category: ["", "Yok Böyle Kategori"],
    planStatus: ["active", "closed", "all"],
    taskStatus: ["all", "open", "done"],
    tab: [""],
  };
  const combos = report => {
    let list = [{ q: {}, range: null, label: "" }];
    for (const param of report.params) {
      const next = [];
      for (const base of list) {
        if (param === "range") {
          for (const r of RANGES) next.push({ ...base, q: { ...base.q, ...r.q }, range: r.range ?? null, rangeLabel: r.label, empty: r.empty, label: `${base.label} dönem=${r.label}` });
        } else if (param === "account") {
          for (const key of report.accountRequired ? ["A", "B", "C", "S"] : ["", "A", "B", "C", "S"]) next.push({ ...base, q: key ? { ...base.q, account: ids[key] } : base.q, account: key, label: `${base.label} cari=${key || "tümü"}` });
        } else {
          for (const value of OPTIONS[param] || [""]) next.push({ ...base, q: value ? { ...base.q, [param]: value } : base.q, [param]: value, label: `${base.label} ${param}=${value || "—"}` });
        }
      }
      list = next;
    }
    return list;
  };
  // Varsayılan dönem (rapor kaydındaki preset; yoksa "Tüm zamanlar").
  const effective = (report, combo) => (combo.rangeLabel && combo.rangeLabel !== "varsayılan" ? combo.range : report.preset ? presetOf(report.preset) : null);

  // ---------- Rapora özgü süzgeç ve sayı denetimleri (bağımsız defterle) ----------
  const SPECIFIC = {
    "kasa-hareketleri"(data, c, range) {
      const m = movement(E.cash, range);
      assert.equal(summaryOf(data, "Devir"), m.opening, "Kasa devri");
      assert.equal(summaryOf(data, "Dönem Giriş"), m.in, "Kasa dönem girişi");
      assert.equal(summaryOf(data, "Dönem Çıkış"), m.out, "Kasa dönem çıkışı");
      assert.equal(summaryOf(data, "Güncel Kasa (tüm hareketler)"), sum(E.cash, r => r.amt), "Güncel Kasa");
      assert.equal(data.rows.filter(row => !isDevir(row)).length, E.cash.filter(r => within(r.d, range)).length, "Kasa satır sayısı");
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
    },
    "kasa-aylik"(data, c, range) {
      const m = movement(E.cash, range);
      assert.equal(summaryOf(data, "Devir"), m.opening);
      assert.equal(summaryOf(data, "Toplam Giriş"), m.in);
      assert.equal(summaryOf(data, "Toplam Çıkış"), m.out);
    },
    "banka-pos-hareketleri"(data, c, range) {
      const list = c.payMethod === "bank" ? E.bank : c.payMethod === "card" ? E.card : [...E.bank, ...E.card];
      const m = movement(list, range);
      assert.equal(summaryOf(data, "Devir"), m.opening, "banka devri");
      assert.equal(summaryOf(data, "Dönem Giriş"), m.in, "banka girişi");
      assert.equal(summaryOf(data, "Dönem Çıkış"), m.out, "banka çıkışı");
      assert.equal(summaryOf(data, "Banka (tüm hareketler)"), sum(E.bank, r => r.amt));
      assert.equal(summaryOf(data, "POS / Kredi Kartı (tüm hareketler)"), sum(E.card, r => r.amt));
      const yol = col(data, "Yol");
      const allowed = c.payMethod === "bank" ? ["Havale / EFT"] : c.payMethod === "card" ? ["POS", "Kredi Kartı"] : ["Havale / EFT", "POS", "Kredi Kartı"];
      for (const row of data.rows.filter(row => !isDevir(row))) assert.ok(allowed.includes(row[yol]), `Yol süzgeci ${c.payMethod}: satır ${row[yol]}`);
      assert.equal(data.rows.filter(row => !isDevir(row)).length, list.filter(r => within(r.d, range)).length, "banka satır sayısı");
    },
    "hesap-mizani"(data, c, range) {
      assert.equal(summaryOf(data, "Fark"), 0, "Borç = Alacak");
      const kasa = data.rows.find(row => row[0] === "100");
      const balanceToEnd = list => sum(list.filter(r => !range?.to || r.d <= range.to), r => r.amt);
      if (kasa) assert.equal(moneyOf(kasa[col(data, "Bakiye")]) * (kasa[col(data, "Yön")] === "Alacak" ? -1 : 1), balanceToEnd(E.cash), "100 Kasa bakiyesi");
      else assert.equal(balanceToEnd(E.cash), 0, "100 Kasa satırı yok ama Kasa bakiyesi var");
      const bank = data.rows.find(row => row[0] === "102");
      if (bank) assert.equal(moneyOf(bank[col(data, "Bakiye")]) * (bank[col(data, "Yön")] === "Alacak" ? -1 : 1), balanceToEnd(E.bank), "102 Banka bakiyesi");
    },
    yevmiye(data) {
      const b = col(data, "Borç");
      const a = col(data, "Alacak");
      assert.equal(sum(data.rows, row => moneyOf(row[b]) || 0), sum(data.rows, row => moneyOf(row[a]) || 0), "yevmiye borç = alacak");
    },
    "defter-mutabakati"(data) {
      assert.ok(data.rows.length > 5);
      for (const row of data.rows) assert.equal(row.at(-1), "Tutarlı", `mutabakat ${row[0]}`);
    },
    mizan(data, c, range) {
      const keys = ["A", "B", "C", "S"].filter(k => !c.type || accType[k] === c.type);
      const name = col(data, "Cari");
      for (const key of keys) {
        const row = data.rows.find(r => r[name] === accName[key]);
        const closing = balanceOf(key, range);
        const sideOk = !c.side || (c.side === "debtor" ? closing > 0 : c.side === "creditor" ? closing < 0 : c.side === "zero" ? closing === 0 : c.side === "nonzero" ? closing !== 0 : true);
        if (!sideOk) {
          assert.equal(row, undefined, `mizan side=${c.side}: ${accName[key]} listelenmemeli`);
          continue;
        }
        if (!row) continue; // hareketsiz ve bakiyesiz cari dönemde listelenmeyebilir
        const list = E.cari.filter(r => r.acc === key);
        assert.equal(moneyOf(row[col(data, "Devir")]), sum(list.filter(r => before_(r.d, range)), r => r.debit - r.credit), `mizan devir ${key}`);
        assert.equal(moneyOf(row[col(data, "Borç")]), sum(list.filter(r => within(r.d, range)), r => r.debit), `mizan borç ${key}`);
        assert.equal(moneyOf(row[col(data, "Alacak")]), sum(list.filter(r => within(r.d, range)), r => r.credit), `mizan alacak ${key}`);
        assert.equal(moneyOf(row[col(data, "Bakiye")]), Math.abs(closing), `mizan bakiye ${key}`);
      }
      for (const row of data.rows) assert.ok(keys.map(k => accName[k]).includes(row[name]), `mizan type=${c.type}: ${row[name]} süzgece uymuyor`);
    },
    "cari-listesi"(data, c) {
      const overdueOf = key => sum(E.plans.filter(p => p.acc === key).flatMap(p => p.items).filter(it => it.due < TODAY), it => it.remaining);
      const keys = ["A", "B", "C", "S"].filter(k => !c.type || accType[k] === c.type).filter(k => {
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
      const name = col(data, "Cari");
      for (const row of data.rows) assert.ok(Object.keys(accName).some(k => accName[k] === row[name] && (!c.type || accType[k] === c.type)), `type süzgeci: ${row[name]}`);
    },
    "cari-tahsilat"(data, c, range) {
      const list = E.cari.filter(r => within(r.d, range) && ["collect", "plan", "cheque"].includes(r.tag) && accType[r.acc] !== "supplier" && (!c.type || accType[r.acc] === c.type));
      assert.equal(summaryOf(data, "Toplam"), sum(list, r => r.credit), "tahsilat toplamı");
      assert.equal(summaryOf(data, "Taksit Tahsilatı"), sum(list.filter(r => r.tag === "plan"), r => r.credit));
      assert.equal(summaryOf(data, "Çek / Senet (alınan)"), sum(list.filter(r => r.tag === "cheque"), r => r.credit));
    },
    "alacak-yaslandirma"(data) {
      const receivable = sum(["A", "B", "C"], k => Math.max(0, allBalance(k)));
      const portfolio = sum(E.cheques.filter(ch => ch.dir === "in" && ch.status === "portfolio"), ch => ch.amount);
      assert.equal(moneyOf(data.footer[col(data, "Toplam")]), r2(receivable + portfolio), "yaşlandırma toplamı = müşteri bakiyeleri + portföy");
      const overdue = moneyOf(data.footer[col(data, "Toplam Gecikmiş")]);
      assert.equal(r2(overdue + moneyOf(data.footer[col(data, "Vadesi Gelmemiş")])), moneyOf(data.footer[col(data, "Toplam")]), "gecikmiş + gelmemiş = toplam");
    },
    "fatura-satis"(data, c, range) {
      invoiceCheck(data, c, range, ["sale"], "Satış Faturası");
    },
    "fatura-alis"(data, c, range) {
      invoiceCheck(data, c, range, ["purchase"], "Alış Faturası");
    },
    "fatura-iade"(data, c, range) {
      invoiceCheck(data, c, range, ["sale_return"], "İade Faturası");
    },
    "kdv-ozeti"(data, c, range) {
      const list = live().filter(r => within(r.d, range));
      assert.equal(summaryOf(data, "Hesaplanan KDV (391)"), r2(sum(list.filter(r => r.kind === "sale"), r => r.vat) - sum(list.filter(r => r.kind === "sale_return"), r => r.vat)));
      assert.equal(summaryOf(data, "İndirilecek KDV (191)"), sum(list.filter(r => r.kind === "purchase"), r => r.vat));
    },
    "urun-satis-karlilik"(data, c, range) {
      const list = live().filter(r => within(r.d, range));
      assert.equal(summaryOf(data, "Net Satış"), r2(sum(list.filter(r => r.kind === "sale"), r => r.net) - sum(list.filter(r => r.kind === "sale_return"), r => r.net)));
    },
    "cari-satis-alis"(data, c, range) {
      const list = live().filter(r => within(r.d, range));
      assert.equal(summaryOf(data, "Net Satış"), r2(sum(list.filter(r => r.kind === "sale"), r => r.net) - sum(list.filter(r => r.kind === "sale_return"), r => r.net)));
      assert.equal(summaryOf(data, "Net Alış"), sum(list.filter(r => r.kind === "purchase"), r => r.net));
    },
    "gider-raporu"(data, c, range) {
      assert.equal(summaryOf(data, "Toplam Gider"), within(ago(50), range) ? 2000 : 0, "kira gideri");
    },
    "acik-faturalar"(data, c) {
      const filter = key => !c.account || c.account === key;
      // Taksitli fatura (Bora) taksit kartında izlenir; açık alacak = taksitsiz satışların kalanı = müşterinin bakiyesi (Cem, Ayşe).
      assert.equal(summaryOf(data, "Açık Alacak"), sum(["A", "C"].filter(filter), k => allBalance(k)), "açık alacak");
      assert.equal(summaryOf(data, "Açık Borç"), filter("S") ? -allBalance("S") : 0, "açık borç");
      for (const row of data.rows) if (c.account) assert.equal(row[col(data, "Cari")], accName[c.account], "cari süzgeci");
    },
    "taksit-kartlari"(data, c) {
      const active = E.plans;
      const list = c.planStatus === "closed" ? [] : active;
      assert.equal(data.rows.length, list.length, `kart sayısı planStatus=${c.planStatus}`);
      assert.equal(summaryOf(data, "Toplam"), sum(list, p => p.total));
      assert.equal(summaryOf(data, "Ödenen"), sum(list, p => p.paid));
      assert.equal(summaryOf(data, "Kalan"), r2(sum(list, p => p.total) - sum(list, p => p.paid)));
    },
    "taksit-vadeleri"(data, c, range) {
      // Vade raporunda "Tüm Zamanlar" sınırsızdır (ileri vadeli taksit de listelenir; report-center.mjs dueRangeOf).
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
      assert.equal(summaryOf(data, "Toplam Tahsil Edilen"), sum(E.planIn.filter(p => within(p.d, range)), p => p.amt));
    },
    "cek-portfoy"(data, c, range) {
      const dueRange = c.rangeLabel && c.rangeLabel !== "varsayılan" ? (c.q.preset === "all" ? null : range) : null;
      const open = ch => ["portfolio", "pending"].includes(ch.status);
      const statusOk = ch => {
        if (!c.status) return true;
        if (c.status === "open") return open(ch);
        if (c.status === "closed") return !open(ch);
        if (c.status === "overdue") return open(ch) && ch.due < TODAY;
        if (c.status === "soon") return open(ch) && ch.due >= TODAY && ch.due <= ahead(7);
        return ch.status === c.status;
      };
      const list = E.cheques.filter(ch => (!c.direction || ch.dir === c.direction) && statusOk(ch) && within(ch.due, dueRange));
      assert.deepEqual(data.rows.map(r => r[3]).sort(), list.map(ch => ch.serial).sort(), `portföy ${c.label}`);
      assert.equal(summaryOf(data, "Portföyde (alınan)"), sum(E.cheques.filter(ch => ch.dir === "in" && ch.status === "portfolio"), ch => ch.amount));
      assert.equal(summaryOf(data, "Ödenecek (verilen)"), sum(E.cheques.filter(ch => ch.dir === "out" && ch.status === "pending"), ch => ch.amount));
    },
    "cek-hareketleri"(data, c, range) {
      const events = E.cheques.flatMap(ch => [ch.received, ch.collected].filter(Boolean));
      assert.equal(data.rows.length, events.filter(d => within(d, range)).length, "çek işlem sayısı");
    },
    "cek-vade-dagilimi"(data) {
      assert.equal(summaryOf(data, "Tahsil Edilecek"), sum(E.cheques.filter(ch => ch.dir === "in" && ch.status === "portfolio"), ch => ch.amount));
      assert.equal(summaryOf(data, "Ödenecek"), sum(E.cheques.filter(ch => ch.dir === "out" && ch.status === "pending"), ch => ch.amount));
    },
    "stok-durumu"(data, c) {
      const qty = code => sum(E.stock.filter(s => s.code === code), s => s.qty);
      const expected = { KLM: qty("KLM"), DFT: qty("DFT") };
      const all = [["KLM", "Ürün"], ["DFT", "Ürün"], ["HZM", "Hizmet"]];
      const keep = ([code, kind]) => (c.category ? false : !c.state || (c.state === "product" ? kind === "Ürün" : c.state === "service" ? kind === "Hizmet" : false));
      assert.deepEqual(data.rows.map(r => r[0]).sort(), all.filter(keep).map(x => x[0]).sort(), `stok süzgeci state=${c.state} category=${c.category}`);
      for (const row of data.rows) if (expected[row[0]] !== undefined) assert.equal(numberOf(row[col(data, "Mevcut")]), expected[row[0]], `stok ${row[0]}`);
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
    "taksit-performans"(data, c, range) {
      const items = E.plans.flatMap(p => p.items).filter(it => within(it.due, range));
      assert.equal(summaryOf(data, "Vadesi Gelen"), sum(items, it => it.amount));
      assert.equal(summaryOf(data, "Ödenen"), sum(items, it => it.paid));
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

  test("katalog: 43+ rapor listelenir, her rapora süzgeç seçeneği tanımlı", () => {
    assert.ok(catalog.length >= 40, `rapor sayısı ${catalog.length}`);
    for (const report of catalog) for (const param of report.params) assert.ok(param === "range" || param === "account" || OPTIONS[param], `${report.id}: "${param}" süzgecinin seçenekleri testte yok`);
  });

  // Her rapor kendi testinde: bütün süzgeç birleşimleri × ekran + PDF + Excel.
  const REPORT_IDS = ["kasa-hareketleri", "kasa-gunluk", "kasa-kaynak", "kasa-aylik", "hesap-mizani", "yevmiye", "defter-mutabakati", "mutabakat-gunlugu", "banka-pos-hareketleri", "mizan", "cari-listesi", "cari-ekstre", "cari-hareketleri", "cari-tahsilat", "alacak-yaslandirma", "fatura-satis", "fatura-alis", "fatura-iade", "kdv-ozeti", "ba-bs", "urun-satis-karlilik", "cari-satis-alis", "gider-raporu", "stopaj-tevkifat", "acik-faturalar", "taksit-kartlari", "taksit-vadeleri", "geciken-taksitler", "taksit-performans", "taksit-tahsilatlari", "cek-portfoy", "cek-hareketleri", "cek-vade-dagilimi", "stok-durumu", "stok-hareketleri", "stok-ozet", "stok-kategori", "kayit-tahsilatlari", "notlar", "gorevler", "belgeler", "tablo-verisi", "islem-gecmisi"];
  const stats = { reports: 0, combos: 0, requests: 0, footerColumns: 0 };
  test("katalog = testteki rapor listesi (yeni rapor eklenirse test de genişler)", () => {
    assert.deepEqual(catalog.map(r => r.id).sort(), [...REPORT_IDS].sort());
  });
  for (const id of REPORT_IDS) {
    test(`${id}: bütün süzgeçler × ekran/PDF/Excel, TOPLAM = satırlar, bağımsız beklenenle`, async () => {
      const report = catalog.find(r => r.id === id);
      assert.ok(report, `${id} katalogda yok`);
      stats.reports += 1;
      // Bu iki denetim ayrı "HATA:" testinde: genel döngü onları atlar ki öbür süzgeçler yine denensin.
      const skip = combo => (id === "mizan" && combo.side === "overdue");
      for (const combo of combos(report)) {
        if (skip(combo)) continue;
        const tag = `${id}${combo.label}`;
        const res = await get(id, combo.q);
        stats.requests += 1;
        assert.equal(res.status, 200, `${tag}: ${res.status} ${JSON.stringify(res.data).slice(0, 200)}`);
        const data = res.data;
        stats.footerColumns += checkFooter(data, tag);
        const range = effective(report, combo);
        if (combo.empty) {
          // Aylık özet boş ayı sıfırlı satır olarak gösterebilir; tutar içeren satır olmamalı.
          for (const row of data.rows.filter(row => !isDevir(row) && row.some(cell => (moneyOf(cell) ?? 0) !== 0))) assert.fail(`${tag}: boş dönemde satır: ${JSON.stringify(row)}`);
          for (const [label, value] of data.summary) if (/Giriş|Çıkış|Borç|Alacak|Matrah|KDV|Tahsil|Toplam|Net|Gider|Ödenecek|Tutar/.test(label) && !/Banka \(|POS \/|Güncel|Portföy|Ödenecek \(|Fark/.test(label)) assert.equal(moneyOf(value) ?? numberOf(value) ?? 0, 0, `${tag}: boş dönemde "${label}" = ${value}`);
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
      // Geçersiz dönem: 400, sessizce "tüm zamanlar" değil.
      if (report.params.includes("range")) {
        assert.equal((await get(id, { ...(report.accountRequired ? { account: ids.A } : {}), from: "2026-02-30" })).status, 400, `${id}: geçersiz tarih`);
        assert.equal((await get(id, { ...(report.accountRequired ? { account: ids.A } : {}), from: ago(10), to: ago(20) })).status, 400, `${id}: başlangıç > bitiş`);
      }
      if (report.accountRequired) assert.equal((await get(id, {})).status, 400, `${id}: cari seçilmeden 400`);
    });
  }

  test("ileri tarihli vade yalnız dönemi kapsayınca görünür (senet, verilen çek, taksit)", async () => {
    const future = await must("portföy ileri", get("cek-portfoy", { from: ahead(1), to: ahead(120) }));
    assert.deepEqual(future.rows.map(r => r[3]).sort(), ["SN-1", "VC-1"]);
    const past = await must("portföy geçmiş", get("cek-portfoy", { from: ago(365), to: TODAY }));
    assert.deepEqual(past.rows.map(r => r[3]), ["CK-1"]);
    const next = E.plans.flatMap(p => p.items).filter(it => it.due > TODAY);
    const vade = await must("vade ileri", get("taksit-vadeleri", { from: ahead(1), to: ahead(120) }));
    assert.equal(vade.rows.length, next.length);
    assert.ok(next.length >= 1, "veride ileri vadeli taksit var");
    const vadePast = await must("vade geçmiş", get("taksit-vadeleri", { from: ago(365), to: ago(1) }));
    assert.equal(vadePast.rows.length, E.plans.flatMap(p => p.items).filter(it => it.due <= ago(1)).length);
  });

  test("anahtar toplamlar bağımsız defterle (tüm zamanlar)", async () => {
    const all = { preset: "all" };
    const kasa = await must("kasa", get("kasa-hareketleri", all));
    assert.equal(summaryOf(kasa, "Güncel Kasa (tüm hareketler)"), 2050);
    const bank = await must("banka", get("banka-pos-hareketleri", all));
    assert.equal(summaryOf(bank, "Banka (tüm hareketler)"), -2600);
    assert.equal(summaryOf(bank, "POS / Kredi Kartı (tüm hareketler)"), 900);
    const sales = await must("satış", get("fatura-satis", all));
    assert.deepEqual([summaryOf(sales, "Matrah"), summaryOf(sales, "KDV"), summaryOf(sales, "Ödenecek")], [7400, 1020, 8420]);
    const kdv = await must("kdv", get("kdv-ozeti", all));
    assert.deepEqual([summaryOf(kdv, "Hesaplanan KDV (391)"), summaryOf(kdv, "İndirilecek KDV (191)")], [980, 1600]);
    const list = await must("cari", get("cari-listesi"));
    const bal = name => list.rows.find(r => r[1] === name);
    assert.deepEqual([bal("Ayşe Yılmaz")[7], bal("Bora Ticaret")[7], bal("Cem Kaya")[7], bal("Tedarik AŞ")[7], bal("Tedarik AŞ")[8]], ["160,00 TL", "500,00 TL", "120,00 TL", "5.100,00 TL", "Alacaklı"]);
    const stock = await must("stok", get("stok-durumu"));
    assert.deepEqual(stock.rows.filter(r => r[0] !== "HZM").map(r => [r[0], r[4]]).sort(), [["DFT", "30"], ["KLM", "102"]]);
    const open = await must("açık", get("acik-faturalar"));
    assert.deepEqual([summaryOf(open, "Açık Alacak"), summaryOf(open, "Açık Borç")], [280, 5100]);
    const aging = await must("yaşlandırma", get("alacak-yaslandirma"));
    assert.equal(moneyOf(aging.footer.at(-1)), 4380, "780 müşteri bakiyesi + 3.600 portföydeki senet");
  });

  test("HATA: Cari Mizanı 'Geciken Taksiti Olan' süzgeci yok sayılıyor (bütün cariler listeleniyor)", async () => {
    // Ekran (client/assets/hof-report-center.js:50) Cari Mizanı'nda da "Geciken Taksiti Olan" seçeneğini sunar;
    // sunucu (server/routes/overview.mjs:180) side listesinde "overdue" yok → süzgeç sessizce kalkar.
    const data = await must("mizan geciken", get("mizan", { preset: "all", side: "overdue" }));
    const overdue = ["A", "B", "C", "S"].filter(k => E.plans.some(p => p.acc === k && p.items.some(it => it.due < TODAY && it.remaining > 0))).map(k => accName[k]);
    assert.deepEqual(data.rows.map(r => r[1]).sort(), overdue.sort(), "yalnız geciken taksiti olan cari(ler)");
  });

  test("HATA: Ürün Satış Kârlılığı — TOPLAM satırındaki Brüt Kâr özetteki Brüt Kâr ile çelişiyor", async () => {
    // Satırlarda hizmetin maliyeti/kârı boş (bilinmiyor) → TOPLAM Brüt Kâr yalnız stoklu ürünler; özet ise Net Satış − Maliyet
    // (hizmeti %100 kâr sayar). Aynı sayfada iki farklı "Brüt Kâr" (server/routes/report-center.mjs:733 ↔ 735-740).
    const data = await must("kârlılık", get("urun-satis-karlilik", { preset: "all" }));
    assert.equal(moneyOf(data.footer[col(data, "Brüt Kâr")]), summaryOf(data, "Brüt Kâr"), "TOPLAM Brüt Kâr = özet Brüt Kâr");
  });

  test("yetki: rapor yetkisi olmayan personel bütün raporlarda 403 (ekran, PDF, Excel); işlem geçmişi ayrı yetki", async () => {
    const personel = await createUser(server, admin, { username: "rapor-yok", role: "personel" });
    assert.equal((await personel.get("/api/workspace/report-center")).status, 403, "katalog");
    const avukat = await createUser(server, admin, { username: "rapor-avukat", role: "avukat" });
    const role = unwrap(await admin.post("/api/admin/roles", { name: "Rapor Okuyucu", permissions: ["overview.view", "accounts.view"] }));
    assert.equal(role.status, 200, JSON.stringify(role.data));
    const reader = await createUser(server, admin, { username: "rapor-okur", role: role.data.id });
    let checked = 0;
    for (const id of REPORT_IDS) {
      const q = id === "cari-ekstre" ? `?account=${ids.A}` : "";
      for (const suffix of ["", "/pdf", "/xlsx"]) {
        const url = `/api/workspace/report-center/${id}${suffix}${q}`;
        const denied = await personel.raw("GET", url);
        assert.equal(denied.status, 403, `personel ${url}: ${denied.status}`);
        assert.ok(!denied.buffer.toString("latin1").startsWith("%PDF") && denied.buffer.subarray(0, 2).toString("latin1") !== "PK", `personel ${url}: dosya sızdı`);
        const lawyer = await avukat.raw("GET", url);
        assert.equal(lawyer.status, id === "islem-gecmisi" ? 200 : 403, `avukat ${url}`);
        const r = await reader.raw("GET", url);
        assert.equal(r.status, id === "islem-gecmisi" ? 403 : 200, `rapor okuyucu ${url}`);
        checked += 3;
      }
    }
    assert.equal(checked, REPORT_IDS.length * 9);
  });

  test("özet: denenen rapor × süzgeç birleşimi sayısı", () => {
    console.log(`[raporlar-224] rapor ${stats.reports}, birleşim ${stats.combos}, istek ${stats.requests}, denetlenen TOPLAM kolonu ${stats.footerColumns}`);
    assert.ok(stats.combos > 0);
  });
});
