// Uçtan uca tarayıcı testi (Playwright + Chromium).
// Gerçek sunucuyu geçici klasörlerle başlatır, iki farklı kullanıcıyla aynı anda çalışarak
// merkezi Excel, hücre düzeltme, silme/geri alma, yeni kayıt, notlar, yetkiler ve yönetim panelini sınar.
// Çalıştırma: npm run test:e2e   (ekran görüntüleri test/e2e/artifacts/ altına yazılır)
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { generateKeyPairSync } from "node:crypto";
import { createApp } from "../../server/app.mjs";
import { readZip } from "../../server/lib/zip.mjs";
import { createReferenceLicenseService } from "../../tools/lib/license-service.mjs";
import { okulServisiXlsx } from "../fixtures/okul-servisi-ornek.mjs";
import { acilirListelerXlsx } from "../fixtures/acilir-listeler.mjs";

// v2.0.2: ilk yüklemede veri doğrudan yazılmaz; "Ön izleme ve eşleme" penceresi açılır, "Yükle" ile onaylanır.
async function firstUpload(page, input, files) {
  await input.setInputFiles(files);
  await page.waitForSelector(".hof-modal-backdrop.is-visible .hof-mapping", { timeout: 30000 });
  await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click('.hof-modal-backdrop.is-visible [data-mode="replace"]')]);
}

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
    if (message.type() === "error" && !/favicon/.test(message.text())) problems.push(`[${label}] console: ${message.text()} ${message.location?.()?.url || ""}`.trim());
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
// Sekmedeki kayıt sayısı: paket yalnız açık sayfayı çizdiğinden (v2.0.6) pencereden; pencere yoksa DOM satırlarından.
const rowCount = page => page.evaluate(() => window.HOF?.tableWindow?.total ?? document.querySelectorAll(".dynamic-table tbody tr").length);
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

  await step("ücretsiz deneme program açılınca kendiliğinden başlar; lisans ekranı sadeleşir", async () => {
    const until = Date.now() + 15000;
    let state = "";
    while (Date.now() < until) {
      state = await admin.evaluate(() => fetch("/api/license").then(response => response.json()).then(body => body.data.state));
      if (state === "trial") break;
      await admin.waitForTimeout(200);
    }
    expect(state === "trial", `durum: ${state}`);
    await admin.goto(BASE + "/admin.html#license");
    await admin.waitForSelector('[data-tab="license"][aria-selected="true"]', { timeout: 10000 });
    const installCode = await admin.textContent("#adm-install-code");
    expect(installCode === "E2E0-E2E0-E2E0-E2E0-E2E0-E2E0-E2E0-E2E0", `kurulum kodu: ${installCode}`);
    await admin.waitForFunction(() => document.querySelector("#adm-license-status .adm-license-badge")?.textContent === "Deneme", null, { timeout: 10000 });
    const status = await admin.textContent("#adm-license-status h2");
    expect(status.includes("30 gün kaldı"), `durum: ${status}`);
    expect(await admin.$eval("#adm-license-trial", node => node.hidden), "deneme başlayınca 'Denemeyi şimdi başlat' gizlenir");
    await admin.screenshot({ path: path.join(artifacts, "02b-lisans-deneme.png"), fullPage: true });
    await admin.goto(BASE + "/");
    await waitForApp(admin);
    await admin.waitForSelector("#hof-license-bar.is-info", { timeout: 10000 });
    expect(!(await admin.$(".hof-modal-title")), "ilk gün iletişim penceresi açılmaz");
    await admin.click("#hof-license-bar [data-license-close]");
    expect(!(await admin.$("#hof-license-bar")), "şerit gizlenebilir");
  });

  await step("veri yokken ortada 'başlayalım' kartı; paketin yükleme düğmeleri gizli", async () => {
    await admin.waitForSelector("#hof-start .hof-drop");
    const heading = await admin.textContent("#hof-start h2");
    expect(heading.includes("Excelini yükle ya da Google Sheets linkini yapıştır"), `başlık: ${heading}`);
    const visibleUploads = await admin.$$eval("button", nodes => nodes.filter(node => /Yeni tablo yükle|Tabloyu değiştir/.test(node.textContent) && node.offsetParent).length);
    expect(visibleUploads === 0, `görünen eski yükleme düğmesi: ${visibleUploads}`);
    const guideHref = await admin.getAttribute("#hof-start .hof-start-guide a", "href");
    expect(guideHref === "/kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf", `kılavuz bağlantısı: ${guideHref}`);
    const guide = await admin.evaluate(href => fetch(href).then(response => ({ status: response.status, type: response.headers.get("content-type") })), guideHref);
    expect(guide.status === 200 && guide.type === "application/pdf", `kılavuz: ${JSON.stringify(guide)}`);
    expect(await admin.$('#hof-sidecard [data-action="guide"]'), "operasyon merkezinde kılavuz bağlantısı");
    await admin.screenshot({ path: path.join(artifacts, "02-bos-kaynak.png") });
  });

  await step("Excel başlangıç kartından yüklenir ve ofisin kalıcı verisi olur", async () => {
    const input = await admin.$("#hof-start .hof-drop input[type=file]");
    await firstUpload(admin, input, fixture);
    await waitForApp(admin);
    await admin.waitForFunction(() => document.querySelectorAll(".dynamic-table tbody tr").length > 0, null, { timeout: 15000 });
    // v1.7.0: "Tümü" sekmesi yok; ilk sekme açılır, her sekme kendi kolonlarıyla.
    expect((await rowCount(admin)) === 26, `ilk sekmenin satır sayısı ${await rowCount(admin)}`);
    const tabs = await admin.$$eval(".category-bar .category-tabs:not(.hof-category-tabs) .category-tab", nodes => nodes.map(node => `${node.textContent.replace(/\s+/g, " ").trim()}${node.classList.contains("active") ? " *" : ""}`));
    expect(tabs.join("|") === "Aktif 26 *|Kapanan 4", `sekmeler: ${tabs}`);
    // v2.0.2: sol menü sade (Çalışma alanı / Dinamik görünüm / Tüm kayıtlar / Bu ay / Veri kaynağı yok; Ayarlar yerinde).
    const sidebar = await admin.$eval(".sidebar", node => node.innerText.replace(/\s+/g, " "));
    expect(!/ÇALIŞMA ALANI|Dinamik görünüm|Tüm kayıtlar|Bu ay\b|VERİ KAYNAĞI/.test(sidebar) && /Ayarlar/.test(sidebar), `sol menü: ${sidebar.slice(0, 300)}`);
    // v2.0.2: tabloda dolu kolonların hepsi (önceden ilk 7).
    const headers = await admin.$$eval(".dynamic-table thead th", nodes => nodes.length);
    expect(headers === 8, `tablo kolonları: ${headers}`);
    await admin.waitForSelector(".dynamic-table.hof-sized thead th:nth-child(2) .hof-col-grip", { timeout: 10000 });
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
    expect(result.includes("İcra ve Alacak Takibi") && result.includes("Yüksek Güven") && result.includes("“BORÇLU” kolonu"), `sonuç: ${result}`);
    const profile = (await admin.evaluate(() => fetch("/api/workspace/profile").then(response => response.json()))).data;
    expect(profile.sector.id === "genel", `onaysız uygulanmamalı: ${profile.sector.id}`);
    expect(/Özet Kartları: \d+ kart doğrulandı/.test(result), `kart özeti: ${result}`);
    await admin.screenshot({ path: path.join(artifacts, "03b-analiz.png") });
    // Kart raporu: doğrulanan kartlar ve gösterilmeyen aday kartların nedenleri, sekme sekme.
    await admin.click(".hof-analysis-result [data-cards]");
    await admin.waitForSelector(".hof-scope-report");
    const report = await admin.$$eval(".hof-scope-report", nodes => nodes.map(node => node.innerText.replace(/\s+/g, " ")));
    expect(report.length === 2 && report[0].includes("Aktif") && report[0].includes("Tutar Toplamı: Tutar") && report[0].includes("Durum Dağılımı: Dosyanın son durumu"), `rapor: ${report}`);
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
    expect(found.includes("Oto Galeri ve Araç Alım-Satım"), `arama: ${found}`);
    await admin.fill(".hof-picker-search input", "hasta diş");
    const narrowed = await admin.$$eval(".hof-picker-option b", nodes => nodes.map(node => node.textContent));
    expect(narrowed.length === 1 && narrowed[0] === "Diş Kliniği", `iki kelimeyle: ${narrowed}`);
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
    await admin.waitForFunction(() => document.querySelector(".brand-subtitle")?.firstChild?.nodeValue === "Hukuk Ofisi Yönetimi", null, { timeout: 5000 });
    const view = await admin.evaluate(() => ({
      summary: document.querySelector(".welcome-row .section-title")?.firstChild?.nodeValue,
      nav: [...document.querySelectorAll(".sidebar .nav-item")].map(node => node.textContent.trim()),
      newRecord: document.querySelector('[data-action="newRecord"] .hof-side-text')?.textContent,
      search: document.querySelector(".search-field input")?.placeholder,
      cards: [...document.querySelectorAll("#hof-summary .hof-summary-card")].map(node => node.innerText.replace(/\s+/g, " ")),
      title: document.title,
    }));
    // Operasyon Merkezi'nde "Yeni kayıt" sabittir (sektöre göre değişmez, v2.0.2).
    expect(view.summary === "Dosya Özeti" && !view.nav.some(item => item.startsWith("Tüm dosyalar")) && view.newRecord === "Yeni Kayıt", `dil: ${JSON.stringify(view)}`);
    expect(view.search === "Dosya no, borçlu veya telefon ara…", `arama ipucu: ${view.search}`);
    expect(view.cards.length === 4 && view.cards[1].includes("Tutar Toplamı") && view.cards[1].includes("438.750") && view.cards[3].includes("Veri Sağlığı"), `kartlar: ${view.cards}`);
    await admin.screenshot({ path: path.join(artifacts, "03c-akilli-ozet.png") });
  });

  await step("kolon genişliği başlığın kenarından sürüklenir, hatırlanır; çift tık otomatik genişliğe döndürür", async () => {
    await admin.waitForFunction(() => !document.querySelector(".hof-modal-backdrop"), null, { timeout: 5000 });
    // v2.0.4: kolon genişliği başlığın sağ kenarından sürüklenir ve bu bilgisayarda hatırlanır.
    // v2.0.7: ANLIK DURUM kartı başlığı aşağı iter; başlık ekranın altındaki yatay kaydırma çubuğunun altında kalmasın.
    // Yüklemeden sonra "Verinizi tanıyoruz" penceresi tabloyu örter; tutamaç o pencere kapandıktan sonra denenir.
    // ANLIK DURUM ve özet kartları gelirken sayfa kayabilir: tutamaç yerine oturana kadar ölçülür.
    let gripBox = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await admin.$eval(".dynamic-table thead", node => node.scrollIntoView({ block: "center" }));
      await admin.waitForTimeout(200);
      gripBox = await admin.$eval(".dynamic-table thead th:nth-child(2) .hof-col-grip", node => { const b = node.getBoundingClientRect(); return { x: b.x + 3, y: b.y + b.height / 2, hit: document.elementFromPoint(b.x + 3, b.y + b.height / 2)?.className || "" }; });
      if (/hof-col-grip/.test(gripBox.hit)) break;
    }
    const before = await admin.$eval(".dynamic-table thead th:nth-child(2)", th => th.getBoundingClientRect().width);
    expect(/hof-col-grip/.test(gripBox.hit), `tutamaç tıklanabilir: ${gripBox.hit}`);
    await admin.mouse.move(gripBox.x, gripBox.y);
    await admin.mouse.down();
    await admin.mouse.move(gripBox.x - 30, gripBox.y, { steps: 5 });
    await admin.mouse.up();
    const after = await admin.$eval(".dynamic-table thead th:nth-child(2)", th => th.getBoundingClientRect().width);
    expect(after < before - 20, `kolon daraldı: ${Math.round(before)} → ${Math.round(after)}`);
    const remembered = await admin.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("hof.colw") || "{}")).length);
    expect(remembered === 1, "kolon genişliği hatırlandı");
    // Playwright'ın kararlılık denetimi yapışkan başlıkta takılabiliyor; olay doğrudan tutamaca gönderilir.
    await admin.dispatchEvent(".dynamic-table thead th:nth-child(2) .hof-col-grip", "dblclick");
    await admin.waitForTimeout(300);
    const reset = await admin.$eval(".dynamic-table thead th:nth-child(2)", th => th.getBoundingClientRect().width);
    expect(Math.abs(reset - before) < 3, `çift tık otomatik genişliğe döndürür: ${Math.round(reset)} ≈ ${Math.round(before)}`);
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

  await step("başlık kalemle değiştirilir, kalıcıdır ve varsayılana döndürülebilir; ana ekranda 'Dosya özeti' bloğu yok (v2.0.10)", async () => {
    // v2.0.10: ANLIK DURUM'un yanındaki özet başlığı/açıklaması kaldırıldı; "Dışa aktar" tablo başlık satırında.
    const top = await admin.evaluate(() => ({
      summary: getComputedStyle(document.querySelector(".welcome-row > div:first-child")).display,
      pulse: Boolean(document.querySelector(".welcome-row #hof-pulse")),
      exportButton: Boolean(document.querySelector(".cases-panel > .panel-heading #hof-toolbar-export")),
    }));
    expect(top.summary === "none" && top.pulse && top.exportButton, `üst alan: ${JSON.stringify(top)}`);
    await admin.reload();
    await waitForApp(admin);
    await admin.hover(".sidebar .brand-subtitle");
    await admin.click(".sidebar .brand-subtitle .hof-label-pencil");
    await admin.fill(".hof-label-editor input", "Deneme Hukuk");
    await admin.press(".hof-label-editor input", "Enter");
    await admin.waitForFunction(() => document.querySelector(".brand-subtitle")?.firstChild?.nodeValue === "Deneme Hukuk", null, { timeout: 5000 });
    await admin.click(".sidebar .brand-subtitle .hof-label-pencil");
    await admin.click(".hof-label-editor [data-reset]");
    await admin.waitForFunction(() => document.querySelector(".brand-subtitle")?.firstChild?.nodeValue === "Hukuk Ofisi Yönetimi", null, { timeout: 5000 });
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
    // Tablonun üstündeki "N kayıt · N kolon" satırı gizli (v2.0.10); React sayıyı güncellemeye devam eder.
    tableMeta = await ownText(".cases-panel .panel-meta");
    const metaDisplay = await admin.$eval(".cases-panel .panel-meta", node => getComputedStyle(node).display);
    expect(metaDisplay === "none" && /kayıt/.test(tableMeta), `kayıt · kolon satırı gizli olmalı: ${metaDisplay} "${tableMeta}"`);
  });

  await step("satırlar sunucu kimliği taşır, sayfalama 20 satır gösterir", async () => {
    const keys = await admin.$$eval(".dynamic-table tbody tr", rows => rows.map(row => row.dataset.hofKey));
    expect(keys[0] === "2026/101" && keys.every(Boolean), `kimlikler: ${keys.slice(0, 3)}`);
    // v2.0.6: paket yalnız açık sayfanın satırlarını çizer (26 kayıt → DOM'da 20 satır); pencere kaplama modüllerine verilir.
    expect(keys.length === 20, `DOM'daki satır sayısı ${keys.length} (yalnız açık sayfa çizilmeli)`);
    const win = await admin.evaluate(() => ({ ...window.HOF.tableWindow, setPage: undefined, indexOf: undefined }));
    expect(win.page === 1 && win.size === 20 && win.total === 26 && win.pages === 2, `tablo penceresi: ${JSON.stringify(win)}`);
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
    await admin.waitForFunction(() => (window.HOF?.tableWindow?.total ?? document.querySelectorAll(".dynamic-table tbody tr").length) === 4, null, { timeout: 5000 });
    await admin.waitForFunction(() => document.querySelector('#hof-summary [data-kpi="total"] .hof-summary-value')?.textContent.trim() === "4", null, { timeout: 5000 });
    expect((await admin.textContent(".cases-panel .panel-title")).trim() === "Kapanan", "tablo başlığı açık sekme");
    await admin.click('.category-bar .category-tab:has-text("Aktif")');
    await admin.waitForFunction(() => (window.HOF?.tableWindow?.total ?? document.querySelectorAll(".dynamic-table tbody tr").length) === 26, null, { timeout: 5000 });
    // Aktif sekmedeyken yalnızca Kapanan'da geçen bir ad aranır.
    await admin.fill(".search-field input", "Fatma");
    await admin.waitForFunction(() => document.querySelector(".category-bar .category-tab.hof-tab-nohit")?.textContent.includes("Aktif"), null, { timeout: 5000 });
    const counts = await admin.$$eval(".category-bar .category-tabs:not(.hof-category-tabs) .category-tab", nodes => nodes.map(node => node.textContent.replace(/\s+/g, " ").trim()));
    expect(counts.join("|") === "Aktif 0|Kapanan 1", `aramada sekme sayıları: ${counts}`);
    // v2.0.2: sekme şeridinin sağında sayaç/analiz yazısı yok.
    const strip = await admin.$eval(".category-bar", node => node.innerText.replace(/\s+/g, " "));
    expect(!/sonuç|toplam|kayıt ·/.test(strip), `sekme şeridi: ${strip}`);
    await admin.press(".search-field input", "Enter");
    await admin.waitForFunction(() => document.querySelector(".detail-panel")?.dataset.hofKey === "2025/1", null, { timeout: 5000 });
    await admin.waitForSelector('.category-bar .category-tab.active:has-text("Kapanan")');
    await admin.waitForSelector('.dynamic-table tbody tr.selected[data-hof-key="2025/1"]');
    await admin.fill(".search-field input", "");
    await admin.click('.category-bar .category-tab:has-text("Aktif")');
    await admin.waitForFunction(() => (window.HOF?.tableWindow?.total ?? document.querySelectorAll(".dynamic-table tbody tr").length) === 26, null, { timeout: 5000 });
  });

  await step("hücre düzenlenir; tablo yenilenir ve seçim korunur", async () => {
    const row = admin.locator(".dynamic-table tbody tr").nth(2);
    await row.locator("td").first().click({ position: { x: 12, y: 10 } });
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
    // Üzerine gelme renginden çıkış geçişi (transition) bitsin; renkler tek biçime çevrilir (rgba(…, 1) = rgb(…)).
    await admin.waitForTimeout(400);
    const look = await admin.evaluate(() => {
      const color = value => value.replace(/^rgba\((\d+), (\d+), (\d+), 1\)$/, "rgb($1, $2, $3)");
      const rows = [...document.querySelectorAll(".dynamic-table tbody tr")];
      const selected = rows.find(row => row.classList.contains("selected"));
      const other = rows.find(row => !row.classList.contains("selected"));
      return { selected: color(getComputedStyle(selected).backgroundColor), other: color(getComputedStyle(other).backgroundColor), bar: getComputedStyle(selected.cells[0]).boxShadow, count: rows.filter(row => row.classList.contains("selected")).length };
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
    await admin.waitForFunction(count => (window.HOF?.tableWindow?.total ?? document.querySelectorAll(".dynamic-table tbody tr").length) === count - 1, before, { timeout: 10000 });
    await admin.click('.hof-toast-action:has-text("Geri al")');
    await admin.waitForFunction(count => (window.HOF?.tableWindow?.total ?? document.querySelectorAll(".dynamic-table tbody tr").length) === count, before, { timeout: 10000 });
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
    await admin.locator(".dynamic-table tbody tr").nth(1).locator("td").first().click({ position: { x: 12, y: 10 } });
    await admin.click('.hof-case-actions [data-case-action="note"]');
    await admin.fill(".hof-modal textarea", "Borçlu arandı, ödeme sözü alındı");
    await admin.click('.hof-modal button[type="submit"]');
    await admin.waitForFunction(() => document.querySelector("#hof-activity")?.textContent.includes("ödeme sözü alındı"), null, { timeout: 10000 });
    const activity = await admin.textContent("#hof-activity");
    expect(activity.includes("Ofis yöneticisi"), "işlemi yapan görünmeli");
    // v2.0.4: Telefon düğmesi kayıttaki numarayı Ara / WhatsApp ile gösterir; altında yeni numara ekleme formu.
    await admin.click('.hof-case-actions [data-case-action="phone"]');
    await admin.waitForSelector(".hof-modal-backdrop.is-visible .hof-phone-list, .hof-modal-backdrop.is-visible .hof-modal-text", { timeout: 5000 });
    const phoneModal = await admin.$eval(".hof-modal-backdrop.is-visible .hof-modal", node => ({ text: node.innerText.replace(/\s+/g, " "), tel: node.querySelector('a[href^="tel:"]')?.getAttribute("href") || "", submit: node.querySelector('button[type="submit"]')?.textContent || "" }));
    expect(/Yeni numara ekle/i.test(phoneModal.submit), `telefon penceresi: ${phoneModal.text.slice(0, 160)}`);
    expect(!phoneModal.tel || /^tel:\+90\d{10}$/.test(phoneModal.tel), `arama bağlantısı: ${phoneModal.tel}`);
    await admin.keyboard.press("Escape");
    await admin.waitForFunction(() => !document.querySelector(".hof-modal-backdrop"), null, { timeout: 5000 });
    await admin.screenshot({ path: path.join(artifacts, "04-detay-gecmis.png") });
  });

  await step("tahsilat işlenir (en altta), düzeltilir ve silinir; kasaya düşer, kasadan ödeme girilir", async () => {
    await admin.click('.hof-case-actions [data-case-action="payment"]');
    await admin.fill('.hof-modal input[name="amount"]', "1.250");
    await admin.fill('.hof-modal input[name="note"]', "Elden");
    await admin.click('.hof-modal button[type="submit"]');
    await admin.waitForFunction(() => document.querySelector("#hof-activity li:last-child")?.textContent.includes("1.250,00"), null, { timeout: 10000 });
    const order = await admin.$$eval("#hof-activity li", items => items.map(item => item.dataset.type));
    expect(order.at(-1) === "payment" && order.includes("note") && order.indexOf("note") < order.indexOf("payment"), `yeni işlem en altta olmalı: ${order}`);
    await admin.click("#hof-activity [data-payment-edit]");
    await admin.waitForSelector('.hof-modal-backdrop.is-visible input[name="amount"]');
    await admin.fill('.hof-modal input[name="amount"]', "1.500,00");
    await admin.click('.hof-modal button[type="submit"]');
    await admin.waitForFunction(() => /1\.500,00/.test(document.querySelector("#hof-activity")?.textContent || "") && document.querySelector("#hof-activity")?.textContent.includes("düzeltildi"), null, { timeout: 10000 });
    await admin.click('#hof-sidecard [data-action="cash"]');
    await admin.waitForFunction(() => document.querySelector(".hof-cash-balance strong")?.textContent.includes("1.500,00"), null, { timeout: 10000 });
    await admin.click('.hof-modal [data-add="out"]');
    await admin.waitForSelector('.hof-modal-backdrop.is-visible input[name="description"]');
    await admin.fill('.hof-modal input[name="amount"]', "200");
    await admin.fill('.hof-modal input[name="description"]', "Kırtasiye");
    await admin.click('.hof-modal button[type="submit"]');
    await admin.waitForFunction(() => document.querySelector(".hof-cash-balance strong")?.textContent.includes("1.300,00"), null, { timeout: 10000 });
    const ledger = await admin.$$eval(".hof-cash-table tbody tr:not(.hof-cash-opening)", rows => rows.map(row => row.innerText.replace(/\s+/g, " ")));
    expect(ledger.length === 2 && ledger[1].includes("Kırtasiye"), `kasa hareketleri eskiden yeniye: ${ledger.join(" | ")}`);
    await admin.screenshot({ path: path.join(artifacts, "04b-kasa.png") });
    await admin.click('.hof-modal [data-close]');
    await admin.click("#hof-activity [data-payment-delete]");
    await admin.click('.hof-modal [data-answer="yes"]');
    await admin.waitForFunction(() => !document.querySelector("#hof-activity li[data-type=payment]"), null, { timeout: 10000 });
    const cash = (await admin.evaluate(() => fetch("/api/workspace/cash").then(response => response.json()))).data;
    expect(cash.totals.balance === -200, `tahsilat silinince kasadan düşer: ${cash.totals.balance}`);
  });

  await step("taksitler (v2.0.4): kart açılır, taksitler dağıtılır, tahsilat kalanı düşürür ve kasaya iner", async () => {
    await admin.click('#hof-sidecard [data-action="plans"]');
    await admin.waitForSelector(".hof-modal-backdrop.is-visible .hof-plans [data-act=new]", { timeout: 10000 });
    await admin.click('.hof-plans [data-act="new"]');
    await admin.waitForSelector('.hof-modal-backdrop.is-visible input[name="name"]');
    await admin.fill('.hof-plan-form input[name="name"]', "Ayşe Yılmaz");
    // v2.0.6: kayıt tarihi bugünle hazır gelir.
    const todayIso = await admin.evaluate(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    });
    const registered = await admin.inputValue('.hof-plan-form input[name="registeredOn"]');
    expect(registered === todayIso, `kayıt tarihi bugün: ${registered}`);
    await admin.fill('.hof-plan-form input[name="phone"]', "0532 111 22 33");
    await admin.fill('.hof-plan-form input[name="total"]', "9.000");
    await admin.selectOption('.hof-plan-form select[name="groupId"]', "\u0001yeni");
    await admin.fill('.hof-plan-form input[name="groupName"]', "42 C 1070");
    await admin.selectOption('.hof-plan-form select[name="items"]', "auto");
    await admin.fill('.hof-plan-form input[name="count"]', "3");
    await admin.fill('.hof-plan-form input[name="firstDue"]', "2026-01-05");
    // v2.0.13: ilk vade Kayıt Tarihi'nden (bugün) önce olamaz — form kaydetmez, nedenini söyler; Kayıt Tarihi düzeltilince açılır.
    await admin.click('.hof-plan-form button[type="submit"]');
    await admin.waitForFunction(() => /önce olamaz/.test([...document.querySelectorAll(".hof-toast")].map(node => node.textContent).join(" ")), null, { timeout: 8000 });
    expect(/İlk Vade .*önce olamaz/.test(await toastText(admin)), `vade < kayıt tarihi uyarısı: ${await toastText(admin)}`);
    await admin.fill('.hof-plan-form input[name="registeredOn"]', "2026-01-01");
    await admin.click('.hof-plan-form button[type="submit"]');
    await admin.waitForSelector(".hof-plans .hof-plan-head", { timeout: 10000 });
    await admin.waitForFunction(() => document.querySelectorAll(".hof-plan-items tbody tr").length === 3, null, { timeout: 10000 });
    const head = await admin.$eval(".hof-plans .hof-plan-head", node => node.innerText.replace(/\s+/g, " "));
    expect(head.includes("Ayşe Yılmaz") && head.includes("42 C 1070") && head.includes("Gecikti"), `kart başlığı: ${head}`);
    // v2.0.5: kişi paneli (sıra no, grup, telefon, not) üstte; taksit süzgeçleri; PDF ve Yazdır; geniş pencere.
    const profile = await admin.$eval(".hof-plans .hof-plan-profile", node => node.innerText.replace(/\s+/g, " "));
    expect(/SIRA NO 1\b/.test(profile.toLocaleUpperCase("tr-TR")) && profile.includes("0532 111 22 33") && profile.includes("3 taksit"), `kişi paneli: ${profile}`);
    expect(profile.toLocaleUpperCase("tr-TR").includes("KAYIT TARİHİ") && profile.includes("01.01.2026"), `kişi panelinde kayıt tarihi: ${profile}`);
    const width = await admin.$eval(".hof-plans-modal", node => node.getBoundingClientRect().width);
    expect(width > 1000, `taksit penceresi geniş olmalı: ${width}`);
    expect(await admin.$('.hof-plans [data-print="card"]') && (await admin.$eval('.hof-plans [data-pdf="card"]', node => node.getAttribute("href"))).endsWith("/ekstre.pdf"), "kartta PDF ve Yazdır");
    await admin.click('.hof-plans [data-item-filter="overdue"]');
    await admin.waitForFunction(() => document.querySelectorAll(".hof-plan-items tbody tr").length === 3 && document.querySelector('[data-item-filter="overdue"]')?.getAttribute("aria-pressed") === "true", null, { timeout: 5000 });
    await admin.click('.hof-plans [data-item-filter="all"]');
    await admin.click('.hof-plans [data-act="pay"]');
    await admin.waitForSelector('.hof-modal-backdrop.is-visible input[name="amount"]');
    const suggested = await admin.inputValue('.hof-modal-backdrop.is-visible input[name="amount"]');
    expect(suggested === "3.000,00", `önerilen tutar sıradaki taksit: ${suggested}`);
    await admin.fill('.hof-modal-backdrop.is-visible input[name="note"]', "Elden");
    await admin.click('.hof-modal-backdrop.is-visible .hof-form button[type="submit"]');
    await admin.waitForFunction(() => document.querySelector(".hof-plan-items tbody tr")?.classList.contains("is-paid"), null, { timeout: 10000 });
    const kpis = await admin.$eval(".hof-plans .hof-plans-kpis", node => node.innerText.replace(/\s+/g, " "));
    expect(kpis.includes("6.000,00"), `kalan 6.000: ${kpis}`);
    const entries = await admin.$$eval(".hof-plans-entries tbody tr", rows => rows.map(row => row.innerText.replace(/\s+/g, " ")));
    expect(entries.length === 1 && entries[0].includes("Elden") && entries[0].includes("3.000,00"), `hareketler: ${entries.join(" | ")}`);
    const receipt = await admin.$eval('.hof-plans-entries a[href*="makbuz.pdf"]', node => node.getAttribute("href"));
    expect(/\/api\/workspace\/plans\/.+\/entries\/.+\/makbuz\.pdf$/.test(receipt), `makbuz bağlantısı: ${receipt}`);
    await admin.screenshot({ path: path.join(artifacts, "04c-taksit-karti.png") });
    await admin.click('.hof-plans [data-act="back"]');
    await admin.waitForSelector(".hof-plans-table tbody tr[data-plan]", { timeout: 10000 });
    const listRow = await admin.$eval(".hof-plans-table tbody tr[data-plan]", node => node.innerText.replace(/\s+/g, " "));
    expect(listRow.includes("Ayşe Yılmaz") && listRow.includes("6.000,00"), `liste satırı: ${listRow}`);
    expect(/^1\b/.test(listRow.trim()), `listede ilk kolon sıra no: ${listRow}`);
    const listPdf = await admin.$eval('.hof-plans [data-pdf="list"]', node => node.getAttribute("href"));
    const pdfHead = await admin.evaluate(url => fetch(url).then(response => response.arrayBuffer()).then(buffer => new TextDecoder().decode(buffer.slice(0, 5))), listPdf);
    expect(pdfHead === "%PDF-" && /status=active/.test(listPdf) && /sort=no/.test(listPdf), `liste PDF'i süzgeçle: ${listPdf}`);
    await admin.click('.hof-plans [data-close]');
    await admin.waitForFunction(() => !document.querySelector(".hof-modal-backdrop"), null, { timeout: 5000 });
    const cash = (await admin.evaluate(() => fetch("/api/workspace/cash").then(response => response.json()))).data;
    const planEntry = cash.entries.find(entry => entry.source === "plan");
    expect(planEntry && planEntry.amount === 3000 && cash.totals.balance === 2800, `taksit tahsilatı kasada: ${JSON.stringify(cash.totals)}`);
    const dues = (await admin.evaluate(() => fetch("/api/workspace/dues").then(response => response.json()))).data;
    expect(dues.items.some(item => item.source === "plan" && item.state === "overdue" && item.person === "Ayşe Yılmaz"), "geciken taksit takvimde");
    const badge = await admin.$eval('#hof-sidecard [data-badge="plans"]', node => node.textContent);
    expect(badge === "1", `Taksitler rozeti: ${badge}`);
    // Kart kapatılınca uyarı vermez: şeritteki taksit pilleri kalkar, rozet sıfırlanır.
    await admin.click('#hof-sidecard [data-action="plans"]');
    await admin.waitForSelector(".hof-plans-table tbody tr[data-plan]", { timeout: 10000 });
    await admin.click(".hof-plans-table tbody tr[data-plan]");
    await admin.waitForSelector('.hof-plans [data-act="close"]', { timeout: 10000 });
    await admin.click('.hof-plans [data-act="close"]');
    await admin.waitForSelector('.hof-plans [data-act="reopen"]', { timeout: 10000 });
    await admin.click('.hof-plans [data-close]');
    await admin.waitForFunction(() => !document.querySelector(".hof-modal-backdrop") && ![...document.querySelectorAll(".hof-payment-pill")].some(pill => pill.textContent.includes("taksit")), null, { timeout: 10000 });
    await admin.waitForFunction(() => document.querySelector('#hof-sidecard [data-badge="plans"]')?.textContent === "", null, { timeout: 10000 });
  });

  await step("taksit kartı tablodaki kayda bağlanır; kişinin kartından taksit tahsilatı taksitten düşer ve Kasa'ya tek kayıt iner (v2.0.6)", async () => {
    // Taksit penceresini kapat, kaydı tabloda aç.
    if (await admin.$(".hof-plans [data-close]")) {
      await admin.click(".hof-plans [data-close]");
      await admin.waitForFunction(() => !document.querySelector(".hof-plans-modal"), null, { timeout: 5000 });
    }
    expect(await admin.evaluate(() => window.HOF.revealRecord("2026/101")), "kayıt tabloda açıldı");
    await admin.waitForFunction(() => window.HOF.selectedCase()?.key === "2026/101", null, { timeout: 8000 });
    // Plan yokken Tahsilat: eski pencere + "Taksit planı oluşturun" kısa yolu → kart formu kayda bağlı, ad kayıttan.
    await admin.click('.hof-case-actions [data-case-action="payment"]');
    await admin.waitForSelector(".hof-modal [data-new-plan]", { timeout: 8000 });
    await admin.click(".hof-modal [data-new-plan]");
    await admin.waitForSelector('.hof-plan-form input[name="caseKey"]', { state: "attached", timeout: 8000 });
    expect((await admin.inputValue('.hof-plan-form input[name="caseKey"]')) === "2026/101", "kart formu kayda bağlı açıldı");
    const prefilled = await admin.inputValue('.hof-plan-form input[name="name"]');
    expect(prefilled.length > 0, `ad kayıttan geldi: ${prefilled}`);
    expect(await admin.$eval(".hof-case-picker:not(.hof-acc-picker)", node => node.classList.contains("is-linked")), "arama kutusu bağlı görünümde");
    await admin.fill('.hof-plan-form input[name="total"]', "3.000");
    await admin.selectOption('.hof-plan-form select[name="items"]', "auto");
    await admin.fill('.hof-plan-form input[name="count"]', "3");
    await admin.fill('.hof-plan-form input[name="firstDue"]', "2026-02-05");
    await admin.click('.hof-plan-form button[type="submit"]');
    await admin.waitForSelector(".hof-plans .hof-plan-head", { timeout: 10000 });
    const facts = await admin.$eval(".hof-plans .hof-plan-profile", node => node.innerText.replace(/\s+/g, " "));
    expect(facts.toLocaleUpperCase("tr-TR").includes("TABLODAKİ KAYIT") && facts.includes("2026/101"), `kartta tablodaki kayıt: ${facts}`);
    await admin.click(".hof-plans [data-close]");
    await admin.waitForFunction(() => !document.querySelector(".hof-plans-modal"), null, { timeout: 5000 });
    // Kişinin kartında Taksit planı bölümü (3 taksit, kalan 3.000).
    await admin.waitForFunction(() => { const box = document.querySelector("#hof-case-plan"); return box && !box.hidden && box.querySelectorAll("tbody tr").length === 3; }, null, { timeout: 10000 });
    expect((await admin.$eval("#hof-case-plan", node => node.innerText)).includes("3.000,00"), "bölümde kalan 3.000");
    // Tahsilat → taksit seçici → 1. taksite Tahsil et → tutar taksit kadar hazır → kaydet.
    await admin.click('.hof-case-actions [data-case-action="payment"]');
    await admin.waitForSelector(".hof-plan-collect-modal [data-collect]", { timeout: 8000 });
    await admin.click('.hof-plan-collect-modal tbody tr:first-child [data-collect]');
    await admin.waitForSelector('.hof-modal-backdrop.is-visible input[name="amount"]', { timeout: 8000 });
    expect((await admin.inputValue('.hof-modal-backdrop.is-visible input[name="amount"]')) === "1.000,00", "tutar 1. taksit kadar hazır");
    await admin.click('.hof-modal-backdrop.is-visible .hof-form button[type="submit"]');
    await admin.waitForFunction(() => document.querySelector("#hof-activity")?.textContent.includes("taksit tahsilatı"), null, { timeout: 10000 });
    await admin.waitForFunction(() => document.querySelector("#hof-case-plan")?.textContent.includes("2.000,00"), null, { timeout: 10000 });
    const cash = (await admin.evaluate(() => fetch("/api/workspace/cash?period=all").then(response => response.json()))).data;
    expect(cash.entries.filter(entry => entry.amount === 1000 && entry.source === "plan").length === 1 && !cash.entries.some(entry => entry.amount === 1000 && entry.source === "payment"), "Kasa'da tek kayıt (taksit tahsilatı)");
    const activity = (await admin.evaluate(() => fetch("/api/workspace/cases/2026%2F101/activity").then(response => response.json()))).data;
    expect(activity.items.some(item => item.type === "plan-entry" && item.amount === 1000 && item.itemSeq === 1), "işlem geçmişinde 1. taksit tahsilatı");
    // Başka kayıtta bölüm görünmez (kayıtlar birbirine karışmaz); geri dönünce yeniden gelir.
    expect(await admin.evaluate(() => window.HOF.revealRecord("2026/103")), "başka kayda geçildi");
    await admin.waitForFunction(() => window.HOF.selectedCase()?.key === "2026/103" && (document.querySelector("#hof-case-plan")?.hidden ?? true), null, { timeout: 8000 });
    expect(await admin.evaluate(() => window.HOF.revealRecord("2026/101")), "kayda dönüldü");
    await admin.waitForFunction(() => window.HOF.selectedCase()?.key === "2026/101" && document.querySelector("#hof-case-plan")?.hidden === false, null, { timeout: 8000 });
    // Bölümdeki "Taksit kartını aç" kartı açar; kart kapatılınca bölüm kalkar (sonraki adımların takvimini etkilemesin).
    await admin.click("#hof-case-plan [data-open-plan]");
    await admin.waitForSelector('.hof-plans [data-act="close"]', { timeout: 10000 });
    await admin.click('.hof-plans [data-act="close"]');
    await admin.waitForSelector('.hof-plans [data-act="reopen"]', { timeout: 10000 });
    await admin.click(".hof-plans [data-close]");
    // v2.0.6 Cari: kart kapanınca taksit bölümü kalkar; kişinin carisi (bakiyesi) bölümde kalır.
    await admin.waitForFunction(() => !document.querySelector(".hof-modal-backdrop") && !document.querySelector("#hof-case-plan .hof-case-plan-head") && document.querySelector("#hof-case-plan .hof-case-account"), null, { timeout: 8000 });
  });

  await step("Cari (v2.0.6): tablodaki kişiler cari olur (kayda bağlı), cari tahsilatı Kasa'ya düşer; taksitli caride tahsilat taksite yazılır", async () => {
    await admin.evaluate(() => document.querySelectorAll(".hof-modal-backdrop").forEach(node => node.remove()));
    await admin.click('#hof-sidecard [data-action="accounts"]');
    await admin.waitForSelector(".hof-accounts-modal [data-act=fromTable]", { timeout: 10000 });
    await admin.click(".hof-accounts-modal [data-act=fromTable]");
    await admin.waitForSelector(".hof-import-form", { timeout: 10000 });
    await admin.click('.hof-import-form button[type="submit"]');
    await admin.waitForFunction(() => !document.querySelector(".hof-import-form"), null, { timeout: 10000 });
    const accounts = (await admin.evaluate(() => fetch("/api/workspace/accounts?status=all").then(response => response.json()))).data.accounts;
    const linked = accounts.filter(item => item.caseKey);
    expect(linked.length >= 3, `tablodan gelen cariler kayda bağlı: ${linked.length}`);
    expect(new Set(linked.map(item => item.caseKey)).size === linked.length, "her kayıt tek cariye bağlı (karışma yok)");
    // 2026/101: taksit kartıyla açılan cari, tablodan alımda ikinci kez açılmaz (aynı kayıt → atlanır).
    const planned = accounts.find(item => item.caseKey === "2026/101");
    expect(planned && accounts.filter(item => item.caseKey === "2026/101").length === 1, "2026/101 tek cari (taksit kartının carisi)");
    // Açık taksit kartı varken cari kartındaki Tahsilat önce "taksite mi?" diye sorar.
    const other = accounts.find(item => item.caseKey === "2026/103");
    await admin.evaluate(async account => {
      const response = await fetch("/api/workspace/plans", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ accountId: account.id, name: account.name, total: "1.200", mode: "auto", count: 2, firstDue: "2026-11-01" }) });
      if (!response.ok) throw new Error(await response.text());
    }, other);
    await admin.evaluate(id => window.HOF.accounts.open(id), other.id);
    await admin.waitForFunction(() => document.querySelector(".hof-accounts-modal .hof-plans-items tbody tr"), null, { timeout: 10000 });
    await admin.click('.hof-accounts-modal [data-entry="in"]');
    await admin.waitForSelector(".hof-acc-choices [data-plain]", { timeout: 8000 });
    expect((await admin.$$(".hof-acc-choices [data-plan]")).length === 1, "açık taksit kartı seçenek olarak gösterildi");
    await admin.click(".hof-acc-choices [data-plain]");
    await admin.waitForSelector('.hof-modal-backdrop.is-visible input[name="amount"]', { timeout: 8000 });
    await admin.fill('.hof-modal-backdrop.is-visible input[name="amount"]', "250");
    await admin.fill('.hof-modal-backdrop.is-visible input[name="note"]', "E2E cari tahsilat");
    await admin.click('.hof-modal-backdrop.is-visible .hof-form button[type="submit"]');
    await admin.waitForFunction(() => document.querySelector(".hof-accounts-modal .hof-plans-entries")?.textContent.includes("E2E cari tahsilat"), null, { timeout: 10000 });
    const cash = (await admin.evaluate(() => fetch("/api/workspace/cash?period=all").then(response => response.json()))).data;
    expect(cash.entries.filter(entry => entry.source === "account" && entry.amount === 250).length === 1, "cari tahsilatı Kasa'da tek kayıt");
    await admin.click(".hof-accounts-modal [data-close]");
    await admin.waitForFunction(() => !document.querySelector(".hof-accounts-modal"), null, { timeout: 5000 });
  });

  await step("Stok (v2.0.6): ürün açılır, çıkışla kritik seviyeye iner (rozet), Kasa'dan ödenen giriş Kasa'ya gider olarak düşer", async () => {
    await admin.click('#hof-sidecard [data-action="stock"]');
    await admin.waitForSelector(".hof-stock-modal [data-act=new]", { timeout: 10000 });
    await admin.click(".hof-stock-modal [data-act=new]");
    await admin.waitForSelector('.hof-modal-backdrop.is-visible input[name="name"]', { timeout: 8000 });
    await admin.fill('.hof-modal-backdrop.is-visible input[name="name"]', "Çay");
    // v2.0.8: birim bir seçim listesi; v2.0.11: baş harfleri büyük ve her birim tek kez (Kg, Lt, M²…).
    const units = await admin.$$eval('.hof-modal-backdrop.is-visible select[name="unit"] option', options => options.map(option => option.value));
    expect(["Adet", "Paket", "Koli", "Kg", "Lt", "Metre", "M²", "Saat"].every(unit => units.includes(unit)), `birim listesi geniş ve baş harfleri büyük (${units.length} seçenek)`);
    expect(new Set(units.map(unit => unit.toLocaleLowerCase("tr-TR"))).size === units.length, "birim listesinde aynı birim iki yazımla yok");
    await admin.selectOption('.hof-modal-backdrop.is-visible select[name="unit"]', "Paket");
    await admin.fill('.hof-modal-backdrop.is-visible input[name="minQty"]', "3");
    await admin.fill('.hof-modal-backdrop.is-visible input[name="unitPrice"]', "40");
    await admin.fill('.hof-modal-backdrop.is-visible input[name="openingQty"]', "5");
    // Kasa'ya kendiliğinden gider yazılmaz (kullanıcı kararı); "Kasa'ya yansıt" işaretlenince 5 × 40 = 200 Kasa'dan düşer.
    expect((await admin.textContent(".hof-modal-backdrop.is-visible [data-opening-total]")).includes("Kasa’ya yazılmaz"), "kutu işaretsizken Kasa'ya yazılmayacağı söylenir");
    await admin.check('.hof-modal-backdrop.is-visible input[name="openingCash"]');
    const openingText = await admin.textContent(".hof-modal-backdrop.is-visible [data-opening-total]");
    expect(openingText.includes("200,00") && openingText.includes("Stok ödemesi"), `yeni ürün: miktar × birim fiyat anında hesaplandı (${openingText})`);
    await admin.click('.hof-modal-backdrop.is-visible .hof-form button[type="submit"]');
    await admin.waitForSelector('.hof-stock-modal [data-move="out"]', { timeout: 10000 });
    await admin.click('.hof-stock-modal [data-move="out"]');
    await admin.waitForSelector('.hof-modal-backdrop.is-visible input[name="qty"]', { timeout: 8000 });
    await admin.fill('.hof-modal-backdrop.is-visible input[name="qty"]', "3");
    await admin.click('.hof-modal-backdrop.is-visible .hof-form button[type="submit"]');
    await admin.waitForFunction(() => document.querySelector('#hof-sidecard [data-badge="stock"]')?.textContent === "1", null, { timeout: 10000 });
    await admin.click('.hof-stock-modal [data-move="in"]');
    await admin.waitForSelector('.hof-modal-backdrop.is-visible input[name="qty"]', { timeout: 8000 });
    await admin.fill('.hof-modal-backdrop.is-visible input[name="qty"]', "10");
    await admin.fill('.hof-modal-backdrop.is-visible input[name="unitPrice"]', "50");
    await admin.selectOption('.hof-modal-backdrop.is-visible select[name="pay"]', "cash");
    expect((await admin.textContent(".hof-modal-backdrop.is-visible [data-total]")).includes("500,00"), "tutar anında hesaplandı (10 × 50)");
    await admin.click('.hof-modal-backdrop.is-visible .hof-form button[type="submit"]');
    await admin.waitForFunction(() => document.querySelector('#hof-sidecard [data-badge="stock"]')?.textContent === "", null, { timeout: 10000 });
    const cash = (await admin.evaluate(() => fetch("/api/workspace/cash?period=all").then(response => response.json()))).data;
    expect(cash.entries.some(entry => entry.source === "stock" && entry.kind === "out" && entry.amount === 500), "stok alımı Kasa'ya gider");
    expect(cash.entries.some(entry => entry.source === "stock" && entry.kind === "out" && entry.amount === 200 && /^Stok ödemesi/.test(entry.description)), "yeni ürünün ilk alımı Kasa'ya 'Stok ödemesi' gideri");
    const stock = (await admin.evaluate(() => fetch("/api/workspace/stock").then(response => response.json()))).data;
    expect(stock.items.find(item => item.name === "Çay")?.qty === 12, "mevcut 5 − 3 + 10 = 12");
    await admin.click(".hof-stock-modal [data-close]");
    await admin.waitForFunction(() => !document.querySelector(".hof-stock-modal"), null, { timeout: 5000 });
  });

  await step("ANLIK DURUM (v2.0.7): kart canlı; arayüzden tahsil edilen çek Kasa'yı anında değiştirir; Rapor Al, nakit akışı grafiği, rapor merkezi PDF/Excel; kart küçülür ve öyle kalır", async () => {
    await admin.waitForSelector("#hof-pulse .hof-pulse-tile", { timeout: 15000 });
    const tiles = await admin.$$eval("#hof-pulse .hof-pulse-tile", nodes => nodes.map(node => node.dataset.pulseGo));
    expect(tiles.join(",") === "cash,stock,receivable,payable", `kart kutuları: ${tiles}`);
    const overview = async () => (await admin.evaluate(() => fetch("/api/workspace/overview").then(response => response.json()))).data;
    const tileText = id => admin.$eval(`#hof-pulse [data-pulse-go="${id}"] .hof-pulse-value`, node => node.textContent.replace(/\s+/g, ""));
    const before = await overview();
    const cashShown = await tileText("cash");
    const receivableShown = await tileText("receivable");
    const due = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10);
    const cheque = await admin.evaluate(async dueDate => {
      const response = await fetch("/api/workspace/cheques", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ direction: "in", instrument: "cheque", serialNo: "E2E-1", bank: "Deneme Bankası", drawer: "E2E Keşideci", amount: "1.750", dueDate }) });
      if (!response.ok) throw new Error(await response.text());
      return (await response.json()).data;
    }, due);
    // Portföye giren çek alacağı artırır; kart sayfa yenilenmeden değişir.
    await admin.waitForFunction(previous => document.querySelector('#hof-pulse [data-pulse-go="receivable"] .hof-pulse-value')?.textContent.replace(/\s+/g, "") !== previous, receivableShown, { timeout: 10000 });
    expect(Math.abs((await overview()).receivable.total - before.receivable.total - 1750) < 0.005, "alacak 1.750 arttı");
    await admin.click('#hof-sidecard [data-action="cheques"]');
    await admin.waitForSelector(`.hof-chq-table tr[data-cheque="${cheque.id}"]`, { timeout: 10000 });
    await admin.click(`.hof-chq-table tr[data-cheque="${cheque.id}"]`);
    await admin.waitForSelector(".hof-chq-actions [data-action='collect']", { timeout: 10000 });
    await admin.click(".hof-chq-actions [data-action='collect']");
    await admin.waitForSelector('.hof-modal-backdrop.is-visible form input[name="date"]', { timeout: 8000 });
    await admin.click('.hof-modal-backdrop.is-visible form button[type="submit"]');
    await admin.waitForFunction(() => document.querySelector(".hof-chq-history")?.textContent.includes("Tahsil Edildi"), null, { timeout: 10000 });
    await admin.keyboard.press("Escape");
    await admin.waitForFunction(previous => document.querySelector('#hof-pulse [data-pulse-go="cash"] .hof-pulse-value')?.textContent.replace(/\s+/g, "") !== previous, cashShown, { timeout: 10000 });
    const after = await overview();
    expect(Math.abs(after.cash.balance - before.cash.balance - 1750) < 0.005, `Kasa 1.750 arttı: ${before.cash.balance} → ${after.cash.balance}`);
    expect(Math.abs(after.receivable.total - before.receivable.total) < 0.005, "tahsil edilen çek alacaktan çıktı");
    const kasa = (await admin.evaluate(() => fetch("/api/workspace/cash?period=all").then(response => response.json()))).data;
    expect(Math.abs(kasa.totals.balance - after.cash.balance) < 0.005 && kasa.entries.some(entry => entry.source === "cheque" && entry.amount === 1750), "kart = Kasa ekranı; çek tahsili Kasa'da");
    // Rapor Al: mizan → nakit akışı (grafik) → Detaylı raporlar (rapor merkezi).
    await admin.click("#hof-pulse [data-pulse='report']");
    await admin.waitForSelector(".hof-rep .hof-rep-mizan tbody tr", { timeout: 10000 });
    await admin.click('.hof-rep [data-tab="flow"]');
    await admin.waitForSelector(".hof-rep [data-chart] svg .hof-chart-line", { state: "attached", timeout: 10000 });
    const ticks = await admin.$$eval(".hof-rep [data-chart] .hof-chart-tick", nodes => nodes.map(node => node.textContent));
    expect(ticks.some(text => text === "0 ₺"), `eksen sıfırı içerir: ${ticks.join(" | ")}`);
    await admin.screenshot({ path: path.join(artifacts, "04e-nakit-akisi.png") });
    // v2.0.9: rapor merkezi aynı pencerenin "Tüm raporlar" sekmesidir.
    await admin.click('.hof-rep [data-tab="all"]');
    const catalog = (await admin.evaluate(() => fetch("/api/workspace/report-center").then(response => response.json()))).data;
    await admin.waitForFunction(count => document.querySelectorAll(".hof-rc-item").length === count, catalog.reports.length, { timeout: 10000 });
    await admin.click('.hof-rc-item[data-report="cek-hareketleri"]');
    await admin.waitForFunction(() => document.querySelector(".hof-rc-table")?.textContent.includes("E2E-1"), null, { timeout: 10000 });
    const links = await admin.$$eval(".hof-rc-head .hof-rep-out", nodes => nodes.map(node => node.getAttribute("href")));
    const files = await admin.evaluate(async hrefs => Promise.all(hrefs.map(async href => {
      const response = await fetch(href);
      const bytes = new Uint8Array(await response.arrayBuffer());
      return { status: response.status, type: response.headers.get("content-type"), head: String.fromCharCode(...bytes.slice(0, 4)) };
    })), links);
    expect(files[0].status === 200 && files[0].head === "%PDF", `PDF: ${JSON.stringify(files[0])}`);
    expect(files[1].status === 200 && files[1].head.startsWith("PK"), `Excel: ${JSON.stringify(files[1])}`);
    await admin.screenshot({ path: path.join(artifacts, "04f-rapor-merkezi.png") });
    await admin.keyboard.press("Escape");
    await admin.waitForFunction(() => !document.querySelector(".hof-modal-backdrop.is-visible"), null, { timeout: 5000 });
    // Küçült: tek satırlık şerit; sayfa yenilense de öyle kalır; Rapor Al yerinde.
    await admin.click("#hof-pulse [data-pulse='toggle']");
    await admin.waitForSelector("#hof-pulse.is-collapsed [data-pulse='report']", { timeout: 5000 });
    await admin.reload();
    await waitForApp(admin);
    await admin.waitForSelector("#hof-pulse.is-collapsed .hof-pulse-mini", { timeout: 15000 });
    await admin.click("#hof-pulse [data-pulse='toggle']");
    await admin.waitForSelector("#hof-pulse:not(.is-collapsed) .hof-pulse-tile", { timeout: 5000 });
  });

  await step("detaydaki 'Notu Kaydet' merkezi sunucuya yazılır", async () => {
    await admin.fill(".note-section textarea", "Merkezi not denemesi");
    await admin.click(".note-section .save-note");
    await admin.waitForTimeout(600);
    const notes = app.store.all("SELECT case_key, note FROM case_notes");
    expect(notes.some(item => item.note === "Merkezi not denemesi"), `notlar: ${JSON.stringify(notes)}`);
  });

  await step("tahsilat takvimi şeridi ödeme sözlerini gösterir; söz 'ödendi say' ile kapanır", async () => {
    await admin.waitForSelector(".hof-payment-promises .hof-payment-pill");
    const pills = await admin.$$eval(".hof-payment-promises .hof-payment-pill:not([aria-hidden])", nodes => nodes.map(node => node.innerText.replace(/\s+/g, " ")));
    expect(pills.length === 3 && pills.every(text => text.includes("Ödeme sözü")), `söz pilleri: ${pills.join(" | ")}`);
    await admin.hover(".hof-payment-promises-viewport");
    await admin.$eval(".hof-payment-promises .hof-payment-pill:not([aria-hidden])", node => node.click());
    await admin.click('.hof-payment-action-card [data-act="paid"]');
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
    expect(auditText.includes("Sektörü değiştirdi") && auditText.includes("İcra ve Alacak Takibi (analiz önerisi onaylandı)"), "sektör değişikliği geçmişte");
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
    // Personelde ANLIK DURUM yok; üst satır hiç yer kaplamaz (v2.0.10), özet kartları en üstte.
    const view = await staff.evaluate(() => ({ welcome: getComputedStyle(document.querySelector(".welcome-row")).display, pencils: document.querySelectorAll(".hof-label-pencil").length, subtitle: document.querySelector(".brand-subtitle")?.firstChild?.nodeValue }));
    expect(view.welcome === "none" && view.subtitle === "Hukuk Ofisi Yönetimi" && view.pencils === 0, `personel görünümü: ${JSON.stringify(view)}`);
  });

  await step("operasyon merkezi düğme adları köşedeki kalemle değişir; tüm bilgisayarlara yansır, personel kalemi görmez", async () => {
    await admin.goto(BASE + "/");
    await waitForApp(admin);
    await admin.hover("#hof-sidecard");
    await admin.click("#hof-sidecard .hof-sidecard-edit");
    await admin.waitForSelector(".hof-modal-backdrop.is-visible .hof-side-editor-reset");
    const field = label => admin.locator(".hof-modal .hof-field", { hasText: label }).locator("input").first();
    await field("Görevler").fill("İşlerim");
    await field("Kasa").fill("Vezne");
    await admin.screenshot({ path: path.join(artifacts, "04c-operasyon-adlari.png") });
    await admin.click('.hof-modal button[type="submit"]');
    await admin.waitForFunction(() => document.querySelector('#hof-sidecard [data-action="cash"] .hof-side-text')?.textContent === "Vezne", null, { timeout: 10000 });
    await staff.waitForFunction(() => document.querySelector('#hof-sidecard [data-action="tasks"] .hof-side-text')?.textContent === "İşlerim", null, { timeout: 15000 });
    const staffPencil = await staff.$eval("#hof-sidecard .hof-sidecard-edit", node => getComputedStyle(node).display);
    expect(staffPencil === "none", `personel kalemi görmemeli: ${staffPencil}`);
    await admin.click("#hof-sidecard .hof-sidecard-edit");
    await admin.waitForSelector(".hof-modal-backdrop.is-visible [data-reset-all]");
    await admin.click(".hof-modal [data-reset-all]");
    await admin.click('.hof-modal button[type="submit"]');
    await admin.waitForFunction(() => document.querySelector('#hof-sidecard [data-action="cash"] .hof-side-text')?.textContent === "Kasa", null, { timeout: 10000 });
  });

  await step("personel kaynak menülerini göremez, satır silemez", async () => {
    const hiddenNav = await staff.$$eval(".sidebar .nav-item", items => items.filter(item => ["Tabloyu değiştir", "Ayarlar"].includes(item.textContent.trim())).every(item => item.style.display === "none"));
    expect(hiddenNav, "kaynak menüleri gizli olmalı");
    expect(!(await staff.$("#hof-side-settings")), "personelde kullanıcı kartı altında Ayarlar yok");
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

  await step("ANLIK DURUM kartı yalnız yöneticide (v2.0.10); yetki panelinden 'Finans raporları' verilince personelde Raporlar sayfa yenilenmeden açılır, kart açılmaz; geri alınınca kapanır", async () => {
    expect(!(await staff.$("#hof-pulse")), "personel kartı görmemeli");
    expect(!(await staff.isVisible('#hof-sidecard [data-action="cheques"]')), "Çek / Senet menüsü personelde gizli");
    const denied = await staff.evaluate(() => fetch("/api/workspace/overview").then(response => response.status));
    expect(denied === 403, `personel ANLIK DURUM verisini alamaz: ${denied}`);
    const reportsShown = () => staff.evaluate(() => {
      const node = document.querySelector('#hof-sidecard [data-action="analytics"]');
      return Boolean(node) && getComputedStyle(node).display !== "none";
    });
    expect(!(await reportsShown()), "personelde Raporlar kapalı");
    await admin.goto(BASE + "/admin.html");
    await admin.waitForSelector("#adm-users tr[data-id]");
    const setFinance = async on => {
      await admin.locator("#adm-users tr[data-id]", { hasText: "deniz" }).locator("[data-perms]").click();
      await admin.waitForSelector(".adm-perm-row .adm-perm-panel");
      const box = admin.locator('.adm-perm-row [data-perm="overview.view"]');
      if (on) await box.check();
      else await box.uncheck();
      expect(await admin.isDisabled('.adm-perm-row [data-perm="overview.card"]'), "ANLIK DURUM kartı kişiye verilemez (kilitli)");
      if (on) await admin.screenshot({ path: path.join(artifacts, "06b-yetki-paneli.png") });
      await admin.click(".adm-perm-row [data-perm-save]");
      await admin.waitForSelector(".adm-perm-row", { state: "detached", timeout: 8000 });
    };
    await setFinance(true);
    await staff.waitForFunction(() => {
      const node = document.querySelector('#hof-sidecard [data-action="analytics"]');
      return Boolean(node) && getComputedStyle(node).display !== "none";
    }, null, { timeout: 15000 });
    expect(!(await staff.$("#hof-pulse")), "ek yetki ANLIK DURUM kartını açmaz");
    const codes = await staff.evaluate(async () => [(await fetch("/api/workspace/overview")).status, (await fetch("/api/workspace/overview/mizan?preset=thisMonth")).status]);
    expect(codes.join() === "403,200", `kart 403, raporlar 200: ${codes}`);
    await staff.screenshot({ path: path.join(artifacts, "06b-personel-raporlar.png") });
    await setFinance(false);
    await staff.waitForFunction(() => {
      const node = document.querySelector('#hof-sidecard [data-action="analytics"]');
      return !node || getComputedStyle(node).display === "none";
    }, null, { timeout: 15000 });
  });

  await step("yönetici görev atar, personel sayfayı yenilemeden rozet ve bildirim alır, tamamlar", async () => {
    await admin.goto(BASE + "/");
    await waitForApp(admin);
    await admin.click('#hof-sidecard [data-action="newTask"]');
    await admin.fill('.hof-modal input[name="title"]', "Tebligatı kontrol et");
    // v2.0.10: atanacak kişi açılır listeden (tüm kullanıcılar, rolüyle) seçilir.
    const people = await admin.$$eval('.hof-modal select[name="assigneeId"] option', nodes => nodes.map(node => node.textContent));
    await admin.selectOption('.hof-modal select[name="assigneeId"]', { label: people.find(item => item.startsWith("Av. Deniz Yıldırım")) });
    await admin.selectOption('.hof-modal select[name="priority"]', "urgent");
    await admin.click('.hof-modal button[type="submit"]');
    await admin.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(node => node.textContent.includes("Görev atandı")));
    // Canlı kanal: personel ekranı yenilemeden rozeti ve "size görev atadı" bildirimini görür.
    await staff.waitForFunction(() => document.querySelector('[data-badge="tasks"]')?.textContent === "1", null, { timeout: 10000 });
    await staff.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(node => node.textContent.includes("size acil görev atadı")), null, { timeout: 10000 });
    // v2.0.5: acil görev kırmızı: bildirim hata tonunda, rozet kırmızı, zil listesinde "Acil görevler" en üstte.
    expect(await staff.$eval('.hof-toast:has-text("acil görev atadı")', node => node.classList.contains("hof-toast-error")), "acil görev bildirimi kırmızı olmalı");
    await staff.waitForFunction(() => document.querySelector('[data-badge="tasks"]')?.classList.contains("hof-badge-danger"), null, { timeout: 10000 });
    await staff.waitForFunction(() => window.HOF.alerts.list()[0]?.urgent === true && window.HOF.alerts.list()[0].tone === "late" && /ACİL GÖREV/.test(window.HOF.alerts.list()[0].eyebrow), null, { timeout: 10000 });
    await staff.click('#hof-sidecard [data-action="tasks"]');
    await staff.waitForSelector(".hof-modal [data-complete]");
    expect(await staff.$eval(".hof-modal .hof-list-item", node => node.classList.contains("is-urgent")), "görev listesinde acil görev kırmızı olmalı");
    const tabs = await staff.$$eval(".hof-modal [data-view]", nodes => nodes.map(node => node.textContent));
    expect(tabs.join("|") === "Açık Görevlerim|Tamamladıklarım", `personel yalnızca kendi görevlerini görmeli: ${tabs}`);
    expect(!(await staff.$(".hof-modal [data-new]")), "personel yeni görev açamamalı");
    await staff.click(".hof-modal [data-complete]");
    await staff.waitForFunction(() => document.querySelector(".hof-modal [data-list]")?.textContent.includes("açık görev yok"));
    await staff.waitForFunction(() => !document.querySelector('[data-badge="tasks"]')?.classList.contains("hof-badge-danger"), null, { timeout: 10000 });
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
    await admin.click("#hof-side-settings"); // v2.0.11: Ayarlar kullanıcı kartının altında
    await admin.waitForSelector(".hof-modal-backdrop.is-visible .hof-data-summary");
    const input = await admin.$(".hof-modal .hof-drop input[type=file]");
    await input.setInputFiles(path.join(here, "..", "fixtures", "bolumlu-sayfalar.xlsx"));
    await admin.waitForSelector(".hof-modal-backdrop.is-visible .hof-choice-grid", { timeout: 20000 });
    const choice = await admin.$eval(".hof-choice-grid", node => node.innerText.replace(/\s+/g, " "));
    expect(choice.includes("52 yeni kayıt eklenir") && choice.includes("Yeni dosyada olmayan 30 kayıt tablodan kalkar"), `önizleme: ${choice}`);
    // v2.0.2: okuma raporu — kapsam, kayıt sayılmayan satırlar (alt tablo başlıkları) ve nedenleri yüklemeden önce görünür.
    const reading = await admin.$eval(".hof-modal-backdrop.is-visible .hof-reading", node => node.innerText.replace(/\s+/g, " "));
    expect(/Okuma raporu: hücrelerin %\d+'i kayda girdi/i.test(reading) && /kayıt sayılmadı/.test(reading) && /başlık/.test(reading), `okuma raporu: ${reading}`);
    await admin.click(".hof-modal-backdrop.is-visible .hof-reading summary");
    const skippedLines = await admin.$$eval(".hof-modal-backdrop.is-visible .hof-reading li", nodes => nodes.map(node => node.innerText.replace(/\s+/g, " ")));
    expect(skippedLines.length >= 3 && skippedLines.every(line => /\d+\. satır/.test(line)), `atlanan satırlar: ${skippedLines.slice(0, 3).join(" | ")}`);
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
    await admin.click("#hof-side-settings"); // v2.0.11: Ayarlar kullanıcı kartının altında
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

  await step("farklı konudaki Excel yeni oturumda açılır; adı seçicide değişir, oturumlar arasında geçilir, diğer kullanıcının ekranı değişmez", async () => {
    await staff.evaluate(() => document.querySelectorAll(".hof-toast").forEach(node => node.remove()));
    await admin.click("#hof-side-settings"); // v2.0.11: Ayarlar kullanıcı kartının altında
    await admin.waitForSelector(".hof-modal-backdrop.is-visible #hof-session-section");
    const input = await admin.$(".hof-modal .hof-drop input[type=file]");
    await input.setInputFiles(path.join(here, "..", "fixtures", "formullu-taksitler.xlsx"));
    await admin.waitForSelector(".hof-modal-backdrop.is-visible .hof-choice-session.is-recommended", { timeout: 20000 });
    const alert = await admin.$eval(".hof-modal-backdrop.is-visible .hof-alert", node => node.textContent);
    expect(alert.includes("farklı bir konuda"), `farklı konu uyarısı: ${alert}`);
    await admin.fill(".hof-modal-backdrop.is-visible [data-session-name]", "Taksit takibi");
    await admin.screenshot({ path: path.join(artifacts, "08b-yeni-oturum.png") });
    await Promise.all([admin.waitForEvent("load", { timeout: 30000 }), admin.press(".hof-modal-backdrop.is-visible [data-session-name]", "Enter")]);
    await waitForApp(admin);
    await admin.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
    await admin.click(".hof-analysis-result [data-apply], .hof-analysis-result [data-done]");
    await admin.waitForFunction(() => !document.querySelector(".hof-modal-backdrop"), null, { timeout: 8000 });
    await admin.waitForFunction(() => document.querySelector("#hof-session .hof-session-text strong")?.textContent === "Taksit takibi", null, { timeout: 10000 });
    const count = await admin.$eval("#hof-session .hof-session-count", node => node.getAttribute("aria-label"));
    expect(count === "2 oturum var", `seçici: ${count}`);
    await admin.waitForFunction(() => [...document.querySelectorAll(".dynamic-table tbody tr")].some(row => row.textContent.includes("Ali Veli")), null, { timeout: 10000 });
    // Personel kendi oturumunda kalır; yeni oturum açıldığını bildirimden öğrenir.
    await staff.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(node => node.textContent.includes("yeni bir oturum açtı")), null, { timeout: 10000 });
    expect(!(await staff.$$eval(".dynamic-table tbody tr", rows => rows.some(row => row.textContent.includes("Ali Veli")))), "personelin tablosuna yeni oturum karışmamalı");
    // Seçicide adı kalemle değişir.
    await admin.click("#hof-session [data-toggle]");
    await admin.waitForSelector("#hof-session .hof-session-menu:not([hidden])");
    const names = await admin.$$eval("#hof-session .hof-session-info b", nodes => nodes.map(node => node.textContent));
    expect(names.length === 2 && names[1] === "Taksit takibi", `oturumlar: ${names}`);
    await admin.screenshot({ path: path.join(artifacts, "08c-oturum-secici.png") });
    await admin.click("#hof-session .hof-session-row.is-current [data-rename]");
    await admin.fill("#hof-session .hof-session-edit input", "Taksitler 2026");
    await admin.press("#hof-session .hof-session-edit input", "Enter");
    await admin.waitForFunction(() => document.querySelector("#hof-session .hof-session-text strong")?.textContent === "Taksitler 2026", null, { timeout: 8000 });
    // İlk oturuma dönülür: önceki tablo olduğu gibi durur.
    await Promise.all([admin.waitForEvent("load", { timeout: 30000 }), admin.click("#hof-session .hof-session-row:not(.is-current) .hof-session-pick")]);
    await waitForApp(admin);
    const flash = await toastText(admin);
    expect(flash.includes("oturumuna geçtiniz"), `bildirim: ${flash}`);
    const dataset = (await admin.evaluate(() => fetch("/api/workspace/dataset").then(response => response.json()))).data;
    expect(dataset.rowCount === 54, `ilk oturum kayıtları: ${dataset.rowCount}`);
    await admin.waitForFunction(() => document.querySelectorAll(".dynamic-table tbody tr").length > 0, null, { timeout: 10000 });
    expect(!(await admin.$$eval(".dynamic-table tbody tr", rows => rows.some(row => row.textContent.includes("Ali Veli")))), "ilk oturuma taksit verisi karışmamalı");
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
      expect(tagline === "Ofis Yönetimi", `yeni kurulum giriş alt başlığı: ${tagline}`);
      await page.fill("#hof-auth input[name=username]", "admin");
      await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
      await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
      await page.waitForSelector("#hof-start .hof-drop");
      const input = await page.$("#hof-start .hof-drop input[type=file]");
      await firstUpload(page, input, path.join(here, "..", "fixtures", "klinik.xlsx"));
      await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
      const result = await page.$eval(".hof-analysis-result", node => node.innerText.replace(/\s+/g, " "));
      expect(result.includes("Klinik ve Poliklinik") && result.includes("Hekim"), `klinik önerisi: ${result}`);
      await page.click(".hof-analysis-result [data-apply]");
      await page.waitForFunction(() => document.querySelector(".brand-subtitle")?.firstChild?.nodeValue === "Klinik Yönetimi", null, { timeout: 5000 });
      await page.locator(".dynamic-table tbody tr td").first().click({ position: { x: 12, y: 10 } });
      const view = await page.evaluate(() => ({
        summary: document.querySelector(".welcome-row .section-title")?.firstChild?.nodeValue,
        newRecord: document.querySelector('[data-action="newRecord"] .hof-side-text')?.textContent,
        liens: getComputedStyle(document.querySelector('#hof-sidecard [data-action="liens"]')).display,
        lienAction: getComputedStyle(document.querySelector('.hof-case-actions [data-case-action="lien"]')).display,
        search: document.querySelector(".search-field input")?.placeholder,
        keys: [...document.querySelectorAll(".dynamic-table tbody tr")].slice(0, 2).map(row => row.dataset.hofKey),
      }));
      expect(view.summary === "Hasta Özeti" && view.newRecord === "Yeni Kayıt" && view.liens === "none" && view.lienAction === "none", `klinik görünümü: ${JSON.stringify(view)}`);
      expect(view.search === "Hasta no, ad soyad veya telefon ara…", `arama ipucu: ${view.search}`);
      expect(view.keys.join() === "H-1001,H-1002", `kayıt kimlikleri kimlik kolonundan: ${view.keys}`);
      await page.screenshot({ path: path.join(artifacts, "10-klinik.png") });
    } finally {
      await context.close();
      await clinicApp.close();
      rmSync(clinicRoot, { recursive: true, force: true });
    }
  });

  await step("okul servisi: sektör tanınır; ödenmeyen aylar şeritte ve sağ alt bildirimde; pilden tahsilat girilince pil kaybolur; belge son günleri zilde; kasa aralığı PDF iner", async () => {
    const schoolRoot = mkdtempSync(path.join(tmpdir(), "destekofis-e2e-okul-"));
    const schoolFile = path.join(schoolRoot, "okul-servisi-ornek.xlsx");
    writeFileSync(schoolFile, okulServisiXlsx());
    const schoolApp = createApp({ dataDir: path.join(schoolRoot, "data"), backupDir: path.join(schoolRoot, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, license: unlicensed });
    const schoolPort = (await schoolApp.listen(0, "127.0.0.1")).port;
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR", acceptDownloads: true });
    try {
      const page = await context.newPage();
      page.on("pageerror", error => problems.push(`[okul] pageerror: ${error.message}`));
      await page.goto(`http://127.0.0.1:${schoolPort}/`);
      await page.fill("#hof-auth input[name=username]", "admin");
      await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
      await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
      await page.waitForSelector("#hof-start .hof-drop");
      const input = await page.$("#hof-start .hof-drop input[type=file]");
      await firstUpload(page, input, schoolFile);
      await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
      const result = await page.$eval(".hof-analysis-result", node => node.innerText.replace(/\s+/g, " "));
      expect(result.includes("Okul Servisi"), `okul servisi önerisi: ${result}`);
      // v2.0.8: yükleme sonrası "ödeme planları Taksitler'e aktarılsın mı?" bildirimi (engellemeyen; düğmesi pencereyi açar).
      // Bildirimler pencerelerin altında kaldığından soru, akıllı analiz penceresi kapanınca gelir.
      await page.waitForTimeout(3500);
      expect(!(await page.evaluate(() => [...document.querySelectorAll(".hof-toast")].some(node => /Taksitler'e aktarılsın mı/.test(node.textContent)))), "analiz penceresi açıkken aktarma sorusu sorulmaz");
      await page.click(".hof-analysis-result [data-apply]");
      await page.waitForFunction(() => document.querySelector(".brand-subtitle")?.firstChild?.nodeValue === "Okul Servisi Yönetimi", null, { timeout: 5000 });
      await page.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(node => /Taksitler'e aktarılsın mı/.test(node.textContent) && /6 kişinin ödeme planı/.test(node.textContent)), null, { timeout: 20000 });
      expect(await page.$('.hof-toast:has-text("Taksitler\'e aktarılsın mı") .hof-toast-action'), "bildirimde 'Ön izle ve aktar' düğmesi var");
      await page.evaluate(() => document.querySelectorAll(".hof-toast").forEach(node => node.remove()));

      // v2.0.2: durum/kategori hücreleri renkli nokta alır (analiz gelince); sık görünüm düğmesi satırları daraltır ve hatırlanır.
      await page.waitForSelector(".dynamic-table td[data-tone]", { timeout: 15000 });
      const tones = await page.$$eval(".dynamic-table td[data-tone]", nodes => nodes.map(node => `${node.textContent.trim()}=${node.dataset.tone}`));
      expect(tones.some(item => /^Aktif=good$/.test(item)), `durum renkleri: ${tones.slice(0, 6).join(" | ")}`);
      const rowBefore = await page.$eval(".dynamic-table tbody tr", node => node.getBoundingClientRect().height);
      await page.click(".cases-panel .hof-density");
      await page.waitForFunction(() => document.body.classList.contains("hof-dense"), null, { timeout: 3000 });
      const rowAfter = await page.$eval(".dynamic-table tbody tr", node => node.getBoundingClientRect().height);
      expect(rowAfter < rowBefore, `sık görünüm satırı daraltır: ${rowBefore} → ${rowAfter}`);
      expect((await page.evaluate(() => localStorage.getItem("hof.density"))) === "dense", "sıklık tercihi hatırlanır");
      await page.click(".cases-panel .hof-density");

      // Şerit: geçen ayın ödenmeyen ücretleri gecikmiş, bu ayınkiler "bu ay"; gelecek ay beklenmez.
      await page.waitForSelector(".hof-payment-promises .hof-payment-pill", { timeout: 10000 });
      const heading = await page.$eval(".hof-payment-promises-heading", node => node.innerText.replace(/\s+/g, " "));
      expect(/2 gecikmiş/.test(heading) && /4 bugün\/bu ay/.test(heading), `şerit başlığı: ${heading}`);
      const pills = await page.$$eval(".hof-payment-pill:not([aria-hidden])", nodes => nodes.map(node => node.innerText.replace(/\s+/g, " ")));
      expect(pills.some(text => text.includes("Can Öztürk") && text.includes("1.900")), `kısmi ödeme kalanı: ${pills.join(" | ")}`);

      // Sağ alt bildirim: tek tek, kim/hangi ay/ne kadar yazar.
      await page.waitForSelector(".hof-notice.is-visible", { timeout: 10000 });
      const notice = await page.$eval(".hof-notice", node => node.innerText.replace(/\s+/g, " "));
      expect(/TAHSİLAT ALINMADI/.test(notice) && /₺/.test(notice), `bildirim: ${notice}`);
      expect((await page.$$(".hof-notice")).length === 1, "bildirimler üst üste binmez");
      // v2.0.2: iş yapıldıysa "Gerçekleştirildi" (ilgili hücreye yazar); kart 20 sn görünür.
      expect(/Gerçekleştirildi/.test(notice) && /hücresine/.test(notice), `Gerçekleştirildi düğmesi: ${notice}`);
      expect((await page.$eval(".hof-notice", node => node.style.getPropertyValue("--hof-notice-ms"))) === "20000ms", "20 saniye");
      await page.screenshot({ path: path.join(artifacts, "10b-okul-servisi.png") });
      await page.evaluate(() => document.querySelectorAll(".hof-notice").forEach(node => node.remove()));

      // Pilden tahsilat: tutar hazır gelir; kaydedince pil kaybolur.
      const target = await page.$eval(".hof-payment-pill:not([aria-hidden])", node => node.querySelector("b").textContent);
      const before = pills.length;
      await page.$eval(".hof-payment-pill:not([aria-hidden])", node => node.click());
      await page.click('.hof-payment-action-card [data-act="pay"]');
      await page.waitForSelector('.hof-modal-backdrop.is-visible input[name="amount"]');
      const amount = await page.inputValue('.hof-modal input[name="amount"]');
      expect(Number(amount.replace(/\./g, "").replace(",", ".")) > 0, `tutar hazır gelmeli: ${amount}`);
      await page.click('.hof-modal button[type="submit"]');
      await page.waitForFunction(count => document.querySelectorAll(".hof-payment-pill:not([aria-hidden])").length === count - 1, before, { timeout: 10000 });

      // Zil: belge son günleri (araç plakasıyla) ve alınmayan tahsilatlar gruplu listelenir.
      await page.click(".topbar .top-actions > .icon-button");
      await page.waitForSelector(".hof-alert-list");
      const panel = await page.$eval(".hof-alert-list", node => node.innerText.replace(/\s+/g, " "));
      expect(panel.includes("Tahsilat alınmadı") && panel.includes("34 SRV 101") && panel.includes("Muayene"), `zil listesi: ${panel.slice(0, 400)}`);
      await page.keyboard.press("Escape");

      // Kasa: tarih aralığı seçilir, PDF iner.
      await page.evaluate(() => HOF.workspace.openCash());
      await page.waitForSelector(".hof-cash-table");
      await page.click('.hof-modal [data-period="range"]');
      const today = new Date();
      const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      await page.fill(".hof-modal [data-from]", iso(new Date(today.getFullYear(), today.getMonth(), 1)));
      await page.$eval(".hof-modal [data-from]", node => node.dispatchEvent(new Event("change", { bubbles: true })));
      await page.waitForFunction(() => document.querySelectorAll(".hof-cash-table tbody tr:not(.hof-cash-opening)").length === 1, null, { timeout: 10000 });
      const ledger = await page.$eval(".hof-cash-table tbody tr:not(.hof-cash-opening)", node => node.innerText);
      expect(ledger.includes(target), `kasa satırı: ${ledger}`);
      const [download] = await Promise.all([page.waitForEvent("download"), page.click(".hof-modal [data-pdf]")]);
      expect(/^Kasa-dokumu \d{2}\.\d{2}\.\d{4}-\d{2}\.\d{2}\.\d{4}\.pdf$/.test(download.suggestedFilename()), `PDF adı: ${download.suggestedFilename()}`);
      const pdfPath = path.join(schoolRoot, "kasa.pdf");
      await download.saveAs(pdfPath);
      expect(readFileSync(pdfPath).subarray(0, 8).toString("latin1") === "%PDF-1.7", "PDF dosyası");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop"), null, { timeout: 8000 });

      // v2.0.8: Taksitler → Tablodan aktar. Ay kolonlu öğrenci tablosu (aylık ücret + ödenen) gerçek taksitlerle karta;
      // pilden girilen tahsilat karta taşınır, Kasa değişmez; takvimde tablodan ikinci kez gelmez.
      const cashBefore = (await page.evaluate(() => fetch("/api/workspace/cash?period=all").then(response => response.json()))).data.totals.balance;
      await page.click('#hof-sidecard [data-action="plans"]');
      await page.waitForSelector('.hof-plans [data-act="transfer"]', { timeout: 10000 });
      await page.click('.hof-plans [data-act="transfer"]');
      await page.waitForSelector(".hof-transfer-modal .hof-transfer-table", { timeout: 30000 });
      const transferText = await page.$eval(".hof-transfer-modal", node => node.innerText.replace(/\s+/g, " "));
      expect(/Öğrenciler/.test(transferText) && /aylık ücret \+ ödenen/.test(transferText), `sekme ve biçim: ${transferText.slice(0, 300)}`);
      const rowsShown = await page.$$eval(".hof-transfer-table tbody tr[data-key]", nodes => nodes.map(node => node.innerText.replace(/\s+/g, " ")));
      expect(rowsShown.length === 6, `6 öğrenci listelendi (${rowsShown.length})`);
      // Can Öztürk: 3.800 × 4 ay (geçen 2 ay ödendi, bu ay 1.900 kısmi, gelecek ay açık) → ödenen 9.500, kalan 5.700.
      const can = rowsShown.find(text => /Can Öztürk/.test(text)) || "";
      expect(/4 taksit/.test(can) && /15\.200,00/.test(can) && /9\.500,00/.test(can) && /5\.700,00/.test(can), `Can Öztürk satırı: ${can}`);
      const sumText = await page.$eval(".hof-transfer-sum", node => node.innerText.replace(/\s+/g, " "));
      expect(/kayıt tahsilatı/.test(sumText), `pilden girilen tahsilat kayıt tahsilatı olarak sayılır: ${sumText}`);
      await page.click(".hof-transfer-table tbody tr[data-key] [data-expand]");
      await page.waitForSelector(".hof-transfer-detail .hof-transfer-items", { timeout: 5000 });
      await page.screenshot({ path: path.join(artifacts, "10d-tablodan-aktar.png"), fullPage: true });
      const commitText = await page.textContent(".hof-transfer-modal [data-commit]");
      expect(/6 kişiyi aktar/.test(commitText), `aktar düğmesi: ${commitText}`);
      await page.click(".hof-transfer-modal [data-commit]");
      await page.waitForSelector('.hof-modal-backdrop.is-visible [data-answer="yes"]', { timeout: 8000 });
      await page.click('.hof-modal-backdrop.is-visible [data-answer="yes"]');
      await page.waitForFunction(() => [...document.querySelectorAll(".hof-modal-title")].some(node => node.textContent === "Aktarım tamamlandı"), null, { timeout: 60000 });
      const resultText = await page.$eval(".hof-transfer-result", node => node.innerText.replace(/\s+/g, " "));
      expect(/6 taksit kartı açıldı/.test(resultText) && /1 tahsilat/.test(resultText), `sonuç: ${resultText}`);
      await page.screenshot({ path: path.join(artifacts, "10e-aktarim-sonucu.png") });
      await page.click(".hof-modal-backdrop.is-visible [data-result-close]");
      // "Tamam" aktarım penceresini de kapatır; yenilenmiş Taksitler listesinde 6 kart görünür.
      await page.waitForFunction(() => !document.querySelector(".hof-transfer-modal"), null, { timeout: 8000 });
      await page.waitForFunction(() => document.querySelectorAll(".hof-plans tr[data-plan]").length === 6, null, { timeout: 10000 });
      const cashAfter = (await page.evaluate(() => fetch("/api/workspace/cash?period=all").then(response => response.json()))).data;
      expect(cashAfter.totals.balance === cashBefore, `Kasa değişmedi: ${cashBefore} → ${cashAfter.totals.balance}`);
      expect(cashAfter.entries.filter(entry => entry.source === "plan").length === 1 && !cashAfter.entries.some(entry => entry.source === "payment"), "tahsilat Kasa'da artık taksit tahsilatı olarak (tek kayıt)");
      const plansNow = (await page.evaluate(() => fetch("/api/workspace/plans?status=all").then(response => response.json()))).data;
      expect(plansNow.plans.length === 6 && plansNow.plans.every(plan => plan.caseKey && plan.accountId), "6 kart, hepsi kayda ve cariye bağlı");
      const dues = (await page.evaluate(() => fetch("/api/workspace/dues").then(response => response.json()))).data;
      expect(!dues.items.some(item => item.source !== "plan" && item.tab === "Öğrenciler"), "takvimde tablodan gelen öğrenci kalemi kalmadı (çift sayım yok)");
      expect(dues.items.some(item => item.source === "plan"), "takvim kartların taksitlerini gösteriyor");
      await page.keyboard.press("Escape");
    } finally {
      await context.close();
      await schoolApp.close();
      rmSync(schoolRoot, { recursive: true, force: true });
    }
  });

  await step("Excel açılır listeleri tarayıcıda okunur; kartta ▾ ile seçilir; gizli liste sayfası sekme olmaz; kendi sektörü oluşturulur", async () => {
    const listRoot = mkdtempSync(path.join(tmpdir(), "destekofis-e2e-liste-"));
    const listFile = path.join(listRoot, "acilir-listeler.xlsx");
    writeFileSync(listFile, acilirListelerXlsx());
    const listApp = createApp({ dataDir: path.join(listRoot, "data"), backupDir: path.join(listRoot, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, license: unlicensed });
    const listPort = (await listApp.listen(0, "127.0.0.1")).port;
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
    try {
      const page = await context.newPage();
      page.on("pageerror", error => problems.push(`[liste] pageerror: ${error.message}`));
      await page.goto(`http://127.0.0.1:${listPort}/`);
      await page.fill("#hof-auth input[name=username]", "admin");
      await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
      await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
      await page.waitForSelector("#hof-start .hof-drop");
      await firstUpload(page, (await page.$("#hof-start .hof-drop input[type=file]")), listFile);
      await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
      // Kendi sektörü: seçicide aranan yoksa oluşturulur ve uygulanır.
      await page.click(".hof-analysis-result [data-pick]");
      await page.fill(".hof-picker-search input", "hukuk arşivi");
      await page.click(".hof-picker-list [data-create]");
      await page.waitForSelector(".hof-sector-form");
      expect((await page.inputValue('.hof-sector-form [name="name"]')) === "Hukuk arşivi", "ad aramadan gelir");
      await page.fill('.hof-sector-form [name="record"]', "dosya");
      expect((await page.inputValue('.hof-sector-form [name="records"]')) === "dosyalar", "çoğul kendiliğinden");
      await page.click('.hof-sector-form button[type="submit"]');
      await page.waitForFunction(() => document.querySelector(".brand-subtitle")?.firstChild?.nodeValue === "Hukuk arşivi yönetimi", null, { timeout: 8000 });
      await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop"), null, { timeout: 8000 });
      // Açılır listeler (tarayıcıdaki Excel okuyucu → sunucu): gizli liste sayfası sekme olmaz.
      const data = await page.evaluate(() => ({ choices: HOF.data.choices, tabs: HOF.data.tabs }));
      expect(JSON.stringify(data.tabs) === '["Kayıtlar"]', `sekmeler: ${data.tabs}`);
      expect(data.choices["Kayıtlar"]?.Durum?.options.join() === "Aktif,Beklemede,Kapandı" && data.choices["Kayıtlar"]["Ödeme türü"]?.options.length === 3, `listeler: ${JSON.stringify(data.choices)}`);
      await page.locator(".dynamic-table tbody tr td").first().click({ position: { x: 12, y: 10 } });
      // v2.0.7: ANLIK DURUM kartı sayfayı uzatır; açılır menü alttaki lisans şeridinin altında kalmasın.
      await page.$eval('.hof-choice-pill[data-column="Durum"]', node => node.scrollIntoView({ block: "center" }));
      await page.click('.hof-choice-pill[data-column="Durum"]');
      await page.click('.hof-choice-menu button[data-value="Kapandı"]');
      await page.waitForFunction(() => document.querySelector('.hof-choice-pill[data-column="Durum"]')?.dataset.value === "Kapandı", null, { timeout: 8000 });
      await page.screenshot({ path: path.join(artifacts, "10c-acilir-liste.png") });
    } finally {
      await context.close();
      await listApp.close();
      rmSync(listRoot, { recursive: true, force: true });
    }
  });

  await step("formüllü Excel: detay kartında taksit girilince Kalan ve Durum yeniden hesaplanır", async () => {
    const formulaRoot = mkdtempSync(path.join(tmpdir(), "destekofis-e2e-formul-"));
    const formulaApp = createApp({ dataDir: path.join(formulaRoot, "data"), backupDir: path.join(formulaRoot, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, license: unlicensed });
    const formulaPort = (await formulaApp.listen(0, "127.0.0.1")).port;
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
    try {
      const page = await context.newPage();
      page.on("pageerror", error => problems.push(`[formül] pageerror: ${error.message}`));
      await page.goto(`http://127.0.0.1:${formulaPort}/`);
      await page.fill("#hof-auth input[name=username]", "admin");
      await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
      await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
      await page.waitForSelector("#hof-start .hof-drop");
      const input = await page.$("#hof-start .hof-drop input[type=file]");
      await firstUpload(page, input, path.join(here, "..", "fixtures", "formullu-taksitler.xlsx"));
      await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
      await page.click(".hof-analysis-result [data-apply], .hof-analysis-result [data-done]");
      await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop"), null, { timeout: 8000 });
      await page.locator(".dynamic-table tbody tr", { hasText: "Ayşe Kara" }).first().locator("td").first().click({ position: { x: 12, y: 10 } });
      await page.waitForFunction(() => document.querySelector(".detail-panel .hof-fx"), null, { timeout: 10000 });
      const badge = await page.$eval(".detail-panel .hof-fx", node => node.title);
      expect(badge.includes("=[Tutar]-SUM([Taksit 1]:[Taksit 3])"), `formül işareti: ${badge}`);
      await page.click('.hof-case-actions [data-case-action="edit"]');
      await page.waitForSelector(".hof-modal-backdrop.is-visible .hof-field.is-readonly");
      const locked = await page.$$eval(".hof-modal .hof-field.is-readonly > span", nodes => nodes.map(node => node.textContent));
      expect(locked.some(text => text.startsWith("Kalan")) && locked.some(text => text.startsWith("Durum")), `kilitli formül alanları: ${locked}`);
      const field = page.locator(".hof-modal .hof-field", { hasText: "Taksit 2" }).locator("input, textarea").first();
      await field.fill("8.000");
      await page.click('.hof-modal button[type="submit"]');
      await page.waitForFunction(() => {
        const cells = [...document.querySelectorAll(".detail-panel .dynamic-detail-grid > div")];
        const value = label => cells.find(cell => cell.querySelector(".detail-label")?.textContent.trim() === label)?.querySelector(".detail-value")?.textContent.trim();
        return value("Kalan") === "0,00 ₺" && value("Durum") === "Kapandı";
      }, null, { timeout: 10000 });
      await page.screenshot({ path: path.join(artifacts, "11-formul.png") });
    } finally {
      await context.close();
      await formulaApp.close();
      rmSync(formulaRoot, { recursive: true, force: true });
    }
  });

  await step("akıllı denetim öneriyle düzeltir; belge eklenir ve önizlenir; kolon adlandırılır; Excel'e aktarılır", async () => {
    const smartRoot = mkdtempSync(path.join(tmpdir(), "destekofis-e2e-akilli-"));
    const smartApp = createApp({ dataDir: path.join(smartRoot, "data"), backupDir: path.join(smartRoot, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, license: unlicensed });
    const smartPort = (await smartApp.listen(0, "127.0.0.1")).port;
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR", acceptDownloads: true });
    try {
      const page = await context.newPage();
      page.on("pageerror", error => problems.push(`[akıllı] pageerror: ${error.message}`));
      page.on("console", message => message.type() === "error" && !/401|favicon/.test(message.text()) && problems.push(`[akıllı] console: ${message.text()}`));
      await page.goto(`http://127.0.0.1:${smartPort}/`);
      await page.fill("#hof-auth input[name=username]", "admin");
      await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
      await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
      await page.waitForSelector("#hof-start .hof-drop");
      const input = await page.$("#hof-start .hof-drop input[type=file]");
      await firstUpload(page, input, path.join(here, "..", "fixtures", "akilli-denetim.xlsx"));
      await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
      const summary = await page.$eval(".hof-analysis-result", node => node.innerText.replace(/\s+/g, " "));
      expect(summary.includes("Akıllı Denetim: 1 hesap kuralı öğrenildi") && summary.includes("4 olası tutarsızlık"), `analiz: ${summary}`);
      await page.click(".hof-analysis-result [data-apply], .hof-analysis-result [data-done]");
      await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop"), null, { timeout: 8000 });
      await page.waitForFunction(() => document.querySelectorAll(".dynamic-table tbody tr.hof-row-check").length === 4, null, { timeout: 10000 });

      // Akıllı denetim: hesap tutmayan Kalan, tek tıkla önerilen değere düzeltilir.
      await page.locator(".dynamic-table tbody tr", { hasText: "Ayşe Kara" }).first().locator("td").first().click({ position: { x: 12, y: 10 } });
      await page.waitForSelector("#hof-checks:not([hidden]) li", { timeout: 10000 });
      const check = await page.$eval("#hof-checks", node => node.innerText.replace(/\s+/g, " "));
      expect(check.includes("Kalan 21.000,00 ₺ görünüyor") && check.includes("8.500,00 ₺ olmalı"), `denetim: ${check}`);
      await page.screenshot({ path: path.join(artifacts, "12-akilli-denetim.png") });
      await page.click("#hof-checks [data-fix]");
      await page.waitForFunction(() => [...document.querySelectorAll(".detail-panel .dynamic-detail-grid > div")].some(cell => cell.textContent.includes("8.500,00 ₺")), null, { timeout: 10000 });
      await page.waitForFunction(() => document.getElementById("hof-checks")?.hidden, null, { timeout: 10000 });

      // v2.0.2: Veri Sağlık Kontrolü — özet karttan açılır; toplu düzeltme bölümü ve analiz "Neden?" kanıtları sunulur.
      await page.click('#hof-summary .hof-summary-card[data-kpi="quality"]');
      await page.waitForSelector(".hof-modal-backdrop.is-visible .hof-fixes", { timeout: 10000 });
      await page.waitForFunction(() => !/hazırlanıyor/.test(document.querySelector(".hof-modal-backdrop.is-visible .hof-fixes")?.textContent || ""), null, { timeout: 10000 });
      const health = await page.$eval(".hof-modal-backdrop.is-visible .hof-modal", node => node.innerText.replace(/\s+/g, " "));
      expect(/Toplu düzeltmeler/i.test(health) && /Veri sağlığı/i.test(health), `veri sağlığı penceresi: ${health.slice(0, 200)}`);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop"), null, { timeout: 5000 });

      // v2.0.9: Raporlar — sol menüden açılan pencere ANLIK DURUM'daki Rapor Al ile aynıdır (Cari ekstre, Vade takip, Nakit
      // akış, Çek/Senet, Tüm raporlar, Tablo raporları). Tablo raporları sekmesi: Excel'den kişi ekstresi ve vadeler.
      await page.click('.hof-side-item[data-action="analytics"]');
      await page.waitForSelector(".hof-modal-backdrop.is-visible .hof-rep .hof-rep-tabs", { timeout: 10000 });
      const sideTabs = await page.$$eval(".hof-modal-backdrop.is-visible .hof-rep [data-tab]", nodes => nodes.map(node => node.dataset.tab));
      expect(sideTabs.includes("mizan") && sideTabs.includes("vade") && sideTabs.includes("table"), `sol menüden Raporlar sekmeleri: ${sideTabs.join(", ")}`);
      await page.click('.hof-modal-backdrop.is-visible .hof-rep [data-tab="table"]');
      await page.waitForSelector(".hof-modal-backdrop.is-visible .hof-report-kinds", { timeout: 10000 });
      // "Rapor hazırlanıyor…" yer tutucusu sonuç değildir: özet kartları ya da gerçek boş mesajı beklenir.
      await page.waitForFunction(() => {
        const body = document.querySelector(".hof-modal-backdrop.is-visible [data-report-body]");
        return body && (body.querySelector(".hof-report-summary") || (body.querySelector(".hof-empty") && !/hazırlanıyor/.test(body.textContent)));
      }, null, { timeout: 15000 });
      const reportText = await page.$eval(".hof-modal-backdrop.is-visible .hof-modal", node => node.innerText.replace(/\s+/g, " "));
      expect(/Tablodaki kişiler/i.test(reportText) && /Toplam borç|satır bulunamadı|üretilemedi/i.test(reportText), `rapor penceresi: ${reportText.slice(-400)}`);
      await page.click('.hof-modal-backdrop.is-visible [data-kind="vade-takip"]');
      await page.waitForFunction(() => /Gecikmiş|Kalem/.test(document.querySelector(".hof-modal-backdrop.is-visible .hof-report-summary")?.textContent || ""), null, { timeout: 15000 });
      const [reportDownload] = await Promise.all([page.waitForEvent("download", { timeout: 20000 }), page.click('.hof-modal-backdrop.is-visible [data-export="xlsx"]')]);
      expect(/\.xlsx$/i.test(reportDownload.suggestedFilename()) || (await reportDownload.path()), `rapor Excel indirildi: ${reportDownload.suggestedFilename()}`);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop"), null, { timeout: 5000 });

      // Belge: PDF ve ekran görüntüsü eklenir, liste eskiden yeniye, resim programda önizlenir.
      await page.click('.hof-case-actions [data-case-action="document"]');
      await page.waitForSelector(".hof-modal .hof-doc-picker");
      const pdf = Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
      const png = Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4a00000000049454e44ae426082", "hex");
      await (await page.$(".hof-modal .hof-doc-picker input[type=file]")).setInputFiles([
        { name: "Sözleşme.pdf", mimeType: "application/pdf", buffer: pdf },
        { name: "Ekran görüntüsü.png", mimeType: "image/png", buffer: png },
      ]);
      await page.waitForFunction(() => document.querySelectorAll("#hof-documents .hof-doc-list li:not(.is-uploading)").length === 2, null, { timeout: 15000 });
      const names = await page.$$eval("#hof-documents .hof-doc-name", nodes => nodes.map(node => node.textContent.trim()));
      expect(names.join("|") === "Sözleşme.pdf|Ekran görüntüsü.png", `belgeler: ${names}`);
      await page.click('#hof-documents li[data-kind="image"] .hof-mini[data-doc-view]');
      await page.waitForSelector(".hof-doc-viewer img");
      expect(await page.$eval(".hof-doc-viewer img", node => node.complete && node.naturalWidth === 1), "resim önizlemesi yüklenmeli");
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop"), null, { timeout: 5000 });
      // v2.0.2: birden çok belgede ad belge kartını açar; belgeler yan yana, seçilenler .zip olarak iner.
      await page.click('#hof-documents li[data-kind="pdf"] .hof-doc-name');
      await page.waitForSelector(".hof-doc-gallery-modal .hof-tile");
      expect((await page.$$(".hof-doc-gallery-modal .hof-tile")).length === 2, "belge kartında iki belge");
      await page.check(".hof-doc-gallery-modal [data-pick-all]");
      // Başsız tarayıcı karttaki PDF önizlemesini de "indirme" olarak bildirir; yalnız toplu arşiv indirmesi beklenir.
      const [archive] = await Promise.all([page.waitForEvent("download", { predicate: item => item.url().includes("/documents/archive?ids=") }), page.click(".hof-doc-gallery-modal [data-bulk-download]")]);
      // Başsız tarayıcı Türkçe harfli dosya adını "download" diye bildirir; içerik doğrulanır.
      expect(archive.url().includes("/documents/archive?ids="), `toplu indirme: ${archive.url()}`);
      const zipped = readZip(readFileSync(await archive.path())).filter(entry => !entry.directory).map(entry => entry.name).sort();
      expect(zipped.join("|") === "Ekran görüntüsü.png|Sözleşme.pdf", `.zip içeriği: ${zipped}`);
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop"), null, { timeout: 5000 });

      // Kolon adı: detay kartındaki kalemle; tablo başlığı ve kart değişir, veri asıl adla çalışır.
      const tutar = page.locator(".detail-panel .dynamic-detail-grid > div", { hasText: "Tutar" }).first();
      await tutar.locator(".detail-label").hover();
      await tutar.locator(".hof-col-edit").click();
      await page.waitForSelector(".hof-column-editor");
      // v2.0.6: pencere yalnız adı değiştirdiğini söyler; ada yazılan tarih kaydedilmez, kayda yazılması önerilir.
      expect(/ADINI değiştirir, kayıttaki değeri değil/.test(await page.textContent(".hof-column-editor .hof-column-editor-warn")), "ad penceresi uyarısı");
      expect(await page.isVisible(".hof-column-editor [data-edit-value]"), "değeri düzenleme kısa yolu");
      const tutarInput = page.locator(".hof-column-editor .hof-field", { hasText: "Tutar" }).locator("input");
      await tutarInput.fill("30.09.2026");
      await page.click('.hof-column-editor button[type="submit"]');
      await page.waitForSelector('.hof-modal:has-text("Bu bir tarih, kolon adı değil")');
      await page.click('.hof-modal:has-text("Bu bir tarih, kolon adı değil") [data-answer="no"]');
      await page.waitForFunction(() => !document.querySelector('.hof-modal [data-answer]'), null, { timeout: 5000 });
      expect(await page.isVisible(".hof-column-editor"), "Geri dön: ad penceresi açık kalır");
      expect(!(await page.evaluate(() => Object.values(window.HOF.profile?.()?.columns || {}).includes("30.09.2026"))), "tarih ad olarak kaydedilmedi");
      await tutarInput.fill("Borç tutarı");
      await page.click('.hof-column-editor button[type="submit"]');
      await page.waitForFunction(() => [...document.querySelectorAll(".dynamic-table thead th")].some(th => th.textContent.trim() === "Borç tutarı"), null, { timeout: 8000 });
      expect(await page.evaluate(() => window.HOF.tableHeaders(document.querySelector(".dynamic-table")).includes("Tutar")), "asıl kolon adı korunmalı");

      // Excel'e aktarma: menüden açık sekme; dosya gerçek xlsx ve başlıkta verilen ad.
      await page.click("#hof-toolbar-export");
      await page.waitForSelector(".hof-export-menu");
      const [download] = await Promise.all([page.waitForEvent("download"), page.click('.hof-export-menu [data-export="tab"]')]);
      expect(download.suggestedFilename().endsWith(".xlsx"), `dosya adı: ${download.suggestedFilename()}`);
      const saved = path.join(smartRoot, "cikti.xlsx");
      await download.saveAs(saved);
      const sheet = readZip(readFileSync(saved)).find(entry => entry.name === "xl/worksheets/sheet1.xml").data.toString("utf8");
      expect(sheet.includes("<t>Borç tutarı</t>") && /<c r="H3" s="\d+"><v>8500<\/v><\/c>/.test(sheet), "Excel: başlıkta verilen ad, düzeltilen Kalan sayı olarak");

      // v2.0.6: sütun ekle / sil. Başlığın üzerine gelince küçük çubuk; ekle o sütunun sağına, sil tüm sütunu kaldırır.
      const headers = () => page.evaluate(() => window.HOF.tableHeaders(document.querySelector(".dynamic-table")));
      const before = await headers();
      await page.locator(".dynamic-table thead th", { hasText: "Borç tutarı" }).first().hover();
      await page.waitForSelector(".hof-colops.is-visible");
      await page.click(".hof-colops [data-colop=add]");
      await page.waitForSelector('.hof-modal input[name="name"]');
      await page.fill('.hof-modal input[name="name"]', "Takip notu");
      await page.click('.hof-modal button[type="submit"]');
      await page.waitForFunction(() => window.HOF.tableHeaders(document.querySelector(".dynamic-table")).includes("Takip notu"), null, { timeout: 8000 });
      const added = await headers();
      expect(added.indexOf("Takip notu") === added.indexOf("Tutar") + 1 && added.length === before.length + 1, `yeni sütun Tutar'ın sağında: ${added.join(", ")}`);
      await page.mouse.move(5, 5);
      await page.locator(".dynamic-table thead th", { hasText: "Takip notu" }).first().hover();
      await page.waitForSelector(".hof-colops.is-visible");
      await page.click(".hof-colops [data-colop=del]");
      await page.waitForFunction(() => !window.HOF.tableHeaders(document.querySelector(".dynamic-table")).includes("Takip notu"), null, { timeout: 8000 });
      expect((await headers()).join("|") === before.join("|"), "boş sütun sorulmadan silindi, sütunlar sola kaydı");
      await page.click('.hof-toast:has-text("“Takip notu” sütunu silindi") button:has-text("Geri al")');
      await page.waitForFunction(() => window.HOF.tableHeaders(document.querySelector(".dynamic-table")).includes("Takip notu"), null, { timeout: 8000 });
    } finally {
      await context.close();
      await smartApp.close();
      rmSync(smartRoot, { recursive: true, force: true });
    }
  });

  await step("serbest sayfa: '+ Sayfa' ile açılır; Excel gibi yazılır, geçince kaydedilir; formül, alt toplam, detay kartı ve geri alma çalışır", async () => {
    const freeRoot = mkdtempSync(path.join(tmpdir(), "destekofis-e2e-serbest-"));
    const freeApp = createApp({ dataDir: path.join(freeRoot, "data"), backupDir: path.join(freeRoot, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, license: unlicensed });
    const freePort = (await freeApp.listen(0, "127.0.0.1")).port;
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" });
    try {
      const page = await context.newPage();
      page.on("pageerror", error => problems.push(`[serbest] pageerror: ${error.message}`));
      page.on("console", message => message.type() === "error" && !/401|favicon/.test(message.text()) && problems.push(`[serbest] console: ${message.text()}`));
      await page.goto(`http://127.0.0.1:${freePort}/`);
      await page.fill("#hof-auth input[name=username]", "admin");
      await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
      await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
      await page.waitForSelector("#hof-start .hof-drop");
      const input = await page.$("#hof-start .hof-drop input[type=file]");
      await firstUpload(page, input, path.join(here, "..", "fixtures", "akilli-denetim.xlsx"));
      await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
      await page.click(".hof-analysis-result [data-apply], .hof-analysis-result [data-done]");
      await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop"), null, { timeout: 8000 });

      // Tek sekmeli veride de şerit ve "+ Sayfa" görünür.
      await page.waitForSelector(".category-bar #hof-free-add", { timeout: 10000 });
      await page.click("#hof-free-add");
      await page.fill(".hof-modal input[name=name]", "Masraflar");
      await page.fill(".hof-modal input[name=columns]", "4");
      await page.fill(".hof-modal input[name=rows]", "5");
      await page.click('.hof-modal button[type="submit"]');
      await page.waitForSelector("#hof-free .hof-free-grid tbody tr", { timeout: 10000 });
      await page.waitForFunction(() => window.HOF.activeTab() === "Masraflar" && document.activeElement?.classList.contains("hof-free-editor"), null, { timeout: 8000 });
      const saved = () => page.waitForFunction(() => document.querySelector(".hof-free-status")?.dataset.tone === "ok", null, { timeout: 8000 });
      const cellText = (r, c) => page.$eval(`#hof-free .hof-free-grid tbody tr:nth-child(${r}) td:nth-child(${c + 1})`, td => (td.firstChild?.nodeType === 3 ? td.firstChild.nodeValue : ""));

      // Başlıklar ve satırlar klavyeyle: Tab sağa, Enter aşağı; geçince kaydedilir.
      for (const [index, name] of ["Kalem", "Adet", "Birim fiyat", "Tutar"].entries()) {
        await page.keyboard.type(name);
        await page.keyboard.press(index === 3 ? "Enter" : "Tab");
      }
      await page.keyboard.press("Home");
      for (const line of [["Kırtasiye", "3", "12,50 ₺", "=B1*C1"], ["Kargo", "2", "40,00 ₺", "=b2*c2"]]) {
        for (const [index, value] of line.entries()) {
          await page.keyboard.type(value);
          await page.keyboard.press(index === 3 ? "Enter" : "Tab");
        }
        await page.keyboard.press("Home");
      }
      await saved();
      await page.waitForFunction(() => document.querySelector("#hof-free .hof-free-grid tbody tr:nth-child(2) td:nth-child(5)")?.firstChild?.nodeValue === "80,00 ₺", null, { timeout: 8000 });
      expect((await cellText(1, 4)) === "37,50 ₺", `formül: ${await cellText(1, 4)}`);
      const heads = await page.$$eval("#hof-free .hof-free-heads .hof-free-headtext", nodes => nodes.map(node => node.textContent));
      expect(heads.join("|") === "Kalem|Adet|Birim fiyat|Tutar", `başlıklar: ${heads}`);

      // Satır seçilince detay kartı o kaydı gösterir.
      await page.click("#hof-free .hof-free-grid tbody tr:nth-child(2) td:nth-child(2)");
      await page.waitForFunction(() => document.querySelector(".detail-panel .detail-title")?.textContent.trim() === "Kargo", null, { timeout: 8000 });

      // Formül yazarken hücreye tıklamak adresini ekler.
      await page.click("#hof-free .hof-free-grid tbody tr:nth-child(3) td:nth-child(5)");
      await page.keyboard.type("=");
      await page.click("#hof-free .hof-free-grid tbody tr:nth-child(1) td:nth-child(5)");
      await page.keyboard.type("+");
      await page.click("#hof-free .hof-free-grid tbody tr:nth-child(2) td:nth-child(5)");
      expect((await page.$eval(".hof-free-editor", node => node.value)) === "=D1+D2", "tıklanan hücreler formüle eklenmeli");
      await page.keyboard.press("Escape");

      // Σ Alt toplam
      await page.click('#hof-free [data-act="total-row"]');
      await page.waitForFunction(() => document.querySelector("#hof-free .hof-free-grid tbody tr:nth-child(3) td:nth-child(5)")?.firstChild?.nodeValue === "117,50 ₺", null, { timeout: 8000 });
      expect((await cellText(3, 1)) === "Toplam" && (await cellText(3, 2)) === "5", "toplam satırı");

      // Hücre × ile temizlenir, Ctrl+Z geri getirir.
      await page.click("#hof-free .hof-free-grid tbody tr:nth-child(1) td:nth-child(2)");
      await page.click('#hof-free td.is-active [data-act="clear-cell"]');
      await page.waitForFunction(() => !document.querySelector("#hof-free .hof-free-grid tbody tr:nth-child(1) td:nth-child(2)")?.firstChild?.nodeValue, null, { timeout: 8000 });
      await saved();
      await page.keyboard.press("Control+z");
      await page.waitForFunction(() => document.querySelector("#hof-free .hof-free-grid tbody tr:nth-child(1) td:nth-child(2)")?.firstChild?.nodeValue === "Kırtasiye", null, { timeout: 8000 });

      // Boş satır × ile silinir.
      await saved();
      const before = await page.$$eval("#hof-free .hof-free-grid tbody tr", rows => rows.length);
      await page.hover("#hof-free .hof-free-grid tbody tr:last-child th");
      await page.click('#hof-free .hof-free-grid tbody tr:last-child th [data-act="delete-row"]');
      await page.waitForFunction(count => document.querySelectorAll("#hof-free .hof-free-grid tbody tr").length === count - 1, before, { timeout: 8000 });
      await page.screenshot({ path: path.join(artifacts, "13-serbest-sayfa.png") });

      // Veri sekmesine dönülünce tablo normal görünür.
      await page.click('.category-bar .category-tab[title="Taksitler"]');
      await page.waitForFunction(() => !document.body.classList.contains("hof-free-mode") && getComputedStyle(document.querySelector(".dynamic-table-wrap")).display !== "none", null, { timeout: 8000 });
    } finally {
      await context.close();
      await freeApp.close();
      rmSync(freeRoot, { recursive: true, force: true });
    }
  });

  const csp = problems.filter(item => /Content Security Policy|Refused to/.test(item));
  await step("denemenin 3. gününde yöneticiden firma bilgisi istenir; gönderilince bir daha sorulmaz", async () => {
    licenseClock.offset = 2 * 86_400_000 + 3_600_000;
    await admin.goto(BASE + "/");
    await waitForApp(admin);
    await admin.waitForFunction(() => document.querySelector(".hof-modal-title")?.textContent.includes("kullanmaya devam ettiğiniz için teşekkürler"), null, { timeout: 10000 });
    const company = await admin.inputValue('.hof-modal input[name="companyName"]');
    await admin.screenshot({ path: path.join(artifacts, "29-ucuncu-gun-firma-bilgisi.png") });
    expect(await admin.textContent(".hof-modal [data-cancel]") === "Daha Sonra", "vazgeç düğmesi 'Daha Sonra'");
    if (!company) await admin.fill('.hof-modal input[name="companyName"]', "E2E Hukuk");
    await admin.click('.hof-modal button[type="submit"]');
    await admin.waitForFunction(() => document.querySelector(".hof-modal .hof-form-error")?.textContent.includes("telefon veya e-posta"), null, { timeout: 5000 });
    await admin.fill('.hof-modal input[name="phone"]', "0532 000 00 00");
    await admin.click('.hof-modal button[type="submit"]');
    await admin.waitForFunction(() => !document.querySelector(".hof-modal-backdrop"), null, { timeout: 8000 });
    const given = await admin.evaluate(() => fetch("/api/license").then(response => response.json()).then(body => body.data));
    expect(given.contactGiven === true && given.askContact === false, `iletişim: ${JSON.stringify({ contactGiven: given.contactGiven, askContact: given.askContact })}`);
    await admin.evaluate(() => localStorage.removeItem("hof-contact-asked"));
    await admin.goto(BASE + "/");
    await waitForApp(admin);
    await admin.waitForTimeout(3000);
    expect(!(await admin.$(".hof-modal-title")), "gönderildikten sonra yeniden sorulmaz");
  });

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
