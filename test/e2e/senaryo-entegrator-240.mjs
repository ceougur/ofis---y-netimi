// Entegratör Ayarları kartı EKRANDAN (kullanıcı taslağı + onaylanan 4 düzeltme, 16.10.2026; docs/2.4.0-IS-LISTESI.md İz 2). Sahte EDM
// (test/einvoice-mock.mjs) — gerçek EDM'ye ve canlı adrese hiçbir istek gitmez.
//   1 Fatura → "Entegratör Ayarları" düğmesi → "e-Dönüşüm ve Entegrasyon Ayarları"; üç sekme; Canlı Ortam pasif + nedeni yazılı; Durum "Bağlantı Yok".
//   2 Kullanıcı adı ve parola insan hızında + Tab ile; Göster yalnız yazılan parolayı gösterir; Kaydet → Durum "Bağlantı denenmedi"; parola veri
//     tabanında açık metin değil.
//   3 Bağlantıyı Test Et → Durum "Bağlantı kuruldu"; Etiketleri Getir → GB ve PK listeleri; seçilip kaydedilir (veri tabanından okunur).
//   4 Sekme değişince yazılanlar kaybolmaz; Firma sekmesinde firma özeti (tek kaynak) ve "Fatura Ayarları'nda Düzenle"; Otomatik Seriler kaydedilir.
//   5 Fatura Ayarları'nda e-Belge alanları yok, karta yönlendiren düğme var. Avukat (fatura keser, Fatura Ayarları yetkisi yok): düğme yok.
// Çıkış: "N geçti, M kaldı". Ekran görüntüleri EKRAN_DIR (yoksa geçici klasör).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { MULTI_VKN, OUR_VKN, startMockEdm } from "../einvoice-mock.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";

const PASS = "Personel-2026!";
const root = mkdtempSync(path.join(tmpdir(), "senaryo-entegrator-240-"));
const shots = process.env.EKRAN_DIR || root;
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const edm = await startMockEdm();
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", edocEnabled: true });
const admin = await server.login();
const BASE = server.base;
await must("kurulum geç", admin.post("/api/workspace/bank/setup/dismiss", {}));
await must("avukat", admin.post("/api/admin/users", { username: "avukat", name: "Avukat", role: "avukat", password: PASS, mustChangePassword: false }));
await must("firma", admin.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" } }));
const stored = () => JSON.parse(server.app.store.setting("invoice.settings", "{}"));

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const browser = await chromium.launch();
const errors = [];
const modal = ".hof-modal-backdrop.is-visible";
const card = `${modal} [data-integ-root]`;
async function login(username, password) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => errors.push(`${username}: ${error.message}`));
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open), null, { timeout: 20000 });
  return page;
}
const textOf = (page, selector) => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const shot = (page, name) => page.screenshot({ path: path.join(shots, `${name}.png`) }).catch(() => null);
const status = page => textOf(page, `${card} [data-integ-status]`);
const openInvoices = async page => {
  await page.evaluate(() => window.HOF.invoices.open());
  await page.waitForSelector(`${modal} .hof-invoices-modal`, { timeout: 15000 });
  await page.waitForTimeout(400);
};

try {
  const page = await login("admin", ADMIN_PASSWORD);
  console.log("■ 1 Düğme, kart, sekmeler, canlı ortam kilidi");
  await openInvoices(page);
  ok(await page.$(`${modal} [data-act="integrator"]`), "Fatura sayfasında “Entegratör Ayarları” düğmesi");
  await page.click(`${modal} .hof-invoices-modal [data-act="integrator"]`);
  await page.waitForSelector(`${card} [data-integ-tab]`);
  const title = await textOf(page, `${modal}:last-of-type .hof-modal-title`);
  ok(title === "e-Dönüşüm ve Entegrasyon Ayarları", `başlık: “${title}”`);
  const tabs = await page.$$eval(`${card} [data-integ-tab]`, nodes => nodes.map(node => node.textContent.trim()));
  ok(tabs.join(" | ") === "Entegrasyon Bilgileri | Firma / Etiket Tanımları | Otomatik Seriler", `sekmeler: ${tabs.join(" | ")}`);
  const live = await page.$eval(`${card} input[data-i="env"][value="live"]`, input => ({ disabled: input.disabled, checked: input.checked }));
  const test = await page.$eval(`${card} input[data-i="env"][value="test"]`, input => input.checked);
  ok(live.disabled && !live.checked && test, "Canlı Ortam pasif, Test Ortamı seçili");
  ok(/Canlı ortam, test ortamındaki kabulden sonra açılır/.test(await textOf(page, `${card} [data-integ-live-note]`)), "pasif seçeneğin nedeni yazılı");
  ok(/Bağlantı Yok/.test(await status(page)), `Durum: “${await status(page)}”`);
  const labels = await page.$$eval(`${card} .hof-field > span:first-child`, nodes => nodes.map(node => node.textContent.trim()));
  ok(labels.includes("Gönderici Birim (GB)") && labels.includes("Posta Kutusu (PK)"), `GB ve PK doğru adlarla: ${labels.filter(label => /\((GB|PK)\)/.test(label)).join(", ")}`);
  const autoSend = await page.$eval(`${card} input[data-i="autoSend"]`, input => input.checked);
  ok(!autoSend, "otomatik gönderim varsayılan kapalı");
  await shot(page, "entegrator-1-acilis");

  console.log("\n■ 2 Kullanıcı adı / parola insan hızında, Göster, Kaydet");
  await page.click(`${card} input[data-i="username"]`);
  await page.keyboard.type("edmkullanici", { delay: 35 });
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => document.activeElement?.dataset?.i || "");
  ok(focused === "password", `Tab parolaya geçer (odak: ${focused})`);
  await page.keyboard.type("Gizli-Parola-1", { delay: 35 });
  await page.click(`${card} [data-integ-eye]`);
  const shown = await page.$eval(`${card} input[data-i="password"]`, input => ({ type: input.type, value: input.value }));
  ok(shown.type === "text" && shown.value === "Gizli-Parola-1", "Göster: yazılan parola görünür");
  await page.click(`${card} [data-integ-eye]`);
  await page.fill(`${card} input[data-i="baseUrl"]`, edm.url);
  await page.click(`${card} [data-integ-act="save"]`);
  await page.waitForFunction(selector => /Bağlantı denenmedi/.test(document.querySelector(selector)?.textContent || ""), `${card} [data-integ-status]`, { timeout: 10000 });
  ok(true, `kaydedildi; Durum: “${await status(page)}”`);
  const raw = server.app.store.setting("invoice.settings", "");
  ok(!raw.includes("Gizli-Parola-1") && stored().integrator.username === "edmkullanici", "parola veri tabanında açık metin değil; kullanıcı adı kayıtlı");
  const placeholder = await page.$eval(`${card} input[data-i="password"]`, input => ({ value: input.value, placeholder: input.placeholder }));
  ok(placeholder.value === "" && placeholder.placeholder === "Kayıtlı", "kayıttan sonra parola alanı boş, “Kayıtlı” yazıyor");

  console.log("\n■ 3 Bağlantıyı Test Et, Etiketleri Getir, GB/PK seç ve kaydet");
  await page.click(`${card} [data-integ-act="test"]`);
  await page.waitForFunction(selector => /Bağlantı kuruldu/.test(document.querySelector(selector)?.textContent || ""), `${card} [data-integ-status]`, { timeout: 15000 });
  ok(true, `Durum: “${await status(page)}”`);
  await page.click(`${card} [data-integ-act="aliases"]`);
  await page.waitForFunction(selector => [...(document.querySelector(selector)?.options || [])].some(option => option.value.includes("defaultgb")), `${card} select[data-i="senderAlias"]`, { timeout: 15000 });
  await page.selectOption(`${card} select[data-i="senderAlias"]`, "urn:mail:defaultgb@deneme.com.tr");
  await page.selectOption(`${card} select[data-i="mailboxAlias"]`, "urn:mail:defaultpk@deneme.com.tr");
  await shot(page, "entegrator-2-etiketler");
  await page.click(`${card} [data-integ-act="save"]`);
  await page.waitForTimeout(800);
  const afterAliases = stored().integrator;
  ok(afterAliases.senderAlias === "urn:mail:defaultgb@deneme.com.tr" && afterAliases.mailboxAlias === "urn:mail:defaultpk@deneme.com.tr", `veri tabanında GB ${afterAliases.senderAlias} · PK ${afterAliases.mailboxAlias}`);
  ok(afterAliases.lastTest?.ok === true, "tercih kaydı bağlantı durumunu silmedi");

  console.log("\n■ 4 Sekmeler: yazılanlar kaybolmaz; firma özeti; seriler");
  await page.click(`${card} input[data-i="autoCheckUser"]`);
  await page.click(`${card} [data-integ-tab="firm"]`);
  await page.waitForSelector(`${card} [data-integ-firm]`);
  const firm = await textOf(page, `${card} [data-integ-firm]`);
  ok(firm.includes(OUR_VKN) && firm.includes("Deneme Ofis Ltd."), `firma özeti Fatura Ayarları'ndan: ${firm.slice(0, 80)}`);
  ok(await page.$(`${card} [data-integ-act="firm"]`), "“Fatura Ayarları'nda Düzenle” düğmesi");
  await page.check(`${card} input[data-i="efatura"]`);
  await page.click(`${card} [data-integ-tab="series"]`);
  await page.fill(`${card} input[data-i-series="efatura"]`, "efx");
  await page.click(`${card} [data-integ-tab="connection"]`);
  ok(await page.$eval(`${card} input[data-i="autoCheckUser"]`, input => input.checked), "sekme dönüşünde işaretlenen kutu korunur");
  await page.click(`${card} [data-integ-act="save"]`);
  await page.waitForTimeout(800);
  const all = stored();
  ok(all.integrator.autoCheckUser === true && all.efatura === true && all.series?.efatura === "EFX", `kaydedildi: kendiliğinden sorgu ${all.integrator.autoCheckUser}, e-Fatura ${all.efatura}, seri ${all.series?.efatura}`);
  await page.click(`${card} [data-integ-tab="series"]`);
  await shot(page, "entegrator-3-seriler");

  console.log("\n■ 4b Cari formu: VKN yazılıp alandan çıkınca mükellefiyet kendiliğinden sorgulanır; iki posta kutusu varsa kullanıcı seçer");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.evaluate(() => window.HOF.accounts.newFor({}));
  const formOpen = await page.waitForSelector(`${modal} input[name="taxNo"]`, { timeout: 8000 }).then(() => true).catch(() => false);
  if (ok(formOpen, "Yeni Cari formu açıldı")) {
    await page.fill(`${modal} input[name="name"]`, "Çoklu A.Ş.");
    await page.click(`${modal} input[name="taxNo"]`);
    await page.keyboard.type(MULTI_VKN, { delay: 30 });
    await page.keyboard.press("Tab");
    await page.waitForSelector(`${modal}:last-of-type select[name="alias"]`, { timeout: 10000 });
    const options = await page.$$eval(`${modal}:last-of-type select[name="alias"] option`, nodes => nodes.map(node => node.value));
    const preselected = await page.$eval(`${modal}:last-of-type select[name="alias"]`, node => node.value);
    ok(options.length === 2 && preselected === "urn:mail:defaultpk@coklu.com.tr", `iki PK seçenek, varsayılan defaultpk: ${options.join(", ")} (seçili ${preselected})`);
    await shot(page, "entegrator-4-pk-secimi");
    await page.selectOption(`${modal}:last-of-type select[name="alias"]`, "urn:mail:muhasebepk@coklu.com.tr");
    await page.click(`${modal}:last-of-type .hof-form button[type="submit"]`);
    await page.waitForFunction(() => document.querySelector('input[name="eAlias"]')?.value === "urn:mail:muhasebepk@coklu.com.tr", null, { timeout: 8000 });
    const eInvoice = await page.$eval('input[name="eInvoice"]', node => node.checked);
    ok(eInvoice, "seçilen PK forma yazıldı, e-Fatura mükellefi işaretli");
  }
  for (let index = 0; index < 4 && (await page.$(modal)); index += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
  }

  console.log("\n■ 5 Fatura Ayarları yönlendirmesi; ayar yetkisi olmayan kullanıcı");
  await openInvoices(page);
  await page.click(`${modal} .hof-invoices-modal [data-act="integrator"]`);
  await page.waitForSelector(`${card} [data-integ-tab]`);
  await page.click(`${card} [data-integ-tab="firm"]`);
  await page.click(`${card} [data-integ-act="firm"]`);
  await page.waitForSelector(`${modal} .hof-inv-settings`, { timeout: 10000 });
  const settingsText = await textOf(page, `${modal} .hof-invoices-modal`);
  ok(!(await page.$(`${modal} [data-s="integrator.username"]`)) && /Entegratör Ayarları penceresindedir/.test(settingsText), "Fatura Ayarları'nda e-Belge alanları yok, yönlendirme var");
  const staff = await login("avukat", PASS);
  await openInvoices(staff);
  ok(!(await staff.$(`${modal} [data-act="integrator"]`)) && Boolean(await staff.$(`${modal} [data-act="new"]`)), "avukatta (fatura keser, ayar yetkisi yok) “Entegratör Ayarları” düğmesi yok");
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  ok(edm.state.violations.length === 0, `sahte EDM sözleşme ihlali yok${edm.state.violations.length ? `: ${edm.state.violations.join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-entegrator-240: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await server.close();
  await edm.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
