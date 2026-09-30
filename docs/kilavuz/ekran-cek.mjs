// Kısa kullanım kılavuzunun ekran görüntüleri: tek okul servisi örneğiyle, sıfırdan kurulan geçici bir sunucuda.
// Kullanım: node docs/kilavuz/ekran-cek.mjs [çıktı klasörü] [yalnız-bunlar,virgülle]
// Sonra: node docs/kilavuz/pdf-uret.mjs docs/kilavuz DestekOfis-Kullanim-Kilavuzu && cp docs/kilavuz/*.pdf client/kilavuz/
// Örnek dosyalar (docs/kilavuz/ornek/) uydurma verilerdir; gerçek müşteri verisi kullanılmaz.
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const R = path.resolve(HERE, "..", "..");
const S = path.join(HERE, "ornek");
const { chromium } = createRequire(`${R}/`)("playwright");
const { createApp } = await import(`${R}/server/app.mjs`);
const OUT = process.argv[2] || `${R}/docs/kilavuz/ekran`;
const ONLY = process.argv[3] ? new Set(process.argv[3].split(",")) : null;
mkdirSync(OUT, { recursive: true });
const root = mkdtempSync(path.join(tmpdir(), "kilavuz211-"));
const PASS = "Kilavuz-Admin-2026";
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "b"), logLevel: "warn", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "7f3a91c24be05d6e8a1b2c3d4e5f6071" } });
const { port } = await app.listen(0, "127.0.0.1");
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 860 }, locale: "tr-TR", deviceScaleFactor: 1.5 });
await ctx.addInitScript(() => { const st = document.createElement("style"); st.textContent = "#hof-license-bar,.hof-license-notice{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st)); });
const page = await ctx.newPage();
const errors = [];
const failed = [];
page.on("pageerror", e => errors.push(e.message));
const want = name => !ONLY || ONLY.has(name);
const shot = async (name, options = {}, on = page) => { if (!want(name)) return; await on.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 84, ...options }); console.log("✓", name); };
const quiet = (on = page) => on.evaluate(() => document.querySelectorAll(".hof-toast").forEach(n => n.remove()));
const box = async (selector, on = page) => on.$eval(selector, n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
const topBox = async (on = page) => on.$$eval(".hof-modal-backdrop.is-visible .hof-modal", list => { const r = list.at(-1).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
const pad = (r, p = 12) => ({ x: Math.max(0, r.x - p), y: Math.max(0, r.y - p), width: r.width + 2 * p, height: r.height + 2 * p });
const api = (url, body, method = body ? "POST" : "GET") => page.evaluate(async ([url, body, method]) => { const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; }, [url, body, method]);
const closeTop = async () => { await page.keyboard.press("Escape"); await page.waitForTimeout(350); };
const closeAll = async () => { for (let i = 0; i < 4 && await page.$(".hof-modal-backdrop.is-visible"); i += 1) await closeTop(); };
const step = async (name, fn) => { try { await fn(); } catch (error) { failed.push(`${name}: ${error.message.split("\n")[0]}`); console.log("✗", name, error.message.split("\n")[0]); await page.screenshot({ path: path.join(tmpdir(), `kilavuz-hata-${name}.png`) }).catch(() => {}); await closeAll().catch(() => {}); } };
const day = offset => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

// 1) Giriş
await page.goto(`${base}/`);
await page.waitForSelector("#hof-auth input[name=username]");
await page.waitForTimeout(500);
await shot("k01-giris", { clip: pad(await box("#hof-auth .hof-auth-card, #hof-auth form"), 40) }).catch(() => shot("k01-giris"));
await page.fill("#hof-auth input[name=username]", "admin");
await page.fill("#hof-auth input[name=password]", PASS);
await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
// 2) Açılış ekranı: yükleme kutusu ve taslak Excel
await page.waitForSelector("#hof-start .hof-drop");
await page.waitForTimeout(600);
await shot("k15-taslak-excel");
// 3) Yükleme ve analiz
const input = await page.$("#hof-start .hof-drop input[type=file]");
await input.setInputFiles(`${S}/okul-servisi.xlsx`);
await page.waitForSelector(".hof-modal-backdrop.is-visible .hof-mapping", { timeout: 30000 }).catch(() => {});
if (await page.$('.hof-modal-backdrop.is-visible [data-mode="replace"]')) await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click('.hof-modal-backdrop.is-visible [data-mode="replace"]')]);
await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 30000 });
await page.setViewportSize({ width: 1360, height: 1500 });
await page.waitForTimeout(800);
await quiet();
await shot("k03-analiz", { clip: pad(await box(".hof-modal"), 6) });
await page.setViewportSize({ width: 1360, height: 860 });
await page.click(".hof-analysis-result [data-apply]");
await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop"), null, { timeout: 8000 });
await page.evaluate(() => { const n = document.getElementById("hof-notices"); if (n) n.style.visibility = "hidden"; });
await page.waitForTimeout(2000);
await quiet();
await shot("k04-ana-ekran");

await step("k05", async () => {
  const row = page.locator(".dynamic-table tbody tr", { hasText: "Efe Kaya" }).first();
  await row.evaluate(node => node.scrollIntoView({ block: "center" }));
  await row.locator("td").first().click({ position: { x: 12, y: 10 } });
  await page.waitForTimeout(700);
  await page.$eval(".detail-panel", node => node.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(300);
  const pill = page.locator('.detail-panel .hof-choice-pill').first();
  await pill.click();
  await page.waitForTimeout(400);
  const detail = await box(".detail-panel");
  await shot("k05-detay-acilir-liste", { clip: { x: detail.x - 8, y: Math.max(0, detail.y - 8), width: detail.width + 16, height: Math.min(640, 860 - detail.y) } });
  await page.keyboard.press("Escape");
});

await step("k06", async () => {
  await page.evaluate(() => { const n = document.getElementById("hof-notices"); if (n) n.style.visibility = ""; });
  await page.waitForSelector(".hof-notice.is-visible", { timeout: 45000 });
  await page.waitForTimeout(600);
  await shot("k06-uyari", { clip: pad(await box(".hof-notice"), 16) });
  await page.evaluate(() => document.getElementById("hof-notices")?.remove());
});

await step("k07", async () => {
  const files = [["Servis sözleşmesi (tarama).jpg", readFileSync(`${S}/belge-sozlesme.jpg`), "image/jpeg"], ["Veli kimlik fotokopisi.jpg", readFileSync(`${S}/belge-kimlik.jpg`), "image/jpeg"], ["Okul kayıt belgesi.jpg", readFileSync(`${S}/belge-kayit.jpg`), "image/jpeg"], ["Ödeme planı.xlsx", readFileSync(`${S}/odeme-plani.xlsx`), "application/octet-stream"]];
  await page.evaluate(() => { window.HOF.documents.open(); });
  await page.waitForSelector(".hof-modal input[type=file]", { state: "attached" });
  await (await page.$(".hof-modal input[type=file]")).setInputFiles(files.map(([name, buffer, mimeType]) => ({ name, buffer, mimeType })));
  await page.waitForFunction(() => document.querySelectorAll("#hof-documents .hof-doc-list li:not(.is-uploading)").length === 4, null, { timeout: 20000 });
  await quiet();
  await page.click("#hof-documents .hof-doc-gallery-open");
  await page.waitForTimeout(1800);
  await shot("k07-belge-karti", { clip: pad(await box(".hof-doc-gallery-modal"), 4) });
  await closeAll();
});

// Cari yokken Raporlar yol gösterir.
await step("k16", async () => {
  await page.click('.hof-side-item[data-action="analytics"]');
  await page.waitForSelector(".hof-modal-backdrop.is-visible .hof-rep .hof-rep-tabs", { timeout: 10000 });
  await page.waitForTimeout(1200);
  await quiet();
  await shot("k16-raporlar-bos-defter");
  await closeAll();
});

// Tablodaki ödeme planı Taksitler'e.
await step("k14", async () => {
  await page.click('#hof-sidecard [data-action="plans"]');
  await page.waitForSelector('.hof-plans [data-act="transfer"]', { timeout: 10000 });
  await page.click('.hof-plans [data-act="transfer"]');
  await page.waitForSelector(".hof-transfer-modal .hof-transfer-table", { timeout: 30000 });
  await page.waitForTimeout(800);
  await quiet();
  await shot("k14-tablodan-aktar");
  await page.click(".hof-transfer-modal [data-commit]");
  await page.waitForTimeout(2500);
  await closeAll();
});

// Kasa: tahsilat ve gider.
await step("k08", async () => {
  await api("/api/workspace/cash", { kind: "out", amount: "1.200", date: day(0), description: "Yakıt" });
  await api("/api/workspace/cash", { kind: "in", amount: "2.500", date: day(-2), description: "Gezi servisi ücreti" });
  await page.click('#hof-sidecard [data-action="cash"]');
  await page.waitForSelector(".hof-cash-table tbody tr[data-kind]", { timeout: 10000 });
  await page.waitForTimeout(900);
  await quiet();
  await shot("k08-kasa", { clip: pad(await topBox(), 4) });
  await closeAll();
});

// Taksitler: grup süzgeci, Cari Seç ve toplu taksitlendirme.
await step("k21", async () => {
  for (const name of ["Selin Aydın", "Kerem Yıldız", "Defne Koç"]) await api("/api/workspace/accounts", { name, type: "customer", groupName: "34 SRV 202", subgroupName: "Sahil", phone: "0532 410 20 30" });
  await page.click('#hof-sidecard [data-action="plans"]');
  await page.waitForSelector('select[data-filter="group"]', { timeout: 10000 });
  const group = await page.$eval('select[data-filter="group"]', select => [...select.options].find(option => option.textContent.startsWith("34 SRV 202"))?.value);
  await page.selectOption('select[data-filter="group"]', group);
  await page.waitForSelector(".hof-plan-empty-group", { timeout: 8000 });
  await page.waitForTimeout(500);
  await quiet();
  await shot("k21-taksitler-grup", { clip: pad(await topBox(), 4) });
  await page.click('.hof-plan-empty-group [data-act="pick"]');
  await page.waitForSelector("[data-pick-row]");
  await page.click("[data-pick-head]");
  await page.waitForTimeout(400);
  await shot("k22-cari-sec", { clip: pad(await topBox(), 4) });
  await page.click("[data-pick-go]");
  const top = ".hof-modal-backdrop.is-visible:last-of-type";
  await page.waitForSelector(`${top} input[name="count"]`);
  await page.selectOption(`${top} select[name="amountMode"]`, "fixed").catch(() => {});
  await page.fill(`${top} input[name="total"]`, "24000");
  await page.fill(`${top} input[name="count"]`, "8");
  await page.fill(`${top} input[name="firstDue"]`, day(5));
  await page.click(`${top} button[type="submit"]`);
  await page.waitForFunction(() => [...document.querySelectorAll(".hof-modal-title")].some(node => node.textContent.includes("Taksit Kartları Açılsın mı?")), null, { timeout: 8000 });
  await page.getByRole("button", { name: /3 Kartı Aç/ }).click();
  await page.waitForTimeout(1500);
  await closeAll();
});

// Çek / Senet.
await step("k13", async () => {
  const accounts = (await api("/api/workspace/accounts?limit=50")).data;
  const list = accounts.accounts || accounts.items || accounts;
  const derya = Array.isArray(list) ? list.find(item => /Selin Aydın/.test(item.name)) : null;
  const supplier = (await api("/api/workspace/accounts", { name: "Öz Akaryakıt Ltd.", type: "supplier", phone: "0212 555 10 20" })).data;
  await api("/api/workspace/cheques", { direction: "in", instrument: "cheque", drawer: "Selin Aydın", accountId: derya?.id, amount: 6000, issueDate: day(-3), dueDate: day(12), serialNo: "0045821", bank: "Ziraat Bankası" });
  await api("/api/workspace/cheques", { direction: "in", instrument: "note", drawer: "Kerem Yıldız", amount: 3000, issueDate: day(-10), dueDate: day(-1), serialNo: "S-118" });
  await api("/api/workspace/cheques", { direction: "out", instrument: "cheque", drawer: "Öz Akaryakıt Ltd.", accountId: supplier?.id, amount: 8500, issueDate: day(0), dueDate: day(25), serialNo: "1102233", bank: "İş Bankası" });
  await page.click('#hof-sidecard [data-action="cheques"]');
  await page.waitForSelector(".hof-modal-backdrop.is-visible [data-cheque], .hof-modal-backdrop.is-visible .hof-cheque-table, .hof-modal-backdrop.is-visible table", { timeout: 10000 });
  await page.waitForTimeout(900);
  await quiet();
  await shot("k13-cek-senet");
  await closeAll();
});

// Stok: kritik seviyede bir kalem (ANLIK DURUM'da görünsün).
await step("stok", async () => {
  await api("/api/workspace/stock", { name: "Motor Yağı", unit: "lt", unitPrice: "420", minQty: "5", openingQty: "3", openingDate: day(-20) });
  await api("/api/workspace/stock", { name: "Antifriz", unit: "Lt", unitPrice: "180", minQty: "2", openingQty: "12", openingDate: day(-20) });
});

await step("k10", async () => {
  await page.reload();
  await page.waitForSelector("#hof-pulse", { timeout: 15000 });
  await page.waitForTimeout(2200);
  await page.evaluate(() => document.querySelectorAll(".hof-notice, .hof-toast").forEach(n => n.remove()));
  if (want("k10-anlik-durum")) { await (await page.$("#hof-pulse")).screenshot({ path: `${OUT}/k10-anlik-durum.jpg`, type: "jpeg", quality: 84 }); console.log("✓ k10-anlik-durum"); }
});

await step("k11-k12", async () => {
  await page.click('.hof-side-item[data-action="analytics"]');
  await page.waitForSelector(".hof-modal-backdrop.is-visible .hof-rep .hof-rep-tabs", { timeout: 10000 });
  await page.click('.hof-modal-backdrop.is-visible .hof-rep [data-tab="vade"]');
  await page.waitForTimeout(1500);
  await quiet();
  await shot("k11-rapor-al");
  await page.click('.hof-modal-backdrop.is-visible .hof-rep [data-tab="all"]');
  await page.waitForSelector('.hof-modal-backdrop.is-visible [data-report="cari-tahsilat"]', { timeout: 10000 });
  await page.click('.hof-modal-backdrop.is-visible [data-report="cari-tahsilat"]');
  await page.waitForTimeout(1500);
  await quiet();
  await shot("k12-rapor-merkezi");
  await closeAll();
});

await step("k09", async () => {
  await page.evaluate(() => { window.HOF.pickSector(); });
  await page.waitForSelector(".hof-picker-search input");
  await page.fill(".hof-picker-search input", "tekne kiralama");
  await page.waitForTimeout(300);
  await page.click(".hof-picker-list [data-create]");
  await page.waitForSelector(".hof-sector-form");
  await page.fill('.hof-sector-form [name="record"]', "tekne");
  await page.fill('.hof-sector-form [name="expert"]', "Kaptan");
  await page.fill('.hof-sector-form [name="headers"]', "Tekne adı, Liman, Kaptan");
  await page.waitForTimeout(300);
  await shot("k09-kendi-sektorun", { clip: pad(await topBox(), 4) });
  await closeAll();
});

await step("k19", async () => {
  await page.click("#hof-free-add");
  await page.waitForSelector(".hof-modal-backdrop.is-visible .hof-free-source");
  await page.click('.hof-modal-backdrop.is-visible [data-source="excel"]');
  await page.setInputFiles(".hof-modal-backdrop.is-visible [data-file]", `${S}/giderler.xlsx`);
  await page.waitForSelector(".hof-modal-backdrop.is-visible [data-excel-result]:not([hidden])", { timeout: 20000 });
  await page.waitForTimeout(500);
  await quiet();
  await shot("k19-sayfa-excel", { clip: pad(await topBox(), 4) });
  await closeAll();
});

// Veri Sağlığı: rehber tablosu (kimliği boş kayıtlar) yeni oturumda; Yok Say düğmeleri.
await step("k23", async () => {
  const rows = [["Öğrenci No", "Adı", "Soyadı", "Veli Telefon"]];
  for (let i = 0; i < 20; i += 1) rows.push([i < 16 ? String(20260100 + i) : "", ["Ahmet", "Ayşe", "Mehmet", "Fatma", "Ali"][i % 5], ["Yılmaz", "Kaya", "Demir", "Çelik", "Şahin"][(i * 3) % 5], i % 7 === 3 ? "0532 12" : `0532 ${100 + i} 11 ${10 + i}`]);
  const staged = await api("/api/workspace/dataset/stage", { kind: "excel", fileName: "Öğrenci Rehberi.xlsx", sheets: [{ name: "Rehber", matrix: rows }] });
  await api("/api/workspace/dataset/commit", { stageId: staged.data.stageId, mode: "session" });
  await page.waitForTimeout(1500);
  await page.goto(`${base}/`, { waitUntil: "load" });
  await page.waitForSelector('#hof-summary [data-kpi="quality"]', { timeout: 20000 });
  await page.evaluate(() => document.querySelectorAll(".hof-notice, .hof-toast, .hof-modal-backdrop").forEach(n => n.remove()));
  await page.click('#hof-summary [data-kpi="quality"]');
  await page.waitForSelector(".hof-modal-backdrop.is-visible .hof-issue[data-issue]", { timeout: 10000 });
  await page.waitForTimeout(600);
  await shot("k23-veri-sagligi", { clip: pad(await topBox(), 4) });
  await closeAll();
});

// Yönetim: kurtarma anahtarı ve kişiye özel yetkiler.
await step("k17-k20", async () => {
  await api("/api/admin/users", { username: "ayse", name: "Ayşe Demir", role: "personel", password: "Ayse-Parola-2026!", mustChangePassword: false });
  await api("/api/admin/users", { username: "mehmet", name: "Mehmet Kaya", role: "muhasebe", password: "Mehmet-Parola-2026!", mustChangePassword: false });
  await page.goto(`${base}/admin.html`);
  await page.waitForSelector("#adm-users tr[data-id]");
  await page.evaluate(() => { document.querySelector(".adm-top").style.position = "static"; });
  await page.waitForTimeout(300);
  if (want("k20-kurtarma-karti")) { await (await page.$("#adm-recovery")).screenshot({ path: `${OUT}/k20-kurtarma-karti.jpg`, type: "jpeg", quality: 84 }); console.log("✓ k20-kurtarma-karti"); }
  const row = page.locator("#adm-users tr[data-id]", { hasText: "Ayşe" });
  await row.locator("[data-perms]").click();
  await page.waitForSelector(".adm-perm-row .adm-perm-panel");
  await page.locator('.adm-perm-row [data-perm="cash.view"]').check();
  await page.locator('.adm-perm-row [data-perm="records.export"]').uncheck();
  await page.waitForTimeout(300);
  const card = await page.$eval("#adm-users", node => { const t = node.closest("table"); const b = (t.closest("section, .adm-card, .adm-panel") || t).getBoundingClientRect(); return { x: b.x, y: b.y + window.scrollY, width: b.width, height: b.height }; });
  await shot("k17-yetkiler", { fullPage: true, clip: { x: Math.max(0, card.x - 6), y: Math.max(0, card.y - 6), width: card.width + 12, height: Math.min(card.height + 12, 1100) } });
});

await step("k18", async () => {
  const other = await browser.newContext({ viewport: { width: 1100, height: 1000 }, deviceScaleFactor: 1.5, locale: "tr-TR" });
  const p = await other.newPage();
  await p.goto(`${base}/`);
  await p.click("#hof-auth [data-forgot]");
  await p.waitForSelector("#hof-auth [data-local]");
  await p.waitForTimeout(400);
  const cardBox = await p.$eval("#hof-auth [data-local]", node => { let el = node; while (el.parentElement && el.parentElement.id !== "hof-auth") el = el.parentElement; const r = el.getBoundingClientRect(); return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height }; });
  await shot("k18-parolami-unuttum", { fullPage: true, clip: { x: Math.max(0, cardBox.x - 10), y: Math.max(0, cardBox.y - 10), width: cardBox.width + 20, height: cardBox.height + 20 } }, p);
  await other.close();
});

console.log("sayfa hataları:", errors.length ? errors.join(" | ") : "yok");
console.log("başarısız adımlar:", failed.length ? failed.join(" | ") : "yok");
await browser.close();
await app.close();
rmSync(root, { recursive: true, force: true });
