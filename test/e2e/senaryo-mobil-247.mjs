// 2.4.7 M1 EKRANDAN — mobil görünüm programın içinde (docs/erp/OTURUM-DEVIR-TESLIM-2.4.7.md §3.1; client/mobil/, server/lib/mobile.mjs).
// Telefon boyutu (390×844, dokunmatik, iPhone imzası), insan hızında gerçek tıklama ve yazım (ders 12). Veri programın kendi API'siyle üretilir.
//   T1 telefon ana adresi açar → /mobil/'e yönlenir; masaüstü ekranı gelmez. Bilgisayar imzası ana adreste masaüstünü görür.
//   T2 giriş (kullanıcı adı, Tab, parola, Giriş Yap) → Özet: Nakit Kasa, Banka, Cari Kayıtları, Stok Ürünleri = masaüstü API'si.
//   T3 Cari: liste ve bakiyeler = API; arama; cari kartı (bakiye, hareket sayısı); Cari Ekstre PDF iner (%PDF).
//   T4 Finans: Nakit Kasa, Banka ve hesap satırı = API.  T5 Stok: miktar (Adet) = API; stok kartı hareketleri.
//   T6 Raporlar: yalnız izinli 10 rapor; Cari Listesi ve Bakiyeler satırları = API; PDF (%PDF) ve Excel (PK) iner; Cari Ekstre cari seçerek.
//   T7 SALT OKUNUR: yazma düğmesi / formu yok; demo / "test onayı" metni yok.
//   T8 iki şirket: 002 boş başlar (₺0,00, 0 cari, "Kayıt bulunamadı."); veri girilince Yenile ile görünür; 001'e dönünce 001'in sayıları.
//   T9 çıkış (telefonda üst çubuk) → giriş ekranı; oturum kapandı (API 401).
//   T10 yetkisiz kullanıcı (Personel): Kasa ve Banka "Yetki Yok", Finans hata kutusu, Raporlar yetki iletisi, şirket seçicide yalnız 001.
// Çıkış: "N geçti, M kaldı" (kaldıysa 1). Ekran görüntüleri EKRAN_DIR (varsayılan test/e2e/artifacts/senaryo-mobil-247).
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";
import { GARANTI_IBAN, ZIRAAT_IBAN } from "../banka-210-hesap-ortak.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-mobil-247-"));
const shots = process.env.EKRAN_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-mobil-247");
mkdirSync(shots, { recursive: true });
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const STAFF = { username: "mobil-personel", password: "Personel-Mobil-2026!" };
const tl = n => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};

const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = await server.login();

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
let page = null;
const shot = (name, target = page) => target?.screenshot({ path: path.join(shots, `mobil-247-${name}.png`), fullPage: true }).catch(() => null);
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    ok(false, `adım yarıda kaldı: ${String(error?.message || error).split("\n")[0]}`);
    await shot(`hata-${title.slice(0, 3).trim()}`);
  }
};
const typeSlow = async (text, target = page) => {
  for (const ch of text) await target.keyboard.type(ch, { delay: 45 });
};
const text = async (selector, target = page) => ((await target.textContent(selector)) || "").trim();
const tapNav = async name => {
  await page.click(`.bottom-nav [data-nav="${name}"]`);
  await page.waitForSelector("#content .spinning", { state: "detached", timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(250);
};
// Telefon genişliğinde yatay kaydırma yok (rapor tablosu kendi kutusunda kayar; sayfa kaymaz).
const noOverflow = async label => {
  // isMobile'da düzen görünümü içeriğe göre genişler (innerWidth da büyür); ölçü telefonun kendi genişliği (390).
  const size = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, screen: window.screen.width }));
  ok(size.scroll <= size.screen, `${label}: yatay taşma yok (${size.scroll} ≤ ${size.screen})`);
};
// Tutar TEK SATIRDA ve tam görünür (ana oturum bulgusu 27.10: "₺25.000,0" / "0" ortadan kırılıyordu; eski ölçüm bunu geçirdi — ders 38).
// Ölçüm: tutar metninin satır kutularının (Range.getClientRects) farklı üst kenar sayısı = satır sayısı; 1'den çoksa kırık. Ayrıca metin kutusu
// öğenin (ve yanındaki yüzen simgenin) sınırını aşıyorsa "…" ile kesik. Yalnız öğenin İLK metin düğümü ölçülür (liste satırındaki alt yazı ayrı satırdır).
const amountsOneLine = async (selector, label) => {
  const result = await page.$$eval(selector, items => items.map(item => {
    const node = [...item.childNodes].find(child => child.nodeType === 3 && child.textContent.trim());
    if (!node) return { text: item.textContent.trim(), lines: 0, clipped: false };
    const range = document.createRange();
    range.selectNodeContents(node);
    const tops = new Set([...range.getClientRects()].filter(rect => rect.width > 0).map(rect => Math.round(rect.top)));
    const box = range.getBoundingClientRect();
    let limit = item.getBoundingClientRect().right;
    const icon = item.parentElement?.querySelector(".metric-icon")?.getBoundingClientRect();
    if (icon && icon.bottom > box.top && icon.top < box.bottom) limit = Math.min(limit, icon.left);
    return { text: node.textContent.trim(), lines: tops.size, clipped: box.right > limit + 1 };
  }));
  const bad = result.filter(item => item.lines !== 1 || item.clipped);
  ok(result.length > 0 && bad.length === 0, `${label}: ${result.length} tutar tek satırda ve tam (${bad.map(item => `${item.text} → ${item.lines} satır${item.clipped ? ", kesik" : ""}`).join("; ") || result.map(item => item.text).join(", ")})`);
};
const download = async (target, click) => {
  const [file] = await Promise.all([target.waitForEvent("download", { timeout: 20000 }), click()]);
  const where = await file.path();
  return { name: file.suggestedFilename(), head: readFileSync(where).subarray(0, 4).toString("latin1") };
};

// ---------- Veri: programın kendi API'si (masaüstünün yazdığı yol) ----------
const ali = await must("cari", api.post("/api/workspace/accounts", { name: "Ali Yılmaz", type: "customer" }));
await must("borç", api.post(`/api/workspace/accounts/${ali.id}/entries`, { kind: "debt", amount: "1.250,50", note: "Hizmet bedeli" }));
await must("tahsilat", api.post(`/api/workspace/accounts/${ali.id}/entries`, { kind: "in", amount: "400", note: "Elden" }));
const veli = await must("cari 2", api.post("/api/workspace/accounts", { name: "Veli Toptan", type: "supplier" }));
await must("kasa girişi", api.post("/api/workspace/cash", { kind: "in", amount: "3.000", description: "Danışmanlık" }));
await must("kasa çıkışı", api.post("/api/workspace/cash", { kind: "out", amount: "120,25", description: "Kırtasiye" }));
const bankAccount = await must("banka hesabı", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: ZIRAAT_IBAN, opening: { date: "2026-01-02", amount: "25.000", confirmed: true } }));
// Büyük tutar (ana oturum 27.10): kartlarda ₺12.345.678,90 düzeyinde tutar tek satırda görünmeli.
await must("büyük banka hesabı", api.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Büyük Hesap", kind: "demand", currency: "TRY", iban: GARANTI_IBAN, opening: { date: "2026-01-02", amount: "12.345.678,90", confirmed: true } }));
const kalem = await must("stok", api.post("/api/workspace/stock", { name: "Kurşun Kalem", unit: "Adet", unitPrice: "5", openingQty: "40", openingPay: "none" }));
await must("stok çıkışı", api.post(`/api/workspace/stock/${kalem.id}/moves`, { kind: "out", qty: "7", note: "Ofis tüketimi" }));
const second = (await must("ikinci şirket", api.post("/api/companies", { name: "Mobil İkinci Şirket" }))).company;
await must("personel", api.post("/api/admin/users", { ...STAFF, name: "Mobil Personel", role: "personel", mustChangePassword: false }));
// Masaüstü API'sinin sayıları (kâhin: aynı veri, masaüstünün kendi ucu).
const desk = async (company = "") => {
  const q = company ? `?hofCompany=${company}` : "";
  const cash = await must("masaüstü kasa", api.get(`/api/workspace/cash${q}`));
  const bank = await must("masaüstü banka", api.get(`/api/workspace/bank/summary${q}`));
  const accounts = await must("masaüstü cariler", api.get(`/api/workspace/accounts${q}`));
  const stock = await must("masaüstü stok", api.get(`/api/workspace/stock${q}`));
  return { cash: cash.totals.balance, bank: bank.realBank.minor / 100, accounts, stock };
};
const first = await desk();
console.log(`Masaüstü: Kasa ${first.cash}, Banka ${first.bank}, ${first.accounts.total} cari, ${first.stock.total} ürün`);

const browser = await chromium.launch();
const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: IPHONE, locale: "tr-TR", acceptDownloads: true });
page = await phone.newPage();
const pageErrors = [];
page.on("pageerror", error => pageErrors.push(String(error?.message || error)));

const loginAs = async (target, username, password) => {
  await target.waitForSelector("#login-form", { state: "visible" });
  // Çıkıştan sonra kullanıcı adı alanı önceki adla dolu kalır (giriş formlarının olağan davranışı); insan gibi seçip üstüne yazılır.
  await target.click("#username", { clickCount: 3 });
  await target.keyboard.press("Backspace");
  await typeSlow(username, target);
  await target.keyboard.press("Tab");
  await typeSlow(password, target);
  await target.click("#login-submit");
  await target.waitForSelector("#app:not(.hidden)", { timeout: 15000 });
  await target.waitForSelector("#content .summary-grid", { timeout: 15000 });
};
const statText = async (id, target = page) => text(`[data-stat="${id}"] .metric-value`, target);

await step("T1 telefon ana adresi açar → mobil görünüm; bilgisayar masaüstünü görür", async () => {
  await page.goto(`${server.base}/`);
  ok(new URL(page.url()).pathname === "/mobil/", `adres /mobil/ (${new URL(page.url()).pathname})`);
  ok((await page.title()) === "DestekOfis Mobil", `başlık “${await page.title()}”`);
  ok(!(await page.$("#root")) && !(await page.$(".hof-modal-backdrop")), "masaüstü ekranı yok");
  await page.waitForSelector("#login-form", { state: "visible" });
  await shot("01-giris");
  const deskCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const deskPage = await deskCtx.newPage();
  await deskPage.goto(`${server.base}/`);
  ok(new URL(deskPage.url()).pathname === "/", "bilgisayar ana adreste kalır");
  ok((await deskPage.title()) !== "DestekOfis Mobil", "bilgisayarda masaüstü sayfası");
  await deskCtx.close();
});

await step("T2 giriş → Özet sayıları = masaüstü API'si", async () => {
  await loginAs(page, "admin", ADMIN_PASSWORD);
  ok((await statText("cash")) === tl(first.cash), `Nakit Kasa ${await statText("cash")} = ${tl(first.cash)}`);
  ok(first.cash === 3279.75, "Kasa beklenen 3.000 − 120,25 + 400 (carinin nakit tahsilatı)");
  ok((await statText("bank")) === tl(first.bank), `Banka ${await statText("bank")} = ${tl(first.bank)}`);
  ok((await statText("accounts")) === String(first.accounts.total), `Cari Kayıtları ${await statText("accounts")} = ${first.accounts.total}`);
  ok((await statText("stock")) === String(first.stock.total), `Stok Ürünleri ${await statText("stock")} = ${first.stock.total}`);
  const names = await page.$$eval(".bottom-nav .bottom-item small", items => items.map(item => item.textContent.trim()));
  ok(JSON.stringify(names) === JSON.stringify(["Özet", "Cari", "Finans", "Stok", "Raporlar"]), `alt menü ${names.join(", ")}`);
  const box = await page.$eval(".bottom-nav", nav => { const r = nav.getBoundingClientRect(); return { top: r.top, height: r.height }; });
  ok(box.height < 90 && box.top > 700, `alt menü tek satır, ekranın altında (yükseklik ${Math.round(box.height)})`);
  ok((await text("#company option:checked")) !== "", "şirket seçili");
  await amountsOneLine("[data-stat] .metric-value", "Özet kartları");
  await noOverflow("Özet");
  await shot("02-ozet");
});

await step("T3 Cari: liste, arama, cari kartı, Cari Ekstre PDF", async () => {
  await tapNav("accounts");
  const items = await page.$$("#content .list-item");
  ok(items.length === 2, `2 cari (${items.length})`);
  const aliRow = `#content [data-detail="accounts:${ali.id}"] .list-amount`;
  const deskAli = first.accounts.accounts.find(row => row.id === ali.id).balance;
  ok((await text(aliRow)).startsWith(tl(deskAli)), `Ali bakiyesi ${await text(aliRow)} = ${tl(deskAli)}`);
  ok(deskAli === 850.5, "Ali beklenen 1.250,50 − 400");
  await amountsOneLine("#content .list-amount", "Cari listesi bakiyeleri");
  await noOverflow("Cari listesi");
  await shot("03-cari-liste");
  await page.click("#list-search");
  await typeSlow("Veli");
  await page.waitForTimeout(400);
  const filtered = await page.$$eval("#content .list-item strong", rows => rows.map(row => row.textContent.trim()));
  ok(filtered.length === 1 && filtered[0] === "Veli Toptan", `arama “Veli” → ${filtered.join(", ")}`);
  for (let index = 0; index < 4; index += 1) await page.keyboard.press("Backspace", { delay: 45 });
  await page.waitForTimeout(300);
  ok((await page.$$("#content .list-item")).length === 2, "arama temizlenince 2 cari");
  await page.click(`#content [data-detail="accounts:${ali.id}"]`);
  await page.waitForSelector("[data-detail-balance]");
  ok((await text("[data-detail-balance]")) === tl(deskAli), `cari kartı bakiyesi ${await text("[data-detail-balance]")}`);
  const deskDetail = await must("masaüstü cari kartı", api.get(`/api/workspace/accounts/${ali.id}`));
  const shown = (await page.$$(".entry-row")).length;
  ok(shown === Math.min(30, deskDetail.entries.length) && shown === 2, `son hareketler ${shown} = ${deskDetail.entries.length}`);
  await amountsOneLine("[data-detail-balance], .entry-row > strong", "Cari kartı tutarları");
  await noOverflow("Cari kartı");
  await shot("04-cari-karti");
  const pdf = await download(page, () => page.click("[data-account-statement]"));
  ok(pdf.head === "%PDF", `Cari Ekstre PDF indi (${pdf.name}, ${pdf.head})`);
  await page.click('[data-action="back"]');
  await page.waitForSelector("#content .list-item");
  ok(true, "Listeye Dön");
});

await step("T4 Finans: Nakit Kasa, Banka ve hesap satırı = API", async () => {
  await tapNav("money");
  ok((await text('[data-money="cash"] .big-balance')) === tl(first.cash), `Nakit Kasa ${await text('[data-money="cash"] .big-balance')}`);
  ok((await text('[data-money="bank"] .big-balance')) === tl(first.bank), `Banka ${await text('[data-money="bank"] .big-balance')}`);
  const deskBanks = await must("masaüstü banka hesapları", api.get("/api/workspace/bank/accounts"));
  const row = (deskBanks.accounts || deskBanks).find(item => item.id === bankAccount.id || item.id === bankAccount.account?.id);
  const lineSel = `[data-bank-account="${row?.id}"] strong`;
  const expected = tl(typeof row?.balanceMinor === "number" ? row.balanceMinor / 100 : row?.balance);
  ok(row && (await text(lineSel)) === expected, `hesap satırı ${row ? await text(lineSel) : "yok"} = ${expected}`);
  ok(Math.abs(first.bank - 12370678.9) < 0.005, "Banka beklenen açılışlar 25.000 + 12.345.678,90");
  await amountsOneLine("[data-money] .big-balance, .stat-line strong", "Finans tutarları");
  await noOverflow("Finans");
  await shot("05-finans");
});

await step("T5 Stok: miktar = API; stok kartı hareketleri", async () => {
  await tapNav("stock");
  const deskItem = first.stock.items.find(item => item.id === kalem.id);
  const amount = await text(`#content [data-detail="stock:${kalem.id}"] .list-amount`);
  ok(amount.startsWith(`${deskItem.qty} Adet`) && deskItem.qty === 33, `Kurşun Kalem ${amount} (API ${deskItem.qty}; beklenen 40 − 7)`);
  await page.click(`#content [data-detail="stock:${kalem.id}"]`);
  await page.waitForSelector("[data-detail-balance]");
  ok((await text("[data-detail-balance]")) === "33 Adet", `stok kartı ${await text("[data-detail-balance]")}`);
  const moves = await page.$$eval(".entry-row strong.in, .entry-row strong.out", rows => rows.map(row => row.textContent.trim()));
  ok(moves.length === 2 && moves.includes("−7 Adet") && moves.includes("+40 Adet"), `hareketler ${moves.join(", ")}`);
  await amountsOneLine("[data-detail-balance], .entry-row > strong", "Stok kartı miktarları");
  await noOverflow("Stok kartı");
  await shot("06-stok-karti");
});

await step("T6 Raporlar: izinli 10 rapor; Cari Listesi = API; PDF ve Excel; Cari Ekstre cari seçerek", async () => {
  await tapNav("reports");
  const picks = await page.$$eval("[data-report-pick]", rows => rows.map(row => row.dataset.reportPick));
  ok(picks.length === 10, `10 rapor (${picks.length}: ${picks.join(", ")})`);
  ok(!picks.includes("kdv-ozeti") && !picks.includes("ba-bs"), "fatura / vergi raporları yok");
  await noOverflow("Rapor kataloğu");
  await shot("07-rapor-katalog");
  await page.click('[data-report-pick="cari-listesi"]');
  await page.waitForSelector("#report-filter-form");
  await page.click('#report-filter-form button[type="submit"]');
  await page.waitForSelector(".report-table tbody tr", { timeout: 15000 });
  const rows = await page.$$eval(".report-table tbody tr", trs => trs.map(tr => [...tr.cells].map(td => td.textContent.trim())));
  const deskReport = await must("masaüstü cari listesi", api.get("/api/workspace/report-center/cari-listesi"));
  ok(rows.length === deskReport.rows.length && JSON.stringify(rows) === JSON.stringify(deskReport.rows.map(row => row.map(cell => String(cell ?? "")))), `rapor satırları API ile aynı (${rows.length})`);
  const foot = await page.$$eval(".report-table tfoot tr", trs => trs.length);
  ok(foot >= 1, `TOPLAM satırı (${foot})`);
  await noOverflow("Cari Listesi raporu");
  await shot("08-rapor-cari-listesi");
  const pdf = await download(page, () => page.click('[data-report-download="pdf"]'));
  ok(pdf.head === "%PDF", `rapor PDF indi (${pdf.name})`);
  const xlsx = await download(page, () => page.click('[data-report-download="xlsx"]'));
  ok(xlsx.head.startsWith("PK"), `rapor Excel indi (${xlsx.name})`);
  await page.click("[data-report-back]");
  await page.click('[data-report-pick="cari-ekstre"]');
  await page.click("#report-account-search");
  await typeSlow("Ali");
  await page.click("[data-report-search]");
  await page.waitForFunction(() => document.querySelectorAll("#report-account-select option").length > 1, null, { timeout: 10000 });
  await page.selectOption("#report-account-select", ali.id);
  await page.click('#report-filter-form button[type="submit"]');
  await page.waitForSelector(".report-table tbody tr", { timeout: 15000 });
  const ekstre = await page.$$(".report-table tbody tr");
  const deskEkstre = await must("masaüstü ekstre", api.get(`/api/workspace/report-center/cari-ekstre?account=${ali.id}&preset=thisYear`));
  ok(ekstre.length === deskEkstre.rows.length && ekstre.length >= 2, `Cari Ekstre satırları ${ekstre.length} = ${deskEkstre.rows.length}`);
  await noOverflow("Cari Ekstre raporu");
  await shot("09-rapor-cari-ekstre");
});

await step("T7 salt okunur: yazma düğmesi / formu yok; demo metni yok", async () => {
  const body = await page.evaluate(() => document.body.innerText);
  ok(!/demo|test onay|test aşama/i.test(body), "demo / test onayı metni yok");
  await tapNav("accounts");
  await page.click(`#content [data-detail="accounts:${ali.id}"]`);
  await page.waitForSelector("[data-detail-balance]");
  const buttons = await page.$$eval("button", items => items.map(item => item.textContent.trim()));
  ok(!buttons.some(label => /Tahsilat|Ödeme|Kaydet|Stok Giriş/.test(label)), `yazma düğmesi yok (${buttons.filter(b => /Tahsilat|Ödeme|Kaydet/.test(b)).join(", ") || "—"})`);
  ok(!(await page.$("form#entry-form, #modal, [data-action^='new-']")), "kayıt formu yok");
  const write = await page.evaluate(async id => (await fetch(`/api/mobil/accounts/${id}/entries`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "in", amount: "10" }) })).status, ali.id);
  ok(write === 405, `tarayıcıdan yazma isteği 405 (${write})`);
  const after = await must("cari kartı", api.get(`/api/workspace/accounts/${ali.id}`));
  ok(after.entries.length === 2, "veri tabanında hareket sayısı değişmedi");
});

await step("T8 iki şirket: 002 boş; veri girilince Yenile; 001'e dönüş", async () => {
  await tapNav("home");
  await page.selectOption("#company", second.id);
  await page.waitForSelector("#content .summary-grid");
  await page.waitForTimeout(300);
  ok((await statText("cash")) === tl(0), `002 Nakit Kasa ${await statText("cash")}`);
  ok((await statText("accounts")) === "0", `002 Cari Kayıtları ${await statText("accounts")}`);
  await tapNav("accounts");
  ok((await text("#content .empty")).includes("Kayıt bulunamadı."), "002 cari listesi boş ipucu");
  await shot("10-sirket-002-bos");
  const ayse = await must("002 cari", api.post(`/api/workspace/accounts?hofCompany=${second.id}`, { name: "Ayşe Demir", type: "customer" }));
  await must("002 büyük borç", api.post(`/api/workspace/accounts/${ayse.id}/entries?hofCompany=${second.id}`, { kind: "debt", amount: "12.345.678,90", note: "Proje bedeli" }));
  await must("002 kasa", api.post(`/api/workspace/cash?hofCompany=${second.id}`, { kind: "in", amount: "12.345.678,90", description: "Peşin satış" }));
  await page.click('[data-action="refresh"]');
  await page.waitForSelector("#content .list-item", { timeout: 10000 });
  const names = await page.$$eval("#content .list-item strong", rows => rows.map(row => row.textContent.trim()));
  ok(JSON.stringify(names) === JSON.stringify(["Ayşe Demir"]), `002 Yenile → ${names.join(", ")}`);
  await amountsOneLine("#content .list-amount", "002 cari listesi (büyük bakiye)");
  await page.click("#content .list-item");
  await page.waitForSelector("[data-detail-balance]");
  ok((await text("[data-detail-balance]")) === tl(12345678.9), `Ayşe Demir bakiyesi ${await text("[data-detail-balance]")}`);
  await amountsOneLine("[data-detail-balance], .entry-row > strong", "002 cari kartı (büyük bakiye)");
  await noOverflow("002 cari kartı");
  await shot("10b-sirket-002-buyuk-bakiye");
  await tapNav("home");
  const two = await desk(second.id);
  ok((await statText("cash")) === tl(two.cash) && Math.abs(two.cash - 12345678.9) < 0.005, `002 Nakit Kasa ${await statText("cash")} = ${tl(two.cash)}`);
  await amountsOneLine("[data-stat] .metric-value", "002 Özet kartları (büyük Kasa)");
  await shot("10c-sirket-002-ozet-buyuk");
  await page.selectOption("#company", (await must("şirketler", api.get("/api/auth/me"))).companies.find(c => c.id !== second.id).id);
  await page.waitForSelector("#content .summary-grid");
  await page.waitForTimeout(300);
  ok((await statText("cash")) === tl(first.cash), `001'e dönüş: Nakit Kasa ${await statText("cash")}`);
  ok((await statText("accounts")) === "2", "001'e dönüş: 2 cari");
});

await step("T9 çıkış (üst çubuk) → giriş ekranı; oturum kapandı", async () => {
  await page.click(".topbar [data-action=\"logout\"]");
  await page.waitForSelector("#login-form", { state: "visible" });
  ok(await page.isVisible("#login-form"), "giriş ekranı");
  const status = await page.evaluate(async () => (await fetch("/api/mobil/session")).status);
  ok(status === 401, `oturum kapandı (${status})`);
  await shot("11-cikis");
});

await step("T10 yetkisiz kullanıcı (Personel): Kasa / Banka / Raporlar görünmez", async () => {
  await loginAs(page, STAFF.username, STAFF.password);
  ok((await statText("cash")) === "Yetki Yok", `Nakit Kasa ${await statText("cash")}`);
  ok((await statText("bank")) === "Yetki Yok", `Banka ${await statText("bank")}`);
  ok((await statText("accounts")) === "2", `Cari Kayıtları ${await statText("accounts")}`);
  ok((await page.$$("#company option")).length === 1, "şirket seçicide yalnız 001");
  await shot("12-personel-ozet");
  await tapNav("money");
  const errors = await page.$$eval("#content .error-box", boxes => boxes.map(box => box.textContent.trim()));
  ok(errors.length === 2 && errors.every(message => /yetkiniz yok/i.test(message)), `Finans: ${errors.join(" | ")}`);
  ok((await text('[data-money="cash"] .big-balance')) === "—", "Kasa tutarı gösterilmez");
  await tapNav("reports");
  const report = await text("#content .error-box").catch(() => "");
  ok(/yetkiniz yok/i.test(report), `Raporlar: ${report}`);
  ok(!(await page.$("[data-report-pick]")), "rapor listesi yok");
  await shot("13-personel-raporlar");
});

ok(pageErrors.length === 0, `sayfa hatası yok (${pageErrors.join(" | ") || "—"})`);
await browser.close();
await server.close();
rmSync(root, { recursive: true, force: true });
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
