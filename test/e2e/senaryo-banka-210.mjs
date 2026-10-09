// Senaryo Banka 2.1.0 — bölüm 1 (Aşama 3: Banka Hesapları, arayüz) ve bölüm 2 (Aşama 4: Banka Hareketleri, arayüz; docs/BANKA-MODULU-PLAN.md §8, §12.3, §12.5 kabul 1–4). Gerçek kullanıcı
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
//  9. Boş ikinci şirket: sihirbaz o şirkette yine ilk girişte gelir; Genel Bakış boş durum; Hareketler boş durum, + Masraf form açmaz
//     (neden bildirimde, hiçbir şey yazılmaz).
// 10. Mobil (390 px): Genel Bakış, Hesaplar ve Hesap Detayı yatay kaydırmasız.
// Bölüm 2 (Aşama 4: Banka Hareketleri, arayüz; §8.5, §8.6, §12.3 Aşama 4, §12.4). Bağımsız beklenen: testin kendi yevmiye modeli.
// 12. Hareketler sekmesi (Hesaplar'dan sonra); Ziraat'e masraf 10,50 BSMV Dahil EKRANDAN (önizleme 10,00 + 0,50), İşlem Kartı fiş satırları.
// 13. KDV Dahil 120 (faturalı masraf): cari ve Fatura No zorunlu (boşsa yazılmaz); fatura + havale; KDV Özeti 191 = 20; ödeme satırında
//     Ters Kaydet pasif + neden; masrafın İşlem Kartı (matrah, KDV); Fatura penceresinde Düzenle/İptal/Sil/İade nedenleri.
// 14. Faiz geliri 1.000 / %15: net 850, stopaj 150 (193), 642 = 1.000; stopaj önerisi ilk faizde boş.
// 15. Hareketler: satır tutarları ve yürüyen bakiye bağımsız beklenenle; Masraf süzgeci; boş süzgeç; İşlem No araması; tutar süzgeci
//     (eksi tutar ekranda hata, süzgeç alanları yerinde).
// 16. Ters Kaydet → bakiye eski hâl; kart Ters Kaydedildi; Ters Kaydet/Düzelt pasif + neden; ters kaydın kartı.
// 17. Benzer İşlem: ters kaydedilenle aynı masraf uyarısız; ikinci kez pencere (BNK-…); Vazgeç yazmaz; Yine de Kaydet tek fiş.
// 18. Düzelt: faiz 1.000 → 2.000 (oran korunur, tür değişmez); mizan.
// 19. Açıklamayı Düzelt (HTML kaçışlı); kilitli dönemdeki masrafın Ters Kaydet'i bugün tarihli, kilitli günler değişmez.
// 20. Planlı İşlem: + Planlı İşlem (KDV'li seçenek yok), deftere girmez, Vadesi Geldi, rozet; Gerçekleştir → fiş, plan bir ay ileri; Sil.
// 21. Daha Fazla Göster: 60 fiş → 50 + 11, tekrarsız, bakiye sayfa sınırında sürekli.
// 22. Yetki: bank.cancel ve Fatura Yönetimi kaldırılan muhasebe (Ters Kaydet pasif + yetki nedeni; KDV'li seçenek yok); bank.move yokken
//     + Masraf ve + Planlı İşlem yok.
// 23. Mobil (390 px): Hareketler, İşlem Kartı, Masraf formu; Hesap Detayı'nda hesabın hareketleri ve + Masraf (hesap seçili).
// 23b. Diğer Gelir (Gelişmiş Seçenekler'de gelir hesabı 646), Faiz Gideri + BSMV/KKDF, Kart Borcu Ödemesi, Kredi Kullanımı ve Geri Ödemesi
//     (faizli) EKRANDAN; önizleme; alt hesaplar (102.02, 309.k, 300.k) ve 646/780 modelle.
// 24. Son durum bağımsız modelle (alt hesaplar, kart, kredi, 770, 191, 193, 642, 646, 659, 780); mutabakat ok.
// 25. Yazım düzeni: gezilen her banka ekranında adlar başlık yazımıyla; kalemle ad (side.bank) menüde ve pencere başlığında.
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
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, maxCompanies: 3, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f40" } });
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
    ok(JSON.stringify(tabs) === JSON.stringify(["Genel Bakış", "Hesaplar", "Hareketler", "Ayarlar"]), `sekmeler: ${tabs.join(" · ")} (Hareketler Aşama 4'te; POS ve Ekstre bu sürümde yok)`);
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
    // GG2 (F10/F12): bu sürümde olmayan özelliklerin ayarları (POS, Ekstre, Döviz, Kanal Alanı, Elle Banka Fişi) görünmez.
    ok(["Hesap", "Eksi Bakiye", "Mükerrer", "Masraf", "Tatil"].every(name => legends.includes(name)) && !["POS", "Ekstre", "Döviz"].some(name => legends.includes(name)), `Temel bölümler: ${legends.join(", ")}`);
    ok(await admin.$eval(`${bankWin} [data-advanced]`, node => node.hidden), "Gelişmiş ayarlar kapalı gelir");
    ok(!(await admin.$(`${bankWin} [data-set="account.defaultPosId"]`)) && !(await admin.$(`${bankWin} [data-set="holidayAdvanced.shift"]`)), "Varsayılan POS ve Tatile Düşen Valör görünmez");
    ok((await admin.$eval(`${bankWin} [data-set="negative.policy"]`, node => node.value)) === "warn" && (await admin.$eval(`${bankWin} [data-set="similar.enabled"]`, node => node.value)) === "true", "standartlar seçili: Uyar, Benzer İşlem Açık");
    await auditLabels(admin, "Ayarlar (Temel)");
    await shot(admin, "ayarlar-temel");
    await admin.click(`${bankWin} [data-act="advanced"]`);
    await admin.waitForTimeout(300);
    const advanced = await textOf(admin, `${bankWin} [data-advanced]`);
    ok(has(advanced, "Hesap Eşlemeleri") && has(advanced, "770 · Genel Giderler ve Alış Faturaları") && has(advanced, "102 · Bankalar (Havale / EFT)") && !has(advanced, "Ekstre"), "Gelişmiş: hesap eşlemeleri adlarıyla; Ekstre bölümü yok");
    const hiddenKeys = ["fx.source", "fxAdvanced.exchangeTaxPermille", "movement.channel", "other.manualVoucher", "gl.fxGain", "gl.fxLoss"];
    const shownHidden = [];
    for (const key of hiddenKeys) if (await admin.$(`${bankWin} [data-set="${key}"]`)) shownHidden.push(key);
    const itemLabels = await admin.$$eval(`${bankWin} .hof-bank-set-item > label`, list => list.map(node => node.textContent.trim()));
    const hiddenNames = ["Kambiyo Kârı", "Kambiyo Zararı", "Kanal Alanı", "Elle Banka Fişi", "Kur Kaynağı"].filter(name => itemLabels.some(label => label.startsWith(name)));
    ok(shownHidden.length === 0 && hiddenNames.length === 0, `etkisiz/ertelenen ayarlar görünmez (Döviz, Kanal Alanı, Elle Banka Fişi, Kambiyo eşlemeleri)${shownHidden.length || hiddenNames.length ? `: ${[...shownHidden, ...hiddenNames].join(", ")}` : ""}`);
    const feeGl = await admin.$$eval(`${bankWin} [data-set="gl.fee"] option`, list => list.map(node => node.value));
    ok([...feeGl].sort().join(",") === "653,770", `Banka Masrafları eşlemesi yalnız 770 ya da 653 (${feeGl.join(", ")})`);
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
    await admin.fill(`${bankWin} [data-set="other.eventPrefix"]`, "b1");
    await admin.click(`${bankWin} [data-act="save-settings"]`);
    await admin.waitForTimeout(700);
    const error = await textOf(admin, `${bankWin} [data-settings] .hof-form-error`);
    ok(has(error, "İşlem No Öneki"), `geçersiz değer ekranda: “${error}”`);
    ok(await admin.$eval(`${bankWin} [data-set="other.eventPrefix"]`, node => node.classList.contains("is-invalid")), "hatalı alan işaretli");
    ok((await must("ayarlar", api.get("/api/workspace/bank/settings"))).values.other.eventPrefix === "BNK", "geçersiz değer kaydedilmedi");
    await shot(admin, "ayarlar-gecersiz-deger");
    await admin.click(`${bankWin} [data-act="reset-all"]`);
    await answerYes(admin);
    await admin.waitForTimeout(700);
    values = (await must("ayarlar", api.get("/api/workspace/bank/settings"))).values;
    ok(values.negative.policy === "warn" && values.similar.enabled === true && values.other.eventPrefix === "BNK", "Tümünü Varsayılanlara Dön: Uyar, Benzer İşlem Açık");
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
    // Aşama 4 (boş veri): hesapsız şirkette Hareketler boş durum metniyle; + Masraf form açmaz, nedenini söyler (yazım yok).
    await tab(admin, "movements");
    await admin.waitForSelector(`${bankWin} [data-moves-empty]`, { timeout: 8000 });
    ok(has(await textOf(admin, `${bankWin} [data-moves-empty]`), "Henüz banka hareketi yok"), "hesapsız şirkette Hareketler: “Henüz banka hareketi yok.”");
    await admin.click(`${bankWin} [data-act="v-fee"]`);
    await admin.waitForSelector(".hof-toast-error", { timeout: 8000 });
    const why = await textOf(admin, ".hof-toast-error .hof-toast-text");
    ok(has(why, "uygun, etkin bir TL banka hesabı yok") && !(await admin.$(".hof-bank-voucher")), `hesapsız şirkette + Masraf form açmaz, neden: ${why}`);
    const events = await must("olay sayısı", api.get(`/api/workspace/bank/movements?hofCompany=${encodeURIComponent(second)}`));
    ok(events.rows.length === 0, `hesapsız şirkette hiçbir hareket yazılmadı (${events.rows.length})`);
    await tab(admin, "overview");
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
    // Bankaya Geçmiş Say (GG2 F4): yalnız hesabın açılışından sonraki POS tahsilatı aktarılır. 22.09'daki 3.000 açılıştan (01.10) önce:
    // açılış bakiyesinin içinde, Devir Kapanışı'nın konusu — form açılmaz, nedeni söylenir.
    await admin.click(`${bankWin} [data-act="reclass-bank"]`);
    await admin.waitForTimeout(500);
    ok(!(await admin.$(`${top} form [name="amount"]`)) && has(await textOf(admin, "#hof-toasts .hof-toast:last-child"), "açılışından sonra bankaya geçmemiş POS tahsilatı yok"), `açılıştan önceki POS için form açılmaz: ${await textOf(admin, "#hof-toasts .hof-toast:last-child")}`);
    // Açılıştan sonra (05.10) 1.500 POS: form 1.500 ile dolar (108.00'ın bütün bakiyesi 4.500 değil).
    await must("05.10 POS", api.post(`/api/workspace/accounts/${party.id}/entries?${q}`, { kind: "in", amount: "1.500", method: "card", date: "2026-10-05" }));
    await tab(admin, "accounts");
    await admin.click(`${bankWin} [data-act="legacy"]`);
    await admin.waitForSelector(`${bankWin} [data-act="reclass-bank"]`, { timeout: 8000 });
    await admin.click(`${bankWin} [data-act="reclass-bank"]`);
    await admin.waitForSelector(`${top} form [name="amount"]`);
    ok((await admin.$eval(`${top} form [name="amount"]`, node => node.value)) === "1.500,00" && has(await textOf(admin, `${top} .hof-modal-text`), "en çok ₺1.500,00"), `Bankaya Geçmiş Say tutarı açılıştan sonraki POS ile önerili (1.500,00): ${await textOf(admin, `${top} .hof-modal-text`)}`);
    await auditLabels(admin, "Bankaya Geçmiş Say");
    await admin.click(`${top} form button[type="submit"]`);
    await admin.waitForTimeout(900);
    summary = await must("özet", api.get(`/api/workspace/bank/summary?${q}`));
    ok(summary.realBank.minor === 10_350_000 && summary.unassigned.cardMinor === 300_000, `Bankaya Geçmiş Say: Gerçek Banka ${summary.realBank.minor / 100} (102.000 + 1.500), POS 108.00 ${summary.unassigned.cardMinor / 100} (açılış öncesi 3.000 kalır)`);
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

  // ==================== Bölüm 2 (Aşama 4: Banka Hareketleri, arayüz; plan §8.5, §8.6, §12.3 Aşama 4, §12.4) ====================
  // Bağımsız beklenen: testin KENDİ yevmiye modeli (program çıktısı beklenen olarak kullanılmaz). Kuruş; borç artı.
  const model = new Map();
  const book = lines => {
    let net = 0;
    for (const [code, side, minor] of lines) {
      const signedMinor = side === "D" ? minor : -minor;
      net += signedMinor;
      model.set(code, (model.get(code) || 0) + signedMinor);
    }
    if (net !== 0) throw new Error(`model fişi dengesiz: ${JSON.stringify(lines)}`);
  };
  // Bölüm 1 sonunda 001: Ziraat 100.000 (102.01), Garanti 50.000 (102.02), karşılığı 500.
  book([["102.01", "D", 10_000_000], ["102.02", "D", 5_000_000], ["500", "C", 15_000_000]]);
  const ziraatMoves = [];
  const HOF_MONEY = minor => new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(minor / 100);
  const accountsNow = async () => (await must("hesaplar", api.get("/api/workspace/bank/accounts?status=all"))).accounts;
  let ZIRAAT = null;
  let GARANTI = null;
  const moveRows = (page, scope = bankWin) =>
    page.$$eval(`${scope} .hof-bank-moves tbody tr[data-event]`, list => list.map(node => ({ id: node.dataset.event, no: node.dataset.no, type: node.dataset.type, status: node.dataset.state, signed: Number(node.dataset.signed), balance: node.dataset.balance === "" ? null : Number(node.dataset.balance), text: node.textContent.replace(/\s+/g, " ").trim() })));
  const waitMoves = (page, test, arg = null, timeout = 10000) => page.waitForFunction(test, arg, { timeout });
  const fillVoucher = async (page, values) => {
    for (const [name, value] of Object.entries(values)) {
      const selector = `form.hof-bank-voucher [name="${name}"]`;
      const tag = await page.$eval(selector, node => node.tagName.toLowerCase());
      if (tag === "select") await page.selectOption(selector, String(value));
      else await page.fill(selector, String(value));
    }
    await page.waitForTimeout(250);
  };
  const submitVoucher = async page => {
    await page.click("form.hof-bank-voucher button[type=\"submit\"]");
  };
  const voucherClosed = page => page.waitForSelector("form.hof-bank-voucher", { state: "detached", timeout: 10000 });
  const balanceOf = async id => (await must("hesap", api.get(`/api/workspace/bank/accounts/${id}`))).balanceMinor;
  const trial = async () => Object.fromEntries((await must("mizan", api.get("/api/workspace/ledger"))).trial.accounts.map(row => [row.code, Math.round(row.balance * 100)]));
  const subTrial = async () => Object.fromEntries((await must("alt hesap mizanı", api.get("/api/workspace/bank/sub-trial"))).rows.map(row => [row.sub, Math.round(row.balance * 100)]));
  const eventCount = async () => (await must("hareketler", api.get(`/api/workspace/bank/movements?status=all&limit=200`))).rows.length;
  const openEventFromList = async (page, predicate) => {
    const rows = await moveRows(page);
    const row = rows.find(predicate);
    if (!row) throw new Error(`satır yok: ${rows.map(item => `${item.type} ${item.signed}`).join(" | ")}`);
    await page.click(`${bankWin} .hof-bank-moves tbody tr[data-event="${row.id}"]`);
    await page.waitForSelector(`${bankWin} [data-bank-event] [data-event-no]`, { timeout: 10000 });
    await page.waitForTimeout(300);
    return row;
  };
  const selectMovesAccount = async (page, id) => {
    await page.selectOption(`${bankWin} [data-mv="account"]`, id);
    await waitMoves(page, accountId => {
      const rows = [...document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]")];
      return rows.length > 0 && document.querySelector(".hof-bank-modal [data-moves]")?.dataset.account === accountId;
    }, id);
    await page.waitForTimeout(300);
  };

  await step("12. Hareketler sekmesi; Ziraat'e masraf 10,50 BSMV Dahil EKRANDAN (önizleme), İşlem Kartı", async () => {
    current = admin;
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForSelector("#hof-sidecard", { timeout: 30000 });
    await admin.waitForTimeout(700);
    const list = await accountsNow();
    ZIRAAT = list.find(account => account.bankName === "Ziraat Bankası");
    GARANTI = list.find(account => account.bankName === "Garanti BBVA");
    await openBank(admin);
    const tabs = await admin.$$eval(`${bankWin} .hof-bank-tabs [data-tab]`, items => items.map(node => node.textContent.trim()));
    ok(JSON.stringify(tabs) === JSON.stringify(["Genel Bakış", "Hesaplar", "Hareketler", "Ayarlar"]), `sekmeler: ${tabs.join(" · ")} (Hareketler Hesaplar'dan sonra)`);
    await tab(admin, "movements");
    await admin.waitForSelector(`${bankWin} [data-moves]`, { timeout: 10000 });
    await selectMovesAccount(admin, ZIRAAT.id);
    let rows = await moveRows(admin);
    // Bölüm 1'de açılış iki kez düzeltildi: 100.000 (ters kaydedildi), ters kayıt, 100.500 (ters kaydedildi), ters kayıt, 100.000.
    ok(rows.length === 5 && rows[0].balance === 10_000_000 && rows.filter(row => row.type === "opening").length === 3 && rows.filter(row => row.type === "reversal").length === 2, `Ziraat'in hareketleri (açılış ve düzeltmeleri) yürüyen bakiyeyle: ${rows.map(row => `${row.type} ${row.signed / 100} → ${row.balance / 100}`).join(" | ")}`);
    ziraatMoves.push(...rows.map(row => row.signed).reverse());
    await auditLabels(admin, "Hareketler");
    await shot(admin, "hareketler-ziraat");
    await admin.click(`${bankWin} [data-act="v-fee"]`);
    await admin.waitForSelector("form.hof-bank-voucher [name=\"amount\"]", { timeout: 8000 });
    ok((await admin.$eval("form.hof-bank-voucher [name=\"tax\"]", node => node.value)) === "bsmv_incl", "vergi varsayılanı Banka Ayarları'ndan: BSMV Dahil");
    await fillVoucher(admin, { accountId: ZIRAAT.id, feeType: "eft", amount: "10,50" });
    const preview = await textOf(admin, "form.hof-bank-voucher [data-voucher-preview]");
    ok(has(preview, "₺10,00") && has(preview, "BSMV ₺0,50") && has(preview, "₺10,50") && has(preview, "770"), `önizleme: ${preview}`);
    await auditLabels(admin, "Masraf Formu");
    await shot(admin, "masraf-formu-bsmv");
    await submitVoucher(admin);
    await voucherClosed(admin);
    await waitMoves(admin, () => document.querySelector(".hof-bank-modal .hof-bank-moves tbody tr[data-event]")?.dataset.type === "fee");
    rows = await moveRows(admin);
    book([["770", "D", 1_050], ["102.01", "C", 1_050]]);
    ziraatMoves.push(-1_050);
    ok(rows[0].type === "fee" && rows[0].signed === -1_050 && rows[0].balance === 9_998_950 && /BNK-2026-\d{6}/.test(rows[0].no), `ilk satır Banka Masrafı −10,50, bakiye 99.989,50 (${rows[0].text})`);
    ok((await balanceOf(ZIRAAT.id)) === 9_998_950, "sunucuda Ziraat 99.989,50");
    await openEventFromList(admin, row => row.type === "fee");
    const card = await textOf(admin, `${bankWin} [data-bank-event]`);
    const lines = await admin.$$eval(`${bankWin} .hof-bank-lines tbody tr[data-gl]`, list => list.map(node => `${node.dataset.gl}|${node.dataset.side}|${node.dataset.minor}`).sort());
    ok(JSON.stringify(lines) === JSON.stringify(["102|C|1050", "770|D|1000", "770|D|50"].sort()), `İşlem Kartı fiş satırları: ${lines.join(", ")} (770 10,00 + 770 0,50 BSMV / 102.01 10,50)`);
    ok(has(card, "Banka Masrafı") && has(card, "Ziraat Bankası · Ana TL Hesabı") && has(card, "EFT") && /BNK-2026-\d{6}/.test(card) && has(card, "→"), "İşlem Kartı: tür, hesap, masraf türü, İşlem No, Kaynak → Hedef");
    ok(await admin.$eval(`${bankWin} [data-act="ev-reverse"]`, node => !node.disabled), "Ters Kaydet etkin");
    await auditLabels(admin, "İşlem Kartı");
    await shot(admin, "islem-karti-masraf");
  });

  await step("13. KDV Dahil 120 (faturalı masraf): cari ve Fatura No zorunlu; fatura + havale tek işlemde; KDV 191 = 20; Fatura penceresinde nedenler", async () => {
    const supplier = await must("cari", api.post("/api/workspace/accounts", { name: "Ziraat Bankası A.Ş.", type: "supplier", registeredOn: "2026-09-01" }));
    await admin.click(`${bankWin} [data-act="ev-back"]`);
    await admin.waitForSelector(`${bankWin} [data-moves]`);
    const before = await eventCount();
    await admin.click(`${bankWin} [data-act="v-fee"]`);
    await admin.waitForSelector("form.hof-bank-voucher [name=\"amount\"]");
    await fillVoucher(admin, { accountId: ZIRAAT.id, feeType: "eft", tax: "vat_incl", amount: "120" });
    ok(await admin.isVisible("form.hof-bank-voucher [data-acc-query]") && await admin.isVisible("form.hof-bank-voucher [name=\"invoiceNo\"]"), "KDV kipinde Faturayı Kesen (Cari) ve Fatura No alanları açıldı");
    await submitVoucher(admin);
    await admin.waitForFunction(() => document.querySelector("form.hof-bank-voucher .hof-form-error")?.textContent.trim(), null, { timeout: 8000 });
    ok(has(await textOf(admin, "form.hof-bank-voucher .hof-form-error"), "cari"), `cari seçilmeden: “${await textOf(admin, "form.hof-bank-voucher .hof-form-error")}”`);
    ok((await eventCount()) === before, "hatalı formda hiçbir hareket yazılmadı");
    await admin.fill("form.hof-bank-voucher [data-acc-query]", "Ziraat Bankası A");
    await admin.waitForSelector("form.hof-bank-voucher .hof-case-picker-list li[data-id]", { timeout: 8000 });
    await admin.click("form.hof-bank-voucher .hof-case-picker-list li[data-id]");
    await fillVoucher(admin, { invoiceNo: "zb2026000000001" });
    const preview = await textOf(admin, "form.hof-bank-voucher [data-voucher-preview]");
    ok(has(preview, "Matrah ₺100,00") && has(preview, "KDV ₺20,00") && has(preview, "₺120,00"), `önizleme: ${preview}`);
    await shot(admin, "masraf-formu-kdv");
    await submitVoucher(admin);
    await voucherClosed(admin);
    book([["770", "D", 10_000], ["191", "D", 2_000], ["320", "C", 12_000]]);
    book([["320", "D", 12_000], ["102.01", "C", 12_000]]);
    ziraatMoves.push(-12_000);
    ok((await balanceOf(ZIRAAT.id)) === 9_986_950, "Ziraat 99.869,50 (−120)");
    const kdv = await must("KDV Özeti", api.get("/api/workspace/report-center/kdv-ozeti?from=2026-10-01&to=2026-10-31"));
    const indirilecek = kdv.summary.find(([label]) => label.startsWith("İndirilecek"))?.[1] || "";
    ok(/20,00/.test(indirilecek), `KDV Özeti indirilecek KDV 20,00 (${indirilecek})`);
    await waitMoves(admin, () => document.querySelector(".hof-bank-modal .hof-bank-moves tbody tr[data-event]")?.dataset.type === "invoice_cash");
    await openEventFromList(admin, row => row.type === "invoice_cash");
    const payment = await textOf(admin, `${bankWin} [data-bank-event]`);
    ok(await admin.$eval(`${bankWin} [data-act="ev-reverse"]`, node => node.disabled) && has(await textOf(admin, `${bankWin} [data-bank-event-blocks]`), "masrafın İşlem Kartı"), `faturalı masrafın ödeme satırında Ters Kaydet pasif, nedeni yazılı: ${await textOf(admin, `${bankWin} [data-bank-event-blocks]`)}`);
    ok(has(payment, "ZB2026000000001"), "ödeme kartında fatura numarası");
    await admin.click(`${bankWin} [data-bank-event] [data-event-link]`);
    await admin.waitForFunction(() => document.querySelector(".hof-bank-modal [data-bank-event]")?.textContent.includes("Matrah"), null, { timeout: 8000 });
    const header = await textOf(admin, `${bankWin} [data-bank-event]`);
    ok(has(header, "Matrah") && has(header, "₺100,00") && has(header, "KDV") && has(header, "₺20,00") && has(header, "Ziraat Bankası A.Ş."), `masrafın İşlem Kartı: matrah, KDV, cari (${header.slice(0, 160)})`);
    ok(has(await textOf(admin, `${bankWin} [data-event-amount]`), "₺120,00"), "faturalı masrafın İşlem Kartı'nda tutar 120,00 (fatura ödenecek tutarı)");
    await shot(admin, "islem-karti-kdv-masraf");
    await admin.click(`${bankWin} [data-bank-event] [data-open-invoice]`);
    await admin.waitForSelector(".hof-inv-blocks", { timeout: 10000 });
    const blocks = await textOf(admin, ".hof-inv-blocks");
    ok(has(blocks, "İptal Et kapalı") && has(blocks, "Ters Kaydet"), `Fatura penceresinde nedenler görünür yazıyla: ${blocks.slice(0, 160)}`);
    await shot(admin, "fatura-kdv-masraf-nedenler");
    await closeTop(admin);
    void supplier;
  });

  await step("14. Faiz geliri 1.000 / %15 ekrandan: net 850, stopaj 150 (193), 642 = 1.000", async () => {
    await admin.click(`${bankWin} [data-act="ev-back"]`);
    await admin.waitForSelector(`${bankWin} [data-moves]`);
    await admin.click(`${bankWin} [data-act="v-interest"]`);
    await admin.waitForSelector("form.hof-bank-voucher [name=\"amount\"]");
    ok((await admin.$eval("form.hof-bank-voucher [name=\"stoppageRate\"]", node => node.value)) === "", "hiç faiz yokken stopaj oranı önerisi boş (koda sabit oran yazılmaz)");
    await fillVoucher(admin, { type: "interest_in", accountId: ZIRAAT.id, amount: "1.000", stoppageRate: "15" });
    const preview = await textOf(admin, "form.hof-bank-voucher [data-voucher-preview]");
    ok(has(preview, "₺850,00") && has(preview, "Stopaj ₺150,00"), `önizleme: ${preview}`);
    await auditLabels(admin, "Faiz Formu");
    await shot(admin, "faiz-formu");
    await submitVoucher(admin);
    await voucherClosed(admin);
    book([["102.01", "D", 85_000], ["193", "D", 15_000], ["642", "C", 100_000]]);
    ziraatMoves.push(85_000);
    ok((await balanceOf(ZIRAAT.id)) === 10_071_950, "Ziraat 100.719,50 (+850)");
    const t = await trial();
    ok(t["642"] === -100_000 && t["193"] === 15_000, `mizan 642 = ${t["642"] / 100}, 193 = ${t["193"] / 100}`);
  });

  await step("15. Hareketler: satırlar ve yürüyen bakiye bağımsız beklenenle; süzgeçler (tür, arama, İşlem No, tutar); boş süzgeç", async () => {
    await waitMoves(admin, () => document.querySelector(".hof-bank-modal .hof-bank-moves tbody tr[data-event]")?.dataset.type === "interest_in");
    const rows = await moveRows(admin);
    const expected = [...ziraatMoves].reverse();
    ok(JSON.stringify(rows.map(row => row.signed)) === JSON.stringify(expected), `satır tutarları modelle aynı: ${rows.map(row => row.signed / 100).join(", ")}`);
    let running = expected.reduce((sum, value) => sum + value, 0);
    const balanceOk = rows.every(row => {
      const good = row.balance === running;
      running -= row.signed;
      return good;
    });
    ok(balanceOk && running === 0 && rows[0].balance === model.get("102.01"), `yürüyen bakiye her satırda bağımsız hesapla aynı (en üst ${rows[0].balance / 100} = model 102.01 ${model.get("102.01") / 100}; en alttan önce 0)`);
    ok(has(await textOf(admin, `${bankWin} .hof-bank-moves thead`), "Bakiye"), "tek hesap ve süzgeçsizken Bakiye kolonu var");
    await shot(admin, "hareketler-yuruyen-bakiye");
    await admin.selectOption(`${bankWin} [data-mv="type"]`, "fee");
    await waitMoves(admin, () => {
      const list = [...document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]")];
      return list.length > 0 && list.every(node => ["fee", "invoice_cash"].includes(node.dataset.type));
    });
    let filtered = await moveRows(admin);
    ok(filtered.length === 2 && filtered.every(row => row.balance === null) && !has(await textOf(admin, `${bankWin} .hof-bank-moves thead`), "Bakiye"), `Masraf süzgeci: BSMV'li masraf + faturalı masrafın ödemesi; yürüyen bakiye yok (${filtered.map(row => row.type).join(", ")})`);
    await admin.selectOption(`${bankWin} [data-mv="type"]`, "loan");
    await admin.waitForSelector(`${bankWin} [data-moves-empty]`, { timeout: 8000 });
    ok(has(await textOf(admin, `${bankWin} [data-moves-empty]`), "hareket yok"), "boş süzgeç: boş durum metni");
    await admin.selectOption(`${bankWin} [data-mv="type"]`, "");
    const feeNo = (await moveRows(admin).catch(() => [])).find(row => row.type === "fee")?.no || filtered.find(row => row.type === "fee").no;
    await admin.fill(`${bankWin} [data-mv="q"]`, feeNo);
    await waitMoves(admin, no => {
      const list = [...document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]")];
      return list.length === 1 && list[0].dataset.no === no;
    }, feeNo);
    ok(true, `İşlem No ile arama: yalnız ${feeNo}`);
    await admin.fill(`${bankWin} [data-mv="q"]`, "");
    await admin.fill(`${bankWin} [data-mv="min"]`, "100");
    await admin.press(`${bankWin} [data-mv="min"]`, "Enter");
    await waitMoves(admin, () => {
      const list = [...document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]")];
      return list.length > 0 && list.every(node => Math.abs(Number(node.dataset.signed)) >= 10_000);
    });
    filtered = await moveRows(admin);
    ok(filtered.length === 7 && filtered.every(row => Math.abs(row.signed) >= 10_000), `Tutar süzgeci (en az 100): ${filtered.length} satır`);
    await admin.fill(`${bankWin} [data-mv="min"]`, "-5");
    await admin.press(`${bankWin} [data-mv="min"]`, "Enter");
    await admin.waitForSelector(`${bankWin} [data-moves] .hof-list-error`, { timeout: 8000 });
    ok(has(await textOf(admin, `${bankWin} [data-moves] .hof-list-error`), "eksi"), `eksi tutar süzgeci ekranda hata: ${await textOf(admin, `${bankWin} [data-moves] .hof-list-error`)}`);
    ok(await admin.isVisible(`${bankWin} [data-mv="min"]`), "hata alınca süzgeç alanları yerinde");
    await admin.fill(`${bankWin} [data-mv="min"]`, "");
    await admin.press(`${bankWin} [data-mv="min"]`, "Enter");
    await waitMoves(admin, () => document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]").length === 8);
  });

  await step("16. Ters Kaydet: BSMV masrafı → bakiye eski hâl; kart Ters Kaydedildi; düğmeler pasif + nedeni görünür; ters kaydın kartı", async () => {
    await openEventFromList(admin, row => row.type === "fee");
    const no = await textOf(admin, `${bankWin} [data-event-no]`);
    await admin.click(`${bankWin} [data-act="ev-reverse"]`);
    await admin.waitForSelector(`${top} form button[type="submit"]`);
    const intro = await textOf(admin, `${top} .hof-modal-text`);
    ok(has(intro, no) && has(intro, "ters"), `onay penceresi İşlem No'yu ve sonucu söyler: ${intro.slice(0, 140)}`);
    await auditLabels(admin, "Ters Kaydet");
    await admin.click(`${top} form button[type="submit"]`);
    await admin.waitForFunction(() => document.querySelector(".hof-bank-modal [data-event-status]")?.textContent.includes("Ters Kaydedildi"), null, { timeout: 10000 });
    book([["102.01", "D", 1_050], ["770", "C", 1_050]]);
    ziraatMoves.push(1_050);
    ok((await balanceOf(ZIRAAT.id)) === 10_073_000, "Ziraat 100.730,00 (masraf geri)");
    ok(await admin.$eval(`${bankWin} [data-act="ev-reverse"]`, node => node.disabled) && await admin.$eval(`${bankWin} [data-act="ev-correct"]`, node => node.disabled), "Ters Kaydet ve Düzelt pasif");
    const blocks = await textOf(admin, `${bankWin} [data-bank-event-blocks]`);
    ok(has(blocks, "Ters Kaydet") && has(blocks, "kapalı") && has(blocks, "ters kaydedilmiş") && /BNK-2026-\d{6}/.test(blocks), `neden görünür yazıyla: ${blocks}`);
    await shot(admin, "ters-kaydedildi");
    await admin.click(`${bankWin} [data-bank-event] [data-event-link]`);
    await admin.waitForFunction(old => {
      const text = document.querySelector(".hof-bank-modal [data-event-no]")?.textContent || "";
      return text && !text.includes(old);
    }, no, { timeout: 8000 });
    const reversal = await textOf(admin, `${bankWin} [data-bank-event]`);
    ok(has(reversal, "Ters Kayıt") && has(reversal, no), "ters kaydın kartı asıl işlemi gösterir");
    ok(await admin.$eval(`${bankWin} [data-act="ev-reverse"]`, node => node.disabled) && has(await textOf(admin, `${bankWin} [data-bank-event-blocks]`), "Ters kayıt ters kaydedilmez"), "ters kaydın Ters Kaydet'i pasif, nedeni yazılı");
  });

  await step("17. Benzer İşlem: ters kaydedilenle aynı masraf kaydedilir; ikinci kez → pencere (BNK-… ve giren); Vazgeç yazmaz; Yine de Kaydet tek fiş", async () => {
    await admin.click(`${bankWin} [data-act="ev-back"]`);
    await admin.waitForSelector(`${bankWin} [data-moves]`);
    const newFee = async () => {
      await admin.click(`${bankWin} [data-act="v-fee"]`);
      await admin.waitForSelector("form.hof-bank-voucher [name=\"amount\"]");
      await fillVoucher(admin, { accountId: ZIRAAT.id, feeType: "eft", amount: "10,50" });
      await submitVoucher(admin);
    };
    await newFee();
    await voucherClosed(admin);
    book([["770", "D", 1_050], ["102.01", "C", 1_050]]);
    ziraatMoves.push(-1_050);
    ok((await balanceOf(ZIRAAT.id)) === 10_071_950, "ters kaydedilen masrafla aynı masraf uyarısız kaydedildi (100.719,50)");
    const firstNo = (await must("hareketler", api.get(`/api/workspace/bank/movements?account=${ZIRAAT.id}&type=fee&limit=1`))).rows[0].no;
    const before = await eventCount();
    await newFee();
    await admin.waitForFunction(() => [...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-modal-title")].some(node => node.textContent.trim() === "Benzer İşlem"), null, { timeout: 8000 });
    const dialog = await textOf(admin, `${top} .hof-modal-text`);
    ok(has(dialog, firstNo) && has(dialog, "Yine de Kaydet"), `Benzer İşlem penceresi önceki İşlem No'yu söyler: ${dialog.slice(0, 200)}`);
    ok((await textOf(admin, `${top} [data-answer="yes"]`)) === "Yine de Kaydet", "düğme: Yine de Kaydet");
    await shot(admin, "benzer-islem");
    await admin.click(`${top} [data-answer="no"]`);
    await admin.waitForTimeout(500);
    ok(await admin.isVisible("form.hof-bank-voucher") && (await eventCount()) === before, "Vazgeç: form açık kalır, hiçbir şey yazılmaz");
    await submitVoucher(admin);
    await admin.waitForFunction(() => [...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-modal-title")].some(node => node.textContent.trim() === "Benzer İşlem"), null, { timeout: 8000 });
    await admin.click(`${top} [data-answer="yes"]`);
    await voucherClosed(admin);
    book([["770", "D", 1_050], ["102.01", "C", 1_050]]);
    ziraatMoves.push(-1_050);
    ok((await eventCount()) === before + 1, "Yine de Kaydet: tek yeni fiş (iki değil)");
    ok((await balanceOf(ZIRAAT.id)) === 10_070_900, "Ziraat 100.709,00");
  });

  await step("18. Düzelt: faiz 1.000 → 2.000 (stopaj oranı %15 korunur); tür değiştirilemez; mizan", async () => {
    await waitMoves(admin, () => document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]").length >= 10);
    await openEventFromList(admin, row => row.type === "interest_in" && row.status === "active");
    await admin.click(`${bankWin} [data-act="ev-correct"]`);
    await admin.waitForSelector("form.hof-bank-voucher [name=\"amount\"]");
    ok((await admin.$eval("form.hof-bank-voucher [name=\"amount\"]", node => node.value)) === "1.000,00" && (await admin.$eval("form.hof-bank-voucher [name=\"stoppageRate\"]", node => node.value)) === "15", "Düzelt formu kayıtlı değerlerle açılır (1.000,00 · %15)");
    ok(await admin.$eval("form.hof-bank-voucher [name=\"type\"]", node => node.disabled || node.hasAttribute("readonly") || node.type === "hidden"), "işlem türü Düzelt'te değiştirilemez");
    await fillVoucher(admin, { amount: "2.000" });
    ok(has(await textOf(admin, "form.hof-bank-voucher [data-voucher-preview]"), "₺1.700,00"), "önizleme net 1.700");
    await auditLabels(admin, "Düzelt Formu");
    await shot(admin, "duzelt-formu");
    await submitVoucher(admin);
    await voucherClosed(admin);
    book([["642", "D", 100_000], ["102.01", "C", 85_000], ["193", "C", 15_000]]);
    book([["102.01", "D", 170_000], ["193", "D", 30_000], ["642", "C", 200_000]]);
    ziraatMoves.push(-85_000, 170_000);
    ok((await balanceOf(ZIRAAT.id)) === 10_155_900, "Ziraat 101.559,00");
    const t = await trial();
    ok(t["642"] === -200_000 && t["193"] === 30_000, `mizan 642 = ${t["642"] / 100}, 193 = ${t["193"] / 100}`);
  });

  await step("19. Açıklamayı Düzelt (HTML kaçışlı); kilitli dönemdeki masraf: Ters Kaydet bugün tarihli, kilitli dönem değişmez", async () => {
    await admin.waitForSelector(`${bankWin} [data-bank-event] [data-event-no]`);
    await admin.click(`${bankWin} [data-act="ev-info"]`);
    await admin.waitForSelector(`${top} form [name="description"]`);
    await admin.fill(`${top} form [name="description"]`, '<img src=x onerror="window.__evXss=1">Faiz =1+1');
    await admin.click(`${top} form button[type="submit"]`);
    await admin.waitForFunction(() => document.querySelector(".hof-bank-modal [data-bank-event]")?.textContent.includes("<img"), null, { timeout: 8000 });
    ok(!(await admin.$(`${bankWin} [data-bank-event] img`)) && !(await admin.evaluate(() => window.__evXss)), "HTML açıklama metin olarak görünür, çalışmaz");
    await admin.click(`${bankWin} [data-act="ev-back"]`);
    await admin.waitForSelector(`${bankWin} [data-moves]`);
    await admin.click(`${bankWin} [data-act="v-fee"]`);
    await admin.waitForSelector("form.hof-bank-voucher [name=\"amount\"]");
    await fillVoucher(admin, { accountId: ZIRAAT.id, feeType: "havale", amount: "5,25", date: "2026-10-02" });
    await submitVoucher(admin);
    await voucherClosed(admin);
    book([["770", "D", 525], ["102.01", "C", 525]]);
    ziraatMoves.push(-525);
    await must("kilit", api.put("/api/admin/period-lock", { lockedUntil: "2026-10-03" }));
    const lockedBefore = (await must("kilitli günler", api.get(`/api/workspace/bank/movements?account=${ZIRAAT.id}&to=2026-10-03&status=all&limit=200`))).rows.map(row => `${row.no}|${row.signedMinor}|${row.status}`).sort();
    await admin.fill(`${bankWin} [data-mv="q"]`, "");
    await waitMoves(admin, () => [...document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]")].some(node => node.dataset.signed === "-525"));
    await openEventFromList(admin, row => row.signed === -525);
    ok(has(await textOf(admin, `${bankWin} [data-bank-event]`), "kilitli dönem"), "kart kilitli dönemde olduğunu söyler");
    await admin.click(`${bankWin} [data-act="ev-reverse"]`);
    await admin.waitForSelector(`${top} form button[type="submit"]`);
    const intro = await textOf(admin, `${top} .hof-modal-text`);
    ok(has(intro, "bugün") && has(intro, "08.10.2026"), `onay: ters fiş bugün tarihli (${intro.slice(0, 200)})`);
    await admin.waitForTimeout(400);
    await shot(admin, "kilitli-ters-kaydet");
    await admin.click(`${top} form button[type="submit"]`);
    await admin.waitForFunction(() => document.querySelector(".hof-bank-modal [data-event-status]")?.textContent.includes("Ters Kaydedildi"), null, { timeout: 10000 });
    book([["102.01", "D", 525], ["770", "C", 525]]);
    ziraatMoves.push(525);
    const card = await must("kart", api.get(`/api/workspace/bank/events/${encodeURIComponent(await textOf(admin, `${bankWin} [data-event-no]`))}`));
    const reversal = await must("ters kayıt", api.get(`/api/workspace/bank/events/${card.reversal.by.id}`));
    ok(reversal.date === "2026-10-08", `ters fiş bugün (08.10.2026) tarihli: ${reversal.date}`);
    const lockedAfter = (await must("kilitli günler", api.get(`/api/workspace/bank/movements?account=${ZIRAAT.id}&to=2026-10-03&status=all&limit=200`))).rows.map(row => `${row.no}|${row.signedMinor}|${row.status === "reversed" ? "active" : row.status}`).sort();
    ok(JSON.stringify(lockedAfter.map(item => item.split("|").slice(0, 2).join("|"))) === JSON.stringify(lockedBefore.map(item => item.split("|").slice(0, 2).join("|"))), "kilitli dönemde yeni satır yok, tutarlar aynı");
    await must("kilit kaldır", api.put("/api/admin/period-lock", { lockedUntil: "" }));
  });

  await step("20. Planlı İşlem: + Planlı İşlem (aylık Hesap İşletim 25) → Planlı görünüm, bakiye değişmez, Vadesi Geldi; Gerçekleştir → fiş, plan bir ay ileri; Sil", async () => {
    await admin.click(`${bankWin} [data-act="ev-back"]`);
    await admin.waitForSelector(`${bankWin} [data-moves]`);
    const balance = await balanceOf(ZIRAAT.id);
    await admin.click(`${bankWin} [data-act="plan-new"]`);
    await admin.waitForSelector("form.hof-bank-voucher [name=\"plannedDate\"]");
    const taxes = await admin.$$eval("form.hof-bank-voucher [name=\"tax\"] option", list => list.map(node => node.value));
    ok(!taxes.includes("vat_incl") && !taxes.includes("vat_excl"), `planlı formda KDV'li (faturalı) seçenek yok: ${taxes.join(", ")}`);
    await fillVoucher(admin, { type: "fee", accountId: ZIRAAT.id, feeType: "hesap-isletim", amount: "25", plannedDate: "2026-10-08", repeat: "monthly", description: "Hesap işletim ücreti" });
    await auditLabels(admin, "Planlı İşlem Formu");
    await shot(admin, "planli-islem-formu");
    await submitVoucher(admin);
    await voucherClosed(admin);
    await admin.waitForSelector(`${bankWin} .hof-bank-plans tbody tr[data-plan]`, { timeout: 8000 });
    ok((await balanceOf(ZIRAAT.id)) === balance, "planlı işlem deftere girmez (bakiye aynı)");
    let plans = await textOf(admin, `${bankWin} .hof-bank-plans tbody`);
    ok(has(plans, "Vadesi Geldi") && has(plans, "Aylık") && has(plans, "₺25,00"), `Planlı görünüm: ${plans.slice(0, 160)}`);
    ok((await must("rozet", api.get("/api/workspace/bank/badge?count=1"))).count >= 1, "rozet vadesi gelen planı sayar");
    await shot(admin, "planli-gorunum");
    await admin.click(`${bankWin} .hof-bank-plans [data-act="plan-run"]`);
    await admin.waitForSelector(`${top} form [name="date"]`);
    ok((await admin.$eval(`${top} form [name="date"]`, node => node.value)) === "2026-10-08", "Gerçekleştir tarihi planlı tarih (08.10.2026)");
    await admin.click(`${top} form button[type="submit"]`);
    await admin.waitForFunction(() => document.querySelector(".hof-bank-modal .hof-bank-plans tbody")?.textContent.includes("08.11.2026"), null, { timeout: 10000 });
    book([["770", "D", 2_500], ["102.01", "C", 2_500]]);
    ziraatMoves.push(-2_500);
    ok((await balanceOf(ZIRAAT.id)) === balance - 2_500, "Gerçekleştir: Ziraat −25");
    plans = await textOf(admin, `${bankWin} .hof-bank-plans tbody`);
    ok(has(plans, "08.11.2026") && !has(plans, "Vadesi Geldi"), "aylık plan bir ay ileri (08.11.2026), vadesi gelmedi");
    const future = await must("tekrarsız plan", api.post("/api/workspace/bank/plans", { kind: "other_out", accountId: ZIRAAT.id, amount: "300", plannedDate: "2026-10-20", description: "Kira" }));
    await admin.click(`${bankWin} [data-act="mv-planned"]`);
    await admin.click(`${bankWin} [data-act="mv-planned"]`);
    await admin.waitForSelector(`${bankWin} .hof-bank-plans tbody tr[data-plan="${future.id}"]`, { timeout: 8000 });
    ok(!(await admin.$(`${bankWin} .hof-bank-plans tr[data-plan="${future.id}"] [data-act="plan-skip"]`)), "tekrarsız planda Atla yok");
    await admin.click(`${bankWin} .hof-bank-plans tr[data-plan="${future.id}"] [data-act="plan-cancel"]`);
    await answerYes(admin);
    await admin.waitForSelector(`${bankWin} .hof-bank-plans tbody tr[data-plan="${future.id}"]`, { state: "detached", timeout: 8000 });
    ok((await must("plan", api.get("/api/workspace/bank/plans?status=all"))).plans.find(item => item.id === future.id)?.status === "cancelled", "Sil: plan İptal Edildi");
    await admin.click(`${bankWin} [data-act="mv-planned"]`);
    await admin.waitForSelector(`${bankWin} .hof-bank-moves`, { timeout: 8000 });
  });

  await step("21. Daha Fazla Göster: Garanti'de 60 fiş → 50 + 11; tekrar yok; yürüyen bakiye sayfa sınırında sürekli", async () => {
    const amounts = Array.from({ length: 60 }, (_, index) => index + 1);
    for (const [index, amount] of amounts.entries()) await must(`fiş ${amount}`, api.post("/api/workspace/bank/vouchers", { type: "other_out", accountId: GARANTI.id, amount: String(amount), date: `2026-10-0${2 + (index % 6)}`, description: `Gider ${amount}`, similarOk: true }));
    book([["659", "D", 183_000], ["102.02", "C", 183_000]]);
    await selectMovesAccount(admin, GARANTI.id);
    let rows = await moveRows(admin);
    ok(rows.length === 50 && (await admin.isVisible(`${bankWin} [data-act="mv-more"]`)), `ilk sayfa 50 satır, Daha Fazla Göster görünür (${rows.length})`);
    await admin.click(`${bankWin} [data-act="mv-more"]`);
    await waitMoves(admin, () => document.querySelectorAll(".hof-bank-modal .hof-bank-moves tbody tr[data-event]").length === 61);
    rows = await moveRows(admin);
    const unique = new Set(rows.map(row => row.id)).size === rows.length;
    let running = rows[0].balance;
    const continuous = rows.every(row => {
      const good = row.balance === running;
      running -= row.signed;
      return good;
    });
    ok(rows.length === 61 && unique && continuous && running === 0 && rows[0].balance === model.get("102.02"), `61 satır, tekrarsız, bakiye sürekli; en üst ${rows[0].balance / 100} = model ${model.get("102.02") / 100}`);
    ok(!(await admin.isVisible(`${bankWin} [data-act="mv-more"]`)), "son sayfadan sonra Daha Fazla yok");
    await shot(admin, "daha-fazla");
  });

  await step("22. Yetki: bank.cancel ve Fatura Yönetimi kaldırılan muhasebe → Ters Kaydet pasif + yetki nedeni, KDV'li seçenek yok; bank.move kaldırılınca + Masraf yok", async () => {
    const users = await must("kullanıcılar", api.get("/api/admin/users"));
    const target = users.find(user => user.username === "muhasebe1");
    const grant = remove => must("yetki", api.patch(`/api/admin/users/${target.id}`, { grants: { add: [], remove } }));
    await grant(["bank.cancel", "invoices.manage"]);
    const muhasebe = await newPage();
    current = muhasebe;
    await login(muhasebe, "muhasebe1", USER_PASS);
    await openBank(muhasebe);
    await tab(muhasebe, "movements");
    await muhasebe.waitForSelector(`${bankWin} [data-moves]`);
    await selectMovesAccount(muhasebe, ZIRAAT.id);
    await openEventFromList(muhasebe, row => row.type === "fee" && row.status === "active");
    ok(await muhasebe.$eval(`${bankWin} [data-act="ev-reverse"]`, node => node.disabled) && has(await textOf(muhasebe, `${bankWin} [data-bank-event-blocks]`), "Ters Kayıt yetkisi"), `bank.cancel yokken Ters Kaydet pasif: ${await textOf(muhasebe, `${bankWin} [data-bank-event-blocks]`)}`);
    await shot(muhasebe, "yetki-ters-kaydet-pasif");
    await muhasebe.click(`${bankWin} [data-act="ev-back"]`);
    await muhasebe.waitForSelector(`${bankWin} [data-moves]`);
    await muhasebe.click(`${bankWin} [data-act="v-fee"]`);
    await muhasebe.waitForSelector("form.hof-bank-voucher [name=\"tax\"]");
    const taxes = await muhasebe.$$eval("form.hof-bank-voucher [name=\"tax\"] option", list => list.map(node => node.value));
    ok(!taxes.includes("vat_incl"), `Fatura Yönetimi yokken KDV'li seçenek yok: ${taxes.join(", ")}`);
    await closeTop(muhasebe);
    await grant(["bank.move"]);
    await muhasebe.reload({ waitUntil: "load" });
    await muhasebe.waitForSelector("#hof-sidecard", { timeout: 30000 });
    await openBank(muhasebe);
    await tab(muhasebe, "movements");
    await muhasebe.waitForSelector(`${bankWin} [data-moves]`);
    ok(!(await muhasebe.$(`${bankWin} [data-act="v-fee"]`)) && !(await muhasebe.$(`${bankWin} [data-act="plan-new"]`)), "bank.move yokken + Masraf ve + Planlı İşlem yok");
    await grant([]);
    await muhasebe.context().close();
    current = admin;
  });

  await step("23. Mobil (390 px): Hareketler, İşlem Kartı ve Masraf formu yatay kaydırmasız; Hesap Detayı'nda hesabın hareketleri", async () => {
    const phone = await newPage({ width: 390, height: 844 });
    current = phone;
    await login(phone, "admin", PASS);
    await phone.evaluate(() => HOF.bank.open({ tab: "movements" }));
    await phone.waitForSelector(`${bankWin} .hof-bank-moves tbody tr[data-event]`, { timeout: 15000 });
    let check = await noHorizontalScroll(phone);
    ok(check.page && check.dialog, `Hareketler yatay kaydırmasız ${JSON.stringify(check.wide)}`);
    await shot(phone, "mobil-hareketler", { fullPage: true });
    await phone.click(`${bankWin} .hof-bank-moves tbody tr[data-event]`);
    await phone.waitForSelector(`${bankWin} [data-bank-event] [data-event-no]`, { timeout: 8000 });
    check = await noHorizontalScroll(phone);
    ok(check.page && check.dialog, `İşlem Kartı yatay kaydırmasız ${JSON.stringify(check.wide)}`);
    await shot(phone, "mobil-islem-karti", { fullPage: true });
    await phone.click(`${bankWin} [data-act="ev-back"]`);
    await phone.waitForSelector(`${bankWin} [data-act="v-fee"]`);
    await phone.click(`${bankWin} [data-act="v-fee"]`);
    await phone.waitForSelector("form.hof-bank-voucher");
    const formWide = await phone.evaluate(() => [...document.querySelectorAll("form.hof-bank-voucher *")].filter(node => node.getBoundingClientRect().right > window.innerWidth + 1).length);
    ok(formWide === 0, `Masraf formu taşmaz (${formWide})`);
    await shot(phone, "mobil-masraf-formu");
    await closeTop(phone);
    await phone.context().close();
    current = admin;
    // Hesap Detayı: hesabın hareketleri yürüyen bakiyeyle; satır İşlem Kartı'nı açar; + Masraf hesap seçili açılır.
    await tab(admin, "accounts");
    await admin.click(`${bankWin} .hof-bank-accounts tbody tr[data-account="${ZIRAAT.id}"]`);
    await admin.waitForSelector(`${bankWin} [data-bank-balance]`);
    await admin.waitForSelector(`${bankWin} .hof-bank-moves tbody tr[data-event]`, { timeout: 8000 });
    const rows = await moveRows(admin);
    ok(rows[0].balance === model.get("102.01") && has(await textOf(admin, `${bankWin} [data-bank-balance]`), HOF_MONEY(model.get("102.01"))), `Hesap Detayı: hesabın hareketleri, en üst bakiye ${rows[0].balance / 100} = Gerçek Bakiye`);
    await admin.click(`${bankWin} [data-act="v-fee"]`);
    await admin.waitForSelector("form.hof-bank-voucher [name=\"accountId\"]");
    ok((await admin.$eval("form.hof-bank-voucher [name=\"accountId\"]", node => node.value)) === ZIRAAT.id, "Hesap Detayı'ndan + Masraf o hesap seçili açılır");
    await closeTop(admin);
    await shot(admin, "hesap-detayi-hareketler");
  });

  let CARD = null;
  let LOAN = null;
  await step("23b. Diğer Gelir (Gelişmiş: 646), Faiz Gideri (BSMV/KKDF), Kart Borcu Ödemesi, Kredi Kullanımı ve Geri Ödemesi EKRANDAN; alt hesaplar modelle", async () => {
    // Kurumsal kart (açılış borcu 5.000) ve kredi hesabı (açılış 0) — hesap formu bölüm 1'de sınandı; burada API'den, açılışları modele.
    CARD = await must("kart", api.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Şirket Kartı", kind: "card", creditLimit: "50.000", opening: { date: "2026-10-01", amount: "5.000", confirmed: true } }));
    LOAN = await must("kredi", api.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Ticari Kredi", kind: "loan", opening: { date: "2026-10-01", amount: "0", confirmed: true } }));
    book([["500", "D", 500_000], [CARD.glSub, "C", 500_000]]);
    await tab(admin, "accounts");
    await tab(admin, "movements");
    await admin.waitForSelector(`${bankWin} [data-act="v-other"]`);
    const sub = async () => subTrial();
    // 1) Diğer Gelir 250 → Gelişmiş Seçenekler'de gelir hesabı 646 (varsayılan 649 değil).
    await admin.click(`${bankWin} [data-act="v-other"]`);
    await admin.waitForSelector("form.hof-bank-voucher [name=\"type\"]");
    const types = await admin.$$eval("form.hof-bank-voucher [name=\"type\"] option", list => list.map(node => node.textContent.trim()));
    ok(["Diğer Gelir", "Diğer Gider", "Kart Borcu Ödemesi", "Kredi Kullanımı", "Kredi Geri Ödemesi"].every(name => types.includes(name)), `Diğer İşlem türleri: ${types.join(", ")}`);
    await fillVoucher(admin, { type: "other_in", accountId: GARANTI.id, amount: "250", description: "Kur farkı geliri" });
    await admin.click("form.hof-bank-voucher details[data-adv] summary");
    await admin.waitForTimeout(200);
    const glOptions = await admin.$$eval("form.hof-bank-voucher [name=\"gl\"] option", list => list.map(node => node.value));
    ok(glOptions.join(",") === "642,646,649" && (await admin.$eval("form.hof-bank-voucher [name=\"gl\"]", node => node.value)) === "649", `Gelir Hesabı seçenekleri beyaz listeden (${glOptions.join(", ")}), varsayılan 649`);
    await fillVoucher(admin, { gl: "646" });
    await auditLabels(admin, "Diğer İşlem Formu");
    await shot(admin, "diger-gelir-formu");
    await submitVoucher(admin);
    await voucherClosed(admin);
    book([["102.02", "D", 25_000], ["646", "C", 25_000]]);
    // 2) Faiz Gideri 300 + BSMV/KKDF 15 → 780 = 315, 102.02 −315.
    await admin.click(`${bankWin} [data-act="v-interest"]`);
    await admin.waitForSelector("form.hof-bank-voucher [name=\"type\"]");
    await fillVoucher(admin, { type: "interest_out", accountId: GARANTI.id, amount: "300", taxAmount: "15" });
    ok(has(await textOf(admin, "form.hof-bank-voucher [data-voucher-preview]"), "₺315,00"), `önizleme toplam 315: ${await textOf(admin, "form.hof-bank-voucher [data-voucher-preview]")}`);
    await submitVoucher(admin);
    await voucherClosed(admin);
    book([["780", "D", 31_500], ["102.02", "C", 31_500]]);
    // 3) Kart Borcu Ödemesi 2.000 (Garanti → Şirket Kartı): 309.k borç azalır.
    await admin.click(`${bankWin} [data-act="v-other"]`);
    await admin.waitForSelector("form.hof-bank-voucher [name=\"type\"]");
    await fillVoucher(admin, { type: "card_payment", accountId: GARANTI.id, cardAccountId: CARD.id, amount: "2.000" });
    await shot(admin, "kart-borcu-odemesi-formu");
    await submitVoucher(admin);
    await voucherClosed(admin);
    book([[CARD.glSub, "D", 200_000], ["102.02", "C", 200_000]]);
    // 4) Kredi Kullanımı 10.000 → Garanti'ye; 5) Kredi Geri Ödemesi 1.000 + faiz 100.
    await admin.click(`${bankWin} [data-act="v-other"]`);
    await admin.waitForSelector("form.hof-bank-voucher [name=\"type\"]");
    await fillVoucher(admin, { type: "loan_draw", accountId: GARANTI.id, loanAccountId: LOAN.id, amount: "10.000" });
    await submitVoucher(admin);
    await voucherClosed(admin);
    book([["102.02", "D", 1_000_000], [LOAN.glSub, "C", 1_000_000]]);
    await admin.click(`${bankWin} [data-act="v-other"]`);
    await admin.waitForSelector("form.hof-bank-voucher [name=\"type\"]");
    await fillVoucher(admin, { type: "loan_repay", accountId: GARANTI.id, loanAccountId: LOAN.id, amount: "1.000", interestAmount: "100" });
    ok(has(await textOf(admin, "form.hof-bank-voucher [data-voucher-preview]"), "₺1.100,00"), `önizleme toplam 1.100: ${await textOf(admin, "form.hof-bank-voucher [data-voucher-preview]")}`);
    await shot(admin, "kredi-geri-odemesi-formu");
    await submitVoucher(admin);
    await voucherClosed(admin);
    book([[LOAN.glSub, "D", 100_000], ["780", "D", 10_000], ["102.02", "C", 110_000]]);
    const s = await sub();
    for (const code of ["102.02", CARD.glSub, LOAN.glSub]) ok((s[code] || 0) === (model.get(code) || 0), `alt hesap ${code}: program ${(s[code] || 0) / 100} · model ${(model.get(code) || 0) / 100}`);
    const t = await trial();
    for (const code of ["646", "780"]) ok((t[code] || 0) === (model.get(code) || 0), `mizan ${code}: program ${(t[code] || 0) / 100} · model ${(model.get(code) || 0) / 100}`);
    // Kart hesabının Hesap Detayı: borç 3.000 (5.000 − 2.000); kredi 9.000.
    ok((await balanceOf(CARD.id)) === -300_000 || (await balanceOf(CARD.id)) === 300_000, `kart borcu 3.000 (${(await balanceOf(CARD.id)) / 100})`);
    ok(Math.abs(await balanceOf(LOAN.id)) === 900_000, `kredi borcu 9.000 (${(await balanceOf(LOAN.id)) / 100})`);
    await selectMovesAccount(admin, GARANTI.id);
    const rows = await moveRows(admin);
    ok(rows[0]?.balance === model.get("102.02"), `Hareketler (Garanti) en üst bakiye ${rows[0]?.balance / 100} = model ${model.get("102.02") / 100}`);
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    ok(integrity.ok === true, "mutabakat ok (Diğer İşlem, Faiz Gideri, kart, kredi)");
  });

  await step("24. Son durum bağımsız modelle: alt hesaplar, 770, 191, 193, 642, 646, 659, 780; kart ve kredi; mutabakat ok", async () => {
    const t = await trial();
    const sub = await subTrial();
    for (const code of ["770", "191", "193", "642", "646", "659", "780"]) ok((t[code] || 0) === (model.get(code) || 0), `mizan ${code}: program ${(t[code] || 0) / 100} · model ${(model.get(code) || 0) / 100}`);
    ok(sub["102.01"] === model.get("102.01") && sub["102.02"] === model.get("102.02"), `alt hesaplar: 102.01 ${sub["102.01"] / 100} / ${model.get("102.01") / 100}, 102.02 ${sub["102.02"] / 100} / ${model.get("102.02") / 100}`);
    for (const code of [CARD?.glSub, LOAN?.glSub].filter(Boolean)) ok((sub[code] || 0) === (model.get(code) || 0), `alt hesap ${code}: program ${(sub[code] || 0) / 100} · model ${(model.get(code) || 0) / 100}`);
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    ok(integrity.ok === true, "mutabakat ok (bölüm 2 sonu)");
  });

  // ==================== Bölüm 3 (Aşama 3–4 bağımsız gözden geçirme GG2: arayüzde görünen bulgular) ====================
  const eventsOf = async id => (await must("hesabın hareketleri", api.get(`/api/workspace/bank/movements?account=${id}&status=all&limit=200`))).rows.length;
  const closeAll = async page => {
    for (let index = 0; index < 6 && (await page.$(modal)); index += 1) await closeTop(page);
  };
  await step("24b. GG2 (F3/L7): kart hesabında Borç artı; Açılışı Düzelt formu artı borçla dolu; değiştirmeden kaydet yeni fiş yazmaz", async () => {
    current = admin;
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForSelector("#hof-sidecard", { timeout: 30000 });
    await admin.waitForTimeout(700);
    await openBank(admin);
    await tab(admin, "accounts");
    await admin.click(`${bankWin} .hof-bank-accounts tbody tr[data-account="${CARD.id}"]`);
    await admin.waitForSelector(`${bankWin} [data-bank-balance]`);
    await admin.waitForSelector(`${bankWin} .hof-bank-moves tbody tr[data-event]`, { timeout: 8000 });
    const head = await textOf(admin, `${bankWin} .hof-chq-amount`);
    const facts = await textOf(admin, `${bankWin} .hof-chq-facts`);
    ok(has(head, "Borç") && has(head, "₺3.000,00") && !has(head, "-") && !has(head, "−"), `başlık: ${head} (kart borcu 3.000 artı)`);
    ok(has(facts, "Açılıştaki Borç") && has(facts, "₺5.000,00") && !/[-−]₺?5\.000/.test(facts), `Açılıştaki Borç artı 5.000: ${facts.slice(0, 200)}`);
    const balanceHead = await admin.$$eval(`${bankWin} .hof-bank-moves thead th`, list => list.map(node => node.textContent.trim()));
    const firstDebt = await admin.$eval(`${bankWin} .hof-bank-moves tbody tr[data-event] td:last-child`, node => node.textContent.trim());
    ok(balanceHead.at(-1) === "Borç" && firstDebt === "₺3.000,00", `hesabın hareketlerinde yürüyen kolon "Borç" ve artı (${balanceHead.at(-1)}: ${firstDebt})`);
    await shot(admin, "gg2-kart-borc-arti");
    const before = await eventsOf(CARD.id);
    await admin.click(`${bankWin} [data-act="opening"]`);
    await admin.waitForSelector(`${top} form [name="openingAmount"]`);
    ok((await textOf(admin, `${top} .hof-modal-title`)) === "Açılışı Düzelt", "Açılışı Düzelt formu");
    ok((await admin.$eval(`${top} form [name="openingAmount"]`, node => node.value)) === "5.000,00", `form artı borçla dolu: ${await admin.$eval(`${top} form [name="openingAmount"]`, node => node.value)}`);
    await shot(admin, "gg2-kart-acilis-formu");
    await admin.click(`${top} form button[type="submit"]`);
    await admin.waitForSelector(`${top} form [name="openingAmount"]`, { state: "detached", timeout: 8000 });
    await admin.waitForTimeout(500);
    ok((await eventsOf(CARD.id)) === before && (await balanceOf(CARD.id)) === -300_000, `değiştirmeden kaydet: yeni fiş yok (${before} → ${await eventsOf(CARD.id)}), kart borcu aynı`);
  });

  let HTML_ACCOUNT = null;
  let NEG = null;
  await step("24c. GG2 (F12/L12): + Yeni Hesap'ta Para Birimi yok; sıfır açılışlı hesapta Açılış Bakiyesi Gir (Açılışı Düzelt değil)", async () => {
    await tab(admin, "accounts");
    await admin.click(`${bankWin} [data-act="new"]`);
    await admin.waitForSelector(`${top} form [name="bankName"]`);
    ok(!(await admin.$(`${top} form [name="currency"]`)) && !(await admin.isVisible(`${top} form [name="openingRate"]`)), "hesap formunda Para Birimi yok, Açılış Kuru görünmez (döviz hesabı bu sürümde kapalı)");
    await auditLabels(admin, "Hesap Formu (GG2)");
    await closeTop(admin);
    const usd = await api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Döviz", kind: "demand", currency: "USD" });
    ok(usd.status === 400 && JSON.stringify(usd.data).includes("bank-currency-later"), `API'den USD hesap 400 bank-currency-later (${usd.status})`);
    HTML_ACCOUNT = await must("HTML adlı hesap", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: '<img src=x onerror="window.__gg2xss=1">', kind: "demand", opening: { date: "2026-10-01", amount: "0", confirmed: false } }));
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForSelector("#hof-sidecard", { timeout: 30000 });
    await admin.waitForTimeout(700);
    await openBank(admin);
    await tab(admin, "accounts");
    await admin.click(`${bankWin} .hof-bank-accounts tbody tr[data-account="${HTML_ACCOUNT.id}"]`);
    await admin.waitForSelector(`${bankWin} [data-bank-balance]`);
    const label = await textOf(admin, `${bankWin} [data-act="opening"]`);
    ok(label === "Açılış Bakiyesi Gir" && (await admin.$eval(`${bankWin} [data-act="opening"]`, node => !node.disabled)), `sıfır açılışlı hesapta düğme “${label}”, etkin`);
    ok(!(await admin.evaluate(() => window.__gg2xss)) && !(await admin.$(`${bankWin} .hof-plan-title img`)), "HTML adlı hesap kaçışlı (img öğesi yok, betik çalışmadı)");
  });

  await step("24d. GG2 (F7/F6): HTML adlı hesabın planında Gerçekleştir giriş metni kaçışlı; Atla çift tıklamada tek dönem ilerler", async () => {
    const plan = await must("aylık plan", api.post("/api/workspace/bank/plans", { kind: "other_out", accountId: HTML_ACCOUNT.id, amount: "40", plannedDate: "2026-10-08", repeat: "monthly", description: "Aidat" }));
    await tab(admin, "movements");
    await admin.waitForSelector(`${bankWin} [data-moves]`);
    await admin.click(`${bankWin} [data-act="mv-planned"]`);
    await admin.waitForSelector(`${bankWin} .hof-bank-plans`, { timeout: 8000 });
    await admin.selectOption(`${bankWin} [data-mv="account"]`, HTML_ACCOUNT.id);
    await admin.waitForSelector(`${bankWin} .hof-bank-plans tbody tr[data-plan="${plan.id}"]`, { timeout: 8000 });
    await admin.click(`${bankWin} .hof-bank-plans tr[data-plan="${plan.id}"] [data-act="plan-run"]`);
    await admin.waitForSelector(`${top} form [name="date"]`);
    const intro = await admin.$eval(top, node => ({ text: node.textContent, imgs: node.querySelectorAll("img").length }));
    ok(intro.imgs === 0 && intro.text.includes('<img src=x onerror="window.__gg2xss=1">') && !(await admin.evaluate(() => window.__gg2xss)), "Gerçekleştir giriş metninde hesap adı düz yazı (öğe değil)");
    await shot(admin, "gg2-plan-giris-kacisli");
    await closeTop(admin);
    await admin.waitForSelector(`${bankWin} .hof-bank-plans tr[data-plan="${plan.id}"] [data-act="plan-skip"]`);
    await admin.dblclick(`${bankWin} .hof-bank-plans tr[data-plan="${plan.id}"] [data-act="plan-skip"]`);
    await admin.waitForFunction(id => document.querySelector(`.hof-bank-modal .hof-bank-plans tr[data-plan="${id}"]`)?.textContent.includes("08.11.2026"), plan.id, { timeout: 10000 });
    await admin.waitForTimeout(800);
    const after = (await must("plan", api.get("/api/workspace/bank/plans?status=all"))).plans.find(item => item.id === plan.id);
    ok(after.plannedDate === "2026-11-08", `çift tıklama tek dönem: sonraki tarih ${after.plannedDate} (beklenen 2026-11-08, 2026-12-08 değil)`);
    const second = await api.post(`/api/workspace/bank/plans/${plan.id}/skip`, { expectedDate: "2026-10-08" });
    ok(second.status === 409 && (second.data?.code === "bank-plan-moved" || second.data?.error?.code === "bank-plan-moved" || JSON.stringify(second.data).includes("bank-plan-moved")), `eski ekrandan ikinci Atla 409 bank-plan-moved (${second.status})`);
    await must("plan sil", api.del(`/api/workspace/bank/plans/${plan.id}`));
    await admin.click(`${bankWin} [data-act="mv-planned"]`);
    await admin.waitForFunction(() => !document.querySelector(".hof-bank-modal .hof-bank-plans") && document.querySelector(".hof-bank-modal [data-moves]"), null, { timeout: 8000 });
  });

  await step("24e. GG2 (F9): Banka Fişi K7 eksi bakiye: Bakiye Doğrulandı hesapta çıkış soru sorar; Vazgeç yazmaz; Yine de Kaydet tek fiş", async () => {
    NEG = await must("eksi deneme hesabı", api.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Eksi Deneme", kind: "demand", opening: { date: "2026-10-01", amount: "100", confirmed: true } }));
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForSelector("#hof-sidecard", { timeout: 30000 });
    await admin.waitForTimeout(700);
    await openBank(admin);
    await tab(admin, "movements");
    await admin.waitForSelector(`${bankWin} [data-act="v-other"]`);
    const before = await eventsOf(NEG.id);
    await admin.click(`${bankWin} [data-act="v-other"]`);
    await admin.waitForSelector("form.hof-bank-voucher [name=\"type\"]");
    await fillVoucher(admin, { type: "other_out", accountId: NEG.id, amount: "500", description: "Eksi bakiye denemesi" });
    await submitVoucher(admin);
    await admin.waitForFunction(() => [...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-modal-title")].some(node => node.textContent.trim() === "Eksi Bakiye"), null, { timeout: 8000 });
    const question = await textOf(admin, `${top} .hof-modal-text`);
    ok(/eksi/i.test(question) && has(question, "100,00"), `soru: ${question}`);
    await shot(admin, "gg2-eksi-bakiye-sorusu");
    await admin.click(`${top} [data-answer="no"]`);
    await admin.waitForTimeout(600);
    ok(Boolean(await admin.$("form.hof-bank-voucher")) && (await eventsOf(NEG.id)) === before && (await balanceOf(NEG.id)) === 10_000, "Vazgeç: form açık, fiş yok, bakiye 100");
    await submitVoucher(admin);
    await answerYes(admin);
    await voucherClosed(admin);
    ok((await eventsOf(NEG.id)) === before + 1 && (await balanceOf(NEG.id)) === -40_000, `Yine de Kaydet: tek fiş, bakiye −400 (${(await balanceOf(NEG.id)) / 100})`);
    // Engelle (hesap bazında): soru yok, kayıt yok.
    await must("Engelle", api.put(`/api/workspace/bank/accounts/${NEG.id}`, { negativePolicy: "block" }));
    const blocked = await api.post("/api/workspace/bank/vouchers", { type: "other_out", accountId: NEG.id, amount: "1", description: "Engelli", negativeOk: true });
    ok(blocked.status === 409 && JSON.stringify(blocked.data).includes("bank-blocked") && (await balanceOf(NEG.id)) === -40_000, `Engelle: negativeOk ile bile 409 bank-blocked (${blocked.status})`);
  });

  await step("24f. GG2 (L6/L9/F10): Ayarlar'da kaydedilmemiş değişiklikle Esc soru sorar; Vazgeç pencerede kalır; yeniden açılışta Gelişmiş kapalı", async () => {
    await tab(admin, "settings");
    await admin.waitForSelector(`${bankWin} [data-settings]`);
    await admin.click(`${bankWin} [data-act="advanced"]`);
    await admin.waitForTimeout(300);
    await admin.selectOption(`${bankWin} [data-set="similar.enabled"]`, "false");
    await admin.keyboard.press("Escape");
    await admin.waitForFunction(() => [...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-modal-title")].some(node => node.textContent.trim() === "Kaydedilmemiş Değişiklik"), null, { timeout: 8000 });
    await shot(admin, "gg2-ayarlar-kaydedilmemis");
    await admin.click(`${top} [data-answer="no"]`);
    await admin.waitForTimeout(400);
    ok(Boolean(await admin.$(`${bankWin} [data-settings]`)) && (await admin.$eval(`${bankWin} [data-set="similar.enabled"]`, node => node.value)) === "false", "Vazgeç: Banka penceresi açık, değişiklik duruyor");
    await admin.keyboard.press("Escape");
    await answerYes(admin);
    await admin.waitForSelector(bankWin, { state: "detached", timeout: 8000 });
    ok((await must("ayarlar", api.get("/api/workspace/bank/settings"))).values.similar.enabled === true, "Kaydetmeden Çık: ayar değişmedi");
    await openBank(admin);
    await tab(admin, "settings");
    await admin.waitForSelector(`${bankWin} [data-settings]`);
    ok(await admin.$eval(`${bankWin} [data-advanced]`, node => node.hidden), "yeniden açılışta Gelişmiş Ayarlar kapalı");
    await closeTop(admin);
  });

  await step("24g. GG2 (sihirbaz): doldurulmuş hesap formunda Bu Adımı Atla soru sorar; Kaydetmeden Atla hesap açmaz", async () => {
    await openBank(admin);
    await tab(admin, "accounts");
    const count = (await accountsNow()).length;
    await admin.click(`${bankWin} [data-act="wizard"]`);
    await admin.waitForSelector(`${wiz} [data-wiz-form]`);
    await admin.fill(`${wiz} [data-wiz-form] [name="bankName"]`, "Akbank");
    await admin.fill(`${wiz} [data-wiz-form] [name="name"]`, "Atlanacak Hesap");
    await admin.click(`${wiz} [data-wiz="skip"]`);
    await admin.waitForFunction(() => [...document.querySelectorAll(".hof-modal-backdrop.is-visible .hof-modal-title")].some(node => node.textContent.trim() === "Bu Adımı Atla"), null, { timeout: 8000 });
    await admin.click(`${top} [data-answer="no"]`);
    await admin.waitForTimeout(400);
    ok((await admin.$eval(`${wiz} [data-wiz-form] [name="name"]`, node => node.value)) === "Atlanacak Hesap", "Vazgeç: form ve yazılanlar duruyor");
    await admin.click(`${wiz} [data-wiz="skip"]`);
    await answerYes(admin);
    await admin.waitForSelector(`${wiz} [data-wiz-done], ${wiz} [data-wiz-preview], ${wiz} [data-wiz="transfer"]`, { timeout: 8000 });
    ok((await accountsNow()).length === count, "Kaydetmeden Atla: hesap açılmadı");
    await closeAll(admin);
  });

  await step("24h. GG2 (L4/L8): 390 px Hesabı Atanmamış Eski Hareketler yatay kaydırmasız; hesaba bağlanan cari havalesinde Açıklamayı Düzelt pasif ve nedeni", async () => {
    const party = await must("cari", api.post("/api/workspace/accounts", { name: "GG2 Havale Müşterisi", type: "customer", registeredOn: "2026-10-01" }));
    // Aşama 5: hesap tanımlıyken havale hesapsız yazılmaz. Hesabı atanmamış eski hareket, hiçbir hesap seçilemezken (hepsi pasif) yazılır —
    // eski sürümün yazdığı satır gibi; sonra hesaplar yeniden etkinleşir.
    const usable = (await must("hesaplar", api.get("/api/workspace/bank/accounts"))).accounts.filter(item => item.status === "active");
    for (const item of usable) await must("pasif", api.post(`/api/workspace/bank/accounts/${item.id}/status`, { status: "passive" }));
    await must("havale", api.post(`/api/workspace/accounts/${party.id}/entries`, { kind: "in", amount: "750", method: "bank", date: "2026-10-05", note: "Ekim tahsilatı" }));
    for (const item of usable) await must("etkin", api.post(`/api/workspace/bank/accounts/${item.id}/status`, { status: "active" }));
    const phone = await newPage({ width: 390, height: 844 });
    current = phone;
    await login(phone, "admin", PASS);
    await phone.evaluate(() => HOF.bank.open({ legacy: true }));
    await phone.waitForSelector(`${bankWin} [data-pick], ${bankWin} .hof-bank-table tbody tr`, { timeout: 15000 });
    await phone.waitForTimeout(500);
    const check = await noHorizontalScroll(phone);
    ok(check.page && check.dialog, `Hesabı Atanmamış Eski Hareketler 390 px'te yatay kaydırmasız ${JSON.stringify(check.wide)}`);
    await shot(phone, "gg2-mobil-eski-hareketler", { fullPage: true });
    await phone.context().close();
    current = admin;
    const legacy = await must("eski", api.get("/api/workspace/bank/legacy"));
    const row = legacy.rows.find(item => item.partyName === "GG2 Havale Müşterisi");
    await must("ata", api.post("/api/workspace/bank/legacy/assign", { accountId: ZIRAAT.id, rows: [{ table: row.table, id: row.id }] }));
    await openBank(admin);
    await tab(admin, "movements");
    await admin.waitForSelector(`${bankWin} [data-moves]`);
    await selectMovesAccount(admin, ZIRAAT.id);
    await openEventFromList(admin, item => item.text.includes("GG2 Havale Müşterisi"));
    const why = await textOf(admin, `${bankWin} [data-bank-event-blocks]`);
    ok(await admin.$eval(`${bankWin} [data-act="ev-info"]`, node => node.disabled) && has(why, "Açıklamayı Düzelt") && has(why, "Açıklaması da orada değiştirilir"), `cari havalesinde Açıklamayı Düzelt pasif: ${why}`);
    await shot(admin, "gg2-modul-hareketi-aciklama-pasif");
    await closeAll(admin);
  });

  await step("24i. GG2 (L10): KDV Özeti Rapor Merkezi ekranından: İndirilecek KDV (191) = Ana Defter 191 = model", async () => {
    await admin.click('#hof-sidecard [data-action="analytics"]');
    await admin.waitForSelector(`${modal} .hof-rep-tab[data-tab="all"]`, { timeout: 15000 });
    await admin.click(`${modal} .hof-rep-tab[data-tab="all"]`);
    await admin.waitForSelector(`${modal} [data-rc-list] [data-report="kdv-ozeti"]`, { timeout: 15000 });
    await admin.click(`${modal} [data-rc-list] [data-report="kdv-ozeti"]`);
    await admin.waitForSelector(`${modal} [data-rc-main] .hof-rc-summary`, { timeout: 15000 });
    await admin.waitForTimeout(600);
    const cards = await admin.$$eval(`${modal} [data-rc-main] .hof-rc-summary span`, spans => Object.fromEntries(spans.map(span => [span.querySelector("small")?.innerText.trim(), span.querySelector("b")?.innerText.trim()])));
    const shown = cards["İndirilecek KDV (191)"] || "";
    const t = await trial();
    ok(shown && shown.includes(HOF_MONEY(model.get("191"))) && t["191"] === model.get("191"), `ekranda İndirilecek KDV ${shown} = Ana Defter 191 ${(t["191"] || 0) / 100} = model ${model.get("191") / 100}`);
    await shot(admin, "gg2-kdv-ozeti-ekran");
    await closeAll(admin);
  });

  // ---------- Bölüm 3 (Aşama 5–6, daraltılmış: Cari ve Kasa formlarında hesap seçimi; §12.5 kabul 5–14) ----------
  // Ayrı ve boş "Kabul Şirketi" (003; plan §12.5 ön koşulu: boş şirket, sahte saat 08.10.2026): kabul 1–4 hesapları (ekranı bölüm 1'de
  // sınandı) ve Ürün A 10 Adet (parasız açılış) API'den; kabul 5–14 EKRANDAN. Bağımsız beklenen: plan tablosundaki sayılar.
  let kabul = null;
  const kabulBalance = async name => (await must("hesaplar", api.get("/api/workspace/bank/accounts"))).accounts.find(item => item.bankName === name)?.balanceMinor / 100;
  await step("26. Kabul Şirketi: boş şirket, Ziraat 100.000 + Garanti 50.000 (Bakiye Doğrulandı), Ürün A 10 Adet", async () => {
    current = admin;
    await closeAll(admin);
    const created = await must("şirket", api.post("/api/companies", { name: "Kabul Şirketi" }));
    await admin.evaluate(async id => fetch("/api/companies/select", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }), created.company.id);
    await must("sihirbazı kapat", api.post("/api/workspace/bank/setup/dismiss", {}));
    const ziraat = await must("Ziraat", api.post("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: ZIRAAT_IBAN, opening: { date: "2026-10-01", amount: "100.000", confirmed: true } }));
    const garanti = await must("Garanti", api.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "Ana TL Hesabı", kind: "demand", currency: "TRY", iban: GARANTI_IBAN, opening: { date: "2026-10-01", amount: "50.000", confirmed: true } }));
    await must("Ürün A", api.post("/api/workspace/stock", { name: "Ürün A", unit: "Adet", unitPrice: "10.000", salePrice: "20.000", openingQty: "10", openingDate: "2026-10-01" }));
    kabul = { company: created.company, ziraat, garanti };
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForSelector("#hof-sidecard", { timeout: 30000 });
    await admin.waitForTimeout(800);
    const summary = await must("özet", api.get("/api/workspace/bank/summary"));
    ok(summary.realBank.minor === 15_000_000 && (await kabulBalance("Ziraat Bankası")) === 100000 && (await kabulBalance("Garanti BBVA")) === 50000, "kabul 1–4: Ziraat 100.000, Garanti 50.000, Gerçek Banka 150.000");
  });

  await step("27. Kabul 5: + Yeni Cari ABC Ltd. (Cari penceresinden)", async () => {
    await admin.click('#hof-sidecard [data-action="accounts"]');
    await admin.waitForSelector('.hof-accounts-modal [data-act="new"]', { timeout: 10000 });
    await admin.click('.hof-accounts-modal [data-act="new"]');
    await admin.waitForSelector(`${top} input[name="name"]`, { timeout: 8000 });
    await admin.fill(`${top} input[name="name"]`, "ABC Ltd.");
    await admin.click(`${top} .hof-form button[type="submit"]`);
    await admin.waitForFunction(() => [...document.querySelectorAll(".hof-accounts-modal")].some(node => node.textContent.includes("ABC Ltd.")), null, { timeout: 10000 });
    const list = await must("cariler", api.get("/api/workspace/accounts?status=all"));
    kabul.abc = list.accounts.find(item => item.name === "ABC Ltd.");
    ok(Boolean(kabul.abc) && list.accounts.length === 1, "ABC Ltd. ekrandan açıldı (tek cari)");
    await admin.waitForTimeout(700); // pencere açılış geçişi bitsin (ekran görüntüsü)
    await shot(admin, "kabul-5-yeni-cari");
    await closeAll(admin);
  });

  await step("28. Kabul 6–8: Satış Faturası Ürün A 1 Adet × 20.000 (KDV %20 dahil), ödeme açık — ekrandan; Ürün A 9, ABC borçlu 20.000, banka aynı", async () => {
    const inv = `${modal} .hof-invoices-modal`;
    await admin.click("#hof-sidecard [data-action=invoices]");
    await admin.waitForSelector(`${inv} [data-act="new"]`, { timeout: 10000 });
    await admin.click(`${inv} [data-act="new"]`);
    await admin.click(`${inv} [data-scenario="goods_sale"]`);
    await admin.waitForSelector(`${inv} [data-lines]`);
    await admin.fill(`${inv} [data-acc-query]`, "ABC");
    await admin.waitForSelector(`${inv} .hof-acc-picker li[data-id="${kabul.abc.id}"]`);
    await (await admin.$(`${inv} .hof-acc-picker li[data-id="${kabul.abc.id}"]`)).dispatchEvent("mousedown");
    await admin.click(`${inv} [data-l="0"][data-f="name"]`);
    await admin.keyboard.type("Ürün A", { delay: 40 });
    await admin.waitForSelector(`${inv} [data-hits="0"] li[data-item]`);
    await admin.click(`${inv} [data-hits="0"] li[data-item]`);
    if (!(await admin.$eval(`${inv} [data-f="pricesIncludeVat"]`, node => node.checked))) await admin.click(`${inv} [data-f="pricesIncludeVat"]`);
    await admin.click(`${inv} [data-l="0"][data-f="qty"]`);
    await admin.keyboard.press("Control+A");
    await admin.keyboard.type("1", { delay: 40 });
    await admin.click(`${inv} [data-l="0"][data-f="unitPrice"]`);
    await admin.keyboard.press("Control+A");
    await admin.keyboard.type("20000", { delay: 40 });
    await admin.selectOption(`${inv} [data-l="0"][data-f="vatRate"]`, "20").catch(() => null);
    await admin.waitForTimeout(1200);
    await shot(admin, "kabul-6-fatura-formu");
    await admin.click(`${inv} [data-act="issue"]`);
    let saved = null;
    for (let i = 0; i < 16 && !saved; i += 1) {
      await admin.waitForTimeout(500);
      const yes = await admin.$(`${modal} [data-answer="yes"]`);
      if (yes) {
        await yes.click();
        continue;
      }
      saved = (unwrap(await api.get("/api/workspace/invoices?tab=all&limit=20")).invoices || []).find(doc => doc.status === "issued") || null;
    }
    ok(Boolean(saved), "fatura kaydedildi");
    const doc = await must("fatura", api.get(`/api/workspace/invoices/${saved.id}`));
    kabul.invoice = doc;
    ok(doc.tryNet === 16666.67 && doc.tryVat === 3333.33 && doc.tryPayable === 20000, `kabul 6: Matrah ${doc.tryNet}, KDV ${doc.tryVat}, Toplam ${doc.tryPayable}`);
    const stock = (await must("stok", api.get("/api/workspace/stock"))).items.find(item => item.name === "Ürün A");
    const abc = await must("ABC", api.get(`/api/workspace/accounts/${kabul.abc.id}`));
    const summary = await must("özet", api.get("/api/workspace/bank/summary"));
    ok(stock.qty === 9 && abc.totals.balance === 20000 && summary.realBank.minor === 15_000_000, `kabul 7–8: Ürün A ${stock.qty}, ABC ${abc.totals.balance} borçlu, Gerçek Banka ${summary.realBank.minor / 100}`);
    await closeAll(admin);
  });

  await step("29. Kabul 9–12: cari kartından Tahsilat 20.000 Havale/EFT → Banka Hesabı seçici (iki hesap: zorunlu; Nakit'te gizli); boş seçim kaydedilmez; Ziraat → Ziraat 120.000, ABC 0, fatura Ödendi", async () => {
    await admin.click('#hof-sidecard [data-action="accounts"]');
    await admin.waitForSelector(`.hof-accounts-modal tr[data-account="${kabul.abc.id}"]`, { timeout: 10000 });
    await admin.click(`.hof-accounts-modal tr[data-account="${kabul.abc.id}"]`);
    await admin.waitForSelector('.hof-accounts-modal [data-entry="in"]', { timeout: 10000 });
    await admin.click('.hof-accounts-modal [data-entry="in"]');
    const form = `${top} .hof-form`;
    await admin.waitForSelector(`${form} input[name="amount"]`, { timeout: 8000 });
    ok(!(await admin.$(`${form} [data-bank-pick]:not([hidden])`)), "Nakit seçiliyken Banka Hesabı alanı görünmez");
    await admin.fill(`${form} input[name="amount"]`, "20.000");
    await admin.selectOption(`${form} select[name="method"]`, "bank");
    await admin.waitForSelector(`${form} [data-bank-pick]:not([hidden]) select[name="bankAccountId"]`, { timeout: 8000 });
    const options = await admin.$$eval(`${form} select[name="bankAccountId"] option`, nodes => nodes.map(node => node.textContent.trim()));
    ok(options.length === 3 && options[0] === "Hesap Seçin" && options.some(text => text.startsWith("Ziraat Bankası · Ana TL Hesabı")) && options.some(text => text.startsWith("Garanti BBVA · Ana TL Hesabı")), `Havale/EFT'de Banka Hesabı seçici: ${options.join(" | ")}`);
    await auditLabels(admin, "cari tahsilat formu (havale)");
    // Nasıl bozarım: hesap boş bırakılır → kaydedilmez.
    await admin.selectOption(`${form} select[name="bankAccountId"]`, "");
    await admin.click(`${form} button[type="submit"]`);
    await admin.waitForTimeout(500);
    const error = await textOf(admin, `${form} .hof-form-error`);
    const written = (await must("ABC", api.get(`/api/workspace/accounts/${kabul.abc.id}`))).entries.filter(entry => entry.kind === "in").length;
    ok(has(error, "Banka Hesabı") && written === 0, `hesap seçilmeden kaydedilmedi: “${error}”`);
    await admin.selectOption(`${form} select[name="bankAccountId"]`, kabul.ziraat.id);
    await admin.waitForTimeout(700); // pencere açılış geçişi bitsin (ekran görüntüsü)
    await shot(admin, "kabul-9-tahsilat-havale-ziraat");
    await admin.click(`${form} button[type="submit"]`);
    await admin.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible input[name="amount"]'), null, { timeout: 10000 });
    await admin.waitForTimeout(600);
    const abc = await must("ABC", api.get(`/api/workspace/accounts/${kabul.abc.id}`));
    const entry = abc.entries.find(item => item.kind === "in");
    const doc = await must("fatura", api.get(`/api/workspace/invoices/${kabul.invoice.id}`));
    ok(entry?.method === "bank" && entry?.finRef === kabul.ziraat.id, "tahsilat Ziraat hesabına bağlı (fin_ref)");
    ok((await kabulBalance("Ziraat Bankası")) === 120000 && (await kabulBalance("Garanti BBVA")) === 50000 && abc.totals.balance === 0 && doc.payState === "paid", `kabul 9–12: Ziraat ${await kabulBalance("Ziraat Bankası")}, Garanti ${await kabulBalance("Garanti BBVA")}, ABC ${abc.totals.balance}, fatura ${doc.payState}`);
    ok((await must("Kasa", api.get("/api/workspace/cash"))).byMethod.cash === 0, "Kasa 0 (havale Kasa'ya düşmedi)");
    await shot(admin, "kabul-12-abc-sifir");
    await closeAll(admin);
  });

  await step("30. Kabul 13–14: Kasa → Bankadan Kasaya Aktar 10.000 (Ziraat; çift tıklama tek kayıt) → Ziraat 110.000, Kasa 10.000; Kasa'da yalnız nakit satırı; Banka'da Kasa ile Banka Arası", async () => {
    await admin.evaluate(() => HOF.workspace.openCash());
    await admin.waitForSelector(`${modal} [data-transfer="to-cash"]`, { timeout: 10000 });
    await admin.click(`${modal} [data-transfer="to-cash"]`);
    const form = `${top} .hof-form`;
    await admin.waitForSelector(`${form} select[name="bankAccountId"]`, { timeout: 8000 });
    await admin.fill(`${form} input[name="amount"]`, "10.000");
    await admin.selectOption(`${form} select[name="bankAccountId"]`, kabul.ziraat.id);
    await auditLabels(admin, "Bankadan Kasaya Aktar formu");
    await admin.waitForTimeout(700); // pencere açılış geçişi bitsin (ekran görüntüsü)
    await shot(admin, "kabul-13-bankadan-kasaya");
    await admin.dblclick(`${form} button[type="submit"]`);
    await admin.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible select[name="bankAccountId"]'), null, { timeout: 10000 });
    await admin.waitForTimeout(900);
    const cash = await must("Kasa", api.get("/api/workspace/cash"));
    ok(cash.entries.length === 1 && cash.entries.every(entry => entry.method === "cash") && cash.byMethod.cash === 10000, `çift tıklama tek transfer; Kasa penceresinde yalnız nakit satırı (${cash.entries.length}), Kasa ${cash.byMethod.cash}`);
    ok((await kabulBalance("Ziraat Bankası")) === 110000 && (await kabulBalance("Garanti BBVA")) === 50000, `kabul 13–14: Ziraat ${await kabulBalance("Ziraat Bankası")}, Garanti 50.000`);
    const rows = (await admin.$$eval(`${modal} [data-list] tbody tr`, nodes => nodes.map(node => node.textContent.replace(/\s+/g, " ").trim()))).filter(text => !text.startsWith("Devreden Kasa"));
    const kpis = await textOf(admin, `${modal} [data-kpis]`);
    ok(rows.length === 1 && has(rows[0], "Bankadan kasaya aktarım") && has(kpis, "10.000,00"), `Kasa penceresi: tek nakit satırı (“${rows[0] || ""}”), Nakit Kasa 10.000 (${kpis})`);
    const overview = await must("ANLIK DURUM", api.get("/api/workspace/overview"));
    ok((overview.cash?.cash?.today?.in ?? overview.cash?.today?.in) === 10000, "Kasa Bugün Giriş 10.000 (nakit bacağı)");
    await shot(admin, "kabul-14-kasa-yalniz-nakit");
    await closeAll(admin);
    await openBank(admin);
    await tab(admin, "movements");
    await admin.waitForSelector(`${bankWin} [data-moves]`);
    const moves = await textOf(admin, `${bankWin} [data-moves]`);
    ok(has(moves, "Kasa ile Banka Arası") && has(moves, "10.000,00"), "Banka → Hareketler'de transfer “Kasa ile Banka Arası” satırında");
    await shot(admin, "kabul-14-banka-hareketler-transfer");
    await closeAll(admin);
  });

  await step("31. Nasıl bozarım (ekrandan): Garanti'den 60.000 aktar → Eksi Bakiye sorusu; Vazgeç yazmaz; mutabakat ok", async () => {
    await admin.evaluate(() => HOF.workspace.openCash());
    await admin.waitForSelector(`${modal} [data-transfer="to-cash"]`, { timeout: 10000 });
    await admin.click(`${modal} [data-transfer="to-cash"]`);
    const form = `${top} .hof-form`;
    await admin.waitForSelector(`${form} select[name="bankAccountId"]`, { timeout: 8000 });
    await admin.fill(`${form} input[name="amount"]`, "60.000");
    await admin.selectOption(`${form} select[name="bankAccountId"]`, kabul.garanti.id);
    await admin.click(`${form} button[type="submit"]`);
    await admin.waitForSelector(`${top} [data-answer]`, { timeout: 8000 });
    const question = await textOf(admin, top);
    ok(has(question, "Eksi Bakiye") && has(question, "Garanti BBVA · Ana TL Hesabı hesabında 50.000,00 TL var"), `Eksi Bakiye sorusu: ${question.slice(0, 160)}`);
    await admin.waitForTimeout(700); // pencere açılış geçişi bitsin (ekran görüntüsü)
    await shot(admin, "nasil-bozarim-eksi-bakiye-sorusu");
    await admin.click(`${top} [data-answer="no"]`);
    await admin.waitForTimeout(600);
    const error = await textOf(admin, `${form} .hof-form-error`);
    ok(has(error, "Kaydedilmedi") && (await kabulBalance("Garanti BBVA")) === 50000 && (await must("Kasa", api.get("/api/workspace/cash"))).byMethod.cash === 10000, `Vazgeç: yazılmadı (${error})`);
    await closeAll(admin);
    const integrity = await must("Mutabakat Testi", api.get("/api/workspace/ledger/integrity"));
    ok(integrity.ok === true, "Kabul Şirketi'nde mutabakat ok");
    const firstCompany = (await must("şirketler", api.get("/api/companies"))).companies.find(company => company.code === "001");
    await admin.evaluate(async id => fetch("/api/companies/select", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) }), firstCompany.id);
    await admin.goto(`${BASE}/`, { waitUntil: "load" });
    await admin.waitForSelector("#hof-sidecard", { timeout: 30000 });
    await admin.waitForTimeout(700);
  });

  await step("25. Kalemle ad (side.bank) ve yazım düzeni", async () => {
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
