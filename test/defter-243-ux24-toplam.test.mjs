// 2.4.3 UX24 (uzman UX bulgusu; ürün kararı "her raporda alt TOPLAM satırı; ekran, PDF ve Excel aynı"): KDV Özeti (Beyanname Hazırlığı) ve
// Açık Faturalar ve Yaşlandırma raporlarında yönler (satış/alış, alacak/borç) karışınca TOPLAM satırı hiç çıkmıyordu (footerUniform). Artık her
// yön kendi TOPLAM satırında, altta Net satırı; tek yön kalınca (Cari süzgeci) tek TOPLAM. Ders 11: her süzgeç, TOPLAM = satırlar, PDF/Excel = ekran.
// Eski kodda (78fdd05) kırmızı: footers yok, TOPLAM satırı yok.
//
// KÂHİN (elle; programın kodundan türetilmedi) — bugün 20.10.2026, bütün belgeler Ekim 2026:
//   Satış A  2 × 500 %20  → matrah 1.000, KDV 200 (vade 10.10, açık)
//   Satış B  1 × 500 %10  → matrah   500, KDV  50 (açık)
//   İade A   1 × 500 %20  → matrah   500, KDV 100 (satıştan iade)
//   Alış     1 × 400 %20  → matrah   400, KDV  80 (açık; tedarikçi)
//   KDV Özeti: TOPLAM Satış Belge 2 / Matrah 1.500 / KDV 250; TOPLAM Satıştan İade 1 / 500 / 100; TOPLAM Alış 1 / 400 / 80;
//              Net KDV (Ödenecek) 250 − 100 − 80 = 70 = özetteki Ödenecek KDV.
//   Açık Faturalar: TOPLAM Borç içinde alış 480; her yön = kendi satırları = özetteki Açık Alacak / Açık Borç; Net = Alacak − Borç.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOk, must, pdfText, xlsxSheets } from "./banka-210-ortak.mjs";
import { bootBank } from "./banka-210-hesap-ortak.mjs";

const RC = "/api/workspace/report-center";
const NOW = "2026-10-20T12:00:00+03:00";
const minor = text => {
  const raw = String(text ?? "").trim();
  if (!/TL$/.test(raw)) return null;
  const sign = /^[-−]/.test(raw) ? -1 : 1;
  return sign * Number(raw.replace(/[^\d,]/g, "").replace(",", ""));
};
const count = text => (/^\d+$/.test(String(text ?? "").trim()) ? Number(text) : null);
const qs = query => new URLSearchParams(query).toString();

describe("2.4.3 UX24 — yönü karışık raporlarda ayrı TOPLAM satırları", () => {
  let ctx;
  let api;
  const ids = {};
  before(async () => {
    ctx = await bootBank({ now: NOW });
    api = ctx.api;
    ids.customer = (await must("müşteri", api.post("/api/workspace/accounts", { name: "Toplam Müşteri", type: "customer" }))).id;
    ids.supplier = (await must("tedarikçi", api.post("/api/workspace/accounts", { name: "Toplam Tedarikçi", type: "supplier" }))).id;
    const saleA = await must("satış A", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ids.customer, issueDate: "2026-10-01", lines: [{ name: "Danışmanlık", qty: 2, unitPrice: 500, vatRate: 20 }], payment: { rest: "open", dueDate: "2026-10-10" } }));
    await must("satış B", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ids.customer, issueDate: "2026-10-05", lines: [{ name: "Eğitim", qty: 1, unitPrice: 500, vatRate: 10 }], payment: { rest: "open", dueDate: "2026-11-05" } }));
    const detail = await must("satış A ayrıntı", api.get(`/api/workspace/invoices/${saleA.id}`));
    await must("iade A", api.post("/api/workspace/invoices", { kind: "sale_return", originalId: saleA.id, issueDate: "2026-10-12", lines: [{ originLineId: detail.lines[0].id, qty: 1 }], payment: { rest: "open" }, force: true }));
    await must("alış", api.post("/api/workspace/invoices", { scenario: "expense_purchase", accountId: ids.supplier, number: "AL-UX24", issueDate: "2026-10-08", lines: [{ name: "Ofis Kirası", expenseCode: "rent", qty: 1, unitPrice: 400, vatRate: 20 }], payment: { rest: "open", dueDate: "2026-10-15" } }));
    await integrityOk(api, "veri girildi");
  });
  after(() => ctx?.server.close());

  const totals = data => (Array.isArray(data.footers) ? data.footers : data.footer ? [data.footer] : []);
  // Ekran (JSON) → her TOPLAM satırı kendi yönünün satırlarının toplamı; PDF ve Excel aynı satırları aynı sırayla yazar.
  async function report(id, query, groupColumn, groupsOf, tag) {
    const res = await api.get(`${RC}/${id}?${qs(query)}`);
    assert.equal(res.status, 200, `${tag}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    const data = res.data;
    const lines = totals(data);
    const g = data.headers.indexOf(groupColumn);
    for (const line of lines) {
      const label = line[g];
      const members = groupsOf[label];
      if (!members) continue; // Net ya da tek TOPLAM: ayrıca denetlenir
      const rows = data.rows.filter(row => members.includes(row[g]));
      assert.ok(rows.length, `${tag}: "${label}" satırı var ama yönün satırı yok`);
      data.headers.forEach((header, index) => {
        if (data.types[index] === "money") {
          const sum = rows.map(row => minor(row[index])).filter(value => value !== null).reduce((a, b) => a + b, 0);
          assert.equal(minor(line[index]), sum, `${tag}: ${label} "${header}" = satırlar`);
        }
        if (header === "Belge") assert.equal(count(line[index]), rows.reduce((a, row) => a + count(row[index]), 0), `${tag}: ${label} Belge`);
      });
    }
    const pdf = await api.raw("GET", `${RC}/${id}/pdf?${qs(query)}`);
    assert.equal(pdf.status, 200, `${tag} PDF`);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    for (const line of lines) for (const cell of line) if (String(cell).trim()) assert.ok(text.includes(String(cell).trim()), `${tag} PDF TOPLAM hücresi: "${cell}"`);
    const xlsx = await api.raw("GET", `${RC}/${id}/xlsx?${qs(query)}`);
    assert.equal(xlsx.status, 200, `${tag} Excel`);
    const book = Object.values(xlsxSheets(xlsx.buffer))[0];
    const sheet = book.slice(Math.max(0, book.findIndex(row => row.length > 1)));
    assert.equal(sheet.length, 1 + data.rows.length + (data.rows.length ? lines.length : 0), `${tag} Excel satır sayısı (başlık + satırlar + TOPLAM satırları)`);
    lines.forEach((line, k) => {
      const got = sheet[1 + data.rows.length + k];
      line.forEach((cell, c) => {
        const want = minor(cell);
        if (want !== null) assert.equal(typeof got[c] === "number" ? Math.round(got[c] * 100) : minor(got[c]), want, `${tag} Excel TOPLAM ${k + 1} ${data.headers[c]}`);
        else if (String(cell).trim()) assert.equal(String(got[c]).trim(), String(cell).trim(), `${tag} Excel TOPLAM ${k + 1} ${data.headers[c]}`);
      });
    });
    return { data, lines, g };
  }
  const KDV_GROUPS = { "TOPLAM Satış": ["Satış", "Serbest Meslek Makbuzu"], "TOPLAM Satıştan İade": ["Satıştan İade"], "TOPLAM Alış": ["Alış"], "TOPLAM Alıştan İade": ["Alıştan İade"] };
  const OPEN_GROUPS = { "TOPLAM Alacak": ["Alacak (Satış)", "Alacak (Alıştan İade)"], "TOPLAM Borç": ["Borç (Alış)", "Borç (Satıştan İade)"] };

  it("KDV Özeti: TOPLAM Satış / Satıştan İade / Alış ve Net KDV = özetteki Ödenecek KDV (kâhin)", async () => {
    const { data, lines, g } = await report("kdv-ozeti", { preset: "thisYear" }, "Belge Türü", KDV_GROUPS, "kdv-ozeti Bu Yıl");
    const by = Object.fromEntries(lines.map(line => [line[g], line]));
    assert.deepEqual(lines.map(line => line[g]), ["TOPLAM Satış", "TOPLAM Satıştan İade", "TOPLAM Alış", "Net KDV (Ödenecek)"], "TOPLAM satırlarının sırası");
    const col = name => data.headers.indexOf(name);
    assert.deepEqual([count(by["TOPLAM Satış"][col("Belge")]), minor(by["TOPLAM Satış"][col("Matrah")]), minor(by["TOPLAM Satış"][col("KDV")])], [2, 150000, 25000], "TOPLAM Satış (kâhin)");
    assert.deepEqual([count(by["TOPLAM Satıştan İade"][col("Belge")]), minor(by["TOPLAM Satıştan İade"][col("Matrah")]), minor(by["TOPLAM Satıştan İade"][col("KDV")])], [1, 50000, 10000], "TOPLAM Satıştan İade (kâhin)");
    assert.deepEqual([count(by["TOPLAM Alış"][col("Belge")]), minor(by["TOPLAM Alış"][col("Matrah")]), minor(by["TOPLAM Alış"][col("KDV")])], [1, 40000, 8000], "TOPLAM Alış (kâhin)");
    assert.equal(minor(by["Net KDV (Ödenecek)"][col("KDV")]), 7000, "Net KDV (kâhin 250 − 100 − 80)");
    const payable = data.summary.find(([label]) => label === "Ödenecek KDV");
    assert.ok(payable, "özette Ödenecek KDV");
    assert.equal(minor(payable[1]), 7000, "özet = Net satırı");
    assert.equal(by["Net KDV (Ödenecek)"][col("Matrah")], "", "Net satırında matrah toplanmaz");
  });

  it("KDV Özeti süzgeçleri: Geçen Ay (boş) TOPLAM yok; Tüm Zamanlar = Bu Yıl", async () => {
    const empty = await report("kdv-ozeti", { preset: "lastMonth" }, "Belge Türü", KDV_GROUPS, "kdv-ozeti Geçen Ay");
    assert.equal(empty.data.rows.length, 0);
    assert.equal(empty.lines.length, 0, "boş dönemde TOPLAM satırı yok");
    const all = await report("kdv-ozeti", { preset: "all" }, "Belge Türü", KDV_GROUPS, "kdv-ozeti Tüm Zamanlar");
    assert.equal(all.lines.length, 4);
  });

  it("Açık Faturalar: TOPLAM Alacak / TOPLAM Borç = özetteki Açık Alacak / Açık Borç; Net = fark", async () => {
    const { data, lines, g } = await report("acik-faturalar", {}, "Taraf", OPEN_GROUPS, "acik-faturalar");
    const labels = lines.map(line => line[g]);
    assert.equal(labels[0], "TOPLAM Alacak");
    assert.equal(labels[1], "TOPLAM Borç");
    assert.match(labels[2], /^Net \((Alacak|Borç) Fazlası\)$/);
    const kalan = data.headers.indexOf("Kalan");
    const summary = Object.fromEntries(data.summary);
    assert.equal(minor(lines[0][kalan]), minor(summary["Açık Alacak"]), "TOPLAM Alacak = Açık Alacak");
    assert.equal(minor(lines[1][kalan]), minor(summary["Açık Borç"]), "TOPLAM Borç = Açık Borç");
    assert.ok(minor(lines[1][kalan]) >= 48000, "alış 480 TOPLAM Borç'ta (kâhin)");
    const net = minor(lines[0][kalan]) - minor(lines[1][kalan]);
    assert.equal(minor(lines[2][kalan]), Math.abs(net), "Net = Alacak − Borç");
    assert.equal(labels[2], net >= 0 ? "Net (Alacak Fazlası)" : "Net (Borç Fazlası)");
  });

  it("Açık Faturalar Cari süzgeci: tedarikçide tek yön → tek TOPLAM satırı = satırlar", async () => {
    const { data, lines } = await report("acik-faturalar", { account: ids.supplier }, "Taraf", OPEN_GROUPS, "acik-faturalar tedarikçi");
    assert.equal(lines.length, 1, "tek yön: tek TOPLAM");
    assert.ok(lines[0].includes("TOPLAM"));
    const kalan = data.headers.indexOf("Kalan");
    assert.equal(minor(lines[0][kalan]), data.rows.reduce((a, row) => a + minor(row[kalan]), 0));
    assert.equal(minor(lines[0][kalan]), 48000, "tedarikçi açık 480 (kâhin)");
    await report("acik-faturalar", { account: ids.customer }, "Taraf", OPEN_GROUPS, "acik-faturalar müşteri");
  });
});
