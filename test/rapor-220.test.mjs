// Raporlar 2.0.20 — kullanıcı istekleri (CLAUDE.md "2.0.20 YAPILACAKLAR" 1–5, 8):
//   1. her raporun altında TOPLAM satırı (ekran/PDF/Excel aynı; yalnız toplanabilir kolonlar; tüm satırlardan)
//   2. Cari Listesi: Toplam Borç (Anlaşılan) · Toplam Alacak (Ödenen) · Kalan
//   3. dönemli raporlar ilk açılışta "Bu Yıl" (Bu Ay ayın başında eski kayıtları gizliyordu)
//   8. Excel'den yüklenen "Ödenen" (açılış) tahsilat raporlarının TOPLAMINA dahil, ayrı kolonda görünür
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { inflateSync } from "node:zlib";
import { cellNumber, footerRow } from "../server/routes/report-center.mjs";
import { readZip } from "../server/lib/zip.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const TODAY = new Date().toISOString().slice(0, 10);
const shift = days => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const trDay = iso => iso.split("-").reverse().join(".");
// Bağımsız para okuyucu (rapor kodundaki ayrıştırıcıdan farklı yöntem): "1.234,56 TL" → 1234.56.
const tl = text => {
  const raw = String(text ?? "").trim();
  if (!/TL$/.test(raw)) return null;
  return Number(raw.replace(/[^\d,-]/g, "").replace(",", "."));
};
const unwrap = response => response.data?.data ?? response.data;

// PDF'teki görünen metin (fatura-216 ile aynı yöntem).
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
const sheetXml = buffer => readZip(buffer).find(entry => entry.name === "xl/worksheets/sheet1.xml").data.toString("utf8");

describe("TOPLAM satırı kuralları (footerRow)", () => {
  it("para ve sayı kolonlarını toplar; yürüyen bakiye, birim fiyat, oran boş; etiket ilk metin kolonunda", () => {
    const footer = footerRow({
      headers: ["Tarih", "Açıklama", "Giriş", "Çıkış", "Bakiye", "Birim Fiyat", "Adet"],
      types: ["", "", "money", "money", "money", "money", "number"],
      rows: [
        ["01.10.2026", "a", "1.000,50 TL", "", "1.000,50 TL", "10,00 TL", "2"],
        ["02.10.2026", "b", "", "-250,25 TL", "750,25 TL", "12,00 TL", "1.500"],
        ["03.10.2026", "c", "12.345.678,00 TL", "1,00 TL", "x", "", ""],
      ],
    });
    assert.deepEqual(footer, ["TOPLAM", "", "12.346.678,50 TL", "-249,25 TL", "", "", "1.502"]);
  });
  it("miktar yalnız tek birimde toplanır; yön karışıkken (footerUniform) toplam yok; false kapatır; üstüne yazma", () => {
    const base = { headers: ["Kalem", "Mevcut", "Birim", "Değer"], types: ["", "number", "", "money"] };
    assert.deepEqual(footerRow({ ...base, rows: [["a", "2", "Adet", "10,00 TL"], ["b", "3", "Kg", "5,00 TL"]] }), ["TOPLAM", "", "", "15,00 TL"]);
    assert.deepEqual(footerRow({ ...base, rows: [["a", "2", "Adet", "10,00 TL"], ["b", "3", "Adet", "5,00 TL"]] }), ["TOPLAM", "5", "", "15,00 TL"]);
    const mixed = { headers: ["Yön", "Tutar"], types: ["", "money"] };
    assert.equal(footerRow({ ...mixed, rows: [["Alınan", "1,00 TL"], ["Verilen", "2,00 TL"]], footerUniform: "Yön" }), null);
    assert.deepEqual(footerRow({ ...mixed, rows: [["Alınan", "1,00 TL"], ["Alınan", "2,00 TL"]], footerUniform: "Yön" }), ["TOPLAM", "3,00 TL"]);
    assert.equal(footerRow({ ...mixed, rows: [["Alınan", "1,00 TL"]], footer: false }), null);
    assert.equal(footerRow({ ...mixed, rows: [] }), null, "boş raporda TOPLAM yok");
    assert.deepEqual(footerRow({ headers: ["Cari", "Bakiye", "Durum"], types: ["", "money", ""], rows: [["a", "5,00 TL", "Borçlu"]], footer: { Bakiye: "5,00 TL", Durum: "Borçlu" } }), ["TOPLAM", "5,00 TL", "Borçlu"]);
    assert.equal(cellNumber("1.234,56 TL", "money"), 1234.56);
    assert.equal(cellNumber("%20", "number"), null);
    assert.equal(cellNumber("12,5", "number"), 12.5);
  });
});

describe("Kullanıcının senaryosu: 10 müşteri × 10.000, ilk taksitler ödenmiş", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
  });
  after(() => server.close());

  it("programda tahsil: Cari Listesi 100.000 / 10.000 / 90.000; TOPLAM satırları; Taksit Kartları ve Mizan aynı", async () => {
    const ids = [];
    for (let i = 1; i <= 10; i += 1) ids.push(unwrap(await admin.post("/api/workspace/accounts", { name: `Müşteri ${i}`, type: "customer", phone: `0532 100 00 ${String(i).padStart(2, "0")}` })).id);
    assert.equal((await admin.post("/api/workspace/accounts/bulk-plan", { ids, total: "10.000", count: 10, firstDue: TODAY })).status, 200);
    for (const plan of unwrap(await admin.get("/api/workspace/plans?status=all")).plans) assert.equal((await admin.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "1.000", date: TODAY })).status, 200);

    const list = unwrap(await admin.get("/api/workspace/report-center/cari-listesi"));
    const summary = Object.fromEntries(list.summary);
    assert.equal(tl(summary["Toplam Borç (Anlaşılan)"]), 100000);
    assert.equal(tl(summary["Toplam Alacak (Ödenen)"]), 10000);
    assert.equal(tl(summary["Kalan (Borçlu)"]), 90000);
    const col = (report, header) => report.footer[report.headers.indexOf(header)];
    assert.equal(tl(col(list, "Borç")), 100000);
    assert.equal(tl(col(list, "Alacak")), 10000);
    assert.equal(tl(col(list, "Bakiye")), 90000);
    assert.equal(col(list, "Durum"), "Borçlu");

    const cards = unwrap(await admin.get("/api/workspace/report-center/taksit-kartlari"));
    assert.deepEqual(["Toplam", "Ödenen", "Kalan"].map(header => tl(col(cards, header))), [100000, 10000, 90000]);

    // Varsayılan dönem (preset gönderilmeden) Bu Yıl: bugünkü kayıtlar Mizan'da.
    const mizan = unwrap(await admin.get("/api/workspace/report-center/mizan"));
    assert.match(mizan.subtitle, new RegExp(`01\\.01\\.${TODAY.slice(0, 4)}`));
    assert.deepEqual(["Borç", "Alacak", "Bakiye"].map(header => tl(col(mizan, header))), [100000, 10000, 90000]);
    const overview = unwrap(await admin.get("/api/workspace/overview/mizan"));
    assert.equal(overview.from, `${TODAY.slice(0, 4)}-01-01`, "Raporlar → Cari Ekstre (Mizan) de Bu Yıl ile açılır");
  });

  it("Excel'den yüklenen 'Ödenen' (açılış): Cari Bazında Tahsilat ve Taksit Tahsilatları toplamına dahil", async () => {
    const matrix = [["Ad Soyad", "Telefon", "Toplam Tutar", "Taksit Sayısı", "İlk Vade", "Ödenen"]];
    for (let i = 1; i <= 10; i += 1) matrix.push([`Excel Müşteri ${i}`, `0533 200 00 ${String(i).padStart(2, "0")}`, "10.000", "10", trDay(shift(-20)), "1.000"]);
    const preview = unwrap(await admin.post("/api/workspace/plans/import/preview", { matrix }));
    const done = await admin.post("/api/workspace/plans/import", { matrix, headerAt: preview.headerAt, roles: preview.roles, fileName: "taksit.xlsx" });
    assert.equal(done.status, 200, JSON.stringify(done.data));

    const report = unwrap(await admin.get("/api/workspace/report-center/cari-tahsilat"));
    const summary = Object.fromEntries(report.summary);
    assert.equal(tl(summary["Önceden Ödenen (Açılış)"]), 10000, "Excel'de ödenmiş 10 × 1.000 ayrı kalemde");
    assert.equal(tl(summary["Taksit Tahsilatı"]), 10000, "programda alınan 10 × 1.000");
    assert.equal(tl(summary.Toplam), 20000, "toplam ikisini birden toplar");
    const row = report.rows.find(item => item[1] === "Excel Müşteri 1");
    assert.equal(tl(row[report.headers.indexOf("Önceden Ödenen (Açılış)")]), 1000);
    assert.equal(tl(row[report.headers.indexOf("Toplam")]), 1000);
    assert.equal(tl(report.footer[report.headers.indexOf("Toplam")]), 20000, "TOPLAM satırı = özet");

    const plan = unwrap(await admin.get("/api/workspace/report-center/taksit-tahsilatlari"));
    const planSummary = Object.fromEntries(plan.summary);
    assert.equal(tl(planSummary["Toplam Tahsil Edilen"]), 20000);
    assert.equal(tl(plan.footer[plan.headers.indexOf("Tutar")]), 20000);
  });
});

describe("Bütün raporlar: TOPLAM = satırların toplamı; PDF ve Excel aynı satırı taşır", () => {
  let server;
  let admin;
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    const make = async name => unwrap(await admin.post("/api/workspace/accounts", { name, type: "customer", phone: `0532 ${Math.floor(1e6 + Math.random() * 8e6)}` })).id;
    const supplier = unwrap(await admin.post("/api/workspace/accounts", { name: "Tedarikçi A", type: "supplier" })).id;
    const a = await make("Ali Yılmaz");
    const b = await make("Beyza Kaya");
    await admin.post(`/api/workspace/accounts/${a}/entries`, { kind: "in", amount: "300", date: TODAY });
    assert.equal((await admin.post("/api/workspace/accounts/bulk-plan", { ids: [b], total: "1.200", count: 3, firstDue: TODAY })).status, 200);
    const plan = unwrap(await admin.get("/api/workspace/plans?status=all")).plans[0];
    await admin.post(`/api/workspace/plans/${plan.id}/entries`, { kind: "in", amount: "400", date: TODAY });
    const kalem = unwrap(await admin.post("/api/workspace/stock", { name: "Çay", unit: "Kg", unitPrice: "100", openingQty: "20", openingPay: "none", openingDate: TODAY })).id;
    await admin.post("/api/workspace/stock", { name: "Bardak", unit: "Adet", unitPrice: "5", openingQty: "100", openingPay: "none", openingDate: TODAY });
    const inv = async (accountId, scenario, lines, payment, extra = {}) => {
      const response = await admin.post("/api/workspace/invoices", { scenario, accountId, issueDate: TODAY, lines, payment, ...extra });
      assert.equal(response.status, 200, JSON.stringify(response.data));
    };
    await inv(a, "goods_sale", [{ itemId: kalem, qty: 2, unitPrice: 150, vatRate: 20 }], { cash: [{ amount: 100, method: "cash" }], rest: "open" });
    await inv(b, "service_sale", [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }], { rest: "open" });
    await inv(supplier, "goods_purchase", [{ itemId: kalem, qty: 5, unitPrice: 80, vatRate: 10 }], { rest: "open" }, { number: "TED-1" });
    await admin.post("/api/workspace/cheques", { instrument: "cheque", direction: "in", accountId: a, drawer: "X", amount: 250, issueDate: TODAY, dueDate: shift(30), serialNo: "CK-1", bank: "Ziraat" });
    await admin.post("/api/workspace/cheques", { instrument: "note", direction: "out", accountId: supplier, drawer: "Biz", amount: 180, issueDate: TODAY, dueDate: shift(45), serialNo: "SN-1" });
  });
  after(() => server.close());

  it("her raporda TOPLAM (varsa) satır toplamına eşit; ekran = PDF = Excel", async () => {
    const catalog = unwrap(await admin.get("/api/workspace/report-center")).reports;
    assert.ok(catalog.length >= 43);
    let withFooter = 0;
    const without = [];
    for (const report of catalog) {
      if (report.accountRequired) continue;
      const data = unwrap(await admin.get(`/api/workspace/report-center/${report.id}?preset=all`));
      if (!data.footer) {
        without.push(`${report.id}(${data.total})`);
        continue;
      }
      withFooter += 1;
      assert.equal(data.footer.length, data.headers.length, `${report.id}: kolon sayısı`);
      assert.ok(data.footer.includes("TOPLAM"), `${report.id}: TOPLAM etiketi`);
      // Ön izleme ilk 200 satırdır; satır toplamı karşılaştırması bütün satırlar ekrandayken yapılır (TOPLAM hep tüm satırlardan).
      if (data.total <= data.rows.length) data.headers.forEach((header, index) => {
        if (data.types[index] !== "money") return;
        const value = tl(data.footer[index]);
        if (value === null || /^(Bakiye)$/.test(header)) return;
        const sum = Math.round(data.rows.reduce((total, row) => total + (tl(row[index]) ?? 0), 0) * 100) / 100;
        assert.equal(value, sum, `${report.id} · ${header}: TOPLAM ${data.footer[index]} ≠ satırlar ${sum}`);
      });
      const pdf = await admin.raw("GET", `/api/workspace/report-center/${report.id}/pdf?preset=all`);
      assert.equal(pdf.status, 200);
      const text = pdfText(pdf.buffer);
      assert.match(text, /TOPLAM/, `${report.id}: PDF'te TOPLAM satırı`);
      const firstMoney = data.footer.find(cell => /TL$/.test(cell));
      if (firstMoney) assert.ok(text.includes(firstMoney), `${report.id}: PDF'te ${firstMoney}`);
      const xlsx = await admin.raw("GET", `/api/workspace/report-center/${report.id}/xlsx?preset=all`);
      const xml = sheetXml(xlsx.buffer);
      const rowsInSheet = [...xml.matchAll(/<row r="(\d+)">/g)].map(match => Number(match[1]));
      assert.equal(Math.max(...rowsInSheet), data.total + 2, `${report.id}: Excel'de TOPLAM verinin altında`);
      assert.match(xml.split(`<row r="${data.total + 2}">`)[1], /TOPLAM/, `${report.id}: Excel TOPLAM satırı`);
      if (/<autoFilter/.test(xml)) assert.match(xml, new RegExp(`<autoFilter ref="A1:[A-Z]+${data.total + 1}"/>`), `${report.id}: süzgeç TOPLAM'ı kapsamaz`);
    }
    console.log(`TOPLAM yok: ${without.join(", ")}`);
    assert.ok(withFooter >= 20, `TOPLAM satırı olan rapor sayısı ${withFooter}`);
  });

  it("Tüm Zamanlar: çek portföyü ve taksit vadelerinde ileri vadeler de gelir; Aylık Kasa ilk hareketten başlar", async () => {
    const portfolio = unwrap(await admin.get("/api/workspace/report-center/cek-portfoy?preset=all&status=all"));
    assert.equal(portfolio.rows.length, 2, "vadesi 30 ve 45 gün sonra olan iki evrak portföyde");
    const dues = unwrap(await admin.get("/api/workspace/report-center/taksit-vadeleri?preset=all"));
    assert.equal(dues.rows.length, 3, "3 taksitin hepsi (ikisi ileri tarihli)");
    const monthly = unwrap(await admin.get("/api/workspace/report-center/kasa-aylik?preset=all"));
    assert.ok(monthly.rows.length <= 2, `aylık kasa ${monthly.rows.length} ay (50 yıllık boş ay yok)`);
  });

  it("yön karışık raporlarda (çek portföyü, açık faturalar) TOPLAM yalnız tek yön süzülünce; stokta farklı birim toplanmaz", async () => {
    const both = unwrap(await admin.get("/api/workspace/report-center/cek-portfoy?preset=all&status=all"));
    assert.equal(both.footer, null, "alınan + verilen evrak toplanmaz");
    const incoming = unwrap(await admin.get("/api/workspace/report-center/cek-portfoy?preset=all&status=all&direction=in"));
    assert.equal(tl(incoming.footer[incoming.headers.indexOf("Tutar")]), 250);
    const open = unwrap(await admin.get("/api/workspace/report-center/acik-faturalar"));
    assert.equal(open.footer, null, "açık alacak ve açık borç toplanmaz");
    const stock = unwrap(await admin.get("/api/workspace/report-center/stok-durumu"));
    assert.equal(stock.footer[stock.headers.indexOf("Mevcut")], "", "Kg + Adet toplanmaz");
    assert.ok(tl(stock.footer[stock.headers.indexOf("Değer")]) > 0, "stok değeri toplanır");
  });

  it("katalog: dönemli raporlar Bu Yıl ile açılır (vade listesi Bu Ay, Ba-Bs Geçen Ay kalır)", async () => {
    const catalog = Object.fromEntries(unwrap(await admin.get("/api/workspace/report-center")).reports.map(report => [report.id, report.preset]));
    for (const id of ["fatura-satis", "cari-satis-alis", "mizan", "cari-tahsilat", "kasa-hareketleri", "cari-hareketleri", "taksit-tahsilatlari"]) assert.equal(catalog[id], "thisYear", id);
    assert.equal(catalog["taksit-vadeleri"], "thisMonth");
    assert.equal(catalog["ba-bs"], "lastMonth");
    assert.ok(!Object.values(catalog).includes("thisMonth") || Object.entries(catalog).filter(([, preset]) => preset === "thisMonth").every(([id]) => id === "taksit-vadeleri"));
  });

  it("Raporlar → Cari Ekstre (Mizan) PDF ve Excel'inde TOPLAM; Excel'de süzgeç dışında", async () => {
    const pdf = await admin.raw("GET", "/api/workspace/overview/mizan.pdf?preset=all");
    assert.match(pdfText(pdf.buffer), /TOPLAM/);
    const xlsx = await admin.raw("GET", "/api/workspace/overview/mizan.xlsx?preset=all");
    const xml = sheetXml(xlsx.buffer);
    const last = Math.max(...[...xml.matchAll(/<row r="(\d+)">/g)].map(match => Number(match[1])));
    assert.match(xml.split(`<row r="${last}">`)[1], /TOPLAM/);
    assert.match(xml, new RegExp(`<autoFilter ref="A1:[A-Z]+${last - 1}"/>`));
  });
});
