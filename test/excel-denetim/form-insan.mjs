// İnsan gibi yazma denemesi: alış faturası (senet ödemeli) ve gider faturası formlarında tıkla → harf harf yaz → Tab.
// Yazılan değerler kalıyor mu, yoksa alan değişince form yeniden çizilip siliniyor mu?
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
const { createApp } = await import(process.env.KOD ? `${process.env.KOD}/server/app.mjs` : "../../server/app.mjs");
import { createClient } from "../helpers.mjs";

const PASS = "Prova-Admin-2026!";
const root = mkdtempSync(path.join(tmpdir(), "form-insan-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "error", scheduleBackups: false, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f22" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const api = createClient(BASE);
await api.login("admin", PASS);
const un = r => r.data?.data ?? r.data;
const sup = un(await api.post("/api/workspace/accounts", { name: "Deneme Tedarikçi", type: "supplier" }));
un(await api.post("/api/workspace/stock", { name: "Fren Balata", code: "FB-1", unit: "Adet", unitPrice: 10, salePrice: 20 }));
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" })).newPage();
const inv = ".hof-modal-backdrop.is-visible .hof-invoices-modal";
const shotDir = "/tmp/claude-0/-home-user/f3fde27e-cd8e-54af-b1ca-43dd7d833c3d/scratchpad/form-insan";
await import("node:fs").then(fs => fs.mkdirSync(shotDir, { recursive: true }));
const typeInto = async (selector, text) => {
  await page.click(selector);
  await page.keyboard.press("Control+A");
  await page.keyboard.type(text, { delay: 60 });
};
const values = sel => page.$$eval(sel, nodes => nodes.map(n => (n.type === "checkbox" ? n.checked : n.value)));
try {
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await page.click('#hof-auth button[type="submit"]');
  await page.waitForSelector("#hof-sidecard [data-action=invoices]", { timeout: 60000 });
  await page.waitForTimeout(2000);

  // 1) Alış faturası, ödeme senet: Tutar → Vade → No → Banka (insan gibi; tarih alanına klavyeyle).
  await page.click("#hof-sidecard [data-action=invoices]");
  await page.click(`${inv} [data-act="new"]`);
  await page.click(`${inv} [data-scenario="goods_purchase"]`);
  await page.waitForSelector(`${inv} [data-lines]`);
  await typeInto(`${inv} [data-f="number"]`, "A-1");
  await page.fill(`${inv} [data-acc-query]`, "Deneme Tedarikçi");
  await page.waitForSelector(`${inv} .hof-acc-picker li[data-id]`);
  await (await page.$(`${inv} .hof-acc-picker li[data-id]`)).dispatchEvent("mousedown");
  await page.click(`${inv} [data-l="0"][data-f="name"]`);
  await page.keyboard.type("Fren", { delay: 60 });
  await page.waitForSelector(`${inv} [data-hits="0"] li[data-item]`);
  await page.click(`${inv} [data-hits="0"] li[data-item]`);
  await typeInto(`${inv} [data-l="0"][data-f="qty"]`, "2");
  await typeInto(`${inv} [data-l="0"][data-f="unitPrice"]`, "100");
  await page.waitForTimeout(1200);
  await page.click(`${inv} [data-act="pay-add-cheque"]`);
  await page.selectOption(`${inv} [data-pay="cheques"][data-i="0"][data-f="instrument"]`, "note");
  await typeInto(`${inv} [data-pay="cheques"][data-i="0"][data-f="amount"]`, "240");
  if (process.env.TARIH) {
    const read = async label => console.log(label, JSON.stringify(await values(`${inv} [data-pay="cheques"][data-i="0"]`)));
    // Tutardan hemen sonra (0,3 sn) vade seç — takvimden seçmekle aynı olay (input + change).
    await page.waitForTimeout(Number(process.env.TARIH));
    await page.fill(`${inv} [data-pay="cheques"][data-i="0"][data-f="dueDate"]`, "2025-03-15");
    await page.waitForTimeout(2000);
    await read(`tutardan ${process.env.TARIH} ms sonra vade seçildi, 2 sn:`);
    await page.click(`${inv} [data-pay="cheques"][data-i="0"][data-f="serialNo"]`);
    await page.keyboard.type("S-77", { delay: 100 });
    await page.keyboard.press("Tab");
    await page.keyboard.type("Ziraat", { delay: 100 });
    await page.keyboard.press("Tab");
    await page.waitForTimeout(2000);
    await read("No ve Banka yazılıp Tab, 2 sn:");
  }
  if (process.env.YAVAS) {
    // Tutardan sonra bekleyerek, her alanı ayrı ayrı (insanın yavaş hâli)
    const read = async label => console.log(label, JSON.stringify(await values(`${inv} [data-pay="cheques"][data-i="0"]`)));
    await page.waitForTimeout(2000);
    await read("tutar sonrası 2 sn:");
    await page.click(`${inv} [data-pay="cheques"][data-i="0"][data-f="serialNo"]`);
    await page.keyboard.type("S-77", { delay: 120 });
    await page.waitForTimeout(2000);
    await read("No yazıldı, odak hâlâ No'da, 2 sn:");
    await page.click(`${inv} [data-pay="cheques"][data-i="0"][data-f="bank"]`);
    await page.waitForTimeout(2000);
    await read("Banka'ya tıklandı (No'dan çıkıldı), 2 sn:");
    await page.keyboard.type("Ziraat", { delay: 120 });
    await page.waitForTimeout(2000);
    await read("Banka yazıldı, 2 sn:");
    await page.click(`${inv} [data-f="note"]`);
    await page.waitForTimeout(2000);
    await read("Not alanına tıklandı, 2 sn:");
  }
  await page.click(`${inv} [data-pay="cheques"][data-i="0"][data-f="dueDate"]`);
  await page.keyboard.type("03152025", { delay: 80 });
  await page.keyboard.press("Tab");
  await page.keyboard.type("S-77", { delay: 60 });
  await page.keyboard.press("Tab");
  await page.keyboard.type("Ziraat", { delay: 60 });
  await page.keyboard.press("Tab");
  await page.waitForTimeout(1500);
  const cheque = await values(`${inv} [data-pay="cheques"][data-i="0"]`);
  await page.screenshot({ path: `${shotDir}/1-alis-senet.png` });
  console.log("ALIŞ / SENET alanları (evrak, tutar, vade, no, banka):", JSON.stringify(cheque));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  const yes = await page.$(".hof-modal-backdrop.is-visible [data-answer=\"yes\"]");
  if (yes) await yes.click();
  await page.waitForTimeout(600);

  // 2) Gider faturası: KDV dahil işaretle, kalem adı yaz → Tab → miktar → fiyat → KDV → gider türü.
  await page.click("#hof-sidecard [data-action=invoices]");
  await page.waitForSelector(`${inv} [data-act="new"]`);
  await page.click(`${inv} [data-act="new"]`);
  await page.click(`${inv} [data-scenario="expense_purchase"]`);
  await page.waitForSelector(`${inv} [data-lines]`);
  await typeInto(`${inv} [data-f="number"]`, "G-1");
  await page.fill(`${inv} [data-acc-query]`, "Deneme Tedarikçi");
  await page.waitForSelector(`${inv} .hof-acc-picker li[data-id]`);
  await (await page.$(`${inv} .hof-acc-picker li[data-id]`)).dispatchEvent("mousedown");
  await page.click(`${inv} [data-f="pricesIncludeVat"]`);
  await page.waitForTimeout(800);
  await page.click(`${inv} [data-l="0"][data-f="name"]`);
  await page.keyboard.type("Temizlik Malzemesi", { delay: 60 });
  await page.keyboard.press("Tab");
  await page.waitForTimeout(500);
  await typeInto(`${inv} [data-l="0"][data-f="qty"]`, "1");
  await typeInto(`${inv} [data-l="0"][data-f="unitPrice"]`, "2340,51");
  await page.selectOption(`${inv} [data-l="0"][data-f="vatRate"]`, "20");
  await page.selectOption(`${inv} [data-l="0"][data-f="expenseCode"]`, "cleaning");
  await page.waitForTimeout(1500);
  const line = await page.evaluate(sel => {
    const q = f => document.querySelector(`${sel} [data-l="0"][data-f="${f}"]`)?.value;
    return { kdvDahil: document.querySelector(`${sel} [data-f="pricesIncludeVat"]`)?.checked, ad: q("name"), miktar: q("qty"), fiyat: q("unitPrice"), kdv: q("vatRate"), gider: q("expenseCode"), toplam: document.querySelector(`${sel} [data-totals]`)?.innerText.replace(/\s+/g, " ").slice(0, 160) };
  }, inv);
  await page.screenshot({ path: `${shotDir}/2-gider.png` });
  console.log("GİDER satırı:", JSON.stringify(line));
} catch (error) {
  console.log("HATA", error.message.split("\n")[0]);
  await page.screenshot({ path: `${shotDir}/hata.png` });
} finally {
  await browser.close();
  await app.close();
  rmSync(root, { recursive: true, force: true });
}
