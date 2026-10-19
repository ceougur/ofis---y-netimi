// 2.4.3 — Uzman mali müşavir rapor bulguları (kullanıcı kararları 18.10.2026):
//   MM5 Alacak Yaşlandırma faturasız cari borcunu da yaşlandırır (bakiye − taksit − açık fatura = "Faturasız", hareket tarihiyle; kaleme bağlanmamış
//       tahsilat en eski kalemden düşer); carinin dilimleri = borç bakiyesi; şüpheli kolonu adıyla tutarlı (dilimlere dahil). Nakit Akışı'nın gecikmiş
//       girişlerinde faturasız cari alacağı da görünür.
//   MM6 Banka Nakit Akış Raporu Çek Hesabı bağlı verilen çeki vadesinde çıkış sayar (Genel Nakit Akışı gibi).
//   MM7 Stok Durumu ve Stok Hareket Özeti aynı gün aynı stok değerini verir (eksi stokta eksi değer; v2.0.17 kuralı).
//   MM8 Yevmiye Defteri özetindeki madde sayısı gerçek madde (fiş) sayısıdır.
//   MM9 Cari Listesi özetinde Müşteri Alacakları ve Tedarikçi Borçları ayrı; net açık adla.
// Her raporda ders 11: her süzgeç seçeneği, TOPLAM = satırlar, PDF ve Excel = ekran. Eski kodda (78fdd05) kırmızı.
//
// KÂHİN (elle; programın kodundan türetilmedi) — bugün 20.10.2026:
//   Eski Müşteri   Borç Yaz "Açılış bakiyesi (2025 devri)" 5.000 (02.01.2026, 291 gün)        → 90+ 5.000, faturasız 5.000
//   Çekli Müşteri  Borç Yaz 2.000 (20.07), çek 2.000 alındı (cari kapandı), karşılıksız 16.08 (65 gün; FIFO: açık kalan en yeni borç) ve Şüpheli
//                  Alacağa Al 2.000                                                              → 61–90 2.000, faturasız 2.000, şüpheli 2.000
//   Faturalı       satış faturası 1.200 vade 10.10 (10 gün) + Borç Yaz 300 (15.10, 5 gün)      → 1–30 1.500 (fatura 1.200 + faturasız 300)
//   Avanslı        taksit kartı 3 × 1.000 (vade 01.09, 01.10, 01.11) + kaleme bağlanmamış tahsilat 1.500 → FIFO: 01.09 kapanır, 01.10'dan 500 kalır
//                  → 1–30 500 (19 gün), vadesi gelmemiş 1.000; bakiye 1.500
//   Çek Veren      Borç Yaz 700 (01.10) − çek 700 alındı (vade 05.11): bakiye 0 → cari kalemi yok; portföydeki çek 700 vadesi gelmemiş
//   Alacaklı Müşteri avans 400 (bakiye alacaklı) → satır yok; Tedarikçi A.Ş. Alacak Yaz 5.000 − verilen çekler 3.000 = 2.000 alacaklı → satır yok
//   Cari toplamı = borçlu cari bakiyeleri 5.000 + 2.000 + 1.500 + 1.500 = 10.000; portföy çeki 700; rapor Toplam 10.700.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { integrityOk, must, pdfText, xlsxSheets } from "./banka-210-ortak.mjs";
import { BANK, bootBank, openAccount } from "./banka-210-hesap-ortak.mjs";

const RC = "/api/workspace/report-center";
const NOW = "2026-10-20T12:00:00+03:00";
const NO_SUM = new Set(["Bakiye", "Birim Fiyat", "Kritik Seviye", "Vade Gecikme (Gün)", "Beklenen Gerçek Banka"]);
// Bağımsız para okuyucu: "1.234,56 TL" / "-1.234,56 TL" → kuruş.
const minor = text => {
  const raw = String(text ?? "").trim();
  if (!/TL$/.test(raw)) return null;
  const sign = /^[-−]/.test(raw) ? -1 : 1;
  return sign * Number(raw.replace(/[^\d,]/g, "").replace(",", "")) ;
};
const qs = query => new URLSearchParams(query).toString();

describe("2.4.3 MM5–MM9 — rapor düzeltmeleri", () => {
  let ctx;
  let api;
  let ziraat;
  const ids = {};
  before(async () => {
    ctx = await bootBank({ now: NOW });
    api = ctx.api;
    await must("sihirbazı kapat", api.post(`${BANK}/setup/dismiss`, {}));
    ziraat = await openAccount(api, { bankName: "Ziraat Bankası", name: "Ana TL", kind: "demand", useCheque: true, opening: { date: "2026-10-01", amount: "50.000", confirmed: true } });
    const acc = async (name, type = "customer") => (ids[name] = (await must(name, api.post("/api/workspace/accounts", { name, type }))).id);
    await acc("Eski Müşteri");
    await acc("Çekli Müşteri");
    await acc("Faturalı Müşteri");
    await acc("Avanslı Müşteri");
    await acc("Çek Veren");
    await acc("Alacaklı Müşteri");
    await acc("Tedarikçi A.Ş.", "supplier");
    const entry = (name, body) => must(`${name} ${body.kind}`, api.post(`/api/workspace/accounts/${ids[name]}/entries`, body));
    await entry("Eski Müşteri", { kind: "debt", amount: "5.000", date: "2026-01-02", note: "Açılış bakiyesi (2025 devri)" });
    await entry("Çekli Müşteri", { kind: "debt", amount: "2.000", date: "2026-07-20", note: "Mal satışı" });
    const cheque = await must("çek al", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", serialNo: "C-9", bank: "Akbank", accountId: ids["Çekli Müşteri"], amount: "2.000", issueDate: "2026-08-01", dueDate: "2026-08-15" }));
    await must("karşılıksız", api.post(`/api/workspace/cheques/${cheque.id}/actions`, { action: "bounce", date: "2026-08-16" }));
    await must("şüpheli", api.post(`/api/workspace/accounts/${ids["Çekli Müşteri"]}/doubtful`, { amount: "2.000", date: "2026-10-01", reason: "cheque", chequeId: cheque.id }));
    await must("fatura", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: ids["Faturalı Müşteri"], issueDate: "2026-10-01", lines: [{ name: "Danışmanlık", qty: 1, unitPrice: 1000, vatRate: 20 }], payment: { rest: "open", dueDate: "2026-10-10" } }));
    await entry("Faturalı Müşteri", { kind: "debt", amount: "300", date: "2026-10-15", note: "Kargo bedeli" });
    await must("taksit kartı", api.post("/api/workspace/plans", { accountId: ids["Avanslı Müşteri"], name: "Avanslı Müşteri", total: "3.000", registeredOn: "2026-08-25", mode: "auto", count: 3, firstDue: "2026-09-01", everyMonths: 1 }));
    await entry("Avanslı Müşteri", { kind: "in", amount: "1.500", date: "2026-10-05", method: "cash" });
    await entry("Çek Veren", { kind: "debt", amount: "700", date: "2026-10-01" });
    await must("çek veren çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", serialNo: "C-10", bank: "Garanti", accountId: ids["Çek Veren"], amount: "700", issueDate: "2026-10-02", dueDate: "2026-11-05" }));
    await entry("Alacaklı Müşteri", { kind: "in", amount: "400", date: "2026-10-03", method: "cash" });
    await entry("Tedarikçi A.Ş.", { kind: "credit", amount: "5.000", date: "2026-09-20", note: "Mal alımı" });
    // MM6: Çek Hesabı bağlı verilen çek (vade 25.10) ve hesabı olmayan verilen senet (vade 28.10).
    await must("verilen çek (Çek Hesabı)", api.post("/api/workspace/cheques", { direction: "out", instrument: "cheque", serialNo: "K-501", accountId: ids["Tedarikçi A.Ş."], amount: "2.000", issueDate: "2026-10-02", dueDate: "2026-10-25", bankAccountId: ziraat.id }));
    // Tek Çek Hesabı verilen çeke kendiliğinden önerilir (banka-220-cek-hesabi); hesabı olmayan evrak: Senet Kullan işaretli hesap yok → senet hesapsız.
    await must("verilen senet (hesapsız)", api.post("/api/workspace/cheques", { direction: "out", instrument: "note", serialNo: "S-502", accountId: ids["Tedarikçi A.Ş."], amount: "1.000", issueDate: "2026-10-02", dueDate: "2026-10-28" }));
    // MM7: eksi stok — P2 10 Adet açılış × 8 TL, 60 Adet satış (eksi 50 × 8 = −400); P1 100 × 50.
    const p1 = await must("P1", api.post("/api/workspace/stock", { name: "P1", unit: "Adet", unitPrice: "50", openingQty: "100", openingDate: "2026-10-01" }));
    const p2 = await must("P2", api.post("/api/workspace/stock", { name: "P2", unit: "Kg", unitPrice: "8", openingQty: "10", openingDate: "2026-10-01" }));
    await must("eksi satış", api.post(`/api/workspace/stock/${p2.id}/moves`, { kind: "out", qty: "60", unitPrice: "12", pay: "none", date: "2026-10-10", force: true }));
    ids.p1 = p1.id;
    await integrityOk(api, "veri girildi");
  });
  after(() => ctx?.server.close());

  // ---------- Ortak: TOPLAM = satırlar; PDF ve Excel = ekran (ders 11) ----------
  async function report(id, query = {}, tag = id) {
    const res = await api.get(`${RC}/${id}?${qs(query)}`);
    assert.equal(res.status, 200, `${tag}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    const data = res.data;
    for (const row of data.rows) assert.equal(row.length, data.headers.length, `${tag}: kolon sayısı`);
    if (data.footer && data.rows.length) {
      data.headers.forEach((header, index) => {
        if (data.types[index] !== "money") return;
        if (NO_SUM.has(header)) return;
        const values = data.rows.map(row => minor(row[index])).filter(value => value !== null);
        if (!values.length) return;
        assert.equal(minor(data.footer[index]), values.reduce((a, b) => a + b, 0), `${tag}: TOPLAM "${header}"`);
      });
    }
    const pdf = await api.raw("GET", `${RC}/${id}/pdf?${qs(query)}`);
    assert.equal(pdf.status, 200, `${tag} PDF`);
    const text = pdfText(pdf.buffer).replace(/\s+/g, " ");
    for (const row of data.rows) for (const cell of row) if (minor(cell) !== null) assert.ok(text.includes(String(cell).trim()), `${tag} PDF: "${cell}"`);
    for (const [key, value] of data.summary) assert.ok(text.includes(key) && text.includes(value), `${tag} PDF özet: ${key} ${value}`);
    const xlsx = await api.raw("GET", `${RC}/${id}/xlsx?${qs(query)}`);
    assert.equal(xlsx.status, 200, `${tag} Excel`);
    const book = Object.values(xlsxSheets(xlsx.buffer))[0];
    const sheet = book.slice(Math.max(0, book.findIndex(row => row.length > 1)));
    assert.deepEqual(sheet[0], data.headers, `${tag} Excel başlık`);
    assert.equal(sheet.length, 1 + data.rows.length + (data.footer && data.rows.length ? 1 : 0), `${tag} Excel satır sayısı`);
    data.rows.forEach((row, r) => row.forEach((cell, c) => {
      const want = minor(cell);
      if (want === null) return;
      const got = sheet[r + 1]?.[c];
      assert.equal(typeof got === "number" ? Math.round(got * 100) : minor(got), want, `${tag} Excel satır ${r + 1} ${data.headers[c]}`);
    }));
    return data;
  }
  const rowOf = (data, name) => data.rows.find(row => row[0] === name);
  const cell = (data, row, header) => minor(row[data.headers.indexOf(header)]) ?? 0;
  const summary = (data, key) => {
    const hit = data.summary.find(([name]) => name === key);
    assert.ok(hit, `özette "${key}" yok: ${JSON.stringify(data.summary)}`);
    return minor(hit[1]) ?? hit[1];
  };

  it("MM5: Alacak Yaşlandırma faturasız borcu hareket tarihiyle yaşlandırır; carinin dilimleri = borç bakiyesi; toplam 10.700 (kâhin)", async () => {
    const data = await report("alacak-yaslandirma");
    const expect = {
      "Eski Müşteri": { "90+ Gün": 500000, "Faturasız Alacak (dilimlere dahil)": 500000, Toplam: 500000, gap: "291" },
      "Çekli Müşteri": { "61–90 Gün": 200000, "Faturasız Alacak (dilimlere dahil)": 200000, "Şüpheli Alacak (dilimlere dahil)": 200000, Toplam: 200000, gap: "65" },
      "Faturalı Müşteri": { "1–30 Gün": 150000, "Faturasız Alacak (dilimlere dahil)": 30000, Toplam: 150000, gap: "10" },
      "Avanslı Müşteri": { "1–30 Gün": 50000, "Vadesi Gelmemiş": 100000, Toplam: 150000, gap: "19" },
      "Çek Veren": { "Vadesi Gelmemiş": 70000, Toplam: 70000, gap: "" },
    };
    for (const [name, want] of Object.entries(expect)) {
      const row = rowOf(data, name);
      assert.ok(row, `${name} satırı yok: ${JSON.stringify(data.rows)}`);
      for (const header of ["Vadesi Gelmemiş", "1–30 Gün", "31–60 Gün", "61–90 Gün", "90+ Gün", "Faturasız Alacak (dilimlere dahil)", "Şüpheli Alacak (dilimlere dahil)", "Toplam"]) assert.equal(cell(data, row, header), want[header] || 0, `${name} ${header}`);
      assert.equal(row[1], want.gap, `${name} gecikme günü`);
    }
    assert.equal(rowOf(data, "Alacaklı Müşteri"), undefined, "alacaklı cari yaşlandırılmaz");
    assert.equal(rowOf(data, "Tedarikçi A.Ş."), undefined);
    assert.equal(summary(data, "Toplam"), 1070000);
    assert.equal(summary(data, "Faturasız Alacak (dilimlere dahil)"), 730000);
    // Bağımsız: cari toplamı (çek hariç) = borçlu carilerin bakiyeleri (Cari Listesi'nden).
    const list = await must("cari listesi", api.get("/api/workspace/accounts?status=all"));
    const debtors = list.accounts.filter(account => account.balance > 0).reduce((sum, account) => sum + Math.round(account.balance * 100), 0);
    assert.equal(debtors, 1000000);
    assert.equal(summary(data, "Toplam") - 70000, debtors, "dilimlerin cari kısmı = borçlu cari bakiyeleri");
  });

  it("MM5: Nakit Akışı gecikmiş girişlerde faturasız cari alacağı (bugünden önceki parçalar) görünür; taksit ve fatura kalemi değişmez", async () => {
    const flow = await must("nakit akışı", api.get("/api/workspace/overview/nakit-akisi?from=2026-10-20&to=2026-12-31&overdue=0"));
    const unbilled = flow.overdue.filter(row => row.source === "unbilled");
    const byParty = Object.fromEntries(unbilled.map(row => [`${row.party}|${row.date}`, Math.round(row.amount * 100)]));
    assert.deepEqual(byParty, { "Eski Müşteri|2026-01-02": 500000, "Çekli Müşteri|2026-08-16": 200000, "Faturalı Müşteri|2026-10-15": 30000 });
    assert.ok(flow.overdue.some(row => row.source === "invoice" && Math.round(row.amount * 100) === 120000), "vadeli fatura gecikmiş girişte (değişmedi)");
    const xlsx = await api.raw("GET", "/api/workspace/overview/nakit-akisi.xlsx?from=2026-10-20&to=2026-12-31");
    assert.equal(xlsx.status, 200);
    const text = JSON.stringify(xlsxSheets(xlsx.buffer));
    assert.match(text, /Faturasız Cari Alacağı/, "Excel'de kaynak adı");
  });

  it("MM6: Banka Nakit Akış Raporu Çek Hesabı bağlı verilen çeki vadesinde çıkış sayar (hesapsız çek girmez); her dönem seçeneği", async () => {
    const all = await report("banka-nakit-akis", { preset: "all" }, "banka-nakit-akis tümü");
    const given = all.rows.filter(row => row[1] === "Verilen Çek ve Senet");
    assert.equal(given.length, 1, JSON.stringify(all.rows, null, 0));
    assert.equal(given[0][0], "25.10.2026");
    assert.equal(minor(given[0][5]), 200000);
    assert.match(given[0][2], /K-501/);
    assert.equal(summary(all, "Beklenen Çıkış"), 200000);
    assert.equal(summary(all, "Dönem Sonu Tahmini Gerçek Banka"), 4800000);
    const before = await report("banka-nakit-akis", { from: "2026-10-20", to: "2026-10-24" }, "banka-nakit-akis vadeden önce");
    assert.equal(summary(before, "Beklenen Çıkış"), 0);
    const after = await report("banka-nakit-akis", { from: "2026-10-26", to: "2026-12-31" }, "banka-nakit-akis vadeden sonra");
    assert.equal(summary(after, "Başlangıç"), 4800000, "vadesi aralıktan önce geçen çek başlangıca kadar beklenenlerde");
    const overview = await must("genel nakit akışı", api.get("/api/workspace/overview/nakit-akisi?from=2026-10-20&to=2026-12-31"));
    assert.ok(overview.rows.some(row => row.source === "cheque" && row.direction === "out" && Math.round(row.amount * 100) === 200000), "Genel Nakit Akışı da aynı çeki çıkış sayar");
  });

  it("MM7: Stok Durumu, Kategoriye Göre ve Stok Hareket Özeti aynı gün aynı değer (eksi stok eksi değer: 5.000 − 400 = 4.600); süzgeçler", async () => {
    const durum = await report("stok-durumu", {}, "stok-durumu");
    const ozet = await report("stok-ozet", { preset: "thisYear" }, "stok-ozet bu yıl");
    const kategori = await report("stok-kategori", {}, "stok-kategori");
    assert.equal(summary(durum, "Stok Değeri"), 460000);
    assert.equal(summary(ozet, "Dönem Sonu Değer"), 460000);
    assert.equal(summary(kategori, "Stok Değeri"), 460000);
    assert.equal(summary(ozet, "Eksi Stok"), "1");
    const p2 = ozet.rows.find(row => row[1] === "P2");
    assert.equal(minor(p2[9]), -40000, "eksi ürünün değeri eksi");
    for (const state of ["low", "out", "negative", "product", "service"]) await report("stok-durumu", { state }, `stok-durumu ${state}`);
    const neg = await report("stok-durumu", { state: "negative" }, "stok-durumu eksi");
    assert.equal(summary(neg, "Stok Değeri"), -40000);
    for (const preset of ["thisMonth", "lastMonth", "all"]) await report("stok-ozet", { preset }, `stok-ozet ${preset}`);
    const empty = await report("stok-ozet", { from: "2025-01-01", to: "2025-12-31" }, "stok-ozet boş dönem");
    assert.equal(empty.rows.length, 0);
  });

  it("MM8: Yevmiye Defteri özetinde Madde = farklı madde sayısı (tam sayı), Satır = satır sayısı; boş dönem 0", async () => {
    const data = await report("yevmiye", { preset: "all" }, "yevmiye tümü");
    const madde = summary(data, "Madde");
    assert.match(String(madde), /^\d+$/, `tam sayı: ${madde}`);
    assert.equal(summary(data, "Satır"), String(data.total ?? data.rows.length));
    const ledger = await must("defter", api.get("/api/workspace/ledger"));
    assert.equal(Number(madde), ledger.entryCount, "madde sayısı = Ana Defter'in madde sayısı");
    assert.ok(data.rows.length > Number(madde) * 2 - 1);
    const empty = await report("yevmiye", { from: "2025-01-01", to: "2025-01-31" }, "yevmiye boş");
    assert.equal(summary(empty, "Madde"), "0");
  });

  it("MM9: Cari Listesi özeti — Toplam Borç / Toplam Alacak, Müşteri Alacakları ve Tedarikçi Borçları ayrı, net açık adla; her süzgeç", async () => {
    const data = await report("cari-listesi", {}, "cari-listesi");
    const labels = data.summary.map(([key]) => key);
    for (const old of ["Toplam Borç (Anlaşılan)", "Toplam Alacak (Ödenen)"]) assert.ok(!labels.includes(old), `eski ad: ${old}`);
    assert.ok(!labels.some(key => /^Kalan \(/.test(key)), "adsız 'Kalan' yok");
    const debtors = summary(data, "Müşteri Alacakları (Borçlu Cariler)");
    const creditors = summary(data, "Tedarikçi Borçları (Alacaklı Cariler)");
    assert.equal(debtors, 1000000);
    assert.equal(creditors, 200000 + 40000, "tedarikçi (5.000 alım − 3.000 verilen çek) + alacaklı müşteri 400");
    assert.equal(summary(data, "Net Bakiye (Müşteri Alacakları − Tedarikçi Borçları)"), debtors - creditors);
    assert.equal(summary(data, "Toplam Borç"), data.rows.reduce((sum, row) => sum + (minor(row[5]) || 0), 0));
    assert.equal(summary(data, "Toplam Alacak"), data.rows.reduce((sum, row) => sum + (minor(row[6]) || 0), 0));
    for (const type of ["", "customer", "supplier", "other"]) for (const side of ["", "debtor", "creditor", "zero", "nonzero", "overdue"]) await report("cari-listesi", { ...(type ? { type } : {}), ...(side ? { side } : {}) }, `cari-listesi ${type || "tümü"} ${side || "tümü"}`);
    const suppliers = await report("cari-listesi", { type: "supplier" }, "tedarikçiler");
    assert.equal(summary(suppliers, "Müşteri Alacakları (Borçlu Cariler)"), 0);
    assert.equal(summary(suppliers, "Tedarikçi Borçları (Alacaklı Cariler)"), 200000);
  });

  it("Mutabakat Testi temiz", async () => {
    await integrityOk(api, "son");
  });
});
