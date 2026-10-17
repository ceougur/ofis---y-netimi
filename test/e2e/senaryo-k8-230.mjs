// 2.3.0 İz 3.1 — K8 taksit kuralı EKRANDAN (docs/BANKA-MODULU-PLAN.md §3.10/3; sunucu kuralı test/banka-230-k8-taksit.test.mjs).
//   1 Yönetici, ödenmiş kartta: "+ Tahsilat" açık (ipucu: avans olur); pencere "Bu kart ödendi" der; 100 yazıp kaydet → ONAY "Kart Ödendi"
//     (sunucunun 409 plan-paid metni) → Vazgeç: formda "Kaydedilmedi…" yazısı, kart değişmez → yeniden kaydet → "Fazlasını Avans Yaz": hareket
//     yazılır, Kalan kutusunda "fazla ₺100,00", 2 hareket.
//   2 Yönetici, kalanı 700 olan kartta 800 → ONAY "Kalanı Aşan Tutar" → Vazgeç → formda "aşıyor"; 700 → kaydedilir, kalan 0.
//   3 Personel (plans.collect, plans.manage yok), ödenmiş kartta: "+ Tahsilat" PASİF, nedeni kartta "Tahsilat Kapalı: Kart ödendi…" yazısı;
//     kalanı olan kartta düğme açık.
// Çıkış: "N geçti, M kaldı". Ekran görüntüleri EKRAN_DIR (yoksa geçici klasör).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD, installPageClock } from "../helpers.mjs";
import { escClose } from "./esc-kapat.mjs";

const PASS = "Tahsildar-2026!";
const pad = n => String(n).padStart(2, "0");
const base = new Date();
const day = offset => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset, 12, 0, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const D0 = day(0);
const root = mkdtempSync(path.join(tmpdir(), "senaryo-k8-230-"));
const shots = process.env.EKRAN_DIR || root;
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};

const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), now: { time: `${D0}T12:00:00+03:00` }, logLevel: "warn" });
const admin = await server.login();
await must("kurulum geç", admin.post("/api/workspace/bank/setup/dismiss", {}));
await must("tahsildar", admin.post("/api/admin/users", { username: "tahsildar", name: "Tahsildar", role: "personel", password: PASS, mustChangePassword: false }));
const party = await must("cari", admin.post("/api/workspace/accounts", { name: "K8 Ekran Müşterisi", type: "customer", registeredOn: day(-10) }));
const paidPlan = await must("ödenmiş kart", admin.post("/api/workspace/plans", { accountId: party.id, name: "K8 Ödenmiş Kart", total: "1.000", mode: "auto", count: 1, firstDue: day(10) }));
await must("1.000 tahsilat", admin.post(`/api/workspace/plans/${paidPlan.id}/entries`, { kind: "in", amount: "1000", method: "cash", date: D0 }));
const openPlan = await must("kalanı olan kart", admin.post("/api/workspace/plans", { accountId: party.id, name: "K8 Açık Kart", total: "1.000", mode: "auto", count: 1, firstDue: day(10) }));
await must("300 tahsilat", admin.post(`/api/workspace/plans/${openPlan.id}/entries`, { kind: "in", amount: "300", method: "cash", date: D0 }));

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
const top = `${modal}:last-of-type`;
const card = ".hof-plans-modal";
async function login(username, password) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => errors.push(`${username}: ${error.message}`));
  await installPageClock(page, server.app.config.now);
  await page.goto(`${server.base}/`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  return page;
}
const textOf = (page, selector) => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const closeAll = async page => {
  for (let index = 0; index < 8 && (await page.$(modal)); index += 1) {
    await escClose(page);
    await page.waitForTimeout(250);
  }
};
const openCard = async (page, id) => {
  await page.evaluate(planId => window.HOF.plans.open(planId), id);
  await page.waitForSelector(`${card} .hof-plan-head`, { timeout: 10000 });
  await page.waitForTimeout(300);
};
const openPay = async page => {
  await page.click(`${card} [data-act="pay"]`);
  await page.waitForSelector(`${top} .hof-form input[name="amount"]`, { timeout: 8000 });
  await page.waitForTimeout(300);
};
const submit = async page => {
  await page.click(`${top} .hof-form button[type="submit"]`);
  await page.waitForTimeout(600);
};
const shot = (page, name) => page.screenshot({ path: path.join(shots, `${name}.png`) }).catch(() => null);
const kpis = page => textOf(page, `${card} .hof-plans-kpis`);
const entryCount = page => page.$$eval(`${card} .hof-plans-entries tbody tr`, rows => rows.length).catch(() => 0);

try {
  const page = await login("admin", ADMIN_PASSWORD);
  console.log("\n■ 1 Yönetici, ödenmiş kart: + Tahsilat → Kart Ödendi onayı → Vazgeç → Fazlasını Avans Yaz");
  await openCard(page, paidPlan.id);
  const payInfo = await page.$eval(`${card} [data-act="pay"]`, node => ({ disabled: node.disabled, title: node.title }));
  ok(!payInfo.disabled && /avans/i.test(payInfo.title), `+ Tahsilat açık, ipucu avans der: "${payInfo.title}"`);
  ok(!(await page.$(`${card} [data-plan-blocks]`)), "yöneticide Tahsilat Kapalı yazısı yok");
  await openPay(page);
  const intro = await textOf(page, `${top} .hof-modal-text`);
  ok(/ödendi/.test(intro) && /avans/.test(intro) && /onay/.test(intro), `pencere açıklaması: "${intro}"`);
  await page.fill(`${top} input[name="amount"]`, "100");
  await submit(page);
  const confirmTitle = await textOf(page, `${top} .hof-modal-title`);
  const confirmText = await textOf(page, `${top} .hof-modal-text`);
  ok(confirmTitle === "Kart Ödendi" && /ödendi/.test(confirmText) && /Fazlasını Avans Yaz/.test(confirmText), `onay penceresi: ${confirmTitle} — "${confirmText.slice(0, 90)}…"`);
  await shot(page, "k8-230-1-kart-odendi-onay");
  const yesLabel = await textOf(page, `${top} [data-answer="yes"]`);
  ok(yesLabel === "Fazlasını Avans Yaz", `onay düğmesi: ${yesLabel}`);
  await page.click(`${top} [data-answer="no"]`);
  await page.waitForTimeout(500);
  const formError = await textOf(page, `${modal} .hof-form-error`);
  ok(/Kaydedilmedi/.test(formError) && /ödendi/.test(formError), `Vazgeç → formda: "${formError}"`);
  ok((await entryCount(page)) === 1, "kart değişmedi (1 hareket)");
  await submit(page);
  await page.waitForSelector(`${top} [data-answer="yes"]`, { timeout: 8000 });
  await page.click(`${top} [data-answer="yes"]`);
  await page.waitForFunction(() => document.querySelectorAll(".hof-plans-modal .hof-plans-entries tbody tr").length === 2, null, { timeout: 10000 });
  const k1 = await kpis(page);
  ok(/fazla\s*₺?\s*100,00/.test(k1) && /1\.100,00/.test(k1), `avans yazıldı; KPI: "${k1}"`);
  await shot(page, "k8-230-1-avans-yazildi");
  await closeAll(page);

  console.log("\n■ 2 Yönetici, kalanı 700 olan kart: 800 → Kalanı Aşan Tutar → Vazgeç; 700 → kaydedilir");
  await openCard(page, openPlan.id);
  await openPay(page);
  const suggested = await page.inputValue(`${top} input[name="amount"]`);
  ok(suggested === "700,00", `önerilen tutar kalan: ${suggested}`);
  await page.fill(`${top} input[name="amount"]`, "800");
  await submit(page);
  const overTitle = await textOf(page, `${top} .hof-modal-title`);
  const overText = await textOf(page, `${top} .hof-modal-text`);
  ok(overTitle === "Kalanı Aşan Tutar" && /kalan ₺?700,00|kalan 700,00/.test(overText) && /fazlası ₺?100,00|fazlası 100,00/.test(overText), `onay: ${overTitle} — "${overText.slice(0, 120)}"`);
  await shot(page, "k8-230-2-kalani-asan-onay");
  await page.click(`${top} [data-answer="no"]`);
  await page.waitForTimeout(500);
  const overError = await textOf(page, `${modal} .hof-form-error`);
  ok(/aşıyor/.test(overError), `Vazgeç → formda: "${overError}"`);
  await page.fill(`${top} input[name="amount"]`, "700");
  await submit(page);
  await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop.is-visible .hof-form input[name='amount']"), null, { timeout: 10000 });
  const k2 = await kpis(page);
  ok(/₺?0,00\s*Kalan/.test(k2) && !/fazla/.test(k2), `700 kaydedildi, kalan 0, fazla yok; KPI: "${k2}"`);
  await closeAll(page);

  console.log("\n■ 3 Personel: ödenmiş kartta + Tahsilat pasif ve nedeni yazılı; açık kartta düğme açık");
  const staff = await login("tahsildar", PASS);
  const perms = await staff.evaluate(() => ({ collect: window.HOF.can("plans.collect"), manage: window.HOF.can("plans.manage") }));
  ok(perms.collect && !perms.manage, `ön koşul: plans.collect ${perms.collect}, plans.manage ${perms.manage}`);
  await openCard(staff, paidPlan.id);
  const staffPay = await staff.$eval(`${card} [data-act="pay"]`, node => ({ disabled: node.disabled, title: node.title }));
  const why = await textOf(staff, `${card} [data-plan-blocks]`);
  ok(staffPay.disabled && /ödendi/.test(staffPay.title), `+ Tahsilat pasif; ipucu: "${staffPay.title}"`);
  ok(/Tahsilat Kapalı:/.test(why) && /yöneticinize/.test(why), `neden kartta yazılı: "${why}"`);
  await shot(staff, "k8-230-3-personel-tahsilat-kapali");
  await closeAll(staff);
  const roomPlan = await must("personel için açık kart", admin.post("/api/workspace/plans", { accountId: party.id, name: "K8 Personel Açık Kart", total: "500", mode: "auto", count: 1, firstDue: day(10) }));
  await openCard(staff, roomPlan.id);
  const staffOpen = await staff.$eval(`${card} [data-act="pay"]`, node => node.disabled);
  ok(!staffOpen && !(await staff.$(`${card} [data-plan-blocks]`)), "kalanı olan kartta düğme açık, Tahsilat Kapalı yazısı yok");
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-k8-230: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await server.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
