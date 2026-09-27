// Dinamik raporlama (v2.0.2): ortak omurga, cross-match, üç rapor ve dışa aktarma tablosu.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { analyzeColumns } from "../server/lib/insight/columns.mjs";
import { cariEkstre, cariKeyOf, flattenTable, nakitAkis, normalizeFilters, normalizeRecords, vadeTakip } from "../server/lib/reports.mjs";
import { loginAdmin, startTestServer } from "./helpers.mjs";

const NOW = new Date("2026-09-27T09:00:00");
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

describe("raporlama motoru", () => {
  const rowsA = [
    { __hofKey: "2026/1", __sheet: "İcra", "Dosya No": "2026/1", Borçlu: "Ali Veli", Telefon: "0532 111 11 11", Alacak: "10.000,00", Kalan: "6.000,00", Vade: "25.09.2026", Durum: "Açık", Mahkeme: "Konya 3. İcra" },
    { __hofKey: "2026/2", __sheet: "İcra", "Dosya No": "2026/2", Borçlu: "Ayşe Kaya", Telefon: "0533 222 22 22", Alacak: "5.000,00", Kalan: "5.000,00", Vade: "30.09.2026", Durum: "Açık", Mahkeme: "Konya 5. İcra" },
    { __hofKey: "2026/3", __sheet: "İcra", "Dosya No": "2026/3", Borçlu: "Can Er", Telefon: "0534 333 33 33", Alacak: "2.000,00", Kalan: "0,00", Vade: "01.09.2026", Durum: "Ödendi", Mahkeme: "" },
  ];
  const rowsB = [
    { __hofKey: "T-1", __sheet: "Taksitler", Müşteri: "Ali Veli", Tutar: "3.000,00", "Ödeme sözü": "28.09.2026", Durum: "Bekliyor", Ürün: "Buzdolabı" },
    { __hofKey: "T-2", __sheet: "Taksitler", Müşteri: "Deniz Ay", Tutar: "1.200,00", "Ödeme sözü": "05.10.2026", Durum: "Bekliyor", Ürün: "TV" },
  ];
  const normalize = (rows, session, sessionName) => normalizeRecords({ rows, analyses: analyzeColumns(rows, Object.keys(rows[0]).filter(key => !key.startsWith("__")), { now: NOW }), session, sessionName });

  it("kayıtlar ortak omurgaya iner: cari, kalan borç, vade, durum; özel alanlar ayrı; cari anahtarı dosyalar arasında eşleşir", () => {
    const a = normalize(rowsA, "dataset://ofis", "İcra");
    assert.deepEqual(a.columns, { cari: "Borçlu", id: "Dosya No", amount: "Alacak", debt: "Kalan", deadline: "Vade", status: "Durum", phone: "Telefon" });
    const first = a.records[0];
    assert.deepEqual([first.cari, first.debt, first.amount, first.status, first.deadlineText], ["Ali Veli", 6000, 10000, "Açık", "25.09.2026"]);
    assert.deepEqual(first.fields, { Mahkeme: "Konya 3. İcra" });
    const b = normalize(rowsB, "dataset://oturum-2", "Taksit");
    assert.equal(b.records[0].cariKey, first.cariKey, "aynı ad → aynı cari anahtarı");
    assert.equal(cariKeyOf("", "0532 111 11 11"), "p:5321111111", "ad yoksa telefon anahtar olur");
  });

  it("cari ekstre iki dosyadaki aynı cariyi tek hesapta birleştirir; tahsilat alacak yazar; bakiye yürür; özel alan kolonları veriden gelir", () => {
    const records = [...normalize(rowsA, "s1", "İcra").records, ...normalize(rowsB, "s2", "Taksit").records];
    const payments = [{ caseKey: "2026/1", amount: 1000, date: iso(2026, 9, 20), note: "Elden" }];
    const report = cariEkstre({ records, payments, filters: normalizeFilters({}), now: NOW });
    const ali = report.groups.find(group => group.cari === "Ali Veli");
    assert.ok(ali.crossMatched && ali.sessions.length === 2, JSON.stringify(ali.sessions));
    assert.deepEqual(ali.lines.map(line => [line.kind, line.borc ?? line.alacak, line.bakiye]), [["alacak", 1000, -1000], ["borc", 6000, 5000], ["borc", 3000, 8000]]);
    assert.equal(report.totals.crossMatched, 1);
    const dynamic = report.table.columns.filter(column => column.dynamic).map(column => column.label);
    assert.deepEqual(dynamic.sort(), ["Mahkeme", "Ürün"]);
    const filtered = cariEkstre({ records, payments, filters: normalizeFilters({ cari: "ayşe", from: iso(2026, 9, 1), to: iso(2026, 9, 30) }), now: NOW });
    assert.deepEqual(filtered.groups.map(group => group.cari), ["Ayşe Kaya"]);
    // Durum süzgeci ve en az tutar.
    const open = cariEkstre({ records, payments, filters: normalizeFilters({ status: "Açık", minAmount: 5500 }), now: NOW });
    assert.deepEqual(open.groups.map(group => group.cari), ["Ali Veli"]);
  });

  it("vade takip: gecikmiş / bugün / yaklaşan / kapalı; gün farkı; durum süzgeci; tarihsiz kalem listelenir", () => {
    const records = normalize(rowsA, "s1", "İcra").records;
    const items = [
      { caseKey: "2026/1", session: "s1", sessionName: "İcra", label: "Vade", time: Date.UTC(2026, 8, 25), amount: 6000, state: "overdue" },
      { caseKey: "2026/2", session: "s1", sessionName: "İcra", label: "Vade", time: Date.UTC(2026, 8, 27), amount: 5000, state: "upcoming" },
      { caseKey: "2026/3", session: "s1", sessionName: "İcra", label: "Vade", time: Date.UTC(2026, 9, 3), amount: 2000, state: "paid" },
      { caseKey: "X", session: "s1", sessionName: "İcra", label: "Sözleşme bitiş", time: null, amount: null, deadline: true, person: "Ece" },
    ];
    const report = vadeTakip({ records, items, filters: normalizeFilters({}), now: NOW });
    assert.deepEqual(report.rows.map(row => [row.cari, row.state, row.days]), [["Ali Veli", "gecikmis", -2], ["Ayşe Kaya", "bugun", 0], ["Can Er", "kapali", 6], ["Ece", "belirsiz", null]]);
    assert.deepEqual(report.totals, { count: 4, dormant: 0, overdue: 1, upcoming: 1, amount: 13000, overdueAmount: 6000 });
    assert.deepEqual(vadeTakip({ records, items, filters: normalizeFilters({ status: ["gecikmis"] }), now: NOW }).rows.map(row => row.cari), ["Ali Veli"]);
    assert.equal(report.table.columns.find(column => column.key === "state").label, "Durum");
    assert.equal(report.table.rows[0].state, "Gecikmiş");
  });

  it("nakit akış: dönem başına beklenen, gerçekleşen, kasa ve birikimli; gün / hafta / ay", () => {
    const items = [
      { caseKey: "a", session: "s1", time: Date.UTC(2026, 9, 5), amount: 1000, state: "upcoming" },
      { caseKey: "b", session: "s1", time: Date.UTC(2026, 9, 20), amount: 500, state: "upcoming" },
      { caseKey: "c", session: "s1", time: Date.UTC(2026, 9, 21), amount: 999, state: "paid" },
    ];
    const payments = [{ caseKey: "x", amount: 300, date: iso(2026, 9, 28) }, { caseKey: "y", amount: 200, date: iso(2026, 10, 2) }];
    const cashEntries = [{ kind: "in", amount: 300, date: iso(2026, 9, 28) }, { kind: "out", amount: 100, date: iso(2026, 10, 3) }, { kind: "in", amount: 200, date: iso(2026, 10, 2) }];
    const monthly = nakitAkis({ items, payments, cashEntries, filters: normalizeFilters({ granularity: "month" }), now: NOW });
    assert.deepEqual(monthly.rows.map(row => [row.period, row.expected, row.collected, row.cashIn, row.cashOut, row.net, row.cumulative, row.projected]), [
      ["2026-09", 0, 300, 300, 0, 300, 300, 300],
      ["2026-10", 1500, 200, 200, 100, 100, 400, 1900],
    ]);
    assert.deepEqual(monthly.totals, { expected: 1500, collected: 500, cashIn: 500, cashOut: 100, net: 400 });
    const weekly = nakitAkis({ items, payments, cashEntries, filters: normalizeFilters({ granularity: "week", from: iso(2026, 10, 1), to: iso(2026, 10, 31) }), now: NOW });
    assert.deepEqual(weekly.rows.map(row => row.period), ["2026-09-28", "2026-10-05", "2026-10-19"]);
    assert.ok(/haftası$/.test(weekly.rows[0].label));
    const daily = nakitAkis({ items, payments, cashEntries, filters: normalizeFilters({ granularity: "day" }), now: NOW });
    assert.equal(daily.rows.length, 5);
  });

  it("dışa aktarma tablosu: tarih gg.aa.yyyy, tutar Türkçe yazım, boşlar boş", () => {
    const flat = flattenTable({ columns: [{ key: "d", type: "date" }, { key: "m", type: "money" }, { key: "t" }], rows: [{ d: Date.UTC(2026, 9, 5), m: 1234.5, t: "x" }, { d: null, m: null, t: null }] });
    assert.deepEqual(flat.rows, [["05.10.2026", "1.234,50", "x"], ["", "", ""]]);
  });
});

describe("raporlama uçları (tam yığın)", () => {
  let server;
  let admin;
  const excel = (fileName, sheet, matrix) => ({ kind: "excel", fileName, sheets: [{ name: sheet, matrix }] });
  before(async () => {
    server = await startTestServer();
    admin = await loginAdmin(server);
    const first = await admin.post("/api/workspace/dataset/stage", excel("Icra.xlsx", "İcra", [["DOSYA NO", "BORÇLU", "KALAN", "VADE", "DURUM", "MAHKEME"], ["2026/1", "Ali Veli", "6.000,00", "25.09.2026", "Açık", "Konya 3"], ["2026/2", "Ayşe Kaya", "5.000,00", "30.09.2026", "Açık", "Konya 5"]]));
    await admin.post("/api/workspace/dataset/commit", { stageId: first.data.data.stageId, mode: "replace" });
    const second = await admin.post("/api/workspace/dataset/stage", excel("Taksit.xlsx", "Taksitler", [["MÜŞTERİ", "TUTAR", "ÖDEME SÖZÜ", "ÜRÜN"], ["Ali Veli", "3.000,00", "28.09.2026", "Buzdolabı"], ["Deniz Ay", "1.200,00", "05.10.2026", "TV"]]));
    await admin.post("/api/workspace/dataset/commit", { stageId: second.data.data.stageId, mode: "session", name: "Taksit takibi" });
  });
  after(async () => {
    await server.close();
  });

  it("cari ekstre iki oturumu birleştirir; vade takip ve nakit akış döner; Excel ve PDF dışa aktarılır", async () => {
    const ekstre = await admin.get("/api/workspace/reports/cari-ekstre?from=2026-09-01&to=2026-12-31");
    assert.equal(ekstre.status, 200, JSON.stringify(ekstre.data));
    const data = ekstre.data.data;
    assert.equal(data.sessions.length, 2);
    const ali = data.report.groups.find(group => group.cari === "Ali Veli");
    assert.ok(ali && ali.crossMatched, JSON.stringify(data.report.groups.map(group => [group.cari, group.sessions])));
    assert.ok(data.report.table.columns.some(column => column.dynamic && column.label === "ÜRÜN"), "özel alan kolonu veriden türetilir");
    const vade = await admin.get("/api/workspace/reports/vade-takip");
    assert.equal(vade.status, 200, JSON.stringify(vade.data));
    assert.ok(vade.data.data.report.rows.length >= 3, JSON.stringify(vade.data.data.report.totals));
    const nakit = await admin.get("/api/workspace/reports/nakit-akis?granularity=month");
    assert.equal(nakit.status, 200, JSON.stringify(nakit.data));
    assert.ok(nakit.data.data.report.rows.length >= 1);
    const xlsx = await admin.post("/api/workspace/reports/cari-ekstre/export", { format: "xlsx", filters: {} });
    assert.equal(xlsx.status, 200, JSON.stringify(xlsx.data).slice(0, 200));
    const pdf = await admin.post("/api/workspace/reports/vade-takip/export", { format: "pdf", filters: {} });
    assert.equal(pdf.status, 200, JSON.stringify(pdf.data).slice(0, 200));
    const bad = await admin.get("/api/workspace/reports/bilinmeyen");
    assert.equal(bad.status, 400);
  });
});
