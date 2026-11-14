// 2.5.0 Ç5-A tur 3c — EKRANDAN: şüpheli ↔ kuyruk defter kuralı ve "Normal Cari Hesaba İşle" sınırı (docs/erp/C5-ACILIS-TASARIM.md §19; S168 = B — karar metni
// test/supheli-kuyruk-defter-250.test.mjs başında AYNEN). Kurulum API'den (S168 örneği): Fatura 1 1.000 (−60) → Şüpheliye Al 1.000 (−40) → Fatura 2 500 (−30) → "Normal Cari Hesaba
// İşle" 400 (−20) ⇒ 120 = 100, 128 = 1.000. EKRAN (gerçek tıklama, Tab, insan hızında yazım — ders 12): + Tahsilat → Kapatılacak Fatura = Fatura 2 → 700 → Kaydet: form KAPANMAZ, ileti
// iki tutarı söyler (120'ye düşecek 300, şüpheli dışı borç 100), veri tabanında satır yok; tutarı 300'e düzelt (Tab ile) → Kaydet: form kapanır, 128 = 700, 120 = 100 (veri tabanından
// ve mizandan). Çıkış: "N geçti, M kaldı". Ekran görüntüleri EKRAN_DIR (yoksa geçici klasör).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD, installPageClock } from "../helpers.mjs";
import { escClose } from "./esc-kapat.mjs";

const pad = n => String(n).padStart(2, "0");
const base = new Date();
const day = offset => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, 12, 0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const D0 = day(0);
const root = mkdtempSync(path.join(tmpdir(), "senaryo-supheli-kuyruk-250-"));
const shots = process.env.EKRAN_DIR || root;
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), now: { time: `${D0}T12:00:00+03:00` }, logLevel: "warn" });
const admin = await server.login();
const BASE = server.base;
await must("kurulum geç", admin.post("/api/workspace/bank/setup/dismiss", {}));

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const MODAL = ".hof-modal-backdrop.is-visible";
const top = `${MODAL}:nth-last-child(1 of ${MODAL})`; // ders 39
const card = ".hof-accounts-modal";
const browser = await chromium.launch();
const errors = [];
const textOf = (page, selector) => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const shot = (page, name) => page.waitForTimeout(250).then(() => page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: true }).catch(() => null));
const store = server.app.store;
const gl = accountId => {
  const b = { 120: 0, 128: 0 };
  for (const entry of server.app.ledger.build()) for (const line of entry.lines || []) if ((line.account === "120" || line.account === "128") && line.party === accountId) b[line.account] += line.debit - line.credit;
  return { b120: b[120] / 100, b128: b[128] / 100 };
};
try {
  const acc = await must("cari", admin.post("/api/workspace/accounts", { name: "Kuyruk Ekran Müşterisi", type: "customer", registeredOn: day(-400) }));
  const sale = async (date, amount) => (await must("fatura", admin.post("/api/workspace/invoices", { scenario: "service_sale", accountId: acc.id, issueDate: date, lines: [{ name: "Hizmet", qty: 1, unitPrice: String(amount), vatRate: 0 }], payment: { rest: "open" } }))).id;
  await sale(day(-60), 1000);
  await must("şüpheliye al", admin.post(`/api/workspace/accounts/${acc.id}/doubtful`, { amount: "1000", date: day(-40), reason: "lawsuit", note: "dava" }));
  const f2 = await sale(day(-30), 500);
  const f2no = store.get("SELECT number FROM invoices WHERE id = ?", f2).number;
  await must("Normal Cari Hesaba İşle 400", admin.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "400", date: day(-20), method: "cash", cashForce: true, similarOk: true, doubtfulSkip: true }));
  ok(JSON.stringify(gl(acc.id)) === JSON.stringify({ b120: 100, b128: 1000 }), `kurulum: ${JSON.stringify(gl(acc.id))} (120 = 100, 128 = 1.000)`);
  const rows = () => Number(store.get("SELECT COUNT(*) AS n FROM account_entries WHERE account_id = ?", acc.id).n);
  const start = rows(); // iki faturanın cari satırı + Normal Cari Hesaba İşle

  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => errors.push(error.message));
  await installPageClock(page, server.app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.HOF?.accounts?.open), null, { timeout: 20000 });
  await page.evaluate(id => window.HOF.accounts.open(id), acc.id);
  await page.waitForSelector(`${card} .hof-plan-head`, { timeout: 10000 });
  await page.waitForTimeout(400);

  console.log("\n■ 1 + Tahsilat → Kapatılacak Fatura = Fatura 2 → 700 (120'ye düşecek 300 > şüpheli dışı borç 100): RET, form açık, ileti iki tutarı söyler");
  await page.click(`${card} [data-entry="in"]`);
  await page.waitForSelector(`${top} .hof-form input[name="amount"]`);
  const help = await textOf(page, `${top} .hof-form`);
  ok(/faturanın şüpheli alacakta sayılan kısmı kadar önce şüpheli alacaktan düşer/.test(help), "formun yardım metni yeni kuralı söyler");
  await page.click(`${top} input[name="amount"]`);
  await page.keyboard.type("700", { delay: 120 });
  await page.keyboard.press("Tab");
  const option = await page.$eval(`${top} select[name="invoiceId"]`, (node, id) => [...node.options].some(o => o.value === id), f2).catch(() => false);
  ok(option, "Kapatılacak Fatura listesinde Fatura 2 var");
  await page.selectOption(`${top} select[name="invoiceId"]`, f2);
  await page.focus(`${top} select[name="invoiceId"]`);
  await page.keyboard.press("Tab");
  await page.waitForTimeout(300);
  await page.click(`${top} .hof-form button[type="submit"]`);
  await page.waitForTimeout(1200);
  const open = Boolean(await page.$(`${top} .hof-form input[name="amount"]`));
  const message = await textOf(page, top);
  ok(open, "form kapanmadı");
  ok(/Normal cari hesaba işlenecek kısım \(300,00 TL; 700,00 TL tahsilatın 400,00 TL'si faturanın şüpheli alacaktaki payından düşüyor\)/.test(message) && /şüpheli dışı borç bakiyesini \(100,00 TL\) aşıyor/.test(message), `ileti: “${(message.match(/Normal cari hesaba[^.]*\./) || [message.slice(0, 200)])[0]}”`);
  ok(rows() === start && JSON.stringify(gl(acc.id)) === JSON.stringify({ b120: 100, b128: 1000 }), `veri tabanı: satır yazılmadı (${rows()} satır, başta ${start}; ${JSON.stringify(gl(acc.id))})`);
  await shot(page, "supheli-kuyruk-1-ret");

  console.log("\n■ 2 Tutarı 300'e düzelt (seç + yaz + Tab) → Kaydet: KABUL (bugünkü kuralda 409 idi); 128 = 700, 120 = 100");
  await page.click(`${top} input[name="amount"]`, { clickCount: 3 });
  await page.keyboard.type("300", { delay: 120 });
  await page.keyboard.press("Tab");
  await page.waitForTimeout(300);
  await page.click(`${top} .hof-form button[type="submit"]`);
  const closed = await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop.is-visible .hof-form input[name=\"amount\"]"), null, { timeout: 10000 }).then(() => true).catch(() => false);
  ok(closed, "form kapandı (kayıt alındı)");
  await page.waitForTimeout(800);
  const after = gl(acc.id);
  ok(rows() === start + 1 && after.b120 === 100 && after.b128 === 700, `veri tabanı: ${rows()} satır (başta ${start} + 1), ${JSON.stringify(after)} (128 = 700, 120 = 100)`);
  const entry = store.get("SELECT amount, invoice_id AS invoiceId, doubtful_skip AS skip FROM account_entries WHERE account_id = ? ORDER BY rowid DESC LIMIT 1", acc.id);
  ok(Number(entry.amount) === 300 && entry.invoiceId === f2 && Number(entry.skip) === 0, `yeni satır: ${JSON.stringify(entry)} (Fatura 2 ${f2no})`);
  const ledger = await must("mizan", admin.get("/api/workspace/ledger"));
  const map = Object.fromEntries(ledger.trial.accounts.map(row => [row.code, row.balance]));
  ok(Number(map["128"]) === 700 && Number(map["120"]) === 100, `mizan: 128 = ${map["128"]}, 120 = ${map["120"]}`);
  const integrity = await must("Mutabakat Testi", admin.get("/api/workspace/ledger/integrity"));
  ok(integrity.ok === true, "Mutabakat Testi tamam (iki yükleyici aynı kural)");
  await shot(page, "supheli-kuyruk-2-kabul");

  // 2.5.0 Ç5-A tur 3d (BAŞ MİMAR KARARI 14.11 09:00 (2)): etiket ayırıcının payından — pay 0 → "Normal Cariye İşlendi"; tamamı şüpheliden düştüyse etiket yok; kısmi → "Kısmen
  // Normal Cariye İşlendi" + 120'ye düşen tutar. S168 = B'nin sözü: F2'ye bağlı 300'den sonra kuyruk şüphelisi 700 = F1 600 + F2 100 → F2'ye bağlı 200: 100'ü 128'den, 100'ü 120'den.
  console.log("\n■ 3 Hareketler etiketi: işaretli 400 'Normal Cariye İşlendi', F2'ye bağlı 300 (tamamı 128) etiketsiz; F2'ye bağlı 200 → 'Kısmen Normal Cariye İşlendi (₺100,00)'");
  const tags = async () => ({
    full: await page.$$eval(`${card} .hof-plans-entries [data-doubtful-normal]`, nodes => nodes.map(node => node.textContent.trim())).catch(() => []),
    part: await page.$$eval(`${card} .hof-plans-entries [data-doubtful-normal-part]`, nodes => nodes.map(node => node.textContent.replace(/\s+/g, " ").trim())).catch(() => []),
  });
  const reopen = async () => {
    await escClose(page).catch(() => null);
    await page.evaluate(id => window.HOF.accounts.open(id), acc.id);
    await page.waitForSelector(`${card} .hof-plans-entries`, { timeout: 10000 });
    await page.waitForTimeout(500);
  };
  await reopen();
  const t1 = await tags();
  ok(JSON.stringify(t1) === JSON.stringify({ full: ["Normal Cariye İşlendi"], part: [] }), `etiketler (300'den sonra): ${JSON.stringify(t1)} (yalnız işaretli 400'de 'Normal Cariye İşlendi')`);
  await must("F2'ye bağlı 200", admin.post(`/api/workspace/accounts/${acc.id}/entries`, { kind: "in", amount: "200", date: D0, method: "cash", cashForce: true, similarOk: true, invoiceId: f2 }));
  const after200 = gl(acc.id);
  ok(after200.b120 === 0 && after200.b128 === 600, `veri tabanı: ${JSON.stringify(after200)} (128 = 600, 120 = 0)`);
  await reopen();
  const t2 = await tags();
  ok(JSON.stringify(t2) === JSON.stringify({ full: ["Normal Cariye İşlendi"], part: ["Kısmen Normal Cariye İşlendi (₺100,00)"] }), `etiketler (200'den sonra): ${JSON.stringify(t2)} (tutar ekranın para biçimiyle)`);
  await page.$eval(`${card} .hof-plans-entries`, node => node.scrollIntoView({ block: "center" })).catch(() => null);
  await shot(page, "supheli-kuyruk-3-etiket");
  await page.locator(`${card} .hof-plans-entries`).first().screenshot({ path: path.join(shots, "supheli-kuyruk-3-hareketler.png") }).catch(() => null);
  await escClose(page).catch(() => null);
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-supheli-kuyruk-250: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await server.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
