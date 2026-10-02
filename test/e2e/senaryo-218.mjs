// Senaryo 2.0.18 — kayıttan açılan cari adı KİŞİ kolonundan gelir (müşteri bildirimi: marka/patent tablosunda cari adı
// "Başvuru Sahibi" yerine "Marka / Buluş Adı" oluyordu). Düzeltme program geneli: dört farklı tablo biçimiyle, sıfırdan,
// arayüzden "Yeni Kayıt → cari kartı da aç" ve HOF.plans.personOf ile denetlenir.
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { buildXlsx } from "../../server/lib/xlsx-write.mjs";

const PASS = "Prova-Admin-2026!";
const modal = ".hof-modal-backdrop.is-visible";
let passed = 0, failed = 0;
const ok = (cond, what) => { if (cond) { passed += 1; console.log(`  ✓ ${what}`); } else { failed += 1; console.log(`  ✗ ${what}`); } };

// Her veri kümesi: kolonlar, satırlar, arayüzden girilecek yeni kayıt (kolon → değer), beklenen cari adı.
const DATASETS = [
  {
    name: "Marka ve patent (müşterinin tablosu): Başvuru Sahibi kişi, Marka / Buluş Adı eşya",
    columns: ["Başvuru No", "Başvuru Sahibi", "Telefon", "Marka / Buluş Adı", "Tür", "Nice Sınıfı", "Başvuru Tarihi", "Ücret", "Durum"],
    rows: [
      { "Başvuru No": "0001", "Başvuru Sahibi": "NARAN YILDIZ", Telefon: "05326598798", "Marka / Buluş Adı": "PROGRAM", Tür: "Faydalı model", "Nice Sınıfı": "A", "Başvuru Tarihi": "01.10.2026", Ücret: "9000", Durum: "Başvuruda" },
      { "Başvuru No": "0002", "Başvuru Sahibi": "HİMMET ERTAŞ", Telefon: "05369896533", "Marka / Buluş Adı": "TENYE", Tür: "Faydalı model", "Nice Sınıfı": "B", "Başvuru Tarihi": "01.10.2026", Ücret: "7000", Durum: "Başvuruda" },
    ],
    create: { "Başvuru No": "0003", "Başvuru Sahibi": "GÜLDAL KARE", Telefon: "05556897845", "Marka / Buluş Adı": "FURRA", Tür: "Marka", "Nice Sınıfı": "C" },
    expect: "GÜLDAL KARE",
    notExpected: ["FURRA"],
  },
  {
    name: "Sipariş tablosu: Ürün Adı eşya, Müşteri kişi",
    columns: ["Sipariş No", "Ürün Adı", "Müşteri", "Telefon", "Tutar", "Teslim Tarihi"],
    rows: [{ "Sipariş No": "S-1", "Ürün Adı": "Çelik Raf", Müşteri: "Mehmet Kaya", Telefon: "05321112233", Tutar: "1500", "Teslim Tarihi": "10.10.2026" }],
    create: { "Sipariş No": "S-2", "Ürün Adı": "Ahşap Masa", Müşteri: "Ayşe Demir", Telefon: "05334445566", Tutar: "2500" },
    expect: "Ayşe Demir",
    notExpected: ["Ahşap Masa"],
  },
  {
    name: "Ad ve soyad ayrı kolonlarda: cari adı ikisinden kurulur",
    columns: ["Sıra No", "Adı", "Soyadı", "Telefon", "Aylık Ücret"],
    rows: [{ "Sıra No": "1", Adı: "Ali", Soyadı: "Yılmaz", Telefon: "05321112233", "Aylık Ücret": "900" }],
    create: { "Sıra No": "2", Adı: "Zeynep", Soyadı: "Arslan", Telefon: "05339998877", "Aylık Ücret": "900" },
    expect: "Zeynep Arslan",
    notExpected: [],
  },
  {
    name: "İcra tablosu (eski davranış korunur): Borçlu kişi, Dosya No kimlik",
    columns: ["Dosya No", "Borçlu", "Telefon", "Borç", "Son Ödeme Tarihi"],
    rows: [{ "Dosya No": "2026/1", Borçlu: "Veli Can", Telefon: "05321112233", Borç: "12000", "Son Ödeme Tarihi": "20.10.2026" }],
    create: { "Dosya No": "2026/2", Borçlu: "Hasan Öz", Telefon: "05330001122", Borç: "8000" },
    expect: "Hasan Öz",
    notExpected: ["2026/2"],
  },
];

for (const set of DATASETS) {
  console.log(`\n■ ${set.name}`);
  const root = mkdtempSync(path.join(tmpdir(), "destekofis-218-"));
  const excel = path.join(root, "tablo.xlsx");
  writeFileSync(excel, buildXlsx([{ name: "Kayıtlar", columns: set.columns, rows: set.rows }], { title: "Kayıtlar" }));
  const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false });
  const { port } = await app.listen(0, "127.0.0.1");
  const BASE = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" })).newPage();
  page.on("dialog", d => d.accept());
  try {
    await page.goto(`${BASE}/`);
    await page.fill("#hof-auth input[name=username]", "admin");
    await page.fill("#hof-auth input[name=password]", PASS);
    await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
    await page.waitForSelector("#hof-start .hof-drop");
    await (await page.$("#hof-start .hof-drop input[type=file]")).setInputFiles(excel);
    await page.waitForSelector(`${modal} .hof-mapping`, { timeout: 30000 });
    await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click(`${modal} [data-mode="replace"]`)]);
    await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 }).catch(() => null);
    await page.click(".hof-analysis-result [data-apply], .hof-analysis-result [data-done]").catch(() => page.keyboard.press("Escape"));
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForSelector("#hof-toolbar-new", { timeout: 20000 });
    await page.waitForFunction(() => window.HOF?.insight?.()?.primary && (window.HOF.data?.rows || []).length > 0, null, { timeout: 20000 });

    // 1) Doğrudan: tablodaki ilk satır için kişi adı.
    const probe = await page.evaluate(() => {
      const row = window.HOF.data.rows[0];
      return { person: window.HOF.plans.personOf(row), primary: window.HOF.insight().primary.person || "", parts: window.HOF.insight().primary.personParts || null };
    });
    const firstRow = set.rows[0];
    const expectedFirst = set.columns.includes("Soyadı") ? `${firstRow["Adı"]} ${firstRow["Soyadı"]}` : firstRow[set.columns.find(c => /Sahibi|Müşteri|Borçlu/.test(c))];
    ok(probe.person === expectedFirst, `personOf(ilk satır) = "${probe.person}" (beklenen "${expectedFirst}"; analiz kişi kolonu: ${probe.primary || "—"}${probe.parts ? ` · parçalar ${probe.parts.join("+")}` : ""})`);

    // 2) Arayüzden: Yeni Kayıt → "cari kartı da aç" işaretli → cari adı kişi kolonundan.
    await page.click("#hof-toolbar-new");
    await page.waitForSelector(`${modal} .hof-record-grid`);
    for (const [column, value] of Object.entries(set.create)) {
      const index = set.columns.indexOf(column);
      await page.fill(`${modal} [name="c${index}"]`, value);
    }
    const checked = await page.$eval(`${modal} input[name="openAccount"]`, el => el.checked);
    ok(checked, "\"cari kartı da aç\" kutusu varsayılan işaretli");
    await page.click(`${modal} button[type="submit"]`);
    await page.waitForFunction(name => (document.body.innerText || "").includes(`"${name}" için cari kartı açıldı`), set.expect, { timeout: 15000 }).catch(() => null);
    const accounts = await page.evaluate(async () => (await (await fetch("/api/workspace/accounts?status=all&limit=50")).json()).data.accounts.map(a => ({ name: a.name, caseKey: a.caseKey || "", phone: a.phone || "" })));
    const created = accounts.find(a => a.name === set.expect);
    ok(Boolean(created), `cari açıldı: "${set.expect}" (cariler: ${accounts.map(a => a.name).join(", ") || "yok"})`);
    ok(Boolean(created?.caseKey), `cari kayda bağlı (kayıt ${created?.caseKey || "—"})`);
    for (const wrong of set.notExpected) ok(!accounts.some(a => a.name === wrong), `"${wrong}" adıyla cari açılmadı`);
    const phoneWanted = (set.create.Telefon || "").replace(/\D/g, "").slice(-10);
    ok(!phoneWanted || (created?.phone || "").replace(/\D/g, "").slice(-10) === phoneWanted, `cari telefonu kayıttan geldi (${created?.phone || "—"})`);
    // 3) Yeni kaydın başlığı (kayıt listesi) cari adıyla aynı kişi — ilk satır değil, yeni açılan kayıt.
    const titles = await page.evaluate(() => (window.HOF?.data?.rows || []).map(row => window.HOF?.plans?.recordLabel?.(row) || ""));
    ok(titles.some(title => title.includes(set.expect)), `yeni kaydın başlığı cari adıyla uyumlu (${titles.filter(Boolean).slice(-3).join(" · ") || "—"})`);
  } catch (error) {
    failed += 1;
    console.log(`  ✗ HATA: ${error.message.split("\n")[0]}`);
  } finally {
    await browser.close();
    await app.close();
    rmSync(root, { recursive: true, force: true });
  }
}
console.log(`\n${passed} / ${passed + failed} denetim geçti.`);
process.exit(failed ? 1 : 0);
