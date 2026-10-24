// 2.4.5 madde 4 + 5 (UYARI KAPISI; kullanıcı kararı 23.10.2026 "tablo ajanda / rehber", docs/2.4.5-IS-LISTESI.md):
//   4. Zil, Tahsilat Takvimi (GET /api/workspace/dues items), Anlık Durum Vade Takip ve Nakit Akış Projeksiyonu'nda tablodan gelen TUTARLI kalem (ödeme günü,
//      aidat, taksit tarihi, ödeme sözü — açık sayfanın da öbür sayfanın da) YOK; tablonun TUTARSIZ tarih hatırlatmaları (sözleşme bitiş, sigorta, lisans
//      bitiş …) KALIR ve 2.4.4'tekiyle AYNI (ödeme kalemi doğuran "Söz Tarihi" gibi kolonlar son tarih de sayılmaz — para tarihi ajandaya dönüşmez). Taksit,
//      çek, fatura, planlı banka kalemleri AYNEN. Projeksiyon'un "Tablo" seçeneği ve Vade Takip'in "Tablo" / "Ödeme Sözü" kaynakları kalktı.
//   5. Tablo Raporları: tablodan gelen tutar başlıkta "(Muhasebe Kaydı Değil)"; Tablodaki Nakit Akışı'nda Kasa sütunları yok. Tablo Raporları'nın satırları
//      (aynı takvim motoru) DEĞİŞMEZ.
// KÂHİN (ders 5): (a) senaryonun kendi sayıları — tablo dosyası test/fixtures/tahsilat-ornek.mjs ve girilen modül kayıtları (1 gecikmiş taksit, 1 çek, 1 vadeli
// fatura, 1 planlı banka; 2 + 1 son tarih); (b) v2.4.4'ün GERÇEK kodu (git etiketi; d2cef7c'nin ürün kodu) aynı veride: tablo dışı kalemler ve son tarihler
// birebir aynı, tablo kalemleri v2.4.4'te var; (c) aynı kod, eski davranış anahtarıyla (legacyTableDues) — anahtar yalnız tablo kalemlerini açar.
// "Nasıl bozulur?" (not defteri 245-kapi-uyari/nasil-bozulur.md): öbür sayfa yolu · kartlı kişinin sözü · önbellek (tablo yeniden yüklenince) · Vade Takip ile
// takvim farklı kaynak · yetkisiz kullanıcı · exclude bağımlılığı (Söz Tarihi son tarihe düşer) · Kasa sütunu / etiket ekran-PDF-Excel ayrışması.
import "./fixtures/saat-dilimi-istanbul.mjs";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { tahsilatWorkbook } from "./fixtures/tahsilat-ornek.mjs";
import { okulServisiWorkbook } from "./fixtures/okul-servisi-ornek.mjs";
import { CURRENT, bootVersion, tagsAvailable } from "./guvenilirlik/surumler.mjs";

const OLD = "v2.4.4";
const NOW_ISO = "2026-10-20T10:00:00+03:00";
const NOW = new Date(NOW_ISO);
const pad = value => String(value).padStart(2, "0");
const day = offset => {
  const date = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() + offset, 12);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const trDay = offset => day(offset).split("-").reverse().join(".");
const matrix = sheet => [sheet.columns, ...sheet.rows.map(row => sheet.columns.map(column => row[column] ?? ""))];
const SECOND = [
  { name: "Sözler", matrix: [["Dosya No", "Borçlu", "Söz Tarihi", "Söz Tutarı", "Durum"], ["2026/9001", "Öbür Söz Kişisi", trDay(2), "1.250,00 ₺", "Bekliyor"]] },
  { name: "Lisanslar", matrix: [["Vergi No", "Firma Adı", "Telefon", "Lisans Bitiş Tarihi"], ["6111111111", "Öbür Lisans Firması", "0536 111 11 11", trDay(3)]] },
];
const isTableItem = item => !item.source;
const TABLE_SOURCES = new Set(["table", "promise"]);
// Karşılaştırma anahtarları (oturum anahtarı sunucuya göre rastgele: sayfa adıyla).
// Kayıt kimlikleri (uuid) sunucuya göre farklı: kaynak, tutar, tarih, yön, kişi ve adla.
const itemKey = item => [item.source, item.amount, item.dueDate || item.due || item.date || "", item.direction || "", item.person || "", item.label || ""].join("|");
const deadlineKey = item => [item.tab, item.label, item.person, item.due, item.foreign ? `öbür:${item.pageName}` : "açık", item.type].join("|");
const rowKey = row => [row.source, row.date, row.amount, row.label, row.party, row.direction].join("|");
const sorted = list => [...list].sort();

async function seed(server) {
  const api = await server.login();
  const must = async (label, promise) => {
    const res = await promise;
    assert.equal(res.status, 200, `${server.version} ${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
    return res.data;
  };
  await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
  const book = tahsilatWorkbook(NOW);
  const first = await must("tablo", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "Tahsilat.xlsx", sheets: book.map(sheet => ({ name: sheet.name, matrix: matrix(sheet) })) }));
  await must("tablo kaydet", api.post("/api/workspace/dataset/commit", { stageId: first.stageId, mode: "replace" }));
  const second = await must("ikinci sayfa", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "Ikinci.xlsx", sheets: SECOND }));
  await must("ikinci sayfa kaydet", api.post("/api/workspace/dataset/commit", { stageId: second.stageId, mode: "session", name: "İkinci Sayfa" }));
  const sessions = await must("sayfalar", api.get("/api/workspace/sessions"));
  const page1 = sessions.sessions.find(item => item.name !== "İkinci Sayfa")?.key;
  assert.ok(page1 && sessions.sessions.length === 2, `${server.version}: iki sayfa ${JSON.stringify(sessions.sessions)}`);
  await must("1. sayfa", api.post("/api/workspace/sessions/select", { key: page1 }));
  const customer = await must("cari", api.post("/api/workspace/accounts", { name: "Deniz Ticaret", type: "customer" }));
  // Çek ayrı caride: aynı carinin alınan çeki (alacak) vadeli faturayı en eskiden kapatır (fatura kapaması; doğru davranış) ve fatura kalemi düşerdi.
  const drawer = await must("çek carisi", api.post("/api/workspace/accounts", { name: "Ece Çek Ticaret", type: "customer" }));
  await must("çek", api.post("/api/workspace/cheques", { direction: "in", instrument: "cheque", accountId: drawer.id, drawer: "Ece Çek Ticaret", amount: 7500, issueDate: day(0), dueDate: day(3), serialNo: "K245-1", bank: "Garanti" }));
  await must("vadeli fatura", api.post("/api/workspace/invoices", { kind: "sale", accountId: customer.id, issueDate: day(0), lines: [{ name: "Hizmet", qty: 1, unitPrice: 1000, discountRate: 0, vatRate: 0 }], payment: { cash: [], cheques: [], endorse: [], rest: "open", dueDate: day(4) }, force: true }));
  // Kartlı kişi: Ayşe Kaya'nın (2026/1102) bugünkü ödeme sözü 2.4.4'te kartı olsa da takvimde kalıyordu (söz kişiye özel taahhüt).
  await must("taksit kartı", api.post("/api/workspace/plans", { name: "Ayşe Kaya", total: "3.000", mode: "auto", count: 3, firstDue: day(-20), registeredOn: day(-20), caseKey: "2026/1102", caseTitle: "Ayşe Kaya" }));
  const bank = await must("banka hesabı", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: day(-30), amount: "10.000", confirmed: true } }));
  await must("planlı banka", api.post("/api/workspace/bank/plans", { kind: "other_out", accountId: bank.id, amount: "500", plannedDate: day(1), description: "Kira" }));
  await must("personel", api.post("/api/admin/users", { username: "kapi245", name: "Kapı Personeli", role: "personel", password: "Kapi-Parola-2450", mustChangePassword: false }));
  const staff = await server.login("kapi245", "Kapi-Parola-2450");
  await must("personel 1. sayfa", staff.post("/api/workspace/sessions/select", { key: page1 }));
  const read = async () => ({
    dues: await must("takvim", api.get("/api/workspace/dues")),
    staffDues: await must("takvim (personel)", staff.get("/api/workspace/dues")),
    vade: await must("vade takip", api.get("/api/workspace/overview/vade-takip?preset=open")),
    flow: await must("nakit akış", api.get("/api/workspace/overview/nakit-akisi?preset=next30&overdue=1")),
    flowNoTable: await must("nakit akış table=0", api.get("/api/workspace/overview/nakit-akisi?preset=next30&overdue=1&table=0")),
    flowTable1: await must("nakit akış table=1", api.get("/api/workspace/overview/nakit-akisi?preset=next30&overdue=1&table=1")),
    report: await must("Tablodaki Vadeler", api.get("/api/workspace/reports/vade-takip")),
    flowReport: await must("Tablodaki Nakit Akışı", api.get(`/api/workspace/reports/nakit-akis?from=${day(-60)}&to=${day(60)}`)),
    people: await must("Tablodaki Kişiler", api.get("/api/workspace/reports/cari-ekstre")),
  });
  return { api, staff, must, read, page1 };
}

describe("2.4.5 madde 4: dueSources = computeDues(...).sources (son tarihlerin exclude'u aynı kural)", () => {
  test("tahsilat ve okul servisi örneklerinde aynı kolonlar; exclude olmadan Söz Tarihi son tarihe düşerdi", async () => {
    const mod = await import("../server/lib/insight/dues.mjs");
    assert.equal(typeof mod.dueSources, "function", "insight/dues.mjs dueSources yok (2.4.5 madde 4: takvim kalemleri hesaplanmadan son tarihlerin exclude'u)");
    const flat = book => book.flatMap(sheet => sheet.rows.map((row, index) => ({ __hofKey: `${sheet.name}:${index + 1}`, __sheet: sheet.name, ...(Array.isArray(row) ? Object.fromEntries(sheet.columns.map((column, at) => [column, row[at]])) : row) })));
    for (const book of [tahsilatWorkbook(NOW), okulServisiWorkbook(NOW)]) {
      const rows = flat(book);
      const tabs = book.map(sheet => sheet.name);
      assert.deepEqual(mod.dueSources({ rows, tabs, now: NOW }), mod.computeDues({ rows, tabs, now: NOW }).sources);
    }
    const rows = flat(tahsilatWorkbook(NOW));
    const tabs = tahsilatWorkbook(NOW).map(sheet => sheet.name);
    const kept = mod.computeDeadlines({ rows, tabs, now: NOW, exclude: mod.dueSources({ rows, tabs, now: NOW }) });
    const all = mod.computeDeadlines({ rows, tabs, now: NOW, exclude: [] });
    assert.ok(!kept.some(item => item.label === "Söz Tarihi") && all.some(item => item.label === "Söz Tarihi"), "exclude Söz Tarihi'ni son tarihten çıkarır (testin dişi)");
  });
  // İş listesi KS6 (ana oturum, 24.10.2026): tutarlı kalem doğuran ödeme tarihi sütunu ("Son Ödeme", söz tarihi) son tarihe DÜŞMEZ; tutarsız tarih sütunları
  // (duruşma, sözleşme bitiş) kalır.
  test("KS6: 'Son Ödeme' son tarih değil; 'Duruşma Tarihi' ve 'Sözleşme Bitiş' son tarih", async () => {
    const { computeDeadlines, dueSources } = await import("../server/lib/insight/dues.mjs");
    const rows = [["Ali Veli", "1000", trDay(2), trDay(4), trDay(3)], ["Ayşe Kaya", "2000", trDay(-3), trDay(5), trDay(6)], ["Can Er", "1500", trDay(1), trDay(20), trDay(2)]].map((cells, index) => ({ __hofKey: `k${index}`, __sheet: "Takip", "Ad Soyad": cells[0], Tutar: cells[1], "Son Ödeme": cells[2], "Duruşma Tarihi": cells[3], "Sözleşme Bitiş": cells[4] }));
    const kept = computeDeadlines({ rows, tabs: ["Takip"], now: NOW, exclude: dueSources({ rows, tabs: ["Takip"], now: NOW }) });
    assert.deepEqual(sorted(kept.map(item => `${item.person}|${item.label}`)), sorted(["Ali Veli|Duruşma Tarihi", "Ali Veli|Sözleşme Bitiş", "Ayşe Kaya|Duruşma Tarihi", "Ayşe Kaya|Sözleşme Bitiş", "Can Er|Sözleşme Bitiş"]));
    assert.ok(computeDeadlines({ rows, tabs: ["Takip"], now: NOW, exclude: [] }).some(item => item.label === "Son Ödeme"), "exclude olmasa Son Ödeme son tarihe düşerdi (testin dişi)");
  });
});

describe("2.4.5 madde 4: kaynak — tablo kalemleri (computeDues) yalnız eski davranış anahtarıyla bir listeye girer", () => {
  const read = file => readFileSync(new URL(`../${file}`, import.meta.url), "utf8").split(/\r?\n/).filter(line => !/^\s*\/\//.test(line)).join("\n");
  test("routes/dues.mjs: computeDues yalnız legacyTable dalında; öbür sayfanın tablo kalemi yalnız legacyTable ile", () => {
    const source = read("server/routes/dues.mjs");
    assert.match(source, /const legacyTable = config\?\.legacyTableDues === true;/, "dues.mjs: legacyTable anahtarı yok");
    const calls = [...source.matchAll(/computeDues\(/g)].map(match => match.index);
    assert.ok(calls.length >= 1, "computeDues çağrısı bulunamadı");
    // Her çağrı, kendisinden önceki son `if (legacyTable) {` satırının bloğu içinde: aradaki satırlarda o girintiyle kapanan `}` yok.
    for (const at of calls) {
      const before = source.slice(0, at);
      const open = before.lastIndexOf("if (legacyTable) {");
      assert.ok(open >= 0, "computeDues çağrısından önce `if (legacyTable) {` yok");
      const lineStart = before.lastIndexOf("\n", open) + 1;
      const indent = before.slice(lineStart, open);
      assert.ok(/^\s*$/.test(indent) && !before.slice(open).split("\n").slice(1).some(line => line.startsWith(`${indent}}`)), "computeDues çağrısı `if (legacyTable) {` dalının içinde olmalı");
    }
    assert.match(source, /legacyTable && !item\.carded\) foreignItems\.push/, "öbür sayfanın tablo kalemi yalnız legacyTable ile");
  });
  test("routes/overview.mjs: Vade Takip kaynaklarında table / promise yok; Projeksiyon withTable yalnız legacyTable ile", () => {
    const source = read("server/routes/overview.mjs");
    const list = JSON.parse(/const DUE_SOURCES = (\[[^\]]*\])/.exec(source)[1]);
    assert.ok(!list.includes("table") && !list.includes("promise") && list.includes("deadline"), `DUE_SOURCES: ${list.join(", ")}`);
    assert.match(source, /const withTable = legacyTable && /, "withTable legacyTable'a bağlı değil");
  });
  test("anahtar üretimde kapalı: varsayılan false, ortam değişkeni yok, üretim girişi vermiyor", async () => {
    const { loadConfig } = await import("../server/lib/config.mjs");
    assert.equal(loadConfig({}).legacyTableDues, false);
    assert.equal(loadConfig({ env: { HUKUK_LEGACY_TABLE_DUES: "1", LEGACY_TABLE_DUES: "1" } }).legacyTableDues, false);
    assert.ok(!/legacyTableDues/.test(readFileSync(new URL("../server/server.mjs", import.meta.url), "utf8")), "server/server.mjs anahtarı açmamalı");
  });
});

describe("2.4.5 madde 4 + 5 (API): ürün = v2.4.4 − tablo kalemleri; son tarihler ve modül kalemleri aynı", () => {
  const root = mkdtempSync(path.join(tmpdir(), "kapi-uyari-245-"));
  const servers = {};
  const data = {};
  const ctx = {};
  const dirs = name => ({ dataDir: path.join(root, name, "data"), backupDir: path.join(root, name, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, now: { time: NOW_ISO, fixed: true } });
  const withOld = tagsAvailable([OLD]);

  before(async () => {
    servers.product = await bootVersion(CURRENT, dirs("urun"));
    servers.legacy = await bootVersion(CURRENT, { ...dirs("eski-davranis"), legacyTableDues: true });
    if (withOld) servers.old = await bootVersion(OLD, dirs("v244"));
    for (const [name, server] of Object.entries(servers)) {
      ctx[name] = await seed(server);
      data[name] = await ctx[name].read();
    }
  });
  after(async () => {
    for (const server of Object.values(servers)) await server.close();
    rmSync(root, { recursive: true, force: true });
  });

  test("Tahsilat Takvimi / zil: tablo kalemi YOK (açık sayfa, öbür sayfa, kartlı kişinin sözü); yan alanlar boş", () => {
    const { dues } = data.product;
    const table = dues.items.filter(isTableItem);
    assert.deepEqual(table.map(item => `${item.person} · ${item.label}`), [], "takvimde tablo kalemi kalmamalı (zil de bu listeden okur)");
    assert.ok(!dues.items.some(item => item.foreign), "öbür sayfanın tablo kalemi yok");
    assert.deepEqual([dues.sources, dues.dormant, dues.notes], [[], [], []], "sources / dormant / notes boş");
    // Eski davranışta (aynı kod, anahtar açık) aynı veride tablo kalemleri vardı: testin dişi (veri gerçekten tablo kalemi doğuruyor).
    const legacy = data.legacy.dues.items.filter(isTableItem);
    assert.ok(legacy.some(item => item.promise && item.person === "Ayşe Kaya"), `eski davranışta kartlı kişinin sözü vardı: ${legacy.map(item => item.person).join(", ")}`);
    assert.ok(legacy.some(item => item.foreign && item.person === "Öbür Söz Kişisi"), "eski davranışta öbür sayfanın sözü vardı");
    assert.ok(legacy.some(item => item.label === "Kira") && legacy.some(item => /taksit/i.test(item.label)), "eski davranışta kira ve taksit tarihi kalemleri vardı");
  });

  test("modül kalemleri aynı: 1 gecikmiş taksit, 1 çek, 1 vadeli fatura, 1 planlı banka (senaryodan); eski davranış ve v2.4.4 ile birebir", () => {
    const modules = list => sorted(list.filter(item => !isTableItem(item)).map(itemKey));
    const product = data.product.dues.items;
    const count = source => product.filter(item => item.source === source).length;
    assert.deepEqual(["plan", "cheque", "invoice", "bank"].map(count), [1, 1, 1, 1], `kalemler: ${product.map(item => item.source).join(", ")}`);
    assert.equal(product.length, 4, "takvimde yalnız modül kalemleri");
    assert.deepEqual(modules(product), modules(data.legacy.dues.items), "eski davranışla aynı modül kalemleri");
    if (withOld) assert.deepEqual(modules(product), modules(data.old.dues.items), "v2.4.4 ile aynı modül kalemleri");
  });

  test("son tarihler KALIR ve aynı: Sözleşme bitiş + Sigorta yenileme (açık sayfa), Lisans Bitiş (öbür sayfa); Söz Tarihi son tarih değil", () => {
    const { deadlines } = data.product.dues;
    const names = sorted(deadlines.map(item => `${item.person}|${item.label}|${item.foreign ? "öbür" : "açık"}`));
    assert.deepEqual(names, sorted(["Deniz Öztürk|Sözleşme bitiş|açık", "Hakan Kurt|Sigorta yenileme|açık", "Öbür Lisans Firması|Lisans Bitiş Tarihi|öbür"]), `son tarihler: ${names.join(", ")}`);
    assert.ok(!deadlines.some(item => item.label === "Söz Tarihi"), "ödeme kalemi doğuran Söz Tarihi son tarihe dönüşmez (para tarihi ajandaya dönüşmez)");
    assert.deepEqual(sorted(deadlines.map(deadlineKey)), sorted(data.legacy.dues.deadlines.map(deadlineKey)), "eski davranışla aynı son tarihler");
    if (withOld) assert.deepEqual(sorted(deadlines.map(deadlineKey)), sorted(data.old.dues.deadlines.map(deadlineKey)), "v2.4.4 ile aynı son tarihler");
  });

  test("yetkisiz kullanıcı (personel): tablo kalemi yok; çek / fatura / banka süzgeci 2.4.4 gibi; son tarihler aynı", () => {
    const { staffDues } = data.product;
    assert.ok(!staffDues.items.some(isTableItem), "personelin takviminde tablo kalemi yok");
    const modules = list => sorted(list.filter(item => !isTableItem(item)).map(itemKey));
    assert.deepEqual(modules(staffDues.items), modules(data.legacy.staffDues.items), "personel: eski davranışla aynı modül kalemleri");
    if (withOld) assert.deepEqual(modules(staffDues.items), modules(data.old.staffDues.items), "personel: v2.4.4 ile aynı modül kalemleri");
    assert.deepEqual(sorted(staffDues.deadlines.map(deadlineKey)), sorted(data.product.dues.deadlines.map(deadlineKey)), "personel aynı son tarihleri görür");
  });

  test("Anlık Durum Vade Takip: Tablo / Ödeme Sözü kaynağı ve satırı yok; öbür kaynaklar ve son tarihler aynı; dormant boş", () => {
    const { vade } = data.product;
    assert.ok(!vade.allowed.some(source => TABLE_SOURCES.has(source)) && vade.allowed.includes("deadline"), `kaynaklar: ${vade.allowed.join(", ")}`);
    assert.ok(!vade.rows.some(row => TABLE_SOURCES.has(row.source)), "satırlarda tablo / söz yok");
    assert.deepEqual(vade.dormant, [], "dormant boş");
    const rest = list => sorted(list.filter(row => !TABLE_SOURCES.has(row.source)).map(rowKey));
    assert.ok(data.legacy.vade.rows.some(row => TABLE_SOURCES.has(row.source)), "eski davranışta tablo satırları vardı (testin dişi)");
    assert.deepEqual(rest(vade.rows), rest(data.legacy.vade.rows), "eski davranışla aynı öbür satırlar");
    if (withOld) assert.deepEqual(rest(vade.rows), rest(data.old.vade.rows), "v2.4.4 ile aynı öbür satırlar");
    assert.ok(vade.rows.some(row => row.source === "deadline"), "son tarih satırları kalır");
  });

  test("Nakit Akış Projeksiyonu: tablo kalemi yok, 'Tablo' seçeneği yok (table=0 / table=1 aynı); v2.4.4'ün table=0 sonucuyla aynı", () => {
    const { flow, flowNoTable, flowTable1 } = data.product;
    const isTable = row => TABLE_SOURCES.has(row.source);
    assert.ok(![...flow.rows, ...flow.overdue].some(isTable), "projeksiyonda tablo kalemi yok");
    assert.equal(flow.withTable, false);
    for (const other of [flowNoTable, flowTable1]) assert.deepEqual([other.closing, other.totals, other.rows.length, other.overdue.length], [flow.closing, flow.totals, flow.rows.length, flow.overdue.length], "table parametresi sonucu değiştirmez");
    assert.ok([...data.legacy.flow.rows, ...data.legacy.flow.overdue].some(isTable), "eski davranışta tablo kalemi vardı (testin dişi)");
    assert.deepEqual([flow.closing, flow.totals], [data.legacy.flowNoTable.closing, data.legacy.flowNoTable.totals], "eski davranışın table=0 sonucu");
    if (withOld) assert.deepEqual([flow.closing, flow.totals], [data.old.flowNoTable.closing, data.old.flowNoTable.totals], "v2.4.4'ün table=0 sonucu");
  });

  test("madde 5: Tablo Raporları satırları aynı motor (v2.4.4 ile aynı); tablodan gelen tutar 'Muhasebe Kaydı Değil'; Nakit Akışı'nda Kasa sütunu yok", () => {
    const { report, flowReport, people } = data.product;
    const reportRows = value => sorted(value.report.rows.map(row => [row.cari, row.label, row.date, row.amount, row.state].join("|")));
    assert.ok(report.report.rows.some(row => /Söz|sözü/i.test(row.label)), "Tablodaki Vadeler tablonun söz kalemlerini göstermeye devam eder");
    assert.deepEqual(reportRows(report), reportRows(data.legacy.report), "eski davranışla aynı Tablodaki Vadeler satırları");
    if (withOld) assert.deepEqual(reportRows(report), reportRows(data.old.report), "v2.4.4 ile aynı Tablodaki Vadeler satırları");
    const label = (value, key) => value.report.table.columns.find(column => column.key === key)?.label;
    assert.equal(label(report, "amount"), "Tablodaki Tutar (Muhasebe Kaydı Değil)");
    assert.deepEqual(["borc", "alacak", "bakiye"].map(key => label(people, key)), ["Tablodaki Borç (Muhasebe Kaydı Değil)", "Tahsil Edilen", "Tablodaki Bakiye (Muhasebe Kaydı Değil)"]);
    assert.deepEqual(flowReport.report.table.columns.map(column => column.key), ["label", "expected", "expectedCount", "collected"], "Tablodaki Nakit Akışı kolonları (Kasa yok)");
    assert.equal(label(flowReport, "expected"), "Tablodan Beklenen Tahsilat (Muhasebe Kaydı Değil)");
    assert.deepEqual(flowReport.summary.map(([name]) => name), ["Tablodan Beklenen Tahsilat (Muhasebe Kaydı Değil)", "Gerçekleşen Tahsilat"]);
    assert.ok(people.summary.some(([name]) => name === "Tablodaki Bakiye (Muhasebe Kaydı Değil)") && !people.summary.some(([name]) => name === "Bakiye"), `Tablodaki Kişiler özeti: ${JSON.stringify(people.summary)}`);
  });

  test("önbellek: tablo yeniden yüklenince (aynı dosya) yine tablo kalemi yok; son tarih değişince takvim yenilenir", async () => {
    const { api, must } = ctx.product;
    const book = tahsilatWorkbook(NOW);
    const kira = book.find(sheet => sheet.name === "Kiracılar");
    kira.rows[0]["Sözleşme bitiş"] = trDay(1);
    const staged = await must("yeniden yükle", api.post("/api/workspace/dataset/stage", { kind: "excel", fileName: "Tahsilat.xlsx", sheets: book.map(sheet => ({ name: sheet.name, matrix: matrix(sheet) })) }));
    await must("yeniden kaydet", api.post("/api/workspace/dataset/commit", { stageId: staged.stageId, mode: "replace", confirm: true }));
    const dues = await must("takvim", api.get("/api/workspace/dues"));
    assert.ok(!dues.items.some(isTableItem), "yeniden yüklemeden sonra da tablo kalemi yok");
    const deniz = dues.deadlines.find(item => item.person === "Deniz Öztürk" && item.label === "Sözleşme bitiş");
    assert.equal(deniz?.due, day(1), `Sözleşme bitiş yeni tarihle (${deniz?.due}); önbellek eski son tarihi vermez`);
  });
});
