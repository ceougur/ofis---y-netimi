// Gerçek kullanıcı senaryosu (v2.0.12): taksit kartının Kayıt Tarihi carinin kayıt tarihidir. Müşterinin şikâyeti
// ("tahsilat girince kayıt tarihi değişiyor"): kart formu ve toplu taksitlendirme bugünü yazıyordu. Beş yol arayüzden:
// tek kart (cari seçimi, ad önerisi, elle tarih), cari kartından "+ Taksit Planı", toplu taksitlendirme, tablodaki
// kayıttan Tahsilat → "Taksit planı oluşturun". Çalıştırma: npm run test:senaryo-212 (artifacts/senaryo-212/).
import fs, { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { buildXlsx } from "../../server/lib/xlsx-write.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-212");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-212-"));
const excel = path.join(root, "ogrenciler.xlsx");
const COLS = ["Öğrenci", "Veli Telefon", "Kayıt Tarihi", "Aylık Ücret", "Servis Plaka"];
const ROWS = [["Mert Çelik", "0537 410 60 60", "14.01.2026", "4.500,00 ₺", "34 SRV 303"], ["Ada Yılmaz", "0532 410 10 10", "02.02.2026", "3.500,00 ₺", "34 SRV 101"], ["Efe Kaya", "0532 410 20 20", "12.04.2026", "3.500,00 ₺", "34 SRV 101"]];
writeFileSync(excel, buildXlsx([{ name: "Öğrenciler", columns: COLS, rows: ROWS.map(row => Object.fromEntries(COLS.map((col, i) => [col, row[i]]))) }], { title: "Öğrenciler" }));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f93" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const errors = [];
const newPage = async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR", acceptDownloads: true });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error" && !/api\/auth\/me|Failed to load resource/.test(`${message.location().url} ${message.text()}`)) errors.push(`${message.text()} @ ${message.location().url}`);
  });
  return page;
};
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
const top = `${modal}:last-of-type`;
const pad = value => String(value).padStart(2, "0");
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const tl = value => `₺${new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`;
const closeTop = async page => {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
};


const admin = await newPage();
let exitCode = 0;
const dayOf = () => admin.$eval(`${top} input[name="registeredOn"]`, node => node.value);
const cardDay = () => admin.evaluate(() => { const dt = [...document.querySelectorAll(".hof-modal-backdrop.is-visible dt")].find(node => node.textContent.trim() === "Kayıt Tarihi"); return dt?.nextElementSibling?.textContent.trim() || ""; });
const openNewCard = async () => {
  await admin.click('#hof-sidecard [data-action="plans"]');
  await admin.waitForSelector('.hof-plans [data-act="new"]');
  await admin.click('.hof-plans [data-act="new"]');
  await admin.waitForSelector(`${top} input[name="registeredOn"]`);
  await admin.waitForTimeout(300);
};
const pickCari = async name => {
  await admin.fill(`${top} [data-acc-query]`, name);
  await admin.locator(`${top} .hof-case-picker-list li[data-id]`, { hasText: name }).first().click();
  await admin.waitForTimeout(300);
};
const saveCard = async (total = "12000") => {
  await admin.fill(`${top} input[name="total"]`, total);
  await admin.fill(`${top} input[name="count"]`, "4");
  await admin.fill(`${top} input[name="firstDue"]`, "2026-10-10");
  await admin.click(`${top} button[type="submit"]`);
  await admin.waitForFunction(() => [...document.querySelectorAll(".hof-modal-backdrop.is-visible dt")].some(node => node.textContent.trim() === "Kayıt Tarihi"), null, { timeout: 8000 });
};
const closeAll = async () => { for (let i = 0; i < 5 && (await admin.$(modal)); i += 1) await closeTop(admin); };
try {
  await step("Kurulum: yönetici girer, Excel (Kayıt Tarihi kolonlu) yüklenir; Mart, Şubat ve Haziran'da kaydolmuş cariler", async () => {
    await login(admin, "admin", PASS);
    await admin.waitForSelector("#hof-start .hof-drop");
    await (await admin.$("#hof-start .hof-drop input[type=file]")).setInputFiles(excel);
    await admin.waitForSelector(`${modal} .hof-mapping`, { timeout: 30000 });
    await Promise.all([admin.waitForEvent("load", { timeout: 30000 }), admin.click(`${modal} [data-mode="replace"]`)]);
    await admin.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 });
    await admin.click(".hof-analysis-result [data-apply], .hof-analysis-result [data-done]").catch(() => admin.keyboard.press("Escape"));
    await admin.waitForTimeout(1200);
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForSelector(".dynamic-table tbody tr", { timeout: 20000 });
    for (const [name, registeredOn, groupName] of [["Yasemin Taşkıran", "2026-03-05", "34 SRV 202"], ["Kerem Aydın", "2026-02-10", "34 SRV 202"], ["Selin Yurt", "2026-06-21", "34 SRV 202"], ["Deniz Ak", "2026-05-15", ""]]) {
      const created = await call(admin, "/api/workspace/accounts", { name, type: "customer", phone: "0532 000 00 00", registeredOn, groupName });
      ok(created.status === 200, `cari: ${name} (kayıt ${registeredOn})`);
    }
  });

  await step("1. Taksitler → + Yeni Kart → cari seçilir: Kayıt Tarihi ve Grup cariden gelir; İlk Vade, Taksit Sayısı'nın yanında", async () => {
    await openNewCard();
    ok((await dayOf()) === today(), "cari seçilmeden: bugün");
    const help = await admin.$eval(`${top} input[name="registeredOn"]`, node => node.closest(".hof-field")?.innerText || "");
    ok(/cari seçilince carinin tarihi gelir/.test(help), `yardım metni: ${help.replace(/\s+/g, " ").slice(0, 120)}`);
    const row = await admin.evaluate(() => { const box = name => document.querySelector(`.hof-modal-backdrop.is-visible:last-of-type [name="${name}"]`)?.getBoundingClientRect(); const c = box("count"); const f = box("firstDue"); const t = box("total"); const g = box("groupId"); return { same: Math.abs(c.y - f.y) < 4, aboveGroup: f.y < g.y, afterTotal: c.y > t.y }; });
    ok(row.same && row.aboveGroup && row.afterTotal, "İlk Vade, Taksit Sayısı ile aynı satırda; tutarın hemen altında, grubun üstünde");
    await pickCari("Yasemin Taşkıran");
    ok((await dayOf()) === "2026-03-05", `cari seçilince Kayıt Tarihi carinin tarihi: ${await dayOf()}`);
    const group = await admin.$eval(`${top} select[name="groupId"]`, node => node.options[node.selectedIndex]?.textContent || "");
    ok(/34 SRV 202/.test(group), `grup cariden: ${group}`);
    await shot(admin, "yeni-kart-cari-secildi");
    await saveCard();
    ok((await cardDay()) === "05.03.2026", `kaydedilen kartta Kayıt Tarihi: ${await cardDay()}`);
    await shot(admin, "kart-kayit-tarihi");
    await closeAll();
  });

  await step("2. Ad yazılınca aynı adlı cari önerilir: tarih yine cariden; elle değiştirilen tarih korunur", async () => {
    await openNewCard();
    await admin.fill(`${top} input[name="name"]`, "Deniz Ak");
    await admin.waitForFunction(() => document.querySelector('.hof-modal-backdrop.is-visible:last-of-type input[name="registeredOn"]')?.value === "2026-05-15", null, { timeout: 5000 });
    ok(true, "ad yazıldı → cari önerildi → Kayıt Tarihi 15.05.2026");
    await closeAll();
    await openNewCard();
    await admin.fill(`${top} input[name="registeredOn"]`, "2026-01-20");
    await admin.$eval(`${top} input[name="registeredOn"]`, node => node.dispatchEvent(new Event("input", { bubbles: true })));
    await pickCari("Deniz Ak");
    ok((await dayOf()) === "2026-01-20", "kullanıcının elle yazdığı tarih cari seçilince ezilmez");
    await closeAll();
  });

  await step("3. Cari kartından \"+ Taksit Planı\": tarih carinin tarihi", async () => {
    await admin.click('#hof-sidecard [data-action="accounts"]');
    await admin.locator(`${top} tr`, { hasText: "Deniz Ak" }).first().click();
    await admin.waitForSelector(`${top} [data-act="newPlan"]`);
    await admin.click(`${top} [data-act="newPlan"]`);
    await admin.waitForSelector(`${top} input[name="registeredOn"]`);
    await admin.waitForTimeout(400);
    ok((await dayOf()) === "2026-05-15", `cari kartından açılan formda: ${await dayOf()}`);
    await saveCard("6000");
    ok((await cardDay()) === "15.05.2026", "kart 15.05.2026 ile açıldı");
    await closeAll();
  });

  await step("4. Toplu taksitlendirme (Cari Seç): her kart kendi carisinin tarihini alır", async () => {
    await admin.click('#hof-sidecard [data-action="plans"]');
    await admin.waitForSelector('.hof-plans-filters [data-act="pick"]');
    await admin.click('.hof-plans-filters [data-act="pick"]');
    await admin.waitForSelector("[data-pick-row]");
    await admin.click("[data-pick-head]");
    await admin.click("[data-pick-go]");
    await admin.waitForSelector(`${top} input[name="count"]`);
    await admin.selectOption(`${top} select[name="amountMode"]`, "fixed").catch(() => {});
    await admin.fill(`${top} input[name="total"]`, "9000");
    await admin.fill(`${top} input[name="count"]`, "3");
    await admin.fill(`${top} input[name="firstDue"]`, "2026-10-10");
    await admin.click(`${top} button[type="submit"]`);
    await admin.waitForFunction(() => [...document.querySelectorAll(".hof-modal-title")].some(node => node.textContent.includes("Açılsın mı")), null, { timeout: 8000 });
    await admin.getByRole("button", { name: /Kartı Aç/ }).click();
    await admin.waitForTimeout(1500);
    await closeAll();
    const plans = (await call(admin, "/api/workspace/plans?status=all")).data.plans;
    const dayOfPlan = name => plans.find(plan => plan.name === name)?.registeredOn;
    ok(dayOfPlan("Kerem Aydın") === "2026-02-10" && dayOfPlan("Selin Yurt") === "2026-06-21", `toplu kartlar: Kerem ${dayOfPlan("Kerem Aydın")}, Selin ${dayOfPlan("Selin Yurt")}`);
    await admin.click('#hof-sidecard [data-action="plans"]');
    await admin.waitForTimeout(1200);
    const list = await admin.$eval(".hof-plans", node => node.innerText);
    ok(/kayıt 10\.02\.2026/.test(list) && /kayıt 21\.06\.2026/.test(list) && /kayıt 05\.03\.2026/.test(list), "Taksitler listesinde her kişinin kendi kayıt tarihi");
    await shot(admin, "taksitler-listesi");
    await closeAll();
    const accounts = (await call(admin, "/api/workspace/accounts")).data.accounts;
    ok(accounts.every(item => ({ "Yasemin Taşkıran": "2026-03-05", "Kerem Aydın": "2026-02-10", "Selin Yurt": "2026-06-21", "Deniz Ak": "2026-05-15" })[item.name] === item.registeredOn), "carilerin kayıt tarihleri hiçbir adımda değişmedi");
  });

  await step("5. Tablodaki kayıttan Tahsilat → \"Taksit planı oluşturun\": tarih tablodaki Kayıt Tarihi kolonundan", async () => {
    const row = admin.locator(".dynamic-table tbody tr", { hasText: "Mert Çelik" }).first();
    await row.evaluate(node => node.scrollIntoView({ block: "center" }));
    await row.locator("td").first().click({ position: { x: 10, y: 8 } });
    await admin.waitForTimeout(700);
    await admin.locator(".detail-panel button", { hasText: /^Tahsilat$/ }).first().click();
    await admin.waitForSelector(`${top} [data-new-plan]`);
    await admin.click(`${top} [data-new-plan]`);
    await admin.waitForSelector(`${top} input[name="registeredOn"]`);
    await admin.waitForTimeout(500);
    ok((await dayOf()) === "2026-01-14", `tablodaki Kayıt Tarihi (14.01.2026) forma geldi: ${await dayOf()}`);
    await shot(admin, "kayittan-taksit-plani");
    await saveCard("18000");
    ok((await cardDay()) === "14.01.2026", "kart 14.01.2026 ile açıldı; yeni açılan cari de aynı tarihi taşır");
    const mert = (await call(admin, "/api/workspace/accounts")).data.accounts.find(item => item.name === "Mert Çelik");
    ok(mert?.registeredOn === "2026-01-14", `karttan açılan carinin kayıt tarihi: ${mert?.registeredOn}`);
    await closeAll();
  });

  await step("Tarayıcı hataları", async () => {
    ok(errors.length === 0, errors.length ? `tarayıcı hataları: ${errors.join(" | ")}` : "hiçbir ekranda tarayıcı hatası yok");
  });
} catch (error) {
  exitCode = 1;
  console.error(error);
  await shot(admin, "hata").catch(() => {});
} finally {
  const passed = results.filter(item => item.ok).length;
  console.log(`\n${passed}/${results.length} denetim geçti. Ekran görüntüleri: ${OUT}`);
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
  process.exit(exitCode);
}
