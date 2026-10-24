// 2.4.4 31f U2 + 31b MM5 + 31f U8 — tablo raporlarında borç DOSYA NUMARASI (kayıt anahtarı) başına TEK kaynaktan; söz / taksit / kira tutarı borç değildir.
// Karar (kullanıcı adına 5 dk yetkisiyle, 22.10.2026): (1) borç kaydın Kalan Borç'u (boşsa Toplam Borç; gün/adet kolonu değil), (2) aynı dosya no farklı
// sekmelerde aynı kayıttır — borç bir kez, tahsilat bir kez, (3) Ödeme Sözü tutarı borç değildir (takvimde ve Nakit Akışı Beklenen'de yerini korur), "Ödendi"
// sözü hiçbir yerde borç değildir, (4) "Önce cari açın" Açılış Bakiyesi aynı kuralla (öbür sekmedeki Kalan), (5) bütün yollar ortak yardımcıdan.
// Beklenen sayılar tablo hücrelerinden ve girilen tutarlardan (ders 5). Programın kendi örnek dosyası (test/fixtures/tahsilat-ornek.mjs): İcra Takip Kalan
// 36.000 + 22.000 + 0 + 27.500 + 12.500 = 98.000 (2.4.3'teki toplam); aday 7 tabanında 198.500 (söz 33.000 + taksit toplamı 22.500 + kira 45.000 eklenmişti).
// "Nasıl bozulur?": D1 söz sekmesi borç sayılır · D2 "Ödendi" söz borç / takvim · D3 kapanmış dosya (Kalan 0) söz yüzünden borçlu · D4 aynı dosya iki sekmede
// borç iki kez (Kişiler, Vade Takip, Nakit Akışı) · D5 iki sekmede farklı Kalan · D6 söz kaleminin Açılış Bakiyesi boş (U8) · D7 dosya no'suz satırlar
// birleşir · D8 taksit "Toplam" / kira bedeli borç sayılır.
// DEĞİŞTİ (31e kontrol turu 2 A1, 23.10.2026): (2) artık "aynı dosya no farklı sekmelerde AYRI borç ve ayrı kalem + görünür not; tahsilat bir kez" (2.4.3 gibi).
// 2.4.5 madde 4 (uyarı kapısı): bu dosya tablo takvim motorunu zil / Tahsilat Takvimi / Vade Takip / Projeksiyon uçlarından sınar → 2.4.4 davranışı (legacyTableDues, yalnız testler).
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
  const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: clock, legacyTableDues: true });
  return { server, api: await server.login() };
};
const mustOf = async (label, promise) => {
  const res = await promise;
  assert.equal(res.status, 200, `${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};

describe("31f U2 / U8: programın örnek dosyası — söz tutarı borç değil, takvimde kalır; borç dosya başına bir kez", () => {
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

  test("D1/D3/D8 Tablodaki Kişiler: söz borç satırı açmaz; İcra Takip Kalan 98.000 + Kiracılar Kira bedeli 45.000 = 143.000; Ali Veli 36.000, Mehmet Demir 0", async () => {
    const rep = (await mustOf("Tablodaki Kişiler", api.get(`/api/workspace/reports/cari-ekstre?${RANGE}`))).report;
    // Daraltılmış karar (22.10.2026): yalnız söz tutarı borç dışı; tek tutar sütunlu Kiracılar (15.000 + 12.000 + 18.000) borçtur; Taksitler'de borç sütunu yok.
    assert.equal(rep.totals.debit, 143000, `toplam borç 143.000 olmalı (İcra Takip Kalan 98.000 + Kira bedeli 45.000; söz yok); görülen ${rep.totals.debit}`);
    const debit = name => rep.groups.find(group => group.cari === name)?.debit;
    assert.deepEqual(["Ali Veli", "Ayşe Kaya", "Mehmet Demir", "Zeynep Şahin", "Can Yıldız"].map(debit), [36000, 22000, 0, 27500, 12500], "kişi başına borç = İcra Takip Kalan hücresi");
    const tabs = [...new Set(rep.table.rows.filter(row => row.borc !== null && row.borc !== undefined).map(row => row.description.split(" · ")[0]))];
    assert.deepEqual(tabs.sort(), ["Kiracılar", "İcra Takip"].sort(), `borç satırları İcra Takip ve Kiracılar'dan (Ödeme Sözleri ve Taksitler yok): ${JSON.stringify(tabs)}`);
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

describe("31f U2 daraltılmış karar: okul servisi (tek tutar sütunu 'Aylık Ücret') Tablodaki Kişiler'de öğrencileri gösterir", () => {
  test("okul servisi: 6 öğrenci, borç = Aylık Ücret hücresi (3.500 + 3.500 + 3.800 + 3.800 + 4.500 + 4.500 = 23.600)", async () => {
    const { okulServisiWorkbook } = await import("./fixtures/okul-servisi-ornek.mjs");
    const sheet = okulServisiWorkbook(NOW)[0];
    const rows = sheet.rows.map((row, index) => ({ __hofKey: `satir:${index}`, __sheet: sheet.name, ...row }));
    const analyses = analyzeColumns(rows, sheet.columns, { now: NOW });
    const rep = cariEkstre({ records: normalizeRecords({ rows, analyses, session: "s1", sessionName: "Okul" }).records, payments: [], filters: normalizeFilters({}), now: NOW });
    assert.equal(rep.groups.length, 6, `Tablodaki Kişiler okul servisinde öğrencileri göstermeli (boş açılmamalı); görülen ${rep.groups.length} kişi`);
    assert.equal(rep.totals.debit, 23600, `toplam = Aylık Ücret hücreleri; görülen ${rep.totals.debit}`);
    // Aylık ücret kaydın Kalan Borç'u DEĞİLDİR: "Önce cari açın" Açılış Bakiyesi ve Tablodan Aktar bir aylık ücreti açılış borcu sanmaz (2.4.3'te de boştu;
    // e2e run.mjs okul servisi: pil → cari → Tablodan Aktar karta taşıma).
    const items = computeDues({ rows, tabs: [sheet.name], now: NOW }).items;
    assert.ok(items.length > 0, "okul servisinde ödenmemiş ay kalemleri var");
    assert.deepEqual([...new Set(items.map(item => item.debt))], [null], `takvim kaleminin Kalan Borç'u boş olmalı (aylık ücret açılış borcu değil); görülen ${JSON.stringify(items.map(item => [item.person, item.amount, item.debt]))}`);
  });
});

// 31e kontrol turu 2 A1 kararı (kullanıcı adına 5 dk yetkisiyle, 23.10.2026 04:09 UTC): MM5 "borç bir kez" kararı DEĞİŞTİ — farklı sekmede aynı dosya no ayrı
// borç ve ayrı vade kalemidir (2.4.3 gibi) + görünür not; tahsilat (5c) yine bir kez.
describe("31b MM5 → 31e A1: aynı dosya no iki sekmede — borç ve kalem ayrı (2.4.3 gibi) + not; tahsilat bir kez (5c)", () => {
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

  test("Tablodaki Kişiler Deniz Ak: borç 12.000 + 12.000 (iki sekme ayrı), alacak 3.000 bir kez, bakiye 21.000; Vade Takip ve Nakit Akışı Beklenen 12.000 + 12.000 + 9.000 − 3.000 = 30.000; not", async () => {
    const rep = (await mustOf("Tablodaki Kişiler", api.get(`/api/workspace/reports/cari-ekstre?${RANGE}`))).report;
    const deniz = rep.groups.find(group => group.cari === "Deniz Ak");
    assert.deepEqual([deniz?.debit, deniz?.credit, deniz?.balance], [24000, 3000, 21000], `Deniz Ak borç iki sekmede ayrı, tahsilat bir kez olmalı; görülen ${JSON.stringify([deniz?.debit, deniz?.credit, deniz?.balance])}`);
    const vade = (await mustOf("Vade Takip", api.get(`/api/workspace/reports/vade-takip?${RANGE}`))).report;
    assert.equal(vade.totals.amount, 30000, `Vade Takip toplamı 30.000 olmalı (Deniz 12.000 + 12.000 − 3.000, Mert 9.000); görülen ${vade.totals.amount}`);
    const akis = (await mustOf("Nakit Akışı", api.get(`/api/workspace/reports/nakit-akis?${RANGE}`))).report;
    assert.equal(akis.totals.expected, 30000, `Nakit Akışı Beklenen 30.000 olmalı; görülen ${akis.totals.expected}`);
    for (const [name, notes] of [["Kişiler", rep.notes], ["Vade Takip", vade.notes], ["Nakit Akışı", akis.notes]]) {
      assert.ok((notes || []).some(note => note.startsWith("1 dosya no birden çok sekmede; ayrı sayıldı (Alacaklar, Takip).")), `${name} notu: ${JSON.stringify(notes)}`);
    }
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

  test("D5 / A1 farklı Kalan: iki sekme ayrı borç (12.000 + 11.000), not iki sekmeyi adlandırır; takvimde iki kalem, her kalemin Kalan Borç'u kendi sekmesinden", () => {
    const rows = [...sheet("Alacaklar", header, [["2026/501", "Deniz Ak", "12.000,00", V], ["2026/502", "Mert Su", "9.000,00", V]]), ...sheet("Takip", header, [["2026/501", "Deniz Ak", "11.000,00", V]])];
    const rep = run(rows);
    assert.equal(rep.groups.find(group => group.cari === "Deniz Ak").debit, 23000, "iki sekme ayrı: 12.000 + 11.000");
    assert.deepEqual(rep.split.map(item => item.tabs.map(entry => [entry.tab, entry.amount])), [[["Alacaklar", 12000], ["Takip", 11000]]], `not kaynağı: ${JSON.stringify(rep.split)}`);
    assert.ok(rep.notes[0].startsWith("1 dosya no birden çok sekmede; ayrı sayıldı (Alacaklar, Takip). Aynı borçsa kopya sekmeyi kaldırın ya da Sekme süzgeciyle bakın."), rep.notes[0]);
    const dues = computeDues({ rows, tabs: ["Alacaklar", "Takip"], now: NOW });
    const deniz = dues.items.filter(item => item.person === "Deniz Ak");
    assert.deepEqual(deniz.map(item => [item.tab, item.amount, item.debt]), [["Alacaklar", 12000, 12000], ["Takip", 11000, 11000]], `takvimde Deniz iki kalem: ${JSON.stringify(deniz.map(item => [item.tab, item.amount, item.debt]))}`);
    assert.equal(dues.debtSplit.length, 1, "takvim de aynı notun kaynağını verir");
  });

  test("D4 / A1 aynı dosya iki sekmede FARKLI vadeyle: iki kalem (dönem sekmesinin vadesi düşmez), takvim toplamı 12.000 + 12.000 + 9.000", () => {
    const rows = [...sheet("Alacaklar", header, [["2026/501", "Deniz Ak", "12.000,00", shift(2)], ["2026/502", "Mert Su", "9.000,00", shift(2)]]), ...sheet("Takip", header, [["2026/501", "Deniz Ak", "12.000,00", shift(5)]])];
    const items = computeDues({ rows, tabs: ["Alacaklar", "Takip"], now: NOW }).items;
    const deniz = items.filter(item => item.person === "Deniz Ak");
    assert.deepEqual(deniz.map(item => [item.tab, item.amount]), [["Alacaklar", 12000], ["Takip", 12000]], `Deniz'in iki sekmedeki kalemi ayrı olmalı; görülen ${JSON.stringify(deniz.map(item => [item.tab, item.due, item.amount]))}`);
    assert.equal(items.reduce((sum, item) => sum + (item.amount || 0), 0), 33000, "takvim toplamı 12.000 + 12.000 + 9.000");
    assert.equal(run(rows).totals.debit, 33000, "Tablodaki Kişiler toplamı aynı");
  });

  test("D1 yalnız söz sekmesi (dosyanın başka sekmede borcu yok): söz tutarı borç satırı açmaz; takvimde söz tutarı yerinde", () => {
    const rows = sheet("Sözler", ["Dosya No", "Borçlu", "Söz Tarihi", "Söz Tutarı"], [["2026/601", "Nur Ay", shift(3), "4.000,00"]]);
    const rep = run(rows);
    assert.equal(rep.totals.debit, 0, `söz tutarı borç değildir; görülen toplam borç ${rep.totals.debit}`);
    assert.deepEqual(computeDues({ rows, tabs: ["Sözler"], now: NOW }).items.map(item => [item.person, item.amount]), [["Nur Ay", 4000]], "takvimde söz 4.000");
  });

  test("D7 dosya no'suz satırlar ayrı kalır (aynı ad, iki sekme: iki ayrı borç)", () => {
    const rows = [...sheet("Alacaklar", ["Borçlu", "Kalan", "Vade"], [["Deniz Ak", "12.000,00", V]], false), ...sheet("Takip", ["Borçlu", "Kalan", "Vade"], [["Deniz Ak", "5.000,00", V]], false)];
    const rep = run(rows);
    assert.equal(rep.groups.find(group => group.cari === "Deniz Ak").debit, 17000, "anahtarsız iki satır: 12.000 + 5.000");
  });
});
