// 2.4.4 iş listesi 16 (KÖ3) — EKRANDAN: "Başlarken" ilk adımlar listesi.
//  A. Boş kurulum, yönetici: açılış ekranında kartın üstünde liste; 5 adım "Eksik"; açılış kartının başlığı ve yükleme alanı değişmez.
//  B. Adımlar listedeki kısa yollarla, gerçek tıklama + insan hızında yazımla tamamlanır (Şirketler → ad; Fatura Ayarları → firma bilgisi; Banka →
//     Kurulum Sihirbazı → ilk hesap; + Yeni Cari); her adımdan sonra liste kendiliğinden güncellenir ve veri tabanı (API) okunur (ders 3/12);
//     hepsi tamamlanınca liste kendiliğinden kalkar, yeniden yüklemede de çıkmaz; kullanıcı menüsünden açılan pencere "Tamamlandı" der.
//  C. 002: kendi durumu (adı verilmiş → 1/5); "Gizle" → liste kalkar, yeniden yüklemede de yok; kullanıcı menüsü → Başlarken → "Açılış Ekranında
//     Göster" → geri gelir.
//  D. Yetkisiz (personel): liste, menü girişi ve Hızlı Arama'da "Başlarken" yok.
//  E. 2.4.3'ten gelen veri (v2.4.3'ün gerçek koduyla üretilmiş fikstür): liste çıkmaz; menüden açılan pencere "önceki sürümden kurulu" der.
//  G5 (madde 30c): "Şirket Adını Yaz" açık şirketin "Şirketin Adı ve Kodu" penceresini doğrudan açar; kaydedince Başlarken'e dönülür ve adım Tamamlandı.
//  G4 (madde 30c): koyu düğme tek ve sıradaki (ilk eksik, yetkili) adımda; adım tamamlanınca bir sonrakine geçer (158d9c0'da company + seller hep koyu).
// 163dd5d'de kırmızı: #hof-getting-started yok. Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { unpackFixture } from "../guvenilirlik/fikstur.mjs";
import { escClose } from "./esc-kapat.mjs";

const ADMIN_PASS = "Test-Admin-2026!";
const STAFF_PASS = "Baslarken-Personel-2026!";
const root = mkdtempSync(path.join(tmpdir(), "baslarken-244-"));
const shots = process.env.EKRAN_DIR || root;
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
const modal = ".hof-modal-backdrop.is-visible";
const top = `${modal}:last-of-type`;
const GS = "#hof-getting-started";

let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    ok(false, `adım hata verdi: ${error.message.split("\n")[0]}`);
  }
};
const shot = (page, name) => page.screenshot({ path: path.join(shots, `baslarken-244-${name}.png`), fullPage: true }).catch(() => null);
const typeSlow = async (page, selector, value) => {
  await page.click(selector);
  await page.fill(selector, "");
  await page.type(selector, value, { delay: 25 });
};
const doneMap = page => page.$$eval(`${GS} [data-gs]`, nodes => Object.fromEntries(nodes.map(node => [node.dataset.gs, node.dataset.done === "1"]))).catch(() => null);
const progress = page => page.getAttribute(`${GS} [data-gs-progress]`, "data-gs-progress").catch(() => null);
const waitProgress = (page, value, timeout = 8000) => page.waitForFunction(([sel, v]) => document.querySelector(sel)?.dataset.gsProgress === v, [`${GS} [data-gs-progress]`, value], { timeout }).then(() => true, () => false);
// 2.4.4 madde 30c G4: koyu (birincil) düğmeler — yalnız sıradaki (ilk eksik, yetkili) adımda bir tane olmalı.
const primarySteps = page => page.$$eval(`${GS} [data-gs-step]`, nodes => nodes.filter(node => !node.classList.contains("hof-button-ghost")).map(node => node.dataset.gsStep)).catch(() => null);
const checkPrimary = async (page, expected, when) => {
  const list = await primarySteps(page);
  ok(Array.isArray(list) && list.length === 1 && list[0] === expected, `G4 ${when}: koyu düğme tek ve “${expected}” adımında (koyu olanlar: ${list === null ? "okunamadı" : list.join(", ") || "yok"})`);
};
const stateOf = page => page.evaluate(() => window.HOF?.gettingStarted?.state?.() || null);
// Liste yüklenene kadar bekle (ilk istek); null = okunmadı.
const waitState = page => page.waitForFunction(() => window.HOF?.gettingStarted?.state?.() !== null, null, { timeout: 15000 }).then(() => stateOf(page), () => null);
const closeAll = async page => {
  for (let i = 0; i < 6 && (await page.$(modal)); i += 1) await escClose(page, { expect: "soru-yok", step: "baslarken pencere kapat" });
};

async function login(browser, base, username, password) {
  const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, locale: "tr-TR" });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.errors = [];
  page.on("pageerror", error => page.errors.push(error.message));
  await page.goto(`${base}/`);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  return { context, page };
}
const openUserMenuEntry = async page => {
  await page.hover("#hof-sidecard .hof-user").catch(() => null);
  await page.click('#hof-sidecard [data-action="gettingStarted"]', { force: true });
  await page.waitForSelector(`${top} [data-gs-modal] [data-gs-progress], ${top} [data-gs-modal] [data-gs-unknown]`);
};

// Hızlı Arama (hof-palette.js): yazılan sözcüğün sonuç adları; kutu yoksa null (okunamadı — boş sayılmaz, ders 4).
async function searchLabels(page, query) {
  const input = await page.$("#hof-search input[name=hofSearch]");
  if (!input) return null;
  await input.click();
  await input.fill("");
  await input.type(query, { delay: 25 });
  await page.waitForTimeout(500);
  const labels = await page.$$eval(".hof-search-item .hof-search-label", nodes => nodes.map(node => node.textContent.trim()));
  await page.keyboard.press("Escape");
  return labels;
}

const browser = await chromium.launch();
const servers = [];
try {
  const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn" });
  servers.push(server);
  const api = await server.login();
  const { context, page } = await login(browser, server.base, "admin", ADMIN_PASS);

  await step("A. Boş kurulum: açılış ekranında Başlarken, 5 adım eksik; açılış kartı aynı", async () => {
    ok(await page.waitForSelector(GS, { timeout: 15000 }).then(() => true, () => false), "Başlarken listesi açılış ekranında görünür");
    ok((await page.textContent(`${GS} h3`))?.trim() === "Başlarken", "başlık “Başlarken”");
    const titles = await page.$$eval(`${GS} [data-gs] .hof-gs-text b`, nodes => nodes.map(node => node.textContent.trim()));
    ok(titles.join(" | ") === "Şirket Adını Yazın | Firma Bilgilerini Girin | Fatura Ayarlarını Kaydedin | İlk Banka Hesabını Açın | İlk Cariyi Açın", `adımlar: ${titles.join(" | ")}`);
    const map = await doneMap(page);
    ok(map && Object.values(map).length === 5 && Object.values(map).every(done => !done), `bütün adımlar eksik (${JSON.stringify(map)})`);
    ok((await progress(page)) === "0/5", "ilerleme 0/5");
    await checkPrimary(page, "company", "boş kurulum");
    ok((await page.textContent("#hof-start h2"))?.trim() === "Excelini yükle ya da Google Sheets linkini yapıştır, başlayalım", "açılış kartının başlığı değişmedi");
    ok(await page.isVisible("#hof-start .hof-drop"), "Excel yükleme alanı yerinde");
    ok(await page.$eval(GS, node => node.parentElement.id === "hof-start" && node.parentElement.firstElementChild === node), "liste açılış ekranının içinde, kartın üstünde");
    ok(Boolean(await page.$('#hof-sidecard [data-action="gettingStarted"]')), "kullanıcı menüsünde “Başlarken” girişi var");
    const found = await searchLabels(page, "Başlarken");
    ok(Array.isArray(found) && found.includes("Başlarken"), `yöneticinin Hızlı Arama'sında “Başlarken” var (${found === null ? "okunamadı" : found.join(", ")})`);
    await shot(page, "a-bos-kurulum");
  });

  await step("B1. Şirket Adını Yazın → “Şirket Adını Yaz” açık şirketin ad penceresini doğrudan açar; kaydedince Başlarken'e dönülür", async () => {
    // G5 (madde 30c): düğme adı "Şirket Adını Yaz" ("Şirket Aç" yeni şirket kurmak anlamına gelir); Şirketler listesinde ikinci tıklama gerekmez.
    const label = (await page.textContent(`${GS} [data-gs-step="company"]`).catch(() => ""))?.trim();
    ok(label === "Şirket Adını Yaz", `G5 düğme adı “Şirket Adını Yaz” (${label})`);
    await Promise.all([page.waitForURL(/admin\.html#companies/), page.click(`${GS} [data-gs-step="company"]`)]);
    ok(/admin\.html#companies/.test(page.url()), `kısa yol Yönetim → Şirketler'e gitti (${page.url().replace(server.base, "")})`);
    const direct = await page.waitForSelector(`${top} input[name="name"]`, { timeout: 8000 }).then(() => true, () => false);
    const title = direct ? (await page.textContent(`${top} .hof-modal-title, ${top} h2`).catch(() => ""))?.trim() : "";
    ok(direct && /Şirketin Adı ve Kodu/.test(title || ""), `G5 ad penceresi kendiliğinden açıldı (“${title || "açılmadı"}”)`);
    ok(direct && (await page.inputValue(`${top} input[name="code"]`).catch(() => "")) === "001", "pencere AÇIK şirketin (001) bilgisiyle dolu");
    if (!direct) await page.click('tr[data-company="sirket-001"] [data-c-edit]');
    await typeSlow(page, `${top} input[name="name"]`, "Mavi Muhasebe Ltd. Şti.");
    const saved = page.waitForResponse(res => /\/api\/companies\/sirket-001$/.test(new URL(res.url()).pathname) && res.request().method() === "PUT");
    await page.click(`${top} button[type="submit"]`);
    ok((await saved).status() === 200, "şirket adı kaydedildi (PUT 200)");
    const list = await must("şirketler", api.get("/api/companies"));
    ok(list.companies.find(item => item.id === "sirket-001")?.name === "Mavi Muhasebe Ltd. Şti.", "veri: 001 adı “Mavi Muhasebe Ltd. Şti.”");
    const back = await page.waitForSelector(GS, { timeout: 8000 }).then(() => true, () => false);
    ok(back && !/admin\.html/.test(page.url()), `G5 kaydedince ana ekrana (Başlarken) dönüldü (${page.url().replace(server.base, "")})`);
    if (!back) {
      await page.goto(`${server.base}/`);
      await page.waitForSelector(GS);
    }
    ok(await waitProgress(page, "1/5"), `ilerleme 1/5 (${await progress(page)})`);
    ok((await doneMap(page))?.company === true, "Şirket Adı “Tamamlandı”");
    await checkPrimary(page, "seller", "Şirket Adı tamamlanınca");
    // Yetkisi olmayan adımda düğme yerine not çıkar; koyu renk yetkisi olan ilk eksik adıma geçer. Listeyi görmek system.manage ister (Şirket Adı adımı
    // hep yetkili); salt okunur lisansta düşen Fatura Ayarları yetkisi (invoices.settings) yokmuş gibi — sayfa içinde, sonra geri alınır.
    await page.evaluate(() => {
      window.__gsCan = window.HOF.can;
      window.HOF.can = permission => (permission === "invoices.settings" ? false : window.__gsCan(permission));
      return window.HOF.gettingStarted.refresh();
    });
    await page.waitForSelector(`${GS} [data-gs="seller"] .hof-gs-noperm`, { timeout: 5000 }).catch(() => null);
    ok(Boolean(await page.$(`${GS} [data-gs="seller"] .hof-gs-noperm`)) && Boolean(await page.$(`${GS} [data-gs="invoiceSettings"] .hof-gs-noperm`)), "yetkisiz adımlarda (Firma Bilgileri, Fatura Ayarları) düğme yerine not");
    await checkPrimary(page, "bank", "ilk eksik adımların yetkisi yokken");
    await page.evaluate(() => {
      window.HOF.can = window.__gsCan;
      return window.HOF.gettingStarted.refresh();
    });
    await page.waitForSelector(`${GS} [data-gs-step="seller"]`, { timeout: 5000 }).catch(() => null);
    await checkPrimary(page, "seller", "yetki geri gelince");
  });

  await step("B2. Firma Bilgilerini Girin → Fatura Ayarları (Tab ve insan hızında yazım)", async () => {
    await page.click(`${GS} [data-gs-step="seller"]`);
    await page.waitForSelector('.hof-invoices-modal input[data-s="seller.taxNo"]');
    ok(/Fatura Ayarları/.test(await page.textContent(".hof-invoices-modal .hof-plan-title h3")), "kısa yol Fatura Ayarları ekranını açtı");
    await typeSlow(page, '.hof-invoices-modal input[data-s="seller.name"]', "Mavi Muhasebe Ltd. Şti.");
    await page.keyboard.press("Tab");
    await typeSlow(page, '.hof-invoices-modal input[data-s="seller.taxNo"]', "4840847211");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Kadıköy", { delay: 25 });
    await typeSlow(page, '.hof-invoices-modal input[data-s="seller.city"]', "İstanbul");
    await page.keyboard.press("Tab");
    const saved = page.waitForResponse(res => new URL(res.url()).pathname === "/api/workspace/invoices/settings" && res.request().method() === "PUT");
    await page.click('.hof-invoices-modal [data-act="save-settings"]');
    ok((await saved).status() === 200, "Fatura Ayarları kaydedildi (PUT 200)");
    const s = await must("fatura ayarları", api.get("/api/workspace/invoices/settings"));
    ok(s.seller.name === "Mavi Muhasebe Ltd. Şti." && s.seller.taxNo === "4840847211" && s.seller.taxOffice === "Kadıköy" && s.seller.city === "İstanbul", `veri: firma bilgisi kayıtlı (${s.seller.name} · ${s.seller.taxNo} · ${s.seller.taxOffice} · ${s.seller.city})`);
    await page.waitForTimeout(500);
    await closeAll(page);
    ok(await waitProgress(page, "3/5"), `pencere kapanınca liste kendiliğinden güncellendi: 3/5 (${await progress(page)})`);
    const map = await doneMap(page);
    ok(map?.seller === true && map?.invoiceSettings === true, "Firma Bilgileri ve Fatura Ayarları “Tamamlandı”");
    await checkPrimary(page, "bank", "Firma Bilgileri ve Fatura Ayarları tamamlanınca");
    await shot(page, "b2-firma");
  });

  await step("B3. İlk Banka Hesabını Açın → Banka → Kurulum Sihirbazı", async () => {
    await page.click(`${GS} [data-gs-step="bank"]`);
    const wizardForm = `${top} [data-wiz-form]`;
    let wizard = await page.waitForSelector(`${wizardForm} input[name="bankName"]`, { timeout: 8000 }).then(() => true, () => false);
    if (!wizard) {
      await page.click('[data-act="wizard"]');
      wizard = await page.waitForSelector(`${wizardForm} input[name="bankName"]`, { timeout: 8000 }).then(() => true, () => false);
    }
    ok(wizard, "Kurulum Sihirbazı hesap adımı açıldı");
    await typeSlow(page, `${wizardForm} input[name="bankName"]`, "Ziraat Bankası");
    await typeSlow(page, `${wizardForm} input[name="name"]`, "Ana TL Hesabı");
    const saved = page.waitForResponse(res => /\/api\/workspace\/bank\/(accounts|setup)/.test(new URL(res.url()).pathname) && res.request().method() === "POST", { timeout: 15000 });
    await page.click(`${wizardForm} [data-wiz="save-next"]`);
    const response = await saved.catch(() => null);
    ok(response?.status() === 200, `hesap kaydedildi (${response?.status() ?? "yanıt yok"})`);
    const accounts = await must("banka hesapları", api.get("/api/workspace/bank/accounts?status=all"));
    const list = Array.isArray(accounts) ? accounts : accounts.accounts || [];
    ok(list.length === 1 && list[0].bankName === "Ziraat Bankası", `veri: 1 banka hesabı (${list.map(item => item.bankName).join(", ")})`);
    await page.waitForTimeout(500);
    await closeAll(page);
    ok(await waitProgress(page, "4/5"), `liste güncellendi: 4/5 (${await progress(page)})`);
    await checkPrimary(page, "account", "Banka hesabı açılınca");
  });

  await step("B4. İlk Cariyi Açın → + Yeni Cari; hepsi tamamlanınca liste kendiliğinden kalkar", async () => {
    await page.click(`${GS} [data-gs-step="account"]`);
    await typeSlow(page, `${top} input[name="name"]`, "İlk Müşteri A.Ş.");
    const saved = page.waitForResponse(res => new URL(res.url()).pathname === "/api/workspace/accounts" && res.request().method() === "POST");
    await page.click(`${top} button[type="submit"]`);
    ok((await saved).status() === 200, "cari kaydedildi (POST 200)");
    const accounts = await must("cariler", api.get("/api/workspace/accounts"));
    const rows = Array.isArray(accounts) ? accounts : accounts.accounts || accounts.rows || [];
    ok(rows.length === 1, `veri: 1 cari (${rows.length})`);
    await page.waitForTimeout(400);
    await closeAll(page);
    const gone = await page.waitForSelector(GS, { state: "detached", timeout: 8000 }).then(() => true, () => false);
    ok(gone, "bütün adımlar tamamlanınca liste açılış ekranından kendiliğinden kalktı");
    const s = await stateOf(page);
    ok(s?.complete === true && s?.done === 5 && s?.show === false, `durum: ${s?.done}/${s?.total}, tamamlandı`);
    await page.reload();
    await page.waitForSelector("#hof-sidecard");
    await waitState(page);
    await page.waitForTimeout(800);
    ok(!(await page.$(GS)), "yeniden yüklemede de liste çıkmıyor");
    await openUserMenuEntry(page);
    ok(/Bütün adımlar tamamlandı/.test(await page.textContent(`${top} [data-gs-modal]`)), "kullanıcı menüsünden açılan pencere: “Bütün adımlar tamamlandı”");
    ok((await page.$$(`${top} [data-gs][data-done="1"]`)).length === 5, "pencerede 5 adım “Tamamlandı”");
    await shot(page, "b4-tamamlandi");
    await closeAll(page);
  });

  await step("C. 002: kendi durumu; Gizle kalıcı; menüden “Açılış Ekranında Göster”", async () => {
    const second = (await must("002 aç", api.post("/api/companies", { name: "İkinci Şirket A.Ş." }))).company;
    await must("002'yi seç", api.post("/api/companies/select", { id: second.id }));
    await page.goto(`${server.base}/`);
    await page.waitForSelector("#hof-sidecard");
    ok((await page.evaluate(() => window.HOF.companyId)) === second.id, "pencere 002'yi gösteriyor");
    ok(await page.waitForSelector(GS, { timeout: 15000 }).then(() => true, () => false), "002'de liste görünür (001 tamamlandığı hâlde)");
    ok(await waitProgress(page, "1/5"), `002: 1/5 (yalnız Şirket Adı; ${await progress(page)})`);
    await page.click(`${GS} [data-gs-hide]`);
    ok(await page.waitForSelector(GS, { state: "detached", timeout: 8000 }).then(() => true, () => false), "Gizle → liste kalktı");
    await page.reload();
    await page.waitForSelector("#hof-sidecard");
    await waitState(page);
    await page.waitForTimeout(800);
    ok(!(await page.$(GS)), "yeniden yüklemede gizli kaldı");
    await openUserMenuEntry(page);
    ok(/Liste açılış ekranında gizli/.test(await page.textContent(`${top} [data-gs-modal]`)), "pencere gizli olduğunu söylüyor");
    await page.click(`${top} [data-gs-show]`);
    await page.waitForTimeout(400);
    await closeAll(page);
    ok(await page.waitForSelector(GS, { timeout: 8000 }).then(() => true, () => false), "“Açılış Ekranında Göster” → liste geri geldi");
    await shot(page, "c-002");
    await must("001'e dön", api.post("/api/companies/select", { id: "sirket-001" }));
  });

  await step("D. Yetkisiz kullanıcı (personel): liste, menü girişi ve Hızlı Arama'da Başlarken yok", async () => {
    await must("personel", api.post("/api/admin/users", { username: "bpersonel", name: "Başlarken Personel", role: "personel", password: STAFF_PASS, mustChangePassword: false }));
    const staff = await login(browser, server.base, "bpersonel", STAFF_PASS);
    await staff.page.waitForTimeout(1500);
    ok(!(await staff.page.$(GS)), "personelde liste yok");
    ok(!(await staff.page.$('#hof-sidecard [data-action="gettingStarted"]')), "personelin menüsünde Başlarken yok");
    const res = await staff.page.evaluate(() => window.HOF.api("/api/workspace/getting-started"));
    ok(res && res.allowed === false && res.steps.length === 0, "sunucu personele adım döndürmüyor");
    const found = await searchLabels(staff.page, "Başlarken");
    ok(found !== null && !found.includes("Başlarken"), `Hızlı Arama'da Başlarken yok (sonuçlar: ${found === null ? "okunamadı" : found.join(", ") || "boş"})`);
    ok(staff.page.errors.length === 0, `personel sayfasında hata yok${staff.page.errors.length ? `: ${staff.page.errors.join(" | ")}` : ""}`);
    await staff.context.close();
  });
  ok(page.errors.length === 0, `yönetici sayfasında hata yok${page.errors.length ? `: ${page.errors.join(" | ")}` : ""}`);
  await context.close();

  await step("E. 2.4.3'ten gelen veri (v2.4.3'ün gerçek kodu): liste çıkmaz", async () => {
    const fixture = unpackFixture("surum-2.4.3-baslarken", { root: mkdtempSync(path.join(root, "eski-")) });
    const old = await bootVersion(CURRENT, { dataDir: fixture.dataDir, backupDir: fixture.backupDir, logLevel: "warn" });
    servers.push(old);
    const session = await login(browser, old.base, "admin", ADMIN_PASS);
    const s = await waitState(session.page);
    await session.page.waitForTimeout(800);
    ok(s?.established === true && s?.show === false, `001 “zaten kurulu” (${JSON.stringify(s && { done: s.done, established: s.established, show: s.show })})`);
    ok(Boolean(await session.page.$("#hof-start")) && !(await session.page.$(GS)), "açılış ekranı var, Başlarken listesi yok");
    await openUserMenuEntry(session.page);
    ok(/önceki sürümden kurulu/.test(await session.page.textContent(`${top} [data-gs-modal]`)), "menüden açılan pencere “önceki sürümden kurulu” der");
    await shot(session.page, "e-eski-veri");
    await closeAll(session.page);
    const oldApi = await old.login();
    const registry = fixture.fixture.registry;
    const second = registry.find(item => item.code === "002");
    const s2 = await must("002 durumu", oldApi.get(`/api/workspace/getting-started?hofCompany=${encodeURIComponent(second.id)}`));
    ok(s2.established === true && s2.show === false, "002 de “zaten kurulu”");
    ok(session.page.errors.length === 0, `sayfa hatası yok${session.page.errors.length ? `: ${session.page.errors.join(" | ")}` : ""}`);
    await session.context.close();
  });
} catch (error) {
  failed += 1;
  console.log(`  ✗ senaryo hata verdi: ${error.stack || error.message}`);
} finally {
  await browser.close().catch(() => null);
  for (const server of servers) await server.close().catch(() => null);
  if (!process.env.EKRAN_DIR) rmSync(root, { recursive: true, force: true });
}
console.log(`\n${passed} geçti, ${failed} kaldı`);
process.exit(failed ? 1 : 0);
