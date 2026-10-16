// CANLI EDM — ENTEGRATÖR AYARLARI KARTIYLA EKRANDAN (16.10.2026, kullanıcı: "kartı kullandın mı… onu da dene"). Canlı açık üretim ayarı
// (edocLive: true); Çalışma Ortamı "Canlı Ortam", Servis Adresi BOŞ (programın canlı adresi), BİLEREK var olmayan kullanıcı → Kaydet → Bağlantıyı
// Test Et. Belge oluşturulmaz, gerçek hesaba dokunulmaz; beklenen: EDM'nin "Kullanıcı Bulunamadı!" yanıtı ekranda Türkçe.
import { mkdirSync } from "node:fs";
import path from "node:path";
const R = "/home/user/ofis---y-netimi";
const { chromium } = await import(`${R}/node_modules/playwright/index.mjs`);
const { startTestServer, ADMIN_PASSWORD } = await import(`${R}/test/helpers.mjs`);
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const log = (label, value = "") => console.log(`${new Date().toISOString().slice(11, 19)} ${label}${value === "" ? "" : `: ${typeof value === "string" ? value : JSON.stringify(value)}`}`);
const unwrap = r => ({ ...r, data: r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data });
const server = await startTestServer({ edocEnabled: true, edocLive: true, env: { HUKUK_LICENSE_URL: "http://127.0.0.1:9" } });
const api = server.client();
await api.login("admin", ADMIN_PASSWORD);
await api.post("/api/workspace/bank/setup/dismiss", {});
const firm = unwrap(await api.put("/api/workspace/invoices/settings", { seller: { name: "DESTEK OFİS", taxNo: "3230512384", taxOffice: "Kadıköy", address: "Moda Cd. 12", district: "Kadıköy", city: "İstanbul" }, efatura: true, earsiv: true }));
log("FİRMA (API)", { status: firm.status });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const modal = ".hof-modal-backdrop.is-visible";
const card = `${modal} [data-integ-root]`;
const inv = `${modal} .hof-invoices-modal`;
const textOf = selector => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
try {
  await page.goto(`${server.base}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open), null, { timeout: 30000 });
  await page.click("#hof-sidecard [data-action=invoices]");
  await page.waitForSelector(`${inv} [data-act="integrator"]`);
  await page.click(`${inv} [data-act="integrator"]`);
  await page.waitForSelector(`${card} input[data-i="username"]`);
  await page.click(`${card} input[data-i="env"][value="live"]`);
  log("CANLI NOTU (ekran)", await textOf(`${card} [data-integ-live-note]`));
  await page.click(`${card} input[data-i="username"]`);
  await page.keyboard.type("destekofis-baglanti-denemesi", { delay: 35 });
  await page.keyboard.press("Tab");
  await page.keyboard.type("bilerek-yanlis-parola", { delay: 35 });
  await page.screenshot({ path: path.join(OUT, "01-canli-ortam-secildi.png") });
  await page.click(`${card} [data-integ-act="save"]`);
  await page.waitForFunction(sel => /Bağlantı denenmedi|Bağlantı kuruldu/.test(document.querySelector(sel)?.textContent || ""), `${card} [data-integ-status]`);
  const saved = unwrap(await api.get("/api/workspace/invoices/settings")).data?.integrator || {};
  log("KAYIT (veri tabanı)", { env: saved.env, url: saved.url, baseUrl: saved.baseUrl || "" });
  await page.click(`${card} [data-integ-act="test"]`);
  await page.waitForFunction(sel => !/denenmedi|deneniyor/i.test(document.querySelector(sel)?.textContent || ""), `${card} [data-integ-status]`, { timeout: 90000 });
  await page.waitForTimeout(500);
  log("BAĞLANTIYI TEST ET — DURUM SATIRI (ekran)", await textOf(`${card} [data-integ-status]`));
  const toasts = await page.$$eval(".hof-toast, [role=alert], .hof-notice", nodes => nodes.map(node => node.textContent.replace(/\s+/g, " ").trim()).filter(Boolean)).catch(() => []);
  log("BİLDİRİM (ekran)", toasts);
  await page.screenshot({ path: path.join(OUT, "02-canli-baglanti-sonucu.png") });
  log("SAYFA HATASI", errors);
} finally {
  await browser.close();
  await server.close();
}
