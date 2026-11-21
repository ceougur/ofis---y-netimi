// 2.5.0 S229 = A + S230 = A — EKRAN YÜRÜYÜŞÜ (kabul G; ders 11, 12, 28, 34, 39; şikâyet 1): Mevcut Borç kartının içine aldığı fatura kullanıcı gözüyle.
// CI listesinde DEĞİL (ci.yml'ye eklenmedi — "CI listesine eklenecek"). Kurulum programın API'siyle; bakış ve Tahsilat EKRANDAN (gerçek tıklama, insan hızı, Tab).
// Sahte saat 08.10.2026. Beklenenler ELLE (kararların sözünden):
//   Kısmi (S229 örneği): F1 50.000 (02.09, vade 20.09) + Borç Yaz 30.000; 25.09 Mevcut Borç kartı 60.000 → Açık Faturalar F1 20.000 (TOPLAM 20.000); fatura kartı "Açık: 20.000",
//     "Taksit Kartında: <kart> · 30.000" bağlantısı kartı açar; Tahsilat Ekle 20.000 önerir; Mahsup Et (alış 30.000 varken) 20.000 önerir; Faturalar listesi 'Açık' süzgecinde Kalan 20.000.
//     Ekrandan 20.000 tahsilat (insan hızı) → veri tabanında 20.000'lik, F1'e bağlı tek tahsilat satırı; F1 'Taksitte', Açık Faturalar'da yok.
//   Tam: F2 50.000, kart 50.000 → Açık Faturalar'da yok; fatura kartı 'Taksitte', Tahsilat Ekle düğmesi YOK, "Taksit Kartında · 50.000".
// Kullanım: ROOT=<kod kökü> OUT=<ekran görüntüsü klasörü> PLAYWRIGHT_BROWSERS_PATH=… node test/e2e/yuruyus-s229-250.mjs  (eski kodda da koşar; çıktı satırları karşılaştırılır)
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.HUKUK_LICENSE_URL = "http://127.0.0.1:9";
const ROOT = process.env.ROOT;
const OUT = process.env.OUT;
fs.mkdirSync(OUT, { recursive: true });
const imp = rel => import(pathToFileURL(path.join(ROOT, rel)).href);
const { chromium } = await import(pathToFileURL(path.join(ROOT, "node_modules/playwright/index.mjs")).href);
const { createApp } = await imp("server/app.mjs");
const { createClient, installPageClock } = await imp("test/helpers.mjs");
const { escClose } = await imp("test/e2e/esc-kapat.mjs");
const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const MODAL = ".hof-modal-backdrop.is-visible";
const TOP = `${MODAL}:nth-last-child(1 of ${MODAL})`;
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const must = async (label, p) => {
  const r = await p;
  if (r.status !== 200) throw new Error(`${label}: ${r.status} ${JSON.stringify(r.data).slice(0, 300)}`);
  return unwrap(r);
};
const note = (...a) => console.log(...a);
const root = mkdtempSync(path.join(tmpdir(), "yuruyus-s229-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "0123456789abcdef0123456789abcdef" }, startLicenseTimers: false });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const api = createClient(BASE);
const browser = await chromium.launch();
let page = null;
let n = 0;
let failures = 0;
const shot = async name => {
  n += 1;
  await page.waitForTimeout(700); // açılış geçişi bitsin (görüntü bulanık / üst üste çıkmasın)
  await page.screenshot({ path: path.join(OUT, `${String(n).padStart(2, "0")}-${name}.png`) }).catch(() => null);
};
const closeAll = async () => {
  for (let i = 0; i < 6 && (await page.$(MODAL)); i += 1) {
    await escClose(page);
    await page.waitForTimeout(250);
  }
};
const text = sel => page.$$eval(sel, ns => ns.map(x => x.textContent.replace(/\s+/g, " ").trim()));
const expect = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failures += 1;
  note(`  ${ok ? "✓" : "✗ BEKLENEN DEĞİL"} ${label}: ${JSON.stringify(got)}${ok ? "" : ` (beklenen ${JSON.stringify(want)})`}`);
};
const step = async (title, fn) => {
  note(`\n■ ${title}`);
  try {
    await fn();
  } catch (e) {
    failures += 1;
    note(`  ✗ ADIM YARIDA: ${String(e?.message || e).split("\n")[0]}`);
    await shot("hata");
    await closeAll().catch(() => null);
  }
};
try {
  await api.login("admin", PASS);
  await must("banka", api.post("/api/workspace/bank/setup/dismiss", {}));
  const acc = name => must(name, api.post("/api/workspace/accounts", { name, type: "customer", registeredOn: "2026-08-01" }));
  const sale = async (a, gross) => must("satış", api.post("/api/workspace/invoices", { scenario: "service_sale", accountId: a.id, issueDate: "2026-09-02", lines: [{ name: "Hizmet", qty: 1, unitPrice: gross / 1.2, vatRate: 20 }], payment: { rest: "open", dueDate: "2026-09-20" } }));
  const card = (a, total, count, name) => must("kart", api.post("/api/workspace/plans", { accountId: a.id, name, total: String(total), registeredOn: "2026-09-25", mode: "auto", count, firstDue: "2026-11-01", coversBalance: true }));
  const A = await acc("Yürüyüş Kısmi Müşteri");
  const f1 = await sale(A, 50000);
  await must("Borç Yaz", api.post(`/api/workspace/accounts/${A.id}/entries`, { kind: "debt", amount: "30000", date: "2026-09-05", note: "Fark" }));
  const k1 = await card(A, 60000, 2, "Yürüyüş Kısmi Kartı");
  await must("alış", api.post("/api/workspace/invoices", { scenario: "expense_purchase", accountId: A.id, number: "ALS-Y1", issueDate: "2026-09-02", lines: [{ name: "Gider", qty: 1, unitPrice: 30000 / 1.2, vatRate: 20, expenseCode: "other" }], payment: { rest: "open", dueDate: "2026-09-02" } }));
  const B = await acc("Yürüyüş Tam Müşteri");
  const f2 = await sale(B, 50000);
  await card(B, 50000, 2, "Yürüyüş Tam Kartı");

  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR", deviceScaleFactor: 1 });
  page = await context.newPage();
  await installPageClock(page, app.config.now);
  const errors = [];
  page.on("pageerror", e => errors.push(`pageerror ${e.message}`));
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForFunction(() => Boolean(window.HOF?.invoices?.openDoc && window.HOF?.reportCenter?.open && window.HOF?.plans?.open), null, { timeout: 60000 });
  await page.waitForTimeout(1000);
  await closeAll();

  const reportRows = async () => {
    await page.waitForTimeout(1800);
    return page.$$eval(`${TOP} table tbody tr, ${TOP} table tfoot tr`, rs => rs.map(r => [...r.querySelectorAll("td")].map(td => td.textContent.replace(/\s+/g, " ").trim()).join(" | ")).filter(t => t.includes("FIS") || /TOPLAM/i.test(t)));
  };
  await step("1 Açık Faturalar — Tüm Cariler ve cari süzgeci", async () => {
    await page.evaluate(() => window.HOF.reportCenter.open("acik-faturalar"));
    const all = await reportRows();
    for (const r of all) note(`     ${r.slice(0, 200)}`);
    expect("F1 satırında Kalan 20.000", all.some(r => r.includes(f1.number) && r.includes("| ₺50.000,00 | ₺20.000,00 |")), true);
    expect("F2 (kartın tamamı) satırı yok", all.some(r => r.includes(f2.number)), false);
    await shot("acik-faturalar-tum");
    await closeAll();
    await page.evaluate(a => window.HOF.reportCenter.open("acik-faturalar", { account: a }), { id: A.id, name: A.name });
    const one = await reportRows();
    for (const r of one) note(`     ${r.slice(0, 200)}`);
    expect("cari süzgeci: TOPLAM satırında Alacak 20.000", one.some(r => /TOPLAM/i.test(r) && r.includes("₺20.000,00") && !r.includes("| ₺50.000,00 | ₺50.000,00")), true);
    await shot("acik-faturalar-cari");
    await closeAll();
    await page.evaluate(a => window.HOF.reportCenter.open("acik-faturalar", { account: a }), { id: B.id, name: B.name });
    const none = await reportRows();
    expect("tam kapsanan cari: satır yok", none.filter(r => r.includes("FIS")).length, 0);
    await shot("acik-faturalar-tam-cari");
    await closeAll();
  });
  await step("2 Fatura kartı (kısmi): Açık 20.000, 'Taksit Kartında' bağlantısı karta gider", async () => {
    await page.evaluate(id => window.HOF.invoices.openDoc(id), f1.id);
    await page.waitForSelector(`${TOP} .hof-inv-rest`, { timeout: 15000 });
    const rest = (await text(`${TOP} .hof-inv-rest`))[0];
    const inPlan = await text(`${TOP} [data-in-plan]`);
    const head = await text(`${TOP} .hof-inv-head-rest`);
    note(`  kalan satırı: ${rest} · başlık: ${JSON.stringify(head)} · taksit kartında: ${JSON.stringify(inPlan)}`);
    expect("Açık satırı", rest.startsWith("Açık: ₺20.000,00"), true);
    expect("Taksit Kartında satırı", inPlan, ["Taksit Kartında: Yürüyüş Kısmi Kartı · ₺30.000,00"]);
    await shot("fatura-karti-kismi");
    await page.click(`${TOP} [data-in-plan] a[data-open-plan]`);
    await page.waitForTimeout(1500);
    const planOpen = await page.$(`${TOP} tr[data-item]`);
    expect("bağlantı taksit kartını açtı", Boolean(planOpen), true);
    await shot("taksit-karti-baglantidan");
    await closeAll();
  });
  await step("3 Tahsilat Ekle önerisi 20.000 ve Mahsup Et önerisi 20.000", async () => {
    await page.evaluate(id => window.HOF.invoices.openDoc(id), f1.id);
    await page.waitForSelector(`${TOP} [data-act="pay"]`, { timeout: 15000 });
    await page.click(`${TOP} [data-act="offset"]`);
    await page.waitForSelector(`${TOP} input[name="amount"]`, { timeout: 10000 });
    expect("Mahsup Et önerisi", await page.$eval(`${TOP} input[name="amount"]`, i => i.value), "20000");
    note(`  mahsup metni: ${(await text(`${TOP} .hof-form-intro, ${TOP} p`)).find(t => t.startsWith("Açık tutar")) || ""}`);
    await shot("mahsup-formu");
    await escClose(page);
    await page.waitForTimeout(400);
    await page.click(`${TOP} [data-act="pay"]`);
    await page.waitForSelector(`${TOP} input[name="amount"]`, { timeout: 10000 });
    expect("Tahsilat Ekle önerisi", await page.$eval(`${TOP} input[name="amount"]`, i => i.value), "20000");
    note(`  tahsilat metni: ${(await text(`${TOP} p`)).find(t => t.startsWith("Açık tutar")) || ""}`);
    await shot("tahsilat-formu");
    // İnsan hızı: tutarı silip yeniden yaz, Tab, Kaydet.
    await page.click(`${TOP} input[name="amount"]`);
    await page.keyboard.press("Control+A");
    for (const ch of "20000") await page.keyboard.type(ch, { delay: 70 });
    await page.keyboard.press("Tab");
    await page.click(`${TOP} button[type="submit"]`);
    await page.waitForTimeout(2000);
    const still = await page.$(`${TOP} input[name="amount"]`);
    note(`  form ${still ? "AÇIK KALDI" : "kapandı"}`);
    if (still) {
      note("  pencere metni:", JSON.stringify((await text(TOP)).map(t => t.slice(0, 300))));
      await closeAll();
    }
    const rows = app.store.all("SELECT kind, amount, invoice_id AS invoiceId, method FROM account_entries WHERE account_id = ? AND kind = 'in'", A.id);
    expect("veri tabanı: F1'e bağlı tek 20.000 tahsilat", rows.map(r => [r.kind, r.amount, r.invoiceId === f1.id, r.method]), [["in", 20000, true, "cash"]]);
    await closeAll();
    await page.evaluate(id => window.HOF.invoices.openDoc(id), f1.id);
    await page.waitForSelector(`${TOP} .hof-inv-rest`, { timeout: 15000 });
    expect("tahsilattan sonra F1 durumu", (await text(`${TOP} .hof-inv-rest`))[0], "Taksitte");
    await shot("fatura-karti-tahsilat-sonrasi");
    await closeAll();
  });
  await step("4 Fatura kartı (tam): 'Taksitte', Tahsilat Ekle yok", async () => {
    await page.evaluate(id => window.HOF.invoices.openDoc(id), f2.id);
    await page.waitForSelector(`${TOP} .hof-inv-rest`, { timeout: 15000 });
    expect("kalan satırı", (await text(`${TOP} .hof-inv-rest`))[0], "Taksitte");
    expect("Tahsilat Ekle düğmesi", Boolean(await page.$(`${TOP} [data-act="pay"]`)), false);
    expect("Taksit Kartında satırı", await text(`${TOP} [data-in-plan]`), ["Taksit Kartında: Yürüyüş Tam Kartı · ₺50.000,00"]);
    note(`  başlık rakamı: ${JSON.stringify(await text(`${TOP} .hof-inv-head, ${TOP} .hof-inv-amount`))}`.slice(0, 300));
    await shot("fatura-karti-tam");
    await closeAll();
  });
  await step("5 Faturalar listesi — Tüm ve 'Açık' süzgeci", async () => {
    await page.evaluate(() => window.HOF.invoices.open({ tab: "all" }));
    await page.waitForSelector(`${TOP} select[data-filter="pay"]`, { timeout: 15000 });
    await page.waitForTimeout(1200);
    const dump = async () => page.$$eval(`${TOP} tr[data-inv]`, rs => rs.map(r => [...r.querySelectorAll("td")].slice(1).map(td => td.textContent.replace(/\s+/g, " ").trim()).join(" | ")));
    for (const r of await dump()) note(`     ${r.slice(0, 220)}`);
    const tiles = await text(`${TOP} .hof-rep-stat`);
    note(`  kutucuklar: ${JSON.stringify(tiles)}`);
    await shot("faturalar-tum");
    await page.selectOption(`${TOP} select[data-filter="pay"]`, "open");
    await page.waitForTimeout(1500);
    const open = await dump();
    for (const r of open) note(`     [Açık] ${r.slice(0, 220)}`);
    expect("'Açık' süzgecinde F1 ve F2 (Taksitte) var", [open.some(r => r.includes(f1.number) && r.includes("Taksitte")), open.some(r => r.includes(f2.number) && r.includes("Taksitte"))], [true, true]);
    expect("Açık Bakiye kutucuğu (Taksitte satışlar açık sayılmaz; alış 30.000)", (await text(`${TOP} .hof-rep-stat`)).find(t => t.startsWith("Açık Bakiye")), "Açık Bakiye₺30.000,00");
    await shot("faturalar-acik");
    await closeAll();
  });
  await step("6 Anlık Durum (API; masaüstünde fatura özeti kutusu yok — mobil / birleşik şirket raporu okur)", async () => {
    const o = await must("Anlık Durum", api.get("/api/workspace/overview"));
    expect("açık / vadesi geçen satış", [o.invoices.openSale, o.invoices.overdueSale], [0, 0]);
    expect("açık alış (alış faturası 30.000 kendi tarafında)", o.invoices.openPurchase, 30000);
  });
  note(`\nsayfa hatası: ${errors.length ? errors.slice(0, 5).join(" | ") : "yok"}`);
  note(`BEKLENEN DEĞİL: ${failures}`);
  await context.close();
} catch (e) {
  failures += 1;
  console.error("HATA:", e);
} finally {
  await browser.close();
  await app.close();
  fs.rmSync(root, { recursive: true, force: true });
}
process.exitCode = failures ? 1 : 0;
