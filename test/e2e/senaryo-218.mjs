// Senaryo 2.0.18 — (1) kişi adı KİŞİ kolonundan gelir (müşteri bildirimi: marka/patent tablosunda cari adı "Başvuru Sahibi"
// yerine "Marka / Buluş Adı" oluyordu); (2) kullanıcı kararı: kayıt ile cari AYRI — Yeni Kayıt cari açmaz, "Tablodan Al"
// yok, detay kartında CARİ pili yok; cari yalnız + Yeni Cari / Excel'den açılır, kayda bağ cari formundaki "Tablodaki
// Kayıt" alanıyla (ad yazılınca aynı adlı tek kayıt önerilir). Dört tablo biçimiyle, sıfırdan, arayüzden denetlenir.
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
  const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" } });
  const { port } = await app.listen(0, "127.0.0.1");
  const BASE = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" })).newPage();
  page.on("dialog", d => d.accept());
  const accountsOf = () => page.evaluate(async () => (await (await fetch("/api/workspace/accounts?status=all&limit=50")).json()).data.accounts.map(a => ({ name: a.name, caseKey: a.caseKey || "", phone: a.phone || "" })));
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

    // 1) Kişi adı kuralı: tablodaki ilk satır için personOf (cari formundaki ad eşleşmesi ve kayıt başlığı bunu kullanır).
    const probe = await page.evaluate(() => {
      const row = window.HOF.data.rows[0];
      return { person: window.HOF.plans.personOf(row), primary: window.HOF.insight().primary.person || "", parts: window.HOF.insight().primary.personParts || null };
    });
    const firstRow = set.rows[0];
    const expectedFirst = set.columns.includes("Soyadı") ? `${firstRow["Adı"]} ${firstRow["Soyadı"]}` : firstRow[set.columns.find(c => /Sahibi|Müşteri|Borçlu/.test(c))];
    ok(probe.person === expectedFirst, `personOf(ilk satır) = "${probe.person}" (beklenen "${expectedFirst}"; analiz kişi kolonu: ${probe.primary || "—"}${probe.parts ? ` · parçalar ${probe.parts.join("+")}` : ""})`);

    // 2) Yeni Kayıt: "cari kartı da aç" kutusu YOK; kayıt oluşur, cari AÇILMAZ.
    await page.click("#hof-toolbar-new");
    await page.waitForSelector(`${modal} .hof-record-grid`);
    ok(!(await page.$(`${modal} input[name="openAccount"]`)), "Yeni Kayıt formunda \"cari kartı da aç\" kutusu yok");
    for (const [column, value] of Object.entries(set.create)) {
      const index = set.columns.indexOf(column);
      await page.fill(`${modal} [name="c${index}"]`, value);
    }
    await page.click(`${modal} button[type="submit"]`);
    await page.waitForFunction(() => (document.body.innerText || "").includes("Yeni kayıt oluşturuldu"), null, { timeout: 15000 }).catch(() => null);
    await page.waitForFunction(n => (window.HOF.data?.rows || []).length >= n, set.rows.length + 1, { timeout: 15000 }).catch(() => null);
    let accounts = await accountsOf();
    ok(accounts.length === 0, `kayıt sonrası cari açılmadı (cariler: ${accounts.map(a => a.name).join(", ") || "yok"})`);
    for (const wrong of set.notExpected) ok(!accounts.some(a => a.name === wrong), `"${wrong}" adıyla cari açılmadı`);
    const titles = await page.evaluate(() => (window.HOF?.data?.rows || []).map(row => window.HOF?.plans?.recordLabel?.(row) || ""));
    ok(titles.some(title => title.includes(set.expect)), `yeni kaydın başlığı kişi adıyla (${titles.filter(Boolean).slice(-3).join(" · ") || "—"})`);

    // 3) Detay kartı: yeni kayıt seçilince CARİ kutusu / Cari Kartı pili yok.
    const newKey = await page.evaluate(name => (window.HOF.data.rows.find(row => window.HOF.plans.personOf(row) === name) || {}).__hofKey || "", set.expect);
    ok(Boolean(newKey), `yeni kaydın anahtarı bulundu (${newKey || "—"})`);
    await page.evaluate(key => window.HOF.revealRecord?.(key), newKey);
    await page.waitForFunction(key => window.HOF.selectedCase()?.key === key, newKey, { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(800);
    ok(!(await page.$("#hof-case-plan .hof-case-account, #hof-case-plan [data-open-account]")), "detay kartında CARİ kutusu / Cari Kartı pili yok");

    // 4) Cari penceresi: "Tablodan Al" yok; + Yeni Cari'de ad yazılınca tablodaki aynı adlı kayıt "Tablodaki Kayıt" alanına önerilir.
    await page.click('#hof-sidecard [data-action="accounts"]');
    await page.waitForSelector(`${modal} .hof-accounts-modal [data-act="new"]`, { timeout: 10000 });
    ok(!(await page.$(`${modal} .hof-accounts-modal [data-act="fromTable"]`)), "Cari penceresinde \"Tablodan Al\" düğmesi yok");
    await page.click(`${modal} .hof-accounts-modal [data-act="new"]`);
    await page.waitForFunction(() => Boolean([...document.querySelectorAll(".hof-modal-backdrop.is-visible")].at(-1)?.querySelector('input[name="name"]')), null, { timeout: 10000 });
    await page.evaluate(() => { [...document.querySelectorAll(".hof-modal-backdrop.is-visible")].at(-1).querySelector('input[name="name"]').focus(); });
    await page.keyboard.type(set.expect, { delay: 20 });
    await page.waitForFunction(key => [...document.querySelectorAll(".hof-modal-backdrop.is-visible")].at(-1)?.querySelector('.hof-case-picker input[name="caseKey"]')?.value === key, newKey, { timeout: 8000 }).catch(() => null);
    const picker = await page.evaluate(() => { const box = [...document.querySelectorAll(".hof-modal-backdrop.is-visible")].at(-1); return { caseKey: box.querySelector('.hof-case-picker input[name="caseKey"]')?.value || "", note: box.querySelector(".hof-case-picker small")?.textContent || "" }; });
    ok(picker.caseKey === newKey, `+ Yeni Cari: ad yazılınca tablodaki kayıt önerildi (${picker.caseKey || "—"} · ${picker.note.slice(0, 50)})`);
    await page.evaluate(() => [...document.querySelectorAll(".hof-modal-backdrop.is-visible")].at(-1).querySelector('.hof-form button[type="submit"]').click());
    await page.waitForFunction(name => (document.body.innerText || "").includes(name), set.expect, { timeout: 10000 }).catch(() => null);
    await page.waitForTimeout(600);
    accounts = await accountsOf();
    const created = accounts.find(a => a.name === set.expect);
    ok(Boolean(created), `cari elle açıldı: "${set.expect}" (cariler: ${accounts.map(a => a.name).join(", ") || "yok"})`);
    ok(created?.caseKey === newKey, `cari Tablodaki Kayıt alanıyla kayda bağlı (${created?.caseKey || "—"})`);
    for (const wrong of set.notExpected) ok(!accounts.some(a => a.name === wrong), `"${wrong}" adıyla cari yok`);
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
