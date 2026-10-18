// 2.4.3 uzman UI / UX turu, A paketi (18.10.2026) — EKRANDAN, gerçek tıklama + Tab + insan hızında yazım; yazmadan sonra veri tabanı okunur (ders 3, 12).
// Bulgular (docs/kanit/2026-10-18/uiux-a-243/uzman-ui-BULGULAR.md, uzman-ux-BULGULAR.md):
//   UX4  onaylarda varsayılan odak yıkıcı düğmedeydi: Esc + Enter doldurulmuş formu kaydetmeden kapatıyor, Enter hareketi siliyordu.
//   UX4/UX10  faturadan "+ Yeni Cari" kaydedilince odak pencerenin × düğmesine düşüyordu (Enter → soru → Enter → kayıp).
//   UX10 sunucu hatası (ör. IBAN geçersiz) alanı söylese de odak Kaydet düğmesinde kalıyordu.
//   UX1  iki kişi aynı cariyi düzenler: ikinci kaydeden ilkinin telefonunu sessizce siler.
//   UX5 / KÖ4  e-Fatura işaretini elle kaldırmak sessizdi.   UX13  Mükellef Sorgula, GİB unvanı yazılandan farklıyken sessizdi.
//   UX7  muhasebeye "Yönetim → Silinenler'den geri yüklenebilir" deniyordu (panel yalnız yöneticide).
//   UX8  taksit kartında "Kapat" onaysızdı ve pencerenin "Kapat"ıyla aynı addaydı.   UX11  muhasebe rol açıklaması "raporlar yok" diyordu.
//   UX19 cari hareketlerinde "Kasa" süzgeci havaleyi de sayıyordu.   UX22  yeni kullanıcının ilk parolası dolu geliyor, yazılan sona ekleniyordu.
//   UI1  WhatsApp düğmesi 1,98:1.  UI3c stok kodu üç satıra bölünüyordu.  UI6 "Mükellefurn:mail:…" bitişik.  UI7 "e-Fatura posta kutusu etiketi".
//   UI9  "22,6 Mn ₺" (simge sonda).  UI10 tablo başlığı, pencere üst yazısı, Rapor Merkezi kartı AA altı.  UI11 Çek / Senet başlığı iki kez,
//        "Hareket Hareket", stokta 5. özet kartı ikinci satırda.
// Eski kodda (9d191a8) kırmızıdır: DEPO=<eski kopya> ile koşulur. Çıkış: "N geçti, M kaldı".
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { BUYER_VKN, MULTI_VKN, OUR_VKN, startMockEdm } from "../einvoice-mock.mjs";
import { escClose } from "./esc-kapat.mjs";

const ROOT = process.env.DEPO ? path.resolve(process.env.DEPO) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const { createApp } = await import(pathToFileURL(path.join(ROOT, "server", "app.mjs")).href);
const { createClient, installPageClock } = await import(pathToFileURL(path.join(ROOT, "test", "helpers.mjs")).href);

const PASS = "Prova-Admin-2026!";
const AYSE = "Ayse-Parola-2026!";
const NOW = "2026-10-08T12:00:00+03:00";
const root = mkdtempSync(path.join(tmpdir(), "destekofis-uiux-a-243-"));
const edm = await startMockEdm();
const NO_ENV_PROXY = { HTTPS_PROXY: "", https_proxy: "", HTTP_PROXY: "", http_proxy: "", NO_PROXY: "", no_proxy: "" };
const app = createApp({ dataDir: path.join(root, "data"), backupDir: path.join(root, "backups"), logLevel: "warn", scheduleBackups: false, now: NOW, edocEnabled: true, env: { HUKUK_ADMIN_PASSWORD: PASS, HUKUK_DATASET_AUTOSYNC: "0", HUKUK_LICENSE_URL: "http://127.0.0.1:9", ...NO_ENV_PROXY }, license: { enforce: false, machineId: "a1b2c3d4e5f60718293a4b5c6d7e8f46" }, startLicenseTimers: false });
const { port } = await app.listen(0, "127.0.0.1");
const BASE = `http://127.0.0.1:${port}`;
const unwrap = r => (r.data && typeof r.data === "object" && "ok" in r.data ? (r.data.ok ? r.data.data : r.data) : r.data);
const api = createClient(BASE);
await api.login("admin", PASS);
const must = async (label, promise) => {
  const res = await promise;
  if (res.status !== 200) throw new Error(`${label}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
  return unwrap(res);
};
const db = (sql, ...args) => app.store.get(sql, ...args);
globalThis.__escKapatEk = () => ({ cari: db("SELECT COUNT(*) AS n FROM accounts").n, hareket: db("SELECT COUNT(*) AS n FROM account_entries").n });

await must("kurulum geç", api.post("/api/workspace/bank/setup/dismiss", {}));
await must("fatura ayarları", api.put("/api/workspace/invoices/settings", { seller: { name: "Deneme Ofis Ltd.", taxNo: OUR_VKN, taxOffice: "Çankaya", address: "Atatürk Blv. 1", district: "Çankaya", city: "Ankara", email: "bilgi@deneme.com.tr" }, efatura: true, earsiv: true, integrator: { env: "test", baseUrl: edm.url, username: "edmkullanici", password: "Gizli-Parola-1", senderAlias: "urn:mail:defaultgb@deneme.com.tr" } }));
await must("muhasebe", api.post("/api/admin/users", { username: "ayse", name: "Ayşe Muhasebe", role: "muhasebe", password: AYSE, mustChangePassword: false }));
const zeynep = await must("cari", api.post("/api/workspace/accounts", { name: "Zeynep Kaya", type: "customer", phone: "05550000001" }));
await must("nakit tahsilat", api.post(`/api/workspace/accounts/${zeynep.id}/entries`, { kind: "in", amount: "250", date: "2026-10-05", note: "Elden", method: "cash" }));
// UX19: havale tahsilatı (banka hesabı tanımsız → Hesabı Atanmamış).
const transfer = await api.post(`/api/workspace/accounts/${zeynep.id}/entries`, { kind: "in", amount: "300", date: "2026-10-06", note: "Havale", method: "bank" });
const mukellef = await must("mükellef cari", api.post("/api/workspace/accounts", { name: "Alıcı Ticaret A.Ş.", type: "customer", taxNo: BUYER_VKN, taxOffice: "Kavaklıdere", address: "Cinnah Cd. 10", district: "Çankaya", city: "Ankara", eInvoice: true, eAlias: "urn:mail:defaultpk@alici.com.tr" }));
const plan = await must("taksit kartı", api.post("/api/workspace/plans", { name: "Kira Kartı", total: "3.000", mode: "auto", count: 3, firstDue: "2026-10-20" }));
await must("stok", api.post("/api/workspace/stock", { code: "STK-2.0.21-001", name: "Uzun Kodlu Ürün", unit: "Adet", salePrice: "10" }));
await must("stok 2", api.post("/api/workspace/stock", { code: "8690123456789", name: "Barkodlu Ürün", unit: "Adet", salePrice: "20" }));

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
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const TOP = ".hof-modal-backdrop.is-visible:last-of-type";
const focused = page => page.evaluate(() => {
  const a = document.activeElement;
  if (!a || a === document.body) return "BODY";
  return `${a.tagName}${a.name ? `[${a.name}]` : ""}${a.dataset?.answer ? `[answer=${a.dataset.answer}]` : ""}${a.classList.contains("hof-modal-close") ? ".close" : ""}|${(a.textContent || "").trim().slice(0, 30)}`;
});
const toasts = page => page.$$eval(".hof-toast-text", nodes => nodes.map(node => node.textContent)).catch(() => []);
const typeHuman = async (page, locator, text) => {
  await locator.click();
  await page.keyboard.type(text, { delay: 35 });
};
async function newPage(context, url = "/") {
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", error => errors.push(error.message));
  await installPageClock(page, app.config.now);
  await page.goto(`${BASE}${url}`);
  return page;
}
async function login(context, username, password) {
  const page = await newPage(context);
  await page.fill("#hof-auth input[name=username]", username);
  await page.fill("#hof-auth input[name=password]", password);
  await Promise.all([page.waitForEvent("load"), page.click('#hof-auth button[type="submit"]')]);
  await page.waitForSelector("#hof-sidecard", { timeout: 60000 });
  await page.waitForFunction(() => window.HOF?.accounts?.open && window.HOF?.invoices?.newFor);
  return page;
}
const closeAll = async page => {
  for (let index = 0; index < 6 && (await page.$(".hof-modal-backdrop.is-visible")); index += 1) {
    await escClose(page, { step: "pencereleri kapat" });
    await sleep(250);
  }
};
const contrastOf = (page, selector) =>
  page.evaluate(sel => {
    const parse = c => {
      const m = c.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const lum = ({ r, g, b }) => {
      const f = v => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
    // Zemin: degrade varsa EN AÇIK renk (iyimser değil, kötü durum), yoksa üst üste binen katmanlar.
    const bgOf = el => {
      const layers = [];
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.backgroundImage && cs.backgroundImage !== "none" && /gradient/.test(cs.backgroundImage)) {
          const cols = (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(parse).filter(Boolean);
          if (cols.length) {
            layers.push({ ...cols.reduce((a, b) => (lum(b) > lum(a) ? b : a)), a: 1 });
            break;
          }
        }
        const c = parse(cs.backgroundColor);
        if (c && c.a > 0) {
          layers.push(c);
          if (c.a >= 1) break;
        }
      }
      let out = { r: 255, g: 255, b: 255, a: 1 };
      for (const layer of layers.reverse()) out = blend(layer, out);
      return out;
    };
    const nodes = [...document.querySelectorAll(sel)].filter(node => node.getClientRects().length && node.textContent.trim());
    return nodes.map(el => {
      const cs = getComputedStyle(el);
      const fg = parse(cs.color);
      const bg = bgOf(el);
      const f = blend(fg, bg);
      const L1 = lum(f);
      const L2 = lum(bg);
      return { text: el.textContent.trim().slice(0, 30), ratio: Math.round(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)) * 100) / 100 };
    });
  }, selector);

try {
  const adminContext = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: "tr-TR" });
  await adminContext.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
  const page = await login(adminContext, "admin", PASS);
  // Her bölüm ayrı: biri düşse (eski kodda) öbürleri yine koşar; bölüm sonunda açık pencereler kapatılır.
  const part = async (name, run) => {
    try {
      await run();
    } catch (error) {
      failed += 1;
      console.log(`  ✗ ${name} bölümü yarıda kaldı: ${String(error.message || error).split("\n")[0].slice(0, 200)}`);
    }
    await closeAll(page).catch(() => null);
  };
  const entryId = db("SELECT id FROM account_entries WHERE account_id = ? AND note = 'Elden'", zeynep.id).id;

  console.log("A) UX4: Yeni Cari doldurulur → Esc → soruda odak \"Forma Dön\" → Enter form açık kalır, yazılan durur");
  await part("A", async () => {
    await page.evaluate(() => window.HOF.accounts.newFor({ type: "customer" }));
    await page.waitForSelector(`${TOP} input[name="name"]`);
    const firstFocus = await focused(page);
    ok(firstFocus.startsWith("INPUT[name]"), `yeni cari açılınca odak ilk alanda (${firstFocus})`);
    await page.keyboard.type("Esc Deneme Kişisi", { delay: 35 });
    await page.keyboard.press("Tab");
    await page.keyboard.press("Escape");
    await page.waitForSelector(`${TOP} [data-answer="no"]`);
    await sleep(250);
    const onQuestion = await focused(page);
    ok(/answer=no/.test(onQuestion), `soruda odak güvenli düğmede (${onQuestion})`);
    await page.keyboard.press("Enter");
    await sleep(500);
    const nameAfter = await page.$eval(`${TOP} input[name="name"]`, node => node.value).catch(() => "(form kapandı)");
    ok(nameAfter === "Esc Deneme Kişisi", `Enter formu kapatmadı, yazılan duruyor (${nameAfter})`);
    ok(db("SELECT COUNT(*) AS n FROM accounts WHERE name = ?", "Esc Deneme Kişisi").n === 0, "veri tabanında kayıt yok (kaydedilmedi)");
  });

  console.log("B) UX10: sunucu alanı söyleyen hata (IBAN geçersiz) → odak IBAN alanında");
  await part("B", async () => {
    await page.evaluate(() => window.HOF.accounts.newFor({ type: "customer" }));
    await page.waitForSelector(`${TOP} input[name="name"]`);
    await page.keyboard.type("Iban Deneme", { delay: 35 });
    const iban = page.locator(`${TOP} input[name="iban"]`);
    await iban.scrollIntoViewIfNeeded();
    await typeHuman(page, iban, "TR000000");
    await page.locator(`${TOP} button[type="submit"]`).click();
    await page.waitForFunction(() => /IBAN/.test(document.querySelector(".hof-modal-backdrop.is-visible:last-of-type .hof-form-error")?.textContent || ""), null, { timeout: 8000 }).catch(() => null);
    await sleep(300);
    const afterError = await focused(page);
    ok(afterError.startsWith("INPUT[iban]"), `hata sonrası odak hatalı alanda (${afterError})`);
    await page.locator(`${TOP} input[name="iban"]`).fill("");
    await closeAll(page);
  });

  console.log("C) UX4/UX10: faturadan \"+ Yeni Cari\" kaydedilince odak × düğmesinde değil");
  await part("C", async () => {
    await page.evaluate(() => window.HOF.invoices.newFor({ side: "sale" }));
    await page.locator(".hof-inv-scenario").first().click();
    await page.waitForSelector(".hof-inv-account-new");
    await page.click(".hof-inv-account-new");
    await page.waitForSelector(`${TOP} input[name="name"]`);
    await page.keyboard.type("Faturadan Açılan Cari", { delay: 35 });
    await page.locator(`${TOP} button[type="submit"]`).click();
    await page.waitForFunction(() => /seçildi/.test([...document.querySelectorAll(".hof-toast-text")].map(node => node.textContent).join(" ")), null, { timeout: 8000 }).catch(() => null);
    await sleep(1800);
    const afterNew = await focused(page);
    ok(db("SELECT COUNT(*) AS n FROM accounts WHERE name = ?", "Faturadan Açılan Cari").n === 1, "ön koşul: cari açıldı (veri tabanı)");
    ok(!/\.close/.test(afterNew) && afterNew !== "BODY", `odak × düğmesinde ya da boşta değil (${afterNew})`);
    await closeAll(page);
  });

  console.log("D) UX4: Hareketi Sil onayında odak Vazgeç; Enter hareketi silmez");
  await part("D", async () => {
    await page.evaluate(id => window.HOF.accounts.open(id), zeynep.id);
    const entryId = db("SELECT id FROM account_entries WHERE account_id = ? AND note = 'Elden'", zeynep.id).id;
    await page.waitForSelector(`[data-delete-entry="${entryId}"]`);
    await page.click(`[data-delete-entry="${entryId}"]`);
    await page.waitForSelector(`${TOP} [data-answer="no"]`);
    await sleep(250);
    const onDelete = await focused(page);
    ok(/answer=no/.test(onDelete), `silme onayında odak Vazgeç'te (${onDelete})`);
    const adminDeleteText = await page.$eval(`${TOP} .hof-modal-text`, node => node.textContent);
    ok(/Yönetim → Silinenler’den geri yüklenebilir/.test(adminDeleteText), `yöneticiye yol: Yönetim → Silinenler (${adminDeleteText.slice(-70)})`);
    await page.keyboard.press("Enter");
    await sleep(700);
    ok(db("SELECT COUNT(*) AS n FROM account_entries WHERE id = ?", entryId).n === 1, "Enter hareketi silmedi (veri tabanı)");
  });

  console.log("E) UX19: hareket süzgeci adı ve sayısı; UI6 posta kutusu ayrı satırda");
  await part("E", async () => {
    await page.evaluate(id => window.HOF.accounts.open(id), zeynep.id);
    await page.waitForSelector("[data-ledger-filter]");
    const chips = await page.$$eval("[data-ledger-filter]", nodes => nodes.map(node => node.textContent.replace(/\s+/g, " ").trim()));
    ok(!chips.some(chip => /^Kasa\b/.test(chip)), `"Kasa" adlı süzgeç yok (${chips.join(" | ")})`);
    ok(chips.some(chip => /^Tahsilat \/ Ödeme \d/.test(chip)), `"Tahsilat / Ödeme" süzgeci var (${chips.join(" | ")})`);
    ok(transfer.status === 200, `ön koşul: havale tahsilatı girildi (${transfer.status})`);
    await page.click('[data-act="back"]');
    await page.evaluate(id => window.HOF.accounts.open(id), mukellef.id);
    await page.waitForSelector(".hof-fact-sub, .hof-plan-facts");
    const sub = await page.evaluate(() => {
      const dd = [...document.querySelectorAll(".hof-plan-facts dd")].find(node => /Mükellef/.test(node.textContent) && node.querySelector("small"));
      if (!dd) return null;
      const small = dd.querySelector("small");
      return { display: getComputedStyle(small).display, text: dd.textContent };
    });
    ok(sub && sub.display === "block", `posta kutusu etiketi "Mükellef"in altında ayrı satırda (${JSON.stringify(sub)})`);
  });

  console.log("F) UX5/KÖ4 ve UI7: düzenle → e-Fatura işaretini kaldır → bilgi iletisi; alan adları yazım düzeninde");
  await part("F", async () => {
    await page.evaluate(id => window.HOF.accounts.open(id), mukellef.id);
    await page.waitForSelector('[data-act="edit"]');
    await page.click('[data-act="edit"]');
    await page.waitForSelector(`${TOP} input[name="eInvoice"]`);
    const labels = await page.$$eval(`${TOP} label.hof-field > span`, nodes => nodes.map(node => node.textContent.replace(/\s*\*\s*$/, "").trim()));
    ok(labels.includes("e-Fatura Posta Kutusu Etiketi") && labels.includes("e-Fatura Senaryosu"), `alan adları: ${labels.filter(label => /^e-Fatura/.test(label)).join(" | ")}`);
    const flag = page.locator(`${TOP} input[name="eInvoice"]`);
    await flag.scrollIntoViewIfNeeded();
    await flag.click();
    await sleep(400);
    const flagToast = (await toasts(page)).join(" | ");
    ok(!(await flag.isChecked()) && /işareti kaldırıldı/.test(flagToast) && /e-Arşiv/.test(flagToast), `işaret kalktı ve bilgi iletisi çıktı (${flagToast.slice(0, 140)})`);
    ok((await page.$eval(`${TOP} input[name="eAlias"]`, node => node.value)) === "urn:mail:defaultpk@alici.com.tr", "posta kutusu etiketi silinmedi (formda)");
  });

  console.log("G) UX13: Mükellef Sorgula — GİB unvanı yazılandan farklı → öneri, tek tıkla uygulanır");
  await part("G", async () => {
    await closeAll(page);
    await page.evaluate(() => window.HOF.accounts.newFor({ type: "customer" }));
    await page.waitForSelector(`${TOP} input[name="name"]`);
    await page.keyboard.type("Beta Yazılım A.Ş.", { delay: 35 });
    await typeHuman(page, page.locator(`${TOP} input[name="taxNo"]`), BUYER_VKN);
    await page.keyboard.press("Tab");
    await page.locator(`${TOP} button`, { hasText: "Mükellef Sorgula" }).click();
    const offered = await page.waitForSelector(`${TOP} [data-gib-title]:not([hidden])`, { timeout: 8000 }).then(() => true, () => false);
    const offerText = offered ? await page.$eval(`${TOP} [data-gib-title]`, node => node.textContent) : "";
    ok(offered && /ALICI TİCARET A\.Ş\./.test(offerText), `GİB unvanı öneri olarak gösterildi (${offerText.slice(0, 90)})`);
    if (offered) {
      await page.locator(`${TOP} [data-gib-title-use]`).click();
      ok((await page.$eval(`${TOP} input[name="name"]`, node => node.value)) === "ALICI TİCARET A.Ş.", "Unvanı Bununla Değiştir → ad güncellendi");
      await page.locator(`${TOP} button[type="submit"]`).click();
      await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible input[name="taxNo"]'), null, { timeout: 8000 }).catch(() => null);
      await sleep(500);
      // Aynı VKN'li mükellef cari zaten var: kaydetmede "Aynı Adlı Cari Var" sorusu çıkabilir → bilerek açılır.
      const twin = await page.$(`${TOP} [data-answer="yes"]`);
      if (twin) {
        await twin.click();
        await sleep(600);
      }
      ok(db("SELECT COUNT(*) AS n FROM accounts WHERE name = ? AND tax_no = ?", "ALICI TİCARET A.Ş.", BUYER_VKN).n === 1, "veri tabanında GİB unvanıyla kaydedildi");
    }
    await closeAll(page);
  });

  console.log("G2) UX21: Posta Kutusu Seçin penceresinde açılır listede Enter seçer");
  await part("G2", async () => {
    await page.evaluate(() => window.HOF.accounts.newFor({ type: "customer" }));
    await page.waitForSelector(`${TOP} input[name="name"]`);
    await page.keyboard.type("Çoklu A.Ş.", { delay: 35 });
    await typeHuman(page, page.locator(`${TOP} input[name="taxNo"]`), MULTI_VKN);
    await page.keyboard.press("Tab");
    await page.locator(`${TOP} button`, { hasText: "Mükellef Sorgula" }).click();
    await page.waitForSelector(`${TOP} select[name="alias"]`);
    await sleep(300);
    ok((await focused(page)).startsWith("SELECT[alias]"), `odak posta kutusu listesinde (${await focused(page)})`);
    await page.keyboard.press("ArrowDown");
    const picked = await page.$eval(`${TOP} select[name="alias"]`, node => node.value);
    await page.keyboard.press("Enter");
    const closed = await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible select[name="alias"]'), null, { timeout: 4000 }).then(() => true, () => false);
    ok(closed, "Enter seçimi onayladı, pencere kapandı");
    await sleep(600);
    console.log(`    bildirimler: ${(await toasts(page)).join(" | ").slice(0, 300)}`);
    const alias = await page.$eval(`${TOP} input[name="eAlias"]`, node => node.value).catch(() => "");
    ok(alias === picked && /@coklu\.com\.tr$/.test(alias), `seçilen posta kutusu forma yazıldı (${alias} / ${picked})`);
  });

  console.log("H) UX8: taksit kartı \"Kartı Kapat\" onaylı; odak Vazgeç, Enter kapatmaz");
  await part("H", async () => {
    await page.evaluate(id => window.HOF.plans.open(id), plan.id);
    await page.waitForSelector('.hof-plans [data-act="close"]');
    const closeLabel = (await page.textContent('.hof-plans [data-act="close"]')).trim();
    ok(closeLabel === "Kartı Kapat", `düğme adı ayırt edici (${closeLabel})`);
    await page.click('.hof-plans [data-act="close"]');
    const asked = await page.waitForSelector(`${TOP} [data-answer="no"]`, { timeout: 4000 }).then(() => true, () => false);
    ok(asked, "kalan varken onay soruldu");
    if (asked) {
      await sleep(250);
      ok(/answer=no/.test(await focused(page)), `odak Vazgeç'te (${await focused(page)})`);
      const question = await page.$eval(`${TOP} .hof-modal-text`, node => node.textContent);
      ok(/Kalan ₺3\.000,00/.test(question), `soruda kalan tutar (${question.slice(0, 80)})`);
      await page.keyboard.press("Enter");
      await sleep(600);
    }
    ok(db("SELECT status FROM plans WHERE id = ?", plan.id).status === "active", "kart açık kaldı (veri tabanı)");
    if (asked) {
      await page.click('.hof-plans [data-act="close"]');
      await page.locator(`${TOP} [data-answer="yes"]`).click();
      await page.waitForSelector('.hof-plans [data-act="reopen"]');
      ok(db("SELECT status FROM plans WHERE id = ?", plan.id).status === "closed", "onaylanınca kart kapandı (veri tabanı)");
    }
    await closeAll(page);
  });

  console.log("I) UI1 / UI10 / UI3c / UI11: kontrast ve yerleşim");
  await part("I", async () => {
    await page.click('#hof-sidecard [data-action="accounts"]');
    await page.waitForSelector(".hof-whatsapp");
    const wa = await contrastOf(page, ".hof-modal-backdrop.is-visible .hof-whatsapp");
    ok(wa.length && wa.every(item => item.ratio >= 4.5), `WhatsApp düğmeleri ≥ 4,5:1 (${JSON.stringify(wa)})`);
    const th = await contrastOf(page, ".hof-modal-backdrop.is-visible .hof-table th");
    ok(th.length && th.every(item => item.ratio >= 4.5), `tablo başlıkları ≥ 4,5:1 (en düşük ${Math.min(...th.map(item => item.ratio))})`);
    const eyebrow = await contrastOf(page, ".hof-modal-backdrop.is-visible .hof-eyebrow");
    ok(eyebrow.length && eyebrow.every(item => item.ratio >= 4.5), `pencere üst yazısı ≥ 4,5:1 (${JSON.stringify(eyebrow)})`);
    await closeAll(page);
    await page.click('#hof-sidecard [data-action="stock"]');
    await page.waitForSelector(".hof-stock-table tbody tr");
    const stock = await page.evaluate(() => {
      const cells = [...document.querySelectorAll(".hof-stock-table tbody td.hof-plan-no")].map(td => ({ text: td.textContent, lines: Math.round(td.getBoundingClientRect().height / parseFloat(getComputedStyle(td).lineHeight || "16")), wraps: td.scrollHeight > 0 && getComputedStyle(td).whiteSpace }));
      const head = document.querySelector(".hof-stock-table thead th.hof-plan-no");
      const kpis = [...document.querySelectorAll(".hof-stock-kpis > div, .hof-modal-backdrop.is-visible .hof-plans-kpis > div")].filter(node => node.getClientRects().length).map(node => Math.round(node.getBoundingClientRect().top));
      const range = document.createRange();
      const oneLine = node => {
        range.selectNodeContents(node);
        const rects = [...range.getClientRects()].filter(rect => rect.width > 0);
        return new Set(rects.map(rect => Math.round(rect.top))).size === 1;
      };
      return { codesOneLine: cells.map(cell => cell.text).length && [...document.querySelectorAll(".hof-stock-table tbody td.hof-plan-no")].every(oneLine), headOneLine: head ? oneLine(head) : false, kpiTops: kpis };
    });
    ok(stock.codesOneLine, "stok kodları (STK-2.0.21-001, 8690123456789) tek satırda");
    ok(stock.headOneLine, "\"Stok Kodu\" başlığı tek satırda");
    ok(stock.kpiTops.length === 5 && new Set(stock.kpiTops).size === 1, `5 özet kartı tek sırada (üst: ${stock.kpiTops.join(", ")})`);
    await closeAll(page);
    await page.click('#hof-sidecard [data-action="cheques"]');
    await page.waitForSelector(".hof-cheques-modal .hof-plan-title small");
    const chequeTitles = await page.$$eval(".hof-cheques-modal h2, .hof-cheques-modal h3", nodes => nodes.filter(node => node.getClientRects().length && node.textContent.trim() === "Çek / Senet").length);
    ok(chequeTitles === 1, `Çek / Senet başlığı bir kez (${chequeTitles})`);
    await closeAll(page);
    await page.evaluate(() => window.HOF.reportCenter.open());
    await page.waitForSelector(".hof-rc-hero");
    const hero = await contrastOf(page, ".hof-rc-hero, .hof-rc-hero small");
    ok(hero.length >= 2 && hero.every(item => item.ratio >= 4.5), `Rapor Merkezi kartı ≥ 4,5:1 (${JSON.stringify(hero)})`);
    await closeAll(page);
  });

  console.log("J) UI9 ve UI11: kısaltılmış tutar simge başta (Nakit Akış grafiği); görünüm seçeneği");
  await part("J", async () => {
    await must("büyük tahsilat", api.post(`/api/workspace/accounts/${zeynep.id}/entries`, { kind: "in", amount: "22.600.000", date: "2026-10-07", note: "Büyük", method: "cash" }));
    await page.evaluate(() => window.HOF.overview.openReports("flow"));
    await page.waitForSelector('select[data-field="group"]');
    const firstOption = await page.$eval('select[data-field="group"] option[value=""]', node => node.textContent);
    ok(firstOption === "Tek Tek Hareketler", `görünüm seçeneği (${firstOption})`);
    await page.waitForSelector("svg text.hof-chart-tick[text-anchor='end']", { timeout: 15000 }).catch(() => null);
    const ticks = await page.$$eval("svg text.hof-chart-tick[text-anchor='end']", nodes => nodes.map(node => node.textContent.trim()));
    const short = ticks.filter(text => /Mn|B/.test(text));
    ok(short.length > 0 && short.every(text => /^-?₺\d/.test(text) && !/₺$/.test(text)), `eksen tutarları simge başta (${JSON.stringify(ticks.slice(0, 6))})`);
    ok(ticks.includes("₺0"), `eksen sıfırı da simgeli "₺0" (${JSON.stringify(ticks.slice(0, 3))})`);
    await closeAll(page);
  });

  console.log("K) UX11 / UX22: Yönetim — muhasebe rol açıklaması; yeni kullanıcının ilk parolası");
  await part("K", async () => {
    const adminPage = await newPage(adminContext, "/admin.html");
    await adminPage.waitForSelector("#adm-new-user", { timeout: 20000 });
    const note = await adminPage.$eval('#adm-role-list [data-role="muhasebe"] .adm-role-note', node => node.textContent).catch(() => "");
    ok(/Finans Raporları/.test(note) && !/raporlar yok/.test(note), `muhasebe açıklaması güncel (${note.slice(0, 120)})`);
    await adminPage.click("#adm-new-user");
    await adminPage.waitForSelector(`${TOP} input[name="password"]`);
    ok((await adminPage.$eval(`${TOP} input[name="password"]`, node => node.value)) === "", "İlk Parola alanı boş geliyor");
    await adminPage.keyboard.type("Deniz Yıldırım", { delay: 30 });
    await typeHuman(adminPage, adminPage.locator(`${TOP} input[name="username"]`), "deniz");
    await adminPage.locator(`${TOP} [data-make-password]`).click();
    const made = await adminPage.$eval(`${TOP} input[name="password"]`, node => ({ value: node.value, selected: node.selectionStart === 0 && node.selectionEnd === node.value.length }));
    ok(/^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/.test(made.value) && made.selected, `Parola Üret güçlü parola yazdı ve tamamını seçti (${made.value.length} karakter, seçili: ${made.selected})`);
    await adminPage.keyboard.type("Deniz-Parola-2026!", { delay: 30 });
    await adminPage.locator(`${TOP} button[type="submit"]`).click();
    await adminPage.waitForFunction(() => document.querySelector("#adm-users")?.textContent.includes("deniz"), null, { timeout: 8000 }).catch(() => null);
    const denizLogin = await createClient(BASE).login("deniz", "Deniz-Parola-2026!");
    ok(denizLogin.status === 200, `yazılan parola aynen kaydedildi (giriş ${denizLogin.status})`);
    await adminPage.close();
  });

  console.log("L) UX1: iki kişi aynı cariyi düzenler (yönetici + muhasebe)");
  let ayse = null;
  await part("L", async () => {
    const ayseContext = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: "tr-TR" });
    await ayseContext.addInitScript(() => document.addEventListener("DOMContentLoaded", () => document.head.appendChild(Object.assign(document.createElement("style"), { textContent: "#hof-license-bar,.hof-license-notice{display:none!important}" }))));
    ayse = await login(ayseContext, "ayse", AYSE);
    for (const p of [page, ayse]) {
      await p.evaluate(id => window.HOF.accounts.open(id), zeynep.id);
      await p.waitForSelector('[data-act="edit"]');
      await p.click('[data-act="edit"]');
      await p.waitForSelector(`${TOP} input[name="phone"]`);
    }
    const adminPhone = page.locator(`${TOP} input[name="phone"]`);
    await adminPhone.click({ clickCount: 3 });
    await page.keyboard.type("05551234567", { delay: 35 });
    await page.locator(`${TOP} button[type="submit"]`).click();
    await page.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible input[name="phone"]'), null, { timeout: 8000 }).catch(() => null);
    ok(db("SELECT phone FROM accounts WHERE id = ?", zeynep.id).phone === "05551234567", "ön koşul: yöneticinin telefonu kaydedildi");
    await typeHuman(ayse, ayse.locator(`${TOP} input[name="email"]`), "zeynep@ornek.com");
    await ayse.locator(`${TOP} button[type="submit"]`).click();
    await ayse.waitForFunction(() => /başka biri tarafından değiştirildi/.test(document.querySelector(".hof-modal-backdrop.is-visible:last-of-type .hof-form-error")?.textContent || ""), null, { timeout: 8000 }).catch(() => null);
    const staleError = await ayse.$eval(`${TOP} .hof-form-error`, node => node.textContent).catch(() => "");
    ok(/başka biri tarafından değiştirildi/.test(staleError), `muhasebeye açık ileti (${staleError.slice(0, 110)})`);
    ok(db("SELECT phone FROM accounts WHERE id = ?", zeynep.id).phone === "05551234567", "yöneticinin telefonu silinmedi (veri tabanı)");
    const formNow = await ayse.evaluate(() => ({ email: document.querySelector('.hof-modal-backdrop.is-visible:last-of-type input[name="email"]')?.value, phone: document.querySelector('.hof-modal-backdrop.is-visible:last-of-type input[name="phone"]')?.value }));
    ok(formNow.email === "zeynep@ornek.com" && formNow.phone === "05551234567", `muhasebenin yazdığı e-posta duruyor, telefon güncel hâliyle geldi (${JSON.stringify(formNow)})`);
    await ayse.locator(`${TOP} button[type="submit"]`).click();
    await ayse.waitForFunction(() => !document.querySelector('.hof-modal-backdrop.is-visible input[name="email"]'), null, { timeout: 8000 }).catch(() => null);
    const final = db("SELECT phone, email FROM accounts WHERE id = ?", zeynep.id);
    ok(final.phone === "05551234567" && final.email === "zeynep@ornek.com", `yeniden kaydedince ikisi de yerinde (${JSON.stringify({ ...final })})`);
  });

  console.log("M) UX7: muhasebe tahsilatı silerken doğru yol");
  await part("M", async () => {
    if (!ayse) throw new Error("muhasebe oturumu açılamadı");
    await closeAll(ayse);
    await ayse.evaluate(id => window.HOF.accounts.open(id), zeynep.id);
    await ayse.waitForSelector(`[data-delete-entry="${entryId}"]`);
    await ayse.click(`[data-delete-entry="${entryId}"]`);
    await ayse.waitForSelector(`${TOP} .hof-modal-text`);
    const ayseText = await ayse.$eval(`${TOP} .hof-modal-text`, node => node.textContent);
    ok(/Yöneticiniz Yönetim → Silinenler’den geri yükleyebilir/.test(ayseText) && !/Silinenler’den geri yüklenebilir/.test(ayseText), `muhasebeye yetkisine göre yol (${ayseText.slice(-80)})`);
    await ayse.locator(`${TOP} [data-answer="no"]`).click();
  });
} catch (error) {
  failed += 1;
  console.log(`✗ beklenmeyen hata: ${error.stack || error.message}`);
} finally {
  ok(errors.length === 0, `sayfa hatası yok${errors.length ? `: ${errors.slice(0, 5).join(" | ")}` : ""}`);
  console.log(`\n${failed ? "✗" : "✓"} uiux-a-243: ${passed} geçti, ${failed} kaldı`);
  await browser.close();
  await app.close();
  await edm.close();
  rmSync(root, { recursive: true, force: true });
  process.exitCode = failed ? 1 : 0;
}
