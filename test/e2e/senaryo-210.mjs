// Gerçek kullanıcı senaryosu (v2.0.10): 2.0.10'da biriken 17 düzeltmenin her biri, sıfır kurulumdan, arayüzden,
// kullanıcı gözüyle ve sayılarla. Çalıştırma: npm run test:senaryo-210 (ekran görüntüleri artifacts/senaryo-210/).
//   A. Ana ekran: "Dosya özeti" yok, ANLIK DURUM ortada; "Dışa aktar" tablonun yanında ve çalışıyor; "kayıt · kolon"
//      satırı yok; arama kutuları her ekranda aynı dolgulu yeşil; Çalışma oturumu kartı ekranın içinde (m1, m13-15).
//   B. Cari: yalnız "Borçlu / Alacaklı / Kapalı"; borçlu yeşil, alacaklı kırmızı; bakiye süzgeçleri (m3-m6).
//   C. Kullanıcılar: yeni kullanıcı kişiye özel yetkiyle; özel rol; ✎ ad ve kullanıcı adı; Sil (görev devri) ve geri al;
//      personelde ANLIK DURUM, Yönetim ve dışa aktarma yok; görev atamada herkes (m2, m7, m10-12, m17).
//   D. Çek ödenince pil ve bildirim program yeniden açılmadan kalkar (m9).
//   E. "+ Sayfa": Excel dosyasından aktarma, formüller çalışır (m8).
//   F. Yönetici parolasını unuttu: kurtarma anahtarıyla, eski parola sorulmadan (m16).
import fs, { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { okulServisiXlsx } from "../fixtures/okul-servisi-ornek.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-210");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-210-"));
const excel = path.join(root, "okul-servisi-ornek.xlsx");
writeFileSync(excel, okulServisiXlsx());
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f92" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const newPage = async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR", acceptDownloads: true });
  // Deneme lisansı şeridi senaryonun konusu değil; tıklamaları örtmesin.
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error" && !/api\/auth\/me|Failed to load resource/.test(`${message.location().url} ${message.text()}`)) errors.push(`${message.text()} @ ${message.location().url}`);
  });
  return page;
};
const errors = [];
const results = [];
let shotNo = 0;
const shot = async (page, name, options = {}) => {
  shotNo += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`), ...options });
};
const ok = (cond, msg) => {
  results.push({ ok: Boolean(cond), msg });
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) throw new Error(`BAŞARISIZ: ${msg}`);
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  await fn();
};
const call = (page, url, body, method = body ? "POST" : "GET") =>
  page.evaluate(
    async ([url, body, method]) => {
      const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const json = await response.json().catch(() => ({}));
      return { status: response.status, ...json };
    },
    [url, body, method],
  );
const login = async (page, username, password) => {
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
};
const modal = ".hof-modal-backdrop.is-visible";
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const admin = await newPage();
let exitCode = 0;
try {
  await step("Kurulum: yönetici girer, okul servisi Excel'i yükler, sektör önerisi uygulanır", async () => {
    await login(admin, "admin", PASS);
    await admin.waitForSelector("#hof-start .hof-drop");
    await (await admin.$("#hof-start .hof-drop input[type=file]")).setInputFiles(excel);
    await admin.waitForSelector(`${modal} .hof-mapping`, { timeout: 30000 });
    await Promise.all([admin.waitForEvent("load", { timeout: 30000 }), admin.click(`${modal} [data-mode="replace"]`)]);
    await admin.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
    await admin.click(".hof-analysis-result [data-apply]");
    await admin.waitForTimeout(1200);
    await admin.reload();
    await admin.waitForSelector(".dynamic-table tbody tr", { timeout: 20000 });
    ok((await admin.$$eval(".dynamic-table tbody tr", rows => rows.length)) === 6, "6 öğrenci kaydı tabloda");
  });

  await step("A. Ana ekran (m13, m14, m15, m1)", async () => {
    await admin.waitForSelector("#hof-pulse .hof-pulse-tile", { timeout: 15000 });
    const layout = await admin.evaluate(() => {
      const box = selector => document.querySelector(selector)?.getBoundingClientRect();
      const wrap = box(".content-wrap");
      const pulse = box("#hof-pulse");
      return {
        summary: getComputedStyle(document.querySelector(".welcome-row > div:first-child")).display,
        pulseLeft: Math.round(pulse.left - wrap.left),
        pulseRight: Math.round(wrap.right - pulse.right),
        meta: getComputedStyle(document.querySelector(".cases-panel .panel-meta")).display,
        exportInHeading: Boolean(document.querySelector(".cases-panel > .panel-heading #hof-toolbar-export")),
        searchShare: document.querySelector(".cases-panel .search-field").getBoundingClientRect().width / document.querySelector(".cases-panel .toolbar").getBoundingClientRect().width,
        placeholderFits: (() => {
          const input = document.querySelector(".cases-panel .search-field input");
          const ctx = document.createElement("canvas").getContext("2d");
          ctx.font = getComputedStyle(input).font;
          return ctx.measureText(input.placeholder).width <= input.clientWidth;
        })(),
        searchBg: getComputedStyle(document.querySelector(".search-field")).backgroundColor,
      };
    });
    ok(layout.summary === "none", "m14: “Öğrenci özeti” başlık/açıklama bloğu kaldırıldı");
    ok(Math.abs(layout.pulseLeft - layout.pulseRight) <= 40, `m14: ANLIK DURUM ortada (sol ${layout.pulseLeft}px, sağ ${layout.pulseRight}px)`);
    ok(layout.meta === "none", "m15: tablonun üstündeki “N kayıt · N kolon” satırı yok");
    ok(layout.exportInHeading, "m14: “Dışa aktar” tablo başlık satırının eylem grubunda (Yenile'nin yanında)");
    ok(layout.searchShare > 0.9 && layout.placeholderFits, `m15: arama kutusu tam genişlikte, yazısı kesilmiyor (pay ${layout.searchShare.toFixed(2)})`);
    ok(layout.searchBg === "rgb(233, 245, 238)", `m15: ana arama kutusu dolgulu açık yeşil (${layout.searchBg})`);
    await shot(admin, "ana-ekran");
    await admin.click("#hof-toolbar-export");
    await admin.waitForSelector(".hof-export-menu");
    const [download] = await Promise.all([admin.waitForEvent("download"), admin.click('.hof-export-menu [data-export="tab"]')]);
    const file = path.join(root, "disa.xlsx");
    await download.saveAs(file);
    ok(fs.statSync(file).size > 1000 && fs.readFileSync(file).subarray(0, 2).toString() === "PK", "m14: tablo başlığındaki “Dışa aktar” gerçek bir .xlsx indirir");
    // m15: her ekrandaki arama kutusu aynı tasarım.
    const openers = [["Cari", () => window.HOF.accounts.open()], ["Taksitler", () => window.HOF.plans.open()], ["Stok", () => window.HOF.stock.open()], ["Çek/Senet", () => window.HOF.cheques.open()]];
    const colors = [];
    for (const [name, open] of openers) {
      await admin.evaluate(open);
      await admin.waitForSelector(`${modal} input[type="search"]`, { timeout: 10000 });
      colors.push([name, await admin.$eval(`${modal} input[type="search"]`, node => `${getComputedStyle(node).backgroundColor}|${getComputedStyle(node).borderTopColor}|${getComputedStyle(node).borderRadius}`)]);
      await admin.keyboard.press("Escape");
      await admin.waitForTimeout(300);
    }
    ok(new Set(colors.map(item => item[1])).size === 1 && colors[0][1].startsWith("rgb(233, 245, 238)"), `m15: Cari, Taksitler, Stok, Çek/Senet arama kutuları aynı: ${colors.map(item => item.join(" ")).join(" · ")}`);
    // m1: Çalışma oturumu kartı ekranın içinde.
    await admin.click("#hof-session [data-toggle]");
    await admin.waitForSelector(".hof-session-menu", { state: "visible" });
    const menu = await admin.$eval(".hof-session-menu", node => {
      const rect = node.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, h: innerHeight, w: innerWidth };
    });
    ok(menu.top >= 0 && menu.bottom <= menu.h && menu.left >= 0 && menu.right <= menu.w, `m1: Çalışma oturumu kartı ekranın içinde (${Math.round(menu.left)},${Math.round(menu.top)} → ${Math.round(menu.right)},${Math.round(menu.bottom)})`);
    await shot(admin, "calisma-oturumu");
    await admin.keyboard.press("Escape");
    await admin.goto(`${BASE}/admin.html`);
    await admin.waitForSelector(".adm-home");
    ok((await admin.textContent(".adm-home")).trim() === "Ana Ekran", "m13: yönetim panelinde “Ana Ekran” düğmesi");
    await Promise.all([admin.waitForEvent("load"), admin.click(".adm-home")]);
    await admin.waitForSelector(".dynamic-table tbody tr", { timeout: 20000 });
  });

  await step("B. Cari: Borçlu/Alacaklı sözcükleri, renkler ve bakiye süzgeçleri (m3, m4, m5, m6)", async () => {
    const debtor = (await call(admin, "/api/workspace/accounts", { name: "Borçlu Veli", type: "customer", openingBalance: "3000" })).data;
    const creditor = (await call(admin, "/api/workspace/accounts", { name: "Tedarikçi Ltd", type: "supplier" })).data;
    await call(admin, `/api/workspace/accounts/${creditor.id}/entries`, { kind: "credit", amount: "1200", date: today(), note: "Fatura" });
    await call(admin, "/api/workspace/accounts", { name: "Kapalı Hesap", type: "customer" });
    await admin.evaluate(() => window.HOF.accounts.open());
    await admin.waitForSelector(`${modal} tr[data-account]`);
    const rows = await admin.$$eval(`${modal} tr[data-account]`, nodes => nodes.map(node => ({ text: node.innerText, side: node.querySelector(".hof-acc-balance small")?.textContent || "", tone: node.querySelector(".hof-acc-balance")?.className, color: getComputedStyle(node.querySelector(".hof-acc-balance")).color })));
    const text = await admin.$eval(modal, node => node.innerText);
    ok(!/bize borçlu|biz borçluyuz/i.test(text), "m3: “bize borçlu / biz borçluyuz” yazısı yok");
    const debtorRow = rows.find(row => row.text.includes("Borçlu Veli"));
    const creditorRow = rows.find(row => row.text.includes("Tedarikçi Ltd"));
    ok(debtorRow.color === "rgb(23, 114, 69)" && debtorRow.side === "Borçlu", `m4: Borçlu yeşil (${debtorRow.side}, ${debtorRow.color})`);
    ok(creditorRow.color === "rgb(179, 71, 58)" && creditorRow.side === "Alacaklı", `m4: Alacaklı kırmızı (${creditorRow.side}, ${creditorRow.color})`);
    const kpis = await admin.$eval(`${modal} .hof-plans-kpis`, node => node.innerText.replace(/\s+/g, " "));
    ok(/Borçlular · 1 cari/.test(kpis) && /Alacaklılar · 1 cari/.test(kpis), `m5: göstergelerde borçlu ve alacaklı cari sayısı doğru (${kpis})`);
    await shot(admin, "cari-renkler");
    const filter = async value => {
      await admin.selectOption(`${modal} select[data-filter="balance"]`, value);
      await admin.waitForTimeout(700);
      return admin.$$eval(`${modal} tr[data-account] b`, nodes => nodes.map(node => node.textContent).sort().join(","));
    };
    ok((await filter("debtor")) === "Borçlu Veli", "m5: “Borçlular” süzgeci");
    ok((await filter("creditor")) === "Tedarikçi Ltd", "m5: “Alacaklılar” süzgeci");
    ok((await filter("nonzero")) === "Borçlu Veli,Tedarikçi Ltd", "m5: “Sadece bakiyesi olanlar” süzgeci (kapalı hesap yok)");
    ok((await filter("all")).split(",").length >= 3, "m5: “Tümü”");
    await admin.keyboard.press("Escape");
    const ekstre = await call(admin, `/api/workspace/overview/ekstre?account=${debtor.id}&preset=all`);
    const subtitle = JSON.stringify(ekstre.data || {});
    ok(!/bize borçlu|biz borçluyuz/i.test(subtitle), "m6: cari ekstre verisinde eski ifade yok");
    const pdf = await admin.evaluate(async id => (await fetch(`/api/workspace/overview/ekstre.pdf?account=${id}&preset=all`)).status, debtor.id);
    ok(pdf === 200, "m6: cari ekstre PDF'i üretiliyor");
  });

  let staff;
  let ayseId;
  await step("C. Kullanıcılar: yeni kullanıcı kişiye özel yetkiyle; özel rol; görev atama listesi (m2, m7, m12, m17)", async () => {
    await admin.goto(`${BASE}/admin.html`);
    await admin.waitForSelector("#adm-users tr[data-id]");
    await admin.click("#adm-new-user");
    await admin.fill(`${modal} input[name="name"]`, "Ayşe Yılmz");
    await admin.fill(`${modal} input[name="username"]`, "ayse");
    await admin.fill(`${modal} input[name="password"]`, "Ayse-Parola-2026!");
    await admin.uncheck(`${modal} input[name="mustChangePassword"]`);
    await admin.click(`${modal} .adm-perm-details summary`);
    await admin.uncheck(`${modal} [data-perm="records.export"]`);
    ok((await admin.isDisabled(`${modal} [data-perm="users.manage"]`)) && (await admin.isDisabled(`${modal} [data-perm="overview.card"]`)), "m12: yönetime özgü yetkiler ve ANLIK DURUM kartı kilitli");
    await shot(admin, "yeni-kullanici-yetkiler");
    await admin.click(`${modal} button[type="submit"]`);
    await admin.waitForFunction(() => document.querySelector("#adm-users")?.textContent.includes("Ayşe Yılmz"));
    await call(admin, "/api/admin/users", { username: "zeynep", name: "Zeynep Kaya", role: "avukat", password: "Zeynep-Parola-2026!", mustChangePassword: false });
    await call(admin, "/api/admin/users", { username: "mehmet", name: "Mehmet Demir", role: "personel", password: "Mehmet-Parola-2026!", mustChangePassword: false });
    const users = (await call(admin, "/api/admin/users")).data;
    ayseId = users.find(user => user.username === "ayse").id;
    ok(users.find(user => user.username === "ayse").grants.remove.includes("records.export"), "m12: yeni kullanıcı formunda kaldırılan yetki kayıtlı");
    // Özel rol: Veznedar (personel + Kasa).
    await admin.click("#adm-new-role");
    await admin.fill(`${modal} input[name="name"]`, "Veznedar");
    await admin.selectOption(`${modal} [data-role-start]`, "personel");
    await admin.check(`${modal} [data-perm="cash.view"]`);
    await admin.check(`${modal} [data-perm="cash.manage"]`);
    await admin.click(`${modal} button[type="submit"]`);
    await admin.waitForSelector('#adm-role-list [data-role]:has-text("Veznedar")');
    const roleKey = await admin.evaluate(() => [...document.querySelectorAll("#adm-users tr[data-id] select.adm-role option")].find(option => option.textContent === "Veznedar").value);
    await admin.locator("#adm-users tr[data-id]", { hasText: "Mehmet Demir" }).locator("select.adm-role").selectOption(roleKey);
    await admin.waitForTimeout(800);
    const mehmet = await newPage();
    await login(mehmet, "mehmet", "Mehmet-Parola-2026!");
    await mehmet.waitForSelector("#hof-sidecard .hof-side-item", { timeout: 20000 });
    ok(await mehmet.isVisible('#hof-sidecard [data-action="cash"]'), "m12: özel rol “Veznedar” Kasa'yı açar");
    ok((await mehmet.textContent("#hof-sidecard .hof-user")).includes("Veznedar"), "m12: kişi kartında rolün adı görünür");
    await mehmet.context().close();
    await shot(admin, "kullanicilar-roller", { fullPage: true });
    // m2: görev atamada tüm aktif kullanıcılar.
    await admin.goto(`${BASE}/`);
    await admin.waitForSelector("#hof-sidecard .hof-side-item", { timeout: 20000 });
    await admin.click('#hof-sidecard [data-action="newTask"]');
    await admin.waitForSelector(`${modal} select[name="assigneeId"]`);
    const people = await admin.$$eval(`${modal} select[name="assigneeId"] option`, nodes => nodes.map(node => node.textContent));
    ok(["Ayşe Yılmz", "Zeynep Kaya", "Mehmet Demir", "Ofis yöneticisi"].every(name => people.some(item => item.startsWith(name))), `m2: “Atanacak kişi” listesinde herkes: ${people.join(" | ")}`);
    await admin.selectOption(`${modal} select[name="assigneeId"]`, { label: people.find(item => item.startsWith("Zeynep")) });
    await admin.fill(`${modal} input[name="title"]`, "Veli toplantısı");
    await admin.click(`${modal} button[type="submit"]`);
    await admin.waitForTimeout(800);
    // m7, m17, m12: personelde ANLIK DURUM, Yönetim ve dışa aktarma yok.
    staff = await newPage();
    await login(staff, "ayse", "Ayse-Parola-2026!");
    await staff.waitForSelector(".dynamic-table tbody tr", { timeout: 20000 });
    await staff.waitForTimeout(1200);
    const view = await staff.evaluate(() => ({
      pulse: Boolean(document.getElementById("hof-pulse")),
      welcome: getComputedStyle(document.querySelector(".welcome-row")).display,
      admin: [...document.querySelectorAll("#hof-sidecard .hof-user-menu a")].some(link => /Yönetim/.test(link.textContent)),
      export: Boolean(document.getElementById("hof-toolbar-export")),
    }));
    ok(!view.pulse && view.welcome === "none", "m7: personelde ANLIK DURUM yok ve boş alan kalmıyor");
    ok(!view.admin, "m17: personelde “Yönetim” bağlantısı yok");
    ok(!view.export, "m12: dışa aktarma yetkisi kaldırılan personelde “Dışa aktar” yok");
    ok((await call(staff, "/api/workspace/export.xlsx")).status === 403, "m12: sunucu da dışa aktarmayı reddeder");
    await staff.goto(`${BASE}/admin.html`);
    await staff.waitForSelector("#adm-denied:not([hidden])", { timeout: 10000 });
    ok(true, "m17: personel /admin paneline giremez");
    await shot(staff, "personel-yonetim-reddi");
  });

  await step("C2. ✎ ad ve kullanıcı adı düzeltme; Sil (açık görev devri) ve geri al (m10, m11)", async () => {
    await admin.goto(`${BASE}/admin.html`);
    await admin.waitForSelector("#adm-users tr[data-id]");
    const row = () => admin.locator("#adm-users tr[data-id]", { hasText: "ayse" });
    await row().locator('[data-edit="name"]').click();
    await admin.fill(".adm-edit-form input", "Ayşe Yılmaz");
    await admin.keyboard.press("Enter");
    await admin.waitForFunction(() => document.querySelector("#adm-users")?.textContent.includes("Ayşe Yılmaz"));
    await row().locator('[data-edit="username"]').click();
    await admin.fill(".adm-edit-form input", "ayse.yilmaz");
    await shot(admin, "kalem-kullanici-adi");
    await admin.keyboard.press("Enter");
    await admin.waitForFunction(() => document.querySelector("#adm-users")?.textContent.includes("ayse.yilmaz"));
    ok(true, "m11: görünen ad ve kullanıcı adı ✎ ile düzeltildi");
    const relog = await newPage();
    await relog.goto(`${BASE}/`);
    await relog.fill("#hof-auth input[name=username]", "ayse");
    await relog.fill("#hof-auth input[name=password]", "Ayse-Parola-2026!");
    await relog.click('#hof-auth button[type="submit"]');
    await relog.waitForFunction(() => /hatalı/.test(document.querySelector("#hof-auth .hof-form-error")?.textContent || ""), null, { timeout: 8000 });
    ok(true, "m11: eski kullanıcı adıyla girilemez");
    await login(relog, "ayse.yilmaz", "Ayse-Parola-2026!");
    await relog.waitForSelector("#hof-sidecard .hof-user", { timeout: 20000 });
    ok((await relog.textContent("#hof-sidecard .hof-user")).includes("Ayşe Yılmaz"), "m11: yeni kullanıcı adıyla girer, adı düzeltilmiş görünür");
    await relog.context().close();
    // Sil: Zeynep'in açık görevi var → devret.
    await admin.locator("#adm-users tr[data-id]", { hasText: "Zeynep Kaya" }).locator("[data-delete]").click();
    await admin.waitForSelector(`${modal} select[name="reassignTo"]`);
    await shot(admin, "sil-gorev-devri");
    await admin.selectOption(`${modal} select[name="reassignTo"]`, { label: (await admin.$$eval(`${modal} select[name="reassignTo"] option`, nodes => nodes.map(node => node.textContent))).find(text => text.startsWith("Ofis yöneticisi")) });
    await admin.click(`${modal} button[type="submit"]`);
    await admin.waitForFunction(() => !document.querySelector("#adm-users")?.textContent.includes("Zeynep Kaya"), null, { timeout: 8000 });
    ok(true, "m10: Zeynep silindi, listeden çıktı");
    const tasks = (await call(admin, "/api/workspace/tasks?status=open")).data;
    ok(tasks.find(task => task.title === "Veli toplantısı")?.assignee === "Ofis yöneticisi", "m10: açık görev seçilen kişiye devredildi");
    const denied = await newPage();
    await denied.goto(`${BASE}/`);
    await denied.fill("#hof-auth input[name=username]", "zeynep");
    await denied.fill("#hof-auth input[name=password]", "Zeynep-Parola-2026!");
    await denied.click('#hof-auth button[type="submit"]');
    await denied.waitForFunction(() => /hatalı/.test(document.querySelector("#hof-auth .hof-form-error")?.textContent || ""), null, { timeout: 8000 });
    await denied.context().close();
    ok(true, "m10: silinen kişi giriş yapamaz");
    await admin.reload();
    await admin.waitForSelector("#adm-deleted:not([hidden])");
    await admin.evaluate(() => {
      document.getElementById("adm-deleted").open = true;
    });
    await admin.click('#adm-deleted-body tr:has-text("Zeynep Kaya") [data-restore]');
    await admin.waitForFunction(() => document.querySelector("#adm-users")?.textContent.includes("Zeynep Kaya"), null, { timeout: 8000 });
    ok(true, "m10: silinen kullanıcı “Geri al” ile döner");
    const audit = (await call(admin, "/api/admin/audit?type=user.")).data.map(event => event.type);
    ok(["user.renamed", "user.deleted", "user.restored"].every(type => audit.includes(type)), "m10/m11: işlem geçmişinde düzeltme, silme ve geri alma");
  });

  await step("C3. Yetki paneli canlı: Kasa eklenir, Cari kaldırılır; personelin ekranı yeniden açılmadan değişir (m12)", async () => {
    await staff.goto(`${BASE}/`);
    await staff.waitForSelector("#hof-sidecard .hof-side-item", { timeout: 20000 });
    ok(!(await staff.isVisible('#hof-sidecard [data-action="cash"]')) && (await staff.isVisible('#hof-sidecard [data-action="accounts"]')), "başlangıç: Kasa yok, Cari var");
    await admin.locator("#adm-users tr[data-id]", { hasText: "ayse.yilmaz" }).locator("[data-perms]").click();
    await admin.waitForSelector(".adm-perm-row .adm-perm-panel");
    await admin.check('.adm-perm-row [data-perm="cash.view"]');
    await admin.uncheck('.adm-perm-row [data-perm="accounts.view"]');
    const summary = await admin.textContent(".adm-perm-row [data-summary]");
    ok(/2 eklendi|1 eklendi/.test(summary) && /kaldırıldı/.test(summary), `panel özeti: ${summary}`);
    await shot(admin, "yetki-paneli", { fullPage: true });
    await admin.click(".adm-perm-row [data-perm-save]");
    await staff.waitForFunction(() => {
      const visible = action => {
        const node = document.querySelector(`#hof-sidecard [data-action="${action}"]`);
        return Boolean(node) && getComputedStyle(node).display !== "none";
      };
      return visible("cash") && !visible("accounts");
    }, null, { timeout: 15000 });
    ok(true, "m12: personelin ekranında Kasa açıldı, Cari kapandı (yeniden açmadan)");
    ok((await call(staff, "/api/workspace/accounts")).status === 403 && (await call(staff, "/api/workspace/cash")).status === 200, "m12: sunucu da aynı kuralla (Cari 403, Kasa 200)");
    await shot(staff, "personel-canli-yetki");
  });

  await step("D. Çek ödenince tahsilat pili ve bildirim program yeniden açılmadan kalkar (m9)", async () => {
    await admin.goto(`${BASE}/`);
    await admin.waitForSelector(".dynamic-table tbody tr", { timeout: 20000 });
    await call(admin, "/api/workspace/cheques", { direction: "in", instrument: "cheque", amount: "2500", dueDate: today(), drawer: "Çek Sahibi Ahmet", serialNo: "Ç-1" });
    const pills = () => admin.evaluate(() => [...document.querySelectorAll(".hof-payment-pill:not([aria-hidden])")].filter(node => node.textContent.includes("Çek Sahibi Ahmet")).length);
    await admin.waitForFunction(() => [...document.querySelectorAll(".hof-payment-pill:not([aria-hidden])")].some(node => node.textContent.includes("Çek Sahibi Ahmet")), null, { timeout: 10000 });
    ok((await pills()) === 1, "vadesi bugün olan çek şeritte (yeniden açmadan geldi)");
    const bellBefore = Number(await admin.evaluate(() => document.querySelector(".hof-bell-badge")?.textContent || "0"));
    await admin.evaluate(() => [...document.querySelectorAll(".hof-payment-pill:not([aria-hidden])")].find(node => node.textContent.includes("Çek Sahibi Ahmet")).click());
    await admin.click('.hof-payment-action-card [data-act="pay"]');
    await admin.waitForSelector(`${modal} form button[type="submit"]:has-text("Tahsili kaydet")`, { timeout: 10000 });
    await shot(admin, "cek-tahsil-formu");
    await admin.click(`${modal} form button[type="submit"]:has-text("Tahsili kaydet")`);
    await admin.waitForFunction(() => ![...document.querySelectorAll(".hof-payment-pill:not([aria-hidden])")].some(node => node.textContent.includes("Çek Sahibi Ahmet")), null, { timeout: 5000 });
    ok(true, "m9: tahsil edilince pil hemen kalktı");
    await admin.waitForTimeout(800);
    const bellAfter = Number(await admin.evaluate(() => document.querySelector(".hof-bell-badge")?.textContent || "0"));
    ok(bellAfter === bellBefore - 1, `m9: zil sayısı ${bellBefore} → ${bellAfter}`);
    ok(!(await admin.evaluate(() => window.HOF.alerts.list().some(item => item.title === "Çek Sahibi Ahmet"))), "m9: bildirim listesinden de kalktı");
    await admin.keyboard.press("Escape");
  });

  await step("E. “+ Sayfa”: Excel dosyasından aktarma; formüller programda çalışır (m8)", async () => {
    const XLSX = await import("../../client/assets/xlsx-DGuHH-KN.js");
    const sheet = {
      "!ref": "B1:E5",
      B1: { t: "s", v: "Servis Giderleri 2026" },
      B2: { t: "s", v: "Kalem" }, C2: { t: "s", v: "Tutar" }, D2: { t: "s", v: "KDV" },
      B3: { t: "s", v: "Yakıt" }, C3: { t: "n", v: 8000 }, D3: { t: "n", v: 1600, f: "C3*0.2" },
      B4: { t: "s", v: "Bakım" }, C4: { t: "n", v: 2000 }, D4: { t: "n", v: 400, f: "C4*0.2" },
      B5: { t: "s", v: "Toplam" }, C5: { t: "n", v: 10000, f: "SUM(C3:C4)" }, D5: { t: "n", v: 2000, f: "SUM(D3:D4)" },
    };
    const file = path.join(root, "giderler.xlsx");
    writeFileSync(file, XLSX.write({ SheetNames: ["Giderler"], Sheets: { Giderler: sheet } }, { type: "buffer", bookType: "xlsx" }));
    await admin.click("#hof-free-add");
    await admin.waitForSelector(`${modal} .hof-free-source`);
    await admin.click(`${modal} [data-source="excel"]`);
    await admin.setInputFiles(`${modal} [data-file]`, file);
    await admin.waitForSelector(`${modal} [data-excel-result]:not([hidden])`, { timeout: 20000 });
    const note = await admin.textContent(`${modal} .hof-free-import-note`);
    ok(/3 satır × 3 kolon/.test(note) && /4 formül/.test(note) && /üstündeki 1 satır/.test(note), `ön izleme: ${note.trim()}`);
    await shot(admin, "serbest-sayfa-excel");
    await admin.click(`${modal} [data-pane="excel"] [data-import]`);
    await admin.waitForFunction(() => window.HOF.activeTab?.() === "Giderler", null, { timeout: 20000 });
    const sheets = (await call(admin, "/api/workspace/free")).data.sheets;
    const detail = (await call(admin, `/api/workspace/free/${sheets.find(item => item.name === "Giderler").id}`)).data;
    const cells = detail.rows.map(row => row.cells.map(cell => cell.display));
    ok(detail.columns.map(column => column.name).join() === "Kalem,Tutar,KDV", "m8: kolon başlıkları Excel'den (sayfa başlığı alınmadı)");
    ok(detail.rows[2].cells[1].raw === "=SUM(B1:B2)" && cells[2][1] === "10000" && cells[2][2] === "2000", `m8: formüller çalışıyor: ${JSON.stringify(cells)}`);
    await admin.waitForTimeout(800);
    await shot(admin, "serbest-sayfa-aktarildi");
  });

  await step("F. Yönetici parolasını unuttu: kurtarma anahtarı (m16)", async () => {
    await admin.goto(`${BASE}/admin.html#recovery`);
    await admin.waitForSelector("#adm-recovery.is-missing");
    ok(true, "anahtar yokken Kullanıcılar ekranında uyarı kartı");
    await admin.click("#adm-recovery-create");
    await admin.waitForSelector(".hof-recovery-key");
    const key = (await admin.textContent(".hof-recovery-key")).trim();
    ok(/^[A-Z2-9]{5}(-[A-Z2-9]{5}){3}$/.test(key), `anahtar üretildi: ${key}`);
    await admin.check("[data-saved]");
    await admin.click("[data-done]");
    const lost = await newPage();
    await lost.goto(`${BASE}/`);
    await lost.click("#hof-auth [data-forgot]");
    await lost.waitForSelector("#hof-auth input[name=code]");
    ok(!(await lost.$("#hof-auth input[name=currentPassword]")), "kurtarma ekranı eski parolayı sormaz");
    await lost.fill("#hof-auth input[name=code]", key);
    await lost.fill("#hof-auth input[name=newPassword]", "Yeni-Yonetici-2026!");
    await lost.fill("#hof-auth input[name=confirmPassword]", "Yeni-Yonetici-2026!");
    await shot(lost, "kurtarma-ekrani");
    await lost.click('#hof-auth button[type="submit"]');
    await lost.waitForSelector(".hof-recovery-key", { timeout: 10000 });
    ok((await lost.textContent(".hof-recovery-key")).trim() !== key, "kullanılan anahtar yerine yenisi gösterildi");
    await lost.check("[data-saved]");
    await Promise.all([lost.waitForEvent("load"), lost.click("[data-done]")]);
    await lost.waitForSelector("#hof-sidecard", { timeout: 20000 });
    ok((await lost.evaluate(() => window.HOF.user?.username)) === "admin", "m16: yeni parolayla doğrudan içeride");
    ok((await call(admin, "/api/auth/me")).status === 401, "m16: eski oturumlar kapandı");
    await lost.context().close();
  });

  ok(!errors.length, `tarayıcı hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} catch (error) {
  exitCode = 1;
  console.error(error);
  await admin.screenshot({ path: path.join(OUT, "hata.png") }).catch(() => {});
} finally {
  const passed = results.filter(item => item.ok).length;
  console.log(`\n${passed}/${results.length} denetim geçti. Ekran görüntüleri: ${OUT}`);
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
  process.exit(exitCode);
}
