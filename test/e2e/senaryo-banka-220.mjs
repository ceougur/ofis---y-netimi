// Senaryo Banka 2.2.0 — İz 2 EKRANDAN (docs/2.2.0-IS-LISTESI.md 2.1–2.9; CLAUDE.md 12.10.2026 müşteri istekleri). Gerçek kullanıcı gibi
// tıklanır, Tab ile ilerlenir, insan hızında yazılır (ders 12); her adımdan sonra sayı veri tabanından (API) okunur; ekran görüntüleri
// artifacts/senaryo-banka-220/.
//  2.1  Hesaplar'da "Açılış Bakiyesi Doğrulanmadı" + ne yapılacağı; hesap ayrıntısında açıklama + Açılışı Düzelt bağlantısı → doğrulanır.
//  2.2  Yeni Hesap: Kredi Kartı / Çek / Senet / POS Kullan işaretleri (Vadeli'de gizli); kaydedilen işaretler sunucuda.
//  2.3  Yeni Hesap türlerinde kredi kartı YOK; kart bankanın içinden ("+ Kredi Kartı Ekle"): bağlı banka, son 4 hane; Hesaplar'da kart bankanın
//       altında; eski bağsız karta öneri → Bağla; Kart Borcu Ödemesi'nde ödeyen hesap bağlı banka.
// Çalıştırma: npm run test:senaryo-banka-220
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient, installPageClock } from "../helpers.mjs";

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
    await page.keyboard.press("Escape");
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
const openBank = async () => {
  if (!(await page.$(`${bankWin} [data-bank] .hof-bank-tabs`))) {
    await page.click('#hof-sidecard [data-action="bank"]');
    await page.waitForSelector(`${bankWin} [data-bank] .hof-bank-tabs`, { timeout: 15000 });
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
