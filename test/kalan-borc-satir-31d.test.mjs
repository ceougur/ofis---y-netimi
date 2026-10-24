// 2.4.4 madde 31d (eleştirmen) E2 ve E3 — kalan borcun SATIR düzeyi kuralı ve tutar olmayan sayı kolonları, tek yardımcıda (server/lib/insight/debt-column.mjs).
// E2: "Toplam Borç" + "Kalan" tablosunda bir satırın Kalan hücresi BOŞSA Tablodaki Kişiler o satırda Toplam'a düşüyor, Tahsilat Takvimi tutarı boş bırakıyor, Nakit
//     Akışı yalnız dolu satırları sayıyordu (ekranlar 21.500 / 6.000 ayrışıyordu). Kural: Kalan hücresi sayıysa o (0 dahil — borç 0), boş ya da sayı değilse o satırda
//     Toplam Borç; bütün ekranlar aynı fonksiyonu kullanır.
// E3: "Kalan Gün" gibi gün / adet / sayı / ay / yıl / oran / yüzde / % başlıklı kolon borç tutarı sayılıyordu (gerçek borç 19.500, rapor 17).
// Beklenen sayılar tablonun kendi hücrelerinden (ders 5). "Nasıl bozulur?": B1 Kalan boş · B2 Kalan metin · B3 Kalan 0 · B4 hepsi dolu · B5 yalnız Toplam ·
// B6 gün/adet/oran kolonu · B7 para başlıkları dışlanmaz · B9 çok sekme · B10 tek yer.
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
const P = shift(5);
const rowsOf = (sheet, header, lines) => lines.map((line, index) => ({ __hofKey: `${sheet}-${index + 1}`, __sheet: sheet, ...Object.fromEntries(header.map((column, at) => [column, line[at]])) }));
const ekstre = rows => {
  const columns = Object.keys(rows[0]).filter(key => !key.startsWith("__"));
  const normalized = normalizeRecords({ rows, analyses: analyzeColumns(rows, columns, { now: NOW }), session: "s1", sessionName: "Tablo" });
  return cariEkstre({ records: normalized.records, payments: [], filters: normalizeFilters({}), now: NOW });
};
const debits = rows => Object.fromEntries(ekstre(rows).groups.map(group => [group.cari, group.debit]));
const dues = rows => Object.fromEntries(computeDues({ rows, tabs: [rows[0].__sheet], now: NOW }).items.map(item => [item.person, [item.amount, item.debt, item.debtColumn]]));
// Eleştirmenin t13 tablosu: Tülay ve Ece'nin Kalan hücresi boş.
const T13 = [["Dosya No", "Ad Soyad", "Telefon", "Toplam Borç", "Ödenen", "Kalan", "Ödeme Sözü"], ["2026/1", "Tülay Öz", "0532 111 11 11", "11.500,00", "", "", P], ["2026/2", "Mert Can", "0532 222 22 22", "8.000,00", "2.000,00", "6.000,00", P], ["2026/3", "Ece Ak", "0532 333 33 33", "4.000,00", "", "", P]];
const KIRA = [["Dosya No", "Borçlu", "Telefon", "Tutar", "Kalan Gün", "Ödeme Sözü"], ["2026/4", "Selin Ak", "0532 444 44 44", "11.500,00", "5", P], ["2026/5", "Oya Tan", "0532 555 55 55", "8.000,00", "12", P]];

describe("31d E2: satır düzeyi tek kural — Kalan boşsa o satırda Toplam Borç (birim)", () => {
  test("B1 Kalan boş (t13): Tablodaki Kişiler ve takvim aynı — Tülay 11.500 (Toplam), Mert 6.000 (Kalan), Ece 4.000 (Toplam)", () => {
    const rows = rowsOf("Borçlular", T13[0], T13.slice(1));
    assert.deepEqual(debits(rows), { "Ece Ak": 4000, "Mert Can": 6000, "Tülay Öz": 11500 }, "Tablodaki Kişiler borçları");
    const items = dues(rows);
    assert.deepEqual(items["Tülay Öz"], [11500, 11500, "Toplam Borç"], `Takvim: Kalan hücresi boş satırda söz tutarı Toplam Borç (11.500) olmalı; görülen ${JSON.stringify(items["Tülay Öz"])}`);
    assert.deepEqual(items["Ece Ak"], [4000, 4000, "Toplam Borç"], `Takvim Ece: ${JSON.stringify(items["Ece Ak"])}`);
    assert.deepEqual(items["Mert Can"], [6000, 6000, "Kalan"], `Takvim Mert: ${JSON.stringify(items["Mert Can"])}`);
  });

  test("B2 Kalan hücresi sayı değil ('belirsiz'): o satırda Toplam Borç", () => {
    const rows = rowsOf("Borçlular", T13[0], [["2026/1", "Tülay Öz", "", "11.500,00", "", "belirsiz", P], ["2026/2", "Mert Can", "", "8.000,00", "2.000,00", "6.000,00", P], ["2026/3", "Ece Ak", "", "4.000,00", "1.000,00", "3.000,00", P]]);
    assert.equal(debits(rows)["Tülay Öz"], 11500);
    assert.deepEqual(dues(rows)["Tülay Öz"]?.slice(0, 2), [11500, 11500]);
  });

  test("B3 Kalan 0: borç 0 (Toplam'a düşülmez); takvimde kalem yok", () => {
    const rows = rowsOf("Borçlular", T13[0], [["2026/1", "Tülay Öz", "", "11.500,00", "11.500,00", "0,00", P], ["2026/2", "Mert Can", "", "8.000,00", "2.000,00", "6.000,00", P], ["2026/3", "Ece Ak", "", "4.000,00", "", "", P]]);
    assert.equal(debits(rows)["Tülay Öz"], 0, "Kalan 0 → 0");
    assert.equal(dues(rows)["Tülay Öz"], undefined, "ödenmiş: kalem yok");
    assert.equal(debits(rows)["Ece Ak"], 4000, "aynı tabloda boş Kalan → Toplam");
  });

  test("B4 bütün Kalan hücreleri dolu: Kalan (30a aynen); B5 yalnız Toplam: Toplam", () => {
    const full = rowsOf("Borçlular", T13[0], [["2026/1", "Tülay Öz", "", "11.500,00", "3.900,00", "7.600,00", P], ["2026/2", "Mert Can", "", "8.000,00", "2.000,00", "6.000,00", P]]);
    assert.deepEqual(debits(full), { "Mert Can": 6000, "Tülay Öz": 7600 });
    const only = rowsOf("Borçlular", ["Dosya No", "Ad Soyad", "Toplam Borç", "Ödeme Sözü"], [["2026/1", "Tülay Öz", "11.500,00", P], ["2026/2", "Mert Can", "8.000,00", P]]);
    assert.deepEqual(debits(only), { "Mert Can": 8000, "Tülay Öz": 11500 });
    assert.deepEqual(dues(only)["Tülay Öz"]?.slice(0, 2), [11500, 11500]);
  });
});

describe("31d E3: gün / adet / sayı / ay / yıl / oran / yüzde / % başlıklı kolon borç tutarı değildir (birim)", () => {
  test("B6 Tutar + Kalan Gün: borç Tutar (11.500 + 8.000 = 19.500), 'Kalan Gün' (5, 12) değil", () => {
    const rows = rowsOf("Kira", KIRA[0], KIRA.slice(1));
    const rep = ekstre(rows);
    assert.equal(rep.totals.debit, 19500, `Tablodaki Kişiler toplam borç 19.500 olmalı ('Kalan Gün' tutar değil); görülen ${rep.totals.debit}`);
    const items = dues(rows);
    assert.deepEqual([items["Selin Ak"]?.[0], items["Oya Tan"]?.[0]], [11500, 8000], `Takvim söz tutarları: ${JSON.stringify(items)}`);
    assert.ok(Object.values(items).every(item => item[2] !== "Kalan Gün"), `Kalan Borç kolonu 'Kalan Gün' olmamalı: ${JSON.stringify(items)}`);
  });

  test("B6 her biçim (Türkçe büyük harf dahil): Toplam Borç + <kolon> → borç Toplam Borç", () => {
    for (const header of ["Kalan Gün", "KALAN GÜN", "Gecikme Günü", "Taksit Sayısı", "Kalan Ay", "Kalan Taksit Adedi", "Faiz Oranı", "Gecikme Yüzdesi", "Kalan %"]) {
      const rows = rowsOf("Borçlular", ["Dosya No", "Ad Soyad", "Toplam Borç", header, "Ödeme Sözü"], [["2026/1", "Tülay Öz", "11.500,00", "5", P], ["2026/2", "Mert Can", "8.000,00", "12", P]]);
      assert.deepEqual(debits(rows), { "Mert Can": 8000, "Tülay Öz": 11500 }, `"${header}": Tablodaki Kişiler borcu Toplam Borç olmalı; görülen ${JSON.stringify(debits(rows))}`);
      const items = dues(rows);
      assert.deepEqual([items["Tülay Öz"]?.[0], items["Tülay Öz"]?.[2]], [11500, "Toplam Borç"], `"${header}": takvim ${JSON.stringify(items["Tülay Öz"])}`);
    }
  });

  test("B7 para başlıkları dışlanmaz: 'Aylık Taksit', 'Yıllık Ücret', 'Günlük Ücret' tek tutar sütunuysa borçtur (2.4.3 gibi) ve takvimde tutardır; 'Bakiye' kalan", () => {
    for (const header of ["Aylık Taksit", "Yıllık Ücret", "Günlük Ücret"]) {
      const rows = rowsOf("Kayıtlar", ["Dosya No", "Ad Soyad", header, "Ödeme Sözü"], [["2026/1", "Tülay Öz", "11.500,00", P], ["2026/2", "Mert Can", "8.000,00", P]]);
      const items = dues(rows);
      assert.deepEqual([items["Tülay Öz"]?.[0], items["Mert Can"]?.[0]], [11500, 8000], `"${header}" tutar kolonudur (gün/ay/yıl diye dışlanmaz): ${JSON.stringify(items)}`);
      assert.deepEqual(debits(rows), { "Mert Can": 8000, "Tülay Öz": 11500 }, `"${header}" tek tutar sütunu borçtur (daraltılmış karar 22.10.2026): ${JSON.stringify(debits(rows))}`);
    }
    const rows = rowsOf("Kayıtlar", ["Dosya No", "Ad Soyad", "Toplam Borç", "Bakiye", "Ödeme Sözü"], [["2026/1", "Tülay Öz", "11.500,00", "7.600,00", P], ["2026/2", "Mert Can", "8.000,00", "6.000,00", P]]);
    assert.deepEqual(debits(rows), { "Mert Can": 6000, "Tülay Öz": 7600 });
  });

  test("B10 tek yer: dues.mjs ve reports.mjs satır borcunu ve kolon dışlamasını ortak yardımcıdan alır", () => {
    for (const file of ["server/lib/insight/dues.mjs", "server/lib/reports.mjs"]) {
      const source = readFileSync(path.join(ROOT, file), "utf8").split(/\r?\n/).filter(line => !/^\s*\/\//.test(line)).join("\n");
      assert.match(source, /rowDebt\(/, `${file} satır borcunu rowDebt ile okumalı`);
      assert.match(source, /isNotAmountHeader\(/, `${file} tutar olmayan kolonu ortak listeyle dışlamalı`);
    }
  });
});

describe("31d E2/E3: ekranların okuduğu uçlar aynı toplamı gösterir (API)", () => {
  const root = mkdtempSync(path.join(tmpdir(), "kalan-satir-31d-"));
  let server;
  let api;
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  const RANGE = "from=2000-01-01&to=2099-12-31";
  before(async () => {
    const clock = createClock({ time: new Date(`${TODAY}T10:00:00`), fixed: true });
    server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: clock, legacyTableDues: true });
    api = await server.login();
    const staged = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "borclular.xlsx", sheets: [{ name: "Borçlular", matrix: T13 }, { name: "Kira", matrix: KIRA }] }));
    await must("tablo kaydet", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
  });
  after(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  });

  for (const [tab, expected] of [["Borçlular", 21500], ["Kira", 19500]]) {
    test(`Sekme "${tab}": Tablodaki Kişiler, Tahsilat Takvimi, Vade Takip ve Nakit Akışı hepsi ${expected}`, async () => {
      const q = `${RANGE}&tabs=${encodeURIComponent(tab)}`;
      const kisiler = (await must("Tablodaki Kişiler", api.get(`/api/workspace/reports/cari-ekstre?${q}`))).report.totals.debit;
      const vade = (await must("Vade Takip", api.get(`/api/workspace/reports/vade-takip?${q}`))).report.totals.amount;
      const akis = (await must("Nakit Akışı", api.get(`/api/workspace/reports/nakit-akis?${q}`))).report.totals.expected;
      const takvim = (await must("takvim", api.get("/api/workspace/dues"))).items.filter(item => (item.tab || item.sheet) === tab).reduce((sum, item) => sum + (item.amount || 0), 0);
      assert.deepEqual({ kisiler, takvim, vade, akis }, { kisiler: expected, takvim: expected, vade: expected, akis: expected }, `"${tab}" ekranları ${expected} olmalı (tablo hücrelerinden)`);
    });
  }
});
