// Bulgu 1 kanıtı (kod değiştirmez; bağımsız gözden geçirmeden sonra yeniden yazıldı): alış faturasında ödeme "Senet".
// Kullanıcı Tutar → Tab → Vade → Tab → No → Tab → Banka yazar (klavye) ya da her alana fareyle tıklayıp yazar; sonra
// Kaydet. Kaydedilen faturanın durumu ve Çek/Senet sayısı API'den okunur. Kullanım: node odeme-alani-kaydet.mjs
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { HERE, PASS, staff, startServer } from "./ortak.mjs";

const SP = process.env.SP || path.join(HERE, "calisma");
const SHOTS = path.join(HERE, "cikti", "odeme-alani-kaydet");
fs.rmSync(SHOTS, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const app = startServer(path.join(SP, "odeme-alani-kaydet"), { fresh: true });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const api = staff(BASE);
if ((await api.login("admin", PASS)).status !== 200) throw new Error("giriş");
await api.post("/api/workspace/accounts", { name: "Deneme Tedarikçi", type: "supplier", registeredOn: "2025-01-01" });
await api.post("/api/workspace/stock", { name: "Fren Balata", code: "FB-1", unit: "Adet", unitPrice: 10, salePrice: 20 });
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "tr-TR" })).newPage();
const inv = ".hof-modal-backdrop.is-visible .hof-invoices-modal";
const f = name => `${inv} [data-pay="cheques"][data-i="0"][data-f="${name}"]`;
const focus = () => page.evaluate(() => {
  const a = document.activeElement;
  return a ? `${a.tagName}${a.dataset?.f ? `[${a.dataset.f}]` : ""}` : "yok";
});
const out = [];
async function attempt({ label, amount, mode, number }) {
  await page.click("#hof-sidecard [data-action=invoices]");
  await page.waitForSelector(`${inv} [data-act="new"]`);
  await page.click(`${inv} [data-act="new"]`);
  await page.click(`${inv} [data-scenario="goods_purchase"]`);
  await page.waitForSelector(`${inv} [data-lines]`);
  await page.fill(`${inv} [data-f="number"]`, number);
  await page.fill(`${inv} [data-acc-query]`, "Deneme Tedarikçi");
  await page.waitForSelector(`${inv} .hof-acc-picker li[data-id]`);
  await (await page.$(`${inv} .hof-acc-picker li[data-id]`)).dispatchEvent("mousedown");
  await page.click(`${inv} [data-l="0"][data-f="name"]`);
  await page.keyboard.type("Fren", { delay: 60 });
  await page.waitForSelector(`${inv} [data-hits="0"] li[data-item]`);
  await page.click(`${inv} [data-hits="0"] li[data-item]`);
  await page.click(`${inv} [data-l="0"][data-f="qty"]`);
  await page.keyboard.press("Control+A");
  await page.keyboard.type("2", { delay: 60 });
  await page.click(`${inv} [data-l="0"][data-f="unitPrice"]`);
  await page.keyboard.press("Control+A");
  await page.keyboard.type("100", { delay: 60 });
  await page.waitForTimeout(1500);
  await page.click(`${inv} [data-act="pay-add-cheque"]`);
  await page.selectOption(f("instrument"), "note");
  const trail = [];
  await page.click(f("amount"));
  await page.keyboard.press("Control+A");
  await page.keyboard.type(amount, { delay: 80 });
  for (const [name, text] of [["dueDate", "03152025"], ["serialNo", "S-77"], ["bank", "Ziraat"]]) {
    if (mode === "klavye") await page.keyboard.press("Tab");
    else await page.click(f(name));
    trail.push(`${name} için odak: ${await focus()}`);
    await page.keyboard.type(text, { delay: 80 });
  }
  await page.keyboard.press("Tab");
  await page.waitForTimeout(1500);
  const fields = await page.evaluate(sel => Object.fromEntries(["instrument", "amount", "dueDate", "serialNo", "bank"].map(n => [n, document.querySelector(`${sel} [data-pay="cheques"][data-i="0"][data-f="${n}"]`)?.value ?? "(yok)"])), inv);
  await page.screenshot({ path: path.join(SHOTS, `${label}-kaydetmeden-once.png`) });
  await page.click(`${inv} [data-act="issue"]`);
  await page.waitForTimeout(1000);
  const ask = await page.$(".hof-modal-backdrop.is-visible [data-answer=\"yes\"]");
  const question = ask ? await page.$$eval(".hof-modal-backdrop.is-visible .hof-modal-text", n => n.map(x => x.innerText).join(" ")) : "";
  if (ask) await ask.click();
  await page.waitForTimeout(2500);
  const formError = await page.$eval(`${inv} [data-form-error]`, n => n.textContent.trim()).catch(() => "");
  const list = (await api.get("/api/workspace/invoices?tab=all&limit=50")).data.invoices || [];
  const saved = list.find(d => d.number === number);
  const cheques = ((await api.get("/api/workspace/cheques?status=all&limit=200")).data.cheques || []).filter(c => String(c.serialNo || "").includes("S-77") || c.amount === Number(amount));
  const row = { label, mod: mode, tutar: amount, odakIzi: trail, kaydetmedenOnceAlanlar: fields, soru: question, formHatasi: formError, kaydedilenFatura: saved ? { no: saved.number, odenecek: saved.tryPayable, odenen: saved.paid, acik: saved.open, durum: saved.payStateLabel } : null, cekSenet: cheques.length };
  out.push(row);
  console.log(`■ ${label}\n  ${trail.join(" · ")}\n  kaydetmeden önce alanlar ${JSON.stringify(fields)}\n  soru: ${question || "yok"} · form hatası: ${formError || "yok"}\n  kaydedilen fatura: ${JSON.stringify(row.kaydedilenFatura)} · senet: ${cheques.length}`);
  for (let i = 0; i < 4 && (await page.$(".hof-modal-backdrop.is-visible")); i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const yes = await page.$(".hof-modal-backdrop.is-visible [data-answer=\"yes\"]");
    if (yes) await yes.click();
  }
}
try {
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard [data-action=invoices]", { timeout: 60000 });
  await page.waitForTimeout(1500);
  await attempt({ label: "1-klavye-tam-240", amount: "240", mode: "klavye", number: "K-1" });
  await attempt({ label: "2-klavye-kismi-100", amount: "100", mode: "klavye", number: "K-2" });
  await attempt({ label: "3-fare-kismi-100", amount: "100", mode: "fare", number: "K-3" });
  await attempt({ label: "4-fare-tam-240", amount: "240", mode: "fare", number: "K-4" });
  fs.writeFileSync(path.join(HERE, "cikti", "odeme-alani-kaydet.json"), JSON.stringify(out, null, 1));
} finally {
  await browser.close();
  await app.close();
}
