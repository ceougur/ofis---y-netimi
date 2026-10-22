// 2.4.3 EKRANDAN — form durumu izole ve ortak çekirdek (kullanıcı kararı 17.10.2026: "Form state yönetimini isolated (izole) hale getir.
// Dosya/resim yükleme işlemleri formun genel state'ini re-render etmesin ve uncommitted (kaydedilmemiş) verileri ezmesin. … tüm formlar için
// regresyon testi yaz"; "gerileme olmayacak şekilde yap her şeyi"). Keşif bulguları: D1 (Fatura Ayarları Logo / Kaşe), A4 / B4 / C1 (dolu form
// Esc / × / dışarı tıklamada sorusuz kapanıyor; açık listede Esc formu kapatıyor), A6 (bildirim yığılması), B5 / A11 / C8 (bildirim süresi,
// fare üstünde), A10 (kayıttan sonra odak), A16 (Ctrl+Enter), B10 (öneri listesinde ok tuşları), C10 (Geri tuşu, F5).
//
// Her form: alanlar gerçek tıklama + insan hızında yazım (+ Tab) ile doldurulur (ders 12) → formun iç yeniden çizim tetikleyicileri (dosya / resim
// seçimi, satır ekleme, seçici değiştirme, sekme değiştirme, başka oturumdan aynı kayda değişiklik) → değerler yerinde mi → Esc / × / dışarı
// tıklama "Kaydedilmemiş Değişiklik" sorar, "Forma Dön" değerleri korur → Kaydet → kaydedilen API'den okunur, girilenle aynı mı.
// Form listesi kaynaktan çıkarılır (formu açan her HOF.formModal / HOF.modal çağrısı); bu senaryoda ekrandan açılmayanlar adıyla yazılır.
// Çıkış: "N geçti, M kaldı" (kalan varsa çıkış kodu 1).
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { CURRENT, bootVersion } from "../guvenilirlik/surumler.mjs";
import { ADMIN_PASSWORD } from "../helpers.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(here, "..", "..", "client", "assets");
const root = mkdtempSync(path.join(tmpdir(), "senaryo-form-izolasyon-243-"));
const shots = process.env.EKRAN_DIR || root;
const iso = days => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return res.data;
};

// ---------- Kaynaktan form envanteri ----------
function formInventory() {
  const out = [];
  for (const name of readdirSync(ASSETS).filter(file => /^(hof-[a-z-]+|admin)\.js$/.test(file) && file !== "hof-core.js")) {
    const lines = readFileSync(path.join(ASSETS, name), "utf8").split(/\r?\n/);
    lines.forEach((line, index) => {
      const kind = /HOF\.formModal\(\{/.test(line) ? "formModal" : /HOF\.modal\(\{/.test(line) ? "modal" : "";
      if (!kind) return;
      const block = lines.slice(index, index + 6).join(" ");
      const title = ((/title:\s*([^\n]+?),\s*(?:eyebrow|size|body|intro|fields)\b/.exec(block) || /title:\s*([^,]+)/.exec(block) || [])[1] || "?").trim();
      let fn = "";
      for (let j = index; j >= 0; j -= 1) {
        const m = /^\s*(?:async\s+)?function\s+([\w$]+)/.exec(lines[j]);
        if (m) {
          fn = m[1];
          break;
        }
      }
      out.push({ site: `${name}:${index + 1}`, kind, fn, title: title.slice(0, 80) });
    });
  }
  return out;
}

const server = await bootVersion(CURRENT, { dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", edocEnabled: true });
const admin = await server.login();
const other = await server.login();
const BASE = server.base;
await must("kurulum geç", admin.post("/api/workspace/bank/setup/dismiss", {}));
const akin = await must("cari", admin.post("/api/workspace/accounts", { name: "Akın Ticaret", type: "customer", phone: "0532 111 22 33" }));
await must("cari 2", admin.post("/api/workspace/accounts", { name: "Akın Tekstil", type: "customer", phone: "0532 444 55 66" }));
await must("tedarikçi", admin.post("/api/workspace/accounts", { name: "Toptancı Yapı", type: "supplier" }));
await must("stok 1", admin.post("/api/workspace/stock", { kind: "goods", code: "VD-4", name: "Vida 4", unit: "Adet", salePrice: "10", unitPrice: "5", openingQty: "100" }));
await must("stok 2", admin.post("/api/workspace/stock", { kind: "goods", code: "VD-48", name: "Vida 48", unit: "Adet", salePrice: "12", unitPrice: "6", openingQty: "100" }));

let passed = 0;
let failed = 0;
const covered = [];
const ok = (cond, what) => {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`  ${cond ? "✓" : "✗"} ${what}`);
  return Boolean(cond);
};
const browser = await chromium.launch();
const errors = [];
const TOP = ".hof-modal-backdrop.is-visible";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function newPage(context, url = "/") {
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${BASE}${url}`);
  return page;
}
async function login(page) {
  await page.fill("#hof-auth input[name=username]", "admin");
  await page.fill("#hof-auth input[name=password]", ADMIN_PASSWORD);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
}
const topDialog = page => page.locator(`${TOP} .hof-modal`).last();
const modalCount = page => page.locator(TOP).count();
// İnsan hızında yazım: alana tıklanır, eski metin seçilip silinir, harf harf yazılır, Tab ile çıkılır.
async function typeInto(page, locator, text, { tab = true } = {}) {
  await locator.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Delete");
  await page.keyboard.type(text, { delay: 35 });
  if (tab) await page.keyboard.press("Tab");
}
const confirmShown = async page => {
  const title = page.locator(`${TOP} .hof-modal-title`, { hasText: "Kaydedilmemiş Değişiklik" });
  return title.waitFor({ timeout: 2500 }).then(() => true, () => false);
};
const answer = async (page, yes) => {
  await page.locator(`${TOP} [data-answer="${yes ? "yes" : "no"}"]`).last().click();
  await sleep(250);
};
const valuesOf = async (dialog, selectors) => {
  const out = {};
  for (const [key, selector] of Object.entries(selectors)) {
    const node = dialog.locator(selector).first();
    out[key] = await node.evaluate(el => (el.type === "checkbox" || el.type === "radio" ? el.checked : el.value)).catch(() => "(yok)");
  }
  return out;
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Kapatma koruması: Esc / × / dışarı tıklama → soru → "Forma Dön" → form açık ve değerler aynı.
async function guard(page, label, selectors) {
  const dialog = topDialog(page);
  const before = await valuesOf(dialog, selectors);
  const count = await modalCount(page);
  for (const way of ["Esc", "×", "dışarı tıklama"]) {
    if (way === "Esc") {
      await page.keyboard.press("Escape");
    } else if (way === "×") {
      await dialog.locator(".hof-modal-close").click();
    } else {
      const box = await page.locator(TOP).last().boundingBox();
      await page.mouse.click(box.x + 4, box.y + 4);
    }
    const asked = await confirmShown(page);
    ok(asked, `${label}: ${way} kaydedilmemiş değişikliği sordu`);
    if (asked) await answer(page, false);
    const after = await valuesOf(topDialog(page), selectors);
    ok((await modalCount(page)) === count && same(before, after), `${label}: "Forma Dön" sonrası form açık, değerler yerinde (${JSON.stringify(after).slice(0, 140)})`);
  }
}
async function closeClean(page) {
  for (let index = 0; index < 6 && (await modalCount(page)); index += 1) {
    await page.keyboard.press("Escape");
    await sleep(250);
    if (await page.locator(`${TOP} [data-answer="yes"]`).count()) await answer(page, true);
  }
}
const submit = async page => {
  await topDialog(page).locator('button[type="submit"]').last().click();
};
const shot = (page, name) => page.screenshot({ path: path.join(shots, `${name}.png`) }).catch(() => null);
let mainPage = null;
let d = null;
let invRow = null;
// Her form kendi parçasında koşar: biri düşerse (eski kodda pencere sorusuz kapanınca sonraki adım bulamaz) öbürleri yine denenir.
async function part(label, fn) {
  try {
    await fn();
  } catch (error) {
    failed += 1;
    console.log(`  ✗ ${label}: beklenmeyen hata: ${String(error?.message || error).split("\n")[0]}`);
  } finally {
    if (mainPage) {
      await closeClean(mainPage).catch(() => null);
      // Geri tuşu programdan çıkardıysa (eski kod, C10) sonraki parçalar programın içinde başlasın.
      if (!(await mainPage.evaluate(() => Boolean(window.HOF?.accounts?.open)).catch(() => false))) {
        console.log(`  · ${label} sonrası program sayfası kapanmıştı; yeniden açıldı`);
        await mainPage.goto(`${BASE}/`, { waitUntil: "load" }).catch(() => null);
        await mainPage.waitForFunction(() => Boolean(window.HOF?.invoices?.open && window.HOF?.accounts?.open) && document.querySelectorAll(".dynamic-table tbody tr").length > 2, null, { timeout: 30000 }).catch(() => null);
        await sleep(1500);
      }
    }
  }
}
const toastTexts = page => page.$$eval(".hof-toast-text", nodes => nodes.map(node => node.textContent)).catch(() => []);

try {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "tr-TR" });
  await context.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await newPage(context);
  mainPage = page;
  await login(page);
  // Tablo verisi (Kayıt kartı ve notu, Yeni Kayıt formu için): örnek Excel ekrandan yüklenir.
  await page.waitForSelector("#hof-start .hof-drop", { timeout: 20000 });
  await (await page.$("#hof-start .hof-drop input[type=file]")).setInputFiles(path.join(here, "..", "fixtures", "ornek-dosyalar.xlsx"));
  await page.waitForSelector(`${TOP} .hof-mapping`, { timeout: 30000 });
  await Promise.all([page.waitForEvent("load", { timeout: 30000 }), page.click(`${TOP} [data-mode="replace"]`)]);
  await page.waitForSelector(".hof-analysis-result:not([hidden])", { timeout: 20000 }).catch(() => {});
  await page.click(".hof-analysis-result [data-apply], .hof-analysis-result [data-done]", { timeout: 3000 }).catch(() => page.keyboard.press("Escape"));
  await sleep(1200);
  await page.goto(`${BASE}/`, { waitUntil: "load" });
  await page.waitForSelector("#hof-sidecard", { timeout: 30000 });
  await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open && window.HOF?.accounts?.open) && document.querySelectorAll(".dynamic-table tbody tr").length > 2, null, { timeout: 30000 });
  await sleep(2500);

  // ======================================================================================================================================
  await part("Bölüm A", async () => {
    console.log("■ A Ortak çekirdek sözleşmesi (HOF.formModal / HOF.modal / HOF.swap)");
    const openCore = () =>
      page.evaluate(() => {
        window.__coreSaved = null;
        window.HOF.formModal({
          title: "Çekirdek Denemesi",
          fields: [
            { name: "ad", label: "Ad", autofocus: true },
            { name: "tur", label: "Tür", type: "select", value: "a", options: [{ value: "a", label: "A Seçeneği" }, { value: "b", label: "B Seçeneği" }] },
            { name: "onay", label: "Onay", type: "checkbox" },
            { name: "not", label: "Not", type: "textarea" },
          ],
          onSubmit: data => {
            window.__coreSaved = data;
          },
        });
      });
    await openCore();
    await page.keyboard.press("Escape");
    ok(!(await confirmShown(page)) && (await modalCount(page)) === 0, "A1 temiz form Esc ile sorusuz kapanır");
    await openCore();
    await typeInto(page, topDialog(page).locator('input[name="ad"]'), "Kaybolmasın Adı");
    await page.keyboard.press("ArrowDown"); // odak Tür seçicisinde: klavyeyle B
    await topDialog(page).locator('input[name="onay"]').click();
    await typeInto(page, topDialog(page).locator('textarea[name="not"]'), "Birinci satır", { tab: false });
    await guard(page, "A2 çekirdek", { ad: 'input[name="ad"]', tur: 'select[name="tur"]', onay: 'input[name="onay"]', not: 'textarea[name="not"]' });
    // A16: Ctrl+Enter (metin alanında Enter yeni satır).
    await topDialog(page).locator('textarea[name="not"]').click();
    await page.keyboard.press("End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("İkinci satır", { delay: 30 });
    await page.keyboard.press("Control+Enter");
    await sleep(400);
    const coreSaved = await page.evaluate(() => window.__coreSaved);
    ok(coreSaved && coreSaved.ad === "Kaybolmasın Adı" && coreSaved.tur === "b" && coreSaved.onay === true && coreSaved.not === "Birinci satır\nİkinci satır" && (await modalCount(page)) === 0, `A3 Ctrl+Enter kaydetti: ${JSON.stringify(coreSaved)}`);
    // Kaydetmeden Kapat gerçekten kapatır.
    await openCore();
    await typeInto(page, topDialog(page).locator('input[name="ad"]'), "Vazgeçilecek");
    await page.keyboard.press("Escape");
    if (await confirmShown(page)) await answer(page, true);
    ok((await modalCount(page)) === 0 && !(await page.evaluate(() => window.__coreSaved)), "A4 \"Kaydetmeden Kapat\" kaydetmeden kapatır");
    // A5 HOF.swap yeniden çizimi: dokunulan alan korunur; programın değiştirdiği alan yeni değeri gösterir; Kaydet (markClean) sonrası kayıtlı değer.
    await page.evaluate(() => {
      window.__saved = { unvan: "Eski Unvan", adres: "Eski Adres", fiyat: "100" };
      const modal = window.HOF.modal({ title: "Yeniden Çizim Denemesi", body: '<div data-swap-root data-hof-form="deneme"></div>' });
      const rootNode = modal.dialog.querySelector("[data-swap-root]");
      window.__render = () => window.HOF.swap(rootNode, `<label class="hof-field"><span>Unvan</span><input data-s="unvan" value="${window.HOF.esc(window.__saved.unvan)}"></label><label class="hof-field"><span>Adres</span><input data-s="adres" value="${window.HOF.esc(window.__saved.adres)}"></label><label class="hof-field"><span>Fiyat</span><input data-s="fiyat" value="${window.HOF.esc(window.__saved.fiyat)}"></label>`);
      window.__clean = () => window.HOF.markClean(rootNode);
      window.__render();
    });
    await typeInto(page, topDialog(page).locator('[data-s="unvan"]'), "Yeni Unvan");
    await typeInto(page, topDialog(page).locator('[data-s="fiyat"]'), "250");
    await page.evaluate(() => {
      window.__saved.fiyat = "117,60"; // program alanı kendisi değiştirdi (ör. Net'ten Brüt)
      window.__render();
    });
    const swapped = await valuesOf(topDialog(page), { unvan: '[data-s="unvan"]', adres: '[data-s="adres"]', fiyat: '[data-s="fiyat"]' });
    ok(swapped.unvan === "Yeni Unvan" && swapped.adres === "Eski Adres" && swapped.fiyat === "117,60", `A5 yeniden çizim: dokunulan korunur, programın yazdığı gösterilir ${JSON.stringify(swapped)}`);
    ok(await page.evaluate(() => window.HOF.hasDirtyModal()), "A6 pencere kaydedilmemiş sayılıyor");
    await page.evaluate(() => {
      window.__saved.unvan = "Kaydedilen Unvan";
      window.__clean();
      window.__render();
    });
    const afterClean = await valuesOf(topDialog(page), { unvan: '[data-s="unvan"]' });
    ok(afterClean.unvan === "Kaydedilen Unvan" && !(await page.evaluate(() => window.HOF.hasDirtyModal())), `A7 Kaydet sonrası kayıtlı değer çizilir, soru kalkar (${afterClean.unvan})`);
    await page.keyboard.press("Escape");
    ok(!(await confirmShown(page)) && (await modalCount(page)) === 0, "A8 kaydedilmiş pencere Esc ile sorusuz kapanır");
    covered.push("Çekirdek (HOF.formModal / HOF.modal / HOF.swap)");

    // ======================================================================================================================================
  });
  await part("Bölüm B", async () => {
    console.log("\n■ B Bildirimler: yığılma (A6), süre (B5 / A11), fare üstünde (C8)");
    // 22.10.2026 (2.4.4 madde 7b) B4'ün ara sıra kırmızısının KÖK NEDENİ (kayıttan okundu; test/e2e/form-izolasyon-b4-yaris.mjs MODE=kurtarma-eski):
    // ürünün "kurtarma anahtarı oluşturun" hatırlatması (hof-workspace.js nudgeRecovery) açılıştan 6 sn sonra, pencere açıksa 20 sn arayla yeniden
    // bakar; bölüm A'nın pencereleri kapanınca ilk denetimde bir kez çıkar. B4'ün bekleme penceresine denk gelirse "Fare testi."ni yukarı iter (fare
    // dışarıda kalır → ürün tasarımı gereği sakladığı kalan süre sonunda kapanır). Ön koşul belirlenir: hatırlatma bu yönetici için "gösterildi" sayılır (ürünün kendi
    // 3 günlük kaydı); bölüm B'nin bildirim denetimlerine başka bildirim karışmaz.
    await page.evaluate(() => localStorage.setItem(`hof.recovery.nudge.${window.HOF.user?.id || ""}`, String(Date.now())));
    await page.evaluate(() => {
      document.querySelectorAll(".hof-toast").forEach(node => node.remove());
      for (let i = 0; i < 4; i += 1) window.HOF.toast("Bu carinin 1 taksit kartı var. Önce kartları silin.", { type: "error" });
    });
    const stacked = await page.$$eval(".hof-toast", nodes => nodes.map(node => ({ text: node.querySelector(".hof-toast-text")?.textContent, count: node.querySelector(".hof-toast-count")?.textContent || "" })));
    ok(stacked.length === 1 && stacked[0].count === "×4", `B1 aynı bildirim yığılmadı: ${JSON.stringify(stacked)}`);
    const durations = await page.evaluate(() => ({ short: window.HOF.toastDuration("Kaydedildi.", { type: "success" }), error: window.HOF.toastDuration("Kısa hata.", { type: "error", timeout: 7000 }), long: window.HOF.toastDuration("x".repeat(330), { type: "error" }) }));
    ok(durations.short >= 3600 && durations.error >= 7000 && durations.long >= 22000, `B2 süre metin uzunluğuna göre: ${JSON.stringify(durations)}`);
    const longText = "Alıcı e-Fatura mükellefi; belge e-Arşiv olarak kesilemez. Cari kartında Mükellef Sorgula ile posta kutusunu seçin ve yeniden kaydedin; numara harcanmadı.";
    await page.evaluate(text => {
      document.querySelectorAll(".hof-toast").forEach(node => node.remove());
      window.HOF.toastError(new Error(text));
    }, longText);
    await sleep(6000);
    ok((await toastTexts(page)).includes(longText), "B3 uzun hata iletisi 6 sn sonra hâlâ okunuyor (önce 3,6–5,2 sn)");
    // CI #837 (dd3fa08) B4 ara sıra kırmızı — test yarışı (test/e2e/form-izolasyon-b4-yaris.mjs): kutu ölçüldükten sonra sağ alttaki açılır
    // bildirim (bölüm A'daki pencereler kapanınca sırası gelir) açılıp/kapanınca bildirimler kutusu ~150 px kayıyor, fare bildirimin DIŞINA
    // konuyordu. Ön koşul belirlenir: açılır bildirimler kullanıcı ayarıyla kapatılır ("Sağ altta açılır bildirim göster"), açık olan × ile
    // kapanır, kutunun geçişleri bitene dek beklenir; fare konduktan sonra bildirimin İÇİNDE olduğu ölçülür (bekleme süresi uzatılmadı).
    const quietAlerts = mute => page.evaluate(on => {
      localStorage.setItem(`hof-notices-off:${window.HOF.user?.id || "?"}`, JSON.stringify(on));
      if (on) document.querySelectorAll("#hof-notices .hof-notice-close").forEach(button => button.click());
    }, mute);
    const settled = () => page.waitForFunction(() => !document.querySelector("#hof-notices .hof-notice") && !document.body.classList.contains("hof-notice-open") && (document.getElementById("hof-toasts")?.getAnimations({ subtree: true }).length ?? 0) === 0, null, { timeout: 5000 }).then(() => true, () => false);
    const noticeBefore = await page.evaluate(() => ({ open: document.querySelectorAll("#hof-notices .hof-notice").length, shifted: document.body.classList.contains("hof-notice-open") }));
    console.log(`  · B4 öncesi açılır bildirim: ${noticeBefore.open} (kutu kaymış: ${noticeBefore.shifted})`);
    await quietAlerts(true);
    const quiet = await settled();
    // 22.10.2026 (2.4.4 madde 7b) B4 yine ara sıra kırmızı (ön koşullar "true true"); kök neden araya giren kurtarma hatırlatması (bölüm B başı).
    // İkinci zamanlama açığı da kapatıldı (zorla: test/e2e/form-izolasyon-b4-yaris.mjs MODE=gec-fare): bildirimin 3,6 sn'si bildirim çıktığı anda
    // başlıyordu; ölçüm + fare hareketi makine yüklüyken bu süreyi aşarsa bildirim fare varmadan kapanmaya başlamış olur (kapanırken 250 ms ekranda
    // kalır → "fare içinde" ölçülür). Sıra artık süreye bağlı değil: bildirimin yeri önce
    // bir ölçüm bildirimiyle ölçülür, fare oraya konur, bildirim farenin ALTINDA açılır (ürün: kapanma anında fare üstündeyse kapanmaz), sonra
    // fare bildirimin içinde kıpırdatılır (ürün: fare hareketiyle bekletme). Fare ne zaman gelirse gelsin bildirim farenin altındadır.
    // Zorla üretme: FORM_IZOLASYON_B4_ZORLA_GEC=1 kıpırdatmayı bildirimin süresi dolduktan SONRAYA atar (ön koşul ölçülür, yazılır).
    const forceLate = process.env.FORM_IZOLASYON_B4_ZORLA_GEC === "1";
    await page.evaluate(() => {
      document.querySelectorAll(".hof-toast").forEach(node => node.remove());
      window.HOF.toast("Fare testi.", { type: "info" });
    });
    await settled();
    const toastBox = await page.locator(".hof-toast").first().boundingBox();
    const pointAt = [toastBox.x + 30, toastBox.y + toastBox.height / 2];
    // Ölçüm bildirimi kaldırılır; fare (bildirim yokken) bildirimin geleceği yere gerçek fare hareketiyle konur (metnin üstü, Kapat değil).
    await page.evaluate(() => document.querySelectorAll(".hof-toast").forEach(node => node.remove()));
    await page.mouse.move(pointAt[0], pointAt[1], { steps: 4 });
    const opened = await page.evaluate(([x, y]) => {
      const node = window.HOF.toast("Fare testi.", { type: "info" });
      const box = node.getBoundingClientRect();
      // Kayıt (bir sonraki kırmızıda nedeni okunur): araya giren bildirim, bildirimin fareden ilk ayrıldığı an ve o anki durum (pencere, açılır
      // bildirim, kapanıyor mu), kapanmaya başladığı an.
      const created = performance.now();
      const others = [];
      const watch = new MutationObserver(list => list.forEach(entry => entry.addedNodes.forEach(item => item !== node && others.push(item.querySelector?.(".hof-toast-text")?.textContent || item.className))));
      watch.observe(document.getElementById("hof-toasts"), { childList: true });
      const trace = { out: null, leftAt: null };
      const sampler = setInterval(() => {
        const t = Math.round(performance.now() - created);
        if (node.hofLeaving && trace.leftAt === null) trace.leftAt = t;
        const b = node.getBoundingClientRect();
        const over = node.isConnected && x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
        if (!over && !trace.out) trace.out = { t, box: [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)], connected: node.isConnected, leaving: Boolean(node.hofLeaving), modal: Boolean(document.querySelector(".hof-modal-backdrop.is-visible")), notice: document.body.classList.contains("hof-notice-open"), toasts: document.querySelectorAll(".hof-toast").length };
      }, 100);
      window.__b4 = { node, created, others, watch, trace, sampler };
      return { inside: x >= box.left && x <= box.right && y >= box.top && y <= box.bottom, duration: window.HOF.toastDuration("Fare testi.", { type: "info" }) };
    }, pointAt);
    if (forceLate) await page.waitForFunction(ms => performance.now() - window.__b4.created >= ms, opened.duration + 400, { timeout: 15000 });
    await page.mouse.move(pointAt[0] + 2, pointAt[1], { steps: 2 });
    const state = () => page.evaluate(([x, y]) => {
      const { node, created, others, trace } = window.__b4;
      const box = node.getBoundingClientRect();
      return { live: node.isConnected && !node.hofLeaving, inside: node.isConnected && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom, elapsed: Math.round(performance.now() - created), others: [...others], trace: JSON.parse(JSON.stringify(trace)) };
    }, [pointAt[0] + 2, pointAt[1]]);
    const atMove = await state();
    const placed = quiet && opened.inside && atMove.inside;
    if (forceLate) console.log(`  · B4 ZORLA: fare ${atMove.elapsed} ms'de kıpırdadı (bildirim süresi ${opened.duration} ms; ön koşul oluştu: ${atMove.elapsed > opened.duration})`);
    await sleep(4800);
    const atEnd = await state();
    await page.evaluate(() => {
      window.__b4.watch.disconnect();
      clearInterval(window.__b4.sampler);
    });
    const b4Ok = placed && atEnd.live && atEnd.inside;
    if (!b4Ok) console.log(`  · B4 kayıt: kıpırdatma ${atMove.elapsed} ms; fareden ilk ayrılış ${JSON.stringify(atEnd.trace.out)}; kapanmaya başladı ${atEnd.trace.leftAt ?? "—"} ms`);
    ok(b4Ok, `B4 fare üstündeyken bildirim kapanmadı (süre ${opened.duration} ms, ${atEnd.elapsed} ms sonra; ön koşul: açılır bildirim yok ${quiet}, fare bildirimin içinde ${placed}; araya giren bildirim: ${atEnd.others.length ? JSON.stringify(atEnd.others) : "yok"})`);
    const passes = await page.evaluate(([x, y]) => {
      const hit = document.elementFromPoint(x, y);
      return !hit?.closest(".hof-toast") ? `${hit?.tagName || "?"}` : "";
    }, [toastBox.x + 30, toastBox.y + toastBox.height / 2]);
    ok(Boolean(passes), `B6 bildirim altındaki öğeye tıklamayı engellemez (tıklanan: ${passes || "bildirim"})`);
    await page.mouse.move(5, 5, { steps: 4 });
    await sleep(4600);
    ok(!(await toastTexts(page)).includes("Fare testi."), "B5 fare ayrılınca kalan süre sonunda kapandı");
    await page.evaluate(() => {
      localStorage.setItem(`hof-notices-off:${window.HOF.user?.id || "?"}`, "false");
      window.HOF.alerts?.enqueue?.();
    });

    // ======================================================================================================================================
  });
  await part("Bölüm C", async () => {
    console.log("\n■ C Tarayıcının Geri tuşu ve F5 (C10)");
    const appUrl = page.url();
    await page.evaluate(() => window.HOF.accounts.open());
    await page.waitForSelector(`${TOP} tr[data-account]`);
    await page.click(`${TOP} tr[data-account]`);
    await page.waitForSelector(`${TOP} [data-entry="in"]`);
    await page.goBack({ timeout: 4000 }).catch(() => null);
    await sleep(600);
    ok(page.url() === appUrl && (await modalCount(page)) === 1 && (await page.locator(`${TOP} tr[data-account]`).count()) > 0, "C1 Geri: cari kartından listeye döndü, program açık");
    await page.goBack({ timeout: 4000 }).catch(() => null);
    await sleep(600);
    ok(page.url() === appUrl && (await modalCount(page)) === 0 && (await page.locator("#hof-sidecard").count()) === 1, "C2 Geri: pencere kapandı, programdan çıkılmadı");
    await page.evaluate(() => window.HOF.accounts.newFor({}));
    await page.waitForSelector(`${TOP} input[name="name"]`);
    await typeInto(page, topDialog(page).locator('input[name="name"]'), "Geri Tuşu Denemesi");
    await page.goBack({ timeout: 4000 }).catch(() => null);
    const backAsked = await confirmShown(page);
    ok(backAsked, "C3 Geri: dolu formda kaydedilmemiş değişikliği sordu");
    if (backAsked) await answer(page, false);
    ok((await topDialog(page).locator('input[name="name"]').inputValue().catch(() => "")) === "Geri Tuşu Denemesi" && page.url() === appUrl, "C4 Forma Dön: değer yerinde, program açık");
    const dialogs = [];
    const onDialog = dialog => {
      dialogs.push(dialog.type());
      dialog.dismiss().catch(() => {});
    };
    page.on("dialog", onDialog);
    await page.reload({ timeout: 4000 }).catch(() => null);
    await sleep(500);
    page.off("dialog", onDialog);
    ok(dialogs.includes("beforeunload") && (await topDialog(page).locator('input[name="name"]').inputValue().catch(() => "")) === "Geri Tuşu Denemesi", `C5 F5: tarayıcı ayrılmayı sordu, form kaldı (${dialogs.join(",") || "soru yok"})`);
    // C6: programın kendi yenilemesi (yeni şirket açıldı, şirket değişti, oturum düştü…) sorulmaz — senaryo-217'de "Yeni Şirket" kaydı yenilemeyi beklerken
    // ilk denemede takıldı.
    const scriptDialogs = [];
    const onScriptDialog = dialog => {
      scriptDialogs.push(dialog.type());
      dialog.dismiss().catch(() => {});
    };
    page.on("dialog", onScriptDialog);
    const reloaded = await Promise.all([page.waitForEvent("load", { timeout: 8000 }).then(() => true, () => false), page.evaluate(() => setTimeout(() => location.reload(), 50))]).then(([value]) => value);
    page.off("dialog", onScriptDialog);
    ok(reloaded && !scriptDialogs.length, `C6 programın yenilemesi dolu formda sorusuz yenilendi (${scriptDialogs.join(",") || "soru yok"})`);
    await page.waitForFunction(() => Boolean(window.HOF?.invoices?.open && window.HOF?.accounts?.open) && document.querySelectorAll(".dynamic-table tbody tr").length > 2, null, { timeout: 30000 });
    await sleep(1500);
    // C7: yenilemeden sonra (geçmişte eski belgenin pencere kaydı kalır) pencere açıp kapatmak belgeyi değiştirmez.
    await page.evaluate(() => {
      window.__ayniBelge = true;
      window.HOF.formModal({ title: "Yenileme Sonrası", fields: [{ name: "x", label: "X" }], onSubmit: () => {} });
    });
    await page.keyboard.press("Escape");
    await sleep(1500);
    ok((await page.evaluate(() => window.__ayniBelge === true).catch(() => false)) && page.url() === appUrl, "C7 yenilemeden sonra pencere kapatmak sayfayı değiştirmedi");
    await closeClean(page);

    // ======================================================================================================================================
  });
  console.log("\n■ D Gerçek formlar");
  await part("D1", async () => {
    // D1 Yeni Cari (+ Alan Ekle ve Tür değişimi iç tetikleyici)
    await page.evaluate(() => window.HOF.accounts.open());
    await page.waitForSelector(`${TOP} [data-act="new"]`);
    await page.click(`${TOP} [data-act="new"]`);
    await page.waitForSelector(`${TOP} input[name="phone"]`);
    d = topDialog(page);
    await typeInto(page, d.locator('input[name="name"]'), "Form İzolasyon Ltd. Şti.");
    await typeInto(page, d.locator('input[name="phone"]'), "0533 765 43 21");
    await typeInto(page, d.locator('input[name="email"]'), "bilgi@izolasyon.com.tr");
    await typeInto(page, d.locator('textarea[name="address"]'), "Atatürk Cad. No 5 Çankaya", { tab: false });
    await d.locator('select[name="type"]').focus();
    await page.keyboard.press("ArrowDown"); // Tedarikçi
    await d.locator("[data-add-field]").click();
    await sleep(300);
    const cariSel = { name: 'input[name="name"]', phone: 'input[name="phone"]', email: 'input[name="email"]', address: 'textarea[name="address"]', type: 'select[name="type"]' };
    const cariBefore = await valuesOf(d, cariSel);
    ok(cariBefore.name === "Form İzolasyon Ltd. Şti." && cariBefore.phone === "0533 765 43 21" && cariBefore.type === "supplier", `D1 Yeni Cari: + Alan Ekle ve Tür değişiminden sonra değerler yerinde ${JSON.stringify(cariBefore)}`);
    await guard(page, "D1 Yeni Cari", cariSel);
    await submit(page);
    await page.waitForFunction(() => !document.querySelector(".hof-modal-backdrop.is-visible .hof-acc-form"), null, { timeout: 8000 }).catch(() => null);
    const found = (await must("cari ara", admin.get(`/api/workspace/accounts/search?q=${encodeURIComponent("Form İzolasyon")}`))) || [];
    const newCari = found[0] ? await must("cari oku", admin.get(`/api/workspace/accounts/${found[0].id}`)) : null;
    ok(newCari && newCari.name === "Form İzolasyon Ltd. Şti." && newCari.phone === "0533 765 43 21" && newCari.email === "bilgi@izolasyon.com.tr" && newCari.address === "Atatürk Cad. No 5 Çankaya" && newCari.type === "supplier", `D1 kaydedilen = girilen (${JSON.stringify(newCari && { name: newCari.name, phone: newCari.phone, email: newCari.email, type: newCari.type })})`);
    covered.push("Yeni Cari (hof-accounts editAccount)");
    await closeClean(page);

  });
  await part("D2", async () => {
    // D2 Cariyi Düzenle + başka oturumdan aynı kayda değişiklik (arka plan yenilemesi)
    await page.evaluate(id => window.HOF.accounts.open(id), akin.id);
    await page.waitForSelector(`${TOP} [data-act="edit"]`);
    await page.click(`${TOP} [data-act="edit"]`);
    await page.waitForSelector(`${TOP} .hof-acc-form input[name="phone"]`);
    d = topDialog(page);
    await typeInto(page, d.locator('input[name="phone"]'), "0544 000 11 22");
    await typeInto(page, d.locator('textarea[name="note"]'), "Ekrandan yazılan not", { tab: false });
    await must("başka oturum aynı cariyi değiştirdi", other.put(`/api/workspace/accounts/${akin.id}`, { name: "Akın Ticaret", type: "customer", phone: "0555 999 99 99", email: "baska@oturum.com" }));
    await sleep(2500);
    const editVals = await valuesOf(topDialog(page), { phone: 'input[name="phone"]', note: 'textarea[name="note"]', email: 'input[name="email"]' });
    ok(editVals.phone === "0544 000 11 22" && editVals.note === "Ekrandan yazılan not", `D2 Cariyi Düzenle: başka oturumun değişikliği açık formu ezmedi ${JSON.stringify(editVals)}`);
    await guard(page, "D2 Cariyi Düzenle", { phone: 'input[name="phone"]', note: 'textarea[name="note"]' });
    // 2.4.3 UX1 (bilerek): form açıkken kayıt başka oturumda değiştiyse ilk Kaydet 409 (account-stale) alır; form güncel hâli yükler, kullanıcının
    // değiştirdiği alanlar yerinde kalır, öbür alanlar (başka oturumun e-postası) güncel değeri alır; ikinci Kaydet yazar.
    await submit(page);
    await sleep(1500);
    const staleText = await page.evaluate(() => document.body.innerText);
    ok(/başka biri tarafından değiştirildi/.test(staleText), "D2 eşzamanlı kayıt uyarısı göründü (UX1)");
    const afterStale = await valuesOf(topDialog(page), { phone: 'input[name="phone"]', note: 'textarea[name="note"]', email: 'input[name="email"]' });
    ok(afterStale.phone === "0544 000 11 22" && afterStale.note === "Ekrandan yazılan not" && afterStale.email === "baska@oturum.com", `D2 uyarıdan sonra yazılanlar yerinde, öbür alan güncel ${JSON.stringify(afterStale)}`);
    await submit(page);
    await sleep(1500);
    const akinNow = await must("cari oku", admin.get(`/api/workspace/accounts/${akin.id}`));
    ok(akinNow.phone === "0544 000 11 22" && akinNow.note === "Ekrandan yazılan not" && akinNow.email === "baska@oturum.com", `D2 kaydedilen = girilen + öbür oturumun alanı korundu (${akinNow.phone} · ${akinNow.note} · ${akinNow.email})`);
    covered.push("Cariyi Düzenle (hof-accounts editAccount)");

  });
  await part("D3", async () => {
    // D3 Cari Tahsilat (+ Tahsilat) — Enter ile kaydet, odak (A10)
    await page.evaluate(id => window.HOF.accounts.open(id), akin.id);
    await page.waitForSelector(`${TOP} [data-entry="in"]`);
    await page.click(`${TOP} [data-entry="in"]`);
    await page.waitForSelector(`${TOP} input[name="amount"]`);
    d = topDialog(page);
    await typeInto(page, d.locator('input[name="amount"]'), "1.250,50");
    const noteField = d.locator('input[name="note"], textarea[name="note"], input[name="description"]').first();
    if (await noteField.count()) await typeInto(page, noteField, "Tahsilat açıklaması", { tab: false });
    await guard(page, "D3 Cari Tahsilat", { amount: 'input[name="amount"]' });
    await d.locator('input[name="amount"]').click();
    await page.keyboard.press("Enter");
    await sleep(2500);
    const focusAfter = await page.evaluate(() => {
      const node = document.activeElement;
      return node && node !== document.body ? `${node.tagName}${node.dataset.entry ? `[data-entry=${node.dataset.entry}]` : ""}` : "BODY";
    });
    ok(focusAfter !== "BODY", `D3 kayıttan sonra odak kaybolmadı (A10): ${focusAfter}`);
    const entries = await must("cari hareketleri", admin.get(`/api/workspace/accounts/${akin.id}`));
    const entryList = entries.entries || entries.moves || [];
    ok(JSON.stringify(entryList).includes("1250.5"), `D3 tahsilat kaydedildi (1.250,50) — ${entryList.length} hareket`);
    covered.push("Cari Tahsilat / Ödeme (hof-accounts editEntry)");
    await closeClean(page);

  });
  await part("D4", async () => {
    // D4 Kayıt kartı: Not Ekle (Ctrl+Enter) ve Yeni Kayıt
    await page.locator(".dynamic-table tbody tr").nth(1).locator("td").first().click({ position: { x: 12, y: 10 } });
    await page.waitForSelector('.hof-case-actions [data-case-action="note"]', { timeout: 10000 });
    await page.click('.hof-case-actions [data-case-action="note"]');
    await page.waitForSelector(`${TOP} textarea[name="note"]`);
    await typeInto(page, topDialog(page).locator('textarea[name="note"]'), "Form izolasyonu notu", { tab: false });
    await guard(page, "D4 Not Ekle", { note: 'textarea[name="note"]' });
    await topDialog(page).locator('textarea[name="note"]').click();
    await page.keyboard.press("Control+Enter");
    const noteSaved = await page.waitForFunction(() => document.querySelector("#hof-activity")?.textContent.includes("Form izolasyonu notu"), null, { timeout: 10000 }).then(() => true, () => false);
    ok(noteSaved && (await modalCount(page)) === 0, "D4 Not Ekle Ctrl+Enter ile kaydedildi (İşlem Geçmişi'nde)");
    covered.push("Not Ekle (hof-workspace note)");
    await page.click("#hof-toolbar-new");
    await page.waitForSelector(`${TOP} .hof-record-grid`);
    await typeInto(page, topDialog(page).locator('input[name="c1"]'), "İzolasyon Borçlu");
    await guard(page, "D4b Yeni Kayıt", { c1: 'input[name="c1"]' });
    await closeClean(page);
    covered.push("Yeni Kayıt Oluştur (hof-table)");

  });
  await part("D5", async () => {
    // D5 Satış Faturası: cari ve stok önerisinde ok tuşları (B10), açık listede Esc (B4), + Kalem Ekle yeniden çizimi
    await page.evaluate(() => window.HOF.invoices.open({ account: {} }));
    await page.waitForSelector(`${TOP} [data-act="new"]`);
    await page.click(`${TOP} [data-act="new"]`);
    await page.click(`${TOP} [data-scenario="goods_sale"]`);
    await page.waitForSelector(`${TOP} [data-lines]`);
    d = topDialog(page);
    await d.locator("[data-acc-query]").click();
    await page.keyboard.type("Akın T", { delay: 60 });
    await page.waitForSelector(`${TOP} .hof-acc-picker li[data-id] >> nth=1`);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    const marked = await d.locator(".hof-acc-picker li.is-active").innerText().catch(() => "");
    await page.keyboard.press("Enter");
    await sleep(500);
    const pickedAcc = await d.locator("[data-acc-query]").inputValue();
    ok(/Akın/.test(marked) && pickedAcc === marked.split(/\n| · /)[0].trim(), `D5 cari önerisinde Aşağı ok + Enter ikinci satırı seçti (${pickedAcc})`);
    await d.locator('[data-l="0"][data-f="name"]').click();
    await page.keyboard.type("Vida 4", { delay: 60 });
    await page.waitForSelector(`${TOP} .hof-inv-item-hits:not([hidden]) li[data-item] >> nth=1`);
    await page.keyboard.press("Escape");
    await sleep(300);
    ok((await modalCount(page)) === 1 && (await d.locator(".hof-inv-item-hits:not([hidden])").count()) === 0, "D5 açık stok listesinde Esc yalnız listeyi kapattı (form açık)");
    await page.keyboard.type("8", { delay: 60 });
    await page.keyboard.press("Backspace");
    await page.waitForSelector(`${TOP} .hof-inv-item-hits:not([hidden]) li[data-item] >> nth=1`);
    const hitNames = await d.locator(".hof-inv-item-hits:not([hidden]) li[data-item] b").allInnerTexts();
    const target = hitNames.findIndex(text => /Vida 48/.test(text));
    for (let i = 0; i <= target; i += 1) await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await sleep(800);
    ok((await d.locator('[data-l="0"][data-f="name"]').inputValue()) === "Vida 48", `D5 stok önerisinde ok tuşlarıyla "Vida 48" seçildi (liste: ${hitNames.join(" | ")})`);
    await typeInto(page, d.locator('[data-l="0"][data-f="qty"]'), "3");
    await typeInto(page, d.locator('[data-l="0"][data-f="unitPrice"]'), "15");
    await d.locator('[data-act="add-line"]').click();
    await sleep(300);
    await typeInto(page, d.locator('[data-l="1"][data-f="name"]'), "Montaj Hizmeti");
    await sleep(300);
    await typeInto(page, d.locator('[data-l="1"][data-f="unitPrice"]'), "40");
    await sleep(1500);
    const invSel = { acc: "[data-acc-query]", n0: '[data-l="0"][data-f="name"]', q0: '[data-l="0"][data-f="qty"]', p0: '[data-l="0"][data-f="unitPrice"]', n1: '[data-l="1"][data-f="name"]', p1: '[data-l="1"][data-f="unitPrice"]' };
    const invVals = await valuesOf(topDialog(page), invSel);
    ok(invVals.n0 === "Vida 48" && invVals.q0 === "3" && invVals.p0 === "15" && invVals.n1 === "Montaj Hizmeti" && invVals.p1 === "40", `D5 + Kalem Ekle sonrası değerler yerinde ${JSON.stringify(invVals)}`);
    await guard(page, "D5 Satış Faturası", invSel);
    const invBefore = server.app.store.get("SELECT COUNT(*) AS n FROM invoices").n;
    await topDialog(page).locator('[data-act="issue"]').click();
    const yes = await page.waitForSelector(`${TOP} [data-answer="yes"]`, { timeout: 4000 }).then(() => true, () => false);
    if (yes) await answer(page, true);
    await page.waitForFunction(() => !document.querySelector(".hof-invoices-modal.is-form"), null, { timeout: 10000 }).catch(() => null);
    invRow = server.app.store.get("SELECT id FROM invoices ORDER BY rowid DESC LIMIT 1");
    const inv = invRow ? await must("fatura oku", admin.get(`/api/workspace/invoices/${invRow.id}`)) : null;
    const lineText = inv ? inv.lines.map(line => `${line.name}×${line.qty}@${line.unitPrice}`).join(", ") : "";
    ok(server.app.store.get("SELECT COUNT(*) AS n FROM invoices").n === invBefore + 1 && /Akın/.test(inv?.accountName || "") && /Vida 48×3@15/.test(lineText) && /Montaj Hizmeti×1@40/.test(lineText), `D5 kaydedilen = girilen (${inv?.accountName} · ${lineText})`);
    ok(!(await page.locator(`${TOP} .hof-invoices-modal.is-form`).count()), "D5 kaydedince form kapsamı kalktı (kart görünümü)");
    await page.keyboard.press("Escape");
    ok(!(await confirmShown(page)), "D5 kaydedilmiş faturanın kartı Esc ile sorusuz kapanır");
    await closeClean(page);
    covered.push("Satış Faturası (hof-invoices startForm)");

  });
  await part("D6", async () => {
    // D6 Satıştan İade: iade formu (kalem miktarı) kapatma koruması
    await page.evaluate(id => window.HOF.invoices.open({ originalId: id }), invRow.id);
    await page.waitForSelector(`${TOP} .hof-invoices-modal.is-form [data-lines]`, { timeout: 10000 }).catch(() => null);
    const retQty = topDialog(page).locator('[data-l="0"][data-f="qty"]');
    if (await retQty.count()) {
      await typeInto(page, retQty, "1");
      await guard(page, "D6 Satıştan İade", { q0: '[data-l="0"][data-f="qty"]' });
      covered.push("Satıştan İade (hof-invoices startReturn)");
    } else ok(false, "D6 iade formu açılmadı");
    await closeClean(page);

  });
  await part("D7", async () => {
    // D7 Alış Faturası: tedarikçi seçimi + kalem, kapatma koruması
    await page.evaluate(() => window.HOF.invoices.open({ account: {} }));
    await page.waitForSelector(`${TOP} [data-act="new"]`);
    await page.click(`${TOP} [data-act="new"]`);
    await page.click(`${TOP} [data-scenario="goods_purchase"]`);
    await page.waitForSelector(`${TOP} [data-lines]`);
    d = topDialog(page);
    await d.locator("[data-acc-query]").click();
    await page.keyboard.type("Toptan", { delay: 60 });
    await page.waitForSelector(`${TOP} .hof-acc-picker li[data-id]`);
    await page.keyboard.press("Escape");
    await sleep(250);
    ok((await modalCount(page)) === 1, "D7 açık tedarikçi listesinde Esc yalnız listeyi kapattı");
    await typeInto(page, d.locator('[data-l="0"][data-f="name"]'), "Çimento Torbası");
    await sleep(300);
    await typeInto(page, d.locator('[data-l="0"][data-f="unitPrice"]'), "320");
    await guard(page, "D7 Alış Faturası", { acc: "[data-acc-query]", n0: '[data-l="0"][data-f="name"]', p0: '[data-l="0"][data-f="unitPrice"]' });
    await closeClean(page);
    covered.push("Alış Faturası (hof-invoices startForm)");

  });
  await part("D8", async () => {
    // D8 Fatura Ayarları (D1 — kullanıcının bulgusu): Logo / Kaşe seç ve kaldır yalnız resim kutusunu günceller
    await page.evaluate(() => window.HOF.invoices.open({ account: {} }));
    await page.waitForSelector(`${TOP} [data-act="settings"]`);
    await page.click(`${TOP} [data-act="settings"]`);
    await page.waitForSelector(`${TOP} [data-s="seller.name"]`);
    d = topDialog(page);
    const setSel = { name: '[data-s="seller.name"]', address: '[data-s="seller.address"]', city: '[data-s="seller.city"]', phone: '[data-s="seller.phone"]', iban: '[data-bank="0"][data-k="iban"]', bank: '[data-bank="0"][data-k="name"]', footer: '[data-s="defaults.footer"]', dueDays: '[data-s="defaults.dueDays"]', track: '[data-s="defaults.itemTracking"]' };
    await typeInto(page, d.locator(setSel.name), "Izole Firma A.Ş.");
    await typeInto(page, d.locator(setSel.address), "Kızılay Mah. 12. Sok. No 3");
    await typeInto(page, d.locator(setSel.city), "Ankara");
    await typeInto(page, d.locator(setSel.phone), "0312 555 44 33");
    await typeInto(page, d.locator(setSel.bank), "Ziraat Bankası");
    await typeInto(page, d.locator(setSel.iban), "TR330006100519786457841326");
    await typeInto(page, d.locator(setSel.footer), "İade 14 gün içinde.", { tab: false });
    await typeInto(page, d.locator(setSel.dueDays), "45");
    await d.locator(setSel.track).click();
    const settingsTyped = await valuesOf(d, setSel);
    await d.locator("[data-logo-file]").setInputFiles(path.join(here, "..", "fixtures", "logo.png"));
    await page.waitForSelector(`${TOP} [data-logo-preview] img`, { timeout: 8000 });
    ok(same(await valuesOf(topDialog(page), setSel), settingsTyped), "D8 Logo Seç sonrası kaydedilmemiş alanlar yerinde (D1)");
    await topDialog(page).locator("[data-stamp-file]").setInputFiles(path.join(here, "..", "fixtures", "logo.jpg"));
    await page.waitForSelector(`${TOP} [data-stamp-preview] img`, { timeout: 8000 });
    ok(same(await valuesOf(topDialog(page), setSel), settingsTyped), "D8 Kaşe / İmza Seç sonrası alanlar yerinde (D1)");
    await topDialog(page).locator('[data-act="stamp-clear"]').click();
    await sleep(300);
    ok(same(await valuesOf(topDialog(page), setSel), settingsTyped) && (await topDialog(page).locator("[data-stamp-preview] img").count()) === 0, "D8 Kaşe / İmzayı Kaldır sonrası alanlar yerinde, kaşe kalktı");
    await shot(page, "form-izolasyon-243-fatura-ayarlari");
    await guard(page, "D8 Fatura Ayarları", setSel);
    await topDialog(page).locator('[data-act="save-settings"]').click();
    await sleep(1800);
    const settingsSaved = await must("fatura ayarları", admin.get("/api/workspace/invoices/settings"));
    ok(settingsSaved.seller.name === "Izole Firma A.Ş." && settingsSaved.seller.address === "Kızılay Mah. 12. Sok. No 3" && settingsSaved.seller.city === "Ankara" && settingsSaved.seller.phone === "0312 555 44 33" && (settingsSaved.seller.banks || []).some(bank => bank.iban.replace(/\s/g, "") === "TR330006100519786457841326") && settingsSaved.defaults.footer === "İade 14 gün içinde." && Number(settingsSaved.defaults.dueDays) === 45 && settingsSaved.defaults.itemTracking === true && /^data:image\/jpeg/.test(settingsSaved.seller.logo || "") && !settingsSaved.seller.stamp, `D8 kaydedilen = girilen (logo var, kaşe yok)`);
    await page.keyboard.press("Escape");
    ok(!(await confirmShown(page)), "D8 kaydedilmiş ayarlar Esc ile sorusuz kapanır");
    await closeClean(page);
    covered.push("Fatura Ayarları (hof-invoices renderSettings)");

  });
  await part("D9", async () => {
    // D9 Entegratör Ayarları: sekme değişimi (iç yeniden çizim) ve kapatma koruması
    await page.evaluate(() => window.HOF.invoices.open({ account: {} }));
    await page.waitForSelector(`${TOP} [data-act="integrator"]`);
    await page.click(`${TOP} [data-act="integrator"]`);
    await page.waitForSelector(`${TOP} [data-i="username"]`);
    d = topDialog(page);
    await typeInto(page, d.locator('[data-i="username"]'), "izolasyon-kullanici");
    await typeInto(page, d.locator('[data-i="baseUrl"]'), "https://ornek.invalid/servis");
    await d.locator('[data-integ-tab="series"]').click();
    await d.locator('[data-integ-tab="connection"]').click();
    const integVals = await valuesOf(topDialog(page), { user: '[data-i="username"]', url: '[data-i="baseUrl"]' });
    ok(integVals.user === "izolasyon-kullanici" && integVals.url === "https://ornek.invalid/servis", `D9 sekme değişiminden sonra değerler yerinde ${JSON.stringify(integVals)}`);
    await guard(page, "D9 Entegratör Ayarları", { user: '[data-i="username"]', url: '[data-i="baseUrl"]' });
    await closeClean(page);
    covered.push("Entegratör Ayarları (hof-invoices showIntegrator)");

  });
  await part("D10", async () => {
    // D10 Stok kartı (Yeni Ürün)
    await page.evaluate(() => window.HOF.stock.open());
    await page.waitForSelector(`${TOP} [data-act="new"]`);
    await page.click(`${TOP} [data-act="new"]`);
    await page.waitForSelector(`${TOP} input[name="name"]`);
    d = topDialog(page);
    await typeInto(page, d.locator('input[name="code"]'), "IZL-01");
    await typeInto(page, d.locator('input[name="name"]'), "İzolasyon Bandı");
    await typeInto(page, d.locator('input[name="salePrice"]'), "75");
    await guard(page, "D10 Yeni Ürün", { code: 'input[name="code"]', name: 'input[name="name"]', salePrice: 'input[name="salePrice"]' });
    await submit(page);
    await sleep(1500);
    const stockHit = server.app.store.get("SELECT name, code, sale_price AS price FROM stock_items WHERE code = 'IZL-01'");
    ok(stockHit && stockHit.name === "İzolasyon Bandı" && Number(stockHit.price) === 75, `D10 kaydedilen = girilen (${JSON.stringify(stockHit)})`);
    await closeClean(page);
    covered.push("Stok Kartı / Yeni Ürün (hof-stock editItem)");

  });
  await part("D11", async () => {
    // D11 Kasa: Tahsilat formu
    await page.evaluate(() => window.HOF.workspace.openCash());
    await page.waitForSelector(`${TOP} [data-add="in"]`);
    await page.click(`${TOP} [data-add="in"]`);
    await page.waitForSelector(`${TOP} input[name="amount"]`);
    d = topDialog(page);
    await typeInto(page, d.locator('input[name="amount"]'), "640");
    await typeInto(page, d.locator('input[name="description"], textarea[name="description"]').first(), "Kasa izolasyon tahsilatı");
    await guard(page, "D11 Kasa Tahsilat", { amount: 'input[name="amount"]' });
    await submit(page);
    await sleep(1500);
    const cashHit = server.app.store.get("SELECT amount FROM cash_entries WHERE description = 'Kasa izolasyon tahsilatı'");
    ok(cashHit && Number(cashHit.amount) === 640, `D11 kaydedilen = girilen (${JSON.stringify(cashHit)})`);
    await closeClean(page);
    covered.push("Kasa Tahsilat / Ödeme (hof-workspace editCashEntry)");

  });
  await part("D12", async () => {
    // D12 Banka: Yeni Banka Hesabı, sonra Masraf ve Transfer
    await page.evaluate(() => window.HOF.bank.open({ tab: "accounts" }));
    await page.waitForSelector(`${TOP} .hof-bank`);
    const newAccount = page.locator(`${TOP} [data-act="acc-new"], ${TOP} [data-act="new-account"], ${TOP} button:has-text("+ Yeni Hesap")`).first();
    await newAccount.waitFor({ timeout: 8000 }).catch(() => null);
    if (await newAccount.count()) {
      await newAccount.click();
      await page.waitForSelector(`${TOP} input[name="bankName"]`, { timeout: 8000 });
      d = topDialog(page);
      await typeInto(page, d.locator('input[name="bankName"]'), "Ziraat Bankası");
      await typeInto(page, d.locator('input[name="name"]'), "İzolasyon TL Hesabı");
      const opening = d.locator('input[name="openingAmount"]');
      if (await opening.count()) await typeInto(page, opening, "5.000");
      await guard(page, "D12 Yeni Banka Hesabı", { bankName: 'input[name="bankName"]', name: 'input[name="name"]' });
      await submit(page);
      await sleep(2000);
      const bankRow = server.app.store.get("SELECT bank_name AS bank, name FROM bank_accounts WHERE name = 'İzolasyon TL Hesabı'");
      ok(bankRow && bankRow.bank === "Ziraat Bankası", `D12 kaydedilen = girilen (${JSON.stringify(bankRow)})`);
      covered.push("Banka Hesabı (hof-bank accountForm)");
    } else ok(false, "D12 + Yeni Hesap düğmesi bulunamadı");
    await closeClean(page);
    await must("ikinci banka hesabı", admin.post("/api/workspace/bank/accounts", { bankName: "Garanti BBVA", name: "İkinci TL Hesabı", kind: "demand", opening: { date: iso(-5), amount: "1.000", confirmed: true } }));
    await page.evaluate(() => window.HOF.bank.open({ tab: "movements" }));
    await page.waitForSelector(`${TOP} [data-act="v-fee"]`, { timeout: 10000 });
    await page.click(`${TOP} [data-act="v-fee"]`);
    await page.waitForSelector(`${TOP} input[name="amount"]`);
    d = topDialog(page);
    await typeInto(page, d.locator('input[name="amount"]'), "17,50");
    await typeInto(page, d.locator('input[name="description"]'), "İzolasyon masrafı");
    await guard(page, "D13 Banka Masrafı", { amount: 'input[name="amount"]', description: 'input[name="description"]' });
    await submit(page);
    await sleep(2000);
    const feeHit = server.app.store.get("SELECT amount_minor AS minor FROM fin_events WHERE description = 'İzolasyon masrafı' AND status = 'active'");
    ok(feeHit && feeHit.minor === 1750, `D13 kaydedilen = girilen (17,50 → ${JSON.stringify(feeHit)})`);
    covered.push("Banka Masrafı (hof-bank voucherForm fee)");
    await closeClean(page);
    await page.evaluate(() => window.HOF.bank.open({ tab: "movements" }));
    await page.waitForSelector(`${TOP} [data-act="v-transfer"]`, { timeout: 10000 });
    await page.click(`${TOP} [data-act="v-transfer"]`);
    await page.waitForSelector(`${TOP} input[name="amount"]`);
    d = topDialog(page);
    await typeInto(page, d.locator('input[name="amount"]'), "250");
    await typeInto(page, d.locator('input[name="description"]'), "İzolasyon transferi");
    await guard(page, "D14 Bankalar Arası Transfer", { amount: 'input[name="amount"]', description: 'input[name="description"]' });
    await closeClean(page);
    covered.push("Bankalar Arası Transfer (hof-bank voucherForm transfer)");

  });
  await part("D15", async () => {
    // D15 Çek / Senet
    await page.evaluate(id => window.HOF.cheques.newFor({ direction: "in", account: { id } }), akin.id).catch(() => null);
    const chequeOpen = await page.waitForSelector(`${TOP} input[name="serialNo"]`, { timeout: 6000 }).then(() => true, () => false);
    if (!chequeOpen) {
      await closeClean(page);
      await page.evaluate(() => window.HOF.cheques.open());
      await page.waitForSelector(`${TOP} [data-act="new-in"], ${TOP} [data-new="in"], ${TOP} button:has-text("Çek / Senet Al")`, { timeout: 8000 });
      await page.click(`${TOP} [data-act="new-in"], ${TOP} [data-new="in"], ${TOP} button:has-text("Çek / Senet Al")`);
      await page.waitForSelector(`${TOP} input[name="serialNo"]`);
    }
    d = topDialog(page);
    await typeInto(page, d.locator('input[name="amount"]'), "4.500");
    await d.locator('input[name="dueDate"]').fill(iso(30));
    await typeInto(page, d.locator('input[name="serialNo"]'), "IZL-777");
    await typeInto(page, d.locator('input[name="bank"]'), "Halkbank Kızılay");
    await guard(page, "D15 Çek / Senet", { amount: 'input[name="amount"]', serial: 'input[name="serialNo"]', bank: 'input[name="bank"]' });
    await submit(page);
    await sleep(2000);
    const chequeHit = server.app.store.get("SELECT amount, bank FROM cheques WHERE serial_no = 'IZL-777'");
    ok(chequeHit && Number(chequeHit.amount) === 4500 && chequeHit.bank === "Halkbank Kızılay", `D15 kaydedilen = girilen (${JSON.stringify(chequeHit)})`);
    await closeClean(page);
    covered.push("Çek / Senet (hof-cheques chequeForm)");

  });
  await part("D16", async () => {
    // D16 Taksit kartı
    await page.evaluate(() => window.HOF.plans.openNew());
    await page.waitForSelector(`${TOP} input[name="total"]`, { timeout: 10000 });
    d = topDialog(page);
    await typeInto(page, d.locator('input[name="name"]'), "İzolasyon Taksitli");
    await typeInto(page, d.locator('input[name="total"]'), "12.000");
    await typeInto(page, d.locator('input[name="count"]'), "6");
    await d.locator('input[name="firstDue"]').fill(iso(20));
    await guard(page, "D16 Yeni Taksit Kartı", { name: 'input[name="name"]', total: 'input[name="total"]', count: 'input[name="count"]' });
    await submit(page);
    await sleep(2000);
    const planHit = server.app.store.get("SELECT name, total, (SELECT COUNT(*) FROM plan_items WHERE plan_id = plans.id) AS items FROM plans WHERE name = 'İzolasyon Taksitli'");
    const planError = await page.locator(`${TOP} .hof-form-error`).last().textContent().catch(() => "");
    ok(planHit && Number(planHit.total) === 12000 && planHit.items === 6, `D16 kaydedilen = girilen (${JSON.stringify(planHit)}${planError ? ` · form: ${planError}` : ""})`);
    await closeClean(page);
    covered.push("Taksit Kartı (hof-plans editPlan)");

  });
  await part("D17", async () => {
    // D17 Yönetim paneli: Yeni Kullanıcı (rol değişimi yetki ızgarasını yeniden çizer) ve Şirketin Adı ve Kodu
    const adminPage = await newPage(context, "/admin.html");
    await adminPage.waitForSelector("#adm-new-user", { timeout: 20000 });
    await adminPage.click("#adm-new-user");
    await adminPage.waitForSelector(`${TOP} input[name="username"]`);
    d = topDialog(adminPage);
    await typeInto(adminPage, d.locator('input[name="name"]'), "İzolasyon Personeli");
    await typeInto(adminPage, d.locator('input[name="username"]'), "izolasyon1");
    // 2.4.3 (uzman UX22): İlk Parola alanı boş gelir; parola yazılır.
    await typeInto(adminPage, d.locator('input[name="password"]'), "Izolasyon-Parola-2026!");
    await d.locator('select[name="role"]').focus();
    await adminPage.keyboard.press("ArrowDown");
    await sleep(300);
    const userVals = await valuesOf(topDialog(adminPage), { name: 'input[name="name"]', username: 'input[name="username"]' });
    ok(userVals.name === "İzolasyon Personeli" && userVals.username === "izolasyon1", `D17 rol değişiminden (yetki ızgarası yeniden çizildi) sonra değerler yerinde ${JSON.stringify(userVals)}`);
    await guard(adminPage, "D17 Yeni Kullanıcı", { name: 'input[name="name"]', username: 'input[name="username"]' });
    await submit(adminPage);
    await sleep(2000);
    const users = await must("kullanıcılar", admin.get("/api/admin/users"));
    const userHit = (users.users || users || []).find(user => user.username === "izolasyon1");
    ok(userHit && (userHit.displayName || userHit.name) === "İzolasyon Personeli", `D17 kaydedilen = girilen (${JSON.stringify(userHit && { username: userHit.username, name: userHit.displayName || userHit.name, role: userHit.role })})`);
    await closeClean(adminPage);
    covered.push("Yeni Kullanıcı (admin newUser)");
    await adminPage.click('.adm-tabs [data-tab="companies"]');
    const companyEdit = adminPage.locator("#adm-companies [data-c-edit]").first();
    await companyEdit.waitFor({ timeout: 10000 }).catch(() => null);
    if (await companyEdit.count()) {
      await companyEdit.scrollIntoViewIfNeeded();
      await companyEdit.click();
      await adminPage.waitForSelector(`${TOP} input[name="name"]`);
      await typeInto(adminPage, topDialog(adminPage).locator('input[name="name"]'), "İzolasyon Şirketi");
      await guard(adminPage, "D18 Şirketin Adı ve Kodu", { name: 'input[name="name"]' });
      await submit(adminPage);
      await sleep(2000);
      const companies = await must("şirketler", admin.get("/api/companies"));
      ok(JSON.stringify(companies).includes("İzolasyon Şirketi"), "D18 kaydedilen = girilen (şirket adı)");
      covered.push("Şirketin Adı ve Kodu (admin editCompany)");
    } else ok(false, "D18 şirket düzenleme düğmesi bulunamadı");
    await closeClean(adminPage);
    await adminPage.close();

  });
  await part("Bölüm E", async () => {
    // E — run.mjs "akıllı denetim … Excel'e aktarılır" adımının ara sıra kırmızısı (17–18.10.2026; çekirdek dalında 3, banka dalında 1 koşu).
    // Kök neden (CPU ×6 yavaşlatmayla üretildi, ekran görüntüsü): "Dışa Aktar" menüsü (z-index 80) sayfanın altına açılınca alttaki sabit lisans
    // şeridinin (z-index 99960) ARKASINDA kalıyor; "Excel Dosyası (.xlsx)" tıklanamıyor, indirme hiç başlamıyor. Kırmızı, menünün şeritle
    // çakıştığı yerleşime (sayfa kaydırması, şeridin o an görünmesi) bağlı. Ön koşul burada ZORLA kurulur: şerit gösterilir (yoksa ürünün kendi
    // sınıfıyla) ve menü öğesinin üstüne konur; çakışma ölçülmeden sonuç sayılmaz.
    console.log("\n■ E Dışa Aktar menüsü alttaki lisans şeridinin üstünde (run.mjs ara sıra kırmızısı, zorla)");
    // Ana oturum ek maddesi (CI #828 37b64e8, 172/173): önceki kurulum sayfayı kaydırıp menüyü şeride indirmeye çalışıyordu; CI'nin yerleşiminde
    // sayfa yeterince kaymadı (öğe 691–748, şerit 762'den başlıyor) ve ön koşul kurulamadı. Artık ortamdan BAĞIMSIZ: menü açıldıktan sonra öğenin
    // gerçek dikdörtgeni ölçülür, lisans şeridi (sabit, z-index'i ürünün kendisi) öğenin ORTASINI kesinlikle örtecek biçimde o dikdörtgenin üstüne
    // taşınır (yalnız konum/boyut; katman sırası ürünün CSS'i). İki pencere yüksekliğinde (768, 900) denenir; E2/E3 yalnız ön koşul gerçekten
    // oluşunca sayılır.
    for (const height of [768, 900]) {
      const sized = await browser.newContext({ viewport: { width: 1100, height }, locale: "tr-TR", acceptDownloads: true });
      try {
        const sizedPage = await newPage(sized);
        await login(sizedPage);
        await sizedPage.waitForSelector("#hof-toolbar-export", { timeout: 30000 });
        await sleep(1500);
        await sizedPage.evaluate(() => {
          if (document.getElementById("hof-license-bar")) return;
          const bar = window.HOF.el("aside", { id: "hof-license-bar", class: "hof-license-bar is-info" }, '<div class="hof-license-text"><strong>Ücretsiz deneme henüz başlamadı</strong><span>Deneme şeridi (test için ürünün kendi sınıfıyla).</span></div>');
          document.body.appendChild(bar);
        });
        await sizedPage.click("#hof-toolbar-export");
        await sizedPage.waitForSelector('.hof-export-menu [data-export="tab"]');
        await sleep(300);
        const geometry = await sizedPage.evaluate(() => {
          const node = document.querySelector('.hof-export-menu [data-export="tab"]');
          const bar = document.getElementById("hof-license-bar");
          const item = node.getBoundingClientRect();
          // Şerit öğenin üstüne: öğenin her yanından 6 px taşar (ortası kesinlikle örtülür); konum sabit, katman sırası değişmez.
          Object.assign(bar.style, { top: `${Math.max(0, item.top - 6)}px`, bottom: "auto", left: `${Math.max(0, item.left - 6)}px`, transform: "none", width: `${item.width + 12}px`, minHeight: `${item.height + 12}px`, maxHeight: "none", margin: "0" });
          const box = bar.getBoundingClientRect();
          const cx = item.left + item.width / 2;
          const cy = item.top + item.height / 2;
          const centerCovered = cx > box.left && cx < box.right && cy > box.top && cy < box.bottom;
          const hit = document.elementFromPoint(cx, cy);
          return { height: window.innerHeight, centerCovered, onItem: Boolean(hit?.closest('[data-export="tab"]')), onBar: Boolean(hit?.closest("#hof-license-bar")), hit: hit ? `${hit.tagName}.${String(hit.className).split(" ")[0]}` : "", item: [Math.round(item.left), Math.round(item.top), Math.round(item.right), Math.round(item.bottom)], bar: [Math.round(box.left), Math.round(box.top), Math.round(box.right), Math.round(box.bottom)], z: [getComputedStyle(document.querySelector(".hof-export-menu")).zIndex, getComputedStyle(bar).zIndex] };
        });
        ok(geometry.centerCovered, `E1 (${height}) ön koşul oluştu: "Excel Dosyası (.xlsx)" öğesinin ortası lisans şeridinin içinde (${JSON.stringify(geometry)})`);
        if (geometry.centerCovered) {
          // Üstte kalan menü öğesi olmalı (eski kodda menü z-index 80 < şerit 99960: tıklama şeride gidiyordu).
          ok(geometry.onItem && !geometry.onBar, `E2 (${height}) öğenin ortasında üstte menü öğesi var, şerit değil (${geometry.hit}; z ${geometry.z.join(" / ")})`);
          const got = await Promise.all([sizedPage.waitForEvent("download", { timeout: 15000 }).then(item => item.suggestedFilename(), () => ""), sizedPage.mouse.click(geometry.item[0] + (geometry.item[2] - geometry.item[0]) / 2, geometry.item[1] + (geometry.item[3] - geometry.item[1]) / 2).catch(() => null)]).then(([name]) => name);
          ok(/\.xlsx$/.test(got), `E3 (${height}) şerit öğenin üstündeyken öğenin ortasına tıklama Excel'i indirdi (${got || "indirme yok"})`);
        }
      } finally {
        await sized.close();
      }
    }
  });
  // ======================================================================================================================================
  const inventory = formInventory();
  // Bu senaryoda ekrandan açılan formların kaynaktaki yeri (dosya + işlev; Not Ekle başlığıyla).
  const SEEN = ["admin.js newUser", "admin.js editCompany", "hof-accounts.js open", "hof-accounts.js editAccount", "hof-accounts.js editEntry", "hof-workspace.js Not Ekle", "hof-workspace.js editCashEntry", "hof-workspace.js openCash", "hof-table.js Yeni Kayıt Oluştur", "hof-invoices.js open", "hof-invoices.js showIntegrator", "hof-stock.js open", "hof-stock.js editItem", "hof-bank.js open", "hof-bank.js accountForm", "hof-bank.js voucherForm", "hof-cheques.js chequeForm", "hof-plans.js open", "hof-plans.js editPlan"];
  const seen = item => SEEN.some(key => {
    const [file, what] = key.split(" ");
    return item.site.startsWith(`${file}:`) && (item.fn === what || item.title.includes(key.slice(file.length + 1)));
  });
  const opened = inventory.filter(seen);
  const rest = inventory.filter(item => !seen(item));
  console.log(`\n■ Kaynaktaki form / pencere açan çağrılar: ${inventory.length} · ekrandan açılan: ${opened.length} · bu senaryoda açılmayan: ${rest.length}`);
  console.log("  Açılmayanlar ortak çekirdekten (HOF.formModal / HOF.modal: kaydedilmemiş değişiklik sorusu, açık listede Esc, Ctrl+Enter, Geri tuşu, F5) korunur;");
  console.log("  ekrandan ayrıca denenmediler (F = form penceresi, P = pencere):");
  for (const item of rest) console.log(`  ${item.kind === "formModal" ? "F" : "P"} ${item.site} ${item.fn || "?"} · ${item.title}`);
  ok(inventory.length > 100 && opened.length >= 18 && covered.length >= 19, `envanter ${inventory.length} çağrı, ekrandan açılan ${opened.length} çağrı / ${covered.length} form`);
  ok(!errors.length, `sayfa hatası yok${errors.length ? `: ${errors.join(" | ")}` : ""}`);
} catch (error) {
  failed += 1;
  console.log(`  ✗ beklenmeyen hata: ${error.stack || error}`);
} finally {
  await browser.close();
  await server.close();
  console.log(`\nEkrandan denenen formlar (${covered.length}): ${covered.join(" · ")}`);
  console.log(`\n${passed} geçti, ${failed} kaldı`);
  if (!process.env.EKRAN_DIR) rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
