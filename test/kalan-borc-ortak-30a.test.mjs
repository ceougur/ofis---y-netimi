// 2.4.4 madde 30a: "Kalan borç" kolonu TEK kuralla seçilir (server/lib/insight/debt-column.mjs) — Tahsilat Takvimi / ödeme sözü / Vade Takip / Nakit Akışı
// (insight/dues.mjs) ve Tablodaki Kişiler (reports.mjs) aynı kolonu okur. Kullanıcı kararı (22.10.2026, "önerin uygun"): Kalan Borç kalır; Tablodaki Kişiler
// de aynı kurala alınır. 2.4.3'te ve aday 6'da (e070d42) Tablodaki Kişiler "Toplam Borç" + "Kalan Borç" tablosunda ilk eşleşen Toplam Borç'u alıyordu.
// Beklenen sayılar tablonun KENDİ hücrelerinden (ders 5): Toplam 11.500, Ödenen 3.900, Kalan 7.600 → borç 7.600.
// "Nasıl bozulur?" (işe başlarken yazıldı): N1 kolon sırası · N2 yalnız Toplam · N3 yalnız Kalan · N4 Bakiye / Kalan Tutar / Ödenecek · N5 Toplam + Ödenen, Kalan yok ·
// N6 Kalan 0 / boş · N7 birden çok sekme · N8 aynı dosya no iki sekmede (5c) · N9 Excel dışa aktarım · N10 Açılış Bakiyesi / 5b (komşu testler) · N11 tek yer.
// 2.4.5 madde 4 (uyarı kapısı): bu dosya tablo takvim motorunu zil / Tahsilat Takvimi / Vade Takip / Projeksiyon uçlarından sınar → 2.4.4 davranışı (legacyTableDues, yalnız testler).
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";
import { analyzeColumns } from "../server/lib/insight/columns.mjs";
import { computeDues } from "../server/lib/insight/dues.mjs";
import { cariEkstre, normalizeFilters, normalizeRecords } from "../server/lib/reports.mjs";
import { readZip } from "../server/lib/zip.mjs";
import { createClock } from "../server/lib/clock.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const pad = value => String(value).padStart(2, "0");
const NOW = new Date();
const TODAY = `${NOW.getFullYear()}-${pad(NOW.getMonth() + 1)}-${pad(NOW.getDate())}`;
const shift = days => {
  const date = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + days, 12);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
};
const PROMISE = shift(5);

// Tek sekmeli tablo: başlıklar + satırlar (hücre metinleri) → rapor ve takvim girdisi.
const rowsOf = (sheet, header, lines) => lines.map((line, index) => ({ __hofKey: `${sheet}-${index + 1}`, __sheet: sheet, ...Object.fromEntries(header.map((column, at) => [column, line[at]])) }));
const report = rows => {
  const columns = Object.keys(rows[0]).filter(key => !key.startsWith("__"));
  const normalized = normalizeRecords({ rows, analyses: analyzeColumns(rows, columns, { now: NOW }), session: "s1", sessionName: "Tablo" });
  return { columns: normalized.columns, ekstre: cariEkstre({ records: normalized.records, payments: [], filters: normalizeFilters({}), now: NOW }) };
};
const debitOf = (rep, name) => rep.ekstre.groups.find(group => group.cari === name)?.debit ?? null;
const duesOf = rows => computeDues({ rows, tabs: [rows[0].__sheet], now: NOW }).items;

describe("2.4.4 30a: Tablodaki Kişiler ve Tahsilat Takvimi aynı Kalan Borç kolonunu okur (birim)", () => {
  const people = [["2026/00001", "Tülay Öz", "11.500,00", "3.900,00", "7.600,00", PROMISE], ["2026/00002", "Mert Can", "8.000,00", "2.000,00", "6.000,00", PROMISE], ["2026/00003", "Ece Ak", "4.000,00", "1.000,00", "3.000,00", PROMISE]];

  test("N1 Toplam Borç önce: Tablodaki Kişiler borcu Kalan Borç hücresi (7.600, 6.000, 3.000), Toplam Borç değil", () => {
    const rows = rowsOf("Borçlular", ["Dosya No", "Ad Soyad", "Toplam Borç", "Ödenen", "Kalan Borç", "Ödeme Sözü"], people);
    const rep = report(rows);
    assert.equal(rep.columns.debt, "Kalan Borç", `Tablodaki Kişiler borç kolonu "Kalan Borç" olmalı; seçilen: "${rep.columns.debt}" (ödenmiş kısım borç görünür)`);
    assert.deepEqual(["Tülay Öz", "Mert Can", "Ece Ak"].map(name => debitOf(rep, name)), [7600, 6000, 3000], "borç = Kalan Borç hücresi");
    assert.equal(rep.ekstre.totals.debit, 16600, "toplam borç = 7.600 + 6.000 + 3.000");
  });

  test("N1 Kalan Borç önce (kolon sırası ters): yine Kalan Borç", () => {
    const rows = rowsOf("Borçlular", ["Dosya No", "Ad Soyad", "Kalan Borç", "Ödenen", "Toplam Borç", "Ödeme Sözü"], people.map(([no, name, total, paid, rest, date]) => [no, name, rest, paid, total, date]));
    const rep = report(rows);
    assert.equal(rep.columns.debt, "Kalan Borç");
    assert.deepEqual(["Tülay Öz", "Mert Can", "Ece Ak"].map(name => debitOf(rep, name)), [7600, 6000, 3000]);
  });

  test("N1 takvim (SABİTLER, 5b'den beri): söz kaleminin tutarı ve Kalan Borç'u Kalan Borç hücresi; iki kolon sırasında da", () => {
    for (const order of ["toplam-once", "kalan-once"]) {
      const header = order === "toplam-once" ? ["Dosya No", "Ad Soyad", "Toplam Borç", "Ödenen", "Kalan Borç", "Ödeme Sözü"] : ["Dosya No", "Ad Soyad", "Kalan Borç", "Ödenen", "Toplam Borç", "Ödeme Sözü"];
      const lines = order === "toplam-once" ? people : people.map(([no, name, total, paid, rest, date]) => [no, name, rest, paid, total, date]);
      const items = duesOf(rowsOf("Borçlular", header, lines));
      const tulay = items.find(item => item.person === "Tülay Öz");
      assert.ok(tulay, `${order}: Tülay'ın söz kalemi var: ${JSON.stringify(items.map(item => item.person))}`);
      assert.deepEqual([tulay.amount, tulay.debt, tulay.debtColumn], [7600, 7600, "Kalan Borç"], `${order}: söz tutarı / Kalan Borç / kolon (Toplam 11.500'e dönmemeli)`);
    }
  });

  test("N2 yalnız Toplam Borç: iki yerde de Toplam Borç (geri dönüş değişmez)", () => {
    const rows = rowsOf("Borçlular", ["Dosya No", "Ad Soyad", "Toplam Borç", "Ödeme Sözü"], people.map(([no, name, total, , , date]) => [no, name, total, date]));
    const rep = report(rows);
    assert.equal(rep.columns.debt, "Toplam Borç");
    assert.equal(debitOf(rep, "Tülay Öz"), 11500);
    const tulay = duesOf(rows).find(item => item.person === "Tülay Öz");
    assert.deepEqual([tulay.amount, tulay.debtColumn], [11500, "Toplam Borç"]);
  });

  test("N3 yalnız Kalan: Kalan", () => {
    const rows = rowsOf("Borçlular", ["Dosya No", "Ad Soyad", "Kalan", "Ödeme Sözü"], people.map(([no, name, , , rest, date]) => [no, name, rest, date]));
    assert.equal(report(rows).columns.debt, "Kalan");
    assert.equal(debitOf(report(rows), "Mert Can"), 6000);
    assert.equal(duesOf(rows).find(item => item.person === "Mert Can").debtColumn, "Kalan");
  });

  test("N4 'Bakiye' ve 'Kalan Tutar' Kalan sayılır (Toplam Borç önce olsa da); 'Ödenecek' sayılmaz (ilk eşleşen borç başlığı, önceki gibi)", () => {
    for (const rest of ["Bakiye", "Kalan Tutar"]) {
      const rows = rowsOf("Borçlular", ["Dosya No", "Ad Soyad", "Toplam Borç", "Ödenen", rest, "Ödeme Sözü"], people);
      const rep = report(rows);
      assert.equal(rep.columns.debt, rest, `"${rest}" kolonu borç olmalı; seçilen "${rep.columns.debt}"`);
      assert.equal(debitOf(rep, "Ece Ak"), 3000);
      assert.equal(duesOf(rows).find(item => item.person === "Ece Ak").debtColumn, rest);
    }
    const rows = rowsOf("Borçlular", ["Dosya No", "Ad Soyad", "Toplam Borç", "Ödenecek", "Ödeme Sözü"], people.map(([no, name, total, , rest, date]) => [no, name, total, rest, date]));
    assert.equal(report(rows).columns.debt, "Toplam Borç", "Ödenecek kalan sayılmaz; ilk eşleşen borç başlığı");
  });

  test("N5 Toplam Borç + Ödenen, Kalan yok: borç = toplam − ödenen (r31e T1 kararı, 23.10.2026; önceden Toplam — 31e bulgusu)", () => {
    const rows = rowsOf("Borçlular", ["Dosya No", "Ad Soyad", "Toplam Borç", "Ödenen", "Ödeme Sözü"], people.map(([no, name, total, paid, , date]) => [no, name, total, paid, date]));
    const rep = report(rows);
    assert.equal(rep.columns.debt, "Toplam Borç");
    assert.equal(debitOf(rep, "Tülay Öz"), 7600, "11.500 − 3.900; ödenen borç sayılmaz");
  });

  test("N6 Kalan Borç 0: Tablodaki Kişiler borcu 0 (Toplam değil), takvimde kalem yok (ödenmiş); Kalan boş: tutar kolonuna (Toplam Borç) düşer", () => {
    const lines = [["2026/00001", "Tülay Öz", "11.500,00", "11.500,00", "0,00", PROMISE], ["2026/00002", "Mert Can", "8.000,00", "", "", PROMISE], ["2026/00003", "Ece Ak", "4.000,00", "1.000,00", "3.000,00", PROMISE]];
    const rows = rowsOf("Borçlular", ["Dosya No", "Ad Soyad", "Toplam Borç", "Ödenen", "Kalan Borç", "Ödeme Sözü"], lines);
    const rep = report(rows);
    assert.equal(rep.columns.debt, "Kalan Borç");
    assert.equal(debitOf(rep, "Tülay Öz"), 0, "Kalan 0 → borç 0");
    assert.equal(rep.columns.amount, "Toplam Borç");
    assert.equal(debitOf(rep, "Mert Can"), 8000, "Kalan boş → Toplam Borç (tutar kolonu)");
    assert.equal(duesOf(rows).some(item => item.person === "Tülay Öz"), false, "Kalan 0: takvimde söz kalemi yok");
  });

  test("N12 programın kendi şablonu (Alacak ve Tahsilat Yönetimi: Borç Tutarı + Kalan Borç): Tablodaki Kişiler ve takvim Kalan Borç", async () => {
    const { sectorTemplate } = await import("../server/lib/insight/templates.mjs");
    const header = sectorTemplate("finans-tahsilat").columns.map(column => column.label);
    assert.ok(header.includes("Borç Tutarı") && header.includes("Kalan Borç"), JSON.stringify(header));
    const values = { "Borç Tutarı": ["5.000,00", "9.000,00"], "Kalan Borç": ["2.000,00", "4.500,00"], "Ödeme Sözü Tarihi": [PROMISE, PROMISE], "Vade Tarihi": [shift(-20), shift(-20)], Durum: ["Açık", "Açık"], Telefon: ["0532 111 22 33", "0532 111 22 44"], Borçlu: ["Ayşe Yılmaz", "Hakan Demir"] };
    const rows = rowsOf("Hesaplar", header, [0, 1].map(index => header.map(column => values[column]?.[index] ?? "")));
    const rep = report(rows);
    assert.equal(rep.columns.debt, "Kalan Borç", `şablonda borç kolonu "Kalan Borç" olmalı; seçilen "${rep.columns.debt}"`);
    assert.deepEqual([debitOf(rep, "Ayşe Yılmaz"), debitOf(rep, "Hakan Demir")], [2000, 4500]);
    const items = duesOf(rows).filter(item => item.person === "Ayşe Yılmaz");
    assert.ok(items.length > 0 && items.every(item => item.debtColumn === "Kalan Borç" && item.debt === 2000), JSON.stringify(items.map(item => [item.label, item.amount, item.debt, item.debtColumn])));
  });

  test("N11 tek yer: dues.mjs ve reports.mjs kalan kolonunu ortak yardımcıdan seçer", () => {
    for (const file of ["server/lib/insight/dues.mjs", "server/lib/reports.mjs"]) {
      const source = readFileSync(path.join(ROOT, file), "utf8").split(/\r?\n/).filter(line => !/^\s*\/\//.test(line)).join("\n");
      // 31d (bilerek güncellendi): kolon seçimi debtPlan, satır borcu rowDebt — ikisi de ortak yardımcıda.
      assert.match(source, /import \{[^}]*debtPlan[^}]*\} from "\.\/(insight\/)?debt-column\.mjs"/, `${file} ortak yardımcıyı içe almalı`);
      assert.match(source, /debtPlan\(/, `${file} ortak yardımcıyı çağırmalı`);
    }
  });
});

// Programın kendi uçlarından (ekranın okuduğu API + Excel dışa aktarım): çok sekmeli tablo, her sekme kendi kolonlarıyla (31a F4); aynı dosya no iki sekmede (5c).
describe("2.4.4 30a: Tablodaki Kişiler, Tahsilat Takvimi, Vade Takip, Nakit Akışı ve Excel aynı Kalan Borç'u gösterir (API)", () => {
  const root = mkdtempSync(path.join(tmpdir(), "kalan-borc-30a-"));
  let server;
  let api;
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  const ekstre = async query => (await must(`cari-ekstre ${query}`, api.get(`/api/workspace/reports/cari-ekstre?from=2000-01-01&to=2099-12-31${query}`))).report;
  const lineOf = (rep, name, tab) => rep.groups.find(group => group.cari === name)?.lines.filter(line => line.kind === "borc" && line.tab === tab) || [];
  const workbook = [
    { name: "Borçlular", matrix: [["Dosya No", "Ad Soyad", "Telefon", "Toplam Borç", "Ödenen", "Kalan Borç", "Ödeme Sözü"], ["2026/00001", "Tülay Öz", "0555 111 22 33", "11500", "3900", "7600", PROMISE], ["2026/00002", "Mert Can", "0555 111 22 44", "8000", "8000", "0", PROMISE], ["2026/00003", "Ece Ak", "0555 111 22 55", "4000", "1000", "3000", PROMISE]] },
    { name: "Senetler", matrix: [["Dosya No", "Ad Soyad", "Kalan Borç", "Ödenen", "Toplam Borç", "Ödeme Sözü"], ["2026/00010", "Selin Ak", "2500", "1500", "4000", PROMISE], ["2026/00011", "Oya Tan", "1200", "800", "2000", PROMISE]] },
    { name: "Kira", matrix: [["Dosya No", "Ad Soyad", "Toplam Borç", "Ödeme Sözü"], ["2026/00020", "Oğuz Er", "3000", PROMISE], ["2026/00021", "Kaan Su", "1800", PROMISE]] },
    { name: "Ödeme Sözleri", matrix: [["Dosya No", "Ad Soyad", "Söz Tarihi", "Söz Tutarı"], ["2026/00001", "Tülay Öz", PROMISE, "1000"]] },
  ];

  before(async () => {
    const clock = createClock({ time: new Date(`${TODAY}T10:00:00`), fixed: true });
    server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: clock, legacyTableDues: true });
    api = await server.login();
    const staged = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "kalan-borc.xlsx", sheets: workbook }));
    await must("tablo kaydet", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
  });
  after(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("Tablodaki Kişiler: her sekmede borç = o sekmenin Kalan Borç hücresi (Kalan yoksa Toplam Borç); toplam = satırlar", async () => {
    const rep = await ekstre("");
    const expected = [["Tülay Öz", "Borçlular", 7600], ["Mert Can", "Borçlular", 0], ["Ece Ak", "Borçlular", 3000], ["Selin Ak", "Senetler", 2500], ["Oya Tan", "Senetler", 1200], ["Oğuz Er", "Kira", 3000], ["Kaan Su", "Kira", 1800]];
    for (const [name, tab, debt] of expected) {
      const lines = lineOf(rep, name, tab);
      assert.deepEqual(lines.map(line => line.borc), [debt], `${name} (${tab}) borç satırı Kalan Borç hücresi ${debt} olmalı; görülen ${JSON.stringify(lines.map(line => line.borc))}`);
    }
    const rows = rep.table.rows;
    assert.equal(Math.round(rows.reduce((sum, row) => sum + (Number(row.borc) || 0), 0) * 100) / 100, rep.totals.debit, "toplam borç = satırlar");
  });

  test("Tahsilat Takvimi, Vade Takip ve Nakit Akışı aynı tutarı gösterir (Borçlular sekmesi: Tülay 7.600, Ece 3.000; Mert ödenmiş)", async () => {
    const dues = await must("takvim", api.get("/api/workspace/dues"));
    const borclular = dues.items.filter(item => item.tab === "Borçlular" || item.sheet === "Borçlular");
    const of = name => borclular.find(item => item.person === name);
    assert.deepEqual([of("Tülay Öz")?.amount, of("Tülay Öz")?.debtColumn], [7600, "Kalan Borç"], JSON.stringify(borclular.map(item => [item.person, item.amount, item.debtColumn])));
    assert.equal(of("Ece Ak")?.amount, 3000);
    assert.equal(of("Mert Can"), undefined, "Kalan 0: kalem yok");
    const vade = (await must("Vade Takip", api.get(`/api/workspace/reports/vade-takip?from=2000-01-01&to=2099-12-31&tabs=${encodeURIComponent("Borçlular")}`))).report;
    assert.deepEqual(vade.rows.map(row => [row.cari, row.amount]).sort(), [["Ece Ak", 3000], ["Tülay Öz", 7600]], "Vade Takip");
    assert.equal(vade.totals.amount, 10600, "Vade Takip toplamı 7.600 + 3.000");
    // Süzgeçsiz: bütün sekmelerin söz kalemleri, hücrelerden — Borçlular 7.600 + 3.000 (Mert 0, kalem yok) · Senetler 2.500 + 1.200 · Kira 3.000 + 1.800 ·
    // Ödeme Sözleri 1.000 = 20.100. Sekme "Borçlular" (30e'den beri süzgeç uygulanır): 7.600 + 3.000 = 10.600.
    const akis = (await must("Nakit Akışı", api.get("/api/workspace/reports/nakit-akis?from=2000-01-01&to=2099-12-31"))).report;
    assert.equal(akis.totals.expected, 20100, `Nakit Akışı Beklenen (Kalan Borç hücrelerinden) 20.100; görülen ${akis.totals.expected}`);
    const akisTab = (await must("Nakit Akışı sekme", api.get(`/api/workspace/reports/nakit-akis?from=2000-01-01&to=2099-12-31&tabs=${encodeURIComponent("Borçlular")}`))).report;
    assert.equal(akisTab.totals.expected, 10600, `Nakit Akışı Beklenen (Borçlular) 10.600; görülen ${akisTab.totals.expected}`);
    const rep = await ekstre(`&tabs=${encodeURIComponent("Borçlular")}`);
    assert.equal(rep.groups.find(group => group.cari === "Tülay Öz").debit, of("Tülay Öz").debt, "aynı kişi Tablodaki Kişiler ve takvimde aynı Kalan Borç");
  });

  test("Excel dışa aktarım: Tülay Öz (Borçlular) Borç hücresi 7.600", async () => {
    const res = await api.client.raw("POST", "/api/workspace/reports/cari-ekstre/export", { body: JSON.stringify({ format: "xlsx", filters: { from: "2000-01-01", to: "2099-12-31", tabs: ["Borçlular"] } }), headers: { "content-type": "application/json" } });
    assert.equal(res.status, 200);
    const xml = readZip(res.buffer).find(entry => entry.name === "xl/worksheets/sheet1.xml").data.toString("utf8");
    const rows = xml.split("<row ").filter(row => row.includes(">Tülay Öz<") && row.includes("Borçlular"));
    assert.equal(rows.length, 1, `Tülay'ın Borçlular satırı: ${rows.length}`);
    const ref = /r="(\d+)"/.exec(rows[0])[1];
    const debt = new RegExp(`<c r="E${ref}"[^>]*><v>([^<]+)</v>`).exec(rows[0])?.[1];
    assert.equal(Number(debt), 7600, `Excel Borç hücresi: ${debt}`);
  });

  test("5c: aynı dosya no iki sekmede — tahsilat bir kez; Borçlular satırı Kalan Borç (7.600)", async () => {
    await must("kayıt tahsilatı", api.post(`/api/workspace/cases/${encodeURIComponent("2026/00001")}/payments`, { amount: "1000", date: TODAY, method: "cash" }));
    const rep = await ekstre("");
    const tulay = rep.groups.find(group => group.cari === "Tülay Öz");
    assert.deepEqual(tulay.lines.filter(line => line.kind === "alacak").map(line => line.alacak), [1000], "tahsilat bir kez");
    assert.deepEqual(lineOf(rep, "Tülay Öz", "Borçlular").map(line => line.borc), [7600]);
    // 31f U2 (bilerek güncellendi): söz tutarı borç değildir; aynı dosya no'nun borcu bir kez, Borçlular'ın Kalan Borç'undan.
    assert.deepEqual(lineOf(rep, "Tülay Öz", "Ödeme Sözleri").map(line => line.borc), [], "Ödeme Sözleri sekmesi borç satırı açmaz");
  });
});
