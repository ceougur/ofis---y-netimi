// Senaryo Banka 2.1.0 — bölüm 1 (Aşama 3: Banka Hesapları, arayüz; docs/BANKA-MODULU-PLAN.md §8, §12.3, §12.5 kabul 1–4). Gerçek kullanıcı
// gibi tıklanır; sayılar ekrandan okunur ve sunucudan (API, mizan) doğrulanır. Sahte saat 08.10.2026 Perşembe (sunucu config.now +
// Playwright page.clock). Sonraki aşamalar bu dosyaya kendi bölümlerini ekler (kabul 5–16).
//  1. Boş şirket: menüde Banka Taksitler'in hemen altında; Banka'yı ilk açan yöneticiye Kurulum Sihirbazı (POS adımı yok); atlanınca
//     Genel Bakış'ta "—", "Banka Hesabı Tanımlanmadı", "Kurulumu Tamamla"; pencere yeniden açılınca sihirbaz kendiliğinden gelmez.
//  2. Kurulumu Tamamla → geçersiz IBAN ekranda hata (alan işaretli, hesap açılmaz) → Ziraat Bankası 100.000 + Garanti BBVA 50.000
//     (01.10.2026, Bakiye Doğrulandı) sihirbazdan (kabul 1–4).
//  3. Genel Bakış: Gerçek Banka 150.000; Hesaplar: 102.01 / 102.02, Bakiye Doğrulandı; Alt Hesap Mizanı ekranda; mizanda 102 = 150.000,
//     500 = −150.000; Hesap Detayı: son hareketler (açılış, İşlem No), Eksi Bakiye Denetimi Uyar; kilitli açılışta Açılışı Düzelt pasif +
//     neden yazısı.
//  4. Nasıl bozarım: HTML adlı hesap ekranda kaçışlı (çalışmaz), silinir → aynı adla yeniden açılır (yeni alt hesap kodu).
//  5. Ayarlar: Temel açık, Gelişmiş kapalı; POS ve Ekstre bölümleri görünmez; değiştir → Kaydet; geçersiz değer ekranda hata, kaydedilmez;
//     Tümünü Varsayılanlara Dön.
//  6. Ortak hesap seçici: iki hesapta seçim zorunlu, tek hesapta gizli, hiç kart yoksa boş.
//  7. Yetki: personel menüde Banka'yı görmez (API 403); uzman (avukat) görür ama hesap açamaz, ayarları değiştiremez.
//  8. Canlı yenileme: muhasebe Hesaplar'ı açıkken yönetici başka yerden hesap açar → muhasebenin listesi kendiliğinden yenilenir.
//  9. Boş ikinci şirket: sihirbaz o şirkette yine ilk girişte gelir; Genel Bakış boş durum.
// 10. Mobil (390 px): Genel Bakış, Hesaplar ve Hesap Detayı yatay kaydırmasız.
// 11. Yazım düzeni: gezilen her banka ekranında adlar başlık yazımıyla; kalemle ad (side.bank) menüde ve pencere başlığında.
// Çalıştırma: npm run test:senaryo-banka-210 (ekran görüntüleri artifacts/senaryo-banka-210/).
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createApp } from "../../server/app.mjs";
import { createClient, installPageClock } from "../helpers.mjs";

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "artifacts", "senaryo-banka-210");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Prova-Admin-2026!";
const USER_PASS = "Kullanici-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-banka-210-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f40" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const clock = app.config.now;
const browser = await chromium.launch();
const errors = [];

/** Geçerli Türkiye IBAN'ı (mod 97). */
function trIban(bankCode, account) {
  const bban = `${String(bankCode).padStart(5, "0")}0${String(account).padStart(16, "0")}`;
  let rest = 0;
  for (const digit of `${bban}292700`) rest = (rest * 10 + Number(digit)) % 97;
  return `TR${String(98 - rest).padStart(2, "0")}${bban}`;
}
const ZIRAAT_IBAN = trIban(10, 1234567);
const GARANTI_IBAN = trIban(62, 7654321);
const BAD_IBAN = `${ZIRAAT_IBAN.slice(0, -1)}${(Number(ZIRAAT_IBAN.slice(-1)) + 1) % 10}`;
const spaced = iban => iban.replace(/(.{4})/g, "$1 ").trim();

let passed = 0;
let failed = 0;
let shotNo = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const shot = async (page, name, options = {}) => {
  shotNo += 1;
  await page.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`), ...options });
};
let current = null;
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
    if (current) await shot(current, "hata").catch(() => null);
  }
};
const newPage = async ({ width = 1440, height = 1000 } = {}) => {
  const context = await browser.newContext({ viewport: { width, height }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  // Beklenen retler (geçersiz IBAN 400, personelin yetkisiz isteği 403, girişten önceki oturum yoklaması 401) hata sayılmaz.
  page.on("console", message => {
    if (message.type() === "error" && !/status of 40[0139]|api\/auth\/me|Failed to load resource/.test(`${message.text()} ${message.location().url}`)) errors.push(`console ${message.text()}`);
  });
  await installPageClock(page, clock);
  return page;
};
const login = async (page, username, password) => {
  await page.goto(`${BASE}/`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForTimeout(700);
};
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const bankWin = ".hof-bank-modal";
const wiz = ".hof-bank-wiz-modal";
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
const textOf = (page, selector) => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const has = (text, needle) => String(text).includes(needle);
const closeTop = async page => {
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
};
const answerYes = async page => {
  await page.waitForSelector(`${top} [data-answer="yes"]`, { timeout: 8000 });
  await page.click(`${top} [data-answer="yes"]`);
  await page.waitForTimeout(400);
};
const openBank = async page => {
  await page.click('#hof-sidecard [data-action="bank"]');
  await page.waitForSelector(`${bankWin} [data-bank] .hof-bank-tabs`, { timeout: 15000 });
  await page.waitForTimeout(500);
};
const tab = async (page, id) => {
  await page.click(`${bankWin} .hof-bank-tabs [data-tab="${id}"]`);
  await page.waitForTimeout(700);
};
const noHorizontalScroll = page =>
  page.evaluate(() => {
    const dialog = document.querySelector(".hof-bank-modal");
    const wide = [...document.querySelectorAll(".hof-bank-modal *")].filter(node => node.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(node).position !== "fixed").map(node => node.className || node.tagName).slice(0, 5);
    return { page: document.documentElement.scrollWidth <= window.innerWidth + 1, dialog: dialog ? dialog.scrollWidth <= dialog.clientWidth + 1 : false, wide };
  });

// ---------- Yazım düzeni denetçisi (senaryo-211 ile aynı kural) ----------
const SMALL = new Set(["ve", "ile", "veya", "ya", "da", "de", "ki"]);
const labelProblems = new Map();
async function auditLabels(page, where) {
  const texts = await page.evaluate(() => {
    const visible = node => {
      const box = node.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== "hidden";
    };
    const own = node => [...node.childNodes].filter(child => child.nodeType === 3).map(child => child.nodeValue).join(" ").replace(/\s+/g, " ").trim();
    const sentence = node => Boolean(node.closest("[data-sentence]") || node.closest("label")?.querySelector('input[type="checkbox"], input[type="radio"]'));
    const out = [];
    const take = (selector, read = own) => document.querySelectorAll(selector).forEach(node => visible(node) && !sentence(node) && out.push(read(node)));
    take(".hof-modal-title, .hof-side-text, .hof-bank-subtitle, .hof-bank-set legend, .hof-bank-set-item > label, .hof-bank-row b, .hof-rep-stat > span, .hof-bank-steps li, .hof-chq-facts dt");
    take(".hof-modal button:not(tbody button), .hof-modal a.hof-button");
    take(".hof-modal thead th, .hof-modal .hof-field > span, .hof-modal label > span");
    take(".hof-modal select option", node => node.textContent.trim());
    return out;
  });
  for (const raw of texts) {
    const text = String(raw || "").split(" · ")[0].replace(/\([^)]*\)/g, "").replace(/[“”"][^“”"]*[“”"]/g, "").trim();
    if (!text || text.length > 60 || /[.!?]\s|[.!?]$/.test(text) || /\d{2}\.\d{2}\.\d{4}/.test(text)) continue;
    const words = text.split(/\s+/).filter(word => /\p{L}/u.test(word));
    if (words.length < 2) continue;
    const bad = words.slice(1).filter(word => /^[a-zçğıöşü]/.test(word) && !SMALL.has(word.replace(/[^\p{L}]/gu, "")));
    if (bad.length) labelProblems.set(raw.trim(), where);
  }
}

let admin = null;
let secondCompany = "";
try {
  await api.login("admin", PASS);
  for (const [username, role] of [["muhasebe1", "muhasebe"], ["personel1", "personel"], ["uzman1", "avukat"]]) await must(`kullanıcı ${username}`, api.post("/api/admin/users", { username, name: username, role, password: USER_PASS, mustChangePassword: false }));
  admin = await newPage();
  current = admin;
  await login(admin, "admin", PASS);

  await step("1. Boş şirket: menüde Banka Taksitler'in hemen altında; ilk açılışta Kurulum Sihirbazı (POS adımı yok)", async () => {
    const menu = await admin.$$eval("#hof-sidecard [data-action]", list => list.filter(node => node.offsetParent).map(node => node.dataset.action));
    ok(menu[menu.indexOf("plans") + 1] === "bank", `Banka Taksitler'in hemen altında (${menu.join(", ")})`);
    ok((await textOf(admin, '#hof-sidecard [data-action="bank"] .hof-side-text')) === "Banka", "menü adı Banka");
    ok(clock.today() === "2026-10-08" && (await admin.evaluate(() => HOF.localToday())) === "2026-10-08", "sunucu ve tarayıcı sahte günde (08.10.2026)");
    await admin.click('#hof-sidecard [data-action="bank"]');
    await admin.waitForSelector(`${wiz} [data-wiz-form]`, { timeout: 15000 });
    const steps = await admin.$$eval(`${wiz} .hof-bank-steps li`, list => list.map(node => node.textContent.replace(/\s+/g, " ").trim()));
    ok(steps.length === 2 && has(steps[0], "Hesap ve Açılış") && has(steps[1], "Bitti"), `sihirbaz adımları: ${steps.join(" › ")} (eski hareket yok, POS adımı yok)`);
    ok(!has(await textOf(admin, wiz), "POS Tanımla"), "POS adımı görünmez (2.1.0)");
    await auditLabels(admin, "Kurulum Sihirbazı");
    await shot(admin, "sihirbaz-ilk-acilis");
    await admin.click(`${wiz} [data-wiz="skip"]`);
    await admin.waitForSelector(`${wiz} [data-wiz-done]`);
    ok(has(await textOf(admin, `${wiz} [data-wiz-done]`), "Kurulum Atlandı"), "adım atlanınca: Kurulum Atlandı");
    await admin.click(`${wiz} [data-wiz="finish"]`);
    await admin.waitForTimeout(900);
    ok(!(await admin.$(wiz)), "sihirbaz kapandı");
    const real = await textOf(admin, `${bankWin} [data-bank-real]`);
    const overview = await textOf(admin, `${bankWin} [data-bank]`);
    ok(real === "—" && has(overview, "Banka Hesabı Tanımlanmadı"), `boş şirkette Gerçek Banka "—" ve "Banka Hesabı Tanımlanmadı" (${real})`);
    ok(Boolean(await admin.$(`${bankWin} [data-bank-setup] [data-act="wizard"]`)), "Genel Bakış'ta Kurulumu Tamamla");
    ok(Boolean(await admin.$(`${bankWin} [data-bank-empty]`)), "boş durum metni görünür");
    ok(!(await admin.$(`${bankWin} [data-bank-unassigned]`)), "Hesabı Atanmamış Eski Hareketler satırı yok (eski hareket yok)");
    const tabs = await admin.$$eval(`${bankWin} .hof-bank-tabs [data-tab]`, list => list.map(node => node.textContent.trim()));
    ok(JSON.stringify(tabs) === JSON.stringify(["Genel Bakış", "Hesaplar", "Ayarlar"]), `sekmeler: ${tabs.join(" · ")} (POS ve Ekstre bu sürümde yok)`);
    await auditLabels(admin, "Genel Bakış (boş)");
    await shot(admin, "bos-sirket-genel-bakis");
    ok((await must("özet", api.get("/api/workspace/bank/summary"))).setup.dismissed === true, "sihirbazın kapatıldığı sunucuda kayıtlı");
    await closeTop(admin);
    await openBank(admin);
    await admin.waitForTimeout(800);
    ok(!(await admin.$(wiz)), "pencere yeniden açılınca sihirbaz kendiliğinden gelmez");
  });

  await step("2. Kurulumu Tamamla: geçersiz IBAN ekranda hata; Ziraat 100.000 + Garanti 50.000 sihirbazdan (kabul 1–4)", async () => {
    await admin.click(`${bankWin} [data-bank-setup] [data-act="wizard"]`);
    await admin.waitForSelector(`${wiz} [data-wiz-form]`);
    const form = `${wiz} [data-wiz-form]`;
    const fill = async ({ bank, name, iban, amount }) => {
      await admin.fill(`${form} [name="bankName"]`, bank);
      await admin.fill(`${form} [name="name"]`, name);
      await admin.fill(`${form} [name="iban"]`, iban);
      await admin.fill(`${form} [name="openingDate"]`, "2026-10-01");
      await admin.fill(`${form} [name="openingAmount"]`, amount);
      await admin.check(`${form} [name="confirmed"]`);
    };
    await fill({ bank: "Ziraat Bankası", name: "Ana TL Hesabı", iban: spaced(BAD_IBAN), amount: "100.000" });
    await admin.click(`${wiz} [data-wiz="save-more"]`);
    await admin.waitForFunction(sel => document.querySelector(sel)?.textContent.includes("IBAN"), `${form} .hof-form-error`, { timeout: 8000 });
    ok(has(await textOf(admin, `${form} .hof-form-error`), "IBAN geçersiz"), `geçersiz IBAN ekranda: “${await textOf(admin, `${form} .hof-form-error`)}”`);
    ok(await admin.$eval(`${form} [name="iban"]`, node => node.classList.contains("is-invalid") && node.getAttribute("aria-invalid") === "true"), "IBAN alanı işaretli");
    ok((await must("hesaplar", api.get("/api/workspace/bank/accounts?status=all"))).accounts.length === 0, "geçersiz IBAN'la hesap açılmadı");
    await shot(admin, "gecersiz-iban");
    await admin.fill(`${form} [name="iban"]`, spaced(ZIRAAT_IBAN));
    await admin.click(`${wiz} [data-wiz="save-more"]`);
    await admin.waitForSelector(`${wiz} [data-wiz-saved] li`, { timeout: 8000 });
    const savedText = await textOf(admin, `${wiz} [data-wiz-saved]`);
    ok(has(savedText, "Ziraat Bankası · Ana TL Hesabı") && has(savedText, "102.01") && has(savedText, "100.000,00") && has(savedText, "Bakiye Doğrulandı"), `Ziraat kaydedildi: ${savedText}`);
    ok((await admin.$eval(`${form} [name="bankName"]`, node => node.value)) === "", "form yeni hesap için boşaldı");
    await fill({ bank: "Garanti BBVA", name: "Ana TL Hesabı", iban: GARANTI_IBAN, amount: "50.000" });
    await shot(admin, "sihirbaz-ikinci-hesap");
    await admin.click(`${wiz} [data-wiz="save-next"]`);
    await admin.waitForSelector(`${wiz} [data-wiz-done]`, { timeout: 8000 });
    const done = await textOf(admin, `${wiz} [data-wiz-done]`);
    ok(has(done, "Kurulum Tamamlandı") && has(done, "102.02") && has(done, "50.000,00"), "Kurulum Tamamlandı; Garanti 102.02");
    ok(has(await textOf(admin, `${wiz} [data-wiz-real]`), "150.000,00"), "sihirbazın sonunda Gerçek Banka 150.000,00");
    await auditLabels(admin, "Kurulum Sihirbazı (bitti)");
    await shot(admin, "sihirbaz-tamamlandi");
    await admin.click(`${wiz} [data-wiz="finish"]`);
    await admin.waitForTimeout(900);
    const list = (await must("hesaplar", api.get("/api/workspace/bank/accounts?status=all"))).accounts;
    const ziraat = list.find(account => account.bankName === "Ziraat Bankası");
    const garanti = list.find(account => account.bankName === "Garanti BBVA");
    ok(ziraat?.glSub === "102.01" && ziraat.balanceMinor === 10_000_000 && ziraat.balanceConfirmed && ziraat.policy === "warn" && ziraat.iban === ZIRAAT_IBAN, "kabul 1–2: 102.01 = 100.000, Bakiye Doğrulandı, denetim Uyar");
    ok(garanti?.glSub === "102.02" && garanti.balanceMinor === 5_000_000 && garanti.balanceConfirmed && garanti.policy === "warn", "kabul 3–4: 102.02 = 50.000, Bakiye Doğrulandı, denetim Uyar");
    const ledger = await must("mizan", api.get("/api/workspace/ledger"));
    const bal = code => ledger.trial.accounts.find(row => row.code === code)?.balance;
    ok(bal("102") === 150000 && bal("500") === -150000, `mizan: 102 = ${bal("102")}, 500 = ${bal("500")}`);
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    ok(integrity.ok === true, "mutabakat ok");
  });

  await step("3. Genel Bakış (Gerçek Banka 150.000), Hesaplar, Alt Hesap Mizanı, Hesap Detayı", async () => {
    await tab(admin, "overview");
    ok(has(await textOf(admin, `${bankWin} [data-bank-real]`), "150.000,00"), "Genel Bakış: Gerçek Banka 150.000,00");
    ok(!(await admin.$(`${bankWin} [data-bank-setup]`)), "Kurulumu Tamamla satırı kalktı");
    const rows = await admin.$$eval(`${bankWin} .hof-bank-table tbody tr[data-account]`, list => list.map(node => node.textContent.replace(/\s+/g, " ").trim()));
    ok(rows.length === 2 && rows.some(row => has(row, "Ziraat Bankası") && has(row, "100.000,00")) && rows.some(row => has(row, "Garanti BBVA") && has(row, "50.000,00")), "Banka Hesapları tablosu: iki hesap ve bakiyeleri");
    ok(has(await textOf(admin, `${bankWin} .hof-bank-table tfoot`), "150.000,00"), "Toplam TL 150.000,00");
    ok(!(await admin.$(`${bankWin} [data-bank-debt]`)), "kart/kredi hesabı yokken Kart ve Kredi Borcu kutusu yok");
    await auditLabels(admin, "Genel Bakış");
    await shot(admin, "genel-bakis-150000");
    await tab(admin, "accounts");
    const accountRows = await admin.$$eval(`${bankWin} .hof-bank-accounts tbody tr[data-account]`, list => list.map(node => node.textContent.replace(/\s+/g, " ").trim()));
    ok(accountRows.length === 2 && has(accountRows[0], "ZIR-TL") && has(accountRows[0], "102.01") && has(accountRows[1], "GAR-TL") && has(accountRows[1], "102.02"), `Hesaplar: ${accountRows.map(row => row.slice(0, 40)).join(" | ")}`);
    ok(accountRows.every(row => has(row, "Bakiye Doğrulandı")), "iki hesap da Bakiye Doğrulandı");
    ok(has(accountRows[0], spaced(ZIRAAT_IBAN)), "IBAN dörtlü gruplarla");
    await auditLabels(admin, "Hesaplar");
    await shot(admin, "hesaplar");
    await admin.click(`${bankWin} [data-act="subtrial"]`);
    await admin.waitForSelector(`${top} .hof-bank-subtrial tbody tr`, { timeout: 8000 });
    const sub = await textOf(admin, `${top} [data-subtrial]`);
    ok(has(sub, "102.01") && has(sub, "Ziraat Bankası · Ana TL Hesabı") && has(sub, "100.000,00") && has(sub, "102.02") && has(sub, "50.000,00"), "Alt Hesap Mizanı: 102.01 = 100.000, 102.02 = 50.000");
    ok(has(sub, "= Alt Hesaplar") && has(sub, "✓") && !has(sub, "✗"), "ana hesap = alt hesaplar toplamı (✓)");
    await auditLabels(admin, "Alt Hesap Mizanı");
    await shot(admin, "alt-hesap-mizani");
    await closeTop(admin);
    await admin.click(`${bankWin} .hof-bank-accounts tbody tr[data-account]:first-child`);
    await admin.waitForSelector(`${bankWin} [data-bank-balance]`, { timeout: 8000 });
    ok(has(await textOf(admin, `${bankWin} [data-bank-balance]`), "100.000,00"), "Hesap Detayı: Gerçek Bakiye 100.000,00");
    const recent = await textOf(admin, `${bankWin} .hof-bank-recent tbody`);
    ok(has(recent, "+₺100.000,00") && has(recent, "Açılış Bakiyesi") && /BNK-2026-\d{6}/.test(recent) && has(recent, "01.10.2026"), `son hareketler: ${recent.slice(0, 120)}`);
    const facts = await textOf(admin, `${bankWin} .hof-chq-facts`);
    ok(has(facts, "Uyar") && has(facts, spaced(ZIRAAT_IBAN)), "Eksi Bakiye Denetimi Uyar; IBAN");
    ok(has(await textOf(admin, `${bankWin} .hof-bank-confirm`), "Bakiye Doğrulandı"), "Bakiye Doğrulandı yazısı");
    ok(await admin.$eval(`${bankWin} [data-act="opening"]`, node => !node.disabled && node.textContent.trim() === "Açılışı Düzelt"), "Açılışı Düzelt etkin");
    await auditLabels(admin, "Hesap Detayı");
    await shot(admin, "hesap-detayi");
    // Nasıl bozarım: açılış kilitli dönemde → düğme pasif, nedeni yanında.
    await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: "2026-10-02" }));
    await admin.click(`${bankWin} [data-act="back"]`);
    await admin.waitForTimeout(500);
    await admin.click(`${bankWin} .hof-bank-accounts tbody tr[data-account]:first-child`);
    await admin.waitForSelector(`${bankWin} [data-bank-blocks]`, { timeout: 8000 });
    ok(await admin.$eval(`${bankWin} [data-act="opening"]`, node => node.disabled), "kilitli açılışta Açılışı Düzelt pasif");
    const blocks = await textOf(admin, `${bankWin} [data-bank-blocks]`);
    ok(has(blocks, "Açılışı Düzelt kapalı") && has(blocks, "kilitli dönemde") && has(blocks, "Sil kapalı"), `neden ekranda: ${blocks}`);
    await shot(admin, "kilitli-acilis-nedeni");
    await must("kilit kaldır", api.put("/api/admin/period-lock", { lockedUntil: "" }));
    // Açılışı Düzelt ekrandan: ileri tarih ekranda hata (alan işaretli); 100.500'e düzelt → ters kayıt + yeni açılış son hareketlerde; geri 100.000.
    await admin.click(`${bankWin} [data-act="back"]`);
    await admin.waitForTimeout(500);
    await admin.click(`${bankWin} .hof-bank-accounts tbody tr[data-account]:first-child`);
    await admin.waitForSelector(`${bankWin} [data-act="opening"]:not([disabled])`, { timeout: 8000 });
    const correct = async (date, amount) => {
      await admin.click(`${bankWin} [data-act="opening"]`);
      await admin.waitForSelector(`${top} form [name="openingAmount"]`);
      await admin.fill(`${top} form [name="openingDate"]`, date);
      await admin.fill(`${top} form [name="openingAmount"]`, amount);
      await admin.click(`${top} form button[type="submit"]`);
      await admin.waitForTimeout(900);
    };
    await correct("2026-10-09", "100.500");
    const futureError = await textOf(admin, `${top} form .hof-form-error`);
    ok(has(futureError, "İleri tarihli") && (await admin.$eval(`${top} form [name="openingDate"]`, node => node.classList.contains("is-invalid"))), `ileri tarihli açılış ekranda hata, alan işaretli: “${futureError.slice(0, 60)}”`);
    await shot(admin, "acilis-ileri-tarih");
    await closeTop(admin);
    await correct("2026-10-01", "100.500");
    ok(has(await textOf(admin, `${bankWin} [data-bank-balance]`), "100.500,00"), "Açılışı Düzelt: Gerçek Bakiye 100.500,00");
    const corrected = await admin.$$eval(`${bankWin} .hof-bank-recent tbody tr`, list => list.map(node => node.textContent.replace(/\s+/g, " ").trim()));
    ok(corrected.length === 3 && corrected.some(row => row.includes("−₺100.000,00")) && corrected.some(row => row.includes("+₺100.500,00")), `ters kayıt ve yeni açılış son hareketlerde (${corrected.length} satır)`);
    await shot(admin, "acilisi-duzelt");
    await correct("2026-10-01", "100.000");
    ok(has(await textOf(admin, `${bankWin} [data-bank-balance]`), "100.000,00") && (await must("özet", api.get("/api/workspace/bank/summary"))).realBank.minor === 15_000_000, "geri düzeltildi: Ziraat 100.000, Gerçek Banka 150.000");
    // Düzenle: açılışı olan hesapta tür ve para birimi salt okunur; başka hesabın kodu → ekranda hata, Hesap Kodu işaretli; şube kaydedilir.
    await admin.click(`${bankWin} [data-act="edit"]`);
    await admin.waitForSelector(`${top} form [name="branchName"]`);
    ok(await admin.$eval(`${top} form [name="kind"]`, node => node.hasAttribute("readonly")), "açılışı olan hesapta Hesap Türü salt okunur");
    await auditLabels(admin, "Banka Hesabını Düzenle");
    await admin.fill(`${top} form [name="code"]`, "gar-tl");
    await admin.click(`${top} form button[type="submit"]`);
    await admin.waitForTimeout(800);
    const codeError = await textOf(admin, `${top} form .hof-form-error`);
    ok(has(codeError, "başka bir hesapta kullanılıyor") && (await admin.$eval(`${top} form [name="code"]`, node => node.classList.contains("is-invalid"))), `başka hesabın kodu (harf büyüklüğü farkıyla) ekranda hata: “${codeError}”`);
    await admin.fill(`${top} form [name="code"]`, "ZIR-TL");
    await admin.fill(`${top} form [name="branchName"]`, "Kızılay Şubesi");
    await admin.click(`${top} form button[type="submit"]`);
    await admin.waitForTimeout(900);
    ok(has(await textOf(admin, `${bankWin} .hof-chq-facts`), "Kızılay Şubesi") && has(await textOf(admin, `${bankWin} .hof-bank-confirm`), "Bakiye Doğrulandı"), "Düzenle: şube kaydedildi, Bakiye Doğrulandı korundu");
    const edited = (await must("hesaplar", api.get("/api/workspace/bank/accounts?status=all"))).accounts.find(account => account.bankName === "Ziraat Bankası");
    ok(edited.branchName === "Kızılay Şubesi" && edited.code === "ZIR-TL" && edited.balanceMinor === 10_000_000, "sunucuda şube Kızılay Şubesi, kod ve bakiye aynı");
    await shot(admin, "hesap-duzenle");
  });

  await step("4. Nasıl bozarım: HTML adlı hesap kaçışlı; sil → aynı adla yeniden aç (yeni alt hesap kodu)", async () => {
    await admin.click(`${bankWin} [data-act="back"]`);
    await admin.waitForTimeout(500);
    const evil = '<img src=x onerror="window.__bankXss=1">Kötü';
    const openNew = async () => {
      await admin.click(`${bankWin} [data-act="new"]`);
      await admin.waitForSelector(`${top} form.hof-bank-form`);
      await admin.fill(`${top} [name="bankName"]`, "Halkbank");
      await admin.fill(`${top} [name="name"]`, evil);
      await admin.fill(`${top} [name="openingAmount"]`, "");
      await auditLabels(admin, "Yeni Banka Hesabı");
      await admin.click(`${top} button[type="submit"]`);
      await admin.waitForSelector(`${bankWin} [data-bank-balance]`, { timeout: 8000 });
    };
    await openNew();
    const title = await textOf(admin, `${bankWin} .hof-plan-title h3`);
    ok(has(title, "<img") && !(await admin.$(`${bankWin} img`)) && !(await admin.evaluate(() => window.__bankXss)), "HTML ad metin olarak görünür, çalışmaz");
    const first = await must("hesaplar", api.get("/api/workspace/bank/accounts?status=all"));
    const halk = first.accounts.find(account => account.bankName === "Halkbank");
    ok(halk?.glSub === "102.03" && halk.code === "HAL-TL", `yeni hesap 102.03 / HAL-TL (${halk?.glSub} / ${halk?.code})`);
    await shot(admin, "html-adli-hesap");
    await admin.click(`${bankWin} [data-act="delete"]`);
    await answerYes(admin);
    await admin.waitForTimeout(700);
    ok(!(await must("hesaplar", api.get("/api/workspace/bank/accounts?status=all"))).accounts.some(account => account.bankName === "Halkbank"), "hesap silindi");
    await openNew();
    const again = (await must("hesaplar", api.get("/api/workspace/bank/accounts?status=all"))).accounts.find(account => account.bankName === "Halkbank");
    ok(again?.glSub === "102.04" && again.code === "HAL-TL", `aynı adla yeniden açıldı; alt hesap kodu yeniden verilmedi (${again?.glSub}, ${again?.code})`);
    await admin.click(`${bankWin} [data-act="delete"]`);
    await answerYes(admin);
    await admin.waitForTimeout(700);
    ok(has(await textOf(admin, `${bankWin} [data-bank]`), "ZIR-TL"), "silindikten sonra Hesaplar listesine dönüldü");
  });

  await step("5. Ayarlar: Temel ve Gelişmiş, POS/Ekstre görünmez, kaydet, geçersiz değer, Tümünü Varsayılanlara Dön", async () => {
    await tab(admin, "settings");
    await admin.waitForSelector(`${bankWin} [data-settings]`);
    const legends = await admin.$$eval(`${bankWin} .hof-bank-set:not([hidden]) legend`, list => list.filter(node => node.offsetParent).map(node => node.textContent.trim()));
    ok(["Hesap", "Eksi Bakiye", "Mükerrer", "Masraf", "Döviz", "Tatil"].every(name => legends.includes(name)) && !legends.includes("POS") && !legends.includes("Ekstre"), `Temel bölümler: ${legends.join(", ")}`);
    ok(await admin.$eval(`${bankWin} [data-advanced]`, node => node.hidden), "Gelişmiş ayarlar kapalı gelir");
    ok(!(await admin.$(`${bankWin} [data-set="account.defaultPosId"]`)) && !(await admin.$(`${bankWin} [data-set="holidayAdvanced.shift"]`)), "Varsayılan POS ve Tatile Düşen Valör görünmez");
    ok((await admin.$eval(`${bankWin} [data-set="negative.policy"]`, node => node.value)) === "warn" && (await admin.$eval(`${bankWin} [data-set="similar.enabled"]`, node => node.value)) === "true", "standartlar seçili: Uyar, Benzer İşlem Açık");
    await auditLabels(admin, "Ayarlar (Temel)");
    await shot(admin, "ayarlar-temel");
    await admin.click(`${bankWin} [data-act="advanced"]`);
    await admin.waitForTimeout(300);
    const advanced = await textOf(admin, `${bankWin} [data-advanced]`);
    ok(has(advanced, "Hesap Eşlemeleri") && has(advanced, "770 · Genel Giderler ve Alış Faturaları") && has(advanced, "102 · Bankalar (Havale / EFT)") && !has(advanced, "Ekstre"), "Gelişmiş: hesap eşlemeleri adlarıyla; Ekstre bölümü yok");
    await auditLabels(admin, "Ayarlar (Gelişmiş)");
    await shot(admin, "ayarlar-gelismis");
    await admin.selectOption(`${bankWin} [data-set="negative.policy"]`, "block");
    await admin.selectOption(`${bankWin} [data-set="similar.enabled"]`, "false");
    ok(Boolean(await admin.$(`${bankWin} .hof-bank-dirty`)), "kaydedilmemiş değişiklik yazısı");
    // Nasıl bozarım: düzenlerken başka yerden banka değişikliği gelir (canlı yenileme) → form ezilmez.
    const someone = (await must("hesaplar", api.get("/api/workspace/bank/accounts?status=all"))).accounts.find(account => account.bankName === "Garanti BBVA");
    await must("pasif", api.post(`/api/workspace/bank/accounts/${someone.id}/status`, { status: "passive" }));
    await must("etkin", api.post(`/api/workspace/bank/accounts/${someone.id}/status`, { status: "active" }));
    await admin.waitForTimeout(2500);
    ok((await admin.$eval(`${bankWin} [data-set="negative.policy"]`, node => node.value)) === "block" && Boolean(await admin.$(`${bankWin} .hof-bank-dirty`)), "canlı yenileme kaydedilmemiş ayarı ezmedi");
    await admin.click(`${bankWin} [data-act="save-settings"]`);
    await admin.waitForTimeout(800);
    let values = (await must("ayarlar", api.get("/api/workspace/bank/settings"))).values;
    ok(values.negative.policy === "block" && values.similar.enabled === false, "Kaydet: Engelle ve Benzer İşlem Kapalı sunucuda");
    await admin.fill(`${bankWin} [data-set="fxAdvanced.exchangeTaxPermille"]`, "200");
    await admin.click(`${bankWin} [data-act="save-settings"]`);
    await admin.waitForTimeout(700);
    const error = await textOf(admin, `${bankWin} [data-settings] .hof-form-error`);
    ok(has(error, "Kambiyo Vergisi Oranı"), `geçersiz değer ekranda: “${error}”`);
    ok(await admin.$eval(`${bankWin} [data-set="fxAdvanced.exchangeTaxPermille"]`, node => node.classList.contains("is-invalid")), "hatalı alan işaretli");
    ok((await must("ayarlar", api.get("/api/workspace/bank/settings"))).values.fxAdvanced.exchangeTaxPermille === null, "geçersiz değer kaydedilmedi");
    await shot(admin, "ayarlar-gecersiz-deger");
    await admin.click(`${bankWin} [data-act="reset-all"]`);
    await answerYes(admin);
    await admin.waitForTimeout(700);
    values = (await must("ayarlar", api.get("/api/workspace/bank/settings"))).values;
    ok(values.negative.policy === "warn" && values.similar.enabled === true && values.fxAdvanced.exchangeTaxPermille === null, "Tümünü Varsayılanlara Dön: Uyar, Benzer İşlem Açık");
    ok((await admin.$eval(`${bankWin} [data-set="negative.policy"]`, node => node.value)) === "warn", "ekran da varsayılana döndü");
    await shot(admin, "ayarlar-varsayilan");
  });

  await step("6. Ortak hesap seçici: iki hesapta seçim zorunlu, tek hesapta gizli, kart hesabı yokken boş", async () => {
    const result = await admin.evaluate(async () => {
      const data = await HOF.bank.choices(true);
      const many = HOF.bank.pickerHtml(data);
      const card = HOF.bank.pickerHtml(data, { form: "card" });
      return { many: many.mode, manyOptions: (many.html.match(/<option/g) || []).length, required: /required/.test(many.html), defaultId: many.accountId, card: card.mode, ids: data.forms.bank.ids };
    });
    ok(result.many === "many" && result.manyOptions === 3 && result.required, `iki hesap: seçim zorunlu (${result.manyOptions - 1} hesap + boş seçenek)`);
    ok(result.card === "none", "kurumsal kart yokken seçici yok (bugünkü görünüm)");
    const garanti = (await must("hesaplar", api.get("/api/workspace/bank/accounts?status=all"))).accounts.find(account => account.bankName === "Garanti BBVA");
    await must("pasife al", api.post(`/api/workspace/bank/accounts/${garanti.id}/status`, { status: "passive" }));
    const single = await admin.evaluate(async () => {
      const picked = HOF.bank.pickerHtml(await HOF.bank.choices(true));
      return { mode: picked.mode, html: picked.html };
    });
    ok(single.mode === "single" && single.html.includes('type="hidden"') && single.html.includes("Ziraat Bankası · Ana TL Hesabı hesabına yazılır"), "tek hesap: seçici gizli, bilgi satırı");
    await must("etkinleştir", api.post(`/api/workspace/bank/accounts/${garanti.id}/status`, { status: "active" }));
  });

  await step("7. Yetki: personel Banka'yı görmez; uzman görür ama hesap açamaz, ayarları değiştiremez", async () => {
    const personel = await newPage();
    current = personel;
    await login(personel, "personel1", USER_PASS);
    ok(!(await personel.isVisible('#hof-sidecard [data-action="bank"]')), "personelin menüsünde Banka yok");
    await personel.evaluate(() => HOF.bank.open());
    await personel.waitForTimeout(500);
    ok(!(await personel.$(bankWin)), "personel pencereyi açamaz");
    const status = await personel.evaluate(async () => (await fetch("/api/workspace/bank/summary")).status);
    ok(status === 403, `personelin özet isteği ${status}`);
    await shot(personel, "personel-menu");
    await personel.context().close();
    const uzman = await newPage();
    current = uzman;
    await login(uzman, "uzman1", USER_PASS);
    ok(await uzman.isVisible('#hof-sidecard [data-action="bank"]'), "uzman Banka'yı görür");
    await openBank(uzman);
    await uzman.waitForTimeout(600);
    ok(!(await uzman.$(wiz)), "uzmana sihirbaz açılmaz (hesap tanımlama yetkisi yok)");
    await tab(uzman, "accounts");
    ok(!(await uzman.$(`${bankWin} [data-act="new"]`)), "uzmanda + Yeni Hesap yok");
    await tab(uzman, "settings");
    await uzman.waitForSelector(`${bankWin} [data-settings]`);
    ok(!(await uzman.$(`${bankWin} [data-act="save-settings"]`)) && (await uzman.$eval(`${bankWin} [data-set="negative.policy"]`, node => node.disabled)), "uzmanda ayarlar salt okunur (Kaydet yok)");
    await shot(uzman, "uzman-ayarlar-salt-okunur");
    await uzman.context().close();
    current = admin;
  });

  await step("8. Canlı yenileme: muhasebe Hesaplar'ı açıkken yönetici başka yerden hesap açar", async () => {
    const muhasebe = await newPage();
    current = muhasebe;
    await login(muhasebe, "muhasebe1", USER_PASS);
    await openBank(muhasebe);
    await muhasebe.waitForTimeout(600);
    ok(!(await muhasebe.$(wiz)), "kurulum yapılmış şirkette muhasebeye sihirbaz açılmaz");
    await tab(muhasebe, "accounts");
    const before = await muhasebe.$$eval(`${bankWin} .hof-bank-accounts tbody tr[data-account]`, list => list.length);
    const created = await must("hesap aç", api.post("/api/workspace/bank/accounts", { bankName: "VakıfBank", name: "Ek Hesap", kind: "demand", opening: { date: "2026-10-05", amount: "1.000", confirmed: true } }));
    await muhasebe.waitForFunction(count => document.querySelectorAll(".hof-bank-accounts tbody tr[data-account]").length === count + 1, before, { timeout: 15000 }).catch(() => null);
    const after = await muhasebe.$$eval(`${bankWin} .hof-bank-accounts tbody tr[data-account]`, list => list.map(node => node.textContent));
    ok(after.length === before + 1 && after.some(text => text.includes("VakıfBank")), `muhasebenin listesi kendiliğinden yenilendi (${before} → ${after.length})`);
    await shot(muhasebe, "canli-yenileme");
    await must("sil", api.del(`/api/workspace/bank/accounts/${created.id}`));
    await muhasebe.context().close();
    current = admin;
  });

  await step("9. Boş ikinci şirket: sihirbaz o şirkette ilk girişte gelir; Genel Bakış boş durum", async () => {
    const created = await must("şirket", api.post("/api/companies", { name: "İkinci Şirket" }));
    const second = created.company.id;
    await closeTop(admin);
    await admin.evaluate(async id => fetch("/api/companies/select", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }), second);
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForSelector("#hof-sidecard", { timeout: 30000 });
    await admin.waitForTimeout(700);
    await admin.click('#hof-sidecard [data-action="bank"]');
    await admin.waitForSelector(`${wiz} [data-wiz-form]`, { timeout: 15000 });
    ok(true, "ikinci şirkette Banka ilk açılışında sihirbaz geldi");
    await closeTop(admin);
    await admin.waitForTimeout(900);
    const overview = await textOf(admin, `${bankWin} [data-bank]`);
    ok((await textOf(admin, `${bankWin} [data-bank-real]`)) === "—" && has(overview, "Henüz Banka Hesabı Yok"), "ikinci şirkette Gerçek Banka “—”, boş durum");
    await tab(admin, "accounts");
    ok(has(await textOf(admin, `${bankWin} .hof-bank-accounts tbody`), "Banka hesabı yok"), "Hesaplar boş durum metni");
    await admin.click(`${bankWin} [data-act="subtrial"]`);
    await admin.waitForSelector(`${top} .hof-bank-subtrial`, { timeout: 8000 });
    ok(has(await textOf(admin, `${top} [data-subtrial]`), "Banka alt hesabında hareket yok"), "boş şirkette Alt Hesap Mizanı açılır, boş");
    await closeTop(admin);
    await shot(admin, "ikinci-sirket-bos");
    secondCompany = second;
  });

  await step("9b. Eski hareketleri aktar (ikinci şirkette): sihirbaz 3 adım, önizleme, Aktar, Kurulum Geçmişi'nden Geri Al, Bu Hesaba Ata, Bankaya Geçmiş Say", async () => {
    const q = `hofCompany=${encodeURIComponent(secondCompany)}`;
    const party = await must("cari", api.post(`/api/workspace/accounts?${q}`, { name: "ABC Ltd.", type: "customer", registeredOn: "2026-09-01" }));
    await must("20.09 havale", api.post(`/api/workspace/accounts/${party.id}/entries?${q}`, { kind: "in", amount: "5.000", method: "bank", date: "2026-09-20" }));
    await must("22.09 POS", api.post(`/api/workspace/accounts/${party.id}/entries?${q}`, { kind: "in", amount: "3.000", method: "card", date: "2026-09-22" }));
    await must("03.10 havale", api.post(`/api/workspace/accounts/${party.id}/entries?${q}`, { kind: "in", amount: "2.000", method: "bank", date: "2026-10-03" }));
    await tab(admin, "overview");
    await admin.waitForSelector(`${bankWin} [data-bank-unassigned]`, { timeout: 8000 });
    const row = await textOf(admin, `${bankWin} [data-bank-unassigned]`);
    ok(has(row, "10.000,00") && has(row, "7.000,00") && has(row, "3.000,00") && has(row, "hiçbir toplama girmez"), `Hesabı Atanmamış Eski Hareketler ayrı satırda: ${row.slice(0, 140)}`);
    ok((await textOf(admin, `${bankWin} [data-bank-real]`)) === "—", "Gerçek Banka'ya girmez (hesap yok: “—”)");
    await shot(admin, "eski-hareketler-satiri");
    // Fatura Ayarları'ndaki eski banka listesi sihirbazda öneri olur (E2.16).
    await must("fatura ayarları", api.put(`/api/workspace/invoices/settings?${q}`, { seller: { banks: [{ name: "Ziraat Bankası", iban: ZIRAAT_IBAN }] } }));
    await tab(admin, "accounts");
    await tab(admin, "overview");
    await admin.click(`${bankWin} [data-bank-setup] [data-act="wizard"]`);
    await admin.waitForSelector(`${wiz} [data-wiz-form]`);
    const steps = await admin.$$eval(`${wiz} .hof-bank-steps li`, list => list.map(node => node.textContent.replace(/\s+/g, " ").trim()));
    ok(steps.length === 3 && has(steps[1], "Eski Hareketleri Aktar"), `eski hareket varken 3 adım: ${steps.join(" › ")}`);
    const form = `${wiz} [data-wiz-form]`;
    await admin.click(`${wiz} [data-wiz-suggest] [data-wiz="suggest"]`);
    ok((await admin.$eval(`${form} [name="bankName"]`, node => node.value)) === "Ziraat Bankası" && (await admin.$eval(`${form} [name="iban"]`, node => node.value.replace(/\s+/g, ""))) === ZIRAAT_IBAN, "Fatura Ayarları'ndaki banka önerisi forma doldu");
    await admin.fill(`${form} [name="name"]`, "Ana TL Hesabı");
    await admin.fill(`${form} [name="openingDate"]`, "2026-10-01");
    await admin.fill(`${form} [name="openingAmount"]`, "100.000");
    await admin.check(`${form} [name="confirmed"]`);
    await admin.click(`${wiz} [data-wiz="save-next"]`);
    await admin.waitForSelector(`${wiz} [data-wiz-preview]`, { timeout: 10000 });
    const preview = await textOf(admin, `${wiz} [data-wiz-preview]`);
    ok(has(preview, "Havale / EFT ₺5.000,00") && has(preview, "POS / Kart ₺3.000,00") && has(preview, "1 hareket") && has(preview, "+₺2.000,00") && has(preview, "₺102.000,00"), `önizleme: ${preview}`);
    await auditLabels(admin, "Kurulum Sihirbazı (eski hareketler)");
    await shot(admin, "sihirbaz-eski-hareketler-onizleme");
    await admin.click(`${wiz} [data-wiz="transfer"]`);
    await admin.waitForSelector(`${wiz} [data-wiz-done]`, { timeout: 10000 });
    const done = await textOf(admin, `${wiz} [data-wiz-done]`);
    ok(has(done, "1 hareket hesaba bağlandı") && /Devir Kapanışı BNK-2026-\d{6}/.test(done) && has(done, "102.000,00"), `aktarıldı: ${done.slice(0, 200)}`);
    await shot(admin, "sihirbaz-eski-hareketler-aktarildi");
    await admin.click(`${wiz} [data-wiz="finish"]`);
    await admin.waitForTimeout(900);
    ok(has(await textOf(admin, `${bankWin} [data-bank-real]`), "102.000,00") && !(await admin.$(`${bankWin} [data-bank-unassigned]`)), "Gerçek Banka 102.000; hesabı atanmamış satır kalmadı");
    let integrity = await must("Mutabakat Testi", api.get(`/api/workspace/ledger/integrity?${q}`));
    ok(integrity.ok === true, "ikinci şirkette mutabakat ok (sihirbazdan sonra)");
    // Geri Al: Hesaplar → Eski Hareketler → Kurulum Geçmişi.
    await tab(admin, "accounts");
    await admin.click(`${bankWin} [data-act="legacy"]`);
    await admin.waitForSelector(`${bankWin} [data-act="undo"]`, { timeout: 8000 });
    await shot(admin, "kurulum-gecmisi");
    await admin.click(`${bankWin} [data-act="undo"]`);
    await answerYes(admin);
    await admin.waitForFunction(() => document.querySelectorAll(".hof-bank-legacy tbody input[data-pick]").length > 0, null, { timeout: 8000 });
    const legacyText = await textOf(admin, `${bankWin} .hof-bank-stats`);
    ok(has(legacyText, "7.000,00") && has(legacyText, "3.000,00"), `Geri Al: eski hâl (Havale 7.000, POS 3.000): ${legacyText}`);
    ok(has(await textOf(admin, `${bankWin} [data-bank]`), "Geri Alındı"), "Kurulum Geçmişi'nde Geri Alındı");
    // Bu Hesaba Ata: yalnız açılıştan sonraki havale satırı seçilebilir (20.09 açılıştan önce, POS satırı bağlanmaz).
    const pickable = await admin.$$eval(`${bankWin} .hof-bank-legacy tbody input[data-pick]`, list => list.length);
    ok(pickable === 1, `seçilebilen satır yalnız açılıştan sonraki havale (${pickable})`);
    await admin.check(`${bankWin} .hof-bank-legacy tbody input[data-pick]`);
    await admin.waitForTimeout(300);
    await admin.click(`${bankWin} [data-act="assign"]`);
    await answerYes(admin);
    await admin.waitForTimeout(900);
    let summary = await must("özet", api.get(`/api/workspace/bank/summary?${q}`));
    ok(summary.realBank.minor === 10_200_000 && summary.unassigned.bankMinor === 500_000, `Bu Hesaba Ata: Gerçek Banka ${summary.realBank.minor / 100}, Hesabı Atanmamış havale ${summary.unassigned.bankMinor / 100}`);
    // Bankaya Geçmiş Say: 108.00'daki 3.000 hesaba.
    await admin.click(`${bankWin} [data-act="reclass-bank"]`);
    await admin.waitForSelector(`${top} form [name="amount"]`);
    ok((await admin.$eval(`${top} form [name="amount"]`, node => node.value)) === "3.000,00", "Bankaya Geçmiş Say tutarı 108.00 bakiyesiyle önerili (3.000,00)");
    await auditLabels(admin, "Bankaya Geçmiş Say");
    await admin.click(`${top} form button[type="submit"]`);
    await admin.waitForTimeout(900);
    summary = await must("özet", api.get(`/api/workspace/bank/summary?${q}`));
    ok(summary.realBank.minor === 10_500_000 && summary.unassigned.cardMinor === 0, `Bankaya Geçmiş Say: Gerçek Banka ${summary.realBank.minor / 100}, POS 108.00 ${summary.unassigned.cardMinor / 100}`);
    await shot(admin, "eski-hareketler-sonra");
    integrity = await must("Mutabakat Testi", api.get(`/api/workspace/ledger/integrity?${q}`));
    ok(integrity.ok === true, "ikinci şirkette mutabakat ok (geri al, ata, aktar)");
    const firstCompany = (await must("şirketler", api.get("/api/companies"))).companies.find(company => company.code === "001");
    await closeTop(admin);
    await admin.evaluate(async id => fetch("/api/companies/select", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }), firstCompany.id);
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForSelector("#hof-sidecard", { timeout: 30000 });
    await admin.waitForTimeout(700);
  });

  await step("10. Mobil (390 px): Genel Bakış, Hesaplar ve Hesap Detayı yatay kaydırmasız", async () => {
    const phone = await newPage({ width: 390, height: 844 });
    current = phone;
    await login(phone, "admin", PASS);
    await phone.evaluate(() => HOF.bank.open());
    await phone.waitForSelector(`${bankWin} [data-bank-real]`, { timeout: 15000 });
    await phone.waitForTimeout(600);
    let check = await noHorizontalScroll(phone);
    ok(check.page && check.dialog, `Genel Bakış yatay kaydırmasız ${JSON.stringify(check.wide)}`);
    await shot(phone, "mobil-genel-bakis");
    await tab(phone, "accounts");
    check = await noHorizontalScroll(phone);
    ok(check.page && check.dialog, `Hesaplar yatay kaydırmasız ${JSON.stringify(check.wide)}`);
    await shot(phone, "mobil-hesaplar");
    await phone.click(`${bankWin} .hof-bank-accounts tbody tr[data-account]:first-child`);
    await phone.waitForSelector(`${bankWin} [data-bank-balance]`, { timeout: 8000 });
    check = await noHorizontalScroll(phone);
    ok(check.page && check.dialog, `Hesap Detayı yatay kaydırmasız ${JSON.stringify(check.wide)}`);
    await shot(phone, "mobil-hesap-detayi", { fullPage: true });
    await tab(phone, "settings");
    check = await noHorizontalScroll(phone);
    ok(check.page && check.dialog, `Ayarlar yatay kaydırmasız ${JSON.stringify(check.wide)}`);
    await phone.context().close();
    current = admin;
  });

  await step("11. Kalemle ad (side.bank) ve yazım düzeni", async () => {
    await must("ad", api.put("/api/workspace/labels/batch", { labels: { "side.bank": "Bankalar" } }));
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForSelector("#hof-sidecard", { timeout: 30000 });
    await admin.waitForTimeout(800);
    ok((await textOf(admin, '#hof-sidecard [data-action="bank"] .hof-side-text')) === "Bankalar", "menüde yeni ad");
    await openBank(admin);
    ok((await textOf(admin, `${bankWin} .hof-modal-title`)) === "Bankalar", "pencere başlığında yeni ad");
    await closeTop(admin);
    await must("ad geri", api.put("/api/workspace/labels/batch", { labels: { "side.bank": "" } }));
    const problems = [...labelProblems.entries()].map(([text, where]) => `${where}: “${text}”`);
    ok(problems.length === 0, problems.length ? `küçük harfle başlayan ad: ${problems.join(" ; ")}` : "gezilen bütün banka ekranlarında adlar başlık yazımıyla");
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    ok(integrity.ok === true, "son durumda mutabakat ok");
    ok(errors.length === 0, errors.length ? `tarayıcı hataları: ${errors.join(" | ")}` : "hiçbir ekranda tarayıcı hatası yok");
  });
} catch (error) {
  failed += 1;
  console.log(`✗ senaryo durdu: ${error.stack || error.message}`);
  if (current) await shot(current, "hata").catch(() => null);
} finally {
  await browser.close();
  await app.close();
  fs.rmSync(root, { recursive: true, force: true });
}
console.log(`\n${failed ? "BAŞARISIZ" : "TAMAM"}: ${passed} denetim geçti, ${failed} başarısız. Ekran görüntüleri: ${OUT}`);
process.exitCode = failed ? 1 : 0;
