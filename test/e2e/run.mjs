// Uçtan uca tarayıcı testi (Playwright + Chromium).
// Gerçek sunucuyu geçici klasörlerle başlatır, iki farklı kullanıcıyla aynı anda çalışarak
// merkezi Excel, hücre düzeltme, silme/geri alma, yeni kayıt, notlar, yetkiler ve yönetim panelini sınar.
// Çalıştırma: npm run test:e2e   (ekran görüntüleri test/e2e/artifacts/ altına yazılır)
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { generateKeyPairSync } from "node:crypto";
import { createApp } from "../../server/app.mjs";
import { createReferenceLicenseService } from "../../tools/lib/license-service.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const artifacts = path.join(here, "artifacts");
mkdirSync(artifacts, { recursive: true });
const fixture = path.join(here, "..", "fixtures", "ornek-dosyalar.xlsx");
const ADMIN_PASSWORD = "Test-Admin-2026!";

// Lisans (v2.0.0): test anahtarıyla imzalayan başvuru lisans servisi; saat ileri alınarak süre dolumu sınanır.
const licenseKeys = generateKeyPairSync("ed25519");
const LICENSE_TRUST = { "e2e-lisans": licenseKeys.publicKey.export({ format: "der", type: "spki" }).toString("base64") };
const licenseClock = { offset: 0 };
const licenseNow = () => Date.now() + licenseClock.offset;
const licenseService = createReferenceLicenseService({ privateKeyPem: licenseKeys.privateKey.export({ format: "pem", type: "pkcs8" }), keyId: "e2e-lisans", now: licenseNow });
const E2E_MACHINE = "e2e0e2e0e2e0e2e0e2e0e2e0e2e0e2e0";
const licenseOptions = { trustedKeys: LICENSE_TRUST, services: ["https://lisans.test/api/lisans"], fetchImpl: licenseService.fetch, machineId: E2E_MACHINE, now: licenseNow, firstCheckDelayMs: 3_600_000 };
// Başka özellikleri sınayan ek sunucular lisanslı gibi çalışır.
const unlicensed = { enforce: false, machineId: E2E_MACHINE };

const root = mkdtempSync(path.join(tmpdir(), "destekofis-e2e-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD }, license: licenseOptions });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const problems = [];
let tableMeta = "";
let passed = 0;

async function step(name, fn) {
  const started = Date.now();
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name} (${Date.now() - started} ms)`);
  } catch (error) {
    console.log(`  ✗ ${name}\n    ${error.stack || error}`);
    const pages = browser.contexts().flatMap(context => context.pages());
    for (const [index, page] of pages.entries()) {
      await page.screenshot({ path: path.join(artifacts, `hata-${index}.png`), fullPage: true }).catch(problem => console.log(`    ekran görüntüsü alınamadı: ${problem.message}`));
      const state = await page.evaluate(async () => ({
        url: location.href,
        auth: Boolean(document.getElementById("hof-auth")),
        authError: document.querySelector("#hof-auth .hof-form-error")?.textContent,
        modals: [...document.querySelectorAll(".hof-modal-title")].map(node => node.textContent),
        splash: Boolean(document.getElementById("hof-splash")),
        root: document.getElementById("root")?.childElementCount,
        badge: document.querySelector('[data-badge="tasks"]')?.textContent,
        user: window.HOF?.user?.name,
        tasks: window.HOF?.user ? await fetch("/api/workspace/tasks?status=open&mine=1").then(r => r.json()).catch(e => e.message) : null,
      })).catch(problem => ({ error: problem.message }));
      console.log(`    sayfa ${index}: ${JSON.stringify(state)}`);
    }
    throw error;
  }
}
const expect = (condition, message) => {
  if (!condition) throw new Error(message);
};

async function newPage(label) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
  const page = await context.newPage();
  page.on("console", message => {
    if (message.type() === "error" && !/favicon/.test(message.text())) problems.push(`[${label}] console: ${message.text()}`);
  });
  page.on("pageerror", error => problems.push(`[${label}] pageerror: ${error.message}`));
  return page;
}

async function login(page, username, password) {
  await page.goto(BASE + "/");
  await page.waitForSelector("#hof-auth input[name=username]");
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load", { timeout: 15000 }), page.click('#hof-auth button[type="submit"]')]);
}
const waitForApp = page => page.waitForSelector(".sidebar #hof-sidecard", { timeout: 15000 });
const rowCount = page => page.$$eval(".dynamic-table tbody tr", rows => rows.length);
const toastText = page => page.$$eval(".hof-toast", nodes => nodes.map(node => node.textContent).join(" | "));

try {
  console.log(`DestekOfis e2e — ${BASE}`);
  const admin = await newPage("yönetici");
  const lawyerContext = { page: null };

  await step("giriş ekranı açılır, hatalı parola reddedilir", async () => {
    await admin.goto(BASE + "/");
    await admin.waitForSelector("#hof-auth");
    await admin.fill("#hof-auth input[name=username]", "admin");
    await admin.fill("#hof-auth input[name=password]", "yanlis-parola-1");
    await admin.click('#hof-auth button[type="submit"]');
    await admin.waitForFunction(() => document.querySelector("#hof-auth .hof-form-error")?.textContent.includes("hatalı"));
    await admin.screenshot({ path: path.join(artifacts, "01-giris.png") });
  });

  await step("yönetici giriş yapar, uygulama ve operasyon kartı yüklenir", async () => {
    await login(admin, "admin", ADMIN_PASSWORD);
    await waitForApp(admin);
    const brand = await admin.textContent(".brand-title");
    expect(brand.includes("DestekOfis"), `marka adı: ${brand}`);
    const user = await admin.textContent("#hof-sidecard .hof-user");
    expect(user.includes("Ofis yöneticisi"), "kullanıcı kartı");
  });

  await step("lisans etkinleştirilmeden salt okunur; yönetim → Lisans'tan ücretsiz deneme başlar", async () => {
    await admin.waitForSelector("#hof-license-bar.is-error", { timeout: 10000 });
    await admin.waitForSelector(".hof-modal-title", { timeout: 10000 });
    const title = await admin.textContent(".hof-modal-title");
    expect(title.includes("Lisans etkinleştirilmedi"), `pencere başlığı: ${title}`);
    const permissions = await admin.evaluate(() => window.HOF.user.permissions);
    expect(!permissions.includes("records.create") && permissions.includes("license.manage"), `yetkiler: ${permissions}`);
    await admin.screenshot({ path: path.join(artifacts, "02a-lisans-etkinlestirilmedi.png") });
    await admin.goto(BASE + "/admin.html");
    await admin.waitForSelector('[data-tab="license"][aria-selected="true"]', { timeout: 10000 });
    const installCode = await admin.textContent("#adm-install-code");
    expect(installCode === "E2E0-E2E0-E2E0-E2E0-E2E0-E2E0-E2E0-E2E0", `kurulum kodu: ${installCode}`);
    await admin.fill('#adm-license-trial input[name="officeName"]', "E2E Hukuk");
    await admin.click('#adm-license-trial button[type="submit"]');
    await admin.waitForFunction(() => document.querySelector("#adm-license-status .adm-license-badge")?.textContent === "Deneme", null, { timeout: 10000 });
    const status = await admin.textContent("#adm-license-status h2");
    expect(status.includes("30 gün kaldı"), `durum: ${status}`);
    expect(await admin.$eval("#adm-license-trial", node => node.hidden), "deneme başladıktan sonra deneme formu gizlenir");
    await admin.screenshot({ path: path.join(artifacts, "02b-lisans-deneme.png"), fullPage: true });
    await admin.goto(BASE + "/");
    await waitForApp(admin);
    await admin.waitForSelector("#hof-license-bar.is-info", { timeout: 10000 });
    await admin.click("#hof-license-bar [data-license-close]");
    expect(!(await admin.$("#hof-license-bar")), "şerit gizlenebilir");
  });

  await step("veri yokken ortada 'başlayalım' kartı; paketin yükleme düğmeleri gizli", async () => {
    await admin.waitForSelector("#hof-start .hof-drop");
    const heading = await admin.textContent("#hof-start h2");
    expect(heading.includes("Excelini yükle ya da Google Sheets linkini yapıştır"), `başlık: ${heading}`);
    const visibleUploads = await admin.$$eval("button", nodes => nodes.filter(node => /Yeni tablo yükle|Tabloyu değiştir/.test(node.textContent) && node.offsetParent).length);
    expect(visibleUploads === 0, `görünen eski yükleme düğmesi: ${visibleUploads}`);
    await admin.screenshot({ path: path.join(artifacts, "02-bos-kaynak.png") });
  });

  await step("Excel başlangıç kartından yüklenir ve ofisin kalıcı verisi olur", async () => {
    const input = await admin.$("#hof-start .hof-drop input[type=file]");
    await Promise.all([admin.waitForEvent("load", { timeout: 30000 }), input.setInputFiles(fixture)]);
    await waitForApp(admin);
    await admin.waitForFunction(() => document.querySelectorAll(".dynamic-table tbody tr").length > 0, null, { timeout: 15000 });
    // v1.7.0: "Tümü" sekmesi yok; ilk sekme açılır, her sekme kendi kolonlarıyla.
    expect((await rowCount(admin)) === 26, `ilk sekmenin satır sayısı ${await rowCount(admin)}`);
    const tabs = await admin.$$eval(".category-bar .category-tabs:not(.hof-category-tabs) .category-tab", nodes => nodes.map(node => `${node.textContent.replace(/\s+/g, " ").trim()}${node.classList.contains("active") ? " *" : ""}`));
    expect(tabs.join("|") === "Aktif 26 *|Kapanan 4", `sekmeler: ${tabs}`);
    const allCount = await admin.$eval('.sidebar .nav-item:has-text("Tüm kayıtlar") .nav-count', node => node.textContent.trim());
    expect(allCount === "30", `'Tüm kayıtlar' sayısı tüm veriden: ${allCount}`);
    const flash = await toastText(admin);
    expect(flash.includes("yüklendi") && flash.includes("Tüm bilgisayarlar"), `bildirim: ${flash}`);
    expect(!(await admin.$("#hof-start")), "veri gelince başlangıç kartı kalkmalı");
    const title = await admin.textContent(".page-title");
    expect(title.includes("ornek-dosyalar"), `başlık: ${title}`);
    await admin.screenshot({ path: path.join(artifacts, "03-excel-yuklendi.png") });
  });

  await step("akıllı analiz ekranı adım adım açılır; sektör önerisi kanıtıyla gelir, kendiliğinden uygulanmaz", async () => {
    await admin.waitForSelector(".hof-modal .hof-steps", { timeout: 10000 });
    await admin.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 15000 });
    const done = await admin.$$eval('.hof-steps li[data-status="done"]', nodes => nodes.length);
    expect(done === 5, `tamamlanan adım ${done}`);
    const result = await admin.$eval(".hof-analysis-result", node => node.innerText.replace(/\s+/g, " "));
    expect(result.includes("İcra ve alacak takibi") && result.includes("Yüksek güven") && result.includes("“BORÇLU” kolonu"), `sonuç: ${result}`);
    const profile = (await admin.evaluate(() => fetch("/api/workspace/profile").then(response => response.json()))).data;
    expect(profile.sector.id === "genel", `onaysız uygulanmamalı: ${profile.sector.id}`);
    expect(/Özet kartları: \d+ kart doğrulandı/.test(result), `kart özeti: ${result}`);
    await admin.screenshot({ path: path.join(artifacts, "03b-analiz.png") });
    // Kart raporu: doğrulanan kartlar ve gösterilmeyen aday kartların nedenleri, sekme sekme.
    await admin.click(".hof-analysis-result [data-cards]");
    await admin.waitForSelector(".hof-scope-report");
    const report = await admin.$$eval(".hof-scope-report", nodes => nodes.map(node => node.innerText.replace(/\s+/g, " ")));
    expect(report.length === 2 && report[0].includes("Aktif") && report[0].includes("Tutar toplamı: Tutar") && report[0].includes("Durum dağılımı: Dosyanın son durumu"), `rapor: ${report}`);
    expect(report[1].includes("Kapanan") && report[1].includes("dağılım için az"), `kapanan sekmesi raporu: ${report[1]}`);
    await admin.keyboard.press("Escape");
    await admin.waitForFunction(() => !document.querySelector(".hof-scope-report"));
    expect(await admin.$(".hof-analysis-result"), "analiz sonucu açık kalmalı");
  });

  await step("sektör seçici: kelimeyle aranır, klavyeyle gezilir, Esc ile kapanır", async () => {
    await admin.click(".hof-analysis-result [data-pick]");
    await admin.waitForSelector(".hof-picker-list .hof-picker-option");
    const total = await admin.textContent(".hof-picker-count");
    expect(/1\d\d sektör, 22 grup/.test(total), `liste: ${total}`);
    await admin.fill(".hof-picker-search input", "galeri");
    const found = await admin.$$eval(".hof-picker-option b", nodes => nodes.map(node => node.textContent));
    expect(found.includes("Oto galeri ve araç alım-satım"), `arama: ${found}`);
    await admin.fill(".hof-picker-search input", "hasta diş");
    const narrowed = await admin.$$eval(".hof-picker-option b", nodes => nodes.map(node => node.textContent));
    expect(narrowed.length === 1 && narrowed[0] === "Diş kliniği", `iki kelimeyle: ${narrowed}`);
    await admin.fill(".hof-picker-search input", "");
    await admin.keyboard.press("ArrowDown");
    const active = await admin.$eval(".hof-picker-option.is-active", node => node.dataset.id);
    expect(active, "klavyeyle etkin seçenek");
    await admin.keyboard.press("Escape");
    await admin.waitForFunction(() => !document.querySelector(".hof-picker"));
    expect(await admin.$(".hof-analysis-result"), "analiz sonucu açık kalmalı");
  });

  await step("öneri onaylanınca görünüm sektör diline geçer; göstergeler kolon adlarıyla", async () => {
    await admin.click(".hof-analysis-result [data-apply]");
    await admin.waitForFunction(() => !document.querySelector(".hof-modal-backdrop"), null, { timeout: 5000 });
    await admin.waitForFunction(() => document.querySelector(".brand-subtitle")?.firstChild?.nodeValue === "Hukuk ofisi yönetimi", null, { timeout: 5000 });
    const view = await admin.evaluate(() => ({
      summary: document.querySelector(".welcome-row .section-title")?.firstChild?.nodeValue,
      nav: [...document.querySelectorAll(".sidebar .nav-item")].map(node => node.textContent.trim()),
      newRecord: document.querySelector('[data-action="newRecord"] .hof-side-text')?.textContent,
      search: document.querySelector(".search-field input")?.placeholder,
      cards: [...document.querySelectorAll("#hof-summary .hof-summary-card")].map(node => node.innerText.replace(/\s+/g, " ")),
      title: document.title,
    }));
    expect(view.summary === "Dosya özeti" && view.nav.some(item => item.startsWith("Tüm dosyalar")) && view.newRecord === "Yeni dosya", `dil: ${JSON.stringify(view)}`);
    expect(view.search === "Dosya no, borçlu veya telefon ara…", `arama ipucu: ${view.search}`);
    expect(view.cards.length === 4 && view.cards[1].includes("Tutar toplamı") && view.cards[1].includes("438.750") && view.cards[3].includes("Veri sağlığı"), `kartlar: ${view.cards}`);
    await admin.screenshot({ path: path.join(artifacts, "03c-akilli-ozet.png") });
  });

  await step("akıllı özet kartı tıklanınca kayıt listesi açılır; kayda gidilir ve satır belirginleşir", async () => {
    await admin.click('#hof-summary [data-kpi="deadline"]');
    await admin.waitForSelector(".hof-modal-backdrop.is-visible .hof-record-list button");
    const items = await admin.$$eval(".hof-record-list button b", nodes => nodes.map(node => node.textContent));
    expect(items.length === 3, `yaklaşan kayıt: ${items}`);
    await admin.click('.hof-record-list button:has-text("Burak Koç")');
    await admin.waitForFunction(() => document.querySelector(".detail-panel")?.dataset.hofKey === "2026/109", null, { timeout: 5000 });
    await admin.waitForSelector('.dynamic-table tbody tr.selected.hof-row-flash[data-hof-key="2026/109"]', { timeout: 3000 });
    await admin.screenshot({ path: path.join(artifacts, "03d-yonlendirilen-satir.png") });
  });

  await step("kartın 'Nasıl hesaplandı?' açıklaması ve dağılımdan kayıt listesi", async () => {
    await admin.click('#hof-summary [data-kpi="money"]');
    await admin.waitForSelector(".hof-modal-backdrop.is-visible .hof-explain");
    await admin.click(".hof-explain summary");
    const explain = await admin.$eval(".hof-explain", node => node.innerText.replace(/\s+/g, " "));
    expect(explain.includes("“TUTAR” kolonundaki 26 tutar toplandı") && explain.includes("Para birimi hücrelerde yazılı: TL") && explain.includes("%100'ü kesin okundu"), `açıklama: ${explain}`);
    await admin.keyboard.press("Escape");
    await admin.waitForFunction(() => !document.querySelector(".hof-modal-backdrop"));
    // Kartlarda yer olmayan durum kartı raporda; toplam kartı sekmenin raporunu açar.
    await admin.click('#hof-summary [data-kpi="total"]');
    await admin.waitForSelector(".hof-modal-backdrop.is-visible .hof-scope-report");
    const report = await admin.$eval(".hof-scope-report", node => node.innerText.replace(/\s+/g, " "));
    expect(report.includes("26 kayıt") && report.includes("yalnızca raporda"), `sekme raporu: ${report}`);
    await admin.keyboard.press("Escape");
    await admin.waitForFunction(() => !document.querySelector(".hof-modal-backdrop"));
  });

  await step("başlık kalemle değiştirilir, kalıcıdır ve varsayılana döndürülebilir", async () => {
    await admin.hover(".welcome-row .section-title");
    await admin.click(".welcome-row .section-title .hof-label-pencil");
    await admin.waitForSelector(".hof-label-editor input");
    await admin.fill(".hof-label-editor input", "İcra dosyaları özeti");
    await admin.click(".hof-label-editor [data-save]");
    await admin.waitForFunction(() => document.querySelector(".welcome-row .section-title")?.firstChild?.nodeValue === "İcra dosyaları özeti", null, { timeout: 5000 });
    await admin.reload();
    await waitForApp(admin);
    await admin.waitForFunction(() => document.querySelector(".welcome-row .section-title")?.firstChild?.nodeValue === "İcra dosyaları özeti", null, { timeout: 10000 });
    await admin.hover(".sidebar .brand-subtitle");
    await admin.click(".sidebar .brand-subtitle .hof-label-pencil");
    await admin.fill(".hof-label-editor input", "Deneme Hukuk");
    await admin.press(".hof-label-editor input", "Enter");
    await admin.waitForFunction(() => document.querySelector(".brand-subtitle")?.firstChild?.nodeValue === "Deneme Hukuk", null, { timeout: 5000 });
    await admin.click(".sidebar .brand-subtitle .hof-label-pencil");
    await admin.click(".hof-label-editor [data-reset]");
    await admin.waitForFunction(() => document.querySelector(".brand-subtitle")?.firstChild?.nodeValue === "Hukuk ofisi yönetimi", null, { timeout: 5000 });
    // Sayfa başlığı (verinin adı) değişir; birden çok sekmede tablo başlığı açık sekmenin adı olarak kalır.
    const ownText = selector => admin.evaluate(sel => [...(document.querySelector(sel)?.childNodes || [])].filter(node => node.nodeType === 3).map(node => node.nodeValue).join("").replace(/\s+/g, " ").trim(), selector);
    const pageTitle = await ownText(".topbar .page-title");
    await admin.hover(".topbar .page-title");
    await admin.click(".topbar .page-title .hof-label-pencil");
    await admin.fill(".hof-label-editor input", "Tüm şubeler");
    await admin.click(".hof-label-editor [data-save]");
    await admin.waitForFunction(() => document.querySelector(".topbar .page-title")?.textContent.trim() === "Tüm şubeler" && document.querySelector(".cases-panel .panel-title")?.textContent.trim() === "Aktif", null, { timeout: 5000 });
    // Düzenleyicide İptal düğmesindeyken Enter kaydetmez.
    await admin.click(".topbar .page-title .hof-label-pencil");
    await admin.fill(".hof-label-editor input", "Yanlışlıkla");
    await admin.focus(".hof-label-editor [data-cancel]");
    await admin.keyboard.press("Enter");
    await admin.waitForSelector(".hof-label-editor", { state: "detached", timeout: 3000 });
    expect((await ownText(".topbar .page-title")) === "Tüm şubeler", "İptal'de Enter başlığı kaydetmemeli");
    await admin.click(".topbar .page-title .hof-label-pencil");
    await admin.click(".hof-label-editor [data-reset]");
    await admin.waitForFunction(title => document.querySelector(".topbar .page-title")?.textContent.trim() === title, pageTitle, { timeout: 5000 });
    // Birden çok metin parçalı başlık (tablo açıklaması): varsayılana dönünce metin aynen geri gelir.
    tableMeta = await ownText(".cases-panel .panel-meta");
    await admin.hover(".cases-panel .panel-meta");
    await admin.click(".cases-panel .panel-meta .hof-label-pencil");
    await admin.fill(".hof-label-editor textarea", "Özel tablo açıklaması");
    await admin.click(".hof-label-editor [data-save]");
    await admin.waitForFunction(() => document.querySelector(".cases-panel .panel-meta")?.textContent.trim() === "Özel tablo açıklaması", null, { timeout: 5000 });
    await admin.click(".cases-panel .panel-meta .hof-label-pencil");
    await admin.click(".hof-label-editor [data-reset]");
    await admin.waitForFunction(text => [...document.querySelector(".cases-panel .panel-meta").childNodes].filter(node => node.nodeType === 3).map(node => node.nodeValue).join("").replace(/\s+/g, " ").trim() === text, tableMeta, { timeout: 5000 });
  });

  await step("satırlar sunucu kimliği taşır, sayfalama 20 satır gösterir", async () => {
    const keys = await admin.$$eval(".dynamic-table tbody tr", rows => rows.map(row => row.dataset.hofKey));
    expect(keys[0] === "2026/101" && keys.every(Boolean), `kimlikler: ${keys.slice(0, 3)}`);
    const visible = await admin.$$eval(".dynamic-table tbody tr", rows => rows.filter(row => row.style.display !== "none").length);
    expect(visible === 20, `görünen satır ${visible}`);
    await admin.waitForSelector("#hof-pager");
    await admin.click('#hof-pager button[data-page="2"]');
    const second = await admin.$$eval(".dynamic-table tbody tr", rows => rows.filter(row => row.style.display !== "none").length);
    expect(second === 6, `ikinci sayfa ${second}`);
    await admin.click('#hof-pager button[data-page="1"]');
  });

  await step("sekmeler kendi kolonlarıyla; arama tüm sekmeleri sayar, Enter başka sekmedeki kayda gider", async () => {
    await admin.click('.category-bar .category-tab:has-text("Kapanan")');
    await admin.waitForFunction(() => document.querySelectorAll(".dynamic-table tbody tr").length === 4, null, { timeout: 5000 });
    await admin.waitForFunction(() => document.querySelector('#hof-summary [data-kpi="total"] .hof-summary-value')?.textContent.trim() === "4", null, { timeout: 5000 });
    expect((await admin.textContent(".cases-panel .panel-title")).trim() === "Kapanan", "tablo başlığı açık sekme");
    await admin.click('.category-bar .category-tab:has-text("Aktif")');
    await admin.waitForFunction(() => document.querySelectorAll(".dynamic-table tbody tr").length === 26, null, { timeout: 5000 });
    // Aktif sekmedeyken yalnızca Kapanan'da geçen bir ad aranır.
    await admin.fill(".search-field input", "Fatma");
    await admin.waitForFunction(() => document.querySelector(".category-bar .category-tab.hof-tab-nohit")?.textContent.includes("Aktif"), null, { timeout: 5000 });
    const counts = await admin.$$eval(".category-bar .category-tabs:not(.hof-category-tabs) .category-tab", nodes => nodes.map(node => node.textContent.replace(/\s+/g, " ").trim()));
    expect(counts.join("|") === "Aktif 0|Kapanan 1", `aramada sekme sayıları: ${counts}`);
    const heading = await admin.textContent(".category-heading strong");
    expect(heading.includes("1 sonuç · tüm sekmelerde"), `şerit başlığı: ${heading}`);
    await admin.press(".search-field input", "Enter");
    await admin.waitForFunction(() => document.querySelector(".detail-panel")?.dataset.hofKey === "2025/1", null, { timeout: 5000 });
    await admin.waitForSelector('.category-bar .category-tab.active:has-text("Kapanan")');
    await admin.waitForSelector('.dynamic-table tbody tr.selected[data-hof-key="2025/1"]');
    await admin.fill(".search-field input", "");
    await admin.click('.category-bar .category-tab:has-text("Aktif")');
    await admin.waitForFunction(() => document.querySelectorAll(".dynamic-table tbody tr").length === 26, null, { timeout: 5000 });
  });

  await step("hücre düzenlenir; tablo yenilenir ve seçim korunur", async () => {
    const row = admin.locator(".dynamic-table tbody tr").nth(2);
    await row.click();
    const selectedKey = await admin.getAttribute(".detail-panel", "data-hof-key");
    expect(selectedKey === "2026/103", `seçili: ${selectedKey}`);
    const cell = row.locator("td").nth(6);
    await cell.hover();
    await admin.waitForSelector(".hof-float:not(.hof-float-delete).is-visible");
    await admin.click(".hof-float:not(.hof-float-delete).is-visible");
    await admin.waitForSelector(".hof-modal textarea");
    await admin.fill(".hof-modal textarea", "Satış talebi verildi");
    await admin.click('.hof-modal button[type="submit"]');
    await admin.waitForFunction(() => document.querySelectorAll(".dynamic-table tbody tr")[2]?.cells[6]?.textContent.includes("Satış talebi verildi"), null, { timeout: 10000 });
    const stillSelected = await admin.getAttribute(".detail-panel", "data-hof-key");
    expect(stillSelected === "2026/103", `yenileme sonrası seçim: ${stillSelected}`);
    // Seçili satır tam satır renkle ve solda vurgu çizgisiyle diğerlerinden ayrılır; üzerine gelinen satırdan da farklıdır.
    await admin.mouse.move(5, 5);
    const look = await admin.evaluate(() => {
      const rows = [...document.querySelectorAll(".dynamic-table tbody tr")];
      const selected = rows.find(row => row.classList.contains("selected"));
      const other = rows.find(row => !row.classList.contains("selected"));
      return { selected: getComputedStyle(selected).backgroundColor, other: getComputedStyle(other).backgroundColor, bar: getComputedStyle(selected.cells[0]).boxShadow, count: rows.filter(row => row.classList.contains("selected")).length };
    });
    expect(look.count === 1 && look.selected === "rgb(226, 240, 231)" && look.other !== look.selected && /inset/.test(look.bar) && /4px/.test(look.bar), `seçili satır görünümü: ${JSON.stringify(look)}`);
    await admin.screenshot({ path: path.join(artifacts, "03e-secili-satir.png") });
  });

  await step("satır silinir ve geri alınır", async () => {
    const before = await rowCount(admin);
    const row = admin.locator(".dynamic-table tbody tr").nth(0);
    await row.locator("td").nth(1).hover();
    await admin.waitForSelector(".hof-float-delete.is-visible");
    await admin.click(".hof-float-delete.is-visible");
    await admin.click('.hof-modal [data-answer="yes"]');
    await admin.waitForFunction(count => document.querySelectorAll(".dynamic-table tbody tr").length === count - 1, before, { timeout: 10000 });
    await admin.click(".hof-toast-action");
    await admin.waitForFunction(count => document.querySelectorAll(".dynamic-table tbody tr").length === count, before, { timeout: 10000 });
  });

  await step("yeni kayıt açık sekmenin kolonlarıyla oluşturulur, o sekmede en üste gelir ve seçilir", async () => {
    await admin.click('#hof-sidecard [data-action="newRecord"]');
    await admin.waitForSelector(".hof-modal .hof-record-grid");
    const fields = await admin.$$eval(".hof-modal .hof-field span", nodes => nodes.map(node => node.textContent));
    expect(fields.length === 8, `alan sayısı ${fields.length}`);
    const intro = await admin.textContent(".hof-modal .hof-modal-body, .hof-modal");
    expect(intro.includes("Aktif sekmesine eklenir"), `form açıklaması: ${intro.slice(0, 200)}`);
    await admin.fill('.hof-modal input[name="c0"]', "2026/999");
    await admin.fill('.hof-modal input[name="c1"]', "Test Borçlu");
    await admin.click('.hof-modal button[type="submit"]');
    await admin.waitForFunction(() => document.querySelector(".dynamic-table tbody tr")?.dataset.hofKey === "2026/999", null, { timeout: 10000 });
    await admin.waitForFunction(() => document.querySelector(".detail-panel")?.dataset.hofKey === "2026/999", null, { timeout: 10000 });
    const record = app.store.get("SELECT values_json FROM records WHERE case_key = '2026/999'");
    expect(JSON.parse(record.values_json).__sheet === "Aktif", `kayıt sekmesi: ${record.values_json}`);
    // Varsayılana dönülmüş çok parçalı başlık, React sayıyı güncelleyince bozulmaz (yalnızca sayı kalmaz).
    const meta = await admin.textContent(".cases-panel .panel-meta");
    expect(meta.replace(/\d+/g, "#").trim() === tableMeta.replace(/\d+/g, "#"), `tablo açıklaması: "${meta}" (önce "${tableMeta}")`);
  });

  await step("dosyaya not eklenir; işlem geçmişinde işlemi yapanla görünür", async () => {
    await admin.locator(".dynamic-table tbody tr").nth(1).click();
    await admin.click('.hof-case-actions [data-case-action="note"]');
    await admin.fill(".hof-modal textarea", "Borçlu arandı, ödeme sözü alındı");
    await admin.click('.hof-modal button[type="submit"]');
    await admin.waitForFunction(() => document.querySelector("#hof-activity")?.textContent.includes("ödeme sözü alındı"), null, { timeout: 10000 });
    const activity = await admin.textContent("#hof-activity");
    expect(activity.includes("Ofis yöneticisi"), "işlemi yapan görünmeli");
    await admin.screenshot({ path: path.join(artifacts, "04-detay-gecmis.png") });
  });

  await step("detaydaki 'Notu kaydet' merkezi sunucuya yazılır", async () => {
    await admin.fill(".note-section textarea", "Merkezi not denemesi");
    await admin.click(".note-section .save-note");
    await admin.waitForTimeout(600);
    const notes = app.store.all("SELECT case_key, note FROM case_notes");
    expect(notes.some(item => item.note === "Merkezi not denemesi"), `notlar: ${JSON.stringify(notes)}`);
  });

  await step("ödeme sözleri şeridi görünür ve söz kapatılabilir", async () => {
    await admin.waitForSelector(".hof-payment-promises .hof-payment-pill");
    const pills = await admin.$$eval(".hof-payment-promises .hof-payment-pill:not([aria-hidden])", nodes => nodes.length);
    expect(pills === 3, `söz sayısı ${pills}`);
    await admin.hover(".hof-payment-promises-viewport");
    await admin.click(".hof-payment-promises .hof-payment-pill:not([aria-hidden])");
    await admin.click('.hof-payment-action-card [data-action="paid"]');
    await admin.waitForFunction(() => document.querySelectorAll(".hof-payment-promises .hof-payment-pill:not([aria-hidden])").length === 2, null, { timeout: 10000 });
  });

  await step("yönetici personel hesabı oluşturur (yönetim paneli)", async () => {
    await admin.goto(BASE + "/admin.html");
    await admin.waitForSelector("#adm-users tr[data-id]");
    await admin.click("#adm-new-user");
    await admin.fill('.hof-modal input[name="name"]', "Av. Deniz Yıldırım");
    await admin.fill('.hof-modal input[name="username"]', "deniz");
    await admin.selectOption('.hof-modal select[name="role"]', "personel");
    await admin.fill('.hof-modal input[name="password"]', "Gecici-Parola-24");
    await admin.click('.hof-modal button[type="submit"]');
    await admin.waitForFunction(() => document.querySelector("#adm-users")?.textContent.includes("deniz"));
    await admin.screenshot({ path: path.join(artifacts, "05-yonetim.png") });
  });

  await step("yönetim panelinde yedek alınır ve geçmiş listelenir", async () => {
    await admin.click('.adm-tabs [data-tab="backups"]');
    await admin.click("#adm-backup-now");
    await admin.waitForFunction(() => document.querySelector("#adm-backups")?.textContent.includes("manuel"));
    await admin.click('.adm-tabs [data-tab="audit"]');
    await admin.waitForFunction(() => document.querySelector("#adm-audit")?.textContent.includes("Veri içeri aldı"));
    const auditText = await admin.textContent("#adm-audit");
    expect(auditText.includes("ornek-dosyalar.xlsx · ilk yükleme · 30 kayıt (30 yeni, 0 güncellendi)"), `geçmiş ayrıntısı: ${auditText.slice(0, 300)}`);
    expect(auditText.includes("Sektörü değiştirdi") && auditText.includes("İcra ve alacak takibi (analiz önerisi onaylandı)"), "sektör değişikliği geçmişte");
    expect(auditText.includes("Başlığı değiştirdi"), "başlık değişikliği geçmişte");
    await admin.click('.adm-tabs [data-tab="system"]');
    await admin.waitForFunction(() => document.querySelector("#adm-system")?.textContent.includes("Şema sürümü"));
  });

  await step("yönetim panelinde ofis adı kaydedilir, bağlantı adresleri listelenir", async () => {
    await admin.waitForFunction(() => document.querySelector("#adm-addresses li code") || document.querySelector("#adm-addresses")?.textContent.includes("bulunamadı"));
    const system = await admin.textContent("#adm-system");
    expect(system.includes("Çalışma biçimi") && system.includes("Doğrudan"), `çalışma biçimi görünmeli: ${system}`);
    await admin.waitForFunction(() => document.querySelector("#adm-update-summary")?.textContent.includes("kurulum dosyasıyla kurulan"));
    expect(await admin.isHidden("#adm-update-apply"), "servis dışında 'Şimdi güncelle' görünmemeli");
    await admin.fill("#adm-office-name", "Deneme Hukuk Bürosu");
    await admin.click("#adm-office-save");
    await admin.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(node => node.textContent.includes("Ofis adı kaydedildi")));
    await admin.reload();
    await admin.waitForFunction(() => document.querySelector("#adm-office-name")?.value === "Deneme Hukuk Bürosu");
    await admin.screenshot({ path: path.join(artifacts, "05b-sistem.png") });
  });

  const staff = await newPage("personel");
  lawyerContext.page = staff;
  await step("yeni personel ilk girişte parolasını değiştirmek zorunda", async () => {
    await login(staff, "deniz", "Gecici-Parola-24");
    await staff.waitForSelector(".hof-modal input[name=currentPassword]");
    await staff.fill(".hof-modal input[name=currentPassword]", "Gecici-Parola-24");
    await staff.fill(".hof-modal input[name=newPassword]", "Kalici-Parola-2026");
    await staff.fill(".hof-modal input[name=confirmPassword]", "Kalici-Parola-2026");
    await Promise.all([staff.waitForEvent("load"), staff.click('.hof-modal button[type="submit"]')]);
    await waitForApp(staff);
  });

  await step("personel aynı merkezi tabloyu ve notları görür", async () => {
    await staff.waitForFunction(() => document.querySelectorAll(".dynamic-table tbody tr").length > 0, null, { timeout: 15000 });
    const keys = await staff.$$eval(".dynamic-table tbody tr", rows => rows.map(row => row.dataset.hofKey));
    expect(keys[0] === "2026/999", `ilk kayıt ${keys[0]}`);
    const edited = await staff.$$eval(".dynamic-table tbody tr", rows => rows.find(row => row.dataset.hofKey === "2026/103")?.cells[6]?.textContent || "");
    expect(edited.includes("Satış talebi verildi"), `düzeltme görünmeli: ${edited}`);
    const notes = await staff.evaluate(() => localStorage.getItem("hukuk-ofisi-notlar"));
    expect(notes.includes("Merkezi not denemesi"), "merkezi not personelde görünmeli");
    await staff.waitForSelector("#hof-summary .hof-summary-card", { timeout: 10000 });
    const view = await staff.evaluate(() => ({ label: document.querySelector(".welcome-row .section-title")?.firstChild?.nodeValue, pencils: document.querySelectorAll(".hof-label-pencil").length, subtitle: document.querySelector(".brand-subtitle")?.firstChild?.nodeValue }));
    expect(view.label === "İcra dosyaları özeti" && view.subtitle === "Hukuk ofisi yönetimi" && view.pencils === 0, `personel görünümü: ${JSON.stringify(view)}`);
  });

  await step("personel kaynak menülerini göremez, satır silemez", async () => {
    const hiddenNav = await staff.$$eval(".sidebar .nav-item", items => items.filter(item => ["Tabloyu değiştir", "Ayarlar"].includes(item.textContent.trim())).every(item => item.style.display === "none"));
    expect(hiddenNav, "kaynak menüleri gizli olmalı");
    await staff.locator(".dynamic-table tbody tr").nth(1).locator("td").nth(1).hover();
    await staff.waitForSelector(".hof-float:not(.hof-float-delete).is-visible");
    const deleteVisible = await staff.$eval(".hof-float-delete", node => getComputedStyle(node).display !== "none");
    expect(!deleteVisible, "silme düğmesi görünmemeli");
    const reports = await staff.$('#hof-sidecard [data-action="reports"]');
    expect(!(await reports.isVisible()), "rapor düğmesi görünmemeli");
    const assign = await staff.$('#hof-sidecard [data-action="newTask"]');
    expect(!(await assign.isVisible()), "görev atama yalnızca avukat ve yöneticide görünmeli");
    const caseTask = await staff.$('.hof-case-actions [data-case-action="task"]');
    expect(!caseTask || !(await caseTask.isVisible()), "dosyadaki Görev işlemi personelde gizli olmalı");
    await staff.screenshot({ path: path.join(artifacts, "06-personel.png") });
  });

  await step("yönetici görev atar, personel sayfayı yenilemeden rozet ve bildirim alır, tamamlar", async () => {
    await admin.goto(BASE + "/");
    await waitForApp(admin);
    await admin.click('#hof-sidecard [data-action="newTask"]');
    await admin.fill('.hof-modal input[name="title"]', "Tebligatı kontrol et");
    await admin.fill('.hof-modal input[name="assignee"]', "Av. Deniz Yıldırım");
    await admin.selectOption('.hof-modal select[name="priority"]', "urgent");
    await admin.click('.hof-modal button[type="submit"]');
    await admin.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(node => node.textContent.includes("Görev atandı")));
    // Canlı kanal: personel ekranı yenilemeden rozeti ve "size görev atadı" bildirimini görür.
    await staff.waitForFunction(() => document.querySelector('[data-badge="tasks"]')?.textContent === "1", null, { timeout: 10000 });
    await staff.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(node => node.textContent.includes("size görev atadı")), null, { timeout: 10000 });
    await staff.click('#hof-sidecard [data-action="tasks"]');
    await staff.waitForSelector(".hof-modal [data-complete]");
    const tabs = await staff.$$eval(".hof-modal [data-view]", nodes => nodes.map(node => node.textContent));
    expect(tabs.join("|") === "Açık görevlerim|Tamamladıklarım", `personel yalnızca kendi görevlerini görmeli: ${tabs}`);
    expect(!(await staff.$(".hof-modal [data-new]")), "personel yeni görev açamamalı");
    await staff.click(".hof-modal [data-complete]");
    await staff.waitForFunction(() => document.querySelector(".hof-modal [data-list]")?.textContent.includes("açık görev yok"));
  });

  await step("sohbet: özel mesaj anında gelir, okundu görünür, dosya numarası dosyayı açar", async () => {
    // Önceki adımda açık kalan "Görevler" penceresi kapatılır.
    if (await staff.$(".hof-modal [data-close]")) await staff.click(".hof-modal [data-close]");
    await staff.waitForFunction(() => !document.querySelector(".hof-modal"));
    await admin.click('#hof-sidecard [data-action="messages"]');
    await admin.waitForSelector("#hof-chat.is-open .hof-chat-item[data-user]");
    await admin.click('#hof-chat .hof-chat-item[data-user]:has-text("Av. Deniz Yıldırım")');
    await admin.fill("#hof-chat [data-composer]", "2026/103 dosyasındaki satış talebine bakar mısın?");
    await admin.press("#hof-chat [data-composer]", "Enter");
    await staff.waitForFunction(() => document.querySelector('[data-badge="messages"]')?.textContent === "1", null, { timeout: 10000 });
    await staff.click('.hof-toast:has-text("satış talebine") .hof-toast-action');
    await staff.waitForSelector('#hof-chat.is-open .hof-chat-msg:has-text("satış talebine")');
    await admin.waitForSelector("#hof-chat .hof-chat-receipt.is-read", { timeout: 10000 });
    await staff.fill("#hof-chat [data-composer]", "Bakıyorum.");
    await staff.press("#hof-chat [data-composer]", "Enter");
    await admin.waitForSelector('#hof-chat .hof-chat-msg:not(.is-mine):has-text("Bakıyorum.")', { timeout: 10000 });
    await staff.click('#hof-chat .hof-chat-case[data-case="2026/103"]');
    await staff.waitForFunction(() => document.querySelector(".detail-panel")?.innerText.includes("2026/103"), null, { timeout: 10000 });
    // Başka sekmedeki dosya: sohbetteki bağlantı o sekmeyi açar.
    await admin.fill("#hof-chat [data-composer]", "2025/2 kapandı mı?");
    await admin.press("#hof-chat [data-composer]", "Enter");
    await staff.waitForSelector('#hof-chat .hof-chat-case[data-case="2025/2"]', { timeout: 10000 });
    await staff.click('#hof-chat .hof-chat-case[data-case="2025/2"]');
    await staff.waitForFunction(() => document.querySelector(".detail-panel")?.dataset.hofKey === "2025/2", null, { timeout: 10000 });
    await staff.waitForSelector('.category-bar .category-tab.active:has-text("Kapanan")');
    await admin.screenshot({ path: path.join(artifacts, "07-sohbet.png") });
    await admin.click('#hof-chat [data-act="close"]');
    await staff.click('#hof-chat [data-act="close"]').catch(() => {});
  });

  await step("alt tablolu Excel 'yerine koy' ile yüklenir; sekme içindeki tablolar kendi kolonlarıyla bölüm olur", async () => {
    await admin.click('.sidebar .nav-item:has-text("Ayarlar")');
    await admin.waitForSelector(".hof-modal-backdrop.is-visible .hof-data-summary");
    const input = await admin.$(".hof-modal .hof-drop input[type=file]");
    await input.setInputFiles(path.join(here, "..", "fixtures", "bolumlu-sayfalar.xlsx"));
    await admin.waitForSelector(".hof-modal-backdrop.is-visible .hof-choice-grid", { timeout: 20000 });
    const choice = await admin.$eval(".hof-choice-grid", node => node.innerText.replace(/\s+/g, " "));
    expect(choice.includes("52 yeni kayıt eklenir") && choice.includes("Yeni dosyada olmayan 30 kayıt tablodan kalkar"), `önizleme: ${choice}`);
    await admin.click('.hof-choice [data-mode="replace"]');
    await admin.waitForSelector('.hof-modal [data-answer="yes"]');
    await Promise.all([admin.waitForEvent("load", { timeout: 30000 }), admin.click('.hof-modal [data-answer="yes"]')]);
    // "Yerine koy" sonrası analiz yeniden gösterilir: veri aynı sektörde, mevcut görünüm korunur.
    await admin.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
    const again = await admin.$eval(".hof-analysis-result", node => node.textContent.replace(/\s+/g, " "));
    expect(again.includes("Mevcut sektörünüz verinizle uyumlu"), `yerine koy sonrası analiz: ${again}`);
    await admin.click(".hof-analysis-result [data-done]");
    await admin.waitForFunction(() => !document.querySelector(".hof-modal-backdrop"), null, { timeout: 5000 });
    await admin.waitForSelector('.hof-category-tabs [data-group="ÖNEMLİ İCRA"]', { timeout: 15000 });
    await admin.click('.hof-category-tabs [data-group="ÖNEMLİ İCRA"]');
    await admin.waitForSelector(".hof-section-tabs .hof-section-tab.active");
    const sections = await admin.$$eval(".hof-section-tabs .hof-section-tab", nodes => nodes.map(node => node.textContent.trim()));
    expect(sections.length === 3 && sections[0].startsWith("Gayrimenkul Satış") && sections[0].endsWith("16"), `bölümler: ${sections}`);
    await admin.click(".hof-section-tabs .hof-section-tab:nth-of-type(3)");
    await admin.waitForFunction(() => [...document.querySelectorAll(".dynamic-table thead th")].some(th => th.textContent.includes("MÜVEKKİL")), null, { timeout: 10000 });
    const rows = await rowCount(admin);
    expect(rows === 4, `çek cezası bölümü satır sayısı ${rows}`);
    const headerRow = await admin.$$eval(".dynamic-table tbody tr", items => items.some(row => row.textContent.includes("SIRA")));
    expect(!headerRow, "alt tablo başlık satırı kayıt gibi görünmemeli");
    await admin.screenshot({ path: path.join(artifacts, "08-alt-tablolar.png") });
  });

  await step("yeni ay dosyası 'devamı olarak' eklenir: yeniler eklenir, değişen güncellenir, olmayan korunur", async () => {
    await admin.click('.sidebar .nav-item:has-text("Ayarlar")');
    await admin.waitForSelector(".hof-modal-backdrop.is-visible .hof-data-summary");
    const input = await admin.$(".hof-modal .hof-drop input[type=file]");
    await input.setInputFiles(path.join(here, "..", "fixtures", "veri-devam.xlsx"));
    await admin.waitForSelector(".hof-modal-backdrop.is-visible .hof-choice-grid", { timeout: 20000 });
    const choice = await admin.$eval(".hof-choice-grid", node => node.innerText.replace(/\s+/g, " "));
    expect(choice.includes("2 yeni kayıt eklenir") && choice.includes("1 kayıt yeni bilgilerle güncellenir") && choice.includes("28 kayıt silinmez"), `önizleme: ${choice}`);
    await Promise.all([admin.waitForEvent("load", { timeout: 30000 }), admin.click('.hof-choice [data-mode="merge"]')]);
    await waitForApp(admin);
    const flash = await toastText(admin);
    expect(flash.includes("devamı olarak eklendi: 2 yeni, 1 güncellendi"), `bildirim: ${flash}`);
    const dataset = (await admin.evaluate(() => fetch("/api/workspace/dataset").then(response => response.json()))).data;
    expect(dataset.rowCount === 54 && dataset.imports[0].mode === "merge", `veri: ${dataset.rowCount} ${dataset.imports[0]?.mode}`);
  });

  await step("oturum kapanınca giriş ekranı ofis adıyla gelir", async () => {
    await staff.keyboard.press("Escape");
    await staff.click('#hof-sidecard [data-action="logout"]');
    await staff.waitForSelector("#hof-auth", { timeout: 10000 });
    await staff.waitForFunction(() => document.querySelector("#hof-auth .hof-auth-brand span")?.textContent === "Deneme Hukuk Bürosu");
    expect((await staff.title()).startsWith("Deneme Hukuk Bürosu"), "sekme başlığında ofis adı görünmeli");
  });

  await step("v1.0.0 tarayıcısındaki kaynak ve notlar ilk girişte ofise taşınır", async () => {
    const legacyRoot = mkdtempSync(path.join(tmpdir(), "destekofis-e2e-eski-"));
    const legacySheet = async url => (String(url).includes("/edit") ? new Response('<script>"gid":"0","name":"Eski"</script>') : new Response("DOSYA NO,BORÇLU\n2024/77,Eski Borçlu", { headers: { "content-type": "text/csv" } }));
    const legacyApp = createApp({ dataDir: path.join(legacyRoot, "data"), backupDir: path.join(legacyRoot, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, fetchImpl: legacySheet, license: unlicensed });
    const legacyPort = (await legacyApp.listen(0, "127.0.0.1")).port;
    try {
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      await context.addInitScript(() => {
        if (!localStorage.getItem("hof-seeded")) {
          localStorage.setItem("hof-seeded", "1");
          localStorage.setItem("hukuk-ofisi-sheet-url", "https://docs.google.com/spreadsheets/d/ESKI-KAYNAK/edit");
          localStorage.setItem("hukuk-ofisi-notlar", JSON.stringify({ "2024/77": "Eski tarayıcı notu" }));
        }
      });
      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${legacyPort}/`);
      await page.fill("#hof-auth input[name=username]", "admin");
      await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
      await Promise.all([page.waitForLoadState("load"), page.click('#hof-auth button[type="submit"]')]);
      await waitForApp(page);
      expect(legacyApp.store.setting("dataset.linkedSheetUrl") === "https://docs.google.com/spreadsheets/d/ESKI-KAYNAK/edit", "kaynak ofise bağlanmalı");
      expect(legacyApp.store.get("SELECT COUNT(*) AS count FROM dataset_rows").count === 1, "Sheet satırları sunucuya kaydedilmeli");
      const note = legacyApp.store.get("SELECT note FROM case_notes WHERE case_key = '2024/77'");
      expect(note && note.note === "Eski tarayıcı notu", "eski not aktarılmalı");
      await context.close();
    } finally {
      await legacyApp.close();
      rmSync(legacyRoot, { recursive: true, force: true });
    }
  });

  await step("hukuk dışı veri: klinik tablosu Klinik önerir; seçilince dil 'hasta'ya döner, haciz gizlenir", async () => {
    const clinicRoot = mkdtempSync(path.join(tmpdir(), "destekofis-e2e-klinik-"));
    const clinicApp = createApp({ dataDir: path.join(clinicRoot, "data"), backupDir: path.join(clinicRoot, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, license: unlicensed });
    const clinicPort = (await clinicApp.listen(0, "127.0.0.1")).port;
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
    try {
      const page = await context.newPage();
      page.on("pageerror", error => problems.push(`[klinik] pageerror: ${error.message}`));
      await page.goto(`http://127.0.0.1:${clinicPort}/`);
      const tagline = await page.waitForFunction(() => document.querySelector("#hof-auth .hof-auth-brand span")?.textContent).then(handle => handle.jsonValue());
      expect(tagline === "Ofis yönetimi", `yeni kurulum giriş alt başlığı: ${tagline}`);
      await page.fill("#hof-auth input[name=username]", "admin");
      await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
      await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
      await page.waitForSelector("#hof-start .hof-drop");
      const input = await page.$("#hof-start .hof-drop input[type=file]");
      await Promise.all([page.waitForEvent("load", { timeout: 30000 }), input.setInputFiles(path.join(here, "..", "fixtures", "klinik.xlsx"))]);
      await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
      const result = await page.$eval(".hof-analysis-result", node => node.innerText.replace(/\s+/g, " "));
      expect(result.includes("Klinik ve poliklinik") && result.includes("Hekim"), `klinik önerisi: ${result}`);
      await page.click(".hof-analysis-result [data-apply]");
      await page.waitForFunction(() => document.querySelector(".brand-subtitle")?.firstChild?.nodeValue === "Klinik yönetimi", null, { timeout: 5000 });
      await page.click(".dynamic-table tbody tr");
      const view = await page.evaluate(() => ({
        summary: document.querySelector(".welcome-row .section-title")?.firstChild?.nodeValue,
        newRecord: document.querySelector('[data-action="newRecord"] .hof-side-text')?.textContent,
        liens: getComputedStyle(document.querySelector('#hof-sidecard [data-action="liens"]')).display,
        lienAction: getComputedStyle(document.querySelector('.hof-case-actions [data-case-action="lien"]')).display,
        search: document.querySelector(".search-field input")?.placeholder,
        keys: [...document.querySelectorAll(".dynamic-table tbody tr")].slice(0, 2).map(row => row.dataset.hofKey),
      }));
      expect(view.summary === "Hasta özeti" && view.newRecord === "Yeni hasta" && view.liens === "none" && view.lienAction === "none", `klinik görünümü: ${JSON.stringify(view)}`);
      expect(view.search === "Hasta no, ad soyad veya telefon ara…", `arama ipucu: ${view.search}`);
      expect(view.keys.join() === "H-1001,H-1002", `kayıt kimlikleri kimlik kolonundan: ${view.keys}`);
      await page.screenshot({ path: path.join(artifacts, "10-klinik.png") });
    } finally {
      await context.close();
      await clinicApp.close();
      rmSync(clinicRoot, { recursive: true, force: true });
    }
  });

  const csp = problems.filter(item => /Content Security Policy|Refused to/.test(item));
  await step("deneme süresi dolunca program durur: şerit, açıklama, yazma engeli; lisans anahtarıyla kaldığı yerden devam eder", async () => {
    const before = problems.length;
    licenseClock.offset = 31 * 86_400_000;
    await admin.goto(BASE + "/");
    await waitForApp(admin);
    await admin.waitForSelector("#hof-license-bar.is-error", { timeout: 10000 });
    await admin.waitForSelector(".hof-modal-title", { timeout: 10000 });
    const title = await admin.textContent(".hof-modal-title");
    expect(title.includes("Deneme süresi doldu"), `pencere: ${title}`);
    await admin.screenshot({ path: path.join(artifacts, "30-lisans-suresi-doldu.png") });
    await admin.click(".hof-modal [data-close]");
    const rows = await rowCount(admin);
    expect(rows > 0, "kayıtlar görüntülenmeye devam eder");
    const write = await admin.evaluate(() => fetch("/api/workspace/records", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sourceName: "dataset://ofis", values: { "DOSYA NO": "2026/9999" } }) }).then(response => response.json().then(body => ({ status: response.status, code: body.code }))));
    expect(write.status === 403 && write.code === "LICENSE_READ_ONLY", `yazma denemesi: ${JSON.stringify(write)}`);
    const { key } = licenseService.admin.createLicense({ customer: "E2E Hukuk Bürosu", expiresAt: null });
    await admin.goto(BASE + "/admin.html#license");
    await admin.waitForSelector('[data-tab="license"][aria-selected="true"]');
    await admin.fill('#adm-license-key input[name="key"]', key);
    await admin.click('#adm-license-key button[type="submit"]');
    await admin.waitForFunction(() => document.querySelector("#adm-license-status .adm-license-badge")?.textContent === "Lisanslı", null, { timeout: 10000 });
    await admin.screenshot({ path: path.join(artifacts, "31-lisansli.png"), fullPage: true });
    await admin.goto(BASE + "/");
    await waitForApp(admin);
    await admin.waitForTimeout(800);
    expect(!(await admin.$("#hof-license-bar")), "lisanslıyken şerit yok");
    const permissions = await admin.evaluate(() => window.HOF.user.permissions);
    expect(permissions.includes("records.create"), "yazma yetkileri geri gelir");
    // Bu adımdaki bilinçli 403 yanıtları konsol hatası sayılmaz.
    for (let index = problems.length - 1; index >= before; index -= 1) if (/403/.test(problems[index])) problems.splice(index, 1);
  });

  await step("tarayıcı konsolunda hata ve CSP ihlali yok", async () => {
    expect(!csp.length, csp.join("\n"));
    const other = problems.filter(item => !/401 \(Unauthorized\)|status of 401|status of 400|status of 403/.test(item));
    expect(!other.length, other.join("\n"));
  });
  console.log(`\n${passed} adım başarılı.`);
} catch {
  console.log(`\nKonsol kayıtları:\n${problems.join("\n")}`);
  process.exitCode = 1;
} finally {
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
}
