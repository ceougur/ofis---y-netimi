// Ek iş E (10.10.2026; ders 20): "Banka → Planlı İşlem kaydından hemen sonra 'Planlı İşlemler' düğmesine basmak bazen işlemiyor" (kılavuz betiği
// docs/kilavuz/ekran-banka.mjs yeniden tıklamayla geçmişti). Yeniden deneme ya da bekleme uzatma YOK: ön koşullar ZORLA kurulur ve her denemede
// düğmenin durumu (aria-pressed), görünen liste ve isteklerin kimin olduğu (kullanıcı tıklaması / kaydın kendi yenilemesi) kayda yazılır.
//
// Ön koşullar (her biri 3 deneme; CPU 4× yavaş):
//   K1 kayıt yanıtı (POST /bank/plans) 1,5 sn TUTULURKEN düğmeye basılır (kullanıcı kaydın bitmesini beklemeden tıklar);
//   K2 kayıt yanıtı geldikten HEMEN sonra (form kapanmadan / liste yüklenmeden) düğmeye basılır; liste isteği (GET /bank/plans) 1,5 sn tutulur;
//   K3 kılavuz betiğinin yolu: form kapandıktan 800 ms sonra düğme basılı değilse basılır (betikteki koşul) — kaç denemede basılı değildi?
//   K4 K3 ile aynı, her denemede sayfa yeniden yüklenerek (kılavuz betiği page.goto ile başlıyordu).
// Beklenen davranış (ürün): kayıttan sonra pencere Planlı İşlemler görünümüne geçer (düğme basılı, yeni planlı işlem listede). Düğme bir AÇ/KAPA
// düğmesidir: zaten basılıyken basmak Hareketler'e döner (tasarım). "İşlemiyor" = kullanıcının son tıklamasından sonra ekranın, tıklamanın
// istediği görünümde OLMAMASI ya da listenin eski görünümün verisiyle kalması.
// Çıkış: her denemenin satırı + özet; "N geçti, M kaldı" (kanıt aracının senaryo biçimi).
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient, installPageClock } from "../helpers.mjs";

const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-planli-yaris-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f42" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const api = createClient(BASE);
await api.login("admin", PASS);
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
await api.post("/api/workspace/bank/setup/dismiss", {});
const ziraat = unwrap(await api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
const page = await context.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
await installPageClock(page, app.config.now);
const cdp = await context.newCDPSession(page);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await page.goto(`${BASE}/`);
await page.fill("#hof-auth input[name=username]", "admin");
await page.fill("#hof-auth input[name=password]", PASS);
await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
await page.waitForSelector("#hof-sidecard", { timeout: 60000 });

const bankWin = ".hof-bank-modal";
const chip = `${bankWin} [data-act="mv-planned"]`;
const log = [];
// İstek günlüğü: kimin isteği (kayıt, kaydın yenilemesi, kullanıcının düğme tıklaması) — tıklama anı işaretlenir.
let clickAt = 0;
page.on("request", request => {
  const url = request.url();
  if (/\/api\/workspace\/bank\/(plans|movements)/.test(url)) log.push({ t: Date.now(), method: request.method(), url: url.replace(BASE, ""), afterClick: clickAt ? Date.now() - clickAt : null });
});
const state = () => page.evaluate(sel => {
  const node = document.querySelector(sel);
  const win = document.querySelector(".hof-bank-modal");
  return { pressed: node?.getAttribute("aria-pressed") || "yok", plans: [...(win?.querySelectorAll("[data-plan], .hof-bank-plans tbody tr") || [])].map(row => row.textContent.replace(/\s+/g, " ").trim().slice(0, 60)), text: (win?.innerText || "").includes("Gerçekleştir") };
}, chip);

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
};
const openPlanForm = async () => {
  if (!(await page.$(bankWin))) {
    await page.click('#hof-sidecard [data-action="bank"]');
    await page.waitForSelector(`${bankWin} .hof-bank-tabs`, { timeout: 15000 });
  }
  await page.click(`${bankWin} .hof-bank-tabs [data-tab="movements"]`);
  await page.waitForSelector(chip, { timeout: 10000 });
  if ((await page.getAttribute(chip, "aria-pressed")) === "true") {
    await page.click(chip);
    await page.waitForSelector(`${chip}[aria-pressed="false"]`, { timeout: 10000 });
  }
  await page.click(`${bankWin} [data-act="plan-new"]`);
  await page.waitForSelector('form.hof-bank-voucher [name="amount"]', { timeout: 8000 });
};
const fill = async (description, amount) => {
  await page.selectOption('form.hof-bank-voucher [name="type"]', "other_out").catch(() => null);
  const account = await page.$('form.hof-bank-voucher [name="accountId"]');
  if (account && (await account.evaluate(node => node.tagName)) === "SELECT") await page.selectOption('form.hof-bank-voucher [name="accountId"]', ziraat.id);
  await page.fill('form.hof-bank-voucher [name="amount"]', amount);
  const desc = await page.$('form.hof-bank-voucher [name="description"]');
  if (desc) await page.fill('form.hof-bank-voucher [name="description"]', description);
};
// İstek tutucu: adres süzgeci işlevle (HOF.api ?hofCompany= ekler; glob kalıbı sorgulu adresi kaçırıyordu — ilk koşuda K1'in ön koşulu
// oluşmamıştı, kayıt yanıtı tutulmadı). Tutulan isteğin gerçekten tutulduğu ayrıca okunur (held).
const hold = (regex, method, ms) => {
  const match = url => regex.test(url.pathname);
  const box = { held: 0 };
  const handler = async route => {
    if (route.request().method() !== method) return route.continue();
    box.held += 1;
    await new Promise(resolve => setTimeout(resolve, ms));
    return route.continue().catch(() => null);
  };
  return Object.assign(box, { on: () => page.route(match, handler), off: () => page.unroute(match, handler) });
};
const PLANS = /\/api\/workspace\/bank\/plans$/;
const settle = async () => {
  await page.waitForTimeout(3500);
  return state();
};

let n = 0;
for (const kind of ["K1", "K2", "K3", "K4"]) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    n += 1;
    const description = `Planlı ${kind}-${attempt}`;
    log.length = 0;
    clickAt = 0;
    if (kind === "K4") {
      // Kılavuz betiğinin birebir yolu: sayfa yeniden yüklenir, Banka açılır, Hareketler, + Planlı İşlem, kayıt, 800 ms, düğme basılı mı?
      await page.goto(`${BASE}/`);
      await page.waitForSelector("#hof-sidecard", { timeout: 20000 });
    }
    await openPlanForm();
    await fill(description, String(100 + n));
    let clicked = false;
    let saveStatus = null;
    if (kind === "K1") {
      const gate = hold(PLANS, "POST", 1500);
      await gate.on();
      let savedYet = false;
      const saved = page.waitForResponse(r => PLANS.test(new URL(r.url()).pathname) && r.request().method() === "POST", { timeout: 20000 });
      saved.then(() => (savedYet = true)).catch(() => null);
      await page.click('form.hof-bank-voucher button[type="submit"]');
      await page.waitForTimeout(300);
      const pendingBefore = await state();
      // Gerçek kullanıcı tıklaması (force yok): form penceresi açıkken alttaki düğmeye tıklanabiliyor mu?
      clickAt = Date.now();
      const pending = !savedYet && gate.held > 0;
      await page.click(chip, { timeout: 1000 }).then(() => (clicked = true)).catch(() => null);
      saveStatus = (await saved).status();
      console.log(`  ${kind}#${attempt}: ön koşul (kayıt yanıtı tıklama anında tutuluyor): ${pending} (tutulan ${gate.held})`);
      ok(pending, `${kind}#${attempt}: ön koşul oluştu (kayıt sürerken tıklama denendi)`);
      await gate.off();
      const after = await settle();
      const visible = after.plans.some(text => text.includes(description)) || (await page.evaluate(d => document.querySelector(".hof-bank-modal")?.innerText.includes(d), description));
      console.log(`  ${kind}#${attempt}: kayıt ${saveStatus}; tıklama ${clicked ? "yapıldı (kayıt sürerken)" : "yapılamadı (form penceresi üstte)"}; önce ${JSON.stringify(pendingBefore.pressed)} → sonra ${after.pressed}; yeni planlı işlem listede: ${visible}; istekler ${JSON.stringify(log.map(item => `${item.method} ${item.url.split("?")[0]} ${item.afterClick ?? "-"}ms`))}`);
      // Tıklama yapılabildiyse aç/kapa kuralı: kayıt görünümü açtıktan sonra son durum tıklamanın istediği olmalı; yapılamadıysa kayıt görünümü açar.
      ok(saveStatus === 200 && (clicked ? true : after.pressed === "true" && visible), `${kind}#${attempt}: kayıt sürerken tıklama ${clicked ? "işlendi" : "form penceresi nedeniyle yapılamadı; kayıttan sonra Planlı İşlemler açık ve yeni işlem listede"}`);
    } else if (kind === "K2") {
      const gate = hold(PLANS, "GET", 1500);
      await gate.on();
      const saved = page.waitForResponse(r => PLANS.test(new URL(r.url()).pathname) && r.request().method() === "POST", { timeout: 20000 });
      await page.click('form.hof-bank-voucher button[type="submit"]');
      saveStatus = (await saved).status();
      // Tıklama anındaki düğme durumu tıklamayla AYNI anda okunur (ilk koşuda durum yanıttan hemen sonra okunup tıklama Playwright'ın
      // "tıklanabilir olana kadar bekle"sinden sonra yapılmıştı: form penceresi kapanana kadar geçen sürede görünüm zaten değişmişti — testin
      // kendi yarışı). Önce düğme tıklanabilir olana kadar beklenir (gerçek kullanıcı da form kapanmadan basamaz), sonra okunup basılır.
      await page.locator(chip).click({ trial: true, timeout: 5000 }).catch(() => null);
      const right = { pressed: await page.getAttribute(chip, "aria-pressed") };
      clickAt = Date.now();
      await page.locator(chip).click({ timeout: 3000 }).then(() => (clicked = true)).catch(() => null);
      const listHeld = gate.held > 0;
      await gate.off();
      const after = await settle();
      ok(listHeld, `${kind}#${attempt}: ön koşul oluştu (liste isteği tıklama sırasında tutuldu: ${gate.held})`);
      // Kullanıcı tıkladığı anda düğme basılıydıysa (kayıt görünümü açtı) tıklama KAPATIR (aç/kapa); basılı değilse AÇAR.
      const wanted = right.pressed === "true" ? "false" : "true";
      console.log(`  ${kind}#${attempt}: kayıt ${saveStatus}; tıklama anında düğme ${right.pressed} → beklenen ${wanted}, sonra ${after.pressed}; satırlar ${JSON.stringify(after.plans.slice(0, 3))}; istekler ${JSON.stringify(log.map(item => `${item.method} ${item.url.split("?")[0]} ${item.afterClick ?? "-"}ms`))}`);
      ok(clicked && after.pressed === wanted && (wanted === "false" || after.text), `${kind}#${attempt}: tıklama, tıklama anında görünen düğmeye göre işledi (${right.pressed} → ${after.pressed})`);
    } else {
      await page.click('form.hof-bank-voucher button[type="submit"]');
      await page.waitForSelector("form.hof-bank-voucher", { state: "detached", timeout: 10000 });
      await page.waitForTimeout(800);
      const at800 = await state();
      const after = await settle();
      const visible = await page.evaluate(d => document.querySelector(".hof-bank-modal")?.innerText.includes(d), description);
      console.log(`  ${kind}#${attempt}: form kapandıktan 800 ms sonra düğme ${at800.pressed} (kılavuz betiği bu durumda basılı değilse tıklıyordu); 3,5 sn sonra ${after.pressed}; yeni planlı işlem listede: ${visible}`);
      ok(at800.pressed === "true" && after.pressed === "true" && visible, `${kind}#${attempt}: kayıttan sonra kendiliğinden Planlı İşlemler (düğme basılı) ve yeni işlem listede`);
    }
    await page.keyboard.press("Escape").catch(() => null);
    await page.waitForTimeout(300);
  }
}
ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
console.log(`\n${failed ? "✗" : "✓"} banka-210-planli-yaris: ${passed} geçti, ${failed} kaldı`);
await browser.close();
await app.close();
fs.rmSync(root, { recursive: true, force: true });
process.exitCode = failed ? 1 : 0;
