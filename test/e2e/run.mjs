// Uçtan uca tarayıcı testi (Playwright + Chromium).
// Gerçek sunucuyu geçici klasörlerle başlatır, iki farklı kullanıcıyla aynı anda çalışarak
// merkezi Excel, hücre düzeltme, silme/geri alma, yeni kayıt, notlar, yetkiler ve yönetim panelini sınar.
// Çalıştırma: npm run test:e2e   (ekran görüntüleri test/e2e/artifacts/ altına yazılır)
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const artifacts = path.join(here, "artifacts");
mkdirSync(artifacts, { recursive: true });
const fixture = path.join(here, "..", "fixtures", "ornek-dosyalar.xlsx");
const ADMIN_PASSWORD = "Test-Admin-2026!";

const root = mkdtempSync(path.join(tmpdir(), "destekofis-e2e-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const problems = [];
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
    expect((await rowCount(admin)) === 30, `satır sayısı ${await rowCount(admin)}`);
    const flash = await toastText(admin);
    expect(flash.includes("yüklendi") && flash.includes("Tüm bilgisayarlar"), `bildirim: ${flash}`);
    expect(!(await admin.$("#hof-start")), "veri gelince başlangıç kartı kalkmalı");
    const title = await admin.textContent(".page-title");
    expect(title.includes("ornek-dosyalar"), `başlık: ${title}`);
    await admin.screenshot({ path: path.join(artifacts, "03-excel-yuklendi.png") });
  });

  await step("satırlar sunucu kimliği taşır, sayfalama 20 satır gösterir", async () => {
    const keys = await admin.$$eval(".dynamic-table tbody tr", rows => rows.map(row => row.dataset.hofKey));
    expect(keys[0] === "2026/101" && keys.every(Boolean), `kimlikler: ${keys.slice(0, 3)}`);
    const visible = await admin.$$eval(".dynamic-table tbody tr", rows => rows.filter(row => row.style.display !== "none").length);
    expect(visible === 20, `görünen satır ${visible}`);
    await admin.waitForSelector("#hof-pager");
    await admin.click('#hof-pager button[data-page="2"]');
    const second = await admin.$$eval(".dynamic-table tbody tr", rows => rows.filter(row => row.style.display !== "none").length);
    expect(second === 10, `ikinci sayfa ${second}`);
    await admin.click('#hof-pager button[data-page="1"]');
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

  await step("yeni kayıt tüm kolonlarla oluşturulur ve en üste gelir", async () => {
    await admin.click('#hof-sidecard [data-action="newRecord"]');
    await admin.waitForSelector(".hof-modal .hof-record-grid");
    const fields = await admin.$$eval(".hof-modal .hof-field span", nodes => nodes.map(node => node.textContent));
    expect(fields.length === 8, `alan sayısı ${fields.length}`);
    await admin.fill('.hof-modal input[name="c0"]', "2026/999");
    await admin.fill('.hof-modal input[name="c1"]', "Test Borçlu");
    await admin.click('.hof-modal button[type="submit"]');
    await admin.waitForFunction(() => document.querySelector(".dynamic-table tbody tr")?.dataset.hofKey === "2026/999", null, { timeout: 10000 });
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
    const legacyApp = createApp({ dataDir: path.join(legacyRoot, "data"), backupDir: path.join(legacyRoot, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD, HUKUK_DATASET_AUTOSYNC: "0" }, fetchImpl: legacySheet });
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

  const csp = problems.filter(item => /Content Security Policy|Refused to/.test(item));
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
