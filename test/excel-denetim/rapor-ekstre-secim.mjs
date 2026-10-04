// Bulgu denemesi (kod değiştirmez): Raporlar → Tüm Raporlar → Cari Ekstre. Kullanıcı cariyi yazıp listeden tıklar, ekstre
// gelir; sonra dönem düğmesine ("Tüm Zamanlar", "Bu Yıl"…) ya da tarih yazıp "Ön İzle"ye basar. Seçili cari korunuyor mu?
// Gerçek tıklamalarla (harf harf yazma, fareyle seçme). Kullanım: node rapor-ekstre-secim.mjs
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { HERE, PASS, staff, startServer } from "./ortak.mjs";

const SP = process.env.SP || path.join(HERE, "calisma");
const SHOTS = path.join(HERE, "cikti", "rapor-ekstre-secim");
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const app = startServer(path.join(SP, "rapor-ekstre-secim"), { fresh: true });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const c = staff(BASE);
if ((await c.login("admin", PASS)).status !== 200) throw new Error("giriş");
const acc = (await c.post("/api/workspace/accounts", { name: "Deniz Yapı Malzemeleri Ltd. Şti.", type: "customer", registeredOn: "2025-01-01" })).data;
await c.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: 400, date: "2025-01-20", method: "cash", note: "tahsilat" });
// İkinci bölüm için: iki cariye birer satış faturası (fatura raporundaki isteğe bağlı cari süzgeci).
const other = (await c.post("/api/workspace/accounts", { name: "Başka Müşteri A.Ş.", type: "customer", registeredOn: "2025-01-01" })).data;
const hizmet = (await c.post("/api/workspace/stock", { kind: "service", code: "HZM", name: "Hizmet", unit: "Adet", salePrice: "1000" })).data;
for (const [who, price, day] of [[acc, 1000, "2026-01-05"], [other, 5000, "2026-01-06"]]) {
  const r = await c.post("/api/workspace/invoices", { scenario: "service_sale", accountId: who.id, issueDate: day, lines: [{ itemId: hizmet.id, qty: 1, unitPrice: price, vatRate: 0 }], payment: { rest: "open", dueDate: day } });
  if (r.status !== 200) throw new Error(`fatura ${r.status} ${JSON.stringify(r.data)}`);
}
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" })).newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const modal = ".hof-modal-backdrop.is-visible";
const main = `${modal} [data-rc-main]`;
const state = async label => {
  const s = await page.evaluate(sel => ({
    secili: document.querySelector(`${sel} [data-account-slot] [data-acc-query]`)?.value || "",
    ozet: [...document.querySelectorAll(`${sel} .hof-rc-summary span`)].map(span => span.innerText.replace(/\s+/g, " ")).join(" | "),
    bos: document.querySelector(`${sel} > .hof-empty, ${sel} p.hof-empty`)?.innerText || "",
  }), main);
  await page.screenshot({ path: path.join(SHOTS, `${label}.png`) });
  console.log(`${label}: cari kutusu "${s.secili}" · ${s.ozet || s.bos}`);
  return s;
};
const out = {};
try {
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard [data-action=analytics]", { timeout: 30000 });
  await page.click("#hof-sidecard [data-action=analytics]");
  await page.click(`${modal} .hof-rep-tab[data-tab="all"]`);
  await page.click(`${modal} [data-rc-list] [data-report="cari-ekstre"]`);
  await page.click(`${main} [data-account-slot] [data-acc-query]`);
  await page.keyboard.type("Deniz", { delay: 80 });
  await page.waitForSelector(`${main} [data-account-slot] li[data-id="${acc.id}"]`);
  await page.click(`${main} [data-account-slot] li[data-id="${acc.id}"]`);
  await page.waitForSelector(`${main} .hof-rc-summary`, { timeout: 15000 });
  await page.waitForTimeout(800);
  out.secildi = await state("1-cari-secildi");
  await page.click(`${main} [data-preset="all"]`);
  await page.waitForTimeout(2000);
  out.tumZamanlar = await state("2-tum-zamanlar-tiklandi");
  // Cari yeniden seçilir; bu kez tarih yazılıp "Ön İzle".
  if (!out.tumZamanlar.ozet) {
    await page.click(`${main} [data-account-slot] [data-acc-query]`);
    await page.keyboard.type("Deniz", { delay: 80 });
    await page.waitForSelector(`${main} [data-account-slot] li[data-id="${acc.id}"]`);
    await page.click(`${main} [data-account-slot] li[data-id="${acc.id}"]`);
    await page.waitForSelector(`${main} .hof-rc-summary`, { timeout: 15000 });
    await page.waitForTimeout(800);
  }
  await page.fill(`${main} [data-param="from"]`, "2025-01-01");
  await page.fill(`${main} [data-param="to"]`, "2025-01-31");
  await page.click(`${main} [data-rc-run]`);
  await page.waitForTimeout(2000);
  out.onIzle = await state("3-tarih-on-izle");
  await page.click(`${main} [data-preset="thisYear"]`);
  await page.waitForTimeout(2000);
  out.buYil = await state("4-bu-yil-tiklandi");
  // Satış Faturaları: cari süzgeci (isteğe bağlı) seçilir, sonra dönem düğmesi.
  await page.click(`${modal} [data-rc-list] [data-report="fatura-satis"]`);
  await page.waitForSelector(`${main} .hof-rc-summary`, { timeout: 15000 });
  await page.click(`${main} [data-preset="all"]`);
  await page.waitForTimeout(1500);
  out.faturaTumu = await state("5-fatura-tum-cariler");
  await page.click(`${main} [data-account-slot] [data-acc-query]`);
  await page.keyboard.type("Deniz", { delay: 80 });
  await page.waitForSelector(`${main} [data-account-slot] li[data-id="${acc.id}"]`);
  await page.click(`${main} [data-account-slot] li[data-id="${acc.id}"]`);
  await page.waitForTimeout(2000);
  out.faturaSuzuldu = await state("6-fatura-deniz-suzuldu");
  await page.click(`${main} [data-preset="thisYear"]`);
  await page.waitForTimeout(2000);
  out.faturaBuYil = await state("7-fatura-bu-yil-tiklandi");
  out.sayfaHatalari = errors;
  console.log(`sayfa hataları: ${errors.length ? errors.join(" ; ") : "yok"}`);
  fs.writeFileSync(path.join(HERE, "cikti", "rapor-ekstre-secim.json"), JSON.stringify(out, null, 1));
} finally {
  await browser.close();
  await app.close();
}
