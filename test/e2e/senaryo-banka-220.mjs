// Senaryo Banka 2.2.0 — İz 2 EKRANDAN (docs/2.2.0-IS-LISTESI.md 2.1–2.9; CLAUDE.md 12.10.2026 müşteri istekleri). Gerçek kullanıcı gibi
// tıklanır, Tab ile ilerlenir, insan hızında yazılır (ders 12); her adımdan sonra sayı veri tabanından (API) okunur; ekran görüntüleri
// artifacts/senaryo-banka-220/.
//  2.1  Hesaplar'da "Açılış Bakiyesi Doğrulanmadı" + ne yapılacağı; hesap ayrıntısında açıklama + Açılışı Düzelt bağlantısı → doğrulanır.
//  2.2  Yeni Hesap: Kredi Kartı / Çek / Senet / POS Kullan işaretleri (Vadeli'de gizli); kaydedilen işaretler sunucuda.
//  2.3  Yeni Hesap türlerinde kredi kartı YOK; kart bankanın içinden ("+ Kredi Kartı Ekle"): bağlı banka, son 4 hane; Hesaplar'da kart bankanın
//       altında; eski bağsız karta öneri → Bağla; Kart Borcu Ödemesi'nde ödeyen hesap bağlı banka.
//  2.4  "… Tanımla" (hiç hesap/kart yokken). NASIL BOZARIM: (a) tanım penceresinde Vazgeç → alttaki formun yazılanları kaybolur mu? (b) çift tık
//       → iki pencere? (c) kaydedince seçici yeni hesabı göstermez / form kapanır / tutar-yol kaybolur? (d) kaydedilen ödeme yanlış hesaba ya da
//       hesapsız mı yazılır (veri tabanından)? (e) tanımlama yetkisi yokken düğme görünür mü (avukat: yazı)? (f) kart tanımında banka seçilmeden?
//  2.5–2.6 Verilen çekte "Banka / Şube" yerine Çek Hesabı (tek hesap bilgi satırı, çokta seçim zorunlu, yoksa Çek Hesabı Tanımla); ödemede çekin
//       hesabı dolu gelir; senette Ödeme Hesabı (Öneri); alınan çekte metin.
//  2.7  Seçicilerde bakiye: seçenekte bakiye, seçilenin altında "Bakiye · İşlemden Sonra", Engelle'de kırmızı ve sunucu da reddeder; Kasadan
//       Bankaya Yatır'da Nakit Kasa, tarih değişince o günün bakiyesi (tek bakiye isteği); yetkisiz personelde bakiye yok.
//  2.8  Fatura ödeme düğmeleri yola göre (+ Nakit · + Havale / EFT · + Kredi Kartı …), satır başlığı yolun adı, Kalanın Tamamını Öde → yol sorusu.
// Çalıştırma: npm run test:senaryo-banka-220
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient, installPageClock } from "../helpers.mjs";
import { escClose } from "./esc-kapat.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-banka-220");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const TODAY = "2026-10-08";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-banka-220-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, maxCompanies: 2, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f42" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
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
let page = null;
const shot = async name => {
  shotNo += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) });
};
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const bankWin = ".hof-bank-modal";
const pause = ms => page.waitForTimeout(ms);
const closeAll = async () => {
  for (let index = 0; index < 8 && (await page.$(modal)); index += 1) {
    await escClose(page);
    await pause(300);
    // Kaydedilmemiş değişiklik sorusu çıkarsa kapat.
    const leave = await page.$(`${top} [data-answer="yes"]`);
    if (leave && /Kaydetmeden/.test((await leave.textContent()) || "")) await leave.click();
  }
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
    await shot("hata").catch(() => null);
    await closeAll().catch(() => null);
  }
};
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
const textOf = selector => page.$eval(selector, node => node.innerText.replace(/\s+/g, " ").trim()).catch(() => "");
// textContent: CSS büyük harfe çevirdiği başlıklar (dt, th) yazıldığı gibi okunur.
const rawText = selector => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const optionsOf = selector => page.$$eval(`${selector} option`, nodes => nodes.map(node => node.textContent.trim())).catch(() => []);
const visible = selector => page.$eval(selector, node => Boolean(node.offsetParent)).catch(() => false);
/** İnsan hızında yazım (ders 12): alanı tıkla, temizle, harf harf yaz. */
const typeInto = async (selector, value) => {
  await page.click(selector);
  await page.fill(selector, "");
  await page.type(selector, value, { delay: 35 });
};
// 2.4.3 (C11, bilerek): Banka penceresi oturum içinde son sekmesiyle açılır; bu senaryonun adımları eski açılış gibi Genel Bakış'tan başlar.
const openBank = async () => {
  if (!(await page.$(`${bankWin} [data-bank] .hof-bank-tabs`))) {
    await page.click('#hof-sidecard [data-action="bank"]');
    await page.waitForSelector(`${bankWin} [data-bank] .hof-bank-tabs`, { timeout: 15000 });
    if (!(await page.$(`${bankWin} .hof-bank-tabs [data-tab="overview"][aria-selected="true"]`))) {
      await page.click(`${bankWin} .hof-bank-tabs [data-tab="overview"]`);
      await page.waitForTimeout(500);
    }
  }
  await pause(500);
};
const bankTab = async id => {
  await openBank();
  await page.click(`${bankWin} .hof-bank-tabs [data-tab="${id}"]`);
  await pause(800);
};
const openBankAccount = async id => {
  await bankTab("accounts");
  await page.click(`${bankWin} .hof-bank-accounts tr[data-account="${id}"]`);
  await page.waitForSelector(`${bankWin} [data-confirm-line]`, { timeout: 10000 });
  await pause(500);
};
const accountsApi = async () => (await must("hesaplar", api.get("/api/workspace/bank/accounts?status=all"))).accounts;
const accountApi = id => must("hesap", api.get(`/api/workspace/bank/accounts/${id}`));
const submitTop = async () => {
  await page.click(`${top} .hof-form button[type="submit"]`);
  await pause(900);
};

const ctx = {};
try {
  await api.login("admin", PASS);
  await must("sihirbazı kapat", api.post("/api/workspace/bank/setup/dismiss", {}));
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  page = await context.newPage();
  page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", PASS);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await pause(800);

  // ---------- 2.4 "… Tanımla" (hiç banka hesabı ve kart yokken; formlar kapanmadan) ----------
  const openParty = async (target, id) => {
    await target.click('#hof-sidecard [data-action="accounts"]');
    await target.waitForSelector(`.hof-accounts-modal tr[data-account="${id}"]`, { timeout: 10000 });
    await target.click(`.hof-accounts-modal tr[data-account="${id}"]`);
    await target.waitForSelector('.hof-accounts-modal [data-entry="out"]', { timeout: 10000 });
  };
  const pickNote = () => textOf(`${top} .hof-form [data-bank-pick]:not([hidden]) [data-bank-single]`);
  await step("2.4 hazırlık (API): Tedarikçi A; avukat (Banka Hesabı Tanımlama yetkisi yok)", async () => {
    ctx.supplier = await must("cari", api.post("/api/workspace/accounts", { name: "Tedarikçi A", type: "supplier", registeredOn: "2026-09-01" }));
    await must("avukat", api.post("/api/admin/users", { username: "avukat220", name: "Avukat 220", role: "avukat", password: "Avukat-2026!", mustChangePassword: false }));
    const choices = await must("seçici", api.get("/api/workspace/bank/choices"));
    ok(choices.accounts.length === 0, "hiç banka hesabı yok");
  });

  await step("2.4 yetkisiz (avukat): Ödeme → Havale / EFT → düğme yok, \"Banka hesabı tanımlı değil, yöneticinize başvurun.\"", async () => {
    const context2 = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
    const other = await context2.newPage();
    other.on("pageerror", error => errors.push(`pageerror (avukat) ${error.message}`));
    await installPageClock(other, app.config.now);
    await other.goto(`${BASE}/`);
    await other.fill("#hof-auth input[name=username]", "avukat220");
    await other.fill("#hof-auth input[name=password]", "Avukat-2026!");
    await Promise.all([other.waitForEvent("load"), other.click('#hof-auth button[type="submit"]')]);
    await other.waitForSelector("#hof-sidecard", { timeout: 60000 });
    await other.waitForTimeout(800);
    await openParty(other, ctx.supplier.id);
    await other.click('.hof-accounts-modal [data-entry="out"]');
    const form = `${top} .hof-form`;
    await other.waitForSelector(`${form} input[name="amount"]`, { timeout: 8000 });
    await other.selectOption(`${form} select[name="method"]`, "bank");
    await other.waitForSelector(`${form} [data-bank-define-missing="bank"]`, { timeout: 8000 });
    const missing = await other.$eval(`${form} [data-bank-define-missing="bank"]`, node => node.textContent.trim());
    ok(missing === "Banka hesabı tanımlı değil, yöneticinize başvurun.", `yazı: “${missing}”`);
    ok(!(await other.$(`${form} [data-bank-define]`)), "Tanımla düğmesi yok");
    await other.screenshot({ path: path.join(OUT, "00-avukat-tanimli-degil.png") });
    await context2.close();
  });

  await step("2.4 cari Ödeme 1.200 → Havale / EFT → \"Banka Hesabı Tanımla\": Vazgeç (form aynen), çift tık tek pencere, kaydet → seçili, kaydedilen ödeme o hesapta", async () => {
    await openParty(page, ctx.supplier.id);
    await page.click('.hof-accounts-modal [data-entry="out"]');
    const form = `${top} .hof-form`;
    await page.waitForSelector(`${form} input[name="amount"]`, { timeout: 8000 });
    await typeInto(`${form} input[name="amount"]`, "1.200");
    await page.selectOption(`${form} select[name="method"]`, "bank");
    await page.waitForSelector(`${form} [data-bank-define="bank"]`, { timeout: 8000 });
    await shot("tanimla-dugmesi");
    const formSel = `${modal} .hof-form:has([data-bank-define="bank"])`;
    // Vazgeç: tanım penceresi kapanır, ödeme formu ve yazılan tutar yerinde.
    await page.click(`${formSel} [data-bank-define="bank"]`);
    await page.waitForSelector(`${top} .hof-form input[name="bankName"]`, { timeout: 8000 });
    ok(/Banka Hesabı Tanımla/.test(await textOf(`${top} .hof-modal-title`)), "üstte Banka Hesabı Tanımla penceresi");
    await page.click(`${top} [data-cancel]`);
    await pause(500);
    ok((await page.$eval(`${formSel} input[name="amount"]`, node => node.value)) === "1.200", "Vazgeç: tutar 1.200 yerinde");
    // Çift tık: tek pencere.
    await page.dblclick(`${formSel} [data-bank-define="bank"]`);
    await page.waitForSelector(`${top} .hof-form input[name="bankName"]`, { timeout: 8000 });
    await pause(400);
    const defineWindows = await page.$$eval(".hof-modal-backdrop.is-visible .hof-modal-title", nodes => nodes.filter(node => node.textContent.trim() === "Banka Hesabı Tanımla").length);
    ok(defineWindows === 1, `çift tıklamada tanım penceresi sayısı ${defineWindows}`);
    await typeInto(`${top} .hof-form input[name="bankName"]`, "Ziraat Bankası");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Ana TL", { delay: 35 });
    await typeInto(`${top} .hof-form input[name="openingAmount"]`, "10.000");
    await page.check(`${top} .hof-form input[name="confirmed"]`);
    await submitTop();
    await page.waitForFunction(() => [...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-modal-title")].every(node => node.textContent.trim() !== "Banka Hesabı Tanımla"), null, { timeout: 10000 });
    const form2 = `${modal} .hof-form:has(select[name="method"])`;
    await page.waitForSelector(`${form2} [data-bank-single]`, { timeout: 8000 });
    const note = await textOf(`${form2} [data-bank-single]`);
    ok(/Ziraat Bankası · Ana TL hesabına yazılır/.test(note), `form kapanmadı, hesap seçili: “${note}”`);
    ok((await page.$eval(`${form2} input[name="amount"]`, node => node.value)) === "1.200" && (await page.$eval(`${form2} select[name="method"]`, node => node.value)) === "bank", "tutar ve yol kaybolmadı");
    await shot("tanimla-sonra-secili");
    await page.click(`${form2} button[type="submit"]`);
    await pause(1200);
    ctx.ziraat = (await must("hesaplar", api.get("/api/workspace/bank/accounts"))).accounts.find(account => account.bankName === "Ziraat Bankası");
    const entry = (await must("cari", api.get(`/api/workspace/accounts/${ctx.supplier.id}`))).entries.find(item => item.kind === "out" && item.amount === 1200);
    ok(entry && entry.method === "bank" && entry.finRef === ctx.ziraat?.id, `kaydedilen ödeme: yol ${entry?.method}, hesap ${entry?.finRef === ctx.ziraat?.id ? "Ziraat" : entry?.finRef}`);
    await closeAll();
  });

  await step("2.4 cari Ödeme 300 → Kredi Kartı → \"Kredi Kartı Tanımla\": bağlı banka Ziraat ön seçili, Bonus •••• 4321 → seçili, ödeme kartta", async () => {
    await openParty(page, ctx.supplier.id);
    await page.click('.hof-accounts-modal [data-entry="out"]');
    const form = `${modal} .hof-form:has(select[name="method"])`;
    await page.waitForSelector(`${form} input[name="amount"]`, { timeout: 8000 });
    await typeInto(`${form} input[name="amount"]`, "300");
    await page.selectOption(`${form} select[name="method"]`, "card");
    await page.waitForSelector(`${form} [data-bank-define="card"]`, { timeout: 8000 });
    await page.click(`${form} [data-bank-define="card"]`);
    await page.waitForSelector(`${top} .hof-form input[name="cardLast4"]`, { timeout: 8000 });
    await page.waitForFunction(() => document.querySelector('.hof-modal-backdrop.is-visible:last-of-type select[name="parentId"]')?.value, null, { timeout: 8000 });
    const parent = await page.$eval(`${top} .hof-form select[name="parentId"]`, node => node.selectedOptions[0]?.textContent.trim());
    ok(/Ziraat Bankası · Ana TL/.test(parent), `Bağlı Banka Hesabı: ${parent}`);
    await page.keyboard.type("Bonus", { delay: 35 });
    await page.keyboard.press("Tab");
    await page.keyboard.type("4321", { delay: 35 });
    await submitTop();
    await page.waitForSelector(`${form} [data-bank-pick="card"] [data-bank-single]`, { timeout: 10000 });
    const note = await textOf(`${form} [data-bank-pick="card"] [data-bank-single]`);
    ok(/Ziraat Bankası · Bonus/.test(note), `kart seçili: “${note}”`);
    ok((await page.$eval(`${form} input[name="amount"]`, node => node.value)) === "300", "tutar kaybolmadı");
    await page.click(`${form} button[type="submit"]`);
    await pause(1200);
    ctx.bonus = (await must("hesaplar", api.get("/api/workspace/bank/accounts"))).accounts.find(account => account.name === "Bonus");
    const entry = (await must("cari", api.get(`/api/workspace/accounts/${ctx.supplier.id}`))).entries.find(item => item.kind === "out" && item.amount === 300);
    ok(ctx.bonus?.parentId === ctx.ziraat?.id && ctx.bonus?.cardLast4 === "4321", "kart Ziraat'in altında, son 4 hane 4321");
    ok(entry && entry.method === "card" && entry.finRef === ctx.bonus?.id, `kartla ödeme kartta: ${entry?.finRef === ctx.bonus?.id}`);
    await closeAll();
  });

  await step("Hazırlık (API): Yapı Kredi · TL (açılış 20.000, DOĞRULANMADI) + 2.1.0'dan kalma bağsız kart (Yapı Kredi · World Eski)", async () => {
    ctx.yk = await must("Yapı Kredi", api.post("/api/workspace/bank/accounts", { bankName: "Yapı Kredi", name: "TL", kind: "demand", code: "YAP-TL", opening: { date: "2026-10-01", amount: "20.000", confirmed: false } }));
    ctx.legacyCard = await must("eski kart", api.post("/api/workspace/bank/accounts", { bankName: "Yapı Kredi", name: "World Eski", kind: "card", opening: { date: "2026-10-01", amount: "0", confirmed: false } }));
    ok(ctx.yk.balanceConfirmed === false && ctx.legacyCard.parentId === "", "hesap doğrulanmamış, eski kart bağsız");
  });

  await step("2.1 Hesaplar: Durum \"Açılış Bakiyesi Doğrulanmadı\" + ne yapılacağı görünür yazıyla", async () => {
    await bankTab("accounts");
    const status = await textOf(`${bankWin} tr[data-account="${ctx.yk.id}"] [data-unconfirmed]`);
    ok(status === "Açılış Bakiyesi Doğrulanmadı", `Durum: “${status}”`);
    const note = await textOf(`${bankWin} [data-unconfirmed-note]`);
    ok(/eksi bakiye denetimi kapalı/.test(note) && /Açılışı Düzelt/.test(note) && /gerçek bakiyedir/.test(note), `açıklama: ${note.slice(0, 160)}`);
    await shot("hesaplar-dogrulanmadi");
  });

  await step("2.1 Hesap ayrıntısı → Açılışı Düzelt bağlantısı → \"Bu tutar bankadaki gerçek bakiyedir\" → Bakiye Doğrulandı", async () => {
    await openBankAccount(ctx.yk.id);
    const line = await textOf(`${bankWin} [data-confirm-line]`);
    ok(/Açılış Bakiyesi Doğrulanmadı/.test(line) && /eksi bakiye denetimi kapalı/.test(line), `ayrıntı satırı: ${line}`);
    await shot("ayrinti-dogrulanmadi");
    await page.click(`${bankWin} [data-confirm-line] [data-act="opening"]`);
    await page.waitForSelector(`${top} .hof-form input[name="confirmed"]`, { timeout: 8000 });
    await page.check(`${top} .hof-form input[name="confirmed"]`);
    await submitTop();
    await page.waitForFunction(() => /Bakiye Doğrulandı/.test(document.querySelector(".hof-bank-modal [data-confirm-line]")?.textContent || ""), null, { timeout: 10000 });
    const after = await accountApi(ctx.yk.id);
    ok(after.balanceConfirmed === true && after.opening.amountMinor === 2_000_000, `sunucu: doğrulandı ${after.balanceConfirmed}, açılış ${after.opening.amountMinor / 100}`);
  });

  await step("2.2/2.3 + Yeni Hesap: türlerde kredi kartı YOK; Vadesiz'de işaretler görünür, Vadeli'de gizli; Garanti Ticari Çek + Senet Kullan", async () => {
    await bankTab("accounts");
    await page.click(`${bankWin} [data-act="new"]`);
    const form = `${top} .hof-form`;
    await page.waitForSelector(`${form} input[name="bankName"]`, { timeout: 8000 });
    const kinds = await optionsOf(`${form} select[name="kind"]`);
    ok(!kinds.some(label => /Kart/.test(label)) && kinds.includes("Vadesiz"), `Hesap Türü seçenekleri: ${kinds.join(" | ")}`);
    ok((await visible(`${form} input[name="useCard"]`)) && (await visible(`${form} input[name="useCheque"]`)) && (await visible(`${form} input[name="usePos"]`)), "Vadesiz: işaretler görünür");
    await page.selectOption(`${form} select[name="kind"]`, "time");
    await pause(200);
    ok(!(await visible(`${form} input[name="useCheque"]`)), "Vadeli: işaretler gizli");
    await page.selectOption(`${form} select[name="kind"]`, "commercial");
    await typeInto(`${form} input[name="bankName"]`, "Garanti BBVA");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Ticari", { delay: 35 });
    await page.check(`${form} input[name="useCheque"]`);
    await page.check(`${form} input[name="useNote"]`);
    await typeInto(`${form} input[name="openingAmount"]`, "50.000");
    await page.check(`${form} input[name="confirmed"]`);
    await shot("yeni-hesap-isaretler");
    await submitTop();
    await page.waitForSelector(`${bankWin} [data-confirm-line]`, { timeout: 10000 });
    const garanti = (await accountsApi()).find(account => account.bankName === "Garanti BBVA");
    ctx.garanti = garanti;
    ok(garanti && garanti.kind === "commercial" && garanti.useCheque && garanti.useNote && !garanti.useCard && !garanti.usePos, `sunucu: ${garanti?.label} Çek ${garanti?.useCheque} Senet ${garanti?.useNote} Kart ${garanti?.useCard} POS ${garanti?.usePos}`);
    const usage = await rawText(`${bankWin} .hof-chq-facts`);
    ok(/Kullanım\s*Çek · Senet/.test(usage), "ayrıntıda Kullanım: Çek · Senet");
  });

  await step("2.3 Yapı Kredi → Düzenle → Kredi Kartı Kullan → \"+ Kredi Kartı Ekle\": World •••• 1234, limit 50.000, kesim 5, son ödeme 15", async () => {
    await openBankAccount(ctx.yk.id);
    ok(!(await page.$(`${bankWin} [data-bank-cards]`)), "işaret yokken Kredi Kartları bölümü yok");
    await page.click(`${bankWin} [data-act="edit"]`);
    const form = `${top} .hof-form`;
    await page.waitForSelector(`${form} input[name="useCard"]`, { timeout: 8000 });
    await page.check(`${form} input[name="useCard"]`);
    await submitTop();
    await page.waitForSelector(`${bankWin} [data-bank-cards] [data-act="card-add"]`, { timeout: 10000 });
    await page.click(`${bankWin} [data-bank-cards] [data-act="card-add"]`);
    await page.waitForSelector(`${form} input[name="cardLast4"]`, { timeout: 8000 });
    await page.waitForFunction(() => document.querySelector('.hof-modal-backdrop.is-visible:last-of-type select[name="parentId"]')?.options.length > 0, null, { timeout: 8000 });
    const parent = await page.$eval(`${form} select[name="parentId"]`, node => node.selectedOptions[0]?.textContent.trim() || "");
    ok(/Yapı Kredi · TL/.test(parent), `Bağlı Banka Hesabı ön seçili: ${parent}`);
    // Kart Adı odakta (autofocus): yaz → Tab → Son 4 Hane → Tab → Kart Limiti.
    await page.keyboard.type("World", { delay: 35 });
    await page.keyboard.press("Tab");
    await page.keyboard.type("1234", { delay: 35 });
    await page.keyboard.press("Tab");
    await page.keyboard.type("50.000", { delay: 35 });
    await typeInto(`${form} input[name="statementDay"]`, "5");
    await typeInto(`${form} input[name="dueDay"]`, "15");
    await shot("kart-ekle");
    await submitTop();
    await page.waitForFunction(() => /World/.test(document.querySelector(".hof-bank-modal [data-bank-cards]")?.textContent || ""), null, { timeout: 10000 });
    const world = (await accountsApi()).find(account => account.name === "World");
    ctx.world = world;
    ok(world && world.parentId === ctx.yk.id && world.bankName === "Yapı Kredi" && world.cardLast4 === "1234" && world.creditLimitMinor === 5_000_000 && world.statementDay === 5 && world.dueDay === 15, `sunucu: ${world?.label} bağlı ${world?.parentId === ctx.yk.id} son4 ${world?.cardLast4} limit ${world?.creditLimitMinor / 100} günler ${world?.statementDay}/${world?.dueDay}`);
    const section = await textOf(`${bankWin} [data-bank-cards]`);
    ok(/World/.test(section) && /1234/.test(section) && /50\.000,00/.test(section), `Kredi Kartları bölümü: ${section.slice(0, 160)}`);
    await shot("kredi-kartlari-bolumu");
  });

  await step("2.3 Hesaplar: World Yapı Kredi'nin HEMEN altında (↳); eski kartta öneri → Bağla → bağlandı", async () => {
    await bankTab("accounts");
    const order = await page.$$eval(`${bankWin} .hof-bank-accounts tbody tr[data-account]`, rows => rows.map(row => row.dataset.account));
    const at = id => order.indexOf(id);
    ok(at(ctx.world.id) === at(ctx.yk.id) + 1, `sıra: Yapı Kredi ${at(ctx.yk.id)}, World ${at(ctx.world.id)}`);
    ok(await page.$(`${bankWin} tr[data-account="${ctx.world.id}"].hof-bank-child`), "World girintili");
    const suggest = await textOf(`${bankWin} [data-card-suggest="${ctx.legacyCard.id}"]`);
    ok(/Öneri: Yapı Kredi · TL/.test(suggest), `eski kart önerisi: ${suggest}`);
    ok((await accountApi(ctx.legacyCard.id)).parentId === "", "öneri kendiliğinden bağlamadı");
    await shot("hesaplar-kart-altinda");
    await page.click(`${bankWin} [data-card-suggest="${ctx.legacyCard.id}"] [data-act="link-card"]`);
    await page.click(`${top} [data-answer="yes"]`);
    await page.waitForFunction(id => !document.querySelector(`.hof-bank-modal [data-card-suggest="${id}"]`), ctx.legacyCard.id, { timeout: 10000 });
    const linked = await accountApi(ctx.legacyCard.id);
    ok(linked.parentId === ctx.yk.id, `Bağla: eski kart Yapı Kredi'ye bağlandı (${linked.parentId === ctx.yk.id})`);
  });

  await step("2.3 World → + Kart Borcu Ödemesi: ödeyen hesap bağlı banka (Yapı Kredi), Garanti değil", async () => {
    await openBankAccount(ctx.world.id);
    const facts = await rawText(`${bankWin} .hof-chq-facts`);
    ok(/Bağlı Banka Hesabı\s*Yapı Kredi · TL/.test(facts) && /Son 4 Hane\s*•••• 1234/.test(facts), "kart ayrıntısında bağlı banka ve son 4 hane");
    await page.click(`${bankWin} [data-act="v-card"]`);
    await page.waitForSelector(`${top} .hof-form select[name="accountId"]`, { timeout: 8000 });
    const payer = await page.$eval(`${top} .hof-form select[name="accountId"]`, node => node.value);
    ok(payer === ctx.yk.id, `ödeyen hesap: ${payer === ctx.yk.id ? "Yapı Kredi · TL" : payer}`);
    await shot("kart-borcu-odeyen");
    await closeAll();
  });

  // ---------- 2.5–2.6 Verilen çekte Çek Hesabı, senette ödeme hesabı önerisi ----------
  // Durum: Garanti BBVA · Ticari "Çek Kullan" + "Senet Kullan" işaretli (bölüm 1), Ziraat ve Yapı Kredi işaretsiz.
  const openCheques = async () => {
    if (!(await page.$(".hof-cheques-modal"))) {
      await closeAll();
      await page.click('#hof-sidecard [data-action="cheques"]');
      await page.waitForSelector(".hof-cheques-modal [data-act=\"new-out\"]", { timeout: 15000 });
    }
    // Kaydedince evrak kartı açılır: listeye dön.
    if (await page.$('.hof-cheques-modal [data-act="back"]')) await page.click('.hof-cheques-modal [data-act="back"]');
    await page.waitForSelector('.hof-cheques-modal [data-act="new-out"]', { timeout: 10000 });
    await pause(400);
  };
  const chequeRow = async serial => (await must("çekler", api.get("/api/workspace/cheques?direction=out"))).cheques.find(item => item.serialNo === serial);
  // Çek formu seçicisi tekil: (toast'lar body'nin sonuna eklendiğinden :last-of-type her zaman pencereyi göstermez).
  const chequeForm = `${modal} .hof-form:has([name="serialNo"])`;
  const fillCheque = async ({ amount, serial, due = "2026-11-20", drawer = "Lehtar Ltd." }) => {
    const form = chequeForm;
    await page.waitForSelector(`${form} input[name="amount"]`, { timeout: 8000 });
    await page.type(`${form} input[name="amount"]`, amount, { delay: 35 });
    await page.fill(`${form} input[name="dueDate"]`, due);
    await typeInto(`${form} input[name="serialNo"]`, serial);
    await typeInto(`${form} input[name="drawer"]`, drawer);
  };
  await step("2.5 Çek / Senet Ver (tek Çek Kullan hesabı): \"Banka / Şube\" yerine Çek Hesabı Garanti; kaydedilen çek o hesapta", async () => {
    await openCheques();
    await page.click('.hof-cheques-modal [data-act="new-out"]');
    await fillCheque({ amount: "2.500", serial: "GAR-001" });
    const form = chequeForm;
    await page.waitForSelector(`${form} [data-cheque-pick] [data-bank-single]`, { timeout: 8000 });
    const note = await textOf(`${form} [data-cheque-pick] [data-bank-single]`);
    ok(/Garanti BBVA · Ticari hesabının karnesinden verilir/.test(note), `Çek Hesabı: “${note}”`);
    ok(!(await visible(`${form} input[name="bank"]`)), "Banka / Şube metni gizli");
    await shot("cek-ver-tek-hesap");
    await page.click(`${form} button[type="submit"]`);
    await pause(900);
    const cheque = await chequeRow("GAR-001");
    ctx.garCheque = cheque;
    ok(cheque && cheque.bankAccountId === ctx.garanti.id && cheque.bank === "Garanti BBVA · Ticari", `sunucu: hesap ${cheque?.bankAccountId === ctx.garanti.id ? "Garanti" : cheque?.bankAccountId}, metin “${cheque?.bank}”`);
  });

  await step("2.5 iki Çek Kullan hesabı: seçim zorunlu (boş kaydedilmez), Ziraat seçilir; Senet'e geçince \"Ödeme Hesabı (Öneri)\" ve metin geri gelir", async () => {
    await must("Ziraat Çek Kullan", api.put(`/api/workspace/bank/accounts/${ctx.ziraat.id}`, { useCheque: true }));
    await openCheques();
    await page.click('.hof-cheques-modal [data-act="new-out"]');
    await fillCheque({ amount: "1.750", serial: "ZIR-001" });
    const form = chequeForm;
    await page.waitForSelector(`${form} [data-cheque-pick] select[name="bankAccountId"]`, { timeout: 8000 });
    const options = await optionsOf(`${form} [data-cheque-pick] select[name="bankAccountId"]`);
    ok(options.length === 3 && options.some(label => /Ziraat Bankası · Ana TL/.test(label)) && options.some(label => /Garanti BBVA · Ticari/.test(label)) && !options.some(label => /Yapı Kredi/.test(label)), `Çek Hesabı seçenekleri: ${options.join(" | ")}`);
    await page.click(`${form} button[type="submit"]`);
    await pause(500);
    const error = await textOf(`${form} .hof-form-error`);
    ok(/Çek Hesabı/.test(error) && !(await chequeRow("ZIR-001")), `seçimsiz kaydedilmedi: “${error}”`);
    // Senet'e geç: öneri seçicisi + metin; geri Çek'e dön.
    await page.selectOption(`${form} select[name="instrument"]`, "note");
    await pause(300);
    ok(/Ödeme Hesabı \(Öneri\)/.test(await textOf(`${form} [data-cheque-pick="note"]`)) && (await visible(`${form} input[name="bank"]`)), "senette Ödeme Hesabı (Öneri) ve Banka / Şube metni");
    await page.selectOption(`${form} select[name="instrument"]`, "cheque");
    await page.waitForSelector(`${form} [data-cheque-pick="cheque"] select`, { timeout: 5000 });
    await page.selectOption(`${form} [data-cheque-pick] select[name="bankAccountId"]`, ctx.ziraat.id);
    await shot("cek-ver-iki-hesap");
    await page.click(`${form} button[type="submit"]`);
    await pause(900);
    const cheque = await chequeRow("ZIR-001");
    ok(cheque?.bankAccountId === ctx.ziraat.id && cheque?.bank === "Ziraat Bankası · Ana TL", `sunucu: Ziraat çeki (${cheque?.bank})`);
  });

  await step("2.5 alınan çek: \"Banka / Şube\" müşterinin bankası, serbest metin (Çek Hesabı yok)", async () => {
    await openCheques();
    await page.click('.hof-cheques-modal [data-act="new-in"]');
    const form = chequeForm;
    await page.waitForSelector(`${form} input[name="amount"]`, { timeout: 8000 });
    await pause(600);
    ok((await visible(`${form} input[name="bank"]`)) && !(await page.$(`${form} [data-cheque-pick]`)), "alınan çekte metin var, Çek Hesabı yok");
    await page.click(`${chequeForm} [data-cancel]`);
    await pause(300);
  });

  await step("2.5 Garanti çekini öde: hesap seçicisinde çekin hesabı (Garanti) seçili gelir; para Garanti'den çıkar", async () => {
    await openCheques();
    await page.click(`.hof-cheques-modal tr[data-cheque="${ctx.garCheque.id}"]`);
    await page.waitForSelector('.hof-cheques-modal [data-action="pay"]', { timeout: 8000 });
    const facts = await rawText(".hof-cheques-modal .hof-chq-facts");
    ok(/Çek Hesabı\s*Garanti BBVA · Ticari/.test(facts), "çek kartında Çek Hesabı");
    const before = (await accountApi(ctx.garanti.id)).balanceMinor;
    await page.click('.hof-cheques-modal [data-action="pay"]');
    const form = `${top} .hof-form`;
    await page.waitForSelector(`${form} [data-bank-pick] select[name="bankAccountId"]`, { timeout: 8000 });
    const value = await page.$eval(`${form} [data-bank-pick] select[name="bankAccountId"]`, node => node.value);
    ok(value === ctx.garanti.id, `ödenen hesap ön seçili: ${value === ctx.garanti.id ? "Garanti" : value}`);
    await shot("cek-ode-hesap-dolu");
    await submitTop();
    const after = (await accountApi(ctx.garanti.id)).balanceMinor;
    ok(before - after === 250_000, `Garanti ${before / 100} → ${after / 100} (2.500 çıktı)`);
  });

  await step("2.5 Çek Kullan işareti yokken \"Çek Hesabı Tanımla\": yazılanlar kaybolmadan Yapı Kredi işaretlenir, çek o hesapta", async () => {
    await must("Garanti Çek Kullan kapat", api.put(`/api/workspace/bank/accounts/${ctx.garanti.id}`, { useCheque: false }));
    await must("Ziraat Çek Kullan kapat", api.put(`/api/workspace/bank/accounts/${ctx.ziraat.id}`, { useCheque: false }));
    await openCheques();
    await page.click('.hof-cheques-modal [data-act="new-out"]');
    await fillCheque({ amount: "900", serial: "YAP-001" });
    const form = `${modal} .hof-form:has([name="serialNo"])`;
    await page.waitForSelector(`${form} [data-bank-define="cheque"]`, { timeout: 8000 });
    ok(await visible(`${form} input[name="bank"]`), "Çek hesabı yokken Banka / Şube metni görünür (bugünkü gibi)");
    await page.click(`${form} [data-bank-define="cheque"]`);
    await page.waitForSelector(`${top} .hof-form select[name="accountId"]`, { timeout: 8000 });
    await page.selectOption(`${top} .hof-form select[name="accountId"]`, ctx.yk.id);
    await pause(450); // pencerenin açılış geçişi bitsin (ekran görüntüsü)
    await shot("cek-hesabi-tanimla");
    await submitTop();
    await page.waitForSelector(`${form} [data-cheque-pick] [data-bank-single]`, { timeout: 8000 });
    ok(/Yapı Kredi · TL/.test(await textOf(`${form} [data-cheque-pick] [data-bank-single]`)), "Çek Hesabı: Yapı Kredi · TL (seçili)");
    ok((await page.$eval(`${form} input[name="amount"]`, node => node.value)) === "900" && (await page.$eval(`${form} input[name="serialNo"]`, node => node.value)) === "YAP-001", "tutar ve seri no kaybolmadı");
    await page.click(`${form} button[type="submit"]`);
    await pause(900);
    const cheque = await chequeRow("YAP-001");
    ok(cheque?.bankAccountId === ctx.yk.id && (await accountApi(ctx.yk.id)).useCheque === true, "çek Yapı Kredi'de; hesapta Çek Kullan işaretli");
    await closeAll();
  });

  // ---------- 2.7 Seçicilerde bakiye ----------
  // Durum (önceki bölümlerden, bağımsız hesap): Ziraat 10.000 − 1.200 = 8.800; Garanti 50.000 − 2.500 (çek ödemesi) = 47.500; Yapı Kredi 20.000.
  const bankRequests = [];
  page.on("request", request => {
    const url = request.url();
    if (/\/api\/workspace\/bank\/(choices|balances)/.test(url)) bankRequests.push(url.replace(BASE, ""));
  });
  const countOf = pattern => bankRequests.filter(url => pattern.test(url)).length;
  const lineOf = async (scope, selector = "[data-bank-balance]") => ({ text: await textOf(`${scope} ${selector}`), negative: await page.$eval(`${scope} ${selector}`, node => node.classList.contains("is-negative")).catch(() => false) });

  await step("2.7 cari Ödeme → Havale: seçeneklerde bakiye; Garanti (Engelle) 47.500,01 → kırmızı \"kaydedilmez\", sunucu da reddeder; 40.000 → İşlemden Sonra 7.500; tek istek", async () => {
    await must("Garanti Engelle", api.put(`/api/workspace/bank/accounts/${ctx.garanti.id}`, { negativePolicy: "block" }));
    ok((await accountApi(ctx.garanti.id)).balanceMinor === 4_750_000 && (await accountApi(ctx.ziraat.id)).balanceMinor === 880_000, "başlangıç: Garanti 47.500, Ziraat 8.800");
    await closeAll();
    await openParty(page, ctx.supplier.id);
    bankRequests.length = 0;
    await page.click('.hof-accounts-modal [data-entry="out"]');
    const form = `${modal} .hof-form:has(select[name="method"])`;
    await page.waitForSelector(`${form} input[name="amount"]`, { timeout: 8000 });
    await typeInto(`${form} input[name="amount"]`, "47.500,01");
    await page.selectOption(`${form} select[name="method"]`, "bank");
    await page.waitForSelector(`${form} [data-bank-pick] select[name="bankAccountId"]`, { timeout: 8000 });
    const options = await optionsOf(`${form} [data-bank-pick] select[name="bankAccountId"]`);
    ok(options.some(label => /^Garanti BBVA · Ticari \(.+\) — ₺47\.500,00$/.test(label)) && options.some(label => /^Ziraat Bankası · Ana TL \(.+\) — ₺8\.800,00$/.test(label)) && options.some(label => /^Yapı Kredi · TL \(YAP-TL\) — ₺20\.000,00$/.test(label)), `seçenekler: ${options.join(" | ")}`);
    await page.selectOption(`${form} [data-bank-pick] select[name="bankAccountId"]`, ctx.garanti.id);
    await page.waitForSelector(`${form} [data-bank-pick] [data-bank-balance]`, { timeout: 5000 });
    const red = await lineOf(`${form} [data-bank-pick]`);
    ok(red.negative && /Bakiye \(08\.10\.2026\): ₺47\.500,00/.test(red.text) && /İşlemden Sonra: −₺0,01/.test(red.text) && /eksi bakiyeye izin verilmiyor \(Engelle\), kaydedilmez/.test(red.text), `kırmızı satır: “${red.text}”`);
    await shot("bakiye-engelle-kirmizi");
    await page.click(`${form} button[type="submit"]`);
    await pause(1200);
    const error = await textOf(`${form} .hof-form-error`);
    const tried = (await must("cari", api.get(`/api/workspace/accounts/${ctx.supplier.id}`))).entries.some(item => item.kind === "out" && Math.abs(item.amount - 47500.01) < 0.001);
    ok(/eksi bakiyeye izin verilmiyor/.test(error) && !tried, `sunucu da reddetti (kayıt yok): “${error.slice(0, 120)}”`);
    // Tutar düzeltilir (insan hızında): satır yazdıkça güncellenir.
    await typeInto(`${form} input[name="amount"]`, "40.000");
    const fine = await lineOf(`${form} [data-bank-pick]`);
    ok(!fine.negative && /İşlemden Sonra: ₺7\.500,00/.test(fine.text) && !/kaydedilmez/.test(fine.text), `40.000: “${fine.text}”`);
    ok(countOf(/\/bank\/choices/) === 1 && countOf(/\/bank\/balances/) === 0, `seçici açılırken tek istek: choices ${countOf(/\/bank\/choices/)}, balances ${countOf(/\/bank\/balances/)}`);
    await shot("bakiye-islemden-sonra");
    await page.click(`${form} button[type="submit"]`);
    await pause(1200);
    ok((await accountApi(ctx.garanti.id)).balanceMinor === 750_000, `kaydedildi: Garanti ${(await accountApi(ctx.garanti.id)).balanceMinor / 100} (beklenen 7.500)`);
    await closeAll();
  });

  await step("2.7 Kasadan Bankaya Yatır: tutarın altında Nakit Kasa (3.000) ve seçilen hesabın bakiyesi; tarih 05.10 → o günün bakiyesi (tek bakiye isteği); 3.000 → Kasa 0", async () => {
    await must("Kasa tahsilatı", api.post("/api/workspace/cash", { kind: "in", amount: "3.000", date: "2026-10-06", description: "İz 2.7 nakit" }));
    const policy = (await must("eksi bakiye", api.get("/api/admin/negative-policy"))).cash;
    await closeAll();
    await page.click('#hof-sidecard [data-action="cash"]');
    await page.waitForSelector(`${modal} [data-transfer="to-bank"]`, { timeout: 10000 });
    bankRequests.length = 0;
    await page.click(`${modal} [data-transfer="to-bank"]`);
    const form = `${modal} .hof-form:has(input[name="amount"]):has(input[name="description"])`;
    await page.waitForSelector(`${form} [data-cash-balance]`, { timeout: 8000 });
    await page.selectOption(`${form} [data-bank-pick] select[name="bankAccountId"]`, ctx.ziraat.id);
    await typeInto(`${form} input[name="amount"]`, "3.500");
    const cash = await lineOf(form, "[data-cash-balance]");
    const ruleText = { warn: /kaydederken onay istenir \(Uyar\)/, block: /kaydedilmez/, off: /Kontrol Yok/ }[policy];
    ok(cash.negative && /Nakit Kasa \(08\.10\.2026\): ₺3\.000,00/.test(cash.text) && /İşlemden Sonra: −₺500,00/.test(cash.text) && ruleText?.test(cash.text), `Nakit Kasa satırı (${policy}): “${cash.text}”`);
    const bank = await lineOf(`${form} [data-bank-pick]`);
    ok(/Bakiye \(08\.10\.2026\): ₺8\.800,00/.test(bank.text) && /İşlemden Sonra: ₺12\.300,00/.test(bank.text) && !bank.negative, `banka satırı: “${bank.text}”`);
    await shot("kasadan-bankaya-nakit-kasa");
    await page.fill(`${form} input[name="date"]`, "2026-10-05");
    await page.waitForFunction(() => /05\.10\.2026/.test(document.querySelector(".hof-modal-backdrop.is-visible .hof-form [data-cash-balance]")?.textContent || ""), null, { timeout: 8000 });
    const early = await lineOf(form, "[data-cash-balance]");
    ok(/Nakit Kasa \(05\.10\.2026\): ₺0,00/.test(early.text) && /İşlemden Sonra: −₺3\.500,00/.test(early.text), `05.10 Nakit Kasa (06.10'daki tahsilat yok): “${early.text}”`);
    ok(countOf(/\/bank\/choices/) === 1 && countOf(/\/bank\/balances\?date=2026-10-05/) === 1, `istekler: choices ${countOf(/\/bank\/choices/)}, balances ${bankRequests.filter(url => /balances/.test(url)).join(", ")}`);
    await page.fill(`${form} input[name="date"]`, TODAY);
    await page.waitForFunction(() => /08\.10\.2026/.test(document.querySelector(".hof-modal-backdrop.is-visible .hof-form [data-cash-balance]")?.textContent || ""), null, { timeout: 8000 });
    await typeInto(`${form} input[name="amount"]`, "3.000");
    const zero = await lineOf(form, "[data-cash-balance]");
    ok(!zero.negative && /İşlemden Sonra: ₺0,00/.test(zero.text), `3.000: “${zero.text}”`);
    await page.click(`${form} button[type="submit"]`);
    await pause(1200);
    const after = await must("bakiyeler", api.get(`/api/workspace/bank/balances?date=${TODAY}`));
    ok(after.cash.atMinor === 0 && after.balances.accounts[ctx.ziraat.id].atMinor === 1_180_000, `Nakit Kasa ${after.cash.atMinor / 100}, Ziraat ${after.balances.accounts[ctx.ziraat.id].atMinor / 100} (beklenen 0 ve 11.800)`);
    await closeAll();
  });

  await step("2.7 yetkisiz (personel; Banka Görüntüleme yok): Tahsilat → Havale seçicisinde bakiye YOK (seçenekte tutar yok, satır yok)", async () => {
    await must("personel", api.post("/api/admin/users", { username: "personel220", name: "Personel 220", role: "personel", password: "Personel-2026!", mustChangePassword: false }));
    const context3 = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: "tr-TR" });
    const other = await context3.newPage();
    other.on("pageerror", error => errors.push(`pageerror (personel) ${error.message}`));
    await installPageClock(other, app.config.now);
    await other.goto(`${BASE}/`);
    await other.fill("#hof-auth input[name=username]", "personel220");
    await other.fill("#hof-auth input[name=password]", "Personel-2026!");
    await Promise.all([other.waitForEvent("load"), other.click('#hof-auth button[type="submit"]')]);
    await other.waitForSelector("#hof-sidecard", { timeout: 60000 });
    await other.waitForTimeout(800);
    await other.click('#hof-sidecard [data-action="accounts"]');
    await other.waitForSelector(`.hof-accounts-modal tr[data-account="${ctx.supplier.id}"]`, { timeout: 10000 });
    await other.click(`.hof-accounts-modal tr[data-account="${ctx.supplier.id}"]`);
    await other.waitForSelector('.hof-accounts-modal [data-entry="in"]', { timeout: 10000 });
    await other.click('.hof-accounts-modal [data-entry="in"]');
    const form = `${modal} .hof-form:has(select[name="method"])`;
    await other.waitForSelector(`${form} input[name="amount"]`, { timeout: 8000 });
    await other.fill(`${form} input[name="amount"]`, "100");
    await other.selectOption(`${form} select[name="method"]`, "bank");
    await other.waitForSelector(`${form} [data-bank-pick] select[name="bankAccountId"]`, { timeout: 8000 });
    await other.selectOption(`${form} [data-bank-pick] select[name="bankAccountId"]`, ctx.garanti.id);
    await other.waitForTimeout(400);
    const options = await other.$$eval(`${form} [data-bank-pick] select[name="bankAccountId"] option`, nodes => nodes.map(node => node.textContent.trim()));
    const line = await other.$(`${form} [data-bank-balance]`);
    ok(options.length > 2 && !options.some(label => /₺|—/.test(label)) && !line, `personel: seçenekler “${options.join(" | ")}”, bakiye satırı ${line ? "VAR" : "yok"}`);
    await other.screenshot({ path: path.join(OUT, "00-personel-bakiye-yok.png") });
    await context3.close();
  });

  // ---------- 2.8 Fatura ödeme düğmeleri yola göre ----------
  // Durum: Garanti 7.500 (Engelle), Ziraat 11.800, Yapı Kredi 20.000 (Çek Kullan tek hesap); kartlar Bonus (Ziraat), World (Yapı Kredi, limit 50.000), World Eski.
  const inv = `${modal} .hof-invoices-modal`;
  await step("2.8 alış faturası 1.000: düğmeler yola göre, satır başlığı yolun adı (yol kutusu yok); Havale 600 Garanti (bakiye satırı) + Kalanın Tamamını Öde → Kredi Kartı 400 World; çek satırında Çek Hesabı", async () => {
    await closeAll();
    await page.click("#hof-sidecard [data-action=invoices]");
    await page.waitForSelector(`${inv} [data-act="new"]`, { timeout: 15000 });
    await page.click(`${inv} [data-act="new"]`);
    await page.click(`${inv} [data-scenario="expense_purchase"]`);
    await page.waitForSelector(`${inv} [data-lines]`, { timeout: 10000 });
    await page.fill(`${inv} [data-f="number"]`, "AL-220-1");
    await page.fill(`${inv} [data-acc-query]`, "Tedarikçi A");
    await page.waitForSelector(`${inv} .hof-acc-picker li[data-id="${ctx.supplier.id}"]`, { timeout: 8000 });
    await (await page.$(`${inv} .hof-acc-picker li[data-id="${ctx.supplier.id}"]`)).dispatchEvent("mousedown");
    await page.click(`${inv} [data-l="0"][data-f="name"]`);
    await page.keyboard.type("Ofis Kirası", { delay: 35 });
    await page.click(`${inv} [data-l="0"][data-f="unitPrice"]`);
    await page.keyboard.press("Control+A");
    await page.keyboard.type("1000", { delay: 35 });
    await page.selectOption(`${inv} [data-l="0"][data-f="vatRate"]`, "0").catch(() => null);
    await pause(1300);
    const buttons = await page.$$eval(`${inv} [data-pay] .hof-inv-pay-add button`, nodes => nodes.map(node => node.textContent.trim()));
    ok(buttons.join(" | ") === "+ Nakit | + Havale / EFT | + Kredi Kartı | + Çek / Senet | Portföyden Ciro Et | Kalanın Tamamını Öde", `düğmeler: ${buttons.join(" | ")}`);
    await page.click(`${inv} [data-act="pay-add-cash"][data-method="bank"]`);
    const row0 = `${inv} .hof-inv-pay-row:has([data-pay="cash"][data-i="0"])`;
    await page.waitForSelector(`${inv} [data-bank-cell="0"]:not([hidden]) select`, { timeout: 8000 });
    ok((await textOf(`${row0} .hof-inv-pay-way`)) === "Havale / EFT" && !(await page.$(`${inv} [data-pay="cash"][data-f="method"]`)), "satır başlığı Havale / EFT; yol kutusu yok");
    await page.selectOption(`${inv} [data-bank-cell="0"] select`, ctx.garanti.id);
    await typeInto(`${inv} [data-pay="cash"][data-i="0"][data-f="amount"]`, "8.000");
    const red = await lineOf(`${inv} [data-inv-balance="0"]`);
    ok(red.negative && /Bakiye \(08\.10\.2026\): ₺7\.500,00/.test(red.text) && /İşlemden Sonra: −₺500,00/.test(red.text) && /kaydedilmez/.test(red.text), `8.000 → kırmızı: “${red.text}”`);
    await typeInto(`${inv} [data-pay="cash"][data-i="0"][data-f="amount"]`, "600");
    const fine = await lineOf(`${inv} [data-inv-balance="0"]`);
    ok(!fine.negative && /İşlemden Sonra: ₺6\.900,00/.test(fine.text), `600 → “${fine.text}”`);
    // Kalanın Tamamını Öde: yol sorulur (satırlar yeniden çizilmez); Kredi Kartı → kalan 400 yeni Kredi Kartı satırına, kart seçimi gerekir.
    await page.click(`${inv} [data-act="pay-rest"]`);
    await page.waitForSelector(`${inv} [data-pay-choose]:not([hidden])`, { timeout: 5000 });
    const ask = await textOf(`${inv} [data-pay-choose]`);
    ok(/Kalan ₺400,00 hangi yolla ödensin\?/.test(ask) && /Nakit/.test(ask) && /Kredi Kartı/.test(ask), `yol sorusu: “${ask}”`);
    await page.click(`${inv} [data-act="pay-rest-method"][data-method="card"]`);
    await page.waitForSelector(`${inv} [data-bank-cell="1"][data-bank-kind="card"] select`, { timeout: 8000 });
    const row1 = `${inv} .hof-inv-pay-row:has([data-pay="cash"][data-i="1"])`;
    ok((await textOf(`${row1} .hof-inv-pay-way`)) === "Kredi Kartı" && (await page.$eval(`${inv} [data-pay="cash"][data-i="1"][data-f="amount"]`, node => node.value)) === "400", "Kredi Kartı satırı 400 eklendi");
    ok(await page.$eval(`${inv} [data-act="pay-rest"]`, node => node.disabled), "kalan kalmadı: Kalanın Tamamını Öde pasif");
    await page.selectOption(`${inv} [data-bank-cell="1"] select`, ctx.world.id);
    await pause(300);
    const cardLine = await lineOf(`${inv} [data-inv-balance="1"]`);
    ok(/Kart \(08\.10\.2026\): Borç ₺0,00/.test(cardLine.text) && /İşlemden Sonra: Borç ₺400,00/.test(cardLine.text) && /Kart Limiti: ₺50\.000,00/.test(cardLine.text) && !cardLine.negative, `kart satırı: “${cardLine.text}”`);
    // Çek satırı: Çek Hesabı (Çek Kullan işaretli tek hesap: Yapı Kredi) — yalnız görünüm, kaydetmeden silinir.
    await page.click(`${inv} [data-act="pay-add-cheque"]`);
    await page.waitForSelector(`${inv} [data-cheque-bank="0"]`, { timeout: 8000 });
    ok(/Çek Hesabı: Yapı Kredi · TL/.test(await textOf(`${inv} [data-cheque-bank="0"]`)), `çek satırında Çek Hesabı: “${await textOf(`${inv} [data-cheque-bank="0"]`)}”`);
    await shot("fatura-odeme-yola-gore");
    await page.click(`${inv} [data-act="pay-remove"][data-pay="cheques"][data-i="0"]`);
    await pause(400);
    await page.click(`${inv} [data-act="issue"]`);
    let saved = null;
    for (let i = 0; i < 16 && !saved; i += 1) {
      await pause(500);
      const yes = await page.$(`${modal} [data-answer="yes"]`);
      if (yes) {
        await yes.click();
        continue;
      }
      saved = (unwrap(await api.get("/api/workspace/invoices?tab=all&limit=50")).invoices || []).find(doc => doc.number === "AL-220-1") || null;
    }
    const doc = saved ? await must("fatura", api.get(`/api/workspace/invoices/${saved.id}`)) : null;
    const cash = doc?.payment?.cash || [];
    ok(cash.length === 2 && cash[0].method === "bank" && cash[0].amount === 600 && cash[0].bankAccountId === ctx.garanti.id && cash[1].method === "card" && cash[1].amount === 400 && cash[1].bankAccountId === ctx.world.id && doc.payState === "paid", `kayıt: ${JSON.stringify(cash.map(item => [item.method, item.amount, item.bankAccountId === ctx.garanti.id ? "Garanti" : item.bankAccountId === ctx.world.id ? "World" : item.bankAccountId]))}, ${doc?.payState}`);
    ok((await accountApi(ctx.garanti.id)).balanceMinor === 690_000 && (await accountApi(ctx.world.id)).balanceMinor === -40_000, `Garanti ${(await accountApi(ctx.garanti.id)).balanceMinor / 100} (beklenen 6.900), World ${(await accountApi(ctx.world.id)).balanceMinor / 100} (beklenen −400)`);
    await closeAll();
  });

  // ---- SON (yeni bölümler bunun üstüne) ----
} catch (error) {
  failed += 1;
  console.log(`✗ kurulum hatası: ${error.stack || error.message}`);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-banka-220: ${passed} geçti, ${failed} kaldı · ekran görüntüleri ${OUT}`);
  await browser.close();
  await app.close();
  fs.rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
