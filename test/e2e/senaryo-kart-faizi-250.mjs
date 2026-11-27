// Senaryo 2.5.0 Ç7a — D-07 Kart faizi / gecikme bedeli EKRANDAN (docs/erp/C7A-BANKA-TASARIM.md §2; kural kitabı D-07 "Kart faizi / gecikme bedeli | 780 | 309.NN").
// Gerçek kullanıcı gibi: tıklama + klavye (Tab, insan hızında yazım); sayılar ekrandan okunur ve sunucudan (hesap kartı, İşlem Kartı, mizan, Mutabakat Testi) doğrulanır.
// Sahte saat 08.10.2026 Perşembe (sunucu config.now + Playwright page.clock). Bağımsız beklenen: kitabın satırı (B 780 faiz + BSMV / A 309.k), programın çıktısı değil.
//  1. Kart hesabının Hesap Detayı'nda "+ Kart Faizi" (Kart Borcu Ödemesi'nin yanında); tıklanınca Faiz formu: İşlem Türü Faiz Gideri seçili, Banka Hesabı = kart.
//  2. Tutar 200 ve BSMV / KKDF 10 klavyeyle (Tab); önizleme "Kart Borcuna Eklenen ₺210,00"; Kaydet → kart borcu 5.000 → 5.210 (ekranda ve sunucuda);
//     fiş satırları B 780 200 · B 780 10 / A 309.k 210; Ziraat bakiyesi değişmez; mizan 780 = 210; mutabakat temiz.
//  3. Aynı formda İşlem Türü Faiz Geliri seçilince hesap listesinde kart YOK (kartta faiz geliri yok); Esc → hiçbir şey yazılmaz.
//  4. + Planlı İşlem → Faiz Gideri: hesap listesinde kart YOK (kart faizi planlanmaz).
//  5. Pasif kartta "+ Kart Faizi" pasif ve nedeni görünür yazı ("Hesap pasif; işlem girmek için önce Etkinleştir.").
// Çalıştırma: node test/e2e/senaryo-kart-faizi-250.mjs (ekran görüntüleri artifacts/senaryo-kart-faizi-250/). CI listesine ana oturum ekler.
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient, installPageClock } from "../helpers.mjs";
import { escClose } from "./esc-kapat.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-kart-faizi-250");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-kart-faizi-250-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, maxCompanies: 2, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f40" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const clock = app.config.now;
const browser = await chromium.launch();
const errors = [];
let passed = 0;
let failed = 0;
let shotNo = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const shot = async (page, name) => {
  shotNo += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) });
};
const step = async (title, fn) => {
  console.log(`\n${title}`);
  try {
    await fn();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ adım durdu: ${error.stack || error.message}`);
    if (page) await shot(page, "hata").catch(() => null);
  }
};
const api = createClient(BASE);
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
const bankWin = ".hof-bank-modal";
const form = "form.hof-bank-voucher";
const textOf = (p, selector) => p.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const balanceOf = async id => (await must("hesap", api.get(`/api/workspace/bank/accounts/${id}`))).balanceMinor;
const options = (p, name) => p.$$eval(`${form} [name="${name}"] option`, list => list.map(node => ({ value: node.value, label: node.textContent.trim() })));
let page = null;

try {
  await api.login("admin", PASS);
  await must("sihirbazı kapat", api.post("/api/workspace/bank/setup/dismiss", {}));
  const ZIRAAT = await must("Ziraat", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
  const CARD = await must("kart", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Şirket Kartı", kind: "card", creditLimit: "50.000", opening: { date: "2026-10-01", amount: "5.000", confirmed: true } }));
  const OLD = await must("eski kart", api.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Eski Kart", kind: "card", creditLimit: "10.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } }));
  await must("eski kart pasif", api.post(`/api/workspace/bank/accounts/${OLD.id}/status`, { status: "passive" }));
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  page = await context.newPage();
  page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error" && !/status of 40[0139]|api\/auth\/me|Failed to load resource/.test(`${message.text()} ${message.location().url}`)) errors.push(`console ${message.text()}`);
  });
  await installPageClock(page, clock);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForTimeout(700);
  const openCard = async (id, { passive = false } = {}) => {
    if (!(await page.$(`${bankWin} [data-bank] .hof-bank-tabs`))) {
      await page.click('#hof-sidecard [data-action="bank"]');
      await page.waitForSelector(`${bankWin} [data-bank] .hof-bank-tabs`, { timeout: 15000 });
    }
    await page.click(`${bankWin} .hof-bank-tabs [data-tab="accounts"]`);
    // Hesaplar listesi varsayılan "Etkin" süzgeciyle açılır; pasif hesap "Pasif" çipinden.
    if (passive) {
      await page.waitForSelector(`${bankWin} [data-status="passive"]`, { timeout: 10000 });
      await page.click(`${bankWin} [data-status="passive"]`);
    }
    await page.waitForSelector(`${bankWin} .hof-bank-accounts tbody tr[data-account="${id}"]`, { timeout: 10000 });
    await page.click(`${bankWin} .hof-bank-accounts tbody tr[data-account="${id}"]`);
    await page.waitForSelector(`${bankWin} [data-bank-balance]`, { timeout: 10000 });
    await page.waitForTimeout(400);
  };

  await step("1. Kart hesabının Hesap Detayı'nda + Kart Faizi; form Faiz Gideri ve kartla açılır", async () => {
    await openCard(CARD.id);
    const button = await page.$(`${bankWin} [data-act="v-card-interest"]`);
    ok(Boolean(button) && (await button.textContent()).trim() === "+ Kart Faizi", "Hesap Detayı'nda '+ Kart Faizi' düğmesi");
    ok((await button.getAttribute("disabled")) === null, "etkin kartta düğme etkin");
    ok(Boolean(await page.$(`${bankWin} [data-act="v-card"]`)), "Kart Borcu Ödemesi düğmesi yerinde");
    await shot(page, "kart-hesap-detayi");
    await button.click();
    await page.waitForSelector(`${form} [name="type"]`, { timeout: 8000 });
    const types = await options(page, "type");
    ok(types.map(item => item.label).join(",") === "Faiz Geliri,Faiz Gideri", `İşlem Türü seçenekleri: ${types.map(item => item.label).join(", ")}`);
    ok((await page.$eval(`${form} [name="type"]`, node => node.value)) === "interest_out", "İşlem Türü Faiz Gideri seçili");
    const accounts = await options(page, "accountId");
    ok(accounts.some(item => item.value === CARD.id) && accounts.some(item => item.value === ZIRAAT.id) && !accounts.some(item => item.value === OLD.id), `hesap listesi: ${accounts.map(item => item.label).join(" | ")} (kart ve Ziraat; pasif kart yok)`);
    ok((await page.$eval(`${form} [name="accountId"]`, node => node.value)) === CARD.id, "Banka Hesabı = Şirket Kartı (hesap detayından seçili)");
    // 2.5.0 Ç7a tur 2b (iş 4; yazım düzeni): kart seçiliyken alanın adı "Kredi Kartı", vadesiz hesap seçilince "Banka Hesabı".
    const fieldName = () => page.$eval(`${form} [name="accountId"]`, node => (node.closest(".hof-field")?.querySelector(":scope > span")?.firstChild?.textContent || "").trim());
    ok((await fieldName()) === "Kredi Kartı", `kart seçiliyken alan adı: "${await fieldName()}"`);
    await page.selectOption(`${form} [name="accountId"]`, ZIRAAT.id);
    await page.waitForTimeout(200);
    ok((await fieldName()) === "Banka Hesabı", `Ziraat seçilince alan adı: "${await fieldName()}"`);
    await page.selectOption(`${form} [name="accountId"]`, CARD.id);
    await page.waitForTimeout(200);
    ok((await fieldName()) === "Kredi Kartı", "karta dönünce yine Kredi Kartı");
  });

  await step("2. Klavyeyle 200 + BSMV 10; önizleme Kart Borcuna Eklenen 210; Kaydet → kart borcu 5.210, B 780 / A 309.k", async () => {
    const ziraatBefore = await balanceOf(ZIRAAT.id);
    await page.click(`${form} [name="amount"]`);
    await page.keyboard.type("200", { delay: 90 });
    await page.keyboard.press("Tab");
    // Tab sırası: Faiz Tutarı'ndan sonraki görünür alan BSMV / KKDF Tutarı.
    ok((await page.evaluate(() => document.activeElement?.getAttribute("name"))) === "taxAmount", `Tab ile BSMV / KKDF alanına geçildi (${await page.evaluate(() => document.activeElement?.getAttribute("name"))})`);
    await page.keyboard.type("10", { delay: 90 });
    await page.keyboard.press("Tab");
    await page.waitForTimeout(300);
    const preview = await textOf(page, `${form} [data-voucher-preview]`);
    ok(preview.includes("Kart Borcuna Eklenen ₺210,00") && preview.includes("Faiz ₺200,00") && preview.includes("BSMV / KKDF ₺10,00") && !preview.includes("Bankadan Çıkan"), `önizleme: ${preview}`);
    await shot(page, "kart-faizi-formu");
    await page.click(`${form} button[type="submit"]`);
    await page.waitForSelector(form, { state: "detached", timeout: 10000 });
    await page.waitForTimeout(800);
    ok((await balanceOf(CARD.id)) === -521_000, `kart borcu 5.210 (sunucu ${(await balanceOf(CARD.id)) / 100})`);
    const head = await textOf(page, `${bankWin} [data-bank-balance]`);
    ok(head.includes("5.210,00"), `ekranda kart borcu: ${head}`);
    const event = (await must("hareketler", api.get(`/api/workspace/bank/movements?account=${CARD.id}`))).rows.find(row => row.type === "interest_out");
    ok(Boolean(event), "kartın hareketlerinde Faiz Gideri satırı");
    const card = await must("İşlem Kartı", api.get(`/api/workspace/bank/events/${encodeURIComponent(event.eventId || event.id)}`));
    const keys = card.lines.map(line => `${line.gl}|${line.sub || ""}|${line.side}|${line.tryMinor}`).sort();
    ok(JSON.stringify(keys) === JSON.stringify([`309|${CARD.glSub}|C|21000`, "780||D|1000", "780||D|20000"].sort()), `fiş satırları (kitap D-07): ${keys.join(" · ")}`);
    ok((await balanceOf(ZIRAAT.id)) === ziraatBefore, "Ziraat bakiyesi değişmedi (para bankadan çıkmaz)");
    const ledger = await must("mizan", api.get("/api/workspace/ledger"));
    ok(ledger.trial.accounts.find(row => row.code === "780")?.balance === 210, `mizan 780 = ${ledger.trial.accounts.find(row => row.code === "780")?.balance}`);
    ok((await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"))).ok === true, "Mutabakat Testi temiz");
    await shot(page, "kart-faizi-sonrasi");
  });

  await step("3. Faiz Geliri seçilince kart hesap listesinden çıkar; Esc → yazılmaz", async () => {
    const before = (await must("hareketler", api.get(`/api/workspace/bank/movements`))).rows.length;
    await page.click(`${bankWin} [data-act="v-card-interest"]`);
    await page.waitForSelector(`${form} [name="type"]`, { timeout: 8000 });
    await page.selectOption(`${form} [name="type"]`, "interest_in");
    await page.waitForTimeout(300);
    const accounts = await options(page, "accountId");
    ok(!accounts.some(item => item.value === CARD.id) && accounts.some(item => item.value === ZIRAAT.id), `Faiz Geliri'nde hesaplar: ${accounts.map(item => item.label).join(" | ")} (kart yok)`);
    await page.selectOption(`${form} [name="type"]`, "interest_out");
    await page.waitForTimeout(300);
    ok((await options(page, "accountId")).some(item => item.value === CARD.id), "Faiz Gideri'ne dönünce kart yeniden listede");
    await escClose(page);
    await page.waitForTimeout(400);
    ok((await must("hareketler", api.get(`/api/workspace/bank/movements`))).rows.length === before, "Esc: yeni hareket yok");
  });

  await step("4. + Planlı İşlem → Faiz Gideri: kart listede yok (kart faizi planlanmaz)", async () => {
    await page.click(`${bankWin} .hof-bank-tabs [data-tab="movements"]`);
    await page.waitForSelector(`${bankWin} [data-act="plan-new"]`, { timeout: 10000 });
    await page.click(`${bankWin} [data-act="plan-new"]`);
    await page.waitForSelector(`${form} [name="type"]`, { timeout: 8000 });
    await page.selectOption(`${form} [name="type"]`, "interest_out");
    await page.waitForTimeout(300);
    const accounts = await options(page, "accountId");
    ok(!accounts.some(item => item.value === CARD.id) && accounts.some(item => item.value === ZIRAAT.id), `planlı Faiz Gideri hesapları: ${accounts.map(item => item.label).join(" | ")}`);
    await shot(page, "planli-faiz-gideri");
    await escClose(page);
    await page.waitForTimeout(400);
  });

  await step("5. Pasif kartta + Kart Faizi pasif, nedeni görünür yazı", async () => {
    await openCard(OLD.id, { passive: true });
    const button = await page.$(`${bankWin} [data-act="v-card-interest"]`);
    ok(Boolean(button) && (await button.getAttribute("disabled")) !== null && (await button.getAttribute("title")) === "Hesap pasif; işlem girmek için önce Etkinleştir.", "pasif kartta düğme pasif + neden (title)");
    const detail = await textOf(page, `${bankWin} [data-bank]`);
    ok(detail.includes("Hesap pasif; işlem girmek için önce Etkinleştir."), "neden ekranda görünür yazı");
    await shot(page, "pasif-kart");
  });
  ok(errors.length === 0, `tarayıcı hatası yok${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`✗ senaryo durdu: ${error.stack || error.message}`);
  if (page) await shot(page, "hata").catch(() => null);
} finally {
  await browser.close();
  await app.close();
  fs.rmSync(root, { recursive: true, force: true });
}
console.log(`\n${failed ? "BAŞARISIZ" : "TAMAM"}: ${passed} denetim geçti, ${failed} başarısız. Ekran görüntüleri: ${OUT}`);
process.exitCode = failed ? 1 : 0;
