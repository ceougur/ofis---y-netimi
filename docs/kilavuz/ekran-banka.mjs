// Kullanım kılavuzunun Banka bölümü ekran görüntüleri (ve Banka'yla değişen k08 Kasa, k10 ANLIK DURUM): sıfırdan kurulan geçici bir
// sunucuda, sahte saatle (08.10.2026 Perşembe 12:00; sunucu config.now + tarayıcı saati aynı gün). Örnek şirket verisi uydurmadır;
// müşteri verisi kullanılmaz. Her adım ekrandan yapılır (sihirbaz, masraf, transfer, cari tahsilatı, Kasa ile Banka Arası); yalnız
// başlangıç kayıtları (cari, eski havale, nakit tahsilat) API'den girilir.
// Kullanım: node docs/kilavuz/ekran-banka.mjs [çıktı klasörü] [yalnız-bunlar,virgülle]   (kılavuz görselleri yenilenirken; varsayılan docs/kilavuz/ekran)
//          node docs/kilavuz/ekran-banka.mjs --denetim   (npm run test:kilavuz-metin; CI e2e işi): görseller ve metinler GEÇİCİ klasöre yazılır
//          (docs/kilavuz/ekran'a dokunulmaz), sonra metin-denetle.mjs aynı metinlerle koşar; özet satırları ikisinin toplamıdır.
// EKRAN_METIN=<dosya.json> verilirse her ekranın görünen metni (düğme, sekme, alan, seçenek adları) o dosyaya yazılır: kılavuzdaki adlar
// bu metinlerle birebir karşılaştırılır (docs/kilavuz/metin-denetle.mjs).
// 2.4.9 B4: pencere kapatma test/e2e/esc-kapat.mjs escClose ile (2.4.3 "Kaydedilmemiş Değişiklik" sorusu "Kaydetmeden Kapat"la yanıtlanır); her
// kapatmada beklenti yazılır (soru-var: elle doldurulmuş, kaydedilmemiş form; soru-yok: temiz form ya da kayıttan sonra) ve yanıtlanan her soru
// sonda listelenir, ayrıntısı (neden, dokunulmuş alanlar) ESC_KAPAT_GUNLUK günlüğünde (ders 34). En üstteki pencere :nth-last-child(1 of …) ile
// (ders 39). Banka rapor adları, rapor grubu sırası ve Banka yetkileri kılavuz metninden okunur (2.1.0'dan kalan sabit 4 rapor / 7 yetki kalktı).
// Sonra: node docs/kilavuz/pdf-uret.mjs docs/kilavuz DestekOfis-Kullanim-Kilavuzu && cp docs/kilavuz/DestekOfis-Kullanim-Kilavuzu.pdf client/kilavuz/
import { createRequire } from "node:module";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const R = path.resolve(HERE, "..", "..");
const S = path.join(HERE, "ornek");
const { chromium } = createRequire(`${R}/`)("playwright");
const { createApp } = await import(`${R}/server/app.mjs`);
const { installPageClock, moveClock } = await import(`${R}/test/helpers.mjs`);
const { escClose } = await import(`${R}/test/e2e/esc-kapat.mjs`);
const { denetle, yazdir } = await import(`${R}/docs/kilavuz/metin-denetle.mjs`);
const DENETIM = process.argv[2] === "--denetim";
const STARTED = new Date().toISOString();
const root = mkdtempSync(path.join(tmpdir(), "kilavuz-banka-"));
const OUT = DENETIM ? path.join(root, "ekran") : process.argv[2] || `${R}/docs/kilavuz/ekran`;
const ONLY = !DENETIM && process.argv[3] ? new Set(process.argv[3].split(",")) : null;
mkdirSync(OUT, { recursive: true });
// Ders 34: yanıtlanan her "Kaydedilmemiş Değişiklik" sorusu escClose'un günlüğüne (pencere başlığı, neden, dokunulmuş alanlar) yazılır.
if (DENETIM && !process.env.ESC_KAPAT_GUNLUK) process.env.ESC_KAPAT_GUNLUK = path.join(root, "esc-kapat.jsonl");
// Beklentiler kılavuz metninden (kâhin = kılavuz, ürün çıktısı değil — ders 5, 40): bölüm 8 madde başlarının <i> / <b> adları.
const KILAVUZ = readFileSync(path.join(HERE, "DestekOfis-Kullanim-Kilavuzu.html"), "utf8");
const plain = value => value.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const kilavuzItem = prefix => [...KILAVUZ.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(match => match[1]).find(item => plain(item).startsWith(prefix)) || "";
const tagged = (item, tag) => [...item.matchAll(new RegExp(`<${tag}>(.*?)</${tag}>`, "g"))].map(match => plain(match[1]));
const PASS = "Kilavuz-Admin-2026";
const NOW = "2026-10-08T12:00:00+03:00";
// HUKUK_LICENSE_URL ölü adres: program gerçek lisans servisine ulaşmaz (ders 30).
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "b"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9" }, license: { enforce: false, machineId: "7f3a91c24be05d6e8a1b2c3d4e5f6072" } });
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
// Koşu sırasında görülen ürün bulguları (denetimi düşürmez; sonda "BULGU" satırı olarak yazılır, ana oturum karar verir).
const findings = [];
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
// Ders 39: en üstteki pencere konuma (:last-of-type) bağlanmaz; pencereden sonra body'ye eklenen bir div (bildirim kabı) onu boşa düşürür.
const top = `${modal}:nth-last-child(1 of ${modal})`;
const inv = `${modal} .hof-invoices-modal`;
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
// Pencere kapatma (Esc): soru çıkarsa escClose "Kaydetmeden Kapat" der. expect: "soru-var" | "soru-yok" | "" (beklenti yok: yalnız hatadan sonra).
const answered = [];
const closeTop = async (stepName, expect, label = expect) => {
  const asked = await escClose(page, { expect, step: stepName });
  if (asked) answered.push(`${stepName} (beklenti ${label || "yok"})`);
  await page.waitForTimeout(350);
  return asked;
};
/** Açık pencerelerin hepsini kapatır; expect bütün kapatma dizisi için: soru-var → en az bir soru, soru-yok → hiç soru. */
const closeAll = async (stepName, expect) => {
  let asked = 0;
  for (let i = 0; i < 6 && await page.$(modal); i += 1) if (await closeTop(stepName, "", expect ? `${expect}, kapatma dizisi` : "")) asked += 1;
  if (await page.$(modal)) throw new Error(`closeAll: pencere kapanmadı (${stepName})`);
  if (expect === "soru-yok" && asked) throw new Error(`closeAll: "Kaydedilmemiş Değişiklik" sorusu çıkmamalıydı (${stepName})`);
  if (expect === "soru-var" && !asked) throw new Error(`closeAll: "Kaydedilmemiş Değişiklik" sorusu çıkmalıydı (${stepName})`);
};
// Ekranın görünen metni + açılır liste seçenekleri + düğmelerin title'ı (pasif düğme nedeni) — kılavuzdaki adlar bunlarla karşılaştırılır.
const texts = {};
// Ders 39/20 (CI #970 "✗ 8: + Giriş"): pencerenin içeriği "is-visible" sınıfından ÖNCE hazır olabilir (sınıf bir kare sonra gelir). İçeriği bekleyip hemen
// okuyan grab, açılmakta olan pencereyi `${modal}` / `top` ile bulamaz: ya boş metin ya da ALTTAKİ pencerenin metni okunur. Okumadan önce açık her
// pencerenin is-visible aldığı (kapanmakta olanların da DOM'dan çıktığı) beklenir; beklenmezse adım hatayla düşer (sessiz boş metin yok).
const settled = () => page.waitForFunction(() => [...document.querySelectorAll(".hof-modal-backdrop")].every(node => node.classList.contains("is-visible")), null, { timeout: 8000 });
const grab = async (name, selector = top) => {
  await settled();
  const value = await page.$$eval(selector, list => list.map(n => [n.innerText, ...[...n.querySelectorAll("option")].map(o => o.textContent), ...[...n.querySelectorAll("[title]")].map(o => o.getAttribute("title"))].join("\n")).join("\n")).catch(() => "");
  texts[name] = (texts[name] ? `${texts[name]}\n` : "") + value;
};
const check = (cond, what) => { checks.push(`${cond ? "✓" : "✗"} ${what}`); if (!cond) failed.push(`denetim: ${what}`); };
const step = async (name, fn) => { try { await fn(); } catch (error) { failed.push(`${name}: ${error.message.split("\n")[0]}`); console.log("✗", name, error.message.split("\n")[0]); await page.screenshot({ path: path.join(DENETIM ? OUT : tmpdir(), `kilavuz-banka-hata-${name}.png`) }).catch(() => {}); await closeAll(name, "").catch(() => {}); } };
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
  await closeAll("eski-hareketler", "soru-yok");
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
  await closeTop("masraf", "soru-yok");
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
  await closeAll("transfer", "soru-yok");
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
  // 2.1.0 (yargıç B1) "Hesapsız (Açılıştan Önce)" seçeneği; v2.2.0 (İz 2.7) seçenek adında hesabın bakiyesi.
  check(options[0] === "Hesap Seçin" && options.length === 4 && options[3] === "Hesapsız (Açılıştan Önce)" && options.slice(1, 3).every(text => / — ₺/.test(text)), `Banka Hesabı seçenekleri: ${options.join(" | ")}`);
  await page.selectOption(`${form} select[name="bankAccountId"]`, ZIRAAT.id);
  await page.waitForTimeout(700);
  await quiet();
  await shot("k34-banka-hesap-secimi", { clip: pad(await topBox()) });
  await grab("cari-tahsilat");
  await page.click(`${form} button[type="submit"]`);
  await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible input[name="amount"]'), null, { timeout: 10000 });
  await page.waitForTimeout(600);
  await closeAll("cari-tahsilat", "soru-yok");
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
  // Vazgeç'ten sonra elle doldurulmuş "Bankadan Kasaya Aktar" formu açık kalır (kaydedilmedi): Esc → soru MEŞRU (2.4.3; B4-2 K1).
  check(Boolean(await page.$(`${top} .hof-form select[name="bankAccountId"]`)), "Vazgeç'ten sonra Bankadan Kasaya Aktar formu açık (yazılmadı)");
  await closeTop("kasa-eksi-bakiye-vazgec", "soru-var");
  // 2.4.3: Kasa → Vergi Ödemesi formu (Gecikme Zammı / Faizi); kaydedilmez, temiz form sorusuz kapanır.
  await page.click(`${modal} [data-tax]`);
  await page.waitForSelector(`${top} .hof-form [name="lateAmount"]`, { timeout: 8000 });
  await page.waitForTimeout(300);
  await grab("vergi-odemesi");
  check((await textOf(top)).includes("Gecikme Zammı / Faizi"), "Kasa → Vergi Ödemesi: Gecikme Zammı / Faizi alanı");
  await closeTop("vergi-odemesi", "soru-yok");
  await closeAll("kasa", "soru-yok");
});

// 7b) Kredi Kartı (v2.2.0): Yeni Hesap türlerinde kart yok; kart banka hesabının İÇİNDEN eklenir (Düzenle → Kredi Kartı Kullan → + Kredi Kartı
// Ekle: Kart Adı, Son 4 Hane, Kart Limiti, Hesap Kesim ve Son Ödeme Günü); carinin − Ödeme formunda "Kredi Kartı" seçilince Kredi Kartı alanı;
// limit aşılınca Eksi Bakiye sorusu; Hesap Detayı'ndan Kart Borcu Ödemesi.
let KART = null;
// v2.2.0 (İz 2.1): doğrulanmamış hesapta Hesaplar'da "Açılış Bakiyesi Doğrulanmadı" ve ne yapılacağı. Geçici hesap: ekran metni alınınca silinir.
await step("dogrulanmadi", async () => {
  const extra = data(await api("/api/workspace/bank/accounts", { bankName: "Vakıfbank", name: "Ek Hesap", kind: "demand", opening: { date: "2026-10-01", amount: "0", confirmed: false } }));
  await openBank();
  await tab("accounts");
  await grab("hesaplar-dogrulanmadi", bankWin);
  check((await textOf(bankWin)).includes("Açılış Bakiyesi Doğrulanmadı"), "Hesaplar: Açılış Bakiyesi Doğrulanmadı");
  await closeAll("dogrulanmadi", "soru-yok");
  const removed = await api(`/api/workspace/bank/accounts/${extra.id}`, null, "DELETE");
  check(removed.status === 200, `geçici hesap silindi (${removed.status})`);
});
await step("kart", async () => {
  // Kart yokken cari − Ödeme → Kredi Kartı: "Kredi Kartı Tanımla" (form kapanmadan kart tanımlanır; burada kaydedilmez).
  await page.click('#hof-sidecard [data-action="accounts"]');
  await page.waitForSelector(`.hof-accounts-modal tr[data-account="${akaryakit.id}"]`, { timeout: 10000 });
  await page.click(`.hof-accounts-modal tr[data-account="${akaryakit.id}"]`);
  await page.waitForSelector('.hof-accounts-modal [data-entry="out"]', { timeout: 10000 });
  await page.click('.hof-accounts-modal [data-entry="out"]');
  await page.waitForSelector(`${top} .hof-form select[name="method"]`, { timeout: 8000 });
  await page.selectOption(`${top} .hof-form select[name="method"]`, "card");
  await page.waitForSelector(`${top} .hof-form [data-bank-define="card"]`, { timeout: 8000 });
  await grab("kart-tanimla");
  // soru-yok: formda yalnız Ödeme Yolu betikle seçildi (page.selectOption olayı isTrusted değil → hof-core "dokunulmuş" saymaz); tutar girilmedi.
  await closeAll("kart-tanimla", "soru-yok");
  await openBank();
  await tab("accounts");
  await grab("hesaplar", bankWin);
  await page.click(`${bankWin} [data-act="new"]`);
  const form = `${top} form.hof-bank-form`;
  await page.waitForSelector(`${form} [name="kind"]`, { timeout: 8000 });
  const kinds = await page.$$eval(`${form} select[name="kind"] option`, nodes => nodes.map(node => node.textContent.trim()));
  check(kinds.join("|") === "Vadesiz|Ticari|Vadeli|Kredi Hesabı|Diğer", `Hesap Türü seçenekleri (kart yok): ${kinds.join(", ")}`);
  await grab("yeni-hesap-vadesiz");
  await closeAll("yeni-hesap-vadesiz", "soru-yok");
  // Garanti → Düzenle → Kredi Kartı Kullan → + Kredi Kartı Ekle.
  await openBank();
  await tab("accounts");
  await page.click(`${bankWin} .hof-bank-accounts tbody tr[data-account="${GARANTI.id}"]`);
  await page.waitForSelector(`${bankWin} [data-act="edit"]`, { timeout: 8000 });
  await page.click(`${bankWin} [data-act="edit"]`);
  await page.waitForSelector(`${top} form [name="useCard"]`, { timeout: 8000 });
  await page.check(`${top} form [name="useCard"]`);
  await grab("hesap-duzenle-isaretler");
  await page.click(`${top} form button[type="submit"]`);
  await page.waitForSelector(`${bankWin} [data-bank-cards] [data-act="card-add"]`, { timeout: 10000 });
  await grab("hesap-kredi-kartlari", bankWin);
  await page.click(`${bankWin} [data-bank-cards] [data-act="card-add"]`);
  const card = `${top} form.hof-bank-form`;
  await page.waitForSelector(`${card} [name="cardLast4"]`, { timeout: 8000 });
  await page.waitForFunction(sel => document.querySelector(sel)?.value, `${card} select[name="parentId"]`, { timeout: 8000 });
  await page.fill(`${card} [name="name"]`, "Şirket Kartı");
  await page.fill(`${card} [name="cardLast4"]`, "4821");
  await page.fill(`${card} [name="creditLimit"]`, "40.000");
  await page.fill(`${card} [name="statementDay"]`, "5");
  await page.fill(`${card} [name="dueDay"]`, "15");
  await page.fill(`${card} [name="openingDate"]`, "2026-10-01");
  await page.fill(`${card} [name="openingAmount"]`, "0");
  await page.check(`${card} [name="confirmed"]`);
  await page.waitForTimeout(400);
  await quiet();
  await grab("yeni-hesap-kart");
  await shot("k38-banka-kart-hesabi", { clip: pad(await topBox()) });
  await page.click(`${card} button[type="submit"]`);
  await page.waitForSelector(card, { state: "detached", timeout: 10000 });
  await page.waitForTimeout(700);
  await closeAll("kart-ekle", "soru-yok");
  KART = (await accountsNow()).find(account => account.kind === "card");
  check(Boolean(KART) && KART.parentId === GARANTI.id && KART.cardLast4 === "4821", "kredi kartı Garanti'nin altında açıldı (son 4 hane 4821)");
  // Cari − Ödeme → Kredi Kartı → Kredi Kartı alanı (tek kartta kendiliğinden).
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
  check(note.includes("kredi kartına yazılır"), `Kredi Kartı satırı: ${note}`);
  await grab("cari-odeme-kart");
  await shot("k39-banka-kurumsal-kart", { clip: pad(await topBox()) });
  await page.click(`${f} button[type="submit"]`);
  await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible input[name="amount"]'), null, { timeout: 10000 });
  await page.waitForTimeout(600);
  await closeAll("cari-odeme-kart", "soru-yok");
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
  await closeAll("kart-limit", "soru-var");
  const after = (await accountsNow()).find(account => account.id === KART.id);
  check(after.balanceMinor === -250_000, `kart borcu 2.500 (limit aşan ödeme yazılmadı): ${after.balanceMinor / 100}`);
  // 2.4.9 K-1 (P1 / P1-b): tedarikçinin + Tahsilat formunda yol POS → "Kredi Kartına İade" kutusu görünür. Kaydedilmez (yalnız ekran adı).
  await page.click('#hof-sidecard [data-action="accounts"]');
  await page.waitForSelector(`.hof-accounts-modal tr[data-account="${akaryakit.id}"]`, { timeout: 10000 });
  await page.click(`.hof-accounts-modal tr[data-account="${akaryakit.id}"]`);
  await page.waitForSelector('.hof-accounts-modal [data-entry="in"]', { timeout: 10000 });
  await page.click('.hof-accounts-modal [data-entry="in"]');
  const rf = `${top} .hof-form`;
  await page.waitForSelector(`${rf} select[name="method"]`, { timeout: 8000 });
  await page.selectOption(`${rf} select[name="method"]`, "card");
  await page.waitForSelector(`${rf} input[name="cardRefund"]`, { state: "visible", timeout: 8000 });
  check((await textOf(rf)).includes("Kredi Kartına İade"), "tedarikçi tahsilatında yol POS: Kredi Kartına İade kutusu");
  await grab("tedarikci-kart-iade");
  // soru-yok: yalnız Tahsilat Yolu betikle seçildi (selectOption, isTrusted değil); tutar girilmedi.
  await closeAll("tedarikci-kart-iade", "soru-yok");
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
  check((await textOf(`${sf} [data-bank-pick="card"]`)).includes("kredi kartına yazılır"), "Stok + Giriş: Kredi Kartı → Kredi Kartı alanı");
  await page.selectOption(`${sf} select[name="pay"]`, "bank");
  await page.waitForSelector(`${sf} [data-bank-pick]:not([data-bank-pick="card"]):not([hidden]) select[name="bankAccountId"]`, { timeout: 8000 });
  await grab("stok-giris");
  // soru-yok: yalnız Ödeme yolu betikle seçildi (selectOption, isTrusted değil); miktar / tutar girilmedi.
  await closeAll("stok-giris", "soru-yok");
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
  await closeAll("kart-borcu-odemesi", "soru-yok");
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
  await closeAll("kredi", "soru-yok");
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
  await closeAll("genel-bakis", "soru-yok");
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
  // Beklenen KILAVUZDAN (8. bölüm "Raporlar → Tüm Raporlar → Banka:" maddesinin <i> adları; "Günlük" ve "Aylık Banka Raporu" gibi ortak ekli adlar
  // parça olarak yazılır → her kılavuz adı Banka grubundaki bir rapor adının içinde geçmeli). Grupta olup kılavuzda geçmeyen rapor BİLGİ satırıdır.
  const guideReports = tagged(kilavuzItem("Raporlar → Tüm Raporlar → Banka:"), "i");
  check(guideReports.length >= 10, `kılavuzda Banka rapor adları okundu (${guideReports.length})`);
  const absent = guideReports.filter(name => !items.some(item => item.includes(name)));
  check(items.length > 0 && absent.length === 0, `kılavuzdaki her Banka rapor adı Banka grubunda (${guideReports.length} ad, ekranda ${items.length} rapor)${absent.length ? ` — ekranda YOK: ${absent.join(", ")}` : ""}`);
  const unlisted = items.filter(item => !guideReports.some(name => item.includes(name)));
  console.log(`bilgi: Banka grubunda olup kılavuzda geçmeyen rapor: ${unlisted.length ? unlisted.join(", ") : "yok"}`);
  // Rapor grubu sırası kılavuzdaki "Cari · Kasa · …" listesiyle aynı.
  const order = tagged(kilavuzItem("Raporlar → Tüm Raporlar → Banka:"), "b").find(text => text.includes(" · "))?.split(" · ").map(text => text.trim()) || [];
  const groups = await page.$$eval(`${modal} .hof-rc-group`, nodes => nodes.map(node => node.querySelector("p")?.textContent.trim() || ""));
  const at = order.map(name => groups.findIndex(label => label.endsWith(name)));
  // Grup adları ekranda büyük harfle (CSS) gösterilebilir; innerText onu büyütür → adlar DOM metniyle (textContent) ayrıca kaydedilir.
  texts["rapor-gruplari"] = groups.join("\n");
  check(order.length >= 5 && at.every((index, i) => index >= 0 && (i === 0 || index > at[i - 1])), `rapor grubu sırası kılavuzdaki gibi (${order.join(" · ")}); ekranda: ${groups.join(" · ")}`);
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
  await closeAll("rapor", "soru-yok");
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
  await closeAll("planli-liste", "soru-yok");
  // İkinci kart, 2.1.0'dan kalma gibi bankaya bağsız (API): Hesaplar'da altında "Öneri: Ziraat Bankası …" ve "Bağla".
  const second = await api("/api/workspace/bank/accounts", { bankName: "Ziraat Bankası", name: "Şirket Kartı 2", kind: "card", creditLimit: "10.000", opening: { date: "2026-10-01", amount: "0", confirmed: true } });
  check(second.status === 200, `ikinci kredi kartı (${second.status})`);
  await openBank();
  await tab("accounts");
  await grab("hesaplar-kart-onerisi", bankWin);
  check((await textOf(bankWin)).includes("Öneri") && (await textOf(bankWin)).includes("Bağla"), "Hesaplar: bağsız kartta Öneri ve Bağla");
  await closeAll("hesaplar-kart-onerisi", "soru-yok");
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
  check((await textOf(`${f} [data-bank-pick="card"]`)).includes("Kredi Kartı"), "iki kartta Kredi Kartı seçimi");
  // soru-yok: yalnız Ödeme Yolu betikle seçildi (selectOption, isTrusted değil); tutar girilmedi.
  await closeAll("cari-odeme-iki-kart", "soru-yok");
});

// 10c) POS ile Tahsilat (2.2.0; kılavuz 8. bölüm "POS ile Tahsilat"): Ziraat → Düzenle → POS Kullan → + POS Ekle (ekrandan); cari tahsilatında yol POS
// (POS Taksit Sayısı) → Banka → POS → POS Ödeme Takvimi (Şimdi Aktar) ve POS İşlemleri → İptal Et (aynı gün); satış faturasında "+ POS", satıştan iade
// faturasında "+ POS İadesi" (iade kaydedilmez). Akış test/e2e/senaryo-pos-220.mjs'ten uyarlandı; ekran görüntüsü çekilmez (yalnız metin).
await step("pos", async () => {
  // Saat 21.10.2026: adım 2'deki 20.10 tarihli havale, program AÇIKKEN saat oynatılarak yazıldı; kapı onu açılış tabanında görmediği için "yeni"
  // ileri tarihli hareket sayar ve tam kapıdan geçen yazmaları (POS Ekle) 409 ile geri alır (gerçek eski sürüm verisinde satır açılışta vardır →
  // taban). Tarih geçince satır ileri tarihli değildir; POS adımları bu günde yapılır (yalnız ekran metni okunur).
  await moveClock(app.config.now, page, "2026-10-21T12:00:00+03:00");
  await page.goto(`${base}/`);
  await page.waitForSelector("#hof-sidecard", { timeout: 20000 });
  check((await page.evaluate(() => window.HOF.localToday())) === "2026-10-21", "POS adımı: sunucu ve tarayıcı 21.10.2026");
  await openBank();
  await tab("accounts");
  await page.click(`${bankWin} .hof-bank-accounts tbody tr[data-account="${ZIRAAT.id}"]`);
  await page.waitForSelector(`${bankWin} [data-act="edit"]`, { timeout: 8000 });
  await page.click(`${bankWin} [data-act="edit"]`);
  await page.waitForSelector(`${top} .hof-form input[name="usePos"]`, { timeout: 8000 });
  await page.check(`${top} .hof-form input[name="usePos"]`);
  await page.click(`${top} .hof-form button[type="submit"]`);
  await page.waitForSelector(`${bankWin} [data-bank-pos="${ZIRAAT.id}"] [data-pos-act="add"]`, { timeout: 10000 });
  await page.waitForTimeout(400);
  await grab("hesap-pos", bankWin);
  await page.click(`${bankWin} [data-bank-pos="${ZIRAAT.id}"] [data-pos-act="add"]`);
  const form = `${top} .hof-form`;
  await page.waitForSelector(`${form} input[name="name"]`, { timeout: 8000 });
  await page.waitForTimeout(300);
  await grab("pos-ekle");
  await page.fill(`${form} input[name="name"]`, "Ziraat Fiziki POS");
  await page.fill(`${form} input[name="valorDays"]`, "1");
  await page.fill(`${top} [data-rate-row]:nth-child(1) [data-rate="rate"]`, "2,5");
  await page.click(`${form} button[type="submit"]`);
  await page.waitForSelector(`${form} input[name="valorDays"]`, { state: "detached", timeout: 10000 }).catch(async () => { throw new Error(`POS Ekle kaydedilmedi: ${await textOf(`${top} .hof-form-error`) || await textOf(top)}`.slice(0, 300)); });
  await page.waitForTimeout(800);
  const posList = data(await api("/api/workspace/bank/pos")).pos || [];
  check(posList.length === 1 && posList[0].bankAccountId === ZIRAAT.id, `POS Ziraat'e bağlı açıldı (${posList.length})`);
  await closeAll("pos-ekle", "soru-yok");
  // Cari tahsilatında yol POS: POS Taksit Sayısı; kaydedilir (sonra İptal Et ile geri alınır).
  await page.click('#hof-sidecard [data-action="accounts"]');
  await page.waitForSelector(`.hof-accounts-modal tr[data-account="${koleji.id}"]`, { timeout: 10000 });
  await page.click(`.hof-accounts-modal tr[data-account="${koleji.id}"]`);
  await page.waitForSelector('.hof-accounts-modal [data-entry="in"]', { timeout: 10000 });
  await page.click('.hof-accounts-modal [data-entry="in"]');
  const f = `${top} .hof-form`;
  await page.waitForSelector(`${f} input[name="amount"]`, { timeout: 8000 });
  await page.fill(`${f} input[name="amount"]`, "500");
  await page.selectOption(`${f} select[name="method"]`, "card");
  await page.waitForSelector(`${f} [data-pos-pick]:not([hidden]) select[name="posInstallments"]`, { timeout: 8000 });
  await page.waitForTimeout(600);
  await grab("cari-tahsilat-pos");
  // BULGU (2.4.9 B4, ürün; düzeltilmedi — ana oturuma): şirkette kredi kartı varken MÜŞTERİ carisinin tahsilatında yol POS seçilince formda zorunlu
  // "Kredi Kartı" seçimi de çıkıyor (hof-bank.js syncPickers: "Kredi Kartına İade" kutusu müşteride yok → kart seçicisi açık kalıyor); iki kartta
  // "Kart Seçin" boş → kayıt "Kredi Kartı alanı boş bırakılamaz" ile reddedilir. Bu durumda tahsilat API'den girilir (İptal Et için bir POS işlemi
  // gerekir) ve BULGU sonda yazılır; düzelince ekran yolu kendiliğinden koşar.
  const cardPick = await page.$(`${f} [data-bank-pick="card"]:not([hidden]) select[name="cardAccountId"]`);
  if (cardPick) {
    findings.push(`cari (müşteri) tahsilatında yol POS: formda zorunlu "Kredi Kartı" seçimi çıkıyor (${(await textOf(`${f} [data-bank-pick="card"]`)).slice(0, 120)})`);
    await closeAll("cari-tahsilat-pos-bulgu", "soru-var");
    const posted = await api(`/api/workspace/accounts/${koleji.id}/entries`, { kind: "in", amount: "500", method: "card", posId: posList[0]?.id, posInstallments: 1, date: "2026-10-21", note: "POS tahsilatı (API)" });
    check(posted.status === 200, `cari POS tahsilatı (API) ${posted.status} ${posted.error || posted.message || ""}`);
  } else {
    await page.click(`${f} button[type="submit"]`);
    await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible input[name="amount"]'), null, { timeout: 10000 }).catch(async () => { throw new Error(`POS tahsilatı kaydedilmedi: ${await textOf(`${top} .hof-form-error`) || (await textOf(top)).slice(-200)}`.slice(0, 300)); });
    await page.waitForTimeout(600);
    await closeAll("cari-tahsilat-pos", "soru-yok");
  }
  const sale = (data(await api("/api/workspace/bank/pos/sales?kind=sale")).sales || []).find(item => item.party?.id === koleji.id && item.status === "active");
  check(Boolean(sale), "cari POS tahsilatı POS işlemi olarak yazıldı");
  // Banka → POS: POS Ödeme Takvimi (Şimdi Aktar) ve POS İşlemleri (İptal Et).
  await openBank();
  await tab("pos");
  await grab("pos-sekme", bankWin);
  await page.click(`${bankWin} [data-pos-sub="calendar"]`);
  await page.waitForTimeout(900);
  await grab("pos-takvim", bankWin);
  check(Boolean(await page.$(`${bankWin} [data-pos-act="settle"]`)), "POS Ödeme Takvimi'nde Şimdi Aktar");
  await page.click(`${bankWin} [data-pos-sub="sales"]`);
  await page.waitForTimeout(900);
  await grab("pos-islemleri", bankWin);
  if (sale) {
    const row = `${bankWin} tr[data-pos-sale="${sale.id}"]`;
    await page.waitForSelector(`${row} [data-pos-act="void"]:not([disabled])`, { timeout: 8000 });
    await page.click(`${row} [data-pos-act="void"]`);
    await page.waitForSelector(`${top} [data-answer="yes"]`, { timeout: 8000 });
    await grab("pos-iptal-sorusu");
    await page.click(`${top} [data-answer="yes"]`);
    await page.waitForTimeout(1500);
    const after = (data(await api("/api/workspace/bank/pos/sales?kind=sale&status=")).sales || []).find(item => item.id === sale.id);
    check(after?.status === "void", `POS İşlemleri → İptal Et: durum ${after?.status}`);
  }
  await closeAll("pos-islemleri", "soru-yok");
  // Satış faturası: "+ POS"; satıştan iade: "+ POS İadesi". Asıl satış API'den (açık hesap); formlar kaydedilmez, elle dokunulmadığı için sorusuz kapanır.
  const item = data(await api("/api/workspace/stock", { kind: "goods", code: "SRV-1", name: "Servis Kartı", unit: "Adet", openingQty: "20", openingDate: "2026-10-01" }));
  const saleInvoice = data(await api("/api/workspace/invoices", { kind: "sale", accountId: koleji.id, issueDate: "2026-10-08", pricesIncludeVat: true, lines: [{ itemId: item.id || item.item?.id, name: "Servis Kartı", qty: 2, unitPrice: 1000, discountRate: 0, vatRate: 20 }], payment: { cash: [], cheques: [], endorse: [], rest: "open" }, force: true }));
  const invoiceId = saleInvoice?.id || saleInvoice?.invoice?.id;
  check(Boolean(invoiceId), `asıl satış faturası (API) ${JSON.stringify(saleInvoice).slice(0, 100)}`);
  await page.click("#hof-sidecard [data-action=invoices]");
  await page.waitForSelector(`${inv} [data-act="new"]`, { timeout: 15000 });
  await page.click(`${inv} [data-act="new"]`);
  await page.click(`${inv} [data-scenario="goods_sale"]`);
  await page.waitForSelector(`${inv} [data-lines]`, { timeout: 10000 });
  await page.waitForTimeout(600);
  await grab("fatura-satis", inv);
  check(Boolean(await page.$(`${inv} [data-act="pay-add-cash"][data-method="card"]`)) && (await textOf(`${inv} [data-act="pay-add-cash"][data-method="card"]`)) === "+ POS", "Satış faturasında + POS");
  await closeAll("fatura-satis", "soru-yok");
  await page.evaluate(id => window.HOF.invoices.openDoc(id), invoiceId);
  await page.waitForSelector(`${inv} [data-act="return"]`, { timeout: 10000 });
  await page.click(`${inv} [data-act="return"]`);
  await page.waitForSelector(`${inv} [data-l="0"][data-f="qty"]`, { timeout: 10000 });
  await page.waitForTimeout(800);
  await grab("fatura-iade", inv);
  check((await textOf(`${inv} [data-act="pay-add-cash"][data-method="card"]`)) === "+ POS İadesi", "Satıştan iade faturasında + POS İadesi");
  await closeAll("fatura-iade", "soru-yok");
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
  // Beklenen KILAVUZDAN (8. bölüm "Kimler kullanır:" maddesindeki <i> yetki adları): ekrandaki grup = kılavuzdaki liste (sırasız, eksiksiz, fazlasız).
  const guidePerms = tagged(kilavuzItem("Kimler kullanır:"), "i");
  const shown = items.map(item => item.trim());
  const missingPerms = guidePerms.filter(name => !shown.includes(name));
  const extraPerms = shown.filter(name => !guidePerms.includes(name));
  check(guidePerms.length >= 5 && missingPerms.length === 0 && extraPerms.length === 0, `Banka yetkileri (${legend}) = kılavuzdaki ${guidePerms.length} ad: ${shown.join(", ")}${missingPerms.length ? ` — ekranda YOK: ${missingPerms.join(", ")}` : ""}${extraPerms.length ? ` — kılavuzda YOK: ${extraPerms.join(", ")}` : ""}`);
  check(legend.endsWith(kilavuzItem("Kimler kullanır:").match(/Yetkiler → ([^<]+)<\/b>/)?.[1]?.trim() || "?"), `yetki grubu adı kılavuzdaki gibi (${legend})`);
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
for (const item of findings) console.log(`BULGU (ürün): ${item}`);
// Ders 34: yanıtlanan her "Kaydedilmemiş Değişiklik" sorusu (adım + beklenti; neden ve dokunulmuş alanlar escClose günlüğünden).
console.log(`yanıtlanan sorular ("Kaydetmeden Kapat"): ${answered.length}`);
const escLog = (() => { try { return readFileSync(process.env.ESC_KAPAT_GUNLUK || "", "utf8").split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)).filter(item => item.senaryo === "ekran-banka.mjs" && item.at >= STARTED); } catch { return []; } })();
for (const [i, line] of answered.entries()) {
  const info = escLog[i]?.adim && line.startsWith(escLog[i].adim) ? escLog[i] : null;
  console.log(`  ? ${line}${info ? ` — pencere "${info.title}", neden ${info.neden}, dokunulmuş: ${(info.touched || []).map(field => `${field.name}=${field.value}`).join(", ") || "-"}` : ""}`);
}
const ekranGecen = checks.filter(line => line.startsWith("✓")).length + shots;
const ekranBasarisiz = failed.length + errors.length;
await browser.close();
await app.close();
if (DENETIM) {
  // Kılavuz ad denetimi aynı metinlerle (metin-denetle.mjs); özet satırı ikisinin toplamı (tools/kanit.mjs node:test biçimini okur).
  const result = denetle(texts);
  yazdir(result, { ozet: false });
  console.log(`ekran-banka: ${ekranGecen} denetim geçti, ${ekranBasarisiz} başarısız · metin-denetle: ${result.checked.length}/${result.checked.length + result.missing.length} ad ekranda`);
  console.log(`# tests ${ekranGecen + ekranBasarisiz + result.checked.length + result.missing.length}`);
  console.log(`# pass ${ekranGecen + result.checked.length}`);
  console.log(`# fail ${ekranBasarisiz + result.missing.length}`);
  if (result.missing.length) process.exitCode = 1;
} else {
  // Özet (tools/kanit.mjs tanır): denetimler + çekilen ekranlar; başarısız adım ve sayfa hatası başarısız sayılır.
  console.log(`${ekranGecen} denetim geçti, ${ekranBasarisiz} başarısız`);
}
rmSync(root, { recursive: true, force: true });
if (failed.length || errors.length) process.exitCode = 1;
