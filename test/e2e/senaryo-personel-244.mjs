// Senaryo 2.4.4 madde 19 — Personel Özlük (kullanıcı kararı 21.10.2026). Gerçek kullanıcı gibi EKRANDAN, sıfırdan, insan hızında yazım + Tab:
//  1. Boş veri: Personel Raporu → kartlar 0, "Henüz çalışan kartı yok".
//  2. "+ Yeni Personel": bütün alanlar + fotoğraf → kayıttan sonra veri tabanı (API) okunur, alanlar birebir (ders 12).
//  3. Aynı adlı iki çalışan (Mehmet Kaya ×2) iki ayrı satır; kartlar Toplam Maaş / Kayıtlı / Aktif / Ayrılan sayılarla.
//  4. Arama: ad (Türkçe küçük harf), TC No rakamları, görev; aramaya uymayan → "Aramaya uyan personel yok".
//  5. Kart: yalnız Personel Özeti (Evrak Listesi, Maaş Bordrosu, CV, İletişim YOK); Yaş Doğum Tarihi'nden (35).
//  6. Düzenle → İşten Ayrılış Tarihi → kart Ayrılanlar'a geçer; kartlar ve Toplam Maaş (yalnız aktif) değişir; tarih silinince Çalışanlar'a döner.
//  7. Geçersiz TC No ekranda hata + odak TC No alanında; kayıt yazılmaz.
//  8. Yetkisiz: personel kullanıcısı Personel Raporu'nu görmez, API 403; yönetici "Personel Özlük Görüntüleme" verince görür ama
//     "+ Yeni Personel" ve "Düzenle" yok; Performans Özeti sekmesi yok (reports.view yok).
//  9. Değişiklik Geçmişi'nde alan adı var, değer (TC, IBAN, maaş) yok.
// 10. İleri tarihli ayrılış (kullanıcı kararı 22.10.2026): yarın ayrılacak çalışan Çalışanlar'da "Ayrılacak · tarih" notuyla kalır, Aktif Çalışan ve Toplam
//     Maaş'ta sayılır; sahte saat ertesi güne ilerletilince (sunucu + tarayıcı) kendiliğinden Ayrılanlar'a geçer.
// Kırmızı kanıt: DEPO=<eski kopya> ile aynı senaryo eski kodda koşulur (ürün DEPO'dan yüklenir).
// Çalıştırma: npm run test:senaryo-personel-244 (ekran görüntüleri test/e2e/artifacts/senaryo-personel-244/).
import fs, { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(HERE, "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock, moveClock } = await import(pathToFileURL(path.join(HERE, "..", "helpers.mjs")).href);

const OUT = path.join(HERE, "artifacts", "senaryo-personel-244");
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const PASS = "Personel-244-Admin!";
const STAFF_PASS = "Personel-244-Kisi!";
// Sahte saat (ders 13): sunucu ve tarayıcı 22.10.2026'da durur; yaş ve tarih sırası bu güne göre.
const NOW = { time: "2026-10-22T10:00:00+03:00", fixed: true };
const root = mkdtempSync(path.join(tmpdir(), "destekofis-personel-244-"));
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0" }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f61" } });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
const errors = [];
let passed = 0;
let failed = 0;
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
const MODAL = ".hof-modal-backdrop.is-visible";
const WIN = ".hof-staff-modal";
const FORM = ".hof-staff-form";
let page = null;
let shotNo = 0;
const shot = async (name, target = page) => {
  shotNo += 1;
  await target.screenshot({ path: path.join(OUT, `${String(shotNo).padStart(2, "0")}-${name}.png`) });
};
const step = async (title, fn) => {
  console.log(`\n■ ${title}`);
  try {
    await fn();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ beklenmeyen hata: ${error.stack || error.message}`);
    await shot("hata").catch(() => null);
  }
};
// İnsan hızında yazım (ders 12): alanı tıkla, var olanı seç, harf harf yaz.
const typeInto = async (selector, value, target = page) => {
  const field = target.locator(selector);
  await field.click();
  await field.press("Control+A");
  await field.pressSequentially(value, { delay: 18 });
};
const login = async (target, username = "admin", password = PASS) => {
  target.on("pageerror", error => errors.push(`pageerror ${error.message}`));
  await installPageClock(target, app.config.now);
  await target.goto(`${BASE}/`);
  await target.fill("#hof-auth input[name=username]", username);
  await target.fill("#hof-auth input[name=password]", password);
  await Promise.all([target.waitForEvent("load"), target.click('#hof-auth button[type="submit"]')]);
  await target.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await target.waitForTimeout(600);
};
const kpis = async (target = page) => target.$$eval(`${WIN} [data-staff-kpis] > div`, nodes => Object.fromEntries(nodes.map(node => [node.dataset.kpi, node.querySelector("strong").textContent.trim()])));
const rows = async (target = page) => target.$$eval(`${WIN} [data-staff-list] tbody tr[data-staff-id]`, nodes => nodes.map(node => node.querySelector("td").textContent.trim()));
const tabCount = async (tab, target = page) => (await target.$eval(`${WIN} [data-staff-tab="${tab}"]`, node => node.querySelector("b")?.textContent.trim() || "")) || "";
const openWindow = async (target = page) => {
  await target.click('#hof-sidecard [data-action="reports"]');
  await target.waitForSelector(`${WIN} [data-staff-kpis]`, { timeout: 15000 });
  await target.waitForTimeout(300);
};
const closeTop = async (target = page) => {
  await target.keyboard.press("Escape");
  await target.waitForTimeout(300);
};
const money = minor => new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 2 }).format(minor / 100);
const dbRows = () => app.store.all("SELECT * FROM staff_members ORDER BY created_at, rowid");

try {
  await api.login("admin", PASS);
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  page = await context.newPage();
  await login(page);

  await step("1. Boş veri: Personel Raporu → kartlar sıfır, boş liste ipucu, sekmeler", async () => {
    await openWindow();
    ok((await page.$eval(`${MODAL} .hof-modal-title`, node => node.textContent.trim())) === "Personel Raporu", "pencere başlığı Personel Raporu");
    const k = await kpis();
    ok(k.salary === money(0) && k.registered === "0" && k.active === "0" && k.left === "0", `kartlar sıfır: ${JSON.stringify(k)}`);
    const labels = await page.$$eval(`${WIN} [data-staff-kpis] span`, nodes => nodes.map(node => node.textContent.trim()));
    ok(labels.join("|") === "Toplam Maaş|Kayıtlı Personel|Aktif Çalışan|Ayrılan Personel", `kart adları: ${labels.join(", ")}`);
    const tabs = await page.$$eval(`${WIN} [data-staff-tab]`, nodes => nodes.map(node => node.dataset.staffTab));
    ok(tabs.join(",") === "active,left,performance", `sekmeler Çalışanlar, Ayrılanlar, Performans Özeti (${tabs})`);
    ok(/Henüz çalışan kartı yok/.test(await page.$eval(`${WIN} [data-staff-empty]`, node => node.textContent)), "boş liste ipucu");
    await shot("bos-veri");
  });

  // Fotoğraf: tarayıcının kendi ürettiği PNG (ekran görüntüsünden bir parça); program JPEG'e çevirip küçültür.
  const photoPng = await page.screenshot({ clip: { x: 0, y: 0, width: 160, height: 160 } });

  await step("2. + Yeni Personel: bütün alanlar insan hızında + Tab, fotoğraf; kayıttan sonra veri tabanı birebir", async () => {
    await page.click(`${WIN} [data-staff-act="new"]`);
    await page.waitForSelector(`${FORM} input[name="fullName"]`);
    ok((await page.$eval(`${MODAL}:last-of-type .hof-modal-title`, node => node.textContent.trim())) === "Yeni Personel", "form başlığı Yeni Personel");
    await typeInto(`${FORM} input[name="fullName"]`, "Ayşe Yılmaz");
    await page.keyboard.press("Tab");
    await page.fill(`${FORM} input[name="birthDate"]`, "1990-10-23");
    await typeInto(`${FORM} input[name="tcNo"]`, "10000000146");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Muhasebe Uzmanı", { delay: 18 });
    await page.keyboard.press("Tab");
    await page.keyboard.type("45.000,50", { delay: 18 });
    await typeInto(`${FORM} input[name="bankName"]`, "Ziraat Bankası");
    await typeInto(`${FORM} input[name="iban"]`, "TR33 0006 1005 1978 6457 8413 26");
    await page.fill(`${FORM} input[name="hireDate"]`, "2020-03-01");
    await typeInto(`${FORM} input[name="usedLeaveDays"]`, "6");
    await typeInto(`${FORM} input[name="email"]`, "ayse.kisisel@ornek.com");
    await typeInto(`${FORM} input[name="phone"]`, "0532 111 22 33");
    await page.selectOption(`${FORM} select[name="education"]`, "Lisans");
    await typeInto(`${FORM} input[name="specialty"]`, "Vergi Mevzuatı");
    await typeInto(`${FORM} textarea[name="address"]`, "Atatürk Cad. No 5, Kadıköy / İstanbul");
    await page.setInputFiles(`${FORM} [data-staff-photo-file]`, { name: "ayse.png", mimeType: "image/png", buffer: photoPng });
    await page.waitForSelector(`${FORM} [data-staff-photo-preview] img`, { timeout: 8000 });
    ok(true, "fotoğraf ön izlemesi");
    await shot("yeni-personel-formu");
    await page.click(`${FORM} button[type="submit"]`);
    await page.waitForFunction(() => !document.querySelector(".hof-staff-form"), null, { timeout: 10000 });
    await page.waitForTimeout(500);
    const db = dbRows();
    const row = db[0] || {};
    ok(db.length === 1, `veri tabanında 1 kart (${db.length})`);
    ok(row.full_name === "Ayşe Yılmaz" && row.birth_date === "1990-10-23" && row.tc_no === "10000000146" && row.position === "Muhasebe Uzmanı", "ad, doğum, TC, görev birebir");
    ok(row.salary_minor === 4_500_050 && row.bank_name === "Ziraat Bankası" && row.iban === "TR330006100519786457841326", `maaş ${row.salary_minor} kuruş, banka, IBAN boşluksuz`);
    ok(row.hire_date === "2020-03-01" && row.leave_date === "" && row.used_leave_days === 6, "işe giriş, ayrılış boş, izin 6 gün");
    ok(row.email === "ayse.kisisel@ornek.com" && row.phone === "0532 111 22 33" && row.education === "Lisans" && row.specialty === "Vergi Mevzuatı" && row.address === "Atatürk Cad. No 5, Kadıköy / İstanbul", "e-posta, telefon, öğrenim, uzmanlık, adres birebir");
    ok(/^data:image\/jpeg;base64,/.test(row.photo) && Buffer.from(row.photo.split(",")[1], "base64").length <= 100 * 1024, `fotoğraf JPEG ve ≤ 100 KB (${Math.round(Buffer.from(String(row.photo).split(",")[1] || "", "base64").length / 1024)} KB)`);
  });

  await step("3. Aynı adlı iki çalışan iki ayrı satır; kartlar sayılarla", async () => {
    for (const [position, salary] of [["Kurye", "20.000"], ["Satış Temsilcisi", "25.000"]]) {
      await page.click(`${WIN} [data-staff-act="new"]`);
      await page.waitForSelector(`${FORM} input[name="fullName"]`);
      await typeInto(`${FORM} input[name="fullName"]`, "Mehmet Kaya");
      await typeInto(`${FORM} input[name="position"]`, position);
      await typeInto(`${FORM} input[name="salary"]`, salary);
      await page.click(`${FORM} button[type="submit"]`);
      await page.waitForFunction(() => !document.querySelector(".hof-staff-form"), null, { timeout: 10000 });
      await page.waitForTimeout(400);
    }
    const list = await rows();
    ok(list.filter(name => name.startsWith("Mehmet Kaya")).length === 2, `iki Mehmet Kaya satırı (${list.join(" | ")})`);
    ok(dbRows().length === 3, "veri tabanında 3 kart");
    const k = await kpis();
    ok(k.salary === money(4_500_050 + 2_000_000 + 2_500_000) && k.registered === "3" && k.active === "3" && k.left === "0", `kartlar: ${JSON.stringify(k)}`);
    ok((await tabCount("active")) === "3" && (await tabCount("left")) === "0", "sekme sayıları 3 / 0");
    const foot = await page.$eval(`${WIN} tfoot`, node => node.textContent.replace(/\s+/g, " ").trim());
    ok(/TOPLAM · 3 Personel/.test(foot) && foot.includes(money(9_000_050)), `alt TOPLAM satırı: ${foot}`);
    await shot("uc-calisan");
  });

  await step("4. Arama: ad, TC No, görev; uymayan arama ipucu; temizleyince hepsi", async () => {
    const search = `${WIN} [data-q]`;
    await typeInto(search, "ayşe");
    ok((await rows()).length === 1 && (await rows())[0].startsWith("Ayşe Yılmaz"), "\"ayşe\" → Ayşe Yılmaz");
    await typeInto(search, "1000000014");
    ok((await rows()).length === 1, "TC No rakamlarıyla bulunur");
    await typeInto(search, "kurye");
    ok((await rows()).length === 1, "görevle bulunur (Kurye)");
    await typeInto(search, "mehmet");
    ok((await rows()).length === 2, "\"mehmet\" → iki satır");
    await shot("arama-mehmet");
    await typeInto(search, "olmayan kişi");
    ok(/Aramaya uyan personel yok/.test(await page.$eval(`${WIN} [data-staff-empty]`, node => node.textContent)), "uymayan arama ipucu");
    await page.fill(search, "");
    await page.dispatchEvent(search, "input");
    ok((await rows()).length === 3, "temizlenince üç satır");
  });

  await step("5. Kart: yalnız Personel Özeti; Yaş 35; fotoğraf; Evrak/Bordro/CV/İletişim yok", async () => {
    await page.click(`${WIN} tr[data-staff-id]:has-text("Ayşe Yılmaz")`);
    await page.waitForSelector(`${MODAL} .hof-staff-card-modal [data-staff-card]`, { state: "visible" });
    await page.waitForTimeout(400);
    ok(await page.evaluate(() => { const card = document.querySelector(".hof-staff-card-modal"); const box = card.getBoundingClientRect(); return document.elementFromPoint(box.left + box.width / 2, box.top + 40)?.closest(".hof-staff-card-modal") === card; }), "kart penceresi listenin üstünde (görünür, tıklanabilir)");
    const card = await page.$eval(".hof-staff-card-modal", node => node.innerText);
    ok((await page.$eval(".hof-staff-card-modal .hof-eyebrow", node => node.textContent.trim())) === "PERSONEL ÖZETİ", "görünüm: Personel Özeti");
    ok(/Yaş\s*35 \(Doğum Tarihi 23\.10\.1990\)/.test(card), "Yaş 35 (Doğum Tarihi 23.10.1990)");
    ok(!/Evrak Listesi|Maaş Bordrosu|\bCV\b|İletişim/.test(card), "Evrak Listesi, Maaş Bordrosu, CV, İletişim sekmesi yok");
    ok(Boolean(await page.$(".hof-staff-card-modal img.hof-staff-photo")), "fotoğraf kartta");
    ok(card.includes("TR33 0006 1005 1978 6457 8413 26") && card.includes("10000000146") && card.includes("6 Gün"), "IBAN dörtlü, TC, izin gün");
    await shot("personel-ozeti");
  });

  await step("6. Düzenle → İşten Ayrılış Tarihi → Ayrılanlar'a geçer; kartlar ve Toplam Maaş; tarih silinince döner", async () => {
    await page.click('.hof-staff-card-modal [data-staff-card-act="edit"]');
    await page.waitForSelector(`${FORM} input[name="leaveDate"]`);
    ok((await page.$eval(`${FORM} input[name="salary"]`, node => node.value)) === "45.000,50", "düzenlemede maaş kayıtlı değerle gelir");
    await page.fill(`${FORM} input[name="leaveDate"]`, "2026-09-30");
    await page.click(`${FORM} button[type="submit"]`);
    await page.waitForFunction(() => !document.querySelector(".hof-staff-form"), null, { timeout: 10000 });
    await page.waitForTimeout(500);
    const toast = await page.$$eval(".hof-toasts *", nodes => nodes.map(node => node.textContent).join(" "));
    ok(/Ayşe Yılmaz Ayrılanlar'a geçti/.test(toast), "bildirim: Ayrılanlar'a geçti");
    let list = await rows();
    ok(!list.some(name => name.startsWith("Ayşe")) && list.length === 2, `Çalışanlar'da 2 satır, Ayşe yok (${list.join(" | ")})`);
    let k = await kpis();
    ok(k.salary === money(4_500_000) && k.registered === "3" && k.active === "2" && k.left === "1", `kartlar: ${JSON.stringify(k)} (Toplam Maaş yalnız aktif)`);
    await page.click(`${WIN} [data-staff-tab="left"]`);
    await page.waitForTimeout(300);
    list = await rows();
    ok(list.length === 1 && list[0].startsWith("Ayşe Yılmaz"), "Ayrılanlar'da Ayşe Yılmaz");
    const headers = await page.$$eval(`${WIN} thead th`, nodes => nodes.map(node => node.textContent.trim()));
    ok(headers.includes("İşten Ayrılış Tarihi") && (await page.$eval(`${WIN} tbody tr[data-staff-id]`, node => node.textContent)).includes("30.09.2026"), "Ayrılanlar'da ayrılış tarihi kolonu 30.09.2026");
    ok(dbRows().find(row => row.full_name === "Ayşe Yılmaz").leave_date === "2026-09-30", "veri tabanında ayrılış tarihi");
    await shot("ayrilanlar");
    await page.click(`${WIN} tr[data-staff-id]`);
    await page.waitForSelector('.hof-staff-card-modal [data-staff-card-act="edit"]');
    await page.click('.hof-staff-card-modal [data-staff-card-act="edit"]');
    await page.waitForSelector(`${FORM} input[name="leaveDate"]`);
    await page.fill(`${FORM} input[name="leaveDate"]`, "");
    await page.click(`${FORM} button[type="submit"]`);
    await page.waitForFunction(() => !document.querySelector(".hof-staff-form"), null, { timeout: 10000 });
    await page.waitForTimeout(500);
    ok((await rows()).length === 0 && /Ayrılan personel yok/.test(await page.$eval(`${WIN} [data-staff-empty]`, node => node.textContent)), "tarih silinince Ayrılanlar boş");
    k = await kpis();
    ok(k.active === "3" && k.left === "0" && k.salary === money(9_000_050), `kartlar geri: ${JSON.stringify(k)}`);
    await page.click(`${WIN} [data-staff-tab="active"]`);
    await page.waitForTimeout(300);
    ok((await rows()).length === 3, "Çalışanlar'da yine üç satır");
  });

  await step("7. Geçersiz TC No: ekranda hata, odak TC No alanında, kayıt yazılmaz", async () => {
    await page.click(`${WIN} [data-staff-act="new"]`);
    await page.waitForSelector(`${FORM} input[name="fullName"]`);
    await typeInto(`${FORM} input[name="fullName"]`, "Hatalı Kimlik");
    await typeInto(`${FORM} input[name="tcNo"]`, "10000000145");
    await page.click(`${FORM} button[type="submit"]`);
    await page.waitForFunction(() => document.querySelector(".hof-staff-form .hof-form-error")?.textContent.trim(), null, { timeout: 8000 });
    const error = await page.$eval(`${FORM} .hof-form-error`, node => node.textContent.trim());
    ok(/TC No geçersiz/.test(error), `hata: ${error}`);
    ok((await page.evaluate(() => document.activeElement?.name)) === "tcNo", "odak TC No alanında");
    ok(dbRows().length === 3, "kayıt yazılmadı (3)");
    await shot("gecersiz-tc");
    await closeTop();
    const leave = await page.$(`${MODAL}:last-of-type [data-answer="yes"]`);
    if (leave) {
      console.log("  · Kaydetmeden Kapat sorusu yanıtlandı (meşru: formda yazılmış, kaydedilmemiş ad ve TC var)");
      await leave.click();
      await page.waitForTimeout(300);
    }
  });

  await step("Performans Özeti sekmesi (yönetici: reports.view) eski özet ile", async () => {
    await page.click(`${WIN} [data-staff-tab="performance"]`);
    await page.waitForSelector(`${WIN} [data-staff-content] .hof-kpis`, { timeout: 8000 });
    const text = await page.$eval(`${WIN} [data-staff-content]`, node => node.innerText);
    ok(/Toplam Görev/.test(text) && /Tamamlanan/.test(text), "Performans Özeti: Toplam Görev, Tamamlanan");
    await shot("performans-ozeti");
    await page.click(`${WIN} [data-staff-tab="active"]`);
    await page.waitForSelector(`${WIN} [data-q]`);
    ok((await rows()).length === 3, "Çalışanlar'a dönünce liste ve arama yerinde");
    await closeTop();
  });

  await step("8. Yetkisiz kullanıcı: düğme görünmez, API 403; görüntüleme verilince görür, düzenleyemez", async () => {
    const created = await must("personel kullanıcı", api.post("/api/admin/users", { username: "per244", name: "Personel Kişi", role: "personel", password: STAFF_PASS, mustChangePassword: false }));
    const other = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "tr-TR" });
    await other.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
    const second = await other.newPage();
    await login(second, "per244", STAFF_PASS);
    ok(!(await second.isVisible('#hof-sidecard [data-action="reports"]')), "personelde Personel Raporu düğmesi görünmez");
    const status = await second.evaluate(() => fetch("/api/workspace/staff").then(response => response.status));
    ok(status === 403, `API 403 (${status})`);
    const id = created.id || created.user?.id;
    await must("görüntüleme yetkisi", api.patch(`/api/admin/users/${id}`, { grants: { add: ["staff.view"], remove: [] } }));
    await second.reload({ waitUntil: "load" });
    await second.waitForSelector("#hof-sidecard", { timeout: 30000 });
    await second.waitForTimeout(600);
    ok(await second.isVisible('#hof-sidecard [data-action="reports"]'), "görüntüleme verilince düğme görünür");
    await openWindow(second);
    ok((await rows(second)).length === 3, "üç çalışan görünür");
    ok(!(await second.$(`${WIN} [data-staff-act="new"]`)), "+ Yeni Personel yok");
    ok(!(await second.$(`${WIN} [data-staff-tab="performance"]`)), "Performans Özeti sekmesi yok (reports.view yok)");
    await second.click(`${WIN} tr[data-staff-id]`);
    await second.waitForSelector(".hof-staff-card-modal [data-staff-card]");
    ok(!(await second.$('.hof-staff-card-modal [data-staff-card-act="edit"]')) && !(await second.$('.hof-staff-card-modal [data-staff-card-act="delete"]')), "kartta Düzenle / Sil yok");
    const write = await second.evaluate(() => fetch("/api/workspace/staff", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fullName: "Sızma" }) }).then(response => response.status));
    ok(write === 403, `yazma API 403 (${write})`);
    await shot("yalniz-goruntuleme", second);
    await other.close();
  });

  await step("9. Değişiklik Geçmişi: alan adı var, değer yok", async () => {
    await page.goto(`${BASE}/admin.html#audit`, { waitUntil: "load" });
    await page.waitForSelector("#adm-audit-type", { timeout: 15000 });
    await page.selectOption("#adm-audit-type", "staff.");
    await page.waitForTimeout(900);
    const text = await page.$eval("#adm-audit", node => node.innerText);
    ok(/Personel kartını düzeltti/.test(text) && /Alanlar: İşten Ayrılış Tarihi/.test(text) && /Personel kartı ekledi/.test(text), "işlem türü ve alan adları görünür");
    ok(!/10000000146|TR33|45\.000|Ayşe|Mehmet|Atatürk|ornek\.com/.test(text), "TC, IBAN, maaş, ad, adres, e-posta değeri YOK");
    await shot("degisiklik-gecmisi");
  });

  await step("10. İleri tarihli ayrılış: bugün Ayrılacak notuyla Çalışanlar'da ve sayılır; ertesi gün kendiliğinden Ayrılanlar'a geçer", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.waitForSelector("#hof-sidecard", { timeout: 30000 });
    await page.waitForTimeout(600);
    await openWindow();
    await page.click(`${WIN} tr[data-staff-id]:has-text("Kurye")`);
    await page.waitForSelector(`${MODAL} .hof-staff-card-modal [data-staff-card-act="edit"]`, { state: "visible" });
    await page.click('.hof-staff-card-modal [data-staff-card-act="edit"]');
    await page.waitForSelector(`${FORM} input[name="leaveDate"]`);
    await page.fill(`${FORM} input[name="leaveDate"]`, "2026-10-23");
    await page.click(`${FORM} button[type="submit"]`);
    await page.waitForFunction(() => !document.querySelector(".hof-staff-form"), null, { timeout: 10000 });
    await page.waitForTimeout(500);
    const toast = await page.$$eval(".hof-toasts *", nodes => nodes.map(node => node.textContent).join(" "));
    ok(/Mehmet Kaya 23\.10\.2026 tarihine kadar Çalışanlar'da kalır/.test(toast), "bildirim: o tarihe kadar Çalışanlar'da kalır");
    const list = await rows();
    ok(list.length === 3 && list.some(name => /Mehmet Kaya.*Ayrılacak · 23\.10\.2026/.test(name)), `Çalışanlar'da 3 satır, Mehmet Kaya "Ayrılacak · 23.10.2026" (${list.join(" | ")})`);
    let k = await kpis();
    ok(k.active === "3" && k.left === "0" && k.salary === money(9_000_050), `kartlar: ${JSON.stringify(k)} (Ayrılacak sayılır)`);
    ok(dbRows().find(row => row.position === "Kurye").leave_date === "2026-10-23", "veri tabanında ayrılış tarihi 2026-10-23");
    await shot("ayrilacak");
    await closeTop();
    await moveClock(app.config.now, page, "2026-10-23T10:00:00+03:00");
    await openWindow();
    k = await kpis();
    ok(k.active === "2" && k.left === "1" && k.salary === money(7_000_050), `ertesi gün kartlar: ${JSON.stringify(k)}`);
    ok(!(await rows()).some(name => name.includes("Ayrılacak")), "Çalışanlar'da Ayrılacak kalmadı");
    await page.click(`${WIN} [data-staff-tab="left"]`);
    await page.waitForTimeout(300);
    const left = await rows();
    ok(left.length === 1 && left[0].startsWith("Mehmet Kaya"), `Ayrılanlar'da Mehmet Kaya (${left.join(" | ")})`);
    await shot("ertesi-gun-ayrilanlar");
    await closeTop();
  });
} catch (error) {
  failed += 1;
  console.log(`✗ kurulum hatası: ${error.stack || error.message}`);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 3).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} senaryo-personel-244: ${passed} geçti, ${failed} kaldı · depo ${ROOT} · ekran görüntüleri ${OUT}`);
  await browser.close();
  await app.close();
  fs.rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
