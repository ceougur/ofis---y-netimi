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

  await step("kaynak yokken yol gösterici not görünür", async () => {
    await admin.waitForSelector("#hof-source-empty");
    await admin.screenshot({ path: path.join(artifacts, "02-bos-kaynak.png") });
  });

  await step("Excel yüklenir ve ofisin ortak kaynağı olur", async () => {
    await admin.click('#hof-source-empty button');
    await admin.waitForSelector(".settings-modal .source-dropzone input[type=file]", { state: "attached" });
    await admin.waitForSelector(".settings-modal .hof-source-tools");
    const input = await admin.$(".settings-modal .source-dropzone input[type=file]");
    await Promise.all([admin.waitForEvent("load", { timeout: 30000 }), input.setInputFiles(fixture)]);
    await waitForApp(admin);
    await admin.waitForFunction(() => document.querySelectorAll(".dynamic-table tbody tr").length > 0, null, { timeout: 15000 });
    expect((await rowCount(admin)) === 30, `satır sayısı ${await rowCount(admin)}`);
    const flash = await toastText(admin);
    expect(flash.includes("merkezi sunucuya yüklendi"), `bildirim: ${flash}`);
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

  await step("yönetici avukat hesabı oluşturur (yönetim paneli)", async () => {
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
    await admin.waitForFunction(() => document.querySelector("#adm-audit")?.textContent.includes("Excel tablosu yükledi"));
    await admin.click('.adm-tabs [data-tab="system"]');
    await admin.waitForFunction(() => document.querySelector("#adm-system")?.textContent.includes("Şema sürümü"));
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
    await staff.screenshot({ path: path.join(artifacts, "06-personel.png") });
  });

  await step("yönetici görev atar, personel rozet ve listede görür, tamamlar", async () => {
    await admin.goto(BASE + "/");
    await waitForApp(admin);
    await admin.click('#hof-sidecard [data-action="newTask"]');
    await admin.fill('.hof-modal input[name="title"]', "Tebligatı kontrol et");
    await admin.fill('.hof-modal input[name="assignee"]', "Av. Deniz Yıldırım");
    await admin.selectOption('.hof-modal select[name="priority"]', "urgent");
    await admin.click('.hof-modal button[type="submit"]');
    await admin.waitForFunction(() => [...document.querySelectorAll(".hof-toast")].some(node => node.textContent.includes("Görev atandı")));
    await staff.reload();
    await waitForApp(staff);
    await staff.waitForFunction(() => document.querySelector('[data-badge="tasks"]')?.textContent === "1", null, { timeout: 10000 });
    await staff.click('#hof-sidecard [data-action="tasks"]');
    await staff.waitForSelector(".hof-modal [data-complete]");
    await staff.click(".hof-modal [data-complete]");
    await staff.waitForFunction(() => document.querySelector(".hof-modal [data-list]")?.textContent.includes("açık görev yok"));
  });

  await step("oturum kapanınca giriş ekranı gelir", async () => {
    await staff.keyboard.press("Escape");
    await staff.click('#hof-sidecard [data-action="logout"]');
    await staff.waitForSelector("#hof-auth", { timeout: 10000 });
  });

  await step("v1.0.0 tarayıcısındaki kaynak ve notlar ilk girişte ofise taşınır", async () => {
    const legacyRoot = mkdtempSync(path.join(tmpdir(), "destekofis-e2e-eski-"));
    const legacyApp = createApp({ dataDir: path.join(legacyRoot, "data"), backupDir: path.join(legacyRoot, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: ADMIN_PASSWORD }, fetchImpl: async () => new Response("", { status: 404 }) });
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
      expect(legacyApp.store.setting("client.sheetUrl") === "https://docs.google.com/spreadsheets/d/ESKI-KAYNAK/edit", "kaynak ofise taşınmalı");
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
