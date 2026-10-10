// Kullanım kılavuzunun Banka bölümü ekran görüntüleri (ve Banka'yla değişen k08 Kasa, k10 ANLIK DURUM): sıfırdan kurulan geçici bir
// sunucuda, sahte saatle (08.10.2026 Perşembe 12:00; sunucu config.now + tarayıcı saati aynı gün). Örnek şirket verisi uydurmadır;
// müşteri verisi kullanılmaz. Her adım ekrandan yapılır (sihirbaz, masraf, transfer, cari tahsilatı, Kasa ile Banka Arası); yalnız
// başlangıç kayıtları (cari, eski havale, nakit tahsilat) API'den girilir.
// Kullanım: node docs/kilavuz/ekran-banka.mjs [çıktı klasörü] [yalnız-bunlar,virgülle]
// EKRAN_METIN=<dosya.json> verilirse her ekranın görünen metni (düğme, sekme, alan, seçenek adları) o dosyaya yazılır: kılavuzdaki adlar
// bu metinlerle birebir karşılaştırılır (docs/kilavuz/metin-denetle.mjs).
// Sonra: node docs/kilavuz/pdf-uret.mjs docs/kilavuz DestekOfis-Kullanim-Kilavuzu && cp docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf client/kilavuz/
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const R = path.resolve(HERE, "..", "..");
const S = path.join(HERE, "ornek");
const { chromium } = createRequire(`${R}/`)("playwright");
const { createApp } = await import(`${R}/server/app.mjs`);
const { installPageClock } = await import(`${R}/test/helpers.mjs`);
const OUT = process.argv[2] || `${R}/docs/kilavuz/ekran`;
const ONLY = process.argv[3] ? new Set(process.argv[3].split(",")) : null;
mkdirSync(OUT, { recursive: true });
const root = mkdtempSync(path.join(tmpdir(), "kilavuz-banka-"));
const PASS = "Kilavuz-Admin-2026";
const NOW = "2026-10-08T12:00:00+03:00";
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "b"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "7f3a91c24be05d6e8a1b2c3d4e5f6072" } });
const { port } = await app.listen(0, "127.0.0.1");
const base = `http://127.0.0.1:${port}`;
// LANG: tarih kutuları Türkçe biçimde (gg.aa.yyyy) görünsün.
const browser = await chromium.launch({ args: ["--lang=tr-TR"], env: { ...process.env, LANG: "tr_TR.UTF-8", LANGUAGE: "tr", LC_ALL: "tr_TR.UTF-8" } });
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR", timezoneId: "Europe/Istanbul", deviceScaleFactor: 1.5 });
await ctx.addInitScript(() => { const st = document.createElement("style"); st.textContent = "#hof-license-bar,.hof-license-notice{display:none!important}"; document.addEventListener("DOMContentLoaded", () => document.head.appendChild(st)); });
const page = await ctx.newPage();
await installPageClock(page, app.config.now);
const errors = [];
const failed = [];
const checks = [];
page.on("pageerror", e => errors.push(e.message));

/** Geçerli Türkiye IBAN'ı (mod 97); örnek hesap numaraları uydurmadır. */
function trIban(bankCode, account) {
  const bban = `${String(bankCode).padStart(5, "0")}0${String(account).padStart(16, "0")}`;
  let rest = 0;
  for (const digit of `${bban}292700`) rest = (rest * 10 + Number(digit)) % 97;
  return `TR${String(98 - rest).padStart(2, "0")}${bban}`;
}
const ZIRAAT_IBAN = trIban(10, 1234567);
const GARANTI_IBAN = trIban(62, 7654321);
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const bankWin = ".hof-bank-modal";
const wiz = ".hof-bank-wiz-modal";
const want = name => !ONLY || ONLY.has(name);
let shots = 0;
const shot = async (name, options = {}) => { if (!want(name)) return; await page.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 84, ...options }); shots += 1; console.log("✓", name); };
const quiet = () => page.evaluate(() => document.querySelectorAll(".hof-toast, .hof-notice").forEach(n => n.remove()));
const box = async selector => page.$eval(selector, n => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
const topBox = async () => page.$$eval(".hof-modal-backdrop.is-visible .hof-modal", list => { const r = list.at(-1).getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
const pad = (r, p = 4) => ({ x: Math.max(0, r.x - p), y: Math.max(0, r.y - p), width: r.width + 2 * p, height: r.height + 2 * p });
const api = (url, body, method = body ? "POST" : "GET") => page.evaluate(async ([url, body, method]) => { const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined }); return { status: r.status, ...(await r.json().catch(() => ({}))) }; }, [url, body, method]);
const data = r => (r && typeof r.data === "object" && r.data ? r.data : r);
const textOf = selector => page.$eval(selector, node => node.textContent.replace(/\s+/g, " ").trim()).catch(() => "");
const closeTop = async () => { await page.keyboard.press("Escape"); await page.waitForTimeout(350); };
const closeAll = async () => { for (let i = 0; i < 5 && await page.$(modal); i += 1) await closeTop(); };
// Ekranın görünen metni + açılır liste seçenekleri + düğmelerin title'ı (pasif düğme nedeni) — kılavuzdaki adlar bunlarla karşılaştırılır.
const texts = {};
const grab = async (name, selector = top) => {
  const value = await page.$$eval(selector, list => list.map(n => [n.innerText, ...[...n.querySelectorAll("option")].map(o => o.textContent), ...[...n.querySelectorAll("[title]")].map(o => o.getAttribute("title"))].join("\n")).join("\n")).catch(() => "");
  texts[name] = (texts[name] ? `${texts[name]}\n` : "") + value;
};
const check = (cond, what) => { checks.push(`${cond ? "✓" : "✗"} ${what}`); if (!cond) failed.push(`denetim: ${what}`); };
const step = async (name, fn) => { try { await fn(); } catch (error) { failed.push(`${name}: ${error.message.split("\n")[0]}`); console.log("✗", name, error.message.split("\n")[0]); await page.screenshot({ path: path.join(tmpdir(), `kilavuz-banka-hata-${name}.png`) }).catch(() => {}); await closeAll().catch(() => {}); } };
const openBank = async () => {
  await page.click('#hof-sidecard [data-action="bank"]');
  await page.waitForSelector(`${bankWin} [data-bank] .hof-bank-tabs`, { timeout: 15000 });
  await page.waitForTimeout(600);
};
const tab = async id => { await page.click(`${bankWin} .hof-bank-tabs [data-tab="${id}"]`); await page.waitForTimeout(800); };
const fillVoucher = async values => {
  for (const [name, value] of Object.entries(values)) {
    const selector = `form.hof-bank-voucher [name="${name}"]`;
    const tag = await page.$eval(selector, node => node.tagName.toLowerCase());
    if (tag === "select") await page.selectOption(selector, String(value));
    else await page.fill(selector, String(value));
  }
  await page.waitForTimeout(300);
};
const saveVoucher = async () => {
  await page.click('form.hof-bank-voucher button[type="submit"]');
  await page.waitForSelector("form.hof-bank-voucher", { state: "detached", timeout: 10000 });
  await page.waitForTimeout(700);
};
const accountsNow = async () => data(await api("/api/workspace/bank/accounts?status=all")).accounts;

// 1) Giriş ve tablo (ANLIK DURUM ana ekranda, tablonun başında)
await page.goto(`${base}/`);
await page.waitForSelector("#hof-auth input[name=username]");
await page.fill("#hof-auth input[name=username]", "admin");
await page.fill("#hof-auth input[name=password]", PASS);
await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
await page.waitForSelector("#hof-start .hof-drop");
await (await page.$("#hof-start .hof-drop input[type=file]")).setInputFiles(`${S}/okul-servisi.xlsx`);
await page.waitForSelector(`${modal} .hof-mapping`, { timeout: 30000 }).catch(() => {});
if (await page.$(`${modal} [data-mode="replace"]`)) await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click(`${modal} [data-mode="replace"]`)]);
await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 30000 });
await page.click(".hof-analysis-result [data-apply]");
await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop"), null, { timeout: 8000 });
await page.waitForTimeout(1200);
check((await page.evaluate(() => window.HOF.localToday())) === "2026-10-08", "tarayıcı sahte günde (08.10.2026)");

// 2) Başlangıç kayıtları: cari ve banka hesabı açılmadan girilmiş eski havaleler (Hesabı Atanmamış Eski Hareketler).
const koleji = data(await api("/api/workspace/accounts", { name: "Yıldız Koleji", type: "customer", registeredOn: "2026-09-01", phone: "0332 555 10 20" }));
const akaryakit = data(await api("/api/workspace/accounts", { name: "Öz Akaryakıt Ltd.", type: "supplier", registeredOn: "2026-09-01", phone: "0212 555 10 20" }));
await api(`/api/workspace/accounts/${akaryakit.id}/entries`, { kind: "credit", amount: "6.000", date: "2026-09-15", description: "Eylül akaryakıt" });
await api(`/api/workspace/accounts/${koleji.id}/entries`, { kind: "debt", amount: "24.000", date: "2026-09-01", description: "2026-2027 servis ücreti" });
await api(`/api/workspace/accounts/${koleji.id}/entries`, { kind: "in", amount: "5.000", method: "bank", date: "2026-09-20", description: "Eylül servis ücreti" });
await api(`/api/workspace/accounts/${koleji.id}/entries`, { kind: "in", amount: "2.500", method: "bank", date: "2026-10-03", description: "Gezi servisi" });
await api("/api/workspace/cash", { kind: "in", amount: "8.000", date: "2026-10-08", description: "Veli ödemeleri (elden)" });
// Tarihi gelmemiş eski hareket (eski sürümlerde ileri tarih yazılabiliyordu): sunucu saati bir an 20.10.2026'ya alınıp hesap tanımlanmadan
// havale tahsilatı girilir, sonra saat 08.10.2026'ya döner. Banka'da "Tarihi Gelince Atanabilir" olarak görünür.
app.config.now.set("2026-10-20T12:00:00+03:00");
const ahead = await api(`/api/workspace/accounts/${koleji.id}/entries`, { kind: "in", amount: "1.500", method: "bank", date: "2026-10-20", description: "Kasım servis ücreti (ileri tarihli)" });
app.config.now.set(NOW);
check(ahead.status === 200 && (await page.evaluate(() => window.HOF.localToday())) === "2026-10-08", `ileri tarihli eski havale yazıldı (${ahead.status}), saat yeniden 08.10.2026`);

// 3) Kurulum Sihirbazı: Banka'yı ilk açışta gelir; eski havale olduğu için 3 adım.
await step("sihirbaz", async () => {
  await page.click('#hof-sidecard [data-action="bank"]');
  await page.waitForSelector(`${wiz} [data-wiz-form]`, { timeout: 15000 });
  // Sihirbaz kapatılırsa Genel Bakış'ta "Kurulumu Tamamla" kalır; oradan yeniden açılır.
  await page.click(`${wiz} .hof-modal-close`);
  await page.waitForSelector(`${bankWin} [data-bank-setup] [data-act="wizard"]`, { timeout: 10000 });
  await page.waitForTimeout(500);
  await grab("genel-bakis-kurulumsuz", bankWin);
  check((await textOf(`${bankWin} [data-bank-setup]`)).includes("Kurulumu Tamamla"), "sihirbaz kapatılınca Genel Bakış'ta Kurulumu Tamamla");
  await page.click(`${bankWin} [data-bank-setup] [data-act="wizard"]`);
  await page.waitForSelector(`${wiz} [data-wiz-form]`, { timeout: 15000 });
  const steps = await page.$$eval(`${wiz} .hof-bank-steps li`, list => list.map(node => node.textContent.replace(/\s+/g, " ").trim()));
  check(steps.length === 3 && steps[1].includes("Eski Hareketleri Aktar"), `sihirbaz adımları: ${steps.join(" › ")}`);
  const form = `${wiz} [data-wiz-form]`;
  const fill = async ({ bank, name, iban, amount }) => {
    await page.fill(`${form} [name="bankName"]`, bank);
    await page.fill(`${form} [name="name"]`, name);
    await page.fill(`${form} [name="iban"]`, iban);
    await page.fill(`${form} [name="openingDate"]`, "2026-10-01");
    await page.fill(`${form} [name="openingAmount"]`, amount);
    await page.check(`${form} [name="confirmed"]`);
  };
  await fill({ bank: "Ziraat Bankası", name: "Ana TL Hesabı", iban: ZIRAAT_IBAN.replace(/(.{4})/g, "$1 ").trim(), amount: "100.000" });
  await page.waitForTimeout(400);
  await quiet();
  await shot("k28-banka-sihirbaz", { clip: pad(await topBox()) });
  await grab("sihirbaz-1", wiz);
  const labels = await page.$$eval(`${wiz} button`, list => list.map(node => node.textContent.trim()).filter(Boolean));
  check(["Bu Adımı Atla", "Kaydet ve Yeni Hesap Ekle", "Kaydet ve İlerle"].every(label => labels.includes(label)), `sihirbaz düğmeleri: ${labels.join(" | ")}`);
  await page.click(`${wiz} [data-wiz="save-more"]`);
  await page.waitForSelector(`${wiz} [data-wiz-saved] li`, { timeout: 8000 });
  await fill({ bank: "Garanti BBVA", name: "Ana TL Hesabı", iban: GARANTI_IBAN, amount: "50.000" });
  await page.click(`${wiz} [data-wiz="save-next"]`);
  await page.waitForSelector(`${wiz} [data-wiz-preview]`, { timeout: 10000 });
  await page.waitForTimeout(500);
  await quiet();
  await shot("k29-banka-eski-hareketler", { clip: pad(await topBox()) });
  await grab("sihirbaz-2", wiz);
  check((await textOf(wiz)).includes("Tarihi Gelmemiş"), "sihirbaz önizlemesinde tarihi gelmemiş satır");
  const legacyLabels = await page.$$eval(`${wiz} label`, list => list.map(node => node.textContent.replace(/\s+/g, " ").trim()));
  check(legacyLabels.some(text => text.includes("Devir Kapanışı")), "eski hareketler adımında Devir Kapanışı kutusu");
  await page.click(`${wiz} [data-wiz="transfer"]`);
  await page.waitForSelector(`${wiz} [data-wiz-done]`, { timeout: 10000 });
  check((await textOf(`${wiz} [data-wiz-done]`)).includes("Kurulum Tamamlandı"), "Kurulum Tamamlandı");
  await grab("sihirbaz-3", wiz);
  await page.click(`${wiz} [data-wiz="finish"]`);
  await page.waitForTimeout(900);
});
const accounts = await accountsNow();
const ZIRAAT = accounts.find(account => account.bankName === "Ziraat Bankası");
const GARANTI = accounts.find(account => account.bankName === "Garanti BBVA");
check(ZIRAAT?.balanceMinor === 10_250_000 && GARANTI?.balanceMinor === 5_000_000, `Ziraat 102.500 (100.000 + 03.10 havalesi 2.500), Garanti 50.000 (${ZIRAAT?.balanceMinor / 100}, ${GARANTI?.balanceMinor / 100})`);

// 3b) Hesabı Atanmamış Eski Hareketler: sihirbazdan sonra yalnız tarihi gelmemiş havale kalır (Tarihi Gelince Atanabilir).
await step("eski-hareketler", async () => {
  if (!(await page.$(`${bankWin} [data-bank] .hof-bank-tabs`))) await openBank();
  await tab("overview");
  await page.waitForSelector(`${bankWin} [data-bank-unassigned]`, { timeout: 10000 });
  await grab("genel-bakis-ilk", bankWin);
  await page.click(`${bankWin} [data-bank-unassigned] [data-act="legacy"]`);
  await page.waitForSelector(`${bankWin} [data-legacy-future]`, { timeout: 10000 });
  await page.waitForTimeout(600);
  await quiet();
  const text = await textOf(bankWin);
  check(text.includes("Tarihi Gelince Atanabilir") && text.includes("Seçilenleri Bu Hesaba Ata"), "Hesabı Atanmamış: Tarihi Gelince Atanabilir + Seçilenleri Bu Hesaba Ata");
  await grab("hesabi-atanmamis", bankWin);
  await shot("k37-banka-hesabi-atanmamis", { clip: pad(await topBox()) });
  await closeAll();
});

// 4) Banka Masrafı (BSMV Dahil) ekrandan.
await step("masraf", async () => {
  if (!(await page.$(`${bankWin} [data-bank] .hof-bank-tabs`))) await openBank();
  await tab("movements");
  await page.click(`${bankWin} [data-act="v-fee"]`);
  await page.waitForSelector('form.hof-bank-voucher [name="amount"]', { timeout: 8000 });
  await fillVoucher({ accountId: ZIRAAT.id, feeType: "eft", amount: "10,50", description: "EFT ücreti" });
  await page.waitForTimeout(400);
  await quiet();
  check((await textOf("form.hof-bank-voucher [data-voucher-preview]")).includes("BSMV"), `masraf önizlemesi: ${await textOf("form.hof-bank-voucher [data-voucher-preview]")}`);
  await shot("k31-banka-masraf", { clip: pad(await topBox()) });
  await grab("masraf");
  await saveVoucher();
  // + Faiz formunun adları (kaydedilmez).
  await page.click(`${bankWin} [data-act="v-interest"]`);
  await page.waitForSelector('form.hof-bank-voucher [name="amount"]', { timeout: 8000 });
  await page.waitForTimeout(300);
  await grab("faiz");
  await closeTop();
});

// 5) Bankalar Arası Transfer (ücretli) ekrandan; sonra İşlem Kartı.
await step("transfer", async () => {
  await tab("movements");
  await page.click(`${bankWin} [data-act="v-transfer"]`);
  await page.waitForSelector('form.hof-bank-voucher select[name="toAccountId"]', { timeout: 10000 });
  await page.waitForTimeout(300);
  await fillVoucher({ accountId: ZIRAAT.id });
  await fillVoucher({ toAccountId: GARANTI.id, amount: "20.000", channel: "eft", feeAmount: "5" });
  await fillVoucher({ feeTax: "bsmv_excl", feeType: "eft", description: "Garanti'ye aktarım" });
  await page.waitForTimeout(400);
  await quiet();
  check((await textOf("form.hof-bank-voucher [data-voucher-preview]")).includes("Gönderenden Çıkan"), `transfer önizlemesi: ${await textOf("form.hof-bank-voucher [data-voucher-preview]")}`);
  await shot("k32-banka-transfer", { clip: pad(await topBox()) });
  await grab("transfer");
  await saveVoucher();
  await tab("movements");
  await page.waitForSelector(`${bankWin} .hof-bank-moves tbody tr[data-event]`, { timeout: 10000 });
  const row = await page.$$eval(`${bankWin} .hof-bank-moves tbody tr[data-event]`, list => list.find(node => node.dataset.type === "transfer")?.dataset.event || "");
  await page.click(`${bankWin} .hof-bank-moves tbody tr[data-event="${row}"]`);
  await page.waitForSelector(`${bankWin} [data-bank-event] [data-event-no]`, { timeout: 10000 });
  await page.waitForTimeout(500);
  await quiet();
  const buttons = await page.$$eval(`${bankWin} [data-bank-event] button`, list => list.map(node => node.textContent.trim()));
  check(["Ters Kaydet", "Düzelt"].every(label => buttons.includes(label)), `İşlem Kartı düğmeleri: ${buttons.join(" | ")}`);
  await shot("k33-banka-islem-karti", { clip: pad(await topBox()) });
  await grab("islem-karti", bankWin);
  await tab("movements");
  await grab("hareketler", bankWin);
  await closeAll();
});

// 6) Cari kartından havale tahsilatı: Havale / EFT seçilince Banka Hesabı alanı (iki hesap: seçim zorunlu).
await step("cari-tahsilat", async () => {
  await page.click('#hof-sidecard [data-action="accounts"]');
  await page.waitForSelector(`.hof-accounts-modal tr[data-account="${koleji.id}"]`, { timeout: 10000 });
  await page.click(`.hof-accounts-modal tr[data-account="${koleji.id}"]`);
  await page.waitForSelector('.hof-accounts-modal [data-entry="in"]', { timeout: 10000 });
  await page.click('.hof-accounts-modal [data-entry="in"]');
  const form = `${top} .hof-form`;
  await page.waitForSelector(`${form} input[name="amount"]`, { timeout: 8000 });
  check(!(await page.$(`${form} [data-bank-pick]:not([hidden])`)), "Nakit seçiliyken Banka Hesabı alanı yok");
  await page.fill(`${form} input[name="amount"]`, "3.000");
  await page.selectOption(`${form} select[name="method"]`, "bank");
  await page.waitForSelector(`${form} [data-bank-pick]:not([hidden]) select[name="bankAccountId"]`, { timeout: 8000 });
  const options = await page.$$eval(`${form} select[name="bankAccountId"] option`, nodes => nodes.map(node => node.textContent.trim()));
  check(options[0] === "Hesap Seçin" && options.length === 3, `Banka Hesabı seçenekleri: ${options.join(" | ")}`);
  await page.selectOption(`${form} select[name="bankAccountId"]`, ZIRAAT.id);
  await page.waitForTimeout(700);
  await quiet();
  await shot("k34-banka-hesap-secimi", { clip: pad(await topBox()) });
  await grab("cari-tahsilat");
  await page.click(`${form} button[type="submit"]`);
  await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible input[name="amount"]'), null, { timeout: 10000 });
  await page.waitForTimeout(600);
  await closeAll();
});

// 7) Kasa: Kasadan Bankaya Yatır (Garanti) ekrandan; Kasa penceresi (yalnız nakit).
await step("kasa", async () => {
  await page.evaluate(() => window.HOF.workspace.openCash());
  await page.waitForSelector(`${modal} [data-transfer="to-bank"]`, { timeout: 10000 });
  await page.click(`${modal} [data-transfer="to-bank"]`);
  const form = `${top} .hof-form`;
  await page.waitForSelector(`${form} select[name="bankAccountId"]`, { timeout: 8000 });
  await page.fill(`${form} input[name="amount"]`, "3.000");
  await page.fill(`${form} input[name="description"]`, "Günlük hasılat bankaya");
  await page.selectOption(`${form} select[name="bankAccountId"]`, GARANTI.id);
  await page.click(`${form} button[type="submit"]`);
  await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible select[name="bankAccountId"]'), null, { timeout: 10000 });
  await page.waitForTimeout(1200);
  await quiet();
  const labels = await page.$$eval(`${modal} .hof-cash-add button`, list => list.map(node => node.textContent.trim()));
  check(labels.includes("Bankadan Kasaya Aktar") && labels.includes("Kasadan Bankaya Yatır"), `Kasa düğmeleri: ${labels.join(" | ")}`);
  await shot("k08-kasa", { clip: pad(await topBox()) });
  await grab("kasa", modal);
  // Nasıl çalışır: Garanti'de olmayan parayı çekmek → Eksi Bakiye sorusu; Vazgeç → yazılmaz.
  await page.click(`${modal} [data-transfer="to-cash"]`);
  await page.waitForSelector(`${form} select[name="bankAccountId"]`, { timeout: 8000 });
  await page.fill(`${form} input[name="amount"]`, "80.000");
  await page.selectOption(`${form} select[name="bankAccountId"]`, GARANTI.id);
  await page.click(`${form} button[type="submit"]`);
  await page.waitForSelector(`${top} [data-answer]`, { timeout: 8000 });
  await page.waitForTimeout(700);
  await quiet();
  const question = await textOf(top);
  check(question.includes("Eksi Bakiye") && question.includes("Yine de"), `Eksi Bakiye sorusu: ${question.slice(0, 160)}`);
  const answers = await page.$$eval(`${top} [data-answer]`, list => list.map(node => node.textContent.trim()));
  check(answers.includes("Vazgeç"), `soru düğmeleri: ${answers.join(" | ")}`);
  await shot("k35-banka-eksi-bakiye", { clip: pad(await topBox()) });
  await grab("eksi-bakiye");
  await page.click(`${top} [data-answer="no"]`);
  await page.waitForTimeout(600);
  await closeAll();
});

// 7b) Kurumsal Kredi Kartı: hesap ekrandan açılır (Kart Limiti, Ekstre Kesim Günü, Son Ödeme Günü); carinin − Ödeme formunda "Kredi Kartı"
// seçilince Kurumsal Kart; limit aşılınca Eksi Bakiye sorusu; Hesap Detayı'ndan Kart Borcu Ödemesi.
let KART = null;
await step("kart", async () => {
  await openBank();
  await tab("accounts");
  await grab("hesaplar", bankWin);
  await page.click(`${bankWin} [data-act="new"]`);
  const form = `${top} form.hof-bank-form`;
  await page.waitForSelector(`${form} [name="kind"]`, { timeout: 8000 });
  const kinds = await page.$$eval(`${form} select[name="kind"] option`, nodes => nodes.map(node => node.textContent.trim()));
  check(kinds.join("|") === "Vadesiz|Ticari|Vadeli|Kredi Hesabı|Kurumsal Kredi Kartı|Diğer", `Hesap Türü seçenekleri: ${kinds.join(", ")}`);
  await grab("yeni-hesap-vadesiz");
  await page.selectOption(`${form} select[name="kind"]`, "card");
  await page.fill(`${form} [name="bankName"]`, "Garanti BBVA");
  await page.fill(`${form} [name="name"]`, "Şirket Kartı");
  await page.fill(`${form} [name="creditLimit"]`, "40.000");
  await page.fill(`${form} [name="statementDay"]`, "5");
  await page.fill(`${form} [name="dueDay"]`, "15");
  await page.fill(`${form} [name="openingDate"]`, "2026-10-01");
  await page.fill(`${form} [name="openingAmount"]`, "0");
  await page.check(`${form} [name="confirmed"]`);
  await page.waitForTimeout(400);
  await quiet();
  await grab("yeni-hesap-kart");
  await shot("k38-banka-kart-hesabi", { clip: pad(await topBox()) });
  await page.click(`${form} button[type="submit"]`);
  await page.waitForSelector(form, { state: "detached", timeout: 10000 });
  await page.waitForTimeout(700);
  await closeAll();
  KART = (await accountsNow()).find(account => account.kind === "card");
  check(Boolean(KART), "Kurumsal Kredi Kartı hesabı açıldı");
  // Cari − Ödeme → Kredi Kartı → Kurumsal Kart (tek kartta kendiliğinden).
  const pay = async amount => {
    await page.click('#hof-sidecard [data-action="accounts"]');
    await page.waitForSelector(`.hof-accounts-modal tr[data-account="${akaryakit.id}"]`, { timeout: 10000 });
    await page.click(`.hof-accounts-modal tr[data-account="${akaryakit.id}"]`);
    await page.waitForSelector('.hof-accounts-modal [data-entry="out"]', { timeout: 10000 });
    await page.click('.hof-accounts-modal [data-entry="out"]');
    const f = `${top} .hof-form`;
    await page.waitForSelector(`${f} input[name="amount"]`, { timeout: 8000 });
    const ways = await page.$$eval(`${f} select[name="method"] option`, nodes => nodes.map(node => node.textContent.trim()));
    check(ways.includes("Kredi Kartı") && ways.includes("Havale / EFT"), `Ödeme Yolu seçenekleri: ${ways.join(", ")}`);
    await page.fill(`${f} input[name="amount"]`, amount);
    await page.selectOption(`${f} select[name="method"]`, "card");
    await page.waitForSelector(`${f} [data-bank-pick="card"]:not([hidden])`, { timeout: 8000 });
    await page.fill(`${f} input[name="note"]`, "Akaryakıt (şirket kartıyla)");
    await page.waitForTimeout(500);
    return f;
  };
  let f = await pay("2.500");
  await quiet();
  const note = await textOf(`${f} [data-bank-pick="card"]`);
  check(note.includes("kurumsal kartına yazılır"), `Kurumsal Kart satırı: ${note}`);
  await grab("cari-odeme-kart");
  await shot("k39-banka-kurumsal-kart", { clip: pad(await topBox()) });
  await page.click(`${f} button[type="submit"]`);
  await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible input[name="amount"]'), null, { timeout: 10000 });
  await page.waitForTimeout(600);
  await closeAll();
  // Kart limitini aşan ödeme: Eksi Bakiye sorusu (limit dahil kullanılabilir tutar yazılır); Vazgeç → yazılmaz.
  f = await pay("50.000");
  await page.click(`${f} button[type="submit"]`);
  await page.waitForSelector(`${top} [data-answer]`, { timeout: 8000 });
  await page.waitForTimeout(500);
  const question = await textOf(top);
  check(question.includes("kart limiti") && question.includes("Yine de"), `kart limiti sorusu: ${question.slice(0, 200)}`);
  await grab("kart-limit");
  await page.click(`${top} [data-answer="no"]`);
  await page.waitForTimeout(600);
  await closeAll();
  const after = (await accountsNow()).find(account => account.id === KART.id);
  check(after.balanceMinor === -250_000, `kart borcu 2.500 (limit aşan ödeme yazılmadı): ${after.balanceMinor / 100}`);
  // Stok alımı (+ Giriş): "Kredi Kartı" → Kurumsal Kart; "Havale / EFT" → Banka Hesabı (iki hesap: seçim). Kaydedilmez (yalnız ekran adları).
  const item = data(await api("/api/workspace/stock", { name: "Motor Yağı", unit: "Lt", unitPrice: "420", openingQty: "0", openingDate: "2026-10-01" }));
  await page.evaluate(id => window.HOF.stock.open(id), item.id || item.item?.id);
  await page.waitForSelector('.hof-modal [data-move="in"]', { timeout: 10000 });
  await grab("stok-kart", modal);
  await page.click('.hof-modal [data-move="in"]');
  const sf = `${top} .hof-form`;
  await page.waitForSelector(`${sf} select[name="pay"]`, { timeout: 8000 });
  await page.selectOption(`${sf} select[name="pay"]`, "card");
  await page.waitForSelector(`${sf} [data-bank-pick="card"]:not([hidden])`, { timeout: 8000 });
  check((await textOf(`${sf} [data-bank-pick="card"]`)).includes("kurumsal kartına yazılır"), "Stok + Giriş: Kredi Kartı → Kurumsal Kart");
  await page.selectOption(`${sf} select[name="pay"]`, "bank");
  await page.waitForSelector(`${sf} [data-bank-pick]:not([data-bank-pick="card"]):not([hidden]) select[name="bankAccountId"]`, { timeout: 8000 });
  await grab("stok-giris");
  await closeAll();
  // Hesap Detayı → + Kart Borcu Ödemesi (Ziraat'ten 1.000).
  await openBank();
  await tab("accounts");
  await page.click(`${bankWin} .hof-bank-accounts tbody tr[data-account="${KART.id}"]`);
  await page.waitForSelector(`${bankWin} [data-act="v-card"]`, { timeout: 8000 });
  await grab("kart-detay", bankWin);
  await page.click(`${bankWin} [data-act="v-card"]`);
  await page.waitForSelector('form.hof-bank-voucher [name="amount"]', { timeout: 8000 });
  await page.waitForTimeout(300);
  await fillVoucher({ accountId: ZIRAAT.id, amount: "1.000", description: "Kart borcu ödemesi" });
  await grab("kart-borcu-odemesi");
  await saveVoucher();
  await closeAll();
  const paid = (await accountsNow()).find(account => account.id === KART.id);
  check(paid.balanceMinor === -150_000, `kart borcu 1.500 kaldı: ${paid.balanceMinor / 100}`);
});

// 7c) Kredi Hesabı: hesap API'den; Hesap Detayı → + Kredi İşlemi → Kredi Kullanımı ekrandan (Garanti'ye 50.000).
await step("kredi", async () => {
  const loan = data(await api("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "İşletme Kredisi", kind: "loan", creditLimit: "100.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } }));
  check(Boolean(loan?.id || loan?.account?.id), `Kredi Hesabı açıldı (${JSON.stringify(loan).slice(0, 120)})`);
  const loanId = loan?.id || loan?.account?.id;
  await openBank();
  await tab("accounts");
  await page.click(`${bankWin} .hof-bank-accounts tbody tr[data-account="${loanId}"]`);
  await page.waitForSelector(`${bankWin} [data-act="v-loan"]`, { timeout: 8000 });
  await grab("kredi-detay", bankWin);
  await page.click(`${bankWin} [data-act="v-loan"]`);
  await page.waitForSelector('form.hof-bank-voucher [name="amount"]', { timeout: 8000 });
  await page.waitForTimeout(300);
  const types = await page.$$eval('form.hof-bank-voucher select[name="type"] option', nodes => nodes.map(node => node.textContent.trim()));
  check(types.includes("Kredi Kullanımı") && types.includes("Kredi Geri Ödemesi"), `Diğer İşlem türleri: ${types.join(", ")}`);
  await fillVoucher({ accountId: GARANTI.id, amount: "50.000", description: "İşletme kredisi kullanımı" });
  await grab("kredi-islemi");
  await saveVoucher();
  await closeAll();
  const now = await accountsNow();
  check(now.find(account => account.id === loanId)?.balanceMinor === -5_000_000, `kredi borcu 50.000: ${now.find(account => account.id === loanId)?.balanceMinor / 100}`);
});

// 8) Hesap Detayı ve Genel Bakış.
await step("genel-bakis", async () => {
  await openBank();
  await tab("overview");
  await page.waitForSelector(`${bankWin} [data-bank-flows]`, { timeout: 10000 });
  await page.waitForTimeout(500);
  await quiet();
  await shot("k27-banka-genel-bakis", { clip: pad(await topBox()) });
  await grab("genel-bakis", bankWin);
  await tab("accounts");
  await page.click(`${bankWin} .hof-bank-accounts tbody tr[data-account="${ZIRAAT.id}"]`);
  await page.waitForSelector(`${bankWin} [data-bank-balance]`, { timeout: 8000 });
  await page.waitForTimeout(700);
  await quiet();
  const buttons = await page.$$eval(`${bankWin} .hof-chq-actions button`, list => list.map(node => node.textContent.trim()));
  check(["+ Masraf", "+ Faiz", "Transfer", "Düzenle", "Açılışı Düzelt", "Pasife Al", "Sil"].every(label => buttons.includes(label)), `Hesap Detayı düğmeleri: ${buttons.join(" | ")}`);
  await shot("k30-banka-hesap-detayi", { clip: pad(await topBox()) });
  await grab("hesap-detayi", bankWin);
  await tab("settings");
  await page.waitForSelector(`${bankWin} .hof-bank-set`, { timeout: 8000 });
  await grab("ayarlar", bankWin);
  await closeAll();
});

// 9) ANLIK DURUM (Nakit Kasa ve Gerçek Banka ayrı kutularda).
await step("k10", async () => {
  await page.reload({ waitUntil: "load" });
  await page.waitForSelector("#hof-pulse", { timeout: 20000 });
  if (await page.$("#hof-pulse.is-collapsed")) await page.click("#hof-pulse [data-pulse='toggle']");
  await page.waitForSelector('#hof-pulse [data-pulse-go="bank"]', { timeout: 20000 });
  await page.waitForTimeout(1500);
  await quiet();
  const label = await textOf('#hof-pulse [data-pulse-go="bank"] .hof-pulse-label');
  check(label === "Gerçek Banka", `ANLIK DURUM kutusu: ${label}`);
  await grab("anlik-durum", "#hof-pulse");
  if (want("k10-anlik-durum")) { await (await page.$("#hof-pulse")).screenshot({ path: `${OUT}/k10-anlik-durum.jpg`, type: "jpeg", quality: 84 }); shots += 1; console.log("✓ k10-anlik-durum"); }
});

// 10) Raporlar → Tüm Raporlar → Banka → Banka Bakiye Raporu.
await step("rapor", async () => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.click('#hof-sidecard [data-action="analytics"]');
  await page.waitForSelector(`${modal} .hof-rep-tab[data-tab="all"]`, { timeout: 15000 });
  await page.click(`${modal} .hof-rep-tab[data-tab="all"]`);
  await page.waitForSelector(`${modal} [data-rc-list] [data-report="banka-bakiye"]`, { timeout: 15000 });
  const items = await page.$$eval(`${modal} .hof-rc-group`, nodes => nodes.filter(node => node.querySelector("p").textContent.trim().endsWith("Banka")).flatMap(node => [...node.querySelectorAll("[data-report]")].map(item => item.textContent.trim())));
  check(items.join("|") === "Banka Bakiye Raporu|Banka Hareket Raporu|Banka Masraf Raporu|Alt Hesap Mizanı", `Banka raporları: ${items.join(", ")}`);
  await page.click(`${modal} [data-rc-list] [data-report="banka-bakiye"]`);
  await page.waitForSelector(`${modal} [data-rc-main] .hof-rc-summary`, { timeout: 15000 });
  await page.waitForTimeout(1500);
  await quiet();
  await shot("k36-banka-raporu", { clip: pad(await topBox()) });
  await grab("rapor", modal);
  for (const [id, name] of [["banka-hareket", "rapor-hareket"], ["banka-masraf", "rapor-masraf"], ["alt-hesap-mizani", "rapor-mizan"]]) {
    const item = await page.$(`${modal} [data-rc-list] [data-report="${id}"]`);
    if (!item) { check(false, `rapor listesinde ${id}`); continue; }
    await item.click();
    await page.waitForTimeout(1500);
    await grab(name, modal);
  }
  // Nakit Akış sekmesi: başlangıç "Bugünkü Nakit ve Banka".
  const flowTab = await page.$(`${modal} .hof-rep-tab[data-tab="flow"]`);
  if (flowTab) {
    await flowTab.click();
    await page.waitForTimeout(2000);
    await grab("nakit-akis", modal);
    check((await textOf(modal)).includes("Bugünkü Nakit ve Banka"), "Nakit Akış: Bugünkü Nakit ve Banka");
  } else check(false, "Nakit Akış sekmesi bulunamadı");
  await closeAll();
  await page.setViewportSize({ width: 1360, height: 900 });
});

// 10b) Planlı İşlemler görünümü ve ikinci kurumsal kart (ekran görüntüsü çekildikten sonra): iki kartta "Kurumsal Kart" seçimi.
await step("planli-ikinci-kart", async () => {
  await page.goto(`${base}/`);
  await page.waitForSelector("#hof-sidecard", { timeout: 20000 });
  await openBank();
  await tab("movements");
  await page.click(`${bankWin} [data-act="plan-new"]`);
  await page.waitForSelector('form.hof-bank-voucher [name="amount"]', { timeout: 8000 });
  await fillVoucher({ type: "other_out", accountId: ZIRAAT.id, amount: "15.000", description: "Ofis kirası" });
  await grab("planli-form");
  await page.click('form.hof-bank-voucher button[type="submit"]');
  await page.waitForSelector("form.hof-bank-voucher", { state: "detached", timeout: 10000 });
  await page.waitForTimeout(800);
  await page.waitForSelector(`${bankWin} [data-act="mv-planned"]`, { timeout: 10000 });
  // Kayıttan sonra liste yenilenir; görünüm düğmesi yenileme bitince tıklanır (gerekirse yeniden).
  for (let i = 0; i < 4 && !(await page.$(`${bankWin} [data-act="mv-planned"][aria-pressed="true"]`)); i += 1) {
    await page.waitForTimeout(1200);
    await page.click(`${bankWin} [data-act="mv-planned"]`);
  }
  await page.waitForSelector(`${bankWin} [data-act="mv-planned"][aria-pressed="true"]`, { timeout: 10000 });
  await page.waitForFunction(sel => document.querySelector(sel)?.innerText.includes("Ofis kirası"), `${bankWin} [data-bank]`, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
  await grab("planli-liste", bankWin);
  check((await textOf(bankWin)).includes("Gerçekleştir"), "Planlı İşlemler'de Gerçekleştir");
  await closeAll();
  const second = await api("/api/workspace/bank/accounts", { bankName: "Yapı Kredi", name: "Kurumsal Kart 2", kind: "card", creditLimit: "10.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
  check(second.status === 200, `ikinci kurumsal kart (${second.status})`);
  await page.click('#hof-sidecard [data-action="accounts"]');
  await page.waitForSelector(`.hof-accounts-modal tr[data-account="${akaryakit.id}"]`, { timeout: 10000 });
  await page.click(`.hof-accounts-modal tr[data-account="${akaryakit.id}"]`);
  await page.waitForSelector('.hof-accounts-modal [data-entry="out"]', { timeout: 10000 });
  await page.click('.hof-accounts-modal [data-entry="out"]');
  const f = `${top} .hof-form`;
  await page.waitForSelector(`${f} select[name="method"]`, { timeout: 8000 });
  await page.selectOption(`${f} select[name="method"]`, "card");
  await page.waitForSelector(`${f} [data-bank-pick="card"]:not([hidden]) select[name="cardAccountId"]`, { timeout: 8000 });
  await grab("cari-odeme-iki-kart");
  check((await textOf(`${f} [data-bank-pick="card"]`)).includes("Kurumsal Kart"), "iki kartta Kurumsal Kart seçimi");
  await closeAll();
});

// 11) Yönetim → Kullanıcılar → Yetkiler: Banka yetkileri (personel rolündeki örnek kullanıcı); Sistem → Eksi Bakiye Denetimi (Nakit Kasa).
await step("yetkiler", async () => {
  const user = await api("/api/admin/users", { username: "ayse", name: "Ayşe Demir", role: "personel", password: "Kilavuz-Personel-2026", mustChangePassword: false });
  check(user.status === 200, `örnek kullanıcı (${user.status})`);
  await page.goto(`${base}/admin.html`);
  await page.waitForSelector("#adm-users tr[data-id]", { timeout: 15000 });
  await page.evaluate(() => { const top = document.querySelector(".adm-top"); if (top) top.style.position = "static"; });
  await page.locator("#adm-users tr[data-id]", { hasText: "Ayşe" }).locator("[data-perms]").click();
  await page.waitForSelector(".adm-perm-row .adm-perm-panel", { timeout: 8000 });
  await page.locator('.adm-perm-row [data-perm="bank.view"]').check();
  await page.locator('.adm-perm-row [data-perm="bank.reports"]').check();
  await page.waitForTimeout(400);
  const group = page.locator(".adm-perm-row fieldset.adm-perm-group", { has: page.locator('[data-perm="bank.view"]') });
  await grab("yetkiler", ".adm-perm-row fieldset.adm-perm-group");
  await grab("yonetim-kullanicilar", ".adm-tabs");
  await grab("yonetim-kullanicilar", "#adm-users");
  const legend = (await group.locator("legend span").textContent()).trim();
  const items = await group.locator(".adm-perm-text b").allTextContents();
  check(items.length === 7 && !items.some(item => /POS|Ekstre|Mutabakat|Komisyon/.test(item)), `Banka yetkileri (${legend}): ${items.join(", ")}`);
  await group.scrollIntoViewIfNeeded();
  if (want("k40-banka-yetkiler")) { await group.screenshot({ path: `${OUT}/k40-banka-yetkiler.jpg`, type: "jpeg", quality: 84 }); shots += 1; console.log("✓ k40-banka-yetkiler"); }
  await page.click('.adm-tabs [data-tab="system"]').catch(() => {});
  await page.waitForSelector("#adm-negative", { timeout: 8000 });
  await grab("yonetim-eksi-bakiye", "#adm-negative");
});

if (process.env.EKRAN_METIN) { writeFileSync(process.env.EKRAN_METIN, JSON.stringify(texts, null, 1)); console.log("metinler:", process.env.EKRAN_METIN, Object.keys(texts).length, "ekran"); }
for (const line of checks) console.log(line);
console.log("sayfa hataları:", errors.length ? errors.join(" | ") : "yok");
console.log("başarısız adımlar:", failed.length ? failed.join(" | ") : "yok");
// Özet (tools/kanit.mjs tanır): denetimler + çekilen ekranlar; başarısız adım ve sayfa hatası başarısız sayılır.
console.log(`${checks.filter(line => line.startsWith("✓")).length + shots} denetim geçti, ${failed.length + errors.length} başarısız`);
await browser.close();
await app.close();
rmSync(root, { recursive: true, force: true });
if (failed.length || errors.length) process.exitCode = 1;
