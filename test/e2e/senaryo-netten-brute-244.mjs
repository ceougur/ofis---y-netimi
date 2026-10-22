// 2.4.4 EKRANDAN — iş listesi madde 26 (ek bulgu b): Serbest Meslek Makbuzu → "Netten Brüte" → "Brütü Hesapla" brütü kayıtta uygulanacak stopajla
// bulur; kaydedilen makbuzun Net Ücreti (brüt − stopaj) yazılan tutara kuruşu kuruşuna eşittir (VERİ TABANINDAN okunur, ders 3). Gerçek tıklama, insan
// hızında yazım, Tab (ders 12). Beklenenler GVK md. 94 + KDV kuralından elle (test/netten-brute-244.test.mjs başındaki kaynak; ders 5):
//   1 gerçek kişi alıcı, Stopaj % boş, KDV %20, net 1.000 → stopaj yok: Birim Fiyat 1.000,00; ödenecek 1.200 (ESKİ KOD: 1.250 — %20 varsayıyordu).
//   2 tüzel alıcı, Stopaj % boş → %20: Birim Fiyat 1.250,00; stopaj 250; ödenecek 1.250.
//   3 tüzel alıcı, "Fiyatlar KDV Dahil" işaretli → matrah 1.250 + KDV 250 = Birim Fiyat 1.500,00 (ESKİ KOD: 1.250 KDV dahil → matrah 1.041,67).
//   4 gerçek kişi alıcı, Stopaj % elle 15, net 850 → Birim Fiyat 1.000,00; stopaj 150 (elle yazılan oran geçer).
//   5 cari seçilmeden: pencerede neden yazılır, kalem değişmez.
// Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";

const root = mkdtempSync(path.join(tmpdir(), "senaryo-netten-brute-244-"));
const shots = process.env.EKRAN_DIR || root;
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};
const NO_ENV_PROXY = { HTTPS_PROXY: "", https_proxy: "", HTTP_PROXY: "", http_proxy: "", NO_PROXY: "", no_proxy: "", HUKUK_LICENSE_URL: "http://127.0.0.1:9" };
const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", env: NO_ENV_PROXY });
const admin = await server.login();
const BASE = server.base;
await must("kurulum geç", admin.post("/api/workspace/bank/setup/dismiss", {}));
await must("cari", admin.post("/api/workspace/accounts", { name: "Ayşe Kaya", type: "customer", partyKind: "person", firstName: "Ayşe", familyName: "Kaya", taxNo: "10000000146", address: "Bağdat Cd. 5", district: "Kadıköy", city: "İstanbul" }));
await must("cari", admin.post("/api/workspace/accounts", { name: "Müvekkil Ticaret A.Ş.", type: "customer", taxNo: "1234567890", taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara" }));
const lastRow = () => server.app.store.get("SELECT id, kind, status, stoppage_rate AS rate, net_total AS net, stoppage_total AS stoppage, vat_total AS vat, payable_total AS payable FROM invoices ORDER BY rowid DESC LIMIT 1");
const count = () => server.app.store.get("SELECT COUNT(*) AS n FROM invoices").n;
const kurus = value => Math.round(Number(value) * 100);
// Kutudaki "1.250,00" (2.4.4 UI9) ya da eski "1250" → kuruş.
const boxKurus = text => kurus(String(text || "").includes(",") ? String(text).replace(/\./g, "").replace(",", ".") : text);

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
const pageInv = `${modal} .hof-invoices-modal`;
const dialog = ".hof-modal-backdrop.is-visible:last-of-type";
const textOf = (page, selector) => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const shot = (page, name) => page.screenshot({ path: path.join(shots, `${name}.png`) }).catch(() => null);
const closeAll = async page => {
  for (let index = 0; index < 6 && (await page.$(modal)); index += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    const yes = await page.$(`${modal} [data-answer="yes"]`);
    if (yes) {
      // ders 34: kendiliğinden yanıtlanan soru günlüğe yazılır (adım sonunda kaydedilmemiş formu kapatmak meşru).
      const asked = await yes.evaluate(node => (node.closest(".hof-modal-backdrop")?.querySelector(".hof-modal-title, h2, .hof-modal-text")?.textContent || "").replace(/\s+/g, " ").trim());
      console.log(`  · kapatırken soru yanıtlandı (kaydedilmemiş form, meşru): ${asked.slice(0, 80)}`);
      await yes.click();
    }
  }
};
let currentPage = null;
async function step(title, fn) {
  console.log(title);
  try {
    await fn();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ adım tamamlanamadı: ${String(error?.message || error).split("\n")[0]}`);
  }
  await closeAll(currentPage).catch(() => null);
}
async function newSmm(page, who) {
  await page.evaluate(() => window.HOF.invoices.open({ account: {} }));
  await page.waitForSelector(`${pageInv} [data-act="new"]`);
  await page.click(`${pageInv} [data-act="new"]`);
  await page.click(`${pageInv} [data-scenario="smm"]`);
  await page.waitForSelector(`${pageInv} [data-lines]`);
  if (!who) return;
  await page.click(`${pageInv} [data-acc-query]`);
  await page.keyboard.type(who, { delay: 60 });
  await page.waitForSelector(`${pageInv} .hof-acc-picker li[data-id]`);
  await page.dispatchEvent(`${pageInv} .hof-acc-picker li[data-id]`, "mousedown");
  await page.waitForTimeout(300);
  await page.click(`${pageInv} [data-l="0"][data-f="name"]`);
  await page.keyboard.type("Avukatlık Ücreti", { delay: 40 });
  await page.keyboard.press("Tab");
}
// "Netten Brüte" → net yaz (insan hızında) → Tab → "Brütü Hesapla"; kutudaki birim fiyatı döner.
async function netToGross(page, net) {
  await page.click(`${pageInv} [data-act="gross-from-net"]`);
  await page.waitForSelector(`${dialog} input[name="net"]`);
  await page.click(`${dialog} input[name="net"]`);
  await page.keyboard.type(net, { delay: 70 });
  await page.keyboard.press("Tab");
  await page.click(`${dialog} button[type="submit"]`);
  await page.waitForTimeout(1500);
  return page.$eval(`${pageInv} [data-l="0"][data-f="unitPrice"]`, node => node.value);
}
async function save(page) {
  const before = count();
  await page.click(`${pageInv} [data-act="issue"]`);
  await page.waitForSelector(`${dialog} [data-answer="yes"]`);
  console.log(`  · onay: ${(await textOf(page, `${dialog} .hof-modal-text`)).slice(0, 120)}`);
  await page.click(`${dialog} [data-answer="yes"]`);
  await page.waitForSelector(`${pageInv} .hof-plan-title h3`, { timeout: 15000 });
  await page.waitForTimeout(800);
  ok(count() === before + 1, "makbuz kaydedildi");
  return lastRow();
}
const checkRow = (row, want) => {
  ok(row?.kind === "smm" && row?.status === "issued", `veri tabanında kaydedilmiş SMM (${row?.kind}/${row?.status})`);
  ok(Number(row.rate) === want.rate, `stopaj oranı %${want.rate} (veri tabanı %${row.rate})`);
  ok(kurus(row.net) === kurus(want.gross), `brüt ücret ${want.gross} (veri tabanı ${row.net})`);
  ok(kurus(row.stoppage) === kurus(want.stoppage), `stopaj ${want.stoppage} (veri tabanı ${row.stoppage})`);
  ok(kurus(row.vat) === kurus(want.vat), `KDV ${want.vat} (veri tabanı ${row.vat})`);
  ok(kurus(row.payable) === kurus(want.payable), `ödenecek ${want.payable} (veri tabanı ${row.payable})`);
  ok(kurus(row.net) - kurus(row.stoppage) === kurus(want.netFee), `Net Ücret = yazılan ${want.netFee} (veri tabanı ${Math.round(kurus(row.net) - kurus(row.stoppage)) / 100})`);
};

try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  currentPage = page;
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open), null, { timeout: 20000 });

  await step("■ 1 gerçek kişi alıcı, Stopaj % boş: stopaj kesilmez", async () => {
    await newSmm(page, "Ayşe");
    ok((await page.$eval(`${pageInv} [data-f="stoppageRate"]`, node => node.value)) === "", "ön koşul: Stopaj % kutusu boş (otomatik)");
    const price = await netToGross(page, "1.000,00");
    ok(boxKurus(price) === 100000, `Birim Fiyat 1.000,00 (kutu "${price}")`);
    const totals = await textOf(page, `${pageInv} [data-totals]`);
    ok(!/Stopaj/.test(totals), `toplamlarda stopaj satırı yok (${totals.slice(0, 160)})`);
    await shot(page, "netten-brute-1-kisi");
    checkRow(await save(page), { rate: 0, gross: 1000, stoppage: 0, vat: 200, payable: 1200, netFee: 1000 });
  });

  await step("\n■ 2 tüzel alıcı, Stopaj % boş: %20", async () => {
    await newSmm(page, "Müvekkil");
    const price = await netToGross(page, "1.000,00");
    ok(boxKurus(price) === 125000, `Birim Fiyat 1.250,00 (kutu "${price}")`);
    const totals = await textOf(page, `${pageInv} [data-totals]`);
    ok(/Gelir Vergisi Stopajı %20/.test(totals), `toplamlarda "Gelir Vergisi Stopajı %20" (${totals.slice(0, 200)})`);
    checkRow(await save(page), { rate: 20, gross: 1250, stoppage: 250, vat: 250, payable: 1250, netFee: 1000 });
  });

  await step("\n■ 3 tüzel alıcı, Fiyatlar KDV Dahil: birim fiyat KDV dahil", async () => {
    await newSmm(page, "Müvekkil");
    await page.click(`${pageInv} input[data-f="pricesIncludeVat"]`);
    await page.waitForTimeout(300);
    ok(await page.$eval(`${pageInv} input[data-f="pricesIncludeVat"]`, node => node.checked), "ön koşul: Fiyatlar KDV Dahil işaretli");
    const price = await netToGross(page, "1.000,00");
    ok(boxKurus(price) === 150000, `Birim Fiyat 1.500,00 KDV dahil (kutu "${price}")`);
    await shot(page, "netten-brute-3-kdv-dahil");
    checkRow(await save(page), { rate: 20, gross: 1250, stoppage: 250, vat: 250, payable: 1250, netFee: 1000 });
  });

  await step("\n■ 4 gerçek kişi alıcı, Stopaj % elle 15", async () => {
    await newSmm(page, "Ayşe");
    await page.click(`${pageInv} [data-f="stoppageRate"]`);
    await page.keyboard.type("15", { delay: 80 });
    await page.keyboard.press("Tab");
    await page.waitForTimeout(400);
    const price = await netToGross(page, "850");
    ok(boxKurus(price) === 100000, `Birim Fiyat 1.000,00 (kutu "${price}")`);
    checkRow(await save(page), { rate: 15, gross: 1000, stoppage: 150, vat: 200, payable: 1050, netFee: 850 });
  });

  await step("\n■ 5 cari seçilmeden: neden yazılır, kalem değişmez", async () => {
    await newSmm(page, "");
    await page.click(`${pageInv} [data-act="gross-from-net"]`);
    await page.waitForSelector(`${dialog} input[name="net"]`);
    await page.click(`${dialog} input[name="net"]`);
    await page.keyboard.type("1000", { delay: 70 });
    await page.click(`${dialog} button[type="submit"]`);
    await page.waitForTimeout(800);
    const said = await textOf(page, `${dialog} .hof-form-error`);
    ok(/cariyi seçin/.test(said), `pencerede neden: "${said}"`);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const price = await page.$eval(`${pageInv} [data-l="0"][data-f="unitPrice"]`, node => node.value);
    ok(!price, `kalemin Birim Fiyatı boş kaldı ("${price}")`);
  });
  ok(!errors.length, `sayfa hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`  ✗ beklenmeyen hata: ${error.stack || error}`);
} finally {
  await browser.close();
  await server.close();
  console.log(`\n${passed} geçti, ${failed} kaldı`);
  if (!process.env.EKRAN_DIR) rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
