// 2.4.4 31f U2 + 31b MM5 + 31f U8 — tablo raporlarında borç DOSYA NUMARASI (kayıt anahtarı) başına TEK kaynaktan; söz / taksit / kira tutarı borç değildir.
// Karar (kullanıcı adına 5 dk yetkisiyle, 22.10.2026): (1) borç kaydın Kalan Borç'u (boşsa Toplam Borç; gün/adet kolonu değil), (2) aynı dosya no farklı
// sekmelerde aynı kayıttır — borç bir kez, tahsilat bir kez, (3) Ödeme Sözü tutarı borç değildir (takvimde ve Nakit Akışı Beklenen'de yerini korur), "Ödendi"
// sözü hiçbir yerde borç değildir, (4) "Önce cari açın" Açılış Bakiyesi aynı kuralla (öbür sekmedeki Kalan), (5) bütün yollar ortak yardımcıdan.
// Beklenen sayılar tablo hücrelerinden ve girilen tutarlardan (ders 5). Programın kendi örnek dosyası (test/fixtures/tahsilat-ornek.mjs): İcra Takip Kalan
// 36.000 + 22.000 + 0 + 27.500 + 12.500 = 98.000 (2.4.3'teki toplam); aday 7 tabanında 198.500 (söz 33.000 + taksit toplamı 22.500 + kira 45.000 eklenmişti).
// "Nasıl bozulur?": D1 söz sekmesi borç sayılır · D2 "Ödendi" söz borç / takvim · D3 kapanmış dosya (Kalan 0) söz yüzünden borçlu · D4 aynı dosya iki sekmede
// borç iki kez (Kişiler, Vade Takip, Nakit Akışı) · D5 iki sekmede farklı Kalan · D6 söz kaleminin Açılış Bakiyesi boş (U8) · D7 dosya no'suz satırlar
// birleşir · D8 taksit "Toplam" / kira bedeli borç sayılır.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { analyzeColumns } from "../server/lib/insight/columns.mjs";
import { computeDues } from "../server/lib/insight/dues.mjs";
import { cariEkstre, normalizeFilters, normalizeRecords } from "../server/lib/reports.mjs";
import { createClock } from "../server/lib/clock.mjs";
import { tahsilatWorkbook } from "./fixtures/tahsilat-ornek.mjs";
import { CURRENT, bootVersion } from "./guvenilirlik/surumler.mjs";

const pad = value => String(value).padStart(2, "0");
const NOW = new Date();
const TODAY = `${NOW.getFullYear()}-${pad(NOW.getMonth() + 1)}-${pad(NOW.getDate())}`;
const shift = days => {
  const date = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + days, 12);
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;
};
const RANGE = "from=2000-01-01&to=2099-12-31";
const matrixOf = sheet => [sheet.columns, ...sheet.rows.map(row => sheet.columns.map(column => row[column] ?? ""))];
const boot = async root => {
  const clock = createClock({ time: new Date(`${TODAY}T10:00:00`), fixed: true });
  const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: clock });
  return { server, api: await server.login() };
};
const mustOf = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};

describe("31f U2 / U8: programın örnek dosyası — borç yalnız dosyanın Kalan'ından (98.000), söz takvimde kalır", () => {
  const root = mkdtempSync(path.join(tmpdir(), "tablo-borc-u2-"));
  let server;
  let api;
  before(async () => {
    ({ server, api } = await boot(root));
    await mustOf("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
    const staged = await mustOf("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "tahsilat.xlsx", sheets: tahsilatWorkbook(NOW).map(sheet => ({ name: sheet.name, matrix: matrixOf(sheet) })) }));
    await mustOf("tablo kaydet", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
  });
  after(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("D1/D3/D8 Tablodaki Kişiler: toplam borç 98.000 (İcra Takip Kalan), Ali Veli 36.000, Mehmet Demir 0; söz / taksit / kira borç satırı açmaz", async () => {
    const rep = (await mustOf("Tablodaki Kişiler", api.get(`/api/workspace/reports/cari-ekstre?${RANGE}`))).report;
    assert.equal(rep.totals.debit, 98000, `toplam borç 98.000 olmalı (yalnız İcra Takip'in Kalan'ı); görülen ${rep.totals.debit}`);
    const debit = name => rep.groups.find(group => group.cari === name)?.debit;
    assert.deepEqual(["Ali Veli", "Ayşe Kaya", "Mehmet Demir", "Zeynep Şahin", "Can Yıldız"].map(debit), [36000, 22000, 0, 27500, 12500], "kişi başına borç = İcra Takip Kalan hücresi");
    const tabs = [...new Set(rep.table.rows.filter(row => row.borc !== null && row.borc !== undefined).map(row => row.description.split(" · ")[0]))];
    assert.deepEqual(tabs, ["İcra Takip"], `borç satırları yalnız İcra Takip'ten: ${JSON.stringify(tabs)}`);
  });

  test("D2/D6 Tahsilat Takvimi: açık sözler yerinde (Ali Veli 5.000), 'Ödendi' sözler yok; söz kaleminin Kalan Borç'u İcra Takip'ten (36.000)", async () => {
    const items = (await mustOf("takvim", api.get("/api/workspace/dues"))).items;
    const ali = items.find(item => item.person === "Ali Veli" && item.promise);
    assert.ok(ali, `Ali Veli sözü takvimde: ${JSON.stringify(items.map(item => [item.person, item.label]))}`);
    assert.equal(ali.amount, 5000, "söz tutarı 5.000 (beklenen tahsilat)");
    assert.deepEqual([ali.debt, ali.debtColumn], [36000, "İcra Takip · Kalan"], `Açılış Bakiyesi ön dolumu öbür sekmedeki Kalan'dan olmalı (U8); görülen ${JSON.stringify([ali.debt, ali.debtColumn])}`);
    assert.equal(items.some(item => item.person === "Mehmet Demir" || item.person === "Can Yıldız"), false, "'Ödendi' sözler takvimde değil");
    const akis = (await mustOf("Nakit Akışı", api.get(`/api/workspace/reports/nakit-akis?${RANGE}&tabs=${encodeURIComponent("Ödeme Sözleri")}`))).report;
    assert.equal(akis.totals.expected, 15500, `Nakit Akışı Beklenen (Ödeme Sözleri): açık sözler 5.000 + 3.000 + 7.500; görülen ${akis.totals.expected}`);
  });
});

describe("31b MM5: aynı dosya no iki sekmede — borç bir kez (Kişiler, Vade Takip, Nakit Akışı), tahsilat bir kez", () => {
  const root = mkdtempSync(path.join(tmpdir(), "tablo-borc-mm5-"));
  let server;
  let api;
  const V = shift(10);
  before(async () => {
    ({ server, api } = await boot(root));
    await mustOf("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
    const header = ["Dosya No", "Borçlu", "Telefon", "Toplam Borç", "Kalan", "Vade"];
    const sheets = [
      { name: "Alacaklar", matrix: [header, ["2026/501", "Deniz Ak", "0532 501 50 10", "20.000,00", "12.000,00", V], ["2026/502", "Mert Su", "0532 502 50 20", "9.000,00", "9.000,00", V]] },
      { name: "Takip", matrix: [header, ["2026/501", "Deniz Ak", "0532 501 50 10", "20.000,00", "12.000,00", V]] },
    ];
    const staged = await mustOf("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "alacaklar.xlsx", sheets }));
    await mustOf("tablo kaydet", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace" }));
    const deniz = await mustOf("cari", api.post("/api/workspace/accounts", { name: "Deniz Ak", phone: "0532 501 50 10", type: "customer", caseKey: "2026/501", caseTitle: "Deniz Ak" }));
    await mustOf("tahsilat", api.post(`/api/workspace/accounts/${deniz.id}/entries`, { kind: "in", amount: "3.000", date: TODAY, method: "cash" }));
  });
  after(async () => {
    await server?.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("Tablodaki Kişiler Deniz Ak: borç 12.000 bir kez, alacak 3.000, bakiye 9.000; Vade Takip ve Nakit Akışı Beklenen 18.000 (9.000 + 9.000)", async () => {
    const rep = (await mustOf("Tablodaki Kişiler", api.get(`/api/workspace/reports/cari-ekstre?${RANGE}`))).report;
    const deniz = rep.groups.find(group => group.cari === "Deniz Ak");
    assert.deepEqual([deniz?.debit, deniz?.credit, deniz?.balance], [12000, 3000, 9000], `Deniz Ak borç bir kez olmalı; görülen ${JSON.stringify([deniz?.debit, deniz?.credit, deniz?.balance])}`);
    const vade = (await mustOf("Vade Takip", api.get(`/api/workspace/reports/vade-takip?${RANGE}`))).report;
    assert.equal(vade.totals.amount, 18000, `Vade Takip toplamı 18.000 olmalı (Deniz 12.000 − 3.000, Mert 9.000; bir kez); görülen ${vade.totals.amount}`);
    const akis = (await mustOf("Nakit Akışı", api.get(`/api/workspace/reports/nakit-akis?${RANGE}`))).report;
    assert.equal(akis.totals.expected, 18000, `Nakit Akışı Beklenen 18.000 olmalı; görülen ${akis.totals.expected}`);
    assert.deepEqual(rep.conflicts, [], "iki sekmenin Kalan'ı aynı: uyuşmazlık yok");
  });
});

describe("31b MM5 / D5 / D7: iki sekmede farklı Kalan ve dosya no'suz satırlar (birim)", () => {
  const sheet = (name, header, lines, keyed = true) => lines.map((line, index) => ({ __hofKey: keyed ? line[0] : `satir:${name}:${index}`, __sheet: name, ...Object.fromEntries(header.map((column, at) => [column, line[at]])) }));
  const header = ["Dosya No", "Borçlu", "Kalan", "Vade"];
  const V = shift(3); // takvim penceresinin içinde
  const run = rows => {
    const analyzeTab = scope => analyzeColumns(scope, Object.keys(scope[0]).filter(key => !key.startsWith("__")), { now: NOW });
    const normalized = normalizeRecords({ rows, analyses: analyzeTab(rows), session: "s1", sessionName: "Tablo", tabs: ["Alacaklar", "Takip"], analyzeTab });
    return cariEkstre({ records: normalized.records, payments: [], filters: normalizeFilters({}), now: NOW });
  };

  test("D5 farklı Kalan: ilk sekmenin Kalan'ı (12.000) geçerli, uyuşmazlık bildirilir; takvim aynı tutarı kullanır", () => {
    const rows = [...sheet("Alacaklar", header, [["2026/501", "Deniz Ak", "12.000,00", V], ["2026/502", "Mert Su", "9.000,00", V]]), ...sheet("Takip", header, [["2026/501", "Deniz Ak", "11.000,00", V]])];
    const rep = run(rows);
    assert.equal(rep.groups.find(group => group.cari === "Deniz Ak").debit, 12000, "ilk sekmenin (Alacaklar) Kalan'ı");
    assert.equal(rep.conflicts.length, 1, `uyuşmazlık bildirilir: ${JSON.stringify(rep.conflicts)}`);
    assert.deepEqual([rep.conflicts[0].kept.tab, rep.conflicts[0].kept.amount, rep.conflicts[0].other.tab, rep.conflicts[0].other.amount], ["Alacaklar", 12000, "Takip", 11000]);
    const dues = computeDues({ rows, tabs: ["Alacaklar", "Takip"], now: NOW });
    const deniz = dues.items.filter(item => item.person === "Deniz Ak");
    assert.deepEqual(deniz.map(item => [item.amount, item.debt]), [[12000, 12000]], `takvimde Deniz bir kalem, 12.000: ${JSON.stringify(deniz.map(item => [item.tab, item.amount, item.debt]))}`);
    assert.equal(dues.debtConflicts.length, 1, "takvim de uyuşmazlığı bildirir");
  });

  test("D4 aynı dosya iki sekmede FARKLI vadeyle: borçtan gelen kalem tutarı bir kez (en erken vade), takvim toplamı 12.000 + 9.000", () => {
    const rows = [...sheet("Alacaklar", header, [["2026/501", "Deniz Ak", "12.000,00", shift(2)], ["2026/502", "Mert Su", "9.000,00", shift(2)]]), ...sheet("Takip", header, [["2026/501", "Deniz Ak", "12.000,00", shift(5)]])];
    const items = computeDues({ rows, tabs: ["Alacaklar", "Takip"], now: NOW }).items;
    const deniz = items.filter(item => item.person === "Deniz Ak");
    assert.deepEqual(deniz.map(item => [item.tab, item.amount]), [["Alacaklar", 12000]], `Deniz'in borcu takvimde bir kez (en erken vadeli kalem) olmalı; görülen ${JSON.stringify(deniz.map(item => [item.tab, item.due, item.amount]))}`);
    assert.equal(items.reduce((sum, item) => sum + (item.amount || 0), 0), 21000, "takvim toplamı 12.000 + 9.000");
    assert.equal(run(rows).totals.debit, 21000, "Tablodaki Kişiler toplamı aynı");
  });

  test("D7 dosya no'suz satırlar ayrı kalır (aynı ad, iki sekme: iki ayrı borç)", () => {
    const rows = [...sheet("Alacaklar", ["Borçlu", "Kalan", "Vade"], [["Deniz Ak", "12.000,00", V]], false), ...sheet("Takip", ["Borçlu", "Kalan", "Vade"], [["Deniz Ak", "5.000,00", V]], false)];
    const rep = run(rows);
    assert.equal(rep.groups.find(group => group.cari === "Deniz Ak").debit, 17000, "anahtarsız iki satır: 12.000 + 5.000");
  });
});
